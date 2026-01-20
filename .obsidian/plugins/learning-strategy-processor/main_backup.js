const { Plugin, PluginSettingTab, Setting, Notice, Modal, MarkdownView, TFile, Menu, ItemView } = require('obsidian');

// 기본 설정
const DEFAULT_SETTINGS = {
  outputFolder: 'Learning',
  templateFormat: 'standard',
  includeTimestamp: true,
  organizationPrompt: '다음 학습 정보를 조직화(Organization)해주세요. 정보를 구조화하고 목차화하세요.\n\n학습 정보:\n{content}\n\n다음 형식으로 답변해주세요:\n1. 주제 식별: [주요 주제]\n2. 계층 구조: [단계별 구조]\n3. 핵심 키워드: [3-5개]\n4. 목차: [체계적인 목차]',
  contextualizationPrompt: '다음 학습 정보를 맥락화(Contextualization)해주세요. 전체 흐름과 연결 관계를 파악하세요.\n\n학습 정보:\n{content}\n\n다음 형식으로 답변해주세요:\n1. 전체 맥락: [이 정보가 속한 큰 그림]\n2. 선행 지식: [이것을 이해하려면 먼저 알아야 할 것]\n3. 후속 지식: [이것을 배운 후 학습할 내용]\n4. 인과 관계: [원인과 결과의 흐름]',
  elaborationPrompt: '다음 학습 정보를 정교화(Elaboration)해주세요. 기존 지식과 연결하고 이미지화하세요.\n\n학습 정보:\n{content}\n\n다음 형식으로 답변해주세요:\n1. 기존 지식 연결: [이미 알고 있는 것과의 연결]\n2. 비유와 이미지화: [구체적인 비유]\n3. 실생활 예시: [실제 적용 사례 3가지]\n4. 심화 질문: [더 깊이 생각해볼 질문 2가지]',
  tags: ['학습노트', '자동생성', '복습필요'],
  useTemplateFile: false,
  templateFilePath: '',
  // 새 기능 설정
  statistics: {
    totalCreated: 0,
    completionRate: {},
    timeTracking: {}
  },
  bookmarks: [],
  customTags: [],
  batchQueue: [],
  timerEnabled: true,
  autoRecordTime: true,
  dailyGoal: 5
};

// 대시보드 뷰 타입
const PROCESSOR_DASHBOARD_VIEW = 'learning-processor-dashboard';

