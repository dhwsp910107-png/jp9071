// ========== Part 5: 설정 탭 및 CSS 스타일 ==========
// 플러그인 설정 탭과 완전한 CSS 스타일

// ========== 플러그인 설정 탭 클래스 ==========
class StudyDashboardSettingTab extends PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        const { containerEl } = this;
        containerEl.empty();
        
        containerEl.createEl('h2', { text: '📚 Study Dashboard 설정' });

        // 기본 설정
        this.renderBasicSettings(containerEl);
        
        // 스톱워치 연동 설정
        this.renderStopwatchSettings(containerEl);
        
        // 과목 관리
        this.renderSubjectManagement(containerEl);
    }
    
    renderBasicSettings(container) {
        container.createEl('h3', { text: '⚙️ 기본 설정' });
        
        new Setting(container)
            .setName('📁 문제 폴더 경로')
            .setDesc('문제 파일들이 저장될 폴더 경로')
            .addText(text => text
                .setPlaceholder('학습관리/문제은행')
                .setValue(this.plugin.settings.problemsFolder)
                .onChange(async (value) => {
                    this.plugin.settings.problemsFolder = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(container)
            .setName('🎯 일일 목표')
            .setDesc('하루에 풀 문제 수 목표')
            .addText(text => text
                .setPlaceholder('5')
                .setValue(this.plugin.settings.dailyGoal.toString())
                .onChange(async (value) => {
                    this.plugin.settings.dailyGoal = parseInt(value) || 5;
                    await this.plugin.saveSettings();
                }));

        new Setting(container)
            .setName('📅 목표 날짜')
            .setDesc('전체 문제 완료 목표 날짜')
            .addText(text => text
                .setPlaceholder('2025-12-31')
                .setValue(this.plugin.settings.targetDate)
                .onChange(async (value) => {
                    this.plugin.settings.targetDate = value;
                    await this.plugin.saveSettings();
                }));
        
        new Setting(container)
            .setName('📊 최대 문제 수')
            .setDesc('대시보드에 표시할 최대 문제 개수')
            .addDropdown(dropdown => dropdown
                .addOption('100', '100문제')
                .addOption('200', '200문제')
                .addOption('300', '300문제')
                .addOption('500', '500문제')
                .addOption('1000', '1000문제')
                .setValue(this.plugin.settings.maxProblems.toString())
                .onChange(async (value) => {
                    this.plugin.settings.maxProblems = parseInt(value);
                    await this.plugin.saveSettings();
                }));
    }
    
    renderStopwatchSettings(container) {
        container.createEl('h3', { text: '⏱️ 스톱워치 연동 설정' });

        new Setting(container)
            .setName('⏱️ 스톱워치 플러그인 연동')
            .setDesc('Stopwatch Timer 플러그인과 연동하여 자동으로 시간을 기록합니다')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.stopwatchIntegration)
                .onChange(async (value) => {
                    this.plugin.settings.stopwatchIntegration = value;
                    await this.plugin.saveSettings();
                    if (value) {
                        new Notice('⏱️ 스톱워치 연동이 활성화되었습니다!');
                    } else {
                        new Notice('⏱️ 스톱워치 연동이 비활성화되었습니다');
                    }
                }));

        new Setting(container)
            .setName('📊 자동 시간 기록')
            .setDesc('스톱워치 종료 시 자동으로 문제 파일에 시간을 기록합니다')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.autoTimerSave)
                .onChange(async (value) => {
                    this.plugin.settings.autoTimerSave = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(container)
            .setName('🚀 자동 타이머 시작')
            .setDesc('문제를 열면 자동으로 타이머를 시작합니다')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.autoTimerStart)
                .onChange(async (value) => {
                    this.plugin.settings.autoTimerStart = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(container)
            .setName('⏰ 타이머 기능')
            .setDesc('문제 풀이 시 타이머 모달을 표시합니다')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.timerEnabled)
                .onChange(async (value) => {
                    this.plugin.settings.timerEnabled = value;
                    await this.plugin.saveSettings();
                }));
    }
    
    renderSubjectManagement(container) {
        container.createEl('h3', { text: '📖 과목 관리' });
        
        const subjectsContainer = container.createDiv();
        this.renderSubjectsList(subjectsContainer);

        new Setting(container)
            .setName('➕ 새 과목 추가')
            .setDesc('새로운 과목을 추가합니다')
            .addText(text => {
                text.setPlaceholder('과목명 입력');
                const addButton = new Setting(container)
                    .addButton(button => button
                        .setButtonText('추가')
                        .setCta()
                        .onClick(async () => {
                            const subject = text.getValue().trim();
                            if (subject && !this.plugin.settings.subjects.includes(subject)) {
                                this.plugin.settings.subjects.push(subject);
                                await this.plugin.saveSettings();
                                this.renderSubjectsList(subjectsContainer);
                                text.setValue('');
                                new Notice(`'${subject}' 과목이 추가되었습니다.`);
                            } else if (this.plugin.settings.subjects.includes(subject)) {
                                new Notice('이미 존재하는 과목입니다.');
                            }
                        }));
            });
    }

    renderSubjectsList(container) {
        container.empty();
        this.plugin.settings.subjects.forEach(subject => {
            const subjectDiv = container.createDiv();
            subjectDiv.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 8px; margin-bottom: 4px; background: var(--background-secondary); border-radius: 4px;';

            const subjectName = subjectDiv.createEl('span');
            subjectName.textContent = subject;
            subjectName.style.fontWeight = '500';

            const deleteButton = subjectDiv.createEl('button');
            deleteButton.textContent = '삭제';
            deleteButton.style.cssText = 'background: #ef4444; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;';

            deleteButton.addEventListener('click', async () => {
                const index = this.plugin.settings.subjects.indexOf(subject);
                if (index > -1) {
                    this.plugin.settings.subjects.splice(index, 1);
                    await this.plugin.saveSettings();
                    this.renderSubjectsList(container);
                    new Notice(`'${subject}' 과목이 삭제되었습니다.`);
                }
            });
        });
    }
}

