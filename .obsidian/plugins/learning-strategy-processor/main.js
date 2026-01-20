const { Plugin, ItemView, WorkspaceLeaf, Modal, PluginSettingTab, Setting, Notice, TFile, TFolder } = require('obsidian');

const VIEW_TYPE = 'learning-strategy-view';

// 기본 설정
const DEFAULT_SETTINGS = {
  strategiesList: [
    { id: '1', name: '📝 조직화', description: '정보 구조화 및 목차화', icon: '📑' },
    { id: '2', name: '🔗 맥락화', description: '전체 흐름과 연결 관계 파악', icon: '🔗' },
    { id: '3', name: '🎨 정교화', description: '기존 지식과 연결 및 이미지화', icon: '💡' }
  ],
  outputFolder: 'Learning',
  folderStructure: 'monthly',
  autoCreateFolder: true,
  themeColor: '#3b82f6',
  statistics: {
    totalCreated: 0,
    completionRate: {},
    timeTracking: {}
  },
  bookmarks: [],
  templates: [] // 생성된 템플릿 저장
};

// 학습 전략 뷰
class LearningStrategyView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.currentDate = new Date();
    this.currentView = 'dashboard'; // 'dashboard', 'strategies', 'daily'
  }

  getViewType() {
    return VIEW_TYPE;
  }

  getDisplayText() {
    return '📚 Learning Strategy';
  }

  getIcon() {
    return 'brain-circuit';
  }

  async onOpen() {
    const container = this.containerEl.children[1];
    container.empty();
    container.style.height = '100%';
    container.style.overflow = 'hidden';
    container.style.padding = '0';
    container.style.margin = '0';
    
    this.addStyles();
    this.setupResponsive(container);
    
    const mainContainer = container.createDiv({ cls: 'learning-strategy-container' });
    
    const header = mainContainer.createDiv({ cls: 'ls-header' });
    this.renderHeader(header);
    
    const contentWrapper = mainContainer.createDiv({ cls: 'ls-content-wrapper' });
    
    const sidebar = contentWrapper.createDiv({ cls: 'ls-sidebar' });
    this.renderSidebar(sidebar);
    
    const main = contentWrapper.createDiv({ cls: 'ls-main' });
    
    if (this.currentView === 'dashboard') {
      await this.renderDashboard(main);
    } else if (this.currentView === 'strategies') {
      this.renderStrategiesView(main);
    } else if (this.currentView === 'daily') {
      await this.renderDailyView(main);
    }
  }

  setupResponsive(container) {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    
    this.resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        const width = entry.contentRect.width;
        container.classList.remove('ls-mobile', 'ls-tablet', 'ls-small-mobile');
        
        if (width <= 480) {
          container.classList.add('ls-small-mobile');
        } else if (width <= 768) {
          container.classList.add('ls-mobile');
        } else if (width <= 1024) {
          container.classList.add('ls-tablet');
        }
      }
    });
    
    this.resizeObserver.observe(container);
  }

  renderHeader(header) {
    header.empty();
    
    const title = header.createDiv({ cls: 'ls-header-title' });
    title.setText('📚 Learning Strategy Processor');
    
    const nav = header.createDiv({ cls: 'ls-header-nav' });
    
    const dashboardBtn = nav.createEl('button', { cls: 'ls-nav-btn' });
    dashboardBtn.setText('📊 Dashboard');
    if (this.currentView === 'dashboard') dashboardBtn.addClass('active');
    dashboardBtn.addEventListener('click', () => {
      this.currentView = 'dashboard';
      this.onOpen();
    });
    
    const strategiesBtn = nav.createEl('button', { cls: 'ls-nav-btn' });
    strategiesBtn.setText('🧠 Strategies');
    if (this.currentView === 'strategies') strategiesBtn.addClass('active');
    strategiesBtn.addEventListener('click', () => {
      this.currentView = 'strategies';
      this.onOpen();
    });
    
    const dailyBtn = nav.createEl('button', { cls: 'ls-nav-btn' });
    dailyBtn.setText('📝 Daily');
    if (this.currentView === 'daily') dailyBtn.addClass('active');
    dailyBtn.addEventListener('click', () => {
      this.currentView = 'daily';
      this.onOpen();
    });
  }

  renderSidebar(sidebar) {
    sidebar.empty();
    
    // 통계 섹션
    const statsSection = sidebar.createDiv({ cls: 'ls-section' });
    const statsTitle = statsSection.createDiv({ cls: 'ls-section-title' });
    statsTitle.setText('📊 Statistics');
    
    const statsList = statsSection.createDiv({ cls: 'ls-stats-list' });
    
    const totalStat = statsList.createDiv({ cls: 'ls-stat-item' });
    totalStat.createDiv({ cls: 'ls-stat-label' }).setText('생성된 템플릿');
    totalStat.createDiv({ cls: 'ls-stat-value' }).setText(this.plugin.settings.statistics.totalCreated.toString());
    
    const bookmarkStat = statsList.createDiv({ cls: 'ls-stat-item' });
    bookmarkStat.createDiv({ cls: 'ls-stat-label' }).setText('북마크');
    bookmarkStat.createDiv({ cls: 'ls-stat-value' }).setText(this.plugin.settings.bookmarks.length.toString());
    
    const todayStat = statsList.createDiv({ cls: 'ls-stat-item' });
    const today = new Date().toISOString().split('T')[0];
    const todayTime = this.plugin.settings.statistics.timeTracking[today] || 0;
    todayStat.createDiv({ cls: 'ls-stat-label' }).setText("오늘");
    todayStat.createDiv({ cls: 'ls-stat-value' }).setText(`${todayTime}분`);
    
    // 빠른 작업 섹션
    const actionSection = sidebar.createDiv({ cls: 'ls-section' });
    const actionTitle = actionSection.createDiv({ cls: 'ls-section-title' });
    actionTitle.setText('⚡ Quick Actions');
    
    const createBtn = actionSection.createDiv({ cls: 'ls-action-btn' });
    createBtn.setText('➕ 템플릿 생성');
    createBtn.addEventListener('click', () => {
      new StrategyInputModal(this.app, this.plugin, async () => {
        await this.plugin.saveSettings();
        this.onOpen();
      }).open();
    });
    
    const timerBtn = actionSection.createDiv({ cls: 'ls-action-btn' });
    timerBtn.setText('⏱️ 타이머');
    timerBtn.addEventListener('click', () => {
      new TimerModal(this.app, this.plugin).open();
    });
    
    const exportBtn = actionSection.createDiv({ cls: 'ls-action-btn' });
    exportBtn.setText('📥 내보내기');
    exportBtn.addEventListener('click', () => {
      this.exportData();
    });
  }

  async renderDashboard(main) {
    main.empty();
    
    const scrollContainer = main.createDiv({ cls: 'ls-dashboard-container' });
    
    // 목표 카드들
    const cardsDiv = scrollContainer.createDiv({ cls: 'ls-cards-grid' });
    
    const totalCard = cardsDiv.createDiv({ cls: 'ls-stat-card' });
    totalCard.style.cssText = 'background: linear-gradient(135deg, #3b82f6 0%, #1e40af 100%);';
    totalCard.createEl('div', { text: '📝 생성된 템플릿' }).style.cssText = 'font-size: 0.9em; opacity: 0.9;';
    totalCard.createEl('div', { text: this.plugin.settings.statistics.totalCreated.toString() }).style.cssText = 'font-size: 32px; font-weight: bold; margin-top: 8px;';
    
    const bookmarkCard = cardsDiv.createDiv({ cls: 'ls-stat-card' });
    bookmarkCard.style.cssText = 'background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);';
    bookmarkCard.createEl('div', { text: '⭐ 북마크' }).style.cssText = 'font-size: 0.9em; opacity: 0.9;';
    bookmarkCard.createEl('div', { text: this.plugin.settings.bookmarks.length.toString() }).style.cssText = 'font-size: 32px; font-weight: bold; margin-top: 8px;';
    
    const timeCard = cardsDiv.createDiv({ cls: 'ls-stat-card' });
    timeCard.style.cssText = 'background: linear-gradient(135deg, #10b981 0%, #059669 100%);';
    timeCard.createEl('div', { text: '⏱️ 오늘' }).style.cssText = 'font-size: 0.9em; opacity: 0.9;';
    const today = new Date().toISOString().split('T')[0];
    const todayTime = this.plugin.settings.statistics.timeTracking[today] || 0;
    timeCard.createEl('div', { text: `${todayTime}분` }).style.cssText = 'font-size: 32px; font-weight: bold; margin-top: 8px;';
    
    // 최근 생성된 템플릿
    const recentSection = scrollContainer.createDiv({ cls: 'ls-section' });
    const recentTitle = recentSection.createDiv({ cls: 'ls-section-title' });
    recentTitle.setText('📌 최근 생성됨');
    
    const files = this.plugin.app.vault.getMarkdownFiles()
      .filter(f => f.path.startsWith(this.plugin.settings.outputFolder))
      .sort((a, b) => (b.stat?.mtime || 0) - (a.stat?.mtime || 0))
      .slice(0, 5);
    
    if (files.length === 0) {
      recentSection.createEl('p', { text: '생성된 템플릿이 없습니다' });
    } else {
      const recentList = recentSection.createDiv({ cls: 'ls-recent-list' });
      files.forEach((file, idx) => {
        const itemContainer = recentList.createDiv({ cls: 'ls-recent-item-container' });
        
        const item = itemContainer.createDiv({ cls: 'ls-recent-item' });
        item.setText(`${idx + 1}. ${file.name}`);
        item.addEventListener('click', () => {
          this.plugin.app.workspace.getLeaf(false).openFile(file);
        });
        
        // 수정 버튼
        const editBtn = itemContainer.createEl('button', { text: '✏️ 편집' });
        editBtn.style.cssText = 'padding: 4px 8px; font-size: 0.8em; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer; margin-left: auto;';
        editBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          new StrategyEditorModal(this.app, this.plugin, file, async () => {
            await this.plugin.saveSettings();
            this.onOpen();
          }).open();
        });
      });
    }
  }

  renderStrategiesView(main) {
    main.empty();
    
    const scrollContainer = main.createDiv({ cls: 'ls-strategies-container' });
    
    const title = scrollContainer.createDiv({ cls: 'ls-view-title' });
    title.setText('🧠 학습 전략');
    
    const strategiesGrid = scrollContainer.createDiv({ cls: 'ls-strategies-grid' });
    
    this.plugin.settings.strategiesList.forEach(strategy => {
      const card = strategiesGrid.createDiv({ cls: 'ls-strategy-card' });
      
      const icon = card.createEl('div', { text: strategy.icon });
      icon.style.cssText = 'font-size: 3em; margin-bottom: 12px;';
      
      const name = card.createEl('div', { text: strategy.name });
      name.style.cssText = 'font-weight: bold; font-size: 1.1em; margin-bottom: 8px;';
      
      const desc = card.createEl('div', { text: strategy.description });
      desc.style.cssText = 'font-size: 0.9em; opacity: 0.8; margin-bottom: 16px;';
      
      // 대화형 입력 버튼
      const inputBtn = card.createEl('button', { text: '💬 대화형 입력' });
      inputBtn.style.cssText = 'width: 100%; padding: 8px; background: var(--interactive-accent); color: var(--text-on-accent); border: none; border-radius: 4px; cursor: pointer; margin-bottom: 8px;';
      inputBtn.addEventListener('click', () => {
        new InteractiveStrategyModal(this.app, this.plugin, strategy, async () => {
          await this.plugin.saveSettings();
          this.renderDailyView(main);
        }).open();
      });
      
      const detailBtn = card.createEl('button', { text: '자세히 보기' });
      detailBtn.style.cssText = 'width: 100%; padding: 8px; background: var(--background-secondary); color: var(--text-normal); border: 1px solid var(--divider-color); border-radius: 4px; cursor: pointer;';
      detailBtn.addEventListener('click', () => {
        new StrategyDetailModal(this.app, strategy).open();
      });
    });
  }

  async renderDailyView(main) {
    main.empty();
    
    const scrollContainer = main.createDiv({ cls: 'ls-daily-container' });
    
    // 날짜 네비게이션
    const dateHeader = scrollContainer.createDiv({ cls: 'ls-date-header' });
    
    const prevBtn = dateHeader.createEl('button');
    prevBtn.setText('◀');
    prevBtn.addEventListener('click', () => {
      this.currentDate.setDate(this.currentDate.getDate() - 1);
      this.onOpen();
    });
    
    const dateTitle = dateHeader.createDiv({ cls: 'ls-date-title' });
    dateTitle.setText(this.formatDateKorean(this.currentDate));
    
    const nextBtn = dateHeader.createEl('button');
    nextBtn.setText('▶');
    nextBtn.addEventListener('click', () => {
      this.currentDate.setDate(this.currentDate.getDate() + 1);
      this.onOpen();
    });
    
    // 학습 템플릿 섹션
    const templateSection = scrollContainer.createDiv({ cls: 'ls-section' });
    const templateHeader = templateSection.createDiv({ cls: 'ls-section-title' });
    templateHeader.setText('📝 학습 템플릿');
    
    // 전략별 입력 버튼
    const strategyButtonsDiv = templateSection.createDiv();
    strategyButtonsDiv.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; margin-bottom: 16px;';
    
    this.plugin.settings.strategiesList.forEach(strategy => {
      const btn = strategyButtonsDiv.createEl('button');
      btn.setText(`${strategy.icon} ${strategy.name}`);
      btn.style.cssText = 'padding: 10px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500;';
      btn.addEventListener('click', () => {
        new InteractiveStrategyModal(this.app, this.plugin, strategy, async () => {
          await this.plugin.saveSettings();
          this.renderDailyView(main);
        }).open();
      });
    });
  }

  formatDateKorean(date) {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${days[date.getDate()]})`;
  }

  async exportData() {
    const data = {
      exportDate: new Date().toISOString(),
      statistics: this.plugin.settings.statistics,
      totalBookmarks: this.plugin.settings.bookmarks.length
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `learning-strategy-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    new Notice('✅ 데이터가 내보내졌습니다');
  }

  addStyles() {
    if (document.getElementById('learning-strategy-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'learning-strategy-styles';
    style.textContent = `
      .learning-strategy-container {
        display: flex;
        flex-direction: column;
        height: 100%;
        max-height: 100%;
        background-color: var(--background-primary);
        color: var(--text-normal);
        overflow: hidden;
        padding: 0;
        margin: 0;
      }

      .ls-content-wrapper {
        display: flex;
        flex: 1;
        overflow: hidden;
        min-height: 0;
      }

      .ls-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 24px;
        background-color: var(--background-secondary);
        border-bottom: 2px solid #3b82f6;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      }

      .ls-header-title {
        font-size: 1.4rem;
        font-weight: bold;
        color: #3b82f6;
      }

      .ls-header-nav {
        display: flex;
        gap: 8px;
      }

      .ls-nav-btn {
        background-color: var(--background-primary);
        color: var(--text-normal);
        border: 1px solid var(--divider-color);
        padding: 8px 16px;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s;
        font-size: 0.95rem;
        font-weight: 500;
      }

      .ls-nav-btn:hover {
        background-color: var(--background-modifier-hover);
        border-color: #3b82f6;
        transform: translateY(-1px);
      }

      .ls-nav-btn.active {
        background-color: #3b82f6;
        color: white;
        font-weight: bold;
        border-color: #3b82f6;
        box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
      }

      .ls-sidebar {
        width: 280px;
        background-color: var(--background-secondary);
        display: flex;
        flex-direction: column;
        padding: 20px;
        gap: 20px;
        overflow-y: auto;
        border-right: 1px solid var(--divider-color);
      }

      .ls-main {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      .ls-section {
        background-color: var(--background-secondary);
        border-radius: 8px;
        padding: 16px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      }

      .ls-section-title {
        font-weight: bold;
        margin-bottom: 12px;
        color: #3b82f6;
        font-size: 1rem;
      }

      .ls-stats-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .ls-stat-item {
        background-color: var(--background-primary);
        padding: 12px;
        border-radius: 6px;
        border-left: 4px solid #3b82f6;
      }

      .ls-stat-label {
        font-size: 0.85em;
        color: var(--text-muted);
        margin-bottom: 4px;
      }

      .ls-stat-value {
        font-size: 1.5em;
        font-weight: bold;
        color: #3b82f6;
      }

      .ls-action-btn {
        width: 100%;
        padding: 12px;
        background-color: var(--background-primary);
        color: var(--text-normal);
        border: 1px solid var(--divider-color);
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s;
        margin-bottom: 8px;
        font-weight: 500;
      }

      .ls-action-btn:hover {
        background-color: var(--background-modifier-hover);
        border-color: #3b82f6;
        transform: translateX(2px);
      }

      .ls-dashboard-container,
      .ls-strategies-container,
      .ls-daily-container {
        overflow-y: auto;
        padding: 20px;
        flex: 1;
      }

      .ls-cards-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 16px;
        margin-bottom: 24px;
      }

      .ls-stat-card {
        color: white;
        padding: 20px;
        border-radius: 10px;
        cursor: pointer;
        transition: all 0.3s;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      }

      .ls-stat-card:hover {
        transform: translateY(-4px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      }

      .ls-recent-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .ls-recent-item {
        padding: 12px;
        background-color: var(--background-primary);
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s;
        border-left: 4px solid #3b82f6;
      }

      .ls-recent-item:hover {
        background-color: var(--background-modifier-hover);
        transform: translateX(4px);
      }

      .ls-strategies-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 16px;
      }

      .ls-strategy-card {
        background-color: var(--background-secondary);
        padding: 20px;
        border-radius: 10px;
        text-align: center;
        cursor: pointer;
        transition: all 0.3s;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        border: 2px solid transparent;
      }

      .ls-strategy-card:hover {
        border-color: #3b82f6;
        transform: translateY(-4px);
        box-shadow: 0 4px 16px rgba(59, 130, 246, 0.2);
      }

      .ls-date-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px;
        background-color: var(--background-secondary);
        border-radius: 8px;
        margin-bottom: 20px;
      }

      .ls-date-header button {
        background-color: var(--background-primary);
        border: 1px solid var(--divider-color);
        padding: 8px 12px;
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.2s;
      }

      .ls-date-header button:hover {
        background-color: var(--background-modifier-hover);
        border-color: #3b82f6;
      }

      .ls-date-title {
        font-size: 1.2em;
        font-weight: bold;
        color: var(--text-normal);
      }

      .ls-view-title {
        font-size: 1.8em;
        font-weight: bold;
        color: var(--text-normal);
        margin-bottom: 24px;
      }

      /* 모달 스타일 */
      .learning-strategy-modal {
        padding: 20px;
      }

      .learning-strategy-modal h2 {
        margin-top: 0;
        color: #3b82f6;
      }

      .learning-strategy-modal textarea,
      .learning-strategy-modal input {
        width: 100%;
        padding: 12px;
        margin: 8px 0;
        border: 1px solid var(--divider-color);
        border-radius: 6px;
        background-color: var(--background-primary);
        color: var(--text-normal);
        font-family: inherit;
      }

      .modal-buttons {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
        margin-top: 20px;
      }

      .modal-buttons button {
        padding: 10px 20px;
        border-radius: 6px;
        border: none;
        cursor: pointer;
        font-weight: 500;
        transition: all 0.2s;
      }

      .modal-buttons button.mod-cta {
        background-color: #3b82f6;
        color: white;
      }

      .modal-buttons button.mod-cta:hover {
        background-color: #1e40af;
      }

      .modal-buttons button {
        background-color: var(--background-secondary);
        color: var(--text-normal);
        border: 1px solid var(--divider-color);
      }

      .modal-buttons button:hover {
        background-color: var(--background-modifier-hover);
      }
    `;
    
    document.head.appendChild(style);
  }
}

// 학습 입력 모달
class StrategyInputModal extends Modal {
  constructor(app, plugin, onSuccess) {
    super(app);
    this.plugin = plugin;
    this.onSuccess = onSuccess;
    this.content = '';
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('learning-strategy-modal');

    contentEl.createEl('h2', { text: '📚 새 학습 템플릿 생성' });
    
    const description = contentEl.createEl('p');
    description.setText('학습할 정보를 입력하면 조직화 → 맥락화 → 정교화 템플릿이 생성됩니다.');
    
    // 예시 버튼
    const examplesDiv = contentEl.createDiv();
    examplesDiv.style.marginBottom = '16px';
    examplesDiv.createEl('strong', { text: '💡 예시 (클릭하면 입력됨):' });
    
    const examples = [
      { title: '🌱 광합성', content: '광합성은 식물이 빛 에너지를 이용해 이산화탄소와 물로 포도당을 만드는 과정이다.' },
      { title: '💻 Python', content: 'Python의 for 루프는 반복문의 한 종류로, 리스트의 각 요소를 순회하면서 코드를 실행한다.' }
    ];
    
    const examplesContainer = contentEl.createDiv();
    examplesContainer.style.cssText = 'display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px;';
    
    examples.forEach(ex => {
      const btn = examplesContainer.createEl('button', { text: ex.title });
      btn.style.cssText = 'padding: 6px 12px; background: var(--background-secondary); border: 1px solid var(--divider-color); border-radius: 4px; cursor: pointer;';
      btn.addEventListener('click', () => {
        textarea.value = ex.content;
        this.content = ex.content;
      });
    });
    
    // 입력 영역
    const label = contentEl.createEl('label', { text: '학습할 정보:' });
    label.style.display = 'block';
    label.style.marginBottom = '8px';
    label.style.fontWeight = 'bold';
    
    const textarea = contentEl.createEl('textarea', {
      placeholder: '학습하고 싶은 정보를 입력하세요...\n예: 미토콘드리아는 세포의 에너지 공장 역할을 하며 ATP를 생성한다.'
    });
    textarea.style.cssText = 'min-height: 120px; resize: vertical;';
    textarea.addEventListener('input', (e) => {
      this.content = e.target.value;
    });
    
    // 버튼
    const buttonDiv = contentEl.createDiv({ cls: 'modal-buttons' });
    
    const createBtn = buttonDiv.createEl('button', { text: '📝 템플릿 생성', cls: 'mod-cta' });
    createBtn.addEventListener('click', async () => {
      if (!this.content.trim()) {
        new Notice('⚠️ 정보를 입력해주세요');
        return;
      }
      
      this.close();
      await this.plugin.createStrategy(this.content);
      if (this.onSuccess) await this.onSuccess();
    });
    
    const cancelBtn = buttonDiv.createEl('button', { text: '취소' });
    cancelBtn.addEventListener('click', () => this.close());
  }

  onClose() {
    this.contentEl.empty();
  }
}

// 전략 상세 모달
class StrategyDetailModal extends Modal {
  constructor(app, strategy) {
    super(app);
    this.strategy = strategy;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('learning-strategy-modal');

    contentEl.createEl('h2', { text: this.strategy.name });
    contentEl.createEl('p', { text: this.strategy.description });
    
    const details = contentEl.createEl('div');
    details.style.marginTop = '16px';
    
    const info = details.createEl('h3', { text: '📋 작성 가이드' });
    const guide = details.createEl('ul');
    
    if (this.strategy.id === '1') {
      guide.createEl('li', { text: '주제 식별: 핵심 주제가 무엇인가?' });
      guide.createEl('li', { text: '계층 구조: 어떻게 단계별로 나눌 수 있는가?' });
      guide.createEl('li', { text: '핵심 키워드: 가장 중요한 키워드 3-5개는?' });
      guide.createEl('li', { text: '목차: 체계적인 학습 순서는?' });
    } else if (this.strategy.id === '2') {
      guide.createEl('li', { text: '전체 맥락: 이 개념이 속한 더 큰 그림은?' });
      guide.createEl('li', { text: '선행 지식: 이것을 배우기 전에 알아야 할 것은?' });
      guide.createEl('li', { text: '후속 지식: 이것을 배운 후 학습할 내용은?' });
      guide.createEl('li', { text: '인과 관계: 원인과 결과의 흐름은?' });
    } else {
      guide.createEl('li', { text: '기존 지식 연결: 내가 알고 있는 것과 어떻게 연결되는가?' });
      guide.createEl('li', { text: '비유와 이미지화: 어떤 이미지나 비유로 표현할까?' });
      guide.createEl('li', { text: '실생활 예시: 실제로 어디에 사용되는가?' });
      guide.createEl('li', { text: '심화 질문: 더 깊이 생각해볼 질문은?' });
    }
    
    const buttonDiv = contentEl.createDiv({ cls: 'modal-buttons' });
    const closeBtn = buttonDiv.createEl('button', { text: '닫기' });
    closeBtn.addEventListener('click', () => this.close());
  }

  onClose() {
    this.contentEl.empty();
  }
}

// 타이머 모달
class TimerModal extends Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
    this.isRunning = false;
    this.duration = 0;
    this.interval = null;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('learning-strategy-modal');

    contentEl.createEl('h2', { text: '⏱️ 학습 타이머' });

    const label = contentEl.createEl('label', { text: '학습 시간 (분):' });
    label.style.display = 'block';
    label.style.marginBottom = '8px';
    label.style.fontWeight = 'bold';
    
    const input = contentEl.createEl('input', {
      type: 'number',
      placeholder: '30',
      value: '30'
    });
    input.style.cssText = 'width: 100%;';

    const display = contentEl.createDiv();
    display.style.cssText = 'text-align: center; font-size: 3em; font-weight: bold; margin: 20px 0; color: #3b82f6; font-family: monospace;';
    display.textContent = '00:00';

    const buttonDiv = contentEl.createDiv();
    buttonDiv.style.cssText = 'display: flex; gap: 8px; justify-content: center; margin: 20px 0;';

    const startBtn = buttonDiv.createEl('button', { text: '▶ 시작' });
    startBtn.style.cssText = 'padding: 10px 20px; background: #10b981; color: white; border: none; border-radius: 6px; cursor: pointer;';
    startBtn.addEventListener('click', () => {
      const mins = parseInt(input.value);
      if (mins > 0) {
        this.startTimer(mins * 60, display, startBtn, pauseBtn);
        input.disabled = true;
      }
    });

    const pauseBtn = buttonDiv.createEl('button', { text: '⏸ 일시정지' });
    pauseBtn.style.cssText = 'padding: 10px 20px; background: #f59e0b; color: white; border: none; border-radius: 6px; cursor: pointer;';
    pauseBtn.disabled = true;
    pauseBtn.addEventListener('click', () => {
      if (this.interval) {
        clearInterval(this.interval);
        this.isRunning = false;
        startBtn.disabled = false;
        pauseBtn.disabled = true;
      }
    });

    const resetBtn = buttonDiv.createEl('button', { text: '⟲ 리셋' });
    resetBtn.style.cssText = 'padding: 10px 20px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer;';
    resetBtn.addEventListener('click', () => {
      if (this.interval) clearInterval(this.interval);
      display.textContent = '00:00';
      this.isRunning = false;
      this.duration = 0;
      startBtn.disabled = false;
      pauseBtn.disabled = true;
      input.disabled = false;
    });
  }

  startTimer(seconds, display, startBtn, pauseBtn) {
    this.isRunning = true;
    const startTime = Date.now();
    this.duration = seconds;
    startBtn.disabled = true;
    pauseBtn.disabled = false;

    this.interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
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

  onClose() {
    if (this.interval) clearInterval(this.interval);
    this.contentEl.empty();
  }
}

