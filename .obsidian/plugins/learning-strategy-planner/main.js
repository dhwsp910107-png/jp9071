// =====================================================
// Learning Strategy Planner Plugin
// 퀴즈 관리 및 학습 계획 통합 플러그인
// Part 1: 설정, 임포트, 기본 구조
// =====================================================

const { Plugin, PluginSettingTab, Setting, MarkdownView, Notice, Modal, Menu, ItemView, TFolder, MarkdownRenderer, Component, TFile } = require('obsidian');
const { EditorView, Decoration, ViewPlugin, WidgetType } = require('@codemirror/view');
const { syntaxTree } = require('@codemirror/language');

// =====================================================
// 기본 설정
// =====================================================
const DEFAULT_SETTINGS = {
    // 폴더 관리
    dashboardFileName: 'Learning Planner Dashboard.md',
    clozeFolder: 'HanziQuiz',
    questionFolders: ['기본', '중급', '고급', '특별'],
    questionSubFolder: 'Questions',
    imageSubFolder: '첨부파일',
    imageClozeFolder: 'Learning/첨부파일',
    
    // 기본 퀴즈 설정
    shuffleQuestions: false,
    showProgress: true,
    autoSave: true,
    historyRetentionDays: 30,
    autoCreateWrongAnswerNote: false,
    defaultDifficulty: '보통',
    
    // 퀴즈 모드 기본 설정
    defaultQuizCount: 10,
    defaultTimerEnabled: true,
    defaultTimerPerQuestion: 30,
    defaultShuffleQuestions: true,
    defaultShuffleOptions: true,
    
    // 북마크 설정
    bookmarks: [],
    bookmarkFolder: '⭐ 북마크',
    
    // 퀴즈 데이터
    quizzes: {},
    
    // 폴더별 통계
    stats: {
        totalAttempts: 0,
        totalCorrect: 0,
        totalTime: 0,
        lastStudyDate: null,
        studyHistory: [],
        folderStats: {},
        fileStats: {}
    }
};

// =====================================================
// 대시보드 뷰 타입
// =====================================================
const DASHBOARD_VIEW_TYPE = 'learning-planner-view';

// =====================================================
// 타이머 관리 클래스
// =====================================================
class ClozeTimer {
    constructor(plugin, container, duration) {
        this.plugin = plugin;
        this.container = container;
        this.duration = duration || plugin.settings.defaultTimerDuration;
        this.remaining = this.duration;
        this.isRunning = false;
        this.interval = null;
        this.timerElement = null;
        this.startTime = null;
        this.expired = false; // 만료 상태 추적
    }

    create() {
        // 기존 타이머 제거
        const existing = this.container.querySelector('.cloze-timer-container-local');
        if (existing) existing.remove();

        // 타이머 컨테이너 생성
        this.timerElement = this.container.createDiv({ cls: 'cloze-timer-container-local' });
        
        const position = this.plugin.settings.timerPosition;
        if (position === 'floating') {
            this.timerElement.addClass('cloze-timer-floating');
        } else if (position === 'bottom') {
            this.timerElement.addClass('cloze-timer-bottom');
        }

        this.timerElement.innerHTML = `
            <div class="cloze-timer-progress-local">
                <div class="cloze-timer-fill-local"></div>
            </div>
            <div class="cloze-timer-text-local">⏱️ ${this.duration}초</div>
            <div class="cloze-timer-controls-local">
                <input type="number" class="cloze-timer-input-local" value="${this.duration}" min="5" max="300" title="타이머 시간(초)" style="width: 50px; padding: 2px 4px; margin-right: 4px;" />
                <button class="cloze-timer-btn-local cloze-timer-set-local" title="시간 설정">⚙️</button>
                <button class="cloze-timer-btn-local cloze-timer-start-local" title="시작">▶</button>
                <button class="cloze-timer-btn-local cloze-timer-pause-local" title="일시정지" disabled>⏸</button>
                <button class="cloze-timer-btn-local cloze-timer-reset-local" title="리셋">⟲</button>
            </div>
        `;

        // 위치에 따라 삽입
        if (position === 'bottom') {
            this.container.appendChild(this.timerElement);
        } else {
            this.container.insertBefore(this.timerElement, this.container.firstChild);
        }

        this.attachEvents();
        
        if (this.plugin.settings.autoStartTimer) {
            setTimeout(() => this.start(), 100);
        }

        return this.timerElement;
    }

    attachEvents() {
        const startBtn = this.timerElement.querySelector('.cloze-timer-start-local');
        const pauseBtn = this.timerElement.querySelector('.cloze-timer-pause-local');
        const resetBtn = this.timerElement.querySelector('.cloze-timer-reset-local');
        const setBtn = this.timerElement.querySelector('.cloze-timer-set-local');
        const input = this.timerElement.querySelector('.cloze-timer-input-local');

        // 클릭 및 터치 이벤트 지원 (모바일 호환)
        const startHandler = (e) => { e.preventDefault(); this.start(); };
        const pauseHandler = (e) => { e.preventDefault(); this.pause(); };
        const resetHandler = (e) => { e.preventDefault(); this.reset(); };
        const setHandler = async (e) => { 
            e.preventDefault(); 
            const newDuration = parseInt(input.value);
            if (newDuration && newDuration >= 5 && newDuration <= 300) {
                this.duration = newDuration;
                this.remaining = newDuration;
                await this.plugin.setTimerDuration(newDuration);
                this.updateDisplay();
                new Notice(`타이머 ${newDuration}초로 설정되었습니다`);
            }
        };

        startBtn?.addEventListener('click', startHandler);
        startBtn?.addEventListener('touchend', startHandler);
        pauseBtn?.addEventListener('click', pauseHandler);
        pauseBtn?.addEventListener('touchend', pauseHandler);
        resetBtn?.addEventListener('click', resetHandler);
        resetBtn?.addEventListener('touchend', resetHandler);
        setBtn?.addEventListener('click', setHandler);
        setBtn?.addEventListener('touchend', setHandler);
        
        // Enter 키로도 설정 가능
        input?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                setHandler(e);
            }
        });
    }

    start() {
        if (this.isRunning) return;

        this.isRunning = true;
        this.startTime = Date.now() - ((this.duration - this.remaining) * 1000);

        this.interval = setInterval(() => this.update(), 100);
        
        const startBtn = this.timerElement?.querySelector('.cloze-timer-start-local');
        const pauseBtn = this.timerElement?.querySelector('.cloze-timer-pause-local');
        
        if (startBtn) startBtn.disabled = true;
        if (pauseBtn) pauseBtn.disabled = false;
    }

    pause() {
        if (!this.isRunning) return;

        this.isRunning = false;
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }

        const startBtn = this.timerElement?.querySelector('.cloze-timer-start-local');
        const pauseBtn = this.timerElement?.querySelector('.cloze-timer-pause-local');
        
        if (startBtn) startBtn.disabled = false;
        if (pauseBtn) pauseBtn.disabled = true;
    }

    reset() {
        this.pause();
        this.remaining = this.duration;
        this.startTime = null;
        this.updateDisplay();
        
        // 상태 클래스 제거
        this.timerElement?.classList.remove('timer-warning', 'timer-expired');
    }

    update() {
        if (!this.isRunning) return;

        const elapsed = (Date.now() - this.startTime) / 1000;
        this.remaining = Math.max(0, this.duration - elapsed);

        this.updateDisplay();

        // 경고 상태
        const warningThreshold = this.plugin.settings.timerWarningThreshold;
        if (this.remaining <= warningThreshold && this.remaining > 0) {
            this.timerElement?.classList.add('timer-warning');
            this.timerElement?.classList.remove('timer-expired');
        }

        // 만료 상태 - 0초가 되면 실행
        if (this.remaining <= 0 && !this.expired) {
            this.timerElement?.classList.add('timer-expired');
            this.timerElement?.classList.remove('timer-warning');
            this.onExpire();
        }
    }

    updateDisplay() {
        const textEl = this.timerElement?.querySelector('.cloze-timer-text-local');
        const fillEl = this.timerElement?.querySelector('.cloze-timer-fill-local');

        if (textEl) {
            // 카운트다운 표시: 남은 시간을 초 단위로
            if (this.remaining <= 0) {
                textEl.textContent = '⏰ 시간 종료!';
            } else {
                const seconds = Math.ceil(this.remaining);
                textEl.textContent = `⏱️ ${seconds}초`;
            }
        }

        if (fillEl) {
            const percent = (this.remaining / this.duration) * 100;
            fillEl.style.width = `${Math.max(0, percent)}%`;
        }
    }

    onExpire() {
        // 이미 만료된 타이머는 다시 처리하지 않음
        if (this.expired) return;
        this.expired = true;
        
        this.pause();
        
        // 진동 피드백 (사용자 인터랙션이 있었을 때만)
        if (this.plugin.settings.enableVibration && navigator.vibrate) {
            try {
                navigator.vibrate([300, 100, 300]);
            } catch (e) {
                // 진동 실패 시 무시
                console.log('진동 피드백 실패 (사용자 인터랙션 필요)');
            }
        }

        // 알림
        new Notice('⏰ 시간이 종료되었습니다!');
        
        // 자동으로 모든 빈칸 보이기
        if (this.plugin.settings.enableAutoRevealOnTimeout) {
            const container = this.container.closest('.markdown-preview-view') || this.container;
            const clozes = container.querySelectorAll('.genuine-cloze[data-show-state="hint"], .pseudo-cloze[data-show-state="hint"]');
            
            if (clozes.length > 0) {
                clozes.forEach(cloze => {
                    cloze.setAttribute('data-show-state', 'answer');
                    this.plugin.updateClozeDisplay(cloze);
                });
                new Notice(`✅ ${clozes.length}개의 정답이 자동으로 공개되었습니다`);
            }
        }
    }

    destroy() {
        this.pause();
        // 타이머 파괴 시에는 기록하지 않음 (재생/일시정지는 기록 안 함)
        if (this.timerElement) {
            this.timerElement.remove();
        }
    }
}

// =====================================================
// 테스트 메모 모달 클래스
// =====================================================

class TestNoteAddModal extends Modal {
    constructor(app, onAdd) {
        super(app);
        this.onAdd = onAdd;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h2', { text: '새 메모 추가' });

        const form = contentEl.createDiv();
        form.createEl('label', { text: '내용' });
        const textArea = form.createEl('textarea');
        textArea.style.cssText = 'width: 100%; min-height: 100px; margin-bottom: 15px; padding: 10px;';

        const btnContainer = form.createDiv();
        btnContainer.style.cssText = 'display: flex; gap: 10px; justify-content: flex-end;';

        const addBtn = btnContainer.createEl('button', { text: '추가' });
        addBtn.style.cssText = 'background: var(--interactive-accent); color: var(--text-on-accent); padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer;';
        addBtn.onclick = () => {
            const text = textArea.value.trim();
            if (text) {
                this.onAdd(text);
                this.close();
                new Notice('메모가 추가되었습니다!');
            }
        };

        const cancelBtn = btnContainer.createEl('button', { text: '취소' });
        cancelBtn.style.cssText = 'padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; background: var(--background-secondary);';
        cancelBtn.onclick = () => this.close();

        textArea.focus();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

class TestNoteEditModal extends Modal {
    constructor(app, currentText, onSave, onDelete) {
        super(app);
        this.currentText = currentText;
        this.onSave = onSave;
        this.onDelete = onDelete;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h2', { text: '메모 수정' });

        const form = contentEl.createDiv();
        form.createEl('label', { text: '내용' });
        const textArea = form.createEl('textarea');
        textArea.value = this.currentText;
        textArea.style.cssText = 'width: 100%; min-height: 100px; margin-bottom: 15px; padding: 10px;';

        const btnContainer = form.createDiv();
        btnContainer.style.cssText = 'display: flex; gap: 10px; justify-content: space-between;';

        const deleteBtn = btnContainer.createEl('button', { text: '삭제' });
        deleteBtn.style.cssText = 'background: #dc2626; color: white; padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer;';
        deleteBtn.onclick = () => {
            if (confirm('이 메모를 삭제하시겠습니까?')) {
                this.onDelete();
                this.close();
                new Notice('메모가 삭제되었습니다!');
            }
        };

        const rightBtnGroup = btnContainer.createDiv();
        rightBtnGroup.style.cssText = 'display: flex; gap: 10px;';

        const saveBtn = rightBtnGroup.createEl('button', { text: '저장' });
        saveBtn.style.cssText = 'background: var(--interactive-accent); color: var(--text-on-accent); padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer;';
        saveBtn.onclick = () => {
            const text = textArea.value.trim();
            if (text) {
                this.onSave(text);
                this.close();
                new Notice('메모가 수정되었습니다!');
            }
        };

        const cancelBtn = rightBtnGroup.createEl('button', { text: '취소' });
        cancelBtn.style.cssText = 'padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; background: var(--background-secondary);';
        cancelBtn.onclick = () => this.close();

        textArea.focus();
        textArea.setSelectionRange(textArea.value.length, textArea.value.length);
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// =====================================================
// Part 2: 대시보드 뷰 클래스
// =====================================================

class ClozeDashboardView extends ItemView {
    constructor(leaf, plugin) {
        super(leaf);
        this.plugin = plugin;
        this.currentTab = 'cloze'; // 'cloze', 'test-daily', 'test-weekly', 'test-monthly'
        this.currentDate = new Date();
    }

    getViewType() {
        return DASHBOARD_VIEW_TYPE;
    }

    getDisplayText() {
        return '📚 학습 플래너';
    }

    getIcon() {
        return 'layout-dashboard';
    }

    async onOpen() {
        const container = this.containerEl.children[1];
        container.empty();
        container.addClass('cloze-dashboard-container');

        await this.renderDashboard(container);
    }

    async renderDashboard(container) {
        // 헤더
        const header = container.createDiv({ cls: 'cloze-dashboard-header' });
        header.createEl('h2', { text: '📚 학습 플래너 대시보드' });
        
        // 탭 네비게이션
        const tabNav = header.createDiv({ cls: 'cloze-tab-nav' });
        
        const clozeTab = tabNav.createEl('button', { 
            text: '📝 문제 풀기',
            cls: 'cloze-tab-btn' 
        });
        if (this.currentTab === 'cloze') clozeTab.addClass('active');
        const clozeHandler = () => {
            this.currentTab = 'cloze';
            this.onOpen();
        };
        clozeTab.onclick = clozeHandler;
        clozeTab.addEventListener('touchend', (e) => {
            e.preventDefault();
            clozeHandler();
        });
        
        const dailyTab = tabNav.createEl('button', { 
            text: '📅 일별 문제풀기',
            cls: 'cloze-tab-btn' 
        });
        if (this.currentTab === 'test-daily') dailyTab.addClass('active');
        const dailyHandler = () => {
            this.currentTab = 'test-daily';
            this.onOpen();
        };
        dailyTab.onclick = dailyHandler;
        dailyTab.addEventListener('touchend', (e) => {
            e.preventDefault();
            dailyHandler();
        });
        
        const weeklyTab = tabNav.createEl('button', { 
            text: '📆 주간 테스트',
            cls: 'cloze-tab-btn' 
        });
        if (this.currentTab === 'test-weekly') weeklyTab.addClass('active');
        const weeklyHandler = () => {
            this.currentTab = 'test-weekly';
            this.onOpen();
        };
        weeklyTab.onclick = weeklyHandler;
        weeklyTab.addEventListener('touchend', (e) => {
            e.preventDefault();
            weeklyHandler();
        });
        
        const monthlyTab = tabNav.createEl('button', { 
            text: '📊 월간 테스트',
            cls: 'cloze-tab-btn' 
        });
        if (this.currentTab === 'test-monthly') monthlyTab.addClass('active');
        const monthlyHandler = () => {
            this.currentTab = 'test-monthly';
            this.onOpen();
        };
        monthlyTab.onclick = monthlyHandler;
        monthlyTab.addEventListener('touchend', (e) => {
            e.preventDefault();
            monthlyHandler();
        });

        const headerButtons = header.createDiv({ cls: 'cloze-dashboard-header-buttons' });
        
        const refreshBtn = headerButtons.createEl('button', { 
            text: '🔄 새로고침',
            cls: 'cloze-dashboard-btn'
        });
        const refreshHandler = (e) => {
            e.preventDefault();
            this.onOpen();
        };
        refreshBtn.addEventListener('click', refreshHandler);
        refreshBtn.addEventListener('touchend', refreshHandler);

        const exportBtn = headerButtons.createEl('button', { 
            text: '📥 내보내기',
            cls: 'cloze-dashboard-btn'
        });
        const exportHandler = (e) => {
            e.preventDefault();
            this.exportStatistics();
        };
        exportBtn.addEventListener('click', exportHandler);
        exportBtn.addEventListener('touchend', exportHandler);

        // 목표 요약 섹션 (모든 탭에서 표시)
        this.renderGoalsSummary(container);

        // 탭별 콘텐츠 렌더링
        if (this.currentTab === 'cloze') {
            await this.renderClozeTab(container);
        } else if (this.currentTab === 'test-daily') {
            await this.renderTestDailyTab(container);
        } else if (this.currentTab === 'test-weekly') {
            await this.renderTestWeeklyTab(container);
        } else if (this.currentTab === 'test-monthly') {
            await this.renderTestMonthlyTab(container);
        }
    }
    
    renderGoalsSummary(container) {
        const summarySection = container.createDiv({ cls: 'cloze-goals-summary' });
        summarySection.style.cssText = 'background: linear-gradient(135deg, var(--background-secondary) 0%, var(--background-primary) 100%); padding: 16px; border-radius: 12px; margin-bottom: 20px; border: 1px solid var(--background-modifier-border);';
        
        const summaryGrid = summarySection.createDiv();
        summaryGrid.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 12px;';
        
        // 주간 목표
        const weekKey = this.getWeekKey(new Date());
        const weeklyData = this.plugin.settings.weeklyChecklists?.[weekKey];
        
        const weeklyBox = summaryGrid.createDiv();
        weeklyBox.style.cssText = 'background: var(--background-primary); padding: 12px; border-radius: 8px; border: 2px solid #3b82f6; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s;';
        weeklyBox.addEventListener('mouseenter', () => {
            weeklyBox.style.transform = 'translateY(-2px)';
            weeklyBox.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
        });
        weeklyBox.addEventListener('mouseleave', () => {
            weeklyBox.style.transform = 'translateY(0)';
            weeklyBox.style.boxShadow = 'none';
        });
        
        const weeklyClickHandler = () => {
            this.currentTab = 'test-weekly';
            this.onOpen();
        };
        weeklyBox.onclick = weeklyClickHandler;
        
        // 터치 이벤트 개선 (스크롤과 탭 구분)
        let weeklyTouchStartY = 0;
        let weeklyTouchStartX = 0;
        weeklyBox.addEventListener('touchstart', (e) => {
            weeklyTouchStartY = e.touches[0].clientY;
            weeklyTouchStartX = e.touches[0].clientX;
        });
        weeklyBox.addEventListener('touchend', (e) => {
            const touchEndY = e.changedTouches[0].clientY;
            const touchEndX = e.changedTouches[0].clientX;
            const deltaY = Math.abs(touchEndY - weeklyTouchStartY);
            const deltaX = Math.abs(touchEndX - weeklyTouchStartX);
            
            // 이동 거리가 10px 미만이면 탭으로 인식
            if (deltaY < 10 && deltaX < 10) {
                e.preventDefault();
                weeklyClickHandler();
            }
        });
        
        const weeklyTitle = weeklyBox.createEl('div', { text: '🎯 주간 목표' });
        weeklyTitle.style.cssText = 'font-weight: bold; margin-bottom: 8px; color: #3b82f6; font-size: 1.05em;';
        
        // 메모 섹션 (상단 배치)
        const weeklyNotesSection = weeklyBox.createDiv();
        weeklyNotesSection.style.cssText = 'margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid var(--background-modifier-border);';
        
        if (weeklyData && weeklyData.notes && weeklyData.notes.length > 0) {
            weeklyData.notes.forEach((note, idx) => {
                const noteItem = weeklyNotesSection.createDiv();
                noteItem.style.cssText = 'margin-bottom: 6px; display: flex; align-items: flex-start; gap: 6px; font-size: 0.85em; color: #1e40af; font-style: italic; font-weight: 500;';
                
                const noteText = noteItem.createEl('div', { text: `📝 ${note}` });
                noteText.style.cssText = 'flex: 1; word-wrap: break-word; white-space: pre-wrap; overflow-wrap: break-word; cursor: pointer;';
                noteText.onclick = (e) => {
                    e.stopPropagation();
                    new TestNoteEditModal(this.app, note, (newText) => {
                        if (!this.plugin.settings.weeklyChecklists) this.plugin.settings.weeklyChecklists = {};
                        if (!this.plugin.settings.weeklyChecklists[weekKey]) this.plugin.settings.weeklyChecklists[weekKey] = { items: [], notes: [] };
                        this.plugin.settings.weeklyChecklists[weekKey].notes[idx] = newText;
                        this.plugin.saveSettings();
                        this.onOpen();
                    }, () => {
                        this.plugin.settings.weeklyChecklists[weekKey].notes.splice(idx, 1);
                        this.plugin.saveSettings();
                        this.onOpen();
                    }).open();
                };
            });
        }
        
        const addWeeklyNoteBtn = weeklyNotesSection.createEl('button', { text: '+ 메모 추가' });
        addWeeklyNoteBtn.style.cssText = 'padding: 4px 8px; background: var(--interactive-accent); color: var(--text-on-accent); border: none; border-radius: 4px; font-size: 0.8em; cursor: pointer; margin-top: 4px;';
        addWeeklyNoteBtn.onclick = (e) => {
            e.stopPropagation();
            new TestNoteAddModal(this.app, (text) => {
                if (!this.plugin.settings.weeklyChecklists) this.plugin.settings.weeklyChecklists = {};
                if (!this.plugin.settings.weeklyChecklists[weekKey]) this.plugin.settings.weeklyChecklists[weekKey] = { items: [], notes: [] };
                if (!this.plugin.settings.weeklyChecklists[weekKey].notes) this.plugin.settings.weeklyChecklists[weekKey].notes = [];
                this.plugin.settings.weeklyChecklists[weekKey].notes.push(text);
                this.plugin.saveSettings();
                this.onOpen();
            }).open();
        };
        
        if (weeklyData && weeklyData.items && weeklyData.items.length > 0) {
            const completed = weeklyData.items.filter(item => item.completed).length;
            const total = weeklyData.items.length;
            const percent = Math.round((completed / total) * 100);
            
            const progress = weeklyBox.createEl('div', { 
                text: `${completed}/${total} 완료 (${percent}%)` 
            });
            progress.style.cssText = 'font-size: 0.95em; color: #3b82f6; font-weight: 500; margin-bottom: 6px;';
            
            const progressBar = weeklyBox.createDiv();
            progressBar.style.cssText = 'background: var(--background-modifier-border); height: 6px; border-radius: 3px; overflow: hidden; margin-bottom: 8px;';
            const progressFill = progressBar.createDiv();
            progressFill.style.cssText = `background: #3b82f6; width: ${percent}%; height: 100%; transition: width 0.3s;`;
            
            // 최근 3개 목표 표시
            const recentItems = weeklyData.items.slice(0, 3);
            recentItems.forEach(item => {
                const itemDiv = weeklyBox.createDiv();
                itemDiv.style.cssText = 'font-size: 0.88em; margin-top: 4px; display: flex; align-items: center; gap: 6px; padding: 4px 0;';
                const icon = itemDiv.createEl('span', { text: item.completed ? '✅' : '⬜' });
                const text = itemDiv.createEl('span', { text: item.text });
                text.style.cssText = item.completed ? 'text-decoration: line-through; color: var(--text-muted);' : 'color: #2563eb; font-weight: 600;';
            });
        } else {
            const emptyText = weeklyBox.createEl('div', { text: '클릭하여 목표 추가' });
            emptyText.style.cssText = 'color: var(--text-muted); font-size: 0.9em;';
        }
        
        // 버튼 그룹 (숨김 - 클릭 영역만 제공)
        const weeklyBtnGroup = weeklyBox.createDiv();
        weeklyBtnGroup.style.cssText = 'display: none;';
        
        const weeklyQuizBtn = weeklyBtnGroup.createEl('button', { text: '🎯 퀴즈' });
        const weeklyQuizHandler = (e) => {
            e.stopPropagation();
            this.currentTab = 'test-weekly';
            this.onOpen();
        };
        weeklyQuizBtn.onclick = weeklyQuizHandler;
        
        const weeklyListBtn = weeklyBtnGroup.createEl('button', { text: '📋 목록' });
        const weeklyListHandler = (e) => {
            e.stopPropagation();
            this.currentTab = 'test-weekly';
            this.onOpen();
        };
        weeklyListBtn.onclick = weeklyListHandler;
        
        // 월간 목표
        const monthKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
        const monthlyData = this.plugin.settings.monthlyChecklists?.[monthKey];
        
        const monthlyBox = summaryGrid.createDiv();
        monthlyBox.style.cssText = 'background: var(--background-primary); padding: 12px; border-radius: 8px; border: 2px solid #10b981; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s;';
        monthlyBox.addEventListener('mouseenter', () => {
            monthlyBox.style.transform = 'translateY(-2px)';
            monthlyBox.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)';
        });
        monthlyBox.addEventListener('mouseleave', () => {
            monthlyBox.style.transform = 'translateY(0)';
            monthlyBox.style.boxShadow = 'none';
        });
        
        const monthlyClickHandler = () => {
            this.currentTab = 'test-monthly';
            this.onOpen();
        };
        monthlyBox.onclick = monthlyClickHandler;
        
        // 터치 이벤트 개선 (스크롤과 탭 구분)
        let monthlyTouchStartY = 0;
        let monthlyTouchStartX = 0;
        monthlyBox.addEventListener('touchstart', (e) => {
            monthlyTouchStartY = e.touches[0].clientY;
            monthlyTouchStartX = e.touches[0].clientX;
        });
        monthlyBox.addEventListener('touchend', (e) => {
            const touchEndY = e.changedTouches[0].clientY;
            const touchEndX = e.changedTouches[0].clientX;
            const deltaY = Math.abs(touchEndY - monthlyTouchStartY);
            const deltaX = Math.abs(touchEndX - monthlyTouchStartX);
            
            // 이동 거리가 10px 미만이면 탭으로 인식
            if (deltaY < 10 && deltaX < 10) {
                e.preventDefault();
                monthlyClickHandler();
            }
        });
        
        const monthlyTitle = monthlyBox.createEl('div', { text: '📋 월간 목표' });
        monthlyTitle.style.cssText = 'font-weight: bold; margin-bottom: 8px; color: #10b981; font-size: 1.05em;';
        
        // 메모 섹션 (상단 배치)
        const monthlyNotesSection = monthlyBox.createDiv();
        monthlyNotesSection.style.cssText = 'margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid var(--background-modifier-border);';
        
        if (monthlyData && monthlyData.notes && monthlyData.notes.length > 0) {
            monthlyData.notes.forEach((note, idx) => {
                const noteItem = monthlyNotesSection.createDiv();
                noteItem.style.cssText = 'margin-bottom: 6px; display: flex; align-items: flex-start; gap: 6px; font-size: 0.85em; color: #047857; font-style: italic; font-weight: 500;';
                
                const noteText = noteItem.createEl('div', { text: `📝 ${note}` });
                noteText.style.cssText = 'flex: 1; word-wrap: break-word; white-space: pre-wrap; overflow-wrap: break-word; cursor: pointer;';
                noteText.onclick = (e) => {
                    e.stopPropagation();
                    new TestNoteEditModal(this.app, note, (newText) => {
                        if (!this.plugin.settings.monthlyChecklists) this.plugin.settings.monthlyChecklists = {};
                        if (!this.plugin.settings.monthlyChecklists[monthKey]) this.plugin.settings.monthlyChecklists[monthKey] = { items: [], notes: [] };
                        this.plugin.settings.monthlyChecklists[monthKey].notes[idx] = newText;
                        this.plugin.saveSettings();
                        this.onOpen();
                    }, () => {
                        this.plugin.settings.monthlyChecklists[monthKey].notes.splice(idx, 1);
                        this.plugin.saveSettings();
                        this.onOpen();
                    }).open();
                };
            });
        }
        
        const addMonthlyNoteBtn = monthlyNotesSection.createEl('button', { text: '+ 메모 추가' });
        addMonthlyNoteBtn.style.cssText = 'padding: 4px 8px; background: var(--interactive-accent); color: var(--text-on-accent); border: none; border-radius: 4px; font-size: 0.8em; cursor: pointer; margin-top: 4px;';
        addMonthlyNoteBtn.onclick = (e) => {
            e.stopPropagation();
            new TestNoteAddModal(this.app, (text) => {
                if (!this.plugin.settings.monthlyChecklists) this.plugin.settings.monthlyChecklists = {};
                if (!this.plugin.settings.monthlyChecklists[monthKey]) this.plugin.settings.monthlyChecklists[monthKey] = { items: [], notes: [] };
                if (!this.plugin.settings.monthlyChecklists[monthKey].notes) this.plugin.settings.monthlyChecklists[monthKey].notes = [];
                this.plugin.settings.monthlyChecklists[monthKey].notes.push(text);
                this.plugin.saveSettings();
                this.onOpen();
            }).open();
        };
        
        if (monthlyData && monthlyData.items && monthlyData.items.length > 0) {
            const completed = monthlyData.items.filter(item => item.completed).length;
            const total = monthlyData.items.length;
            const percent = Math.round((completed / total) * 100);
            
            const progress = monthlyBox.createEl('div', { 
                text: `${completed}/${total} 완료 (${percent}%)` 
            });
            progress.style.cssText = 'font-size: 0.95em; color: #10b981; font-weight: 500; margin-bottom: 6px;';
            
            const progressBar = monthlyBox.createDiv();
            progressBar.style.cssText = 'background: var(--background-modifier-border); height: 6px; border-radius: 3px; overflow: hidden; margin-bottom: 8px;';
            const progressFill = progressBar.createDiv();
            progressFill.style.cssText = `background: #10b981; width: ${percent}%; height: 100%; transition: width 0.3s;`;
            
            // 최근 3개 목표 표시
            const recentItems = monthlyData.items.slice(0, 3);
            recentItems.forEach(item => {
                const itemDiv = monthlyBox.createDiv();
                itemDiv.style.cssText = 'font-size: 0.88em; margin-top: 4px; display: flex; align-items: center; gap: 6px; padding: 4px 0;';
                const icon = itemDiv.createEl('span', { text: item.completed ? '✅' : '⬜' });
                const text = itemDiv.createEl('span', { text: item.text });
                text.style.cssText = item.completed ? 'text-decoration: line-through; color: var(--text-muted);' : 'color: #059669; font-weight: 600;';
            });
        } else {
            const emptyText = monthlyBox.createEl('div', { text: '클릭하여 목표 추가' });
            emptyText.style.cssText = 'color: var(--text-muted); font-size: 0.9em;';
        }
        
        // 버튼 그룹 (숨김 - 클릭 영역만 제공)
        const monthlyBtnGroup = monthlyBox.createDiv();
        monthlyBtnGroup.style.cssText = 'display: none;';
        
        const monthlyQuizBtn = monthlyBtnGroup.createEl('button', { text: '🎯 퀴즈' });
        const monthlyQuizHandler = (e) => {
            e.stopPropagation();
            this.currentTab = 'test-monthly';
            this.onOpen();
        };
        monthlyQuizBtn.onclick = monthlyQuizHandler;
        
        const monthlyListBtn = monthlyBtnGroup.createEl('button', { text: '📋 목록' });
        const monthlyListHandler = (e) => {
            e.stopPropagation();
            this.currentTab = 'test-monthly';
            this.onOpen();
        };
        monthlyListBtn.onclick = monthlyListHandler;
    }
    
    async renderClozeTab(container) {
        // 퀴즈 섹션 추가
        await this.renderQuizSection(container);

        // 빠른 작업
        this.renderQuickActions(container);
        
        // 메모 섹션
        this.renderMemoSection(container);
    }
    
    async renderQuizSection(container) {
        const section = container.createDiv({ cls: 'cloze-dashboard-section' });
        section.style.cssText = 'margin-bottom: 24px;';
        
        const headerDiv = section.createDiv({ cls: 'section-header' });
        headerDiv.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;';
        
        headerDiv.createEl('h3', { text: '📚 퀴즈 관리' });
        
        const manageFolderBtn = headerDiv.createEl('button', { 
            text: '📁 퀴즈 관리',
            cls: 'cloze-action-btn'
        });
        manageFolderBtn.style.cssText = 'padding: 6px 12px; font-size: 13px;';
        manageFolderBtn.addEventListener('click', () => {
            new FolderManagementModal(this.app, this.plugin).open();
        });

        const folders = this.plugin.settings.questionFolders || ['기본'];
        const quizzes = Object.values(this.plugin.settings.quizzes || {});
        const bookmarks = this.plugin.settings.bookmarks || [];
        const stats = this.plugin.settings.stats;
        
        // 북마크 개수 계산
        const allQuestions = await this.plugin.loadAllQuestions();
        const bookmarkedQuestions = allQuestions.filter(q => q.bookmarked);
        const bookmarkCount = bookmarkedQuestions.length;
        
        // 각 폴더의 실제 파일 개수 확인 (questionFolders 순서대로)
        const folderData = [];
        
        // 북마크 폴더 먼저 추가
        folderData.push({
            name: '⭐ 북마크',
            noteCount: bookmarkCount,
            quizzes: [],
            isBookmarkFolder: true
        });
        
        // questionFolders 설정 순서대로 폴더 추가
        for (const folderName of folders) {
            const folderPath = `${this.plugin.settings.clozeFolder}/${this.plugin.settings.questionSubFolder || 'Questions'}/${folderName}`;
            const folderFile = this.app.vault.getAbstractFileByPath(folderPath);
            
            let noteCount = 0;
            if (folderFile && folderFile.children) {
                noteCount = folderFile.children.filter(f => f.extension === 'md').length;
            }
            
            folderData.push({
                name: folderName,
                noteCount: noteCount,
                quizzes: quizzes.filter(q => (q.folder || '기본') === folderName)
            });
        }
        
        // 폴더 카드 그리드
        const folderGrid = section.createDiv({ cls: 'cloze-folder-grid' });
        folderGrid.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; margin-top: 16px;';

        // 모든 폴더 카드 (북마크 포함)
        for (const folderInfo of folderData) {
            const folder = folderInfo.name;
            
            // 북마크 폴더인 경우
            if (folderInfo.isBookmarkFolder) {
                const card = folderGrid.createDiv({ cls: 'cloze-folder-card' });
                card.style.cssText = 'padding: 16px; background: var(--background-primary-alt); border: 1px solid var(--background-modifier-border); border-radius: 8px; transition: all 0.2s;';
                
                const cardHeader = card.createDiv();
                cardHeader.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;';
                
                const titleContainer = cardHeader.createDiv();
                titleContainer.style.cssText = 'display: flex; align-items: center; gap: 8px;';
                titleContainer.createEl('h4', { text: `⭐ 북마크` }).style.cssText = 'margin: 0; font-size: 1.1em;';
                const renderBadge = titleContainer.createEl('span', { text: '✅ 렌더링 완료' });
                renderBadge.style.cssText = 'font-size: 0.7em; padding: 2px 6px; background: var(--color-green); color: white; border-radius: 4px; font-weight: 500;';
                
                cardHeader.createEl('span', { text: `${folderInfo.noteCount}개 문제` }).style.cssText = 'font-size: 0.85em; color: var(--text-muted);';
                
                // 북마크 통계 계산
                const history = this.plugin.settings.stats.studyHistory || [];
                const bookmarkSessions = history.filter(h => h.folderName === '⭐ 북마크' || h.folder?.includes('북마크'));
                const bookmarkAttempts = bookmarkSessions.reduce((sum, s) => sum + (s.total || 0), 0);
                const bookmarkCorrect = bookmarkSessions.reduce((sum, s) => sum + (s.correct || 0), 0);
                const bookmarkTime = bookmarkSessions.reduce((sum, s) => sum + (s.duration || 0), 0);
                const bookmarkAccuracy = bookmarkAttempts > 0 ? Math.round((bookmarkCorrect / bookmarkAttempts) * 100) : 0;
                
                const statsDiv = card.createDiv();
                statsDiv.style.cssText = 'display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 12px; padding: 12px; background: var(--background-secondary); border-radius: 6px;';
                
                const statItem = (label, value) => {
                    const item = statsDiv.createDiv();
                    item.style.cssText = 'text-align: center;';
                    item.createEl('div', { text: value }).style.cssText = 'font-size: 1.2em; font-weight: bold; color: var(--interactive-accent);';
                    item.createEl('div', { text: label }).style.cssText = 'font-size: 0.75em; color: var(--text-muted); margin-top: 2px;';
                };
                
                statItem('시도', `${bookmarkAttempts}회`);
                statItem('정답률', `${bookmarkAccuracy}%`);
                statItem('학습시간', `${Math.round(bookmarkTime / 60)}분`);
                
                // 최근 학습 기록 표시
                const bookmarkHistory = bookmarkSessions
                    .sort((a, b) => b.timestamp - a.timestamp)
                    .slice(0, 3);
                
                if (bookmarkHistory.length > 0) {
                    const historySection = card.createDiv();
                    historySection.style.cssText = 'margin-bottom: 12px; padding: 10px; background: var(--background-secondary); border-radius: 6px;';
                    
                    const historyTitle = historySection.createEl('div', { text: '📅 최근 학습 기록' });
                    historyTitle.style.cssText = 'font-size: 0.8em; font-weight: 600; color: var(--text-muted); margin-bottom: 8px;';
                    
                    bookmarkHistory.forEach(session => {
                        const sessionDiv = historySection.createDiv();
                        sessionDiv.style.cssText = 'display: flex; justify-content: space-between; padding: 4px 0; font-size: 0.85em; border-bottom: 1px solid var(--background-modifier-border);';
                        
                        const date = new Date(session.timestamp);
                        const dateStr = date.toLocaleString('ko-KR', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        });
                        
                        const sessionAccuracy = session.total > 0 ? Math.round((session.correct / session.total) * 100) : 0;
                        const accuracyColor = sessionAccuracy >= 80 ? '#10b981' : sessionAccuracy >= 60 ? '#f59e0b' : '#ef4444';
                        
                        sessionDiv.createEl('span', { text: dateStr });
                        const scoreSpan = sessionDiv.createEl('span', { text: `${session.correct}/${session.total} (${sessionAccuracy}%)` });
                        scoreSpan.style.color = accuracyColor;
                        scoreSpan.style.fontWeight = 'bold';
                    });
                }
                
                const btnGroup = card.createDiv();
                btnGroup.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px;';
                
                const quizBtn = btnGroup.createEl('button', { text: '🎯 퀴즈' });
                quizBtn.style.cssText = 'padding: 8px; background: var(--interactive-accent); color: var(--text-on-accent); border: none; border-radius: 4px; font-weight: 500; font-size: 0.9em; cursor: pointer;';
                quizBtn.addEventListener('click', async () => {
                    const allQuestions = await this.plugin.loadAllQuestions();
                    const bookmarkedQuestions = allQuestions.filter(q => q.bookmarked);
                    
                    if (bookmarkedQuestions.length === 0) {
                        new Notice('북마크된 문제가 없습니다');
                        return;
                    }
                    
                    new BookmarkQuizModal(this.app, this.plugin).open();
                });
                
                const listBtn = btnGroup.createEl('button', { text: '📋 목록' });
                listBtn.style.cssText = 'padding: 8px; background: var(--color-green); color: white; border: none; border-radius: 4px; font-weight: 500; font-size: 0.9em; cursor: pointer;';
                listBtn.addEventListener('click', () => {
                    new BookmarkListModal(this.app, this.plugin).open();
                });
                
                const clearBtn = btnGroup.createEl('button', { text: '🗑️ 초기화' });
                clearBtn.style.cssText = 'padding: 8px; background: var(--background-secondary); border: none; border-radius: 4px; font-size: 0.9em; cursor: pointer;';
                clearBtn.addEventListener('click', () => {
                    if (confirm('모든 북마크를 삭제하시겠습니까?')) {
                        this.plugin.settings.bookmarks = [];
                        this.plugin.saveSettings();
                        this.onOpen();
                    }
                });
                
                card.addEventListener('mouseenter', () => {
                    card.style.transform = 'translateY(-4px)';
                    card.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                });
                card.addEventListener('mouseleave', () => {
                    card.style.transform = 'translateY(0)';
                    card.style.boxShadow = 'none';
                });
                
                continue; // 북마크 폴더 처리 완료, 다음 폴더로
            }
            
            // 일반 폴더 카드
            const folderQuizzes = folderInfo.quizzes;
            const folderStats = stats.folderStats?.[folder] || { attempts: 0, correct: 0, time: 0 };
            const accuracy = folderStats.attempts > 0 ? Math.round((folderStats.correct / folderStats.attempts) * 100) : 0;
            
            const card = folderGrid.createDiv({ cls: 'cloze-folder-card' });
            card.style.cssText = 'padding: 16px; background: var(--background-primary-alt); border: 1px solid var(--background-modifier-border); border-radius: 8px; transition: all 0.2s;';
            
            const cardHeader = card.createDiv();
            cardHeader.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;';
            
            cardHeader.createEl('h4', { text: `📁 ${folder}` }).style.cssText = 'margin: 0; font-size: 1.1em;';
            cardHeader.createEl('span', { text: `${folderInfo.noteCount}개 파일 · ${folderQuizzes.length}개 퀴즈` }).style.cssText = 'font-size: 0.85em; color: var(--text-muted);';
            
            const statsDiv = card.createDiv();
            statsDiv.style.cssText = 'display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 12px; padding: 12px; background: var(--background-secondary); border-radius: 6px;';
            
            const statItem = (label, value) => {
                const item = statsDiv.createDiv();
                item.style.cssText = 'text-align: center;';
                item.createEl('div', { text: value }).style.cssText = 'font-size: 1.2em; font-weight: bold; color: var(--interactive-accent);';
                item.createEl('div', { text: label }).style.cssText = 'font-size: 0.75em; color: var(--text-muted); margin-top: 2px;';
            };
            
            statItem('시도', `${folderStats.attempts}회`);
            statItem('정답률', `${accuracy}%`);
            statItem('학습시간', `${Math.round(folderStats.time / 60)}분`);
            
            // 최근 학습 기록 표시
            const history = this.plugin.settings.stats.studyHistory || [];
            const folderHistory = history
                .filter(h => h.folderName === folder)
                .slice(-5)
                .reverse();
            
            if (folderHistory.length > 0) {
                const historySection = card.createDiv();
                historySection.style.cssText = 'margin: 12px 0; padding: 10px; background: var(--background-primary); border-radius: 6px;';
                
                const historyTitle = historySection.createEl('div', { text: '📚 최근 학습' });
                historyTitle.style.cssText = 'font-weight: bold; font-size: 0.85em; margin-bottom: 8px; color: var(--text-muted);';
                
                folderHistory.forEach(session => {
                    const sessionDiv = historySection.createDiv();
                    sessionDiv.style.cssText = 'font-size: 0.75em; padding: 4px 0; color: var(--text-muted); display: flex; justify-content: space-between; cursor: pointer; transition: all 0.2s;';
                    
                    const dateStr = new Date(session.timestamp || session.date).toLocaleDateString('ko-KR', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                    
                    const sessionAccuracy = session.total > 0 ? Math.round((session.correct / session.total) * 100) : 0;
                    const accuracyColor = sessionAccuracy >= 80 ? '#10b981' : sessionAccuracy >= 60 ? '#f59e0b' : '#ef4444';
                    
                    sessionDiv.createEl('span', { text: dateStr });
                    const scoreSpan = sessionDiv.createEl('span', { text: `${session.correct}/${session.total} (${sessionAccuracy}%)` });
                    scoreSpan.style.color = accuracyColor;
                    scoreSpan.style.fontWeight = 'bold';
                    
                    // 클릭 이벤트 - 상세 기록 모달 열기
                    const clickHandler = () => {
                        new FolderDetailModal(this.app, this.plugin, folder, `Learning/${folder}`).open();
                    };
                    sessionDiv.addEventListener('click', clickHandler);
                    sessionDiv.addEventListener('touchend', (e) => {
                        e.preventDefault();
                        clickHandler();
                    });
                    
                    // 호버 효과
                    sessionDiv.addEventListener('mouseenter', () => {
                        sessionDiv.style.backgroundColor = 'var(--background-modifier-hover)';
                        sessionDiv.style.padding = '6px 4px';
                        sessionDiv.style.borderRadius = '4px';
                    });
                    sessionDiv.addEventListener('mouseleave', () => {
                        sessionDiv.style.backgroundColor = 'transparent';
                        sessionDiv.style.padding = '4px 0';
                    });
                });
            }
            
            const btnGroup = card.createDiv();
            btnGroup.style.cssText = 'display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;';
            
            const quizBtn = btnGroup.createEl('button', { text: '🎯 퀴즈' });
            quizBtn.style.cssText = 'padding: 8px; background: var(--interactive-accent); color: var(--text-on-accent); border: none; border-radius: 4px; font-weight: 500; font-size: 0.9em; cursor: pointer;';
            const quizHandler = () => {
                new FolderQuizModal(this.app, this.plugin, folder).open();
            };
            quizBtn.addEventListener('click', quizHandler);
            quizBtn.addEventListener('touchend', (e) => {
                e.preventDefault();
                quizHandler();
            });
            
            const createBtn = btnGroup.createEl('button', { text: '➕ 생성' });
            createBtn.style.cssText = 'padding: 8px; background: var(--color-green); color: white; border: none; border-radius: 4px; font-weight: 500; font-size: 0.9em; cursor: pointer;';
            const createHandler = () => {
                new QuizCreatorModal(this.app, this.plugin, folder).open();
            };
            createBtn.addEventListener('click', createHandler);
            createBtn.addEventListener('touchend', (e) => {
                e.preventDefault();
                createHandler();
            });
            
            const listBtn = btnGroup.createEl('button', { text: '📋 목록' });
            listBtn.style.cssText = 'padding: 8px; background: var(--background-modifier-border); border: none; border-radius: 4px; font-weight: 500; font-size: 0.9em; cursor: pointer;';
            const listHandler = () => {
                new QuizListModal(this.app, this.plugin, folder).open();
            };
            listBtn.addEventListener('click', listHandler);
            listBtn.addEventListener('touchend', (e) => {
                e.preventDefault();
                listHandler();
            });
            
            card.addEventListener('mouseenter', () => {
                card.style.transform = 'translateY(-4px)';
                card.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
            });
            card.addEventListener('mouseleave', () => {
                card.style.transform = 'translateY(0)';
                card.style.boxShadow = 'none';
            });
        }
    }
    
    renderRecentQuizzes(container) {
        const section = container.createDiv();
        section.style.cssText = 'margin-bottom: 24px;';
        
        const header = section.createDiv();
        header.style.cssText = 'margin-bottom: 14px; padding-bottom: 10px; border-bottom: 2px solid var(--background-modifier-border);';
        const titleEl = header.createEl('h3', { text: '📝 최근 퀴즈' });
        titleEl.style.cssText = 'margin: 0; font-size: 1.3em; font-weight: 700; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;';

        const quizzes = Object.entries(this.plugin.settings.quizzes || {});

        if (quizzes.length === 0) {
            // 빈 상태 카드
            const emptyCard = section.createDiv();
            emptyCard.style.cssText = `
                background: linear-gradient(135deg, var(--background-secondary) 0%, var(--background-primary-alt) 100%);
                border: 2px dashed var(--background-modifier-border);
                border-radius: 12px;
                padding: 40px 20px;
                text-align: center;
                margin: 10px 0;
                transition: all 0.3s;
            `;
            
            // 아이콘
            const icon = emptyCard.createDiv();
            icon.style.cssText = `
                font-size: 48px;
                margin-bottom: 16px;
                opacity: 0.6;
            `;
            icon.textContent = '📝';
            
            // 메시지
            const message = emptyCard.createDiv();
            message.style.cssText = `
                font-size: 16px;
                font-weight: 600;
                color: var(--text-muted);
                margin-bottom: 8px;
            `;
            message.textContent = '저장된 퀴즈가 없습니다';
            
            // 서브 메시지
            const subMessage = emptyCard.createDiv();
            subMessage.style.cssText = `
                font-size: 14px;
                color: var(--text-faint);
                margin-bottom: 20px;
            `;
            subMessage.textContent = '새 퀴즈를 만들어보세요!';
            
            // 생성 버튼
            const createBtn = emptyCard.createEl('button');
            createBtn.textContent = '➕ 퀴즈 만들기';
            createBtn.style.cssText = `
                padding: 10px 24px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border: none;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s;
                box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
            `;
            
            createBtn.addEventListener('mouseenter', () => {
                createBtn.style.transform = 'translateY(-2px)';
                createBtn.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.4)';
            });
            
            createBtn.addEventListener('mouseleave', () => {
                createBtn.style.transform = 'translateY(0)';
                createBtn.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)';
            });
            
            createBtn.addEventListener('click', () => {
                new QuizCreatorModal(this.app, this.plugin).open();
            });
            
            emptyCard.addEventListener('mouseenter', () => {
                emptyCard.style.borderColor = 'var(--interactive-accent)';
                emptyCard.style.transform = 'scale(1.02)';
            });
            
            emptyCard.addEventListener('mouseleave', () => {
                emptyCard.style.borderColor = 'var(--background-modifier-border)';
                emptyCard.style.transform = 'scale(1)';
            });
            
            return;
        }

        quizzes.sort((a, b) => (b[1].createdAt || 0) - (a[1].createdAt || 0));

        const quizList = section.createDiv();
        quizList.style.cssText = 'display: grid; gap: 12px;';

        quizzes.slice(0, 5).forEach(([quizId, quiz]) => {
            const quizItem = quizList.createDiv();
            quizItem.style.cssText = `
                padding: 16px;
                background: var(--background-primary-alt);
                border: 1px solid var(--background-modifier-border);
                border-radius: 12px;
                transition: all 0.3s;
            `;

            quizItem.addEventListener('mouseenter', () => {
                quizItem.style.background = 'var(--background-secondary)';
                quizItem.style.transform = 'translateY(-2px)';
                quizItem.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
            });
            quizItem.addEventListener('mouseleave', () => {
                quizItem.style.background = 'var(--background-primary-alt)';
                quizItem.style.transform = 'translateY(0)';
                quizItem.style.boxShadow = 'none';
            });

            // 헤더: 제목 + 폴더
            const quizHeader = quizItem.createDiv();
            quizHeader.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;';
            
            const titleSection = quizHeader.createDiv();
            titleSection.style.cssText = 'display: flex; align-items: center; gap: 10px; flex: 1;';
            
            const title = titleSection.createEl('div');
            title.textContent = quiz.subject || '제목 없음';
            title.style.cssText = 'font-size: 16px; font-weight: 700; color: var(--text-normal);';
            
            if (quiz.folder) {
                const folderBadge = titleSection.createEl('span');
                folderBadge.textContent = `📁 ${quiz.folder}`;
                folderBadge.style.cssText = `
                    font-size: 12px;
                    padding: 4px 10px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border-radius: 12px;
                    font-weight: 600;
                `;
            }
            
            // 간단한 통계
            const statsRow = quizItem.createDiv();
            statsRow.style.cssText = `
                display: flex;
                gap: 16px;
                padding: 10px 0;
                margin-bottom: 12px;
                border-bottom: 1px solid var(--background-modifier-border);
            `;
            
            const createStat = (icon, label, value) => {
                const stat = statsRow.createDiv();
                stat.style.cssText = 'display: flex; align-items: center; gap: 6px;';
                
                const iconEl = stat.createEl('span');
                iconEl.textContent = icon;
                iconEl.style.cssText = 'font-size: 14px;';
                
                const text = stat.createEl('span');
                text.textContent = `${value} ${label}`;
                text.style.cssText = 'font-size: 13px; color: var(--text-muted);';
            };
            
            createStat('📝', '문제', quiz.questions?.length || 0);
            
            if (quiz.difficulty) {
                createStat('⭐', '난이도', quiz.difficulty);
            }
            
            if (quiz.createdAt) {
                const date = new Date(quiz.createdAt);
                const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
                createStat('📅', '생성', dateStr);
            }

            // 버튼들
            const actions = quizItem.createDiv();
            actions.style.cssText = 'display: flex; gap: 8px;';

            const startBtn = actions.createEl('button');
            startBtn.textContent = '▶ 시작하기';
            startBtn.style.cssText = `
                flex: 1;
                padding: 10px 16px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 600;
                transition: all 0.3s;
                box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
            `;
            
            startBtn.addEventListener('click', () => {
                new QuizModal(this.app, this.plugin, '', [quizId], {}).open();
            });
            
            startBtn.addEventListener('mouseenter', () => {
                startBtn.style.transform = 'translateY(-2px)';
                startBtn.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
            });
            
            startBtn.addEventListener('mouseleave', () => {
                startBtn.style.transform = 'translateY(0)';
                startBtn.style.boxShadow = '0 2px 8px rgba(102, 126, 234, 0.3)';
            });

            const editBtn = actions.createEl('button');
            editBtn.textContent = '✏️ 편집';
            editBtn.style.cssText = `
                padding: 10px 16px;
                background: var(--background-modifier-border);
                color: var(--text-normal);
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 500;
                transition: all 0.2s;
            `;
            
            editBtn.addEventListener('click', () => {
                new QuizCreatorModal(this.app, this.plugin, quiz.folder, quizId).open();
            });
            
            editBtn.addEventListener('mouseenter', () => {
                editBtn.style.background = 'var(--interactive-accent)';
                editBtn.style.color = 'var(--text-on-accent)';
            });
            
            editBtn.addEventListener('mouseleave', () => {
                editBtn.style.background = 'var(--background-modifier-border)';
                editBtn.style.color = 'var(--text-normal)';
            });
        });
    }
    
    renderMemoSection(container) {
        const memoSection = container.createDiv({ cls: 'cloze-memo-section' });
        memoSection.createEl('h3', { text: '📝 메모' });
        
        const memoContent = memoSection.createDiv({ cls: 'cloze-memo-content' });
        memoContent.style.cssText = 'background: var(--background-secondary); padding: 12px; border-radius: 8px; margin-top: 10px;';
        
        // 메모 내용 표시
        const memoText = this.plugin.settings.dashboardMemo || '메모를 추가하려면 아래 버튼을 클릭하세요.';
        const memoDisplay = memoContent.createDiv({ cls: 'cloze-memo-text' });
        memoDisplay.textContent = memoText;
        memoDisplay.style.cssText = 'white-space: pre-wrap; min-height: 60px; margin-bottom: 10px;';
        
        // 메모 수정 버튼
        const editBtn = memoContent.createEl('button', { text: '✏️ 메모 수정', cls: 'cloze-add-btn' });
        editBtn.style.cssText = 'margin-top: 8px;';
        const editHandler = () => {
            new TextInputModal(
                this.app,
                '메모 수정',
                '메모 내용을 입력하세요',
                this.plugin.settings.dashboardMemo || '',
                async (newMemo) => {
                    this.plugin.settings.dashboardMemo = newMemo;
                    await this.plugin.saveSettings();
                    this.onOpen();
                    new Notice('메모가 저장되었습니다!');
                },
                true // multiline
            ).open();
        };
        editBtn.onclick = editHandler;
        editBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            editHandler();
        });
    }
    
    async renderTestDailyTab(container) {
        if (!this.plugin.settings.testManagementEnabled) {
            container.createDiv({ 
                cls: 'cloze-empty-message',
                text: '문제풀기가 비활성화되어 있습니다. 설정에서 활성화하세요.'
            });
            return;
        }
        
        const section = container.createDiv({ cls: 'cloze-test-section' });
        
        // 날짜 네비게이션
        const dateNav = section.createDiv({ cls: 'cloze-date-nav' });
        
        const prevBtn = dateNav.createEl('button', { cls: 'cloze-date-btn', text: '◀' });
        const prevHandler = () => {
            this.currentDate.setDate(this.currentDate.getDate() - 1);
            this.onOpen();
        };
        prevBtn.onclick = prevHandler;
        prevBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            prevHandler();
        });
        
        const dateTitle = dateNav.createDiv({ cls: 'cloze-date-title' });
        dateTitle.setText(this.formatDateKorean(this.currentDate));
        
        const nextBtn = dateNav.createEl('button', { cls: 'cloze-date-btn', text: '▶' });
        const nextHandler = () => {
            this.currentDate.setDate(this.currentDate.getDate() + 1);
            this.onOpen();
        };
        nextBtn.onclick = nextHandler;
        nextBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            nextHandler();
        });
        
        const todayBtn = dateNav.createEl('button', { cls: 'cloze-today-btn', text: 'Today' });
        const todayHandler = () => {
            this.currentDate = new Date();
            this.onOpen();
        };
        todayBtn.onclick = todayHandler;
        todayBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            todayHandler();
        });
        
        // 오늘의 학습 기록 가져오기
        const todayStats = this.getTodayStats();
        
        // 학습 기록 표시 (폴더별로 최근 1개씩)
        const recordSection = section.createDiv({ cls: 'cloze-test-items-section' });
        recordSection.createEl('h4', { text: '📚 폴더별 최근 학습' });
        
        if (todayStats.sessions.length === 0) {
            recordSection.createDiv({ 
                cls: 'cloze-note-item',
                text: '아직 학습 기록이 없습니다. 퀴즈를 시작해보세요!' 
            });
        } else {
            const recordList = recordSection.createDiv({ cls: 'cloze-test-item-list' });
            
            // 폴더별로 그룹화
            const folderMap = {};
            todayStats.sessions.forEach(session => {
                const folder = session.folderName || '알 수 없음';
                if (!folderMap[folder] || new Date(session.timestamp) > new Date(folderMap[folder].timestamp)) {
                    folderMap[folder] = session;
                }
            });
            
            // 폴더별 최근 학습 표시
            Object.values(folderMap).forEach(session => {
                const item = recordList.createDiv({ cls: 'cloze-test-item' });
                item.style.cssText = 'padding: 14px; background: var(--background-primary-alt); border: 1px solid var(--background-modifier-border); border-radius: 8px; margin-bottom: 12px; transition: all 0.2s;';
                
                const header = item.createDiv({ cls: 'cloze-test-item-header' });
                header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;';
                
                const folderName = header.createEl('span', { text: `📁 ${session.folderName}` });
                folderName.style.cssText = 'font-weight: 600; font-size: 1.05em;';
                
                const timeText = new Date(session.timestamp).toLocaleTimeString('ko-KR', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                });
                header.createEl('span', { text: timeText, cls: 'cloze-test-time' }).style.cssText = 'font-size: 0.9em; color: var(--text-muted);';
                
                const stats = item.createDiv({ cls: 'cloze-test-stats' });
                stats.style.cssText = 'display: flex; gap: 16px; margin-bottom: 12px; padding: 8px; background: var(--background-secondary); border-radius: 6px;';
                
                const accuracy = session.accuracy;
                const accuracyColor = accuracy >= 80 ? '#10b981' : accuracy >= 60 ? '#f59e0b' : '#ef4444';
                
                const accuracyDiv = stats.createDiv();
                accuracyDiv.style.cssText = 'flex: 1; text-align: center;';
                accuracyDiv.createEl('div', { text: `${accuracy}%` }).style.cssText = `font-size: 1.3em; font-weight: bold; color: ${accuracyColor};`;
                accuracyDiv.createEl('div', { text: '정답률' }).style.cssText = 'font-size: 0.8em; color: var(--text-muted); margin-top: 2px;';
                
                const scoreDiv = stats.createDiv();
                scoreDiv.style.cssText = 'flex: 1; text-align: center;';
                scoreDiv.createEl('div', { text: `${session.correct}/${session.total}` }).style.cssText = 'font-size: 1.1em; font-weight: 600;';
                scoreDiv.createEl('div', { text: '문제' }).style.cssText = 'font-size: 0.8em; color: var(--text-muted); margin-top: 2px;';
                
                // 다시 풀기 버튼
                const retryBtn = item.createEl('button', { 
                    text: '🔄 다시 풀기',
                    cls: 'cloze-retry-btn'
                });
                retryBtn.style.cssText = 'width: 100%; padding: 10px 16px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.95em; font-weight: 600; transition: all 0.2s;';
                
                retryBtn.addEventListener('mouseenter', () => {
                    retryBtn.style.transform = 'translateY(-2px)';
                    retryBtn.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
                });
                
                retryBtn.addEventListener('mouseleave', () => {
                    retryBtn.style.transform = 'translateY(0)';
                    retryBtn.style.boxShadow = 'none';
                });
                
                retryBtn.addEventListener('click', () => {
                    if (session.folderName === '⭐ 북마크') {
                        new BookmarkQuizModal(this.app, this.plugin).open();
                    } else {
                        new FolderQuizModal(this.app, this.plugin, session.folderName).open();
                    }
                });
                
                item.addEventListener('mouseenter', () => {
                    item.style.borderColor = 'var(--interactive-accent)';
                    item.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                });
                
                item.addEventListener('mouseleave', () => {
                    item.style.borderColor = 'var(--background-modifier-border)';
                    item.style.boxShadow = 'none';
                });
            });
        }
        
        // 체크리스트 섹션
        this.renderGoalSection(section, 'daily', this.formatDate(this.currentDate));
    }
    
    async renderTestWeeklyTab(container) {
        if (!this.plugin.settings.testManagementEnabled) {
            container.createDiv({ 
                cls: 'cloze-empty-message',
                text: '문제풀기가 비활성화되어 있습니다.'
            });
            return;
        }
        
        const section = container.createDiv({ cls: 'cloze-test-section' });
        section.createEl('h3', { text: '📆 이번 달 주차별 학습 기록' });
        
        const history = this.plugin.settings.stats.studyHistory || [];
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        
        // 이번 달의 세션만 필터링
        const monthSessions = history.filter(h => {
            const sessionDate = new Date(h.date || h.timestamp);
            return sessionDate.getFullYear() === year && sessionDate.getMonth() === month;
        });
        
        // 이번 달의 주차별로 그룹화 (1주, 2주, 3주, 4주, 5주)
        const weekMap = {};
        
        monthSessions.forEach(session => {
            const sessionDate = new Date(session.date || session.timestamp);
            const dayOfMonth = sessionDate.getDate();
            
            // 1-7일: 1주, 8-14일: 2주, 15-21일: 3주, 22-28일: 4주, 29일~: 5주
            let weekNum;
            if (dayOfMonth <= 7) weekNum = 1;
            else if (dayOfMonth <= 14) weekNum = 2;
            else if (dayOfMonth <= 21) weekNum = 3;
            else if (dayOfMonth <= 28) weekNum = 4;
            else weekNum = 5;
            
            const weekKey = `${weekNum}주`;
            
            if (!weekMap[weekKey]) {
                weekMap[weekKey] = {
                    weekNum,
                    weekKey,
                    folderSessions: {}
                };
            }
            
            // 폴더별로 세션 저장
            const folderName = session.folderName || session.fileName || '알 수 없음';
            if (!weekMap[weekKey].folderSessions[folderName]) {
                weekMap[weekKey].folderSessions[folderName] = [];
            }
            weekMap[weekKey].folderSessions[folderName].push(session);
        });
        
        // 주차 순서대로 정렬
        const weeks = Object.values(weekMap).sort((a, b) => a.weekNum - b.weekNum);
        
        if (weeks.length === 0) {
            section.createDiv({ 
                cls: 'cloze-empty-message',
                text: '이번 달 학습 기록이 없습니다.'
            });
        } else {
            weeks.forEach(week => {
                const weekSection = section.createDiv({ cls: 'cloze-dashboard-section' });
                weekSection.createEl('h4', { text: `📅 ${week.weekKey}` });
                
                const recordsList = weekSection.createDiv({ cls: 'cloze-session-list' });
                
                // 각 폴더별 최신 세션만 표시
                Object.entries(week.folderSessions).forEach(([folderName, sessions]) => {
                    // 최신 세션 찾기
                    const latestSession = sessions.reduce((latest, current) => 
                        current.timestamp > latest.timestamp ? current : latest
                    );
                    
                    const item = recordsList.createDiv({ cls: 'cloze-test-item' });
                    item.style.cssText = 'padding: 14px; background: var(--background-primary-alt); border: 1px solid var(--background-modifier-border); border-radius: 8px; margin-bottom: 12px; transition: all 0.2s;';
                    
                    const header = item.createDiv({ cls: 'cloze-test-item-header' });
                    header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;';
                    
                    const folderNameEl = header.createEl('span', { text: `📁 ${folderName}` });
                    folderNameEl.style.cssText = 'font-weight: 600; font-size: 1.05em;';
                    
                    const timeText = new Date(latestSession.timestamp).toLocaleTimeString('ko-KR', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                    });
                    header.createEl('span', { text: timeText, cls: 'cloze-test-time' }).style.cssText = 'font-size: 0.9em; color: var(--text-muted);';
                    
                    const stats = item.createDiv({ cls: 'cloze-test-stats' });
                    stats.style.cssText = 'display: flex; gap: 16px; margin-bottom: 12px; padding: 8px; background: var(--background-secondary); border-radius: 6px;';
                    
                    const total = latestSession.total || 0;
                    const correct = latestSession.correct || 0;
                    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
                    const accuracyColor = accuracy >= 80 ? '#10b981' : accuracy >= 60 ? '#f59e0b' : '#ef4444';
                    
                    const accuracyDiv = stats.createDiv();
                    accuracyDiv.style.cssText = 'flex: 1; text-align: center;';
                    accuracyDiv.createEl('div', { text: `${accuracy}%` }).style.cssText = `font-size: 1.3em; font-weight: bold; color: ${accuracyColor};`;
                    accuracyDiv.createEl('div', { text: '정답률' }).style.cssText = 'font-size: 0.8em; color: var(--text-muted); margin-top: 2px;';
                    
                    const scoreDiv = stats.createDiv();
                    scoreDiv.style.cssText = 'flex: 1; text-align: center;';
                    scoreDiv.createEl('div', { text: `${correct}/${total}` }).style.cssText = 'font-size: 1.1em; font-weight: 600;';
                    scoreDiv.createEl('div', { text: '문제' }).style.cssText = 'font-size: 0.8em; color: var(--text-muted); margin-top: 2px;';
                    
                    // 다시 풀기 버튼
                    const retryBtn = item.createEl('button', { 
                        text: '🔄 다시 풀기',
                        cls: 'cloze-retry-btn'
                    });
                    retryBtn.style.cssText = 'width: 100%; padding: 10px 16px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.95em; font-weight: 600; transition: all 0.2s;';
                    
                    const retryHandler = () => {
                        if (folderName === '⭐ 북마크') {
                            new BookmarkQuizModal(this.app, this.plugin).open();
                        } else {
                            new FolderQuizModal(this.app, this.plugin, folderName).open();
                        }
                    };
                    
                    retryBtn.addEventListener('mouseenter', () => {
                        retryBtn.style.transform = 'translateY(-2px)';
                        retryBtn.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
                    });
                    
                    retryBtn.addEventListener('mouseleave', () => {
                        retryBtn.style.transform = 'translateY(0)';
                        retryBtn.style.boxShadow = 'none';
                    });
                    
                    retryBtn.addEventListener('click', retryHandler);
                    
                    // 모바일 터치 이벤트
                    let touchStartTime = 0;
                    retryBtn.addEventListener('touchstart', () => {
                        touchStartTime = Date.now();
                    }, { passive: true });
                    
                    retryBtn.addEventListener('touchend', (e) => {
                        const touchDuration = Date.now() - touchStartTime;
                        if (touchDuration < 500) {
                            e.preventDefault();
                            retryHandler();
                        }
                    });
                    
                    item.addEventListener('mouseenter', () => {
                        item.style.borderColor = 'var(--interactive-accent)';
                        item.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                    });
                    
                    item.addEventListener('mouseleave', () => {
                        item.style.borderColor = 'var(--background-modifier-border)';
                        item.style.boxShadow = 'none';
                    });
                });
            });
        }
        
        // 주간 목표 섹션
        const weekKey = this.getWeekKey(new Date());
        this.renderGoalSection(section, 'weekly', weekKey);
    }
    
    async renderTestWeeklyTab(container) {
        const section = container.createDiv({ cls: 'cloze-test-section' });
        section.style.cssText = 'padding: 20px;';
        
        // 주간 네비게이션
        const weekNav = section.createDiv({ cls: 'cloze-date-nav' });
        weekNav.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding: 12px; background: var(--background-secondary); border-radius: 8px;';
        
        const prevBtn = weekNav.createEl('button', { text: '◀ 이전 주' });
        prevBtn.style.cssText = 'padding: 8px 16px; background: var(--interactive-accent); color: var(--text-on-accent); border: none; border-radius: 6px; cursor: pointer; font-weight: 600;';
        prevBtn.onclick = () => {
            const currentWeek = new Date(this.currentDate);
            currentWeek.setDate(currentWeek.getDate() - 7);
            this.currentDate = currentWeek;
            this.onOpen();
        };
        
        const weekTitle = weekNav.createEl('div');
        weekTitle.style.cssText = 'font-size: 1.2em; font-weight: bold; color: var(--text-normal);';
        const weekKey = this.getWeekKey(this.currentDate);
        weekTitle.textContent = `📆 ${weekKey}`;
        
        const nextBtn = weekNav.createEl('button', { text: '다음 주 ▶' });
        nextBtn.style.cssText = 'padding: 8px 16px; background: var(--interactive-accent); color: var(--text-on-accent); border: none; border-radius: 6px; cursor: pointer; font-weight: 600;';
        nextBtn.onclick = () => {
            const currentWeek = new Date(this.currentDate);
            currentWeek.setDate(currentWeek.getDate() + 7);
            this.currentDate = currentWeek;
            this.onOpen();
        };
        
        const todayBtn = weekNav.createEl('button', { text: '이번 주' });
        todayBtn.style.cssText = 'padding: 8px 16px; background: var(--background-primary-alt); border: 1px solid var(--background-modifier-border); border-radius: 6px; cursor: pointer;';
        todayBtn.onclick = () => {
            this.currentDate = new Date();
            this.onOpen();
        };
        
        // 주간 통계
        const weekStats = this.getWeekStats();
        const statsSection = section.createDiv();
        statsSection.style.cssText = 'background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 12px; margin-bottom: 20px; color: white;';
        
        const statsTitle = statsSection.createEl('h3', { text: '📊 주간 학습 통계' });
        statsTitle.style.cssText = 'margin: 0 0 15px 0; color: white;';
        
        const statsGrid = statsSection.createDiv();
        statsGrid.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px;';
        
        const createStatCard = (label, value, icon) => {
            const card = statsGrid.createDiv();
            card.style.cssText = 'background: rgba(255, 255, 255, 0.2); padding: 12px; border-radius: 8px; text-align: center; backdrop-filter: blur(10px);';
            card.createEl('div', { text: icon }).style.cssText = 'font-size: 24px; margin-bottom: 6px;';
            card.createEl('div', { text: value }).style.cssText = 'font-size: 1.5em; font-weight: bold; color: white; margin-bottom: 4px;';
            card.createEl('div', { text: label }).style.cssText = 'font-size: 0.85em; color: rgba(255, 255, 255, 0.9);';
        };
        
        createStatCard('학습 일수', `${weekStats.studyDays}일`, '📅');
        createStatCard('총 세션', `${weekStats.totalSessions}회`, '🎯');
        createStatCard('총 문제', `${weekStats.totalCards}개`, '📝');
        createStatCard('정답률', `${weekStats.accuracy}%`, '✅');
        createStatCard('학습 시간', `${Math.round(weekStats.totalTime / 60)}분`, '⏱️');
        
        // 주간 체크리스트 섹션
        const checklistSection = section.createDiv();
        checklistSection.style.cssText = 'background: var(--background-primary-alt); padding: 20px; border-radius: 12px; margin-bottom: 20px;';
        
        const checklistHeader = checklistSection.createDiv();
        checklistHeader.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;';
        
        const checklistTitle = checklistHeader.createEl('h3', { text: '✅ 주간 목표 체크리스트' });
        checklistTitle.style.cssText = 'margin: 0; color: var(--text-normal);';
        
        // .md 파일 열기 버튼
        const weeklyFilePath = `Learning Plans/주간목표_${weekKey}.md`;
        const openFileBtn = checklistHeader.createEl('button', { text: '📄 파일 열기' });
        openFileBtn.style.cssText = 'padding: 6px 12px; background: var(--interactive-accent); color: var(--text-on-accent); border: none; border-radius: 6px; cursor: pointer; font-size: 0.9em; font-weight: 600;';
        openFileBtn.onclick = async () => {
            const file = this.app.vault.getAbstractFileByPath(weeklyFilePath);
            if (file) {
                const leaf = this.app.workspace.getLeaf(false);
                await leaf.openFile(file);
            } else {
                // 파일이 없으면 생성
                await this.createWeeklyGoalFile(weekKey);
                const newFile = this.app.vault.getAbstractFileByPath(weeklyFilePath);
                if (newFile) {
                    const leaf = this.app.workspace.getLeaf(false);
                    await leaf.openFile(newFile);
                }
            }
        };
        
        // 체크리스트 데이터 가져오기
        let weeklyData = this.plugin.settings.weeklyChecklists?.[weekKey];
        if (!weeklyData) {
            weeklyData = { items: [], notes: [] };
            if (!this.plugin.settings.weeklyChecklists) this.plugin.settings.weeklyChecklists = {};
            this.plugin.settings.weeklyChecklists[weekKey] = weeklyData;
        }
        
        // 진행률 표시
        if (weeklyData.items && weeklyData.items.length > 0) {
            const completed = weeklyData.items.filter(item => item.completed).length;
            const total = weeklyData.items.length;
            const percent = Math.round((completed / total) * 100);
            
            const progressSection = checklistSection.createDiv();
            progressSection.style.cssText = 'margin-bottom: 16px;';
            
            const progressText = progressSection.createEl('div', { text: `진행률: ${completed}/${total} (${percent}%)` });
            progressText.style.cssText = 'font-weight: 600; color: var(--text-normal); margin-bottom: 8px;';
            
            const progressBarBg = progressSection.createDiv();
            progressBarBg.style.cssText = 'background: var(--background-modifier-border); height: 10px; border-radius: 5px; overflow: hidden;';
            const progressBarFill = progressBarBg.createDiv();
            progressBarFill.style.cssText = `background: linear-gradient(90deg, #10b981 0%, #059669 100%); width: ${percent}%; height: 100%; transition: width 0.3s;`;
        }
        
        // 체크리스트 항목 표시
        const itemList = checklistSection.createDiv();
        
        if (weeklyData.items.length === 0) {
            const emptyMsg = itemList.createDiv({ text: '아직 목표가 없습니다. 아래 버튼으로 추가하세요!' });
            emptyMsg.style.cssText = 'color: var(--text-muted); text-align: center; padding: 20px; font-style: italic;';
        } else {
            weeklyData.items.forEach((item, idx) => {
                const itemDiv = itemList.createDiv();
                itemDiv.style.cssText = 'display: flex; align-items: center; gap: 12px; padding: 12px; background: var(--background-primary); border: 1px solid var(--background-modifier-border); border-radius: 8px; margin-bottom: 8px; transition: all 0.2s;';
                
                const checkbox = itemDiv.createEl('input', { type: 'checkbox' });
                checkbox.checked = item.completed;
                checkbox.style.cssText = 'width: 20px; height: 20px; cursor: pointer;';
                checkbox.onchange = async () => {
                    item.completed = checkbox.checked;
                    await this.plugin.saveSettings();
                    await this.syncWeeklyGoalFile(weekKey, weeklyData);
                    this.onOpen();
                };
                
                const textDiv = itemDiv.createEl('div', { text: item.text });
                textDiv.style.cssText = item.completed ? 'flex: 1; text-decoration: line-through; color: var(--text-muted);' : 'flex: 1; color: var(--text-normal); font-weight: 500; cursor: pointer;';
                textDiv.onclick = () => {
                    new TestNoteEditModal(this.app, item.text, async (newText) => {
                        item.text = newText;
                        await this.plugin.saveSettings();
                        await this.syncWeeklyGoalFile(weekKey, weeklyData);
                        this.onOpen();
                    }, async () => {
                        weeklyData.items.splice(idx, 1);
                        await this.plugin.saveSettings();
                        await this.syncWeeklyGoalFile(weekKey, weeklyData);
                        this.onOpen();
                    }).open();
                };
                
                const deleteBtn = itemDiv.createEl('button', { text: '🗑️' });
                deleteBtn.style.cssText = 'padding: 4px 8px; background: #ef4444; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.9em;';
                deleteBtn.onclick = async () => {
                    if (confirm('이 항목을 삭제하시겠습니까?')) {
                        weeklyData.items.splice(idx, 1);
                        await this.plugin.saveSettings();
                        await this.syncWeeklyGoalFile(weekKey, weeklyData);
                        this.onOpen();
                    }
                };
                
                itemDiv.addEventListener('mouseenter', () => {
                    itemDiv.style.borderColor = 'var(--interactive-accent)';
                    itemDiv.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                });
                itemDiv.addEventListener('mouseleave', () => {
                    itemDiv.style.borderColor = 'var(--background-modifier-border)';
                    itemDiv.style.boxShadow = 'none';
                });
            });
        }
        
        // 버튼 그룹
        const btnGroup = checklistSection.createDiv();
        btnGroup.style.cssText = 'display: flex; gap: 8px; margin-top: 16px;';
        
        const addItemBtn = btnGroup.createEl('button', { text: '➕ 목표 추가' });
        addItemBtn.style.cssText = 'flex: 1; padding: 10px; background: var(--interactive-accent); color: var(--text-on-accent); border: none; border-radius: 6px; cursor: pointer; font-weight: 600;';
        addItemBtn.onclick = () => {
            new TestNoteAddModal(this.app, async (text) => {
                weeklyData.items.push({ text, completed: false });
                await this.plugin.saveSettings();
                await this.syncWeeklyGoalFile(weekKey, weeklyData);
                this.onOpen();
            }).open();
        };
        
        const syncBtn = btnGroup.createEl('button', { text: '🔄 파일 동기화' });
        syncBtn.style.cssText = 'padding: 10px 16px; background: var(--background-primary-alt); border: 1px solid var(--background-modifier-border); border-radius: 6px; cursor: pointer; font-weight: 600;';
        syncBtn.onclick = async () => {
            await this.loadWeeklyGoalFile(weekKey);
            new Notice('✅ 파일에서 체크리스트를 불러왔습니다');
            this.onOpen();
        };
        
        // 메모 섹션
        const notesSection = section.createDiv();
        notesSection.style.cssText = 'background: var(--background-primary-alt); padding: 20px; border-radius: 12px;';
        
        const notesTitle = notesSection.createEl('h3', { text: '📝 메모' });
        notesTitle.style.cssText = 'margin: 0 0 16px 0; color: var(--text-normal);';
        
        const noteList = notesSection.createDiv();
        
        if (weeklyData.notes && weeklyData.notes.length > 0) {
            weeklyData.notes.forEach((note, idx) => {
                const noteDiv = noteList.createDiv();
                noteDiv.style.cssText = 'padding: 12px; background: var(--background-primary); border: 1px solid var(--background-modifier-border); border-radius: 8px; margin-bottom: 8px; cursor: pointer; transition: all 0.2s;';
                noteDiv.textContent = `💬 ${note}`;
                noteDiv.onclick = () => {
                    new TestNoteEditModal(this.app, note, async (newText) => {
                        weeklyData.notes[idx] = newText;
                        await this.plugin.saveSettings();
                        await this.syncWeeklyGoalFile(weekKey, weeklyData);
                        this.onOpen();
                    }, async () => {
                        weeklyData.notes.splice(idx, 1);
                        await this.plugin.saveSettings();
                        await this.syncWeeklyGoalFile(weekKey, weeklyData);
                        this.onOpen();
                    }).open();
                };
                
                noteDiv.addEventListener('mouseenter', () => {
                    noteDiv.style.borderColor = 'var(--interactive-accent)';
                    noteDiv.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                });
                noteDiv.addEventListener('mouseleave', () => {
                    noteDiv.style.borderColor = 'var(--background-modifier-border)';
                    noteDiv.style.boxShadow = 'none';
                });
            });
        } else {
            const emptyMsg = noteList.createDiv({ text: '메모가 없습니다.' });
            emptyMsg.style.cssText = 'color: var(--text-muted); text-align: center; padding: 20px; font-style: italic;';
        }
        
        const addNoteBtn = notesSection.createEl('button', { text: '➕ 메모 추가' });
        addNoteBtn.style.cssText = 'width: 100%; padding: 10px; background: var(--interactive-accent); color: var(--text-on-accent); border: none; border-radius: 6px; cursor: pointer; font-weight: 600; margin-top: 12px;';
        addNoteBtn.onclick = () => {
            new TestNoteAddModal(this.app, async (text) => {
                if (!weeklyData.notes) weeklyData.notes = [];
                weeklyData.notes.push(text);
                await this.plugin.saveSettings();
                await this.syncWeeklyGoalFile(weekKey, weeklyData);
                this.onOpen();
            }).open();
        };
    }
    
    async renderTestMonthlyTab(container) {
        if (!this.plugin.settings.testManagementEnabled) {
            container.createDiv({ 
                cls: 'cloze-empty-message',
                text: '문제풀기가 비활성화되어 있습니다.'
            });
            return;
        }
        
        const calendarContainer = container.createDiv({ cls: 'cloze-calendar-container' });
        
        const monthNav = calendarContainer.createDiv({ cls: 'cloze-month-nav' });
        
        const prevBtn = monthNav.createEl('button', { cls: 'cloze-month-btn', text: '◀' });
        const prevHandler = () => {
            this.currentDate.setMonth(this.currentDate.getMonth() - 1);
            this.onOpen();
        };
        prevBtn.onclick = prevHandler;
        prevBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            prevHandler();
        });
        
        const monthTitle = monthNav.createDiv({ cls: 'cloze-month-title' });
        monthTitle.setText(`${this.currentDate.getFullYear()}년 ${this.currentDate.getMonth() + 1}월`);
        
        const nextBtn = monthNav.createEl('button', { cls: 'cloze-month-btn', text: '▶' });
        const nextHandler = () => {
            this.currentDate.setMonth(this.currentDate.getMonth() + 1);
            this.onOpen();
        };
        nextBtn.onclick = nextHandler;
        nextBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            nextHandler();
        });
        
        const todayBtn = monthNav.createEl('button', { cls: 'cloze-today-btn', text: 'Today' });
        const todayHandler = () => {
            this.currentDate = new Date();
            this.onOpen();
        };
        todayBtn.onclick = todayHandler;
        todayBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            todayHandler();
        });
        
        // 달력 그리드
        const weekHeader = calendarContainer.createDiv({ cls: 'cloze-week-header' });
        const days = ['일', '월', '화', '수', '목', '금', '토'];
        days.forEach(day => weekHeader.createDiv({ cls: 'cloze-week-day', text: day }));
        
        const calendarGrid = calendarContainer.createDiv({ cls: 'cloze-calendar-grid' });
        this.renderCalendarDays(calendarGrid);
        
        // 월간 할일 섹션
        const monthKey = `${this.currentDate.getFullYear()}-${String(this.currentDate.getMonth() + 1).padStart(2, '0')}`;
        this.renderGoalSection(container, 'monthly', monthKey);
    }
    
    renderCalendarDays(grid) {
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const today = new Date();
        
        for (let i = 0; i < firstDay; i++) {
            grid.createDiv({ cls: 'cloze-calendar-day empty' });
        }
        
        for (let day = 1; day <= daysInMonth; day++) {
            const dayEl = grid.createDiv({ cls: 'cloze-calendar-day' });
            const date = new Date(year, month, day);
            
            if (date.toDateString() === today.toDateString()) {
                dayEl.addClass('today');
            }
            
            dayEl.createDiv({ cls: 'cloze-day-num', text: day.toString() });
            
            // 해당 날짜의 체크리스트 완료 개수 확인
            const dateStr = this.formatDate(date);
            const dailyData = this.plugin.settings.dailyChecklists?.[dateStr];
            
            if (dailyData && dailyData.items && dailyData.items.length > 0) {
                const completedCount = dailyData.items.filter(item => item.completed).length;
                const totalCount = dailyData.items.length;
                
                const progress = dayEl.createDiv({ cls: 'cloze-day-progress' });
                progress.setText(`✓${completedCount}/${totalCount}`);
                
                // 완료율에 따른 색상
                const completionRate = (completedCount / totalCount) * 100;
                if (completionRate === 100) dayEl.addClass('completed');
                else if (completionRate >= 50) dayEl.addClass('in-progress');
            }
            
            const dayHandler = () => {
                this.currentDate = date;
                this.currentTab = 'test-daily';
                this.onOpen();
            };
            
            let touchStartTime = 0;
            dayEl.addEventListener('touchstart', () => {
                touchStartTime = Date.now();
            }, { passive: true });
            
            dayEl.addEventListener('touchend', (e) => {
                const touchDuration = Date.now() - touchStartTime;
                if (touchDuration < 500) { // 0.5초 이내 탭만 인식
                    e.preventDefault();
                    dayHandler();
                }
            });
            
            dayEl.onclick = dayHandler;
        }
    }
    
    getTodayStats() {
        const today = this.formatDate(this.currentDate);
        const history = this.plugin.settings.stats.studyHistory || [];
        
        const todaySessions = history.filter(h => h.date?.startsWith(today));
        
        const totalCards = todaySessions.reduce((sum, s) => sum + (s.total || 0), 0);
        const correct = todaySessions.reduce((sum, s) => sum + (s.correct || 0), 0);
        const totalTime = todaySessions.reduce((sum, s) => sum + (s.duration || 0), 0);
        
        return {
            sessions: todaySessions.map(s => ({
                timestamp: s.timestamp || s.date,
                folder: s.folder || null,
                folderName: s.folderName || s.fileName || '알 수 없음',
                fileName: s.fileName || '알 수 없음',
                total: s.total || 0,
                correct: s.correct || 0,
                accuracy: s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0
            })),
            totalSessions: todaySessions.length,
            totalCards,
            correct,
            accuracy: totalCards > 0 ? Math.round((correct / totalCards) * 100) : 0,
            totalTime
        };
    }
    
    getDayStats(date) {
        const dateStr = this.formatDate(date);
        const history = this.plugin.settings.stats.studyHistory || [];
        
        const daySessions = history.filter(h => h.date?.startsWith(dateStr));
        
        const totalCards = daySessions.reduce((sum, s) => sum + (s.total || 0), 0);
        const correct = daySessions.reduce((sum, s) => sum + (s.correct || 0), 0);
        
        return {
            sessions: daySessions.length,
            cards: totalCards,
            accuracy: totalCards > 0 ? Math.round((correct / totalCards) * 100) : 0
        };
    }
    
    getWeekStats() {
        const history = this.plugin.settings.stats.studyHistory || [];
        const today = new Date();
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        
        const weekSessions = history.filter(h => {
            const sessionDate = new Date(h.date || h.timestamp);
            return sessionDate >= weekAgo && sessionDate <= today;
        });
        
        const dailyMap = {};
        weekSessions.forEach(s => {
            const day = this.formatDate(new Date(s.date || s.timestamp));
            if (!dailyMap[day]) {
                dailyMap[day] = { sessions: 0, cards: 0, correct: 0 };
            }
            dailyMap[day].sessions++;
            dailyMap[day].cards += s.total || 0;
            dailyMap[day].correct += s.correct || 0;
        });
        
        const dailyStats = Object.keys(dailyMap).sort().map(date => ({
            date,
            sessions: dailyMap[date].sessions,
            cards: dailyMap[date].cards,
            accuracy: dailyMap[date].cards > 0 ? 
                Math.round((dailyMap[date].correct / dailyMap[date].cards) * 100) : 0
        }));
        
        const totalCards = weekSessions.reduce((sum, s) => sum + (s.total || 0), 0);
        const correct = weekSessions.reduce((sum, s) => sum + (s.correct || 0), 0);
        const totalTime = weekSessions.reduce((sum, s) => sum + (s.duration || 0), 0);
        
        return {
            studyDays: Object.keys(dailyMap).length,
            totalSessions: weekSessions.length,
            totalCards,
            correct,
            accuracy: totalCards > 0 ? Math.round((correct / totalCards) * 100) : 0,
            totalTime,
            dailyStats
        };
    }
    
    getMonthStats() {
        const history = this.plugin.settings.stats.studyHistory || [];
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        
        const monthSessions = history.filter(h => {
            const sessionDate = new Date(h.date || h.timestamp);
            return sessionDate.getFullYear() === year && sessionDate.getMonth() === month;
        });
        
        const days = new Set();
        monthSessions.forEach(s => {
            days.add(this.formatDate(new Date(s.date || s.timestamp)));
        });
        
        const totalCards = monthSessions.reduce((sum, s) => sum + (s.total || 0), 0);
        const correct = monthSessions.reduce((sum, s) => sum + (s.correct || 0), 0);
        const totalTime = monthSessions.reduce((sum, s) => sum + (s.duration || 0), 0);
        
        return {
            studyDays: days.size,
            totalSessions: monthSessions.length,
            totalCards,
            correct,
            accuracy: totalCards > 0 ? Math.round((correct / totalCards) * 100) : 0,
            totalTime
        };
    }
    
    getWeekKey(date) {
        const year = date.getFullYear();
        const oneJan = new Date(year, 0, 1);
        const weekNum = Math.ceil((((date - oneJan) / 86400000) + oneJan.getDay() + 1) / 7);
        return `${year}-W${String(weekNum).padStart(2, '0')}`;
    }
    
    renderGoalSection(container, type, key) {
        const section = container.createDiv({ cls: 'cloze-checklist-section' });
        section.style.cssText = 'margin-top: 20px; padding: 16px; background: var(--background-secondary); border-radius: 8px;';
        
        const header = section.createDiv({ cls: 'cloze-checklist-header' });
        header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;';
        
        // 타입에 따라 제목 변경
        const titleText = type === 'weekly' ? '🎯 주간 목표' : type === 'monthly' ? '📋 월간 목표' : '✅ 일일 체크리스트';
        const titleEl = header.createEl('h4', { text: titleText, cls: 'cloze-checklist-title' });
        titleEl.style.color = 'var(--text-normal)';
        
        // 템플릿 버튼 그룹
        const templateBtnGroup = header.createDiv({ cls: 'cloze-template-btn-group' });
        templateBtnGroup.style.cssText = 'display: flex; gap: 6px;';
        
        // 데이터 가져오기
        const dataKey = `${type}Checklists`;
        if (!this.plugin.settings[dataKey]) this.plugin.settings[dataKey] = {};
        if (!this.plugin.settings[dataKey][key]) {
            this.plugin.settings[dataKey][key] = { items: [], notes: [] };
        }
        const data = this.plugin.settings[dataKey][key];
        
        // 템플릿 불러오기 버튼
        const loadTemplateBtn = templateBtnGroup.createEl('button', { text: '📂 템플릿' });
        loadTemplateBtn.style.cssText = 'padding: 4px 12px; font-size: 0.9em; cursor: pointer;';
        loadTemplateBtn.onclick = () => {
            this.showTemplateLoadModal(type, key, data);
        };
        
        // 현재 리스트를 템플릿으로 저장 버튼
        const saveTemplateBtn = templateBtnGroup.createEl('button', { text: '💾 저장' });
        saveTemplateBtn.style.cssText = 'padding: 4px 12px; font-size: 0.9em; cursor: pointer;';
        saveTemplateBtn.onclick = () => {
            if (data.items.length === 0) {
                new Notice('저장할 항목이 없습니다.');
                return;
            }
            this.showTemplateEditModal(type, null, data);
        };
        
        // 체크리스트 아이템
        const itemList = section.createDiv({ cls: 'cloze-checklist-items' });
        itemList.style.cssText = 'margin-bottom: 12px;';
        
        if (data.items.length === 0) {
            itemList.createDiv({ 
                text: '체크리스트가 비어있습니다. 항목을 추가하세요.',
                cls: 'cloze-empty-message'
            });
        } else {
            data.items.forEach((item, index) => {
                const itemDiv = itemList.createDiv({ cls: 'cloze-checklist-item' });
                itemDiv.style.cssText = 'display: flex; align-items: center; gap: 8px; padding: 6px 0;';
                
                const checkbox = itemDiv.createEl('input', { type: 'checkbox' });
                checkbox.checked = item.completed || false;
                checkbox.style.cssText = 'width: 18px; height: 18px; cursor: pointer;';
                checkbox.onchange = async () => {
                    data.items[index].completed = checkbox.checked;
                    await this.plugin.saveSettings();
                };
                
                const text = itemDiv.createEl('span', { text: item.text });
                text.style.cssText = item.completed ? 'text-decoration: line-through; color: var(--text-muted);' : '';
                
                const deleteBtn = itemDiv.createEl('button', { text: '🗑️' });
                deleteBtn.style.cssText = 'margin-left: auto; padding: 2px 8px; cursor: pointer;';
                deleteBtn.onclick = async () => {
                    data.items.splice(index, 1);
                    await this.plugin.saveSettings();
                    this.onOpen();
                };
            });
        }
        
        // 항목 추가 버튼
        const addItemBtn = section.createEl('button', { text: '+ 항목 추가', cls: 'cloze-add-btn' });
        addItemBtn.style.cssText = 'margin-bottom: 12px;';
        addItemBtn.onclick = () => {
            new TextInputModal(
                this.app,
                '새 항목 추가',
                '체크리스트 항목을 입력하세요',
                '',
                async (text) => {
                    data.items.push({ text, completed: false });
                    await this.plugin.saveSettings();
                    this.onOpen();
                }
            ).open();
        };
        
        // 메모 섹션
        const memoHeader = section.createEl('h4', { text: '📝 메모', cls: 'cloze-memo-title' });
        memoHeader.style.cssText = 'margin-top: 16px; color: var(--text-normal);';
        
        const noteList = section.createDiv({ cls: 'cloze-note-list' });
        noteList.style.cssText = 'margin-bottom: 12px;';
        
        if (data.notes.length === 0) {
            const emptyMsg = noteList.createDiv({ 
                text: '메모가 없습니다. 클릭하여 추가하세요.',
                cls: 'cloze-empty-message'
            });
            emptyMsg.style.cssText = 'color: var(--text-muted); font-style: italic; padding: 8px;';
        } else {
            data.notes.forEach((note, index) => {
                const noteDiv = noteList.createDiv({ cls: 'cloze-note-item' });
                noteDiv.style.cssText = 'background: var(--background-primary); padding: 10px; border-radius: 6px; margin-bottom: 8px; position: relative; border-left: 3px solid var(--interactive-accent);';
                
                const noteText = noteDiv.createEl('div', { text: note });
                noteText.style.cssText = 'white-space: pre-wrap; padding-right: 30px; color: var(--text-normal);';
                
                const deleteBtn = noteDiv.createEl('button', { text: '🗑️' });
                deleteBtn.style.cssText = 'position: absolute; top: 8px; right: 8px; padding: 2px 6px; cursor: pointer; background: var(--background-modifier-error); border-radius: 4px;';
                deleteBtn.onclick = async () => {
                    data.notes.splice(index, 1);
                    await this.plugin.saveSettings();
                    this.onOpen();
                };
            });
        }
        
        // 메모 추가 버튼
        const addNoteBtn = section.createEl('button', { text: '+ 메모 추가', cls: 'cloze-add-btn' });
        addNoteBtn.style.cssText = 'width: 100%; padding: 8px; background: var(--interactive-accent); color: var(--text-on-accent); border: none; border-radius: 6px; cursor: pointer; font-weight: 500;';
        addNoteBtn.onclick = () => {
            new TextInputModal(
                this.app,
                '새 메모 추가',
                '메모 내용을 입력하세요',
                '',
                async (text) => {
                    data.notes.push(text);
                    await this.plugin.saveSettings();
                    this.onOpen();
                },
                true // multiline
            ).open();
        };
    }
    
    showTemplateLoadModal(type, key, data) {
        const modal = new Modal(this.app);
        modal.titleEl.setText('템플릿 관리');
        
        const content = modal.contentEl;
        content.style.cssText = 'padding: 20px;';
        
        const templates = this.plugin.settings.checklistTemplates.filter(t => t.type === type);
        
        if (templates.length === 0) {
            content.createEl('p', { text: '저장된 템플릿이 없습니다.' });
            
            const newTemplateBtn = content.createEl('button', { text: '+ 새 템플릿 만들기', cls: 'mod-cta' });
            newTemplateBtn.style.cssText = 'margin-top: 12px; width: 100%;';
            newTemplateBtn.onclick = () => {
                modal.close();
                this.showTemplateEditModal(type, null);
            };
            
            const closeBtn = content.createEl('button', { text: '닫기' });
            closeBtn.style.cssText = 'margin-top: 8px; width: 100%;';
            closeBtn.onclick = () => modal.close();
            modal.open();
            return;
        }
        
        content.createEl('h3', { text: '템플릿 목록' });
        
        const templateList = content.createDiv({ cls: 'cloze-template-list' });
        templateList.style.cssText = 'display: flex; flex-direction: column; gap: 10px; margin: 16px 0; max-height: 400px; overflow-y: auto;';
        
        templates.forEach(template => {
            const templateDiv = templateList.createDiv({ cls: 'cloze-template-item' });
            templateDiv.style.cssText = 'padding: 12px; background: var(--background-secondary); border-radius: 6px; border: 1px solid var(--background-modifier-border);';
            
            const header = templateDiv.createDiv();
            header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;';
            
            const nameDiv = header.createEl('div', { text: template.name });
            nameDiv.style.cssText = 'font-weight: bold; font-size: 1.1em;';
            
            const countDiv = header.createEl('div', { text: `${template.items.length}개 항목` });
            countDiv.style.cssText = 'font-size: 0.9em; color: var(--text-muted);';
            
            // 항목 미리보기
            if (template.items.length > 0) {
                const preview = templateDiv.createDiv();
                preview.style.cssText = 'font-size: 0.85em; color: var(--text-muted); margin-bottom: 8px; padding-left: 8px; border-left: 2px solid var(--background-modifier-border);';
                const previewItems = template.items.slice(0, 3);
                preview.innerHTML = previewItems.map(item => `• ${item}`).join('<br>');
                if (template.items.length > 3) {
                    preview.innerHTML += `<br>... 및 ${template.items.length - 3}개 더`;
                }
            }
            
            const btnGroup = templateDiv.createDiv();
            btnGroup.style.cssText = 'display: flex; gap: 6px;';
            
            // Apply 버튼
            const applyBtn = btnGroup.createEl('button', { text: '📥 Apply' });
            applyBtn.style.cssText = 'flex: 1; padding: 8px 12px; background: var(--interactive-accent); color: var(--text-on-accent); border: none; border-radius: 4px; cursor: pointer; font-weight: bold;';
            applyBtn.onclick = async () => {
                template.items.forEach(itemText => {
                    data.items.push({ text: itemText, completed: false });
                });
                await this.plugin.saveSettings();
                this.onOpen();
                modal.close();
                new Notice(`"${template.name}" 템플릿이 적용되었습니다!`);
            };
            
            // Edit 버튼
            const editBtn = btnGroup.createEl('button', { text: '✏️ Edit' });
            editBtn.style.cssText = 'flex: 1; padding: 8px 12px; background: var(--background-modifier-border); border: none; border-radius: 4px; cursor: pointer;';
            editBtn.onclick = () => {
                modal.close();
                this.showTemplateEditModal(type, template);
            };
            
            // Delete 버튼
            const deleteBtn = btnGroup.createEl('button', { text: '🗑️' });
            deleteBtn.style.cssText = 'padding: 8px 12px; background: var(--background-modifier-error); color: white; border: none; border-radius: 4px; cursor: pointer;';
            deleteBtn.onclick = async () => {
                const index = this.plugin.settings.checklistTemplates.findIndex(t => t.id === template.id);
                if (index > -1) {
                    this.plugin.settings.checklistTemplates.splice(index, 1);
                    await this.plugin.saveSettings();
                    modal.close();
                    this.onOpen();
                    new Notice('템플릿이 삭제되었습니다.');
                }
            };
        });
        
        // 하단 버튼
        const bottomBtns = content.createDiv();
        bottomBtns.style.cssText = 'display: flex; gap: 8px; margin-top: 16px;';
        
        const newTemplateBtn = bottomBtns.createEl('button', { text: '+ 새 템플릿', cls: 'mod-cta' });
        newTemplateBtn.style.cssText = 'flex: 1;';
        newTemplateBtn.onclick = () => {
            modal.close();
            this.showTemplateEditModal(type, null);
        };
        
        const cancelBtn = bottomBtns.createEl('button', { text: '닫기' });
        cancelBtn.style.cssText = 'flex: 1;';
        cancelBtn.onclick = () => modal.close();
        
        modal.open();
    }
    
    showTemplateEditModal(type, template = null, currentData = null) {
        const modal = new Modal(this.app);
        const isNew = !template;
        const isMobile = window.innerWidth <= 768;
        
        modal.titleEl.setText(isNew ? '새 템플릿 만들기' : '템플릿 편집');
        
        if (isMobile) {
            modal.modalEl.style.width = '95vw';
            modal.modalEl.style.maxWidth = '95vw';
        }
        
        const content = modal.contentEl;
        content.style.cssText = 'padding: 20px;';
        
        const form = content.createDiv({ cls: 'template-form' });
        
        // 템플릿 이름
        form.createEl('label', { text: '템플릿 이름' }).style.cssText = 'font-weight: bold; margin-bottom: 6px; display: block;';
        const nameInput = form.createEl('input', { type: 'text', value: template?.name || '' });
        nameInput.style.cssText = `width: 100%; padding: ${isMobile ? '12px' : '8px'}; margin-bottom: 15px; font-size: ${isMobile ? '1rem' : '0.95rem'}; border: 1px solid var(--background-modifier-border); border-radius: 4px; background: var(--background-primary);`;
        nameInput.placeholder = '예: 기본 일일 루틴';
        
        // 항목 리스트
        form.createEl('label', { text: '항목 (한 줄에 하나씩)' }).style.cssText = 'font-weight: bold; margin-bottom: 6px; display: block;';
        const itemsTextarea = form.createEl('textarea');
        
        // 현재 데이터로 초기화 (저장 버튼에서 온 경우) 또는 템플릿 데이터
        let initialItems = '';
        if (currentData?.items) {
            initialItems = currentData.items.map(item => item.text).join('\n');
        } else if (template?.items) {
            initialItems = template.items.join('\n');
        }
        
        itemsTextarea.value = initialItems;
        itemsTextarea.style.cssText = `width: 100%; min-height: ${isMobile ? '120px' : '150px'}; padding: ${isMobile ? '12px' : '10px'}; margin-bottom: 15px; font-size: ${isMobile ? '1rem' : '0.95rem'}; border: 1px solid var(--background-modifier-border); border-radius: 4px; background: var(--background-primary); font-family: inherit; resize: vertical;`;
        itemsTextarea.placeholder = '예:\n아침 복습\n저녁 복습\n오답 정리';
        
        // 버튼 컨테이너
        const btnContainer = form.createDiv();
        btnContainer.style.cssText = 'display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;';
        
        // 저장 버튼
        const saveBtn = btnContainer.createEl('button', { text: '저장', cls: 'mod-cta' });
        saveBtn.style.cssText = `flex: 1; padding: ${isMobile ? '12px 20px' : '8px 16px'}; font-size: ${isMobile ? '1rem' : '0.95rem'}; min-height: ${isMobile ? '48px' : '36px'}; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;`;
        saveBtn.onclick = async () => {
            const templateName = nameInput.value.trim();
            const items = itemsTextarea.value.split('\n').filter(item => item.trim()).map(item => item.trim());
            
            if (!templateName) {
                new Notice('템플릿 이름을 입력하세요.');
                return;
            }
            
            if (items.length === 0) {
                new Notice('최소 1개의 항목을 입력하세요.');
                return;
            }
            
            if (!this.plugin.settings.checklistTemplates) {
                this.plugin.settings.checklistTemplates = [];
            }
            
            if (isNew) {
                const newTemplate = {
                    id: Date.now().toString(),
                    name: templateName,
                    type: type,
                    items: items
                };
                this.plugin.settings.checklistTemplates.push(newTemplate);
            } else {
                const index = this.plugin.settings.checklistTemplates.findIndex(t => t.id === template.id);
                if (index > -1) {
                    this.plugin.settings.checklistTemplates[index].name = templateName;
                    this.plugin.settings.checklistTemplates[index].items = items;
                }
            }
            
            await this.plugin.saveSettings();
            modal.close();
            this.onOpen();
            new Notice(`템플릿이 ${isNew ? '저장' : '수정'}되었습니다!`);
        };
        
        // 삭제 버튼 (편집 모드일 때만)
        if (!isNew) {
            const deleteBtn = btnContainer.createEl('button', { text: '삭제' });
            deleteBtn.style.cssText = `flex: 1; padding: ${isMobile ? '12px 20px' : '8px 16px'}; font-size: ${isMobile ? '1rem' : '0.95rem'}; min-height: ${isMobile ? '48px' : '36px'}; background: var(--background-modifier-error); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;`;
            deleteBtn.onclick = async () => {
                const index = this.plugin.settings.checklistTemplates.findIndex(t => t.id === template.id);
                if (index > -1) {
                    this.plugin.settings.checklistTemplates.splice(index, 1);
                    await this.plugin.saveSettings();
                    modal.close();
                    this.onOpen();
                    new Notice('템플릿이 삭제되었습니다!');
                }
            };
        }
        
        // 취소 버튼
        const cancelBtn = btnContainer.createEl('button', { text: '취소' });
        cancelBtn.style.cssText = `flex: 1; padding: ${isMobile ? '12px 20px' : '8px 16px'}; font-size: ${isMobile ? '1rem' : '0.95rem'}; min-height: ${isMobile ? '48px' : '36px'}; background: var(--background-modifier-border); border: none; border-radius: 6px; cursor: pointer;`;
        cancelBtn.onclick = () => modal.close();
        
        modal.open();
        
        // 포커스
        setTimeout(() => nameInput.focus(), 50);
    }
    
    renderTestItems(container, testData, type) {
        if (!testData) testData = { items: [], notes: [] };
        if (!testData.items) testData.items = [];
        if (!testData.notes) testData.notes = [];
        
        // 템플릿 적용
        const templateSection = container.createDiv({ cls: 'cloze-template-section' });
        templateSection.createEl('h4', { text: '📋 템플릿 적용' });
        
        const templateList = templateSection.createDiv({ cls: 'cloze-template-list' });
        const templates = this.plugin.settings.testTemplates.filter(t => t.type === type);
        
        templates.forEach(template => {
            const btn = templateList.createEl('button', { 
                text: template.name,
                cls: 'cloze-template-btn'
            });
            const templateHandler = async () => {
                template.items.forEach(item => {
                    testData.items.push({ text: item, checked: false });
                });
                await this.writeTestFile(this.currentDate, testData, type);
                this.onOpen();
                new Notice(`"${template.name}" 템플릿이 적용되었습니다!`);
            };
            btn.onclick = templateHandler;
            btn.addEventListener('touchend', async (e) => {
                e.preventDefault();
                await templateHandler();
            });
        });
        
        // 테스트 항목 목록
        const itemSection = container.createDiv({ cls: 'cloze-test-items-section' });
        itemSection.createEl('h4', { text: '✅ 테스트 항목' });
        
        const itemList = itemSection.createDiv({ cls: 'cloze-test-item-list' });
        
        testData.items.forEach((item, index) => {
            const itemDiv = itemList.createDiv({ cls: 'cloze-test-item' });
            
            const checkbox = itemDiv.createEl('input', { type: 'checkbox' });
            checkbox.checked = item.checked;
            const checkHandler = async () => {
                item.checked = checkbox.checked;
                await this.writeTestFile(this.currentDate, testData, type);
                this.onOpen();
            };
            checkbox.onchange = checkHandler;
            checkbox.addEventListener('touchend', async (e) => {
                // 체크박스는 기본 동작 유지
                setTimeout(async () => {
                    await checkHandler();
                }, 50);
            });
            
            const text = itemDiv.createDiv({ cls: 'cloze-test-item-text', text: item.text });
            if (item.checked) text.addClass('checked');
            
            const deleteBtn = itemDiv.createEl('button', { cls: 'cloze-delete-btn', text: '×' });
            const deleteHandler = async () => {
                testData.items.splice(index, 1);
                await this.writeTestFile(this.currentDate, testData, type);
                this.onOpen();
            };
            deleteBtn.onclick = deleteHandler;
            deleteBtn.addEventListener('touchend', async (e) => {
                e.preventDefault();
                await deleteHandler();
            });
        });
        
        const addBtn = itemSection.createEl('button', { 
            text: '+ 항목 추가',
            cls: 'cloze-add-btn'
        });
        const addItemHandler = () => {
            new TestItemAddModal(this.app, async (text) => {
                testData.items.push({ text: text, checked: false });
                await this.writeTestFile(this.currentDate, testData, type);
                this.onOpen();
            }).open();
        };
        addBtn.onclick = addItemHandler;
        addBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            addItemHandler();
        });
        
        // 노트 섹션
        const noteSection = container.createDiv({ cls: 'cloze-test-notes-section' });
        noteSection.createEl('h4', { text: '💬 메모' });
        
        const noteList = noteSection.createDiv({ cls: 'cloze-note-list' });
        
        testData.notes.forEach((note, index) => {
            const noteDiv = noteList.createDiv({ cls: 'cloze-note-item', text: note.text });
            
            const deleteBtn = noteDiv.createEl('button', { cls: 'cloze-delete-btn-inline', text: '×' });
            const deleteNoteHandler = async () => {
                testData.notes.splice(index, 1);
                await this.writeTestFile(this.currentDate, testData, type);
                this.onOpen();
            };
            deleteBtn.onclick = deleteNoteHandler;
            deleteBtn.addEventListener('touchend', async (e) => {
                e.preventDefault();
                await deleteNoteHandler();
            });
        });
        
        const addNoteBtn = noteSection.createEl('button', { 
            text: '+ 메모 추가',
            cls: 'cloze-add-btn'
        });
        const addNoteHandler = () => {
            new TestNoteAddModal(this.app, async (text) => {
                testData.notes.push({ text: text });
                await this.writeTestFile(this.currentDate, testData, type);
                this.onOpen();
            }).open();
        };
        addNoteBtn.onclick = addNoteHandler;
        addNoteBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            addNoteHandler();
        });
    }
    
    formatDateKorean(date) {
        const days = ['일', '월', '화', '수', '목', '금', '토'];
        return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${days[date.getDay()]})`;
    }
    
    async readTestFile(date, type) {
        const filePath = await this.getTestFilePath(date, type);
        
        try {
            const file = this.app.vault.getAbstractFileByPath(filePath);
            if (file instanceof TFile) {
                const content = await this.app.vault.read(file);
                return this.parseTestContent(content);
            }
        } catch (err) {
            console.log('테스트 파일 읽기 실패:', err);
        }
        
        return { items: [], notes: [] };
    }
    
    parseTestContent(content) {
        const data = { items: [], notes: [], quizzes: [] };
        const lines = content.split('\n');
        let currentSection = '';
        
        for (let line of lines) {
            line = line.trim();
            
            if (line.startsWith('## 📝 오늘의 퀴즈')) {
                currentSection = 'quizzes';
            } else if (line.startsWith('## ✅ 테스트 항목')) {
                currentSection = 'items';
            } else if (line.startsWith('## 💬 메모')) {
                currentSection = 'notes';
            } else if (currentSection === 'quizzes' && (line.startsWith('- [ ]') || line.startsWith('- [x]'))) {
                const checked = line.startsWith('- [x]');
                const text = line.substring(6).trim();
                const match = text.match(/^(.+?)\s+-\s+(\d+)개\s+\((\d+)\/(\d+)\)/);
                if (match) {
                    data.quizzes.push({
                        folderName: match[1],
                        count: parseInt(match[2]),
                        correct: parseInt(match[3]),
                        total: parseInt(match[4]),
                        completed: checked
                    });
                } else {
                    const simpleMatch = text.match(/^(.+?)\s+-\s+(\d+)개/);
                    if (simpleMatch) {
                        data.quizzes.push({
                            folderName: simpleMatch[1],
                            count: parseInt(simpleMatch[2]),
                            completed: checked
                        });
                    }
                }
            } else if (currentSection === 'items' && (line.startsWith('- [ ]') || line.startsWith('- [x]'))) {
                const checked = line.startsWith('- [x]');
                const text = line.substring(6).trim();
                data.items.push({ text, checked });
            } else if (currentSection === 'notes' && line.startsWith('- ')) {
                const text = line.substring(2).trim();
                data.notes.push({ text });
            }
        }
        
        return data;
    }
    
    async writeTestFile(date, data, type) {
        if (!this.plugin.settings.syncTestsWithFiles) return;
        
        const filePath = await this.getTestFilePath(date, type);
        
        if (this.plugin.settings.autoCreateTestFolder) {
            await this.createTestFolderStructure(date, type);
        }
        
        const content = this.generateTestContent(date, data, type);
        
        try {
            const file = this.app.vault.getAbstractFileByPath(filePath);
            if (file instanceof TFile) {
                await this.app.vault.modify(file, content);
            } else {
                await this.app.vault.create(filePath, content);
            }
        } catch (err) {
            console.error('테스트 파일 쓰기 실패:', err);
            new Notice('파일 저장 실패!');
        }
    }
    
    generateTestContent(date, data, type) {
        const typeNames = { daily: '일별', weekly: '주간', monthly: '월간' };
        const dateStr = this.formatDateKorean(date);
        const completedCount = (data.quizzes?.filter(q => q.completed).length || 0) + (data.items?.filter(item => item.checked).length || 0);
        const totalCount = (data.quizzes?.length || 0) + (data.items?.length || 0);
        
        let content = `---
date: ${this.formatDate(date)}
type: ${type}
completed: ${completedCount}
total: ${totalCount}
---

# ${typeNames[type]} 테스트 - ${dateStr}

## 📝 오늘의 퀴즈
`;
        
        if (data.quizzes && data.quizzes.length > 0) {
            data.quizzes.forEach(quiz => {
                const checkbox = quiz.completed ? 'x' : ' ';
                if (quiz.total) {
                    content += `- [${checkbox}] ${quiz.folderName} - ${quiz.count}개 (${quiz.correct}/${quiz.total})\n`;
                } else {
                    content += `- [${checkbox}] ${quiz.folderName} - ${quiz.count}개\n`;
                }
            });
        } else {
            content += `(퀴즈 없음)\n`;
        }
        
        content += `\n## ✅ 테스트 항목\n`;
        
        if (data.items && data.items.length > 0) {
            data.items.forEach(item => {
                content += `- [${item.checked ? 'x' : ' '}] ${item.text}\n`;
            });
        } else {
            content += `(항목 없음)\n`;
        }
        
        content += `\n## 💬 메모\n`;
        
        if (data.notes && data.notes.length > 0) {
            data.notes.forEach(note => {
                content += `- ${note.text}\n`;
            });
        } else {
            content += `(메모 없음)\n`;
        }
        
        return content;
    }
    
    formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    
    async getTestFilePath(date, type) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        
        let folderPath = this.plugin.settings.testFolder;
        
        if (type === 'monthly') {
            folderPath = `${folderPath}/Monthly/${year}`;
            return `${folderPath}/${year}-${month}.md`;
        } else if (type === 'weekly') {
            const weekNum = this.getWeekNumber(date);
            folderPath = `${folderPath}/Weekly/${year}`;
            return `${folderPath}/Week-${weekNum}.md`;
        } else {
            if (this.plugin.settings.testFolderStructure === 'monthly') {
                folderPath = `${folderPath}/Daily/${year}/${month}`;
            } else if (this.plugin.settings.testFolderStructure === 'weekly') {
                const weekNum = this.getWeekNumber(date);
                folderPath = `${folderPath}/Daily/${year}/Week-${weekNum}`;
            } else {
                folderPath = `${folderPath}/Daily`;
            }
            return `${folderPath}/${dateStr}.md`;
        }
    }
    
    getWeekNumber(date) {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        const weekNum = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
        return weekNum;
    }
    
    async createWeeklyGoalFile(weekKey) {
        const folderPath = 'Learning Plans';
        const filePath = `${folderPath}/주간목표_${weekKey}.md`;
        
        try {
            // 폴더 생성
            const folder = this.app.vault.getAbstractFileByPath(folderPath);
            if (!folder) {
                await this.app.vault.createFolder(folderPath);
            }
            
            // 파일 내용
            const content = `---
week: ${weekKey}
type: weekly
---

# 📆 주간 목표 (${weekKey})

## ✅ 이번 주 목표

- [ ] 

## 📊 진행 상황


## 🎯 완료 사항

`;
            
            // 파일 생성
            await this.app.vault.create(filePath, content);
            new Notice(`✅ 주간 목표 파일이 생성되었습니다: ${weekKey}`);
        } catch (err) {
            console.error('주간 목표 파일 생성 실패:', err);
            new Notice('❌ 파일 생성 실패');
        }
    }
    
    async syncWeeklyGoalFile(weekKey, data) {
        const filePath = `Learning Plans/주간목표_${weekKey}.md`;
        
        try {
            const file = this.app.vault.getAbstractFileByPath(filePath);
            if (!file) {
                await this.createWeeklyGoalFile(weekKey);
                return;
            }
            
            // 파일 내용 생성
            let content = `---
week: ${weekKey}
type: weekly
---

# 📆 주간 목표 (${weekKey})

## ✅ 이번 주 목표

`;
            
            // 체크리스트 항목 추가
            if (data.items && data.items.length > 0) {
                data.items.forEach(item => {
                    content += `- [${item.completed ? 'x' : ' '}] ${item.text}\n`;
                });
            } else {
                content += '- [ ] \n';
            }
            
            content += `\n## 📊 진행 상황\n\n`;
            
            // 메모 추가
            if (data.notes && data.notes.length > 0) {
                data.notes.forEach(note => {
                    content += `- ${note}\n`;
                });
            }
            
            content += `\n## 🎯 완료 사항\n\n`;
            
            // 파일 수정
            await this.app.vault.modify(file, content);
        } catch (err) {
            console.error('주간 목표 파일 동기화 실패:', err);
        }
    }
    
    async loadWeeklyGoalFile(weekKey) {
        const filePath = `Learning Plans/주간목표_${weekKey}.md`;
        
        try {
            const file = this.app.vault.getAbstractFileByPath(filePath);
            if (!file) {
                new Notice('파일이 없습니다. 먼저 파일을 생성하세요.');
                return;
            }
            
            const content = await this.app.vault.read(file);
            
            // 체크리스트 파싱
            const items = [];
            const notes = [];
            
            const lines = content.split('\n');
            let inGoalsSection = false;
            let inProgressSection = false;
            
            for (const line of lines) {
                if (line.includes('## ✅ 이번 주 목표')) {
                    inGoalsSection = true;
                    inProgressSection = false;
                    continue;
                } else if (line.includes('## 📊 진행 상황')) {
                    inGoalsSection = false;
                    inProgressSection = true;
                    continue;
                } else if (line.startsWith('## ')) {
                    inGoalsSection = false;
                    inProgressSection = false;
                    continue;
                }
                
                if (inGoalsSection && line.trim().startsWith('- [')) {
                    const completed = line.includes('[x]') || line.includes('[X]');
                    const text = line.replace(/^- \[[xX\s]\]\s*/, '').trim();
                    if (text) {
                        items.push({ text, completed });
                    }
                } else if (inProgressSection && line.trim().startsWith('- ')) {
                    const text = line.replace(/^- /, '').trim();
                    if (text) {
                        notes.push(text);
                    }
                }
            }
            
            // 설정에 저장
            if (!this.plugin.settings.weeklyChecklists) {
                this.plugin.settings.weeklyChecklists = {};
            }
            this.plugin.settings.weeklyChecklists[weekKey] = { items, notes };
            await this.plugin.saveSettings();
            
        } catch (err) {
            console.error('주간 목표 파일 로드 실패:', err);
            new Notice('❌ 파일 로드 실패');
        }
    }
    
    formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    
    async createTestFolderStructure(date, type) {
        const filePath = await this.getTestFilePath(date, type);
        const folderPath = filePath.substring(0, filePath.lastIndexOf('/'));
        
        try {
            const folder = this.app.vault.getAbstractFileByPath(folderPath);
            if (!folder) {
                await this.app.vault.createFolder(folderPath);
            }
        } catch (err) {
            console.error('테스트 폴더 생성 실패:', err);
        }
    }

    async renderStatistics(container) {
        const section = container.createDiv({ cls: 'cloze-dashboard-section' });
        section.createEl('h3', { text: '📈 전체 통계' });

        const stats = await this.plugin.getGlobalStatistics();
        
        // stats 초기화 확인
        if (!this.plugin.settings.stats) {
            this.plugin.settings.stats = {
                totalAttempts: 0,
                totalCorrect: 0,
                totalTime: 0,
                lastStudyDate: null,
                studyHistory: [],
                folderStats: {}
            };
        }

        const grid = section.createDiv({ cls: 'cloze-stats-grid' });

        this.createStatCard(grid, '📁 총 폴더', stats.totalFolders);
        this.createStatCard(grid, '📄 총 노트', stats.totalNotes);
        this.createStatCard(grid, '🎯 총 문제', stats.totalClozes);
        this.createStatCard(grid, '✅ 완료 세션', this.plugin.settings.stats.totalCorrect);
        this.createStatCard(grid, '⏱️ 총 학습 시간', `${Math.round(this.plugin.settings.stats.totalTime / 60)}분`);
        this.createStatCard(grid, '📊 정답률', this.plugin.settings.stats.totalAttempts > 0 
            ? `${Math.round((this.plugin.settings.stats.totalCorrect / this.plugin.settings.stats.totalAttempts) * 100)}%` 
            : '0%');
    }

    createStatCard(container, label, value) {
        const card = container.createDiv({ cls: 'cloze-stat-card' });
        card.createEl('div', { text: value.toString(), cls: 'cloze-stat-number' });
        card.createEl('div', { text: label, cls: 'cloze-stat-label' });
    }

    async renderFolderStatus(container) {
        const section = container.createDiv({ cls: 'cloze-dashboard-section' });
        
        const headerDiv = section.createDiv({ cls: 'section-header' });
        headerDiv.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;';
        
        headerDiv.createEl('h3', { text: '📂 폴더별 퀴즈 관리' });
        
        const manageFolderBtn = headerDiv.createEl('button', { 
            text: '📁 폴더 관리',
            cls: 'cloze-action-btn'
        });
        manageFolderBtn.style.cssText = 'padding: 6px 12px; font-size: 13px;';
        const manageFolderHandler2 = () => {
            new FolderManagementModal(this.plugin.app, this.plugin).open();
        };
        manageFolderBtn.addEventListener('click', manageFolderHandler2);
        manageFolderBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            manageFolderHandler2();
        });

        const folders = await this.getClozefolders();
        
        if (folders.length === 0) {
            section.createEl('p', { 
                text: '퀴즈 문제가 있는 폴더가 없습니다. 새 주제 폴더를 만들어보세요!',
                cls: 'cloze-empty-message'
            });
            return;
        }

        // 폴더 카드 그리드 - 고급 디자인
        const folderGrid = section.createDiv({ cls: 'cloze-folder-grid' });
        folderGrid.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; margin-top: 16px;';

        for (const folder of folders) {
            const card = folderGrid.createDiv({ cls: 'cloze-folder-card' });
            card.style.cssText = `
                position: relative;
                padding: 16px;
                background: linear-gradient(135deg, #1e2330 0%, #242936 100%);
                border: 2px solid #3a4154;
                border-radius: 12px;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                overflow: hidden;
            `;
            
            // 배경 장식 효과
            const bgDecor = card.createDiv();
            bgDecor.style.cssText = `
                position: absolute;
                top: -30px;
                right: -30px;
                width: 100px;
                height: 100px;
                background: radial-gradient(circle, rgba(245, 158, 11, 0.08) 0%, transparent 70%);
                border-radius: 50%;
                pointer-events: none;
            `;
            
            // 폴더 헤더 - 개선된 디자인
            const cardHeader = card.createDiv();
            cardHeader.style.cssText = 'position: relative; z-index: 1; display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;';
            
            const folderInfo = cardHeader.createDiv();
            folderInfo.style.cssText = 'flex: 1;';
            
            const folderName = folderInfo.createEl('h4', { text: folder.name });
            folderName.style.cssText = `
                margin: 0 0 4px 0;
                font-size: 16px;
                font-weight: 700;
                color: #fbbf24;
                text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
                letter-spacing: -0.3px;
            `;
            
            const noteCount = folderInfo.createEl('div', { 
                text: `📄 ${folder.noteCount}개 노트`
            });
            noteCount.style.cssText = 'font-size: 13px; color: #9ca3af; font-weight: 500;';

            // 통계 - 더 세련된 디자인
            const stats = this.plugin.settings.stats.folderStats[folder.path] || { attempts: 0, correct: 0, time: 0 };
            const accuracy = stats.attempts > 0 ? Math.round((stats.correct / stats.attempts) * 100) : 0;

            const statsDiv = card.createDiv();
            statsDiv.style.cssText = `
                position: relative;
                z-index: 1;
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 8px;
                margin-bottom: 12px;
                padding: 12px;
                background: rgba(15, 17, 25, 0.6);
                border: 1px solid #2d3548;
                border-radius: 8px;
                backdrop-filter: blur(10px);
            `;
            
            const createStatItem = (icon, label, value, color) => {
                const item = statsDiv.createDiv();
                item.style.cssText = 'text-align: center;';
                
                const iconEl = item.createEl('div', { text: icon });
                iconEl.style.cssText = 'font-size: 16px; margin-bottom: 2px;';
                
                const valueEl = item.createEl('div', { text: value });
                valueEl.style.cssText = `
                    font-size: 18px;
                    font-weight: 800;
                    color: ${color};
                    text-shadow: 0 2px 8px ${color}40;
                    margin-bottom: 2px;
                `;
                
                const labelEl = item.createEl('div', { text: label });
                labelEl.style.cssText = 'font-size: 10px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;';
            };

            createStatItem('🎯', '정답률', `${accuracy}%`, accuracy >= 70 ? '#10b981' : accuracy >= 50 ? '#f59e0b' : '#ef4444');
            createStatItem('📊', '시도', `${stats.attempts}`, '#6366f1');
            createStatItem('⏱️', '시간', `${Math.round(stats.time / 60)}분`, '#8b5cf6');

            // 액션 버튼 - 현대적인 디자인
            const btnGroup = card.createDiv();
            btnGroup.style.cssText = 'position: relative; z-index: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 8px;';

            const quizBtn = btnGroup.createEl('button', { text: '🎯 퀴즈 시작' });
            quizBtn.style.cssText = `
                padding: 10px 12px;
                background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%);
                color: #000;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-weight: 700;
                font-size: 13px;
                transition: all 0.3s ease;
                box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
                text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
            `;
            quizBtn.onmouseenter = () => {
                quizBtn.style.transform = 'translateY(-2px)';
                quizBtn.style.boxShadow = '0 6px 16px rgba(245, 158, 11, 0.4)';
            };
            quizBtn.onmouseleave = () => {
                quizBtn.style.transform = 'translateY(0)';
                quizBtn.style.boxShadow = '0 4px 12px rgba(245, 158, 11, 0.3)';
            };
            const quizHandler = () => {
                new QuizModeModal(this.plugin.app, this.plugin, folder.path).open();
            };
            quizBtn.addEventListener('click', quizHandler);
            quizBtn.addEventListener('touchend', (e) => {
                e.preventDefault();
                quizHandler();
            });

            const newNoteBtn = btnGroup.createEl('button', { text: '➕ 새 노트' });
            newNoteBtn.style.cssText = `
                padding: 10px 12px;
                background: linear-gradient(135deg, #4b5563 0%, #374151 100%);
                color: #f3f4f6;
                border: 1px solid #6b7280;
                border-radius: 8px;
                cursor: pointer;
                font-weight: 600;
                font-size: 13px;
                transition: all 0.3s ease;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
            `;
            newNoteBtn.onmouseenter = () => {
                newNoteBtn.style.transform = 'translateY(-2px)';
                newNoteBtn.style.background = 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)';
                newNoteBtn.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
            };
            newNoteBtn.onmouseleave = () => {
                newNoteBtn.style.transform = 'translateY(0)';
                newNoteBtn.style.background = 'linear-gradient(135deg, #4b5563 0%, #374151 100%)';
                newNoteBtn.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.2)';
            };
            const newNoteHandler = async () => {
                await this.plugin.createClozeNoteInFolder(folder.path);
            };
            newNoteBtn.addEventListener('click', newNoteHandler);
            newNoteBtn.addEventListener('touchend', (e) => {
                e.preventDefault();
                newNoteHandler();
            });

            // 카드 호버 효과
            card.onmouseenter = () => {
                card.style.transform = 'translateY(-4px) scale(1.02)';
                card.style.borderColor = '#f59e0b';
                card.style.boxShadow = '0 12px 24px rgba(245, 158, 11, 0.2), 0 0 0 1px rgba(245, 158, 11, 0.1)';
            };
            card.onmouseleave = () => {
                card.style.transform = 'translateY(0) scale(1)';
                card.style.borderColor = '#3a4154';
                card.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
            };
        }
    }

    async getClozefolders() {
        const folders = [];
        
        // 북마크 폴더를 최상단에 추가 (항상 표시)
        const allQuestions = await this.plugin.loadAllQuestions();
        const bookmarkedQuestions = allQuestions.filter(q => q.bookmarked);
        const bookmarkCount = bookmarkedQuestions.length;
        const bookmarkFolderPath = this.plugin.settings.bookmarkFolder || '⭐ 북마크 목록';
        
        // 북마크가 없어도 폴더는 표시
        folders.push({
            name: '⭐ 북마크',
            path: bookmarkFolderPath,
            noteCount: bookmarkCount,
            isBookmarkFolder: true,
            renderStatus: '✅ 렌더링 완료'
        });
        
        // 설정의 questionFolders 사용
        const questionFolders = this.plugin.settings.questionFolders || ['기본'];
        
        for (const folderName of questionFolders) {
            const folderPath = `${this.plugin.settings.clozeFolder}/${this.plugin.settings.questionSubFolder || 'Questions'}/${folderName}`;
            const folderFile = this.plugin.app.vault.getAbstractFileByPath(folderPath);
            
            let noteCount = 0;
            if (folderFile && folderFile.children) {
                noteCount = folderFile.children.filter(f => f.extension === 'md').length;
            }
            
            // 문제 수와 관계없이 모든 폴더 표시
            folders.push({
                name: folderName,
                path: folderPath,
                noteCount: noteCount
            });
        }

        return folders;
    }

    async renderRecentSessions(container) {
        const section = container.createDiv({ cls: 'cloze-dashboard-section' });
        section.createEl('h3', { text: '📚 최근 학습 기록' });

        const sessions = await this.plugin.getRecentStudySessions(10);

        if (sessions.length === 0) {
            section.createEl('p', { 
                text: '아직 학습 기록이 없습니다.',
                cls: 'cloze-empty-message'
            });
            return;
        }

        const list = section.createDiv({ cls: 'cloze-session-list' });

        sessions.forEach(session => {
            const item = list.createDiv({ cls: 'cloze-session-item' });
            
            const date = new Date(session.timestamp);
            const dateStr = date.toLocaleDateString('ko-KR');
            const timeStr = date.toLocaleTimeString('ko-KR', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });

            item.createEl('span', { 
                text: `${dateStr} ${timeStr}`,
                cls: 'cloze-session-date'
            });

            item.createEl('span', { 
                text: session.folderName || '알 수 없음',
                cls: 'cloze-session-folder'
            });

            item.createEl('span', { 
                text: `Card ${session.cardNumber}`,
                cls: 'cloze-session-card'
            });

            item.createEl('span', { 
                text: `${session.duration}초`,
                cls: 'cloze-session-duration'
            });

            item.createEl('span', { 
                text: session.completed ? '✅ 완료' : '⏱️ 타임오버',
                cls: session.completed ? 'cloze-session-success' : 'cloze-session-timeout'
            });
        });
    }

    renderQuickActions(container) {
        const section = container.createDiv();
        section.style.cssText = 'margin-bottom: 24px;';
        
        const header = section.createDiv();
        header.style.cssText = 'margin-bottom: 12px;';
        const titleEl = header.createEl('h3', { text: '⚡ 빠른 작업' });
        titleEl.style.cssText = 'margin: 0; font-size: 1.1em; font-weight: 600;';

        const actions = section.createDiv();
        actions.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px;';

        const actionButtons = [
            { 
                text: '새 퀴즈',
                icon: '📝',
                action: () => new QuizCreatorModal(this.app, this.plugin).open(),
                color: '#667eea'
            },
            { 
                text: '학습 통계',
                icon: '📊',
                action: () => new StudyHistoryModal(this.plugin.app, this.plugin).open(),
                color: '#f093fb'
            },
            { 
                text: '폴더 관리',
                icon: '📁',
                action: () => new FolderManagementModal(this.app, this.plugin).open(),
                color: '#4facfe'
            },
            { 
                text: '북마크',
                icon: '⭐',
                action: () => new BookmarkListModal(this.app, this.plugin).open(),
                color: '#43e97b'
            },
            { 
                text: '설정',
                icon: '⚙️',
                action: () => {
                    this.app.setting.open();
                    this.app.setting.openTabById('learning-strategy-planner');
                },
                color: '#fa709a'
            },
            { 
                text: '초기화',
                icon: '🔄',
                action: () => this.resetAllProgress(),
                color: '#ff6b6b',
                warning: true
            }
        ];

        actionButtons.forEach(({ text, icon, action, color, warning }) => {
            const btn = actions.createEl('button');
            btn.style.cssText = `
                padding: 14px 12px;
                background: var(--background-primary-alt);
                border: 1px solid var(--background-modifier-border);
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.2s;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 8px;
                font-size: 13px;
                font-weight: 500;
                color: var(--text-normal);
            `;
            
            const iconEl = btn.createEl('div');
            iconEl.textContent = icon;
            iconEl.style.cssText = `
                font-size: 24px;
                width: 48px;
                height: 48px;
                background: ${color}20;
                border-radius: 10px;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s;
            `;
            
            const textEl = btn.createEl('div');
            textEl.textContent = text;
            textEl.style.cssText = 'font-size: 13px; font-weight: 500;';
            
            if (warning) {
                const warningDot = iconEl.createEl('span');
                warningDot.textContent = '⚠️';
                warningDot.style.cssText = 'position: absolute; top: -4px; right: -4px; font-size: 14px;';
            }
            
            const handleAction = (e) => {
                e.preventDefault();
                action();
            };
            
            btn.addEventListener('click', handleAction);
            btn.addEventListener('touchend', handleAction);
            
            btn.addEventListener('mouseenter', () => {
                btn.style.background = `${color}15`;
                btn.style.borderColor = color;
                btn.style.transform = 'translateY(-2px)';
                iconEl.style.background = `${color}40`;
                iconEl.style.transform = 'scale(1.1)';
            });
            
            btn.addEventListener('mouseleave', () => {
                btn.style.background = 'var(--background-primary-alt)';
                btn.style.borderColor = 'var(--background-modifier-border)';
                btn.style.transform = 'translateY(0)';
                iconEl.style.background = `${color}20`;
                iconEl.style.transform = 'scale(1)';
            });
        });
    }

    async resetAllProgress() {
        const confirmed = confirm('정말로 모든 학습 진행 상황을 초기화하시겠습니까?\n\n⚠️ 이 작업은 되돌릴 수 없습니다.\n\n삭제되는 내용:\n- 모든 폴더의 카드 진행 상황\n- 학습 기록 (시간, 완료 횟수)\n- 연속 학습일\n\n계속하시려면 확인을 클릭하세요.');
        
        if (!confirmed) return;

        // 폴더별 카드 번호 초기화
        Object.keys(this.plugin.settings.cardNumbersByFolder).forEach(folder => {
            this.plugin.settings.cardNumbersByFolder[folder] = 1;
        });
        
        this.plugin.settings.currentCardNumber = 1;
        
        // 학습 기록 초기화
        this.plugin.settings.studySessions = [];
        this.plugin.settings.totalStudyTime = 0;
        
        await this.plugin.saveSettings(true); // skipRefresh=true: 무한 루프 방지
        
        new Notice('✅ 모든 진행 상황이 초기화되었습니다');
        
        await this.onOpen();
    }

    async exportStatistics() {
        const stats = await this.plugin.getGlobalStatistics();
        const folderStats = await this.plugin.getFolderStatistics();
        const sessions = this.plugin.settings.studySessions || [];

        const exportData = {
            exportDate: new Date().toISOString(),
            globalStats: stats,
            folderStats: folderStats,
            sessions: sessions,
            settings: {
                clozeFolder: this.plugin.settings.clozeFolder,
                enableTimer: this.plugin.settings.enableTimer,
                defaultTimerDuration: this.plugin.settings.defaultTimerDuration
            }
        };

        const jsonStr = JSON.stringify(exportData, null, 2);
        
        // 클립보드에 복사
        navigator.clipboard.writeText(jsonStr).then(() => {
            new Notice('📋 통계가 클립보드에 복사되었습니다!');
        }).catch(() => {
            new Notice('❌ 복사 실패. 콘솔을 확인하세요.');
            console.log('Learning Planner Statistics Export:', jsonStr);
        });
    }

    async onClose() {
        // Cleanup
    }
}

// =====================================================
// Part 3: 메인 플러그인 클래스 시작
// =====================================================

class LearningStrategyPlugin extends Plugin {
    async onload() {
        await this.loadSettings();
        
        // QuizEditModal을 플러그인 인스턴스에 export
        this.QuizEditModal = QuizEditModal;
        
        // 기본 폴더 생성
        await this.createDefaultFolders();
        
        // 타이머 배열 초기화
        this.activeTimers = [];
        
        // 대시보드 뷰 등록 - 중복 등록 방지
        if (!this.app.viewRegistry.viewByType[DASHBOARD_VIEW_TYPE]) {
            this.registerView(
                DASHBOARD_VIEW_TYPE,
                (leaf) => new ClozeDashboardView(leaf, this)
            );
        }

        // 학습 플래너 리bon 아이콘
        this.addRibbonIcon('graduation-cap', '학습 플래너', () => {
            this.openClozeDashboardView();
        });

        // 대시보드 명령어
        this.addCommand({
            id: 'open-learning-planner',
            name: '학습 플래너 열기',
            callback: () => {
                this.openClozeDashboardView();
            }
        });

        // 이미지 빈칸 추가 명령어 - 비활성화
        // this.addCommand({
        //     id: 'add-image-cloze',
        //     name: 'Add image cloze',
        //     icon: 'image-plus',
        //     callback: () => {
        //         const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        //         if (!activeView) {
        //             new Notice('❌ 마크다운 파일을 열어주세요');
        //             return;
        //         }
        //         
        //         const file = activeView.file;
        //         if (!file) {
        //             new Notice('❌ 파일을 찾을 수 없습니다');
        //             return;
        //         }
        //         
        //         new ImageClozeModal(this.app, this, file, async () => {
        //             await activeView.leaf.rebuildView();
        //         }).open();
        //     }
        // });

        // 클립보드 이미지로 퀴즈 만들기 (Ctrl+Shift+V) - 비활성화
        // this.addCommand({
        //     id: 'paste-image-as-cloze',
        //     name: 'Paste image from clipboard as cloze',
        //     icon: 'clipboard-paste',
        //     hotkeys: [{ modifiers: ["Mod", "Shift"], key: "v" }],
        //     editorCallback: async (editor) => {
        //         await this.pasteImageAsCloze(editor);
        //     }
        // });

        this.addSettingTab(new LearningStrategySettingTab(this.app, this));
        this.addStyles();
        
        // 에디터 컨텍스트 메뉴에 퀴즈 만들기 추가
        this.registerEvent(
            this.app.workspace.on('editor-menu', (menu, editor, view) => {
                const selection = editor.getSelection();
                
                // Learning Planner는 퀴즈 모달 방식이므로 컨텍스트 메뉴 불필요
            })
        );
        
        console.log('Learning Strategy Planner plugin loaded');
    }

    // 계속 Part 4에서...
    
    // =====================================================
    // Part 3.5: 퀴즈 파일 관리 메서드 (quiz-sp2 통합)
    // =====================================================

    // 마크다운 파일에서 문제 파싱
    parseQuestionFile(content, filePath) {
        try {
            const question = {
                hanzi: '',
                number: '',
                folder: '',
                question: '',
                options: [],
                optionImages: [],
                answer: 0,
                hint: '',
                note: '',
                difficulty: '보통',
                keywords: [],
                image: '',
                hintImage: '',
                noteImage: '',
                wrongCount: 0,
                correctCount: 0,
                bookmarked: false,
                filePath: filePath
            };

            const lines = content.split('\n');
            let section = '';

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith('#')) {
                    if (trimmed === '## 한자') section = 'hanzi';
                    else if (trimmed === '## 번호') section = 'number';
                    else if (trimmed === '## 폴더') section = 'folder';
                    else if (trimmed === '## 문제') section = 'question';
                    else if (trimmed === '## 선택지') section = 'options';
                    else if (trimmed === '## 선택지 이미지') section = 'optionImages';
                    else if (trimmed === '## 정답') section = 'answer';
                    else if (trimmed === '## 힌트') section = 'hint';
                    else if (trimmed === '## 노트') section = 'note';
                    else if (trimmed === '## 난이도') section = 'difficulty';
                    else if (trimmed === '## 키워드') section = 'keywords';
                    else if (trimmed === '## 이미지') section = 'image';
                    else if (trimmed === '## 힌트 이미지') section = 'hintImage';
                    else if (trimmed === '## 노트 이미지') section = 'noteImage';
                    else if (trimmed === '## 통계') section = 'stats';
                    continue;
                }

                if (section === 'hanzi') question.hanzi = trimmed;
                else if (section === 'number') question.number = trimmed;
                else if (section === 'folder') question.folder = trimmed;
                else if (section === 'question') {
                    question.question = question.question ? question.question + '\n' + trimmed : trimmed;
                }
                else if (section === 'options' && trimmed.startsWith('-')) {
                    question.options.push(trimmed.substring(1).trim());
                }
                else if (section === 'optionImages') {
                    if (trimmed.startsWith('-')) {
                        const imgContent = trimmed.substring(1).trim();
                        question.optionImages.push(imgContent);
                    } else if (trimmed.startsWith('![[') || trimmed.startsWith('http')) {
                        // 이미지 링크를 마지막 선택지 이미지에 추가
                        if (question.optionImages.length > 0) {
                            const lastIndex = question.optionImages.length - 1;
                            const current = question.optionImages[lastIndex];
                            question.optionImages[lastIndex] = current ? current + '\n' + trimmed : trimmed;
                        } else {
                            question.optionImages.push(trimmed);
                        }
                    }
                }
                else if (section === 'answer') question.answer = parseInt(trimmed) || 0;
                else if (section === 'hint') {
                    question.hint = question.hint ? question.hint + '\n' + trimmed : trimmed;
                }
                else if (section === 'note') {
                    question.note = question.note ? question.note + '\n' + trimmed : trimmed;
                }
                else if (section === 'difficulty') {
                    // 난이도 파싱: C, 쉬움, 보통, 어려움 등을 모두 인식
                    const diffMap = {
                        'A': '쉬움', '쉬움': '쉬움', 'easy': '쉬움',
                        'B': '보통', '보통': '보통', 'medium': '보통', 'C': '보통',
                        'D': '어려움', '어려움': '어려움', 'hard': '어려움'
                    };
                    question.difficulty = diffMap[trimmed] || trimmed || '보통';
                }
                else if (section === 'keywords' && trimmed.startsWith('-')) {
                    question.keywords.push(trimmed.substring(1).trim());
                }
                else if (section === 'image') {
                    question.image = question.image ? question.image + '\n' + trimmed : trimmed;
                }
                else if (section === 'hintImage') {
                    question.hintImage = question.hintImage ? question.hintImage + '\n' + trimmed : trimmed;
                }
                else if (section === 'noteImage') {
                    question.noteImage = question.noteImage ? question.noteImage + '\n' + trimmed : trimmed;
                }
                else if (section === 'stats') {
                    if (trimmed.includes('오답:')) {
                        const match = trimmed.match(/\d+/);
                        question.wrongCount = match ? parseInt(match[0]) : 0;
                    } else if (trimmed.includes('정답:')) {
                        const match = trimmed.match(/\d+/);
                        question.correctCount = match ? parseInt(match[0]) : 0;
                    } else if (trimmed.includes('북마크:')) {
                        question.bookmarked = trimmed.includes('✅');
                    }
                }
            }

            if (question.question && question.options && question.options.length > 0) {
                if (question.answer === undefined || question.answer < 0 || question.answer >= question.options.length) {
                    question.answer = 0;
                }
                return question;
            }
            return null;
        } catch (e) {
            console.error('문제 파싱 오류:', filePath, e);
            return null;
        }
    }

    // 문제를 마크다운 파일로 저장
    async saveQuestion(question, isNew = true) {
        const folder = question.folder || '기본';
        const folderPath = `${this.settings.clozeFolder}/${this.settings.questionSubFolder || 'Questions'}/${folder}`;
        
        // 번호가 없으면 자동 생성
        if (!question.number || question.number === '') {
            question.number = await this.getNextAvailableNumber(folder);
        }
        
        // 폴더 생성
        const folderExists = this.app.vault.getAbstractFileByPath(folderPath);
        if (!folderExists) {
            await this.app.vault.createFolder(folderPath);
        }
        
        const fileName = `${question.number}_${question.hanzi || 'Q' + question.number}.md`;
        const newFilePath = `${folderPath}/${fileName}`;
        const content = this.generateQuestionContent(question);
        
        // 기존 파일이 있고 경로가 다른 경우 (수정 시 제목/번호 변경)
        const oldFilePath = question.filePath;
        if (!isNew && oldFilePath && oldFilePath !== newFilePath) {
            const oldFile = this.app.vault.getAbstractFileByPath(oldFilePath);
            if (oldFile) {
                // 기존 파일 삭제
                await this.app.vault.delete(oldFile);
                console.log('🗑️ 기존 파일 삭제:', oldFilePath);
            }
        }
        
        // 파일 저장
        const file = this.app.vault.getAbstractFileByPath(newFilePath);
        if (file) {
            // 이미 존재하는 파일 수정
            await this.app.vault.modify(file, content);
            console.log('✏️ 파일 수정:', newFilePath);
        } else {
            // 새 파일 생성
            await this.app.vault.create(newFilePath, content);
            console.log('✨ 새 파일 생성:', newFilePath);
        }
        
        // filePath 업데이트
        question.filePath = newFilePath;
        
        new Notice(`✅ 문제 "${question.hanzi || question.question}" ${isNew ? '저장' : '수정'}됨`);
    }

    // 문제 내용 생성
    generateQuestionContent(question) {
        return `# ${question.hanzi || question.question}

## 한자
${question.hanzi || ''}

## 번호
${question.number || ''}

## 폴더
${question.folder || '기본'}

## 문제
${question.question || ''}

## 선택지
${question.options.map((opt) => `- ${opt}`).join('\n')}

## 선택지 이미지
${(question.optionImages || []).map((img) => `- ${img}`).join('\n')}

## 정답
${question.answer}

## 힌트
${question.hint || ''}

## 노트
${question.note || ''}

## 난이도
${question.difficulty || '보통'}

## 키워드
${(question.keywords || []).map((kw) => `- ${kw}`).join('\n')}

## 이미지
${question.image || ''}

## 힌트 이미지
${question.hintImage || ''}

## 노트 이미지
${question.noteImage || ''}

## 통계
- 오답: ${question.wrongCount || 0}회
- 정답: ${question.correctCount || 0}회
- 북마크: ${question.bookmarked ? '✅' : '❌'}
- 마지막 시도: ${question.lastAttempt || '없음'}

---
생성일: ${question.created || new Date().toLocaleDateString('ko-KR')}
수정일: ${new Date().toLocaleDateString('ko-KR')}
`;
    }

    // 다음 사용 가능한 번호 가져오기
    async getNextAvailableNumber(folder) {
        const allQuestions = await this.loadAllQuestions();
        const folderQuestions = allQuestions.filter(q => (q.folder || '기본') === folder);
        
        if (folderQuestions.length === 0) return '1';
        
        const numbers = folderQuestions.map(q => parseInt(q.number) || 0).filter(n => n > 0);
        const maxNumber = Math.max(...numbers, 0);
        
        return String(maxNumber + 1);
    }

    // 모든 문제 로드
    async loadAllQuestions() {
        const questionsPath = `${this.settings.clozeFolder}/${this.settings.questionSubFolder || 'Questions'}`;
        const questions = [];
        
        try {
            const folderExists = this.app.vault.getAbstractFileByPath(questionsPath);
            if (!folderExists) {
                return [];
            }
            
            const files = this.app.vault.getMarkdownFiles();
            const questionFiles = files.filter(f => 
                f.path.startsWith(questionsPath) && 
                f.name.includes('_') && 
                !f.name.includes('문제목록')
            );
            
            for (const file of questionFiles) {
                const content = await this.app.vault.read(file);
                const question = this.parseQuestionFile(content, file.path);
                if (question) {
                    questions.push(question);
                }
            }
        } catch (e) {
            console.error('문제 로드 오류:', e);
        }
        
        return questions;
    }

    // 문제 통계 업데이트
    async updateQuestionStats(question, isCorrect) {
        const file = this.app.vault.getAbstractFileByPath(question.filePath);
        if (!file) return;

        const content = await this.app.vault.read(file);
        const updatedQuestion = this.parseQuestionFile(content, question.filePath);
        
        if (updatedQuestion) {
            if (isCorrect) {
                updatedQuestion.correctCount = (updatedQuestion.correctCount || 0) + 1;
            } else {
                updatedQuestion.wrongCount = (updatedQuestion.wrongCount || 0) + 1;
            }
            updatedQuestion.lastAttempt = new Date().toLocaleString('ko-KR');
            
            await this.saveQuestion(updatedQuestion, false);
        }
    }

    // 북마크 토글
    async toggleBookmark(question) {
        const file = this.app.vault.getAbstractFileByPath(question.filePath);
        if (!file) return false;

        const content = await this.app.vault.read(file);
        const updatedQuestion = this.parseQuestionFile(content, question.filePath);
        
        if (updatedQuestion) {
            updatedQuestion.bookmarked = !updatedQuestion.bookmarked;
            await this.saveQuestion(updatedQuestion, false);
            new Notice(updatedQuestion.bookmarked ? '⭐ 북마크 추가' : '북마크 제거');
            return updatedQuestion.bookmarked;
        }
        
        return false;
    }
    
    // =====================================================
    // Part 4: 기존 메서드들 + 타이머/대시보드 통합
    // =====================================================

    // 리본 메뉴 표시
    showRibbonMenu(evt) {
        const menu = new Menu();
        
        // 현재 선택된 텍스트 확인
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        const hasSelection = view?.editor?.somethingSelected();

        menu.addItem((item) =>
            item
                .setTitle(hasSelection ? '📝 선택한 텍스트를 문제로' : '📝 텍스트를 선택해주세요')
                .setIcon('highlighter')
                .setDisabled(!hasSelection)
                .onClick(() => {
                    if (view && hasSelection) {
                        this.createClozeFromSelection(view.editor);
                        new Notice('✅ 문제가 추가되었습니다!');
                    }
                })
        );

        menu.addItem((item) =>
            item
                .setTitle('🧹 선택한 문제 해제')
                .setIcon('eraser')
                .setDisabled(!hasSelection)
                .onClick(() => {
                    if (view && hasSelection) {
                        this.removeClozeFromSelection(view.editor);
                        new Notice('✅ 문제가 해제되었습니다!');
                    }
                })
        );

        menu.addItem((item) =>
            item
                .setTitle('📄 새 퀴즈 만들기')
                .setIcon('file-plus')
                .onClick(() => {
                    this.createClozeNote();
                })
        );

        menu.addItem((item) =>
            item
                .setTitle('📁 새 주제 폴더 만들기')
                .setIcon('folder-plus')
                .onClick(() => {
                    this.createClozeSubfolder();
                })
        );

        menu.addSeparator();

        // 폴더 관리 메뉴 추가
        menu.addItem((item) =>
            item
                .setTitle('📂 퀴즈 관리')
                .setIcon('folder-open')
                .onClick(() => {
                    new FolderManagementModal(this.app, this).open();
                })
        );

        menu.addItem((item) =>
            item
                .setTitle('📜 학습 기록')
                .setIcon('history')
                .onClick(() => {
                    new StudyHistoryModal(this.app, this).open();
                })
        );

        menu.addSeparator();

        menu.addItem((item) =>
            item
                .setTitle(`현재 카드: ${this.settings.currentCardNumber}`)
                .setIcon('credit-card')
                .setDisabled(true)
        );

        menu.addItem((item) =>
            item
                .setTitle('◀️ 이전 카드')
                .setIcon('arrow-left')
                .onClick(() => {
                    this.previousCard();
                })
        );

        menu.addItem((item) =>
            item
                .setTitle('▶️ 다음 카드')
                .setIcon('arrow-right')
                .onClick(() => {
                    this.nextCard();
                })
        );

        menu.addSeparator();

        menu.addItem((item) =>
            item
                .setTitle('👁️ 다음 답 보기 (Cmd+J)')
                .setIcon('eye')
                .onClick(() => {
                    this.revealNextClozeInActiveView('genuine');
                })
        );

        menu.addItem((item) =>
            item
                .setTitle('👁️ 모든 답 보기')
                .setIcon('eye-off')
                .onClick(() => {
                    this.toggleAllClozesInActiveView('genuine');
                })
        );

        menu.addSeparator();

        // 타이머 전체 설정 메뉴 추가
        menu.addItem((item) =>
            item
                .setTitle('⏱️ 타이머 전체 설정')
                .setIcon('settings')
                .onClick(() => {
                    new TimerGlobalSettingModal(this.app, this).open();
                })
        );

        menu.addItem((item) =>
            item
                .setTitle(`⏱️ 타이머: ${this.settings.enableTimer ? 'ON' : 'OFF'}`)
                .setIcon('clock')
                .onClick(() => {
                    this.settings.enableTimer = !this.settings.enableTimer;
                    this.saveSettings();
                    new Notice(`타이머: ${this.settings.enableTimer ? 'ON' : 'OFF'}`);
                    this.refreshAllClozes();
                })
        );

        // 타이머 시간 설정 메뉴 추가
        const currentDuration = this.getTimerDuration();
        menu.addItem((item) =>
            item
                .setTitle(`⏲️ 타이머 시간: ${currentDuration}초`)
                .setIcon('timer')
                .onClick(() => {
                    const modal = new TimerSettingModal(this.app, this, currentDuration);
                    modal.open();
                })
        );

        menu.addSeparator();

        // 설정 메뉴 추가
        menu.addItem((item) =>
            item
                .setTitle('⚙️ 플러그인 설정')
                .setIcon('settings')
                .onClick(() => {
                    this.app.setting.open();
                    this.app.setting.openTabById('enhanced-cloze');
                })
        );

        menu.showAtMouseEvent(evt);
    }

    // 선택한 텍스트로 퀴즈 생성
    createClozeFromSelection(editor) {
        const selection = editor.getSelection();
        if (!selection) {
            new Notice('텍스트를 먼저 선택해주세요');
            return;
        }

        const modal = new ClozeCreationModal(this.app, selection, (clozeNumber, hint) => {
            const clozeText = hint ? 
                `{{c${clozeNumber}::${selection}::${hint}}}` : 
                `{{c${clozeNumber}::${selection}}}`;
            editor.replaceSelection(clozeText);
            new Notice(`퀴즈 ${clozeNumber} 생성 완료!`);
        });
        modal.open();
    }

    // =====================================================
    // Enhanced Cloze 관련 함수 제거됨 - Learning Planner는 퀴즈 모달 방식
    // =====================================================

    async createDashboard() {
        const selection = editor.getSelection();
        if (!selection) {
            new Notice('텍스트를 먼저 선택해주세요');
            return;
        }

        // 빈칸 패턴: {{c숫자::내용}} 또는 {{c숫자::내용::힌트}}
        const clozeRegex = /\{\{c(\d+)::([^:}]+)(?:::([^}]+))?\}\}/g;
        
        // 선택 영역에 빈칸이 있는지 확인
        const matches = [];
        let match;
        while ((match = clozeRegex.exec(selection)) !== null) {
            matches.push({
                fullMatch: match[0],
                clozeNumber: match[1],
                answer: match[2],
                hint: match[3] || '',
                index: match.index
            });
        }

        if (matches.length === 0) {
            new Notice('선택 영역에 문제가 없습니다');
            return;
        }

        // 모든 빈칸을 내용으로 교체
        let result = selection;
        // 뒤에서부터 교체해야 인덱스가 안 꼬임
        for (let i = matches.length - 1; i >= 0; i--) {
            const m = matches[i];
            result = result.substring(0, m.index) + m.answer + result.substring(m.index + m.fullMatch.length);
        }

        editor.replaceSelection(result);
        
        if (matches.length === 1) {
            new Notice(`문제가 해제되었습니다: ${matches[0].answer}`);
        } else {
            new Notice(`${matches.length}개의 문제가 해제되었습니다`);
        }
    }

    async createDashboard() {
        const selection = editor.getSelection();
        if (!selection) {
            new Notice('텍스트를 먼저 선택해주세요');
            return;
        }

        // 빈칸 패턴: {{c숫자::내용}} 또는 {{c숫자::내용::힌트}}
        const clozeRegex = /\{\{c(\d+)::([^:}]+)(?:::([^}]+))?\}\}/g;
        
        // 선택 영역에 빈칸이 있는지 확인
        const matches = [];
        let match;
        while ((match = clozeRegex.exec(selection)) !== null) {
            matches.push({
                fullMatch: match[0],
                clozeNumber: match[1],
                answer: match[2],
                hint: match[3] || '',
                index: match.index
            });
        }

        // 빈칸이 있으면 해제
        if (matches.length > 0) {
            let result = selection;
            // 뒤에서부터 교체해야 인덱스가 안 꼬임
            for (let i = matches.length - 1; i >= 0; i--) {
                const m = matches[i];
                result = result.substring(0, m.index) + m.answer + result.substring(m.index + m.fullMatch.length);
            }
            editor.replaceSelection(result);
            
            if (matches.length === 1) {
                new Notice(`✅ 문제 해제: ${matches[0].answer}`);
            } else {
                new Notice(`✅ ${matches.length}개의 문제 해제`);
            }
        } 
        // 퀴즈가 없으면 생성
        else {
            this.createClozeFromSelection(editor);
        }
    }

    // 클립보드의 이미지를 문제로 추가
    async pasteImageAsCloze(editor) {
        try {
            // 클립보드에서 이미지 가져오기
            const clipboardItems = await navigator.clipboard.read();
            
            let imageBlob = null;
            for (const clipboardItem of clipboardItems) {
                for (const type of clipboardItem.types) {
                    if (type.startsWith('image/')) {
                        imageBlob = await clipboardItem.getType(type);
                        break;
                    }
                }
                if (imageBlob) break;
            }

            if (!imageBlob) {
                new Notice('클립보드에 이미지가 없습니다');
                return;
            }

            // 정답 입력 받기
            const answerModal = new TextInputModal(
                this.app,
                '이미지 정답 입력',
                '정답을 입력하세요',
                '이미지 설명',
                async (answer) => {
                    if (!answer) {
                        new Notice('❌ 정답을 입력해주세요');
                        return;
                    }

                    // 힌트 입력 받기
                    const hintModal = new TextInputModal(
                        this.app,
                        '힌트 입력 (선택사항)',
                        '힌트를 입력하세요',
                        '',
                        async (hint) => {
                            try {
                                // 이미지 파일명 생성
                                const timestamp = new Date().getTime();
                                const extension = imageBlob.type.split('/')[1] || 'png';
                                const fileName = `cloze-image-${timestamp}.${extension}`;
                                
                                // 첨부파일 폴더 확인 및 생성
                                const attachmentFolder = this.settings.imageClozeFolder || `${this.settings.clozeFolder}/${this.settings.imageSubFolder}`;
                                const folderExists = await this.app.vault.adapter.exists(attachmentFolder);
                                if (!folderExists) {
                                    await this.app.vault.createFolder(attachmentFolder);
                                }

                                // 이미지 저장
                                const filePath = `${attachmentFolder}/${fileName}`;
                                const arrayBuffer = await imageBlob.arrayBuffer();
                                await this.app.vault.createBinary(filePath, arrayBuffer);

                                // 문제 마크다운 삽입
                                const imageWidth = this.settings.imageClozeWidth || 300;
                                const clozeText = hint ? `{{c1::${answer}::${hint}}}` : `{{c1::${answer}}}`;
                                const clozeMarkdown = `![[${fileName}|${imageWidth}]]${clozeText}`;
                                
                                editor.replaceSelection(clozeMarkdown);
                                
                                new Notice(`✅ 이미지 퀴즈 생성: ${fileName}`);
                            } catch (error) {
                                console.error('이미지 저장 오류:', error);
                                new Notice('❌ 이미지 저장 실패');
                            }
                        }
                    );
                    hintModal.open();
                }
            );
            answerModal.open();

        } catch (error) {
            console.error('이미지 퀴즈 생성 오류:', error);
            new Notice('❌ 클립보드 이미지 붙여넣기 실패');
        }
    }

    // 대시보드 뷰 열기 (새로 추가)
    async openClozeDashboardView() {
        const { workspace } = this.app;

        let leaf = null;
        const leaves = workspace.getLeavesOfType(DASHBOARD_VIEW_TYPE);

        if (leaves.length > 0) {
            leaf = leaves[0];
        } else {
            leaf = workspace.getRightLeaf(false);
            await leaf.setViewState({ 
                type: DASHBOARD_VIEW_TYPE, 
                active: true 
            });
        }

        workspace.revealLeaf(leaf);
    }

    // 대시보드 생성
    async createDashboard() {
        const dashboardPath = `Learning/${this.settings.dashboardFileName}`;
        const content = await this.generateDashboardContent();
        await this.app.vault.create(dashboardPath, content);
        new Notice('퀴즈 대시보드가 생성되었습니다');
    }

    // 대시보드 업데이트
    async updateDashboard() {
        const dashboardPath = `Learning/${this.settings.dashboardFileName}`;
        const content = await this.generateDashboardContent();
        const file = this.app.vault.getAbstractFileByPath(dashboardPath);
        if (file) {
            await this.app.vault.modify(file, content);
        }
    }

    // 대시보드 컨텐츠 생성 (기존 메서드)
    async generateDashboardContent() {
        const files = this.app.vault.getMarkdownFiles();
        const folderMap = {};
        
        for (const file of files) {
            if (file.path.startsWith('Learning') && 
                file.name !== this.settings.dashboardFileName) {
                const content = await this.app.vault.read(file);
                const clozeRegex = /\{\{c(\d+)::([^:}]+)(?:::([^}]+))?\}\}/g;
                const matches = Array.from(content.matchAll(clozeRegex));
                
                if (matches.length > 0) {
                    const clozesByCard = {};
                    let totalClozes = 0;
                    
                    matches.forEach(match => {
                        const cardNum = match[1];
                        if (!clozesByCard[cardNum]) {
                            clozesByCard[cardNum] = 0;
                        }
                        clozesByCard[cardNum]++;
                        totalClozes++;
                    });

                    const folderPath = file.path.substring(0, file.path.lastIndexOf('/'));
                    
                    if (!folderMap[folderPath]) {
                        folderMap[folderPath] = {
                            files: [],
                            totalClozes: 0,
                            totalCards: new Set()
                        };
                    }

                    folderMap[folderPath].files.push({
                        file,
                        totalClozes,
                        cardCount: Object.keys(clozesByCard).length,
                        clozesByCard,
                        lastModified: file.stat.mtime
                    });

                    folderMap[folderPath].totalClozes += totalClozes;
                    Object.keys(clozesByCard).forEach(card => {
                        folderMap[folderPath].totalCards.add(card);
                    });
                }
            }
        }

        let content = `# 📚 학습 플래너 대시보드\n\n`;
        content += `> 마지막 업데이트: ${new Date().toLocaleString('ko-KR')}\n\n`;
        
        let totalFiles = 0;
        let totalClozes = 0;
        const allCards = new Set();
        
        Object.values(folderMap).forEach(folder => {
            totalFiles += folder.files.length;
            totalClozes += folder.totalClozes;
            folder.totalCards.forEach(card => allCards.add(card));
        });

        content += `## 📊 전체 통계\n\n`;
        content += `| 항목 | 개수 |\n`;
        content += `|------|------|\n`;
        content += `| 📁 총 주제 폴더 | ${Object.keys(folderMap).length} |\n`;
        content += `| 📄 총 노트 수 | ${totalFiles} |\n`;
        content += `| 🎯 총 빈칸 수 | ${totalClozes} |\n`;
        content += `| 🎴 총 카드 번호 | ${allCards.size}개 사용 중 |\n\n`;

        content += `## 📍 폴더별 학습 진행\n\n`;
        content += `| 폴더 | 현재 카드 | 총 빈칸 | 총 카드 |\n`;
        content += `|------|-----------|---------|----------|\n`;
        
        Object.keys(folderMap).sort().forEach(folderPath => {
            const folderName = folderPath.split('/').pop() || '루트';
            const currentCard = this.settings.cardNumbersByFolder[folderPath] || 1;
            const folderData = folderMap[folderPath];
            content += `| ${folderName} | **Card ${currentCard}** | ${folderData.totalClozes} | ${folderData.totalCards.size} |\n`;
        });
        content += `\n`;

        if (Object.keys(folderMap).length === 0) {
            content += `## 📚 노트 목록\n\n`;
            content += `> 아직 퀴즈 문제가 없습니다.\n`;
            content += `> 리본 메뉴에서 "새 주제 폴더 만들기"로 시작하세요!\n\n`;
        } else {
            const sortedFolders = Object.keys(folderMap).sort();
            
            for (const folderPath of sortedFolders) {
                const folderData = folderMap[folderPath];
                const folderName = folderPath.split('/').pop() || '루트';
                const currentCard = this.settings.cardNumbersByFolder[folderPath] || 1;
                
                content += `## 📁 ${folderName}\n\n`;
                content += `**현재 카드: Card ${currentCard}** | `;
                content += `총 ${folderData.files.length}개 노트 | `;
                content += `${folderData.totalClozes}개 빈칸 | `;
                content += `${folderData.totalCards.size}개 카드\n\n`;

                folderData.files.sort((a, b) => b.lastModified - a.lastModified);

                for (const fileInfo of folderData.files) {
                    const fileName = fileInfo.file.basename;
                    
                    content += `### [[${fileName}]]\n\n`;
                    content += `- 📝 빈칸: **${fileInfo.totalClozes}개** | `;
                    content += `🎴 카드: **${fileInfo.cardCount}개** | `;
                    content += `📅 수정: ${new Date(fileInfo.lastModified).toLocaleDateString('ko-KR')}\n`;
                    
                    const cardNumbers = Object.keys(fileInfo.clozesByCard).sort((a, b) => parseInt(a) - parseInt(b));
                    content += `- 📊 분포: `;
                    content += cardNumbers.map(card => `c${card}(${fileInfo.clozesByCard[card]})`).join(', ');
                    content += `\n\n`;
                }
            }
        }

        content += `## ⚡ 빠른 작업\n\n`;
        content += `- 🔄 대시보드 새로고침: Cmd+P → "Open cloze dashboard"\n`;
        content += `- 📺 대시보드 뷰: Cmd+P → "Open Cloze Dashboard View"\n`;
        content += `- 📁 새 주제 폴더: Cmd+P → "Create cloze subfolder"\n`;
        content += `- ➕ 새 노트: Cmd+P → "Create new cloze note"\n`;
        content += `- ⬅️ 이전 카드: Cmd+← (현재 폴더 기준)\n`;
        content += `- ➡️ 다음 카드: Cmd+→ (현재 폴더 기준)\n`;
        content += `- 👁️ 답 보기: Cmd+J\n`;
        content += `- ⏱️ 타이머 토글: Cmd+P → "Toggle timer on/off"\n\n`;

        content += `## 💡 사용 팁\n\n`;
        content += `1. **주제별 폴더 관리**: 각 주제(과목, 카테고리)별로 폴더를 만들어 관리하세요\n`;
        content += `2. **독립적인 카드 진행**: 각 폴더마다 독립적으로 카드 번호가 관리됩니다\n`;
        content += `3. **퀴즈 만들기**: 텍스트 선택 → Cmd+P → "Create quiz from selection"\n`;
        content += `4. **빈칸 형식**: \`{{c1::답::힌트}}\` (힌트는 선택사항)\n`;
        content += `5. **학습 방법**: 한 폴더의 Card 1부터 시작해서 순차적으로 학습하세요\n`;
        content += `6. **타이머 활용**: 설정에서 타이머 시간을 조정하고 시간 제한 학습에 도전하세요\n\n`;

        content += `---\n\n`;
        content += `*이 대시보드는 자동으로 생성됩니다.*\n`;

        return content;
    }

    // 새 퀴즈 문제 생성
    async createClozeNote() {
        const modal = new ClozeNoteCreationModal(this.app, this, async (folderPath, fileName, template) => {
            const fileExists = await this.app.vault.adapter.exists(folderPath + '/' + fileName + '.md');
            
            if (fileExists) {
                new Notice('이미 같은 이름의 파일이 존재합니다');
                return;
            }

            const content = this.generateNoteTemplate(fileName, template);
            const file = await this.app.vault.create(folderPath + '/' + fileName + '.md', content);
            await this.app.workspace.getLeaf().openFile(file);
            new Notice(`${fileName} 노트가 생성되었습니다`);
        });
        modal.open();
    }

    // 특정 폴더에 새 노트 생성
    async createClozeNoteInFolder(folderPath) {
        const modal = new ClozeNoteCreationModal(this.app, this, async (selectedFolderPath, fileName, template) => {
            const targetFolder = selectedFolderPath || folderPath;
            const fileExists = await this.app.vault.adapter.exists(targetFolder + '/' + fileName + '.md');
            
            if (fileExists) {
                new Notice('이미 같은 이름의 파일이 존재합니다');
                return;
            }

            const content = this.generateNoteTemplate(fileName, template);
            const file = await this.app.vault.create(targetFolder + '/' + fileName + '.md', content);
            await this.app.workspace.getLeaf().openFile(file);
            new Notice(`${fileName} 노트가 생성되었습니다`);
        }, folderPath);
        modal.open();
    }

    // 새 주제 폴더 생성
    async createClozeSubfolder() {
        const modal = new ClozeSubfolderCreationModal(this.app, this, async (folderName) => {
            const folderPath = `Learning/${folderName}`;
            const folderExists = await this.app.vault.adapter.exists(folderPath);
            
            if (folderExists) {
                new Notice('이미 같은 이름의 폴더가 존재합니다');
                return;
            }

            await this.app.vault.createFolder(folderPath);
            
            this.settings.cardNumbersByFolder[folderPath] = 1;
            await this.saveSettings();
            
            new Notice(`${folderName} 폴더가 생성되었습니다`);
            
            const readmePath = `${folderPath}/README.md`;
            const readmeContent = `# ${folderName}\n\n> 생성일: ${new Date().toLocaleString('ko-KR')}\n\n## 설명\n\n이 폴더는 "${folderName}" 주제의 퀴즈를 담고 있습니다.\n\n## 현재 진행\n\n- 총 퀴즈: 0개\n- 학습 완료: 0개\n\n---\n\n*대시보드에서 "퀴즈 생성" 버튼으로 퀴즈를 추가하세요.*\n`;
            await this.app.vault.create(readmePath, readmeContent);
        });
        modal.open();
    }

    // 노트 템플릿 생성
    generateNoteTemplate(fileName, template) {
        let content = `# ${fileName}\n\n`;
        content += `> 생성일: ${new Date().toLocaleString('ko-KR')}\n\n`;
        
        if (template === 'basic') {
            content += `## 내용\n\n`;
            content += `여기에 내용을 작성하고, 퀴즈로 만들고 싶은 부분을 선택한 후\n`;
            content += `Cmd+P → "Create cloze from selection"을 실행하세요.\n\n`;
            content += `### 예시\n\n`;
            content += `한국의 수도는 {{c1::서울::도시 이름}}입니다.\n`;
            content += `지구의 위성은 {{c1::달}}입니다.\n\n`;
        } else if (template === 'vocabulary') {
            content += `## 단어 학습\n\n`;
            content += `| 단어 | 의미 | 예문 |\n`;
            content += `|------|------|------|\n`;
            content += `| {{c1::apple::과일}} | 사과 | I ate an apple. |\n`;
            content += `| {{c2::book::물건}} | 책 | Read a book. |\n\n`;
        } else if (template === 'qa') {
            content += `## Q&A 형식\n\n`;
            content += `**Q1. 질문을 입력하세요**\n`;
            content += `A: {{c1::답변을 입력하세요}}\n\n`;
            content += `**Q2. 다음 질문**\n`;
            content += `A: {{c2::다음 답변}}\n\n`;
        }

        content += `## 메모\n\n`;
        content += `- \n\n`;

        return content;
    }

    // 계속 Part 5에서...

    // =====================================================
    // Part 5: 타이머/통계 통합 메서드들
    // =====================================================

    // 타이머 초기화 (새로 추가)
    initializeTimer(container) {
        if (!this.settings.enableTimer) return null;
        
        // 이미 타이머가 있는 컨테이너는 밴과
        if (container.querySelector('.cloze-timer-container-local')) {
            console.log('⏰ 타이머가 이미 존재함 - 생성 밴과');
            return null;
        }

        const duration = this.getTimerDuration(); // 폴더별 타이머 시간 가져오기
        const timer = new ClozeTimer(this, container, duration);
        timer.create();
        
        if (!this.activeTimers) this.activeTimers = [];
        this.activeTimers.push(timer);
        
        return timer;
    }

    // 모든 타이머 정리 (새로 추가)
    cleanupTimers() {
        if (this.activeTimers) {
            this.activeTimers.forEach(timer => timer.destroy());
            this.activeTimers = [];
        }
    }

    // 학습 세션 기록 (비활성화)
    async recordStudySession(duration, completed = false, action = 'stop', context = null) {
        // 학습 기록 기능 비활성화
        return;
    }

    // 전역 통계 가져오기 (새로 추가)
    async getGlobalStatistics() {
        const files = this.app.vault.getMarkdownFiles();
        const clozeFiles = files.filter(f => 
            f.path.startsWith('Learning')
        );

        let totalClozes = 0;
        const folders = new Set();

        for (const file of clozeFiles) {
            const content = await this.app.vault.read(file);
            const clozeRegex = /\{\{c(\d+)::([^:}]+)(?:::([^}]+))?\}\}/g;
            const matches = content.match(clozeRegex);
            if (matches) {
                totalClozes += matches.length;
            }

            const folder = file.path.substring(0, file.path.lastIndexOf('/'));
            folders.add(folder);
        }

        const sessions = this.settings.studySessions || [];
        const completedSessions = sessions.filter(s => s.completed).length;
        const totalStudyTime = this.settings.totalStudyTime || 0;

        // 연속 학습일 계산
        const streakDays = this.calculateStreakDays(sessions);

        return {
            totalFolders: folders.size,
            totalNotes: clozeFiles.length,
            totalClozes,
            completedSessions,
            totalStudyTime,
            streakDays
        };
    }

    // 폴더별 통계 (새로 추가)
    async getFolderStatistics() {
        const files = this.app.vault.getMarkdownFiles();
        const folderStats = {};

        for (const file of files) {
            if (!file.path.startsWith('Learning')) continue;

            const folder = file.path.substring(0, file.path.lastIndexOf('/'));
            
            if (!folderStats[folder]) {
                folderStats[folder] = {
                    totalClozes: 0,
                    completedClozes: 0
                };
            }

            const content = await this.app.vault.read(file);
            const clozeRegex = /\{\{c(\d+)::([^:}]+)(?:::([^}]+))?\}\}/g;
            const matches = Array.from(content.matchAll(clozeRegex));
            
            folderStats[folder].totalClozes += matches.length;
            
            // 완료된 빈칸은 추후 구현 가능 (메타데이터 활용)
            folderStats[folder].completedClozes = 0;
        }

        return folderStats;
    }

    // 최근 학습 세션 (새로 추가)
    async getRecentStudySessions(limit = 10) {
        const sessions = this.settings.studySessions || [];
        return sessions.slice(-limit).reverse();
    }

    // 연속 학습일 계산 (새로 추가)
    calculateStreakDays(sessions) {
        if (!sessions || sessions.length === 0) return 0;

        const dates = sessions
            .map(s => new Date(s.timestamp).toDateString())
            .filter((v, i, a) => a.indexOf(v) === i)
            .sort()
            .reverse();

        let streak = 0;
        const today = new Date().toDateString();
        let currentDate = new Date();

        for (const dateStr of dates) {
            if (dateStr === currentDate.toDateString()) {
                streak++;
                currentDate.setDate(currentDate.getDate() - 1);
            } else {
                break;
            }
        }

        return streak;
    }

    // =====================================================
    // 기존 메서드들 계속
    // =====================================================

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
        if (!this.settings.cardNumbersByFolder) {
            this.settings.cardNumbersByFolder = {};
        }
        if (!this.settings.studySessions) {
            this.settings.studySessions = [];
        }
        if (!this.settings.totalStudyTime) {
            this.settings.totalStudyTime = 0;
        }
        if (!this.settings.clozeFolders) {
            this.settings.clozeFolders = ['기본', '중급', '고급'];
        }
    }

    async createDefaultFolders() {
        // 메인 퀴즈 폴더 생성 (HanziQuiz)
        const mainFolder = this.settings.clozeFolder;
        const mainExists = this.app.vault.getAbstractFileByPath(mainFolder);
        if (!mainExists) {
            try {
                await this.app.vault.createFolder(mainFolder);
                console.log('📁 메인 퀴즈 폴더 생성됨:', mainFolder);
            } catch (e) {
                console.log('Main quiz folder might already exist:', mainFolder);
            }
        }

        // Questions 폴더 생성 (문제 파일 저장용)
        const questionsFolder = `${mainFolder}/${this.settings.questionSubFolder || 'Questions'}`;
        if (!this.app.vault.getAbstractFileByPath(questionsFolder)) {
            try {
                await this.app.vault.createFolder(questionsFolder);
                console.log('📁 Questions 폴더 생성됨:', questionsFolder);
            } catch (e) {
                console.log('Questions folder might already exist');
            }
        }

        // 퀴즈 하위 폴더들 생성 (questionFolders 사용)
        const foldersToCreate = this.settings.questionFolders || ['기본', '중급', '고급', '특별'];
        
        for (const subfolder of foldersToCreate) {
            const folderPath = `${questionsFolder}/${subfolder}`;
            const exists = this.app.vault.getAbstractFileByPath(folderPath);
            if (!exists) {
                try {
                    await this.app.vault.createFolder(folderPath);
                    console.log('📁 퀴즈 하위 폴더 생성됨:', folderPath);
                } catch (e) {
                    console.log('Quiz subfolder might already exist:', folderPath);
                }
            }
        }
    }

    async saveSettings(skipRefresh = false) {
        await this.saveData(this.settings);
        // 무한 루프 방지: 타이머 관련 설정 저장 시에만 새로고침 건너뛰기
        if (!skipRefresh) {
            // 필요한 경우에만 새로고침 (예: UI 설정 변경)
            // 학습 기록 저장 시에는 새로고침하지 않음
        }
    }

    // ==================== 북마크 관리 메서드 ====================
    
    // 북마크 추가
    async addBookmark(filePath, cardNumber, note = '') {
        const bookmark = {
            filePath,
            cardNumber,
            timestamp: Date.now(),
            note
        };
        
        // 중복 체크
        const exists = this.settings.bookmarks.some(b => 
            b.filePath === filePath && b.cardNumber === cardNumber
        );
        
        if (!exists) {
            this.settings.bookmarks.push(bookmark);
            await this.saveSettings(true);
            new Notice('⭐ 북마크에 추가되었습니다');
            return true;
        }
        return false;
    }
    
    // 북마크 제거
    async removeBookmark(filePath, cardNumber) {
        this.settings.bookmarks = this.settings.bookmarks.filter(b => 
            !(b.filePath === filePath && b.cardNumber === cardNumber)
        );
        await this.saveSettings(true);
        new Notice('북마크에서 제거되었습니다');
    }
    
    // 북마크 확인
    isBookmarked(filePath, cardNumber) {
        return this.settings.bookmarks.some(b => 
            b.filePath === filePath && b.cardNumber === cardNumber
        );
    }
    
    // 북마크 목록 가져오기
    getBookmarks() {
        return this.settings.bookmarks.sort((a, b) => b.timestamp - a.timestamp);
    }
    
    // 북마크 내보내기
    async exportBookmarks() {
        try {
            const data = JSON.stringify(this.settings.bookmarks, null, 2);
            await navigator.clipboard.writeText(data);
            new Notice('✅ 북마크가 클립보드에 복사되었습니다');
        } catch (e) {
            new Notice('❌ 북마크 내보내기 실패');
            console.error(e);
        }
    }
    
    // 북마크 가져오기
    async importBookmarks(jsonData) {
        try {
            const imported = JSON.parse(jsonData);
            if (Array.isArray(imported)) {
                this.settings.bookmarks = [...this.settings.bookmarks, ...imported];
                await this.saveSettings(true);
                new Notice(`✅ ${imported.length}개의 북마크를 가져왔습니다`);
            } else {
                throw new Error('올바른 형식이 아닙니다');
            }
        } catch (e) {
            new Notice('❌ 북마크 가져오기 실패: ' + e.message);
            console.error(e);
        }
    }
    
    // 북마크 초기화
    async clearBookmarks() {
        if (confirm('모든 북마크를 삭제하시겠습니까?')) {
            this.settings.bookmarks = [];
            await this.saveSettings(true);
            new Notice('✅ 모든 북마크가 삭제되었습니다');
        }
    }

    // ==================== 기존 메서드 ====================

    getCurrentFolder() {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view || !view.file) return null;
        
        const filePath = view.file.path;
        const folderPath = filePath.substring(0, filePath.lastIndexOf('/'));
        return folderPath || '/';
    }

    // 폴더별 타이머 시간 가져오기 (새로 추가)
    getTimerDuration() {
        const folder = this.getCurrentFolder();
        if (folder && this.settings.timerDurationsByFolder[folder]) {
            return this.settings.timerDurationsByFolder[folder];
        }
        return this.settings.defaultTimerDuration;
    }

    // 폴더별 타이머 시간 설정 (새로 추가)
    async setTimerDuration(duration) {
        const folder = this.getCurrentFolder();
        if (folder) {
            this.settings.timerDurationsByFolder[folder] = duration;
        } else {
            this.settings.defaultTimerDuration = duration;
        }
        await this.saveSettings(true); // skipRefresh=true: 무한 루프 방지
    }

    getCurrentCardNumber() {
        const folder = this.getCurrentFolder();
        if (!folder) return this.settings.currentCardNumber;
        
        if (!this.settings.cardNumbersByFolder[folder]) {
            this.settings.cardNumbersByFolder[folder] = 1;
        }
        return this.settings.cardNumbersByFolder[folder];
    }

    async setCurrentCardNumber(cardNumber) {
        const folder = this.getCurrentFolder();
        if (folder) {
            this.settings.cardNumbersByFolder[folder] = cardNumber;
        } else {
            this.settings.currentCardNumber = cardNumber;
        }
        await this.saveSettings(true); // skipRefresh=true: 무한 루프 방지
    }

    addStyles() {
        const styleEl = document.createElement('style');
        styleEl.id = 'enhanced-cloze-styles';
        styleEl.textContent = `
            /* 기본 빈칸 스타일 */
            .enhanced-cloze-container { font-size: 1.1em; line-height: 1.65em; margin-top: 20px; margin-bottom: 20px; }
            .genuine-cloze, .pseudo-cloze { cursor: pointer; user-select: none; padding: 2px 6px; border-radius: 3px; transition: all 0.2s ease; display: inline-block; }
            .genuine-cloze[data-show-state="hint"] { border-bottom: 2px solid #FF8C00; background-color: #FF8C00; color: #000000; }
            .genuine-cloze[data-show-state="answer"] { background-color: transparent; ${this.settings.underlineRevealedGenuineClozes ? 'border-bottom: 1px solid #FF8C00; padding-bottom: 1px;' : ''} }
            .pseudo-cloze[data-show-state="hint"] { border-bottom: 2px solid #FF8C00; background-color: #FF8C00; color: #000000; }
            .pseudo-cloze[data-show-state="answer"] { background-color: transparent; ${this.settings.underlineRevealedPseudoClozes ? 'border-bottom: 1px solid #FF8C00; padding-bottom: 1px;' : ''} }
            .cloze-hint-text { color: rgba(0, 0, 0, 0.3); font-style: italic; font-size: 0.9em; }
            .theme-dark .cloze-hint-text { color: rgba(255, 255, 255, 0.4); }
            .theme-dark .genuine-cloze[data-show-state="hint"] { background-color: #FF8C00; color: #000000; border-bottom-color: #FF8C00; }
            .theme-dark .pseudo-cloze[data-show-state="hint"] { background-color: #FF8C00; color: #000000; border-bottom-color: #FF8C00; }
            
            /* 테두리 인디케이터 */
            .cloze-border-indicator { position: fixed; top: 0; height: 100%; width: 30px; z-index: 100; cursor: pointer; user-select: none; opacity: 0; transition: opacity 0.2s; }
            .cloze-border-indicator:hover { opacity: 0.1; background-color: #4285f4; }
            .cloze-border-left { left: 0; }
            .cloze-border-right { right: 0; }
            .cloze-no-more-indicator { position: fixed; left: 0; top: 0; height: 100%; width: 10px; background-color: #db4437; z-index: 100; display: none; animation: fadeInOut 1s; }
            @keyframes fadeInOut { 0%, 100% { opacity: 0; } 50% { opacity: 0.7; } }
            
            /* 카드 번호 인디케이터 */
            .cloze-card-number-indicator { position: fixed; top: 60px; right: 10px; background-color: #4285f4; color: white; padding: 5px 10px; border-radius: 5px; font-size: 0.9em; z-index: 1000; user-select: none; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15); }
            
            /* 애니메이션 */
            @keyframes clozeReveal { 0% { opacity: 0; transform: scale(0.95); } 100% { opacity: 1; transform: scale(1); } }
            .genuine-cloze[data-show-state="answer"], .pseudo-cloze[data-show-state="answer"] { animation: clozeReveal 0.3s ease-out; }

            /* 이미지 빈칸 스타일 */
            .image-cloze { 
                cursor: pointer !important;
                -webkit-tap-highlight-color: transparent !important;
                touch-action: manipulation !important;
            }
            .image-cloze img { 
                max-width: 100% !important; 
                height: auto !important; 
                display: block !important;
                border-radius: 8px !important;
                transition: all 0.3s ease !important;
                -webkit-user-select: none !important;
                user-select: none !important;
            }
            .quiz-note-content .image-cloze img {
                max-height: 400px !important;
            }
            
            /* 모바일 이미지 빈칸 대응 */
            @media (max-width: 600px) {
                .quiz-note-content .image-cloze img {
                    max-height: 300px !important;
                }
                .image-answer-text {
                    font-size: 0.9em !important;
                    padding: 4px 8px !important;
                }
                .cloze-hint-text {
                    font-size: 0.8em !important;
                }
            }

            /* ============================================
               타이머 스타일 (카드 내부)
               ============================================ */
            .cloze-timer-container-local {
                position: relative;
                width: 100%;
                margin-bottom: 15px;
                background: linear-gradient(135deg, #1e3a8a, #3b82f6);
                border-radius: 12px;
                overflow: hidden;
                border: 3px solid #2563eb;
                box-shadow: 0 6px 20px rgba(59, 130, 246, 0.4);
                padding: 16px;
            }

            .cloze-timer-container-local.cloze-timer-floating {
                position: fixed;
                top: 80px;
                right: 20px;
                z-index: 1000;
                width: 280px;
            }

            .cloze-timer-container-local.cloze-timer-bottom {
                margin-top: 15px;
                margin-bottom: 0;
            }

            .cloze-timer-progress-local {
                width: 100%;
                height: 8px;
                background: rgba(255, 255, 255, 0.2);
                border-radius: 4px;
                overflow: hidden;
                margin-bottom: 12px;
            }

            .cloze-timer-fill-local {
                width: 100%;
                height: 100%;
                background: linear-gradient(90deg, #10b981, #34d399);
                transition: width 0.1s linear;
                box-shadow: 0 0 10px rgba(16, 185, 129, 0.5);
            }

            .cloze-timer-text-local {
                text-align: center;
                font-size: 24px;
                font-weight: bold;
                color: white;
                margin-bottom: 12px;
                text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
                font-family: 'Arial Black', Arial, sans-serif;
            }

            .cloze-timer-controls-local {
                display: flex;
                justify-content: center;
                gap: 8px;
            }

            .cloze-timer-btn-local {
                background: rgba(255, 255, 255, 0.2);
                border: 2px solid rgba(255, 255, 255, 0.3);
                color: white;
                padding: 8px 16px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 16px;
                transition: all 0.2s;
                font-weight: bold;
            }

            .cloze-timer-btn-local:hover:not(:disabled) {
                background: rgba(255, 255, 255, 0.3);
                transform: translateY(-2px);
            }

            .cloze-timer-btn-local:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }

            /* 타이머 경고/만료 상태 */
            .cloze-timer-container-local.timer-warning {
                background: linear-gradient(135deg, #ea580c, #f97316);
                border-color: #fb923c;
                animation: timer-pulse-warning 1s infinite;
            }

            .cloze-timer-container-local.timer-warning .cloze-timer-fill-local {
                background: linear-gradient(90deg, #f59e0b, #fbbf24);
                box-shadow: 0 0 15px rgba(245, 158, 11, 0.8);
            }

            .cloze-timer-container-local.timer-expired {
                background: linear-gradient(135deg, #dc2626, #ef4444);
                border-color: #f87171;
                animation: timer-pulse-danger 0.5s infinite;
            }

            .cloze-timer-container-local.timer-expired .cloze-timer-fill-local {
                background: linear-gradient(90deg, #991b1b, #dc2626);
                width: 0 !important;
            }

            .cloze-timer-container-local.timer-expired .cloze-timer-text-local {
                font-size: 28px;
                animation: timer-text-pulse 0.5s infinite;
            }

            @keyframes timer-pulse-warning {
                0%, 100% { transform: scale(1); box-shadow: 0 6px 20px rgba(234, 88, 12, 0.4); }
                50% { transform: scale(1.02); box-shadow: 0 8px 25px rgba(234, 88, 12, 0.6); }
            }

            @keyframes timer-pulse-danger {
                0%, 100% { transform: scale(1); box-shadow: 0 6px 20px rgba(220, 38, 38, 0.6); }
                50% { transform: scale(1.03); box-shadow: 0 10px 30px rgba(220, 38, 38, 0.9); }
            }

            @keyframes timer-text-pulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.1); }
            }

            /* ============================================
               대시보드 스타일
               ============================================ */
            .cloze-dashboard-container {
                padding: 24px;
                background: var(--background-primary);
                height: 100%;
                overflow-y: auto;
                -webkit-overflow-scrolling: touch; /* iOS 부드러운 스크롤 */
            }

            .cloze-dashboard-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 32px;
                padding-bottom: 16px;
                border-bottom: 2px solid var(--background-modifier-border);
                flex-wrap: wrap;
                gap: 12px;
            }

            .cloze-dashboard-header h2 {
                margin: 0;
                color: var(--text-accent);
                font-size: clamp(1.3em, 4vw, 1.8em); /* 반응형 폰트 */
            }

            .cloze-dashboard-header-buttons {
                display: flex;
                gap: 8px;
                flex-wrap: wrap;
            }

            .cloze-dashboard-btn {
                background: var(--interactive-accent);
                color: var(--text-on-accent);
                border: none;
                padding: 8px 16px;
                border-radius: 6px;
                cursor: pointer;
                font-weight: 600;
                -webkit-tap-highlight-color: transparent;
                touch-action: manipulation;
                user-select: none;
                transition: all 0.2s;
            }

            .cloze-dashboard-btn:hover {
                background: var(--interactive-accent-hover);
                transform: translateY(-2px);
            }

            .cloze-dashboard-section {
                background: var(--background-secondary);
                border-radius: 12px;
                padding: 20px;
                margin-bottom: 24px;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            }

            .cloze-dashboard-section h3 {
                margin: 0 0 16px 0;
                color: var(--text-accent);
                font-size: clamp(1em, 3vw, 1.2em);
            }

            /* 통계 그리드 */
            .cloze-stats-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                gap: 16px;
            }

            .cloze-stat-card {
                background: var(--background-primary);
                border-radius: 8px;
                padding: 20px;
                text-align: center;
                border: 2px solid var(--background-modifier-border);
                transition: all 0.2s;
                touch-action: manipulation;
                -webkit-tap-highlight-color: transparent;
            }

            .cloze-stat-card:hover {
                border-color: var(--interactive-accent);
                transform: translateY(-4px);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            }

            .cloze-stat-number {
                font-size: 2.5em;
                font-weight: bold;
                color: var(--interactive-accent);
                margin-bottom: 8px;
            }

            .cloze-stat-label {
                font-size: 0.9em;
                color: var(--text-muted);
                font-weight: 500;
            }

            /* 폴더 테이블 */
            .cloze-folder-table {
                width: 100%;
                border-collapse: collapse;
            }

            .cloze-folder-table th {
                background: var(--background-primary);
                padding: 12px;
                text-align: left;
                font-weight: 600;
                border-bottom: 2px solid var(--background-modifier-border);
            }

            .cloze-folder-table td {
                padding: 12px;
                border-bottom: 1px solid var(--background-modifier-border);
            }

            .cloze-folder-table tr:hover {
                background: var(--background-primary-alt);
            }

            /* 진행바 */
            .cloze-progress-bar {
                position: relative;
                width: 100%;
                height: 24px;
                background: var(--background-primary);
                border-radius: 12px;
                overflow: hidden;
                border: 1px solid var(--background-modifier-border);
            }

            .cloze-progress-fill {
                height: 100%;
                background: linear-gradient(90deg, #10b981, #34d399);
                transition: width 0.3s ease;
            }

            .cloze-progress-bar span {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                font-size: 0.85em;
                font-weight: 600;
                color: var(--text-normal);
                text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
            }

            .cloze-dashboard-btn-small {
                background: var(--interactive-accent);
                color: var(--text-on-accent);
                border: none;
                padding: 4px 12px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 0.85em;
                font-weight: 600;
                transition: all 0.2s;
            }

            .cloze-dashboard-btn-small:hover {
                background: var(--interactive-accent-hover);
            }

            /* 학습 세션 목록 */
            .cloze-session-list {
                display: flex;
                flex-direction: column;
                gap: 12px;
                max-height: 400px;
                overflow-y: auto;
            }

            .cloze-session-item {
                display: flex;
                align-items: center;
                gap: 16px;
                padding: 12px;
                background: var(--background-primary);
                border-radius: 8px;
                border: 1px solid var(--background-modifier-border);
                transition: all 0.2s;
            }

            .cloze-session-item:hover {
                border-color: var(--interactive-accent);
                transform: translateX(4px);
            }

            .cloze-session-date {
                font-size: 0.9em;
                color: var(--text-muted);
                min-width: 120px;
            }

            .cloze-session-folder {
                font-weight: 600;
                color: var(--text-normal);
                flex: 1;
            }

            .cloze-session-card {
                font-size: 0.9em;
                color: var(--text-accent);
                font-weight: 600;
            }

            .cloze-session-duration {
                font-size: 0.9em;
                color: var(--text-muted);
            }

            .cloze-session-success {
                color: #10b981;
                font-weight: 600;
                font-size: 0.9em;
            }

            .cloze-session-timeout {
                color: #f59e0b;
                font-weight: 600;
                font-size: 0.9em;
            }

            .cloze-empty-message {
                text-align: center;
                padding: 40px;
                color: var(--text-muted);
                font-style: italic;
            }

            /* 빠른 작업 */
            .cloze-quick-actions {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 12px;
            }

            .cloze-action-btn {
                background: var(--interactive-accent);
                color: var(--text-on-accent);
                border: none;
                padding: 16px;
                border-radius: 8px;
                cursor: pointer;
                font-weight: 600;
                transition: all 0.2s;
                font-size: 1em;
            }

            .cloze-action-btn:hover {
                background: var(--interactive-accent-hover);
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            }

            .cloze-action-btn-warning {
                background: #dc2626;
            }

            .cloze-action-btn-warning:hover {
                background: #b91c1c;
            }

            /* 모바일 대응 */
            @media (max-width: 768px) {
                .cloze-dashboard-container {
                    padding: 16px;
                }

                .cloze-stats-grid {
                    grid-template-columns: repeat(2, 1fr);
                    gap: 12px;
                }

                .cloze-stat-number {
                    font-size: 2em;
                }

                .cloze-folder-table {
                    font-size: 0.9em;
                }

                .cloze-folder-table th,
                .cloze-folder-table td {
                    padding: 8px;
                }

                .cloze-session-item {
                    flex-direction: column;
                    align-items: flex-start;
                    gap: 8px;
                }

                .cloze-quick-actions {
                    grid-template-columns: 1fr;
                }

                .cloze-timer-container-local.cloze-timer-floating {
                    width: calc(100% - 40px);
                    right: 20px;
                    left: 20px;
                }
            }

            @media (max-width: 480px) {
                .cloze-stats-grid {
                    grid-template-columns: 1fr;
                }
                
                .cloze-dashboard-section h3 {
                    font-size: 1.2em;
                }
                
                .cloze-action-btn {
                    padding: 14px 12px !important;
                    font-size: 15px !important;
                    min-height: 52px;
                }
                
                .cloze-folder-grid {
                    grid-template-columns: 1fr !important;
                }
                
                .cloze-dashboard-header-buttons button {
                    padding: 10px 14px;
                    font-size: 14px;
                }
                
                /* 폴더 카드 버튼 모바일 조정 */
                .cloze-folder-card > div:last-of-type {
                    grid-template-columns: 1fr 1fr !important;
                    font-size: 0.85em;
                }
            }

            /* 폴더별 퀴즈 카드 스타일 */
            .cloze-folder-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
                gap: 16px;
                margin-top: 16px;
            }

            .cloze-folder-card {
                position: relative;
                padding: 16px;
                background: linear-gradient(135deg, #1e2330 0%, #242936 100%);
                border: 2px solid #3a4154;
                border-radius: 12px;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                overflow: hidden;
            }

            .cloze-folder-card:hover {
                transform: translateY(-4px) scale(1.02);
                border-color: #f59e0b;
                box-shadow: 0 12px 24px rgba(245, 158, 11, 0.2), 0 0 0 1px rgba(245, 158, 11, 0.1);
            }

            .cloze-folder-card h4 {
                margin: 0 0 4px 0;
                font-size: 16px;
                font-weight: 700;
                color: #fbbf24;
                text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
                letter-spacing: -0.3px;
            }

            .cloze-folder-card .note-count {
                font-size: 13px;
                color: #9ca3af;
                font-weight: 500;
            }

            .cloze-folder-card .stats-container {
                position: relative;
                z-index: 1;
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 8px;
                margin: 12px 0;
                padding: 12px;
                background: rgba(15, 17, 25, 0.6);
                border: 1px solid #2d3548;
                border-radius: 8px;
                backdrop-filter: blur(10px);
            }

            .cloze-folder-card .stat-item {
                text-align: center;
            }

            .cloze-folder-card .stat-icon {
                font-size: 16px;
                margin-bottom: 2px;
            }

            .cloze-folder-card .stat-value {
                font-size: 18px;
                font-weight: 800;
                margin-bottom: 2px;
            }

            .cloze-folder-card .stat-label {
                font-size: 10px;
                color: #6b7280;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }

            .cloze-folder-card button {
                position: relative;
                z-index: 1;
                padding: 10px 12px;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-weight: 700;
                font-size: 13px;
                transition: all 0.3s ease;
            }

            .cloze-folder-card .quiz-btn {
                background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%);
                color: #000;
                box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
                text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
            }

            .cloze-folder-card .quiz-btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 16px rgba(245, 158, 11, 0.4);
            }

            .cloze-folder-card .new-note-btn {
                background: linear-gradient(135deg, #4b5563 0%, #374151 100%);
                color: #f3f4f6;
                border: 1px solid #6b7280;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
            }

            .cloze-folder-card .new-note-btn:hover {
                transform: translateY(-2px);
                background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            }
            
            /* 안드로이드 모바일 최적화 */
            @media (max-width: 600px) and (pointer: coarse) {
                .cloze-dashboard-container {
                    padding: 12px;
                    font-size: 16px;
                }
                
                .cloze-action-btn {
                    min-height: 56px !important;
                    font-size: 16px !important;
                    padding: 16px 14px !important;
                    -webkit-tap-highlight-color: transparent;
                    touch-action: manipulation;
                }
                
                .cloze-folder-card {
                    padding: 16px !important;
                    margin-bottom: 12px;
                }
                
                .cloze-folder-card button {
                    min-height: 48px;
                    font-size: 15px;
                    padding: 12px 16px;
                    -webkit-tap-highlight-color: transparent;
                    touch-action: manipulation;
                }
                
                .cloze-dashboard-header-buttons button {
                    min-height: 44px;
                    min-width: 44px;
                    -webkit-tap-highlight-color: transparent;
                    touch-action: manipulation;
                }
                
                /* 터치 피드백 */
                .cloze-action-btn:active,
                .cloze-folder-card button:active,
                .cloze-dashboard-btn:active {
                    transform: scale(0.96);
                    opacity: 0.8;
                }
                
                /* 스크롤 개선 */
                .cloze-dashboard-container {
                    overflow-y: auto;
                    -webkit-overflow-scrolling: touch;
                }
                
                /* 탭 네비게이션 모바일 최적화 */
                .cloze-tab-nav {
                    display: flex;
                    gap: 6px;
                    overflow-x: auto;
                    -webkit-overflow-scrolling: touch;
                    padding-bottom: 4px;
                }
                
                .cloze-tab-btn {
                    min-height: 48px;
                    min-width: 100px;
                    flex-shrink: 0;
                    padding: 12px 16px;
                    font-size: 14px;
                    -webkit-tap-highlight-color: transparent;
                    touch-action: manipulation;
                }
                
                .cloze-tab-btn:active {
                    transform: scale(0.95);
                }
                
                /* 목표 요약 카드 모바일 최적화 */
                .cloze-goals-summary {
                    padding: 12px !important;
                }
                
                /* 폴더 카드 내부 버튼 그리드 */
                .cloze-folder-card > div:last-child {
                    display: grid !important;
                    grid-template-columns: repeat(3, 1fr) !important;
                    gap: 8px !important;
                }
                
                .cloze-folder-card > div:last-child button {
                    padding: 10px 8px !important;
                    font-size: 14px !important;
                }
                
                /* 날짜 네비게이션 */
                .cloze-date-nav button,
                .cloze-month-nav button {
                    min-height: 48px;
                    min-width: 48px;
                    font-size: 18px;
                    -webkit-tap-highlight-color: transparent;
                    touch-action: manipulation;
                }
                
                .cloze-date-nav button:active,
                .cloze-month-nav button:active {
                    transform: scale(0.9);
                }
                
                /* 체크리스트 항목 */
                .cloze-checklist-items input[type="checkbox"] {
                    min-width: 24px;
                    min-height: 24px;
                    -webkit-tap-highlight-color: transparent;
                }
                
                /* 모달 버튼 */
                .modal button {
                    min-height: 48px;
                    padding: 12px 20px;
                    font-size: 16px;
                    -webkit-tap-highlight-color: transparent;
                    touch-action: manipulation;
                }
                
                /* 텍스트 선택 활성화 (읽기용) */
                .cloze-note-item,
                .cloze-test-item-list > div {
                    user-select: text;
                    -webkit-user-select: text;
                }
                
                /* 세션 아이템 터치 개선 */
                .cloze-test-item-list > div {
                    padding: 14px !important;
                    margin-bottom: 10px;
                }
                
                .cloze-test-item-list button {
                    min-height: 48px;
                    font-size: 15px;
                    padding: 12px;
                }
            }

            /* 다크모드 지원 */
            .theme-dark .cloze-stat-card {
                background: #1a1a2e;
            }

            .theme-dark .cloze-session-item {
                background: #1a1a2e;
            }

            .theme-dark .cloze-folder-table th {
                background: #1a1a2e;
            }

            /* 이미지 빈칸 컨트롤 */
            .image-cloze-wrapper {
                position: relative;
                display: inline-block;
                vertical-align: top;
                margin: 10px;
                margin-bottom: 60px; /* 컨트롤 공간 확보 */
            }

            .image-cloze {
                position: relative;
                overflow: visible !important;
                max-width: 100%;
                transform-origin: center;
            }

            .image-cloze img {
                display: block;
                max-width: 100%;
                height: auto;
            }

            .image-zoom-controls {
                display: flex !important;
                pointer-events: auto !important;
            }

            .image-zoom-controls button {
                pointer-events: auto !important;
                -webkit-tap-highlight-color: transparent !important;
                touch-action: manipulation !important;
            }

            .image-zoom-controls button:hover {
                transform: scale(1.1) !important;
                box-shadow: 0 0 15px rgba(255, 255, 255, 0.5);
            }

            .image-zoom-controls button:active {
                transform: scale(0.95) !important;
            }

            /* 모바일 최적화 */
            @media (max-width: 768px) {
                .image-zoom-controls button {
                    width: 48px !important;
                    height: 48px !important;
                    font-size: 24px !important;
                }
                
                .image-zoom-controls {
                    padding: 10px 20px !important;
                    gap: 12px !important;
                }
                
                .image-cloze img {
                    max-width: 100%;
                    width: auto;
                }
            }

            /* 작은 화면에서 버튼 크기 더 증가 */
            @media (max-width: 480px) {
                .image-zoom-controls button {
                    width: 52px !important;
                    height: 52px !important;
                    font-size: 26px !important;
                }
                
                .image-zoom-controls {
                    padding: 12px 24px !important;
                    gap: 14px !important;
                }
            }
            
            /* ============================================
               북마크 스타일
               ============================================ */
            .quiz-bookmark-checkbox {
                position: absolute;
                top: 10px;
                right: 10px;
                z-index: 1000;
                background: rgba(255, 255, 255, 0.85);
                border: 2px solid #FF8C00;
                border-radius: 8px;
                padding: 6px 10px;
                display: flex;
                align-items: center;
                gap: 6px;
                cursor: pointer;
                user-select: none;
                transition: all 0.2s;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                -webkit-tap-highlight-color: transparent;
                touch-action: manipulation;
                font-size: 13px;
            }
            
            .theme-dark .quiz-bookmark-checkbox {
                background: rgba(30, 30, 30, 0.85);
                border-color: #FF8C00;
            }
            
            .quiz-bookmark-checkbox:hover {
                background: rgba(255, 255, 255, 0.95);
                transform: scale(1.05);
                box-shadow: 0 4px 12px rgba(255, 140, 0, 0.3);
            }
            
            .theme-dark .quiz-bookmark-checkbox:hover {
                background: rgba(30, 30, 30, 0.95);
            }
            
            .quiz-bookmark-checkbox input[type="checkbox"] {
                width: 18px;
                height: 18px;
                cursor: pointer;
                accent-color: #FF8C00;
            }
            
            .quiz-bookmark-checkbox label {
                cursor: pointer;
                font-weight: 600;
                color: #FF8C00;
                margin: 0;
                font-size: 13px;
            }
            
            .theme-dark .quiz-bookmark-checkbox label {
                color: #FFA500;
            }
            
            /* 북마크 모달 스타일 */
            .bookmark-modal {
                max-width: 600px;
                padding: 20px;
            }
            
            .bookmark-list {
                max-height: 400px;
                overflow-y: auto;
                margin-top: 15px;
            }
            
            .bookmark-item {
                background: var(--background-secondary);
                border-radius: 8px;
                padding: 12px 16px;
                margin-bottom: 10px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                transition: all 0.2s;
                border: 1px solid var(--background-modifier-border);
            }
            
            .bookmark-item:hover {
                border-color: #FF8C00;
                transform: translateX(4px);
            }
            
            .bookmark-info {
                flex: 1;
            }
            
            .bookmark-file {
                font-weight: 600;
                color: var(--text-normal);
                margin-bottom: 4px;
            }
            
            .bookmark-card {
                font-size: 0.9em;
                color: #FF8C00;
                font-weight: 600;
            }
            
            .bookmark-time {
                font-size: 0.85em;
                color: var(--text-muted);
                margin-top: 4px;
            }
            
            .bookmark-actions {
                display: flex;
                gap: 8px;
            }
            
            .bookmark-btn {
                padding: 6px 12px;
                border-radius: 4px;
                border: none;
                cursor: pointer;
                font-weight: 600;
                transition: all 0.2s;
                -webkit-tap-highlight-color: transparent;
                touch-action: manipulation;
            }
            
            .bookmark-btn-open {
                background: #FF8C00;
                color: white;
            }
            
            .bookmark-btn-open:hover {
                background: #FFA500;
                transform: scale(1.05);
            }
            
            .bookmark-btn-delete {
                background: var(--background-modifier-error);
                color: white;
            }
            
            .bookmark-btn-delete:hover {
                background: #dc2626;
                transform: scale(1.05);
            }
            
            .bookmark-empty {
                text-align: center;
                padding: 40px;
                color: var(--text-muted);
                font-style: italic;
            }
            
            /* 모바일 대응 */
            @media (max-width: 768px) {
                .quiz-bookmark-checkbox {
                    padding: 10px 14px;
                }
                
                .quiz-bookmark-checkbox input[type="checkbox"] {
                    width: 24px;
                    height: 24px;
                }
                
                .quiz-bookmark-checkbox label {
                    font-size: 16px;
                }
                
                .quiz-header-bookmark {
                    font-size: 16px !important;
                    right: 8px !important;
                }
                
                .quiz-header-bookmark input[type="checkbox"] {
                    width: 20px !important;
                    height: 20px !important;
                }
                
                .quiz-timer-bookmark-row {
                    padding: 0 8px !important;
                }
                
                .bookmark-item {
                    flex-direction: column;
                    align-items: flex-start;
                    gap: 10px;
                }
                
                .bookmark-actions {
                    width: 100%;
                }
                
                .bookmark-btn {
                    flex: 1;
                    min-height: 44px;
                }
            }
            
            /* 테스트 관리 탭 스타일 */
            .cloze-tab-nav {
                display: flex;
                gap: 8px;
                margin: 16px 0;
                flex-wrap: wrap;
            }
            
            .cloze-tab-btn {
                background: var(--background-secondary);
                color: var(--text-normal);
                border: 1px solid var(--background-modifier-border);
                padding: 8px 16px;
                border-radius: 6px;
                cursor: pointer;
                font-weight: 500;
                transition: all 0.2s;
            }
            
            .cloze-tab-btn:hover {
                background: var(--background-modifier-hover);
                border-color: var(--interactive-accent);
            }
            
            .cloze-tab-btn.active {
                background: var(--interactive-accent);
                color: var(--text-on-accent);
                border-color: var(--interactive-accent);
            }
            
            .cloze-date-nav, .cloze-month-nav {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 16px;
                padding: 12px;
                background: var(--background-secondary);
                border-radius: 8px;
            }
            
            .cloze-date-btn, .cloze-month-btn, .cloze-today-btn {
                padding: 8px 16px;
                background: var(--interactive-accent);
                color: var(--text-on-accent);
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-weight: bold;
                transition: opacity 0.2s;
            }
            
            .cloze-date-btn:hover, .cloze-month-btn:hover, .cloze-today-btn:hover {
                opacity: 0.8;
            }
            
            .cloze-date-title, .cloze-month-title {
                font-size: 1.4rem;
                font-weight: bold;
                color: var(--text-normal);
            }
            
            .cloze-calendar-grid {
                display: grid;
                grid-template-columns: repeat(7, 1fr);
                gap: 8px;
            }
            
            .cloze-week-header {
                display: grid;
                grid-template-columns: repeat(7, 1fr);
                gap: 8px;
                margin-bottom: 8px;
            }
            
            .cloze-week-day {
                text-align: center;
                font-weight: bold;
                color: var(--text-muted);
                padding: 8px;
            }
            
            .cloze-calendar-day {
                aspect-ratio: 1;
                background: var(--background-secondary);
                border-radius: 8px;
                padding: 8px;
                cursor: pointer;
                transition: all 0.2s;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                border: 1px solid var(--background-modifier-border);
                -webkit-tap-highlight-color: transparent;
                touch-action: manipulation;
                user-select: none;
            }
            
            .cloze-calendar-day:hover {
                transform: scale(1.05);
                border-color: var(--interactive-accent);
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            }
            
            .cloze-calendar-day:active {
                transform: scale(0.98);
            }
            
            .cloze-calendar-day.empty {
                background: transparent;
                cursor: default;
            }
            
            .cloze-calendar-day.today {
                border: 2px solid var(--interactive-accent);
            }
            
            .cloze-calendar-day.completed {
                background: #065f46;
            }
            
            .cloze-calendar-day.in-progress {
                background: #1e3a8a;
            }
            
            .cloze-day-num {
                font-weight: bold;
                font-size: 1.1rem;
            }
            
            .cloze-day-progress {
                font-size: 0.75rem;
                color: var(--text-accent);
                text-align: right;
            }
            
            .cloze-template-section, .cloze-test-items-section, .cloze-test-notes-section {
                margin-bottom: 24px;
            }
            
            .cloze-template-list {
                display: flex;
                gap: 8px;
                flex-wrap: wrap;
                margin-bottom: 16px;
            }
            
            .cloze-template-btn {
                padding: 8px 16px;
                background: var(--background-primary);
                border: 1px solid var(--background-modifier-border);
                border-radius: 6px;
                cursor: pointer;
                transition: all 0.2s;
            }
            
            .cloze-template-btn:hover {
                background: var(--interactive-accent);
                color: var(--text-on-accent);
                border-color: var(--interactive-accent);
            }
            
            .cloze-test-item-list, .cloze-note-list {
                display: flex;
                flex-direction: column;
                gap: 8px;
                margin-bottom: 16px;
            }
            
            .cloze-test-item {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 12px;
                background: var(--background-primary);
                border-radius: 6px;
                border: 1px solid var(--background-modifier-border);
            }
            
            .cloze-test-item input[type="checkbox"] {
                width: 20px;
                height: 20px;
                cursor: pointer;
            }
            
            .cloze-test-item-text {
                flex: 1;
                color: var(--text-normal);
            }
            
            .cloze-test-item-text.checked {
                text-decoration: line-through;
                opacity: 0.6;
            }
            
            .cloze-delete-btn {
                padding: 4px 10px;
                background: #ef4444;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-weight: bold;
            }
            
            .cloze-delete-btn:hover {
                background: #dc2626;
            }
            
            .cloze-note-item {
                padding: 12px;
                background: var(--background-primary);
                border-radius: 6px;
                border: 1px solid var(--background-modifier-border);
                position: relative;
            }
            
            .cloze-delete-btn-inline {
                position: absolute;
                top: 8px;
                right: 8px;
                padding: 2px 8px;
                background: #ef4444;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-weight: bold;
                font-size: 0.85em;
            }
            
            .cloze-add-btn {
                width: 100%;
                padding: 10px;
                background: var(--interactive-accent);
                color: var(--text-on-accent);
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-weight: bold;
                transition: opacity 0.2s;
            }
            
            .cloze-add-btn:hover {
                opacity: 0.8;
            }
            
            /* 폴더 선택 리스트 */
            .cloze-folder-list {
                display: flex;
                flex-direction: column;
                gap: 8px;
                margin: 16px 0;
            }
            
            /* 모바일 최적화 */
            @media (max-width: 768px) {
                .cloze-tab-nav {
                    gap: 6px;
                    margin: 12px 0;
                }
                
                .cloze-tab-btn {
                    padding: 10px 14px;
                    font-size: 0.9rem;
                    min-height: 44px;
                    touch-action: manipulation;
                }
                
                .cloze-date-nav, .cloze-month-nav {
                    padding: 10px;
                    margin-bottom: 12px;
                }
                
                .cloze-date-btn, .cloze-month-btn, .cloze-today-btn {
                    padding: 10px 14px;
                    min-height: 44px;
                    font-size: 0.9rem;
                    touch-action: manipulation;
                }
                
                .cloze-date-title, .cloze-month-title {
                    font-size: 1.2rem;
                }
                
                .cloze-calendar-grid {
                    gap: 4px;
                }
                
                .cloze-calendar-day {
                    padding: 6px;
                    min-height: 60px;
                    touch-action: manipulation;
                }
                
                .cloze-day-num {
                    font-size: 1rem;
                }
                
                .cloze-day-progress {
                    font-size: 0.7rem;
                }
                
                .cloze-template-btn {
                    padding: 10px 14px;
                    min-height: 44px;
                    font-size: 0.9rem;
                    touch-action: manipulation;
                }
                
                .cloze-test-item {
                    padding: 14px;
                    gap: 12px;
                }
                
                .cloze-test-item input[type="checkbox"] {
                    width: 24px;
                    height: 24px;
                    touch-action: manipulation;
                }
                
                .cloze-test-item-text {
                    font-size: 0.95rem;
                    line-height: 1.5;
                }
                
                .cloze-delete-btn {
                    padding: 8px 12px;
                    min-height: 40px;
                    touch-action: manipulation;
                }
                
                .cloze-note-item {
                    padding: 14px;
                    padding-right: 60px;
                }
                
                .cloze-delete-btn-inline {
                    padding: 6px 10px;
                    min-height: 36px;
                    touch-action: manipulation;
                }
                
                .cloze-add-btn {
                    padding: 14px;
                    min-height: 48px;
                    font-size: 1rem;
                    touch-action: manipulation;
                }
                
                .cloze-template-section, 
                .cloze-test-items-section, 
                .cloze-test-notes-section {
                    margin-bottom: 20px;
                }
                
                .cloze-folder-list button {
                    min-height: 48px;
                    font-size: 1rem;
                    padding: 12px;
                }
            }
        `;
        document.head.appendChild(styleEl);
    }

    createLivePreviewExtension() {
        const plugin = this;
        
        // 이미지 빈칸 위젯 클래스
        class ImageClozeWidget extends WidgetType {
            constructor(clozeId, answer, hint, imagePath) {
                super();
                this.clozeId = clozeId;
                this.answer = answer;
                this.hint = hint;
                this.imagePath = imagePath;
                this.isRevealed = false;
            }
            
            toDOM(view) {
                const wrapper = document.createElement('span');
                wrapper.className = 'image-cloze-wrapper cm-image-cloze';
                wrapper.style.display = 'inline-block';
                wrapper.style.position = 'relative';
                wrapper.style.verticalAlign = 'top';
                wrapper.style.margin = '4px';
                
                // 이미지 찾기
                const files = plugin.app.vault.getFiles();
                let imageFile = files.find(f => f.path === this.imagePath) ||
                               files.find(f => f.name === this.imagePath.split('/').pop()) ||
                               files.find(f => f.path.includes(this.imagePath.split('/').pop()));
                
                if (imageFile) {
                    const img = document.createElement('img');
                    img.src = plugin.app.vault.getResourcePath(imageFile);
                    img.style.maxWidth = '300px';
                    img.style.height = 'auto';
                    img.style.display = this.isRevealed ? 'block' : 'none';
                    wrapper.appendChild(img);
                    
                    // 빈칸 span
                    const clozeSpan = document.createElement('span');
                    clozeSpan.className = 'image-cloze';
                    clozeSpan.style.cursor = 'pointer';
                    clozeSpan.style.background = this.isRevealed ? 'transparent' : '#FF8C00';
                    clozeSpan.style.color = this.isRevealed ? 'transparent' : '#000000';
                    clozeSpan.style.padding = this.isRevealed ? '0' : '8px 12px';
                    clozeSpan.style.borderRadius = '4px';
                    clozeSpan.style.display = this.isRevealed ? 'none' : 'inline-block';
                    clozeSpan.style.minWidth = '100px';
                    clozeSpan.style.textAlign = 'center';
                    clozeSpan.textContent = this.isRevealed ? '' : (this.hint ? `[${this.hint}]` : '[이미지]');
                    
                    // 토글 이벤트
                    const toggle = () => {
                        this.isRevealed = !this.isRevealed;
                        img.style.display = this.isRevealed ? 'block' : 'none';
                        clozeSpan.style.display = this.isRevealed ? 'none' : 'inline-block';
                        clozeSpan.style.background = this.isRevealed ? 'transparent' : '#FFD700';
                        clozeSpan.textContent = this.isRevealed ? '' : (this.hint ? `[${this.hint}]` : '[이미지]');
                    };
                    
                    clozeSpan.addEventListener('click', toggle);
                    wrapper.appendChild(clozeSpan);
                } else {
                    // 이미지 없으면 경고 표시
                    wrapper.textContent = `[이미지 없음: ${this.imagePath}]`;
                    wrapper.style.color = 'red';
                }
                
                return wrapper;
            }
        }
        
        // ViewPlugin 생성
        const imageClozePlugin = ViewPlugin.fromClass(class {
            constructor(view) {
                this.decorations = this.buildDecorations(view);
            }
            
            update(update) {
                if (update.docChanged || update.viewportChanged) {
                    this.decorations = this.buildDecorations(update.view);
                }
            }
            
            buildDecorations(view) {
                const widgets = [];
                const doc = view.state.doc;
                
                // ![[image.png]]{{c1::answer::hint}} 패턴 찾기
                const imageClozePatt = /!\[\[(.+?)\]\]\{\{c(\d+)::([^}]+?)(?:::([^}]+))?\}\}/g;
                
                for (let i = 1; i <= doc.lines; i++) {
                    const line = doc.line(i);
                    const text = line.text;
                    let match;
                    
                    while ((match = imageClozePatt.exec(text)) !== null) {
                        const [fullMatch, imagePath, clozeId, answer, hint] = match;
                        const from = line.from + match.index;
                        const to = from + fullMatch.length;
                        
                        const widget = new ImageClozeWidget(clozeId, answer, hint, imagePath);
                        const deco = Decoration.replace({
                            widget: widget,
                            inclusive: false,
                            block: false
                        });
                        
                        widgets.push(deco.range(from, to));
                    }
                }
                
                return Decoration.set(widgets, true);
            }
        }, {
            decorations: v => v.decorations
        });
        
        return imageClozePlugin;
    }

    processImageClozes(element) {
        const clozeRegex = /\{\{c(\d+)::([^}]+?)(?:::([^}]+))?\}\}/g;
        
        // 모든 img 태그를 찾기
        const images = Array.from(element.querySelectorAll('img'));
        
        images.forEach(img => {
            // 이미 처리된 이미지는 건너뛰기
            if (img.closest('.image-cloze-wrapper')) {
                return;
            }
            
            // 이미지 다음 노드 확인
            let nextNode = img.nextSibling;
            
            // 공백 노드 건너뛰기
            while (nextNode && nextNode.nodeType === Node.TEXT_NODE && !nextNode.textContent.trim()) {
                nextNode = nextNode.nextSibling;
            }
            
            // 텍스트 노드에서 빈칸 패턴 찾기 (첫 번째 매치만 처리)
            if (nextNode && nextNode.nodeType === Node.TEXT_NODE) {
                const text = nextNode.textContent;
                // 정규식 초기화 후 사용
                clozeRegex.lastIndex = 0;
                const matches = Array.from(text.matchAll(clozeRegex));
                
                // 첫 번째 매치만 처리 (이미지와 1:1 매칭)
                if (matches.length > 0) {
                    const match = matches[0];
                    const [fullMatch, clozeId, answer, hint] = match;
                    const clozeIdNum = parseInt(clozeId);
                    const currentCard = this.getCurrentCardNumber();
                    const isGenuine = clozeIdNum === currentCard;
                    
                    // wrapper 생성
                    const wrapper = document.createElement('span');
                    wrapper.className = 'image-cloze-wrapper';
                    wrapper.style.display = 'inline-block';
                    wrapper.style.position = 'relative';
                    wrapper.style.verticalAlign = 'top';
                    wrapper.style.marginRight = '10px';
                    wrapper.style.marginBottom = '10px';
                    
                    // 퀴즈 span 생성
                    const clozeSpan = document.createElement('span');
                    clozeSpan.className = isGenuine ? 'genuine-cloze image-cloze' : 'pseudo-cloze image-cloze';
                    clozeSpan.setAttribute('data-show-state', 'hint');
                    clozeSpan.setAttribute('data-cloze-id', clozeId);
                    clozeSpan.setAttribute('data-answer', answer.trim());
                    clozeSpan.setAttribute('data-hint', hint?.trim() || '');
                    clozeSpan.style.cursor = 'pointer';
                    
                    // 이미지를 wrapper로 이동
                    const imgClone = img.cloneNode(true);
                    wrapper.appendChild(imgClone);
                    wrapper.appendChild(clozeSpan);
                    
                    // 원본 이미지를 wrapper로 교체
                    img.parentNode?.replaceChild(wrapper, img);
                    
                    // 텍스트 노드에서 빈칸 패턴 제거 (첫 번째 매치만)
                    const remainingText = text.substring(0, match.index) + text.substring(match.index + fullMatch.length);
                    nextNode.textContent = remainingText;
                    
                    // 초기 상태 설정
                    this.updateImageClozeDisplay(clozeSpan, imgClone);
                    
                    // 클릭 이벤트
                    const toggleHandler = (e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        this.toggleImageCloze(clozeSpan, imgClone);
                    };
                    clozeSpan.addEventListener('click', toggleHandler);
                    clozeSpan.addEventListener('touchend', toggleHandler);
                    
                    // 자동 뒤집기 (genuine cloze만)
                    if (this.settings.enableAutoReveal && isGenuine) {
                        setTimeout(() => {
                            if (clozeSpan.getAttribute('data-show-state') === 'hint') {
                                clozeSpan.setAttribute('data-show-state', 'answer');
                                this.updateImageClozeDisplay(clozeSpan, imgClone);
                            }
                        }, this.settings.autoRevealDelay * 1000);
                    }
                }
            }
        });
    }

    // processClozes 함수 제거 - Learning Planner는 퀴즈 모달 방식
    processClozes(element, context) {
        // 기능 완전 비활성화 - 이 플러그인은 퀴즈 모달을 사용
        return;
    }

    // toggleCloze 함수 제거 - Learning Planner는 퀴즈 모달 방식
    toggleCloze(clozeSpan) {
        // 기능 완전 비활성화
        return;
    }

    // =====================================================
    // Part 6: 나머지 메서드들 & 모달 클래스들
    // =====================================================

    updateClozeDisplay(clozeSpan) {
        const showState = clozeSpan.getAttribute('data-show-state');
        const answer = clozeSpan.getAttribute('data-answer') || '';
        const hint = clozeSpan.getAttribute('data-hint') || '';
        const isGenuine = clozeSpan.classList.contains('genuine-cloze');

        if (showState === 'answer') {
            clozeSpan.textContent = answer;
        } else {
            const showHint = isGenuine || this.settings.showHintsForPseudoClozes;
            if (showHint && hint) {
                clozeSpan.innerHTML = `<span class="cloze-hint-text">[${hint}]</span>`;
            } else {
                clozeSpan.innerHTML = '<span class="cloze-hint-text">[...]</span>';
            }
        }
    }

    toggleCloze(clozeSpan) {
        const currentState = clozeSpan.getAttribute('data-show-state');
        const newState = currentState === 'hint' ? 'answer' : 'hint';
        clozeSpan.setAttribute('data-show-state', newState);
        this.updateClozeDisplay(clozeSpan);
        if (this.settings.scrollToClozeOnToggle) {
            this.scrollToCloze(clozeSpan);
        }
    }

    updateImageClozeDisplay(clozeSpan, imgElement) {
        const showState = clozeSpan.getAttribute('data-show-state');
        const answer = clozeSpan.getAttribute('data-answer') || '';
        const hint = clozeSpan.getAttribute('data-hint') || '';
        const isGenuine = clozeSpan.classList.contains('genuine-cloze');
        
        if (showState === 'answer') {
            // 정답 표시: 이미지 보이기 + 투명 배경
            imgElement.style.display = 'block';
            clozeSpan.style.background = 'transparent';
            clozeSpan.style.color = 'transparent';
            clozeSpan.style.position = 'absolute';
            clozeSpan.style.top = '0';
            clozeSpan.style.left = '0';
            clozeSpan.style.width = '100%';
            clozeSpan.style.height = '100%';
            clozeSpan.textContent = '';
        } else {
            // 힌트 표시: 이미지 숨기기 + 황금색 배경
            imgElement.style.display = 'none';
            clozeSpan.style.background = '#FF8C00';
            clozeSpan.style.color = '#000000';
            clozeSpan.style.position = 'static';
            clozeSpan.style.padding = '8px 12px';
            clozeSpan.style.borderRadius = '4px';
            clozeSpan.style.display = 'inline-block';
            clozeSpan.style.minWidth = '100px';
            clozeSpan.style.textAlign = 'center';
            
            const showHint = isGenuine || this.settings.showHintsForPseudoClozes;
            if (showHint && hint) {
                clozeSpan.textContent = `[${hint}]`;
            } else {
                clozeSpan.textContent = '[이미지]';
            }
        }
    }

    toggleImageCloze(clozeSpan, imgElement) {
        const currentState = clozeSpan.getAttribute('data-show-state');
        const newState = currentState === 'hint' ? 'answer' : 'hint';
        clozeSpan.setAttribute('data-show-state', newState);
        this.updateImageClozeDisplay(clozeSpan, imgElement);
        if (this.settings.scrollToClozeOnToggle) {
            this.scrollToCloze(clozeSpan);
        }
    }

    scrollToCloze(element) {
        const behavior = this.settings.animateScroll ? 'smooth' : 'auto';
        element.scrollIntoView({ behavior: behavior, block: 'center' });
    }

    addBorderIndicators(container) {
        const leftBorder = document.createElement('div');
        leftBorder.className = 'cloze-border-indicator cloze-border-left';
        const leftHandler = (e) => {
            e.preventDefault();
            const type = this.settings.swapLeftAndRightBorderActions ? 'pseudo' : 'genuine';
            this.revealNextClozeInContainer(container, type);
        };
        leftBorder.addEventListener('click', leftHandler);
        leftBorder.addEventListener('touchend', leftHandler);

        const rightBorder = document.createElement('div');
        rightBorder.className = 'cloze-border-indicator cloze-border-right';
        const rightHandler = (e) => {
            e.preventDefault();
            const type = this.settings.swapLeftAndRightBorderActions ? 'genuine' : 'pseudo';
            this.revealNextClozeInContainer(container, type);
        };
        rightBorder.addEventListener('click', rightHandler);
        rightBorder.addEventListener('touchend', rightHandler);

        container.appendChild(leftBorder);
        container.appendChild(rightBorder);
    }

    updateCardNumberIndicator() {
        document.querySelectorAll('.cloze-card-number-indicator').forEach(el => el.remove());
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view) return;
        const container = view.contentEl.querySelector('.markdown-preview-view');
        if (!container) return;
        
        const currentCard = this.getCurrentCardNumber();
        const folder = this.getCurrentFolder();
        const folderName = folder ? folder.split('/').pop() : '';
        
        const indicator = document.createElement('div');
        indicator.className = 'cloze-card-number-indicator';
        indicator.textContent = folderName ? `${folderName} - Card ${currentCard}` : `Card ${currentCard}`;
        container.appendChild(indicator);
    }

    revealNextClozeInActiveView(type) {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view) return;
        const container = view.contentEl.querySelector('.markdown-preview-view');
        if (container) {
            this.revealNextClozeInContainer(container, type);
        }
    }

    revealNextClozeInContainer(container, type) {
        const className = type === 'genuine' ? '.genuine-cloze' : '.pseudo-cloze';
        const hiddenClozes = container.querySelectorAll(`${className}[data-show-state="hint"]`);
        if (hiddenClozes.length === 0) {
            this.showNoMoreClozeIndicator();
            return;
        }
        const firstHidden = hiddenClozes[0];
        firstHidden.setAttribute('data-show-state', 'answer');
        this.updateClozeDisplay(firstHidden);
        if (this.settings.scrollToClozeOnToggle) {
            this.scrollToCloze(firstHidden);
        }
    }

    toggleAllClozesInActiveView(type) {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view) return;
        const container = view.contentEl.querySelector('.markdown-preview-view');
        if (!container) return;
        const className = type === 'genuine' ? '.genuine-cloze' : '.pseudo-cloze';
        const clozes = container.querySelectorAll(className);
        if (clozes.length === 0) return;
        const hiddenClozes = Array.from(clozes).filter(c => c.getAttribute('data-show-state') === 'hint');
        const allRevealed = hiddenClozes.length === 0;
        clozes.forEach(cloze => {
            cloze.setAttribute('data-show-state', allRevealed ? 'hint' : 'answer');
            this.updateClozeDisplay(cloze);
        });
    }

    showNoMoreClozeIndicator() {
        const indicator = document.createElement('div');
        indicator.className = 'cloze-no-more-indicator';
        document.body.appendChild(indicator);
        indicator.style.display = 'block';
        setTimeout(() => { indicator.remove(); }, 1000);
    }

    nextCard() {
        const currentCard = this.getCurrentCardNumber();
        this.setCurrentCardNumber(currentCard + 1);
        const folder = this.getCurrentFolder();
        const folderName = folder ? folder.split('/').pop() : '';
        const newCard = this.getCurrentCardNumber();
        new Notice(folderName ? `${folderName} - Card ${newCard}` : `Card ${newCard}`);
    }

    previousCard() {
        const currentCard = this.getCurrentCardNumber();
        if (currentCard > 1) {
            this.setCurrentCardNumber(currentCard - 1);
            const folder = this.getCurrentFolder();
            const folderName = folder ? folder.split('/').pop() : '';
            const newCard = this.getCurrentCardNumber();
            new Notice(folderName ? `${folderName} - Card ${newCard}` : `Card ${newCard}`);
        }
    }

    refreshAllClozes() {
        // 기존 타이머 정리
        this.cleanupTimers();
        
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (view && view.getMode() === 'preview') {
            // 페이지 재렌더링
            view.previewMode.rerender(true);
            
            // 재렌더링 후 타이머는 processClozes에서 자동 생성됨
            // 여기서 따로 생성하지 않음
        }
    }

    onunload() {
        this.cleanupTimers();
        document.getElementById('enhanced-cloze-styles')?.remove();
        document.querySelectorAll('.cloze-card-number-indicator').forEach(el => el.remove());
        console.log('Learning Strategy Planner plugin unloaded');
    }
}

// =====================================================
// 모달 클래스들
// =====================================================

// 주제 폴더 생성 모달
class ClozeSubfolderCreationModal extends Modal {
    constructor(app, plugin, onSubmit) {
        super(app);
        this.plugin = plugin;
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('cloze-modal-content');

        contentEl.createEl('h2', { text: '📁 새 주제 폴더 만들기' });

        contentEl.createEl('p', { 
            text: '주제별로 폴더를 만들면 각 폴더마다 독립적으로 카드를 관리할 수 있습니다.',
            attr: { style: 'color: var(--text-muted); margin-bottom: 20px;' }
        });

        const nameSetting = contentEl.createDiv('cloze-setting-item');
        nameSetting.createEl('label', { text: '폴더 이름' });
        const nameInput = nameSetting.createEl('input', {
            type: 'text',
            placeholder: '예: 영어, 수학, 역사',
        });

        const exampleDiv = contentEl.createDiv();
        exampleDiv.setAttribute('style', 'margin: 20px 0; padding: 15px; background: var(--background-secondary); border-radius: 5px;');
        exampleDiv.createEl('div', { text: '📚 퀴즈 관리 예시:', attr: { style: 'font-weight: 600; margin-bottom: 10px;' }});
        const exampleList = exampleDiv.createEl('ul', { attr: { style: 'margin-left: 20px; color: var(--text-muted);' }});
        exampleList.createEl('li', { text: '영어 폴더 → Card 1, 2, 3...' });
        exampleList.createEl('li', { text: '수학 폴더 → Card 1, 2, 3... (독립적)' });
        exampleList.createEl('li', { text: '역사 폴더 → Card 1, 2, 3... (독립적)' });

        const buttonContainer = contentEl.createDiv('cloze-modal-buttons');
        
        const createBtn = buttonContainer.createEl('button', { text: '만들기', cls: 'mod-cta' });
        createBtn.addEventListener('click', () => {
            const folderName = nameInput.value.trim();
            if (!folderName) {
                new Notice('폴더 이름을 입력하세요');
                return;
            }
            this.onSubmit(folderName);
            this.close();
        });

        const cancelBtn = buttonContainer.createEl('button', { text: '취소' });
        cancelBtn.addEventListener('click', () => {
            this.close();
        });

        nameInput.focus();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// 퀴즈 문제 생성 모달
class ClozeNoteCreationModal extends Modal {
    constructor(app, plugin, onSubmit, defaultFolder = null) {
        super(app);
        this.plugin = plugin;
        this.onSubmit = onSubmit;
        this.defaultFolder = defaultFolder;
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('cloze-modal-content');

        contentEl.createEl('h2', { text: '📄 새 퀴즈 만들기' });

        // 폴더 선택
        const folderSetting = contentEl.createDiv('cloze-setting-item');
        folderSetting.createEl('label', { text: '저장할 폴더' });
        const folderSelect = folderSetting.createEl('select');
        
        // 기존 폴더 목록 가져오기
        const folders = await this.getClozeFolders();
        folders.forEach(folder => {
            const option = folderSelect.createEl('option', {
                text: folder.displayName,
                value: folder.path
            });
            
            // 기본 폴더 선택
            if (this.defaultFolder && folder.path === this.defaultFolder) {
                option.selected = true;
            }
        });

        // 노트 이름
        const nameSetting = contentEl.createDiv('cloze-setting-item');
        nameSetting.createEl('label', { text: '노트 이름' });
        const nameInput = nameSetting.createEl('input', {
            type: 'text',
            placeholder: '예: Week 1 Vocabulary',
        });

        // 템플릿 선택
        const templateSetting = contentEl.createDiv('cloze-setting-item');
        templateSetting.createEl('label', { text: '템플릿 선택' });
        const templateSelect = templateSetting.createEl('select');
        
        const templates = [
            { value: 'basic', text: '기본 템플릿' },
            { value: 'vocabulary', text: '단어 학습' },
            { value: 'qa', text: 'Q&A 형식' }
        ];

        templates.forEach(template => {
            const option = templateSelect.createEl('option', {
                text: template.text,
                value: template.value
            });
        });

        const preview = contentEl.createDiv('cloze-preview');
        preview.createEl('div', { text: '템플릿 설명', cls: 'cloze-preview-label' });
        const previewDesc = preview.createEl('div', { cls: 'cloze-preview-desc' });

        const updatePreview = () => {
            const template = templateSelect.value;
            let desc = '';
            if (template === 'basic') {
                desc = '일반적인 학습 노트에 적합한 기본 템플릿입니다.';
            } else if (template === 'vocabulary') {
                desc = '단어와 의미를 학습하기 위한 표 형식 템플릿입니다.';
            } else if (template === 'qa') {
                desc = '질문과 답변 형식으로 구성된 템플릿입니다.';
            }
            previewDesc.setText(desc);
        };

        templateSelect.addEventListener('change', updatePreview);
        updatePreview();

        const buttonContainer = contentEl.createDiv('cloze-modal-buttons');
        
        const createBtn = buttonContainer.createEl('button', { text: '만들기', cls: 'mod-cta' });
        createBtn.addEventListener('click', () => {
            const fileName = nameInput.value.trim();
            if (!fileName) {
                new Notice('노트 이름을 입력하세요');
                return;
            }
            const folderPath = folderSelect.value;
            const template = templateSelect.value;
            this.onSubmit(folderPath, fileName, template);
            this.close();
        });

        const cancelBtn = buttonContainer.createEl('button', { text: '취소' });
        cancelBtn.addEventListener('click', () => {
            this.close();
        });

        nameInput.focus();
    }

    async getClozeFolders() {
        const basePath = this.plugin.settings.clozeFolder;
        const folders = [{ path: basePath, displayName: '📁 루트 폴더' }];
        
        const baseExists = await this.app.vault.adapter.exists(basePath);
        if (!baseExists) {
            await this.app.vault.createFolder(basePath);
        }

        const allFolders = this.app.vault.getAllLoadedFiles();
        for (const folder of allFolders) {
            if (folder.path.startsWith(basePath) && 
                folder.path !== basePath && 
                folder.children) {
                const folderName = folder.path.split('/').pop();
                folders.push({
                    path: folder.path,
                    displayName: `  📂 ${folderName}`
                });
            }
        }

        return folders;
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// 타이머 설정 모달 (새로 추가)
class TimerSettingModal extends Modal {
    constructor(app, plugin, currentDuration) {
        super(app);
        this.plugin = plugin;
        this.currentDuration = currentDuration;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('cloze-modal-content');

        contentEl.createEl('h2', { text: '⏲️ 타이머 시간 설정' });

        const folder = this.plugin.getCurrentFolder();
        if (folder) {
            contentEl.createEl('p', { 
                text: `현재 폴더: ${folder.split('/').pop()}`,
                cls: 'cloze-folder-info'
            });
        }

        const inputContainer = contentEl.createDiv('cloze-setting-item');
        inputContainer.createEl('label', { text: '타이머 시간 (초)' });
        const input = inputContainer.createEl('input', {
            type: 'number',
            value: String(this.currentDuration),
            attr: { min: '5', max: '300', placeholder: '30' }
        });
        input.style.width = '100%';

        contentEl.createEl('p', { 
            text: '5초에서 300초(5분) 사이로 설정할 수 있습니다.',
            cls: 'setting-item-description'
        });

        const buttonContainer = contentEl.createDiv('cloze-modal-buttons');
        
        const saveBtn = buttonContainer.createEl('button', { text: '저장', cls: 'mod-cta' });
        saveBtn.addEventListener('click', async () => {
            const value = parseInt(input.value);
            if (value && value >= 5 && value <= 300) {
                await this.plugin.setTimerDuration(value);
                new Notice(`타이머 ${value}초로 설정되었습니다`);
                this.plugin.refreshAllClozes();
                this.close();
            } else {
                new Notice('5~300 사이의 숫자를 입력해주세요');
            }
        });

        const cancelBtn = buttonContainer.createEl('button', { text: '취소' });
        cancelBtn.addEventListener('click', () => this.close());

        input.focus();
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                saveBtn.click();
            }
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// 타이머 전체 설정 모달 (새로 추가)
class TimerGlobalSettingModal extends Modal {
    constructor(app, plugin) {
        super(app);
        this.plugin = plugin;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('cloze-modal-content');

        contentEl.createEl('h2', { text: '⏱️ 타이머 전체 설정' });

        // 타이머 ON/OFF
        const enableSetting = contentEl.createDiv('cloze-setting-item');
        enableSetting.createEl('label', { text: '타이머 사용' });
        const enableToggle = enableSetting.createEl('input', {
            type: 'checkbox',
            checked: this.plugin.settings.enableTimer
        });
        enableToggle.style.cssText = 'width: 20px; height: 20px; cursor: pointer;';
        
        // 기본 타이머 시간
        const durationSetting = contentEl.createDiv('cloze-setting-item');
        durationSetting.createEl('label', { text: '기본 타이머 시간 (초)' });
        const durationInput = durationSetting.createEl('input', {
            type: 'number',
            value: String(this.plugin.settings.defaultTimerDuration),
            attr: { min: '5', max: '300', placeholder: '30' }
        });
        durationInput.style.width = '100%';

        // 경고 임계값
        const warningSetting = contentEl.createDiv('cloze-setting-item');
        warningSetting.createEl('label', { text: '경고 임계값 (초)' });
        const warningInput = warningSetting.createEl('input', {
            type: 'number',
            value: String(this.plugin.settings.timerWarningThreshold),
            attr: { min: '3', max: '30', placeholder: '5' }
        });
        warningInput.style.width = '100%';

        // 자동 시작
        const autoStartSetting = contentEl.createDiv('cloze-setting-item');
        autoStartSetting.createEl('label', { text: '자동 시작' });
        const autoStartToggle = autoStartSetting.createEl('input', {
            type: 'checkbox',
            checked: this.plugin.settings.autoStartTimer
        });
        autoStartToggle.style.cssText = 'width: 20px; height: 20px; cursor: pointer;';

        // 타이머 위치
        const positionSetting = contentEl.createDiv('cloze-setting-item');
        positionSetting.createEl('label', { text: '타이머 위치' });
        const positionSelect = positionSetting.createEl('select');
        positionSelect.style.width = '100%';
        
        const positions = [
            { value: 'top', text: '상단' },
            { value: 'bottom', text: '하단' },
            { value: 'floating', text: '플로팅' }
        ];
        
        positions.forEach(pos => {
            const option = positionSelect.createEl('option', {
                text: pos.text,
                value: pos.value
            });
            if (this.plugin.settings.timerPosition === pos.value) {
                option.selected = true;
            }
        });

        // 시간 종료 시 자동 공개
        const autoRevealSetting = contentEl.createDiv('cloze-setting-item');
        autoRevealSetting.createEl('label', { text: '시간 종료 시 자동으로 빈칸 공개' });
        const autoRevealToggle = autoRevealSetting.createEl('input', {
            type: 'checkbox',
            checked: this.plugin.settings.enableAutoRevealOnTimeout
        });
        autoRevealToggle.style.cssText = 'width: 20px; height: 20px; cursor: pointer;';

        // 진동 피드백
        const vibrationSetting = contentEl.createDiv('cloze-setting-item');
        vibrationSetting.createEl('label', { text: '진동 피드백 (모바일)' });
        const vibrationToggle = vibrationSetting.createEl('input', {
            type: 'checkbox',
            checked: this.plugin.settings.enableVibration
        });
        vibrationToggle.style.cssText = 'width: 20px; height: 20px; cursor: pointer;';

        contentEl.createEl('p', { 
            text: '※ 설정 변경 후 노트를 새로고침해야 적용됩니다.',
            cls: 'setting-item-description'
        }).style.cssText = 'margin-top: 20px; padding: 10px; background: var(--background-secondary); border-radius: 5px;';

        const buttonContainer = contentEl.createDiv('cloze-modal-buttons');
        
        const saveBtn = buttonContainer.createEl('button', { text: '저장', cls: 'mod-cta' });
        saveBtn.addEventListener('click', async () => {
            // 설정 저장
            this.plugin.settings.enableTimer = enableToggle.checked;
            
            const duration = parseInt(durationInput.value);
            if (duration && duration >= 5 && duration <= 300) {
                this.plugin.settings.defaultTimerDuration = duration;
            }
            
            const warning = parseInt(warningInput.value);
            if (warning && warning >= 3 && warning <= 30) {
                this.plugin.settings.timerWarningThreshold = warning;
            }
            
            this.plugin.settings.autoStartTimer = autoStartToggle.checked;
            this.plugin.settings.timerPosition = positionSelect.value;
            this.plugin.settings.enableAutoRevealOnTimeout = autoRevealToggle.checked;
            this.plugin.settings.enableVibration = vibrationToggle.checked;
            
            await this.plugin.saveSettings();
            new Notice('⏱️ 타이머 설정이 저장되었습니다');
            this.plugin.refreshAllClozes();
            this.close();
        });

        const cancelBtn = buttonContainer.createEl('button', { text: '취소' });
        cancelBtn.addEventListener('click', () => this.close());
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// 퀴즈 생성 모달
class ClozeCreationModal extends Modal {
    constructor(app, selectedText, onSubmit) {
        super(app);
        this.selectedText = selectedText;
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('cloze-modal-content');

        contentEl.createEl('h2', { text: '🎯 퀴즈 만들기' });

        contentEl.createEl('div', { 
            text: `선택한 텍스트: "${this.selectedText}"`,
            cls: 'cloze-selected-text'
        });

        const numberSetting = contentEl.createDiv('cloze-setting-item');
        numberSetting.createEl('label', { text: '카드 번호' });
        const numberInput = numberSetting.createEl('input', {
            type: 'number',
            value: '1',
            attr: { min: '1', placeholder: '1' }
        });

        const hintSetting = contentEl.createDiv('cloze-setting-item');
        hintSetting.createEl('label', { text: '힌트 (선택사항)' });
        const hintInput = hintSetting.createEl('input', {
            type: 'text',
            placeholder: '예: 수도 이름'
        });

        const preview = contentEl.createDiv('cloze-preview');
        preview.createEl('div', { text: '미리보기', cls: 'cloze-preview-label' });
        const previewText = preview.createEl('code');
        
        const updatePreview = () => {
            const num = numberInput.value || '1';
            const hint = hintInput.value;
            previewText.setText(
                hint ? 
                `{{c${num}::${this.selectedText}::${hint}}}` : 
                `{{c${num}::${this.selectedText}}}`
            );
        };

        numberInput.addEventListener('input', updatePreview);
        hintInput.addEventListener('input', updatePreview);
        updatePreview();

        const buttonContainer = contentEl.createDiv('cloze-modal-buttons');
        
        const createBtn = buttonContainer.createEl('button', { text: '만들기', cls: 'mod-cta' });
        createBtn.addEventListener('click', () => {
            const num = parseInt(numberInput.value) || 1;
            const hint = hintInput.value.trim();
            this.onSubmit(num, hint);
            this.close();
        });

        const cancelBtn = buttonContainer.createEl('button', { text: '취소' });
        cancelBtn.addEventListener('click', () => {
            this.close();
        });

        numberInput.focus();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// =====================================================
// Enhanced Cloze 클래스 제거됨 - Learning Planner는 퀴즈 모달 방식
// =====================================================

// =====================================================
// 설정 탭
// =====================================================
class LearningStrategySettingTab extends PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        const { containerEl } = this;
        containerEl.empty();
        
        containerEl.createEl('h1', { text: '학습 플래너 설정' });

        // ============ 기본 퀴즈 설정 ============
        containerEl.createEl('h2', { text: '🎯 기본 퀴즈 설정' });

        new Setting(containerEl)
            .setName('문제 순서 섞기')
            .setDesc('퀴즈 시작 시 문제 순서를 무작위로 섞습니다')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.shuffleQuestions || false)
                .onChange(async (value) => {
                    this.plugin.settings.shuffleQuestions = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('진행 상황 표시')
            .setDesc('퀴즈 진행 중 현재 문제 번호와 전체 문제 수를 표시합니다')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showProgress !== false)
                .onChange(async (value) => {
                    this.plugin.settings.showProgress = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('자동 저장')
            .setDesc('퀴즈 진행 중 자동으로 진행 상황을 저장합니다')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.autoSave !== false)
                .onChange(async (value) => {
                    this.plugin.settings.autoSave = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('퀴즈 히스토리 보관 기간')
            .setDesc('완료된 퀴즈 기록 보관 일수 (0 = 무제한)')
            .addText(text => text
                .setPlaceholder('30')
                .setValue(String(this.plugin.settings.historyRetentionDays || 30))
                .onChange(async (value) => {
                    const num = parseInt(value);
                    if (!isNaN(num) && num >= 0) {
                        this.plugin.settings.historyRetentionDays = num;
                        await this.plugin.saveSettings();
                    }
                }));

        new Setting(containerEl)
            .setName('오답노트 자동 생성')
            .setDesc('퀴즈 완료 후 자동으로 오답노트를 생성합니다')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.autoCreateWrongAnswerNote || false)
                .onChange(async (value) => {
                    this.plugin.settings.autoCreateWrongAnswerNote = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('기본 난이도')
            .setDesc('새 퀴즈 생성 시 기본으로 설정될 난이도')
            .addDropdown(dropdown => dropdown
                .addOption('쉬움', '쉬움')
                .addOption('보통', '보통')
                .addOption('어려움', '어려움')
                .addOption('매우 어려움', '매우 어려움')
                .setValue(this.plugin.settings.defaultDifficulty || '보통')
                .onChange(async (value) => {
                    this.plugin.settings.defaultDifficulty = value;
                    await this.plugin.saveSettings();
                }));

        containerEl.createEl('h3', { text: '📝 퀴즈 모드 기본 설정' });
        containerEl.createEl('p', { 
            text: '폴더에서 퀴즈를 시작할 때 기본으로 적용될 설정입니다.',
            cls: 'setting-item-description',
            attr: { style: 'margin-bottom: 16px; color: var(--text-muted);' }
        });

        new Setting(containerEl)
            .setName('기본 문제 수')
            .setDesc('퀴즈 시작 시 기본으로 설정될 문제 수')
            .addText(text => text
                .setPlaceholder('10')
                .setValue(String(this.plugin.settings.defaultQuizCount || 10))
                .onChange(async (value) => {
                    const num = parseInt(value);
                    if (!isNaN(num) && num > 0) {
                        this.plugin.settings.defaultQuizCount = num;
                        await this.plugin.saveSettings();
                    }
                }));

        new Setting(containerEl)
            .setName('기본 타이머 사용')
            .setDesc('퀴즈 시작 시 타이머를 기본으로 켤지 설정')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.defaultTimerEnabled !== false)
                .onChange(async (value) => {
                    this.plugin.settings.defaultTimerEnabled = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('기본 타이머 시간')
            .setDesc('문제당 기본 타이머 시간 (초)')
            .addText(text => text
                .setPlaceholder('30')
                .setValue(String(this.plugin.settings.defaultTimerPerQuestion || 30))
                .onChange(async (value) => {
                    const num = parseInt(value);
                    if (!isNaN(num) && num >= 5 && num <= 300) {
                        this.plugin.settings.defaultTimerPerQuestion = num;
                        await this.plugin.saveSettings();
                    }
                }));

        new Setting(containerEl)
            .setName('기본 문제 순서 섞기')
            .setDesc('퀴즈 시작 시 문제 순서를 기본으로 섞을지 설정')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.defaultShuffleQuestions !== false)
                .onChange(async (value) => {
                    this.plugin.settings.defaultShuffleQuestions = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('기본 선택지 순서 섞기')
            .setDesc('퀴즈 시작 시 선택지 순서를 기본으로 섞을지 설정')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.defaultShuffleOptions !== false)
                .onChange(async (value) => {
                    this.plugin.settings.defaultShuffleOptions = value;
                    await this.plugin.saveSettings();
                }));

        // ============ 퀴즈 폴더 관리 ============
        containerEl.createEl('h2', { text: '📁 퀴즈 폴더 관리' });

        new Setting(containerEl)
            .setName('메인 퀴즈 폴더')
            .setDesc('퀴즈 파일을 저장할 메인 폴더')
            .addText(text => text
                .setPlaceholder('Learning')
                .setValue(this.plugin.settings.clozeFolder || 'Learning')
                .onChange(async (value) => {
                    if (value && value.trim()) {
                        this.plugin.settings.clozeFolder = value.trim();
                        await this.plugin.saveSettings();
                    }
                }));

        // 퀴즈 폴더 목록 표시 및 관리
        const foldersContainer = containerEl.createDiv({ cls: 'quiz-folders-container' });
        foldersContainer.style.cssText = 'margin: 20px 0; padding: 15px; background: var(--background-secondary); border-radius: 8px;';
        
        foldersContainer.createEl('h3', { text: '퀴즈 폴더 목록' });
        
        const folderList = foldersContainer.createDiv({ cls: 'folder-list' });
        folderList.style.cssText = 'margin: 10px 0;';
        
        const renderFolders = () => {
            folderList.empty();
            
            // 북마크 폴더 표시 (삭제 불가)
            const bookmarkItem = folderList.createDiv({ cls: 'folder-item' });
            bookmarkItem.style.cssText = 'display: flex; align-items: center; gap: 10px; padding: 8px; background: var(--background-primary); margin-bottom: 8px; border-radius: 4px; opacity: 0.9;';
            
            const bookmarkName = bookmarkItem.createEl('span', { text: `⭐ 북마크` });
            bookmarkName.style.cssText = 'flex: 1; font-weight: 500; color: var(--interactive-accent);';
            
            const bookmarkBadge = bookmarkItem.createEl('span', { text: '가상 폴더' });
            bookmarkBadge.style.cssText = 'font-size: 0.75em; padding: 2px 6px; background: var(--interactive-accent); color: var(--text-on-accent); border-radius: 4px;';
            
            if (!this.plugin.settings.questionFolders || this.plugin.settings.questionFolders.length === 0) {
                folderList.createEl('p', { text: '퀴즈 폴더가 없습니다.', cls: 'setting-item-description' });
                return;
            }
            
            this.plugin.settings.questionFolders.forEach((folder, index) => {
                const folderItem = folderList.createDiv({ cls: 'folder-item' });
                folderItem.style.cssText = 'display: flex; align-items: center; gap: 10px; padding: 8px; background: var(--background-primary); margin-bottom: 8px; border-radius: 4px;';
                
                const folderName = folderItem.createEl('span', { text: `📁 ${folder}` });
                folderName.style.cssText = 'flex: 1; font-weight: 500;';
                
                const deleteBtn = folderItem.createEl('button', { text: '🗑️ 삭제' });
                deleteBtn.style.cssText = 'padding: 4px 12px; font-size: 12px; cursor: pointer;';
                deleteBtn.onclick = async () => {
                    if (confirm(`"${folder}" 폴더를 삭제하시겠습니까?\n\n경고: 폴더 내 모든 파일이 삭제됩니다!`)) {
                        const mainFolder = this.plugin.settings.clozeFolder || 'Learning';
                        const folderPath = `${mainFolder}/${folder}`;
                        try {
                            // 실제 폴더 삭제
                            const folderFile = this.app.vault.getAbstractFileByPath(folderPath);
                            if (folderFile) {
                                await this.app.vault.adapter.rmdir(folderPath, true);
                                new Notice(`✅ "${folder}" 폴더가 삭제되었습니다!`);
                            }
                        } catch (e) {
                            console.error('폴더 삭제 실패:', e);
                            new Notice(`❌ 폴더 삭제 실패: ${e.message}`);
                        }
                        // 설정에서 제거
                        this.plugin.settings.questionFolders.splice(index, 1);
                        await this.plugin.saveSettings();
                        renderFolders();
                    }
                };
            });
        };
        
        renderFolders();
        
        // 새 폴더 추가
        const addFolderContainer = foldersContainer.createDiv();
        addFolderContainer.style.cssText = 'display: flex; gap: 10px; margin-top: 15px;';
        
        const folderInput = addFolderContainer.createEl('input', { type: 'text' });
        folderInput.placeholder = '새 폴더 이름';
        folderInput.style.cssText = 'flex: 1; padding: 8px;';
        
        const addBtn = addFolderContainer.createEl('button', { text: '➕ 추가', cls: 'mod-cta' });
        addBtn.onclick = async () => {
            const folderName = folderInput.value.trim();
            if (!folderName) {
                new Notice('❌ 폴더 이름을 입력하세요!');
                return;
            }
            
            if (!this.plugin.settings.questionFolders) {
                this.plugin.settings.questionFolders = [];
            }
            
            if (this.plugin.settings.questionFolders.includes(folderName)) {
                new Notice('❌ 이미 존재하는 폴더입니다!');
                return;
            }
            
            // 실제 폴더 생성
            const mainFolder = this.plugin.settings.clozeFolder || 'Learning';
            const folderPath = `${mainFolder}/QuizQuestions/${folderName}`;
            
            try {
                // QuizQuestions 폴더 존재 확인
                const quizFolder = `${mainFolder}/QuizQuestions`;
                const quizFolderFile = this.app.vault.getAbstractFileByPath(quizFolder);
                if (!quizFolderFile) {
                    try {
                        await this.app.vault.createFolder(quizFolder);
                    } catch (e) {
                        if (!e.message.includes('already exists')) {
                            throw e;
                        }
                    }
                }
                
                // 하위 폴더 생성
                try {
                    await this.app.vault.createFolder(folderPath);
                } catch (e) {
                    if (!e.message.includes('already exists')) {
                        throw e;
                    }
                }
                
                // 설정에 추가
                this.plugin.settings.questionFolders.push(folderName);
                await this.plugin.saveSettings();
                
                new Notice(`✅ "${folderName}" 폴더가 생성되었습니다!`);
            } catch (e) {
                console.error('폴더 생성 실패:', e);
                new Notice(`❌ 폴더 생성 실패: ${e.message}`);
                return;
            }
            
            folderInput.value = '';
            renderFolders();
        };

        // ============ 이미지 폴더 관리 ============
        containerEl.createEl('h2', { text: '🖼️ 이미지 폴더 관리' });

        new Setting(containerEl)
            .setName('이미지 저장 폴더')
            .setDesc('첨부파일 및 이미지를 저장할 폴더 (절대 경로)')
            .addText(text => text
                .setPlaceholder('HanziQuiz/첨부파일')
                .setValue(this.plugin.settings.imageClozeFolder || `${this.plugin.settings.clozeFolder}/첨부파일`)
                .onChange(async (value) => {
                    if (value && value.trim()) {
                        this.plugin.settings.imageClozeFolder = value.trim();
                        await this.plugin.saveSettings();
                    }
                }));

        new Setting(containerEl)
            .setName('이미지 서브폴더')
            .setDesc('이미지 링크에 사용될 상대 경로 (예: 첨부파일/image.png)')
            .addText(text => text
                .setPlaceholder('첨부파일')
                .setValue(this.plugin.settings.imageSubFolder || '첨부파일')
                .onChange(async (value) => {
                    if (value && value.trim()) {
                        this.plugin.settings.imageSubFolder = value.trim();
                        await this.plugin.saveSettings();
                    }
                }));

        const imagePathInfo = containerEl.createDiv();
        imagePathInfo.style.cssText = 'margin: 10px 0; padding: 12px; background: var(--background-secondary); border-radius: 6px; font-size: 0.9em;';
        imagePathInfo.innerHTML = `
            <div style="margin-bottom: 8px;"><strong>💡 경로 설명:</strong></div>
            <div style="margin-left: 12px; color: var(--text-muted);">
                <div>• <strong>절대 경로</strong>: 파일 시스템에 저장될 실제 경로</div>
                <div>• <strong>상대 경로</strong>: Obsidian 링크에 표시될 경로</div>
                <div style="margin-top: 8px; padding: 8px; background: var(--background-primary); border-radius: 4px;">
                    <div>예시:</div>
                    <div style="margin-top: 4px;">파일 위치: <code>${this.plugin.settings.imageClozeFolder || 'HanziQuiz/첨부파일'}/image.png</code></div>
                    <div>Obsidian 링크: <code>![[${this.plugin.settings.imageSubFolder || '첨부파일'}/image.png]]</code></div>
                </div>
            </div>
        `;

        // ============ 북마크 설정 ============
        containerEl.createEl('h2', { text: '⭐ 북마크 설정' });

        new Setting(containerEl)
            .setName('북마크 폴더 이름')
            .setDesc('북마크된 문제를 관리할 가상 폴더 이름')
            .addText(text => text
                .setPlaceholder('⭐ 북마크')
                .setValue(this.plugin.settings.bookmarkFolder || '⭐ 북마크')
                .onChange(async (value) => {
                    if (value && value.trim()) {
                        this.plugin.settings.bookmarkFolder = value.trim();
                        await this.plugin.saveSettings();
                    }
                }));

        // ============ 학습 통계 ============
        containerEl.createEl('h2', { text: '📊 학습 통계' });

        const totalQuizzes = Object.keys(this.plugin.settings.quizzes || {}).length;
        
        // 북마크 개수를 비동기로 가져오기
        const statsContainer = containerEl.createDiv();
        this.renderBookmarkStats(statsContainer);

        new Setting(containerEl)
            .setName('총 퀴즈 수')
            .setDesc(`생성한 퀴즈: ${totalQuizzes}개`)
            .addButton(button => button
                .setButtonText('대시보드 열기')
                .onClick(() => {
                    this.plugin.openClozeDashboardView();
                }));
    }

    async renderBookmarkStats(container) {
        const allQuestions = await this.plugin.loadAllQuestions();
        const bookmarkedQuestions = allQuestions.filter(q => q.bookmarked);
        const totalBookmarks = bookmarkedQuestions.length;

        new Setting(container)
            .setName('북마크 수')
            .setDesc(`북마크된 문제: ${totalBookmarks}개`)
            .addButton(button => button
                .setButtonText('북마크 보기')
                .onClick(() => {
                    new BookmarkListModal(this.app, this.plugin).open();
                }));
    }
}

// =====================================================
// 모듈 내보내기
// =====================================================
module.exports = LearningStrategyPlugin;

// =====================================================
// 폴더 관리 모달
// =====================================================
class FolderManagementModal extends Modal {
    constructor(app, plugin) {
        super(app);
        this.plugin = plugin;
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('folder-management-modal');
        contentEl.style.cssText = 'padding: 0;';

        // 헤더
        const header = contentEl.createDiv({ cls: 'quiz-modal-header' });
        header.style.cssText = `
            background: linear-gradient(135deg, var(--interactive-accent) 0%, var(--interactive-accent-hover) 100%);
            color: var(--text-on-accent);
            padding: 24px;
            border-radius: 8px 8px 0 0;
            margin: -20px -20px 0 -20px;
        `;
        
        const headerContent = header.createDiv();
        headerContent.style.cssText = 'display: flex; justify-content: space-between; align-items: center;';
        
        const headerLeft = headerContent.createDiv();
        headerLeft.createEl('h2', { text: '📂 퀴즈 관리' }).style.cssText = 'margin: 0 0 4px 0; font-size: 24px;';
        headerLeft.createEl('p', { text: '폴더를 선택하고 학습을 시작하세요' }).style.cssText = 'margin: 0; opacity: 0.9; font-size: 14px;';
        
        // 버튼 그룹
        const btnGroup = headerContent.createDiv();
        btnGroup.style.cssText = 'display: flex; gap: 8px;';
        
        // 폴더 순서 변경 버튼
        const reorderBtn = btnGroup.createEl('button', { text: '🔀 순서' });
        reorderBtn.style.cssText = `
            padding: 10px 16px;
            background: rgba(255, 255, 255, 0.2);
            border: none;
            border-radius: 6px;
            color: white;
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;
            transition: all 0.2s;
        `;
        reorderBtn.title = '폴더 순서 변경';
        reorderBtn.onmouseenter = () => reorderBtn.style.background = 'rgba(255, 255, 255, 0.3)';
        reorderBtn.onmouseleave = () => reorderBtn.style.background = 'rgba(255, 255, 255, 0.2)';
        reorderBtn.onclick = () => {
            this.close();
            new FolderReorderModal(this.app, this.plugin).open();
        };
        
        // 새로고침 버튼
        const refreshBtn = btnGroup.createEl('button', { text: '🔄' });
        refreshBtn.style.cssText = `
            padding: 10px 16px;
            background: rgba(255, 255, 255, 0.2);
            border: none;
            border-radius: 6px;
            color: white;
            cursor: pointer;
            font-size: 18px;
            transition: all 0.2s;
        `;
        refreshBtn.title = '새로고침';
        refreshBtn.onmouseenter = () => refreshBtn.style.background = 'rgba(255, 255, 255, 0.3)';
        refreshBtn.onmouseleave = () => refreshBtn.style.background = 'rgba(255, 255, 255, 0.2)';
        refreshBtn.onclick = () => this.onOpen();

        const folders = await this.getClozefolders();
        
        // 본문 컨테이너
        const body = contentEl.createDiv({ cls: 'quiz-modal-body' });
        body.style.cssText = 'padding: 20px;';
        
        if (folders.length === 0) {
            const emptyState = body.createDiv({ cls: 'empty-state' });
            emptyState.style.cssText = 'text-align: center; padding: 60px 20px;';
            
            emptyState.createEl('div', { text: '📭' }).style.cssText = 'font-size: 64px; margin-bottom: 20px;';
            emptyState.createEl('h3', { text: '퀴즈 문제가 없습니다' }).style.cssText = 'margin: 0 0 8px 0; color: var(--text-muted);';
            emptyState.createEl('p', { text: '문제를 만들어 학습을 시작하세요' }).style.cssText = 'margin: 0; color: var(--text-muted);';
            return;
        }

        // 폴더 목록
        const folderList = body.createDiv({ cls: 'folder-list' });
        folderList.style.cssText = 'display: grid; gap: 16px; max-height: 60vh; overflow-y: auto;';

        for (const folder of folders) {
            const folderItem = folderList.createDiv({ cls: 'folder-item' });
            folderItem.style.cssText = `
                padding: 20px;
                border: 2px solid var(--background-modifier-border);
                border-radius: 12px;
                background: var(--background-primary-alt);
                transition: all 0.3s ease;
                cursor: pointer;
            `;
            
            folderItem.onmouseenter = () => {
                folderItem.style.borderColor = 'var(--interactive-accent)';
                folderItem.style.transform = 'translateY(-2px)';
                folderItem.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
            };
            folderItem.onmouseleave = () => {
                folderItem.style.borderColor = 'var(--background-modifier-border)';
                folderItem.style.transform = 'translateY(0)';
                folderItem.style.boxShadow = 'none';
            };

            // 폴더 헤더
            const folderHeader = folderItem.createDiv();
            folderHeader.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;';

            const folderName = folderHeader.createEl('h3', { text: folder.name });
            folderName.style.cssText = 'margin: 0; font-size: 20px; font-weight: 700;';

            const folderBadge = folderHeader.createEl('span', { text: `${folder.noteCount}개` });
            folderBadge.style.cssText = `
                padding: 4px 12px;
                background: var(--interactive-accent);
                color: var(--text-on-accent);
                border-radius: 12px;
                font-size: 13px;
                font-weight: 600;
            `;

            // 통계 카드
            const stats = this.plugin.settings.stats.folderStats[folder.name] || { attempts: 0, correct: 0, time: 0 };
            const accuracy = stats.attempts > 0 ? Math.round((stats.correct / stats.attempts) * 100) : 0;

            // 최근 학습 시간 가져오기
            const history = this.plugin.settings.stats.studyHistory || [];
            const folderHistory = history.filter(h => h.folderName === folder.name);
            const lastStudy = folderHistory.length > 0 ? 
                folderHistory.sort((a, b) => b.timestamp - a.timestamp)[0] : null;
            
            let lastStudyText = '학습 기록 없음';
            if (lastStudy) {
                const lastDate = new Date(lastStudy.timestamp);
                const now = new Date();
                const diffMs = now - lastDate;
                const diffMins = Math.floor(diffMs / 60000);
                const diffHours = Math.floor(diffMs / 3600000);
                const diffDays = Math.floor(diffMs / 86400000);
                
                if (diffMins < 1) {
                    lastStudyText = '방금 전';
                } else if (diffMins < 60) {
                    lastStudyText = `${diffMins}분 전`;
                } else if (diffHours < 24) {
                    lastStudyText = `${diffHours}시간 전`;
                } else if (diffDays === 1) {
                    lastStudyText = '어제';
                } else if (diffDays < 7) {
                    lastStudyText = `${diffDays}일 전`;
                } else {
                    lastStudyText = `${lastDate.getMonth() + 1}월 ${lastDate.getDate()}일`;
                }
            }

            const statsDiv = folderItem.createDiv();
            statsDiv.style.cssText = `
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 12px;
                margin-bottom: 16px;
                padding: 12px;
                background: var(--background-secondary);
                border-radius: 8px;
            `;
            
            const statItem = (icon, value, label) => {
                const item = statsDiv.createDiv();
                item.style.cssText = 'text-align: center;';
                item.createEl('div', { text: icon }).style.cssText = 'font-size: 20px; margin-bottom: 4px;';
                item.createEl('div', { text: value }).style.cssText = 'font-size: 16px; font-weight: 600; margin-bottom: 2px;';
                item.createEl('div', { text: label }).style.cssText = 'font-size: 11px; color: var(--text-muted);';
            };
            
            statItem('✅', `${stats.correct}회`, '정답');
            statItem('📊', `${accuracy}%`, '정답률');
            statItem('⏱️', `${Math.round(stats.time / 60)}분`, '학습시간');

            // 최근 학습 기록 3개 표시
            const recentHistory = folderHistory
                .sort((a, b) => b.timestamp - a.timestamp)
                .slice(0, 3);
            
            if (recentHistory.length > 0) {
                const historySection = folderItem.createDiv();
                historySection.style.cssText = `
                    margin-bottom: 12px;
                    padding: 12px;
                    background: var(--background-primary);
                    border-radius: 8px;
                `;
                
                const historyTitle = historySection.createEl('div', { text: '📅 최근 학습 기록' });
                historyTitle.style.cssText = 'font-size: 12px; font-weight: 600; margin-bottom: 8px; color: var(--text-muted);';
                
                recentHistory.forEach((record, index) => {
                    const recordDiv = historySection.createDiv();
                    recordDiv.style.cssText = `
                        padding: 6px 8px;
                        margin-bottom: ${index < recentHistory.length - 1 ? '6px' : '0'};
                        background: var(--background-secondary);
                        border-radius: 4px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        font-size: 12px;
                    `;
                    
                    const date = new Date(record.timestamp);
                    const timeStr = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
                    const statusIcon = record.completed ? '✅' : '⏱️';
                    
                    const leftDiv = recordDiv.createDiv();
                    leftDiv.style.cssText = 'display: flex; align-items: center; gap: 6px;';
                    leftDiv.createEl('span', { text: statusIcon });
                    leftDiv.createEl('span', { text: timeStr }).style.color = 'var(--text-normal)';
                    
                    const rightDiv = recordDiv.createDiv();
                    rightDiv.createEl('span', { text: `${Math.round(record.duration)}초` }).style.color = 'var(--text-muted)';
                });
            } else {
                const noHistoryDiv = folderItem.createDiv();
                noHistoryDiv.style.cssText = `
                    margin-bottom: 12px;
                    padding: 10px;
                    background: var(--background-primary);
                    border-radius: 6px;
                    text-align: center;
                    font-size: 13px;
                    color: var(--text-muted);
                `;
                noHistoryDiv.createEl('span', { text: '🕒 아직 학습 기록이 없습니다' });
            }

            // 상세 기록 버튼
            const detailBtn = folderItem.createEl('button', { text: '📊 상세 기록 보기' });
            detailBtn.style.cssText = `
                width: 100%;
                margin-bottom: 12px;
                padding: 10px;
                background: var(--background-secondary);
                border: 1px solid var(--background-modifier-border);
                border-radius: 6px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s;
            `;
            detailBtn.onmouseenter = () => {
                detailBtn.style.background = 'var(--background-modifier-hover)';
                detailBtn.style.borderColor = 'var(--interactive-accent)';
            };
            detailBtn.onmouseleave = () => {
                detailBtn.style.background = 'var(--background-secondary)';
                detailBtn.style.borderColor = 'var(--background-modifier-border)';
            };
            detailBtn.onclick = (e) => {
                e.stopPropagation();
                this.close();
                new FolderDetailModal(this.app, this.plugin, folder.name, folder.path).open();
            };

            // 버튼 그룹
            const btnGroup = folderItem.createDiv();
            btnGroup.style.cssText = 'display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;';

            // 북마크 폴더인 경우
            if (folder.isBookmarkFolder) {
                // 북마크 목록 보기
                const listBtn = btnGroup.createEl('button', { text: '⭐ 목록' });
                listBtn.style.cssText = 'padding: 10px; border-radius: 6px; border: 1px solid var(--background-modifier-border); background: var(--background-primary); font-weight: 500; cursor: pointer; transition: all 0.2s;';
                listBtn.onmouseenter = () => listBtn.style.background = 'var(--background-modifier-hover)';
                listBtn.onmouseleave = () => listBtn.style.background = 'var(--background-primary)';
                listBtn.onclick = (e) => {
                    e.stopPropagation();
                    this.close();
                    new BookmarkListModal(this.app, this.plugin).open();
                };

                // 북마크 퀴즈
                const quizBtn = btnGroup.createEl('button', { text: '🎯 퀴즈 시작' });
                quizBtn.style.cssText = 'padding: 10px; border-radius: 6px; border: none; background: var(--interactive-accent); color: var(--text-on-accent); font-weight: 600; cursor: pointer; transition: all 0.2s;';
                quizBtn.onmouseenter = () => quizBtn.style.opacity = '0.9';
                quizBtn.onmouseleave = () => quizBtn.style.opacity = '1';
                quizBtn.onclick = (e) => {
                    e.stopPropagation();
                    this.close();
                    new BookmarkQuizModal(this.app, this.plugin).open();
                };

                // 전체 삭제 (grid-column: span 2로 전체 너비 차지)
                const clearBtn = btnGroup.createEl('button', { text: '🗑️ 전체 삭제' });
                clearBtn.style.cssText = 'grid-column: span 2; padding: 10px; border-radius: 6px; border: none; background: var(--background-modifier-error); color: white; font-weight: 500; cursor: pointer; transition: all 0.2s;';
                clearBtn.onmouseenter = () => clearBtn.style.opacity = '0.9';
                clearBtn.onmouseleave = () => clearBtn.style.opacity = '1';
                clearBtn.onclick = async (e) => {
                    e.stopPropagation();
                    await this.plugin.clearBookmarks();
                    this.onOpen();
                };
            } else {
                // 일반 폴더인 경우
                // 퀴즈 시작 (강조)
                const quizBtn = btnGroup.createEl('button', { text: '🎯 퀴즈 시작' });
                quizBtn.style.cssText = 'padding: 10px; border-radius: 6px; border: none; background: var(--interactive-accent); color: var(--text-on-accent); font-weight: 600; cursor: pointer; transition: all 0.2s;';
                quizBtn.onmouseenter = () => quizBtn.style.opacity = '0.9';
                quizBtn.onmouseleave = () => quizBtn.style.opacity = '1';
                quizBtn.onclick = (e) => {
                    e.stopPropagation();
                    this.close();
                    new FolderQuizModal(this.app, this.plugin, folder.name).open();
                };
                
                // 새 문제
                const newNoteBtn = btnGroup.createEl('button', { text: '➕ 새 문제' });
                newNoteBtn.style.cssText = 'padding: 10px; border-radius: 6px; border: 1px solid var(--background-modifier-border); background: var(--background-primary); font-weight: 500; cursor: pointer; transition: all 0.2s;';
                newNoteBtn.onmouseenter = () => newNoteBtn.style.background = 'var(--background-modifier-hover)';
                newNoteBtn.onmouseleave = () => newNoteBtn.style.background = 'var(--background-primary)';
                newNoteBtn.onclick = async (e) => {
                    e.stopPropagation();
                    this.close();
                    new QuizCreatorModal(this.app, this.plugin, folder.name).open();
                };
            }
        }
    }

    async getClozefolders() {
        const folders = [];
        
        // 북마크 폴더 추가 (항상 표시)
        const allQuestions = await this.plugin.loadAllQuestions();
        const bookmarkedQuestions = allQuestions.filter(q => q.bookmarked);
        const bookmarkCount = bookmarkedQuestions.length;
        
        // 북마크가 없어도 폴더는 표시
        folders.push({
            name: '⭐ 북마크',
            path: this.plugin.settings.bookmarkFolder || '⭐ 북마크',
            noteCount: bookmarkCount,
            isBookmarkFolder: true
        });
        
        // questionFolders 설정 사용
        const questionFolders = this.plugin.settings.questionFolders || ['기본', '중급', '고급', '특별'];
        
        for (const folderName of questionFolders) {
            const folderPath = `${this.plugin.settings.clozeFolder}/${this.plugin.settings.questionSubFolder || 'Questions'}/${folderName}`;
            const folderFile = this.app.vault.getAbstractFileByPath(folderPath);
            
            let noteCount = 0;
            if (folderFile && folderFile.children) {
                noteCount = folderFile.children.filter(f => f.extension === 'md').length;
            }
            
            // 모든 폴더 표시 (문제 수와 관계없이)
            folders.push({
                name: folderName,
                path: folderPath,
                noteCount: noteCount
            });
        }

        return folders;
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// =====================================================
// 폴더 순서 변경 모달
// =====================================================
class FolderReorderModal extends Modal {
    constructor(app, plugin) {
        super(app);
        this.plugin = plugin;
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('folder-reorder-modal');
        contentEl.style.cssText = 'padding: 0;';

        // 헤더
        const header = contentEl.createDiv({ cls: 'quiz-modal-header' });
        header.style.cssText = `
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 24px;
            border-radius: 8px 8px 0 0;
            margin: -20px -20px 0 -20px;
        `;
        
        const headerContent = header.createDiv();
        headerContent.style.cssText = 'display: flex; justify-content: space-between; align-items: center;';
        
        const headerLeft = headerContent.createDiv();
        headerLeft.createEl('h2', { text: '🔀 폴더 순서 변경' }).style.cssText = 'margin: 0 0 4px 0; font-size: 24px;';
        headerLeft.createEl('p', { text: '드래그하여 폴더 순서를 변경하세요' }).style.cssText = 'margin: 0; opacity: 0.9; font-size: 14px;';

        // 본문 컨테이너
        const body = contentEl.createDiv({ cls: 'quiz-modal-body' });
        body.style.cssText = 'padding: 20px;';

        // 현재 폴더 목록 가져오기
        const folders = this.plugin.settings.questionFolders || ['기본', '중급', '고급', '특별'];
        
        // 폴더 순서 저장을 위한 배열
        this.folderOrder = [...folders];

        // 폴더 리스트
        const folderList = body.createDiv({ cls: 'folder-reorder-list' });
        folderList.style.cssText = 'display: flex; flex-direction: column; gap: 12px; margin-bottom: 20px;';

        this.renderFolderList(folderList);

        // 하단 버튼
        const footer = body.createDiv();
        footer.style.cssText = 'display: flex; gap: 12px; padding-top: 16px; border-top: 1px solid var(--background-modifier-border);';

        const saveBtn = footer.createEl('button', { text: '✅ 저장', cls: 'mod-cta' });
        saveBtn.style.cssText = 'flex: 1; padding: 12px 24px; font-size: 15px; font-weight: 600;';
        saveBtn.onclick = async () => {
            this.plugin.settings.questionFolders = this.folderOrder;
            await this.plugin.saveSettings();
            new Notice('✅ 폴더 순서가 저장되었습니다');
            this.close();
        };

        const cancelBtn = footer.createEl('button', { text: '취소' });
        cancelBtn.style.cssText = 'flex: 1; padding: 12px 24px; font-size: 15px;';
        cancelBtn.onclick = () => this.close();
    }

    renderFolderList(container) {
        container.empty();

        this.folderOrder.forEach((folderName, index) => {
            const item = container.createDiv({ cls: 'folder-reorder-item' });
            item.style.cssText = `
                padding: 16px;
                background: var(--background-primary-alt);
                border: 2px solid var(--background-modifier-border);
                border-radius: 8px;
                display: flex;
                align-items: center;
                gap: 12px;
                transition: all 0.2s;
            `;

            item.onmouseenter = () => {
                item.style.borderColor = 'var(--interactive-accent)';
                item.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
            };
            item.onmouseleave = () => {
                item.style.borderColor = 'var(--background-modifier-border)';
                item.style.boxShadow = 'none';
            };

            // 드래그 핸들
            const dragHandle = item.createEl('div', { text: '⋮⋮' });
            dragHandle.style.cssText = `
                font-size: 20px;
                color: var(--text-muted);
                cursor: grab;
                user-select: none;
            `;

            // 폴더 이름
            const nameDiv = item.createDiv();
            nameDiv.style.cssText = 'flex: 1; font-size: 16px; font-weight: 600;';
            nameDiv.createEl('span', { text: `📁 ${folderName}` });

            // 순서 표시
            const orderBadge = item.createEl('span', { text: `${index + 1}` });
            orderBadge.style.cssText = `
                padding: 4px 12px;
                background: var(--interactive-accent);
                color: var(--text-on-accent);
                border-radius: 12px;
                font-size: 13px;
                font-weight: 600;
            `;

            // 위/아래 이동 버튼
            const btnGroup = item.createDiv();
            btnGroup.style.cssText = 'display: flex; gap: 4px;';

            if (index > 0) {
                const upBtn = btnGroup.createEl('button', { text: '▲' });
                upBtn.style.cssText = `
                    padding: 6px 12px;
                    background: var(--background-secondary);
                    border: 1px solid var(--background-modifier-border);
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                    transition: all 0.2s;
                `;
                upBtn.title = '위로 이동';
                upBtn.onmouseenter = () => upBtn.style.background = 'var(--interactive-accent)';
                upBtn.onmouseleave = () => upBtn.style.background = 'var(--background-secondary)';
                upBtn.onclick = () => {
                    const temp = this.folderOrder[index];
                    this.folderOrder[index] = this.folderOrder[index - 1];
                    this.folderOrder[index - 1] = temp;
                    this.renderFolderList(container);
                };
            }

            if (index < this.folderOrder.length - 1) {
                const downBtn = btnGroup.createEl('button', { text: '▼' });
                downBtn.style.cssText = `
                    padding: 6px 12px;
                    background: var(--background-secondary);
                    border: 1px solid var(--background-modifier-border);
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                    transition: all 0.2s;
                `;
                downBtn.title = '아래로 이동';
                downBtn.onmouseenter = () => downBtn.style.background = 'var(--interactive-accent)';
                downBtn.onmouseleave = () => downBtn.style.background = 'var(--background-secondary)';
                downBtn.onclick = () => {
                    const temp = this.folderOrder[index];
                    this.folderOrder[index] = this.folderOrder[index + 1];
                    this.folderOrder[index + 1] = temp;
                    this.renderFolderList(container);
                };
            }
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// =====================================================
// 폴더 상세 기록 모달
// =====================================================
class FolderDetailModal extends Modal {
    constructor(app, plugin, folderName, folderPath) {
        super(app);
        this.plugin = plugin;
        this.folderName = folderName;
        this.folderPath = folderPath;
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('folder-detail-modal');

        // 폴더에서 모든 문제 파일 로드
        const folderFile = this.app.vault.getAbstractFileByPath(this.folderPath);
        if (folderFile && folderFile.children) {
            this.files = folderFile.children.filter(f => f.extension === 'md');
        } else {
            this.files = [];
        }

        // 헤더
        const header = contentEl.createDiv();
        header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;';
        
        header.createEl('h2', { text: `📊 ${this.folderName} 학습 기록` }).style.margin = '0';
        
        const btnGroup = header.createDiv();
        btnGroup.style.cssText = 'display: flex; gap: 8px;';
        
        // 새로고침 버튼
        const refreshBtn = btnGroup.createEl('button', { text: '🔄' });
        refreshBtn.title = '새로고침';
        refreshBtn.style.cssText = 'padding: 8px 12px;';
        refreshBtn.onclick = () => this.onOpen();

        const clearBtn = btnGroup.createEl('button', { text: '🗑️ 기록 삭제' });
        clearBtn.style.cssText = 'padding: 8px 12px; background: var(--background-modifier-error); color: white;';
        clearBtn.onclick = async () => {
            if (confirm(`"${this.folderName}" 폴더의 모든 학습 기록을 삭제하시겠습니까?`)) {
                await this.clearFolderStats();
                new Notice('✅ 기록이 삭제되었습니다');
                this.onOpen();
            }
        };

        if (!this.files || this.files.length === 0) {
            contentEl.createEl('p', { 
                text: '아직 학습 기록이 없습니다.',
                cls: 'setting-item-description'
            }).style.cssText = 'padding: 20px; text-align: center;';
            return;
        }

        contentEl.createEl('h3', { text: `📋 문제 목록 (${this.files.length}개)` });
        
        const sessionList = contentEl.createDiv({ cls: 'session-list' });
        sessionList.style.cssText = 'max-height: 60vh; overflow-y: auto; border: 1px solid var(--background-modifier-border); border-radius: 6px;';

        const sortedFiles = this.files.sort((a, b) => b.stat.mtime - a.stat.mtime);

        for (const file of sortedFiles) {
            try {
                const content = await this.app.vault.read(file);
                const statsMatch = content.match(/## 통계\n([\s\S]*?)(?=\n##|\n---|$)/);
                
                let wrongCount = 0;
                let correctCount = 0;
                
                if (statsMatch) {
                    const statsContent = statsMatch[1];
                    const wrongMatch = statsContent.match(/오답:\s*(\d+)/);
                    const correctMatch = statsContent.match(/정답:\s*(\d+)/);
                    
                    if (wrongMatch) wrongCount = parseInt(wrongMatch[1]);
                    if (correctMatch) correctCount = parseInt(correctMatch[1]);
                }
                
                const questionMatch = content.match(/## 문제\n([\s\S]*?)(?=\n##|$)/);
                const questionText = questionMatch ? questionMatch[1].trim() : '문제 없음';
                
                const sessionDiv = sessionList.createDiv({ cls: 'session-item' });
                sessionDiv.style.cssText = 'padding: 12px; border-bottom: 1px solid var(--background-modifier-border); display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: background 0.2s;';
                sessionDiv.onmouseenter = () => sessionDiv.style.background = 'var(--background-modifier-hover)';
                sessionDiv.onmouseleave = () => sessionDiv.style.background = 'transparent';
                sessionDiv.onclick = async () => {
                    const fileContent = await this.app.vault.read(file);
                    const question = this.plugin.parseQuestionFile(fileContent, file.path);
                    if (question) {
                        this.close();
                        new QuizCreatorModal(this.app, this.plugin, question.folder, question).open();
                    }
                };

                const infoDiv = sessionDiv.createDiv();
                infoDiv.style.flex = '1';
                
                const date = new Date(file.stat.mtime);
                const dateStr = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
                
                infoDiv.createEl('div', { text: `${dateStr}` }).style.cssText = 'font-weight: 500; margin-bottom: 4px;';
                infoDiv.createEl('div', { 
                    text: questionText.substring(0, 60) + (questionText.length > 60 ? '...' : ''),
                    cls: 'setting-item-description'
                }).style.fontSize = '0.9em';

                const statsDiv = sessionDiv.createDiv();
                statsDiv.style.cssText = 'text-align: right; display: flex; gap: 12px; align-items: center;';
                
                const totalAttempts = correctCount + wrongCount;
                const accuracy = totalAttempts > 0 ? Math.round((correctCount / totalAttempts) * 100) : 0;
                
                if (totalAttempts > 0) {
                    const accuracyBadge = statsDiv.createEl('span', { text: `정답률 ${accuracy}%` });
                    accuracyBadge.style.cssText = `padding: 4px 8px; border-radius: 4px; font-size: 0.85em; background: ${accuracy >= 70 ? 'var(--color-green)' : 'var(--color-orange)'}; color: white;`;
                    
                    statsDiv.createEl('span', { 
                        text: `${correctCount}/${totalAttempts}`,
                        cls: 'setting-item-description'
                    }).style.fontSize = '0.85em';
                } else {
                    const newBadge = statsDiv.createEl('span', { text: '미학습' });
                    newBadge.style.cssText = 'padding: 4px 8px; border-radius: 4px; font-size: 0.85em; background: var(--background-modifier-border); color: var(--text-muted);';
                }
            } catch (err) {
                console.error('Error reading file:', err);
            }
        }
    }

    async clearFolderStats() {
        for (const file of this.files) {
            try {
                const content = await this.app.vault.read(file);
                const updatedContent = content.replace(/## 통계\n[\s\S]*?(?=\n##|\n---|$)/, '## 통계\n오답: 0회\n정답: 0회\n북마크: ❌');
                await this.app.vault.modify(file, updatedContent);
            } catch (err) {
                console.error('Error clearing stats:', err);
            }
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// =====================================================
// 학습 기록 모달
// =====================================================
class StudyHistoryModal extends Modal {
    constructor(app, plugin) {
        super(app);
        this.plugin = plugin;
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('study-history-modal');

        const stats = this.plugin.settings.stats;
        const history = stats.studyHistory || [];

        // 헤더
        const header = contentEl.createDiv();
        header.style.cssText = `
            background: linear-gradient(135deg, var(--interactive-accent) 0%, var(--interactive-accent-hover) 100%);
            color: var(--text-on-accent);
            padding: 24px;
            margin: -20px -20px 20px -20px;
            border-radius: 8px 8px 0 0;
        `;

        const headerContent = header.createDiv();
        headerContent.style.cssText = 'display: flex; justify-content: space-between; align-items: center;';

        const headerLeft = headerContent.createDiv();
        const title = headerLeft.createEl('h2', { text: '📋 학습 기록' });
        title.style.cssText = 'margin: 0; font-size: 24px; font-weight: 700;';
        const subtitle = headerLeft.createEl('p', { text: '최근 학습 세션 및 통계' });
        subtitle.style.cssText = 'margin: 4px 0 0 0; opacity: 0.9; font-size: 14px;';

        if (history.length === 0) {
            const emptyState = contentEl.createDiv();
            emptyState.style.cssText = 'text-align: center; padding: 60px 20px; color: var(--text-muted);';
            emptyState.createEl('div', { text: '📭' }).style.cssText = 'font-size: 64px; margin-bottom: 16px;';
            emptyState.createEl('p', { text: '아직 학습 기록이 없습니다' }).style.cssText = 'font-size: 18px; font-weight: 600; margin-bottom: 8px;';
            emptyState.createEl('p', { text: '퀴즈를 완료하거나 학습을 정지하면 기록이 쌓입니다.' }).style.cssText = 'font-size: 14px; color: var(--text-muted);';
            return;
        }

        // 통계 카드
        const statsCards = contentEl.createDiv();
        statsCards.style.cssText = `
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
            margin-bottom: 20px;
        `;

        const totalSessions = history.length;
        const completedSessions = history.filter(h => h.completed).length;
        const totalTime = history.reduce((sum, h) => sum + (h.duration || 0), 0);
        const avgTime = totalSessions > 0 ? Math.round(totalTime / totalSessions) : 0;

        const statsData = [
            { icon: '📊', label: '총 세션', value: totalSessions },
            { icon: '✅', label: '완료', value: completedSessions },
            { icon: '⏱️', label: '평균 시간', value: `${avgTime}초` }
        ];

        statsData.forEach(stat => {
            const card = statsCards.createDiv();
            card.style.cssText = `
                background: var(--background-secondary);
                padding: 16px;
                border-radius: 8px;
                text-align: center;
            `;
            card.createEl('div', { text: stat.icon }).style.cssText = 'font-size: 24px; margin-bottom: 8px;';
            card.createEl('div', { text: String(stat.value) }).style.cssText = 'font-size: 20px; font-weight: 700; margin-bottom: 4px;';
            card.createEl('div', { text: stat.label }).style.cssText = 'font-size: 12px; color: var(--text-muted);';
        });

        // 헤더 버튼
        const headerButtons = contentEl.createDiv();
        headerButtons.style.cssText = 'display: flex; gap: 8px; margin-bottom: 16px;';
        
        const resetBtn = headerButtons.createEl('button', { text: '🗑️ 기록 초기화' });
        resetBtn.style.cssText = 'flex: 1; padding: 8px 16px; background: var(--background-modifier-error); color: white;';
        resetBtn.onclick = async () => {
            if (confirm('모든 학습 기록을 삭제하시겠습니까?')) {
                this.plugin.settings.stats = {
                    totalAttempts: 0,
                    totalCorrect: 0,
                    totalTime: 0,
                    lastStudyDate: null,
                    studyHistory: [],
                    folderStats: {},
                    fileStats: {}
                };
                await this.plugin.saveSettings();
                new Notice('학습 기록이 초기화되었습니다');
                this.onOpen();
            }
        };

        // 학습 세션 목록
        const listHeader = contentEl.createDiv();
        listHeader.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;';
        const listTitle = listHeader.createEl('h3', { text: `📄 최근 세션` });
        listTitle.style.cssText = 'margin: 0; font-size: 16px; font-weight: 600;';
        const countBadge = listHeader.createEl('span', { text: `${history.length}개` });
        countBadge.style.cssText = 'padding: 4px 12px; background: var(--interactive-accent); color: var(--text-on-accent); border-radius: 12px; font-size: 12px; font-weight: 600;';
        
        const sessionList = contentEl.createDiv({ cls: 'session-list' });
        sessionList.style.cssText = 'max-height: 50vh; overflow-y: auto;';

        // 최근 순으로 정렬
        const sortedHistory = history.sort((a, b) => b.timestamp - a.timestamp);

        for (const record of sortedHistory) {
            const sessionCard = sessionList.createDiv({ cls: 'session-card' });
            sessionCard.style.cssText = `
                background: var(--background-primary);
                border: 2px solid var(--background-modifier-border);
                border-radius: 12px;
                padding: 16px;
                margin-bottom: 12px;
                transition: all 0.3s ease;
                cursor: pointer;
            `;
            sessionCard.addEventListener('mouseenter', () => {
                sessionCard.style.borderColor = 'var(--interactive-accent)';
                sessionCard.style.transform = 'translateY(-2px)';
                sessionCard.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
            });
            sessionCard.addEventListener('mouseleave', () => {
                sessionCard.style.borderColor = 'var(--background-modifier-border)';
                sessionCard.style.transform = 'translateY(0)';
                sessionCard.style.boxShadow = 'none';
            });

            const cardHeader = sessionCard.createDiv();
            cardHeader.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;';

            const date = new Date(record.timestamp);
            const dateStr = `${date.getMonth() + 1}월 ${date.getDate()}일 ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
            const dateEl = cardHeader.createEl('div', { text: `🕐 ${dateStr}` });
            dateEl.style.cssText = 'font-size: 14px; font-weight: 600; color: var(--text-normal);';
            
            const statusBadge = cardHeader.createEl('span', { 
                text: record.completed ? '✅ 완료' : '⏱️ 시간초과'
            });
            statusBadge.style.cssText = `
                padding: 4px 12px;
                border-radius: 12px;
                font-size: 12px;
                font-weight: 600;
                background: ${record.completed ? 'var(--color-green)' : 'var(--color-orange)'};
                color: white;
            `;

            const cardBody = sessionCard.createDiv();
            cardBody.style.cssText = 'display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;';

            const folderName = record.folderName || '알 수 없음';
            const fileName = record.fileName || '알 수 없음';
            const duration = Math.round(record.duration || 0);

            const infoItems = [
                { icon: '📁', label: '폴더', value: folderName },
                { icon: '📄', label: '파일', value: fileName },
                { icon: '⏱️', label: '시간', value: `${duration}초` },
                { icon: '🎯', label: '상태', value: record.completed ? '성공' : '중단' }
            ];

            infoItems.forEach(item => {
                const infoDiv = cardBody.createDiv();
                infoDiv.style.cssText = 'display: flex; align-items: center; gap: 6px;';
                infoDiv.createEl('span', { text: item.icon }).style.cssText = 'font-size: 16px;';
                const textDiv = infoDiv.createDiv();
                textDiv.createEl('div', { text: item.label }).style.cssText = 'font-size: 11px; color: var(--text-muted);';
                textDiv.createEl('div', { text: item.value }).style.cssText = 'font-size: 13px; font-weight: 600;';
            });
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// =====================================================
// 이미지 빈칸 추가 모달
// =====================================================

class ImageClozeModal extends Modal {
    constructor(app, plugin, currentFile, onComplete) {
        super(app);
        this.plugin = plugin;
        this.currentFile = currentFile;
        this.onComplete = onComplete;
        this.imageFile = null;
        this.imageUrl = null;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('image-cloze-modal');
        
        // 모바일 대응 스타일 추가
        if (!document.getElementById('image-cloze-modal-mobile-style')) {
            const style = document.createElement('style');
            style.id = 'image-cloze-modal-mobile-style';
            style.innerHTML = `
                @media (max-width: 600px) {
                    .image-cloze-modal .modal {
                        max-width: 100vw !important;
                        width: 100vw !important;
                        padding: 16px !important;
                    }
                    .image-cloze-modal button {
                        min-height: 44px !important;
                        font-size: 16px !important;
                        -webkit-tap-highlight-color: transparent !important;
                        touch-action: manipulation !important;
                    }
                    .image-cloze-modal input {
                        min-height: 44px !important;
                        font-size: 16px !important;
                    }
                }
            `;
            document.head.appendChild(style);
        }
        
        contentEl.createEl('h2', { text: '🖼️ 이미지 빈칸 추가' });
        
        // 이미지 미리보기 영역
        const previewContainer = contentEl.createDiv();
        previewContainer.style.cssText = 'margin: 20px 0; min-height: 200px; border: 2px dashed var(--background-modifier-border); border-radius: 8px; display: flex; align-items: center; justify-content: center; position: relative;';
        
        const placeholder = previewContainer.createDiv();
        placeholder.style.cssText = 'text-align: center; color: var(--text-muted);';
        placeholder.innerHTML = '📷<br>이미지를 선택하거나<br>Ctrl+V로 붙여넣기';
        
        // 이미지 업로드 버튼
        const uploadBtnContainer = contentEl.createDiv();
        uploadBtnContainer.style.cssText = 'display: flex; gap: 10px; margin-bottom: 20px;';
        
        const uploadBtn = uploadBtnContainer.createEl('button', { text: '📁 파일 선택', cls: 'mod-cta' });
        uploadBtn.style.flex = '1';
        uploadBtn.style.cssText = 'flex: 1; -webkit-tap-highlight-color: transparent; touch-action: manipulation;';
        
        const pasteInfo = uploadBtnContainer.createEl('div', { 
            text: '또는 Ctrl+V로 붙여넣기',
            cls: 'setting-item-description'
        });
        pasteInfo.style.cssText = 'display: flex; align-items: center; font-size: 0.9em;';
        
        // 크기 설정
        const sizeContainer = contentEl.createDiv();
        sizeContainer.style.cssText = 'margin-bottom: 20px;';
        
        sizeContainer.createEl('label', { text: '이미지 너비 (픽셀):' });
        const widthInput = sizeContainer.createEl('input', { 
            type: 'number',
            placeholder: '300',
            value: '300'
        });
        widthInput.style.cssText = 'width: 100%; padding: 8px; margin-top: 8px; border: 1px solid var(--background-modifier-border); border-radius: 4px;';
        
        // 정답/힌트 입력
        const answerContainer = contentEl.createDiv();
        answerContainer.style.cssText = 'margin-bottom: 20px;';
        
        answerContainer.createEl('label', { text: '정답 (이미지 설명):' });
        const answerInput = answerContainer.createEl('input', { 
            type: 'text',
            placeholder: '이미지 정답 설명'
        });
        answerInput.style.cssText = 'width: 100%; padding: 8px; margin-top: 8px; border: 1px solid var(--background-modifier-border); border-radius: 4px;';
        
        const hintContainer = contentEl.createDiv();
        hintContainer.style.cssText = 'margin-bottom: 20px;';
        
        hintContainer.createEl('label', { text: '힌트:' });
        const hintInput = hintContainer.createEl('input', { 
            type: 'text',
            placeholder: '힌트'
        });
        hintInput.style.cssText = 'width: 100%; padding: 8px; margin-top: 8px; border: 1px solid var(--background-modifier-border); border-radius: 4px;';
        
        // 이미지 미리보기 함수
        const showPreview = (url) => {
            previewContainer.empty();
            const img = previewContainer.createEl('img');
            img.src = url;
            img.style.cssText = 'max-width: 100%; max-height: 300px; border-radius: 4px;';
            
            // 삭제 버튼
            const deleteBtn = previewContainer.createEl('button', { text: '✕' });
            deleteBtn.style.cssText = 'position: absolute; top: 8px; right: 8px; width: 32px; height: 32px; border-radius: 50%; background: rgba(0,0,0,0.7); color: white; border: none; cursor: pointer; -webkit-tap-highlight-color: transparent; touch-action: manipulation;';
            
            const deleteBtnHandler = () => {
                this.imageFile = null;
                this.imageUrl = null;
                previewContainer.empty();
                previewContainer.appendChild(placeholder);
            };
            
            deleteBtn.onclick = deleteBtnHandler;
            deleteBtn.addEventListener('touchend', (e) => {
                e.preventDefault();
                deleteBtnHandler();
            });
        };
        
        // 파일 선택 핸들러
        const uploadBtnHandler = () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = async (e) => {
                const file = e.target.files?.[0];
                if (file) {
                    this.imageFile = file;
                    this.imageUrl = URL.createObjectURL(file);
                    showPreview(this.imageUrl);
                }
            };
            input.click();
        };
        
        uploadBtn.onclick = uploadBtnHandler;
        uploadBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            uploadBtnHandler();
        });
        
        // 클립보드 붙여넣기 핸들러
        const pasteHandler = async (e) => {
            const items = e.clipboardData?.items;
            if (!items) return;
            
            for (let item of items) {
                if (item.type.indexOf('image') !== -1) {
                    e.preventDefault();
                    const file = item.getAsFile();
                    if (file) {
                        this.imageFile = file;
                        this.imageUrl = URL.createObjectURL(file);
                        showPreview(this.imageUrl);
                        new Notice('✅ 이미지가 붙여넣어졌습니다');
                    }
                    break;
                }
            }
        };
        
        document.addEventListener('paste', pasteHandler);
        this.pasteHandler = pasteHandler;
        
        // 버튼
        const buttonContainer = contentEl.createDiv();
        buttonContainer.style.cssText = 'display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;';
        
        const cancelBtn = buttonContainer.createEl('button', { text: '취소' });
        cancelBtn.style.cssText = '-webkit-tap-highlight-color: transparent; touch-action: manipulation;';
        
        const cancelHandler = () => this.close();
        cancelBtn.onclick = cancelHandler;
        cancelBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            cancelHandler();
        });
        
        const confirmBtn = buttonContainer.createEl('button', { text: '추가', cls: 'mod-cta' });
        confirmBtn.style.cssText = '-webkit-tap-highlight-color: transparent; touch-action: manipulation;';
        
        const confirmHandler = async () => {
            if (!this.imageFile) {
                new Notice('❌ 이미지를 선택해주세요');
                return;
            }
            
            try {
                // 이미지 저장
                const arrayBuffer = await this.imageFile.arrayBuffer();
                const attachmentFolder = this.app.vault.getConfig('attachmentFolderPath') || '첨부파일';
                const ext = this.imageFile.name.split('.').pop() || 'png';
                const fileName = `image-${Date.now()}.${ext}`;
                const filePath = `${attachmentFolder}/${fileName}`;
                
                // 폴더 확인 및 생성
                const folder = this.app.vault.getAbstractFileByPath(attachmentFolder);
                if (!folder) {
                    try {
                        await this.app.vault.createFolder(attachmentFolder);
                    } catch (e) {
                        // 폴더가 이미 존재하는 경우 무시
                        if (!e.message.includes('already exists')) {
                            throw e;
                        }
                    }
                }
                
                // 파일 저장
                await this.app.vault.createBinary(filePath, arrayBuffer);
                
                // 마크다운 생성
                const width = widthInput.value ? `|${widthInput.value}` : '';
                const answer = answerInput.value.trim() || '이미지 설명';
                const hint = hintInput.value.trim();
                const clozeText = hint ? `{{c1::${answer}::${hint}}}` : `{{c1::${answer}}}`;
                const imageMarkdown = `\n\n![[${fileName}${width}]]${clozeText}\n`;
                
                // 노트에 추가
                if (this.currentFile) {
                    const content = await this.app.vault.read(this.currentFile);
                    await this.app.vault.modify(this.currentFile, content + imageMarkdown);
                    new Notice('✅ 이미지 빈칸이 추가되었습니다!');
                    
                    if (this.onComplete) {
                        await this.onComplete();
                    }
                }
                
                this.close();
            } catch (e) {
                new Notice('❌ 이미지 추가 실패');
                console.error(e);
            }
        };
        
        confirmBtn.onclick = confirmHandler;
        confirmBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            confirmHandler();
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
        
        // 이벤트 리스너 제거
        if (this.pasteHandler) {
            document.removeEventListener('paste', this.pasteHandler);
        }
        
        // URL 해제
        if (this.imageUrl) {
            URL.revokeObjectURL(this.imageUrl);
        }
    }
}

// =====================================================
// 텍스트 입력 모달 (prompt 대체용)
// =====================================================

class TextInputModal extends Modal {
    constructor(app, title, placeholder, defaultValue, onSubmit, multiline = false) {
        super(app);
        this.title = title;
        this.placeholder = placeholder;
        this.defaultValue = defaultValue || '';
        this.onSubmit = onSubmit;
        this.multiline = multiline;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        contentEl.createEl('h2', { text: this.title });
        
        const inputContainer = contentEl.createDiv();
        inputContainer.style.cssText = 'margin: 20px 0;';
        
        let input;
        if (this.multiline) {
            input = inputContainer.createEl('textarea', { 
                placeholder: this.placeholder,
                value: this.defaultValue
            });
            input.style.cssText = 'width: 100%; min-height: 150px; padding: 8px; font-size: 16px; border: 1px solid var(--background-modifier-border); border-radius: 4px; background: var(--background-primary); resize: vertical; font-family: inherit;';
        } else {
            input = inputContainer.createEl('input', { 
                type: 'text',
                placeholder: this.placeholder,
                value: this.defaultValue
            });
            input.style.cssText = 'width: 100%; padding: 8px; font-size: 16px; border: 1px solid var(--background-modifier-border); border-radius: 4px; background: var(--background-primary);';
        }
        
        const buttonContainer = contentEl.createDiv();
        buttonContainer.style.cssText = 'display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;';
        
        const cancelBtn = buttonContainer.createEl('button', { text: '취소' });
        cancelBtn.onclick = () => this.close();
        
        const confirmBtn = buttonContainer.createEl('button', { text: '확인', cls: 'mod-cta' });
        confirmBtn.onclick = () => {
            const value = input.value.trim();
            if (value) {
                this.onSubmit(value);
                this.close();
            }
        };
        
        // Enter 키로 확인 (single line만)
        if (!this.multiline) {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    confirmBtn.click();
                } else if (e.key === 'Escape') {
                    this.close();
                }
            });
        } else {
            // multiline에서는 Escape만 처리
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    this.close();
                }
            });
        }
        
        // 자동 포커스
        setTimeout(() => input.focus(), 50);
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// =====================================================
// 최근 파일 선택 모달
// =====================================================
class RecentFilesModal extends Modal {
    constructor(app, plugin, files, folderName) {
        super(app);
        this.plugin = plugin;
        this.files = files;
        this.folderName = folderName;
    }

    onOpen() {
        const { contentEl, modalEl } = this;
        contentEl.empty();
        
        // 모바일 대응
        const isMobile = window.innerWidth <= 768;
        modalEl.style.width = isMobile ? '95vw' : '600px';
        modalEl.style.maxWidth = '95vw';
        
        contentEl.createEl('h2', { text: `📂 ${this.folderName} 파일 선택` });
        
        const fileList = contentEl.createDiv({ cls: 'recent-files-list' });
        fileList.style.cssText = 'max-height: 400px; overflow-y: auto; margin: 20px 0;';
        
        this.files.forEach(file => {
            const fileItem = fileList.createDiv({ cls: 'recent-file-item' });
            fileItem.style.cssText = `
                padding: 12px;
                margin-bottom: 8px;
                background: var(--background-secondary);
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.2s;
                border: 1px solid var(--background-modifier-border);
            `;
            
            fileItem.addEventListener('mouseenter', () => {
                fileItem.style.background = 'var(--background-modifier-hover)';
                fileItem.style.borderColor = 'var(--interactive-accent)';
            });
            
            fileItem.addEventListener('mouseleave', () => {
                fileItem.style.background = 'var(--background-secondary)';
                fileItem.style.borderColor = 'var(--background-modifier-border)';
            });
            
            fileItem.addEventListener('click', async () => {
                await this.app.workspace.getLeaf().openFile(file);
                new Notice(`📂 ${file.basename} 파일 열기 완료`);
                this.close();
            });
            
            const fileName = fileItem.createEl('div', { text: file.basename });
            fileName.style.cssText = 'font-weight: bold; margin-bottom: 4px;';
            
            const filePath = fileItem.createEl('div', { text: file.path });
            filePath.style.cssText = 'font-size: 0.85em; color: var(--text-muted);';
        });
        
        const closeBtn = contentEl.createEl('button', { text: '닫기' });
        closeBtn.style.cssText = `
            width: 100%;
            padding: ${isMobile ? '12px' : '8px'};
            background: var(--interactive-accent);
            color: var(--text-on-accent);
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-weight: bold;
            min-height: ${isMobile ? '48px' : '36px'};
        `;
        closeBtn.onclick = () => this.close();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// =====================================================
// 퀴즈 모드 모달
// =====================================================

class QuizModeModal extends Modal {
    constructor(app, plugin, folderPath = null) {
        super(app);
        this.plugin = plugin;
        this.folderPath = folderPath;
        this.notes = [];
        this.currentNoteIndex = 0;
        this.currentCardNumber = 1;
        this.startTime = null;
        this.sessionStartTime = null;  // 세션 시작 시간 (전체 퀴즈 세션)
        this.timer = null;
        this.currentFile = null;
        this.currentFolder = '';
        this.currentFolderName = '';
        this.stopwatchPaused = false;
        this.elapsedTime = 0;
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('quiz-mode-modal');
        // 모바일(안드로이드) 대응 스타일 추가
        if (!document.getElementById('quiz-mode-mobile-style')) {
            const style = document.createElement('style');
            style.id = 'quiz-mode-mobile-style';
            style.innerHTML = `
            /* 퀴즈 모드 텍스트 선택 활성화 */
            .quiz-mode-modal .quiz-note-content,
            .quiz-mode-modal .quiz-note-content * {
                user-select: text !important;
                -webkit-user-select: text !important;
                -moz-user-select: text !important;
                -ms-user-select: text !important;
                cursor: text;
            }
            
            /* 빈칸은 여전히 클릭 가능하도록 */
            .quiz-mode-modal .genuine-cloze,
            .quiz-mode-modal .pseudo-cloze,
            .quiz-mode-modal .image-cloze {
                cursor: pointer !important;
            }
            
            @media (max-width: 600px) {
                .quiz-mode-modal {
                    max-width: 100vw !important;
                    width: 100vw !important;
                    min-width: 0 !important;
                    padding: 0 !important;
                }
                .quiz-footer {
                    flex-direction: row !important;
                    gap: 4px !important;
                    padding: 8px 0 0 0 !important;
                    position: fixed !important;
                    bottom: 56px !important;
                    width: 100vw !important;
                    left: 0 !important;
                    right: 0 !important;
                    z-index: 1000 !important;
                    background: var(--background-secondary) !important;
                    margin-bottom: 0 !important;
                }
                .quiz-footer button, .quiz-mode-modal button {
                    min-width: 0 !important;
                    font-size: 0.85rem !important;
                    min-height: 48px !important;
                    font-size: 20px !important;
                    flex: 1 1 0 !important;
                    padding: 0 !important;
                    border-radius: 8px !important;
                    margin: 0 !important;
                    overflow: hidden !important;
                }
                .quiz-content {
                    padding: 8px !important;
                }
                .quiz-header {
                    padding: 8px !important;
                }
                .quiz-timer {
                    font-size: 20px !important;
                }
                .quiz-note-content {
                    font-size: 15px !important;
                    padding: 8px !important;
                }
                .quiz-mode-modal h2, .quiz-mode-modal h3 {
                    font-size: 1.1em !important;
                }
                .quiz-mode-modal .quiz-progress {
                    font-size: 13px !important;
                }
                .quiz-mode-modal .quiz-content {
                    margin-bottom: 56px !important;
                }
                .quiz-mode-modal .quiz-complete-btns {
                    flex-direction: column !important;
                    gap: 8px !important;
                }
                .quiz-mode-modal .quiz-complete-btns button {
                    font-size: 1em !important;
                    min-height: 44px !important;
                }
            }
            `;
            document.head.appendChild(style);
        }
        await this.loadNotes();
        if (this.notes.length === 0) {
            const folderName = this.folderPath ? this.folderPath.split('/').pop() : this.plugin.settings.clozeFolder;
            contentEl.createEl('h2', { text: '⚠️ 퀴즈를 시작할 수 없습니다' });
            contentEl.createEl('p', { text: `"${folderName}" 폴더에 마크다운 파일이 없습니다.` });
            contentEl.createEl('p', { text: '폴더 경로를 확인하거나 파일을 추가해주세요.' });
            
            const backBtn = contentEl.createEl('button', { text: '⬅️ 대시보드로 돌아가기', cls: 'mod-cta' });
            backBtn.style.cssText = 'margin-top: 20px; padding: 12px 24px;';
            backBtn.onclick = () => {
                if (this.plugin.openClozeDashboardView) {
                    this.plugin.openClozeDashboardView();
                }
                this.close();
            };
            return;
        }
        contentEl.style.cssText = 'display: flex; flex-direction: column; height: 80vh; max-width: 800px;';
        const header = contentEl.createDiv({ cls: 'quiz-header' });
        const headerTop = header.createDiv();
        headerTop.style.cssText = 'display: flex; justify-content: space-between; align-items: center;';
        headerTop.createEl('h2', { text: '🎯 퀴즈 모드' }).style.margin = '0';
        const progress = headerTop.createEl('span', {
            text: `${this.currentNoteIndex + 1} / ${this.notes.length}`,
            cls: 'quiz-progress'
        });
        progress.style.cssText = 'font-size: 14px; color: var(--text-muted);';
        // 상단 버튼 그룹 (메뉴, 폴더이동, 삭제, 편집, 종료)
        const topButtons = header.createDiv();
        topButtons.style.cssText = 'display: flex; gap: 8px; margin-top: 12px;';
        
        // ☰ 메뉴 버튼
        const menuBtn = topButtons.createEl('button');
        menuBtn.innerHTML = '☰';
        menuBtn.setAttribute('aria-label', '메뉴');
        menuBtn.style.cssText = 'flex:1; min-width:44px; min-height:44px; font-size:22px; display:flex; align-items:center; justify-content:center;';
        menuBtn.onclick = (e) => {
            const menu = new Menu();
            
            // 대시보드로 이동
            menu.addItem((item) => {
                item.setTitle('📊 대시보드로 이동')
                    .setIcon('layout-dashboard')
                    .onClick(() => {
                        if (this.plugin.openClozeDashboardView) {
                            this.plugin.openClozeDashboardView();
                        }
                        this.close();
                    });
            });
            
            menu.addSeparator();
            
            // 현재 폴더의 모든 .md 파일 보기
            menu.addItem((item) => {
                item.setTitle('📄 현재 폴더 파일 관리')
                    .setIcon('files')
                    .onClick(() => {
                        const folderPath = this.currentFolder || this.plugin.settings.clozeFolder;
                        const filesMenu = new Menu();
                        
                        // 현재 폴더의 .md 파일들
                        const files = this.app.vault.getAllLoadedFiles()
                            .filter(f => f.parent?.path === folderPath && f.path.endsWith('.md'))
                            .sort((a, b) => a.basename.localeCompare(b.basename));
                        
                        if (files.length === 0) {
                            new Notice('현재 폴더에 파일이 없습니다.');
                            return;
                        }
                        
                        files.forEach(file => {
                            filesMenu.addItem((fileItem) => {
                                fileItem.setTitle(`📄 ${file.basename}`)
                                    .setIcon('file')
                                    .onClick((evt) => {
                                        // 서브메뉴 생성
                                        const subMenu = new Menu();
                                        
                                        // 열기
                                        subMenu.addItem((subItem) => {
                                            subItem.setTitle('📖 열기')
                                                .setIcon('file-edit')
                                                .onClick(async () => {
                                                    const leaf = this.app.workspace.getLeaf('tab');
                                                    await leaf.openFile(file);
                                                });
                                        });
                                        
                                        // 이름 변경
                                        subMenu.addItem((subItem) => {
                                            subItem.setTitle('✏️ 이름 변경')
                                                .setIcon('pencil')
                                                .onClick(async () => {
                                                    new TextInputModal(
                                                        this.app,
                                                        '파일 이름 변경',
                                                        '새 파일 이름을 입력하세요',
                                                        file.basename,
                                                        async (newName) => {
                                                            try {
                                                                const newPath = `${file.parent.path}/${newName}.md`;
                                                                await this.app.fileManager.renameFile(file, newPath);
                                                                new Notice(`✅ "${newName}"(으)로 변경했습니다!`);
                                                            } catch (e) {
                                                                new Notice('❌ 이름 변경 실패');
                                                                console.error(e);
                                                            }
                                                        }
                                                    ).open();
                                                });
                                        });
                                        
                                        // 복제
                                        subMenu.addItem((subItem) => {
                                            subItem.setTitle('📋 복제')
                                                .setIcon('copy')
                                                .onClick(async () => {
                                                    try {
                                                        const content = await this.app.vault.read(file);
                                                        const newName = `${file.basename} - 복사본`;
                                                        const newPath = `${file.parent.path}/${newName}.md`;
                                                        await this.app.vault.create(newPath, content);
                                                        new Notice(`✅ "${newName}" 생성 완료!`);
                                                    } catch (e) {
                                                        new Notice('❌ 복제 실패');
                                                        console.error(e);
                                                    }
                                                });
                                        });
                                        
                                        subMenu.addSeparator();
                                        
                                        // 삭제
                                        subMenu.addItem((subItem) => {
                                            subItem.setTitle('🗑️ 삭제')
                                                .setIcon('trash')
                                                .onClick(async () => {
                                                    const confirmDelete = confirm(`"${file.basename}" 파일을 정말 삭제하시겠습니까?`);
                                                    if (confirmDelete) {
                                                        try {
                                                            await this.app.vault.delete(file);
                                                            new Notice(`✅ "${file.basename}" 삭제 완료`);
                                                        } catch (e) {
                                                            new Notice('❌ 삭제 실패');
                                                            console.error(e);
                                                        }
                                                    }
                                                });
                                        });
                                        
                                        subMenu.showAtMouseEvent(evt);
                                    });
                            });
                        });
                        
                        filesMenu.showAtMouseEvent(e);
                    });
            });
            
            menu.addSeparator();
            
            // 새 노트 추가
            menu.addItem((item) => {
                item.setTitle('➕ 새 퀴즈 추가')
                    .setIcon('file-plus')
                    .onClick(async () => {
                        const folderPath = this.currentFolder || this.plugin.settings.clozeFolder;
                        const fileName = `새 퀴즈 ${Date.now()}.md`;
                        const filePath = `${folderPath}/${fileName}`;
                        
                        try {
                            const newFile = await this.app.vault.create(filePath, '# 새 퀴즈\n\n');
                            new Notice('✅ 새 노트가 생성되었습니다!');
                            
                            // 바로 편집 모드로 열기
                            const leaf = this.app.workspace.getLeaf('tab');
                            await leaf.openFile(newFile);
                        } catch (e) {
                            new Notice('❌ 노트 생성 실패');
                        }
                    });
            });
            
            // 이미지 빈칸 추가
            menu.addItem((item) => {
                item.setTitle('🖼️ 이미지 빈칸 추가')
                    .setIcon('image-plus')
                    .onClick(() => {
                        // 이미지 입력 모달 열기
                        new ImageClozeModal(this.app, this.plugin, this.currentFile, async () => {
                            // 노트 새로고침
                            if (this.currentFile) {
                                const leaf = this.app.workspace.getLeaf();
                                await leaf.openFile(this.currentFile);
                            }
                        }).open();
                    });
            });
            
            // 새 폴더 추가
            menu.addItem((item) => {
                item.setTitle('➕ 새 폴더 추가')
                    .setIcon('folder-plus')
                    .onClick(() => {
                        new TextInputModal(
                            this.app,
                            '새 폴더 추가',
                            '폴더 이름을 입력하세요',
                            '',
                            async (folderName) => {
                                const clozeFolder = this.plugin.settings.clozeFolder;
                                const newFolderPath = `${clozeFolder}/${folderName}`;
                                
                                try {
                                    const existingFolder = this.app.vault.getAbstractFileByPath(newFolderPath);
                                    if (existingFolder) {
                                        new Notice('❌ 이미 존재하는 폴더입니다.');
                                        return;
                                    }
                                    
                                    await this.app.vault.createFolder(newFolderPath);
                                    new Notice(`✅ "${folderName}" 폴더가 생성되었습니다!`);
                                    
                                    // 설정에도 추가
                                    if (!this.plugin.settings.clozeFolders.includes(folderName)) {
                                        this.plugin.settings.clozeFolders.push(folderName);
                                        await this.plugin.saveSettings();
                                    }
                                } catch (e) {
                                    if (e.message.includes('already exists')) {
                                        new Notice('❌ 폴더가 이미 존재합니다.');
                                    } else {
                                        new Notice('❌ 폴더 생성 실패');
                                        console.error(e);
                                    }
                                }
                            }
                        ).open();
                    });
            });
            
            menu.showAtMouseEvent(e);
        };
        
        // 📁 폴더 이동 버튼
        const folderBtn = topButtons.createEl('button');
        folderBtn.innerHTML = '📁';
        folderBtn.setAttribute('aria-label', '폴더 이동');
        folderBtn.style.cssText = 'flex:1; min-width:44px; min-height:44px; font-size:22px; display:flex; align-items:center; justify-content:center;';
        const folderBtnHandler = async (e) => {
            if (!this.currentFile) return;
            
            const menu = new Menu();
            const clozeFolder = this.plugin.settings.clozeFolder;
            const currentFolder = this.currentFile.parent.path; // 현재 파일이 속한 폴더
            
            // 북마크 폴더 추가
            const bookmarkFolderPath = this.plugin.settings.bookmarkFolder || '⭐ 북마크 목록';
            
            // clozeFolder 하위의 모든 폴더 표시 (빈 폴더 포함)
            const folders = this.app.vault.getAllLoadedFiles()
                .filter(f => f instanceof TFolder)
                .filter(f => f.path.startsWith(clozeFolder))
                .map(f => f.path)
                .sort();
            
            // 북마크 폴더를 최상단에 추가 (가상 폴더)
            const allFolders = [bookmarkFolderPath, ...folders];
            
            if (allFolders.length === 0) {
                new Notice('❌ 이동 가능한 폴더가 없습니다.');
                return;
            }
            
            allFolders.forEach(folderPath => {
                menu.addItem((item) => {
                    const isBookmarkFolder = folderPath === bookmarkFolderPath;
                    const displayName = isBookmarkFolder 
                        ? '⭐ 북마크' 
                        : folderPath.replace(clozeFolder + '/', '') || clozeFolder;
                    const isCurrentFolder = folderPath === currentFolder;
                    
                    // 폴더 내 파일 개수 표시
                    let fileCount;
                    if (isBookmarkFolder) {
                        fileCount = this.plugin.settings.bookmarks?.length || 0;
                    } else {
                        fileCount = this.app.vault.getAllLoadedFiles()
                            .filter(file => file.path.startsWith(folderPath) && file.path.endsWith('.md')).length;
                    }
                    
                    // 현재 폴더면 체크 표시 추가
                    const title = isCurrentFolder 
                        ? `✓ 📁 ${displayName} (${fileCount}개)` 
                        : `📁 ${displayName} (${fileCount}개)`;
                    
                    item.setTitle(title)
                        .setIcon(isCurrentFolder ? 'check' : 'folder')
                        .onClick(async () => {
                            if (isBookmarkFolder) {
                                // 북마크에 추가
                                const cardNumber = this.plugin.getCurrentCardNumber();
                                if (this.plugin.isBookmarked(this.currentFile.path, cardNumber)) {
                                    new Notice('이미 북마크에 있습니다.');
                                } else {
                                    await this.plugin.addBookmark(this.currentFile.path, cardNumber);
                                    new Notice('✅ 북마크에 추가했습니다!');
                                }
                                return;
                            }
                            
                            if (isCurrentFolder) {
                                new Notice('이미 현재 폴더에 있습니다.');
                                return;
                            }
                            
                            try {
                                const newPath = `${folderPath}/${this.currentFile.name}`;
                                await this.app.fileManager.renameFile(this.currentFile, newPath);
                                new Notice(`✅ "${displayName}"로 이동했습니다!`);
                                this.currentFolder = folderPath;
                            } catch (e) {
                                new Notice('❌ 파일 이동 실패');
                                console.error(e);
                            }
                        });
                });
            });
            
            menu.showAtMouseEvent(e);
        };
        folderBtn.onclick = folderBtnHandler;
        folderBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            folderBtnHandler(e);
        });
        
        // 🗑️ 삭제 버튼
        const deleteBtn = topButtons.createEl('button');
        deleteBtn.innerHTML = '🗑️';
        deleteBtn.setAttribute('aria-label', '삭제');
        deleteBtn.style.cssText = 'flex:1; min-width:44px; min-height:44px; font-size:22px; display:flex; align-items:center; justify-content:center; background:var(--background-modifier-error);';
        const deleteBtnHandler = async () => {
            if (!this.currentFile) return;
            
            const fileName = this.currentFile.basename;
            const confirmDelete = confirm(`"${fileName}" 노트를 정말 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`);
            
            if (confirmDelete) {
                try {
                    await this.app.vault.delete(this.currentFile);
                    new Notice(`✅ "${fileName}" 삭제 완료`);
                    
                    // 다음 노트로 이동
                    this.notes = this.notes.filter(n => n !== this.currentFile);
                    if (this.currentNoteIndex >= this.notes.length) {
                        this.currentNoteIndex = 0;
                    }
                    
                    const progress = this.contentEl.querySelector('.quiz-progress');
                    if (progress) {
                        progress.textContent = `${this.currentNoteIndex + 1} / ${this.notes.length}`;
                    }
                    
                    if (this.notes.length === 0) {
                        this.close();
                        new Notice('모든 노트가 삭제되었습니다.');
                    } else {
                        await this.displayCurrentNote(this.contentContainer);
                    }
                } catch (e) {
                    new Notice('❌ 삭제 실패');
                    console.error('삭제 오류:', e);
                }
            }
        };
        deleteBtn.onclick = deleteBtnHandler;
        deleteBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            deleteBtnHandler();
        });
        
        // ⚙️ 메뉴 버튼 (설정 + 북마크)
        const settingsBtn = topButtons.createEl('button');
        settingsBtn.innerHTML = '⚙️';
        settingsBtn.setAttribute('aria-label', '메뉴');
        settingsBtn.style.cssText = 'flex:1; min-width:44px; min-height:44px; font-size:22px; display:flex; align-items:center; justify-content:center;';
        const settingsBtnHandler = (e) => {
            const menu = new Menu();
            
            // 북마크 목록
            menu.addItem((item) => {
                item.setTitle('⭐ 북마크 목록')
                    .setIcon('star')
                    .onClick(() => {
                        new BookmarkListModal(this.app, this.plugin).open();
                    });
            });
            
            // 북마크 퀴즈
            menu.addItem((item) => {
                const bookmarkCount = this.plugin.settings.bookmarks.length;
                item.setTitle(`📚 북마크 퀴즈 (${bookmarkCount}개)`)
                    .setIcon('book-open')
                    .onClick(() => {
                        if (bookmarkCount === 0) {
                            new Notice('북마크된 카드가 없습니다');
                            return;
                        }
                        new BookmarkQuizModal(this.app, this.plugin).open();
                        this.close();
                    });
            });
            
            menu.addSeparator();
            
            // 북마크 내보내기
            menu.addItem((item) => {
                item.setTitle('📤 북마크 내보내기')
                    .setIcon('download')
                    .onClick(() => {
                        this.plugin.exportBookmarks();
                    });
            });
            
            // 북마크 가져오기
            menu.addItem((item) => {
                item.setTitle('📥 북마크 가져오기')
                    .setIcon('upload')
                    .onClick(async () => {
                        const input = prompt('북마크 JSON 데이터를 붙여넣으세요:');
                        if (input) {
                            await this.plugin.importBookmarks(input);
                        }
                    });
            });
            
            menu.addSeparator();
            
            // 설정
            menu.addItem((item) => {
                item.setTitle('⚙️ 플러그인 설정')
                    .setIcon('settings')
                    .onClick(() => {
                        this.app.setting.open();
                        this.app.setting.openTabById('enhanced-cloze');
                    });
            });
            
            menu.showAtMouseEvent(e);
        };
        settingsBtn.onclick = settingsBtnHandler;
        settingsBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            settingsBtnHandler(e);
        });
        
        // 📝 편집
        const editBtn = topButtons.createEl('button');
        editBtn.innerHTML = '📝';
        editBtn.setAttribute('aria-label', '편집');
        editBtn.style.cssText = 'flex:1; min-width:44px; min-height:44px; font-size:22px; display:flex; align-items:center; justify-content:center;';
        const editBtnHandler = async (e) => {
            if (!this.currentFile) return;
            
            const menu = new Menu();
            
            // 노트 편집
            menu.addItem((item) => {
                item.setTitle('✏️ 노트 전체 편집')
                    .setIcon('pencil')
                    .onClick(async () => {
                        new QuizEditModal(this.app, this.plugin, this.currentFile, async () => {
                            await this.displayCurrentNote(this.contentContainer);
                        }).open();
                    });
            });
            
            // .md 파일에서 직접 수정
            menu.addItem((item) => {
                item.setTitle('📄 .md 파일에서 수정')
                    .setIcon('file-edit')
                    .onClick(async () => {
                        // 새 탭에서 파일 열기
                        const leaf = this.app.workspace.getLeaf('tab');
                        await leaf.openFile(this.currentFile);
                        new Notice('✅ 편집 모드로 파일을 열었습니다');
                        // 퀴즈 모달은 유지 (사용자가 직접 닫을 수 있음)
                    });
            });
            
            menu.addSeparator();
            
            // 선택 영역 복사
            menu.addItem((item) => {
                item.setTitle('📋 선택 영역 복사 (Ctrl+C)')
                    .setIcon('copy')
                    .onClick(() => {
                        const selection = window.getSelection();
                        if (selection && selection.toString().length > 0) {
                            navigator.clipboard.writeText(selection.toString());
                            new Notice('✅ 복사 완료!');
                        } else {
                            new Notice('⚠️ 선택된 텍스트가 없습니다');
                        }
                    });
            });
            
            // 전체 내용 복사
            menu.addItem((item) => {
                item.setTitle('📄 전체 내용 복사')
                    .setIcon('clipboard-copy')
                    .onClick(async () => {
                        const fullContent = await this.app.vault.read(this.currentFile);
                        navigator.clipboard.writeText(fullContent);
                        new Notice('✅ 전체 내용 복사 완료!');
                    });
            });
            
            menu.addSeparator();
            
            // 새 퀴즈 추가
            menu.addItem((item) => {
                item.setTitle('➕ 빈칸 추가')
                    .setIcon('plus')
                    .onClick(() => {
                        new TextInputModal(
                            this.app,
                            '빈칸 추가',
                            '퀴즈로 만들 텍스트를 입력하세요',
                            '',
                            async (text) => {
                                if (!text) return;
                                const content = await this.app.vault.read(this.currentFile);
                                const newCloze = `\n\n{{c1::${text}}}`;
                                await this.app.vault.modify(this.currentFile, content + newCloze);
                                new Notice('✅ 빈칸 추가 완료!');
                                await this.displayCurrentNote(this.contentContainer);
                            }
                        ).open();
                    });
            });
            
            // 이미지 빈칸 추가
            menu.addItem((item) => {
                item.setTitle('🖼️ 이미지 빈칸 추가')
                    .setIcon('image-plus')
                    .onClick(() => {
                        new ImageClozeModal(this.app, this.plugin, this.currentFile, async () => {
                            await this.displayCurrentNote(this.contentContainer);
                        }).open();
                    });
            });
            
            menu.addSeparator();
            
            // 새 탭에서 열기
            menu.addItem((item) => {
                item.setTitle('🔗 새 탭에서 열기')
                    .setIcon('external-link')
                    .onClick(async () => {
                        const leaf = this.app.workspace.getLeaf('tab');
                        await leaf.openFile(this.currentFile);
                        new Notice('✅ 새 탭에서 열었습니다');
                    });
            });
            
            // 파일 위치 표시
            menu.addItem((item) => {
                item.setTitle(`📍 위치: ${this.currentFile.path}`)
                    .setIcon('folder')
                    .onClick(() => {
                        navigator.clipboard.writeText(this.currentFile.path);
                        new Notice('✅ 파일 경로 복사 완료!');
                    });
            });
            
            menu.showAtMouseEvent(e);
        };
        editBtn.onclick = editBtnHandler;
        editBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            editBtnHandler(e);
        });
        
        // ❌ 종료
        const closeBtn = topButtons.createEl('button');
        closeBtn.innerHTML = '❌';
        closeBtn.setAttribute('aria-label', '종료');
        closeBtn.style.cssText = 'flex:1; min-width:44px; min-height:44px; font-size:22px; display:flex; align-items:center; justify-content:center; background:var(--background-modifier-error);color:white;';
        const closeBtnHandler = () => this.close();
        closeBtn.onclick = closeBtnHandler;
        closeBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            closeBtnHandler();
        });
        
        // 타이머/진행률/북마크 정보 바 (컨트롤 바와 분리)
        const infoBar = contentEl.createDiv({ cls: 'quiz-info-bar' });
        infoBar.style.cssText = `
            display: flex;
            gap: 16px;
            padding: 12px 16px;
            background: var(--background-primary-alt);
            border-bottom: 2px solid var(--background-modifier-border);
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
        `;
        
        // 진행률 (왼쪽)
        const progressDiv = infoBar.createDiv({ cls: 'quiz-progress' });
        progressDiv.style.cssText = 'font-size: 16px; font-weight: 600; color: var(--text-normal); padding: 6px 12px; background: var(--background-secondary); border-radius: 8px;';
        progressDiv.textContent = `1 / ${this.questions.length}`;
        this.progressDiv = progressDiv;
        
        // 타이머 (중앙)
        const timerDiv = infoBar.createDiv({ cls: 'quiz-timer' });
        timerDiv.style.cssText = 'font-size: 24px; font-weight: bold; color: var(--interactive-accent); flex: 1; text-align: center;';
        const initialDuration = this.plugin.getTimerDuration();
        const minutes = Math.floor(initialDuration / 60);
        const seconds = Math.floor(initialDuration % 60);
        timerDiv.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        this.timerDiv = timerDiv;
        
        // 북마크 체크박스 (오른쪽)
        this.headerBookmarkContainer = infoBar.createDiv({ cls: 'quiz-header-bookmark' });
        this.headerBookmarkContainer.style.cssText = 'display: flex; align-items: center; gap: 6px; font-size: 14px; padding: 6px 12px; background: var(--background-secondary); border-radius: 8px;';
        
        const headerCheckbox = this.headerBookmarkContainer.createEl('input', { type: 'checkbox' });
        headerCheckbox.id = 'quiz-header-bookmark-check';
        headerCheckbox.style.cssText = 'width: 16px; height: 16px; cursor: pointer;';
        
        const headerLabel = this.headerBookmarkContainer.createEl('label');
        headerLabel.htmlFor = 'quiz-header-bookmark-check';
        headerLabel.textContent = '⭐ 북마크';
        headerLabel.style.cssText = 'cursor: pointer; user-select: none;';
        
        this.headerBookmarkCheckbox = headerCheckbox;
        
        const content = contentEl.createDiv({ cls: 'quiz-content' });
        content.style.cssText = 'flex: 1; overflow-y: auto; padding: 20px;';
        this.contentContainer = content;
        // 하단(footer)에는 이전/일시정지/다음/다시풀기만 아이콘으로 배치
        const footer = contentEl.createDiv({ cls: 'quiz-footer' });
        footer.style.cssText = `
            padding: 16px;
            background: var(--background-secondary);
            border-top: 1px solid var(--background-modifier-border);
            display: flex;
            gap: 8px;
            justify-content: space-between;
            align-items: stretch;
            position: sticky;
            bottom: 0;
            z-index: 10;
        `;
        // 버튼 생성 함수 (아이콘만)
        const makeBtn = (icon, aria, style, onClick) => {
            const btn = footer.createEl('button');
            btn.innerHTML = icon;
            btn.setAttribute('aria-label', aria);
            btn.style.cssText = style + 'flex:1; min-width:44px; min-height:44px; font-size:22px; display:flex; align-items:center; justify-content:center;';
            btn.onclick = onClick;
            btn.addEventListener('touchend', (e) => { e.preventDefault(); onClick(); });
            return btn;
        };
        // 모바일 특화 스타일 제거 (원래대로)
        const oldMobileStyle = document.getElementById('quiz-footer-mobile-style');
        if (oldMobileStyle) oldMobileStyle.remove();
        // ◀️ 이전
        makeBtn('◀️', '이전', '', () => this.previousNote());
        // ⏸️ 일시정지
        this.pauseBtn = makeBtn('⏸️', '일시정지', 'background:var(--background-modifier-border);', () => this.togglePause());
        // 📁 폴더
        makeBtn('📁', '폴더', '', (e) => {
            const menu = new Menu();
            
            // 현재 폴더 표시
            menu.addItem((item) => {
                item.setTitle(`현재: ${this.currentFolderName || '전체'}`)
                    .setIcon('folder')
                    .setDisabled(true);
            });
            
            menu.addSeparator();
            
            // 폴더 목록
            const clozeFolder = this.plugin.settings.clozeFolder;
            const folder = this.app.vault.getAbstractFileByPath(clozeFolder);
            
            if (folder && folder.children) {
                const folders = folder.children.filter(f => f.children);
                
                folders.forEach(f => {
                    menu.addItem((item) => {
                        const isCurrentFolder = f.path === this.currentFolder;
                        item.setTitle((isCurrentFolder ? '✓ ' : '') + f.name)
                            .setIcon('folder')
                            .onClick(async () => {
                                this.folderPath = f.path;
                                this.currentFolder = f.path;
                                this.currentFolderName = f.name;
                                this.currentNoteIndex = 0;
                                await this.loadNotes();
                                if (this.notes.length > 0) {
                                    await this.loadNote(this.notes[0]);
                                    new Notice(`📁 ${f.name} 폴더로 이동`);
                                } else {
                                    new Notice(`⚠️ ${f.name} 폴더에 파일이 없습니다`);
                                }
                            });
                    });
                });
            }
            
            menu.showAtMouseEvent(e);
        });
        // ✏️ 편집
        makeBtn('✏️', '편집', '', () => {
            if (this.currentFile) {
                const optionModal = new Modal(this.app);
                optionModal.titleEl.setText('✏️ 편집 옵션');
                
                const { contentEl: modalContent } = optionModal;
                modalContent.style.padding = '20px';
                modalContent.style.minWidth = '300px';
                
                modalContent.createEl('p', { 
                    text: '어떻게 편집하시겠습니까?',
                }).style.marginBottom = '20px';
                
                const btnContainer = modalContent.createDiv();
                btnContainer.style.display = 'flex';
                btnContainer.style.flexDirection = 'column';
                btnContainer.style.gap = '10px';
                
                const fileEditBtn = btnContainer.createEl('button', {
                    text: '📄 MD 파일에서 편집',
                    cls: 'mod-cta'
                });
                fileEditBtn.style.padding = '12px';
                fileEditBtn.onclick = async () => {
                    optionModal.close();
                    const leaf = this.app.workspace.getLeaf('tab');
                    await leaf.openFile(this.currentFile);
                    new Notice('✏️ 편집 모드로 전환');
                };
                
                const cancelBtn = btnContainer.createEl('button', {
                    text: '❌ 취소'
                });
                cancelBtn.style.padding = '12px';
                cancelBtn.onclick = () => optionModal.close();
                
                optionModal.open();
            }
        });
        // 🗑️ 삭제
        makeBtn('🗑️', '삭제', 'background:var(--background-modifier-error);color:white;', () => {
            if (this.currentFile) {
                const confirmDelete = confirm(`"${this.currentFile.basename}" 파일을 정말 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`);
                if (confirmDelete) {
                    this.app.vault.delete(this.currentFile).then(() => {
                        new Notice(`✅ "${this.currentFile.basename}" 삭제 완료`);
                        
                        // 파일 목록에서 제거
                        this.notes.splice(this.currentNoteIndex, 1);
                        
                        // 모든 파일이 삭제되면 닫기
                        if (this.notes.length === 0) {
                            this.close();
                            if (this.plugin.openClozeDashboardView) {
                                this.plugin.openClozeDashboardView();
                            }
                            return;
                        }
                        
                        // 인덱스 조정
                        if (this.currentNoteIndex >= this.notes.length) {
                            this.currentNoteIndex = this.notes.length - 1;
                        }
                        
                        this.loadNote(this.notes[this.currentNoteIndex]);
                    }).catch(error => {
                        new Notice('❌ 삭제 실패: ' + error.message);
                    });
                }
            }
        });
        // 💡 정답 보기 (모든 빈칸 뒤집기 + 정답 처리 확인)
        makeBtn('💡', '정답 보기', 'background:#10b981;color:white;', () => {
            const clozes = this.contentContainer.querySelectorAll('.genuine-cloze, .pseudo-cloze, .image-cloze');
            let revealedCount = 0;
            
            clozes.forEach(cloze => {
                const currentState = cloze.getAttribute('data-show-state');
                if (currentState === 'hint') {
                    revealedCount++;
                    // 이미지 빈칸 여부 확인
                    const isImageCloze = cloze.classList.contains('image-cloze');
                    let imgElement = null;
                    if (isImageCloze) {
                        // 바로 앞에 있는 img 태그를 찾음 (빈칸 바로 앞에 이미지가 위치)
                        if (cloze.previousElementSibling && cloze.previousElementSibling.tagName === 'IMG') {
                            imgElement = cloze.previousElementSibling;
                        } else {
                            // 혹시 구조가 다를 경우, 부모에서 img를 찾음
                            imgElement = cloze.parentNode.querySelector('img');
                        }
                        if (imgElement) {
                            imgElement.style.display = 'block';
                            cloze.style.color = 'transparent';
                            cloze.textContent = '';
                        }
                    } else {
                        // 일반 텍스트 빈칸
                        const answer = cloze.getAttribute('data-answer');
                        if (answer) {
                            cloze.textContent = answer;
                        }
                    }
                    cloze.setAttribute('data-show-state', 'answer');
                }
            });
            
            if (revealedCount > 0) {
                new Notice(`✅ ${revealedCount}개의 정답을 공개했습니다!`);
                
                // 정답 처리 확인 모달
                const modal = new Modal(this.app);
                modal.titleEl.setText('정답 처리');
                
                const content = modal.contentEl;
                content.style.textAlign = 'center';
                content.createEl('p', { 
                    text: '이 문제를 정답으로 처리하시겠습니까?',
                    attr: { style: 'font-size: 16px; margin: 20px 0;' }
                });
                content.createEl('p', { 
                    text: `공개된 빈칸: ${revealedCount}개`,
                    attr: { style: 'color: var(--text-muted); margin-bottom: 20px;' }
                });
                
                const btnContainer = content.createDiv();
                btnContainer.style.cssText = 'display: flex; gap: 12px; justify-content: center;';
                
                const correctBtn = btnContainer.createEl('button', { text: '✅ 정답 처리' });
                correctBtn.style.cssText = 'background: #10b981; color: white; padding: 12px 24px; border: none; border-radius: 8px; cursor: pointer; font-size: 15px; min-width: 44px; min-height: 44px;';
                correctBtn.onclick = async () => {
                    await this.recordCurrentCardStudy(true);
                    new Notice('✅ 정답으로 처리되었습니다!');
                    modal.close();
                };
                correctBtn.addEventListener('touchend', async (e) => {
                    e.preventDefault();
                    await this.recordCurrentCardStudy(true);
                    new Notice('✅ 정답으로 처리되었습니다!');
                    modal.close();
                });
                
                const wrongBtn = btnContainer.createEl('button', { text: '❌ 오답 처리' });
                wrongBtn.style.cssText = 'background: #ef4444; color: white; padding: 12px 24px; border: none; border-radius: 8px; cursor: pointer; font-size: 15px; min-width: 44px; min-height: 44px;';
                wrongBtn.onclick = async () => {
                    await this.recordCurrentCardStudy(false);
                    new Notice('❌ 오답으로 처리되었습니다!');
                    modal.close();
                };
                wrongBtn.addEventListener('touchend', async (e) => {
                    e.preventDefault();
                    await this.recordCurrentCardStudy(false);
                    new Notice('❌ 오답으로 처리되었습니다!');
                    modal.close();
                });
                
                const cancelBtn = btnContainer.createEl('button', { text: '취소' });
                cancelBtn.style.cssText = 'background: var(--background-secondary); padding: 12px 24px; border: none; border-radius: 8px; cursor: pointer; font-size: 15px; min-width: 44px; min-height: 44px;';
                cancelBtn.onclick = () => modal.close();
                cancelBtn.addEventListener('touchend', (e) => {
                    e.preventDefault();
                    modal.close();
                });
                
                modal.open();
            } else {
                new Notice('ℹ️ 공개할 빈칸이 없습니다.');
            }
        });
        // ▶️ 다음
        makeBtn('▶️', '다음', 'background:var(--interactive-accent);color:var(--text-on-accent);', () => this.nextNote());
        // 🔄 다시풀기
        makeBtn('🔄', '다시풀기', 'background:var(--interactive-accent);color:var(--text-on-accent);', async () => {
            if (this.timer) clearInterval(this.timer);
            const timerDuration = this.plugin.getTimerDuration();
            this.totalTime = timerDuration;
            this.remainingTime = timerDuration;
            this.startTime = Date.now();
            this.timerExpired = false;
            if (this.timerDiv) {
                const minutes = Math.floor(timerDuration / 60);
                const seconds = Math.floor(timerDuration % 60);
                this.timerDiv.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
                this.timerDiv.style.color = 'var(--interactive-accent)';
            }
            const content = this.contentEl.querySelector('.quiz-content');
            await this.displayCurrentNote(content);
            this.stopwatchPaused = false;
            this.timer = setInterval(() => {
                if (!this.stopwatchPaused) {
                    const elapsed = (Date.now() - this.startTime) / 1000;
                    this.remainingTime = Math.max(0, this.totalTime - elapsed);
                }
                const minutes = Math.floor(this.remainingTime / 60);
                const seconds = Math.floor(this.remainingTime % 60);
                if (this.timerDiv) {
                    this.timerDiv.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
                }
                if (this.remainingTime <= this.plugin.settings.timerWarningThreshold && this.remainingTime > 0) {
                    this.timerDiv.style.color = '#f59e0b';
                }
                if (this.remainingTime <= 0 && !this.timerExpired) {
                    this.timerExpired = true;
                    this.timerDiv.style.color = '#dc2626';
                    this.timerDiv.textContent = '⏰ 시간 종료!';
                    if (this.plugin.settings.enableVibration && navigator.vibrate) {
                        try { navigator.vibrate([300, 100, 300]); } catch (e) {}
                    }
                    new Notice('⏰ 시간이 종료되었습니다!');
                    if (this.plugin.settings.enableAutoRevealOnTimeout) {
                        const clozes = this.contentContainer.querySelectorAll('.genuine-cloze[data-show-state="hint"], .pseudo-cloze[data-show-state="hint"]');
                        clozes.forEach(cloze => {
                            const answer = cloze.getAttribute('data-answer');
                            if (answer) {
                                cloze.textContent = answer;
                                cloze.setAttribute('data-show-state', 'answer');
                                cloze.style.background = '#10b981';
                                cloze.style.color = 'white';
                            }
                        });
                        if (clozes.length > 0) {
                            new Notice(`✅ ${clozes.length}개의 빈칸이 자동으로 공개되었습니다`);
                        }
                    }
                }
            }, 200);
        });
        // 타이머 시작 (카운트다운)
        const timerDuration = this.plugin.getTimerDuration();
        this.totalTime = timerDuration;
        this.remainingTime = timerDuration;
        this.startTime = Date.now();
        // 세션 시작 시간은 처음 한 번만 설정
        if (!this.sessionStartTime) {
            this.sessionStartTime = Date.now();
        }
        this.stopwatchPaused = false;
        this.timerExpired = false;
        this.timer = setInterval(() => {
            if (!this.stopwatchPaused) {
                const elapsed = (Date.now() - this.startTime) / 1000;
                this.remainingTime = Math.max(0, this.totalTime - elapsed);
            }
            const minutes = Math.floor(this.remainingTime / 60);
            const seconds = Math.floor(this.remainingTime % 60);
            this.timerDiv.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            
            // 경고 임계값
            if (this.remainingTime <= this.plugin.settings.timerWarningThreshold && this.remainingTime > 0) {
                this.timerDiv.style.color = '#f59e0b';
            }
            
            // 시간 종료
            if (this.remainingTime <= 0 && !this.timerExpired) {
                this.timerExpired = true;
                this.timerDiv.style.color = '#dc2626';
                this.timerDiv.textContent = '⏰ 시간 종료!';
                
                // 진동 피드백
                if (this.plugin.settings.enableVibration && navigator.vibrate) {
                    try {
                        navigator.vibrate([300, 100, 300]);
                    } catch (e) {}
                }
                
                new Notice('⏰ 시간이 종료되었습니다!');
                
                // 자동으로 빈칸 공개
                if (this.plugin.settings.enableAutoRevealOnTimeout) {
                    const clozes = this.contentContainer.querySelectorAll('.genuine-cloze[data-show-state="hint"], .pseudo-cloze[data-show-state="hint"]');
                    clozes.forEach(cloze => {
                        const answer = cloze.getAttribute('data-answer');
                        if (answer) {
                            cloze.textContent = answer;
                            cloze.setAttribute('data-show-state', 'answer');
                            cloze.style.background = '#10b981';
                            cloze.style.color = 'white';
                        }
                    });
                    if (clozes.length > 0) {
                        new Notice(`✅ ${clozes.length}개의 빈칸이 자동으로 공개되었습니다`);
                    }
                }
            }
        }, 200);
        await this.displayCurrentNote(content);
    }

    togglePause() {
        this.stopwatchPaused = !this.stopwatchPaused;
        if (this.stopwatchPaused) {
            this.pauseBtn.innerHTML = '▶️';
        } else {
            this.startTime = Date.now() - (this.totalTime - this.remainingTime) * 1000;
            this.pauseBtn.innerHTML = '⏸️';
        }
    }

    async loadNotes() {
        const folder = this.folderPath || `${this.plugin.settings.clozeFolder}/${this.plugin.settings.questionSubFolder || 'Questions'}`;
        
        const folderFile = this.app.vault.getAbstractFileByPath(folder);
        if (!folderFile) {
            new Notice(`❌ 폴더를 찾을 수 없습니다: ${folder}`);
            return;
        }
        
        if (!folderFile.children) {
            new Notice(`⚠️ "${folderFile.name}" 폴더가 비어있습니다`);
            return;
        }
        
        const findMarkdownFiles = (folder) => {
            let files = [];
            for (const child of folder.children) {
                if (child.extension === 'md') {
                    files.push(child);
                } else if (child.children) {
                    files = files.concat(findMarkdownFiles(child));
                }
            }
            return files;
        };
        
        this.notes = findMarkdownFiles(folderFile);
        
        if (this.notes.length === 0) {
            new Notice(`⚠️ "${folderFile.name}" 폴더에 마크다운 파일이 없습니다`);
        }
        
        this.notes.sort(() => Math.random() - 0.5);
    }

    async displayCurrentNote(container) {
        container.empty();
        if (this.currentNoteIndex >= this.notes.length) {
            const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
            container.createEl('h2', { text: '🎉 퀴즈 완료!' });
            container.createEl('p', { text: `폴더: ${this.currentFolderName}` });
            container.createEl('p', { text: `모든 노트를 완료했습니다!` });
            container.createEl('p', { text: `소요 시간: ${Math.floor(elapsed / 60)}분 ${elapsed % 60}초` });

            // 버튼 컨테이너 (모바일 대응)
            const btnContainer = container.createDiv({ cls: 'quiz-complete-btns' });
            btnContainer.style.cssText = 'display: flex; gap: 16px; margin-top: 32px; justify-content: center;';

            // 대시보드로 돌아가기 버튼
            const dashboardBtn = btnContainer.createEl('button', { text: '📊 대시보드로 돌아가기', cls: 'mod-cta' });
            dashboardBtn.style.cssText = 'padding: 12px 24px; font-size: 1.1em;';
            dashboardBtn.onclick = () => {
                this.close();
            };

            // 다시 시작하기 버튼
            const restartBtn = btnContainer.createEl('button', { text: '🔄 다시 시작하기' });
            restartBtn.style.cssText = 'padding: 12px 24px; font-size: 1.1em;';
            restartBtn.onclick = async () => {
                this.currentNoteIndex = 0;
                if (this.timer) clearInterval(this.timer);
                const timerDuration = this.plugin.getTimerDuration();
                this.totalTime = timerDuration;
                this.remainingTime = timerDuration;
                this.startTime = Date.now();
                this.timerExpired = false;
                if (this.timerDiv) {
                    const minutes = Math.floor(timerDuration / 60);
                    const seconds = Math.floor(timerDuration % 60);
                    this.timerDiv.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
                    this.timerDiv.style.color = 'var(--interactive-accent)';
                }
                this.timer = setInterval(() => {
                    if (!this.stopwatchPaused) {
                        const elapsed = (Date.now() - this.startTime) / 1000;
                        this.remainingTime = Math.max(0, this.totalTime - elapsed);
                    }
                    const minutes = Math.floor(this.remainingTime / 60);
                    const seconds = Math.floor(this.remainingTime % 60);
                    if (this.timerDiv) {
                        this.timerDiv.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
                    }
                    if (this.remainingTime <= this.plugin.settings.timerWarningThreshold && this.remainingTime > 0) {
                        this.timerDiv.style.color = '#f59e0b';
                    }
                    if (this.remainingTime <= 0 && !this.timerExpired) {
                        this.timerExpired = true;
                        this.timerDiv.style.color = '#dc2626';
                        this.timerDiv.textContent = '⏰ 시간 종료!';
                        if (this.plugin.settings.enableVibration && navigator.vibrate) {
                            try { navigator.vibrate([300, 100, 300]); } catch (e) {}
                        }
                        new Notice('⏰ 시간이 종료되었습니다!');
                        if (this.plugin.settings.enableAutoRevealOnTimeout) {
                            const clozes = this.contentContainer.querySelectorAll('.genuine-cloze[data-show-state="hint"], .pseudo-cloze[data-show-state="hint"]');
                            clozes.forEach(cloze => {
                                const answer = cloze.getAttribute('data-answer');
                                if (answer) {
                                    cloze.textContent = answer;
                                    cloze.setAttribute('data-show-state', 'answer');
                                    cloze.style.background = '#10b981';
                                    cloze.style.color = 'white';
                                }
                            });
                            if (clozes.length > 0) {
                                new Notice(`✅ ${clozes.length}개의 빈칸이 자동으로 공개되었습니다`);
                            }
                        }
                    }
                }, 200);
                await this.displayCurrentNote(container);
                const progress = this.contentEl.querySelector('.quiz-progress');
                if (progress) {
                    progress.textContent = `${this.currentNoteIndex + 1} / ${this.notes.length}`;
                }
                this.stopwatchPaused = false;
            };
            return;
        }
        const note = this.notes[this.currentNoteIndex];
        const content = await this.app.vault.read(note);
        this.currentFile = note;
        this.currentFolder = note.parent?.path || this.folderPath || this.plugin.settings.clozeFolder;
        this.currentFolderName = this.currentFolder ? this.currentFolder.split('/').pop() : 'root';
        // 카드명(노트명) 상단 표시 제거 (숨김)
        // container.createEl('h3', { text: note.basename });
        const contentDiv = container.createDiv({ cls: 'quiz-note-content' });
        contentDiv.style.cssText = 'line-height: 1.6; font-size: 16px; padding: 16px; background: var(--background-primary-alt); border-radius: 8px; margin-top: 12px; user-select: text; -webkit-user-select: text; -moz-user-select: text; -ms-user-select: text; position: relative;';
        
        // 헤더 북마크 체크박스 업데이트
        const isBookmarked = this.plugin.isBookmarked(note.path, this.plugin.getCurrentCardNumber());
        if (this.headerBookmarkCheckbox) {
            this.headerBookmarkCheckbox.checked = isBookmarked;
            
            // 기존 이벤트 리스너 제거를 위해 새로 생성
            const newCheckbox = this.headerBookmarkCheckbox.cloneNode(true);
            this.headerBookmarkCheckbox.parentNode.replaceChild(newCheckbox, this.headerBookmarkCheckbox);
            this.headerBookmarkCheckbox = newCheckbox;
            
            // 체크박스 변경 이벤트
            this.headerBookmarkCheckbox.addEventListener('change', async (e) => {
                e.stopPropagation();
                const cardNumber = this.plugin.getCurrentCardNumber();
                
                if (this.headerBookmarkCheckbox.checked) {
                    await this.plugin.addBookmark(note.path, cardNumber);
                } else {
                    await this.plugin.removeBookmark(note.path, cardNumber);
                }
            });
            
            // 라벨 클릭도 처리
            const headerLabel = this.headerBookmarkContainer.querySelector('label');
            if (headerLabel) {
                const newLabel = headerLabel.cloneNode(true);
                headerLabel.parentNode.replaceChild(newLabel, headerLabel);
                
                newLabel.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.headerBookmarkCheckbox.checked = !this.headerBookmarkCheckbox.checked;
                    this.headerBookmarkCheckbox.dispatchEvent(new Event('change'));
                });
            }
        }
        
        // 우클릭 컨텍스트 메뉴 활성화
        contentDiv.addEventListener('contextmenu', (e) => {
            // 기본 브라우저 컨텍스트 메뉴 허용 (복사/붙여넣기 등)
            // e.stopPropagation() 하지 않음
        });
        
        // 텍스트 선택 시 복사 기능 안내
        contentDiv.addEventListener('mouseup', () => {
            const selection = window.getSelection();
            if (selection && selection.toString().length > 0) {
                // 선택된 텍스트가 있을 때만 힌트 표시 (선택적)
                console.log('📋 텍스트 선택됨:', selection.toString());
            }
        });
        
        // 키보드 단축키 지원 (Ctrl+C, Ctrl+A 등)
        contentDiv.addEventListener('keydown', (e) => {
            // Ctrl+C: 복사
            if (e.ctrlKey && e.key === 'c') {
                const selection = window.getSelection();
                if (selection && selection.toString().length > 0) {
                    // 브라우저 기본 복사 동작 허용
                    console.log('📋 복사:', selection.toString());
                }
            }
            // Ctrl+A: 전체 선택
            if (e.ctrlKey && e.key === 'a') {
                e.preventDefault();
                const range = document.createRange();
                range.selectNodeContents(contentDiv);
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(range);
            }
        });
        
        // 탭 가능하도록 설정
        contentDiv.setAttribute('tabindex', '0');
        
        // 마크다운 렌더링
        const component = new Component();
        component.load();
        
        await MarkdownRenderer.render(this.app, content, contentDiv, note.path, component);
        
        // 이미지 로드 대기
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const images = contentDiv.querySelectorAll('img');
        if (images.length > 0) {
            await Promise.all(Array.from(images).map(img => {
                return new Promise((resolve) => {
                    if (img.complete) {
                        resolve();
                    } else {
                        img.onload = () => resolve();
                        img.onerror = () => resolve();
                        // 타임아웃 설정 (최대 5초로 증가)
                        setTimeout(resolve, 5000);
                    }
                });
            }));
        }
        
        // 빈칸 관련 처리 제거 - 퀴즈는 이미지와 텍스트만 표시
    }

    processContent(content) {
        let html = content;
        html = html.replace(/^#\s+.+$/gm, '');
        html = html.split('\n').map(line => {
            if (line.trim() === '') return '<br>';
            return line;
        }).join('\n');
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
        html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
        html = html.replace(/_(.+?)_/g, '<em>$1</em>');
        return html;
    }

    async nextNote() {
        await this.recordCurrentCardStudy(true);
        if (this.timer) {
            clearInterval(this.timer);
        }
        const timerDuration = this.plugin.getTimerDuration();
        this.totalTime = timerDuration;
        this.remainingTime = timerDuration;
        this.startTime = Date.now();
        this.timerExpired = false;
        if (this.timerDiv) {
            const minutes = Math.floor(timerDuration / 60);
            const seconds = Math.floor(timerDuration % 60);
            this.timerDiv.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            this.timerDiv.style.color = 'var(--interactive-accent)';
        }
        this.currentNoteIndex++;
        const content = this.contentEl.querySelector('.quiz-content');
        await this.displayCurrentNote(content);
        const progress = this.contentEl.querySelector('.quiz-progress');
        if (progress) {
            progress.textContent = `${this.currentNoteIndex + 1} / ${this.notes.length}`;
        }
        this.stopwatchPaused = false;
        this.timer = setInterval(() => {
            if (!this.stopwatchPaused) {
                const elapsed = (Date.now() - this.startTime) / 1000;
                this.remainingTime = Math.max(0, this.totalTime - elapsed);
            }
            const minutes = Math.floor(this.remainingTime / 60);
            const seconds = Math.floor(this.remainingTime % 60);
            if (this.timerDiv) {
                this.timerDiv.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            }
            if (this.remainingTime <= this.plugin.settings.timerWarningThreshold && this.remainingTime > 0) {
                this.timerDiv.style.color = '#f59e0b';
            }
            if (this.remainingTime <= 0 && !this.timerExpired) {
                this.timerExpired = true;
                this.timerDiv.style.color = '#dc2626';
                this.timerDiv.textContent = '⏰ 시간 종료!';
                if (this.plugin.settings.enableVibration && navigator.vibrate) {
                    try { navigator.vibrate([300, 100, 300]); } catch (e) {}
                }
                new Notice('⏰ 시간이 종료되었습니다!');
                if (this.plugin.settings.enableAutoRevealOnTimeout) {
                    const clozes = this.contentContainer.querySelectorAll('.genuine-cloze[data-show-state="hint"], .pseudo-cloze[data-show-state="hint"]');
                    clozes.forEach(cloze => {
                        const answer = cloze.getAttribute('data-answer');
                        if (answer) {
                            cloze.textContent = answer;
                            cloze.setAttribute('data-show-state', 'answer');
                            cloze.style.background = '#10b981';
                            cloze.style.color = 'white';
                        }
                    });
                    if (clozes.length > 0) {
                        new Notice(`✅ ${clozes.length}개의 빈칸이 자동으로 공개되었습니다`);
                    }
                }
            }
        }, 200);
    }

    previousNote() {
        if (this.currentNoteIndex > 0) {
            this.currentNoteIndex--;
            const content = this.contentEl.querySelector('.quiz-content');
            this.displayCurrentNote(content);
            const progress = this.contentEl.querySelector('.quiz-progress');
            if (progress) {
                progress.textContent = `${this.currentNoteIndex + 1} / ${this.notes.length}`;
            }
        }
    }

    async recordCurrentCardStudy(completed) {
        if (!this.currentFile || !this.plugin.settings.enableStudyTracking) return;
        // 세션 시작 시간을 기준으로 계산
        const elapsed = Math.floor((Date.now() - (this.sessionStartTime || this.startTime)) / 1000);
        const fileName = this.currentFile.basename;
        if (!this.plugin.settings.stats.studyHistory) {
            this.plugin.settings.stats.studyHistory = [];
        }
        
        // 퀴즈 완료 여부만 기록
        const totalClozes = 1;
        const correctClozes = completed ? 1 : 0;
        
        const record = {
            timestamp: Date.now(),
            date: new Date().toISOString().split('T')[0],
            folder: this.currentFile.path,
            folderName: this.currentFolderName,
            fileName: fileName,
            cardNumber: this.currentCardNumber,
            total: totalClozes,
            correct: correctClozes,
            duration: elapsed,
            completed: completed,
            action: 'quiz'
        };
        this.plugin.settings.stats.studyHistory.push(record);
        this.plugin.settings.stats.totalAttempts++;
        if (completed) this.plugin.settings.stats.totalCorrect++;
        this.plugin.settings.stats.totalTime += elapsed;
        this.plugin.settings.stats.lastStudyDate = new Date().toISOString();
        if (!this.plugin.settings.stats.folderStats) {
            this.plugin.settings.stats.folderStats = {};
        }
        if (!this.plugin.settings.stats.folderStats[this.currentFolderName]) {
            this.plugin.settings.stats.folderStats[this.currentFolderName] = {
                attempts: 0,
                correct: 0,
                time: 0,
                fileStats: {}
            };
        }
        const folderStat = this.plugin.settings.stats.folderStats[this.currentFolderName];
        folderStat.attempts++;
        if (completed) folderStat.correct++;
        folderStat.time += elapsed;
        if (!folderStat.fileStats[fileName]) {
            folderStat.fileStats[fileName] = {
                attempts: 0,
                correct: 0,
                time: 0
            };
        }
        const fileStat = folderStat.fileStats[fileName];
        fileStat.attempts++;
        if (completed) fileStat.correct++;
        fileStat.time += elapsed;
        await this.plugin.saveSettings(true);
    }

    onClose() {
        const { contentEl } = this;
        if (this.timer) {
            clearInterval(this.timer);
        }
        contentEl.empty();
    }
}

// =====================================================
// 퀴즈 편집 모달
// =====================================================
class QuizEditModal extends Modal {
    constructor(app, plugin, file, onSave) {
        super(app);
        this.plugin = plugin;
        this.file = file;
        this.onSave = onSave;
        this.content = '';
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        // 파일 내용 읽기
        this.content = await this.app.vault.read(this.file);
        
        contentEl.createEl('h2', { text: `📝 ${this.file.basename} 편집` });
        
        // 텍스트 편집 영역
        const textareaDiv = contentEl.createDiv();
        textareaDiv.style.cssText = 'margin: 20px 0;';
        
        const textarea = textareaDiv.createEl('textarea');
        textarea.value = this.content;
        textarea.style.cssText = `
            width: 100%;
            height: 400px;
            font-family: var(--font-monospace);
            font-size: 14px;
            padding: 12px;
            border: 2px solid var(--background-modifier-border);
            border-radius: 8px;
            resize: vertical;
        `;
        
        // 이미지 빈칸 추가 섹션
        const imageSection = contentEl.createDiv();
        imageSection.style.cssText = 'margin: 20px 0; padding: 20px; background: var(--background-secondary); border-radius: 8px;';
        
        imageSection.createEl('h3', { text: '🖼️ 이미지 빈칸 추가' });
        
        const imageInfo = imageSection.createEl('p');
        imageInfo.textContent = '이미지를 업로드하고 퀴즈를 생성합니다 (다중 선택 가능)';
        imageInfo.style.cssText = 'color: var(--text-muted); font-size: 13px; margin-bottom: 12px;';
        
        // 이미지 미리보기 영역
        const previewArea = imageSection.createDiv();
        previewArea.style.cssText = 'margin: 12px 0; min-height: 100px; border: 2px dashed var(--background-modifier-border); border-radius: 8px; padding: 12px; display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: center;';
        
        const previewPlaceholder = previewArea.createEl('div');
        previewPlaceholder.textContent = '이미지 선택 또는 붙여넣기';
        previewPlaceholder.style.cssText = 'color: var(--text-muted); font-size: 14px;';
        
        let selectedFiles = [];
        
        const updatePreview = () => {
            previewArea.empty();
            if (selectedFiles.length === 0) {
                const placeholder = previewArea.createEl('div');
                placeholder.textContent = '이미지 선택 또는 붙여넣기';
                placeholder.style.cssText = 'color: var(--text-muted); font-size: 14px;';
            } else {
                selectedFiles.forEach((file, index) => {
                    const imgWrapper = previewArea.createDiv();
                    imgWrapper.style.cssText = 'position: relative; display: inline-block;';
                    
                    const img = imgWrapper.createEl('img');
                    img.src = URL.createObjectURL(file);
                    img.style.cssText = 'max-width: 150px; max-height: 150px; border-radius: 6px; object-fit: cover;';
                    
                    const deleteBtn = imgWrapper.createEl('button', { text: '✕' });
                    deleteBtn.style.cssText = `
                        position: absolute;
                        top: 4px;
                        right: 4px;
                        background: rgba(0,0,0,0.7);
                        color: white;
                        border: none;
                        border-radius: 50%;
                        width: 24px;
                        height: 24px;
                        cursor: pointer;
                        font-size: 16px;
                        line-height: 1;
                    `;
                    deleteBtn.onclick = () => {
                        selectedFiles.splice(index, 1);
                        updatePreview();
                    };
                });
                
                const fileCountText = previewArea.createEl('div');
                fileCountText.textContent = `${selectedFiles.length}개 선택됨`;
                fileCountText.style.cssText = 'color: var(--text-accent); font-weight: bold; width: 100%; text-align: center; margin-top: 8px;';
            }
        };
        
        // 파일 선택
        const fileInput = imageSection.createEl('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.multiple = true;
        fileInput.style.cssText = 'margin-bottom: 12px; display: block;';
        fileInput.onchange = () => {
            if (fileInput.files) {
                selectedFiles = [...selectedFiles, ...Array.from(fileInput.files)];
                updatePreview();
            }
        };
        
        // 붙여넣기 이벤트
        contentEl.addEventListener('paste', async (e) => {
            const items = e.clipboardData?.items;
            if (!items) return;
            
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                if (item.type.indexOf('image') !== -1) {
                    e.preventDefault();
                    const blob = item.getAsFile();
                    if (blob) {
                        selectedFiles.push(blob);
                        updatePreview();
                        new Notice('📋 이미지가 추가되었습니다');
                    }
                }
            }
        });
        
        // 답변 입력
        const answerInput = imageSection.createEl('input');
        answerInput.type = 'text';
        answerInput.placeholder = '답변 (선택사항, 비워두면 "이미지")';
        answerInput.style.cssText = 'width: 100%; padding: 8px; margin-bottom: 8px; border-radius: 4px; border: 1px solid var(--background-modifier-border);';
        
        // 힌트 입력
        const hintInput = imageSection.createEl('input');
        hintInput.type = 'text';
        hintInput.placeholder = '힌트 (선택사항)';
        hintInput.style.cssText = 'width: 100%; padding: 8px; margin-bottom: 12px; border-radius: 4px; border: 1px solid var(--background-modifier-border);';
        
        // 이미지 추가 버튼
        const addImageBtn = imageSection.createEl('button', { text: '➕ 선택된 이미지 빈칸 추가', cls: 'mod-cta' });
        addImageBtn.style.cssText = 'padding: 8px 16px;';
        addImageBtn.onclick = async () => {
            if (selectedFiles.length === 0) {
                new Notice('❌ 이미지를 선택해주세요');
                return;
            }
            
            try {
                const attachmentFolder = this.plugin.settings.imageClozeFolder || `${this.plugin.settings.clozeFolder}/${this.plugin.settings.imageSubFolder}`;
                
                // 폴더 생성
                const folder = this.app.vault.getAbstractFileByPath(attachmentFolder);
                if (!folder) {
                    await this.app.vault.createFolder(attachmentFolder);
                }
                
                const answer = answerInput.value.trim() || '이미지';
                const hint = hintInput.value.trim();
                const clozeId = this.plugin.getCurrentCardNumber();
                
                let addedTexts = [];
                
                for (const file of selectedFiles) {
                    // 이미지 저장
                    const arrayBuffer = await file.arrayBuffer();
                    const uint8Array = new Uint8Array(arrayBuffer);
                    
                    // 파일명 생성
                    const timestamp = Date.now();
                    const ext = file.name.split('.').pop();
                    const imageName = `image-${timestamp}.${ext}`;
                    const imagePath = `${attachmentFolder}/${imageName}`;
                    
                    // 파일 저장
                    await this.app.vault.createBinary(imagePath, uint8Array);
                    
                    // 퀴즈 텍스트 생성
                    const imageSubFolder = this.plugin.settings.imageSubFolder || '첨부파일';
                    let clozeText;
                    if (hint) {
                        clozeText = `![[${imageSubFolder}/${imageName}|300]]{{c${clozeId}::${answer}::${hint}}}`;
                    } else {
                        clozeText = `![[${imageSubFolder}/${imageName}|300]]{{c${clozeId}::${answer}}}`;
                    }
                    
                    addedTexts.push(clozeText);
                    
                    // 중복 방지를 위한 약간의 지연
                    await new Promise(resolve => setTimeout(resolve, 10));
                }
                
                // 텍스트 추가
                textarea.value += '\n\n' + addedTexts.join('\n\n') + '\n';
                
                // 초기화
                selectedFiles = [];
                updatePreview();
                fileInput.value = '';
                answerInput.value = '';
                hintInput.value = '';
                
                new Notice(`✅ ${addedTexts.length}개 이미지 빈칸이 추가되었습니다`);
            } catch (error) {
                console.error('이미지 추가 실패:', error);
                new Notice('❌ 이미지 추가 실패');
            }
        };
        
        // 버튼 영역
        const buttonDiv = contentEl.createDiv();
        buttonDiv.style.cssText = 'display: flex; gap: 12px; justify-content: flex-end; margin-top: 20px;';
        
        const cancelBtn = buttonDiv.createEl('button', { text: '❌ 취소' });
        cancelBtn.onclick = () => this.close();
        
        const saveBtn = buttonDiv.createEl('button', { text: '💾 저장', cls: 'mod-cta' });
        saveBtn.onclick = async () => {
            try {
                await this.app.vault.modify(this.file, textarea.value);
                new Notice('✅ 저장되었습니다');
                if (this.onSave) {
                    await this.onSave();
                }
                this.close();
            } catch (error) {
                console.error('저장 실패:', error);
                new Notice('❌ 저장 실패');
            }
        };
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}


// 이미지 퀴즈 편집 모달
class ImageQuizEditModal extends Modal {
    constructor(app, data) {
        super(app);
        this.data = data;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        // 제목
        const titleEl = contentEl.createEl('h2', { text: '🖼️ 이미지 빈칸 편집' });
        titleEl.style.cssText = 'margin-bottom: 20px; color: var(--interactive-accent);';
        
        // 이미지 미리보기 섹션
        const imageSection = contentEl.createDiv();
        imageSection.style.cssText = 'margin: 20px 0; padding: 20px; background: var(--background-secondary); border: 2px solid var(--interactive-accent); border-radius: 12px;';
        
        const imageHeader = imageSection.createEl('h3');
        imageHeader.innerHTML = '🖼️ 이미지 미리보기';
        imageHeader.style.cssText = 'margin: 0 0 15px 0; color: var(--text-accent); font-size: 16px;';
        
        const imagePreview = imageSection.createDiv({ cls: 'image-cloze-preview' });
        imagePreview.style.cssText = 'text-align: center; padding: 15px; background: var(--background-primary); border-radius: 8px; position: relative;';
        
        const img = imagePreview.createEl('img');
        // 원본 이미지 엘리먼트가 있으면 src 복사, 없으면 경로 사용
        if (this.data.imageElement) {
            img.src = this.data.imageElement.src;
            console.log('✅ 이미지 소스 설정:', img.src);
        } else {
            img.src = this.data.imageSrc;
            console.log('⚠️ 경로로 이미지 설정:', img.src);
        }
        img.style.cssText = 'max-width: 100%; max-height: 300px; border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); cursor: pointer; transition: transform 0.2s; transform-origin: center;';
        img.onerror = () => {
            console.error('❌ 이미지 로드 실패:', img.src);
            img.alt = '이미지 로드 실패';
            img.style.cssText += 'min-height: 100px; display: flex; align-items: center; justify-content: center; background: var(--background-modifier-error);';
        };
        
        // 이미지 크기 조절 컨트롤
        let previewScale = 1;
        const zoomControls = imagePreview.createDiv();
        zoomControls.style.cssText = `
            display: flex;
            gap: 10px;
            align-items: center;
            justify-content: center;
            margin-top: 10px;
            padding: 8px;
            background: rgba(0, 0, 0, 0.7);
            border-radius: 20px;
            width: fit-content;
            margin-left: auto;
            margin-right: auto;
        `;
        
        const createZoomBtn = (text, title) => {
            const btn = zoomControls.createEl('button', { text });
            btn.type = 'button';
            btn.title = title;
            btn.style.cssText = `
                width: 32px;
                height: 32px;
                border-radius: 50%;
                background: var(--interactive-accent);
                color: white;
                border: none;
                cursor: pointer;
                font-size: 16px;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s;
            `;
            btn.addEventListener('mouseenter', () => btn.style.transform = 'scale(1.1)');
            btn.addEventListener('mouseleave', () => btn.style.transform = 'scale(1)');
            return btn;
        };
        
        const zoomOutBtn = createZoomBtn('➖', '축소');
        const scaleLabel = zoomControls.createEl('span');
        scaleLabel.textContent = '100%';
        scaleLabel.style.cssText = 'color: white; font-weight: bold; min-width: 50px; text-align: center; font-size: 14px;';
        const zoomInBtn = createZoomBtn('➕', '확대');
        const resetBtn = createZoomBtn('🔄', '원래 크기');
        
        zoomOutBtn.onclick = (e) => {
            e.stopPropagation();
            previewScale = Math.max(0.5, previewScale * 0.8);
            img.style.transform = `scale(${previewScale})`;
            scaleLabel.textContent = `${Math.round(previewScale * 100)}%`;
        };
        
        zoomInBtn.onclick = (e) => {
            e.stopPropagation();
            previewScale = Math.min(3, previewScale * 1.2);
            img.style.transform = `scale(${previewScale})`;
            scaleLabel.textContent = `${Math.round(previewScale * 100)}%`;
        };
        
        resetBtn.onclick = (e) => {
            e.stopPropagation();
            previewScale = 1;
            img.style.transform = 'scale(1)';
            scaleLabel.textContent = '100%';
        };
        
        // 이미지 클릭 시 전체화면 미리보기
        img.onclick = () => {
            const overlay = document.body.createDiv();
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background: rgba(0, 0, 0, 0.95);
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
            `;
            
            const fullImg = overlay.createEl('img');
            fullImg.src = img.src;
            fullImg.style.cssText = 'max-width: 90vw; max-height: 90vh; object-fit: contain; border-radius: 8px;';
            
            overlay.onclick = () => overlay.remove();
        };
        
        // 이미지 정보 표시
        const imageInfo = imageSection.createEl('p');
        imageInfo.innerHTML = `📌 이미지 경로: <code>${this.data.imageSrc}</code>`;
        imageInfo.style.cssText = 'margin-top: 10px; font-size: 12px; color: var(--text-muted); word-break: break-all;';
        
        // 빈칸 설정 섹션
        const settingsSection = contentEl.createDiv();
        settingsSection.style.cssText = 'margin: 20px 0; padding: 20px; background: var(--background-primary-alt); border-radius: 12px; border: 2px solid var(--background-modifier-border);';
        
        const settingsHeader = settingsSection.createEl('h3');
        settingsHeader.innerHTML = '⚙️ 빈칸 설정';
        settingsHeader.style.cssText = 'margin: 0 0 15px 0; color: var(--text-normal); font-size: 16px;';
        
        // 빈칸 ID 입력
        const idContainer = settingsSection.createDiv({ cls: 'setting-item' });
        idContainer.style.cssText = 'margin-bottom: 15px;';
        
        const idLabel = idContainer.createEl('div', { cls: 'setting-item-name' });
        idLabel.innerHTML = '🔢 빈칸 ID (카드 번호)';
        idLabel.style.cssText = 'font-weight: 600; margin-bottom: 8px;';
        
        const idDesc = idContainer.createEl('div', { cls: 'setting-item-description' });
        idDesc.textContent = '빈칸의 고유 번호입니다. c1, c2, c3 등에서 숫자 부분입니다.';
        idDesc.style.cssText = 'color: var(--text-muted); font-size: 12px; margin-bottom: 8px;';
        
        const idInput = idContainer.createEl('input', { type: 'number' });
        idInput.value = this.data.clozeId || '1';
        idInput.min = '1';
        idInput.style.cssText = 'width: 100%; padding: 10px; border: 2px solid var(--background-modifier-border); border-radius: 6px; font-size: 14px;';
        
        // 정답 입력
        const answerContainer = settingsSection.createDiv({ cls: 'setting-item' });
        answerContainer.style.cssText = 'margin-bottom: 15px;';
        
        const answerLabel = answerContainer.createEl('div', { cls: 'setting-item-name' });
        answerLabel.innerHTML = '✅ 정답 (선택사항)';
        answerLabel.style.cssText = 'font-weight: 600; margin-bottom: 8px;';
        
        const answerDesc = answerContainer.createEl('div', { cls: 'setting-item-description' });
        answerDesc.textContent = '이미지를 설명하는 정답 텍스트입니다. 비워두면 이미지 파일명이 사용됩니다.';
        answerDesc.style.cssText = 'color: var(--text-muted); font-size: 12px; margin-bottom: 8px;';
        
        const answerInput = answerContainer.createEl('input', { type: 'text' });
        answerInput.value = this.data.answer || '';
        answerInput.placeholder = '예: 서울타워, 에펠탑, 만리장성 등';
        answerInput.style.cssText = 'width: 100%; padding: 10px; border: 2px solid var(--background-modifier-border); border-radius: 6px; font-size: 14px;';
        
        // 힌트 입력
        const hintContainer = settingsSection.createDiv({ cls: 'setting-item' });
        hintContainer.style.cssText = 'margin-bottom: 0;';
        
        const hintLabel = hintContainer.createEl('div', { cls: 'setting-item-name' });
        hintLabel.innerHTML = '💡 힌트 (선택사항)';
        hintLabel.style.cssText = 'font-weight: 600; margin-bottom: 8px;';
        
        const hintDesc = hintContainer.createEl('div', { cls: 'setting-item-description' });
        hintDesc.textContent = '문제 힌트로 표시될 내용입니다. 학습에 도움이 되는 내용을 입력하세요.';
        hintDesc.style.cssText = 'color: var(--text-muted); font-size: 12px; margin-bottom: 8px;';
        
        const hintInput = hintContainer.createEl('input', { type: 'text' });
        hintInput.value = this.data.hint || '';
        hintInput.placeholder = '예: 한국의 랜드마크, 프랑스 파리, 중국의 성벽 등';
        hintInput.style.cssText = 'width: 100%; padding: 10px; border: 2px solid var(--background-modifier-border); border-radius: 6px; font-size: 14px;';
        
        // 미리보기 섹션
        const previewSection = contentEl.createDiv();
        previewSection.style.cssText = 'margin: 20px 0; padding: 15px; background: var(--background-secondary-alt); border-radius: 8px; border: 1px dashed var(--background-modifier-border);';
        
        const previewHeader = previewSection.createEl('h4');
        previewHeader.innerHTML = '👁️ 마크다운 미리보기';
        previewHeader.style.cssText = 'margin: 0 0 10px 0; font-size: 14px; color: var(--text-muted);';
        
        const previewCode = previewSection.createEl('code');
        previewCode.style.cssText = 'display: block; padding: 10px; background: var(--background-primary); border-radius: 4px; font-family: var(--font-monospace); font-size: 12px; white-space: pre-wrap; word-break: break-all;';
        
        // 실시간 미리보기 업데이트
        const updatePreview = () => {
            const id = idInput.value || '1';
            const answer = answerInput.value || '이미지';
            const hint = hintInput.value || '';
            
            const imagePart = this.data.imageSrc ? `![[${this.data.imageSrc}]]` : '![[image.png]]';
            const clozePart = hint ? `{{c${id}::${answer}::${hint}}}` : `{{c${id}::${answer}}}`;
            
            previewCode.textContent = `${imagePart}${clozePart}`;
        };
        
        idInput.oninput = updatePreview;
        answerInput.oninput = updatePreview;
        hintInput.oninput = updatePreview;
        updatePreview();
        
        // 버튼 영역
        const buttonContainer = contentEl.createDiv();
        buttonContainer.style.cssText = 'margin-top: 25px; display: flex; gap: 12px; justify-content: flex-end; padding-top: 20px; border-top: 2px solid var(--background-modifier-border);';
        
        const saveBtn = buttonContainer.createEl('button', { text: '💾 저장', cls: 'mod-cta' });
        saveBtn.style.cssText = 'padding: 10px 20px; border-radius: 6px; font-weight: 600; cursor: pointer;';
        saveBtn.onclick = () => {
            const newData = { clozeId: idInput.value, answer: answerInput.value.trim(), hint: hintInput.value.trim() };
            if (this.data.onSave) this.data.onSave(newData);
            this.close();
        };
        
        const cancelBtn2 = buttonContainer.createEl('button', { text: '❌ 취소' });
        cancelBtn2.style.cssText = 'padding: 10px 20px; border-radius: 6px; font-weight: 600; cursor: pointer; background: var(--background-modifier-border); border: none;';
        cancelBtn2.onclick = () => this.close();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// =====================================================
// 북마크 목록 모달
// =====================================================
class BookmarkListModal extends Modal {
    constructor(app, plugin) {
        super(app);
        this.plugin = plugin;
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('bookmark-modal');

        // 헤더
        const header = contentEl.createDiv();
        header.style.cssText = `
            background: linear-gradient(135deg, var(--interactive-accent) 0%, var(--interactive-accent-hover) 100%);
            color: var(--text-on-accent);
            padding: 24px;
            margin: -20px -20px 20px -20px;
            border-radius: 8px 8px 0 0;
        `;
        
        const headerContent = header.createDiv();
        headerContent.style.cssText = 'display: flex; justify-content: space-between; align-items: center;';
        
        const headerLeft = headerContent.createDiv();
        headerLeft.createEl('h2', { text: '⭐ 북마크 목록' }).style.cssText = 'margin: 0 0 4px 0; font-size: 24px;';
        headerLeft.createEl('p', { text: '북마크한 문제를 관리하세요' }).style.cssText = 'margin: 0; opacity: 0.9; font-size: 14px;';
        
        // 전체 삭제 버튼
        const clearBtn = headerContent.createEl('button', { text: '🗑️ 전체 삭제' });
        clearBtn.style.cssText = `
            padding: 10px 16px;
            background: rgba(255, 255, 255, 0.2);
            border: none;
            border-radius: 6px;
            color: white;
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;
            transition: all 0.2s;
        `;
        clearBtn.onmouseenter = () => clearBtn.style.background = 'rgba(255, 0, 0, 0.3)';
        clearBtn.onmouseleave = () => clearBtn.style.background = 'rgba(255, 255, 255, 0.2)';
        clearBtn.onclick = async () => {
            if (confirm('모든 북마크를 삭제하시겠습니까?')) {
                this.plugin.settings.bookmarks = [];
                await this.plugin.saveSettings();
                new Notice('✅ 모든 북마크가 삭제되었습니다');
                this.onOpen();
            }
        };

        // 북마크된 문제 로드
        const allQuestions = await this.plugin.loadAllQuestions();
        const bookmarkedQuestions = allQuestions.filter(q => q.bookmarked);

        if (bookmarkedQuestions.length === 0) {
            const emptyState = contentEl.createDiv();
            emptyState.style.cssText = 'text-align: center; padding: 60px 20px; color: var(--text-muted);';
            emptyState.createEl('div', { text: '⭐' }).style.cssText = 'font-size: 64px; margin-bottom: 16px; opacity: 0.3;';
            emptyState.createEl('p', { text: '북마크된 문제가 없습니다' }).style.cssText = 'font-size: 18px; font-weight: 600; margin-bottom: 8px;';
            emptyState.createEl('p', { text: '퀴즈 중 ⭐ 버튼을 눌러 중요한 문제를 저장하세요' }).style.cssText = 'font-size: 14px; color: var(--text-muted);';
            return;
        }

        // 통계 카드
        const statsCards = contentEl.createDiv();
        statsCards.style.cssText = `
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
            margin-bottom: 20px;
        `;

        const totalCount = bookmarkedQuestions.length;
        const folderGroups = {};
        bookmarkedQuestions.forEach(q => {
            const folder = q.folder || '기본';
            folderGroups[folder] = (folderGroups[folder] || 0) + 1;
        });
        const folderCount = Object.keys(folderGroups).length;

        const statsData = [
            { icon: '📚', label: '전체 문제', value: totalCount },
            { icon: '📁', label: '폴더 수', value: folderCount },
            { icon: '⭐', label: '북마크', value: '활성' }
        ];

        statsData.forEach(stat => {
            const card = statsCards.createDiv();
            card.style.cssText = `
                background: var(--background-secondary);
                padding: 16px;
                border-radius: 8px;
                text-align: center;
            `;
            card.createEl('div', { text: stat.icon }).style.cssText = 'font-size: 24px; margin-bottom: 8px;';
            card.createEl('div', { text: String(stat.value) }).style.cssText = 'font-size: 20px; font-weight: 700; margin-bottom: 4px;';
            card.createEl('div', { text: stat.label }).style.cssText = 'font-size: 12px; color: var(--text-muted);';
        });

        // 북마크 목록
        const listContainer = contentEl.createDiv({ cls: 'bookmark-list' });
        listContainer.style.cssText = 'max-height: 50vh; overflow-y: auto;';

        bookmarkedQuestions.forEach((question, index) => {
            const item = listContainer.createDiv({ cls: 'bookmark-item' });
            item.style.cssText = `
                background: var(--background-primary);
                border: 2px solid var(--background-modifier-border);
                border-radius: 12px;
                padding: 16px;
                margin-bottom: 12px;
                transition: all 0.3s ease;
                cursor: pointer;
            `;
            item.onmouseenter = () => {
                item.style.borderColor = 'var(--interactive-accent)';
                item.style.transform = 'translateY(-2px)';
                item.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
            };
            item.onmouseleave = () => {
                item.style.borderColor = 'var(--background-modifier-border)';
                item.style.transform = 'translateY(0)';
                item.style.boxShadow = 'none';
            };

            // 문제 헤더
            const itemHeader = item.createDiv();
            itemHeader.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;';

            const titleDiv = itemHeader.createDiv();
            titleDiv.style.cssText = 'flex: 1;';
            titleDiv.createEl('div', { text: `${question.hanzi || question.question}` }).style.cssText = 'font-size: 18px; font-weight: 700; margin-bottom: 4px;';
            titleDiv.createEl('div', { text: `📁 ${question.folder} | 번호: ${question.number}` }).style.cssText = 'font-size: 13px; color: var(--text-muted);';

            const badgeContainer = itemHeader.createDiv();
            badgeContainer.style.cssText = 'display: flex; gap: 6px;';
            
            const difficultyBadge = badgeContainer.createEl('span', { text: question.difficulty || '보통' });
            difficultyBadge.style.cssText = `
                padding: 4px 12px;
                background: var(--background-secondary);
                border-radius: 12px;
                font-size: 12px;
                font-weight: 600;
            `;

            // 통계
            const statsDiv = item.createDiv();
            statsDiv.style.cssText = `
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 8px;
                margin-bottom: 12px;
                padding: 10px;
                background: var(--background-secondary);
                border-radius: 6px;
            `;

            const statInfo = (icon, label, value) => {
                const div = statsDiv.createDiv();
                div.style.cssText = 'display: flex; align-items: center; gap: 6px; font-size: 13px;';
                div.createEl('span', { text: icon });
                div.createEl('span', { text: `${label}: ` }).style.color = 'var(--text-muted)';
                div.createEl('span', { text: value }).style.fontWeight = '600';
            };

            statInfo('✅', '정답', `${question.correctCount || 0}회`);
            statInfo('❌', '오답', `${question.wrongCount || 0}회`);

            // 버튼 그룹
            const btnGroup = item.createDiv();
            btnGroup.style.cssText = 'display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;';

            // 편집 버튼
            const editBtn = btnGroup.createEl('button', { text: '✏️ 편집' });
            editBtn.style.cssText = `
                padding: 10px;
                border-radius: 6px;
                border: 1px solid var(--background-modifier-border);
                background: var(--background-primary);
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s;
            `;
            editBtn.onmouseenter = () => editBtn.style.background = 'var(--background-modifier-hover)';
            editBtn.onmouseleave = () => editBtn.style.background = 'var(--background-primary)';
            editBtn.onclick = (e) => {
                e.stopPropagation();
                this.close();
                new QuizCreatorModal(this.app, this.plugin, question.folder, question).open();
            };

            // 북마크 해제 버튼
            const removeBtn = btnGroup.createEl('button', { text: '⭐ 해제' });
            removeBtn.style.cssText = `
                padding: 10px;
                border-radius: 6px;
                border: none;
                background: var(--background-modifier-error);
                color: white;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s;
            `;
            removeBtn.onmouseenter = () => removeBtn.style.opacity = '0.8';
            removeBtn.onmouseleave = () => removeBtn.style.opacity = '1';
            removeBtn.onclick = async (e) => {
                e.stopPropagation();
                question.bookmarked = false;
                await this.plugin.saveQuestion(question, false);
                new Notice('⭐ 북마크가 해제되었습니다');
                this.onOpen();
            };
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// =====================================================
// 북마크 퀴즈 모달
// =====================================================
class BookmarkQuizModal extends Modal {
    constructor(app, plugin) {
        super(app);
        this.plugin = plugin;
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        // 북마크된 문제 로드
        const allQuestions = await this.plugin.loadAllQuestions();
        const bookmarkedQuestions = allQuestions.filter(q => q.bookmarked);

        if (bookmarkedQuestions.length === 0) {
            contentEl.createEl('p', { text: '북마크된 문제가 없습니다' });
            return;
        }

        // FolderQuizModal 스타일로 설정 모달 표시
        this.close();
        
        // 북마크 전용 설정으로 QuizModal 시작
        const settings = {
            difficulty: '전체',
            count: bookmarkedQuestions.length,
            enableTimer: this.plugin.settings.defaultTimerEnabled !== false,
            timerEnabled: this.plugin.settings.defaultTimerEnabled !== false,
            timerPerQuestion: this.plugin.settings.defaultTimerPerQuestion || 30,
            shuffleQuestions: this.plugin.settings.defaultShuffleQuestions !== false,
            shuffleOptions: this.plugin.settings.defaultShuffleOptions !== false,
            wrongOnly: false,
            bookmarkOnly: true
        };

        new QuizModal(this.app, this.plugin, '⭐ 북마크', bookmarkedQuestions, settings).open();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// =====================================================
// 테스트 관리 모달 클래스
// =====================================================
class TestItemAddModal extends Modal {
    constructor(app, onAdd) {
        super(app);
        this.onAdd = onAdd;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h2', { text: '새 테스트 항목 추가' });

        const form = contentEl.createDiv();
        form.createEl('label', { text: '항목 내용' });
        const textInput = form.createEl('input', { type: 'text' });
        textInput.style.cssText = 'width: 100%; margin-bottom: 15px; padding: 8px;';

        const btnContainer = form.createDiv();
        btnContainer.style.cssText = 'display: flex; gap: 10px; justify-content: center; position: fixed; left: 50%; transform: translateX(-50%); width: 100vw; max-width: 100vw; bottom: env(safe-area-inset-bottom, 80px); z-index: 9999; background: rgba(255,255,255,0.97); padding: 10px 0 18px 0; box-sizing: border-box; border-top: 1px solid #eee;';

        const addBtn = btnContainer.createEl('button', { text: '추가' });
        addBtn.style.cssText = 'background: var(--interactive-accent); color: var(--text-on-accent); padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer;';
        addBtn.onclick = () => {
            const text = textInput.value.trim();
            if (text) {
                this.onAdd(text);
                this.close();
                new Notice('테스트 항목이 추가되었습니다!');
            }
        };

        const cancelBtn = btnContainer.createEl('button', { text: '취소' });
        cancelBtn.style.cssText = 'padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; background: var(--background-secondary);';
        cancelBtn.onclick = () => this.close();

        textInput.focus();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// =====================================================
// 퀴즈 유틸리티 함수들
// =====================================================
function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    let result = '';
    if (hours > 0) result += `${hours}h `;
    if (minutes > 0) result += `${minutes}m `;
    if (secs > 0 || result === '') result += `${secs}s`;
    
    return result.trim();
}

function detectLanguage(text) {
    let koreanCount = 0;
    let japaneseCount = 0;
    let chineseCount = 0;
    let englishCount = 0;
    
    for (let char of text) {
        const code = char.charCodeAt(0);
        if ((code >= 0xAC00 && code <= 0xD7A3) || (code >= 0x1100 && code <= 0x11FF)) {
            koreanCount++;
        } else if ((code >= 0x3040 && code <= 0x309F) || (code >= 0x30A0 && code <= 0x30FF)) {
            japaneseCount++;
        } else if (code >= 0x4E00 && code <= 0x9FFF) {
            chineseCount++;
        } else if ((code >= 0x0041 && code <= 0x005A) || (code >= 0x0061 && code <= 0x007A)) {
            englishCount++;
        }
    }
    
    const total = koreanCount + japaneseCount + chineseCount + englishCount;
    if (total === 0) return 'ko-KR';
    
    const koreanRatio = koreanCount / total;
    const japaneseRatio = japaneseCount / total;
    const chineseRatio = chineseCount / total;
    
    if (koreanRatio > 0.3) return 'ko-KR';
    if (japaneseRatio > 0.3) return 'ja-JP';
    if (chineseRatio > 0.3) return 'zh-CN';
    return 'en-US';
}

async function speakText(text, options = {}) {
    if (!text || text.trim() === '') return;
    
    try {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            
            const utterance = new SpeechSynthesisUtterance(text);
            const lang = options.language || detectLanguage(text);
            utterance.lang = lang;
            
            const voices = window.speechSynthesis.getVoices();
            const preferredVoice = voices.find(voice => 
                voice.name.toLowerCase().includes('samsung') && voice.lang.startsWith(lang.split('-')[0])
            );
            if (preferredVoice) utterance.voice = preferredVoice;
            
            if (options.rate) utterance.rate = options.rate;
            if (options.pitch) utterance.pitch = options.pitch;
            if (options.volume) utterance.volume = options.volume;
            
            window.speechSynthesis.speak(utterance);
        }
    } catch (error) {
        console.error('TTS error:', error);
    }
}

// =====================================================
// 퀴즈 모달 클래스들
// =====================================================
class QuizModal extends Modal {
    constructor(app, plugin, folderName, questions, options = {}) {
        super(app);
        this.plugin = plugin;
        this.folderName = folderName || '';
        this.questions = questions || [];
        this.options = options;
        this.currentIndex = 0;
        this.score = 0;
        this.results = [];
        this.startTime = Date.now();
        this.isPaused = false;
        this.timerInterval = null;
        this.timeLeft = options.timerPerQuestion || 30;
    }

    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    showImageZoom(imageUrl, altText = '이미지', imageUrls = null, startIndex = 0) {
        const overlay = document.body.createDiv({ cls: 'image-zoom-overlay' });
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.95);
            z-index: 10000;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            cursor: pointer;
            padding: 10px;
            box-sizing: border-box;
            -webkit-tap-highlight-color: transparent;
            touch-action: pan-y pinch-zoom;
        `;
        
        const imgContainer = overlay.createDiv();
        imgContainer.style.cssText = `
            position: relative;
            max-width: 95vw;
            max-height: 80vh;
            display: flex;
            justify-content: center;
            align-items: center;
            touch-action: pan-y pinch-zoom;
        `;
        
        const img = imgContainer.createEl('img', {
            attr: { src: imageUrl, alt: altText }
        });
        img.style.cssText = `
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
            border-radius: 8px;
            touch-action: pan-y pinch-zoom;
        `;
        
        // 모바일용 큰 닫기 버튼
        const closeBtn = overlay.createEl('button', { text: '✕' });
        closeBtn.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            width: 44px;
            height: 44px;
            min-width: 44px;
            min-height: 44px;
            background: rgba(255, 255, 255, 0.9);
            color: #000;
            border: none;
            border-radius: 50%;
            font-size: 24px;
            font-weight: bold;
            cursor: pointer;
            z-index: 10003;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            -webkit-tap-highlight-color: transparent;
        `;
        closeBtn.onclick = (e) => {
            e.stopPropagation();
            document.body.removeChild(overlay);
        };
        
        // 여러 이미지가 있는 경우 카운터와 네비게이션 버튼 추가
        let currentIndex = startIndex;
        let counter = null;
        
        if (imageUrls && imageUrls.length > 1) {
            counter = overlay.createDiv();
            counter.style.cssText = `
                position: absolute;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 10px 20px;
                border-radius: 20px;
                font-size: 16px;
                font-weight: 600;
                z-index: 10002;
            `;
            counter.textContent = `${currentIndex + 1} / ${imageUrls.length}`;
            
            const navContainer = overlay.createDiv();
            navContainer.style.cssText = `
                display: flex;
                gap: 15px;
                margin-top: 20px;
                z-index: 10002;
            `;
            
            const prevBtn = navContainer.createEl('button', { text: '◀ 이전' });
            prevBtn.style.cssText = `
                padding: 16px 32px;
                min-width: 120px;
                min-height: 48px;
                background: var(--interactive-accent);
                color: white;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-size: 16px;
                font-weight: 600;
                -webkit-tap-highlight-color: transparent;
                touch-action: manipulation;
            `;
            prevBtn.onclick = (e) => {
                e.stopPropagation();
                if (currentIndex > 0) {
                    currentIndex--;
                    img.src = imageUrls[currentIndex];
                    counter.textContent = `${currentIndex + 1} / ${imageUrls.length}`;
                }
            };
            
            const nextBtn = navContainer.createEl('button', { text: '다음 ▶' });
            nextBtn.style.cssText = `
                padding: 16px 32px;
                min-width: 120px;
                min-height: 48px;
                background: var(--interactive-accent);
                color: white;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-size: 16px;
                font-weight: 600;
                -webkit-tap-highlight-color: transparent;
                touch-action: manipulation;
            `;
            nextBtn.onclick = (e) => {
                e.stopPropagation();
                if (currentIndex < imageUrls.length - 1) {
                    currentIndex++;
                    img.src = imageUrls[currentIndex];
                    counter.textContent = `${currentIndex + 1} / ${imageUrls.length}`;
                }
            };
            
            // 이미지 클릭 시에도 다음으로
            img.onclick = (e) => {
                e.stopPropagation();
                if (currentIndex < imageUrls.length - 1) {
                    currentIndex++;
                    img.src = imageUrls[currentIndex];
                    counter.textContent = `${currentIndex + 1} / ${imageUrls.length}`;
                }
            };
            img.style.cursor = 'pointer';
        }
        
        const closeOverlay = () => {
            overlay.remove();
            document.removeEventListener('keydown', handleEscape);
        };
        
        closeBtn.onclick = (e) => {
            e.stopPropagation();
            closeOverlay();
        };
        
        overlay.onclick = closeOverlay;
        imgContainer.onclick = (e) => {
            if (!imageUrls || imageUrls.length <= 1) {
                e.stopPropagation();
            }
        };
        
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                e.preventDefault();
                closeOverlay();
            }
        };
        document.addEventListener('keydown', handleEscape, true);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('quiz-modal');
        contentEl.style.cssText = 'padding: 0; overflow: hidden;';
        
        // 모바일 스타일 추가
        if (!document.getElementById('quiz-modal-mobile-style')) {
            const style = document.createElement('style');
            style.id = 'quiz-modal-mobile-style';
            style.innerHTML = `
            /* 모바일 전용 스타일 */
            @media (max-width: 768px), (pointer: coarse) {
                .modal {
                    max-width: 100vw !important;
                    width: 100vw !important;
                    height: 100vh !important;
                    margin: 0 !important;
                }
                
                .modal-content {
                    max-height: 100vh !important;
                    padding: 12px !important;
                }
                
                /* 슬라이더 버튼 모바일 최적화 */
                button {
                    -webkit-tap-highlight-color: transparent !important;
                    touch-action: manipulation !important;
                }
                
                button:active {
                    opacity: 0.7;
                }
                
                /* 이미지 터치 최적화 */
                img {
                    touch-action: pan-y pinch-zoom !important;
                    -webkit-user-select: none;
                    user-select: none;
                }
                
                .quiz-modal {
                    padding: 0 !important;
                    max-width: 100vw !important;
                }
                
                .quiz-control-bar {
                    padding: 8px !important;
                    gap: 8px !important;
                    justify-content: center !important;
                }
                
                .quiz-info-bar {
                    padding: 10px 12px !important;
                    gap: 10px !important;
                    flex-wrap: wrap !important;
                    justify-content: center !important;
                }
                
                .quiz-progress {
                    font-size: 14px !important;
                    padding: 4px 10px !important;
                }
                
                .quiz-timer {
                    font-size: 20px !important;
                    flex: none !important;
                }
                
                .quiz-header-bookmark {
                    font-size: 13px !important;
                    padding: 4px 10px !important;
                }
                
                .quiz-control-bar .control-button {
                    min-width: 48px !important;
                    min-height: 48px !important;
                    font-size: 18px !important;
                    -webkit-tap-highlight-color: transparent;
                    touch-action: manipulation;
                }
                
                .quiz-control-bar .control-button:active {
                    transform: scale(0.9);
                }
                
                .quiz-question-container {
                    padding: 16px !important;
                    font-size: 16px !important;
                }
                
                .quiz-question-text {
                    font-size: 17px !important;
                    line-height: 1.6 !important;
                }
                
                .quiz-options {
                    gap: 10px !important;
                }
                
                .quiz-option {
                    min-height: 56px !important;
                    padding: 14px 16px !important;
                    font-size: 15px !important;
                    -webkit-tap-highlight-color: transparent;
                    touch-action: manipulation;
                }
                
                .quiz-option:active {
                    transform: scale(0.98);
                }
                
                .quiz-navigation {
                    padding: 12px !important;
                    gap: 10px !important;
                }
                
                .quiz-navigation button {
                    min-height: 52px !important;
                    font-size: 16px !important;
                    padding: 14px 20px !important;
                    -webkit-tap-highlight-color: transparent;
                    touch-action: manipulation;
                }
                
                .quiz-navigation button:active {
                    transform: scale(0.95);
                }
                
                .quiz-timer-text {
                    font-size: 20px !important;
                }
                
                /* 이미지 줌 모바일 최적화 */
                .image-zoom-overlay {
                    padding: 10px !important;
                }
                
                .image-zoom-overlay button {
                    min-height: 52px !important;
                    min-width: 100px !important;
                    font-size: 16px !important;
                    padding: 14px 20px !important;
                }
                
                /* 결과 화면 */
                .quiz-complete-btns {
                    display: flex !important;
                    flex-direction: column !important;
                    gap: 12px !important;
                    padding: 16px !important;
                }
                
                .quiz-complete-btns button {
                    min-height: 52px !important;
                    width: 100% !important;
                    font-size: 16px !important;
                }
                
                /* 상단 통계 그리드 */
                .quiz-modal .statsGrid {
                    grid-template-columns: repeat(2, 1fr) !important;
                    gap: 8px !important;
                }
                
                /* 텍스트 선택 활성화 */
                .quiz-question-text,
                .quiz-option-text {
                    user-select: text;
                    -webkit-user-select: text;
                }
            }
            `;
            document.head.appendChild(style);
        }
        
        if (this.questions.length === 0) {
            contentEl.createEl('h2', { text: '퀴즈 없음' });
            contentEl.createEl('p', { text: '표시할 문제가 없습니다.' });
            const closeBtn = contentEl.createEl('button', { text: '닫기', cls: 'mod-cta' });
            closeBtn.onclick = () => this.close();
            return;
        }
        
        if (this.options.shuffleQuestions) {
            this.questions = this.shuffleArray(this.questions);
        }
        
        this.showQuestion();
    }

    showQuestion() {
        const { contentEl } = this;
        contentEl.empty();
        
        const question = this.questions[this.currentIndex];
        if (!question) {
            this.showResults();
            return;
        }
        
        // 북마크 모드일 때 상단 통계 패널
        if (this.folderName === '⭐ 북마크' || this.options.bookmarkOnly) {
            const statsPanel = contentEl.createDiv();
            statsPanel.style.cssText = `
                background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
                padding: 16px 20px;
                border-bottom: 3px solid #f59e0b;
                box-shadow: 0 2px 8px rgba(251, 191, 36, 0.2);
            `;
            
            const statsHeader = statsPanel.createDiv();
            statsHeader.style.cssText = `
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 12px;
            `;
            
            const titleDiv = statsHeader.createDiv();
            titleDiv.style.cssText = 'font-size: 18px; font-weight: 700; color: white; display: flex; align-items: center; gap: 8px;';
            titleDiv.innerHTML = '<span style="font-size: 22px;">⭐</span><span>북마크 퀴즈</span>';
            
            const progressDiv = statsHeader.createDiv();
            progressDiv.style.cssText = 'font-size: 14px; color: rgba(255,255,255,0.95); font-weight: 600;';
            progressDiv.textContent = `${this.currentIndex + 1} / ${this.questions.length} 문제`;
            
            const statsGrid = statsPanel.createDiv();
            statsGrid.style.cssText = `
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 12px;
            `;
            
            let totalCorrect = 0;
            let totalWrong = 0;
            let totalAttempts = 0;
            
            this.questions.forEach(q => {
                totalCorrect += q.correctCount || 0;
                totalWrong += q.wrongCount || 0;
            });
            totalAttempts = totalCorrect + totalWrong;
            
            const accuracy = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;
            
            const createStat = (icon, label, value, subtext = '') => {
                const statBox = statsGrid.createDiv();
                statBox.style.cssText = `
                    background: rgba(255, 255, 255, 0.25);
                    padding: 10px;
                    border-radius: 8px;
                    text-align: center;
                    border: 1px solid rgba(255, 255, 255, 0.3);
                    backdrop-filter: blur(10px);
                `;
                
                const iconEl = statBox.createDiv();
                iconEl.style.cssText = 'font-size: 18px; margin-bottom: 4px;';
                iconEl.textContent = icon;
                
                const valueEl = statBox.createDiv();
                valueEl.style.cssText = 'font-size: 20px; font-weight: 700; color: white; margin-bottom: 2px;';
                valueEl.textContent = value;
                
                const labelEl = statBox.createDiv();
                labelEl.style.cssText = 'font-size: 11px; color: rgba(255,255,255,0.9); font-weight: 500;';
                labelEl.textContent = label;
                
                if (subtext) {
                    const subtextEl = statBox.createDiv();
                    subtextEl.style.cssText = 'font-size: 10px; color: rgba(255,255,255,0.75); margin-top: 2px;';
                    subtextEl.textContent = subtext;
                }
            };
            
            createStat('📊', '북마크 총계', this.questions.length, `개 문제`);
            createStat('✅', '정답', `${totalCorrect}회`, `총 시도`);
            createStat('❌', '오답', `${totalWrong}회`, `총 시도`);
            createStat('🎯', '정답률', `${accuracy}%`, totalAttempts > 0 ? `${totalAttempts}회 시도` : '미시도');
        }
        
        // 상단 컨트롤 바 (버튼들만)
        const controlBar = contentEl.createDiv({ cls: 'quiz-control-bar' });
        controlBar.style.cssText = `
            display: flex;
            gap: 6px;
            padding: 10px;
            background: var(--background-secondary);
            border-bottom: 1px solid var(--background-modifier-border);
            justify-content: center;
            align-items: center;
            flex-wrap: wrap;
        `;
        
        const leftButtons = controlBar.createDiv({ cls: 'control-buttons' });
        leftButtons.style.cssText = 'display: flex; gap: 6px; flex-wrap: wrap; justify-content: center;';
        
        // 리본 메뉴 버튼
        const ribbonBtn = leftButtons.createEl('button', { text: '≡', cls: 'control-button' });
        ribbonBtn.style.cssText = `
            width: 44px;
            height: 44px;
            font-size: 20px;
            border: none;
            border-radius: 8px;
            background: var(--interactive-accent);
            color: var(--text-on-accent);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        ribbonBtn.title = '메뉴';
        ribbonBtn.onclick = (e) => {
            const menu = new Menu();
            
            menu.addItem((item) => {
                item.setTitle('← 대시보드')
                    .setIcon('home')
                    .onClick(() => {
                        this.close();
                    });
            });
            
            menu.addSeparator();
            
            menu.addItem((item) => {
                item.setTitle('🕒 최근 수정한 문제')
                    .setIcon('clock')
                    .onClick(async () => {
                        const recentModal = new Modal(this.app);
                        recentModal.titleEl.setText('🕒 최근 수정한 문제');
                        
                        const content = recentModal.contentEl;
                        content.style.cssText = 'padding: 20px; max-width: 600px;';
                        
                        // 모든 퀴즈 파일 가져오기
                        const quizFolder = `${this.plugin.settings.clozeFolder}/QuizQuestions`;
                        const allFiles = this.app.vault.getMarkdownFiles()
                            .filter(f => f.path.startsWith(quizFolder) && f.extension === 'md');
                        
                        // 수정 시간 순으로 정렬
                        allFiles.sort((a, b) => b.stat.mtime - a.stat.mtime);
                        
                        const recentFiles = allFiles.slice(0, 15);
                        
                        if (recentFiles.length === 0) {
                            content.createEl('p', { text: '최근 수정한 문제가 없습니다.', attr: { style: 'color: var(--text-muted); text-align: center;' }});
                        } else {
                            const listEl = content.createDiv();
                            listEl.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';
                            
                            for (const file of recentFiles) {
                                const question = await this.plugin.parseQuestionFile(file.path);
                                if (!question) continue;
                                
                                const item = listEl.createDiv();
                                item.style.cssText = `
                                    padding: 12px;
                                    background: var(--background-secondary);
                                    border-radius: 8px;
                                    cursor: pointer;
                                    transition: all 0.2s;
                                    border: 1px solid var(--background-modifier-border);
                                `;
                                
                                const titleDiv = item.createDiv();
                                titleDiv.style.cssText = 'font-weight: 600; margin-bottom: 4px;';
                                titleDiv.textContent = question.question.substring(0, 50) + (question.question.length > 50 ? '...' : '');
                                
                                const metaDiv = item.createDiv();
                                metaDiv.style.cssText = 'font-size: 12px; color: var(--text-muted);';
                                const modifiedDate = new Date(file.stat.mtime);
                                metaDiv.textContent = `${question.folder || '기본'} | ${modifiedDate.toLocaleString('ko-KR')}`;
                                
                                item.onmouseenter = () => {
                                    item.style.background = 'var(--background-primary)';
                                    item.style.transform = 'translateX(4px)';
                                };
                                item.onmouseleave = () => {
                                    item.style.background = 'var(--background-secondary)';
                                    item.style.transform = 'translateX(0)';
                                };
                                
                                item.onclick = () => {
                                    recentModal.close();
                                    const editModal = new QuizCreatorModal(this.app, this.plugin, question.folder, question);
                                    editModal.open();
                                };
                            }
                        }
                        
                        const closeBtn = content.createEl('button', { text: '닫기', cls: 'mod-cta' });
                        closeBtn.style.cssText = 'width: 100%; padding: 10px; margin-top: 16px;';
                        closeBtn.onclick = () => recentModal.close();
                        
                        recentModal.open();
                    });
            });
            
            menu.addSeparator();
            
            menu.addItem((item) => {
                item.setTitle('📊 폴더별 학습 기록')
                    .setIcon('chart-line')
                    .onClick(async () => {
                        const statsModal = new Modal(this.app);
                        statsModal.titleEl.setText('📊 폴더별 학습 통계');
                        
                        const content = statsModal.contentEl;
                        content.style.cssText = 'padding: 20px; max-width: 700px;';
                        
                        // 모든 폴더 가져오기
                        const quizFolder = `${this.plugin.settings.clozeFolder}/QuizQuestions`;
                        const quizFolderObj = this.app.vault.getAbstractFileByPath(quizFolder);
                        
                        if (!quizFolderObj || !quizFolderObj.children) {
                            content.createEl('p', { text: '폴더를 찾을 수 없습니다.', attr: { style: 'color: var(--text-muted);' }});
                            const closeBtn = content.createEl('button', { text: '닫기', cls: 'mod-cta' });
                            closeBtn.style.cssText = 'width: 100%; padding: 10px; margin-top: 16px;';
                            closeBtn.onclick = () => statsModal.close();
                            statsModal.open();
                            return;
                        }
                        
                        const folders = quizFolderObj.children
                            .filter(f => f.children)
                            .sort((a, b) => a.name.localeCompare(b.name));
                        
                        // 북마크 폴더 추가 (가상 폴더)
                        const bookmarkFolder = { name: '⭐ 북마크', isVirtual: true };
                        
                        const listEl = content.createDiv();
                        listEl.style.cssText = 'display: flex; flex-direction: column; gap: 12px;';
                        
                        // 북마크 폴더 먼저 표시
                        const allQuestions = await this.plugin.loadAllQuestions();
                        const bookmarkedQuestions = allQuestions.filter(q => q.bookmarked);
                        const totalBookmarked = bookmarkedQuestions.length;
                        let bookmarkedCorrect = 0;
                        let bookmarkedWrong = 0;
                        
                        bookmarkedQuestions.forEach(q => {
                            bookmarkedCorrect += q.correctCount || 0;
                            bookmarkedWrong += q.wrongCount || 0;
                        });
                        
                        const bookmarkedAttempts = bookmarkedCorrect + bookmarkedWrong;
                        const bookmarkedAccuracy = bookmarkedAttempts > 0 ? Math.round((bookmarkedCorrect / bookmarkedAttempts) * 100) : 0;
                        
                        const bookmarkCard = listEl.createDiv();
                        bookmarkCard.style.cssText = `
                            padding: 16px;
                            background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
                            border-radius: 8px;
                            border: 2px solid #fbbf24;
                            transition: transform 0.2s, box-shadow 0.2s;
                        `;
                        bookmarkCard.onmouseover = () => {
                            bookmarkCard.style.transform = 'translateY(-4px)';
                            bookmarkCard.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                        };
                        bookmarkCard.onmouseout = () => {
                            bookmarkCard.style.transform = 'translateY(0)';
                            bookmarkCard.style.boxShadow = 'none';
                        };
                        
                        const bookmarkHeader = bookmarkCard.createDiv();
                        bookmarkHeader.style.cssText = 'font-weight: 600; font-size: 16px; margin-bottom: 8px; color: white;';
                        bookmarkHeader.textContent = '⭐ 북마크';
                        
                        const bookmarkStatsGrid = bookmarkCard.createDiv();
                        bookmarkStatsGrid.style.cssText = 'display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 8px; margin-bottom: 12px;';
                        
                        const createBookmarkStat = (label, value) => {
                            const stat = bookmarkStatsGrid.createDiv();
                            stat.style.cssText = 'text-align: center; padding: 8px; background: rgba(255,255,255,0.2); border-radius: 4px;';
                            stat.createEl('div', { text: value, attr: { style: 'font-size: 1.2em; font-weight: bold; color: white;' }});
                            stat.createEl('div', { text: label, attr: { style: 'font-size: 0.75em; color: rgba(255,255,255,0.9); margin-top: 2px;' }});
                        };
                        
                        createBookmarkStat('총 문제', `${totalBookmarked}개`);
                        createBookmarkStat('정답', `${bookmarkedCorrect}회`);
                        createBookmarkStat('오답', `${bookmarkedWrong}회`);
                        createBookmarkStat('정답률', `${bookmarkedAccuracy}%`);
                        
                        // 북마크 버튼 그룹
                        const bookmarkBtnGroup = bookmarkCard.createDiv();
                        bookmarkBtnGroup.style.cssText = 'display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;';
                        
                        const bookmarkQuizBtn = bookmarkBtnGroup.createEl('button', { text: '🎯 퀴즈' });
                        bookmarkQuizBtn.style.cssText = 'padding: 8px; background: rgba(255,255,255,0.3); color: white; border-radius: 4px; font-weight: 500; font-size: 0.9em; cursor: pointer; border: 1px solid rgba(255,255,255,0.4);';
                        bookmarkQuizBtn.onclick = (e) => {
                            e.stopPropagation();
                            statsModal.close();
                            const quizOptions = {
                                enableTimer: true,
                                timerPerQuestion: 30,
                                shuffleQuestions: true,
                                shuffleOptions: true,
                                bookmarkOnly: true
                            };
                            new QuizModal(this.app, this.plugin, '⭐ 북마크', bookmarkedQuestions, quizOptions).open();
                        };
                        
                        const bookmarkCreateBtn = bookmarkBtnGroup.createEl('button', { text: '➕ 생성' });
                        bookmarkCreateBtn.style.cssText = 'padding: 8px; background: rgba(255,255,255,0.3); color: white; border-radius: 4px; font-weight: 500; font-size: 0.9em; cursor: pointer; border: 1px solid rgba(255,255,255,0.4);';
                        bookmarkCreateBtn.onclick = (e) => {
                            e.stopPropagation();
                            statsModal.close();
                            new QuizCreatorModal(this.app, this.plugin, '북마크').open();
                        };
                        
                        const bookmarkListBtn = bookmarkBtnGroup.createEl('button', { text: '📋 목록' });
                        bookmarkListBtn.style.cssText = 'padding: 8px; background: rgba(255,255,255,0.3); color: white; border-radius: 4px; font-weight: 500; font-size: 0.9em; cursor: pointer; border: 1px solid rgba(255,255,255,0.4);';
                        bookmarkListBtn.onclick = async (e) => {
                            e.stopPropagation();
                            if (bookmarkedQuestions.length > 0) {
                                statsModal.close();
                                const listModal = new Modal(this.app);
                                listModal.titleEl.setText('📋 ⭐ 북마크 문제 목록');
                                const content = listModal.contentEl;
                                content.style.cssText = 'padding: 20px;';
                                
                                const questionList = content.createDiv();
                                questionList.style.cssText = 'display: flex; flex-direction: column; gap: 8px; max-height: 60vh; overflow-y: auto;';
                                
                                bookmarkedQuestions.forEach((q, idx) => {
                                    const item = questionList.createDiv();
                                    item.style.cssText = 'padding: 12px; background: var(--background-secondary); border-radius: 8px; cursor: pointer; transition: all 0.2s;';
                                    item.textContent = `${idx + 1}. ${q.question.substring(0, 60)}${q.question.length > 60 ? '...' : ''}`;
                                    item.onmouseenter = () => item.style.background = 'var(--background-modifier-hover)';
                                    item.onmouseleave = () => item.style.background = 'var(--background-secondary)';
                                    item.onclick = () => {
                                        listModal.close();
                                        new QuizCreatorModal(this.app, this.plugin, q.folder, q).open();
                                    };
                                });
                                
                                listModal.open();
                            } else {
                                new Notice('북마크된 문제가 없습니다.');
                            }
                        };
                        
                        const bookmarkDetailBtn = bookmarkBtnGroup.createEl('button', { text: '📊 기록' });
                        bookmarkDetailBtn.style.cssText = 'padding: 8px; background: rgba(255,255,255,0.3); color: white; border-radius: 4px; font-weight: 500; font-size: 0.9em; cursor: pointer; border: 1px solid rgba(255,255,255,0.4);';
                        bookmarkDetailBtn.onclick = async (e) => {
                            e.stopPropagation();
                            statsModal.close();
                            const bookmarkFiles = [];
                            for (const q of bookmarkedQuestions) {
                                const file = this.app.vault.getAbstractFileByPath(q.filePath);
                                if (file) bookmarkFiles.push(file);
                            }
                            new FolderDetailModal(this.app, this.plugin, '⭐ 북마크', null, bookmarkFiles).open();
                        };
                        
                        for (const folderObj of folders) {
                            const folderName = folderObj.name;
                            const files = folderObj.children.filter(f => f.extension === 'md');
                            const totalCount = files.length;
                            
                            let correctCount = 0;
                            let wrongCount = 0;
                            
                            for (const file of files) {
                                try {
                                    const fileContent = await this.app.vault.read(file);
                                    const statsMatch = fileContent.match(/## 통계\n([\s\S]*?)(?=\n##|\n---|$)/);
                                    if (statsMatch) {
                                        const statsContent = statsMatch[1];
                                        const wrongMatch = statsContent.match(/오답:\s*(\d+)/);
                                        const correctMatch = statsContent.match(/정답:\s*(\d+)/);
                                        
                                        if (wrongMatch) {
                                            wrongCount += parseInt(wrongMatch[1]);
                                        }
                                        if (correctMatch) {
                                            correctCount += parseInt(correctMatch[1]);
                                        }
                                    } else {
                                        // 통계 섹션이 없는 경우 무시
                                    }
                                } catch (err) {
                                    console.error('Error reading file:', err);
                                }
                            }
                            
                            const folderTotalAttempts = correctCount + wrongCount;
                            const accuracy = folderTotalAttempts > 0 ? Math.round((correctCount / folderTotalAttempts) * 100) : 0;
                            
                            const folderCard = listEl.createDiv();
                            folderCard.style.cssText = `
                                padding: 16px;
                                background: var(--background-secondary);
                                border-radius: 8px;
                                border: 1px solid var(--background-modifier-border);
                                transition: transform 0.2s, box-shadow 0.2s;
                            `;
                            folderCard.onmouseenter = () => {
                                folderCard.style.transform = 'translateY(-4px)';
                                folderCard.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                            };
                            folderCard.onmouseleave = () => {
                                folderCard.style.transform = 'translateY(0)';
                                folderCard.style.boxShadow = 'none';
                            };
                            
                            const folderHeader = folderCard.createDiv();
                            folderHeader.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;';
                            
                            const folderTitle = folderHeader.createEl('h4', { text: `📁 ${folderName}` });
                            folderTitle.style.cssText = 'margin: 0; font-size: 1.1em;';
                            
                            const folderCount = folderHeader.createEl('span', { text: `${totalCount}개 문제` });
                            folderCount.style.cssText = 'font-size: 0.85em; color: var(--text-muted);';
                            
                            const statsGrid = folderCard.createDiv();
                            statsGrid.style.cssText = 'display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 12px; padding: 12px; background: var(--background-primary); border-radius: 6px;';
                            
                            const createStat = (label, value, color) => {
                                const stat = statsGrid.createDiv();
                                stat.style.cssText = 'text-align: center;';
                                stat.createEl('div', { text: value, attr: { style: `font-size: 1.2em; font-weight: bold; color: ${color};` }});
                                stat.createEl('div', { text: label, attr: { style: 'font-size: 0.75em; color: var(--text-muted); margin-top: 2px;' }});
                            };
                            
                            createStat('시도', `${folderTotalAttempts}회`, 'var(--text-accent)');
                            createStat('정답률', `${accuracy}%`, accuracy >= 70 ? 'var(--text-success)' : 'var(--text-warning)');
                            createStat('학습시간', '0분', 'var(--text-muted)');
                            
                            // 버튼 그룹
                            const btnGroup = folderCard.createDiv();
                            btnGroup.style.cssText = 'display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;';
                            
                            // 퀴즈 시작 버튼
                            const quizBtn = btnGroup.createEl('button', { text: '🎯 퀴즈' });
                            quizBtn.style.cssText = 'padding: 8px; background: var(--interactive-accent); color: var(--text-on-accent); border-radius: 4px; font-weight: 500; font-size: 0.9em; cursor: pointer;';
                            quizBtn.onclick = () => {
                                statsModal.close();
                                new QuizModeModal(this.app, this.plugin, folderObj.path).open();
                            };
                            
                            // 새 문제 생성 버튼
                            const createBtn = btnGroup.createEl('button', { text: '➕ 생성' });
                            createBtn.style.cssText = 'padding: 8px; background: var(--color-green); color: white; border-radius: 4px; font-weight: 500; font-size: 0.9em; cursor: pointer;';
                            createBtn.onclick = () => {
                                statsModal.close();
                                new QuizCreatorModal(this.app, this.plugin, folderName).open();
                            };
                            
                            // 목록 버튼
                            const listBtn = btnGroup.createEl('button', { text: '📋 목록' });
                            listBtn.style.cssText = 'padding: 8px; background: var(--background-modifier-border); border: none; border-radius: 4px; font-weight: 500; font-size: 0.9em; cursor: pointer;';
                            listBtn.onclick = async () => {
                                const folderQuestions = allQuestions.filter(q => (q.folder || '기본') === folderName);
                                if (folderQuestions.length > 0) {
                                    statsModal.close();
                                    const listModal = new Modal(this.app);
                                    listModal.titleEl.setText(`📋 ${folderName} 문제 목록`);
                                    const content = listModal.contentEl;
                                    content.style.cssText = 'padding: 20px;';
                                    
                                    const questionList = content.createDiv();
                                    questionList.style.cssText = 'display: flex; flex-direction: column; gap: 8px; max-height: 60vh; overflow-y: auto;';
                                    
                                    folderQuestions.forEach((q, idx) => {
                                        const item = questionList.createDiv();
                                        item.style.cssText = 'padding: 12px; background: var(--background-secondary); border-radius: 8px; cursor: pointer; transition: all 0.2s;';
                                        item.textContent = `${idx + 1}. ${q.question.substring(0, 60)}${q.question.length > 60 ? '...' : ''}`;
                                        item.onmouseenter = () => item.style.background = 'var(--background-modifier-hover)';
                                        item.onmouseleave = () => item.style.background = 'var(--background-secondary)';
                                        item.onclick = () => {
                                            listModal.close();
                                            new QuizCreatorModal(this.app, this.plugin, q.folder, q).open();
                                        };
                                    });
                                    
                                    listModal.open();
                                } else {
                                    new Notice('폴더에 문제가 없습니다.');
                                }
                            };
                            
                            // 상세 기록 버튼
                            const detailBtn = btnGroup.createEl('button', { text: '📊 기록' });
                            detailBtn.style.cssText = 'padding: 8px; background: var(--background-secondary); border-radius: 4px; font-size: 0.9em; cursor: pointer;';
                            detailBtn.onclick = () => {
                                statsModal.close();
                                new FolderDetailModal(this.app, this.plugin, folderName, folderObj.path, files).open();
                            };
                        }
                        
                        const closeBtn = content.createEl('button', { text: '닫기', cls: 'mod-cta' });
                        closeBtn.style.cssText = 'width: 100%; padding: 10px; margin-top: 16px;';
                        closeBtn.onclick = () => statsModal.close();
                        
                        statsModal.open();
                    });
            });
            
            menu.addSeparator();
            
            menu.addItem((item) => {
                item.setTitle(question.bookmarked ? '⭐ 북마크됨' : '☆ 북마크')
                    .setIcon('star')
                    .onClick(async () => {
                        const updatedQuestion = await this.plugin.toggleBookmark(question);
                        if (updatedQuestion) {
                            question.bookmarked = updatedQuestion.bookmarked;
                            this.questions[this.currentIndex].bookmarked = updatedQuestion.bookmarked;
                            new Notice(question.bookmarked ? '⭐ 북마크 추가' : '북마크 제거');
                            this.showQuestion();
                        }
                    });
            });
            
            menu.addItem((item) => {
                item.setTitle('✏️ 편집')
                    .setIcon('pencil')
                    .onClick(() => {
                        const editModal = new QuizCreatorModal(this.app, this.plugin, question.folder, question);
                        editModal.open();
                        editModal.onClose = () => {
                            this.showQuestion();
                        };
                    });
            });
            
            menu.addItem((item) => {
                item.setTitle('🗑️ 삭제')
                    .setIcon('trash')
                    .onClick(async () => {
                        if (confirm(`"${question.question}" 문제를 정말 삭제하시겠습니까?`)) {
                            const file = this.app.vault.getAbstractFileByPath(question.filePath);
                            if (file) {
                                await this.app.vault.delete(file);
                                new Notice('✅ 문제가 삭제되었습니다');
                                
                                this.questions.splice(this.currentIndex, 1);
                                
                                if (this.questions.length === 0) {
                                    this.close();
                                    return;
                                }
                                
                                if (this.currentIndex >= this.questions.length) {
                                    this.currentIndex = this.questions.length - 1;
                                }
                                
                                this.showQuestion();
                            }
                        }
                    });
            });
            
            menu.showAtMouseEvent(e);
        };
        
        // 이전 버튼
        const prevBtn = leftButtons.createEl('button', { text: '◀️', cls: 'control-button' });
        prevBtn.style.cssText = ribbonBtn.style.cssText;
        prevBtn.title = '이전';
        prevBtn.disabled = this.currentIndex === 0;
        if (prevBtn.disabled) {
            prevBtn.style.opacity = '0.5';
            prevBtn.style.cursor = 'not-allowed';
        }
        prevBtn.onclick = () => {
            if (this.currentIndex > 0) {
                clearInterval(this.timerInterval);
                this.currentIndex--;
                this.timeLeft = this.options.timerPerQuestion || 30;
                this.showQuestion();
            }
        };
        
        // 일시정지 버튼
        const pauseBtn = leftButtons.createEl('button', { text: this.isPaused ? '▶️' : '⏸️', cls: 'control-button' });
        pauseBtn.style.cssText = ribbonBtn.style.cssText;
        pauseBtn.title = this.isPaused ? '재개' : '일시정지';
        pauseBtn.onclick = () => {
            this.togglePause();
            pauseBtn.setText(this.isPaused ? '▶️' : '⏸️');
            pauseBtn.title = this.isPaused ? '재개' : '일시정지';
        };
        
        // 다음 버튼
        const nextBtn = leftButtons.createEl('button', { text: '▶️', cls: 'control-button' });
        nextBtn.style.cssText = ribbonBtn.style.cssText;
        nextBtn.title = '다음';
        nextBtn.disabled = this.currentIndex >= this.questions.length - 1;
        if (nextBtn.disabled) {
            nextBtn.style.opacity = '0.5';
            nextBtn.style.cursor = 'not-allowed';
        }
        nextBtn.onclick = () => {
            if (this.currentIndex < this.questions.length - 1) {
                clearInterval(this.timerInterval);
                this.currentIndex++;
                this.timeLeft = this.options.timerPerQuestion || 30;
                this.showQuestion();
            }
        };
        
        // 폴더 관리 버튼
        const folderBtn = leftButtons.createEl('button', { text: '📁', cls: 'control-button' });
        folderBtn.style.cssText = ribbonBtn.style.cssText;
        folderBtn.title = '폴더 관리';
        folderBtn.onclick = async (e) => {
            const menu = new Menu();
            
            // 현재 폴더 표시
            const currentFolder = this.questions[this.currentIndex]?.folder || '기본';
            menu.addItem((item) => {
                item.setTitle(`📍 현재: ${currentFolder}`)
                    .setIcon('folder')
                    .setDisabled(true);
            });
            
            menu.addSeparator();
            
            // 모든 폴더 가져오기 및 통계
            const quizFolder = `${this.plugin.settings.clozeFolder}/QuizQuestions`;
            const quizFolderObj = this.app.vault.getAbstractFileByPath(quizFolder);
            
            if (quizFolderObj && quizFolderObj.children) {
                const folders = quizFolderObj.children
                    .filter(f => f.children)
                    .sort((a, b) => a.name.localeCompare(b.name));
                
                for (const folderObj of folders) {
                    const folderName = folderObj.name;
                    
                    // 폴더별 문제 개수 계산
                    const files = folderObj.children.filter(f => f.extension === 'md');
                    const totalCount = files.length;
                    
                    // 폴더별 학습 통계 계산
                    let correctCount = 0;
                    let wrongCount = 0;
                    
                    for (const file of files) {
                        try {
                            const content = await this.app.vault.read(file);
                            // ## 통계 섹션에서 오답/정답 횟수 찾기
                            const statsMatch = content.match(/## 통계\n([\s\S]*?)(?=\n##|\n---|$)/);
                            if (statsMatch) {
                                const statsContent = statsMatch[1];
                                const wrongMatch = statsContent.match(/오답:\s*(\d+)/);
                                const correctMatch = statsContent.match(/정답:\s*(\d+)/);
                                
                                if (wrongMatch) wrongCount += parseInt(wrongMatch[1]);
                                if (correctMatch) correctCount += parseInt(correctMatch[1]);
                            }
                        } catch (err) {
                            console.error('Error reading file:', err);
                        }
                    }
                    
                    const totalAttempts = correctCount + wrongCount;
                    const accuracy = totalAttempts > 0 ? Math.round((correctCount / totalAttempts) * 100) : 0;
                    
                    menu.addItem((item) => {
                        item.setTitle(`${folderName} (문제: ${totalCount}, 정답률: ${accuracy}%)`)
                            .setIcon('folder')
                            .onClick(async () => {
                                // 폴더별 상세 정보 표시
                                const statsModal = new Modal(this.app);
                                statsModal.titleEl.setText(`📊 ${folderName} 학습 기록`);
                                
                                const content = statsModal.contentEl;
                                content.style.cssText = 'padding: 20px;';
                                
                                const statsDiv = content.createDiv();
                                statsDiv.style.cssText = 'display: grid; gap: 12px; margin-bottom: 20px;';
                                
                                // 통계 카드
                                const createStatCard = (label, value, color) => {
                                    const card = statsDiv.createDiv();
                                    card.style.cssText = `
                                        padding: 16px;
                                        background: var(--background-secondary);
                                        border-left: 4px solid ${color};
                                        border-radius: 6px;
                                    `;
                                    card.createEl('div', { text: label, attr: { style: 'font-size: 13px; color: var(--text-muted); margin-bottom: 4px;' }});
                                    card.createEl('div', { text: value, attr: { style: 'font-size: 24px; font-weight: 700;' }});
                                };
                                
                                createStatCard('📚 전체 문제', `${totalCount}개`, 'var(--interactive-accent)');
                                createStatCard('✅ 정답 횟수', `${correctCount}회`, 'var(--text-success)');
                                createStatCard('❌ 오답 횟수', `${wrongCount}회`, 'var(--text-error)');
                                createStatCard('📊 정답률', `${accuracy}%`, accuracy >= 70 ? 'var(--text-success)' : 'var(--text-warning)');
                                
                                const closeBtn = content.createEl('button', { text: '닫기', cls: 'mod-cta' });
                                closeBtn.style.cssText = 'width: 100%; padding: 10px; margin-top: 12px;';
                                closeBtn.onclick = () => statsModal.close();
                                
                                statsModal.open();
                            });
                    });
                }
                
                if (folders.length === 0) {
                    menu.addItem((item) => {
                        item.setTitle('폴더 없음')
                            .setDisabled(true);
                    });
                }
            }
            
            menu.showAtMouseEvent(e);
        };
        
        // 타이머 설정 & 편집 버튼
        if (this.options.enableTimer) {
            const timerSettingsBtn = leftButtons.createEl('button', { text: '⏱️', cls: 'control-button' });
            timerSettingsBtn.style.cssText = `
                width: 44px;
                height: 44px;
                font-size: 18px;
                border: none;
                border-radius: 8px;
                background: var(--background-primary-alt);
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s;
            `;
            timerSettingsBtn.title = '타이머 설정';
            timerSettingsBtn.onclick = () => {
                const settingsModal = new Modal(this.app);
                settingsModal.titleEl.setText('⏱️ 타이머 설정');
                
                const content = settingsModal.contentEl;
                content.style.cssText = 'padding: 20px; min-width: 400px;';
                
                // 현재 타이머 정보
                const timerInfo = content.createDiv();
                timerInfo.style.cssText = 'margin-bottom: 20px; padding: 12px; background: var(--background-secondary); border-radius: 8px;';
                
                const currentTimeText = timerInfo.createEl('div');
                currentTimeText.style.cssText = 'font-weight: 600; margin-bottom: 8px; font-size: 14px;';
                currentTimeText.textContent = `남은 시간: ${this.timeLeft}초`;
                
                // 타이머 길이 조절 (숫자 입력)
                const inputContainer = content.createDiv();
                inputContainer.style.cssText = 'margin-bottom: 20px;';
                
                const inputLabel = inputContainer.createEl('label');
                inputLabel.style.cssText = 'display: block; margin-bottom: 8px; font-weight: 500;';
                inputLabel.textContent = '문제당 시간 설정 (초)';
                
                const inputWrapper = inputContainer.createDiv();
                inputWrapper.style.cssText = 'display: flex; align-items: center; gap: 12px;';
                
                const timerInput = inputWrapper.createEl('input', { type: 'number' });
                timerInput.value = String(this.options.timerPerQuestion);
                timerInput.min = '10';
                timerInput.max = '300';
                timerInput.step = '5';
                timerInput.style.cssText = 'flex: 1; padding: 10px; font-size: 18px; text-align: center; border: 2px solid var(--background-modifier-border); border-radius: 8px; font-weight: 600;';
                
                const applyBtn = inputWrapper.createEl('button', { text: '적용', cls: 'mod-cta' });
                applyBtn.style.cssText = 'padding: 10px 20px; font-weight: 600;';
                applyBtn.onclick = () => {
                    const newValue = parseInt(timerInput.value);
                    if (newValue >= 10 && newValue <= 300) {
                        this.options.timerPerQuestion = newValue;
                        this.plugin.settings.defaultTimerPerQuestion = newValue;
                        this.plugin.saveSettings();
                        new Notice(`타이머 설정: ${newValue}초로 변경되었습니다`);
                    } else {
                        new Notice('10~300초 사이의 값을 입력하세요');
                        timerInput.value = String(this.options.timerPerQuestion);
                    }
                };
                
                const helpText = inputContainer.createEl('div');
                helpText.style.cssText = 'font-size: 12px; color: var(--text-muted); margin-top: 6px;';
                helpText.textContent = '* 10~300초 사이의 값을 입력할 수 있습니다';
                
                // 일시정지/재개 버튼
                const pauseBtn = content.createEl('button', { text: this.isPaused ? '▶️ 재개' : '⏸️ 일시정지', cls: 'mod-cta' });
                pauseBtn.style.cssText = 'width: 100%; padding: 12px; margin-bottom: 12px; font-size: 16px;';
                pauseBtn.onclick = () => {
                    this.togglePause();
                    pauseBtn.textContent = this.isPaused ? '▶️ 재개' : '⏸️ 일시정지';
                    currentTimeText.textContent = `남은 시간: ${this.timeLeft}초`;
                };
                
                settingsModal.open();
            };
            timerSettingsBtn.onmouseenter = () => timerSettingsBtn.style.background = 'var(--interactive-accent)';
            timerSettingsBtn.onmouseleave = () => timerSettingsBtn.style.background = 'var(--background-primary-alt)';
        }
        
        // 편집 버튼 (타이머 설정 옆)
        const editBtn = leftButtons.createEl('button', { text: '✏️', cls: 'control-button' });
        editBtn.style.cssText = `
            width: 44px;
            height: 44px;
            font-size: 18px;
            border: none;
            border-radius: 8px;
            background: var(--background-primary-alt);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
        `;
        editBtn.title = '현재 문제 편집';
        editBtn.onclick = () => {
            this.close();
            new QuizCreatorModal(this.app, this.plugin, question.folder, question).open();
        };
        editBtn.onmouseenter = () => editBtn.style.background = 'var(--interactive-accent)';
        editBtn.onmouseleave = () => editBtn.style.background = 'var(--background-primary-alt)';
        
        // 진행 상태 표시
        const progressBar = contentEl.createDiv({ cls: 'quiz-progress-bar' });
        progressBar.style.cssText = `
            height: 8px;
            background: var(--background-modifier-border);
            position: relative;
        `;
        
        const progressFill = progressBar.createDiv({ cls: 'progress-fill' });
        const progress = ((this.currentIndex + 1) / this.questions.length) * 100;
        progressFill.style.cssText = `
            height: 100%;
            width: ${progress}%;
            background: var(--interactive-accent);
            transition: width 0.3s ease;
        `;
        
        const progressText = contentEl.createDiv({ cls: 'quiz-progress-text' });
        progressText.style.cssText = `
            text-align: center;
            padding: 8px;
            font-weight: 600;
            background: var(--background-primary);
        `;
        progressText.textContent = `문제 ${this.currentIndex + 1}/${this.questions.length}`;
        
        // 타이머 바 표시
        if (this.options.enableTimer) {
            const timerBarContainer = contentEl.createDiv({ cls: 'quiz-timer-bar-container' });
            timerBarContainer.style.cssText = `
                padding: 12px 16px;
                background: var(--background-secondary);
            `;
            
            // 타이머 정보 헤더
            const timerHeader = timerBarContainer.createDiv();
            timerHeader.style.cssText = `
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 8px;
            `;
            
            const timerLabel = timerHeader.createEl('span');
            timerLabel.style.cssText = 'font-size: 14px; font-weight: 600; color: var(--text-muted);';
            timerLabel.textContent = '⏱️ 남은 시간';
            
            const timerValue = timerHeader.createEl('span');
            timerValue.style.cssText = 'font-size: 18px; font-weight: 700; color: var(--interactive-accent);';
            timerValue.textContent = `${this.timeLeft}초`;
            
            // 타이머 프로그레스 바
            const timerBarTrack = timerBarContainer.createDiv();
            timerBarTrack.style.cssText = `
                height: 12px;
                background: var(--background-modifier-border);
                border-radius: 6px;
                overflow: hidden;
                position: relative;
            `;
            
            const timerBarFill = timerBarTrack.createDiv();
            const initialProgress = (this.timeLeft / this.options.timerPerQuestion) * 100;
            timerBarFill.style.cssText = `
                height: 100%;
                width: ${initialProgress}%;
                background: linear-gradient(90deg, #4ade80 0%, #22c55e 100%);
                transition: width 0.3s ease, background 0.3s ease;
                border-radius: 6px;
            `;
            
            if (!this.timerInterval) {
                this.timerInterval = setInterval(() => {
                    if (!this.isPaused) {
                        this.timeLeft--;
                        timerValue.textContent = `${this.timeLeft}초`;
                        
                        const progress = (this.timeLeft / this.options.timerPerQuestion) * 100;
                        timerBarFill.style.width = `${Math.max(0, progress)}%`;
                        
                        // 시간에 따라 색상 변경
                        if (this.timeLeft <= 5) {
                            timerBarFill.style.background = 'linear-gradient(90deg, #ef4444 0%, #dc2626 100%)';
                            timerValue.style.color = 'var(--text-error)';
                        } else if (this.timeLeft <= 10) {
                            timerBarFill.style.background = 'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)';
                            timerValue.style.color = '#f59e0b';
                        }
                        
                        if (this.timeLeft <= 0) {
                            clearInterval(this.timerInterval);
                            this.timerInterval = null;
                            this.selectAnswer(null, true);
                        }
                    }
                }, 1000);
            }
        }
        
        // 문제 영역
        const questionContainer = contentEl.createDiv({ cls: 'quiz-question-container' });
        questionContainer.style.cssText = `
            padding: 24px;
            background: var(--background-primary);
            overflow-y: auto;
            max-height: calc(100vh - 250px);
        `;
        
        // 키워드는 문제 풀 때 숨김
        
        // 문제 텍스트
        const questionEl = questionContainer.createDiv('quiz-question');
        questionEl.style.cssText = `
            background: var(--background-primary-alt);
            padding: 20px;
            border-radius: 12px;
            margin-bottom: 20px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        `;
        
        if (question.number) {
            const numberEl = questionEl.createEl('div', { text: question.number });
            numberEl.style.cssText = `
                color: var(--interactive-accent);
                font-weight: 600;
                font-size: 18px;
                margin-bottom: 12px;
            `;
        }
        
        if (question.question) {
            const questionText = questionEl.createEl('p', { text: question.question });
            questionText.style.cssText = `
                font-size: 18px;
                line-height: 1.6;
                margin: 0;
                font-weight: 500;
                cursor: pointer;
                user-select: none;
            `;
            
            // 클릭으로 힌트 표시/숨기기
            if (question.hint || question.hintImage) {
                let hintVisible = false;
                let hintContainer = null;
                
                questionText.onclick = () => {
                    if (!hintContainer) {
                        hintContainer = questionEl.createDiv('hint-container');
                        hintContainer.style.cssText = `
                            margin-top: 12px;
                            padding: 12px 16px;
                            background: var(--background-secondary);
                            border-left: 3px solid var(--interactive-accent);
                            border-radius: 6px;
                        `;
                        
                        const hintLabel = hintContainer.createEl('div', { text: '💡 힌트' });
                        hintLabel.style.cssText = 'font-weight: 600; color: var(--interactive-accent); margin-bottom: 8px; font-size: 14px;';
                        
                        if (question.hint) {
                            const hintText = hintContainer.createEl('p', { text: question.hint });
                            hintText.style.cssText = 'margin: 0; line-height: 1.5; font-size: 15px;';
                        }
                        
                        if (question.hintImage && question.hintImage.trim()) {
                            const hintImageDiv = hintContainer.createDiv();
                            hintImageDiv.style.cssText = 'margin-top: 8px;';
                            
                            const lines = question.hintImage.split('\n').filter(l => l.trim());
                            const hintImageUrls = [];
                            
                            // 모든 힌트 이미지 URL 수집
                            for (const line of lines) {
                                let imageUrl = line.trim();
                                let imageWidth = null;
                                
                                const sizeMatch = line.match(/\|(\d+)\]\]/);
                                if (sizeMatch) imageWidth = sizeMatch[1] + 'px';
                                
                                if (imageUrl.includes('[[') && imageUrl.includes(']]')) {
                                    const match = imageUrl.match(/!\[\[(.+?)(\|\d+)?\]\]/);
                                    if (match && match[1]) {
                                        let imagePath = match[1];
                                        const folderName = question.folder || '기본';
                                        const quizFolder = `${this.plugin.settings.clozeFolder}/QuizQuestions`;
                                        
                                        if (imagePath.startsWith(folderName + '/')) {
                                            imagePath = `${quizFolder}/${imagePath}`;
                                        } else if (!imagePath.startsWith(quizFolder)) {
                                            if (!imagePath.includes('/')) {
                                                imagePath = `${quizFolder}/${folderName}/첨부파일/${imagePath}`;
                                            }
                                        }
                                        
                                        const file = this.app.vault.getAbstractFileByPath(imagePath);
                                        if (file) {
                                            imageUrl = this.app.vault.adapter.getResourcePath(file.path);
                                            hintImageUrls.push({ url: imageUrl, width: imageWidth });
                                        }
                                    }
                                } else if (imageUrl.startsWith('http')) {
                                    hintImageUrls.push({ url: imageUrl, width: imageWidth });
                                }
                            }
                            
                            if (hintImageUrls.length > 0) {
                                let currentHintImageIndex = 0;
                                
                                const imageDisplay = hintImageDiv.createDiv();
                                imageDisplay.style.cssText = 'text-align: center; position: relative;';
                                
                                const img = imageDisplay.createEl('img');
                                img.style.cssText = 'max-width: 100%; max-height: 200px; border-radius: 6px; cursor: pointer;';
                                
                                let imageCounter = null;
                                if (hintImageUrls.length > 1) {
                                    imageCounter = imageDisplay.createDiv();
                                    imageCounter.style.cssText = `
                                        position: absolute;
                                        top: 8px;
                                        right: 8px;
                                        background: rgba(0, 0, 0, 0.6);
                                        color: white;
                                        padding: 4px 8px;
                                        border-radius: 10px;
                                        font-size: 12px;
                                        font-weight: 600;
                                    `;
                                }
                                
                                const updateHintImage = () => {
                                    const currentImage = hintImageUrls[currentHintImageIndex];
                                    img.src = currentImage.url;
                                    if (currentImage.width) {
                                        img.style.maxWidth = currentImage.width;
                                    }
                                    img.onclick = () => this.showImageZoom(currentImage.url, '힌트 이미지');
                                    
                                    if (imageCounter) {
                                        imageCounter.textContent = `${currentHintImageIndex + 1} / ${hintImageUrls.length}`;
                                    }
                                };
                                
                                if (hintImageUrls.length > 1) {
                                    const navContainer = hintImageDiv.createDiv();
                                    navContainer.style.cssText = 'display: flex; justify-content: center; gap: 8px; margin-top: 8px;';
                                    
                                    const prevBtn = navContainer.createEl('button', { text: '◀' });
                                    prevBtn.style.cssText = `
                                        padding: 4px 10px;
                                        background: var(--interactive-accent);
                                        color: var(--text-on-accent);
                                        border: none;
                                        border-radius: 4px;
                                        cursor: pointer;
                                        font-size: 12px;
                                    `;
                                    prevBtn.onclick = () => {
                                        if (currentHintImageIndex > 0) {
                                            currentHintImageIndex--;
                                            updateHintImage();
                                        }
                                    };
                                    
                                    const nextBtn = navContainer.createEl('button', { text: '▶' });
                                    nextBtn.style.cssText = prevBtn.style.cssText;
                                    nextBtn.onclick = () => {
                                        if (currentHintImageIndex < hintImageUrls.length - 1) {
                                            currentHintImageIndex++;
                                            updateHintImage();
                                        }
                                    };
                                }
                                
                                updateHintImage();
                            }
                        }
                    }
                    
                    hintVisible = !hintVisible;
                    hintContainer.style.display = hintVisible ? 'block' : 'none';
                };
            }
        }
        
        // 문제 이미지 (넘김 기능)
        if (question.image && question.image.trim()) {
            const imageSliderContainer = questionEl.createDiv('quiz-image-slider');
            imageSliderContainer.style.cssText = 'margin-top: 16px; position: relative;';
            
            const lines = question.image.split('\n').filter(l => l.trim());
            const imageUrls = [];
            
            // 모든 이미지 URL 수집
            for (const line of lines) {
                let imageUrl = line.trim();
                let imageWidth = null;
                
                const sizeMatch = line.match(/\|(\d+)\]\]/);
                if (sizeMatch) imageWidth = sizeMatch[1] + 'px';
                
                if (imageUrl.includes('[[') && imageUrl.includes(']]')) {
                    const match = imageUrl.match(/!\[\[(.+?)(\|\d+)?\]\]/);
                    if (match && match[1]) {
                        let imagePath = match[1];
                        const folderName = question.folder || '기본';
                        const quizFolder = `${this.plugin.settings.clozeFolder}/QuizQuestions`;
                        
                        if (imagePath.startsWith(folderName + '/')) {
                            imagePath = `${quizFolder}/${imagePath}`;
                        } else if (!imagePath.startsWith(quizFolder)) {
                            if (!imagePath.includes('/')) {
                                imagePath = `${quizFolder}/${folderName}/첨부파일/${imagePath}`;
                            }
                        }
                        
                        const file = this.app.vault.getAbstractFileByPath(imagePath);
                        if (file) {
                            imageUrl = this.app.vault.adapter.getResourcePath(file.path);
                            imageUrls.push({ url: imageUrl, width: imageWidth });
                        }
                    }
                } else if (imageUrl.startsWith('http')) {
                    imageUrls.push({ url: imageUrl, width: imageWidth });
                }
            }
            
            if (imageUrls.length > 0) {
                let currentImageIndex = 0;
                const imageDisplay = imageSliderContainer.createDiv();
                imageDisplay.style.cssText = 'text-align: center; position: relative;';
                const img = imageDisplay.createEl('img');
                img.style.cssText = 'max-width: 100%; max-height: 300px; border-radius: 8px; cursor: pointer; box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);';

                // 이미지 카운터를 바깥에서 선언
                let imageCounter = null;

                const updateImage = () => {
                    const currentImage = imageUrls[currentImageIndex];
                    img.src = currentImage.url;
                    if (currentImage.width) {
                        img.style.maxWidth = currentImage.width;
                    }
                    img.onclick = () => this.showImageZoom(currentImage.url, '문제 이미지');
                    if (imageUrls.length > 1 && imageCounter) {
                        imageCounter.textContent = `${currentImageIndex + 1} / ${imageUrls.length}`;
                    }
                };

                // 이미지 카운터
                if (imageUrls.length > 1) {
                    imageCounter = imageDisplay.createDiv();
                    imageCounter.style.cssText = `
                        position: absolute;
                        top: 8px;
                        right: 8px;
                        background: rgba(0, 0, 0, 0.6);
                        color: white;
                        padding: 4px 12px;
                        border-radius: 12px;
                        font-size: 13px;
                        font-weight: 600;
                    `;
                    // 이전/다음 버튼
                    const navContainer = imageSliderContainer.createDiv();
                    navContainer.style.cssText = 'display: flex; justify-content: center; gap: 12px; margin-top: 12px;';
                    const prevBtn = navContainer.createEl('button', { text: '◀ 이전' });
                    prevBtn.style.cssText = `
                        padding: 6px 16px;
                        background: var(--interactive-accent);
                        color: var(--text-on-accent);
                        border: none;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: 500;
                    `;
                    prevBtn.onclick = () => {
                        if (currentImageIndex > 0) {
                            currentImageIndex--;
                            updateImage();
                        }
                    };
                    
                    const nextBtn = navContainer.createEl('button', { text: '다음 ▶' });
                    nextBtn.style.cssText = prevBtn.style.cssText;
                    nextBtn.onclick = () => {
                        if (currentImageIndex < imageUrls.length - 1) {
                            currentImageIndex++;
                            updateImage();
                        }
                    };
                    
                    updateImage();
                } else {
                    updateImage();
                }
            }
        }
        
        // 선택지
        const optionsEl = questionContainer.createDiv('quiz-options');
        optionsEl.style.cssText = 'margin-top: 24px;';
        
        let options = question.options || [];
        let optionImages = question.optionImages || [];
        
        if (this.options.shuffleOptions) {
            const combined = options.map((opt, idx) => ({ option: opt, image: optionImages[idx] || '', originalIndex: idx }));
            const shuffled = this.shuffleArray(combined);
            options = shuffled.map(item => item.option);
            optionImages = shuffled.map(item => item.image);
            const correctIndex = shuffled.findIndex(item => item.originalIndex === question.answer);
            if (correctIndex !== -1) {
                question.answer = correctIndex;
            }
        }
        
        options.forEach((option, index) => {
            const optionWrapper = optionsEl.createDiv('quiz-option-wrapper');
            optionWrapper.style.cssText = 'margin-bottom: 12px;';
            
            const optionBtn = optionWrapper.createEl('button', { 
                cls: 'quiz-option-btn'
            });
            optionBtn.style.cssText = `
                width: 100%;
                text-align: left;
                padding: 16px 20px;
                font-size: 16px;
                min-height: 56px;
                border-radius: 8px;
                border: 2px solid var(--background-modifier-border);
                background: var(--background-primary-alt);
                cursor: pointer;
                transition: all 0.2s;
                font-weight: 500;
                display: flex;
                flex-direction: column;
                align-items: flex-start;
                gap: 12px;
            `;
            
            // 선택지 텍스트 + 이미지 버튼 컨테이너
            const textContainer = optionBtn.createDiv();
            textContainer.style.cssText = 'display: flex; align-items: center; justify-content: space-between; width: 100%;';
            
            // 선택지 텍스트 (왼쪽)
            const textPart = textContainer.createDiv();
            textPart.style.cssText = 'display: flex; align-items: center; flex: 1;';
            
            const optionNumber = textPart.createEl('span', { text: `${index + 1}. ` });
            optionNumber.style.cssText = 'color: var(--interactive-accent); font-weight: 600; margin-right: 8px;';
            textPart.appendText(option);
            
            // 이미지 버튼 (오른쪽) - 항상 표시
            const imageToggleBtn = textContainer.createEl('button');
            imageToggleBtn.style.cssText = `
                padding: 6px 12px;
                background: var(--interactive-accent);
                color: var(--text-on-accent);
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-size: 13px;
                margin-left: 12px;
                flex-shrink: 0;
                font-weight: 500;
            `;
            
            // 이미지 처리
            if (optionImages[index] && optionImages[index].trim()) {
                const lines = optionImages[index].split('\n').filter(l => l.trim());
                const imageUrls = [];
                
                // 모든 이미지 URL 수집
                for (const line of lines) {
                    let imageUrl = line.trim();
                    let imageWidth = null;
                    
                    const sizeMatch = line.match(/\|(\d+)\]\]/);
                    if (sizeMatch) imageWidth = sizeMatch[1] + 'px';
                    
                    if (imageUrl.includes('[[') && imageUrl.includes(']]')) {
                        const match = imageUrl.match(/!\[\[(.+?)(\|\d+)?\]\]/);
                        if (match && match[1]) {
                            let imagePath = match[1];
                            const folderName = question.folder || '기본';
                            const quizFolder = `${this.plugin.settings.clozeFolder}/QuizQuestions`;
                            
                            if (imagePath.startsWith(folderName + '/')) {
                                imagePath = `${quizFolder}/${imagePath}`;
                            } else if (!imagePath.startsWith(quizFolder)) {
                                if (!imagePath.includes('/')) {
                                    imagePath = `${quizFolder}/${folderName}/첨부파일/${imagePath}`;
                                }
                            }
                            
                            const file = this.app.vault.getAbstractFileByPath(imagePath);
                            if (file) {
                                imageUrl = this.app.vault.adapter.getResourcePath(file.path);
                                imageUrls.push({ url: imageUrl, width: imageWidth });
                            }
                        }
                    } else if (imageUrl.startsWith('http')) {
                        imageUrls.push({ url: imageUrl, width: imageWidth });
                    }
                }
                
                // 이미지 버튼 설정
                if (imageUrls.length > 0) {
                    let currentImageIndex = 0;
                    
                    imageToggleBtn.textContent = imageUrls.length > 1 ? `🖼️ ${imageUrls.length}` : '🖼️';
                    imageToggleBtn.onclick = (e) => {
                        e.stopPropagation();
                        
                        // URL 배열 생성
                        const urls = imageUrls.map(img => img.url);
                        
                        // showImageZoom 메서드 사용
                        this.showImageZoom(urls[0], `선택지 ${index + 1} 이미지`, urls, 0);
                    };
                } else {
                    imageToggleBtn.style.display = 'none';
                }
            } else {
                imageToggleBtn.style.display = 'none';
            }
            
            optionBtn.onmouseenter = () => {
                optionBtn.style.borderColor = 'var(--interactive-accent)';
                optionBtn.style.background = 'var(--background-secondary)';
                optionBtn.style.transform = 'translateX(4px)';
            };
            optionBtn.onmouseleave = () => {
                optionBtn.style.borderColor = 'var(--background-modifier-border)';
                optionBtn.style.background = 'var(--background-primary-alt)';
                optionBtn.style.transform = 'translateX(0)';
            };
            optionBtn.onclick = (e) => {
                const target = e.target;
                
                // 이미지 관련 버튼 클릭 시 무시
                if (target.tagName === 'BUTTON' && target !== optionBtn) {
                    return;
                }
                // 이미지 클릭 시 무시
                if (target.tagName === 'IMG') {
                    return;
                }
                
                // 텍스트 영역 클릭만 답변 선택
                this.selectAnswer(option);
            };
        });
        
        // 북마크 체크박스 (선택지 하단)
        const bookmarkContainer = optionsEl.createDiv();
        bookmarkContainer.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: 8px;
            padding: 12px 16px;
            background: var(--background-secondary);
            border-radius: 8px;
            margin-top: 16px;
            cursor: pointer;
            transition: all 0.2s;
        `;
        
        const bookmarkLabel = bookmarkContainer.createEl('label', { text: '⭐ 북마크에 추가' });
        bookmarkLabel.style.cssText = 'cursor: pointer; font-weight: 500; user-select: none;';
        
        const bookmarkCheckbox = bookmarkContainer.createEl('input', { type: 'checkbox' });
        bookmarkCheckbox.checked = question.bookmarked || false;
        bookmarkCheckbox.style.cssText = `
            width: 20px;
            height: 20px;
            cursor: pointer;
            accent-color: #fbbf24;
        `;
        
        // 체크박스 토글
        const toggleBookmark = async () => {
            const newBookmarkedState = await this.plugin.toggleBookmark(question);
            if (newBookmarkedState !== false) {
                question.bookmarked = newBookmarkedState;
                this.questions[this.currentIndex].bookmarked = newBookmarkedState;
                bookmarkCheckbox.checked = question.bookmarked;
                bookmarkLabel.textContent = question.bookmarked ? '⭐ 북마크에서 제거' : '⭐ 북마크에 추가';
                bookmarkContainer.style.background = question.bookmarked ? 'rgba(251, 191, 36, 0.1)' : 'var(--background-secondary)';
            }
        };
        
        bookmarkCheckbox.onclick = async (e) => {
            e.stopPropagation();
            await toggleBookmark();
        };
        
        bookmarkContainer.onclick = async () => {
            await toggleBookmark();
        };
        
        // 초기 상태 배경 색
        if (question.bookmarked) {
            bookmarkContainer.style.background = 'rgba(251, 191, 36, 0.1)';
            bookmarkLabel.textContent = '⭐ 북마크에서 제거';
        }
    }

    updateTimer(timerEl) {
        if (timerEl) {
            timerEl.textContent = `⏱️ ${this.timeLeft}s`;
            if (this.timeLeft <= 5) {
                timerEl.addClass('quiz-timer-warning');
            }
        }
    }

    togglePause() {
        this.isPaused = !this.isPaused;
        this.showQuestion();
    }

    selectAnswer(answer, timeout = false) {
        const question = this.questions[this.currentIndex];
        const correctOption = question.options[question.answer];
        const isCorrect = !timeout && answer === correctOption;
        
        this.results.push({
            question: question.question || question.keywords?.[0] || '문제',
            userAnswer: timeout ? '시간초과' : answer,
            correctAnswer: correctOption,
            isCorrect: isCorrect,
            timeSpent: (this.options.timerPerQuestion || 30) - this.timeLeft,
            note: question.note || '',
            noteImage: question.noteImage || ''
        });
        
        if (isCorrect) this.score++;
        
        // 통계 업데이트 (파일 기반)
        if (question.filePath) {
            this.plugin.updateQuestionStats(question, isCorrect);
        }
        
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        
        // 정답/오답 모달 표시
        const resultModal = new Modal(this.app);
        resultModal.containerEl.addClass('quiz-result-modal');
        
        const { contentEl: modalContent } = resultModal;
        modalContent.style.cssText = `
            padding: 0;
            border-radius: 16px;
            overflow: hidden;
            max-width: 500px;
        `;
        
        // 헤더 (정답/오답에 따라 색상 변경)
        const modalHeader = modalContent.createDiv({ cls: 'result-modal-header' });
        modalHeader.style.cssText = `
            padding: 32px 24px;
            text-align: center;
            background: ${isCorrect ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'};
            color: white;
        `;
        
        const icon = modalHeader.createEl('div', { text: isCorrect ? '✓' : '✕' });
        icon.style.cssText = `
            font-size: 64px;
            font-weight: bold;
            margin-bottom: 16px;
            text-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
        `;
        
        const title = modalHeader.createEl('h2', { text: isCorrect ? '정답입니다!' : '틀렸습니다' });
        title.style.cssText = `
            margin: 0;
            font-size: 28px;
            font-weight: 700;
            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        `;
        
        // 바디
        const modalBody = modalContent.createDiv({ cls: 'result-modal-body' });
        modalBody.style.cssText = `
            padding: 24px;
            background: var(--background-primary);
        `;

        // 버튼 그룹: 노트 편집, 다시 풀기
        // (중복 선언 방지: btnGroup 제거, buttonContainer만 사용)
        
        if (!isCorrect) {
            const wrongAnswerDiv = modalBody.createDiv();
            wrongAnswerDiv.style.cssText = `
                background: var(--background-primary-alt);
                padding: 16px;
                border-radius: 8px;
                margin-bottom: 16px;
                border-left: 4px solid var(--text-error);
            `;
            
            const wrongLabel = wrongAnswerDiv.createEl('div', { text: '선택한 답' });
            wrongLabel.style.cssText = 'font-size: 12px; color: var(--text-muted); margin-bottom: 8px; font-weight: 600; text-transform: uppercase;';
            
            const wrongText = wrongAnswerDiv.createEl('div', { text: answer || '시간 초과' });
            wrongText.style.cssText = 'font-size: 16px; color: var(--text-error); font-weight: 500;';
        }
        
        const correctAnswerDiv = modalBody.createDiv();
        correctAnswerDiv.style.cssText = `
            background: var(--background-primary-alt);
            padding: 16px;
            border-radius: 8px;
            margin-bottom: 16px;
            border-left: 4px solid var(--text-success);
        `;
        
        const correctLabel = correctAnswerDiv.createEl('div', { text: '정답' });
        correctLabel.style.cssText = 'font-size: 12px; color: var(--text-muted); margin-bottom: 8px; font-weight: 600; text-transform: uppercase;';
        
        const correctText = correctAnswerDiv.createEl('div', { text: correctOption });
        correctText.style.cssText = 'font-size: 18px; color: var(--text-success); font-weight: 600;';
        
        // 노트 표시 (있는 경우)
        if (!isCorrect && (question.note || (question.noteImage && question.noteImage.trim()))) {
            const noteDiv = modalBody.createDiv();
            noteDiv.style.cssText = `
                background: var(--background-secondary);
                padding: 16px;
                border-radius: 8px;
                margin-bottom: 16px;
            `;
            
            const noteLabel = noteDiv.createEl('div', { text: '💡 노트 / 해설' });
            noteLabel.style.cssText = 'font-size: 14px; color: var(--interactive-accent); margin-bottom: 12px; font-weight: 600;';
            
            if (question.note) {
                const noteText = noteDiv.createEl('p', { text: question.note });
                noteText.style.cssText = 'margin: 0 0 12px 0; line-height: 1.6;';
            }
            
            if (question.noteImage && question.noteImage.trim()) {
                const noteImageDiv = noteDiv.createDiv();
                noteImageDiv.style.cssText = 'margin-top: 8px;';
                
                const lines = question.noteImage.split('\n').filter(l => l.trim());
                const noteImageUrls = [];
                
                // 모든 노트 이미지 URL 수집
                for (const line of lines) {
                    let imageUrl = line.trim();
                    let imageWidth = null;
                    
                    const sizeMatch = line.match(/\|(\d+)\]\]/);
                    if (sizeMatch) imageWidth = sizeMatch[1] + 'px';
                    
                    if (imageUrl.includes('[[') && imageUrl.includes(']]')) {
                        const match = imageUrl.match(/!\[\[(.+?)(\|\d+)?\]\]/);
                        if (match && match[1]) {
                            let imagePath = match[1];
                            const folderName = question.folder || '기본';
                            const quizFolder = `${this.plugin.settings.clozeFolder}/QuizQuestions`;
                            
                            if (imagePath.startsWith(folderName + '/')) {
                                imagePath = `${quizFolder}/${imagePath}`;
                            } else if (!imagePath.startsWith(quizFolder)) {
                                if (!imagePath.includes('/')) {
                                    imagePath = `${quizFolder}/${folderName}/첨부파일/${imagePath}`;
                                }
                            }
                            
                            const file = this.app.vault.getAbstractFileByPath(imagePath);
                            if (file) {
                                imageUrl = this.app.vault.adapter.getResourcePath(file.path);
                                noteImageUrls.push({ url: imageUrl, width: imageWidth });
                            }
                        }
                    } else if (imageUrl.startsWith('http')) {
                        noteImageUrls.push({ url: imageUrl, width: imageWidth });
                    }
                }
                
                if (noteImageUrls.length > 0) {
                    let currentNoteImageIndex = 0;
                    
                    const imageDisplay = noteImageDiv.createDiv();
                    imageDisplay.style.cssText = 'text-align: center; position: relative;';
                    
                    const img = imageDisplay.createEl('img');
                    img.style.cssText = 'max-width: 100%; max-height: 250px; border-radius: 6px; cursor: pointer;';
                    
                    let imageCounter = null;
                    if (noteImageUrls.length > 1) {
                        imageCounter = imageDisplay.createDiv();
                        imageCounter.style.cssText = `
                            position: absolute;
                            top: 8px;
                            right: 8px;
                            background: rgba(0, 0, 0, 0.6);
                            color: white;
                            padding: 4px 8px;
                            border-radius: 10px;
                            font-size: 12px;
                            font-weight: 600;
                        `;
                    }
                    
                    const updateNoteImage = () => {
                        const currentImage = noteImageUrls[currentNoteImageIndex];
                        img.src = currentImage.url;
                        if (currentImage.width) {
                            img.style.maxWidth = currentImage.width;
                        }
                        img.onclick = () => this.showImageZoom(currentImage.url, '노트 이미지');
                        
                        if (imageCounter) {
                            imageCounter.textContent = `${currentNoteImageIndex + 1} / ${noteImageUrls.length}`;
                        }
                    };
                    
                    if (noteImageUrls.length > 1) {
                        const navContainer = noteImageDiv.createDiv();
                        navContainer.style.cssText = 'display: flex; justify-content: center; gap: 8px; margin-top: 8px;';
                        
                        const prevBtn = navContainer.createEl('button', { text: '◀' });
                        prevBtn.style.cssText = `
                            padding: 4px 10px;
                            background: var(--interactive-accent);
                            color: var(--text-on-accent);
                            border: none;
                            border-radius: 4px;
                            cursor: pointer;
                            font-size: 12px;
                        `;
                        prevBtn.onclick = () => {
                            if (currentNoteImageIndex > 0) {
                                currentNoteImageIndex--;
                                updateNoteImage();
                            }
                        };
                        
                        const nextBtn = navContainer.createEl('button', { text: '▶' });
                        nextBtn.style.cssText = prevBtn.style.cssText;
                        nextBtn.onclick = () => {
                            if (currentNoteImageIndex < noteImageUrls.length - 1) {
                                currentNoteImageIndex++;
                                updateNoteImage();
                            }
                        };
                    }
                    
                    updateNoteImage();
                }
            }
        }
        
        // 버튼들
        const buttonContainer = modalBody.createDiv();
        buttonContainer.style.cssText = `
            display: flex;
            gap: 12px;
            justify-content: center;
            margin-top: 32px;
            flex-wrap: wrap;
        `;

        // 노트 보기 버튼
        const noteBtn = buttonContainer.createEl('button', { text: '📝 노트 보기', cls: 'mod-cta' });
        noteBtn.style.cssText = 'padding: 10px 20px; font-size: 1em; background: var(--background-primary-alt); color: var(--interactive-accent); border-radius: 6px;';
        noteBtn.onclick = () => {
            const notesModal = new Modal(this.app);
            notesModal.onOpen = () => {
                const { contentEl } = notesModal;
                contentEl.createEl('h2', { text: '문제 노트' });
                if (question.note || (question.noteImage && question.noteImage.trim())) {
                    if (question.note) {
                        contentEl.createEl('div', { text: question.note }).style.cssText = 'font-size: 15px; margin-bottom: 8px;';
                    }
                    if (question.noteImage && question.noteImage.trim()) {
                        const lines = question.noteImage.split('\n').filter(l => l.trim());
                        for (const line of lines) {
                            let imageUrl = line.trim();
                            let imageWidth = null;
                            const sizeMatch = line.match(/\|(\d+)\]\]/);
                            if (sizeMatch) imageWidth = sizeMatch[1] + 'px';
                            if (imageUrl.includes('[[') && imageUrl.includes(']]')) {
                                const match = imageUrl.match(/!\[\[(.+?)(\|\d+)?\]\]/);
                                if (match && match[1]) {
                                    let imagePath = match[1];
                                    const folderName = question.folder || '기본';
                                    const quizFolder = `${this.plugin.settings.clozeFolder}/QuizQuestions`;
                                    if (imagePath.startsWith(folderName + '/')) {
                                        imagePath = `${quizFolder}/${imagePath}`;
                                    } else if (!imagePath.startsWith(quizFolder)) {
                                        if (!imagePath.includes('/')) {
                                            imagePath = `${quizFolder}/${folderName}/첨부파일/${imagePath}`;
                                        }
                                    }
                                    const file = this.app.vault.getAbstractFileByPath(imagePath);
                                    if (file) {
                                        imageUrl = this.app.vault.adapter.getResourcePath(file.path);
                                        const img = contentEl.createEl('img', { attr: { src: imageUrl } });
                                        img.style.cssText = `max-width: ${imageWidth || '250px'}; margin: 8px 0; border-radius: 5px; cursor: pointer;`;
                                        img.onclick = () => this.showImageZoom(imageUrl, '노트 이미지');
                                    }
                                }
                            } else if (imageUrl.startsWith('http')) {
                                const img = contentEl.createEl('img', { attr: { src: imageUrl } });
                                img.style.cssText = `max-width: ${imageWidth || '250px'}; margin: 8px 0; border-radius: 5px; cursor: pointer;`;
                                img.onclick = () => this.showImageZoom(imageUrl, '노트 이미지');
                            }
                        }
                    }
                } else {
                    contentEl.createEl('div', { text: '노트가 없습니다.' }).style.cssText = 'font-size: 15px; margin-bottom: 8px; color: var(--text-muted);';
                }
            };
            notesModal.open();
        };

        // 노트 편집 버튼
        const editNoteBtn = buttonContainer.createEl('button', { text: '✏️ 노트 편집', cls: 'mod-cta' });
        editNoteBtn.style.cssText = 'padding: 8px 18px; font-size: 1em; background: var(--background-primary-alt); color: var(--interactive-accent); border-radius: 6px;';
        editNoteBtn.onclick = () => {
            resultModal.close();
            new QuizCreatorModal(this.app, this.plugin, question.folder, question).open();
        };

        // 다시 풀기 버튼
        const retryBtn = buttonContainer.createEl('button', { text: '🔄 다시 풀기', cls: 'mod-cta' });
        retryBtn.style.cssText = 'padding: 8px 18px; font-size: 1em; background: var(--interactive-accent); color: var(--text-on-accent); border-radius: 6px;';
        retryBtn.onclick = () => {
            resultModal.close();
            // 현재 문제만 다시 풀기 (단일 문제 퀴즈)
            new QuizModal(this.app, this.plugin, question.folder, [question], this.options).open();
        };
        // (SyntaxError fix) 위 CSS 텍스트는 함수 바깥에 있으면 안 되므로 삭제
        
        const continueBtn = buttonContainer.createEl('button', { text: '다음 문제 →', cls: 'mod-cta' });
        continueBtn.style.cssText = `
            padding: 12px 32px;
            font-size: 16px;
            font-weight: 600;
            border-radius: 8px;
            min-width: 150px;
        `;
        continueBtn.onclick = () => {
            resultModal.close();
            this.currentIndex++;
            this.timeLeft = this.options.timerPerQuestion || 30;
            
            if (this.currentIndex < this.questions.length) {
                this.showQuestion();
            } else {
                this.showResults();
            }
        };
        
        resultModal.open();
    }
    
    showHintModal(question) {
        const hintModal = new Modal(this.app);
        hintModal.titleEl.setText('💡 힌트');
        hintModal.titleEl.style.cssText = `
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            margin: -20px -20px 20px -20px;
            border-radius: 12px 12px 0 0;
            text-align: center;
            font-size: 20px;
            font-weight: 600;
        `;
        
        const modalBody = hintModal.contentEl;
        modalBody.style.cssText = 'padding: 20px;';
        
        if (question.hint) {
            const hintText = modalBody.createEl('p', { text: question.hint });
            hintText.style.cssText = 'font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;';
        }
        
        if (question.hintImage && question.hintImage.trim()) {
            // 이미지 URL 수집
            const imageUrls = [];
            const lines = question.hintImage.split('\n').filter(l => l.trim());
            
            for (const line of lines) {
                let imageUrl = line.trim();
                let imageWidth = null;
                
                const sizeMatch = line.match(/\|(\d+)\]\]/);
                if (sizeMatch) imageWidth = sizeMatch[1] + 'px';
                
                if (imageUrl.includes('[[') && imageUrl.includes(']]')) {
                    const match = imageUrl.match(/!\[\[(.+?)(\|\d+)?\]\]/);
                    if (match && match[1]) {
                        let imagePath = match[1];
                        const folderName = question.folder || '기본';
                        const quizFolder = `${this.plugin.settings.clozeFolder}/QuizQuestions`;
                        
                        if (imagePath.startsWith(folderName + '/')) {
                            imagePath = `${quizFolder}/${imagePath}`;
                        } else if (!imagePath.startsWith(quizFolder)) {
                            if (!imagePath.includes('/')) {
                                imagePath = `${quizFolder}/${folderName}/첨부파일/${imagePath}`;
                            }
                        }
                        
                        const file = this.app.vault.getAbstractFileByPath(imagePath);
                        if (file) {
                            imageUrl = this.app.vault.adapter.getResourcePath(file.path);
                            imageUrls.push({ url: imageUrl, width: imageWidth });
                        }
                    }
                } else if (imageUrl.startsWith('http')) {
                    imageUrls.push({ url: imageUrl, width: imageWidth });
                }
            }
            
            // 슬라이더로 표시
            if (imageUrls.length > 0) {
                const sliderContainer = modalBody.createDiv();
                sliderContainer.style.cssText = 'text-align: center; margin-top: 16px;';
                
                let currentIndex = 0;
                
                // 이미지 표시 영역
                const imageWrapper = sliderContainer.createDiv();
                imageWrapper.style.cssText = 'margin: 20px 0;';
                
                const img = imageWrapper.createEl('img', { attr: { src: imageUrls[0].url } });
                img.style.cssText = `max-width: ${imageUrls[0].width || '100%'}; max-height: 400px; border-radius: 8px; cursor: pointer; display: block; margin: 0 auto; touch-action: pan-y pinch-zoom;`;
                img.onclick = () => this.showImageZoom(imageUrls[currentIndex].url);
                
                if (imageUrls.length > 1) {
                    // 버튼 컨테이너
                    const btnContainer = sliderContainer.createDiv();
                    btnContainer.style.cssText = 'display: flex; justify-content: center; align-items: center; gap: 20px; margin-top: 32px;';                // 이전 버튼
                    const prevBtn = btnContainer.createEl('button', { text: '◀' });
                    prevBtn.style.cssText = `
                        padding: 10px 20px;
                        background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                        color: white;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 16px;
                        font-weight: bold;
                        transition: all 0.2s;
                        box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
                    `;
                    prevBtn.addEventListener('mouseenter', () => {
                        prevBtn.style.transform = 'scale(1.05)';
                        prevBtn.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.4)';
                    });
                    prevBtn.addEventListener('mouseleave', () => {
                        prevBtn.style.transform = 'scale(1)';
                        prevBtn.style.boxShadow = '0 2px 8px rgba(59, 130, 246, 0.3)';
                    });
                    prevBtn.onclick = () => {
                        currentIndex = (currentIndex - 1 + imageUrls.length) % imageUrls.length;
                        img.src = imageUrls[currentIndex].url;
                        img.style.maxWidth = imageUrls[currentIndex].width || '100%';
                        counter.textContent = `${currentIndex + 1} / ${imageUrls.length}`;
                    };
                    
                    // 카운터
                    const counter = btnContainer.createEl('div', { text: `1 / ${imageUrls.length}` });
                    counter.style.cssText = `
                        background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                        color: white;
                        padding: 8px 20px;
                        border-radius: 20px;
                        font-size: 14px;
                        font-weight: 600;
                        min-width: 80px;
                        text-align: center;
                    `;
                    
                    // 다음 버튼
                    const nextBtn = btnContainer.createEl('button', { text: '▶' });
                    nextBtn.style.cssText = `
                        padding: 10px 20px;
                        background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                        color: white;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 16px;
                        font-weight: bold;
                        transition: all 0.2s;
                        box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
                    `;
                    nextBtn.addEventListener('mouseenter', () => {
                        nextBtn.style.transform = 'scale(1.05)';
                        nextBtn.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.4)';
                    });
                    nextBtn.addEventListener('mouseleave', () => {
                        nextBtn.style.transform = 'scale(1)';
                        nextBtn.style.boxShadow = '0 2px 8px rgba(59, 130, 246, 0.3)';
                    });
                    nextBtn.onclick = () => {
                        currentIndex = (currentIndex + 1) % imageUrls.length;
                        img.src = imageUrls[currentIndex].url;
                        img.style.maxWidth = imageUrls[currentIndex].width || '100%';
                        counter.textContent = `${currentIndex + 1} / ${imageUrls.length}`;
                    };
                }
            }
        }
        
        const closeBtn = modalBody.createEl('button', { text: '닫기', cls: 'mod-cta' });
        closeBtn.style.cssText = `
            margin-top: 20px;
            padding: 10px 24px;
            width: 100%;
            font-size: 16px;
            font-weight: 600;
        `;
        closeBtn.onclick = () => hintModal.close();
        
        hintModal.open();
    }
    
    showNoteModal(question) {
        const noteModal = new Modal(this.app);
        noteModal.titleEl.setText('📝 노트');
        noteModal.titleEl.style.cssText = `
            background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
            color: white;
            padding: 20px;
            margin: -20px -20px 20px -20px;
            border-radius: 12px 12px 0 0;
            text-align: center;
            font-size: 20px;
            font-weight: 600;
        `;
        
        const modalBody = noteModal.contentEl;
        modalBody.style.cssText = 'padding: 20px;';
        
        if (question.note) {
            const noteText = modalBody.createEl('p', { text: question.note });
            noteText.style.cssText = 'font-size: 16px; line-height: 1.6; margin: 0 0 16px 0; white-space: pre-wrap;';
        }
        
        if (question.noteImage && question.noteImage.trim()) {
            // 이미지 URL 수집
            const imageUrls = [];
            const lines = question.noteImage.split('\n').filter(l => l.trim());
            
            for (const line of lines) {
                let imageUrl = line.trim();
                let imageWidth = null;
                
                const sizeMatch = line.match(/\|(\d+)\]\]/);
                if (sizeMatch) imageWidth = sizeMatch[1] + 'px';
                
                if (imageUrl.includes('[[') && imageUrl.includes(']]')) {
                    const match = imageUrl.match(/!\[\[(.+?)(\|\d+)?\]\]/);
                    if (match && match[1]) {
                        let imagePath = match[1];
                        const folderName = question.folder || '기본';
                        const quizFolder = `${this.plugin.settings.clozeFolder}/QuizQuestions`;
                        
                        if (imagePath.startsWith(folderName + '/')) {
                            imagePath = `${quizFolder}/${imagePath}`;
                        } else if (!imagePath.startsWith(quizFolder)) {
                            if (!imagePath.includes('/')) {
                                imagePath = `${quizFolder}/${folderName}/첨부파일/${imagePath}`;
                            }
                        }
                        
                        const file = this.app.vault.getAbstractFileByPath(imagePath);
                        if (file) {
                            imageUrl = this.app.vault.adapter.getResourcePath(file.path);
                            imageUrls.push({ url: imageUrl, width: imageWidth });
                        }
                    }
                } else if (imageUrl.startsWith('http')) {
                    imageUrls.push({ url: imageUrl, width: imageWidth });
                }
            }
            
            if (imageUrls.length > 0) {
                const sliderContainer = modalBody.createDiv();
                sliderContainer.style.cssText = 'text-align: center; margin-top: 16px;';
                
                // 현재 이미지 인덱스
                let currentIndex = 0;
                
                // 이미지 표시 영역
                const imageWrapper = sliderContainer.createDiv();
                imageWrapper.style.cssText = 'margin: 20px 0;';
                
                // 이미지 요소
                const img = imageWrapper.createEl('img');
                img.style.cssText = 'max-width: 100%; max-height: 400px; border-radius: 8px; cursor: pointer; display: block; margin: 0 auto;';
                img.src = imageUrls[0].url;
                img.onclick = () => this.showImageZoom(imageUrls[currentIndex].url, '노트 이미지');
                
                // 이미지가 2개 이상일 때만 네비게이션 표시
                if (imageUrls.length > 1) {
                    const btnContainer = sliderContainer.createDiv();
                    btnContainer.style.cssText = 'display: flex; justify-content: center; align-items: center; gap: 20px; margin-top: 32px;';
                    
                    // 이전 버튼
                    const prevBtn = btnContainer.createEl('button', { text: '◀' });
                    prevBtn.style.cssText = `
                        padding: 10px 20px;
                        background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                        color: white;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 16px;
                        font-weight: bold;
                        transition: all 0.2s;
                        box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
                    `;
                    prevBtn.onmouseenter = () => {
                        prevBtn.style.transform = 'scale(1.05)';
                        prevBtn.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.5)';
                    };
                    prevBtn.onmouseleave = () => {
                        prevBtn.style.transform = 'scale(1)';
                        prevBtn.style.boxShadow = '0 2px 8px rgba(59, 130, 246, 0.3)';
                    };
                    prevBtn.onclick = () => {
                        currentIndex = (currentIndex - 1 + imageUrls.length) % imageUrls.length;
                        img.src = imageUrls[currentIndex].url;
                        counter.textContent = `${currentIndex + 1} / ${imageUrls.length}`;
                    };
                    
                    const counter = btnContainer.createEl('div');
                    counter.textContent = `1 / ${imageUrls.length}`;
                    counter.style.cssText = `
                        background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                        color: white;
                        padding: 8px 20px;
                        border-radius: 20px;
                        font-size: 14px;
                        font-weight: 600;
                        min-width: 80px;
                        text-align: center;
                    `;
                    
                    // 다음 버튼
                    const nextBtn = btnContainer.createEl('button', { text: '▶' });
                    nextBtn.style.cssText = `
                        padding: 10px 20px;
                        background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                        color: white;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 16px;
                        font-weight: bold;
                        transition: all 0.2s;
                        box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
                    `;
                    nextBtn.onmouseenter = () => {
                        nextBtn.style.transform = 'scale(1.05)';
                        nextBtn.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.5)';
                    };
                    nextBtn.onmouseleave = () => {
                        nextBtn.style.transform = 'scale(1)';
                        nextBtn.style.boxShadow = '0 2px 8px rgba(59, 130, 246, 0.3)';
                    };
                    nextBtn.onclick = () => {
                        currentIndex = (currentIndex + 1) % imageUrls.length;
                        img.src = imageUrls[currentIndex].url;
                        counter.textContent = `${currentIndex + 1} / ${imageUrls.length}`;
                    };
                }
            }
        }
        
        const closeBtn = modalBody.createEl('button', { text: '닫기', cls: 'mod-cta' });
        closeBtn.style.cssText = `
            margin-top: 20px;
            padding: 10px 24px;
            width: 100%;
            font-size: 16px;
            font-weight: 600;
        `;
        closeBtn.onclick = () => noteModal.close();
        
        noteModal.open();
    }

    showResults() {
        const { contentEl } = this;
        contentEl.empty();
        
        const totalTime = Math.floor((Date.now() - this.startTime) / 1000);
        const percentage = Math.round((this.score / this.questions.length) * 100);
        
        // 퀴즈 결과를 학습 기록에 저장
        this.saveQuizResults(totalTime, percentage);
        
        contentEl.createEl('h2', { text: '퀴즈 완료!' });
        
        const stats = contentEl.createDiv('quiz-stats');
        stats.createEl('p', { text: `점수: ${this.score}/${this.questions.length} (${percentage}%)` });
        stats.createEl('p', { text: `소요 시간: ${formatTime(totalTime)}` });
        
        const resultsList = contentEl.createDiv('quiz-results-list');
        this.results.forEach((result, index) => {
            const item = resultsList.createDiv('quiz-result-item');
            item.addClass(result.isCorrect ? 'correct' : 'incorrect');
            item.style.cssText = 'margin: 15px 0; padding: 15px; border-radius: 8px; background: var(--background-secondary);';
            
            item.createEl('strong', { text: `${index + 1}. ${result.question}` });
            item.createEl('p', { text: `선택: ${result.userAnswer}` });
            if (!result.isCorrect) {
                item.createEl('p', { text: `정답: ${result.correctAnswer}`, cls: 'correct-answer' });
            }
            
            // 노트 표시 (오답인 경우만)
            if (!result.isCorrect && (result.note || result.noteImage)) {
                const noteDiv = item.createDiv();
                noteDiv.style.cssText = 'margin-top: 12px; padding: 12px; background: var(--background-primary-alt); border-left: 3px solid var(--interactive-accent); border-radius: 5px;';
                
                if (result.note) {
                    const noteLabel = noteDiv.createEl('strong', { text: '📝 노트' });
                    noteLabel.style.cssText = 'display: block; margin-bottom: 8px; color: var(--interactive-accent);';
                    noteDiv.createEl('p', { text: result.note });
                }
                
                if (result.noteImage && result.noteImage.trim()) {
                    const lines = result.noteImage.split('\\n').filter(l => l.trim());
                    for (const line of lines) {
                        let imageUrl = line.trim();
                        let imageWidth = null;
                        
                        const sizeMatch = line.match(/\|(\d+)\]\]/);
                        if (sizeMatch) imageWidth = sizeMatch[1] + 'px';
                        
                        if (imageUrl.includes('[[') && imageUrl.includes(']]')) {
                            const match = imageUrl.match(/!\[\[(.+?)(\|\d+)?\]\]/);
                            if (match && match[1]) {
                                let imagePath = match[1];
                                const question = this.questions[index] || {};
                                const folderName = question.folder || result.folder || '기본';
                                const quizFolder = `${this.plugin.settings.clozeFolder}/QuizQuestions`;
                                
                                if (imagePath.startsWith(folderName + '/')) {
                                    imagePath = `${quizFolder}/${imagePath}`;
                                } else if (!imagePath.startsWith(quizFolder)) {
                                    if (!imagePath.includes('/')) {
                                        imagePath = `${quizFolder}/${folderName}/첨부파일/${imagePath}`;
                                    }
                                }
                                
                                const file = this.app.vault.getAbstractFileByPath(imagePath);
                                if (file) {
                                    imageUrl = this.app.vault.adapter.getResourcePath(file.path);
                                    const img = noteDiv.createEl('img', { attr: { src: imageUrl } });
                                    img.style.cssText = `max-width: ${imageWidth || '250px'}; margin: 8px 0; border-radius: 5px; cursor: pointer;`;
                                    img.onclick = () => this.showImageZoom(imageUrl, '노트 이미지');
                                }
                            }
                        } else if (imageUrl.startsWith('http')) {
                            const img = noteDiv.createEl('img', { attr: { src: imageUrl } });
                            img.style.cssText = `max-width: ${imageWidth || '250px'}; margin: 8px 0; border-radius: 5px; cursor: pointer;`;
                            img.onclick = () => this.showImageZoom(imageUrl, '노트 이미지');
                        }
                    }
                }
            }
        });
        
        // 버튼 그룹
        const btnGroup = contentEl.createDiv();
        btnGroup.style.cssText = 'display: flex; gap: 12px; margin-top: 20px; justify-content: center;';

        // 노트 보기 버튼 (오답 노트가 있을 때만 활성화)
        const viewNoteBtn = btnGroup.createEl('button', { text: '📝 노트 보기', cls: 'mod-cta' });
        viewNoteBtn.style.cssText = 'padding: 12px 24px; font-size: 1em; background: var(--background-primary-alt); color: var(--interactive-accent);';
        viewNoteBtn.onclick = () => {
            // 모든 노트(정답/오답) 모아서 모달로 보여주기
            const notesModal = new Modal(this.app);
            notesModal.onOpen = () => {
                const { contentEl } = notesModal;
                contentEl.createEl('h2', { text: '퀴즈 노트 모아보기' });
                this.results.forEach((result, idx) => {
                    if (result.note || result.noteImage) {
                        const noteDiv = contentEl.createDiv();
                        noteDiv.style.cssText = 'margin-bottom: 18px; padding: 12px; background: var(--background-primary-alt); border-left: 3px solid var(--interactive-accent); border-radius: 5px;';
                        noteDiv.createEl('strong', { text: `${idx + 1}. ${result.question}` });
                        if (result.isCorrect) {
                            noteDiv.createEl('span', { text: ' (정답)', cls: 'correct' }).style.cssText = 'color: var(--color-green); margin-left: 8px;';
                        } else {
                            noteDiv.createEl('span', { text: ' (오답)', cls: 'incorrect' }).style.cssText = 'color: var(--color-red); margin-left: 8px;';
                        }
                        if (result.note) {
                            noteDiv.createEl('p', { text: result.note });
                        }
                        if (result.noteImage && result.noteImage.trim()) {
                            const lines = result.noteImage.split('\n').filter(l => l.trim());
                            for (const line of lines) {
                                let imageUrl = line.trim();
                                let imageWidth = null;
                                const sizeMatch = line.match(/\|(\d+)\]\]/);
                                if (sizeMatch) imageWidth = sizeMatch[1] + 'px';
                                if (imageUrl.includes('[[') && imageUrl.includes(']]')) {
                                    const match = imageUrl.match(/!\[\[(.+?)(\|\d+)?\]\]/);
                                    if (match && match[1]) {
                                        let imagePath = match[1];
                                        const folderName = result.folder || '기본';
                                        const quizFolder = `${this.plugin.settings.clozeFolder}/QuizQuestions`;
                                        if (imagePath.startsWith(folderName + '/')) {
                                            imagePath = `${quizFolder}/${imagePath}`;
                                        } else if (!imagePath.startsWith(quizFolder)) {
                                            if (!imagePath.includes('/')) {
                                                imagePath = `${quizFolder}/${folderName}/첨부파일/${imagePath}`;
                                            }
                                        }
                                        const file = this.app.vault.getAbstractFileByPath(imagePath);
                                        if (file) {
                                            imageUrl = this.app.vault.adapter.getResourcePath(file.path);
                                            const img = noteDiv.createEl('img', { attr: { src: imageUrl } });
                                            img.style.cssText = `max-width: ${imageWidth || '250px'}; margin: 8px 0; border-radius: 5px; cursor: pointer;`;
                                            img.onclick = () => this.showImageZoom(imageUrl, '노트 이미지');
                                        }
                                    }
                                } else if (imageUrl.startsWith('http')) {
                                    const img = noteDiv.createEl('img', { attr: { src: imageUrl } });
                                    img.style.cssText = `max-width: ${imageWidth || '250px'}; margin: 8px 0; border-radius: 5px; cursor: pointer;`;
                                    img.onclick = () => this.showImageZoom(imageUrl, '노트 이미지');
                                }
                            }
                        }
                    }
                });
            };
            notesModal.open();
        };

        const restartBtn = btnGroup.createEl('button', { text: '🔄 다시 풀기', cls: 'mod-cta' });
        restartBtn.style.cssText = 'padding: 12px 24px; font-size: 1em; background: var(--interactive-accent); color: var(--text-on-accent);';
        restartBtn.onclick = () => {
            // 같은 문제로 새 퀴즈 시작
            this.close();
            new QuizModal(this.app, this.plugin, this.folderName, this.questions, this.options).open();
        };

        const closeBtn = btnGroup.createEl('button', { text: '닫기' });
        closeBtn.style.cssText = 'padding: 12px 24px; font-size: 1em;';
        closeBtn.onclick = () => this.close();
    }

    async saveQuizResults(totalTime, percentage) {
        // 폴더별 통계 업데이트
        const folderName = this.folderName === '⭐ 북마크' ? '⭐ 북마크' : (this.questions[0]?.folder || '기본');
        
        const record = {
            timestamp: Date.now(),
            date: new Date().toISOString().split('T')[0],
            folder: this.folderName === '⭐ 북마크' ? '⭐ 북마크' : `${this.plugin.settings.clozeFolder}/${this.plugin.settings.questionSubFolder || 'Questions'}/${folderName}`,
            folderName: folderName,
            total: this.questions.length,
            correct: this.score,
            duration: totalTime,
            completed: true,
            action: 'quiz',
            percentage: percentage
        };
        
        // 학습 히스토리에 추가
        if (!this.plugin.settings.stats.studyHistory) {
            this.plugin.settings.stats.studyHistory = [];
        }
        this.plugin.settings.stats.studyHistory.push(record);
        
        // 전체 통계 업데이트
        this.plugin.settings.stats.totalAttempts += this.questions.length;
        this.plugin.settings.stats.totalCorrect += this.score;
        this.plugin.settings.stats.totalTime += totalTime;
        this.plugin.settings.stats.lastStudyDate = new Date().toISOString();
        
        // 폴더별 통계 초기화
        if (!this.plugin.settings.stats.folderStats) {
            this.plugin.settings.stats.folderStats = {};
        }
        if (!this.plugin.settings.stats.folderStats[folderName]) {
            this.plugin.settings.stats.folderStats[folderName] = {
                attempts: 0,
                correct: 0,
                time: 0,
                fileStats: {}
            };
        }
        
        // 폴더별 통계 업데이트
        const folderStat = this.plugin.settings.stats.folderStats[folderName];
        folderStat.attempts += this.questions.length;
        folderStat.correct += this.score;
        folderStat.time += totalTime;
        
        // 각 문제별 파일 통계 업데이트
        for (let i = 0; i < this.results.length; i++) {
            const result = this.results[i];
            const question = this.questions[i];
            
            if (question && question.filePath) {
                const fileName = question.filePath.split('/').pop();
                
                if (!folderStat.fileStats[fileName]) {
                    folderStat.fileStats[fileName] = {
                        attempts: 0,
                        correct: 0,
                        time: 0
                    };
                }
                
                const fileStat = folderStat.fileStats[fileName];
                fileStat.attempts++;
                if (result.isCorrect) fileStat.correct++;
                fileStat.time += Math.floor(totalTime / this.questions.length); // 평균 시간 배분
                
                // 문제 파일 자체의 통계도 업데이트
                await this.plugin.updateQuestionStats(question, result.isCorrect);
            }
        }
        
        // 설정 저장
        await this.plugin.saveSettings(true);
        
        console.log('✅ 퀴즈 결과 저장 완료:', record);
    }

    onClose() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }
        const { contentEl } = this;
        contentEl.empty();
    }
}

class QuizCreatorModal extends Modal {
    constructor(app, plugin, folder, questionData = null) {
        super(app);
        this.plugin = plugin;
        this.folder = folder;
        this.questionData = questionData;
        this.isEdit = !!questionData;
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('quiz-creator-modal');
        
        // 모바일 감지 및 스타일 적용
        const isMobile = window.innerWidth <= 768 || ('ontouchstart' in window);
        contentEl.style.cssText = isMobile 
            ? 'padding: 0; max-width: 100vw; width: 100vw; height: 100vh;'
            : 'padding: 0; max-width: 900px;';
        
        // 수정 모드일 때 파일에서 최신 데이터 로드
        if (this.isEdit && this.questionData?.filePath) {
            try {
                const file = this.app.vault.getAbstractFileByPath(this.questionData.filePath);
                if (file) {
                    const content = await this.app.vault.read(file);
                    this.questionData = this.plugin.parseQuestionFile(content, this.questionData.filePath);
                    console.log('✅ 파일에서 최신 데이터 로드:', {
                        hint: this.questionData.hint,
                        note: this.questionData.note,
                        hintImage: this.questionData.hintImage,
                        noteImage: this.questionData.noteImage
                    });
                }
            } catch (err) {
                console.error('❌ 파일 로드 실패:', err);
            }
        }
        
        // 디버깅: 데이터 확인
        if (this.questionData) {
            console.log('🔍 QuizCreatorModal - 로드된 데이터:', {
                options: this.questionData.options,
                optionImages: this.questionData.optionImages,
                difficulty: this.questionData.difficulty,
                hint: this.questionData.hint,
                note: this.questionData.note
            });
        }
        
        // 헤더
        const header = contentEl.createDiv('modal-header');
        header.style.cssText = isMobile
            ? 'background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 16px 20px; color: white;'
            : 'background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px 24px; color: white;';
        header.createEl('h2', { 
            text: this.isEdit ? '✏️ 문제 수정' : '➕ 새 문제 만들기',
            attr: { style: isMobile ? 'margin: 0; font-size: 18px; font-weight: 700;' : 'margin: 0; font-size: 22px; font-weight: 700;' }
        });
        
        const form = contentEl.createDiv('quiz-creator-form');
        form.style.cssText = isMobile
            ? 'padding: 16px; max-height: calc(100vh - 180px); overflow-y: auto; -webkit-overflow-scrolling: touch;'
            : 'padding: 24px; max-height: 70vh; overflow-y: auto;';
        
        // 키워드 입력 (최상단 배치, quiz-sp2 스타일)
        const keywordGroup = form.createDiv('form-group');
        keywordGroup.style.cssText = 'margin-bottom: 20px; background: var(--background-primary-alt); border-radius: 8px; padding: 16px; border: 2px solid var(--interactive-accent);';
        
        const keywordLabel = keywordGroup.createEl('label', { text: '🔑 주제/키워드' });
        keywordLabel.style.cssText = 'display: block; margin-bottom: 10px; font-size: 15px; font-weight: 600; color: var(--text-accent);';
        
        // 기존 키워드 목록 가져오기
        const getExistingKeywords = async () => {
            const keywords = new Set();
            const questionsPath = `${this.plugin.settings.clozeFolder}/QuizQuestions`;
            const questionsFolder = this.app.vault.getAbstractFileByPath(questionsPath);
            
            if (questionsFolder && questionsFolder.children) {
                for (const folder of questionsFolder.children) {
                    if (folder.children) {
                        for (const file of folder.children) {
                            if (file.extension === 'md') {
                                try {
                                    const content = await this.app.vault.read(file);
                                    const lines = content.split('\n');
                                    let inKeywordSection = false;
                                    
                                    for (const line of lines) {
                                        const trimmed = line.trim();
                                        if (trimmed === '## 키워드') {
                                            inKeywordSection = true;
                                            continue;
                                        }
                                        if (inKeywordSection && trimmed.startsWith('##')) {
                                            break;
                                        }
                                        if (inKeywordSection && trimmed.startsWith('-')) {
                                            keywords.add(trimmed.substring(1).trim());
                                        }
                                    }
                                } catch (err) {}
                            }
                        }
                    }
                }
            }
            return Array.from(keywords).sort();
        };
        
        // 드롭다운 + 붙여넣기 버튼
        const keywordTopRow = keywordGroup.createDiv();
        keywordTopRow.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-bottom: 8px;';
        
        keywordTopRow.createSpan({ text: '📚' }).style.fontSize = '16px';
        
        const keywordDropdown = keywordTopRow.createEl('select');
        keywordDropdown.style.cssText = 'flex: 1; padding: 8px 12px; border-radius: 6px; border: 1px solid var(--background-modifier-border); background: var(--background-primary); cursor: pointer; font-size: 14px;';
        
        // 드롭다운 옵션 로드
        (async () => {
            const keywords = await getExistingKeywords();
            keywordDropdown.createEl('option', { text: '-- 기존 키워드 선택 --', value: '' });
            for (const keyword of keywords) {
                keywordDropdown.createEl('option', { text: keyword, value: keyword });
            }
        })();
        
        const keywordPasteBtn = keywordTopRow.createEl('button', { text: '📋 붙여넣기' });
        keywordPasteBtn.type = 'button';
        keywordPasteBtn.style.cssText = 'padding: 8px 16px; font-size: 13px; background: var(--interactive-accent); color: var(--text-on-accent); border: none; border-radius: 6px; cursor: pointer; font-weight: 600;';
        
        // 입력 필드
        const keywordInputValue = (this.questionData?.keywords || []).join(', ');
        const keywordInput = keywordGroup.createEl('input', {
            type: 'text',
            placeholder: '예: 회로이론, 저항, 옴의법칙 (쉼표로 구분)',
            value: keywordInputValue
        });
        keywordInput.style.cssText = 'width: 100%; padding: 10px 14px; border: 2px solid var(--background-modifier-border); border-radius: 6px; background: var(--background-primary); font-size: 14px;';
        
        // 드롭다운 선택 시 입력 필드에 추가
        keywordDropdown.addEventListener('change', (e) => {
            if (e.target.value) {
                const current = keywordInput.value.trim();
                const newKeyword = e.target.value;
                if (current) {
                    const keywords = current.split(',').map(k => k.trim());
                    if (!keywords.includes(newKeyword)) {
                        keywordInput.value = current + ', ' + newKeyword;
                    }
                } else {
                    keywordInput.value = newKeyword;
                }
                keywordDropdown.value = '';
            }
        });
        
        // 클립보드 붙여넣기
        keywordPasteBtn.onclick = async () => {
            try {
                const text = await navigator.clipboard.readText();
                if (text) {
                    keywordInput.value = text.trim();
                    new Notice('📋 클립보드에서 붙여넣기 완료');
                }
            } catch (err) {
                new Notice('⚠️ 클립보드 읽기 실패');
            }
        };
        
        // 난이도 선택
        const difficultyGroup = form.createDiv('form-group');
        difficultyGroup.style.cssText = 'margin-bottom: 20px;';
        
        const difficultyLabel = difficultyGroup.createEl('label', { text: '⭐ 난이도' });
        difficultyLabel.style.cssText = 'display: block; margin-bottom: 8px; font-size: 14px; font-weight: 600;';
        
        const difficultySelect = difficultyGroup.createEl('select');
        difficultySelect.style.cssText = 'width: 100%; padding: 10px 12px; border-radius: 6px; border: 1px solid var(--background-modifier-border); background: var(--background-primary); cursor: pointer; font-size: 14px;';
        
        ['쉬움', '보통', '어려움'].forEach(level => {
            const option = difficultySelect.createEl('option', { text: level, value: level });
            if (this.questionData?.difficulty === level) {
                option.selected = true;
            }
        });
        
        // 번호 + 폴더 (한 줄)
        const metaRow = form.createDiv();
        metaRow.style.cssText = 'display: flex; gap: 12px; margin-bottom: 20px;';
        
        const numberGroup = metaRow.createDiv();
        numberGroup.style.cssText = 'flex: 1;';
        const numberLabel = numberGroup.createEl('label', { text: '🔢 번호' });
        numberLabel.style.cssText = 'display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px;';
        const numberInput = numberGroup.createEl('input', { 
            type: 'text', 
            placeholder: '자동',
            value: this.questionData?.number || ''
        });
        numberInput.style.cssText = 'width: 100%; padding: 10px 12px; border-radius: 6px; border: 1px solid var(--background-modifier-border);';
        
        const folderGroup = metaRow.createDiv();
        folderGroup.style.cssText = 'flex: 2;';
        const folderLabel = folderGroup.createEl('label', { text: '📁 폴더' });
        folderLabel.style.cssText = 'display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px;';
        const folderInput = folderGroup.createEl('input', { 
            type: 'text', 
            value: this.folder || '기본',
            attr: { readonly: 'true' }
        });
        folderInput.style.cssText = 'width: 100%; padding: 10px 12px; border-radius: 6px; border: 1px solid var(--background-modifier-border); background: var(--background-secondary);';
        
        // 문제 - 대형 텍스트 영역 + 클립보드 버튼
        const questionGroup = form.createDiv('form-group');
        questionGroup.style.cssText = 'margin-bottom: 12px;';
        
        const questionLabelRow = questionGroup.createDiv();
        questionLabelRow.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;';
        
        const questionLabel = questionLabelRow.createEl('label', { text: '❓ 문제' });
        questionLabel.style.cssText = 'font-size: 15px; font-weight: 600; color: var(--text-accent);';
        
        const pasteBtn = questionLabelRow.createEl('button', { text: '📋 붙여넣기' });
        pasteBtn.type = 'button';
        pasteBtn.style.cssText = 'padding: 6px 12px; font-size: 12px; background: var(--interactive-accent); color: var(--text-on-accent); border: none; border-radius: 5px; cursor: pointer;';
        
        const questionInput = questionGroup.createEl('textarea', { 
            placeholder: '문제를 입력하세요 (Ctrl+V 붙여넣기 가능)'
        });
        questionInput.value = this.questionData?.question || '';
        questionInput.style.cssText = 'width: 100%; padding: 14px 16px; font-size: 16px; min-height: 120px; border-radius: 8px; border: 2px solid var(--background-modifier-border); transition: all 0.2s; resize: vertical;';
        
        questionInput.addEventListener('focus', () => {
            questionInput.style.borderColor = 'var(--interactive-accent)';
            questionInput.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)';
        });
        questionInput.addEventListener('blur', () => {
            questionInput.style.boxShadow = 'none';
        });
        
        questionInput.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && ['v', 'c', 'x', 'a', 'z'].includes(e.key.toLowerCase())) {
                e.stopPropagation();
            }
        }, true);
        
        pasteBtn.onclick = async () => {
            try {
                const text = await navigator.clipboard.readText();
                if (text) {
                    questionInput.value = text;
                    questionInput.focus();
                    new Notice('📋 클립보드 내용이 붙여넣어졌습니다');
                }
            } catch (err) {
                new Notice('⚠️ 클립보드 읽기 실패');
            }
        };
        
        // 문제 이미지 - 문제 바로 밑
        const imageGroup = questionGroup.createDiv();
        imageGroup.style.cssText = 'margin-top: 12px; padding: 12px; background: var(--background-secondary); border-radius: 6px; border: 1px dashed var(--background-modifier-border);';
        
        const imageLabel = imageGroup.createEl('label', { text: '🖼️ 문제 이미지' });
        imageLabel.style.cssText = 'display: block; font-size: 13px; font-weight: 600; margin-bottom: 8px; color: var(--text-muted);';
        
        let imageValue = this.questionData?.image || '';
        
        const imageTextarea = imageGroup.createEl('textarea', {
            placeholder: '이미지 링크 (자동 생성됨)',
            value: imageValue
        });
        imageTextarea.style.cssText = 'width: 100%; min-height: 60px; margin-bottom: 8px; padding: 8px; border: 1px solid var(--background-modifier-border); border-radius: 4px; background: var(--background-primary); font-size: 12px; font-family: monospace;';
        imageTextarea.oninput = () => {
            imageValue = imageTextarea.value;
            updateImagePreview();
        };
        
        const imageBtnRow = imageGroup.createDiv();
        imageBtnRow.style.cssText = 'display: flex; gap: 6px; margin-bottom: 8px;';
        
        const imageUploadBtn = imageBtnRow.createEl('button', { text: '📁 선택' });
        imageUploadBtn.type = 'button';
        imageUploadBtn.style.cssText = 'flex: 1; padding: 8px 12px; font-size: 12px; background: var(--interactive-accent); color: var(--text-on-accent); border: none; border-radius: 5px; cursor: pointer;';
        
        const imageClipboardBtn = imageBtnRow.createEl('button', { text: '📋 붙여넣기' });
        imageClipboardBtn.type = 'button';
        imageClipboardBtn.style.cssText = 'flex: 1; padding: 8px 12px; font-size: 12px; background: #4caf50; color: white; border: none; border-radius: 5px; cursor: pointer;';
        
        const imageAddBtn = imageBtnRow.createEl('button', { text: '➕ 추가' });
        imageAddBtn.type = 'button';
        imageAddBtn.style.cssText = 'flex: 1; padding: 8px 12px; font-size: 12px; background: #4caf50; color: white; border: none; border-radius: 5px; cursor: pointer;';
        
        const imageClearBtn = imageBtnRow.createEl('button', { text: '🗑️ 삭제' });
        imageClearBtn.type = 'button';
        imageClearBtn.style.cssText = 'flex: 1; padding: 8px 12px; font-size: 12px; background: var(--background-modifier-error); color: white; border: none; border-radius: 5px; cursor: pointer;';
        
        const imageFileInput = imageGroup.createEl('input', { type: 'file', attr: { accept: 'image/*', multiple: 'true' } });
        imageFileInput.style.display = 'none';
        
        const imageAddFileInput = imageGroup.createEl('input', { type: 'file', attr: { accept: 'image/*', multiple: 'true' } });
        imageAddFileInput.style.display = 'none';
        
        imageUploadBtn.onclick = () => imageFileInput.click();
        imageAddBtn.onclick = () => imageAddFileInput.click();
        
        const handleImageUpload = async (files, isAdd = false) => {
            if (!files || files.length === 0) return;
            
            try {
                const folder = this.folder || '기본';
                const attachmentFolder = `${this.plugin.settings.clozeFolder}/QuizQuestions/${folder}/첨부파일`;
                
                const folderExists = this.app.vault.getAbstractFileByPath(attachmentFolder);
                if (!folderExists) {
                    await this.app.vault.createFolder(attachmentFolder);
                }
                
                const imageLinks = [];
                for (const file of files) {
                    const timestamp = Date.now() + Math.floor(Math.random() * 1000);
                    const fileName = `${timestamp}_${file.name}`;
                    const filePath = `${attachmentFolder}/${fileName}`;
                    const arrayBuffer = await file.arrayBuffer();
                    await this.app.vault.adapter.writeBinary(filePath, new Uint8Array(arrayBuffer));
                    
                    imageLinks.push(`![[${folder}/첨부파일/${fileName}|400]]`);
                }
                
                if (isAdd) {
                    imageValue = imageValue ? imageValue + '\n' + imageLinks.join('\n') : imageLinks.join('\n');
                } else {
                    imageValue = imageLinks.join('\n');
                }
                
                imageTextarea.value = imageValue;
                updateImagePreview();
                new Notice(`✅ 이미지 ${imageLinks.length}개 업로드 완료`);
            } catch (error) {
                console.error('이미지 업로드 실패:', error);
                new Notice('❌ 이미지 업로드 실패');
            }
        };
        
        // 클립보드 붙여넣기 기능
        imageClipboardBtn.onclick = async () => {
            try {
                const items = await navigator.clipboard.read();
                let imageFound = false;
                
                for (const item of items) {
                    for (const type of item.types) {
                        if (type.startsWith('image/')) {
                            const blob = await item.getType(type);
                            imageFound = true;
                            
                            const folder = this.folder || '기본';
                            const attachmentFolder = `${this.plugin.settings.clozeFolder}/QuizQuestions/${folder}/첨부파일`;
                            
                            const folderExists = this.app.vault.getAbstractFileByPath(attachmentFolder);
                            if (!folderExists) {
                                await this.app.vault.createFolder(attachmentFolder);
                            }
                            
                            const now = new Date();
                            const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}${String(now.getMilliseconds()).padStart(3, '0')}`;
                            const extension = type.split('/')[1] || 'png';
                            const fileName = `Pasted_image_${timestamp}.${extension}`;
                            const filePath = `${attachmentFolder}/${fileName}`;
                            
                            const arrayBuffer = await blob.arrayBuffer();
                            await this.app.vault.adapter.writeBinary(filePath, new Uint8Array(arrayBuffer));
                            
                            const imageLink = `![[${folder}/첨부파일/${fileName}|400]]`;
                            imageValue = imageValue ? imageValue + '\n' + imageLink : imageLink;
                            
                            imageTextarea.value = imageValue;
                            updateImagePreview();
                            new Notice('✅ 클립보드 이미지 붙여넣기 완료');
                            break;
                        }
                    }
                    if (imageFound) break;
                }
                
                if (!imageFound) {
                    new Notice('⚠️ 클립보드에 이미지가 없습니다');
                }
            } catch (error) {
                console.error('클립보드 붙여넣기 실패:', error);
                new Notice('❌ 클립보드 붙여넣기 실패');
            }
        };
        
        imageFileInput.onchange = async (e) => await handleImageUpload(Array.from(e.target.files), false);
        imageAddFileInput.onchange = async (e) => await handleImageUpload(Array.from(e.target.files), true);
        
        imageClearBtn.onclick = () => {
            imageValue = '';
            imageTextarea.value = '';
            updateImagePreview();
        };
        
        const imagePreview = imageGroup.createDiv();
        imagePreview.style.cssText = 'margin-top: 8px;';
        
        const updateImagePreview = () => {
            imagePreview.empty();
            if (!imageValue || !imageValue.trim()) {
                imagePreview.style.display = 'none';
                return;
            }
            imagePreview.style.display = 'grid';
            imagePreview.style.gridTemplateColumns = 'repeat(auto-fill, minmax(150px, 1fr))';
            imagePreview.style.gap = '8px';
            
            const lines = imageValue.split('\n').filter(l => l.trim());
            for (const line of lines) {
                let imageUrl = line.trim();
                let imageWidth = null;
                
                const sizeMatch = line.match(/\|(\d+)\]\]/);
                if (sizeMatch) imageWidth = sizeMatch[1] + 'px';
                
                if (imageUrl.includes('[[') && imageUrl.includes(']]')) {
                    const match = imageUrl.match(/!\[\[(.+?)(\|\d+)?\]\]/);
                    if (match && match[1]) {
                        let imagePath = match[1];
                        const folderName = this.folder || '기본';
                        const quizFolder = `${this.plugin.settings.clozeFolder}/QuizQuestions`;
                        
                        if (imagePath.startsWith(folderName + '/')) {
                            imagePath = `${quizFolder}/${imagePath}`;
                        } else if (!imagePath.startsWith(quizFolder)) {
                            if (!imagePath.includes('/')) {
                                imagePath = `${quizFolder}/${folderName}/첨부파일/${imagePath}`;
                            }
                        }
                        
                        const file = this.app.vault.getAbstractFileByPath(imagePath);
                        if (file) {
                            imageUrl = this.app.vault.adapter.getResourcePath(file.path);
                            const imgWrapper = imagePreview.createDiv();
                            imgWrapper.style.cssText = 'position: relative; border-radius: 5px; overflow: hidden;';
                            const img = imgWrapper.createEl('img', { attr: { src: imageUrl } });
                            img.style.cssText = 'width: 100%; height: 120px; object-fit: cover; cursor: pointer; border-radius: 5px;';
                            img.onclick = () => this.showImageZoom(imageUrl);
                        }
                    }
                } else if (imageUrl.startsWith('http')) {
                    const imgWrapper = imagePreview.createDiv();
                    imgWrapper.style.cssText = 'position: relative; border-radius: 5px; overflow: hidden;';
                    const img = imgWrapper.createEl('img', { attr: { src: imageUrl } });
                    img.style.cssText = 'width: 100%; height: 120px; object-fit: cover; cursor: pointer; border-radius: 5px;';
                    img.onclick = () => this.showImageZoom(imageUrl);
                }
            }
        };
        
        updateImagePreview();
        
        // 선택지 (동적으로 추가 가능) + 선택지별 이미지
        const optionsGroup = form.createDiv('form-group');
        optionsGroup.createEl('label', { text: '선택지' });
        optionsGroup.style.cssText = 'background: linear-gradient(135deg, #e8f5e915 0%, #c8e6c915 100%); border-radius: 12px; padding: 20px; border: 2px solid #4caf50; margin: 15px 0;';
        
        const optionsContainer = optionsGroup.createDiv('options-container');
        let options = this.questionData?.options ? [...this.questionData.options] : ['', '', '', ''];
        let optionImages = this.questionData?.optionImages ? [...this.questionData.optionImages] : [];
        const optionInputs = [];
        const optionImageValues = [];
        
        while (optionImages.length < options.length) optionImages.push('');
        
        const renderOptions = () => {
            optionsContainer.empty();
            optionInputs.length = 0;
            optionImageValues.length = 0;
            
            options.forEach((opt, index) => {
                const optionWrapper = optionsContainer.createDiv('option-wrapper');
                optionWrapper.style.cssText = 'background: var(--background-secondary); padding: 15px; border-radius: 8px; margin-bottom: 12px; border: 1px solid var(--background-modifier-border);';
                
                const optionRow = optionWrapper.createDiv('option-row');
                optionRow.style.cssText = 'display: flex; gap: 8px; margin-bottom: 8px; align-items: center;';
                
                const optionLabel = optionRow.createEl('span', { text: `선택지 ${index + 1}` });
                optionLabel.style.cssText = 'font-weight: 600; min-width: 80px; color: #4caf50;';
                
                const optionInput = optionRow.createEl('textarea', { 
                    placeholder: `선택지 ${index + 1}`
                });
                optionInput.value = opt;                optionInput.style.cssText = 'flex: 1; padding: 10px; font-size: 15px; border-radius: 6px; min-height: 60px; resize: vertical;';
                optionInputs.push(optionInput);
                
                optionInput.oninput = () => {
                    options[index] = optionInput.value;
                };
                
                if (options.length > 2) {
                    const removeBtn = optionRow.createEl('button', { text: '🗑️' });
                    removeBtn.type = 'button';
                    removeBtn.style.cssText = 'padding: 8px 12px; background: var(--background-modifier-error); color: white; border: none; border-radius: 6px; cursor: pointer;';
                    removeBtn.onclick = () => {
                        options.splice(index, 1);
                        optionImages.splice(index, 1);
                        renderOptions();
                    };
                }
                
                // 선택지 이미지 업로드
                const imageDiv = optionWrapper.createDiv();
                imageDiv.style.cssText = 'margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--background-modifier-border);';
                
                const imageLabel = imageDiv.createEl('label', { text: `선택지 ${index + 1} 이미지 (선택)` });
                imageLabel.style.cssText = 'display: block; font-size: 13px; color: var(--text-muted); margin-bottom: 5px;';
                
                let imageValue = optionImages[index] || '';
                optionImageValues.push(imageValue);
                
                const imageInput = imageDiv.createEl('textarea', {
                    placeholder: '이미지 URL 또는 ![[파일명]]'
                });
                imageInput.value = imageValue;
                imageInput.style.cssText = 'width: 100%; min-height: 50px; padding: 8px; font-size: 13px; resize: vertical;';
                imageInput.oninput = () => {
                    optionImages[index] = imageInput.value;
                    optionImageValues[index] = imageInput.value;
                    updateOptionImagePreview(index);
                };
                
                const imageBtnGroup = imageDiv.createDiv();
                imageBtnGroup.style.cssText = 'display: flex; gap: 6px; margin-top: 5px;';
                
                const uploadBtn = imageBtnGroup.createEl('button', { text: '📁 이미지' });
                uploadBtn.type = 'button';
                uploadBtn.style.cssText = 'flex: 1; padding: 6px 10px; background: var(--interactive-accent); color: var(--text-on-accent); border: none; border-radius: 5px; cursor: pointer; font-size: 12px;';
                
                const addBtn = imageBtnGroup.createEl('button', { text: '➕ 추가' });
                addBtn.type = 'button';
                addBtn.style.cssText = 'flex: 1; padding: 6px 10px; background: #2196F3; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 12px;';
                
                const pasteBtn = imageBtnGroup.createEl('button', { text: '📋 붙여넣기' });
                pasteBtn.type = 'button';
                pasteBtn.style.cssText = 'flex: 1; padding: 6px 10px; background: #4caf50; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 12px;';
                
                const clearBtn = imageBtnGroup.createEl('button', { text: '🗑️ 삭제' });
                clearBtn.type = 'button';
                clearBtn.style.cssText = 'flex: 1; padding: 6px 10px; background: var(--background-modifier-error); color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 12px;';
                
                const fileInput = imageDiv.createEl('input', { type: 'file', attr: { accept: 'image/*', multiple: 'true' } });
                fileInput.style.display = 'none';
                uploadBtn.onclick = () => fileInput.click();
                
                const addFileInput = imageDiv.createEl('input', { type: 'file', attr: { accept: 'image/*', multiple: 'true' } });
                addFileInput.style.display = 'none';
                addBtn.onclick = () => addFileInput.click();
                
                fileInput.onchange = async (e) => {
                    const files = Array.from(e.target.files);
                    if (files.length === 0) return;
                    
                    try {
                        const folder = this.folder || '기본';
                        const attachmentFolder = `${this.plugin.settings.clozeFolder}/QuizQuestions/${folder}/첨부파일`;
                        
                        const folderExists = this.app.vault.getAbstractFileByPath(attachmentFolder);
                        if (!folderExists) {
                            await this.app.vault.createFolder(attachmentFolder);
                        }
                        
                        const imageLinks = [];
                        for (const file of files) {
                            const timestamp = Date.now() + Math.floor(Math.random() * 1000);
                            const fileName = `${timestamp}_${file.name}`;
                            const filePath = `${attachmentFolder}/${fileName}`;
                            const arrayBuffer = await file.arrayBuffer();
                            await this.app.vault.adapter.writeBinary(filePath, new Uint8Array(arrayBuffer));
                            
                            imageLinks.push(`![[${folder}/첨부파일/${fileName}|400]]`);
                        }
                        
                        optionImages[index] = imageLinks.join('\n');
                        imageInput.value = optionImages[index];
                        optionImageValues[index] = optionImages[index];
                        updateOptionImagePreview(index);
                        
                        new Notice(`✅ 이미지 ${imageLinks.length}개 업로드 완료`);
                    } catch (error) {
                        console.error('이미지 업로드 실패:', error);
                        new Notice('❌ 이미지 업로드 실패');
                    }
                };
                
                // 추가 버튼 (기존 이미지에 추가)
                addFileInput.onchange = async (e) => {
                    const files = Array.from(e.target.files);
                    if (files.length === 0) return;
                    
                    try {
                        const folder = this.folder || '기본';
                        const attachmentFolder = `${this.plugin.settings.clozeFolder}/QuizQuestions/${folder}/첨부파일`;
                        
                        const folderExists = this.app.vault.getAbstractFileByPath(attachmentFolder);
                        if (!folderExists) {
                            await this.app.vault.createFolder(attachmentFolder);
                        }
                        
                        const imageLinks = [];
                        for (const file of files) {
                            const timestamp = Date.now() + Math.floor(Math.random() * 1000);
                            const fileName = `${timestamp}_${file.name}`;
                            const filePath = `${attachmentFolder}/${fileName}`;
                            const arrayBuffer = await file.arrayBuffer();
                            await this.app.vault.adapter.writeBinary(filePath, new Uint8Array(arrayBuffer));
                            
                            imageLinks.push(`![[${folder}/첨부파일/${fileName}|400]]`);
                        }
                        
                        const currentValue = imageInput.value.trim();
                        optionImages[index] = currentValue ? currentValue + '\n' + imageLinks.join('\n') : imageLinks.join('\n');
                        imageInput.value = optionImages[index];
                        optionImageValues[index] = optionImages[index];
                        updateOptionImagePreview(index);
                        
                        new Notice(`✅ 이미지 ${imageLinks.length}개 추가 완료`);
                    } catch (error) {
                        console.error('이미지 추가 실패:', error);
                        new Notice('❌ 이미지 추가 실패');
                    }
                };
                
                // 클립보드 붙여넣기
                pasteBtn.onclick = async () => {
                    try {
                        const items = await navigator.clipboard.read();
                        let imageFound = false;
                        
                        for (const item of items) {
                            for (const type of item.types) {
                                if (type.startsWith('image/')) {
                                    const blob = await item.getType(type);
                                    imageFound = true;
                                    
                                    const folder = this.folder || '기본';
                                    const attachmentFolder = `${this.plugin.settings.clozeFolder}/QuizQuestions/${folder}/첨부파일`;
                                    
                                    const folderExists = this.app.vault.getAbstractFileByPath(attachmentFolder);
                                    if (!folderExists) {
                                        await this.app.vault.createFolder(attachmentFolder);
                                    }
                                    
                                    const now = new Date();
                                    const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}${String(now.getMilliseconds()).padStart(3, '0')}`;
                                    const extension = type.split('/')[1] || 'png';
                                    const fileName = `Pasted_image_${timestamp}.${extension}`;
                                    const filePath = `${attachmentFolder}/${fileName}`;
                                    
                                    const arrayBuffer = await blob.arrayBuffer();
                                    await this.app.vault.adapter.writeBinary(filePath, new Uint8Array(arrayBuffer));
                                    
                                    const imageLink = `![[${folder}/첨부파일/${fileName}|400]]`;
                                    const currentValue = imageInput.value.trim();
                                    optionImages[index] = currentValue ? currentValue + '\n' + imageLink : imageLink;
                                    imageInput.value = optionImages[index];
                                    optionImageValues[index] = optionImages[index];
                                    updateOptionImagePreview(index);
                                    
                                    new Notice('✅ 클립보드 이미지 붙여넣기 완료');
                                    break;
                                }
                            }
                            if (imageFound) break;
                        }
                        
                        if (!imageFound) {
                            new Notice('⚠️ 클립보드에 이미지가 없습니다');
                        }
                    } catch (error) {
                        console.error('클립보드 붙여넣기 실패:', error);
                        new Notice('❌ 클립보드 붙여넣기 실패');
                    }
                };
                
                clearBtn.onclick = () => {
                    optionImages[index] = '';
                    imageInput.value = '';
                    optionImageValues[index] = '';
                    updateOptionImagePreview(index);
                };
                
                const imagePreview = imageDiv.createDiv();
                imagePreview.style.cssText = 'margin-top: 8px;';
                imagePreview.className = `option-image-preview-${index}`;
                
                const updateOptionImagePreview = (idx) => {
                    const preview = optionWrapper.querySelector(`.option-image-preview-${idx}`);
                    if (!preview) return;
                    
                    preview.empty();
                    const imgValue = optionImages[idx];
                    if (!imgValue || !imgValue.trim()) {
                        preview.style.display = 'none';
                        return;
                    }
                    preview.style.display = 'block';
                    
                    const lines = imgValue.split('\n').filter(l => l.trim());
                    const imageUrls = [];
                    
                    // 모든 이미지 URL 수집
                    for (const line of lines) {
                        let imageUrl = line.trim();
                        let imageWidth = null;
                        
                        const sizeMatch = line.match(/\|(\d+)\]\]/);
                        if (sizeMatch) imageWidth = sizeMatch[1] + 'px';
                        
                        if (imageUrl.includes('[[') && imageUrl.includes(']]')) {
                            const match = imageUrl.match(/!\[\[(.+?)(\|\d+)?\]\]/);
                            if (match && match[1]) {
                                let imagePath = match[1];
                                
                                const folderName = this.folder || '기본';
                                const quizFolder = `${this.plugin.settings.clozeFolder}/QuizQuestions`;
                                
                                // 경로 변환 로직
                                if (imagePath.startsWith(folderName + '/')) {
                                    imagePath = `${quizFolder}/${imagePath}`;
                                } else if (!imagePath.startsWith(quizFolder)) {
                                    imagePath = `${quizFolder}/${imagePath}`;
                                }
                                
                                const file = this.app.vault.getAbstractFileByPath(imagePath);
                                
                                if (file) {
                                    imageUrl = this.app.vault.adapter.getResourcePath(file.path);
                                    imageUrls.push({ url: imageUrl, width: imageWidth });
                                }
                            }
                        } else if (imageUrl.startsWith('http')) {
                            imageUrls.push({ url: imageUrl, width: imageWidth });
                        }
                    }
                    
                    if (imageUrls.length > 0) {
                        let currentImageIndex = 0;
                        const app = this.app; // app 참조 저장
                        
                        const imageDisplay = preview.createDiv();
                        imageDisplay.style.cssText = 'text-align: center; position: relative;';
                        
                        const img = imageDisplay.createEl('img');
                        img.style.cssText = 'max-width: 150px; max-height: 150px; border-radius: 5px; cursor: pointer;';
                        
                        let imageCounter = null;
                        if (imageUrls.length > 1) {
                            imageCounter = imageDisplay.createDiv();
                            imageCounter.style.cssText = `
                                position: absolute;
                                top: 4px;
                                right: 4px;
                                background: rgba(0, 0, 0, 0.7);
                                color: white;
                                padding: 2px 6px;
                                border-radius: 8px;
                                font-size: 11px;
                                font-weight: 600;
                            `;
                        }
                        
                        const updateImage = () => {
                            const currentImage = imageUrls[currentImageIndex];
                            img.src = currentImage.url;
                            if (currentImage.width) {
                                img.style.maxWidth = currentImage.width;
                            }
                            
                            // 이미지 클릭 시 확대 모달 (넘김 기능 포함)
                            img.onclick = () => {
                                const zoomModal = new Modal(app);
                                zoomModal.contentEl.style.cssText = 'padding: 0; max-width: 90vw; max-height: 90vh;';
                                
                                let zoomImageIndex = currentImageIndex;
                                
                                const container = zoomModal.contentEl.createDiv();
                                container.style.cssText = 'position: relative; display: flex; flex-direction: column; align-items: center; background: rgba(0, 0, 0, 0.9); padding: 20px;';
                                
                                const zoomImg = container.createEl('img');
                                zoomImg.style.cssText = 'max-width: 85vw; max-height: 80vh; object-fit: contain;';
                                
                                const counter = container.createDiv();
                                counter.style.cssText = 'position: absolute; top: 10px; right: 10px; background: rgba(0, 0, 0, 0.7); color: white; padding: 8px 12px; border-radius: 8px; font-size: 14px; font-weight: 600;';
                                
                                const updateZoomImage = () => {
                                    const currentZoom = imageUrls[zoomImageIndex];
                                    zoomImg.src = currentZoom.url;
                                    counter.textContent = `${zoomImageIndex + 1} / ${imageUrls.length}`;
                                };
                                
                                if (imageUrls.length > 1) {
                                    const navBar = container.createDiv();
                                    navBar.style.cssText = 'display: flex; gap: 12px; margin-top: 15px;';
                                    
                                    const prevBtn = navBar.createEl('button', { text: '◀ 이전' });
                                    prevBtn.style.cssText = 'padding: 10px 20px; background: var(--interactive-accent); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 14px;';
                                    prevBtn.onclick = () => {
                                        if (zoomImageIndex > 0) {
                                            zoomImageIndex--;
                                            updateZoomImage();
                                        }
                                    };
                                    
                                    const nextBtn = navBar.createEl('button', { text: '다음 ▶' });
                                    nextBtn.style.cssText = prevBtn.style.cssText;
                                    nextBtn.onclick = () => {
                                        if (zoomImageIndex < imageUrls.length - 1) {
                                            zoomImageIndex++;
                                            updateZoomImage();
                                        }
                                    };
                                    
                                    const closeBtn = navBar.createEl('button', { text: '✕ 닫기' });
                                    closeBtn.style.cssText = 'padding: 10px 20px; background: var(--background-modifier-error); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 14px;';
                                    closeBtn.onclick = () => zoomModal.close();
                                } else {
                                    const closeBtn = container.createEl('button', { text: '✕ 닫기' });
                                    closeBtn.style.cssText = 'margin-top: 15px; padding: 10px 20px; background: var(--background-modifier-error); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 14px;';
                                    closeBtn.onclick = () => zoomModal.close();
                                }
                                
                                updateZoomImage();
                                zoomModal.open();
                            };
                            
                            if (imageCounter) {
                                imageCounter.textContent = `${currentImageIndex + 1}/${imageUrls.length}`;
                            }
                        };
                        
                        if (imageUrls.length > 1) {
                            const navContainer = preview.createDiv();
                            navContainer.style.cssText = 'display: flex; justify-content: center; gap: 6px; margin-top: 6px;';
                            
                            const prevBtn = navContainer.createEl('button', { text: '◀' });
                            prevBtn.type = 'button';
                            prevBtn.style.cssText = `
                                padding: 3px 8px;
                                background: var(--interactive-accent);
                                color: var(--text-on-accent);
                                border: none;
                                border-radius: 4px;
                                cursor: pointer;
                                font-size: 11px;
                            `;
                            prevBtn.onclick = () => {
                                if (currentImageIndex > 0) {
                                    currentImageIndex--;
                                    updateImage();
                                }
                            };
                            
                            const nextBtn = navContainer.createEl('button', { text: '▶' });
                            nextBtn.type = 'button';
                            nextBtn.style.cssText = prevBtn.style.cssText;
                            nextBtn.onclick = () => {
                                if (currentImageIndex < imageUrls.length - 1) {
                                    currentImageIndex++;
                                    updateImage();
                                }
                            };
                        }
                        
                        updateImage();
                    }
                };
                
                updateOptionImagePreview(index);
            });
            
            const addBtn = optionsContainer.createEl('button', { text: '➕ 선택지 추가' });
            addBtn.type = 'button';
            addBtn.style.cssText = 'margin-top: 10px; padding: 8px 16px; background: #4caf50; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;';
            addBtn.onclick = () => {
                options.push('');
                optionImages.push('');
                renderOptions();
            };
        };
        
        renderOptions();
        
        // 정답 선택
        const answerGroup = form.createDiv('form-group');
        answerGroup.createEl('label', { text: '정답 (선택지 번호, 0부터 시작)' });
        const answerInput = answerGroup.createEl('input', { 
            type: 'number', 
            placeholder: '0',
            value: String(this.questionData?.answer ?? 0),
            attr: { min: '0' }
        });
        
        // 힌트
        const hintGroup = form.createDiv('form-group');
        const hintLabelRow = hintGroup.createDiv();
        hintLabelRow.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;';
        hintLabelRow.createEl('label', { text: '힌트 (선택사항)' });
        
        const hintExpandBtn = hintLabelRow.createEl('button', { text: '🔍 크게 보기' });
        hintExpandBtn.type = 'button';
        hintExpandBtn.style.cssText = 'padding: 4px 12px; background: var(--interactive-accent); color: var(--text-on-accent); border: none; border-radius: 4px; cursor: pointer; font-size: 0.85em;';
        
        const hintInput = hintGroup.createEl('textarea', { 
            placeholder: '힌트를 입력하세요',
            value: this.questionData?.hint || ''
        });
        hintInput.style.minHeight = '60px';
        
        hintExpandBtn.onclick = () => {
            new TextInputModal(
                this.app,
                '힌트 편집',
                '힌트 내용을 입력하세요',
                hintInput.value,
                (newValue) => {
                    hintInput.value = newValue;
                },
                true
            ).open();
        };
        
        // 힌트 이미지
        const hintImageGroup = form.createDiv('form-group');
        hintImageGroup.createEl('label', { text: '힌트 이미지 (선택사항)' });
        let hintImageValue = this.questionData?.hintImage || '';
        const hintImageInput = hintImageGroup.createEl('textarea', {
            placeholder: '이미지 URL 또는 ![[파일명]]',
            value: hintImageValue
        });
        hintImageInput.style.minHeight = '60px';
        hintImageInput.oninput = () => {
            hintImageValue = hintImageInput.value;
            updateHintImagePreview();
        };
        
        const hintImageBtnRow = hintImageGroup.createDiv();
        hintImageBtnRow.style.cssText = 'display: flex; gap: 6px; margin-top: 8px;';
        
        const hintImageSelectBtn = hintImageBtnRow.createEl('button', { text: '📁 선택' });
        hintImageSelectBtn.type = 'button';
        hintImageSelectBtn.style.cssText = 'flex: 1; padding: 6px 10px; background: var(--interactive-accent); color: var(--text-on-accent); border: none; border-radius: 5px; cursor: pointer; font-size: 12px;';
        
        const hintImagePasteBtn = hintImageBtnRow.createEl('button', { text: '📋 붙여넣기' });
        hintImagePasteBtn.type = 'button';
        hintImagePasteBtn.style.cssText = 'flex: 1; padding: 6px 10px; background: #4caf50; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 12px;';
        
        const hintImageAddBtn = hintImageBtnRow.createEl('button', { text: '➕ 추가' });
        hintImageAddBtn.type = 'button';
        hintImageAddBtn.style.cssText = 'flex: 1; padding: 6px 10px; background: #2196F3; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 12px;';
        
        const hintImageClearBtn = hintImageBtnRow.createEl('button', { text: '🗑️ 삭제' });
        hintImageClearBtn.type = 'button';
        hintImageClearBtn.style.cssText = 'flex: 1; padding: 6px 10px; background: var(--background-modifier-error); color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 12px;';
        
        const hintImageFileInput = hintImageGroup.createEl('input', { type: 'file', attr: { accept: 'image/*', multiple: 'true' } });
        hintImageFileInput.style.display = 'none';
        hintImageSelectBtn.onclick = () => hintImageFileInput.click();
        
        const hintImageAddFileInput = hintImageGroup.createEl('input', { type: 'file', attr: { accept: 'image/*', multiple: 'true' } });
        hintImageAddFileInput.style.display = 'none';
        hintImageAddBtn.onclick = () => hintImageAddFileInput.click();
        
        const handleHintImageUpload = async (files, isAdd) => {
            if (files.length === 0) return;
            try {
                const folder = this.folder || '기본';
                const attachmentFolder = `${this.plugin.settings.clozeFolder}/QuizQuestions/${folder}/첨부파일`;
                
                const folderExists = this.app.vault.getAbstractFileByPath(attachmentFolder);
                if (!folderExists) {
                    await this.app.vault.createFolder(attachmentFolder);
                }
                
                const imageLinks = [];
                for (const file of files) {
                    const timestamp = Date.now() + Math.floor(Math.random() * 1000);
                    const fileName = `${timestamp}_${file.name}`;
                    const filePath = `${attachmentFolder}/${fileName}`;
                    const arrayBuffer = await file.arrayBuffer();
                    await this.app.vault.adapter.writeBinary(filePath, new Uint8Array(arrayBuffer));
                    imageLinks.push(`![[${folder}/첨부파일/${fileName}|400]]`);
                }
                
                if (isAdd) {
                    hintImageValue = hintImageValue ? hintImageValue + '\n' + imageLinks.join('\n') : imageLinks.join('\n');
                } else {
                    hintImageValue = imageLinks.join('\n');
                }
                hintImageInput.value = hintImageValue;
                updateHintImagePreview();
                new Notice(`✅ 이미지 ${imageLinks.length}개 업로드 완료`);
            } catch (error) {
                console.error('이미지 업로드 실패:', error);
                new Notice('❌ 이미지 업로드 실패');
            }
        };
        
        hintImageFileInput.onchange = (e) => handleHintImageUpload(Array.from(e.target.files), false);
        hintImageAddFileInput.onchange = (e) => handleHintImageUpload(Array.from(e.target.files), true);
        
        hintImagePasteBtn.onclick = async () => {
            try {
                const items = await navigator.clipboard.read();
                let imageFound = false;
                
                for (const item of items) {
                    for (const type of item.types) {
                        if (type.startsWith('image/')) {
                            const blob = await item.getType(type);
                            imageFound = true;
                            
                            const folder = this.folder || '기본';
                            const attachmentFolder = `${this.plugin.settings.clozeFolder}/QuizQuestions/${folder}/첨부파일`;
                            
                            const folderExists = this.app.vault.getAbstractFileByPath(attachmentFolder);
                            if (!folderExists) {
                                await this.app.vault.createFolder(attachmentFolder);
                            }
                            
                            const now = new Date();
                            const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}${String(now.getMilliseconds()).padStart(3, '0')}`;
                            const extension = type.split('/')[1] || 'png';
                            const fileName = `Pasted_image_${timestamp}.${extension}`;
                            const filePath = `${attachmentFolder}/${fileName}`;
                            
                            const arrayBuffer = await blob.arrayBuffer();
                            await this.app.vault.adapter.writeBinary(filePath, new Uint8Array(arrayBuffer));
                            
                            const imageLink = `![[${folder}/첨부파일/${fileName}|400]]`;
                            hintImageValue = hintImageValue ? hintImageValue + '\n' + imageLink : imageLink;
                            hintImageInput.value = hintImageValue;
                            updateHintImagePreview();
                            
                            new Notice('✅ 클립보드 이미지 붙여넣기 완료');
                            break;
                        }
                    }
                    if (imageFound) break;
                }
                
                if (!imageFound) {
                    new Notice('⚠️ 클립보드에 이미지가 없습니다');
                }
            } catch (error) {
                console.error('클립보드 붙여넣기 실패:', error);
                new Notice('❌ 클립보드 붙여넣기 실패');
            }
        };
        
        hintImageClearBtn.onclick = () => {
            hintImageValue = '';
            hintImageInput.value = '';
            updateHintImagePreview();
        };
        
        const hintImagePreview = hintImageGroup.createDiv();
        hintImagePreview.style.cssText = 'margin-top: 8px;';
        
        const updateHintImagePreview = () => {
            hintImagePreview.empty();
            if (!hintImageValue || !hintImageValue.trim()) {
                hintImagePreview.style.display = 'none';
                return;
            }
            hintImagePreview.style.display = 'grid';
            hintImagePreview.style.gridTemplateColumns = 'repeat(auto-fill, minmax(150px, 1fr))';
            hintImagePreview.style.gap = '8px';
            
            // 모든 이미지 URL 수집
            const allImageUrls = [];
            const lines = hintImageValue.split('\n').filter(l => l.trim());
            
            for (const line of lines) {
                let imageUrl = line.trim();
                let imageWidth = null;
                
                const sizeMatch = line.match(/\|(\d+)\]\]/);
                if (sizeMatch) imageWidth = sizeMatch[1] + 'px';
                
                if (imageUrl.includes('[[') && imageUrl.includes(']]')) {
                    const match = imageUrl.match(/!\[\[(.+?)(\|\d+)?\]\]/);
                    if (match && match[1]) {
                        let imagePath = match[1];
                        const folderName = this.folder || '기본';
                        const quizFolder = `${this.plugin.settings.clozeFolder}/QuizQuestions`;
                        
                        if (imagePath.startsWith(folderName + '/')) {
                            imagePath = `${quizFolder}/${imagePath}`;
                        } else if (!imagePath.startsWith(quizFolder)) {
                            if (!imagePath.includes('/')) {
                                imagePath = `${quizFolder}/${folderName}/첨부파일/${imagePath}`;
                            }
                        }
                        
                        const file = this.app.vault.getAbstractFileByPath(imagePath);
                        if (file) {
                            imageUrl = this.app.vault.adapter.getResourcePath(file.path);
                            allImageUrls.push(imageUrl);
                        }
                    }
                } else if (imageUrl.startsWith('http')) {
                    allImageUrls.push(imageUrl);
                }
            }
            
            // 이미지 미리보기 표시
            allImageUrls.forEach((imageUrl, index) => {
                const imgWrapper = hintImagePreview.createDiv();
                imgWrapper.style.cssText = 'position: relative; border-radius: 5px; overflow: hidden;';
                const img = imgWrapper.createEl('img', { attr: { src: imageUrl } });
                img.style.cssText = 'width: 100%; height: 120px; object-fit: cover; cursor: pointer; border-radius: 5px;';
                img.onclick = () => this.showHintImageSlider(allImageUrls, index);
            });
        };
        
        updateHintImagePreview();
        
        // 노트
        const noteGroup = form.createDiv('form-group');
        const noteLabelRow = noteGroup.createDiv();
        noteLabelRow.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;';
        noteLabelRow.createEl('label', { text: '노트 (선택사항)' });
        
        const noteExpandBtn = noteLabelRow.createEl('button', { text: '🔍 크게 보기' });
        noteExpandBtn.type = 'button';
        noteExpandBtn.style.cssText = 'padding: 4px 12px; background: var(--interactive-accent); color: var(--text-on-accent); border: none; border-radius: 4px; cursor: pointer; font-size: 0.85em;';
        
        const noteInput = noteGroup.createEl('textarea', { 
            placeholder: '추가 설명을 입력하세요',
            value: this.questionData?.note || ''
        });
        noteInput.style.minHeight = '60px';
        
        noteExpandBtn.onclick = () => {
            new TextInputModal(
                this.app,
                '노트 편집',
                '노트 내용을 입력하세요',
                noteInput.value,
                (newValue) => {
                    noteInput.value = newValue;
                },
                true
            ).open();
        };
        
        // 노트 이미지
        const noteImageGroup = form.createDiv('form-group');
        noteImageGroup.createEl('label', { text: '노트 이미지 (선택사항)' });
        let noteImageValue = this.questionData?.noteImage || '';
        const noteImageInput = noteImageGroup.createEl('textarea', {
            placeholder: '이미지 URL 또는 ![[파일명]]',
            value: noteImageValue
        });
        noteImageInput.style.minHeight = '60px';
        noteImageInput.oninput = () => {
            noteImageValue = noteImageInput.value;
            updateNoteImagePreview();
        };
        
        const noteImageBtnRow = noteImageGroup.createDiv();
        noteImageBtnRow.style.cssText = 'display: flex; gap: 6px; margin-top: 8px;';
        
        const noteImageSelectBtn = noteImageBtnRow.createEl('button', { text: '📁 선택' });
        noteImageSelectBtn.type = 'button';
        noteImageSelectBtn.style.cssText = 'flex: 1; padding: 6px 10px; background: var(--interactive-accent); color: var(--text-on-accent); border: none; border-radius: 5px; cursor: pointer; font-size: 12px;';
        
        const noteImagePasteBtn = noteImageBtnRow.createEl('button', { text: '📋 붙여넣기' });
        noteImagePasteBtn.type = 'button';
        noteImagePasteBtn.style.cssText = 'flex: 1; padding: 6px 10px; background: #4caf50; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 12px;';
        
        const noteImageAddBtn = noteImageBtnRow.createEl('button', { text: '➕ 추가' });
        noteImageAddBtn.type = 'button';
        noteImageAddBtn.style.cssText = 'flex: 1; padding: 6px 10px; background: #2196F3; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 12px;';
        
        const noteImageClearBtn = noteImageBtnRow.createEl('button', { text: '🗑️ 삭제' });
        noteImageClearBtn.type = 'button';
        noteImageClearBtn.style.cssText = 'flex: 1; padding: 6px 10px; background: var(--background-modifier-error); color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 12px;';
        
        const noteImageFileInput = noteImageGroup.createEl('input', { type: 'file', attr: { accept: 'image/*', multiple: 'true' } });
        noteImageFileInput.style.display = 'none';
        noteImageSelectBtn.onclick = () => noteImageFileInput.click();
        
        const noteImageAddFileInput = noteImageGroup.createEl('input', { type: 'file', attr: { accept: 'image/*', multiple: 'true' } });
        noteImageAddFileInput.style.display = 'none';
        noteImageAddBtn.onclick = () => noteImageAddFileInput.click();
        
        const handleNoteImageUpload = async (files, isAdd) => {
            if (files.length === 0) return;
            try {
                const folder = this.folder || '기본';
                const attachmentFolder = `${this.plugin.settings.clozeFolder}/QuizQuestions/${folder}/첨부파일`;
                
                const folderExists = this.app.vault.getAbstractFileByPath(attachmentFolder);
                if (!folderExists) {
                    await this.app.vault.createFolder(attachmentFolder);
                }
                
                const imageLinks = [];
                for (const file of files) {
                    const timestamp = Date.now() + Math.floor(Math.random() * 1000);
                    const fileName = `${timestamp}_${file.name}`;
                    const filePath = `${attachmentFolder}/${fileName}`;
                    const arrayBuffer = await file.arrayBuffer();
                    await this.app.vault.adapter.writeBinary(filePath, new Uint8Array(arrayBuffer));
                    imageLinks.push(`![[${folder}/첨부파일/${fileName}|400]]`);
                }
                
                if (isAdd) {
                    noteImageValue = noteImageValue ? noteImageValue + '\n' + imageLinks.join('\n') : imageLinks.join('\n');
                } else {
                    noteImageValue = imageLinks.join('\n');
                }
                noteImageInput.value = noteImageValue;
                updateNoteImagePreview();
                new Notice(`✅ 이미지 ${imageLinks.length}개 업로드 완료`);
            } catch (error) {
                console.error('이미지 업로드 실패:', error);
                new Notice('❌ 이미지 업로드 실패');
            }
        };
        
        noteImageFileInput.onchange = (e) => handleNoteImageUpload(Array.from(e.target.files), false);
        noteImageAddFileInput.onchange = (e) => handleNoteImageUpload(Array.from(e.target.files), true);
        
        noteImagePasteBtn.onclick = async () => {
            try {
                const items = await navigator.clipboard.read();
                let imageFound = false;
                
                for (const item of items) {
                    for (const type of item.types) {
                        if (type.startsWith('image/')) {
                            const blob = await item.getType(type);
                            imageFound = true;
                            
                            const folder = this.folder || '기본';
                            const attachmentFolder = `${this.plugin.settings.clozeFolder}/QuizQuestions/${folder}/첨부파일`;
                            
                            const folderExists = this.app.vault.getAbstractFileByPath(attachmentFolder);
                            if (!folderExists) {
                                await this.app.vault.createFolder(attachmentFolder);
                            }
                            
                            const now = new Date();
                            const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}${String(now.getMilliseconds()).padStart(3, '0')}`;
                            const extension = type.split('/')[1] || 'png';
                            const fileName = `Pasted_image_${timestamp}.${extension}`;
                            const filePath = `${attachmentFolder}/${fileName}`;
                            
                            const arrayBuffer = await blob.arrayBuffer();
                            await this.app.vault.adapter.writeBinary(filePath, new Uint8Array(arrayBuffer));
                            
                            const imageLink = `![[${folder}/첨부파일/${fileName}|400]]`;
                            noteImageValue = noteImageValue ? noteImageValue + '\n' + imageLink : imageLink;
                            noteImageInput.value = noteImageValue;
                            updateNoteImagePreview();
                            
                            new Notice('✅ 클립보드 이미지 붙여넣기 완료');
                            break;
                        }
                    }
                    if (imageFound) break;
                }
                
                if (!imageFound) {
                    new Notice('⚠️ 클립보드에 이미지가 없습니다');
                }
            } catch (error) {
                console.error('클립보드 붙여넣기 실패:', error);
                new Notice('❌ 클립보드 붙여넣기 실패');
            }
        };
        
        noteImageClearBtn.onclick = () => {
            noteImageValue = '';
            noteImageInput.value = '';
            updateNoteImagePreview();
        };
        
        const noteImagePreview = noteImageGroup.createDiv('note-image-preview');
        noteImagePreview.style.cssText = 'margin-top: 10px; display: none;';
        
        const updateNoteImagePreview = () => {
            noteImagePreview.empty();
            if (!noteImageValue || !noteImageValue.trim()) {
                noteImagePreview.style.display = 'none';
                return;
            }
            noteImagePreview.style.display = 'grid';
            noteImagePreview.style.gridTemplateColumns = 'repeat(auto-fill, minmax(150px, 1fr))';
            noteImagePreview.style.gap = '8px';
            
            // 모든 이미지 URL 수집
            const allImageUrls = [];
            const lines = noteImageValue.split('\n').filter(l => l.trim());
            
            for (const line of lines) {
                let imageUrl = line.trim();
                let imageWidth = null;
                
                const sizeMatch = line.match(/\|(\d+)\]\]/);
                if (sizeMatch) imageWidth = sizeMatch[1] + 'px';
                
                if (imageUrl.includes('[[') && imageUrl.includes(']]')) {
                    const match = imageUrl.match(/!\[\[(.+?)(\|\d+)?\]\]/);
                    if (match && match[1]) {
                        let imagePath = match[1];
                        const folderName = this.folder || '기본';
                        const quizFolder = `${this.plugin.settings.clozeFolder}/QuizQuestions`;
                        
                        if (imagePath.startsWith(folderName + '/')) {
                            imagePath = `${quizFolder}/${imagePath}`;
                        } else if (!imagePath.startsWith(quizFolder)) {
                            if (!imagePath.includes('/')) {
                                imagePath = `${quizFolder}/${folderName}/첨부파일/${imagePath}`;
                            }
                        }
                        
                        const file = this.app.vault.getAbstractFileByPath(imagePath);
                        if (file) {
                            imageUrl = this.app.vault.adapter.getResourcePath(file.path);
                            allImageUrls.push(imageUrl);
                        }
                    }
                } else if (imageUrl.startsWith('http')) {
                    allImageUrls.push(imageUrl);
                }
            }
            
            // 이미지 미리보기 표시
            allImageUrls.forEach((imageUrl, index) => {
                const imgWrapper = noteImagePreview.createDiv();
                imgWrapper.style.cssText = 'position: relative; border-radius: 5px; overflow: hidden;';
                const img = imgWrapper.createEl('img', { attr: { src: imageUrl } });
                img.style.cssText = 'width: 100%; height: 120px; object-fit: cover; cursor: pointer; border-radius: 5px;';
                img.onclick = () => this.showNoteImageSlider(allImageUrls, index);
            });
        };
        
        updateNoteImagePreview();
        
        // 버튼
        const btnGroup = form.createDiv('form-buttons');
        
        const saveBtn = btnGroup.createEl('button', { text: '저장', cls: 'mod-cta' });
        saveBtn.onclick = async () => {
            const opts = options.filter(o => o && o.trim());
            const answerIndex = parseInt(answerInput.value) || 0;
            
            if (!questionInput.value.trim()) {
                new Notice('❌ 문제를 입력하세요');
                return;
            }
            
            if (opts.length < 1) {
                new Notice('❌ 최소 1개 이상의 선택지가 필요합니다');
                return;
            }
            
            if (answerIndex < 0 || answerIndex >= opts.length) {
                new Notice(`❌ 정답은 0부터 ${opts.length - 1} 사이여야 합니다`);
                return;
            }
            
            // 선택지 이미지를 선택지 수에 맞게 조정
            const finalOptionImages = optionImages.slice(0, opts.length);
            while (finalOptionImages.length < opts.length) {
                finalOptionImages.push('');
            }
            
            // 키워드 파싱 (쉼표로 구분)
            const keywordsArray = keywordInput.value
                .split(',')
                .map(k => k.trim())
                .filter(k => k.length > 0);
            
            // 한자는 키워드의 첫 번째 값 또는 문제 제목 사용
            const hanzi = keywordsArray.length > 0 ? keywordsArray[0] : (questionInput.value.trim().substring(0, 20) + '...');
            
            const question = {
                hanzi: hanzi,
                number: numberInput.value.trim(),
                question: questionInput.value.trim(),
                options: opts,
                optionImages: finalOptionImages,
                answer: answerIndex,
                difficulty: difficultySelect.value || '보통',
                keywords: keywordsArray,
                hint: hintInput.value.trim(),
                note: noteInput.value.trim(),
                image: imageValue.trim(),
                hintImage: hintImageValue.trim(),
                noteImage: noteImageValue.trim(),
                folder: this.folder,
                filePath: this.questionData?.filePath,
                wrongCount: this.questionData?.wrongCount || 0,
                correctCount: this.questionData?.correctCount || 0,
                bookmarked: this.questionData?.bookmarked || false,
                created: this.questionData?.created || new Date().toLocaleDateString('ko-KR')
            };
            
            await this.plugin.saveQuestion(question, !this.isEdit);
            this.close();
        };
        
        const cancelBtn = btnGroup.createEl('button', { text: '취소' });
        cancelBtn.onclick = () => this.close();
        
        if (this.isEdit && this.questionData?.filePath) {
            const deleteBtn = btnGroup.createEl('button', { text: '삭제', cls: 'mod-warning' });
            deleteBtn.onclick = async () => {
                if (confirm('이 문제를 삭제하시겠습니까?')) {
                    const file = this.app.vault.getAbstractFileByPath(this.questionData.filePath);
                    if (file) {
                        await this.app.vault.delete(file);
                        new Notice('✅ 문제가 삭제되었습니다');
                        this.close();
                    }
                }
            };
        }
    }

    showNoteImageSlider(imageUrls, startIndex = 0) {
        const modal = new Modal(this.app);
        modal.titleEl.setText('📝 노트 이미지');
        modal.titleEl.style.cssText = `
            background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
            color: white;
            padding: 20px;
            margin: -20px -20px 20px -20px;
            border-radius: 12px 12px 0 0;
            text-align: center;
            font-size: 20px;
            font-weight: 600;
        `;
        
        const modalBody = modal.contentEl;
        modalBody.style.cssText = 'padding: 20px;';
        
        if (imageUrls.length > 0) {
            const sliderContainer = modalBody.createDiv();
            sliderContainer.style.cssText = 'text-align: center;';
            
            let currentIndex = startIndex;
            
            const imageWrapper = sliderContainer.createDiv();
            imageWrapper.style.cssText = 'margin: 20px 0;';
            
            const img = imageWrapper.createEl('img');
            img.style.cssText = 'max-width: 100%; max-height: 400px; border-radius: 8px; cursor: pointer; display: block; margin: 0 auto;';
            img.src = imageUrls[currentIndex];
            img.onclick = () => this.showImageZoom(imageUrls[currentIndex]);
            
            if (imageUrls.length > 1) {
                const btnContainer = sliderContainer.createDiv();
                btnContainer.style.cssText = 'display: flex; justify-content: center; align-items: center; gap: 20px; margin-top: 16px;';
                
                const prevBtn = btnContainer.createEl('button', { text: '◀' });
                prevBtn.style.cssText = `
                    padding: 10px 20px;
                    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                    color: white;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 16px;
                    font-weight: bold;
                    transition: all 0.2s;
                    box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
                `;
                prevBtn.onmouseenter = () => {
                    prevBtn.style.transform = 'scale(1.05)';
                    prevBtn.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.5)';
                };
                prevBtn.onmouseleave = () => {
                    prevBtn.style.transform = 'scale(1)';
                    prevBtn.style.boxShadow = '0 2px 8px rgba(59, 130, 246, 0.3)';
                };
                prevBtn.onclick = () => {
                    currentIndex = (currentIndex - 1 + imageUrls.length) % imageUrls.length;
                    img.src = imageUrls[currentIndex];
                    counter.textContent = `${currentIndex + 1} / ${imageUrls.length}`;
                };
                
                const counter = btnContainer.createEl('div');
                counter.textContent = `${currentIndex + 1} / ${imageUrls.length}`;
                counter.style.cssText = `
                    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                    color: white;
                    padding: 8px 20px;
                    border-radius: 20px;
                    font-size: 14px;
                    font-weight: 600;
                    min-width: 80px;
                    text-align: center;
                `;
                
                const nextBtn = btnContainer.createEl('button', { text: '▶' });
                nextBtn.style.cssText = `
                    padding: 10px 20px;
                    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                    color: white;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 16px;
                    font-weight: bold;
                    transition: all 0.2s;
                    box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
                `;
                nextBtn.onmouseenter = () => {
                    nextBtn.style.transform = 'scale(1.05)';
                    nextBtn.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.5)';
                };
                nextBtn.onmouseleave = () => {
                    nextBtn.style.transform = 'scale(1)';
                    nextBtn.style.boxShadow = '0 2px 8px rgba(59, 130, 246, 0.3)';
                };
                nextBtn.onclick = () => {
                    currentIndex = (currentIndex + 1) % imageUrls.length;
                    img.src = imageUrls[currentIndex];
                    counter.textContent = `${currentIndex + 1} / ${imageUrls.length}`;
                };
            }
        }
        
        const closeBtn = modalBody.createEl('button', { text: '닫기', cls: 'mod-cta' });
        closeBtn.style.cssText = `
            margin-top: 20px;
            padding: 10px 24px;
            width: 100%;
            font-size: 16px;
            font-weight: 600;
        `;
        closeBtn.onclick = () => modal.close();
        
        modal.open();
    }

    showHintImageSlider(imageUrls, startIndex = 0) {
        const modal = new Modal(this.app);
        modal.titleEl.setText('💡 힌트 이미지');
        modal.titleEl.style.cssText = `
            background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
            color: white;
            padding: 20px;
            margin: -20px -20px 20px -20px;
            border-radius: 12px 12px 0 0;
            text-align: center;
            font-size: 20px;
            font-weight: 600;
        `;
        
        const modalBody = modal.contentEl;
        modalBody.style.cssText = 'padding: 20px;';
        
        if (imageUrls.length > 0) {
            const sliderContainer = modalBody.createDiv();
            sliderContainer.style.cssText = 'text-align: center;';
            
            let currentIndex = startIndex;
            
            const imageWrapper = sliderContainer.createDiv();
            imageWrapper.style.cssText = 'margin: 20px 0;';
            
            const img = imageWrapper.createEl('img');
            img.style.cssText = 'max-width: 100%; max-height: 400px; border-radius: 8px; cursor: pointer; display: block; margin: 0 auto;';
            img.src = imageUrls[currentIndex];
            img.onclick = () => this.showImageZoom(imageUrls[currentIndex]);
            
            if (imageUrls.length > 1) {
                const btnContainer = sliderContainer.createDiv();
                btnContainer.style.cssText = 'display: flex; justify-content: center; align-items: center; gap: 20px; margin-top: 16px;';
                
                const prevBtn = btnContainer.createEl('button', { text: '◀' });
                prevBtn.style.cssText = `
                    padding: 10px 20px;
                    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
                    color: white;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 16px;
                    font-weight: bold;
                    transition: all 0.2s;
                    box-shadow: 0 2px 8px rgba(245, 158, 11, 0.3);
                `;
                prevBtn.onmouseenter = () => {
                    prevBtn.style.transform = 'scale(1.05)';
                    prevBtn.style.boxShadow = '0 4px 12px rgba(245, 158, 11, 0.5)';
                };
                prevBtn.onmouseleave = () => {
                    prevBtn.style.transform = 'scale(1)';
                    prevBtn.style.boxShadow = '0 2px 8px rgba(245, 158, 11, 0.3)';
                };
                prevBtn.onclick = () => {
                    currentIndex = (currentIndex - 1 + imageUrls.length) % imageUrls.length;
                    img.src = imageUrls[currentIndex];
                    counter.textContent = `${currentIndex + 1} / ${imageUrls.length}`;
                };
                
                const counter = btnContainer.createEl('div');
                counter.textContent = `${currentIndex + 1} / ${imageUrls.length}`;
                counter.style.cssText = `
                    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
                    color: white;
                    padding: 8px 20px;
                    border-radius: 20px;
                    font-size: 14px;
                    font-weight: 600;
                    min-width: 80px;
                    text-align: center;
                `;
                
                const nextBtn = btnContainer.createEl('button', { text: '▶' });
                nextBtn.style.cssText = `
                    padding: 10px 20px;
                    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
                    color: white;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 16px;
                    font-weight: bold;
                    transition: all 0.2s;
                    box-shadow: 0 2px 8px rgba(245, 158, 11, 0.3);
                `;
                nextBtn.onmouseenter = () => {
                    nextBtn.style.transform = 'scale(1.05)';
                    nextBtn.style.boxShadow = '0 4px 12px rgba(245, 158, 11, 0.5)';
                };
                nextBtn.onmouseleave = () => {
                    nextBtn.style.transform = 'scale(1)';
                    nextBtn.style.boxShadow = '0 2px 8px rgba(245, 158, 11, 0.3)';
                };
                nextBtn.onclick = () => {
                    currentIndex = (currentIndex + 1) % imageUrls.length;
                    img.src = imageUrls[currentIndex];
                    counter.textContent = `${currentIndex + 1} / ${imageUrls.length}`;
                };
            }
        }
        
        const closeBtn = modalBody.createEl('button', { text: '닫기', cls: 'mod-cta' });
        closeBtn.style.cssText = `
            margin-top: 20px;
            padding: 10px 24px;
            width: 100%;
            font-size: 16px;
            font-weight: 600;
        `;
        closeBtn.onclick = () => modal.close();
        
        modal.open();
    }

    showImageZoom(imageSrc) {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0, 0, 0, 0.9);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        
        const container = document.createElement('div');
        container.style.cssText = `
            position: relative;
            max-width: 90vw;
            max-height: 90vh;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        
        const img = document.createElement('img');
        img.src = imageSrc;
        img.style.cssText = `
            max-width: 100%;
            max-height: 90vh;
            object-fit: contain;
            transform-origin: center center;
            transition: transform 0.3s ease;
        `;
        
        let scale = 1;
        let lastDistance = 0;
        let isDragging = false;
        let lastPosX = 0;
        let lastPosY = 0;
        let translateX = 0;
        let translateY = 0;
        
        const updateTransform = () => {
            img.style.transform = `scale(${scale}) translate(${translateX}px, ${translateY}px)`;
        };
        
        // 터치 확대/축소
        container.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                lastDistance = Math.sqrt(dx * dx + dy * dy);
            } else if (e.touches.length === 1) {
                isDragging = true;
                lastPosX = e.touches[0].clientX;
                lastPosY = e.touches[0].clientY;
            }
        });
        
        container.addEventListener('touchmove', (e) => {
            if (e.touches.length === 2) {
                e.preventDefault();
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (lastDistance > 0) {
                    const delta = distance / lastDistance;
                    scale = Math.max(1, Math.min(4, scale * delta));
                    updateTransform();
                }
                lastDistance = distance;
            } else if (e.touches.length === 1 && isDragging && scale > 1) {
                e.preventDefault();
                const deltaX = e.touches[0].clientX - lastPosX;
                const deltaY = e.touches[0].clientY - lastPosY;
                translateX += deltaX / scale;
                translateY += deltaY / scale;
                lastPosX = e.touches[0].clientX;
                lastPosY = e.touches[0].clientY;
                updateTransform();
            }
        });
        
        container.addEventListener('touchend', (e) => {
            if (e.touches.length < 2) {
                lastDistance = 0;
            }
            if (e.touches.length === 0) {
                isDragging = false;
            }
        });
        
        // 마우스 휠 확대/축소
        container.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            scale = Math.max(1, Math.min(4, scale * delta));
            updateTransform();
        });
        
        // 더블클릭으로 확대/축소
        img.addEventListener('dblclick', () => {
            if (scale === 1) {
                scale = 2;
            } else {
                scale = 1;
                translateX = 0;
                translateY = 0;
            }
            updateTransform();
        });
        
        // 닫기 버튼
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✖️';
        closeBtn.style.cssText = `
            position: absolute;
            top: 20px;
            right: 20px;
            background: rgba(255, 255, 255, 0.2);
            color: white;
            border: none;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            font-size: 20px;
            cursor: pointer;
            z-index: 10001;
        `;
        closeBtn.onclick = () => document.body.removeChild(overlay);
        
        // ESC 키로 닫기
        const keyHandler = (e) => {
            if (e.key === 'Escape') {
                document.body.removeChild(overlay);
                document.removeEventListener('keydown', keyHandler);
            }
        };
        document.addEventListener('keydown', keyHandler);
        
        // 오버레이 클릭으로 닫기
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                document.body.removeChild(overlay);
                document.removeEventListener('keydown', keyHandler);
            }
        });
        
        container.appendChild(img);
        overlay.appendChild(container);
        overlay.appendChild(closeBtn);
        document.body.appendChild(overlay);
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

class QuizListModal extends Modal {
    constructor(app, plugin, folder) {
        super(app);
        this.plugin = plugin;
        this.folder = folder;
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('quiz-list-modal');
        
        const header = contentEl.createDiv('quiz-list-header');
        header.createEl('h2', { text: `${this.folder} 문제 목록` });
        
        const addBtn = header.createEl('button', { text: '+ 새 문제', cls: 'mod-cta' });
        addBtn.onclick = () => {
            this.close();
            new QuizCreatorModal(this.app, this.plugin, this.folder).open();
        };
        
        // 모든 문제 로드
        const allQuestions = await this.plugin.loadAllQuestions();
        const folderQuestions = allQuestions.filter(q => (q.folder || '기본') === this.folder);
        
        if (folderQuestions.length === 0) {
            contentEl.createEl('p', { text: '문제가 없습니다. 새 문제를 만들어보세요!' });
        } else {
            const stats = contentEl.createDiv('quiz-list-stats');
            stats.createEl('p', { text: `총 ${folderQuestions.length}개 문제` });
            
            const filterDiv = contentEl.createDiv('quiz-list-filter');
            filterDiv.createEl('label', { text: '난이도 필터:' });
            const filterSelect = filterDiv.createEl('select');
            filterSelect.createEl('option', { text: '전체', value: 'all' });
            ['A+', 'A', 'A-', 'B', 'B-', 'C', 'D', 'E', 'F'].forEach(level => {
                filterSelect.createEl('option', { text: level, value: level });
            });
            
            const listContainer = contentEl.createDiv('quiz-list-container');
            
            const renderList = (filter = 'all') => {
                listContainer.empty();
                
                const filtered = filter === 'all' 
                    ? folderQuestions 
                    : folderQuestions.filter(q => q.difficulty === filter);
                
                if (filtered.length === 0) {
                    listContainer.createEl('p', { text: '해당하는 문제가 없습니다.' });
                    return;
                }
                
                const list = listContainer.createEl('ul', { cls: 'quiz-list' });
                filtered.forEach(question => {
                    const item = list.createEl('li', { cls: 'quiz-list-item' });
                    
                    const content = item.createDiv('quiz-item-content');
                    const title = question.hanzi || question.question || '제목 없음';
                    content.createEl('strong', { text: title });
                    
                    const meta = content.createDiv('quiz-item-meta');
                    meta.createEl('span', { text: `난이도: ${question.difficulty || 'C'}` });
                    meta.createEl('span', { text: `선택지: ${question.options?.length || 0}개` });
                    meta.createEl('span', { text: `정답률: ${question.correctCount || 0}/${(question.correctCount || 0) + (question.wrongCount || 0)}` });
                    if (question.bookmarked) {
                        meta.createEl('span', { text: '⭐ 북마크', cls: 'bookmark-badge' });
                    }
                    
                    const actions = item.createDiv('quiz-item-actions');
                    actions.style.cssText = 'display: flex; gap: 6px; flex-wrap: wrap;';
                    
                    const editBtn = actions.createEl('button', { text: '✏️ 수정', cls: 'quiz-item-btn' });
                    editBtn.style.cssText = 'padding: 6px 12px; font-size: 13px; min-height: 40px;';
                    editBtn.onclick = () => {
                        this.close();
                        new QuizCreatorModal(this.app, this.plugin, this.folder, question).open();
                    };
                    
                    const mdBtn = actions.createEl('button', { text: '📝 MD', cls: 'quiz-item-btn' });
                    mdBtn.style.cssText = 'padding: 6px 12px; font-size: 13px; min-height: 40px; background: var(--interactive-accent); color: var(--text-on-accent);';
                    mdBtn.onclick = async () => {
                        const file = this.app.vault.getAbstractFileByPath(question.filePath);
                        if (file) {
                            const leaf = this.app.workspace.getLeaf('tab');
                            await leaf.openFile(file);
                            this.close();
                        }
                    };
                    
                    const bookmarkBtn = actions.createEl('button', { 
                        text: question.bookmarked ? '⭐ 해제' : '⭐ 추가', 
                        cls: 'quiz-item-btn' 
                    });
                    bookmarkBtn.style.cssText = 'padding: 6px 12px; font-size: 13px; min-height: 40px;';
                    bookmarkBtn.onclick = async () => {
                        await this.plugin.toggleBookmark(question);
                        this.onOpen(); // 새로고침
                    };
                    
                    const deleteBtn = actions.createEl('button', { text: '🗑️ 삭제', cls: 'quiz-item-btn mod-warning' });
                    deleteBtn.style.cssText = 'padding: 6px 12px; font-size: 13px; min-height: 40px;';
                    deleteBtn.onclick = async () => {
                        if (confirm('이 문제를 삭제하시겠습니까?')) {
                            const file = this.app.vault.getAbstractFileByPath(question.filePath);
                            if (file) {
                                await this.app.vault.delete(file);
                                new Notice('✅ 문제가 삭제되었습니다');
                                this.onOpen(); // 새로고침
                            }
                        }
                    };
                });
            };
            
            filterSelect.onchange = () => renderList(filterSelect.value);
            renderList();
        }
        
        const closeBtn = contentEl.createEl('button', { text: '닫기', cls: 'mod-cta' });
        closeBtn.onclick = () => this.close();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

class FolderQuizModal extends Modal {
    constructor(app, plugin, folder) {
        super(app);
        this.plugin = plugin;
        this.folder = folder;
        this.folderName = folder;  // folderName 추가
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('folder-quiz-modal');
        contentEl.style.cssText = 'padding: 0;';
        
        // 헤더
        const header = contentEl.createDiv({ cls: 'quiz-modal-header' });
        header.style.cssText = `
            background: var(--interactive-accent);
            color: var(--text-on-accent);
            padding: 20px;
            border-radius: 8px 8px 0 0;
            margin: -20px -20px 20px -20px;
        `;
        
        header.createEl('h2', { text: `🎯 ${this.folder}` }).style.cssText = 'margin: 0; font-size: 24px;';
        header.createEl('p', { text: '퀴즈 설정을 선택하고 시작하세요' }).style.cssText = 'margin: 8px 0 0 0; opacity: 0.9; font-size: 14px;';
        
        // 본문 컨테이너
        const body = contentEl.createDiv({ cls: 'quiz-modal-body' });
        body.style.cssText = 'padding: 0 20px 20px 20px;';
        
        // 문제 로드
        const allQuestions = await this.plugin.loadAllQuestions();
        const folderQuestions = allQuestions.filter(q => (q.folder || '기본') === this.folder);
        
        if (folderQuestions.length === 0) {
            const emptyState = body.createDiv({ cls: 'empty-state' });
            emptyState.style.cssText = 'text-align: center; padding: 40px 20px;';
            
            emptyState.createEl('div', { text: '📭' }).style.cssText = 'font-size: 48px; margin-bottom: 16px;';
            emptyState.createEl('h3', { text: '문제가 없습니다' }).style.cssText = 'margin: 0 0 8px 0; color: var(--text-muted);';
            emptyState.createEl('p', { text: '먼저 문제를 만들어주세요.' }).style.cssText = 'margin: 0 0 20px 0; color: var(--text-muted);';
            
            const btnGroup = emptyState.createDiv();
            btnGroup.style.cssText = 'display: flex; gap: 8px; justify-content: center;';
            
            const createBtn = btnGroup.createEl('button', { text: '문제 만들기', cls: 'mod-cta' });
            createBtn.onclick = () => {
                this.close();
                new QuizCreatorModal(this.app, this.plugin, this.folder).open();
            };
            
            const closeBtn = btnGroup.createEl('button', { text: '닫기' });
            closeBtn.onclick = () => this.close();
            return;
        }
        
        // 통계 카드
        const stats = body.createDiv('quiz-settings-stats');
        stats.style.cssText = `
            background: var(--background-secondary);
            padding: 16px;
            border-radius: 8px;
            margin-bottom: 20px;
            display: flex;
            justify-content: space-around;
            text-align: center;
        `;
        
        const statItem = (label, value, icon) => {
            const item = stats.createDiv();
            item.style.cssText = 'flex: 1;';
            item.createEl('div', { text: icon }).style.cssText = 'font-size: 24px; margin-bottom: 4px;';
            item.createEl('div', { text: value }).style.cssText = 'font-size: 20px; font-weight: 600; margin-bottom: 2px;';
            item.createEl('div', { text: label }).style.cssText = 'font-size: 12px; color: var(--text-muted);';
        };
        
        statItem('전체 문제', `${folderQuestions.length}`, '📚');
        statItem('오답 문제', `${folderQuestions.filter(q => q.wrongCount > 0).length}`, '❌');
        statItem('북마크', `${folderQuestions.filter(q => q.bookmarked).length}`, '⭐');
        
        const form = body.createDiv('quiz-settings-form');
        form.style.cssText = 'display: grid; gap: 16px;';
        
        // 난이도 필터
        const difficultyGroup = form.createDiv('form-group');
        difficultyGroup.style.cssText = 'display: grid; gap: 8px;';
        difficultyGroup.createEl('label', { text: '📊 난이도 선택' }).style.cssText = 'font-weight: 600;';
        const difficultySelect = difficultyGroup.createEl('select');
        difficultySelect.style.cssText = 'padding: 8px; border-radius: 6px; border: 1px solid var(--background-modifier-border);';
        
        // 전체 옵션
        const allOption = difficultySelect.createEl('option', { text: `전체 (${folderQuestions.length}개)`, value: 'all' });
        allOption.selected = true;
        
        // 실제 사용 중인 난이도만 표시
        const difficulties = ['쉬움', '보통', '어려움', '매우 어려움'];
        difficulties.forEach(level => {
            const count = folderQuestions.filter(q => (q.difficulty || '보통') === level).length;
            if (count > 0) {
                difficultySelect.createEl('option', { 
                    text: `${level} (${count}개)`, 
                    value: level 
                });
            }
        });
        
        // 문제 수
        const countGroup = form.createDiv('form-group');
        countGroup.style.cssText = 'display: grid; gap: 8px;';
        countGroup.createEl('label', { text: '🔢 문제 수' }).style.cssText = 'font-weight: 600;';
        const defaultCount = Math.min(this.plugin.settings.defaultQuizCount || 10, folderQuestions.length);
        const countInput = countGroup.createEl('input', { 
            type: 'number', 
            value: defaultCount.toString(),
            attr: { min: '1', max: folderQuestions.length.toString() }
        });
        countInput.style.cssText = 'padding: 8px; border-radius: 6px; border: 1px solid var(--background-modifier-border);';
        
        // 타이머 설정 카드
        const timerCard = form.createDiv();
        timerCard.style.cssText = `
            background: var(--background-secondary);
            padding: 16px;
            border-radius: 8px;
            display: grid;
            gap: 12px;
        `;
        
        const timerHeader = timerCard.createDiv();
        timerHeader.style.cssText = 'display: flex; align-items: center; gap: 8px;';
        const timerCheckbox = timerHeader.createEl('input', { type: 'checkbox' });
        timerCheckbox.checked = this.plugin.settings.defaultTimerEnabled !== false;
        timerHeader.createEl('label', { text: '⏱️ 타이머 사용' }).style.cssText = 'font-weight: 600; cursor: pointer;';
        timerHeader.querySelector('label').onclick = () => {
            timerCheckbox.checked = !timerCheckbox.checked;
            timerCheckbox.onchange();
        };
        
        const timerTimeGroup = timerCard.createDiv();
        timerTimeGroup.style.cssText = 'display: grid; gap: 8px;';
        timerTimeGroup.createEl('label', { text: '문제당 시간 (초)' }).style.cssText = 'font-size: 14px; color: var(--text-muted);';
        const timerInput = timerTimeGroup.createEl('input', { 
            type: 'number', 
            value: String(this.plugin.settings.defaultTimerPerQuestion || 30),
            attr: { min: '5', max: '300' }
        });
        timerInput.style.cssText = 'padding: 8px; border-radius: 6px; border: 1px solid var(--background-modifier-border);';
        timerInput.disabled = !timerCheckbox.checked;
        
        timerCheckbox.onchange = () => {
            timerInput.disabled = !timerCheckbox.checked;
            timerTimeGroup.style.opacity = timerCheckbox.checked ? '1' : '0.5';
        };
        timerTimeGroup.style.opacity = timerCheckbox.checked ? '1' : '0.5';
        
        // 섞기 옵션 카드
        const shuffleCard = form.createDiv();
        shuffleCard.style.cssText = `
            background: var(--background-secondary);
            padding: 16px;
            border-radius: 8px;
            display: grid;
            gap: 12px;
        `;
        
        shuffleCard.createEl('div', { text: '🔀 섞기 옵션' }).style.cssText = 'font-weight: 600;';
        
        const shuffleGroup = shuffleCard.createDiv();
        shuffleGroup.style.cssText = 'display: flex; align-items: center; gap: 8px;';
        const shuffleQuestionsCheckbox = shuffleGroup.createEl('input', { type: 'checkbox' });
        shuffleQuestionsCheckbox.checked = this.plugin.settings.defaultShuffleQuestions !== false;
        const shuffleQLabel = shuffleGroup.createEl('label', { text: '문제 순서 섞기' });
        shuffleQLabel.style.cssText = 'cursor: pointer;';
        shuffleQLabel.onclick = () => {
            shuffleQuestionsCheckbox.checked = !shuffleQuestionsCheckbox.checked;
        };
        
        const shuffleOptionsGroup = shuffleCard.createDiv();
        shuffleOptionsGroup.style.cssText = 'display: flex; align-items: center; gap: 8px;';
        const shuffleOptionsCheckbox = shuffleOptionsGroup.createEl('input', { type: 'checkbox' });
        shuffleOptionsCheckbox.checked = this.plugin.settings.defaultShuffleOptions !== false;
        const shuffleOLabel = shuffleOptionsGroup.createEl('label', { text: '선택지 순서 섞기' });
        shuffleOLabel.style.cssText = 'cursor: pointer;';
        shuffleOLabel.onclick = () => {
            shuffleOptionsCheckbox.checked = !shuffleOptionsCheckbox.checked;
        };
        
        // 필터 옵션 카드
        const filterCard = form.createDiv();
        filterCard.style.cssText = `
            background: var(--background-secondary);
            padding: 16px;
            border-radius: 8px;
            display: grid;
            gap: 12px;
        `;
        
        filterCard.createEl('div', { text: '🔍 필터 옵션' }).style.cssText = 'font-weight: 600;';
        
        const wrongOnlyGroup = filterCard.createDiv();
        wrongOnlyGroup.style.cssText = 'display: flex; align-items: center; gap: 8px;';
        const wrongOnlyCheckbox = wrongOnlyGroup.createEl('input', { type: 'checkbox' });
        const wrongLabel = wrongOnlyGroup.createEl('label', { text: '오답 문제만 풀기' });
        wrongLabel.style.cssText = 'cursor: pointer;';
        wrongLabel.onclick = () => {
            wrongOnlyCheckbox.checked = !wrongOnlyCheckbox.checked;
            wrongOnlyCheckbox.onchange();
        };
        
        const bookmarkOnlyGroup = filterCard.createDiv();
        bookmarkOnlyGroup.style.cssText = 'display: flex; align-items: center; gap: 8px;';
        const bookmarkOnlyCheckbox = bookmarkOnlyGroup.createEl('input', { type: 'checkbox' });
        bookmarkOnlyCheckbox.checked = false;
        const bookmarkCount = folderQuestions.filter(q => q.bookmarked).length;
        const bookmarkLabel = bookmarkOnlyGroup.createEl('label', { text: `⭐ 북마크 문제만 풀기 (${bookmarkCount}개)` });
        bookmarkLabel.style.cssText = 'cursor: pointer;';
        bookmarkLabel.onclick = () => {
            bookmarkOnlyCheckbox.checked = !bookmarkOnlyCheckbox.checked;
            bookmarkOnlyCheckbox.onchange();
        };
        
        // 사용 가능한 문제 수 표시
        const availableInfo = body.createDiv();
        availableInfo.style.cssText = `
            padding: 12px;
            background: var(--background-primary-alt);
            border-radius: 8px;
            text-align: center;
            font-weight: 600;
            margin-top: 16px;
        `;
        
        const updateAvailableCount = () => {
            let filteredQuestions = [...folderQuestions];
            
            // 오답 필터
            if (wrongOnlyCheckbox.checked) {
                filteredQuestions = filteredQuestions.filter(q => q.wrongCount > 0);
            }
            
            // 북마크 필터
            if (bookmarkOnlyCheckbox.checked) {
                filteredQuestions = filteredQuestions.filter(q => q.bookmarked);
            }
            
            // 난이도 필터
            if (difficultySelect.value !== 'all') {
                filteredQuestions = filteredQuestions.filter(q => (q.difficulty || '보통') === difficultySelect.value);
            }
            
            const available = filteredQuestions.length;
            countInput.max = available.toString();
            countInput.value = Math.min(parseInt(countInput.value), available).toString();
            availableInfo.textContent = `✅ 사용 가능한 문제: ${available}개`;
        };
        
        updateAvailableCount();
        
        wrongOnlyCheckbox.onchange = updateAvailableCount;
        bookmarkOnlyCheckbox.onchange = updateAvailableCount;
        difficultySelect.onchange = updateAvailableCount;
        
        // 버튼
        const btnGroup = body.createDiv('form-buttons');
        btnGroup.style.cssText = 'display: flex; gap: 8px; margin-top: 20px;';
        
        const startBtn = btnGroup.createEl('button', { text: '🚀 퀴즈 시작', cls: 'mod-cta' });
        startBtn.style.cssText = 'flex: 1; padding: 12px; font-size: 16px; font-weight: 600;';
        startBtn.onclick = () => {
            const difficulty = difficultySelect.value;
            const count = parseInt(countInput.value);
            const wrongOnly = wrongOnlyCheckbox.checked;
            
            let selectedQuestions = [...folderQuestions];
            
            // 오답만 필터링
            if (wrongOnly) {
                selectedQuestions = selectedQuestions.filter(q => q.wrongCount > 0);
            }
            
            // 북마크만 필터링
            if (bookmarkOnlyCheckbox.checked) {
                selectedQuestions = selectedQuestions.filter(q => q.bookmarked);
            }
            
            // 난이도 필터링
            if (difficulty !== 'all') {
                selectedQuestions = selectedQuestions.filter(q => (q.difficulty || '보통') === difficulty);
            }
            
            if (selectedQuestions.length === 0) {
                new Notice('❌ 선택한 조건에 맞는 문제가 없습니다');
                return;
            }
            
            // 문제 수만큼 랜덤 선택
            if (selectedQuestions.length > count) {
                selectedQuestions = selectedQuestions.sort(() => Math.random() - 0.5).slice(0, count);
            }
            
            const quizOptions = {
                enableTimer: timerCheckbox.checked,
                timerPerQuestion: parseInt(timerInput.value),
                shuffleQuestions: shuffleQuestionsCheckbox.checked,
                shuffleOptions: shuffleOptionsCheckbox.checked
            };
            
            // 설정 저장 (다음에 사용하기 위해)
            this.plugin.settings.defaultQuizCount = count;
            this.plugin.settings.defaultTimerEnabled = timerCheckbox.checked;
            this.plugin.settings.defaultTimerPerQuestion = parseInt(timerInput.value);
            this.plugin.settings.defaultShuffleQuestions = shuffleQuestionsCheckbox.checked;
            this.plugin.settings.defaultShuffleOptions = shuffleOptionsCheckbox.checked;
            this.plugin.saveSettings(true);
            
            this.close();
            new QuizModal(this.app, this.plugin, this.folderName, selectedQuestions, quizOptions).open();
        };
        
        const cancelBtn = btnGroup.createEl('button', { text: '취소' });
        cancelBtn.style.cssText = 'padding: 12px 24px;';
        cancelBtn.onclick = () => this.close();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
