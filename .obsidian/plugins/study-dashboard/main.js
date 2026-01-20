const { Plugin, PluginSettingTab, Setting, ItemView, Notice, Modal, normalizePath } = require('obsidian');

const DEFAULT_SETTINGS = {
    problemsFolder: '학습관리/문제은행',
    maxProblemsPerChapter: 100,
    dailyGoal: 5,
    targetDate: '2025-12-31',
    defaultSubject: '수학',
    subjects: [
        { name: '수학', chapters: 10 },
        { name: '물리', chapters: 8 },
        { name: '화학', chapters: 8 },
        { name: '생물', chapters: 7 },
        { name: '영어', chapters: 12 },
        { name: '국어', chapters: 10 },
        { name: '한국사', chapters: 15 }
    ],
    timerEnabled: true,
    autoRecordTime: true,
    autoRecordOnCheck: true,
    masteredColor: '#10b981',
    reviewingColor: '#f59e0b',
    learningColor: '#ef4444',
    cellSize: 'large'
};

const VIEW_TYPE_STUDY_DASHBOARD = 'study-dashboard-view';

const PROBLEM_STATUS = {
    LEARNING: 'learning',
    REVIEWING: 'reviewing', 
    MASTERED: 'mastered',
    EMPTY: 'empty'
};

const REVIEW_GRADES = {
    S: { name: '신급', color: '#800080', minReviews: 10, emoji: '👑' },
    A: { name: '제왕급', color: '#FFD700', minReviews: 7, emoji: '⭐' },
    B: { name: '영웅급', color: '#B22222', minReviews: 5, emoji: '🔥' },
    C: { name: '평민', color: '#708090', minReviews: 3, emoji: '📚' },
    D: { name: '하층민', color: '#654321', minReviews: 2, emoji: '📖' },
    E: { name: '노예', color: '#2F4F4F', minReviews: 1, emoji: '⛓️' },
    F: { name: '가축', color: '#1a1a1a', minReviews: 0, emoji: '🐷' }
};

const getReviewGrade = (reviewCount, understanding = 0) => {
    if (reviewCount === 0 || understanding === 0) return 'F';
    if (reviewCount >= 10) return 'S';
    if (reviewCount >= 7) return 'A';
    if (reviewCount >= 5) return 'B';
    if (reviewCount >= 3) return 'C';
    if (reviewCount >= 2) return 'D';
    if (reviewCount >= 1) return 'E';
    return 'F';
};

const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

const isMobile = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;
};

class StudyDashboardPlugin extends Plugin {
    async onload() {
        console.log('📱 Study Dashboard Mobile 로드 시작');
        await this.loadSettings();
        this.registerView(VIEW_TYPE_STUDY_DASHBOARD, (leaf) => new StudyDashboardView(leaf, this));
        this.addStyles();
        this.addRibbonIcon('graduation-cap', '📚 Study Dashboard', () => this.activateView());
        this.registerCommands();
        this.initializeTimerState();
        this.setupCheckboxListener();
        this.setupStopwatchListener();
        this.setupAutoRefresh();
        this.addSettingTab(new StudyDashboardSettingTab(this.app, this));
        this.addCommand({
            id: 'open-settings-mobile',
            name: '⚙️ 설정 열기',
            callback: () => {
                new MobileSettingsModal(this.app, this).open();
            }
        });
        
        this.checkUnderstandingPlugin();
        console.log('✅ Study Dashboard Mobile 로드 완료!');
    }
    
    checkUnderstandingPlugin() {
        const understandingPlugin = this.app.plugins.plugins['understanding-input'];
        if (understandingPlugin) {
            console.log('✅ Understanding Input 플러그인 감지됨');
            this.understandingPlugin = understandingPlugin;
        } else {
            console.log('ℹ️ Understanding Input 플러그인 없음');
            this.understandingPlugin = null;
        }
    }
    
    async openUnderstandingModal(timeString = null) {
        if (this.understandingPlugin) {
            const UnderstandingModal = this.understandingPlugin.constructor.UnderstandingModal;
            if (UnderstandingModal) {
                new UnderstandingModal(this.app, timeString).open();
            } else {
                this.understandingPlugin.recordTimeAndUnderstanding?.();
            }
        } else {
            new TimerStopModal(this.app, this, 0, []).open();
        }
    }

