const { Plugin, PluginSettingTab, Setting, ItemView, Notice, Modal, normalizePath } = require('obsidian');

// 기본 설정값
const DEFAULT_SETTINGS = {
    problemsFolder: '학습관리/문제은행',
    maxProblems: 500,
    dailyGoal: 5,
    targetDate: '2025-12-31',
    defaultSubject: '수학',
    subjects: ['수학', '물리', '화학', '생물', '영어', '국어', '한국사'],
    timerEnabled: true,
    masteredColor: '#10b981',
    reviewingColor: '#f59e0b',
    learningColor: '#ef4444'
};

// 뷰 타입 상수
const VIEW_TYPE_STUDY_DASHBOARD = 'study-dashboard-view';

// 문제 상태 상수
const PROBLEM_STATUS = {
    LEARNING: 'learning',
    REVIEWING: 'reviewing', 
    MASTERED: 'mastered',
    EMPTY: 'empty'
};

// 복습 등급 시스템
const REVIEW_GRADES = {
    S: { name: '신급', color: '#800080', minReviews: 10, emoji: '👑' },
    A: { name: '제왕급', color: '#FFD700', minReviews: 7, emoji: '⭐' },
    B: { name: '영웅급', color: '#B22222', minReviews: 5, emoji: '🔥' },
    C: { name: '평민', color: '#708090', minReviews: 3, emoji: '📚' },
    D: { name: '하층민', color: '#654321', minReviews: 2, emoji: '📖' },
    E: { name: '노예', color: '#2F4F4F', minReviews: 0, emoji: '❌' }
};

// 복습 횟수로 등급 계산
const getReviewGrade = (reviewCount, understanding = 0) => {
    if (reviewCount === 0 || understanding === 0) return 'E';
    if (reviewCount >= 10) return 'S';
    if (reviewCount >= 7) return 'A';
    if (reviewCount >= 5) return 'B';
    if (reviewCount >= 3) return 'C';
    if (reviewCount >= 2) return 'D';
    return 'E';
};

// 헬퍼 함수들
const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

// 메인 플러그인 클래스
class StudyDashboardPlugin extends Plugin {
    async onload() {
        console.log('📚 Study Dashboard 로드 시작');
        
        await this.loadSettings();
        this.registerView(VIEW_TYPE_STUDY_DASHBOARD, (leaf) => new StudyDashboardView(leaf, this));
        this.addStyles();
        this.addRibbonIcon('graduation-cap', '📚 Study Dashboard', () => this.activateView());
        this.registerCommands();
        this.initializeTimerState();
        this.addSettingTab(new StudyDashboardSettingTab(this.app, this));
        
        console.log('✅ Study Dashboard 로드 완료!');
    }

    async onunload() {
        if (this.timerState?.interval) {
            clearInterval(this.timerState.interval);
        }
    }
    
    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }
    
    async saveSettings() {
        await this.saveData(this.settings);
    }
    
    async activateView() {
        this.app.workspace.detachLeavesOfType(VIEW_TYPE_STUDY_DASHBOARD);
        await this.app.workspace.getRightLeaf(false).setViewState({
            type: VIEW_TYPE_STUDY_DASHBOARD,
            active: true
        });
        this.app.workspace.revealLeaf(
            this.app.workspace.getLeavesOfType(VIEW_TYPE_STUDY_DASHBOARD)[0]
        );
    }
    
    registerCommands() {
        this.addCommand({
            id: 'open-study-dashboard',
            name: '📚 Study Dashboard 열기',
            callback: () => this.activateView()
        });

        this.addCommand({
            id: 'create-new-problem',
            name: '➕ 새 문제 생성',
            callback: () => {
                new ProblemCreationModal(this.app, this).open();
            }
        });
    }
    
    initializeTimerState() {
        this.timerState = {
            isRunning: false,
            startTime: null,
            seconds: 0,
            interval: null,
            currentSubject: this.settings.defaultSubject
        };
    }

    startTimer() {
        if (this.timerState.isRunning) return;
        this.timerState.isRunning = true;
        this.timerState.startTime = Date.now();
        this.timerState.seconds = 0;
        this.timerState.interval = setInterval(() => {
            this.timerState.seconds++;
            this.updateTimerDisplay();
        }, 1000);
        new Notice('⏱️ 타이머 시작!');
    }

    stopTimer() {
        if (!this.timerState.isRunning) return;
        this.timerState.isRunning = false;
        if (this.timerState.interval) {
            clearInterval(this.timerState.interval);
            this.timerState.interval = null;
        }
        const timeSpent = this.timerState.seconds;
        new Notice(`⏹️ 타이머 정지! 소요시간: ${formatTime(timeSpent)}`);
        return timeSpent;
    }

    resetTimer() {
        this.stopTimer();
        this.timerState.seconds = 0;
        this.updateTimerDisplay();
        new Notice('🔄 타이머 초기화');
    }

    updateTimerDisplay() {
        const displays = document.querySelectorAll('.timer-display');
        displays.forEach(display => {
            display.textContent = formatTime(this.timerState.seconds);
        });
    }

    // 문제 중복 생성 방지 강화
    async checkProblemExists(subject, number) {
        const subjectFolder = normalizePath(`${this.settings.problemsFolder}/${subject}`);
        const files = this.app.vault.getMarkdownFiles()
            .filter(file => file.path.startsWith(subjectFolder));
        
        // 번호로 찾기
        const existingFile = files.find(file => {
            const match = file.basename.match(/^(\d+)_/);
            return match && parseInt(match[1]) === number;
        });
        
        return existingFile;
    }
