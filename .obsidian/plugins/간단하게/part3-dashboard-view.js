// ========== Part 3: 대시보드 뷰 클래스 ==========
// HTML 템플릿 기반 대시보드 UI 구현

class StudyDashboardView extends ItemView {
    constructor(leaf, plugin) {
        super(leaf);
        this.plugin = plugin;
        this.currentSubject = this.plugin.settings.defaultSubject;
        this.maxProblems = this.plugin.settings.maxProblems;
        this.viewMode = 'all';
        this.currentTab = 'dashboard'; // 'dashboard' or 'template'
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
        
        // 탭 네비게이션
        this.renderTabs(container);
        
        if (this.currentTab === 'dashboard') {
            await this.renderMainDashboard(container);
        } else {
            this.renderProblemTemplate(container);
        }
    }
    
    // ========== 탭 네비게이션 ==========
    renderTabs(container) {
        const tabs = container.createDiv('tabs');
        
        const dashboardTab = tabs.createEl('button', { 
            cls: 'tab-btn' + (this.currentTab === 'dashboard' ? ' active' : ''),
            text: '📊 플러그인 대시보드'
        });
        
        const templateTab = tabs.createEl('button', { 
            cls: 'tab-btn' + (this.currentTab === 'template' ? ' active' : ''),
            text: '📝 문제 템플릿'
        });
        
        dashboardTab.addEventListener('click', () => {
            this.currentTab = 'dashboard';
            this.renderDashboard(container);
        });
        
        templateTab.addEventListener('click', () => {
            this.currentTab = 'template';
            this.renderDashboard(container);
        });
    }
    
    // ========== 메인 대시보드 렌더링 ==========
    async renderMainDashboard(container) {
        const dashboardDiv = container.createDiv('dashboard-content active');
        
        // 헤더
        this.renderHeader(dashboardDiv);
        
        // 타이머 섹션
        this.renderTimerSection(dashboardDiv);
        
        // 과목 탭들
        this.renderSubjectTabs(dashboardDiv);
        
        // 문제 데이터 로드
        const allProblems = await this.plugin.getAllProblems();
        const currentProblems = allProblems.filter(p => p.subject === this.currentSubject);
        const stats = this.calculateStats(currentProblems);
        
        // 통계 카드
        this.renderStatsGrid(dashboardDiv, stats);
        
        // 액션 섹션
        this.renderActionSection(dashboardDiv);
        
        // 500문제 그리드
        this.renderProblemsGrid(dashboardDiv, currentProblems);
    }
    
    // ========== 헤더 렌더링 ==========
    renderHeader(container) {
        const header = container.createDiv('dashboard-header');
        
        // 설정 아이콘
        const settingsIcon = header.createDiv('settings-icon');
        settingsIcon.innerHTML = '⚙️';
        settingsIcon.addEventListener('click', () => {
            this.openSettingsModal();
        });
        
        const headerContent = header.createDiv('header-content');
        
        const title = headerContent.createEl('h1', { 
            cls: 'main-title',
            text: '📚 Study Dashboard'
        });
        
        const subtitle = headerContent.createEl('p', { 
            cls: 'subtitle',
            text: 'Stopwatch Timer + 500문제 그리드 통합'
        });
    }
    
    // ========== 타이머 섹션 ==========
    renderTimerSection(container) {
        const timerSection = container.createDiv('timer-section');
        
        const timerTitle = timerSection.createDiv('timer-title');
        timerTitle.textContent = '⏱️ 현재 문제 타이머';
        
        const timerSubtitle = timerSection.createDiv('timer-subtitle');
        timerSubtitle.textContent = `${this.currentSubject} 1번 - 삼각함수의 미분`;
        
        const timerDisplay = timerSection.createDiv('timer-display');
        timerDisplay.textContent = '00:00:00';
        
        const timerControls = timerSection.createDiv('timer-controls');
        
        // 타이머 버튼들
        const startBtn = timerControls.createEl('button', { 
            cls: 'timer-btn start',
            text: '▶️ 시작'
        });
        
        const pauseBtn = timerControls.createEl('button', { 
            cls: 'timer-btn pause',
            text: '⏸️ 일시정지'
        });
        
        const stopBtn = timerControls.createEl('button', { 
            cls: 'timer-btn stop',
            text: '⏹️ 정지'
        });
        
        const resetBtn = timerControls.createEl('button', { 
            cls: 'timer-btn reset',
            text: '🔄 초기화'
        });
        
        // 타이머 이벤트 핸들러
        startBtn.addEventListener('click', () => {
            this.plugin.startTimer({
                subject: this.currentSubject,
                number: 1,
                title: '현재 문제'
            });
        });
        
        pauseBtn.addEventListener('click', () => {
            // 일시정지 로직
            if (this.plugin.timerState.isRunning) {
                this.plugin.stopTimer();
            }
        });
        
        stopBtn.addEventListener('click', () => {
            this.plugin.stopTimer();
        });
        
        resetBtn.addEventListener('click', () => {
            this.plugin.resetTimer();
        });
        
        // 타이머 사용법
        const timerInfo = timerSection.createDiv('timer-info');
        const infoText = timerInfo.createEl('p');
        infoText.innerHTML = '<strong>💡 타이머 사용법:</strong><br>문제 클릭 → 타이머 자동 시작 → 완료 시 시간 자동 기록';
    }
    
