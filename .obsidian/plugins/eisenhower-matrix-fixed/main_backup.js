const { Plugin, Modal, Notice, ItemView, PluginSettingTab, Setting } = require('obsidian');

const DEFAULT_SETTINGS = {
    mainFolder: 'Eisenhower Matrix',
    dailyFolder: 'Daily',
    weeklyFolder: 'Weekly',
    monthlyFolder: 'Monthly',
    quarterlyFolder: 'Quarterly',
    yearlyFolder: 'Yearly',
    fileFormat: 'md',
    enableDaily: true,
    enableWeekly: true,
    enableMonthly: true,
    usePeriodicNotes: true, // Periodic Notes 연동
    periodicNotesDaily: 'Daily',
    periodicNotesWeekly: 'Weekly',
    periodicNotesMonthly: 'Monthly',
    // 템플릿 설정 추가
    templateFolder: 'Templates',
    dailyTemplate: 'Daily Eisenhower Matrix.md',
    weeklyTemplate: 'Weekly Eisenhower Matrix.md',
    monthlyTemplate: 'Monthly Eisenhower Matrix.md',
    useTemplate: true
};

class EisenhowerMatrixPlugin extends Plugin {
    async onload() {
        console.log('Eisenhower Matrix Plugin loading...');
        await this.loadSettings();
        
        this.addRibbonIcon('target', 'Open Eisenhower Matrix', () => {
            console.log('Ribbon icon clicked');
            this.activateView();
        });

        this.registerView(
            'eisenhower-matrix-view',
            (leaf) => new EisenhowerMatrixView(leaf, this)
        );

        this.addSettingTab(new EisenhowerSettingTab(this.app, this));

        this.addCommand({
            id: 'open-eisenhower-matrix',
            name: 'Open Eisenhower Matrix',
            callback: () => {
                this.activateView();
            }
        });
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    async activateView() {
        const { workspace } = this.app;
        
        let leaf = null;
        const leaves = workspace.getLeavesOfType('eisenhower-matrix-view');

        if (leaves.length > 0) {
            leaf = leaves[0];
        } else {
            leaf = workspace.getRightLeaf(false);
            await leaf.setViewState({
                type: 'eisenhower-matrix-view',
                active: true,
            });
        }

        workspace.revealLeaf(leaf);
    }

    onunload() {
        this.app.workspace.detachLeavesOfType('eisenhower-matrix-view');
    }
}

class EisenhowerMatrixView extends ItemView {
    constructor(leaf, plugin) {
        super(leaf);
        this.plugin = plugin;
        this.currentPeriod = 'daily';
        this.currentTab = 'matrix';
        this.tasks = this.loadFromStorage();
        this.shouldRerender = true; // 렌더링 최적화를 위한 플래그
    }

    getViewType() {
        return 'eisenhower-matrix-view';
    }

    getDisplayText() {
        return 'Eisenhower Matrix';
    }

    getIcon() {
        return 'target';
    }

    async onOpen() {
        console.log('EisenhowerMatrixView onOpen');
        this.addStyles();
        this.render();
    }

    loadFromStorage() {
        try {
            const stored = localStorage.getItem('eisenhower-matrix-tasks');
            if (stored) {
                return JSON.parse(stored);
            }
        } catch (error) {
            console.error('Error loading tasks:', error);
        }
        
        return {
            daily: { q1: [], q2: [], q3: [], q4: [] },
            weekly: { q1: [], q2: [], q3: [], q4: [] },
            monthly: { q1: [], q2: [], q3: [], q4: [] },
            yearly: { q1: [], q2: [], q3: [], q4: [] }
        };
    }

    saveToStorage() {
        try {
            localStorage.setItem('eisenhower-matrix-tasks', JSON.stringify(this.tasks));
            this.shouldRerender = true; // 데이터 변경 시 재렌더링 필요
        } catch (error) {
            console.error('Error saving tasks:', error);
        }
    }

    render() {
        const container = this.containerEl;
        container.empty();
        container.className = 'eisenhower-matrix-container';

        const header = container.createDiv('em-header');
        header.createEl('h1', { text: '🎯 Eisenhower Matrix' });
        header.createEl('p', { text: '중요도와 긴급도에 따른 할일 관리' });

        const dateHeader = container.createDiv('em-date-header');
        this.updateDateDisplay(dateHeader);

        const tabContainer = container.createDiv('em-tab-container');
        this.createTabs(tabContainer);

        const stats = container.createDiv('em-stats');
        this.updateStats(stats);

        this.attachEventListeners();
    }

    createTabs(container) {
        const tabButtons = container.createDiv('em-tab-buttons');
        
        const matrixBtn = tabButtons.createEl('button', { 
            cls: 'em-tab-btn active', 
            text: '📊 매트릭스' 
        });
        matrixBtn.dataset.tab = 'matrix';
        
        const timelineBtn = tabButtons.createEl('button', { 
            cls: 'em-tab-btn', 
            text: '📅 타임라인' 
        });
        timelineBtn.dataset.tab = 'timeline';
        
        const settingsBtn = tabButtons.createEl('button', { 
            cls: 'em-tab-btn', 
            text: '⚙️ 설정' 
        });
        settingsBtn.dataset.tab = 'settings';

        const matrixContent = container.createDiv('em-tab-content active');
        matrixContent.dataset.content = 'matrix';
        this.renderMatrixTab(matrixContent);

        const timelineContent = container.createDiv('em-tab-content');
        timelineContent.dataset.content = 'timeline';
        timelineContent.style.display = 'none';
        this.renderTimelineTab(timelineContent);

        const settingsContent = container.createDiv('em-tab-content');
        settingsContent.dataset.content = 'settings';
        settingsContent.style.display = 'none';
        this.renderSettingsTab(settingsContent);
    }

    renderMatrixTab(container) {
        const periodSection = container.createDiv('em-period-selector');
        
        const periods = [
            { id: 'daily', text: '일일' },
            { id: 'weekly', text: '주간' },
            { id: 'monthly', text: '월간' },
            { id: 'yearly', text: '연간' }
        ];

        periods.forEach(period => {
            const btn = periodSection.createEl('button', {
                cls: `em-period-btn ${period.id === this.currentPeriod ? 'active' : ''}`,
                text: period.text
            });
            btn.dataset.period = period.id;
        });

        const inputSection = container.createDiv('em-input-section');
        const taskInput = inputSection.createEl('input', {
            type: 'text',
            placeholder: '새 할일을 입력하세요...',
            cls: 'em-task-input'
        });
        taskInput.id = 'em-taskInput';

        const quickActions = inputSection.createDiv('em-quick-actions');
        this.createQuickButtons(quickActions);

        const matrixGrid = container.createDiv('em-matrix-grid');
        this.renderMatrix(matrixGrid);
    }

    createQuickButtons(container) {
        const quadrants = [
            { id: 'q1', icon: '🔥', title: '중요하고 긴급함', desc: '지금 당장 해야 할 일' },
            { id: 'q2', icon: '📅', title: '중요하지만 긴급하지 않음', desc: '계획하고 스케줄링' },
            { id: 'q3', icon: '👥', title: '긴급하지만 중요하지 않음', desc: '위임하거나 최소화' },
            { id: 'q4', icon: '🗑️', title: '중요하지도 긴급하지도 않음', desc: '제거하거나 최소화' }
        ];

        quadrants.forEach(q => {
            const btn = container.createEl('button', { cls: 'em-quick-btn' });
            btn.dataset.quadrant = q.id;
            
            btn.createDiv({ cls: 'em-btn-icon', text: q.icon });
            btn.createDiv({ text: q.title });
            btn.createDiv({ cls: 'em-btn-label', text: q.desc });
        });
    }

    renderMatrix(container) {
        container.empty();
        
        // 기간별 스타일 클래스 추가
        container.className = `em-matrix-grid em-${this.currentPeriod}`;
        
        const quadrants = this.getQuadrantsForPeriod(this.currentPeriod);

        quadrants.forEach(q => {
            const quadrant = container.createDiv(`em-quadrant em-${q.id} em-${this.currentPeriod}-quadrant`);
            quadrant.dataset.quadrant = q.id;
            quadrant.style.borderLeft = `4px solid ${q.color}`;
            
            const header = quadrant.createDiv('em-quadrant-header');
            
            // 기간별 헤더 스타일
            if (this.currentPeriod === 'weekly') {
                header.createDiv({ cls: 'em-period-indicator', text: '📅 주간' });
            } else if (this.currentPeriod === 'monthly') {
                header.createDiv({ cls: 'em-period-indicator', text: '📊 월간' });
            } else if (this.currentPeriod === 'yearly') {
                header.createDiv({ cls: 'em-period-indicator', text: '🎯 연간' });
            }
            
            header.createDiv({ cls: 'em-quadrant-title', text: q.title });
            header.createDiv({ cls: 'em-quadrant-subtitle', text: q.subtitle });
            
            // 할일 추가 버튼 (일간만)
            if (this.currentPeriod === 'daily') {
                const addButton = header.createEl('button', { 
                    cls: 'em-add-task-btn', 
                    text: '+ 할일 추가' 
                });
                addButton.dataset.quadrant = q.id;
            }
            
            const taskList = quadrant.createDiv('em-task-list');
            this.updateQuadrantTasks(taskList, q.id);
            
            // 기간별 추가 정보 표시
            if (this.currentPeriod !== 'daily') {
                const taskCount = (this.tasks[this.currentPeriod][q.id] || []).length;
                const progressBar = quadrant.createDiv('em-progress-bar');
                const progress = progressBar.createDiv('em-progress-fill');
                progress.style.backgroundColor = q.color;
                progress.style.width = `${Math.min(taskCount * 10, 100)}%`;
                progressBar.createDiv({ cls: 'em-progress-text', text: `${taskCount}개 항목` });
            }
        });
    }

