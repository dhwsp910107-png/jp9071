// ========== Part 4: 모달 클래스들 ==========
// 타이머 모달, 문제 생성 모달, 설정 모달 등

// ========== 설정 모달 ==========
class SettingsModal extends Modal {
    constructor(app, plugin) {
        super(app);
        this.plugin = plugin;
    }
    
    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        // 모달 스타일 설정
        this.modalEl.addClass('settings-modal');
        this.modalEl.style.width = '800px';
        this.modalEl.style.maxHeight = '90vh';
        
        this.renderSettingsContent(contentEl);
    }
    
    renderSettingsContent(container) {
        // 설정 헤더
        const header = container.createDiv('settings-header');
        
        const title = header.createEl('h2', { text: '⚙️ 설정' });
        
        const closeBtn = header.createEl('button', { 
            cls: 'close-btn',
            text: '✕'
        });
        closeBtn.addEventListener('click', () => this.close());
        
        // 설정 본문
        const body = container.createDiv('settings-body');
        
        // 일반 설정
        this.renderGeneralSettings(body);
        
        // 과목 설정
        this.renderSubjectSettings(body);
        
        // 표시 설정
        this.renderDisplaySettings(body);
        
        // 등급 설정
        this.renderGradeSettings(body);
        
        // 알림 설정
        this.renderNotificationSettings(body);
        
        // 설정 푸터
        this.renderSettingsFooter(container);
    }
    
    renderGeneralSettings(container) {
        const section = container.createDiv('settings-section');
        
        const title = section.createEl('h3', { text: '📋 일반 설정' });
        
        // 문제 폴더 경로
        this.createSettingItem(section, {
            title: '문제 폴더 경로',
            desc: '문제 파일이 저장될 폴더 경로를 설정합니다.',
            control: this.createTextInput(this.plugin.settings.problemsFolder, (value) => {
                this.plugin.settings.problemsFolder = value;
            })
        });
        
        // 템플릿 폴더 경로
        this.createSettingItem(section, {
            title: '템플릿 폴더 경로',
            desc: '문제 템플릿이 저장된 폴더 경로입니다.',
            control: this.createTextInput(this.plugin.settings.templatesFolder, (value) => {
                this.plugin.settings.templatesFolder = value;
            })
        });
        
        // 최대 문제 수
        this.createSettingItem(section, {
            title: '최대 문제 수',
            desc: '대시보드에 표시할 최대 문제 개수입니다.',
            control: this.createSelect(['100', '200', '300', '500', '1000'], 
                this.plugin.settings.maxProblems.toString(), (value) => {
                this.plugin.settings.maxProblems = parseInt(value);
            })
        });
        
        // 자동 타이머 시작
        this.createSettingItem(section, {
            title: '자동 타이머 시작',
            desc: '문제를 열면 자동으로 타이머를 시작합니다.',
            control: this.createToggle(this.plugin.settings.autoTimerStart, (value) => {
                this.plugin.settings.autoTimerStart = value;
            })
        });
        
        // 타이머 자동 저장
        this.createSettingItem(section, {
            title: '타이머 자동 저장',
            desc: '타이머 정지 시 자동으로 시간을 저장합니다.',
            control: this.createToggle(this.plugin.settings.autoTimerSave, (value) => {
                this.plugin.settings.autoTimerSave = value;
            })
        });
    }
    
    renderSubjectSettings(container) {
        const section = container.createDiv('settings-section');
        
        const title = section.createEl('h3', { text: '📚 과목 설정' });
        
        // 기본 과목
        this.createSettingItem(section, {
            title: '기본 과목',
            desc: '대시보드를 열었을 때 기본으로 선택될 과목입니다.',
            control: this.createSelect(this.plugin.settings.subjects, 
                this.plugin.settings.defaultSubject, (value) => {
                this.plugin.settings.defaultSubject = value;
            })
        });
        
        // 과목별 색상
        this.createSettingItem(section, {
            title: '과목별 색상',
            desc: '각 과목에 고유한 색상을 설정할 수 있습니다.',
            control: this.createToggle(this.plugin.settings.subjectColors, (value) => {
                this.plugin.settings.subjectColors = value;
            })
        });
    }
    
    renderDisplaySettings(container) {
        const section = container.createDiv('settings-section');
        
        const title = section.createEl('h3', { text: '🎨 표시 설정' });
        
        // 완전 숙달 색상
        this.createSettingItem(section, {
            title: '완전 숙달 색상',
            desc: '완전히 숙달된 문제의 색상입니다.',
            control: this.createColorPicker(this.plugin.settings.masteredColor, (value) => {
                this.plugin.settings.masteredColor = value;
            })
        });
        
        // 복습 중 색상
        this.createSettingItem(section, {
            title: '복습 중 색상',
            desc: '복습이 필요한 문제의 색상입니다.',
            control: this.createColorPicker(this.plugin.settings.reviewingColor, (value) => {
                this.plugin.settings.reviewingColor = value;
            })
        });
        
        // 학습 중 색상
        this.createSettingItem(section, {
            title: '학습 중 색상',
            desc: '현재 학습 중인 문제의 색상입니다.',
            control: this.createColorPicker(this.plugin.settings.learningColor, (value) => {
                this.plugin.settings.learningColor = value;
            })
        });
        
        // 문제 번호 표시
        this.createSettingItem(section, {
            title: '문제 번호 표시',
            desc: '그리드에 문제 번호를 표시합니다.',
            control: this.createToggle(this.plugin.settings.problemNumberDisplay, (value) => {
                this.plugin.settings.problemNumberDisplay = value;
            })
        });
        
        // 통계 애니메이션
        this.createSettingItem(section, {
            title: '통계 애니메이션',
            desc: '통계 카드의 애니메이션 효과를 활성화합니다.',
            control: this.createToggle(this.plugin.settings.statsAnimation, (value) => {
                this.plugin.settings.statsAnimation = value;
            })
        });
    }
    
    renderGradeSettings(container) {
        const section = container.createDiv('settings-section');
        
        const title = section.createEl('h3', { text: '🏆 등급 설정' });
        
        // S등급 기준
        this.createSettingItem(section, {
            title: 'S등급 기준 (초)',
            desc: 'S등급을 받기 위한 최대 시간 (초 단위)',
            control: this.createNumberInput(this.plugin.settings.sGradeTime, 1, (value) => {
                this.plugin.settings.sGradeTime = value;
            })
        });
        
        // A등급 기준
        this.createSettingItem(section, {
            title: 'A등급 기준 (초)',
            desc: 'A등급을 받기 위한 최대 시간 (초 단위)',
            control: this.createNumberInput(this.plugin.settings.aGradeTime, 1, (value) => {
                this.plugin.settings.aGradeTime = value;
            })
        });
        
        // B등급 기준
        this.createSettingItem(section, {
            title: 'B등급 기준 (초)',
            desc: 'B등급을 받기 위한 최대 시간 (초 단위)',
            control: this.createNumberInput(this.plugin.settings.bGradeTime, 1, (value) => {
                this.plugin.settings.bGradeTime = value;
            })
        });
        
        // 등급 자동 계산
        this.createSettingItem(section, {
            title: '등급 자동 계산',
            desc: '시간 기록 시 자동으로 등급을 계산합니다.',
            control: this.createToggle(this.plugin.settings.autoGradeCalculation, (value) => {
                this.plugin.settings.autoGradeCalculation = value;
            })
        });
    }
    
    renderNotificationSettings(container) {
        const section = container.createDiv('settings-section');
        
        const title = section.createEl('h3', { text: '🔔 알림 설정' });
        
        // 복습 알림
        this.createSettingItem(section, {
            title: '복습 알림',
            desc: '복습이 필요한 문제가 있을 때 알림을 보냅니다.',
            control: this.createToggle(this.plugin.settings.reviewNotification, (value) => {
                this.plugin.settings.reviewNotification = value;
            })
        });
        
        // 일일 목표 달성 알림
        this.createSettingItem(section, {
            title: '일일 목표 달성 알림',
            desc: '하루 목표를 달성했을 때 알림을 보냅니다.',
            control: this.createToggle(this.plugin.settings.dailyGoalNotification, (value) => {
                this.plugin.settings.dailyGoalNotification = value;
            })
        });
        
        // 일일 목표 문제 수
        this.createSettingItem(section, {
            title: '일일 목표 문제 수',
            desc: '하루에 풀어야 할 목표 문제 개수입니다.',
            control: this.createNumberInput(this.plugin.settings.dailyGoal, 1, (value) => {
                this.plugin.settings.dailyGoal = value;
            })
        });
    }
    
    renderSettingsFooter(container) {
        const footer = container.createDiv('settings-footer');
        
        const resetBtn = footer.createEl('button', { 
            cls: 'btn-reset',
            text: '🔄 초기화'
        });
        
        const cancelBtn = footer.createEl('button', { 
            cls: 'btn-cancel',
            text: '취소'
        });
        
        const saveBtn = footer.createEl('button', { 
            cls: 'btn-save',
            text: '💾 저장'
        });
        
        resetBtn.addEventListener('click', () => {
            this.resetSettings();
        });
        
        cancelBtn.addEventListener('click', () => {
            this.close();
        });
        
        saveBtn.addEventListener('click', () => {
            this.saveSettings();
        });
    }
    
    // ========== 설정 컨트롤 생성 헬퍼들 ==========
    createSettingItem(container, { title, desc, control }) {
        const item = container.createDiv('setting-item');
        
        const label = item.createDiv('setting-label');
        const titleEl = label.createEl('h4', { text: title });
        const descEl = label.createEl('p', { text: desc });
        
        const controlDiv = item.createDiv('setting-control');
        controlDiv.appendChild(control);
        
        return item;
    }
    
    createTextInput(value, onChange) {
        const input = document.createElement('input');
        input.type = 'text';
        input.value = value;
        input.addEventListener('change', (e) => onChange(e.target.value));
        return input;
    }
    
    createNumberInput(value, min, onChange) {
        const input = document.createElement('input');
        input.type = 'number';
        input.value = value.toString();
        input.min = min.toString();
        input.addEventListener('change', (e) => onChange(parseInt(e.target.value)));
        return input;
    }
    
    createSelect(options, value, onChange) {
        const select = document.createElement('select');
        options.forEach(option => {
            const optionEl = document.createElement('option');
            optionEl.value = option;
            optionEl.textContent = option;
            if (option === value) optionEl.selected = true;
            select.appendChild(optionEl);
        });
        select.addEventListener('change', (e) => onChange(e.target.value));
        return select;
    }
    
    createToggle(value, onChange) {
        const toggle = document.createElement('div');
        toggle.className = 'toggle-switch' + (value ? ' active' : '');
        toggle.addEventListener('click', () => {
            toggle.classList.toggle('active');
            onChange(toggle.classList.contains('active'));
        });
        return toggle;
    }
    
    createColorPicker(value, onChange) {
        const input = document.createElement('input');
        input.type = 'color';
        input.className = 'color-picker';
        input.value = value;
        input.addEventListener('change', (e) => onChange(e.target.value));
        return input;
    }
    
    async resetSettings() {
        this.plugin.settings = { ...DEFAULT_SETTINGS };
        await this.plugin.saveSettings();
        new Notice('설정이 초기화되었습니다.');
        this.close();
    }
    
    async saveSettings() {
        await this.plugin.saveSettings();
        new Notice('설정이 저장되었습니다.');
        this.close();
    }
}

