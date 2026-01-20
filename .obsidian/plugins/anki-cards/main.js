const { Plugin, MarkdownView, MarkdownRenderer, Component, Notice, PluginSettingTab, Setting } = require('obsidian');

// Anki Cards 플러그인 설정
class AnkiCardSettings {
    constructor() {
        this.defaultSettings = {
            // 일반 설정
            autoGenerateTimer: true,
            defaultTimerDuration: 30,
            showHints: true,
            autoShowAnswer: false,
            
            // 테마 설정
            theme: 'f1-racing',
            enableAnimations: true,
            enableVibration: true,
            
            // DB 설정
            autoCreateFolders: true,
            defaultSubject: '일본어',
            defaultLevel: 3,
            enableAutoBackup: true,
            backupInterval: 7, // 일
            
            // DataviewJS 연동
            enableDataviewIntegration: true,
            dashboardPath: 'Anki-Cards-DB/통계/Dashboard.md',
            autoUpdateDashboard: true,
            
            // 고급 설정
            enableDebugMode: false,
            customCSS: '',
            exportFormat: 'json'
        };
        
        this.settings = { ...this.defaultSettings };
    }
    
    // 설정 로드
    async loadSettings(plugin) {
        const data = await plugin.loadData();
        this.settings = Object.assign({}, this.defaultSettings, data);
    }
    
    // 설정 저장
    async saveSettings(plugin) {
        await plugin.saveData(this.settings);
    }
    
    // 설정값 가져오기
    get(key) {
        return this.settings[key];
    }
    
    // 설정값 설정하기
    set(key, value) {
        this.settings[key] = value;
    }
}

// Anki Card Parser - 앞면/뒷면/CSS 형식 지원
class AnkiCardParser {
    constructor() {
        this.frontTemplate = '';
        this.backTemplate = '';
        this.cssStyles = '';
    }

    // Anki 앞면 템플릿 처리
    parseFrontTemplate(frontHtml) {
        // Anki {{필드}} 문법을 Obsidian 변수로 변환
        let processed = frontHtml
            .replace(/\{\{#([^}]+)\}\}/g, '<!-- IF $1 -->')
            .replace(/\{\{\/([^}]+)\}\}/g, '<!-- ENDIF $1 -->')
            .replace(/\{\{\^([^}]+)\}\}/g, '<!-- IFNOT $1 -->')
            .replace(/\{\{([^}]+)\}\}/g, '{{$1}}');

        return this.cleanAnkiHtml(processed);
    }

    // Anki 뒷면 템플릿 처리
    parseBackTemplate(backHtml) {
        let processed = backHtml
            .replace(/\{\{#([^}]+)\}\}/g, '<!-- IF $1 -->')
            .replace(/\{\{\/([^}]+)\}\}/g, '<!-- ENDIF $1 -->')
            .replace(/\{\{\^([^}]+)\}\}/g, '<!-- IFNOT $1 -->')
            .replace(/\{\{([^}]+)\}\}/g, '{{$1}}');

        return this.cleanAnkiHtml(processed);
    }

