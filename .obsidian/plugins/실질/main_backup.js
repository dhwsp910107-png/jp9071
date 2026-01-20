const { Plugin, TFile, Notice, Modal, Setting, moment } = require('obsidian');

// 기본 설정
const DEFAULT_SETTINGS = {
  folderStructure: 'course',
  coursesFolder: 'Lectures',
  dailyGoal: 5,
  weeklyGoal: 20,
  estimatedTimePerLecture: 30,
  spacedRepetition: {
    intervals: [1, 3, 7, 14, 30],
    enabled: true
  },
  notifications: {
    dailyReminder: true,
    reviewReminder: true
  },
  dashboard: {
    autoGenerate: true,
    location: 'Dashboard/Lecture Tracker.md'
  },
  recentLecturesCount: 5,
  statisticsMaxHeight: 150
};

class SmartLectureTrackerPlugin extends Plugin {
  async onload() {
    console.log('Smart Lecture Tracker 플러그인 로드됨');
    
    await this.loadSettings();
    
    // 기본 명령어들
    this.addCommand({
      id: 'create-lecture-course',
      name: '새 강의 코스 생성',
      callback: () => {
        this.openCreateCourseModal();
      }
    });

    this.addCommand({
      id: 'create-lecture-note',
      name: '강의 노트 생성',
      callback: () => {
        this.openCreateLectureModal();
      }
    });

    this.addCommand({
      id: 'open-plan-dashboard',
      name: '학습 계획 대시보드 열기',
      callback: async () => {
        await this.openPlanDashboard();
      }
    });

    this.addCommand({
      id: 'show-today-review',
      name: '오늘 복습할 강의',
      callback: async () => await this.showTodayReview()
    });

    this.addCommand({
      id: 'create-folder',
      name: '새 폴더 생성',
      callback: () => this.openCreateFolderModal()
    });

    this.addCommand({
      id: 'delete-folder',
      name: '폴더 삭제',
      callback: () => this.openDeleteFolderModal()
    });

    this.addCommand({
      id: 'regenerate-dashboard',
      name: '대시보드 재생성',
      callback: () => this.openRegenerateDashboardModal()
    });

    // 모바일 명령어
    this.addCommand({
      id: 'open-mobile-menu',
      name: '📱 모바일 메뉴 열기',
      callback: () => this.openMobileMenu()
    });

    // 리본 아이콘 (데스크톱)
    if (!this.isMobile()) {
      this.addRibbonIcon('book-open', 'Smart Lecture Tracker', () => {
        this.openCreateCourseModal();
      });
    }

    // 모바일 전용 리본 아이콘
    if (this.isMobile()) {
      this.addRibbonIcon('menu', '📱 메뉴', () => {
        this.openMobileMenu();
      });
    }

    // 설정 탭 추가
    this.addSettingTab(new LectureTrackerSettingTab(this.app, this));

    // 파일 메뉴 이벤트 (모든 플랫폼)
    this.registerEvent(this.app.workspace.on('file-menu', (menu, file) => {
      if (file instanceof TFolder && file.path.includes(this.settings.coursesFolder)) {
        menu.addItem((item) => {
          item
            .setTitle('📊 코스 대시보드 생성')
            .setIcon('bar-chart')
            .onClick(async () => {
              const courseName = file.name;
              await this.createCourseDashboard(courseName);
            });
        });
      }
    }));

    // 모바일 최적화 CSS
    if (this.isMobile()) {
      this.addMobileStyles();
    }
    
    // 복습 알림 체크
    setTimeout(() => {
      this.checkReviewReminders();
    }, 2000);
  }

  onunload() {
    console.log('Smart Lecture Tracker 플러그인 언로드됨');
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  // === 모바일 최적화 ===
  addMobileStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .mobile-menu-modal .modal-content {
        max-width: 90vw;
        max-height: 80vh;
        padding: 20px;
      }
      
      .mobile-menu-item {
        padding: 15px !important;
        margin: 8px 0 !important;
        background: var(--background-secondary) !important;
        border-radius: 8px !important;
        cursor: pointer !important;
        display: flex !important;
        align-items: center !important;
        gap: 15px !important;
        transition: background-color 0.2s ease !important;
      }
      
      .mobile-menu-item:hover {
        background: var(--background-modifier-hover) !important;
      }
      
      .mobile-menu-item:active {
        background: var(--background-modifier-active) !important;
      }
      
      @media (max-width: 768px) {
        .modal-content {
          max-width: 95vw;
          max-height: 90vh;
          margin: 5vh auto;
        }
        
        .setting-item {
          padding: 12px 0;
        }
        
        .setting-item-control button {
          min-height: 44px;
          padding: 8px 16px;
        }
        
        .lecture-item {
          padding: 12px;
          margin: 8px 0;
        }
        
        .lecture-list {
          max-height: 60vh !important;
        }
      }
    `;
    
    document.head.appendChild(style);
  }

  // === 파일 열기 ===
  async openLectureFile(courseName, lectureNum) {
    const folderPath = `${this.settings.coursesFolder}/${courseName}`;
    const fileName = `${lectureNum}강.md`;
    const filePath = `${folderPath}/${fileName}`;
    
    const file = this.app.vault.getAbstractFileByPath(filePath);
    
    if (file instanceof TFile) {
      const leaf = this.app.workspace.getLeaf(false);
      await leaf.openFile(file);
      new Notice(`${lectureNum}강 열림`);
    } else {
      new Notice(`${lectureNum}강이 존재하지 않습니다.`);
    }
  }

  // === Modal 열기 ===
  openCreateCourseModal() {
    new CreateCourseModal(this.app, this).open();
  }

  openCreateLectureModal() {
    new CreateLectureModal(this.app, this).open();
  }

  // === 대시보드 ===
  async openPlanDashboard() {
    const dashboardPath = this.settings.dashboard.location;
    const file = this.app.vault.getAbstractFileByPath(dashboardPath);
    
    if (file instanceof TFile) {
      const leaf = this.app.workspace.getLeaf(false);
      await leaf.openFile(file);
    } else {
      new Notice('학습 계획 대시보드를 생성 중...');
      await this.createPlanDashboard();
    }
  }

  // === 강의 코스 생성 ===
  async createCourse(courseName, totalLectures) {
    const folderPath = `${this.settings.coursesFolder}/${courseName}`;
    
    try {
      await this.app.vault.createFolder(folderPath);
      
      if (this.settings.dashboard.autoGenerate) {
        await this.createCourseDashboard(courseName, totalLectures);
      }
      
      new Notice(`✅ "${courseName}" 코스 생성 완료! (총 ${totalLectures}강)`);
      
    } catch (error) {
      if (error.message.includes('already exists')) {
        new Notice(`⚠️ "${courseName}" 폴더가 이미 존재합니다`);
      } else {
        new Notice(`❌ 에러: ${error.message}`);
        console.error(error);
      }
    }
  }

  // === 강의 노트 생성 ===
  async createLectureNote(courseName, lectureNum, title = '') {
    const folderPath = `${this.settings.coursesFolder}/${courseName}`;
    const fileName = `${lectureNum}강.md`;
    const filePath = `${folderPath}/${fileName}`;
    
    const existingFile = this.app.vault.getAbstractFileByPath(filePath);
    if (existingFile) {
      new Notice(`⚠️ ${lectureNum}강이 이미 존재합니다`);
      const leaf = this.app.workspace.getLeaf(false);
      await leaf.openFile(existingFile);
      return;
    }
    
    try {
      const template = this.generateLectureTemplate(courseName, lectureNum, title);
      const file = await this.app.vault.create(filePath, template);
      
      const leaf = this.app.workspace.getLeaf(false);
      await leaf.openFile(file);
      
      new Notice(`✅ ${lectureNum}강 노트 생성 완료!`);
      
    } catch (error) {
      new Notice(`❌ 에러: ${error.message}`);
      console.error(error);
    }
  }

  // === 강의 노트 템플릿 생성 ===
  generateLectureTemplate(courseName, lectureNum, title = '') {
    const today = moment().format('YYYY-MM-DD');
    const nextReview = this.calculateNextReview(today, 0);
    const lectureTitle = title || `${lectureNum}강`;
    
    return `---
lecture-tracker: true
course: "${courseName}"
current: ${lectureNum}
title: "${lectureTitle}"
date: ${today}
repeats: []
repeatCount: 0
difficulty: 0
understanding: ""
nextReview: ${nextReview}
isWeak: false
tags:
  - lecture
  - ${courseName}
feedbackHistory: []
---

# ${lectureNum}강 - ${lectureTitle}

## 📊 학습 현황

**반복 학습**
- [ ] 1회
- [ ] 2회
- [ ] 3회
- [ ] 4회
- [ ] 5회

**난이도**: ⭐☆☆☆☆ (0/5)
> 클릭하여 수정: 1성(⭐), 2성(⭐⭐), 3성(⭐⭐⭐), 4성(⭐⭐⭐⭐), 5성(⭐⭐⭐⭐⭐)

**이해도**: 
> 선택: 😞 어려움 | 😐 보통 | 🙂 좋음 | 😊 완벽

**다음 복습**: ${nextReview}

**취약 구간**: ☐

---

## 📝 피드백 히스토리

### ${today}
> 오늘 학습 내용과 느낀 점을 자유롭게 작성하세요.



---

## 🎯 학습 내용

> 여기에 강의 내용을 수기로 작성하세요.



---

## 💡 복습 체크리스트

- [ ] 핵심 개념 이해 완료
- [ ] 공식 암기 완료
- [ ] 예제 문제 풀이 완료
- [ ] 응용 문제 풀이 완료

---

\`\`\`dataviewjs
const page = dv.current();

dv.header(3, "📊 통계");
dv.list([
  \`총 반복: \${page.repeatCount}회\`,
  \`난이도: \${page.difficulty}/5\`,
  \`이해도: \${page.understanding}\`,
  \`다음 복습: \${page.nextReview}\`,
  \`취약 구간: \${page.isWeak ? '⭐ 예' : '아니오'}\`
]);

if (page.feedbackHistory && page.feedbackHistory.length > 0) {
  dv.header(3, "📝 피드백 타임라인");
  for (let feedback of page.feedbackHistory) {
    dv.paragraph(\`**\${feedback.date}**: \${feedback.content}\`);
  }
}
\`\`\`
`;
  }

  // === 다음 복습일 계산 ===
  calculateNextReview(lastReviewDate, repeatCount, difficulty = 0, understanding = '') {
    if (!this.settings.spacedRepetition.enabled) {
      return '';
    }
    
    const intervals = this.settings.spacedRepetition.intervals;
    let intervalIndex = Math.min(repeatCount, intervals.length - 1);
    let daysToAdd = intervals[intervalIndex];
    
    // 난이도에 따른 조정
    if (difficulty >= 4) {
      daysToAdd = Math.max(1, Math.floor(daysToAdd * 0.7));
    } else if (difficulty === 3) {
      daysToAdd = Math.max(1, Math.floor(daysToAdd * 0.85));
    }
    
    // 이해도에 따른 조정
    if (understanding === '😞 어려움') {
      daysToAdd = Math.max(1, Math.floor(daysToAdd * 0.5));
    } else if (understanding === '😐 보통') {
      daysToAdd = Math.max(1, Math.floor(daysToAdd * 0.8));
    } else if (understanding === '😊 완벽') {
      daysToAdd = Math.floor(daysToAdd * 1.2);
    }
    
    const nextDate = moment(lastReviewDate).add(daysToAdd, 'days');
    return nextDate.format('YYYY-MM-DD');
  }

