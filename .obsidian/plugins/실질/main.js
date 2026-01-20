// ============================================
// Smart Lecture Tracker v3.0 - Part 1/4
// 플러그인 핵심 + 명령어 + 데이터 로딩
// ============================================

const { Plugin, TFile, Notice, Modal, Setting, PluginSettingTab, moment } = require('obsidian');

const DEFAULT_SETTINGS = {
  coursesFolder: '1-Projects/강의학습시스템/강의시리즈',
  dashboardFolder: '📊 대시보드',
  templateFolder: 'Templates',
  dailyGoal: 3,
  weeklyGoal: 15,
  subjects: [
    { name: '수학', icon: '🔢', color: '#3b82f6' },
    { name: '영어', icon: '🇬🇧', color: '#10b981' },
    { name: '과학', icon: '🧪', color: '#f59e0b' },
    { name: '프로그래밍', icon: '💻', color: '#8b5cf6' }
  ],
  reviewIntervals: [1, 3, 7, 14, 30],
  showDateTime: true,
  autoRefresh: true,
  refreshInterval: 300000,
};

class SmartLectureTrackerPlugin extends Plugin {
  async onload() {
    console.log('🚀 Smart Lecture Tracker v3.0 로딩...');
    
    await this.loadSettings();
    
    this.addRibbonIcon('graduation-cap', 'Lecture Tracker', () => {
      this.showQuickMenu();
    });
    
    this.statusBarItem = this.addStatusBarItem();
    this.updateStatusBar();
    
    this.registerCommands();
    this.addSettingTab(new LectureTrackerSettingTab(this.app, this));
    
    if (this.settings.autoRefresh) {
      this.startAutoRefresh();
    }
    
    console.log('✅ Smart Lecture Tracker v3.0 로드 완료!');
  }