    getQuadrantsForPeriod(period) {
        const baseQuadrants = [
            { id: 'q1', color: '#ff6b6b' },
            { id: 'q2', color: '#4ecdc4' },
            { id: 'q3', color: '#45b7d1' },
            { id: 'q4', color: '#96ceb4' }
        ];

        if (period === 'daily') {
            return [
                { ...baseQuadrants[0], title: '🔥 중요하고 긴급함', subtitle: '오늘 반드시 해야 할 일' },
                { ...baseQuadrants[1], title: '📅 중요하지만 긴급하지 않음', subtitle: '계획하고 스케줄링' },
                { ...baseQuadrants[2], title: '👥 긴급하지만 중요하지 않음', subtitle: '위임하거나 최소화' },
                { ...baseQuadrants[3], title: '🗑️ 중요하지도 긴급하지도 않음', subtitle: '제거하거나 최소화' }
            ];
        } else if (period === 'weekly') {
            return [
                { ...baseQuadrants[0], title: '🎯 핵심 목표', subtitle: '이번 주 가장 중요한 성과' },
                { ...baseQuadrants[1], title: '📋 계획 수립', subtitle: '다음 주를 위한 준비' },
                { ...baseQuadrants[2], title: '⚡ 빠른 처리', subtitle: '짧은 시간에 해결할 일들' },
                { ...baseQuadrants[3], title: '🧹 정리 정돈', subtitle: '미뤄둔 잡무들' }
            ];
        } else if (period === 'monthly') {
            return [
                { ...baseQuadrants[0], title: '🏆 주요 프로젝트', subtitle: '이번 달 완성해야 할 핵심 업무' },
                { ...baseQuadrants[1], title: '🌱 성장 계획', subtitle: '장기적 발전을 위한 투자' },
                { ...baseQuadrants[2], title: '🔄 루틴 관리', subtitle: '정기적으로 처리할 업무들' },
                { ...baseQuadrants[3], title: '💡 아이디어 보관', subtitle: '나중에 검토할 아이디어들' }
            ];
        } else { // yearly
            return [
                { ...baseQuadrants[0], title: '🚀 핵심 목표', subtitle: '올해 반드시 달성할 목표' },
                { ...baseQuadrants[1], title: '📈 성장 영역', subtitle: '장기적 발전과 학습' },
                { ...baseQuadrants[2], title: '🔧 시스템 개선', subtitle: '효율성 증대 방안' },
                { ...baseQuadrants[3], title: '🎨 여가 활동', subtitle: '취미와 개인적 관심사' }
            ];
        }
    }

    updateQuadrantTasks(taskList, quadrant) {
        // 성능 최적화: 불필요한 재렌더링 방지
        if (!taskList.hasChildNodes() || this.shouldRerender) {
            taskList.empty();
            this.renderQuadrantTasks(taskList, quadrant);
        }
    }

    renderQuadrantTasks(taskList, quadrant) {
        const tasks = this.tasks[this.currentPeriod][quadrant] || [];
        
        if (tasks.length === 0) {
            taskList.createDiv({ 
                cls: 'em-empty-state', 
                text: '할일이 없습니다. "할일 추가" 버튼을 클릭하세요!' 
            });
            return;
        }

        // DocumentFragment 사용으로 성능 개선
        const fragment = document.createDocumentFragment();
        
        tasks.forEach((task, index) => {
            const taskItem = this.createTaskElement(task, quadrant, index);
            fragment.appendChild(taskItem);
        });
        
        taskList.appendChild(fragment);
    }

    createTaskElement(task, quadrant, index) {
        const taskItem = document.createElement('div');
        taskItem.className = 'em-task-item';
        taskItem.dataset.quadrant = quadrant;
        taskItem.dataset.index = index.toString();
        taskItem.draggable = true;
        
        // 메인 영역
        const taskMain = taskItem.createDiv('em-task-main');
        
        // 체크박스
        const checkbox = taskMain.createEl('input', { type: 'checkbox' });
        checkbox.classList.add('em-task-checkbox');
        if (typeof task === 'object' && task.completed) {
            checkbox.checked = true;
            taskItem.classList.add('em-task-completed');
        }
        
        // 할일 텍스트
        const taskText = typeof task === 'object' ? task.text : task;
        const textElement = taskMain.createDiv({ cls: 'em-task-text', text: taskText });
        
        // 액션 버튼들
        const actions = taskItem.createDiv('em-task-actions');
        
        // 이동 버튼
        const moveBtn = actions.createEl('button', { 
            cls: 'em-btn-move', 
            text: '📍',
            title: '다른 분면으로 이동'
        });
        moveBtn.dataset.quadrant = quadrant;
        moveBtn.dataset.index = index.toString();
        
        // 편집 버튼
        actions.createEl('button', { 
            cls: 'em-btn-edit', 
            text: '✏️',
            title: '편집'
        });
        
        // 삭제 버튼
        actions.createEl('button', { 
            cls: 'em-btn-remove', 
            text: '🗑️',
            title: '삭제'
        });

        return taskItem;
    }

    renderTimelineTab(container) {
        container.empty();
        container.createEl('h2', { text: '� 최근 파일' });
        
        const recentContainer = container.createDiv('em-recent-files');
        this.renderRecentFiles(recentContainer);
    }

    renderRecentFiles(container) {
        try {
            const recentFiles = this.getRecentFiles();
            
            if (recentFiles.length === 0) {
                container.createDiv({ 
                    cls: 'em-empty-state', 
                    text: '최근 편집한 파일이 없습니다.' 
                });
                return;
            }

            recentFiles.forEach(fileInfo => {
                const fileItem = container.createDiv('em-recent-file-item');
                fileItem.onclick = () => this.openFile(fileInfo.file);
                
                const icon = fileItem.createDiv('em-file-icon');
                icon.textContent = this.getFileIcon(fileInfo.file.extension);
                
                const info = fileItem.createDiv('em-file-info');
                info.createDiv({ cls: 'em-file-name', text: fileInfo.file.basename });
                info.createDiv({ cls: 'em-file-path', text: fileInfo.file.path });
                
                const time = fileItem.createDiv('em-file-time');
                time.textContent = this.formatRelativeTime(fileInfo.mtime);
            });
        } catch (error) {
            console.error('Error rendering recent files:', error);
            container.createDiv({ 
                cls: 'em-error', 
                text: '최근 파일을 불러오는 중 오류가 발생했습니다.' 
            });
        }
    }

    getRecentFiles() {
        const files = this.app.vault.getMarkdownFiles();
        const now = Date.now();
        
        return files
            .map(file => ({
                file: file,
                mtime: file.stat.mtime
            }))
            .filter(item => (now - item.mtime) < (30 * 24 * 60 * 60 * 1000)) // 30일 이내
            .sort((a, b) => b.mtime - a.mtime)
            .slice(0, 20); // 최근 20개만
    }

    getFileIcon(extension) {
        const icons = {
            'md': '📝',
            'txt': '📄',
            'pdf': '📋',
            'jpg': '🖼️',
            'png': '🖼️',
            'gif': '🖼️'
        };
        return icons[extension] || '📄';
    }

    formatRelativeTime(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / (1000 * 60));
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (minutes < 60) {
            return `${minutes}분 전`;
        } else if (hours < 24) {
            return `${hours}시간 전`;
        } else if (days < 30) {
            return `${days}일 전`;
        } else {
            return new Date(timestamp).toLocaleDateString('ko-KR');
        }
    }

    async openFile(file) {
        try {
            const leaf = this.app.workspace.getLeaf(false);
            await leaf.openFile(file);
        } catch (error) {
            console.error('Error opening file:', error);
            new Notice('파일을 열 수 없습니다.');
        }
    }

    renderSettingsTab(container) {
        container.empty();
        const settingsContainer = container.createDiv('em-settings-container');
        
        const section1 = settingsContainer.createDiv('em-settings-section');
        section1.createEl('h3', { text: '폴더 설정' });
        section1.createEl('button', { 
            cls: 'em-create-folders-btn',
            text: '📁 폴더 생성' 
        });

        const section2 = settingsContainer.createDiv('em-settings-section');
        section2.createEl('h3', { text: '노트 생성' });
        
        const noteButtons = section2.createDiv('em-note-buttons');
        noteButtons.createEl('button', { cls: 'em-create-note-btn', text: '📝 오늘 노트 생성', attr: { 'data-type': 'daily' } });
        noteButtons.createEl('button', { cls: 'em-create-note-btn', text: '📝 이번 주 노트 생성', attr: { 'data-type': 'weekly' } });
        noteButtons.createEl('button', { cls: 'em-create-note-btn', text: '📝 이번 달 노트 생성', attr: { 'data-type': 'monthly' } });

        const section3 = settingsContainer.createDiv('em-settings-section');
        section3.createEl('h3', { text: '데이터 관리' });
        
        const dataButtons = section3.createDiv('em-data-buttons');
        dataButtons.createEl('button', { cls: 'em-export-btn em-data-btn', text: '📤 데이터 내보내기' });
        dataButtons.createEl('button', { cls: 'em-import-btn em-data-btn', text: '📥 데이터 가져오기' });
        dataButtons.createEl('button', { cls: 'em-clear-btn em-data-btn', text: '🗑️ 모든 데이터 삭제' });
    }

