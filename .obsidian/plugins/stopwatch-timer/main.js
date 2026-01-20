const { Plugin, Notice, PluginSettingTab, Setting } = require('obsidian');

// 기본 설정
const DEFAULT_SETTINGS = {
    theme: 'purple',
    showMilliseconds: true,
    autoSave: true,
    soundNotification: false,
    saveField: 'times',
    totalUses: 0,
    totalTime: 0
};

// 설정 탭 클래스
class StopwatchSettingTab extends PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: '⏱️ Stopwatch Timer 설정' });

        // 테마 설정
        new Setting(containerEl)
            .setName('타이머 테마')
            .setDesc('스톱워치의 색상 테마를 선택하세요')
            .addDropdown(dropdown => dropdown
                .addOption('purple', '💜 보라색 (기본)')
                .addOption('blue', '💙 파란색')
                .addOption('green', '💚 초록색')
                .addOption('orange', '🧡 주황색')
                .addOption('dark', '🖤 다크')
                .setValue(this.plugin.settings.theme)
                .onChange(async (value) => {
                    this.plugin.settings.theme = value;
                    await this.plugin.saveSettings();
                }));

        // 밀리초 표시 기본값
        new Setting(containerEl)
            .setName('밀리초 표시')
            .setDesc('새 타이머에서 기본으로 밀리초를 표시할지 설정')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showMilliseconds)
                .onChange(async (value) => {
                    this.plugin.settings.showMilliseconds = value;
                    await this.plugin.saveSettings();
                }));

        // 자동 저장
        new Setting(containerEl)
            .setName('자동 시간 기록')
            .setDesc('타이머 정지시 frontmatter에 자동으로 시간을 기록합니다')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.autoSave)
                .onChange(async (value) => {
                    this.plugin.settings.autoSave = value;
                    await this.plugin.saveSettings();
                }));

        // 소리 알림
        new Setting(containerEl)
            .setName('소리 알림')
            .setDesc('타이머 시작/정지시 소리로 알림')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.soundNotification)
                .onChange(async (value) => {
                    this.plugin.settings.soundNotification = value;
                    await this.plugin.saveSettings();
                }));

        // 기본 저장 폴더
        new Setting(containerEl)
            .setName('기록 저장 필드')
            .setDesc('시간 기록을 저장할 frontmatter 필드명')
            .addText(text => text
                .setPlaceholder('times')
                .setValue(this.plugin.settings.saveField)
                .onChange(async (value) => {
                    this.plugin.settings.saveField = value || 'times';
                    await this.plugin.saveSettings();
                }));

        // 통계 정보
        containerEl.createEl('h3', { text: '📊 사용 통계' });
        
        const statsEl = containerEl.createDiv({ cls: 'stopwatch-stats' });
        statsEl.innerHTML = `
            <div style="background: var(--background-secondary); padding: 15px; border-radius: 8px; margin: 10px 0;">
                <p><strong>총 사용 횟수:</strong> ${this.plugin.settings.totalUses}회</p>
                <p><strong>총 측정 시간:</strong> ${Math.floor(this.plugin.settings.totalTime / 60)}분 ${this.plugin.settings.totalTime % 60}초</p>
                <p><strong>평균 측정 시간:</strong> ${this.plugin.settings.totalUses > 0 ? Math.floor(this.plugin.settings.totalTime / this.plugin.settings.totalUses) : 0}초</p>
            </div>
        `;

        // 리셋 버튼
        new Setting(containerEl)
            .setName('통계 초기화')
            .setDesc('사용 통계를 모두 초기화합니다')
            .addButton(button => button
                .setButtonText('🗑️ 초기화')
                .setWarning()
                .onClick(async () => {
                    this.plugin.settings.totalUses = 0;
                    this.plugin.settings.totalTime = 0;
                    await this.plugin.saveSettings();
                    this.display(); // 화면 새로고침
                }));
    }
}

// 메인 플러그인 클래스
class StopwatchTimerPlugin extends Plugin {
    