    // Anki CSS를 Obsidian용으로 변환
    parseAnkiCSS(cssContent) {
        // Anki 특화 CSS를 Obsidian 환경에 맞게 수정
        let processed = cssContent
            .replace(/body\s*{/g, '.anki-card-container {')
            .replace(/#timer-container/g, '.anki-timer-container')
            .replace(/#timer-text/g, '.anki-timer-text')
            .replace(/#timer-progress/g, '.anki-timer-progress')
            .replace(/#timer-fill/g, '.anki-timer-fill')
            .replace(/#time-result/g, '.anki-time-result');

        return processed;
    }

    // HTML 정리
    cleanAnkiHtml(html) {
        return html
            .replace(/<!--[\s\S]*?-->/g, '') // 주석 제거
            .replace(/\s+/g, ' ') // 공백 정리
            .trim();
    }

    // 필드 추출
    extractFields(template) {
        const fieldRegex = /\{\{([^}]+)\}\}/g;
        const fields = new Set();
        let match;
        
        while ((match = fieldRegex.exec(template)) !== null) {
            const field = match[1].trim();
            if (!field.startsWith('#') && !field.startsWith('/') && !field.startsWith('^')) {
                fields.add(field);
            }
        }
        
        return Array.from(fields);
    }

    // 조건부 블록 처리
    processConditionals(html, data) {
        // {{#field}} ... {{/field}} 처리
        const conditionalRegex = /<!-- IF ([^>]+) -->([\s\S]*?)<!-- ENDIF \1 -->/g;
        html = html.replace(conditionalRegex, (match, field, content) => {
            return data[field] ? content : '';
        });

        // {{^field}} ... {{/field}} 처리  
        const negativeRegex = /<!-- IFNOT ([^>]+) -->([\s\S]*?)<!-- ENDIF \1 -->/g;
        html = html.replace(negativeRegex, (match, field, content) => {
            return !data[field] ? content : '';
        });

        return html;
    }

    // 필드 값 치환
    replaceFields(html, data) {
        return html.replace(/\{\{([^}]+)\}\}/g, (match, field) => {
            return data[field] || '';
        });
    }

    // 카드 렌더링
    renderCard(template, data, isBack = false) {
        let html = this.processConditionals(template, data);
        html = this.replaceFields(html, data);
        
        return {
            html: html,
            isBack: isBack,
            fields: this.extractFields(template)
        };
    }
}

class AnkiCardsPlugin extends Plugin {
    async onload() {
        console.log('Loading Anki Cards Plugin');
        
        // 설정 초기화
        this.ankiSettings = new AnkiCardSettings();
        await this.ankiSettings.loadSettings(this);
        
        // Anki 파서 초기화
        this.ankiParser = new AnkiCardParser();
        
        // Anki 템플릿 로드
        this.loadAnkiTemplates();
        
        // 명령어 등록
        this.addCommands();
        
        // 마크다운 코드블록 프로세서 등록
        this.registerMarkdownCodeBlockProcessor('anki', (source, el, ctx) => {
            this.processAnkiCodeBlock(source, el, ctx);
        });

        // 주관식 Q&A 코드블록 프로세서 중복 등록 방지
        if (!this.qaProcessorRegistered) {
            this.registerMarkdownCodeBlockProcessor('qa', (source, el, ctx) => {
                this.processQACodeBlock(source, el, ctx);
            });
            this.qaProcessorRegistered = true;
        }
        
        // 이벤트 리스너 등록
        this.registerEvents();
        
        // CSS 스타일 추가
        this.addStyles();
        
        // 설정 탭 추가
        this.addSettingTab(new AnkiCardsSettingTab(this.app, this));
        
        // 리본 아이콘 추가
        this.addRibbonIcon('cards', 'Anki Cards Dashboard', () => {
            this.openDashboard();
        });
        
        // 자동 백업 설정
        if (this.ankiSettings.get('enableAutoBackup')) {
            this.setupAutoBackup();
        }
        
        console.log('Anki Cards Plugin loaded successfully');
    }

    onunload() {
        console.log('Unloading Anki Cards Plugin');
        
        // 타이머 정리
        if (this.currentTimer) {
            this.stopTimer();
        }
        
        // 자동 백업 타이머 정리
        if (this.backupTimer) {
            clearInterval(this.backupTimer);
        }
        
        // 스타일 제거
        const style = document.getElementById('anki-cards-styles');
        if (style) {
            style.remove();
        }
        
        // Anki 카드 컨테이너 제거
        const ankiCards = document.querySelectorAll('.anki-card-container');
        ankiCards.forEach(card => card.remove());
    }

    async loadSettings() {
        // 이제 AnkiCardSettings 클래스에서 처리
        return;
    }

    async saveSettings() {
        await this.ankiSettings.saveSettings(this);
    }

    // Anki 템플릿 로드
    loadAnkiTemplates() {
        // 사용자가 제공한 앞면 템플릿
        this.frontTemplate = `<!-- ===================== 레벨 인디케이터 ===================== -->
{{#레벨}}
<div class="anki-level-info">
  <div style="font-size: 0.8rem; margin-bottom: 2px; opacity: 0.9;">하고싶은말</div>
  <div>
    <span style="font-size: 1.2rem; margin-right: 3px;">LV</span>
    <span style="font-size: 1rem;">{{레벨}}</span>
  </div>
</div>
{{/레벨}}

<!-- ===================== 앞면 메인 콘텐츠 ===================== -->
<div class="anki-wrapper1">
  <div class="anki-no-select">
    <!-- 주요 단어와 요미가나 -->
    <div class="anki-dango">
      <ruby>
        {{단어}}
        <rt class="anki-hidden-content">
          {{#루비}}{{루비}}{{/루비}}{{^루비}}&nbsp;{{/루비}}
        </rt>
      </ruby>
    </div>

    <!-- 한자 정보와 의미 정보 -->
    <div class="anki-hidden-content">
      <div class="anki-hanjamean">
        {{#한자}}（{{한자}}）{{/한자}}
      </div>
      <div class="anki-meaning-hint">
        {{#의미}}{{의미}}{{/의미}}
      </div>
    </div>

    <!-- 힌트 버튼 구역 -->
    <div class="anki-hint-area">
      <div class="anki-hint-button">
        <div class="anki-hint-content">
          <div class="anki-hint-icon">🏁</div>
          <div class="anki-hint-text">HINT</div>
          <div class="anki-hint-subtext">LONG PRESS</div>
        </div>
      </div>
    </div>
  </div>
</div>`;

        // 사용자가 제공한 뒷면 템플릿
        this.backTemplate = `<!-- ===================== 레벨 인디케이터 ===================== -->
{{#레벨}}
<div class="anki-level-info">
  <div style="font-size: 0.8rem; margin-bottom: 2px; opacity: 0.9;">준영아기다려라</div>
  <div>
    <span style="font-size: 1.2rem; margin-right: 3px;">LV</span>
    <span style="font-size: 1rem;">{{레벨}}</span>
  </div>
</div>
{{/레벨}}

<!-- ===================== 뒷면 답안 영역 ===================== -->
<div class="anki-answer-wrapper">
  <div class="anki-answer-card">
    <!-- 메인 답안 영역 -->
    <div class="anki-answer-section">
      <!-- 의미 -->
      <div class="anki-meaning-box">
        <div class="anki-label">MEANING</div>
        <div class="anki-content">{{의미}}</div>
      </div>
      
      <!-- 한자 정보 -->
      {{#한자}}
      <div class="anki-kanji-box">
        <div class="anki-label">KANJI</div>
        <div class="anki-content">{{한자}}</div>
      </div>
      {{/한자}}
      
      <!-- 품사 -->
      {{#품사}}
      <div class="anki-part-box">
        <div class="anki-label">PART</div>
        <div class="anki-content">{{품사}}</div>
      </div>
      {{/품사}}
      
      <!-- 예문 -->
      {{#예문}}
      <div class="anki-example-box">
        <div class="anki-label">EXAMPLE</div>
        <div class="anki-content">{{예문}}</div>
      </div>
      {{/예문}}
    </div>
  </div>
</div>

<!-- 앞면 가기 버튼 -->
<div class="anki-back-to-front">
  <button class="anki-front-button" onclick="showFront()">
    <div class="anki-button-icon">⬅️</div>
    <div class="anki-button-text">FRONT</div>
    <div class="anki-button-hint">ESC KEY</div>
  </button>
</div>`;
    }

    addCommands() {
        // Basic Card 생성 명령어
        this.addCommand({
            id: 'create-basic-card',
            name: 'Create Basic Card (Front/Back)',
            callback: () => this.createBasicCard()
        });

        // Cloze Card 생성 명령어
        this.addCommand({
            id: 'create-cloze-card',
            name: 'Create Cloze Card (Fill in blanks)',
            callback: () => this.createClozeCard()
        });

        // Reverse Card 생성 명령어
        this.addCommand({
            id: 'create-reverse-card',
            name: 'Create Reverse Card (Bidirectional)',
            callback: () => this.createReverseCard()
        });

        // 모든 Anki 카드 토글
        this.addCommand({
            id: 'toggle-anki-cards',
            name: 'Toggle Anki Cards Display',
            callback: () => this.toggleAnkiCards()
        });

        // 대시보드 관련 명령어들
        this.addCommand({
            id: 'open-anki-dashboard',
            name: 'Open Anki Cards Dashboard',
            callback: () => this.openDashboard()
        });

        this.addCommand({
            id: 'create-anki-dashboard',
            name: 'Create Anki Dashboard',
            callback: () => this.createDashboard()
        });

        this.addCommand({
            id: 'update-dashboard',
            name: 'Update Dashboard Statistics',
            callback: () => this.updateDashboard()
        });

        // DB 관리 명령어들
        this.addCommand({
            id: 'open-anki-db-manager',
            name: 'Open Anki Database Manager',
            callback: () => this.openDBManager()
        });

        this.addCommand({
            id: 'create-anki-folder-structure',
            name: 'Create Anki Folder Structure',
            callback: () => this.createAnkiFolderStructure()
        });

        this.addCommand({
            id: 'export-anki-db',
            name: 'Export Anki Cards Database',
            callback: () => this.exportAnkiDatabase()
        });

        this.addCommand({
            id: 'view-anki-statistics',
            name: 'View Anki Statistics',
            callback: () => this.viewAnkiStatistics()
        });

        this.addCommand({
            id: 'organize-cards-by-difficulty',
            name: 'Organize Cards by Difficulty',
            callback: () => this.organizeCardsByDifficulty()
        });

        // 주관식 문제 모달
        this.addCommand({
            id: 'create-subjective-qa',
            name: 'Create Subjective Q&A Card',
            callback: () => this.openSubjectiveQAModal()
        });
    }

    registerEvents() {
        // 파일이 열릴 때 Anki 카드 처리
        this.registerEvent(
            this.app.workspace.on('file-open', (file) => {
                if (file && file.extension === 'md') {
                    this.processAnkiCards(file);
                }
            })
        );

        // 에디터 변경 시 실시간 처리
        this.registerEvent(
            this.app.workspace.on('editor-change', (editor, view) => {
                if (view instanceof MarkdownView) {
                    this.processCurrentView(view);
                }
            })
        );
    }

    addStyles() {
        const style = document.createElement('style');
        style.id = 'anki-cards-styles';
        style.textContent = `
            /* Anki Cards Plugin Styles - F1 테마 적용 */
            .anki-card-container {
                font-family: 'Arial Black', Arial, sans-serif;
                background: linear-gradient(135deg, #0a0a0a, #1a1a1a);
                color: #ffffff;
                margin: 20px 0;
                border-radius: 15px;
                overflow: hidden;
                position: relative;
            }

            /* 레벨 인디케이터 */
            .anki-level-info {
                position: absolute;
                top: 15px;
                right: 15px;
                background: linear-gradient(45deg, #ffcc00, #ff8800);
                color: #000000;
                opacity: 0.8;
                padding: 6px 12px;
                border-radius: 20px;
                font-weight: 900;
                font-size: 13px;
                letter-spacing: 1px;
                z-index: 100;
                text-align: center;
                font-family: 'Arial Black', Arial, sans-serif;
                box-shadow: 0 6px 20px rgba(255, 204, 0, 0.5);
                border: 2px solid #ff1e1e;
                min-width: 60px;
            }

            /* 앞면 스타일 */
            .anki-wrapper1 {
                background: linear-gradient(145deg, #1a1a1a, #2d2d2d);
                border: 3px solid #ff1e1e;
                border-radius: 15px;
                padding: 30px 20px;
                margin: 20px;
                box-shadow: 0 0 30px rgba(255, 30, 30, 0.4);
                position: relative;
                min-height: 400px;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .anki-no-select {
                width: 100%;
                text-align: center;
                user-select: none;
            }

            .anki-dango {
                font-size: 3.5rem;
                font-weight: 900;
                color: #ffffff;
                margin: 25px 0;
                line-height: 1.1;
                text-shadow: 0 0 10px rgba(255, 30, 30, 0.8);
                letter-spacing: 2px;
            }

            .anki-dango rt {
                font-size: 1.1rem;
                color: #ffcc00;
                font-weight: 700;
                opacity: 0;
                transform: translateY(-8px);
                transition: all 0.3s ease;
                text-shadow: 0 0 8px rgba(255, 204, 0, 0.8);
                letter-spacing: 1px;
            }

            .anki-dango rt.show {
                opacity: 1;
                transform: translateY(0);
            }

            .anki-hidden-content {
                margin: 20px 0;
            }

            .anki-hanjamean {
                font-size: 1.3rem;
                color: #00ff88;
                margin: 15px 0;
                opacity: 0;
                transform: translateY(15px);
                transition: all 0.3s ease;
                font-weight: 700;
                text-shadow: 0 0 8px rgba(0, 255, 136, 0.8);
                letter-spacing: 1px;
            }

            .anki-hidden-content.show .anki-hanjamean {
                opacity: 1;
                transform: translateY(0);
            }

            .anki-meaning-hint {
                font-size: 1.2rem;
                color: #ffcc00;
                margin: 15px 0;
                opacity: 0;
                transform: translateY(15px);
                transition: all 0.3s ease;
                font-weight: 700;
                text-shadow: 0 0 8px rgba(255, 204, 0, 0.8);
                letter-spacing: 1px;
                padding: 15px 20px;
                background: rgba(255, 204, 0, 0.1);
                border: 2px solid rgba(255, 204, 0, 0.6);
                border-radius: 12px;
            }

            .anki-hidden-content.show .anki-meaning-hint {
                opacity: 1;
                transform: translateY(0);
            }

            /* 힌트 버튼 */
            .anki-hint-area {
                margin-top: 30px;
                cursor: pointer;
                user-select: none;
            }

            .anki-hint-button {
                background: linear-gradient(145deg, #ff1e1e, #cc0000);
                color: #ffffff;
                padding: 20px 15px;
                border-radius: 15px;
                border: 2px solid #ffcc00;
                box-shadow: 0 8px 25px rgba(255, 30, 30, 0.5);
                transition: transform 0.2s ease;
                min-height: 80px;
                display: flex;
                align-items: center;
                justify-content: center;
                text-transform: uppercase;
                font-weight: 900;
            }

            .anki-hint-content {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
            }

            .anki-hint-icon {
                font-size: 1.8rem;
                margin-bottom: 5px;
            }

            .anki-hint-text {
                font-size: 1.2rem;
                font-weight: 900;
                margin-bottom: 2px;
                letter-spacing: 3px;
            }

            .anki-hint-subtext {
                font-size: 0.8rem;
                opacity: 0.9;
                font-weight: 700;
                letter-spacing: 2px;
                color: #ffcc00;
            }

            /* 뒷면 스타일 */
            .anki-answer-wrapper {
                margin: 20px;
                display: flex;
                justify-content: center;
            }

            .anki-answer-card {
                background: linear-gradient(145deg, #1a1a1a, #2d2d2d);
                border: 3px solid #00ff88;
                border-radius: 25px;
                padding: 25px;
                box-shadow: 0 0 30px rgba(0, 255, 136, 0.4);
                width: 100%;
                max-width: 600px;
            }

            .anki-answer-section {
                position: relative;
            }

            .anki-meaning-box, .anki-kanji-box, .anki-part-box, .anki-example-box {
                background: rgba(255, 255, 255, 0.08);
                border: 2px solid rgba(0, 255, 136, 0.6);
                border-radius: 15px;
                padding: 15px 20px;
                margin-bottom: 15px;
            }

            .anki-label {
                font-size: 0.8rem;
                font-weight: 900;
                color: #ffcc00;
                letter-spacing: 2px;
                margin-bottom: 8px;
                font-family: 'Arial Black', Arial, sans-serif;
            }

            .anki-content {
                font-size: 1.3rem;
                font-weight: 700;
                color: #ffffff;
                line-height: 1.4;
                font-family: 'Arial Black', Arial, sans-serif;
            }

            .anki-meaning-box {
                border-color: #ff1e1e;
            }

            .anki-meaning-box .anki-label {
                color: #ff1e1e;
            }

            .anki-meaning-box .anki-content {
                font-size: 1.5rem;
                color: #ff1e1e;
            }

            /* 앞면 가기 버튼 */
            .anki-back-to-front {
                margin: 30px 20px;
                text-align: center;
            }

            .anki-front-button {
                background: linear-gradient(145deg, #ff1e1e 0%, #c0392b 50%, #ff1e1e 100%);
                border: 3px solid #ffcc00;
                color: #ffffff;
                padding: 20px 40px;
                border-radius: 18px;
                font-family: 'Arial Black', Arial, sans-serif;
                font-weight: 900;
                cursor: pointer;
                transition: all 0.4s ease;
                position: relative;
                overflow: hidden;
                text-shadow: 0 3px 6px rgba(0, 0, 0, 0.9);
                box-shadow: 0 8px 25px rgba(255, 30, 30, 0.5);
                display: inline-flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                min-width: 200px;
            }

            .anki-front-button:hover {
                background: linear-gradient(145deg, #c0392b 0%, #a93226 50%, #c0392b 100%);
                transform: translateY(-4px);
                box-shadow: 0 12px 35px rgba(255, 30, 30, 0.7);
                border-color: #00ff88;
            }

            .anki-button-icon {
                font-size: 2rem;
                margin-bottom: 8px;
            }

            .anki-button-text {
                font-size: 1.2rem;
                font-weight: 900;
                letter-spacing: 3px;
                margin-bottom: 6px;
                text-transform: uppercase;
            }

            .anki-button-hint {
                font-size: 0.8rem;
                opacity: 0.95;
                font-weight: 700;
                color: #ffcc00;
                letter-spacing: 2px;
            }

            /* 타이머 스타일 (카드 내부 - 진행바 형태) */
            .anki-timer-container-local {
                position: relative;
                width: 100%;
                margin-bottom: 15px;
                background: linear-gradient(145deg, #1a1a1a, #2d2d2d);
                border-radius: 12px;
                overflow: hidden;
                border: 3px solid #ff1e1e;
                box-shadow: 0 6px 20px rgba(255, 30, 30, 0.4);
                height: 50px;
            }

            .anki-timer-progress-local {
                width: 100%;
                height: 100%;
                background: linear-gradient(145deg, #1a1a1a, #2d2d2d);
                position: relative;
                overflow: hidden;
            }

            .anki-timer-fill-local {
                width: 100%;
                height: 100%;
                background: linear-gradient(90deg, #ff1e1e 0%, #ffcc00 50%, #00ff88 100%);
                transition: width 0.1s linear;
                box-shadow: 0 0 15px rgba(255, 30, 30, 0.6);
                position: absolute;
                top: 0;
                left: 0;
            }

            .anki-timer-text-local {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                color: #ffffff;
                font-size: 18px;
                font-weight: 900;
                z-index: 10;
                text-align: center;
                letter-spacing: 2px;
                text-shadow: 
                    0 0 10px rgba(0, 0, 0, 0.8),
                    0 2px 4px rgba(0, 0, 0, 0.6),
                    0 0 20px rgba(255, 30, 30, 0.8);
                font-family: 'Arial Black', Arial, sans-serif;
                min-width: 60px;
                padding: 5px 15px;
                background: rgba(0, 0, 0, 0.3);
                border-radius: 20px;
                backdrop-filter: blur(5px);
            }

            /* 타이머 경고/만료 상태 */
            .anki-timer-container-local.timer-warning {
                border-color: #ffcc00;
                animation: timer-container-pulse-warning 1s infinite;
            }

            .anki-timer-container-local.timer-warning .anki-timer-fill-local {
                background: linear-gradient(90deg, #f39c12, #e67e22);
                box-shadow: 0 0 20px rgba(243, 156, 18, 0.8);
            }

            .anki-timer-container-local.timer-warning .anki-timer-text-local {
                text-shadow: 
                    0 0 10px rgba(0, 0, 0, 0.8),
                    0 2px 4px rgba(0, 0, 0, 0.6),
                    0 0 20px rgba(243, 156, 18, 0.9);
                animation: timer-text-pulse-warning 1s infinite;
            }

            .anki-timer-container-local.timer-expired {
                border-color: #ffcc00;
                animation: timer-container-pulse-danger 0.5s infinite;
            }

            .anki-timer-container-local.timer-expired .anki-timer-fill-local {
                background: linear-gradient(90deg, #e74c3c, #c0392b);
                box-shadow: 0 0 25px rgba(231, 76, 60, 1);
            }

            .anki-timer-container-local.timer-expired .anki-timer-text-local {
                text-shadow: 
                    0 0 10px rgba(0, 0, 0, 0.8),
                    0 2px 4px rgba(0, 0, 0, 0.6),
                    0 0 25px rgba(231, 76, 60, 1);
                animation: timer-text-pulse-danger 0.5s infinite;
                font-size: 20px;
            }

            @keyframes timer-container-pulse-warning {
                0%, 100% { transform: scale(1); box-shadow: 0 6px 20px rgba(243, 156, 18, 0.4); }
                50% { transform: scale(1.02); box-shadow: 0 8px 25px rgba(243, 156, 18, 0.6); }
            }

            @keyframes timer-container-pulse-danger {
                0%, 100% { transform: scale(1); box-shadow: 0 6px 20px rgba(231, 76, 60, 0.6); }
                50% { transform: scale(1.03); box-shadow: 0 10px 30px rgba(231, 76, 60, 0.9); }
            }

            @keyframes timer-text-pulse-warning {
                0%, 100% { transform: translate(-50%, -50%) scale(1); }
                50% { transform: translate(-50%, -50%) scale(1.05); }
            }

            @keyframes timer-text-pulse-danger {
                0%, 100% { transform: translate(-50%, -50%) scale(1); }
                50% { transform: translate(-50%, -50%) scale(1.1); }
            }

            /* 기존 전역 타이머 스타일 제거 */
            .anki-timer-container {
                display: none !important;
            }

            .anki-timer-text {
                display: none !important;
            }

            .anki-timer-progress {
                display: none !important;
            }

            .anki-timer-fill {
                display: none !important;
            }

            /* 모바일 최적화 */
            @media (max-width: 768px) {
                .anki-wrapper1 {
                    padding: 20px 15px;
                    margin: 15px;
                    min-height: 300px;
                }
                
                .anki-dango {
                    font-size: 2.8rem;
                    margin: 20px 0;
                }
                
                .anki-answer-wrapper {
                    margin: 15px;
                }
                
                .anki-answer-card {
                    padding: 20px 15px;
                }
                
                .anki-front-button {
                    padding: 16px 32px;
                    min-width: 170px;
                }
            }

            /* 에러 표시 스타일 */
            .anki-error {
                background: linear-gradient(145deg, #e74c3c, #c0392b);
                color: #ffffff;
                padding: 15px 20px;
                border-radius: 10px;
                border: 2px solid #ffcc00;
                margin: 20px 0;
                font-family: 'Arial Black', Arial, sans-serif;
                font-weight: 700;
                text-align: center;
                box-shadow: 0 6px 20px rgba(231, 76, 60, 0.4);
            }

            /* DB 관리 UI 스타일 */
            .anki-db-modal {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: linear-gradient(135deg, #1a1a2e, #16213e);
                border: 2px solid #00f5ff;
                border-radius: 20px;
                padding: 30px;
                z-index: 10000;
                min-width: 500px;
                max-width: 80vw;
                max-height: 80vh;
                overflow-y: auto;
                box-shadow: 0 20px 60px rgba(0, 245, 255, 0.3);
                backdrop-filter: blur(20px);
            }

            .anki-db-modal h2 {
                color: #00f5ff;
                text-align: center;
                margin-bottom: 20px;
                font-size: 24px;
                text-shadow: 0 0 10px rgba(0, 245, 255, 0.5);
            }

            .anki-db-button {
                background: linear-gradient(135deg, #00f5ff, #0066ff);
                color: white;
                border: none;
                padding: 12px 24px;
                margin: 8px;
                border-radius: 25px;
                cursor: pointer;
                font-size: 14px;
                font-weight: bold;
                transition: all 0.3s ease;
                box-shadow: 0 4px 15px rgba(0, 245, 255, 0.3);
                min-width: 200px;
                display: block;
                width: 100%;
            }

            .anki-db-button:hover {
                background: linear-gradient(135deg, #0066ff, #00f5ff);
                transform: translateY(-2px);
                box-shadow: 0 8px 25px rgba(0, 245, 255, 0.5);
            }

            .anki-db-button.danger {
                background: linear-gradient(135deg, #ff1744, #ff6b6b);
            }

            .anki-db-button.danger:hover {
                background: linear-gradient(135deg, #ff6b6b, #ff1744);
            }

            .anki-db-button.success {
                background: linear-gradient(135deg, #00e676, #4caf50);
            }

            .anki-db-button.success:hover {
                background: linear-gradient(135deg, #4caf50, #00e676);
            }

            .anki-stats-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 15px;
                margin: 20px 0;
            }

            .anki-stat-card {
                background: rgba(0, 245, 255, 0.1);
                border: 1px solid rgba(0, 245, 255, 0.3);
                border-radius: 15px;
                padding: 20px;
                text-align: center;
                transition: all 0.3s ease;
            }

            .anki-stat-card:hover {
                background: rgba(0, 245, 255, 0.2);
                transform: translateY(-5px);
                box-shadow: 0 10px 30px rgba(0, 245, 255, 0.2);
            }

            .anki-stat-number {
                font-size: 32px;
                font-weight: bold;
                color: #00f5ff;
                text-shadow: 0 0 10px rgba(0, 245, 255, 0.5);
            }

            .anki-stat-label {
                color: #ffffff;
                margin-top: 8px;
                font-size: 14px;
            }

            .anki-modal-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                z-index: 9999;
                backdrop-filter: blur(5px);
            }

            .anki-modal-close {
                position: absolute;
                top: 15px;
                right: 20px;
                background: none;
                border: none;
                color: #ff1744;
                font-size: 24px;
                cursor: pointer;
                transition: all 0.3s ease;
            }

            .anki-modal-close:hover {
                color: #ff6b6b;
                transform: scale(1.2);
            }

            /* DB 관리 버튼 그룹 */
            .anki-db-buttons {
                display: flex;
                flex-direction: column;
                gap: 15px;
                margin: 20px 0;
            }

            .anki-db-section {
                margin-bottom: 30px;
                padding: 20px;
                background: rgba(255, 255, 255, 0.05);
                border-radius: 15px;
                border: 1px solid rgba(0, 245, 255, 0.2);
            }

            .anki-db-section-title {
                color: #00f5ff;
                font-size: 18px;
                font-weight: bold;
                margin-bottom: 15px;
                text-align: center;
                text-shadow: 0 0 8px rgba(0, 245, 255, 0.5);
            }

            /* =================== 주관식 Q&A 카드 스타일 =================== */
            
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

    // Basic Card 생성
    async createBasicCard() {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!activeView) return;

        const editor = activeView.editor;
        const template = `\`\`\`anki
단어: [일본어 단어]
루비: [히라가나 읽기]
의미: [한국어 의미]
한자: [한자 표기]
품사: [명사/동사/형용사 등]
예문: [예문]
레벨: [1-5]
\`\`\`

위 정보를 입력하고 Live Preview 모드에서 확인하세요!
`;
        editor.replaceSelection(template);
    }

    // Cloze Card 생성
    async createClozeCard() {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!activeView) return;

        const editor = activeView.editor;
        const template = `\`\`\`anki
단어: {{c1::빈칸에 들어갈 내용::힌트}}
의미: 문장의 의미 설명
한자: 관련 한자
품사: 품사 정보
예문: 예문
레벨: 3
\`\`\`

클로즈 카드: {{c1::}} 문법을 사용하여 빈칸을 만드세요!
`;
        editor.replaceSelection(template);
    }

    // Reverse Card 생성
    async createReverseCard() {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!activeView) return;

        const editor = activeView.editor;
        const template = `\`\`\`anki
단어: [한국어]
의미: [일본어]
한자: [한자]
품사: [품사]
예문: [양방향 예문]
레벨: 3
type: reverse
\`\`\`

양방향 카드: 한국어 ↔ 일본어 모두 학습!
`;
        editor.replaceSelection(template);
    }

    // 현재 뷰에서 Anki 카드 처리
    async processCurrentView(view) {
        if (!view || !view.file) return;
        
        setTimeout(() => {
            this.processAnkiCards(view.file);
        }, 100);
    }

    // Anki 코드 블록 처리 (핵심 함수)
    processAnkiCodeBlock(source, el, ctx) {
        try {
            // 코드 블록 내용 파싱
            const data = this.parseAnkiBlock(source);
            if (!data) return;

            // 카드 컨테이너 생성
            el.empty();
            el.addClass('anki-card-container');

            // 앞면 렌더링
            const frontCard = this.ankiParser.renderCard(this.frontTemplate, data, false);
            const frontElement = el.createDiv('anki-front-side');
            frontElement.innerHTML = frontCard.html;

            // 뒷면 렌더링 (숨김)
            const backCard = this.ankiParser.renderCard(this.backTemplate, data, true);
            const backElement = el.createDiv('anki-back-side');
            backElement.innerHTML = backCard.html;
            backElement.style.display = 'none';

            // 컨트롤 버튼 추가
            this.addCardControls(el, frontElement, backElement, data);

            // 타이머 초기화 (설정이 활성화된 경우)
            if (this.ankiSettings.get('autoGenerateTimer')) {
                setTimeout(() => {
                    this.initTimer(el);
                }, 500);
            }

            // 힌트 버튼 이벤트 추가
            this.addHintEvents(frontElement);

            console.log('Anki card rendered successfully');
        } catch (error) {
            console.error('Error processing Anki code block:', error);
            el.createEl('div', {
                text: `❌ Anki 카드 렌더링 오류: ${error.message}`,
                cls: 'anki-error'
            });
        }
    }

    // 주관식 Q&A 코드블록 처리
    processQACodeBlock(source, el, ctx) {
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
                timerContainer = this.createQATimer(el, parseInt(data.타이머));
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
                        timerContainer = this.createQATimer(el, parseInt(data.타이머));
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

    // Q&A 타이머 생성
    createQATimer(container, duration) {
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

    // Anki 카드 처리 메인 함수 (기존 로직 유지)
    async processAnkiCards(file) {
        if (!file) {
            return;
        }
        
        const content = await this.app.vault.read(file);
        
        // Anki 카드 마크다운 블록 찾기
        const ankiBlockRegex = /```anki\n([\s\S]*?)\n```/g;
        let match;
        
        while ((match = ankiBlockRegex.exec(content)) !== null) {
            const ankiData = this.parseAnkiBlock(match[1]);
            if (ankiData) {
                this.renderAnkiCard(ankiData, file);
            }
        }
    }

    // Anki 블록 파싱
    parseAnkiBlock(blockContent) {
        try {
            const lines = blockContent.trim().split('\n');
            const data = {};
            
            for (const line of lines) {
                const [key, ...valueParts] = line.split(':');
                if (key && valueParts.length > 0) {
                    data[key.trim()] = valueParts.join(':').trim();
                }
            }
            
            return data;
        } catch (error) {
            console.error('Error parsing Anki block:', error);
            return null;
        }
    }

    // Anki 카드 렌더링 (단순화된 버전)
    renderAnkiCard(data, file) {
        console.log('Rendering Anki card with data:', data);
        // 이 함수는 코드 블록 프로세서에 의해 대체됨
    }

    // 카드 컨트롤 버튼 추가
    addCardControls(container, frontElement, backElement, data) {
        const controlsDiv = container.createDiv('anki-controls');
        
        // 답안 보기 버튼
        const showAnswerBtn = controlsDiv.createEl('button', {
            text: '답안 보기',
            cls: 'anki-btn show-answer'
        });
        
        showAnswerBtn.addEventListener('click', () => {
            frontElement.style.display = 'none';
            backElement.style.display = 'block';
            controlsDiv.style.display = 'none';
            
            // 타이머 중지
            if (this.currentTimer) {
                this.stopTimer();
            }
        });

        // 앞면으로 돌아가기 버튼 (뒷면에서 사용)
        const backButton = backElement.querySelector('.anki-front-button');
        if (backButton) {
            backButton.addEventListener('click', () => {
                backElement.style.display = 'none';
                frontElement.style.display = 'block';
                controlsDiv.style.display = 'flex';
                
                // 타이머 재시작
                if (this.ankiSettings.get('autoGenerateTimer')) {
                    this.initTimer(container);
                }
            });
        }
    }

    // 힌트 버튼 이벤트
    addHintEvents(frontElement) {
        const hintArea = frontElement.querySelector('.anki-hint-area');
        const hiddenContents = frontElement.querySelectorAll('.anki-hidden-content');
        const hintText = frontElement.querySelector('.anki-hint-text');
        
        if (!hintArea || !hiddenContents.length) return;

        let isPressed = false;
        let pressTimeout;
        const isMobile = window.innerWidth <= 768;

        const startPress = () => {
            if (pressTimeout) clearTimeout(pressTimeout);
            
            isPressed = true;
            hintArea.classList.add('pressing');
            
            const delay = isMobile ? 250 : 350;
            
            pressTimeout = setTimeout(() => {
                if (isPressed) {
                    hiddenContents.forEach(el => el.classList.add('show'));
                    hintArea.classList.add('show-hints');
                    if (hintText) hintText.textContent = 'ACTIVE';
                    
                    if (isMobile && 'vibrate' in navigator) {
                        navigator.vibrate([100, 50, 100]);
                    }
                }
            }, delay);
        };

        const endPress = () => {
            isPressed = false;
            if (pressTimeout) clearTimeout(pressTimeout);
            
            hintArea.classList.remove('pressing');
            hiddenContents.forEach(el => el.classList.remove('show'));
            hintArea.classList.remove('show-hints');
            if (hintText) hintText.textContent = 'HINT';
        };

        if (isMobile) {
            hintArea.addEventListener('touchstart', startPress, { passive: false });
            hintArea.addEventListener('touchend', endPress, { passive: true });
            hintArea.addEventListener('touchcancel', endPress, { passive: true });
        } else {
            hintArea.addEventListener('mousedown', startPress);
            hintArea.addEventListener('mouseup', endPress);
            hintArea.addEventListener('mouseleave', endPress);
        }
    }

    // 타이머 초기화 (카드 내부에 위치)
    initTimer(container) {
        // 기존 타이머 정리
        if (this.currentTimer) {
            this.stopTimer();
        }

        const timerDuration = this.ankiSettings.get('defaultTimerDuration') || 30;
        
        // 타이머 UI를 카드 내부에 생성
        const timerContainer = container.createDiv('anki-timer-container-local');
        timerContainer.innerHTML = `
            <div class="anki-timer-progress-local">
                <div class="anki-timer-fill-local"></div>
            </div>
            <div class="anki-timer-text-local">${timerDuration}s</div>
        `;
        
        // 카드 상단에 배치
        container.insertBefore(timerContainer, container.firstChild);

        const progressFill = timerContainer.querySelector('.anki-timer-fill-local');
        const timerText = timerContainer.querySelector('.anki-timer-text-local');
        
        // 타이머 시작
        const startTime = Date.now();
        this.currentTimer = {
            startTime: startTime,
            duration: timerDuration,
            container: timerContainer,
            interval: null
        };

        const updateTimer = () => {
            const elapsed = (Date.now() - startTime) / 1000;
            const remaining = Math.max(0, timerDuration - elapsed);
            
            timerText.textContent = Math.ceil(remaining) + 's';
            
            const percent = (remaining / timerDuration) * 100;
            progressFill.style.width = percent + '%';
            
            if (remaining <= 0) {
                timerText.textContent = 'TIME!';
                progressFill.style.background = '#e74c3c';
                timerContainer.classList.add('timer-expired');
                this.stopTimer();
                
                // 모바일 진동
                if (window.innerWidth <= 768 && 'vibrate' in navigator) {
                    navigator.vibrate([300, 200, 300, 200, 300]);
                }
                return;
            }
            
            // 경고 상태
            if (remaining <= 3) {
                timerContainer.classList.add('timer-warning');
                if (window.innerWidth <= 768 && 'vibrate' in navigator) {
                    navigator.vibrate([100, 100, 100]);
                }
            }
        };

        updateTimer();
        this.currentTimer.interval = setInterval(updateTimer, 100);
    }

    // 타이머 중지
    stopTimer() {
        if (this.currentTimer) {
            if (this.currentTimer.interval) {
                clearInterval(this.currentTimer.interval);
            }
            if (this.currentTimer.container) {
                this.currentTimer.container.remove();
            }
            this.currentTimer = null;
        }
    }

    // Anki 카드 토글
    toggleAnkiCards() {
        const ankiCards = document.querySelectorAll('.anki-card-container');
        ankiCards.forEach(card => {
            card.style.display = card.style.display === 'none' ? 'block' : 'none';
        });
    }

    // =================== 주관식 Q&A 모달 ===================

    // 주관식 Q&A 모달 열기
    openSubjectiveQAModal() {
        // 오버레이 생성
        const overlay = document.createElement('div');
        overlay.className = 'anki-modal-overlay';
        
        // 모달 생성
        const modal = document.createElement('div');
        modal.className = 'anki-subjective-modal';
        
        modal.innerHTML = `
            <button class="anki-modal-close">&times;</button>
            <div class="anki-subjective-header">
                <h2>📝 주관식 Q&A 카드 만들기</h2>
                <p>문제를 읽고 답을 확인하는 학습 카드를 생성합니다</p>
            </div>
            
            <div class="anki-subjective-form">
                <div class="anki-form-group">
                    <label>📋 문제 *</label>
                    <textarea 
                        id="qa-question" 
                        class="anki-form-textarea" 
                        placeholder="예: 일본어로 '안녕하세요'는?"
                        rows="4"
                    ></textarea>
                </div>
                
                <div class="anki-form-group">
                    <label>✅ 답 *</label>
                    <textarea 
                        id="qa-answer" 
                        class="anki-form-textarea" 
                        placeholder="예: こんにちは"
                        rows="3"
                    ></textarea>
                </div>
                
                <div class="anki-form-group">
                    <label>💡 해설 (선택)</label>
                    <textarea 
                        id="qa-explanation" 
                        class="anki-form-textarea" 
                        placeholder="문제에 대한 추가 설명을 입력하세요"
                        rows="3"
                    ></textarea>
                </div>
                
                <div class="anki-form-row">
                    <div class="anki-form-group">
                        <label>📚 과목</label>
                        <input 
                            type="text" 
                            id="qa-subject" 
                            class="anki-form-input" 
                            placeholder="예: 일본어"
                            value="일본어"
                        />
                    </div>
                    
                    <div class="anki-form-group">
                        <label>⭐ 난이도 (1-5)</label>
                        <select id="qa-level" class="anki-form-select">
                            <option value="1">⭐ 1단계 (쉬움)</option>
                            <option value="2">⭐⭐ 2단계</option>
                            <option value="3" selected>⭐⭐⭐ 3단계 (보통)</option>
                            <option value="4">⭐⭐⭐⭐ 4단계</option>
                            <option value="5">⭐⭐⭐⭐⭐ 5단계 (어려움)</option>
                        </select>
                    </div>
                </div>
                
                <div class="anki-form-row">
                    <div class="anki-form-group">
                        <label>🔑 키워드</label>
                        <input 
                            type="text" 
                            id="qa-keywords" 
                            class="anki-form-input" 
                            placeholder="쉼표로 구분 (예: 인사, 기본표현)"
                        />
                    </div>
                    
                    <div class="anki-form-group">
                        <label>⏱️ 타이머 (초)</label>
                        <input 
                            type="number" 
                            id="qa-timer" 
                            class="anki-form-input" 
                            placeholder="제한 시간 (선택)"
                            min="5"
                            max="300"
                            value="30"
                        />
                    </div>
                </div>
                
                <div class="anki-form-actions">
                    <button class="anki-btn anki-btn-secondary" id="qa-preview-btn">
                        👁️ 미리보기
                    </button>
                    <button class="anki-btn anki-btn-primary" id="qa-create-btn">
                        ✨ 카드 생성
                    </button>
                </div>
            </div>
            
            <div class="anki-subjective-preview" id="qa-preview-area" style="display: none;">
                <h3>📺 미리보기</h3>
                <div id="qa-preview-content"></div>
            </div>
        `;
        
        // 모달 추가
        document.body.appendChild(overlay);
        document.body.appendChild(modal);
        
        // 이벤트 리스너
        const closeBtn = modal.querySelector('.anki-modal-close');
        const previewBtn = modal.querySelector('#qa-preview-btn');
        const createBtn = modal.querySelector('#qa-create-btn');
        
        // 닫기 버튼
        const closeModal = () => {
            document.body.removeChild(overlay);
            document.body.removeChild(modal);
        };
        
        closeBtn.addEventListener('click', closeModal);
        overlay.addEventListener('click', closeModal);
        
        // 미리보기 버튼
        previewBtn.addEventListener('click', () => {
            this.previewSubjectiveQA(modal);
        });
        
        // 생성 버튼
        createBtn.addEventListener('click', async () => {
            await this.createSubjectiveQACard(modal);
            closeModal();
        });
        
        // CSS 스타일 추가 (한 번만)
        if (!document.getElementById('anki-subjective-qa-styles')) {
            this.addSubjectiveQAStyles();
        }
    }

    // 주관식 Q&A 미리보기
    previewSubjectiveQA(modal) {
        const question = modal.querySelector('#qa-question').value.trim();
        const answer = modal.querySelector('#qa-answer').value.trim();
        
        if (!question || !answer) {
            new Notice('⚠️ 문제와 답은 필수 항목입니다!');
            return;
        }
        
        const explanation = modal.querySelector('#qa-explanation').value.trim();
        const subject = modal.querySelector('#qa-subject').value.trim() || '미분류';
        const level = modal.querySelector('#qa-level').value;
        const keywords = modal.querySelector('#qa-keywords').value.trim();
        const timer = modal.querySelector('#qa-timer').value;
        
        // 코드 블록 생성
        let codeBlock = '```qa\n';
        codeBlock += `문제: ${question}\n`;
        codeBlock += `답: ${answer}\n`;
        if (explanation) codeBlock += `해설: ${explanation}\n`;
        codeBlock += `과목: ${subject}\n`;
        codeBlock += `난이도: ${level}\n`;
        if (keywords) codeBlock += `키워드: ${keywords}\n`;
        if (timer) codeBlock += `타이머: ${timer}\n`;
        codeBlock += '```';
        
        // 미리보기 영역 표시
        const previewArea = modal.querySelector('#qa-preview-area');
        const previewContent = modal.querySelector('#qa-preview-content');
        
        previewContent.innerHTML = `<pre style="background: #1e1e1e; color: #d4d4d4; padding: 20px; border-radius: 8px; overflow-x: auto; font-family: 'Consolas', 'Monaco', monospace; font-size: 14px; line-height: 1.6;">${codeBlock}</pre>`;
        previewArea.style.display = 'block';
        
        // 스크롤
        previewArea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        
        new Notice('✅ 미리보기가 생성되었습니다!');
    }

    // 주관식 Q&A 카드 생성
    async createSubjectiveQACard(modal) {
        const question = modal.querySelector('#qa-question').value.trim();
        const answer = modal.querySelector('#qa-answer').value.trim();
        
        if (!question || !answer) {
            new Notice('⚠️ 문제와 답은 필수 항목입니다!');
            return;
        }
        
        const explanation = modal.querySelector('#qa-explanation').value.trim();
        const subject = modal.querySelector('#qa-subject').value.trim() || '미분류';
        const level = modal.querySelector('#qa-level').value;
        const keywords = modal.querySelector('#qa-keywords').value.trim();
        const timer = modal.querySelector('#qa-timer').value;
        
        // 코드 블록 생성
        let codeBlock = '```qa\n';
        codeBlock += `문제: ${question}\n`;
        codeBlock += `답: ${answer}\n`;
        if (explanation) codeBlock += `해설: ${explanation}\n`;
        codeBlock += `과목: ${subject}\n`;
        codeBlock += `난이도: ${level}\n`;
        if (keywords) codeBlock += `키워드: ${keywords}\n`;
        if (timer) codeBlock += `타이머: ${timer}\n`;
        codeBlock += '```\n\n';
        
        // 현재 활성 에디터에 삽입
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (activeView) {
            const editor = activeView.editor;
            const cursor = editor.getCursor();
            editor.replaceRange(codeBlock, cursor);
            
            new Notice('✅ 주관식 Q&A 카드가 생성되었습니다!');
        } else {
            // 에디터가 없으면 클립보드에 복사
            navigator.clipboard.writeText(codeBlock);
            new Notice('📋 코드 블록이 클립보드에 복사되었습니다!');
        }
    }

    // 주관식 Q&A 스타일 추가
    addSubjectiveQAStyles() {
        const style = document.createElement('style');
        style.id = 'anki-subjective-qa-styles';
        style.textContent = `
            /* 주관식 Q&A 모달 스타일 */
            .anki-subjective-modal {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                border-radius: 24px;
                padding: 32px;
                max-width: 800px;
                width: 90vw;
                max-height: 90vh;
                overflow-y: auto;
                z-index: 10001;
                box-shadow: 
                    0 20px 60px rgba(0, 0, 0, 0.5),
                    0 0 100px rgba(102, 126, 234, 0.3);
                color: #e2e8f0;
            }

            .anki-subjective-header {
                text-align: center;
                margin-bottom: 32px;
                padding-bottom: 24px;
                border-bottom: 2px solid rgba(102, 126, 234, 0.3);
            }

            .anki-subjective-header h2 {
                color: #fff;
                margin: 0 0 12px 0;
                font-size: 28px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
            }

            .anki-subjective-header p {
                color: #94a3b8;
                margin: 0;
                font-size: 15px;
            }

            .anki-subjective-form {
                margin-bottom: 24px;
            }

            .anki-form-group {
                margin-bottom: 24px;
                flex: 1;
            }

            .anki-form-group label {
                display: block;
                color: #cbd5e1;
                font-weight: 600;
                margin-bottom: 10px;
                font-size: 15px;
            }

            .anki-form-input,
            .anki-form-textarea,
            .anki-form-select {
                width: 100%;
                background: rgba(255, 255, 255, 0.05);
                border: 2px solid rgba(102, 126, 234, 0.3);
                border-radius: 12px;
                padding: 14px 16px;
                color: #e2e8f0;
                font-size: 15px;
                font-family: inherit;
                transition: all 0.3s ease;
            }

            .anki-form-textarea {
                resize: vertical;
                min-height: 80px;
                font-family: inherit;
                line-height: 1.6;
            }

            .anki-form-input:focus,
            .anki-form-textarea:focus,
            .anki-form-select:focus {
                outline: none;
                border-color: #667eea;
                background: rgba(255, 255, 255, 0.08);
                box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.1);
            }

            .anki-form-row {
                display: flex;
                gap: 20px;
                margin-bottom: 24px;
            }

            .anki-form-row .anki-form-group {
                margin-bottom: 0;
            }

            .anki-form-actions {
                display: flex;
                gap: 16px;
                justify-content: flex-end;
                margin-top: 32px;
                padding-top: 24px;
                border-top: 2px solid rgba(102, 126, 234, 0.2);
            }

            .anki-btn {
                padding: 14px 28px;
                border-radius: 12px;
                border: none;
                font-weight: 600;
                font-size: 15px;
                cursor: pointer;
                transition: all 0.3s ease;
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .anki-btn-primary {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
            }

            .anki-btn-primary:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 16px rgba(102, 126, 234, 0.5);
            }

            .anki-btn-secondary {
                background: rgba(255, 255, 255, 0.1);
                color: #cbd5e1;
                border: 2px solid rgba(102, 126, 234, 0.3);
            }

            .anki-btn-secondary:hover {
                background: rgba(255, 255, 255, 0.15);
                border-color: #667eea;
            }

            .anki-subjective-preview {
                margin-top: 32px;
                padding-top: 24px;
                border-top: 2px solid rgba(102, 126, 234, 0.2);
            }

            .anki-subjective-preview h3 {
                color: #cbd5e1;
                margin: 0 0 16px 0;
                font-size: 18px;
            }

            /* 모바일 최적화 */
            @media (max-width: 768px) {
                .anki-subjective-modal {
                    width: 95vw;
                    padding: 24px 20px;
                    border-radius: 16px;
                }

                .anki-subjective-header h2 {
                    font-size: 24px;
                }

                .anki-form-row {
                    flex-direction: column;
                    gap: 0;
                }

                .anki-form-row .anki-form-group {
                    margin-bottom: 24px;
                }

                .anki-form-actions {
                    flex-direction: column;
                }

                .anki-btn {
                    width: 100%;
                    justify-content: center;
                }
            }

            /* 스크롤바 스타일 */
            .anki-subjective-modal::-webkit-scrollbar {
                width: 10px;
            }

            .anki-subjective-modal::-webkit-scrollbar-track {
                background: rgba(0, 0, 0, 0.2);
                border-radius: 10px;
            }

            .anki-subjective-modal::-webkit-scrollbar-thumb {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border-radius: 10px;
            }

            .anki-subjective-modal::-webkit-scrollbar-thumb:hover {
                background: linear-gradient(135deg, #764ba2 0%, #667eea 100%);
            }
        `;
        document.head.appendChild(style);
    }

    // =================== DB 관리 시스템 ===================

    // DB 관리 모달 열기
    openDBManager() {
        // 오버레이 생성
        const overlay = document.createElement('div');
        overlay.className = 'anki-modal-overlay';
        
        // 모달 생성
        const modal = document.createElement('div');
        modal.className = 'anki-db-modal';
        
        modal.innerHTML = `
            <button class="anki-modal-close">&times;</button>
            <h2>🗂️ Anki Cards Database Manager</h2>
            
            <div class="anki-db-section">
                <div class="anki-db-section-title">📁 폴더 구조 관리</div>
                <div class="anki-db-buttons">
                    <button class="anki-db-button success" data-action="create-folders">
                        📂 Anki 폴더 구조 생성
                    </button>
                    <button class="anki-db-button" data-action="organize-difficulty">
                        ⭐ 난이도별 카드 정리
                    </button>
                </div>
            </div>
            
            <div class="anki-db-section">
                <div class="anki-db-section-title">📊 통계 및 분석</div>
                <div class="anki-db-buttons">
                    <button class="anki-db-button" data-action="view-statistics">
                        📈 통계 보기
                    </button>
                    <button class="anki-db-button" data-action="detailed-stats">
                        📋 상세 통계 모달
                    </button>
                </div>
            </div>
            
            <div class="anki-db-section">
                <div class="anki-db-section-title">💾 백업 및 내보내기</div>
                <div class="anki-db-buttons">
                    <button class="anki-db-button" data-action="export-database">
                        📦 데이터베이스 내보내기
                    </button>
                    <button class="anki-db-button danger" data-action="backup-all">
                        🔄 전체 백업 생성
                    </button>
                </div>
            </div>
        `;
        
        // 모달 추가
        document.body.appendChild(overlay);
        document.body.appendChild(modal);
        
        // 이벤트 리스너
        const closeBtn = modal.querySelector('.anki-modal-close');
        const buttons = modal.querySelectorAll('.anki-db-button');
        
        // 닫기 버튼
        closeBtn.addEventListener('click', () => {
            document.body.removeChild(overlay);
            document.body.removeChild(modal);
        });
        
        // 오버레이 클릭시 닫기
        overlay.addEventListener('click', () => {
            document.body.removeChild(overlay);
            document.body.removeChild(modal);
        });
        
        // 버튼 이벤트
        buttons.forEach(button => {
            button.addEventListener('click', async () => {
                const action = button.getAttribute('data-action');
                
                switch (action) {
                    case 'create-folders':
                        await this.createAnkiFolderStructure();
                        break;
                    case 'organize-difficulty':
                        await this.organizeCardsByDifficulty();
                        break;
                    case 'view-statistics':
                        await this.viewAnkiStatistics();
                        break;
                    case 'detailed-stats':
                        await this.showDetailedStatistics();
                        break;
                    case 'export-database':
                        await this.exportAnkiDatabase();
                        break;
                    case 'backup-all':
                        await this.createFullBackup();
                        break;
                }
            });
        });
    }

    // 상세 통계 모달
    async showDetailedStatistics() {
        try {
            const ankiFiles = this.app.vault.getMarkdownFiles()
                .filter(file => file.path.includes('Anki-Cards-DB'));

            const stats = {
                total: 0,
                bySubject: {},
                byLevel: {},
                byStatus: {
                    '신규카드': 0,
                    '학습중': 0,
                    '복습중': 0,
                    '완료': 0
                },
                recentCards: []
            };

            for (const file of ankiFiles) {
                const content = await this.app.vault.read(file);
                const ankiData = this.extractAnkiDataFromFile(content);
                
                if (ankiData) {
                    stats.total++;
                    
                    // 과목별 통계
                    const subject = ankiData.과목 || '미분류';
                    stats.bySubject[subject] = (stats.bySubject[subject] || 0) + 1;
                    
                    // 레벨별 통계
                    const level = ankiData.레벨 || '미설정';
                    stats.byLevel[level] = (stats.byLevel[level] || 0) + 1;
                    
                    // 상태별 통계
                    if (file.path.includes('01-신규카드')) stats.byStatus['신규카드']++;
                    else if (file.path.includes('02-학습중')) stats.byStatus['학습중']++;
                    else if (file.path.includes('03-복습중')) stats.byStatus['복습중']++;
                    else if (file.path.includes('04-완료')) stats.byStatus['완료']++;
                    
                    // 최근 카드 (최근 7일)
                    const now = Date.now();
                    const weekAgo = now - (7 * 24 * 60 * 60 * 1000);
                    if (file.stat.ctime > weekAgo) {
                        stats.recentCards.push({
                            name: file.name,
                            subject: subject,
                            level: level,
                            created: new Date(file.stat.ctime).toLocaleDateString()
                        });
                    }
                }
            }

            // 상세 통계 모달 표시
            this.displayDetailedStatsModal(stats);
            
        } catch (error) {
            console.error('Detailed statistics error:', error);
            new Notice('❌ 상세 통계 생성 중 오류가 발생했습니다.');
        }
    }

    // 상세 통계 모달 표시
    displayDetailedStatsModal(stats) {
        const overlay = document.createElement('div');
        overlay.className = 'anki-modal-overlay';
        
        const modal = document.createElement('div');
        modal.className = 'anki-db-modal';
        modal.style.maxWidth = '90vw';
        modal.style.minWidth = '700px';
        
        // 과목별 통계 HTML
        const subjectStats = Object.entries(stats.bySubject)
            .map(([subject, count]) => 
                `<div class="anki-stat-card">
                    <div class="anki-stat-number">${count}</div>
                    <div class="anki-stat-label">${subject}</div>
                </div>`
            ).join('');
        
        // 레벨별 통계 HTML
        const levelStats = Object.entries(stats.byLevel)
            .map(([level, count]) => 
                `<div class="anki-stat-card">
                    <div class="anki-stat-number">${count}</div>
                    <div class="anki-stat-label">레벨 ${level}</div>
                </div>`
            ).join('');
        
        // 최근 카드 HTML
        const recentCards = stats.recentCards.slice(0, 10)
            .map(card => 
                `<div style="padding: 8px; border-bottom: 1px solid rgba(0,245,255,0.2);">
                    <strong>${card.name}</strong> - ${card.subject} (레벨 ${card.level}) - ${card.created}
                </div>`
            ).join('');
        
        modal.innerHTML = `
            <button class="anki-modal-close">&times;</button>
            <h2>📊 상세 통계 리포트</h2>
            
            <div class="anki-db-section">
                <div class="anki-db-section-title">📈 전체 현황</div>
                <div class="anki-stats-grid">
                    <div class="anki-stat-card">
                        <div class="anki-stat-number">${stats.total}</div>
                        <div class="anki-stat-label">총 카드 수</div>
                    </div>
                    <div class="anki-stat-card">
                        <div class="anki-stat-number">${stats.byStatus['신규카드']}</div>
                        <div class="anki-stat-label">신규 카드</div>
                    </div>
                    <div class="anki-stat-card">
                        <div class="anki-stat-number">${stats.byStatus['학습중']}</div>
                        <div class="anki-stat-label">학습 중</div>
                    </div>
                    <div class="anki-stat-card">
                        <div class="anki-stat-number">${stats.byStatus['완료']}</div>
                        <div class="anki-stat-label">완료</div>
                    </div>
                </div>
            </div>
            
            <div class="anki-db-section">
                <div class="anki-db-section-title">📚 과목별 현황</div>
                <div class="anki-stats-grid">
                    ${subjectStats}
                </div>
            </div>
            
            <div class="anki-db-section">
                <div class="anki-db-section-title">⭐ 난이도별 현황</div>
                <div class="anki-stats-grid">
                    ${levelStats}
                </div>
            </div>
            
            <div class="anki-db-section">
                <div class="anki-db-section-title">🆕 최근 7일 신규 카드</div>
                <div style="max-height: 200px; overflow-y: auto; background: rgba(0,0,0,0.3); border-radius: 10px; padding: 10px;">
                    ${recentCards || '<div style="text-align: center; color: #888;">최근 생성된 카드가 없습니다.</div>'}
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        document.body.appendChild(modal);
        
        // 닫기 이벤트
        const closeBtn = modal.querySelector('.anki-modal-close');
        closeBtn.addEventListener('click', () => {
            document.body.removeChild(overlay);
            document.body.removeChild(modal);
        });
        
        overlay.addEventListener('click', () => {
            document.body.removeChild(overlay);
            document.body.removeChild(modal);
        });
    }

    // 전체 백업 생성
    async createFullBackup() {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupPath = `Anki-Cards-DB/백업/full-backup-${timestamp}`;
            
            // 백업 폴더 생성
            await this.app.vault.createFolder(backupPath);
            
            // 모든 Anki 파일 복사
            const ankiFiles = this.app.vault.getMarkdownFiles()
                .filter(file => file.path.includes('Anki-Cards-DB') && !file.path.includes('백업'));
            
            let copiedCount = 0;
            for (const file of ankiFiles) {
                const content = await this.app.vault.read(file);
                const newPath = `${backupPath}/${file.name}`;
                await this.app.vault.create(newPath, content);
                copiedCount++;
            }
            
            // 백업 정보 파일 생성
            const backupInfo = {
                timestamp: new Date().toISOString(),
                totalFiles: copiedCount,
                backupPath: backupPath,
                version: '1.0.0'
            };
            
            await this.app.vault.create(
                `${backupPath}/backup-info.json`, 
                JSON.stringify(backupInfo, null, 2)
            );
            
            new Notice(`✅ ${copiedCount}개 파일이 성공적으로 백업되었습니다!`);
            
        } catch (error) {
            console.error('Backup error:', error);
            new Notice('❌ 백업 생성 중 오류가 발생했습니다.');
        }
    }

    // Anki 폴더 구조 생성
    async createAnkiFolderStructure() {
        try {
            const basePath = 'Anki-Cards-DB';
            const folders = [
                `${basePath}/01-신규카드`,
                `${basePath}/02-학습중`,
                `${basePath}/03-복습중`,
                `${basePath}/04-완료`,
                `${basePath}/난이도별/⭐-초급`,
                `${basePath}/난이도별/⭐⭐-초중급`,
                `${basePath}/난이도별/⭐⭐⭐-중급`,
                `${basePath}/난이도별/⭐⭐⭐⭐-중상급`,
                `${basePath}/난이도별/⭐⭐⭐⭐⭐-고급`,
                `${basePath}/과목별/일본어`,
                `${basePath}/과목별/영어`,
                `${basePath}/과목별/중국어`,
                `${basePath}/과목별/수학`,
                `${basePath}/과목별/과학`,
                `${basePath}/템플릿`,
                `${basePath}/통계`,
                `${basePath}/백업`
            ];

            for (const folder of folders) {
                const folderExists = this.app.vault.getAbstractFileByPath(folder);
                if (!folderExists) {
                    await this.app.vault.createFolder(folder);
                }
            }

            // 기본 템플릿 파일들 생성
            await this.createDefaultTemplates(basePath);
            
            // 통계 파일 생성
            await this.createStatisticsFile(basePath);

            new Notice('✅ Anki Cards 폴더 구조가 성공적으로 생성되었습니다!');
            
        } catch (error) {
            console.error('Error creating folder structure:', error);
            new Notice('❌ 폴더 구조 생성 중 오류가 발생했습니다.');
        }
    }

    // 기본 템플릿 생성
    async createDefaultTemplates(basePath) {
        const templates = {
            'Basic-Card-Template.md': `# 📝 Basic Card Template

\`\`\`anki
단어: [일본어/영어 단어]
루비: [읽기/발음]
의미: [한국어 의미]
한자: [한자 표기]
품사: [명사/동사/형용사 등]
예문: [예문]
레벨: [1-5]
과목: [일본어/영어 등]
생성일: {{date}}
\`\`\`

## 📚 사용법
1. 위 템플릿을 복사
2. 각 필드에 내용 입력
3. Live Preview 모드에서 확인
`,

            'Cloze-Card-Template.md': `# 🧩 Cloze Card Template

\`\`\`anki
단어: {{c1::답::힌트}}을 포함한 문장
의미: 문장의 전체 의미
한자: 관련 한자
품사: 품사 정보
예문: 완전한 예문
레벨: [1-5]
과목: [과목명]
생성일: {{date}}
\`\`\`

## 📚 사용법
1. {{c1::답::힌트}} 형식으로 빈칸 생성
2. c1, c2, c3... 순서로 여러 빈칸 가능
3. Live Preview 모드에서 확인
`,

            'Reverse-Card-Template.md': `# 🔄 Reverse Card Template

\`\`\`anki
단어: [한국어 단어]
의미: [외국어 단어]
한자: [한자/원형]
품사: [품사]
예문: [양방향 예문]
레벨: [1-5]
과목: [과목명]
type: reverse
생성일: {{date}}
\`\`\`

## 📚 사용법
1. 한국어 → 외국어 양방향 학습
2. type: reverse 필수 입력
3. Live Preview 모드에서 확인
`
        };

        for (const [filename, content] of Object.entries(templates)) {
            const filePath = `${basePath}/템플릿/${filename}`;
            const fileExists = this.app.vault.getAbstractFileByPath(filePath);
            if (!fileExists) {
                await this.app.vault.create(filePath, content);
            }
        }
    }

    // 통계 파일 생성
    async createStatisticsFile(basePath) {
        const statsContent = `# 📊 Anki Cards 통계

## 📈 전체 현황
- 총 카드 수: 0
- 신규 카드: 0
- 학습 중: 0
- 복습 중: 0
- 완료: 0

## 📚 과목별 현황
- 일본어: 0
- 영어: 0
- 중국어: 0
- 수학: 0
- 과학: 0

## ⭐ 난이도별 현황
- ⭐ 초급: 0
- ⭐⭐ 초중급: 0
- ⭐⭐⭐ 중급: 0
- ⭐⭐⭐⭐ 중상급: 0
- ⭐⭐⭐⭐⭐ 고급: 0

---
*마지막 업데이트: {{date}}*
`;

        const statsPath = `${basePath}/통계/Anki-Statistics.md`;
        const statsExists = this.app.vault.getAbstractFileByPath(statsPath);
        if (!statsExists) {
            await this.app.vault.create(statsPath, statsContent);
        }
    }

    // Anki 데이터베이스 내보내기
    async exportAnkiDatabase() {
        try {
            const ankiFiles = this.app.vault.getMarkdownFiles()
                .filter(file => file.path.includes('Anki-Cards-DB'));

            const database = [];
            
            for (const file of ankiFiles) {
                const content = await this.app.vault.read(file);
                const ankiData = this.extractAnkiDataFromFile(content);
                
                if (ankiData) {
                    database.push({
                        filename: file.name,
                        path: file.path,
                        created: file.stat.ctime,
                        modified: file.stat.mtime,
                        data: ankiData
                    });
                }
            }

            const exportContent = {
                exportDate: new Date().toISOString(),
                totalCards: database.length,
                cards: database
            };

            const exportPath = `Anki-Cards-DB/백업/anki-export-${new Date().toISOString().split('T')[0]}.json`;
            await this.app.vault.create(exportPath, JSON.stringify(exportContent, null, 2));
            
            new Notice(`✅ ${database.length}개의 카드가 성공적으로 내보내어졌습니다!`);
            
        } catch (error) {
            console.error('Export error:', error);
            new Notice('❌ 데이터베이스 내보내기 중 오류가 발생했습니다.');
        }
    }

    // 파일에서 Anki 데이터 추출
    extractAnkiDataFromFile(content) {
        const ankiBlockRegex = /```anki\n([\s\S]*?)\n```/;
        const match = content.match(ankiBlockRegex);
        
        if (match) {
            return this.parseAnkiBlock(match[1]);
        }
        return null;
    }

    // Anki 통계 보기
    async viewAnkiStatistics() {
        try {
            const ankiFiles = this.app.vault.getMarkdownFiles()
                .filter(file => file.path.includes('Anki-Cards-DB'));

            const stats = {
                total: 0,
                bySubject: {},
                byLevel: {},
                byStatus: {
                    '신규카드': 0,
                    '학습중': 0,
                    '복습중': 0,
                    '완료': 0
                }
            };

            for (const file of ankiFiles) {
                const content = await this.app.vault.read(file);
                const ankiData = this.extractAnkiDataFromFile(content);
                
                if (ankiData) {
                    stats.total++;
                    
                    // 과목별 통계
                    const subject = ankiData.과목 || '미분류';
                    stats.bySubject[subject] = (stats.bySubject[subject] || 0) + 1;
                    
                    // 레벨별 통계
                    const level = ankiData.레벨 || '미설정';
                    stats.byLevel[level] = (stats.byLevel[level] || 0) + 1;
                    
                    // 상태별 통계 (폴더 위치로 판단)
                    if (file.path.includes('01-신규카드')) stats.byStatus['신규카드']++;
                    else if (file.path.includes('02-학습중')) stats.byStatus['학습중']++;
                    else if (file.path.includes('03-복습중')) stats.byStatus['복습중']++;
                    else if (file.path.includes('04-완료')) stats.byStatus['완료']++;
                }
            }

            // 통계를 Notice로 간단하게 표시
            const statsText = `📊 Anki Cards 통계
📈 총 카드: ${stats.total}개
📂 신규: ${stats.byStatus['신규카드']}개
📚 학습중: ${stats.byStatus['학습중']}개
🔄 복습중: ${stats.byStatus['복습중']}개
✅ 완료: ${stats.byStatus['완료']}개`;
            
            new Notice(statsText, 8000);
            
        } catch (error) {
            console.error('Statistics error:', error);
            new Notice('❌ 통계 생성 중 오류가 발생했습니다.');
        }
    }

    // 난이도별 카드 정리
    async organizeCardsByDifficulty() {
        try {
            const ankiFiles = this.app.vault.getMarkdownFiles()
                .filter(file => file.path.includes('Anki-Cards-DB'));

            let movedCount = 0;

            for (const file of ankiFiles) {
                const content = await this.app.vault.read(file);
                const ankiData = this.extractAnkiDataFromFile(content);
                
                if (ankiData && ankiData.레벨) {
                    const level = parseInt(ankiData.레벨);
                    let targetFolder = '';
                    
                    switch (level) {
                        case 1: targetFolder = 'Anki-Cards-DB/난이도별/⭐-초급'; break;
                        case 2: targetFolder = 'Anki-Cards-DB/난이도별/⭐⭐-초중급'; break;
                        case 3: targetFolder = 'Anki-Cards-DB/난이도별/⭐⭐⭐-중급'; break;
                        case 4: targetFolder = 'Anki-Cards-DB/난이도별/⭐⭐⭐⭐-중상급'; break;
                        case 5: targetFolder = 'Anki-Cards-DB/난이도별/⭐⭐⭐⭐⭐-고급'; break;
                        default: continue;
                    }
                    
                    const newPath = `${targetFolder}/${file.name}`;
                    const targetExists = this.app.vault.getAbstractFileByPath(newPath);
                    
                    if (!targetExists && file.path !== newPath) {
                        await this.app.vault.rename(file, newPath);
                        movedCount++;
                    }
                }
            }

            new Notice(`✅ ${movedCount}개의 카드가 난이도별로 정리되었습니다!`);
            
        } catch (error) {
            console.error('Organization error:', error);
            new Notice('❌ 카드 정리 중 오류가 발생했습니다.');
        }
    }

    // =================== DataviewJS 연동 시스템 ===================

    // Dataview API 가져오기
    getDataviewAPI() {
        return this.app.plugins.plugins.dataview?.api;
    }

    // Anki 카드 통계를 DataviewJS 형태로 반환
    async getAnkiStatsForDataview() {
        try {
            const ankiFiles = this.app.vault.getMarkdownFiles()
                .filter(file => file.path.includes('Anki-Cards-DB'));

            const stats = {
                total: 0,
                bySubject: {},
                byLevel: {},
                byStatus: {
                    '신규카드': 0,
                    '학습중': 0,
                    '복습중': 0,
                    '완료': 0
                },
                recentCards: [],
                todayCards: 0,
                weekCards: 0
            };

            const now = Date.now();
            const todayStart = new Date().setHours(0, 0, 0, 0);
            const weekAgo = now - (7 * 24 * 60 * 60 * 1000);

            for (const file of ankiFiles) {
                const content = await this.app.vault.read(file);
                const ankiData = this.extractAnkiDataFromFile(content);
                
                if (ankiData) {
                    stats.total++;
                    
                    // 과목별
                    const subject = ankiData.과목 || '미분류';
                    stats.bySubject[subject] = (stats.bySubject[subject] || 0) + 1;
                    
                    // 레벨별
                    const level = ankiData.레벨 || '미설정';
                    stats.byLevel[level] = (stats.byLevel[level] || 0) + 1;
                    
                    // 상태별
                    if (file.path.includes('01-신규카드')) stats.byStatus['신규카드']++;
                    else if (file.path.includes('02-학습중')) stats.byStatus['학습중']++;
                    else if (file.path.includes('03-복습중')) stats.byStatus['복습중']++;
                    else if (file.path.includes('04-완료')) stats.byStatus['완료']++;
                    
                    // 시간별 통계
                    if (file.stat.ctime > todayStart) stats.todayCards++;
                    if (file.stat.ctime > weekAgo) {
                        stats.weekCards++;
                        stats.recentCards.push({
                            name: file.name.replace('.md', ''),
                            path: file.path,
                            subject: subject,
                            level: level,
                            created: new Date(file.stat.ctime).toLocaleDateString()
                        });
                    }
                }
            }

            return stats;
        } catch (error) {
            console.error('DataviewJS stats error:', error);
            return null;
        }
    }

    // DataviewJS를 위한 카드 목록 반환
    async getAnkiCardsForDataview(filters = {}) {
        try {
            const ankiFiles = this.app.vault.getMarkdownFiles()
                .filter(file => file.path.includes('Anki-Cards-DB'));

            const cards = [];

            for (const file of ankiFiles) {
                const content = await this.app.vault.read(file);
                const ankiData = this.extractAnkiDataFromFile(content);
                
                if (ankiData) {
                    const card = {
                        name: file.name.replace('.md', ''),
                        path: file.path,
                        link: `[[${file.path}]]`,
                        data: ankiData,
                        created: new Date(file.stat.ctime),
                        modified: new Date(file.stat.mtime),
                        status: this.getCardStatus(file.path)
                    };

                    // 필터 적용
                    if (filters.subject && ankiData.과목 !== filters.subject) continue;
                    if (filters.level && ankiData.레벨 !== filters.level) continue;
                    if (filters.status && card.status !== filters.status) continue;

                    cards.push(card);
                }
            }

            return cards;
        } catch (error) {
            console.error('DataviewJS cards error:', error);
            return [];
        }
    }

    // 카드 상태 판단
    getCardStatus(filePath) {
        if (filePath.includes('01-신규카드')) return '신규카드';
        if (filePath.includes('02-학습중')) return '학습중';
        if (filePath.includes('03-복습중')) return '복습중';
        if (filePath.includes('04-완료')) return '완료';
        return '미분류';
    }

    // =================== 대시보드 시스템 ===================

    // 대시보드 열기
    async openDashboard() {
        const dashboardPath = this.ankiSettings.get('dashboardPath');
        const file = this.app.vault.getAbstractFileByPath(dashboardPath);
        
        if (file) {
            await this.app.workspace.getLeaf().openFile(file);
        } else {
            new Notice('대시보드가 없습니다. 먼저 대시보드를 생성해주세요.');
            await this.createDashboard();
        }
    }

    // 대시보드 생성
    async createDashboard() {
        try {
            const dashboardPath = this.ankiSettings.get('dashboardPath');
            
            // 폴더가 없으면 생성
            const folderPath = dashboardPath.substring(0, dashboardPath.lastIndexOf('/'));
            const folder = this.app.vault.getAbstractFileByPath(folderPath);
            if (!folder) {
                await this.app.vault.createFolder(folderPath);
            }

            const dashboardContent = this.generateDashboardContent();
            
            // 기존 파일이 있으면 삭제 후 재생성
            const existingFile = this.app.vault.getAbstractFileByPath(dashboardPath);
            if (existingFile) {
                await this.app.vault.delete(existingFile);
            }
            
            await this.app.vault.create(dashboardPath, dashboardContent);
            
            new Notice('✅ Anki Cards 대시보드가 생성되었습니다!');
            
            // 생성 후 열기
            const file = this.app.vault.getAbstractFileByPath(dashboardPath);
            if (file) {
                await this.app.workspace.getLeaf().openFile(file);
            }
            
        } catch (error) {
            console.error('Dashboard creation error:', error);
            new Notice('❌ 대시보드 생성 중 오류가 발생했습니다.');
        }
    }

    // 대시보드 업데이트
    async updateDashboard() {
        try {
            const dashboardPath = this.ankiSettings.get('dashboardPath');
            const file = this.app.vault.getAbstractFileByPath(dashboardPath);
            
            if (file) {
                const newContent = this.generateDashboardContent();
                await this.app.vault.modify(file, newContent);
                new Notice('✅ 대시보드가 업데이트되었습니다!');
            } else {
                new Notice('대시보드 파일을 찾을 수 없습니다.');
            }
        } catch (error) {
            console.error('Dashboard update error:', error);
            new Notice('❌ 대시보드 업데이트 중 오류가 발생했습니다.');
        }
    }

    // 대시보드 콘텐츠 생성
    generateDashboardContent() {
        return `# 🎴 Anki Cards Dashboard

> **📊 실시간 학습 통계와 진행 상황을 확인하세요**

## 📈 전체 통계

\`\`\`dataviewjs
// Anki Cards 플러그인에서 통계 데이터 가져오기
const plugin = this.app.plugins.plugins['anki-cards'];
if (plugin) {
    const stats = await plugin.getAnkiStatsForDataview();
    if (stats) {
        dv.header(2, "📊 학습 현황");
        
        // 전체 현황 테이블
        dv.table(
            ["구분", "개수", "비율"],
            [
                ["📚 총 카드", stats.total, "100%"],
                ["🆕 신규 카드", stats.byStatus['신규카드'], \`\${Math.round(stats.byStatus['신규카드']/stats.total*100)}%\`],
                ["📖 학습 중", stats.byStatus['학습중'], \`\${Math.round(stats.byStatus['학습중']/stats.total*100)}%\`],
                ["🔄 복습 중", stats.byStatus['복습중'], \`\${Math.round(stats.byStatus['복습중']/stats.total*100)}%\`],
                ["✅ 완료", stats.byStatus['완료'], \`\${Math.round(stats.byStatus['완료']/stats.total*100)}%\`]
            ]
        );
        
        // 오늘/이번주 생성 카드
        dv.header(3, "⏰ 최근 활동");
        dv.paragraph(\`📅 오늘 생성: **\${stats.todayCards}개**\`);
        dv.paragraph(\`📆 이번주 생성: **\${stats.weekCards}개**\`);
        
        // 과목별 현황
        if (Object.keys(stats.bySubject).length > 0) {
            dv.header(3, "📚 과목별 현황");
            const subjectData = Object.entries(stats.bySubject)
                .map(([subject, count]) => [subject, count, \`\${Math.round(count/stats.total*100)}%\`])
                .sort((a, b) => b[1] - a[1]);
            dv.table(["과목", "카드 수", "비율"], subjectData);
        }
        
        // 레벨별 현황
        if (Object.keys(stats.byLevel).length > 0) {
            dv.header(3, "⭐ 난이도별 현황");
            const levelData = Object.entries(stats.byLevel)
                .map(([level, count]) => [
                    \`레벨 \${level}\`, 
                    count, 
                    "⭐".repeat(Math.min(parseInt(level) || 1, 5))
                ])
                .sort((a, b) => parseInt(a[0].split(' ')[1]) - parseInt(b[0].split(' ')[1]));
            dv.table(["난이도", "카드 수", "별점"], levelData);
        }
    } else {
        dv.paragraph("⚠️ 통계 데이터를 가져올 수 없습니다.");
    }
} else {
    dv.paragraph("❌ Anki Cards 플러그인을 찾을 수 없습니다.");
}
\`\`\`

## 🆕 최근 생성된 카드

\`\`\`dataviewjs
const plugin = this.app.plugins.plugins['anki-cards'];
if (plugin) {
    const cards = await plugin.getAnkiCardsForDataview();
    const recentCards = cards
        .sort((a, b) => b.created - a.created)
        .slice(0, 10);
    
    if (recentCards.length > 0) {
        dv.table(
            ["카드", "과목", "레벨", "상태", "생성일"],
            recentCards.map(card => [
                dv.fileLink(card.path, false, card.name),
                card.data.과목 || "미분류",
                "⭐".repeat(Math.min(parseInt(card.data.레벨) || 1, 5)),
                card.status,
                card.created.toLocaleDateString()
            ])
        );
    } else {
        dv.paragraph("생성된 카드가 없습니다.");
    }
}
\`\`\`

## 📖 학습 중인 카드

\`\`\`dataviewjs
const plugin = this.app.plugins.plugins['anki-cards'];
if (plugin) {
    const studyingCards = await plugin.getAnkiCardsForDataview({status: '학습중'});
    
    if (studyingCards.length > 0) {
        dv.table(
            ["카드", "과목", "레벨", "수정일"],
            studyingCards
                .sort((a, b) => b.modified - a.modified)
                .slice(0, 15)
                .map(card => [
                    dv.fileLink(card.path, false, card.name),
                    card.data.과목 || "미분류",
                    "⭐".repeat(Math.min(parseInt(card.data.레벨) || 1, 5)),
                    card.modified.toLocaleDateString()
                ])
        );
    } else {
        dv.paragraph("현재 학습 중인 카드가 없습니다.");
    }
}
\`\`\`

## 🔄 복습이 필요한 카드

\`\`\`dataviewjs
const plugin = this.app.plugins.plugins['anki-cards'];
if (plugin) {
    const reviewCards = await plugin.getAnkiCardsForDataview({status: '복습중'});
    
    if (reviewCards.length > 0) {
        dv.table(
            ["카드", "과목", "레벨", "마지막 수정"],
            reviewCards
                .sort((a, b) => a.modified - b.modified) // 가장 오래된 것부터
                .slice(0, 10)
                .map(card => [
                    dv.fileLink(card.path, false, card.name),
                    card.data.과목 || "미분류",
                    "⭐".repeat(Math.min(parseInt(card.data.레벨) || 1, 5)),
                    card.modified.toLocaleDateString()
                ])
        );
    } else {
        dv.paragraph("복습이 필요한 카드가 없습니다.");
    }
}
\`\`\`

## 🚀 빠른 작업

- [[Anki-Cards-DB/01-신규카드/|📂 신규 카드 폴더]]
- [[Anki-Cards-DB/02-학습중/|📖 학습 중 폴더]]
- [[Anki-Cards-DB/03-복습중/|🔄 복습 중 폴더]]
- [[Anki-Cards-DB/04-완료/|✅ 완료 폴더]]

### 명령어 (Ctrl+P)
- \`Anki Cards: Create Basic Card\` - 기본 카드 생성
- \`Anki Cards: Create Cloze Card\` - 클로즈 카드 생성
- \`Anki Cards: Open Database Manager\` - DB 관리
- \`Anki Cards: Update Dashboard\` - 대시보드 새로고침

---
*마지막 업데이트: ${new Date().toLocaleString()}*
`;
    }

    // 자동 백업 설정
    setupAutoBackup() {
        const interval = this.ankiSettings.get('backupInterval') * 24 * 60 * 60 * 1000; // 일을 밀리초로
        
        this.backupTimer = setInterval(async () => {
            if (this.ankiSettings.get('enableAutoBackup')) {
                try {
                    await this.createFullBackup();
                    console.log('Auto backup completed');
                } catch (error) {
                    console.error('Auto backup failed:', error);
                }
            }
        }, interval);
    }
}

// Anki Cards 설정 탭
class AnkiCardsSettingTab extends PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h1', { text: '🎴 Anki Cards 설정' });
        
        // 일반 설정
        containerEl.createEl('h2', { text: '📋 일반 설정' });
        
        new Setting(containerEl)
            .setName('자동 타이머 생성')
            .setDesc('카드를 만들 때 자동으로 타이머를 추가합니다')
            .addToggle(toggle => toggle
                .setValue(this.plugin.ankiSettings.get('autoGenerateTimer'))
                .onChange(async (value) => {
                    this.plugin.ankiSettings.set('autoGenerateTimer', value);
                    await this.plugin.ankiSettings.saveSettings(this.plugin);
                }));

        new Setting(containerEl)
            .setName('기본 타이머 시간 (초)')
            .setDesc('새 카드의 기본 타이머 시간을 설정합니다')
            .addSlider(slider => slider
                .setLimits(10, 180, 10)
                .setValue(this.plugin.ankiSettings.get('defaultTimerDuration'))
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.ankiSettings.set('defaultTimerDuration', value);
                    await this.plugin.ankiSettings.saveSettings(this.plugin);
                }));