async createProblem(subject, number, title, difficulty = 3) {
        try {
            const subjectFolder = normalizePath(`${this.settings.problemsFolder}/${subject}`);
            
            try {
                await this.app.vault.createFolder(subjectFolder);
            } catch (folderError) {
            }
            
            const existingFile = await this.checkProblemExists(subject, number);
            if (existingFile) {
                new Notice(`❌ ${subject} ${number}번 문제가 이미 존재합니다: ${existingFile.basename}`);
                return false;
            }
            
            const fileName = `${String(number).padStart(3, '0')}_${title.replace(/[^\w가-힣]/g, '_')}.md`;
            const filePath = normalizePath(`${subjectFolder}/${fileName}`);
            
            const today = new Date().toISOString().split('T')[0];
            
            const content = `---
number: ${number}
title: "${title}"
subject: ${subject}
difficulty: ${difficulty}
reviewCount: 0
times: []
understandings: []
understanding: 0
created: ${today}
tags: [anki-card, ${subject}, study-dashboard]
---

# ${number}. ${title}

> 📚 **출처**: (출처명) (페이지)  
> 📖 **단원**: ${subject}  
> ⭐ **난이도**: ${difficulty}/5

---

## 📊 복습 진행 현황

\`\`\`dataviewjs
const current = dv.current();
const content = await dv.io.load(dv.current().file.path);
const checkedCount = (content.match(/- \\[x\\] \\d+차 복습/gi) || []).length;
const reviewCount = checkedCount;
const times = current.times || [];
const understandings = current.understandings || [];
const avgUnderstanding = understandings.length > 0 ? Math.round(understandings.reduce((a, b) => a + b, 0) / understandings.length) : 0;

function getGrade(count, understand) {
    if (count === 0 || understand === 0) return { name: '노예', emoji: '❌', level: 'E', color: '#2F4F4F' };
    if (count >= 10) return { name: '신급', emoji: '👑', level: 'S', color: '#800080' };
    if (count >= 7) return { name: '제왕급', emoji: '⭐', level: 'A', color: '#FFD700' };
    if (count >= 5) return { name: '영웅급', emoji: '🔥', level: 'B', color: '#B22222' };
    if (count >= 3) return { name: '평민', emoji: '📚', level: 'C', color: '#708090' };
    if (count >= 2) return { name: '하층민', emoji: '📖', level: 'D', color: '#654321' };
    return { name: '노예', emoji: '❌', level: 'E', color: '#2F4F4F' };
}

function formatTime(timeStr) {
    if (!timeStr || timeStr === '-') return '-';
    const parts = timeStr.split(':');
    if (parts.length === 3) {
        const hours = parseInt(parts[0]);
        const mins = parseInt(parts[1]);
        const secs = parseInt(parts[2]);
        if (hours > 0) return hours + '시간 ' + mins + '분 ' + secs + '초';
        return mins + '분 ' + secs + '초';
    }
    return timeStr;
}

const grade = getGrade(reviewCount, avgUnderstanding);
const percentage = Math.min((reviewCount / 10) * 100, 100).toFixed(0);
const lastTime = times.length > 0 ? formatTime(times[times.length - 1]) : '-';

dv.paragraph('<div style="background: var(--background-secondary); padding: 20px; border-radius: 12px; margin-bottom: 20px; border: 2px solid var(--background-modifier-border);"><div style="display: flex; justify-content: space-between; margin-bottom: 10px;"><span style="font-weight: bold; color: var(--text-muted);">전체 진행률</span><span style="font-weight: bold; color: var(--interactive-accent);">' + reviewCount + '/10 완료</span></div><div style="position: relative; height: 30px; background: var(--background-primary); border-radius: 15px; overflow: hidden;"><div style="height: 100%; background: linear-gradient(90deg, var(--interactive-accent), var(--interactive-accent-hover)); width: ' + percentage + '%;"></div><div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: white; font-weight: bold;">' + percentage + '%</div></div><div style="display: flex; align-items: center; gap: 15px; padding: 20px; background: var(--background-primary); border-radius: 10px; margin-top: 20px;"><div style="font-size: 3rem;">' + grade.emoji + '</div><div style="flex: 1;"><div style="font-size: 1.5rem; font-weight: bold; color: ' + grade.color + ';">' + grade.level + '급 - ' + grade.name + '</div><div style="color: var(--text-muted);">' + (reviewCount >= 10 ? '완벽합니다! 신급 달성!' : reviewCount >= 7 ? reviewCount + '회 복습 완료! ' + (10 - reviewCount) + '회만 더!' : reviewCount >= 1 ? reviewCount + '회 복습 완료!' : '아직 시작 안 함') + '</div></div></div><div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-top: 20px;"><div style="background: var(--background-primary); padding: 15px; border-radius: 10px; text-align: center;"><div style="font-size: 1.8rem; font-weight: bold; color: var(--interactive-accent);">' + reviewCount + '회</div><div style="font-size: 0.85rem; color: var(--text-muted);">복습 완료</div></div><div style="background: var(--background-primary); padding: 15px; border-radius: 10px; text-align: center;"><div style="font-size: 1.8rem; font-weight: bold; color: var(--interactive-accent);">' + avgUnderstanding + '%</div><div style="font-size: 0.85rem; color: var(--text-muted);">평균 이해도</div></div><div style="background: var(--background-primary); padding: 15px; border-radius: 10px; text-align: center;"><div style="font-size: 1.8rem; font-weight: bold; color: var(--interactive-accent);">' + lastTime + '</div><div style="font-size: 0.85rem; color: var(--text-muted);">최근 시간</div></div></div></div>');

const rows = [];
let cumulativeUnderstanding = 0;
for (let i = 1; i <= 10; i++) {
    const status = i <= reviewCount ? '✅' : i === reviewCount + 1 ? '⏳' : '⬜';
    const time = i <= times.length ? formatTime(times[i - 1]) : '-';
    const understand = i <= understandings.length ? understandings[i - 1] + '%' : '-';
    
    if (i <= understandings.length) {
        cumulativeUnderstanding += understandings[i - 1];
    }
    const avgUntilNow = i <= understandings.length ? Math.round(cumulativeUnderstanding / i) + '%' : i <= reviewCount ? avgUnderstanding + '%' : '-';
    
    rows.push('| ' + i + '차 | ' + status + ' | ' + time + ' | ' + understand + ' | ' + avgUntilNow + ' |');
}

dv.paragraph('| 회차 | 상태 | 소요시간 | 이해도 | 평균이해도 |\\n|:----:|:----:|:--------:|:------:|:----------:|\\n' + rows.join('\\n'));
\`\`\`

---

## ⏱️ 문제 풀이 타이머

\`\`\`stopwatch
title: "${subject} ${number}번 - ${title}"
showMilliseconds: true
autoStart: false
theme: purple
\`\`\`

> [!warning]+ 📝 복습 후 반드시 기록하세요!
> 
> ### 복습 완료 시 순서:
> 
> 1. **타이머 정지** 후 시간 확인 (예: 00:03:25)
> 
> 2. **아래 체크박스 체크** (자동으로 reviewCount 증가)
>    - [x] 1차 복습 🔄
> 
> 3. **Frontmatter 수정** (파일 맨 위):
>    \`\`\`yaml
>    times: ["00:03:25"]  # 타이머 시간 추가
>    understandings: [70]  # 이해도 입력
>    \`\`\`
> 
> 4. **저장** (Ctrl+S) → 진행바 자동 업데이트!
> 
> ### 시간 형식:
> - 3분 25초 → \`"00:03:25"\`
> - 1시간 20분 15초 → \`"01:20:15"\`

---

## 📸 문제

> [!info]+ 🖼️ 문제 이미지
> 
> 이미지를 여기에 붙여넣으세요

---

## 💡 힌트

> [!hint]- 💡 힌트 보기
> 
> 힌트 내용

---

## ✅ 정답 및 풀이

> [!success]- 🔍 정답 보기
> 
> **정답:** 
> 
> **풀이:**

---

## 📝 메모

> [!note]- 📝 개인 메모
> 
> - 
> - 

---

## ✅ 간편 체크박스

**복습할 때마다 체크하세요 (자동으로 reviewCount 증가):**

- [ ] 1차 복습 🔄 
- [ ] 2차 복습 🔄 
- [ ] 3차 복습 🔄 
- [ ] 4차 복습 🔄 
- [ ] 5차 복습 🔄 
- [ ] 6차 복습 🔄 
- [ ] 7차 복습 🔄 
- [ ] 8차 복습 🔄 
- [ ] 9차 복습 🔄 
- [ ] 10차 복습 🔄 

---

## 📈 Frontmatter 예시

> [!example]- 📊 1회차 복습 후
> 
> \`\`\`yaml
> times: ["00:03:25"]
> understandings: [70]
> \`\`\`

> [!example]- 📊 3회차 복습 후
> 
> \`\`\`yaml
> times: ["00:03:25", "00:02:50", "00:02:10"]
> understandings: [50, 70, 80]
> \`\`\`
> 
> → 평균 이해도: 67% (자동 계산)

---

*체크박스 체크 + times/understandings 입력 = 자동 업데이트!*
`;
            
            await this.app.vault.create(filePath, content);
            
            const newFile = this.app.vault.getAbstractFileByPath(filePath);
            if (newFile) {
                const leaf = this.app.workspace.getLeaf(false);
                await leaf.openFile(newFile);
                
                const editor = leaf.view.editor;
                if (editor) {
                    const lineCount = editor.lineCount();
                    for (let i = 0; i < lineCount; i++) {
                        const line = editor.getLine(i);
                        if (line.startsWith(`# ${number}.`)) {
                            editor.setCursor({ line: i, ch: line.length });
                            editor.focus();
                            break;
                        }
                    }
                }
            }
            
            new Notice(`✅ '${title}' 문제가 ${subject} 폴더에 생성되었습니다.`);
            
            setTimeout(() => {
                this.refreshDashboard();
            }, 300);
            
            return true;
            
        } catch (error) {
            console.error('문제 파일 생성 오류:', error);
            new Notice(`❌ 문제 생성 중 오류가 발생했습니다: ${error.message}`);
            return false;
        }
    }

    async createBulkProblems(subject, startNumber, endNumber) {
        let created = 0;
        let skipped = 0;
        const total = endNumber - startNumber + 1;
        
        for (let i = startNumber; i <= endNumber; i++) {
            try {
                const result = await this.createProblem(subject, i, `문제 ${i}`, 3);
                if (result) {
                    created++;
                } else {
                    skipped++;
                }
                await new Promise(resolve => setTimeout(resolve, 50));
            } catch (error) {
                console.error(`문제 ${i} 생성 실패:`, error);
                skipped++;
            }
        }
        
        new Notice(`✅ ${created}개 생성, ${skipped}개 건너뜀 (총 ${total}개 중)`);
        this.refreshDashboard();
    }

    refreshDashboard() {
        const dashboardView = this.app.workspace.getLeavesOfType(VIEW_TYPE_STUDY_DASHBOARD)[0];
        if (dashboardView?.view?.refresh) {
            dashboardView.view.refresh();
        }
    }

    async openProblemFile(subject, number) {
        try {
            const subjectFolder = normalizePath(`${this.settings.problemsFolder}/${subject}`);
            const folderFiles = this.app.vault.getAbstractFileByPath(subjectFolder);
            
            if (!folderFiles) {
                new Notice(`❌ ${subject} 폴더를 찾을 수 없습니다.`);
                return;
            }

            const files = this.app.vault.getMarkdownFiles()
                .filter(file => file.path.startsWith(subjectFolder));
            
            const targetFile = files.find(file => {
                const match = file.basename.match(/^(\d+)_/);
                return match && parseInt(match[1]) === number;
            });

            if (targetFile) {
                const leaf = this.app.workspace.getLeaf(false);
                await leaf.openFile(targetFile);
                new Notice(`📖 문제 ${number}번 열기`);
            } else {
                new Notice(`❌ 문제 ${number}번 파일을 찾을 수 없습니다.`);
            }
        } catch (error) {
            console.error('파일 열기 오류:', error);
            new Notice(`❌ 파일을 여는 중 오류가 발생했습니다: ${error.message}`);
        }
    }