  async onunload() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    if (this.statusBarInterval) {
      clearInterval(this.statusBarInterval);
    }
    console.log('👋 Smart Lecture Tracker 언로드됨');
  }
  
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  
  async saveSettings() {
    await this.saveData(this.settings);
  }
  
  async updateStatusBar() {
    try {
      const today = moment().format('YYYY-MM-DD');
      const lectureData = await this.loadLectureData();
      const todayCount = lectureData.filter(l => l['completion-date'] === today).length;
      
      const updateTime = () => {
        if (this.settings.showDateTime) {
          const now = moment().format('HH:mm:ss');
          this.statusBarItem.setText(`📚 ${todayCount}/${this.settings.dailyGoal}강 | ${now}`);
        } else {
          this.statusBarItem.setText(`📚 ${todayCount}/${this.settings.dailyGoal}강`);
        }
      };
      
      updateTime();
      
      if (this.settings.showDateTime && !this.statusBarInterval) {
        this.statusBarInterval = setInterval(updateTime, 1000);
      }
    } catch (error) {
      console.error('상태바 업데이트 오류:', error);
    }
  }
  
  startAutoRefresh() {
    this.refreshInterval = setInterval(() => {
      const activeFile = this.app.workspace.getActiveFile();
      if (activeFile && activeFile.path.includes(this.settings.dashboardFolder)) {
        this.app.workspace.activeLeaf.rebuildView();
      }
    }, this.settings.refreshInterval);
  }
  
  showQuickMenu() {
    new QuickMenuModal(this.app, this).open();
  }

  registerCommands() {
    this.addCommand({
      id: 'create-lecture-series',
      name: '📚 새 강의 시리즈 생성',
      callback: () => {
        new SeriesCreationModal(this.app, this).open();
      }
    });

    this.addCommand({
      id: 'open-main-dashboard',
      name: '📊 메인 대시보드 열기',
      callback: () => {
        this.openMainDashboard();
      }
    });

    this.addCommand({
      id: 'create-series-dashboard',
      name: '📊 시리즈 대시보드 생성',
      callback: () => {
        new CreateSeriesDashboardModal(this.app, this).open();
      }
    });

    this.addCommand({
      id: 'show-review-list',
      name: '🔄 복습할 강의 보기',
      callback: () => {
        new ReviewListModal(this.app, this).open();
      }
    });

    this.addCommand({
      id: 'show-statistics',
      name: '📈 학습 통계 보기',
      callback: () => {
        new StatisticsModal(this.app, this).open();
      }
    });

    this.addCommand({
      id: 'refresh-dashboard',
      name: '🔄 대시보드 새로고침',
      callback: () => {
        this.refreshDashboard();
      }
    });

    this.addCommand({
      id: 'quick-menu',
      name: '⚡ 퀵 메뉴',
      callback: () => {
        this.showQuickMenu();
      }
    });

    this.addCommand({
      id: 'update-understanding',
      name: '🧠 이해도 입력',
      callback: () => {
        new UpdateUnderstandingModal(this.app, this).open();
      }
    });

    this.addCommand({
      id: 'quick-complete-lecture',
      name: '✅ 강의 완료 처리',
      callback: () => {
        new QuickCompleteLectureModal(this.app, this).open();
      }
    });
  }

  refreshDashboard() {
    const activeFile = this.app.workspace.getActiveFile();
    if (activeFile) {
      this.app.workspace.activeLeaf.rebuildView();
      new Notice('✅ 대시보드 새로고침 완료!');
    } else {
      new Notice('❌ 열린 파일이 없습니다');
    }
  }

  async loadLectureData() {
    try {
      const coursesFolder = this.app.vault.getAbstractFileByPath(this.settings.coursesFolder);
      if (!coursesFolder || !coursesFolder.children) {
        return [];
      }

      const lectureData = [];
      
      for (const seriesFolder of coursesFolder.children) {
        if (seriesFolder.children) {
          for (const file of seriesFolder.children) {
            if (file.extension === 'md' && file.name.includes('강')) {
              try {
                const fileContent = await this.app.vault.read(file);
                const frontmatter = this.parseFrontmatter(fileContent);
                
                if (frontmatter && frontmatter['course-number']) {
                  lectureData.push({
                    file: file,
                    path: file.path,
                    folder: seriesFolder.name,
                    ...frontmatter
                  });
                }
              } catch (error) {
                console.error(`파일 읽기 오류 ${file.path}:`, error);
              }
            }
          }
        }
      }
      
      return lectureData;
    } catch (error) {
      console.error('강의 데이터 로딩 오류:', error);
      return [];
    }
  }

  parseFrontmatter(content) {
    const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
    const match = content.match(frontmatterRegex);
    
    if (!match) return null;
    
    try {
      const yaml = match[1];
      const lines = yaml.split('\n');
      const result = {};
      
      for (const line of lines) {
        if (line.includes(':')) {
          const [key, ...valueParts] = line.split(':');
          const value = valueParts.join(':').trim();
          
          if (value === 'true') result[key.trim()] = true;
          else if (value === 'false') result[key.trim()] = false;
          else if (!isNaN(value) && value !== '') result[key.trim()] = parseFloat(value);
          else result[key.trim()] = value.replace(/['"]/g, '');
        }
      }
      
      return result;
    } catch (error) {
      console.error('Frontmatter 파싱 오류:', error);
      return null;
    }
  }

  async openFile(filePath) {
    try {
      const file = this.app.vault.getAbstractFileByPath(filePath);
      if (file) {
        await this.app.workspace.openLinkText(filePath, '', false);
      } else {
        new Notice(`❌ 파일을 찾을 수 없습니다: ${filePath}`);
      }
    } catch (error) {
      console.error('파일 열기 오류:', error);
      new Notice('❌ 파일을 여는 중 오류가 발생했습니다');
    }
  }

  // Part 2에서 계속...
// ============================================
// Smart Lecture Tracker v3.0 - Part 2/4
// 시리즈 생성 + 강의 템플릿 + 시리즈 대시보드
// ============================================

  // Part 1에서 계속...
  
  async createLectureSeries(seriesName, totalLectures) {
    try {
      const seriesFolder = `${this.settings.coursesFolder}/${seriesName}`;
      
      if (!await this.app.vault.adapter.exists(seriesFolder)) {
        await this.app.vault.createFolder(seriesFolder);
      }

      await this.createSeriesDashboard(seriesFolder, seriesName);
      await this.createLectureFiles(seriesFolder, seriesName, totalLectures);

      new Notice(`✅ "${seriesName}" 시리즈가 생성되었습니다! (${totalLectures}강)`);

      const dashboardPath = `${seriesFolder}/${seriesName}.md`;
      await this.openFile(dashboardPath);

      return true;
    } catch (error) {
      console.error('시리즈 생성 오류:', error);
      new Notice('❌ 시리즈 생성 중 오류가 발생했습니다');
      return false;
    }
  }

  async createLectureFiles(seriesFolder, seriesName, totalLectures) {
    const batchSize = 10;
    
    for (let i = 1; i <= totalLectures; i++) {
      const lectureContent = this.generateLectureTemplate(seriesName, i);
      const lecturePath = `${seriesFolder}/${i}강 - .md`;
      
      try {
        await this.app.vault.create(lecturePath, lectureContent);
        
        if (i % batchSize === 0 || i === totalLectures) {
          new Notice(`📝 ${i}/${totalLectures}강 생성 중...`);
        }
      } catch (error) {
        console.error(`강의 파일 생성 오류 (${i}강):`, error);
      }
    }
  }

  generateLectureTemplate(seriesName, lectureNumber) {
    const now = moment();
    const today = now.format('YYYY-MM-DD');
    const todayTime = now.format('YYYY-MM-DD HH:mm:ss');
    const nextLectureNumber = lectureNumber + 1;
    
    return `---
course-number: ${lectureNumber}
lecture-name: ""
completion-date: ""
completion-time: ""
target-date: ""
total-minutes: 0
total-hours: 0
total-seconds: 0
progress: 0
difficulty: 3
satisfaction: 0
understanding: 0
recommend: 0
tags:
  - 강의학습
  - ${seriesName}
---

# ${lectureNumber}강 - 

> **시리즈**: ${seriesName} | **생성일**: ${todayTime}

---

## ⏱️ 스톱워치

\`\`\`dataviewjs
const container = dv.container;
container.innerHTML = \`
<div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 20px; border-radius: 12px; color: white; box-shadow: 0 4px 15px rgba(245, 158, 11, 0.3);">
  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
    <h3 style="margin: 0; color: #fff;">⏱️ 학습 시간 측정</h3>
    <div id="timer-display" style="font-size: 32px; font-weight: bold; font-family: monospace; color: #000;">00:00:00</div>
  </div>
  <div style="display: flex; gap: 10px;">
    <button id="start-btn" style="flex: 1; padding: 12px; background: #10b981; border: none; border-radius: 8px; color: white; font-weight: 600; cursor: pointer; transition: all 0.2s;">▶️ 시작</button>
    <button id="pause-btn" style="flex: 1; padding: 12px; background: #3b82f6; border: none; border-radius: 8px; color: white; font-weight: 600; cursor: pointer; transition: all 0.2s;" disabled>⏸️ 일시정지</button>
    <button id="reset-btn" style="flex: 1; padding: 12px; background: #ef4444; border: none; border-radius: 8px; color: white; font-weight: 600; cursor: pointer; transition: all 0.2s;">🔄 리셋</button>
    <button id="save-btn" style="flex: 1; padding: 12px; background: #fbbf24; border: none; border-radius: 8px; color: #000; font-weight: 600; cursor: pointer; transition: all 0.2s;">💾 저장</button>
  </div>
  <div id="status-msg" style="margin-top: 10px; font-size: 14px; text-align: center; color: #000; opacity: 0.8;"></div>
</div>
\`;

let seconds = 0;
let timerInterval = null;
let isRunning = false;

const display = container.querySelector('#timer-display');
const startBtn = container.querySelector('#start-btn');
const pauseBtn = container.querySelector('#pause-btn');
const resetBtn = container.querySelector('#reset-btn');
const saveBtn = container.querySelector('#save-btn');
const statusMsg = container.querySelector('#status-msg');

function updateDisplay() {
  const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  display.textContent = \`\${h}:\${m}:\${s}\`;
}

startBtn.onclick = () => {
  if (!isRunning) {
    isRunning = true;
    startBtn.disabled = true;
    pauseBtn.disabled = false;
    timerInterval = setInterval(() => {
      seconds++;
      updateDisplay();
    }, 1000);
    statusMsg.textContent = '⏱️ 측정 중...';
  }
};

pauseBtn.onclick = () => {
  if (isRunning) {
    isRunning = false;
    clearInterval(timerInterval);
    startBtn.disabled = false;
    pauseBtn.disabled = true;
    statusMsg.textContent = '⏸️ 일시정지됨';
  }
};

resetBtn.onclick = () => {
  clearInterval(timerInterval);
  isRunning = false;
  seconds = 0;
  updateDisplay();
  startBtn.disabled = false;
  pauseBtn.disabled = true;
  statusMsg.textContent = '🔄 리셋됨';
};

saveBtn.onclick = async () => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  
  try {
    const file = app.workspace.getActiveFile();
    if (!file) {
      statusMsg.textContent = '❌ 파일을 찾을 수 없습니다';
      return;
    }
    
    const content = await app.vault.read(file);
    const fmRegex = /^---\\n([\\s\\S]*?)\\n---/;
    const match = content.match(fmRegex);
    
    if (!match) {
      statusMsg.textContent = '❌ Frontmatter 없음';
      return;
    }
    
    let fm = match[1].split('\\n');
    const fields = {'total-hours': h, 'total-minutes': m, 'total-seconds': s};
    
    for (const [key, val] of Object.entries(fields)) {
      let found = false;
      for (let i = 0; i < fm.length; i++) {
        if (fm[i].startsWith(\`\${key}:\`)) {
          fm[i] = \`\${key}: \${val}\`;
          found = true;
          break;
        }
      }
      if (!found) fm.push(\`\${key}: \${val}\`);
    }
    
    const newContent = content.replace(fmRegex, \`---\\n\${fm.join('\\n')}\\n---\`);
    await app.vault.modify(file, newContent);
    statusMsg.textContent = \`✅ 저장됨: \${h}h \${m}m \${s}s\`;
  } catch (e) {
    statusMsg.textContent = '❌ 저장 실패';
    console.error(e);
  }
};
\`\`\`

---

## 🎯 미니 진행률

\`\`\`dataviewjs
const currentFile = dv.current();
const allTasks = currentFile.file.tasks || [];
const learningTasks = allTasks.filter(t => t.text.includes("#강의학습"));
const completedTasks = learningTasks.filter(t => t.completed).length;
const totalTasks = learningTasks.length;
const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

let statusEmoji = "⭕";
let statusColor = "#9ca3af";
if (progressPercent === 100) { statusEmoji = "✅"; statusColor = "#10b981"; }
else if (progressPercent >= 75) { statusEmoji = "🔥"; statusColor = "#f59e0b"; }
else if (progressPercent >= 50) { statusEmoji = "🟡"; statusColor = "#fbbf24"; }
else if (progressPercent >= 25) { statusEmoji = "🔄"; statusColor = "#3b82f6"; }

dv.paragraph(\`
<div style="background: \${statusColor}; border-radius: 8px; padding: 12px; color: white; display: flex; align-items: center; gap: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.2);">
  <div style="font-size: 32px;">\${statusEmoji}</div>
  <div style="flex: 1;">
    <div style="font-size: 20px; font-weight: 700;">\${progressPercent}%</div>
    <div style="font-size: 12px; opacity: 0.9;">\${completedTasks}/\${totalTasks} 완료</div>
  </div>
  <div style="background: rgba(0,0,0,0.2); height: 8px; flex: 2; border-radius: 999px; overflow: hidden;">
    <div style="background: white; height: 100%; width: \${progressPercent}%; border-radius: 999px; transition: width 0.5s ease;"></div>
  </div>
</div>
\`);
\`\`\`

---

## ✅ 학습 체크리스트

- [ ] 📖 강의 시청 완료 #강의학습
- [ ] 📝 핵심 내용 정리 완료 #강의학습
- [ ] 💡 예제 풀이 완료 #강의학습
- [ ] 🧠 이해도 평가 완료 #강의학습
- [ ] 🔄 1차 복습
- [ ] 🔄 2차 복습
- [ ] 🔄 3차 복습

---

## 📊 학습 평가

**진행률**: 0% (frontmatter의 progress 값 수정)
**난이도**: 3 (1-5)
- 1 = ⭐ 매우 쉬움
- 2 = ⭐⭐ 쉬움
- 3 = ⭐⭐⭐ 보통
- 4 = ⭐⭐⭐⭐ 어려움
- 5 = ⭐⭐⭐⭐⭐ 매우 어려움

**학습 시간**: 
- 시간: 0시간 (total-hours)
- 분: 0분 (total-minutes)
- 초: 0초 (total-seconds)

**완료일**: (completion-date: YYYY-MM-DD)
**완료시간**: (completion-time: HH:mm:ss)
**만족도**: 0/5
**이해도**: 0/5
**추천도**: 0/5

---

## 🎯 학습 내용

### 📌 핵심 개념



### 💡 중요 포인트



---

## 🔄 복습 노트

### 1차 복습
- [ ] 복습 완료

### 2차 복습
- [ ] 복습 완료

### 3차 복습
- [ ] 복습 완료

---

## 🎯 다음 강의

[[${nextLectureNumber}강 - ]]

---

*📚 강의: ${lectureNumber}강 | 📅 생성: ${todayTime}*
`;
  }

  async createSeriesDashboard(seriesFolder, seriesName) {
    const dashboardPath = `${seriesFolder}/${seriesName}.md`;
    const dashboardContent = this.generateSeriesDashboardTemplate(seriesName);
    
    try {
      await this.app.vault.create(dashboardPath, dashboardContent);
    } catch (error) {
      console.error('대시보드 생성 오류:', error);
    }
  }

  generateSeriesDashboardTemplate(seriesName) {
    const now = moment();
    const todayTime = now.format('YYYY-MM-DD HH:mm:ss');
    const dashboardFolder = this.settings.dashboardFolder;
    
    return `---
cssclasses:
  - dashboard
---

# 📚 ${seriesName}

> **시리즈 대시보드** | 📅 ${todayTime}

---

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
    -webkit-tap-highlight-color: transparent;
    user-select: none;
}
.action-card:active {
    transform: scale(0.95);
    opacity: 0.8;
}
.action-card-1 { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); }
.action-card-2 { background: linear-gradient(135deg, #10b981 0%, #059669 100%); }
.action-card-3 { background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); }
.action-card-4 { background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); }
.action-title { font-weight: bold; font-size: 1rem; margin-bottom: 8px; color: #000; }
.action-desc { font-size: 0.8rem; opacity: 0.8; color: #000; }
@media (max-width: 768px) {
    .action-grid { gap: 10px; }
    .action-card { padding: 15px; }
}
</style>
\`;

const actionHtml = actionStyles + \`
<div class="action-grid">
    <button class="action-card action-card-1" data-action="new-lecture">
        <div class="action-title">🎬 새 강의</div>
        <div class="action-desc">강의 추가</div>
    </button>
    <button class="action-card action-card-2" data-action="main-dashboard">
        <div class="action-title">📊 메인</div>
        <div class="action-desc">전체 대시보드</div>
    </button>
    <button class="action-card action-card-3" data-action="refresh">
        <div class="action-title">🔄 새로고침</div>
        <div class="action-desc">업데이트</div>
    </button>
    <button class="action-card action-card-4" data-action="statistics">
        <div class="action-title">📈 통계</div>
        <div class="action-desc">분석</div>
    </button>
</div>
\`;

actionContainer.innerHTML = actionHtml;

setTimeout(() => {
    const buttons = actionContainer.querySelectorAll('.action-card');
    
    buttons.forEach(button => {
        const handleClick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const action = button.dataset.action;
            
            try {
                if (action === 'refresh') {
                    if (app?.commands) {
                        app.commands.executeCommandById('dataview:dataview-force-refresh-views');
                        if (window.Notice) new Notice('🔄 새로고침!');
                    }
                } else if (action === 'main-dashboard') {
                    if (app?.workspace) {
                        app.workspace.openLinkText('${dashboardFolder}/메인 대시보드', '', false);
                    }
                } else if (action === 'new-lecture') {
                    if (window.Notice) {
                        new Notice('🎬 Ctrl+P → 새 강의 시리즈 생성');
                    }
                } else if (action === 'statistics') {
                    if (window.Notice) {
                        new Notice('📈 Ctrl+P → 학습 통계 보기');
                    }
                }
            } catch (error) {
                console.error('액션 실행 오류:', error);
            }
        };
        
        button.addEventListener('click', handleClick);
        button.addEventListener('touchend', handleClick);
    });
}, 200);
\`\`\`

---

## 📊 ${seriesName} 진행률

\`\`\`dataviewjs
const seriesName = "${seriesName}";
const currentFolder = dv.current().file.folder;
const lecturePages = dv.pages(\`"\${currentFolder}"\`)
    .where(p => p.file.name !== seriesName && p['course-number'])
    .sort(p => p["course-number"] || 0);

if (lecturePages.length === 0) {
    dv.paragraph("### 📝 아직 생성된 강의가 없습니다");
    dv.paragraph("🚀 새 강의를 추가해주세요!");
} else {
    let completedLectures = 0;
    let totalProgress = 0;
    let allTotalMinutes = 0;
    const lectureData = [];
    
    for (const page of lecturePages) {
        const tasks = page.file.tasks || [];
        const lectureTasks = tasks.filter(t => t.text.includes("#강의학습"));
        const total = lectureTasks.length;
        const done = lectureTasks.filter(t => t.completed).length;
        const progress = total > 0 ? Math.round((done / total) * 100) : 0;
        
        const isCompleted = progress === 100 || (page["completion-date"] && page["completion-date"] !== "");
        
        const reviewTasks = tasks.filter(t => t.text.includes("차 복습") && t.completed);
        const reviewCount = reviewTasks.length;
        
        if (isCompleted) completedLectures++;
        totalProgress += progress;
        allTotalMinutes += page["total-minutes"] || 0;
        
        const statusIcon = isCompleted ? "✅" : 
                          progress >= 90 ? "🔥" : 
                          progress >= 50 ? "🟡" : 
                          progress > 0 ? "🔄" : "⭕";
        
        const progressBar = "▓".repeat(Math.floor(progress/20)) + "░".repeat(5-Math.floor(progress/20));
        const reviewStatus = reviewCount > 0 ? \`🔄×\${reviewCount}\` : "";
        
        const understanding = page["understanding"] || 0;
        const understandingPercent = page["understanding"]
            ? "<div style='min-width:45px;text-align:center;'>" + (page["understanding"] * 20) + "%</div>"
            : "-";
	const totalHours = page["total-hours"] || 0;
        const totalMinutes = page["total-minutes"] || 0;
        const totalSeconds = page["total-seconds"] || 0;
        const timeDisplay = totalHours > 0 || totalMinutes > 0 || totalSeconds > 0 
            ? \`\${totalHours}h \${totalMinutes}m \${totalSeconds}s\` 
            : "-";
        
        const mtime = page.file ? page.file.mtime : new Date();
const completionDateTime =
    page["completion-date"] && page["completion-time"]
        ? page["completion-date"] + " " + page["completion-time"]
        : page["completion-date"]
        ? page["completion-date"]
        : mtime.toLocaleString('ko-KR', {
              year: '2-digit',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit'
          });


 lectureData.push([
            page["course-number"] + "강",
            "[[" + page.file.path + "|" + (page["lecture-name"] || page.file.name) + "]]",
            progressBar + " " + progress + "%",
            reviewStatus,
            timeDisplay,
            understandingPercent,
            statusIcon,
            completionDateTime
        ]);
    }
    
    const overallProgress = lecturePages.length > 0 ? Math.round(totalProgress / lecturePages.length) : 0;
    const completionRate = Math.round((completedLectures / lecturePages.length) * 100);
    const totalHours = Math.floor(allTotalMinutes / 60);
    const remainingMinutes = allTotalMinutes % 60;
    
    let gradeEmoji = "";
    let gradeName = "";
    if (overallProgress >= 95) { gradeEmoji = "🏆"; gradeName = "전설"; }
    else if (overallProgress >= 90) { gradeEmoji = "🥇"; gradeName = "S+"; }
    else if (overallProgress >= 80) { gradeEmoji = "🥈"; gradeName = "S"; }
    else if (overallProgress >= 70) { gradeEmoji = "🥉"; gradeName = "A"; }
    else if (overallProgress >= 60) { gradeEmoji = "📗"; gradeName = "B"; }
    else if (overallProgress >= 50) { gradeEmoji = "📘"; gradeName = "C"; }
    else { gradeEmoji = "📕"; gradeName = "D"; }
    
    dv.paragraph(\`### 🎯 \${seriesName} 전체 진행률\`);
    dv.paragraph(\`\${gradeEmoji} **현재 등급**: \${gradeName} | **전체 진행률**: \${overallProgress}%\`);
    dv.paragraph(\`📊 **완료율**: \${completionRate}% (\${completedLectures}/\${lecturePages.length}강)\`);
    
    if (allTotalMinutes > 0) {
        dv.paragraph(\`⏰ **총 학습시간**: \${totalHours}시간 \${remainingMinutes}분\`);
    }
    
    const progressBar = "🟩".repeat(Math.floor(overallProgress/10)) + "⬜".repeat(10-Math.floor(overallProgress/10));
    dv.paragraph(\`**진행바**: \${progressBar} \${overallProgress}%\`);
    
    dv.paragraph(\`<div style="width: 100%; background: #1e212b; border-radius: 10px; overflow: hidden; margin: 10px 0; box-shadow: 0 4px 15px rgba(0,0,0,0.3);">\`);
    dv.paragraph(\`<div style="width: \${overallProgress}%; background: linear-gradient(90deg, #f59e0b, #fbbf24); height: 30px; display: flex; align-items: center; justify-content: center; color: #000; font-weight: bold; transition: width 0.3s ease;">\${overallProgress}%</div>\`);
    dv.paragraph(\`</div>\`);
    
    dv.paragraph("### 📋 강의별 상세 진행률");
    dv.table(
        ["순서", "강의명", "진행률", "복습", "학습시간", "이해도", "상태", "완료일시"],
        lectureData
    );
}
\`\`\`

---

*📅 생성일: ${todayTime} | 🔄 실시간 업데이트*
`;
  }

  // Part 3으로 계속...
// ============================================
// Smart Lecture Tracker v3.0 - Part 3/4
// 메인 대시보드 (슈퍼허브) - 모바일 최적화
// ============================================

  // Part 2에서 계속...

  async openMainDashboard() {
    const dashboardPath = `${this.settings.dashboardFolder}/메인 대시보드.md`;
    
    let file = this.app.vault.getAbstractFileByPath(dashboardPath);
    if (!file) {
      await this.createMainDashboard();
      file = this.app.vault.getAbstractFileByPath(dashboardPath);
    }
    
    if (file) {
      await this.openFile(dashboardPath);
    }
  }

  async createMainDashboard() {
    const dashboardPath = `${this.settings.dashboardFolder}/메인 대시보드.md`;
    const content = this.generateMainDashboardTemplate();
    
    try {
      if (!await this.app.vault.adapter.exists(this.settings.dashboardFolder)) {
        await this.app.vault.createFolder(this.settings.dashboardFolder);
      }
      
      await this.app.vault.create(dashboardPath, content);
    } catch (error) {
      console.error('메인 대시보드 생성 오류:', error);
    }
  }

  generateMainDashboardTemplate() {
    const now = moment();
    const today = now.format('YYYY-MM-DD');
    const todayTime = now.format('YYYY-MM-DD HH:mm:ss');
    const coursesFolder = this.settings.coursesFolder;
    const dailyGoal = this.settings.dailyGoal;
    const weeklyGoal = this.settings.weeklyGoal;
    
    return `---
cssclasses:
  - dashboard
dashboard: true
created: ${today}
---

# 🚀 슈퍼허브 대시보드

> **폴더강의 학습시스템** | 📅 ${todayTime}

---

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
    color: #000;
    cursor: pointer;
    transition: all 0.3s ease;
    border: none;
    font-family: inherit;
    box-shadow: 0 4px 15px rgba(0,0,0,0.3);
    font-weight: 600;
    -webkit-tap-highlight-color: transparent;
    user-select: none;
}
.action-card:active {
    transform: scale(0.95);
    opacity: 0.8;
}
.action-card-1 { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); }
.action-card-2 { background: linear-gradient(135deg, #10b981 0%, #059669 100%); }
.action-card-3 { background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); }
.action-card-4 { background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); }
.action-title { font-weight: bold; font-size: 1rem; margin-bottom: 8px; }
.action-desc { font-size: 0.8rem; opacity: 0.8; }
@media (max-width: 768px) {
    .action-grid { gap: 10px; }
    .action-card { padding: 15px; }
}
</style>
\`;

const actionsHTML = actionStyles + \`
<div class="action-grid">
    <button class="action-card action-card-1" data-action="create-series">
        <div class="action-title">🎬 새 시리즈</div>
        <div class="action-desc">강의 시리즈 생성</div>
    </button>
    <button class="action-card action-card-2" data-action="review-list">
        <div class="action-title">🔄 복습 목록</div>
        <div class="action-desc">복습할 강의</div>
    </button>
    <button class="action-card action-card-3" data-action="statistics">
        <div class="action-title">📈 학습 통계</div>
        <div class="action-desc">상세 분석</div>
    </button>
    <button class="action-card action-card-4" data-action="refresh">
        <div class="action-title">🔄 새로고침</div>
        <div class="action-desc">업데이트</div>
    </button>
</div>
\`;

actionContainer.innerHTML = actionsHTML;

setTimeout(() => {
    const buttons = actionContainer.querySelectorAll('.action-card');
    
    buttons.forEach(button => {
        const handleClick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const action = button.dataset.action;
            
            try {
                if (action === 'create-series') {
                    if (app?.commands) {
                        app.commands.executeCommandById('smart-lecture-tracker:create-lecture-series');
                    } else if (window.Notice) {
                        new Notice('⚠️ 명령 팔레트(Ctrl+P)에서 "새 강의 시리즈 생성" 실행');
                    }
                } else if (action === 'review-list') {
                    if (app?.commands) {
                        app.commands.executeCommandById('smart-lecture-tracker:show-review-list');
                    } else if (window.Notice) {
                        new Notice('⚠️ 명령 팔레트(Ctrl+P)에서 "복습할 강의 보기" 실행');
                    }
                } else if (action === 'statistics') {
                    if (app?.commands) {
                        app.commands.executeCommandById('smart-lecture-tracker:show-statistics');
                    } else if (window.Notice) {
                        new Notice('⚠️ 명령 팔레트(Ctrl+P)에서 "학습 통계 보기" 실행');
                    }
                } else if (action === 'refresh') {
                    if (app?.commands) {
                        app.commands.executeCommandById('dataview:dataview-force-refresh-views');
                        if (window.Notice) new Notice('🔄 새로고침!');
                    } else if (window.Notice) {
                        new Notice('⚠️ 페이지를 다시 열어주세요');
                    }
                }
            } catch (error) {
                console.error('액션 실행 오류:', error);
                if (window.Notice) {
                    new Notice('⚠️ Ctrl+P에서 명령을 실행해주세요');
                }
            }
        };
        
        button.addEventListener('click', handleClick);
        button.addEventListener('touchend', handleClick);
    });
}, 200);
\`\`\`

---

## 🎯 오늘의 학습 현황

\`\`\`dataviewjs
const today = "${today}";
const allLectures = dv.pages('"${coursesFolder}"').where(p => p["course-number"]);
const todayLectures = allLectures.where(p => p["completion-date"] === today);
const todayCount = todayLectures.length;
const dailyGoal = ${dailyGoal};
const todayProgress = Math.min(Math.round((todayCount / dailyGoal) * 100), 100);

dv.paragraph(\`
<div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 25px; border-radius: 12px; color: #000; box-shadow: 0 4px 20px rgba(245, 158, 11, 0.4);">
  <h3 style="margin: 0 0 10px 0; color: #000;">🎯 오늘의 학습 목표</h3>
  <div style="font-size: 42px; font-weight: bold; margin: 15px 0;">\${todayCount} / \${dailyGoal}강</div>
  <div style="background: rgba(0,0,0,0.2); height: 10px; border-radius: 5px; margin-top: 15px;">
    <div style="background: #000; height: 100%; width: \${todayProgress}%; border-radius: 5px; transition: width 0.3s ease;"></div>
  </div>
  <div style="margin-top: 10px; opacity: 0.8;">진행률: \${todayProgress}%</div>
</div>
\`);
\`\`\`

---

## 🎯 시각적 학습 카드

\`\`\`dataviewjs
const seriesPath = "${coursesFolder}";
const allPages = dv.pages('"' + seriesPath + '"');
const seriesGroups = {};

for (const page of allPages) {
    const pathParts = page.file.path.split('/');
    if (pathParts.length >= 2) {
        const folderName = pathParts[1];
        if (!seriesGroups[folderName]) {
            seriesGroups[folderName] = { 
                lectures: [], 
                completedLectures: 0, 
                totalStudyTime: 0,
                totalReviews: 0
            };
        }
        
        if (page.file.name !== folderName && page['course-number']) {
            const tasks = page.file.tasks || [];
            const lectureTasks = tasks.filter(t => t.text.includes("#강의학습"));
            const total = lectureTasks.length;
            const done = lectureTasks.filter(t => t.completed).length;
            const progress = total > 0 ? Math.round((done / total) * 100) : 0;
            
            const completionDate = page["completion-date"];
            const hasCompletionDate = completionDate && completionDate !== "" && completionDate !== null;
            const isFullProgress = progress === 100;
            const isCompleted = hasCompletionDate || isFullProgress;
            
            const reviewTasks = tasks.filter(t => t.text.includes("차 복습") && t.completed);
            
            seriesGroups[folderName].lectures.push({
                page: page,
                progress: progress,
                isCompleted: isCompleted
            });
            
            if (isCompleted) seriesGroups[folderName].completedLectures++;
            seriesGroups[folderName].totalStudyTime += page["total-minutes"] || 0;
            seriesGroups[folderName].totalReviews += reviewTasks.length;
        }
    }
}

const validSeries = Object.entries(seriesGroups).filter(([name, data]) => data.lectures.length > 0);

if (validSeries.length === 0) {
    dv.paragraph("📝 아직 등록된 강의 시리즈가 없습니다.");
    dv.paragraph("🚀 새 시리즈: \`Ctrl+P\` → **새 강의 시리즈 생성**");
} else {
    for (const [seriesName, seriesData] of validSeries) {
        const seriesProgress = seriesData.lectures.length > 0 ? 
            Math.round(seriesData.lectures.reduce((sum, lecture) => sum + lecture.progress, 0) / seriesData.lectures.length) : 0;
        const completionRate = Math.round((seriesData.completedLectures / seriesData.lectures.length) * 100);
        
        let seriesEmoji = "📚";
        if (seriesName.includes('영어')) seriesEmoji = "🇬🇧";
        else if (seriesName.includes('수학')) seriesEmoji = "🔢";
        else if (seriesName.includes('과학')) seriesEmoji = "🧪";
        else if (seriesName.includes('프로그래밍')) seriesEmoji = "💻";
        
        const hours = Math.floor(seriesData.totalStudyTime / 60);
        const minutes = seriesData.totalStudyTime % 60;
        const timeDisplay = seriesData.totalStudyTime > 0 ? 
            (hours > 0 ? \`\${hours}h \${minutes}m\` : \`\${minutes}m\`) : "0m";
        
        let statusEmoji = "🟡";
        if (completionRate === 100) statusEmoji = "✅";
        else if (seriesProgress >= 80) statusEmoji = "🔥";
        else if (seriesProgress === 0) statusEmoji = "⭕";
        
        dv.paragraph(\`### \${seriesEmoji} **\${seriesName}** \${statusEmoji}\`);
        dv.paragraph(\`**진행률**: \${seriesProgress}% | **완료율**: \${completionRate}% | **학습시간**: \${timeDisplay} | **복습**: \${seriesData.totalReviews}회\`);
        
        const progressBar = '🟩'.repeat(Math.floor(seriesProgress/10)) + '⬜'.repeat(10 - Math.floor(seriesProgress/10));
        dv.paragraph(\`\${progressBar} \${seriesProgress}%\`);
        
        const seriesDashboardPath = \`${coursesFolder}/\${seriesName}/\${seriesName}.md\`;
        dv.paragraph(\`📊 [[\${seriesDashboardPath}|🔗 \${seriesName} 상세보기]]\`);
        
        dv.paragraph(\`---\`);
    }
    
    let totalLectures = 0;
    let totalCompleted = 0;
    let grandTotalTime = 0;
    let grandTotalReviews = 0;
    
    for (const [seriesName, seriesData] of validSeries) {
        totalLectures += seriesData.lectures.length;
        totalCompleted += seriesData.completedLectures;
        grandTotalTime += seriesData.totalStudyTime;
        grandTotalReviews += seriesData.totalReviews;
    }
    
    const overallProgress = totalLectures > 0 ? Math.round((totalCompleted / totalLectures) * 100) : 0;
    const totalHours = Math.floor(grandTotalTime / 60);
    const totalMinutes = grandTotalTime % 60;
    
    dv.paragraph(\`## 🏆 전체 통계\`);
    dv.paragraph(\`**전체 완료율**: \${overallProgress}% (\${totalCompleted}/\${totalLectures}강)\`);
    dv.paragraph(\`**전체 학습 시간**: \${totalHours}시간 \${totalMinutes}분\`);
    dv.paragraph(\`**전체 복습 횟수**: \${grandTotalReviews}회\`);
    dv.paragraph(\`**활성 시리즈**: \${validSeries.length}개\`);
    
    let achievement = "";
    if (overallProgress >= 95) achievement = "🏆 전설";
    else if (overallProgress >= 90) achievement = "🥇 마스터";
    else if (overallProgress >= 80) achievement = "🥈 전문가";
    else if (overallProgress >= 70) achievement = "🥉 숙련자";
    else if (overallProgress >= 50) achievement = "📗 학습자";
    else achievement = "📕 초보자";
    
    dv.paragraph(\`**현재 등급**: \${achievement}\`);
}
\`\`\`

---

## 🔥 인기 강의 TOP 3

\`\`\`dataviewjs
const seriesPath = "${coursesFolder}";
const allPages = dv.pages('"' + seriesPath + '"');
const lectureStats = [];

for (const page of allPages) {
    const pathParts = page.file.path.split('/');
    if (pathParts.length >= 2) {
        const folderName = pathParts[1];
        if (page.file.name !== folderName && page['course-number']) {
            const tasks = page.file.tasks || [];
            const lectureTasks = tasks.filter(t => t.text.includes("학습 완료") && t.text.includes("#강의학습"));
            const total = lectureTasks.length;
            const done = lectureTasks.filter(t => t.completed).length;
            const progress = total > 0 ? Math.round((done / total) * 100) : 0;
            
            const understanding = page['understanding'] || 0;
            const recommend = page['recommend'] || 0;
            
            const popularityScore = progress * 0.3 + understanding * 30 + recommend * 20;
            
            if (popularityScore > 0) {
                lectureStats.push({
                    page: page,
                    series: folderName,
                    progress: progress,
                    understanding: understanding,
                    popularity: popularityScore
                });
            }
        }
    }
}

const topLectures = lectureStats.sort((a, b) => b.popularity - a.popularity).slice(0, 3);

if (topLectures.length === 0) {
    dv.paragraph("📊 아직 평가된 강의가 없습니다.");
    dv.paragraph("강의 완료 후 이해도, 추천도를 평가해주세요!");
} else {
    const topLectureData = topLectures.map((lecture, index) => {
        const courseNum = lecture.page['course-number'] || '?';
        const lectureName = lecture.page['lecture-name'] || lecture.page.file.name;
        const brains = '🧠'.repeat(Math.round(lecture.understanding));
        const rank = index + 1;
        const rankEmoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉';
        
        return [
            \`\${rankEmoji} \${rank}위\`,
            \`[[\${lecture.page.file.path}|\${courseNum}강 - \${lectureName}]]\`,
            lecture.series,
            \`\${lecture.progress}%\`,
            brains,
            \`\${Math.round(lecture.popularity)}점\`
        ];
    });
    
    dv.table(
        ["순위", "강의명", "시리즈", "진행률", "이해도", "인기점수"],
        topLectureData
    );
}
\`\`\`

---

## 🔄 최근 학습 강의

\`\`\`dataviewjs
const coursesFolder = "${coursesFolder}";
const recentLectures = dv.pages('"' + coursesFolder + '"')
  .where(p => p["course-number"] && p["completion-date"])
  .sort(p => p["completion-date"], 'desc')
  .limit(10);

if (recentLectures.length > 0) {
  dv.table(
    ["시리즈", "강의", "완료일", "학습시간"],
    recentLectures.map(p => {
      const pathParts = p.file.path.split('/');
      const seriesName = pathParts.length >= 2 ? pathParts[1] : '미정';
      const studyTime = p["total-minutes"] || 0;
      const hours = Math.floor(studyTime / 60);
      const minutes = studyTime % 60;
      const timeDisplay = hours > 0 ? \`\${hours}h \${minutes}m\` : \`\${minutes}m\`;
      
      return [
        seriesName,
        dv.fileLink(p.file.path, false, \`\${p['course-number']}강 - \${p['lecture-name'] || '제목 없음'}\`),
        p["completion-date"],
        timeDisplay
      ];
    })
  );
} else {
  dv.paragraph("📝 아직 완료한 강의가 없습니다.");
}
\`\`\`

---

*📊 생성일: ${todayTime} | 🔄 실시간 업데이트*
`;
  }

  // Part 4로 계속...
// ============================================
// Smart Lecture Tracker v3.0 - Part 4/4 (수정버전)
// 모달 클래스 + 설정 + 모바일 최적화
// ============================================

} // SmartLectureTrackerPlugin 클래스 종료 (Part 1에서 시작)

// ============================================
// 모달 클래스들 - 모바일 최적화
// ============================================

class QuickMenuModal extends Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl('h2', { text: '⚡ 퀵 메뉴' });

    const menuItems = [
      { icon: '📚', name: '새 시리즈 생성', action: () => { this.close(); new SeriesCreationModal(this.app, this.plugin).open(); } },
      { icon: '📊', name: '메인 대시보드', action: () => { this.close(); this.plugin.openMainDashboard(); } },
      { icon: '🔄', name: '복습 목록', action: () => { this.close(); new ReviewListModal(this.app, this.plugin).open(); } },
      { icon: '📈', name: '학습 통계', action: () => { this.close(); new StatisticsModal(this.app, this.plugin).open(); } }
    ];

    const menuContainer = contentEl.createDiv();
    menuContainer.style.cssText = 'display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-top: 20px;';

    menuItems.forEach(item => {
      const menuItem = menuContainer.createDiv();
      menuItem.style.cssText = 'background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 20px; border-radius: 12px; text-align: center; cursor: pointer; transition: all 0.2s; color: #000; box-shadow: 0 4px 15px rgba(245, 158, 11, 0.3);';
      menuItem.innerHTML = `<div style="font-size: 32px; margin-bottom: 10px;">${item.icon}</div><div style="font-weight: 600;">${item.name}</div>`;
      
      // 모바일 최적화: touchend와 click 이벤트 분리
      let touchHandled = false;
      
      menuItem.addEventListener('touchend', (e) => {
        e.preventDefault();
        e.stopPropagation();
        touchHandled = true;
        item.action();
      });
      
      menuItem.addEventListener('click', (e) => {
        if (touchHandled) {
          touchHandled = false;
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        item.action();
      });
      
      menuItem.onmouseenter = () => {
        menuItem.style.transform = 'translateY(-3px)';
        menuItem.style.boxShadow = '0 8px 25px rgba(245, 158, 11, 0.4)';
      };
      menuItem.onmouseleave = () => {
        menuItem.style.transform = 'translateY(0)';
        menuItem.style.boxShadow = '0 4px 15px rgba(245, 158, 11, 0.3)';
      };
    });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

class SeriesCreationModal extends Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
    this.seriesName = '';
    this.totalLectures = '';
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl('h2', { text: '📚 새 강의 시리즈 생성' });

    new Setting(contentEl)
      .setName('시리즈 이름')
      .setDesc('예: 수학기초, 영어회화')
      .addText(text => {
        text.setPlaceholder('시리즈 이름')
          .onChange(value => this.seriesName = value);
      });

    new Setting(contentEl)
      .setName('총 강의 수')
      .addText(text => {
        text.setPlaceholder('예: 30')
          .onChange(value => this.totalLectures = value);
        text.inputEl.type = 'number';
      });

    const buttonContainer = contentEl.createDiv();
    buttonContainer.style.cssText = 'display: flex; gap: 10px; margin-top: 30px; justify-content: flex-end;';

    const cancelBtn = buttonContainer.createEl('button', { text: '취소' });
    cancelBtn.style.cssText = 'padding: 10px 20px; background: #1e212b; color: #e5e7eb; border: none; border-radius: 6px; cursor: pointer;';
    cancelBtn.onclick = () => this.close();

    const createBtn = buttonContainer.createEl('button', { text: '🚀 생성' });
    createBtn.style.cssText = 'padding: 10px 20px; background: #f59e0b; color: #000; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;';
    createBtn.onclick = () => this.createSeries();
  }

  async createSeries() {
    if (!this.seriesName.trim()) {
      new Notice('❌ 시리즈 이름을 입력해주세요');
      return;
    }
    if (!this.totalLectures || isNaN(parseInt(this.totalLectures))) {
      new Notice('❌ 올바른 강의 수를 입력해주세요');
      return;
    }

    const success = await this.plugin.createLectureSeries(this.seriesName, parseInt(this.totalLectures));
    if (success) this.close();
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

class CreateSeriesDashboardModal extends Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
  }

  async onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl('h2', { text: '📊 시리즈 대시보드 생성' });

    const coursesFolder = this.app.vault.getAbstractFileByPath(this.plugin.settings.coursesFolder);
    if (!coursesFolder || !coursesFolder.children) {
      contentEl.createEl('p', { text: '❌ 시리즈 폴더가 없습니다.' });
      return;
    }

    const seriesList = coursesFolder.children.filter(f => f.children).map(f => f.name);
    if (seriesList.length === 0) {
      contentEl.createEl('p', { text: '❌ 생성된 시리즈가 없습니다.' });
      return;
    }

    let selectedSeries = seriesList[0];

    new Setting(contentEl)
      .setName('시리즈 선택')
      .addDropdown(dropdown => {
        seriesList.forEach(series => dropdown.addOption(series, series));
        dropdown.onChange(value => selectedSeries = value);
      });

    const buttonContainer = contentEl.createDiv();
    buttonContainer.style.cssText = 'display: flex; gap: 10px; margin-top: 30px; justify-content: flex-end;';

    const cancelBtn = buttonContainer.createEl('button', { text: '취소' });
    cancelBtn.style.cssText = 'padding: 10px 20px; background: #1e212b; color: #e5e7eb; border: none; border-radius: 6px; cursor: pointer;';
    cancelBtn.onclick = () => this.close();

    const createBtn = buttonContainer.createEl('button', { text: '📊 생성' });
    createBtn.style.cssText = 'padding: 10px 20px; background: #f59e0b; color: #000; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;';
    createBtn.onclick = async () => {
      const seriesFolder = `${this.plugin.settings.coursesFolder}/${selectedSeries}`;
      await this.plugin.createSeriesDashboard(seriesFolder, selectedSeries);
      new Notice(`✅ "${selectedSeries}" 대시보드 생성!`);
      this.close();
    };
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

class ReviewListModal extends Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: '🔄 복습할 강의' });
    this.loadReviewList();
  }

  async loadReviewList() {
    const { contentEl } = this;
    const listContainer = contentEl.createDiv();
    listContainer.style.cssText = 'max-height: 500px; overflow-y: auto; margin-top: 15px;';

    try {
      const lectureData = await this.plugin.loadLectureData();
      const today = moment();

      const reviewLectures = lectureData.filter(lecture => {
        if (!lecture['completion-date']) return false;
        const completionDate = moment(lecture['completion-date']);
        const daysSince = today.diff(completionDate, 'days');
        return this.plugin.settings.reviewIntervals.some(interval => daysSince === interval);
      });

      if (reviewLectures.length === 0) {
        listContainer.innerHTML = '<div style="text-align: center; padding: 40px; background: #1e212b; border-radius: 8px;"><div style="font-size: 48px;">🎉</div><div style="font-size: 18px; font-weight: 600; color: #fbbf24;">오늘 복습할 강의가 없습니다!</div></div>';
      } else {
        reviewLectures.forEach(lecture => {
          const item = listContainer.createDiv();
          item.style.cssText = 'background: #1e212b; padding: 15px; border-radius: 8px; margin-bottom: 10px; cursor: pointer; border-left: 4px solid #f59e0b; transition: all 0.2s;';
          const daysSince = today.diff(moment(lecture['completion-date']), 'days');
          item.innerHTML = `<div style="font-weight: 600; color: #fbbf24;">${lecture.folder} - ${lecture['course-number']}강</div><div style="color: #9ca3af; font-size: 13px;">${lecture['lecture-name'] || '제목 없음'}</div><div style="font-size: 12px; margin-top: 5px; color: #6b7280;">완료일: ${lecture['completion-date']} (${daysSince}일 전)</div>`;
          
          // 모바일 최적화
          let touchHandled = false;
          
          item.addEventListener('touchend', (e) => {
            e.preventDefault();
            e.stopPropagation();
            touchHandled = true;
            this.plugin.openFile(lecture.path);
            this.close();
          });
          
          item.addEventListener('click', (e) => {
            if (touchHandled) {
              touchHandled = false;
              return;
            }
            e.preventDefault();
            e.stopPropagation();
            this.plugin.openFile(lecture.path);
            this.close();
          });
          
          item.onmouseenter = () => {
            item.style.background = '#2a2f3a';
          };
          item.onmouseleave = () => {
            item.style.background = '#1e212b';
          };
        });
      }
    } catch (error) {
      console.error('복습 목록 오류:', error);
    }
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

class StatisticsModal extends Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: '📈 학습 통계' });
    this.loadStatistics();
  }

  async loadStatistics() {
    const { contentEl } = this;

    try {
      const lectureData = await this.plugin.loadLectureData();
      const totalLectures = lectureData.length;
      const completedLectures = lectureData.filter(l => l['completion-date'] && l['completion-date'] !== '').length;
      const totalMinutes = lectureData.reduce((sum, l) => sum + (l['total-minutes'] || 0), 0);
      const totalHours = Math.floor(totalMinutes / 60);
      const remainingMinutes = totalMinutes % 60;
      const today = moment().format('YYYY-MM-DD');
      const todayCompleted = lectureData.filter(l => l['completion-date'] === today).length;
      const weekStart = moment().startOf('week');
      const weekCompleted = lectureData.filter(l => {
        if (!l['completion-date']) return false;
        return moment(l['completion-date']).isSameOrAfter(weekStart);
      }).length;

      const statsContainer = contentEl.createDiv();
      statsContainer.style.cssText = 'display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin: 20px 0;';

      statsContainer.innerHTML = `
        <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 20px; border-radius: 12px; color: #000; box-shadow: 0 4px 15px rgba(245, 158, 11, 0.3);">
          <h3 style="margin: 0 0 10px 0;">📚 총 학습량</h3>
          <div style="font-size: 28px; font-weight: 700;">${totalLectures}강</div>
          <div style="opacity: 0.8;">완료: ${completedLectures}강</div>
        </div>
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 20px; border-radius: 12px; color: #000; box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);">
          <h3 style="margin: 0 0 10px 0;">📈 완료율</h3>
          <div style="font-size: 28px; font-weight: 700;">${Math.round((completedLectures / totalLectures) * 100) || 0}%</div>
        </div>
        <div style="background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); padding: 20px; border-radius: 12px; color: #000; box-shadow: 0 4px 15px rgba(251, 191, 36, 0.3);">
          <h3 style="margin: 0 0 10px 0;">⏰ 총 학습시간</h3>
          <div style="font-size: 28px; font-weight: 700;">${totalHours}h ${remainingMinutes}m</div>
        </div>
        <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 20px; border-radius: 12px; color: white; box-shadow: 0 4px 15px rgba(59, 130, 246, 0.3);">
          <h3 style="margin: 0 0 10px 0;">🎯 오늘 학습</h3>
          <div style="font-size: 28px; font-weight: 700;">${todayCompleted}강</div>
          <div style="opacity: 0.9;">목표: ${this.plugin.settings.dailyGoal}강</div>
        </div>
      `;

      const weeklyDiv = contentEl.createDiv();
      weeklyDiv.style.cssText = 'background: #1e212b; padding: 20px; border-radius: 8px; margin-top: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.3);';
      weeklyDiv.innerHTML = `
        <h3 style="margin: 0 0 10px 0; color: #fbbf24;">📅 이번 주 학습</h3>
        <p style="margin: 0; font-size: 24px; font-weight: bold; color: #e5e7eb;">${weekCompleted}강 / ${this.plugin.settings.weeklyGoal}강</p>
        <div style="background: #0b0f18; height: 10px; border-radius: 5px; margin-top: 10px;">
          <div style="background: linear-gradient(90deg, #10b981, #059669); height: 100%; width: ${Math.min(Math.round((weekCompleted / this.plugin.settings.weeklyGoal) * 100), 100)}%; border-radius: 5px; transition: width 0.3s ease;"></div>
        </div>
      `;
    } catch (error) {
      console.error('통계 로딩 오류:', error);
    }
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

class UpdateUnderstandingModal extends Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl('h2', { text: '🧠 이해도 입력' });

    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile) {
      contentEl.createEl('p', { text: '❌ 열린 강의 파일이 없습니다.' });
      return;
    }

    contentEl.createEl('p', { text: `현재 강의: ${activeFile.basename}`, attr: { style: 'color: #fbbf24;' } });

    let understanding = 0;

    new Setting(contentEl)
      .setName('이해도 (1-5)')
      .setDesc('클릭하여 선택: 1=매우 어려움, 5=완벽히 이해')
      .addSlider(slider => {
        slider
          .setLimits(0, 5, 1)
          .setValue(0)
          .setDynamicTooltip()
          .onChange(value => {
            understanding = value;
          });
      });

    const buttonContainer = contentEl.createDiv();
    buttonContainer.style.cssText = 'display: flex; gap: 10px; margin-top: 30px; justify-content: flex-end;';

    const cancelBtn = buttonContainer.createEl('button', { text: '취소' });
    cancelBtn.style.cssText = 'padding: 10px 20px; background: #1e212b; color: #e5e7eb; border: none; border-radius: 6px; cursor: pointer;';
    cancelBtn.onclick = () => this.close();

    const saveBtn = buttonContainer.createEl('button', { text: '💾 저장' });
    saveBtn.style.cssText = 'padding: 10px 20px; background: #f59e0b; color: #000; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;';
    saveBtn.onclick = async () => {
      await this.saveUnderstanding(activeFile, understanding);
    };
  }

  async saveUnderstanding(file, understanding) {
    try {
      const content = await this.app.vault.read(file);
      const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
      const match = content.match(frontmatterRegex);

      if (!match) {
        new Notice('❌ Frontmatter를 찾을 수 없습니다');
        return;
      }

      let frontmatter = match[1];
      const lines = frontmatter.split('\n');
      let foundUnderstanding = false;

      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('understanding:')) {
          lines[i] = `understanding: ${understanding}`;
          foundUnderstanding = true;
          break;
        }
      }

      if (!foundUnderstanding) {
        lines.push(`understanding: ${understanding}`);
      }

      const newFrontmatter = lines.join('\n');
      const newContent = content.replace(frontmatterRegex, `---\n${newFrontmatter}\n---`);

      await this.app.vault.modify(file, newContent);
      new Notice(`✅ 이해도 ${understanding}/5 저장 완료!`);
      this.close();

      setTimeout(() => {
        if (this.app.commands) {
          this.app.commands.executeCommandById('dataview:dataview-force-refresh-views');
        }
      }, 100);
    } catch (error) {
      console.error('이해도 저장 오류:', error);
      new Notice('❌ 저장 중 오류가 발생했습니다');
    }
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

