    
    .card-series {
        font-size: 0.9rem;
        color: #3b82f6;
        margin-bottom: 8px;
    }
    
    .card-stats {
        display: flex;
        justify-content: space-between;
        font-size: 0.85rem;
        color: var(--text-muted);
        margin-top: 10px;
        padding-top: 10px;
        border-top: 1px solid var(--background-modifier-border);
    }
    
    .lecture-series-section {
        background: var(--background-secondary);
        border-radius: 15px;
        padding: 20px;
        margin-bottom: 20px;
    }
    
    .lecture-series-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 15px;
        padding-bottom: 10px;
        border-bottom: 2px solid var(--background-modifier-border);
    }
    
    .lecture-series-title {
        font-size: 1.3rem;
        font-weight: 700;
        color: #1e40af;
    }
    
    .lecture-series-progress {
        font-size: 0.9rem;
        color: var(--text-muted);
    }
    
    .lecture-series-progress-bar {
        background: var(--background-modifier-border);
        border-radius: 10px;
        height: 8px;
        overflow: hidden;
        margin-top: 5px;
    }
    
    .lecture-series-progress-fill {
        background: linear-gradient(90deg, #3b82f6, #2563eb);
        height: 100%;
        transition: width 0.5s ease;
    }
    
    .review-needed-section {
        background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
        border-radius: 15px;
        padding: 20px;
        margin-bottom: 20px;
    }
    
    .review-needed-header {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 15px;
    }
    
    .review-needed-title {
        font-size: 1.3rem;
        font-weight: 700;
        color: #92400e;
    }
    
    .review-needed-count {
        background: #f59e0b;
        color: white;
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 0.9rem;
        font-weight: bold;
    }
    
    .cloze-view-mode-tabs {
        display: flex;
        gap: 10px;
        margin-bottom: 20px;
        justify-content: center;
    }
    
    .cloze-view-mode-tab {
        padding: 10px 20px;
        background: var(--background-secondary);
        border: 2px solid var(--background-modifier-border);
        border-radius: 20px;
        cursor: pointer;
        transition: all 0.3s;
        font-weight: 600;
    }
    
    .cloze-view-mode-tab:hover {
        background: var(--background-modifier-hover);
    }
    
    .cloze-view-mode-tab.active {
        background: #3b82f6;
        color: white;
        border-color: #3b82f6;
    }
    
    .filter-section {
        display: flex;
        gap: 15px;
        margin-bottom: 20px;
        flex-wrap: wrap;
        align-items: center;
    }
    
    .filter-group {
        display: flex;
        align-items: center;
        gap: 8px;
    }
    
    .filter-group label {
        font-weight: 600;
        color: var(--text-normal);
    }
    
    .filter-select {
        padding: 8px 12px;
        border: 2px solid var(--background-modifier-border);
        border-radius: 8px;
        background: var(--background-secondary);
        color: var(--text-normal);
        min-width: 120px;
    }
`;

// StudyDashboardView에 추가할 메서드들
class ImageClozeDashboardMethods {
    constructor(view, plugin) {
        this.view = view;
        this.plugin = plugin;
        this.problems = [];
        this.currentFilter = {
            subject: 'all',
            lectureSeries: 'all',
            status: 'all',
            difficulty: 'all'
        };
        this.viewMode = 'grid'; // grid, list, lecture-series, review-needed
    }
    
    async loadProblems() {
        this.problems = await scanImageClozProblems(this.plugin.app, this.plugin.settings);
        console.log('이미지 Cloze 문제 로드됨:', this.problems.length);
    }
    
    getFilteredProblems() {
        return this.problems.filter(problem => {
            if (this.currentFilter.subject !== 'all' && problem.subject !== this.currentFilter.subject) return false;
            if (this.currentFilter.lectureSeries !== 'all' && problem.lectureSeries !== this.currentFilter.lectureSeries) return false;
            if (this.currentFilter.status !== 'all' && problem.status !== this.currentFilter.status) return false;
            if (this.currentFilter.difficulty !== 'all' && problem.difficulty.toString() !== this.currentFilter.difficulty) return false;
            return true;
        });
    }
    
    renderDashboard(container) {
        const stats = calculateImageClozeStats(this.problems);
        const filteredProblems = this.getFilteredProblems();
        
        container.innerHTML = `
            <div class="study-dashboard-container">
                <div class="study-dashboard-header">
                    <h1 class="study-dashboard-title">📚 이미지 Cloze 학습 대시보드</h1>
                    <p class="study-dashboard-subtitle">강의 기반 문제 풀이 시스템</p>
                </div>
                
                <!-- 통계 카드 -->
                <div class="stats-overview">
                    <div class="stat-card">
                        <div class="stat-number total">${stats.total}</div>
                        <div class="stat-label">전체 문제</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number mastered">${stats.mastered}</div>
                        <div class="stat-label">완전 숙달</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number reviewing">${stats.reviewing}</div>
                        <div class="stat-label">복습 중</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number learning">${stats.learning}</div>
                        <div class="stat-label">학습 중</div>
                    </div>
                </div>
                
                <!-- 진행률 섹션 -->
                <div class="progress-section">
                    <div class="progress-header">
                        <h3>전체 진행률</h3>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${stats.total > 0 ? (stats.mastered / stats.total * 100).toFixed(1) : 0}%"></div>
                        <div class="progress-text">${stats.total > 0 ? (stats.mastered / stats.total * 100).toFixed(1) : 0}%</div>
                    </div>
                    <div class="review-stats">
                        <div class="review-item">
                            <div class="review-number">${stats.averageReviewCount}</div>
                            <div class="review-label">평균 복습 횟수</div>
                        </div>
                        <div class="review-item">
                            <div class="review-number">${stats.averageScore}</div>
                            <div class="review-label">평균 점수</div>
                        </div>
                        <div class="review-item">
                            <div class="review-number">${(stats.totalStudyTime / 60).toFixed(1)}h</div>
                            <div class="review-label">총 학습 시간</div>
                        </div>
                    </div>
                </div>
                
                <!-- 보기 모드 탭 -->
                <div class="cloze-view-mode-tabs">
                    <div class="cloze-view-mode-tab ${this.viewMode === 'grid' ? 'active' : ''}" data-mode="grid">
                        📊 카드 보기
                    </div>
                    <div class="cloze-view-mode-tab ${this.viewMode === 'lecture-series' ? 'active' : ''}" data-mode="lecture-series">
                        📚 강의별 보기
                    </div>
                    <div class="cloze-view-mode-tab ${this.viewMode === 'review-needed' ? 'active' : ''}" data-mode="review-needed">
                        🔄 복습 필요
                    </div>
                </div>
                
                <!-- 필터 섹션 -->
                <div class="filter-section">
                    <div class="filter-group">
                        <label>과목:</label>
                        <select class="filter-select" data-filter="subject">
                            <option value="all">전체</option>
                            ${Object.keys(stats.bySubject).map(subject => 
                                `<option value="${subject}" ${this.currentFilter.subject === subject ? 'selected' : ''}>${subject}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div class="filter-group">
                        <label>강의:</label>
                        <select class="filter-select" data-filter="lectureSeries">
                            <option value="all">전체</option>
                            ${Object.keys(stats.byLectureSeries).map(series => 
                                `<option value="${series}" ${this.currentFilter.lectureSeries === series ? 'selected' : ''}>${series}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div class="filter-group">
                        <label>상태:</label>
                        <select class="filter-select" data-filter="status">
                            <option value="all">전체</option>
                            <option value="learning" ${this.currentFilter.status === 'learning' ? 'selected' : ''}>학습 중</option>
                            <option value="reviewing" ${this.currentFilter.status === 'reviewing' ? 'selected' : ''}>복습 중</option>
                            <option value="mastered" ${this.currentFilter.status === 'mastered' ? 'selected' : ''}>완전 숙달</option>
                        </select>
                    </div>
                    <div class="filter-group">
                        <label>난이도:</label>
                        <select class="filter-select" data-filter="difficulty">
                            <option value="all">전체</option>
                            <option value="1" ${this.currentFilter.difficulty === '1' ? 'selected' : ''}>⭐</option>
                            <option value="2" ${this.currentFilter.difficulty === '2' ? 'selected' : ''}>⭐⭐</option>
                            <option value="3" ${this.currentFilter.difficulty === '3' ? 'selected' : ''}>⭐⭐⭐</option>
                            <option value="4" ${this.currentFilter.difficulty === '4' ? 'selected' : ''}>⭐⭐⭐⭐</option>
                            <option value="5" ${this.currentFilter.difficulty === '5' ? 'selected' : ''}>⭐⭐⭐⭐⭐</option>
                        </select>
                    </div>
                </div>
                
                <!-- 컨텐츠 영역 -->
                <div id="cloze-content-area"></div>
            </div>
        `;
        
        // 이벤트 리스너 추가
        this.attachEventListeners(container);
        
        // 현재 뷰 모드에 따라 컨텐츠 렌더링
        this.renderContent(filteredProblems);
    }
    
    renderContent(problems) {
        const contentArea = this.view.containerEl.querySelector('#cloze-content-area');
        
        switch(this.viewMode) {
            case 'grid':
                this.renderGridView(contentArea, problems);
                break;
            case 'lecture-series':
                this.renderLectureSeriesView(contentArea, problems);
                break;
            case 'review-needed':
                this.renderReviewNeededView(contentArea, problems);
                break;
        }
    }
    
    renderGridView(container, problems) {
        container.innerHTML = `
            <div class="image-cloze-grid">
                ${problems.map(problem => renderImageClozeCard(problem)).join('')}
            </div>
        `;
        
        // 카드 클릭 이벤트
        container.querySelectorAll('.image-cloze-card').forEach(card => {
            card.addEventListener('click', () => {
                const filePath = card.dataset.path;
                this.openProblemFile(filePath);
            });
        });
    }
    
    renderLectureSeriesView(container, problems) {
        const grouped = groupProblemsByLectureSeries(problems);
        
        let html = '';
        for (const [series, seriesProblems] of Object.entries(grouped)) {
            const mastered = seriesProblems.filter(p => p.status === 'mastered').length;
            const total = seriesProblems.length;
            const progress = total > 0 ? (mastered / total * 100).toFixed(1) : 0;
            
            html += `
                <div class="lecture-series-section">
                    <div class="lecture-series-header">
                        <div class="lecture-series-title">📚 ${series}</div>
                        <div class="lecture-series-progress">
                            ${mastered}/${total} 완료 (${progress}%)
                        </div>
                    </div>
                    <div class="lecture-series-progress-bar">
                        <div class="lecture-series-progress-fill" style="width: ${progress}%"></div>
                    </div>
                    <div class="image-cloze-grid">
                        ${seriesProblems.map(problem => renderImageClozeCard(problem)).join('')}
                    </div>
                </div>
            `;
        }
        
        container.innerHTML = html;
        
        // 카드 클릭 이벤트
        container.querySelectorAll('.image-cloze-card').forEach(card => {
            card.addEventListener('click', () => {
                const filePath = card.dataset.path;
                this.openProblemFile(filePath);
            });
        });
    }
    
    renderReviewNeededView(container, problems) {
        const needReview = getProblemsNeedingReview(problems);
        
        container.innerHTML = `
            <div class="review-needed-section">
                <div class="review-needed-header">
                    <div class="review-needed-title">🔄 복습이 필요한 문제</div>
                    <div class="review-needed-count">${needReview.length}개</div>
                </div>
                ${needReview.length > 0 ? `
                    <div class="image-cloze-grid">
                        ${needReview.map(problem => renderImageClozeCard(problem)).join('')}
                    </div>
                ` : '<p style="text-align: center; color: var(--text-muted); padding: 20px;">복습이 필요한 문제가 없습니다! 🎉</p>'}
            </div>
        `;
        
        // 카드 클릭 이벤트
        container.querySelectorAll('.image-cloze-card').forEach(card => {
            card.addEventListener('click', () => {
                const filePath = card.dataset.path;
                this.openProblemFile(filePath);
            });
        });
    }
    
    attachEventListeners(container) {
        // 뷰 모드 탭 클릭
        container.querySelectorAll('.cloze-view-mode-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.viewMode = tab.dataset.mode;
                container.querySelectorAll('.cloze-view-mode-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.renderContent(this.getFilteredProblems());
            });
        });
        
        // 필터 변경
        container.querySelectorAll('.filter-select').forEach(select => {
            select.addEventListener('change', (e) => {
                const filterType = e.target.dataset.filter;
                this.currentFilter[filterType] = e.target.value;
                this.renderContent(this.getFilteredProblems());
            });
        });
    }
    
    async openProblemFile(filePath) {
        const file = this.plugin.app.vault.getAbstractFileByPath(filePath);
        if (file) {
            const leaf = this.plugin.app.workspace.getLeaf(false);
            await leaf.openFile(file);
        }
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        IMAGE_CLOZE_SETTINGS,
        IMAGE_CLOZE_STYLES,
        ImageClozeDashboardMethods,
        parseImageClozeProblem,
        scanImageClozProblems,
        calculateImageClozeStats,
        groupProblemsByLectureSeries,
        getProblemsNeedingReview,
        renderImageClozeCard
    };
}