addStyles() {
        const css = `
        .study-dashboard-container {
            padding: 20px;
            background: var(--background-primary);
            color: var(--text-normal);
            height: 100%;
            overflow-y: auto;
        }
        
        .dashboard-header {
            text-align: center;
            margin-bottom: 30px;
            padding: 20px;
            background: linear-gradient(135deg, var(--interactive-accent) 0%, var(--interactive-accent-hover) 100%);
            border-radius: 15px;
            color: white;
        }
        
        .dashboard-title {
            font-size: 2.5rem;
            font-weight: bold;
            margin: 0;
        }
        
        .dashboard-subtitle {
            font-size: 1.2rem;
            opacity: 0.9;
            margin: 10px 0 0 0;
        }

        .max-problems-selector {
            display: flex;
            gap: 10px;
            justify-content: center;
            margin: 15px 0;
        }

        .max-problem-btn {
            padding: 8px 20px;
            border: 2px solid rgba(255,255,255,0.3);
            border-radius: 20px;
            background: rgba(255,255,255,0.1);
            color: white;
            cursor: pointer;
            transition: all 0.3s ease;
            font-weight: bold;
        }

        .max-problem-btn:hover {
            background: rgba(255,255,255,0.2);
            transform: translateY(-2px);
        }

        .max-problem-btn.active {
            background: rgba(255,255,255,0.9);
            color: var(--interactive-accent);
            border-color: white;
        }
        
        .timer-section {
            background: var(--background-secondary);
            padding: 25px;
            border-radius: 15px;
            margin-bottom: 30px;
            text-align: center;
            border: 2px solid var(--background-modifier-border);
        }
        
        .timer-display {
            font-size: 3rem;
            font-weight: bold;
            font-family: 'Courier New', monospace;
            color: var(--interactive-accent);
            margin: 20px 0;
        }
        
        .timer-controls {
            display: flex;
            gap: 15px;
            justify-content: center;
            margin-top: 20px;
        }
        
        .timer-btn {
            padding: 12px 25px;
            border: none;
            border-radius: 25px;
            font-size: 1rem;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.3s ease;
            color: white;
        }
        
        .timer-btn.start {
            background: #10b981;
        }
        
        .timer-btn.stop {
            background: #ef4444;
        }
        
        .timer-btn.reset {
            background: #6b7280;
        }
        
        .timer-btn:hover {
            transform: translateY(-2px);
        }
        
        .subject-tabs {
            display: flex;
            gap: 10px;
            margin-bottom: 25px;
            justify-content: center;
            flex-wrap: wrap;
        }
        
        .subject-tab {
            padding: 10px 20px;
            border: 2px solid var(--background-modifier-border);
            border-radius: 25px;
            background: var(--background-secondary);
            color: var(--text-normal);
            cursor: pointer;
            transition: all 0.3s ease;
        }
        
        .subject-tab.active {
            background: var(--interactive-accent);
            color: white;
            border-color: var(--interactive-accent);
        }
        
        .subject-tab:hover {
            background: var(--interactive-accent-hover);
            color: white;
        }
        
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .stat-card {
            background: var(--background-secondary);
            padding: 20px;
            border-radius: 15px;
            text-align: center;
            border: 2px solid var(--background-modifier-border);
        }
        
        .stat-value {
            font-size: 2.5rem;
            font-weight: bold;
            color: var(--interactive-accent);
            margin-bottom: 10px;
        }
        
        .stat-label {
            font-size: 1rem;
            color: var(--text-muted);
        }

        .action-buttons {
            display: flex;
            gap: 15px;
            justify-content: center;
            margin: 20px 0;
            flex-wrap: wrap;
            align-items: center;
        }
        
        .action-btn {
            padding: 12px 25px;
            border: none;
            border-radius: 25px;
            background: var(--interactive-accent);
            color: white;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.3s ease;
        }
        
        .action-btn:hover {
            background: var(--interactive-accent-hover);
            transform: translateY(-2px);
        }
        
        .problems-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(50px, 1fr));
            gap: 8px;
            margin: 20px 0;
        }
        
        .problem-cell {
            width: 50px;
            height: 50px;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.3s ease;
            font-size: 0.9rem;
            color: white;
            position: relative;
        }
        
        .problem-cell:hover {
            transform: scale(1.1);
            box-shadow: 0 4px 8px rgba(0,0,0,0.3);
        }
        
        .problem-cell.empty {
            background: var(--background-modifier-border);
            color: var(--text-muted);
        }

        .problem-cell.grade-S {
            background: #800080;
            box-shadow: 0 0 10px rgba(128, 0, 128, 0.5);
        }

        .problem-cell.grade-A {
            background: #FFD700;
            color: #000;
            box-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
        }

        .problem-cell.grade-B {
            background: #B22222;
        }

        .problem-cell.grade-C {
            background: #708090;
        }

        .problem-cell.grade-D {
            background: #654321;
        }

        .problem-cell.grade-E {
            background: #2F4F4F;
        }

        .grade-badge {
            position: absolute;
            top: 2px;
            right: 2px;
            font-size: 10px;
            opacity: 0.8;
        }
        
        .progress-bar {
            width: 100%;
            height: 10px;
            background: var(--background-modifier-border);
            border-radius: 5px;
            overflow: hidden;
            margin: 10px 0;
        }
        
        .progress-fill {
            height: 100%;
            background: var(--interactive-accent);
            transition: width 0.5s ease;
        }
        `;
        
        const style = document.createElement('style');
        style.textContent = css;
        document.head.appendChild(style);
    }
}
// 대시보드 뷰 클래스
class StudyDashboardView extends ItemView {
    constructor(leaf, plugin) {
        super(leaf);
        this.plugin = plugin;
        this.currentSubject = this.plugin.settings.defaultSubject;
        this.maxProblems = this.plugin.settings.maxProblems;
        this.displayCount = 100;
    }
    