module.exports = class LearningStrategyProcessor extends Plugin {
  async onload() {
    console.log('Loading Learning Strategy Processor plugin');

    // 설정 로드
    await this.loadSettings();

    // 대시보드 뷰 등록
    this.registerView(PROCESSOR_DASHBOARD_VIEW, (leaf) => new ProcessorDashboardView(leaf, this));

    // 리본 아이콘 추가
    this.addRibbonIcon('brain-circuit', 'Learning Strategy Processor', async () => {
      new ProcessorModal(this.app, this).open();
    });

    this.addRibbonIcon('chart-line', '학습 통계', async () => {
      this.activateDashboardView();
    });

    // 커맨드 추가
    this.addCommand({
      id: 'open-processor',
      name: '학습 전략 처리 시작',
      callback: () => {
        new ProcessorModal(this.app, this).open();
      }
    });

    this.addCommand({
      id: 'process-current-note',
      name: '현재 노트에서 템플릿 생성',
      editorCallback: async (editor, view) => {
        const content = editor.getSelection() || editor.getValue();
        if (!content.trim()) {
          new Notice('처리할 내용을 선택하거나 입력해주세요');
          return;
        }
        await this.createTemplate(content, view.file.basename);
      }
    });

    this.addCommand({
      id: 'create-batch-templates',
      name: '여러 정보 일괄 템플릿 생성',
      callback: () => {
        new BatchProcessModal(this.app, this).open();
      }
    });

    this.addCommand({
      id: 'open-dashboard',
      name: '학습 대시보드 열기',
      callback: () => {
        this.activateDashboardView();
      }
    });

    this.addCommand({
      id: 'search-templates',
      name: '템플릿 검색',
      callback: () => {
        new TemplateSearchModal(this.app, this).open();
      }
    });

    this.addCommand({
      id: 'export-data',
      name: '학습 데이터 내보내기',
      callback: () => {
        new DataExportModal(this.app, this).open();
      }
    });

    this.addCommand({
      id: 'toggle-timer',
      name: '학습 타이머 시작/중지',
      callback: () => {
        new TimerModal(this.app, this).open();
      }
    });

    this.addCommand({
      id: 'batch-queue',
      name: '배치 작업 진행률 보기',
      callback: () => {
        new BatchProgressModal(this.app, this).open();
      }
    });

    // 설정 탭 추가
    this.addSettingTab(new LearningStrategySettingTab(this.app, this));

    console.log('✅ Learning Strategy Processor loaded successfully!');
  }

  async activateDashboardView() {
    const { workspace } = this.app;
    const leaves = workspace.getLeavesOfType(PROCESSOR_DASHBOARD_VIEW);
    
    if (leaves.length > 0) {
      workspace.revealLeaf(leaves[0]);
      return;
    }

    const leaf = workspace.getLeaf('split', 'vertical');
    await leaf.setViewState({
      type: PROCESSOR_DASHBOARD_VIEW,
      active: true,
    });
    workspace.revealLeaf(leaf);
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  // 통계 업데이트
  updateStatistics(title, completionData = {}) {
    this.settings.statistics.totalCreated++;
    this.settings.statistics.completionRate[title] = completionData;
    this.saveSettings();
  }

  // 북마크 추가
  addBookmark(filePath) {
    if (!this.settings.bookmarks.includes(filePath)) {
      this.settings.bookmarks.push(filePath);
      this.saveSettings();
      new Notice('⭐ 북마크 추가됨');
    }
  }

  // 북마크 제거
  removeBookmark(filePath) {
    this.settings.bookmarks = this.settings.bookmarks.filter(b => b !== filePath);
    this.saveSettings();
  }

  async createTemplate(content, suggestedName = '') {
    new NoteInputModal(this.app, async (memo) => {
      const notice = new Notice('📝 템플릿을 생성하고 있습니다...', 2000);

      try {
        const result = {
          originalContent: content,
          timestamp: new Date().toISOString(),
          memo: memo
        };

        const filepath = await this.saveToFile(result, suggestedName);
        
        // 통계 업데이트
        this.updateStatistics(suggestedName || '템플릿', {
          createdAt: new Date().toLocaleString('ko-KR'),
          memo: memo
        });

        new Notice('✅ 템플릿 생성 완료! 직접 작성해주세요.');

        return filepath;

      } catch (error) {
        new Notice('❌ 생성 중 오류: ' + error.message);
        console.error('Template creation error:', error);
        return null;
      }
    }).open();
  }

  async saveToFile(result, suggestedName = '') {
    const topic = suggestedName || result.originalContent.split(/[.。\n]/)[0].substring(0, 30).trim();
    const timestamp = this.settings.includeTimestamp 
      ? '_' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
      : '';
    const filename = `학습노트_${topic}${timestamp}.md`;

    // 출력 폴더 확인
    const folder = this.settings.outputFolder;
    if (!(await this.app.vault.adapter.exists(folder))) {
      await this.app.vault.createFolder(folder);
    }

    const tags = this.settings.tags.map(t => `#${t}`).join(' ');
    
    let content;
    if (this.settings.useTemplateFile && this.settings.templateFilePath) {
      // 사용자 정의 템플릿 사용
      content = await this.generateFromTemplate(result, tags);
    } else {
      // 기본 템플릿 사용
      content = this.generateMarkdown(result, tags);
    }

    const filepath = `${folder}/${filename}`;
    await this.app.vault.create(filepath, content);
    
    new Notice(`📝 생성 완료: ${filename}`);
    
    // 파일 열기
    const file = this.app.vault.getAbstractFileByPath(filepath);
    if (file) {
      const leaf = this.app.workspace.getLeaf(false);
      await leaf.openFile(file);
      
      // 첫 번째 입력 필드로 커서 이동 (조직화 섹션)
      setTimeout(() => {
        const editor = this.app.workspace.activeLeaf?.view?.editor;
        if (editor) {
          const text = editor.getValue();
          const organizationIndex = text.indexOf('## 📑 조직화 (Organization)');
          if (organizationIndex !== -1) {
            const lines = text.substring(0, organizationIndex).split('\n');
            const line = lines.length + 2;
            editor.setCursor({ line: line, ch: 0 });
          }
        }
      }, 100);
    }

    return filepath;
  }

  async generateFromTemplate(result, tags) {
    try {
      const templateFile = this.app.vault.getAbstractFileByPath(this.settings.templateFilePath);
      if (!templateFile || !(templateFile instanceof TFile)) {
        throw new Error('템플릿 파일을 찾을 수 없습니다');
      }

      let template = await this.app.vault.read(templateFile);
      
      // 템플릿 변수 치환
      template = template
        .replace(/{{timestamp}}/g, result.timestamp)
        .replace(/{{date}}/g, new Date(result.timestamp).toLocaleDateString('ko-KR'))
        .replace(/{{time}}/g, new Date(result.timestamp).toLocaleTimeString('ko-KR'))
        .replace(/{{tags}}/g, tags)
        .replace(/{{content}}/g, result.originalContent)
        .replace(/{{title}}/g, result.originalContent.split(/[.。]/)[0].substring(0, 50).trim());

      return template;
    } catch (error) {
      console.error('Template generation error:', error);
      // 템플릿 로드 실패 시 기본 템플릿 사용
      return this.generateMarkdown(result, tags);
    }
  }

  generateMarkdown(result, tags) {
    return `---
created: ${result.timestamp}
tags: [${this.settings.tags.join(', ')}]
type: 학습노트
status: 작성중
---

# 📚 ${result.originalContent.split(/[.。]/)[0].substring(0, 50).trim()}

${tags}

## 📝 원본 정보

${result.originalContent}

---

## 📑 조직화 (Organization)

**작성 가이드:**
1. 주제 식별: 핵심 주제가 무엇인가?
2. 계층 구조: 어떻게 단계별로 나눌 수 있는가?
3. 핵심 키워드: 가장 중요한 키워드 3-5개는?
4. 목차: 체계적인 학습 순서는?

**내 답변:**




---

## 🔗 맥락화 (Contextualization)

**작성 가이드:**
1. 전체 맥락: 이 개념이 속한 더 큰 그림은?
2. 선행 지식: 이것을 배우기 전에 알아야 할 것은?
3. 후속 지식: 이것을 배운 후 무엇을 학습하면 좋을까?
4. 인과 관계: 원인과 결과의 흐름은?

**내 답변:**




---

## 🎨 정교화 (Elaboration)

**작성 가이드:**
1. 기존 지식 연결: 내가 이미 알고 있는 것과 어떻게 연결되는가?
2. 비유와 이미지화: 이것을 어떤 이미지나 비유로 표현할 수 있을까?
3. 실생활 예시: 실제로 어디에 사용되는가? (3가지 이상)
4. 심화 질문: 더 깊이 생각해볼 질문은?

**내 답변:**




---

## 💡 복습 체크리스트

- [ ] 조직화 완료
- [ ] 맥락화 완료
- [ ] 정교화 완료
- [ ] 핵심 개념 이해
- [ ] 전체 맥락 파악
- [ ] 실생활 적용 사례 연결

---

## 📌 추가 메모 & 참고자료

---

## 🔄 복습 기록

### 1차 복습
- 날짜: 
- 이해도: /10
- 메모:

### 2차 복습
- 날짜:
- 이해도: /10
- 메모:

### 3차 복습
- 날짜:
- 이해도: /10
- 메모:

---

*Learning Strategy Processor 플러그인으로 생성됨*
*${new Date(result.timestamp).toLocaleString('ko-KR')}*
`;
  }

  async createBatchTemplates(contents) {
    const results = [];
    const folder = this.settings.outputFolder;
    
    if (!(await this.app.vault.adapter.exists(folder))) {
      await this.app.vault.createFolder(folder);
    }

    for (let i = 0; i < contents.length; i++) {
      const content = contents[i].trim();
      if (!content) continue;

      try {
        const result = {
          originalContent: content,
          timestamp: new Date().toISOString()
        };

        const topic = content.split(/[.。]/)[0].substring(0, 30).trim();
        const filename = `학습노트_${i + 1}_${topic}_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)}.md`;
        const filepath = `${folder}/${filename}`;

        const tags = this.settings.tags.map(t => `#${t}`).join(' ');
        const noteContent = this.generateMarkdown(result, tags);

        await this.app.vault.create(filepath, noteContent);
        results.push({ success: true, filename, topic });

      } catch (error) {
        results.push({ success: false, error: error.message, content: content.substring(0, 50) });
      }
    }

    return results;
  }
};

// 단일 처리 모달
class ProcessorModal extends Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
    this.content = '';
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('learning-strategy-modal');

    contentEl.createEl('h2', { text: '🧠 학습 전략 처리 시스템' });
    
    const description = contentEl.createEl('div', { cls: 'modal-description' });
    description.createEl('p', { 
      text: '학습할 정보를 입력하면 "조직화 → 맥락화 → 정교화" 템플릿이 자동 생성됩니다.'
    });
    description.createEl('p', { 
      text: '각 섹션의 작성 가이드를 보고 직접 답변을 작성하면서 깊이 있게 학습하세요! 📚',
      cls: 'highlight-text'
    });

    // 예시 버튼들
    const examplesDiv = contentEl.createDiv({ cls: 'example-buttons' });
    examplesDiv.createEl('h3', { text: '💡 예시 정보 (클릭하면 자동 입력)' });

    const examples = [
      {
        title: '🌱 광합성',
        content: '광합성은 식물이 빛 에너지를 이용해 이산화탄소와 물로 포도당과 산소를 만드는 과정이다. 이 과정은 명반응과 암반응 두 단계로 나뉜다.'
      },
      {
        title: '💻 Python for 루프',
        content: 'Python의 for 루프는 반복문의 한 종류로, 리스트나 범위의 각 요소를 순회하면서 코드를 실행한다. for item in list: 형태로 사용한다.'
      },
      {
        title: '📜 프랑스 혁명',
        content: '프랑스 혁명은 1789년 프랑스에서 발생한 시민혁명으로, 절대왕정을 무너뜨리고 공화정을 수립했다. 자유, 평등, 박애의 이념을 내세웠다.'
      },
      {
        title: '⚡ 미토콘드리아',
        content: '미토콘드리아는 세포의 에너지 공장으로, 세포 호흡을 통해 ATP를 생성한다. 독자적인 DNA를 가지고 있으며, 모계 유전된다.'
      }
    ];

    examples.forEach(example => {
      const btn = examplesDiv.createEl('button', { text: example.title, cls: 'example-btn' });
      btn.addEventListener('click', () => {
        textarea.value = example.content;
        this.content = example.content;
      });
    });

    // 텍스트 입력 영역
    contentEl.createEl('h3', { text: '📝 학습할 정보 입력' });
    const textarea = contentEl.createEl('textarea', {
      placeholder: '학습하고 싶은 정보를 입력하세요...\n\n예시:\n- 광합성은 식물이 빛 에너지를 이용해 이산화탄소와 물로 포도당을 만드는 과정이다\n- 미토콘드리아는 세포의 에너지 공장 역할을 한다\n- 프로그래밍에서 함수는 특정 작업을 수행하는 코드 블록이다\n\n💡 팁: 가능한 구체적으로 작성하면 더 좋은 템플릿이 생성됩니다!',
      cls: 'learning-input'
    });
    textarea.addEventListener('input', (e) => {
      this.content = e.target.value;
    });

    // 안내 메시지
    const infoBox = contentEl.createDiv({ cls: 'info-box' });
    infoBox.createEl('strong', { text: '📌 작동 방식:' });
    const infoList = infoBox.createEl('ul');
    infoList.createEl('li', { text: '입력한 정보로 3단계 템플릿이 생성됩니다' });
    infoList.createEl('li', { text: '각 섹션에 작성 가이드가 포함됩니다' });
    infoList.createEl('li', { text: '직접 작성하면서 깊이 있게 학습하세요' });
    infoList.createEl('li', { text: '작성한 내용은 자동 저장됩니다' });

    // 버튼 영역
    const buttonDiv = contentEl.createDiv({ cls: 'modal-buttons' });
    
    const processBtn = buttonDiv.createEl('button', { 
      text: '📝 템플릿 생성하기',
      cls: 'mod-cta'
    });
    processBtn.addEventListener('click', async () => {
      if (!this.content.trim()) {
        new Notice('⚠️ 정보를 입력해주세요');
        return;
      }
      
      this.close();
      await this.plugin.createTemplate(this.content);
    });

    const cancelBtn = buttonDiv.createEl('button', { text: '취소' });
    cancelBtn.addEventListener('click', () => this.close());
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

// 일괄 처리 모달
class BatchProcessModal extends Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
    this.content = '';
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('learning-strategy-modal');

    contentEl.createEl('h2', { text: '📚 여러 정보 일괄 템플릿 생성' });
    
    const description = contentEl.createEl('div', { cls: 'modal-description' });
    description.createEl('p', { 
      text: '여러 학습 정보를 한 번에 템플릿으로 생성할 수 있습니다.'
    });
    description.createEl('p', { 
      text: '각 정보는 빈 줄(Enter 2번)로 구분해주세요.',
      cls: 'highlight-text'
    });

    // 텍스트 입력 영역
    const textarea = contentEl.createEl('textarea', {
      placeholder: '여러 정보를 입력하세요 (빈 줄로 구분)...\n\n예시:\n\n광합성은 식물이 빛 에너지를 이용해 이산화탄소와 물로 포도당을 만드는 과정이다.\n\n미토콘드리아는 세포의 에너지 공장 역할을 한다.\n\nDNA는 유전 정보를 저장하는 이중나선 구조의 분자이다.',
      cls: 'learning-input-large'
    });
    textarea.style.minHeight = '300px';
    textarea.addEventListener('input', (e) => {
      this.content = e.target.value;
    });

    // 안내 메시지
    const infoBox = contentEl.createDiv({ cls: 'info-box' });
    infoBox.createEl('strong', { text: '💡 사용 팁:' });
    const infoList = infoBox.createEl('ul');
    infoList.createEl('li', { text: '각 정보 사이에 빈 줄을 넣어 구분하세요' });
    infoList.createEl('li', { text: '한 번에 여러 개념을 템플릿으로 만들 수 있습니다' });
    infoList.createEl('li', { text: '생성된 템플릿들을 차례로 작성하며 학습하세요' });

    // 버튼 영역
    const buttonDiv = contentEl.createDiv({ cls: 'modal-buttons' });
    
    const processBtn = buttonDiv.createEl('button', { 
      text: '📝 일괄 생성하기',
      cls: 'mod-cta'
    });
    processBtn.addEventListener('click', async () => {
      if (!this.content.trim()) {
        new Notice('⚠️ 정보를 입력해주세요');
        return;
      }
      
      // 빈 줄로 구분
      const contents = this.content.split(/\n\s*\n/).filter(c => c.trim());
      
      if (contents.length === 0) {
        new Notice('⚠️ 유효한 정보가 없습니다');
        return;
      }

      this.close();
      
      const notice = new Notice(`📝 ${contents.length}개 템플릿 생성 중...`, 0);
      const results = await this.plugin.createBatchTemplates(contents);
      notice.hide();

      const successCount = results.filter(r => r.success).length;
      const failCount = results.length - successCount;

      if (failCount === 0) {
        new Notice(`✅ ${successCount}개 템플릿 생성 완료!`);
      } else {
        new Notice(`⚠️ ${successCount}개 성공, ${failCount}개 실패`);
      }

      // 결과 모달 표시
      new BatchResultModal(this.app, results).open();
    });

    const cancelBtn = buttonDiv.createEl('button', { text: '취소' });
    cancelBtn.addEventListener('click', () => this.close());
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

// 일괄 처리 결과 모달
class BatchResultModal extends Modal {
  constructor(app, results) {
    super(app);
    this.results = results;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl('h2', { text: '📊 일괄 생성 결과' });

    const successCount = this.results.filter(r => r.success).length;
    const failCount = this.results.length - successCount;

    const summary = contentEl.createDiv({ cls: 'batch-summary' });
    summary.createEl('p', { text: `총 ${this.results.length}개 중 ${successCount}개 성공, ${failCount}개 실패` });

    if (successCount > 0) {
      const successDiv = contentEl.createDiv({ cls: 'success-list' });
      successDiv.createEl('h3', { text: '✅ 생성 완료' });
      const successList = successDiv.createEl('ul');
      this.results.filter(r => r.success).forEach(result => {
        successList.createEl('li', { text: `${result.topic} → ${result.filename}` });
      });
    }

    if (failCount > 0) {
      const failDiv = contentEl.createDiv({ cls: 'fail-list' });
      failDiv.createEl('h3', { text: '❌ 생성 실패' });
      const failList = failDiv.createEl('ul');
      this.results.filter(r => !r.success).forEach(result => {
        failList.createEl('li', { text: `${result.content}... - ${result.error}` });
      });
    }

    const buttonDiv = contentEl.createDiv({ cls: 'modal-buttons' });
    const closeBtn = buttonDiv.createEl('button', { text: '확인', cls: 'mod-cta' });
    closeBtn.addEventListener('click', () => this.close());
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

// 설정 탭
class LearningStrategySettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Learning Strategy Processor 설정' });

    const infoDiv = containerEl.createDiv({ cls: 'setting-info' });
    infoDiv.createEl('p', { 
      text: '이 플러그인은 학습 템플릿을 생성합니다. 생성된 템플릿을 직접 작성하면서 학습하세요!',
      cls: 'setting-item-description'
    });

    containerEl.createEl('h3', { text: '기본 설정' });

    // 출력 폴더
    new Setting(containerEl)
      .setName('출력 폴더')
      .setDesc('생성된 템플릿을 저장할 폴더')
      .addText(text => text
        .setPlaceholder('Learning')
        .setValue(this.plugin.settings.outputFolder)
        .onChange(async (value) => {
          this.plugin.settings.outputFolder = value;
          await this.plugin.saveSettings();
        }));

    // 타임스탬프 포함
    new Setting(containerEl)
      .setName('타임스탬프 포함')
      .setDesc('파일명에 생성 시간 포함')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.includeTimestamp)
        .onChange(async (value) => {
          this.plugin.settings.includeTimestamp = value;
          await this.plugin.saveSettings();
        }));

    // 태그 설정
    new Setting(containerEl)
      .setName('기본 태그')
      .setDesc('자동으로 추가할 태그들 (쉼표로 구분)')
      .addText(text => text
        .setPlaceholder('학습노트, 자동생성, 복습필요')
        .setValue(this.plugin.settings.tags.join(', '))
        .onChange(async (value) => {
          this.plugin.settings.tags = value.split(',').map(t => t.trim());
          await this.plugin.saveSettings();
        }));

    containerEl.createEl('h3', { text: '템플릿 커스터마이징' });

    // 사용자 정의 템플릿 사용
    new Setting(containerEl)
      .setName('사용자 정의 템플릿 사용')
      .setDesc('직접 만든 템플릿 파일 사용 (변수: {{timestamp}}, {{date}}, {{time}}, {{tags}}, {{content}}, {{title}})')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.useTemplateFile)
        .onChange(async (value) => {
          this.plugin.settings.useTemplateFile = value;
          await this.plugin.saveSettings();
          this.display(); // 새로고침
        }));

    if (this.plugin.settings.useTemplateFile) {
      new Setting(containerEl)
        .setName('템플릿 파일 경로')
        .setDesc('사용할 템플릿 파일 경로 (예: Templates/학습노트템플릿.md)')
        .addText(text => text
          .setPlaceholder('Templates/학습노트템플릿.md')
          .setValue(this.plugin.settings.templateFilePath)
          .onChange(async (value) => {
            this.plugin.settings.templateFilePath = value;
            await this.plugin.saveSettings();
          }));
    }

    containerEl.createEl('h3', { text: '프롬프트 가이드 커스터마이징' });
    
    const promptInfo = containerEl.createDiv({ cls: 'setting-info' });
    promptInfo.createEl('p', { 
      text: '생성되는 템플릿에 포함될 작성 가이드를 수정할 수 있습니다. {content}는 입력된 정보로 자동 치환됩니다.',
      cls: 'setting-item-description'
    });

    // 조직화 프롬프트
    new Setting(containerEl)
      .setName('조직화 (Organization) 프롬프트')
      .setDesc('정보 구조화 및 목차화 가이드')
      .addText(text => text
        .setPlaceholder('조직화 프롬프트...')
        .setValue(this.plugin.settings.organizationPrompt)
        .onChange(async (value) => {
          this.plugin.settings.organizationPrompt = value;
          await this.plugin.saveSettings();
        }));

    // 맥락화 프롬프트
    new Setting(containerEl)
      .setName('맥락화 (Contextualization) 프롬프트')
      .setDesc('전체 맥락과 연결 관계 파악 가이드')
      .addText(text => text
        .setPlaceholder('맥락화 프롬프트...')
        .setValue(this.plugin.settings.contextualizationPrompt)
        .onChange(async (value) => {
          this.plugin.settings.contextualizationPrompt = value;
          await this.plugin.saveSettings();
        }));

    // 정교화 프롬프트
    new Setting(containerEl)
      .setName('정교화 (Elaboration) 프롬프트')
      .setDesc('기존 지식 연결 및 이미지화 가이드')
      .addText(text => text
        .setPlaceholder('정교화 프롬프트...')
        .setValue(this.plugin.settings.elaborationPrompt)
        .onChange(async (value) => {
          this.plugin.settings.elaborationPrompt = value;
          await this.plugin.saveSettings();
        }));
  }
}

