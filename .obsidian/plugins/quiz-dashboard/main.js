const { Plugin, Notice, Setting, PluginSettingTab, Modal, Menu } = require('obsidian');
// Force cache refresh - v4.4.0

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
            id: 'generate-dashboard',
            name: '📊 문제 목록 대시보드 생성',
            callback: () => this.generateQuestionDashboard()
        });

        this.addCommand({
            id: 'question-dashboard-modal',
            name: '📋 문제 대시보드 모달',
            callback: () => new QuestionDashboardModal(this.app, this).open()
        });

        this.addCommand({
            id: 'question-list-dashboard-modal',
            name: '📊 문제 목록 대시보드',
            callback: () => new QuestionListDashboardModal(this.app, this).open()
        });

        this.addCommand({
            id: 'view-statistics',
            name: '📈 학습 통계 보기',
            callback: () => this.viewStatistics()
        });

        this.addCommand({
            id: 'create-subjective-qa',
            name: '📋 주관식 문제 만들기',
            callback: () => new SubjectiveQAModal(this.app, this).open()
        });

        this.addCommand({
            id: 'debug-load-questions',
            name: '🔍 디버그: 문제 로딩 테스트',
            callback: async () => {
                console.log('=== 문제 로딩 디버그 시작 ===');
                const questions = await this.loadAllQuestions();
                console.log(`=== 총 로딩된 문제: ${questions.length}개 ===`);
                
                // 폴더별 집계
                const byFolder = {};
                questions.forEach(q => {
                    const folder = q.folder || '기본';
                    byFolder[folder] = (byFolder[folder] || 0) + 1;
                });
                
                console.log('=== 폴더별 문제 수 ===');
                Object.entries(byFolder).forEach(([folder, count]) => {
                    console.log(`  ${folder}: ${count}개`);
                });
                
                new Notice(`✅ 로딩 완료: 총 ${questions.length}개 문제\n${Object.keys(byFolder).map(f => `${f}: ${byFolder[f]}개`).join('\n')}`);
            }
        });

        this.addSettingTab(new HanziQuizSettingTab(this.app, this));
        await this.ensureFolders();

        console.log('🚀 Hanzi Quiz 플러그인 로드됨');
    }

    // 🌐 텍스트 언어 자동 감지 (한국어, 영어, 일본어, 중국어)
    detectLanguage(text) {
        if (!text || text.trim().length === 0) {
            return 'ko-KR'; // 기본값
        }

        const trimmed = text.trim();
        const totalChars = trimmed.length;
        
        let koreanChars = 0;
        let japaneseChars = 0;
        let chineseChars = 0;
        let englishChars = 0;
        
        for (let i = 0; i < trimmed.length; i++) {
            const char = trimmed[i];
            const code = char.charCodeAt(0);
            
            // 한글 (가-힣, ㄱ-ㅎ, ㅏ-ㅣ)
            if ((code >= 0xAC00 && code <= 0xD7A3) || // 가-힣
                (code >= 0x1100 && code <= 0x11FF) || // 한글 자모
                (code >= 0x3131 && code <= 0x318E)) {  // 한글 호환 자모
                koreanChars++;
            }
            // 히라가나 (ぁ-ん)
            else if (code >= 0x3040 && code <= 0x309F) {
                japaneseChars++;
            }
            // 가타카나 (ァ-ヶ)
            else if (code >= 0x30A0 && code <= 0x30FF) {
                japaneseChars++;
            }
            // 중국어 간체/번체 (CJK Unified Ideographs)
            else if ((code >= 0x4E00 && code <= 0x9FFF) ||  // 기본 한자
                     (code >= 0x3400 && code <= 0x4DBF)) {  // 확장 A
                chineseChars++;
            }
            // 영어 (A-Z, a-z)
            else if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122)) {
                englishChars++;
            }
        }
        
        // 비율 계산
        const koreanRatio = koreanChars / totalChars;
        const japaneseRatio = japaneseChars / totalChars;
        const chineseRatio = chineseChars / totalChars;
        const englishRatio = englishChars / totalChars;
        
        console.log('🔍 언어 감지:', {
            text: trimmed.substring(0, 30) + '...',
            totalChars,
            korean: `${koreanChars}자 (${(koreanRatio * 100).toFixed(1)}%)`,
            japanese: `${japaneseChars}자 (${(japaneseRatio * 100).toFixed(1)}%)`,
            chinese: `${chineseChars}자 (${(chineseRatio * 100).toFixed(1)}%)`,
            english: `${englishChars}자 (${(englishRatio * 100).toFixed(1)}%)`
        });
        
        // 우선순위: 한국어 > 일본어 > 중국어 > 영어
        if (koreanRatio >= 0.1) {
            console.log('✅ 감지된 언어: 한국어 (ko-KR)');
            return 'ko-KR';
        }
        if (japaneseRatio >= 0.1) {
            console.log('✅ 감지된 언어: 일본어 (ja-JP)');
            return 'ja-JP';
        }
        if (chineseRatio >= 0.1) {
            console.log('✅ 감지된 언어: 중국어 (zh-CN)');
            return 'zh-CN';
        }
        if (englishRatio >= 0.3) {
            console.log('✅ 감지된 언어: 영어 (en-US)');
            return 'en-US';
        }
        
        // 기본값
        console.log('⚠️ 언어 감지 실패. 기본값: ko-KR');
        return 'ko-KR';
    }

    // 🎤 오프라인 TTS (Web Speech API)
    async speakText(text, options = {}) {
        if (!text || text.trim().length === 0) {
            new Notice('읽을 텍스트가 없습니다.');
            return;
        }

        // Web Speech API 지원 확인
        if (!window.speechSynthesis) {
            new Notice('⚠️ 이 브라우저는 음성 읽기를 지원하지 않습니다.');
            return;
        }

        try {
            // 진행 중인 음성 중지
            window.speechSynthesis.cancel();

            // 🌐 자동 언어 감지
            const detectedLang = this.detectLanguage(text);
            console.log(`🌐 감지된 언어: ${detectedLang}`);

            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = detectedLang;
            utterance.rate = options.rate || 1.0;
            utterance.pitch = options.pitch || 1.0;
            utterance.volume = options.volume || 1.0;

            // 언어에 맞는 음성 선택
            const voices = window.speechSynthesis.getVoices();
            const langPrefix = detectedLang.split('-')[0]; // 'ko', 'en', 'ja', 'zh'
            
            // 삼성 TTS 우선 선택
            let selectedVoice = voices.find(v => 
                v.lang.startsWith(langPrefix) && 
                (v.name.toLowerCase().includes('samsung') || 
                 v.name.includes('삼성') ||
                 v.voiceURI.toLowerCase().includes('samsung'))
            );

            // 삼성 TTS 없으면 해당 언어의 아무 음성
            if (!selectedVoice) {
                selectedVoice = voices.find(v => v.lang.startsWith(langPrefix));
            }

            if (selectedVoice) {
                utterance.voice = selectedVoice;
                console.log(`🎤 선택된 음성: ${selectedVoice.name} (${selectedVoice.lang})`);
                
                // 삼성 TTS는 rate/pitch 범위 제한
                if (selectedVoice.name.toLowerCase().includes('samsung') || 
                    selectedVoice.name.includes('삼성')) {
                    utterance.rate = Math.max(0.5, Math.min(2.0, utterance.rate));
                    utterance.pitch = Math.max(0.5, Math.min(2.0, utterance.pitch));
                    console.log('📱 삼성 TTS: rate/pitch 범위 제한 (0.5~2.0)');
                }
            } else {
                console.log('⚠️ 해당 언어 음성 없음. 기본 음성 사용');
            }

            utterance.onstart = () => {
                console.log('▶️ TTS 재생 시작');
                new Notice('🔊 음성 재생 중...');
            };

            utterance.onend = () => {
                console.log('⏹️ TTS 재생 완료');
            };

            utterance.onerror = (event) => {
                console.error('❌ TTS 오류:', event);
                new Notice('❌ 음성 재생 실패');
            };

            window.speechSynthesis.speak(utterance);
            
        } catch (error) {
            console.error('TTS Error:', error);
            new Notice('❌ 음성 읽기 실패: ' + error.message);
        }
    }

    async ensureFolders() {
        const folders = [
            this.settings.quizFolder,
            this.settings.questionsFolder,
            this.settings.resultsFolder,
            this.settings.wrongAnswersFolder
        ];

        // 기본 폴더 생성
        for (const folder of folders) {
            const exists = this.app.vault.getAbstractFileByPath(folder);
            if (!exists) {
                try {
                    await this.app.vault.createFolder(folder);
                    console.log('📁 폴더 생성됨:', folder);
                } catch (e) {
                    console.log('Folder might already exist:', folder);
                }
            }
        }

        // questionFolders 내 하위 폴더들도 생성
        if (this.settings.questionFolders && this.settings.questionFolders.length > 0) {
            for (const subfolder of this.settings.questionFolders) {
                const folderPath = `${this.settings.questionsFolder}/${subfolder}`;
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
        console.log('🎯 퀴즈 시작:', { difficulty, wrongAnswersOnly, folder });
        
        let questions = await this.loadAllQuestions();
        
        console.log(`📝 전체 문제 수: ${questions.length}개`);
        
        if (questions.length === 0) {
            new Notice('⚠️ 저장된 문제가 없습니다. 먼저 문제를 만들어주세요!');
            console.error('❌ 문제 없음. Questions 폴더 확인 필요:', this.settings.questionsFolder);
            return;
        }

        // 폴더 필터링
        if (folder) {
            const beforeFilter = questions.length;
            questions = questions.filter(q => (q.folder || '기본') === folder);
            console.log(`📁 폴더 필터: ${folder} (${beforeFilter}개 → ${questions.length}개)`);
            if (questions.length === 0) {
                new Notice(`"${folder}" 폴더에 문제가 없습니다.`);
                return;
            }
        }

        // 난이도 필터링
        if (difficulty) {
            const beforeFilter = questions.length;
            questions = questions.filter(q => q.difficulty === difficulty);
            console.log(`⭐ 난이도 필터: ${difficulty} (${beforeFilter}개 → ${questions.length}개)`);
            if (questions.length === 0) {
                new Notice(`${difficulty} 난이도 문제가 없습니다.`);
                return;
            }
        }

        // 오답 필터링
        if (wrongAnswersOnly) {
            const beforeFilter = questions.length;
            questions = questions.filter(q => q.wrongCount > 0);
            console.log(`❌ 오답 필터: (${beforeFilter}개 → ${questions.length}개)`);
            if (questions.length === 0) {
                new Notice('오답 문제가 없습니다!');
                return;
            }
        }

        console.log(`✅ 최종 퀴즈 문제 수: ${questions.length}개`);
        new QuizPlayModal(this.app, this, questions, wrongAnswersOnly, difficulty).open();
    }

    async startWrongAnswerQuiz() {
        await this.startQuiz(null, true);
    }
    
    async getQuestionsByFolder(folder) {
        const allQuestions = await this.loadAllQuestions();
        console.log(`📂 전체 문제 수:`, allQuestions.length);
        console.log(`📂 필터할 폴더:`, folder);
        
        const filtered = allQuestions.filter(q => {
            const questionFolder = q.folder || '기본';
            console.log(`  - 문제 폴더: "${questionFolder}" vs 검색: "${folder}"`, questionFolder === folder);
            return questionFolder === folder;
        });
        
        console.log(`📂 필터된 문제 수:`, filtered.length);
        return filtered;
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

    async viewKeywordList() {
        const questions = await this.loadAllQuestions();
        
        if (questions.length === 0) {
            new Notice('저장된 문제가 없습니다.');
            return;
        }

        // 키워드별로 그룹화
        const keywordGroups = {};
        questions.forEach(q => {
            const keyword = q.hanzi || '미분류';
            if (!keywordGroups[keyword]) {
                keywordGroups[keyword] = [];
            }
            keywordGroups[keyword].push(q);
        });

        // 키워드별 정렬 (문제 개수 많은 순)
        const sortedKeywords = Object.entries(keywordGroups)
            .sort((a, b) => b[1].length - a[1].length);

        // 키워드별 섹션 생성
        const keywordSections = sortedKeywords.map(([keyword, qs]) => {
            const difficultyIcon = this.getDifficultyIcon(qs[0].difficulty || 'C');
            return `### 🔑 ${keyword} (${qs.length}개)
${qs.map(q => `- ${q.number}번. ${q.question} ${this.getDifficultyIcon(q.difficulty)} ${q.bookmarked ? '⭐' : ''} (${q.folder || '기본'})`).join('\n')}`;
        }).join('\n\n');

        const listContent = `# 🔑 키워드별 문제 목록

전체 키워드 수: **${sortedKeywords.length}**개
전체 문제 수: **${questions.length}**개

## 📊 키워드별 통계
${sortedKeywords.map(([keyword, qs]) => `- **${keyword}**: ${qs.length}개`).join('\n')}

## 🔍 키워드별 문제
${keywordSections}

---
생성일: ${new Date().toLocaleString('ko-KR')}
`;

        const listPath = `${this.settings.quizFolder}/🔑 키워드목록.md`;
        const file = this.app.vault.getAbstractFileByPath(listPath);
        
        if (file) {
            await this.app.vault.modify(file, listContent);
        } else {
            await this.app.vault.create(listPath, listContent);
        }

        const leaf = this.app.workspace.getLeaf(false);
        await leaf.openFile(this.app.vault.getAbstractFileByPath(listPath));
    }

        async createIntegratedDashboard() {
        const dashboardPath = this.settings.quizFolder + '/🎯 통합한자대시보드.md';
        
        const questionsFolder = this.settings.questionsFolder;
        const foldersJson = JSON.stringify(this.settings.questionFolders);
        const updateTime = new Date().toLocaleString('ko-KR');
        
        const template = '---\n' +
'cssclass: hanzi-dashboard\n' +
'---\n\n' +
'# 🎯 한자 퀴즈 대시보드\n\n' +
'## 📂 폴더별 문제\n\n' +
'```dataviewjs\n' +
'const questionsPath = "' + questionsFolder + '";\n' +
'const folders = ' + foldersJson + ';\n\n' +
'let html = "<div class=\\"folder-grid\\">";\n\n' +
'for (const folder of folders) {\n' +
'    const folderPath = questionsPath + "/" + folder;\n' +
'    const folderQuestions = dv.pages("\\"" + folderPath + "\\"").where(p => p.file.name.includes("_") && !p.file.name.includes("문제목록"));\n' +
'    const count = folderQuestions.length;\n' +
'    const listPath = folderPath + "/문제목록.md";\n' +
'    html += "<div class=\\"folder-card\\"><div class=\\"folder-icon\\">📁</div><div class=\\"folder-name\\">" + folder + "</div><div class=\\"folder-count\\">" + count + "개 문제</div><a href=\\"obsidian://open?vault=" + encodeURIComponent(dv.app.vault.getName()) + "&file=" + encodeURIComponent(listPath) + "\\" class=\\"folder-link\\">📋 문제 목록 보기</a></div>";\n' +
'}\n\n' +
'html += "</div>";\n' +
'dv.paragraph(html);\n' +
'```\n\n' +
'## ⭐ 북마크한 문제\n\n' +
'```dataviewjs\n' +
'const questionsPath = "' + questionsFolder + '";\n' +
'const bookmarked = dv.pages("\\"" + questionsPath + "\\"").where(p => p.file.name.includes("_") && !p.file.name.includes("문제목록") && p.bookmarked === true).sort(p => p.file.mtime, "desc").limit(10);\n\n' +
'if (bookmarked.length > 0) {\n' +
'    let html = "<div class=\\"question-list\\">";\n' +
'    for (const q of bookmarked) {\n' +
'        const difficultyVal = q.difficulty || "C";\n' +
'        const diffIcon = difficultyVal === "A+" ? "🏆" : difficultyVal === "A" || difficultyVal === "A-" ? "⭐" : difficultyVal === "B" || difficultyVal === "B-" ? "😊" : difficultyVal === "C" ? "😐" : difficultyVal === "D" ? "😰" : difficultyVal === "E" ? "�" : "💀";\n' +
'        html += "<a href=\\"" + q.file.path + "\\" class=\\"question-item\\"><div class=\\"q-hanzi\\">" + (q.hanzi || "-") + "</div><div class=\\"q-info\\"><div class=\\"q-text\\">" + (q.question || "") + "</div><div class=\\"q-meta\\"><span class=\\"badge\\">" + diffIcon + " " + difficultyVal + "</span><span class=\\"badge\\">📁 " + (q.folder || "기본") + "</span></div></div></a>";\n' +
'    }\n' +
'    html += "</div>";\n' +
'    dv.paragraph(html);\n' +
'} else {\n' +
'    dv.paragraph("<p class=\\"empty\\">⭐ 북마크한 문제가 없습니다</p>");\n' +
'}\n' +
'```\n\n' +
'## 🕒 최근 수정한 문제\n\n' +
'```dataviewjs\n' +
'const questionsPath = "' + questionsFolder + '";\n' +
'const recent = dv.pages("\\"" + questionsPath + "\\"").where(p => p.file.name.includes("_") && !p.file.name.includes("문제목록")).sort(p => p.file.mtime, "desc").limit(15);\n\n' +
'if (recent.length > 0) {\n' +
'    let html = "<div class=\\"question-list\\">";\n' +
'    for (const q of recent) {\n' +
'        const difficultyVal = q.difficulty || "C";\n' +
'        const diffIcon = difficultyVal === "A+" ? "🏆" : difficultyVal === "A" || difficultyVal === "A-" ? "⭐" : difficultyVal === "B" || difficultyVal === "B-" ? "😊" : difficultyVal === "C" ? "😐" : difficultyVal === "D" ? "😰" : difficultyVal === "E" ? "�" : "💀";\n' +
'        const wrongBadge = (q.wrongCount > 0) ? "<span class=\\"badge badge-wrong\\">❌ " + q.wrongCount + "</span>" : "";\n' +
'        const bookmarkIcon = q.bookmarked ? "⭐ " : "";\n' +
'        html += "<a href=\\"" + q.file.path + "\\" class=\\"question-item\\"><div class=\\"q-hanzi\\">" + (q.hanzi || "-") + "</div><div class=\\"q-info\\"><div class=\\"q-text\\">" + bookmarkIcon + (q.question || "") + "</div><div class=\\"q-meta\\"><span class=\\"badge\\">" + diffIcon + " " + difficultyVal + "</span><span class=\\"badge\\">📁 " + (q.folder || "기본") + "</span>" + wrongBadge + "</div></div></a>";\n' +
'    }\n' +
'    html += "</div>";\n' +
'    dv.paragraph(html);\n' +
'} else {\n' +
'    dv.paragraph("<p class=\\"empty\\">📝 문제가 없습니다</p>");\n' +
'}\n' +
'```\n\n' +
'---\n\n' +
'<style>\n' +
'.hanzi-dashboard { padding: 20px; max-width: 1200px; margin: 0 auto; }\n' +
'.folder-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 20px; margin: 20px 0 40px 0; }\n' +
'@media (max-width: 768px) { .folder-grid { grid-template-columns: repeat(2, 1fr); gap: 15px; } }\n' +
'@media (max-width: 480px) { .folder-grid { grid-template-columns: 1fr; } }\n' +
'.folder-card { background: var(--background-secondary); border: 2px solid var(--background-modifier-border); border-radius: 12px; padding: 25px 20px; text-align: center; transition: all 0.3s ease; }\n' +
'.folder-card:hover { border-color: var(--interactive-accent); transform: translateY(-5px); box-shadow: 0 8px 16px rgba(0,0,0,0.15); }\n' +
'.folder-icon { font-size: 48px; margin-bottom: 12px; }\n' +
'.folder-name { font-size: 18px; font-weight: bold; margin-bottom: 8px; color: var(--text-normal); }\n' +
'.folder-count { font-size: 14px; color: var(--text-muted); margin-bottom: 15px; }\n' +
'.folder-link { display: inline-block; padding: 8px 16px; background: var(--interactive-accent); color: white; text-decoration: none; border-radius: 20px; font-size: 13px; font-weight: 600; transition: all 0.2s; }\n' +
'.folder-link:hover { background: var(--interactive-accent-hover); transform: scale(1.05); }\n' +
'.question-list { display: flex; flex-direction: column; gap: 12px; margin: 20px 0; }\n' +
'.question-item { display: flex; align-items: center; gap: 20px; padding: 18px; background: var(--background-secondary); border: 2px solid var(--background-modifier-border); border-radius: 10px; text-decoration: none; transition: all 0.2s; }\n' +
'.question-item:hover { border-color: var(--interactive-accent); background: var(--background-modifier-hover); transform: translateX(5px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }\n' +
'@media (max-width: 480px) { .question-item { flex-direction: column; align-items: flex-start; gap: 12px; padding: 15px; } }\n' +
'.q-hanzi { font-size: 42px; font-weight: bold; min-width: 70px; text-align: center; color: var(--text-accent); }\n' +
'@media (max-width: 480px) { .q-hanzi { font-size: 32px; min-width: auto; } }\n' +
'.q-info { flex: 1; }\n' +
'.q-text { font-size: 16px; font-weight: 500; margin-bottom: 10px; color: var(--text-normal); line-height: 1.5; }\n' +
'@media (max-width: 480px) { .q-text { font-size: 14px; } }\n' +
'.q-meta { display: flex; gap: 8px; flex-wrap: wrap; }\n' +
'.badge { display: inline-block; padding: 5px 12px; background: var(--background-primary); border-radius: 12px; font-size: 12px; font-weight: 600; color: var(--text-muted); }\n' +
'.badge-wrong { background: rgba(244, 67, 54, 0.15); color: #f44336; }\n' +
'@media (max-width: 480px) { .badge { font-size: 11px; padding: 4px 10px; } }\n' +
'.empty { text-align: center; padding: 50px 20px; color: var(--text-muted); font-size: 16px; background: var(--background-secondary); border-radius: 10px; }\n' +
'</style>\n\n' +
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
            
            // 파일 열기
            const createdFile = this.app.vault.getAbstractFileByPath(dashboardPath);
            if (createdFile) {
                const leaf = this.app.workspace.getLeaf(false);
                await leaf.openFile(createdFile);
            }
        } catch (error) {
            console.error('통합 대시보드 생성 오류:', error);
            new Notice('❌ 통합 대시보드 생성에 실패했습니다.');
        }
    }

    async loadAllQuestions() {
        const allFiles = this.app.vault.getMarkdownFiles();
        const isMobile = this.app.isMobile;
        
        console.log(`📚 전체 마크다운 파일 수: ${allFiles.length}개`);
        console.log(`� 모바일 모드: ${isMobile ? 'YES' : 'NO'}`);
        console.log(`�🔍 검색 폴더: "${this.settings.questionsFolder}"`);
        
        // 경로 정규화 함수 (Windows/Unix/Mobile 호환)
        const normalizePath = (path) => {
            if (!path) return '';
            // 모든 백슬래시를 슬래시로 변환
            let normalized = path.replace(/\\/g, '/');
            // 연속된 슬래시 제거
            normalized = normalized.replace(/\/+/g, '/');
            // 시작/끝 슬래시 정리
            normalized = normalized.replace(/^\/+/, '');
            return normalized; // 대소문자 보존
        };
        const normalizedQuestionsFolder = normalizePath(this.settings.questionsFolder);
        console.log(`NORMALIZED FOLDER: "${normalizedQuestionsFolder}"`);
        
        // 첫 10개 파일의 경로를 모두 출력하여 패턴 파악
        console.log('FIRST 10 FILES:');
        allFiles.slice(0, 10).forEach((f, i) => {
            console.log(`  ${i}: ${f.path} -> ${normalizePath(f.path)}`);
        });
        
        const files = allFiles.filter(file => {
            const normalizedPath = normalizePath(file.path);
            const normalizedFolder = normalizedQuestionsFolder;
            
            // 경로 매칭 (대소문자 구분)
            const startsWith = normalizedPath.startsWith(normalizedFolder);
            const notDashboard = !file.path.includes('문제목록') && 
                                !file.path.includes('문제 대시보드') && 
                                !file.path.includes('📊 문제 대시보드');
            
            if (startsWith && notDashboard) {
                console.log(`✅ MATCHED: ${file.path}`);
            }
            
            return startsWith && notDashboard;
        });

        console.log(`� 필터링된 파일 수: ${files.length}개`);
        
        if (files.length > 0) {
            console.log(`📋 첫 3개 파일 예시:`, files.slice(0, 3).map(f => f.path));
        } else {
            console.warn(`⚠️ "${this.settings.questionsFolder}" 폴더에서 파일을 찾지 못했습니다.`);
            console.log(`� 전체 파일 중 일부:`, allFiles.slice(0, 5).map(f => f.path));
        }

        const questions = [];
        let successCount = 0;
        let failCount = 0;

        for (const file of files) {
            try {
                const content = await this.app.vault.read(file);
                const question = this.parseQuestionFile(content, file.path);
                if (question) {
                    // 파일 수정 시간 추가
                    question.mtime = file.stat.mtime;
                    questions.push(question);
                    successCount++;
                } else {
                    failCount++;
                    console.warn(`❌ 파싱 실패: ${file.path}`);
                }
            } catch (err) {
                failCount++;
                console.error(`❌ 파일 읽기 실패: ${file.path}`, err);
            }
        }

        console.log(`✅ 로드 성공: ${successCount}개, ❌ 실패: ${failCount}개`);
        console.log(`📊 총 문제 수: ${questions.length}개`);

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
                } else if (line.startsWith('## 선택지 이미지')) {
                    section = 'optionImages';
                    question.optionImages = [];
                } else if (line.startsWith('## 선택지')) {
                    section = 'options';
                    question.options = [];
                    console.log(`📝 [${filePath}] 선택지 섹션 시작`);
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
                    else if (section === 'number') question.number = line.trim(); // trim 추가
                    else if (section === 'folder') question.folder = line.trim(); // trim 추가
                    else if (section === 'question') {
                        question.question = question.question ? question.question + ' ' + line : line;
                    } else if (section === 'options' && line.startsWith('-')) {
                        const option = line.substring(1).trim(); // '-' 제거 후 trim
                        question.options.push(option);
                        console.log(`  ✓ 선택지 추가: "${option}"`);
                    } else if (section === 'optionImages' && line.match(/^\d+\./)) {
                        // "1. image_url" 형식 파싱
                        const imageUrl = line.substring(line.indexOf('.') + 1).trim();
                        question.optionImages.push(imageUrl);
                    } else if (section === 'answer') question.answer = parseInt(line) || 0;
                    else if (section === 'hint') {
                        question.hint = question.hint ? question.hint + ' ' + line : line;
                    } else if (section === 'note') {
                        question.note = question.note ? question.note + ' ' + line : line;
                    } else if (section === 'difficulty') {
                        question.difficulty = line;
                    } else if (section === 'image') {
                        // 이미지 URL 파싱 (다양한 형식 지원)
                        if (line) {
                            question.image = question.image ? question.image + '\n' + line : line;
                        }
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

            // 문제로 인정하는 조건: question 텍스트와 options가 있으면 됨
            // hanzi는 선택사항으로 변경
            if (question.question && question.options && question.options.length > 0) {
                // optionImages 배열이 없거나 길이가 부족하면 초기화
                if (!question.optionImages) {
                    question.optionImages = [];
                }
                while (question.optionImages.length < question.options.length) {
                    question.optionImages.push('');
                }
                
                // 정답 인덱스 검증 (0-based)
                if (question.answer === undefined || question.answer === null) {
                    console.warn(`⚠️ 정답 없음: ${filePath}, 기본값 0 설정`);
                    question.answer = 0;
                } else if (question.answer < 0 || question.answer >= question.options.length) {
                    console.warn(`⚠️ 정답 인덱스 범위 초과: ${filePath}, answer=${question.answer}, options.length=${question.options.length}`);
                    question.answer = 0;
                }
                
                return question;
            }
            
            console.warn(`⚠️ 문제 형식 불완전: ${filePath}`);
            console.warn(`   - 문제: ${question.question ? '✅' : '❌'} "${question.question || '없음'}"`);
            console.warn(`   - 선택지: ${question.options?.length > 0 ? '✅' : '❌'} ${question.options?.length || 0}개`);
            console.warn(`   - 한자: ${question.hanzi ? '✅' : '⚠️'} "${question.hanzi || '없음'}"`);
            console.warn(`   - 번호: ${question.number ? '✅' : '⚠️'} "${question.number || '없음'}"`);
            console.warn(`   - 폴더: ${question.folder ? '✅' : '⚠️'} "${question.folder || '없음'}"`);
            
            return null;
        } catch (e) {
            console.error(`❌ 문제 파싱 오류: ${filePath}`, e);
            console.error('   스택:', e.stack);
            return null;
        }
    }

    // 난이도 아이콘 가져오기
    getDifficultyIcon(difficulty) {
        const icons = {
            'A+': '🏆',
            'A': '⭐',
            'A-': '⭐',
            'B': '😊',
            'B-': '😊',
            'C': '😐',
            'D': '😰',
            'E': '😱',
            'F': '💀'
        };
        return icons[difficulty] || '😐';
    }

    // 난이도 CSS 클래스 가져오기
    getDifficultyClass(difficulty) {
        if (difficulty === 'A+' || difficulty === 'A' || difficulty === 'A-') return 'easy';
        if (difficulty === 'B' || difficulty === 'B-') return 'normal';
        if (difficulty === 'C') return 'normal';
        return 'hard'; // D, E, F
    }

    async getNextAvailableNumber(folder) {
        // 해당 폴더의 모든 문제 로드
        const allQuestions = await this.loadAllQuestions();
        const folderQuestions = allQuestions.filter(q => (q.folder || '기본') === folder);
        
        console.log(`📁 [${folder}] 폴더의 문제 개수: ${folderQuestions.length}`);
        
        if (folderQuestions.length === 0) {
            console.log(`✨ [${folder}] 폴더의 첫 번째 문제 - 번호 1 할당`);
            return '1';
        }
        
        // 사용 중인 번호들 추출
        const usedNumbers = folderQuestions
            .map(q => parseInt(q.number))
            .filter(n => !isNaN(n))
            .sort((a, b) => a - b);
        
        console.log(`📊 [${folder}] 폴더의 사용 중인 번호: ${usedNumbers.join(', ')}`);
        
        // 빈 번호 찾기 (1부터 시작)
        for (let i = 1; i <= usedNumbers.length + 1; i++) {
            if (!usedNumbers.includes(i)) {
                console.log(`✅ [${folder}] 폴더에 번호 ${i} 자동 할당`);
                return i.toString();
            }
        }
        
        const nextNumber = (usedNumbers.length + 1).toString();
        console.log(`✅ [${folder}] 폴더에 번호 ${nextNumber} 자동 할당`);
        return nextNumber;
    }

    async checkNumberDuplicate(number, folder, excludeFilePath = null) {
        // 같은 폴더에서 같은 번호를 사용하는 문제가 있는지 확인
        const allQuestions = await this.loadAllQuestions();
        
        // 해당 폴더의 문제들만 필터링
        const folderQuestions = allQuestions.filter(q => 
            (q.folder || '기본') === folder
        );
        
        console.log(`📁 [${folder}] 폴더 문제 개수: ${folderQuestions.length}`);
        console.log(`🔍 번호 ${number} (타입: ${typeof number}) 중복 체크 중... (제외: ${excludeFilePath || '없음'})`);
        
        // 문자열로 변환하여 비교 (타입 불일치 방지)
        const numberStr = String(number).trim();
        
        const duplicate = folderQuestions.find(q => {
            const qNumberStr = String(q.number).trim();
            const isDup = qNumberStr === numberStr && q.filePath !== excludeFilePath;
            
            if (isDup) {
                console.log(`  🔴 중복 확인: q.number="${q.number}" (${typeof q.number}) === number="${number}" (${typeof number})`);
                console.log(`  📄 파일: ${q.filePath}`);
            }
            
            return isDup;
        });
        
        if (duplicate) {
            console.log(`⚠️ 중복 발견: ${duplicate.filePath}`);
            console.log(`   중복 번호: "${duplicate.number}" (${typeof duplicate.number})`);
        } else {
            console.log(`✅ 번호 ${number}은(는) [${folder}] 폴더에서 사용 가능`);
        }
        
        return duplicate !== undefined;
    }
    
    async findDuplicateQuestion(number, folder, excludeFilePath = null) {
        // checkNumberDuplicate와 동일하지만 중복 파일 객체를 반환
        const allQuestions = await this.loadAllQuestions();
        const folderQuestions = allQuestions.filter(q => 
            (q.folder || '기본') === folder
        );
        
        const numberStr = String(number).trim();
        const duplicate = folderQuestions.find(q => {
            const qNumberStr = String(q.number).trim();
            return qNumberStr === numberStr && q.filePath !== excludeFilePath;
        });
        
        return duplicate; // undefined 또는 중복 문제 객체
    }

    async saveQuestion(question, isNew = true) {
        const folder = question.folder || '기본';
        const folderPath = `${this.settings.questionsFolder}/${folder}`;
        
        // 번호 trim (공백 제거)
        if (question.number) {
            question.number = question.number.toString().trim();
        }
        
        // 번호가 비어있으면 자동 생성
        if (!question.number || question.number === '') {
            question.number = await this.getNextAvailableNumber(folder);
            new Notice(`📋 자동으로 번호 ${question.number}이(가) 할당되었습니다.`);
        }
        
        // 중복 체크 제거 - 중복 허용
        // 단, 새 폴더 생성 시에는 1번부터 시작하도록 getNextAvailableNumber에서 처리
        
        // 폴더가 없으면 생성 (모바일 호환)
        const folderExists = this.app.vault.getAbstractFileByPath(folderPath);
        if (!folderExists) {
            try {
                await this.app.vault.createFolder(folderPath);
            } catch (e) {
                console.log('폴더가 이미 존재하거나 생성 중:', folderPath);
            }
        }
        
        const newFileName = `${folderPath}/${question.number}_${question.hanzi}.md`;
        const content = this.generateQuestionContent(question);
        
        // 기존 파일이 있고 파일명이 변경된 경우
        if (question.filePath && question.filePath !== newFileName) {
            const oldFile = this.app.vault.getAbstractFileByPath(question.filePath);
            if (oldFile) {
                // 기존 파일 삭제하고 새 파일 생성
                await this.app.vault.delete(oldFile);
                await this.app.vault.create(newFileName, content);
                question.filePath = newFileName;
            } else {
                // 기존 파일이 없으면 새로 생성
                await this.app.vault.create(newFileName, content);
                question.filePath = newFileName;
            }
        } else {
            // 파일명이 동일하거나 새 파일인 경우
            const file = this.app.vault.getAbstractFileByPath(newFileName);
            if (file) {
                await this.app.vault.modify(file, content);
            } else {
                await this.app.vault.create(newFileName, content);
                question.filePath = newFileName;
            }
        }
        
        // 폴더별 문제목록 템플릿 업데이트
        await this.updateQuestionListTemplate(folder);
        
        if (isNew) {
            new Notice(`✅ 문제 "${question.hanzi}" 저장됨 ([${folder}] 폴더, 번호: ${question.number})`);
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

## 선택지 이미지
${question.optionImages && question.optionImages.length > 0 ? question.optionImages.map((img, i) => `${i + 1}. ${img || ''}`).join('\n') : ''}

## 정답
${question.answer}

## 힌트
${question.hint || ''}

## 노트
${question.note || ''}

## 난이도
${question.difficulty || 'C'}

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
        if (!file) {
            new Notice('❌ 문제 파일을 찾을 수 없습니다.');
            return false;
        }

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
            
            return updatedQuestion.bookmarked;
        }
        
        return false;
    }

    async updateQuestionDifficulty(question, newDifficulty) {
        const file = this.app.vault.getAbstractFileByPath(question.filePath);
        if (!file) return;

        const content = await this.app.vault.read(file);
        const updatedQuestion = this.parseQuestionFile(content, question.filePath);
        
        if (updatedQuestion) {
            updatedQuestion.difficulty = newDifficulty;
            await this.saveQuestion(updatedQuestion, false);
        }
    }

    async updateQuestionListTemplate(folder) {
        const folderPath = this.settings.questionsFolder + '/' + folder;
        const templatePath = folderPath + '/문제목록.md';
        const updateTime = new Date().toLocaleString('ko-KR');
        
        const template = '---\n' +
'cssclass: question-list\n' +
'---\n\n' +
'# 📋 ' + folder + ' 문제목록\n\n' +
'> 🔄 자동 생성 문서 | 마지막 업데이트: ' + updateTime + '\n\n' +
'## 📊 폴더 통계\n\n' +
'총 문제: **' + '`= length(filter(this.file.folder.children, (f) => contains(f.name, "_") AND !contains(f.name, "문제목록")))`' + '개**\n' +
'⭐ 북마크: **' + '`= length(filter(this.file.folder.children, (f) => contains(f.name, "_") AND !contains(f.name, "문제목록") AND f.bookmarked = true))`' + '개**\n' +
'❌ 오답 있음: **' + '`= length(filter(this.file.folder.children, (f) => contains(f.name, "_") AND !contains(f.name, "문제목록") AND f.wrongCount > 0))`' + '개**\n\n' +
'## 📚 전체 문제 목록\n\n' +
'```dataview\n' +
'TABLE WITHOUT ID\n' +
'  ("**" + number + "**") as "번호",\n' +
'  ("**" + hanzi + "**") as "한자",\n' +
'  (bookmarked ? "⭐ " : "") + question as "문제",\n' +
'  choice(difficulty = "A+", "🏆 A+",\n' +
'    choice(difficulty = "A", "⭐ A",\n' +
'    choice(difficulty = "A-", "⭐ A-",\n' +
'    choice(difficulty = "B", "� B",\n' +
'    choice(difficulty = "B-", "😊 B-",\n' +
'    choice(difficulty = "C", "😐 C",\n' +
'    choice(difficulty = "D", "😰 D",\n' +
'    choice(difficulty = "E", "😱 E",\n' +
'    choice(difficulty = "F", "� F", "😐 C"))))))))) as "난이도",\n' +
'  choice(wrongCount > 0, "❌ " + wrongCount + "회", "") + choice(correctCount > 0, " ✅ " + correctCount + "회", "") as "통계"\n' +
'FROM "' + folderPath + '"\n' +
'WHERE contains(file.name, "_") AND !contains(file.name, "문제목록")\n' +
'SORT file.name ASC\n' +
'```\n\n' +
'## ⭐ 북마크 문제만 보기\n\n' +
'```dataview\n' +
'TABLE WITHOUT ID\n' +
'  ("**" + number + "**") as "번호",\n' +
'  ("**" + hanzi + "**") as "한자",\n' +
'  "⭐ " + question as "문제",\n' +
'  choice(difficulty = "A+", "🏆 A+",\n' +
'    choice(difficulty = "A", "⭐ A",\n' +
'    choice(difficulty = "A-", "⭐ A-",\n' +
'    choice(difficulty = "B", "😊 B",\n' +
'    choice(difficulty = "B-", "� B-",\n' +
'    choice(difficulty = "C", "😐 C",\n' +
'    choice(difficulty = "D", "😰 D",\n' +
'    choice(difficulty = "E", "😱 E",\n' +
'    choice(difficulty = "F", "💀 F", "😐 C"))))))))) as "난이도"\n' +
'FROM "' + folderPath + '"\n' +
'WHERE contains(file.name, "_") AND !contains(file.name, "문제목록") AND bookmarked = true\n' +
'SORT file.name ASC\n' +
'```\n\n' +
'## ❌ 오답 많은 문제 TOP 10\n\n' +
'```dataview\n' +
'TABLE WITHOUT ID\n' +
'  ("❌ **" + wrongCount + "회**") as "오답",\n' +
'  ("**" + hanzi + "**") as "한자",\n' +
'  question as "문제",\n' +
'  choice(difficulty = "A+", "🏆 A+",\n' +
'    choice(difficulty = "A", "⭐ A",\n' +
'    choice(difficulty = "A-", "⭐ A-",\n' +
'    choice(difficulty = "B", "😊 B",\n' +
'    choice(difficulty = "B-", "😊 B-",\n' +
'    choice(difficulty = "C", "😐 C",\n' +
'    choice(difficulty = "D", "😰 D",\n' +
'    choice(difficulty = "E", "😱 E",\n' +
'    choice(difficulty = "F", "💀 F", "😐 C"))))))))) as "난이도"\n' +
'FROM "' + folderPath + '"\n' +
'WHERE contains(file.name, "_") AND !contains(file.name, "문제목록") AND wrongCount > 0\n' +
'SORT wrongCount DESC\n' +
'LIMIT 10\n' +
'```\n\n' +
'---\n' +
'*이 문제목록은 네이티브 Dataview로 자동 생성됩니다*\n';

        try {
            // 폴더 존재 확인 및 생성 (재귀적으로, 모바일 호환)
            const folderExists = this.app.vault.getAbstractFileByPath(folderPath);
            if (!folderExists) {
                console.log('📁 폴더 생성:', folderPath);
                // 부모 폴더들도 함께 생성
                const pathParts = folderPath.split('/');
                let currentPath = '';
                for (const part of pathParts) {
                    if (!part) continue;
                    currentPath = currentPath ? `${currentPath}/${part}` : part;
                    const exists = this.app.vault.getAbstractFileByPath(currentPath);
                    if (!exists) {
                        try {
                            await this.app.vault.createFolder(currentPath);
                        } catch (e) {
                            // 폴더가 이미 존재할 수 있음
                        }
                    }
                }
            }
            
            const file = this.app.vault.getAbstractFileByPath(templatePath);
            if (file) {
                await this.app.vault.modify(file, template);
                console.log('✅ 문제목록 템플릿 업데이트됨:', templatePath);
            } else {
                await this.app.vault.create(templatePath, template);
                console.log('✅ 문제목록 템플릿 생성됨:', templatePath);
            }
        } catch (error) {
            console.error('❌ 문제목록 템플릿 업데이트 오류:', error);
            // 파일이 이미 존재하는 경우 modify 시도
            if (error.message && error.message.includes('already exists')) {
                try {
                    const file = this.app.vault.getAbstractFileByPath(templatePath);
                    if (file) {
                        await this.app.vault.modify(file, template);
                        console.log('✅ 기존 파일 업데이트됨:', templatePath);
                    }
                } catch (retryError) {
                    console.error('❌ 재시도 실패:', retryError);
                }
            }
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
            // 폴더 존재 확인 및 생성 (모바일 호환)
            const quizFolderExists = this.app.vault.getAbstractFileByPath(this.settings.quizFolder);
            if (!quizFolderExists) {
                console.log('퀴즈 폴더 생성:', this.settings.quizFolder);
                try {
                    await this.app.vault.createFolder(this.settings.quizFolder);
                } catch (e) {
                    console.log('폴더가 이미 존재할 수 있음');
                }
            }
            
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
            // 폴더 존재 확인 및 생성 (모바일 호환)
            const quizFolderExists = this.app.vault.getAbstractFileByPath(this.settings.quizFolder);
            if (!quizFolderExists) {
                console.log('퀴즈 폴더 생성:', this.settings.quizFolder);
                try {
                    await this.app.vault.createFolder(this.settings.quizFolder);
                } catch (e) {
                    console.log('폴더가 이미 존재할 수 있음');
                }
            }
            
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

        // 난이도별 분류 (9단계)
        const difficultyGroups = {
            'A+': questions.filter(q => q.difficulty === 'A+'),
            'A': questions.filter(q => q.difficulty === 'A'),
            'A-': questions.filter(q => q.difficulty === 'A-'),
            'B': questions.filter(q => q.difficulty === 'B'),
            'B-': questions.filter(q => q.difficulty === 'B-'),
            'C': questions.filter(q => q.difficulty === 'C'),
            'D': questions.filter(q => q.difficulty === 'D'),
            'E': questions.filter(q => q.difficulty === 'E'),
            'F': questions.filter(q => q.difficulty === 'F')
        };

        const bookmarkedQuestions = questions.filter(q => q.bookmarked);
        const wrongQuestions = questions.filter(q => (q.wrongCount || 0) > 0).sort((a, b) => b.wrongCount - a.wrongCount);

        // 폴더별 분류
        const folders = this.settings.questionFolders || ['기본'];
        const folderSections = folders.map(folder => {
            const folderQuestions = questions.filter(q => (q.folder || '기본') === folder);
            if (folderQuestions.length === 0) return '';
            
            return `### 📁 ${folder} (${folderQuestions.length}개)
${folderQuestions.map(q => `- ${q.number}. ${q.hanzi} - ${q.question} ${this.getDifficultyIcon(q.difficulty)} ${q.bookmarked ? '⭐' : ''}`).join('\n')}`;
        }).filter(s => s).join('\n\n');

        // 난이도별 섹션 생성
        const difficultyIcons = {
            'A+': '🏆', 'A': '⭐', 'A-': '⭐',
            'B': '😊', 'B-': '😊', 'C': '😐',
            'D': '😰', 'E': '😱', 'F': '💀'
        };

        const difficultySections = Object.entries(difficultyGroups)
            .filter(([_, qs]) => qs.length > 0)
            .map(([diff, qs]) => {
                return `### ${difficultyIcons[diff]} ${diff} (${qs.length}개)
${qs.map(q => `- ${q.number}. ${q.hanzi} - ${q.question} ${q.bookmarked ? '⭐' : ''} (${q.folder || '기본'})`).join('\n')}`;
            }).join('\n\n');

        const listContent = `# 📚 한자 문제 목록

전체 문제 수: **${questions.length}**개

## 📊 난이도별 분포
${Object.entries(difficultyGroups).map(([diff, qs]) => `- ${difficultyIcons[diff]} ${diff}: ${qs.length}개`).join('\n')}
- ⭐ 북마크: ${bookmarkedQuestions.length}개

## 📂 폴더별 문제
${folderSections}

## 🎯 난이도별 문제
${difficultySections}

## ⭐ 북마크된 문제
${bookmarkedQuestions.length > 0 ? bookmarkedQuestions.map(q => `- ${q.number}. ${q.hanzi} - ${q.question} (${q.folder || '기본'}) ${this.getDifficultyIcon(q.difficulty)}`).join('\n') : '없음'}

## ❌ 오답이 많은 문제 TOP 10
${wrongQuestions.length > 0 ? wrongQuestions.slice(0, 10).map(q => `- ${q.number}. ${q.hanzi} (오답 ${q.wrongCount}회, ${q.folder || '기본'}) ${this.getDifficultyIcon(q.difficulty)}`).join('\n') : '없음'}

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

    async generateQuestionDashboard() {
        const folders = this.settings.questionFolders || ['기본'];
        
        // 폴더 선택 모달
        const folderModal = new FolderSelectionModal(this.app, folders, async (selectedFolder) => {
            const folderPath = `${this.settings.questionsFolder}/${selectedFolder}`;
            const dashboardPath = `${folderPath}/📊 문제 대시보드.md`;
            
            const dashboardContent = this.getDashboardTemplate(selectedFolder);
            
            try {
                // 기존 파일이 있으면 덮어쓰기, 없으면 생성
                const existingFile = this.app.vault.getAbstractFileByPath(dashboardPath);
                if (existingFile) {
                    await this.app.vault.modify(existingFile, dashboardContent);
                } else {
                    await this.app.vault.create(dashboardPath, dashboardContent);
                }
                
                // 생성된 파일 열기
                const file = this.app.vault.getAbstractFileByPath(dashboardPath);
                if (file) {
                    await this.app.workspace.getLeaf().openFile(file);
                }
                
                new Notice(`✅ ${selectedFolder} 폴더의 문제 대시보드가 생성되었습니다!`);
            } catch (error) {
                new Notice(`❌ 대시보드 생성 실패: ${error.message}`);
                console.error(error);
            }
        });
        
        folderModal.open();
    }

    getDashboardTemplate(folderName) {
        const folder = `HanziQuiz/Questions/${folderName}`;
        const now = new Date();
        const timeString = now.toTimeString().split(' ')[0];
        const dateString = now.toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
        
        return `---
cssclasses:
  - dashboard
times: ["${timeString}"]
created-datetime: "${dateString}"
---

# � ${folderName}

> **문제 관리 대시보드** | 📅 ${dateString}

---

\`\`\`dataviewjs
const thisFile = dv.current();
dv.paragraph(\`📅 **생성일시**: \${thisFile["created-datetime"] || "${dateString}"}\`);
dv.paragraph(\`⏰ **파일 수정**: \${thisFile.file.mtime.toFormat("yyyy-MM-dd HH:mm:ss")}\`);
\`\`\`

## ⚡ 빠른 액션 센터

\`\`\`dataviewjs
const actionContainer = dv.container;

const actionStyles = \`
<style>
.action-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 15px;
    margin: 20px 0;
}
.action-card {
    padding: 20px;
    border-radius: 10px;
    text-align: center;
    color: white;
    cursor: pointer;
    transition: all 0.3s ease;
    border: none;
    font-family: inherit;
    box-shadow: 0 4px 15px rgba(0,0,0,0.3);
}
.action-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 8px 25px rgba(0,0,0,0.4);
}
.action-card-1 { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); }
.action-card-2 { background: linear-gradient(135deg, #10b981 0%, #059669 100%); }
.action-card-3 { background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); }
.action-card-4 { background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); }
.action-card-5 { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
.action-title { font-weight: bold; font-size: 1rem; margin-bottom: 8px; color: #000; }
.action-desc { font-size: 0.8rem; opacity: 0.8; color: #000; }
</style>
\`;

const actionHtml = actionStyles + \`
<div class="action-grid">
    <button class="action-card action-card-1" data-action="new-question">
        <div class="action-title">➕ 새 문제</div>
        <div class="action-desc">문제 추가</div>
    </button>
    <button class="action-card action-card-2" data-action="quiz">
        <div class="action-title">🎯 퀴즈</div>
        <div class="action-desc">학습 시작</div>
    </button>
    <button class="action-card action-card-5" data-action="question-list">
        <div class="action-title">📊 문제 목록</div>
        <div class="action-desc">목록 대시보드</div>
    </button>
    <button class="action-card action-card-3" data-action="refresh">
        <div class="action-title">� 새로고침</div>
        <div class="action-desc">업데이트</div>
    </button>
    <button class="action-card action-card-4" data-action="statistics">
        <div class="action-title">�📈 통계</div>
        <div class="action-desc">분석</div>
    </button>
</div>
\`;

actionContainer.innerHTML = actionHtml;

setTimeout(() => {
    const buttons = actionContainer.querySelectorAll('.action-card');
    buttons.forEach(button => {
        button.addEventListener('click', (e) => {
            const action = button.dataset.action;
            if (action === 'refresh' && app && app.commands) {
                app.commands.executeCommandById('dataview:dataview-force-refresh-views');
                if (window.Notice) new Notice('🔄 새로고침!');
            } else if (action === 'new-question' && window.Notice) {
                new Notice('➕ Ctrl+P → 새 문제 만들기');
            } else if (action === 'quiz' && window.Notice) {
                new Notice('🎯 Ctrl+P → 퀴즈 시작');
            } else if (action === 'question-list' && app && app.commands) {
                app.commands.executeCommandById('quiz-sp:question-list-dashboard-modal');
            } else if (action === 'statistics' && window.Notice) {
                new Notice('📈 Ctrl+P → 통계 보기');
            }
        });
    });
}, 100);
\`\`\`

---

## 📊 ${folderName} 진행률

\`\`\`dataviewjs
const folderPath = "${folder}";
const questions = dv.pages(\`"\${folderPath}"\`).where(p => 
    !p.file.name.includes("문제목록") && 
    !p.file.name.includes("문제 대시보드") && 
    !p.file.name.includes("📊")
);

const total = questions.length;
const bookmarked = questions.where(p => p.bookmarked === true).length;
const wrongAnswers = questions.where(p => p["wrong-count"] && p["wrong-count"] > 0).length;

// 난이도별 통계
const difficultyStats = {
    "A+": questions.where(p => p.difficulty === "A+").length,
    "A": questions.where(p => p.difficulty === "A").length,
    "A-": questions.where(p => p.difficulty === "A-").length,
    "B": questions.where(p => p.difficulty === "B").length,
    "B-": questions.where(p => p.difficulty === "B-").length,
    "C": questions.where(p => p.difficulty === "C").length,
    "D": questions.where(p => p.difficulty === "D").length,
    "E": questions.where(p => p.difficulty === "E").length,
    "F": questions.where(p => p.difficulty === "F").length
};

// 키워드별 통계
const keywordMap = new Map();
for (const q of questions) {
    const keywords = q.keywords || q.keyword || "";
    if (keywords) {
        const keywordList = keywords.toString().split(/[,，、]/).map(k => k.trim()).filter(k => k);
        for (const kw of keywordList) {
            keywordMap.set(kw, (keywordMap.get(kw) || 0) + 1);
        }
    }
}
const topKeywords = Array.from(keywordMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

if (total === 0) {
    dv.paragraph("### 📝 아직 생성된 문제가 없습니다");
    dv.paragraph("🚀 새 문제를 추가해주세요!");
} else {
    let gradeEmoji = "";
    let gradeName = "";
    const completionRate = total > 0 ? Math.round(((total - wrongAnswers) / total) * 100) : 0;
    
    if (completionRate >= 95) { gradeEmoji = "🏆"; gradeName = "전설"; }
    else if (completionRate >= 90) { gradeEmoji = "🥇"; gradeName = "S+"; }
    else if (completionRate >= 80) { gradeEmoji = "🥈"; gradeName = "S"; }
    else if (completionRate >= 70) { gradeEmoji = "🥉"; gradeName = "A"; }
    else if (completionRate >= 60) { gradeEmoji = "📗"; gradeName = "B"; }
    else if (completionRate >= 50) { gradeEmoji = "📘"; gradeName = "C"; }
    else { gradeEmoji = "📕"; gradeName = "D"; }
    
    dv.paragraph(\`### 🎯 전체 진행률\`);
    dv.paragraph(\`\${gradeEmoji} **현재 등급**: \${gradeName} | **정답률**: \${completionRate}%\`);
    dv.paragraph(\`📊 **문제 현황**: 총 \${total}개 | ⭐ 북마크 \${bookmarked}개 | ❌ 오답 \${wrongAnswers}개\`);
    
    const progressBar = "🟩".repeat(Math.floor(completionRate/10)) + "⬜".repeat(10-Math.floor(completionRate/10));
    dv.paragraph(\`**진행바**: \${progressBar} \${completionRate}%\`);
    
    dv.paragraph(\`<div style="width: 100%; background: #1e212b; border-radius: 10px; overflow: hidden; margin: 10px 0; box-shadow: 0 4px 15px rgba(0,0,0,0.3);">\`);
    dv.paragraph(\`<div style="width: \${completionRate}%; background: linear-gradient(90deg, #10b981, #34d399); height: 30px; display: flex; align-items: center; justify-content: center; color: #000; font-weight: bold; transition: width 0.3s ease;">\${completionRate}%</div>\`);
    dv.paragraph(\`</div>\`);
    
    // 난이도별 분포
    dv.paragraph(\`\`);
    dv.paragraph(\`### 📊 난이도별 분포\`);
    let diffHtml = '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 10px; margin: 20px 0;">';
    if (difficultyStats["A+"] > 0) diffHtml += \`<div style="padding: 15px; background: linear-gradient(135deg, #fbbf24, #f59e0b); border-radius: 10px; text-align: center; box-shadow: 0 2px 10px rgba(0,0,0,0.2);"><div style="font-size: 24px;">🏆</div><div style="font-size: 12px; color: #000; font-weight: bold;">A+</div><div style="font-size: 20px; color: #000; font-weight: bold;">\${difficultyStats["A+"]}</div></div>\`;
    if (difficultyStats["A"] > 0) diffHtml += \`<div style="padding: 15px; background: linear-gradient(135deg, #10b981, #059669); border-radius: 10px; text-align: center; box-shadow: 0 2px 10px rgba(0,0,0,0.2);"><div style="font-size: 24px;">⭐</div><div style="font-size: 12px; color: #000; font-weight: bold;">A</div><div style="font-size: 20px; color: #000; font-weight: bold;">\${difficultyStats["A"]}</div></div>\`;
    if (difficultyStats["A-"] > 0) diffHtml += \`<div style="padding: 15px; background: linear-gradient(135deg, #10b981, #059669); border-radius: 10px; text-align: center; box-shadow: 0 2px 10px rgba(0,0,0,0.2);"><div style="font-size: 24px;">⭐</div><div style="font-size: 12px; color: #000; font-weight: bold;">A-</div><div style="font-size: 20px; color: #000; font-weight: bold;">\${difficultyStats["A-"]}</div></div>\`;
    if (difficultyStats["B"] > 0) diffHtml += \`<div style="padding: 15px; background: linear-gradient(135deg, #3b82f6, #1d4ed8); border-radius: 10px; text-align: center; box-shadow: 0 2px 10px rgba(0,0,0,0.2);"><div style="font-size: 24px;">😊</div><div style="font-size: 12px; color: #fff; font-weight: bold;">B</div><div style="font-size: 20px; color: #fff; font-weight: bold;">\${difficultyStats["B"]}</div></div>\`;
    if (difficultyStats["B-"] > 0) diffHtml += \`<div style="padding: 15px; background: linear-gradient(135deg, #3b82f6, #1d4ed8); border-radius: 10px; text-align: center; box-shadow: 0 2px 10px rgba(0,0,0,0.2);"><div style="font-size: 24px;">😊</div><div style="font-size: 12px; color: #fff; font-weight: bold;">B-</div><div style="font-size: 20px; color: #fff; font-weight: bold;">\${difficultyStats["B-"]}</div></div>\`;
    if (difficultyStats["C"] > 0) diffHtml += \`<div style="padding: 15px; background: linear-gradient(135deg, #8b5cf6, #6d28d9); border-radius: 10px; text-align: center; box-shadow: 0 2px 10px rgba(0,0,0,0.2);"><div style="font-size: 24px;">😐</div><div style="font-size: 12px; color: #fff; font-weight: bold;">C</div><div style="font-size: 20px; color: #fff; font-weight: bold;">\${difficultyStats["C"]}</div></div>\`;
    if (difficultyStats["D"] > 0) diffHtml += \`<div style="padding: 15px; background: linear-gradient(135deg, #f59e0b, #d97706); border-radius: 10px; text-align: center; box-shadow: 0 2px 10px rgba(0,0,0,0.2);"><div style="font-size: 24px;">😰</div><div style="font-size: 12px; color: #000; font-weight: bold;">D</div><div style="font-size: 20px; color: #000; font-weight: bold;">\${difficultyStats["D"]}</div></div>\`;
    if (difficultyStats["E"] > 0) diffHtml += \`<div style="padding: 15px; background: linear-gradient(135deg, #ef4444, #dc2626); border-radius: 10px; text-align: center; box-shadow: 0 2px 10px rgba(0,0,0,0.2);"><div style="font-size: 24px;">😱</div><div style="font-size: 12px; color: #fff; font-weight: bold;">E</div><div style="font-size: 20px; color: #fff; font-weight: bold;">\${difficultyStats["E"]}</div></div>\`;
    if (difficultyStats["F"] > 0) diffHtml += \`<div style="padding: 15px; background: linear-gradient(135deg, #991b1b, #7f1d1d); border-radius: 10px; text-align: center; box-shadow: 0 2px 10px rgba(0,0,0,0.2);"><div style="font-size: 24px;">💀</div><div style="font-size: 12px; color: #fff; font-weight: bold;">F</div><div style="font-size: 20px; color: #fff; font-weight: bold;">\${difficultyStats["F"]}</div></div>\`;
    diffHtml += '</div>';
    dv.paragraph(diffHtml);
    
    // 키워드별 분포
    if (topKeywords.length > 0) {
        dv.paragraph(\`\`);
        dv.paragraph(\`### 🔑 TOP 10 키워드\`);
        let keywordHtml = '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin: 20px 0;">';
        for (const [keyword, count] of topKeywords) {
            keywordHtml += \`<div style="padding: 12px; background: linear-gradient(135deg, #6366f1, #4f46e5); border-radius: 8px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.2);"><div style="font-size: 14px; color: #fff; font-weight: bold; margin-bottom: 4px;">\${keyword}</div><div style="font-size: 18px; color: #fbbf24; font-weight: bold;">\${count}개</div></div>\`;
        }
        keywordHtml += '</div>';
        dv.paragraph(keywordHtml);
    }
}
\`\`\`

---

## 🔥 최근 수정된 문제 (TOP 15)

\`\`\`dataviewjs
const folder = "${folder}";
const recent = dv.pages("\\"" + folder + "\\"")
    .where(p => !p.file.name.includes("문제목록") && 
                !p.file.name.includes("문제 대시보드") && 
                !p.file.name.includes("📊"))
    .sort(p => p.file.mtime, "desc")
    .limit(15);

// 텍스트 정리 함수
function cleanText(text, maxLength) {
    if (!text) return '';
    let cleaned = text.toString();
    cleaned = cleaned.replace(/!\[\[.*?\]\]/g, '[이미지]');
    cleaned = cleaned.replace(/\[\[(.*?)\]\]/g, '$1');
    cleaned = cleaned.replace(/\[(.*?)\]\(.*?\)/g, '$1');
    cleaned = cleaned.replace(/[#*_~\`]/g, '');
    cleaned = cleaned.replace(/[<>:"/\\\\|?*]/g, '');
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    return cleaned.length > maxLength ? cleaned.substring(0, maxLength) + '...' : cleaned;
}

if (recent.length > 0) {
    const isMobile = window.innerWidth <= 768;
    let html = '<div style="display: grid; gap: ' + (isMobile ? '12px' : '10px') + '; margin: 15px 0;">';
    
    for (const q of recent) {
        const diffIcon = q.difficulty === "A+" ? "🏆" : 
                        q.difficulty === "A" || q.difficulty === "A-" ? "⭐" : 
                        q.difficulty === "B" || q.difficulty === "B-" ? "😊" : 
                        q.difficulty === "C" ? "😐" : 
                        q.difficulty === "D" ? "😰" : 
                        q.difficulty === "E" ? "😱" : "💀";
        
        const bookmark = q.bookmarked ? "⭐ " : "";
        const timeAgo = Math.floor((Date.now() - q.file.mtime.ts) / 60000);
        const timeStr = timeAgo < 1 ? "방금" : 
                       timeAgo < 60 ? timeAgo + "분 전" : 
                       timeAgo < 1440 ? Math.floor(timeAgo/60) + "시간 전" : 
                       Math.floor(timeAgo/1440) + "일 전";
        
        const keywords = cleanText(q.keywords || q.keyword || "-", isMobile ? 15 : 20);
        const wrongCount = q["wrong-count"] || q.wrongCount || 0;
        const correctCount = q["correct-count"] || q.correctCount || 0;
        const question = cleanText(q.question || "제목 없음", isMobile ? 40 : 60);
        
        html += \`
        <a href="\${q.file.path}" style="display: block; padding: \${isMobile ? '14px' : '16px'}; background: var(--background-secondary); border: 1px solid var(--background-modifier-border); border-left: 4px solid var(--interactive-accent); border-radius: 10px; text-decoration: none; transition: transform 0.2s, box-shadow 0.2s; box-shadow: 0 1px 4px rgba(0,0,0,0.1);" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.15)'" onmouseout="this.style.transform=''; this.style.boxShadow='0 1px 4px rgba(0,0,0,0.1)'">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; gap: 8px;">
                <div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0;">
                    <span style="font-size: \${isMobile ? '20px' : '22px'}; flex-shrink: 0;">\${diffIcon}</span>
                    <span style="font-size: \${isMobile ? '12px' : '13px'}; color: var(--text-muted); font-weight: 600;">#\${q.number || "-"}</span>
                </div>
                <div style="display: flex; gap: 6px; align-items: center; flex-shrink: 0;">
                    \${wrongCount > 0 ? \`<span style="background: rgba(244,67,54,0.15); color: #f44336; padding: 3px 8px; border-radius: 5px; font-size: \${isMobile ? '11px' : '12px'}; font-weight: bold;">❌ \${wrongCount}</span>\` : correctCount > 0 ? \`<span style="background: rgba(76,175,80,0.15); color: #4caf50; padding: 3px 8px; border-radius: 5px; font-size: \${isMobile ? '11px' : '12px'}; font-weight: bold;">✓ \${correctCount}</span>\` : ''}
                    <span style="font-size: \${isMobile ? '10px' : '11px'}; color: var(--text-muted); padding: 3px 6px; background: var(--background-primary); border-radius: 4px;">🕒 \${timeStr}</span>
                </div>
            </div>
            <div style="font-size: \${isMobile ? '13px' : '14px'}; font-weight: 500; color: var(--text-normal); margin-bottom: 8px; line-height: 1.4; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">
                \${bookmark}\${question}
            </div>
            <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                <span style="font-size: \${isMobile ? '11px' : '12px'}; padding: 3px 8px; background: linear-gradient(135deg, #6366f1, #4f46e5); color: #fff; border-radius: 5px; font-weight: 500;">🔑 \${keywords}</span>
                <span style="font-size: \${isMobile ? '11px' : '12px'}; padding: 3px 8px; background: var(--background-primary); color: var(--text-muted); border-radius: 5px;">📊 \${q.difficulty || "-"}</span>
            </div>
        </a>
        \`;
    }
    
    html += '</div>';
    dv.paragraph(html);
} else {
    dv.paragraph("<p style='text-align: center; padding: 40px 20px; color: var(--text-muted); background: var(--background-secondary); border-radius: 12px; font-size: 14px; margin: 20px 0; border: 2px dashed var(--background-modifier-border);'>📝 아직 문제가 없습니다</p>");
}
\`\`\`

---

## ⭐ 북마크 문제

\`\`\`dataviewjs
const folder = "${folder}";
const bookmarked = dv.pages("\\"" + folder + "\\"")
    .where(p => !p.file.name.includes("문제목록") && 
                !p.file.name.includes("문제 대시보드") && 
                !p.file.name.includes("📊") && 
                p.bookmarked === true)
    .sort(p => p.file.mtime, "desc");

// 텍스트 정리 함수
function cleanText(text, maxLength) {
    if (!text) return '';
    let cleaned = text.toString();
    cleaned = cleaned.replace(/!\[\[.*?\]\]/g, '[이미지]');
    cleaned = cleaned.replace(/\[\[(.*?)\]\]/g, '$1');
    cleaned = cleaned.replace(/\[(.*?)\]\(.*?\)/g, '$1');
    cleaned = cleaned.replace(/[#*_~\`]/g, '');
    cleaned = cleaned.replace(/[<>:"/\\\\|?*]/g, '');
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    return cleaned.length > maxLength ? cleaned.substring(0, maxLength) + '...' : cleaned;
}

if (bookmarked.length > 0) {
    const isMobile = window.innerWidth <= 768;
    let html = '<div style="display: grid; gap: ' + (isMobile ? '10px' : '8px') + '; margin: 15px 0;">';
    
    for (const q of bookmarked) {
        const diffIcon = q.difficulty === "A+" ? "🏆" : 
                        q.difficulty === "A" || q.difficulty === "A-" ? "⭐" : 
                        q.difficulty === "B" || q.difficulty === "B-" ? "😊" : 
                        q.difficulty === "C" ? "😐" : 
                        q.difficulty === "D" ? "😰" : 
                        q.difficulty === "E" ? "😱" : "💀";
        
        const keywords = cleanText(q.keywords || q.keyword || "-", isMobile ? 15 : 25);
        const wrongCount = q["wrong-count"] || q.wrongCount || 0;
        const question = cleanText(q.question || "제목 없음", isMobile ? 35 : 50);
        
        html += \`
        <a href="\${q.file.path}" style="display: flex; align-items: center; gap: \${isMobile ? '10px' : '12px'}; padding: \${isMobile ? '12px' : '14px'}; background: var(--background-secondary); border: 1px solid rgba(255, 215, 0, 0.3); border-left: 4px solid #ffd700; border-radius: 8px; text-decoration: none; transition: transform 0.2s, box-shadow 0.2s; box-shadow: 0 1px 4px rgba(0,0,0,0.1);" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.15)'" onmouseout="this.style.transform=''; this.style.boxShadow='0 1px 4px rgba(0,0,0,0.1)'">
            <div style="font-size: \${isMobile ? '22px' : '24px'}; min-width: \${isMobile ? '28px' : '32px'}; text-align: center; flex-shrink: 0;">\${diffIcon}</div>
            <div style="flex: 1; min-width: 0;">
                <div style="font-size: \${isMobile ? '12px' : '13px'}; font-weight: 500; color: var(--text-normal); margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    ⭐ \${question}
                </div>
                <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                    <span style="font-size: \${isMobile ? '10px' : '11px'}; padding: 3px 6px; background: linear-gradient(135deg, #6366f1, #4f46e5); color: #fff; border-radius: 4px; font-weight: 500;">🔑 \${keywords}</span>
                    <span style="font-size: \${isMobile ? '10px' : '11px'}; padding: 3px 6px; background: var(--background-primary); color: var(--text-muted); border-radius: 4px;">#\${q.number || "-"}</span>
                </div>
            </div>
            \${wrongCount > 0 ? \`<div style="min-width: \${isMobile ? '50px' : '55px'}; text-align: right; flex-shrink: 0;"><span style="background: rgba(244,67,54,0.15); color: #f44336; padding: 3px 6px; border-radius: 4px; font-size: \${isMobile ? '10px' : '11px'}; font-weight: bold;">❌ \${wrongCount}</span></div>\` : \`<div style="min-width: \${isMobile ? '40px' : '45px'}; text-align: right; flex-shrink: 0;"><span style="background: rgba(76,175,80,0.15); color: #4caf50; padding: 3px 6px; border-radius: 4px; font-size: \${isMobile ? '10px' : '11px'}; font-weight: bold;">✓</span></div>\`}
        </a>
        \`;
    }
    
    html += '</div>';
    dv.paragraph(html);
} else {
    dv.paragraph("<p style='text-align: center; padding: 40px 20px; color: var(--text-muted); background: var(--background-secondary); border-radius: 12px; font-size: 14px; margin: 20px 0; border: 2px dashed var(--background-modifier-border);'>⭐ 북마크한 문제가 없습니다</p>");
}
\`\`\`

---

## ❌ 오답 많은 문제 TOP 10

\`\`\`dataviewjs
const folder = "${folder}";
const wrong = dv.pages("\\"" + folder + "\\"")
    .where(p => {
        const wrongCount = p["wrong-count"] || p.wrongCount || 0;
        return !p.file.name.includes("문제목록") && 
               !p.file.name.includes("문제 대시보드") && 
               !p.file.name.includes("📊") && 
               wrongCount > 0;
    })
    .sort(p => (p["wrong-count"] || p.wrongCount || 0), "desc")
    .limit(10);

// 텍스트 정리 함수
function cleanText(text, maxLength) {
    if (!text) return '';
    let cleaned = text.toString();
    cleaned = cleaned.replace(/!\[\[.*?\]\]/g, '[이미지]');
    cleaned = cleaned.replace(/\[\[(.*?)\]\]/g, '$1');
    cleaned = cleaned.replace(/\[(.*?)\]\(.*?\)/g, '$1');
    cleaned = cleaned.replace(/[#*_~\`]/g, '');
    cleaned = cleaned.replace(/[<>:"/\\\\|?*]/g, '');
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    return cleaned.length > maxLength ? cleaned.substring(0, maxLength) + '...' : cleaned;
}

if (wrong.length > 0) {
    const wrongData = [];
    
    for (const q of wrong) {
        const diffIcon = q.difficulty === "A+" ? "🏆" : 
                        q.difficulty === "A" || q.difficulty === "A-" ? "⭐" : 
                        q.difficulty === "B" || q.difficulty === "B-" ? "�" : 
                        q.difficulty === "C" ? "😐" : 
                        q.difficulty === "D" ? "😰" : 
                        q.difficulty === "E" ? "😱" : "💀";
        
        const keywords = cleanText(q.keywords || q.keyword || "-", 20);
        const wrongCount = q["wrong-count"] || q.wrongCount || 0;
        const correctCount = q["correct-count"] || q.correctCount || 0;
        const totalAttempts = wrongCount + correctCount;
        const accuracy = totalAttempts > 0 ? Math.round((correctCount / totalAttempts) * 100) : 0;
        const question = cleanText(q.question || "제목 없음", 50);
        
        wrongData.push([
            \`\${diffIcon} #\${q.number || "-"}\`,
            \`[[\${q.file.path}|\${question}\]]\`,
            keywords,
            q.difficulty || "-",
            \`❌ \${wrongCount}회\`,
            \`✓ \${correctCount}회\`,
            \`\${accuracy}%\`
        ]);
    }
    
    dv.table(
        ["순서", "문제", "키워드", "난이도", "오답", "정답", "정답률"],
        wrongData
    );
} else {
    dv.paragraph("<p style='text-align: center; padding: 60px 20px; color: var(--text-muted); background: var(--background-secondary); border-radius: 16px; font-size: 16px; margin: 25px 0; border: 2px dashed var(--background-modifier-border);'>✅ 오답이 없습니다!</p>");
}
\`\`\`

---

## 📝 전체 문제 목록

\`\`\`dataviewjs
const folder = "${folder}";
const allQuestions = dv.pages("\\"" + folder + "\\"")
    .where(p => !p.file.name.includes("문제목록") && 
                !p.file.name.includes("문제 대시보드") && 
                !p.file.name.includes("📊"))
    .sort(p => p.number || 0, "asc");

// 텍스트 정리 함수
function cleanText(text, maxLength) {
    if (!text) return '';
    let cleaned = text.toString();
    cleaned = cleaned.replace(/!\[\[.*?\]\]/g, '[이미지]');
    cleaned = cleaned.replace(/\[\[(.*?)\]\]/g, '$1');
    cleaned = cleaned.replace(/\[(.*?)\]\(.*?\)/g, '$1');
    cleaned = cleaned.replace(/[#*_~\`]/g, '');
    cleaned = cleaned.replace(/[<>:"/\\\\|?*]/g, '');
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    return cleaned.length > maxLength ? cleaned.substring(0, maxLength) + '...' : cleaned;
}

if (allQuestions.length > 0) {
    const tableData = [];
    
    for (const q of allQuestions) {
        const diffIcon = q.difficulty === "A+" ? "🏆" : 
                        q.difficulty === "A" || q.difficulty === "A-" ? "⭐" : 
                        q.difficulty === "B" || q.difficulty === "B-" ? "😊" : 
                        q.difficulty === "C" ? "😐" : 
                        q.difficulty === "D" ? "😰" : 
                        q.difficulty === "E" ? "😱" : "💀";
        
        const hanzi = cleanText(q.hanzi || q.title || "-", 20);
        const question = cleanText(q.question || "제목 없음", 40);
        const keywords = cleanText(q.keywords || q.keyword || "-", 20);
        const wrongCount = q["wrong-count"] || q.wrongCount || 0;
        const correctCount = q["correct-count"] || q.correctCount || 0;
        const totalAttempts = wrongCount + correctCount;
        
        const statusIcon = q.bookmarked ? "⭐" : 
                          wrongCount > 0 ? "❌" : 
                          correctCount > 0 ? "✅" : "📝";
        
        const stats = totalAttempts > 0 
            ? \`✓\${correctCount} / ❌\${wrongCount}\` 
            : "-";
        
        tableData.push([
            q.number || "-",
            hanzi,
            \`[[\${q.file.path}|\${question}]]\`,
            keywords,
            \`\${diffIcon} \${q.difficulty || "C"}\`,
            stats,
            statusIcon
        ]);
    }
    
    dv.table(
        ["번호", "한자", "문제", "키워드", "난이도", "통계", "상태"],
        tableData
    );
} else {
    dv.paragraph("<p style='text-align: center; padding: 40px 20px; color: var(--text-muted); background: var(--background-secondary); border-radius: 12px; font-size: 14px; margin: 20px 0; border: 2px dashed var(--background-modifier-border);'>📝 아직 문제가 없습니다</p>");
}
\`\`\`

---

*📅 생성일: ${dateString} | 🔄 실시간 업데이트 | 📱 모바일 최적화*
`;
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

        // 난이도별 문제 개수 계산
        const difficultyCount = {};
        ['A+', 'A', 'A-', 'B', 'B-', 'C', 'D', 'E', 'F'].forEach(diff => {
            difficultyCount[diff] = questions.filter(q => q.difficulty === diff).length;
        });

        const actions = [
            { icon: '🎯', text: '전체 퀴즈', count: questions.length, callback: () => { this.close(); this.plugin.startQuiz(); } },
            { icon: '🏆', text: 'A+ 퀴즈', count: difficultyCount['A+'], callback: () => { this.close(); this.plugin.startQuiz('A+'); } },
            { icon: '⭐', text: 'A 퀴즈', count: difficultyCount['A'], callback: () => { this.close(); this.plugin.startQuiz('A'); } },
            { icon: '⭐', text: 'A- 퀴즈', count: difficultyCount['A-'], callback: () => { this.close(); this.plugin.startQuiz('A-'); } },
            { icon: '😊', text: 'B 퀴즈', count: difficultyCount['B'], callback: () => { this.close(); this.plugin.startQuiz('B'); } },
            { icon: '😊', text: 'B- 퀴즈', count: difficultyCount['B-'], callback: () => { this.close(); this.plugin.startQuiz('B-'); } },
            { icon: '😐', text: 'C 퀴즈', count: difficultyCount['C'], callback: () => { this.close(); this.plugin.startQuiz('C'); } },
            { icon: '😰', text: 'D 퀴즈', count: difficultyCount['D'], callback: () => { this.close(); this.plugin.startQuiz('D'); } },
            { icon: '😱', text: 'E 퀴즈', count: difficultyCount['E'], callback: () => { this.close(); this.plugin.startQuiz('E'); } },
            { icon: '💀', text: 'F 퀴즈', count: difficultyCount['F'], callback: () => { this.close(); this.plugin.startQuiz('F'); } },
            { icon: '⭐', text: '북마크 퀴즈', count: stats.bookmarkedCount || 0, callback: () => { this.close(); this.plugin.startBookmarkQuiz(); } },
            { icon: '❌', text: '오답 복습', count: stats.wrongCount || 0, callback: () => { this.close(); this.plugin.startWrongAnswerQuiz(); } },
            { icon: '📝', text: '문제 만들기', callback: () => { this.close(); new HanziQuestionModal(this.app, this.plugin).open(); } },
            { icon: '📋', text: '문제 목록', callback: () => { this.close(); this.plugin.viewQuestionList(); } },
            { icon: '🔑', text: '키워드 목록', callback: () => { this.close(); this.plugin.viewKeywordList(); } },
            { icon: '⭐', text: '북마크 목록', callback: () => { this.close(); this.plugin.viewBookmarkList(); } },
            { icon: '❌', text: '오답 목록', callback: () => { this.close(); this.plugin.viewWrongAnswerList(); } },
            { icon: '📈', text: '학습 통계', callback: () => { this.close(); this.plugin.viewStatistics(); } },
            { icon: '📂', text: '폴더 관리', callback: () => { this.close(); new FolderManagementModal(this.app, this.plugin).open(); } },
            { icon: '⚙️', text: '플러그인 설정', callback: () => { this.close(); this.app.setting.open(); this.app.setting.openTabById('hanzi-quiz'); } },
            { icon: '🎯', text: '통합 대시보드', callback: async () => { this.close(); await this.plugin.createIntegratedDashboard(); } }
        ];

        actions.forEach(action => {
            const btn = actionsGrid.createEl('button', { 
                text: action.count !== undefined ? `${action.icon} ${action.text} (${action.count})` : `${action.icon} ${action.text}`,
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
                max-width: 1200px;
                margin: 0 auto;
                width: 100%;
                box-sizing: border-box;
                overflow-x: hidden;
            }
            .dashboard-header h1 {
                text-align: center;
                margin-bottom: 30px;
                word-wrap: break-word;
            }
            .stats-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                gap: 15px;
                margin-bottom: 30px;
                width: 100%;
            }
            .stat-card {
                padding: 20px;
                background: var(--background-secondary);
                border-radius: 8px;
                text-align: center;
                box-sizing: border-box;
                overflow: hidden;
            }
            .stat-icon {
                font-size: 32px;
                margin-bottom: 10px;
            }
            .stat-value {
                font-size: 24px;
                font-weight: bold;
                margin-bottom: 5px;
                word-break: break-all;
            }
            .stat-label {
                font-size: 14px;
                color: var(--text-muted);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .actions-section, .history-section, .wrong-section, .folders-quiz-section {
                margin-bottom: 30px;
                width: 100%;
                box-sizing: border-box;
            }
            .actions-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                gap: 10px;
                width: 100%;
            }
            .action-button {
                padding: 15px;
                font-size: 14px;
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.2s;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                box-sizing: border-box;
                width: 100%;
            }
            .action-button:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 8px rgba(0,0,0,0.1);
            }
            .history-list, .wrong-list {
                list-style: none;
                padding: 0;
                width: 100%;
                box-sizing: border-box;
            }
            .history-list li, .wrong-list li {
                padding: 10px;
                margin-bottom: 5px;
                background: var(--background-secondary);
                border-radius: 5px;
                word-wrap: break-word;
                overflow-wrap: break-word;
            }
            .folders-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 15px;
                width: 100%;
            }
            .folder-card {
                padding: 15px;
                background: var(--background-secondary);
                border-radius: 8px;
                border: 2px solid var(--background-modifier-border);
                transition: all 0.2s;
                box-sizing: border-box;
                overflow: hidden;
                width: 100%;
            }
            .folder-card:hover {
                border-color: var(--interactive-accent);
                transform: translateY(-2px);
                box-shadow: 0 4px 8px rgba(0,0,0,0.1);
            }
            .folder-header h3 {
                margin: 0 0 10px 0;
                font-size: 18px;
                word-wrap: break-word;
                overflow-wrap: break-word;
            }
            .folder-stats {
                margin-bottom: 10px;
                color: var(--text-muted);
                font-size: 14px;
            }
            .folder-action-btn {
                flex: 1;
                padding: 8px;
                font-size: 13px;
                border-radius: 5px;
                cursor: pointer;
                transition: all 0.2s;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                min-width: 0;
            }
            .folder-action-btn:hover {
                transform: scale(1.05);
            }
            .recent-section {
                margin-bottom: 30px;
                width: 100%;
                box-sizing: border-box;
            }
            .recent-list {
                list-style: none;
                padding: 0;
                width: 100%;
            }
            .recent-list li {
                padding: 12px;
                margin-bottom: 5px;
                background: var(--background-secondary);
                border-radius: 5px;
                transition: all 0.2s;
                word-wrap: break-word;
                overflow-wrap: break-word;
            }
            .recent-list li:hover {
                background: var(--background-modifier-hover);
                transform: translateX(5px);
            }
            
            /* 모바일 반응형 */
            @media (max-width: 768px) {
                .hanzi-quiz-dashboard {
                    padding: 12px;
                }
                
                /* 입력 필드 - 최대 크기 */
                input[type="text"],
                input[type="number"],
                textarea,
                select {
                    font-size: 18px !important;
                    padding: 16px !important;
                    min-height: 54px !important;
                    line-height: 1.6 !important;
                }
                
                textarea {
                    min-height: 150px !important;
                }
                
                /* 퀴즈 선택지 - 최대 크기 */
                .option-button,
                .quiz-option-button {
                    min-height: 70px !important;
                    padding: 20px 24px !important;
                    font-size: 19px !important;
                    line-height: 1.7 !important;
                    font-weight: 500 !important;
                }
                
                /* 문제 제목/내용 - 큰 크기 */
                .question-title,
                .question-text {
                    font-size: 20px !important;
                    line-height: 1.7 !important;
                    padding: 16px !important;
                }
                
                /* 힌트/노트 영역 - 큰 크기 */
                .hint-section,
                .note-section {
                    padding: 18px !important;
                    font-size: 17px !important;
                    line-height: 1.6 !important;
                }
                
                /* 버튼 - 작은 크기 */
                button,
                .button,
                .mod-cta,
                .action-button,
                .folder-action-btn {
                    padding: 8px 14px !important;
                    font-size: 13px !important;
                    min-height: 38px !important;
                    max-height: 38px !important;
                }
                
                .stats-grid {
                    grid-template-columns: repeat(2, 1fr);
                    gap: 10px;
                }
                .stat-card {
                    padding: 12px;
                    min-height: 44px;
                }
                .stat-icon {
                    font-size: 24px;
                }
                .stat-value {
                    font-size: 20px;
                }
                .actions-grid {
                    grid-template-columns: 1fr;
                }
                .folders-grid {
                    grid-template-columns: 1fr;
                }
            }
            
            @media (max-width: 480px) {
                .stats-grid {
                    grid-template-columns: 1fr;
                }
                .folder-header h3 {
                    font-size: 16px;
                }
            }
        `;
        document.head.appendChild(style);
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// 📋 문제 대시보드 모달
class QuestionDashboardModal extends Modal {
    constructor(app, plugin) {
        super(app);
        this.plugin = plugin;
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('question-dashboard-modal');

        // 모달 컨테이너 참조 저장
        const modalContainer = this.containerEl.parentElement;
        
        // 헤더
        const header = contentEl.createDiv({ cls: 'qd-header' });
        
        // 헤더 왼쪽 (제목)
        const headerLeft = header.createDiv({ cls: 'qd-header-left-section' });
        headerLeft.createEl('h1', { text: '📋 문제 대시보드', cls: 'qd-title' });
        headerLeft.createEl('p', { text: '전체 문제를 한눈에 확인하고 관리하세요', cls: 'qd-subtitle' });
        
        // 헤더 오른쪽 (전체화면 버튼)
        const headerRight = header.createDiv({ cls: 'qd-header-right-section' });
        const fullscreenBtn = headerRight.createEl('button', { 
            text: '⛶ 전체화면', 
            cls: 'qd-fullscreen-btn' 
        });
        
        let isFullscreen = false;
        fullscreenBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            isFullscreen = !isFullscreen;
            if (isFullscreen) {
                modalContainer.addClass('qd-fullscreen-mode');
                contentEl.addClass('qd-fullscreen-content');
                fullscreenBtn.textContent = '⊡ 원래 크기';
            } else {
                modalContainer.removeClass('qd-fullscreen-mode');
                contentEl.removeClass('qd-fullscreen-content');
                fullscreenBtn.textContent = '⛶ 전체화면';
            }
        });

        // 문제 로딩
        console.log('🔍 문제 대시보드 모달: 문제 로딩 시작');
        const questions = await this.plugin.loadAllQuestions();
        console.log(`📊 로딩된 문제 수: ${questions.length}개`);
        if (questions.length > 0) {
            console.log('📝 첫 번째 문제:', questions[0]);
        }
        
        // 통계 섹션
        const statsContainer = contentEl.createDiv({ cls: 'qd-stats-container' });
        this.renderStats(statsContainer, questions);

        // 필터 & 검색 섹션
        const filterContainer = contentEl.createDiv({ cls: 'qd-filter-container' });
        this.renderFilters(filterContainer, questions);

        // 문제 목록 섹션
        const questionsContainer = contentEl.createDiv({ cls: 'qd-questions-container' });
        this.renderQuestions(questionsContainer, questions);

        // 스타일 추가
        this.addStyles();
    }

    renderStats(container, questions) {
        const stats = container.createDiv({ cls: 'qd-stats-grid' });

        // 총 문제 수
        const totalCard = stats.createDiv({ cls: 'qd-stat-card qd-stat-total' });
        totalCard.createEl('div', { text: '📚', cls: 'qd-stat-icon' });
        totalCard.createEl('div', { text: questions.length.toString(), cls: 'qd-stat-value' });
        totalCard.createEl('div', { text: '총', cls: 'qd-stat-label' });

        // 난이도별 집계
        const difficultyCount = {};
        questions.forEach(q => {
            const diff = q.difficulty || 'C';
            difficultyCount[diff] = (difficultyCount[diff] || 0) + 1;
        });

        // 북마크
        const bookmarkedCount = questions.filter(q => q.bookmarked).length;
        const bookmarkCard = stats.createDiv({ cls: 'qd-stat-card' });
        bookmarkCard.style.borderLeft = '4px solid gold';
        bookmarkCard.createEl('div', { text: '⭐', cls: 'qd-stat-icon' });
        bookmarkCard.createEl('div', { text: bookmarkedCount.toString(), cls: 'qd-stat-value' });
        bookmarkCard.createEl('div', { text: '북마크', cls: 'qd-stat-label' });

        // 오답
        const wrongCount = questions.filter(q => q.wrongCount > 0).length;
        const wrongCard = stats.createDiv({ cls: 'qd-stat-card' });
        wrongCard.style.borderLeft = '4px solid #f44336';
        wrongCard.createEl('div', { text: '❌', cls: 'qd-stat-icon' });
        wrongCard.createEl('div', { text: wrongCount.toString(), cls: 'qd-stat-value' });
        wrongCard.createEl('div', { text: '오답', cls: 'qd-stat-label' });

        // 난이도 A ~ C만 표시 (공간 절약)
        const difficultyCards = [
            { diff: 'A+', icon: '🏆', color: '#ff6b6b', label: 'A+' },
            { diff: 'A', icon: '⭐', color: '#ffa500', label: 'A' },
            { diff: 'B', icon: '😊', color: '#4caf50', label: 'B' }
        ];

        difficultyCards.forEach(({ diff, icon, color, label }) => {
            const count = difficultyCount[diff] || 0;
            const card = stats.createDiv({ cls: 'qd-stat-card' });
            card.style.borderLeft = `4px solid ${color}`;
            card.createEl('div', { text: icon, cls: 'qd-stat-icon' });
            card.createEl('div', { text: count.toString(), cls: 'qd-stat-value' });
            card.createEl('div', { text: label, cls: 'qd-stat-label' });
        });
    }

    renderFilters(container, questions) {
        const filterHeader = container.createDiv({ cls: 'qd-filter-header' });
        filterHeader.createEl('h2', { text: '🔍 필터 & 정렬', cls: 'qd-filter-title' });

        const filterControls = container.createDiv({ cls: 'qd-filter-controls' });

        // 검색창
        const searchContainer = filterControls.createDiv({ cls: 'qd-search-container' });
        const searchInput = searchContainer.createEl('input', {
            type: 'text',
            placeholder: '🔍 문제 검색 (한자, 키워드, 설명...)',
            cls: 'qd-search-input'
        });

        // 폴더 필터
        const folderFilter = filterControls.createDiv({ cls: 'qd-folder-filter' });
        folderFilter.createEl('label', { text: '📂 폴더: ', cls: 'qd-filter-label' });
        const folderSelect = folderFilter.createEl('select', { cls: 'qd-select' });
        folderSelect.createEl('option', { text: '전체', value: 'all' });
        
        const folders = [...new Set(questions.map(q => q.folder || '기본'))];
        folders.forEach(folder => {
            folderSelect.createEl('option', { text: folder, value: folder });
        });

        // 난이도 필터
        const difficultyFilter = filterControls.createDiv({ cls: 'qd-difficulty-filter' });
        difficultyFilter.createEl('label', { text: '⭐ 난이도: ', cls: 'qd-filter-label' });
        const difficultySelect = difficultyFilter.createEl('select', { cls: 'qd-select' });
        difficultySelect.createEl('option', { text: '전체', value: 'all' });
        ['A+', 'A', 'A-', 'B', 'B-', 'C', 'D', 'E', 'F'].forEach(diff => {
            difficultySelect.createEl('option', { text: diff, value: diff });
        });

        // 정렬
        const sortFilter = filterControls.createDiv({ cls: 'qd-sort-filter' });
        sortFilter.createEl('label', { text: '🔄 정렬: ', cls: 'qd-filter-label' });
        const sortSelect = sortFilter.createEl('select', { cls: 'qd-select' });
        sortSelect.createEl('option', { text: '최근 수정', value: 'recent' });
        sortSelect.createEl('option', { text: '문제 번호', value: 'number' });
        sortSelect.createEl('option', { text: '난이도', value: 'difficulty' });
        sortSelect.createEl('option', { text: '오답 많은 순', value: 'wrong' });

        // 필터 이벤트
        const applyFilters = () => {
            const searchTerm = searchInput.value.toLowerCase();
            const selectedFolder = folderSelect.value;
            const selectedDifficulty = difficultySelect.value;
            const sortBy = sortSelect.value;

            let filtered = questions.filter(q => {
                const matchSearch = !searchTerm || 
                    q.hanzi?.toLowerCase().includes(searchTerm) ||
                    q.question?.toLowerCase().includes(searchTerm) ||
                    q.keywords?.some(k => k.toLowerCase().includes(searchTerm));
                const matchFolder = selectedFolder === 'all' || (q.folder || '기본') === selectedFolder;
                const matchDifficulty = selectedDifficulty === 'all' || q.difficulty === selectedDifficulty;
                return matchSearch && matchFolder && matchDifficulty;
            });

            // 정렬
            switch (sortBy) {
                case 'recent':
                    filtered.sort((a, b) => (b.mtime || 0) - (a.mtime || 0));
                    break;
                case 'number':
                    filtered.sort((a, b) => parseInt(a.number || '0') - parseInt(b.number || '0'));
                    break;
                case 'difficulty':
                    const diffOrder = ['F', 'E', 'D', 'C', 'B-', 'B', 'A-', 'A', 'A+'];
                    filtered.sort((a, b) => diffOrder.indexOf(b.difficulty || 'C') - diffOrder.indexOf(a.difficulty || 'C'));
                    break;
                case 'wrong':
                    filtered.sort((a, b) => (b.wrongCount || 0) - (a.wrongCount || 0));
                    break;
            }

            const questionsContainer = this.contentEl.querySelector('.qd-questions-container');
            questionsContainer.empty();
            this.renderQuestions(questionsContainer, filtered);
        };

        searchInput.addEventListener('input', applyFilters);
        folderSelect.addEventListener('change', applyFilters);
        difficultySelect.addEventListener('change', applyFilters);
        sortSelect.addEventListener('change', applyFilters);
    }

    renderQuestions(container, questions) {
        container.empty();
        
        console.log(`🎨 renderQuestions 호출: ${questions.length}개 문제`);

        if (questions.length === 0) {
            container.createEl('p', { text: '😢 문제가 없습니다.', cls: 'qd-no-questions' });
            return;
        }

        const grid = container.createDiv({ cls: 'qd-questions-grid' });
        
        console.log('📦 그리드 생성 완료, 카드 렌더링 시작');

        questions.forEach((q, index) => {
            if (index < 3) {
                console.log(`카드 ${index + 1}:`, {
                    hanzi: q.hanzi,
                    title: q.title,
                    question: q.question?.substring(0, 30),
                    number: q.number,
                    folder: q.folder,
                    difficulty: q.difficulty
                });
            }
            
            const card = grid.createDiv({ cls: 'qd-question-card' });

            // 카드 클릭 → 파일 열기 (모바일 최적화)
            card.addEventListener('click', async (e) => {
                if (e.target.tagName === 'BUTTON') return; // 버튼 클릭 제외
                
                try {
                    const file = this.app.vault.getAbstractFileByPath(q.filePath);
                    if (file) {
                        this.close();
                        
                        // 모바일 감지
                        const isMobile = this.app.isMobile || window.innerWidth <= 768;
                        
                        if (isMobile) {
                            // 모바일: 현재 리프에서 열기
                            const leaf = this.app.workspace.getLeaf();
                            await leaf.openFile(file);
                        } else {
                            // 데스크톱: 새 탭 또는 현재 탭
                            const leaf = this.app.workspace.getLeaf(false);
                            await leaf.openFile(file);
                        }
                    } else {
                        new Notice('❌ 파일을 찾을 수 없습니다');
                    }
                } catch (error) {
                    console.error('파일 열기 오류:', error);
                    new Notice('❌ 파일 열기 실패: ' + error.message);
                }
            });

            // 헤더 (한자 + 번호)
            const cardHeader = card.createDiv({ cls: 'qd-card-header' });
            
            const headerLeft = cardHeader.createDiv({ cls: 'qd-header-left' });
            const displayHanzi = this.cleanText(q.hanzi || q.title || '-', 20);
            headerLeft.createEl('div', { text: displayHanzi, cls: 'qd-card-hanzi' });
            
            const headerRight = cardHeader.createDiv({ cls: 'qd-header-right' });
            headerRight.createEl('div', { text: `#${q.number || '?'}`, cls: 'qd-card-number' });

            // 문제 (이미지 링크 및 특수문자 제거)
            const cardQuestion = card.createDiv({ cls: 'qd-card-question' });
            const displayText = this.cleanText(q.question || '문제 없음', 50);
            cardQuestion.textContent = displayText;

            // 메타 정보
            const cardMeta = card.createDiv({ cls: 'qd-card-meta' });

            // 난이도
            const diffIcon = this.getDifficultyIcon(q.difficulty);
            const diffBadge = cardMeta.createEl('span', { cls: 'qd-badge qd-badge-diff' });
            diffBadge.textContent = `${diffIcon} ${q.difficulty || 'C'}`;
            diffBadge.style.background = this.getDifficultyColor(q.difficulty);

            // 폴더 (텍스트 정리)
            const displayFolder = this.cleanText(q.folder || '기본', 10);
            const folderBadge = cardMeta.createEl('span', { cls: 'qd-badge qd-badge-folder' });
            folderBadge.textContent = `📁 ${displayFolder}`;

            // 북마크
            if (q.bookmarked) {
                const bookmarkBadge = cardMeta.createEl('span', { cls: 'qd-badge qd-badge-bookmark' });
                bookmarkBadge.textContent = '⭐ 북마크';
                bookmarkBadge.style.background = 'gold';
                bookmarkBadge.style.color = '#000';
            }

            // 오답
            if (q.wrongCount > 0) {
                const wrongBadge = cardMeta.createEl('span', { cls: 'qd-badge qd-badge-wrong' });
                wrongBadge.textContent = `❌ ${q.wrongCount}회`;
                wrongBadge.style.background = '#f44336';
            }

            // 정답
            if (q.correctCount > 0) {
                const correctBadge = cardMeta.createEl('span', { cls: 'qd-badge qd-badge-correct' });
                correctBadge.textContent = `✅ ${q.correctCount}회`;
                correctBadge.style.background = '#4caf50';
            }

            // 수정 시간
            if (q.mtime) {
                const timeAgo = this.getTimeAgo(q.mtime);
                const timeBadge = cardMeta.createEl('span', { cls: 'qd-badge qd-badge-time' });
                timeBadge.textContent = `🕒 ${timeAgo}`;
                timeBadge.style.background = 'var(--background-secondary)';
                timeBadge.style.color = 'var(--text-muted)';
            }

            // 키워드 (텍스트 정리)
            if (q.keywords && q.keywords.length > 0) {
                const keywordContainer = card.createDiv({ cls: 'qd-card-keywords' });
                q.keywords.slice(0, 3).forEach(kw => {
                    const displayKw = this.cleanText(kw, 15);
                    
                    if (displayKw) {
                        const kwBadge = keywordContainer.createEl('span', { cls: 'qd-keyword-badge' });
                        kwBadge.textContent = `🔑 ${displayKw}`;
                    }
                });
            }

            // 액션 버튼
            const cardActions = card.createDiv({ cls: 'qd-card-actions' });

            const editBtn = cardActions.createEl('button', { text: '✏️ 수정', cls: 'qd-action-btn qd-btn-edit' });
            editBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                
                try {
                    const file = this.app.vault.getAbstractFileByPath(q.filePath);
                    if (file) {
                        this.close();
                        
                        const isMobile = this.app.isMobile || window.innerWidth <= 768;
                        const leaf = isMobile ? this.app.workspace.getLeaf() : this.app.workspace.getLeaf(false);
                        await leaf.openFile(file);
                    }
                } catch (error) {
                    console.error('수정 버튼 오류:', error);
                    new Notice('❌ 파일 열기 실패');
                }
            });

            const quizBtn = cardActions.createEl('button', { text: '🎯 퀴즈', cls: 'qd-action-btn qd-btn-quiz' });
            quizBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.close();
                this.plugin.startQuiz(q.difficulty, false, q.folder);
            });

            const bookmarkBtn = cardActions.createEl('button', { 
                text: q.bookmarked ? '⭐ 해제' : '⭐ 북마크', 
                cls: 'qd-action-btn qd-btn-bookmark' 
            });
            bookmarkBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await this.toggleBookmark(q);
                // 재렌더링
                const allQuestions = await this.plugin.loadAllQuestions();
                this.renderQuestions(container, allQuestions);
            });
        });
    }

    // 텍스트 정리 유틸리티 함수
    cleanText(text, maxLength = 50) {
        if (!text) return '';
        
        let cleaned = text.toString();
        
        // 이미지 링크 제거: ![[파일명]]
        cleaned = cleaned.replace(/!\[\[.*?\]\]/g, '[이미지]');
        
        // 위키 링크 제거: [[링크]]
        cleaned = cleaned.replace(/\[\[(.*?)\]\]/g, '$1');
        
        // 마크다운 링크 제거: [텍스트](url)
        cleaned = cleaned.replace(/\[(.*?)\]\(.*?\)/g, '$1');
        
        // 마크다운 서식 제거: #, *, _, ~, `
        cleaned = cleaned.replace(/[#*_~`]/g, '');
        
        // 특수 파일 문자 제거
        cleaned = cleaned.replace(/[<>:"/\\|?*]/g, '');
        
        // 여러 공백을 하나로
        cleaned = cleaned.replace(/\s+/g, ' ').trim();
        
        // 길이 제한
        if (cleaned.length > maxLength) {
            return cleaned.substring(0, maxLength) + '...';
        }
        
        return cleaned;
    }

    getDifficultyIcon(difficulty) {
        const icons = {
            'A+': '🏆',
            'A': '⭐',
            'A-': '⭐',
            'B': '😊',
            'B-': '😊',
            'C': '😐',
            'D': '😰',
            'E': '😱',
            'F': '💀'
        };
        return icons[difficulty] || '😐';
    }

    getDifficultyColor(difficulty) {
        const colors = {
            'A+': '#ff6b6b',
            'A': '#ffa500',
            'A-': '#ffc107',
            'B': '#4caf50',
            'B-': '#8bc34a',
            'C': '#2196f3',
            'D': '#9c27b0',
            'E': '#e91e63',
            'F': '#000'
        };
        return colors[difficulty] || '#2196f3';
    }

    getTimeAgo(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return '방금 전';
        if (minutes < 60) return `${minutes}분 전`;
        if (hours < 24) return `${hours}시간 전`;
        if (days < 7) return `${days}일 전`;
        if (days < 30) return `${Math.floor(days / 7)}주 전`;
        if (days < 365) return `${Math.floor(days / 30)}개월 전`;
        return `${Math.floor(days / 365)}년 전`;
    }

    async toggleBookmark(question) {
        const file = this.app.vault.getAbstractFileByPath(question.filePath);
        if (!file) return;

        const content = await this.app.vault.read(file);
        const newBookmarked = !question.bookmarked;
        
        // frontmatter 업데이트
        const newContent = content.replace(
            /^(---\n[\s\S]*?bookmarked:\s*)(true|false)([\s\S]*?---)/,
            `$1${newBookmarked}$3`
        );

        await this.app.vault.modify(file, newContent);
        new Notice(newBookmarked ? '⭐ 북마크에 추가되었습니다' : '북마크가 해제되었습니다');
    }

    addStyles() {
        const isMobile = this.app.isMobile || window.innerWidth <= 768;
        const style = document.createElement('style');
        style.id = 'qd-modal-styles';
        style.textContent = `
            /* ============================================
               전체화면 모드 스타일
               ============================================ */
            .modal.qd-fullscreen-mode {
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                right: 0 !important;
                bottom: 0 !important;
                width: 100vw !important;
                height: 100vh !important;
                max-width: 100vw !important;
                max-height: 100vh !important;
                margin: 0 !important;
                padding: 0 !important;
                border-radius: 0 !important;
            }
            
            .modal.qd-fullscreen-mode .modal-container {
                width: 100vw !important;
                height: 100vh !important;
                max-width: 100vw !important;
                max-height: 100vh !important;
                margin: 0 !important;
                padding: 0 !important;
                border-radius: 0 !important;
            }
            
            .qd-fullscreen-content {
                height: 100vh !important;
                max-height: 100vh !important;
                overflow-y: auto !important;
            }
            
            /* ============================================
               기본 모달 스타일
               ============================================ */
            .question-dashboard-modal {
                padding: 0;
                max-width: ${isMobile ? '100vw' : '95vw'};
                width: ${isMobile ? '100%' : '1400px'};
                max-height: ${isMobile ? '100vh' : '90vh'};
                overflow-y: auto;
            }
            
            /* ============================================
               헤더 스타일
               ============================================ */
            .qd-header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: ${isMobile ? '15px 10px' : '20px 20px'};
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 15px;
                margin-bottom: ${isMobile ? '15px' : '20px'};
                position: sticky;
                top: 0;
                z-index: 10;
            }
            
            .qd-header-left-section {
                flex: 1;
                min-width: 0;
            }
            
            .qd-header-right-section {
                display: flex;
                align-items: center;
                gap: 10px;
                flex-shrink: 0;
            }
            
            .qd-fullscreen-btn {
                padding: ${isMobile ? '10px 14px' : '12px 18px'};
                background: rgba(255, 255, 255, 0.15);
                color: white;
                border: 2px solid rgba(255, 255, 255, 0.4);
                border-radius: 8px;
                cursor: pointer;
                font-size: ${isMobile ? '0.9rem' : '1rem'};
                font-weight: 600;
                transition: all 0.3s ease;
                white-space: nowrap;
                box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            }
            
            .qd-fullscreen-btn:hover {
                background: rgba(255, 255, 255, 0.25);
                border-color: rgba(255, 255, 255, 0.6);
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            }
            
            .qd-fullscreen-btn:active {
                transform: translateY(0);
                box-shadow: 0 2px 6px rgba(0,0,0,0.2);
            }
            
            .qd-title {
                font-size: ${isMobile ? '1.4rem' : '2rem'};
                margin: 0 0 6px 0;
                font-weight: 700;
                text-shadow: 0 2px 4px rgba(0,0,0,0.2);
            }
            
            .qd-subtitle {
                margin: 0;
                opacity: 0.95;
                font-size: ${isMobile ? '0.85rem' : '1rem'};
                font-weight: 400;
            }
            
            /* ============================================
               통계 카드 스타일
               ============================================ */
            .qd-stats-container {
                padding: ${isMobile ? '12px' : '15px'};
                background: var(--background-secondary);
                margin: 0 ${isMobile ? '10px' : '15px'} ${isMobile ? '12px' : '15px'} ${isMobile ? '10px' : '15px'};
                border-radius: 8px;
            }
            .qd-stats-grid {
                display: grid;
                grid-template-columns: ${isMobile ? 'repeat(3, 1fr)' : 'repeat(auto-fit, minmax(120px, 1fr))'};
                gap: ${isMobile ? '8px' : '12px'};
            }
            .qd-stat-card {
                background: var(--background-primary);
                padding: ${isMobile ? '10px 6px' : '15px'};
                border-radius: 8px;
                text-align: center;
                border-left: 3px solid #2196f3;
                box-shadow: 0 1px 4px rgba(0,0,0,0.1);
            }
            .qd-stat-icon {
                font-size: ${isMobile ? '1.2rem' : '1.8rem'};
                margin-bottom: ${isMobile ? '4px' : '8px'};
            }
            .qd-stat-value {
                font-size: ${isMobile ? '1rem' : '1.5rem'};
                font-weight: bold;
                color: var(--text-accent);
            }
            .qd-stat-label {
                font-size: ${isMobile ? '0.65rem' : '0.85rem'};
                color: var(--text-muted);
                margin-top: 3px;
            }
            .qd-filter-container {
                padding: ${isMobile ? '12px' : '15px'};
                background: var(--background-secondary);
                margin: 0 ${isMobile ? '10px' : '15px'} ${isMobile ? '12px' : '15px'} ${isMobile ? '10px' : '15px'};
                border-radius: 8px;
            }
            .qd-filter-title {
                margin: 0 0 12px 0;
                font-size: ${isMobile ? '1rem' : '1.1rem'};
                font-weight: bold;
            }
            .qd-filter-controls {
                display: grid;
                grid-template-columns: ${isMobile ? '1fr' : '2fr 1fr 1fr 1fr'};
                gap: ${isMobile ? '10px' : '12px'};
                align-items: center;
            }
            .qd-search-container {
                width: 100%;
            }
            .qd-search-input {
                width: 100%;
                padding: ${isMobile ? '10px 12px' : '10px 15px'};
                border: 1px solid var(--background-modifier-border);
                border-radius: 6px;
                font-size: ${isMobile ? '0.9rem' : '1rem'};
                background: var(--background-primary);
                color: var(--text-normal);
            }
            .qd-search-input:focus {
                outline: none;
                border-color: #667eea;
            }
            .qd-filter-label {
                font-weight: bold;
                margin-right: 8px;
                font-size: ${isMobile ? '0.85rem' : '0.9rem'};
            }
            .qd-select {
                padding: ${isMobile ? '10px' : '8px 12px'};
                border: 1px solid var(--background-modifier-border);
                border-radius: 6px;
                background: var(--background-primary);
                color: var(--text-normal);
                cursor: pointer;
                font-size: ${isMobile ? '0.9rem' : '1rem'};
            }
            .qd-questions-container {
                padding: 0 ${isMobile ? '8px' : '12px'} ${isMobile ? '12px' : '15px'} ${isMobile ? '8px' : '12px'};
            }
            .qd-questions-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(${isMobile ? '100%' : '240px'}, 1fr));
                gap: ${isMobile ? '10px' : '12px'};
            }
            .qd-question-card {
                background: var(--background-primary);
                border: 1px solid var(--background-modifier-border);
                border-radius: 6px;
                padding: ${isMobile ? '12px' : '12px'};
                cursor: pointer;
                transition: all 0.2s ease;
                box-shadow: 0 1px 3px rgba(0,0,0,0.08);
            }
            .qd-question-card:hover {
                transform: ${isMobile ? 'none' : 'translateY(-2px)'};
                box-shadow: ${isMobile ? '0 1px 3px rgba(0,0,0,0.08)' : '0 4px 12px rgba(0,0,0,0.12)'};
                border-color: ${isMobile ? 'var(--background-modifier-border)' : '#667eea'};
            }
            .qd-question-card:active {
                opacity: ${isMobile ? '0.8' : '1'};
            }
            .qd-card-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 8px;
                padding-bottom: 8px;
                border-bottom: 1px solid var(--background-modifier-border);
            }
            .qd-header-left {
                flex: 1;
                min-width: 0;
            }
            .qd-card-hanzi {
                font-size: ${isMobile ? '1.3rem' : '1.5rem'};
                font-weight: bold;
                color: var(--text-accent);
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            .qd-header-right {
                flex-shrink: 0;
                margin-left: 8px;
            }
            .qd-card-number {
                font-size: ${isMobile ? '0.75rem' : '0.8rem'};
                color: var(--text-muted);
                background: var(--background-secondary);
                padding: 3px 6px;
                border-radius: 3px;
                font-weight: 600;
            }
            .qd-card-question {
                margin-bottom: 8px;
                font-size: ${isMobile ? '0.85rem' : '0.9rem'};
                line-height: 1.3;
                color: var(--text-normal);
                overflow: hidden;
                text-overflow: ellipsis;
                display: -webkit-box;
                -webkit-line-clamp: 2;
                -webkit-box-orient: vertical;
            }
            .qd-card-meta {
                display: flex;
                flex-wrap: wrap;
                gap: 4px;
                margin-bottom: 8px;
            }
            .qd-badge {
                display: inline-block;
                padding: ${isMobile ? '3px 6px' : '4px 8px'};
                border-radius: 3px;
                font-size: ${isMobile ? '0.7rem' : '0.75rem'};
                font-weight: 600;
                color: white;
            }
            .qd-badge-diff {
                background: #2196f3;
            }
            .qd-badge-folder {
                background: #4caf50;
            }
            .qd-badge-bookmark {
                background: gold;
                color: #000;
            }
            .qd-badge-wrong {
                background: #f44336;
            }
            .qd-badge-correct {
                background: #4caf50;
            }
            .qd-badge-time {
                background: var(--background-secondary);
                color: var(--text-muted);
            }
            .qd-card-keywords {
                display: flex;
                flex-wrap: wrap;
                gap: 4px;
                margin-bottom: 8px;
            }
            .qd-keyword-badge {
                background: linear-gradient(135deg, #6366f1, #4f46e5);
                color: white;
                padding: 2px 6px;
                border-radius: 3px;
                font-size: ${isMobile ? '0.65rem' : '0.7rem'};
                font-weight: 500;
            }
            .qd-card-actions {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 5px;
                margin-top: 8px;
                padding-top: 8px;
                border-top: 1px solid var(--background-modifier-border);
            }
            .qd-action-btn {
                padding: ${isMobile ? '8px 4px' : '6px 8px'};
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: ${isMobile ? '0.75rem' : '0.8rem'};
                font-weight: 600;
                transition: all 0.2s ease;
                min-height: ${isMobile ? '40px' : 'auto'};
                -webkit-tap-highlight-color: transparent;
            }
            .qd-btn-edit {
                background: #2196f3;
                color: white;
            }
            .qd-btn-edit:hover {
                background: ${isMobile ? '#2196f3' : '#1976d2'};
            }
            .qd-btn-edit:active {
                opacity: 0.8;
            }
            .qd-btn-quiz {
                background: #4caf50;
                color: white;
            }
            .qd-btn-quiz:hover {
                background: ${isMobile ? '#4caf50' : '#388e3c'};
            }
            .qd-btn-quiz:active {
                opacity: 0.8;
            }
            .qd-btn-bookmark {
                background: #ffc107;
                color: #000;
            }
            .qd-btn-bookmark:hover {
                background: ${isMobile ? '#ffc107' : '#ffa000'};
            }
            .qd-btn-bookmark:active {
                opacity: 0.8;
            }
            .qd-no-questions {
                text-align: center;
                padding: ${isMobile ? '30px 20px' : '40px'};
                font-size: ${isMobile ? '1rem' : '1.2rem'};
                color: var(--text-muted);
            }
        `;
        document.head.appendChild(style);
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
        
        // 모달 컨테이너에서 전체화면 클래스 제거
        const modalContainer = this.containerEl.parentElement;
        if (modalContainer) {
            modalContainer.removeClass('qd-fullscreen-mode');
        }
        
        // 스타일 제거
        const existingStyle = document.getElementById('qd-modal-styles');
        if (existingStyle) {
            existingStyle.remove();
        }
    }
}

// 📊 문제 목록 대시보드 모달 (폴더별 관리)
class QuestionListDashboardModal extends Modal {
    constructor(app, plugin) {
        super(app);
        this.plugin = plugin;
        this.isMobile = this.app.isMobile || window.innerWidth <= 768;
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('question-list-dashboard-modal');

        // 헤더
        const header = contentEl.createDiv({ cls: 'qld-header' });
        
        // 뒤로가기 버튼 추가
        const backBtn = header.createEl('button', { text: '← 대시보드', cls: 'qld-back-btn' });
        backBtn.addEventListener('click', async () => {
            this.close();
            new QuestionDashboardModal(this.app, this.plugin).open();
        });
        
        header.createEl('h1', { text: '📊 문제 목록 대시보드', cls: 'qld-title' });
        header.createEl('p', { text: '폴더별로 문제를 관리하고 확인하세요', cls: 'qld-subtitle' });

        // 문제 로딩
        console.log('📊 문제 목록 대시보드: 문제 로딩 시작');
        const questions = await this.plugin.loadAllQuestions();
        console.log(`📊 로딩된 문제 수: ${questions.length}개`);

        // 폴더별 집계
        const byFolder = {};
        questions.forEach(q => {
            const folder = q.folder || '기본';
            if (!byFolder[folder]) {
                byFolder[folder] = {
                    questions: [],
                    total: 0,
                    bookmarked: 0,
                    wrong: 0,
                    correct: 0
                };
            }
            byFolder[folder].questions.push(q);
            byFolder[folder].total++;
            if (q.bookmarked) byFolder[folder].bookmarked++;
            if (q.wrongCount > 0) byFolder[folder].wrong++;
            if (q.correctCount > 0) byFolder[folder].correct++;
        });

        console.log('📊 폴더별 집계:', byFolder);

        // 전체 통계
        const statsSection = contentEl.createDiv({ cls: 'qld-stats-section' });
        this.renderOverallStats(statsSection, questions, byFolder);

        // 폴더 목록
        const folderSection = contentEl.createDiv({ cls: 'qld-folder-section' });
        this.renderFolderList(folderSection, byFolder);

        // 스타일 추가
        this.addStyles();
    }

    renderOverallStats(container, questions, byFolder) {
        container.createEl('h2', { text: '📈 전체 통계', cls: 'qld-section-title' });

        const statsGrid = container.createDiv({ cls: 'qld-stats-grid' });

        // 총 문제 수
        const totalCard = statsGrid.createDiv({ cls: 'qld-stat-card' });
        totalCard.style.borderLeft = '4px solid #2196f3';
        totalCard.createEl('div', { text: '📚', cls: 'qld-stat-icon' });
        totalCard.createEl('div', { text: questions.length.toString(), cls: 'qld-stat-value' });
        totalCard.createEl('div', { text: '총 문제', cls: 'qld-stat-label' });

        // 폴더 수
        const folderCard = statsGrid.createDiv({ cls: 'qld-stat-card' });
        folderCard.style.borderLeft = '4px solid #4caf50';
        folderCard.createEl('div', { text: '📁', cls: 'qld-stat-icon' });
        folderCard.createEl('div', { text: Object.keys(byFolder).length.toString(), cls: 'qld-stat-value' });
        folderCard.createEl('div', { text: '폴더 수', cls: 'qld-stat-label' });

        // 북마크
        const bookmarkedCount = questions.filter(q => q.bookmarked).length;
        const bookmarkCard = statsGrid.createDiv({ cls: 'qld-stat-card' });
        bookmarkCard.style.borderLeft = '4px solid #ffc107';
        bookmarkCard.createEl('div', { text: '⭐', cls: 'qld-stat-icon' });
        bookmarkCard.createEl('div', { text: bookmarkedCount.toString(), cls: 'qld-stat-value' });
        bookmarkCard.createEl('div', { text: '북마크', cls: 'qld-stat-label' });

        // 오답
        const wrongCount = questions.filter(q => q.wrongCount > 0).length;
        const wrongCard = statsGrid.createDiv({ cls: 'qld-stat-card' });
        wrongCard.style.borderLeft = '4px solid #f44336';
        wrongCard.createEl('div', { text: '❌', cls: 'qld-stat-icon' });
        wrongCard.createEl('div', { text: wrongCount.toString(), cls: 'qld-stat-value' });
        wrongCard.createEl('div', { text: '오답', cls: 'qld-stat-label' });
    }

    renderFolderList(container, byFolder) {
        container.createEl('h2', { text: '📂 폴더 목록', cls: 'qld-section-title' });

        const folderGrid = container.createDiv({ cls: 'qld-folder-grid' });

        Object.entries(byFolder).sort((a, b) => b[1].total - a[1].total).forEach(([folder, data]) => {
            const card = folderGrid.createDiv({ cls: 'qld-folder-card' });

            // 폴더 헤더
            const header = card.createDiv({ cls: 'qld-folder-header' });
            header.createEl('div', { text: `📁 ${folder}`, cls: 'qld-folder-name' });
            
            const badge = header.createDiv({ cls: 'qld-folder-badge' });
            badge.textContent = `${data.total}개`;

            // 폴더 통계
            const stats = card.createDiv({ cls: 'qld-folder-stats' });
            
            const totalStat = stats.createDiv({ cls: 'qld-folder-stat' });
            totalStat.createEl('span', { text: '📚 총 문제:', cls: 'qld-stat-l abel' });
            totalStat.createEl('span', { text: `${data.total}개`, cls: 'qld-stat-num' });

            const bookmarkedStat = stats.createDiv({ cls: 'qld-folder-stat' });
            bookmarkedStat.createEl('span', { text: '⭐ 북마크:', cls: 'qld-stat-label' });
            bookmarkedStat.createEl('span', { text: `${data.bookmarked}개`, cls: 'qld-stat-num' });

            const wrongStat = stats.createDiv({ cls: 'qld-folder-stat' });
            wrongStat.createEl('span', { text: '❌ 오답:', cls: 'qld-stat-label' });
            wrongStat.createEl('span', { text: `${data.wrong}개`, cls: 'qld-stat-num' });

            const correctStat = stats.createDiv({ cls: 'qld-folder-stat' });
            correctStat.createEl('span', { text: '✅ 정답:', cls: 'qld-stat-label' });
            correctStat.createEl('span', { text: `${data.correct}개`, cls: 'qld-stat-num' });

            // 액션 버튼
            const actions = card.createDiv({ cls: 'qld-folder-actions' });

            const dashboardBtn = actions.createEl('button', { text: '📊 대시보드', cls: 'qld-action-btn qld-btn-dashboard' });
            dashboardBtn.addEventListener('click', async () => {
                this.close();
                await this.plugin.generateQuestionDashboard();
            });

            const quizBtn = actions.createEl('button', { text: '🎯 퀴즈', cls: 'qld-action-btn qld-btn-quiz' });
            quizBtn.addEventListener('click', () => {
                this.close();
                this.plugin.startQuiz(null, false, folder);
            });

            const listBtn = actions.createEl('button', { text: '📋 목록', cls: 'qld-action-btn qld-btn-list' });
            listBtn.addEventListener('click', async () => {
                this.close();
                await this.plugin.viewFolderQuestionList(folder);
            });

            const addBtn = actions.createEl('button', { text: '➕ 추가', cls: 'qld-action-btn qld-btn-add' });
            addBtn.addEventListener('click', () => {
                this.close();
                const modal = new HanziQuestionModal(this.app, this.plugin);
                modal.question.folder = folder;
                modal.open();
            });
        });
    }

    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .question-list-dashboard-modal {
                padding: 0;
                max-width: 95vw;
                width: 1200px;
                max-height: 90vh;
                overflow-y: auto;
            }
            .qld-header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: ${this.isMobile ? '25px' : '30px'};
                text-align: center;
                border-radius: 10px 10px 0 0;
                margin-bottom: 20px;
                position: relative;
            }
            .qld-back-btn {
                position: absolute;
                top: ${this.isMobile ? '20px' : '25px'};
                left: ${this.isMobile ? '15px' : '20px'};
                background: rgba(255, 255, 255, 0.2);
                color: white;
                border: 1px solid rgba(255, 255, 255, 0.3);
                padding: ${this.isMobile ? '10px 15px' : '8px 16px'};
                border-radius: 8px;
                font-size: ${this.isMobile ? '0.85rem' : '0.9rem'};
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s ease;
                backdrop-filter: blur(10px);
                min-height: ${this.isMobile ? '44px' : 'auto'};
                -webkit-tap-highlight-color: transparent;
            }
            .qld-back-btn:hover {
                background: ${this.isMobile ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.3)'};
                transform: ${this.isMobile ? 'none' : 'translateX(-2px)'};
            }
            .qld-back-btn:active {
                opacity: 0.8;
            }
            .qld-title {
                font-size: ${this.isMobile ? '1.5rem' : '2rem'};
                margin: 0 0 10px 0;
            }
            .qld-subtitle {
                margin: 0;
                opacity: 0.9;
                font-size: ${this.isMobile ? '0.9rem' : '1rem'};
            }
            .qld-stats-section {
                padding: ${this.isMobile ? '15px' : '20px'};
                background: var(--background-secondary);
                margin: 0 ${this.isMobile ? '15px' : '20px'} 20px ${this.isMobile ? '15px' : '20px'};
                border-radius: 10px;
            }
            .qld-section-title {
                margin: 0 0 15px 0;
                font-size: ${this.isMobile ? '1.2rem' : '1.4rem'};
            }
            .qld-stats-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(${this.isMobile ? '140px' : '150px'}, 1fr));
                gap: ${this.isMobile ? '10px' : '15px'};
            }
            .qld-stat-card {
                background: var(--background-primary);
                padding: ${this.isMobile ? '15px' : '20px'};
                border-radius: 10px;
                text-align: center;
                border-left: 4px solid #2196f3;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }
            .qld-stat-icon {
                font-size: ${this.isMobile ? '1.8rem' : '2rem'};
                margin-bottom: 10px;
            }
            .qld-stat-value {
                font-size: ${this.isMobile ? '1.5rem' : '1.8rem'};
                font-weight: bold;
                color: var(--text-accent);
            }
            .qld-stat-label {
                font-size: ${this.isMobile ? '0.85rem' : '0.9rem'};
                color: var(--text-muted);
                margin-top: 5px;
            }
            .qld-folder-section {
                padding: 0 ${this.isMobile ? '15px' : '20px'} 20px ${this.isMobile ? '15px' : '20px'};
            }
            .qld-folder-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(${this.isMobile ? '280px' : '320px'}, 1fr));
                gap: ${this.isMobile ? '15px' : '20px'};
                margin-top: 15px;
            }
            .qld-folder-card {
                background: var(--background-primary);
                border: 2px solid var(--background-modifier-border);
                border-radius: 12px;
                padding: ${this.isMobile ? '15px' : '20px'};
                transition: all 0.3s ease;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }
            .qld-folder-card:hover {
                transform: ${this.isMobile ? 'none' : 'translateY(-5px)'};
                box-shadow: 0 8px 20px rgba(0,0,0,0.2);
                border-color: #667eea;
            }
            .qld-folder-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 15px;
                padding-bottom: 10px;
                border-bottom: 2px solid var(--background-modifier-border);
            }
            .qld-folder-name {
                font-size: ${this.isMobile ? '1.1rem' : '1.2rem'};
                font-weight: bold;
                color: var(--text-accent);
            }
            .qld-folder-badge {
                background: linear-gradient(135deg, #667eea, #764ba2);
                color: white;
                padding: ${this.isMobile ? '5px 12px' : '5px 15px'};
                border-radius: 20px;
                font-size: ${this.isMobile ? '0.85rem' : '0.9rem'};
                font-weight: bold;
            }
            .qld-folder-stats {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: ${this.isMobile ? '8px' : '10px'};
                margin-bottom: 15px;
            }
            .qld-folder-stat {
                display: flex;
                justify-content: space-between;
                padding: ${this.isMobile ? '8px' : '10px'};
                background: var(--background-secondary);
                border-radius: 6px;
                font-size: ${this.isMobile ? '0.85rem' : '0.9rem'};
            }
            .qld-stat-label {
                color: var(--text-muted);
            }
            .qld-stat-num {
                font-weight: bold;
                color: var(--text-accent);
            }
            .qld-folder-actions {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: ${this.isMobile ? '8px' : '10px'};
                margin-top: 15px;
            }
            .qld-action-btn {
                padding: ${this.isMobile ? '12px' : '10px'};
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-size: ${this.isMobile ? '0.9rem' : '0.85rem'};
                font-weight: bold;
                transition: all 0.2s ease;
                min-height: ${this.isMobile ? '44px' : 'auto'};
                -webkit-tap-highlight-color: transparent;
            }
            .qld-btn-dashboard {
                background: linear-gradient(135deg, #667eea, #764ba2);
                color: white;
            }
            .qld-btn-dashboard:hover {
                background: linear-gradient(135deg, #5568d3, #6a3f8c);
            }
            .qld-btn-quiz {
                background: linear-gradient(135deg, #4caf50, #388e3c);
                color: white;
            }
            .qld-btn-quiz:hover {
                background: linear-gradient(135deg, #45a049, #2e7d32);
            }
            .qld-btn-list {
                background: linear-gradient(135deg, #2196f3, #1976d2);
                color: white;
            }
            .qld-btn-list:hover {
                background: linear-gradient(135deg, #1e88e5, #1565c0);
            }
            .qld-btn-add {
                background: linear-gradient(135deg, #ff9800, #f57c00);
                color: white;
            }
            .qld-btn-add:hover {
                background: linear-gradient(135deg, #fb8c00, #ef6c00);
            }
            @media (max-width: 768px) {
                /* 버튼 - 작은 크기 */
                .qld-action-btn {
                    padding: 8px 14px !important;
                    font-size: 13px !important;
                    min-height: 38px !important;
                    max-height: 38px !important;
                }
                
                .qld-action-btn:hover {
                    transform: none;
                }
                .qld-action-btn:active {
                    opacity: 0.8;
                }
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
            optionImages: ['', '', '', ''],
            answer: 0,
            hint: '',
            hintImage: '',
            note: '',
            noteImage: '',
            difficulty: 'C',
            image: '',
            wrongCount: 0,
            correctCount: 0,
            bookmarked: false
        };
        // 기존 문제에 없는 필드 초기화
        if (!this.question.optionImages) this.question.optionImages = [];
        if (!this.question.hintImage) this.question.hintImage = '';
        if (!this.question.noteImage) this.question.noteImage = '';
        
        // 키보드 단축키 등록 (Escape 제외한 모든 키 허용)
        this.scope.register([], 'Escape', () => {
            this.close();
            return false;
        });
    }

    // 공통 이미지 업로드 UI 생성 함수 (다중 이미지 지원)
    createImageUploader(container, getValue, setValue, label = '이미지') {
        const imageContainer = container.createDiv({ cls: 'image-upload-container' });
        imageContainer.style.marginTop = '10px';

        // 이미지 URL 입력 필드
        const imageInput = imageContainer.createEl('textarea', {
            placeholder: '이미지 URL 또는 [[파일명]] (여러 개는 줄바꿈으로 구분)',
            value: getValue() || ''
        });
        imageInput.style.width = '100%';
        imageInput.style.padding = '8px';
        imageInput.style.minHeight = '60px';
        imageInput.style.resize = 'vertical';
        imageInput.addEventListener('input', (e) => {
            setValue(e.target.value);
            updateImagePreview();
        });

        // 버튼 컨테이너 (2줄로 배치)
        const buttonRow1 = imageContainer.createDiv({ cls: 'image-button-row' });
        buttonRow1.style.display = 'flex';
        buttonRow1.style.gap = '8px';
        buttonRow1.style.marginTop = '8px';

        const buttonRow2 = imageContainer.createDiv({ cls: 'image-button-row' });
        buttonRow2.style.display = 'flex';
        buttonRow2.style.gap = '8px';
        buttonRow2.style.marginTop = '8px';

        // 첫 번째 줄: 전체 교체 버튼들
        const uploadBtn = buttonRow1.createEl('button', {
            text: '📁 파일 선택',
            cls: 'image-upload-btn'
        });
        uploadBtn.style.flex = '1';
        uploadBtn.type = 'button';

        const clipboardBtn = buttonRow1.createEl('button', {
            text: '📋 붙여넣기',
            cls: 'image-clipboard-btn'
        });
        clipboardBtn.style.flex = '1';
        clipboardBtn.type = 'button';

        // 두 번째 줄: 추가 업로드 버튼들
        const addUploadBtn = buttonRow2.createEl('button', {
            text: '➕ 이미지 추가',
            cls: 'image-add-upload-btn'
        });
        addUploadBtn.style.flex = '1';
        addUploadBtn.type = 'button';
        addUploadBtn.style.background = 'var(--interactive-accent)';
        addUploadBtn.style.color = 'var(--text-on-accent)';

        const clearBtn = buttonRow2.createEl('button', {
            text: '�️ 전체 삭제',
            cls: 'image-clear-btn'
        });
        clearBtn.style.flex = '1';
        clearBtn.type = 'button';

        // 숨겨진 파일 입력들
        const fileInput = imageContainer.createEl('input', {
            type: 'file',
            attr: { 
                accept: 'image/*',
                multiple: true
            }
        });
        fileInput.style.display = 'none';

        const addFileInput = imageContainer.createEl('input', {
            type: 'file',
            attr: { 
                accept: 'image/*',
                multiple: true
            }
        });
        addFileInput.style.display = 'none';

        uploadBtn.onclick = () => fileInput.click();
        addUploadBtn.onclick = () => addFileInput.click();

        // 클립보드 이미지 붙여넣기 (기존 이미지에 추가)
        clipboardBtn.onclick = async () => {
            try {
                const clipboardItems = await navigator.clipboard.read();
                let imageFound = false;

                for (const item of clipboardItems) {
                    const imageType = item.types.find(type => type.startsWith('image/'));
                    
                    if (imageType) {
                        const blob = await item.getType(imageType);
                        const attachmentFolder = this.plugin.settings.quizFolder + '/첨부파일';
                        
                        const folderExists = await this.app.vault.adapter.exists(attachmentFolder);
                        if (!folderExists) {
                            await this.app.vault.createFolder(attachmentFolder);
                        }

                        // Obsidian 기본 형식으로 파일명 생성
                        const now = new Date();
                        const year = now.getFullYear();
                        const month = String(now.getMonth() + 1).padStart(2, '0');
                        const day = String(now.getDate()).padStart(2, '0');
                        const hours = String(now.getHours()).padStart(2, '0');
                        const minutes = String(now.getMinutes()).padStart(2, '0');
                        const seconds = String(now.getSeconds()).padStart(2, '0');
                        
                        const extension = imageType.split('/')[1] || 'png';
                        const fileName = `Pasted image ${year}${month}${day}${hours}${minutes}${seconds}.${extension}`;
                        const filePath = `${attachmentFolder}/${fileName}`;

                        const arrayBuffer = await blob.arrayBuffer();
                        await this.app.vault.adapter.writeBinary(filePath, new Uint8Array(arrayBuffer));

                        // 기존 이미지에 추가
                        const existingValue = getValue() || '';
                        const newImageLink = `![[첨부파일/${fileName}]]`;
                        const newValue = existingValue 
                            ? existingValue + '\n' + newImageLink
                            : newImageLink;
                        
                        setValue(newValue);
                        imageInput.value = newValue;
                        
                        new Notice(`✅ ${label} 클립보드 이미지 추가 완료`);
                        updateImagePreview();
                        imageFound = true;
                        break;
                    }
                }

                if (!imageFound) {
                    new Notice('⚠️ 클립보드에 이미지가 없습니다.');
                }
            } catch (error) {
                console.error('클립보드 이미지 붙여넣기 실패:', error);
                new Notice('❌ 클립보드 읽기 실패: ' + error.message);
            }
        };

        fileInput.addEventListener('change', async (e) => {
            const files = e.target.files;
            if (!files || files.length === 0) return;

            try {
                const attachmentFolder = this.plugin.settings.quizFolder + '/첨부파일';
                const folderExists = await this.app.vault.adapter.exists(attachmentFolder);
                if (!folderExists) {
                    await this.app.vault.createFolder(attachmentFolder);
                }

                const uploadedImages = [];
                const existingValue = getValue() || '';
                
                for (let i = 0; i < files.length; i++) {
                    const file = files[i];
                    const timestamp = Date.now() + i; // 각 파일마다 고유한 타임스탬프
                    const fileName = `${timestamp}_${file.name}`;
                    const filePath = `${attachmentFolder}/${fileName}`;
                    const arrayBuffer = await file.arrayBuffer();
                    await this.app.vault.adapter.writeBinary(filePath, new Uint8Array(arrayBuffer));

                    // 상대 경로 형식으로 저장
                    uploadedImages.push(`![[첨부파일/${fileName}]]`);
                }

                // 기존 이미지에 새 이미지 추가 (줄바꿈으로 구분)
                const newValue = existingValue 
                    ? existingValue + '\n' + uploadedImages.join('\n')
                    : uploadedImages.join('\n');
                
                setValue(newValue);
                imageInput.value = newValue;
                
                new Notice(`✅ ${label} ${files.length}개 업로드 완료`);
                updateImagePreview();
            } catch (error) {
                console.error('이미지 업로드 실패:', error);
                new Notice(`❌ ${label} 업로드 실패`);
            }
        });

        // 추가 업로드 핸들러 (기존 이미지에 추가)
        addFileInput.addEventListener('change', async (e) => {
            const files = e.target.files;
            if (!files || files.length === 0) return;

            try {
                const attachmentFolder = this.plugin.settings.quizFolder + '/첨부파일';
                const folderExists = await this.app.vault.adapter.exists(attachmentFolder);
                if (!folderExists) {
                    await this.app.vault.createFolder(attachmentFolder);
                }

                const uploadedImages = [];
                const existingValue = getValue() || '';
                
                for (let i = 0; i < files.length; i++) {
                    const file = files[i];
                    const timestamp = Date.now() + i;
                    const fileName = `${timestamp}_${file.name}`;
                    const filePath = `${attachmentFolder}/${fileName}`;
                    const arrayBuffer = await file.arrayBuffer();
                    await this.app.vault.adapter.writeBinary(filePath, new Uint8Array(arrayBuffer));

                    uploadedImages.push(`![[첨부파일/${fileName}]]`);
                }

                // 기존 이미지에 새 이미지 추가
                const newValue = existingValue 
                    ? existingValue + '\n' + uploadedImages.join('\n')
                    : uploadedImages.join('\n');
                
                setValue(newValue);
                imageInput.value = newValue;
                
                new Notice(`✅ ${label} ${files.length}개 추가 완료`);
                updateImagePreview();
            } catch (error) {
                console.error('이미지 추가 실패:', error);
                new Notice(`❌ ${label} 추가 실패`);
            }
        });

        // 전체 삭제 버튼 핸들러
        clearBtn.onclick = () => {
            if (getValue() && getValue().trim()) {
                setValue('');
                imageInput.value = '';
                updateImagePreview();
                new Notice(`✅ ${label} 전체 삭제 완료`);
            }
        };

        // 이미지 미리보기 (다중 이미지 지원)
        const previewContainer = imageContainer.createDiv({ cls: 'image-preview-container' });
        previewContainer.style.marginTop = '10px';
        previewContainer.style.maxHeight = '200px';
        previewContainer.style.overflow = 'auto';
        previewContainer.style.border = '1px solid var(--background-modifier-border)';
        previewContainer.style.borderRadius = '6px';
        previewContainer.style.display = 'none';
        previewContainer.style.padding = '5px';

        const updateImagePreview = async () => {
            const imageValue = getValue();
            if (!imageValue || !imageValue.trim()) {
                previewContainer.style.display = 'none';
                return;
            }

            // 줄바꿈으로 구분된 이미지들 처리
            const imageLines = imageValue.split('\n').filter(line => line.trim());
            
            if (imageLines.length === 0) {
                previewContainer.style.display = 'none';
                return;
            }

            previewContainer.empty();
            previewContainer.style.display = 'block';

            // 이미지를 가로로 나열
            const imagesRow = previewContainer.createDiv();
            imagesRow.style.display = 'flex';
            imagesRow.style.flexWrap = 'wrap';
            imagesRow.style.gap = '8px';

            for (const imageLine of imageLines) {
                let imageUrl = imageLine.trim();

                // Wiki 링크 형식 처리
                if (imageUrl.includes('[[') && imageUrl.includes(']]')) {
                    const wikiMatch = imageUrl.match(/\[\[(.+?)\]\]/);
                    if (wikiMatch && wikiMatch[1]) {
                        const fileName = wikiMatch[1];
                        const files = this.app.vault.getFiles();
                        const imageFile = files.find(f => 
                            f.name === fileName || 
                            f.path.endsWith(fileName) ||
                            f.basename === fileName.replace(/\.\w+$/, '')
                        );
                        
                        if (imageFile) {
                            imageUrl = this.app.vault.getResourcePath(imageFile);
                        }
                    }
                } else if (imageUrl.includes('![') && imageUrl.includes('](')) {
                    // Markdown 형식 처리
                    const imgMatch = imageUrl.match(/!\[.*?\]\((.*?)\)/);
                    if (imgMatch && imgMatch[1]) {
                        imageUrl = imgMatch[1];
                    }
                }

                // 이미지 컨테이너
                const imgWrapper = imagesRow.createDiv();
                imgWrapper.style.flex = '0 0 auto';
                imgWrapper.style.maxWidth = '150px';

                const img = imgWrapper.createEl('img', {
                    attr: {
                        src: imageUrl,
                        style: 'width: 100%; height: auto; display: block; border-radius: 4px;'
                    }
                });
                img.onerror = () => {
                    imgWrapper.empty();
                    imgWrapper.createEl('div', {
                        text: '⚠️',
                        attr: { 
                            style: 'padding: 10px; text-align: center; color: var(--text-muted); font-size: 2em; background: var(--background-secondary); border-radius: 4px;',
                            title: '이미지를 불러올 수 없습니다.'
                        }
                    });
                };
            }
        };

        updateImagePreview();
        return imageContainer;
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('hanzi-question-modal');
        
        // 모달 전체 키보드 이벤트 허용
        contentEl.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && ['v', 'c', 'x', 'a', 'z'].includes(e.key.toLowerCase())) {
                e.stopPropagation();
            }
        }, true);
        
        contentEl.addEventListener('paste', (e) => {
            e.stopPropagation();
        }, true);
        
        // 모달 전체를 Flexbox로 설정
        contentEl.style.cssText = `
            display: flex;
            flex-direction: column;
            height: 100%;
            max-height: 90vh;
            overflow: hidden;
        `;

        // 헤더 (고정)
        const header = contentEl.createDiv({ cls: 'modal-header' });
        header.style.cssText = `
            flex: 0 0 auto;
            padding: 20px;
            background: var(--background-primary);
            border-bottom: 2px solid var(--interactive-accent);
            margin-bottom: 0;
        `;
        
        const headerTitle = header.createDiv();
        headerTitle.style.cssText = `
            display: flex;
            align-items: center;
            gap: 12px;
        `;
        
        const icon = headerTitle.createSpan({ 
            text: this.existingQuestion ? '✏️' : '📝',
            cls: 'header-icon'
        });
        icon.style.cssText = `
            font-size: 28px;
        `;
        
        const title = headerTitle.createEl('h2', { 
            text: this.existingQuestion ? '문제 수정' : '새 문제 만들기',
            cls: 'header-title'
        });
        title.style.cssText = `
            margin: 0;
            font-size: 24px;
            font-weight: 600;
            color: var(--text-normal);
        `;

        // 스크롤 가능한 폼 영역
        const scrollContainer = contentEl.createDiv({ cls: 'modal-scroll-container' });
        scrollContainer.style.cssText = `
            flex: 1;
            overflow-y: auto;
            overflow-x: hidden;
            padding: 20px;
            background: var(--background-primary);
        `;

        const form = scrollContainer.createDiv({ cls: 'question-form' });
        form.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 20px;
        `;

        // 핵심 키워드 (드롭다운 + 입력) - 컴팩트
        const hanziSetting = new Setting(form)
            .setName('🔑 핵심 키워드')
            .setDesc('');
        
        hanziSetting.settingEl.style.cssText = `
            background: var(--background-primary-alt);
            border-radius: 6px;
            padding: 10px 12px;
            border: 1px solid var(--background-modifier-border);
        `;
        
        hanziSetting.nameEl.style.fontSize = '13px';
        hanziSetting.nameEl.style.fontWeight = '500';
        
        // 기존 키워드 목록 가져오기
        const getExistingKeywords = async () => {
            const keywords = new Set();
            const questionsFolder = this.plugin.settings.quizFolder + '/Questions';
            
            const allFolders = this.app.vault.getAbstractFileByPath(questionsFolder);
            if (allFolders && allFolders.children) {
                for (const folder of allFolders.children) {
                    if (folder.children) {
                        for (const file of folder.children) {
                            if (file.extension === 'md') {
                                try {
                                    const content = await this.app.vault.read(file);
                                    const lines = content.split('\n');
                                    
                                    // "## 한자" 섹션 찾기
                                    let inHanziSection = false;
                                    for (let i = 0; i < lines.length; i++) {
                                        const line = lines[i].trim();
                                        
                                        if (line === '## 한자' || line === '## 키워드') {
                                            inHanziSection = true;
                                            continue;
                                        }
                                        
                                        // 다음 섹션 시작되면 종료
                                        if (inHanziSection && line.startsWith('##')) {
                                            inHanziSection = false;
                                            continue;
                                        }
                                        
                                        // 한자/키워드 섹션 내용 추출
                                        if (inHanziSection && line && !line.startsWith('#')) {
                                            keywords.add(line);
                                        }
                                    }
                                } catch (err) {
                                    // 파일 읽기 실패 시 무시
                                }
                            }
                        }
                    }
                }
            }
            return Array.from(keywords).sort();
        };
        
        const hanziContainer = hanziSetting.controlEl.createDiv({ cls: 'hanzi-input-container' });
        hanziContainer.style.display = 'flex';
        hanziContainer.style.flexDirection = 'column';
        hanziContainer.style.gap = '8px';
        hanziContainer.style.width = '100%';
        
        // 드롭다운
        const dropdownRow = hanziContainer.createDiv();
        dropdownRow.style.cssText = `
            display: flex;
            align-items: center;
            gap: 6px;
        `;
        
        dropdownRow.createSpan({ 
            text: '📚', 
            cls: 'setting-item-description' 
        }).style.cssText = `
            font-size: 14px;
        `;
        
        const hanziDropdown = dropdownRow.createEl('select');
        hanziDropdown.style.cssText = `
            flex: 1;
            padding: 6px 10px;
            border-radius: 4px;
            border: 1px solid var(--background-modifier-border);
            background: var(--background-primary);
            color: var(--text-normal);
            cursor: pointer;
            font-size: 13px;
        `;
        
        // 드롭다운 옵션 로드
        (async () => {
            const keywords = await getExistingKeywords();
            hanziDropdown.createEl('option', { text: '-- 선택하세요 --', value: '' });
            for (const keyword of keywords) {
                hanziDropdown.createEl('option', { text: keyword, value: keyword });
            }
        })();
        
        // 입력 필드 (Setting API 사용)
        let hanziInputComponent;
        hanziSetting.addText(text => {
            hanziInputComponent = text;
            text.setPlaceholder('예: 愛, 사랑, 經濟 등')
                .setValue(this.question.hanzi || '')
                .onChange((value) => {
                    this.question.hanzi = value;
                });
            text.inputEl.style.width = '100%';
        });
        
        // 드롭다운 선택 시 입력 필드에 반영
        hanziDropdown.addEventListener('change', (e) => {
            if (e.target.value) {
                hanziInputComponent.setValue(e.target.value);
                this.question.hanzi = e.target.value;
            }
        });

        // 번호 (자동 할당 버튼 포함) - 컴팩트
        const numberSetting = new Setting(form)
            .setName('🔢 번호')
            .setDesc('');
        
        numberSetting.settingEl.style.cssText = `
            background: var(--background-primary-alt);
            border-radius: 6px;
            padding: 10px 12px;
            border: 1px solid var(--background-modifier-border);
        `;
        
        numberSetting.nameEl.style.fontSize = '13px';
        numberSetting.nameEl.style.fontWeight = '500';
        
        let numberInput;
        let numberStatusEl;
        
        numberSetting.addText(text => {
            numberInput = text;
            text.setPlaceholder('예: 1')
                .setValue(this.question.number)
                .onChange(async (value) => {
                    this.question.number = value;
                    
                    // 중복 체크 제거 - 중복 허용
                    if (value.trim() !== '') {
                        numberStatusEl.setText('📝 번호 입력됨');
                        numberStatusEl.style.color = '#4caf50';
                    } else {
                        numberStatusEl.setText('');
                    }
                });
        });
        
        // 자동 할당 버튼
        numberSetting.addButton(btn => btn
            .setButtonText('🔢 자동 할당')
            .setTooltip('다음 사용 가능한 번호 자동 할당')
            .onClick(async () => {
                const folder = this.question.folder || '기본';
                const nextNumber = await this.plugin.getNextAvailableNumber(folder);
                this.question.number = nextNumber;
                numberInput.setValue(nextNumber);
                numberStatusEl.setText('✅ 사용 가능');
                numberStatusEl.style.color = '#4caf50';
                new Notice(`📋 번호 ${nextNumber}이(가) 할당되었습니다.`);
            }));
        
        // 상태 표시 영역
        numberStatusEl = numberSetting.descEl.createDiv({ cls: 'number-status' });
        numberStatusEl.style.marginTop = '4px';
        numberStatusEl.style.fontWeight = 'bold';

        // 문제 - 확대
        const questionSetting = new Setting(form)
            .setName('❓ 문제')
            .setDesc('질문 내용을 입력하세요');
        
        questionSetting.settingEl.style.cssText = `
            background: linear-gradient(135deg, var(--background-secondary) 0%, var(--background-primary-alt) 100%);
            border-radius: 12px;
            padding: 20px;
            border: 2px solid var(--interactive-accent);
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        `;
        
        questionSetting.nameEl.style.fontSize = '16px';
        questionSetting.nameEl.style.fontWeight = '600';
        questionSetting.descEl.style.fontSize = '13px';
        
        const questionContainer = questionSetting.controlEl.createDiv({ cls: 'question-container' });
        questionContainer.style.display = 'flex';
        questionContainer.style.flexDirection = 'column';
        questionContainer.style.gap = '8px';
        questionContainer.style.width = '100%';
        
        // 클립보드 붙여넣기 버튼
        const pasteBtnRow = questionContainer.createDiv({ cls: 'paste-btn-row' });
        pasteBtnRow.style.display = 'flex';
        pasteBtnRow.style.gap = '8px';
        pasteBtnRow.style.marginBottom = '4px';
        
        const pasteBtn = pasteBtnRow.createEl('button', {
            text: '📋 클립보드 붙여넣기',
            cls: 'paste-btn'
        });
        pasteBtn.type = 'button';
        pasteBtn.style.padding = '6px 12px';
        pasteBtn.style.fontSize = '0.9em';
        pasteBtn.style.cursor = 'pointer';
        
        // 문제 입력 영역 - 확대
        const questionInput = questionContainer.createEl('textarea', {
            placeholder: '예: 다음 한자의 뜻은?',
            value: this.question.question || ''
        });
        questionInput.rows = 4;
        questionInput.style.cssText = `
            width: 100%;
            padding: 12px;
            resize: vertical;
            font-size: 15px;
            line-height: 1.6;
            border: 2px solid var(--background-modifier-border);
            border-radius: 8px;
            background: var(--background-primary);
            min-height: 100px;
        `;
        
        // 키보드 이벤트 허용 (Ctrl+V, Ctrl+C, Ctrl+X, Ctrl+A, Ctrl+Z)
        questionInput.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && ['v', 'c', 'x', 'a', 'z'].includes(e.key.toLowerCase())) {
                e.stopPropagation();
            }
        }, true);
        
        // 붙여넣기 이벤트 허용
        questionInput.addEventListener('paste', (e) => {
            e.stopPropagation();
        }, true);
        
        questionInput.addEventListener('input', (e) => {
            this.question.question = e.target.value;
        });
        
        // 클립보드 버튼 클릭 이벤트
        pasteBtn.addEventListener('click', async () => {
            try {
                const text = await navigator.clipboard.readText();
                if (text) {
                    questionInput.value = text;
                    this.question.question = text;
                    questionInput.focus();
                    new Notice('📋 클립보드 내용이 붙여넣어졌습니다.');
                }
            } catch (err) {
                new Notice('⚠️ 클립보드 읽기 실패: ' + err.message);
            }
        });

        // 폴더 선택 - 컴팩트
        const folderSetting = new Setting(form)
            .setName('📁 폴더')
            .setDesc('');

        folderSetting.settingEl.style.cssText = `
            background: var(--background-primary-alt);
            border-radius: 6px;
            padding: 10px 12px;
            border: 1px solid var(--background-modifier-border);
        `;
        
        folderSetting.nameEl.style.fontSize = '13px';
        folderSetting.nameEl.style.fontWeight = '500';

        const folderContainer = folderSetting.controlEl.createDiv({ cls: 'folder-selection-container' });
        folderContainer.style.cssText = `
            display: flex;
            gap: 8px;
            width: 100%;
            align-items: center;
        `;

        // 드롭다운
        const folderDropdown = folderContainer.createEl('select');
        folderDropdown.style.cssText = `
            flex: 1;
            padding: 6px 10px;
            border-radius: 4px;
            border: 1px solid var(--background-modifier-border);
            background: var(--background-primary);
            font-size: 13px;
        `;
        
        const folders = this.plugin.settings.questionFolders || ['기본'];
        
        // "새 폴더..." 옵션 추가
        const newFolderOption = folderDropdown.createEl('option', { 
            value: '__NEW__', 
            text: '➕ 새 폴더 만들기...' 
        });
        
        // 기존 폴더들 추가
        folders.forEach(folder => {
            const option = folderDropdown.createEl('option', { value: folder, text: folder });
        });
        
        folderDropdown.value = this.question.folder || '기본';

        // 새 폴더 입력 필드 (처음엔 숨김)
        const newFolderInput = folderContainer.createEl('input', { 
            type: 'text',
            placeholder: '새 폴더 이름 입력'
        });
        newFolderInput.style.flex = '1';
        newFolderInput.style.padding = '8px';
        newFolderInput.style.display = 'none';

        // 드롭다운 변경 이벤트
        folderDropdown.addEventListener('change', async () => {
            if (folderDropdown.value === '__NEW__') {
                // 새 폴더 만들기 선택 시
                folderDropdown.style.display = 'none';
                newFolderInput.style.display = 'block';
                newFolderInput.focus();
            } else {
                const oldFolder = this.question.folder;
                this.question.folder = folderDropdown.value;
                
                // 폴더가 변경되면 번호 재할당 제안
                if (oldFolder && oldFolder !== folderDropdown.value) {
                    const nextNum = await this.plugin.getNextAvailableNumber(folderDropdown.value);
                    if (confirm(`폴더가 변경되었습니다. [${folderDropdown.value}] 폴더의 다음 번호 ${nextNum}(으)로 자동 할당하시겠습니까?`)) {
                        this.question.number = nextNum;
                        if (numberInput) {
                            numberInput.setValue(nextNum);
                        }
                        if (numberStatusEl) {
                            numberStatusEl.setText('✅ 사용 가능');
                            numberStatusEl.style.color = '#4caf50';
                        }
                    }
                }
            }
        });

        // 새 폴더 입력 필드 이벤트
        newFolderInput.addEventListener('blur', async () => {
            const newFolderName = newFolderInput.value.trim();
            if (newFolderName) {
                const oldFolder = this.question.folder;
                
                // 새 폴더 이름이 입력된 경우
                this.question.folder = newFolderName;
                
                // 폴더 목록에 없으면 추가
                if (!folders.includes(newFolderName)) {
                    this.plugin.settings.questionFolders.push(newFolderName);
                    await this.plugin.saveSettings();
                }
                
                // 드롭다운에 새 옵션 추가
                const newOption = folderDropdown.createEl('option', { 
                    value: newFolderName, 
                    text: newFolderName 
                });
                folderDropdown.value = newFolderName;
                
                // 번호 재할당 제안
                const nextNum = await this.plugin.getNextAvailableNumber(newFolderName);
                if (confirm(`새 폴더 [${newFolderName}]이(가) 생성됩니다. 번호 ${nextNum}(으)로 자동 할당하시겠습니까?`)) {
                    this.question.number = nextNum;
                    if (numberInput) {
                        numberInput.setValue(nextNum);
                    }
                    if (numberStatusEl) {
                        numberStatusEl.setText('✅ 사용 가능');
                        numberStatusEl.style.color = '#4caf50';
                    }
                }
            }
            
            // UI 원래대로
            newFolderInput.style.display = 'none';
            newFolderInput.value = '';
            folderDropdown.style.display = 'block';
        });

        newFolderInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                newFolderInput.blur();
            }
        });

        // 이미지
        const imageSetting = new Setting(form)
            .setName('이미지 (선택)')
            .setDesc('이미지를 업로드하거나 URL을 입력하세요 (여러 개는 줄바꿈으로 구분)');

        this.createImageUploader(
            imageSetting.settingEl,
            () => this.question.image || '',
            (value) => { this.question.image = value; },
            '문제 이미지'
        );

        // 선택지 - 확대
        const optionsHeader = form.createDiv({ cls: 'section-header' });
        optionsHeader.style.cssText = `
            display: flex;
            align-items: center;
            gap: 12px;
            margin: 28px 0 20px 0;
            padding: 12px 16px;
            background: linear-gradient(90deg, var(--interactive-accent) 0%, transparent 100%);
            border-radius: 8px;
        `;
        
        optionsHeader.createEl('h3', { 
            text: '✅ 선택지',
            cls: 'section-title'
        }).style.cssText = `
            margin: 0;
            font-size: 20px;
            font-weight: 700;
            color: var(--text-normal);
        `;
        
        optionsHeader.createSpan({ 
            text: '최소 1개',
            cls: 'section-badge'
        }).style.cssText = `
            background: var(--text-on-accent);
            color: var(--interactive-accent);
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
        `;
        
        const optionsContainer = form.createDiv({ cls: 'options-container' });
        optionsContainer.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 16px;
        `;
        
        // 초기 선택지 개수 설정 (기존 문제면 그 개수, 신규면 4개)
        if (!this.question.options || this.question.options.length === 0) {
            this.question.options = ['', '', '', ''];
        }
        
        let renderOptions;
        let updateAnswerDropdown;
        
        renderOptions = () => {
            optionsContainer.empty();
            
            // optionImages 배열 크기 맞추기
            while (this.question.optionImages.length < this.question.options.length) {
                this.question.optionImages.push('');
            }
            
            // 실제로 값이 있는 선택지만 표시
            const validOptionsCount = Math.max(1, this.question.options.filter(opt => opt && opt.trim()).length);
            const displayCount = Math.max(validOptionsCount, this.question.options.length);
            
            for (let i = 0; i < displayCount; i++) {
                const optionWrapper = optionsContainer.createDiv({ cls: 'option-wrapper' });
                optionWrapper.style.cssText = `
                    background: linear-gradient(135deg, var(--background-secondary) 0%, var(--background-primary-alt) 100%);
                    padding: 18px;
                    border: 2px solid var(--background-modifier-border);
                    border-radius: 10px;
                    transition: all 0.2s;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
                `;
                
                // 호버 효과 - 더 강조
                optionWrapper.addEventListener('mouseenter', () => {
                    optionWrapper.style.borderColor = 'var(--interactive-accent)';
                    optionWrapper.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                    optionWrapper.style.transform = 'translateY(-2px)';
                });
                optionWrapper.addEventListener('mouseleave', () => {
                    optionWrapper.style.borderColor = 'var(--background-modifier-border)';
                    optionWrapper.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)';
                    optionWrapper.style.transform = 'translateY(0)';
                });
                
                const optionDiv = optionWrapper.createDiv({ cls: 'option-row' });
                optionDiv.style.cssText = `
                    display: flex;
                    gap: 12px;
                    align-items: center;
                `;
                
                new Setting(optionDiv)
                    .setName(`선택지 ${i + 1}`)
                    .addText(text => {
                        text.setPlaceholder(`선택지 ${i + 1} 텍스트`)
                            .setValue(this.question.options[i] || '')
                            .onChange(value => {
                                this.question.options[i] = value;
                            });
                        
                        // 입력 필드 확대
                        text.inputEl.style.cssText = `
                            font-size: 15px;
                            padding: 10px 12px;
                            min-height: 44px;
                        `;
                    });
                
                // 삭제 버튼 (선택지가 2개 이상일 때만)
                if (this.question.options.filter(opt => opt && opt.trim()).length > 1) {
                    const deleteBtn = optionDiv.createEl('button', { 
                        text: '🗑️',
                        cls: 'delete-option-btn'
                    });
                    deleteBtn.style.padding = '5px 10px';
                    deleteBtn.type = 'button';
                    deleteBtn.addEventListener('click', () => {
                        this.question.options.splice(i, 1);
                        this.question.optionImages.splice(i, 1);
                        renderOptions();
                        updateAnswerDropdown();
                    });
                }
                
                // 선택지 이미지 업로드
                this.createImageUploader(
                    optionWrapper,
                    () => this.question.optionImages[i] || '',
                    (value) => { this.question.optionImages[i] = value; },
                    `선택지 ${i + 1} 이미지`
                );
            }
            
            // 선택지 추가 버튼
            const addBtn = optionsContainer.createEl('button', { 
                text: '➕ 선택지 추가',
                cls: 'add-option-btn'
            });
            addBtn.style.marginTop = '10px';
            addBtn.type = 'button';
            addBtn.addEventListener('click', () => {
                this.question.options.push('');
                this.question.optionImages.push('');
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

        // 난이도 - 컴팩트
        const difficultySetting = new Setting(form)
            .setName('⭐ 난이도')
            .addDropdown(dropdown => dropdown
                .addOption('A+', '🏆 A+')
                .addOption('A', '⭐ A')
                .addOption('A-', '⭐ A-')
                .addOption('B', '😊 B')
                .addOption('B-', '😊 B-')
                .addOption('C', '😐 C')
                .addOption('D', '😰 D')
                .addOption('E', '😱 E')
                .addOption('F', '💀 F')
                .setValue(this.question.difficulty || 'C')
                .onChange(value => this.question.difficulty = value));
        
        difficultySetting.settingEl.style.cssText = `
            background: var(--background-primary-alt);
            border-radius: 6px;
            padding: 10px 12px;
            border: 1px solid var(--background-modifier-border);
        `;
        
        difficultySetting.nameEl.style.fontSize = '13px';
        difficultySetting.nameEl.style.fontWeight = '500';

        // 힌트 - 간결하고 깔끔하게
        const hintSetting = new Setting(form)
            .setName('💡 힌트')
            .setDesc('');
        
        hintSetting.settingEl.style.cssText = `
            background: var(--background-primary-alt);
            border-radius: 6px;
            padding: 12px;
            border-left: 3px solid var(--text-warning);
        `;
        
        hintSetting.nameEl.style.cssText = `
            font-size: 14px;
            font-weight: 500;
            color: var(--text-warning);
        `;
        
        const hintContainer = hintSetting.controlEl.createDiv({ cls: 'hint-container' });
        hintContainer.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 8px;
            width: 100%;
        `;
        
        // 힌트 입력 영역 - 단순화
        const hintInput = hintContainer.createEl('textarea', {
            placeholder: '틀렸을 때 보여줄 힌트 (선택사항)',
            value: this.question.hint || ''
        });
        hintInput.style.cssText = `
            width: 100%;
            padding: 10px;
            resize: vertical;
            font-size: 14px;
            line-height: 1.5;
            border: 1px solid var(--background-modifier-border);
            border-radius: 6px;
            background: var(--background-primary);
            min-height: 60px;
        `;
        hintInput.rows = 2;
        
        // 키보드 이벤트 허용
        hintInput.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && ['v', 'c', 'x', 'a', 'z'].includes(e.key.toLowerCase())) {
                e.stopPropagation();
            }
        }, true);
        
        hintInput.addEventListener('paste', (e) => {
            e.stopPropagation();
        }, true);
        
        hintInput.addEventListener('input', (e) => {
            this.question.hint = e.target.value;
        });
        
        // 힌트 이미지 업로드
        this.createImageUploader(
            hintSetting.settingEl,
            () => this.question.hintImage || '',
            (value) => { this.question.hintImage = value; },
            '힌트 이미지'
        );

        // 노트 - 간결하고 깔끔하게
        const noteSetting = new Setting(form)
            .setName('📝 노트')
            .setDesc('');
        
        noteSetting.settingEl.style.cssText = `
            background: var(--background-primary-alt);
            border-radius: 6px;
            padding: 12px;
            border-left: 3px solid var(--text-accent);
        `;
        
        noteSetting.nameEl.style.cssText = `
            font-size: 14px;
            font-weight: 500;
            color: var(--text-accent);
        `;
        
        const noteContainer = noteSetting.controlEl.createDiv({ cls: 'note-container' });
        noteContainer.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 8px;
            width: 100%;
        `;
        
        // 노트 입력 영역 - 단순화
        const noteInput = noteContainer.createEl('textarea', {
            placeholder: '추가 설명이나 기억할 내용 (선택사항)',
            value: this.question.note || ''
        });
        noteInput.style.cssText = `
            width: 100%;
            padding: 10px;
            resize: vertical;
            font-size: 14px;
            line-height: 1.5;
            border: 1px solid var(--background-modifier-border);
            border-radius: 6px;
            background: var(--background-primary);
            min-height: 60px;
        `;
        noteInput.rows = 2;
        
        // 키보드 이벤트 허용
        noteInput.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && ['v', 'c', 'x', 'a', 'z'].includes(e.key.toLowerCase())) {
                e.stopPropagation();
            }
        }, true);
        
        noteInput.addEventListener('paste', (e) => {
            e.stopPropagation();
        }, true);
        
        noteInput.addEventListener('input', (e) => {
            this.question.note = e.target.value;
        });
        
        // 노트 이미지 업로드
        this.createImageUploader(
            noteSetting.settingEl,
            () => this.question.noteImage || '',
            (value) => { this.question.noteImage = value; },
            '노트 이미지'
        );

        // 버튼 (하단 고정)
        const buttonContainer = contentEl.createDiv({ cls: 'button-container' });
        buttonContainer.style.cssText = `
            flex: 0 0 auto;
            display: flex;
            gap: 10px;
            justify-content: flex-end;
            padding: 15px 0 0 0;
            border-top: 1px solid var(--background-modifier-border);
            background: var(--background-primary);
        `;

        const saveBtn = buttonContainer.createEl('button', { 
            text: '💾 저장',
            cls: 'mod-cta'
        });
        saveBtn.addEventListener('click', async () => {
            if (this.validateQuestion()) {
                try {
                    await this.plugin.saveQuestion(this.question, !this.existingQuestion);
                    this.close();
                } catch (error) {
                    // 중복 에러 등 발생 시 모달은 닫지 않음
                    console.error('문제 저장 실패:', error);
                }
            }
        });

        const cancelBtn = buttonContainer.createEl('button', { text: '❌ 취소' });
        cancelBtn.addEventListener('click', () => this.close());

        this.addStyles();
    }

    validateQuestion() {
        if (!this.question.hanzi) {
            new Notice('❌ 핵심 키워드를 입력해주세요!');
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
            
            /* 모바일 최적화 */
            @media (max-width: 768px) {
                .hanzi-question-modal {
                    padding: 12px;
                    max-width: 100vw;
                    width: 100%;
                }
                
                .hanzi-question-modal .modal-scroll-container {
                    padding: 8px 4px;
                }
                
                /* 입력 필드 - 최대 크기 */
                .hanzi-question-modal input[type="text"],
                .hanzi-question-modal textarea,
                .hanzi-question-modal select {
                    font-size: 18px !important;
                    padding: 16px !important;
                    min-height: 54px !important;
                    line-height: 1.6 !important;
                    touch-action: manipulation;
                }
                
                .hanzi-question-modal textarea {
                    min-height: 150px !important;
                }
                
                /* 버튼 - 작은 크기 */
                .hanzi-question-modal button,
                .hanzi-question-modal .button,
                .hanzi-question-modal .mod-cta {
                    padding: 8px 14px !important;
                    font-size: 13px !important;
                    min-height: 38px !important;
                    max-height: 38px !important;
                    touch-action: manipulation;
                    -webkit-tap-highlight-color: transparent;
                }
                
                .hanzi-question-modal .paste-btn,
                .hanzi-question-modal .image-upload-btn,
                .hanzi-question-modal .image-clipboard-btn,
                .hanzi-question-modal .image-clear-btn {
                    padding: 8px 14px !important;
                    font-size: 13px !important;
                }
                
                .hanzi-question-modal .image-button-row {
                    flex-wrap: wrap;
                }
                
                .hanzi-question-modal .option-wrapper {
                    margin-bottom: 20px !important;
                }
                
                .hanzi-question-modal .delete-option-btn,
                .hanzi-question-modal .add-option-btn {
                    min-width: 38px;
                }
            }
            
            @media (max-width: 480px) {
                .hanzi-question-modal {
                    padding: 10px;
                }
                
                .hanzi-question-modal .modal-scroll-container {
                    padding: 6px 2px;
                }
                
                .hanzi-question-modal .setting-item {
                    padding: 8px 0;
                }
                
                .hanzi-question-modal .image-button-row {
                    flex-direction: column;
                }
                
                .hanzi-question-modal .image-button-row button {
                    width: 100%;
                }
            }
        `;
        document.head.appendChild(style);
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// 폴더 선택 모달
class FolderSelectionModal extends Modal {
    constructor(app, folders, onSelect) {
        super(app);
        this.folders = folders;
        this.onSelect = onSelect;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('folder-selection-modal');

        contentEl.createEl('h2', { text: '📂 폴더 선택' });
        contentEl.createEl('p', { text: '대시보드를 생성할 폴더를 선택하세요' });

        const folderList = contentEl.createDiv({ cls: 'folder-list' });

        this.folders.forEach(folder => {
            const folderBtn = folderList.createEl('button', {
                text: `📁 ${folder}`,
                cls: 'folder-selection-btn'
            });
            
            folderBtn.addEventListener('click', () => {
                this.close();
                this.onSelect(folder);
            });
        });

        // 스타일 추가
        const style = document.createElement('style');
        style.textContent = `
            .folder-selection-modal {
                padding: 20px;
            }
            .folder-selection-modal h2 {
                margin-bottom: 10px;
            }
            .folder-selection-modal p {
                color: var(--text-muted);
                margin-bottom: 20px;
            }
            .folder-list {
                display: flex;
                flex-direction: column;
                gap: 10px;
            }
            .folder-selection-btn {
                padding: 15px;
                background: var(--background-secondary);
                border: 2px solid var(--background-modifier-border);
                border-radius: 8px;
                cursor: pointer;
                font-size: 1rem;
                font-weight: bold;
                transition: all 0.2s ease;
                color: var(--text-normal);
            }
            .folder-selection-btn:hover {
                background: var(--interactive-accent);
                color: white;
                border-color: var(--interactive-accent);
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0,0,0,0.2);
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
        
        // 모바일 감지
        const isMobile = this.app.isMobile || window.innerWidth <= 768;
        
        // 모달 전체 레이아웃 설정
        contentEl.style.cssText = `
            display: flex;
            flex-direction: column;
            height: 100%;
            max-height: ${isMobile ? '85vh' : '90vh'};
            overflow: hidden;
            padding: ${isMobile ? '12px' : '20px'};
        `;

        // 헤더 (고정)
        const header = contentEl.createDiv({ cls: 'modal-header-fixed' });
        header.style.cssText = `
            flex: 0 0 auto;
            padding-bottom: ${isMobile ? '8px' : '10px'};
            border-bottom: 1px solid var(--background-modifier-border);
            margin-bottom: ${isMobile ? '8px' : '10px'};
        `;
        header.createEl('h2', { text: '📂 폴더 관리 v3', attr: { style: isMobile ? 'font-size: 20px; margin: 0 0 8px 0;' : '' } });

        const desc = header.createDiv({ cls: 'folder-desc' });
        desc.innerHTML = '문제를 폴더별로 분류하여 관리할 수 있습니다. ⚙️ 버튼을 클릭하세요.';
        if (isMobile) {
            desc.style.fontSize = '13px';
            desc.style.padding = '8px';
            desc.style.marginBottom = '8px';
        }

        // 스크롤 가능한 영역
        const scrollContainer = contentEl.createDiv({ cls: 'folder-scroll-container' });
        scrollContainer.style.cssText = `
            flex: 1;
            overflow-y: auto;
            overflow-x: hidden;
            padding: ${isMobile ? '5px 2px' : '10px 5px'};
            margin: ${isMobile ? '5px 0' : '10px 0'};
            -webkit-overflow-scrolling: touch;
        `;

        // 현재 폴더 목록
        const foldersSection = scrollContainer.createDiv({ cls: 'folders-section' });
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
            actions.style.cssText = `
                display: flex !important;
                gap: 5px !important;
                flex-wrap: wrap !important;
                align-items: center !important;
                visibility: visible !important;
            `;

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

            // 관리 버튼
            const moreBtn = actions.createEl('button', { text: '⚙️' });
            moreBtn.title = '폴더 관리';
            moreBtn.style.cssText = `
                padding: 8px 12px !important;
                font-size: 18px !important;
                background-color: #4caf50 !important;
                color: white !important;
                border: 2px solid #45a049 !important;
                border-radius: 5px !important;
                cursor: pointer !important;
                display: inline-block !important;
                visibility: visible !important;
                opacity: 1 !important;
                z-index: 1000 !important;
            `;
            moreBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                
                const menu = new Menu();
                
                menu.addItem((item) => {
                    item.setTitle('📋 폴더 복사')
                        .setIcon('copy')
                        .onClick(async () => {
                            const inputModal = new TextInputModal(
                                this.app, 
                                '폴더 복사', 
                                '새 폴더 이름을 입력하세요', 
                                `${folder}_복사본`,
                                async (newName) => {
                                    if (newName && newName !== folder) {
                                        await this.copyFolder(folder, newName);
                                    }
                                }
                            );
                            inputModal.open();
                        });
                });
                
                if (folder !== '기본') {
                    menu.addItem((item) => {
                        item.setTitle('✏️ 이름 변경')
                            .setIcon('pencil')
                            .onClick(async () => {
                                const inputModal = new TextInputModal(
                                    this.app,
                                    '폴더 이름 변경',
                                    '새 이름을 입력하세요',
                                    folder,
                                    async (newName) => {
                                        if (newName && newName !== folder) {
                                            await this.renameFolder(folder, newName);
                                        }
                                    }
                                );
                                inputModal.open();
                            });
                    });
                    
                    menu.addSeparator();
                    
                    menu.addItem((item) => {
                        item.setTitle('🗑️ 폴더 삭제')
                            .setIcon('trash')
                            .onClick(async () => {
                                await this.deleteFolder(folder);
                            });
                    });
                }
                
                menu.showAtMouseEvent(e);
            });

            // 기존 삭제 버튼 제거
            if (false && folder !== '기본') {
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
                        
                        // 폴더 삭제 (모바일에서는 지원되지 않을 수 있음)
                        const folderPath = `${this.plugin.settings.questionsFolder}/${folder}`;
                        const folderExists = this.app.vault.getAbstractFileByPath(folderPath);
                        if (folderExists) {
                            try {
                                // 모바일에서는 vault.delete()로 폴더 삭제
                                await this.app.vault.delete(folderExists, true);
                                new Notice(`✅ "${folder}" 폴더가 삭제되었습니다.`);
                            } catch (e) {
                                console.error('폴더 삭제 오류:', e);
                                new Notice(`⚠️ "${folder}" 폴더 삭제 실패. 수동으로 삭제하세요.`);
                            }
                        } else {
                            new Notice(`✅ "${folder}" 폴더가 목록에서 제거되었습니다.`);
                        }
                        
                        this.onOpen(); // 새로고침
                    }
                });
            }
        });

        // 새 폴더 추가 (스크롤 영역 내부)
        const addFolderSection = scrollContainer.createDiv({ cls: 'add-folder-section' });
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
        folderInput.style.fontSize = '16px'; // iOS 자동 줌 방지
        folderInput.style.minHeight = '44px'; // 터치 최적화

        const addBtn = inputContainer.createEl('button', { text: '➕ 추가', cls: 'mod-cta' });
        addBtn.style.minHeight = '44px'; // 터치 최적화
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

            // 폴더 생성 (모바일 호환)
            const folderPath = `${this.plugin.settings.questionsFolder}/${folderName}`;
            const folderExists = this.app.vault.getAbstractFileByPath(folderPath);
            if (!folderExists) {
                try {
                    await this.app.vault.createFolder(folderPath);
                } catch (e) {
                    console.log('폴더가 이미 존재할 수 있음');
                }
            }

            new Notice(`✅ "${folderName}" 폴더가 생성되었습니다!`);
            folderInput.value = '';
            this.onOpen(); // 새로고침
        });

        // 하단 고정 버튼 영역
        const footer = contentEl.createDiv({ cls: 'modal-footer-fixed' });
        footer.style.cssText = `
            flex: 0 0 auto;
            padding: 20px;
            background: var(--background-primary);
            border-top: 2px solid var(--interactive-accent);
            margin-top: 0;
        `;
        
        const closeBtn = footer.createEl('button', { text: '✅ 저장하고 닫기', cls: 'mod-cta' });
        closeBtn.style.cssText = `
            width: 100%;
            min-height: 48px;
            font-size: 16px;
            font-weight: 600;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s;
            background: var(--interactive-accent);
            color: var(--text-on-accent);
        `;
        
        closeBtn.addEventListener('mouseenter', () => {
            closeBtn.style.transform = 'translateY(-2px)';
            closeBtn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
        });
        closeBtn.addEventListener('mouseleave', () => {
            closeBtn.style.transform = 'translateY(0)';
            closeBtn.style.boxShadow = 'none';
        });
        closeBtn.addEventListener('click', () => this.close());

        this.addStyles();
    }

    async getQuestionCountInFolder(folder) {
        const folderPath = `${this.plugin.settings.questionsFolder}/${folder}`;
        
        // 모바일 호환: getAbstractFileByPath 사용
        const folderExists = this.app.vault.getAbstractFileByPath(folderPath);
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
                font-size: 14px;
                line-height: 1.5;
            }
            .folders-section {
                margin-bottom: 20px;
            }
            .folder-item {
                transition: background 0.2s;
            }
            .folder-item:hover {
                background: var(--background-modifier-hover) !important;
            }
            
            /* 스크롤 영역 스타일 */
            .folder-scroll-container {
                scrollbar-width: thin;
                scrollbar-color: var(--interactive-accent) var(--background-modifier-border);
            }
            
            .folder-scroll-container::-webkit-scrollbar {
                width: 8px;
            }
            
            .folder-scroll-container::-webkit-scrollbar-track {
                background: var(--background-modifier-border);
                border-radius: 4px;
            }
            
            .folder-scroll-container::-webkit-scrollbar-thumb {
                background: var(--interactive-accent);
                border-radius: 4px;
            }
            
            .folder-scroll-container::-webkit-scrollbar-thumb:hover {
                background: var(--interactive-accent-hover);
            }
            
            /* 모바일 터치 최적화 */
            @media (max-width: 768px) {
                .folder-management-modal {
                    padding: 12px;
                    max-width: 100%;
                }
                .modal-header-fixed {
                    padding-bottom: 8px;
                }
                .folder-scroll-container {
                    padding: 8px 3px;
                    margin: 8px 0;
                }
                .folder-item {
                    padding: 15px 10px !important;
                    margin-bottom: 10px !important;
                }
                .folder-actions {
                    flex-wrap: wrap !important;
                }
                
                /* 입력 필드 - 최대 크기 */
                .add-folder-section input,
                .folder-management-modal input[type="text"] {
                    font-size: 18px !important;
                    padding: 16px !important;
                    min-height: 54px !important;
                }
                
                /* 버튼 - 작은 크기 */
                .folder-actions button,
                .folder-management-modal button {
                    padding: 8px 14px !important;
                    font-size: 13px !important;
                    min-height: 38px !important;
                    max-height: 38px !important;
                    touch-action: manipulation;
                    -webkit-tap-highlight-color: transparent;
                }
            }
            
            @media (max-width: 480px) {
                .folder-management-modal {
                    padding: 10px;
                }
                .folder-item {
                    flex-direction: column;
                    align-items: flex-start !important;
                    gap: 10px;
                }
                .folder-info {
                    width: 100%;
                    margin-bottom: 8px;
                }
                .folder-actions {
                    width: 100%;
                    justify-content: space-between;
                }
                .folder-actions button {
                    flex: 1;
                    min-width: 80px;
                }
            }
        `;
        document.head.appendChild(style);
    }

    async copyFolder(sourceFolder, targetFolder) {
        try {
            if (this.plugin.settings.questionFolders.includes(targetFolder)) {
                new Notice(`❌ "${targetFolder}" 폴더가 이미 존재합니다.`);
                return;
            }
            
            const sourcePath = `${this.plugin.settings.questionsFolder}/${sourceFolder}`;
            const targetPath = `${this.plugin.settings.questionsFolder}/${targetFolder}`;
            
            // 대상 폴더 생성
            await this.app.vault.createFolder(targetPath).catch(() => {});
            
            // 파일 복사 (폴더 정보 업데이트)
            const files = this.app.vault.getMarkdownFiles();
            const sourceFiles = files.filter(f => f.path.startsWith(sourcePath) && !f.path.includes('문제목록'));
            
            let copiedCount = 0;
            let skippedCount = 0;
            
            for (const file of sourceFiles) {
                const content = await this.app.vault.read(file);
                
                // 폴더 정보를 새 폴더명으로 변경 (## 폴더 섹션 업데이트)
                let updatedContent = content;
                
                // 1. ## 폴더 섹션 업데이트
                updatedContent = updatedContent.replace(
                    /^## 폴더\s*\n[^\n]+$/m,
                    `## 폴더\n${targetFolder}`
                );
                
                // 2. folder: 필드 업데이트 (YAML frontmatter나 일반 텍스트)
                updatedContent = updatedContent.replace(
                    /^folder:\s*.+$/m,
                    `folder: ${targetFolder}`
                );
                
                // 3. 폴더 경로가 포함된 경우 업데이트
                updatedContent = updatedContent.replace(
                    new RegExp(`Questions/${sourceFolder}/`, 'g'),
                    `Questions/${targetFolder}/`
                );
                
                // 파일이 이미 존재하는지 확인
                const targetFilePath = `${targetPath}/${file.name}`;
                const existingFile = this.app.vault.getAbstractFileByPath(targetFilePath);
                
                if (existingFile) {
                    // 파일이 존재하면 건너뛰기
                    skippedCount++;
                    console.log(`파일 건너뜀 (이미 존재): ${targetFilePath}`);
                } else {
                    // 파일이 존재하지 않으면 새로 생성
                    await this.app.vault.create(targetFilePath, updatedContent);
                    copiedCount++;
                }
            }
            
            // 폴더 목록에 추가
            this.plugin.settings.questionFolders.push(targetFolder);
            await this.plugin.saveSettings();
            
            const msg = skippedCount > 0 
                ? `✅ ${targetFolder} 폴더 생성 완료 (복사: ${copiedCount}개, 건너뜀: ${skippedCount}개)`
                : `✅ ${targetFolder} 폴더 생성 완료 (${copiedCount}개 문제)`;
            
            new Notice(msg);
            this.onOpen();
        } catch (error) {
            console.error('폴더 복사 오류:', error);
            new Notice(`❌ 복사 실패: ${error.message}`);
        }
    }

    async renameFolder(oldFolder, newFolder) {
        try {
            if (this.plugin.settings.questionFolders.includes(newFolder)) {
                new Notice(`❌ "${newFolder}" 폴더가 이미 존재합니다.`);
                return;
            }
            const oldPath = `${this.plugin.settings.questionsFolder}/${oldFolder}`;
            const newPath = `${this.plugin.settings.questionsFolder}/${newFolder}`;
            await this.app.vault.createFolder(newPath).catch(() => {});
            
            const files = this.app.vault.getMarkdownFiles();
            const oldFiles = files.filter(f => f.path.startsWith(oldPath));
            
            // 각 파일의 내용도 업데이트
            for (const file of oldFiles) {
                const content = await this.app.vault.read(file);
                
                // 폴더 정보 업데이트
                let updatedContent = content;
                
                // 1. ## 폴더 섹션 업데이트
                updatedContent = updatedContent.replace(
                    /^## 폴더\s*\n[^\n]+$/m,
                    `## 폴더\n${newFolder}`
                );
                
                // 2. folder: 필드 업데이트
                updatedContent = updatedContent.replace(
                    /^folder:\s*.+$/m,
                    `folder: ${newFolder}`
                );
                
                // 3. 폴더 경로 업데이트
                updatedContent = updatedContent.replace(
                    new RegExp(`Questions/${oldFolder}/`, 'g'),
                    `Questions/${newFolder}/`
                );
                
                // 새 위치에 파일 생성
                await this.app.vault.create(`${newPath}/${file.name}`, updatedContent);
            }
            
            const index = this.plugin.settings.questionFolders.indexOf(oldFolder);
            if (index !== -1) {
                this.plugin.settings.questionFolders[index] = newFolder;
            }
            await this.plugin.saveSettings();
            
            // 이전 폴더 삭제
            const oldFolderObj = this.app.vault.getAbstractFileByPath(oldPath);
            if (oldFolderObj) await this.app.vault.delete(oldFolderObj, true).catch(() => {});
            
            new Notice(`✅ 이름 변경 완료`);
            this.onOpen();
        } catch (error) {
            new Notice(`❌ 변경 실패: ${error.message}`);
        }
    }

    async deleteFolder(folder) {
        try {
            const count = await this.getQuestionCountInFolder(folder);
            const msg = count > 0 ? `"${folder}" 폴더에 ${count}개의 문제가 있습니다.\n정말 삭제하시겠습니까?` : `"${folder}" 폴더를 삭제하시겠습니까?`;
            if (!confirm(msg)) return;
            const folderPath = `${this.plugin.settings.questionsFolder}/${folder}`;
            const folderObj = this.app.vault.getAbstractFileByPath(folderPath);
            if (folderObj) await this.app.vault.delete(folderObj, true);
            this.plugin.settings.questionFolders = this.plugin.settings.questionFolders.filter(f => f !== folder);
            await this.plugin.saveSettings();
            
            new Notice(`✅ 삭제 완료`);
            this.onOpen();
        } catch (error) {
            new Notice(`❌ 삭제 실패: ${error.message}`);
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// 텍스트 입력 모달
class TextInputModal extends Modal {
    constructor(app, title, description, defaultValue, onSubmit) {
        super(app);
        this.title = title;
        this.description = description;
        this.defaultValue = defaultValue || '';
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('text-input-modal');

        // 모바일 감지
        const isMobile = this.app.isMobile || window.innerWidth <= 768;

        contentEl.createEl('h2', { text: this.title });
        
        if (this.description) {
            contentEl.createEl('p', { text: this.description });
        }

        const inputContainer = contentEl.createDiv({ cls: 'input-container' });
        const input = inputContainer.createEl('input', {
            type: 'text',
            value: this.defaultValue,
            placeholder: this.description
        });
        input.style.width = '100%';
        input.style.padding = isMobile ? '12px' : '8px';
        input.style.marginBottom = '15px';
        input.style.fontSize = isMobile ? '16px' : '14px'; // iOS에서 자동 줌 방지

        const buttonContainer = contentEl.createDiv({ cls: 'button-container' });
        buttonContainer.style.display = 'flex';
        buttonContainer.style.gap = '10px';
        buttonContainer.style.justifyContent = 'flex-end';
        if (isMobile) {
            buttonContainer.style.flexDirection = 'column';
        }

        const confirmBtn = buttonContainer.createEl('button', {
            text: '✅ 확인',
            cls: 'mod-cta'
        });
        confirmBtn.style.minHeight = '44px'; // 터치 최적화
        confirmBtn.style.fontSize = '16px';

        const cancelBtn = buttonContainer.createEl('button', {
            text: '❌ 취소'
        });
        cancelBtn.style.minHeight = '44px'; // 터치 최적화
        cancelBtn.style.fontSize = '16px';

        confirmBtn.addEventListener('click', async () => {
            const value = input.value.trim();
            if (value) {
                await this.onSubmit(value);
                this.close();
            } else {
                new Notice('❌ 값을 입력해주세요!');
            }
        });

        cancelBtn.addEventListener('click', () => {
            this.close();
        });

        input.addEventListener('keypress', async (e) => {
            if (e.key === 'Enter') {
                const value = input.value.trim();
                if (value) {
                    await this.onSubmit(value);
                    this.close();
                }
            }
        });

        // 모바일에서는 키보드가 올라올 때까지 대기
        setTimeout(() => {
            input.focus();
            input.select();
        }, isMobile ? 300 : 50);
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
        this.isPaused = false;
        this.pausedTime = 0;
        this.isExiting = false; // 나가기 중인지 확인

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

    showImageZoom(imageUrl, altText) {
        // 전체 화면 오버레이 생성
        const overlay = document.body.createDiv({ cls: 'image-zoom-overlay' });
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        overlay.style.zIndex = '10000';
        overlay.style.display = 'flex';
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
        imgContainer.style.maxHeight = 'min(80vh, 600px)';
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
            if (e.button === 0) { // 왼쪽 클릭만
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
        
        // 더블클릭으로 줌 토글 (PC & 모바일)
        let lastTap = 0;
        const handleDoubleTap = () => {
            if (scale > 1) {
                // 줌 아웃 (원래대로)
                scale = 1;
                posX = 0;
                posY = 0;
            } else {
                // 줌 인 (2배)
                scale = 2;
            }
            zoomedImg.style.transform = `translate(${posX}px, ${posY}px) scale(${scale})`;
        };
        
        zoomedImg.addEventListener('dblclick', handleDoubleTap);
        
        // 모바일 더블탭
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
        zoomControls.style.bottom = '30px';
        zoomControls.style.right = '30px';
        zoomControls.style.display = 'flex';
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
        
        // 오버레이 배경 클릭 시 닫기 (이미지 컨테이너는 제외)
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeOverlay();
            }
        });
        
        // 이미지 컨테이너 클릭 시 전파 중지 (닫히지 않도록)
        imgContainer.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        
        // ESC 키로 닫기 (이벤트 전파 중지로 QuizModal ESC와 충돌 방지)
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                e.preventDefault();
                closeOverlay();
            }
        };
        document.addEventListener('keydown', handleEscape, true);
    }

    async onOpen() {
        // ESC 키 기본 동작을 막고 confirmExit만 호출
        const originalClose = this.close.bind(this);
        this.close = () => {
            // 명시적으로 close()가 호출된 경우에만 실제로 닫기
            if (this.isExiting) {
                originalClose();
            }
        };
        
        // ESC 키 리스너
        this.scope.register([], 'Escape', (evt) => {
            evt.preventDefault();
            evt.stopPropagation();
            this.confirmExit();
            return false;
        });
        
        const { contentEl } = this;
        contentEl.addClass('quiz-play-modal');
        
        // Flexbox 레이아웃 적용 (액션 버튼이 하단에 고정되도록)
        contentEl.style.cssText = `
            display: flex;
            flex-direction: column;
            height: 100%;
            overflow: hidden;
        `;

        this.showQuestion();
        this.addStyles();
    }

    showQuestion() {
        const { contentEl } = this;
        contentEl.empty();

        console.log('=== showQuestion() 진입 ===');
        console.log('this.questions 존재?', !!this.questions);
        console.log('this.questions 길이:', this.questions ? this.questions.length : 'NULL');
        console.log('this.currentIndex:', this.currentIndex);

        if (!this.questions) {
            console.error('❌❌❌ this.questions가 NULL입니다!');
            contentEl.createEl('h2', { text: '❌ 오류: 문제 배열이 없습니다' });
            return;
        }

        if (this.questions.length === 0) {
            console.error('❌❌❌ this.questions 길이가 0입니다!');
            contentEl.createEl('h2', { text: '❌ 오류: 문제가 비어있습니다' });
            return;
        }

        if (this.currentIndex >= this.questions.length) {
            console.log('퀴즈 완료 - 결과 표시');
            this.showResults();
            return;
        }
        
        console.log('문제 표시 진행:', this.questions[this.currentIndex]);

        const question = this.questions[this.currentIndex];

        // 헤더
        const header = contentEl.createDiv({ cls: 'quiz-header' });
        
        // 상단 컨트롤 바
        const controlBar = header.createDiv({ cls: 'quiz-control-bar' });
        
        // 대시보드 돌아가기 버튼 (맨 앞)
        const dashboardBtn = controlBar.createEl('button', {
            text: '← 대시보드',
            cls: 'control-button dashboard-button'
        });
        dashboardBtn.onclick = () => {
            this.stopTimer();
            this.close();
            // 대시보드 열기
            new DashboardModal(this.app, this.plugin).open();
        };

        // 난이도 설정 버튼
        const difficultySettingsBtn = controlBar.createEl('button', { 
            text: '🎯',
            cls: 'control-button difficulty-settings-button'
        });
        const currentDiff = question.difficulty || 'C';
        difficultySettingsBtn.classList.add(`difficulty-${currentDiff}`);
        difficultySettingsBtn.title = `난이도 설정 (현재: ${currentDiff})`;
        difficultySettingsBtn.onclick = () => {
            new QuizQuestionSettingsModal(this.app, this.plugin, question, (updatedQuestion) => {
                // 난이도가 변경되면 UI 업데이트
                const difficulties = ['A+', 'A', 'A-', 'B', 'B-', 'C', 'D', 'E', 'F'];
                difficulties.forEach(d => difficultySettingsBtn.removeClass(`difficulty-${d}`));
                difficultySettingsBtn.classList.add(`difficulty-${updatedQuestion.difficulty}`);
                difficultySettingsBtn.title = `난이도 설정 (현재: ${updatedQuestion.difficulty})`;
                
                // question 객체 업데이트
                Object.assign(question, updatedQuestion);
            }).open();
        };

        // 이전 문제 버튼
        const prevBtn = controlBar.createEl('button', { 
            text: '⬅️ 이전',
            cls: 'control-button prev-button'
        });
        prevBtn.disabled = this.currentIndex === 0;
        prevBtn.onclick = () => {
            if (this.currentIndex > 0) {
                this.stopTimer();
                this.currentIndex--;
                this.showQuestion();
            }
        };

        // 일시정지 버튼
        const pauseBtn = controlBar.createEl('button', {
            text: this.isPaused ? '▶️ 재개' : '⏸️ 일시정지',
            cls: 'control-button pause-button'
        });
        pauseBtn.onclick = () => {
            this.togglePause();
            pauseBtn.setText(this.isPaused ? '▶️ 재개' : '⏸️ 일시정지');
        };
        this.pauseButton = pauseBtn;

        // 설정 버튼
        const settingsBtn = controlBar.createEl('button', {
            text: '⚙️',
            cls: 'control-button settings-button'
        });
        settingsBtn.onclick = () => {
            this.openSettings();
        };

        // 북마크 버튼
        const bookmarkBtn = controlBar.createEl('button', {
            text: question.bookmarked ? '⭐' : '☆',
            cls: 'control-button bookmark-button',
            attr: { title: question.bookmarked ? '북마크됨' : '북마크' }
        });
        bookmarkBtn.addEventListener('click', async () => {
            // toggleBookmark 호출 (새로운 북마크 상태 반환)
            const newBookmarkState = await this.plugin.toggleBookmark(question);
            
            // question 객체 업데이트
            question.bookmarked = newBookmarkState;
            
            // UI 업데이트
            bookmarkBtn.setText(question.bookmarked ? '⭐' : '☆');
            bookmarkBtn.setAttr('title', question.bookmarked ? '북마크됨' : '북마크');
        });
        
        // 문제 번호와 점수 표시
        const progress = header.createDiv({ cls: 'quiz-progress' });
        const progressLabel = progress.createDiv({ cls: 'progress-label' });
        const difficultyIcon = this.plugin.getDifficultyIcon(question.difficulty || 'C');
        const difficultyGrade = question.difficulty || 'C';
        progressLabel.setText(`[${question.number || (this.currentIndex + 1)}번] ${difficultyIcon}${difficultyGrade}`);
        const progressInfo = progress.createDiv({ cls: 'progress-info' });
        progressInfo.innerHTML = `<strong>${this.currentIndex + 1}/${this.questions.length}</strong> | ${this.score}점`;

        // 타이머 (두껍고 화려하게, 초 표시 포함)
        if (this.plugin.settings.enableTimer) {
            const timerContainer = header.createDiv({ cls: 'hanzi-timer-container' });
            const timerProgress = timerContainer.createDiv({ cls: 'hanzi-timer-progress' });
            this.timerFill = timerProgress.createDiv({ cls: 'hanzi-timer-fill' });
            this.timerText = timerContainer.createDiv({ cls: 'hanzi-timer-text' });
            
            this.timerContainer = timerContainer;
            this.updateTimer();
            this.startTimer();
        }

        // 스크롤 가능한 컨텐츠 영역 (이미지 + 문제 + 선택지)
        const scrollableContent = contentEl.createDiv({ cls: 'quiz-scrollable-content' });
        scrollableContent.style.cssText = `
            flex: 1;
            overflow-y: auto;
            overflow-x: hidden;
            padding: 0 10px;
            margin-bottom: 10px;
        `;

        // 이미지 (다중 이미지 지원)
        if (question.image && question.image.trim()) {
            const imgContainer = scrollableContent.createDiv({ cls: 'question-image-container' });
            imgContainer.style.display = 'flex';
            imgContainer.style.flexWrap = 'wrap';
            imgContainer.style.gap = '10px';
            imgContainer.style.marginBottom = '15px';
            
            // 줄바꿈으로 구분된 이미지들 처리
            const imageLines = question.image.split('\n').filter(line => line.trim());
            
            for (const imageLine of imageLines) {
                let imageUrl = imageLine.trim();
                
                // 옵시디언 내부 링크 [[image.png]] 형식 처리
                if (imageUrl.includes('[[') && imageUrl.includes(']]')) {
                    const wikiMatch = imageUrl.match(/\[\[(.+?)\]\]/);
                    if (wikiMatch && wikiMatch[1]) {
                        const fileName = wikiMatch[1];
                        // 파일 찾기
                        const files = this.app.vault.getFiles();
                        const imageFile = files.find(f => 
                            f.name === fileName || 
                            f.path.endsWith(fileName) ||
                            f.basename === fileName.replace(/\.\w+$/, '')
                        );
                        
                        if (imageFile) {
                            imageUrl = this.app.vault.getResourcePath(imageFile);
                        }
                    }
                }
                // 마크다운 이미지 문법 ![alt](url) 처리
                else if (imageUrl.includes('![') && imageUrl.includes('](')) {
                    const imgMatch = imageUrl.match(/!\[.*?\]\((.*?)\)/);
                    if (imgMatch && imgMatch[1]) {
                        imageUrl = imgMatch[1];
                    }
                }
                // HTML img 태그인 경우
                else if (imageUrl.includes('<img')) {
                    const srcMatch = imageUrl.match(/src=["'](.+?)["']/);
                    if (srcMatch && srcMatch[1]) {
                        imageUrl = srcMatch[1];
                    }
                }
                
                // 이미지 래퍼
                const imgWrapper = imgContainer.createDiv();
                imgWrapper.style.flex = imageLines.length === 1 ? '1 1 100%' : '0 0 auto';
                imgWrapper.style.maxWidth = imageLines.length === 1 ? '100%' : '300px';
                
                // 이미지 생성
                const img = imgWrapper.createEl('img', {
                    attr: { 
                        src: imageUrl, 
                        alt: '문제 이미지',
                        onerror: "this.style.display='none'; this.parentElement.innerHTML='<p style=\"color: var(--text-muted); padding: 20px;\">⚠️ 이미지를 불러올 수 없습니다.</p>';"
                    },
                    cls: 'quiz-question-image'
                });
                
                img.style.width = '100%';
                img.style.height = 'auto';
                
                // 문제 이미지 확대 기능
                img.style.cursor = 'zoom-in';
                img.style.transition = 'transform 0.2s';
                
                img.addEventListener('click', () => {
                    this.showImageZoom(imageUrl, '문제 이미지');
                });
                
                img.addEventListener('mouseenter', () => {
                    img.style.transform = 'scale(1.05)';
                });
                
                img.addEventListener('mouseleave', () => {
                    img.style.transform = 'scale(1)';
                });
            }
        }

        // 문제 (클릭하면 힌트 토글)
        const questionText = scrollableContent.createDiv({ cls: 'question-text' });
        const questionHeading = questionText.createEl('h3', { text: question.question });
        
        // 힌트 컨테이너 (선택지 위에 표시되도록 position 조정)
        let hintEl = null;
        if ((question.hint && question.hint.trim()) || (question.hintImage && question.hintImage.trim())) {
            hintEl = questionText.createDiv({ cls: 'hint-container' });
            hintEl.style.cssText = `
                display: none;
                position: relative;
                z-index: 1000;
                background: var(--background-secondary);
                padding: 15px;
                margin: 10px 0;
                border-radius: 8px;
                border: 2px solid var(--interactive-accent);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
            `;
            
            if (question.hint && question.hint.trim()) {
                hintEl.createEl('p', { 
                    text: `💡 ${question.hint}`,
                    cls: 'hint-text'
                });
            }
            
            // 힌트 이미지 (다중 이미지 지원)
            if (question.hintImage && question.hintImage.trim()) {
                const hintImgContainer = hintEl.createDiv({ cls: 'hint-image-container' });
                hintImgContainer.style.marginTop = '10px';
                hintImgContainer.style.display = 'flex';
                hintImgContainer.style.flexWrap = 'wrap';
                hintImgContainer.style.gap = '8px';
                
                // 줄바꿈으로 구분된 이미지들 처리
                const hintImageLines = question.hintImage.split('\n').filter(line => line.trim());
                
                for (const imageLine of hintImageLines) {
                    let imageUrl = imageLine.trim();
                    
                    // 옵시디언 내부 링크 [[image.png]] 형식 처리
                    if (imageUrl.includes('[[') && imageUrl.includes(']]')) {
                        const wikiMatch = imageUrl.match(/\[\[(.+?)\]\]/);
                        if (wikiMatch && wikiMatch[1]) {
                            const fileName = wikiMatch[1];
                            const files = this.app.vault.getFiles();
                            const imageFile = files.find(f => 
                                f.name === fileName || 
                                f.path.endsWith(fileName) ||
                                f.basename === fileName.replace(/\.\w+$/, '')
                            );
                            
                            if (imageFile) {
                                imageUrl = this.app.vault.getResourcePath(imageFile);
                            }
                        }
                    }
                    // 마크다운 이미지 문법 ![alt](url) 처리
                    else if (imageUrl.includes('![') && imageUrl.includes('](')) {
                        const imgMatch = imageUrl.match(/!\[.*?\]\((.*?)\)/);
                        if (imgMatch && imgMatch[1]) {
                            imageUrl = imgMatch[1];
                        }
                    }
                    
                    // 이미지 래퍼
                    const imgWrapper = hintImgContainer.createDiv();
                    imgWrapper.style.flex = hintImageLines.length === 1 ? '1 1 100%' : '0 0 auto';
                    imgWrapper.style.maxWidth = hintImageLines.length === 1 ? '400px' : '200px';
                    
                    const img = imgWrapper.createEl('img', {
                        attr: {
                            src: imageUrl,
                            style: 'width: 100%; height: auto; border-radius: 6px; cursor: zoom-in; transition: transform 0.2s;'
                        }
                    });
                    
                    // 힌트 이미지 확대 기능
                    img.addEventListener('click', () => {
                        this.showImageZoom(imageUrl, '힌트 이미지');
                    });
                    
                    img.addEventListener('mouseenter', () => {
                        img.style.transform = 'scale(1.05)';
                    });
                    
                    img.addEventListener('mouseleave', () => {
                        img.style.transform = 'scale(1)';
                    });
                    
                    img.onerror = () => {
                        imgWrapper.setText('⚠️ 이미지 로드 실패');
                        imgWrapper.style.color = 'var(--text-muted)';
                        imgWrapper.style.padding = '10px';
                    };
                }
            }
            
            // 문제 클릭 시 힌트 토글
            questionText.style.cursor = 'pointer';
            questionText.style.userSelect = 'none';
            questionText.addEventListener('click', () => {
                if (hintEl.style.display === 'none') {
                    hintEl.style.display = 'block';
                } else {
                    hintEl.style.display = 'none';
                }
            });
        }

        // 선택지
        const optionsContainer = scrollableContent.createDiv({ cls: 'options-container' });
        optionsContainer.style.cssText = `
            margin-bottom: 15px;
            padding-right: 5px;
        `;
        
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
                cls: 'option-button'
            });
            
            // 선택지 텍스트 먼저 표시
            const optionText = optionBtn.createSpan({ 
                text: `${index + 1}. ${option}`,
                cls: 'option-text'
            });
            
            // 선택지 이미지가 있으면 텍스트 아래에 표시 (다중 이미지 지원)
            const originalIndex = question.options.indexOf(option);
            if (question.optionImages && question.optionImages[originalIndex] && question.optionImages[originalIndex].trim()) {
                const optionImageContainer = optionBtn.createDiv({ cls: 'option-image-container' });
                optionImageContainer.style.marginTop = '8px';
                optionImageContainer.style.display = 'flex';
                optionImageContainer.style.flexWrap = 'wrap';
                optionImageContainer.style.gap = '6px';
                optionImageContainer.style.justifyContent = 'center';
                optionImageContainer.style.maxHeight = '150px';
                optionImageContainer.style.overflow = 'auto';
                
                // 줄바꿈으로 구분된 이미지들 처리
                const optionImageLines = question.optionImages[originalIndex].split('\n').filter(line => line.trim());
                
                for (const imageLine of optionImageLines) {
                    let imageUrl = imageLine.trim();
                    
                    // 옵시디언 내부 링크 처리
                    if (imageUrl.includes('[[') && imageUrl.includes(']]')) {
                        const wikiMatch = imageUrl.match(/\[\[(.+?)\]\]/);
                        if (wikiMatch && wikiMatch[1]) {
                            const fileName = wikiMatch[1];
                            const files = this.app.vault.getFiles();
                            const imageFile = files.find(f => 
                                f.name === fileName || 
                                f.path.endsWith(fileName) ||
                                f.basename === fileName.replace(/\.\w+$/, '')
                            );
                            if (imageFile) {
                                imageUrl = this.app.vault.getResourcePath(imageFile);
                            }
                        }
                    }
                    // 마크다운 이미지 문법 처리
                    else if (imageUrl.includes('![') && imageUrl.includes('](')) {
                        const imgMatch = imageUrl.match(/!\[.*?\]\((.*?)\)/);
                        if (imgMatch && imgMatch[1]) {
                            imageUrl = imgMatch[1];
                        }
                    }
                    // HTML img 태그 처리
                    else if (imageUrl.includes('<img')) {
                        const srcMatch = imageUrl.match(/src=["'](.+?)["']/);
                        if (srcMatch && srcMatch[1]) {
                            imageUrl = srcMatch[1];
                        }
                    }
                    
                    // 이미지 래퍼
                    const imgWrapper = optionImageContainer.createDiv();
                    imgWrapper.style.flex = optionImageLines.length === 1 ? '1 1 100%' : '0 0 auto';
                    imgWrapper.style.maxWidth = optionImageLines.length === 1 ? '100%' : '80px';
                    imgWrapper.style.cursor = 'zoom-in';
                    
                    const img = imgWrapper.createEl('img', {
                        attr: { 
                            src: imageUrl, 
                            alt: `선택지 ${index + 1} 이미지`
                        }
                    });
                    img.style.maxWidth = '100%';
                    img.style.maxHeight = '100px';
                    img.style.objectFit = 'contain';
                    img.style.transition = 'transform 0.2s';
                    
                    // 이미지 클릭 시 확대 기능
                    img.addEventListener('click', (e) => {
                        e.stopPropagation(); // 버튼 클릭 방지
                        this.showImageZoom(imageUrl, `선택지 ${index + 1} 이미지`);
                    });
                    
                    img.addEventListener('mouseenter', () => {
                        img.style.transform = 'scale(1.05)';
                    });
                    
                    img.addEventListener('mouseleave', () => {
                        img.style.transform = 'scale(1)';
                    });
                    
                    img.onerror = () => {
                        imgWrapper.setText('⚠️');
                        imgWrapper.style.color = 'var(--text-muted)';
                        imgWrapper.style.padding = '5px';
                        console.warn('선택지 이미지 로드 실패:', imageUrl);
                    };
                }
            }
            
            optionBtn.addEventListener('click', () => {
                this.selectAnswer(index, question);
            });
        });

        // 액션 버튼 바 (돌아가기 + 편집 + 종료)
        const actionBar = contentEl.createDiv({ cls: 'action-bar' });
        actionBar.style.cssText = `
            display: flex;
            gap: 10px;
            padding: 15px 0 10px 0;
            margin-top: auto;
            position: sticky;
            bottom: 0;
            background: var(--background-primary);
            border-top: 1px solid var(--background-modifier-border);
            z-index: 10;
        `;
        
        // 폴더 관리 돌아가기 버튼
        const folderBtn = actionBar.createEl('button', {
            text: '← 폴더 관리',
            cls: 'action-button folder-button'
        });
        folderBtn.addEventListener('click', () => {
            this.stopTimer();
            this.close();
            // 폴더 관리 모달 열기
            new FolderManagementModal(this.app, this.plugin).open();
        });
        
        // 편집 버튼
        const editBtn = actionBar.createEl('button', {
            text: '✏️ 편집',
            cls: 'action-button edit-button'
        });
        editBtn.addEventListener('click', async () => {
            this.stopTimer();
            this.isPaused = true;
            
            // 편집 옵션 모달 생성
            const optionModal = new Modal(this.app);
            optionModal.titleEl.setText('✏️ 편집 옵션');
            
            const { contentEl: modalContent } = optionModal;
            modalContent.style.padding = '20px';
            modalContent.style.minWidth = '300px';
            
            modalContent.createEl('p', { 
                text: '어떻게 편집하시겠습니까?',
                cls: 'edit-option-desc'
            }).style.marginBottom = '20px';
            
            const btnContainer = modalContent.createDiv({ cls: 'edit-option-buttons' });
            btnContainer.style.display = 'flex';
            btnContainer.style.flexDirection = 'column';
            btnContainer.style.gap = '10px';
            
            // 모달에서 편집
            const modalEditBtn = btnContainer.createEl('button', {
                text: '📝 모달에서 편집',
                cls: 'mod-cta'
            });
            modalEditBtn.style.padding = '12px';
            modalEditBtn.addEventListener('click', () => {
                optionModal.close();
                
                // 편집 모달 열기
                const editModal = new HanziQuestionModal(this.app, this.plugin, question);
                editModal.open();
                
                // 편집 모달이 닫히면 퀴즈 재개
                editModal.onClose = () => {
                    this.isPaused = false;
                    this.showQuestion(); // 변경사항 반영을 위해 다시 렌더링
                };
            });
            
            // MD 파일에서 직접 편집
            const fileEditBtn = btnContainer.createEl('button', {
                text: '📄 MD 파일에서 편집',
                cls: 'mod-cta'
            });
            fileEditBtn.style.padding = '12px';
            fileEditBtn.addEventListener('click', async () => {
                optionModal.close();
                
                // 파일 열기
                const file = this.app.vault.getAbstractFileByPath(question.filePath);
                if (file) {
                    const leaf = this.app.workspace.getLeaf(false);
                    await leaf.openFile(file);
                    new Notice('📄 MD 파일 열림. 편집 후 저장하세요.');
                    
                    // 퀴즈는 일시정지 상태 유지
                    this.isPaused = true;
                } else {
                    new Notice('❌ 파일을 찾을 수 없습니다.');
                }
            });
            
            // 취소
            const cancelBtn = btnContainer.createEl('button', {
                text: '❌ 취소'
            });
            cancelBtn.style.padding = '12px';
            cancelBtn.addEventListener('click', () => {
                optionModal.close();
                this.isPaused = false;
            });
            
            optionModal.open();
        });
        
        // 종료 버튼
        const quitBtn = actionBar.createEl('button', { 
            text: '❌ 종료',
            cls: 'action-button quit-button'
        });
        quitBtn.addEventListener('click', () => {
            this.confirmExit();
        });
    }
    
    confirmExit() {
        const confirmModal = new Modal(this.app);
        confirmModal.titleEl.setText('❓ 퀴즈 나가기');
        
        const { contentEl } = confirmModal;
        contentEl.style.padding = '20px';
        contentEl.style.textAlign = 'center';
        
        contentEl.createEl('p', {
            text: '퀴즈를 종료하시겠습니까?',
            cls: 'confirm-message'
        }).style.cssText = 'font-size: 16px; margin-bottom: 20px; color: var(--text-normal);';
        
        const btnContainer = contentEl.createDiv({ cls: 'confirm-buttons' });
        btnContainer.style.cssText = 'display: flex; gap: 10px; justify-content: center;';
        
        // 폴더 관리로 이동
        const toFolderBtn = btnContainer.createEl('button', {
            text: '📁 폴더 관리',
            cls: 'mod-cta'
        });
        toFolderBtn.style.padding = '10px 20px';
        toFolderBtn.addEventListener('click', () => {
            confirmModal.close();
            this.stopTimer();
            // QuizModal은 유지하고 폴더 선택 화면으로 이동
            this.showFolderSelection();
        });
        
        // 완전히 나가기
        const exitBtn = btnContainer.createEl('button', {
            text: '🚪 완전히 나가기'
        });
        exitBtn.style.padding = '10px 20px';
        exitBtn.addEventListener('click', () => {
            confirmModal.close();
            this.stopTimer();
            this.isExiting = true;  // 실제 종료 플래그 설정
            this.close();
        });
        
        // 취소
        const cancelBtn = btnContainer.createEl('button', {
            text: '↩️ 계속하기'
        });
        cancelBtn.style.padding = '10px 20px';
        cancelBtn.addEventListener('click', () => {
            confirmModal.close();
        });
        
        confirmModal.open();
    }
    
    showFolderSelection() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('quiz-play-modal');
        
        // 폴더 선택 UI 렌더링 (FolderSelectionModal과 유사하게)
        contentEl.createEl('h2', { text: '📁 폴더 선택' });
        
        const folderList = contentEl.createDiv({ cls: 'folder-list' });
        folderList.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 10px;
            margin: 20px 0;
        `;
        
        const folders = this.plugin.settings.questionFolders || ['기본'];
        
        folders.forEach(folder => {
            const folderBtn = folderList.createEl('button', {
                text: `📁 ${folder}`,
                cls: 'folder-select-button'
            });
            folderBtn.style.cssText = `
                padding: 15px;
                font-size: 16px;
                cursor: pointer;
                background: var(--interactive-normal);
                border: 1px solid var(--background-modifier-border);
                border-radius: 8px;
                transition: all 0.2s;
            `;
            folderBtn.addEventListener('mouseenter', () => {
                folderBtn.style.background = 'var(--interactive-hover)';
            });
            folderBtn.addEventListener('mouseleave', () => {
                folderBtn.style.background = 'var(--interactive-normal)';
            });
            folderBtn.addEventListener('click', async () => {
                await this.startQuizFromFolder(folder);
            });
        });
        
        // 대시보드로 돌아가기
        const backBtn = contentEl.createEl('button', {
            text: '← 대시보드',
            cls: 'back-button'
        });
        backBtn.style.cssText = 'margin-top: 20px; padding: 10px 20px;';
        backBtn.addEventListener('click', () => {
            this.close();
            new DashboardModal(this.app, this.plugin).open();
        });
    }
    
    async startQuizFromFolder(folder) {
        // 폴더의 문제 로드
        const questions = await this.plugin.getQuestionsByFolder(folder);
        
        console.log(`📂 폴더 "${folder}" 문제 로드:`, questions.length, '개');
        
        if (questions.length === 0) {
            new Notice(`❌ ${folder} 폴더에 문제가 없습니다.`);
            return;
        }
        
        // 퀴즈 초기화
        this.questions = this.shuffleArray([...questions]);
        this.allQuestions = [...this.questions];
        this.currentIndex = 0;
        this.score = 0;
        this.results = [];
        this.startTime = Date.now();
        
        console.log('퀴즈 초기화 완료, 문제 표시 시작');
        
        // 문제 표시
        const { contentEl } = this;
        contentEl.empty();
        this.showQuestion();
    }

    startTimer() {
        if (!this.plugin.settings.enableTimer || this.isPaused) return;

        this.timeRemaining = this.plugin.settings.timerPerQuestion;
        this.updateTimer();

        this.timerInterval = setInterval(() => {
            if (!this.isPaused) {
                this.timeRemaining--;
                this.updateTimer();

                if (this.timeRemaining <= 0) {
                    this.stopTimer();
                    this.selectAnswer(-1, this.questions[this.currentIndex]); // 시간 초과 = 오답
                }
            }
        }, 1000);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    togglePause() {
        this.isPaused = !this.isPaused;
        
        if (this.isPaused) {
            this.pausedTime = this.timeRemaining;
            new Notice('⏸️ 일시정지됨');
        } else {
            this.timeRemaining = this.pausedTime;
            new Notice('▶️ 재개됨');
        }
    }

    openSettings() {
        this.isPaused = true;
        if (this.pauseButton) {
            this.pauseButton.setText('▶️ 재개');
        }
        
        const settingsModal = new Modal(this.app);
        settingsModal.titleEl.setText('⚙️ 퀴즈 설정');
        
        const { contentEl } = settingsModal;
        contentEl.style.padding = '20px';
        contentEl.style.minWidth = '400px';

        // 타이머 설정
        contentEl.createEl('h3', { text: '⏱️ 타이머 설정' });
        
        const timerSetting = contentEl.createDiv({ cls: 'setting-item' });
        timerSetting.createEl('div', { text: '타이머 사용', cls: 'setting-item-name' });
        const timerToggle = timerSetting.createEl('input', { type: 'checkbox' });
        timerToggle.checked = this.plugin.settings.enableTimer;
        timerToggle.onchange = async () => {
            this.plugin.settings.enableTimer = timerToggle.checked;
            await this.plugin.saveSettings();
        };

        const timeSetting = contentEl.createDiv({ cls: 'setting-item' });
        timeSetting.createEl('div', { text: '문제당 시간 (초)', cls: 'setting-item-name' });
        const timeInput = timeSetting.createEl('input', { type: 'number', value: this.plugin.settings.timerPerQuestion });
        timeInput.style.width = '80px';
        timeInput.onchange = async () => {
            this.plugin.settings.timerPerQuestion = parseInt(timeInput.value) || 30;
            await this.plugin.saveSettings();
        };

        // 힌트 설정
        contentEl.createEl('h3', { text: '💡 힌트 설정' });
        
        const hintSetting = contentEl.createDiv({ cls: 'setting-item' });
        hintSetting.createEl('div', { text: '오답 시 힌트 표시', cls: 'setting-item-name' });
        const hintToggle = hintSetting.createEl('input', { type: 'checkbox' });
        hintToggle.checked = this.plugin.settings.showHintAfterWrong;
        hintToggle.onchange = async () => {
            this.plugin.settings.showHintAfterWrong = hintToggle.checked;
            await this.plugin.saveSettings();
        };

        // 버튼
        const btnContainer = contentEl.createDiv({ cls: 'modal-button-container' });
        btnContainer.style.marginTop = '20px';
        btnContainer.style.display = 'flex';
        btnContainer.style.gap = '10px';
        btnContainer.style.justifyContent = 'flex-end';

        const closeBtn = btnContainer.createEl('button', { text: '닫기', cls: 'mod-cta' });
        closeBtn.onclick = () => {
            settingsModal.close();
            this.isPaused = false;
            if (this.pauseButton) {
                this.pauseButton.setText('⏸️ 일시정지');
            }
        };

        settingsModal.open();
    }

    updateTimer() {
        if (this.timerFill && this.timerText && this.timerContainer) {
            const totalTime = this.plugin.settings.timerPerQuestion;
            const percentage = (this.timeRemaining / totalTime) * 100;
            
            this.timerFill.style.width = `${percentage}%`;
            this.timerText.setText(`${this.timeRemaining}초`);
            
            // 상태별 스타일 적용
            this.timerContainer.removeClass('timer-warning', 'timer-expired');
            
            if (this.timeRemaining <= 5 && this.timeRemaining > 0) {
                this.timerContainer.addClass('timer-warning');
            } else if (this.timeRemaining <= 0) {
                this.timerContainer.addClass('timer-expired');
            }
        }
    }

    async selectAnswer(selectedIndex, question) {
        console.log("=" .repeat(60));
        console.log("🎯 selectAnswer 호출됨");
        console.log(`  selectedIndex: ${selectedIndex}`);
        console.log(`  question.shuffledAnswerIndex: ${question.shuffledAnswerIndex}`);
        console.log(`  question.answer: ${question.answer}`);
        console.log(`  question.hanzi: ${question.hanzi}`);
        console.log("=" .repeat(60));
        
        this.stopTimer();

        const isCorrect = selectedIndex === question.shuffledAnswerIndex;
        
        console.log(`  정답 여부: ${isCorrect}`);
        
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
        feedback.style.top = '50%';
        feedback.style.left = '50%';
        feedback.style.transform = 'translate(-50%, -50%)';
        feedback.style.width = '90%';
        feedback.style.maxWidth = '500px';
        feedback.style.maxHeight = '80vh';
        feedback.style.overflow = 'auto';
        feedback.style.backgroundColor = isCorrect ? 'rgba(76, 175, 80, 0.98)' : 'rgba(244, 67, 54, 0.98)';
        feedback.style.display = 'flex';
        feedback.style.flexDirection = 'column';
        feedback.style.alignItems = 'center';
        feedback.style.justifyContent = 'center';
        feedback.style.color = 'white';
        feedback.style.zIndex = '1000';
        feedback.style.padding = '30px 20px';
        feedback.style.borderRadius = '15px';
        feedback.style.boxShadow = '0 10px 40px rgba(0,0,0,0.3)';

        const icon = feedback.createEl('div', { 
            text: isCorrect ? '✅' : '❌',
            cls: 'feedback-icon'
        });
        icon.style.fontSize = '50px';
        icon.style.marginBottom = '15px';

        const message = feedback.createEl('h2', { 
            text: isCorrect ? '정답입니다!' : '틀렸습니다!'
        });
        message.style.fontSize = '24px';
        message.style.marginBottom = '10px';

        if (!isCorrect && (question.hint || question.hintImage) && this.plugin.settings.showHintAfterWrong) {
            const hintContainer = feedback.createDiv({ cls: 'feedback-hint-container' });
            hintContainer.style.marginTop = '15px';
            hintContainer.style.padding = '12px';
            hintContainer.style.backgroundColor = 'rgba(0,0,0,0.3)';
            hintContainer.style.borderRadius = '8px';
            hintContainer.style.maxWidth = '400px';
            
            if (question.hint && question.hint.trim()) {
                const hint = hintContainer.createEl('p', { text: `💡 힌트: ${question.hint}` });
                hint.style.fontSize = '15px';
                hint.style.margin = '0';
            }
            
            // 힌트 이미지
            if (question.hintImage && question.hintImage.trim()) {
                let imageUrl = question.hintImage.trim();
                
                // 옵시디언 내부 링크 처리
                if (imageUrl.includes('[[') && imageUrl.includes(']]')) {
                    const wikiMatch = imageUrl.match(/\[\[(.+?)\]\]/);
                    if (wikiMatch && wikiMatch[1]) {
                        const fileName = wikiMatch[1];
                        const files = this.app.vault.getFiles();
                        const imageFile = files.find(f => 
                            f.name === fileName || 
                            f.path.endsWith(fileName) ||
                            f.basename === fileName.replace(/\.\w+$/, '')
                        );
                        
                        if (imageFile) {
                            imageUrl = this.app.vault.getResourcePath(imageFile);
                        }
                    }
                }
                // 마크다운 이미지 문법 처리
                else if (imageUrl.includes('![') && imageUrl.includes('](')) {
                    const imgMatch = imageUrl.match(/!\[.*?\]\((.*?)\)/);
                    if (imgMatch && imgMatch[1]) {
                        imageUrl = imgMatch[1];
                    }
                }
                
                const hintImg = hintContainer.createEl('img', {
                    attr: {
                        src: imageUrl,
                        style: 'width: 100%; max-width: 350px; height: auto; margin-top: 10px; border-radius: 6px; display: block;'
                    }
                });
                hintImg.onerror = () => {
                    hintImg.style.display = 'none';
                };
            }
        }

        if (!isCorrect) {
            const correctAnswerText = feedback.createEl('p', { 
                text: `정답: ${question.options[question.answer]}`
            });
            correctAnswerText.style.fontSize = '16px';
            correctAnswerText.style.marginTop = '10px';
            correctAnswerText.style.fontWeight = 'bold';
            
            // 노트보기 버튼 (노트 또는 노트 이미지가 있을 때)
            if ((question.note && question.note.trim()) || (question.noteImage && question.noteImage.trim())) {
                const noteBtn = feedback.createEl('button', { 
                    text: '📝 노트보기',
                    cls: 'note-button'
                });
                noteBtn.style.marginTop = '15px';
                noteBtn.style.padding = '10px 20px';
                noteBtn.style.fontSize = '14px';
                noteBtn.style.backgroundColor = 'rgba(255,255,255,0.2)';
                noteBtn.style.color = 'white';
                noteBtn.style.border = '2px solid white';
                noteBtn.style.borderRadius = '15px';
                noteBtn.style.cursor = 'pointer';
                noteBtn.style.fontWeight = 'bold';
                
                noteBtn.addEventListener('click', () => {
                    // 노트 표시 영역 토글
                    let noteDisplay = feedback.querySelector('.note-display');
                    if (noteDisplay) {
                        noteDisplay.remove();
                        noteBtn.setText('📝 노트보기');
                    } else {
                        noteDisplay = feedback.createEl('div', { cls: 'note-display' });
                        noteDisplay.style.marginTop = '15px';
                        noteDisplay.style.padding = '15px';
                        noteDisplay.style.backgroundColor = 'rgba(0,0,0,0.3)';
                        noteDisplay.style.borderRadius = '8px';
                        noteDisplay.style.maxWidth = '400px';
                        noteDisplay.style.fontSize = '14px';
                        noteDisplay.style.lineHeight = '1.6';
                        noteDisplay.style.textAlign = 'left';
                        
                        if (question.note && question.note.trim()) {
                            const noteText = noteDisplay.createEl('div');
                            noteText.style.whiteSpace = 'pre-wrap';
                            noteText.setText(question.note);
                        }
                        
                        // 노트 이미지 (다중 이미지 지원)
                        if (question.noteImage && question.noteImage.trim()) {
                            const noteImgContainer = noteDisplay.createDiv();
                            noteImgContainer.style.display = 'flex';
                            noteImgContainer.style.flexWrap = 'wrap';
                            noteImgContainer.style.gap = '8px';
                            noteImgContainer.style.marginTop = '10px';
                            
                            // 줄바꿈으로 구분된 이미지들 처리
                            const noteImageLines = question.noteImage.split('\n').filter(line => line.trim());
                            
                            for (const imageLine of noteImageLines) {
                                let imageUrl = imageLine.trim();
                                
                                // 옵시디언 내부 링크 처리
                                if (imageUrl.includes('[[') && imageUrl.includes(']]')) {
                                    const wikiMatch = imageUrl.match(/\[\[(.+?)\]\]/);
                                    if (wikiMatch && wikiMatch[1]) {
                                        const fileName = wikiMatch[1];
                                        const files = this.app.vault.getFiles();
                                        const imageFile = files.find(f => 
                                            f.name === fileName || 
                                            f.path.endsWith(fileName) ||
                                            f.basename === fileName.replace(/\.\w+$/, '')
                                        );
                                        
                                        if (imageFile) {
                                            imageUrl = this.app.vault.getResourcePath(imageFile);
                                        }
                                    }
                                }
                                // 마크다운 이미지 문법 처리
                                else if (imageUrl.includes('![') && imageUrl.includes('](')) {
                                    const imgMatch = imageUrl.match(/!\[.*?\]\((.*?)\)/);
                                    if (imgMatch && imgMatch[1]) {
                                        imageUrl = imgMatch[1];
                                    }
                                }
                                
                                // 이미지 래퍼
                                const imgWrapper = noteImgContainer.createDiv();
                                imgWrapper.style.flex = noteImageLines.length === 1 ? '1 1 100%' : '0 0 auto';
                                imgWrapper.style.maxWidth = noteImageLines.length === 1 ? '350px' : '200px';
                                
                                const noteImg = imgWrapper.createEl('img', {
                                    attr: {
                                        src: imageUrl,
                                        style: 'width: 100%; height: auto; border-radius: 6px; display: block;'
                                    }
                                });
                                noteImg.onerror = () => {
                                    imgWrapper.setText('⚠️ 이미지 로드 실패');
                                    imgWrapper.style.color = 'var(--text-muted)';
                                    imgWrapper.style.padding = '10px';
                                };
                            }
                        }
                        feedback.insertBefore(noteDisplay, nextBtn);
                        noteBtn.setText('📝 노트 닫기');
                    }
                });
            }
        }

        // 버튼 컨테이너를 먼저 생성
        const btnContainer = feedback.createDiv({ cls: 'feedback-buttons' });
        btnContainer.style.display = 'flex';
        btnContainer.style.gap = '10px';
        btnContainer.style.justifyContent = 'center';
        btnContainer.style.marginTop = '20px';
        btnContainer.style.flexWrap = 'wrap';

        // "다시풀기" 버튼 (항상 표시)
        const retryBtn = btnContainer.createEl('button', {
            text: '🔄 다시풀기',
            cls: 'retry-button'
        });
        retryBtn.style.padding = '12px 25px';
        retryBtn.style.fontSize = '16px';
        retryBtn.style.backgroundColor = 'white';
        retryBtn.style.color = '#ff9800';
        retryBtn.style.border = 'none';
        retryBtn.style.borderRadius = '20px';
        retryBtn.style.cursor = 'pointer';
        retryBtn.style.fontWeight = 'bold';
        
        retryBtn.addEventListener('click', () => {
            feedback.remove();
            // 같은 문제를 다시 보여줌
            this.showQuestion();
        });

        // "다음 문제" 버튼
        const nextBtn = btnContainer.createEl('button', { 
            text: '다음 문제 →',
            cls: 'next-button'
        });
        nextBtn.style.padding = '12px 25px';
        nextBtn.style.fontSize = '16px';
        nextBtn.style.backgroundColor = 'white';
        nextBtn.style.color = isCorrect ? '#4caf50' : '#f44336';
        nextBtn.style.border = 'none';
        nextBtn.style.borderRadius = '20px';
        nextBtn.style.cursor = 'pointer';
        nextBtn.style.fontWeight = 'bold';

        nextBtn.addEventListener('click', () => {
            feedback.remove();
            this.currentIndex++;
            this.showQuestion();
        });
    }

    async showResults() {
        const { contentEl } = this;
        contentEl.empty();

        const endTime = Date.now();
        const totalTime = Math.round((endTime - this.startTime) / 1000);
        const percentage = Math.round((this.score / this.questions.length) * 100);
        
        // 시간을 분과 초로 변환
        const minutes = Math.floor(totalTime / 60);
        const seconds = totalTime % 60;
        const timeDisplay = minutes > 0 
            ? `${minutes}분 ${seconds}초` 
            : `${seconds}초`;

        const results = contentEl.createDiv({ cls: 'quiz-results' });
        
        results.createEl('h1', { text: '🎉 퀴즈 완료!' });

        // 점수 표시
        const scoreCard = results.createDiv({ cls: 'score-card' });
        scoreCard.innerHTML = `
            <div class="score-big">${this.score} / ${this.questions.length}</div>
            <div class="score-percentage">${percentage}%</div>
            <div class="score-time">소요 시간: ${timeDisplay}</div>
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
            console.log('=== 다시 풀기 시작 ===');
            console.log('this.allQuestions 존재?', !!this.allQuestions);
            console.log('this.allQuestions 길이:', this.allQuestions ? this.allQuestions.length : 'NULL');
            console.log('this.allQuestions[0]:', this.allQuestions ? this.allQuestions[0] : 'NULL');
            
            this.currentIndex = 0;
            this.score = 0;
            this.results = [];
            this.startTime = Date.now();
            this.questions = this.plugin.settings.shuffleQuestions ? 
                this.shuffleArray([...this.allQuestions]) : [...this.allQuestions];
            
            console.log('this.questions 재설정 완료:', this.questions.length);
            console.log('this.questions[0]:', this.questions[0]);
            console.log('showQuestion() 호출 직전');
            
            this.showQuestion();
        });
        
        const folderBtn = buttonContainer.createEl('button', { 
            text: '📁 폴더 관리'
        });
        folderBtn.addEventListener('click', () => {
            this.showFolderSelection();
        });

        const wrongBtn = buttonContainer.createEl('button', { text: '❌ 오답만 복습' });
        wrongBtn.addEventListener('click', async () => {
            this.close();
            await this.plugin.startWrongAnswerQuiz();
        });

        const closeBtn = buttonContainer.createEl('button', { text: '🚪 나가기' });
        closeBtn.addEventListener('click', () => this.close());
    }

    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .quiz-play-modal {
                padding: 20px;
                max-width: 700px;
                width: 100%;
                margin: 0 auto;
                max-height: 90vh;
                overflow-y: auto;
                overflow-x: hidden;
                box-sizing: border-box;
            }
            .quiz-header {
                display: flex;
                flex-direction: column;
                gap: 12px;
                margin-bottom: 20px;
                padding-bottom: 15px;
                border-bottom: 2px solid var(--background-modifier-border);
                width: 100%;
                box-sizing: border-box;
            }
            
            /* 컨트롤 바 스타일 */
            .quiz-control-bar {
                display: flex;
                gap: 8px;
                justify-content: flex-end;
                margin-bottom: 10px;
                flex-wrap: wrap;
                width: 100%;
            }
            
            .control-button {
                padding: 8px 16px;
                font-size: 14px;
                border-radius: 6px;
                border: 2px solid var(--background-modifier-border);
                background: var(--background-secondary);
                color: var(--text-normal);
                cursor: pointer;
                transition: all 0.2s;
                min-height: 44px;
                touch-action: manipulation;
                -webkit-tap-highlight-color: transparent;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            
            .control-button:hover:not(:disabled) {
                border-color: var(--interactive-accent);
                background: var(--background-modifier-hover);
                transform: translateY(-2px);
            }
            
            .control-button:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            
            .control-button.prev-button {
                border-color: rgba(33, 150, 243, 0.5);
            }
            
            .control-button.pause-button {
                border-color: rgba(255, 152, 0, 0.5);
            }
            
            .control-button.settings-button {
                border-color: rgba(158, 158, 158, 0.5);
                min-width: 44px;
                padding: 8px;
            }
            
            .quiz-progress {
                display: flex;
                justify-content: space-between;
                align-items: center;
                width: 100%;
                overflow: hidden;
                flex-wrap: wrap;
                gap: 8px;
            
            /* 타이머 스타일 (두껍고 화려하게 - 25px, 그라데이션, 그림자) */
            .hanzi-timer-container {
                position: relative;
                width: 100%;
                background: linear-gradient(145deg, #1a1a1a, #2d2d2d);
                border-radius: 12px;
                overflow: hidden;
                border: 3px solid var(--interactive-accent);
                box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
                height: 25px;
                margin: 10px 0;
            }

            .hanzi-timer-progress {
                width: 100%;
                height: 100%;
                background: linear-gradient(145deg, #1a1a1a, #2d2d2d);
                position: relative;
                overflow: hidden;
            }

            .hanzi-timer-fill {
                width: 100%;
                height: 100%;
                background: linear-gradient(90deg, var(--interactive-accent) 0%, #4caf50 50%, #8bc34a 100%);
                transition: width 0.1s linear;
                box-shadow: 0 0 10px rgba(76, 175, 80, 0.5);
                position: absolute;
                top: 0;
                left: 0;
            }

            .hanzi-timer-container.timer-warning {
                border-color: #ff9800;
                animation: timer-pulse-warning 1s infinite;
            }

            .hanzi-timer-container.timer-warning .hanzi-timer-fill {
                background: linear-gradient(90deg, #f39c12, #e67e22);
                box-shadow: 0 0 15px rgba(243, 156, 18, 0.6);
            }

            .hanzi-timer-container.timer-expired {
                border-color: #f44336;
                animation: timer-pulse-danger 0.5s infinite;
            }

            .hanzi-timer-container.timer-expired .hanzi-timer-fill {
                background: linear-gradient(90deg, #e74c3c, #c0392b);
                box-shadow: 0 0 20px rgba(231, 76, 60, 0.8);
            }

            @keyframes timer-pulse-warning {
                0%, 100% { transform: scale(1); box-shadow: 0 4px 15px rgba(243, 156, 18, 0.3); }
                50% { transform: scale(1.01); box-shadow: 0 6px 20px rgba(243, 156, 18, 0.5); }
            }

            @keyframes timer-pulse-danger {
                0%, 100% { transform: scale(1); box-shadow: 0 4px 15px rgba(231, 76, 60, 0.4); }
                50% { transform: scale(1.02); box-shadow: 0 8px 25px rgba(231, 76, 60, 0.7); }
            }
            
            /* 타이머 텍스트 (초 표시) */
            .hanzi-timer-text {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                color: #ffffff;
                font-size: 14px;
                font-weight: 900;
                z-index: 10;
                text-align: center;
                text-shadow: 0 0 8px rgba(0, 0, 0, 0.8), 0 2px 4px rgba(0, 0, 0, 0.6);
                font-family: 'Arial Black', Arial, sans-serif;
                min-width: 50px;
                padding: 2px 10px;
                background: rgba(0, 0, 0, 0.3);
                border-radius: 12px;
                backdrop-filter: blur(3px);
            }
            
            .quiz-timer {
                font-size: 18px;
                font-weight: bold;
            }
            
            /* 난이도 뱃지 - 컨트롤 바에 통합 */
            .quiz-control-bar .difficulty-badge {
                display: inline-block;
                padding: 6px 12px;
                border-radius: 12px;
                font-size: 0.8em;
                font-weight: 600;
                margin: 0 4px;
            }

            .quiz-control-bar .difficulty-badge.difficulty-쉬움 {
                background: #4caf50;
                color: white;
            }

            .quiz-control-bar .difficulty-badge.difficulty-보통 {
                background: #ff9800;
                color: white;
            }

            .quiz-control-bar .difficulty-badge.difficulty-어려움 {
                background: #f44336;
                color: white;
            }
            
            /* 한자 표시 - 크게 */
            .hanzi-display {
                text-align: center;
                margin: 50px 0;
                width: 100%;
                overflow: hidden;
            }
            
            .hanzi-character {
                font-size: clamp(120px, 20vw, 180px);
                font-weight: bold;
                color: var(--text-normal);
                text-shadow: 3px 3px 6px rgba(0, 0, 0, 0.15);
                line-height: 1.2;
                word-break: break-all;
            }
            
            /* 이미지 컨테이너 스타일 - 스크롤 영역 내 포함 */
            .question-image-container {
                text-align: center;
                margin: 15px 0;
                padding: 8px;
                background: var(--background-secondary);
                border-radius: 12px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                width: 100%;
                box-sizing: border-box;
                overflow: hidden !important;
                position: relative;
                max-height: 250px;
            }
            
            .question-image-container img,
            .quiz-question-image {
                max-width: 100% !important;
                max-height: 300px !important;
                width: auto !important;
                height: auto !important;
                object-fit: contain !important;
                border-radius: 8px !important;
                display: block !important;
                margin: 0 auto !important;
                cursor: zoom-in !important;
                transition: transform 0.2s ease, box-shadow 0.2s ease !important;
            }
            
            .question-image-container img:hover,
            .quiz-question-image:hover {
                transform: scale(1.02) !important;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
            }
            
            /* 모바일 최적화 */
            @media (max-width: 768px) {
                .question-image-container img,
                .quiz-question-image {
                    max-height: 250px !important;
                }
            }
            
            @media (max-width: 480px) {
                .question-image-container img,
                .quiz-question-image {
                    max-height: 200px !important;
                }
            }
            
            /* 문제 텍스트 - 스크롤 가능하도록 수정 */
            .question-text {
                text-align: center;
                margin-bottom: 20px;
                font-size: clamp(20px, 5vw, 28px);
                padding: 15px 10px;
                width: 100%;
                box-sizing: border-box;
                word-wrap: break-word;
                overflow-wrap: break-word;
                line-height: 1.6;
                color: var(--text-normal);
                max-height: 300px;
                overflow-y: auto;
                overflow-x: hidden;
                /* 스크롤바 스타일 */
                scrollbar-width: thin;
                scrollbar-color: var(--interactive-accent) var(--background-modifier-border);
            }
            
            .question-text::-webkit-scrollbar {
                width: 8px;
            }
            
            .question-text::-webkit-scrollbar-track {
                background: var(--background-modifier-border);
                border-radius: 4px;
            }
            
            .question-text::-webkit-scrollbar-thumb {
                background: var(--interactive-accent);
                border-radius: 4px;
            }
            
            .question-text::-webkit-scrollbar-thumb:hover {
                background: var(--interactive-accent-hover);
            }
            
            .question-text h3 {
                margin-bottom: 10px;
                font-size: 1.3em;
            }
            
            .options-container {
                display: flex;
                flex-direction: column;
                gap: 10px;
                margin-bottom: 20px;
                width: 100%;
            }
            .option-button {
                padding: 15px 20px;
                font-size: 16px;
                text-align: left;
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.2s;
                background: var(--background-secondary);
                min-height: 48px;
                touch-action: manipulation;
                -webkit-tap-highlight-color: transparent;
                width: 100%;
                box-sizing: border-box;
                white-space: normal;
                word-wrap: break-word;
                overflow-wrap: break-word;
                line-height: 1.5;
                display: flex;
                flex-direction: column;
                align-items: flex-start;
            }
                word-wrap: break-word;
                overflow-wrap: break-word;
                white-space: normal;
                display: flex;
                flex-direction: column;
                align-items: flex-start;
            }
            
            .option-image-container {
                width: 100%;
                display: flex;
                justify-content: center;
                align-items: center;
                margin-top: 8px;
                max-height: 100px;
                overflow: hidden;
            }
            
            .option-image-container img {
                max-width: 100%;
                max-height: 100px;
                object-fit: contain;
                border-radius: 4px;
            }
            
            .option-text {
                width: 100%;
                text-align: left;
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
                flex-wrap: wrap;
                width: 100%;
            }
            .action-bar button {
                min-height: 48px;
                padding: 12px 20px;
                font-size: 16px;
                touch-action: manipulation;
                -webkit-tap-highlight-color: transparent;
                border-radius: 8px;
                border: 2px solid var(--background-modifier-border);
                background: var(--background-secondary);
                cursor: pointer;
                transition: all 0.2s;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                flex: 1 1 auto;
                min-width: fit-content;
            }
            
            .action-bar button:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 8px rgba(0,0,0,0.15);
            }
            
            .bookmark-button {
                border-color: rgba(255, 193, 7, 0.5) !important;
            }
            
            .bookmark-button:hover {
                border-color: #ffc107 !important;
                background: rgba(255, 193, 7, 0.1) !important;
            }
            
            .edit-button {
                border-color: rgba(33, 150, 243, 0.5) !important;
            }
            
            .edit-button:hover {
                border-color: #2196f3 !important;
                background: rgba(33, 150, 243, 0.1) !important;
            }
            
            .hint-button {
                border-color: rgba(255, 152, 0, 0.5) !important;
            }
            
            .hint-button:hover {
                border-color: #ff9800 !important;
                background: rgba(255, 152, 0, 0.1) !important;
            }
                font-size: 16px;
                touch-action: manipulation;
                -webkit-tap-highlight-color: transparent;
            }
            .quiz-results {
                text-align: center;
                width: 100%;
                box-sizing: border-box;
            }
            .score-card {
                padding: 40px;
                background: var(--background-secondary);
                border-radius: 15px;
                margin: 30px 0;
                width: 100%;
                box-sizing: border-box;
            }
            .score-big {
                font-size: 60px;
                font-weight: bold;
                color: var(--interactive-accent);
                word-break: break-all;
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
                width: 100%;
                overflow: hidden;
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
                width: 100%;
                box-sizing: border-box;
                overflow: hidden;
            }
            .result-number {
                font-weight: bold;
                color: var(--text-muted);
                flex-shrink: 0;
            }
            .result-hanzi {
                font-size: 24px;
                font-weight: bold;
                flex-shrink: 0;
                word-break: break-all;
            }
            .results-buttons {
                display: flex;
                gap: 10px;
                justify-content: center;
                margin-top: 30px;
                flex-wrap: wrap;
                width: 100%;
            }
            .results-buttons button {
                min-height: 48px;
                padding: 14px 24px;
                font-size: 16px;
                touch-action: manipulation;
                -webkit-tap-highlight-color: transparent;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            
            /* 모바일 반응형 최적화 */
            @media (max-width: 768px) {
                .quiz-play-modal {
                    padding: 16px;
                    max-width: 100vw;
                    width: 100%;
                }
                
                .quiz-header {
                    gap: 8px;
                    margin-bottom: 12px;
                    padding-bottom: 10px;
                }
                
                /* 문제 텍스트 - 큰 크기 */
                .question-text {
                    max-height: 200px;
                    margin-bottom: 15px;
                    font-size: 20px !important;
                    line-height: 1.7 !important;
                    padding: 16px !important;
                }
                
                /* 한자 표시 - 크게 유지 */
                .hanzi-character {
                    font-size: clamp(120px, 20vw, 180px) !important;
                }
                
                /* 선택지 - 큰 크기 */
                .option-button {
                    min-height: 70px !important;
                    padding: 20px 24px !important;
                    font-size: 19px !important;
                    line-height: 1.7 !important;
                    font-weight: 500 !important;
                }
                
                .options-container {
                    gap: 14px;
                    margin-bottom: 16px;
                }
                
                /* 버튼 - 작은 크기 */
                .control-button,
                .results-buttons button,
                .quiz-play-modal button {
                    padding: 8px 14px !important;
                    font-size: 13px !important;
                    min-height: 38px !important;
                    max-height: 38px !important;
                    flex-shrink: 0;
                    white-space: nowrap;
                }
                
                /* 상단 컨트롤 한 줄로 */
                .quiz-control-bar {
                    display: flex !important;
                    flex-wrap: nowrap !important;
                    gap: 4px !important;
                    overflow-x: auto;
                    -webkit-overflow-scrolling: touch;
                    scrollbar-width: none;
                    -ms-overflow-style: none;
                    padding-bottom: 2px;
                }
                
                .quiz-control-bar::-webkit-scrollbar {
                    display: none;
                }
                
                .hanzi-timer-container {
                    height: 48px;
                }
                
                .hanzi-timer-text {
                    font-size: 16px;
                    padding: 4px 12px;
                }
                
                .hanzi-display {
                    margin: 20px 0;
                }
                
                .question-image-container {
                    margin: 12px 0;
                    padding: 6px;
                    overflow: hidden !important;
                    max-height: 200px;
                }
                
                .question-image-container img,
                .quiz-question-image {
                    max-height: 180px !important;
                    max-width: 100% !important;
                    width: auto !important;
                    height: auto !important;
                }
                
                .option-image-container {
                    max-height: 80px;
                }
                
                .option-image-container img {
                    max-height: 80px !important;
                }
                
                /* 모바일: 하단 액션 바도 한 줄로 - 간격 개선 */
                .action-bar {
                    display: flex !important;
                    flex-direction: row !important;
                    flex-wrap: nowrap !important;
                    gap: 10px !important;
                    overflow-x: auto;
                    -webkit-overflow-scrolling: touch;
                    scrollbar-width: none;
                    -ms-overflow-style: none;
                    padding: 8px 4px;
                    justify-content: center;
                }
                
                .action-bar::-webkit-scrollbar {
                    display: none;
                }
                
                .action-bar button {
                    padding: 12px 16px !important;
                    font-size: 14px !important;
                    min-height: 44px !important;
                    flex-shrink: 0;
                    white-space: nowrap;
                    min-width: 90px;
                }
                
                .score-card {
                    padding: 30px 20px;
                    margin: 20px 0;
                }
                
                .score-big {
                    font-size: clamp(40px, 12vw, 60px);
                }
                
                .score-percentage {
                    font-size: clamp(28px, 8vw, 40px);
                }
                
                .result-item {
                    padding: 12px;
                    gap: 12px;
                }
                
                .result-hanzi {
                    font-size: 20px;
                }
            }
            
            @media (max-width: 480px) {
                .quiz-play-modal {
                    padding: 12px;
                    max-width: 100vw;
                }
                
                /* 작은 화면에서도 한 줄 유지 */
                .quiz-control-bar {
                    gap: 3px !important;
                    flex-wrap: nowrap !important;
                }
                
                .control-button {
                    padding: 7px 8px !important;
                    font-size: 13px !important;
                    min-height: 40px !important;
                    flex-shrink: 0;
                }
                
                /* 작은 모바일: 문제 텍스트 더 작게 */
                .question-text {
                    max-height: 150px;
                    margin-bottom: 12px;
                    font-size: clamp(16px, 4vw, 20px);
                    padding: 10px 6px;
                }
                
                .question-image-container {
                    margin: 10px 0;
                    padding: 5px;
                    overflow: hidden !important;
                    max-height: 150px;
                }
                
                .question-image-container img,
                .quiz-question-image {
                    max-height: 135px !important;
                    max-width: 100% !important;
                    width: auto !important;
                    height: auto !important;
                }
                
                /* 작은 화면에서도 액션바 한 줄 유지 - 간격 개선 */
                .action-bar {
                    flex-direction: row !important;
                    flex-wrap: nowrap !important;
                    gap: 8px !important;
                    overflow-x: auto;
                    padding: 8px 2px;
                    justify-content: center;
                }
                
                .action-bar button {
                    padding: 10px 14px !important;
                    font-size: 13px !important;
                    min-height: 42px !important;
                    flex-shrink: 0;
                    white-space: nowrap;
                    flex: none !important;
                    width: auto !important;
                    min-width: 80px;
                }
                
                .results-buttons {
                    flex-direction: column;
                    gap: 8px;
                }
                
                .results-buttons button {
                    width: 100%;
                }
                
                .quiz-progress {
                    flex-direction: column;
                    gap: 8px;
                    align-items: flex-start;
                }
                
                .difficulty-badge {
                    padding: 4px 12px;
                    font-size: 13px;
                }
                
                .option-image-container {
                    max-height: 60px;
                }
                
                .option-image-container img {
                    max-height: 60px !important;
                }
            }
            
            /* 터치 디바이스 최적화 */
            @media (hover: none) and (pointer: coarse) {
                .option-button,
                .action-bar button,
                .results-buttons button {
                    min-height: 44px;
                }
                
                .option-button:active {
                    transform: scale(0.98);
                    background: var(--background-modifier-hover);
                }
            }
        `;
        document.head.appendChild(style);
    }

    onClose() {
        // ESC로 닫히려고 할 때 확인 모달 대신 바로 닫기 허용
        // confirmExit는 버튼이나 명시적 ESC에서만 호출됨
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

        // 폴더 관리 버튼
        containerEl.createEl('h3', { text: '📂 폴더 관리' });

        new Setting(containerEl)
            .setName('필수 폴더 생성')
            .setDesc('위에 설정된 경로에 폴더를 자동으로 생성합니다')
            .addButton(button => button
                .setButtonText('📁 폴더 생성')
                .setCta()
                .onClick(async () => {
                    await this.plugin.ensureFolders();
                    new Notice('✅ 필수 폴더가 생성되었습니다!');
                }));

        new Setting(containerEl)
            .setName('문제 파일 확인')
            .setDesc('현재 인식된 문제 파일 개수를 확인합니다')
            .addButton(button => button
                .setButtonText('🔍 문제 확인')
                .onClick(async () => {
                    const questions = await this.plugin.loadAllQuestions();
                    new Notice(`📝 인식된 문제: ${questions.length}개`);
                    console.log('=== 문제 파일 확인 ===');
                    console.log('총 문제 수:', questions.length);
                    if (questions.length > 0) {
                        console.log('첫 3개 문제:', questions.slice(0, 3).map(q => ({
                            한자: q.hanzi,
                            폴더: q.folder,
                            파일경로: q.filePath
                        })));
                    }
                }));

        new Setting(containerEl)
            .setName('경로 진단')
            .setDesc('문제 폴더 경로와 파일 인식 상태를 확인합니다')
            .addButton(button => button
                .setButtonText('🔧 진단 실행')
                .onClick(async () => {
                    console.log('=== 한자 퀴즈 경로 진단 ===');
                    
                    const allFiles = this.app.vault.getMarkdownFiles();
                    console.log('전체 마크다운 파일:', allFiles.length);
                    
                    const questionsFolder = this.plugin.settings.questionsFolder;
                    console.log('설정된 문제 폴더:', questionsFolder);
                    
                    // 경로 정규화
                    const normalizePath = (path) => {
                        if (!path) return '';
                        return path.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\/+/, '');
                    };
                    
                    const normalizedFolder = normalizePath(questionsFolder);
                    console.log('정규화된 폴더:', normalizedFolder);
                    
                    // HanziQuiz 관련 파일 찾기
                    const hanziquizFiles = allFiles.filter(f => {
                        const np = normalizePath(f.path);
                        return np.includes('HanziQuiz') || np.includes('hanziquiz');
                    });
                    
                    console.log('HanziQuiz 관련 파일:', hanziquizFiles.length);
                    if (hanziquizFiles.length > 0) {
                        console.log('샘플 경로:');
                        hanziquizFiles.slice(0, 5).forEach(f => {
                            console.log(' -', f.path);
                        });
                    }
                    
                    // Questions 폴더 파일
                    const questionsFiles = allFiles.filter(f => {
                        const np = normalizePath(f.path);
                        return np.includes(normalizedFolder) && !f.path.includes('문제목록');
                    });
                    
                    console.log('Questions 폴더 문제 파일:', questionsFiles.length);
                    
                    new Notice(`📊 진단 완료: HanziQuiz 파일 ${hanziquizFiles.length}개, 문제 파일 ${questionsFiles.length}개`);
                    new Notice('💡 자세한 내용은 개발자 콘솔(Ctrl+Shift+I)을 확인하세요');
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

// 퀴즈 문제 설정 모달 (난이도, 북마크, 메모 등)
class QuizQuestionSettingsModal extends Modal {
    constructor(app, plugin, question, onUpdate) {
        super(app);
        this.plugin = plugin;
        this.question = question;
        this.onUpdate = onUpdate;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('quiz-question-settings-modal');

        contentEl.createEl('h2', { text: '⚙️ 문제 설정' });

        const form = contentEl.createDiv({ cls: 'settings-form' });

        // 문제 정보 표시
        const infoSection = form.createDiv({ cls: 'info-section' });
        infoSection.createEl('h3', { text: '📊 문제 정보' });
        
        const infoGrid = infoSection.createDiv({ cls: 'info-grid' });
        infoGrid.innerHTML = `
            <div class="info-item">
                <span class="info-label">키워드:</span>
                <span class="info-value">${this.question.hanzi || '-'}</span>
            </div>
            <div class="info-item">
                <span class="info-label">번호:</span>
                <span class="info-value">${this.question.number || '-'}</span>
            </div>
            <div class="info-item">
                <span class="info-label">폴더:</span>
                <span class="info-value">${this.question.folder || '기본'}</span>
            </div>
            <div class="info-item">
                <span class="info-label">정답:</span>
                <span class="info-value">${this.question.correctCount || 0}회</span>
            </div>
            <div class="info-item">
                <span class="info-label">오답:</span>
                <span class="info-value">${this.question.wrongCount || 0}회</span>
            </div>
        `;

        // 난이도 설정
        const diffSection = form.createDiv({ cls: 'difficulty-section' });
        diffSection.createEl('h3', { text: '🎯 난이도 설정' });
        
        const difficultyGrid = diffSection.createDiv({ cls: 'difficulty-grid' });
        const difficulties = [
            { value: 'A+', label: '🏆 A+', desc: '매우 쉬움' },
            { value: 'A', label: '⭐ A', desc: '쉬움' },
            { value: 'A-', label: '⭐ A-', desc: '약간 쉬움' },
            { value: 'B', label: '😊 B', desc: '보통보다 쉬움' },
            { value: 'B-', label: '😊 B-', desc: '보통' },
            { value: 'C', label: '😐 C', desc: '중간' },
            { value: 'D', label: '😰 D', desc: '약간 어려움' },
            { value: 'E', label: '😱 E', desc: '어려움' },
            { value: 'F', label: '💀 F', desc: '매우 어려움' }
        ];

        difficulties.forEach(diff => {
            const diffBtn = difficultyGrid.createEl('button', {
                cls: 'difficulty-option-btn',
                text: diff.label
            });
            diffBtn.createEl('div', { cls: 'diff-desc', text: diff.desc });
            
            if (this.question.difficulty === diff.value) {
                diffBtn.addClass('selected');
            }
            
            diffBtn.onclick = async () => {
                // 모든 버튼에서 selected 제거
                difficultyGrid.querySelectorAll('.difficulty-option-btn').forEach(btn => {
                    btn.removeClass('selected');
                });
                
                // 현재 버튼에 selected 추가
                diffBtn.addClass('selected');
                
                // 난이도 업데이트
                this.question.difficulty = diff.value;
                await this.plugin.updateQuestionDifficulty(this.question, diff.value);
                
                new Notice(`✅ 난이도 변경: ${diff.label}`);
            };
        });

        // 북마크 토글
        const bookmarkSection = form.createDiv({ cls: 'bookmark-section' });
        bookmarkSection.createEl('h3', { text: '⭐ 북마크' });
        
        const bookmarkToggle = bookmarkSection.createEl('button', {
            cls: 'bookmark-toggle-btn',
            text: this.question.bookmarked ? '⭐ 북마크됨' : '☆ 북마크 추가'
        });
        bookmarkToggle.classList.add(this.question.bookmarked ? 'bookmarked' : 'not-bookmarked');
        
        bookmarkToggle.onclick = async () => {
            this.question.bookmarked = !this.question.bookmarked;
            await this.plugin.toggleBookmark(this.question);
            
            bookmarkToggle.setText(this.question.bookmarked ? '⭐ 북마크됨' : '☆ 북마크 추가');
            bookmarkToggle.removeClass('bookmarked', 'not-bookmarked');
            bookmarkToggle.addClass(this.question.bookmarked ? 'bookmarked' : 'not-bookmarked');
            
            new Notice(this.question.bookmarked ? '⭐ 북마크에 추가됨' : '☆ 북마크에서 제거됨');
        };

        // 힌트 보기
        if (this.question.hint && this.question.hint.trim()) {
            const hintSection = form.createDiv({ cls: 'hint-section' });
            hintSection.createEl('h3', { text: '💡 힌트' });
            hintSection.createEl('p', { text: this.question.hint, cls: 'hint-text' });
        }

        // 노트 보기
        if (this.question.note && this.question.note.trim()) {
            const noteSection = form.createDiv({ cls: 'note-section' });
            noteSection.createEl('h3', { text: '📝 노트' });
            noteSection.createEl('p', { text: this.question.note, cls: 'note-text' });
        }

        // 문제 수정 버튼
        const actionSection = form.createDiv({ cls: 'action-section' });
        
        const editBtn = actionSection.createEl('button', {
            text: '✏️ 문제 수정',
            cls: 'action-btn edit-btn'
        });
        editBtn.onclick = () => {
            this.close();
            new HanziQuestionModal(this.app, this.plugin, this.question).open();
        };

        // 통계 초기화 버튼
        const resetStatsBtn = actionSection.createEl('button', {
            text: '🔄 통계 초기화',
            cls: 'action-btn reset-btn'
        });
        resetStatsBtn.onclick = async () => {
            if (confirm('이 문제의 정답/오답 통계를 초기화하시겠습니까?')) {
                this.question.correctCount = 0;
                this.question.wrongCount = 0;
                await this.plugin.saveQuestion(this.question, false);
                
                // 정보 업데이트
                infoGrid.querySelector('.info-item:nth-child(4) .info-value').setText('0회');
                infoGrid.querySelector('.info-item:nth-child(5) .info-value').setText('0회');
                
                new Notice('📊 통계가 초기화되었습니다.');
            }
        };

        // 닫기 버튼
        const closeBtn = contentEl.createEl('button', {
            text: '✅ 완료',
            cls: 'modal-close-btn'
        });
        closeBtn.onclick = () => {
            if (this.onUpdate) {
                this.onUpdate(this.question);
            }
            this.close();
        };
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
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

// 주관식 Q&A 모달
class SubjectiveQAModal extends Modal {
    constructor(app, plugin) {
        super(app);
        this.plugin = plugin;
        
        // 모달에서 키보드 이벤트 허용
        this.scope.register([], 'Escape', () => {
            this.close();
            return false;
        });
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('subjective-qa-modal');
        
        // 모달 컨테이너에 키보드 이벤트 전파 허용
        contentEl.addEventListener('keydown', (e) => {
            // Ctrl+V, Ctrl+C, Ctrl+X, Ctrl+A 등 기본 편집 키 허용
            if (e.ctrlKey || e.metaKey) {
                e.stopPropagation(); // 상위로 전파 차단하여 모달 내에서만 처리
            }
        }, true); // capture phase에서 처리

        // 헤더
        const header = contentEl.createDiv('modal-header');
        header.innerHTML = `
            <h2>📝 주관식 문제 만들기</h2>
            <p>문제를 읽고 답을 확인하는 학습 카드를 생성합니다</p>
        `;

        // 폼 컨테이너
        const formContainer = contentEl.createDiv('qa-form-container');

        // 문제 입력
        const questionGroup = formContainer.createDiv('form-group');
        const questionLabel = questionGroup.createDiv('label-with-button');
        questionLabel.createEl('label', { text: '📋 문제 *' });
        
        // 클립보드 붙여넣기 버튼
        const pasteBtn = questionLabel.createEl('button', {
            text: '📋 클립보드에서 붙여넣기',
            cls: 'paste-btn'
        });
        
        const questionInput = questionGroup.createEl('textarea', {
            attr: {
                placeholder: '예: 일본어로 "안녕하세요"는?\n\n💡 팁: Ctrl+V로 PDF나 다른 곳에서 복사한 텍스트를 바로 붙여넣을 수 있습니다!',
                rows: 6,
                spellcheck: 'false',
                autocomplete: 'off',
                autocorrect: 'off',
                autocapitalize: 'off'
            }
        });
        questionInput.addClass('qa-input', 'qa-textarea');
        
        // 키보드 이벤트가 모달에 차단되지 않도록 설정
        questionInput.addEventListener('keydown', (e) => {
            // Ctrl+V, Ctrl+C, Ctrl+X, Ctrl+A 허용
            if ((e.ctrlKey || e.metaKey) && ['v', 'c', 'x', 'a', 'z'].includes(e.key.toLowerCase())) {
                e.stopPropagation(); // 모달의 키 핸들러 차단
                console.log('키보드 단축키 허용:', e.key);
                return; // 기본 동작 허용
            }
        }, true);
        
        // 붙여넣기 이벤트 명시적 허용
        questionInput.addEventListener('paste', (e) => {
            e.stopPropagation(); // 모달 차단 방지
            console.log('붙여넣기 이벤트 감지');
            
            // 클립보드 데이터 가져오기
            const clipboardData = e.clipboardData || window.clipboardData;
            if (clipboardData) {
                const pastedText = clipboardData.getData('text');
                console.log('붙여넣은 텍스트:', pastedText);
                new Notice('✅ 텍스트 붙여넣기 완료!', 1500);
            }
        }, true);
        
        // 모달 열리자마자 포커스
        setTimeout(() => {
            questionInput.focus();
            console.log('문제 입력란 포커스됨');
        }, 150);

        // 클립보드 붙여넣기 버튼 이벤트
        pasteBtn.addEventListener('click', async () => {
            try {
                const text = await navigator.clipboard.readText();
                if (text) {
                    questionInput.value = text;
                    questionInput.focus();
                    // 커서를 텍스트 끝으로 이동
                    questionInput.selectionStart = questionInput.value.length;
                    questionInput.selectionEnd = questionInput.value.length;
                    new Notice('✅ 클립보드 내용이 붙여넣어졌습니다!');
                } else {
                    new Notice('⚠️ 클립보드가 비어있습니다.');
                }
            } catch (err) {
                console.error('클립보드 읽기 오류:', err);
                new Notice('❌ 클립보드 읽기 실패. Ctrl+V를 직접 사용해주세요.');
            }
        });

        // 답 입력
        const answerGroup = formContainer.createDiv('form-group');
        answerGroup.createEl('label', { text: '✅ 답 *' });
        const answerInput = answerGroup.createEl('textarea', {
            attr: {
                placeholder: '예: こんにちは',
                rows: 3,
                spellcheck: 'false'
            }
        });
        answerInput.addClass('qa-input', 'qa-textarea');
        
        // 답 입력란에도 키보드 이벤트 허용
        answerInput.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && ['v', 'c', 'x', 'a', 'z'].includes(e.key.toLowerCase())) {
                e.stopPropagation();
            }
        }, true);
        
        answerInput.addEventListener('paste', (e) => {
            e.stopPropagation();
        }, true);

        // 해설 입력
        const explanationGroup = formContainer.createDiv('form-group');
        explanationGroup.createEl('label', { text: '💡 해설 (선택)' });
        const explanationInput = explanationGroup.createEl('textarea', {
            attr: {
                placeholder: '문제에 대한 추가 설명을 입력하세요',
                rows: 3,
                spellcheck: 'false'
            }
        });
        explanationInput.addClass('qa-input', 'qa-textarea');
        
        // 해설 입력란에도 키보드 이벤트 허용
        explanationInput.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && ['v', 'c', 'x', 'a', 'z'].includes(e.key.toLowerCase())) {
                e.stopPropagation();
            }
        }, true);
        
        explanationInput.addEventListener('paste', (e) => {
            e.stopPropagation();
        }, true);

        // 2열 레이아웃
        const rowContainer = formContainer.createDiv('form-row');

        // 과목 입력
        const subjectGroup = rowContainer.createDiv('form-group');
        subjectGroup.createEl('label', { text: '📚 과목' });
        const subjectInput = subjectGroup.createEl('input', {
            attr: {
                type: 'text',
                placeholder: '예: 일본어',
                value: '일본어'
            }
        });
        subjectInput.addClass('qa-input');

        // 난이도 선택
        const levelGroup = rowContainer.createDiv('form-group');
        levelGroup.createEl('label', { text: '⭐ 난이도' });
        const levelSelect = levelGroup.createEl('select');
        levelSelect.addClass('qa-input');
        ['1 - 쉬움', '2', '3 - 보통', '4', '5 - 어려움'].forEach((level, idx) => {
            const option = levelSelect.createEl('option', {
                text: '⭐'.repeat(idx + 1) + ' ' + level,
                value: (idx + 1).toString()
            });
            if (idx === 2) option.selected = true;
        });

        // 2열 레이아웃
        const row2Container = formContainer.createDiv('form-row');

        // 키워드 입력
        const keywordsGroup = row2Container.createDiv('form-group');
        keywordsGroup.createEl('label', { text: '🔑 키워드' });
        const keywordsInput = keywordsGroup.createEl('input', {
            attr: {
                type: 'text',
                placeholder: '쉼표로 구분 (예: 인사, 기본표현)'
            }
        });
        keywordsInput.addClass('qa-input');

        // 타이머 입력
        const timerGroup = row2Container.createDiv('form-group');
        timerGroup.createEl('label', { text: '⏱️ 타이머 (초)' });
        const timerInput = timerGroup.createEl('input', {
            attr: {
                type: 'number',
                min: 5,
                max: 300,
                value: 30,
                placeholder: '제한 시간'
            }
        });
        timerInput.addClass('qa-input');

        // 버튼 영역
        const buttonArea = contentEl.createDiv('button-area');

        // 미리보기 버튼
        const previewBtn = buttonArea.createEl('button', {
            text: '👁️ 미리보기',
            cls: 'mod-cta qa-btn-secondary'
        });

        // 생성 버튼
        const createBtn = buttonArea.createEl('button', {
            text: '✨ 카드 생성',
            cls: 'mod-cta'
        });

        // 미리보기 영역
        const previewArea = contentEl.createDiv('preview-area');
        previewArea.style.display = 'none';

        // 미리보기 버튼 이벤트
        previewBtn.addEventListener('click', () => {
            const question = questionInput.value.trim();
            const answer = answerInput.value.trim();

            if (!question || !answer) {
                new Notice('⚠️ 문제와 답은 필수 항목입니다!');
                return;
            }

            const explanation = explanationInput.value.trim();
            const subject = subjectInput.value.trim() || '미분류';
            const level = levelSelect.value;
            const keywords = keywordsInput.value.trim();
            const timer = timerInput.value;

            let codeBlock = '```qa\n';
            codeBlock += `문제: ${question}\n`;
            codeBlock += `답: ${answer}\n`;
            if (explanation) codeBlock += `해설: ${explanation}\n`;
            codeBlock += `과목: ${subject}\n`;
            codeBlock += `난이도: ${level}\n`;
            if (keywords) codeBlock += `키워드: ${keywords}\n`;
            if (timer) codeBlock += `타이머: ${timer}\n`;
            codeBlock += '```';

            previewArea.empty();
            previewArea.createEl('h3', { text: '📺 미리보기' });
            const pre = previewArea.createEl('pre');
            pre.style.cssText = `
                background: #1e1e1e;
                color: #d4d4d4;
                padding: 20px;
                border-radius: 8px;
                overflow-x: auto;
                font-family: 'Consolas', 'Monaco', monospace;
                font-size: 14px;
                line-height: 1.6;
            `;
            pre.textContent = codeBlock;
            previewArea.style.display = 'block';

            // 스크롤
            previewArea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            new Notice('✅ 미리보기가 생성되었습니다!');
        });

        // 생성 버튼 이벤트
        createBtn.addEventListener('click', async () => {
            const question = questionInput.value.trim();
            const answer = answerInput.value.trim();

            if (!question || !answer) {
                new Notice('⚠️ 문제와 답은 필수 항목입니다!');
                return;
            }

            const explanation = explanationInput.value.trim();
            const subject = subjectInput.value.trim() || '미분류';
            const level = levelSelect.value;
            const keywords = keywordsInput.value.trim();
            const timer = timerInput.value;

            let codeBlock = '```qa\n';
            codeBlock += `문제: ${question}\n`;
            codeBlock += `답: ${answer}\n`;
            if (explanation) codeBlock += `해설: ${explanation}\n`;
            codeBlock += `과목: ${subject}\n`;
            codeBlock += `난이도: ${level}\n`;
            if (keywords) codeBlock += `키워드: ${keywords}\n`;
            if (timer) codeBlock += `타이머: ${timer}\n`;
            codeBlock += '```\n\n';

            // 현재 활성 파일에 삽입
            const activeFile = this.app.workspace.getActiveFile();
            if (activeFile) {
                const content = await this.app.vault.read(activeFile);
                const newContent = content + '\n' + codeBlock;
                await this.app.vault.modify(activeFile, newContent);
                new Notice('✅ 주관식 Q&A 카드가 생성되었습니다!');
            } else {
                // 파일이 없으면 클립보드에 복사
                navigator.clipboard.writeText(codeBlock);
                new Notice('📋 코드 블록이 클립보드에 복사되었습니다!');
            }

            this.close();
        });

        // 스타일 추가
        this.addModalStyles();
    }

    addModalStyles() {
        if (document.getElementById('subjective-qa-modal-styles')) return;

        const style = document.createElement('style');
        style.id = 'subjective-qa-modal-styles';
        style.textContent = `
            .subjective-qa-modal {
                padding: 0;
            }

            .subjective-qa-modal .modal-content {
                padding: 0;
            }

            .subjective-qa-modal .modal-header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 32px;
                text-align: center;
                border-radius: 8px 8px 0 0;
            }

            .subjective-qa-modal .modal-header h2 {
                margin: 0 0 12px 0;
                font-size: 28px;
                font-weight: 700;
            }

            .subjective-qa-modal .modal-header p {
                margin: 0;
                opacity: 0.95;
                font-size: 15px;
            }

            .subjective-qa-modal .qa-form-container {
                padding: 32px;
                background: var(--background-primary);
            }

            .subjective-qa-modal .form-group {
                margin-bottom: 24px;
                flex: 1;
            }

            .subjective-qa-modal .label-with-button {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 8px;
            }

            .subjective-qa-modal .form-group label {
                display: block;
                font-weight: 600;
                margin-bottom: 0;
                color: var(--text-normal);
                font-size: 15px;
            }

            .subjective-qa-modal .paste-btn {
                padding: 6px 14px;
                font-size: 13px;
                font-weight: 600;
                background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
                color: white;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                transition: all 0.2s ease;
                box-shadow: 0 2px 8px rgba(17, 153, 142, 0.3);
            }

            .subjective-qa-modal .paste-btn:hover {
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(17, 153, 142, 0.4);
            }

            .subjective-qa-modal .paste-btn:active {
                transform: translateY(0);
            }

            .subjective-qa-modal .qa-input {
                width: 100%;
                padding: 12px 16px;
                border: 2px solid var(--background-modifier-border);
                border-radius: 8px;
                background: var(--background-primary);
                color: var(--text-normal);
                font-size: 14px;
                font-family: inherit;
                transition: all 0.2s ease;
                user-select: text;
                -webkit-user-select: text;
                -moz-user-select: text;
                -ms-user-select: text;
            }

            .subjective-qa-modal .qa-textarea {
                resize: vertical;
                min-height: 120px;
                line-height: 1.6;
                font-family: inherit;
                white-space: pre-wrap;
                word-wrap: break-word;
                overflow-wrap: break-word;
            }

            .subjective-qa-modal .qa-input:focus {
                outline: none;
                border-color: #667eea;
                box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
                background: var(--background-primary-alt);
            }

            /* textarea 포커스 강조 */
            .subjective-qa-modal .qa-textarea:focus {
                border-color: #11998e;
                box-shadow: 0 0 0 3px rgba(17, 153, 142, 0.15);
            }

            .subjective-qa-modal .form-row {
                display: flex;
                gap: 20px;
                margin-bottom: 24px;
            }

            .subjective-qa-modal .button-area {
                display: flex;
                gap: 12px;
                justify-content: flex-end;
                padding: 24px 32px;
                background: var(--background-secondary);
                border-top: 1px solid var(--background-modifier-border);
            }

            .subjective-qa-modal .button-area button {
                padding: 12px 24px;
                font-size: 15px;
                font-weight: 600;
                cursor: pointer;
                border-radius: 8px;
                transition: all 0.2s ease;
            }

            .subjective-qa-modal .qa-btn-secondary {
                background: var(--interactive-normal);
                color: var(--text-normal);
            }

            .subjective-qa-modal .qa-btn-secondary:hover {
                background: var(--interactive-hover);
            }

            .subjective-qa-modal .preview-area {
                padding: 24px 32px;
                background: var(--background-secondary);
                border-top: 1px solid var(--background-modifier-border);
            }

            .subjective-qa-modal .preview-area h3 {
                margin: 0 0 16px 0;
                color: var(--text-normal);
                font-size: 18px;
            }

            @media (max-width: 768px) {
                .subjective-qa-modal .modal-header {
                    padding: 24px 20px;
                }

                .subjective-qa-modal .modal-header h2 {
                    font-size: 24px;
                }

                .subjective-qa-modal .qa-form-container {
                    padding: 24px 20px;
                }

                .subjective-qa-modal .label-with-button {
                    flex-direction: column;
                    align-items: flex-start;
                    gap: 8px;
                }

                /* 입력 필드 - 최대 크기 */
                .subjective-qa-modal .qa-input,
                .subjective-qa-modal .qa-textarea,
                .subjective-qa-modal input[type="text"],
                .subjective-qa-modal textarea {
                    font-size: 18px !important;
                    padding: 16px !important;
                    min-height: 54px !important;
                    line-height: 1.6 !important;
                }
                
                .subjective-qa-modal .qa-textarea,
                .subjective-qa-modal textarea {
                    min-height: 150px !important;
                }

                /* 버튼 - 작은 크기 */
                .subjective-qa-modal .paste-btn,
                .subjective-qa-modal .button-area button,
                .subjective-qa-modal button {
                    padding: 8px 14px !important;
                    font-size: 13px !important;
                    min-height: 38px !important;
                    max-height: 38px !important;
                }

                .subjective-qa-modal .form-row {
                    flex-direction: column;
                    gap: 0;
                }

                .subjective-qa-modal .button-area {
                    flex-direction: column;
                    padding: 20px;
                }

                .subjective-qa-modal .button-area button {
                    width: 100%;
                }
            }
        `;
        document.head.appendChild(style);
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// Obsidian 플러그인 메인 export
module.exports = HanziQuizPlugin;