    async onunload() {
        if (this.timerState?.interval) {
            clearInterval(this.timerState.interval);
        }
        if (this.stopwatchObserver) {
            this.stopwatchObserver.disconnect();
        }
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
        }
        if (this.fileWatcher) {
            this.fileWatcher();
        }
    }
    
    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }
    
    async saveSettings() {
        await this.saveData(this.settings);
    }
    
    async activateView() {
        this.app.workspace.detachLeavesOfType(VIEW_TYPE_STUDY_DASHBOARD);
        
        if (isMobile()) {
            await this.app.workspace.getLeaf('tab').setViewState({
                type: VIEW_TYPE_STUDY_DASHBOARD,
                active: true
            });
        } else {
            await this.app.workspace.getRightLeaf(false).setViewState({
                type: VIEW_TYPE_STUDY_DASHBOARD,
                active: true
            });
        }
        
        this.app.workspace.revealLeaf(
            this.app.workspace.getLeavesOfType(VIEW_TYPE_STUDY_DASHBOARD)[0]
        );
    }
    
    getSubjectInfo(subjectName) {
        const subject = this.settings.subjects.find(s => {
            const name = typeof s === 'string' ? s : s.name;
            return name === subjectName;
        });
        
        if (subject) {
            if (typeof subject === 'string') {
                return { name: subject, chapters: 10 };
            }
            return subject;
        }
        
        console.warn(`⚠️ 과목을 찾을 수 없음: ${subjectName}`);
        return { name: subjectName, chapters: 10 };
    }
    
    registerCommands() {
        this.addCommand({
            id: 'open-study-dashboard',
            name: '📚 Study Dashboard 열기',
            callback: () => this.activateView()
        });
        this.addCommand({
            id: 'create-new-problem',
            name: '➕ 새 문제 생성',
            callback: () => {
                new ProblemCreationModal(this.app, this).open();
            }
        });
        this.addCommand({
            id: 'record-time-now',
            name: '⏰ 현재 시간 기록',
            callback: () => {
                this.recordCurrentTime();
            }
        });
        this.addCommand({
            id: 'record-time-understanding',
            name: '📝 시간과 이해도 기록',
            callback: () => {
                if (this.understandingPlugin) {
                    this.understandingPlugin.recordTimeAndUnderstanding?.();
                } else {
                    this.recordTimeAndUnderstanding();
                }
            }
        });
        this.addCommand({
            id: 'quick-understanding',
            name: '🎯 이해도만 입력',
            callback: () => {
                if (this.understandingPlugin) {
                    const UnderstandingModal = require('./understanding-modal');
                    new UnderstandingModal(this.app).open();
                } else {
                    this.openUnderstandingModal();
                }
            }
        });
    }
    
    initializeTimerState() {
        this.timerState = {
            isRunning: false,
            startTime: null,
            seconds: 0,
            interval: null,
            currentSubject: this.settings.defaultSubject,
            currentChapter: 1,
            currentFile: null
        };
    }

    startTimer() {
        if (this.timerState.isRunning) return;
        const activeFile = this.app.workspace.getActiveFile();
        if (activeFile && activeFile.path && activeFile.path.includes(this.settings.problemsFolder)) {
            this.timerState.currentFile = activeFile;
        } else {
            this.timerState.currentFile = null;
        }
        this.timerState.isRunning = true;
        this.timerState.startTime = Date.now();
        this.timerState.seconds = 0;
        this.timerState.interval = setInterval(() => {
            this.timerState.seconds++;
            this.updateTimerDisplay();
        }, 1000);
        new Notice('⏱️ 타이머 시작!');
    }

    async stopTimer() {
        if (!this.timerState.isRunning) return;
        this.timerState.isRunning = false;
        if (this.timerState.interval) {
            clearInterval(this.timerState.interval);
            this.timerState.interval = null;
        }
        const timeSpent = this.timerState.seconds;
        const timeString = formatTime(timeSpent);
        const currentFile = this.timerState.currentFile;
        this.timerState.currentFile = null;
        if (this.settings.autoRecordTime && currentFile && currentFile.path) {
            try {
                await this.addTimeToFile(currentFile, timeString);
                new Notice(`⏹️ 타이머 정지! 소요시간: ${timeString} 자동 기록됨`);
            } catch (error) {
                new Notice(`⏹️ 타이머 정지! 소요시간: ${timeString}`);
            }
        } else {
            new Notice(`⏹️ 타이머 정지! 소요시간: ${timeString}`);
        }
        return timeSpent;
    }

    resetTimer() {
        this.stopTimer();
        this.timerState.seconds = 0;
        this.updateTimerDisplay();
        new Notice('🔄 타이머 초기화');
    }

    updateTimerDisplay() {
        const displays = document.querySelectorAll('.timer-display');
        displays.forEach(display => {
            display.textContent = formatTime(this.timerState.seconds);
        });
    }

    setupCheckboxListener() {
        this.registerDomEvent(document, 'click', async (evt) => {
            const target = evt.target;
            if (target && target.type === 'checkbox') {
                setTimeout(async () => {
                    if (target.checked) {
                        const activeFile = this.app.workspace.getActiveFile();
                        if (activeFile) {
                            const now = new Date();
                            const timeString = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
                            await this.addTimeToFile(activeFile, timeString);
                            new Notice(`✅ 시간 기록 완료: ${timeString}`);
                        }
                    }
                }, 100);
            }
        });
    }

    async recordCurrentTime() {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            new Notice('❌ 활성 파일이 없습니다.');
            return;
        }
        const now = new Date();
        const timeString = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
        await this.addTimeToFile(activeFile, timeString);
        new Notice(`✅ 현재 시간 기록: ${timeString}`);
    }

    async addTimeToFile(file, timeString) {
        try {
            const content = await this.app.vault.read(file);
            const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
            if (!frontmatterMatch) return;
            const frontmatter = frontmatterMatch[1];
            const timesMatch = frontmatter.match(/times:\s*\[(.*?)\]/s);
            let newTimes;
            if (timesMatch) {
                const existingTimes = timesMatch[1].trim();
                newTimes = existingTimes ? `times: [${existingTimes}, "${timeString}"]` : `times: ["${timeString}"]`;
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
            await this.app.vault.modify(file, newContent);
        } catch (error) {
            console.error('시간 기록 오류:', error);
        }
    }

    async addUnderstandingToFile(file, understanding) {
        try {
            const content = await this.app.vault.read(file);
            const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
            let newContent = content;
            if (frontmatterMatch) {
                const frontmatter = frontmatterMatch[1];
                const understandingsMatch = frontmatter.match(/understandings:\s*\[(.*?)\]/);
                let newUnderstandings;
                if (understandingsMatch) {
                    const existingUnderstandings = understandingsMatch[1].trim();
                    newUnderstandings = existingUnderstandings ? 
                        `understandings: [${existingUnderstandings}, ${understanding}]` : 
                        `understandings: [${understanding}]`;
                    newContent = content.replace(/understandings:\s*\[.*?\]/, newUnderstandings);
                } else {
                    newContent = content.replace(
                        frontmatterMatch[0],
                        `---\n${frontmatter}\nunderstandings: [${understanding}]\n---`
                    );
                }
            } else {
                newContent = `---\nunderstandings: [${understanding}]\n---\n\n${content}`;
            }
            await this.app.vault.modify(file, newContent);
        } catch (error) {
            console.error('이해도 추가 오류:', error);
        }
    }

    setupStopwatchListener() {
        this.stopwatchObserver = new MutationObserver((mutations) => {});
        if (document.body) {
            this.stopwatchObserver.observe(document.body, {
                childList: true,
                subtree: true,
                characterData: true
            });
        }
    }

    setupAutoRefresh() {
        this.fileWatcher = this.app.vault.on('modify', (file) => {
            if (file && file.path && file.path.includes(this.settings.problemsFolder)) {
                setTimeout(() => {
                    this.refreshDashboard();
                }, 500);
            }
        });

        this.registerEvent(
            this.app.vault.on('create', (file) => {
                if (file && file.path && file.path.includes(this.settings.problemsFolder)) {
                    setTimeout(() => {
                        this.refreshDashboard();
                    }, 500);
                }
            })
        );

        this.registerEvent(
            this.app.vault.on('delete', (file) => {
                if (file && file.path && file.path.includes(this.settings.problemsFolder)) {
                    setTimeout(() => {
                        this.refreshDashboard();
                    }, 500);
                }
            })
        );

        this.autoRefreshInterval = setInterval(() => {
            const dashboardView = this.app.workspace.getLeavesOfType(VIEW_TYPE_STUDY_DASHBOARD)[0];
            if (dashboardView && dashboardView.view) {
                this.refreshDashboard();
            }
        }, 30000);
    }

    async showTimerStopModal(timerDuration) {
        try {
            const activeFile = this.app.workspace.getActiveFile();
            let existingUnderstandings = [];
            
            if (activeFile && activeFile.extension === 'md') {
                const content = await this.app.vault.read(activeFile);
                const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
                if (frontmatterMatch) {
                    const frontmatter = frontmatterMatch[1];
                    const understandingsMatch = frontmatter.match(/understandings:\s*\[(.*?)\]/s);
                    if (understandingsMatch) {
                        existingUnderstandings = understandingsMatch[1]
                            .split(',')
                            .map(u => parseInt(u.trim()))
                            .filter(u => !isNaN(u));
                    }
                }
            }
            
            if (this.understandingPlugin) {
                const hours = Math.floor(timerDuration / 3600);
                const minutes = Math.floor((timerDuration % 3600) / 60);
                const seconds = timerDuration % 60;
                const timeString = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
                
                new UnderstandingModalExtended(this.app, this, timeString, existingUnderstandings).open();
            } else {
                const modal = new TimerStopModal(this.app, this, timerDuration, existingUnderstandings);
                modal.open();
            }
            
            setTimeout(() => this.refreshDashboard(), 1500);
            
        } catch (error) {
            console.error('타이머 정지 모달 오류:', error);
            new Notice('❌ 타이머 정지 모달을 열 수 없습니다.');
        }
    }

    async checkProblemExists(subject, chapter, number) {
        try {
            const chapterFolder = normalizePath(`${this.settings.problemsFolder}/${subject}/${chapter}장`);
            const files = this.app.vault.getMarkdownFiles()
                .filter(file => file && file.path && file.path.startsWith(chapterFolder));
            const existingFile = files.find(file => {
                if (!file || !file.basename) return false;
                const match = file.basename.match(/^(\d+)_/);
                return match && parseInt(match[1]) === number;
            });
            return existingFile;
        } catch (error) {
            return null;
        }
    }

    async createProblem(subject, chapter, number, title, difficulty = 3) {
        try {
            const chapterFolder = normalizePath(`${this.settings.problemsFolder}/${subject}/${chapter}장`);
            try {
                await this.app.vault.createFolder(chapterFolder);
            } catch (folderError) {}
            const existingFile = await this.checkProblemExists(subject, chapter, number);
            if (existingFile) {
                new Notice(`❌ ${subject} ${chapter}장 ${number}번 문제가 이미 존재합니다`);
                return false;
            }
            const fileName = `${String(number).padStart(3, '0')}_${title.replace(/[^\w가-힣]/g, '_')}.md`;
            const filePath = normalizePath(`${chapterFolder}/${fileName}`);
            const today = new Date().toISOString().split('T')[0];
            const content = this.generateProblemContent(subject, chapter, number, title, difficulty, today);
            await this.app.vault.create(filePath, content);
            const newFile = this.app.vault.getAbstractFileByPath(filePath);
            if (newFile) {
                const leaf = this.app.workspace.getLeaf(false);
                await leaf.openFile(newFile);
            }
            new Notice(`✅ '${title}' 문제가 ${subject} ${chapter}장에 생성되었습니다.`);
            setTimeout(() => this.refreshDashboard(), 300);
            return true;
        } catch (error) {
            new Notice(`❌ 문제 생성 중 오류: ${error.message}`);
            return false;
        }
    }

    async createBulkProblems(subject, chapter, startNumber, endNumber) {
        let created = 0, skipped = 0;
        for (let i = startNumber; i <= endNumber; i++) {
            try {
                const result = await this.createProblem(subject, chapter, i, `문제 ${i}`, 3);
                result ? created++ : skipped++;
                await new Promise(resolve => setTimeout(resolve, 50));
            } catch (error) {
                skipped++;
            }
        }
        new Notice(`✅ ${created}개 생성, ${skipped}개 건너뜀`);
        this.refreshDashboard();
    }

    refreshDashboard() {
        const dashboardView = this.app.workspace.getLeavesOfType(VIEW_TYPE_STUDY_DASHBOARD)[0];
        if (dashboardView?.view?.refresh) {
            dashboardView.view.refresh();
        }
    }

    async openProblemFile(subject, chapter, number) {
        try {
            const chapterFolder = normalizePath(`${this.settings.problemsFolder}/${subject}/${chapter}장`);
            const files = this.app.vault.getMarkdownFiles()
                .filter(file => file && file.path && file.path.startsWith(chapterFolder));
            const targetFile = files.find(file => {
                if (!file || !file.basename) return false;
                const match = file.basename.match(/^(\d+)_/);
                return match && parseInt(match[1]) === number;
            });
            if (targetFile) {
                const leaf = this.app.workspace.getLeaf(false);
                await leaf.openFile(targetFile);
                new Notice(`📖 ${chapter}장 문제 ${number}번 열기`);
            } else {
                new Notice(`❌ ${chapter}장 문제 ${number}번 파일을 찾을 수 없습니다.`);
            }
        } catch (error) {
            new Notice(`❌ 파일을 여는 중 오류: ${error.message}`);
        }
    }

    // 파트 2로 계속...
    // 파트 1에서 계속...

    generateProblemContent(subject, chapter, number, title, difficulty, today) {
        return `---
number: ${number}
chapter: ${chapter}
title: "${title}"
subject: ${subject}
difficulty: ${difficulty}
reviewCount: 0
times: []
understandings: []
understanding: 0
created: ${today}
tags: [anki-card, ${subject}, ${chapter}장, study-dashboard]
---

# ${chapter}장 ${number}번. ${title}

> 📚 **출처**: (출처명) (페이지)  
> 📖 **단원**: ${subject} - ${chapter}장  
> ⭐ **난이도**: ${difficulty}/5

---

## 📊 복습 진행 현황

\`\`\`dataviewjs
const current = dv.current();
const content = await dv.io.load(current.file.path);
const checkedCount = (content.match(/- \\[x\\] .*?복습/gi) || []).length;
const reviewCount = checkedCount;
const times = current.times || [];
const understandings = current.understandings || [];
const avgUnderstanding = understandings.length > 0 
    ? Math.round(understandings.reduce((a, b) => a + b, 0) / understandings.length) 
    : 0;

function getGrade(count, understand) {
    if (count === 0 || understand === 0) return { name: '가축', emoji: '🐷', level: 'F', color: '#1a1a1a' };
    if (count >= 10) return { name: '신급', emoji: '👑', level: 'S', color: '#800080' };
    if (count >= 7) return { name: '제왕급', emoji: '⭐', level: 'A', color: '#FFD700' };
    if (count >= 5) return { name: '영웅급', emoji: '🔥', level: 'B', color: '#B22222' };
    if (count >= 3) return { name: '평민', emoji: '📚', level: 'C', color: '#708090' };
    if (count >= 2) return { name: '하층민', emoji: '📖', level: 'D', color: '#654321' };
    if (count >= 1) return { name: '노예', emoji: '⛓️', level: 'E', color: '#2F4F4F' };
    return { name: '가축', emoji: '🐷', level: 'F', color: '#1a1a1a' };
}
const grade = getGrade(reviewCount, avgUnderstanding);
dv.paragraph(\`복습: \${reviewCount}/10회 | 등급: \${grade.emoji} \${grade.level}급 | 이해도: \${avgUnderstanding}%\`);
\`\`\`

---

## 📸 문제

> [!info]+ 🖼️ 문제 이미지
> 이미지를 여기에 붙여넣으세요

## 💡 힌트

> [!hint]- 💡 힌트 보기
> 힌트 내용

## ✅ 정답 및 풀이

> [!success]- 🔍 정답 보기
> **정답:** 
> **풀이:**

## 📝 메모

> [!note]- 📝 개인 메모
> - 

## ✅ 복습 체크리스트

- [ ] **1차 복습** 🔰 | 기본 이해
- [ ] **2차 복습** 📖 | 정확도 향상
- [ ] **3차 복습** 🎯 | 속도 향상
- [ ] **4차 복습** ⚡ | 완벽 이해
- [ ] **5차 복습** 🚀 | 응용 능력
- [ ] **6차 복습** 💪 | 심화 학습
- [ ] **7차 복습** 💎 | 마스터
- [ ] **8차 복습** 🌟 | 전문가
- [ ] **9차 복습** ⭐ | 완벽 숙달
- [ ] **10차 복습** 🏆 | 신급 달성!
`;
    }

    addStyles() {
        const mobile = isMobile();
        const css = `
        .study-dashboard-container {
            padding: ${mobile ? '10px' : '20px'};
            background: var(--background-primary);
            color: var(--text-normal);
            height: 100%;
            overflow-y: auto;
            -webkit-overflow-scrolling: touch;
        }
        .dashboard-header {
            text-align: center;
            margin-bottom: ${mobile ? '15px' : '30px'};
            padding: ${mobile ? '15px' : '20px'};
            background: linear-gradient(135deg, var(--interactive-accent) 0%, var(--interactive-accent-hover) 100%);
            border-radius: ${mobile ? '12px' : '15px'};
            color: white;
        }
        .dashboard-title {
            font-size: ${mobile ? '1.8rem' : '2.5rem'};
            font-weight: bold;
            margin: 0;
        }
        .dashboard-subtitle {
            font-size: ${mobile ? '1rem' : '1.2rem'};
            opacity: 0.9;
            margin: 10px 0 0 0;
        }
        .timer-section {
            background: var(--background-secondary);
            padding: ${mobile ? '15px' : '25px'};
            border-radius: ${mobile ? '12px' : '15px'};
            margin-bottom: ${mobile ? '15px' : '30px'};
            text-align: center;
            border: 2px solid var(--background-modifier-border);
        }
        .timer-display {
            font-size: ${mobile ? '2rem' : '3rem'};
            font-weight: bold;
            font-family: 'Courier New', monospace;
            color: var(--interactive-accent);
            margin: ${mobile ? '15px 0' : '20px 0'};
        }
        .timer-controls {
            display: flex;
            gap: ${mobile ? '10px' : '15px'};
            justify-content: center;
            margin-top: ${mobile ? '15px' : '20px'};
            flex-wrap: wrap;
        }
        .timer-btn {
            padding: ${mobile ? '14px 28px' : '12px 25px'};
            border: none;
            border-radius: 25px;
            font-size: ${mobile ? '1.1rem' : '1rem'};
            font-weight: bold;
            cursor: pointer;
            transition: all 0.3s ease;
            color: white;
            touch-action: manipulation;
            -webkit-tap-highlight-color: transparent;
        }
        .timer-btn:active {
            transform: scale(0.95);
        }
        .timer-btn.start { background: #10b981; }
        .timer-btn.stop { background: #ef4444; }
        .timer-btn.reset { background: #6b7280; }
        .mobile-settings-btn {
            margin: 15px auto 0;
            padding: ${mobile ? '12px 28px' : '10px 25px'};
            background: rgba(255,255,255,0.2);
            border: 2px solid rgba(255,255,255,0.3);
            border-radius: 20px;
            color: white;
            cursor: pointer;
            font-weight: bold;
            font-size: ${mobile ? '1.1rem' : '1rem'};
            transition: all 0.3s ease;
            display: block;
            touch-action: manipulation;
        }
        .mobile-settings-btn:active {
            transform: scale(0.95);
        }
        .subject-tabs, .chapter-tabs {
            display: flex;
            gap: ${mobile ? '8px' : '10px'};
            margin-bottom: ${mobile ? '15px' : '25px'};
            justify-content: flex-start;
            flex-wrap: nowrap;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
            padding: ${mobile ? '5px 0' : '0'};
        }
        .subject-tabs::-webkit-scrollbar,
        .chapter-tabs::-webkit-scrollbar {
            height: 4px;
        }
        .subject-tab, .chapter-tab {
            padding: ${mobile ? '12px 20px' : '10px 20px'};
            border: 2px solid var(--background-modifier-border);
            border-radius: 25px;
            background: var(--background-secondary);
            color: var(--text-normal);
            cursor: pointer;
            transition: all 0.3s ease;
            white-space: nowrap;
            flex-shrink: 0;
            font-size: ${mobile ? '1rem' : '0.9rem'};
            font-weight: 600;
            touch-action: manipulation;
        }
        .subject-tab:active, .chapter-tab:active {
            transform: scale(0.95);
        }
        .subject-tab.active, .chapter-tab.active {
            background: var(--interactive-accent);
            color: white;
            border-color: var(--interactive-accent);
        }
        .problems-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(${mobile ? '70px' : '60px'}, 1fr));
            gap: ${mobile ? '12px' : '10px'};
            margin: 20px 0;
            padding: ${mobile ? '5px' : '0'};
        }
        .problem-cell {
            width: 100%;
            min-width: ${mobile ? '70px' : '60px'};
            height: ${mobile ? '70px' : '60px'};
            border-radius: ${mobile ? '12px' : '10px'};
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.2s ease;
            font-size: ${mobile ? '1.3rem' : '1.1rem'};
            color: white !important;
            position: relative;
            border: 3px solid transparent;
            touch-action: manipulation;
            -webkit-tap-highlight-color: transparent;
        }
        .problem-cell:active {
            transform: scale(0.92);
        }
        .problem-cell.empty {
            background: #4a4a4a !important;
            color: #999999 !important;
            border: 3px dashed #555555 !important;
        }
        .problem-cell.grade-S { 
            background: #800080 !important; 
            border: 3px solid #9932cc !important;
            box-shadow: 0 0 15px rgba(128, 0, 128, 0.6);
        }
        .problem-cell.grade-A { 
            background: #FFD700 !important; 
            color: #000000 !important; 
            border: 3px solid #FFA500 !important;
            box-shadow: 0 0 15px rgba(255, 215, 0, 0.6);
        }
        .problem-cell.grade-B { 
            background: #B22222 !important; 
            border: 3px solid #dc143c !important;
            box-shadow: 0 0 12px rgba(178, 34, 34, 0.5);
        }
        .problem-cell.grade-C { 
            background: #708090 !important; 
            border: 3px solid #8a9ba8 !important;
        }
        .problem-cell.grade-D { 
            background: #654321 !important; 
            border: 3px solid #8b5a2b !important;
        }
        .problem-cell.grade-E { 
            background: #2F4F4F !important; 
            border: 3px solid #3e5e5e !important;
        }
        .problem-cell.grade-F { 
            background: #1a1a1a !important; 
            border: 3px solid #333333 !important;
        }
        .grade-badge {
            position: absolute;
            top: ${mobile ? '4px' : '3px'};
            right: ${mobile ? '4px' : '3px'};
            font-size: ${mobile ? '18px' : '16px'};
            line-height: 1;
        }
        .action-buttons {
            display: flex;
            gap: ${mobile ? '10px' : '15px'};
            justify-content: center;
            margin: ${mobile ? '15px 0' : '20px 0'};
            flex-wrap: wrap;
            padding: 0 ${mobile ? '5px' : '0'};
        }
        .action-btn {
            padding: ${mobile ? '14px 24px' : '12px 25px'};
            border: none;
            border-radius: 25px;
            background: var(--interactive-accent);
            color: white;
            font-weight: bold;
            font-size: ${mobile ? '1rem' : '0.95rem'};
            cursor: pointer;
            transition: all 0.3s ease;
            touch-action: manipulation;
            white-space: nowrap;
        }
        .action-btn:active {
            transform: scale(0.95);
        }
        .refresh-btn {
            background: #06b6d4 !important;
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(${mobile ? '150px' : '200px'}, 1fr));
            gap: ${mobile ? '12px' : '20px'};
            margin-bottom: ${mobile ? '15px' : '30px'};
        }
        .stat-card {
            background: var(--background-secondary);
            padding: ${mobile ? '15px' : '20px'};
            border-radius: ${mobile ? '12px' : '15px'};
            text-align: center;
        }
        .stat-value {
            font-size: ${mobile ? '2rem' : '2.5rem'};
            font-weight: bold;
            margin-bottom: 10px;
        }
        .stat-label {
            font-size: ${mobile ? '0.9rem' : '1rem'};
            opacity: 0.8;
        }
        `;
        const style = document.createElement('style');
        style.textContent = css;
        document.head.appendChild(style);
    }
}