    async onload() {
        console.log('⏱️ Stopwatch Timer Plugin 로드됨');
        
        // 설정 로드
        await this.loadSettings();
        
        // 설정 탭 추가
        this.addSettingTab(new StopwatchSettingTab(this.app, this));
        
        // CSS 스타일 추가
        this.addStyle();
        
        // 코드블록 프로세서 등록
        this.registerMarkdownCodeBlockProcessor('stopwatch', (source, el, ctx) => {
            this.renderStopwatch(source, el, ctx);
        });
        
        // 명령어 등록
        this.addCommands();
        
        new Notice('⏱️ Stopwatch Timer 플러그인 활성화!');
    }
    
    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }
    
    async saveSettings() {
        await this.saveData(this.settings);
    }
    
    addStyle() {
        // CSS 스타일을 직접 추가
        const style = document.createElement('style');
        style.textContent = `
            /* 테마별 색상 변수 */
            .stopwatch-theme-purple {
                --stopwatch-primary: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                --stopwatch-shadow: rgba(102, 126, 234, 0.3);
            }
            .stopwatch-theme-blue {
                --stopwatch-primary: linear-gradient(135deg, #3b82f6 0%, #1e40af 100%);
                --stopwatch-shadow: rgba(59, 130, 246, 0.3);
            }
            .stopwatch-theme-green {
                --stopwatch-primary: linear-gradient(135deg, #10b981 0%, #059669 100%);
                --stopwatch-shadow: rgba(16, 185, 129, 0.3);
            }
            .stopwatch-theme-orange {
                --stopwatch-primary: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
                --stopwatch-shadow: rgba(245, 158, 11, 0.3);
            }
            .stopwatch-theme-dark {
                --stopwatch-primary: linear-gradient(135deg, #374151 0%, #1f2937 100%);
                --stopwatch-shadow: rgba(55, 65, 81, 0.3);
            }
            
            /* 스톱워치 컨테이너 */
            .stopwatch-container {
                background: var(--stopwatch-primary);
                border-radius: 20px;
                padding: 30px;
                text-align: center;
                box-shadow: 0 10px 40px var(--stopwatch-shadow);
                margin: 20px 0;
                position: relative;
                transition: all 0.3s ease;
            }
            .stopwatch-container:hover {
                transform: translateY(-2px);
                box-shadow: 0 15px 50px var(--stopwatch-shadow);
            }
            
            /* 시간 표시 */
            .stopwatch-display {
                font-size: 4rem;
                font-weight: bold;
                color: white;
                font-family: 'SF Mono', 'Monaco', 'Courier New', monospace;
                margin: 20px 0;
                text-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
                letter-spacing: 0.05em;
                background: rgba(0, 0, 0, 0.1);
                padding: 20px;
                border-radius: 15px;
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.1);
            }
            
            /* 버튼 스타일 */
            .stopwatch-buttons {
                display: flex;
                gap: 15px;
                justify-content: center;
                margin-top: 25px;
                flex-wrap: wrap;
            }
            .stopwatch-btn {
                padding: 15px 25px;
                border: none;
                border-radius: 15px;
                font-weight: bold;
                cursor: pointer;
                transition: all 0.3s ease;
                min-width: 120px;
                font-size: 1rem;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.1);
            }
            .stopwatch-btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
            }
            .stopwatch-btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
                transform: none;
            }
            
            /* 버튼 색상 */
            .stopwatch-btn-start {
                background: linear-gradient(135deg, #10b981, #059669);
                color: white;
            }
            .stopwatch-btn-pause {
                background: linear-gradient(135deg, #f59e0b, #d97706);
                color: white;
            }
            .stopwatch-btn-stop {
                background: linear-gradient(135deg, #ef4444, #dc2626);
                color: white;
            }
            .stopwatch-btn-reset {
                background: linear-gradient(135deg, #6b7280, #4b5563);
                color: white;
            }
            
            /* 애니메이션 */
            @keyframes pulse {
                0% { transform: scale(1); }
                50% { transform: scale(1.05); }
                100% { transform: scale(1); }
            }
            .stopwatch-running .stopwatch-display {
                animation: pulse 2s infinite;
            }
            
            /* 반응형 디자인 */
            @media (max-width: 768px) {
                .stopwatch-display {
                    font-size: 2.5rem;
                    padding: 15px;
                }
                .stopwatch-buttons {
                    flex-direction: column;
                    align-items: center;
                }
                .stopwatch-btn {
                    width: 100%;
                    max-width: 300px;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    renderStopwatch(source, el, ctx) {
        // 설정 파싱
        const config = {
            autoStart: false,
            showMilliseconds: this.settings.showMilliseconds,
            theme: this.settings.theme,
            title: ''
        };
        
        source.split('\n').forEach(line => {
            const [key, value] = line.split(':').map(s => s.trim());
            if (key && value !== undefined) {
                if (key === 'autoStart') config.autoStart = value === 'true';
                if (key === 'showMilliseconds') config.showMilliseconds = value === 'true';
                if (key === 'theme') config.theme = value;
                if (key === 'title') config.title = value.replace(/['"]/g, '');
            }
        });
        
        el.empty();
        const stopwatchUI = this.createStopwatchUI(config, ctx);
        el.appendChild(stopwatchUI);
    }
    
    createStopwatchUI(config, ctx) {
        const container = document.createElement('div');
        container.className = `stopwatch-container stopwatch-theme-${config.theme}`;
        
        // 타이머 상태
        let startTime = 0;
        let elapsedTime = 0;
        let timerInterval = null;
        let isRunning = false;
        let isPaused = false;
        
        // 제목 표시
        if (config.title) {
            const titleEl = document.createElement('div');
            titleEl.style.cssText = `
                color: rgba(255, 255, 255, 0.9);
                font-size: 1.2rem;
                font-weight: 600;
                margin-bottom: 15px;
            `;
            titleEl.textContent = config.title;
            container.appendChild(titleEl);
        }
        
        // 시간 표시
        const timeDisplay = document.createElement('div');
        timeDisplay.className = 'stopwatch-display';
        timeDisplay.textContent = config.showMilliseconds ? '00:00.000' : '00:00';
        container.appendChild(timeDisplay);
        
        // 시간 포맷 함수
        const formatTime = (ms) => {
            const totalSeconds = Math.floor(ms / 1000);
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = totalSeconds % 60;
            const milliseconds = ms % 1000;
            
            if (config.showMilliseconds) {
                return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
            } else {
                return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            }
        };
        
        // 시간 업데이트
        const updateDisplay = () => {
            const currentTime = elapsedTime + (isRunning && !isPaused ? Date.now() - startTime : 0);
            timeDisplay.textContent = formatTime(currentTime);
        };
        
        // 버튼 컨테이너
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'stopwatch-buttons';
        
        // 버튼들 생성
        const startButton = document.createElement('button');
        startButton.className = 'stopwatch-btn stopwatch-btn-start';
        startButton.textContent = '▶️ 시작';
        
        const stopButton = document.createElement('button');
        stopButton.className = 'stopwatch-btn stopwatch-btn-stop';
        stopButton.textContent = '⏹️ 정지';
        stopButton.disabled = true;
        
        const resetButton = document.createElement('button');
        resetButton.className = 'stopwatch-btn stopwatch-btn-reset';
        resetButton.textContent = '🔄 초기화';
        
        // 이벤트 핸들러
        startButton.onclick = () => {
            if (!isRunning || isPaused) {
                // 시작/재개
                startTime = Date.now();
                isRunning = true;
                isPaused = false;
                
                timerInterval = setInterval(updateDisplay, config.showMilliseconds ? 10 : 100);
                
                startButton.textContent = '⏸️ 일시정지';
                startButton.className = 'stopwatch-btn stopwatch-btn-pause';
                stopButton.disabled = false;
                container.classList.add('stopwatch-running');
                
                new Notice('⏱️ 타이머 시작!');
            } else {
                // 일시정지
                isPaused = true;
                elapsedTime += Date.now() - startTime;
                clearInterval(timerInterval);
                
                startButton.textContent = '▶️ 재개';
                startButton.className = 'stopwatch-btn stopwatch-btn-start';
                container.classList.remove('stopwatch-running');
                
                new Notice('⏸️ 일시정지');
            }
        };
        
        stopButton.onclick = async () => {
            if (isRunning) {
                const finalTime = elapsedTime + (isPaused ? 0 : Date.now() - startTime);
                const totalSeconds = Math.floor(finalTime / 1000);
                
                clearInterval(timerInterval);
                isRunning = false;
                isPaused = false;
                container.classList.remove('stopwatch-running');
                
                // 통계 업데이트
                this.settings.totalUses++;
                this.settings.totalTime += totalSeconds;
                await this.saveSettings();
                
                // 자동 저장
                if (this.settings.autoSave) {
                    const file = this.app.workspace.getActiveFile();
                    if (file) {
                        await this.saveTimeToFrontmatter(file, totalSeconds);
                    }
                }
                
                startButton.textContent = '▶️ 시작';
                startButton.className = 'stopwatch-btn stopwatch-btn-start';
                stopButton.disabled = true;
                
                new Notice(`✅ 측정 완료: ${formatTime(finalTime)}`);
            }
        };
        
        resetButton.onclick = () => {
            clearInterval(timerInterval);
            isRunning = false;
            isPaused = false;
            elapsedTime = 0;
            startTime = 0;
            container.classList.remove('stopwatch-running');
            
            timeDisplay.textContent = config.showMilliseconds ? '00:00.000' : '00:00';
            startButton.textContent = '▶️ 시작';
            startButton.className = 'stopwatch-btn stopwatch-btn-start';
            stopButton.disabled = true;
            
            new Notice('🔄 타이머 초기화');
        };
        
        buttonContainer.appendChild(startButton);
        buttonContainer.appendChild(stopButton);
        buttonContainer.appendChild(resetButton);
        container.appendChild(buttonContainer);
        
        // 자동 시작
        if (config.autoStart) {
            setTimeout(() => startButton.click(), 100);
        }
        
        return container;
    }
    
    addCommands() {
        // 새 타이머 삽입
        this.addCommand({
            id: 'insert-stopwatch',
            name: '⏱️ 스톱워치 타이머 삽입',
            editorCallback: (editor) => {
                const template = `
\`\`\`stopwatch
title: "문제 풀이 타이머"
showMilliseconds: true
autoStart: false
theme: ${this.settings.theme}
\`\`\``;
                editor.replaceSelection(template);
            }
        });
        
        // 설정 열기
        this.addCommand({
            id: 'open-settings',
            name: '⚙️ 스톱워치 설정 열기',
            callback: () => {
                this.app.setting.open();
                this.app.setting.openTabById('stopwatch-timer');
            }
        });
        
        // 테스트 명령어
        this.addCommand({
            id: 'test-stopwatch',
            name: '🧪 스톱워치 테스트',
            callback: () => {
                new Notice('✅ Stopwatch Timer 플러그인 정상 작동!');
                console.log('Stopwatch Timer 설정:', this.settings);
            }
        });
    }
    
    async saveTimeToFrontmatter(file, timeInSeconds) {
    try {
        const content = await this.app.vault.read(file);
        const cache = this.app.metadataCache.getFileCache(file);
        const frontmatter = cache?.frontmatter || {};
        const fieldName = this.settings.saveField;
        let times = frontmatter[fieldName] || [];
        // 타입 방어: times가 문자열/숫자/배열 등일 수 있음
        if (typeof times === 'string') {
            times = times.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
        } else if (typeof times === 'number') {
            times = [times];
        } else if (!Array.isArray(times)) {
            times = [];
        }
        // 입력값 방어: 0초/음수 저장 방지
        if (typeof timeInSeconds !== 'number' || isNaN(timeInSeconds) || timeInSeconds <= 0) {
            console.warn('⚠️ 저장할 시간이 비정상적입니다:', timeInSeconds);
            return;
        }
        times.push(timeInSeconds);
        // frontmatter 업데이트 로직
        const lines = content.split('\n');
        let inFrontmatter = false;
        let updatedLines = [];
        let fieldUpdated = false;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.trim() === '---') {
                if (!inFrontmatter) {
                    inFrontmatter = true;
                    updatedLines.push(line);
                } else {
                    if (!fieldUpdated) {
                        updatedLines.push(`${fieldName}: [${times.join(', ')}]`);
                    }
                    updatedLines.push(line);
                    inFrontmatter = false;
                }
            } else if (inFrontmatter) {
                if (line.startsWith(`${fieldName}:`)) {
                    updatedLines.push(`${fieldName}: [${times.join(', ')}]`);
                    fieldUpdated = true;
                } else {
                    updatedLines.push(line);
                }
            } else {
                updatedLines.push(line);
            }
        }
        await this.app.vault.modify(file, updatedLines.join('\n'));
        console.log(`✅ ${fieldName} 필드에 시간 저장:`, timeInSeconds, '전체:', times);
    } catch (error) {
        console.error('❌ frontmatter 저장 실패:', error);
    }
}
    
    onunload() {
        console.log('⏱️ Stopwatch Timer Plugin 언로드됨');
    }
}

module.exports = StopwatchTimerPlugin;