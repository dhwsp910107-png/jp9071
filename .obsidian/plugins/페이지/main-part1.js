// ============================================
// 페이지 진도 관리 플러그인 - Part 1/3
// 기본 설정 및 플러그인 클래스
// ============================================

const { Plugin, Modal, Setting, Notice, TFile, PluginSettingTab } = require('obsidian');

class PageProgressManagerPlugin extends Plugin {
    async onload() {
        console.log('📚 페이지 진도 관리 시스템 로딩 시작');
        
        try {
            await this.loadSettings();
            this.setupCommands();
            this.setupUI();
            
            console.log('✅ 페이지 진도 관리 시스템 로딩 완료');
            new Notice('📚 페이지 진도 관리 시스템 활성화');

        } catch (error) {
            console.error('❌ 플러그인 로딩 오류:', error);
            new Notice('플러그인 로딩 실패: ' + error.message);
        }
    }

    async loadSettings() {
        this.settings = Object.assign({
            bookTitle: "전기기사 실기",
            totalPages: 200,
            pageUnit: 20,
            defaultCategory: "전기",
            defaultSubject: "전기기사",
            progressFolder: "📖 페이지 진도 시스템",
            learningFolder: "⏱️ 10분 학습"
        }, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    setupCommands() {
        // 명령어들 추가
        this.addCommand({
            id: 'open-page-dashboard',
            name: '📖 페이지 진도 대시보드 열기',
            callback: () => this.openPageDashboard()
        });

        this.addCommand({
            id: 'create-time-learning',
            name: '⏱️ 10분 단위 학습 노트 생성',
            callback: () => this.createTimeLearningNote()
        });

        this.addCommand({
            id: 'create-page-blocks',
            name: '📚 페이지 블록 시스템 생성',
            callback: () => this.createPageBlocks()
        });
    }

    setupUI() {
        // 리본 아이콘들 추가
        this.addRibbonIcon('book-open', '📖 페이지 진도 대시보드', () => {
            this.openPageDashboard();
        });

        this.addRibbonIcon('clock', '⏱️ 10분 단위 학습 생성', () => {
            this.createTimeLearningNote();
        });

        this.addRibbonIcon('blocks', '📚 페이지 블록 시스템 생성', () => {
            this.createPageBlocks();
        });

        // 설정 탭 추가
        this.addSettingTab(new PageProgressSettingTab(this.app, this));
    }

    onunload() {
        console.log('📚 페이지 진도 관리 시스템 언로드');
    }

    // 메인 메소드들
    openPageDashboard() {
        new PageProgressDashboardModal(this.app, this.settings).open();
    }

    async createTimeLearningNote() {
        new TimeLearningModal(this.app, this.settings, (data) => {
            this.generateTimeLearningNote(data);
        }).open();
    }

    async createPageBlocks() {
        new PageBlockModal(this.app, this.settings, (data) => {
            this.generatePageBlockSystem(data);
        }).open();
    }

    // ============================================
    // Part 2/3: 노트 생성 기능들
    // ============================================

    async generateTimeLearningNote(data) {
        const { title, category, subject, date } = data;
        
        const content = `---
type: lecture-progress
title: "${title}"
date: ${date}
category: "${category}"
subject: "${subject}"
duration: 60
segments: 6
startTime: ""
endTime: ""
understanding: 0
difficulty: 0
completed: false
progress: 0
tags:
  - 강의진도
  - 학습관리
  - 10분단위
  - 6분할시스템
---

# 📚 ${title} - 1시간 6분할 학습

## 🎯 강의 정보
- **강의명**: ${title}
- **날짜**: ${date}
- **전체 시간**: 1시간 (60분)
- **카테고리**: ${category}
- **과목**: ${subject}

---

## 📊 실시간 진행률

\`\`\`dataviewjs
const currentFile = dv.current();
const tasks = currentFile.file.tasks.where(t => 
    t.text.includes("구간 학습 완료")
);

const completed = tasks.where(t => t.completed).length;
const total = 6;
const percentage = Math.round((completed / total) * 100);

const progressBar = "▓".repeat(Math.floor(completed)) + "░".repeat(total - Math.floor(completed));

dv.container.innerHTML = \`
<div style="background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); padding: 1.5rem; border-radius: 12px; margin: 1rem 0; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <span style="font-size: 1.2rem; font-weight: 600; color: #333;">학습 진행률</span>
        <span style="font-size: 2rem; font-weight: bold; color: \${percentage === 100 ? '#28a745' : '#667eea'};">\${percentage}%</span>
    </div>
    <div style="height: 12px; background: #e9ecef; border-radius: 6px; overflow: hidden; margin-bottom: 1rem;">
        <div style="height: 100%; background: linear-gradient(90deg, #28a745 0%, #20c997 100%); width: \${percentage}%; transition: width 0.5s ease;"></div>
    </div>
    <div style="display: flex; justify-content: space-between; font-size: 0.95rem; color: #666;">
        <span>📊 \${completed} / \${total} 구간 완료</span>
        <span>⏱️ 예상 남은 시간: \${(total - completed) * 10}분</span>
    </div>
    <div style="margin-top: 1rem; padding: 0.8rem; background: white; border-radius: 8px; font-size: 1.5rem; text-align: center; letter-spacing: 0.5rem;">\${progressBar}</div>
</div>
\`;
\`\`\`

---

## ⏱️ 10분 단위 학습 구간

### 📍 1구간 (0-10분)
- [ ] **1구간 학습 완료** ✅ #학습진도

#### 📝 주요 내용
\`\`\`
[이 구간에서 학습한 핵심 내용을 정리하세요]
\`\`\`

#### ⭐ 이해도
- 이해도: ⭐⭐⭐⭐⭐ (5점 만점)
- 난이도: 🔥🔥🔥 (상/중/하)

---

### 📍 2구간 (10-20분)
- [ ] **2구간 학습 완료** ✅ #학습진도

#### 📝 주요 내용
\`\`\`
[이 구간에서 학습한 핵심 내용을 정리하세요]
\`\`\`

#### ⭐ 이해도
- 이해도: ⭐⭐⭐⭐⭐ (5점 만점)
- 난이도: 🔥🔥🔥 (상/중/하)

---

### 📍 3구간 (20-30분)
- [ ] **3구간 학습 완료** ✅ #학습진도

#### 📝 주요 내용
\`\`\`
[이 구간에서 학습한 핵심 내용을 정리하세요]
\`\`\`

#### ⭐ 이해도
- 이해도: ⭐⭐⭐⭐⭐ (5점 만점)
- 난이도: 🔥🔥🔥 (상/중/하)

---

### 📍 4구간 (30-40분)
- [ ] **4구간 학습 완료** ✅ #학습진도

#### 📝 주요 내용
\`\`\`
[이 구간에서 학습한 핵심 내용을 정리하세요]
\`\`\`

#### ⭐ 이해도
- 이해도: ⭐⭐⭐⭐⭐ (5점 만점)
- 난이도: 🔥🔥🔥 (상/중/하)

---

### 📍 5구간 (40-50분)
- [ ] **5구간 학습 완료** ✅ #학습진도

#### 📝 주요 내용
\`\`\`
[이 구간에서 학습한 핵심 내용을 정리하세요]
\`\`\`

#### ⭐ 이해도
- 이해도: ⭐⭐⭐⭐⭐ (5점 만점)
- 난이도: 🔥🔥🔥 (상/중/하)

---

### 📍 6구간 (50-60분)
- [ ] **6구간 학습 완료** ✅ #학습진도

#### 📝 주요 내용
\`\`\`
[이 구간에서 학습한 핵심 내용을 정리하세요]
\`\`\`

#### ⭐ 이해도
- 이해도: ⭐⭐⭐⭐⭐ (5점 만점)
- 난이도: 🔥🔥🔥 (상/중/하)

---

## 📝 전체 정리

### 🎯 핵심 요약
\`\`\`
[1시간 전체 강의의 핵심 내용을 3-5줄로 요약하세요]
\`\`\`

### 🏷️ 태그 & 메타정보
**태그**: #강의진도 #학습관리 #10분단위 #6분할시스템 #${subject}
**생성일**: ${date}
`;

        try {
            const folderPath = this.settings.learningFolder;
            const folder = this.app.vault.getAbstractFileByPath(folderPath);
            if (!folder) {
                await this.app.vault.createFolder(folderPath);
            }

            const fileName = `${title}_${date}.md`;
            const filePath = `${folderPath}/${fileName}`;
            
            await this.app.vault.create(filePath, content);
            
            const file = this.app.vault.getAbstractFileByPath(filePath);
            if (file) {
                const leaf = this.app.workspace.getLeaf();
                await leaf.openFile(file);
            }
            
            new Notice(`✅ 10분 단위 학습 노트 생성 완료: ${title}`);
            
        } catch (error) {
            console.error('노트 생성 오류:', error);
            new Notice(`❌ 노트 생성 실패: ${error.message}`);
        }
    }

    async generatePageBlockSystem(data) {
        const { bookTitle, totalPages, pageUnit } = data;
        const totalBlocks = Math.ceil(totalPages / pageUnit);
        
        // 간단한 마스터 대시보드 생성
        const masterContent = `---
type: page-progress-master
bookTitle: "${bookTitle}"
totalPages: ${totalPages}
pageUnit: ${pageUnit}
totalBlocks: ${totalBlocks}
tags:
  - 페이지진도
  - 마스터대시보드
---

# 📖 ${bookTitle} - 페이지 진도 마스터 대시보드

## 📊 전체 진행률

\`\`\`dataviewjs
const bookTitle = "${bookTitle}";
const totalBlocks = ${totalBlocks};

const blockFiles = dv.pages('"${this.settings.progressFolder}"')
    .where(p => p.type === 'page-block' && p.bookTitle === bookTitle);

const completedBlocks = blockFiles.where(p => p.completed === true).length;
const overallProgress = Math.round((completedBlocks / totalBlocks) * 100);

dv.container.innerHTML = \`
<div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 2rem; border-radius: 15px; margin: 1rem 0; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);">
    <div style="text-align: center; margin-bottom: 2rem;">
        <h1 style="margin: 0; font-size: 2.5rem;">📖 페이지 진도 관리</h1>
        <p style="margin: 0.5rem 0 0 0; font-size: 1.1rem;">교재 페이지 기반 체계적 학습 진도 추적</p>
    </div>
    <div style="background: rgba(255, 255, 255, 0.95); color: #333; padding: 1.5rem; border-radius: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <span style="font-size: 1.3rem; font-weight: 600;">\${bookTitle} 진행률</span>
            <span style="font-size: 2rem; font-weight: bold; color: \${overallProgress === 100 ? '#28a745' : '#667eea'};">\${overallProgress}%</span>
        </div>
        <div style="height: 12px; background: #e9ecef; border-radius: 6px; overflow: hidden;">
            <div style="height: 100%; background: linear-gradient(90deg, #28a745 0%, #20c997 100%); width: \${overallProgress}%; transition: width 0.5s ease;"></div>
        </div>
        <div style="margin-top: 1rem; text-align: center;">
            <span style="font-size: 1rem;">📊 \${completedBlocks} / \${totalBlocks} 블록 완료 | 📄 총 ${totalPages} 페이지</span>
        </div>
    </div>
</div>
\`;
\`\`\`

## 📚 블록 목록

`;

        // 각 블록 링크 생성
        for (let i = 1; i <= totalBlocks; i++) {
            const startPage = (i - 1) * pageUnit + 1;
            const endPage = Math.min(i * pageUnit, totalPages);
            masterContent += `- [[📚 블록 ${i} (${startPage}-${endPage}p)]] - ${startPage}-${endPage}페이지\n`;
        }

        try {
            const folderPath = this.settings.progressFolder;
            const folder = this.app.vault.getAbstractFileByPath(folderPath);
            if (!folder) {
                await this.app.vault.createFolder(folderPath);
            }

            // 마스터 대시보드 생성
            const masterFileName = `🎯 마스터 대시보드.md`;
            const masterFilePath = `${folderPath}/${masterFileName}`;
            await this.app.vault.create(masterFilePath, masterContent);

            // 개별 블록 파일들 생성 (간단한 버전)
            for (let i = 1; i <= totalBlocks; i++) {
                const startPage = (i - 1) * pageUnit + 1;
                const endPage = Math.min(i * pageUnit, totalPages);
                
                const blockContent = `---
type: page-block
bookTitle: "${bookTitle}"
blockNumber: ${i}
startPage: ${startPage}
endPage: ${endPage}
totalPages: ${endPage - startPage + 1}
completed: false
progress: 0
tags:
  - 페이지진도
  - 블록${i}
---

# 📚 ${bookTitle} - 블록 ${i} (${startPage}-${endPage}p)

## 📖 블록 정보
- **교재**: ${bookTitle}
- **블록**: ${i}/${totalBlocks}
- **페이지 범위**: ${startPage}-${endPage}p (${endPage - startPage + 1}페이지)

## 📚 학습 구간

### 📍 1구간 (${startPage}-${Math.floor(startPage + (endPage - startPage) / 3)}p)
- [ ] **1구간 완료** #페이지진도

### 📍 2구간 (${Math.floor(startPage + (endPage - startPage) / 3) + 1}-${Math.floor(startPage + 2 * (endPage - startPage) / 3)}p)
- [ ] **2구간 완료** #페이지진도

### 📍 3구간 (${Math.floor(startPage + 2 * (endPage - startPage) / 3) + 1}-${endPage}p)
- [ ] **3구간 완료** #페이지진도

## 📝 학습 노트
\`\`\`
[이 블록에서 학습한 내용을 정리하세요]
\`\`\`

## 🔗 연결
- **마스터 대시보드**: [[🎯 마스터 대시보드]]
`;

                const blockFileName = `📚 블록 ${i} (${startPage}-${endPage}p).md`;
                const blockFilePath = `${folderPath}/${blockFileName}`;
                await this.app.vault.create(blockFilePath, blockContent);
            }

            // 마스터 대시보드 열기
            const masterFile = this.app.vault.getAbstractFileByPath(masterFilePath);
            if (masterFile) {
                const leaf = this.app.workspace.getLeaf();
                await leaf.openFile(masterFile);
            }

            new Notice(`✅ 페이지 블록 시스템 생성 완료: ${totalBlocks}개 블록`);

        } catch (error) {
            console.error('페이지 블록 시스템 생성 오류:', error);
            new Notice(`❌ 시스템 생성 실패: ${error.message}`);
        }
    }
}

// ============================================
// Part 3/3: 모달 클래스들
// ============================================

class PageProgressDashboardModal extends Modal {
    constructor(app, settings) {
        super(app);
        this.settings = settings;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h2', { text: '📖 페이지 진도 대시보드' });
        contentEl.createEl('p', { text: 'HTML 디자인을 기반으로 한 진도 관리 시스템입니다!' });
        
        const buttonDiv = contentEl.createDiv({ cls: 'button-container' });
        buttonDiv.style.display = 'flex';
        buttonDiv.style.gap = '10px';
        buttonDiv.style.marginTop = '20px';
        
        const button1 = buttonDiv.createEl('button', { text: '⏱️ 10분 단위 학습 노트 생성' });
        button1.style.padding = '10px 15px';
        button1.onclick = () => {
            this.close();
            new TimeLearningModal(this.app, this.settings, (data) => {
                // TimeLearning 노트 생성 로직
            }).open();
        };

        const button2 = buttonDiv.createEl('button', { text: '📚 페이지 블록 시스템 생성' });
        button2.style.padding = '10px 15px';
        button2.onclick = () => {
            this.close();
            new PageBlockModal(this.app, this.settings, (data) => {
                // PageBlock 시스템 생성 로직
            }).open();
        };
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

class TimeLearningModal extends Modal {
    constructor(app, settings, callback) {
        super(app);
        this.settings = settings;
        this.callback = callback;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        contentEl.createEl('h2', { text: '⏱️ 10분 단위 학습 노트 생성' });

        const form = contentEl.createEl('form');
        
        const titleDiv = form.createDiv();
        titleDiv.createEl('label', { text: '강의명:' });
        const titleInput = titleDiv.createEl('input', { 
            type: 'text', 
            placeholder: '예: 전기회로 기초',
            style: 'width: 100%; padding: 5px; margin: 5px 0;'
        });
        
        const categoryDiv = form.createDiv();
        categoryDiv.createEl('label', { text: '카테고리:' });
        const categoryInput = categoryDiv.createEl('input', { 
            type: 'text', 
            value: this.settings.defaultCategory,
            style: 'width: 100%; padding: 5px; margin: 5px 0;'
        });
        
        const subjectDiv = form.createDiv();
        subjectDiv.createEl('label', { text: '과목:' });
        const subjectInput = subjectDiv.createEl('input', { 
            type: 'text', 
            value: this.settings.defaultSubject,
            style: 'width: 100%; padding: 5px; margin: 5px 0;'
        });

        const buttonDiv = form.createDiv();
        buttonDiv.style.marginTop = '20px';
        buttonDiv.style.display = 'flex';
        buttonDiv.style.gap = '10px';
        
        const createBtn = buttonDiv.createEl('button', { text: '생성', type: 'submit' });
        const cancelBtn = buttonDiv.createEl('button', { text: '취소', type: 'button' });

        form.onsubmit = (e) => {
            e.preventDefault();
            const data = {
                title: titleInput.value || '새 강의',
                category: categoryInput.value || this.settings.defaultCategory,
                subject: subjectInput.value || this.settings.defaultSubject,
                date: new Date().toISOString().split('T')[0]
            };
            this.callback(data);
            this.close();
        };

        cancelBtn.onclick = () => this.close();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

class PageBlockModal extends Modal {
    constructor(app, settings, callback) {
        super(app);
        this.settings = settings;
        this.callback = callback;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        contentEl.createEl('h2', { text: '📚 페이지 블록 시스템 생성' });

        const form = contentEl.createEl('form');
        
        const titleDiv = form.createDiv();
        titleDiv.createEl('label', { text: '교재명:' });
        const titleInput = titleDiv.createEl('input', { 
            type: 'text', 
            value: this.settings.bookTitle,
            style: 'width: 100%; padding: 5px; margin: 5px 0;'
        });
        
        const pagesDiv = form.createDiv();
        pagesDiv.createEl('label', { text: '총 페이지:' });
        const pagesInput = pagesDiv.createEl('input', { 
            type: 'number', 
            value: this.settings.totalPages.toString(),
            style: 'width: 100%; padding: 5px; margin: 5px 0;'
        });
        
        const unitDiv = form.createDiv();
        unitDiv.createEl('label', { text: '페이지 단위:' });
        const unitInput = unitDiv.createEl('input', { 
            type: 'number', 
            value: this.settings.pageUnit.toString(),
            style: 'width: 100%; padding: 5px; margin: 5px 0;'
        });

        const buttonDiv = form.createDiv();
        buttonDiv.style.marginTop = '20px';
        buttonDiv.style.display = 'flex';
        buttonDiv.style.gap = '10px';
        
        const createBtn = buttonDiv.createEl('button', { text: '시스템 생성', type: 'submit' });
        const cancelBtn = buttonDiv.createEl('button', { text: '취소', type: 'button' });

        form.onsubmit = (e) => {
            e.preventDefault();
            const data = {
                bookTitle: titleInput.value || this.settings.bookTitle,
                totalPages: parseInt(pagesInput.value) || this.settings.totalPages,
                pageUnit: parseInt(unitInput.value) || this.settings.pageUnit
            };
            this.callback(data);
            this.close();
        };

        cancelBtn.onclick = () => this.close();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

class PageProgressSettingTab extends PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        const { containerEl } = this;
        containerEl.empty();
        
        containerEl.createEl('h2', { text: '📚 페이지 진도 관리 설정' });

        new Setting(containerEl)
            .setName('기본 교재명')
            .setDesc('새 시스템 생성시 기본값')
            .addText(text => text
                .setPlaceholder('전기기사 실기')
                .setValue(this.plugin.settings.bookTitle)
                .onChange(async (value) => {
                    this.plugin.settings.bookTitle = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('기본 총 페이지')
            .addText(text => text
                .setPlaceholder('200')
                .setValue(this.plugin.settings.totalPages.toString())
                .onChange(async (value) => {
                    this.plugin.settings.totalPages = parseInt(value) || 200;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('페이지 단위')
            .addText(text => text
                .setPlaceholder('20')
                .setValue(this.plugin.settings.pageUnit.toString())
                .onChange(async (value) => {
                    this.plugin.settings.pageUnit = parseInt(value) || 20;
                    await this.plugin.saveSettings();
                }));
    }
}

module.exports = PageProgressManagerPlugin;