  // === Frontmatter 파서 ===
  parseFrontmatter(yamlText) {
    const obj = {};
    const lines = yamlText.split('\n');
    
    for (let line of lines) {
      if (!line.trim()) continue;
      
      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) continue;
      
      const key = line.substring(0, colonIndex).trim();
      let value = line.substring(colonIndex + 1).trim();
      
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }
      
      if (!isNaN(value) && value !== '') {
        value = Number(value);
      }
      
      if (value === 'true') value = true;
      if (value === 'false') value = false;
      if (value === '[]') value = [];
      
      obj[key] = value;
    }
    
    return obj;
  }

  // === Frontmatter 생성 ===
  generateFrontmatter(obj) {
    let yaml = '---\n';
    
    for (let [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        yaml += `${key}: "${value}"\n`;
      } else if (Array.isArray(value)) {
        if (value.length === 0) {
          yaml += `${key}: []\n`;
        } else if (typeof value[0] === 'object') {
          yaml += `${key}:\n`;
          for (let item of value) {
            yaml += `  - date: ${item.date}\n`;
            yaml += `    content: "${item.content}"\n`;
          }
        } else {
          yaml += `${key}: [${value.join(', ')}]\n`;
        }
      } else {
        yaml += `${key}: ${value}\n`;
      }
    }
    
    yaml += '---';
    return yaml;
  }
  
  // === 피드백 추가 ===
  async addFeedback(filePath, feedbackText) {
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (!file) return;
    
    const content = await this.app.vault.read(file);
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    
    if (!frontmatterMatch) return;
    
    const frontmatter = this.parseFrontmatter(frontmatterMatch[1]);
    
    if (!frontmatter.feedbackHistory) {
      frontmatter.feedbackHistory = [];
    }
    
    const today = moment().format('YYYY-MM-DD');
    frontmatter.feedbackHistory.push({
      date: today,
      content: feedbackText
    });
    
    const newFrontmatter = this.generateFrontmatter(frontmatter);
    const newContent = content.replace(/^---\n[\s\S]*?\n---/, newFrontmatter);
    
    await this.app.vault.modify(file, newContent);
    
    new Notice('✅ 피드백 추가 완료!');
  }

  // === 반복 학습 체크 ===
  async checkRepeat(filePath, repeatNum) {
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (!file) return;
    
    const content = await this.app.vault.read(file);
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    
    if (!frontmatterMatch) return;
    
    const frontmatter = this.parseFrontmatter(frontmatterMatch[1]);
    
    if (!frontmatter.repeats) {
      frontmatter.repeats = [];
    }
    
    if (!frontmatter.repeats.includes(repeatNum)) {
      frontmatter.repeats.push(repeatNum);
      frontmatter.repeats.sort((a, b) => a - b);
    }
    
    frontmatter.repeatCount = frontmatter.repeats.length;
    frontmatter.date = moment().format('YYYY-MM-DD');
    frontmatter.nextReview = this.calculateNextReview(
      frontmatter.date,
      frontmatter.repeatCount,
      frontmatter.difficulty,
      frontmatter.understanding
    );
    
    const newFrontmatter = this.generateFrontmatter(frontmatter);
    const newContent = content.replace(/^---\n[\s\S]*?\n---/, newFrontmatter);
    
    await this.app.vault.modify(file, newContent);
    
    new Notice(`✅ ${repeatNum}회차 체크 완료!`);
  }

  // === 강의 노트 업데이트 (범용) ===
  async updateLectureNote(filePath, updates) {
    try {
      const file = this.app.vault.getAbstractFileByPath(filePath);
      if (!file) {
        new Notice('❌ 파일을 찾을 수 없습니다');
        return;
      }
      
      const content = await this.app.vault.read(file);
      const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
      const match = content.match(frontmatterRegex);
      
      if (!match) {
        new Notice('❌ Frontmatter를 찾을 수 없습니다');
        return;
      }
      
      const frontmatter = this.parseFrontmatter(match[1]);
      
      // 업데이트 적용
      Object.assign(frontmatter, updates);
      
      // 새 Frontmatter 생성
      const newFrontmatter = this.generateFrontmatter(frontmatter);
      
      // 콘텐츠 교체
      const newContent = content.replace(frontmatterRegex, newFrontmatter);
      
      // 파일 저장
      await this.app.vault.modify(file, newContent);
      
      new Notice('✅ 업데이트 완료!');
      
    } catch (error) {
      new Notice(`❌ 에러: ${error.message}`);
      console.error(error);
    }
  }

  // === 복습 스케줄 조정 ===
  async adjustReviewSchedule(filePath) {
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (!file) return;
    
    const content = await this.app.vault.read(file);
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    
    if (!frontmatterMatch) return;
    
    const frontmatter = this.parseFrontmatter(frontmatterMatch[1]);
    
    // 다음 복습일 재계산
    if (frontmatter.date && frontmatter.repeatCount >= 0) {
      frontmatter.nextReview = this.calculateNextReview(
        frontmatter.date,
        frontmatter.repeatCount,
        frontmatter.difficulty,
        frontmatter.understanding
      );
      
      const newFrontmatter = this.generateFrontmatter(frontmatter);
      const newContent = content.replace(/^---\n[\s\S]*?\n---/, newFrontmatter);
      
      await this.app.vault.modify(file, newContent);
      
      new Notice(`✅ 복습 스케줄 조정 완료: ${frontmatter.nextReview}`);
    }
  }
  
  // === 코스 대시보드 생성 ===
  async createCourseDashboard(courseName, totalLectures) {
    const dashboardPath = `${this.settings.coursesFolder}/${courseName}/${courseName} - 대시보드.md`;
    
    try {
      const template = this.generateDashboardTemplate(courseName, totalLectures);
      await this.app.vault.create(dashboardPath, template);
      
      new Notice(`✅ ${courseName} 대시보드 생성 완료!`);
    } catch (error) {
      console.error('대시보드 생성 에러:', error);
    }
  }

  generateDashboardTemplate(courseName, totalLectures) {
    const today = moment().format('YYYY-MM-DD');
    
    return `---
dashboard: true
course: "${courseName}"
total: ${totalLectures}
created: ${today}
---

# 📚 ${courseName} - 학습 계획 대시보드

> 총 ${totalLectures}강 • 생성일: ${today}

## 🎯 학습 현황

\`\`\`dataviewjs
const coursePath = "강의시리즈/${courseName}";
const allLectures = dv.pages('"' + coursePath + '"')
  .where(p => p.file.name.includes("강") && p["lecture-tracker"]);

const completedLectures = allLectures.length;
const progressPercentage = Math.round((completedLectures / ${totalLectures}) * 100);

dv.header(3, "📊 학습 현황");
dv.paragraph("완료: " + completedLectures + " / ${totalLectures}강 (" + progressPercentage + "%)");
\`\`\`

---

*생성일: ${today}*`;
  }





// 이번 주 복습 예정
const reviewThisWeek = allLectures.filter(p => {
  if (!p.nextReview) return false;
  const reviewDate = moment(p.nextReview);
  return reviewDate.isAfter(moment()) && 
         reviewDate.isSameOrBefore(moment().add(7, 'days'));
});

// 밀린 복습
const overdue = allLectures.filter(p => {
  if (!p.nextReview) return false;
  return moment(p.nextReview).isBefore(moment(), 'day');
});

if (reviewToday.length > 0) {
  dv.header(4, "📚 오늘 복습할 강의 (" + reviewToday.length + "강)");
  dv.table(
    ["강의", "제목", "반복횟수", "마지막 학습"],
    reviewToday.map(p => [
      (p.current || '?') + "강",
      p.title || "제목 없음",
      (p.repeatCount || 0) + "회",
      p.date || "-"
    ])
  );
}

if (overdue.length > 0) {
  dv.header(4, "⚠️ 밀린 복습 (" + overdue.length + "강)");
  dv.table(
    ["강의", "제목", "예정일", "지연일수"],
    overdue.map(p => [
      (p.current || '?') + "강",
      p.title || "제목 없음", 
      p.nextReview,
      moment().diff(moment(p.nextReview), 'days') + "일"
    ])
  );
}

if (reviewThisWeek.length > 0) {
  dv.header(4, "� 이번 주 복습 예정 (" + reviewThisWeek.length + "강)");
  dv.table(
    ["강의", "제목", "예정일", "남은일수"],
    reviewThisWeek.map(p => [
      (p.current || '?') + "강",
      p.title || "제목 없음",
      p.nextReview,
      moment(p.nextReview).diff(moment(), 'days') + "일 후"
    ])
  );
}
\`\`\`

---

## �📚 최근 학습 강의

\`\`\`dataviewjs
const coursePath = "${this.settings.coursesFolder}/${courseName}";
const allLectures = dv.pages('"' + coursePath + '"')
  .where(p => p.file.name.includes("강") && p["lecture-tracker"]);

if (allLectures.length > 0) {
  const recentLectures = allLectures
    .sort((a, b) => moment(b.date || '1900-01-01').valueOf() - moment(a.date || '1900-01-01').valueOf())
    .slice(0, 10);

  dv.table(
    ["강의", "제목", "반복", "이해도", "최근학습", "피드백"],
    recentLectures.map(p => [
      (p.current || '?') + "강",
      p.title || "제목 없음",
      (p.repeatCount || 0) + "회",
      p.understanding === 'perfect' ? '😊' : 
      p.understanding === 'good' ? '🙂' :
      p.understanding === 'ok' ? '😐' :
      p.understanding === 'bad' ? '😞' : '❓',
      p.date || "-",
      (p.feedback || "피드백 없음").substring(0, 50) + "..."
    ])
  );
} else {
  dv.paragraph("아직 학습한 강의가 없습니다. 새로운 강의를 시작해보세요! 🚀");
}
\`\`\`

---

## 📊 학습 통계

\`\`\`dataviewjs
const coursePath = "${this.settings.coursesFolder}/${courseName}";
const allLectures = dv.pages('"' + coursePath + '"')
  .where(p => p.file.name.includes("강") && p["lecture-tracker"]);

if (allLectures.length > 0) {
  // 이해도별 분포
  const perfect = allLectures.where(p => p.understanding === 'perfect').length;
  const good = allLectures.where(p => p.understanding === 'good').length;
  const ok = allLectures.where(p => p.understanding === 'ok').length;
  const bad = allLectures.where(p => p.understanding === 'bad').length;
  
  dv.header(4, "📈 이해도 분포");
  dv.table(
    ["이해도", "강의 수", "비율"],
    [
      ["😊 완벽", perfect, Math.round(perfect / allLectures.length * 100) + "%"],
      ["🙂 좋음", good, Math.round(good / allLectures.length * 100) + "%"],
      ["😐 보통", ok, Math.round(ok / allLectures.length * 100) + "%"],
      ["😞 부족", bad, Math.round(bad / allLectures.length * 100) + "%"]
    ]
  );

  // 반복 학습 통계
  const once = allLectures.where(p => (p.repeatCount || 0) === 1).length;
  const twice = allLectures.where(p => (p.repeatCount || 0) === 2).length;
  const thrice = allLectures.where(p => (p.repeatCount || 0) === 3).length;
  const more = allLectures.where(p => (p.repeatCount || 0) > 3).length;

  dv.header(4, "🔄 반복 학습 현황");
  dv.table(
    ["반복 횟수", "강의 수", "비율"],
    [
      ["1회", once, Math.round(once / allLectures.length * 100) + "%"],
      ["2회", twice, Math.round(twice / allLectures.length * 100) + "%"],
      ["3회", thrice, Math.round(thrice / allLectures.length * 100) + "%"],
      ["4회 이상", more, Math.round(more / allLectures.length * 100) + "%"]
    ]
  );
}
\`\`\`

---

## 🎯 빠른 액션

> **[📝 새 강의 추가](command:smart-lecture-tracker:create-lecture-note)** | **[📚 오늘 복습](command:smart-lecture-tracker:show-today-review)** | **[⚙️ 설정](command:app:open-settings)**

---

## 💡 메타인지 학습 팁

> **효과적인 복습 전략**: 
> - 학습 후 즉시 복습보다는 시간 간격을 두고 반복
> - "이 개념을 다른 사람에게 설명할 수 있을까?" 자기 점검
> - 어려운 부분을 명확히 파악하고 집중적으로 학습

---

*📝 생성일: ${today} | 🔄 새로고침하려면 이 페이지를 다시 열어보세요*`;
  }

  // === 설정 탭 추가 ===
  addSettingTab(new SmartLectureTrackerSettingTab(this.app, this));
}