// ========================
// 메모 입력 모달 (quiz-sp2 참고)
// ========================
class NoteInputModal extends Modal {
  constructor(app, onSubmit) {
    super(app);
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h3', { text: '📝 메모 입력' });
    
    const textarea = contentEl.createEl('textarea');
    textarea.style.width = '100%';
    textarea.style.height = '100px';
    textarea.placeholder = '학습 메모를 입력하세요 (선택사항)';

    const buttonDiv = contentEl.createDiv();
    buttonDiv.style.marginTop = '16px';
    buttonDiv.style.display = 'flex';
    buttonDiv.style.gap = '8px';

    const saveBtn = buttonDiv.createEl('button', { text: '저장' });
    saveBtn.style.flex = '1';
    saveBtn.onclick = () => {
      const value = textarea.value;
      this.close();
      if (this.onSubmit) this.onSubmit(value);
    };

    const skipBtn = buttonDiv.createEl('button', { text: '건너뛰기' });
    skipBtn.style.flex = '1';
    skipBtn.onclick = () => {
      this.close();
      if (this.onSubmit) this.onSubmit('');
    };

    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.ctrlKey) {
        e.preventDefault();
        saveBtn.click();
      }
    });
  }

  onClose() {
    this.contentEl.empty();
  }
}

// ========================
// 템플릿 검색 모달
// ========================
class TemplateSearchModal extends Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
    this.results = [];
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('template-search-modal');

    contentEl.createEl('h2', { text: '🔍 템플릿 검색' });

    const searchDiv = contentEl.createDiv();
    const searchInput = searchDiv.createEl('input', {
      type: 'text',
      placeholder: '검색어 입력 (제목, 태그, 날짜)'
    });
    searchInput.style.width = '100%';
    searchInput.style.padding = '8px';
    searchInput.style.marginBottom = '16px';

    const resultsDiv = contentEl.createDiv();
    resultsDiv.style.maxHeight = '400px';
    resultsDiv.style.overflowY = 'auto';

    searchInput.addEventListener('input', async (e) => {
      const query = e.target.value.toLowerCase();
      resultsDiv.empty();

      if (!query) {
        resultsDiv.createEl('p', { text: '검색어를 입력하세요' });
        return;
      }

      const files = this.plugin.app.vault.getMarkdownFiles();
      const outputFolder = this.plugin.settings.outputFolder;
      const filtered = files.filter(f => 
        f.path.startsWith(outputFolder) && 
        (f.name.toLowerCase().includes(query) || f.path.toLowerCase().includes(query))
      );

      if (filtered.length === 0) {
        resultsDiv.createEl('p', { text: '검색 결과가 없습니다' });
        return;
      }

      filtered.forEach(file => {
        const item = resultsDiv.createDiv({ cls: 'search-result-item' });
        item.style.padding = '8px';
        item.style.marginBottom = '8px';
        item.style.border = '1px solid var(--divider-color)';
        item.style.borderRadius = '4px';
        item.style.cursor = 'pointer';

        const title = item.createEl('div', { text: file.name });
        title.style.fontWeight = 'bold';
        title.style.marginBottom = '4px';

        const path = item.createEl('div', { text: file.path });
        path.style.fontSize = '0.9em';
        path.style.opacity = '0.7';

        item.addEventListener('click', () => {
          this.plugin.app.workspace.getLeaf(false).openFile(file);
          this.close();
        });
      });
    });
  }

  onClose() {
    this.contentEl.empty();
  }
}