class StudyDashboardView extends ItemView {
    constructor(leaf, plugin) {
        super(leaf);
        this.plugin = plugin;
        this.currentSubject = this.plugin.settings.defaultSubject;
        this.currentChapter = 1;
        this.displayCount = 100;
        this.isMobile = isMobile();
    }
    
    getViewType() { return VIEW_TYPE_STUDY_DASHBOARD; }
    getDisplayText() { return '📚 Study Dashboard'; }
    getIcon() { return 'graduation-cap'; }
    
    async onOpen() {
        const container = this.containerEl.children[1];
        container.empty();
        container.addClass('study-dashboard-container');
        await this.renderDashboard(container);
    }
    
    async renderDashboard(container) {
        container.empty();
        this.renderHeader(container);
        this.renderTimerSection(container);
        this.renderSubjectTabs(container);
        this.renderChapterTabs(container);
        await this.renderStats(container);
        this.renderActionButtons(container);
        await this.renderProblemsGrid(container);
    }
    
    renderHeader(container) {
        const header = container.createDiv('dashboard-header');
        header.createEl('h1', { cls: 'dashboard-title', text: '📚 Study Dashboard' });
        
        let totalChapters = 10;
        const subjectInfo = this.plugin.settings.subjects.find(s => {
            const name = typeof s === 'string' ? s : s.name;
            return name === this.currentSubject;
        });
        
        if (subjectInfo && typeof subjectInfo === 'object' && subjectInfo.chapters) {
            totalChapters = subjectInfo.chapters;
        }
        
        header.createEl('p', { 
            cls: 'dashboard-subtitle',
            text: `${this.currentSubject} ${this.currentChapter}장 / 총 ${totalChapters}장` 
        });
        
        if (this.plugin.understandingPlugin) {
            const integrationStatus = header.createEl('p');
            integrationStatus.style.cssText = 'font-size: 0.75rem; opacity: 0.7; margin-top: 5px;';
            integrationStatus.innerHTML = '🔗 Understanding Input 연동 ✅';
        }
        
        const now = new Date();
        const timeStr = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
        const updateInfo = header.createEl('p');
        updateInfo.style.cssText = 'font-size: 0.85rem; opacity: 0.8; margin-top: 5px;';
        updateInfo.textContent = `마지막 업데이트: ${timeStr}`;
        
        const settingsBtn = header.createEl('button', {
            cls: 'mobile-settings-btn',
            text: '⚙️ 설정'
        });
        settingsBtn.addEventListener('click', () => {
            new MobileSettingsModal(this.app, this.plugin).open();
        });
        
        console.log(`📊 대시보드 헤더: ${this.currentSubject} ${this.currentChapter}장/${totalChapters}장`);
    }
    