    getViewType() { 
        return VIEW_TYPE_STUDY_DASHBOARD; 
    }
    
    getDisplayText() { 
        return '📚 Study Dashboard'; 
    }
    
    getIcon() { 
        return 'graduation-cap'; 
    }
    
    async onOpen() {
        const container = this.containerEl.children[1];
        container.empty();
        container.addClass('study-dashboard-container');
        await this.renderDashboard(container);
    }
    
    async renderDashboard(container) {
        container.empty();
        
        this.renderHeader(container);
        this.renderTimerSection(container);
        this.renderSubjectTabs(container);
        await this.renderStats(container);
        this.renderActionButtons(container);
        await this.renderProblemsGrid(container);
    }
    
    renderHeader(container) {
        const header = container.createDiv('dashboard-header');
        header.createEl('h1', { 
            cls: 'dashboard-title',
            text: '📚 Study Dashboard' 
        });
        header.createEl('p', { 
            cls: 'dashboard-subtitle',
            text: `${this.currentSubject} 과목 - ${this.maxProblems}문제 시스템` 
        });

        const selectorDiv = header.createDiv('max-problems-selector');
        
        [100, 200, 500].forEach(num => {
            const btn = selectorDiv.createEl('button', {
                cls: 'max-problem-btn' + (num === this.maxProblems ? ' active' : ''),
                text: `${num}문제`
            });
            
            btn.addEventListener('click', async () => {
                this.maxProblems = num;
                this.plugin.settings.maxProblems = num;
                await this.plugin.saveSettings();
                
                if (this.displayCount > num) {
                    this.displayCount = 100;
                }
                
                this.renderDashboard(container);
            });
        });
    }
    