// 대화형 전략 입력 모달
class InteractiveStrategyModal extends Modal {
  constructor(app, plugin, strategy, onSuccess) {
    super(app);
    this.app = app;
    this.plugin = plugin;
    this.strategy = strategy;
    this.onSuccess = onSuccess;
    this.answers = {};
    this.currentStep = 0;
  }

  getQuestions() {
    if (this.strategy.id === '1') {
      return [
        '주제 식별: 핵심 주제가 무엇인가?',
        '계층 구조: 어떻게 단계별로 나눌 수 있는가?',
        '핵심 키워드: 가장 중요한 키워드 3-5개는?',
        '목차: 체계적인 학습 순서는?'
      ];
    } else if (this.strategy.id === '2') {
      return [
        '전체 맥락: 이 개념이 속한 더 큰 그림은?',
        '선행 지식: 이것을 배우기 전에 알아야 할 것은?',
        '후속 지식: 이것을 배운 후 학습할 내용은?',
        '인과 관계: 원인과 결과의 흐름은?'
      ];
    } else {
      return [
        '기존 지식 연결: 내가 알고 있는 것과 어떻게 연결되는가?',
        '비유와 이미지화: 어떤 이미지나 비유로 표현할까?',
        '실생활 예시: 실제로 어디에 사용되는가? (3가지 이상)',
        '심화 질문: 더 깊이 생각해볼 질문은?'
      ];
    }
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('learning-strategy-modal');

    this.renderStep(contentEl);
  }

