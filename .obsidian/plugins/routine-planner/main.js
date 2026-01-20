const { Plugin, ItemView, WorkspaceLeaf, Modal, PluginSettingTab, Setting, Notice, TFile, TFolder } = require('obsidian');

const VIEW_TYPE = 'routine-planner-view';

// 기본 설정
const DEFAULT_SETTINGS = {
  routineTemplates: [
    { id: '1', name: '영어 학습', items: ['영어 강의 2강', '영어 뉴스 읽기', 'Anki 단어'] },
    { id: '2', name: '일본어 학습', items: ['일본어 강의 2강', 'Anki 단어'] },
    { id: '3', name: '그림 연습', items: ['크로키 3장', '인체 드로잉'] }
  ],
  routineFolder: 'Routine',
  folderStructure: 'monthly', // 'monthly', 'weekly', 'daily'
  autoCreateFolder: true,
  syncWithFiles: true,
  weekStart: 0,
  themeColor: '#f59e0b'
};

// 루틴 플래너 뷰
class RoutinePlannerView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.currentDate = new Date();
    this.currentView = 'calendar';
  }

  getViewType() {
    return VIEW_TYPE;
  }

  getDisplayText() {
    return 'Routine Planner';
  }

  getIcon() {
    return 'calendar-check';
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
    
    const mainContainer = container.createDiv({ cls: 'routine-planner-container' });
    
    const header = mainContainer.createDiv({ cls: 'rp-header' });
    this.renderHeader(header);
    
    const contentWrapper = mainContainer.createDiv({ cls: 'rp-content-wrapper' });
    
    const sidebar = contentWrapper.createDiv({ cls: 'rp-sidebar' });
    this.renderSidebar(sidebar);
    
    const main = contentWrapper.createDiv({ cls: 'rp-main' });
    if (this.currentView === 'calendar') {
      this.renderCalendarView(main);
    } else {
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
        
        // Remove all responsive classes
        container.classList.remove('rp-mobile', 'rp-tablet', 'rp-small-mobile');
        
        // Add appropriate class based on width
        if (width <= 480) {
          container.classList.add('rp-small-mobile');
        } else if (width <= 768) {
          container.classList.add('rp-mobile');
        } else if (width <= 1024) {
          container.classList.add('rp-tablet');
        }
      }
    });
    
    this.resizeObserver.observe(container);
  }

  renderHeader(header) {
    header.empty();
    
    const title = header.createDiv({ cls: 'rp-header-title' });
    title.setText('📅 Routine Planner');
    
    const nav = header.createDiv({ cls: 'rp-header-nav' });
    
    const calendarBtn = nav.createEl('button', { cls: 'rp-nav-btn' });
    calendarBtn.setText('📆 Calendar');
    if (this.currentView === 'calendar') calendarBtn.addClass('active');
    calendarBtn.addEventListener('click', () => {
      this.currentView = 'calendar';
      this.onOpen();
    });
    
    const dailyBtn = nav.createEl('button', { cls: 'rp-nav-btn' });
    dailyBtn.setText('📝 Daily');
    if (this.currentView === 'daily') dailyBtn.addClass('active');
    dailyBtn.addEventListener('click', () => {
      this.currentView = 'daily';
      this.onOpen();
    });
    
    const recentBtn = nav.createEl('button', { cls: 'rp-nav-btn' });
    recentBtn.setText('📋 Recent');
    recentBtn.addEventListener('click', () => {
      new RecentFilesModal(this.app, this.plugin).open();
    });
    
    const openFileBtn = nav.createEl('button', { cls: 'rp-nav-btn' });
    openFileBtn.setText('📄 Open File');
    openFileBtn.addEventListener('click', async () => {
      const filePath = await this.plugin.getDateFilePath(this.currentDate);
      const file = this.app.vault.getAbstractFileByPath(filePath);
      if (file instanceof TFile) {
        await this.app.workspace.getLeaf().openFile(file);
      } else {
        new Notice('파일을 찾을 수 없습니다.');
      }
    });
  }

  renderSidebar(sidebar) {
    sidebar.empty();
    
    const templateSection = sidebar.createDiv({ cls: 'rp-section' });
    const templateTitle = templateSection.createDiv({ cls: 'rp-section-title' });
    templateTitle.setText('📋 Routine Templates');
    
    const templateList = templateSection.createDiv({ cls: 'rp-template-list' });
    this.plugin.settings.routineTemplates.forEach(template => {
      const templateItem = templateList.createDiv({ cls: 'rp-template-item' });
      const templateName = templateItem.createDiv({ cls: 'rp-template-name' });
      templateName.setText(template.name);
      
      const templateActions = templateItem.createDiv({ cls: 'rp-template-actions' });
      
      const applyBtn = templateActions.createEl('button', { cls: 'rp-btn-small' });
      applyBtn.setText('Apply');
      applyBtn.addEventListener('click', async () => {
        await this.applyTemplate(template);
      });
      
      const editBtn = templateActions.createEl('button', { cls: 'rp-btn-small' });
      editBtn.setText('Edit');
      editBtn.addEventListener('click', () => {
        new TemplateEditModal(this.app, this.plugin, template, () => {
          this.renderSidebar(sidebar);
        }).open();
      });
    });
    
    const addTemplateBtn = templateSection.createDiv({ cls: 'rp-add-btn' });
    addTemplateBtn.setText('+ New Template');
    addTemplateBtn.addEventListener('click', () => {
      new TemplateEditModal(this.app, this.plugin, null, () => {
        this.renderSidebar(sidebar);
      }).open();
    });
    
    const actionSection = sidebar.createDiv({ cls: 'rp-section' });
    const actionTitle = actionSection.createDiv({ cls: 'rp-section-title' });
    actionTitle.setText('⚡ Quick Actions');
    
    const createFolderBtn = actionSection.createDiv({ cls: 'rp-action-btn' });
    createFolderBtn.setText('📁 Create Month Folder');
    createFolderBtn.addEventListener('click', async () => {
      await this.plugin.createFolderStructure(this.currentDate);
      new Notice('폴더가 생성되었습니다!');
    });
    
    const syncBtn = actionSection.createDiv({ cls: 'rp-action-btn' });
    syncBtn.setText('🔄 Sync All Files');
    syncBtn.addEventListener('click', async () => {
      await this.plugin.syncAllFiles();
      this.onOpen();
      new Notice('동기화 완료!');
    });
  }

  async renderCalendarView(main) {
    main.empty();
    
    const calendarContainer = main.createDiv({ cls: 'rp-calendar-container' });
    
    const monthNav = calendarContainer.createDiv({ cls: 'rp-month-nav' });
    
    const prevBtn = monthNav.createEl('button', { cls: 'rp-month-btn' });
    prevBtn.setText('◀');
    prevBtn.addEventListener('click', () => {
      this.currentDate.setMonth(this.currentDate.getMonth() - 1);
      this.onOpen();
    });
    
    const monthTitle = monthNav.createDiv({ cls: 'rp-month-title' });
    monthTitle.setText(`${this.currentDate.getFullYear()}년 ${this.currentDate.getMonth() + 1}월`);
    
    const nextBtn = monthNav.createEl('button', { cls: 'rp-month-btn' });
    nextBtn.setText('▶');
    nextBtn.addEventListener('click', () => {
      this.currentDate.setMonth(this.currentDate.getMonth() + 1);
      this.onOpen();
    });
    
    const todayBtn = monthNav.createEl('button', { cls: 'rp-today-btn' });
    todayBtn.setText('Today');
    todayBtn.addEventListener('click', () => {
      this.currentDate = new Date();
      this.onOpen();
    });
    
    const weekHeader = calendarContainer.createDiv({ cls: 'rp-week-header' });
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    days.forEach(day => {
      const dayEl = weekHeader.createDiv({ cls: 'rp-week-day' });
      dayEl.setText(day);
    });
    
    const calendarGrid = calendarContainer.createDiv({ cls: 'rp-calendar-grid' });
    await this.renderCalendarDays(calendarGrid);
  }

  async renderCalendarDays(grid) {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    
    for (let i = 0; i < firstDay; i++) {
      grid.createDiv({ cls: 'rp-calendar-day empty' });
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
      const dayEl = grid.createDiv({ cls: 'rp-calendar-day' });
      const date = new Date(year, month, day);
      
      if (date.toDateString() === today.toDateString()) {
        dayEl.addClass('today');
      }
      
      const dayNum = dayEl.createDiv({ cls: 'rp-day-num' });
      dayNum.setText(day.toString());
      
      // 파일에서 데이터 읽기
      const dayData = await this.plugin.readDateFile(date);
      if (dayData && dayData.routines && dayData.routines.length > 0) {
        const completedCount = dayData.routines.filter(r => r.checked).length;
        const totalCount = dayData.routines.length;
        
        const progress = dayEl.createDiv({ cls: 'rp-day-progress' });
        progress.setText(`${completedCount}/${totalCount}`);
        
        if (completedCount === totalCount) {
          dayEl.addClass('completed');
        } else if (completedCount > 0) {
          dayEl.addClass('in-progress');
        }
      }
      
      dayEl.addEventListener('click', () => {
        this.currentDate = date;
        this.currentView = 'daily';
        this.onOpen();
      });
    }
  }

  async renderDailyView(main) {
    main.empty();
    
    let dayData = await this.plugin.readDateFile(this.currentDate);
    
    // dayData가 없거나 빈 객체면 초기화
    if (!dayData || Object.keys(dayData).length === 0) {
      dayData = { routines: [], tasks: [], notes: [] };
    }
    
    // 각 배열이 없으면 초기화
    if (!dayData.routines) dayData.routines = [];
    if (!dayData.tasks) dayData.tasks = [];
    if (!dayData.notes) dayData.notes = [];
    
    // 스크롤 컨테이너 생성
    const scrollContainer = main.createDiv({ cls: 'rp-daily-scroll-container' });
    
    const dateHeader = scrollContainer.createDiv({ cls: 'rp-date-header' });
    
    const prevDayBtn = dateHeader.createEl('button', { cls: 'rp-date-nav-btn' });
    prevDayBtn.setText('◀');
    prevDayBtn.addEventListener('click', () => {
      this.currentDate.setDate(this.currentDate.getDate() - 1);
      this.onOpen();
    });
    
    const dateTitle = dateHeader.createDiv({ cls: 'rp-date-title' });
    dateTitle.setText(this.formatDateKorean(this.currentDate));
    
    const nextDayBtn = dateHeader.createEl('button', { cls: 'rp-date-nav-btn' });
    nextDayBtn.setText('▶');
    nextDayBtn.addEventListener('click', () => {
      this.currentDate.setDate(this.currentDate.getDate() + 1);
      this.onOpen();
    });
    
    // Routine 섹션
    const routineSection = scrollContainer.createDiv({ cls: 'rp-do-section' });
    const routineHeader = routineSection.createDiv({ cls: 'rp-do-header' });
    routineHeader.setText('✅ Routines');
    
    const routineList = routineSection.createDiv({ cls: 'rp-routine-list-daily' });
    
    if (dayData && dayData.routines) {
      dayData.routines.forEach((routine, index) => {
        const routineItem = routineList.createDiv({ cls: 'rp-routine-item-daily' });
        
        const checkbox = routineItem.createEl('input', { type: 'checkbox' });
        checkbox.checked = routine.checked;
        checkbox.addEventListener('change', async () => {
          routine.checked = checkbox.checked;
          await this.plugin.writeDateFile(this.currentDate, dayData);
          await this.renderDailyView(main);
        });
        
        const text = routineItem.createDiv({ cls: 'rp-routine-text' });
        text.setText(routine.text);
        if (routine.checked) text.addClass('checked');
        
        const deleteBtn = routineItem.createEl('button', { cls: 'rp-delete-btn' });
        deleteBtn.setText('×');
        deleteBtn.addEventListener('click', async () => {
          dayData.routines.splice(index, 1);
          await this.plugin.writeDateFile(this.currentDate, dayData);
          await this.renderDailyView(main);
        });
      });
    }
    
    const addRoutineBtn = routineSection.createEl('button', { cls: 'rp-add-do-btn' });
    addRoutineBtn.setText('+ Add Routine');
    addRoutineBtn.addEventListener('click', () => {
      new RoutineAddModal(this.app, async (text) => {
        if (!dayData.routines) dayData.routines = [];
        dayData.routines.push({ text: text, checked: false });
        await this.plugin.writeDateFile(this.currentDate, dayData);
        await this.renderDailyView(main);
      }).open();
    });
    
    // Tasks 섹션
    const taskSection = scrollContainer.createDiv({ cls: 'rp-do-section' });
    const taskHeader = taskSection.createDiv({ cls: 'rp-do-header' });
    taskHeader.setText('📋 Tasks');
    
    const timeline = taskSection.createDiv({ cls: 'rp-timeline' });
    for (let i = 0; i < 24; i++) {
      const hourDiv = timeline.createDiv({ cls: 'rp-hour' });
      const ampm = i < 12 ? 'AM' : 'PM';
      const displayHour = i === 0 ? 12 : (i > 12 ? i - 12 : i);
      
      const hourLabel = hourDiv.createDiv({ cls: 'rp-hour-label' });
      hourLabel.setText(`${displayHour} ${ampm}`);
      
      // 시간 클릭하면 해당 시간에 태스크 추가
      hourLabel.addEventListener('click', () => {
        new TaskAddModal(this.app, async (hour, text) => {
          if (!dayData.tasks) dayData.tasks = [];
          dayData.tasks.push({ hour: hour, text: text });
          await this.plugin.writeDateFile(this.currentDate, dayData);
          await this.renderDailyView(main);
        }, i).open(); // i를 기본 시간으로 전달
      });
      
      if (dayData && dayData.tasks) {
        const tasksAtHour = dayData.tasks.filter(t => t.hour === i);
        tasksAtHour.forEach((task) => {
          const taskDiv = hourDiv.createDiv({ cls: 'rp-task' });
          taskDiv.setText(task.text);
          
          const deleteBtn = taskDiv.createEl('span', { cls: 'rp-task-delete' });
          deleteBtn.setText(' ×');
          deleteBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const taskIndex = dayData.tasks.indexOf(task);
            dayData.tasks.splice(taskIndex, 1);
            await this.plugin.writeDateFile(this.currentDate, dayData);
            await this.renderDailyView(main);
          });
        });
      }
    }
    
    const addTaskBtn = taskSection.createEl('button', { cls: 'rp-add-do-btn' });
    addTaskBtn.setText('+ Add Task');
    addTaskBtn.addEventListener('click', () => {
      new TaskAddModal(this.app, async (hour, text) => {
        if (!dayData.tasks) dayData.tasks = [];
        dayData.tasks.push({ hour: hour, text: text });
        await this.plugin.writeDateFile(this.currentDate, dayData);
        await this.renderDailyView(main);
      }).open();
    });
    
    // Notes 섹션
    const noteSection = scrollContainer.createDiv({ cls: 'rp-see-section' });
    const noteHeader = noteSection.createDiv({ cls: 'rp-section-title' });
    noteHeader.setText('💬 Notes');
    
    const noteList = noteSection.createDiv({ cls: 'rp-note-list' });
    
    if (dayData && dayData.notes && dayData.notes.length > 0) {
      dayData.notes.forEach((note, index) => {
        const noteItem = noteList.createDiv({ cls: 'rp-see-content' });
        noteItem.setText(note.text);
        
        const deleteBtn = noteItem.createEl('button', { cls: 'rp-delete-btn-inline' });
        deleteBtn.setText('×');
        deleteBtn.addEventListener('click', async () => {
          dayData.notes.splice(index, 1);
          await this.plugin.writeDateFile(this.currentDate, dayData);
          await this.renderDailyView(main);
        });
      });
    }
    
    const addNoteBtn = noteSection.createDiv({ cls: 'rp-add-btn' });
    addNoteBtn.setText('+ Add Note');
    addNoteBtn.addEventListener('click', () => {
      new NoteAddModal(this.app, async (text) => {
        if (!dayData.notes) dayData.notes = [];
        dayData.notes.push({ text: text });
        await this.plugin.writeDateFile(this.currentDate, dayData);
        await this.renderDailyView(main);
      }).open();
    });
  }

  async applyTemplate(template) {
    const dayData = await this.plugin.readDateFile(this.currentDate);
    
    if (!dayData.routines) dayData.routines = [];
    
    template.items.forEach(item => {
      dayData.routines.push({ text: item, checked: false });
    });
    
    await this.plugin.writeDateFile(this.currentDate, dayData);
    this.currentView = 'daily';
    await this.onOpen();
    
    new Notice(`"${template.name}" 템플릿이 적용되었습니다!`);
  }

  formatDateKorean(date) {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${days[date.getDay()]})`;
  }

  addStyles() {
    if (document.getElementById('routine-planner-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'routine-planner-styles';
    style.textContent = `
      .routine-planner-container {
        display: flex;
        flex-direction: column;
        height: 100%;
        max-height: 100%;
        background-color: #151923;
        color: #e5e7eb;
        overflow: hidden;
        padding: 0;
        margin: 0;
      }

     .rp-content-wrapper {
        display: flex;
        flex: 1;
        overflow: hidden;
        min-height: 0;
      }

      .rp-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 20px;
        background-color: #1e2330;
        border-bottom: 2px solid #f59e0b;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      }

      .rp-header-title {
        font-size: 1.3rem;
        font-weight: bold;
        color: #fbbf24;
      }

      .rp-header-nav {
        display: flex;
        gap: 8px;
      }

      .rp-nav-btn {
        background-color: #2d3548;
        color: #f3f4f6;
        border: 1px solid #3a4154;
        padding: 6px 16px;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s;
        font-size: 0.9rem;
        font-weight: 500;
      }

      .rp-nav-btn:hover {
        background-color: #353d52;
        border-color: #f59e0b;
        transform: translateY(-1px);
      }

      .rp-nav-btn.active {
        background-color: #f59e0b;
        color: #000;
        font-weight: bold;
        border-color: #f59e0b;
        box-shadow: 0 2px 8px rgba(245, 158, 11, 0.4);
      }

      .routine-planner-container > div:not(.rp-header):not(.rp-content-wrapper) {
        display: flex;
        flex: 1;
        overflow: hidden;
      }

      .rp-sidebar {
        width: 280px;
        background-color: #1a1f2e;
        display: flex;
        flex-direction: column;
        padding: 20px;
        gap: 20px;
        overflow-y: auto;
        border-right: 1px solid #2a2f3a;
      }

      .rp-section {
        background-color: #242936;
        border-radius: 8px;
        padding: 16px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      }

      .rp-section-title {
        font-weight: bold;
        margin-bottom: 10px;
        color: #fbbf24;
        font-size: 1rem;
      }

      .rp-template-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
        max-height: 300px;
        overflow-y: auto;
        padding-right: 5px;
      }

      .rp-template-list::-webkit-scrollbar {
        width: 8px;
      }

      .rp-template-list::-webkit-scrollbar-track {
        background: #1a1f2e;
        border-radius: 4px;
      }

      .rp-template-list::-webkit-scrollbar-thumb {
        background: #f59e0b;
        border-radius: 4px;
      }

      .rp-template-list::-webkit-scrollbar-thumb:hover {
        background: #fbbf24;
      }

      .rp-template-item {
        background-color: #2d3548;
        padding: 10px;
        border-radius: 6px;
        border: 1px solid #3a4154;
        transition: all 0.2s;
      }

      .rp-template-item:hover {
        background-color: #353d52;
        border-color: #f59e0b;
      }

      .rp-template-name {
        font-weight: 600;
        margin-bottom: 6px;
        color: #f3f4f6;
        font-size: 0.95rem;
      }

      .rp-template-actions {
        display: flex;
        gap: 6px;
      }

      .rp-btn-small {
        background-color: #f59e0b;
        color: #000;
        border: none;
        padding: 4px 10px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.8rem;
        font-weight: bold;
        transition: all 0.2s;
      }

      .rp-btn-small:hover {
        background-color: #fbbf24;
      }

      .rp-add-btn, .rp-action-btn {
        background-color: #f59e0b;
        color: #000;
        font-weight: bold;
        border-radius: 6px;
        padding: 8px 12px;
        text-align: center;
        cursor: pointer;
        transition: all 0.2s;
        margin-top: 10px;
        box-shadow: 0 2px 4px rgba(245, 158, 11, 0.3);
      }

      .rp-add-btn:hover, .rp-action-btn:hover {
        background-color: #fbbf24;
        transform: translateY(-1px);
        box-shadow: 0 4px 8px rgba(245, 158, 11, 0.4);
      }

      .rp-main {
        flex: 1;
        padding: 20px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        min-height: 0;
      }

      .rp-main::-webkit-scrollbar {
        width: 10px;
      }

      .rp-main::-webkit-scrollbar-track {
        background: #151923;
        border-radius: 5px;
      }

      .rp-main::-webkit-scrollbar-thumb {
        background: linear-gradient(135deg, #f59e0b, #fbbf24);
        border-radius: 5px;
      }

      .rp-main::-webkit-scrollbar-thumb:hover {
        background: linear-gradient(135deg, #fbbf24, #f59e0b);
      }

      .rp-daily-scroll-container {
        flex: 1;
        overflow-y: auto;
        padding-right: 10px;
        min-height: 0;
      }

      .rp-daily-scroll-container::-webkit-scrollbar {
        width: 10px;
      }

      .rp-daily-scroll-container::-webkit-scrollbar-track {
        background: #151923;
        border-radius: 5px;
      }

      .rp-daily-scroll-container::-webkit-scrollbar-thumb {
        background: linear-gradient(135deg, #f59e0b, #fbbf24);
        border-radius: 5px;
      }

      .rp-daily-scroll-container::-webkit-scrollbar-thumb:hover {
        background: linear-gradient(135deg, #fbbf24, #f59e0b);
      }

      .rp-calendar-container {
        max-width: 900px;
        margin: 0 auto;
      }

      .rp-month-nav {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 15px;
        padding: 10px;
        background-color: #1e2330;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      }

      .rp-month-btn {
        background-color: #f59e0b;
        color: #000;
        border: none;
        padding: 8px 16px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 1rem;
        font-weight: bold;
        transition: all 0.2s;
      }

      .rp-month-btn:hover {
        background-color: #fbbf24;
      }

      .rp-month-title {
        font-size: 1.5rem;
        font-weight: bold;
        color: #fbbf24;
      }

      .rp-today-btn {
        background-color: #3b82f6;
        color: #fff;
        border: none;
        padding: 8px 16px;
        border-radius: 6px;
        cursor: pointer;
        font-weight: bold;
        transition: all 0.2s;
      }

      .rp-today-btn:hover {
        background-color: #2563eb;
      }

      .rp-week-header {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 8px;
        margin-bottom: 8px;
      }

      .rp-week-day {
        text-align: center;
        font-weight: bold;
        color: #fbbf24;
        padding: 8px;
      }

      .rp-calendar-grid {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 8px;
      }

      .rp-calendar-day {
        aspect-ratio: 1;
        background-color: #242936;
        border-radius: 8px;
        padding: 8px;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        border: 1px solid #2d3548;
      }

      .rp-calendar-day:hover {
        background-color: #2d3548;
        transform: scale(1.05);
        border-color: #f59e0b;
        box-shadow: 0 2px 8px rgba(245, 158, 11, 0.3);
      }

      .rp-calendar-day.empty {
        background-color: transparent;
        cursor: default;
      }

      .rp-calendar-day.today {
        border: 2px solid #3b82f6;
      }

      .rp-calendar-day.completed {
        background-color: #065f46;
      }

      .rp-calendar-day.in-progress {
        background-color: #1e3a8a;
      }

      .rp-day-num {
        font-weight: bold;
        font-size: 1.1rem;
      }

      .rp-day-progress {
        font-size: 0.75rem;
        color: #fbbf24;
        text-align: right;
      }

      .rp-date-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 15px;
        padding: 12px;
        background-color: #1e2330;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      }

      .rp-date-title {
        font-size: 1.4rem;
        font-weight: bold;
        color: #fbbf24;
      }

      .rp-date-nav-btn {
        background-color: #f59e0b;
        color: #000;
        border: none;
        padding: 8px 16px;
        border-radius: 6px;
        cursor: pointer;
        font-weight: bold;
        transition: all 0.2s;
      }

      .rp-date-nav-btn:hover {
        background-color: #fbbf24;
      }

      .rp-do-section {
        background-color: #1a1f2e;
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 15px;
        border: 1px solid #242936;
      }

      .rp-do-header {
        font-weight: bold;
        margin-bottom: 15px;
        color: #fbbf24;
        font-size: 1.1rem;
      }

      .rp-routine-list-daily {
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin-bottom: 15px;
        max-height: 400px;
        overflow-y: auto;
        overflow-x: hidden;
        padding-right: 8px;
        min-height: 100px;
      }

      .rp-routine-list-daily::-webkit-scrollbar {
        width: 8px;
      }

      .rp-routine-list-daily::-webkit-scrollbar-track {
        background: #151923;
        border-radius: 4px;
      }

      .rp-routine-list-daily::-webkit-scrollbar-thumb {
        background: #f59e0b;
        border-radius: 4px;
      }

      .rp-routine-list-daily::-webkit-scrollbar-thumb:hover {
        background: #fbbf24;
      }

      .rp-routine-item-daily {
        display: flex;
        align-items: center;
        gap: 10px;
        background-color: #242936;
        padding: 12px;
        border-radius: 6px;
        border: 1px solid #2d3548;
        transition: all 0.2s;
      }

      .rp-routine-item-daily:hover {
        background-color: #2d3548;
        border-color: #3a4154;
      }

      .rp-routine-text {
        flex: 1;
        font-size: 1rem;
      }

      .rp-routine-text.checked {
        text-decoration: line-through;
        opacity: 0.6;
      }

      .rp-delete-btn {
        background-color: #ef4444;
        color: #fff;
        border: none;
        padding: 4px 10px;
        border-radius: 4px;
        cursor: pointer;
        font-weight: bold;
        transition: all 0.2s;
      }

      .rp-delete-btn:hover {
        background-color: #dc2626;
      }

      .rp-timeline {
        max-height: 350px;
        overflow-y: auto;
        border-top: 1px solid #333;
        padding-top: 10px;
      }

      .rp-timeline::-webkit-scrollbar {
        width: 8px;
      }

      .rp-timeline::-webkit-scrollbar-track {
        background: #151923;
        border-radius: 4px;
      }

      .rp-timeline::-webkit-scrollbar-thumb {
        background: #f59e0b;
        border-radius: 4px;
      }

      .rp-timeline::-webkit-scrollbar-thumb:hover {
        background: #fbbf24;
      }

      .rp-hour {
        display: flex;
        align-items: flex-start;
        min-height: 40px;
        border-bottom: 1px solid #222;
        position: relative;
        font-size: 0.9rem;
        padding: 5px 0;
      }

      .rp-hour-label {
        min-width: 70px;
        cursor: pointer;
        padding: 5px 8px;
        border-radius: 4px;
        transition: all 0.2s;
        user-select: none;
      }

      .rp-hour-label:hover {
        background-color: #2a2f3a;
        color: #fbbf24;
      }

      .rp-task {
        margin-left: 10px;
        background-color: #2d3548;
        color: #f3f4f6;
        border-radius: 4px;
        padding: 6px 10px;
        font-size: 0.85rem;
        display: inline-block;
        margin-top: 4px;
        margin-bottom: 4px;
        border: 1px solid #3a4154;
      }

      .rp-task-delete {
        margin-left: 6px;
        color: #ef4444;
        cursor: pointer;
        font-weight: bold;
      }

      .rp-task-delete:hover {
        color: #dc2626;
      }

      .rp-add-do-btn {
        background-color: #f59e0b;
        border: none;
        padding: 10px 20px;
        border-radius: 6px;
        cursor: pointer;
        margin-top: 10px;
        transition: all 0.2s;
        color: #000;
        font-weight: bold;
        width: 100%;
      }

      .rp-add-do-btn:hover {
        background-color: #fbbf24;
      }

      .rp-see-section {
        background-color: #1a1f2e;
        border-radius: 8px;
        padding: 16px;
        border: 1px solid #242936;
      }

      .rp-note-list {
        max-height: 250px;
        overflow-y: auto;
        padding-right: 5px;
      }

      .rp-note-list::-webkit-scrollbar {
        width: 8px;
      }

      .rp-note-list::-webkit-scrollbar-track {
        background: #151923;
        border-radius: 4px;
      }

      .rp-note-list::-webkit-scrollbar-thumb {
        background: #f59e0b;
        border-radius: 4px;
      }

      .rp-note-list::-webkit-scrollbar-thumb:hover {
        background: #fbbf24;
      }

      .rp-see-content {
        margin-top: 10px;
        color: #f3f4f6;
        padding: 12px;
        background-color: #242936;
        border-radius: 6px;
        position: relative;
        border: 1px solid #2d3548;
      }

      .rp-delete-btn-inline {
        position: absolute;
        top: 8px;
        right: 8px;
        background-color: #ef4444;
        color: #fff;
        border: none;
        padding: 2px 8px;
        border-radius: 4px;
        cursor: pointer;
        font-weight: bold;
      }

      /* ============================================
         반응형 디자인 & 모바일 최적화 (Class-based)
         ============================================ */
      
      /* 태블릿 & 작은 데스크톱 */
      .rp-tablet .rp-sidebar {
        width: 240px;
      }
      
      .rp-tablet .rp-calendar-grid {
        gap: 6px;
      }
      
      .rp-tablet .rp-calendar-day {
        padding: 6px;
        font-size: 0.9rem;
      }
      
      /* 모바일 & 소형 태블릿 */
      .rp-mobile .rp-content-wrapper,
      .rp-small-mobile .rp-content-wrapper {
        flex-direction: column;
      }
      
      .rp-mobile .rp-main {
        padding: 10px;
      }
      
      .rp-mobile .rp-sidebar,
      .rp-small-mobile .rp-sidebar {
        width: 100%;
        max-height: 250px;
        overflow-y: auto;
        border-right: none;
        border-bottom: 2px solid #2a2f3a;
        padding: 10px;
      }
      
      .rp-mobile .rp-header,
      .rp-small-mobile .rp-header {
        flex-direction: column;
        gap: 8px;
        padding: 10px;
        padding-bottom: 10px;
      }
      
      .rp-mobile .rp-header-nav,
      .rp-small-mobile .rp-header-nav {
        width: 100%;
        justify-content: space-around;
        flex-wrap: wrap;
      }
      
      .rp-mobile .rp-nav-btn,
      .rp-small-mobile .rp-nav-btn {
        padding: 8px 12px;
        font-size: 0.85rem;
        flex: 1;
        min-width: 80px;
        min-height: 44px;
      }
      
      .rp-mobile .rp-calendar-container,
      .rp-small-mobile .rp-calendar-container {
        padding: 8px;
      }
      
      .rp-mobile .rp-month-nav,
      .rp-small-mobile .rp-month-nav {
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 10px;
        padding: 8px;
      }
      
      .rp-mobile .rp-month-title,
      .rp-small-mobile .rp-month-title {
        font-size: 1.2rem;
        width: 100%;
        text-align: center;
      }
      
      .rp-mobile .rp-calendar-grid,
      .rp-small-mobile .rp-calendar-grid {
        gap: 4px;
      }
      
      .rp-mobile .rp-calendar-day,
      .rp-small-mobile .rp-calendar-day {
        padding: 4px;
        font-size: 0.85rem;
        min-height: 50px;
      }
      
      .rp-mobile .rp-day-num,
      .rp-small-mobile .rp-day-num {
        font-size: 0.95rem;
      }
      
      .rp-mobile .rp-day-progress,
      .rp-small-mobile .rp-day-progress {
        font-size: 0.7rem;
      }
      
      .rp-mobile .rp-date-header,
      .rp-small-mobile .rp-date-header {
        flex-direction: column;
        gap: 8px;
        margin-bottom: 10px;
        padding: 10px;
      }
      
      .rp-mobile .rp-date-title,
      .rp-small-mobile .rp-date-title {
        font-size: 1.1rem;
        text-align: center;
      }
      
      .rp-mobile .rp-routine-list-daily,
      .rp-small-mobile .rp-routine-list-daily {
        max-height: 250px;
      }
      
      .rp-mobile .rp-timeline,
      .rp-small-mobile .rp-timeline {
        max-height: 250px;
      }
      
      .rp-mobile .rp-note-list,
      .rp-small-mobile .rp-note-list {
        max-height: 200px;
      }
      
      .rp-mobile .rp-section,
      .rp-small-mobile .rp-section {
        padding: 10px;
        margin-bottom: 0;
      }
      
     .rp-small-mobile .rp-main {
        padding: 8px;
      }
      
      .rp-small-mobile .rp-section {
        padding: 8px;
      }
      
      .rp-mobile .rp-do-section,
      .rp-small-mobile .rp-do-section {
        margin-bottom: 10px;
      }
      
      .rp-mobile .rp-see-section,
      .rp-small-mobile .rp-see-section {
        margin-bottom: 0;
      }
      
      .rp-mobile .rp-template-list,
      .rp-small-mobile .rp-template-list {
        max-height: 200px;
      }
      
      .rp-mobile .rp-month-btn,
      .rp-mobile .rp-today-btn,
      .rp-mobile .rp-date-nav-btn,
      .rp-mobile .rp-btn-small,
      .rp-mobile .rp-add-btn,
      .rp-mobile .rp-action-btn,
      .rp-mobile .rp-add-do-btn,
      .rp-small-mobile .rp-month-btn,
      .rp-small-mobile .rp-today-btn,
      .rp-small-mobile .rp-date-nav-btn,
      .rp-small-mobile .rp-btn-small,
      .rp-small-mobile .rp-add-btn,
      .rp-small-mobile .rp-action-btn,
      .rp-small-mobile .rp-add-do-btn {
        min-height: 44px;
        min-width: 44px;
      }
      
      .rp-mobile input[type="checkbox"],
      .rp-small-mobile input[type="checkbox"] {
        width: 24px;
        height: 24px;
        min-width: 24px;
        min-height: 24px;
      }
      
      /* 소형 모바일 추가 스타일 */
      .rp-small-mobile .rp-header {
        padding: 8px;
      }
      
      .rp-small-mobile .rp-calendar-container {
        padding: 5px;
      }
      
      .rp-small-mobile .rp-month-nav {
        padding: 6px;
        margin-bottom: 8px;
      }
      
      .rp-small-mobile .rp-date-header {
        padding: 8px;
        margin-bottom: 8px;
      }
      
      .rp-small-mobile .rp-header-title {
        font-size: 1.1rem;
      }
      
      .rp-small-mobile .rp-nav-btn {
        padding: 6px 8px;
        font-size: 0.8rem;
        min-width: 70px;
      }
      
    .rp-small-mobile .rp-sidebar {
        padding: 8px;
        max-height: 200px;
      }
      
      .rp-small-mobile .rp-do-section {
        margin-bottom: 8px;
      }
      
      .rp-small-mobile .rp-main {
        padding: 10px;
      }
      
      .rp-small-mobile .rp-section {
        padding: 10px;
      }
      
      .rp-small-mobile .rp-section-title {
        font-size: 0.95rem;
      }
      
      .rp-small-mobile .rp-template-item {
        padding: 8px;
      }
      
      .rp-small-mobile .rp-template-name {
        font-size: 0.9rem;
      }
      
      .rp-small-mobile .rp-btn-small {
        padding: 3px 8px;
        font-size: 0.75rem;
      }
      
      .rp-small-mobile .rp-calendar-grid {
        gap: 3px;
      }
      
      .rp-small-mobile .rp-calendar-day {
        padding: 3px;
        font-size: 0.8rem;
      }
      
      .rp-small-mobile .rp-day-num {
        font-size: 0.85rem;
      }
      
      .rp-small-mobile .rp-day-progress {
        font-size: 0.65rem;
      }
      
      .rp-small-mobile .rp-week-day {
        padding: 6px;
        font-size: 0.85rem;
      }
      
      .rp-small-mobile .rp-month-title {
        font-size: 1rem;
      }
      
      .rp-small-mobile .rp-month-btn,
      .rp-small-mobile .rp-today-btn,
      .rp-small-mobile .rp-date-nav-btn {
        padding: 6px 12px;
        font-size: 0.85rem;
      }
      
      .rp-small-mobile .rp-date-title {
        font-size: 1rem;
      }
      
      .rp-small-mobile .rp-do-header {
        font-size: 1rem;
      }
      
      .rp-small-mobile .rp-routine-item-daily {
        padding: 10px;
        gap: 8px;
      }
      
      .rp-small-mobile .rp-routine-text {
        font-size: 0.9rem;
      }
      
      .rp-small-mobile .rp-hour {
        font-size: 0.85rem;
        min-height: 35px;
      }
      
      .rp-small-mobile .rp-task {
        padding: 5px 8px;
        font-size: 0.8rem;
      }
      
      .rp-small-mobile .rp-see-content {
        padding: 10px;
        font-size: 0.9rem;
      }
      
      .rp-small-mobile .rp-add-do-btn {
        padding: 8px 16px;
        font-size: 0.9rem;
      }
    `;
    document.head.appendChild(style);
  }

  async onClose() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
  }
}

// 템플릿 편집 모달
class TemplateEditModal extends Modal {
  constructor(app, plugin, template, onSave) {
    super(app);
    this.plugin = plugin;
    this.template = template || { id: Date.now().toString(), name: '', items: [] };
    this.isNew = !template;
    this.onSave = onSave;
  }

  onOpen() {
    const { contentEl, modalEl } = this;
    contentEl.empty();
    
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
      modalEl.style.width = '95vw';
      modalEl.style.maxWidth = '95vw';
    }
    
    contentEl.createEl('h2', { text: this.isNew ? '새 템플릿' : '템플릿 편집' }).style.fontSize = isMobile ? '1.3rem' : '1.5rem';
    
    const form = contentEl.createDiv({ cls: 'template-form' });
    
    form.createEl('label', { text: '템플릿 이름' });
    const nameInput = form.createEl('input', { type: 'text', value: this.template.name });
    nameInput.style.width = '100%';
    nameInput.style.marginBottom = '15px';
    nameInput.style.padding = isMobile ? '12px' : '8px';
    nameInput.style.fontSize = isMobile ? '1rem' : '0.95rem';
    
    form.createEl('label', { text: '항목 (한 줄에 하나씩)' });
    const itemsTextarea = form.createEl('textarea');
    itemsTextarea.value = this.template.items.join('\n');
    itemsTextarea.style.width = '100%';
    itemsTextarea.style.minHeight = isMobile ? '120px' : '150px';
    itemsTextarea.style.marginBottom = '15px';
    itemsTextarea.style.padding = isMobile ? '12px' : '10px';
    itemsTextarea.style.fontSize = isMobile ? '1rem' : '0.95rem';
    
    const btnContainer = form.createDiv({ cls: 'modal-btn-container' });
    btnContainer.style.display = 'flex';
    btnContainer.style.gap = '10px';
    btnContainer.style.justifyContent = 'flex-end';
    
    const saveBtn = btnContainer.createEl('button', { text: '저장' });
    saveBtn.style.backgroundColor = '#f59e0b';
    saveBtn.style.color = '#000';
    saveBtn.style.padding = isMobile ? '12px 20px' : '8px 16px';
    saveBtn.style.fontSize = isMobile ? '1rem' : '0.95rem';
    saveBtn.style.minHeight = isMobile ? '48px' : '36px';
    saveBtn.style.flex = '1';
    saveBtn.style.border = 'none';
    saveBtn.style.borderRadius = '6px';
    saveBtn.style.cursor = 'pointer';
    saveBtn.style.fontWeight = 'bold';
    saveBtn.addEventListener('click', async () => {
      this.template.name = nameInput.value;
      this.template.items = itemsTextarea.value.split('\n').filter(item => item.trim());
      
      if (this.isNew) {
        this.plugin.settings.routineTemplates.push(this.template);
      }
      
      await this.plugin.saveSettings();
      this.onSave();
      this.close();
      new Notice('템플릿이 저장되었습니다!');
    });
    
    if (!this.isNew) {
      const deleteBtn = btnContainer.createEl('button', { text: '삭제' });
      deleteBtn.style.backgroundColor = '#ef4444';
      deleteBtn.style.color = '#fff';
      deleteBtn.style.padding = isMobile ? '12px 20px' : '8px 16px';
      deleteBtn.style.fontSize = isMobile ? '1rem' : '0.95rem';
      deleteBtn.style.minHeight = isMobile ? '48px' : '36px';
      deleteBtn.style.flex = '1';
      deleteBtn.style.border = 'none';
      deleteBtn.style.borderRadius = '6px';
      deleteBtn.style.cursor = 'pointer';
      deleteBtn.style.fontWeight = 'bold';
      deleteBtn.addEventListener('click', async () => {
        const index = this.plugin.settings.routineTemplates.findIndex(t => t.id === this.template.id);
        if (index > -1) {
          this.plugin.settings.routineTemplates.splice(index, 1);
          await this.plugin.saveSettings();
          this.onSave();
          this.close();
          new Notice('템플릿이 삭제되었습니다!');
        }
      });
    }
    
    const cancelBtn = btnContainer.createEl('button', { text: '취소' });
    cancelBtn.style.padding = isMobile ? '12px 20px' : '8px 16px';
    cancelBtn.style.fontSize = isMobile ? '1rem' : '0.95rem';
    cancelBtn.style.minHeight = isMobile ? '48px' : '36px';
    cancelBtn.style.flex = '1';
    cancelBtn.style.border = 'none';
    cancelBtn.style.borderRadius = '6px';
    cancelBtn.style.cursor = 'pointer';
    cancelBtn.style.backgroundColor = '#6b7280';
    cancelBtn.style.color = '#fff';
    cancelBtn.style.fontWeight = 'bold';
    cancelBtn.addEventListener('click', () => this.close());
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

// 루틴 추가 모달
class RoutineAddModal extends Modal {
  constructor(app, onAdd) {
    super(app);
    this.onAdd = onAdd;
  }

  onOpen() {
    const { contentEl, modalEl } = this;
    contentEl.empty();
    
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
      modalEl.style.width = '95vw';
      modalEl.style.maxWidth = '95vw';
    }
    
    contentEl.createEl('h2', { text: '새 Routine 추가' }).style.fontSize = isMobile ? '1.3rem' : '1.5rem';
    
    const form = contentEl.createDiv();
    
    form.createEl('label', { text: '루틴 내용' });
    const textInput = form.createEl('input', { type: 'text' });
    textInput.style.width = '100%';
    textInput.style.marginBottom = '15px';
    textInput.style.padding = isMobile ? '12px' : '8px';
    textInput.style.fontSize = isMobile ? '1rem' : '0.95rem';
    
    const btnContainer = form.createDiv();
    btnContainer.style.display = 'flex';
    btnContainer.style.gap = '10px';
    btnContainer.style.justifyContent = 'flex-end';
    
    const addBtn = btnContainer.createEl('button', { text: '추가' });
    addBtn.style.backgroundColor = '#f59e0b';
    addBtn.style.color = '#000';
    addBtn.style.padding = isMobile ? '12px 24px' : '8px 16px';
    addBtn.style.border = 'none';
    addBtn.style.borderRadius = '6px';
    addBtn.style.cursor = 'pointer';
    addBtn.style.fontWeight = 'bold';
    addBtn.style.fontSize = isMobile ? '1rem' : '0.95rem';
    addBtn.style.minHeight = isMobile ? '48px' : '36px';
    addBtn.style.flex = '1';
    addBtn.addEventListener('click', () => {
      const text = textInput.value.trim();
      if (text) {
        this.onAdd(text);
        this.close();
        new Notice('Routine이 추가되었습니다!');
      }
    });
    
    const cancelBtn = btnContainer.createEl('button', { text: '취소' });
    cancelBtn.style.padding = isMobile ? '12px 24px' : '8px 16px';
    cancelBtn.style.border = 'none';
    cancelBtn.style.borderRadius = '6px';
    cancelBtn.style.cursor = 'pointer';
    cancelBtn.style.backgroundColor = '#6b7280';
    cancelBtn.style.color = '#fff';
    cancelBtn.style.fontWeight = 'bold';
    cancelBtn.style.fontSize = isMobile ? '1rem' : '0.95rem';
    cancelBtn.style.minHeight = isMobile ? '48px' : '36px';
    cancelBtn.style.flex = '1';
    cancelBtn.addEventListener('click', () => this.close());
    
    textInput.focus();
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

// 노트 추가 모달
class NoteAddModal extends Modal {
  constructor(app, onAdd) {
    super(app);
    this.onAdd = onAdd;
  }

  onOpen() {
    const { contentEl, modalEl } = this;
    contentEl.empty();
    
    const isMobile = window.innerWidth <= 768;
    if (isMobile) { modalEl.style.width = '95vw'; modalEl.style.maxWidth = '95vw'; }
    
    contentEl.createEl('h2', { text: '새 Note 추가' }).style.fontSize = isMobile ? '1.3rem' : '1.5rem';
    
    const form = contentEl.createDiv();
    
    form.createEl('label', { text: '내용' });
    const textArea = form.createEl('textarea');
    textArea.style.width = '100%';
    textArea.style.minHeight = isMobile ? '100px' : '120px';
    textArea.style.marginBottom = '15px';
    textArea.style.padding = isMobile ? '12px' : '10px';
    textArea.style.fontSize = isMobile ? '1rem' : '0.95rem';
    
    const btnContainer = form.createDiv();
    btnContainer.style.display = 'flex';
    btnContainer.style.gap = '10px';
    btnContainer.style.justifyContent = 'flex-end';
    
    const addBtn = btnContainer.createEl('button', { text: '추가' });
    addBtn.style.backgroundColor = '#f59e0b';
    addBtn.style.color = '#000';
    addBtn.style.padding = isMobile ? '12px 24px' : '8px 16px';
    addBtn.style.border = 'none';
    addBtn.style.borderRadius = '6px';
    addBtn.style.cursor = 'pointer';
    addBtn.style.fontWeight = 'bold';
    addBtn.style.fontSize = isMobile ? '1rem' : '0.95rem';
    addBtn.style.minHeight = isMobile ? '48px' : '36px';
    addBtn.style.flex = '1';
    addBtn.addEventListener('click', () => {
      const text = textArea.value.trim();
      if (text) {
        this.onAdd(text);
        this.close();
        new Notice('Note가 추가되었습니다!');
      }
    });
    
    const cancelBtn = btnContainer.createEl('button', { text: '취소' });
    cancelBtn.style.padding = isMobile ? '12px 24px' : '8px 16px';
    cancelBtn.style.border = 'none';
    cancelBtn.style.borderRadius = '6px';
    cancelBtn.style.cursor = 'pointer';
    cancelBtn.style.backgroundColor = '#6b7280';
    cancelBtn.style.color = '#fff';
    cancelBtn.style.fontWeight = 'bold';
    cancelBtn.style.fontSize = isMobile ? '1rem' : '0.95rem';
    cancelBtn.style.minHeight = isMobile ? '48px' : '36px';
    cancelBtn.style.flex = '1';
    cancelBtn.addEventListener('click', () => this.close());
    
    textArea.focus();
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

// 태스크 추가 모달
class TaskAddModal extends Modal {
  constructor(app, onAdd, defaultHour = null) {
    super(app);
    this.onAdd = onAdd;
    this.defaultHour = defaultHour;
  }

  onOpen() {
    const { contentEl, modalEl } = this;
    contentEl.empty();
    
    const isMobile = window.innerWidth <= 768;
    if (isMobile) { modalEl.style.width = '95vw'; modalEl.style.maxWidth = '95vw'; }
    
    contentEl.createEl('h2', { text: '새 Task 추가' }).style.fontSize = isMobile ? '1.3rem' : '1.5rem';
    
    const form = contentEl.createDiv();
    
    form.createEl('label', { text: '시간' });
    const hourInput = form.createEl('input', { type: 'number', attr: { min: '0', max: '23' } });
    if (this.defaultHour !== null) { hourInput.value = this.defaultHour.toString(); }
    hourInput.style.width = '100%';
    hourInput.style.marginBottom = '15px';
    hourInput.style.padding = isMobile ? '12px' : '8px';
    hourInput.style.fontSize = isMobile ? '1rem' : '0.95rem';
    
    form.createEl('label', { text: '내용' });
    const textInput = form.createEl('input', { type: 'text' });
    textInput.style.width = '100%';
    textInput.style.marginBottom = '15px';
    textInput.style.padding = isMobile ? '12px' : '8px';
    textInput.style.fontSize = isMobile ? '1rem' : '0.95rem';
    
    const addBtn = form.createEl('button', { text: '추가' });
    addBtn.style.backgroundColor = '#f59e0b';
    addBtn.style.color = '#000';
    addBtn.style.width = '100%';
    addBtn.style.padding = isMobile ? '12px' : '8px';
    addBtn.style.fontSize = isMobile ? '1rem' : '0.95rem';
    addBtn.style.minHeight = isMobile ? '48px' : '36px';
    addBtn.style.border = 'none';
    addBtn.style.borderRadius = '6px';
    addBtn.style.cursor = 'pointer';
    addBtn.style.fontWeight = 'bold';
    addBtn.addEventListener('click', () => {
      const hour = parseInt(hourInput.value);
      const text = textInput.value;
      
      if (!isNaN(hour) && hour >= 0 && hour <= 23 && text) {
        this.onAdd(hour, text);
        this.close();
        new Notice('Task가 추가되었습니다!');
      }
    });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

// 최근 파일 모달
class RecentFilesModal extends Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
    this.currentPage = 1;
    this.itemsPerPage = 10;
  }

  async onOpen() {
    const { contentEl, modalEl } = this;
    contentEl.empty();
    
    // 모달 너비 조정 - 반응형
    const isMobile = window.innerWidth <= 768;
    modalEl.style.width = isMobile ? '95vw' : '900px';
    modalEl.style.maxWidth = '95vw';
    
    contentEl.createEl('h2', { text: '📋 Recent Files' }).style.fontSize = isMobile ? '1.3rem' : '1.5rem';
    
    const allFiles = await this.getRecentFiles();
    
    if (allFiles.length === 0) {
      contentEl.createEl('p', { text: '최근 수정한 파일이 없습니다.' });
      const closeBtn = contentEl.createEl('button', { text: '닫기' });
      closeBtn.style.marginTop = '20px';
      closeBtn.addEventListener('click', () => this.close());
      return;
    }
    
    const totalPages = Math.ceil(allFiles.length / this.itemsPerPage);
    const startIdx = (this.currentPage - 1) * this.itemsPerPage;
    const endIdx = startIdx + this.itemsPerPage;
    const currentFiles = allFiles.slice(startIdx, endIdx);
    
    const container = contentEl.createDiv({ cls: 'recent-files-container' });
    container.style.maxHeight = isMobile ? '400px' : '500px';
    container.style.overflowY = 'auto';
    container.style.marginBottom = '15px';
    
    for (const fileInfo of currentFiles) {
      const item = container.createDiv({ cls: 'recent-file-item' });
      item.style.backgroundColor = '#242936';
      item.style.padding = '12px';
      item.style.borderRadius = '8px';
      item.style.marginBottom = '10px';
      item.style.cursor = 'pointer';
      item.style.transition = 'all 0.2s';
      item.style.border = '1px solid #2d3548';
      
      item.addEventListener('mouseenter', () => {
        item.style.backgroundColor = '#2d3548';
        item.style.borderColor = '#f59e0b';
      });
      item.addEventListener('mouseleave', () => {
        item.style.backgroundColor = '#242936';
        item.style.borderColor = '#2d3548';
      });
      
      item.addEventListener('click', async () => {
        await this.app.workspace.getLeaf().openFile(fileInfo.file);
        this.close();
      });
      
      const header = item.createDiv();
      header.style.display = 'flex';
      header.style.justifyContent = 'space-between';
      header.style.marginBottom = '8px';
      
      const dateEl = header.createEl('span');
      dateEl.style.fontWeight = 'bold';
      dateEl.style.color = '#fbbf24';
      dateEl.style.fontSize = isMobile ? '0.9rem' : '1rem';
      dateEl.setText(fileInfo.displayDate);
      
      const statsEl = header.createEl('span');
      statsEl.style.fontSize = '0.9rem';
      statsEl.style.color = '#9ca3af';
      const statusEmoji = fileInfo.completed === fileInfo.total && fileInfo.total > 0 ? '✅' : '⏳';
      statsEl.setText(`${statusEmoji} ${fileInfo.completed}/${fileInfo.total}`);
      
      if (fileInfo.routines.length > 0) {
        const routinesEl = item.createDiv();
        routinesEl.style.fontSize = isMobile ? '0.8rem' : '0.85rem';
        routinesEl.style.color = '#9ca3af';
        routinesEl.style.marginTop = '5px';
        routinesEl.style.lineHeight = '1.4';
        
        const preview = fileInfo.routines.slice(0, 3).map(r => {
          const checkbox = r.checked ? '☑' : '☐';
          return `${checkbox} ${r.text}`;
        }).join(' · ');
        
        routinesEl.setText(preview);
        if (fileInfo.routines.length > 3) {
          routinesEl.setText(preview + ` ... (+${fileInfo.routines.length - 3})`);
        }
      }
    }
    
    // 페이지네이션
    if (totalPages > 1) {
      const pagination = contentEl.createDiv({ cls: 'pagination' });
      pagination.style.display = 'flex';
      pagination.style.justifyContent = 'center';
      pagination.style.gap = '8px';
      pagination.style.marginBottom = '10px';
      
      for (let i = 1; i <= totalPages; i++) {
        const pageBtn = pagination.createEl('button', { text: i.toString() });
        pageBtn.style.padding = isMobile ? '8px 12px' : '6px 12px';
        pageBtn.style.border = 'none';
        pageBtn.style.borderRadius = '4px';
        pageBtn.style.cursor = 'pointer';
        pageBtn.style.fontWeight = 'bold';
        pageBtn.style.transition = 'all 0.2s';
        pageBtn.style.fontSize = isMobile ? '0.9rem' : '0.85rem';
        pageBtn.style.minWidth = isMobile ? '44px' : '36px';
        pageBtn.style.minHeight = isMobile ? '44px' : '36px';
        
        if (i === this.currentPage) {
          pageBtn.style.backgroundColor = '#f59e0b';
          pageBtn.style.color = '#000';
        } else {
          pageBtn.style.backgroundColor = '#242936';
          pageBtn.style.color = '#f3f4f6';
          
          pageBtn.addEventListener('mouseenter', () => {
            pageBtn.style.backgroundColor = '#2d3548';
          });
          pageBtn.addEventListener('mouseleave', () => {
            pageBtn.style.backgroundColor = '#242936';
          });
        }
        
        pageBtn.addEventListener('click', () => {
          this.currentPage = i;
          this.onOpen();
        });
      }
    }
    
    const closeBtn = contentEl.createEl('button', { text: '닫기' });
    closeBtn.style.width = '100%';
    closeBtn.style.marginTop = '10px';
    closeBtn.style.padding = isMobile ? '12px' : '8px';
    closeBtn.style.backgroundColor = '#f59e0b';
    closeBtn.style.color = '#000';
    closeBtn.style.border = 'none';
    closeBtn.style.borderRadius = '6px';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.fontWeight = 'bold';
    closeBtn.style.fontSize = isMobile ? '1rem' : '0.95rem';
    closeBtn.style.minHeight = isMobile ? '48px' : '36px';
    closeBtn.addEventListener('click', () => this.close());
  }

  async getRecentFiles() {
    const files = this.app.vault.getMarkdownFiles().filter(file => 
      file.path.startsWith(this.plugin.settings.routineFolder)
    );
    
    const fileInfos = [];
    
    for (const file of files) {
      const content = await this.app.vault.read(file);
      const dayData = this.plugin.parseFileContent(content);
      
      if (dayData) {
        const completed = dayData.routines ? dayData.routines.filter(r => r.checked).length : 0;
        const total = dayData.routines ? dayData.routines.length : 0;
        
        const dateParts = file.basename.split('-');
        let displayDate = file.basename;
        if (dateParts.length === 3) {
          const date = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
          const days = ['일', '월', '화', '수', '목', '금', '토'];
          displayDate = `${dateParts[0]}-${dateParts[1]}-${dateParts[2]} (${days[date.getDay()]})`;
        }
        
        fileInfos.push({
          file,
          mtime: file.stat.mtime,
          displayDate,
          completed,
          total,
          routines: dayData.routines || []
        });
      }
    }
    
    fileInfos.sort((a, b) => b.mtime - a.mtime);
    
    return fileInfos;
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

// 설정 탭
class RoutinePlannerSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    
    containerEl.createEl('h2', { text: 'Routine Planner 설정' });
    
    new Setting(containerEl)
      .setName('루틴 폴더')
      .setDesc('루틴 파일이 저장될 폴더 경로')
      .addText(text => text
        .setPlaceholder('Routine')
        .setValue(this.plugin.settings.routineFolder)
        .onChange(async (value) => {
          this.plugin.settings.routineFolder = value;
          await this.plugin.saveSettings();
        }));
    
    new Setting(containerEl)
      .setName('폴더 구조')
      .setDesc('루틴 파일의 폴더 구조를 선택하세요')
      .addDropdown(dropdown => dropdown
        .addOption('monthly', '월별 (예: Routine/2025/10/2025-10-24.md)')
        .addOption('weekly', '주별 (예: Routine/2025/Week-43/2025-10-24.md)')
        .addOption('daily', '일별 (예: Routine/2025-10-24.md)')
        .setValue(this.plugin.settings.folderStructure)
        .onChange(async (value) => {
          this.plugin.settings.folderStructure = value;
          await this.plugin.saveSettings();
        }));
    
    new Setting(containerEl)
      .setName('자동 폴더 생성')
      .setDesc('날짜 선택 시 자동으로 폴더를 생성합니다')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.autoCreateFolder)
        .onChange(async (value) => {
          this.plugin.settings.autoCreateFolder = value;
          await this.plugin.saveSettings();
        }));
    
    new Setting(containerEl)
      .setName('파일 동기화')
      .setDesc('UI 변경사항을 즉시 파일에 반영합니다')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.syncWithFiles)
        .onChange(async (value) => {
          this.plugin.settings.syncWithFiles = value;
          await this.plugin.saveSettings();
        }));
    
    containerEl.createEl('h3', { text: '폴더 관리' });
    
    new Setting(containerEl)
      .setName('이번 달 폴더 생성')
      .setDesc('현재 월의 폴더 구조를 생성합니다')
      .addButton(button => button
        .setButtonText('생성')
        .onClick(async () => {
          await this.plugin.createFolderStructure(new Date());
          new Notice('폴더가 생성되었습니다!');
        }));
  }
}

// 메인 플러그인 클래스
class RoutinePlannerPlugin extends Plugin {
  async onload() {
    console.log('Loading Routine Planner plugin');
    
    await this.loadSettings();
    
    this.registerView(
      VIEW_TYPE,
      (leaf) => new RoutinePlannerView(leaf, this)
    );

    this.addRibbonIcon('calendar-check', 'Routine Planner', () => {
      this.activateView();
    });

    this.addCommand({
      id: 'open-routine-planner',
      name: 'Open Routine Planner',
      callback: () => {
        this.activateView();
      }
    });
    
    this.addSettingTab(new RoutinePlannerSettingTab(this.app, this));
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async getDateFilePath(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    let folderPath = this.settings.routineFolder;
    
    if (this.settings.folderStructure === 'monthly') {
      folderPath = `${folderPath}/${year}/${month}`;
    } else if (this.settings.folderStructure === 'weekly') {
      const weekNum = this.getWeekNumber(date);
      folderPath = `${folderPath}/${year}/Week-${weekNum}`;
    }
    
    return `${folderPath}/${dateStr}.md`;
  }

  getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNum = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return weekNum;
  }

  async createFolderStructure(date) {
    const filePath = await this.getDateFilePath(date);
    const folderPath = filePath.substring(0, filePath.lastIndexOf('/'));
    
    try {
      const folder = this.app.vault.getAbstractFileByPath(folderPath);
      if (!folder) {
        await this.app.vault.createFolder(folderPath);
        new Notice(`폴더가 생성되었습니다: ${folderPath}`);
      }
    } catch (err) {
      console.error('폴더 생성 실패:', err);
    }
  }

  async readDateFile(date) {
    const filePath = await this.getDateFilePath(date);
    
    try {
      const file = this.app.vault.getAbstractFileByPath(filePath);
      if (file instanceof TFile) {
        const content = await this.app.vault.read(file);
        return this.parseFileContent(content);
      }
    } catch (err) {
      console.log('파일 읽기 실패:', err);
    }
    
    return { routines: [], tasks: [], notes: [] };
  }

  parseFileContent(content) {
    const data = { routines: [], tasks: [], notes: [] };
    
    const lines = content.split('\n');
    let currentSection = '';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line.startsWith('## ✅ Routines')) {
        currentSection = 'routines';
      } else if (line.startsWith('## 📋 Tasks')) {
        currentSection = 'tasks';
      } else if (line.startsWith('## 💬 Notes')) {
        currentSection = 'notes';
      } else if (currentSection === 'routines' && (line.startsWith('- [ ]') || line.startsWith('- [x]'))) {
        const checked = line.startsWith('- [x]');
        const text = line.substring(6).trim();
        data.routines.push({ text, checked });
      } else if (currentSection === 'tasks' && line.startsWith('**') && line.includes('**')) {
        const hourMatch = line.match(/\*\*(\d+) (AM|PM)\*\*/);
        if (hourMatch) {
          let hour = parseInt(hourMatch[1]);
          if (hourMatch[2] === 'PM' && hour !== 12) hour += 12;
          if (hourMatch[2] === 'AM' && hour === 12) hour = 0;
          
          i++;
          while (i < lines.length && lines[i].trim().startsWith('- ')) {
            const taskText = lines[i].trim().substring(2);
            data.tasks.push({ hour, text: taskText });
            i++;
          }
          i--;
        }
      } else if (currentSection === 'notes' && line.startsWith('- ')) {
        const text = line.substring(2).trim();
        data.notes.push({ text });
      }
    }
    
    return data;
  }

  async writeDateFile(date, data) {
    if (!this.settings.syncWithFiles) return;
    
    const filePath = await this.getDateFilePath(date);
    
    if (this.settings.autoCreateFolder) {
      await this.createFolderStructure(date);
    }
    
    const content = this.generateFileContent(date, data);
    
    try {
      const file = this.app.vault.getAbstractFileByPath(filePath);
      if (file instanceof TFile) {
        await this.app.vault.modify(file, content);
      } else {
        await this.app.vault.create(filePath, content);
      }
    } catch (err) {
      console.error('파일 쓰기 실패:', err);
      new Notice('파일 저장 실패!');
    }
  }

  generateFileContent(date, data) {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const dateStr = `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${days[date.getDay()]})`;
    
    const completedCount = data.routines?.filter(r => r.checked).length || 0;
    const totalCount = data.routines?.length || 0;
    
    let content = `---
date: ${this.formatDate(date)}
routines_completed: ${completedCount}
routines_total: ${totalCount}
---

# ${dateStr}

## ✅ Routines
`;
    
    if (data.routines && data.routines.length > 0) {
      data.routines.forEach(routine => {
        content += `- [${routine.checked ? 'x' : ' '}] ${routine.text}\n`;
      });
    } else {
      content += `(루틴 없음)\n`;
    }
    
    content += `\n## 📋 Tasks\n`;
    
    if (data.tasks && data.tasks.length > 0) {
      const tasksByHour = {};
      data.tasks.forEach(task => {
        if (!tasksByHour[task.hour]) tasksByHour[task.hour] = [];
        tasksByHour[task.hour].push(task.text);
      });
      
      Object.keys(tasksByHour).sort((a, b) => parseInt(a) - parseInt(b)).forEach(hour => {
        const h = parseInt(hour);
        const ampm = h < 12 ? 'AM' : 'PM';
        const displayHour = h === 0 ? 12 : (h > 12 ? h - 12 : h);
        content += `**${displayHour} ${ampm}**\n`;
        tasksByHour[hour].forEach(text => {
          content += `- ${text}\n`;
        });
        content += `\n`;
      });
    } else {
      content += `(태스크 없음)\n`;
    }
    
    content += `\n## 💬 Notes\n`;
    
    if (data.notes && data.notes.length > 0) {
      data.notes.forEach(note => {
        content += `- ${note.text}\n`;
      });
    } else {
      content += `(메모 없음)\n`;
    }
    
    return content;
  }

  formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  async syncAllFiles() {
    const files = this.app.vault.getMarkdownFiles().filter(file => 
      file.path.startsWith(this.settings.routineFolder)
    );
    
    new Notice(`${files.length}개의 파일을 찾았습니다.`);
  }

  async activateView() {
    const { workspace } = this.app;
    
    let leaf = null;
    const leaves = workspace.getLeavesOfType(VIEW_TYPE);
    
    if (leaves.length > 0) {
      leaf = leaves[0];
    } else {
      leaf = workspace.getRightLeaf(false);
      await leaf.setViewState({ type: VIEW_TYPE, active: true });
    }
    
    workspace.revealLeaf(leaf);
  }

  onunload() {
    console.log('Unloading Routine Planner plugin');
  }
}

module.exports = RoutinePlannerPlugin;