    renderTimerSection(container) {
        const timerSection = container.createDiv('timer-section');
        timerSection.createEl('h2', { text: '⏱️ 공부 타이머' });
        
        const timerDisplay = timerSection.createDiv('timer-display');
        timerDisplay.textContent = formatTime(this.plugin.timerState.seconds);
        
        const controls = timerSection.createDiv('timer-controls');
        
        const startBtn = controls.createEl('button', {
            cls: 'timer-btn start',
            text: '▶️ 시작'
        });
        startBtn.addEventListener('click', () => {
            this.plugin.startTimer();
        });
        
        const stopBtn = controls.createEl('button', {
            cls: 'timer-btn stop',
            text: '⏹️ 정지'
        });
        stopBtn.addEventListener('click', () => {
            this.plugin.stopTimer();
        });
        
        const resetBtn = controls.createEl('button', {
            cls: 'timer-btn reset',
            text: '🔄 초기화'
        });
        resetBtn.addEventListener('click', () => {
            this.plugin.resetTimer();
        });
    }
    
    renderSubjectTabs(container) {
        const tabs = container.createDiv('subject-tabs');
        
        this.plugin.settings.subjects.forEach(subject => {
            const tab = tabs.createEl('button', {
                cls: 'subject-tab' + (subject === this.currentSubject ? ' active' : ''),
                text: subject
            });
            
            tab.addEventListener('click', () => {
                this.currentSubject = subject;
                this.renderDashboard(container);
            });
        });
    }
    
    async renderStats(container) {
        const statsGrid = container.createDiv('stats-grid');
        
        const problemsData = await this.loadProblemsData();
        const total = Object.keys(problemsData).length;
        const gradeStats = this.calculateGradeStats(problemsData);
        
        const completed = gradeStats.S + gradeStats.A + gradeStats.B;
        const reviewing = gradeStats.C + gradeStats.D;
        const learning = gradeStats.E;
        const progressPercent = total > 0 ? ((completed / total) * 100).toFixed(1) : 0;
        
        const stats = [
            { label: '총 문제', value: total.toString(), color: '#3b82f6' },
            { label: '완료 (S/A/B)', value: completed.toString(), color: '#10b981' },
            { label: '복습중 (C/D)', value: reviewing.toString(), color: '#f59e0b' },
            { label: '학습중 (E)', value: learning.toString(), color: '#ef4444' },
            { label: '진행률', value: `${progressPercent}%`, color: '#8b5cf6' },
            { label: '오늘 목표', value: '5/5', color: '#06b6d4' }
        ];
        
        stats.forEach(stat => {
            const card = statsGrid.createDiv('stat-card');
            const value = card.createDiv('stat-value');
            value.textContent = stat.value;
            value.style.color = stat.color;
            card.createDiv('stat-label').textContent = stat.label;
        });
    }

