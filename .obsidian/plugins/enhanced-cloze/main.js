// =====================================================
// Enhanced Cloze Plugin - 완전 통합 버전
// 타이머 & 대시보드 기능 포함
// Part 1: 설정, 임포트, 기본 구조
// =====================================================

const { Plugin, PluginSettingTab, Setting, MarkdownView, Notice, Modal, Menu, ItemView, TFolder, MarkdownRenderer, Component, TFile } = require('obsidian');
const { EditorView, Decoration, ViewPlugin, WidgetType } = require('@codemirror/view');
const { syntaxTree } = require('@codemirror/language');

// =====================================================
// 기본 설정
// =====================================================
const DEFAULT_SETTINGS = {
    // 기존 설정
    scrollToClozeOnToggle: true,
    animateScroll: true,
    showHintsForPseudoClozes: true,
    underlineRevealedPseudoClozes: false,
    underlineRevealedGenuineClozes: true,
    revealPseudoClozesByDefault: false,
    swapLeftAndRightBorderActions: false,
    currentCardNumber: 1,
    clozeFolder: 'Cloze Cards',
    dashboardFileName: 'Cloze Dashboard.md',
    cardNumbersByFolder: {},
    
    // 폴더 관리 (새로 추가)
    clozeFolders: ['기본', '중급', '고급'],  // 하위 폴더 목록
    
    // 타이머 설정 (새로 추가)
    enableTimer: true,
    defaultTimerDuration: 30,
    timerWarningThreshold: 5,
    enableVibration: true,
    timerPosition: 'top', // 'top', 'bottom', 'floating'
    autoStartTimer: true,
    timerDurationsByFolder: {}, // 폴더별 타이머 시간 설정
    enableAutoRevealOnTimeout: true, // 타이머 종료 시 자동으로 빈칸 공개
    
    // 자동 뒤집기 설정 (새로 추가)
    enableAutoReveal: false,
    autoRevealDelay: 3, // 초 단위
    
    // 학습 기록 설정 (새로 추가)
    studySessions: [],
    totalStudyTime: 0,
    enableStudyTracking: true,
    
    // 폴더별 통계 (quiz-sp2 스타일)
    stats: {
        totalAttempts: 0,
        totalCorrect: 0,
        totalTime: 0,
        lastStudyDate: null,
        studyHistory: [],  // { date, folder, fileName, cardNumber, duration, completed, action }
        folderStats: {},  // { folderName: { attempts, correct, time, fileStats: {} } }
        fileStats: {}  // { filePath: { attempts, correct, time, lastStudy } }
    },
    
    // 대시보드 설정 (새로 추가)
    showTimerInDashboard: true,
    dashboardAutoRefresh: true,
    dashboardMemo: '', // 대시보드 메모
    
    // 북마크 설정 (새로 추가)
    bookmarks: [],  // [{ filePath, cardNumber, timestamp, note }]
    bookmarkFolder: '📌 북마크',
    
    // 테스트 관리 설정 (routine-planner 스타일)
    testManagementEnabled: true,
    testFolder: 'Tests',
    testFolderStructure: 'monthly', // 'monthly', 'weekly', 'daily'
    autoCreateTestFolder: true,
    syncTestsWithFiles: true,
    testTemplates: [
        { id: '1', name: '일일 복습 10개', type: 'daily', quizCount: 10, folders: [] },
        { id: '2', name: '일일 복습 20개', type: 'daily', quizCount: 20, folders: [] },
        { id: '3', name: '주간 전체 복습', type: 'weekly', quizCount: 50, folders: [] },
        { id: '4', name: '월간 총정리', type: 'monthly', quizCount: 100, folders: [] }
    ],
    testTypes: ['일별', '주간', '월간', '특별'],
    weekStart: 0,  // 0 = 일요일, 1 = 월요일
    testThemeColor: '#10b981',
    
    // 체크리스트 및 메모 데이터 (날짜별)
    dailyChecklists: {}, // { 'YYYY-MM-DD': { items: [{text, completed}], notes: ['note1', 'note2'] } }
    weeklyChecklists: {}, // { 'YYYY-Www': { items: [], notes: [] } }
    monthlyChecklists: {}, // { 'YYYY-MM': { items: [], notes: [] } }
    
    // 체크리스트 템플릿 저장
    checklistTemplates: [] // [{ name: '템플릿1', items: ['항목1', '항목2'] }]
};