async loadSettings() {
  this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
}

async saveSettings() {
  await this.saveData(this.settings);
}
}

// === 설정 탭 클래스 ===
class SmartLectureTrackerSettingTab extends PluginSettingTab {
constructor(app, plugin) {
  super(app, plugin);
  this.plugin = plugin;
}

display() {
  const { containerEl } = this;
  containerEl.empty();

  containerEl.createEl('h2', { text: 'Smart Lecture Tracker 설정' });

  new Setting(containerEl)
    .setName('강의 폴더')
    .setDesc('강의 노트가 저장될 폴더 경로')
    .addText(text => text
      .setPlaceholder('강의시리즈')
      .setValue(this.plugin.settings.coursesFolder)
      .onChange(async (value) => {
        this.plugin.settings.coursesFolder = value;
        await this.plugin.saveSettings();
      }));

  new Setting(containerEl)
    .setName('일일 학습 목표')
    .setDesc('하루에 학습할 강의 수')
    .addText(text => text
      .setPlaceholder('3')
      .setValue(String(this.plugin.settings.dailyGoal))
      .onChange(async (value) => {
        this.plugin.settings.dailyGoal = parseInt(value) || 3;
        await this.plugin.saveSettings();
      }));
}
}

// === 강의 생성 모달 클래스 ===
class CreateLectureModal extends Modal {
constructor(app, plugin, courseName) {
  super(app);
  this.plugin = plugin;
  this.courseName = courseName;
}

onOpen() {
  const { contentEl } = this;
  contentEl.empty();
  contentEl.createEl('h2', { text: '새 강의 노트 생성' });

  const form = contentEl.createDiv();
  
  // 강의 번호 입력
  const lectureNumberContainer = form.createDiv();
  lectureNumberContainer.createEl('label', { text: '강의 번호:' });
  const lectureNumberInput = lectureNumberContainer.createEl('input', { type: 'text' });
  
  // 강의 제목 입력
  const titleContainer = form.createDiv();
  titleContainer.createEl('label', { text: '강의 제목:' });
  const titleInput = titleContainer.createEl('input', { type: 'text' });
  
  // 버튼 컨테이너
  const buttonContainer = form.createDiv();
  
  const createButton = buttonContainer.createEl('button', { text: '강의 노트 생성' });
  createButton.onclick = async () => {
    const lectureNumber = lectureNumberInput.value;
    const title = titleInput.value;
    
    if (!lectureNumber || !title) {
      new Notice('강의 번호와 제목을 모두 입력해주세요.');
      return;
    }
    
    await this.createLectureNote(lectureNumber, title);
    this.close();
  };
}

async createLectureNote(lectureNumber, title) {
  const coursesFolder = this.plugin.settings.coursesFolder;
  const folderPath = `${coursesFolder}/${this.courseName}`;
  
  // 폴더 생성
  if (!await this.app.vault.adapter.exists(folderPath)) {
    await this.app.vault.createFolder(folderPath);
  }
  
  const fileName = `${lectureNumber}강 - ${title}.md`;
  const filePath = `${folderPath}/${fileName}`;
  
  const template = this.plugin.generateLectureTemplate(this.courseName, lectureNumber, title);
  
  try {
    await this.app.vault.create(filePath, template);
    new Notice(`강의 노트가 생성되었습니다: ${fileName}`);
  } catch (error) {
    new Notice(`파일 생성 실패: ${error.message}`);
  }
}

onClose() {
  const { contentEl } = this;
  contentEl.empty();
}

// === Modal: 새 강의 코스 생성 ===
  font-size: 14px;
  color: #999;
  margin-bottom: 4px;
}

.progress-bar {
  background: #1a1a1a;
  height: 8px;
  border-radius: 4px;
  overflow: hidden;
  margin: 12px 0;
}

.progress-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.8s ease;
}

.review-schedule {
  background: #2a2a2a;
  padding: 25px;
  border-radius: 12px;
  border: 1px solid #3a3a3a;
  margin: 20px 0;
}

.review-group {
  margin-bottom: 15px;
}

.review-label {
  font-size: 14px;
  color: #999;
  margin-bottom: 10px;
  font-weight: 600;
}