    renderActionButtons(container) {
        const actions = container.createDiv('action-buttons');
        
        const rangeSelectWrapper = actions.createDiv();
        rangeSelectWrapper.style.cssText = 'display: flex; align-items: center; gap: 10px;';
        
        const rangeLabel = rangeSelectWrapper.createEl('label', {
            text: '📊 표시:',
            attr: { style: 'font-weight: bold; color: var(--text-normal);' }
        });
        
        const rangeSelect = rangeSelectWrapper.createEl('select');
        rangeSelect.style.cssText = 'padding: 8px 15px; border-radius: 20px; border: 2px solid var(--interactive-accent); background: var(--background-primary); color: var(--text-normal); font-weight: bold; cursor: pointer;';
        
        [100, 200, 300, 400, 500].forEach(num => {
            if (num <= this.maxProblems) {
                const option = rangeSelect.createEl('option', {
                    value: num.toString(),
                    text: `${num}문제`
                });
                
                if (num === this.displayCount) {
                    option.selected = true;
                }
            }
        });
        
        rangeSelect.addEventListener('change', () => {
            this.displayCount = parseInt(rangeSelect.value);
            this.renderDashboard(container);
        });
        
        const newProblemBtn = actions.createEl('button', {
            cls: 'action-btn',
            text: '➕ 새 문제 생성'
        });
        newProblemBtn.addEventListener('click', () => {
            new ProblemCreationModal(this.app, this.plugin, this.currentSubject).open();
        });
        
        const bulkCreateBtn = actions.createEl('button', {
            cls: 'action-btn',
            text: '📝 일괄 생성'
        });
        bulkCreateBtn.addEventListener('click', () => {
            new BulkCreationModal(this.app, this.plugin, this.currentSubject).open();
        });
        
        const refreshBtn = actions.createEl('button', {
            cls: 'action-btn',
            text: '🔄 새로고침'
        });
        refreshBtn.addEventListener('click', () => {
            this.renderDashboard(container);
        });
    }
async renderProblemsGrid(container) {
        const section = container.createDiv();
        section.createEl('h3', { 
            text: `📝 ${this.currentSubject} 문제 1-${this.displayCount}번 (전체 ${this.maxProblems}문제)` 
        });
        
        const problemsData = await this.loadProblemsData();
        
        const progressContainer = section.createDiv();
        const completed = Object.keys(problemsData).length;
        const percentage = ((completed / this.maxProblems) * 100).toFixed(1);
        progressContainer.createEl('p', { text: `전체 진행률: ${completed}/${this.maxProblems} 문제 (${percentage}%)` });
        const progressBar = progressContainer.createDiv('progress-bar');
        const progressFill = progressBar.createDiv('progress-fill');
        progressFill.style.width = `${percentage}%`;
        
        const gradeStats = this.calculateGradeStats(problemsData);
        const statsText = section.createDiv();
        statsText.style.cssText = 'text-align: center; margin: 15px 0; font-size: 0.95rem;';
        statsText.innerHTML = `
            👑 S급: ${gradeStats.S}개 | 
            ⭐ A급: ${gradeStats.A}개 | 
            🔥 B급: ${gradeStats.B}개 | 
            📚 C급: ${gradeStats.C}개 | 
            📖 D급: ${gradeStats.D}개 | 
            ❌ E급: ${gradeStats.E}개
        `;
        
        const grid = section.createDiv('problems-grid');
        
        for (let i = 1; i <= this.displayCount; i++) {
            const cell = grid.createDiv('problem-cell');
            const problemData = problemsData[i];
            
            if (problemData) {
                const grade = getReviewGrade(problemData.reviewCount || 0, problemData.understanding || 0);
                cell.addClass(`grade-${grade}`);
                cell.textContent = i;
                
                const badge = cell.createSpan('grade-badge');
                badge.textContent = REVIEW_GRADES[grade].emoji;
                
                cell.setAttribute('title', 
                    `${i}번 문제\n` +
                    `등급: ${REVIEW_GRADES[grade].name} (${grade}급)\n` +
                    `복습: ${problemData.reviewCount || 0}회\n` +
                    `이해도: ${problemData.understanding || 0}/100`
                );
            } else {
                cell.addClass('empty');
                cell.textContent = i;
                cell.setAttribute('title', `${i}번 문제 (미생성)`);
            }
            
            cell.addEventListener('click', async () => {
                if (cell.hasClass('empty')) {
                    new ProblemCreationModal(this.app, this.plugin, this.currentSubject, i).open();
                } else {
                    await this.plugin.openProblemFile(this.currentSubject, i);
                }
            });
        }
    }

    async loadProblemsData() {
        const problemsData = {};
        
        try {
            const subjectFolder = normalizePath(`${this.plugin.settings.problemsFolder}/${this.currentSubject}`);
            const folderFiles = this.app.vault.getAbstractFileByPath(subjectFolder);
            
            if (!folderFiles) {
                return problemsData;
            }

            const files = this.app.vault.getMarkdownFiles()
                .filter(file => file.path.startsWith(subjectFolder));
            
            for (const file of files) {
                try {
                    const content = await this.app.vault.read(file);
                    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
                    
                    if (frontmatterMatch) {
                        const frontmatter = frontmatterMatch[1];
                        const numberMatch = frontmatter.match(/number:\s*(\d+)/);
                        const reviewMatch = frontmatter.match(/reviewCount:\s*(\d+)/);
                        const understandingMatch = frontmatter.match(/understanding:\s*(\d+)/);
                        
                        if (numberMatch) {
                            const number = parseInt(numberMatch[1]);
                            
                            const reviewCheckMatches = content.match(/- \[x\] \d+차 복습/gi);
                            const reviewCount = reviewCheckMatches ? reviewCheckMatches.length : 
                                              (reviewMatch ? parseInt(reviewMatch[1]) : 0);
                            
                            problemsData[number] = {
                                reviewCount: reviewCount,
                                understanding: understandingMatch ? parseInt(understandingMatch[1]) : 0,
                                file: file
                            };
                        }
                    }
                } catch (error) {
                    console.error(`파일 읽기 오류: ${file.path}`, error);
                }
            }
        } catch (error) {
            console.error('문제 데이터 로드 오류:', error);
        }
        
        return problemsData;
    }