    // ========== 과목 탭들 ==========
    renderSubjectTabs(container) {
        const subjectTabs = container.createDiv('subject-tabs');
        
        this.plugin.settings.subjects.forEach(subject => {
            const tab = subjectTabs.createDiv('subject-tab');
            tab.textContent = subject;
            
            if (subject === this.currentSubject) {
                tab.addClass('active');
            }
            
            tab.addEventListener('click', async () => {
                // 모든 탭에서 active 제거
                subjectTabs.querySelectorAll('.subject-tab').forEach(t => 
                    t.removeClass('active')
                );
                
                // 현재 탭 활성화
                tab.addClass('active');
                this.currentSubject = subject;
                
                // 대시보드 새로고침
                await this.renderDashboard(container.parentElement);
                
                new Notice(`${subject} 과목이 선택되었습니다.`);
            });
        });
    }
    
    // ========== 통계 계산 ==========
    calculateStats(problems) {
        const total = Math.max(this.maxProblems, problems.length);
        const mastered = problems.filter(p => p.status === PROBLEM_STATUS.MASTERED).length;
        const reviewing = problems.filter(p => p.status === PROBLEM_STATUS.REVIEWING).length;
        const learning = problems.filter(p => p.status === PROBLEM_STATUS.LEARNING).length;
        const progress = total > 0 ? Math.round((mastered / total) * 100) : 0;
        
        const targetDate = new Date(this.plugin.settings.targetDate);
        const today = new Date();
        const daysLeft = Math.max(1, Math.ceil((targetDate - today) / (1000 * 60 * 60 * 24)));
        const dailyTarget = Math.ceil((total - mastered) / daysLeft);
        
        return { 
            total, 
            mastered, 
            reviewing, 
            learning, 
            progress, 
            daysLeft, 
            dailyTarget 
        };
    }
    
    // ========== 통계 카드 ==========
    renderStatsGrid(container, stats) {
        const statsGrid = container.createDiv('stats-grid');
        
        const statData = [
            { number: stats.mastered, label: '완전 숙달', type: 'mastered' },
            { number: stats.reviewing, label: '복습 중', type: 'reviewing' },
            { number: stats.learning, label: '학습 중', type: 'learning' },
            { number: stats.total, label: '전체 문제', type: '' }
        ];
        
        statData.forEach(stat => {
            const card = statsGrid.createDiv('stat-card');
            if (stat.type) card.addClass(stat.type);
            
            const number = card.createDiv('stat-number');
            if (stat.type) number.addClass(stat.type);
            number.textContent = stat.number.toString();
            
            const label = card.createDiv('stat-label');
            label.textContent = stat.label;
        });
    }
    
