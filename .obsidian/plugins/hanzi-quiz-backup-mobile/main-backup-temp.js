const { Plugin, Notice, Setting, PluginSettingTab, Modal } = require('obsidian');

const DEFAULT_SETTINGS = {
    quizFolder: 'HanziQuiz',
    questionsFolder: 'HanziQuiz/Questions',
    resultsFolder: 'HanziQuiz/Results',
    wrongAnswersFolder: 'HanziQuiz/WrongAnswers',
    questionFolders: ['기본', '한자', '어휘', '문법'],
    timerPerQuestion: 30,
    enableTimer: true,
    shuffleQuestions: true,
    shuffleOptions: true,
    showHintAfterWrong: true
};

class HanziQuizPlugin extends Plugin {
    async onload() {
        await this.loadSettings();
        
        if (!this.settings.stats) {
            this.settings.stats = {
                totalAttempts: 0,
                totalCorrect: 0,
                totalWrong: 0,
                totalQuestions: 0,
                bookmarkedCount: 0,
                lastStudyDate: null,
                studyHistory: []
            };
        }

        this.addRibbonIcon('book-open', '한자 퀴즈 대시보드', () => {
            this.openDashboard();
        });

        this.addCommand({
            id: 'open-dashboard',
            name: '📊 대시보드 열기',
            callback: () => this.openDashboard()
        });

        this.addCommand({
            id: 'create-hanzi-question',
            name: '📝 문제 만들기',
            callback: () => new HanziQuestionModal(this.app, this).open()
        });

        this.addCommand({
            id: 'start-quiz',
            name: '🎯 퀴즈 시작하기',
            callback: () => this.startQuiz()
        });

        this.addCommand({
            id: 'start-wrong-quiz',
            name: '❌ 오답 복습하기',
            callback: () => this.startWrongAnswerQuiz()
        });

        this.addCommand({
            id: 'view-quiz-list',
            name: '📋 문제 목록 보기',
            callback: () => this.viewQuestionList()
        });

        this.addCommand({
            id: 'view-statistics',
            name: '📈 학습 통계 보기',
            callback: () => this.viewStatistics()
        });

        this.addSettingTab(new HanziQuizSettingTab(this.app, this));
        await this.ensureFolders();

        console.log('🚀 Hanzi Quiz 플러그인 로드됨');
    }