// ========================
// 데이터 내보내기 모달
// ========================
class DataExportModal extends Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl('h2', { text: '📤 데이터 내보내기' });

    const info = contentEl.createDiv();
    info.createEl('p', { text: `📊 생성된 템플릿: ${this.plugin.settings.statistics.totalCreated}개` });

    const buttonDiv = contentEl.createDiv();
    buttonDiv.style.display = 'flex';
    buttonDiv.style.gap = '8px';
    buttonDiv.style.marginTop = '16px';

    const csvBtn = buttonDiv.createEl('button', { text: '📋 CSV 내보내기' });
    csvBtn.onclick = () => this.exportCSV();

    const jsonBtn = buttonDiv.createEl('button', { text: '📄 JSON 내보내기' });
    jsonBtn.onclick = () => this.exportJSON();

    const closeBtn = buttonDiv.createEl('button', { text: '닫기' });
    closeBtn.onclick = () => this.close();
  }

  async exportCSV() {
    const files = this.plugin.app.vault.getMarkdownFiles()
      .filter(f => f.path.startsWith(this.plugin.settings.outputFolder));

    let csv = '제목,경로,생성일시\n';
    for (const file of files) {
      const stat = await this.plugin.app.vault.adapter.stat(file.path);
      csv += `"${file.name}","${file.path}","${new Date(stat?.mtime || 0).toLocaleString('ko-KR')}"\n`;
    }

    this.downloadFile(csv, 'templates.csv', 'text/csv');
    new Notice('✅ CSV 파일 다운로드됨');
  }

  async exportJSON() {
    const files = this.plugin.app.vault.getMarkdownFiles()
      .filter(f => f.path.startsWith(this.plugin.settings.outputFolder));

    const data = {
      exportDate: new Date().toISOString(),
      totalTemplates: files.length,
      statistics: this.plugin.settings.statistics,
      templates: files.map(f => ({
        name: f.name,
        path: f.path
      }))
    };

    this.downloadFile(JSON.stringify(data, null, 2), 'templates.json', 'application/json');
    new Notice('✅ JSON 파일 다운로드됨');
  }

  downloadFile(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  onClose() {
    this.contentEl.empty();
  }
}