.lecture-chips {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.lecture-chip {
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s ease;
}

.lecture-chip:hover {
  transform: scale(1.05);
}

.chip-urgent { background: #ef4444; color: white; }
.chip-tomorrow { background: #f59e0b; color: white; }
.chip-week { background: #667eea; color: white; }

.recent-lectures {
  background: #2a2a2a;
  padding: 25px;
  border-radius: 12px;
  border: 1px solid #3a3a3a;
}

.lecture-item {
  padding: 15px;
  margin-bottom: 10px;
  background: #1a1a1a;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.lecture-item:hover {
  background: #333;
}

.lecture-stats {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(40px, 1fr));
  gap: 8px;
  margin: 20px 0;
  max-height: 200px;
  overflow-y: auto;
}

.stat-bar {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}

.stat-bar-fill {
  width: 100%;
  border-radius: 4px 4px 0 0;
  transition: all 0.3s;
  min-height: 20px;
}

.stat-label {
  font-size: 10px;
  color: #999;
}
</style>
\`;

document.head.insertAdjacentHTML('beforeend', style);

// 데이터 수집
const coursePath = "${this.settings.coursesFolder}/${courseName}";
const allLectures = dv.pages(\`"\${coursePath}"\`)
  .where(p => p.file.name.includes("강") && p["lecture-tracker"]);

const today = moment().format('YYYY-MM-DD');
const todayLectures = allLectures.where(p => p.date === today);
const totalLectures = ${totalLectures};
const completedLectures = allLectures.length;
const progressPercentage = Math.round((completedLectures / totalLectures) * 100);

// 복습 예정 계산
const reviewToday = allLectures.filter(p => {
  if (!p.nextReview) return false;
  return moment(p.nextReview).isSame(moment(), 'day');
}).length;

const reviewTomorrow = allLectures.filter(p => {
  if (!p.nextReview) return false;
  return moment(p.nextReview).isSame(moment().add(1, 'day'), 'day');
}).length;

const reviewThisWeek = allLectures.filter(p => {
  if (!p.nextReview) return false;
  const reviewDate = moment(p.nextReview);
  return reviewDate.isAfter(moment().add(1, 'day')) && 
         reviewDate.isSameOrBefore(moment().add(7, 'days'));
}).length;

// 학습 연속일 계산
const recentDates = allLectures
  .map(p => p.date)
  .filter(d => d)
  .sort()
  .reverse();

let streakDays = 0;
let checkDate = moment();
while (recentDates.some(date => moment(date).isSame(checkDate, 'day'))) {
  streakDays++;
  checkDate = moment().subtract(streakDays, 'days');
}

// 완강 예상일 계산
const remainingLectures = totalLectures - completedLectures;
const avgDailyLectures = ${this.settings.dailyGoal} || 3;
const daysToComplete = Math.ceil(remainingLectures / avgDailyLectures);
const expectedDate = moment().add(daysToComplete, 'days').format('YYYY-MM-DD');

// 대시보드 카드 생성
const dashboardHTML = \`
<div class="dashboard-grid">
  <!-- 오늘 학습 계획 -->
  <div class="dashboard-card">
    <div class="card-header">
      <span class="card-icon">🎯</span>
      오늘 학습 계획
    </div>
    <div class="metric-value" style="color: #667eea;">\${todayLectures.length} / \${${this.settings.dailyGoal}}강</div>
    <div class="metric-label">예상 소요 시간: \${${this.settings.dailyGoal} * ${this.settings.estimatedTimePerLecture}}분</div>
    <div class="progress-bar">
      <div class="progress-fill" style="background: linear-gradient(90deg, #667eea 0%, #764ba2 100%); width: \${Math.min((todayLectures.length / ${this.settings.dailyGoal}) * 100, 100)}%"></div>
    </div>
  </div>

  <!-- 전체 진행률 -->
  <div class="dashboard-card">
    <div class="card-header">
      <span class="card-icon">📈</span>
      전체 진행률
    </div>
    <div class="metric-value" style="color: #10b981;">\${completedLectures} / \${totalLectures}강</div>
    <div class="metric-label">\${progressPercentage}% 완료</div>
    <div class="progress-bar">
      <div class="progress-fill" style="background: linear-gradient(90deg, #10b981 0%, #059669 100%); width: \${progressPercentage}%"></div>
    </div>
  </div>

  <!-- 학습 연속일 -->
  <div class="dashboard-card">
    <div class="card-header">
      <span class="card-icon">🔥</span>
      학습 연속일
    </div>
    <div class="metric-value" style="color: #f59e0b;">\${streakDays}일</div>
    <div class="metric-label">꾸준히 학습 중</div>
  </div>

  <!-- 완강 예상 -->
  <div class="dashboard-card">
    <div class="card-header">
      <span class="card-icon">⏰</span>
      완강 예상
    </div>
    <div class="metric-value" style="color: #ef4444;">D-\${daysToComplete}</div>
    <div class="metric-label">예상일: \${expectedDate}</div>
  </div>
</div>
\`;

dv.el('div', dashboardHTML);

// 복습 스케줄
const scheduleHTML = \`
<div class="review-schedule">
  <h3 style="margin: 0 0 20px 0; font-size: 18px;">📅 복습 스케줄</h3>
  
  <div class="review-group">
    <div class="review-label">오늘 복습 (\${reviewToday}강)</div>
    <div class="lecture-chips">
      \${allLectures.filter(p => p.nextReview && moment(p.nextReview).isSame(moment(), 'day'))
        .map(p => \`<div class="lecture-chip chip-urgent" onclick="app.workspace.openLinkText('\${p.file.name}', '')">\${p.current || '?'}강</div>\`)
        .slice(0, 10).join('')}
    </div>
  </div>

  <div class="review-group">
    <div class="review-label">내일 복습 (\${reviewTomorrow}강)</div>
    <div class="lecture-chips">
      \${allLectures.filter(p => p.nextReview && moment(p.nextReview).isSame(moment().add(1, 'day'), 'day'))
        .map(p => \`<div class="lecture-chip chip-tomorrow" onclick="app.workspace.openLinkText('\${p.file.name}', '')">\${p.current || '?'}강</div>\`)
        .slice(0, 10).join('')}
    </div>
  </div>

  <div class="review-group">
    <div class="review-label">이번 주 복습 (\${reviewThisWeek}강)</div>
    <div class="lecture-chips">
      \${allLectures.filter(p => {
          if (!p.nextReview) return false;
          const reviewDate = moment(p.nextReview);
          return reviewDate.isAfter(moment().add(1, 'day')) && 
                 reviewDate.isSameOrBefore(moment().add(7, 'days'));
        })
        .map(p => \`<div class="lecture-chip chip-week" onclick="app.workspace.openLinkText('\${p.file.name}', '')">\${p.current || '?'}강</div>\`)
        .slice(0, 15).join('')}
    </div>
  </div>
</div>
\`;

dv.el('div', scheduleHTML);

// 최근 학습 강의
if (allLectures.length > 0) {
  const recentHTML = \`
  <div class="recent-lectures">
    <h3 style="margin: 0 0 20px 0; font-size: 18px;">📚 최근 학습 강의</h3>
    \${allLectures.sort((a, b) => moment(b.date || '1900-01-01').valueOf() - moment(a.date || '1900-01-01').valueOf())
      .slice(0, 5)
      .map(p => \`
        <div class="lecture-item" onclick="app.workspace.openLinkText('\${p.file.name}', '')">
          <div>
            <span style="font-weight: 600; margin-right: 10px;">\${p.current || '?'}강</span>
            <span>\${p.title || '제목 없음'}</span>
          </div>
          <span style="font-size: 13px; color: #999;">\${p.date || '미수강'}</span>
        </div>
      \`).join('')}
  </div>
  \`;
  
  dv.el('div', recentHTML);
}

// 학습 통계 차트
if (allLectures.length > 0) {
  const statsHTML = \`
  <div class="recent-lectures">
    <h3 style="margin: 0 0 20px 0; font-size: 18px;">📊 강의별 반복 통계</h3>
    <div class="lecture-stats">
      \${Array.from({length: ${totalLectures}}, (_, i) => {
        const lectureNum = i + 1;
        const lecture = allLectures.find(p => (p.current || 0) === lectureNum);
        const repeats = lecture ? (lecture.repeatCount || 0) : 0;
        const maxHeight = 80;
        const height = repeats > 0 ? Math.max(20, (repeats / 10) * maxHeight) : 15;
        const color = repeats === 0 ? '#444' : repeats < 3 ? '#ef4444' : repeats < 6 ? '#f59e0b' : '#10b981';
        
        return \`
          <div class="stat-bar" onclick="app.workspace.openLinkText('\${lectureNum}강', '')" title="\${lectureNum}강: \${repeats}회 반복">
            \${repeats > 0 ? \`<div style="font-size: 10px; color: #667eea; font-weight: 600;">\${repeats}</div>\` : ''}
            <div class="stat-bar-fill" style="height: \${height}px; background: \${color};"></div>
            <div class="stat-label">\${lectureNum}</div>
          </div>
        \`;
      }).join('')}
    </div>
    <div style="margin-top: 15px; padding: 15px; background: #1a1a1a; border-radius: 8px; font-size: 13px; color: #999;">
      💡 <strong style="color: #fff;">팁:</strong> 막대 클릭으로 강의 노트 열기 | 색상: 빨강(1-2회), 주황(3-5회), 초록(6회 이상)
    </div>
  </div>
  \`;
  
  dv.el('div', statsHTML);
}
\`\`\`

---

## 🎯 빠른 액션

> **[📝 새 강의 추가](command:smart-lecture-tracker:create-lecture-note)** | **[📚 오늘 복습](command:smart-lecture-tracker:show-today-review)** | **[⚙️ 설정](command:app:open-settings)**

---

<div style="text-align: center; margin-top: 40px; padding: 20px; background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%); border-radius: 12px;">

### 💡 메타인지 학습 팁

**효과적인 복습 전략**: 학습 후 즉시 복습보다는 시간 간격을 두고 반복하는 것이 더 효과적입니다. 

**자기 점검**: "이 개념을 다른 사람에게 설명할 수 있을까?" 스스로에게 질문해보세요.

</div>`;
cssclasses: 
  - smart-dashboard
  - modern-ui
---

<div class="smart-dashboard-header">
  <h1>📚 ${courseName}</h1>
  <p>메타인지 학습 관리 시스템</p>
</div>

---

## 🎯 학습 현황 대시보드

\`\`\`dataviewjs
// === 스타일 추가 ===
const style = dv.el('style', \`
.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
  margin: 20px 0;
}

.dashboard-card {
  background: linear-gradient(135deg, #2a2a2a 0%, #1e1e1e 100%);
  border: 2px solid #3a3a3a;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  transition: all 0.3s ease;
}

.dashboard-card:hover {
  transform: translateY(-2px);
  border-color: #667eea;
  box-shadow: 0 12px 40px rgba(102, 126, 234, 0.2);
}

.card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  font-size: 18px;
  font-weight: 600;
  color: #e0e0e0;
}

.card-icon {
  font-size: 28px;
}

.metric-value {
  font-size: 42px;
  font-weight: 700;
  margin: 8px 0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  line-height: 1;
}

.metric-label {
  font-size: 14px;
  color: #999;
  margin-bottom: 4px;
}

.progress-bar {
  background: #1a1a1a;
  height: 12px;
  border-radius: 6px;
  overflow: hidden;
  margin: 12px 0;
}

.progress-fill {
  background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
  height: 100%;
  border-radius: 6px;
  transition: width 0.8s ease;
}

.lecture-table {
  width: 100%;
  border-collapse: collapse;
  background: #2a2a2a;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  margin: 20px 0;
}

.lecture-table th {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 16px;
  text-align: left;
  font-weight: 600;
  border: none;
}

.lecture-table td {
  padding: 14px 16px;
  border-bottom: 1px solid #3a3a3a;
  color: #e0e0e0;
}

.lecture-table tr:hover {
  background: rgba(102, 126, 234, 0.1);
}

.repeat-boxes {
  display: flex;
  gap: 6px;
}

.repeat-box {
  width: 24px;
  height: 24px;
  border: 2px solid #667eea;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 600;
  color: white;
}

.repeat-box.completed {
  background: #667eea;
}

.difficulty-stars {
  display: flex;
  gap: 2px;
}

.understanding-emoji {
  font-size: 24px;
}

.review-badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  color: white;
}

.review-urgent {
  background: #ef4444;
}

.review-normal {
  background: #667eea;
}

.feedback-text {
  max-width: 300px;
  font-size: 13px;
  color: #ccc;
  line-height: 1.4;
}
\`);

// === 데이터 수집 ===
const coursePath = "${this.settings.coursesFolder}/${courseName}";
const allLectures = dv.pages(\`"\${coursePath}"\`)
  .where(p => p.file.name.includes("강") && p["lecture-tracker"]);

const today = moment().format('YYYY-MM-DD');
const todayLectures = allLectures.where(p => p.date === today);
const totalLectures = ${totalLectures};
const completedLectures = allLectures.length;
const progressPercentage = Math.round((completedLectures / totalLectures) * 100);

// === 복습 예정 계산 ===
const reviewDue = allLectures.filter(p => {
  if (!p.nextReview) return false;
  const reviewDate = moment(p.nextReview);
  return reviewDate.isSameOrBefore(moment(), 'day');
}).length;

const urgentReviews = allLectures.filter(p => {
  if (!p.nextReview) return false;
  const reviewDate = moment(p.nextReview);
  return reviewDate.isBefore(moment(), 'day');
}).length;

// === 학습 연속일 계산 ===
const recentDates = allLectures
  .map(p => p.date)
  .filter(d => d)
  .sort()
  .reverse();

let streakDays = 0;
let checkDate = moment().subtract(streakDays, 'days');

while (recentDates.some(date => moment(date).isSame(checkDate, 'day'))) {
  streakDays++;
  checkDate = moment().subtract(streakDays, 'days');
}

// === 대시보드 카드들 ===
const dashboardHTML = \`
<div class="dashboard-grid">
  <div class="dashboard-card">
    <div class="card-header">
      <span class="card-icon">🎯</span>
      오늘의 학습 목표
    </div>
    <div class="metric-value">\${todayLectures.length} / \${${this.settings.dailyGoal}}강</div>
    <div class="metric-label">\${Math.round((todayLectures.length / ${this.settings.dailyGoal}) * 100)}% 달성</div>
    <div class="progress-bar">
      <div class="progress-fill" style="width: \${Math.min((todayLectures.length / ${this.settings.dailyGoal}) * 100, 100)}%"></div>
    </div>
  </div>

  <div class="dashboard-card">
    <div class="card-header">
      <span class="card-icon">📈</span>
      전체 진행률
    </div>
    <div class="metric-value">\${completedLectures} / \${totalLectures}강</div>
    <div class="metric-label">\${progressPercentage}% 완료</div>
    <div class="progress-bar">
      <div class="progress-fill" style="width: \${progressPercentage}%"></div>
    </div>
  </div>

  <div class="dashboard-card">
    <div class="card-header">
      <span class="card-icon">🔥</span>
      학습 연속일
    </div>
    <div class="metric-value">\${streakDays}일</div>
    <div class="metric-label">꾸준히 학습 중</div>
  </div>

  <div class="dashboard-card">
    <div class="card-header">
      <span class="card-icon">⏰</span>
      복습 예정
    </div>
    <div class="metric-value">\${reviewDue}강</div>
    <div class="metric-label">긴급: \${urgentReviews}강</div>
  </div>
</div>
\`;

dv.el('div', dashboardHTML);

// === 강의 리스트 테이블 ===
if (allLectures.length > 0) {
  dv.el('h3', '📚 강의 진행 현황');
  
  const tableData = allLectures
    .sort((a, b) => (a.current || 0) - (b.current || 0))
    .map(lecture => {
      const repeatCount = lecture.repeatCount || 0;
      const difficulty = lecture.difficulty || 1;
      const understanding = lecture.understanding || 'unknown';
      const nextReview = lecture.nextReview ? moment(lecture.nextReview).format('MM-DD') : '-';
      const isUrgent = lecture.nextReview && moment(lecture.nextReview).isBefore(moment(), 'day');
      
      // 반복 학습 박스
      const repeatBoxes = Array.from({length: 5}, (_, i) => 
        \`<div class="repeat-box \${i < repeatCount ? 'completed' : ''}">\${i + 1}</div>\`
      ).join('');
      
      // 난이도 별
      const difficultyStars = Array.from({length: 5}, (_, i) => 
        i < difficulty ? '⭐' : '☆'
      ).join('');
      
      // 이해도 이모지
      const understandingEmoji = {
        'perfect': '😊',
        'good': '🙂', 
        'ok': '😐',
        'bad': '😞',
        'unknown': '❓'
      }[understanding] || '❓';
      
      return [
        \`\${lecture.current || '?'}강 - \${lecture.title || '제목 없음'}\`,
        \`<div class="repeat-boxes">\${repeatBoxes}</div>\`,
        \`<div class="difficulty-stars">\${difficultyStars}</div>\`,
        \`<div class="understanding-emoji">\${understandingEmoji}</div>\`,
        lecture.date || '-',
        \`<span class="review-badge \${isUrgent ? 'review-urgent' : 'review-normal'}">\${nextReview}</span>\`,
        \`<div class="feedback-text">\${(lecture.feedback || '피드백 없음').substring(0, 100)}...</div>\`
      ];
    });

  const tableHTML = \`
  <table class="lecture-table">
    <thead>
      <tr>
        <th>강의</th>
        <th>반복 학습</th>
        <th>난이도</th>
        <th>이해도</th>
        <th>최근 학습</th>
        <th>복습 예정</th>
        <th>피드백</th>
      </tr>
    </thead>
    <tbody>
      \${tableData.map(row => \`
        <tr>
          \${row.map(cell => \`<td>\${cell}</td>\`).join('')}
        </tr>
      \`).join('')}
    </tbody>
  </table>
  \`;
  
  dv.el('div', tableHTML);
} else {
  dv.paragraph('아직 학습한 강의가 없습니다. 새로운 강의를 시작해보세요! 🚀');
}
\`\`\`

---

## 📊 학습 분석

\`\`\`dataviewjs
// === 주간 학습 통계 차트 ===
const weekDays = ['일', '월', '화', '수', '목', '금', '토'];
const today = moment();
const weekData = Array.from({length: 7}, (_, i) => {
  const date = moment().subtract(6-i, 'days');
  const dayLectures = allLectures.filter(p => 
    p.date && moment(p.date).isSame(date, 'day')
  ).length;
  
  return {
    day: weekDays[date.day()],
    count: dayLectures,
    date: date.format('MM-DD')
  };
});

const maxCount = Math.max(...weekData.map(d => d.count), 1);

const chartHTML = \`
<div style="background: #2a2a2a; padding: 30px; border-radius: 12px; border: 1px solid #3a3a3a; margin: 20px 0;">
  <h3 style="margin: 0 0 20px 0; color: #e0e0e0;">📈 주간 학습 통계</h3>
  <div style="display: flex; gap: 10px; align-items: flex-end; height: 200px; padding: 20px 0;">
    \${weekData.map(day => \`
      <div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 10px;">
        <div style="font-size: 14px; font-weight: 600; color: #e0e0e0;">\${day.count}강</div>
        <div style="
          width: 100%;
          height: \${Math.max((day.count / maxCount) * 150, 4)}px;
          background: linear-gradient(180deg, #667eea 0%, #764ba2 100%);
          border-radius: 8px 8px 0 0;
          transition: height 0.5s ease;
        "></div>
        <div style="font-size: 12px; color: #999;">
          <div>\${day.day}</div>
          <div>\${day.date}</div>
        </div>
      </div>
    \`).join('')}
  </div>
</div>
\`;

dv.el('div', chartHTML);
\`\`\`

---

## 🎯 빠른 액션

> **[📝 새 강의 추가](command:smart-lecture-tracker:create-lecture)** | **[📚 오늘 복습](command:smart-lecture-tracker:show-today-review)** | **[⚙️ 설정](command:app:open-settings)**

---

<div style="text-align: center; margin-top: 40px; padding: 20px; background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%); border-radius: 12px;">

### 💡 학습 팁

**메타인지 학습법**: 학습 후 "무엇을 배웠는지", "얼마나 이해했는지", "어떤 부분이 어려웠는지" 스스로에게 질문해보세요.

</div>`;
  );
}
\`\`\`

---

## 📅 이번 주 목표

\`\`\`dataviewjs
const startOfWeek = moment().startOf('week').format('YYYY-MM-DD');
const endOfWeek = moment().endOf('week').format('YYYY-MM-DD');

const weekLectures = dv.pages('"${this.settings.coursesFolder}/${courseName}"')
  .where(p => p["lecture-tracker"] && p.date >= startOfWeek && p.date <= endOfWeek);

const weeklyGoal = ${this.settings.weeklyGoal};
const weekCompleted = weekLectures.length;
const weekProgress = Math.round((weekCompleted / weeklyGoal) * 100);

dv.header(3, \`\${weekCompleted} / \${weeklyGoal}강 완료 (\${weekProgress}%)\`);

const barLength = 20;
const filledBars = Math.round((weekCompleted / weeklyGoal) * barLength);
const emptyBars = barLength - filledBars;
const progressBar = '█'.repeat(filledBars) + '░'.repeat(emptyBars);

dv.paragraph(\`**진행률**: \${progressBar} \${weekProgress}%\`);
dv.paragraph(\`**남은 강의**: \${weeklyGoal - weekCompleted}강\`);
\`\`\`

---

## 📝 복습 스케줄

### 오늘 복습할 강의

\`\`\`dataviewjs
const today = moment().format('YYYY-MM-DD');

const todayReview = dv.pages('"${this.settings.coursesFolder}/${courseName}"')
  .where(p => p["lecture-tracker"] && p.nextReview === today)
  .sort(p => p.repeatCount, 'desc');

if (todayReview.length > 0) {
  dv.header(4, \`📌 긴급: \${todayReview.length}강\`);
  dv.table(
    ["강의", "반복", "마지막 학습"],
    todayReview.map(p => [
      dv.fileLink(p.file.name, false, \`\${p.current}강 - \${p.title}\`),
      \`\${p.repeatCount}회\`,
      p.date
    ])
  );
} else {
  dv.paragraph("✅ 오늘 복습할 강의가 없습니다!");
}
\`\`\`

### 내일 복습할 강의

\`\`\`dataviewjs
const tomorrow = moment().add(1, 'day').format('YYYY-MM-DD');

const tomorrowReview = dv.pages('"${this.settings.coursesFolder}/${courseName}"')
  .where(p => p["lecture-tracker"] && p.nextReview === tomorrow)
  .sort(p => p.repeatCount, 'desc');

if (tomorrowReview.length > 0) {
  dv.header(4, \`⚠️ 예정: \${tomorrowReview.length}강\`);
  dv.table(
    ["강의", "반복", "마지막 학습"],
    tomorrowReview.map(p => [
      dv.fileLink(p.file.name, false, \`\${p.current}강 - \${p.title}\`),
      \`\${p.repeatCount}회\`,
      p.date
    ])
  );
} else {
  dv.paragraph("✅ 내일 복습할 강의가 없습니다!");
}
\`\`\`

---

## 📚 최근 학습 강의

\`\`\`dataviewjs
const recentLectures = dv.pages('"${this.settings.coursesFolder}/${courseName}"')
  .where(p => p["lecture-tracker"] && p.date)
  .sort(p => p.date, 'desc')
  .limit(${this.settings.recentLecturesCount});

if (recentLectures.length > 0) {
  dv.table(
    ["강의", "제목", "반복", "학습일"],
    recentLectures.map(p => [
      \`\${p.current}강\`,
      dv.fileLink(p.file.name, false, p.title),
      \`\${p.repeatCount}회\`,
      p.date
    ])
  );
} else {
  dv.paragraph("아직 학습한 강의가 없습니다. 첫 강의를 시작해보세요!");
}
\`\`\`

---

## 📊 전체 진행 현황

\`\`\`dataviewjs
const total = ${totalLectures};
const allLectures = dv.pages('"${this.settings.coursesFolder}/${courseName}"')
  .where(p => p["lecture-tracker"]);

const completed = allLectures.filter(p => p.repeatCount > 0).length;
const notStarted = total - completed;
const progress = Math.round((completed / total) * 100);

dv.header(3, "강의 진행률");
dv.paragraph(\`**완료**: \${completed}강 / \${total}강 (\${progress}%)\`);
dv.paragraph(\`**미수강**: \${notStarted}강\`);

const barLength = 30;
const filledBars = Math.round((completed / total) * barLength);
const emptyBars = barLength - filledBars;
const progressBar = '█'.repeat(filledBars) + '░'.repeat(emptyBars);

dv.paragraph(\`\${progressBar} \${progress}%\`);
\`\`\`

---

## ⭐ 취약 구간

\`\`\`dataviewjs
const weakLectures = dv.pages('"${this.settings.coursesFolder}/${courseName}"')
  .where(p => p["lecture-tracker"] && p.isWeak === true)
  .sort(p => p.repeatCount, 'desc');

if (weakLectures.length > 0) {
  dv.header(3, \`⚠️ 집중 필요: \${weakLectures.length}강\`);
  dv.table(
    ["강의", "제목", "반복", "난이도"],
    weakLectures.map(p => [
      dv.fileLink(p.file.name, false, \`\${p.current}강\`),
      p.title,
      \`\${p.repeatCount}회\`,
      '⭐'.repeat(p.difficulty || 0)
    ])
  );
} else {
  dv.paragraph("✅ 취약 구간으로 표시된 강의가 없습니다!");
}
\`\`\`

---

*마지막 업데이트: ${today}*
`;
  }

  // === 전체 대시보드 생성 ===
  async createPlanDashboard() {
    const dashboardPath = this.settings.dashboard.location;
    
    const folder = dashboardPath.substring(0, dashboardPath.lastIndexOf('/'));
    try {
      await this.app.vault.createFolder(folder);
    } catch (error) {
      // 폴더가 이미 존재하면 무시
    }
    
    try {
      const template = this.generateMainDashboardTemplate();
      const file = await this.app.vault.create(dashboardPath, template);
      
      const leaf = this.app.workspace.getLeaf(false);
      await leaf.openFile(file);
      
      new Notice('✅ 학습 계획 대시보드 생성 완료!');
    } catch (error) {
      if (error.message.includes('already exists')) {
        const file = this.app.vault.getAbstractFileByPath(dashboardPath);
        const leaf = this.app.workspace.getLeaf(false);
        await leaf.openFile(file);
      } else {
        new Notice(`❌ 에러: ${error.message}`);
        console.error(error);
      }
    }
  }

  // === 메인 대시보드 템플릿 ===
  generateMainDashboardTemplate() {
    const today = moment().format('YYYY-MM-DD');
    
    return `---
dashboard: main
created: ${today}
---

# 📚 Smart Lecture Tracker - 학습 계획 대시보드

> 마지막 업데이트: ${today}

---

## 🎯 전체 코스 목록

\`\`\`dataviewjs
const coursesFolder = "${this.settings.coursesFolder}";
const courses = dv.pages()
  .where(p => p.file.path.startsWith(coursesFolder) && p["lecture-tracker"])
  .groupBy(p => p.course);

if (courses.length > 0) {
  for (let group of courses) {
    const courseName = group.key;
    const lectures = group.rows;
    const completed = lectures.filter(p => p.repeatCount > 0).length;
    
    dv.header(3, \`📖 \${courseName}\`);
    dv.paragraph(\`진행: \${completed}강 완료\`);
  }
} else {
  dv.paragraph("아직 생성된 코스가 없습니다. 새 코스를 만들어보세요!");
}
\`\`\`

---

## 📅 오늘 학습 현황

\`\`\`dataviewjs
const today = "${today}";

const todayLectures = dv.pages('"${this.settings.coursesFolder}"')
  .where(p => p["lecture-tracker"] && p.date === today);

const dailyGoal = ${this.settings.dailyGoal};
const completed = todayLectures.length;
const progress = Math.round((completed / dailyGoal) * 100);

dv.header(3, \`\${completed} / \${dailyGoal}강 완료 (\${progress}%)\`);

if (todayLectures.length > 0) {
  dv.table(
    ["코스", "강의", "반복"],
    todayLectures.map(p => [
      p.course,
      dv.fileLink(p.file.name, false, \`\${p.current}강 - \${p.title}\`),
      \`\${p.repeatCount}회\`
    ])
  );
}
\`\`\`

---

*Powered by Smart Lecture Tracker*
`;
  }
  
  // === 오늘 복습할 강의 찾기 ===
  async showTodayReview() {
    const today = moment().format('YYYY-MM-DD');
    const coursesFolder = this.settings.coursesFolder;
    
    const files = this.app.vault.getMarkdownFiles();
    const todayReview = [];
    
    for (let file of files) {
      if (!file.path.startsWith(coursesFolder)) continue;
      
      const cache = this.app.metadataCache.getFileCache(file);
      if (!cache || !cache.frontmatter) continue;
      
      const fm = cache.frontmatter;
      if (fm['lecture-tracker'] && fm.nextReview === today) {
        todayReview.push({
          file: file,
          course: fm.course,
          current: fm.current,
          title: fm.title,
          repeatCount: fm.repeatCount || 0
        });
      }
    }
    
    if (todayReview.length === 0) {
      new Notice('✅ 오늘 복습할 강의가 없습니다!');
      return;
    }
    
    todayReview.sort((a, b) => b.repeatCount - a.repeatCount);
    
    new TodayReviewModal(this.app, this, todayReview).open();
  }

  // === 복습 완료 처리 ===
  async markReviewComplete(filePath) {
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (!file) return;
    
    const content = await this.app.vault.read(file);
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    
    if (!frontmatterMatch) return;
    
    const frontmatter = this.parseFrontmatter(frontmatterMatch[1]);
    
    if (!frontmatter.repeats) {
      frontmatter.repeats = [];
    }
    const nextRepeatNum = frontmatter.repeats.length + 1;
    frontmatter.repeats.push(nextRepeatNum);
    frontmatter.repeatCount = frontmatter.repeats.length;
    
    frontmatter.date = moment().format('YYYY-MM-DD');
    
    frontmatter.nextReview = this.calculateNextReview(
      frontmatter.date,
      frontmatter.repeatCount,
      frontmatter.difficulty,
      frontmatter.understanding
    );
    
    const newFrontmatter = this.generateFrontmatter(frontmatter);
    const newContent = content.replace(/^---\n[\s\S]*?\n---/, newFrontmatter);
    
    await this.app.vault.modify(file, newContent);
    
    new Notice(`✅ 복습 완료! 다음 복습: ${frontmatter.nextReview}`);
  }

  // === 복습 알림 체크 ===
  async checkReviewReminders() {
    if (!this.settings.notifications.reviewReminder) {
      return;
    }
    
    const todayReview = await this.getTodayReviewCount();
    const overdue = await this.getOverdueLectures();
    
    if (overdue.length > 0) {
      new Notice(`⚠️ 지연된 복습 강의: ${overdue.length}개`, 5000);
    } else if (todayReview > 0) {
      new Notice(`📚 오늘 복습할 강의: ${todayReview}개`, 3000);
    }
  }

  // === 오늘 복습 강의 수 가져오기 ===
  async getTodayReviewCount() {
    const today = moment().format('YYYY-MM-DD');
    const coursesFolder = this.settings.coursesFolder;
    
    const files = this.app.vault.getMarkdownFiles();
    let count = 0;
    
    for (let file of files) {
      if (!file.path.startsWith(coursesFolder)) continue;
      
      const cache = this.app.metadataCache.getFileCache(file);
      if (!cache || !cache.frontmatter) continue;
      
      const fm = cache.frontmatter;
      if (fm['lecture-tracker'] && fm.nextReview === today) {
        count++;
      }
    }
    
    return count;
  }

  // === 지연된 복습 강의 찾기 ===
  async getOverdueLectures() {
    const today = moment().format('YYYY-MM-DD');
    const coursesFolder = this.settings.coursesFolder;
    
    const files = this.app.vault.getMarkdownFiles();
    const overdue = [];
    
    for (let file of files) {
      if (!file.path.startsWith(coursesFolder)) continue;
      
      const cache = this.app.metadataCache.getFileCache(file);
      if (!cache || !cache.frontmatter) continue;
      
      const fm = cache.frontmatter;
      if (!fm['lecture-tracker'] || !fm.nextReview) continue;
      
      if (fm.nextReview < today) {
        const daysOverdue = moment(today).diff(moment(fm.nextReview), 'days');
        
        overdue.push({
          file: file,
          course: fm.course,
          current: fm.current,
          title: fm.title,
          nextReview: fm.nextReview,
          daysOverdue: daysOverdue,
          repeatCount: fm.repeatCount || 0
        });
      }
    }
    
    overdue.sort((a, b) => b.daysOverdue - a.daysOverdue);
    
    return overdue;
  }

  // === 복습 우선순위 계산 ===
  calculateReviewPriority(lecture) {
    const today = moment();
    const nextReview = moment(lecture.nextReview);
    const daysOverdue = today.diff(nextReview, 'days');
    
    let priority = 0;
    
    // 지연일수
    if (daysOverdue > 0) {
      priority += daysOverdue * 50;
    }
    
    // 난이도
    if (lecture.difficulty) {
      priority += lecture.difficulty * 10;
    }
    
    // 이해도
    if (lecture.understanding === '😞 어려움') {
      priority += 30;
    } else if (lecture.understanding === '😐 보통') {
      priority += 15;
    }
    
    // 취약 구간
    if (lecture.isWeak) {
      priority += 25;
    }
    
    return priority;
  }

  // === 이번 주 복습 계획 생성 ===
  async getWeeklyReviewPlan() {
    const startOfWeek = moment().startOf('week');
    const endOfWeek = moment().endOf('week');
    const coursesFolder = this.settings.coursesFolder;
    
    const files = this.app.vault.getMarkdownFiles();
    const weeklyReview = {
      today: [],
      tomorrow: [],
      thisWeek: []
    };
    
    const today = moment().format('YYYY-MM-DD');
    const tomorrow = moment().add(1, 'day').format('YYYY-MM-DD');
    
    for (let file of files) {
      if (!file.path.startsWith(coursesFolder)) continue;
      
      const cache = this.app.metadataCache.getFileCache(file);
      if (!cache || !cache.frontmatter) continue;
      
      const fm = cache.frontmatter;
      if (!fm['lecture-tracker'] || !fm.nextReview) continue;
      
      const reviewDate = moment(fm.nextReview);
      
      if (reviewDate.isBetween(startOfWeek, endOfWeek, null, '[]')) {
        const lectureData = {
          file: file,
          course: fm.course,
          current: fm.current,
          title: fm.title,
          nextReview: fm.nextReview,
          repeatCount: fm.repeatCount || 0,
          difficulty: fm.difficulty || 0,
          understanding: fm.understanding || '',
          isWeak: fm.isWeak || false
        };
        
        lectureData.priority = this.calculateReviewPriority(lectureData);
        
        if (fm.nextReview === today) {
          weeklyReview.today.push(lectureData);
        } else if (fm.nextReview === tomorrow) {
          weeklyReview.tomorrow.push(lectureData);
        } else {
          weeklyReview.thisWeek.push(lectureData);
        }
      }
    }
    
    weeklyReview.today.sort((a, b) => b.priority - a.priority);
    weeklyReview.tomorrow.sort((a, b) => b.priority - a.priority);
    weeklyReview.thisWeek.sort((a, b) => a.nextReview.localeCompare(b.nextReview));
    
    return weeklyReview;
  }

  // === 복습 통계 ===
  async getReviewStatistics() {
    const coursesFolder = this.settings.coursesFolder;
    const files = this.app.vault.getMarkdownFiles();
    
    const stats = {
      totalLectures: 0,
      reviewed: 0,
      avgReviewInterval: 0,
      upcomingWeek: 0,
      overdue: 0
    };
    
    const intervals = [];
    const today = moment();
    const oneWeekLater = moment().add(7, 'days');
    
    for (let file of files) {
      if (!file.path.startsWith(coursesFolder)) continue;
      
      const cache = this.app.metadataCache.getFileCache(file);
      if (!cache || !cache.frontmatter) continue;
      
      const fm = cache.frontmatter;
      if (!fm['lecture-tracker']) continue;
      
      stats.totalLectures++;
      
      if (fm.repeatCount > 0) {
        stats.reviewed++;
      }
      
      if (fm.nextReview) {
        const reviewDate = moment(fm.nextReview);
        
        if (fm.date) {
          const interval = reviewDate.diff(moment(fm.date), 'days');
          intervals.push(interval);
        }
        
        if (reviewDate.isBetween(today, oneWeekLater, null, '[]')) {
          stats.upcomingWeek++;
        }
        
        if (reviewDate.isBefore(today)) {
          stats.overdue++;
        }
      }
    }
    
    if (intervals.length > 0) {
      stats.avgReviewInterval = Math.round(
        intervals.reduce((a, b) => a + b, 0) / intervals.length
      );
    }
    
    return stats;
  }

  // ========================================
  // Part 8: 모바일 최적화 & 고급 설정
  // ========================================

  // === Modal 열기 메서드들 ===
  openCreateFolderModal() {
    new CreateFolderModal(this.app, this).open();
  }

  openDeleteFolderModal() {
    new DeleteFolderModal(this.app, this).open();
  }

  openRegenerateDashboardModal() {
    new RegenerateDashboardModal(this.app, this).open();
  }

  openMobileMenu() {
    new MobileMenuModal(this.app, this).open();
  }

  async confirmDelete(itemName, callback) {
    new ConfirmDeleteModal(this.app, itemName, callback).open();
  }

  // === 폴더 관리 ===
  async createFolder(folderPath) {
    try {
      await this.app.vault.createFolder(folderPath);
      new Notice(`✅ 폴더 생성: ${folderPath}`);
      return true;
    } catch (error) {
      if (error.message.includes('already exists')) {
        new Notice(`⚠️ 폴더가 이미 존재합니다: ${folderPath}`);
      } else {
        new Notice(`❌ 폴더 생성 실패: ${error.message}`);
        console.error(error);
      }
      return false;
    }
  }

  async deleteFolder(folderPath) {
    try {
      const folder = this.app.vault.getAbstractFileByPath(folderPath);
      
      if (!folder) {
        new Notice(`⚠️ 폴더를 찾을 수 없습니다: ${folderPath}`);
        return false;
      }
      
      const confirmed = await this.confirmDelete(folderPath);
      if (!confirmed) {
        return false;
      }
      
      await this.app.vault.delete(folder, true);
      new Notice(`✅ 폴더 삭제 완료: ${folderPath}`);
      return true;
    } catch (error) {
      new Notice(`❌ 폴더 삭제 실패: ${error.message}`);
      console.error(error);
      return false;
    }
  }

  async getCourseFolders() {
    const coursesFolder = this.settings.coursesFolder;
    const folders = [];
    
    try {
      const abstractFolder = this.app.vault.getAbstractFileByPath(coursesFolder);
      
      if (!abstractFolder || !abstractFolder.children) {
        return folders;
      }
      
      for (let child of abstractFolder.children) {
        if (child.children) {
          folders.push({
            name: child.name,
            path: child.path
          });
        }
      }
    } catch (error) {
      console.error('코스 폴더 가져오기 실패:', error);
    }
    
    return folders;
  }

  async confirmDelete(itemName) {
    return new Promise((resolve) => {
      new ConfirmDeleteModal(this.app, itemName, (confirmed) => {
        resolve(confirmed);
      }).open();
    });
  }

  // === 대시보드 관리 ===
  async deleteDashboard(courseName) {
    const dashboardPath = `${this.settings.coursesFolder}/${courseName}/${courseName} - 대시보드.md`;
    
    try {
      const file = this.app.vault.getAbstractFileByPath(dashboardPath);
      
      if (!file) {
        new Notice(`⚠️ 대시보드를 찾을 수 없습니다`);
        return false;
      }
      
      const confirmed = await this.confirmDelete(`${courseName} 대시보드`);
      if (!confirmed) {
        return false;
      }
      
      await this.app.vault.delete(file);
      new Notice(`✅ 대시보드 삭제 완료`);
      return true;
    } catch (error) {
      new Notice(`❌ 대시보드 삭제 실패: ${error.message}`);
      console.error(error);
      return false;
    }
  }

  async regenerateDashboard(courseName) {
    try {
      const dashboardPath = `${this.settings.coursesFolder}/${courseName}/${courseName} - 대시보드.md`;
      const existingFile = this.app.vault.getAbstractFileByPath(dashboardPath);
      
      if (existingFile) {
        await this.app.vault.delete(existingFile);
      }
      
      const files = this.app.vault.getMarkdownFiles();
      const lectureFiles = files.filter(f => 
        f.path.startsWith(`${this.settings.coursesFolder}/${courseName}/`) &&
        f.basename.match(/^\d+강$/)
      );
      
      const totalLectures = lectureFiles.length || 40;
      
      await this.createCourseDashboard(courseName, totalLectures);
      
      new Notice(`✅ ${courseName} 대시보드 재생성 완료`);
      return true;
    } catch (error) {
      new Notice(`❌ 대시보드 재생성 실패: ${error.message}`);
      console.error(error);
      return false;
    }
  }

  // === 모바일 감지 ===
  isMobile() {
    return this.app.isMobile || window.innerWidth < 768;
  }

  openMobileMenu() {
    new MobileMenuModal(this.app, this).open();
  }
}