        new Setting(containerEl)
            .setName('힌트 표시')
            .setDesc('카드에 힌트 버튼을 표시합니다')
            .addToggle(toggle => toggle
                .setValue(this.plugin.ankiSettings.get('showHints'))
                .onChange(async (value) => {
                    this.plugin.ankiSettings.set('showHints', value);
                    await this.plugin.ankiSettings.saveSettings(this.plugin);
                }));

        // 테마 설정
        containerEl.createEl('h2', { text: '🎨 테마 설정' });
        
        new Setting(containerEl)
            .setName('테마')
            .setDesc('카드의 테마를 선택합니다')
            .addDropdown(dropdown => dropdown
                .addOption('f1-racing', 'F1 Racing (기본)')
                .addOption('minimal', 'Minimal')
                .addOption('dark', 'Dark')
                .setValue(this.plugin.ankiSettings.get('theme'))
                .onChange(async (value) => {
                    this.plugin.ankiSettings.set('theme', value);
                    await this.plugin.ankiSettings.saveSettings(this.plugin);
                }));

        new Setting(containerEl)
            .setName('애니메이션 효과')
            .setDesc('카드 전환 및 hover 애니메이션을 활성화합니다')
            .addToggle(toggle => toggle
                .setValue(this.plugin.ankiSettings.get('enableAnimations'))
                .onChange(async (value) => {
                    this.plugin.ankiSettings.set('enableAnimations', value);
                    await this.plugin.ankiSettings.saveSettings(this.plugin);
                }));