    async ensureFolders() {
        const folders = [
            this.settings.quizFolder,
            this.settings.questionsFolder,
            this.settings.resultsFolder,
            this.settings.wrongAnswersFolder
        ];

        for (const folder of folders) {
            const exists = this.app.vault.getAbstractFileByPath(folder);
            if (!exists) {
                try {
                    await this.app.vault.createFolder(folder);
                } catch (e) {
                    console.log('Folder might already exist:', folder);
                }
            }
        }
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    async openDashboard() {
        new DashboardModal(this.app, this).open();
    }

    async startQuiz(difficulty = null, wrongAnswersOnly = false, folder = null) {
        let questions = await this.loadAllQuestions();
        
        if (questions.length === 0) {
            new Notice('저장된 문제가 없습니다. 먼저 문제를 만들어주세요!');
            return;
        }

        // 폴더 필터링
        if (folder) {
            questions = questions.filter(q => (q.folder || '기본') === folder);
            if (questions.length === 0) {
                new Notice(`"${folder}" 폴더에 문제가 없습니다.`);
                return;
            }
        }

        // 난이도 필터링
        if (difficulty) {
            questions = questions.filter(q => q.difficulty === difficulty);
            if (questions.length === 0) {
                new Notice(`${difficulty} 난이도 문제가 없습니다.`);
                return;
            }
        }

        // 오답 필터링
        if (wrongAnswersOnly) {
            questions = questions.filter(q => q.wrongCount > 0);
            if (questions.length === 0) {
                new Notice('오답 문제가 없습니다!');
                return;
            }
        }

        new QuizPlayModal(this.app, this, questions, wrongAnswersOnly, difficulty).open();
    }

    async startWrongAnswerQuiz() {
        await this.startQuiz(null, true);
    }

    async startBookmarkQuiz() {
        const questions = await this.loadAllQuestions();
        const bookmarkedQuestions = questions.filter(q => q.bookmarked);

        if (bookmarkedQuestions.length === 0) {
            new Notice('⭐ 북마크한 문제가 없습니다!');
            return;
        }

        new QuizPlayModal(this.app, this, bookmarkedQuestions, false, null).open();
    }

    async viewBookmarkList() {
        await this.updateBookmarkListTemplate();
        const bookmarkPath = `${this.settings.quizFolder}/⭐ 북마크 목록.md`;
        const file = this.app.vault.getAbstractFileByPath(bookmarkPath);
        
        if (file) {
            const leaf = this.app.workspace.getLeaf(false);
            await leaf.openFile(file);
        } else {
            new Notice('❌ 북마크 목록 파일을 찾을 수 없습니다.');
        }
    }

    async viewWrongAnswerList() {
        await this.updateWrongAnswerListTemplate();
        const wrongPath = `${this.settings.quizFolder}/❌ 오답 목록.md`;
        const file = this.app.vault.getAbstractFileByPath(wrongPath);
        
        if (file) {
            const leaf = this.app.workspace.getLeaf(false);
            await leaf.openFile(file);
        } else {
            new Notice('❌ 오답 목록 파일을 찾을 수 없습니다.');
        }
    }

    async viewFolderQuestionList(folder) {
        await this.updateQuestionListTemplate(folder);
        const folderPath = `${this.settings.questionsFolder}/${folder}`;
        const templatePath = `${folderPath}/📋 ${folder} 문제목록.md`;
        const file = this.app.vault.getAbstractFileByPath(templatePath);
        
        if (file) {
            const leaf = this.app.workspace.getLeaf(false);
            await leaf.openFile(file);
        } else {
            new Notice(`❌ ${folder} 폴더의 문제목록 파일을 찾을 수 없습니다.`);
        }
    }

    async createIntegratedDashboard() {
        const dashboardPath = this.settings.quizFolder + '/🎯 통합한자대시보드.md';
        
        const questionsFolder = this.settings.questionsFolder;
        const foldersJson = JSON.stringify(this.settings.questionFolders);
        const updateTime = new Date().toLocaleString('ko-KR');
        
        const template = '---\n' +
'cssclass: hanzi-dashboard\n' +
'---\n\n' +
'# 🏆 한자 퀴즈 통합 대시보드\n\n' +
'> 모든 학습 정보를 한눈에 확인하고 빠르게 접근할 수 있는 통합 대시보드입니다.\n\n' +
'## 📊 전체 통계\n\n' +
'```dataviewjs\n' +
'const questionsPath = "' + questionsFolder + '";\n' +
'const questions = dv.pages(\'"\' + questionsPath + \'"\')' + '\n' +
'    .where(p => p.file.name.includes("_") && !p.file.name.includes("문제목록"));\n\n' +
'const totalQuestions = questions.length;\n' +
'const bookmarked = questions.where(p => p.bookmarked === true).length;\n' +
'const hasWrong = questions.where(p => p.wrongCount > 0).length;\n' +
'const totalCorrect = questions.map(p => p.correctCount || 0).reduce((a, b) => a + b, 0);\n' +
'const totalWrong = questions.map(p => p.wrongCount || 0).reduce((a, b) => a + b, 0);\n' +
'const totalAttempts = totalCorrect + totalWrong;\n' +
'const accuracy = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;\n\n' +
'dv.paragraph(`\n' +
'<div class="stats-container">\n' +
'    <div class="stat-card stat-primary">\n' +
'        <div class="stat-icon">📚</div>\n' +
'        <div class="stat-value">${totalQuestions}</div>\n' +
'        <div class="stat-label">총 문제</div>\n' +
'    </div>\n' +
'    <div class="stat-card stat-success">\n' +
'        <div class="stat-icon">✅</div>\n' +
'        <div class="stat-value">${accuracy}%</div>\n' +
'        <div class="stat-label">정답률</div>\n' +
'    </div>\n' +
'    <div class="stat-card stat-warning">\n' +
'        <div class="stat-icon">⭐</div>\n' +
'        <div class="stat-value">${bookmarked}</div>\n' +
'        <div class="stat-label">북마크</div>\n' +
'    </div>\n' +
'    <div class="stat-card stat-danger">\n' +
'        <div class="stat-icon">❌</div>\n' +
'        <div class="stat-value">${hasWrong}</div>\n' +
'        <div class="stat-label">오답 있음</div>\n' +
'    </div>\n' +
'</div>\n' +
'`);\n' +
'```\n\n' +
'## 📂 폴더별 현황\n\n' +
'```dataviewjs\n' +
'const questionsPath = "' + questionsFolder + '";\n' +
'const folders = ' + foldersJson + ';\n\n' +
'let html = \'<div class="folders-container">\';\n\n' +
'for (const folder of folders) {\n' +
'    const folderQuestions = dv.pages(\'"\' + questionsPath + \'/\' + folder + \'"\')' + '\n' +
'        .where(p => p.file.name.includes("_") && !p.file.name.includes("문제목록"));\n    \n' +
'    const count = folderQuestions.length;\n' +
'    const wrong = folderQuestions.where(p => p.wrongCount > 0).length;\n' +
'    const bookmarked = folderQuestions.where(p => p.bookmarked === true).length;\n    \n' +
'    html += `\n' +
'    <div class="folder-card">\n' +
'        <div class="folder-header">\n' +
'            <h3>📁 ${folder}</h3>\n' +
'        </div>\n' +
'        <div class="folder-stats">\n' +
'            <div class="folder-stat">\n' +
'                <span class="folder-stat-label">문제</span>\n' +
'                <span class="folder-stat-value">${count}</span>\n' +
'            </div>\n' +
'            <div class="folder-stat">\n' +
'                <span class="folder-stat-label">오답</span>\n' +
'                <span class="folder-stat-value">${wrong}</span>\n' +
'            </div>\n' +
'            <div class="folder-stat">\n' +
'                <span class="folder-stat-label">북마크</span>\n' +
'                <span class="folder-stat-value">${bookmarked}</span>\n' +
'            </div>\n' +
'        </div>\n' +
'    </div>\n' +
'    `;\n' +
'}\n\n' +
'html += \'</div>\';\n' +
'dv.paragraph(html);\n' +
'```\n\n' +
'---\n' +
'마지막 업데이트: ' + updateTime + '\n';

        try {
            const file = this.app.vault.getAbstractFileByPath(dashboardPath);
            if (file) {
                await this.app.vault.modify(file, template);
            } else {
                await this.app.vault.create(dashboardPath, template);
            }
            
            new Notice('✅ 통합 대시보드가 생성되었습니다!');
            
            // 생성 후 바로 열기
            const dashboardFile = this.app.vault.getAbstractFileByPath(dashboardPath);
            if (dashboardFile) {
                const leaf = this.app.workspace.getLeaf(false);
                await leaf.openFile(dashboardFile);
            }
        } catch (error) {
            console.error('통합 대시보드 생성 오류:', error);
            new Notice('❌ 통합 대시보드 생성에 실패했습니다.');
        }
    }

    async loadAllQuestions() {
const questionsPath = "${questionsFolder}";
const topWrong = dv.pages('"' + questionsPath + '"')
    .where(p => p.file.name.includes("_") && !p.file.name.includes("문제목록") && p.wrongCount > 0)
    .sort(p => p.wrongCount, 'desc')
    .limit(10);

if (topWrong.length > 0) {
    let html = '<div class="wrong-list">';
    for (const q of topWrong) {
        const difficulty = q.difficulty || '보통';
        const diffIcon = difficulty === '쉬움' ? '😊' : difficulty === '어려움' ? '😰' : '😐';
        html += \`
        <div class="wrong-item">
            <div class="wrong-hanzi">\${q.hanzi || '-'}</div>
            <div class="wrong-info">
                <div class="wrong-question">\${q.question || ''}</div>
                <div class="wrong-meta">
                    <span class="difficulty-badge">\${diffIcon} \${difficulty}</span>
                    <span class="folder-badge">📁 \${q.folder || '기본'}</span>
                    <span class="wrong-badge">❌ \${q.wrongCount}회</span>
                </div>
            </div>
        </div>
        \`;
    }
    html += '</div>';
    dv.paragraph(html);
} else {
    dv.paragraph('<p class="empty-message">🎉 오답이 없습니다!</p>');
}
${'```'}

## ⭐ 북마크 문제

${'```'}dataviewjs
const questionsPath = "${questionsFolder}";
const bookmarks = dv.pages('"' + questionsPath + '"')
    .where(p => p.file.name.includes("_") && !p.file.name.includes("문제목록") && p.bookmarked === true)
    .sort(p => p.wrongCount, 'desc');

if (bookmarks.length > 0) {
    let html = '<div class="bookmark-list">';
    for (const q of bookmarks) {
        const difficulty = q.difficulty || '보통';
        const diffIcon = difficulty === '쉬움' ? '😊' : difficulty === '어려움' ? '😰' : '😐';
        html += \`
        <div class="bookmark-item">
            <div class="bookmark-icon">⭐</div>
            <div class="bookmark-hanzi">\${q.hanzi || '-'}</div>
            <div class="bookmark-info">
                <div class="bookmark-question">\${q.question || ''}</div>
                <div class="bookmark-meta">
                    <span class="difficulty-badge">\${diffIcon} \${difficulty}</span>
                    <span class="folder-badge">📁 \${q.folder || '기본'}</span>
                </div>
            </div>
        </div>
        \`;
    }
    html += '</div>';
    dv.paragraph(html);
} else {
    dv.paragraph('<p class="empty-message">북마크한 문제가 없습니다.</p>');
}
${'```'}

## 📈 난이도별 분포

${'```'}dataviewjs
const questionsPath = "${questionsFolder}";
const questions = dv.pages('"' + questionsPath + '"')
    .where(p => p.file.name.includes("_") && !p.file.name.includes("문제목록"));

const easy = questions.where(p => p.difficulty === '쉬움').length;
const normal = questions.where(p => p.difficulty === '보통').length;
const hard = questions.where(p => p.difficulty === '어려움').length;
const total = questions.length;

const easyPercent = total > 0 ? Math.round((easy / total) * 100) : 0;
const normalPercent = total > 0 ? Math.round((normal / total) * 100) : 0;
const hardPercent = total > 0 ? Math.round((hard / total) * 100) : 0;

dv.paragraph(\`
<div class="difficulty-distribution">
    <div class="difficulty-item">
        <div class="difficulty-header">
            <span class="difficulty-icon">😊</span>
            <span class="difficulty-name">쉬움</span>
        </div>
        <div class="difficulty-bar">
            <div class="difficulty-fill" style="width: \${easyPercent}%; background: #4caf50;"></div>
        </div>
        <div class="difficulty-stats">\${easy}개 (\${easyPercent}%)</div>
    </div>
    <div class="difficulty-item">
        <div class="difficulty-header">
            <span class="difficulty-icon">😐</span>
            <span class="difficulty-name">보통</span>
        </div>
        <div class="difficulty-bar">
            <div class="difficulty-fill" style="width: \${normalPercent}%; background: #ff9800;"></div>
        </div>
        <div class="difficulty-stats">\${normal}개 (\${normalPercent}%)</div>
    </div>
    <div class="difficulty-item">
        <div class="difficulty-header">
            <span class="difficulty-icon">😰</span>
            <span class="difficulty-name">어려움</span>
        </div>
        <div class="difficulty-bar">
            <div class="difficulty-fill" style="width: \${hardPercent}%; background: #f44336;"></div>
        </div>
        <div class="difficulty-stats">\${hard}개 (\${hardPercent}%)</div>
    </div>
</div>
\`);
${'```'}

---

<style>
/* 모바일 반응형 통합 대시보드 스타일 */

.hanzi-dashboard {
    max-width: 100%;
    padding: 10px;
}

/* 통계 카드 컨테이너 */
.stats-container {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 15px;
    margin: 20px 0;
}

@media (max-width: 768px) {
    .stats-container {
        grid-template-columns: repeat(2, 1fr);
        gap: 10px;
    }
}

.stat-card {
    background: var(--background-secondary);
    border-radius: 12px;
    padding: 20px;
    text-align: center;
    transition: transform 0.2s, box-shadow 0.2s;
    border: 2px solid transparent;
}

.stat-card:hover {
    transform: translateY(-5px);
    box-shadow: 0 8px 16px rgba(0,0,0,0.1);
}

.stat-primary { border-color: #2196f3; }
.stat-success { border-color: #4caf50; }
.stat-warning { border-color: #ff9800; }
.stat-danger { border-color: #f44336; }

.stat-icon {
    font-size: 48px;
    margin-bottom: 12px;
}

@media (max-width: 480px) {
    .stat-icon {
        font-size: 36px;
        margin-bottom: 8px;
    }
}

.stat-value {
    font-size: 36px;
    font-weight: bold;
    margin-bottom: 8px;
    color: var(--text-accent);
}

@media (max-width: 480px) {
    .stat-value {
        font-size: 28px;
    }
}

.stat-label {
    font-size: 14px;
    color: var(--text-muted);
    font-weight: 500;
}

/* 폴더 카드 */
.folders-container {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 15px;
    margin: 20px 0;
}

@media (max-width: 768px) {
    .folders-container {
        grid-template-columns: repeat(2, 1fr);
        gap: 10px;
    }
}

@media (max-width: 480px) {
    .folders-container {
        grid-template-columns: 1fr;
    }
}

.folder-card {
    background: var(--background-secondary);
    border-radius: 10px;
    padding: 16px;
    border: 2px solid var(--background-modifier-border);
    transition: all 0.2s;
}

.folder-card:hover {
    border-color: var(--interactive-accent);
    transform: translateY(-3px);
    box-shadow: 0 6px 12px rgba(0,0,0,0.1);
}

.folder-header h3 {
    margin: 0 0 12px 0;
    font-size: 18px;
    color: var(--text-normal);
}

.folder-stats {
    display: flex;
    justify-content: space-between;
    gap: 8px;
}

.folder-stat {
    flex: 1;
    text-align: center;
    padding: 8px;
    background: var(--background-primary);
    border-radius: 6px;
}

.folder-stat-label {
    display: block;
    font-size: 11px;
    color: var(--text-muted);
    margin-bottom: 4px;
}

.folder-stat-value {
    display: block;
    font-size: 20px;
    font-weight: bold;
    color: var(--text-accent);
}

/* 오답/북마크 리스트 */
.wrong-list, .bookmark-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin: 20px 0;
}

.wrong-item, .bookmark-item {
    display: flex;
    align-items: center;
    gap: 15px;
    padding: 16px;
    background: var(--background-secondary);
    border-radius: 10px;
    border-left: 4px solid #f44336;
    transition: all 0.2s;
}

.bookmark-item {
    border-left-color: #ff9800;
}

.wrong-item:hover, .bookmark-item:hover {
    background: var(--background-modifier-hover);
    transform: translateX(5px);
}

@media (max-width: 480px) {
    .wrong-item, .bookmark-item {
        flex-direction: column;
        align-items: flex-start;
        gap: 10px;
        padding: 12px;
    }
}

.wrong-hanzi, .bookmark-hanzi {
    font-size: 36px;
    font-weight: bold;
    min-width: 60px;
    text-align: center;
}

@media (max-width: 480px) {
    .wrong-hanzi, .bookmark-hanzi {
        font-size: 28px;
        min-width: auto;
    }
}

.bookmark-icon {
    font-size: 28px;
}

.wrong-info, .bookmark-info {
    flex: 1;
}

.wrong-question, .bookmark-question {
    font-size: 16px;
    font-weight: 500;
    margin-bottom: 8px;
    line-height: 1.4;
}

@media (max-width: 480px) {
    .wrong-question, .bookmark-question {
        font-size: 14px;
    }
}

.wrong-meta, .bookmark-meta {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
}

.difficulty-badge, .folder-badge, .wrong-badge {
    padding: 4px 10px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 600;
    background: var(--background-primary);
}

@media (max-width: 480px) {
    .difficulty-badge, .folder-badge, .wrong-badge {
        font-size: 11px;
        padding: 3px 8px;
    }
}

/* 난이도 분포 */
.difficulty-distribution {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin: 20px 0;
}

.difficulty-item {
    background: var(--background-secondary);
    padding: 16px;
    border-radius: 10px;
}

.difficulty-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
}

.difficulty-icon {
    font-size: 24px;
}

.difficulty-name {
    font-size: 16px;
    font-weight: 600;
}

.difficulty-bar {
    width: 100%;
    height: 20px;
    background: var(--background-primary);
    border-radius: 10px;
    overflow: hidden;
    margin-bottom: 8px;
}

.difficulty-fill {
    height: 100%;
    transition: width 0.3s ease;
    border-radius: 10px;
}

.difficulty-stats {
    text-align: right;
    font-size: 14px;
    color: var(--text-muted);
    font-weight: 500;
}

.empty-message {
    text-align: center;
    padding: 40px;
    font-size: 16px;
    color: var(--text-muted);
    background: var(--background-secondary);
    border-radius: 10px;
}

@media (max-width: 480px) {
    .empty-message {
        padding: 30px 20px;
        font-size: 14px;
    }
}
</style>

---
마지막 업데이트: ${new Date().toLocaleString('ko-KR')}
`;

        try {
            const file = this.app.vault.getAbstractFileByPath(dashboardPath);
            if (file) {
                await this.app.vault.modify(file, template);
            } else {
                await this.app.vault.create(dashboardPath, template);
            }
            
            new Notice('✅ 통합 대시보드가 생성되었습니다!');
            
            // 생성 후 바로 열기
            const dashboardFile = this.app.vault.getAbstractFileByPath(dashboardPath);
            if (dashboardFile) {
                const leaf = this.app.workspace.getLeaf(false);
                await leaf.openFile(dashboardFile);
            }
        } catch (error) {
            console.error('통합 대시보드 생성 오류:', error);
            new Notice('❌ 통합 대시보드 생성에 실패했습니다.');
        }
    }

const totalQuestions = questions.length;
const bookmarked = questions.where(p => p.bookmarked === true).length;
const hasWrong = questions.where(p => p.wrongCount > 0).length;
const totalCorrect = questions.map(p => p.correctCount || 0).reduce((a, b) => a + b, 0);
const totalWrong = questions.map(p => p.wrongCount || 0).reduce((a, b) => a + b, 0);
const totalAttempts = totalCorrect + totalWrong;
const accuracy = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;

dv.paragraph(\`
<div class="stats-container">
    <div class="stat-card stat-primary">
        <div class="stat-icon">📚</div>
        <div class="stat-value">\${totalQuestions}</div>
        <div class="stat-label">총 문제</div>
    </div>
    <div class="stat-card stat-success">
        <div class="stat-icon">✅</div>
        <div class="stat-value">\${accuracy}%</div>
        <div class="stat-label">정답률</div>
    </div>
    <div class="stat-card stat-warning">
        <div class="stat-icon">⭐</div>
        <div class="stat-value">\${bookmarked}</div>
        <div class="stat-label">북마크</div>
    </div>
    <div class="stat-card stat-danger">
        <div class="stat-icon">❌</div>
        <div class="stat-value">\${hasWrong}</div>
        <div class="stat-label">오답 있음</div>
    </div>
</div>
\`);
\`\`\`

## 📂 폴더별 현황

\`\`\`dataviewjs
const questionsPath = "${this.settings.questionsFolder}";
const folders = ${JSON.stringify(this.settings.questionFolders)};

let html = '<div class="folders-container">';

for (const folder of folders) {
    const folderQuestions = dv.pages(\`"\${questionsPath}/\${folder}"\`)
        .where(p => p.file.name.includes("_") && !p.file.name.includes("문제목록"));
    
    const count = folderQuestions.length;
    const wrong = folderQuestions.where(p => p.wrongCount > 0).length;
    const bookmarked = folderQuestions.where(p => p.bookmarked === true).length;
    
    html += \`
    <div class="folder-card">
        <div class="folder-header">
            <h3>📁 \${folder}</h3>
        </div>
        <div class="folder-stats">
            <div class="folder-stat">
                <span class="folder-stat-label">문제</span>
                <span class="folder-stat-value">\${count}</span>
            </div>
            <div class="folder-stat">
                <span class="folder-stat-label">오답</span>
                <span class="folder-stat-value">\${wrong}</span>
            </div>
            <div class="folder-stat">
                <span class="folder-stat-label">북마크</span>
                <span class="folder-stat-value">\${bookmarked}</span>
            </div>
        </div>
    </div>
    \`;
}

html += '</div>';
dv.paragraph(html);
\`\`\`

## 🔥 오답 많은 문제 TOP 10

\`\`\`dataviewjs
const questionsPath = "${this.settings.questionsFolder}";
const topWrong = dv.pages(\`"\${questionsPath}"\`)
    .where(p => p.file.name.includes("_") && !p.file.name.includes("문제목록") && p.wrongCount > 0)
    .sort(p => p.wrongCount, 'desc')
    .limit(10);

if (topWrong.length > 0) {
    let html = '<div class="wrong-list">';
    for (const q of topWrong) {
        const difficulty = q.difficulty || '보통';
        const diffIcon = difficulty === '쉬움' ? '😊' : difficulty === '어려움' ? '😰' : '😐';
        html += \`
        <div class="wrong-item">
            <div class="wrong-hanzi">\${q.hanzi || '-'}</div>
            <div class="wrong-info">
                <div class="wrong-question">\${q.question || ''}</div>
                <div class="wrong-meta">
                    <span class="difficulty-badge">\${diffIcon} \${difficulty}</span>
                    <span class="folder-badge">📁 \${q.folder || '기본'}</span>
                    <span class="wrong-badge">❌ \${q.wrongCount}회</span>
                </div>
            </div>
        </div>
        \`;
    }
    html += '</div>';
    dv.paragraph(html);
} else {
    dv.paragraph('<p class="empty-message">🎉 오답이 없습니다!</p>');
}
\`\`\`

## ⭐ 북마크 문제

\`\`\`dataviewjs
const questionsPath = "${this.settings.questionsFolder}";
const bookmarks = dv.pages(\`"\${questionsPath}"\`)
    .where(p => p.file.name.includes("_") && !p.file.name.includes("문제목록") && p.bookmarked === true)
    .sort(p => p.wrongCount, 'desc');

if (bookmarks.length > 0) {
    let html = '<div class="bookmark-list">';
    for (const q of bookmarks) {
        const difficulty = q.difficulty || '보통';
        const diffIcon = difficulty === '쉬움' ? '😊' : difficulty === '어려움' ? '😰' : '😐';
        html += \`
        <div class="bookmark-item">
            <div class="bookmark-icon">⭐</div>
            <div class="bookmark-hanzi">\${q.hanzi || '-'}</div>
            <div class="bookmark-info">
                <div class="bookmark-question">\${q.question || ''}</div>
                <div class="bookmark-meta">
                    <span class="difficulty-badge">\${diffIcon} \${difficulty}</span>
                    <span class="folder-badge">📁 \${q.folder || '기본'}</span>
                </div>
            </div>
        </div>
        \`;
    }
    html += '</div>';
    dv.paragraph(html);
} else {
    dv.paragraph('<p class="empty-message">북마크한 문제가 없습니다.</p>');
}
\`\`\`

## 📈 난이도별 분포

\`\`\`dataviewjs
const questionsPath = "${this.settings.questionsFolder}";
const questions = dv.pages(\`"\${questionsPath}"\`)
    .where(p => p.file.name.includes("_") && !p.file.name.includes("문제목록"));

const easy = questions.where(p => p.difficulty === '쉬움').length;
const normal = questions.where(p => p.difficulty === '보통').length;
const hard = questions.where(p => p.difficulty === '어려움').length;
const total = questions.length;

const easyPercent = total > 0 ? Math.round((easy / total) * 100) : 0;
const normalPercent = total > 0 ? Math.round((normal / total) * 100) : 0;
const hardPercent = total > 0 ? Math.round((hard / total) * 100) : 0;

dv.paragraph(\`
<div class="difficulty-distribution">
    <div class="difficulty-item">
        <div class="difficulty-header">
            <span class="difficulty-icon">😊</span>
            <span class="difficulty-name">쉬움</span>
        </div>
        <div class="difficulty-bar">
            <div class="difficulty-fill" style="width: \${easyPercent}%; background: #4caf50;"></div>
        </div>
        <div class="difficulty-stats">\${easy}개 (\${easyPercent}%)</div>
    </div>
    <div class="difficulty-item">
        <div class="difficulty-header">
            <span class="difficulty-icon">😐</span>
            <span class="difficulty-name">보통</span>
        </div>
        <div class="difficulty-bar">
            <div class="difficulty-fill" style="width: \${normalPercent}%; background: #ff9800;"></div>
        </div>
        <div class="difficulty-stats">\${normal}개 (\${normalPercent}%)</div>
    </div>
    <div class="difficulty-item">
        <div class="difficulty-header">
            <span class="difficulty-icon">😰</span>
            <span class="difficulty-name">어려움</span>
        </div>
        <div class="difficulty-bar">
            <div class="difficulty-fill" style="width: \${hardPercent}%; background: #f44336;"></div>
        </div>
        <div class="difficulty-stats">\${hard}개 (\${hardPercent}%)</div>
    </div>
</div>
\`);
\`\`\`

---

<style>
/* 모바일 반응형 통합 대시보드 스타일 */

.hanzi-dashboard {
    max-width: 100%;
    padding: 10px;
}

/* 통계 카드 컨테이너 */
.stats-container {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 15px;
    margin: 20px 0;
}

@media (max-width: 768px) {
    .stats-container {
        grid-template-columns: repeat(2, 1fr);
        gap: 10px;
    }
}

.stat-card {
    background: var(--background-secondary);
    border-radius: 12px;
    padding: 20px;
    text-align: center;
    transition: transform 0.2s, box-shadow 0.2s;
    border: 2px solid transparent;
}

.stat-card:hover {
    transform: translateY(-5px);
    box-shadow: 0 8px 16px rgba(0,0,0,0.1);
}

.stat-primary { border-color: #2196f3; }
.stat-success { border-color: #4caf50; }
.stat-warning { border-color: #ff9800; }
.stat-danger { border-color: #f44336; }

.stat-icon {
    font-size: 48px;
    margin-bottom: 12px;
}

@media (max-width: 480px) {
    .stat-icon {
        font-size: 36px;
        margin-bottom: 8px;
    }
}

.stat-value {
    font-size: 36px;
    font-weight: bold;
    margin-bottom: 8px;
    color: var(--text-accent);
}

@media (max-width: 480px) {
    .stat-value {
        font-size: 28px;
    }
}

.stat-label {
    font-size: 14px;
    color: var(--text-muted);
    font-weight: 500;
}

/* 폴더 카드 */
.folders-container {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 15px;
    margin: 20px 0;
}

@media (max-width: 768px) {
    .folders-container {
        grid-template-columns: repeat(2, 1fr);
        gap: 10px;
    }
}

@media (max-width: 480px) {
    .folders-container {
        grid-template-columns: 1fr;
    }
}

.folder-card {
    background: var(--background-secondary);
    border-radius: 10px;
    padding: 16px;
    border: 2px solid var(--background-modifier-border);
    transition: all 0.2s;
}

.folder-card:hover {
    border-color: var(--interactive-accent);
    transform: translateY(-3px);
    box-shadow: 0 6px 12px rgba(0,0,0,0.1);
}

.folder-header h3 {
    margin: 0 0 12px 0;
    font-size: 18px;
    color: var(--text-normal);
}

.folder-stats {
    display: flex;
    justify-content: space-between;
    gap: 8px;
}

.folder-stat {
    flex: 1;
    text-align: center;
    padding: 8px;
    background: var(--background-primary);
    border-radius: 6px;
}

.folder-stat-label {
    display: block;
    font-size: 11px;
    color: var(--text-muted);
    margin-bottom: 4px;
}

.folder-stat-value {
    display: block;
    font-size: 20px;
    font-weight: bold;
    color: var(--text-accent);
}

/* 오답/북마크 리스트 */
.wrong-list, .bookmark-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin: 20px 0;
}

.wrong-item, .bookmark-item {
    display: flex;
    align-items: center;
    gap: 15px;
    padding: 16px;
    background: var(--background-secondary);
    border-radius: 10px;
    border-left: 4px solid #f44336;
    transition: all 0.2s;
}

.bookmark-item {
    border-left-color: #ff9800;
}

.wrong-item:hover, .bookmark-item:hover {
    background: var(--background-modifier-hover);
    transform: translateX(5px);
}

@media (max-width: 480px) {
    .wrong-item, .bookmark-item {
        flex-direction: column;
        align-items: flex-start;
        gap: 10px;
        padding: 12px;
    }
}

.wrong-hanzi, .bookmark-hanzi {
    font-size: 36px;
    font-weight: bold;
    min-width: 60px;
    text-align: center;
}

@media (max-width: 480px) {
    .wrong-hanzi, .bookmark-hanzi {
        font-size: 28px;
        min-width: auto;
    }
}

.bookmark-icon {
    font-size: 28px;
}

.wrong-info, .bookmark-info {
    flex: 1;
}

.wrong-question, .bookmark-question {
    font-size: 16px;
    font-weight: 500;
    margin-bottom: 8px;
    line-height: 1.4;
}

@media (max-width: 480px) {
    .wrong-question, .bookmark-question {
        font-size: 14px;
    }
}

.wrong-meta, .bookmark-meta {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
}

.difficulty-badge, .folder-badge, .wrong-badge {
    padding: 4px 10px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 600;
    background: var(--background-primary);
}

@media (max-width: 480px) {
    .difficulty-badge, .folder-badge, .wrong-badge {
        font-size: 11px;
        padding: 3px 8px;
    }
}

/* 난이도 분포 */
.difficulty-distribution {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin: 20px 0;
}

.difficulty-item {
    background: var(--background-secondary);
    padding: 16px;
    border-radius: 10px;
}

.difficulty-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
}

.difficulty-icon {
    font-size: 24px;
}

.difficulty-name {
    font-size: 16px;
    font-weight: 600;
}

.difficulty-bar {
    width: 100%;
    height: 20px;
    background: var(--background-primary);
    border-radius: 10px;
    overflow: hidden;
    margin-bottom: 8px;
}

.difficulty-fill {
    height: 100%;
    transition: width 0.3s ease;
    border-radius: 10px;
}

.difficulty-stats {
    text-align: right;
    font-size: 14px;
    color: var(--text-muted);
    font-weight: 500;
}

.empty-message {
    text-align: center;
    padding: 40px;
    font-size: 16px;
    color: var(--text-muted);
    background: var(--background-secondary);
    border-radius: 10px;
}

@media (max-width: 480px) {
    .empty-message {
        padding: 30px 20px;
        font-size: 14px;
    }
}
</style>

---
마지막 업데이트: ${new Date().toLocaleString('ko-KR')}
`;

        try {
            const file = this.app.vault.getAbstractFileByPath(dashboardPath);
            if (file) {
                await this.app.vault.modify(file, template);
            } else {
                await this.app.vault.create(dashboardPath, template);
            }
            
            new Notice('✅ 통합 대시보드가 생성되었습니다!');
            
            // 생성 후 바로 열기
            const dashboardFile = this.app.vault.getAbstractFileByPath(dashboardPath);
            if (dashboardFile) {
                const leaf = this.app.workspace.getLeaf(false);
                await leaf.openFile(dashboardFile);
            }
        } catch (error) {
            console.error('통합 대시보드 생성 오류:', error);
            new Notice('❌ 통합 대시보드 생성에 실패했습니다.');
        }

    async loadAllQuestions() {
        const files = this.app.vault.getMarkdownFiles()
            .filter(file => file.path.startsWith(this.settings.questionsFolder) && !file.path.includes('문제목록'));

        const questions = [];

        for (const file of files) {
            const content = await this.app.vault.read(file);
            const question = this.parseQuestionFile(content, file.path);
            if (question) {
                // 파일 수정 시간 추가
                question.mtime = file.stat.mtime;
                questions.push(question);
            }
        }

        this.settings.stats.totalQuestions = questions.length;
        await this.saveSettings();

        return questions;
    }

    parseQuestionFile(content, filePath) {
        try {
            const lines = content.split('\n');
            let question = {
                filePath: filePath,
                wrongCount: 0,
                correctCount: 0,
                bookmarked: false,
                lastAttempt: null
            };
            let section = '';

            for (let line of lines) {
                line = line.trim();
                
                if (line.startsWith('# ')) {
                    question.title = line.substring(2);
                } else if (line.startsWith('## 한자')) {
                    section = 'hanzi';
                } else if (line.startsWith('## 번호')) {
                    section = 'number';
                } else if (line.startsWith('## 폴더')) {
                    section = 'folder';
                } else if (line.startsWith('## 문제')) {
                    section = 'question';
                } else if (line.startsWith('## 선택지')) {
                    section = 'options';
                    question.options = [];
                } else if (line.startsWith('## 정답')) {
                    section = 'answer';
                } else if (line.startsWith('## 힌트')) {
                    section = 'hint';
                } else if (line.startsWith('## 노트')) {
                    section = 'note';
                } else if (line.startsWith('## 난이도')) {
                    section = 'difficulty';
                } else if (line.startsWith('## 이미지')) {
                    section = 'image';
                } else if (line.startsWith('## 통계')) {
                    section = 'stats';
                } else if (line && !line.startsWith('#') && !line.startsWith('---')) {
                    if (section === 'hanzi') question.hanzi = line;
                    else if (section === 'number') question.number = line;
                    else if (section === 'folder') question.folder = line;
                    else if (section === 'question') {
                        question.question = question.question ? question.question + ' ' + line : line;
                    } else if (section === 'options' && line.startsWith('-')) {
                        question.options.push(line.substring(2).trim());
                    } else if (section === 'answer') question.answer = parseInt(line) || 0;
                    else if (section === 'hint') {
                        question.hint = question.hint ? question.hint + ' ' + line : line;
                    } else if (section === 'note') {
                        question.note = question.note ? question.note + ' ' + line : line;
                    } else if (section === 'difficulty') {
                        question.difficulty = line;
                    } else if (section === 'image' && line.includes('[[')) {
                        question.image = line;
                    } else if (section === 'stats') {
                        if (line.includes('오답:')) {
                            const match = line.match(/\d+/);
                            question.wrongCount = match ? parseInt(match[0]) : 0;
                        } else if (line.includes('정답:')) {
                            const match = line.match(/\d+/);
                            question.correctCount = match ? parseInt(match[0]) : 0;
                        } else if (line.includes('북마크:')) {
                            question.bookmarked = line.includes('✅');
                        } else if (line.includes('마지막 시도:')) {
                            const parts = line.split(':');
                            question.lastAttempt = parts.length > 1 ? parts.slice(1).join(':').trim() : null;
                        }
                    }
                }
            }

            return question.hanzi ? question : null;
        } catch (e) {
            console.error('문제 파싱 오류:', e);
            return null;
        }
    }

    async saveQuestion(question, isNew = true) {
        const folder = question.folder || '기본';
        const folderPath = `${this.settings.questionsFolder}/${folder}`;
        
        // 폴더가 없으면 생성
        const folderExists = await this.app.vault.adapter.exists(folderPath);
        if (!folderExists) {
            await this.app.vault.createFolder(folderPath);
        }
        
        const fileName = `${folderPath}/${question.number}_${question.hanzi}.md`;
        const content = this.generateQuestionContent(question);
        
        const file = this.app.vault.getAbstractFileByPath(fileName);
        if (file) {
            await this.app.vault.modify(file, content);
        } else {
            await this.app.vault.create(fileName, content);
        }
        
        // 폴더별 문제목록 템플릿 업데이트
        await this.updateQuestionListTemplate(folder);
        
        if (isNew) {
            new Notice(`✅ 문제 "${question.hanzi}" 저장됨 (폴더: ${folder})`);
        }
    }

    generateQuestionContent(question) {
        return `# ${question.title || question.hanzi + ' 문제'}

## 한자
${question.hanzi}

## 번호
${question.number}

## 폴더
${question.folder || '기본'}

## 문제
${question.question}

## 선택지
${question.options.map((opt) => `- ${opt}`).join('\n')}

## 정답
${question.answer}

## 힌트
${question.hint || ''}

## 노트
${question.note || ''}

## 난이도
${question.difficulty || '보통'}

## 이미지
${question.image || ''}

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

        if (isCorrect) {
            this.settings.stats.totalCorrect++;
        } else {
            this.settings.stats.totalWrong++;
            // 오답 목록 템플릿 업데이트
            await this.updateWrongAnswerListTemplate();
        }
        this.settings.stats.totalAttempts++;
        this.settings.stats.lastStudyDate = new Date().toISOString();
        
        const today = new Date().toLocaleDateString('ko-KR');
        const todayRecord = this.settings.stats.studyHistory.find(h => h.date === today);
        if (todayRecord) {
            if (isCorrect) todayRecord.correct++;
            else todayRecord.wrong++;
        } else {
            this.settings.stats.studyHistory.push({
                date: today,
                correct: isCorrect ? 1 : 0,
                wrong: isCorrect ? 0 : 1
            });
        }

        await this.saveSettings();
    }

    async toggleBookmark(question) {
        const file = this.app.vault.getAbstractFileByPath(question.filePath);
        if (!file) return;

        const content = await this.app.vault.read(file);
        const updatedQuestion = this.parseQuestionFile(content, question.filePath);
        
        if (updatedQuestion) {
            updatedQuestion.bookmarked = !updatedQuestion.bookmarked;
            await this.saveQuestion(updatedQuestion, false);
            
            const change = updatedQuestion.bookmarked ? 1 : -1;
            this.settings.stats.bookmarkedCount = Math.max(0, (this.settings.stats.bookmarkedCount || 0) + change);
            await this.saveSettings();
            
            // 북마크 목록 템플릿 업데이트
            await this.updateBookmarkListTemplate();
            
            new Notice(updatedQuestion.bookmarked ? '⭐ 북마크 추가됨' : '북마크 제거됨');
        }
    }

    async updateQuestionListTemplate(folder) {
        const folderPath = `${this.settings.questionsFolder}/${folder}`;
        const templatePath = `${folderPath}/📋 ${folder} 문제목록.md`;
        
        const template = `# 📋 ${folder} 문제목록

> 이 파일은 자동으로 생성되며, DataView 플러그인이 설치되어 있어야 정상 작동합니다.

## 📊 통계

\`\`\`dataview
TABLE WITHOUT ID
  length(rows) as "총 문제 수",
  length(filter(rows, (r) => r.bookmarked = true)) as "북마크",
  length(filter(rows, (r) => r.wrongCount > 0)) as "오답 있음"
FROM "${folderPath}"
WHERE file.name != this.file.name
\`\`\`

## 📚 전체 문제 목록

\`\`\`dataview
TABLE
  hanzi as "한자",
  difficulty as "난이도",
  correctCount as "정답",
  wrongCount as "오답",
  choice(bookmarked, "⭐", "") as "북마크"
FROM "${folderPath}"
WHERE file.name != this.file.name
SORT wrongCount DESC, file.name ASC
\`\`\`

## ⭐ 북마크 문제

\`\`\`dataview
TABLE
  hanzi as "한자",
  question as "문제",
  difficulty as "난이도"
FROM "${folderPath}"
WHERE bookmarked = true AND file.name != this.file.name
SORT file.name ASC
\`\`\`

## ❌ 오답 많은 문제

\`\`\`dataview
TABLE
  hanzi as "한자",
  question as "문제",
  wrongCount as "오답 횟수",
  correctCount as "정답 횟수"
FROM "${folderPath}"
WHERE wrongCount > 0 AND file.name != this.file.name
SORT wrongCount DESC
LIMIT 10
\`\`\`

---
마지막 업데이트: ${new Date().toLocaleString('ko-KR')}
`;

        try {
            const file = this.app.vault.getAbstractFileByPath(templatePath);
            if (file) {
                await this.app.vault.modify(file, template);
            } else {
                await this.app.vault.create(templatePath, template);
            }
        } catch (error) {
            console.error('문제목록 템플릿 업데이트 오류:', error);
        }
    }

    async updateBookmarkListTemplate() {
        const templatePath = `${this.settings.quizFolder}/⭐ 북마크 목록.md`;
        
        const template = `# ⭐ 북마크 목록

> 북마크한 중요 문제들을 모아서 확인할 수 있습니다.

## 📊 북마크 통계

\`\`\`dataview
TABLE WITHOUT ID
  length(rows) as "총 북마크",
  length(filter(rows, (r) => r.difficulty = "쉬움")) as "쉬움",
  length(filter(rows, (r) => r.difficulty = "보통")) as "보통",
  length(filter(rows, (r) => r.difficulty = "어려움")) as "어려움"
FROM "${this.settings.questionsFolder}"
WHERE bookmarked = true
\`\`\`

## 📂 폴더별 북마크

\`\`\`dataview
TABLE
  folder as "폴더",
  hanzi as "한자",
  question as "문제",
  difficulty as "난이도",
  wrongCount as "오답"
FROM "${this.settings.questionsFolder}"
WHERE bookmarked = true
SORT folder ASC, wrongCount DESC
\`\`\`

## 🎯 난이도별 북마크

### 😰 어려움
\`\`\`dataview
TABLE
  hanzi as "한자",
  question as "문제",
  folder as "폴더",
  wrongCount as "오답"
FROM "${this.settings.questionsFolder}"
WHERE bookmarked = true AND difficulty = "어려움"
SORT wrongCount DESC
\`\`\`

### 😐 보통
\`\`\`dataview
TABLE
  hanzi as "한자",
  question as "문제",
  folder as "폴더"
FROM "${this.settings.questionsFolder}"
WHERE bookmarked = true AND difficulty = "보통"
\`\`\`

### 😊 쉬움
\`\`\`dataview
TABLE
  hanzi as "한자",
  question as "문제",
  folder as "폴더"
FROM "${this.settings.questionsFolder}"
WHERE bookmarked = true AND difficulty = "쉬움"
\`\`\`

---
마지막 업데이트: ${new Date().toLocaleString('ko-KR')}
`;

        try {
            const file = this.app.vault.getAbstractFileByPath(templatePath);
            if (file) {
                await this.app.vault.modify(file, template);
            } else {
                await this.app.vault.create(templatePath, template);
            }
        } catch (error) {
            console.error('북마크 목록 템플릿 업데이트 오류:', error);
        }
    }

    async updateWrongAnswerListTemplate() {
        const templatePath = `${this.settings.quizFolder}/❌ 오답 목록.md`;
        
        const template = `# ❌ 오답 목록

> 틀린 문제들을 모아서 복습할 수 있습니다.

## 📊 오답 통계

\`\`\`dataview
TABLE WITHOUT ID
  length(rows) as "오답 기록 수",
  length(rows.file.folder) as "문제 종류"
FROM "${this.settings.wrongAnswersFolder}"
\`\`\`

## 📅 최근 오답 (최근 10개)

\`\`\`dataview
TABLE
  file.name as "파일명",
  file.mtime as "날짜"
FROM "${this.settings.wrongAnswersFolder}"
SORT file.mtime DESC
LIMIT 10
\`\`\`

## 🔥 자주 틀리는 문제

\`\`\`dataview
TABLE
  hanzi as "한자",
  question as "문제",
  wrongCount as "오답 횟수",
  difficulty as "난이도",
  folder as "폴더"
FROM "${this.settings.questionsFolder}"
WHERE wrongCount > 0
SORT wrongCount DESC
LIMIT 20
\`\`\`

## 📂 폴더별 오답률

\`\`\`dataview
TABLE
  folder as "폴더",
  hanzi as "한자",
  wrongCount as "오답",
  correctCount as "정답",
  round((wrongCount / (wrongCount + correctCount)) * 100, 1) + "%" as "오답률"
FROM "${this.settings.questionsFolder}"
WHERE wrongCount > 0
SORT wrongCount DESC
\`\`\`

---
마지막 업데이트: ${new Date().toLocaleString('ko-KR')}
`;

        try {
            const file = this.app.vault.getAbstractFileByPath(templatePath);
            if (file) {
                await this.app.vault.modify(file, template);
            } else {
                await this.app.vault.create(templatePath, template);
            }
        } catch (error) {
            console.error('오답 목록 템플릿 업데이트 오류:', error);
        }
    }

    async viewQuestionList() {
        const questions = await this.loadAllQuestions();
        
        if (questions.length === 0) {
            new Notice('저장된 문제가 없습니다.');
            return;
        }

        const easyQuestions = questions.filter(q => q.difficulty === '쉬움');
        const normalQuestions = questions.filter(q => q.difficulty === '보통');
        const hardQuestions = questions.filter(q => q.difficulty === '어려움');
        const bookmarkedQuestions = questions.filter(q => q.bookmarked);
        const wrongQuestions = questions.filter(q => (q.wrongCount || 0) > 0).sort((a, b) => b.wrongCount - a.wrongCount);

        // 폴더별 분류
        const folders = this.settings.questionFolders || ['기본'];
        const folderSections = folders.map(folder => {
            const folderQuestions = questions.filter(q => (q.folder || '기본') === folder);
            if (folderQuestions.length === 0) return '';
            
            return `### 📁 ${folder} (${folderQuestions.length}개)
${folderQuestions.map(q => `- ${q.number}. ${q.hanzi} - ${q.question} ${q.bookmarked ? '⭐' : ''}`).join('\n')}`;
        }).filter(s => s).join('\n\n');

        const listContent = `# 📚 한자 문제 목록

전체 문제 수: **${questions.length}**개

## 📊 난이도별 분포
- 쉬움: ${easyQuestions.length}개
- 보통: ${normalQuestions.length}개
- 어려움: ${hardQuestions.length}개
- 북마크: ${bookmarkedQuestions.length}개

## 📂 폴더별 문제
${folderSections}

## ⭐ 북마크된 문제
${bookmarkedQuestions.length > 0 ? bookmarkedQuestions.map(q => `- ${q.number}. ${q.hanzi} - ${q.question} (${q.folder || '기본'})`).join('\n') : '없음'}

## ❌ 오답이 많은 문제 TOP 10
${wrongQuestions.length > 0 ? wrongQuestions.slice(0, 10).map(q => `- ${q.number}. ${q.hanzi} (오답 ${q.wrongCount}회, ${q.folder || '기본'})`).join('\n') : '없음'}

---
생성일: ${new Date().toLocaleString('ko-KR')}
`;

        const listPath = `${this.settings.quizFolder}/문제목록.md`;
        const file = this.app.vault.getAbstractFileByPath(listPath);
        
        if (file) {
            await this.app.vault.modify(file, listContent);
        } else {
            await this.app.vault.create(listPath, listContent);
        }

        const leaf = this.app.workspace.getLeaf(false);
        await leaf.openFile(this.app.vault.getAbstractFileByPath(listPath));
    }

    async viewStatistics() {
        const stats = this.settings.stats;
        const questions = await this.loadAllQuestions();
        
        const totalAttempts = stats.totalAttempts || 0;
        const totalCorrect = stats.totalCorrect || 0;
        const totalWrong = stats.totalWrong || 0;
        const accuracy = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;

        const recentHistory = stats.studyHistory.slice(-7);

        const statsContent = `# 📈 학습 통계

## 전체 통계
- 📚 총 문제 수: **${questions.length}**개
- 🎯 총 시도 횟수: **${totalAttempts}**회
- ✅ 정답: **${totalCorrect}**회
- ❌ 오답: **${totalWrong}**회
- 📊 정답률: **${accuracy}%**
- ⭐ 북마크: **${stats.bookmarkedCount || 0}**개
- 📅 마지막 학습: ${stats.lastStudyDate ? new Date(stats.lastStudyDate).toLocaleString('ko-KR') : '없음'}

## 📅 최근 7일 학습 기록
${recentHistory.length > 0 ? recentHistory.map(h => `- ${h.date}: 정답 ${h.correct}개, 오답 ${h.wrong}개`).join('\n') : '학습 기록이 없습니다.'}

---
생성일: ${new Date().toLocaleString('ko-KR')}
`;

        const statsPath = `${this.settings.quizFolder}/학습통계.md`;
        const file = this.app.vault.getAbstractFileByPath(statsPath);
        
        if (file) {
            await this.app.vault.modify(file, statsContent);
        } else {
            await this.app.vault.create(statsPath, statsContent);
        }

        const leaf = this.app.workspace.getLeaf(false);
        await leaf.openFile(this.app.vault.getAbstractFileByPath(statsPath));
    }

    async saveQuizResult(result) {
        const timestamp = new Date().getTime();
        const fileName = `${this.settings.resultsFolder}/퀴즈결과_${timestamp}.md`;
        
        const content = `# 🎯 퀴즈 결과

## 📊 점수
- **정답**: ${result.correct}개
- **오답**: ${result.incorrect}개
- **총 문제**: ${result.total}개
- **정답률**: ${result.percentage}%

## 📝 상세 결과
${result.details.map((d, idx) => `${idx + 1}. ${d.hanzi} - ${d.isCorrect ? '✅' : '❌'} ${d.question}`).join('\n')}

## 📌 복습이 필요한 한자
${result.details.filter(d => !d.isCorrect).map(d => `- ${d.hanzi}`).join('\n') || '없음'}

---
날짜: ${new Date().toLocaleString('ko-KR')}
`;

        await this.app.vault.create(fileName, content);
        const leaf = this.app.workspace.getLeaf(false);
        await leaf.openFile(this.app.vault.getAbstractFileByPath(fileName));
        
        new Notice('✅ 퀴즈 결과가 저장되었습니다!');
    }

    onunload() {
        console.log('Hanzi Quiz 플러그인 언로드됨');
    }
}
// Part 2: Modal Classes

class DashboardModal extends Modal {
    constructor(app, plugin) {
        super(app);
        this.plugin = plugin;
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('hanzi-quiz-dashboard');

        const header = contentEl.createDiv({ cls: 'dashboard-header' });
        header.createEl('h1', { text: '🏆 한자 퀴즈 대시보드' });

        const stats = this.plugin.settings.stats;
        const questions = await this.plugin.loadAllQuestions();

        // 통계 카드
        const statsGrid = contentEl.createDiv({ cls: 'stats-grid' });
        
        const createStatCard = (icon, label, value, color) => {
            const card = statsGrid.createDiv({ cls: 'stat-card' });
            card.style.borderLeft = `4px solid ${color}`;
            card.createEl('div', { text: icon, cls: 'stat-icon' });
            card.createEl('div', { text: value, cls: 'stat-value' });
            card.createEl('div', { text: label, cls: 'stat-label' });
        };

        createStatCard('📚', '총 문제 수', `${questions.length}개`, '#2196f3');
        createStatCard('🎯', '시도 횟수', `${stats.totalAttempts || 0}회`, '#4caf50');
        createStatCard('✅', '정답률', `${stats.totalAttempts > 0 ? Math.round((stats.totalCorrect / stats.totalAttempts) * 100) : 0}%`, '#ff9800');
        createStatCard('⭐', '북마크', `${stats.bookmarkedCount || 0}개`, '#f44336');

        // 빠른 작업
        const actionsSection = contentEl.createDiv({ cls: 'actions-section' });
        actionsSection.createEl('h2', { text: '🚀 빠른 작업' });

        const actionsGrid = actionsSection.createDiv({ cls: 'actions-grid' });

        const actions = [
            { icon: '🎯', text: '전체 퀴즈', callback: () => { this.close(); this.plugin.startQuiz(); } },
            { icon: '😊', text: '쉬움 퀴즈', callback: () => { this.close(); this.plugin.startQuiz('쉬움'); } },
            { icon: '😐', text: '보통 퀴즈', callback: () => { this.close(); this.plugin.startQuiz('보통'); } },
            { icon: '😰', text: '어려움 퀴즈', callback: () => { this.close(); this.plugin.startQuiz('어려움'); } },
            { icon: '⭐', text: '북마크 퀴즈', callback: () => { this.close(); this.plugin.startBookmarkQuiz(); } },
            { icon: '❌', text: '오답 복습', callback: () => { this.close(); this.plugin.startWrongAnswerQuiz(); } },
            { icon: '📝', text: '문제 만들기', callback: () => { this.close(); new HanziQuestionModal(this.app, this.plugin).open(); } },
            { icon: '📋', text: '문제 목록', callback: () => { this.close(); this.plugin.viewQuestionList(); } },
            { icon: '⭐', text: '북마크 목록', callback: () => { this.close(); this.plugin.viewBookmarkList(); } },
            { icon: '❌', text: '오답 목록', callback: () => { this.close(); this.plugin.viewWrongAnswerList(); } },
            { icon: '📈', text: '학습 통계', callback: () => { this.close(); this.plugin.viewStatistics(); } },
            { icon: '📂', text: '폴더 관리', callback: () => { this.close(); new FolderManagementModal(this.app, this.plugin).open(); } }
        ];

        actions.forEach(action => {
            const btn = actionsGrid.createEl('button', { 
                text: `${action.icon} ${action.text}`,
                cls: 'action-button'
            });
            btn.addEventListener('click', action.callback);
        });

        // 최근 학습 기록
        if (stats.studyHistory && stats.studyHistory.length > 0) {
            const historySection = contentEl.createDiv({ cls: 'history-section' });
            historySection.createEl('h2', { text: '📅 최근 학습 기록' });

            const recentHistory = stats.studyHistory.slice(-5).reverse();
            const historyList = historySection.createEl('ul', { cls: 'history-list' });

            recentHistory.forEach(h => {
                const item = historyList.createEl('li');
                item.innerHTML = `<strong>${h.date}</strong> - 정답 ${h.correct}개, 오답 ${h.wrong}개`;
            });
        }

        // 오답 많은 문제
        const wrongQuestions = questions.filter(q => q.wrongCount > 0)
            .sort((a, b) => b.wrongCount - a.wrongCount)
            .slice(0, 5);

        if (wrongQuestions.length > 0) {
            const wrongSection = contentEl.createDiv({ cls: 'wrong-section' });
            wrongSection.createEl('h2', { text: '⚠️ 오답이 많은 문제 TOP 5' });

            const wrongList = wrongSection.createEl('ul', { cls: 'wrong-list' });
            wrongQuestions.forEach(q => {
                const item = wrongList.createEl('li');
                item.innerHTML = `<strong>${q.hanzi}</strong> - 오답 ${q.wrongCount}회`;
            });
        }

        // 폴더별 퀴즈
        const foldersSection = contentEl.createDiv({ cls: 'folders-quiz-section' });
        foldersSection.createEl('h2', { text: '📂 폴더별 퀴즈' });

        const foldersGrid = foldersSection.createDiv({ cls: 'folders-grid' });
        
        const folders = this.plugin.settings.questionFolders || ['기본'];
        for (const folder of folders) {
            const folderCard = foldersGrid.createDiv({ cls: 'folder-card' });
            
            const folderHeader = folderCard.createDiv({ cls: 'folder-header' });
            folderHeader.createEl('h3', { text: `📁 ${folder}` });
            
            // 폴더 문제 개수
            const folderQuestions = questions.filter(q => (q.folder || '기본') === folder);
            const folderStats = folderCard.createDiv({ cls: 'folder-stats' });
            folderStats.innerHTML = `문제 수: <strong>${folderQuestions.length}개</strong>`;
            
            const folderActions = folderCard.createDiv({ cls: 'folder-actions' });
            folderActions.style.display = 'flex';
            folderActions.style.gap = '5px';
            folderActions.style.marginTop = '10px';
            
            const quizBtn = folderActions.createEl('button', { 
                text: '🎯 퀴즈',
                cls: 'folder-action-btn'
            });
            quizBtn.addEventListener('click', () => {
                this.close();
                this.plugin.startQuiz(null, false, folder);
            });
            
            const addBtn = folderActions.createEl('button', { 
                text: '➕ 문제',
                cls: 'folder-action-btn'
            });
            addBtn.addEventListener('click', () => {
                this.close();
                const modal = new HanziQuestionModal(this.app, this.plugin);
                modal.question.folder = folder;
                modal.open();
            });

            const listBtn = folderActions.createEl('button', { 
                text: '📋 목록',
                cls: 'folder-action-btn'
            });
            listBtn.addEventListener('click', async () => {
                this.close();
                await this.plugin.viewFolderQuestionList(folder);
            });
        }

        // 최근 수정한 파일
        const recentSection = contentEl.createDiv({ cls: 'recent-section' });
        recentSection.createEl('h2', { text: '🕒 최근 수정한 문제' });

        const recentFiles = this.getRecentQuestionFiles(questions);
        if (recentFiles.length > 0) {
            const recentList = recentSection.createEl('ul', { cls: 'recent-list' });
            recentFiles.slice(0, 5).forEach(q => {
                const item = recentList.createEl('li');
                const timeAgo = this.getTimeAgo(q.mtime);
                item.innerHTML = `<strong>${q.hanzi}</strong> - ${q.question.substring(0, 30)}... <span style="color: var(--text-muted); font-size: 12px;">(${timeAgo})</span>`;
                item.style.cursor = 'pointer';
                item.addEventListener('click', async () => {
                    this.close();
                    const file = this.app.vault.getAbstractFileByPath(q.filePath);
                    if (file) {
                        const leaf = this.app.workspace.getLeaf(false);
                        await leaf.openFile(file);
                    }
                });
            });
        } else {
            recentSection.createEl('p', { text: '최근 수정한 문제가 없습니다.' });
        }

        this.addStyles();
    }

    getRecentQuestionFiles(questions) {
        return questions
            .filter(q => q.mtime)
            .sort((a, b) => b.mtime - a.mtime);
    }

    getTimeAgo(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 60) return `${minutes}분 전`;
        if (hours < 24) return `${hours}시간 전`;
        return `${days}일 전`;
    }

    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .hanzi-quiz-dashboard {
                padding: 20px;
            }
            .dashboard-header h1 {
                text-align: center;
                margin-bottom: 30px;
            }
            .stats-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                gap: 15px;
                margin-bottom: 30px;
            }
            .stat-card {
                padding: 20px;
                background: var(--background-secondary);
                border-radius: 8px;
                text-align: center;
            }
            .stat-icon {
                font-size: 32px;
                margin-bottom: 10px;
            }
            .stat-value {
                font-size: 24px;
                font-weight: bold;
                margin-bottom: 5px;
            }
            .stat-label {
                font-size: 14px;
                color: var(--text-muted);
            }
            .actions-section, .history-section, .wrong-section, .folders-quiz-section {
                margin-bottom: 30px;
            }
            .actions-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                gap: 10px;
            }
            .action-button {
                padding: 15px;
                font-size: 14px;
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.2s;
            }
            .action-button:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 8px rgba(0,0,0,0.1);
            }
            .history-list, .wrong-list {
                list-style: none;
                padding: 0;
            }
            .history-list li, .wrong-list li {
                padding: 10px;
                margin-bottom: 5px;
                background: var(--background-secondary);
                border-radius: 5px;
            }
            .folders-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 15px;
            }
            .folder-card {
                padding: 15px;
                background: var(--background-secondary);
                border-radius: 8px;
                border: 2px solid var(--background-modifier-border);
                transition: all 0.2s;
            }
            .folder-card:hover {
                border-color: var(--interactive-accent);
                transform: translateY(-2px);
                box-shadow: 0 4px 8px rgba(0,0,0,0.1);
            }
            .folder-header h3 {
                margin: 0 0 10px 0;
                font-size: 18px;
            }
            .folder-stats {
                margin-bottom: 10px;
                color: var(--text-muted);
            }
            .folder-action-btn {
                flex: 1;
                padding: 8px;
                font-size: 13px;
                border-radius: 5px;
                cursor: pointer;
                transition: all 0.2s;
            }
            .folder-action-btn:hover {
                transform: scale(1.05);
            }
            .recent-section {
                margin-bottom: 30px;
            }
            .recent-list {
                list-style: none;
                padding: 0;
            }
            .recent-list li {
                padding: 12px;
                margin-bottom: 5px;
                background: var(--background-secondary);
                border-radius: 5px;
                transition: all 0.2s;
            }
            .recent-list li:hover {
                background: var(--background-modifier-hover);
                transform: translateX(5px);
            }
        `;
        document.head.appendChild(style);
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

class HanziQuestionModal extends Modal {
    constructor(app, plugin, existingQuestion = null) {
        super(app);
        this.plugin = plugin;
        this.existingQuestion = existingQuestion;
        this.question = existingQuestion || {
            hanzi: '',
            number: '',
            question: '',
            options: ['', '', '', ''],
            answer: 0,
            hint: '',
            note: '',
            difficulty: '보통',
            image: '',
            wrongCount: 0,
            correctCount: 0,
            bookmarked: false
        };
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('hanzi-question-modal');

        contentEl.createEl('h2', { text: this.existingQuestion ? '✏️ 문제 수정' : '📝 새 문제 만들기' });

        const form = contentEl.createDiv({ cls: 'question-form' });

        // 한자
        new Setting(form)
            .setName('한자')
            .setDesc('학습할 한자를 입력하세요')
            .addText(text => text
                .setPlaceholder('예: 愛')
                .setValue(this.question.hanzi)
                .onChange(value => this.question.hanzi = value));

        // 번호
        new Setting(form)
            .setName('문제 번호')
            .setDesc('문제 번호를 입력하세요')
            .addText(text => text
                .setPlaceholder('예: 1')
                .setValue(this.question.number)
                .onChange(value => this.question.number = value));

        // 문제
        new Setting(form)
            .setName('문제')
            .setDesc('질문 내용을 입력하세요')
            .addTextArea(text => {
                text.setPlaceholder('예: 다음 한자의 뜻은?')
                    .setValue(this.question.question)
                    .onChange(value => this.question.question = value);
                text.inputEl.rows = 3;
                text.inputEl.style.width = '100%';
            });

        // 폴더 선택
        new Setting(form)
            .setName('폴더')
            .setDesc('문제를 저장할 폴더를 선택하세요')
            .addDropdown(dropdown => {
                const folders = this.plugin.settings.questionFolders || ['기본'];
                folders.forEach(folder => {
                    dropdown.addOption(folder, folder);
                });
                dropdown.setValue(this.question.folder || '기본')
                    .onChange(value => this.question.folder = value);
            });

        // 선택지
        contentEl.createEl('h3', { text: '선택지 (최소 1개)' });
        
        const optionsContainer = form.createDiv({ cls: 'options-container' });
        
        // 초기 선택지 개수 설정 (기존 문제면 그 개수, 신규면 4개)
        if (!this.question.options || this.question.options.length === 0) {
            this.question.options = ['', '', '', ''];
        }
        
        let renderOptions;
        let updateAnswerDropdown;
        
        renderOptions = () => {
            optionsContainer.empty();
            
            // 실제로 값이 있는 선택지만 표시
            const validOptionsCount = Math.max(1, this.question.options.filter(opt => opt && opt.trim()).length);
            const displayCount = Math.max(validOptionsCount, this.question.options.length);
            
            for (let i = 0; i < displayCount; i++) {
                const optionDiv = optionsContainer.createDiv({ cls: 'option-row' });
                optionDiv.style.display = 'flex';
                optionDiv.style.gap = '10px';
                optionDiv.style.alignItems = 'center';
                optionDiv.style.marginBottom = '10px';
                
                new Setting(optionDiv)
                    .setName(`선택지 ${i + 1}`)
                    .addText(text => text
                        .setPlaceholder(`선택지 ${i + 1} (선택)`)
                        .setValue(this.question.options[i] || '')
                        .onChange(value => {
                            this.question.options[i] = value;
                        }));
                
                // 삭제 버튼 (선택지가 2개 이상일 때만)
                if (this.question.options.filter(opt => opt && opt.trim()).length > 1) {
                    const deleteBtn = optionDiv.createEl('button', { 
                        text: '🗑️',
                        cls: 'delete-option-btn'
                    });
                    deleteBtn.style.padding = '5px 10px';
                    deleteBtn.addEventListener('click', () => {
                        this.question.options.splice(i, 1);
                        renderOptions();
                        updateAnswerDropdown();
                    });
                }
            }
            
            // 선택지 추가 버튼
            const addBtn = optionsContainer.createEl('button', { 
                text: '➕ 선택지 추가',
                cls: 'add-option-btn'
            });
            addBtn.style.marginTop = '10px';
            addBtn.addEventListener('click', () => {
                this.question.options.push('');
                renderOptions();
                updateAnswerDropdown();
            });
        };
        
        // 정답 드롭다운 먼저 생성
        const answerSetting = new Setting(form)
            .setName('정답')
            .setDesc('정답 번호를 선택하세요');
        
        updateAnswerDropdown = () => {
            answerSetting.clear();
            answerSetting.setName('정답').setDesc('정답 번호를 선택하세요');
            answerSetting.addDropdown(dropdown => {
                const validOptions = this.question.options.filter(opt => opt && opt.trim());
                if (validOptions.length === 0) {
                    dropdown.addOption('0', '선택지를 먼저 입력하세요');
                    dropdown.setValue('0');
                    dropdown.setDisabled(true);
                } else {
                    validOptions.forEach((opt, index) => {
                        dropdown.addOption(String(index), `선택지 ${index + 1}: ${opt.substring(0, 20)}${opt.length > 20 ? '...' : ''}`);
                    });
                    
                    // 정답 인덱스가 유효한지 확인
                    const currentAnswer = this.question.answer || 0;
                    const finalAnswer = currentAnswer >= validOptions.length ? 0 : currentAnswer;
                    this.question.answer = finalAnswer;
                    
                    dropdown.setValue(String(finalAnswer))
                        .onChange(value => {
                            this.question.answer = parseInt(value);
                        });
                }
            });
        };
        
        // 정답 드롭다운 초기화
        updateAnswerDropdown();
        
        // 선택지 렌더링
        renderOptions();

        // 난이도
        new Setting(form)
            .setName('난이도')
            .addDropdown(dropdown => dropdown
                .addOption('쉬움', '😊 쉬움')
                .addOption('보통', '😐 보통')
                .addOption('어려움', '😰 어려움')
                .setValue(this.question.difficulty || '보통')
                .onChange(value => this.question.difficulty = value));

        // 힌트
        new Setting(form)
            .setName('힌트 (선택)')
            .addTextArea(text => {
                text.setPlaceholder('틀렸을 때 보여줄 힌트')
                    .setValue(this.question.hint || '')
                    .onChange(value => this.question.hint = value);
                text.inputEl.rows = 2;
                text.inputEl.style.width = '100%';
            });

        // 노트
        new Setting(form)
            .setName('노트 (선택)')
            .addTextArea(text => {
                text.setPlaceholder('추가 설명이나 기억할 내용')
                    .setValue(this.question.note || '')
                    .onChange(value => this.question.note = value);
                text.inputEl.rows = 2;
                text.inputEl.style.width = '100%';
            });

        // 버튼
        const buttonContainer = contentEl.createDiv({ cls: 'button-container' });
        buttonContainer.style.display = 'flex';
        buttonContainer.style.gap = '10px';
        buttonContainer.style.justifyContent = 'flex-end';
        buttonContainer.style.marginTop = '20px';

        const saveBtn = buttonContainer.createEl('button', { 
            text: '💾 저장',
            cls: 'mod-cta'
        });
        saveBtn.addEventListener('click', async () => {
            if (this.validateQuestion()) {
                await this.plugin.saveQuestion(this.question, !this.existingQuestion);
                this.close();
            }
        });

        const cancelBtn = buttonContainer.createEl('button', { text: '❌ 취소' });
        cancelBtn.addEventListener('click', () => this.close());

        this.addStyles();
    }

    validateQuestion() {
        if (!this.question.hanzi) {
            new Notice('❌ 한자를 입력해주세요!');
            return false;
        }
        if (!this.question.number) {
            new Notice('❌ 문제 번호를 입력해주세요!');
            return false;
        }
        if (!this.question.question) {
            new Notice('❌ 문제를 입력해주세요!');
            return false;
        }
        
        // 유효한 선택지 필터링 (값이 있는 것만)
        const validOptions = this.question.options.filter(opt => opt && opt.trim());
        
        if (validOptions.length === 0) {
            new Notice('❌ 최소 1개의 선택지를 입력해주세요!');
            return false;
        }
        
        // 빈 선택지 제거
        this.question.options = validOptions;
        
        // 정답 인덱스 유효성 검사
        if (this.question.answer >= validOptions.length) {
            new Notice('❌ 정답이 유효한 선택지 범위를 벗어났습니다!');
            return false;
        }
        
        return true;
    }

    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .hanzi-question-modal {
                padding: 20px;
                max-width: 600px;
            }
            .question-form .setting-item {
                border: none;
                padding: 10px 0;
            }
        `;
        document.head.appendChild(style);
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

class FolderManagementModal extends Modal {
    constructor(app, plugin) {
        super(app);
        this.plugin = plugin;
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('folder-management-modal');

        contentEl.createEl('h2', { text: '📂 폴더 관리' });

        const desc = contentEl.createDiv({ cls: 'folder-desc' });
        desc.innerHTML = '문제를 폴더별로 분류하여 관리할 수 있습니다.';

        // 현재 폴더 목록
        const foldersSection = contentEl.createDiv({ cls: 'folders-section' });
        foldersSection.createEl('h3', { text: '현재 폴더' });

        const foldersList = foldersSection.createDiv({ cls: 'folders-list' });

        const folders = this.plugin.settings.questionFolders || ['기본'];
        
        folders.forEach((folder, index) => {
            const folderItem = foldersList.createDiv({ cls: 'folder-item' });
            folderItem.style.display = 'flex';
            folderItem.style.justifyContent = 'space-between';
            folderItem.style.alignItems = 'center';
            folderItem.style.padding = '10px';
            folderItem.style.marginBottom = '5px';
            folderItem.style.backgroundColor = 'var(--background-secondary)';
            folderItem.style.borderRadius = '5px';

            const folderInfo = folderItem.createDiv({ cls: 'folder-info' });
            folderInfo.style.flex = '1';
            
            const folderName = folderInfo.createEl('div', { text: `📁 ${folder}` });
            folderName.style.fontWeight = 'bold';
            folderName.style.marginBottom = '5px';

            const actions = folderItem.createDiv({ cls: 'folder-actions' });
            actions.style.display = 'flex';
            actions.style.gap = '5px';
            actions.style.flexWrap = 'wrap';

            // 문제 개수 표시
            this.getQuestionCountInFolder(folder).then(count => {
                const countBadge = folderInfo.createEl('span', { text: `${count}개 문제` });
                countBadge.style.fontSize = '12px';
                countBadge.style.color = 'var(--text-muted)';
            });

            // 퀴즈 시작 버튼
            const quizBtn = actions.createEl('button', { text: '🎯 퀴즈' });
            quizBtn.style.padding = '5px 10px';
            quizBtn.style.fontSize = '12px';
            quizBtn.addEventListener('click', async () => {
                this.close();
                await this.plugin.startQuiz(null, false, folder);
            });

            // 문제 추가 버튼
            const addBtn = actions.createEl('button', { text: '➕ 문제' });
            addBtn.style.padding = '5px 10px';
            addBtn.style.fontSize = '12px';
            addBtn.addEventListener('click', () => {
                this.close();
                const modal = new HanziQuestionModal(this.app, this.plugin);
                modal.question.folder = folder;
                modal.open();
            });

            // 삭제 버튼 (기본 폴더는 삭제 불가)
            if (folder !== '기본') {
                const deleteBtn = actions.createEl('button', { text: '🗑️ 삭제' });
                deleteBtn.style.padding = '5px 10px';
                deleteBtn.style.fontSize = '12px';
                deleteBtn.addEventListener('click', async () => {
                    const count = await this.getQuestionCountInFolder(folder);
                    if (count > 0) {
                        new Notice(`❌ 폴더에 ${count}개의 문제가 있어 삭제할 수 없습니다.`);
                        return;
                    }
                    
                    if (confirm(`"${folder}" 폴더를 삭제하시겠습니까?`)) {
                        this.plugin.settings.questionFolders = folders.filter(f => f !== folder);
                        await this.plugin.saveSettings();
                        
                        // 폴더 삭제
                        const folderPath = `${this.plugin.settings.questionsFolder}/${folder}`;
                        const folderExists = await this.app.vault.adapter.exists(folderPath);
                        if (folderExists) {
                            await this.app.vault.adapter.rmdir(folderPath, false);
                        }
                        
                        new Notice(`✅ "${folder}" 폴더가 삭제되었습니다.`);
                        this.onOpen(); // 새로고침
                    }
                });
            }
        });

        // 새 폴더 추가
        const addFolderSection = contentEl.createDiv({ cls: 'add-folder-section' });
        addFolderSection.style.marginTop = '20px';
        addFolderSection.createEl('h3', { text: '새 폴더 추가' });

        const inputContainer = addFolderSection.createDiv();
        inputContainer.style.display = 'flex';
        inputContainer.style.gap = '10px';
        inputContainer.style.alignItems = 'center';

        const folderInput = inputContainer.createEl('input', { type: 'text' });
        folderInput.placeholder = '폴더 이름 입력';
        folderInput.style.flex = '1';
        folderInput.style.padding = '8px';

        const addBtn = inputContainer.createEl('button', { text: '➕ 추가', cls: 'mod-cta' });
        addBtn.addEventListener('click', async () => {
            const folderName = folderInput.value.trim();
            
            if (!folderName) {
                new Notice('❌ 폴더 이름을 입력하세요!');
                return;
            }

            if (folders.includes(folderName)) {
                new Notice('❌ 이미 존재하는 폴더입니다!');
                return;
            }

            this.plugin.settings.questionFolders.push(folderName);
            await this.plugin.saveSettings();

            // 폴더 생성
            const folderPath = `${this.plugin.settings.questionsFolder}/${folderName}`;
            const folderExists = await this.app.vault.adapter.exists(folderPath);
            if (!folderExists) {
                await this.app.vault.createFolder(folderPath);
            }

            new Notice(`✅ "${folderName}" 폴더가 생성되었습니다!`);
            folderInput.value = '';
            this.onOpen(); // 새로고침
        });

        // 닫기 버튼
        const closeBtn = contentEl.createEl('button', { text: '✅ 완료' });
        closeBtn.style.marginTop = '20px';
        closeBtn.style.width = '100%';
        closeBtn.addEventListener('click', () => this.close());

        this.addStyles();
    }

    async getQuestionCountInFolder(folder) {
        const folderPath = `${this.plugin.settings.questionsFolder}/${folder}`;
        const folderExists = await this.app.vault.adapter.exists(folderPath);
        
        if (!folderExists) return 0;

        const files = this.app.vault.getMarkdownFiles();
        const questionFiles = files.filter(f => f.path.startsWith(folderPath) && f.path.endsWith('.md'));
        return questionFiles.length;
    }

    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .folder-management-modal {
                padding: 20px;
                max-width: 500px;
            }
            .folder-desc {
                margin-bottom: 20px;
                padding: 10px;
                background: var(--background-secondary);
                border-radius: 5px;
            }
            .folders-section {
                margin-bottom: 20px;
            }
            .folder-item:hover {
                background: var(--background-modifier-hover) !important;
            }
        `;
        document.head.appendChild(style);
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

class QuizPlayModal extends Modal {
    constructor(app, plugin, questions, wrongAnswersOnly = false, difficulty = null) {
        super(app);
        this.plugin = plugin;
        this.allQuestions = questions;
        this.wrongAnswersOnly = wrongAnswersOnly;
        this.difficulty = difficulty;
        this.currentIndex = 0;
        this.score = 0;
        this.results = [];
        this.startTime = Date.now();
        this.timeRemaining = this.plugin.settings.timerPerQuestion;
        this.timerInterval = null;

        // 문제 섞기
        if (this.plugin.settings.shuffleQuestions) {
            this.questions = this.shuffleArray([...this.allQuestions]);
        } else {
            this.questions = [...this.allQuestions];
        }
    }

    shuffleArray(array) {
        const newArray = [...array];
        for (let i = newArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
        }
        return newArray;
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.addClass('quiz-play-modal');

        this.showQuestion();
        this.addStyles();
    }

    showQuestion() {
        const { contentEl } = this;
        contentEl.empty();

        if (this.currentIndex >= this.questions.length) {
            this.showResults();
            return;
        }

        const question = this.questions[this.currentIndex];

        // 헤더
        const header = contentEl.createDiv({ cls: 'quiz-header' });
        
        const progress = header.createDiv({ cls: 'quiz-progress' });
        progress.innerHTML = `<strong>문제 ${this.currentIndex + 1}/${this.questions.length}</strong> | 점수: ${this.score}`;

        if (this.plugin.settings.enableTimer) {
            this.timerEl = header.createDiv({ cls: 'quiz-timer' });
            this.updateTimer();
            this.startTimer();
        }

        // 난이도 뱃지
        const difficultyBadge = header.createDiv({ cls: 'difficulty-badge' });
        difficultyBadge.setText(question.difficulty || '보통');
        difficultyBadge.style.backgroundColor = 
            question.difficulty === '쉬움' ? '#4caf50' :
            question.difficulty === '어려움' ? '#f44336' : '#ff9800';

        // 한자 표시
        const hanziDisplay = contentEl.createDiv({ cls: 'hanzi-display' });
        hanziDisplay.createEl('div', { text: question.hanzi, cls: 'hanzi-character' });

        // 이미지 (있으면)
        if (question.image) {
            const imgContainer = contentEl.createDiv({ cls: 'image-container' });
            imgContainer.innerHTML = question.image;
        }

        // 문제
        const questionText = contentEl.createDiv({ cls: 'question-text' });
        questionText.createEl('h3', { text: question.question });

        // 선택지
        const optionsContainer = contentEl.createDiv({ cls: 'options-container' });
        
        let options = [...question.options];
        if (this.plugin.settings.shuffleOptions) {
            // 정답 인덱스를 추적하면서 섞기
            const correctAnswer = question.options[question.answer];
            options = this.shuffleArray(options);
            question.shuffledAnswerIndex = options.indexOf(correctAnswer);
        } else {
            question.shuffledAnswerIndex = question.answer;
        }

        options.forEach((option, index) => {
            const optionBtn = optionsContainer.createEl('button', {
                text: `${index + 1}. ${option}`,
                cls: 'option-button'
            });
            optionBtn.addEventListener('click', () => this.selectAnswer(index, question));
        });

        // 북마크 버튼
        const actionBar = contentEl.createDiv({ cls: 'action-bar' });
        const bookmarkBtn = actionBar.createEl('button', {
            text: question.bookmarked ? '⭐ 북마크됨' : '☆ 북마크',
            cls: 'bookmark-button'
        });
        bookmarkBtn.addEventListener('click', async () => {
            await this.plugin.toggleBookmark(question);
            bookmarkBtn.setText(question.bookmarked ? '⭐ 북마크됨' : '☆ 북마크');
        });

        // 종료 버튼
        const quitBtn = actionBar.createEl('button', { text: '❌ 종료' });
        quitBtn.addEventListener('click', () => {
            if (confirm('퀴즈를 종료하시겠습니까?')) {
                this.stopTimer();
                this.close();
            }
        });
    }

    startTimer() {
        if (!this.plugin.settings.enableTimer) return;

        this.timeRemaining = this.plugin.settings.timerPerQuestion;
        this.updateTimer();

        this.timerInterval = setInterval(() => {
            this.timeRemaining--;
            this.updateTimer();

            if (this.timeRemaining <= 0) {
                this.stopTimer();
                this.selectAnswer(-1, this.questions[this.currentIndex]); // 시간 초과 = 오답
            }
        }, 1000);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    updateTimer() {
        if (this.timerEl) {
            this.timerEl.setText(`⏱️ ${this.timeRemaining}초`);
            if (this.timeRemaining <= 5) {
                this.timerEl.style.color = '#f44336';
                this.timerEl.style.fontWeight = 'bold';
            }
        }
    }

    async selectAnswer(selectedIndex, question) {
        this.stopTimer();

        const isCorrect = selectedIndex === question.shuffledAnswerIndex;
        
        if (isCorrect) {
            this.score++;
        }

        this.results.push({
            hanzi: question.hanzi,
            question: question.question,
            isCorrect: isCorrect,
            selectedAnswer: selectedIndex >= 0 ? question.options[selectedIndex] : '시간 초과',
            correctAnswer: question.options[question.answer]
        });

        await this.plugin.updateQuestionStats(question, isCorrect);

        // 피드백 표시
        await this.showFeedback(isCorrect, question);
    }

    async showFeedback(isCorrect, question) {
        const { contentEl } = this;
        
        const feedback = contentEl.createDiv({ cls: 'feedback-overlay' });
        feedback.style.position = 'fixed';
        feedback.style.top = '0';
        feedback.style.left = '0';
        feedback.style.right = '0';
        feedback.style.bottom = '0';
        feedback.style.backgroundColor = isCorrect ? 'rgba(76, 175, 80, 0.95)' : 'rgba(244, 67, 54, 0.95)';
        feedback.style.display = 'flex';
        feedback.style.flexDirection = 'column';
        feedback.style.alignItems = 'center';
        feedback.style.justifyContent = 'center';
        feedback.style.color = 'white';
        feedback.style.zIndex = '1000';

        const icon = feedback.createEl('div', { 
            text: isCorrect ? '✅' : '❌',
            cls: 'feedback-icon'
        });
        icon.style.fontSize = '80px';
        icon.style.marginBottom = '20px';

        const message = feedback.createEl('h2', { 
            text: isCorrect ? '정답입니다!' : '틀렸습니다!'
        });

        if (!isCorrect && question.hint && this.plugin.settings.showHintAfterWrong) {
            const hint = feedback.createEl('p', { text: `💡 힌트: ${question.hint}` });
            hint.style.fontSize = '18px';
            hint.style.marginTop = '20px';
            hint.style.padding = '15px';
            hint.style.backgroundColor = 'rgba(0,0,0,0.3)';
            hint.style.borderRadius = '8px';
        }

        if (!isCorrect) {
            const correctAnswerText = feedback.createEl('p', { 
                text: `정답: ${question.options[question.answer]}`
            });
            correctAnswerText.style.fontSize = '20px';
            correctAnswerText.style.marginTop = '10px';
            correctAnswerText.style.fontWeight = 'bold';
        }

        const nextBtn = feedback.createEl('button', { 
            text: '다음 문제 →',
            cls: 'next-button'
        });
        nextBtn.style.marginTop = '30px';
        nextBtn.style.padding = '15px 30px';
        nextBtn.style.fontSize = '18px';
        nextBtn.style.backgroundColor = 'white';
        nextBtn.style.color = isCorrect ? '#4caf50' : '#f44336';
        nextBtn.style.border = 'none';
        nextBtn.style.borderRadius = '25px';
        nextBtn.style.cursor = 'pointer';
        nextBtn.style.fontWeight = 'bold';

        nextBtn.addEventListener('click', () => {
            feedback.remove();
            this.currentIndex++;
            this.showQuestion();
        });

        // 2초 후 자동으로 다음 문제 (선택사항)
        setTimeout(() => {
            if (feedback.parentElement) {
                feedback.remove();
                this.currentIndex++;
                this.showQuestion();
            }
        }, 3000);
    }

    async showResults() {
        const { contentEl } = this;
        contentEl.empty();

        const endTime = Date.now();
        const totalTime = Math.round((endTime - this.startTime) / 1000);
        const percentage = Math.round((this.score / this.questions.length) * 100);

        const results = contentEl.createDiv({ cls: 'quiz-results' });
        
        results.createEl('h1', { text: '🎉 퀴즈 완료!' });

        // 점수 표시
        const scoreCard = results.createDiv({ cls: 'score-card' });
        scoreCard.innerHTML = `
            <div class="score-big">${this.score} / ${this.questions.length}</div>
            <div class="score-percentage">${percentage}%</div>
            <div class="score-time">소요 시간: ${totalTime}초</div>
        `;

        // 결과 저장
        const saveResult = {
            correct: this.score,
            incorrect: this.questions.length - this.score,
            total: this.questions.length,
            percentage: percentage,
            details: this.results,
            time: totalTime
        };

        await this.plugin.saveQuizResult(saveResult);

        // 상세 결과
        const detailsSection = results.createDiv({ cls: 'results-details' });
        detailsSection.createEl('h3', { text: '📋 상세 결과' });

        this.results.forEach((result, index) => {
            const item = detailsSection.createDiv({ cls: 'result-item' });
            item.innerHTML = `
                <span class="result-number">${index + 1}.</span>
                <span class="result-hanzi">${result.hanzi}</span>
                <span class="result-status">${result.isCorrect ? '✅' : '❌'}</span>
            `;
            if (!result.isCorrect) {
                item.style.backgroundColor = 'rgba(244, 67, 54, 0.1)';
            }
        });

        // 버튼
        const buttonContainer = results.createDiv({ cls: 'results-buttons' });
        
        const retryBtn = buttonContainer.createEl('button', { 
            text: '🔄 다시 풀기',
            cls: 'mod-cta'
        });
        retryBtn.addEventListener('click', () => {
            this.currentIndex = 0;
            this.score = 0;
            this.results = [];
            this.startTime = Date.now();
            this.questions = this.plugin.settings.shuffleQuestions ? 
                this.shuffleArray([...this.allQuestions]) : [...this.allQuestions];
            this.showQuestion();
        });

        const wrongBtn = buttonContainer.createEl('button', { text: '❌ 오답만 복습' });
        wrongBtn.addEventListener('click', async () => {
            this.close();
            await this.plugin.startWrongAnswerQuiz();
        });

        const closeBtn = buttonContainer.createEl('button', { text: '✅ 완료' });
        closeBtn.addEventListener('click', () => this.close());
    }

    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .quiz-play-modal {
                padding: 20px;
                max-width: 700px;
                margin: 0 auto;
            }
            .quiz-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 20px;
                padding-bottom: 15px;
                border-bottom: 2px solid var(--background-modifier-border);
            }
            .quiz-timer {
                font-size: 18px;
                font-weight: bold;
            }
            .difficulty-badge {
                padding: 5px 15px;
                border-radius: 15px;
                color: white;
                font-weight: bold;
                font-size: 14px;
            }
            .hanzi-display {
                text-align: center;
                margin: 30px 0;
            }
            .hanzi-character {
                font-size: 120px;
                font-weight: bold;
                color: var(--text-accent);
            }
            .question-text {
                text-align: center;
                margin-bottom: 30px;
            }
            .options-container {
                display: flex;
                flex-direction: column;
                gap: 10px;
                margin-bottom: 20px;
            }
            .option-button {
                padding: 15px 20px;
                font-size: 16px;
                text-align: left;
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.2s;
                background: var(--background-secondary);
            }
            .option-button:hover {
                transform: translateX(5px);
                background: var(--background-modifier-hover);
            }
            .action-bar {
                display: flex;
                justify-content: space-between;
                gap: 10px;
                margin-top: 20px;
            }
            .quiz-results {
                text-align: center;
            }
            .score-card {
                padding: 40px;
                background: var(--background-secondary);
                border-radius: 15px;
                margin: 30px 0;
            }
            .score-big {
                font-size: 60px;
                font-weight: bold;
                color: var(--interactive-accent);
            }
            .score-percentage {
                font-size: 40px;
                font-weight: bold;
                margin-top: 10px;
            }
            .score-time {
                font-size: 18px;
                color: var(--text-muted);
                margin-top: 10px;
            }
            .results-details {
                margin: 30px 0;
                text-align: left;
            }
                // Part 3: Quiz Results & Statistics

            .result-item {
                padding: 15px;
                margin-bottom: 8px;
                background: var(--background-secondary);
                border-radius: 8px;
                display: flex;
                align-items: center;
                gap: 15px;
            }
            .result-number {
                font-weight: bold;
                color: var(--text-muted);
            }
            .result-hanzi {
                font-size: 24px;
                font-weight: bold;
            }
            .results-buttons {
                display: flex;
                gap: 10px;
                justify-content: center;
                margin-top: 30px;
            }
        `;
        document.head.appendChild(style);
    }

    onClose() {
        this.stopTimer();
        const { contentEl } = this;
        contentEl.empty();
    }
}

class HanziQuizSettingTab extends PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h1', { text: '⚙️ 한자 퀴즈 설정' });

        // 폴더 설정
        containerEl.createEl('h2', { text: '📁 폴더 설정' });

        new Setting(containerEl)
            .setName('퀴즈 메인 폴더')
            .setDesc('한자 퀴즈 관련 파일이 저장될 최상위 폴더')
            .addText(text => text
                .setPlaceholder('HanziQuiz')
                .setValue(this.plugin.settings.quizFolder)
                .onChange(async (value) => {
                    this.plugin.settings.quizFolder = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('문제 폴더')
            .setDesc('개별 문제 파일이 저장되는 폴더')
            .addText(text => text
                .setPlaceholder('HanziQuiz/Questions')
                .setValue(this.plugin.settings.questionsFolder)
                .onChange(async (value) => {
                    this.plugin.settings.questionsFolder = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('결과 폴더')
            .setDesc('퀴즈 결과가 저장되는 폴더')
            .addText(text => text
                .setPlaceholder('HanziQuiz/Results')
                .setValue(this.plugin.settings.resultsFolder)
                .onChange(async (value) => {
                    this.plugin.settings.resultsFolder = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('오답 폴더')
            .setDesc('오답 문제가 기록되는 폴더')
            .addText(text => text
                .setPlaceholder('HanziQuiz/WrongAnswers')
                .setValue(this.plugin.settings.wrongAnswersFolder)
                .onChange(async (value) => {
                    this.plugin.settings.wrongAnswersFolder = value;
                    await this.plugin.saveSettings();
                }));

        // 퀴즈 설정
        containerEl.createEl('h2', { text: '🎯 퀴즈 설정' });

        new Setting(containerEl)
            .setName('타이머 활성화')
            .setDesc('퀴즈 중 타이머를 표시합니다')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableTimer)
                .onChange(async (value) => {
                    this.plugin.settings.enableTimer = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('문제당 제한 시간')
            .setDesc('각 문제에 주어지는 시간(초)')
            .addText(text => text
                .setPlaceholder('30')
                .setValue(this.plugin.settings.timerPerQuestion.toString())
                .onChange(async (value) => {
                    const time = parseInt(value);
                    if (time > 0) {
                        this.plugin.settings.timerPerQuestion = time;
                        await this.plugin.saveSettings();
                    }
                }));

        new Setting(containerEl)
            .setName('문제 섞기')
            .setDesc('퀴즈 시작 시 문제 순서를 무작위로 섞습니다')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.shuffleQuestions)
                .onChange(async (value) => {
                    this.plugin.settings.shuffleQuestions = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('선택지 섞기')
            .setDesc('각 문제의 선택지 순서를 무작위로 섞습니다')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.shuffleOptions)
                .onChange(async (value) => {
                    this.plugin.settings.shuffleOptions = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('오답 시 힌트 표시')
            .setDesc('틀렸을 때 힌트를 자동으로 보여줍니다')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showHintAfterWrong)
                .onChange(async (value) => {
                    this.plugin.settings.showHintAfterWrong = value;
                    await this.plugin.saveSettings();
                }));

        // 데이터 관리
        containerEl.createEl('h2', { text: '💾 데이터 관리' });

        new Setting(containerEl)
            .setName('통계 초기화')
            .setDesc('모든 학습 통계를 초기화합니다 (문제는 삭제되지 않습니다)')
            .addButton(button => button
                .setButtonText('🗑️ 통계 초기화')
                .setWarning()
                .onClick(async () => {
                    if (confirm('정말로 모든 통계를 초기화하시겠습니까?')) {
                        this.plugin.settings.stats = {
                            totalAttempts: 0,
                            totalCorrect: 0,
                            totalWrong: 0,
                            totalQuestions: 0,
                            bookmarkedCount: 0,
                            lastStudyDate: null,
                            studyHistory: []
                        };
                        await this.plugin.saveSettings();
                        new Notice('✅ 통계가 초기화되었습니다.');
                    }
                }));

        new Setting(containerEl)
            .setName('모든 문제 통계 초기화')
            .setDesc('각 문제의 정답/오답 횟수를 0으로 초기화합니다')
            .addButton(button => button
                .setButtonText('🔄 문제 통계 초기화')
                .setWarning()
                .onClick(async () => {
                    if (confirm('모든 문제의 통계를 초기화하시겠습니까?')) {
                        const questions = await this.plugin.loadAllQuestions();
                        for (const question of questions) {
                            question.wrongCount = 0;
                            question.correctCount = 0;
                            question.lastAttempt = null;
                            await this.plugin.saveQuestion(question, false);
                        }
                        new Notice(`✅ ${questions.length}개 문제의 통계가 초기화되었습니다.`);
                    }
                }));

        new Setting(containerEl)
            .setName('데이터 내보내기')
            .setDesc('모든 문제와 통계를 JSON 파일로 내보냅니다')
            .addButton(button => button
                .setButtonText('📤 내보내기')
                .onClick(async () => {
                    const questions = await this.plugin.loadAllQuestions();
                    const exportData = {
                        version: '1.0.0',
                        exportDate: new Date().toISOString(),
                        settings: this.plugin.settings,
                        questions: questions
                    };
                    
                    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `hanzi-quiz-export-${Date.now()}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                    
                    new Notice('✅ 데이터가 내보내기되었습니다!');
                }));

        // 폴더 관리 버튼
        containerEl.createEl('h2', { text: '📂 폴더 관리' });

        new Setting(containerEl)
            .setName('폴더 다시 생성')
            .setDesc('필요한 폴더들을 다시 생성합니다')
            .addButton(button => button
                .setButtonText('📁 폴더 생성')
                .onClick(async () => {
                    await this.plugin.ensureFolders();
                    new Notice('✅ 폴더가 생성되었습니다.');
                }));

        // 정보
        containerEl.createEl('h2', { text: 'ℹ️ 정보' });
        
        const infoDiv = containerEl.createDiv({ cls: 'hanzi-quiz-info' });
        infoDiv.innerHTML = `
            <p><strong>한자 퀴즈 플러그인 v1.0.0</strong></p>
            <p>효과적인 한자 학습을 위한 문제은행 시스템</p>
            <p>📚 문제 형식: Markdown 기반</p>
            <p>🎯 지원 기능: 객관식, 타이머, 북마크, 오답노트</p>
            <p>📊 통계 추적: 정답률, 학습 기록, 문제별 성과</p>
        `;

        this.addInfoStyles();
    }

    addInfoStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .hanzi-quiz-info {
                padding: 20px;
                background: var(--background-secondary);
                border-radius: 8px;
                margin-top: 10px;
            }
            .hanzi-quiz-info p {
                margin: 8px 0;
            }
        `;
        document.head.appendChild(style);
    }
}

// Part 4: Utility Functions & Export

// 문제 필터링 및 정렬 유틸리티
class QuestionUtils {
    static filterByDifficulty(questions, difficulty) {
        if (!difficulty) return questions;
        return questions.filter(q => q.difficulty === difficulty);
    }

    static filterByBookmark(questions, bookmarkedOnly = false) {
        if (!bookmarkedOnly) return questions;
        return questions.filter(q => q.bookmarked);
    }

    static filterByWrongAnswers(questions, minWrongCount = 1) {
        return questions.filter(q => (q.wrongCount || 0) >= minWrongCount);
    }

    static sortByWrongCount(questions, descending = true) {
        return [...questions].sort((a, b) => {
            const countA = a.wrongCount || 0;
            const countB = b.wrongCount || 0;
            return descending ? countB - countA : countA - countB;
        });
    }

    static sortByLastAttempt(questions, recentFirst = true) {
        return [...questions].sort((a, b) => {
            if (!a.lastAttempt) return 1;
            if (!b.lastAttempt) return -1;
            const dateA = new Date(a.lastAttempt);
            const dateB = new Date(b.lastAttempt);
            return recentFirst ? dateB - dateA : dateA - dateB;
        });
    }

    static getStatistics(questions) {
        const total = questions.length;
        const bookmarked = questions.filter(q => q.bookmarked).length;
        const withWrongAnswers = questions.filter(q => (q.wrongCount || 0) > 0).length;
        
        let totalCorrect = 0;
        let totalWrong = 0;
        
        questions.forEach(q => {
            totalCorrect += (q.correctCount || 0);
            totalWrong += (q.wrongCount || 0);
        });

        const totalAttempts = totalCorrect + totalWrong;
        const accuracy = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;

        return {
            total,
            bookmarked,
            withWrongAnswers,
            totalCorrect,
            totalWrong,
            totalAttempts,
            accuracy
        };
    }

    static getDifficultyDistribution(questions) {
        const easy = questions.filter(q => q.difficulty === '쉬움').length;
        const normal = questions.filter(q => q.difficulty === '보통').length;
        const hard = questions.filter(q => q.difficulty === '어려움').length;
        
        return { easy, normal, hard };
    }
}

// CSV 내보내기 기능
class QuestionExporter {
    static toCSV(questions) {
        const headers = ['번호', '한자', '문제', '정답', '난이도', '오답횟수', '정답횟수', '북마크'];
        const rows = questions.map(q => [
            q.number || '',
            q.hanzi || '',
            q.question || '',
            q.options && q.options[q.answer] ? q.options[q.answer] : '',
            q.difficulty || '보통',
            q.wrongCount || 0,
            q.correctCount || 0,
            q.bookmarked ? 'Y' : 'N'
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        return csvContent;
    }

    static downloadCSV(questions, filename = 'hanzi-questions.csv') {
        const csv = this.toCSV(questions);
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
    }

    static toJSON(questions, includeStats = true) {
        const exportData = {
            version: '1.0.0',
            exportDate: new Date().toISOString(),
            questions: questions
        };

        if (includeStats) {
            exportData.statistics = QuestionUtils.getStatistics(questions);
        }

        return JSON.stringify(exportData, null, 2);
    }
}

// 학습 진도 추적
class StudyProgressTracker {
    constructor(plugin) {
        this.plugin = plugin;
    }

    async recordStudySession(duration, questionsAnswered, correctCount) {
        const today = new Date().toLocaleDateString('ko-KR');
        const stats = this.plugin.settings.stats;

        if (!stats.studyHistory) {
            stats.studyHistory = [];
        }

        const todayRecord = stats.studyHistory.find(h => h.date === today);
        
        if (todayRecord) {
            todayRecord.duration += duration;
            todayRecord.questionsAnswered += questionsAnswered;
            todayRecord.correct += correctCount;
            todayRecord.wrong += (questionsAnswered - correctCount);
        } else {
            stats.studyHistory.push({
                date: today,
                duration: duration,
                questionsAnswered: questionsAnswered,
                correct: correctCount,
                wrong: questionsAnswered - correctCount
            });
        }

        // 최근 30일만 유지
        if (stats.studyHistory.length > 30) {
            stats.studyHistory = stats.studyHistory.slice(-30);
        }

        await this.plugin.saveSettings();
    }

    getWeeklyProgress() {
        const stats = this.plugin.settings.stats;
        if (!stats.studyHistory) return [];

        return stats.studyHistory.slice(-7);
    }

    getMonthlyProgress() {
        const stats = this.plugin.settings.stats;
        if (!stats.studyHistory) return [];

        return stats.studyHistory.slice(-30);
    }

    getTotalStudyTime() {
        const stats = this.plugin.settings.stats;
        if (!stats.studyHistory) return 0;

        return stats.studyHistory.reduce((total, day) => total + (day.duration || 0), 0);
    }

    getStreak() {
        const stats = this.plugin.settings.stats;
        if (!stats.studyHistory || stats.studyHistory.length === 0) return 0;

        let streak = 0;
        const today = new Date();
        
        for (let i = 0; i < 365; i++) {
            const checkDate = new Date(today);
            checkDate.setDate(checkDate.getDate() - i);
            const dateString = checkDate.toLocaleDateString('ko-KR');
            
            const record = stats.studyHistory.find(h => h.date === dateString);
            
            if (record && record.questionsAnswered > 0) {
                streak++;
            } else if (i > 0) {
                break;
            }
        }

        return streak;
    }
}

// 복습 스케줄러 (간격 반복 학습)
class SpacedRepetitionScheduler {
    static getNextReviewDate(question) {
        const correctCount = question.correctCount || 0;
        const wrongCount = question.wrongCount || 0;
        
        if (correctCount === 0) {
            return new Date(); // 아직 맞춘 적 없으면 즉시 복습
        }

        // 간격 반복 간격 (일)
        const intervals = [1, 3, 7, 14, 30, 60, 90];
        const level = Math.min(correctCount - wrongCount, intervals.length - 1);
        const daysUntilReview = intervals[Math.max(0, level)];

        const lastAttempt = question.lastAttempt ? new Date(question.lastAttempt) : new Date();
        const nextReview = new Date(lastAttempt);
        nextReview.setDate(nextReview.getDate() + daysUntilReview);

        return nextReview;
    }

    static getDueQuestions(questions) {
        const now = new Date();
        return questions.filter(q => {
            const nextReview = this.getNextReviewDate(q);
            return nextReview <= now;
        });
    }

    static getPriorityScore(question) {
        const wrongCount = question.wrongCount || 0;
        const correctCount = question.correctCount || 0;
        const daysSinceLastAttempt = question.lastAttempt 
            ? Math.floor((Date.now() - new Date(question.lastAttempt)) / (1000 * 60 * 60 * 24))
            : 999;

        // 우선순위 계산: 오답 많을수록, 오래 안 본 문제일수록 높은 점수
        return (wrongCount * 10) + (daysSinceLastAttempt * 0.5) - (correctCount * 2);
    }

    static sortByPriority(questions) {
        return [...questions].sort((a, b) => {
            return this.getPriorityScore(b) - this.getPriorityScore(a);
        });
    }
}

// 성취 시스템
class AchievementSystem {
    static checkAchievements(plugin) {
        const achievements = [];
        const stats = plugin.settings.stats;
        const tracker = new StudyProgressTracker(plugin);

        // 문제 수 달성
        if (stats.totalQuestions >= 10) achievements.push({ id: 'questions_10', name: '📚 문제 수집가', desc: '10개 이상의 문제 생성' });
        if (stats.totalQuestions >= 50) achievements.push({ id: 'questions_50', name: '📖 문제 제작자', desc: '50개 이상의 문제 생성' });
        if (stats.totalQuestions >= 100) achievements.push({ id: 'questions_100', name: '📕 문제 마스터', desc: '100개 이상의 문제 생성' });

        // 정답 횟수 달성
        if (stats.totalCorrect >= 50) achievements.push({ id: 'correct_50', name: '✅ 초보 학습자', desc: '50개 문제 정답' });
        if (stats.totalCorrect >= 200) achievements.push({ id: 'correct_200', name: '🎯 중급 학습자', desc: '200개 문제 정답' });
        if (stats.totalCorrect >= 500) achievements.push({ id: 'correct_500', name: '🏆 고급 학습자', desc: '500개 문제 정답' });

        // 정답률 달성
        const accuracy = stats.totalAttempts > 0 ? Math.round((stats.totalCorrect / stats.totalAttempts) * 100) : 0;
        if (accuracy >= 80 && stats.totalAttempts >= 20) {
            achievements.push({ id: 'accuracy_80', name: '🎯 정확한 사수', desc: '정답률 80% 이상 유지' });
        }
        if (accuracy >= 90 && stats.totalAttempts >= 50) {
            achievements.push({ id: 'accuracy_90', name: '💎 완벽주의자', desc: '정답률 90% 이상 유지' });
        }

        // 연속 학습 달성
        const streak = tracker.getStreak();
        if (streak >= 3) achievements.push({ id: 'streak_3', name: '🔥 3일 연속', desc: '3일 연속 학습' });
        if (streak >= 7) achievements.push({ id: 'streak_7', name: '🔥🔥 7일 연속', desc: '7일 연속 학습' });
        if (streak >= 30) achievements.push({ id: 'streak_30', name: '🔥🔥🔥 한 달 달성', desc: '30일 연속 학습' });

        return achievements;
    }
}

// Obsidian 플러그인 메인 export
module.exports = HanziQuizPlugin;