  renderStep(contentEl) {
    contentEl.empty();
    const questions = this.getQuestions();
    
    contentEl.createEl('h2', { text: `${this.strategy.name} - 단계별 입력` });
    
    const progress = contentEl.createDiv();
    progress.style.cssText = 'margin-bottom: 16px; padding: 8px; background: var(--background-secondary); border-radius: 4px;';
    progress.setText(`진행도: ${this.currentStep + 1} / ${questions.length}`);
    
    const progressBar = progress.createDiv();
    progressBar.style.cssText = `height: 4px; background: #3b82f6; border-radius: 2px; margin-top: 4px; width: ${((this.currentStep + 1) / questions.length) * 100}%;`;
    
    contentEl.createEl('label', { text: questions[this.currentStep] });
    
    const textarea = contentEl.createEl('textarea', {
      placeholder: '여기에 답변을 입력하세요...'
    });
    textarea.style.cssText = 'width: 100%; min-height: 150px; padding: 12px; margin: 12px 0; border: 1px solid var(--divider-color); border-radius: 6px; background-color: var(--background-primary); color: var(--text-normal); font-family: inherit; resize: vertical;';
    
    if (this.answers[this.currentStep]) {
      textarea.value = this.answers[this.currentStep];
    }

    const buttonDiv = contentEl.createDiv({ cls: 'modal-buttons' });
    
    if (this.currentStep > 0) {
      const prevBtn = buttonDiv.createEl('button', { text: '◀ 이전' });
      prevBtn.style.cssText = 'padding: 10px 20px; background: var(--background-secondary); color: var(--text-normal); border: 1px solid var(--divider-color); border-radius: 6px; cursor: pointer;';
      prevBtn.addEventListener('click', () => {
        this.answers[this.currentStep] = textarea.value;
        this.currentStep--;
        this.renderStep(contentEl);
      });
    }
    
    if (this.currentStep < questions.length - 1) {
      const nextBtn = buttonDiv.createEl('button', { text: '다음 ▶' });
      nextBtn.style.cssText = 'padding: 10px 20px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer;';
      nextBtn.addEventListener('click', () => {
        this.answers[this.currentStep] = textarea.value;
        this.currentStep++;
        this.renderStep(contentEl);
      });
    } else {
      const completeBtn = buttonDiv.createEl('button', { text: '✅ 완료' });
      completeBtn.style.cssText = 'padding: 10px 20px; background: #10b981; color: white; border: none; border-radius: 6px; cursor: pointer;';
      completeBtn.addEventListener('click', async () => {
        this.answers[this.currentStep] = textarea.value;
        await this.saveAnswers();
        this.close();
        if (this.onSuccess) await this.onSuccess();
      });
    }
  }