// ========== 문제 타이머 모달 ==========
class ProblemTimerModal extends Modal {
    constructor(app, plugin, problem) {
        super(app);
        this.plugin = plugin;
        this.problem = problem;
        this.seconds = 0;
        this.isRunning = false;
        this.interval = null;
    }
    
    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        this.modalEl.addClass('problem-timer-modal');
        this.modalEl.style.width = '800px';
        this.modalEl.style.height = '600px';
        
        this.renderTimerInterface(contentEl);
    }
    
    onClose() {
        if (this.interval) {
            clearInterval(this.interval);
        }
    }
    
    renderTimerInterface(container) {
        // 타이머 헤더
        const header = container.createDiv('timer-modal-header');
        
        const title = header.createEl('h2', { 
            cls: 'timer-modal-title',
            text: `문제 ${this.problem.number}`
        });
        
        const info = header.createDiv();
        info.style.cssText = 'display: flex; justify-content: center; gap: 15px; font-size: 0.9rem;';
        
        const badges = [
            `📚 ${this.problem.subject}`,
            `⏰ 5분`,
            `⭐ 난이도 ${this.problem.difficulty}`
        ];
        
        badges.forEach(badge => {
            const span = info.createSpan();
            span.style.cssText = 'background: rgba(255,255,255,0.2); padding: 5px 15px; border-radius: 15px;';
            span.textContent = badge;
        });
        
        const display = header.createDiv('timer-display');
        display.textContent = '05:00';
        display.id = 'timer-display';
        
        // 문제 내용
        const content = container.createDiv('problem-content');
        const questionTitle = content.createEl('h3', { text: '🔢 문제' });
        questionTitle.style.marginBottom = '15px';
        
        const problemText = content.createDiv();
        problemText.innerHTML = `
            <strong>${this.problem.title}</strong><br><br>
            문제를 클릭하면 실제 파일이 열립니다.
        `;
        
        // 타이머 컨트롤
        const controls = container.createDiv('timer-controls');
        
        const startBtn = controls.createEl('button', { 
            cls: 'timer-btn start',
            text: '⏱️ 시작'
        });
        
        const pauseBtn = controls.createEl('button', { 
            cls: 'timer-btn pause',
            text: '⏸️ 일시정지'
        });
        pauseBtn.style.display = 'none';
        
        const resetBtn = controls.createEl('button', { 
            cls: 'timer-btn reset',
            text: '🔄 리셋'
        });
        
        const openBtn = controls.createEl('button', { 
            cls: 'timer-btn hint',
            text: '📄 파일 열기'
        });
        
        const closeBtn = controls.createEl('button', { 
            cls: 'timer-btn close',
            text: '❌ 닫기'
        });
        
        // 이벤트 핸들러
        startBtn.addEventListener('click', () => this.startTimer(startBtn, pauseBtn));
        pauseBtn.addEventListener('click', () => this.pauseTimer(startBtn, pauseBtn));
        resetBtn.addEventListener('click', () => this.resetTimer());
        openBtn.addEventListener('click', () => this.openProblemFile());
        closeBtn.addEventListener('click', () => this.close());
    }
    
    startTimer(startBtn, pauseBtn) {
        if (this.isRunning) return;
        
        this.isRunning = true;
        startBtn.style.display = 'none';
        pauseBtn.style.display = 'flex';
        
        this.interval = setInterval(() => {
            this.seconds++;
            this.updateDisplay();
        }, 1000);
        
        new Notice('타이머가 시작되었습니다!');
    }
    
    pauseTimer(startBtn, pauseBtn) {
        if (!this.isRunning) return;
        
        this.isRunning = false;
        
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        
        startBtn.style.display = 'flex';
        pauseBtn.style.display = 'none';
        
        new Notice('타이머가 일시정지되었습니다.');
    }
    
    resetTimer() {
        this.pauseTimer();
        this.seconds = 0;
        this.updateDisplay();
        new Notice('타이머가 리셋되었습니다.');
    }
    
    updateDisplay() {
        const display = this.containerEl.querySelector('#timer-display');
        if (display) {
            display.textContent = this.formatTime(this.seconds);
            
            if (this.seconds >= 270) { // 4분 30초 이후 빨간색
                display.style.color = '#ef4444';
                display.style.borderColor = '#ef4444';
            }
        }
    }
    
    formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    
    async openProblemFile() {
        if (this.problem?.file?.path) {
            const leaf = this.app.workspace.getUnpinnedLeaf();
            await leaf.openFile(this.problem.file);
        }
    }
}