    // ========== 액션 섹션 ==========
    renderActionSection(container) {
        const actionSection = container.createDiv('action-section');
        
        // 보기 컨트롤
        const viewControls = actionSection.createDiv('view-controls');
        
        const viewLabel = viewControls.createEl('label', { text: '보기 모드:' });
        const viewSelect = viewControls.createEl('select');
        
        const viewOptions = [
            { value: 'all', text: '전체 보기' },
            { value: 'incomplete', text: '미완료만' },
            { value: 'review', text: '복습 필요' }
        ];
        
        viewOptions.forEach(opt => {
            const option = viewSelect.createEl('option', {
                value: opt.value,
                text: opt.text
            });
            if (opt.value === this.viewMode) {
                option.selected = true;
            }
        });
        
        viewSelect.addEventListener('change', (e) => {
            this.viewMode = e.target.value;
            this.refresh();
        });
        
        // 액션 버튼들
        const actionButtons = actionSection.createDiv('action-buttons');
        
        const addBtn = actionButtons.createEl('button', { 
            cls: 'btn btn-primary',
            text: '➕ 새 문제'
        });
        
        const batchBtn = actionButtons.createEl('button', { 
            cls: 'btn btn-success',
            text: '📝 일괄 생성'
        });
        
        const refreshBtn = actionButtons.createEl('button', { 
            cls: 'btn btn-secondary',
            text: '🔄 새로고침'
        });
        
        // 버튼 이벤트
        addBtn.addEventListener('click', () => {
            new ProblemCreationModal(this.app, this.plugin, null, this.currentSubject).open();
        });
        
        batchBtn.addEventListener('click', () => {
            new BulkCreationModal(this.app, this.plugin, this.currentSubject).open();
        });
        
        refreshBtn.addEventListener('click', () => {
            this.refresh();
            new Notice('대시보드가 새로고침되었습니다.');
        });
    }
    
    // ========== 500문제 그리드 ==========
    renderProblemsGrid(container, problems) {
        const problemsSection = container.createDiv('problems-section');
        
        const problemsTitle = problemsSection.createEl('h3', { 
            cls: 'problems-title',
            text: `📊 문제 현황 - ${this.currentSubject} (${this.maxProblems}문제)`
        });
        
        const problemsGrid = problemsSection.createDiv('problems-grid');
        
        // 500개 문제 셀 생성
        for (let i = 1; i <= this.maxProblems; i++) {
            const problem = problems.find(p => p.number === i);
            const cell = problemsGrid.createDiv('problem-cell');
            cell.textContent = i.toString();
            
            if (problem) {
                // 문제가 존재하는 경우
                cell.addClass(problem.status);
                cell.title = `${i}번: ${problem.title}`;
                
                // 복습 횟수 배지
                if (problem.reviewCount > 0) {
                    const badge = cell.createDiv('review-badge');
                    badge.textContent = problem.reviewCount > 9 ? '9+' : problem.reviewCount.toString();
                }
                
                // 보기 모드 필터링
                if ((this.viewMode === 'incomplete' && problem.status === PROBLEM_STATUS.MASTERED) || 
                    (this.viewMode === 'review' && problem.status !== PROBLEM_STATUS.REVIEWING)) {
                    cell.style.display = 'none';
                }
                
                // 클릭 이벤트 - 문제 열기
                cell.addEventListener('click', () => {
                    this.openProblem(problem);
                });
                
            } else {
                // 빈 문제 셀
                cell.addClass('empty');
                cell.title = `${i}번 문제 만들기`;
                
                // 클릭 이벤트 - 새 문제 생성
                cell.addEventListener('click', () => {
                    new ProblemCreationModal(this.app, this.plugin, i, this.currentSubject).open();
                });
            }
        }
    }
    
    // ========== 문제 템플릿 렌더링 ==========
    renderProblemTemplate(container) {
        const templateDiv = container.createDiv('template-content active');
        
        const templateContainer = templateDiv.createDiv('template-container');
        
        // 문제 헤더
        const problemHeader = templateContainer.createDiv('problem-header');
        
        const problemTitle = problemHeader.createEl('h1', { 
            cls: 'problem-title-main',
            text: '1. 삼각함수의 미분'
        });
        
        const problemMeta = problemHeader.createDiv('problem-meta');
        problemMeta.innerHTML = `
            <span>📚 <strong>출처:</strong> 수학의 정석 (147페이지)</span>
            <span>📖 <strong>단원:</strong> 미적분</span>
            <span>⭐ <strong>난이도:</strong> 3/5</span>
        `;
        
        // 스톱워치 섹션
        this.renderStopwatchSection(templateContainer);
        
        // 문제 섹션
        this.renderProblemSection(templateContainer);
        
        // 힌트 섹션
        this.renderHintSection(templateContainer);
        
        // 정답 및 풀이 섹션
        this.renderAnswerSection(templateContainer);
        
        // 풀이 기록 섹션
        this.renderRecordSection(templateContainer);
    }
    
