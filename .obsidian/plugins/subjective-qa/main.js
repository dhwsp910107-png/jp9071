const { Plugin, MarkdownView, Notice } = require('obsidian');

class SubjectiveQAPlugin extends Plugin {
    async onload() {
        console.log('Loading Subjective Q&A Plugin');
        
        // 마크다운 코드블록 프로세서 등록
        this.registerMarkdownCodeBlockProcessor('qa', (source, el, ctx) => {
            this.processQABlock(source, el, ctx);
        });
        
        // 명령어 등록
        this.addCommand({
            id: 'create-qa-card',
            name: 'Create Q&A Card',
            callback: () => this.createQACard()
        });
        
        // CSS 스타일 추가
        this.addStyles();
        
        console.log('Subjective Q&A Plugin loaded successfully');
    }

    onunload() {
        console.log('Unloading Subjective Q&A Plugin');
        
        // 스타일 제거
        const style = document.getElementById('subjective-qa-styles');
        if (style) {
            style.remove();
        }
    }

    addStyles() {
        const style = document.createElement('style');
        style.id = 'subjective-qa-styles';
        style.textContent = `
            /* 주관식 Q&A 카드 스타일 - 모바일 최적화 */
            .qa-card-container {
                font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border-radius: 20px;
                padding: 24px;
                margin: 24px 0;
                box-shadow: 0 10px 30px rgba(102, 126, 234, 0.3);
                position: relative;
                overflow: hidden;
            }

            /* 레벨 배지 */
            .qa-level-badge {
                position: absolute;
                top: 16px;
                right: 16px;
                background: rgba(255, 255, 255, 0.2);
                backdrop-filter: blur(10px);
                color: white;
                padding: 8px 16px;
                border-radius: 20px;
                font-weight: 700;
                font-size: 14px;
                display: flex;
                align-items: center;
                gap: 4px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            }

            /* 문제 카드 */
            .qa-question-card {
                background: white;
                border-radius: 16px;
                padding: 28px 24px;
                margin-bottom: 20px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
                min-height: 200px;
                display: flex;
                flex-direction: column;
            }

            .qa-question-header {
                color: #667eea;
                font-size: 14px;
                font-weight: 700;
                letter-spacing: 1px;
                margin-bottom: 16px;
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .qa-question-text {
                color: #2d3748;
                font-size: clamp(1.1rem, 4vw, 1.3rem);
                line-height: 1.7;
                font-weight: 500;
                flex: 1;
                white-space: pre-wrap;
            }

            .qa-question-meta {
                display: flex;
                gap: 12px;
                margin-top: 20px;
                padding-top: 16px;
                border-top: 2px solid #e2e8f0;
                flex-wrap: wrap;
            }

            .qa-meta-item {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 6px 14px;
                border-radius: 12px;
                font-size: 13px;
                font-weight: 600;
                display: flex;
                align-items: center;
                gap: 6px;
            }

            /* 답변 확인 버튼 */
            .qa-reveal-button-area {
                width: 100%;
                padding: 8px;
                margin: 16px 0;
                user-select: none;
                -webkit-tap-highlight-color: transparent;
            }

            .qa-reveal-button {
                background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
                color: white;
                padding: 24px 28px;
                border-radius: 16px;
                border: none;
                box-shadow: 
                    0 8px 20px rgba(17, 153, 142, 0.3),
                    0 2px 4px rgba(0, 0, 0, 0.1);
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                text-align: center;
                width: 100%;
                cursor: pointer;
                position: relative;
                overflow: hidden;
            }

            .qa-reveal-button::before {
                content: '';
                position: absolute;
                top: 50%;
                left: 50%;
                width: 0;
                height: 0;
                border-radius: 50%;
                background: rgba(255, 255, 255, 0.2);
                transform: translate(-50%, -50%);
                transition: width 0.6s, height 0.6s;
            }

            .qa-reveal-button:active::before {
                width: 300px;
                height: 300px;
            }

            .qa-reveal-content {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 8px;
                position: relative;
                z-index: 1;
            }

            .qa-reveal-icon {
                font-size: clamp(2.2rem, 9vw, 3rem);
                filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
            }

            .qa-reveal-text {
                font-size: clamp(1.2rem, 5vw, 1.5rem);
                font-weight: 700;
                letter-spacing: 0.5px;
                text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
            }

            .qa-reveal-subtext {
                font-size: clamp(0.8rem, 3.5vw, 0.95rem);
                opacity: 0.9;
                font-weight: 500;
                letter-spacing: 0.3px;
            }

            .qa-reveal-button:hover {
                transform: translateY(-2px);
                box-shadow: 
                    0 12px 24px rgba(17, 153, 142, 0.35),
                    0 4px 8px rgba(0, 0, 0, 0.15);
            }

            .qa-reveal-button:active {
                transform: translateY(0);
            }

            .qa-reveal-button.revealed {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                box-shadow: 
                    0 8px 20px rgba(102, 126, 234, 0.3),
                    0 2px 4px rgba(0, 0, 0, 0.1);
            }

            .qa-reveal-button.revealed .qa-reveal-icon {
                animation: checkmark 0.5s ease-in-out;
            }

            @keyframes checkmark {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.2) rotate(10deg); }
            }

            /* 답변 섹션 */
            .qa-answer-section {
                opacity: 0;
                max-height: 0;
                overflow: hidden;
                transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1);
                background: white;
                border-radius: 16px;
                margin-top: 16px;
            }

            .qa-answer-section.show {
                opacity: 1;
                max-height: 3000px;
                animation: expandAnswer 0.6s ease-out;
            }

            @keyframes expandAnswer {
                from {
                    opacity: 0;
                    transform: translateY(-20px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            .qa-answer-card {
                padding: 28px 24px;
            }

            .qa-answer-header {
                color: #11998e;
                font-size: 14px;
                font-weight: 700;
                letter-spacing: 1px;
                margin-bottom: 16px;
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .qa-answer-text {
                color: #2d3748;
                font-size: clamp(1rem, 4vw, 1.15rem);
                line-height: 1.8;
                font-weight: 500;
                white-space: pre-wrap;
                background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
                padding: 20px;
                border-radius: 12px;
                border-left: 4px solid #11998e;
            }

            /* 해설 섹션 */
            .qa-explanation {
                margin-top: 20px;
                padding-top: 20px;
                border-top: 2px solid #e2e8f0;
            }

            .qa-explanation-header {
                color: #764ba2;
                font-size: 14px;
                font-weight: 700;
                letter-spacing: 1px;
                margin-bottom: 12px;
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .qa-explanation-text {
                color: #4a5568;
                font-size: clamp(0.95rem, 4vw, 1.05rem);
                line-height: 1.7;
                white-space: pre-wrap;
            }

            /* 키워드 섹션 */
            .qa-keywords {
                margin-top: 20px;
                padding-top: 20px;
                border-top: 2px solid #e2e8f0;
            }

            .qa-keywords-header {
                color: #667eea;
                font-size: 14px;
                font-weight: 700;
                letter-spacing: 1px;
                margin-bottom: 12px;
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .qa-keyword-list {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
            }

            .qa-keyword-tag {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 8px 16px;
                border-radius: 20px;
                font-size: 13px;
                font-weight: 600;
            }

            /* 타이머 */
            .qa-timer-container {
                position: relative;
                width: 100%;
                margin-bottom: 16px;
                background: rgba(255, 255, 255, 0.15);
                backdrop-filter: blur(10px);
                border-radius: 12px;
                overflow: hidden;
                border: 2px solid rgba(255, 255, 255, 0.3);
                box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
                height: 50px;
            }

            .qa-timer-progress {
                width: 100%;
                height: 100%;
                background: rgba(255, 255, 255, 0.1);
                position: relative;
                overflow: hidden;
            }

            .qa-timer-fill {
                width: 100%;
                height: 100%;
                background: linear-gradient(90deg, #11998e 0%, #38ef7d 100%);
                transition: width 0.1s linear;
                box-shadow: 0 0 15px rgba(17, 153, 142, 0.6);
                position: absolute;
                top: 0;
                left: 0;
            }

            .qa-timer-text {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                color: white;
                font-size: 18px;
                font-weight: 900;
                z-index: 10;
                text-align: center;
                letter-spacing: 2px;
                text-shadow: 
                    0 0 10px rgba(0, 0, 0, 0.8),
                    0 2px 4px rgba(0, 0, 0, 0.6);
                font-family: 'Arial Black', Arial, sans-serif;
                min-width: 60px;
                padding: 5px 15px;
                background: rgba(0, 0, 0, 0.2);
                border-radius: 20px;
                backdrop-filter: blur(5px);
            }

            /* 타이머 경고 상태 */
            .qa-timer-container.timer-warning {
                border-color: #f59e0b;
                animation: timer-pulse-warning 1s infinite;
            }

            .qa-timer-container.timer-warning .qa-timer-fill {
                background: linear-gradient(90deg, #f59e0b, #ef4444);
            }

            .qa-timer-container.timer-expired {
                border-color: #ef4444;
                animation: timer-pulse-danger 0.5s infinite;
            }

            .qa-timer-container.timer-expired .qa-timer-fill {
                background: linear-gradient(90deg, #ef4444, #dc2626);
            }

            @keyframes timer-pulse-warning {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.02); }
            }

            @keyframes timer-pulse-danger {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.03); }
            }

            /* 모바일 최적화 */
            @media (max-width: 768px) {
                .qa-card-container {
                    padding: 20px 16px;
                    border-radius: 16px;
                }
                
                .qa-question-card,
                .qa-answer-card {
                    padding: 20px 18px;
                }
                
                .qa-reveal-button {
                    padding: 20px 24px;
                    min-height: 80px;
                }
                
                .qa-level-badge {
                    top: 12px;
                    right: 12px;
                    padding: 6px 12px;
                    font-size: 12px;
                }
            }

            /* 터치 디바이스 최적화 */
            @media (hover: none) and (pointer: coarse) {
                .qa-reveal-button {
                    padding: 22px 24px;
                    min-height: 85px;
                }
                
                .qa-reveal-button-area {
                    padding: 12px;
                }
            }

            /* 다크모드 지원 */
            .theme-dark .qa-question-card,
            .theme-dark .qa-answer-section {
                background: #1e293b;
            }

            .theme-dark .qa-question-text,
            .theme-dark .qa-answer-text {
                color: #e2e8f0;
            }

            .theme-dark .qa-answer-text {
                background: linear-gradient(135deg, #1e3a5f 0%, #2d5a7b 100%);
            }

            .theme-dark .qa-explanation-text {
                color: #cbd5e1;
            }

            .theme-dark .qa-question-meta,
            .theme-dark .qa-explanation,
            .theme-dark .qa-keywords {
                border-top-color: #334155;
            }
        `;
        document.head.appendChild(style);
    }

