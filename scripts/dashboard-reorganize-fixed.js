// 대시보드 재구성 코드 (main.js 2222줄부터 적용)
// 기존 코드를 아래 코드로 완전히 교체하세요

        // 빠른 작업
        const actionsSection = contentEl.createDiv({ cls: 'actions-section' });
        actionsSection.createEl('h2', { text: '🚀 빠른 작업' });

        // 난이도별 문제 개수 계산
        const difficultyCount = {};
        ['A+', 'A', 'A-', 'B', 'B-', 'C', 'D', 'E', 'F'].forEach(diff => {
            difficultyCount[diff] = questions.filter(q => q.difficulty === diff).length;
        });

        // 섹션 1: 퀴즈 시작
        const quizStartSection = actionsSection.createDiv({ cls: 'quiz-start-section' });
        quizStartSection.createEl('h3', { text: '🎯 퀴즈 시작', cls: 'section-title' });
        const quizStartGrid = quizStartSection.createDiv({ cls: 'quiz-start-grid' });

        const quizStartButtons = [
            { icon: '🎯', text: '전체 퀴즈', count: questions.length, callback: () => { this.close(); this.plugin.startQuiz(); } },
            { icon: '⭐', text: '북마크 퀴즈', count: stats.bookmarkedCount || 0, callback: () => { this.close(); this.plugin.startBookmarkQuiz(); } },
            { icon: '❌', text: '오답 복습', count: stats.wrongCount || 0, callback: () => { this.close(); this.plugin.startWrongAnswerQuiz(); } }
        ];

        quizStartButtons.forEach(action => {
            const btn = quizStartGrid.createEl('button', { 
                text: `${action.icon} ${action.text} (${action.count})`,
                cls: 'quiz-start-button'
            });
            btn.addEventListener('click', action.callback);
        });

        // 섹션 2: 난이도별 퀴즈
        const difficultySection = actionsSection.createDiv({ cls: 'difficulty-section' });
        difficultySection.createEl('h3', { text: '📊 난이도별 퀴즈', cls: 'section-title' });
        const difficultyGrid = difficultySection.createDiv({ cls: 'difficulty-grid' });

        const difficultyButtons = [
            { icon: '🏆', text: 'A+', count: difficultyCount['A+'], callback: () => { this.close(); this.plugin.startQuiz('A+'); }, color: '#4caf50' },
            { icon: '⭐', text: 'A', count: difficultyCount['A'], callback: () => { this.close(); this.plugin.startQuiz('A'); }, color: '#66bb6a' },
            { icon: '⭐', text: 'A-', count: difficultyCount['A-'], callback: () => { this.close(); this.plugin.startQuiz('A-'); }, color: '#81c784' },
            { icon: '😊', text: 'B', count: difficultyCount['B'], callback: () => { this.close(); this.plugin.startQuiz('B'); }, color: '#ff9800' },
            { icon: '😊', text: 'B-', count: difficultyCount['B-'], callback: () => { this.close(); this.plugin.startQuiz('B-'); }, color: '#ffa726' },
            { icon: '😐', text: 'C', count: difficultyCount['C'], callback: () => { this.close(); this.plugin.startQuiz('C'); }, color: '#ffb74d' },
            { icon: '😰', text: 'D', count: difficultyCount['D'], callback: () => { this.close(); this.plugin.startQuiz('D'); }, color: '#ff5722' },
            { icon: '😱', text: 'E', count: difficultyCount['E'], callback: () => { this.close(); this.plugin.startQuiz('E'); }, color: '#f44336' },
            { icon: '💀', text: 'F', count: difficultyCount['F'], callback: () => { this.close(); this.plugin.startQuiz('F'); }, color: '#d32f2f' }
        ];

        difficultyButtons.forEach(action => {
            const btn = difficultyGrid.createEl('button', { 
                text: `${action.icon} ${action.text} (${action.count})`,
                cls: 'difficulty-button'
            });
            btn.style.borderColor = action.color;
            btn.addEventListener('click', action.callback);
        });

        // 섹션 3: 문제 관리
        const managementSection = actionsSection.createDiv({ cls: 'management-section' });
        managementSection.createEl('h3', { text: '📚 문제 관리', cls: 'section-title' });
        const managementGrid = managementSection.createDiv({ cls: 'management-grid' });

        const managementButtons = [
            { icon: '📝', text: '문제 만들기', callback: () => { this.close(); new HanziQuestionModal(this.app, this.plugin).open(); } },
            { icon: '📋', text: '문제 목록', callback: () => { this.close(); this.plugin.viewQuestionList(); } },
            { icon: '🔑', text: '키워드 목록', callback: () => { this.close(); this.plugin.viewKeywordList(); } },
            { icon: '⭐', text: '북마크 목록', callback: () => { this.close(); this.plugin.viewBookmarkList(); } },
            { icon: '❌', text: '오답 목록', callback: () => { this.close(); this.plugin.viewWrongAnswerList(); } },
            { icon: '📂', text: '폴더 관리', callback: () => { this.close(); new FolderManagementModal(this.app, this.plugin).open(); } }
        ];

        managementButtons.forEach(action => {
            const btn = managementGrid.createEl('button', { 
                text: `${action.icon} ${action.text}`,
                cls: 'management-button'
            });
            btn.addEventListener('click', action.callback);
        });

        // 섹션 4: 통계 & 설정
        const statsSection = actionsSection.createDiv({ cls: 'stats-section' });
        statsSection.createEl('h3', { text: '📈 통계 & 설정', cls: 'section-title' });
        const statsGrid = statsSection.createDiv({ cls: 'stats-grid' });

        const statsButtons = [
            { icon: '📊', text: '기록 관리', callback: () => { this.close(); new QuizDetailRecordModal(this.app, this.plugin, { correct: 0, incorrect: 0, total: 0, percentage: 0, time: 0, details: [] }).open(); } },
            { icon: '📈', text: '학습 통계', callback: () => { this.close(); this.plugin.viewStatistics(); } },
            { icon: '🎯', text: '통합 대시보드', callback: async () => { this.close(); await this.plugin.createIntegratedDashboard(); } },
            { icon: '⚙️', text: '설정', callback: () => { this.close(); this.app.setting.open(); this.app.setting.openTabById('hanzi-quiz'); } }
        ];

        statsButtons.forEach(action => {
            const btn = statsGrid.createEl('button', { 
                text: `${action.icon} ${action.text}`,
                cls: 'stats-button'
            });
            btn.addEventListener('click', action.callback);
        });
