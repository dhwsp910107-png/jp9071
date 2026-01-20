const { Plugin, PluginSettingTab, Setting, ItemView, Notice, Modal, normalizePath, TFile } = require('obsidian');

const DEFAULT_SETTINGS = {
    problemsFolder: '학습관리/문제은행',
    templatesFolder: '학습관리/템플릿',
    dailyGoal: 5,
    targetDate: '2025-12-31',
    autoBackup: true,
    timerEnabled: true,
    subjects: ['수학', '물리', '화학', '생물', '영어', '국어', '한국사']
};

const VIEW_TYPE_STUDY_DASHBOARD = 'study-dashboard-view';

class StudyDashboardPlugin extends Plugin {
    async onload() {
        console.log('Study Dashboard Plugin v3.0 loaded');
        
        await this.loadSettings();
        
        this.registerView(VIEW_TYPE_STUDY_DASHBOARD, (leaf) => new StudyDashboardView(leaf, this));
        this.addStyles();
        this.addRibbonIcon('graduation-cap', '통합 Study Dashboard', () => this.activateView());
        this.addCommand({
            id: 'open-study-dashboard',
            name: '통합 Study Dashboard 열기',
            callback: () => this.activateView()
        });
        this.addSettingTab(new StudyDashboardSettingTab(this.app, this));
        
        this.timerState = {
            isRunning: false,
            currentProblem: null,
            startTime: null,
            timeLeft: 300
        };
    }
    
    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }
    
    async saveSettings() {
        await this.saveData(this.settings);
    }
    
    async activateView() {
        this.app.workspace.detachLeavesOfType(VIEW_TYPE_STUDY_DASHBOARD);
        await this.app.workspace.getRightLeaf(false).setViewState({
            type: VIEW_TYPE_STUDY_DASHBOARD,
            active: true
        });
        this.app.workspace.revealLeaf(this.app.workspace.getLeavesOfType(VIEW_TYPE_STUDY_DASHBOARD)[0]);
    }
    
    addStyles() {
        const css = `
            .study-dashboard-container {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
                background: var(--background-primary);
                color: var(--text-normal);
                padding: 20px;
                overflow-y: auto;
                height: 100%;
                max-width: 1400px;
                margin: 0 auto;
            }

            .dashboard-header {
                text-align: center;
                margin-bottom: 40px;
                padding: 40px 0;
                background: linear-gradient(135deg, #3b82f6, #1e40af);
                color: white;
                border-radius: 20px;
                box-shadow: 0 20px 60px rgba(0,0,0,0.15);
                position: relative;
                overflow: hidden;
            }

            .dashboard-header::before {
                content: '';
                position: absolute;
                top: -50%;
                left: -50%;
                width: 200%;
                height: 200%;
                background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
                animation: pulse 4s ease-in-out infinite;
            }

            .header-content {
                position: relative;
                z-index: 2;
            }

            .main-title {
                font-size: 3.5rem;
                font-weight: 800;
                margin-bottom: 15px;
                text-shadow: 0 4px 8px rgba(0,0,0,0.3);
            }

            .subtitle {
                font-size: 1.3rem;
                opacity: 0.9;
                font-weight: 400;
            }

            .version-badge {
                position: absolute;
                top: 20px;
                right: 30px;
                background: rgba(255,255,255,0.2);
                padding: 8px 16px;
                border-radius: 20px;
                font-size: 0.9rem;
                font-weight: 600;
                backdrop-filter: blur(10px);
            }

            .subject-tabs {
                display: flex;
                gap: 15px;
                margin-bottom: 40px;
                justify-content: center;
                flex-wrap: wrap;
                padding: 20px;
                background: var(--background-secondary);
                border-radius: 15px;
                box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            }

            .subject-tab {
                padding: 15px 25px;
                background: var(--background-primary);
                border: 2px solid var(--background-modifier-border);
                border-radius: 25px;
                cursor: pointer;
                transition: all 0.3s ease;
                font-weight: 600;
                position: relative;
                min-width: 120px;
                text-align: center;
            }

            .subject-tab:hover {
                transform: translateY(-3px);
                box-shadow: 0 8px 25px rgba(59, 130, 246, 0.2);
            }

            .subject-tab.active {
                background: #3b82f6;
                color: white;
                border-color: #3b82f6;
                transform: translateY(-3px);
                box-shadow: 0 8px 25px rgba(59, 130, 246, 0.3);
            }

            .progress-badge {
                position: absolute;
                top: -8px;
                right: -8px;
                background: #10b981;
                color: white;
                border-radius: 50%;
                width: 28px;
                height: 28px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 0.75rem;
                font-weight: bold;
            }

            .stats-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 25px;
                margin-bottom: 40px;
            }

            .stat-card {
                background: var(--background-primary);
                padding: 30px;
                border-radius: 20px;
                text-align: center;
                box-shadow: 0 4px 15px rgba(0,0,0,0.1);
                transition: transform 0.3s ease;
                border: 1px solid var(--background-modifier-border);
                position: relative;
                overflow: hidden;
            }

            .stat-card::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                height: 4px;
                background: #3b82f6;
            }

            .stat-card:hover {
                transform: translateY(-8px);
                box-shadow: 0 12px 35px rgba(0,0,0,0.15);
            }

            .stat-card.mastered::before { background: #10b981; }
            .stat-card.reviewing::before { background: #f59e0b; }
            .stat-card.learning::before { background: #ef4444; }

            .stat-number {
                font-size: 3rem;
                font-weight: 800;
                margin-bottom: 15px;
                color: var(--text-normal);
            }

            .stat-number.mastered { color: #10b981; }
            .stat-number.reviewing { color: #f59e0b; }
            .stat-number.learning { color: #ef4444; }

            .stat-label {
                color: var(--text-muted);
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 1px;
                font-size: 0.9rem;
            }

            .progress-section {
                background: var(--background-primary);
                padding: 40px;
                border-radius: 20px;
                margin-bottom: 40px;
                box-shadow: 0 4px 15px rgba(0,0,0,0.1);
                border: 1px solid var(--background-modifier-border);
            }

            .progress-header {
                text-align: center;
                margin-bottom: 30px;
            }

            .progress-title {
                font-size: 1.8rem;
                font-weight: 700;
                color: var(--text-normal);
                margin-bottom: 10px;
            }

            .d-day {
                color: #ef4444;
                font-weight: 600;
                font-size: 1.1rem;
            }

            .progress-bar-container {
                background: var(--background-secondary);
                height: 40px;
                border-radius: 25px;
                overflow: hidden;
                position: relative;
                margin-bottom: 25px;
                box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);
            }

            .progress-fill {
                background: linear-gradient(90deg, #10b981, #059669);
                height: 100%;
                border-radius: 25px;
                position: relative;
                transition: width 1.5s ease-out;
            }

            .progress-fill::after {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
                animation: shimmer 2s infinite;
            }

            .progress-text {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                color: white;
                font-weight: 800;
                font-size: 1.1rem;
                text-shadow: 0 2px 4px rgba(0,0,0,0.3);
            }

            .progress-stats {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                gap: 20px;
            }

            .progress-stat {
                text-align: center;
                padding: 20px;
                background: var(--background-secondary);
                border-radius: 15px;
                border: 1px solid var(--background-modifier-border);
            }

            .progress-stat-number {
                font-size: 2rem;
                font-weight: 700;
                color: #3b82f6;
                margin-bottom: 5px;
            }

            .progress-stat-label {
                color: var(--text-muted);
                font-size: 0.9rem;
                font-weight: 500;
            }

            .timer-toggle {
                background: linear-gradient(135deg, #667eea, #764ba2);
                color: white;
                padding: 20px;
                border-radius: 15px;
                margin-bottom: 30px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            }

            .timer-info {
                display: flex;
                align-items: center;
                gap: 15px;
            }

            .timer-icon {
                font-size: 2rem;
                background: rgba(255,255,255,0.2);
                width: 60px;
                height: 60px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .timer-text h3 {
                font-size: 1.3rem;
                margin-bottom: 5px;
            }

            .timer-text p {
                opacity: 0.9;
                font-size: 0.95rem;
            }

            .timer-switch {
                position: relative;
                width: 60px;
                height: 30px;
                background: rgba(255,255,255,0.3);
                border-radius: 15px;
                cursor: pointer;
                transition: all 0.3s ease;
            }

            .timer-switch.active {
                background: #10b981;
            }

            .timer-switch::after {
                content: '';
                position: absolute;
                top: 3px;
                left: 3px;
                width: 24px;
                height: 24px;
                background: white;
                border-radius: 50%;
                transition: all 0.3s ease;
            }

            .timer-switch.active::after {
                transform: translateX(30px);
            }

            .action-section {
                display: grid;
                grid-template-columns: 1fr auto auto;
                gap: 20px;
                margin-bottom: 40px;
                align-items: center;
                background: var(--background-primary);
                padding: 25px;
                border-radius: 20px;
                box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            }

            .view-controls {
                display: flex;
                gap: 15px;
                align-items: center;
                flex-wrap: wrap;
            }

            .view-controls label {
                font-weight: 600;
                color: var(--text-normal);
            }

            .view-controls select {
                padding: 10px 15px;
                border: 2px solid var(--background-modifier-border);
                border-radius: 10px;
                background: var(--background-primary);
                font-weight: 500;
                cursor: pointer;
                transition: border-color 0.3s ease;
                color: var(--text-normal);
            }

            .view-controls select:focus {
                border-color: #3b82f6;
                outline: none;
            }

            .action-buttons {
                display: flex;
                gap: 15px;
            }

            .btn {
                padding: 12px 25px;
                border: none;
                border-radius: 12px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
                font-size: 0.95rem;
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 8px 25px rgba(0,0,0,0.15);
            }

            .btn-primary {
                background: #3b82f6;
                color: white;
            }

            .btn-success {
                background: #10b981;
                color: white;
            }

            .btn-secondary {
                background: #6b7280;
                color: white;
            }

            .problems-section {
                background: var(--background-primary);
                padding: 40px;
                border-radius: 20px;
                margin-bottom: 40px;
                box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            }

            .problems-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 30px;
            }

            .problems-title {
                font-size: 1.8rem;
                font-weight: 700;
                color: var(--text-normal);
            }

            .problems-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(50px, 1fr));
                gap: 10px;
                max-height: 400px;
                overflow-y: auto;
                padding: 10px;
                border: 1px solid var(--background-modifier-border);
                border-radius: 15px;
                background: var(--background-secondary);
            }

            .problem-cell {
                width: 50px;
                height: 50px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 10px;
                font-weight: 700;
                font-size: 0.9rem;
                cursor: pointer;
                transition: all 0.3s ease;
                position: relative;
                border: 2px solid transparent;
            }

            .problem-cell:hover {
                transform: scale(1.1);
                z-index: 10;
                box-shadow: 0 5px 15px rgba(0,0,0,0.2);
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

            .recent-problems {
                background: var(--background-primary);
                padding: 40px;
                border-radius: 20px;
                box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            }

            .recent-problems h3 {
                font-size: 1.8rem;
                font-weight: 700;
                color: var(--text-normal);
                margin-bottom: 25px;
            }

            .problem-item {
                display: flex;
                align-items: center;
                gap: 20px;
                padding: 20px;
                margin-bottom: 15px;
                background: var(--background-secondary);
                border-radius: 15px;
                cursor: pointer;
                transition: all 0.3s ease;
                border: 1px solid var(--background-modifier-border);
            }

            .problem-item:hover {
                transform: translateX(10px);
                box-shadow: 0 5px 20px rgba(0,0,0,0.1);
                background: var(--background-primary);
            }

            .problem-status-indicator {
                width: 20px;
                height: 20px;
                border-radius: 50%;
                flex-shrink: 0;
            }

            .problem-status-indicator.mastered { background: #10b981; }
            .problem-status-indicator.reviewing { background: #f59e0b; }
            .problem-status-indicator.learning { background: #ef4444; }

            .problem-info {
                flex: 1;
            }

            .problem-title {
                font-weight: 600;
                margin-bottom: 8px;
                color: var(--text-normal);
            }

            .problem-meta {
                display: flex;
                gap: 20px;
                align-items: center;
                font-size: 0.9rem;
                color: var(--text-muted);
            }

            .difficulty-stars {
                color: #f59e0b;
            }

            .review-count-badge {
                background: #e0f2fe;
                color: #0369a1;
                padding: 4px 12px;
                border-radius: 15px;
                font-size: 0.8rem;
                font-weight: 600;
            }

            @keyframes pulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.02); }
            }

            @keyframes shimmer {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(100%); }
            }

            .problem-timer-modal {
                background: var(--background-primary);
                border-radius: 20px;
                padding: 30px;
                max-width: 800px;
                width: 90%;
            }

            .timer-modal-header {
                background: linear-gradient(135deg, #3b82f6, #1e40af);
                color: white;
                padding: 25px;
                border-radius: 15px;
                margin: -30px -30px 25px -30px;
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
                margin-bottom: 20px;
                border-left: 5px solid #3b82f6;
            }

            .timer-controls {
                display: flex;
                gap: 15px;
                justify-content: center;
                flex-wrap: wrap;
            }

            .timer-btn {
                padding: 12px 24px;
                border: none;
                border-radius: 10px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .timer-btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 8px 25px rgba(0,0,0,0.15);
            }

            .timer-btn.start { background: #10b981; color: white; }
            .timer-btn.pause { background: #f59e0b; color: white; }
            .timer-btn.reset { background: #ef4444; color: white; }
            .timer-btn.hint { background: #3b82f6; color: white; }
            .timer-btn.answer { background: #8b5cf6; color: white; }
            .timer-btn.close { background: #6b7280; color: white; }

            @media (max-width: 768px) {
                .main-title { font-size: 2.5rem; }
                .subtitle { font-size: 1.1rem; }
                .action-section { grid-template-columns: 1fr; }
                .view-controls { justify-content: center; }
                .problems-grid { grid-template-columns: repeat(auto-fill, minmax(45px, 1fr)); }
                .problem-cell { width: 45px; height: 45px; }
            }
        `;
        
        const style = document.createElement('style');
        style.textContent = css;
        document.head.appendChild(style);
    }
    
    async getAllProblems() {
        try {
            const problemsPath = normalizePath(this.settings.problemsFolder);
            const folder = this.app.vault.getAbstractFileByPath(problemsPath);
            
            if (!folder) {
                console.log('문제 폴더가 없습니다. 빈 배열을 반환합니다.');
                return [];
            }
            
            const problems = [];
            const foldersToCheck = [];
            
            if (folder.children) {
                foldersToCheck.push(folder);
                for (const child of folder.children) {
                    if (child && typeof child === 'object' && child.children) {
                        foldersToCheck.push(child);
                    }
                }
            }
            
            for (const folderToCheck of foldersToCheck) {
                if (!folderToCheck || !folderToCheck.children) continue;
                
                for (const file of folderToCheck.children) {
                    try {
                        if (file && 
                            typeof file === 'object' && 
                            file.extension === 'md' && 
                            file.path && 
                            file.basename) {
                            
                            const metadata = this.app.metadataCache.getFileCache(file);
                            const frontmatter = metadata?.frontmatter;
                            
                            if (frontmatter && typeof frontmatter.number === 'number') {
                                problems.push({
                                    number: frontmatter.number,
                                    title: frontmatter.title || file.basename,
                                    subject: frontmatter.subject || '기타',
                                    status: frontmatter.status || 'learning',
                                    difficulty: frontmatter.difficulty || 3,
                                    reviewCount: frontmatter.reviewCount || 0,
                                    lastReview: frontmatter.lastReview,
                                    tags: Array.isArray(frontmatter.tags) ? frontmatter.tags : [],
                                    file
                                });
                            }
                        }
                    } catch (fileError) {
                        console.log('파일 처리 중 오류 무시:', fileError.message);
                        continue;
                    }
                }
            }
            
            return problems.sort((a, b) => a.number - b.number);
        } catch (error) {
            console.error('문제 로드 중 전체 오류:', error);
            return [];
        }
    }
    
    async createProblemFile(number, title, subject, difficulty) {
        try {
            const subjectFolder = normalizePath(`${this.settings.problemsFolder}/${subject}`);
            
            try {
                await this.app.vault.createFolder(subjectFolder);
            } catch (folderError) {
                // 폴더가 이미 존재할 수 있음
            }
            
            const fileName = `${String(number).padStart(3, '0')}_${title.replace(/[^\w가-힣]/g, '_')}.md`;
            const filePath = normalizePath(`${subjectFolder}/${fileName}`);
            
            const existingFile = this.app.vault.getAbstractFileByPath(filePath);
            if (existingFile) {
                new Notice(`문제 ${number}번이 이미 존재합니다.`);
                return;
            }
            
            const today = new Date().toISOString().split('T')[0];
            const nextDay = new Date(Date.now() + 86400000).toISOString().split('T')[0];
            
            let templateContent = `---
number: ${number}
title: "${title}"
subject: ${subject}
chapter: ""
source: ""
page: ""
concept-tags: []
status: learning
difficulty: ${difficulty}
reviewCount: 0
lastReview: ${today}
nextReview: ${nextDay}
created: ${today}
avgTime: 0
totalTime: 0
tags: [anki-card, ${subject}]
type: image-flashcard
---

# ${number}. ${title}

> 📚 **출처**: 교재  
> 📖 **단원**: ${subject}  
> ⭐ **난이도**: ${difficulty}/5

---

## 📸 문제

<!-- 🎯 Ctrl+V로 문제 이미지 붙여넣기 -->



---

## 💡 힌트

> [!hint]- 💡 힌트 보기
> 여기에 힌트를 입력하세요

---

## ✅ 정답 및 풀이

> [!success]- 🔍 **답안 보기 (클릭 시 타이머 종료)**
> 
> <!-- 🎯 Ctrl+V로 답안 이미지 붙여넣기 -->
> 
> 
> ---
> 
> ## 📚 사용된 개념
> 
> ### 핵심 개념
> - [[핵심개념1]]
> - [[핵심개념2]]
> - [[핵심개념3]]
> 
> ### 관련 공식
> \`\`\`
> 관련 공식
> \`\`\`

---

## 💭 학습 노트

### ⚠️ 주의할 점
- 

### 🔑 핵심 포인트
- 

---

*📊 Study Dashboard - 자동 타이머 & 진행률 추적*
`;
            
            await this.app.vault.create(filePath, templateContent);
            new Notice(`'${title}' 문제가 ${subject} 폴더에 생성되었습니다.`);
            
            setTimeout(() => {
                this.refreshDashboard();
            }, 300);
            
        } catch (error) {
            console.error('문제 파일 생성 오류:', error);
            new Notice(`문제 생성 중 오류가 발생했습니다.`);
        }
    }
    
    async createBulkProblems(subject, start, end) {
        let created = 0;
        for (let i = start; i <= end; i++) {
            try {
                await this.createProblemFile(i, `문제 ${i}`, subject, 3);
                created++;
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (e) {
                console.log(`문제 ${i} 생성 실패:`, e.message);
            }
        }
        new Notice(`${created}개 문제 생성 완료!`);
        this.refreshDashboard();
    }
    
    refreshDashboard() {
        const dashboardView = this.app.workspace.getLeavesOfType(VIEW_TYPE_STUDY_DASHBOARD)[0];
        if (dashboardView?.view?.refresh) {
            dashboardView.view.refresh();
        }
    }
}