    renderTimerSection(container) {
        const timerSection = container.createDiv('timer-section');
        timerSection.createEl('h2', { text: '⏱️ 공부 타이머' });
        const timerDisplay = timerSection.createDiv('timer-display');
        timerDisplay.textContent = formatTime(this.plugin.timerState.seconds);
        const controls = timerSection.createDiv('timer-controls');
        
        const startBtn = controls.createEl('button', { cls: 'timer-btn start', text: '▶️ 시작' });
        startBtn.addEventListener('click', () => this.plugin.startTimer());
        
        const stopBtn = controls.createEl('button', { cls: 'timer-btn stop', text: '⏹️ 정지' });
        stopBtn.addEventListener('click', () => this.plugin.stopTimer());
        
        const resetBtn = controls.createEl('button', { cls: 'timer-btn reset', text: '🔄 초기화' });
        resetBtn.addEventListener('click', () => this.plugin.resetTimer());
    }
    
    renderSubjectTabs(container) {
        const tabsContainer = container.createDiv();
        const tabs = tabsContainer.createDiv('subject-tabs');
        
        this.plugin.settings.subjects.forEach(subjectObj => {
            const subject = typeof subjectObj === 'string' ? subjectObj : subjectObj.name;
            const chapters = typeof subjectObj === 'object' ? subjectObj.chapters : 10;
            
            const tab = tabs.createEl('button', {
                cls: 'subject-tab' + (subject === this.currentSubject ? ' active' : ''),
                text: `${subject} (${chapters}장)`
            });
            
            tab.addEventListener('click', () => {
                console.log(`과목 변경: ${subject} 선택됨`);
                this.currentSubject = subject;
                this.currentChapter = 1;
                this.renderDashboard(container);
            });
        });
    }
    
    renderChapterTabs(container) {
        let totalChapters = 10;
        
        const subjectInfo = this.plugin.settings.subjects.find(s => {
            const name = typeof s === 'string' ? s : s.name;
            return name === this.currentSubject;
        });
        
        if (subjectInfo && typeof subjectInfo === 'object' && subjectInfo.chapters) {
            totalChapters = subjectInfo.chapters;
        }
        
        const chapterSection = container.createDiv();
        chapterSection.createEl('h3', { 
            text: `📖 ${this.currentSubject} - 총 ${totalChapters}장`,
            attr: { style: `text-align: center; margin: ${this.isMobile ? '15px 0 10px' : '20px 0 10px'}; font-size: ${this.isMobile ? '1.1rem' : '1.2rem'};` }
        });
        
        const tabs = chapterSection.createDiv('chapter-tabs');
        
        for (let i = 1; i <= totalChapters; i++) {
            const tab = tabs.createEl('button', {
                cls: 'chapter-tab' + (i === this.currentChapter ? ' active' : ''),
                text: `${i}장`
            });
            
            tab.addEventListener('click', () => {
                console.log(`장 변경: ${i}장 선택됨`);
                this.currentChapter = i;
                this.renderDashboard(container);
            });
        }
        
        console.log(`✅ ${this.currentSubject} - ${totalChapters}장 탭 렌더링 완료, 현재: ${this.currentChapter}장`);
    }
    
    async renderStats(container) {
        const statsGrid = container.createDiv('stats-grid');
        const problemsData = await this.loadProblemsData();
        const total = Object.keys(problemsData).length;
        const gradeStats = this.calculateGradeStats(problemsData);
        const completed = gradeStats.S + gradeStats.A + gradeStats.B;
        
        const stats = [
            { label: '총 문제', value: total.toString(), color: '#3b82f6' },
            { label: '완료 (S/A/B)', value: completed.toString(), color: '#10b981' },
            { label: '현재 장', value: `${this.currentChapter}장`, color: '#06b6d4' }
        ];
        
        stats.forEach(stat => {
            const card = statsGrid.createDiv('stat-card');
            const value = card.createDiv('stat-value');
            value.style.color = stat.color;
            value.textContent = stat.value;
            card.createDiv('stat-label').textContent = stat.label;
        });
    }