  async saveAnswers() {
    const content = Object.values(this.answers).join('\n\n---\n\n');
    const fileName = `${this.strategy.name}_${new Date().toISOString().split('T')[0]}_${Date.now()}.md`;
    const filePath = `${this.plugin.settings.outputFolder}/${fileName}`;
    
    const markdown = `---
created: ${new Date().toISOString()}
strategy: ${this.strategy.id}
---

# ${this.strategy.name}

${content}

---

*${this.strategy.name}로 작성됨 · ${new Date().toLocaleString('ko-KR')}*`;

    const outputFolder = this.app.vault.getFolderByPath(this.plugin.settings.outputFolder);
    if (!outputFolder) {
      await this.app.vault.createFolder(this.plugin.settings.outputFolder);
    }

    await this.app.vault.create(filePath, markdown);
    this.plugin.settings.statistics.totalCreated++;
    await this.plugin.saveSettings();
    new Notice(`✅ ${this.strategy.name} 결과가 저장되었습니다`);
  }

  onClose() {
    this.contentEl.empty();
  }
}

// 템플릿 편집 모달
class StrategyEditorModal extends Modal {
  constructor(app, plugin, file, onSuccess) {
    super(app);
    this.app = app;
    this.plugin = plugin;
    this.file = file;
    this.onSuccess = onSuccess;
    this.content = '';
  }