    calculateGradeStats(problemsData) {
        const stats = { S: 0, A: 0, B: 0, C: 0, D: 0, E: 0 };
        
        for (const [num, data] of Object.entries(problemsData)) {
            const grade = getReviewGrade(data.reviewCount || 0, data.understanding || 0);
            stats[grade]++;
        }
        
        return stats;
    }
    
    refresh() {
        const container = this.containerEl.children[1];
        this.renderDashboard(container);
    }
}
// 문제 생성 모달
class ProblemCreationModal extends Modal {
    constructor(app, plugin, subject = null, number = null) {
        super(app);
        this.plugin = plugin;
        this.subject = subject || plugin.settings.defaultSubject;
        this.number = number;
    }
    
    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        contentEl.createEl('h2', { text: '➕ 새 문제 생성' });
        
        const subjectDiv = contentEl.createDiv();
        subjectDiv.createEl('label', { text: '과목:' });
        const subjectSelect = subjectDiv.createEl('select');
        this.plugin.settings.subjects.forEach(subject => {
            const option = subjectSelect.createEl('option', { 
                value: subject, 
                text: subject 
            });
            if (subject === this.subject) {
                option.selected = true;
            }
        });
        
        const numberDiv = contentEl.createDiv();
        numberDiv.createEl('label', { text: '문제 번호:' });
        const numberInput = numberDiv.createEl('input', { 
            type: 'number',
            value: this.number?.toString() || '1',
            attr: { min: '1', max: this.plugin.settings.maxProblems.toString() }
        });
        
        const titleDiv = contentEl.createDiv();
        titleDiv.createEl('label', { text: '문제 제목:' });
        const titleInput = titleDiv.createEl('input', { 
            type: 'text',
            placeholder: '문제 제목을 입력하세요...'
        });
        
        // 포커스를 제목 입력란에 자동으로
        setTimeout(() => titleInput.focus(), 100);
        
        const difficultyDiv = contentEl.createDiv();
        difficultyDiv.createEl('label', { text: '난이도 (1-5):' });
        const difficultyInput = difficultyDiv.createEl('input', { 
            type: 'number',
            value: '3',
            attr: { min: '1', max: '5' }
        });
        
        const buttonDiv = contentEl.createDiv();
        buttonDiv.style.marginTop = '20px';
        buttonDiv.style.textAlign = 'center';
        
        const createBtn = buttonDiv.createEl('button', { 
            text: '✅ 생성',
            cls: 'mod-cta'
        });
        createBtn.addEventListener('click', async () => {
            const subject = subjectSelect.value;
            const number = parseInt(numberInput.value);
            const title = titleInput.value || `문제 ${number}`;
            const difficulty = parseInt(difficultyInput.value);
            
            await this.plugin.createProblem(subject, number, title, difficulty);
            this.close();
        });
        
        // Enter 키로 생성
        titleInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                createBtn.click();
            }
        });
        
        const cancelBtn = buttonDiv.createEl('button', { text: '❌ 취소' });
        cancelBtn.addEventListener('click', () => this.close());
    }
}

// 일괄 생성 모달
class BulkCreationModal extends Modal {
    constructor(app, plugin, subject) {
        super(app);
        this.plugin = plugin;
        this.subject = subject || plugin.settings.defaultSubject;
    }
    
    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        contentEl.createEl('h2', { text: '📝 문제 일괄 생성' });
        
        const subjectDiv = contentEl.createDiv();
        subjectDiv.createEl('label', { text: '과목:' });
        const subjectSelect = subjectDiv.createEl('select');
        this.plugin.settings.subjects.forEach(subject => {
            const option = subjectSelect.createEl('option', { 
                value: subject, 
                text: subject 
            });
            if (subject === this.subject) {
                option.selected = true;
            }
        });
        
        const startDiv = contentEl.createDiv();
        startDiv.createEl('label', { text: '시작 번호:' });
        const startInput = startDiv.createEl('input', { 
            type: 'number',
            value: '1',
            attr: { min: '1' }
        });
        
        const endDiv = contentEl.createDiv();
        endDiv.createEl('label', { text: '끝 번호:' });
        const endInput = endDiv.createEl('input', { 
            type: 'number',
            value: '50',
            attr: { min: '1', max: this.plugin.settings.maxProblems.toString() }
        });
        
        const buttonDiv = contentEl.createDiv();
        buttonDiv.style.marginTop = '20px';
        buttonDiv.style.textAlign = 'center';
        
        const createBtn = buttonDiv.createEl('button', { 
            text: '✅ 일괄 생성',
            cls: 'mod-cta'
        });
        createBtn.addEventListener('click', async () => {
            const subject = subjectSelect.value;
            const start = parseInt(startInput.value);
            const end = parseInt(endInput.value);
            
            if (start > end) {
                new Notice('❌ 시작 번호가 끝 번호보다 클 수 없습니다.');
                return;
            }
            
            await this.plugin.createBulkProblems(subject, start, end);
            this.close();
        });
        