    renderActionButtons(container) {
        const actions = container.createDiv('action-buttons');
        
        const newProblemBtn = actions.createEl('button', {
            cls: 'action-btn',
            text: '➕ 새 문제'
        });
        newProblemBtn.addEventListener('click', () => {
            new ProblemCreationModal(this.app, this.plugin, this.currentSubject, this.currentChapter).open();
        });
        
        const bulkCreateBtn = actions.createEl('button', { 
            cls: 'action-btn', 
            text: '📝 일괄 생성' 
        });
        bulkCreateBtn.addEventListener('click', () => {
            new BulkCreationModal(this.app, this.plugin, this.currentSubject, this.currentChapter).open();
        });
        
        const refreshBtn = actions.createEl('button', {
            cls: 'action-btn refresh-btn',
            text: '🔄 새로고침'
        });
        refreshBtn.addEventListener('click', () => {
            this.renderDashboard(container);
            new Notice('✅ 새로고침 완료!');
        });
    }

    // 파트 3로 계속...
    // 파트 2에서 계속...

    async renderProblemsGrid(container) {
        const section = container.createDiv();
        section.createEl('h3', { 
            text: `📝 ${this.currentSubject} ${this.currentChapter}장`,
            attr: { style: `text-align: center; margin: ${this.isMobile ? '15px 0' : '20px 0'}; font-size: ${this.isMobile ? '1.3rem' : '1.5rem'}; font-weight: bold;` }
        });
        
        const problemsData = await this.loadProblemsData();
        const totalProblems = Object.keys(problemsData).length;
        const gradeStats = this.calculateGradeStats(problemsData);
        
        const statusDiv = section.createDiv();
        statusDiv.style.cssText = `text-align: center; margin: ${this.isMobile ? '15px' : '20px'} auto; padding: ${this.isMobile ? '12px' : '15px'}; background: var(--background-secondary); border-radius: ${this.isMobile ? '12px' : '10px'}; max-width: 100%;`;
        statusDiv.innerHTML = `
            <div style="font-size: ${this.isMobile ? '1.1rem' : '1.2rem'}; margin-bottom: 10px;">
                <strong>생성된 문제: ${totalProblems}개</strong>
            </div>
            <div style="font-size: ${this.isMobile ? '0.85rem' : '0.95rem'}; line-height: ${this.isMobile ? '2' : '1.8'};">
                👑 S급: <strong>${gradeStats.S}</strong> | 
                ⭐ A급: <strong>${gradeStats.A}</strong> | 
                🔥 B급: <strong>${gradeStats.B}</strong><br>
                📚 C급: <strong>${gradeStats.C}</strong> | 
                📖 D급: <strong>${gradeStats.D}</strong> | 
                ⛓️ E급: <strong>${gradeStats.E}</strong><br>
                🐷 F급: <strong>${gradeStats.F}</strong> | 
                ⬜ 빈칸: <strong>${this.displayCount - totalProblems}</strong>
            </div>
        `;
        
        const grid = section.createDiv('problems-grid');
        
        for (let i = 1; i <= this.displayCount; i++) {
            const cell = document.createElement('div');
            cell.className = 'problem-cell';
            const problemData = problemsData[i];
            
            if (problemData) {
                const reviewCount = problemData.reviewCount || 0;
                const understanding = problemData.understanding || 0;
                
                let grade = 'F';
                let bgColor = '#1a1a1a';
                let borderColor = '#333333';
                let textColor = '#ffffff';
                let emoji = '🐷';
                
                if (reviewCount > 0 && understanding > 0) {
                    if (reviewCount >= 10) {
                        grade = 'S'; bgColor = '#800080'; borderColor = '#9932cc'; emoji = '👑';
                    } else if (reviewCount >= 7) {
                        grade = 'A'; bgColor = '#FFD700'; borderColor = '#FFA500'; textColor = '#000000'; emoji = '⭐';
                    } else if (reviewCount >= 5) {
                        grade = 'B'; bgColor = '#B22222'; borderColor = '#dc143c'; emoji = '🔥';
                    } else if (reviewCount >= 3) {
                        grade = 'C'; bgColor = '#708090'; borderColor = '#8a9ba8'; emoji = '📚';
                    } else if (reviewCount >= 2) {
                        grade = 'D'; bgColor = '#654321'; borderColor = '#8b5a2b'; emoji = '📖';
                    } else if (reviewCount >= 1) {
                        grade = 'E'; bgColor = '#2F4F4F'; borderColor = '#3e5e5e'; emoji = '⛓️';
                    }
                }
                
                cell.style.background = bgColor;
                cell.style.borderColor = borderColor;
                cell.style.color = textColor;
                cell.classList.add(`grade-${grade}`);
                
                cell.innerHTML = `
                    <span style="font-size: ${this.isMobile ? '1.3rem' : '1.1rem'}; font-weight: bold; z-index: 1;">${i}</span>
                    <span class="grade-badge">${emoji}</span>
                `;
                
                cell.title = `${i}번 | ${grade}급 ${REVIEW_GRADES[grade].name}\n복습 ${reviewCount}회 | 이해도 ${understanding}%`;
                
                cell.addEventListener('click', async () => {
                    await this.plugin.openProblemFile(this.currentSubject, this.currentChapter, i);
                });
                
            } else {
                cell.classList.add('empty');
                cell.style.background = '#3a3a3a';
                cell.style.borderColor = '#555555';
                cell.style.color = '#888888';
                
                cell.innerHTML = `<span style="font-size: ${this.isMobile ? '1.3rem' : '1.1rem'};">${i}</span>`;
                cell.title = `${i}번 (미생성)\n탭하여 생성`;
                
                cell.addEventListener('click', () => {
                    new ProblemCreationModal(this.app, this.plugin, this.currentSubject, this.currentChapter, i).open();
                });
            }
            
            grid.appendChild(cell);
        }
    }

    async loadProblemsData() {
        const problemsData = {};
        try {
            const chapterFolder = normalizePath(`${this.plugin.settings.problemsFolder}/${this.currentSubject}/${this.currentChapter}장`);
            console.log(`📁 문제 로드 시도: ${chapterFolder}`);
            
            const folderExists = this.app.vault.getAbstractFileByPath(chapterFolder);
            if (!folderExists) {
                console.log(`⚠️ 폴더가 존재하지 않음: ${chapterFolder}`);
                return problemsData;
            }
            
            const files = this.app.vault.getMarkdownFiles().filter(file => file && file.path && file.path.startsWith(chapterFolder));
            console.log(`📄 찾은 파일 수: ${files.length}개`);
            
            for (const file of files) {
                try {
                    const content = await this.app.vault.read(file);
                    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
                    if (frontmatterMatch) {
                        const frontmatter = frontmatterMatch[1];
                        const numberMatch = frontmatter.match(/number:\s*(\d+)/);
                        if (numberMatch) {
                            const number = parseInt(numberMatch[1]);
                            const reviewCheckMatches = content.match(/- \[x\] .*?복습/gi);
                            const reviewCount = reviewCheckMatches ? reviewCheckMatches.length : 0;
                            const understandingsMatch = frontmatter.match(/understandings:\s*\[(.*?)\]/s);
                            let avgUnderstanding = 0;
                            if (understandingsMatch && understandingsMatch[1].trim()) {
                                const understandings = understandingsMatch[1].split(',').map(u => parseInt(u.trim())).filter(u => !isNaN(u));
                                if (understandings.length > 0) {
                                    avgUnderstanding = Math.round(understandings.reduce((a, b) => a + b, 0) / understandings.length);
                                }
                            }
                            problemsData[number] = { reviewCount, understanding: avgUnderstanding, file };
                            console.log(`  ✅ 문제 ${number}번 로드: 복습 ${reviewCount}회, 이해도 ${avgUnderstanding}%`);
                        }
                    }
                } catch (error) {
                    console.error(`파일 읽기 오류: ${file.path}`, error);
                }
            }
            console.log(`✅ 총 ${Object.keys(problemsData).length}개 문제 로드 완료`);
        } catch (error) {
            console.error('문제 데이터 로드 오류:', error);
        }
        return problemsData;
    }

    calculateGradeStats(problemsData) {
        const stats = { S: 0, A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 };
        for (const data of Object.values(problemsData)) {
            const rc = data.reviewCount || 0;
            const u = data.understanding || 0;
            let g = 'F';
            if (rc > 0 && u > 0) {
                if (rc >= 10) g = 'S';
                else if (rc >= 7) g = 'A';
                else if (rc >= 5) g = 'B';
                else if (rc >= 3) g = 'C';
                else if (rc >= 2) g = 'D';
                else if (rc >= 1) g = 'E';
            }
            stats[g]++;
        }
        return stats;
    }
    
    refresh() {
        const container = this.containerEl.children[1];
        this.renderDashboard(container);
    }
}

class ProblemCreationModal extends Modal {
    constructor(app, plugin, subject = null, chapter = 1, number = null) {
        super(app);
        this.plugin = plugin;
        this.subject = subject || plugin.settings.defaultSubject;
        this.chapter = chapter || 1;
        this.number = number;
        this.isMobile = isMobile();
    }
    
    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        contentEl.style.padding = this.isMobile ? '20px' : '15px';
        
        contentEl.createEl('h2', { 
            text: '➕ 새 문제 생성',
            attr: { style: `font-size: ${this.isMobile ? '1.5rem' : '1.3rem'}; margin-bottom: 20px;` }
        });
        
