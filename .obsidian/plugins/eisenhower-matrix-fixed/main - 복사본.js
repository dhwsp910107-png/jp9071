// ========================================
// Eisenhower Matrix Plugin - Part 1/7
// 초기화, 헬퍼, 플러그인 메인 클래스
// ========================================

const { Plugin, Modal, Notice, ItemView, PluginSettingTab, Setting, TFile } = require('obsidian');

// ==================== 안전한 로깅 헬퍼 ====================
const safeLog = {
    info: (message, ...args) => {
        try {
            if (typeof message === 'object') {
                console.log(`[Eisenhower Matrix]`, message, ...args);
            } else {
                console.log(`[Eisenhower Matrix] ${message}`, ...args);
            }
        } catch (e) {}
    },
    log: (message, ...args) => {
        try {
            if (typeof message === 'object') {
                console.log(`[Eisenhower Matrix]`, message, ...args);
            } else {
                console.log(`[Eisenhower Matrix] ${message}`, ...args);
            }
        } catch (e) {}
    },
    error: (message, ...args) => {
        try {
            if (typeof message === 'object') {
                console.error(`[Eisenhower Matrix] ERROR:`, message, ...args);
            } else {
                console.error(`[Eisenhower Matrix] ERROR: ${message}`, ...args);
            }
        } catch (e) {}
    },
    warn: (message, ...args) => {
        try {
            if (typeof message === 'object') {
                console.warn(`[Eisenhower Matrix] WARNING:`, message, ...args);
            } else {
                console.warn(`[Eisenhower Matrix] WARNING: ${message}`, ...args);
            }
        } catch (e) {}
    }
};

// ==================== 모바일 헬퍼 함수들 ====================
const MobileHelper = {
    // 모바일 디바이스 감지
    isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               window.innerWidth <= 768 ||
               ('ontouchstart' in window);
    },

    // 터치 디바이스 감지
    isTouchDevice() {
        return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    },

    // 작은 화면 감지
    isSmallScreen() {
        return window.innerWidth <= 480;
    },

    // 가로 모드 감지
    isLandscape() {
        return window.innerWidth > window.innerHeight;
    },

    // 터치 이벤트 헬퍼
    addTouchSupport(element, callbacks) {
        if (!this.isTouchDevice()) return;

        let startX, startY, startTime;
        let isDragging = false;
        let longPressTimer;

        const onTouchStart = (e) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            startTime = Date.now();
            isDragging = false;

            // 롱프레스 타이머
            if (callbacks.onLongPress) {
                longPressTimer = setTimeout(() => {
                    callbacks.onLongPress(e);
                }, 500);
            }

            if (callbacks.onTouchStart) {
                callbacks.onTouchStart(e);
            }
        };

        const onTouchMove = (e) => {
            if (!startX || !startY) return;

            const currentX = e.touches[0].clientX;
            const currentY = e.touches[0].clientY;
            const deltaX = Math.abs(currentX - startX);
            const deltaY = Math.abs(currentY - startY);

            if (deltaX > 10 || deltaY > 10) {
                isDragging = true;
                if (longPressTimer) {
                    clearTimeout(longPressTimer);
                    longPressTimer = null;
                }

                if (callbacks.onTouchMove) {
                    callbacks.onTouchMove(e, { deltaX, deltaY });
                }
            }
        };

        const onTouchEnd = (e) => {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }

            const endTime = Date.now();
            const duration = endTime - startTime;

            if (!isDragging && duration < 300) {
                if (callbacks.onTap) {
                    callbacks.onTap(e);
                }
            }

            if (callbacks.onTouchEnd) {
                callbacks.onTouchEnd(e);
            }

            startX = startY = null;
            isDragging = false;
        };

        element.addEventListener('touchstart', onTouchStart, { passive: false });
        element.addEventListener('touchmove', onTouchMove, { passive: false });
        element.addEventListener('touchend', onTouchEnd, { passive: false });

        return () => {
            element.removeEventListener('touchstart', onTouchStart);
            element.removeEventListener('touchmove', onTouchMove);
            element.removeEventListener('touchend', onTouchEnd);
        };
    },

    // 모바일 최적화된 스크롤 추가
    addMobileScroll(element) {
        if (!this.isMobile()) return;

        element.style.overflowY = 'auto';
        element.style.WebkitOverflowScrolling = 'touch';
        element.style.overscrollBehavior = 'contain';
    },

    // 모바일 진동 피드백
    vibrate(pattern = [50]) {
        if (navigator.vibrate && this.isMobile()) {
            navigator.vibrate(pattern);
        }
    }
};

// ==================== 기본 설정 ====================
const DEFAULT_SETTINGS = {
    mainFolder: 'Eisenhower Matrix',
    dailyFolder: 'Daily',
    weeklyFolder: 'Weekly',
    monthlyFolder: 'Monthly',
    yearlyFolder: 'Yearly',
    fileFormat: 'md',
    templateFolder: 'Templates',
    useTemplate: true,
    autoSyncToNote: true,
    deleteFromNote: false,  // 🔥 새로 추가
    dashboardFolder: 'Dashboard',
    dashboardFile: 'Eisenhower Dashboard.md',
    recentFilesCount: 15
};

// ==================== QuickAdd 모달 ====================
class QuickAddTaskModal extends Modal {
    constructor(app, onSubmit) {
        super(app);
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        contentEl.createEl('h3', { text: '빠른 할일 추가' });
        
        const inputContainer = contentEl.createDiv();
        const input = inputContainer.createEl('input', {
            type: 'text',
            placeholder: '할일을 입력하세요...'
        });
        input.style.width = '100%';
        input.style.padding = '10px';
        input.style.marginBottom = '10px';
        input.style.border = '1px solid var(--background-modifier-border)';
        input.style.borderRadius = '4px';
        
        const buttonContainer = contentEl.createDiv();
        buttonContainer.style.textAlign = 'right';
        
        const submitBtn = buttonContainer.createEl('button', { text: '추가' });
        submitBtn.style.marginRight = '10px';
        submitBtn.onclick = () => {
            const text = input.value.trim();
            if (text) {
                this.onSubmit(text);
                this.close();
            }
        };
        
        const cancelBtn = buttonContainer.createEl('button', { text: '취소' });
        cancelBtn.onclick = () => this.close();
        
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                submitBtn.click();
            }
        });
        
        input.focus();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// ==================== 메인 플러그인 클래스 ====================
class EisenhowerMatrixPlugin extends Plugin {
    async onload() {
        safeLog.info('🎯 Eisenhower Matrix Plugin loading...');
        await this.loadSettings();
        
        this.addRibbonIcon('target', 'Open Eisenhower Matrix', () => {
            this.activateView();
        });

        this.registerView('eisenhower-matrix-view', (leaf) => new EisenhowerMatrixView(leaf, this));
        this.addSettingTab(new EisenhowerSettingTab(this.app, this));
        
        this.addCommand({
            id: 'open-eisenhower-matrix',
            name: 'Open Eisenhower Matrix',
            callback: () => this.activateView()
        });

        this.addCommand({
            id: 'quick-add-urgent-important',
            name: '긴급&중요 할일 추가',
            callback: () => this.quickAddTask('q1')
        });

        this.addCommand({
            id: 'quick-add-important',
            name: '중요 할일 추가',
            callback: () => this.quickAddTask('q2')
        });

        this.addCommand({
            id: 'quick-add-urgent',
            name: '긴급 할일 추가',
            callback: () => this.quickAddTask('q3')
        });

        this.addCommand({
            id: 'quick-add-other',
            name: '기타 할일 추가',
            callback: () => this.quickAddTask('q4')
        });
        
        safeLog.info('✅ Eisenhower Matrix Plugin loaded successfully');
    }

    async quickAddTask(quadrant) {
        const modal = new QuickAddTaskModal(this.app, async (taskText) => {
            const leaves = this.app.workspace.getLeavesOfType('eisenhower-matrix-view');
            if (leaves.length > 0) {
                const view = leaves[0].view;
                await view.addTask(quadrant, taskText);
            } else {
                await this.addTaskToCurrentNote(quadrant, taskText);
            }
        });
        modal.open();
    }

    async addTaskToCurrentNote(quadrant, taskText) {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            new Notice('⚠️ 활성 노트가 없습니다');
            return;
        }

        const content = await this.app.vault.read(activeFile);
        const quadrantNames = {
            q1: 'Q1: 중요하고 긴급함',
            q2: 'Q2: 중요하지만 긴급하지 않음',
            q3: 'Q3: 긴급하지만 중요하지 않음',
            q4: 'Q4: 중요하지도 긴급하지도 않음'
        };

        const sectionRegex = new RegExp(`###.*${quadrantNames[quadrant]}[\\s\\S]*?(?=###|$)`, 'i');
        const match = content.match(sectionRegex);

        if (match) {
            const now = new Date();
            const hour = String(now.getHours()).padStart(2, '0');
            const minute = String(now.getMinutes()).padStart(2, '0');
            const timeStr = `${hour}:${minute}`;
            
            const newTask = `- [ ] ${taskText} *생성: ${timeStr}*\n`;
            const updatedSection = match[0].replace(/\n(###|$)/, `\n${newTask}$1`);
            const newContent = content.replace(match[0], updatedSection);
            
            await this.app.vault.modify(activeFile, newContent);
            new Notice(`✅ 할일 추가: ${taskText}`);
        } else {
            new Notice('⚠️ 해당 섹션을 찾을 수 없습니다');
        }
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
            await leaf.setViewState({ type: 'eisenhower-matrix-view', active: true });
        }
        workspace.revealLeaf(leaf);
    }

    onunload() {
        safeLog.info('🎯 Eisenhower Matrix Plugin unloading...');
        this.app.workspace.detachLeavesOfType('eisenhower-matrix-view');
    }
}

// ========================================
// Part 1 끝 - Part 2로 계속...
// ========================================
// ========================================
// Eisenhower Matrix Plugin - Part 2/7
// View 클래스 초기화 및 데이터 관리
// ========================================

class EisenhowerMatrixView extends ItemView {
    constructor(leaf, plugin) {
        super(leaf);
        this.plugin = plugin;
        this.currentPeriod = 'daily';
        this.currentTab = 'matrix';
        this.tasks = this.loadFromStorage();
        this.selectedWeek = 1;
        this.selectedDay = new Date(); // Date 객체로 변경
        this.currentCalendarDate = new Date();
        this.currentYear = new Date().getFullYear(); // 연간 뷰용
        
        // 모바일 최적화 변수들
        this.isMobile = MobileHelper.isMobile();
        this.isTouchDevice = MobileHelper.isTouchDevice();
        this.touchCleanupFunctions = [];
        this.activeContextMenu = null;
        
        this.initializeWeeklyData();
        this.initializeMobileFeatures();
        
        safeLog.info('🎯 EisenhowerMatrixView 초기화 완료', {
            currentPeriod: this.currentPeriod,
            selectedWeek: this.selectedWeek,
            isMobile: this.isMobile,
            isTouchDevice: this.isTouchDevice
        });
    }

    // 안전한 파일 검증 헬퍼 함수 (파일이 없으면 생성)
    async safeGetOrCreateFile(filePath, defaultContent = '') {
        try {
            if (!filePath || typeof filePath !== 'string') {
                safeLog.warn('유효하지 않은 파일 경로:', filePath);
                return null;
            }
            
            let file = this.app.vault.getAbstractFileByPath(filePath);
            if (file && file.path) {
                return file;
            }
            
            // 파일이 없으면 생성
            try {
                safeLog.info('파일을 생성합니다:', filePath);
                file = await this.app.vault.create(filePath, defaultContent);
                return file;
            } catch (createError) {
                safeLog.error('파일 생성 실패:', createError);
                return null;
            }
        } catch (error) {
            safeLog.error('파일 검색/생성 오류:', error);
            return null;
        }
    }

    // 기본 노트 내용 생성 함수들
    getDefaultYearlyContent() {
        const year = new Date().getFullYear();
        return `# ${year}년 계획

## 🎯 연간 목표

### 🔥 Q1: 중요하고 긴급함
- [ ] 

### ⭐ Q2: 중요하지만 긴급하지 않음
- [ ] 

### 👥 Q3: 긴급하지만 중요하지 않음
- [ ] 

### 💤 Q4: 중요하지도 긴급하지도 않음
- [ ] 

---
*이 노트는 Eisenhower Matrix 플러그인에 의해 자동 생성되었습니다.*
`;
    }

    getDefaultMonthlyContent() {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        return `# ${year}년 ${month}월 계획

## 🎯 월간 목표

### 🔥 Q1: 중요하고 긴급함
- [ ] 

### ⭐ Q2: 중요하지만 긴급하지 않음
- [ ] 

### 👥 Q3: 긴급하지만 중요하지 않음
- [ ] 

### 💤 Q4: 중요하지도 긴급하지도 않음
- [ ] 

---
*이 노트는 Eisenhower Matrix 플러그인에 의해 자동 생성되었습니다.*
`;
    }

    getDefaultWeeklyContent() {
        const now = new Date();
        const year = now.getFullYear();
        const week = this.getWeekNumber(now);
        return `# ${year}년 ${week}주차 계획

## 🎯 주간 목표

### 🔥 Q1: 중요하고 긴급함
- [ ] 

### ⭐ Q2: 중요하지만 긴급하지 않음
- [ ] 

### 👥 Q3: 긴급하지만 중요하지 않음
- [ ] 

### 💤 Q4: 중요하지도 긴급하지도 않음
- [ ] 

---
*이 노트는 Eisenhower Matrix 플러그인에 의해 자동 생성되었습니다.*
`;
    }

    // 주차 계산 함수
    getWeekNumber(date) {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
        return weekNo;
    }

    // 안전한 파일 검증 헬퍼 함수 (기존 함수 유지)
    safeGetFile(filePath) {
        try {
            if (!filePath || typeof filePath !== 'string') {
                safeLog.warn('유효하지 않은 파일 경로:', filePath);
                return null;
            }
            
            const file = this.app.vault.getAbstractFileByPath(filePath);
            if (file && file.path) {
                return file;
            }
            
            safeLog.warn('파일을 찾을 수 없습니다:', filePath);
            return null;
        } catch (error) {
            safeLog.error('파일 검색 오류:', error);
            return null;
        }
    }

    // 안전한 파일 읽기
    async safeReadFile(file) {
        try {
            if (!file || !file.path) {
                throw new Error('유효하지 않은 파일 객체');
            }
            return await this.app.vault.read(file);
        } catch (error) {
            safeLog.error('파일 읽기 오류:', error);
            throw error;
        }
    }

    // 안전한 파일 수정
    async safeModifyFile(file, content) {
        try {
            if (!file || !file.path) {
                throw new Error('유효하지 않은 파일 객체');
            }
            if (typeof content !== 'string') {
                throw new Error('유효하지 않은 콘텐츠');
            }
            return await this.app.vault.modify(file, content);
        } catch (error) {
            safeLog.error('파일 수정 오류:', error);
            throw error;
        }
    }
    
    initializeWeeklyData() {
        if (!this.tasks.weekly) {
            this.tasks.weekly = {};
        }
        
        for (let i = 1; i <= 4; i++) {
            const weekKey = `week${i}`;
            if (!this.tasks.weekly[weekKey]) {
                this.tasks.weekly[weekKey] = {
                    q1: [],
                    q2: [],
                    q3: [],
                    q4: []
                };
            }
        }
        
        this.saveToStorage();
    }