// ========== 문제 생성 모달 ==========
class ProblemCreationModal extends Modal {
    constructor(app, plugin, suggestedNumber, suggestedSubject) {
        super(app);
        this.plugin = plugin;
        this.suggestedNumber = suggestedNumber;
        this.suggestedSubject = suggestedSubject;
    }
    
    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        contentEl.createEl('h2', { text: '새 문제 만들기' });
        
        const form = contentEl.createDiv();
        form.style.padding = '20px';
        
        // 문제 번호
        const numberGroup = form.createDiv();
        numberGroup.createEl('label', { text: '문제 번호:' });
        const numberInput = numberGroup.createEl('input', { 
            type: 'number', 
            placeholder: '문제 번호',
            value: this.suggestedNumber?.toString() || ''
        });
        numberInput.style.cssText = 'width: 100%; margin-bottom: 15px; padding: 8px;';
        
        // 문제 제목
        const titleGroup = form.createDiv();
        titleGroup.createEl('label', { text: '문제 제목:' });
        const titleInput = titleGroup.createEl('input', { 
            type: 'text', 
            placeholder: '문제 제목' 
        });
        titleInput.style.cssText = 'width: 100%; margin-bottom: 15px; padding: 8px;';
        
        // 과목 선택
        const subjectGroup = form.createDiv();
        subjectGroup.createEl('label', { text: '과목:' });
        const subjectSelect = subjectGroup.createEl('select');
        subjectSelect.style.cssText = 'width: 100%; margin-bottom: 15px; padding: 8px;';
        