        const formStyle = `margin-bottom: ${this.isMobile ? '20px' : '15px'};`;
        const labelStyle = `display: block; margin-bottom: 8px; font-weight: 600; font-size: ${this.isMobile ? '1.1rem' : '1rem'};`;
        const inputStyle = `width: 100%; padding: ${this.isMobile ? '14px' : '10px'}; font-size: ${this.isMobile ? '1.1rem' : '1rem'}; border: 2px solid var(--background-modifier-border); border-radius: 8px; background: var(--background-primary); color: var(--text-normal);`;
        
        const subjectDiv = contentEl.createDiv();
        subjectDiv.style.cssText = formStyle;
        subjectDiv.createEl('label', { text: '과목:', attr: { style: labelStyle } });
        const subjectSelect = subjectDiv.createEl('select');
        subjectSelect.style.cssText = inputStyle;
        this.plugin.settings.subjects.forEach(subjectObj => {
            const subjectName = typeof subjectObj === 'string' ? subjectObj : subjectObj.name;
            const option = subjectSelect.createEl('option', { value: subjectName, text: subjectName });
            if (subjectName === this.subject) option.selected = true;
        });
        
        const chapterDiv = contentEl.createDiv();
        chapterDiv.style.cssText = formStyle;
        chapterDiv.createEl('label', { text: '장:', attr: { style: labelStyle } });
        const chapterSelect = chapterDiv.createEl('select');
        chapterSelect.style.cssText = inputStyle;
        const updateChapterOptions = () => {
            chapterSelect.empty();
            const subjectInfo = this.plugin.getSubjectInfo(subjectSelect.value);
            const totalChapters = subjectInfo ? subjectInfo.chapters : 10;
            for (let i = 1; i <= totalChapters; i++) {
                const option = chapterSelect.createEl('option', { value: i.toString(), text: `${i}장` });
                if (i === this.chapter) option.selected = true;
            }
        };
        updateChapterOptions();
        subjectSelect.addEventListener('change', updateChapterOptions);
        
        const numberDiv = contentEl.createDiv();
        numberDiv.style.cssText = formStyle;
        numberDiv.createEl('label', { text: '문제 번호:', attr: { style: labelStyle } });
        const numberInput = numberDiv.createEl('input', { 
            type: 'number',
            value: this.number?.toString() || '1',
            attr: { min: '1', style: inputStyle }
        });
        
        const titleDiv = contentEl.createDiv();
        titleDiv.style.cssText = formStyle;
        titleDiv.createEl('label', { text: '문제 제목:', attr: { style: labelStyle } });
        const titleInput = titleDiv.createEl('input', { 
            type: 'text', 
            placeholder: '문제 제목',
            attr: { style: inputStyle }
        });
        setTimeout(() => titleInput.focus(), 100);
        
        const buttonDiv = contentEl.createDiv();
        buttonDiv.style.cssText = `display: flex; gap: ${this.isMobile ? '12px' : '10px'}; margin-top: ${this.isMobile ? '25px' : '20px'};`;
        
        const createBtn = buttonDiv.createEl('button', { text: '✅ 생성', cls: 'mod-cta' });
        createBtn.style.cssText = `flex: 1; padding: ${this.isMobile ? '16px' : '12px'}; font-size: ${this.isMobile ? '1.1rem' : '1rem'}; border-radius: 8px; font-weight: bold;`;
        createBtn.addEventListener('click', async () => {
            await this.plugin.createProblem(
                subjectSelect.value,
                parseInt(chapterSelect.value),
                parseInt(numberInput.value),
                titleInput.value || `문제 ${numberInput.value}`,
                3
            );
            this.close();
            setTimeout(() => this.plugin.refreshDashboard(), 300);
        });
        
        const cancelBtn = buttonDiv.createEl('button', { text: '❌ 취소' });
        cancelBtn.style.cssText = `flex: 1; padding: ${this.isMobile ? '16px' : '12px'}; font-size: ${this.isMobile ? '1.1rem' : '1rem'}; border-radius: 8px; font-weight: bold;`;
        cancelBtn.addEventListener('click', () => this.close());
    }
}

class BulkCreationModal extends Modal {
    constructor(app, plugin, subject, chapter) {
        super(app);
        this.plugin = plugin;
        this.subject = subject;
        this.chapter = chapter;
        this.isMobile = isMobile();
    }
    
    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.style.padding = this.isMobile ? '20px' : '15px';
        
        contentEl.createEl('h2', { 
            text: '📝 문제 일괄 생성',
            attr: { style: `font-size: ${this.isMobile ? '1.5rem' : '1.3rem'}; margin-bottom: 20px;` }
        });
        
        const formStyle = `margin-bottom: ${this.isMobile ? '20px' : '15px'};`;
        const labelStyle = `display: block; margin-bottom: 8px; font-weight: 600; font-size: ${this.isMobile ? '1.1rem' : '1rem'};`;
        const inputStyle = `width: 100%; padding: ${this.isMobile ? '14px' : '10px'}; font-size: ${this.isMobile ? '1.1rem' : '1rem'}; border: 2px solid var(--background-modifier-border); border-radius: 8px; background: var(--background-primary); color: var(--text-normal);`;
        
        const subjectDiv = contentEl.createDiv();
        subjectDiv.style.cssText = formStyle;
        subjectDiv.createEl('label', { text: '과목:', attr: { style: labelStyle } });
        const subjectSelect = subjectDiv.createEl('select');
        subjectSelect.style.cssText = inputStyle;
        this.plugin.settings.subjects.forEach(subjectObj => {
            const subjectName = typeof subjectObj === 'string' ? subjectObj : subjectObj.name;
            const option = subjectSelect.createEl('option', { value: subjectName, text: subjectName });
            if (subjectName === this.subject) option.selected = true;
        });
        
        const chapterDiv = contentEl.createDiv();
        chapterDiv.style.cssText = formStyle;
        chapterDiv.createEl('label', { text: '장:', attr: { style: labelStyle } });
        const chapterSelect = chapterDiv.createEl('select');
        chapterSelect.style.cssText = inputStyle;
        const updateChapterOptions = () => {
            chapterSelect.empty();
            const subjectInfo = this.plugin.getSubjectInfo(subjectSelect.value);
            const totalChapters = subjectInfo ? subjectInfo.chapters : 10;
            for (let i = 1; i <= totalChapters; i++) {
                const option = chapterSelect.createEl('option', { value: i.toString(), text: `${i}장` });
                if (i === this.chapter) option.selected = true;
            }
        };
        updateChapterOptions();
        subjectSelect.addEventListener('change', updateChapterOptions);
        
        const startDiv = contentEl.createDiv();
        startDiv.style.cssText = formStyle;
        startDiv.createEl('label', { text: '시작 번호:', attr: { style: labelStyle } });
        const startInput = startDiv.createEl('input', { 
            type: 'number', 
            value: '1',
            attr: { style: inputStyle }
        });
        
        const endDiv = contentEl.createDiv();
        endDiv.style.cssText = formStyle;
        endDiv.createEl('label', { text: '끝 번호:', attr: { style: labelStyle } });
        const endInput = endDiv.createEl('input', { 
            type: 'number', 
            value: '50',
            attr: { style: inputStyle }
        });
        
        const buttonDiv = contentEl.createDiv();
        buttonDiv.style.cssText = `display: flex; gap: ${this.isMobile ? '12px' : '10px'}; margin-top: ${this.isMobile ? '25px' : '20px'};`;
        
        const createBtn = buttonDiv.createEl('button', { text: '✅ 일괄 생성', cls: 'mod-cta' });
        createBtn.style.cssText = `flex: 1; padding: ${this.isMobile ? '16px' : '12px'}; font-size: ${this.isMobile ? '1.1rem' : '1rem'}; border-radius: 8px; font-weight: bold;`;
        createBtn.addEventListener('click', async () => {
            const start = parseInt(startInput.value);
            const end = parseInt(endInput.value);
            if (start > end) {
                new Notice('❌ 시작 번호가 끝 번호보다 클 수 없습니다.');
                return;
            }
            await this.plugin.createBulkProblems(subjectSelect.value, parseInt(chapterSelect.value), start, end);
            this.close();
            setTimeout(() => this.plugin.refreshDashboard(), 1000);
        });
        
        const cancelBtn = buttonDiv.createEl('button', { text: '❌ 취소' });
        cancelBtn.style.cssText = `flex: 1; padding: ${this.isMobile ? '16px' : '12px'}; font-size: ${this.isMobile ? '1.1rem' : '1rem'}; border-radius: 8px; font-weight: bold;`;
        cancelBtn.addEventListener('click', () => this.close());
    }
}

class TimerStopModal extends Modal {
    constructor(app, plugin, timerDuration, existingUnderstandings = []) {
        super(app);
        this.plugin = plugin;
        this.timerDuration = timerDuration;
        this.existingUnderstandings = existingUnderstandings;
        this.isMobile = isMobile();
    }
    
    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.style.padding = this.isMobile ? '20px' : '15px';
        