    // 모바일 기능 초기화
    initializeMobileFeatures() {
        if (!this.isMobile) return;

        // 화면 회전 감지
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                this.handleOrientationChange();
            }, 100);
        });

        // 화면 크기 변경 감지
        window.addEventListener('resize', () => {
            this.handleScreenResize();
        });

        // 모바일 네비게이션 제스처
        this.initializeMobileGestures();
    }

    // 화면 회전 처리
    handleOrientationChange() {
        safeLog.info('📱 화면 회전 감지');
        
        // 가로 모드에서 매트릭스 레이아웃 조정
        if (MobileHelper.isLandscape()) {
            this.container?.addClass('em-landscape-mode');
        } else {
            this.container?.removeClass('em-landscape-mode');
        }
        
        // 레이아웃 재계산
        setTimeout(() => {
            this.render();
        }, 200);
    }

    // 화면 크기 변경 처리
    handleScreenResize() {
        if (MobileHelper.isSmallScreen()) {
            this.container?.addClass('em-small-screen');
        } else {
            this.container?.removeClass('em-small-screen');
        }
    }

    // 모바일 제스처 초기화
    initializeMobileGestures() {
        if (!this.isTouchDevice) return;

        // 탭 스와이프 제스처 (추후 구현)
        this.initializeTabSwipeGesture();
    }

    // 탭 스와이프 제스처
    initializeTabSwipeGesture() {
        let startX = 0;
        let startY = 0;
        let isSwipeMode = false;

        const onTouchStart = (e) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            isSwipeMode = false;
        };

        const onTouchMove = (e) => {
            if (!startX || !startY) return;

            const currentX = e.touches[0].clientX;
            const currentY = e.touches[0].clientY;
            const deltaX = Math.abs(currentX - startX);
            const deltaY = Math.abs(currentY - startY);

            // 수평 스와이프 감지
            if (deltaX > 50 && deltaX > deltaY * 2) {
                isSwipeMode = true;
                e.preventDefault();
            }
        };

        const onTouchEnd = (e) => {
            if (!isSwipeMode || !startX) return;

            const endX = e.changedTouches[0].clientX;
            const deltaX = endX - startX;

            // 최소 스와이프 거리 확인
            if (Math.abs(deltaX) > 100) {
                if (deltaX > 0) {
                    this.switchToPreviousTab();
                } else {
                    this.switchToNextTab();
                }
                
                MobileHelper.vibrate([30]); // 진동 피드백
            }

            startX = startY = 0;
            isSwipeMode = false;
        };

        // 전역 터치 이벤트 리스너
        document.addEventListener('touchstart', onTouchStart, { passive: false });
        document.addEventListener('touchmove', onTouchMove, { passive: false });
        document.addEventListener('touchend', onTouchEnd, { passive: false });

        // 정리 함수 저장
        this.touchCleanupFunctions.push(() => {
            document.removeEventListener('touchstart', onTouchStart);
            document.removeEventListener('touchmove', onTouchMove);
            document.removeEventListener('touchend', onTouchEnd);
        });
    }

    // 이전 탭으로 전환
    switchToPreviousTab() {
        const tabs = ['matrix', 'dashboard', 'timeline'];
        const currentIndex = tabs.indexOf(this.currentTab);
        const previousIndex = currentIndex === 0 ? tabs.length - 1 : currentIndex - 1;
        this.switchTab(tabs[previousIndex]);
    }

    // 다음 탭으로 전환
    switchToNextTab() {
        const tabs = ['matrix', 'dashboard', 'timeline'];
        const currentIndex = tabs.indexOf(this.currentTab);
        const nextIndex = (currentIndex + 1) % tabs.length;
        this.switchTab(tabs[nextIndex]);
    }

    getViewType() { return 'eisenhower-matrix-view'; }
    getDisplayText() { return 'Eisenhower Matrix'; }
    getIcon() { return 'target'; }

    async onOpen() {
        this.addStyles();
        this.render();
    }

    loadFromStorage() {
        try {
            const stored = localStorage.getItem('eisenhower-matrix-tasks');
            if (stored) {
                const parsed = JSON.parse(stored);
                safeLog.info('✅ Tasks loaded from storage');
                
                // 모바일에서 로딩 피드백
                if (this.isMobile) {
                    MobileHelper.vibrate([30]);
                    new Notice('📱 데이터 로딩 완료', 2000);
                }
                
                if (!parsed.weekly) {
                    parsed.weekly = {};
                    for (let i = 1; i <= 4; i++) {
                        parsed.weekly[`week${i}`] = { q1: [], q2: [], q3: [], q4: [] };
                    }
                }
                
                return parsed;
            }
        } catch (error) {
            safeLog.error('❌ Error loading tasks:', error);
            
            // 모바일에서 오류 피드백
            if (this.isMobile) {
                MobileHelper.vibrate([100, 50, 100]);
                new Notice('❌ 모바일 데이터 로딩 실패', 3000);
            }
        }
        return this.getDefaultTasks();
    }

    saveToStorage() {
        try {
            // 현재 시간을 저장
            const now = Date.now();
            localStorage.setItem('eisenhower-matrix-last-save', now.toString());
            localStorage.setItem('eisenhower-matrix-tasks', JSON.stringify(this.tasks));
            safeLog.info('✅ Tasks saved to storage');
            
            // 모바일에서 저장 피드백
            if (this.isMobile) {
                MobileHelper.vibrate([50, 30]);
                // 백그라운드 저장이므로 조용한 알림
                if (MobileHelper.isSmallScreen()) {
                    new Notice('💾 저장됨', 1500);
                }
            }
        } catch (error) {
            safeLog.error('❌ Error saving tasks:', error);
            new Notice('데이터 저장 실패');
            
            // 모바일에서 오류 피드백
            if (this.isMobile) {
                MobileHelper.vibrate([200, 100, 200]);
            }
        }
    }

    getDefaultTasks() {
        const weeklyTasks = {};
        for (let i = 1; i <= 4; i++) {
            weeklyTasks[`week${i}`] = { q1: [], q2: [], q3: [], q4: [] };
        }
        const monthlyTasks = {};
        for (let i = 1; i <= 31; i++) {
            monthlyTasks[`day${i}`] = { q1: [], q2: [], q3: [], q4: [] };
        }
        return {
            daily: { q1: [], q2: [], q3: [], q4: [] },
            weekly: weeklyTasks,
            monthly: monthlyTasks,
            yearly: { q1: [], q2: [], q3: [], q4: [] }
        };
    }

    getCurrentTasks() {
        if (this.currentPeriod === 'weekly') {
            const weekKey = `week${this.selectedWeek}`;
            if (!this.tasks.weekly) {
                this.tasks.weekly = {};
            }
            if (!this.tasks.weekly[weekKey]) {
                this.tasks.weekly[weekKey] = { q1: [], q2: [], q3: [], q4: [] };
            }
            return this.tasks.weekly[weekKey];
        } else if (this.currentPeriod === 'monthly') {
            // 월간 뷰에서는 전체 월의 모든 할일을 합산
            const monthlyTasks = { q1: [], q2: [], q3: [], q4: [] };
            for (let day = 1; day <= 31; day++) {
                const dayKey = `day${day}`;
                const dayTasks = this.tasks.monthly[dayKey];
                if (dayTasks) {
                    ['q1', 'q2', 'q3', 'q4'].forEach(quadrant => {
                        if (dayTasks[quadrant]) {
                            monthlyTasks[quadrant] = monthlyTasks[quadrant].concat(dayTasks[quadrant]);
                        }
                    });
                }
            }
            return monthlyTasks;
        } else if (this.currentPeriod === 'yearly') {
            // 연간 뷰 데이터 초기화 및 반환
            if (!this.tasks.yearly) {
                this.tasks.yearly = { q1: [], q2: [], q3: [], q4: [] };
            }
            return this.tasks.yearly;
        } else {
            return this.tasks[this.currentPeriod] || { q1: [], q2: [], q3: [], q4: [] };
        }
    }

    render() {
        const container = this.containerEl;
        container.empty();
        container.className = 'eisenhower-matrix-container';

        // 모바일 감지
        if (this.isMobileDevice() || this.isSmallScreen()) {
            container.classList.add('em-mobile-view');
        }

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
        this.applyMobileOptimizations(container);
    }

    updateDateDisplay(container) {
        const now = new Date();
        const dateDisplay = container.createDiv('em-date-display');
        const dateSubtitle = container.createDiv('em-date-subtitle');
        
        dateDisplay.textContent = now.toLocaleDateString('ko-KR', {
            year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
        });
        
        const week = Math.ceil(now.getDate() / 7);
        dateSubtitle.textContent = `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${week}주차`;
    }

    updateStats(container) {
        container.empty();
        const currentTasks = this.getCurrentTasks();
        let total = 0, completed = 0;
        
        ['q1', 'q2', 'q3', 'q4'].forEach(q => {
            const tasks = currentTasks[q] || [];
            total += tasks.length;
            completed += tasks.filter(task => {
                return typeof task === 'object' ? task.completed : false;
            }).length;
        });
        
        const statItems = container.createDiv('em-stat-items');
        this.createStatItem(statItems, '전체', total, '#666');
        this.createStatItem(statItems, '완료', completed, '#4caf50');
        this.createStatItem(statItems, '남은 할일', total - completed, '#ff9800');
        
        if (total > 0) {
            const progressRate = Math.round((completed / total) * 100);
            const periodNames = {
                daily: '오늘',
                weekly: '이번 주',
                monthly: '이번 달',
                yearly: '올해'
            };
            const periodName = periodNames[this.currentPeriod] || '현재';
            container.createDiv('em-overall-progress')
                .createDiv({ cls: 'em-progress-label', text: `${periodName} ${total}개 할일 (${progressRate}% 완료)` });
        }
    }

    createStatItem(container, label, count, color) {
        const item = container.createDiv('em-stat-item');
        const value = item.createDiv('em-stat-value');
        value.textContent = count.toString();
        value.style.color = color;
        item.createDiv({ cls: 'em-stat-label', text: label });
    }

    refreshView() {
        const container = this.containerEl;
        
        // 현재 활성 탭 확인
        const activeTab = container.querySelector('.em-tab-btn.active')?.dataset.tab || 'matrix';
        
        if (activeTab === 'matrix') {
            const matrixGrid = container.querySelector('.em-matrix-grid');
            
            if (this.currentPeriod === 'weekly') {
                if (matrixGrid) this.renderWeeklyMatrix(matrixGrid, this.selectedWeek);
            } else if (this.currentPeriod === 'monthly') {
                this.showDayTasks(this.selectedDay);
                this.updateCalendarIndicators();
            } else if (this.currentPeriod === 'yearly') {
                if (matrixGrid) this.renderYearlyMatrix(matrixGrid);
            } else {
                if (matrixGrid) this.renderMatrix(matrixGrid);
            }
        } else if (activeTab === 'dashboard') {
            const dashboardContent = container.querySelector('[data-content="dashboard"]');
            if (dashboardContent) this.renderDashboardTab(dashboardContent);
        } else if (activeTab === 'timeline') {
            const timelineContent = container.querySelector('[data-content="timeline"]');
            if (timelineContent) this.renderTimelineTab(timelineContent);
        }
        
        // 전체 데이터 저장
        this.saveToStorage();
        
        // 통계 업데이트
        const statsContainer = container.querySelector('.em-stats');
        if (statsContainer) this.updateStats(statsContainer);
        
        new Notice('🔄 화면이 새로고침되었습니다.');
    }

    changePeriod(newPeriod) {
        if (this.currentPeriod === newPeriod) return;
        
        this.currentPeriod = newPeriod;
        
        // 기간 버튼 활성화 상태 업데이트
        this.containerEl.querySelectorAll('.em-period-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.period === newPeriod);
        });
        
        // 매트릭스 탭 다시 렌더링
        const matrixContent = this.containerEl.querySelector('[data-content="matrix"]');
        if (matrixContent && matrixContent.style.display !== 'none') {
            matrixContent.empty();
            this.renderMatrixTab(matrixContent);
        }
        
        new Notice(`📅 ${newPeriod} 뷰로 변경되었습니다.`);
    }

    getFileName(period = null, weekOrDay = null) {
        try {
            const settings = this.plugin?.settings || {};
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');

            const currentPeriod = period || this.currentPeriod;

            let weekOrDayValue = weekOrDay;
            if (weekOrDay instanceof Date) {
                weekOrDayValue = weekOrDay.getDate();
            }

            // 기본 설정값 제공
            const mainFolder = settings.mainFolder || 'Eisenhower Matrix';
            const dailyFolder = settings.dailyFolder || 'Daily';
            const weeklyFolder = settings.weeklyFolder || 'Weekly';
            const monthlyFolder = settings.monthlyFolder || 'Monthly';
            const yearlyFolder = settings.yearlyFolder || 'Yearly';
            const fileFormat = settings.fileFormat || 'md';

            const paths = {
                daily: `${mainFolder}/${dailyFolder}/${year}-${month}-${day}.${fileFormat}`,
                weekly: `${mainFolder}/${weeklyFolder}/${year}-${month}-${weekOrDayValue || this.selectedWeek}주차.${fileFormat}`,
                monthly: `${mainFolder}/${monthlyFolder}/${year}-${month}.${fileFormat}`,
                yearly: `${mainFolder}/${yearlyFolder}/${year}.${fileFormat}`
            };

            return paths[currentPeriod] || paths.daily;
        } catch (error) {
            safeLog.error('파일명 생성 오류:', error);
            // 기본 경로 반환
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            return `Eisenhower Matrix/Daily/${year}-${month}-${day}.md`;
        }
    }

    // 모바일 감지
    isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               (navigator.maxTouchPoints && navigator.maxTouchPoints > 0);
    }
    
    isSmallScreen() {
        return window.innerWidth <= 768;
    }

    applyMobileOptimizations(container) {
        if (this.isMobileDevice() || this.isSmallScreen()) {
            container.style.webkitOverflowScrolling = 'touch';
            this.addSwipeGestures(container);
        }
    }

    addSwipeGestures(container) {
        let startX = 0;
        let startY = 0;
        
        container.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                startX = e.touches[0].clientX;
                startY = e.touches[0].clientY;
            }
        }, { passive: true });
        
        container.addEventListener('touchend', (e) => {
            if (e.changedTouches.length === 1) {
                const endX = e.changedTouches[0].clientX;
                const endY = e.changedTouches[0].clientY;
                const deltaX = endX - startX;
                const deltaY = endY - startY;
                
                if (Math.abs(deltaX) > 50 && Math.abs(deltaY) < 100) {
                    const currentTab = this.containerEl.querySelector('.em-tab-btn.active')?.dataset.tab;
                    
                    if (deltaX > 0 && currentTab === 'dashboard') {
                        this.switchTab('matrix');
                    } else if (deltaX > 0 && currentTab === 'timeline') {
                        this.switchTab('dashboard');
                    } else if (deltaX < 0 && currentTab === 'matrix') {
                        this.switchTab('dashboard');
                    } else if (deltaX < 0 && currentTab === 'dashboard') {
                        this.switchTab('timeline');
                    }
                }
            }
        }, { passive: true });
    }

    // ==================== 할일 추가 ====================
    async addTask(quadrant, taskText = null, period = null, weekOrDay = null) {
        const container = this.containerEl;
        const taskInput = container.querySelector('#em-taskInput');
        
        if (!taskText && taskInput) {
            taskText = taskInput.value.trim();
            taskInput.value = '';
        }
        if (!taskText) taskText = '새 할일';
        
        const currentPeriod = period || this.currentPeriod;
        
        const newTask = {
            text: taskText,
            completed: false,
            createdAt: new Date().toISOString(),
            completedAt: null
        };
        
        if (currentPeriod === 'weekly') {
            const week = weekOrDay || this.selectedWeek;
            const weekKey = `week${week}`;
            
            if (!this.tasks.weekly) this.tasks.weekly = {};
            if (!this.tasks.weekly[weekKey]) {
                this.tasks.weekly[weekKey] = { q1: [], q2: [], q3: [], q4: [] };
            }
            
            this.tasks.weekly[weekKey][quadrant].push(newTask);
            await this.syncTaskToWeekFile(week, quadrant, taskText);
        } else if (currentPeriod === 'monthly') {
            const day = weekOrDay || this.selectedDay;
            const dayKey = `day${day}`;
            if (!this.tasks.monthly[dayKey]) {
                this.tasks.monthly[dayKey] = { q1: [], q2: [], q3: [], q4: [] };
            }
            this.tasks.monthly[dayKey][quadrant].push(newTask);
        } else {
            if (!this.tasks[currentPeriod][quadrant]) {
                this.tasks[currentPeriod][quadrant] = [];
            }
            this.tasks[currentPeriod][quadrant].push(newTask);
        }
        
        this.saveToStorage();
        this.refreshView();
        
        if (this.plugin.settings.autoSyncToNote) {
            this.syncTaskToNote(quadrant, taskText, currentPeriod, weekOrDay).catch(err => {
                safeLog.error('노트 동기화 오류:', err);
            });
        }
        
        new Notice(`✅ 할일 추가: ${taskText}`);
    }

    async syncTaskToNote(quadrant, taskText, period = null, weekOrDay = null) {
        try {
            const fileName = this.getFileName(period, weekOrDay);
            if (!fileName) return;

            let file = this.safeGetFile(fileName);
            
            if (!file) {
                await this.createNoteFromTemplate(period);
                file = this.safeGetFile(fileName);
            }

            if (!file) {
                safeLog.warn('노트 파일을 찾거나 생성할 수 없습니다:', fileName);
                return;
            }

            let content = await this.safeReadFile(file);
            const quadrantNames = {
                q1: 'Q1: 중요하고 긴급함',
                q2: 'Q2: 중요하지만 긴급하지 않음',
                q3: 'Q3: 긴급하지만 중요하지 않음',
                q4: 'Q4: 중요하지도 긴급하지도 않음'
            };

            const sectionRegex = new RegExp(`###.*${quadrantNames[quadrant]}[\\s\\S]*?(?=###|$)`, 'i');
            const match = content.match(sectionRegex);

            if (match) {
                const newTask = `- [ ] ${taskText}\n`;
                const sectionContent = match[0];
                const updatedSection = sectionContent.replace(/(\n*)$/, `\n${newTask}$1`);
                content = content.replace(sectionContent, updatedSection);
                
                content = this.sanitizeYAMLFrontmatter(content);
                await this.safeModifyFile(file, content);
            }
        } catch (error) {
            safeLog.error('노트 동기화 오류:', error);
        }
    }

    async syncTaskToWeekFile(week, quadrant, taskText) {
        try {
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const settings = this.plugin?.settings || {};
            const mainFolder = settings.mainFolder || 'Eisenhower Matrix';
            const weeklyFolder = settings.weeklyFolder || 'Weekly';
            const fileName = `${mainFolder}/${weeklyFolder}/${year}-${month}-${week}주차.md`;
            
            // 파일이 없으면 생성
            let file = await this.safeGetOrCreateFile(fileName, this.getDefaultWeeklyContent());
            if (!file) {
                safeLog.warn('주간 파일을 생성할 수 없습니다:', fileName);
                return;
            }

            let content = await this.safeReadFile(file);
            const quadrantNames = {
                q1: '중요하고 긴급함',
                q2: '중요하지만 긴급하지 않음',
                q3: '긴급하지만 중요하지 않음',
                q4: '중요하지도 긴급하지도 않음'
            };

            const sectionRegex = new RegExp(`###[^\\n]*${quadrantNames[quadrant]}[\\s\\S]*?(?=###|##|$)`, 'i');
            const match = content.match(sectionRegex);

            if (match) {
                const safeTaskText = String(taskText || '새 할일');
                const newTaskLine = `- [ ] ${safeTaskText}\n`;
                const sectionContent = match[0];
                
                if (sectionContent.includes('\n-\n')) {
                    const updatedSection = sectionContent.replace('\n-\n', `\n-\n\n${newTaskLine}`);
                    content = content.replace(sectionContent, updatedSection);
                } else {
                    const updatedSection = sectionContent.replace(/(\n*)$/, `\n${newTaskLine}$1`);
                    content = content.replace(sectionContent, updatedSection);
                }
                
                await this.safeModifyFile(file, content);
            }
        } catch (error) {
            safeLog.error(`${week}주차 파일 동기화 오류:`, error);
        }
    }

    sanitizeYAMLFrontmatter(content) {
        const yamlMatch = content.match(/^---\n([\s\S]*?)\n---/);
        if (!yamlMatch) return content;
        
        const yamlContent = yamlMatch[1];
        const restContent = content.substring(yamlMatch[0].length);
        
        let sanitizedYaml = yamlContent;
        
        // 시간 형식 수정: 한국 형식의 날짜/시간을 ISO 형식으로 변환
        sanitizedYaml = sanitizedYaml.replace(
            /(\w+):\s*"?(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{2}):(\d{2}):?(\d{2})?"?/g,
            (match, field, year, month, day, hour, minute, second) => {
                const formattedMonth = month.padStart(2, '0');
                const formattedDay = day.padStart(2, '0');
                const timeStr = second ? `${hour}:${minute}:${second}` : `${hour}:${minute}`;
                return `${field}: "${year}-${formattedMonth}-${formattedDay} ${timeStr}"`;
            }
        );
        
        // times 배열 처리
        sanitizedYaml = sanitizedYaml.replace(
            /times:\s*\[\s*(.*?)\s*\]/s,
            (match, content) => {
                if (!content.trim()) return 'times: []';
                
                const items = content.split(',').map(item => {
                    const cleanItem = item.trim().replace(/^["']|["']$/g, '');
                    return `"${cleanItem}"`;
                });
                return `times: [${items.join(', ')}]`;
            }
        );
        
        // 잘못된 속성 값 수정 (따옴표 누락)
        sanitizedYaml = sanitizedYaml.replace(
            /^(\w+):\s*([^"'\[\{].*[^"'\]\}])\s*$/gm,
            (match, field, value) => {
                const trimmedValue = value.trim();
                
                // 이미 올바른 형식인지 확인
                if (trimmedValue.startsWith('"') && trimmedValue.endsWith('"')) return match;
                if (trimmedValue.startsWith("'") && trimmedValue.endsWith("'")) return match;
                if (trimmedValue.startsWith('[') || trimmedValue.startsWith('{')) return match;
                
                // 숫자, boolean, null 값은 그대로 유지
                if (/^\d+(\.\d+)?$/.test(trimmedValue)) return match;
                if (trimmedValue === 'true' || trimmedValue === 'false') return match;
                if (trimmedValue === 'null') return match;
                
                // 문자열 값은 따옴표로 감싸기
                return `${field}: "${trimmedValue}"`;
            }
        );
        
        return `---\n${sanitizedYaml}\n---${restContent}`;
    }

    async updateTaskStatus(quadrant, index, taskText, completed) {
        try {
            const currentPeriod = this.currentPeriod;
            
            if (currentPeriod === 'weekly') {
                const week = this.selectedWeek;
                const weekKey = `week${week}`;
                if (this.tasks.weekly[weekKey]?.[quadrant]?.[index]) {
                    const currentTask = this.tasks.weekly[weekKey][quadrant][index];
                    this.tasks.weekly[weekKey][quadrant][index] = {
                        text: typeof currentTask === 'string' ? currentTask : currentTask.text,
                        completed: completed,
                        createdAt: typeof currentTask === 'object' ? currentTask.createdAt : new Date().toISOString(),
                        completedAt: completed ? new Date().toISOString() : null
                    };
                }
            } else if (currentPeriod === 'monthly') {
                const day = this.selectedDay;
                const dayKey = `day${day}`;
                if (this.tasks.monthly[dayKey]?.[quadrant]?.[index]) {
                    const currentTask = this.tasks.monthly[dayKey][quadrant][index];
                    this.tasks.monthly[dayKey][quadrant][index] = {
                        text: typeof currentTask === 'string' ? currentTask : currentTask.text,
                        completed: completed,
                        createdAt: typeof currentTask === 'object' ? currentTask.createdAt : new Date().toISOString(),
                        completedAt: completed ? new Date().toISOString() : null
                    };
                }
            } else {
                if (this.tasks[currentPeriod]?.[quadrant]?.[index]) {
                    const currentTask = this.tasks[currentPeriod][quadrant][index];
                    this.tasks[currentPeriod][quadrant][index] = {
                        text: typeof currentTask === 'string' ? currentTask : currentTask.text,
                        completed: completed,
                        createdAt: typeof currentTask === 'object' ? currentTask.createdAt : new Date().toISOString(),
                        completedAt: completed ? new Date().toISOString() : null
                    };
                }
            }
            
            // 노트 파일에도 시간 정보 업데이트
            await this.updateTaskInNote(quadrant, taskText, completed);
            
            this.saveToStorage();
        } catch (error) {
            safeLog.error('할일 상태 업데이트 오류:', error);
        }
    }

    async updateMonthlyTaskStatus(quadrant, index, taskText, completed, day) {
        try {
            const dayKey = `day${day}`;
            
            if (this.tasks.monthly[dayKey]?.[quadrant]?.[index]) {
                const currentTask = this.tasks.monthly[dayKey][quadrant][index];
                this.tasks.monthly[dayKey][quadrant][index] = {
                    text: typeof currentTask === 'string' ? currentTask : currentTask.text,
                    completed: completed,
                    createdAt: typeof currentTask === 'object' ? currentTask.createdAt : new Date().toISOString(),
                    completedAt: completed ? new Date().toISOString() : null
                };
                
                // 월간 노트 파일에도 업데이트
                await this.updateMonthlyTaskInNote(quadrant, taskText, completed, day);
                
                this.saveToStorage();
                this.refreshView();
            }
        } catch (error) {
            safeLog.error('월간 할일 상태 업데이트 오류:', error);
        }
    }

    async updateMonthlyTaskInNote(quadrant, taskText, completed, day) {
        try {
            const fileName = this.getMonthlyFileName(day);
            if (!fileName) {
                safeLog.warn('월간 노트 파일명을 생성할 수 없습니다');
                return;
            }

            safeLog.log('월간 노트 업데이트 시도:', { fileName, quadrant, taskText, completed, day });

            // 파일이 없으면 생성
            let file = await this.safeGetOrCreateFile(fileName, this.getDefaultMonthlyContent());
            if (!file) {
                safeLog.warn('월간 노트 파일을 생성할 수 없습니다:', fileName);
                return;
            }

            let content = await this.safeReadFile(file);
            
            const now = new Date();
            const timeStr = now.toLocaleTimeString('ko-KR', { 
                hour12: false, 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            
            const uncheckedPattern = `- [ ] ${taskText}`;
            const checkedPattern = `- [x] ${taskText}`;
            
            let updated = false;
            
            if (completed && content.includes(uncheckedPattern)) {
                const completedTask = `- [x] ${taskText} *완료: ${timeStr}*`;
                content = content.replace(uncheckedPattern, completedTask);
                
                // 시간 정보를 frontmatter에도 추가
                await this.addTimeToFile(file, timeStr);
                
                content = this.sanitizeYAMLFrontmatter(content);
                updated = true;
                safeLog.log('월간 할일 완료로 업데이트:', taskText);
            } else if (!completed && content.includes(checkedPattern)) {
                const uncheckedTask = `- [ ] ${taskText}`;
                const escapedText = taskText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const checkedWithTimePattern = new RegExp(`- \\[x\\] ${escapedText} \\*완료: \\d{2}:\\d{2}\\*`);
                if (checkedWithTimePattern.test(content)) {
                    content = content.replace(checkedWithTimePattern, uncheckedTask);
                } else {
                    content = content.replace(checkedPattern, uncheckedTask);
                }
                content = this.sanitizeYAMLFrontmatter(content);
                updated = true;
                safeLog.log('월간 할일 미완료로 업데이트:', taskText);
            }
            
            if (updated) {
                await this.safeModifyFile(file, content);
                safeLog.log('월간 노트 파일 업데이트 완료:', fileName);
            } else {
                safeLog.warn('월간 노트에서 해당 할일을 찾을 수 없습니다:', taskText);
            }
        } catch (error) {
            safeLog.error('월간 노트 할일 상태 업데이트 오류:', error);
        }
    }

    getMonthlyFileName(day) {
        try {
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const settings = this.plugin?.settings || {};
            const folderPath = settings.eisenhowerFolderPath || settings.mainFolder || 'Eisenhower Matrix';
            const monthlyFolder = settings.monthlyFolder || 'Monthly';
            return `${folderPath}/${monthlyFolder}/${year}-${month}.md`;
        } catch (error) {
            safeLog.error('월간 파일명 생성 오류:', error);
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            return `Eisenhower Matrix/Monthly/${year}-${month}.md`;
        }
    }

    async updateYearlyTaskStatus(quadrant, index, taskText, completed) {
        try {
            if (this.tasks.yearly?.[quadrant]?.[index]) {
                const currentTask = this.tasks.yearly[quadrant][index];
                this.tasks.yearly[quadrant][index] = {
                    text: typeof currentTask === 'string' ? currentTask : currentTask.text,
                    completed: completed,
                    createdAt: typeof currentTask === 'object' ? currentTask.createdAt : new Date().toISOString(),
                    completedAt: completed ? new Date().toISOString() : null
                };
                
                // 연간 노트 파일에도 업데이트
                await this.updateYearlyTaskInNote(quadrant, taskText, completed);
                
                this.saveToStorage();
                this.refreshView();
            }
        } catch (error) {
            safeLog.error('연간 할일 상태 업데이트 오류:', error);
        }
    }

    async updateYearlyTaskInNote(quadrant, taskText, completed) {
        try {
            const fileName = this.getYearlyFileName();
            if (!fileName) return;

            // 파일이 없으면 생성
            let file = await this.safeGetOrCreateFile(fileName, this.getDefaultYearlyContent());
            if (!file) return;

            let content = await this.app.vault.read(file);
            
            const now = new Date();
            const timeStr = now.toLocaleTimeString('ko-KR', { 
                hour12: false, 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            
            const uncheckedPattern = `- [ ] ${taskText}`;
            const checkedPattern = `- [x] ${taskText}`;
            
            if (completed && content.includes(uncheckedPattern)) {
                const completedTask = `- [x] ${taskText} *완료: ${timeStr}*`;
                content = content.replace(uncheckedPattern, completedTask);
                
                // 시간 정보를 frontmatter에도 추가
                await this.addTimeToFile(file, timeStr);
                
                content = this.sanitizeYAMLFrontmatter(content);
                await this.app.vault.modify(file, content);
            } else if (!completed && content.includes(checkedPattern)) {
                const uncheckedTask = `- [ ] ${taskText}`;
                const escapedText = taskText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const checkedWithTimePattern = new RegExp(`- \\[x\\] ${escapedText} \\*완료: \\d{2}:\\d{2}\\*`);
                if (checkedWithTimePattern.test(content)) {
                    content = content.replace(checkedWithTimePattern, uncheckedTask);
                } else {
                    content = content.replace(checkedPattern, uncheckedTask);
                }
                content = this.sanitizeYAMLFrontmatter(content);
                await this.app.vault.modify(file, content);
            }
        } catch (error) {
            safeLog.error('연간 노트 할일 상태 업데이트 오류:', error);
        }
    }

   async removeTask(quadrant, index, period = null, weekOrDay = null) {
    const currentPeriod = period || this.currentPeriod;
    let task = '';
    
    if (currentPeriod === 'weekly') {
        const week = weekOrDay || this.selectedWeek;
        const weekKey = `week${week}`;
        if (this.tasks.weekly[weekKey]?.[quadrant]?.[index]) {
            task = this.tasks.weekly[weekKey][quadrant][index];
            this.tasks.weekly[weekKey][quadrant].splice(index, 1);
        }
    } else if (currentPeriod === 'monthly') {
        const day = weekOrDay || this.selectedDay;
        const dayKey = `day${day}`;
        if (this.tasks.monthly[dayKey]?.[quadrant]?.[index]) {
            task = this.tasks.monthly[dayKey][quadrant][index];
            this.tasks.monthly[dayKey][quadrant].splice(index, 1);
        }
    } else {
        if (this.tasks[currentPeriod]?.[quadrant]?.[index]) {
            task = this.tasks[currentPeriod][quadrant][index];
            this.tasks[currentPeriod][quadrant].splice(index, 1);
        }
    }
    
    if (task) {
        this.saveToStorage();
        this.refreshView();
        
        // 🔥 설정 확인 후 파일에서도 삭제
        if (this.plugin.settings.deleteFromNote && this.plugin.settings.autoSyncToNote) {
            this.removeTaskFromNote(quadrant, typeof task === 'object' ? task.text : task, currentPeriod, weekOrDay).catch(err => {
                safeLog.error('노트 동기화 오류:', err);
            });
        }
        
        const fileStatus = this.plugin.settings.deleteFromNote ? '' : ' (뷰에서만)';
        new Notice(`🗑️ 삭제됨${fileStatus}: ${typeof task === 'object' ? task.text : task}`);
    }
}

    async removeTaskFromNote(quadrant, taskText, period = null, weekOrDay = null) {
        try {
            const fileName = this.getFileName(period, weekOrDay);
            if (!fileName) {
                safeLog.warn('파일명을 생성할 수 없습니다');
                return;
            }

            const file = this.safeGetFile(fileName);
            if (!file) {
                safeLog.warn('파일을 찾을 수 없습니다:', fileName);
                return;
            }

            let content = await this.safeReadFile(file);
            
            const taskPatterns = [
                `- [ ] ${taskText}\n`,
                `- [x] ${taskText}\n`,
                `- [ ] ${taskText}`,
                `- [x] ${taskText}`
            ];
            
            let modified = false;
            for (const pattern of taskPatterns) {
                if (content.includes(pattern)) {
                    content = content.replace(pattern, '');
                    modified = true;
                    break;
                }
            }
            
            if (modified) {
                await this.safeModifyFile(file, content);
                safeLog.log('노트에서 할일 제거 완료:', taskText);
            }
        } catch (error) {
            safeLog.error('노트에서 할일 제거 오류:', error);
        }
    }

    async moveTaskToQuadrant(fromQuadrant, toQuadrant, taskIndex, period = null, weekOrDay = null) {
        try {
            const currentPeriod = period || this.currentPeriod;
            let task = null;
            
            safeLog.log('할일 이동 시작:', {
                fromQuadrant,
                toQuadrant,
                taskIndex,
                currentPeriod,
                weekOrDay
            });

            // 소스 분면에서 할일 가져오기
            if (currentPeriod === 'weekly') {
                const week = weekOrDay || this.selectedWeek;
                const weekKey = `week${week}`;
                if (this.tasks.weekly[weekKey]?.[fromQuadrant]?.[taskIndex]) {
                    task = this.tasks.weekly[weekKey][fromQuadrant][taskIndex];
                    this.tasks.weekly[weekKey][fromQuadrant].splice(taskIndex, 1);
                    
                    // 대상 분면에 할일 추가
                    if (!this.tasks.weekly[weekKey][toQuadrant]) {
                        this.tasks.weekly[weekKey][toQuadrant] = [];
                    }
                    this.tasks.weekly[weekKey][toQuadrant].push(task);
                }
            } else if (currentPeriod === 'monthly') {
                const day = weekOrDay || this.selectedDay;
                const dayKey = `day${day}`;
                if (this.tasks.monthly[dayKey]?.[fromQuadrant]?.[taskIndex]) {
                    task = this.tasks.monthly[dayKey][fromQuadrant][taskIndex];
                    this.tasks.monthly[dayKey][fromQuadrant].splice(taskIndex, 1);
                    
                    // 대상 분면에 할일 추가
                    if (!this.tasks.monthly[dayKey][toQuadrant]) {
                        this.tasks.monthly[dayKey][toQuadrant] = [];
                    }
                    this.tasks.monthly[dayKey][toQuadrant].push(task);
                }
            } else {
                if (this.tasks[currentPeriod]?.[fromQuadrant]?.[taskIndex]) {
                    task = this.tasks[currentPeriod][fromQuadrant][taskIndex];
                    this.tasks[currentPeriod][fromQuadrant].splice(taskIndex, 1);
                    
                    // 대상 분면에 할일 추가
                    if (!this.tasks[currentPeriod][toQuadrant]) {
                        this.tasks[currentPeriod][toQuadrant] = [];
                    }
                    this.tasks[currentPeriod][toQuadrant].push(task);
                }
            }

            if (task) {
                // 시간 배열 업데이트 - 이동 시간 기록
                const now = new Date();
                const timeStr = now.toLocaleTimeString('ko-KR', { 
                    hour12: false, 
                    hour: '2-digit', 
                    minute: '2-digit' 
                });

                if (typeof task === 'object' && task.times) {
                    task.times.push(timeStr);
                } else if (typeof task === 'string') {
                    // 문자열 할일을 객체로 변환
                    const taskText = task;
                    task = {
                        text: taskText,
                        completed: false,
                        times: [timeStr]
                    };
                    
                    // 업데이트된 객체로 교체
                    if (currentPeriod === 'weekly') {
                        const week = weekOrDay || this.selectedWeek;
                        const weekKey = `week${week}`;
                        const targetArray = this.tasks.weekly[weekKey][toQuadrant];
                        targetArray[targetArray.length - 1] = task;
                    } else if (currentPeriod === 'monthly') {
                        const day = weekOrDay || this.selectedDay;
                        const dayKey = `day${day}`;
                        const targetArray = this.tasks.monthly[dayKey][toQuadrant];
                        targetArray[targetArray.length - 1] = task;
                    } else {
                        const targetArray = this.tasks[currentPeriod][toQuadrant];
                        targetArray[targetArray.length - 1] = task;
                    }
                }

                this.saveToStorage();
                this.refreshView();

                // 노트 동기화
                if (this.plugin.settings.autoSyncToNote) {
                    const taskText = typeof task === 'object' ? task.text : task;
                    
                    // 원본 분면에서 제거
                    await this.removeTaskFromNote(fromQuadrant, taskText, currentPeriod, weekOrDay);
                    
                    // 대상 분면에 추가
                    await this.addTaskToNote(toQuadrant, taskText, currentPeriod, weekOrDay);
                }

                const quadrantNames = {
                    'urgent-important': '1분면 (긴급&중요)',
                    'important-not-urgent': '2분면 (중요&긴급하지않음)',
                    'urgent-not-important': '3분면 (긴급&중요하지않음)',
                    'not-urgent-not-important': '4분면 (긴급하지않음&중요하지않음)'
                };

                const taskText = typeof task === 'object' ? task.text : task;
                new Notice(`🔄 "${taskText}"을(를) ${quadrantNames[fromQuadrant]}에서 ${quadrantNames[toQuadrant]}으로 이동했습니다`);
                
                safeLog.log('할일 이동 완료:', {
                    taskText,
                    fromQuadrant,
                    toQuadrant,
                    updatedTask: task
                });
            } else {
                safeLog.warn('이동할 할일을 찾을 수 없습니다:', {
                    fromQuadrant,
                    taskIndex,
                    currentPeriod
                });
            }
        } catch (error) {
            safeLog.error('할일 이동 오류:', error);
            new Notice('❌ 할일 이동 중 오류가 발생했습니다');
        }
    }

    async updateTaskInNote(quadrant, taskText, completed = false) {
        try {
            const fileName = this.getFileName();
            if (!fileName) {
                safeLog.warn('노트 파일명을 생성할 수 없습니다');
                return;
            }

            safeLog.log('노트 업데이트 시도:', { fileName, quadrant, taskText, completed });

            const file = this.safeGetFile(fileName);
            if (!file) {
                safeLog.warn('노트 파일이 존재하지 않습니다:', fileName);
                // 노트 파일이 없으면 생성 시도
                await this.createNoteFromTemplate();
                return;
            }

            let content = await this.safeReadFile(file);
            
            const now = new Date();
            const timeStr = now.toLocaleTimeString('ko-KR', { 
                hour12: false, 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            
            const uncheckedPattern = `- [ ] ${taskText}`;
            const checkedPattern = `- [x] ${taskText}`;
            
            let updated = false;
            
            if (completed && content.includes(uncheckedPattern)) {
                const completedTask = `- [x] ${taskText} *완료: ${timeStr}*`;
                content = content.replace(uncheckedPattern, completedTask);
                updated = true;
                safeLog.log('할일 완료로 업데이트:', taskText);
            } else if (!completed && content.includes(checkedPattern)) {
                const uncheckedTask = `- [ ] ${taskText}`;
                const escapedText = taskText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const checkedWithTimePattern = new RegExp(`- \\[x\\] ${escapedText} \\*완료: \\d{2}:\\d{2}\\*`);
                if (checkedWithTimePattern.test(content)) {
                    content = content.replace(checkedWithTimePattern, uncheckedTask);
                } else {
                    content = content.replace(checkedPattern, uncheckedTask);
                }
                updated = true;
                safeLog.log('할일 미완료로 업데이트:', taskText);
            }
            
            if (updated) {
                await this.safeModifyFile(file, content);
                safeLog.log('노트 파일 업데이트 완료:', fileName);
            } else {
                safeLog.warn('노트에서 해당 할일을 찾을 수 없습니다:', taskText);
            }
        } catch (error) {
            safeLog.error('노트 할일 상태 업데이트 오류:', error);
        }
    }

    async createNoteFromTemplate(period = null) {
        try {
            const fileName = this.getFileName(period);
            if (!fileName) return;
            
            const folderPath = fileName.substring(0, fileName.lastIndexOf('/'));
            
            if (!await this.app.vault.adapter.exists(folderPath)) {
                await this.app.vault.createFolder(folderPath);
            }

            const content = await this.getTemplateContent(period);
            await this.app.vault.create(fileName, content);
        } catch (error) {
            safeLog.error('노트 생성 오류:', error);
        }
    }

    async getTemplateContent(period = null) {
        const currentPeriod = period || this.currentPeriod;
        
        switch (currentPeriod) {
            case 'daily':
                return this.getDailyTemplate();
            case 'weekly':
                return this.getWeeklyTemplate();
            case 'monthly':
                return this.getMonthlyTemplate();
            case 'yearly':
                return this.getYearlyTemplate();
            default:
                return this.getDailyTemplate();
        }
    }

    getDailyTemplate() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        
        return `# 🎯 Eisenhower Matrix

## 📅 ${dateStr}

### 🔥 Q1: 중요하고 긴급함
- 

### 📅 Q2: 중요하지만 긴급하지 않음
- 

### 👥 Q3: 긴급하지만 중요하지 않음
- 

### 🗑️ Q4: 중요하지도 긴급하지도 않음
- 

---
*생성 시간: ${now.toLocaleString('ko-KR')}*`;
    }

    getWeeklyTemplate(week) {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hour = String(now.getHours()).padStart(2, '0');
        const minute = String(now.getMinutes()).padStart(2, '0');
        const currentTime = `${hour}:${minute}`;
        
        return `---
title: "${week}주차 주간 계획"
type: "weekly"
tags:
  - eisenhower-matrix
  - weekly-planning
  - week${week}
created: "${year}-${month}-${day} ${currentTime}"
times: ["${currentTime}"]
---

# 🎯 ${week}주차 주간 계획 - ${year}년 ${month}월

## 📊 아이젠하워 매트릭스

### 🔥 중요하고 긴급함 (Do First)
- 

### 📅 중요하지만 긴급하지 않음 (Schedule)
- 

### 👥 긴급하지만 중요하지 않음 (Delegate)
- 

### 🗑️ 중요하지도 긴급하지도 않음 (Eliminate)
- 

---
*생성일시: ${year}-${month}-${day} ${currentTime}*`;
    }

    getMonthlyTemplate() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        
        return `# 🎯 Eisenhower Matrix

## 📅 ${year}-${month}

### 🔥 Q1: 중요하고 긴급함
- 

### 📅 Q2: 중요하지만 긴급하지 않음
- 

### 👥 Q3: 긴급하지만 중요하지 않음
- 

### 🗑️ Q4: 중요하지도 긴급하지도 않음
- 

---
*생성 시간: ${now.toLocaleString('ko-KR')}*`;
    }

    getYearlyTemplate() {
        const now = new Date();
        const year = now.getFullYear();
        
        return `# 🎯 Eisenhower Matrix

## 📅 ${year}년 계획

### 🔥 Q1: 핵심 목표
- 

### 📅 Q2: 장기 계획
- 

### 👥 Q3: 단기 과제
- 

### 🗑️ Q4: 검토 대상
- 

---
*생성 시간: ${now.toLocaleString('ko-KR')}*`;
    }

// ========================================
// Part 3 끝 - Part 4로 계속...
// ========================================
// ========================================
// Eisenhower Matrix Plugin - Part 4/7
// UI 렌더링 (탭, 매트릭스, 사분면)
// ========================================

    createTabs(container) {
        const tabButtons = container.createDiv('em-tab-buttons');
        
        ['matrix', 'dashboard', 'timeline'].forEach((tab, i) => {
            const icons = ['📊 매트릭스', '📈 대시보드', '📅 타임라인'];
            const btn = tabButtons.createEl('button', { 
                cls: `em-tab-btn ${i === 0 ? 'active' : ''}`, 
                text: icons[i]
            });
            btn.dataset.tab = tab;
            
            // 탭 클릭 이벤트 리스너 추가
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.switchTab(tab);
            });
        });

        const matrixContent = container.createDiv('em-tab-content active');
        matrixContent.dataset.content = 'matrix';
        this.renderMatrixTab(matrixContent);

        const dashboardContent = container.createDiv('em-tab-content');
        dashboardContent.dataset.content = 'dashboard';
        dashboardContent.style.display = 'none';

        const timelineContent = container.createDiv('em-tab-content');
        timelineContent.dataset.content = 'timeline';
        timelineContent.style.display = 'none';
    }

    renderMatrixTab(container) {
        const periodSection = container.createDiv('em-period-selector');
        [
            { id: 'daily', text: '📅 일일' },
            { id: 'weekly', text: '📊 주간' },
            { id: 'monthly', text: '🗓️ 월간' },
            { id: 'yearly', text: '🎯 연간' }
        ].forEach(period => {
            const btn = periodSection.createEl('button', {
                cls: `em-period-btn ${period.id === this.currentPeriod ? 'active' : ''}`,
                text: period.text
            });
            btn.dataset.period = period.id;
            
            // 기간 선택 이벤트 리스너 추가
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.changePeriod(period.id);
            });
        });

        const inputSection = container.createDiv('em-input-section');
        const taskInput = inputSection.createEl('input', {
            type: 'text',
            placeholder: '새 할일을 입력하세요... (Enter로 추가)',
            cls: 'em-task-input'
        });
        taskInput.id = 'em-taskInput';
        
        taskInput.addEventListener('keydown', async (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                const taskText = taskInput.value.trim();
                
                if (taskText) {
                    await this.addTask('q1', taskText);
                    taskInput.value = '';
                    taskInput.focus();
                } else {
                    new Notice('⚠️ 할일 내용을 입력하세요');
                }
            }
        });

        const quickActions = inputSection.createDiv('em-quick-actions');
        this.createQuickButtons(quickActions);

        if (this.currentPeriod === 'weekly') {
            this.renderWeeklyView(container);
        } else if (this.currentPeriod === 'monthly') {
            this.renderMonthlyCalendarView(container);
        } else if (this.currentPeriod === 'yearly') {
            this.renderYearlyView(container);
        } else {
            const matrixGrid = container.createDiv('em-matrix-grid');
            matrixGrid.classList.add(`em-${this.currentPeriod}-grid`);
            this.renderMatrix(matrixGrid);
        }
    }

    createQuickButtons(container) {
        [
            { id: 'q1', icon: '🔥', title: '긴급&중요', color: '#ff6b6b' },
            { id: 'q2', icon: '📅', title: '중요', color: '#4ecdc4' },
            { id: 'q3', icon: '👥', title: '긴급', color: '#45b7d1' },
            { id: 'q4', icon: '🗑️', title: '기타', color: '#96ceb4' }
        ].forEach(q => {
            const btn = container.createEl('button', { cls: 'em-quick-btn' });
            btn.dataset.quadrant = q.id;
            btn.style.borderLeftColor = q.color;
            btn.createDiv({ cls: 'em-btn-icon', text: q.icon });
            btn.createDiv({ text: q.title });
        });
        
        // 새로고침 버튼 추가
        const refreshBtn = container.createEl('button', { 
            cls: 'em-quick-btn em-refresh-btn',
            title: '새로고침'
        });
        refreshBtn.style.borderLeftColor = '#17a2b8';
        refreshBtn.createDiv({ cls: 'em-btn-icon', text: '🔄' });
        refreshBtn.createDiv({ text: '새로고침' });
        
        refreshBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.refreshView();
        });
    }

    renderMatrix(container) {
        container.empty();
        const quadrants = this.getQuadrantsForPeriod(this.currentPeriod);

        quadrants.forEach(q => {
            const quadrant = container.createDiv(`em-quadrant em-${q.id}`);
            quadrant.dataset.quadrant = q.id;
            quadrant.style.borderLeftColor = q.color;
            quadrant.style.cursor = 'pointer';
            
            quadrant.addEventListener('click', async (e) => {
                if (!e.target.closest('.em-add-task-btn, .em-task-actions, .em-task-checkbox, input')) {
                    e.stopPropagation();
                    await this.openQuadrantNote(q.id);
                }
            });

            // 드롭 존 이벤트 추가
            quadrant.addEventListener('dragover', (e) => {
                e.preventDefault();
                quadrant.classList.add('em-drop-zone');
            });

            quadrant.addEventListener('dragleave', (e) => {
                if (!quadrant.contains(e.relatedTarget)) {
                    quadrant.classList.remove('em-drop-zone');
                }
            });

            quadrant.addEventListener('drop', async (e) => {
                e.preventDefault();
                quadrant.classList.remove('em-drop-zone');
                
                try {
                    const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                    const { quadrant: fromQuadrant, index, taskText } = data;
                    
                    if (fromQuadrant !== q.id) {
                        await this.moveTaskToQuadrant(fromQuadrant, q.id, index);
                    }
                } catch (error) {
                    safeLog.error('드롭 이벤트 처리 오류:', error);
                }
            });
            
            const header = quadrant.createDiv('em-quadrant-header');
            header.createDiv({ cls: 'em-quadrant-title', text: q.title });
            header.createDiv({ cls: 'em-quadrant-subtitle', text: q.subtitle });
            
            const addButton = header.createEl('button', { cls: 'em-add-task-btn', text: '+ 할일' });
            addButton.dataset.quadrant = q.id;
            
            const taskList = quadrant.createDiv('em-task-list');
            this.renderQuadrantTasks(taskList, q.id);
        });
    }

    getQuadrantsForPeriod(period) {
        const defaultColors = { q1: '#ff6b6b', q2: '#4ecdc4', q3: '#45b7d1', q4: '#96ceb4' };
        const colors = this.plugin.settings.quadrantColors || defaultColors;
        const configs = {
            daily: [
                { id: 'q1', title: '🔥 중요하고 긴급함', subtitle: '오늘 반드시 해야 할 일' },
                { id: 'q2', title: '📅 중요하지만 긴급하지 않음', subtitle: '계획하고 스케줄링' },
                { id: 'q3', title: '👥 긴급하지만 중요하지 않음', subtitle: '위임하거나 최소화' },
                { id: 'q4', title: '🗑️ 중요하지도 긴급하지도 않음', subtitle: '제거하거나 최소화' }
            ],
            weekly: [
                { id: 'q1', title: '🎯 핵심 목표', subtitle: '이번 주 가장 중요한 성과' },
                { id: 'q2', title: '📋 계획 수립', subtitle: '다음 주를 위한 준비' },
                { id: 'q3', title: '⚡ 빠른 처리', subtitle: '짧은 시간에 해결할 일들' },
                { id: 'q4', title: '🧹 정리 정돈', subtitle: '미뤄둔 잡무들' }
            ],
            monthly: [
                { id: 'q1', title: '🏆 주요 프로젝트', subtitle: '이번 달 핵심 업무' },
                { id: 'q2', title: '🌱 성장 계획', subtitle: '장기적 발전을 위한 투자' },
                { id: 'q3', title: '🔄 루틴 관리', subtitle: '정기적 처리 업무' },
                { id: 'q4', title: '💡 아이디어', subtitle: '나중에 검토할 것들' }
            ],
            yearly: [
                { id: 'q1', title: '🚀 핵심 목표', subtitle: '올해 반드시 달성할 목표' },
                { id: 'q2', title: '📈 성장 영역', subtitle: '장기적 발전과 학습' },
                { id: 'q3', title: '🔧 시스템 개선', subtitle: '효율성 증대 방안' },
                { id: 'q4', title: '🎨 여가 활동', subtitle: '취미와 개인적 관심사' }
            ]
        };
        return configs[period].map(q => ({ ...q, color: colors[q.id] }));
    }

    renderQuadrantTasks(taskList, quadrant) {
        taskList.empty();
        const tasks = this.tasks[this.currentPeriod][quadrant] || [];
        
        if (tasks.length === 0) {
            taskList.createDiv({ cls: 'em-empty-state', text: '할일이 없습니다' });
            return;
        }

        tasks.forEach((task, index) => {
            const taskData = typeof task === 'string' ? { text: task, completed: false } : task;
            const taskItem = taskList.createDiv('em-task-item');
            taskItem.dataset.quadrant = quadrant;
            taskItem.dataset.index = index;
            
            if (taskData.completed) {
                taskItem.classList.add('em-task-completed');
            }
            
            const checkbox = taskItem.createEl('input', { type: 'checkbox', cls: 'em-task-checkbox' });
            checkbox.checked = taskData.completed;
            
            checkbox.addEventListener('change', async (e) => {
                try {
                    e.stopPropagation();
                    const isCompleted = e.target.checked;
                    taskItem.classList.toggle('em-task-completed', isCompleted);
                    
                    safeLog.log('체크박스 변경:', {
                        quadrant,
                        index,
                        taskText: taskData.text,
                        completed: isCompleted,
                        currentPeriod: this.currentPeriod
                    });
                    
                    await this.updateTaskStatus(quadrant, index, taskData.text, isCompleted);
                    new Notice(isCompleted ? '✅ 할일이 완료되었습니다!' : '🔄 할일이 미완료로 변경되었습니다');
                    
                    // 모바일 진동 피드백
                    if (this.isMobile) {
                        MobileHelper.vibrate([50]);
                    }
                } catch (error) {
                    safeLog.error('체크박스 변경 오류:', error);
                    new Notice('❌ 할일 상태 변경에 실패했습니다');
                    // 원래 상태로 복원
                    e.target.checked = !e.target.checked;
                    taskItem.classList.toggle('em-task-completed', !e.target.checked);
                }
            });
            
            const taskText = taskItem.createDiv({ cls: 'em-task-text', text: taskData.text });
            
            const actions = taskItem.createDiv('em-task-actions');
            const removeBtn = actions.createEl('button', { cls: 'em-btn-remove', text: '✗' });
            
            removeBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await this.removeTask(quadrant, index);
                
                // 모바일 진동 피드백
                if (this.isMobile) {
                    MobileHelper.vibrate([100]);
                }
            });

            // 컨텍스트 메뉴 (우클릭) 추가
            taskItem.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.showMoveTaskMenu(e, quadrant, index, taskData.text);
            });

            // 드래그 앤 드롭 기능 추가
            taskItem.setAttribute('draggable', 'true');
            taskItem.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', JSON.stringify({
                    quadrant,
                    index,
                    taskText: taskData.text
                }));
                taskItem.classList.add('em-dragging');
            });

            taskItem.addEventListener('dragend', () => {
                taskItem.classList.remove('em-dragging');
            });

            // 모바일 터치 지원 추가
            if (this.isTouchDevice) {
                const touchCleanup = MobileHelper.addTouchSupport(taskItem, {
                    onLongPress: (e) => {
                        // 롱프레스로 컨텍스트 메뉴 열기
                        e.preventDefault();
                        this.showMoveTaskMenu(e, quadrant, index, taskData.text);
                        MobileHelper.vibrate([100, 50, 100]); // 더블 진동으로 피드백
                    },
                    onTap: (e) => {
                        // 탭으로 체크박스 토글 (모바일에서 체크박스가 작을 때)
                        if (MobileHelper.isSmallScreen() && !e.target.closest('.em-task-checkbox')) {
                            checkbox.checked = !checkbox.checked;
                            checkbox.dispatchEvent(new Event('change'));
                        }
                    },
                    onTouchStart: () => {
                        taskItem.classList.add('em-touch-active');
                    },
                    onTouchEnd: () => {
                        setTimeout(() => {
                            taskItem.classList.remove('em-touch-active');
                        }, 150);
                    }
                });

                // 정리 함수 저장
                this.touchCleanupFunctions.push(touchCleanup);
            }
        });
    }

    async openQuadrantNote(quadrantId) {
        try {
            const fileName = this.getFileName();
            if (!fileName) {
                new Notice('⚠️ 파일 경로를 찾을 수 없습니다');
                return;
            }

            let file = this.app.vault.getAbstractFileByPath(fileName);
            
            if (!file) {
                await this.createNoteFromTemplate();
                file = this.app.vault.getAbstractFileByPath(fileName);
            }

            if (!file) {
                new Notice('❌ 노트 생성에 실패했습니다');
                return;
            }

            const leaf = this.app.workspace.getLeaf(false);
            await leaf.openFile(file);
            
            const quadrantNames = {
                q1: '중요하고 긴급함',
                q2: '중요하지만 긴급하지 않음',
                q3: '긴급하지만 중요하지 않음',
                q4: '중요하지도 긴급하지도 않음'
            };
            
            new Notice(`📝 ${quadrantNames[quadrantId]} 노트를 열었습니다`);
            
        } catch (error) {
            safeLog.error('노트 열기 오류:', error);
            new Notice('❌ 노트를 열 수 없습니다');
        }
    }

    switchTab(tabName) {
        this.currentTab = tabName;
        const container = this.containerEl;
        
        container.querySelectorAll('.em-tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });
        
        container.querySelectorAll('.em-tab-content').forEach(content => {
            const isActive = content.dataset.content === tabName;
            content.classList.toggle('active', isActive);
            content.style.display = isActive ? 'block' : 'none';
            
            if (isActive) {
                if (tabName === 'timeline') {
                    this.renderTimelineTab(content);
                } else if (tabName === 'dashboard') {
                    this.renderDashboardTab(content);
                }
            }
        });
    }

    switchPeriod(period) {
        this.currentPeriod = period;
        
        const container = this.containerEl;
        const matrixContent = container.querySelector('.em-tab-content[data-content="matrix"]');
        if (matrixContent) {
            matrixContent.empty();
            this.renderMatrixTab(matrixContent);
        }
        
        const stats = container.querySelector('.em-stats');
        if (stats) this.updateStats(stats);
    }

// ========================================
// Part 4 끝 - Part 5로 계속...
// ========================================
// ========================================
// Eisenhower Matrix Plugin - Part 5/7
// 주간/월간 뷰 렌더링
// ========================================

    renderWeeklyView(container) {
        const existingWeeklyContent = container.querySelector('.em-weekly-content');
        if (existingWeeklyContent) existingWeeklyContent.remove();
        
        const weeklyContentContainer = container.createDiv('em-weekly-content');
        const weekSelector = weeklyContentContainer.createDiv('em-week-selector');
        
        const headerSection = weekSelector.createDiv('em-weekly-header');
        headerSection.createEl('h3', { text: '📅 주차 선택' });
        
        const createWeeklyBtn = headerSection.createEl('button', {
            text: `📝 ${this.selectedWeek}주차 노트 생성`,
            cls: 'em-create-weekly-btn'
        });
        
        createWeeklyBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            await this.createWeeklyNote(this.selectedWeek);
        });
        
        const weekButtons = weekSelector.createDiv('em-week-buttons');
        for (let week = 1; week <= 4; week++) {
            const btn = weekButtons.createEl('button', {
                cls: `em-week-btn ${week === this.selectedWeek ? 'active' : ''}`,
                text: `${week}주차`
            });
            btn.dataset.week = week;
            btn.addEventListener('click', () => {
                this.selectedWeek = week;
                this.renderWeeklyView(container);
            });
        }
        
        const matrixContainer = weeklyContentContainer.createDiv('em-matrix-container');
        matrixContainer.createEl('h3', { text: `${this.selectedWeek}주차 Eisenhower Matrix` });
        
        const matrixGrid = matrixContainer.createDiv('em-matrix-grid');
        this.renderWeeklyMatrix(matrixGrid, this.selectedWeek);
    }

    renderWeeklyMatrix(container, week) {
        container.empty();
        const quadrants = this.getQuadrantsForPeriod('weekly');
        const weekKey = `week${week}`;
        const weekTasks = this.tasks.weekly[weekKey] || { q1: [], q2: [], q3: [], q4: [] };

        quadrants.forEach(q => {
            const quadrant = container.createDiv(`em-quadrant em-${q.id}`);
            quadrant.dataset.quadrant = q.id;
            quadrant.dataset.week = week;
            quadrant.style.borderLeftColor = q.color;
            quadrant.style.cursor = 'pointer';
            
            quadrant.addEventListener('click', async (e) => {
                if (!e.target.closest('input, button, .em-task-item')) {
                    e.stopPropagation();
                    await this.openWeeklyQuadrantNote(week, q.id);
                }
            });
            
            const header = quadrant.createDiv('em-quadrant-header');
            header.createDiv({ cls: 'em-quadrant-title', text: q.title });
            header.createDiv({ cls: 'em-quadrant-subtitle', text: q.subtitle });
            
            const taskList = quadrant.createDiv('em-task-list');
            const tasks = weekTasks[q.id] || [];
            
            tasks.forEach((task, taskIndex) => {
                const taskData = typeof task === 'string' ? { text: task, completed: false } : task;
                const taskItem = taskList.createDiv('em-task-item');
                
                const checkbox = taskItem.createEl('input', { type: 'checkbox', cls: 'em-task-checkbox' });
                checkbox.checked = taskData.completed;
                checkbox.addEventListener('change', async () => {
                    await this.updateTaskStatus(q.id, taskIndex, taskData.text, checkbox.checked);
                    this.refreshView();
                });
                
                taskItem.createDiv({ cls: 'em-task-text', text: taskData.text });
                
                const removeBtn = taskItem.createEl('button', { cls: 'em-btn-remove', text: '✕' });
                removeBtn.addEventListener('click', () => {
                    this.removeTask(q.id, taskIndex, 'weekly', week);
                });
            });
            
            const addInput = taskList.createEl('input', {
                type: 'text',
                placeholder: '새 할일 추가...',
                cls: 'em-add-task-input'
            });
            
            addInput.addEventListener('keypress', async (e) => {
                if (e.key === 'Enter' && addInput.value.trim()) {
                    e.preventDefault();
                    e.stopPropagation();
                    await this.addTask(q.id, addInput.value.trim(), 'weekly', week);
                    addInput.value = '';
                }
            });
        });
    }

    async createWeeklyNote(week) {
        try {
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            
            const settings = this.plugin?.settings || {};
            const mainFolder = settings.mainFolder || 'Eisenhower Matrix';
            const folderPath = settings.weeklyFolder || 'Weekly';
            const fileName = `${year}-${month}-${week}주차.md`;
            const filePath = `${mainFolder}/${folderPath}/${fileName}`;
            
            // 폴더 생성
            if (!await this.app.vault.adapter.exists(`${mainFolder}/${folderPath}`)) {
                await this.app.vault.createFolder(`${mainFolder}/${folderPath}`);
            }
            
            // 파일 존재 확인
            if (await this.app.vault.adapter.exists(filePath)) {
                new Notice(`이미 ${year}년 ${month}월 ${week}주차 노트가 존재합니다!`);
                const file = this.safeGetFile(filePath);
                if (file) {
                    await this.app.workspace.openLinkText(filePath, '', true);
                }
                return;
            }
            
            // 주간 템플릿으로 노트 생성
            const content = this.getWeeklyTemplate(week);
            await this.app.vault.create(filePath, content);
            
            new Notice(`✅ ${year}년 ${month}월 ${week}주차 계획 노트 생성 완료!`);
            safeLog.log('주간 노트 생성 완료:', { filePath, week });
            
            // 생성된 파일 열기
            const file = this.safeGetFile(filePath);
            if (file) {
                await this.app.workspace.openLinkText(filePath, '', true);
            }
            
        } catch (error) {
            safeLog.error('주간 노트 생성 오류:', error);
            new Notice('❌ 주간 노트 생성 중 오류가 발생했습니다.');
        }
    }

    async openWeeklyQuadrantNote(week, quadrantId) {
        try {
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const settings = this.plugin?.settings || {};
            const mainFolder = settings.mainFolder || 'Eisenhower Matrix';
            const weeklyFolder = settings.weeklyFolder || 'Weekly';
            const fileName = `${mainFolder}/${weeklyFolder}/${year}-${month}-${week}주차.md`;
            
            let file = this.safeGetFile(fileName);
            
            if (!file) {
                await this.createWeeklyNote(week);
                file = this.app.vault.getAbstractFileByPath(fileName);
            }

            if (!file) {
                new Notice('❌ 주간 노트 생성에 실패했습니다');
                return;
            }

            const leaf = this.app.workspace.getLeaf(false);
            await leaf.openFile(file);
            
            const quadrantNames = {
                q1: '중요하고 긴급함',
                q2: '중요하지만 긴급하지 않음',
                q3: '긴급하지만 중요하지 않음',
                q4: '중요하지도 긴급하지도 않음'
            };
            
            new Notice(`📝 ${week}주차 ${quadrantNames[quadrantId]} 노트를 열었습니다`);
            
        } catch (error) {
            safeLog.error('주간 노트 열기 오류:', error);
            new Notice('❌ 주간 노트를 열 수 없습니다');
        }
    }

    renderMonthlyCalendarView(container) {
        const monthlyContainer = container.createDiv('em-monthly-container');
        
        const headerSection = monthlyContainer.createDiv('em-monthly-header');
        headerSection.createEl('h3', { text: '📅 월간 뷰' });
        
        const createButton = headerSection.createEl('button', {
            text: '📝 이번 달 계획 노트 생성',
            cls: 'em-create-monthly-btn'
        });
        
        createButton.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            await this.createMonthlyNote();
        });
        
        this.renderMonthlyCalendar(monthlyContainer);
        
        const selectedDayView = monthlyContainer.createDiv('em-selected-day-view');
        selectedDayView.id = 'em-selected-day-view';
        this.showDayTasks(this.selectedDay);
    }

    renderMonthlyCalendar(container) {
        // 기존 달력만 제거하고 다시 렌더링
        const existingCalendar = container.querySelector('.em-calendar');
        if (existingCalendar) {
            existingCalendar.remove();
        }
        
        const year = this.currentCalendarDate.getFullYear();
        const month = this.currentCalendarDate.getMonth();
        
        // 헤더가 없으면 생성
        let calendarHeader = container.querySelector('.em-calendar-header');
        if (!calendarHeader) {
            calendarHeader = container.createDiv('em-calendar-header');
            
            const prevBtn = calendarHeader.createEl('button', { 
                text: '◀ 이전',
                cls: 'em-nav-btn'
            });
            prevBtn.onclick = (e) => {
                e.stopPropagation();
                this.currentCalendarDate.setMonth(month - 1);
                this.renderMonthlyCalendar(container);
                this.updateSelectedDayView();
            };
            
            const monthTitle = calendarHeader.createEl('h4');
            monthTitle.id = 'em-month-title';
            
            const nextBtn = calendarHeader.createEl('button', { 
                text: '다음 ▶',
                cls: 'em-nav-btn'
            });
            nextBtn.onclick = (e) => {
                e.stopPropagation();
                this.currentCalendarDate.setMonth(month + 1);
                this.renderMonthlyCalendar(container);
                this.updateSelectedDayView();
            };
        } else {
            // 기존 버튼 이벤트 재설정
            const prevBtn = calendarHeader.querySelector('.em-nav-btn');
            const nextBtn = calendarHeader.querySelectorAll('.em-nav-btn')[1];
            
            if (prevBtn) {
                prevBtn.onclick = (e) => {
                    e.stopPropagation();
                    this.currentCalendarDate.setMonth(month - 1);
                    this.renderMonthlyCalendar(container);
                    this.updateSelectedDayView();
                };
            }
            
            if (nextBtn) {
                nextBtn.onclick = (e) => {
                    e.stopPropagation();
                    this.currentCalendarDate.setMonth(month + 1);
                    this.renderMonthlyCalendar(container);
                    this.updateSelectedDayView();
                };
            }
        }
        
        // 월 제목 업데이트
        const monthTitle = container.querySelector('#em-month-title');
        if (monthTitle) {
            monthTitle.textContent = `${year}년 ${month + 1}월`;
        }
        
        const calendar = container.createDiv('em-calendar');
        
        const daysHeader = calendar.createDiv('em-days-header');
        ['일', '월', '화', '수', '목', '금', '토'].forEach(day => {
            daysHeader.createEl('div', { text: day, cls: 'em-day-header' });
        });
        
        const daysContainer = calendar.createDiv('em-days-container');
        
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDate = new Date(firstDay);
        startDate.setDate(startDate.getDate() - firstDay.getDay());
        
        for (let i = 0; i < 42; i++) {
            const currentDate = new Date(startDate);
            currentDate.setDate(startDate.getDate() + i);
            
            const dayEl = daysContainer.createEl('div', { 
                cls: 'em-day',
                text: currentDate.getDate().toString()
            });
            
            if (currentDate.getMonth() !== month) {
                dayEl.addClass('em-other-month');
            }
            
            if (currentDate.toDateString() === new Date().toDateString()) {
                dayEl.addClass('em-today');
            }
            
            if (currentDate.toDateString() === this.selectedDay.toDateString()) {
                dayEl.addClass('em-selected');
            }
            
            // 안전한 클릭 이벤트 핸들러
            dayEl.onclick = async (e) => {
                e.stopPropagation();
                e.preventDefault();
                
                try {
                    this.selectedDay = new Date(currentDate);
                    
                    // 모든 날짜에서 선택 클래스 제거
                    container.querySelectorAll('.em-day').forEach(d => d.removeClass('em-selected'));
                    
                    // 현재 클릭된 날짜에 선택 클래스 추가
                    dayEl.addClass('em-selected');
                    
                    // 해당 날짜의 할일 표시
                    this.showDayTasks(this.selectedDay);
                    
                    // 오늘 클릭시 일일 노트 생성/열기
                    if (currentDate.toDateString() === new Date().toDateString()) {
                        await this.openOrCreateDailyNote(currentDate);
                    }
                } catch (error) {
                    safeLog.error('날짜 클릭 처리 오류:', error);
                }
            };
        }
        
        // 할일 인디케이터 업데이트
        this.updateCalendarIndicators();
    }

    updateSelectedDayView() {
        const view = this.containerEl.querySelector('#em-selected-day-view');
        if (view) {
            this.showDayTasks(this.selectedDay);
        }
    }

    showDayTasks(selectedDate) {
        const view = this.containerEl.querySelector('#em-selected-day-view');
        if (!view) return;
        
        view.empty();
        
        const day = typeof selectedDate === 'number' ? selectedDate : selectedDate.getDate();
        const dayKey = `day${day}`;
        const dayTasks = this.tasks.monthly[dayKey] || { q1: [], q2: [], q3: [], q4: [] };
        
        view.createEl('h4', { text: `${day}일 할일` });
        
        const quadrants = [
            { key: 'q1', title: '🔥 중요하고 긴급함', color: '#ff6b6b' },
            { key: 'q2', title: '📅 중요하지만 긴급하지 않음', color: '#4ecdc4' },
            { key: 'q3', title: '👥 긴급하지만 중요하지 않음', color: '#45b7d1' },
            { key: 'q4', title: '🗑️ 중요하지도 긴급하지도 않음', color: '#96ceb4' }
        ];
        
        quadrants.forEach(quadrant => {
            const quadDiv = view.createDiv('em-day-quadrant');
            quadDiv.createEl('h5', { text: quadrant.title });
            
            const tasks = dayTasks[quadrant.key] || [];
            
            tasks.forEach((task, index) => {
                const taskData = typeof task === 'string' ? { text: task, completed: false } : task;
                const taskItem = quadDiv.createDiv('em-day-task-item');
                
                const checkbox = taskItem.createEl('input', { type: 'checkbox', cls: 'em-task-checkbox' });
                checkbox.checked = taskData.completed;
                checkbox.addEventListener('change', async (e) => {
                    try {
                        e.stopPropagation();
                        const isCompleted = e.target.checked;
                        
                        safeLog.log('월간 체크박스 변경:', {
                            quadrant: quadrant.key,
                            index,
                            taskText: taskData.text,
                            completed: isCompleted,
                            day
                        });
                        
                        await this.updateMonthlyTaskStatus(quadrant.key, index, taskData.text, isCompleted, day);
                        this.showDayTasks(day);
                        
                        new Notice(isCompleted ? '✅ 월간 할일이 완료되었습니다!' : '🔄 월간 할일이 미완료로 변경되었습니다');
                    } catch (error) {
                        safeLog.error('월간 체크박스 변경 오류:', error);
                        new Notice('❌ 월간 할일 상태 변경에 실패했습니다');
                        // 원래 상태로 복원
                        e.target.checked = !e.target.checked;
                    }
                });
                
                taskItem.createDiv({ cls: 'em-task-text', text: taskData.text });
                
                const removeBtn = taskItem.createEl('button', { cls: 'em-btn-remove', text: '✗' });
                removeBtn.onclick = async () => await this.removeTask(quadrant.key, index, 'monthly', day);
            });
            
            const addInput = quadDiv.createEl('input', {
                type: 'text',
                placeholder: '새 할일 추가...',
                cls: 'em-add-task-input'
            });
            
            addInput.addEventListener('keypress', async (e) => {
                if (e.key === 'Enter' && addInput.value.trim()) {
                    e.preventDefault();
                    e.stopPropagation();
                    await this.addTask(quadrant.key, addInput.value.trim(), 'monthly', day);
                    addInput.value = '';
                }
            });
        });
    }

    async createMonthlyNote() {
        try {
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            
            const settings = this.plugin.settings;
            const folderPath = settings.monthlyFolder || 'Monthly';
            const fileName = `${year}-${month}.md`;
            const filePath = `${settings.mainFolder}/${folderPath}/${fileName}`;
            
            if (!await this.app.vault.adapter.exists(`${settings.mainFolder}/${folderPath}`)) {
                await this.app.vault.createFolder(`${settings.mainFolder}/${folderPath}`);
            }
            
            if (await this.app.vault.adapter.exists(filePath)) {
                new Notice(`이미 ${year}년 ${month}월 월간계획이 존재합니다!`);
                const file = this.app.vault.getAbstractFileByPath(filePath);
                if (file) {
                    await this.app.workspace.openLinkText(filePath, '', true);
                }
                return;
            }
            
            const content = this.getMonthlyTemplate();
            await this.app.vault.create(filePath, content);
            
            new Notice(`✅ ${year}년 ${month}월 월간계획 생성 완료!`);
            
            const file = this.app.vault.getAbstractFileByPath(filePath);
            if (file) {
                await this.app.workspace.openLinkText(filePath, '', true);
            }
            
        } catch (error) {
            safeLog.error('월간 노트 생성 오류:', error);
            new Notice('❌ 월간 노트 생성 중 오류가 발생했습니다.');
        }
    }

    getMonthlyTemplate() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        
        return `# 🎯 Eisenhower Matrix

## 📅 ${year}-${month}

### 🔥 Q1: 중요하고 긴급함
- 

### 📅 Q2: 중요하지만 긴급하지 않음
- 

### 👥 Q3: 긴급하지만 중요하지 않음
- 

### 🗑️ Q4: 중요하지도 긴급하지도 않음
- 

---
*생성 시간: ${now.toLocaleString('ko-KR')}*`;
    }

    getYearlyTemplate() {
        const now = new Date();
        const year = now.getFullYear();
        
        return `# 🎯 Eisenhower Matrix

## 📅 ${year}년 계획

### 🔥 Q1: 핵심 목표 (중요하고 긴급함)
- 

### 📅 Q2: 장기 계획 (중요하지만 긴급하지 않음)
- 

### 👥 Q3: 단기 과제 (긴급하지만 중요하지 않음)
- 

### 🗑️ Q4: 검토 대상 (중요하지도 긴급하지도 않음)
- 

## 분기별 목표

### Q1 (1-3월)
- 

### Q2 (4-6월)
- 

### Q3 (7-9월)
- 

### Q4 (10-12월)
- 

---
*생성 시간: ${now.toLocaleString('ko-KR')}*`;
    }

    renderYearlyView(container) {
        const yearlyContainer = container.createDiv('em-yearly-container');
        
        const headerSection = yearlyContainer.createDiv('em-yearly-header');
        headerSection.createEl('h3', { text: '🗓️ 연간 뷰' });
        
        const createButton = headerSection.createEl('button', {
            text: '📝 올해 계획 노트 생성',
            cls: 'em-create-yearly-btn'
        });
        
        createButton.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            await this.createYearlyNote();
        });
        
        const currentYear = new Date().getFullYear();
        const yearNav = yearlyContainer.createDiv('em-year-nav');
        
        const prevBtn = yearNav.createEl('button', { text: '◀ 이전 연도' });
        prevBtn.onclick = () => {
            this.currentYear = this.currentYear - 1;
            this.renderYearlyView(container);
        };
        
        yearNav.createEl('h4', { text: `${this.currentYear || currentYear}년` });
        
        const nextBtn = yearNav.createEl('button', { text: '다음 연도 ▶' });
        nextBtn.onclick = () => {
            this.currentYear = this.currentYear + 1;
            this.renderYearlyView(container);
        };
        
        const matrixGrid = yearlyContainer.createDiv('em-matrix-grid em-yearly-grid');
        this.renderYearlyMatrix(matrixGrid);
    }

    renderYearlyMatrix(container) {
        container.empty();
        const quadrants = this.getQuadrantsForPeriod('yearly');

        quadrants.forEach(q => {
            const quadrant = container.createDiv(`em-quadrant em-${q.id}`);
            quadrant.dataset.quadrant = q.id;
            quadrant.style.borderLeftColor = q.color;
            
            const header = quadrant.createDiv('em-quadrant-header');
            header.createDiv({ cls: 'em-quadrant-title', text: q.title });
            header.createDiv({ cls: 'em-quadrant-subtitle', text: q.subtitle });
            
            const addButton = header.createEl('button', { cls: 'em-add-task-btn', text: '+ 목표' });
            addButton.dataset.quadrant = q.id;
            
            // 연간 뷰 할일 추가 이벤트 리스너
            addButton.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const taskText = await this.showTaskInputModal('연간 목표를 입력하세요');
                if (taskText && taskText.trim()) {
                    await this.addTask(q.id, taskText.trim(), 'yearly');
                }
            });
            
            const taskList = quadrant.createDiv('em-task-list');
            this.renderYearlyQuadrantTasks(taskList, q.id);
        });
    }

    renderYearlyQuadrantTasks(container, quadrant) {
        container.empty();
        const currentTasks = this.tasks.yearly?.[quadrant] || [];
        
        currentTasks.forEach((taskData, index) => {
            const taskItem = container.createDiv('em-task-item');
            taskItem.dataset.index = index;
            
            if (taskData.completed) {
                taskItem.classList.add('em-task-completed');
            }
            
            const checkbox = taskItem.createEl('input', { type: 'checkbox', cls: 'em-task-checkbox' });
            checkbox.checked = taskData.completed;
            
            checkbox.addEventListener('change', async (e) => {
                const isCompleted = e.target.checked;
                taskItem.classList.toggle('em-task-completed', isCompleted);
                await this.updateYearlyTaskStatus(quadrant, index, taskData.text, isCompleted);
            });
            
            const taskText = taskItem.createDiv({ cls: 'em-task-text', text: taskData.text });
            
            const actions = taskItem.createDiv('em-task-actions');
            const removeBtn = actions.createEl('button', { cls: 'em-btn-remove', text: '✗' });
            
            removeBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await this.removeTask(quadrant, index);
            });
        });
    }

    async createYearlyNote() {
        try {
            const fileName = this.getYearlyFileName();
            if (!fileName) return;

            // 폴더 경로 추출 및 생성
            const folderPath = fileName.substring(0, fileName.lastIndexOf('/'));
            if (!await this.app.vault.adapter.exists(folderPath)) {
                await this.app.vault.createFolder(folderPath);
            }

            const file = this.app.vault.getAbstractFileByPath(fileName);
            if (file) {
                new Notice('📝 연간 노트가 이미 존재합니다');
                // 기존 파일 열기
                this.app.workspace.openLinkText(fileName, '', false);
                return;
            }

            const template = this.getYearlyTemplate();
            await this.app.vault.create(fileName, template);
            new Notice('📅 연간 계획 노트가 생성되었습니다');
            
            // 생성된 파일 열기
            this.app.workspace.openLinkText(fileName, '', false);
        } catch (error) {
            safeLog.error('연간 노트 생성 오류:', error);
            new Notice('❌ 연간 노트 생성에 실패했습니다');
        }
    }

    getYearlyFileName() {
        const year = this.currentYear || new Date().getFullYear();
        const settings = this.plugin.settings;
        const folderPath = settings.eisenhowerFolderPath || 'Eisenhower Matrix';
        const yearlyFolder = settings.yearlyFolder || 'Yearly';
        return `${folderPath}/${yearlyFolder}/${year}년-계획.md`;
    }

    updateCalendarIndicators() {
        const calendarDays = this.containerEl.querySelectorAll('.em-day');
        if (!calendarDays.length) return;
        
        calendarDays.forEach(dayEl => {
            const dayNumber = parseInt(dayEl.textContent);
            if (isNaN(dayNumber)) return;
            
            const dayKey = `day${dayNumber}`;
            const dayTasks = this.tasks.monthly[dayKey];
            
            // 기존 인디케이터 제거
            const existingIndicator = dayEl.querySelector('.em-task-indicator');
            if (existingIndicator) existingIndicator.remove();
            
            if (dayTasks) {
                const totalTasks = Object.values(dayTasks).flat().length;
                const completedTasks = Object.values(dayTasks).flat().filter(task => 
                    typeof task === 'object' && task.completed
                ).length;
                
                if (totalTasks > 0) {
                    const indicator = dayEl.createDiv('em-task-indicator');
                    indicator.textContent = `${completedTasks}/${totalTasks}`;
                    
                    // 완료율에 따른 색상 설정
                    const completionRate = completedTasks / totalTasks;
                    if (completionRate === 1) {
                        indicator.style.backgroundColor = '#28a745'; // 초록색 - 완료
                    } else if (completionRate > 0.5) {
                        indicator.style.backgroundColor = '#ffc107'; // 노란색 - 진행중
                    } else if (completionRate > 0) {
                        indicator.style.backgroundColor = '#fd7e14'; // 주황색 - 시작
                    } else {
                        indicator.style.backgroundColor = '#dc3545'; // 빨간색 - 미시작
                    }
                }
            }
        });
    }

    async addTimeToFile(file, timeString) {
        try {
            if (!file || !file.path) {
                safeLog.error('유효하지 않은 파일 객체:', file);
                return;
            }

            const content = await this.safeReadFile(file);
            const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
            
            if (!frontmatterMatch) {
                // frontmatter가 없으면 새로 생성
                const newContent = `---
times: ["${timeString}"]
---

${content}`;
                await this.safeModifyFile(file, newContent);
                new Notice(`⏰ 시간 기록 완료: ${timeString}`);
                return;
            }
            
            const frontmatter = frontmatterMatch[1];
            const timesMatch = frontmatter.match(/times:\s*\[(.*?)\]/s);
            let newTimes;
            
            if (timesMatch) {
                const existingTimes = timesMatch[1].trim();
                if (existingTimes) {
                    newTimes = `times: [${existingTimes}, "${timeString}"]`;
                } else {
                    newTimes = `times: ["${timeString}"]`;
                }
            } else {
                newTimes = `times: ["${timeString}"]`;
            }
            
            let newFrontmatter;
            if (timesMatch) {
                newFrontmatter = frontmatter.replace(/times:\s*\[.*?\]/s, newTimes);
            } else {
                newFrontmatter = frontmatter + '\n' + newTimes;
            }
            
            const newContent = content.replace(/^---\n[\s\S]*?\n---/, `---\n${newFrontmatter}\n---`);
            await this.safeModifyFile(file, newContent);
            
        } catch (error) {
            safeLog.error('시간 기록 오류:', error);
            new Notice('❌ 시간 기록에 실패했습니다.');
        }
    }

    async openOrCreateDailyNote(date) {
        try {
            // date가 없으면 오늘 날짜 사용
            const targetDate = date || new Date();
            
            const year = targetDate.getFullYear();
            const month = String(targetDate.getMonth() + 1).padStart(2, '0');
            const day = String(targetDate.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;
            
            const settings = this.plugin.settings;
            const folderPath = settings.dailyFolder || 'Daily';
            const fileName = `${dateStr}.md`;
            const filePath = `${settings.mainFolder}/${folderPath}/${fileName}`;
            
            // 폴더가 없으면 생성
            if (!await this.app.vault.adapter.exists(`${settings.mainFolder}/${folderPath}`)) {
                await this.app.vault.createFolder(`${settings.mainFolder}/${folderPath}`);
            }
            
            // 파일이 없으면 생성
            if (!await this.app.vault.adapter.exists(filePath)) {
                const content = this.getDailyTemplate();
                await this.app.vault.create(filePath, content);
                new Notice(`📝 ${dateStr} 일일 노트가 생성되었습니다.`);
            }
            
            // 파일 열기
            const file = this.app.vault.getAbstractFileByPath(filePath);
            if (file) {
                await this.app.workspace.openLinkText(filePath, '', true);
                new Notice(`📅 ${dateStr} 일일 노트로 이동했습니다.`);
            }
            
        } catch (error) {
            console.error('일일 노트 열기 오류:', error);
            new Notice('❌ 일일 노트를 열 수 없습니다.');
        }
    }

    async showTaskInputModal(placeholder = '할일을 입력하세요') {
        return new Promise((resolve) => {
            const modal = new Modal(this.app);
            modal.titleEl.setText('✅ 새로운 할일 추가');
            
            const inputContainer = modal.contentEl.createDiv();
            const input = inputContainer.createEl('input', {
                type: 'text',
                placeholder: placeholder,
                cls: 'em-modal-input'
            });
            input.style.width = '100%';
            input.style.padding = '8px';
            input.style.marginBottom = '15px';
            input.style.border = '1px solid var(--background-modifier-border)';
            input.style.borderRadius = '4px';
            
            const buttonContainer = modal.contentEl.createDiv();
            buttonContainer.style.display = 'flex';
            buttonContainer.style.gap = '10px';
            buttonContainer.style.justifyContent = 'flex-end';
            
            const cancelBtn = buttonContainer.createEl('button', { text: '취소' });
            cancelBtn.onclick = () => {
                modal.close();
                resolve(null);
            };
            
            const confirmBtn = buttonContainer.createEl('button', { text: '추가' });
            confirmBtn.style.backgroundColor = 'var(--interactive-accent)';
            confirmBtn.style.color = 'var(--text-on-accent)';
            confirmBtn.onclick = () => {
                const value = input.value.trim();
                modal.close();
                resolve(value);
            };
            
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const value = input.value.trim();
                    modal.close();
                    resolve(value);
                }
            });
            
            modal.open();
            input.focus();
        });
    }