  async onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('learning-strategy-modal');
    
    contentEl.createEl('h2', { text: `✏️ ${this.file.name} 편집` });

    this.content = await this.app.vault.read(this.file);
    
    const textarea = contentEl.createEl('textarea', {
      placeholder: '템플릿 내용을 편집하세요...'
    });
    textarea.style.cssText = 'width: 100%; min-height: 400px; padding: 12px; margin: 12px 0; border: 1px solid var(--divider-color); border-radius: 6px; background-color: var(--background-primary); color: var(--text-normal); font-family: var(--font-monospace); resize: vertical;';
    textarea.value = this.content;

    const buttonDiv = contentEl.createDiv({ cls: 'modal-buttons' });
    
    const saveBtn = buttonDiv.createEl('button', { text: '💾 저장' });
    saveBtn.style.cssText = 'padding: 10px 20px; background: #10b981; color: white; border: none; border-radius: 6px; cursor: pointer;';
    saveBtn.addEventListener('click', async () => {
      await this.app.vault.modify(this.file, textarea.value);
      new Notice('✅ 템플릿이 저장되었습니다');
      this.close();
      if (this.onSuccess) await this.onSuccess();
    });
    
    const cancelBtn = buttonDiv.createEl('button', { text: '취소' });
    cancelBtn.style.cssText = 'padding: 10px 20px; background: var(--background-secondary); color: var(--text-normal); border: 1px solid var(--divider-color); border-radius: 6px; cursor: pointer;';
    cancelBtn.addEventListener('click', () => this.close());
  }

  onClose() {
    this.contentEl.empty();
  }
}