        const cancelBtn = buttonDiv.createEl('button', { text: '❌ 취소' });
        cancelBtn.addEventListener('click', () => this.close());
    }
}
// 설정 탭
class StudyDashboardSettingTab extends PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        const { containerEl } = this;
        containerEl.empty();
        
        containerEl.createEl('h2', { text: '📚 Study Dashboard 설정' });
        
        containerEl.createEl('h3', { text: '📁 과목 관리' });
        
        const subjectsContainer = containerEl.createDiv();
        subjectsContainer.style.cssText = 'margin: 20px 0; padding: 15px; background: var(--background-secondary); border-radius: 10px;';
        
        this.renderSubjectsList(subjectsContainer);
        
        const addSubjectDiv = containerEl.createDiv();
        addSubjectDiv.style.cssText = 'margin: 20px 0; display: flex; gap: 10px; align-items: center;';
        
        const newSubjectInput = addSubjectDiv.createEl('input', {
            type: 'text',
            placeholder: '새 과목명 입력...',
            attr: { style: 'flex: 1; padding: 8px; border-radius: 5px; border: 2px solid var(--interactive-accent);' }
        });
        
        const addBtn = addSubjectDiv.createEl('button', {
            text: '➕ 과목 추가',
            cls: 'mod-cta'
        });
        
        addBtn.addEventListener('click', async () => {
            const newSubject = newSubjectInput.value.trim();
            if (!newSubject) {
                new Notice('❌ 과목명을 입력해주세요.');
                return;
            }
            
            if (this.plugin.settings.subjects.includes(newSubject)) {
                new Notice('❌ 이미 존재하는 과목입니다.');
                return;
            }
            
            this.plugin.settings.subjects.push(newSubject);
            await this.plugin.saveSettings();
            
            const subjectFolder = normalizePath(`${this.plugin.settings.problemsFolder}/${newSubject}`);
            try {
                await this.app.vault.createFolder(subjectFolder);
                new Notice(`✅ '${newSubject}' 과목이 추가되었습니다.`);
            } catch (error) {
                new Notice(`✅ '${newSubject}' 과목이 추가되었습니다. (폴더는 이미 존재함)`);
            }
            
            newSubjectInput.value = '';
            this.renderSubjectsList(subjectsContainer);
            this.plugin.refreshDashboard();
        });
        
        containerEl.createEl('hr');
        
        containerEl.createEl('h3', { text: '⚙️ 기본 설정' });
        
        new Setting(containerEl)
            .setName('문제 폴더')
            .setDesc('문제 파일들이 저장될 폴더 경로')
            .addText(text => text
                .setPlaceholder('학습관리/문제은행')
                .setValue(this.plugin.settings.problemsFolder)
                .onChange(async (value) => {
                    this.plugin.settings.problemsFolder = value;
                    await this.plugin.saveSettings();
                }));
        
        new Setting(containerEl)
            .setName('최대 문제 수')
            .setDesc('생성할 수 있는 최대 문제 개수')
            .addDropdown(dropdown => dropdown
                .addOption('100', '100문제')
                .addOption('200', '200문제')
                .addOption('500', '500문제')
                .setValue(this.plugin.settings.maxProblems.toString())
                .onChange(async (value) => {
                    this.plugin.settings.maxProblems = parseInt(value);
                    await this.plugin.saveSettings();
                }));
        
        new Setting(containerEl)
            .setName('일일 학습 목표')
            .setDesc('하루에 풀어야 할 문제 수')
            .addText(text => text
                .setPlaceholder('5')
                .setValue(this.plugin.settings.dailyGoal.toString())
                .onChange(async (value) => {
                    this.plugin.settings.dailyGoal = parseInt(value) || 5;
                    await this.plugin.saveSettings();
                }));
        
        new Setting(containerEl)
            .setName('기본 과목')
            .setDesc('대시보드를 열 때 기본으로 선택될 과목')
            .addDropdown(dropdown => {
                this.plugin.settings.subjects.forEach(subject => {
                    dropdown.addOption(subject, subject);
                });
                dropdown.setValue(this.plugin.settings.defaultSubject);
                dropdown.onChange(async (value) => {
                    this.plugin.settings.defaultSubject = value;
                    await this.plugin.saveSettings();
                });
            });
        
        new Setting(containerEl)
            .setName('타이머 기능')
            .setDesc('대시보드에 타이머 기능을 표시합니다')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.timerEnabled)
                .onChange(async (value) => {
                    this.plugin.settings.timerEnabled = value;
                    await this.plugin.saveSettings();
                }));
    }

    renderSubjectsList(container) {
        container.empty();
        container.createEl('p', { 
            text: '현재 과목 목록:',
            attr: { style: 'font-weight: bold; margin-bottom: 10px;' }
        });
        
        const listDiv = container.createDiv();
        listDiv.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';
        
        this.plugin.settings.subjects.forEach(subject => {
            const itemDiv = listDiv.createDiv();
            itemDiv.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: var(--background-primary); border-radius: 8px;';
            
            const nameSpan = itemDiv.createEl('span', {
                text: `📚 ${subject}`,
                attr: { style: 'font-weight: 500;' }
            });
            
            const deleteBtn = itemDiv.createEl('button', {
                text: '🗑️ 삭제',
                attr: { style: 'padding: 4px 12px; background: #ef4444; color: white; border: none; border-radius: 5px; cursor: pointer;' }
            });
            
            deleteBtn.addEventListener('click', async () => {
                if (this.plugin.settings.subjects.length <= 1) {
                    new Notice('❌ 최소 1개의 과목은 있어야 합니다.');
                    return;
                }
                
                const confirmDelete = confirm(`'${subject}' 과목을 삭제하시겠습니까?\n\n⚠️ 주의: 폴더와 파일은 삭제되지 않습니다. 대시보드에서만 제거됩니다.`);
                
                if (confirmDelete) {
                    this.plugin.settings.subjects = this.plugin.settings.subjects.filter(s => s !== subject);
                    
                    if (this.plugin.settings.defaultSubject === subject) {
                        this.plugin.settings.defaultSubject = this.plugin.settings.subjects[0];
                    }
                    
                    await this.plugin.saveSettings();
                    new Notice(`✅ '${subject}' 과목이 제거되었습니다.`);
                    this.renderSubjectsList(container);
                    this.plugin.refreshDashboard();
                }
            });
        });
    }
}

// 플러그인 export
module.exports = StudyDashboardPlugin;