// =====================================================
// 대시보드 뷰 타입
// =====================================================
const DASHBOARD_VIEW_TYPE = 'cloze-dashboard-view';

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
                new Notice(`✅ ${clozes.length}개의 빈칸이 자동으로 공개되었습니다`);
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
        return '📊 Cloze Dashboard';
    }
    
    // 날짜 포맷 함수
    formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    
    // 주차 포맷 함수
    formatWeek(date) {
        const year = date.getFullYear();
        const week = this.getWeekNumber(date);
        return `${year}-W${String(week).padStart(2, '0')}`;
    }
    
    // 주차 계산 함수
    getWeekNumber(date) {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    }
    
    // 월 포맷 함수
    formatMonth(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        return `${year}-${month}`;
    }

    getIcon() {
        return 'layout-dashboard';
    }

    async onOpen() {
        const container = this.containerEl.children[1];
        container.empty();
        container.addClass('cloze-dashboard-container');

        // 모바일 환경이면 버튼 높이만큼 더 크게 paddingBottom 적용(버튼 높이 38~56px + 여유)
        const paddingValue = window.innerWidth <= 768 ? '160px' : '100px';
        container.style.position = 'relative';
        container.style.paddingBottom = paddingValue;
        
        await this.renderDashboard(container);
    }

    async renderDashboard(container) {
        // 헤더
        const header = container.createDiv({ cls: 'cloze-dashboard-header' });
        header.createEl('h2', { text: '📊 Enhanced Cloze Dashboard' });
        
        // 탭 네비게이션
        const tabNav = header.createDiv({ cls: 'cloze-tab-nav' });
        
        const clozeTab = tabNav.createEl('button', { 
            text: '📝 빈칸 학습',
            cls: 'cloze-tab-btn' 
        });
        clozeTab.style.cssText = 'background: linear-gradient(135deg, var(--interactive-accent) 0%, var(--interactive-accent-hover) 100%); color: white; border: none; padding: 10px 18px; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);';
        if (this.currentTab === 'cloze') {
            clozeTab.addClass('active');
            clozeTab.style.cssText += 'transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);';
        }
        clozeTab.addEventListener('mouseenter', () => {
            if (this.currentTab !== 'cloze') clozeTab.style.transform = 'translateY(-2px)';
        });
        clozeTab.addEventListener('mouseleave', () => {
            if (this.currentTab !== 'cloze') clozeTab.style.transform = 'translateY(0)';
        });
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
            text: '📅 일별 테스트',
            cls: 'cloze-tab-btn' 
        });
        dailyTab.style.cssText = 'background: linear-gradient(135deg, #f59e0b 0%, #f97316 100%); color: white; border: none; padding: 10px 18px; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);';
        if (this.currentTab === 'test-daily') {
            dailyTab.addClass('active');
            dailyTab.style.cssText += 'transform: translateY(-2px); box-shadow: 0 4px 12px rgba(245, 158, 11, 0.4);';
        }
        dailyTab.addEventListener('mouseenter', () => {
            if (this.currentTab !== 'test-daily') dailyTab.style.transform = 'translateY(-2px)';
        });
        dailyTab.addEventListener('mouseleave', () => {
            if (this.currentTab !== 'test-daily') dailyTab.style.transform = 'translateY(0)';
        });
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
        weeklyTab.style.cssText = 'background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; border: none; padding: 10px 18px; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);';
        if (this.currentTab === 'test-weekly') {
            weeklyTab.addClass('active');
            weeklyTab.style.cssText += 'transform: translateY(-2px); box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);';
        }
        weeklyTab.addEventListener('mouseenter', () => {
            if (this.currentTab !== 'test-weekly') weeklyTab.style.transform = 'translateY(-2px)';
        });
        weeklyTab.addEventListener('mouseleave', () => {
            if (this.currentTab !== 'test-weekly') weeklyTab.style.transform = 'translateY(0)';
        });
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
        monthlyTab.style.cssText = 'background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; border: none; padding: 10px 18px; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);';
        if (this.currentTab === 'test-monthly') {
            monthlyTab.addClass('active');
            monthlyTab.style.cssText += 'transform: translateY(-2px); box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);';
        }
        monthlyTab.addEventListener('mouseenter', () => {
            if (this.currentTab !== 'test-monthly') monthlyTab.style.transform = 'translateY(-2px)';
        });
        monthlyTab.addEventListener('mouseleave', () => {
            if (this.currentTab !== 'test-monthly') monthlyTab.style.transform = 'translateY(0)';
        });
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
        weeklyBox.style.cssText = 'background: linear-gradient(135deg, var(--background-secondary) 0%, var(--background-primary) 100%); padding: 16px; border-radius: 12px; border: 2px solid #3b82f6; cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);';
        weeklyBox.addEventListener('mouseenter', () => {
            weeklyBox.style.transform = 'translateY(-4px)';
            weeklyBox.style.boxShadow = '0 8px 20px rgba(59, 130, 246, 0.4)';
            weeklyBox.style.borderColor = '#60a5fa';
        });
        weeklyBox.addEventListener('mouseleave', () => {
            weeklyBox.style.transform = 'translateY(0)';
            weeklyBox.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
            weeklyBox.style.borderColor = '#3b82f6';
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
        weeklyTitle.style.cssText = 'font-weight: 700; margin-bottom: 12px; color: #3b82f6; font-size: 1.15em; text-shadow: 0 1px 2px rgba(0,0,0,0.1);';
        
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
        weeklyQuizBtn.style.cssText = 'position: fixed; left: 50%; transform: translateX(-50%); bottom: calc(env(safe-area-inset-bottom, 0px) + 80px); width: 90vw; max-width: 400px; z-index: 9999; box-shadow: 0 2px 12px rgba(0,0,0,0.08); border-radius: 16px; padding: 16px 0; background: var(--interactive-accent); color: var(--text-on-accent); font-size: 1.2em; font-weight: bold; border: none;';
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
        monthlyBox.style.cssText = 'background: linear-gradient(135deg, var(--background-secondary) 0%, var(--background-primary) 100%); padding: 16px; border-radius: 12px; border: 2px solid #10b981; cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);';
        monthlyBox.addEventListener('mouseenter', () => {
            monthlyBox.style.transform = 'translateY(-4px)';
            monthlyBox.style.boxShadow = '0 8px 20px rgba(16, 185, 129, 0.4)';
            monthlyBox.style.borderColor = '#34d399';
        });
        monthlyBox.addEventListener('mouseleave', () => {
            monthlyBox.style.transform = 'translateY(0)';
            monthlyBox.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
            monthlyBox.style.borderColor = '#10b981';
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
        monthlyTitle.style.cssText = 'font-weight: 700; margin-bottom: 12px; color: #10b981; font-size: 1.15em; text-shadow: 0 1px 2px rgba(0,0,0,0.1);';
        
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
        monthlyQuizBtn.style.cssText = 'position: fixed; left: 50%; transform: translateX(-50%); bottom: calc(env(safe-area-inset-bottom, 0px) + 80px); width: 90vw; max-width: 400px; z-index: 9999; box-shadow: 0 2px 12px rgba(0,0,0,0.08); border-radius: 16px; padding: 16px 0; background: var(--interactive-accent); color: var(--text-on-accent); font-size: 1.2em; font-weight: bold; border: none;';
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
        // 폴더별 학습 기록
        await this.renderFolderLearningRecords(container);

        // 빠른 작업
        this.renderQuickActions(container);
        
        // 메모 섹션
        this.renderMemoSection(container);
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
                text: '테스트 관리가 비활성화되어 있습니다. 설정에서 활성화하세요.'
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
        
        // 파일 열기 버튼
        const openFileBtn = dateNav.createEl('button', { text: '📄 파일' });
        openFileBtn.style.cssText = 'padding: 8px 16px; background: var(--interactive-accent); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;';
        openFileBtn.onclick = async () => {
            await this.openOrCreateDailyFile(this.currentDate);
        };
        
        // 파일 동기화 버튼
        const syncFileBtn = dateNav.createEl('button', { text: '🔄 동기화' });
        syncFileBtn.style.cssText = 'padding: 8px 16px; background: var(--background-secondary); border: 1px solid var(--background-modifier-border); border-radius: 6px; cursor: pointer; font-weight: 600;';
        syncFileBtn.title = '파일에서 불러오기';
        syncFileBtn.onclick = async () => {
            await this.onOpen();
            new Notice('✅ 파일에서 데이터를 불러왔습니다');
        };
        
        // 파일에서 데이터 읽기
        const dayData = await this.plugin.readDailyFile(this.currentDate);
        
        // 스크롤 컨테이너
        const scrollContainer = section.createDiv();
        scrollContainer.style.cssText = 'overflow-y: auto; max-height: calc(100vh - 300px);';
        
        // 체크리스트 섹션
        const routineSection = scrollContainer.createDiv({ cls: 'cloze-test-section' });
        routineSection.style.cssText = 'background: var(--background-secondary); padding: 16px; border-radius: 8px; margin-bottom: 16px;';
        
        const routineHeader = routineSection.createDiv();
        routineHeader.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;';
        routineHeader.createEl('h4', { text: '✅ 학습 체크리스트' });
        
        const buttonGroup = routineHeader.createDiv();
        buttonGroup.style.cssText = 'display: flex; gap: 8px;';
        
        const templateBtn = buttonGroup.createEl('button', { text: '📋 템플릿' });
        templateBtn.style.cssText = 'padding: 4px 12px; background: var(--background-modifier-border); border: none; border-radius: 4px; cursor: pointer;';
        templateBtn.onclick = () => {
            new ChecklistTemplateModal(this.app, this.plugin, async (templateItems) => {
                dayData.routines = [...dayData.routines, ...templateItems.map(text => ({ text, checked: false }))];
                await this.plugin.writeDailyFile(this.currentDate, dayData);
                this.onOpen();
            }, dayData.routines).open();
        };
        
        const addRoutineBtn = buttonGroup.createEl('button', { text: '+ 추가' });
        addRoutineBtn.style.cssText = 'padding: 4px 12px; background: var(--interactive-accent); color: white; border: none; border-radius: 4px; cursor: pointer;';
        addRoutineBtn.onclick = () => {
            new DailyRoutineAddModal(this.app, this.plugin, async (text) => {
                dayData.routines.push({ text: text, checked: false });
                await this.plugin.writeDailyFile(this.currentDate, dayData);
                this.onOpen();
            }).open();
        };
        
        const routineList = routineSection.createDiv();
        routineList.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';
        
        if (dayData.routines && dayData.routines.length > 0) {
            dayData.routines.forEach((routine, index) => {
                const routineItem = routineList.createDiv();
                routineItem.style.cssText = 'display: flex; align-items: center; gap: 10px; padding: 8px; background: var(--background-primary); border-radius: 6px; cursor: pointer; transition: all 0.2s;';
                
                const checkbox = routineItem.createEl('input', { type: 'checkbox' });
                checkbox.checked = routine.checked;
                checkbox.style.cssText = 'cursor: pointer;';
                checkbox.addEventListener('change', async (e) => {
                    e.stopPropagation();
                    routine.checked = checkbox.checked;
                    await this.plugin.writeDailyFile(this.currentDate, dayData);
                    this.onOpen();
                });
                
                const text = routineItem.createEl('span', { text: routine.text });
                text.style.cssText = routine.checked ? 'text-decoration: line-through; opacity: 0.6; flex: 1;' : 'flex: 1;';
                text.onclick = () => {
                    new TestNoteEditModal(this.app, routine.text, async (newText) => {
                        routine.text = newText;
                        await this.plugin.writeDailyFile(this.currentDate, dayData);
                        this.onOpen();
                    }, async () => {
                        dayData.routines.splice(index, 1);
                        await this.plugin.writeDailyFile(this.currentDate, dayData);
                        this.onOpen();
                    }).open();
                };
                
                const deleteBtn = routineItem.createEl('button', { text: '×' });
                deleteBtn.style.cssText = 'background: #ef4444; color: white; border: none; padding: 2px 8px; border-radius: 4px; cursor: pointer;';
                deleteBtn.onclick = async (e) => {
                    e.stopPropagation();
                    if (confirm('이 항목을 삭제하시겠습니까?')) {
                        dayData.routines.splice(index, 1);
                        await this.plugin.writeDailyFile(this.currentDate, dayData);
                        this.onOpen();
                    }
                };
                
                routineItem.addEventListener('mouseenter', () => {
                    routineItem.style.background = 'var(--background-secondary)';
                    routineItem.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                });
                routineItem.addEventListener('mouseleave', () => {
                    routineItem.style.background = 'var(--background-primary)';
                    routineItem.style.boxShadow = 'none';
                });
            });
        } else {
            routineList.createDiv({ text: '체크리스트가 비어있습니다. 항목을 추가해보세요!', cls: 'cloze-empty-message' });
        }
        
        // 타임라인 섹션
        const taskSection = scrollContainer.createDiv({ cls: 'cloze-test-section' });
        taskSection.style.cssText = 'background: var(--background-secondary); padding: 16px; border-radius: 8px; margin-bottom: 16px;';
        
        const taskHeader = taskSection.createDiv();
        taskHeader.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;';
        taskHeader.createEl('h4', { text: '📋 시간별 일정' });
        
        const addTaskBtn = taskHeader.createEl('button', { text: '+ 추가' });
        addTaskBtn.style.cssText = 'padding: 4px 12px; background: var(--interactive-accent); color: white; border: none; border-radius: 4px; cursor: pointer;';
        addTaskBtn.onclick = () => {
            new DailyTaskAddModal(this.app, this.plugin, async (hour, text) => {
                dayData.tasks.push({ hour: hour, text: text });
                await this.plugin.writeDailyFile(this.currentDate, dayData);
                this.onOpen();
            }).open();
        };
        
        const timeline = taskSection.createDiv();
        timeline.style.cssText = 'max-height: 300px; overflow-y: auto;';
        
        for (let i = 0; i < 24; i++) {
            const hourDiv = timeline.createDiv();
            hourDiv.style.cssText = 'display: flex; align-items: flex-start; min-height: 40px; border-bottom: 1px solid var(--background-modifier-border); padding: 5px 0;';
            
            const ampm = i < 12 ? 'AM' : 'PM';
            const displayHour = i === 0 ? 12 : (i > 12 ? i - 12 : i);
            
            const hourLabel = hourDiv.createDiv({ text: `${displayHour} ${ampm}` });
            hourLabel.style.cssText = 'min-width: 70px; cursor: pointer; padding: 5px 8px; border-radius: 4px;';
            hourLabel.onclick = () => {
                new DailyTaskAddModal(this.app, this.plugin, async (hour, text) => {
                    dayData.tasks.push({ hour: hour, text: text });
                    await this.plugin.writeDailyFile(this.currentDate, dayData);
                    this.onOpen();
                }, i).open();
            };
            
            const tasksContainer = hourDiv.createDiv();
            tasksContainer.style.cssText = 'flex: 1;';
            
            if (dayData.tasks) {
                const tasksAtHour = dayData.tasks.filter(t => t.hour === i);
                tasksAtHour.forEach((task) => {
                    const taskDiv = tasksContainer.createDiv();
                    taskDiv.style.cssText = 'background: var(--background-primary); padding: 4px 8px; border-radius: 4px; margin-bottom: 4px; display: flex; justify-content: space-between; align-items: center;';
                    
                    const taskText = taskDiv.createEl('span', { text: task.text });
                    taskText.style.cssText = 'flex: 1;';
                    
                    const deleteBtn = taskDiv.createEl('span', { text: ' ×' });
                    deleteBtn.style.cssText = 'cursor: pointer; color: #ef4444; font-weight: bold;';
                    deleteBtn.onclick = async (e) => {
                        e.stopPropagation();
                        const taskIndex = dayData.tasks.indexOf(task);
                        dayData.tasks.splice(taskIndex, 1);
                        await this.plugin.writeDailyFile(this.currentDate, dayData);
                        this.onOpen();
                    };
                });
            }
        }
        
        // 메모 섹션
        const noteSection = scrollContainer.createDiv({ cls: 'cloze-test-section' });
        noteSection.style.cssText = 'background: var(--background-secondary); padding: 16px; border-radius: 8px;';
        
        const noteHeader = noteSection.createDiv();
        noteHeader.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;';
        noteHeader.createEl('h4', { text: '💬 학습 메모' });
        
        const addNoteBtn = noteHeader.createEl('button', { text: '+ 추가' });
        addNoteBtn.style.cssText = 'padding: 4px 12px; background: var(--interactive-accent); color: white; border: none; border-radius: 4px; cursor: pointer;';
        addNoteBtn.onclick = () => {
            new DailyNoteAddModal(this.app, this.plugin, async (text) => {
                dayData.notes.push({ text: text });
                await this.plugin.writeDailyFile(this.currentDate, dayData);
                this.onOpen();
            }).open();
        };
        
        const noteList = noteSection.createDiv();
        noteList.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';
        
        if (dayData.notes && dayData.notes.length > 0) {
            dayData.notes.forEach((note, index) => {
                const noteItem = noteList.createDiv();
                noteItem.style.cssText = 'padding: 12px; background: var(--background-primary); border-radius: 6px; display: flex; justify-content: space-between; align-items: start; gap: 12px;';
                
                const noteContent = noteItem.createEl('div');
                noteContent.style.cssText = 'flex: 1; word-break: break-word;';
                
                const noteTextContent = note.text || note;
                const lines = noteTextContent.split('\n');
                
                lines.forEach(line => {
                    line = line.trim();
                    if (!line) return;
                    
                    // 이미지 링크 처리 ![[이미지.png]]
                    if (line.includes('![[') && line.includes(']]')) {
                        const imgMatch = line.match(/!\[\[(.+?)\]\]/g);
                        if (imgMatch) {
                            imgMatch.forEach(imgLink => {
                                const pathMatch = imgLink.match(/!\[\[(.+?)\]\]/);
                                if (pathMatch) {
                                    const imgPath = pathMatch[1];
                                    const img = noteContent.createEl('img');
                                    img.style.cssText = 'max-width: 100%; width: auto; height: auto; border-radius: 6px; margin: 4px 0; cursor: zoom-in; transition: transform 0.2s;';
                                    img.src = this.app.vault.adapter.getResourcePath(imgPath);
                                    img.onclick = () => {
                                        this.plugin.showImageZoom(img.src, '메모 이미지');
                                    };
                                    img.onmouseenter = () => {
                                        img.style.transform = 'scale(1.05)';
                                    };
                                    img.onmouseleave = () => {
                                        img.style.transform = 'scale(1)';
                                    };
                                    img.onerror = () => {
                                        img.style.display = 'none';
                                    };
                                }
                            });
                        }
                    } else {
                        // 일반 텍스트
                        const textLine = noteContent.createEl('div', { text: line });
                        textLine.style.cssText = 'margin: 2px 0;';
                    }
                });
                
                const deleteBtn = noteItem.createEl('button', { text: '×' });
                deleteBtn.style.cssText = 'background: #ef4444; color: white; border: none; padding: 4px 10px; border-radius: 4px; cursor: pointer; flex-shrink: 0;';
                deleteBtn.onclick = async () => {
                    dayData.notes.splice(index, 1);
                    await this.plugin.writeDailyFile(this.currentDate, dayData);
                    this.onOpen();
                };
            });
        } else {
            noteList.createDiv({ text: '메모가 비어있습니다.', cls: 'cloze-empty-message' });
        }
        
        // 오늘의 학습 기록 가져오기
        const todayStats = this.getTodayStats();
        
        // 학습 기록 표시 (폴더별로 최근 1개씩)
        const recordSection = scrollContainer.createDiv({ cls: 'cloze-test-items-section' });
        recordSection.style.cssText = 'margin-top: 16px;';
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
                const recordDiv = recordList.createDiv({ cls: 'cloze-test-item' });
                recordDiv.style.cursor = 'pointer';
                recordDiv.style.padding = '8px';
                recordDiv.style.borderRadius = '4px';
                recordDiv.style.transition = 'background 0.2s';
                
                const timeText = new Date(session.timestamp).toLocaleTimeString('ko-KR', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                });
                
                const text = recordDiv.createDiv({ 
                    cls: 'cloze-test-item-text',
                    text: `${timeText} - ${session.folderName} (${session.correct}/${session.total} 정답)`
                });
                
                if (session.accuracy >= 80) text.style.color = '#10b981';
                else if (session.accuracy >= 60) text.style.color = '#f59e0b';
                else text.style.color = '#ef4444';
                
                // 클릭 시 해당 파일 열기 (폴더 내 파일 목록 표시)
                const clickHandler = async () => {
                    console.log('📂 파일 열기 시도:', session);
                    console.log('📂 파일 경로:', session.folder);
                    
                    let filePath = session.folder;
                    
                    // folder가 없거나 파일을 못 찾으면 폴더 내 파일 목록 모달 표시
                    if (!filePath || filePath.includes('/') && !filePath.endsWith('.md')) {
                        // 폴더 경로인 경우 - 해당 폴더의 파일 목록 표시
                        const folderPath = session.folderName || filePath;
                        const files = this.app.vault.getMarkdownFiles().filter(f => 
                            (f.parent?.name === folderPath || f.path.includes(folderPath)) &&
                            !f.path.includes('첨부파일')
                        );
                        
                        if (files.length === 0) {
                            new Notice(`📂 ${folderPath} 폴더에 파일이 없습니다.`);
                            return;
                        }
                        
                        if (files.length === 1) {
                            // 파일이 1개면 바로 열기
                            await this.app.workspace.getLeaf().openFile(files[0]);
                            new Notice(`📂 ${files[0].basename} 파일 열기 완료`);
                            return;
                        }
                        
                        // 여러 파일이 있으면 선택 모달 표시
                        new RecentFilesModal(this.app, this.plugin, files, folderPath).open();
                        return;
                    }
                    
                    // fileName으로 검색 시도
                    if (!filePath && session.fileName) {
                        console.log('📂 folder 없음, fileName으로 검색:', session.fileName);
                        const files = this.app.vault.getMarkdownFiles();
                        const foundFile = files.find(f => f.basename === session.fileName);
                        if (foundFile) {
                            filePath = foundFile.path;
                            console.log('📂 파일 찾음:', filePath);
                        }
                    }
                    
                    if (filePath) {
                        const file = this.app.vault.getAbstractFileByPath(filePath);
                        console.log('📂 찾은 파일:', file);
                        
                        if (file && file instanceof TFile) {
                            console.log('📂 파일 열기:', file.path);
                            await this.app.workspace.getLeaf().openFile(file);
                            new Notice(`📂 ${session.folderName} 파일 열기 완료`);
                        } else {
                            console.error('❌ 파일을 찾을 수 없음:', filePath);
                            new Notice(`파일을 찾을 수 없습니다: ${filePath}`);
                        }
                    } else {
                        console.error('❌ 파일 경로 없음');
                        new Notice('파일 경로 정보가 없습니다.');
                    }
                };
                
                let touchStartTime = 0;
                recordDiv.addEventListener('touchstart', () => {
                    touchStartTime = Date.now();
                }, { passive: true });
                
                recordDiv.addEventListener('touchend', async (e) => {
                    const touchDuration = Date.now() - touchStartTime;
                    if (touchDuration < 500) { // 0.5초 이내 탭만 인식
                        e.preventDefault();
                        await clickHandler();
                    }
                });
                
                recordDiv.onclick = clickHandler;
                
                // 호버 효과
                recordDiv.addEventListener('mouseenter', () => {
                    recordDiv.style.background = 'var(--background-modifier-hover)';
                });
                recordDiv.addEventListener('mouseleave', () => {
                    recordDiv.style.background = 'transparent';
                });
            });
        }
        
        // 빠른 퀴즈 시작
        const quickSection = section.createDiv({ cls: 'cloze-template-section' });
        quickSection.createEl('h4', { text: '⚡ 빠른 시작' });
        
        const templateList = quickSection.createDiv({ cls: 'cloze-template-list' });
        
        const templates = [
            { name: '복습 10개', count: 10 },
            { name: '복습 20개', count: 20 },
            { name: '복습 50개', count: 50 }
        ];
        
        templates.forEach(template => {
            const btn = templateList.createEl('button', { 
                text: template.name,
                cls: 'cloze-template-btn'
            });
            const templateHandler = async () => {
                await this.startQuickQuiz(template.count);
            };
            btn.onclick = templateHandler;
            btn.addEventListener('touchend', async (e) => {
                e.preventDefault();
                await templateHandler();
            });
        });
        
        // 통계
        const statsSection = section.createDiv({ cls: 'cloze-test-notes-section' });
        statsSection.createEl('h4', { text: '📊 오늘의 통계' });
        
        const statsDiv = statsSection.createDiv({ cls: 'cloze-note-item' });
        statsDiv.createEl('div', { text: `총 학습 횟수: ${todayStats.totalSessions}회` });
        statsDiv.createEl('div', { text: `총 문제 수: ${todayStats.totalCards}개` });
        statsDiv.createEl('div', { text: `정답률: ${todayStats.accuracy}% (${todayStats.correct}/${todayStats.totalCards})` });
        statsDiv.createEl('div', { text: `총 학습 시간: ${Math.round(todayStats.totalTime / 60)}분` });
        
        // 체크리스트 섹션
        this.renderGoalSection(section, 'daily', this.formatDate(this.currentDate));
    }
    
    async renderTestWeeklyTab(container) {
        if (!this.plugin.settings.testManagementEnabled) {
            container.createDiv({ 
                cls: 'cloze-empty-message',
                text: '테스트 관리가 비활성화되어 있습니다.'
            });
            return;
        }
        
        const section = container.createDiv({ cls: 'cloze-test-section' });
        
        const header = section.createDiv();
        header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;';
        
        header.createEl('h3', { text: `📚 ${this.currentDate.getFullYear()}년 ${this.currentDate.getMonth() + 1}월 주차별 학습 계획` });
        
        // 월 변경 버튼
        const monthNav = header.createDiv();
        monthNav.style.cssText = 'display: flex; gap: 8px;';
        
        const prevBtn = monthNav.createEl('button', { text: '◀' });
        prevBtn.style.cssText = 'padding: 6px 12px; background: var(--interactive-accent); color: white; border: none; border-radius: 6px; cursor: pointer;';
        prevBtn.onclick = () => {
            this.currentDate.setMonth(this.currentDate.getMonth() - 1);
            this.onOpen();
        };
        
        const nextBtn = monthNav.createEl('button', { text: '▶' });
        nextBtn.style.cssText = 'padding: 6px 12px; background: var(--interactive-accent); color: white; border: none; border-radius: 6px; cursor: pointer;';
        nextBtn.onclick = () => {
            this.currentDate.setMonth(this.currentDate.getMonth() + 1);
            this.onOpen();
        };
        
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        // 주차별 박스 생성
        const weeksContainer = section.createDiv();
        weeksContainer.style.cssText = 'display: flex; flex-direction: column; gap: 16px;';
        
        // 1주차부터 5주차까지
        for (let weekNum = 1; weekNum <= 5; weekNum++) {
            const startDay = 1 + (weekNum - 1) * 7;
            const endDay = Math.min(weekNum * 7, daysInMonth);
            
            if (startDay > daysInMonth) continue;
            
            // 주차별 색상 (심플)
            let weekColor;
            switch(weekNum) {
                case 1: weekColor = '#42a5f5'; break;
                case 2: weekColor = '#66bb6a'; break;
                case 3: weekColor = '#ffa726'; break;
                case 4: weekColor = '#ec407a'; break;
                case 5: weekColor = '#ab47bc'; break;
            }
            
            const weekBox = weeksContainer.createDiv();
            weekBox.style.cssText = `background: var(--background-secondary); padding: 20px; border-radius: 12px; border-left: 5px solid ${weekColor}; box-shadow: 0 2px 8px rgba(0,0,0,0.1);`;
            
            // 헤더
            const weekHeader = weekBox.createDiv();
            weekHeader.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;';
            
            const weekTitle = weekHeader.createEl('h4', { text: `📅 ${weekNum}주차 (${month + 1}월 ${startDay}~${endDay}일)` });
            weekTitle.style.cssText = `margin: 0; font-size: 1.2em; font-weight: 700;`;
            
            // 버튼 그룹
            const btnGroup = weekHeader.createDiv();
            btnGroup.style.cssText = 'display: flex; gap: 8px;';
            
            // 학습일기 열기 버튼
            const openBtn = btnGroup.createEl('button', { text: '📖 파일' });
            openBtn.style.cssText = `padding: 6px 12px; background: ${weekColor}; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;`;
            openBtn.onclick = async () => {
                await this.openOrCreateWeekFile(year, month, weekNum, startDay, endDay);
            };
            
            // 파일 동기화 버튼
            const syncBtn = btnGroup.createEl('button', { text: '🔄' });
            syncBtn.style.cssText = 'padding: 6px 12px; background: var(--background-secondary); border: 1px solid var(--background-modifier-border); border-radius: 6px; cursor: pointer; font-weight: 600;';
            syncBtn.title = '파일에서 불러오기';
            syncBtn.onclick = async () => {
                await this.onOpen();
                new Notice('✅ 파일에서 데이터를 불러왔습니다');
            };
            
            // 퀴즈 시작 버튼
            const quizBtn = btnGroup.createEl('button', { text: '🎯 퀴즈' });
            quizBtn.style.cssText = 'padding: 6px 12px; background: var(--background-secondary); border: 1px solid var(--background-modifier-border); border-radius: 6px; cursor: pointer; font-weight: 600;';
            quizBtn.onclick = () => {
                this.showWeekFolderSelection(year, month, weekNum, startDay);
            };
            
            // 파일에서 데이터 읽기
            let weekData = await this.plugin.readWeekFile(year, month, weekNum);
            
            // 체크리스트 영역
            const checklistDiv = weekBox.createDiv();
            checklistDiv.style.cssText = 'margin-top: 12px;';
            
            // 버튼 그룹
            const checklistBtnGroup = checklistDiv.createDiv();
            checklistBtnGroup.style.cssText = 'display: flex; gap: 8px; margin-bottom: 12px;';
            
            // 템플릿 버튼
            const templateBtn = checklistBtnGroup.createEl('button', { text: '📋 템플릿' });
            templateBtn.style.cssText = 'padding: 4px 12px; background: var(--background-modifier-border); border: none; border-radius: 4px; cursor: pointer; font-size: 0.85em; font-weight: 600;';
            templateBtn.onclick = () => {
                new ChecklistTemplateModal(this.app, this.plugin, async (templateItems) => {
                    if (!weekData.routines) weekData.routines = [];
                    weekData.routines = [...weekData.routines, ...templateItems.map(text => ({ text, checked: false }))];
                    await this.plugin.writeWeekFile(year, month, weekNum, startDay, endDay, weekData);
                    this.onOpen();
                }, weekData.routines || []).open();
            };
            
            // 추가 버튼
            const addChecklistBtn = checklistBtnGroup.createEl('button', { text: '➕ 항목 추가' });
            addChecklistBtn.style.cssText = 'padding: 4px 12px; background: var(--interactive-accent); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.85em; font-weight: 600;';
            addChecklistBtn.onclick = () => {
                new TestNoteAddModal(this.app, async (text) => {
                    if (!weekData.routines) weekData.routines = [];
                    weekData.routines.push({ text, checked: false });
                    await this.plugin.writeWeekFile(year, month, weekNum, startDay, endDay, weekData);
                    this.onOpen();
                }).open();
            };
            
            if (weekData && weekData.routines && weekData.routines.length > 0) {
                const completed = weekData.routines.filter(item => item.checked).length;
                const total = weekData.routines.length;
                const percent = Math.round((completed / total) * 100);
                
                // 진행률
                const progressText = checklistDiv.createEl('div', { text: `완료: ${completed}/${total} (${percent}%)` });
                progressText.style.cssText = `font-weight: 600; margin-bottom: 8px;`;
                
                // 프로그레스 바
                const progressBar = checklistDiv.createDiv();
                progressBar.style.cssText = 'background: rgba(0,0,0,0.1); height: 6px; border-radius: 3px; overflow: hidden; margin-bottom: 12px;';
                const progressFill = progressBar.createDiv();
                progressFill.style.cssText = `background: ${weekColor}; width: ${percent}%; height: 100%; transition: width 0.3s;`;
                
                // 모든 항목 표시 (클릭 가능)
                weekData.routines.forEach((item, idx) => {
                    const itemDiv = checklistDiv.createDiv();
                    itemDiv.style.cssText = 'display: flex; align-items: center; gap: 8px; padding: 6px 8px; font-size: 0.9em; background: var(--background-primary); border-radius: 4px; margin-bottom: 4px; cursor: pointer; transition: all 0.2s;';
                    
                    const checkbox = itemDiv.createEl('input', { type: 'checkbox' });
                    checkbox.checked = item.checked;
                    checkbox.style.cssText = 'cursor: pointer;';
                    checkbox.onclick = async (e) => {
                        e.stopPropagation();
                        item.checked = checkbox.checked;
                        await this.plugin.writeWeekFile(year, month, weekNum, startDay, endDay, weekData);
                        this.onOpen();
                    };
                    
                    const text = itemDiv.createEl('span', { text: item.text });
                    text.style.cssText = item.checked ? 'text-decoration: line-through; color: var(--text-muted); flex: 1;' : 'flex: 1;';
                    text.onclick = () => {
                        new TestNoteEditModal(this.app, item.text, async (newText) => {
                            item.text = newText;
                            await this.plugin.writeWeekFile(year, month, weekNum, startDay, endDay, weekData);
                            this.onOpen();
                        }, async () => {
                            weekData.routines.splice(idx, 1);
                            await this.plugin.writeWeekFile(year, month, weekNum, startDay, endDay, weekData);
                            this.onOpen();
                        }).open();
                    };
                    
                    const deleteBtn = itemDiv.createEl('button', { text: '×' });
                    deleteBtn.style.cssText = 'background: #ef4444; color: white; border: none; padding: 2px 8px; border-radius: 4px; cursor: pointer; font-size: 0.9em;';
                    deleteBtn.onclick = async (e) => {
                        e.stopPropagation();
                        if (confirm('이 항목을 삭제하시겠습니까?')) {
                            weekData.routines.splice(idx, 1);
                            await this.plugin.writeWeekFile(year, month, weekNum, startDay, endDay, weekData);
                            this.onOpen();
                        }
                    };
                    
                    itemDiv.addEventListener('mouseenter', () => {
                        itemDiv.style.background = 'var(--background-secondary)';
                        itemDiv.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                    });
                    itemDiv.addEventListener('mouseleave', () => {
                        itemDiv.style.background = 'var(--background-primary)';
                        itemDiv.style.boxShadow = 'none';
                    });
                });
            } else {
                const emptyText = checklistDiv.createEl('div', { text: '➕ 버튼을 눌러 항목을 추가하세요' });
                emptyText.style.cssText = 'color: var(--text-muted); font-size: 0.9em; font-style: italic; padding: 12px; text-align: center;';
            }
            
            // 메모 미리보기
            if (weekData && weekData.notes && weekData.notes.length > 0) {
                const notesDiv = weekBox.createDiv();
                notesDiv.style.cssText = 'margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(0,0,0,0.1);';
                
                const noteLabel = notesDiv.createEl('div', { text: '📝 메모:' });
                noteLabel.style.cssText = 'font-weight: 600; margin-bottom: 6px; font-size: 0.9em;';
                
                const latestNote = weekData.notes[0].text || weekData.notes[0];
                const noteText = notesDiv.createEl('div', { text: latestNote.length > 50 ? latestNote.substring(0, 50) + '...' : latestNote });
                noteText.style.cssText = 'font-size: 0.85em; color: var(--text-muted); font-style: italic;';
            }
        }
        
        // 주간 목표 섹션
        const weekKey = this.getWeekKey(new Date());
        this.renderGoalSection(section, 'weekly', weekKey);
    }
    
    async renderTestMonthlyTab(container) {
        if (!this.plugin.settings.testManagementEnabled) {
            container.createDiv({ 
                cls: 'cloze-empty-message',
                text: '테스트 관리가 비활성화되어 있습니다.'
            });
            return;
        }
        
        const calendarContainer = container.createDiv({ cls: 'cloze-calendar-container' });
        calendarContainer.style.cssText = 'background: linear-gradient(135deg, var(--background-secondary) 0%, var(--background-primary) 100%); padding: 20px; border-radius: 16px; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1); margin-bottom: 20px;';
        
        const monthNav = calendarContainer.createDiv({ cls: 'cloze-month-nav' });
        monthNav.style.cssText = 'display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; gap: 12px;';
        
        const prevBtn = monthNav.createEl('button', { cls: 'cloze-month-btn', text: '◀' });
        prevBtn.style.cssText = 'background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); color: white; border: none; padding: 10px 16px; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);';
        prevBtn.addEventListener('mouseenter', () => {
            prevBtn.style.transform = 'translateY(-2px)';
            prevBtn.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.5)';
        });
        prevBtn.addEventListener('mouseleave', () => {
            prevBtn.style.transform = 'translateY(0)';
            prevBtn.style.boxShadow = '0 2px 8px rgba(99, 102, 241, 0.3)';
        });
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
        monthTitle.style.cssText = 'font-size: 1.4em; font-weight: 700; color: var(--text-normal); text-shadow: 0 2px 4px rgba(0,0,0,0.1); flex: 1; text-align: center;';
        
        const nextBtn = monthNav.createEl('button', { cls: 'cloze-month-btn', text: '▶' });
        nextBtn.style.cssText = 'background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); color: white; border: none; padding: 10px 16px; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);';
        nextBtn.addEventListener('mouseenter', () => {
            nextBtn.style.transform = 'translateY(-2px)';
            nextBtn.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.5)';
        });
        nextBtn.addEventListener('mouseleave', () => {
            nextBtn.style.transform = 'translateY(0)';
            nextBtn.style.boxShadow = '0 2px 8px rgba(99, 102, 241, 0.3)';
        });
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
        todayBtn.style.cssText = 'background: linear-gradient(135deg, #ec4899 0%, #db2777 100%); color: white; border: none; padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 2px 8px rgba(236, 72, 153, 0.3);';
        todayBtn.addEventListener('mouseenter', () => {
            todayBtn.style.transform = 'translateY(-2px)';
            todayBtn.style.boxShadow = '0 4px 12px rgba(236, 72, 153, 0.5)';
        });
        todayBtn.addEventListener('mouseleave', () => {
            todayBtn.style.transform = 'translateY(0)';
            todayBtn.style.boxShadow = '0 2px 8px rgba(236, 72, 153, 0.3)';
        });
        const todayHandler = () => {
            this.currentDate = new Date();
            this.onOpen();
        };
        todayBtn.onclick = todayHandler;
        todayBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            todayHandler();
        });
        
        // 월간 파일 열기 버튼 (달력 위에 배치)
        const openMonthBtn = calendarContainer.createEl('button', { text: '📄 월간 일기 열기' });
        openMonthBtn.style.cssText = 'padding: 10px 16px; background: var(--interactive-accent); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; margin-bottom: 16px; width: 100%;';
        openMonthBtn.onclick = async () => {
            await this.openOrCreateMonthlyFile(this.currentDate);
        };
        
        // 달력 그리드
        const weekHeader = calendarContainer.createDiv({ cls: 'cloze-week-header' });
        weekHeader.style.cssText = 'display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; margin-bottom: 8px; font-weight: 600; font-size: 0.95em;';
        const days = ['일', '월', '화', '수', '목', '금', '토'];
        days.forEach((day, idx) => {
            const dayEl = weekHeader.createDiv({ cls: 'cloze-week-day', text: day });
            dayEl.style.cssText = `text-align: center; padding: 8px; color: ${idx === 0 ? '#ef4444' : idx === 6 ? '#3b82f6' : 'var(--text-muted)'};`;
        });
        
        const calendarGrid = calendarContainer.createDiv({ cls: 'cloze-calendar-grid' });
        calendarGrid.style.cssText = 'display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px;';
        this.renderCalendarDays(calendarGrid);
        
        // 월간 데이터 읽기 (달력 아래에 표시)
        const monthData = await this.plugin.readMonthlyFile(this.currentDate);
        
        // 학습 체크리스트 섹션
        const routineSection = container.createDiv({ cls: 'cloze-dashboard-section' });
        routineSection.style.cssText = 'background: var(--background-secondary); padding: 16px; border-radius: 8px; margin-top: 16px; margin-bottom: 16px;';
        
        const routineHeader = routineSection.createDiv();
        routineHeader.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;';
        
        const routineTitleRow = routineHeader.createDiv();
        routineTitleRow.style.cssText = 'display: flex; align-items: center; gap: 8px;';
        routineTitleRow.createEl('h4', { text: '✅ 학습 체크리스트' });
        
        // 동기화 버튼
        const routineSyncBtn = routineTitleRow.createEl('button', { text: '🔄' });
        routineSyncBtn.style.cssText = 'background: var(--interactive-accent); color: white; border: none; padding: 4px 10px; border-radius: 6px; cursor: pointer; font-size: 0.9em; transition: all 0.2s;';
        routineSyncBtn.onmouseover = () => {
            routineSyncBtn.style.transform = 'scale(1.1)';
        };
        routineSyncBtn.onmouseout = () => {
            routineSyncBtn.style.transform = 'scale(1)';
        };
        routineSyncBtn.onclick = async () => {
            this.onOpen();
            new Notice('✅ 파일에서 데이터를 불러왔습니다');
        };
        
        // 버튼 그룹
        const routineBtnGroup = routineSection.createDiv();
        routineBtnGroup.style.cssText = 'display: flex; gap: 8px; margin-bottom: 12px;';
        
        // 템플릿 버튼
        const routineTemplateBtn = routineBtnGroup.createEl('button', { text: '📋 템플릿' });
        routineTemplateBtn.style.cssText = 'flex: 1; padding: 10px; background: var(--background-modifier-border); border: none; border-radius: 6px; cursor: pointer; font-weight: 600; transition: all 0.2s;';
        routineTemplateBtn.onmouseover = () => {
            routineTemplateBtn.style.opacity = '0.8';
        };
        routineTemplateBtn.onmouseout = () => {
            routineTemplateBtn.style.opacity = '1';
        };
        routineTemplateBtn.onclick = () => {
            new ChecklistTemplateModal(this.app, this.plugin, async (templateItems) => {
                if (!monthData.routines) monthData.routines = [];
                monthData.routines = [...monthData.routines, ...templateItems.map(text => ({ text, checked: false }))];
                await this.plugin.writeMonthlyFile(this.currentDate, monthData);
                this.onOpen();
            }, monthData.routines || []).open();
        };
        
        // 항목 추가 버튼
        const addRoutineBtn = routineBtnGroup.createEl('button', { text: '➕ 체크리스트 추가' });
        addRoutineBtn.style.cssText = 'flex: 1; padding: 10px; background: var(--interactive-accent); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; transition: all 0.2s;';
        addRoutineBtn.onmouseover = () => {
            addRoutineBtn.style.opacity = '0.8';
        };
        addRoutineBtn.onmouseout = () => {
            addRoutineBtn.style.opacity = '1';
        };
        addRoutineBtn.onclick = () => {
            new TestNoteAddModal(this.app, async (newText) => {
                if (!monthData.routines) monthData.routines = [];
                monthData.routines.push({ text: newText, checked: false });
                await this.plugin.writeMonthlyFile(this.currentDate, monthData);
                this.onOpen();
            }).open();
        };
        
        // 학습 체크리스트
        const routineList = routineSection.createDiv();
        if (monthData.routines && monthData.routines.length > 0) {
            monthData.routines.forEach((routine, idx) => {
                const itemDiv = routineList.createDiv();
                itemDiv.style.cssText = 'padding: 10px; margin-bottom: 6px; display: flex; align-items: center; gap: 10px; border-radius: 6px; transition: all 0.2s; background: var(--background-primary);';
                
                const checkbox = itemDiv.createEl('input', { type: 'checkbox' });
                checkbox.checked = routine.checked;
                checkbox.style.cssText = 'cursor: pointer; width: 18px; height: 18px;';
                checkbox.onchange = async () => {
                    monthData.routines[idx].checked = checkbox.checked;
                    await this.plugin.writeMonthlyFile(this.currentDate, monthData);
                    this.onOpen();
                };
                
                const textSpan = itemDiv.createEl('span', { text: routine.text });
                textSpan.style.cssText = `flex: 1; cursor: pointer; ${routine.checked ? 'text-decoration: line-through; opacity: 0.6;' : ''}`;
                textSpan.onclick = () => {
                    new TestNoteEditModal(this.app, routine.text, async (editedText) => {
                        monthData.routines[idx].text = editedText;
                        await this.plugin.writeMonthlyFile(this.currentDate, monthData);
                        this.onOpen();
                    }, async () => {
                        if (confirm('이 항목을 삭제하시겠습니까?')) {
                            monthData.routines.splice(idx, 1);
                            await this.plugin.writeMonthlyFile(this.currentDate, monthData);
                            this.onOpen();
                        }
                    }).open();
                };
                
                const deleteBtn = itemDiv.createEl('button', { text: '×' });
                deleteBtn.style.cssText = 'background: #ef4444; color: white; border: none; padding: 2px 8px; border-radius: 4px; cursor: pointer; font-size: 0.9em;';
                deleteBtn.onclick = async (e) => {
                    e.stopPropagation();
                    if (confirm('이 항목을 삭제하시겠습니까?')) {
                        monthData.routines.splice(idx, 1);
                        await this.plugin.writeMonthlyFile(this.currentDate, monthData);
                        this.onOpen();
                    }
                };
                
                itemDiv.addEventListener('mouseenter', () => {
                    itemDiv.style.background = 'var(--background-secondary)';
                    itemDiv.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                });
                itemDiv.addEventListener('mouseleave', () => {
                    itemDiv.style.background = 'var(--background-primary)';
                    itemDiv.style.boxShadow = 'none';
                });
            });
        } else {
            const emptyText = routineList.createEl('div', { text: '➕ 버튼을 눌러 학습 체크리스트를 추가하세요' });
            emptyText.style.cssText = 'color: var(--text-muted); font-size: 0.9em; font-style: italic; padding: 12px; text-align: center;';
        }
        
        // 월간 목표 섹션 (체크리스트)
        const goalsSection = container.createDiv({ cls: 'cloze-dashboard-section' });
        goalsSection.style.cssText = 'background: var(--background-secondary); padding: 16px; border-radius: 8px; margin-top: 16px; margin-bottom: 16px;';
        
        const goalsHeader = goalsSection.createDiv();
        goalsHeader.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;';
        
        const titleRow = goalsHeader.createDiv();
        titleRow.style.cssText = 'display: flex; align-items: center; gap: 8px;';
        titleRow.createEl('h4', { text: '🎯 이번 달 목표' });
        
        // 동기화 버튼
        const syncBtn = titleRow.createEl('button', { text: '🔄' });
        syncBtn.style.cssText = 'background: var(--interactive-accent); color: white; border: none; padding: 4px 10px; border-radius: 6px; cursor: pointer; font-size: 0.9em; transition: all 0.2s;';
        syncBtn.onmouseover = () => {
            syncBtn.style.transform = 'scale(1.1)';
        };
        syncBtn.onmouseout = () => {
            syncBtn.style.transform = 'scale(1)';
        };
        syncBtn.onclick = async () => {
            this.onOpen();
            new Notice('✅ 파일에서 데이터를 불러왔습니다');
        };
        
        const completedCount = monthData.goals?.filter(g => g.checked).length || 0;
        const totalCount = monthData.goals?.length || 0;
        const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
        
        const progressText = goalsHeader.createEl('span', { text: `${percent}%` });
        progressText.style.cssText = 'font-weight: 700; color: var(--text-accent);';
        
        // 항목 추가 버튼
        const addBtn = goalsSection.createEl('button', { text: '➕ 목표 추가' });
        addBtn.style.cssText = 'width: 100%; padding: 10px; background: var(--interactive-accent); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; margin-bottom: 12px; transition: all 0.2s;';
        addBtn.onmouseover = () => {
            addBtn.style.opacity = '0.8';
        };
        addBtn.onmouseout = () => {
            addBtn.style.opacity = '1';
        };
        addBtn.onclick = () => {
            new TestNoteAddModal(this.app, async (newText) => {
                if (!monthData.goals) monthData.goals = [];
                monthData.goals.push({ text: newText, checked: false });
                await this.plugin.writeMonthlyFile(this.currentDate, monthData);
                this.onOpen();
            }).open();
        };
        
        // 목표 체크리스트
        const goalsList = goalsSection.createDiv();
        if (monthData.goals && monthData.goals.length > 0) {
            monthData.goals.forEach((goal, idx) => {
                const itemDiv = goalsList.createDiv();
                itemDiv.style.cssText = 'padding: 10px; margin-bottom: 6px; display: flex; align-items: center; gap: 10px; border-radius: 6px; transition: all 0.2s; background: var(--background-primary);';
                
                const checkbox = itemDiv.createEl('input', { type: 'checkbox' });
                checkbox.checked = goal.checked;
                checkbox.style.cssText = 'cursor: pointer; width: 18px; height: 18px;';
                checkbox.onchange = async () => {
                    monthData.goals[idx].checked = checkbox.checked;
                    await this.plugin.writeMonthlyFile(this.currentDate, monthData);
                    this.onOpen();
                };
                
                const textSpan = itemDiv.createEl('span', { text: goal.text });
                textSpan.style.cssText = `flex: 1; cursor: pointer; ${goal.checked ? 'text-decoration: line-through; opacity: 0.6;' : ''}`;
                textSpan.onclick = () => {
                    new TestNoteEditModal(this.app, goal.text, async (editedText) => {
                        monthData.goals[idx].text = editedText;
                        await this.plugin.writeMonthlyFile(this.currentDate, monthData);
                        this.onOpen();
                    }, async () => {
                        if (confirm('이 목표를 삭제하시겠습니까?')) {
                            monthData.goals.splice(idx, 1);
                            await this.plugin.writeMonthlyFile(this.currentDate, monthData);
                            this.onOpen();
                        }
                    }).open();
                };
                
                const deleteBtn = itemDiv.createEl('button', { text: '×' });
                deleteBtn.style.cssText = 'background: #ef4444; color: white; border: none; padding: 2px 8px; border-radius: 4px; cursor: pointer; font-size: 0.9em;';
                deleteBtn.onclick = async (e) => {
                    e.stopPropagation();
                    if (confirm('이 목표를 삭제하시겠습니까?')) {
                        monthData.goals.splice(idx, 1);
                        await this.plugin.writeMonthlyFile(this.currentDate, monthData);
                        this.onOpen();
                    }
                };
                
                itemDiv.addEventListener('mouseenter', () => {
                    itemDiv.style.background = 'var(--background-secondary)';
                    itemDiv.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                });
                itemDiv.addEventListener('mouseleave', () => {
                    itemDiv.style.background = 'var(--background-primary)';
                    itemDiv.style.boxShadow = 'none';
                });
            });
        } else {
            const emptyText = goalsList.createEl('div', { text: '➕ 버튼을 눌러 목표를 추가하세요' });
            emptyText.style.cssText = 'color: var(--text-muted); font-size: 0.9em; font-style: italic; padding: 12px; text-align: center;';
        }
        
        // 월간 통계
        const monthStats = this.getMonthStats();
        
        const statsSection = container.createDiv({ cls: 'cloze-dashboard-section' });
        statsSection.createEl('h4', { text: '📊 이번 달 통계' });
        
        const statsDiv = statsSection.createDiv({ cls: 'cloze-note-item' });
        statsDiv.createEl('div', { text: `총 학습 횟수: ${monthStats.totalSessions}회` });
        statsDiv.createEl('div', { text: `정답률: ${monthStats.accuracy}% (${monthStats.correct}/${monthStats.totalCards})` });
        statsDiv.createEl('div', { text: `총 학습 시간: ${Math.round(monthStats.totalTime / 60)}분` });
        
        // 폴더별 최근 학습 기록
        const recordsSection = container.createDiv({ cls: 'cloze-dashboard-section' });
        recordsSection.createEl('h4', { text: '📂 폴더별 학습 기록' });
        
        const history = this.plugin.settings.stats.studyHistory || [];
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        
        const monthSessions = history.filter(h => {
            const sessionDate = new Date(h.date || h.timestamp);
            return sessionDate.getFullYear() === year && sessionDate.getMonth() === month;
        });
        
        // 폴더별로 그룹화하여 최신 기록만
        const folderMap = {};
        monthSessions.forEach(session => {
            const folderName = session.folderName || session.fileName || '알 수 없음';
            if (!folderMap[folderName] || session.timestamp > folderMap[folderName].timestamp) {
                folderMap[folderName] = session;
            }
        });
        
        const recordsList = recordsSection.createDiv({ cls: 'cloze-session-list' });
        
        if (Object.keys(folderMap).length === 0) {
            recordsList.createDiv({ 
                cls: 'cloze-empty-message',
                text: '이번 달 학습 기록이 없습니다.'
            });
        } else {
            Object.values(folderMap).forEach(session => {
                const recordDiv = recordsList.createDiv({ cls: 'cloze-session-item' });
                recordDiv.style.padding = '8px 12px';
                recordDiv.style.borderRadius = '6px';
                recordDiv.style.background = 'transparent';
                recordDiv.style.marginBottom = '4px';
                recordDiv.style.cursor = 'pointer';
                recordDiv.style.display = 'flex';
                recordDiv.style.justifyContent = 'space-between';
                recordDiv.style.alignItems = 'center';
                
                const folderName = session.folderName || session.fileName || '알 수 없음';
                const total = session.total || 0;
                const correct = session.correct || 0;
                const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
                
                const folderText = recordDiv.createEl('span', {
                    text: `📂 ${folderName}`
                });
                folderText.style.fontWeight = '500';
                
                const statsText = recordDiv.createEl('span', {
                    text: `${correct}/${total} (${accuracy}%)`
                });
                
                if (accuracy >= 80) statsText.style.color = '#10b981';
                else if (accuracy >= 60) statsText.style.color = '#f59e0b';
                else statsText.style.color = '#ef4444';
                
                const clickHandler = async () => {
                    let filePath = session.folder;
                    
                    // folder가 없거나 파일을 못 찾으면 폴더 내 파일 목록 모달 표시
                    if (!filePath || (filePath.includes('/') && !filePath.endsWith('.md'))) {
                        // 폴더 경로인 경우 - 해당 폴더의 파일 목록 표시
                        const folderPath = session.folderName || filePath;
                        const files = this.app.vault.getMarkdownFiles().filter(f => 
                            (f.parent?.name === folderPath || f.path.includes(folderPath)) &&
                            !f.path.includes('첨부파일')
                        );
                        
                        if (files.length === 0) {
                            new Notice(`📂 ${folderPath} 폴더에 파일이 없습니다.`);
                            return;
                        }
                        
                        if (files.length === 1) {
                            await this.app.workspace.getLeaf().openFile(files[0]);
                            new Notice(`📂 ${files[0].basename} 파일 열기 완료`);
                            return;
                        }
                        
                        new RecentFilesModal(this.app, this.plugin, files, folderPath).open();
                        return;
                    }
                    
                    // fileName으로 검색 시도
                    if (!filePath && session.fileName) {
                        const files = this.app.vault.getMarkdownFiles();
                        const foundFile = files.find(f => f.basename === session.fileName);
                        if (foundFile) {
                            filePath = foundFile.path;
                        }
                    }
                    
                    if (filePath) {
                        const file = this.app.vault.getAbstractFileByPath(filePath);
                        if (file && file instanceof TFile) {
                            await this.app.workspace.getLeaf().openFile(file);
                            new Notice(`📂 ${folderName} 파일 열기 완료`);
                        } else {
                            new Notice(`파일을 찾을 수 없습니다: ${filePath}`);
                        }
                    } else {
                        new Notice('파일 경로 정보가 없습니다.');
                    }
                };
                
                let touchStartTime = 0;
                recordDiv.addEventListener('touchstart', () => {
                    touchStartTime = Date.now();
                }, { passive: true });
                
                recordDiv.addEventListener('touchend', async (e) => {
                    const touchDuration = Date.now() - touchStartTime;
                    if (touchDuration < 500) { // 0.5초 이내 탭만 인식
                        e.preventDefault();
                        await clickHandler();
                    }
                });
                
                recordDiv.onclick = clickHandler;
                
                // 호버 효과
                recordDiv.addEventListener('mouseenter', () => {
                    recordDiv.style.background = 'var(--background-modifier-hover)';
                });
                recordDiv.addEventListener('mouseleave', () => {
                    recordDiv.style.background = 'transparent';
                });
            });
        }
    }
    
    async openOrCreateDailyFile(date) {
        const filePath = await this.plugin.getDailyFilePath(date);
        
        const folderPath = filePath.substring(0, filePath.lastIndexOf('/'));
        const folder = this.app.vault.getAbstractFileByPath(folderPath);
        if (!folder) {
            await this.app.vault.createFolder(folderPath);
        }
        
        let file = this.app.vault.getAbstractFileByPath(filePath);
        
        if (!file) {
            const dayData = { routines: [], tasks: [], notes: [] };
            const content = this.plugin.generateDailyContent(date, dayData);
            file = await this.app.vault.create(filePath, content);
            new Notice('✅ 일일 학습 일기 생성됨');
        }
        
        const leaf = this.app.workspace.getLeaf(false);
        await leaf.openFile(file);
        
        new Notice('📖 일일 학습 일기 열림');
    }
    
    async openOrCreateMonthlyFile(date) {
        const filePath = await this.plugin.getMonthlyFilePath(date);
        
        const folderPath = filePath.substring(0, filePath.lastIndexOf('/'));
        const folder = this.app.vault.getAbstractFileByPath(folderPath);
        if (!folder) {
            await this.app.vault.createFolder(folderPath);
        }
        
        let file = this.app.vault.getAbstractFileByPath(filePath);
        
        if (!file) {
            const monthData = { goals: [], reviews: [], notes: [] };
            const content = this.plugin.generateMonthlyContent(date, monthData);
            file = await this.app.vault.create(filePath, content);
            new Notice('✅ 월간 학습 일기 생성됨');
        }
        
        const leaf = this.app.workspace.getLeaf(false);
        await leaf.openFile(file);
        
        new Notice('📖 월간 학습 일기 열림');
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
            
            const isToday = date.toDateString() === today.toDateString();
            const dayOfWeek = date.getDay();
            
            // 기본 스타일
            dayEl.style.cssText = 'position: relative; background: linear-gradient(135deg, var(--background-primary) 0%, var(--background-secondary) 100%); border-radius: 12px; padding: 12px; min-height: 80px; cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); border: 2px solid transparent; box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);';
            
            if (isToday) {
                dayEl.addClass('today');
                dayEl.style.cssText += 'border-color: #ec4899; background: linear-gradient(135deg, #fce7f3 0%, #fae8ff 100%); box-shadow: 0 4px 12px rgba(236, 72, 153, 0.3);';
            }
            
            // 호버 효과
            dayEl.addEventListener('mouseenter', () => {
                dayEl.style.transform = 'translateY(-4px) scale(1.02)';
                dayEl.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.15)';
            });
            dayEl.addEventListener('mouseleave', () => {
                dayEl.style.transform = 'translateY(0) scale(1)';
                dayEl.style.boxShadow = isToday ? '0 4px 12px rgba(236, 72, 153, 0.3)' : '0 2px 6px rgba(0, 0, 0, 0.05)';
            });
            
            const dayNum = dayEl.createDiv({ cls: 'cloze-day-num', text: day.toString() });
            dayNum.style.cssText = `font-size: 1.1em; font-weight: 700; margin-bottom: 8px; color: ${dayOfWeek === 0 ? '#ef4444' : dayOfWeek === 6 ? '#3b82f6' : 'var(--text-normal)'};`;
            
            // 해당 날짜의 일별 파일에서 체크리스트 완료 개수 확인
            (async () => {
                const dailyData = await this.plugin.readDailyFile(date);
                
                if (dailyData && dailyData.routines && dailyData.routines.length > 0) {
                    const completedCount = dailyData.routines.filter(r => r.checked).length;
                    const totalCount = dailyData.routines.length;
                    const completionRate = (completedCount / totalCount) * 100;
                    
                    const progress = dayEl.createDiv({ cls: 'cloze-day-progress' });
                    progress.setText(`${completedCount}/${totalCount}`);
                    progress.style.cssText = 'font-size: 0.85em; font-weight: 600; margin-top: 4px;';
                    
                    // 완료율에 따른 색상과 배경
                    if (completionRate === 100) {
                        dayEl.addClass('completed');
                        dayEl.style.background = 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)';
                        dayEl.style.borderColor = '#10b981';
                        progress.style.color = '#047857';
                    } else if (completionRate >= 50) {
                        dayEl.addClass('in-progress');
                        dayEl.style.background = 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)';
                        dayEl.style.borderColor = '#f59e0b';
                        progress.style.color = '#d97706';
                    } else {
                        progress.style.color = '#ef4444';
                    }
                    
                    // 프로그레스 바 추가
                    const progressBar = dayEl.createDiv();
                    progressBar.style.cssText = 'position: absolute; bottom: 0; left: 0; right: 0; height: 4px; background: var(--background-modifier-border); border-radius: 0 0 10px 10px; overflow: hidden;';
                    const progressFill = progressBar.createDiv();
                    progressFill.style.cssText = `width: ${completionRate}%; height: 100%; background: ${completionRate === 100 ? '#10b981' : completionRate >= 50 ? '#f59e0b' : '#ef4444'}; transition: width 0.5s ease;`;
                }
            })();
            
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
    
    showWeekFolderSelection(year, month, weekNum, day) {
        const startDay = 1 + (weekNum - 1) * 7;
        const endDay = Math.min(weekNum * 7, new Date(year, month + 1, 0).getDate());
        
        new WeekFolderSelectionModal(
            this.app,
            this.plugin,
            year,
            month,
            weekNum,
            startDay,
            endDay
        ).open();
    }
    
    async openOrCreateWeekFile(year, month, weekNum, startDay, endDay) {
        const filePath = await this.plugin.getWeekFilePath(year, month, weekNum);
        
        // 폴더가 없으면 생성
        const folderPath = filePath.substring(0, filePath.lastIndexOf('/'));
        const folder = this.app.vault.getAbstractFileByPath(folderPath);
        if (!folder) {
            await this.app.vault.createFolder(folderPath);
        }
        
        let file = this.app.vault.getAbstractFileByPath(filePath);
        
        // 파일이 없으면 생성
        if (!file) {
            const weekData = { routines: [], tasks: [], notes: [] };
            const content = this.plugin.generateWeekContent(year, month, weekNum, startDay, endDay, weekData);
            file = await this.app.vault.create(filePath, content);
            new Notice(`✅ ${weekNum}주차 학습 일기 생성됨`);
        }
        
        // 파일 열기
        const leaf = this.app.workspace.getLeaf(false);
        await leaf.openFile(file);
        
        new Notice(`📖 ${weekNum}주차 학습 일기 열림`);
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
    
    async startQuickQuiz(count) {
        // 최근 학습한 파일들을 우선순위로 퀴즈 시작
        new Notice(`${count}개 문제로 퀴즈를 시작합니다!`);
        
        // QuizModeModal 열기 (폴더 null이면 전체)
        const modal = new QuizModeModal(this.app, this.plugin, null);
        modal.open();
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
        // 테스트 아이템 렌더링 로직
        // quiz-content 영역 하단 버튼 높이만큼 paddingBottom 추가 (모바일/데스크탑 대응)
        const quizContent = container.querySelector('.quiz-content');
        if (quizContent) {
            // 버튼 높이: 모바일 80px, 데스크탑 56px 기준 + 여유
            const isMobile = window.innerWidth <= 768;
            const paddingValue = isMobile ? '100px' : '70px';
            quizContent.style.paddingBottom = paddingValue;
            // MutationObserver로 paddingBottom 유지
            if (!quizContent.__paddingObserver) {
                const observer = new MutationObserver(() => {
                    if (quizContent.style.paddingBottom !== paddingValue) {
                        quizContent.style.paddingBottom = paddingValue;
                    }
                });
                observer.observe(quizContent, { attributes: true, attributeFilter: ['style'] });
                quizContent.__paddingObserver = observer;
            }
        }
                                answerBtn.onclick = () => { new Notice('정답을 표시합니다'); };
                                refreshBtn.onclick = () => { new Notice('다시 풉니다'); };
                                exitBtn.onclick = () => { new Notice('퀴즈모드를 종료합니다'); };
        // ...existing code...
                // 버튼 스타일 유지 setInterval 병행 (버튼이 실제로 있을 때만)
                window.__clozeBtnInterval && clearInterval(window.__clozeBtnInterval);
                window.__clozeBtnInterval = setInterval(() => {
                    [prevBtn, pauseBtn, answerBtn, nextBtn, refreshBtn].forEach(btn => {
                        if (btn && btn.style) {
                            if (btn.style.cssText !== btnStyle) {
                                btn.style.cssText = btnStyle;
                            }
                        }
                    });
                }, 1000);
        if (!testData) testData = { items: [], notes: [] };
        if (!testData.items) testData.items = [];
        if (!testData.notes) testData.notes = [];
        
        // 하단 버튼 그룹 생성 및 스타일 적용(모바일 대응)
        // ...existing code...
        // container 스크롤/크기 감지하여 버튼 위치 동적 조정
        function updateBtnPosition() {
            const rect = container.getBoundingClientRect();
            let bottomValue = 0;
            // ...하단 버튼 그룹 및 버튼 생성 코드 전체 삭제...
        
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
        // 내용 영역에 하단 버튼 높이만큼 패딩 추가 (반응형)
        // 내용 영역 높이 제한 (상단/하단 버튼 영역만큼)
        noteSection.style.maxHeight = 'calc(100vh - 220px)';
        noteSection.style.overflowY = 'auto';
        noteSection.style.paddingBottom = '32px';
        const noteSectionMobileStyle = document.createElement('style');
        noteSectionMobileStyle.innerHTML = `
            @media (max-width: 480px) {
                .cloze-note-section {
                    max-height: calc(100vh - 260px) !important;
                    padding-bottom: 80px !important;
                }
            }
        `;
        document.head.appendChild(noteSectionMobileStyle);
        noteSection.classList.add('cloze-note-section');
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
        // noteSection 바로 뒤에 하단 버튼 그룹 배치
        if (bottomBtnGroup && noteSection && noteSection.parentNode) {
                        // 전체 퀴즈모드 버튼 디자인 리뉴얼 스타일 삽입
                        const designStyle = document.createElement('style');
                        designStyle.innerHTML = `
                        .cloze-top-btn-group {
                            position: sticky;
                            top: 0;
                            z-index: 10;
                            display: flex;
                            gap: 12px;
                            justify-content: center;
                            background: rgba(255,255,255,0.98);
                            box-shadow: 0 2px 12px rgba(0,0,0,0.08);
                            padding: 8px 0 12px 0;
                            border-radius: 0 0 18px 18px;
                            margin-bottom: 16px;
                        }
                        .cloze-bottom-btn-group {
                            position: sticky ;
                            width: 100%;
                            display: flex;
                            gap: 16px;
                            justify-content: center;
                            background: rgba(255,255,255,0.98);
                            box-shadow: 0 -2px 12px rgba(0,0,0,0.08);
                            padding: 8px 0 12px 0;
                            margin-top: 32px;
                            border-radius: 18px 18px 0 0;
                        }
                        .cloze-btn {
                            font-size: 1.08em;
                            padding: 12px 28px;
                            border-radius: 12px;
                            border: none;
                            background: #f5f5f7;
                            color: #222;
                            box-shadow: 0 1px 6px rgba(0,0,0,0.07);
                            cursor: pointer;
                            transition: background 0.2s, box-shadow 0.2s;
                            font-weight: 500;
                            display: flex;
                            align-items: center;
                            gap: 8px;
                        }
                        .cloze-btn.primary {
                            background: linear-gradient(90deg,#4f8cff,#6ad1ff);
                            color: #fff;
                            font-weight: 600;
                        }
                        .cloze-btn.danger {
                            background: linear-gradient(90deg,#ff4f6a,#ffb36a);
                            color: #fff;
                            font-weight: 600;
                        }
                        .cloze-btn:active {
                            box-shadow: 0 2px 12px rgba(0,0,0,0.12);
                        }
                        @media (max-width: 600px) {
                            .cloze-bottom-btn-group {
                                margin-bottom: 80px !important;
                                padding: 16px 0 80px 0;
                            }
                            .cloze-btn {
                                font-size: 1em;
                                padding: 12px 16px;
                            }
                        }
                        `;
                        document.head.appendChild(designStyle);
                        bottomBtnGroup.classList.add('cloze-bottom-btn-group');
                        // 버튼에 공통 클래스 및 주요 버튼에 강조 클래스 적용
                        Array.from(bottomBtnGroup.children).forEach((btn, idx) => {
                            btn.classList.add('cloze-btn');
                            if (btn.textContent.includes('정답')) btn.classList.add('primary');
                            if (btn.textContent.includes('나가기')) btn.classList.add('danger');
                        });
                        noteSection.parentNode.insertBefore(bottomBtnGroup, noteSection.nextSibling);
        }
    }
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
`;
    // ...하단 버튼 그룹 제거, 모든 버튼을 상단에만 배치...
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
        this.createStatCard(grid, '🎯 총 빈칸', stats.totalClozes);
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

    async renderFolderLearningRecords(container) {
        const section = container.createDiv({ cls: 'cloze-dashboard-section' });
        
        const headerDiv = section.createDiv({ cls: 'section-header' });
        headerDiv.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;';
        
        headerDiv.createEl('h3', { text: '📂 폴더별 학습 기록' });
        
        const manageFolderBtn = headerDiv.createEl('button', { 
            text: '📁 폴더 관리',
            cls: 'cloze-action-btn'
        });
        manageFolderBtn.style.cssText = 'padding: 6px 12px; font-size: 13px;';
        manageFolderBtn.addEventListener('click', () => {
            new FolderManagementModal(this.plugin.app, this.plugin).open();
        });

        const folders = await this.getClozefolders();
        const stats = this.plugin.settings.stats;
        
        if (folders.length === 0) {
            section.createEl('p', { 
                text: '빈칸 노트가 있는 폴더가 없습니다. 새 주제 폴더를 만들어보세요!',
                cls: 'cloze-empty-message'
            });
            return;
        }

        // 폴더 카드 그리드
        const folderGrid = section.createDiv({ cls: 'cloze-folder-grid' });
        folderGrid.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; margin-top: 16px;';

        for (const folder of folders) {
            const folderStats = stats.folderStats?.[folder.name] || { attempts: 0, correct: 0, time: 0 };
            const accuracy = folderStats.attempts > 0 ? Math.round((folderStats.correct / folderStats.attempts) * 100) : 0;
            
            const card = folderGrid.createDiv({ cls: 'cloze-folder-card' });
            card.style.cssText = 'padding: 16px; background: var(--background-primary-alt); border: 1px solid var(--background-modifier-border); border-radius: 8px; transition: all 0.2s;';
            
            // 폴더 헤더
            const cardHeader = card.createDiv();
            cardHeader.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;';
            
            cardHeader.createEl('h4', { text: `📁 ${folder.name}` }).style.cssText = 'margin: 0; font-size: 1.1em;';
            cardHeader.createEl('span', { text: `${folder.noteCount}개 노트` }).style.cssText = 'font-size: 0.85em; color: var(--text-muted);';
            
            // 학습 통계
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
            
            // 버튼 그룹 (북마크 폴더는 다른 버튼들)
            const btnGroup = card.createDiv();
            btnGroup.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px;';
            
            if (folder.isBookmarkFolder) {
                // 북마크 퀴즈 버튼
                const quizBtn = btnGroup.createEl('button', { text: '🎯 퀴즈' });
                quizBtn.style.cssText = 'padding: 8px; background: var(--interactive-accent); color: var(--text-on-accent); border-radius: 4px; font-weight: 500; font-size: 0.9em;';
                const quizHandler = () => {
                    new BookmarkQuizModal(this.plugin.app, this.plugin).open();
                };
                quizBtn.addEventListener('click', quizHandler);
                quizBtn.addEventListener('touchend', (e) => {
                    e.preventDefault();
                    quizHandler();
                });
                
                // 북마크 목록 버튼
                const listBtn = btnGroup.createEl('button', { text: '📋 목록' });
                listBtn.style.cssText = 'padding: 8px; background: var(--color-green); color: white; border-radius: 4px; font-weight: 500; font-size: 0.9em;';
                const listHandler = () => {
                    new BookmarkListModal(this.plugin.app, this.plugin).open();
                };
                listBtn.addEventListener('click', listHandler);
                listBtn.addEventListener('touchend', (e) => {
                    e.preventDefault();
                    listHandler();
                });
                
                // 전체 삭제 버튼
                const clearBtn = btnGroup.createEl('button', { text: '🗑️ 초기화' });
                clearBtn.style.cssText = 'padding: 8px; background: var(--background-secondary); border-radius: 4px; font-size: 0.9em;';
                const clearHandler = () => {
                    if (confirm('모든 북마크를 삭제하시겠습니까?')) {
                        this.plugin.clearBookmarks();
                        this.refreshView();
                    }
                };
                clearBtn.addEventListener('click', clearHandler);
                clearBtn.addEventListener('touchend', (e) => {
                    e.preventDefault();
                    clearHandler();
                });
            } else {
                // 일반 폴더 버튼들
                // 버튼 그룹을 4개 버튼으로 확장
                btnGroup.style.cssText = 'display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;';
                
                // 퀴즈 시작 버튼
                const quizBtn = btnGroup.createEl('button', { text: '🎯 퀴즈' });
                quizBtn.style.cssText = 'padding: 8px; background: var(--interactive-accent); color: var(--text-on-accent); border-radius: 4px; font-weight: 500; font-size: 0.9em;';
                const quizHandler = () => {
                    new QuizModeModal(this.plugin.app, this.plugin, folder.path).open();
                };
                quizBtn.addEventListener('click', quizHandler);
                quizBtn.addEventListener('touchend', (e) => {
                    e.preventDefault();
                    quizHandler();
                });
                
                // 새 빈칸 생성 버튼
                const createBtn = btnGroup.createEl('button', { text: '➕ 생성' });
                createBtn.style.cssText = 'padding: 8px; background: var(--color-green); color: white; border-radius: 4px; font-weight: 500; font-size: 0.9em;';
                const createHandler = () => {
                    this.plugin.createClozeNoteInFolder(folder.path);
                };
                createBtn.addEventListener('click', createHandler);
                createBtn.addEventListener('touchend', (e) => {
                    e.preventDefault();
                    createHandler();
                });
                
                // 목록 버튼 (새로 추가)
                const listBtn = btnGroup.createEl('button', { text: '📋 목록' });
                listBtn.style.cssText = 'padding: 8px; background: var(--background-modifier-border); border: none; border-radius: 4px; font-weight: 500; font-size: 0.9em; cursor: pointer;';
                const listHandler = () => {
                    const files = this.app.vault.getMarkdownFiles().filter(f => 
                        (f.parent?.name === folder.name || f.path.includes(folder.path)) &&
                        !f.path.includes('첨부파일')
                    );
                    
                    if (files.length > 0) {
                        new RecentFilesModal(this.app, this.plugin, files).open();
                    } else {
                        new Notice('폴더에 파일이 없습니다.');
                    }
                };
                listBtn.addEventListener('click', listHandler);
                listBtn.addEventListener('touchend', (e) => {
                    e.preventDefault();
                    listHandler();
                });
                
                // 상세 기록 버튼
                const detailBtn = btnGroup.createEl('button', { text: '📊 기록' });
                detailBtn.style.cssText = 'padding: 8px; background: var(--background-secondary); border-radius: 4px; font-size: 0.9em;';
                const detailHandler = () => {
                    new FolderDetailModal(this.plugin.app, this.plugin, folder.name, folder.path).open();
                };
                detailBtn.addEventListener('click', detailHandler);
                detailBtn.addEventListener('touchend', (e) => {
                    e.preventDefault();
                    detailHandler();
                });
            }
            
            // 호버 효과
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
                text: '빈칸 노트가 있는 폴더가 없습니다. 새 주제 폴더를 만들어보세요!',
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
        const clozeFolder = this.plugin.settings.clozeFolder;
        const clozeFolderFile = this.plugin.app.vault.getAbstractFileByPath(clozeFolder);
        
        if (!clozeFolderFile || !clozeFolderFile.children) {
            return [];
        }

        const folders = [];
        
        // 북마크 폴더를 최상단에 추가
        const bookmarkCount = this.plugin.settings.bookmarks?.length || 0;
        const bookmarkFolderPath = this.plugin.settings.bookmarkFolder || '📌 북마크';
        
        if (bookmarkCount > 0) {
            folders.push({
                name: '⭐ 북마크',
                path: bookmarkFolderPath,
                noteCount: bookmarkCount,
                isBookmarkFolder: true
            });
        }
        
        // 일반 폴더들 추가
        for (const child of clozeFolderFile.children) {
            if (child.children) { // 폴더인 경우
                const noteCount = child.children.filter(f => f.extension === 'md').length;
                if (noteCount > 0) {
                    folders.push({
                        name: child.name,
                        path: child.path,
                        noteCount: noteCount
                    });
                }
            }
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
        const section = container.createDiv({ cls: 'cloze-dashboard-section' });
        section.createEl('h3', { text: '⚡ 빠른 작업' });

        const actions = section.createDiv({ cls: 'cloze-quick-actions' });
        actions.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;';

        const actionButtons = [
            { 
                text: '🎯 전체 퀴즈 시작', 
                icon: '🎯',
                action: () => {
                    new QuizModeModal(this.plugin.app, this.plugin).open();
                },
                color: 'var(--interactive-accent)'
            },
            { 
                text: '📜 학습 기록 보기', 
                icon: '📜',
                action: () => {
                    new StudyHistoryModal(this.plugin.app, this.plugin).open();
                },
                color: 'var(--color-blue)'
            },
            { 
                text: '📁 새 주제 폴더', 
                icon: '📁',
                action: () => this.plugin.createClozeSubfolder(),
                color: 'var(--color-green)'
            },
            { 
                text: '📄 새 빈칸 노트', 
                icon: '📄',
                action: () => this.plugin.createClozeNote(),
                color: 'var(--color-purple)'
            },
            { 
                text: '📊 대시보드 파일', 
                icon: '📊',
                action: () => this.plugin.openClozeDashboard(),
                color: 'var(--text-muted)'
            },
            { 
                text: '⚙️ 설정', 
                icon: '⚙️',
                action: () => {
                    this.app.setting.open();
                    this.app.setting.openTabById('enhanced-cloze');
                },
                color: 'var(--interactive-accent)'
            },
            { 
                text: '🔄 전체 초기화', 
                icon: '🔄',
                action: () => this.resetAllProgress(),
                color: 'var(--color-red)',
                warning: true
            }
        ];

        actionButtons.forEach(({ text, icon, action, color, warning }) => {
            const btn = actions.createEl('button', { 
                cls: warning ? 'cloze-action-btn cloze-action-btn-warning' : 'cloze-action-btn'
            });
            btn.style.cssText = `
                padding: 12px 16px; 
                background: ${warning ? 'var(--background-modifier-error)' : color}; 
                color: ${warning ? 'white' : 'var(--text-on-accent)'}; 
                border: none; 
                border-radius: 6px; 
                cursor: pointer; 
                font-weight: 500; 
                transition: all 0.2s;
                display: flex;
                align-items: center;
                gap: 8px;
                justify-content: center;
            `;
            
            btn.createSpan({ text: icon }).style.fontSize = '20px';
            btn.createSpan({ text: text.replace(icon + ' ', '') });
            
            // 클릭 및 터치 이벤트
            const handleAction = (e) => {
                e.preventDefault();
                action();
            };
            
            btn.addEventListener('click', handleAction);
            btn.addEventListener('touchend', handleAction);
            
            // 호버 효과 (데스크톱)
            btn.addEventListener('mouseenter', () => {
                btn.style.transform = 'translateY(-2px)';
                btn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
            });
            btn.addEventListener('mouseleave', () => {
                btn.style.transform = 'translateY(0)';
                btn.style.boxShadow = 'none';
            });
            
            // 터치 피드백 (모바일)
            btn.addEventListener('touchstart', () => {
                btn.style.opacity = '0.8';
            });
            btn.addEventListener('touchcancel', () => {
                btn.style.opacity = '1';
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
            console.log('Enhanced Cloze Statistics Export:', jsonStr);
        });
    }

    async onClose() {
        // Cleanup
    }
}

// =====================================================
// Part 3: 메인 플러그인 클래스 시작
// =====================================================

class EnhancedClozePlugin extends Plugin {
    async onload() {
        await this.loadSettings();
        
        // ClozeEditModal을 플러그인 인스턴스에 export
        this.ClozeEditModal = ClozeEditModal;
        
        // 기본 폴더 생성
        await this.createDefaultFolders();
        
        // 타이머 배열 초기화
        this.activeTimers = [];
        
        // 리본 아이콘 추가 (기존)
        this.addRibbonIcon('highlighter', 'Enhanced Cloze Menu', (evt) => {
            this.showRibbonMenu(evt);
        });

        // 대시보드 뷰 등록 (새로 추가)
        this.registerView(
            DASHBOARD_VIEW_TYPE,
            (leaf) => new ClozeDashboardView(leaf, this)
        );

        // 대시보드 리본 아이콘 추가 (새로 추가)
        this.addRibbonIcon('layout-dashboard', 'Cloze Dashboard', () => {
            this.openClozeDashboardView();
        });

        // 이미지 빈칸 추가 리본 아이콘
        this.addRibbonIcon('image-plus', '이미지 빈칸 추가', () => {
            const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
            if (!activeView) {
                new Notice('❌ 마크다운 파일을 열어주세요');
                return;
            }
            
            const file = activeView.file;
            if (!file) {
                new Notice('❌ 파일을 찾을 수 없습니다');
                return;
            }
            
            new ImageClozeModal(this.app, this, file, async () => {
                // 파일 새로고침
                await this.app.workspace.getActiveViewOfType(MarkdownView)?.leaf.rebuildView();
            }).open();
        });

        this.registerMarkdownPostProcessor(this.processClozes.bind(this));

        // 편집 모드(Live Preview)에서도 빈칸 처리 등록
        this.registerEditorExtension([
            this.createLivePreviewExtension()
        ]);

        // 기존 명령어들
        this.addCommand({
            id: 'create-cloze-from-selection',
            name: 'Create cloze from selection',
            icon: 'highlighter',
            editorCallback: (editor) => {
                this.createClozeFromSelection(editor);
            }
        });

        // 빈칸 해제 명령어 추가
        this.addCommand({
            id: 'remove-cloze-from-selection',
            name: 'Remove cloze from selection',
            icon: 'eraser',
            editorCallback: (editor) => {
                this.removeClozeFromSelection(editor);
            }
        });

        // 빈칸 토글 명령어 (Ctrl+Shift+X)
        this.addCommand({
            id: 'toggle-cloze-from-selection',
            name: 'Toggle cloze from selection',
            icon: 'repeat',
            hotkeys: [{ modifiers: ["Mod", "Shift"], key: "x" }],
            editorCallback: (editor) => {
                this.toggleClozeFromSelection(editor);
            }
        });

        this.addCommand({
            id: 'show-cloze-manager',
            name: 'Show cloze manager',
            callback: () => {
                this.showClozeManager();
            }
        });

        this.addCommand({
            id: 'open-cloze-dashboard',
            name: 'Open cloze dashboard',
            callback: () => {
                this.openClozeDashboard();
            }
        });

        // 대시보드 뷰 명령어 추가 (새로 추가)
        this.addCommand({
            id: 'open-cloze-dashboard-view',
            name: 'Open Cloze Dashboard View',
            callback: () => {
                this.openClozeDashboardView();
            }
        });

        this.addCommand({
            id: 'create-cloze-note',
            name: 'Create new cloze note',
            callback: () => {
                this.createClozeNote();
            }
        });

        this.addCommand({
            id: 'create-cloze-subfolder',
            name: 'Create cloze subfolder',
            callback: () => {
                this.createClozeSubfolder();
            }
        });

        this.addCommand({
            id: 'reveal-next-genuine-cloze',
            name: 'Reveal next genuine cloze',
            hotkeys: [{ modifiers: ["Mod"], key: "j" }],
            callback: () => { this.revealNextClozeInActiveView('genuine'); }
        });

        this.addCommand({
            id: 'reveal-all-genuine-clozes',
            name: 'Reveal all genuine clozes',
            hotkeys: [{ modifiers: ["Mod", "Shift"], key: "j" }],
            callback: () => { this.toggleAllClozesInActiveView('genuine'); }
        });

        this.addCommand({
            id: 'reveal-next-pseudo-cloze',
            name: 'Reveal next pseudo cloze',
            hotkeys: [{ modifiers: ["Mod"], key: "n" }],
            callback: () => { this.revealNextClozeInActiveView('pseudo'); }
        });

        this.addCommand({
            id: 'reveal-all-pseudo-clozes',
            name: 'Reveal all pseudo clozes',
            hotkeys: [{ modifiers: ["Mod", "Shift"], key: "n" }],
            callback: () => { this.toggleAllClozesInActiveView('pseudo'); }
        });

        this.addCommand({
            id: 'next-card',
            name: 'Go to next card number',
            hotkeys: [{ modifiers: ["Mod"], key: "ArrowRight" }],
            callback: () => { this.nextCard(); }
        });

        this.addCommand({
            id: 'previous-card',
            name: 'Go to previous card number',
            hotkeys: [{ modifiers: ["Mod"], key: "ArrowLeft" }],
            callback: () => { this.previousCard(); }
        });

        // 타이머 명령어 추가 (새로 추가)
        this.addCommand({
            id: 'toggle-timer',
            name: 'Toggle timer on/off',
            callback: () => {
                this.settings.enableTimer = !this.settings.enableTimer;
                this.saveSettings();
                new Notice(`타이머: ${this.settings.enableTimer ? 'ON' : 'OFF'}`);
                this.refreshAllClozes();
            }
        });

        // 이미지 빈칸 추가 명령어
        this.addCommand({
            id: 'add-image-cloze',
            name: 'Add image cloze',
            icon: 'image-plus',
            callback: () => {
                const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
                if (!activeView) {
                    new Notice('❌ 마크다운 파일을 열어주세요');
                    return;
                }
                
                const file = activeView.file;
                if (!file) {
                    new Notice('❌ 파일을 찾을 수 없습니다');
                    return;
                }
                
                new ImageClozeModal(this.app, this, file, async () => {
                    await activeView.leaf.rebuildView();
                }).open();
            }
        });

        // 클립보드 이미지로 빈칸 만들기 (Ctrl+Shift+V)
        this.addCommand({
            id: 'paste-image-as-cloze',
            name: 'Paste image from clipboard as cloze',
            icon: 'clipboard-paste',
            hotkeys: [{ modifiers: ["Mod", "Shift"], key: "v" }],
            editorCallback: async (editor) => {
                await this.pasteImageAsCloze(editor);
            }
        });

        this.addSettingTab(new EnhancedClozeSettingTab(this.app, this));
        this.addStyles();
        
        // 에디터 컨텍스트 메뉴에 빈칸 만들기 추가
        this.registerEvent(
            this.app.workspace.on('editor-menu', (menu, editor, view) => {
                const selection = editor.getSelection();
                
                if (selection && selection.trim()) {
                    // 선택된 텍스트가 이미 빈칸인지 확인
                    const isCloze = /\{\{c\d+::.+?\}\}/.test(selection);
                    
                    if (isCloze) {
                        // 빈칸 해제 메뉴
                        menu.addItem((item) => {
                            item
                                .setTitle('🔓 빈칸 해제')
                                .setIcon('eraser')
                                .onClick(() => {
                                    this.removeClozeFromSelection(editor);
                                });
                        });
                    } else {
                        // 빈칸 만들기 메뉴
                        menu.addItem((item) => {
                            item
                                .setTitle('🔒 빈칸 만들기')
                                .setIcon('highlighter')
                                .onClick(() => {
                                    this.createClozeFromSelection(editor);
                                });
                        });
                    }
                    
                    // 빈칸 토글 메뉴 (항상 표시)
                    menu.addItem((item) => {
                        item
                            .setTitle('🔄 빈칸 토글')
                            .setIcon('repeat')
                            .onClick(() => {
                                this.toggleClozeFromSelection(editor);
                            });
                    });
                }
            })
        );
        
        console.log('Enhanced Cloze plugin loaded');
    }

    // 계속 Part 4에서...
    
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
                .setTitle(hasSelection ? '📝 선택한 텍스트를 빈칸으로' : '📝 텍스트를 선택해주세요')
                .setIcon('highlighter')
                .setDisabled(!hasSelection)
                .onClick(() => {
                    if (view && hasSelection) {
                        this.createClozeFromSelection(view.editor);
                        new Notice('✅ 빈칸이 추가되었습니다!');
                    }
                })
        );

        menu.addItem((item) =>
            item
                .setTitle('🧹 선택한 빈칸 해제')
                .setIcon('eraser')
                .setDisabled(!hasSelection)
                .onClick(() => {
                    if (view && hasSelection) {
                        this.removeClozeFromSelection(view.editor);
                        new Notice('✅ 빈칸이 해제되었습니다!');
                    }
                })
        );

        menu.addItem((item) =>
            item
                .setTitle('📋 빈칸 관리')
                .setIcon('list')
                .onClick(() => {
                    this.showClozeManager();
                })
        );

        menu.addItem((item) =>
            item
                .setTitle('📊 빈칸 대시보드 열기')
                .setIcon('layout-dashboard')
                .onClick(() => {
                    this.openClozeDashboard();
                })
        );

        menu.addItem((item) =>
            item
                .setTitle('📺 대시보드 뷰 열기')
                .setIcon('layout-dashboard')
                .onClick(() => {
                    this.openClozeDashboardView();
                })
        );

        menu.addItem((item) =>
            item
                .setTitle('📄 새 빈칸 노트 만들기')
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
                .setTitle('📂 폴더별 관리')
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

        menu.addItem((item) =>
            item
                .setTitle('🎯 퀴즈 모드')
                .setIcon('target')
                .onClick(() => {
                    new QuizModeModal(this.app, this).open();
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

    // 선택한 텍스트로 빈칸 생성
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
            new Notice(`빈칸 c${clozeNumber} 생성 완료!`);
        });
        modal.open();
    }

    // 선택한 빈칸 해제
    removeClozeFromSelection(editor) {
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
            new Notice('선택 영역에 빈칸이 없습니다');
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
            new Notice(`빈칸이 해제되었습니다: ${matches[0].answer}`);
        } else {
            new Notice(`${matches.length}개의 빈칸이 해제되었습니다`);
        }
    }

    // 빈칸 토글 (빈칸이 있으면 해제, 없으면 생성)
    toggleClozeFromSelection(editor) {
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
                new Notice(`✅ 빈칸 해제: ${matches[0].answer}`);
            } else {
                new Notice(`✅ ${matches.length}개의 빈칸 해제`);
            }
        } 
        // 빈칸이 없으면 생성
        else {
            this.createClozeFromSelection(editor);
        }
    }

    // 클립보드의 이미지를 빈칸으로 추가
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
                                const attachmentFolder = this.settings.imageClozeFolder || '첨부파일';
                                const folderExists = await this.app.vault.adapter.exists(attachmentFolder);
                                if (!folderExists) {
                                    await this.app.vault.createFolder(attachmentFolder);
                                }

                                // 이미지 저장
                                const filePath = `${attachmentFolder}/${fileName}`;
                                const arrayBuffer = await imageBlob.arrayBuffer();
                                await this.app.vault.createBinary(filePath, arrayBuffer);

                                // 빈칸 마크다운 삽입
                                const imageWidth = this.settings.imageClozeWidth || 300;
                                const clozeText = hint ? `{{c1::${answer}::${hint}}}` : `{{c1::${answer}}}`;
                                const clozeMarkdown = `![[${fileName}|${imageWidth}]]${clozeText}`;
                                
                                editor.replaceSelection(clozeMarkdown);
                                
                                new Notice(`✅ 이미지 빈칸 생성: ${fileName}`);
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
            console.error('이미지 빈칸 생성 오류:', error);
            new Notice('❌ 클립보드 이미지 붙여넣기 실패');
        }
    }

    // 빈칸 관리자 표시
    showClozeManager() {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view) {
            new Notice('활성화된 노트가 없습니다');
            return;
        }

        const content = view.getViewData();
        const clozeRegex = /\{\{c(\d+)::([^:}]+)(?:::([^}]+))?\}\}/g;
        const clozes = [];
        let match;

        while ((match = clozeRegex.exec(content)) !== null) {
            clozes.push({
                number: match[1],
                answer: match[2],
                hint: match[3] || '',
                fullText: match[0],
                position: match.index
            });
        }

        const modal = new ClozeManagerModal(this.app, clozes, this);
        modal.open();
    }

    // 빈칸 대시보드 열기 (마크다운 파일)
    async openClozeDashboard() {
        const dashboardPath = `${this.settings.clozeFolder}/${this.settings.dashboardFileName}`;
        
        const folderExists = await this.app.vault.adapter.exists(this.settings.clozeFolder);
        if (!folderExists) {
            await this.app.vault.createFolder(this.settings.clozeFolder);
        }

        const fileExists = await this.app.vault.adapter.exists(dashboardPath);
        if (!fileExists) {
            await this.createDashboard();
        } else {
            await this.updateDashboard();
        }

        const file = this.app.vault.getAbstractFileByPath(dashboardPath);
        if (file) {
            await this.app.workspace.getLeaf().openFile(file);
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
        const dashboardPath = `${this.settings.clozeFolder}/${this.settings.dashboardFileName}`;
        const content = await this.generateDashboardContent();
        await this.app.vault.create(dashboardPath, content);
        new Notice('빈칸 대시보드가 생성되었습니다');
    }

    // 대시보드 업데이트
    async updateDashboard() {
        const dashboardPath = `${this.settings.clozeFolder}/${this.settings.dashboardFileName}`;
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
            if (file.path.startsWith(this.settings.clozeFolder) && 
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

        let content = `# 🎯 빈칸 학습 대시보드\n\n`;
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
            content += `> 아직 빈칸이 포함된 노트가 없습니다.\n`;
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
        content += `3. **빈칸 만들기**: 텍스트 선택 → Cmd+P → "Create cloze from selection"\n`;
        content += `4. **빈칸 형식**: \`{{c1::답::힌트}}\` (힌트는 선택사항)\n`;
        content += `5. **학습 방법**: 한 폴더의 Card 1부터 시작해서 순차적으로 학습하세요\n`;
        content += `6. **타이머 활용**: 설정에서 타이머 시간을 조정하고 시간 제한 학습에 도전하세요\n\n`;

        content += `---\n\n`;
        content += `*이 대시보드는 자동으로 생성됩니다.*\n`;

        return content;
    }

    // 새 빈칸 노트 생성
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
            const folderPath = `${this.settings.clozeFolder}/${folderName}`;
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
            const readmeContent = `# ${folderName}\n\n> 생성일: ${new Date().toLocaleString('ko-KR')}\n\n## 설명\n\n이 폴더는 "${folderName}" 주제의 빈칸 학습 노트를 담고 있습니다.\n\n## 현재 진행\n\n- 현재 카드: **Card 1**\n- 총 노트: 0개\n\n---\n\n*리본 메뉴 → "새 빈칸 노트 만들기"로 노트를 추가하세요.*\n`;
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
            content += `여기에 내용을 작성하고, 빈칸으로 만들고 싶은 부분을 선택한 후\n`;
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
            f.path.startsWith(this.settings.clozeFolder)
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
            if (!file.path.startsWith(this.settings.clozeFolder)) continue;

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
        // 메인 cloze 폴더 생성
        const mainFolder = this.settings.clozeFolder;
        const mainExists = this.app.vault.getAbstractFileByPath(mainFolder);
        if (!mainExists) {
            try {
                await this.app.vault.createFolder(mainFolder);
                console.log('📁 메인 폴더 생성됨:', mainFolder);
            } catch (e) {
                console.log('Main folder might already exist:', mainFolder);
            }
        }

        // 하위 폴더들 생성
        if (this.settings.clozeFolders && this.settings.clozeFolders.length > 0) {
            for (const subfolder of this.settings.clozeFolders) {
                const folderPath = `${mainFolder}/${subfolder}`;
                const exists = this.app.vault.getAbstractFileByPath(folderPath);
                if (!exists) {
                    try {
                        await this.app.vault.createFolder(folderPath);
                        console.log('📁 하위 폴더 생성됨:', folderPath);
                    } catch (e) {
                        console.log('Subfolder might already exist:', folderPath);
                    }
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

            /* 퀴즈모드 타이머/북마크 상단 배치 스타일 */
            .quiz-timer-bookmark-wrap {
                margin-top: 8px;
                display: flex;
                justify-content: center;
                gap: 16px;
            }
            
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
            
            .image-cloze-wrapper img { 
                max-width: 100% !important; 
                height: auto !important; 
                display: block !important;
                border-radius: 8px !important;
                transition: transform 0.2s ease !important;
                -webkit-user-select: none !important;
                user-select: none !important;
            }
            
            .image-cloze-wrapper img[style*="display: block"] {
                cursor: zoom-in !important;
            }
            
            .image-cloze-wrapper img[style*="display: block"]:hover {
                transform: scale(1.05) !important;
            }
            
            .quiz-note-content .image-cloze-wrapper img {
                max-height: 400px !important;
            }
            
            /* 모바일 이미지 빈칸 대응 */
            @media (max-width: 600px) {
                .quiz-note-content .image-cloze-wrapper img {
                    max-height: 250px !important;
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
            .cloze-bottom-btn-group {
                position: sticky;
                width: 100%;
                display: flex;
                gap: 16px;
                justify-content: center;
                background: rgba(255,255,255,0.98);
                box-shadow: 0 -2px 12px rgba(0,0,0,0.08);
                padding: 0 0 16px 0;
                margin-top: 8px;
                border-radius: 18px 18px 0 0;
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
                
                .cloze-bottom-btn-group {
                    margin-bottom: 80px !important;
                    padding: 0 0 16px 0 !important;
                }
                
                /* 터치 피드백 */
                .cloze-action-btn:active {
                    transform: scale(0.96);
                    opacity: 0.8;
                }
                
                /* 스크롤 개선 */
                .cloze-dashboard-container {
                    overflow-y: auto;
                    -webkit-overflow-scrolling: touch;
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
                
                /* 탭 네비게이션 모바일 최적화 */
                .cloze-tab-nav {
                    gap: 6px;
                    margin: 12px 0;
                    justify-content: center;
                }
                
                .cloze-tab-btn {
                    flex: 1;
                    min-width: 0;
                    padding: 12px 10px !important;
                    font-size: 0.85em;
                    white-space: nowrap;
                    border-radius: 10px !important;
                    min-height: 44px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                
                /* 달력 컨테이너 모바일 최적화 */
                .cloze-calendar-container {
                    padding: 12px !important;
                    border-radius: 12px !important;
                    margin-bottom: 16px !important;
                }
                
                /* 월 네비게이션 모바일 최적화 */
                .cloze-month-nav {
                    gap: 8px !important;
                    margin-bottom: 16px !important;
                }
                
                .cloze-month-btn {
                    padding: 12px 14px !important;
                    font-size: 18px !important;
                    min-width: 48px;
                    min-height: 48px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                
                .cloze-today-btn {
                    padding: 12px 16px !important;
                    font-size: 14px !important;
                    min-height: 48px;
                }
                
                .cloze-month-title {
                    font-size: 1.2em !important;
                }
                
                /* 요일 헤더 모바일 최적화 */
                .cloze-week-header {
                    gap: 4px !important;
                    margin-bottom: 6px !important;
                    font-size: 0.85em;
                }
                
                .cloze-week-day {
                    padding: 6px 4px !important;
                    font-size: 0.9em;
                }
                
                /* 달력 그리드 모바일 최적화 */
                .cloze-calendar-grid {
                    gap: 4px !important;
                }
                
                /* 날짜 셀 모바일 최적화 */
                .cloze-calendar-day {
                    min-height: 60px !important;
                    padding: 8px 6px !important;
                    border-radius: 10px !important;
                    font-size: 0.9em;
                }
                
                .cloze-calendar-day:active {
                    transform: scale(0.95) !important;
                }
                
                .cloze-day-num {
                    font-size: 1em !important;
                    margin-bottom: 4px !important;
                }
                
                .cloze-day-progress {
                    font-size: 0.7em !important;
                    margin-top: 2px !important;
                }
                
                /* 목표 요약 박스 모바일 최적화 */
                .cloze-goals-summary {
                    padding: 12px !important;
                    border-radius: 10px !important;
                    margin-bottom: 16px !important;
                }
                
                .cloze-goals-summary > div {
                    grid-template-columns: 1fr !important;
                    gap: 10px !important;
                }
                
                /* 통계 섹션 모바일 최적화 */
                .cloze-dashboard-section {
                    margin-bottom: 16px !important;
                }
                
                .cloze-dashboard-section h4 {
                    font-size: 1.1em !important;
                    margin-bottom: 10px !important;
                }
                
                /* 템플릿 버튼 모바일 최적화 */
                .cloze-template-list {
                    gap: 8px !important;
                }
                
                .cloze-template-btn {
                    flex: 1;
                    min-height: 44px;
                    padding: 10px 14px !important;
                    font-size: 0.95em;
                }
                
                /* 테스트 아이템 모바일 최적화 */
                .cloze-test-item {
                    padding: 10px !important;
                    gap: 8px !important;
                }
                
                .cloze-test-item input[type="checkbox"] {
                    width: 24px !important;
                    height: 24px !important;
                }
                
                .cloze-test-item-text {
                    font-size: 0.95em;
                }
                
                /* 노트 아이템 모바일 최적화 */
                .cloze-note-item {
                    padding: 10px !important;
                    font-size: 0.95em;
                }
                
                /* 삭제 버튼 모바일 최적화 */
                .cloze-delete-btn {
                    padding: 8px 12px !important;
                    font-size: 0.9em;
                    min-height: 36px;
                }
                
                .cloze-delete-btn-inline {
                    padding: 6px 10px !important;
                    font-size: 0.85em;
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
                    
                    // 빈칸 span 생성
                    const clozeSpan = document.createElement('span');
                    clozeSpan.className = isGenuine ? 'genuine-cloze image-cloze' : 'pseudo-cloze image-cloze';
                    clozeSpan.setAttribute('data-show-state', 'hint');
                    clozeSpan.setAttribute('data-cloze-id', clozeId);
                    clozeSpan.setAttribute('data-answer', answer.trim());
                    clozeSpan.setAttribute('data-hint', hint?.trim() || '');
                    clozeSpan.style.cursor = 'pointer';
                    
                    // 이미지를 wrapper로 이동
                    const imgClone = img.cloneNode(true);
                    
                    // 원본 이미지를 wrapper로 교체
                    img.parentNode?.replaceChild(wrapper, img);
                    
                    wrapper.appendChild(imgClone);
                    wrapper.appendChild(clozeSpan);
                    
                    // 텍스트 노드에서 빈칸 패턴 제거 (첫 번째 매치만)
                    const remainingText = text.substring(0, match.index) + text.substring(match.index + fullMatch.length);
                    nextNode.textContent = remainingText;
                    
                    // 초기 상태 설정 (힌트 상태: 이미지 숨김)
                    this.updateImageClozeDisplay(clozeSpan, imgClone);
                    
                    // wrapper 전체에 클릭 이벤트 - 빈칸 토글 또는 이미지 확대
                    const wrapperClickHandler = (e) => {
                        const showState = clozeSpan.getAttribute('data-show-state');
                        
                        // 정답 상태이고 이미지를 클릭한 경우 확대
                        if (showState === 'answer' && e.target === imgClone) {
                            e.stopPropagation();
                            e.preventDefault();
                            const imgSrc = imgClone.src;
                            if (imgSrc) {
                                this.showImageZoom(imgSrc, '이미지 빈칸');
                            }
                        } else {
                            // 힌트 상태이거나 clozeSpan 클릭 시 토글
                            e.stopPropagation();
                            e.preventDefault();
                            this.toggleImageCloze(clozeSpan, imgClone);
                        }
                    };
                    
                    wrapper.addEventListener('click', wrapperClickHandler);
                    wrapper.addEventListener('touchend', wrapperClickHandler);
                    
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

    processClozes(element, context) {
        const clozeRegex = /\{\{c(\d+)::([^}]+?)(?:::([^}]+))?\}\}/g;
        
        // Step 1: 이미지 빈칸 처리 (먼저 처리하여 텍스트 노드에서 제거)
        this.processImageClozes(element);
        
        // Step 2: 텍스트 빈칸 처리
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);
        const nodesToProcess = [];
        let currentNode;

        while (currentNode = walker.nextNode()) {
            const text = currentNode.textContent || '';
            const matches = Array.from(text.matchAll(clozeRegex));
            if (matches.length > 0) {
                nodesToProcess.push({ node: currentNode, matches });
            }
        }
        
        // 타이머 생성 (빈칸이 있고, 타이머가 활성화되어 있으며, 아직 타이머가 없는 경우에만)
        // 퀴즈 모드에서는 자체 타이머를 사용하므로 제외
        if (nodesToProcess.length > 0 && this.settings.enableTimer && (!context || context.view !== 'quiz')) {
            const view = this.app.workspace.getActiveViewOfType(MarkdownView);
            if (view && view.getMode() === 'preview') {
                const container = view.contentEl.querySelector('.markdown-preview-view');
                if (container && !container.querySelector('.cloze-timer-container-local')) {
                    this.initializeTimer(container);
                }
            }
        }

        // 타이머는 퀴즈 모드에서만 작동하므로 여기서는 생성하지 않음

        nodesToProcess.forEach(({ node, matches }) => {
            const text = node.textContent || '';
            const fragment = document.createDocumentFragment();
            let lastIndex = 0;

            matches.forEach(match => {
                const [fullMatch, clozeId, answer, hint] = match;
                const startIndex = match.index;

                if (startIndex > lastIndex) {
                    fragment.appendChild(document.createTextNode(text.substring(lastIndex, startIndex)));
                }

                const clozeSpan = document.createElement('span');
                const clozeIdNum = parseInt(clozeId);
                const currentCard = this.getCurrentCardNumber();
                const isGenuine = clozeIdNum === currentCard;
                
                clozeSpan.className = isGenuine ? 'genuine-cloze' : 'pseudo-cloze';
                clozeSpan.setAttribute('data-show-state', 'hint');
                clozeSpan.setAttribute('data-cloze-id', clozeId);
                clozeSpan.setAttribute('data-answer', answer.trim());
                clozeSpan.setAttribute('data-hint', hint?.trim() || '');
                clozeSpan.style.display = 'inline-block';
                clozeSpan.style.position = 'relative';

                // 일반 텍스트 빈칸 처리
                if (this.settings.revealPseudoClozesByDefault && !isGenuine) {
                    clozeSpan.setAttribute('data-show-state', 'answer');
                } else if (answer.startsWith('#')) {
                    clozeSpan.setAttribute('data-answer', answer.substring(1).trim());
                    if (!isGenuine) {
                        clozeSpan.setAttribute('data-show-state', 'answer');
                    }
                }

                this.updateClozeDisplay(clozeSpan);
                
                // 클릭 및 터치 이벤트 지원 (모바일 호환)
                const toggleHandler = (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    this.toggleCloze(clozeSpan);
                };
                clozeSpan.addEventListener('click', toggleHandler);
                clozeSpan.addEventListener('touchend', toggleHandler);

                // 자동 뒤집기 설정 (genuine cloze만)
                if (this.settings.enableAutoReveal && isGenuine) {
                    setTimeout(() => {
                        if (clozeSpan.getAttribute('data-show-state') === 'hint') {
                            clozeSpan.setAttribute('data-show-state', 'answer');
                            this.updateClozeDisplay(clozeSpan);
                            if (this.settings.scrollToClozeOnToggle) {
                                this.scrollToCloze(clozeSpan);
                            }
                        }
                    }, this.settings.autoRevealDelay * 1000);
                }

                fragment.appendChild(clozeSpan);
                lastIndex = startIndex + fullMatch.length;
            });

            if (lastIndex < text.length) {
                fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
            }

            node.parentNode?.replaceChild(fragment, node);
        });

        const container = element.closest('.markdown-preview-view');
        if (container && !container.querySelector('.cloze-border-left')) {
            this.addBorderIndicators(container);
        }
        this.updateCardNumberIndicator();
    }

    // =====================================================
    // Part 6: 나머지 메서드들 & 모달 클래스들
    // =====================================================
    
// 퀴즈 하단 버튼 고정 스타일 안전하게 추가

// 퀴즈 하단 버튼 영역 북마크 스타일처럼 리뉴얼
i
// ...existing code...

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

    showImageZoom(imageUrl, altText) {
        // 전체 화면 오버레이 생성
        const overlay = document.body.createDiv({ cls: 'image-zoom-overlay' });
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
        overlay.style.zIndex = '10000';
        overlay.style.display = 'flex';
        overlay.style.flexDirection = 'column';
        overlay.style.justifyContent = 'center';
        overlay.style.alignItems = 'center';
        overlay.style.cursor = 'pointer';
        overlay.style.padding = '20px';
        overlay.style.boxSizing = 'border-box';
        overlay.style.overflow = 'auto';
        
        // 이미지 컨테이너 (터치 이벤트용)
        const imgContainer = overlay.createDiv({ cls: 'zoom-image-container' });
        imgContainer.style.position = 'relative';
        imgContainer.style.maxWidth = 'min(90vw, 800px)';
        imgContainer.style.maxHeight = '100%';
        imgContainer.style.width = 'auto';
        imgContainer.style.height = 'auto';
        imgContainer.style.display = 'flex';
        imgContainer.style.justifyContent = 'center';
        imgContainer.style.alignItems = 'center';
        imgContainer.style.touchAction = 'none';
        imgContainer.style.background = 'var(--background-primary)';
        imgContainer.style.borderRadius = '12px';
        imgContainer.style.padding = '15px';
        imgContainer.style.cursor = 'move';
        imgContainer.style.boxShadow = '0 10px 40px rgba(0, 0, 0, 0.3)';
        
        // 확대된 이미지
        const zoomedImg = imgContainer.createEl('img', {
            attr: {
                src: imageUrl,
                alt: altText
            }
        });
        zoomedImg.style.maxWidth = '100%';
        zoomedImg.style.maxHeight = '100%';
        zoomedImg.style.width = 'auto';
        zoomedImg.style.height = 'auto';
        zoomedImg.style.objectFit = 'contain';
        zoomedImg.style.borderRadius = '8px';
        zoomedImg.style.transition = 'transform 0.1s ease-out';
        zoomedImg.style.cursor = 'move';
        zoomedImg.style.userSelect = 'none';
        
        // 핀치 줌 & 드래그 변수
        let scale = 1;
        let posX = 0;
        let posY = 0;
        let lastPosX = 0;
        let lastPosY = 0;
        let isDragging = false;
        let startDistance = 0;
        let startScale = 1;
        
        // 터치 시작
        imgContainer.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                // 핀치 줌 시작
                const touch1 = e.touches[0];
                const touch2 = e.touches[1];
                startDistance = Math.hypot(
                    touch1.clientX - touch2.clientX,
                    touch1.clientY - touch2.clientY
                );
                startScale = scale;
                e.preventDefault();
            } else if (e.touches.length === 1) {
                // 드래그 시작
                isDragging = true;
                lastPosX = e.touches[0].clientX - posX;
                lastPosY = e.touches[0].clientY - posY;
            }
        });
        
        // 터치 이동
        imgContainer.addEventListener('touchmove', (e) => {
            if (e.touches.length === 2) {
                // 핀치 줌
                const touch1 = e.touches[0];
                const touch2 = e.touches[1];
                const distance = Math.hypot(
                    touch1.clientX - touch2.clientX,
                    touch1.clientY - touch2.clientY
                );
                scale = Math.max(1, Math.min(4, startScale * (distance / startDistance)));
                zoomedImg.style.transform = `translate(${posX}px, ${posY}px) scale(${scale})`;
                e.preventDefault();
            } else if (e.touches.length === 1 && isDragging) {
                // 드래그
                posX = e.touches[0].clientX - lastPosX;
                posY = e.touches[0].clientY - lastPosY;
                zoomedImg.style.transform = `translate(${posX}px, ${posY}px) scale(${scale})`;
                e.preventDefault();
            }
        });
        
        // 터치 종료
        imgContainer.addEventListener('touchend', (e) => {
            if (e.touches.length === 0) {
                isDragging = false;
            }
        });
        
        // 마우스 휠 줌 (PC)
        imgContainer.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            scale = Math.max(1, Math.min(4, scale * delta));
            zoomedImg.style.transform = `translate(${posX}px, ${posY}px) scale(${scale})`;
        });
        
        // 마우스 드래그 (PC)
        imgContainer.addEventListener('mousedown', (e) => {
            if (e.button === 0) {
                isDragging = true;
                lastPosX = e.clientX - posX;
                lastPosY = e.clientY - posY;
                imgContainer.style.cursor = 'grabbing';
                e.preventDefault();
            }
        });
        
        imgContainer.addEventListener('mousemove', (e) => {
            if (isDragging && scale > 1) {
                posX = e.clientX - lastPosX;
                posY = e.clientY - lastPosY;
                zoomedImg.style.transform = `translate(${posX}px, ${posY}px) scale(${scale})`;
                e.preventDefault();
            }
        });
        
        imgContainer.addEventListener('mouseup', () => {
            isDragging = false;
            imgContainer.style.cursor = 'move';
        });
        
        imgContainer.addEventListener('mouseleave', () => {
            isDragging = false;
            imgContainer.style.cursor = 'move';
        });
        
        // 더블클릭으로 줌 토글
        let lastTap = 0;
        const handleDoubleTap = () => {
            if (scale > 1) {
                scale = 1;
                posX = 0;
                posY = 0;
            } else {
                scale = 2;
            }
            zoomedImg.style.transform = `translate(${posX}px, ${posY}px) scale(${scale})`;
        };
        
        zoomedImg.addEventListener('dblclick', handleDoubleTap);
        
        zoomedImg.addEventListener('touchend', (e) => {
            const currentTime = new Date().getTime();
            const tapLength = currentTime - lastTap;
            if (tapLength < 300 && tapLength > 0) {
                handleDoubleTap();
                e.preventDefault();
            }
            lastTap = currentTime;
        });
        
        // 닫기 버튼
        const closeBtn = overlay.createEl('button', {
            text: '✕',
            cls: 'image-zoom-close'
        });
        closeBtn.style.position = 'absolute';
        closeBtn.style.top = '20px';
        closeBtn.style.right = '20px';
        closeBtn.style.fontSize = '32px';
        closeBtn.style.color = 'white';
        closeBtn.style.background = 'rgba(0, 0, 0, 0.5)';
        closeBtn.style.border = 'none';
        closeBtn.style.borderRadius = '50%';
        closeBtn.style.width = '50px';
        closeBtn.style.height = '50px';
        closeBtn.style.cursor = 'pointer';
        closeBtn.style.display = 'flex';
        closeBtn.style.alignItems = 'center';
        closeBtn.style.justifyContent = 'center';
        closeBtn.style.transition = 'background 0.2s';
        closeBtn.style.zIndex = '10001';
        
        closeBtn.addEventListener('mouseenter', () => {
            closeBtn.style.background = 'rgba(255, 255, 255, 0.2)';
        });
        
        closeBtn.addEventListener('mouseleave', () => {
            closeBtn.style.background = 'rgba(0, 0, 0, 0.5)';
        });
        
        // 줌 컨트롤 버튼
        const zoomControls = overlay.createDiv({ cls: 'zoom-controls' });
        zoomControls.style.position = 'absolute';
        zoomControls.style.top = '80px';
        zoomControls.style.right = '20px';
        zoomControls.style.display = 'flex';
        zoomControls.style.flexDirection = 'column';
        zoomControls.style.gap = '10px';
        zoomControls.style.zIndex = '10001';
        
        const createZoomButton = (text, title) => {
            const btn = zoomControls.createEl('button', { text });
            btn.title = title;
            btn.style.cssText = `
                width: 45px;
                height: 45px;
                font-size: 24px;
                color: white;
                background: rgba(0, 0, 0, 0.5);
                border: none;
                border-radius: 50%;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: background 0.2s;
            `;
            btn.addEventListener('mouseenter', () => {
                btn.style.background = 'rgba(255, 255, 255, 0.2)';
            });
            btn.addEventListener('mouseleave', () => {
                btn.style.background = 'rgba(0, 0, 0, 0.5)';
            });
            return btn;
        };
        
        const zoomInBtn = createZoomButton('+', '확대');
        const zoomOutBtn = createZoomButton('−', '축소');
        const resetBtn = createZoomButton('⟲', '원래 크기');
        
        zoomInBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            scale = Math.min(4, scale * 1.2);
            zoomedImg.style.transform = `translate(${posX}px, ${posY}px) scale(${scale})`;
        });
        
        zoomOutBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            scale = Math.max(1, scale * 0.8);
            if (scale === 1) {
                posX = 0;
                posY = 0;
            }
            zoomedImg.style.transform = `translate(${posX}px, ${posY}px) scale(${scale})`;
        });
        
        resetBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            scale = 1;
            posX = 0;
            posY = 0;
            zoomedImg.style.transform = `translate(${posX}px, ${posY}px) scale(${scale})`;
        });
        
        // 닫기 이벤트
        const closeOverlay = () => {
            overlay.remove();
            document.removeEventListener('keydown', handleEscape);
        };
        
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeOverlay();
        });
        
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeOverlay();
            }
        });
        
        imgContainer.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                e.preventDefault();
                closeOverlay();
            }
        };
        document.addEventListener('keydown', handleEscape, true);
    }

    updateImageClozeDisplay(clozeSpan, imgElement) {
        const showState = clozeSpan.getAttribute('data-show-state');
        const answer = clozeSpan.getAttribute('data-answer') || '';
        const hint = clozeSpan.getAttribute('data-hint') || '';
        const isGenuine = clozeSpan.classList.contains('genuine-cloze');
        
        if (showState === 'answer') {
            // 정답 표시: 이미지 보이기 + 투명 배경
            imgElement.style.display = 'block';
            imgElement.style.visibility = 'visible';
            imgElement.style.cursor = 'zoom-in';
            clozeSpan.style.background = 'transparent';
            clozeSpan.style.color = 'transparent';
            clozeSpan.style.position = 'absolute';
            clozeSpan.style.top = '0';
            clozeSpan.style.left = '0';
            clozeSpan.style.width = '100%';
            clozeSpan.style.height = '100%';
            clozeSpan.style.cursor = 'pointer';
            clozeSpan.style.zIndex = '1';
            clozeSpan.textContent = '';
        } else {
            // 힌트 표시: 이미지 숨기기 + 황금색 배경
            imgElement.style.display = 'none';
            imgElement.style.visibility = 'hidden';
            imgElement.style.cursor = 'default';
            clozeSpan.style.background = '#FF8C00';
            clozeSpan.style.color = '#000000';
            clozeSpan.style.position = 'static';
            clozeSpan.style.padding = '8px 12px';
            clozeSpan.style.borderRadius = '4px';
            clozeSpan.style.display = 'inline-block';
            clozeSpan.style.minWidth = '100px';
            clozeSpan.style.textAlign = 'center';
            clozeSpan.style.cursor = 'pointer';
            clozeSpan.style.zIndex = 'auto';
            
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

    async getWeekFilePath(year, month, weekNum) {
        const monthStr = String(month + 1).padStart(2, '0');
        const folderPath = `📅 학습일정/${year}/${monthStr}`;
        const fileName = `${year}년 ${month + 1}월 ${weekNum}주차 일정.md`;
        return `${folderPath}/${fileName}`;
    }

    async readWeekFile(year, month, weekNum) {
        const filePath = await this.getWeekFilePath(year, month, weekNum);
        
        try {
            const file = this.app.vault.getAbstractFileByPath(filePath);
            if (file instanceof TFile) {
                const content = await this.app.vault.read(file);
                return this.parseWeekContent(content);
            }
        } catch (err) {
            console.log('주차 파일 읽기 실패:', err);
        }
        
        return { routines: [], tasks: [], notes: [] };
    }

    parseWeekContent(content) {
        const data = { routines: [], tasks: [], notes: [] };
        
        const lines = content.split('\n');
        let currentSection = '';
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            if (line.startsWith('## ✅') || line.startsWith('## 체크리스트')) {
                currentSection = 'routines';
            } else if (line.startsWith('## 📋') || line.startsWith('## 학습 일정')) {
                currentSection = 'tasks';
            } else if (line.startsWith('## 💬') || line.startsWith('## 📝') || line.startsWith('## 학습 메모')) {
                currentSection = 'notes';
            } else if (currentSection === 'routines' && (line.startsWith('- [ ]') || line.startsWith('- [x]'))) {
                const checked = line.startsWith('- [x]');
                const text = line.substring(6).trim();
                data.routines.push({ text, checked });
            } else if (currentSection === 'tasks' && line.startsWith('**') && line.includes('**')) {
                const hourMatch = line.match(/\*\*(\d+):(\d+)\*\*/);
                if (hourMatch) {
                    const hour = parseInt(hourMatch[1]);
                    const minute = parseInt(hourMatch[2]);
                    
                    i++;
                    while (i < lines.length && lines[i].trim().startsWith('- ')) {
                        const taskText = lines[i].trim().substring(2);
                        data.tasks.push({ hour, minute, text: taskText });
                        i++;
                    }
                    i--;
                }
            } else if (currentSection === 'notes' && line.startsWith('- ')) {
                const text = line.substring(2).trim();
                data.notes.push({ text });
            }
        }
        
        return data;
    }

    async writeWeekFile(year, month, weekNum, startDay, endDay, data) {
        const filePath = await this.getWeekFilePath(year, month, weekNum);
        
        // 폴더 생성
        const folderPath = filePath.substring(0, filePath.lastIndexOf('/'));
        const folder = this.app.vault.getAbstractFileByPath(folderPath);
        if (!folder) {
            await this.app.vault.createFolder(folderPath);
        }
        
        const content = this.generateWeekContent(year, month, weekNum, startDay, endDay, data);
        
        try {
            const file = this.app.vault.getAbstractFileByPath(filePath);
            if (file instanceof TFile) {
                await this.app.vault.modify(file, content);
            } else {
                await this.app.vault.create(filePath, content);
            }
        } catch (err) {
            console.error('주차 파일 쓰기 실패:', err);
            new Notice('파일 저장 실패!');
        }
    }

    generateWeekContent(year, month, weekNum, startDay, endDay, data) {
        const completedCount = data.routines?.filter(r => r.checked).length || 0;
        const totalCount = data.routines?.length || 0;
        const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
        
        let content = `---
date: ${year}-${String(month + 1).padStart(2, '0')}
week: ${weekNum}
period: ${month + 1}월 ${startDay}~${endDay}일
routines_completed: ${completedCount}
routines_total: ${totalCount}
progress: ${percent}%
---

# 📚 ${year}년 ${month + 1}월 ${weekNum}주차 학습 계획

> 📅 기간: ${month + 1}월 ${startDay}~${endDay}일
> 📊 진행률: ${percent}%

## ✅ 체크리스트

`;
        
        if (data.routines && data.routines.length > 0) {
            data.routines.forEach(routine => {
                content += `- [${routine.checked ? 'x' : ' '}] ${routine.text}\n`;
            });
        } else {
            content += `- [ ] 학습 목표를 입력하세요\n- [ ] \n- [ ] \n`;
        }
        
        content += `\n## 📋 학습 일정\n\n`;
        
        if (data.tasks && data.tasks.length > 0) {
            const tasksByTime = {};
            data.tasks.forEach(task => {
                const key = `${task.hour}:${String(task.minute || 0).padStart(2, '0')}`;
                if (!tasksByTime[key]) tasksByTime[key] = [];
                tasksByTime[key].push(task.text);
            });
            
            Object.keys(tasksByTime).sort().forEach(time => {
                content += `**${time}**\n`;
                tasksByTime[time].forEach(text => {
                    content += `- ${text}\n`;
                });
                content += `\n`;
            });
        } else {
            content += `(일정 없음)\n`;
        }
        
        content += `\n## 📝 학습 메모\n\n`;
        
        if (data.notes && data.notes.length > 0) {
            data.notes.forEach(note => {
                const noteText = note.text || note;
                content += `- ${noteText}\n`;
            });
        } else {
            content += `이번 주 학습 내용을 자유롭게 기록하세요.\n\n`;
        }
        
        content += `\n## 🎯 다음 주 목표\n\n- \n\n---\n*Updated: ${new Date().toISOString().split('T')[0]}*\n`;
        
        return content;
    }

    async getDailyFilePath(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        
        const folderPath = `📅 학습일정/${year}/${month}`;
        return `${folderPath}/${dateStr}.md`;
    }

    async readDailyFile(date) {
        const filePath = await this.getDailyFilePath(date);
        
        try {
            const file = this.app.vault.getAbstractFileByPath(filePath);
            if (file instanceof TFile) {
                const content = await this.app.vault.read(file);
                return this.parseDailyContent(content);
            }
        } catch (err) {
            console.log('일일 파일 읽기 실패:', err);
        }
        
        return { routines: [], tasks: [], notes: [] };
    }

    parseDailyContent(content) {
        const data = { routines: [], tasks: [], notes: [] };
        
        const lines = content.split('\n');
        let currentSection = '';
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            if (line.startsWith('## ✅') || line.startsWith('## 체크리스트')) {
                currentSection = 'routines';
            } else if (line.startsWith('## 📋') || line.startsWith('## 시간별')) {
                currentSection = 'tasks';
            } else if (line.startsWith('## 💬') || line.startsWith('## 📝') || line.startsWith('## 메모')) {
                currentSection = 'notes';
            } else if (currentSection === 'routines' && (line.startsWith('- [ ]') || line.startsWith('- [x]'))) {
                const checked = line.startsWith('- [x]');
                const text = line.substring(6).trim();
                data.routines.push({ text, checked });
            } else if (currentSection === 'tasks' && line.startsWith('**') && line.includes('**')) {
                const hourMatch = line.match(/\*\*(\d+) (AM|PM)\*\*/);
                if (hourMatch) {
                    let hour = parseInt(hourMatch[1]);
                    if (hourMatch[2] === 'PM' && hour !== 12) hour += 12;
                    if (hourMatch[2] === 'AM' && hour === 12) hour = 0;
                    
                    i++;
                    while (i < lines.length && lines[i].trim().startsWith('- ')) {
                        const taskText = lines[i].trim().substring(2);
                        data.tasks.push({ hour, text: taskText });
                        i++;
                    }
                    i--;
                }
            } else if (currentSection === 'notes' && line.startsWith('- ')) {
                const text = line.substring(2).trim();
                data.notes.push({ text });
            }
        }
        
        return data;
    }

    async writeDailyFile(date, data) {
        const filePath = await this.getDailyFilePath(date);
        
        const folderPath = filePath.substring(0, filePath.lastIndexOf('/'));
        const folder = this.app.vault.getAbstractFileByPath(folderPath);
        if (!folder) {
            await this.app.vault.createFolder(folderPath);
        }
        
        const content = this.generateDailyContent(date, data);
        
        try {
            const file = this.app.vault.getAbstractFileByPath(filePath);
            if (file instanceof TFile) {
                await this.app.vault.modify(file, content);
            } else {
                await this.app.vault.create(filePath, content);
            }
        } catch (err) {
            console.error('일일 파일 쓰기 실패:', err);
            new Notice('파일 저장 실패!');
        }
    }

    generateDailyContent(date, data) {
        const days = ['일', '월', '화', '수', '목', '금', '토'];
        const dateStr = `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${days[date.getDay()]})`;
        
        const completedCount = data.routines?.filter(r => r.checked).length || 0;
        const totalCount = data.routines?.length || 0;
        
        let content = `---
date: ${this.formatDate(date)}
routines_completed: ${completedCount}
routines_total: ${totalCount}
---

# ${dateStr}

## ✅ 체크리스트
`;
        
        if (data.routines && data.routines.length > 0) {
            data.routines.forEach(routine => {
                content += `- [${routine.checked ? 'x' : ' '}] ${routine.text}\n`;
            });
        } else {
            content += `(체크리스트 없음)\n`;
        }
        
        content += `\n## 📋 시간별 일정\n`;
        
        if (data.tasks && data.tasks.length > 0) {
            const tasksByHour = {};
            data.tasks.forEach(task => {
                if (!tasksByHour[task.hour]) tasksByHour[task.hour] = [];
                tasksByHour[task.hour].push(task.text);
            });
            
            Object.keys(tasksByHour).sort((a, b) => parseInt(a) - parseInt(b)).forEach(hour => {
                const h = parseInt(hour);
                const ampm = h < 12 ? 'AM' : 'PM';
                const displayHour = h === 0 ? 12 : (h > 12 ? h - 12 : h);
                content += `**${displayHour} ${ampm}**\n`;
                tasksByHour[hour].forEach(text => {
                    content += `- ${text}\n`;
                });
                content += `\n`;
            });
        } else {
            content += `(일정 없음)\n`;
        }
        
        content += `\n## 📝 학습 메모\n`;
        
        if (data.notes && data.notes.length > 0) {
            data.notes.forEach(note => {
                content += `- ${note.text || note}\n`;
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

    async getMonthlyFilePath(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        
        const folderPath = `📅 학습일정/${year}`;
        return `${folderPath}/${year}년 ${parseInt(month)}월 학습 계획.md`;
    }

    async readMonthlyFile(date) {
        const filePath = await this.getMonthlyFilePath(date);
        
        try {
            const file = this.app.vault.getAbstractFileByPath(filePath);
            if (file instanceof TFile) {
                const content = await this.app.vault.read(file);
                return this.parseMonthlyContent(content);
            }
        } catch (err) {
            console.log('월간 파일 읽기 실패:', err);
        }
        
        return { routines: [], goals: [], reviews: [], notes: [] };
    }

    parseMonthlyContent(content) {
        const data = { routines: [], goals: [], reviews: [], notes: [] };
        
        const lines = content.split('\n');
        let currentSection = '';
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            if (line.startsWith('## ✅') || line.startsWith('## 학습 체크리스트')) {
                currentSection = 'routines';
            } else if (line.startsWith('## 🎯') || line.startsWith('## 목표')) {
                currentSection = 'goals';
            } else if (line.startsWith('## 📊') || line.startsWith('## 회고')) {
                currentSection = 'reviews';
            } else if (line.startsWith('## 📝') || line.startsWith('## 메모')) {
                currentSection = 'notes';
            } else if (currentSection === 'routines' && (line.startsWith('- [ ]') || line.startsWith('- [x]'))) {
                const checked = line.startsWith('- [x]');
                const text = line.substring(6).trim();
                data.routines.push({ text, checked });
            } else if (currentSection === 'goals' && (line.startsWith('- [ ]') || line.startsWith('- [x]'))) {
                const checked = line.startsWith('- [x]');
                const text = line.substring(6).trim();
                data.goals.push({ text, checked });
            } else if (currentSection === 'reviews' && line.startsWith('- ')) {
                const text = line.substring(2).trim();
                data.reviews.push({ text });
            } else if (currentSection === 'notes' && line.startsWith('- ')) {
                const text = line.substring(2).trim();
                data.notes.push({ text });
            }
        }
        
        return data;
    }

    async writeMonthlyFile(date, data) {
        const filePath = await this.getMonthlyFilePath(date);
        
        const folderPath = filePath.substring(0, filePath.lastIndexOf('/'));
        const folder = this.app.vault.getAbstractFileByPath(folderPath);
        if (!folder) {
            await this.app.vault.createFolder(folderPath);
        }
        
        const content = this.generateMonthlyContent(date, data);
        
        try {
            const file = this.app.vault.getAbstractFileByPath(filePath);
            if (file instanceof TFile) {
                await this.app.vault.modify(file, content);
            } else {
                await this.app.vault.create(filePath, content);
            }
        } catch (err) {
            console.error('월간 파일 쓰기 실패:', err);
            new Notice('파일 저장 실패!');
        }
    }

    generateMonthlyContent(date, data) {
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        
        const routinesCompleted = data.routines?.filter(r => r.checked).length || 0;
        const routinesTotal = data.routines?.length || 0;
        const completedCount = data.goals?.filter(g => g.checked).length || 0;
        const totalCount = data.goals?.length || 0;
        const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
        
        let content = `---
date: ${year}-${String(month).padStart(2, '0')}
routines_completed: ${routinesCompleted}
routines_total: ${routinesTotal}
goals_completed: ${completedCount}
goals_total: ${totalCount}
progress: ${percent}%
---

# 📚 ${year}년 ${month}월 학습 계획

> 📊 진행률: ${percent}%

## ✅ 학습 체크리스트

`;
        
        if (data.routines && data.routines.length > 0) {
            data.routines.forEach(routine => {
                content += `- [${routine.checked ? 'x' : ' '}] ${routine.text}\n`;
            });
        } else {
            content += `- [ ] 학습 체크리스트를 입력하세요\n`;
        }
        
        content += `\n## 🎯 이번 달 목표\n\n`;
        
        if (data.goals && data.goals.length > 0) {
            data.goals.forEach(goal => {
                content += `- [${goal.checked ? 'x' : ' '}] ${goal.text}\n`;
            });
        } else {
            content += `- [ ] 이번 달 목표를 입력하세요\n- [ ] \n- [ ] \n`;
        }
        
        content += `\n## 📊 월간 회고\n\n`;
        
        if (data.reviews && data.reviews.length > 0) {
            data.reviews.forEach(review => {
                content += `- ${review.text || review}\n`;
            });
        } else {
            content += `(회고 없음)\n`;
        }
        
        content += `\n## 📝 메모\n\n`;
        
        if (data.notes && data.notes.length > 0) {
            data.notes.forEach(note => {
                content += `- ${note.text || note}\n`;
            });
        } else {
            content += `(메모 없음)\n`;
        }
        
        content += `\n## 🎯 다음 달 계획\n\n- \n\n---\n*Updated: ${new Date().toISOString().split('T')[0]}*\n`;
        
        return content;
    }

    onunload() {
        this.cleanupTimers();
        document.getElementById('enhanced-cloze-styles')?.remove();
        document.querySelectorAll('.cloze-card-number-indicator').forEach(el => el.remove());
        console.log('Enhanced Cloze plugin unloaded');
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
        exampleDiv.createEl('div', { text: '📚 폴더별 관리 예시:', attr: { style: 'font-weight: 600; margin-bottom: 10px;' }});
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

// 빈칸 노트 생성 모달
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

        contentEl.createEl('h2', { text: '📄 새 빈칸 노트 만들기' });

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

// 빈칸 생성 모달
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

        contentEl.createEl('h2', { text: '🎯 빈칸 만들기' });

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

// 빈칸 관리 모달
class ClozeManagerModal extends Modal {
    constructor(app, clozes, plugin) {
        super(app);
        this.clozes = clozes;
        this.plugin = plugin;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('cloze-manager-content');

        contentEl.createEl('h2', { text: '📋 빈칸 관리' });

        if (this.clozes.length === 0) {
            contentEl.createEl('div', { 
                text: '이 노트에는 빈칸이 없습니다.',
                cls: 'cloze-empty-message'
            });
            return;
        }

        // 통계 표시
        const grouped = {};
        this.clozes.forEach(cloze => {
            if (!grouped[cloze.number]) {
                grouped[cloze.number] = [];
            }
            grouped[cloze.number].push(cloze);
        });

        const stats = contentEl.createDiv('cloze-stats');
        
        const totalStat = stats.createDiv('cloze-stat-item');
        totalStat.createEl('div', { text: this.clozes.length.toString(), cls: 'cloze-stat-number' });
        totalStat.createEl('div', { text: '총 빈칸', cls: 'cloze-stat-label' });

        const cardsStat = stats.createDiv('cloze-stat-item');
        cardsStat.createEl('div', { text: Object.keys(grouped).length.toString(), cls: 'cloze-stat-number' });
        cardsStat.createEl('div', { text: '카드 수', cls: 'cloze-stat-label' });

        const currentStat = stats.createDiv('cloze-stat-item');
        currentStat.createEl('div', { text: this.plugin.settings.currentCardNumber.toString(), cls: 'cloze-stat-number' });
        currentStat.createEl('div', { text: '현재 카드', cls: 'cloze-stat-label' });

        // 카드별 빈칸 리스트
        const container = contentEl.createDiv('cloze-list-container');
        
        Object.keys(grouped).sort((a, b) => parseInt(a) - parseInt(b)).forEach(cardNum => {
            const cardGroup = container.createDiv('cloze-card-group');
            
            const header = cardGroup.createDiv('cloze-card-header');
            const titleArea = header.createDiv();
            titleArea.createEl('span', { text: `카드 ${cardNum}`, cls: 'cloze-card-title' });
            titleArea.createEl('span', { text: ` (${grouped[cardNum].length}개)`, cls: 'cloze-card-count' });
            
            const actions = header.createDiv('cloze-card-actions');
            const viewBtn = actions.createEl('button', { text: '이 카드 보기', cls: 'mod-cta' });
            viewBtn.addEventListener('click', () => {
                this.plugin.settings.currentCardNumber = parseInt(cardNum);
                this.plugin.saveSettings();
                new Notice(`Card ${cardNum}로 이동했습니다`);
                this.close();
            });

            grouped[cardNum].forEach((cloze, idx) => {
                const clozeItem = cardGroup.createDiv('cloze-item');
                
                clozeItem.createEl('span', { text: `${idx + 1}`, cls: 'cloze-item-number' });
                
                const content = clozeItem.createDiv('cloze-item-content');
                content.createEl('span', { text: cloze.answer, cls: 'cloze-answer' });
                
                if (cloze.hint) {
                    content.createEl('span', { 
                        text: `[${cloze.hint}]`, 
                        cls: 'cloze-hint-display' 
                    });
                }
            });
        });

        // 닫기 버튼
        const buttonContainer = contentEl.createDiv('cloze-modal-buttons');
        const closeBtn = buttonContainer.createEl('button', { text: '닫기', cls: 'mod-cta' });
        closeBtn.addEventListener('click', () => {
            this.close();
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// =====================================================
// 설정 탭
// =====================================================
class EnhancedClozeSettingTab extends PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        const { containerEl } = this;
        containerEl.empty();
        
        containerEl.createEl('h1', { text: 'Enhanced Cloze Settings' });

        // ============ 학습 설정 ============
        containerEl.createEl('h2', { text: '📚 학습 설정' });

        new Setting(containerEl)
            .setName('Current card number (Global)')
            .setDesc('전역 카드 번호 (폴더가 없는 노트용)')
            .addText(text => text
                .setPlaceholder('1')
                .setValue(String(this.plugin.settings.currentCardNumber))
                .onChange(async (value) => {
                    const num = parseInt(value);
                    if (!isNaN(num) && num > 0) {
                        this.plugin.settings.currentCardNumber = num;
                        await this.plugin.saveSettings();
                    }
                }));

        new Setting(containerEl)
            .setName('Scroll to cloze on toggle')
            .setDesc('빈칸을 공개할 때 자동으로 스크롤')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.scrollToClozeOnToggle)
                .onChange(async (value) => {
                    this.plugin.settings.scrollToClozeOnToggle = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Animate scroll')
            .setDesc('부드러운 스크롤 애니메이션 사용')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.animateScroll)
                .onChange(async (value) => {
                    this.plugin.settings.animateScroll = value;
                    await this.plugin.saveSettings();
                }));

        // ============ 폴더 관리 (새로 추가) ============
        containerEl.createEl('h2', { text: '📁 폴더 관리' });

        new Setting(containerEl)
            .setName('Main cloze folder')
            .setDesc('빈칸 노트를 저장할 메인 폴더')
            .addText(text => text
                .setPlaceholder('Cloze Cards')
                .setValue(this.plugin.settings.clozeFolder)
                .onChange(async (value) => {
                    if (value && value.trim()) {
                        this.plugin.settings.clozeFolder = value.trim();
                        await this.plugin.saveSettings();
                    }
                }));

        // 폴더 목록 표시 및 관리
        const foldersContainer = containerEl.createDiv({ cls: 'cloze-folders-container' });
        foldersContainer.style.cssText = 'margin: 20px 0; padding: 15px; background: var(--background-secondary); border-radius: 8px;';
        
        foldersContainer.createEl('h3', { text: '하위 폴더 목록' });
        
        const folderList = foldersContainer.createDiv({ cls: 'folder-list' });
        folderList.style.cssText = 'margin: 10px 0;';
        
        const renderFolders = () => {
            folderList.empty();
            
            if (!this.plugin.settings.clozeFolders || this.plugin.settings.clozeFolders.length === 0) {
                folderList.createEl('p', { text: '하위 폴더가 없습니다.', cls: 'setting-item-description' });
                return;
            }
            
            this.plugin.settings.clozeFolders.forEach((folder, index) => {
                const folderItem = folderList.createDiv({ cls: 'folder-item' });
                folderItem.style.cssText = 'display: flex; align-items: center; gap: 10px; padding: 8px; background: var(--background-primary); margin-bottom: 8px; border-radius: 4px;';
                
                const folderName = folderItem.createEl('span', { text: `📁 ${folder}` });
                folderName.style.cssText = 'flex: 1; font-weight: 500;';
                
                const deleteBtn = folderItem.createEl('button', { text: '🗑️ 삭제' });
                deleteBtn.style.cssText = 'padding: 4px 12px; font-size: 12px; cursor: pointer;';
                deleteBtn.onclick = async () => {
                    if (confirm(`"${folder}" 폴더와 모든 내용을 삭제하시겠습니까?\n\n경고: 폴더 내 모든 파일이 삭제됩니다!`)) {
                        const folderPath = `${this.plugin.settings.clozeFolder}/${folder}`;
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
                        this.plugin.settings.clozeFolders = this.plugin.settings.clozeFolders.filter((_, i) => i !== index);
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
            
            if (this.plugin.settings.clozeFolders.includes(folderName)) {
                new Notice('❌ 이미 존재하는 폴더입니다!');
                return;
            }
            
            // 실제 폴더 생성 먼저 시도
            const mainFolder = this.plugin.settings.clozeFolder;
            const folderPath = `${mainFolder}/${folderName}`;
            
            try {
                // 메인 폴더 존재 확인
                const mainFolderFile = this.app.vault.getAbstractFileByPath(mainFolder);
                if (!mainFolderFile) {
                    try {
                        await this.app.vault.createFolder(mainFolder);
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
                this.plugin.settings.clozeFolders.push(folderName);
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

        // ============ 타이머 설정 (새로 추가) ============
        containerEl.createEl('h2', { text: '⏱️ 타이머 설정' });

        new Setting(containerEl)
            .setName('Enable timer')
            .setDesc('각 카드에 학습 타이머를 표시합니다')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableTimer)
                .onChange(async (value) => {
                    this.plugin.settings.enableTimer = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Default timer duration')
            .setDesc('타이머 기본 시간 (초)')
            .addText(text => text
                .setPlaceholder('30')
                .setValue(String(this.plugin.settings.defaultTimerDuration))
                .onChange(async (value) => {
                    const num = parseInt(value);
                    if (!isNaN(num) && num >= 5 && num <= 300) {
                        this.plugin.settings.defaultTimerDuration = num;
                        await this.plugin.saveSettings();
                    }
                }));

        new Setting(containerEl)
            .setName('Timer warning threshold')
            .setDesc('경고 상태로 전환되는 남은 시간 (초)')
            .addSlider(slider => slider
                .setLimits(3, 30, 1)
                .setValue(this.plugin.settings.timerWarningThreshold)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.timerWarningThreshold = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Auto start timer')
            .setDesc('카드 열람 시 자동으로 타이머 시작')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.autoStartTimer)
                .onChange(async (value) => {
                    this.plugin.settings.autoStartTimer = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Enable vibration')
            .setDesc('모바일에서 타이머 만료 시 진동 피드백')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableVibration)
                .onChange(async (value) => {
                    this.plugin.settings.enableVibration = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Timer position')
            .setDesc('타이머 표시 위치')
            .addDropdown(dropdown => dropdown
                .addOption('top', '상단')
                .addOption('bottom', '하단')
                .addOption('floating', '플로팅')
                .setValue(this.plugin.settings.timerPosition)
                .onChange(async (value) => {
                    this.plugin.settings.timerPosition = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Auto reveal on timeout')
            .setDesc('타이머가 종료되면 자동으로 모든 빈칸을 공개합니다')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableAutoRevealOnTimeout)
                .onChange(async (value) => {
                    this.plugin.settings.enableAutoRevealOnTimeout = value;
                    await this.plugin.saveSettings();
                }));

        // 자동 뒤집기 설정 (새로 추가)
        containerEl.createEl('h3', { text: '🔄 자동 뒤집기' });
        
        new Setting(containerEl)
            .setName('Enable auto reveal')
            .setDesc('시간이 지나면 자동으로 빈칸이 뒤집어집니다')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableAutoReveal)
                .onChange(async (value) => {
                    this.plugin.settings.enableAutoReveal = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Auto reveal delay')
            .setDesc('빈칸이 자동으로 공개되기까지의 시간 (초)')
            .addSlider(slider => slider
                .setLimits(1, 30, 1)
                .setValue(this.plugin.settings.autoRevealDelay)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.autoRevealDelay = value;
                    await this.plugin.saveSettings();
                }));

        // 폴더별 타이머 시간 설정 (새로 추가)
        containerEl.createEl('h3', { text: '📁 폴더별 타이머 시간' });
        
        const currentFolder = this.plugin.getCurrentFolder();
        if (currentFolder) {
            const currentDuration = this.plugin.getTimerDuration();
            
            new Setting(containerEl)
                .setName(`현재 폴더: ${currentFolder.split('/').pop()}`)
                .setDesc(`이 폴더의 타이머 시간 (초, 5-300). 비워두면 기본값(${this.plugin.settings.defaultTimerDuration}초) 사용`)
                .addText(text => text
                    .setPlaceholder(String(this.plugin.settings.defaultTimerDuration))
                    .setValue(String(currentDuration))
                    .onChange(async (value) => {
                        const num = parseInt(value);
                        if (!isNaN(num) && num >= 5 && num <= 300) {
                            await this.plugin.setTimerDuration(num);
                        }
                    }))
                .addExtraButton(button => button
                    .setIcon('reset')
                    .setTooltip('기본값으로 되돌리기')
                    .onClick(async () => {
                        delete this.plugin.settings.timerDurationsByFolder[currentFolder];
                        await this.plugin.saveSettings();
                        new Notice('기본값으로 되돌렸습니다');
                        this.display();
                    }));
        } else {
            containerEl.createEl('p', { 
                text: '폴더별 설정을 하려면 Cloze 폴더 내의 노트를 열어주세요.',
                cls: 'setting-item-description'
            });
        }

        // ============ 학습 기록 설정 (새로 추가) ============
        containerEl.createEl('h2', { text: '📊 학습 기록 설정' });

        new Setting(containerEl)
            .setName('Enable study tracking')
            .setDesc('학습 세션을 자동으로 기록합니다')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableStudyTracking)
                .onChange(async (value) => {
                    this.plugin.settings.enableStudyTracking = value;
                    await this.plugin.saveSettings();
                }));

        const sessions = this.plugin.settings.studySessions || [];
        const totalTime = this.plugin.settings.totalStudyTime || 0;
        
        new Setting(containerEl)
            .setName('Total study sessions')
            .setDesc(`현재까지 ${sessions.length}개의 학습 기록`)
            .addButton(button => button
                .setButtonText('기록 보기')
                .onClick(() => {
                    this.plugin.openClozeDashboardView();
                }));

        new Setting(containerEl)
            .setName('Total study time')
            .setDesc(`총 학습 시간: ${Math.round(totalTime / 60)}분 (${Math.round(totalTime / 3600)}시간)`)
            .addButton(button => button
                .setButtonText('통계 보기')
                .setWarning()
                .onClick(() => {
                    this.plugin.openClozeDashboardView();
                }));

        // ============ 단축키 설정 ============
        containerEl.createEl('h2', { text: '⌨️ 단축키 설정' });
        
        const shortcutDesc = containerEl.createEl('div', { cls: 'setting-item-description' });
        shortcutDesc.style.cssText = 'margin-bottom: 15px; color: var(--text-muted);';
        shortcutDesc.innerHTML = `
            단축키를 사용하려면 먼저 텍스트를 선택한 후 단축키를 누르세요.<br>
            <strong>Ctrl/Cmd + 단축키</strong> 형식으로 사용됩니다.
        `;

        new Setting(containerEl)
            .setName('빈칸 만들기 단축키')
            .setDesc('선택한 텍스트를 빈칸으로 만들기 (기본: Ctrl+Shift+C)')
            .addText(text => text
                .setPlaceholder('입력하여 단축키 설정')
                .setValue('')
                .setDisabled(true))
            .addButton(button => button
                .setButtonText('Obsidian 단축키 설정 열기')
                .setCta()
                .onClick(() => {
                    // @ts-ignore
                    this.app.setting.open();
                    // @ts-ignore
                    this.app.setting.openTabById('hotkeys');
                    // Enhanced Cloze 검색
                    setTimeout(() => {
                        const searchInput = document.querySelector('.setting-search-input');
                        if (searchInput) {
                            // @ts-ignore
                            searchInput.value = 'cloze';
                            // @ts-ignore
                            searchInput.dispatchEvent(new Event('input'));
                        }
                    }, 100);
                }));

        const shortcutInfo = containerEl.createEl('div', { cls: 'setting-item-description' });
        shortcutInfo.style.cssText = 'margin: -10px 0 20px 0; padding: 10px; background: var(--background-secondary); border-radius: 4px;';
        shortcutInfo.innerHTML = `
            <strong>💡 사용 가능한 명령어:</strong><br>
            • <strong>Toggle selected text as cloze</strong> - 선택 텍스트를 빈칸으로 만들기/해제<br>
            • <strong>Remove cloze from selection</strong> - 선택 영역의 빈칸 제거<br>
            • <strong>Open quiz mode</strong> - 퀴즈 모드 열기<br>
            <br>
            위 버튼을 클릭하면 Obsidian 단축키 설정에서 원하는 키 조합을 설정할 수 있습니다.
        `;

        // ============ 표시 설정 ============
        containerEl.createEl('h2', { text: '🎨 표시 설정' });

        new Setting(containerEl)
            .setName('Show hints for pseudo clozes')
            .setDesc('현재 카드가 아닌 빈칸의 힌트도 표시')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showHintsForPseudoClozes)
                .onChange(async (value) => {
                    this.plugin.settings.showHintsForPseudoClozes = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Underline revealed pseudo clozes')
            .setDesc('공개된 pseudo 빈칸에 밑줄 추가')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.underlineRevealedPseudoClozes)
                .onChange(async (value) => {
                    this.plugin.settings.underlineRevealedPseudoClozes = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Underline revealed genuine clozes')
            .setDesc('공개된 genuine 빈칸에 밑줄 추가')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.underlineRevealedGenuineClozes)
                .onChange(async (value) => {
                    this.plugin.settings.underlineRevealedGenuineClozes = value;
                    await this.plugin.saveSettings();
                }));
    }
}

// =====================================================
// 모듈 내보내기
// =====================================================
module.exports = EnhancedClozePlugin;

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

        // 헤더
        const header = contentEl.createDiv();
        header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;';
        
        header.createEl('h2', { text: '📂 폴더별 관리' }).style.margin = '0';
        
        // 새로고침 버튼
        const refreshBtn = header.createEl('button', { text: '🔄 새로고침' });
        refreshBtn.style.cssText = 'padding: 8px 16px;';
        refreshBtn.onclick = () => this.onOpen();

        const folders = await this.getClozefolders();
        
        if (folders.length === 0) {
            contentEl.createEl('p', { 
                text: '빈칸 노트가 있는 폴더가 없습니다.',
                cls: 'setting-item-description'
            });
            return;
        }

        // 폴더 목록
        const folderList = contentEl.createDiv({ cls: 'folder-list' });
        folderList.style.cssText = 'display: flex; flex-direction: column; gap: 10px; max-height: 60vh; overflow-y: auto;';

        for (const folder of folders) {
            const folderItem = folderList.createDiv({ cls: 'folder-item' });
            folderItem.style.cssText = 'padding: 12px; border: 1px solid var(--background-modifier-border); border-radius: 6px; background: var(--background-primary-alt);';

            // 폴더 정보
            const folderHeader = folderItem.createDiv();
            folderHeader.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;';

            const folderName = folderHeader.createEl('h3', { text: folder.name });
            folderName.style.margin = '0';

            const folderStats = folderHeader.createEl('span', { 
                text: `${folder.noteCount}개 노트`,
                cls: 'setting-item-description'
            });

            // 통계 표시
            const stats = this.plugin.settings.stats.folderStats[folder.name] || { attempts: 0, correct: 0, time: 0 };
            const accuracy = stats.attempts > 0 ? Math.round((stats.correct / stats.attempts) * 100) : 0;

            const statsDiv = folderItem.createDiv();
            statsDiv.style.cssText = 'display: flex; gap: 15px; margin-bottom: 10px; color: var(--text-muted); font-size: 0.9em;';
            
            statsDiv.createSpan({ text: `✅ 정답: ${stats.correct}회` });
            statsDiv.createSpan({ text: `📊 정답률: ${accuracy}%` });
            statsDiv.createSpan({ text: `⏱️ 학습시간: ${Math.round(stats.time / 60)}분` });

            // 상세 기록 버튼
            const detailBtn = folderItem.createEl('button', { text: '📊 상세 기록 보기' });
            detailBtn.style.cssText = 'width: 100%; margin-bottom: 10px; padding: 8px; background: var(--background-secondary);';
            detailBtn.onclick = () => {
                this.close();
                new FolderDetailModal(this.app, this.plugin, folder.name, folder.path).open();
            };

            // 버튼들
            const btnGroup = folderItem.createDiv();
            btnGroup.style.cssText = 'display: flex; gap: 8px;';

            // 북마크 폴더인 경우
            if (folder.isBookmarkFolder) {
                // 북마크 목록 보기
                const listBtn = btnGroup.createEl('button', { text: '⭐ 북마크 목록' });
                listBtn.style.cssText = 'flex: 1; padding: 6px 12px;';
                listBtn.onclick = () => {
                    this.close();
                    new BookmarkListModal(this.app, this.plugin).open();
                };

                // 북마크 퀴즈
                const quizBtn = btnGroup.createEl('button', { text: '🎯 북마크 퀴즈' });
                quizBtn.style.cssText = 'flex: 1; padding: 6px 12px; background: var(--interactive-accent); color: var(--text-on-accent);';
                quizBtn.onclick = () => {
                    this.close();
                    new BookmarkQuizModal(this.app, this.plugin).open();
                };

                // 전체 삭제
                const clearBtn = btnGroup.createEl('button', { text: '🗑️ 전체 삭제' });
                clearBtn.style.cssText = 'padding: 6px 12px; background: var(--background-modifier-error); color: white;';
                clearBtn.onclick = async () => {
                    await this.plugin.clearBookmarks();
                    this.onOpen();
                };
            } else {
                // 일반 폴더인 경우
                // 새 노트 만들기
                const newNoteBtn = btnGroup.createEl('button', { text: '➕ 새 노트' });
                newNoteBtn.style.cssText = 'flex: 1; padding: 6px 12px;';
                newNoteBtn.onclick = async () => {
                    await this.plugin.createClozeNoteInFolder(folder.path);
                    this.close();
                };

                // 퀴즈 시작
                const quizBtn = btnGroup.createEl('button', { text: '🎯 퀴즈' });
                quizBtn.style.cssText = 'flex: 1; padding: 6px 12px; background: var(--interactive-accent); color: var(--text-on-accent);';
                quizBtn.onclick = () => {
                    this.close();
                    new QuizModeModal(this.app, this.plugin, folder.path).open();
                };

                // 폴더 열기
                const openBtn = btnGroup.createEl('button', { text: '📂 열기' });
                openBtn.style.cssText = 'flex: 1; padding: 6px 12px;';
                openBtn.onclick = async () => {
                    const folderFile = this.app.vault.getAbstractFileByPath(folder.path);
                    if (folderFile && folderFile.children && folderFile.children.length > 0) {
                        this.app.workspace.getLeaf().openFile(folderFile.children[0]);
                    }
                    this.close();
                };
            }
            
            // 공통 버튼 그룹 (두 번째 줄)
            const btnGroup2 = folderItem.createDiv();
            btnGroup2.style.cssText = 'display: flex; gap: 8px; margin-top: 8px;';
            
            if (!folder.isBookmarkFolder) {
                // 폴더명 변경
                const renameBtn = btnGroup2.createEl('button', { text: '✏️ 이름 변경' });
                renameBtn.style.cssText = 'flex: 1; padding: 6px 12px; background: #10b981; color: white;';
                renameBtn.onclick = async () => {
                    const newName = await this.promptFolderName(folder.name);
                    if (newName && newName !== folder.name) {
                        await this.renameFolder(folder.path, newName);
                    }
                };
                
                // 폴더 복사
                const copyBtn = btnGroup2.createEl('button', { text: '📋 복사' });
                copyBtn.style.cssText = 'flex: 1; padding: 6px 12px; background: #3b82f6; color: white;';
                copyBtn.onclick = async () => {
                    const folderName = await this.promptFolderName(`${folder.name}_복사본`);
                    if (folderName) {
                        await this.copyFolder(folder.path, folderName);
                    }
                };

                // 폴더 삭제
                const deleteBtn = btnGroup2.createEl('button', { text: '🗑️ 삭제' });
                deleteBtn.style.cssText = 'flex: 1; padding: 6px 12px; background: var(--background-modifier-error); color: white;';
                deleteBtn.onclick = async () => {
                    if (confirm(`"${folder.name}" 폴더와 모든 내용을 삭제하시겠습니까?`)) {
                        await this.app.vault.adapter.rmdir(folder.path, true);
                        new Notice(`${folder.name} 폴더가 삭제되었습니다`);
                        this.onOpen();
                    }
                };
            }
        }
    }
    
    async promptFolderName(defaultName) {
        return new Promise((resolve) => {
            const modal = new Modal(this.app);
            modal.contentEl.empty();
            modal.contentEl.createEl('h3', { text: '폴더 이름 입력' });
            
            const input = modal.contentEl.createEl('input', { 
                type: 'text',
                value: defaultName
            });
            input.style.cssText = 'width: 100%; padding: 8px; margin: 10px 0; font-size: 1em;';
            
            const btnContainer = modal.contentEl.createDiv();
            btnContainer.style.cssText = 'display: flex; gap: 8px; justify-content: flex-end; margin-top: 10px;';
            
            const confirmBtn = btnContainer.createEl('button', { text: '확인' });
            confirmBtn.style.cssText = 'padding: 8px 16px; background: var(--interactive-accent); color: white; border: none; border-radius: 6px; cursor: pointer;';
            confirmBtn.onclick = () => {
                const value = input.value.trim();
                if (value) {
                    resolve(value);
                    modal.close();
                }
            };
            
            const cancelBtn = btnContainer.createEl('button', { text: '취소' });
            cancelBtn.style.cssText = 'padding: 8px 16px; background: var(--background-secondary); border: 1px solid var(--background-modifier-border); border-radius: 6px; cursor: pointer;';
            cancelBtn.onclick = () => {
                resolve(null);
                modal.close();
            };
            
            input.focus();
            input.select();
            
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    confirmBtn.click();
                } else if (e.key === 'Escape') {
                    cancelBtn.click();
                }
            });
            
            modal.open();
        });
    }
    
    async renameFolder(oldPath, newName) {
        try {
            const clozeFolder = this.plugin.settings.clozeFolder;
            const newPath = `${clozeFolder}/${newName}`;
            
            // 폴더가 이미 존재하는지 확인
            const exists = await this.app.vault.adapter.exists(newPath);
            if (exists) {
                new Notice(`❌ "${newName}" 폴더가 이미 존재합니다`);
                return;
            }
            
            // 폴더 이름 변경
            const folder = this.app.vault.getAbstractFileByPath(oldPath);
            if (folder) {
                await this.app.fileManager.renameFile(folder, newPath);
                new Notice(`✅ 폴더 이름이 "${newName}"(으)로 변경되었습니다`);
                this.onOpen();
            }
        } catch (error) {
            console.error('폴더 이름 변경 실패:', error);
            new Notice(`❌ 폴더 이름 변경 실패: ${error.message}`);
        }
    }
    
    async copyFolder(sourcePath, newFolderName) {
        try {
            const clozeFolder = this.plugin.settings.clozeFolder;
            const targetPath = `${clozeFolder}/${newFolderName}`;
            
            // 폴더가 이미 존재하는지 확인
            const exists = await this.app.vault.adapter.exists(targetPath);
            if (exists) {
                new Notice(`❌ "${newFolderName}" 폴더가 이미 존재합니다`);
                return;
            }
            
            // 새 폴더 생성
            await this.app.vault.createFolder(targetPath);
            
            // 원본 폴더의 모든 파일 복사
            const sourceFolder = this.app.vault.getAbstractFileByPath(sourcePath);
            if (sourceFolder && sourceFolder.children) {
                for (const file of sourceFolder.children) {
                    if (file.extension === 'md') {
                        const content = await this.app.vault.read(file);
                        await this.app.vault.create(`${targetPath}/${file.name}`, content);
                    } else if (file.children) {
                        // 하위 폴더도 복사 (첨부파일 폴더 등)
                        const subfolderPath = `${targetPath}/${file.name}`;
                        await this.app.vault.createFolder(subfolderPath);
                        
                        for (const subfile of file.children) {
                            if (subfile.extension) {
                                const binary = await this.app.vault.adapter.readBinary(subfile.path);
                                await this.app.vault.adapter.writeBinary(`${subfolderPath}/${subfile.name}`, binary);
                            }
                        }
                    }
                }
            }
            
            new Notice(`✅ "${newFolderName}" 폴더가 생성되었습니다`);
            this.onOpen();
        } catch (error) {
            console.error('폴더 복사 실패:', error);
            new Notice(`❌ 폴더 복사 실패: ${error.message}`);
        }
    }

    async getClozefolders() {
        const clozeFolder = this.plugin.settings.clozeFolder;
        const clozeFolderFile = this.app.vault.getAbstractFileByPath(clozeFolder);
        
        const folders = [];
        
        // 북마크 폴더 추가 (최상단에 표시)
        const bookmarkFolderPath = this.plugin.settings.bookmarkFolder || '📌 북마크';
        const bookmarkCount = this.plugin.settings.bookmarks?.length || 0;
        
        if (bookmarkCount > 0) {
            folders.push({
                name: '⭐ 북마크',
                path: bookmarkFolderPath,
                noteCount: bookmarkCount,
                isBookmarkFolder: true
            });
        }
        
        // 일반 Cloze 폴더들
        if (!clozeFolderFile || !clozeFolderFile.children) {
            return folders;
        }

        for (const child of clozeFolderFile.children) {
            if (child.children) { // 폴더인 경우
                const noteCount = child.children.filter(f => f.extension === 'md').length;
                if (noteCount > 0) {
                    folders.push({
                        name: child.name,
                        path: child.path,
                        noteCount: noteCount
                    });
                }
            }
        }

        return folders;
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

        // 기록 삭제 버튼
        const clearBtn = btnGroup.createEl('button', { text: '🗑️ 기록 삭제' });
        clearBtn.style.cssText = 'padding: 8px 12px; background: var(--background-modifier-error); color: white;';
        clearBtn.onclick = async () => {
            if (confirm(`"${this.folderName}" 폴더의 모든 학습 기록을 삭제하시겠습니까?`)) {
                await this.clearFolderStats();
                new Notice('✅ 기록이 삭제되었습니다');
                this.onOpen();
            }
        };

        const stats = this.plugin.settings.stats;
        const history = (stats.studyHistory || []).filter(h => h.folderName === this.folderName);
        
        if (history.length === 0) {
            contentEl.createEl('p', { 
                text: '아직 학습 기록이 없습니다.',
                cls: 'setting-item-description'
            }).style.cssText = 'padding: 20px; text-align: center;';
            return;
        }

        // 학습 세션 목록
        contentEl.createEl('h3', { text: `📋 학습 세션 기록 (${history.length}개)` });
        
        const sessionList = contentEl.createDiv({ cls: 'session-list' });
        sessionList.style.cssText = 'max-height: 60vh; overflow-y: auto; border: 1px solid var(--background-modifier-border); border-radius: 6px;';

        // 최근 순으로 정렬
        const sortedHistory = history.sort((a, b) => b.timestamp - a.timestamp);

        for (const record of sortedHistory) {
            const sessionDiv = sessionList.createDiv({ cls: 'session-item' });
            sessionDiv.style.cssText = 'padding: 12px; border-bottom: 1px solid var(--background-modifier-border); display: flex; justify-content: space-between; align-items: center;';

            const infoDiv = sessionDiv.createDiv();
            infoDiv.style.flex = '1';
            
            const date = new Date(record.timestamp);
            const dateStr = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
            const fileName = record.fileName || '알 수 없음';
            const statusIcon = record.completed ? '✅' : '⏱️';
            
            infoDiv.createEl('div', { text: `${statusIcon} ${dateStr}` }).style.cssText = 'font-weight: 500; margin-bottom: 4px;';
            infoDiv.createEl('div', { 
                text: `📄 ${fileName}`,
                cls: 'setting-item-description'
            }).style.fontSize = '0.9em';

            const statsDiv = sessionDiv.createDiv();
            statsDiv.style.cssText = 'text-align: right; display: flex; flex-direction: column; gap: 4px;';
            
            const statusBadge = statsDiv.createEl('span', { 
                text: record.completed ? '완료' : '시간초과'
            });
            statusBadge.style.cssText = `padding: 2px 8px; border-radius: 4px; font-size: 0.85em; background: ${record.completed ? 'var(--color-green)' : 'var(--color-orange)'}; color: white; display: inline-block;`;
            
            statsDiv.createEl('span', { 
                text: `${Math.round(record.duration)}초`,
                cls: 'setting-item-description'
            }).style.fontSize = '0.85em';
        }
    }

    async clearFolderStats() {
        // 폴더 통계 초기화
        if (this.plugin.settings.stats.folderStats[this.folderName]) {
            delete this.plugin.settings.stats.folderStats[this.folderName];
        }

        // 히스토리에서 해당 폴더 기록 제거
        if (this.plugin.settings.stats.studyHistory) {
            this.plugin.settings.stats.studyHistory = this.plugin.settings.stats.studyHistory.filter(
                h => h.folderName !== this.folderName
            );
        }

        await this.plugin.saveSettings();
    }

    async deleteDateRecords(date) {
        // 해당 날짜의 기록 제거
        if (this.plugin.settings.stats.studyHistory) {
            const recordsToRemove = this.plugin.settings.stats.studyHistory.filter(
                h => h.folderName === this.folderName && h.date === date
            );

            // 통계에서 빼기
            const folderStats = this.plugin.settings.stats.folderStats[this.folderName];
            if (folderStats) {
                recordsToRemove.forEach(record => {
                    folderStats.attempts--;
                    if (record.completed) folderStats.correct--;
                    folderStats.time -= record.duration;

                    // 파일별 통계에서도 빼기
                    const fileStats = folderStats.fileStats[record.fileName];
                    if (fileStats) {
                        fileStats.attempts--;
                        if (record.completed) fileStats.correct--;
                        fileStats.time -= record.duration;
                    }
                });
            }

            // 히스토리에서 제거
            this.plugin.settings.stats.studyHistory = this.plugin.settings.stats.studyHistory.filter(
                h => !(h.folderName === this.folderName && h.date === date)
            );
        }

        await this.plugin.saveSettings();
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

        contentEl.createEl('h2', { text: '📋 학습 세션 기록' });
        
        const stats = this.plugin.settings.stats;
        const history = stats.studyHistory || [];

        if (history.length === 0) {
            contentEl.createEl('p', { 
                text: '아직 학습 기록이 없습니다. 퀴즈를 완료하거나 학습을 정지하면 기록이 쌓입니다.',
                cls: 'setting-item-description'
            }).style.cssText = 'padding: 20px; text-align: center; color: var(--text-muted);';
            return;
        }

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
        contentEl.createEl('h3', { text: `📄 전체 학습 세션 (${history.length}개)` });
        
        const sessionList = contentEl.createDiv({ cls: 'session-list' });
        sessionList.style.cssText = 'max-height: 60vh; overflow-y: auto; border: 1px solid var(--background-modifier-border); border-radius: 6px;';

        // 최근 순으로 정렬
        const sortedHistory = history.sort((a, b) => b.timestamp - a.timestamp);

        for (const record of sortedHistory) {
            const sessionDiv = sessionList.createDiv({ cls: 'session-item' });
            sessionDiv.style.cssText = 'padding: 12px; border-bottom: 1px solid var(--background-modifier-border); display: flex; justify-content: space-between; align-items: center;';

            const infoDiv = sessionDiv.createDiv();
            infoDiv.style.flex = '1';
            
            const date = new Date(record.timestamp);
            const dateStr = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
            const folderName = record.folderName || '알 수 없음';
            const fileName = record.fileName || '알 수 없음';
            const statusIcon = record.completed ? '✅' : '⏱️';
            
            infoDiv.createEl('div', { text: `${statusIcon} ${dateStr}` }).style.cssText = 'font-weight: 500; margin-bottom: 4px;';
            infoDiv.createEl('div', { 
                text: `📁 ${folderName} / 📄 ${fileName}`,
                cls: 'setting-item-description'
            }).style.fontSize = '0.9em';

            const statsDiv = sessionDiv.createDiv();
            statsDiv.style.cssText = 'text-align: right; display: flex; flex-direction: column; gap: 4px;';
            
            const statusBadge = statsDiv.createEl('span', { 
                text: record.completed ? '완료' : '시간초과'
            });
            statusBadge.style.cssText = `padding: 2px 8px; border-radius: 4px; font-size: 0.85em; background: ${record.completed ? 'var(--color-green)' : 'var(--color-orange)'}; color: white; display: inline-block;`;
            
            statsDiv.createEl('span', { 
                text: `${Math.round(record.duration)}초`,
                cls: 'setting-item-description'
            }).style.fontSize = '0.85em';
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
            /* 퀴즈 모드 기본 스타일 */
            .quiz-mode-modal {
                padding: 16px;
            }
            
            .quiz-mode-modal .quiz-header {
                padding: 12px;
                background: var(--background-secondary);
                border-radius: 12px;
                margin-bottom: 16px;
            }
            
            /* 텍스트 선택 활성화 */
            .quiz-mode-modal .quiz-note-content,
            .quiz-mode-modal .quiz-note-content * {
                user-select: text !important;
                -webkit-user-select: text !important;
                -moz-user-select: text !important;
                -ms-user-select: text !important;
                cursor: text;
            }
            
            /* 빈칸은 클릭 가능하도록 */
            .quiz-mode-modal .genuine-cloze,
            .quiz-mode-modal .pseudo-cloze,
            .quiz-mode-modal .image-cloze {
                cursor: pointer !important;
            }
            
            /* 타이머 스타일 */
            .quiz-timer {
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 18px;
                font-weight: 600;
                color: var(--text-accent);
                padding: 8px 12px;
                background: var(--background-primary-alt);
                border-radius: 8px;
            }
            
            /* 버튼 기본 스타일 */
            .quiz-mode-modal button {
                min-height: 44px;
                padding: 8px 16px;
                border-radius: 8px;
                font-weight: 500;
                transition: all 0.2s;
            }
            
            .quiz-mode-modal button:hover {
                transform: translateY(-1px);
                box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            }
            
            /* 모바일 반응형 */
            @media (max-width: 600px) {
                .quiz-mode-modal {
                    max-width: 100vw !important;
                    width: 100vw !important;
                    min-width: 0 !important;
                    padding: 0 !important;
                }
                
                .quiz-control-bar {
                    padding: 8px !important;
                    gap: 8px !important;
                }
                
                .quiz-info-bar {
                    padding: 10px 12px !important;
                    gap: 10px !important;
                    flex-wrap: wrap !important;
                    justify-content: center !important;
                }
                
                .quiz-info-bar h2 {
                    font-size: 1.1em !important;
                }
                
                .quiz-progress {
                    font-size: 13px !important;
                    padding: 3px 10px !important;
                    white-space: nowrap !important;
                }
                
                .quiz-timer {
                    font-size: 16px !important;
                    padding: 6px 10px !important;
                }
                
                .quiz-content {
                    padding: 10px !important;
                    margin-bottom: 70px !important;
                }
                
                .quiz-note-content {
                    font-size: 16px !important;
                    line-height: 1.6 !important;
                    padding: 12px !important;
                }
                
                .quiz-footer {
                    position: fixed !important;
                    bottom: 0 !important;
                    left: 0 !important;
                    right: 0 !important;
                    width: 100vw !important;
                    display: flex !important;
                    gap: 6px !important;
                    padding: 10px !important;
                    background: var(--background-secondary) !important;
                    border-top: 1px solid var(--background-modifier-border) !important;
                    z-index: 1000 !important;
                    margin: 0 !important;
                    box-shadow: 0 -2px 10px rgba(0,0,0,0.1) !important;
                }
            
                
                .quiz-mode-modal .quiz-complete-btns {
                    display: flex !important;
                    flex-direction: column !important;
                    gap: 10px !important;
                    padding: 12px !important;
                }
                
                .quiz-mode-modal .quiz-complete-btns button {
                    width: 100% !important;
                    min-height: 48px !important;
                    font-size: 16px !important;
                }
                
                /* 상단 버튼 그룹 모바일 최적화 */
                .quiz-control-bar > div {
                    display: grid !important;
                    grid-template-columns: repeat(auto-fit, minmax(44px, 1fr)) !important;
                    gap: 6px !important;
                    max-width: 100% !important;
                }
                
                .quiz-control-bar button {
                    min-width: 44px !important;
                    min-height: 44px !important;
                    font-size: 18px !important;
                    padding: 8px !important;
                }
                
                .quiz-timer {
                    font-size: 20px !important;
                    flex: none !important;
                }
                
                .quiz-header-bookmark {
                    font-size: 13px !important;
                    padding: 4px 10px !important;
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
        contentEl.style.cssText = 'display: flex; flex-direction: column; height: 80vh; max-width: 800px; position: relative;';
        
        // 상단 컨트롤 바 (버튼들만)
        const controlBar = contentEl.createDiv({ cls: 'quiz-control-bar' });
        controlBar.style.cssText = 'padding: 10px; background: var(--background-secondary); border-bottom: 1px solid var(--background-modifier-border); display: flex; gap: 6px; justify-content: center; flex-wrap: wrap;';
        
        // 버튼 그룹
        const topButtons = controlBar.createDiv();
        topButtons.style.cssText = 'display: flex; gap: 6px; flex-wrap: wrap; justify-content: center;';
        
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
                item.setTitle('➕ 새 빈칸 노트 추가')
                    .setIcon('file-plus')
                    .onClick(async () => {
                        const folderPath = this.currentFolder || this.plugin.settings.clozeFolder;
                        const fileName = `새 빈칸 노트 ${Date.now()}.md`;
                        const filePath = `${folderPath}/${fileName}`;
                        
                        try {
                            const newFile = await this.app.vault.create(filePath, '# 새 빈칸 노트\n\n{{c1::답변::힌트}}');
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
            const bookmarkFolderPath = this.plugin.settings.bookmarkFolder || '📌 북마크';
            
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
                        new ClozeEditModal(this.app, this.plugin, this.currentFile, async () => {
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
            
            // 새 빈칸 추가
            menu.addItem((item) => {
                item.setTitle('➕ 빈칸 추가')
                    .setIcon('plus')
                    .onClick(() => {
                        new TextInputModal(
                            this.app,
                            '빈칸 추가',
                            '빈칸으로 만들 텍스트를 입력하세요',
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
        
        // 정보 바 (타이머/진행률/북마크)
        const infoBar = contentEl.createDiv({ cls: 'quiz-info-bar' });
        infoBar.style.cssText = 'padding: 12px 16px; background: var(--background-primary-alt); border-bottom: 2px solid var(--background-modifier-border); display: flex; gap: 16px; justify-content: space-between; align-items: center; flex-wrap: wrap;';
        
        // 제목과 진행률 (왼쪽)
        const titleSection = infoBar.createDiv();
        titleSection.style.cssText = 'display: flex; align-items: center; gap: 12px; flex-wrap: wrap;';
        
        const titleEl = titleSection.createEl('h2', { text: '🎯 퀴즈 모드' });
        titleEl.style.cssText = 'margin: 0; font-size: 1.2em;';
        
        const progress = titleSection.createEl('span', {
            text: `${this.currentNoteIndex + 1} / ${this.notes.length}`,
            cls: 'quiz-progress'
        });
        progress.style.cssText = 'font-size: 14px; color: var(--text-muted); font-weight: 600; padding: 4px 12px; background: var(--background-secondary); border-radius: 12px;';
        
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
        this.headerBookmarkContainer.style.cssText = 'display: flex; align-items: center; gap: 6px; font-size: 14px; padding: 4px 12px; background: var(--background-secondary); border-radius: 8px;';
        
        const headerCheckbox = this.headerBookmarkContainer.createEl('input', { type: 'checkbox' });
        headerCheckbox.id = 'quiz-header-bookmark-check';
        headerCheckbox.style.cssText = 'width: 16px; height: 16px; cursor: pointer;';
        
        const headerLabel = this.headerBookmarkContainer.createEl('label');
        headerLabel.htmlFor = 'quiz-header-bookmark-check';
        headerLabel.textContent = '⭐ 북마크';
        headerLabel.style.cssText = 'cursor: pointer; user-select: none;';
        
        this.headerBookmarkCheckbox = headerCheckbox;
        
        const content = contentEl.createDiv({ cls: 'quiz-content' });
        content.style.cssText = 'flex: 1; overflow-y: auto; padding: 20px; padding-bottom: 20px;';
        this.contentContainer = content;
        
        // 하단 네비게이션 버튼들을 content 바로 아래에 배치
        const navButtons = contentEl.createDiv();
        navButtons.style.cssText = 'display: flex; gap: 8px; justify-content: center; align-items: center; padding: 12px; background: var(--background-secondary); border-top: 1px solid var(--background-modifier-border);';
        
        // 버튼 생성 함수
        const makeBtn = (icon, aria, style, onClick) => {
            const btn = navButtons.createEl('button');
            btn.innerHTML = icon;
            btn.setAttribute('aria-label', aria);
            btn.style.cssText = style + 'min-width:44px; min-height:44px; padding:8px 12px; font-size:18px; display:flex; align-items:center; justify-content:center; border-radius:8px; border:none; cursor:pointer;';
            btn.onclick = onClick;
            btn.addEventListener('touchend', (e) => { e.preventDefault(); onClick(); });
            return btn;
        };
        // ◀️ 이전
        makeBtn('◀️', '이전', 'background:var(--interactive-accent);color:var(--text-on-accent);', () => this.previousNote());
        // ⏸️ 일시정지
        this.pauseBtn = makeBtn('⏸️', '일시정지', 'background:var(--background-modifier-border);', () => this.togglePause());
        // 💡 정답 보기 (모든 빈칸 뒤집기 + 정답 처리 확인)
        makeBtn('💡', '정답', 'background:#10b981;color:white;', () => {
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
                    modal.close();
                };
                correctBtn.addEventListener('touchend', async (e) => {
                    e.preventDefault();
                    await this.recordCurrentCardStudy(true);
                    modal.close();
                });
                
                const wrongBtn = btnContainer.createEl('button', { text: '❌ 오답 처리' });
                wrongBtn.style.cssText = 'background: #ef4444; color: white; padding: 12px 24px; border: none; border-radius: 8px; cursor: pointer; font-size: 15px; min-width: 44px; min-height: 44px;';
                wrongBtn.onclick = async () => {
                    await this.recordCurrentCardStudy(false);
                    modal.close();
                };
                wrongBtn.addEventListener('touchend', async (e) => {
                    e.preventDefault();
                    await this.recordCurrentCardStudy(false);
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
            }
        });
        // ▶️ 다음
        makeBtn('▶️', '다음', 'background:var(--interactive-accent);color:var(--text-on-accent);', () => this.nextNote());
        // 🔄 새로고침
        makeBtn('🔄', '새로고침', 'background:var(--interactive-accent);color:var(--text-on-accent);', async () => {
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
        const folder = this.folderPath || this.plugin.settings.clozeFolder;
        console.log('📂 퀴즈 모드: 폴더 경로 =', folder);
        
        const folderFile = this.app.vault.getAbstractFileByPath(folder);
        if (!folderFile) {
            console.error('❌ 폴더를 찾을 수 없습니다:', folder);
            new Notice(`❌ 폴더를 찾을 수 없습니다: ${folder}`);
            return;
        }
        
        if (!folderFile.children) {
            console.warn('⚠️ 폴더에 파일이 없습니다:', folder);
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
        console.log(`📄 발견된 노트 개수: ${this.notes.length}개`);
        
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
                if (this.plugin.openClozeDashboardView) {
                    this.plugin.openClozeDashboardView();
                }
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
                console.log('📋 전체 선택됨');
            }
        });
        
        // 탭 가능하도록 설정
        contentDiv.setAttribute('tabindex', '0');
        
        // 이미지 링크를 미리 추출하고 HTML로 변환
        console.log('🔍 원본 마크다운 길이:', content.length);
        let processedContent = content;
        
        // 이미지 링크 추출: ![[image.png]] 형식 (빈칸 태그 안팎 모두 포함)
        // 1. ![[image.png]]{{c1::...}} 형식
        // 2. {{c1::![[image.png]]::...}} 형식
        const imageLinks = [];
        const allImageMatches = content.matchAll(/!\[\[(.+?)\]\]/g);
        for (const match of allImageMatches) {
            imageLinks.push(match[0]);
        }
        
        console.log('🖼️ 발견된 이미지 링크:', imageLinks.length, imageLinks);
        
        if (imageLinks.length > 0) {
            console.log('🖼️ 수동 이미지 렌더링 시작:', imageLinks.length, '개');
            
            for (const link of imageLinks) {
                const match = link.match(/!\[\[(.+?)(?:\|(\d+))?\]\]/);
                if (match) {
                    const imagePath = match[1];
                    const width = match[2] || '300';
                    
                    console.log('  - 이미지 링크:', link);
                    console.log('  - 이미지 경로:', imagePath);
                    
                    // 이미지 파일 찾기
                    const files = this.app.vault.getFiles();
                    let imageFile = null;
                    
                    // 전략 1: 정확한 경로 매칭
                    imageFile = files.find(f => f.path === imagePath);
                    if (imageFile) console.log('  ✅ [전략1] 정확한 경로로 발견:', imageFile.path);
                    
                    // 전략 2: 파일명만으로 매칭
                    if (!imageFile) {
                        const fileName = imagePath.split('/').pop();
                        imageFile = files.find(f => f.name === fileName);
                        if (imageFile) console.log('  ✅ [전략2] 파일명으로 발견:', imageFile.path);
                    }
                    
                    // 전략 3: 경로에 파일명 포함 여부로 매칭
                    if (!imageFile) {
                        const fileName = imagePath.split('/').pop();
                        imageFile = files.find(f => f.path.includes(fileName));
                        if (imageFile) console.log('  ✅ [전략3] 파일명 포함으로 발견:', imageFile.path);
                    }
                    
                    // 전략 4: 경로가 파일 경로로 끝나는지 확인
                    if (!imageFile) {
                        imageFile = files.find(f => f.path.endsWith(imagePath));
                        if (imageFile) console.log('  ✅ [전략4] 경로 끝부분으로 발견:', imageFile.path);
                    }
                    
                    if (imageFile) {
                        const imageUrl = this.app.vault.getResourcePath(imageFile);
                        console.log('  🎨 최종 이미지 URL:', imageUrl);
                        
                        // 마크다운 링크를 HTML img 태그로 교체
                        const imgHtml = `<img src="${imageUrl}" style="max-width: ${width}px; height: auto; display: block; margin: 8px 0;" data-image-path="${imagePath}" />`;
                        processedContent = processedContent.replace(link, imgHtml);
                        console.log('  ✅ HTML 변환 완료');
                    } else {
                        console.log('  ❌ 이미지 파일 찾기 실패:', imagePath);
                    }
                }
            }
        }
        
        console.log('📝 처리된 마크다운 길이:', processedContent.length);
        
        // Component 생성 (이미지 렌더링을 위해 필요)
        const component = new Component();
        component.load(); // Component 명시적 로드
        
        // Obsidian 마크다운 렌더러 사용 (이미지는 이미 HTML로 변환됨)
        await MarkdownRenderer.render(this.app, processedContent, contentDiv, note.path, component);
        
        // 렌더링 완료 대기 (이미지 로드 전)
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // 이미지 로드를 기다림
        const images = contentDiv.querySelectorAll('img');
        console.log('🖼️ 퀴즈 모드 - 최종 이미지 개수:', images.length);
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
        
        const originalGetCardNumber = this.plugin.getCurrentCardNumber;
        this.plugin.getCurrentCardNumber = () => 999;
        this.plugin.processClozes(contentDiv, { view: 'quiz' });
        this.plugin.getCurrentCardNumber = originalGetCardNumber;
        
        // 이미지 빈칸 처리를 위한 추가 대기 (비동기 처리 완료 대기 - 1초로 증가)
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const clozes = contentDiv.querySelectorAll('.genuine-cloze, .pseudo-cloze, .image-cloze');
        console.log('🎯 퀴즈 모드: 빈칸 개수 =', clozes.length);
        
        clozes.forEach((cloze, index) => {
            console.log(`📌 빈칸 ${index + 1}:`, {
                class: cloze.className,
                state: cloze.getAttribute('data-show-state'),
                answer: cloze.getAttribute('data-answer'),
                text: cloze.textContent
            });
            
            // 기존 이벤트 리스너 제거 (processClozes에서 등록된 것)
            const oldCloze = cloze.cloneNode(true);
            cloze.parentNode?.replaceChild(oldCloze, cloze);
            const newCloze = oldCloze;
            
            // 초기 스타일 설정
            newCloze.style.cursor = 'pointer';
            
            // 이미지 빈칸 여부 확인
            const isImageCloze = newCloze.classList.contains('image-cloze');
            let imgElement = null;
            
            if (isImageCloze) {
                // 이미지 빈칸: wrapper 안의 img 찾기
                const wrapper = newCloze.closest('.image-cloze-wrapper');
                if (wrapper) {
                    imgElement = wrapper.querySelector('img');
                }
                
                // 초기 상태 설정
                const initialState = newCloze.getAttribute('data-show-state');
                if (initialState === 'answer') {
                    if (imgElement) {
                        imgElement.style.display = 'block';
                    }
                    newCloze.style.background = 'transparent';
                    newCloze.style.color = 'transparent';
                    newCloze.textContent = '';
                } else {
                    if (imgElement) {
                        imgElement.style.display = 'none';
                    }
                    newCloze.style.background = '#FF8C00';
                    newCloze.style.color = '#000000';
                    newCloze.style.padding = '8px 12px';
                    newCloze.style.borderRadius = '4px';
                    newCloze.style.display = 'inline-block';
                    newCloze.style.minWidth = '100px';
                    newCloze.style.textAlign = 'center';
                    
                    const hint = newCloze.getAttribute('data-hint');
                    if (hint && hint.trim()) {
                        newCloze.textContent = `[${hint}]`;
                    } else {
                        newCloze.textContent = '[이미지]';
                    }
                }
            } else {
                // 텍스트 빈칸
                newCloze.style.padding = '2px 8px';
                newCloze.style.borderRadius = '4px';
                newCloze.style.fontWeight = 'bold';
                newCloze.style.display = 'inline-block';
                
                // 초기 상태에 따라 배경색 설정
                const initialState = newCloze.getAttribute('data-show-state');
                if (initialState === 'answer') {
                    newCloze.style.background = '#10b981';
                    newCloze.style.color = 'white';
                } else {
                    newCloze.style.background = '#FF8C00';
                    newCloze.style.color = '#000000';
                }
            }
            
            const toggleAnswer = () => {
                console.log('🖱️ 클릭 이벤트 발생!', newCloze.className);
                const currentState = newCloze.getAttribute('data-show-state');
                const answer = newCloze.getAttribute('data-answer');
                
                if (isImageCloze) {
                    // 이미지 빈칸 토글
                    if (currentState === 'answer') {
                        // 정답 → 빈칸
                        console.log('✅ 정답 → 빈칸 (이미지)');
                        newCloze.setAttribute('data-show-state', 'hint');
                        if (imgElement) {
                            imgElement.style.display = 'none';
                        }
                        newCloze.style.background = '#FF8C00';
                        newCloze.style.color = '#000000';
                        newCloze.style.position = 'static';
                        newCloze.style.padding = '8px 12px';
                        newCloze.style.borderRadius = '4px';
                        newCloze.style.display = 'inline-block';
                        newCloze.style.minWidth = '100px';
                        newCloze.style.textAlign = 'center';
                        
                        const hint = newCloze.getAttribute('data-hint');
                        if (hint && hint.trim()) {
                            newCloze.textContent = `[${hint}]`;
                        } else {
                            newCloze.textContent = '[이미지]';
                        }
                    } else {
                        // 빈칸 → 정답
                        console.log('❓ 빈칸 → 정답 (이미지)');
                        newCloze.setAttribute('data-show-state', 'answer');
                        if (imgElement) {
                            imgElement.style.display = 'block';
                        }
                        newCloze.style.background = 'transparent';
                        newCloze.style.color = 'transparent';
                        newCloze.style.position = 'absolute';
                        newCloze.style.top = '0';
                        newCloze.style.left = '0';
                        newCloze.textContent = '';
                    }
                } else if (currentState === 'answer') {
                    // 텍스트 빈칸: 정답 상태 → 빈칸으로 복귀
                    console.log('✅ 정답 → 빈칸');
                    newCloze.setAttribute('data-show-state', 'hint');
                    
                    // 텍스트 빈칸
                    const hint = newCloze.getAttribute('data-hint');
                    if (hint && hint.trim()) {
                        newCloze.innerHTML = `<span class="cloze-hint-text">[${hint}]</span>`;
                    } else {
                        newCloze.innerHTML = '<span class="cloze-hint-text">[...]</span>';
                    }
                    newCloze.style.background = '#FF8C00';
                    newCloze.style.color = '#000000';
                } else {
                    // 빈칸 상태 → 정답 표시
                    console.log('❓ 빈칸 → 정답:', answer);
                    newCloze.setAttribute('data-show-state', 'answer');
                    
                    // 텍스트 빈칸
                    if (answer) {
                        newCloze.textContent = answer;
                    }
                    newCloze.style.background = '#10b981';
                    newCloze.style.color = 'white';
                }
            };
            
            newCloze.addEventListener('click', toggleAnswer);
            newCloze.addEventListener('touchend', (e) => {
                e.preventDefault();
                toggleAnswer();
            });
        });
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
        const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
        const fileName = this.currentFile.basename;
        if (!this.plugin.settings.stats.studyHistory) {
            this.plugin.settings.stats.studyHistory = [];
        }
        
        // 현재 노트의 총 빈칸 개수 계산
        const clozes = this.contentContainer.querySelectorAll('.genuine-cloze, .pseudo-cloze, .image-cloze');
        const totalClozes = clozes.length;
        const correctClozes = completed ? totalClozes : 0;
        
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
        console.log(`📊 학습 기록 저장: ${this.currentFolderName}/${fileName} - ${completed ? '완료' : '시간초과'} (${elapsed}초)`);
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
// Cloze 편집 모달
// =====================================================
class ClozeEditModal extends Modal {
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
        imageInfo.textContent = '이미지를 업로드하고 빈칸을 생성합니다 (다중 선택 가능)';
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
                const attachmentFolder = this.plugin.settings.clozeFolder + '/첨부파일';
                
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
                    
                    // 빈칸 텍스트 생성
                    let clozeText;
                    if (hint) {
                        clozeText = `![[첨부파일/${imageName}|300]]{{c${clozeId}::${answer}::${hint}}}`;
                    } else {
                        clozeText = `![[첨부파일/${imageName}|300]]{{c${clozeId}::${answer}}}`;
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


// 이미지 빈칸 편집 모달
class ImageClozeEditModal extends Modal {
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
        hintDesc.textContent = '빈칸이 숨겨졌을 때 표시될 힌트입니다. 학습에 도움이 되는 내용을 입력하세요.';
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

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('bookmark-modal');

        // 헤더
        const header = contentEl.createDiv();
        header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;';
        
        header.createEl('h2', { text: '⭐ 북마크 목록' });
        
        const headerButtons = header.createDiv();
        headerButtons.style.cssText = 'display: flex; gap: 8px;';
        
        // 전체 삭제 버튼
        const clearBtn = headerButtons.createEl('button', { text: '🗑️ 전체 삭제' });
        clearBtn.style.cssText = 'padding: 6px 12px; background: var(--background-modifier-error); color: white; border: none; border-radius: 4px; cursor: pointer;';
        clearBtn.onclick = async () => {
            await this.plugin.clearBookmarks();
            this.onOpen(); // 새로고침
        };

        const bookmarks = this.plugin.getBookmarks();

        if (bookmarks.length === 0) {
            contentEl.createDiv({ 
                text: '북마크된 카드가 없습니다.\n퀴즈 중 ⭐ 북마크 체크박스를 사용하여 중요한 카드를 저장하세요.',
                cls: 'bookmark-empty'
            });
            return;
        }

        // 북마크 목록
        const listContainer = contentEl.createDiv({ cls: 'bookmark-list' });

        bookmarks.forEach((bookmark, index) => {
            const item = listContainer.createDiv({ cls: 'bookmark-item' });

            const info = item.createDiv({ cls: 'bookmark-info' });
            
            const fileName = bookmark.filePath.split('/').pop().replace('.md', '');
            info.createDiv({ text: fileName, cls: 'bookmark-file' });
            info.createDiv({ text: `Card ${bookmark.cardNumber}`, cls: 'bookmark-card' });
            
            const date = new Date(bookmark.timestamp);
            info.createDiv({ 
                text: date.toLocaleString('ko-KR'), 
                cls: 'bookmark-time' 
            });

            if (bookmark.note) {
                info.createDiv({ 
                    text: bookmark.note, 
                    cls: 'bookmark-note'
                }).style.cssText = 'font-size: 0.85em; color: var(--text-muted); margin-top: 4px; font-style: italic;';
            }

            const actions = item.createDiv({ cls: 'bookmark-actions' });

            // 열기 버튼
            const openBtn = actions.createEl('button', { text: '📖 열기', cls: 'bookmark-btn bookmark-btn-open' });
            openBtn.onclick = async () => {
                const file = this.app.vault.getAbstractFileByPath(bookmark.filePath);
                if (file) {
                    const leaf = this.app.workspace.getLeaf('tab');
                    await leaf.openFile(file);
                    this.close();
                } else {
                    new Notice('❌ 파일을 찾을 수 없습니다');
                }
            };

            // 삭제 버튼
            const deleteBtn = actions.createEl('button', { text: '🗑️', cls: 'bookmark-btn bookmark-btn-delete' });
            deleteBtn.onclick = async () => {
                await this.plugin.removeBookmark(bookmark.filePath, bookmark.cardNumber);
                this.onOpen(); // 새로고침
            };
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// =====================================================
// 북마크 관리 모달
// =====================================================
class BookmarkManageModal extends Modal {
    constructor(app, plugin, onUpdate) {
        super(app);
        this.plugin = plugin;
        this.onUpdate = onUpdate;
        this.bookmarks = plugin.getBookmarks();
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.style.cssText = 'max-width: 800px; height: 70vh;';

        // 헤더
        const header = contentEl.createDiv();
        header.style.cssText = 'padding: 16px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 8px 8px 0 0;';
        header.createEl('h2', { text: '📋 북마크 관리' }).style.margin = '0';

        if (this.bookmarks.length === 0) {
            contentEl.createDiv({ 
                text: '북마크된 카드가 없습니다.',
                cls: 'cloze-empty-message'
            }).style.cssText = 'padding: 40px; text-align: center; color: var(--text-muted);';
            return;
        }

        // 전체 삭제 버튼
        const toolbar = contentEl.createDiv();
        toolbar.style.cssText = 'padding: 12px 16px; background: var(--background-secondary); display: flex; justify-content: space-between; align-items: center;';
        
        const countInfo = toolbar.createEl('span', { text: `총 ${this.bookmarks.length}개` });
        countInfo.style.cssText = 'font-weight: 600; color: var(--text-accent);';
        
        const deleteAllBtn = toolbar.createEl('button', { text: '🗑️ 전체 삭제' });
        deleteAllBtn.style.cssText = 'padding: 6px 12px; background: #ef4444; color: white; border: none; border-radius: 6px; cursor: pointer;';
        deleteAllBtn.onclick = () => {
            if (confirm('모든 북마크를 삭제하시겠습니까?')) {
                this.bookmarks.forEach(bookmark => {
                    this.plugin.removeBookmark(bookmark.filePath, bookmark.cardNumber);
                });
                new Notice('모든 북마크가 삭제되었습니다');
                this.onUpdate();
                this.close();
            }
        };

        // 목록
        const listContainer = contentEl.createDiv();
        listContainer.style.cssText = 'flex: 1; overflow-y: auto; padding: 16px; max-height: 50vh;';

        this.bookmarks.forEach((bookmark, index) => {
            const item = listContainer.createDiv();
            item.style.cssText = 'padding: 12px; background: var(--background-primary); border-radius: 8px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; border-left: 4px solid #667eea;';

            const info = item.createDiv();
            info.style.cssText = 'flex: 1;';
            
            const fileName = info.createEl('div', { text: `📄 ${bookmark.filePath.split('/').pop()}` });
            fileName.style.cssText = 'font-weight: 600; margin-bottom: 4px; color: var(--text-accent);';
            
            const cardNum = info.createEl('div', { text: `Card ${bookmark.cardNumber}` });
            cardNum.style.cssText = 'font-size: 0.9em; color: var(--text-muted);';

            const btnGroup = item.createDiv();
            btnGroup.style.cssText = 'display: flex; gap: 6px;';
            
            const openBtn = btnGroup.createEl('button', { text: '📖 보기' });
            openBtn.style.cssText = 'padding: 6px 12px; background: var(--interactive-accent); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px;';
            openBtn.onclick = async () => {
                const file = this.app.vault.getAbstractFileByPath(bookmark.filePath);
                if (file) {
                    await this.app.workspace.openLinkText(file.path, '', false);
                    this.close();
                }
            };

            const deleteBtn = btnGroup.createEl('button', { text: '🗑️' });
            deleteBtn.style.cssText = 'padding: 6px 12px; background: #ef4444; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px;';
            deleteBtn.onclick = () => {
                this.plugin.removeBookmark(bookmark.filePath, bookmark.cardNumber);
                this.bookmarks.splice(index, 1);
                new Notice('북마크가 삭제되었습니다');
                this.onUpdate();
                this.onOpen(); // 리렌더링
            };
        });

        // 닫기 버튼
        const footer = contentEl.createDiv();
        footer.style.cssText = 'padding: 16px; text-align: center;';
        
        const closeBtn = footer.createEl('button', { text: '닫기' });
        closeBtn.style.cssText = 'padding: 10px 30px; background: var(--background-secondary); border: 1px solid var(--background-modifier-border); border-radius: 8px; cursor: pointer;';
        closeBtn.onclick = () => this.close();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// 북마크 퀴즈 모달
// =====================================================
class BookmarkQuizModal extends Modal {
    constructor(app, plugin) {
        super(app);
        this.plugin = plugin;
        this.bookmarks = plugin.getBookmarks();
        this.currentIndex = 0;
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('quiz-mode-modal');
        contentEl.style.cssText = 'height: 90vh; display: flex; flex-direction: column;';

        if (this.bookmarks.length === 0) {
            contentEl.createEl('p', { text: '북마크된 카드가 없습니다' });
            return;
        }

        // 헤더
        const header = contentEl.createDiv();
        header.style.cssText = 'padding: 16px; border-bottom: 2px solid var(--background-modifier-border); background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;';
        
        const headerTop = header.createDiv();
        headerTop.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;';
        
        const title = headerTop.createEl('h2', { text: '⭐ 북마크 퀴즈' });
        title.style.margin = '0';
        
        this.progressDiv = header.createDiv({ cls: 'quiz-progress' });
        this.progressDiv.style.cssText = 'font-size: 16px; font-weight: 600; margin-top: 8px;';
        
        // 상단 버튼 그룹
        const topButtonBar = header.createDiv();
        topButtonBar.style.cssText = 'margin-top: 12px; display: flex; gap: 6px; flex-wrap: wrap;';
        
        // ☰ 메뉴 버튼
        const menuBtn = topButtonBar.createEl('button');
        menuBtn.innerHTML = '☰';
        menuBtn.setAttribute('aria-label', '메뉴');
        menuBtn.style.cssText = 'flex:1; min-width:44px; min-height:44px; font-size:22px; background: rgba(255,255,255,0.2); color: white; border: none; border-radius: 6px; cursor: pointer; display:flex; align-items:center; justify-content:center;';
        menuBtn.onclick = (e) => {
            const menu = new Menu();
            
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
            
            menu.addItem((item) => {
                item.setTitle('🔀 순서 섞기')
                    .setIcon('shuffle')
                    .onClick(() => {
                        this.bookmarks = this.bookmarks.sort(() => Math.random() - 0.5);
                        this.currentIndex = 0;
                        this.displayCurrent();
                        this.updateProgress();
                        new Notice('📝 북마크 순서가 섞였습니다');
                    });
            });
            
            menu.addItem((item) => {
                item.setTitle('📋 북마크 관리')
                    .setIcon('bookmark')
                    .onClick(() => {
                        new BookmarkManageModal(this.app, this.plugin, () => {
                            this.bookmarks = this.plugin.getBookmarks();
                            if (this.bookmarks.length === 0) {
                                this.close();
                                new Notice('북마크가 모두 삭제되었습니다');
                            } else {
                                if (this.currentIndex >= this.bookmarks.length) {
                                    this.currentIndex = this.bookmarks.length - 1;
                                }
                                this.displayCurrent();
                                this.updateProgress();
                            }
                        }).open();
                    });
            });
            
            menu.showAtMouseEvent(e);
        };
        
        const shuffleBtn = topButtonBar.createEl('button', { text: '🔀' });
        shuffleBtn.setAttribute('aria-label', '섞기');
        shuffleBtn.style.cssText = 'flex:1; min-width:44px; min-height:44px; font-size:18px; background: rgba(255,255,255,0.2); color: white; border: none; border-radius: 6px; cursor: pointer;';
        const shuffleAction = () => {
            this.bookmarks = this.bookmarks.sort(() => Math.random() - 0.5);
            this.currentIndex = 0;
            this.displayCurrent();
            this.updateProgress();
            new Notice('📝 북마크 순서가 섞였습니다');
        };
        shuffleBtn.onclick = shuffleAction;
        shuffleBtn.addEventListener('touchend', (e) => { e.preventDefault(); shuffleAction(); });
        
        const manageBtn = topButtonBar.createEl('button', { text: '📋' });
        manageBtn.setAttribute('aria-label', '북마크 관리');
        manageBtn.style.cssText = 'flex:1; min-width:44px; min-height:44px; font-size:18px; background: rgba(255,255,255,0.2); color: white; border: none; border-radius: 6px; cursor: pointer;';
        const manageAction = () => {
            new BookmarkManageModal(this.app, this.plugin, () => {
                this.bookmarks = this.plugin.getBookmarks();
                if (this.bookmarks.length === 0) {
                    this.close();
                    new Notice('북마크가 모두 삭제되었습니다');
                } else {
                    if (this.currentIndex >= this.bookmarks.length) {
                        this.currentIndex = this.bookmarks.length - 1;
                    }
                    this.displayCurrent();
                    this.updateProgress();
                }
            }).open();
        };
        manageBtn.onclick = manageAction;
        manageBtn.addEventListener('touchend', (e) => { e.preventDefault(); manageAction(); });
        
        const dashboardBtn = topButtonBar.createEl('button', { text: '📊' });
        dashboardBtn.setAttribute('aria-label', '대시보드');
        dashboardBtn.style.cssText = 'flex:1; min-width:44px; min-height:44px; font-size:18px; background: rgba(255,255,255,0.2); color: white; border: none; border-radius: 6px; cursor: pointer;';
        const dashboardAction = () => {
            if (this.plugin.openClozeDashboardView) {
                this.plugin.openClozeDashboardView();
            }
            this.close();
        };
        dashboardBtn.onclick = dashboardAction;
        dashboardBtn.addEventListener('touchend', (e) => { e.preventDefault(); dashboardAction(); });
        
        const openFileBtn = topButtonBar.createEl('button', { text: '📄' });
        openFileBtn.setAttribute('aria-label', '파일 열기');
        openFileBtn.style.cssText = 'flex:1; min-width:44px; min-height:44px; font-size:18px; background: rgba(255,255,255,0.2); color: white; border: none; border-radius: 6px; cursor: pointer;';
        const openFileAction = () => {
            const bookmark = this.bookmarks[this.currentIndex];
            if (bookmark) {
                const file = this.app.vault.getAbstractFileByPath(bookmark.filePath);
                if (file) {
                    this.app.workspace.getLeaf('tab').openFile(file);
                }
            }
        };
        openFileBtn.onclick = openFileAction;
        openFileBtn.addEventListener('touchend', (e) => { e.preventDefault(); openFileAction(); });
        
        const removeBookmarkBtn = topButtonBar.createEl('button', { text: '⭐' });
        removeBookmarkBtn.setAttribute('aria-label', '북마크 해제');
        removeBookmarkBtn.style.cssText = 'flex:1; min-width:44px; min-height:44px; font-size:18px; background: rgba(239,68,68,0.3); color: white; border: none; border-radius: 6px; cursor: pointer;';
        const removeBookmarkAction = () => {
            const bookmark = this.bookmarks[this.currentIndex];
            this.plugin.removeBookmark(bookmark.filePath, bookmark.cardNumber);
            this.bookmarks.splice(this.currentIndex, 1);
            
            if (this.bookmarks.length === 0) {
                this.close();
                new Notice('모든 북마크가 해제되었습니다');
                return;
            }
            
            if (this.currentIndex >= this.bookmarks.length) {
                this.currentIndex = this.bookmarks.length - 1;
            }
            
            this.displayCurrent();
            this.updateProgress();
            new Notice('북마크가 해제되었습니다');
        };
        removeBookmarkBtn.onclick = removeBookmarkAction;
        removeBookmarkBtn.addEventListener('touchend', (e) => { e.preventDefault(); removeBookmarkAction(); });
        
        const closeBtn = topButtonBar.createEl('button', { text: '❌' });
        closeBtn.setAttribute('aria-label', '종료');
        closeBtn.style.cssText = 'flex:1; min-width:44px; min-height:44px; font-size:18px; background: var(--background-modifier-error); color: white; border: none; border-radius: 6px; cursor: pointer;';
        const closeAction = () => this.close();
        closeBtn.onclick = closeAction;
        closeBtn.addEventListener('touchend', (e) => { e.preventDefault(); closeAction(); });

        // 내용
        const content = contentEl.createDiv();
        content.style.cssText = 'flex: 1; overflow-y: auto; padding: 20px;';
        this.contentContainer = content;

        // 하단 버튼 그룹 (일반 퀴즈와 동일)
        const navButtons = contentEl.createDiv();
        navButtons.style.cssText = 'display: flex; gap: 8px; justify-content: center; align-items: center; padding: 12px; background: var(--background-secondary); border-top: 1px solid var(--background-modifier-border);';
        
        // 버튼 생성 함수
        const makeBtn = (icon, aria, style, onClick) => {
            const btn = navButtons.createEl('button');
            btn.innerHTML = icon;
            btn.setAttribute('aria-label', aria);
            btn.style.cssText = style + 'min-width:44px; min-height:44px; padding:8px 12px; font-size:18px; display:flex; align-items:center; justify-content:center; border-radius:8px; border:none; cursor:pointer;';
            btn.onclick = onClick;
            btn.addEventListener('touchend', (e) => { e.preventDefault(); onClick(); });
            return btn;
        };
        
        // ◀️ 이전
        makeBtn('◀️', '이전', 'background:var(--interactive-accent);color:var(--text-on-accent);', () => this.previousCard());
        
        // ⏸️ 일시정지
        this.pauseBtn = makeBtn('⏸️', '일시정지', 'background:var(--background-modifier-border);', () => this.togglePause());
        
        // 💡 정답 보기
        makeBtn('💡', '정답', 'background:#10b981;color:white;', () => this.revealAnswer());
        
        // ▶️ 다음
        makeBtn('▶️', '다음', 'background:var(--interactive-accent);color:var(--text-on-accent);', () => this.nextCard());
        
        // 🔄 새로고침
        makeBtn('🔄', '새로고침', 'background:var(--interactive-accent);color:var(--text-on-accent);', () => {
            this.currentIndex = 0;
            this.displayCurrent();
            this.updateProgress();
            new Notice('🔄 북마크 퀴즈를 새로고침했습니다');
        });

        this.updateProgress();
        await this.displayCurrent();
    }
    
    updateProgress() {
        if (this.progressDiv) {
            this.progressDiv.textContent = `${this.currentIndex + 1} / ${this.bookmarks.length}`;
        }
    }
    
    revealAnswer() {
        const cloze = this.contentContainer.querySelector('.genuine-cloze[data-show-state="hint"]');
        if (cloze) {
            cloze.setAttribute('data-show-state', 'answer');
            this.plugin.updateClozeDisplay(cloze);
            
            // 이미지 빈칸인 경우
            const wrapper = cloze.closest('.image-cloze-wrapper');
            if (wrapper) {
                const img = wrapper.querySelector('img');
                if (img) {
                    this.plugin.updateImageClozeDisplay(cloze, img);
                }
            }
            
            new Notice('💡 정답이 공개되었습니다');
        } else {
            new Notice('모든 빈칸이 이미 공개되었습니다');
        }
    }

    previousCard() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            this.displayCurrent();
            this.updateProgress();
        } else {
            new Notice('첫 번째 카드입니다');
        }
    }

    nextCard() {
        if (this.currentIndex < this.bookmarks.length - 1) {
            this.currentIndex++;
            this.displayCurrent();
            this.updateProgress();
        } else {
            new Notice('마지막 카드입니다');
        }
    }

    togglePause() {
        this.isPaused = !this.isPaused;
        if (this.pauseBtn) {
            this.pauseBtn.innerHTML = this.isPaused ? '▶️' : '⏸️';
            this.pauseBtn.setAttribute('aria-label', this.isPaused ? '재개' : '일시정지');
        }
        new Notice(this.isPaused ? '⏸️ 일시정지됨' : '▶️ 재개됨');
    }

    async displayCurrent() {
        const bookmark = this.bookmarks[this.currentIndex];
        const container = this.contentContainer;
        container.empty();

        const file = this.app.vault.getAbstractFileByPath(bookmark.filePath);
        if (!file) {
            container.createEl('p', { text: '❌ 파일을 찾을 수 없습니다' });
            return;
        }

        // 파일명 표시
        const fileNameDiv = container.createDiv();
        fileNameDiv.style.cssText = 'font-size: 18px; font-weight: 600; margin-bottom: 16px; color: #FF8C00;';
        fileNameDiv.textContent = `📄 ${file.basename}`;

        // 카드 번호 표시
        const cardDiv = container.createDiv();
        cardDiv.style.cssText = 'font-size: 14px; font-weight: 600; margin-bottom: 12px; color: var(--text-accent);';
        cardDiv.textContent = `Card ${bookmark.cardNumber}`;

        // 노트 내용 표시
        const content = await this.app.vault.read(file);
        const contentDiv = container.createDiv({ cls: 'quiz-note-content' });
        contentDiv.style.cssText = 'line-height: 1.6; font-size: 16px; padding: 16px; background: var(--background-primary-alt); border-radius: 8px;';

        const component = new Component();
        component.load();
        await MarkdownRenderer.render(this.app, content, contentDiv, file.path, component);

        // 빈칸 처리
        this.plugin.processClozes(contentDiv, {
            addedNodes: [contentDiv],
            app: this.app,
            sourcePath: file.path,
            frontmatter: null
        });

        // 현재 카드만 genuine으로 설정
        const clozes = contentDiv.querySelectorAll('.genuine-cloze, .pseudo-cloze');
        clozes.forEach(cloze => {
            const id = parseInt(cloze.getAttribute('data-cloze-id'));
            if (id === bookmark.cardNumber) {
                cloze.classList.remove('pseudo-cloze');
                cloze.classList.add('genuine-cloze');
                cloze.setAttribute('data-show-state', 'hint');
            } else {
                cloze.classList.remove('genuine-cloze');
                cloze.classList.add('pseudo-cloze');
                cloze.setAttribute('data-show-state', 'answer');
            }
        });
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
        btnContainer.style.cssText = 'display: flex; gap: 10px; justify-content: flex-end;';

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
        
        // 텍스트 입력
        form.createEl('label', { text: '내용' });
        const textArea = form.createEl('textarea');
        textArea.value = this.currentText;
        textArea.style.cssText = 'width: 100%; min-height: 100px; margin-bottom: 10px; padding: 10px;';

        // 이미지 업로드 섹션
        const imageSection = form.createDiv();
        imageSection.style.cssText = 'margin-bottom: 15px;';
        
        const imageLabel = imageSection.createEl('label', { text: '이미지 첨부' });
        imageLabel.style.cssText = 'display: block; margin-bottom: 5px;';
        
        const imageInput = imageSection.createEl('textarea', {
            placeholder: '이미지 경로를 입력하세요 (예: [[이미지.png]])'
        });
        imageInput.style.cssText = 'width: 100%; min-height: 60px; padding: 8px; font-size: 0.9em;';
        
        // 이미지 미리보기
        const imagePreview = imageSection.createDiv();
        imagePreview.style.cssText = 'margin-top: 8px;';
        
        const updatePreview = () => {
            imagePreview.empty();
            const imagePath = imageInput.value.trim();
            if (imagePath) {
                const lines = imagePath.split('\n').filter(line => line.trim());
                lines.forEach(line => {
                    let path = line.trim();
                    if (path.includes('[[') && path.includes(']]')) {
                        const match = path.match(/\[\[(.+?)\]\]/);
                        if (match) {
                            path = match[1];
                        }
                    }
                    
                    const img = imagePreview.createEl('img');
                    img.style.cssText = 'max-width: 150px; max-height: 150px; margin: 5px; border-radius: 6px; object-fit: cover;';
                    img.src = this.app.vault.adapter.getResourcePath(path);
                    img.onerror = () => {
                        img.style.display = 'none';
                    };
                });
            }
        };
        
        imageInput.addEventListener('input', updatePreview);
        
        // 이미지 붙여넣기 지원
        imageInput.addEventListener('paste', async (e) => {
            const items = e.clipboardData?.items;
            if (!items) return;

            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                if (item.type.indexOf('image') !== -1) {
                    e.preventDefault();
                    const blob = item.getAsFile();
                    if (!blob) continue;

                    try {
                        const attachmentFolder = '첨부파일';
                        const folderExists = await this.app.vault.adapter.exists(attachmentFolder);
                        if (!folderExists) {
                            await this.app.vault.createFolder(attachmentFolder);
                        }

                        const now = new Date();
                        const timestamp = now.getFullYear() + 
                            String(now.getMonth() + 1).padStart(2, '0') + 
                            String(now.getDate()).padStart(2, '0') + 
                            String(now.getHours()).padStart(2, '0') + 
                            String(now.getMinutes()).padStart(2, '0') + 
                            String(now.getSeconds()).padStart(2, '0') + 
                            String(now.getMilliseconds()).padStart(3, '0');

                        const extension = item.type.split('/')[1] || 'png';
                        const fileName = `Pasted_${timestamp}.${extension}`;
                        const filePath = `${attachmentFolder}/${fileName}`;

                        const arrayBuffer = await blob.arrayBuffer();
                        await this.app.vault.adapter.writeBinary(filePath, new Uint8Array(arrayBuffer));

                        const newImageLink = `![[${filePath}|250]]`;
                        const existingValue = imageInput.value || '';
                        imageInput.value = existingValue ? existingValue + '\n' + newImageLink : newImageLink;
                        updatePreview();

                        new Notice('✅ 이미지 붙여넣기 완료');
                    } catch (error) {
                        console.error('이미지 붙여넣기 실패:', error);
                        new Notice('❌ 붙여넣기 실패');
                    }
                    break;
                }
            }
        });
        
        // 파일 선택 버튼
        const fileBtn = imageSection.createEl('button', { text: '📁 파일 선택' });
        fileBtn.type = 'button';
        fileBtn.style.cssText = 'margin-top: 5px; padding: 6px 12px; background: var(--interactive-accent); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.9em;';
        fileBtn.onclick = () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.multiple = true;
            input.onchange = async (e) => {
                const files = e.target.files;
                if (!files || files.length === 0) return;

                try {
                    const attachmentFolder = '첨부파일';
                    const folderExists = await this.app.vault.adapter.exists(attachmentFolder);
                    if (!folderExists) {
                        await this.app.vault.createFolder(attachmentFolder);
                    }

                    const links = [];
                    for (const file of files) {
                        const fileName = file.name;
                        const filePath = `${attachmentFolder}/${fileName}`;
                        
                        const arrayBuffer = await file.arrayBuffer();
                        await this.app.vault.adapter.writeBinary(filePath, new Uint8Array(arrayBuffer));
                        
                        links.push(`![[${filePath}|250]]`);
                    }

                    const existingValue = imageInput.value || '';
                    imageInput.value = existingValue ? existingValue + '\n' + links.join('\n') : links.join('\n');
                    updatePreview();

                    new Notice(`✅ ${files.length}개 이미지 업로드 완료`);
                } catch (error) {
                    console.error('이미지 업로드 실패:', error);
                    new Notice('❌ 업로드 실패');
                }
            };
            input.click();
        };

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
            const images = imageInput.value.trim();
            const fullText = images ? `${text}\n\n${images}` : text;
            if (fullText) {
                this.onSave(fullText);
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

// 일별 체크리스트 추가 모달
class DailyRoutineAddModal extends Modal {
    constructor(app, plugin, onAdd) {
        super(app);
        this.plugin = plugin;
        this.onAdd = onAdd;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        contentEl.createEl('h2', { text: '체크리스트 항목 추가' });
        
        const input = contentEl.createEl('input', { type: 'text', placeholder: '학습 목표를 입력하세요' });
        input.style.cssText = 'width: 100%; padding: 8px; margin: 10px 0; font-size: 1em;';
        
        const btnContainer = contentEl.createDiv();
        btnContainer.style.cssText = 'display: flex; gap: 8px; justify-content: flex-end; margin-top: 10px;';
        
        const addBtn = btnContainer.createEl('button', { text: '추가' });
        addBtn.style.cssText = 'padding: 8px 16px; background: var(--interactive-accent); color: white; border: none; border-radius: 6px; cursor: pointer;';
        addBtn.onclick = async () => {
            const text = input.value.trim();
            if (text) {
                await this.onAdd(text);
                this.close();
                new Notice('✅ 항목 추가됨');
            }
        };
        
        const cancelBtn = btnContainer.createEl('button', { text: '취소' });
        cancelBtn.style.cssText = 'padding: 8px 16px; background: var(--background-secondary); border: 1px solid var(--background-modifier-border); border-radius: 6px; cursor: pointer;';
        cancelBtn.onclick = () => this.close();
        
        input.focus();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// 일별 일정 추가 모달
class DailyTaskAddModal extends Modal {
    constructor(app, plugin, onAdd, defaultHour = null) {
        super(app);
        this.plugin = plugin;
        this.onAdd = onAdd;
        this.defaultHour = defaultHour;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        contentEl.createEl('h2', { text: '시간별 일정 추가' });
        
        const hourSelect = contentEl.createEl('select');
        hourSelect.style.cssText = 'width: 100%; padding: 8px; margin: 10px 0; font-size: 1em;';
        
        for (let i = 0; i < 24; i++) {
            const ampm = i < 12 ? 'AM' : 'PM';
            const displayHour = i === 0 ? 12 : (i > 12 ? i - 12 : i);
            const option = hourSelect.createEl('option', { 
                text: `${displayHour} ${ampm}`,
                value: i.toString()
            });
            if (this.defaultHour !== null && i === this.defaultHour) {
                option.selected = true;
            }
        }
        
        const input = contentEl.createEl('input', { type: 'text', placeholder: '일정 내용을 입력하세요' });
        input.style.cssText = 'width: 100%; padding: 8px; margin: 10px 0; font-size: 1em;';
        
        const btnContainer = contentEl.createDiv();
        btnContainer.style.cssText = 'display: flex; gap: 8px; justify-content: flex-end; margin-top: 10px;';
        
        const addBtn = btnContainer.createEl('button', { text: '추가' });
        addBtn.style.cssText = 'padding: 8px 16px; background: var(--interactive-accent); color: white; border: none; border-radius: 6px; cursor: pointer;';
        addBtn.onclick = async () => {
            const text = input.value.trim();
            const hour = parseInt(hourSelect.value);
            if (text) {
                await this.onAdd(hour, text);
                this.close();
                new Notice('✅ 일정 추가됨');
            }
        };
        
        const cancelBtn = btnContainer.createEl('button', { text: '취소' });
        cancelBtn.style.cssText = 'padding: 8px 16px; background: var(--background-secondary); border: 1px solid var(--background-modifier-border); border-radius: 6px; cursor: pointer;';
        cancelBtn.onclick = () => this.close();
        
        input.focus();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// 일별 메모 추가 모달
class DailyNoteAddModal extends Modal {
    constructor(app, plugin, onAdd) {
        super(app);
        this.plugin = plugin;
        this.onAdd = onAdd;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        contentEl.createEl('h2', { text: '학습 메모 추가' });
        
        const textarea = contentEl.createEl('textarea', { placeholder: '학습 내용을 자유롭게 기록하세요' });
        textarea.style.cssText = 'width: 100%; min-height: 100px; padding: 8px; margin: 10px 0; font-size: 1em; resize: vertical;';
        
        const btnContainer = contentEl.createDiv();
        btnContainer.style.cssText = 'display: flex; gap: 8px; justify-content: flex-end; margin-top: 10px;';
        
        const addBtn = btnContainer.createEl('button', { text: '추가' });
        addBtn.style.cssText = 'padding: 8px 16px; background: var(--interactive-accent); color: white; border: none; border-radius: 6px; cursor: pointer;';
        addBtn.onclick = async () => {
            const text = textarea.value.trim();
            if (text) {
                await this.onAdd(text);
                this.close();
                new Notice('✅ 메모 추가됨');
            }
        };
        
        const cancelBtn = btnContainer.createEl('button', { text: '취소' });
        cancelBtn.style.cssText = 'padding: 8px 16px; background: var(--background-secondary); border: 1px solid var(--background-modifier-border); border-radius: 6px; cursor: pointer;';
        cancelBtn.onclick = () => this.close();
        
        textarea.focus();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// 체크리스트 템플릿 모달
class ChecklistTemplateModal extends Modal {
    constructor(app, plugin, onApply, currentItems = []) {
        super(app);
        this.plugin = plugin;
        this.onApply = onApply;
        this.currentItems = currentItems;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        contentEl.createEl('h2', { text: '📋 체크리스트 템플릿' });
        
        // 현재 체크리스트를 템플릿으로 저장
        if (this.currentItems.length > 0) {
            const saveSection = contentEl.createDiv();
            saveSection.style.cssText = 'background: var(--background-secondary); padding: 16px; border-radius: 8px; margin-bottom: 20px;';
            
            saveSection.createEl('h3', { text: '현재 체크리스트를 템플릿으로 저장' });
            saveSection.createEl('p', { 
                text: `현재 ${this.currentItems.length}개 항목`,
                cls: 'setting-item-description'
            });
            
            const nameInput = saveSection.createEl('input', { 
                type: 'text', 
                placeholder: '템플릿 이름 (예: 일일 루틴)' 
            });
            nameInput.style.cssText = 'width: 100%; padding: 8px; margin: 10px 0; font-size: 1em;';
            
            const saveBtn = saveSection.createEl('button', { text: '💾 현재 체크리스트 저장' });
            saveBtn.style.cssText = 'padding: 8px 16px; background: var(--interactive-accent); color: white; border: none; border-radius: 6px; cursor: pointer; width: 100%;';
            saveBtn.onclick = async () => {
                const name = nameInput.value.trim();
                if (!name) {
                    new Notice('템플릿 이름을 입력하세요');
                    return;
                }
                
                const items = this.currentItems.map(item => typeof item === 'string' ? item : item.text);
                this.plugin.settings.checklistTemplates.push({ name, items });
                await this.plugin.saveSettings();
                new Notice(`✅ '${name}' 템플릿 저장됨`);
                this.onOpen(); // 새로고침
            };
        }
        
        // 저장된 템플릿 목록
        const templateSection = contentEl.createDiv();
        templateSection.style.cssText = 'margin-top: 20px;';
        
        templateSection.createEl('h3', { text: '저장된 템플릿' });
        
        const templates = this.plugin.settings.checklistTemplates || [];
        
        if (templates.length === 0) {
            templateSection.createEl('p', { 
                text: '저장된 템플릿이 없습니다.',
                cls: 'setting-item-description'
            });
        } else {
            const templateList = templateSection.createDiv();
            templateList.style.cssText = 'display: flex; flex-direction: column; gap: 12px;';
            
            templates.forEach((template, index) => {
                const templateBox = templateList.createDiv();
                templateBox.style.cssText = 'background: var(--background-secondary); padding: 12px; border-radius: 8px;';
                
                const header = templateBox.createDiv();
                header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;';
                
                header.createEl('strong', { text: template.name });
                header.createEl('span', { 
                    text: `${template.items.length}개 항목`,
                    cls: 'setting-item-description'
                });
                
                const itemPreview = templateBox.createDiv();
                itemPreview.style.cssText = 'font-size: 0.9em; color: var(--text-muted); margin-bottom: 8px;';
                itemPreview.setText(template.items.slice(0, 3).join(', ') + (template.items.length > 3 ? '...' : ''));
                
                const btnGroup = templateBox.createDiv();
                btnGroup.style.cssText = 'display: flex; gap: 8px;';
                
                const applyBtn = btnGroup.createEl('button', { text: '적용' });
                applyBtn.style.cssText = 'flex: 1; padding: 6px 12px; background: var(--interactive-accent); color: white; border: none; border-radius: 6px; cursor: pointer;';
                applyBtn.onclick = () => {
                    this.onApply(template.items);
                    this.close();
                    new Notice(`✅ '${template.name}' 템플릿 적용됨`);
                };
                
                const editBtn = btnGroup.createEl('button', { text: '수정' });
                editBtn.style.cssText = 'padding: 6px 12px; background: var(--background-modifier-border); border: none; border-radius: 6px; cursor: pointer;';
                editBtn.onclick = () => {
                    new TemplateEditModal(this.app, this.plugin, template, index, () => {
                        this.onOpen(); // 새로고침
                    }).open();
                };
                
                const deleteBtn = btnGroup.createEl('button', { text: '삭제' });
                deleteBtn.style.cssText = 'padding: 6px 12px; background: #ef4444; color: white; border: none; border-radius: 6px; cursor: pointer;';
                deleteBtn.onclick = async () => {
                    if (confirm(`'${template.name}' 템플릿을 삭제하시겠습니까?`)) {
                        this.plugin.settings.checklistTemplates.splice(index, 1);
                        await this.plugin.saveSettings();
                        new Notice(`🗑️ '${template.name}' 템플릿 삭제됨`);
                        this.onOpen(); // 새로고침
                    }
                };
            });
        }
        
        const cancelBtn = contentEl.createEl('button', { text: '닫기' });
        cancelBtn.style.cssText = 'margin-top: 20px; padding: 8px 16px; background: var(--background-secondary); border: 1px solid var(--background-modifier-border); border-radius: 6px; cursor: pointer; width: 100%;';
        cancelBtn.onclick = () => this.close();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// 템플릿 수정 모달
class TemplateEditModal extends Modal {
    constructor(app, plugin, template, templateIndex, onSave) {
        super(app);
        this.plugin = plugin;
        this.template = template;
        this.templateIndex = templateIndex;
        this.onSave = onSave;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        contentEl.createEl('h2', { text: '📝 템플릿 수정' });
        
        // 템플릿 이름
        const nameSection = contentEl.createDiv();
        nameSection.style.cssText = 'margin-bottom: 20px;';
        nameSection.createEl('label', { text: '템플릿 이름' });
        const nameInput = nameSection.createEl('input', { 
            type: 'text',
            value: this.template.name
        });
        nameInput.style.cssText = 'width: 100%; padding: 8px; margin-top: 5px; font-size: 1em;';
        
        // 항목 리스트
        const itemsSection = contentEl.createDiv();
        itemsSection.style.cssText = 'margin-bottom: 20px;';
        itemsSection.createEl('label', { text: '체크리스트 항목' });
        
        const itemsList = itemsSection.createDiv();
        itemsList.style.cssText = 'margin-top: 10px; display: flex; flex-direction: column; gap: 8px;';
        
        const renderItems = () => {
            itemsList.empty();
            
            this.template.items.forEach((item, index) => {
                const itemDiv = itemsList.createDiv();
                itemDiv.style.cssText = 'display: flex; gap: 8px; align-items: center;';
                
                const itemInput = itemDiv.createEl('input', { 
                    type: 'text',
                    value: item
                });
                itemInput.style.cssText = 'flex: 1; padding: 8px; font-size: 0.95em;';
                itemInput.onchange = () => {
                    this.template.items[index] = itemInput.value.trim();
                };
                
                const deleteBtn = itemDiv.createEl('button', { text: '×' });
                deleteBtn.style.cssText = 'padding: 4px 10px; background: #ef4444; color: white; border: none; border-radius: 4px; cursor: pointer;';
                deleteBtn.onclick = () => {
                    this.template.items.splice(index, 1);
                    renderItems();
                };
            });
            
            // 항목 추가 버튼
            const addItemBtn = itemsList.createEl('button', { text: '+ 항목 추가' });
            addItemBtn.style.cssText = 'padding: 8px; background: var(--background-modifier-border); border: none; border-radius: 6px; cursor: pointer;';
            addItemBtn.onclick = () => {
                this.template.items.push('새 항목');
                renderItems();
            };
        };
        
        renderItems();
        
        // 버튼 그룹
        const btnContainer = contentEl.createDiv();
        btnContainer.style.cssText = 'display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;';
        
        const saveBtn = btnContainer.createEl('button', { text: '저장' });
        saveBtn.style.cssText = 'padding: 8px 16px; background: var(--interactive-accent); color: white; border: none; border-radius: 6px; cursor: pointer;';
        saveBtn.onclick = async () => {
            const name = nameInput.value.trim();
            if (!name) {
                new Notice('템플릿 이름을 입력하세요');
                return;
            }
            
            // 빈 항목 제거
            this.template.items = this.template.items.filter(item => item.trim());
            
            if (this.template.items.length === 0) {
                new Notice('최소 1개 이상의 항목이 필요합니다');
                return;
            }
            
            this.template.name = name;
            this.plugin.settings.checklistTemplates[this.templateIndex] = this.template;
            await this.plugin.saveSettings();
            new Notice(`✅ '${name}' 템플릿 수정됨`);
            this.close();
            this.onSave();
        };
        
        const cancelBtn = btnContainer.createEl('button', { text: '취소' });
        cancelBtn.style.cssText = 'padding: 8px 16px; background: var(--background-secondary); border: 1px solid var(--background-modifier-border); border-radius: 6px; cursor: pointer;';
        cancelBtn.onclick = () => this.close();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

class WeekFolderSelectionModal extends Modal {
    constructor(app, plugin, year, month, weekNum, startDay, endDay) {
        super(app);
        this.plugin = plugin;
        this.year = year;
        this.month = month;
        this.weekNum = weekNum;
        this.startDay = startDay;
        this.endDay = endDay;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        contentEl.createEl('h2', { text: `${this.month + 1}월 ${this.weekNum}주차 (${this.startDay}~${this.endDay}일)` });
        contentEl.createEl('p', { text: '학습할 폴더를 선택하세요', cls: 'setting-item-description' });
        
        const folderList = contentEl.createDiv();
        folderList.style.cssText = 'max-height: 400px; overflow-y: auto; margin-top: 20px;';
        
        // 클로즈 폴더 내의 모든 폴더 가져오기
        const clozeFolder = this.plugin.settings.clozeFolder || 'Cloze Cards';
        const allFolders = this.app.vault.getAllLoadedFiles()
            .filter(f => f.children && f.path.startsWith(clozeFolder))
            .sort((a, b) => a.path.localeCompare(b.path));
        
        if (allFolders.length === 0) {
            folderList.createEl('p', { text: '사용 가능한 폴더가 없습니다.', cls: 'setting-item-description' });
            return;
        }
        
        allFolders.forEach(folder => {
            const folderItem = folderList.createDiv();
            folderItem.style.cssText = 'padding: 12px; margin-bottom: 8px; background: var(--background-secondary); border-radius: 8px; cursor: pointer; transition: all 0.2s; border: 2px solid transparent;';
            
            const folderName = folderItem.createEl('div', { text: `📁 ${folder.name}` });
            folderName.style.cssText = 'font-weight: 600; margin-bottom: 4px;';
            
            const folderPath = folderItem.createEl('div', { text: folder.path });
            folderPath.style.cssText = 'font-size: 0.85em; color: var(--text-muted);';
            
            // 폴더 내 파일 수
            const files = this.app.vault.getMarkdownFiles()
                .filter(f => f.parent?.path === folder.path);
            const fileCount = folderItem.createEl('div', { text: `${files.length}개 파일` });
            fileCount.style.cssText = 'font-size: 0.8em; color: var(--text-accent); margin-top: 4px;';
            
            folderItem.addEventListener('mouseenter', () => {
                folderItem.style.background = 'var(--background-modifier-hover)';
                folderItem.style.borderColor = 'var(--interactive-accent)';
            });
            folderItem.addEventListener('mouseleave', () => {
                folderItem.style.background = 'var(--background-secondary)';
                folderItem.style.borderColor = 'transparent';
            });
            
            const clickHandler = async () => {
                if (files.length === 0) {
                    new Notice('이 폴더에 파일이 없습니다.');
                    return;
                }
                
                this.close();
                
                // QuizModeModal 열기
                new QuizModeModal(
                    this.app,
                    this.plugin,
                    folder.path,
                    null,
                    null,
                    null
                ).open();
            };
            
            let touchStartTime = 0;
            folderItem.addEventListener('touchstart', () => {
                touchStartTime = Date.now();
            }, { passive: true });
            
            folderItem.addEventListener('touchend', async (e) => {
                const touchDuration = Date.now() - touchStartTime;
                if (touchDuration < 500) {
                    e.preventDefault();
                    await clickHandler();
                }
            });
            
            folderItem.onclick = clickHandler;
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// 파일 맨 아래 또는 플러그인 초기화 함수 내부에 아래 코드만 삽입