// ========================
// 대시보드 뷰
// ========================
class ProcessorDashboardView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType() {
    return PROCESSOR_DASHBOARD_VIEW;
  }

  getDisplayText() {
    return '📊 학습 통계';
  }

  async onOpen() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass('processor-dashboard-container');
    
    await this.renderDashboard(containerEl);
  }

  async renderDashboard(container) {
    container.empty();
    container.style.cssText = 'overflow-y: auto; padding: 20px; background: var(--background-primary);';

    // 메인 헤더
    const mainHeader = container.createDiv();
    mainHeader.style.cssText = 'margin-bottom: 24px;';
    
    const title = mainHeader.createEl('h1', { text: '📚 학습 전략 프로세서' });
    title.style.cssText = 'margin: 0 0 16px 0; font-size: 2em; background: linear-gradient(135deg, #3b82f6 0%, #1e40af 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;';
    
    // 헤더 버튼 그룹
    const headerButtons = mainHeader.createDiv();
    headerButtons.style.cssText = 'display: flex; gap: 8px; flex-wrap: wrap;';
    
    const refreshBtn = headerButtons.createEl('button', { text: '🔄 새로고침' });
    refreshBtn.style.cssText = 'padding: 8px 16px; background: var(--interactive-accent); color: var(--text-on-accent); border: none; border-radius: 6px; cursor: pointer; font-weight: 500; transition: all 0.2s;';
    refreshBtn.addEventListener('click', () => this.onOpen());
    refreshBtn.addEventListener('mouseenter', () => { refreshBtn.style.transform = 'translateY(-2px)'; refreshBtn.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)'; });
    refreshBtn.addEventListener('mouseleave', () => { refreshBtn.style.transform = 'translateY(0)'; refreshBtn.style.boxShadow = 'none'; });
    
    const exportBtn = headerButtons.createEl('button', { text: '📥 내보내기' });
    exportBtn.style.cssText = 'padding: 8px 16px; background: #10b981; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500; transition: all 0.2s;';
    exportBtn.addEventListener('click', () => { new DataExportModal(this.plugin.app, this.plugin).open(); });
    exportBtn.addEventListener('mouseenter', () => { exportBtn.style.transform = 'translateY(-2px)'; exportBtn.style.boxShadow = '0 4px 8px rgba(16,185,129,0.3)'; });
    exportBtn.addEventListener('mouseleave', () => { exportBtn.style.transform = 'translateY(0)'; exportBtn.style.boxShadow = 'none'; });

    const timerBtn = headerButtons.createEl('button', { text: '⏱️ 타이머' });
    timerBtn.style.cssText = 'padding: 8px 16px; background: #f59e0b; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500; transition: all 0.2s;';
    timerBtn.addEventListener('click', () => { new TimerModal(this.plugin.app, this.plugin).open(); });
    timerBtn.addEventListener('mouseenter', () => { timerBtn.style.transform = 'translateY(-2px)'; timerBtn.style.boxShadow = '0 4px 8px rgba(245,158,11,0.3)'; });
    timerBtn.addEventListener('mouseleave', () => { timerBtn.style.transform = 'translateY(0)'; timerBtn.style.boxShadow = 'none'; });

    // 탭 네비게이션
    const tabNav = mainHeader.createDiv();
    tabNav.style.cssText = 'display: flex; gap: 8px; margin-top: 16px; border-bottom: 3px solid var(--divider-color); padding-bottom: 12px; overflow-x: auto;';
    
    const tabs = [
      { id: 'summary', label: '📊 요약', color: '#3b82f6' },
      { id: 'recent', label: '📌 최근', color: '#8b5cf6' },
      { id: 'bookmarks', label: '⭐ 북마크', color: '#f59e0b' },
      { id: 'time', label: '⏱️ 시간', color: '#10b981' }
    ];
    
    const currentTab = this.currentTab || 'summary';
    
    tabs.forEach(tab => {
      const tabBtn = tabNav.createEl('button', { text: tab.label });
      tabBtn.style.cssText = `padding: 8px 16px; border: none; background: transparent; cursor: pointer; font-weight: ${currentTab === tab.id ? 'bold' : '500'}; color: ${currentTab === tab.id ? tab.color : 'var(--text-normal)'}; border-bottom: ${currentTab === tab.id ? `3px solid ${tab.color}` : 'none'}; transition: all 0.2s; white-space: nowrap;`;
      tabBtn.addEventListener('click', () => {
        this.currentTab = tab.id;
        this.onOpen();
      });
      tabBtn.addEventListener('mouseenter', () => {
        if (currentTab !== tab.id) tabBtn.style.color = tab.color;
      });
      tabBtn.addEventListener('mouseleave', () => {
        if (currentTab !== tab.id) tabBtn.style.color = 'var(--text-normal)';
      });
    });

    // 목표 요약 섹션 (모든 탭에서 표시)
    await this.renderGoalsSummary(container);

    // 탭 콘텐츠
    if (currentTab === 'summary') {
      await this.renderSummaryTab(container);
    } else if (currentTab === 'recent') {
      await this.renderRecentTab(container);
    } else if (currentTab === 'bookmarks') {
      await this.renderBookmarksTab(container);
    } else if (currentTab === 'time') {
      await this.renderTimeTab(container);
    }
  }

  async renderGoalsSummary(container) {
    const summarySection = container.createDiv();
    summarySection.style.cssText = 'background: linear-gradient(135deg, var(--background-secondary) 0%, var(--background-primary) 100%); padding: 20px; border-radius: 12px; margin-bottom: 24px; border: 2px solid var(--background-modifier-border); box-shadow: 0 4px 16px rgba(0,0,0,0.1);';
    
    const summaryGrid = summarySection.createDiv();
    summaryGrid.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 16px;';
    
    // 생성된 템플릿 카드
    const card1 = summaryGrid.createDiv();
    card1.style.cssText = 'background: linear-gradient(135deg, #3b82f6 0%, #1e40af 100%); color: white; padding: 20px; border-radius: 10px; cursor: pointer; transition: all 0.3s; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);';
    card1.addEventListener('mouseenter', () => { card1.style.transform = 'translateY(-4px)'; card1.style.boxShadow = '0 8px 20px rgba(59, 130, 246, 0.5)'; });
    card1.addEventListener('mouseleave', () => { card1.style.transform = 'translateY(0)'; card1.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.4)'; });
    
    const label1 = card1.createEl('div', { text: '📝 생성된 템플릿' });
    label1.style.cssText = 'font-size: 0.9em; opacity: 0.9; margin-bottom: 8px; font-weight: 500;';
    
    const value1 = card1.createEl('div', { text: this.plugin.settings.statistics.totalCreated.toString() });
    value1.style.cssText = 'font-size: 32px; font-weight: bold;';
    
    // 북마크 카드
    const card2 = summaryGrid.createDiv();
    card2.style.cssText = 'background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 20px; border-radius: 10px; cursor: pointer; transition: all 0.3s; box-shadow: 0 4px 12px rgba(245, 158, 11, 0.4);';
    card2.addEventListener('mouseenter', () => { card2.style.transform = 'translateY(-4px)'; card2.style.boxShadow = '0 8px 20px rgba(245, 158, 11, 0.5)'; });
    card2.addEventListener('mouseleave', () => { card2.style.transform = 'translateY(0)'; card2.style.boxShadow = '0 4px 12px rgba(245, 158, 11, 0.4)'; });
    
    const label2 = card2.createEl('div', { text: '⭐ 북마크' });
    label2.style.cssText = 'font-size: 0.9em; opacity: 0.9; margin-bottom: 8px; font-weight: 500;';
    
    const value2 = card2.createEl('div', { text: this.plugin.settings.bookmarks.length.toString() });
    value2.style.cssText = 'font-size: 32px; font-weight: bold;';
    
    // 완료 카드
    const completionRate = Object.keys(this.plugin.settings.statistics.completionRate).length;
    const card3 = summaryGrid.createDiv();
    card3.style.cssText = 'background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 20px; border-radius: 10px; cursor: pointer; transition: all 0.3s; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);';
    card3.addEventListener('mouseenter', () => { card3.style.transform = 'translateY(-4px)'; card3.style.boxShadow = '0 8px 20px rgba(16, 185, 129, 0.5)'; });
    card3.addEventListener('mouseleave', () => { card3.style.transform = 'translateY(0)'; card3.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.4)'; });
    
    const label3 = card3.createEl('div', { text: '✅ 완료' });
    label3.style.cssText = 'font-size: 0.9em; opacity: 0.9; margin-bottom: 8px; font-weight: 500;';
    
    const value3 = card3.createEl('div', { text: completionRate.toString() });
    value3.style.cssText = 'font-size: 32px; font-weight: bold;';
    
    // 오늘의 학습시간 카드
    const today = new Date().toISOString().split('T')[0];
    const todayTime = this.plugin.settings.statistics.timeTracking[today] || 0;
    const card4 = summaryGrid.createDiv();
    card4.style.cssText = 'background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: white; padding: 20px; border-radius: 10px; cursor: pointer; transition: all 0.3s; box-shadow: 0 4px 12px rgba(139, 92, 246, 0.4);';
    card4.addEventListener('mouseenter', () => { card4.style.transform = 'translateY(-4px)'; card4.style.boxShadow = '0 8px 20px rgba(139, 92, 246, 0.5)'; });
    card4.addEventListener('mouseleave', () => { card4.style.transform = 'translateY(0)'; card4.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.4)'; });
    
    const label4 = card4.createEl('div', { text: '⏱️ 오늘' });
    label4.style.cssText = 'font-size: 0.9em; opacity: 0.9; margin-bottom: 8px; font-weight: 500;';
    
    const value4 = card4.createEl('div', { text: `${todayTime}분` });
    value4.style.cssText = 'font-size: 32px; font-weight: bold;';
  }

  async renderSummaryTab(container) {
    const summaryDiv = container.createDiv();
    summaryDiv.style.cssText = 'margin-top: 24px;';
    
    const title = summaryDiv.createEl('h2', { text: '📊 통계 요약' });
    title.style.cssText = 'margin: 0 0 16px 0; color: #3b82f6;';
    
    const statsDiv = summaryDiv.createDiv();
    statsDiv.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px;';
    
    const stats = [
      { label: '총 템플릿', value: this.plugin.settings.statistics.totalCreated, icon: '📝', color: '#3b82f6' },
      { label: '북마크', value: this.plugin.settings.bookmarks.length, icon: '⭐', color: '#f59e0b' },
      { label: '완료', value: Object.keys(this.plugin.settings.statistics.completionRate).length, icon: '✅', color: '#10b981' },
      { label: '총 학습시간', value: Object.values(this.plugin.settings.statistics.timeTracking).reduce((a,b) => a+b, 0), unit: '분', icon: '⏱️', color: '#8b5cf6' }
    ];
    
    stats.forEach(stat => {
      const card = statsDiv.createDiv();
      card.style.cssText = `padding: 20px; border: 2px solid ${stat.color}; border-radius: 10px; background: var(--background-secondary); cursor: pointer; transition: all 0.3s;`;
      card.addEventListener('mouseenter', () => {
        card.style.transform = 'translateY(-4px)';
        card.style.boxShadow = `0 8px 16px rgba(${stat.color === '#3b82f6' ? '59,130,246' : stat.color === '#f59e0b' ? '245,158,11' : stat.color === '#10b981' ? '16,185,129' : '139,92,246'},0.3)`;
      });
      card.addEventListener('mouseleave', () => {
        card.style.transform = 'translateY(0)';
        card.style.boxShadow = 'none';
      });
      
      const label = card.createEl('div', { text: `${stat.icon} ${stat.label}` });
      label.style.cssText = `font-size: 0.95em; opacity: 0.8; margin-bottom: 12px; font-weight: 600; color: ${stat.color};`;
      
      const value = card.createEl('div', { text: `${stat.value}${stat.unit || ''}` });
      value.style.cssText = `font-size: 28px; font-weight: bold; color: ${stat.color};`;
    });
  }

  async renderRecentTab(container) {
    const recentDiv = container.createDiv();
    recentDiv.style.cssText = 'margin-top: 24px;';
    
    const title = recentDiv.createEl('h2', { text: '📌 최근 생성된 템플릿' });
    title.style.cssText = 'margin: 0 0 16px 0; color: #8b5cf6;';

    const files = this.plugin.app.vault.getMarkdownFiles()
      .filter(f => f.path.startsWith(this.plugin.settings.outputFolder))
      .sort((a, b) => (b.stat?.mtime || 0) - (a.stat?.mtime || 0))
      .slice(0, 15);

    if (files.length === 0) {
      const empty = recentDiv.createDiv();
      empty.style.cssText = 'padding: 40px; text-align: center; color: var(--text-muted);';
      empty.createEl('div', { text: '⚠️ 생성된 템플릿이 없습니다' });
      return;
    }
    
    const listDiv = recentDiv.createDiv();
    listDiv.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px;';
    
    files.forEach((file, idx) => {
      const item = listDiv.createDiv();
      item.style.cssText = 'padding: 16px; border-left: 5px solid #8b5cf6; background: var(--background-secondary); border-radius: 8px; cursor: pointer; transition: all 0.3s; box-shadow: 0 2px 8px rgba(0,0,0,0.05);';
      
      item.addEventListener('mouseenter', () => {
        item.style.backgroundColor = 'var(--background-modifier-hover)';
        item.style.transform = 'translateY(-4px)';
        item.style.boxShadow = '0 6px 16px rgba(139,92,246,0.2)';
      });
      item.addEventListener('mouseleave', () => {
        item.style.backgroundColor = 'var(--background-secondary)';
        item.style.transform = 'translateY(0)';
        item.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
      });
      
      item.addEventListener('click', () => {
        this.plugin.app.workspace.getLeaf(false).openFile(file);
      });

      // 컨텍스트 메뉴
      item.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const menu = new Menu(this.plugin.app);

        menu.addItem((menuItem) => {
          menuItem.setTitle('📝 편집').setIcon('pencil').onClick(() => {
            this.plugin.app.workspace.getLeaf(false).openFile(file);
          });
        });

        menu.addItem((menuItem) => {
          const isBookmarked = this.plugin.settings.bookmarks.includes(file.path);
          menuItem.setTitle(isBookmarked ? '⭐ 북마크 제거' : '☆ 북마크 추가')
            .setIcon(isBookmarked ? 'star' : 'star-empty')
            .onClick(() => {
              if (isBookmarked) {
                this.plugin.settings.bookmarks = this.plugin.settings.bookmarks.filter(b => b !== file.path);
              } else {
                this.plugin.settings.bookmarks.push(file.path);
              }
              this.plugin.saveSettings();
              this.onOpen();
            });
        });

        menu.addItem((menuItem) => {
          menuItem.setTitle('🏷️ 태그 추가').setIcon('tag').onClick(() => {
            new TagInputModal(this.plugin.app, this.plugin, file).open();
          });
        });

        menu.addItem((menuItem) => {
          menuItem.setTitle('🗑️ 삭제').setIcon('trash').onClick(async () => {
            if (confirm(`정말 ${file.name}을(를) 삭제하시겠습니까?`)) {
              await this.plugin.app.vault.delete(file);
              new Notice('✅ 파일이 삭제되었습니다');
              this.onOpen();
            }
          });
        });

        menu.showAtMouseEvent(e);
      });

      const numberBadge = item.createDiv();
      numberBadge.style.cssText = 'display: inline-block; background: #8b5cf6; color: white; padding: 2px 8px; border-radius: 4px; font-weight: bold; font-size: 0.8em; margin-bottom: 8px;';
      numberBadge.createEl('span', { text: `${idx + 1}번째` });
      
      const title = item.createEl('div', { text: file.name });
      title.style.cssText = 'font-weight: bold; margin-bottom: 8px; color: #2563eb; font-size: 1.05em;';
      
      const infoDiv = item.createDiv();
      infoDiv.style.cssText = 'display: flex; justify-content: space-between; align-items: center; font-size: 0.85em; opacity: 0.7;';
      
      const date = new Date(file.stat?.mtime || 0);
      const dateText = date.toLocaleDateString('ko-KR');
      const timeText = date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
      
      infoDiv.createEl('span', { text: `📅 ${dateText}` });
      infoDiv.createEl('span', { text: `🕐 ${timeText}` });
    });
  }

  async renderBookmarksTab(container) {
    const bookmarksDiv = container.createDiv();
    bookmarksDiv.style.cssText = 'margin-top: 24px;';
    
    const title = bookmarksDiv.createEl('h2', { text: '⭐ 북마크한 템플릿' });
    title.style.cssText = 'margin: 0 0 16px 0; color: #f59e0b;';

    if (this.plugin.settings.bookmarks.length === 0) {
      const empty = bookmarksDiv.createDiv();
      empty.style.cssText = 'padding: 40px; text-align: center; color: var(--text-muted);';
      empty.createEl('div', { text: '⚠️ 북마크한 템플릿이 없습니다' });
      return;
    }
    
    const listDiv = bookmarksDiv.createDiv();
    listDiv.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px;';
    
    this.plugin.settings.bookmarks.forEach((path, idx) => {
      const file = this.plugin.app.vault.getAbstractFileByPath(path);
      if (!file) return;

      const item = listDiv.createDiv();
      item.style.cssText = 'padding: 16px; border-left: 5px solid #f59e0b; background: var(--background-secondary); border-radius: 8px; cursor: pointer; transition: all 0.3s; box-shadow: 0 2px 8px rgba(0,0,0,0.05);';
      
      item.addEventListener('mouseenter', () => {
        item.style.backgroundColor = 'var(--background-modifier-hover)';
        item.style.transform = 'translateY(-4px)';
        item.style.boxShadow = '0 6px 16px rgba(245,158,11,0.2)';
      });
      item.addEventListener('mouseleave', () => {
        item.style.backgroundColor = 'var(--background-secondary)';
        item.style.transform = 'translateY(0)';
        item.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
      });
      
      item.addEventListener('click', () => {
        this.plugin.app.workspace.getLeaf(false).openFile(file);
      });

      const star = item.createDiv();
      star.style.cssText = 'display: inline-block; color: #f59e0b; font-size: 1.5em; margin-bottom: 8px;';
      star.createEl('span', { text: '⭐' });
      
      const title = item.createEl('div', { text: file.name });
      title.style.cssText = 'font-weight: bold; margin-bottom: 12px; color: #d97706; font-size: 1.05em;';
      
      const removeBtn = item.createEl('button', { text: '✕ 제거' });
      removeBtn.style.cssText = 'padding: 6px 12px; background: #fee2e2; color: #991b1b; border: none; border-radius: 4px; font-size: 0.85em; cursor: pointer; font-weight: 500; transition: all 0.2s;';
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.plugin.settings.bookmarks = this.plugin.settings.bookmarks.filter(b => b !== path);
        this.plugin.saveSettings();
        this.onOpen();
      });
      removeBtn.addEventListener('mouseenter', () => {
        removeBtn.style.background = '#fecaca';
      });
      removeBtn.addEventListener('mouseleave', () => {
        removeBtn.style.background = '#fee2e2';
      });
    });
  }

  async renderTimeTab(container) {
    const timeDiv = container.createDiv();
    timeDiv.style.cssText = 'margin-top: 24px;';
    
    const title = timeDiv.createEl('h2', { text: '⏱️ 학습 시간 통계' });
    title.style.cssText = 'margin: 0 0 16px 0; color: #10b981;';

    const timeTracking = this.plugin.settings.statistics.timeTracking || {};
    const totalTime = Object.values(timeTracking).reduce((a,b) => a+b, 0);
    
    const summaryDiv = timeDiv.createDiv();
    summaryDiv.style.cssText = 'background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 24px; border-radius: 10px; margin-bottom: 24px; box-shadow: 0 4px 16px rgba(16,185,129,0.3);';
    
    const totalDiv = summaryDiv.createEl('div', { text: `📊 총 학습 시간: ${totalTime}분` });
    totalDiv.style.cssText = 'font-size: 1.5em; font-weight: bold; margin-bottom: 12px;';
    
    const daysDiv = summaryDiv.createEl('div', { text: `📅 기록된 날짜: ${Object.keys(timeTracking).length}일` });
    daysDiv.style.cssText = 'font-size: 1.1em; opacity: 0.9;';

    const listDiv = timeDiv.createDiv();
    
    const sortedDates = Object.entries(timeTracking)
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 30);

    if (sortedDates.length === 0) {
      listDiv.style.cssText = 'padding: 40px; text-align: center; color: var(--text-muted);';
      listDiv.createEl('div', { text: '⚠️ 기록된 학습 시간이 없습니다' });
    } else {
      listDiv.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px;';
      
      sortedDates.forEach(([date, minutes]) => {
        const item = listDiv.createDiv();
        item.style.cssText = 'padding: 16px; background: var(--background-secondary); border-radius: 8px; border-left: 5px solid #10b981; box-shadow: 0 2px 8px rgba(0,0,0,0.05);';
        
        const dateText = new Date(date).toLocaleDateString('ko-KR');
        const dateEl = item.createEl('div', { text: dateText });
        dateEl.style.cssText = 'font-weight: bold; margin-bottom: 12px; color: #059669; font-size: 1.05em;';
        
        const barDiv = item.createDiv();
        barDiv.style.cssText = 'margin-bottom: 8px;';
        
        const percentage = Math.min((minutes / 180) * 100, 100);
        const bar = barDiv.createDiv();
        bar.style.cssText = 'background: var(--background-primary); height: 28px; border-radius: 6px; overflow: hidden; margin-bottom: 8px;';
        
        const fill = bar.createDiv();
        fill.style.cssText = `width: ${percentage}%; height: 100%; background: linear-gradient(90deg, #10b981 0%, #059669 100%); transition: width 0.3s; display: flex; align-items: center; justify-content: flex-end; padding-right: 8px;`;
        
        const fillText = fill.createEl('span', { text: `${Math.round(percentage)}%` });
        fillText.style.cssText = 'color: white; font-weight: bold; font-size: 0.85em;';
        
        const timeEl = item.createEl('div', { text: `⏱️ ${minutes}분` });
        timeEl.style.cssText = 'font-weight: bold; color: #10b981; font-size: 1.1em;';
      });
    }
  }

  async onClose() {
    // 닫기
  }
}