class StudyDashboardView extends ItemView {
    constructor(leaf, plugin) {
        super(leaf);
        this.plugin = plugin;
        this.currentSubject = this.plugin.settings.subjects[0];
        this.maxProblems = 500;
        this.viewMode = 'all';
    }
    
    getViewType() { return VIEW_TYPE_STUDY_DASHBOARD; }
    getDisplayText() { return '통합 Study Dashboard'; }
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
        this.renderSubjectTabs(container);
        
        const allProblems = await this.plugin.getAllProblems();
        const currentProblems = allProblems.filter(p => p.subject === this.currentSubject);
        const stats = this.calculateStats(currentProblems);
        
        this.renderStats(container, stats);
        this.renderProgressSection(container, stats);
        this.renderTimerToggle(container);
        this.renderActionSection(container);
        this.renderProblemsGrid(container, currentProblems);
        this.renderRecentProblems(container, currentProblems);
    }
    
    renderHeader(container) {
        const header = container.createDiv('dashboard-header');
        
        const versionBadge = header.createDiv('version-badge');
        versionBadge.textContent = 'v3.0 통합';
        
        const headerContent = header.createDiv('header-content');
        const title = headerContent.createEl('h1', { cls: 'main-title' });
        title.textContent = '📚 Study Dashboard';
        
        const subtitle = headerContent.createEl('p', { cls: 'subtitle' });
        subtitle.textContent = 'Anki 타이머 + 문제 관리 통합 시스템';
    }
    
    renderSubjectTabs(container) {
        const tabsContainer = container.createDiv('subject-tabs');
        
        this.plugin.settings.subjects.forEach((subject, index) => {
            const tab = tabsContainer.createDiv('subject-tab');
            if (subject === this.currentSubject) {
                tab.addClass('active');
            }
            
            tab.textContent = subject;
            
            const progressBadge = tab.createDiv('progress-badge');
            progressBadge.textContent = '0%';
            
            tab.addEventListener('click', async () => {
                tabsContainer.querySelectorAll('.subject-tab').forEach(t => t.removeClass('active'));
                tab.addClass('active');
                
                this.currentSubject = subject;
                await this.renderDashboard(container);
                new Notice(`${subject} 과목이 선택되었습니다.`);
            });
        });
    }
    
    calculateStats(problems) {
        const total = Math.max(this.maxProblems, problems.length);
        const mastered = problems.filter(p => p.status === 'mastered').length;
        const reviewing = problems.filter(p => p.status === 'reviewing').length;
        const learning = problems.filter(p => p.status === 'learning').length;
        const progress = total > 0 ? Math.round((mastered / total) * 100) : 0;
        
        const targetDate = new Date(this.plugin.settings.targetDate);
        const today = new Date();
        const daysLeft = Math.max(1, Math.ceil((targetDate - today) / (1000 * 60 * 60 * 24)));
        const dailyTarget = Math.ceil((total - mastered) / daysLeft);
        
        return { total, mastered, reviewing, learning, progress, daysLeft, dailyTarget };
    }
    
    renderStats(container, stats) {
        const statsGrid = container.createDiv('stats-grid');
        
        const statData = [
            { number: stats.mastered, label: '완전 숙달', type: 'mastered' },
            { number: stats.reviewing, label: '복습 중', type: 'reviewing' },
            { number: stats.learning, label: '학습 중', type: 'learning' },
            { number: stats.total, label: '전체 문제', type: '' },
            { number: `${stats.progress}%`, label: '완료율', type: '' },
            { number: this.plugin.settings.dailyGoal, label: '일일 목표', type: '' }
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
    
    renderProgressSection(container, stats) {
        const section = container.createDiv('progress-section');
        
        const header = section.createDiv('progress-header');
        const title = header.createEl('h3', { cls: 'progress-title' });
        title.textContent = `${this.currentSubject} 진행률 (${stats.mastered}/${stats.total})`;
        
        const dDay = header.createDiv('d-day');
        const dDayText = stats.daysLeft > 0 ? `D-${stats.daysLeft}` : 'D-Day';
        dDay.textContent = `${dDayText} (${this.plugin.settings.targetDate}까지)`;
        
        const progressContainer = section.createDiv('progress-bar-container');
        const progressFill = progressContainer.createDiv('progress-fill');
        progressFill.style.width = `${stats.progress}%`;
        
        const progressText = progressContainer.createDiv('progress-text');
        progressText.textContent = `${stats.progress}%`;
        
        const progressStats = section.createDiv('progress-stats');
        const statItems = [
            { number: this.plugin.settings.dailyGoal, label: '일일 목표' },
            { number: stats.daysLeft, label: '남은 일수' },
            { number: stats.dailyTarget, label: '일일 필요량' }
        ];
        
        statItems.forEach(item => {
            const statDiv = progressStats.createDiv('progress-stat');
            const number = statDiv.createDiv('progress-stat-number');
            number.textContent = item.number.toString();
            const label = statDiv.createDiv('progress-stat-label');
            label.textContent = item.label;
        });
    }
    
    renderTimerToggle(container) {
        const toggle = container.createDiv('timer-toggle');
        
        const info = toggle.createDiv('timer-info');
        const icon = info.createDiv('timer-icon');
        icon.textContent = '⏱️';
        
        const text = info.createDiv('timer-text');
        const title = text.createEl('h3');
        title.textContent = 'Anki 타이머 모드';
        const desc = text.createEl('p');
        desc.textContent = '문제 풀이 시간을 측정하고 복습 스케줄을 관리합니다';
        
        const switchEl = toggle.createDiv('timer-switch');
        if (this.plugin.settings.timerEnabled) {
            switchEl.addClass('active');
        }
        
        switchEl.addEventListener('click', async () => {
            switchEl.toggleClass('active');
            this.plugin.settings.timerEnabled = switchEl.hasClass('active');
            await this.plugin.saveSettings();
            
            const status = this.plugin.settings.timerEnabled ? '활성화' : '비활성화';
            new Notice(`Anki 타이머 모드가 ${status}되었습니다.`);
        });
    }
    
    renderActionSection(container) {
        const section = container.createDiv('action-section');
        
        const controls = section.createDiv('view-controls');
        
        const maxLabel = controls.createEl('label');
        maxLabel.textContent = '최대 문제 수:';
        const maxSelect = controls.createEl('select');
        [100, 200, 300, 500].forEach(num => {
            const option = maxSelect.createEl('option');
            option.value = num.toString();
            option.textContent = `${num}문제`;
            if (num === this.maxProblems) {
                option.selected = true;
            }
        });
        
        maxSelect.addEventListener('change', (e) => {
            this.maxProblems = parseInt(e.target.value);
            this.refresh();
        });
        
        const viewLabel = controls.createEl('label');
        viewLabel.textContent = '보기 모드:';
        const viewSelect = controls.createEl('select');
        const viewOptions = [
            { value: 'all', text: '전체' },
            { value: 'incomplete', text: '미완료만' },
            { value: 'review', text: '복습 필요' }
        ];
        viewOptions.forEach(opt => {
            const option = viewSelect.createEl('option');
            option.value = opt.value;
            option.textContent = opt.text;
            if (opt.value === this.viewMode) {
                option.selected = true;
            }
        });
        
        viewSelect.addEventListener('change', (e) => {
            this.viewMode = e.target.value;
            this.refresh();
        });
        
        const buttons = section.createDiv('action-buttons');
        
        const addBtn = buttons.createEl('button', { cls: 'btn btn-primary' });
        addBtn.innerHTML = '➕ 새 문제';
        addBtn.addEventListener('click', () => {
            new ProblemCreationModal(this.app, this.plugin, null, this.currentSubject).open();
        });
        
        const batchBtn = buttons.createEl('button', { cls: 'btn btn-success' });
        batchBtn.innerHTML = '📝 일괄 생성';
        batchBtn.addEventListener('click', () => {
            new BulkCreationModal(this.app, this.plugin, this.currentSubject).open();
        });
        
        const refreshBtn = buttons.createEl('button', { cls: 'btn btn-secondary' });
        refreshBtn.innerHTML = '🔄 새로고침';
        refreshBtn.addEventListener('click', () => {
            this.refresh();
            new Notice('대시보드가 새로고침되었습니다.');
        });
    }
    
    renderProblemsGrid(container, problems) {
        const section = container.createDiv('problems-section');
        
        const header = section.createDiv('problems-header');
        const title = header.createEl('h3', { cls: 'problems-title' });
        title.textContent = `📊 문제 현황 (${this.currentSubject})`;
        
        const grid = section.createDiv('problems-grid');
        
        for (let i = 1; i <= this.maxProblems; i++) {
            const problem = problems.find(p => p.number === i);
            const cell = grid.createDiv('problem-cell');
            cell.textContent = i.toString();
            
            if (problem) {
                cell.addClass(problem.status);
                cell.title = `${i}번: ${problem.title}`;
                
                if (problem.reviewCount > 0) {
                    const badge = cell.createDiv('review-badge');
                    badge.textContent = problem.reviewCount > 9 ? '9+' : problem.reviewCount.toString();
                }
                
                if ((this.viewMode === 'incomplete' && problem.status === 'mastered') || 
                    (this.viewMode === 'review' && problem.status !== 'reviewing')) {
                    cell.style.display = 'none';
                }
                
                cell.addEventListener('click', () => {
                    this.openProblem(problem);
                });
            } else {
                cell.addClass('empty');
                cell.title = `${i}번 문제 만들기`;
                cell.addEventListener('click', () => {
                    new ProblemCreationModal(this.app, this.plugin, i, this.currentSubject).open();
                });
            }
        }
    }
    
    renderRecentProblems(container, problems) {
        if (!problems.length) return;
        
        const section = container.createDiv('recent-problems');
        const title = section.createEl('h3');
        title.textContent = '📋 최근 학습 문제';
        
        const recentProblems = [...problems]
            .sort((a, b) => b.number - a.number)
            .slice(0, 10);
        
        recentProblems.forEach(problem => {
            const item = section.createDiv('problem-item');
            
            const indicator = item.createDiv('problem-status-indicator');
            indicator.addClass(problem.status);
            
            const info = item.createDiv('problem-info');
            const problemTitle = info.createDiv('problem-title');
            problemTitle.textContent = `${problem.number}. ${problem.title}`;
            
            const meta = info.createDiv('problem-meta');
            
            const stars = meta.createSpan('difficulty-stars');
            stars.textContent = '⭐'.repeat(problem.difficulty);
            
            const reviewBadge = meta.createSpan('review-count-badge');
            reviewBadge.textContent = `복습 ${problem.reviewCount}회`;
            
            if (problem.tags && problem.tags[0]) {
                const tag = meta.createSpan();
                tag.textContent = problem.tags[0];
            }
            
            item.addEventListener('click', () => {
                this.openProblem(problem);
            });
        });
    }
    
    async openProblem(problem) {
        try {
            if (this.plugin.settings.timerEnabled) {
                new ProblemTimerModal(this.app, this.plugin, problem).open();
            } else {
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
    
    refresh() {
        this.onOpen();
    }
}

class ProblemTimerModal extends Modal {
    constructor(app, plugin, problem) {
        super(app);
        this.plugin = plugin;
        this.problem = problem;
        this.timeLeft = 300;
        this.timerInterval = null;
        this.isRunning = false;
    }
    
    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        this.modalEl.style.width = '800px';
        this.modalEl.style.height = '600px';
        
        this.createTimerInterface(contentEl);
    }
    
    createTimerInterface(container) {
        const timerContainer = container.createDiv('problem-timer-modal');
        
        const header = timerContainer.createDiv('timer-modal-header');
        const title = header.createEl('h2', { cls: 'timer-modal-title' });
        title.textContent = `문제 ${this.problem.number}`;
        
        const info = header.createDiv();
        info.style.display = 'flex';
        info.style.justifyContent = 'center';
        info.style.gap = '15px';
        info.style.fontSize = '0.9rem';
        
        const badges = [
            `📚 ${this.problem.subject}`,
            `⏰ 5분`,
            `⭐ 난이도 ${this.problem.difficulty}`
        ];
        
        badges.forEach(badge => {
            const span = info.createSpan();
            span.style.background = 'rgba(255,255,255,0.2)';
            span.style.padding = '5px 15px';
            span.style.borderRadius = '15px';
            span.textContent = badge;
        });
        
        const display = header.createDiv('timer-display');
        display.textContent = this.formatTime(this.timeLeft);
        display.id = 'timer-display';
        
        const content = timerContainer.createDiv('problem-content');
        const questionTitle = content.createEl('h3');
        questionTitle.textContent = '🔢 문제';
        questionTitle.style.marginBottom = '15px';
        
        const problemText = content.createDiv();
        problemText.innerHTML = `
            <strong>${this.problem.title}</strong><br><br>
            문제를 클릭하면 실제 파일이 열립니다.
        `;
        
        const controls = timerContainer.createDiv('timer-controls');
        
        const startBtn = controls.createEl('button', { cls: 'timer-btn start' });
        startBtn.innerHTML = '⏱️ 시작';
        startBtn.addEventListener('click', () => this.startTimer());
        
        const pauseBtn = controls.createEl('button', { cls: 'timer-btn pause' });
        pauseBtn.innerHTML = '⏸️ 일시정지';
        pauseBtn.style.display = 'none';
        pauseBtn.addEventListener('click', () => this.pauseTimer());
        
        const resetBtn = controls.createEl('button', { cls: 'timer-btn reset' });
        resetBtn.innerHTML = '🔄 리셋';
        resetBtn.addEventListener('click', () => this.resetTimer());
        
        const openBtn = controls.createEl('button', { cls: 'timer-btn hint' });
        openBtn.innerHTML = '📄 파일 열기';
        openBtn.addEventListener('click', async () => {
            if (this.problem?.file?.path) {
                const leaf = this.app.workspace.getUnpinnedLeaf();
                await leaf.openFile(this.problem.file);
            }
        });
        
        const closeBtn = controls.createEl('button', { cls: 'timer-btn close' });
        closeBtn.innerHTML = '❌ 닫기';
        closeBtn.addEventListener('click', () => this.close());
    }
    
    startTimer() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        
        const startBtn = this.contentEl.querySelector('.timer-btn.start');
        const pauseBtn = this.contentEl.querySelector('.timer-btn.pause');
        
        startBtn.style.display = 'none';
        pauseBtn.style.display = 'flex';
        
        this.timerInterval = setInterval(() => {
            this.timeLeft--;
            this.updateDisplay();
            
            if (this.timeLeft <= 0) {
                this.timeUp();
            }
        }, 1000);
        
        new Notice('타이머가 시작되었습니다!');
    }
    
    pauseTimer() {
        if (!this.isRunning) return;
        
        this.isRunning = false;
        
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        
        const startBtn = this.contentEl.querySelector('.timer-btn.start');
        const pauseBtn = this.contentEl.querySelector('.timer-btn.pause');
        
        startBtn.style.display = 'flex';
        pauseBtn.style.display = 'none';
        
        new Notice('타이머가 일시정지되었습니다.');
    }
    
    resetTimer() {
        this.pauseTimer();
        this.timeLeft = 300;
        this.updateDisplay();
        new Notice('타이머가 리셋되었습니다.');
    }
    
    timeUp() {
        this.pauseTimer();
        new Notice('시간이 종료되었습니다!', 5000);
    }
    
    updateDisplay() {
        const display = this.contentEl.querySelector('#timer-display');
        if (display) {
            display.textContent = this.formatTime(this.timeLeft);
            
            if (this.timeLeft <= 30) {
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
    
    onClose() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }
    }
}

class ProblemCreationModal extends Modal {
    constructor(app, plugin, number, subject) {
        super(app);
        this.plugin = plugin;
        this.suggestedNumber = number;
        this.suggestedSubject = subject;
    }
    
    onOpen() {
        const { contentEl } = this;
        contentEl.createEl('h2', { text: '새 문제 만들기' });
        
        const form = contentEl.createDiv();
        form.style.padding = '20px';
        
        const numberGroup = form.createDiv();
        numberGroup.createEl('label', { text: '문제 번호:' });
        const numberInput = numberGroup.createEl('input', { 
            type: 'number', 
            placeholder: '문제 번호',
            value: this.suggestedNumber?.toString() || ''
        });
        numberInput.style.width = '100%';
        numberInput.style.marginBottom = '15px';
        numberInput.style.padding = '8px';
        
        const titleGroup = form.createDiv();
        titleGroup.createEl('label', { text: '문제 제목:' });
        const titleInput = titleGroup.createEl('input', { 
            type: 'text', 
            placeholder: '문제 제목' 
        });
        titleInput.style.width = '100%';
        titleInput.style.marginBottom = '15px';
        titleInput.style.padding = '8px';
        
        const subjectGroup = form.createDiv();
        subjectGroup.createEl('label', { text: '과목:' });
        const subjectSelect = subjectGroup.createEl('select');
        subjectSelect.style.width = '100%';
        subjectSelect.style.marginBottom = '15px';
        subjectSelect.style.padding = '8px';
        
        this.plugin.settings.subjects.forEach(subject => {
            const option = subjectSelect.createEl('option', { 
                value: subject, 
                text: subject 
            });
            if (subject === this.suggestedSubject) {
                option.selected = true;
            }
        });
        
        const difficultyGroup = form.createDiv();
        difficultyGroup.createEl('label', { text: '난이도:' });
        const difficultySelect = difficultyGroup.createEl('select');
        difficultySelect.style.width = '100%';
        difficultySelect.style.marginBottom = '20px';
        difficultySelect.style.padding = '8px';
        
        for (let i = 1; i <= 5; i++) {
            const option = difficultySelect.createEl('option', { 
                value: i.toString(), 
                text: '⭐'.repeat(i) + ` (${i}단계)` 
            });
            if (i === 3) {
                option.selected = true;
            }
        }
        
        const buttons = form.createDiv();
        buttons.style.textAlign = 'right';
        
        const cancelBtn = buttons.createEl('button', { text: '취소' });
        cancelBtn.style.marginRight = '10px';
        cancelBtn.addEventListener('click', () => this.close());
        
        const createBtn = buttons.createEl('button', { text: '생성' });
        createBtn.style.backgroundColor = '#3b82f6';
        createBtn.style.color = 'white';
        createBtn.style.border = 'none';
        createBtn.style.padding = '8px 15px';
        createBtn.style.borderRadius = '4px';
        createBtn.addEventListener('click', async () => {
            if (!numberInput.value || !titleInput.value.trim()) {
                new Notice('번호와 제목을 입력하세요!');
                return;
            }
            
            await this.plugin.createProblemFile(
                parseInt(numberInput.value),
                titleInput.value.trim(),
                subjectSelect.value,
                parseInt(difficultySelect.value)
            );
            this.close();
        });
    }
}

class BulkCreationModal extends Modal {
    constructor(app, plugin, subject) {
        super(app);
        this.plugin = plugin;
        this.suggestedSubject = subject;
    }
    
    onOpen() {
        const { contentEl } = this;
        contentEl.createEl('h2', { text: '일괄 생성' });
        
        const form = contentEl.createDiv();
        form.style.padding = '20px';
        
        const subjectGroup = form.createDiv();
        subjectGroup.createEl('label', { text: '과목:' });
        const subjectSelect = subjectGroup.createEl('select');
        subjectSelect.style.width = '100%';
        subjectSelect.style.marginBottom = '15px';
        subjectSelect.style.padding = '8px';
        
        this.plugin.settings.subjects.forEach(subject => {
            const option = subjectSelect.createEl('option', { 
                value: subject, 
                text: subject 
            });
            if (subject === this.suggestedSubject) {
                option.selected = true;
            }
        });
        
        const rangeGroup = form.createDiv();
        rangeGroup.createEl('label', { text: '범위:' });
        
        const rangeDiv = rangeGroup.createDiv();
        rangeDiv.style.display = 'flex';
        rangeDiv.style.gap = '10px';
        rangeDiv.style.alignItems = 'center';
        rangeDiv.style.marginBottom = '20px';
        
        const startInput = rangeDiv.createEl('input', { 
            type: 'number', 
            placeholder: '시작' 
        });
        startInput.style.width = '100px';
        startInput.style.padding = '8px';
        
        rangeDiv.createEl('span', { text: '~' });
        
        const endInput = rangeDiv.createEl('input', { 
            type: 'number', 
            placeholder: '끝' 
        });
        endInput.style.width = '100px';
        endInput.style.padding = '8px';
        
        const buttons = form.createDiv();
        buttons.style.textAlign = 'right';
        
        const cancelBtn = buttons.createEl('button', { text: '취소' });
        cancelBtn.style.marginRight = '10px';
        cancelBtn.addEventListener('click', () => this.close());
        
        const createBtn = buttons.createEl('button', { text: '생성' });
        createBtn.style.backgroundColor = '#10b981';
        createBtn.style.color = 'white';
        createBtn.style.border = 'none';
        createBtn.style.padding = '8px 15px';
        createBtn.style.borderRadius = '4px';
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

class StudyDashboardSettingTab extends PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }
    
    display() {
        const { containerEl } = this;
        containerEl.empty();
        
        containerEl.createEl('h2', { text: '통합 Study Dashboard 설정' });
        
        new Setting(containerEl)
            .setName('문제 폴더')
            .setDesc('문제 파일들이 저장될 폴더 경로')
            .addText(text => text
                .setValue(this.plugin.settings.problemsFolder)
                .onChange(async (value) => {
                    this.plugin.settings.problemsFolder = value;
                    await this.plugin.saveSettings();
                }));
        
        new Setting(containerEl)
            .setName('템플릿 폴더')
            .setDesc('문제 템플릿이 저장된 폴더 경로')
            .addText(text => text
                .setValue(this.plugin.settings.templatesFolder)
                .onChange(async (value) => {
                    this.plugin.settings.templatesFolder = value;
                    await this.plugin.saveSettings();
                }));
        
        new Setting(containerEl)
            .setName('일일 목표')
            .setDesc('하루에 풀고자 하는 문제 수')
            .addSlider(slider => slider
                .setLimits(1, 20, 1)
                .setValue(this.plugin.settings.dailyGoal)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.dailyGoal = value;
                    await this.plugin.saveSettings();
                }));
        
        new Setting(containerEl)
            .setName('목표 완료일')
            .setDesc('학습 완료 목표 날짜 (YYYY-MM-DD)')
            .addText(text => text
                .setValue(this.plugin.settings.targetDate)
                .onChange(async (value) => {
                    if (value.match(/^\d{4}-\d{2}-\d{2}$/)) {
                        this.plugin.settings.targetDate = value;
                        await this.plugin.saveSettings();
                    }
                }));
        
        new Setting(containerEl)
            .setName('Anki 타이머 모드')
            .setDesc('문제 클릭 시 타이머를 자동으로 시작합니다')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.timerEnabled)
                .onChange(async (value) => {
                    this.plugin.settings.timerEnabled = value;
                    await this.plugin.saveSettings();
                }));
        
        new Setting(containerEl)
            .setName('자동 백업')
            .setDesc('문제 파일을 자동으로 백업합니다')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.autoBackup)
                .onChange(async (value) => {
                    this.plugin.settings.autoBackup = value;
                    await this.plugin.saveSettings();
                }));
        
        // 과목 관리 섹션
        containerEl.createEl('h3', { text: '과목 관리' });
        
        const subjectsContainer = containerEl.createDiv();
        subjectsContainer.style.marginBottom = '20px';
        
        this.renderSubjectsList(subjectsContainer);
        
        new Setting(containerEl)
            .setName('새 과목 추가')
            .setDesc('새로운 과목을 추가합니다')
            .addText(text => {
                const addButton = new Setting(containerEl)
                    .addButton(button => button
                        .setButtonText('추가')
                        .onClick(async () => {
                            const newSubject = text.inputEl.value.trim();
                            if (newSubject && !this.plugin.settings.subjects.includes(newSubject)) {
                                this.plugin.settings.subjects.push(newSubject);
                                await this.plugin.saveSettings();
                                text.inputEl.value = '';
                                this.renderSubjectsList(subjectsContainer);
                                new Notice(`'${newSubject}' 과목이 추가되었습니다.`);
                            } else {
                                new Notice('이미 존재하는 과목이거나 빈 값입니다.');
                            }
                        }));
                
                text.setPlaceholder('과목 이름을 입력하세요');
                return text;
            });
    }
    
    renderSubjectsList(container) {
        container.empty();
        
        this.plugin.settings.subjects.forEach((subject, index) => {
            const subjectDiv = container.createDiv();
            subjectDiv.style.display = 'flex';
            subjectDiv.style.justifyContent = 'space-between';
            subjectDiv.style.alignItems = 'center';
            subjectDiv.style.padding = '10px';
            subjectDiv.style.margin = '5px 0';
            subjectDiv.style.backgroundColor = 'var(--background-secondary)';
            subjectDiv.style.borderRadius = '5px';
            
            const subjectName = subjectDiv.createSpan();
            subjectName.textContent = subject;
            subjectName.style.fontWeight = '500';
            
            const deleteButton = subjectDiv.createEl('button');
            deleteButton.textContent = '삭제';
            deleteButton.style.backgroundColor = '#ef4444';
            deleteButton.style.color = 'white';
            deleteButton.style.border = 'none';
            deleteButton.style.padding = '5px 10px';
            deleteButton.style.borderRadius = '3px';
            deleteButton.style.cursor = 'pointer';
            
            deleteButton.addEventListener('click', async () => {
                if (this.plugin.settings.subjects.length <= 1) {
                    new Notice('최소 하나의 과목은 필요합니다.');
                    return;
                }
                
                this.plugin.settings.subjects.splice(index, 1);
                await this.plugin.saveSettings();
                this.renderSubjectsList(container);
                new Notice(`'${subject}' 과목이 삭제되었습니다.`);
            });
        });
    }
}

module.exports = StudyDashboardPlugin;