// === 설정 탭 ===
class LectureTrackerSettingTab {
  constructor(app, plugin) {
    this.app = app;
    this.plugin = plugin;
    this.containerEl = null;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    
    containerEl.createEl('h2', { text: 'Smart Lecture Tracker 설정' });
    
    // === 기본 설정 ===
    containerEl.createEl('h3', { text: '📁 기본 설정' });
    
    new Setting(containerEl)
      .setName('강의 폴더')
      .setDesc('강의 파일이 저장될 폴더')
      .addText(text => text
        .setPlaceholder('Lectures')
        .setValue(this.plugin.settings.coursesFolder)
        .onChange(async (value) => {
          this.plugin.settings.coursesFolder = value;
          await this.plugin.saveSettings();
        }));
    
    new Setting(containerEl)
      .setName('폴더 구조')
      .setDesc('강의 파일 정리 방식')
      .addDropdown(dropdown => dropdown
        .addOption('course', '코스별 (추천)')
        .addOption('date', '날짜별')
        .setValue(this.plugin.settings.folderStructure)
        .onChange(async (value) => {
          this.plugin.settings.folderStructure = value;
          await this.plugin.saveSettings();
        }));
    
    // === 학습 목표 ===
    containerEl.createEl('h3', { text: '🎯 학습 목표' });
    
    new Setting(containerEl)
      .setName('일일 목표')
      .setDesc('하루에 학습할 강의 수')
      .addText(text => text
        .setPlaceholder('5')
        .setValue(String(this.plugin.settings.dailyGoal))
        .onChange(async (value) => {
          this.plugin.settings.dailyGoal = parseInt(value) || 5;
          await this.plugin.saveSettings();
        }));
    
    new Setting(containerEl)
      .setName('주간 목표')
      .setDesc('일주일에 학습할 강의 수')
      .addText(text => text
        .setPlaceholder('20')
        .setValue(String(this.plugin.settings.weeklyGoal))
        .onChange(async (value) => {
          this.plugin.settings.weeklyGoal = parseInt(value) || 20;
          await this.plugin.saveSettings();
        }));
    
    new Setting(containerEl)
      .setName('강의당 예상 시간')
      .setDesc('한 강의당 소요되는 시간 (분)')
      .addText(text => text
        .setPlaceholder('30')
        .setValue(String(this.plugin.settings.estimatedTimePerLecture))
        .onChange(async (value) => {
          this.plugin.settings.estimatedTimePerLecture = parseInt(value) || 30;
          await this.plugin.saveSettings();
        }));
    
    // === 간격 반복 학습 ===
    containerEl.createEl('h3', { text: '🔄 간격 반복 학습' });
    
    new Setting(containerEl)
      .setName('간격 반복 활성화')
      .setDesc('에빙하우스 망각곡선 기반 자동 복습일 계산')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.spacedRepetition.enabled)
        .onChange(async (value) => {
          this.plugin.settings.spacedRepetition.enabled = value;
          await this.plugin.saveSettings();
        }));
    
    new Setting(containerEl)
      .setName('복습 간격 (일)')
      .setDesc('쉼표로 구분된 복습 간격 (예: 1,3,7,14,30)')
      .addText(text => text
        .setPlaceholder('1,3,7,14,30')
        .setValue(this.plugin.settings.spacedRepetition.intervals.join(','))
        .onChange(async (value) => {
          const intervals = value.split(',').map(v => parseInt(v.trim())).filter(v => !isNaN(v));
          this.plugin.settings.spacedRepetition.intervals = intervals;
          await this.plugin.saveSettings();
        }));
    
    // === 알림 ===
    containerEl.createEl('h3', { text: '🔔 알림' });
    
    new Setting(containerEl)
      .setName('일일 리마인더')
      .setDesc('매일 학습 목표 알림')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.notifications.dailyReminder)
        .onChange(async (value) => {
          this.plugin.settings.notifications.dailyReminder = value;
          await this.plugin.saveSettings();
        }));
    
    new Setting(containerEl)
      .setName('복습 리마인더')
      .setDesc('복습할 강의가 있을 때 알림')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.notifications.reviewReminder)
        .onChange(async (value) => {
          this.plugin.settings.notifications.reviewReminder = value;
          await this.plugin.saveSettings();
        }));
    
    // === 대시보드 ===
    containerEl.createEl('h3', { text: '📊 대시보드' });
    
    new Setting(containerEl)
      .setName('자동 생성')
      .setDesc('코스 생성 시 대시보드 자동 생성')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.dashboard.autoGenerate)
        .onChange(async (value) => {
          this.plugin.settings.dashboard.autoGenerate = value;
          await this.plugin.saveSettings();
        }));
    
    new Setting(containerEl)
      .setName('대시보드 위치')
      .setDesc('메인 대시보드 파일 위치')
      .addText(text => text
        .setPlaceholder('Dashboard/Lecture Tracker.md')
        .setValue(this.plugin.settings.dashboard.location)
        .onChange(async (value) => {
          this.plugin.settings.dashboard.location = value;
          await this.plugin.saveSettings();
        }));
    
    // === 폴더 관리 ===
    containerEl.createEl('h3', { text: '📁 폴더 관리' });
    
    new Setting(containerEl)
      .setName('새 폴더 생성')
      .setDesc('강의 코스 폴더 생성')
      .addButton(button => button
        .setButtonText('생성')
        .setCta()
        .onClick(() => {
          new CreateFolderModal(this.app, this.plugin).open();
        }));
    
    new Setting(containerEl)
      .setName('폴더 삭제')
      .setDesc('기존 코스 폴더 삭제')
      .addButton(button => button
        .setButtonText('삭제')
        .setWarning()
        .onClick(async () => {
          new DeleteFolderModal(this.app, this.plugin).open();
        }));
    
    // === 대시보드 관리 ===
    containerEl.createEl('h3', { text: '📊 대시보드 관리' });
    
    new Setting(containerEl)
      .setName('메인 대시보드 생성')
      .setDesc('전체 학습 계획 대시보드 생성')
      .addButton(button => button
        .setButtonText('생성')
        .setCta()
        .onClick(async () => {
          await this.plugin.createPlanDashboard();
        }));
    
    new Setting(containerEl)
      .setName('대시보드 재생성')
      .setDesc('코스별 대시보드 재생성')
      .addButton(button => button
        .setButtonText('재생성')
        .onClick(async () => {
          new RegenerateDashboardModal(this.app, this.plugin).open();
        }));
    
    // === 데이터 관리 ===
    containerEl.createEl('h3', { text: '💾 데이터 관리' });
    
    new Setting(containerEl)
      .setName('통계 초기화')
      .setDesc('⚠️ 모든 학습 기록을 초기화합니다 (되돌릴 수 없음)')
      .addButton(button => button
        .setButtonText('초기화')
        .setWarning()
        .onClick(async () => {
          const confirmed = await this.plugin.confirmDelete('모든 학습 기록');
          if (confirmed) {
            new Notice('⚠️ 통계 초기화 기능은 수동으로 파일을 삭제해주세요');
          }
        }));
    
    // === UI ===
    containerEl.createEl('h3', { text: '🎨 UI 설정' });
    
    new Setting(containerEl)
      .setName('최근 강의 표시 개수')
      .setDesc('대시보드에 표시할 최근 강의 수')
      .addText(text => text
        .setPlaceholder('5')
        .setValue(String(this.plugin.settings.recentLecturesCount))
        .onChange(async (value) => {
          this.plugin.settings.recentLecturesCount = parseInt(value) || 5;
          await this.plugin.saveSettings();
        }));
    
    new Setting(containerEl)
      .setName('통계 그래프 최대 높이')
      .setDesc('통계 막대 그래프 최대 높이 (px)')
      .addText(text => text
        .setPlaceholder('150')
        .setValue(String(this.plugin.settings.statisticsMaxHeight))
        .onChange(async (value) => {
          this.plugin.settings.statisticsMaxHeight = parseInt(value) || 150;
          await this.plugin.saveSettings();
        }));
    
    // === 정보 ===
    containerEl.createEl('h3', { text: 'ℹ️ 정보' });
    
    const infoEl = containerEl.createEl('div', { 
      cls: 'tracker-settings-info',
      attr: { style: 'padding: 15px; background: var(--background-secondary); border-radius: 8px; margin: 10px 0;' }
    });
    
    infoEl.createEl('p', { 
      text: '📚 Smart Lecture Tracker v1.0.0',
      attr: { style: 'font-weight: 600; margin-bottom: 8px;' }
    });
    
    infoEl.createEl('p', { 
      text: '메타인지 기반 강의 학습 관리 시스템',
      attr: { style: 'color: var(--text-muted); font-size: 0.9em; margin-bottom: 8px;' }
    });
    
    const linksEl = infoEl.createEl('div', { 
      attr: { style: 'display: flex; gap: 10px; font-size: 0.9em;' }
    });
    
    linksEl.createEl('a', { 
      text: '📖 문서',
      href: '#',
      attr: { style: 'color: var(--interactive-accent);' }
    });
    
    linksEl.createEl('a', { 
      text: '🐛 버그 리포트',
      href: '#',
      attr: { style: 'color: var(--interactive-accent);' }
    });
    
    linksEl.createEl('a', { 
      text: '⭐ GitHub',
      href: '#',
      attr: { style: 'color: var(--interactive-accent);' }
    });
  }
}