// ========================
// 태그 입력 모달
// ========================
class TagInputModal extends Modal {
  constructor(app, plugin, file) {
    super(app);
    this.plugin = plugin;
    this.file = file;
  }

  async onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl('h2', { text: '🏷️ 태그 추가' });

    const desc = contentEl.createDiv();
    desc.createEl('p', { text: `파일: ${this.file.name}` });

    const input = contentEl.createEl('input', {
      type: 'text',
      placeholder: '태그를 입력하세요 (쉼표로 구분)'
    });
    input.style.width = '100%';
    input.style.padding = '8px';
    input.style.marginBottom = '16px';

    const buttonDiv = contentEl.createDiv();
    buttonDiv.style.display = 'flex';
    buttonDiv.style.gap = '8px';

    const saveBtn = buttonDiv.createEl('button', { text: '저장' });
    saveBtn.onclick = async () => {
      const tags = input.value.split(',').map(t => t.trim()).filter(t => t);
      if (tags.length > 0) {
        const content = await this.plugin.app.vault.read(this.file);
        const tagStr = tags.map(t => `#${t}`).join(' ');
        const newContent = content + '\n\n' + tagStr;
        await this.plugin.app.vault.modify(this.file, newContent);
        new Notice(`✅ ${tags.length}개의 태그가 추가되었습니다`);
        this.close();
      }
    };