        new Setting(containerEl)
            .setName('진동 효과')
            .setDesc('모바일에서 진동 피드백을 활성화합니다')
            .addToggle(toggle => toggle
                .setValue(this.plugin.ankiSettings.get('enableVibration'))
                .onChange(async (value) => {
                    this.plugin.ankiSettings.set('enableVibration', value);
                    await this.plugin.ankiSettings.saveSettings(this.plugin);
                }));

        // DB 설정
        containerEl.createEl('h2', { text: '🗂️ 데이터베이스 설정' });
        
        new Setting(containerEl)
            .setName('자동 폴더 생성')
            .setDesc('첫 실행 시 자동으로 폴더 구조를 생성합니다')
            .addToggle(toggle => toggle
                .setValue(this.plugin.ankiSettings.get('autoCreateFolders'))
                .onChange(async (value) => {
                    this.plugin.ankiSettings.set('autoCreateFolders', value);
                    await this.plugin.ankiSettings.saveSettings(this.plugin);
                }));

        new Setting(containerEl)
            .setName('기본 과목')
            .setDesc('새 카드의 기본 과목을 설정합니다')
            .addText(text => text
                .setValue(this.plugin.ankiSettings.get('defaultSubject'))
                .onChange(async (value) => {
                    this.plugin.ankiSettings.set('defaultSubject', value);
                    await this.plugin.ankiSettings.saveSettings(this.plugin);
                }));