// ========================================
// Part 5 끝 - Part 6로 계속...
// ========================================
// ========================================
// Eisenhower Matrix Plugin - Part 6/7
// 대시보드 및 타임라인 탭 렌더링
// ========================================

    renderDashboardTab(container) {
        container.empty();
        
        const header = container.createDiv('em-dashboard-header');
        header.createEl('h2', { text: '📈 Eisenhower Matrix 대시보드' });
        
        // 기간별 선택 탭
        const periodTabs = header.createDiv('em-dashboard-period-tabs');
        ['daily', 'weekly', 'monthly', 'yearly'].forEach(period => {
            const periodNames = {
                daily: '📅 일일',
                weekly: '📊 주간', 
                monthly: '🗓️ 월간',
                yearly: '🎯 연간'
            };
            
            const btn = periodTabs.createEl('button', {
                text: periodNames[period],
                cls: `em-dashboard-period-btn ${period === this.currentPeriod ? 'active' : ''}`
            });
            btn.dataset.period = period;
            
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.currentPeriod = period;
                this.renderDashboardTab(container);
            });
        });
        
        const dashboardActions = header.createDiv('em-dashboard-actions');
        
        const openDashboardBtn = dashboardActions.createEl('button', {
            text: '📊 DataviewJS 대시보드 열기',
            cls: 'em-dashboard-btn'
        });
        
        openDashboardBtn.addEventListener('click', async () => {
            await this.openOrCreateDashboard();
        });
        
        const createDashboardBtn = dashboardActions.createEl('button', {
            text: '🔧 대시보드 생성/업데이트',
            cls: 'em-dashboard-btn em-create-btn'
        });
        
        createDashboardBtn.addEventListener('click', async () => {
            await this.createDataviewDashboard();
        });

        const description = container.createEl('p', { 
            text: 'DataviewJS 대시보드를 통해 더 상세한 분석을 확인하거나, 아래에서 간단한 통계를 확인하세요.',
            cls: 'em-dashboard-desc'
        });

        this.renderQuadrantStats(container);
        this.renderHighPriorityTasks(container);
        this.renderCompletedStats(container);
    }

    async openOrCreateDashboard() {
        try {
            const settings = this.plugin.settings;
            const dashboardPath = `${settings.dashboardFolder}/${settings.dashboardFile}`;
            
            if (await this.app.vault.adapter.exists(dashboardPath)) {
                const file = this.app.vault.getAbstractFileByPath(dashboardPath);
                if (file) {
                    await this.app.workspace.openLinkText(dashboardPath, '', true);
                    new Notice('📊 대시보드를 열었습니다!');
                    return;
                }
            }
            
            await this.createDataviewDashboard();
            
        } catch (error) {
            safeLog.error('대시보드 열기 오류:', error);
            new Notice('❌ 대시보드를 열 수 없습니다.');
        }
    }

    async createDataviewDashboard() {
        try {
            const settings = this.plugin.settings;
            const folderPath = settings.dashboardFolder || 'Dashboard';
            const filePath = `${folderPath}/${settings.dashboardFile}`;
            
            if (!await this.app.vault.adapter.exists(folderPath)) {
                await this.app.vault.createFolder(folderPath);
            }
            
            const dashboardContent = this.generateDataviewDashboard();
            
            if (await this.app.vault.adapter.exists(filePath)) {
                const file = this.app.vault.getAbstractFileByPath(filePath);
                if (file) {
                    await this.app.vault.modify(file, dashboardContent);
                    new Notice('✅ 대시보드가 업데이트되었습니다!');
                }
            } else {
                await this.app.vault.create(filePath, dashboardContent);
                new Notice('✅ DataviewJS 대시보드가 생성되었습니다!');
            }
            
            const file = this.app.vault.getAbstractFileByPath(filePath);
            if (file) {
                await this.app.workspace.openLinkText(filePath, '', true);
            }
            
        } catch (error) {
            safeLog.error('대시보드 생성 오류:', error);
            new Notice('❌ 대시보드 생성 중 오류가 발생했습니다.');
        }
    }

    generateDataviewDashboard() {
        const now = new Date();
        const dateStr = now.toLocaleDateString('ko-KR');
        
        return `---
created: ${now.toISOString()}
tags: [dashboard, eisenhower, dataview]
title: Eisenhower Matrix Dashboard
---

# 📊 Eisenhower Matrix Dashboard

> 📅 생성일: ${dateStr}  
> 🔄 자동 업데이트: DataviewJS

\`\`\`dataviewjs
const eisenhowerFiles = dv.pages('"${this.plugin.settings.mainFolder}"')
    .where(p => p.file.name.includes("Eisenhower") || p.file.name.includes("eisenhower"));

const totalFiles = eisenhowerFiles.length;
const todayFiles = eisenhowerFiles.filter(p => 
    moment(p.file.ctime).format("YYYY-MM-DD") === moment().format("YYYY-MM-DD")
).length;

dv.header(2, "📈 전체 통계");
dv.table(["구분", "개수"], [
    ["📁 전체 파일", totalFiles],
    ["📅 오늘 생성", todayFiles],
    ["📝 최근 일주일", eisenhowerFiles.filter(p => 
        moment().diff(moment(p.file.ctime), 'days') <= 7
    ).length]
]);

dv.header(2, "🎯 최근 작업 파일");
const recentFiles = dv.pages('"${this.plugin.settings.mainFolder}"')
    .sort(p => p.file.mtime, "desc")
    .limit(${this.plugin.settings.recentFilesCount});

dv.table(["📄 파일명", "📅 수정일", "🕒 시간"], 
    recentFiles.map(p => [
        dv.fileLink(p.file.path, false, p.file.name),
        moment(p.file.mtime).format("MM-DD"),
        moment(p.file.mtime).format("HH:mm")
    ])
);
\`\`\`

---
*📌 이 대시보드는 Eisenhower Matrix 플러그인에 의해 자동 생성됩니다.*
*🔄 최종 업데이트: ${dateStr}*`;
    }

    renderQuadrantStats(container) {
        const section = container.createDiv('em-dashboard-section');
        section.createEl('h3', { text: '📊 사분면별 달성률' });
        
        const tableContainer = section.createDiv('em-stats-table');
        const table = tableContainer.createEl('table', { cls: 'em-dashboard-table' });
        
        const thead = table.createEl('thead');
        const headerRow = thead.createEl('tr');
        headerRow.createEl('th', { text: '📁 사분면' });
        headerRow.createEl('th', { text: '✅ 완료' });
        headerRow.createEl('th', { text: '📊 달성률' });
        
        const tbody = table.createEl('tbody');
        
        const quadrantNames = {
            q1: '🔥 중요하고 긴급함',
            q2: '📅 중요하지만 긴급하지 않음',
            q3: '👥 긴급하지만 중요하지 않음',
            q4: '🗑️ 중요하지도 긴급하지도 않음'
        };
        
        const currentTasks = this.getCurrentTasks();
        
        ['q1', 'q2', 'q3', 'q4'].forEach(quadrant => {
            const tasks = currentTasks[quadrant] || [];
            const total = tasks.length;
            const completed = tasks.filter(task => 
                typeof task === 'object' ? task.completed : false
            ).length;
            const rate = total === 0 ? 0 : Math.round((completed / total) * 100);
            
            const row = tbody.createEl('tr');
            row.createEl('td', { text: quadrantNames[quadrant] });
            row.createEl('td', { text: `${completed}/${total}` });
            
            const rateCell = row.createEl('td');
            const progressBar = rateCell.createDiv('em-progress-bar');
            const progressFill = progressBar.createDiv('em-progress-fill');
            progressFill.style.width = `${rate}%`;
            progressFill.style.backgroundColor = this.getQuadrantColor(quadrant);
            rateCell.createSpan({ text: ` ${rate}%`, cls: 'em-progress-text' });
        });
    section.createEl('h4', { 
        text: '📋 할일 목록 (대시보드 뷰 - 삭제해도 파일은 유지됨)',
        cls: 'em-dashboard-subtitle'
    });
    
    ['q1', 'q2', 'q3', 'q4'].forEach(quadrant => {
        const tasks = currentTasks[quadrant] || [];
        if (tasks.length === 0) return;
        
        const quadrantSection = section.createDiv('em-dashboard-quadrant-section');
        quadrantSection.createEl('h5', { text: quadrantNames[quadrant] });
        
        const taskList = quadrantSection.createEl('ul', { cls: 'em-dashboard-task-list' });
        
        tasks.forEach((task, index) => {
            const taskData = typeof task === 'string' ? { text: task, completed: false } : task;
            const taskItem = taskList.createEl('li', { cls: 'em-dashboard-task-item' });
            
            const checkbox = taskItem.createEl('input', { 
                type: 'checkbox', 
                cls: 'em-task-checkbox' 
            });
            checkbox.checked = taskData.completed;
            checkbox.addEventListener('change', async (e) => {
                e.stopPropagation();
                await this.updateTaskStatus(quadrant, index, taskData.text, checkbox.checked);
                this.renderDashboardTab(container.closest('.em-tab-content'));
            });
            
            const textSpan = taskItem.createSpan({ 
                text: taskData.text,
                cls: 'em-dashboard-task-text'
            });
            if (taskData.completed) {
                textSpan.addClass('em-task-completed');
            }
            
            // 🔥 대시보드에서만 삭제 (파일은 건드리지 않음)
            const removeBtn = taskItem.createEl('button', { 
                text: '🗑️',
                cls: 'em-dashboard-remove-btn',
                attr: { title: '뷰에서만 제거 (파일은 유지)' }
            });
            removeBtn.onclick = async (e) => {
                e.stopPropagation();
                // syncToNote = false로 호출
                await this.removeTask(quadrant, index, null, null, false);
                this.renderDashboardTab(container.closest('.em-tab-content'));
            };
        });
    });
}
    


    renderHighPriorityTasks(container) {
        const section = container.createDiv('em-dashboard-section');
        section.createEl('h3', { text: '⭐ 우선순위 높은 작업들' });
        
        const currentTasks = this.getCurrentTasks();
        const urgentTasks = [];
        
        ['q1', 'q2'].forEach(quadrant => {
            const tasks = currentTasks[quadrant] || [];
            tasks.forEach((task) => {
                if (typeof task === 'object' && !task.completed) {
                    urgentTasks.push({
                        text: task.text,
                        quadrant: quadrant,
                        createdAt: task.createdAt,
                        priority: quadrant === 'q1' ? '🔥 긴급' : '📅 중요'
                    });
                }
            });
        });
        
        if (urgentTasks.length === 0) {
            section.createEl('p', { text: '✅ 우선순위 높은 미완료 작업이 없습니다.' });
            return;
        }
        
        const list = section.createEl('ul', { cls: 'em-priority-list' });
        urgentTasks.slice(0, 10).forEach(task => {
            const item = list.createEl('li');
            item.createSpan({ text: `${task.priority} `, cls: 'em-priority-badge' });
            item.createSpan({ text: task.text });
        });
    }

    renderCompletedStats(container) {
        const section = container.createDiv('em-dashboard-section');
        section.createEl('h3', { text: '📉 완료 작업 통계' });
        
        const currentTasks = this.getCurrentTasks();
        const completedTasks = [];
        
        ['q1', 'q2', 'q3', 'q4'].forEach(quadrant => {
            const tasks = currentTasks[quadrant] || [];
            tasks.forEach(task => {
                if (typeof task === 'object' && task.completed && task.completedAt) {
                    completedTasks.push({
                        text: task.text,
                        quadrant: quadrant,
                        completedAt: task.completedAt
                    });
                }
            });
        });
        
        if (completedTasks.length === 0) {
            section.createEl('p', { text: '❓ 완료된 작업이 없습니다.' });
            return;
        }
        
        completedTasks.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
        
        const recentSection = section.createDiv('em-recent-completed');
        recentSection.createEl('h4', { text: '🕒 최근 완료된 작업들' });
        
        const list = recentSection.createEl('ul', { cls: 'em-completed-tasks' });
        completedTasks.slice(0, 5).forEach(task => {
            const item = list.createEl('li');
            item.createSpan({ text: `✅ ${task.text} `, cls: 'em-completed-text' });
            
            const date = new Date(task.completedAt);
            const timeStr = date.toLocaleTimeString('ko-KR', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            item.createSpan({ 
                text: `(${timeStr})`, 
                cls: 'em-completed-time' 
            });
        });
    }

    getQuadrantColor(quadrant) {
        const colors = {
            q1: '#ff6b6b',
            q2: '#4ecdc4',
            q3: '#45b7d1',
            q4: '#96ceb4'
        };
        return colors[quadrant] || '#666';
    }

    renderTimelineTab(container) {
        container.empty();
        
        const header = container.createDiv('em-timeline-header');
        header.createEl('h2', { text: '📅 최근 활동 타임라인' });
        header.createEl('p', { 
            text: '최근 수정된 Eisenhower Matrix 파일들을 확인하고 바로 이동할 수 있습니다.',
            cls: 'em-timeline-desc'
        });
        
        const filterContainer = container.createDiv('em-timeline-filters');
        const filters = [
            { id: 'all', text: '📁 전체', active: true },
            { id: 'today', text: '📅 오늘' },
            { id: 'week', text: '📊 이번 주' },
            { id: 'eisenhower', text: '🎯 매트릭스만' }
        ];
        
        filters.forEach(filter => {
            const btn = filterContainer.createEl('button', {
                text: filter.text,
                cls: `em-filter-btn ${filter.active ? 'active' : ''}`
            });
            btn.dataset.filter = filter.id;
            btn.addEventListener('click', () => {
                filterContainer.querySelectorAll('.em-filter-btn').forEach(b => b.removeClass('active'));
                btn.addClass('active');
                this.renderRecentFiles(recentContainer, filter.id);
            });
        });
        
        const recentContainer = container.createDiv('em-recent-files');
        this.renderRecentFiles(recentContainer, 'all');
    }

    renderRecentFiles(container, filter = 'all') {
        try {
            container.empty();
            
            let files = this.app.vault.getMarkdownFiles();
            
            if (filter === 'eisenhower') {
                files = files.filter(file => 
                    file.path.includes(this.plugin.settings.mainFolder) ||
                    file.name.toLowerCase().includes('eisenhower')
                );
            }
            
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
            
            if (filter === 'today') {
                files = files.filter(file => file.stat.mtime >= today.getTime());
            } else if (filter === 'week') {
                files = files.filter(file => file.stat.mtime >= weekAgo.getTime());
            }
            
            files = files
                .sort((a, b) => b.stat.mtime - a.stat.mtime)
                .slice(0, this.plugin.settings.recentFilesCount || 15);
            
            if (files.length === 0) {
                const emptyState = container.createDiv('em-empty-state');
                emptyState.createEl('div', { text: '📝', cls: 'em-empty-icon' });
                emptyState.createEl('p', { text: '선택한 필터에 해당하는 파일이 없습니다.' });
                return;
            }

            const groupedFiles = this.groupFilesByDate(files);
            
            Object.entries(groupedFiles).forEach(([dateStr, dayFiles]) => {
                const dateHeader = container.createDiv('em-date-group');
                const headerTitle = dateHeader.createDiv('em-date-header');
                headerTitle.textContent = dateStr;
                
                const filesList = dateHeader.createDiv('em-files-list');
                
                dayFiles.forEach(file => {
                    const fileItem = filesList.createDiv('em-recent-file-item');
                    
                    const icon = fileItem.createDiv('em-file-icon');
                    if (file.path.includes('Daily')) {
                        icon.textContent = '📅';
                    } else if (file.path.includes('Weekly')) {
                        icon.textContent = '📊';
                    } else if (file.path.includes('Monthly')) {
                        icon.textContent = '🗓️';
                    } else if (file.path.includes('Yearly')) {
                        icon.textContent = '🎯';
                    } else {
                        icon.textContent = '📝';
                    }
                    
                    const fileInfo = fileItem.createDiv('em-file-info');
                    
                    const fileName = fileInfo.createDiv('em-file-name');
                    fileName.textContent = file.basename;
                    
                    const fileDetails = fileInfo.createDiv('em-file-details');
                    const modifiedTime = new Date(file.stat.mtime);
                    const timeStr = modifiedTime.toLocaleTimeString('ko-KR', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                    });
                    const sizeStr = this.formatFileSize(file.stat.size);
                    fileDetails.textContent = `🕒 ${timeStr} • 📊 ${sizeStr}`;
                    
                    const filePath = fileInfo.createDiv('em-file-path');
                    filePath.textContent = file.path;
                    
                    fileItem.addEventListener('click', async () => {
                        await this.openFile(file);
                    });
                    
                    fileItem.addEventListener('mouseenter', () => {
                        fileItem.style.transform = 'translateX(4px)';
                    });
                    
                    fileItem.addEventListener('mouseleave', () => {
                        fileItem.style.transform = 'translateX(0)';
                    });
                });
            });
            
        } catch (error) {
            safeLog.error('최근 파일 렌더링 오류:', error);
            container.createDiv({ 
                cls: 'em-error-state', 
                text: '⚠️ 파일 목록을 불러오는 중 오류가 발생했습니다.' 
            });
        }
    }

    groupFilesByDate(files) {
        const groups = {};
        const now = new Date();
        
        files.forEach(file => {
            const fileDate = new Date(file.stat.mtime);
            const daysDiff = Math.floor((now - fileDate) / (1000 * 60 * 60 * 24));
            
            let dateKey;
            if (daysDiff === 0) {
                dateKey = '📅 오늘';
            } else if (daysDiff === 1) {
                dateKey = '📅 어제';
            } else if (daysDiff < 7) {
                dateKey = `📅 ${daysDiff}일 전`;
            } else {
                dateKey = fileDate.toLocaleDateString('ko-KR');
            }
            
            if (!groups[dateKey]) {
                groups[dateKey] = [];
            }
            groups[dateKey].push(file);
        });
        
        return groups;
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    async openFile(file) {
        try {
            if (!file || !await this.app.vault.adapter.exists(file.path)) {
                new Notice('⚠️ 파일을 찾을 수 없습니다');
                return;
            }
            
            const leaf = this.app.workspace.getLeaf(false);
            await leaf.openFile(file);
            new Notice(`📖 ${file.name} 열림`);
        } catch (error) {
            safeLog.error('파일 열기 오류:', error);
            new Notice('❌ 파일 열기 실패');
        }
    }

    // 데이터 내보내기
    exportData() {
        const data = { tasks: this.tasks, exportDate: new Date().toISOString() };
        const dataStr = JSON.stringify(data, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `eisenhower-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        new Notice('✅ 데이터 내보내기 완료');
    }

    // 데이터 가져오기
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
                        this.render();
                        new Notice('✅ 데이터 가져오기 완료');
                    }
                } catch (error) {
                    safeLog.error('Import error:', error);
                    new Notice('❌ 잘못된 파일 형식');
                }
            };
            reader.readAsText(file);
        };
        
        document.body.appendChild(input);
        input.click();
        document.body.removeChild(input);
    }

// ========================================
// Part 6 끝 - Part 7로 계속...
// ========================================
// ========================================
// Eisenhower Matrix Plugin - Part 7/7
// 이벤트 리스너, 스타일, 설정 탭
// ========================================

    attachEventListeners() {
        const container = this.containerEl;
        
        container.addEventListener('click', async (e) => {
            const target = e.target;
            
            if (target.classList.contains('em-tab-btn')) {
                this.switchTab(target.dataset.tab);
                return;
            }
            
            if (target.classList.contains('em-period-btn')) {
                this.switchPeriod(target.dataset.period);
                return;
            }
            
            if (target.classList.contains('em-week-btn')) {
                this.selectWeek(parseInt(target.dataset.week));
                return;
            }
            
            if (target.classList.contains('em-add-task-btn')) {
                const quadrant = target.dataset.quadrant;
                const week = target.dataset.week;
                
                if (week) {
                    await this.addTask(quadrant, null, 'weekly', parseInt(week));
                } else {
                    await this.addTask(quadrant);
                }
                return;
            }
            
            if (target.classList.contains('em-quick-btn') || target.closest('.em-quick-btn')) {
                const btn = target.closest('.em-quick-btn') || target;
                const quadrant = btn.dataset.quadrant;
                const taskInput = container.querySelector('#em-taskInput');
                const taskText = taskInput ? taskInput.value.trim() : '';
                
                await this.addTask(quadrant, taskText);
                if (taskInput) taskInput.value = '';
                return;
            }
        });
    }

    selectWeek(week) {
        if (week < 1 || week > 4) return;
        this.selectedWeek = week;
        
        const container = this.containerEl;
        container.querySelectorAll('.em-week-btn').forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.week) === week);
        });
        
        const matrixGrid = container.querySelector('.em-matrix-grid');
        if (matrixGrid) this.renderWeeklyMatrix(matrixGrid, week);
        
        const header = container.querySelector('.em-weekly-matrix-container h3');
        if (header) header.textContent = `${week}주차 할일`;
    }

    addStyles() {
        if (document.querySelector('#eisenhower-matrix-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'eisenhower-matrix-styles';
        style.textContent = `
.eisenhower-matrix-container{padding:20px;max-width:1400px;margin:0 auto;height:100%;overflow-y:auto}
.em-header{text-align:center;margin-bottom:30px}
.em-header h1{font-size:32px;margin:0 0 10px 0}
.em-date-header{text-align:center;margin-bottom:20px;padding:15px;background:var(--background-primary-alt);border-radius:8px}
.em-tab-buttons{display:flex;gap:10px;margin-bottom:20px;border-bottom:2px solid var(--background-modifier-border)}
.em-tab-btn{padding:12px 24px;border:none;background:transparent;cursor:pointer;border-radius:6px 6px 0 0;transition:all .2s}
.em-tab-btn.active{background:var(--interactive-accent);color:var(--text-on-accent)}
.em-period-selector{display:flex;gap:10px;margin-bottom:20px;justify-content:center}
.em-period-btn{padding:12px 24px;border:2px solid var(--background-modifier-border);background:var(--background-primary);border-radius:8px;cursor:pointer;transition:all .2s}
.em-period-btn.active{background:var(--interactive-accent);color:var(--text-on-accent);border-color:var(--interactive-accent)}
.em-input-section{margin-bottom:20px;padding:20px;background:var(--background-primary-alt);border-radius:10px}
.em-task-input{width:100%;padding:12px;border:1px solid var(--background-modifier-border);border-radius:8px;background:var(--background-primary);margin-bottom:15px;font-size:14px}
.em-quick-actions{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.em-quick-btn{padding:15px;border:2px solid var(--background-modifier-border);border-left-width:4px;background:var(--background-primary);border-radius:6px;cursor:pointer;text-align:center;transition:all .2s}
.em-quick-btn:hover{transform:translateY(-2px);box-shadow:0 4px 12px rgba(0,0,0,.1)}
.em-btn-icon{font-size:24px;margin-bottom:5px}
.em-matrix-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}
.em-quadrant{border-left:4px solid;border-radius:8px;padding:20px;background:var(--background-primary);min-height:300px}
.em-quadrant-header{margin-bottom:15px;border-bottom:1px solid var(--background-modifier-border);padding-bottom:10px}
.em-quadrant-title{font-weight:bold;font-size:16px;margin-bottom:5px}
.em-quadrant-subtitle{font-size:12px;opacity:.7}
.em-add-task-btn{padding:6px 12px;border:1px solid var(--interactive-accent);background:var(--interactive-accent);color:var(--text-on-accent);border-radius:4px;cursor:pointer;font-size:12px;margin-top:8px}
.em-task-list{display:flex;flex-direction:column;gap:8px}
.em-task-item{padding:10px;background:var(--background-secondary);border-radius:6px;display:flex;justify-content:space-between;align-items:center;transition:all .2s}
.em-task-item:hover{background:var(--background-modifier-hover);transform:translateX(2px)}
.em-task-text{flex:1;margin-right:10px}
.em-task-completed .em-task-text{text-decoration:line-through;opacity:0.6}
.em-task-actions{display:flex;gap:5px}
.em-task-actions button{padding:4px 8px;border:none;border-radius:4px;cursor:pointer;font-size:12px}
.em-btn-remove{background:#ff6b6b;color:white}
.em-empty-state{text-align:center;color:var(--text-muted);font-style:italic;padding:20px;border:2px dashed var(--background-modifier-border);border-radius:8px}
.em-stats{background:var(--background-secondary);border-radius:8px;padding:20px;margin-top:20px}
.em-stat-items{display:flex;justify-content:space-around;flex-wrap:wrap;gap:20px}
.em-stat-item{text-align:center;min-width:80px}
.em-stat-value{font-size:24px;font-weight:bold;margin-bottom:5px}
.em-stat-label{font-size:12px;color:var(--text-muted)}
.em-dashboard-subtitle{margin-top:20px;padding-top:15px;border-top:1px solid var(--background-modifier-border);color:var(--text-accent)}
.em-dashboard-quadrant-section{margin:15px 0;padding:15px;background:var(--background-primary);border-radius:6px;border-left:3px solid var(--interactive-accent)}
.em-dashboard-task-list{list-style:none;padding:0;margin:10px 0}
.em-dashboard-task-item{display:flex;align-items:center;gap:10px;padding:10px;margin:5px 0;background:var(--background-secondary);border-radius:4px;transition:all .2s}
.em-dashboard-task-item:hover{background:var(--background-modifier-hover);transform:translateX(2px)}
.em-dashboard-task-text{flex:1;margin:0 10px}
.em-dashboard-remove-btn{padding:6px 10px;border:none;background:#ff6b6b;color:white;border-radius:4px;cursor:pointer;font-size:12px;opacity:0.7;transition:all .2s}
.em-dashboard-remove-btn:hover{opacity:1;transform:scale(1.05)}
.em-dashboard-section{margin:20px 0;padding:20px;background:var(--background-primary-alt);border-radius:8px}
.em-dashboard-table{width:100%;border-collapse:collapse;margin-top:10px}
.em-dashboard-table th{text-align:left;padding:10px;border-bottom:2px solid var(--background-modifier-border)}
.em-dashboard-table td{padding:10px;border-bottom:1px solid var(--background-modifier-border)}
.em-progress-bar{width:100px;height:8px;background:var(--background-secondary);border-radius:4px;display:inline-block;margin-right:10px}
.em-progress-fill{height:100%;border-radius:4px;transition:width .3s}
.em-priority-list{list-style:none;padding:0}
.em-priority-list li{padding:8px;margin:5px 0;background:var(--background-primary);border-radius:4px}
.em-completed-tasks{list-style:none;padding:0}
.em-completed-tasks li{padding:8px;margin:5px 0}
.em-timeline-filters{display:flex;gap:10px;margin-bottom:15px}
.em-filter-btn{padding:8px 16px;border:1px solid var(--background-modifier-border);background:var(--background-primary);border-radius:6px;cursor:pointer;transition:all .2s}
.em-filter-btn.active{background:var(--interactive-accent);color:var(--text-on-accent)}
.em-date-group{margin-bottom:20px}
.em-date-header{font-weight:bold;font-size:14px;padding:8px 0;color:var(--text-accent)}
.em-files-list{display:flex;flex-direction:column;gap:8px}
.em-recent-file-item{display:flex;align-items:center;padding:12px;background:var(--background-primary-alt);border-radius:6px;cursor:pointer;transition:all .2s}
.em-recent-file-item:hover{background:var(--background-modifier-hover);transform:translateX(4px)}
.em-file-icon{font-size:24px;margin-right:15px}
.em-file-info{flex:1}
.em-file-name{font-weight:bold;margin-bottom:4px}
.em-file-details{font-size:12px;color:var(--text-muted);margin-bottom:2px}
.em-file-path{font-size:11px;color:var(--text-faint);font-family:monospace}
.em-week-buttons{display:flex;gap:10px;margin-bottom:20px}
.em-week-btn{padding:10px 20px;border:2px solid var(--background-modifier-border);background:var(--background-primary);border-radius:6px;cursor:pointer;transition:all .2s}
.em-week-btn.active{background:var(--interactive-accent);color:var(--text-on-accent)}
.em-calendar{margin:20px 0}
.em-days-header{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:8px}
.em-day-header{text-align:center;font-weight:bold;padding:8px;background:var(--background-secondary);border-radius:4px}
.em-days-container{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}
.em-day{padding:12px;text-align:center;border:1px solid var(--background-modifier-border);border-radius:4px;cursor:pointer;transition:all .2s;min-height:60px}
.em-day:hover{background:var(--background-modifier-hover)}
.em-day.em-today{background:var(--interactive-accent);color:var(--text-on-accent);font-weight:bold}
.em-day.em-selected{border:2px solid var(--interactive-accent)}
.em-day.em-other-month{opacity:0.3}
.em-selected-day-view{margin-top:20px;padding:20px;background:var(--background-primary-alt);border-radius:8px}
.em-day-quadrant{margin-bottom:15px;padding:15px;background:var(--background-primary);border-radius:6px}
.em-day-task-item{display:flex;align-items:center;gap:8px;padding:8px;margin:5px 0;background:var(--background-secondary);border-radius:4px}
.em-add-task-input{width:100%;padding:8px;border:1px solid var(--background-modifier-border);border-radius:4px;margin-top:8px}
.em-task-checkbox{margin-right:8px;cursor:pointer}
@media (max-width:768px){
.eisenhower-matrix-container{padding:10px}
.em-header h1{font-size:24px}
.em-matrix-grid{grid-template-columns:1fr;gap:15px}
.em-quick-actions{grid-template-columns:repeat(2,1fr);gap:8px}
.em-tab-buttons{flex-wrap:wrap;gap:5px}
.em-period-selector{flex-wrap:wrap}
.em-task-item{flex-direction:column;align-items:stretch}
.em-calendar{font-size:12px}
}
        `;
        document.head.appendChild(style);
    }
}

// 설정 탭
class EisenhowerSettingTab extends PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.createEl('h2', { text: '🎯 Eisenhower Matrix 설정' });
        
        new Setting(containerEl)
            .setName('메인 폴더')
            .setDesc('Eisenhower Matrix 파일을 저장할 폴더')
            .addText(text => text
                .setPlaceholder('Eisenhower Matrix')
                .setValue(this.plugin.settings.mainFolder)
                .onChange(async (value) => {
                    this.plugin.settings.mainFolder = value;
                    await this.plugin.saveSettings();
                }));
        new Setting(containerEl)
            .setName('삭제 시 파일에서도 제거')
            .setDesc('할일 삭제 시 .md 파일에서도 삭제 (OFF: 뷰에서만 삭제)')
            .addToggle(toggle => toggle
            .setValue(this.plugin.settings.deleteFromNote)
            .onChange(async (value) => {
                this.plugin.settings.deleteFromNote = value;
                await this.plugin.saveSettings();
            }));
        new Setting(containerEl)
            .setName('노트 자동 동기화')
            .setDesc('할일 추가 시 자동으로 노트 파일에 동기화')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.autoSyncToNote)
                .onChange(async (value) => {
                    this.plugin.settings.autoSyncToNote = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('대시보드 폴더')
            .setDesc('DataviewJS 대시보드 파일 위치')
            .addText(text => text
                .setPlaceholder('Dashboard')
                .setValue(this.plugin.settings.dashboardFolder)
                .onChange(async (value) => {
                    this.plugin.settings.dashboardFolder = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('최근 파일 표시 개수')
            .setDesc('타임라인에 표시할 파일 개수')
            .addSlider(slider => slider
                .setLimits(5, 30, 5)
                .setValue(this.plugin.settings.recentFilesCount)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.recentFilesCount = value;
                    await this.plugin.saveSettings();
                }));

        // 폴더 관리
        containerEl.createEl('h3', { text: '📁 폴더 관리' });
        
        new Setting(containerEl)
            .setName('일간 폴더')
            .setDesc('일간 노트를 저장할 폴더명')
            .addText(text => text
                .setPlaceholder('Daily')
                .setValue(this.plugin.settings.dailyFolder)
                .onChange(async (value) => {
                    this.plugin.settings.dailyFolder = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('주간 폴더')
            .setDesc('주간 노트를 저장할 폴더명')
            .addText(text => text
                .setPlaceholder('Weekly')
                .setValue(this.plugin.settings.weeklyFolder)
                .onChange(async (value) => {
                    this.plugin.settings.weeklyFolder = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('월간 폴더')
            .setDesc('월간 노트를 저장할 폴더명')
            .addText(text => text
                .setPlaceholder('Monthly')
                .setValue(this.plugin.settings.monthlyFolder)
                .onChange(async (value) => {
                    this.plugin.settings.monthlyFolder = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('연간 폴더')
            .setDesc('연간 노트를 저장할 폴더명')
            .addText(text => text
                .setPlaceholder('Yearly')
                .setValue(this.plugin.settings.yearlyFolder)
                .onChange(async (value) => {
                    this.plugin.settings.yearlyFolder = value;
                    await this.plugin.saveSettings();
                }));

        // 폴더 생성/삭제 버튼
        const folderButtons = containerEl.createDiv();
        folderButtons.style.display = 'flex';
        folderButtons.style.gap = '10px';
        folderButtons.style.marginBottom = '20px';
        
        const createFoldersBtn = folderButtons.createEl('button', { 
            text: '📁 모든 폴더 생성',
            cls: 'mod-cta'
        });
        createFoldersBtn.onclick = async () => {
            await this.createAllFolders();
            new Notice('✅ 모든 폴더가 생성되었습니다!');
        };
        
        const deleteFoldersBtn = folderButtons.createEl('button', { 
            text: '🗑️ 모든 폴더 삭제',
            cls: 'mod-warning'
        });
        deleteFoldersBtn.onclick = async () => {
            const confirmed = await this.confirmDeletion();
            if (confirmed) {
                await this.deleteAllFolders();
                new Notice('🗑️ 모든 폴더가 삭제되었습니다!');
            }
        };

        // 데이터 관리
        containerEl.createEl('h3', { text: '💾 데이터 관리' });
        
        const dataButtons = containerEl.createDiv();
        dataButtons.style.display = 'flex';
        dataButtons.style.gap = '10px';
        dataButtons.style.marginBottom = '20px';
        
        const exportBtn = dataButtons.createEl('button', { text: '📤 데이터 내보내기' });
        exportBtn.onclick = () => {
            const view = this.app.workspace.getLeavesOfType('eisenhower-matrix-view')[0]?.view;
            if (view) view.exportData();
        };
        
        const importBtn = dataButtons.createEl('button', { text: '📥 데이터 가져오기' });
        importBtn.onclick = () => {
            const view = this.app.workspace.getLeavesOfType('eisenhower-matrix-view')[0]?.view;
            if (view) view.importData();
        };
    }

    async createAllFolders() {
        const folders = [
            `${this.plugin.settings.eisenhowerFolderPath}/${this.plugin.settings.dailyFolder}`,
            `${this.plugin.settings.eisenhowerFolderPath}/${this.plugin.settings.weeklyFolder}`,
            `${this.plugin.settings.eisenhowerFolderPath}/${this.plugin.settings.monthlyFolder}`,
            `${this.plugin.settings.eisenhowerFolderPath}/${this.plugin.settings.yearlyFolder}`
        ];

        for (const folderPath of folders) {
            try {
                const folder = this.app.vault.getAbstractFileByPath(folderPath);
                if (!folder) {
                    await this.app.vault.createFolder(folderPath);
                }
            } catch (error) {
                console.error(`폴더 생성 오류 (${folderPath}):`, error);
            }
        }
    }

    async deleteAllFolders() {
        const folders = [
            `${this.plugin.settings.eisenhowerFolderPath}/${this.plugin.settings.dailyFolder}`,
            `${this.plugin.settings.eisenhowerFolderPath}/${this.plugin.settings.weeklyFolder}`,
            `${this.plugin.settings.eisenhowerFolderPath}/${this.plugin.settings.monthlyFolder}`,
            `${this.plugin.settings.eisenhowerFolderPath}/${this.plugin.settings.yearlyFolder}`
        ];

        for (const folderPath of folders) {
            try {
                const folder = this.app.vault.getAbstractFileByPath(folderPath);
                if (folder) {
                    await this.app.vault.delete(folder, true);
                }
            } catch (error) {
                console.error(`폴더 삭제 오류 (${folderPath}):`, error);
            }
        }
    }

    async confirmDeletion() {
        return new Promise((resolve) => {
            const modal = new Modal(this.app);
            modal.titleEl.setText('⚠️ 폴더 삭제 확인');
            
            const content = modal.contentEl;
            content.createEl('p', { text: '정말로 모든 Eisenhower Matrix 폴더를 삭제하시겠습니까?' });
            content.createEl('p', { 
                text: '이 작업은 되돌릴 수 없으며, 폴더 내의 모든 파일이 삭제됩니다.',
                cls: 'mod-warning'
            });
            
            const buttonContainer = content.createDiv();
            buttonContainer.style.display = 'flex';
            buttonContainer.style.gap = '10px';
            buttonContainer.style.justifyContent = 'flex-end';
            buttonContainer.style.marginTop = '20px';
            
            const cancelBtn = buttonContainer.createEl('button', { text: '취소' });
            cancelBtn.onclick = () => {
                modal.close();
                resolve(false);
            };
            
            const confirmBtn = buttonContainer.createEl('button', { 
                text: '삭제',
                cls: 'mod-warning'
            });
            confirmBtn.onclick = () => {
                modal.close();
                resolve(true);
            };
            
            modal.open();
        });
    }

    showMoveTaskMenu(event, quadrant, index, taskText) {
        try {
            const menu = new this.app.Menu();
            
            const quadrantNames = {
                'urgent-important': { name: '1분면 (긴급&중요)', color: '#ff6b6b' },
                'important-not-urgent': { name: '2분면 (중요&긴급하지않음)', color: '#4ecdc4' },
                'urgent-not-important': { name: '3분면 (긴급&중요하지않음)', color: '#ffe66d' },
                'not-urgent-not-important': { name: '4분면 (긴급하지않음&중요하지않음)', color: '#a8e6cf' }
            };

            const currentQuadrantName = quadrantNames[quadrant].name;
            
            menu.addItem((item) => {
                item.setTitle(`"${taskText}" 이동`)
                    .setIcon("move-3d")
                    .setDisabled(true);
            });
            
            menu.addSeparator();

            Object.keys(quadrantNames).forEach(targetQuadrant => {
                if (targetQuadrant !== quadrant) {
                    const quadrantInfo = quadrantNames[targetQuadrant];
                    menu.addItem((item) => {
                        item.setTitle(`${quadrantInfo.name}으로 이동`)
                            .setIcon("arrow-right")
                            .onClick(async () => {
                                try {
                                    await this.moveTaskToQuadrant(quadrant, targetQuadrant, index);
                                } catch (error) {
                                    safeLog.error('할일 이동 오류:', error);
                                    new Notice('❌ 할일 이동에 실패했습니다');
                                }
                            });
                    });
                }
            });

            menu.addSeparator();

            menu.addItem((item) => {
                item.setTitle('취소')
                    .setIcon("x")
                    .onClick(() => {
                        // 메뉴만 닫기
                    });
            });

            menu.showAtMouseEvent(event);
        } catch (error) {
            safeLog.error('컨텍스트 메뉴 표시 오류:', error);
        }
    }
}

module.exports = EisenhowerMatrixPlugin;

// ========================================
// 🎉 모든 Part 완료!
// ========================================