// === Modal: 새 강의 코스 생성 ===
class CreateCourseModal extends Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    
    contentEl.createEl('h2', { text: '새 강의 코스 생성' });
    
    new Setting(contentEl)
      .setName('강의명')
      .setDesc('예: 회로이론')
      .addText(text => {
        this.courseName = text;
        text.setPlaceholder('강의명 입력')
          .onChange(value => {
            this.courseNameValue = value;
          });
      });
    
    new Setting(contentEl)
      .setName('총 강의 수')
      .setDesc('예: 40')
      .addText(text => {
        this.totalLectures = text;
        text.setPlaceholder('숫자만 입력')
          .onChange(value => {
            this.totalLecturesValue = parseInt(value) || 0;
          });
      });
    
    new Setting(contentEl)
      .addButton(btn => btn
        .setButtonText('생성')
        .setCta()
        .onClick(async () => {
          if (!this.courseNameValue || !this.totalLecturesValue) {
            new Notice('⚠️ 모든 필드를 입력해주세요');
            return;
          }
          
          await this.plugin.createCourse(
            this.courseNameValue,
            this.totalLecturesValue
          );
          
          this.close();
        }))
      .addButton(btn => btn
        .setButtonText('취소')
        .onClick(() => {
          this.close();
        }));
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

// === Modal: 강의 노트 생성 ===
class CreateLectureModal extends Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    
    contentEl.createEl('h2', { text: '강의 노트 생성' });
    
    new Setting(contentEl)
      .setName('강의 코스')
      .setDesc('기존 코스 선택')
      .addText(text => {
        text.setPlaceholder('회로이론')
          .onChange(value => {
            this.courseName = value;
          });
      });
    
    new Setting(contentEl)
      .setName('강의 번호')
      .setDesc('예: 1')
      .addText(text => {
        text.setPlaceholder('숫자만 입력')
          .onChange(value => {
            this.lectureNum = parseInt(value) || 0;
          });
      });
    
    new Setting(contentEl)
      .setName('강의 제목 (선택)')
      .setDesc('예: 전기이론 기초')
      .addText(text => {
        text.setPlaceholder('제목 입력')
          .onChange(value => {
            this.lectureTitle = value;
          });
      });
    
    new Setting(contentEl)
      .addButton(btn => btn
        .setButtonText('생성')
        .setCta()
        .onClick(async () => {
          if (!this.courseName || !this.lectureNum) {
            new Notice('⚠️ 필수 필드를 입력해주세요');
            return;
          }
          
          await this.plugin.createLectureNote(
            this.courseName,
            this.lectureNum,
            this.lectureTitle || ''
          );
          
          this.close();
        }))
      .addButton(btn => btn
        .setButtonText('취소')
        .onClick(() => {
          this.close();
        }));
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