// 플러그인 메인 클래스
module.exports = class LearningStrategyProcessor extends Plugin {
  async onload() {
    console.log('Loading Learning Strategy Processor');
    
    await this.loadSettings();
    
    this.registerView(VIEW_TYPE, (leaf) => new LearningStrategyView(leaf, this));
    
    this.addRibbonIcon('brain-circuit', 'Learning Strategy', async () => {
      this.activateDashboardView();
    });
    
    this.addCommand({
      id: 'open-dashboard',
      name: '학습 전략 대시보드 열기',
      callback: () => this.activateDashboardView()
    });
    
    this.addCommand({
      id: 'create-strategy',
      name: '새 학습 템플릿 생성',
      callback: () => {
        new StrategyInputModal(this.app, this, async () => {
          await this.saveSettings();
        }).open();
      }
    });
    
    this.addCommand({
      id: 'open-timer',
      name: '학습 타이머',
      callback: () => {
        new TimerModal(this.app, this).open();
      }
    });
    
    this.addSettingTab(new LearningStrategySettingTab(this.app, this));
  }

  async onunload() {
    console.log('Unloading Learning Strategy Processor');
  }

  async activateDashboardView() {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE)[0];
    
    if (!leaf) {
      leaf = workspace.getRightLeaf(false);
      await leaf.setViewState({
        type: VIEW_TYPE,
        active: true
      });
    }
    
    workspace.revealLeaf(leaf);
  }

  async createStrategy(content) {
    try {
      this.settings.statistics.totalCreated++;
      
      const fileName = `학습_${new Date().toISOString().split('T')[0]}_${Date.now()}.md`;
      const filePath = `${this.settings.outputFolder}/${fileName}`;
      
      const markdown = `---
created: ${new Date().toISOString()}
---

# 📚 ${content.substring(0, 50)}...

## 📝 원본 정보
${content}

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
3. 후속 지식: 이것을 배운 후 학습할 내용은?
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

*Learning Strategy Processor로 생성됨 · ${new Date().toLocaleString('ko-KR')}*
`;
      
      // 폴더가 없으면 생성
      const outputFolder = this.app.vault.getFolderByPath(this.settings.outputFolder);
      if (!outputFolder) {
        await this.app.vault.createFolder(this.settings.outputFolder);
      }
      
      await this.app.vault.create(filePath, markdown);
      await this.saveSettings();
      
      new Notice(`✅ 템플릿이 생성되었습니다`);
    } catch (error) {
      console.error('Error creating strategy:', error);
      new Notice(`❌ 오류: ${error.message}`);
    }
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
};

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
  }
}