        contentEl.createEl('h2', { 
            text: '⏱️ 이해도 입력',
            attr: { style: `font-size: ${this.isMobile ? '1.5rem' : '1.3rem'}; margin-bottom: 20px;` }
        });
        
        if (this.timerDuration > 0) {
            const timeDiv = contentEl.createDiv();
            timeDiv.style.cssText = `background: #e8f5e8; padding: ${this.isMobile ? '15px' : '10px'}; border-radius: 8px; margin-bottom: 20px; text-align: center; border: 2px solid #4caf50; font-size: ${this.isMobile ? '1.1rem' : '1rem'};`;
            timeDiv.textContent = `⏰ 소요 시간: ${this.formatTime(this.timerDuration)}`;
        }
        
        const desc = contentEl.createDiv();
        desc.textContent = '이해도를 0-100 사이의 숫자로 입력하세요:';
        desc.style.cssText = `margin-bottom: 15px; font-size: ${this.isMobile ? '1rem' : '0.9rem'};`;
        
        const input = contentEl.createEl('input');
        input.type = 'number';
        input.min = '0';
        input.max = '100';
        input.placeholder = '85';
        input.style.cssText = `width: 100%; padding: ${this.isMobile ? '16px' : '12px'}; font-size: ${this.isMobile ? '1.3rem' : '1.2rem'}; text-align: center; border: 2px solid #ddd; border-radius: 8px; margin-bottom: 20px;`;
        
        const quickDiv = contentEl.createDiv();
        quickDiv.style.cssText = `display: grid; grid-template-columns: repeat(2, 1fr); gap: ${this.isMobile ? '12px' : '10px'}; margin-bottom: 20px;`;
        
        const quickValues = [
            { value: 100, text: '완벽', color: '#4caf50' },
            { value: 85, text: '우수', color: '#2196f3' },
            { value: 70, text: '양호', color: '#ff9800' },
            { value: 50, text: '보통', color: '#f44336' }
        ];
        
        quickValues.forEach(item => {
            const btn = quickDiv.createEl('button');
            btn.textContent = `${item.text}\n${item.value}%`;
            btn.style.cssText = `padding: ${this.isMobile ? '16px' : '12px'}; background: ${item.color}; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: ${this.isMobile ? '1.1rem' : '0.95rem'}; font-weight: bold; white-space: pre-line;`;
            btn.addEventListener('click', () => {
                input.value = item.value;
                input.focus();
            });
        });
        
        const buttonDiv = contentEl.createDiv();
        buttonDiv.style.cssText = `display: flex; gap: ${this.isMobile ? '12px' : '10px'}; justify-content: center;`;
        
        const saveBtn = buttonDiv.createEl('button');
        saveBtn.textContent = '✅ 저장';
        saveBtn.style.cssText = `flex: 1; padding: ${this.isMobile ? '18px' : '14px'}; background: #4caf50; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: ${this.isMobile ? '1.2rem' : '1rem'}; font-weight: bold;`;
        
        const cancelBtn = buttonDiv.createEl('button');
        cancelBtn.textContent = '❌ 취소';
        cancelBtn.style.cssText = `flex: 1; padding: ${this.isMobile ? '18px' : '14px'}; background: #f44336; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: ${this.isMobile ? '1.2rem' : '1rem'}; font-weight: bold;`;
        
        saveBtn.addEventListener('click', async () => {
            const value = parseInt(input.value);
            if (isNaN(value) || value < 0 || value > 100) {
                new Notice('⚠️ 0-100 사이의 숫자를 입력해주세요!');
                return;
            }
            await this.saveTimerData(value);
            this.close();
        });
        
        cancelBtn.addEventListener('click', () => this.close());
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                saveBtn.click();
            }
        });
        
        input.focus();
    }
    
    formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        if (hours > 0) {
            return `${hours}시간 ${minutes}분 ${secs}초`;
        } else {
            return `${minutes}분 ${secs}초`;
        }
    }
    
    async saveTimerData(understanding) {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) return;
        
        if (this.plugin.understandingPlugin && this.plugin.understandingPlugin.addUnderstandingToFile) {
            await this.plugin.understandingPlugin.addUnderstandingToFile(activeFile, understanding);
        } else {
            await this.plugin.addUnderstandingToFile(activeFile, understanding);
        }
        
        new Notice(`✅ 이해도 ${understanding}% 기록 완료!`);
        setTimeout(() => this.plugin.refreshDashboard(), 500);
    }
}

class UnderstandingModalExtended extends Modal {
    constructor(app, plugin, timeString, existingUnderstandings = []) {
        super(app);
        this.plugin = plugin;
        this.timeString = timeString;
        this.existingUnderstandings = existingUnderstandings;
        this.isMobile = isMobile();
    }
    
    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.style.padding = this.isMobile ? '20px' : '15px';
        
        contentEl.createEl('h2', { 
            text: '🎯 이해도 입력',
            attr: { style: `font-size: ${this.isMobile ? '1.5rem' : '1.3rem'}; margin-bottom: 20px;` }
        });
        
        if (this.timeString) {
            const timeDiv = contentEl.createDiv();
            timeDiv.style.cssText = `background: #e8f5e8; padding: ${this.isMobile ? '15px' : '10px'}; border-radius: 8px; margin-bottom: 20px; text-align: center; border: 2px solid #4caf50; font-size: ${this.isMobile ? '1.1rem' : '1rem'};`;
            timeDiv.textContent = `⏰ 시간 기록됨: ${this.formatTimeKorean(this.timeString)}`;
        }
        
        const desc = contentEl.createDiv();
        desc.textContent = '이해도를 0-100 사이의 숫자로 입력하세요:';
        desc.style.cssText = `margin-bottom: 15px; font-size: ${this.isMobile ? '1rem' : '0.9rem'};`;
        
        const input = contentEl.createEl('input');
        input.type = 'number';
        input.min = '0';
        input.max = '100';
        input.placeholder = '85';
        input.style.cssText = `width: 100%; padding: ${this.isMobile ? '16px' : '12px'}; font-size: ${this.isMobile ? '1.3rem' : '1.2rem'}; text-align: center; border: 2px solid #ddd; border-radius: 8px; margin-bottom: 20px;`;
        
        const quickDiv = contentEl.createDiv();
        quickDiv.style.cssText = `display: grid; grid-template-columns: repeat(2, 1fr); gap: ${this.isMobile ? '12px' : '10px'}; margin-bottom: 20px;`;
        
        const quickValues = [
            { value: 100, text: '완벽', color: '#4caf50' },
            { value: 85, text: '우수', color: '#2196f3' },
            { value: 70, text: '양호', color: '#ff9800' },
            { value: 50, text: '보통', color: '#f44336' }
        ];
        
        quickValues.forEach(item => {
            const btn = quickDiv.createEl('button');
            btn.textContent = `${item.text}\n${item.value}%`;
            btn.style.cssText = `padding: ${this.isMobile ? '16px' : '12px'}; background: ${item.color}; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: ${this.isMobile ? '1.1rem' : '0.95rem'}; font-weight: bold; white-space: pre-line;`;
            btn.addEventListener('click', () => {
                input.value = item.value;
                input.focus();
            });
        });
        
        const buttonDiv = contentEl.createDiv();
        buttonDiv.style.cssText = `display: flex; gap: ${this.isMobile ? '12px' : '10px'}; justify-content: center;`;
        
        const saveBtn = buttonDiv.createEl('button');
        saveBtn.textContent = '✅ 저장';
        saveBtn.style.cssText = `flex: 1; padding: ${this.isMobile ? '18px' : '14px'}; background: #4caf50; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: ${this.isMobile ? '1.2rem' : '1rem'}; font-weight: bold;`;
        
        const cancelBtn = buttonDiv.createEl('button');
        cancelBtn.textContent = '❌ 취소';
        cancelBtn.style.cssText = `flex: 1; padding: ${this.isMobile ? '18px' : '14px'}; background: #f44336; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: ${this.isMobile ? '1.2rem' : '1rem'}; font-weight: bold;`;
        
        saveBtn.addEventListener('click', async () => {
            const value = parseInt(input.value);
            if (isNaN(value) || value < 0 || value > 100) {
                new Notice('⚠️ 0-100 사이의 숫자를 입력해주세요!');
                return;
            }
            
            const activeFile = this.app.workspace.getActiveFile();
            if (!activeFile) {
                new Notice('❌ 활성 파일이 없습니다.');
                return;
            }
            
            if (this.plugin.understandingPlugin && this.plugin.understandingPlugin.addUnderstandingToFile) {
                await this.plugin.understandingPlugin.addUnderstandingToFile(activeFile, value);
            } else {
                await this.plugin.addUnderstandingToFile(activeFile, value);
            }
            
            if (this.timeString) {
                new Notice(`✅ 기록 완료!\n시간: ${this.formatTimeKorean(this.timeString)}\n이해도: ${value}%`);
            } else {
                new Notice(`✅ 이해도 기록 완료: ${value}%`);
            }
            
            setTimeout(() => this.plugin.refreshDashboard(), 500);
            this.close();
        });
        