// ========================================
// Modal: 오늘 복습할 강의
// ========================================

class TodayReviewModal extends Modal {
  constructor(app, plugin, lectures) {
    super(app);
    this.plugin = plugin;
    this.lectures = lectures;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    
    contentEl.createEl('h2', { text: `📚 오늘 복습할 강의 (${this.lectures.length}개)` });
    
    // 긴급도 표시
    const urgent = this.lectures.filter(l => l.repeatCount >= 3).length;
    if (urgent > 0) {
      contentEl.createEl('p', { 
        text: `⚠️ 긴급 복습 필요: ${urgent}개`,
        cls: 'mod-warning'
      });
    }
    
    // 강의 목록
    const listEl = contentEl.createEl('div', { cls: 'lecture-list' });
    
    for (let lecture of this.lectures) {
      const itemEl = listEl.createEl('div', { 
        cls: 'lecture-item',
        attr: { style: 'padding: 10px; margin: 5px 0; border: 1px solid #3a3a3a; border-radius: 8px; cursor: pointer;' }
      });
      
      itemEl.addEventListener('click', async () => {
        const leaf = this.app.workspace.getLeaf(false);
        await leaf.openFile(lecture.file);
        this.close();
      });
      
      // 강의 정보
      itemEl.createEl('div', { 
        text: `${lecture.course} - ${lecture.current}강: ${lecture.title}`,
        attr: { style: 'font-weight: 600; margin-bottom: 5px;' }
      });
      
      itemEl.createEl('div', { 
        text: `반복: ${lecture.repeatCount}회`,
        attr: { style: 'font-size: 12px; color: #999;' }
      });
      
      // 복습 완료 버튼
      const btnContainer = itemEl.createEl('div', { 
        attr: { style: 'margin-top: 10px;' }
      });
      
      const completeBtn = btnContainer.createEl('button', { 
        text: '복습 완료',
        cls: 'mod-cta'
      });
      
      completeBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await this.plugin.markReviewComplete(lecture.file.path);
        
        itemEl.remove();
        
        if (listEl.children.length === 0) {
          new Notice('🎉 오늘 복습 모두 완료!');
          this.close();
        }
      });
    }
    
    // 닫기 버튼
    const btnEl = contentEl.createEl('div', { 
      attr: { style: 'margin-top: 20px; text-align: right;' }
    });
    
    const closeBtn = btnEl.createEl('button', { text: '닫기' });
    closeBtn.addEventListener('click', () => this.close());
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