    // Q&A 카드 생성 템플릿
    async createQACard() {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!activeView) return;

        const editor = activeView.editor;
        const template = `\`\`\`qa
문제: 여기에 문제를 입력하세요
답: 여기에 답을 입력하세요
해설: (선택) 문제 해설을 입력하세요
과목: 일본어
난이도: 3
키워드: 키워드1, 키워드2, 키워드3
타이머: 30
\`\`\`

위 정보를 입력하고 Live Preview 모드에서 확인하세요!
`;
        editor.replaceSelection(template);
        new Notice('✅ Q&A 카드 템플릿이 생성되었습니다!');
    }

    // Q&A 블록 처리
    processQABlock(source, el, ctx) {
        try {
            // 코드 블록 내용 파싱
            const data = this.parseQABlock(source);
            if (!data || !data.문제 || !data.답) {
                el.createEl('div', {
                    text: '❌ 문제와 답은 필수 항목입니다.',
                    cls: 'qa-error'
                });
                return;
            }

            // 카드 컨테이너 생성
            el.empty();
            el.addClass('qa-card-container');

            // 레벨 배지
            if (data.난이도) {
                const levelBadge = el.createDiv('qa-level-badge');
                const stars = '⭐'.repeat(Math.min(parseInt(data.난이도) || 1, 5));
                levelBadge.innerHTML = `<span>LV ${data.난이도}</span> <span>${stars}</span>`;
            }

            // 타이머 (설정된 경우)
            let timerContainer;
            if (data.타이머) {
                timerContainer = this.createTimer(el, parseInt(data.타이머));
            }

            // 문제 카드
            const questionCard = el.createDiv('qa-question-card');
            
            const questionHeader = questionCard.createDiv('qa-question-header');
            questionHeader.innerHTML = '📝 문제';
            
            const questionText = questionCard.createDiv('qa-question-text');
            questionText.textContent = data.문제;
            
            // 메타 정보
            const questionMeta = questionCard.createDiv('qa-question-meta');
            
            if (data.과목) {
                const subjectMeta = questionMeta.createDiv('qa-meta-item');
                subjectMeta.innerHTML = `📚 ${data.과목}`;
            }
            
            if (data.난이도) {
                const difficultyMeta = questionMeta.createDiv('qa-meta-item');
                difficultyMeta.innerHTML = `⭐ 난이도 ${data.난이도}`;
            }

            // 답변 확인 버튼
            const revealButtonArea = el.createDiv('qa-reveal-button-area');
            const revealButton = revealButtonArea.createEl('button', { cls: 'qa-reveal-button' });
            
            revealButton.innerHTML = `
                <div class="qa-reveal-content">
                    <div class="qa-reveal-icon">✅</div>
                    <div class="qa-reveal-text">답안 확인</div>
                    <div class="qa-reveal-subtext">클릭하기</div>
                </div>
            `;

            // 답변 섹션 (숨김)
            const answerSection = el.createDiv('qa-answer-section');
            const answerCard = answerSection.createDiv('qa-answer-card');
            
            const answerHeader = answerCard.createDiv('qa-answer-header');
            answerHeader.innerHTML = '✅ 답안';
            
            const answerText = answerCard.createDiv('qa-answer-text');
            answerText.textContent = data.답;

            // 해설 (있는 경우)
            if (data.해설) {
                const explanation = answerCard.createDiv('qa-explanation');
                const explanationHeader = explanation.createDiv('qa-explanation-header');
                explanationHeader.innerHTML = '💡 해설';
                
                const explanationText = explanation.createDiv('qa-explanation-text');
                explanationText.textContent = data.해설;
            }

            // 키워드 (있는 경우)
            if (data.키워드) {
                const keywords = answerCard.createDiv('qa-keywords');
                const keywordsHeader = keywords.createDiv('qa-keywords-header');
                keywordsHeader.innerHTML = '🔑 키워드';
                
                const keywordList = keywords.createDiv('qa-keyword-list');
                const keywordArray = data.키워드.split(',').map(k => k.trim());
                
                keywordArray.forEach(keyword => {
                    const tag = keywordList.createDiv('qa-keyword-tag');
                    tag.textContent = keyword;
                });
            }

            // 버튼 클릭 이벤트
            let isRevealed = false;
            revealButton.addEventListener('click', (e) => {
                e.preventDefault();
                
                if (!isRevealed) {
                    // 답변 표시
                    revealButton.classList.add('revealed');
                    answerSection.classList.add('show');
                    revealButton.querySelector('.qa-reveal-text').textContent = '답안 숨기기';
                    revealButton.querySelector('.qa-reveal-icon').textContent = '👁️';
                    isRevealed = true;
                    
                    // 타이머 중지
                    if (timerContainer && timerContainer.timerInterval) {
                        clearInterval(timerContainer.timerInterval);
                    }
                    
                    // 햅틱 피드백
                    if (navigator.vibrate) {
                        navigator.vibrate([30, 50, 30]);
                    }
                    
                    // 답변으로 스크롤
                    setTimeout(() => {
                        answerSection.scrollIntoView({ 
                            behavior: 'smooth', 
                            block: 'start' 
                        });
                    }, 300);
                } else {
                    // 답변 숨김
                    revealButton.classList.remove('revealed');
                    answerSection.classList.remove('show');
                    revealButton.querySelector('.qa-reveal-text').textContent = '답안 확인';
                    revealButton.querySelector('.qa-reveal-icon').textContent = '✅';
                    isRevealed = false;
                    
                    // 타이머 재시작
                    if (data.타이머) {
                        if (timerContainer) timerContainer.remove();
                        timerContainer = this.createTimer(el, parseInt(data.타이머));
                    }
                }
            });

            console.log('Q&A card rendered successfully');
        } catch (error) {
            console.error('Error processing Q&A code block:', error);
            el.createEl('div', {
                text: `❌ Q&A 카드 렌더링 오류: ${error.message}`,
                cls: 'qa-error'
            });
        }
    }

    // Q&A 블록 파싱
    parseQABlock(blockContent) {
        try {
            const lines = blockContent.trim().split('\n');
            const data = {};
            
            for (const line of lines) {
                const colonIndex = line.indexOf(':');
                if (colonIndex !== -1) {
                    const key = line.substring(0, colonIndex).trim();
                    const value = line.substring(colonIndex + 1).trim();
                    if (key && value) {
                        data[key] = value;
                    }
                }
            }
            
            return data;
        } catch (error) {
            console.error('Error parsing Q&A block:', error);
            return null;
        }
    }

    // 타이머 생성
    createTimer(container, duration) {
        const timerContainer = container.createDiv('qa-timer-container');
        
        // 첫 번째 요소로 삽입
        container.insertBefore(timerContainer, container.firstChild);
        
        timerContainer.innerHTML = `
            <div class="qa-timer-progress">
                <div class="qa-timer-fill"></div>
            </div>
            <div class="qa-timer-text">${duration}s</div>
        `;

        const progressFill = timerContainer.querySelector('.qa-timer-fill');
        const timerText = timerContainer.querySelector('.qa-timer-text');
        
        const startTime = Date.now();
        
        const updateTimer = () => {
            const elapsed = (Date.now() - startTime) / 1000;
            const remaining = Math.max(0, duration - elapsed);
            
            timerText.textContent = Math.ceil(remaining) + 's';
            
            const percent = (remaining / duration) * 100;
            progressFill.style.width = percent + '%';
            
            if (remaining <= 0) {
                timerText.textContent = 'TIME!';
                timerContainer.classList.add('timer-expired');
                if (timerContainer.timerInterval) {
                    clearInterval(timerContainer.timerInterval);
                }
                
                // 모바일 진동
                if (navigator.vibrate) {
                    navigator.vibrate([300, 200, 300]);
                }
                return;
            }
            
            // 경고 상태 (5초 남았을 때)
            if (remaining <= 5) {
                timerContainer.classList.add('timer-warning');
            }
        };

        updateTimer();
        timerContainer.timerInterval = setInterval(updateTimer, 100);
        
        return timerContainer;
    }
}

module.exports = SubjectiveQAPlugin;
