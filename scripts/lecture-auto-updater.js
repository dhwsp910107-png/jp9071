// 강의 학습 자동 업데이트 시스템
// 이 스크립트는 체크박스 변경 시 자동으로 진행률을 업데이트합니다.

class LectureProgressUpdater {
    constructor(app) {
        this.app = app;
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // 파일 수정 감지
        this.app.vault.on('modify', this.handleFileModify.bind(this));
        
        // 체크박스 클릭 감지 (더 직접적인 방법)
        this.app.workspace.on('active-leaf-change', () => {
            this.setupCheckboxListeners();
        });
        
        // DOM 변경 감지
        this.setupMutationObserver();
    }
    
    setupMutationObserver() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && 
                    mutation.attributeName === 'data-task' &&
                    mutation.target.classList.contains('task-list-item-checkbox')) {
                    
                    // 약간의 지연을 두고 업데이트 (파일 저장이 완료된 후)
                    setTimeout(() => {
                        const activeFile = this.app.workspace.getActiveFile();
                        if (activeFile && this.isLectureFile(activeFile)) {
                            this.updateLectureProgress(activeFile);
                        }
                    }, 100);
                }
            });
        });
        
        observer.observe(document.body, {
            attributes: true,
            subtree: true,
            attributeFilter: ['data-task']
        });
    }
    
    setupCheckboxListeners() {
        const activeLeaf = this.app.workspace.activeLeaf;
        if (!activeLeaf || activeLeaf.view.getViewType() !== 'markdown') return;
        
        const contentEl = activeLeaf.view.contentEl;
        if (!contentEl) return;
        
        const checkboxes = contentEl.querySelectorAll('.task-list-item-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.removeEventListener('click', this.handleCheckboxClick.bind(this));
            checkbox.addEventListener('click', this.handleCheckboxClick.bind(this));
        });
    }
    
    handleCheckboxClick(event) {
        const activeFile = this.app.workspace.getActiveFile();
        if (activeFile && this.isLectureFile(activeFile)) {
            // 약간의 지연을 두고 업데이트
            setTimeout(() => {
                this.updateLectureProgress(activeFile);
            }, 200);
        }
    }
    
    async handleFileModify(file) {
        if (!this.isLectureFile(file)) return;
        
        // 체크박스 변경이 포함된 수정인지 확인
        const content = await this.app.vault.read(file);
        if (content.includes('**학습 완료** ✅ #강의학습')) {
            await this.updateLectureProgress(file);
        }
    }
    
    isLectureFile(file) {
        if (!file || file.extension !== 'md') return false;
        
        // 파일 경로나 이름으로 강의 파일인지 확인
        return file.path.includes('강의학습') || 
               file.name.includes('강의학습') ||
               file.path.includes('Templates') === false; // 템플릿 제외
    }
    
    async updateLectureProgress(file) {
        try {
            const content = await this.app.vault.read(file);
            
            // 완료된 구간 수 계산
            const completedSegments = (content.match(/- \[x\] \*\*학습 완료\*\* ✅ #강의학습/g) || []).length;
            const totalSegments = (content.match(/- \[.\] \*\*학습 완료\*\* ✅ #강의학습/g) || []).length;
            
            if (totalSegments === 0) return; // 강의 파일이 아님
            
            // 진행률 계산
            const progressPercent = Math.round((completedSegments / totalSegments) * 100);
            
            // 상태 결정
            let status = "미시작";
            if (completedSegments === totalSegments && totalSegments > 0) {
                status = "완료";
            } else if (completedSegments > 0) {
                status = "진행중";
            }
            
            // Properties 업데이트
            await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
                const oldCompletedSegments = frontmatter["completed-segments"] || 0;
                const oldStatus = frontmatter["status"] || "미시작";
                
                frontmatter["completed-segments"] = completedSegments;
                frontmatter["status"] = status;
                
                // 시작 시간 기록 (첫 구간 완료 시)
                if (completedSegments > 0 && !frontmatter["study-start-time"]) {
                    const now = new Date();
                    frontmatter["study-start-time"] = now.toTimeString().slice(0, 5);
                }
                
                // 완료 시간 기록 (마지막 구간 완료 시)
                if (status === "완료" && oldStatus !== "완료") {
                    const now = new Date();
                    frontmatter["study-end-time"] = now.toTimeString().slice(0, 5);
                }
                
                // 알림 표시 (상태가 변경된 경우만)
                if (oldCompletedSegments !== completedSegments) {
                    this.showProgressNotification(completedSegments, totalSegments, status);
                }
            });
            
        } catch (error) {
            console.error('강의 진행률 업데이트 오류:', error);
            new Notice('❌ 진행률 업데이트 중 오류가 발생했습니다.');
        }
    }
    
    showProgressNotification(completed, total, status) {
        const progressPercent = Math.round((completed / total) * 100);
        
        if (status === "완료") {
            new Notice(`🎉 축하합니다! 강의 학습이 완료되었습니다! (${progressPercent}%)`);
        } else {
            new Notice(`📚 진도 업데이트: ${completed}/${total} 구간 완료 (${progressPercent}%)`);
        }
        
        // 대시보드 새로고침 (열려있는 경우)
        this.refreshDashboard();
    }
    
    refreshDashboard() {
        const leaves = this.app.workspace.getLeavesOfType('markdown');
        leaves.forEach(leaf => {
            if (leaf.view.file && 
                (leaf.view.file.name.includes('대시보드') || 
                 leaf.view.file.name.includes('dashboard'))) {
                // 대시보드 새로고침
                leaf.view.previewMode?.rerender(true);
            }
        });
    }
}

// 플러그인 로드 시 자동 실행
if (typeof module !== 'undefined') {
    module.exports = LectureProgressUpdater;
} else {
    // 브라우저 환경에서 직접 실행
    new LectureProgressUpdater(app);
}
