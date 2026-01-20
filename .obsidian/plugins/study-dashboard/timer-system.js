// Study Dashboard - 자동 타이머 & 복습 추적 시스템

const { Plugin, Notice } = require('obsidian');

class AnkiTimerSystem {
    constructor(plugin) {
        this.plugin = plugin;
        this.currentTimer = null;
        this.currentFile = null;
    }
    
    // 파일 열릴 때 자동으로 타이머 시작
    startTimer(file) {
        // Anki 카드 파일인지 확인
        if (!this.isAnkiCard(file)) return;
        
        // 이미 타이머가 실행 중이면 중지
        if (this.currentTimer) {
            this.stopTimer(false);
        }
        
        this.currentFile = file;
        this.currentTimer = {
            startTime: Date.now(),
            file: file
        };
        
        // 시작 알림
        new Notice(`⏱️ 타이머 시작! 문제를 풀어보세요.`);
        
        // 타이머 UI 업데이트 (1초마다)
        this.timerInterval = setInterval(() => {
            this.updateTimerDisplay();
        }, 1000);
    }
    
    // 답안 버튼 클릭 시 타이머 종료
    async stopTimer(saveRecord = true) {
        if (!this.currentTimer) return;
        
        const elapsed = Math.floor((Date.now() - this.currentTimer.startTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        
        // 타이머 정리
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        
        // 기록 저장
        if (saveRecord && this.currentFile) {
            await this.saveTimeRecord(this.currentFile, elapsed);
        }
        
        // 종료 알림
        new Notice(`⏱️ 풀이 완료! 소요 시간: ${minutes}분 ${seconds}초`);
        
        this.currentTimer = null;
        this.currentFile = null;
    }
    
    // 시간 기록 저장
    async saveTimeRecord(file, elapsedSeconds) {
        try {
            const content = await this.plugin.app.vault.read(file);
            const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
            const match = content.match(frontmatterRegex);
            
            if (!match) return;
            
            // frontmatter 파싱
            const frontmatter = this.parseFrontmatter(match[1]);
            
            // 복습 횟수 증가
            frontmatter.reviewCount = (parseInt(frontmatter.reviewCount) || 0) + 1;
            
            // 총 시간 업데이트
            frontmatter.totalTime = (parseInt(frontmatter.totalTime) || 0) + elapsedSeconds;
            
            // 평균 시간 계산
            frontmatter.avgTime = Math.floor(frontmatter.totalTime / frontmatter.reviewCount);
            
            // lastReview 업데이트
            frontmatter.lastReview = new Date().toISOString().split('T')[0];
            
            // 다음 복습일 계산 (Anki 알고리즘)
            frontmatter.nextReview = this.calculateNextReview(frontmatter.reviewCount);
            
            // 상태 업데이트
            frontmatter.status = this.calculateStatus(frontmatter.reviewCount);
            
            // frontmatter 재구성
            const newFrontmatter = this.buildFrontmatter(frontmatter);
            const newContent = content.replace(frontmatterRegex, `---\n${newFrontmatter}\n---`);
            
            // 복습 기록 테이블에 추가
            const today = new Date().toISOString().split('T')[0];
            const minutes = Math.floor(elapsedSeconds / 60);
            const seconds = elapsedSeconds % 60;
            const timeStr = `${minutes}분 ${seconds}초`;
            
            const recordLine = `| ${today} | ⬜ Again / ⬜ Hard / ⬜ Good / ⬜ Easy | ${timeStr} |  |`;
            const updatedContent = this.addReviewRecord(newContent, recordLine);
            
            // 파일 저장
            await this.plugin.app.vault.modify(file, updatedContent);
            
            console.log('시간 기록 저장 완료:', elapsedSeconds, '초');
            
        } catch (error) {
            console.error('시간 기록 저장 실패:', error);
            new Notice('❌ 시간 기록 저장 실패');
        }
    }
    
    // Frontmatter 파싱
    parseFrontmatter(text) {
        const frontmatter = {};
        const lines = text.split('\n');
        
        lines.forEach(line => {
            const [key, ...valueParts] = line.split(':');
            if (key && valueParts.length > 0) {
                const value = valueParts.join(':').trim().replace(/^["']|["']$/g, '');
                frontmatter[key.trim()] = value;
            }
        });
        
        return frontmatter;
    }
    
    // Frontmatter 빌드
    buildFrontmatter(data) {
        return Object.entries(data)
            .map(([key, value]) => {
                if (typeof value === 'string' && (value.includes(' ') || value.includes(','))) {
                    return `${key}: "${value}"`;
                }
                return `${key}: ${value}`;
            })
            .join('\n');
    }
    
    // 다음 복습일 계산 (Anki 간격 알고리즘)
    calculateNextReview(reviewCount) {
        const today = new Date();
        const intervals = [1, 3, 7, 14, 30, 60, 120]; // 일 단위
        const interval = intervals[Math.min(reviewCount, intervals.length - 1)];
        
        today.setDate(today.getDate() + interval);
        return today.toISOString().split('T')[0];
    }
    
    // 상태 계산
    calculateStatus(reviewCount) {
        if (reviewCount >= 5) return 'mastered';
        if (reviewCount >= 2) return 'reviewing';
        return 'learning';
    }
    
    // 복습 기록 추가
    addReviewRecord(content, recordLine) {
        const tableRegex = /(## 📊 복습 기록[\s\S]*?\|.*?\|.*?\|.*?\|.*?\|)\n(\|.*?\|.*?\|.*?\|.*?\|)/;
        const match = content.match(tableRegex);
        
        if (match) {
            // 헤더 다음에 새 기록 추가
            return content.replace(tableRegex, `$1\n${recordLine}\n$2`);
        }
        
        return content;
    }
    
    // Anki 카드 파일인지 확인
    isAnkiCard(file) {
        if (!file || file.extension !== 'md') return false;
        
        // 파일 경로로 확인
        if (file.path.includes('학습관리/문제은행')) return true;
        
        return false;
    }
    
    // 타이머 디스플레이 업데이트
    updateTimerDisplay() {
        if (!this.currentTimer) return;
        
        const elapsed = Math.floor((Date.now() - this.currentTimer.startTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        
        // 상태바에 시간 표시
        this.plugin.updateStatusBar(`⏱️ ${minutes}:${seconds.toString().padStart(2, '0')}`);
    }
}

// Study Dashboard 플러그인에 통합
class StudyDashboardWithTimer extends Plugin {
    async onload() {
        // 기존 설정 로드
        await this.loadSettings();
        
        // 타이머 시스템 초기화
        this.timerSystem = new AnkiTimerSystem(this);
        
        // 상태바 아이템 추가
        this.statusBarItem = this.addStatusBarItem();
        
        // 파일 열림 이벤트 감지
        this.registerEvent(
            this.app.workspace.on('file-open', (file) => {
                if (file) {
                    this.timerSystem.startTimer(file);
                }
            })
        );
        
        // 답안 버튼 클릭 감지 (DOM 이벤트)
        this.registerDomEvent(document, 'click', (evt) => {
            const target = evt.target;
            
            // 답안 접기/펼치기 버튼 클릭 시
            if (target.closest('.callout[data-callout="success"]') ||
                target.textContent.includes('답안 보기') ||
                target.textContent.includes('정답 보기')) {
                
                // 타이머 종료
                this.timerSystem.stopTimer(true);
            }
        });
        
        // 명령어 추가
        this.addCommand({
            id: 'stop-timer',
            name: '타이머 중지',
            callback: () => {
                this.timerSystem.stopTimer(false);
            }
        });
        
        this.addCommand({
            id: 'view-stats',
            name: '학습 통계 보기',
            callback: () => {
                this.showStats();
            }
        });
    }
    
    updateStatusBar(text) {
        this.statusBarItem.setText(text);
    }
    
    async showStats() {
        // 통계 모달 표시
        new Notice('학습 통계 기능 준비 중...');
    }
    
    onunload() {
        // 타이머 정리
        if (this.timerSystem) {
            this.timerSystem.stopTimer(false);
        }
    }
}

module.exports = StudyDashboardWithTimer;