        new Setting(containerEl)
            .setName('기본 레벨')
            .setDesc('새 카드의 기본 난이도 레벨을 설정합니다')
            .addSlider(slider => slider
                .setLimits(1, 5, 1)
                .setValue(this.plugin.ankiSettings.get('defaultLevel'))
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.ankiSettings.set('defaultLevel', value);
                    await this.plugin.ankiSettings.saveSettings(this.plugin);
                }));

        new Setting(containerEl)
            .setName('자동 백업')
            .setDesc('정기적으로 자동 백업을 수행합니다')
            .addToggle(toggle => toggle
                .setValue(this.plugin.ankiSettings.get('enableAutoBackup'))
                .onChange(async (value) => {
                    this.plugin.ankiSettings.set('enableAutoBackup', value);
                    await this.plugin.ankiSettings.saveSettings(this.plugin);
                    
                    if (value) {
                        this.plugin.setupAutoBackup();
                    } else if (this.plugin.backupTimer) {
                        clearInterval(this.plugin.backupTimer);
                    }
                }));

        new Setting(containerEl)
            .setName('백업 주기 (일)')
            .setDesc('자동 백업 주기를 일 단위로 설정합니다')
            .addSlider(slider => slider
                .setLimits(1, 30, 1)
                .setValue(this.plugin.ankiSettings.get('backupInterval'))
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.ankiSettings.set('backupInterval', value);
                    await this.plugin.ankiSettings.saveSettings(this.plugin);
                }));

        // DataviewJS 연동
        containerEl.createEl('h2', { text: '📊 DataviewJS 연동' });
        
        new Setting(containerEl)
            .setName('DataviewJS 연동')
            .setDesc('DataviewJS와 연동하여 대시보드 기능을 활성화합니다')
            .addToggle(toggle => toggle
                .setValue(this.plugin.ankiSettings.get('enableDataviewIntegration'))
                .onChange(async (value) => {
                    this.plugin.ankiSettings.set('enableDataviewIntegration', value);
                    await this.plugin.ankiSettings.saveSettings(this.plugin);
                }));

        new Setting(containerEl)
            .setName('대시보드 경로')
            .setDesc('대시보드 파일의 경로를 설정합니다')
            .addText(text => text
                .setValue(this.plugin.ankiSettings.get('dashboardPath'))
                .onChange(async (value) => {
                    this.plugin.ankiSettings.set('dashboardPath', value);
                    await this.plugin.ankiSettings.saveSettings(this.plugin);
                }));

        new Setting(containerEl)
            .setName('자동 대시보드 업데이트')
            .setDesc('카드가 변경될 때 자동으로 대시보드를 업데이트합니다')
            .addToggle(toggle => toggle
                .setValue(this.plugin.ankiSettings.get('autoUpdateDashboard'))
                .onChange(async (value) => {
                    this.plugin.ankiSettings.set('autoUpdateDashboard', value);
                    await this.plugin.ankiSettings.saveSettings(this.plugin);
                }));

        // 빠른 작업 버튼들
        containerEl.createEl('h2', { text: '🚀 빠른 작업' });
        
        new Setting(containerEl)
            .setName('대시보드 생성')
            .setDesc('DataviewJS 대시보드를 생성합니다')
            .addButton(button => button
                .setButtonText('대시보드 생성')
                .setCta()
                .onClick(async () => {
                    await this.plugin.createDashboard();
                }));

        new Setting(containerEl)
            .setName('폴더 구조 생성')
            .setDesc('Anki Cards 폴더 구조를 생성합니다')
            .addButton(button => button
                .setButtonText('폴더 생성')
                .onClick(async () => {
                    await this.plugin.createAnkiFolderStructure();
                }));

        new Setting(containerEl)
            .setName('DB 관리자 열기')
            .setDesc('데이터베이스 관리 인터페이스를 엽니다')
            .addButton(button => button
                .setButtonText('DB 관리자')
                .onClick(() => {
                    this.plugin.openDBManager();
                }));

        // 고급 설정
        containerEl.createEl('h2', { text: '⚙️ 고급 설정' });
        
        new Setting(containerEl)
            .setName('디버그 모드')
            .setDesc('개발자를 위한 디버그 정보를 콘솔에 출력합니다')
            .addToggle(toggle => toggle
                .setValue(this.plugin.ankiSettings.get('enableDebugMode'))
                .onChange(async (value) => {
                    this.plugin.ankiSettings.set('enableDebugMode', value);
                    await this.plugin.ankiSettings.saveSettings(this.plugin);
                }));

        new Setting(containerEl)
            .setName('내보내기 형식')
            .setDesc('데이터베이스 내보내기 시 사용할 형식입니다')
            .addDropdown(dropdown => dropdown
                .addOption('json', 'JSON')
                .addOption('csv', 'CSV')
                .addOption('markdown', 'Markdown')
                .setValue(this.plugin.ankiSettings.get('exportFormat'))
                .onChange(async (value) => {
                    this.plugin.ankiSettings.set('exportFormat', value);
                    await this.plugin.ankiSettings.saveSettings(this.plugin);
                }));

        // 사용자 정의 CSS
        new Setting(containerEl)
            .setName('사용자 정의 CSS')
            .setDesc('카드에 적용할 추가 CSS 스타일')
            .addTextArea(textArea => textArea
                .setValue(this.plugin.ankiSettings.get('customCSS'))
                .onChange(async (value) => {
                    this.plugin.ankiSettings.set('customCSS', value);
                    await this.plugin.ankiSettings.saveSettings(this.plugin);
                }));

        // 설정 초기화
        containerEl.createEl('h2', { text: '🔄 설정 초기화' });
        
        new Setting(containerEl)
            .setName('설정 초기화')
            .setDesc('모든 설정을 기본값으로 되돌립니다')
            .addButton(button => button
                .setButtonText('초기화')
                .setWarning()
                .onClick(async () => {
                    if (confirm('정말로 모든 설정을 초기화하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
                        this.plugin.ankiSettings.settings = { ...this.plugin.ankiSettings.defaultSettings };
                        await this.plugin.ankiSettings.saveSettings(this.plugin);
                        this.display(); // 설정 탭 새로고침
                        new Notice('✅ 설정이 초기화되었습니다.');
                    }
                }));
    }
}

module.exports = AnkiCardsPlugin;