        this.plugin.settings.subjects.forEach(subject => {
            const option = subjectSelect.createEl('option', { 
                value: subject, 
                text: subject 
            });
            if (subject === this.suggestedSubject) {
                option.selected = true;
            }
        });
        
        // 난이도 선택
        const difficultyGroup = form.createDiv();
        difficultyGroup.createEl('label', { text: '난이도:' });
        const difficultySelect = difficultyGroup.createEl('select');
        difficultySelect.style.cssText = 'width: 100%; margin-bottom: 20px; padding: 8px;';
        
        for (let i = 1; i <= 5; i++) {
            const option = difficultySelect.createEl('option', { 
                value: i.toString(), 
                text: '⭐'.repeat(i) + ` (${i}단계)` 
            });
            if (i === 3) {
                option.selected = true;
            }
        }
        
        // 버튼들
        const buttons = form.createDiv();
        buttons.style.textAlign = 'right';
        
        const cancelBtn = buttons.createEl('button', { text: '취소' });
        cancelBtn.style.marginRight = '10px';
        cancelBtn.addEventListener('click', () => this.close());
        
        const createBtn = buttons.createEl('button', { text: '생성' });
        createBtn.style.cssText = 'background: #3b82f6; color: white; border: none; padding: 8px 15px; border-radius: 4px;';
        createBtn.addEventListener('click', async () => {
            if (!numberInput.value || !titleInput.value.trim()) {
                new Notice('번호와 제목을 입력하세요!');
                return;
            }
            
            await this.plugin.createProblem(
                subjectSelect.value,
                parseInt(numberInput.value),
                titleInput.value.trim(),
                parseInt(difficultySelect.value)
            );
            this.close();
        });
    }
}