// ========== CSS 스타일 추가 함수 ==========
function addStudyDashboardStyles() {
    const css = `
        /* ========== 전체 컨테이너 ========== */
        .study-dashboard-container {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
            background: var(--background-primary);
            color: var(--text-normal);
            padding: 20px;
            overflow-y: auto;
            height: 100%;
        }

        /* ========== 탭 시스템 ========== */
        .tabs {
            display: flex;
            gap: 10px;
            margin-bottom: 30px;
            border-bottom: 2px solid var(--background-modifier-border);
            padding-bottom: 10px;
            justify-content: center;
        }

        .tab-btn {
            padding: 12px 30px;
            background: var(--background-secondary);
            border: none;
            border-radius: 10px 10px 0 0;
            color: var(--text-normal);
            cursor: pointer;
            font-weight: 600;
            font-size: 1.1rem;
            transition: all 0.3s;
        }

        .tab-btn:hover {
            background: var(--interactive-hover);
            transform: translateY(-2px);
        }

        .tab-btn.active {
            background: #3b82f6;
            color: white;
        }

        .tab-content {
            display: none;
        }

        .tab-content.active {
            display: block;
        }

        /* ========== 대시보드 헤더 ========== */
        .dashboard-header {
            text-align: center;
            margin-bottom: 40px;
            padding: 50px;
            background: linear-gradient(135deg, #3b82f6, #1e40af);
            color: white;
            border-radius: 25px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.4);
            position: relative;
        }

        .settings-icon {
            position: absolute;
            top: 30px;
            right: 30px;
            width: 50px;
            height: 50px;
            background: rgba(255,255,255,0.2);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.3s ease;
            font-size: 1.5rem;
        }

        .settings-icon:hover {
            background: rgba(255,255,255,0.3);
            transform: rotate(90deg) scale(1.1);
        }

        .main-title {
            font-size: 3.5rem;
            font-weight: 900;
            margin-bottom: 15px;
        }

        .subtitle {
            font-size: 1.3rem;
            opacity: 0.95;
        }

        /* ========== 설정 모달 ========== */
        .settings-modal .modal {
            background: var(--background-primary);
            border-radius: 25px;
            max-width: 800px;
            width: 90%;
            max-height: 90vh;
            overflow-y: auto;
        }

        .settings-header {
            background: linear-gradient(135deg, #3b82f6, #1e40af);
            color: white;
            padding: 30px 40px;
            border-radius: 25px 25px 0 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .settings-header h2 {
            font-size: 2rem;
            font-weight: 800;
            margin: 0;
        }

        .close-btn {
            width: 40px;
            height: 40px;
            background: rgba(255,255,255,0.2);
            border: none;
            border-radius: 50%;
            color: white;
            font-size: 1.5rem;
            cursor: pointer;
            transition: all 0.3s;
        }

        .close-btn:hover {
            background: rgba(255,255,255,0.3);
            transform: rotate(90deg);
        }

        .settings-body {
            padding: 40px;
        }

        .settings-section {
            margin-bottom: 40px;
            padding-bottom: 30px;
            border-bottom: 2px solid var(--background-modifier-border);
        }

        .settings-section:last-child {
            border-bottom: none;
        }

        .settings-section h3 {
            font-size: 1.5rem;
            font-weight: 800;
            margin-bottom: 20px;
            color: #3b82f6;
        }

        .setting-item {
            margin-bottom: 25px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px;
            background: var(--background-secondary);
            border-radius: 15px;
            transition: all 0.3s;
        }

        .setting-item:hover {
            background: var(--interactive-hover);
        }

        .setting-label {
            flex: 1;
        }

        .setting-label h4 {
            font-size: 1.1rem;
            font-weight: 700;
            margin-bottom: 5px;
            margin-top: 0;
        }

        .setting-label p {
            font-size: 0.9rem;
            color: var(--text-muted);
            line-height: 1.5;
            margin: 0;
        }

        .setting-control {
            margin-left: 20px;
        }

        .setting-control input[type="number"],
        .setting-control input[type="text"],
        .setting-control select {
            padding: 10px 15px;
            border: 2px solid var(--background-modifier-border);
            border-radius: 10px;
            background: var(--background-primary);
            color: var(--text-normal);
            font-weight: 600;
            font-size: 1rem;
            min-width: 150px;
        }

        .toggle-switch {
            position: relative;
            width: 60px;
            height: 30px;
            background: var(--background-modifier-border);
            border-radius: 15px;
            cursor: pointer;
            transition: all 0.3s;
        }

        .toggle-switch.active {
            background: #3b82f6;
        }

        .toggle-switch::after {
            content: '';
            position: absolute;
            top: 3px;
            left: 3px;
            width: 24px;
            height: 24px;
            background: white;
            border-radius: 50%;
            transition: all 0.3s;
        }

        .toggle-switch.active::after {
            left: 33px;
        }

        .color-picker {
            width: 60px;
            height: 40px;
            border: 2px solid var(--background-modifier-border);
            border-radius: 10px;
            cursor: pointer;
            transition: all 0.3s;
        }

        .color-picker:hover {
            border-color: #3b82f6;
        }

        .settings-footer {
            padding: 30px 40px;
            background: var(--background-secondary);
            border-radius: 0 0 25px 25px;
            display: flex;
            gap: 15px;
            justify-content: flex-end;
        }

        .settings-footer button {
            padding: 12px 30px;
            border: none;
            border-radius: 12px;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.3s;
            font-size: 1rem;
        }

        .btn-save {
            background: #10b981;
            color: white;
        }

        .btn-save:hover {
            background: #059669;
            transform: translateY(-2px);
        }

        .btn-cancel {
            background: #6b7280;
            color: white;
        }

        .btn-cancel:hover {
            background: #4b5563;
            transform: translateY(-2px);
        }

        .btn-reset {
            background: #ef4444;
            color: white;
        }

        .btn-reset:hover {
            background: #dc2626;
            transform: translateY(-2px);
        }

        /* ========== 타이머 섹션 ========== */
        .timer-section {
            background: linear-gradient(135deg, #667eea, #764ba2);
            padding: 40px;
            border-radius: 25px;
            margin-bottom: 40px;
            text-align: center;
            box-shadow: 0 15px 50px rgba(102, 126, 234, 0.3);
        }

        .timer-title {
            font-size: 1.8rem;
            font-weight: 700;
            color: white;
            margin-bottom: 10px;
        }

        .timer-subtitle {
            color: rgba(255,255,255,0.9);
            font-size: 1.1rem;
            margin-bottom: 30px;
        }

        .timer-display {
            font-size: 5rem;
            font-weight: 900;
            font-family: 'Courier New', monospace;
            color: white;
            text-shadow: 0 5px 15px rgba(0,0,0,0.3);
            margin: 30px 0;
            letter-spacing: 5px;
        }

        .timer-controls {
            display: flex;
            gap: 15px;
            justify-content: center;
            flex-wrap: wrap;
        }

        .timer-btn, .stopwatch-btn {
            padding: 15px 35px;
            border: none;
            border-radius: 15px;
            font-weight: 700;
            font-size: 1.1rem;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        }

        .timer-btn:hover, .stopwatch-btn:hover {
            transform: translateY(-3px);
            box-shadow: 0 8px 25px rgba(0,0,0,0.3);
        }

        .timer-btn.start, .stopwatch-btn.start { background: #10b981; color: white; }
        .timer-btn.pause, .stopwatch-btn.pause { background: #f59e0b; color: white; }
        .timer-btn.stop, .stopwatch-btn.stop { background: #ef4444; color: white; }
        .timer-btn.reset, .stopwatch-btn.reset { background: #6b7280; color: white; }

        .timer-info {
            background: rgba(255,255,255,0.15);
            padding: 20px;
            border-radius: 15px;
            margin-top: 30px;
            backdrop-filter: blur(10px);
        }

        .timer-info p {
            color: white;
            line-height: 2;
            font-size: 1rem;
            margin: 0;
        }

        /* ========== 과목 탭 ========== */
        .subject-tabs {
            display: flex;
            gap: 12px;
            margin-bottom: 40px;
            justify-content: center;
            flex-wrap: wrap;
            padding: 25px;
            background: var(--background-secondary);
            border-radius: 20px;
        }

        .subject-tab {
            padding: 15px 30px;
            background: var(--background-primary);
            border: 2px solid var(--background-modifier-border);
            border-radius: 25px;
            cursor: pointer;
            transition: all 0.3s ease;
            font-weight: 700;
            font-size: 1.05rem;
        }

        .subject-tab:hover {
            transform: translateY(-3px);
            box-shadow: 0 8px 25px rgba(59, 130, 246, 0.3);
            border-color: #3b82f6;
        }

        .subject-tab.active {
            background: #3b82f6;
            color: white;
            border-color: #3b82f6;
        }

        /* ========== 통계 카드 ========== */
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 25px;
            margin-bottom: 40px;
        }

        .stat-card {
            background: var(--background-secondary);
            padding: 35px;
            border-radius: 20px;
            text-align: center;
            box-shadow: 0 8px 25px rgba(0,0,0,0.3);
            transition: transform 0.3s ease;
            border-top: 5px solid #3b82f6;
        }

        .stat-card:hover {
            transform: translateY(-8px);
        }

        .stat-card.mastered { border-top-color: #10b981; }
        .stat-card.reviewing { border-top-color: #f59e0b; }
        .stat-card.learning { border-top-color: #ef4444; }

        .stat-number {
            font-size: 3.5rem;
            font-weight: 900;
            margin-bottom: 15px;
            color: var(--text-normal);
        }

        .stat-number.mastered { color: #10b981; }
        .stat-number.reviewing { color: #f59e0b; }
        .stat-number.learning { color: #ef4444; }

        .stat-label {
            color: var(--text-muted);
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            font-size: 0.95rem;
        }

        /* ========== 액션 섹션 ========== */
        .action-section {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: var(--background-secondary);
            padding: 30px;
            border-radius: 20px;
            margin-bottom: 40px;
            flex-wrap: wrap;
            gap: 20px;
        }

        .view-controls {
            display: flex;
            gap: 20px;
            align-items: center;
            flex-wrap: wrap;
        }

        .view-controls label {
            font-weight: 700;
            color: var(--text-normal);
        }

        .view-controls select {
            padding: 12px 20px;
            border: 2px solid var(--background-modifier-border);
            border-radius: 12px;
            background: var(--background-primary);
            color: var(--text-normal);
            font-weight: 600;
            cursor: pointer;
            font-size: 1rem;
        }

        .action-buttons {
            display: flex;
            gap: 15px;
            flex-wrap: wrap;
        }

        .btn {
            padding: 14px 30px;
            border: none;
            border-radius: 15px;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.3s ease;
            font-size: 1rem;
        }

        .btn:hover {
            transform: translateY(-3px);
            box-shadow: 0 8px 25px rgba(0,0,0,0.3);
        }

        .btn-primary { background: #3b82f6; color: white; }
        .btn-success { background: #10b981; color: white; }
        .btn-secondary { background: #6b7280; color: white; }

        /* ========== 500문제 그리드 ========== */
        .problems-section {
            background: var(--background-secondary);
            padding: 40px;
            border-radius: 25px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.3);
        }

        .problems-title {
            font-size: 2rem;
            font-weight: 800;
            margin-bottom: 30px;
            color: #3b82f6;
        }

        .problems-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(55px, 1fr));
            gap: 12px;
            max-height: 600px;
            overflow-y: auto;
            padding: 20px;
            border: 2px solid var(--background-modifier-border);
            border-radius: 20px;
            background: var(--background-primary);
        }

        .problem-cell {
            width: 55px;
            height: 55px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 12px;
            font-weight: 800;
            font-size: 1rem;
            cursor: pointer;
            transition: all 0.3s ease;
            position: relative;
        }

        .problem-cell:hover {
            transform: scale(1.15);
            z-index: 10;
            box-shadow: 0 8px 20px rgba(0,0,0,0.5);
        }

        .problem-cell.mastered {
            background: #10b981;
            color: white;
        }

        .problem-cell.reviewing {
            background: #f59e0b;
            color: white;
        }

        .problem-cell.learning {
            background: #ef4444;
            color: white;
        }

        .problem-cell.empty {
            background: var(--background-primary);
            border: 2px dashed var(--background-modifier-border);
            color: var(--text-muted);
        }

        .problem-cell.empty:hover {
            border-color: #3b82f6;
            color: #3b82f6;
        }

        .review-badge {
            position: absolute;
            top: -5px;
            right: -5px;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background: #8b5cf6;
            color: white;
            font-size: 0.7rem;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
        }

        /* ========== 문제 템플릿 ========== */
        .template-container {
            max-width: 1000px;
            margin: 0 auto;
            background: var(--background-secondary);
            padding: 50px;
            border-radius: 25px;
            box-shadow: 0 15px 50px rgba(0,0,0,0.4);
        }

        .problem-header {
            border-bottom: 4px solid #3b82f6;
            padding-bottom: 25px;
            margin-bottom: 40px;
        }

        .problem-title-main {
            font-size: 2.8rem;
            font-weight: 900;
            margin-bottom: 20px;
            color: #3b82f6;
        }

        .problem-meta {
            display: flex;
            gap: 25px;
            flex-wrap: wrap;
            font-size: 1.1rem;
            color: var(--text-muted);
        }

        .section {
            background: var(--background-primary);
            padding: 35px;
            border-radius: 20px;
            margin-bottom: 35px;
            border-left: 6px solid #3b82f6;
        }

        .section-title {
            font-size: 1.8rem;
            font-weight: 800;
            margin-bottom: 25px;
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .stopwatch-block {
            background: linear-gradient(135deg, #667eea, #764ba2);
            padding: 40px;
            border-radius: 20px;
            color: white;
            text-align: center;
            box-shadow: 0 10px 40px rgba(102, 126, 234, 0.3);
        }

        .stopwatch-title {
            font-size: 1.5rem;
            font-weight: 700;
            margin-bottom: 25px;
        }

        .stopwatch-display {
            font-size: 4.5rem;
            font-weight: 900;
            font-family: 'Courier New', monospace;
            margin: 25px 0;
            text-shadow: 0 5px 15px rgba(0,0,0,0.3);
            letter-spacing: 3px;
        }

        .stopwatch-controls {
            display: flex;
            gap: 15px;
            justify-content: center;
            flex-wrap: wrap;
            margin-top: 25px;
        }

        .usage-info {
            background: rgba(255,255,255,0.15);
            padding: 20px;
            border-radius: 15px;
            margin-top: 25px;
            font-size: 1rem;
            line-height: 2;
            backdrop-filter: blur(10px);
        }

        .image-placeholder {
            background: var(--background-secondary);
            border: 3px dashed var(--background-modifier-border);
            border-radius: 15px;
            padding: 80px;
            text-align: center;
            color: var(--text-muted);
            margin: 25px 0;
            cursor: pointer;
            transition: all 0.3s;
            font-size: 1.1rem;
        }

        .image-placeholder:hover {
            border-color: #3b82f6;
            color: #3b82f6;
            background: var(--background-primary);
        }

        .collapsible {
            background: var(--background-secondary);
            padding: 25px;
            border-radius: 15px;
            margin: 20px 0;
            cursor: pointer;
            transition: all 0.3s;
        }

        .collapsible:hover {
            background: var(--interactive-hover);
        }

        .collapsible-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-weight: 700;
            font-size: 1.1rem;
        }

        .collapsible-content {
            margin-top: 20px;
            padding-top: 20px;
            border-top: 2px solid var(--background-modifier-border);
        }

        .stats-table {
            width: 100%;
            border-collapse: collapse;
            margin: 25px 0;
        }

        .stats-table th,
        .stats-table td {
            padding: 15px;
            text-align: left;
            border: 1px solid var(--background-modifier-border);
        }

        .stats-table th {
            background: var(--background-primary);
            font-weight: 800;
            font-size: 1.05rem;
        }

        .grade-badge {
            display: inline-block;
            padding: 8px 20px;
            border-radius: 25px;
            font-weight: 800;
            font-size: 1rem;
        }

        .grade-s { background: #fbbf24; color: #000; }
        .grade-a { background: #10b981; color: white; }
        .grade-b { background: #3b82f6; color: white; }
        .grade-c { background: #f59e0b; color: white; }
        .grade-d { background: #ef4444; color: white; }

        /* ========== 타이머 모달 ========== */
        .problem-timer-modal .modal {
            background: var(--background-primary);
            border-radius: 20px;
            max-width: 800px;
            width: 90%;
        }

        .timer-modal-header {
            background: linear-gradient(135deg, #3b82f6, #1e40af);
            color: white;
            padding: 25px;
            border-radius: 15px;
            position: relative;
            text-align: center;
        }

        .timer-modal-title {
            font-size: 1.8rem;
            font-weight: 700;
            margin-bottom: 10px;
        }

        .timer-display {
            position: absolute;
            top: 15px;
            right: 20px;
            font-size: 2rem;
            font-weight: bold;
            padding: 15px 25px;
            background: rgba(255,255,255,0.2);
            border: 3px solid white;
            border-radius: 15px;
            font-family: 'Courier New', monospace;
        }

        .problem-content {
            background: var(--background-secondary);
            padding: 25px;
            border-radius: 15px;
            margin: 20px 0;
            border-left: 5px solid #3b82f6;
        }

        /* ========== 반응형 디자인 ========== */
        @media (max-width: 768px) {
            .main-title { font-size: 2.5rem; }
            .timer-display { font-size: 3.5rem; }
            .stopwatch-display { font-size: 3rem; }
            .problems-grid {
                grid-template-columns: repeat(auto-fill, minmax(45px, 1fr));
            }
            .problem-cell {
                width: 45px;
                height: 45px;
                font-size: 0.9rem;
            }
            .action-section {
                flex-direction: column;
                align-items: stretch;
            }
            .view-controls {
                justify-content: center;
            }
        }
    `;
    
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
}

// Part 5 완료 - 설정 탭 및 CSS 스타일 완성
console.log('📚 Part 5: 설정 탭 및 CSS 스타일 로드 완료');