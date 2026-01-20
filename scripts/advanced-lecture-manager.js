// 고급 강의 진행률 자동 관리 시스템
// 완료율이 임계점을 넘으면 자동으로 전체 강의 완료 처리

class AdvancedLectureProgressManager {
    constructor(app) {
        this.app = app;
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // 파일 수정 감지
        this.app.vault.on('modify', this.handleFileModify.bind(this));
        
        // 체크박스 클릭 감지
        this.setupMutationObserver();
    }
    
    setupMutationObserver() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && 
                    mutation.attributeName === 'data-task' &&
                    mutation.target.classList.contains('task-list-item-checkbox')) {
                    
                    setTimeout(() => {
                        const activeFile = this.app.workspace.getActiveFile();
                        if (activeFile && this.isLectureFile(activeFile)) {
                            this.updateAdvancedProgress(activeFile);
                        }
                    }, 200);
                }
            });
        });
        
        observer.observe(document.body, {
            attributes: true,
            subtree: true,
            attributeFilter: ['data-task']
        });
    }
    
    isLectureFile(file) {
        if (!file || file.extension !== 'md') return false;
        return file.path.includes('강의학습') && !file.path.includes('Templates');
    }
    
    async handleFileModify(file) {
        if (!this.isLectureFile(file)) return;
        
        const content = await this.app.vault.read(file);
        if (content.includes('**학습 완료** ✅ #강의학습')) {
            await this.updateAdvancedProgress(file);
        }
    }
    
    async updateAdvancedProgress(file) {
        try {
            const content = await this.app.vault.read(file);
            
            // 강의 학습 체크박스만 카운트
            const lectureCompletionRegex = /- \[x\] \*\*학습 완료\*\* ✅ #강의학습/g;
            const allLectureTasksRegex = /- \[.\] \*\*학습 완료\*\* ✅ #강의학습/g;
            
            const completedTasks = (content.match(lectureCompletionRegex) || []).length;
            const totalTasks = (content.match(allLectureTasksRegex) || []).length;
            
            if (totalTasks === 0) return;
            
            // 진행률 계산
            const progressPercentage = Math.round((completedTasks / totalTasks) * 100);
            
            // Properties 읽기
            const cache = this.app.metadataCache.getFileCache(file);
            const frontmatter = cache?.frontmatter || {};
            
            // 완료 임계점 확인
            const threshold = frontmatter["completion-threshold"] || 80;
            const autoCompleteEnabled = frontmatter["auto-complete-enabled"] !== false;
            
            // 이전 상태 확인
            const oldCompletedSegments = frontmatter["completed-segments"] || 0;
            const oldStatus = frontmatter["status"] || "미시작";
            
            // 새로운 상태 계산
            let newStatus = "미시작";
            if (progressPercentage >= threshold) {
                newStatus = "완료";
            } else if (completedTasks > 0) {
                newStatus = "진행중";
            }
            
            // 자동 완료 처리 여부 확인
            const shouldAutoComplete = autoCompleteEnabled && progressPercentage >= threshold;
            
            // Properties 업데이트
            await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
                frontmatter["completed-segments"] = completedTasks;
                frontmatter["status"] = newStatus;
                
                // 시작 시간 기록
                if (completedTasks > 0 && !frontmatter["study-start-time"]) {
                    const now = new Date();
                    frontmatter["study-start-time"] = now.toTimeString().slice(0, 5);
                }
                
                // 자동 완료 처리
                if (shouldAutoComplete && oldStatus !== "완료") {
                    const now = new Date();
                    frontmatter["study-end-time"] = now.toTimeString().slice(0, 5);
                    
                    // 자동 완료 로그
                    console.log(`자동 완료 처리: ${file.name} (${progressPercentage}% >= ${threshold}%)`);
                }
            });
            
            // 알림 표시
            this.showProgressNotification(
                completedTasks, 
                totalTasks, 
                progressPercentage, 
                newStatus, 
                shouldAutoComplete,
                threshold,
                oldCompletedSegments !== completedTasks
            );
            
            // 시리즈 진행률 업데이트
            if (shouldAutoComplete) {
                await this.updateSeriesProgress(file);
            }
            
        } catch (error) {
            console.error('고급 진행률 업데이트 오류:', error);
        }
    }
    
    showProgressNotification(completed, total, percentage, status, autoCompleted, threshold, hasChanged) {
        if (!hasChanged) return;
        
        if (autoCompleted) {
            new Notice(`🎉 자동 완료! ${percentage}% 달성으로 강의가 완료 처리되었습니다!`);
        } else if (status === "완료") {
            new Notice(`✅ 강의 완료! ${completed}/${total} 구간 (${percentage}%)`);
        } else if (percentage >= threshold - 10) { // 임계점 10% 전 경고
            const remaining = threshold - percentage;
            new Notice(`🔥 완료 임박! ${remaining}% 더 하면 자동 완료됩니다! (${percentage}%)`);
        } else {
            new Notice(`📚 진행률 업데이트: ${completed}/${total} 구간 (${percentage}%)`);
        }
    }
    
    async updateSeriesProgress(file) {
        try {
            // 같은 시리즈의 다른 강의들 찾기
            const cache = this.app.metadataCache.getFileCache(file);
            const frontmatter = cache?.frontmatter || {};
            const seriesName = frontmatter["lecture-series"];
            
            if (!seriesName) return;
            
            // 시리즈 전체 진행률 계산 및 알림
            const allFiles = this.app.vault.getMarkdownFiles();
            const seriesFiles = allFiles.filter(f => {
                const fCache = this.app.metadataCache.getFileCache(f);
                const fFrontmatter = fCache?.frontmatter || {};
                return fFrontmatter["lecture-series"] === seriesName && f.path.includes('강의학습');
            });
            
            let completedLectures = 0;
            for (const seriesFile of seriesFiles) {
                const sFCache = this.app.metadataCache.getFileCache(seriesFile);
                const sFrontmatter = sFCache?.frontmatter || {};
                if (sFrontmatter.status === "완료") {
                    completedLectures++;
                }
            }
            
            const seriesProgress = Math.round((completedLectures / seriesFiles.length) * 100);
            
            // 시리즈 완료 체크
            if (completedLectures === seriesFiles.length) {
                new Notice(`🏆 축하합니다! "${seriesName}" 시리즈가 100% 완료되었습니다!`);
            } else {
                new Notice(`📊 "${seriesName}" 시리즈 진행률: ${seriesProgress}% (${completedLectures}/${seriesFiles.length})`);
            }
            
        } catch (error) {
            console.error('시리즈 진행률 업데이트 오류:', error);
        }
    }
}

// 전역 인스턴스 생성
if (typeof window !== 'undefined') {
    if (!window.advancedLectureManager) {
        window.advancedLectureManager = new AdvancedLectureProgressManager(app);
        console.log('🚀 고급 강의 진행률 관리 시스템 활성화');
    }
}