// ========== 일괄 생성 모달 ==========
class BulkCreationModal extends Modal {
    constructor(app, plugin, suggestedSubject) {
        super(app);
        this.plugin = plugin;
        this.suggestedSubject = suggestedSubject;
    }
    
    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        contentEl.createEl('h2', { text: '문제 일괄 생성' });
        
        const form = contentEl.createDiv();
        form.style.padding = '20px';
        
        // 과목 선택
        const subjectGroup = form.createDiv();
        subjectGroup.createEl('label', { text: '과목:' });
        const subjectSelect = subjectGroup.createEl('select');
        subjectSelect.style.cssText = 'width: 100%; margin-bottom: 15px; padding: 8px;';
        
        this.plugin.settings.subjects.forEach(subject => {
            const option = subjectSelect.createEl('option', { 
                value: subject, 
                text: subject 
            });
            if (subject === this.suggestedSubject) {
                option.selected = true;
            }
        });
        
        // 범위 설정
        const rangeGroup = form.createDiv();
        rangeGroup.createEl('label', { text: '범위:' });
        
        const rangeDiv = rangeGroup.createDiv();
        rangeDiv.style.cssText = 'display: flex; gap: 10px; align-items: center; margin-bottom: 20px;';
        
        const startInput = rangeDiv.createEl('input', { 
            type: 'number', 
            placeholder: '시작' 
        });
        startInput.style.cssText = 'width: 100px; padding: 8px;';
        
        rangeDiv.createEl('span', { text: '~' });
        
        const endInput = rangeDiv.createEl('input', { 
            type: 'number', 
            placeholder: '끝' 
        });
        endInput.style.cssText = 'width: 100px; padding: 8px;';
        
        // 버튼들
        const buttons = form.createDiv();
        buttons.style.textAlign = 'right';
        
        const cancelBtn = buttons.createEl('button', { text: '취소' });
        cancelBtn.style.marginRight = '10px';
        cancelBtn.addEventListener('click', () => this.close());
        
        const createBtn = buttons.createEl('button', { text: '생성' });
        createBtn.style.cssText = 'background: #10b981; color: white; border: none; padding: 8px 15px; border-radius: 4px;';
        createBtn.addEventListener('click', async () => {
            const start = parseInt(startInput.value);
            const end = parseInt(endInput.value);
            
            if (!start || !end || start > end) {
                new Notice('올바른 범위를 입력하세요!');
                return;
            }
            
            await this.plugin.createBulkProblems(subjectSelect.value, start, end);
            this.close();
        });
    }
}

// Part 4 완료 - 모달 클래스들 완성
console.log('📚 Part 4: 모달 클래스들 로드 완료');