    // ========== 스톱워치 섹션 ==========
    renderStopwatchSection(container) {
        const section = container.createDiv('section');
        
        const sectionTitle = section.createEl('h2', { 
            cls: 'section-title',
            text: '⏱️ 문제 풀이 타이머'
        });
        
        const stopwatchBlock = section.createDiv('stopwatch-block');
        
        const stopwatchTitle = stopwatchBlock.createDiv('stopwatch-title');
        stopwatchTitle.textContent = `${this.currentSubject} 1번 - 삼각함수의 미분`;
        
        const stopwatchDisplay = stopwatchBlock.createDiv('stopwatch-display');
        stopwatchDisplay.textContent = '00:00:00';
        
        const stopwatchControls = stopwatchBlock.createDiv('stopwatch-controls');
        
        // 스톱워치 버튼들
        const buttons = [
            { class: 'start', text: '▶️ 시작' },
            { class: 'pause', text: '⏸️ 일시정지' },
            { class: 'stop', text: '⏹️ 정지' },
            { class: 'reset', text: '🔄 초기화' }
        ];
        
        buttons.forEach(btn => {
            const button = stopwatchControls.createEl('button', { 
                cls: `stopwatch-btn ${btn.class}`,
                text: btn.text
            });
            
            // 버튼 이벤트 (각 버튼별로 다른 동작)
            button.addEventListener('click', () => {
                new Notice(`${btn.text} 클릭됨!`);
            });
        });
        
        // 사용법 정보
        const usageInfo = stopwatchBlock.createDiv('usage-info');
        usageInfo.innerHTML = `
            <strong>💡 Stopwatch 플러그인 사용법:</strong><br>
            문제 풀이 시작 → 시작 버튼 → 완료 시 정지 → 자동 시간 기록
        `;
    }
    
    // ========== 문제 섹션 ==========
    renderProblemSection(container) {
        const section = container.createDiv('section');
        
        const sectionTitle = section.createEl('h2', { 
            cls: 'section-title',
            text: '📸 문제'
        });
        
        const imagePlaceholder = section.createDiv('image-placeholder');
        imagePlaceholder.innerHTML = `
            🖼️ 이미지를 여기에 붙여넣거나<br>
            Ctrl+V로 붙여넣기<br>
            또는 ![[이미지명.png]] 형식으로 추가
        `;
    }
    
    // ========== 힌트 섹션 ==========
    renderHintSection(container) {
        const section = container.createDiv('section');
        
        const sectionTitle = section.createEl('h2', { 
            cls: 'section-title',
            text: '💡 힌트'
        });
        
        const collapsible = section.createDiv('collapsible');
        
        const collapsibleHeader = collapsible.createDiv('collapsible-header');
        collapsibleHeader.innerHTML = `
            💡 힌트 보기 (클릭해서 펼치기)
            <span>▼</span>
        `;
        
        const collapsibleContent = collapsible.createDiv('collapsible-content');
        collapsibleContent.style.display = 'none';
        
        const hintPlaceholder = collapsibleContent.createDiv('image-placeholder');
        hintPlaceholder.textContent = '🖼️ 힌트 이미지';
        
        // 접기/펼치기 이벤트
        collapsibleHeader.addEventListener('click', () => {
            const isHidden = collapsibleContent.style.display === 'none';
            collapsibleContent.style.display = isHidden ? 'block' : 'none';
            const icon = collapsibleHeader.querySelector('span');
            icon.textContent = isHidden ? '▲' : '▼';
        });
    }
    