class QuickCompleteLectureModal extends Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl('h2', { text: '✅ 강의 완료 처리' });

    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile) {
      contentEl.createEl('p', { text: '❌ 열린 강의 파일이 없습니다.' });
      return;
    }

    contentEl.createEl('p', { text: `현재 강의: ${activeFile.basename}`, attr: { style: 'color: #fbbf24;' } });

    const now = moment();
    let progress = 100;
    let understanding = 0;
    let hours = 0;
    let minutes = 0;
    let seconds = 0;

    new Setting(contentEl)
      .setName('진행률 (%)')
      .addSlider(slider => {
        slider
          .setLimits(0, 100, 5)
          .setValue(100)
          .setDynamicTooltip()
          .onChange(value => {
            progress = value;
          });
      });

    new Setting(contentEl)
      .setName('이해도 (1-5)')
      .addSlider(slider => {
        slider
          .setLimits(0, 5, 1)
          .setValue(0)
          .setDynamicTooltip()
          .onChange(value => {
            understanding = value;
          });
      });

    new Setting(contentEl)
      .setName('학습시간 - 시간')
      .addSlider(slider => {
        slider
          .setLimits(0, 10, 1)
          .setValue(0)
          .setDynamicTooltip()
          .onChange(value => {
            hours = value;
          });
      });

    new Setting(contentEl)
      .setName('학습시간 - 분')
      .addSlider(slider => {
        slider
          .setLimits(0, 59, 1)
          .setValue(0)
          .setDynamicTooltip()
          .onChange(value => {
            minutes = value;
          });
      });

    new Setting(contentEl)
      .setName('학습시간 - 초')
      .addSlider(slider => {
        slider
          .setLimits(0, 59, 5)
          .setValue(0)
          .setDynamicTooltip()
          .onChange(value => {
            seconds = value;
          });
      });

    const buttonContainer = contentEl.createDiv();
    buttonContainer.style.cssText = 'display: flex; gap: 10px; margin-top: 30px; justify-content: flex-end;';

    const cancelBtn = buttonContainer.createEl('button', { text: '취소' });
    cancelBtn.style.cssText = 'padding: 10px 20px; background: #1e212b; color: #e5e7eb; border: none; border-radius: 6px; cursor: pointer;';
    cancelBtn.onclick = () => this.close();

    const saveBtn = buttonContainer.createEl('button', { text: '✅ 완료 처리' });
    saveBtn.style.cssText = 'padding: 10px 20px; background: #10b981; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;';
    saveBtn.onclick = async () => {
      await this.completeLesson(activeFile, progress, understanding, hours, minutes, seconds, now);
    };
  }

  async completeLesson(file, progress, understanding, hours, minutes, seconds, now) {
    try {
      const content = await this.app.vault.read(file);
      const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
      const match = content.match(frontmatterRegex);

      if (!match) {
        new Notice('❌ Frontmatter를 찾을 수 없습니다');
        return;
      }

      let frontmatter = match[1];
      const lines = frontmatter.split('\n');
      const fieldsToUpdate = {
        'completion-date': now.format('YYYY-MM-DD'),
        'completion-time': now.format('HH:mm:ss'),
        'progress': progress,
        'understanding': understanding,
        'total-hours': hours,
        'total-minutes': minutes,
        'total-seconds': seconds
      };

      for (const [key, value] of Object.entries(fieldsToUpdate)) {
        let found = false;
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].startsWith(`${key}:`)) {
            lines[i] = `${key}: ${value}`;
            found = true;
            break;
          }
        }
        if (!found) {
          lines.push(`${key}: ${value}`);
        }
      }

      const newFrontmatter = lines.join('\n');
      const newContent = content.replace(frontmatterRegex, `---\n${newFrontmatter}\n---`);

      await this.app.vault.modify(file, newContent);
      new Notice(`✅ 강의 완료 처리 완료! (진행률: ${progress}%, 이해도: ${understanding}/5)`);
      this.close();

      setTimeout(() => {
        if (this.app.commands) {
          this.app.commands.executeCommandById('dataview:dataview-force-refresh-views');
        }
        this.plugin.updateStatusBar();
      }, 100);
    } catch (error) {
      console.error('완료 처리 오류:', error);
      new Notice('❌ 저장 중 오류가 발생했습니다');
    }
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

class LectureTrackerSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h1', { text: '⚙️ Smart Lecture Tracker 설정' });
    containerEl.createEl('h2', { text: '📁 폴더 설정' });

    new Setting(containerEl)
      .setName('강의 시리즈 폴더')
      .addText(text => text.setPlaceholder('강의시리즈').setValue(this.plugin.settings.coursesFolder)
        .onChange(async (value) => { this.plugin.settings.coursesFolder = value; await this.plugin.saveSettings(); }));

    new Setting(containerEl)
      .setName('대시보드 폴더')
      .addText(text => text.setPlaceholder('📊 대시보드').setValue(this.plugin.settings.dashboardFolder)
        .onChange(async (value) => { this.plugin.settings.dashboardFolder = value; await this.plugin.saveSettings(); }));

    containerEl.createEl('h2', { text: '🎯 학습 목표' });

    new Setting(containerEl)
      .setName('일일 학습 목표')
      .addSlider(slider => slider.setLimits(1, 10, 1).setValue(this.plugin.settings.dailyGoal).setDynamicTooltip()
        .onChange(async (value) => { this.plugin.settings.dailyGoal = value; await this.plugin.saveSettings(); this.plugin.updateStatusBar(); }));

    new Setting(containerEl)
      .setName('주간 학습 목표')
      .addSlider(slider => slider.setLimits(5, 50, 5).setValue(this.plugin.settings.weeklyGoal).setDynamicTooltip()
        .onChange(async (value) => { this.plugin.settings.weeklyGoal = value; await this.plugin.saveSettings(); }));

    containerEl.createEl('h2', { text: '🔄 복습 간격' });

    new Setting(containerEl)
      .setName('복습 간격 설정')
      .setDesc('일 단위, 쉼표로 구분')
      .addText(text => text.setPlaceholder('1, 3, 7, 14, 30').setValue(this.plugin.settings.reviewIntervals.join(', '))
        .onChange(async (value) => {
          const intervals = value.split(',').map(v => parseInt(v.trim())).filter(v => !isNaN(v));
          this.plugin.settings.reviewIntervals = intervals;
          await this.plugin.saveSettings();
        }));

    containerEl.createEl('h2', { text: '🎨 UI 설정' });

    new Setting(containerEl)
      .setName('시분초 표시')
	.setDesc('상태바에 시분초 표시')
      .addToggle(toggle => toggle.setValue(this.plugin.settings.showDateTime)
        .onChange(async (value) => {
          this.plugin.settings.showDateTime = value;
          await this.plugin.saveSettings();
          this.plugin.updateStatusBar();
        }));

    new Setting(containerEl)
      .setName('자동 새로고침')
      .setDesc('대시보드 자동 새로고침')
      .addToggle(toggle => toggle.setValue(this.plugin.settings.autoRefresh)
        .onChange(async (value) => {
          this.plugin.settings.autoRefresh = value;
          await this.plugin.saveSettings();
          if (value) {
            this.plugin.startAutoRefresh();
          } else if (this.plugin.refreshInterval) {
            clearInterval(this.plugin.refreshInterval);
          }
        }));

    new Setting(containerEl)
      .setName('새로고침 간격')
      .setDesc('초 단위')
      .addSlider(slider => slider.setLimits(60, 600, 30).setValue(this.plugin.settings.refreshInterval / 1000).setDynamicTooltip()
        .onChange(async (value) => {
          this.plugin.settings.refreshInterval = value * 1000;
          await this.plugin.saveSettings();
        }));

    containerEl.createEl('h2', { text: '💾 데이터 관리' });

    new Setting(containerEl)
      .setName('메인 대시보드 생성')
      .setDesc('슈퍼허브 대시보드를 새로 생성')
      .addButton(button => button.setButtonText('📊 생성')
        .setClass('mod-cta')
        .onClick(async () => {
          await this.plugin.createMainDashboard();
          new Notice('✅ 슈퍼허브 대시보드 생성 완료!');
        }));

    containerEl.createEl('h2', { text: 'ℹ️ 정보' });

    const infoDiv = containerEl.createDiv();
    infoDiv.style.cssText = 'background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 15px; border-radius: 8px; color: #000; box-shadow: 0 4px 15px rgba(245, 158, 11, 0.3);';
    infoDiv.innerHTML = `
      <p><strong>Smart Lecture Tracker v3.0 Enhanced</strong></p>
      <p>다크모드 최적화 + 모바일 최적화 버전</p>
      <p style="opacity: 0.8; font-size: 12px; margin-top: 10px;">
        📚 시리즈 관리 | 📊 진행률 대시보드 | 🔄 복습 시스템 | ⏰ 시분초 표시 | 📱 모바일 최적화
      </p>
    `;
  }
}