    const closeBtn = buttonDiv.createEl('button', { text: '취소' });
    closeBtn.onclick = () => this.close();
  }

  onClose() {
    this.contentEl.empty();
  }
}

// ========================
// 타이머 모달 (학습 시간 기록)
// ========================
class TimerModal extends Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
    this.isRunning = false;
    this.duration = 0;
    this.startTime = 0;
    this.interval = null;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('timer-modal');

    contentEl.createEl('h2', { text: '⏱️ 학습 타이머' });

    // 입력 영역
    const inputDiv = contentEl.createDiv();
    inputDiv.style.marginBottom = '16px';
    
    inputDiv.createEl('label', { text: '학습 시간 (분):' });
    const input = inputDiv.createEl('input', {
      type: 'number',
      placeholder: '예: 30',
      value: '30'
    });
    input.style.width = '100%';
    input.style.padding = '8px';
    input.style.marginTop = '8px';

    // 타이머 표시
    const displayDiv = contentEl.createDiv();
    displayDiv.style.textAlign = 'center';
    displayDiv.style.marginBottom = '16px';

    const timerDisplay = displayDiv.createEl('div', { text: '00:00' });
    timerDisplay.style.fontSize = '48px';
    timerDisplay.style.fontWeight = 'bold';
    timerDisplay.style.fontFamily = 'monospace';

    // 버튼 영역
    const buttonDiv = contentEl.createDiv();
    buttonDiv.style.display = 'flex';
    buttonDiv.style.gap = '8px';

    const startBtn = buttonDiv.createEl('button', { text: '▶ 시작' });
    startBtn.style.flex = '1';
    startBtn.onclick = () => {
      const minutes = parseInt(input.value);
      if (minutes > 0) {
        this.startTimer(minutes * 60, timerDisplay, startBtn, pauseBtn);
        input.disabled = true;
      } else {
        new Notice('⚠️ 1분 이상 설정하세요');
      }
    };

    const pauseBtn = buttonDiv.createEl('button', { text: '⏸ 일시정지' });
    pauseBtn.style.flex = '1';
    pauseBtn.disabled = true;
    pauseBtn.onclick = () => this.pauseTimer(timerDisplay, startBtn, pauseBtn);

    const resetBtn = buttonDiv.createEl('button', { text: '⟲ 리셋' });
    resetBtn.style.flex = '1';
    resetBtn.onclick = () => this.resetTimer(timerDisplay, startBtn, pauseBtn, input);

    // 저장 버튼
    const saveDiv = contentEl.createDiv();
    saveDiv.style.marginTop = '16px';
    
    const saveBtn = saveDiv.createEl('button', { text: '💾 기록 저장' });
    saveBtn.style.width = '100%';
    saveBtn.style.padding = '8px';
    saveBtn.onclick = () => {
      const studied = input.value;
      if (studied > 0) {
        this.saveStudyRecord(studied);
        this.close();
      }
    };
  }

  startTimer(seconds, display, startBtn, pauseBtn) {
    this.isRunning = true;
    this.startTime = Date.now();
    this.duration = seconds;
    startBtn.disabled = true;
    pauseBtn.disabled = false;

    this.interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
      const remaining = Math.max(0, this.duration - elapsed);

      const mins = Math.floor(remaining / 60);
      const secs = remaining % 60;
      display.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

      if (remaining === 0) {
        clearInterval(this.interval);
        this.isRunning = false;
        new Notice('✅ 학습 시간이 끝났습니다!');
        startBtn.disabled = false;
        pauseBtn.disabled = true;
      }
    }, 1000);
  }

  pauseTimer(display, startBtn, pauseBtn) {
    if (this.interval) {
      clearInterval(this.interval);
      this.isRunning = false;
      startBtn.disabled = false;
      pauseBtn.disabled = true;
    }
  }

  resetTimer(display, startBtn, pauseBtn, input) {
    if (this.interval) {
      clearInterval(this.interval);
    }
    display.textContent = '00:00';
    this.isRunning = false;
    this.duration = 0;
    startBtn.disabled = false;
    pauseBtn.disabled = true;
    input.disabled = false;
  }

  saveStudyRecord(minutes) {
    const today = new Date().toISOString().split('T')[0];
    if (!this.plugin.settings.statistics.timeTracking[today]) {
      this.plugin.settings.statistics.timeTracking[today] = 0;
    }
    this.plugin.settings.statistics.timeTracking[today] += parseInt(minutes);
    this.plugin.saveSettings();
    new Notice(`✅ ${minutes}분의 학습 기록이 저장되었습니다`);
  }

  onClose() {
    if (this.interval) {
      clearInterval(this.interval);
    }
    this.contentEl.empty();
  }
}