// ========================================
// Modal: 폴더 생성
// ========================================

class CreateFolderModal extends Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    
    contentEl.createEl('h2', { text: '새 폴더 생성' });
    
    new Setting(contentEl)
      .setName('폴더 이름')
      .setDesc('생성할 폴더 이름')
      .addText(text => {
        text.setPlaceholder('새 코스 이름')
          .onChange(value => {
            this.folderName = value;
          });
      });
    
    new Setting(contentEl)
      .addButton(btn => btn
        .setButtonText('생성')
        .setCta()
        .onClick(async () => {
          if (!this.folderName) {
            new Notice('⚠️ 폴더 이름을 입력해주세요');
            return;
          }
          
          const folderPath = `${this.plugin.settings.coursesFolder}/${this.folderName}`;
          await this.plugin.createFolder(folderPath);
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

// ========================================
// Modal: 폴더 삭제
// ========================================

class DeleteFolderModal extends Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
  }

  async onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    
    contentEl.createEl('h2', { text: '폴더 삭제' });
    
    const folders = await this.plugin.getCourseFolders();
    
    if (folders.length === 0) {
      contentEl.createEl('p', { text: '삭제할 폴더가 없습니다.' });
      
      new Setting(contentEl)
        .addButton(btn => btn
          .setButtonText('닫기')
          .onClick(() => this.close()));
      
      return;
    }
    
    contentEl.createEl('p', { 
      text: '⚠️ 삭제할 코스를 선택하세요. 이 작업은 되돌릴 수 없습니다!',
      cls: 'mod-warning'
    });
    
    const listEl = contentEl.createEl('div', { 
      cls: 'lecture-list',
      attr: { style: 'max-height: 300px; overflow-y: auto; margin: 20px 0;' }
    });
    
    for (let folder of folders) {
      const itemEl = listEl.createEl('div', {
        cls: 'lecture-item'
      });
      
      itemEl.createEl('div', {
        text: folder.name,
        attr: { style: 'font-weight: 600; margin-bottom: 5px;' }
      });
      
      itemEl.createEl('div', {
        text: folder.path,
        attr: { style: 'font-size: 0.85em; color: var(--text-muted);' }
      });
      
      const btnEl = itemEl.createEl('button', {
        text: '삭제',
        cls: 'mod-warning',
        attr: { style: 'margin-top: 10px;' }
      });
      
      btnEl.addEventListener('click', async () => {
        const success = await this.plugin.deleteFolder(folder.path);
        if (success) {
          itemEl.remove();
          
          if (listEl.children.length === 0) {
            this.close();
          }
        }
      });
    }
    
    new Setting(contentEl)
      .addButton(btn => btn
        .setButtonText('취소')
        .onClick(() => this.close()));
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

// ========================================
// Modal: 대시보드 재생성
// ========================================

class RegenerateDashboardModal extends Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
  }

  async onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    
    contentEl.createEl('h2', { text: '대시보드 재생성' });
    
    const folders = await this.plugin.getCourseFolders();
    
    if (folders.length === 0) {
      contentEl.createEl('p', { text: '코스가 없습니다.' });
      
      new Setting(contentEl)
        .addButton(btn => btn
          .setButtonText('닫기')
          .onClick(() => this.close()));
      
      return;
    }
    
    contentEl.createEl('p', { 
      text: '재생성할 코스를 선택하세요.'
    });
    
    const listEl = contentEl.createEl('div', { 
      cls: 'lecture-list',
      attr: { style: 'max-height: 300px; overflow-y: auto; margin: 20px 0;' }
    });
    
    for (let folder of folders) {
      const itemEl = listEl.createEl('div', {
        cls: 'lecture-item'
      });
      
      itemEl.createEl('div', {
        text: folder.name,
        attr: { style: 'font-weight: 600;' }
      });
      
      const btnEl = itemEl.createEl('button', {
        text: '재생성',
        cls: 'mod-cta',
        attr: { style: 'margin-top: 10px;' }
      });
      
      btnEl.addEventListener('click', async () => {
        await this.plugin.regenerateDashboard(folder.name);
      });
    }
    
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

// ========================================
// Modal: 삭제 확인
// ========================================

class ConfirmDeleteModal extends Modal {
  constructor(app, itemName, callback) {
    super(app);
    this.itemName = itemName;
    this.callback = callback;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    
    contentEl.createEl('h2', { text: '삭제 확인' });
    
    contentEl.createEl('p', { 
      text: `"${this.itemName}"을(를) 정말 삭제하시겠습니까?`,
      attr: { style: 'margin: 20px 0;' }
    });
    
    contentEl.createEl('p', { 
      text: '⚠️ 이 작업은 되돌릴 수 없습니다!',
      cls: 'mod-warning'
    });
    
    const btnContainer = contentEl.createEl('div', {
      attr: { style: 'display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;' }
    });
    
    const cancelBtn = btnContainer.createEl('button', { text: '취소' });
    cancelBtn.addEventListener('click', () => {
      this.callback(false);
      this.close();
    });
    
    const confirmBtn = btnContainer.createEl('button', { 
      text: '삭제',
      cls: 'mod-warning'
    });
    confirmBtn.addEventListener('click', () => {
      this.callback(true);
      this.close();
    });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

// ========================================
// Modal: 모바일 메뉴
// ========================================

class MobileMenuModal extends Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    
    contentEl.addClass('mobile-menu-modal');
    
    contentEl.createEl('h2', { text: '📚 Lecture Tracker' });
    
    const menuItems = [
      {
        icon: '➕',
        name: '새 코스 생성',
        action: () => {
          this.close();
          this.plugin.openCreateCourseModal();
        }
      },
      {
        icon: '📝',
        name: '강의 노트 생성',
        action: () => {
          this.close();
          this.plugin.openCreateLectureModal();
        }
      },
      {
        icon: '📊',
        name: '학습 계획',
        action: async () => {
          this.close();
          await this.plugin.openPlanDashboard();
        }
      },
      {
        icon: '📚',
        name: '오늘 복습',
        action: async () => {
          this.close();
          await this.plugin.showTodayReview();
        }
      },
      {
        icon: '⚙️',
        name: '설정',
        action: () => {
          this.close();
          this.app.setting.open();
          this.app.setting.openTabById('smart-lecture-tracker');
        }
      }
    ];
    
    for (let item of menuItems) {
      const itemEl = contentEl.createEl('div', {
        cls: 'mobile-menu-item',
        attr: { 
          style: 'padding: 15px; margin: 8px 0; background: var(--background-secondary); border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 15px;'
        }
      });
      
      itemEl.createEl('span', { 
        text: item.icon,
        attr: { style: 'font-size: 24px;' }
      });
      
      itemEl.createEl('span', { 
        text: item.name,
        attr: { style: 'font-weight: 600;' }
      });
      
      itemEl.addEventListener('click', item.action);
    }
    
    const closeBtn = contentEl.createEl('button', {
      text: '닫기',
      attr: { style: 'width: 100%; margin-top: 20px;' }
    });
    
    closeBtn.addEventListener('click', () => this.close());
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

module.exports = SmartLectureTrackerPlugin;