        cancelBtn.addEventListener('click', () => this.close());
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                saveBtn.click();
            }
        });
        
        input.focus();
    }
    
    formatTimeKorean(timeString) {
        const [hours, minutes, seconds] = timeString.split(':');
        return `${hours}시 ${minutes}분 ${seconds}초`;
    }
}

class MobileSettingsModal extends Modal {
    constructor(app, plugin) {
        super(app);
        this.plugin = plugin;
        this.isMobile = isMobile();
    }
    
    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.style.padding = this.isMobile ? '20px' : '15px';
        
        contentEl.createEl('h2', { 
            text: '⚙️ 설정',
            attr: { style: `font-size: ${this.isMobile ? '1.5rem' : '1.3rem'}; margin-bottom: 20px;` }
        });
        
        const integrationSection = contentEl.createDiv();
        integrationSection.style.cssText = `margin-bottom: 20px; padding: ${this.isMobile ? '15px' : '12px'}; background: var(--background-secondary); border-radius: 10px;`;
        integrationSection.createEl('h3', { 
            text: '🔗 플러그인 연동',
            attr: { style: `font-size: ${this.isMobile ? '1.2rem' : '1.1rem'}; margin-bottom: 10px;` }
        });
        
        const statusDiv = integrationSection.createDiv();
        if (this.plugin.understandingPlugin) {
            statusDiv.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px; padding: ${this.isMobile ? '12px' : '10px'}; background: #e8f5e8; border-radius: 5px;">
                    <span style="font-size: 1.5rem;">✅</span>
                    <div style="font-size: ${this.isMobile ? '0.95rem' : '0.85rem'};">
                        <div style="font-weight: bold; color: #4caf50;">Understanding Input 플러그인 연동됨</div>
                        <div style="color: #666;">향상된 이해도 입력 기능 사용 가능</div>
                    </div>
                </div>
            `;
        } else {
            statusDiv.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px; padding: ${this.isMobile ? '12px' : '10px'}; background: #fff3cd; border-radius: 5px;">
                    <span style="font-size: 1.5rem;">ℹ️</span>
                    <div style="font-size: ${this.isMobile ? '0.95rem' : '0.85rem'};">
                        <div style="font-weight: bold; color: #856404;">Understanding Input 플러그인 미설치</div>
                        <div style="color: #666;">내장 이해도 입력 기능 사용 중</div>
                    </div>
                </div>
            `;
        }
        
        const subjectSection = contentEl.createDiv();
        subjectSection.createEl('h3', { 
            text: '📚 과목 관리',
            attr: { style: `font-size: ${this.isMobile ? '1.2rem' : '1.1rem'}; margin: 20px 0 10px;` }
        });
        const subjectList = subjectSection.createDiv();
        this.renderSubjectList(subjectList);
        
        const closeBtn = contentEl.createEl('button', { text: '✅ 닫기', cls: 'mod-cta' });
        closeBtn.style.cssText = `width: 100%; margin-top: 20px; padding: ${this.isMobile ? '16px' : '12px'}; font-size: ${this.isMobile ? '1.1rem' : '1rem'}; border-radius: 8px; font-weight: bold;`;
        closeBtn.addEventListener('click', () => this.close());
    }
    
    renderSubjectList(container) {
        container.empty();
        this.plugin.settings.subjects.forEach(subjectObj => {
            const name = typeof subjectObj === 'string' ? subjectObj : subjectObj.name;
            const chapters = typeof subjectObj === 'object' ? subjectObj.chapters : 10;
            const item = container.createDiv();
            item.style.cssText = `display: flex; justify-content: space-between; padding: ${this.isMobile ? '12px' : '10px'}; margin: 5px 0; background: var(--background-secondary); border-radius: 5px; font-size: ${this.isMobile ? '1rem' : '0.9rem'};`;
            item.createEl('span', { text: `📚 ${name} (${chapters}장)` });
        });
        
        const addDiv = container.createDiv();
        addDiv.style.cssText = `display: flex; gap: ${this.isMobile ? '10px' : '8px'}; margin-top: ${this.isMobile ? '15px' : '10px'};`;
        
        const nameInput = addDiv.createEl('input', { 
            type: 'text', 
            placeholder: '과목명',
            attr: { style: `flex: 2; padding: ${this.isMobile ? '12px' : '10px'}; font-size: ${this.isMobile ? '1rem' : '0.9rem'}; border-radius: 5px;` }
        });
        
        const chaptersInput = addDiv.createEl('input', { 
            type: 'number', 
            placeholder: '장수', 
            value: '10',
            attr: { style: `flex: 1; padding: ${this.isMobile ? '12px' : '10px'}; font-size: ${this.isMobile ? '1rem' : '0.9rem'}; border-radius: 5px;` }
        });
        
        const addBtn = addDiv.createEl('button', { text: '➕' });
        addBtn.style.cssText = `padding: ${this.isMobile ? '12px 20px' : '10px 15px'}; font-size: ${this.isMobile ? '1.2rem' : '1rem'}; border-radius: 5px; font-weight: bold;`;
        addBtn.addEventListener('click', async () => {
            const newSubject = nameInput.value.trim();
            const chapters = parseInt(chaptersInput.value) || 10;
            if (!newSubject) {
                new Notice('❌ 과목명을 입력해주세요.');
                return;
            }
            this.plugin.settings.subjects.push({ name: newSubject, chapters });
            await this.plugin.saveSettings();
            new Notice(`✅ '${newSubject}' (${chapters}장) 추가됨`);
            nameInput.value = '';
            this.renderSubjectList(container);
        });
    }
}

class StudyDashboardSettingTab extends PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.createEl('h2', { text: '📚 Study Dashboard 설정' });
        
        new Setting(containerEl)
            .setName('문제 폴더')
            .setDesc('문제 파일이 저장될 폴더 경로')
            .addText(text => text
                .setValue(this.plugin.settings.problemsFolder)
                .onChange(async (value) => {
                    this.plugin.settings.problemsFolder = value;
                    await this.plugin.saveSettings();
                }));
        
        new Setting(containerEl)
            .setName('장당 최대 문제 수')
            .setDesc('각 장에 표시할 최대 문제 개수')
            .addDropdown(dropdown => dropdown
                .addOption('50', '50문제')
                .addOption('100', '100문제')
                .addOption('200', '200문제')
                .setValue(this.plugin.settings.maxProblemsPerChapter.toString())
                .onChange(async (value) => {
                    this.plugin.settings.maxProblemsPerChapter = parseInt(value);
                    await this.plugin.saveSettings();
                }));
        
        containerEl.createEl('h3', { text: '📁 과목 관리' });
        const subjectsContainer = containerEl.createDiv();
        this.renderSubjectsList(subjectsContainer);
        
        const addSubjectDiv = containerEl.createDiv();
        addSubjectDiv.style.cssText = 'display: flex; gap: 10px; margin: 20px 0;';
        const nameInput = addSubjectDiv.createEl('input', { 
            type: 'text', 
            placeholder: '과목명',
            attr: { style: 'flex: 2; padding: 8px;' }
        });
        const chaptersInput = addSubjectDiv.createEl('input', { 
            type: 'number', 
            value: '10',
            attr: { style: 'flex: 1; padding: 8px;' }
        });
        const addBtn = addSubjectDiv.createEl('button', { 
            text: '➕ 과목 추가', 
            cls: 'mod-cta' 
        });
        addBtn.addEventListener('click', async () => {
            const newSubject = nameInput.value.trim();
            const chapters = parseInt(chaptersInput.value) || 10;
            if (!newSubject) {
                new Notice('❌ 과목명을 입력해주세요.');
                return;
            }
            this.plugin.settings.subjects.push({ name: newSubject, chapters });
            await this.plugin.saveSettings();
            new Notice(`✅ '${newSubject}' (${chapters}장) 추가됨`);
            nameInput.value = '';
            this.renderSubjectsList(subjectsContainer);
        });
    }

    renderSubjectsList(container) {
        container.empty();
        this.plugin.settings.subjects.forEach(subjectObj => {
            const name = typeof subjectObj === 'string' ? subjectObj : subjectObj.name;
            const chapters = typeof subjectObj === 'object' ? subjectObj.chapters : 10;
            const itemDiv = container.createDiv();
            itemDiv.style.cssText = 'display: flex; justify-content: space-between; padding: 10px; margin: 5px 0; background: var(--background-secondary); border-radius: 5px;';
            itemDiv.createEl('span', { text: `📚 ${name} (${chapters}장)` });
            const deleteBtn = itemDiv.createEl('button', { text: '🗑️' });
            deleteBtn.addEventListener('click', async () => {
                if (confirm(`'${name}' 과목을 삭제하시겠습니까?`)) {
                    this.plugin.settings.subjects = this.plugin.settings.subjects.filter(s => {
                        const n = typeof s === 'string' ? s : s.name;
                        return n !== name;
                    });
                    await this.plugin.saveSettings();
                    this.renderSubjectsList(container);
                }
            });
        });
    }
}

module.exports = StudyDashboardPlugin;