    // ========== 정답 및 풀이 섹션 ==========
    renderAnswerSection(container) {
        const section = container.createDiv('section');
        
        const sectionTitle = section.createEl('h2', { 
            cls: 'section-title',
            text: '✅ 정답 및 풀이'
        });
        
        const collapsible = section.createDiv('collapsible');
        
        const collapsibleHeader = collapsible.createDiv('collapsible-header');
        collapsibleHeader.innerHTML = `
            🔍 정답 보기 (문제를 다 푼 후 클릭)
            <span>▼</span>
        `;
        
        const collapsibleContent = collapsible.createDiv('collapsible-content');
        collapsibleContent.style.display = 'none';
        
        const answerContent = collapsibleContent.createDiv();
        answerContent.innerHTML = `
            <p><strong>정답:</strong></p>
            <div class="image-placeholder">🖼️ 정답 이미지</div>
            <p style="margin-top: 20px;"><strong>풀이:</strong></p>
            <div class="image-placeholder">🖼️ 풀이 과정 이미지</div>
        `;
        
        // 접기/펼치기 이벤트
        collapsibleHeader.addEventListener('click', () => {
            const isHidden = collapsibleContent.style.display === 'none';
            collapsibleContent.style.display = isHidden ? 'block' : 'none';
            const icon = collapsibleHeader.querySelector('span');
            icon.textContent = isHidden ? '▲' : '▼';
        });
    }
    
    // ========== 풀이 기록 섹션 ==========
    renderRecordSection(container) {
        const section = container.createDiv('section');
        
        const sectionTitle = section.createEl('h2', { 
            cls: 'section-title',
            text: '📊 풀이 기록 & 등급'
        });
        
        // 풀이 통계
        const statsDiv = section.createDiv();
        statsDiv.style.cssText = 'background: #2a2a2a; padding: 25px; border-radius: 15px; margin: 25px 0;';
        
        const statsTitle = statsDiv.createEl('h3', { 
            text: '📈 풀이 통계',
            css: { 'margin-bottom': '20px', 'font-size': '1.3rem' }
        });
        
        const statsList = statsDiv.createEl('ul');
        statsList.style.cssText = 'line-height: 2.2; list-style: none; font-size: 1.05rem;';
        statsList.innerHTML = `
            <li>🔢 <strong>총 풀이 횟수:</strong> 3회</li>
            <li>⏱️ <strong>평균 시간:</strong> 2분 30초</li>
            <li>📅 <strong>최근 풀이:</strong> 2분 15초</li>
            <li>🏆 <strong>최고 기록:</strong> 1분 45초</li>
            <li>📊 <strong>현재 등급:</strong> <span class="grade-badge grade-a">A ⭐</span></li>
        `;
        
        // 통계 테이블
        const table = section.createEl('table', { cls: 'stats-table' });
        table.style.cssText = 'width: 100%; border-collapse: collapse; margin: 25px 0;';
        
        const thead = table.createEl('thead');
        const headerRow = thead.createEl('tr');
        ['시도', '날짜', '시간', '등급'].forEach(text => {
            const th = headerRow.createEl('th', { text });
            th.style.cssText = 'padding: 15px; text-align: left; border: 1px solid #3a3a3a; background: #1e1e1e; font-weight: 800;';
        });
        
        const tbody = table.createEl('tbody');
        const sampleData = [
            ['1', '2025-09-28', '4분 30초', '<span class="grade-badge grade-c">C ⚠️</span>'],
            ['2', '2025-09-29', '2분 45초', '<span class="grade-badge grade-b">B ✅</span>'],
            ['3', '2025-09-30', '1분 45초', '<span class="grade-badge grade-a">A ⭐</span>']
        ];
        
        sampleData.forEach(rowData => {
            const row = tbody.createEl('tr');
            rowData.forEach(cellData => {
                const td = row.createEl('td');
                td.innerHTML = cellData;
                td.style.cssText = 'padding: 15px; border: 1px solid #3a3a3a;';
            });
        });
    }
    
    // ========== 유틸리티 메소드들 ==========
    async openProblem(problem) {
        try {
            if (this.plugin.settings.timerEnabled) {
                // 타이머 모달로 열기
                new ProblemTimerModal(this.app, this.plugin, problem).open();
            } else {
                // 직접 파일 열기
                if (problem?.file?.path) {
                    const leaf = this.app.workspace.getUnpinnedLeaf();
                    await leaf.openFile(problem.file);
                } else {
                    new Notice('문제 파일을 찾을 수 없습니다.');
                }
            }
        } catch (error) {
            console.error('문제 열기 오류:', error);
            new Notice('문제를 여는 중 오류가 발생했습니다.');
        }
    }
    
    openSettingsModal() {
        new SettingsModal(this.app, this.plugin).open();
    }
    
    refresh() {
        this.onOpen();
    }
}

// Part 3 완료 - 대시보드 뷰 클래스 완성
console.log('📚 Part 3: 대시보드 뷰 클래스 로드 완료');