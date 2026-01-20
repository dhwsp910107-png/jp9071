// 대시보드 디자인 업그레이드 스크립트

const fs = require('fs');
const path = require('path');

(async () => {
    console.log('🎨 대시보드 디자인 업그레이드 시작...\n');
    
    const vaultPath = app.vault.adapter.basePath;
    const mainJsPath = path.join(vaultPath, '.obsidian', 'plugins', 'quiz-sp2', 'main.js');
    
    // 1. main.js 읽기
    let content = fs.readFileSync(mainJsPath, 'utf8');
    
    // 2. "빠른 작업" 섹션을 찾아서 교체
    const oldActionsSection = `        // 빠른 작업
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
            { icon: '�', text: '기록 관리', callback: () => { this.close(); new QuizDetailRecordModal(this.app, this.plugin, { correct: 0, incorrect: 0, total: 0, percentage: 0, time: 0, details: [] }).open(); } },
            { icon: '�📝', text: '문제 만들기', callback: () => { this.close(); new HanziQuestionModal(this.app, this.plugin).open(); } },
            { icon: '📋', text: '문제 목록', callback: () => { this.close(); this.plugin.viewQuestionList(); } },
            { icon: '🔑', text: '키워드 목록', callback: () => { this.close(); this.plugin.viewKeywordList(); } },
            { icon: '⭐', text: '북마크 목록', callback: () => { this.close(); this.plugin.viewBookmarkList(); } },
            { icon: '❌', text: '오답 목록', callback: () => { this.close(); this.plugin.viewWrongAnswerList(); } },
            { icon: '📈', text: '학습 통계', callback: () => { this.close(); this.plugin.viewStatistics(); } },
            { icon: '📂', text: '폴더 관리', callback: () => { this.close(); new FolderManagementModal(this.app, this.plugin).open(); } },
            { icon: '⚙️', text: '플러그인 설정', callback: () => { this.close(); this.app.setting.open(); this.app.setting.openTabById('quiz-sp'); } },
            { icon: '🎯', text: '통합 대시보드', callback: async () => { this.close(); await this.plugin.createIntegratedDashboard(); } }
        ];

        actions.forEach(action => {
            const btn = actionsGrid.createEl('button', { 
                text: action.count !== undefined ? \`\${action.icon} \${action.text} (\${action.count})\` : \`\${action.icon} \${action.text}\`,
                cls: 'action-button'
            });
            btn.addEventListener('click', action.callback);
        });`;
    
    const newActionsSection = `        // ⚡ 빠른 퀴즈 액션
        const quizSection = contentEl.createDiv({ cls: 'quiz-section' });
        quizSection.style.marginBottom = '25px';
        
        const quizTitle = quizSection.createEl('h2', { text: '⚡ 빠른 퀴즈' });
        quizTitle.style.cssText = 'margin-bottom: 15px; font-size: 20px;';

        const quizGrid = quizSection.createDiv({ cls: 'quiz-grid' });
        quizGrid.style.cssText = \`
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            gap: 10px;
        \`;

        // 난이도별 문제 개수 계산
        const difficultyCount = {};
        ['A+', 'A', 'A-', 'B', 'B-', 'C', 'D', 'E', 'F'].forEach(diff => {
            difficultyCount[diff] = questions.filter(q => q.difficulty === diff).length;
        });

        const createQuizCard = (icon, text, count, gradient, callback) => {
            const card = quizGrid.createDiv({ cls: 'quiz-card' });
            card.style.cssText = \`
                background: \${gradient};
                padding: 12px;
                border-radius: 8px;
                text-align: center;
                color: #000;
                cursor: pointer;
                transition: all 0.2s;
                box-shadow: 0 2px 10px rgba(0,0,0,0.15);
                user-select: none;
            \`;
            card.onmouseenter = () => {
                card.style.transform = 'translateY(-3px)';
                card.style.boxShadow = '0 4px 15px rgba(0,0,0,0.25)';
            };
            card.onmouseleave = () => {
                card.style.transform = 'translateY(0)';
                card.style.boxShadow = '0 2px 10px rgba(0,0,0,0.15)';
            };
            
            card.innerHTML = \`
                <div style="font-size: 24px; margin-bottom: 6px;">\${icon}</div>
                <div style="font-weight: 600; font-size: 12px; margin-bottom: 4px;">\${text}</div>
                <div style="font-size: 10px; opacity: 0.8;">\${count}문제</div>
            \`;
            card.addEventListener('click', callback);
        };

        createQuizCard('🎯', '전체', questions.length, 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', () => { this.close(); this.plugin.startQuiz(); });
        createQuizCard('🏆', 'A+', difficultyCount['A+'], 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)', () => { this.close(); this.plugin.startQuiz('A+'); });
        createQuizCard('⭐', 'A', difficultyCount['A'], 'linear-gradient(135deg, #10b981 0%, #059669 100%)', () => { this.close(); this.plugin.startQuiz('A'); });
        createQuizCard('😊', 'B', difficultyCount['B'], 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', () => { this.close(); this.plugin.startQuiz('B'); });
        createQuizCard('😐', 'C', difficultyCount['C'], 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)', () => { this.close(); this.plugin.startQuiz('C'); });
        createQuizCard('😰', 'D', difficultyCount['D'], 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)', () => { this.close(); this.plugin.startQuiz('D'); });
        createQuizCard('⭐', '북마크', stats.bookmarkedCount || 0, 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', () => { this.close(); this.plugin.startBookmarkQuiz(); });
        createQuizCard('❌', '오답', stats.wrongCount || 0, 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', () => { this.close(); this.plugin.startWrongAnswerQuiz(); });

        // 📊 관리 메뉴
        const manageSection = contentEl.createDiv({ cls: 'manage-section' });
        manageSection.style.marginBottom = '25px';
        
        const manageTitle = manageSection.createEl('h2', { text: '📊 관리 메뉴' });
        manageTitle.style.cssText = 'margin-bottom: 15px; font-size: 20px;';

        const manageGrid = manageSection.createDiv({ cls: 'manage-grid' });
        manageGrid.style.cssText = \`
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            gap: 10px;
        \`;

        const createManageCard = (icon, text, gradient, callback) => {
            const card = manageGrid.createDiv({ cls: 'manage-card' });
            card.style.cssText = \`
                background: \${gradient};
                padding: 12px;
                border-radius: 8px;
                text-align: center;
                color: #000;
                cursor: pointer;
                transition: all 0.2s;
                box-shadow: 0 2px 10px rgba(0,0,0,0.15);
                user-select: none;
            \`;
            card.onmouseenter = () => {
                card.style.transform = 'translateY(-3px)';
                card.style.boxShadow = '0 4px 15px rgba(0,0,0,0.25)';
            };
            card.onmouseleave = () => {
                card.style.transform = 'translateY(0)';
                card.style.boxShadow = '0 2px 10px rgba(0,0,0,0.15)';
            };
            
            card.innerHTML = \`
                <div style="font-size: 24px; margin-bottom: 6px;">\${icon}</div>
                <div style="font-weight: 600; font-size: 12px;">\${text}</div>
            \`;
            card.addEventListener('click', callback);
        };

        createManageCard('📝', '문제 만들기', 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)', () => { this.close(); new HanziQuestionModal(this.app, this.plugin).open(); });
        createManageCard('📋', '문제 목록', 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', () => { this.close(); this.plugin.viewQuestionList(); });
        createManageCard('🔑', '키워드', 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)', () => { this.close(); this.plugin.viewKeywordList(); });
        createManageCard('⭐', '북마크', 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', () => { this.close(); this.plugin.viewBookmarkList(); });
        createManageCard('❌', '오답', 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', () => { this.close(); this.plugin.viewWrongAnswerList(); });
        createManageCard('📈', '통계', 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)', () => { this.close(); this.plugin.viewStatistics(); });
        createManageCard('📂', '폴더', 'linear-gradient(135deg, #64748b 0%, #475569 100%)', () => { this.close(); new FolderManagementModal(this.app, this.plugin).open(); });
        createManageCard('⚙️', '설정', 'linear-gradient(135deg, #71717a 0%, #52525b 100%)', () => { this.close(); this.app.setting.open(); this.app.setting.openTabById('quiz-sp'); });`;
    
    // 3. 교체
    if (content.includes(oldActionsSection)) {
        content = content.replace(oldActionsSection, newActionsSection);
        console.log('✅ 빠른 작업 섹션 교체 완료');
    } else {
        console.log('❌ 빠른 작업 섹션을 찾을 수 없습니다');
        return;
    }
    
    // 4. 파일 저장
    fs.writeFileSync(mainJsPath, content, 'utf8');
    console.log('✅ main.js 저장 완료');
    
    // 5. 플러그인 reload
    console.log('\n🔄 플러그인 reload...');
    await app.plugins.disablePlugin('quiz-sp');
    await new Promise(resolve => setTimeout(resolve, 500));
    await app.plugins.enablePlugin('quiz-sp');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('✅ 플러그인 reload 완료');
    console.log('\n🎉 대시보드 디자인 업그레이드 완료!');
    console.log('📋 통합 대시보드를 열어서 확인하세요!');
})();