// ============================================
// 모듈 익스포트
// ============================================
module.exports = SmartLectureTrackerPlugin;

console.log(`
╔═══════════════════════════════════════════╗
║   Smart Lecture Tracker v3.0 Enhanced    ║
║   다크모드 + 모바일 최적화 버전          ║
║                                           ║
║   ✅ 완전한 오늘의 학습현황              ║
║   ✅ 시각적 학습 카드                    ║
║   ✅ 인기 강의 TOP 3                     ║
║   ✅ 최근 학습 강의                      ║
║   ✅ 실시간 시분초 표시                  ║
║   ✅ 모바일 터치 이벤트 최적화           ║
║                                           ║
║   🎨 다크모드 색상:                      ║
║   🟡 노란색 (#f59e0b, #fbbf24)          ║
║   🟢 초록색 (#10b981)                    ║
║   🔵 파란색 (#3b82f6)                    ║
║   🔴 빨간색 (#ef4444)                    ║
║                                           ║
║   📱 모바일 최적화:                      ║
║   - touchend 이벤트 분리 처리            ║
║   - preventDefault로 중복 실행 방지      ║
║   - 버튼 클릭 딜레이 최소화              ║
║                                           ║
║   🎯 주요 명령어:                        ║
║   Ctrl+P → Smart Lecture Tracker         ║
║                                           ║
║   🐛 버그 수정:                          ║
║   - 모바일 버튼 클릭 시 팅김 현상 해결  ║
║   - touch/click 이벤트 충돌 방지         ║
║   - 이벤트 버블링 차단                   ║
╚═══════════════════════════════════════════╝
`);