const { Plugin, Modal, Notice, Setting, PluginSettingTab } = require('obsidian');

const DEFAULT_SETTINGS = {
    quizFolder: 'HanziQuiz',
    questionsFolder: 'HanziQuiz/Questions',
    resultsFolder: 'HanziQuiz/Results',
    wrongAnswersFolder: 'HanziQuiz/WrongAnswers',
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

    async startQuiz(difficulty = null, wrongAnswersOnly = false) {
        let questions = await this.loadAllQuestions();
        
        if (questions.length === 0) {
            new Notice('저장된 문제가 없습니다. 먼저 문제를 만들어주세요!');
            return;
        }

        if (difficulty) {
            questions = questions.filter(q => q.difficulty === difficulty);
            if (questions.length === 0) {
                new Notice(`${difficulty} 난이도 문제가 없습니다.`);
                return;
            }
        }

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

    async loadAllQuestions() {
        const files = this.app.vault.getMarkdownFiles()
            .filter(file => file.path.startsWith(this.settings.questionsFolder));

        const questions = [];

        for (const file of files) {
            const content = await this.app.vault.read(file);
            const question = this.parseQuestionFile(content, file.path);
            if (question) {
                questions.push(question);
            }
        }

        this.settings.stats.totalQuestions = questions.length;
        await this.saveSettings();

        return questions;
    }

    parseQuestionFile(content, filePath) {
        try {
            const lines = content.split('\
');
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
                            const match = line.match(/\\d+/);
                            question.wrongCount = match ? parseInt(match[0]) : 0;
                        } else if (line.includes('정답:')) {
                            const match = line.match(/\\d+/);
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
        const fileName = `${this.settings.questionsFolder}/${question.number}_${question.hanzi}.md`;
        const content = this.generateQuestionContent(question);
        
        const file = this.app.vault.getAbstractFileByPath(fileName);
        if (file) {
            await this.app.vault.modify(file, content);
        } else {
            await this.app.vault.create(fileName, content);
        }
        
        if (isNew) {
            new Notice(`✅ 문제 \"${question.hanzi}\" 저장됨`);
        }
    }

    generateQuestionContent(question) {
        return `# ${question.title || question.hanzi + ' 문제'}

## 한자
${question.hanzi}

## 번호
${question.number}

## 문제
${question.question}

## 선택지
${question.options.map((opt) => `- ${opt}`).join('\
')}

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
            
            new Notice(updatedQuestion.bookmarked ? '⭐ 북마크 추가됨' : '북마크 제거됨');
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

        const listContent = `# 📚 한자 문제 목록

전체 문제 수: **${questions.length}**개

## 📊 난이도별 분포
- 쉬움: ${easyQuestions.length}개
- 보통: ${normalQuestions.length}개
- 어려움: ${hardQuestions.length}개
- 북마크: ${bookmarkedQuestions.length}개

## ⭐ 북마크된 문제
${bookmarkedQuestions.length > 0 ? bookmarkedQuestions.map(q => `- ${q.number}. ${q.hanzi} - ${q.question}`).join('\
') : '없음'}

## ❌ 오답이 많은 문제 TOP 10
${wrongQuestions.length > 0 ? wrongQuestions.slice(0, 10).map(q => `- ${q.number}. ${q.hanzi} (오답 ${q.wrongCount}회)`).join('\
') : '없음'}

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
${recentHistory.length > 0 ? recentHistory.map(h => `- ${h.date}: 정답 ${h.correct}개, 오답 ${h.wrong}개`).join('\
') : '학습 기록이 없습니다.'}

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
${result.details.map((d, idx) => `${idx + 1}. ${d.hanzi} - ${d.isCorrect ? '✅' : '❌'} ${d.question}`).join('\
')}

## 📌 복습이 필요한 한자
${result.details.filter(d => !d.isCorrect).map(d => `- ${d.hanzi}`).join('\
') || '없음'}

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

class DashboardModal extends Modal {
    constructor(app, plugin) {
        super(app);
        this.plugin = plugin;
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('hanzi-dashboard');

        const questions = await this.plugin.loadAllQuestions();
        const stats = this.plugin.settings.stats;
        
        contentEl.createEl('h1', { text: '📊 한자 학습 대시보드' });

        const statsContainer = contentEl.createDiv('dashboard-stats');
        
        this.createStatCard(statsContainer, '📚 총 문제', questions.length + '개');
        this.createStatCard(statsContainer, '🎯 시도 횟수', (stats.totalAttempts || 0) + '회');
        
        const accuracy = stats.totalAttempts > 0 
            ? Math.round((stats.totalCorrect / stats.totalAttempts) * 100) 
            : 0;
        this.createStatCard(statsContainer, '📈 정답률', accuracy + '%');
        this.createStatCard(statsContainer, '⭐ 북마크', (stats.bookmarkedCount || 0) + '개');

        const actionsContainer = contentEl.createDiv('dashboard-actions');
        
        this.createActionButton(actionsContainer, '🎯 전체 퀴즈', async () => {
            this.close();
            await this.plugin.startQuiz();
        });

        this.createActionButton(actionsContainer, '😊 쉬운 문제', async () => {
            this.close();
            await this.plugin.startQuiz('쉬움');
        });

        this.createActionButton(actionsContainer, '📝 보통 문제', async () => {
            this.close();
            await this.plugin.startQuiz('보통');
        });

        this.createActionButton(actionsContainer, '🔥 어려운 문제', async () => {
            this.close();
            await this.plugin.startQuiz('어려움');
        });

        this.createActionButton(actionsContainer, '❌ 오답 복습', async () => {
            this.close();
            await this.plugin.startWrongAnswerQuiz();
        });

        const manageContainer = contentEl.createDiv('dashboard-manage');
        manageContainer.createEl('h3', { text: '⚙️ 관리' });
        
        const manageButtons = manageContainer.createDiv('manage-buttons');
        
        this.createManageButton(manageButtons, '➕ 문제 추가', () => {
            this.close();
            new HanziQuestionModal(this.app, this.plugin).open();
        });

        this.createManageButton(manageButtons, '📋 문제 목록', async () => {
            this.close();
            await this.plugin.viewQuestionList();
        });

        this.createManageButton(manageButtons, '📈 학습 통계', async () => {
            this.close();
            await this.plugin.viewStatistics();
        });
    }

    createStatCard(container, label, value) {
        const card = container.createDiv('stat-card');
        card.createEl('div', { text: label, cls: 'stat-label' });
        card.createEl('div', { text: value, cls: 'stat-value' });
    }

    createActionButton(container, text, callback) {
        const btn = container.createEl('button', { text: text, cls: 'dashboard-btn' });
        btn.onclick = callback;
    }

    createManageButton(container, text, callback) {
        const btn = container.createEl('button', { text: text, cls: 'manage-btn' });
        btn.onclick = callback;
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

class HanziQuestionModal extends Modal {
    constructor(app, plugin) {
        super(app);
        this.plugin = plugin;
        this.question = {
            number: '',
            hanzi: '',
            question: '',
            options: ['', '', '', ''],
            answer: 0,
            hint: '',
            note: '',
            difficulty: '보통',
            image: ''
        };
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('hanzi-question-modal');
        
        contentEl.createEl('h2', { text: '📝 한자 문제 만들기' });

        new Setting(contentEl)
            .setName('번호')
            .setDesc('한자 번호 (예: 101)')
            .addText(text => {
                text.setValue(this.question.number)
                    .setPlaceholder('101')
                    .onChange(value => this.question.number = value);
            });

        new Setting(contentEl)
            .setName('한자')
            .setDesc('학습할 한자')
            .addText(text => {
                text.setValue(this.question.hanzi)
                    .setPlaceholder('干')
                    .onChange(value => this.question.hanzi = value);
            });

        new Setting(contentEl)
            .setName('문제')
            .setDesc('출제할 문제')
            .addTextArea(text => {
                text.setValue(this.question.question)
                    .setPlaceholder('干의 음과 뜻은?')
                    .onChange(value => this.question.question = value);
            });

        contentEl.createEl('h3', { text: '선택지' });
        for (let i = 0; i < 4; i++) {
            new Setting(contentEl)
                .setName(`선택지 ${i + 1}`)
                .addText(text => {
                    text.setValue(this.question.options[i])
                        .setPlaceholder(`선택지 ${i + 1}`)
                        .onChange(value => this.question.options[i] = value);
                });
        }

        new Setting(contentEl)
            .setName('정답')
            .setDesc('정답 번호 (1~4)')
            .addDropdown(dropdown => {
                dropdown.addOption('0', '선택지 1');
                dropdown.addOption('1', '선택지 2');
                dropdown.addOption('2', '선택지 3');
                dropdown.addOption('3', '선택지 4');
                dropdown.setValue(String(this.question.answer))
                    .onChange(value => this.question.answer = parseInt(value));
            });

        new Setting(contentEl)
            .setName('난이도')
            .addDropdown(dropdown => {
                dropdown.addOption('쉬움', '쉬움');
                dropdown.addOption('보통', '보통');
                dropdown.addOption('어려움', '어려움');
                dropdown.setValue(this.question.difficulty)
                    .onChange(value => this.question.difficulty = value);
            });

        new Setting(contentEl)
            .setName('힌트')
            .setDesc('문제 풀이 힌트')
            .addTextArea(text => {
                text.setValue(this.question.hint)
                    .setPlaceholder('干: 간행(刊行)할 때의 간')
                    .onChange(value => this.question.hint = value);
            });

        new Setting(contentEl)
            .setName('노트')
            .setDesc('학습 노트')
            .addTextArea(text => {
                text.setValue(this.question.note)
                    .setPlaceholder('간간안한남 → 干 干 岸 旱 南')
                    .onChange(value => this.question.note = value);
            });

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('저장')
                .setCta()
                .onClick(async () => {
                    if (!this.question.hanzi || !this.question.question) {
                        new Notice('한자와 문제를 입력하세요');
                        return;
                    }
                    
                    if (this.question.options.some(opt => !opt)) {
                        new Notice('모든 선택지를 입력하세요');
                        return;
                    }
                    
                    await this.plugin.saveQuestion(this.question);
                    this.close();
                }))
            .addButton(btn => btn
                .setButtonText('취소')
                .onClick(() => this.close()));
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

class QuizPlayModal extends Modal {
    constructor(app, plugin, questions, wrongAnswersOnly, difficulty) {
        super(app);
        this.plugin = plugin;
        this.questions = this.plugin.settings.shuffleQuestions ? this.shuffleArray(questions) : questions;
        this.wrongAnswersOnly = wrongAnswersOnly;
        this.difficulty = difficulty;
        this.currentIndex = 0;
        this.correctCount = 0;
        this.incorrectCount = 0;
        this.answers = [];
        this.answered = false;
        this.startTime = null;
        this.timer = null;
    }

    shuffleArray(array) {
        const newArray = [...array];
        for (let i = newArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
        }
        return newArray;
    }

    onOpen() {
        this.displayQuestion();
    }

    displayQuestion() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('hanzi-quiz-play');

        if (this.currentIndex >= this.questions.length) {
            this.showResults();
            return;
        }

        const question = this.questions[this.currentIndex];
        this.answered = false;
        this.startTime = Date.now();

        const header = contentEl.createDiv('quiz-header');
        header.createEl('h2', { text: '🎯 한자 퀴즈' });
        
        const progress = header.createDiv('quiz-progress');
        progress.createSpan({ text: `문제 ${this.currentIndex + 1} / ${this.questions.length}` });
        progress.createEl('br');
        progress.createSpan({ text: `✅ ${this.correctCount} | ❌ ${this.incorrectCount}` });

        if (this.plugin.settings.enableTimer) {
            this.timerDiv = header.createDiv('quiz-timer');
            this.startTimer();
        }

        contentEl.createEl('div', { 
            text: question.hanzi, 
            cls: 'quiz-hanzi'
        });

        contentEl.createEl('div', { 
            text: question.question, 
            cls: 'quiz-question'
        });

        const optionsDiv = contentEl.createDiv('quiz-options');
        
        const shuffledOptions = this.plugin.settings.shuffleOptions
            ? this.shuffleArray(question.options.map((opt, idx) => ({text: opt, index: idx})))
            : question.options.map((opt, idx) => ({text: opt, index: idx}));

        shuffledOptions.forEach((opt) => {
            const btn = optionsDiv.createEl('button', {
                text: opt.text,
                cls: 'quiz-option-btn'
            });
            btn.onclick = () => this.checkAnswer(opt.index, btn, question);
        });

this.feedbackDiv = contentEl.createDiv('quiz-feedback');

        this.nextBtn = contentEl.createEl('button', {
            text: '다음 문제 →',
            cls: 'quiz-next-btn'
        });
        this.nextBtn.disabled = true;
        this.nextBtn.onclick = () => this.nextQuestion();

        const bookmarkBtn = contentEl.createEl('button', {
            text: question.bookmarked ? '⭐ 북마크 해제' : '⭐ 북마크',
            cls: 'quiz-bookmark-btn'
        });
        bookmarkBtn.onclick = async () => {
            await this.plugin.toggleBookmark(question);
            bookmarkBtn.setText(question.bookmarked ? '⭐ 북마크' : '⭐ 북마크 해제');
        };
    }

    startTimer() {
        let timeLeft = this.plugin.settings.timerPerQuestion;
        this.timerDiv.setText(`⏱️ ${timeLeft}초`);

        clearInterval(this.timer);
        this.timer = setInterval(() => {
            timeLeft--;
            this.timerDiv.setText(`⏱️ ${timeLeft}초`);
            
            if (timeLeft <= 5) {
                this.timerDiv.style.color = '#f44336';
            }
            
            if (timeLeft <= 0) {
                clearInterval(this.timer);
                if (!this.answered) {
                    this.autoSubmit();
                }
            }
        }, 1000);
    }

    autoSubmit() {
        const question = this.questions[this.currentIndex];
        this.answered = true;

        const buttons = this.contentEl.querySelectorAll('.quiz-option-btn');
        buttons.forEach((btn, idx) => {
            btn.disabled = true;
            if (btn.textContent === question.options[question.answer]) {
                btn.addClass('correct');
            }
        });

        this.incorrectCount++;
        
        this.feedbackDiv.innerHTML = `
            <div class=\"feedback-incorrect\">
                ⏰ 시간 초과! 틀렸습니다!
            </div>
            <div class=\"feedback-hint\">
                💡 정답: ${question.options[question.answer]}<br>
                ${question.hint || ''}<br>
                ${question.note ? '📝 ' + question.note : ''}
            </div>
        `;

        const timeSpent = Math.round((Date.now() - this.startTime) / 1000);
        
        this.answers.push({
            hanzi: question.hanzi,
            question: question.question,
            userAnswer: '시간 초과',
            correctAnswer: question.options[question.answer],
            isCorrect: false,
            hint: question.hint,
            note: question.note,
            timeSpent: timeSpent,
            bookmarked: question.bookmarked
        });

        this.plugin.updateQuestionStats(question, false);
        this.nextBtn.disabled = false;
    }

    checkAnswer(selectedIndex, button, question) {
        if (this.answered) return;
        this.answered = true;

        clearInterval(this.timer);

        const buttons = this.contentEl.querySelectorAll('.quiz-option-btn');
        buttons.forEach(btn => btn.disabled = true);

        const isCorrect = selectedIndex === question.answer;

        if (isCorrect) {
            button.addClass('correct');
            this.correctCount++;
            this.feedbackDiv.innerHTML = `
                <div class=\"feedback-correct\">
                    ✅ 정답입니다!
                </div>
                <div class=\"feedback-hint\">
                    💡 ${question.hint || ''}
                    ${question.note ? '<br>📝 ' + question.note : ''}
                </div>
            `;
        } else {
            button.addClass('incorrect');
            this.incorrectCount++;
            
            buttons.forEach((btn) => {
                if (btn.textContent === question.options[question.answer]) {
                    btn.addClass('correct');
                }
            });

            this.feedbackDiv.innerHTML = `
                <div class=\"feedback-incorrect\">
                    ❌ 틀렸습니다!
                </div>
                <div class=\"feedback-hint\">
                    💡 정답: ${question.options[question.answer]}<br>
                    ${question.hint || ''}<br>
                    ${question.note ? '📝 ' + question.note : ''}
                </div>
            `;
        }

        const timeSpent = Math.round((Date.now() - this.startTime) / 1000);

        this.answers.push({
            hanzi: question.hanzi,
            question: question.question,
            userAnswer: question.options[selectedIndex],
            correctAnswer: question.options[question.answer],
            isCorrect: isCorrect,
            hint: question.hint,
            note: question.note,
            timeSpent: timeSpent,
            bookmarked: question.bookmarked
        });

        this.plugin.updateQuestionStats(question, isCorrect);
        this.nextBtn.disabled = false;
    }

    nextQuestion() {
        this.currentIndex++;
        this.displayQuestion();
    }

    showResults() {
        const { contentEl } = this;
        contentEl.empty();

        clearInterval(this.timer);

        const percentage = Math.round((this.correctCount / this.questions.length) * 100);
        
        let emoji = '🎉';
        let message = '완벽합니다!';
        
        if (percentage < 60) {
            emoji = '😅';
            message = '조금 더 복습이 필요해요!';
        } else if (percentage < 80) {
            emoji = '👍';
            message = '잘하셨어요!';
        } else if (percentage < 100) {
            emoji = '🌟';
            message = '훌륭합니다!';
        }

        const results = contentEl.createDiv('quiz-results');
        results.createEl('div', { text: emoji, cls: 'result-emoji' });
        results.createEl('h2', { text: message });
        results.createEl('div', { 
            text: `${this.correctCount} / ${this.questions.length} 정답`, 
            cls: 'result-score'
        });
        results.createEl('div', { 
            text: `정답률: ${percentage}%`, 
            cls: 'result-percentage'
        });

        const btnContainer = contentEl.createDiv('result-buttons');
        
        const saveBtn = btnContainer.createEl('button', {
            text: '💾 결과 저장',
            cls: 'result-btn'
        });
        saveBtn.onclick = async () => {
            await this.plugin.saveQuizResult({
                correct: this.correctCount,
                incorrect: this.incorrectCount,
                total: this.questions.length,
                percentage: percentage,
                details: this.answers,
                timerEnabled: this.plugin.settings.enableTimer,
                difficulty: this.difficulty,
                wrongAnswersOnly: this.wrongAnswersOnly
            });
            this.close();
        };

        const restartBtn = btnContainer.createEl('button', {
            text: '🔄 다시 풀기',
            cls: 'result-btn'
        });
        restartBtn.onclick = () => {
            this.currentIndex = 0;
            this.correctCount = 0;
            this.incorrectCount = 0;
            this.answers = [];
            if (this.plugin.settings.shuffleQuestions) {
                this.questions = this.shuffleArray(this.questions);
            }
            this.displayQuestion();
        };

        const closeBtn = btnContainer.createEl('button', {
            text: '❌ 닫기',
            cls: 'result-btn'
        });
        closeBtn.onclick = () => this.close();
    }

    onClose() {
        clearInterval(this.timer);
        const { contentEl } = this;
        contentEl.empty();
    }
}

/********************************************************************
 * 📥 노트 가져오기 모달
 ********************************************************************/
class ImportNoteModal extends Modal {
    constructor(app, plugin) {
        super(app);
        this.plugin = plugin;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        contentEl.createEl('h2', { text: '📥 학습 노트에서 문제 가져오기' });
        
        contentEl.createEl('p', { 
            text: '현재 이 기능은 수동으로 문제를 만드는 것을 권장합니다.'
        });

        contentEl.createEl('p', {
            text: '문제 형식 예시:',
            cls: 'import-example-title'
        });

        const exampleDiv = contentEl.createEl('pre', {
            cls: 'import-example'
        });
        exampleDiv.setText(`101번 - 干 (간)
문제: 干의 음과 뜻은?
1) 간/방패 간
2) 간/막을 간
3) 간/언덕 간
4) 간/가물 간
정답: 1
힌트: 간행(刊行)할 때의 간
노트: 간간안한남 → 干 干 岸 旱 南
난이도: 보통`);

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('닫기')
                .onClick(() => this.close()));
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

/********************************************************************
 * ⚙️ 설정 탭
 ********************************************************************/
class HanziQuizSettingTab extends PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: '⚙️ Hanzi Quiz 설정' });

        new Setting(containerEl)
            .setName('퀴즈 폴더')
            .setDesc('퀴즈 관련 파일들이 저장될 기본 폴더')
            .addText(text => text
                .setPlaceholder('HanziQuiz')
                .setValue(this.plugin.settings.quizFolder)
                .onChange(async (value) => {
                    this.plugin.settings.quizFolder = value;
                    this.plugin.settings.questionsFolder = value + '/Questions';
                    this.plugin.settings.resultsFolder = value + '/Results';
                    this.plugin.settings.wrongAnswersFolder = value + '/WrongAnswers';
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('문제 폴더')
            .setDesc('한자 문제 파일들이 저장될 폴더')
            .addText(text => text
                .setPlaceholder('HanziQuiz/Questions')
                .setValue(this.plugin.settings.questionsFolder)
                .onChange(async (value) => {
                    this.plugin.settings.questionsFolder = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('결과 폴더')
            .setDesc('퀴즈 결과 파일들이 저장될 폴더')
            .addText(text => text
                .setPlaceholder('HanziQuiz/Results')
                .setValue(this.plugin.settings.resultsFolder)
                .onChange(async (value) => {
                    this.plugin.settings.resultsFolder = value;
                    await this.plugin.saveSettings();
                }));

        containerEl.createEl('h3', { text: '🎮 퀴즈 설정' });

        new Setting(containerEl)
            .setName('타이머 사용')
            .setDesc('문제당 제한 시간을 설정합니다')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableTimer)
                .onChange(async (value) => {
                    this.plugin.settings.enableTimer = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('문제당 시간 (초)')
            .setDesc('각 문제를 푸는데 주어지는 시간')
            .addText(text => text
                .setPlaceholder('30')
                .setValue(String(this.plugin.settings.timerPerQuestion))
                .onChange(async (value) => {
                    const num = parseInt(value);
                    if (num > 0 && num <= 300) {
                        this.plugin.settings.timerPerQuestion = num;
                        await this.plugin.saveSettings();
                    }
                }));

        new Setting(containerEl)
            .setName('문제 순서 섞기')
            .setDesc('퀴즈 시작 시 문제 순서를 무작위로 섞습니다')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.shuffleQuestions)
                .onChange(async (value) => {
                    this.plugin.settings.shuffleQuestions = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('선택지 순서 섞기')
            .setDesc('각 문제의 선택지 순서를 무작위로 섞습니다')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.shuffleOptions)
                .onChange(async (value) => {
                    this.plugin.settings.shuffleOptions = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('오답 시 힌트 표시')
            .setDesc('틀렸을 때 힌트와 노트를 자동으로 표시합니다')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showHintAfterWrong)
                .onChange(async (value) => {
                    this.plugin.settings.showHintAfterWrong = value;
                    await this.plugin.saveSettings();
                }));

        containerEl.createEl('h3', { text: '📊 통계 관리' });

        const stats = this.plugin.settings.stats;
        const statsInfo = containerEl.createDiv('stats-info');
        statsInfo.createEl('p', { text: `총 시도 횟수: ${stats.totalAttempts || 0}회` });
        statsInfo.createEl('p', { text: `정답: ${stats.totalCorrect || 0}회` });
        statsInfo.createEl('p', { text: `오답: ${stats.totalWrong || 0}회` });
        statsInfo.createEl('p', { text: `전체 정답률: ${stats.totalAttempts > 0 ? Math.round((stats.totalCorrect / stats.totalAttempts) * 100) : 0}%` });

        new Setting(containerEl)
            .setName('통계 초기화')
            .setDesc('⚠️ 모든 학습 통계를 초기화합니다 (문제는 삭제되지 않습니다)')
            .addButton(btn => btn
                .setButtonText('초기화')
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
                        new Notice('✅ 통계가 초기화되었습니다');
                        this.display();
                    }
                }));
    }
}

module.exports = HanziQuizPlugin;