// 강의 학습 체크박스 자동 업데이트 시스템
// CustomJS로 실행되는 전역 스크립트

class LectureAutoUpdater {
    constructor() {
        this.isInitialized = false;
        this.init();
    }
    
    init() {
        if (this.isInitialized) return;
        
        // 페이지 로드 후 초기화
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
        
        this.isInitialized = true;
    }
    
    setup() {
        // 클릭 이벤트를 문서 레벨에서 감지 (이벤트 위임)
        document.addEventListener('click', (event) => {
            if (event.target.classList.contains('task-list-item-checkbox')) {
                this.handleCheckboxClick(event.target);
            }
        });
        
        // 파일 변경 감지
        app.workspace.on('active-leaf-change', () => {
            setTimeout(() => this.updateCurrentFile(), 100);
        });
        
        console.log('🔄 강의 자동 업데이트 시스템 활성화');
    }
    
    async handleCheckboxClick(checkbox) {
        // 약간의 지연 후 업데이트 (체크박스 상태 변경 완료 대기)
        setTimeout(async () => {
            const activeFile = app.workspace.getActiveFile();
            if (activeFile && this.isLectureFile(activeFile)) {
                await this.updateLectureProgress(activeFile);
            }
        }, 150);
    }
    
    isLectureFile(file) {
        if (!file || file.extension !== 'md') return false;
        return file.path.includes('강의학습') && !file.path.includes('Templates');
    }
    
    async updateCurrentFile() {
        const activeFile = app.workspace.getActiveFile();
        if (activeFile && this.isLectureFile(activeFile)) {
            await this.updateLectureProgress(activeFile);
        }
    }
    
    async updateLectureProgress(file) {
        try {
            const content = await app.vault.read(file);
            
            // 강의 학습 체크박스만 카운트
            const completedSegments = (content.match(/- \[x\] \*\*학습 완료\*\* ✅ #강의학습/g) || []).length;
            const totalSegments = (content.match(/- \[.\] \*\*학습 완료\*\* ✅ #강의학습/g) || []).length;
            
            if (totalSegments === 0) return;
            
            // 상태 계산
            let status = "미시작";
            if (completedSegments === totalSegments && totalSegments > 0) {
                status = "완료";
            } else if (completedSegments > 0) {
                status = "진행중";
            }
            
            // Properties 읽기
            const cache = app.metadataCache.getFileCache(file);
            const frontmatter = cache?.frontmatter || {};
            
            // 변경사항이 있는지 확인
            const oldCompleted = frontmatter["completed-segments"] || 0;
            const oldStatus = frontmatter["status"] || "미시작";
            
            if (oldCompleted === completedSegments && oldStatus === status) {
                return; // 변경사항 없음
            }
            
            // Properties 업데이트
            await app.fileManager.processFrontMatter(file, (frontmatter) => {
                frontmatter["completed-segments"] = completedSegments;
                frontmatter["status"] = status;
                
                // 시작 시간 기록 (첫 구간 완료 시)
                if (completedSegments > 0 && !frontmatter["study-start-time"]) {
                    const now = new Date();
                    frontmatter["study-start-time"] = now.toTimeString().slice(0, 5);
                }
                
                // 완료 시간 기록 (완료 시)
                if (status === "완료" && oldStatus !== "완료") {
                    const now = new Date();
                    frontmatter["study-end-time"] = now.toTimeString().slice(0, 5);
                }
            });
            
            // 알림 표시
            this.showNotification(completedSegments, totalSegments, status, oldCompleted !== completedSegments);
            
        } catch (error) {
            console.error('진행률 업데이트 오류:', error);
        }
    }
    
    showNotification(completed, total, status, hasChanged) {
        if (!hasChanged) return;
        
        const progressPercent = Math.round((completed / total) * 100);
        
        if (status === "완료") {
            new Notice(`🎉 축하합니다! 강의 완료! (${progressPercent}%)`);
        } else {
            new Notice(`📚 ${completed}/${total} 구간 완료 (${progressPercent}%)`);
        }
    }
}

// 전역 인스턴스 생성
if (typeof window !== 'undefined') {
    if (!window.lectureAutoUpdater) {
        window.lectureAutoUpdater = new LectureAutoUpdater();
    }
}