    updateDateDisplay(container) {
        const now = new Date();
        const dateDisplay = container.createDiv('em-date-display');
        const dateSubtitle = container.createDiv('em-date-subtitle');
        
        dateDisplay.textContent = now.toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'long'
        });
        
        const week = Math.ceil(now.getDate() / 7);
        dateSubtitle.textContent = `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${week}주차`;
    }

    updateStats(container) {
        container.empty();
        const currentTasks = this.tasks[this.currentPeriod];
        
        let q1Count = 0, q1Completed = 0;
        let q2Count = 0, q2Completed = 0;
        let q3Count = 0, q3Completed = 0;
        let q4Count = 0, q4Completed = 0;
        
        // 각 분면의 할일과 완료 상태 계산
        ['q1', 'q2', 'q3', 'q4'].forEach(quadrant => {
            const tasks = currentTasks[quadrant] || [];
            const counts = this.getTaskCounts(tasks);
            
            if (quadrant === 'q1') {
                q1Count = counts.total;
                q1Completed = counts.completed;
            } else if (quadrant === 'q2') {
                q2Count = counts.total;
                q2Completed = counts.completed;
            } else if (quadrant === 'q3') {
                q3Count = counts.total;
                q3Completed = counts.completed;
            } else if (quadrant === 'q4') {
                q4Count = counts.total;
                q4Completed = counts.completed;
            }
        });
        
        const total = q1Count + q2Count + q3Count + q4Count;
        const totalCompleted = q1Completed + q2Completed + q3Completed + q4Completed;
        
        const statItems = container.createDiv('em-stat-items');
        
        this.createStatItem(statItems, '긴급&중요', `${q1Completed}/${q1Count}`, '#ff6b6b');
        this.createStatItem(statItems, '중요', `${q2Completed}/${q2Count}`, '#4ecdc4');
        this.createStatItem(statItems, '긴급', `${q3Completed}/${q3Count}`, '#45b7d1');
        this.createStatItem(statItems, '기타', `${q4Completed}/${q4Count}`, '#96ceb4');
        this.createStatItem(statItems, '전체', `${totalCompleted}/${total}`, '#666');
        
        // 진행률 표시
        if (total > 0) {
            const progressPercent = Math.round((totalCompleted / total) * 100);
            const progressContainer = container.createDiv('em-overall-progress');
            progressContainer.createDiv({ cls: 'em-progress-label', text: `전체 진행률: ${progressPercent}%` });
            
            const progressBar = progressContainer.createDiv('em-progress-bar');
            const progressFill = progressBar.createDiv('em-progress-fill');
            progressFill.style.width = `${progressPercent}%`;
            progressFill.style.backgroundColor = '#4ecdc4';
        }
    }

    getTaskCounts(tasks) {
        let total = tasks.length;
        let completed = 0;
        
        tasks.forEach(task => {
            if (typeof task === 'object' && task.completed) {
                completed++;
            }
        });
        
        return { total, completed };
    }

    createStatItem(container, label, count, color) {
        const item = container.createDiv('em-stat-item');
        const value = item.createDiv('em-stat-value');
        value.textContent = count.toString();
        value.style.color = color;
        item.createDiv({ cls: 'em-stat-label', text: label });
    }
    attachEventListeners() {
        console.log('Attaching event listeners...');
        
        const container = this.containerEl;
        
        container.addEventListener('click', (e) => {
            if (e.target.classList.contains('em-tab-btn')) {
                e.preventDefault();
                const tabName = e.target.dataset.tab;
                this.switchTab(tabName);
                return;
            }
            
            if (e.target.classList.contains('em-period-btn')) {
                e.preventDefault();
                const period = e.target.dataset.period;
                this.switchPeriod(period);
                return;
            }
            
            // 4분면 헤더 클릭 - 해당 노트로 이동
            if (e.target.classList.contains('em-quadrant-header') || e.target.closest('.em-quadrant-header')) {
                e.preventDefault();
                const quadrantEl = e.target.closest('.em-quadrant') || e.target.closest('.em-quadrant-header').parentElement;
                if (quadrantEl && quadrantEl.dataset.quadrant) {
                    const quadrant = quadrantEl.dataset.quadrant;
                    this.openQuadrantNote(quadrant);
                }
                return;
            }
            
            // 할일 추가 버튼
            if (e.target.classList.contains('em-add-task-btn')) {
                e.preventDefault();
                const quadrant = e.target.dataset.quadrant;
                this.showAddTaskModal(quadrant);
                return;
            }
            
            // em-quick-btn 클릭 시에만 할일 추가 (제거: 자동 할일 생성 방지)
            if (e.target.classList.contains('em-quick-btn') || e.target.closest('.em-quick-btn')) {
                e.preventDefault();
                const btn = e.target.closest('.em-quick-btn') || e.target;
                const quadrant = btn.dataset.quadrant;
                this.showAddTaskModal(quadrant);  // addTask 대신 showAddTaskModal 사용
                return;
            }
            
            // 4분면 이동 버튼
            if (e.target.classList.contains('em-btn-move')) {
                e.preventDefault();
                const quadrant = e.target.dataset.quadrant;
                const index = parseInt(e.target.dataset.index);
                this.showMoveTaskModal(quadrant, index);
                return;
            }
            
            // 편집 버튼
            if (e.target.classList.contains('em-btn-edit')) {
                e.preventDefault();
                const taskItem = e.target.closest('.em-task-item');
                const quadrant = taskItem.dataset.quadrant;
                const index = parseInt(taskItem.dataset.index);
                this.editTask(quadrant, index);
                return;
            }
            
            // 삭제 버튼
            if (e.target.classList.contains('em-btn-remove')) {
                e.preventDefault();
                const taskItem = e.target.closest('.em-task-item');
                const quadrant = taskItem.dataset.quadrant;
                const index = parseInt(taskItem.dataset.index);
                this.removeTask(quadrant, index);
                return;
            }
            
            if (e.target.classList.contains('em-create-folders-btn')) {
                e.preventDefault();
                this.createFolders();
                return;
            }
            
            if (e.target.classList.contains('em-create-note-btn')) {
                e.preventDefault();
                const type = e.target.getAttribute('data-type');
                if (type === 'daily') this.createDailyNote();
                else if (type === 'weekly') this.createWeeklyNote();
                else if (type === 'monthly') this.createMonthlyNote();
                return;
            }
            
            if (e.target.classList.contains('em-export-btn')) {
                e.preventDefault();
                this.exportData();
                return;
            }
            
            if (e.target.classList.contains('em-import-btn')) {
                e.preventDefault();
                this.importData();
                return;
            }
            
            if (e.target.classList.contains('em-clear-btn')) {
                e.preventDefault();
                this.clearAllData();
                return;
            }
            
            const completeBtn = e.target.closest('.em-btn-complete');
            if (completeBtn) {
                e.preventDefault();
                e.stopPropagation();
                const taskItem = completeBtn.closest('.em-task-item');
                if (taskItem) {
                    const quadrant = taskItem.dataset.quadrant;
                    const index = parseInt(taskItem.dataset.index);
                    this.completeTask(quadrant, index);
                }
                return;
            }
            
            const moveBtn = e.target.closest('.em-btn-move');
            if (moveBtn) {
                e.preventDefault();
                e.stopPropagation();
                const taskItem = moveBtn.closest('.em-task-item');
                if (taskItem) {
                    const quadrant = taskItem.dataset.quadrant;
                    const index = parseInt(taskItem.dataset.index);
                    this.showMoveModal(quadrant, index);
                }
                return;
            }
            
            const removeBtn = e.target.closest('.em-btn-remove');
            if (removeBtn) {
                e.preventDefault();
                e.stopPropagation();
                const taskItem = removeBtn.closest('.em-task-item');
                if (taskItem) {
                    const quadrant = taskItem.dataset.quadrant;
                    const index = parseInt(taskItem.dataset.index);
                    this.removeTask(quadrant, index);
                }
                return;
            }
        });

        container.addEventListener('dblclick', (e) => {
            const taskItem = e.target.closest('.em-task-item');
            if (taskItem) {
                const quadrant = taskItem.dataset.quadrant;
                const index = parseInt(taskItem.dataset.index);
                const task = this.tasks[this.currentPeriod][quadrant][index];
                this.openTaskNote(task, quadrant);
            }
        });
        
        // 체크박스 변경 이벤트
        container.addEventListener('change', (e) => {
            if (e.target.classList.contains('em-task-checkbox')) {
                const taskItem = e.target.closest('.em-task-item');
                const quadrant = taskItem.dataset.quadrant;
                const index = parseInt(taskItem.dataset.index);
                this.toggleTaskComplete(quadrant, index, e.target.checked);
            }
        });
        
        // 드래그 앤 드롭 이벤트
        container.addEventListener('dragstart', (e) => {
            if (e.target.classList.contains('em-task-item')) {
                e.dataTransfer.setData('text/plain', JSON.stringify({
                    quadrant: e.target.dataset.quadrant,
                    index: parseInt(e.target.dataset.index)
                }));
                e.target.style.opacity = '0.5';
            }
        });
        
        container.addEventListener('dragend', (e) => {
            if (e.target.classList.contains('em-task-item')) {
                e.target.style.opacity = '1';
            }
        });
        
        container.addEventListener('dragover', (e) => {
            e.preventDefault();
            const quadrant = e.target.closest('.em-quadrant');
            if (quadrant) {
                quadrant.classList.add('em-drag-over');
            }
        });
        
        container.addEventListener('dragleave', (e) => {
            const quadrant = e.target.closest('.em-quadrant');
            if (quadrant && !quadrant.contains(e.relatedTarget)) {
                quadrant.classList.remove('em-drag-over');
            }
        });
        
        container.addEventListener('drop', (e) => {
            e.preventDefault();
            const targetQuadrant = e.target.closest('.em-quadrant');
            if (targetQuadrant) {
                targetQuadrant.classList.remove('em-drag-over');
                const dragData = JSON.parse(e.dataTransfer.getData('text/plain'));
                const targetQuadrantId = targetQuadrant.dataset.quadrant;
                
                if (dragData.quadrant !== targetQuadrantId) {
                    this.moveTaskToQuadrant(dragData.quadrant, dragData.index, targetQuadrantId);
                }
            }
        });

        const taskInput = container.querySelector('#em-taskInput');
        if (taskInput) {
            taskInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && e.target.value.trim()) {
                    e.preventDefault();
                    this.addTask('q2');
                }
            });
        }
    }

    switchTab(tabName) {
        this.currentTab = tabName;
        const container = this.containerEl;
        
        container.querySelectorAll('.em-tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        container.querySelectorAll('.em-tab-content').forEach(content => {
            content.classList.remove('active');
            content.style.display = 'none';
        });

        const selectedBtn = container.querySelector(`[data-tab="${tabName}"]`);
        if (selectedBtn) {
            selectedBtn.classList.add('active');
        }
        
        const selectedContent = container.querySelector(`[data-content="${tabName}"]`);
        if (selectedContent) {
            selectedContent.classList.add('active');
            selectedContent.style.display = 'block';
            
            if (tabName === 'timeline') {
                this.renderTimelineTab(selectedContent);
            } else if (tabName === 'settings') {
                this.renderSettingsTab(selectedContent);
            }
        }
    }

    switchPeriod(period) {
        this.currentPeriod = period;
        this.shouldRerender = true; // 기간 변경 시 재렌더링 필요
        
        const container = this.containerEl;
        
        container.querySelectorAll('.em-period-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.period === period) {
                btn.classList.add('active');
            }
        });
        
        const matrixGrid = container.querySelector('.em-matrix-grid');
        if (matrixGrid) {
            this.renderMatrix(matrixGrid);
        }
        
        const stats = container.querySelector('.em-stats');
        if (stats) {
            this.updateStats(stats);
        }
    }

    addTask(quadrant) {
        const container = this.containerEl;
        const taskInput = container.querySelector('#em-taskInput');
        
        let taskText = '새 할일';
        if (taskInput && taskInput.value.trim()) {
            taskText = taskInput.value.trim();
            taskInput.value = '';
        }
        
        if (!this.tasks[this.currentPeriod][quadrant]) {
            this.tasks[this.currentPeriod][quadrant] = [];
        }
        
        this.tasks[this.currentPeriod][quadrant].push(taskText);
        this.saveToStorage();
        this.addTaskToNote(quadrant, taskText);
        
        const matrixGrid = container.querySelector('.em-matrix-grid');
        if (matrixGrid) {
            this.renderMatrix(matrixGrid);
        }
        
        const stats = container.querySelector('.em-stats');
        if (stats) {
            this.updateStats(stats);
        }
        
        new Notice(`할일이 추가되었습니다: ${taskText}`);
    }

    completeTask(quadrant, index) {
        if (this.tasks[this.currentPeriod][quadrant] && this.tasks[this.currentPeriod][quadrant][index]) {
            const task = this.tasks[this.currentPeriod][quadrant][index];
            this.tasks[this.currentPeriod][quadrant].splice(index, 1);
            this.saveToStorage();
            this.markTaskAsCompleted(quadrant, task);
            
            const matrixGrid = this.containerEl.querySelector('.em-matrix-grid');
            if (matrixGrid) {
                this.renderMatrix(matrixGrid);
            }
            
            const stats = this.containerEl.querySelector('.em-stats');
            if (stats) {
                this.updateStats(stats);
            }
            
            new Notice(`완료: ${task}`);
        }
    }

    removeTask(quadrant, index) {
        if (this.tasks[this.currentPeriod][quadrant] && this.tasks[this.currentPeriod][quadrant][index]) {
            const task = this.tasks[this.currentPeriod][quadrant][index];
            
            if (confirm(`"${task}"를 삭제하시겠습니까?`)) {
                this.tasks[this.currentPeriod][quadrant].splice(index, 1);
                this.saveToStorage();
                this.removeTaskFromNote(quadrant, task);
                
                const matrixGrid = this.containerEl.querySelector('.em-matrix-grid');
                if (matrixGrid) {
                    this.renderMatrix(matrixGrid);
                }
                
                const stats = this.containerEl.querySelector('.em-stats');
                if (stats) {
                    this.updateStats(stats);
                }
                
                new Notice(`삭제됨: ${task}`);
            }
        }
    }

    showMoveModal(fromQuadrant, index) {
        const task = this.tasks[this.currentPeriod][fromQuadrant][index];
        
        new TaskMoveModal(this.app, (toQuadrant) => {
            if (fromQuadrant === toQuadrant) {
                new Notice('같은 사분면으로는 이동할 수 없습니다.');
                return;
            }
            
            this.tasks[this.currentPeriod][fromQuadrant].splice(index, 1);
            
            if (!this.tasks[this.currentPeriod][toQuadrant]) {
                this.tasks[this.currentPeriod][toQuadrant] = [];
            }
            this.tasks[this.currentPeriod][toQuadrant].push(task);
            
            this.saveToStorage();
            
            const matrixGrid = this.containerEl.querySelector('.em-matrix-grid');
            if (matrixGrid) {
                this.renderMatrix(matrixGrid);
            }
            
            const stats = this.containerEl.querySelector('.em-stats');
            if (stats) {
                this.updateStats(stats);
            }
            
            new Notice(`"${task}"을(를) 이동했습니다`);
        }).open();
    }

    // Periodic Notes 플러그인 연동 체크
    checkPeriodicNotesPlugin() {
        const periodicNotes = this.app.plugins.plugins['periodic-notes'];
        return periodicNotes && periodicNotes.enabled;
    }

    // Periodic Notes에서 파일 경로 가져오기
    getPeriodicNoteFile() {
        try {
            const periodicNotes = this.app.plugins.plugins['periodic-notes'];
            if (!periodicNotes) return null;

            const now = new Date();
            
            if (this.currentPeriod === 'daily' && periodicNotes.settings?.daily?.enabled) {
                return periodicNotes.getDailyNote(now);
            } else if (this.currentPeriod === 'weekly' && periodicNotes.settings?.weekly?.enabled) {
                return periodicNotes.getWeeklyNote(now);
            } else if (this.currentPeriod === 'monthly' && periodicNotes.settings?.monthly?.enabled) {
                return periodicNotes.getMonthlyNote(now);
            }
        } catch (error) {
            console.log('Periodic Notes 플러그인을 사용할 수 없습니다:', error);
        }
        return null;
    }

    getFileName() {
        // Periodic Notes 연동이 활성화되어 있으면 해당 파일 사용
        if (this.plugin.settings.usePeriodicNotes && this.checkPeriodicNotesPlugin()) {
            const periodicFile = this.getPeriodicNoteFile();
            if (periodicFile) {
                return periodicFile.path;
            }
        }

        // 기본 파일 경로 사용
        const settings = this.plugin.settings;
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const week = Math.ceil(now.getDate() / 7);

        const paths = {
            daily: `${settings.mainFolder}/${settings.dailyFolder}/${year}-${month}-${day}.${settings.fileFormat}`,
            weekly: `${settings.mainFolder}/${settings.weeklyFolder}/${year}-W${String(week).padStart(2, '0')}.${settings.fileFormat}`,
            monthly: `${settings.mainFolder}/${settings.monthlyFolder}/${year}-${month}.${settings.fileFormat}`,
            yearly: `${settings.mainFolder}/${settings.yearlyFolder}/${year}.${settings.fileFormat}`
        };

        return paths[this.currentPeriod];
    }

    getQuadrantFileName(quadrant) {
        const settings = this.plugin.settings;
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const week = Math.ceil(now.getDate() / 7);

        const quadrantName = this.getQuadrantName(quadrant);
        
        const paths = {
            daily: `${settings.mainFolder}/${settings.dailyFolder}/${year}-${month}-${day}-${quadrant}-${quadrantName}.${settings.fileFormat}`,
            weekly: `${settings.mainFolder}/${settings.weeklyFolder}/${year}-W${String(week).padStart(2, '0')}-${quadrant}-${quadrantName}.${settings.fileFormat}`,
            monthly: `${settings.mainFolder}/${settings.monthlyFolder}/${year}-${month}-${quadrant}-${quadrantName}.${settings.fileFormat}`,
            yearly: `${settings.mainFolder}/${settings.yearlyFolder}/${year}-${quadrant}-${quadrantName}.${settings.fileFormat}`
        };

        return paths[this.currentPeriod];
    }

    getQuadrantName(quadrant) {
        const names = {
            q1: '긴급중요',
            q2: '중요비긴급', 
            q3: '긴급비중요',
            q4: '일반'
        };
        return names[quadrant] || quadrant;
    }

    getQuadrantNoteTemplate(quadrant) {
        const quadrantName = this.getQuadrantName(quadrant);
        const today = new Date().toISOString().split('T')[0];
        
        return `# ${quadrantName} 영역

> 생성일: ${today}
> 분류: ${quadrant}

## 📋 할일 목록

## 📝 메모

## 🎯 목표

## ✅ 완료된 작업

---
*이 노트는 Eisenhower Matrix에서 자동 생성되었습니다.*`;
    }

    async getNoteTemplate(noteType = 'daily') {
        // 템플릿 사용이 비활성화되어 있으면 기본 템플릿 반환
        if (!this.plugin.settings.useTemplate) {
            return this.getDefaultTemplate();
        }

        // 템플릿 파일명 결정
        let templateFileName;
        switch (noteType) {
            case 'daily':
                templateFileName = this.plugin.settings.dailyTemplate;
                break;
            case 'weekly':
                templateFileName = this.plugin.settings.weeklyTemplate;
                break;
            case 'monthly':
                templateFileName = this.plugin.settings.monthlyTemplate;
                break;
            default:
                templateFileName = this.plugin.settings.dailyTemplate;
        }

        // 템플릿 파일 경로
        const templatePath = `${this.plugin.settings.templateFolder}/${templateFileName}`;

        try {
            // 템플릿 파일이 존재하는지 확인
            if (await this.app.vault.adapter.exists(templatePath)) {
                const templateFile = this.app.vault.getAbstractFileByPath(templatePath);
                if (templateFile) {
                    const templateContent = await this.app.vault.read(templateFile);
                    // 템플릿 변수 치환
                    return this.processTemplateVariables(templateContent);
                }
            } else {
                new Notice(`⚠️ 템플릿 파일을 찾을 수 없습니다: ${templatePath}`);
                console.log(`Template file not found: ${templatePath}`);
            }
        } catch (error) {
            console.error('Error reading template file:', error);
            new Notice('❌ 템플릿 파일 읽기 실패, 기본 템플릿을 사용합니다.');
        }

        // 템플릿 파일을 찾을 수 없거나 오류가 발생한 경우 기본 템플릿 사용
        return this.getDefaultTemplate();
    }

    processTemplateVariables(templateContent) {
        const now = new Date();
        const dateStr = now.toLocaleDateString('ko-KR', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            weekday: 'long'
        });
        
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const week = Math.ceil((now.getDate() + new Date(year, now.getMonth(), 1).getDay()) / 7);

        // 템플릿 변수 치환
        return templateContent
            .replace(/\{\{date\}\}/g, dateStr)
            .replace(/\{\{year\}\}/g, year)
            .replace(/\{\{month\}\}/g, month)
            .replace(/\{\{day\}\}/g, day)
            .replace(/\{\{week\}\}/g, week)
            .replace(/\{\{time\}\}/g, now.toLocaleTimeString('ko-KR'))
            .replace(/\{\{datetime\}\}/g, now.toLocaleString('ko-KR'));
    }

    getDefaultTemplate() {
        const now = new Date();
        const dateStr = now.toLocaleDateString('ko-KR', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            weekday: 'long'
        });

        return `---
title: "Eisenhower Matrix - ${dateStr}"
type: "eisenhower-matrix"
tags:
  - eisenhower-matrix
  - productivity
created: ${now.toISOString()}
---

# 🎯 Eisenhower Matrix - ${dateStr}

## 📊 아이젠하워 매트릭스

### 🔥 중요하고 긴급함 (Do)
> 지금 당장 해야 할 일


### 📅 중요하지만 긴급하지 않음 (Schedule)
> 계획하고 스케줄링해야 할 일


### 👥 긴급하지만 중요하지 않음 (Delegate)
> 위임하거나 최소화해야 할 일


### 🗑️ 중요하지도 긴급하지도 않음 (Delete)
> 제거하거나 최소화해야 할 일


---

## 📝 메모

## ✅ 완료한 일

## 🎯 내일의 목표
`;
    }

    async addTaskToNote(quadrant, taskText) {
        try {
            const fileName = this.getFileName();
            if (!fileName) return;

            const quadrantNames = {
                q1: '🔥 중요하고 긴급함 (Do)',
                q2: '📅 중요하지만 긴급하지 않음 (Schedule)',
                q3: '👥 긴급하지만 중요하지 않음 (Delegate)',
                q4: '🗑️ 중요하지도 긴급하지도 않음 (Delete)'
            };

            if (!await this.app.vault.adapter.exists(fileName)) {
                const folderPath = fileName.substring(0, fileName.lastIndexOf('/'));
                if (!await this.app.vault.adapter.exists(folderPath)) {
                    await this.app.vault.createFolder(folderPath);
                }
                const template = await this.getNoteTemplate(this.currentPeriod);
                await this.app.vault.create(fileName, template);
            }

            const file = this.app.vault.getAbstractFileByPath(fileName);
            if (!file) {
                console.error(`파일을 찾을 수 없습니다: ${fileName}`);
                new Notice(`❌ 파일을 찾을 수 없습니다: ${fileName}`);
                return;
            }

            try {
                let content = await this.app.vault.read(file);
                const sectionHeader = `### ${quadrantNames[quadrant]}`;
                const sectionIndex = content.indexOf(sectionHeader);

                if (sectionIndex !== -1) {
                    const afterHeader = content.indexOf('\n', sectionIndex) + 1;
                    let insertPoint = afterHeader;
                    
                    const lines = content.substring(afterHeader).split('\n');
                    for (let i = 0; i < lines.length; i++) {
                        if (lines[i].trim().startsWith('>')) {
                            insertPoint = afterHeader + lines.slice(0, i + 1).join('\n').length + 1;
                        } else if (lines[i].trim() === '') {
                            continue;
                        } else {
                            break;
                        }
                    }

                    const newTask = `- [ ] ${taskText}\n`;
                    content = content.substring(0, insertPoint) + newTask + content.substring(insertPoint);

                    await this.app.vault.modify(file, content);
                }
            } catch (error) {
                console.error('Error reading file:', error);
                new Notice(`❌ 파일 읽기 오류: ${error.message}`);
            }
        } catch (error) {
            console.error('Error adding task to note:', error);
            new Notice(`❌ 할일 추가 오류: ${error.message}`);
        }
    }

    async markTaskAsCompleted(quadrant, taskText) {
        try {
            const fileName = this.getFileName();
            if (!fileName) {
                console.warn('파일명을 가져올 수 없습니다.');
                return;
            }

            // 파일 존재 여부 확인
            if (!await this.app.vault.adapter.exists(fileName)) {
                console.warn(`파일이 존재하지 않습니다: ${fileName}`);
                return;
            }

            const file = this.app.vault.getAbstractFileByPath(fileName);
            if (!file) {
                console.warn(`파일 객체를 가져올 수 없습니다: ${fileName}`);
                return;
            }

            let content = await this.app.vault.read(file);
            
            const uncheckedPattern = `- [ ] ${taskText}`;
            const checkedPattern = `- [x] ${taskText}`;
            
            if (content.includes(uncheckedPattern)) {
                content = content.replace(uncheckedPattern, checkedPattern);
                await this.app.vault.modify(file, content);
                new Notice(`노트에서 체크됨: ${taskText}`);
            }
        } catch (error) {
            console.error('Error marking task as completed:', error);
            new Notice('❌ 할일 완료 처리 중 오류가 발생했습니다.');
        }
    }
    }

    }

    async removeTaskFromNote(quadrant, taskText) {
        try {
            const fileName = this.getFileName();
            if (!fileName) {
                console.warn('파일명을 가져올 수 없습니다.');
                return;
            }

            // 파일 존재 여부 확인
            if (!await this.app.vault.adapter.exists(fileName)) {
                console.warn(`파일이 존재하지 않습니다: ${fileName}`);
                return;
            }

            const file = this.app.vault.getAbstractFileByPath(fileName);
            if (!file) {
                console.warn(`파일 객체를 가져올 수 없습니다: ${fileName}`);
                return;
            }

            let content = await this.app.vault.read(file);
            const lines = content.split('\n');
            
            const filtered = lines.filter(line => {
                const trimmed = line.trim();
                return trimmed !== `- [ ] ${taskText}` && trimmed !== `- [x] ${taskText}`;
            });
            
            content = filtered.join('\n');
            await this.app.vault.modify(file, content);
        } catch (error) {
            console.error('Error removing task from note:', error);
            new Notice('❌ 할일 삭제 중 오류가 발생했습니다.');
        }
    }

    async openTaskNote(taskText, quadrant) {
        const fileName = this.getFileName();
        if (!fileName) {
            new Notice('파일 경로를 찾을 수 없습니다.');
            return;
        }

        try {
            if (!await this.app.vault.adapter.exists(fileName)) {
                const folderPath = fileName.substring(0, fileName.lastIndexOf('/'));
                if (!await this.app.vault.adapter.exists(folderPath)) {
                    await this.app.vault.createFolder(folderPath);
                }
                const template = this.getNoteTemplate();
                await this.app.vault.create(fileName, template);
            }

            const file = this.app.vault.getAbstractFileByPath(fileName);
            if (file) {
                const leaf = this.app.workspace.getLeaf(false);
                await leaf.openFile(file);
                new Notice(`노트를 열었습니다: ${file.basename}`);
            } else {
                new Notice('파일을 찾을 수 없습니다.');
            }
        } catch (error) {
            console.error('Error opening task note:', error);
            new Notice('노트를 여는 중 오류가 발생했습니다.');
        }
    }

    async openQuadrantNote(quadrant) {
        const fileName = this.getQuadrantFileName(quadrant);
        if (!fileName) {
            new Notice('파일 경로를 찾을 수 없습니다.');
            return;
        }

        try {
            if (!await this.app.vault.adapter.exists(fileName)) {
                const folderPath = fileName.substring(0, fileName.lastIndexOf('/'));
                if (!await this.app.vault.adapter.exists(folderPath)) {
                    await this.app.vault.createFolder(folderPath);
                }
                const template = this.getQuadrantNoteTemplate(quadrant);
                await this.app.vault.create(fileName, template);
            }

            const file = this.app.vault.getAbstractFileByPath(fileName);
            if (file) {
                const leaf = this.app.workspace.getLeaf(false);
                await leaf.openFile(file);
                new Notice(`${this.getQuadrantName(quadrant)} 노트를 열었습니다.`);
            } else {
                new Notice('파일을 찾을 수 없습니다.');
            }
        } catch (error) {
            console.error('Error opening quadrant note:', error);
            new Notice('노트를 여는 중 오류가 발생했습니다.');
        }
    }

    async createFolders() {
        try {
            const folders = [
                this.plugin.settings.mainFolder,
                `${this.plugin.settings.mainFolder}/${this.plugin.settings.dailyFolder}`,
                `${this.plugin.settings.mainFolder}/${this.plugin.settings.weeklyFolder}`,
                `${this.plugin.settings.mainFolder}/${this.plugin.settings.monthlyFolder}`,
                `${this.plugin.settings.mainFolder}/${this.plugin.settings.yearlyFolder}`
            ];
            
            for (const folder of folders) {
                if (!await this.app.vault.adapter.exists(folder)) {
                    await this.app.vault.createFolder(folder);
                }
            }
            
            new Notice('✅ 폴더가 생성되었습니다.');
        } catch (error) {
            console.error('Error creating folders:', error);
            new Notice('❌ 폴더 생성에 실패했습니다.');
        }
    }

    async createDailyNote() {
        // Periodic Notes 연동이 활성화되어 있으면 해당 플러그인 사용
        if (this.plugin.settings.usePeriodicNotes && this.checkPeriodicNotesPlugin()) {
            try {
                const periodicNotes = this.app.plugins.plugins['periodic-notes'];
                if (periodicNotes && periodicNotes.createDailyNote) {
                    await periodicNotes.createDailyNote();
                    new Notice('✅ Periodic Notes를 통해 일간 노트가 생성되었습니다.');
                    return;
                }
            } catch (error) {
                console.log('Periodic Notes 사용 실패, 기본 방식으로 전환:', error);
            }
        }

        // 기본 노트 생성
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const fileName = `${this.plugin.settings.mainFolder}/${this.plugin.settings.dailyFolder}/${dateStr}.${this.plugin.settings.fileFormat}`;
        
        const content = await this.getNoteTemplate('daily');
        
        try {
            let file;
            if (!await this.app.vault.adapter.exists(fileName)) {
                const folderPath = fileName.substring(0, fileName.lastIndexOf('/'));
                if (!await this.app.vault.adapter.exists(folderPath)) {
                    await this.app.vault.createFolder(folderPath);
                }
                file = await this.app.vault.create(fileName, content);
                new Notice('✅ 일간 노트가 생성되었습니다.');
            } else {
                file = this.app.vault.getAbstractFileByPath(fileName);
                new Notice('ℹ️ 일간 노트가 이미 존재합니다.');
            }
            
            if (file) {
                const leaf = this.app.workspace.getLeaf(false);
                await leaf.openFile(file);
            }
        } catch (error) {
            console.error('Error creating daily note:', error);
            new Notice('❌ 일간 노트 생성에 실패했습니다.');
        }
    }

    async createWeeklyNote() {
        // Periodic Notes 연동
        if (this.plugin.settings.usePeriodicNotes && this.checkPeriodicNotesPlugin()) {
            try {
                const periodicNotes = this.app.plugins.plugins['periodic-notes'];
                if (periodicNotes && periodicNotes.createWeeklyNote) {
                    await periodicNotes.createWeeklyNote();
                    new Notice('✅ Periodic Notes를 통해 주간 노트가 생성되었습니다.');
                    return;
                }
            } catch (error) {
                console.log('Periodic Notes 사용 실패, 기본 방식으로 전환:', error);
            }
        }

        const now = new Date();
        const year = now.getFullYear();
        const week = Math.ceil((now.getDate() + new Date(year, now.getMonth(), 1).getDay()) / 7);
        const fileName = `${this.plugin.settings.mainFolder}/${this.plugin.settings.weeklyFolder}/${year}-W${String(week).padStart(2, '0')}.${this.plugin.settings.fileFormat}`;
        
        const content = await this.getNoteTemplate('weekly');
        
        try {
            let file;
            if (!await this.app.vault.adapter.exists(fileName)) {
                const folderPath = fileName.substring(0, fileName.lastIndexOf('/'));
                if (!await this.app.vault.adapter.exists(folderPath)) {
                    await this.app.vault.createFolder(folderPath);
                }
                file = await this.app.vault.create(fileName, content);
                new Notice('✅ 주간 노트가 생성되었습니다.');
            } else {
                file = this.app.vault.getAbstractFileByPath(fileName);
                new Notice('ℹ️ 주간 노트가 이미 존재합니다.');
            }
            
            if (file) {
                const leaf = this.app.workspace.getLeaf(false);
                await leaf.openFile(file);
            }
        } catch (error) {
            console.error('Error creating weekly note:', error);
            new Notice('❌ 주간 노트 생성에 실패했습니다.');
        }
    }

    async createMonthlyNote() {
        // Periodic Notes 연동
        if (this.plugin.settings.usePeriodicNotes && this.checkPeriodicNotesPlugin()) {
            try {
                const periodicNotes = this.app.plugins.plugins['periodic-notes'];
                if (periodicNotes && periodicNotes.createMonthlyNote) {
                    await periodicNotes.createMonthlyNote();
                    new Notice('✅ Periodic Notes를 통해 월간 노트가 생성되었습니다.');
                    return;
                }
            } catch (error) {
                console.log('Periodic Notes 사용 실패, 기본 방식으로 전환:', error);
            }
        }

        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const fileName = `${this.plugin.settings.mainFolder}/${this.plugin.settings.monthlyFolder}/${year}-${month}.${this.plugin.settings.fileFormat}`;
        
        const content = await this.getNoteTemplate('monthly');
        
        try {
            let file;
            if (!await this.app.vault.adapter.exists(fileName)) {
                const folderPath = fileName.substring(0, fileName.lastIndexOf('/'));
                if (!await this.app.vault.adapter.exists(folderPath)) {
                    await this.app.vault.createFolder(folderPath);
                }
                file = await this.app.vault.create(fileName, content);
                new Notice('✅ 월간 노트가 생성되었습니다.');
            } else {
                file = this.app.vault.getAbstractFileByPath(fileName);
                new Notice('ℹ️ 월간 노트가 이미 존재합니다.');
            }
            
            if (file) {
                const leaf = this.app.workspace.getLeaf(false);
                await leaf.openFile(file);
            }
        } catch (error) {
            console.error('Error creating monthly note:', error);
            new Notice('❌ 월간 노트 생성에 실패했습니다.');
        }
    }

    exportData() {
        const data = {
            tasks: this.tasks,
            settings: this.plugin.settings,
            exportDate: new Date().toISOString()
        };
        
        const dataStr = JSON.stringify(data, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `eisenhower-matrix-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        new Notice('✅ 데이터가 내보내기되었습니다.');
    }

    importData() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    if (data.tasks) {
                        this.tasks = data.tasks;
                        this.saveToStorage();
                    }
                    if (data.settings) {
                        Object.assign(this.plugin.settings, data.settings);
                        this.plugin.saveSettings();
                    }
                    this.render();
                    new Notice('✅ 데이터가 가져와졌습니다.');
                } catch (error) {
                    console.error('Error importing:', error);
                    new Notice('❌ 잘못된 파일 형식입니다.');
                }
            };
            reader.readAsText(file);
        };
        
        document.body.appendChild(input);
        input.click();
        document.body.removeChild(input);
    }

    clearAllData() {
        if (confirm('⚠️ 모든 데이터를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
            this.tasks = {
                daily: { q1: [], q2: [], q3: [], q4: [] },
                weekly: { q1: [], q2: [], q3: [], q4: [] },
                monthly: { q1: [], q2: [], q3: [], q4: [] },
                yearly: { q1: [], q2: [], q3: [], q4: [] }
            };
            this.saveToStorage();
            this.render();
            new Notice('🗑️ 모든 데이터가 삭제되었습니다.');
        }
    }
    addStyles() {
        if (document.querySelector('#eisenhower-matrix-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'eisenhower-matrix-styles';
        style.textContent = `
        .eisenhower-matrix-container {
            padding: 20px;
            max-width: 1200px;
            margin: 0 auto;
            height: 100%;
            overflow-y: auto;
        }
        
        .em-header {
            text-align: center;
            margin-bottom: 30px;
        }
        
        .em-header h1 {
            font-size: 32px;
            margin: 0 0 10px 0;
            color: var(--text-normal);
        }
        
        .em-header p {
            color: var(--text-muted);
            margin: 0;
        }
        
        .em-date-header {
            text-align: center;
            margin-bottom: 20px;
            padding: 15px;
            background: var(--background-primary-alt);
            border-radius: 8px;
            border: 1px solid var(--background-modifier-border);
        }
        
        .em-date-display {
            font-size: 18px;
            font-weight: bold;
            color: var(--text-normal);
            margin-bottom: 5px;
        }
        
        .em-date-subtitle {
            font-size: 12px;
            color: var(--text-muted);
        }
        
        .em-tab-buttons {
            display: flex;
            gap: 10px;
            margin-bottom: 20px;
            border-bottom: 1px solid var(--background-modifier-border);
        }
        
        .em-tab-btn {
            padding: 12px 20px;
            border: none;
            background: var(--background-secondary);
            color: var(--text-normal);
            cursor: pointer;
            border-radius: 6px 6px 0 0;
            font-weight: 500;
            transition: all 0.2s ease;
        }
        
        .em-tab-btn:hover {
            background: var(--background-modifier-hover);
            transform: translateY(-1px);
        }
        
        .em-tab-btn.active {
            background: var(--interactive-accent);
            color: var(--text-on-accent);
        }
        
        .em-tab-content {
            padding: 20px;
            border: 1px solid var(--background-modifier-border);
            border-radius: 0 6px 6px 6px;
            background: var(--background-primary);
        }
        
        .em-period-selector {
            display: flex;
            gap: 10px;
            margin-bottom: 20px;
            justify-content: center;
            flex-wrap: wrap;
        }
        
        .em-period-btn {
            padding: 10px 20px;
            border: 2px solid var(--background-modifier-border);
            background: var(--background-primary);
            color: var(--text-normal);
            cursor: pointer;
            border-radius: 6px;
            font-weight: 500;
            transition: all 0.2s ease;
        }
        
        .em-period-btn:hover {
            background: var(--background-modifier-hover);
            border-color: var(--interactive-accent);
            transform: scale(1.05);
        }
        
        .em-period-btn.active {
            background: var(--interactive-accent);
            color: var(--text-on-accent);
            border-color: var(--interactive-accent);
        }
        
        .em-input-section {
            margin-bottom: 20px;
            padding: 20px;
            background: var(--background-primary-alt);
            border-radius: 10px;
            border: 1px solid var(--background-modifier-border);
        }
        
        .em-task-input {
            width: 100%;
            padding: 12px;
            border: 1px solid var(--background-modifier-border);
            border-radius: 8px;
            background: var(--background-primary);
            color: var(--text-normal);
            font-size: 14px;
            margin-bottom: 15px;
            box-sizing: border-box;
        }
        
        .em-task-input:focus {
            outline: none;
            border-color: var(--interactive-accent);
        }
        
        .em-quick-actions {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
        }
        
        .em-quick-btn {
            padding: 20px;
            border: 2px solid var(--background-modifier-border);
            background: var(--background-primary);
            color: var(--text-normal);
            cursor: pointer;
            border-radius: 8px;
            text-align: center;
            transition: all 0.3s ease;
            min-height: 100px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
        }
        
        .em-quick-btn:hover {
            transform: translateY(-3px);
            box-shadow: 0 6px 20px rgba(0,0,0,0.1);
            border-color: var(--interactive-accent);
        }
        
        .em-btn-icon {
            font-size: 24px;
            margin-bottom: 8px;
        }
        
        .em-btn-label {
            font-size: 12px;
            opacity: 0.8;
            margin-top: 5px;
        }
        
        .em-matrix-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .em-quadrant {
            border: 2px solid var(--background-modifier-border);
            border-radius: 8px;
            padding: 20px;
            background: var(--background-primary);
            min-height: 300px;
        }
        
        .em-quadrant-header {
            margin-bottom: 15px;
            border-bottom: 1px solid var(--background-modifier-border);
            padding-bottom: 10px;
        }
        
        .em-quadrant-title {
            font-weight: bold;
            font-size: 16px;
            margin-bottom: 5px;
        }
        
        .em-quadrant-subtitle {
            font-size: 12px;
            opacity: 0.7;
        }
        
        .em-task-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        
        .em-task-item {
            padding: 10px;
            background: var(--background-secondary);
            border-radius: 6px;
            border: 1px solid var(--background-modifier-border);
            display: flex;
            justify-content: space-between;
            align-items: center;
            transition: all 0.2s ease;
            cursor: pointer;
        }
        
        .em-task-item:hover {
            background: var(--background-modifier-hover);
            transform: translateX(3px);
        }
        
        .em-task-text {
            flex: 1;
            margin-right: 10px;
        }
        
        .em-task-actions {
            display: flex;
            gap: 5px;
        }
        
        .em-task-actions button {
            padding: 4px 8px;
            border: 1px solid var(--background-modifier-border);
            background: var(--background-primary);
            color: var(--text-normal);
            cursor: pointer;
            border-radius: 4px;
            font-size: 12px;
            transition: all 0.2s ease;
        }
        
        .em-task-actions button:hover {
            background: var(--background-modifier-hover);
        }
        
        .em-btn-complete:hover {
            background: #51cf66 !important;
            color: white !important;
        }
        
        .em-btn-move:hover {
            background: #339af0 !important;
            color: white !important;
        }
        
        .em-btn-remove:hover {
            background: #ff6b6b !important;
            color: white !important;
        }
        
        .em-empty-state {
            text-align: center;
            color: var(--text-muted);
            font-style: italic;
            padding: 20px;
            border: 2px dashed var(--background-modifier-border);
            border-radius: 8px;
        }
        
        .em-stats {
            background: var(--background-secondary);
            border-radius: 8px;
            padding: 20px;
            border: 1px solid var(--background-modifier-border);
        }
        
        .em-stat-items {
            display: flex;
            justify-content: space-around;
            gap: 20px;
            flex-wrap: wrap;
        }
        
        .em-stat-item {
            text-align: center;
            min-width: 80px;
        }
        
        .em-stat-value {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 5px;
        }
        
        .em-stat-label {
            font-size: 12px;
            color: var(--text-muted);
        }
        
        .em-settings-container {
            max-height: 60vh;
            overflow-y: auto;
        }
        
        .em-settings-section {
            margin-bottom: 30px;
            padding: 20px;
            border: 1px solid var(--background-modifier-border);
            border-radius: 8px;
            background: var(--background-primary-alt);
        }
        
        .em-settings-section h3 {
            margin: 0 0 15px 0;
            color: var(--text-normal);
        }
        
        .em-create-folders-btn,
        .em-create-note-btn,
        .em-data-btn {
            padding: 10px 16px;
            border: 1px solid var(--interactive-accent);
            background: var(--interactive-accent);
            color: var(--text-on-accent);
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.2s ease;
            margin-right: 10px;
            margin-bottom: 10px;
        }
        
        .em-create-folders-btn:hover,
        .em-create-note-btn:hover,
        .em-data-btn:hover {
            background: var(--interactive-accent-hover);
            transform: translateY(-1px);
        }
        
        .em-clear-btn {
            background: var(--text-error) !important;
            border-color: var(--text-error) !important;
        }
        
        .em-clear-btn:hover {
            background: #c00 !important;
        }
        
        .em-note-buttons,
        .em-data-buttons {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
        }
        
        .em-timeline-grid {
            min-height: 300px;
            padding: 20px;
            background: var(--background-primary-alt);
            border-radius: 8px;
            border: 1px solid var(--background-modifier-border);
        }
        
        .em-timeline-item {
            margin-bottom: 15px;
            padding: 15px;
            background: var(--background-primary);
            border-radius: 8px;
            border-left: 4px solid var(--interactive-accent);
        }
        
        .em-timeline-period {
            font-size: 12px;
            color: var(--interactive-accent);
            font-weight: bold;
            margin-bottom: 5px;
        }
        
        .em-timeline-content {
            color: var(--text-normal);
        }
        
        @media (max-width: 768px) {
            .em-matrix-grid {
                grid-template-columns: 1fr;
            }
            
            .em-quick-actions {
                grid-template-columns: 1fr;
            }
        }
        `;
        
        document.head.appendChild(style);
    }
}
class EisenhowerSettingTab extends PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.createEl('h2', { text: 'Eisenhower Matrix 설정' });
        
        // Periodic Notes 연동 설정
        new Setting(containerEl)
            .setName('Periodic Notes 연동')
            .setDesc('활성화하면 Periodic Notes 플러그인의 일일/주간/월간 노트와 연동됩니다. 비활성화하면 독립적인 폴더 구조를 사용합니다.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.usePeriodicNotes)
                .onChange(async (value) => {
                    this.plugin.settings.usePeriodicNotes = value;
                    await this.plugin.saveSettings();
                    this.display(); // 설정 변경 시 재렌더링
                }));

        if (this.plugin.settings.usePeriodicNotes) {
            containerEl.createEl('p', { 
                text: '✓ Periodic Notes 연동 활성화: 기존 일일/주간/월간 노트에 Eisenhower Matrix가 추가됩니다.',
                cls: 'setting-item-description'
            });
        } else {
            containerEl.createEl('p', { 
                text: '→ 독립 모드: 별도의 폴더 구조에서 Eisenhower Matrix 전용 노트를 생성합니다.',
                cls: 'setting-item-description'
            });
        }

        // 템플릿 설정
        containerEl.createEl('h3', { text: '템플릿 설정' });
        
        new Setting(containerEl)
            .setName('템플릿 사용')
            .setDesc('노트 생성 시 템플릿을 사용합니다')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.useTemplate)
                .onChange(async (value) => {
                    this.plugin.settings.useTemplate = value;
                    await this.plugin.saveSettings();
                    this.display(); // 설정 변경 시 재렌더링
                }));

        if (this.plugin.settings.useTemplate) {
            new Setting(containerEl)
                .setName('템플릿 폴더')
                .setDesc('템플릿 파일들이 저장된 폴더 경로')
                .addText(text => text
                    .setPlaceholder('Templates')
                    .setValue(this.plugin.settings.templateFolder)
                    .onChange(async (value) => {
                        this.plugin.settings.templateFolder = value;
                        await this.plugin.saveSettings();
                    }));

            new Setting(containerEl)
                .setName('일일 노트 템플릿')
                .setDesc('일일 노트 생성 시 사용할 템플릿 파일명')
                .addText(text => text
                    .setPlaceholder('Daily Eisenhower Matrix.md')
                    .setValue(this.plugin.settings.dailyTemplate)
                    .onChange(async (value) => {
                        this.plugin.settings.dailyTemplate = value;
                        await this.plugin.saveSettings();
                    }));

            new Setting(containerEl)
                .setName('주간 노트 템플릿')
                .setDesc('주간 노트 생성 시 사용할 템플릿 파일명')
                .addText(text => text
                    .setPlaceholder('Weekly Eisenhower Matrix.md')
                    .setValue(this.plugin.settings.weeklyTemplate)
                    .onChange(async (value) => {
                        this.plugin.settings.weeklyTemplate = value;
                        await this.plugin.saveSettings();
                    }));

            new Setting(containerEl)
                .setName('월간 노트 템플릿')
                .setDesc('월간 노트 생성 시 사용할 템플릿 파일명')
                .addText(text => text
                    .setPlaceholder('Monthly Eisenhower Matrix.md')
                    .setValue(this.plugin.settings.monthlyTemplate)
                    .onChange(async (value) => {
                        this.plugin.settings.monthlyTemplate = value;
                        await this.plugin.saveSettings();
                    }));

            containerEl.createEl('p', { 
                text: '💡 팁: 템플릿 파일은 지정한 템플릿 폴더에 있어야 합니다. 파일이 없으면 기본 내용으로 노트가 생성됩니다.',
                cls: 'setting-item-description'
            });
        }

        containerEl.createEl('h3', { text: '기본 폴더 설정' });
        
        new Setting(containerEl)
            .setName('메인 폴더')
            .setDesc('Eisenhower Matrix 파일을 저장할 메인 폴더')
            .addText(text => text
                .setPlaceholder('Eisenhower Matrix')
                .setValue(this.plugin.settings.mainFolder)
                .onChange(async (value) => {
                    this.plugin.settings.mainFolder = value;
                    await this.plugin.saveSettings();
                }));
        
        new Setting(containerEl)
            .setName('일일 노트 폴더')
            .setDesc('일일 노트를 저장할 폴더')
            .addText(text => text
                .setPlaceholder('Daily')
                .setValue(this.plugin.settings.dailyFolder)
                .onChange(async (value) => {
                    this.plugin.settings.dailyFolder = value;
                    await this.plugin.saveSettings();
                }));
        
        new Setting(containerEl)
            .setName('주간 노트 폴더')
            .setDesc('주간 노트를 저장할 폴더')
            .addText(text => text
                .setPlaceholder('Weekly')
                .setValue(this.plugin.settings.weeklyFolder)
                .onChange(async (value) => {
                    this.plugin.settings.weeklyFolder = value;
                    await this.plugin.saveSettings();
                }));
        
        new Setting(containerEl)
            .setName('월간 노트 폴더')
            .setDesc('월간 노트를 저장할 폴더')
            .addText(text => text
                .setPlaceholder('Monthly')
                .setValue(this.plugin.settings.monthlyFolder)
                .onChange(async (value) => {
                    this.plugin.settings.monthlyFolder = value;
                    await this.plugin.saveSettings();
                }));
        
        new Setting(containerEl)
            .setName('연간 노트 폴더')
            .setDesc('연간 노트를 저장할 폴더')
            .addText(text => text
                .setPlaceholder('Yearly')
                .setValue(this.plugin.settings.yearlyFolder)
                .onChange(async (value) => {
                    this.plugin.settings.yearlyFolder = value;
                    await this.plugin.saveSettings();
                }));
        
        new Setting(containerEl)
            .setName('파일 형식')
            .setDesc('노트 파일의 확장자')
            .addText(text => text
                .setPlaceholder('md')
                .setValue(this.plugin.settings.fileFormat)
                .onChange(async (value) => {
                    this.plugin.settings.fileFormat = value;
                    await this.plugin.saveSettings();
                }));
    }
}

// 새로운 기능 메서드들을 EisenhowerMatrixView에 추가
EisenhowerMatrixView.prototype.showAddTaskModal = function(quadrant) {
    const modal = new AddTaskModal(this.app, (taskText) => {
        this.addTaskToQuadrant(quadrant, taskText);
    });
    modal.open();
};

EisenhowerMatrixView.prototype.addTaskToQuadrant = function(quadrant, taskText) {
    if (!this.tasks[this.currentPeriod][quadrant]) {
        this.tasks[this.currentPeriod][quadrant] = [];
    }
    
    const task = {
        text: taskText,
        completed: false,
        created: new Date().toISOString()
    };
    
    this.tasks[this.currentPeriod][quadrant].push(task);
    this.saveToStorage();
    this.refresh();
    
    // 노트에도 추가
    this.addTaskToNote(quadrant, taskText);
    
    new Notice(`할일이 ${this.getQuadrantName(quadrant)}에 추가되었습니다.`);
};

EisenhowerMatrixView.prototype.toggleTaskComplete = function(quadrant, index, completed) {
    const task = this.tasks[this.currentPeriod][quadrant][index];
    if (typeof task === 'object') {
        task.completed = completed;
    } else {
        // 기존 문자열 형태의 task를 객체로 변환
        this.tasks[this.currentPeriod][quadrant][index] = {
            text: task,
            completed: completed,
            created: new Date().toISOString()
        };
    }
    
    this.saveToStorage();
    this.refresh();
};

EisenhowerMatrixView.prototype.editTask = function(quadrant, index) {
    const task = this.tasks[this.currentPeriod][quadrant][index];
    const taskText = typeof task === 'object' ? task.text : task;
    
    const modal = new AddTaskModal(this.app, (newText) => {
        if (typeof task === 'object') {
            task.text = newText;
        } else {
            this.tasks[this.currentPeriod][quadrant][index] = {
                text: newText,
                completed: false,
                created: new Date().toISOString()
            };
        }
        this.saveToStorage();
        this.refresh();
    }, taskText);
    modal.open();
};

EisenhowerMatrixView.prototype.showMoveTaskModal = function(quadrant, index) {
    const modal = new TaskMoveModal(this.app, (targetQuadrant) => {
        this.moveTaskToQuadrant(quadrant, index, targetQuadrant);
    });
    modal.open();
};

EisenhowerMatrixView.prototype.moveTaskToQuadrant = function(fromQuadrant, index, toQuadrant) {
    const task = this.tasks[this.currentPeriod][fromQuadrant][index];
    
    // 원본에서 제거
    this.tasks[this.currentPeriod][fromQuadrant].splice(index, 1);
    
    // 대상에 추가
    if (!this.tasks[this.currentPeriod][toQuadrant]) {
        this.tasks[this.currentPeriod][toQuadrant] = [];
    }
    this.tasks[this.currentPeriod][toQuadrant].push(task);
    
    this.saveToStorage();
    this.refresh();
    
    new Notice(`할일이 ${this.getQuadrantName(toQuadrant)}로 이동되었습니다.`);
};

EisenhowerMatrixView.prototype.getQuadrantName = function(quadrant) {
    const names = {
        'q1': '중요하고 긴급함',
        'q2': '중요하지만 긴급하지 않음',
        'q3': '긴급하지만 중요하지 않음',
        'q4': '중요하지도 긴급하지도 않음'
    };
    return names[quadrant] || quadrant;
};

EisenhowerMatrixView.prototype.refresh = function() {
    const matrixGrid = this.containerEl.querySelector('.em-matrix-grid');
    if (matrixGrid) {
        this.renderMatrix(matrixGrid);
    }
    
    const stats = this.containerEl.querySelector('.em-stats');
    if (stats) {
        this.updateStats(stats);
    }
};

class AddTaskModal extends Modal {
    constructor(app, onSubmitCallback, initialText = '') {
        super(app);
        this.onSubmitCallback = onSubmitCallback;
        this.initialText = initialText;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h2', { text: this.initialText ? '할일 편집' : '새 할일 추가' });
        
        const inputContainer = contentEl.createDiv('task-input-container');
        const input = inputContainer.createEl('input', { 
            type: 'text',
            placeholder: '할일을 입력하세요...',
            value: this.initialText
        });
        input.style.width = '100%';
        input.style.padding = '10px';
        input.style.marginBottom = '15px';
        input.style.border = '1px solid var(--background-modifier-border)';
        input.style.borderRadius = '4px';
        
        const buttonContainer = contentEl.createDiv('button-container');
        buttonContainer.style.display = 'flex';
        buttonContainer.style.gap = '10px';
        
        const submitBtn = buttonContainer.createEl('button', { 
            text: this.initialText ? '수정' : '추가', 
            cls: 'mod-cta'
        });
        submitBtn.style.flex = '1';
        
        const cancelBtn = buttonContainer.createEl('button', { 
            text: '취소'
        });
        cancelBtn.style.flex = '1';
        
        const submitTask = () => {
            const text = input.value.trim();
            if (text) {
                this.onSubmitCallback(text);
                this.close();
            }
        };
        
        submitBtn.onclick = submitTask;
        cancelBtn.onclick = () => this.close();
        
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                submitTask();
            }
        });
        
        input.focus();
        if (this.initialText) {
            input.select();
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

class TaskMoveModal extends Modal {
    constructor(app, onMoveCallback) {
        super(app);
        this.onMoveCallback = onMoveCallback;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h2', { text: '할일 이동' });
        
        const quadrants = [
            { id: 'q1', name: '🔥 중요하고 긴급함 (Q1)', color: '#ff6b6b' },
            { id: 'q2', name: '📅 중요하지만 긴급하지 않음 (Q2)', color: '#4ecdc4' },
            { id: 'q3', name: '👥 긴급하지만 중요하지 않음 (Q3)', color: '#45b7d1' },
            { id: 'q4', name: '🗑️ 중요하지도 긴급하지도 않음 (Q4)', color: '#96ceb4' }
        ];
        
        const container = contentEl.createDiv({ cls: 'quadrant-selection' });
        
        quadrants.forEach(q => {
            const btn = container.createEl('button', { 
                text: q.name, 
                cls: 'mod-cta'
            });
            btn.style.backgroundColor = q.color;
            btn.style.color = 'white';
            btn.style.margin = '5px';
            btn.style.padding = '10px 15px';
            btn.style.border = 'none';
            btn.style.borderRadius = '5px';
            btn.style.cursor = 'pointer';
            btn.style.width = '100%';
            
            btn.onclick = () => {
                this.onMoveCallback(q.id);
                this.close();
            };
        });
        
        const cancelBtn = contentEl.createEl('button', { 
            text: '취소', 
            cls: 'mod-cancel'
        });
        cancelBtn.style.marginTop = '10px';
        cancelBtn.style.width = '100%';
        cancelBtn.onclick = () => this.close();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

module.exports = EisenhowerMatrixPlugin;