// ========================
// 배치 큐 시스템
// ========================
class BatchQueue {
  constructor(plugin) {
    this.plugin = plugin;
    this.queue = [];
    this.isProcessing = false;
    this.currentIndex = 0;
  }

  addTask(content, suggestedName = '') {
    this.queue.push({ content, suggestedName, status: 'pending' });
  }

  async processQueue(onProgress) {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    const results = [];

    for (let i = 0; i < this.queue.length; i++) {
      this.currentIndex = i;
      const task = this.queue[i];

      try {
        const result = {
          originalContent: task.content,
          timestamp: new Date().toISOString()
        };

        const filepath = await this.plugin.saveToFile(result, task.suggestedName);
        task.status = 'completed';
        results.push({ success: true, filepath });

        if (onProgress) {
          onProgress({
            current: i + 1,
            total: this.queue.length,
            percentage: Math.round(((i + 1) / this.queue.length) * 100)
          });
        }
      } catch (error) {
        task.status = 'failed';
        results.push({ success: false, error: error.message });
      }
    }

    this.isProcessing = false;
    this.queue = [];
    return results;
  }

  clearQueue() {
    this.queue = [];
    this.isProcessing = false;
    this.currentIndex = 0;
  }
}

// ========================
// 배치 진행률 모달
// ========================
class BatchProgressModal extends Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
    this.queue = new BatchQueue(plugin);
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('batch-progress-modal');

    contentEl.createEl('h2', { text: '⚡ 배치 작업 진행' });

    // 진행률 바
    const progressDiv = contentEl.createDiv();
    progressDiv.style.marginBottom = '16px';

    const progressBar = progressDiv.createEl('div');
    progressBar.style.width = '100%';
    progressBar.style.height = '24px';
    progressBar.style.backgroundColor = 'var(--background-secondary)';
    progressBar.style.borderRadius = '4px';
    progressBar.style.overflow = 'hidden';

    const progressFill = progressBar.createEl('div');
    progressFill.style.height = '100%';
    progressFill.style.backgroundColor = '#059669';
    progressFill.style.width = '0%';
    progressFill.style.transition = 'width 0.3s';

    const progressText = progressDiv.createEl('div');
    progressText.style.textAlign = 'center';
    progressText.style.marginTop = '8px';
    progressText.textContent = '0%';

    // 상태 메시지
    const statusDiv = contentEl.createDiv();
    const statusMsg = statusDiv.createEl('div', { text: '준비 중...' });
    statusMsg.style.marginBottom = '16px';

    // 결과 목록
    const resultsDiv = contentEl.createDiv();
    resultsDiv.style.maxHeight = '200px';
    resultsDiv.style.overflowY = 'auto';
    resultsDiv.style.marginBottom = '16px';

    // 버튼
    const buttonDiv = contentEl.createDiv();
    buttonDiv.style.display = 'flex';
    buttonDiv.style.gap = '8px';

    const startBtn = buttonDiv.createEl('button', { text: '▶ 시작' });
    startBtn.onclick = async () => {
      startBtn.disabled = true;
      cancelBtn.disabled = false;
      
      const results = await this.queue.processQueue((progress) => {
        progressFill.style.width = progress.percentage + '%';
        progressText.textContent = `${progress.percentage}%`;
        statusMsg.textContent = `${progress.current} / ${progress.total} 완료`;
      });

      // 결과 표시
      resultsDiv.empty();
      results.forEach(result => {
        const item = resultsDiv.createEl('div');
        item.style.padding = '8px';
        item.style.marginBottom = '4px';
        item.style.borderRadius = '4px';
        
        if (result.success) {
          item.style.backgroundColor = '#d1fae5';
          item.createEl('div', { text: `✅ ${result.filepath}` });
        } else {
          item.style.backgroundColor = '#fee2e2';
          item.createEl('div', { text: `❌ ${result.error}` });
        }
      });

      new Notice(`✅ 배치 작업 완료 (${results.filter(r => r.success).length}/${results.length})`);
      startBtn.disabled = false;
      cancelBtn.disabled = true;
    };

    const cancelBtn = buttonDiv.createEl('button', { text: '✕ 취소' });
    cancelBtn.disabled = true;
    cancelBtn.onclick = () => {
      this.queue.clearQueue();
      this.close();
      new Notice('❌ 배치 작업이 취소되었습니다');
    };
  }

  addTask(content, suggestedName = '') {
    this.queue.addTask(content, suggestedName);
  }

  onClose() {
    this.contentEl.empty();
  }
}

