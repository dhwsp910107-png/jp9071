const { Plugin, Modal, Setting, Notice, TFile } = require('obsidian');

// ========================================
// 옵시디언 플러그인 클래스
// ========================================

class PageProgressManagerPlugin extends Plugin {
    async onload() {
        console.log('📚 페이지 진도 관리 시스템 로딩 시작');
        
        try {
            // 기본 설정 로드
            await this.loadSettings();
            
            // 리본 아이콘들 추가
            this.addRibbonIcon('book-open', '📖 페이지 진도 대시보드', () => {
                this.openPageDashboard();
            });

            this.addRibbonIcon('clock', '⏱️ 10분 단위 학습 생성', () => {
                this.createTimeLearningNote();
            });

            // 명령어들 추가
            this.addCommand({
                id: 'open-page-dashboard',
                name: '📖 페이지 진도 대시보드 열기',
                callback: () => {
                    this.openPageDashboard();
                }
            });

            this.addCommand({
                id: 'create-time-learning',
                name: '⏱️ 10분 단위 학습 노트 생성',
                callback: () => {
                    this.createTimeLearningNote();
                }
            });

            this.addCommand({
                id: 'create-page-blocks',
                name: '📚 페이지 블록 시스템 생성',
                callback: () => {
                    this.createPageBlocks();
                }
            });

            // 설정 탭 추가
            this.addSettingTab(new PageProgressSettingTab(this.app, this));

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

    onunload() {
        console.log('📚 페이지 진도 관리 시스템 언로드');
    }

    openPageDashboard() {
        new PageProgressDashboardModal(this.app, this.settings).open();
    }

    async createTimeLearningNote() {
        new TimeLearningModal(this.app, this.settings, (data) => {
            this.generateTimeLearningNote(data);
        }).open();
    }

    async generateTimeLearningNote(data) {
        const { title, category, subject, date } = data;
        
        const frontmatter = `---
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
---`;

        const content = `${frontmatter}

# 📚 ${title} - 1시간 6분할 학습

## 🎯 강의 정보
- **강의명**: ${title}
- **날짜**: ${date}
- **전체 시간**: 1시간 (60분)
- **카테고리**: ${category}
- **과목**: ${subject}
- **진도 시스템**: [[📖 페이지 진도 시스템/🎯 마스터 대시보드]]

---

## 📊 실시간 진행률

\`\`\`dataviewjs
const currentFile = dv.current();
const tasks = currentFile.file.tasks.where(t => 
    t.text.includes("구간 학습 완료") && 
    t.section && 
    t.section.subpath.includes("구간")
);

const completed = tasks.where(t => t.completed).length;
const total = 6;
const percentage = Math.round((completed / total) * 100);

// 진행 바 생성
const progressBar = "▓".repeat(Math.floor(completed)) + "░".repeat(total - Math.floor(completed));

dv.container.innerHTML = \`
<div style="
    background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
    padding: 1.5rem;
    border-radius: 12px;
    margin: 1rem 0;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <span style="font-size: 1.2rem; font-weight: 600; color: #333;">학습 진행률</span>
        <span style="font-size: 2rem; font-weight: bold; color: \${percentage === 100 ? '#28a745' : '#667eea'};">
            \${percentage}%
        </span>
    </div>
    
    <div style="
        height: 12px;
        background: #e9ecef;
        border-radius: 6px;
        overflow: hidden;
        margin-bottom: 1rem;
    ">
        <div style="
            height: 100%;
            background: linear-gradient(90deg, #28a745 0%, #20c997 100%);
            width: \${percentage}%;
            transition: width 0.5s ease;
        "></div>
    </div>
    
    <div style="display: flex; justify-content: space-between; font-size: 0.95rem; color: #666;">
        <span>📊 \${completed} / \${total} 구간 완료</span>
        <span>⏱️ 예상 남은 시간: \${(total - completed) * 10}분</span>
    </div>
    
    <div style="
        margin-top: 1rem;
        padding: 0.8rem;
        background: white;
        border-radius: 8px;
        font-size: 1.5rem;
        text-align: center;
        letter-spacing: 0.5rem;
    ">
        \${progressBar}
    </div>
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

#### 💭 메모 & 질문
\`\`\`
[중요 포인트나 의문사항을 기록하세요]




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

#### 💭 메모 & 질문
\`\`\`
[중요 포인트나 의문사항을 기록하세요]




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

#### 💭 메모 & 질문
\`\`\`
[중요 포인트나 의문사항을 기록하세요]




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

#### 💭 메모 & 질문
\`\`\`
[중요 포인트나 의문사항을 기록하세요]




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

#### 💭 메모 & 질문
\`\`\`
[중요 포인트나 의문사항을 기록하세요]




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

#### 💭 메모 & 질문
\`\`\`
[중요 포인트나 의문사항을 기록하세요]




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

### ❓ 질문/의문점
\`\`\`
[학습 중 생긴 질문이나 의문점을 기록하세요]
- 
- 
- 


\`\`\`

### 🔄 복습 필요 사항
\`\`\`
[다시 복습이 필요한 부분이나 어려웠던 내용을 기록하세요]
- 
- 
- 


\`\`\`

### 💡 인사이트 & 적용방안
\`\`\`
[이 강의를 통해 얻은 인사이트나 실제 적용할 수 있는 방안]
- 
- 
- 


\`\`\`

---

## 📈 학습 통계 및 분석

\`\`\`dataviewjs
const currentFile = dv.current();
const tasks = currentFile.file.tasks.where(t => 
    t.text.includes("구간 학습 완료")
);

const completed = tasks.where(t => t.completed).length;
const total = 6;
const percentage = Math.round((completed / total) * 100);

// 시작/종료 시간
const startTime = currentFile.startTime || "미기록";
const endTime = currentFile.endTime || "미기록";

// 상태 판별
let status = "대기중";
let statusColor = "#6c757d";
let statusIcon = "⭕";

if (completed === total) {
    status = "완료";
    statusColor = "#28a745";
    statusIcon = "✅";
} else if (completed > 0) {
    status = "진행중";
    statusColor = "#ffc107";
    statusIcon = "🔄";
}

// 평균 이해도 계산 (프론트매터에서)
const understanding = currentFile.understanding || 0;
const difficulty = currentFile.difficulty || 0;

dv.container.innerHTML = \`
<div style="
    background: white;
    padding: 1.5rem;
    border-radius: 12px;
    border-left: 4px solid \${statusColor};
    margin: 1rem 0;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
        <h3 style="margin: 0; color: #333;">📊 학습 현황</h3>
        <div style="
            background: \${statusColor};
            color: white;
            padding: 0.4rem 1rem;
            border-radius: 20px;
            font-weight: 600;
        ">
            \${statusIcon} \${status}
        </div>
    </div>
    
    <div style="
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 1.5rem;
        margin-bottom: 1rem;
    ">
        <div style="text-align: center; padding: 1rem; background: #f8f9fa; border-radius: 8px;">
            <div style="font-size: 0.9rem; color: #666; margin-bottom: 0.5rem;">📅 시작 시간</div>
            <div style="font-weight: 600; color: #333;">\${startTime}</div>
        </div>
        
        <div style="text-align: center; padding: 1rem; background: #f8f9fa; border-radius: 8px;">
            <div style="font-size: 0.9rem; color: #666; margin-bottom: 0.5rem;">🏁 완료 시간</div>
            <div style="font-weight: 600; color: #333;">\${endTime}</div>
        </div>
        
        <div style="text-align: center; padding: 1rem; background: #f8f9fa; border-radius: 8px;">
            <div style="font-size: 0.9rem; color: #666; margin-bottom: 0.5rem;">📊 완료 구간</div>
            <div style="font-weight: 600; color: \${statusColor}; font-size: 1.3rem;">\${completed} / \${total}</div>
        </div>
        
        <div style="text-align: center; padding: 1rem; background: #f8f9fa; border-radius: 8px;">
            <div style="font-size: 0.9rem; color: #666; margin-bottom: 0.5rem;">⏱️ 남은 시간</div>
            <div style="font-weight: 600; color: #333;">\${(total - completed) * 10}분</div>
        </div>
    </div>
</div>
\`;
\`\`\`

---

## 🤖 AI 학습 분석

\`\`\`dataviewjs
const currentFile = dv.current();
const tasks = currentFile.file.tasks.where(t => 
    t.text.includes("구간 학습 완료")
);

const completed = tasks.where(t => t.completed).length;
const total = 6;
const progressPercent = Math.round((completed / total) * 100);

let analysis = "";
let recommendation = "";
let motivation = "";
let bgColor = "";
let borderColor = "";

if (completed === 0) {
    analysis = "🆕 새로운 학습 시작";
    recommendation = "차근차근 1구간부터 시작해보세요. 처음 10분이 가장 중요합니다!";
    motivation = "시작이 반이다! 지금 바로 첫 구간을 시작해보세요.";
    bgColor = "#e3f2fd";
    borderColor = "#2196f3";
} else if (completed < 3) {
    analysis = "🏃‍♂️ 좋은 시작입니다!";
    recommendation = \`현재 페이스를 유지하며 계속 진행하세요. \${3 - completed}개 구간만 더 하면 절반입니다!\`;
    motivation = "잘하고 있어요! 집중력을 유지하며 계속 진행하세요.";
    bgColor = "#fff3e0";
    borderColor = "#ff9800";
} else if (completed < 5) {
    analysis = "💪 절반 이상 완주!";
    recommendation = \`벌써 \${completed}개 구간을 완료했습니다. 조금만 더 힘내세요!\`;
    motivation = "거의 다 왔습니다! 끝까지 집중력을 유지하세요.";
    bgColor = "#fff9c4";
    borderColor = "#ffc107";
} else if (completed < 6) {
    analysis = "🎯 마지막 스퍼트!";
    recommendation = "이제 마지막 구간만 남았습니다. 끝까지 완주하세요!";
    motivation = "완벽한 마무리를 위해 마지막까지 최선을 다하세요!";
    bgColor = "#f3e5f5";
    borderColor = "#9c27b0";
} else {
    analysis = "🎉 완벽한 학습 완료!";
    recommendation = "모든 구간을 완료했습니다. 복습 계획을 세우거나 다음 강의를 준비하세요.";
    motivation = "축하합니다! 전체 강의를 완료했습니다. 🎊";
    bgColor = "#e8f5e9";
    borderColor = "#4caf50";
}

// 다음 액션 제안
let nextAction = "";
if (completed === 0) {
    nextAction = "🎬 '1구간 학습 완료' 체크박스를 클릭하여 시작하세요";
} else if (completed < 6) {
    nextAction = \`📝 \${completed + 1}구간으로 이동하여 학습을 계속하세요\`;
} else {
    nextAction = "🔄 복습 노트를 작성하거나 연관 강의를 찾아보세요";
}

dv.container.innerHTML = \`
<div style="
    background: \${bgColor};
    padding: 1.5rem;
    border-radius: 12px;
    margin: 1rem 0;
    border-left: 4px solid \${borderColor};
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
">
    <h3 style="margin: 0 0 1rem 0; color: #333;">🤖 AI 학습 분석</h3>
    
    <div style="margin-bottom: 1rem;">
        <div style="font-weight: 600; color: #333; margin-bottom: 0.5rem;">현재 상태</div>
        <div style="font-size: 1.1rem; color: #555;">\${analysis}</div>
    </div>
    
    <div style="
        background: white;
        padding: 1rem;
        border-radius: 8px;
        margin-bottom: 1rem;
        border-left: 3px solid \${borderColor};
    ">
        <div style="font-weight: 600; color: #333; margin-bottom: 0.5rem;">💡 추천사항</div>
        <div style="color: #555; line-height: 1.6;">\${recommendation}</div>
    </div>
    
    <div style="
        background: rgba(255,255,255,0.7);
        padding: 1rem;
        border-radius: 8px;
        margin-bottom: 1rem;
    ">
        <div style="font-weight: 600; color: #333; margin-bottom: 0.5rem;">🎯 다음 액션</div>
        <div style="color: #555; line-height: 1.6;">\${nextAction}</div>
    </div>
    
    <div style="
        text-align: center;
        padding: 1rem;
        background: rgba(255,255,255,0.5);
        border-radius: 8px;
        font-style: italic;
        color: #666;
    ">
        "\${motivation}"
    </div>
    
    <div style="
        margin-top: 1rem;
        padding-top: 1rem;
        border-top: 1px solid rgba(0,0,0,0.1);
        font-size: 0.9rem;
        color: #666;
        display: flex;
        justify-content: space-between;
    ">
        <span>📊 진행률: \${progressPercent}%</span>
        <span>⏱️ \${(total - completed) * 10}분 남음</span>
    </div>
</div>
\`;
\`\`\`

---

## 🔗 관련 링크 & 연결

### 📚 연결된 노트
- **이전 강의**: [[]]
- **다음 강의**: [[]]
- **관련 자료**: [[]]
- **복습 노트**: [[]]

### 🔗 외부 링크
- 강의 링크: 
- 자료 링크: 

---

## 🏷️ 태그 & 메타정보

**태그**: #강의진도 #학습관리 #10분단위 #6분할시스템 #${subject}

**생성일**: ${date}  
**마지막 수정**: \`= this.file.mtime\`

---

> **💡 사용 팁**
> - 각 구간의 체크박스를 클릭하면 자동으로 진행률이 업데이트됩니다
> - 상단 진행률 바는 실시간으로 반영됩니다
> - AI 분석은 자동으로 진행 상황에 맞춰 조언을 제공합니다
> - 프론트매터의 startTime과 endTime을 기록하면 더 정확한 통계를 볼 수 있습니다
`;

        try {
            // 폴더 생성
            const folderPath = this.settings.learningFolder;
            const folder = this.app.vault.getAbstractFileByPath(folderPath);
            if (!folder) {
                await this.app.vault.createFolder(folderPath);
            }

            // 파일 생성
            const fileName = `${title}_${date}.md`;
            const filePath = `${folderPath}/${fileName}`;
            
            await this.app.vault.create(filePath, content);
            
            // 생성된 파일 열기
            const file = this.app.vault.getAbstractFileByPath(filePath);
            if (file) {
                const leaf = this.app.workspace.getLeaf();
                await leaf.openFile(file);
            }
            
            new Notice(`✅ 10분 단위 학습 노트 생성 완료: ${title}`);
            
    async generatePageBlockSystem(data) {
        const { bookTitle, totalPages, pageUnit } = data;
        const totalBlocks = Math.ceil(totalPages / pageUnit);
        
        const masterDashboard = `---
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
const totalPages = ${totalPages};
const pageUnit = ${pageUnit};
const totalBlocks = ${totalBlocks};

// 블록 파일들 찾기
const blockFiles = dv.pages('"${this.settings.progressFolder}"')
    .where(p => p.type === 'page-block' && p.bookTitle === bookTitle);

const completedBlocks = blockFiles.where(p => p.completed === true).length;
const inProgressBlocks = blockFiles.where(p => p.progress > 0 && p.completed !== true).length;
const notStartedBlocks = totalBlocks - completedBlocks - inProgressBlocks;

const overallProgress = Math.round((completedBlocks / totalBlocks) * 100);

// 진행 바 생성
const progressBar = "▓".repeat(Math.floor(completedBlocks)) + 
                   "▒".repeat(Math.floor(inProgressBlocks)) + 
                   "░".repeat(totalBlocks - Math.floor(completedBlocks) - Math.floor(inProgressBlocks));

dv.container.innerHTML = \`
<div style="
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 2rem;
    border-radius: 15px;
    margin: 1rem 0 2rem 0;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
">
    <div style="text-align: center; margin-bottom: 2rem;">
        <h1 style="margin: 0 0 0.5rem 0; font-size: 2.5rem;">📖 페이지 진도 관리</h1>
        <p style="margin: 0; font-size: 1.1rem; opacity: 0.9;">교재 페이지 기반 체계적 학습 진도 추적</p>
    </div>

    <div style="
        background: rgba(255, 255, 255, 0.95);
        color: #333;
        padding: 1.5rem;
        border-radius: 12px;
        margin-bottom: 1.5rem;
    ">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <span style="font-size: 1.3rem; font-weight: 600;">\${bookTitle} 진행률</span>
            <span style="font-size: 2rem; font-weight: bold; color: \${overallProgress === 100 ? '#28a745' : '#667eea'};">
                \${overallProgress}%
            </span>
        </div>
        
        <div style="
            height: 12px;
            background: #e9ecef;
            border-radius: 6px;
            overflow: hidden;
            margin-bottom: 1rem;
        ">
            <div style="
                height: 100%;
                background: linear-gradient(90deg, #28a745 0%, #20c997 100%);
                width: \${overallProgress}%;
                transition: width 0.5s ease;
            "></div>
        </div>
        
        <div style="display: flex; justify-content: space-between; font-size: 1rem;">
            <span>📊 \${completedBlocks} / \${totalBlocks} 블록 완료</span>
            <span>📄 총 \${totalPages} 페이지</span>
        </div>
        
        <div style="
            margin-top: 1rem;
            padding: 0.8rem;
            background: #f8f9fa;
            border-radius: 8px;
            font-size: 1.5rem;
            text-align: center;
            letter-spacing: 0.5rem;
            font-family: monospace;
        ">
            \${progressBar}
        </div>
    </div>

    <div style="
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 1rem;
        margin-bottom: 1rem;
    ">
        <div style="
            background: rgba(255, 255, 255, 0.1);
            padding: 1rem;
            border-radius: 8px;
            text-align: center;
        ">
            <div style="font-size: 2rem; font-weight: bold;">\${totalBlocks}</div>
            <div style="font-size: 0.9rem; opacity: 0.9;">총 블록</div>
        </div>
        
        <div style="
            background: rgba(40, 167, 69, 0.2);
            padding: 1rem;
            border-radius: 8px;
            text-align: center;
        ">
            <div style="font-size: 2rem; font-weight: bold;">\${completedBlocks}</div>
            <div style="font-size: 0.9rem; opacity: 0.9;">완료</div>
        </div>
        
        <div style="
            background: rgba(255, 193, 7, 0.2);
            padding: 1rem;
            border-radius: 8px;
            text-align: center;
        ">
            <div style="font-size: 2rem; font-weight: bold;">\${inProgressBlocks}</div>
            <div style="font-size: 0.9rem; opacity: 0.9;">진행중</div>
        </div>
        
        <div style="
            background: rgba(108, 117, 125, 0.2);
            padding: 1rem;
            border-radius: 8px;
            text-align: center;
        ">
            <div style="font-size: 2rem; font-weight: bold;">\${notStartedBlocks}</div>
            <div style="font-size: 0.9rem; opacity: 0.9;">남은 블록</div>
        </div>
    </div>
</div>
\`;
\`\`\`

---

## 📚 블록별 진도 관리

\`\`\`dataviewjs
const bookTitle = "${bookTitle}";
const totalPages = ${totalPages};
const pageUnit = ${pageUnit};
const totalBlocks = ${totalBlocks};

// 블록 파일들 찾기
const blockFiles = dv.pages('"${this.settings.progressFolder}"')
    .where(p => p.type === 'page-block' && p.bookTitle === bookTitle)
    .sort(p => p.blockNumber);

let html = \`
<div style="
    background: white;
    padding: 2rem;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
    margin-bottom: 2rem;
">
    <h2 style="margin: 0 0 1.5rem 0; color: #333;">📚 블록별 진도 관리</h2>
    <div style="
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 1.5rem;
    ">
\`;

// 각 블록 정보 생성
for (let i = 1; i <= totalBlocks; i++) {
    const startPage = (i - 1) * pageUnit + 1;
    const endPage = Math.min(i * pageUnit, totalPages);
    const blockFile = blockFiles.find(f => f.blockNumber === i);
    
    let status = "pending";
    let statusIcon = "⭕";
    let statusColor = "#6c757d";
    let bgGradient = "white";
    let progress = 0;
    
    if (blockFile) {
        if (blockFile.completed) {
            status = "completed";
            statusIcon = "✅";
            statusColor = "#28a745";
            bgGradient = "linear-gradient(135deg, #f8fff8 0%, #e8f5e8 100%)";
            progress = 100;
        } else if (blockFile.progress > 0) {
            status = "active";
            statusIcon = "🔄";
            statusColor = "#ffc107";
            bgGradient = "linear-gradient(135deg, #fff8e1 0%, #fff3c4 100%)";
            progress = blockFile.progress || 0;
        }
    }
    
    const blockTitle = blockFile ? \`[\${blockFile.file.name}](\${blockFile.file.path})\` : \`블록 \${i}\`;
    
    html += \`
        <div style="
            background: \${bgGradient};
            border-radius: 12px;
            padding: 1.5rem;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
            cursor: pointer;
            transition: all 0.3s;
            border-left: 4px solid \${statusColor};
        " onmouseover="this.style.transform='translateY(-3px)'; this.style.boxShadow='0 8px 30px rgba(0, 0, 0, 0.15)';" 
           onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 20px rgba(0, 0, 0, 0.1)';">
            
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <span style="font-weight: 600; color: #333;">\${blockTitle}</span>
                <span style="font-size: 1.5rem;">\${statusIcon}</span>
            </div>
            
            <div style="color: #666; margin-bottom: 1rem; font-size: 0.9rem;">
                📄 \${startPage}-\${endPage}p (\${endPage - startPage + 1}페이지)
            </div>
            
            <div style="
                height: 6px;
                background: #e9ecef;
                border-radius: 3px;
                overflow: hidden;
                margin-bottom: 1rem;
            ">
                <div style="
                    height: 100%;
                    background: linear-gradient(90deg, #28a745 0%, #20c997 100%);
                    width: \${progress}%;
                    transition: width 0.3s;
                "></div>
            </div>
            
            <div style="
                display: grid;
                grid-template-columns: repeat(6, 1fr);
                gap: 0.3rem;
            ">
\`;
    
    // 시간 세그먼트 (6개)
    for (let j = 0; j < 6; j++) {
        let segmentClass = "pending";
        let segmentColor = "#e9ecef";
        
        if (blockFile && blockFile.segments && blockFile.segments[j]) {
            segmentClass = "completed";
            segmentColor = "#28a745";
        } else if (status === "active" && j === (blockFile?.currentSegment || 0)) {
            segmentClass = "active";
            segmentColor = "#ffc107";
        }
        
        html += \`
            <div style="
                height: 8px;
                background: \${segmentColor};
                border-radius: 4px;
                transition: all 0.3s;
                \${segmentClass === 'active' ? 'animation: pulse 1.5s infinite;' : ''}
            "></div>
        \`;
    }
    
    html += \`
            </div>
        </div>
    \`;
}

html += \`
    </div>
</div>

<style>
@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
}
</style>
\`;

dv.container.innerHTML = html;
\`\`\`

---

## ⚙️ 시스템 관리

### 📊 새 블록 생성
- 블록 범위: 1-${totalBlocks}번
- 페이지 단위: ${pageUnit}페이지씩
- 총 페이지: ${totalPages}페이지

### 🔧 설정
- **교재명**: ${bookTitle}
- **분할 방식**: ${pageUnit}페이지 단위
- **총 블록**: ${totalBlocks}개

---

## 🏷️ 메타정보

**생성일**: \`= this.file.ctime\`  
**마지막 수정**: \`= this.file.mtime\`

**태그**: #페이지진도 #마스터대시보드 #${bookTitle.replace(/\s+/g, '')}

---

> **💡 사용 팁**
> - 각 블록을 클릭하면 해당 블록의 상세 페이지로 이동합니다
> - 새 블록을 생성하려면 플러그인의 "페이지 블록 생성" 명령을 사용하세요
> - 진행률은 각 블록의 상태에 따라 자동으로 업데이트됩니다
`;

        try {
            // 진도 폴더 생성
            const folderPath = this.settings.progressFolder;
            const folder = this.app.vault.getAbstractFileByPath(folderPath);
            if (!folder) {
                await this.app.vault.createFolder(folderPath);
            }

            // 마스터 대시보드 파일 생성
            const masterFileName = `🎯 마스터 대시보드.md`;
            const masterFilePath = `${folderPath}/${masterFileName}`;
            
            await this.app.vault.create(masterFilePath, masterDashboard);
            
            // 개별 블록 파일들 생성
            for (let i = 1; i <= totalBlocks; i++) {
                const startPage = (i - 1) * pageUnit + 1;
                const endPage = Math.min(i * pageUnit, totalPages);
                
                const blockContent = this.generateBlockContent(bookTitle, i, startPage, endPage, pageUnit);
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

// ========================================
// 대시보드 모달 클래스
// ========================================

class ProgressDashboardModal extends Modal {
    constructor(app) {
        super(app);
        this.data = {
            folders: [
                { name: '직류회로', blocks: 3, time: 4320 },
                { name: '교류회로', blocks: 2, time: 2700 },
                { name: '변압기', blocks: 2, time: 2220 },
                { name: '전동기', blocks: 1, time: 0 }
            ],
            blocks: [
                { id: 1, folder: '직류회로', name: 'Chapter 1', start: 1, end: 20, segments: [true, true, true, false, false, false], time: 2040 },
                { id: 2, folder: '교류회로', name: 'Chapter 2', start: 21, end: 40, segments: [true, true, false, false, false, false], time: 1380 },
                { id: 3, folder: '변압기', name: 'Chapter 3', start: 41, end: 60, segments: [false, false, false, false, false, false], time: 0 }
            ],
            currentStudy: null,
            studyHistory: [
                { folder: '교류회로', block: 'Chapter 2', pages: '21-40p', segment: 3, time: 1380, timestamp: Date.now() - 900000 },
                { folder: '직류회로', block: 'Chapter 1', pages: '1-20p', segment: 3, time: 2040, timestamp: Date.now() - 7200000 },
                { folder: '변압기', block: 'Chapter 3', pages: '41-60p', segment: 2, time: 1680, timestamp: Date.now() - 86400000 }
            ]
        };
        this.timerInterval = null;
        this.timerStartTime = null;
        this.timerElapsed = 0;
        this.isPaused = false;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        contentEl.addClass('page-progress-dashboard');
        
        // 제목
        contentEl.createEl('h2', { text: '📚 페이지 진도 관리 시스템' });
        
        this.renderDashboard();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
        
        // 타이머 정리
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }
    }

    renderDashboard() {
        const { contentEl } = this;
        
        // 기존 대시보드 내용 제거 (제목 제외)
        const children = Array.from(contentEl.children);
        children.slice(1).forEach(child => child.remove());
        
        // 대시보드 컨테이너
        const dashboardContainer = contentEl.createDiv({ cls: 'dashboard-container' });
        
        this.renderFolders(dashboardContainer);
        this.renderBlocks(dashboardContainer);
        this.renderTimer(dashboardContainer);
        this.renderHistory(dashboardContainer);
        
        this.addStyles();
    }

    renderFolders(container) {
        const foldersSection = container.createDiv({ cls: 'folders-section' });
        foldersSection.createEl('h3', { text: '📁 과목별 진도' });
        
        const foldersGrid = foldersSection.createDiv({ cls: 'folders-grid' });
        
        this.data.folders.forEach(folder => {
            const folderCard = foldersGrid.createDiv({ cls: 'folder-card' });
            
            folderCard.createEl('h4', { text: folder.name });
            folderCard.createEl('p', { text: `블록: ${folder.blocks}개` });
            folderCard.createEl('p', { text: `학습시간: ${this.formatTime(folder.time)}` });
            
            const progressBar = folderCard.createDiv({ cls: 'progress-bar' });
            const progressFill = progressBar.createDiv({ cls: 'progress-fill' });
            
            // 진도율 계산 (임시로 랜덤)
            const progress = Math.min(folder.blocks * 20, 100);
            progressFill.style.width = `${progress}%`;
            
            folderCard.createEl('p', { text: `진도: ${progress}%` });
        });
    }

    renderBlocks(container) {
        const blocksSection = container.createDiv({ cls: 'blocks-section' });
        blocksSection.createEl('h3', { text: '📖 블록별 상세' });
        
        const blocksList = blocksSection.createDiv({ cls: 'blocks-list' });
        
        this.data.blocks.forEach(block => {
            const blockCard = blocksList.createDiv({ cls: 'block-card' });
            
            blockCard.createEl('h4', { text: `${block.folder} - ${block.name}` });
            blockCard.createEl('p', { text: `페이지: ${block.start}-${block.end}` });
            blockCard.createEl('p', { text: `학습시간: ${this.formatTime(block.time)}` });
            
            // 세그먼트 표시
            const segmentsDiv = blockCard.createDiv({ cls: 'segments' });
            block.segments.forEach((completed, index) => {
                const segment = segmentsDiv.createDiv({ 
                    cls: `segment ${completed ? 'completed' : 'pending'}` 
                });
                segment.textContent = index + 1;
                
                segment.addEventListener('click', () => {
                    this.toggleSegment(block.id, index);
                });
            });
            
            // 학습 시작 버튼
            const startBtn = blockCard.createEl('button', { 
                text: '📚 학습 시작',
                cls: 'start-study-btn'
            });
            
            startBtn.addEventListener('click', () => {
                this.startStudy(block);
            });
        });
    }

    renderTimer(container) {
        const timerSection = container.createDiv({ cls: 'timer-section' });
        timerSection.createEl('h3', { text: '⏱️ 학습 타이머' });
        
        const timerDisplay = timerSection.createDiv({ cls: 'timer-display' });
        this.timerDisplayEl = timerDisplay.createEl('div', { 
            text: this.formatTime(this.timerElapsed),
            cls: 'timer-time'
        });
        
        const timerControls = timerSection.createDiv({ cls: 'timer-controls' });
        
        this.startPauseBtn = timerControls.createEl('button', { 
            text: this.timerInterval ? '⏸️ 일시정지' : '▶️ 시작',
            cls: 'timer-btn start-pause'
        });
        
        const stopBtn = timerControls.createEl('button', { 
            text: '⏹️ 정지',
            cls: 'timer-btn stop'
        });
        
        this.startPauseBtn.addEventListener('click', () => {
            this.toggleTimer();
        });
        
        stopBtn.addEventListener('click', () => {
            this.stopTimer();
        });
        
        if (this.data.currentStudy) {
            const currentStudyDiv = timerSection.createDiv({ cls: 'current-study' });
            currentStudyDiv.createEl('p', { 
                text: `📖 현재 학습: ${this.data.currentStudy.folder} - ${this.data.currentStudy.name}` 
            });
        }
    }

    renderHistory(container) {
        const historySection = container.createDiv({ cls: 'history-section' });
        historySection.createEl('h3', { text: '📊 최근 학습 기록' });
        
        const historyList = historySection.createDiv({ cls: 'history-list' });
        
        this.data.studyHistory.slice(0, 5).forEach(record => {
            const historyItem = historyList.createDiv({ cls: 'history-item' });
            
            const date = new Date(record.timestamp);
            const timeAgo = this.getTimeAgo(date);
            
            historyItem.innerHTML = `
                <div class="history-info">
                    <strong>${record.folder}</strong> - ${record.pages}
                    <br>
                    <small>세그먼트 ${record.segment} | ${this.formatTime(record.time)} | ${timeAgo}</small>
                </div>
            `;
        });
    }

    // ========================================
    // 이벤트 핸들러들
    // ========================================

    toggleSegment(blockId, segmentIndex) {
        const block = this.data.blocks.find(b => b.id === blockId);
        if (block) {
            block.segments[segmentIndex] = !block.segments[segmentIndex];
            this.renderDashboard();
            new Notice(`세그먼트 ${segmentIndex + 1} ${block.segments[segmentIndex] ? '완료' : '미완료'} 처리`);
        }
    }

    startStudy(block) {
        this.data.currentStudy = block;
        this.timerElapsed = 0;
        this.timerStartTime = Date.now();
        this.isPaused = false;
        
        this.timerInterval = setInterval(() => {
            this.updateTimer();
        }, 1000);
        
        this.renderDashboard();
        new Notice(`📚 ${block.folder} - ${block.name} 학습 시작`);
    }

    toggleTimer() {
        if (this.timerInterval) {
            // 일시정지
            clearInterval(this.timerInterval);
            this.timerInterval = null;
            this.timerElapsed += Date.now() - this.timerStartTime;
            this.isPaused = true;
            this.startPauseBtn.textContent = '▶️ 시작';
        } else {
            // 시작/재개
            this.timerStartTime = Date.now();
            this.isPaused = false;
            this.timerInterval = setInterval(() => {
                this.updateTimer();
            }, 1000);
            this.startPauseBtn.textContent = '⏸️ 일시정지';
        }
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        
        if (this.data.currentStudy && this.timerElapsed > 0) {
            // 학습 기록 저장
            const totalTime = this.timerElapsed + (this.isPaused ? 0 : Date.now() - this.timerStartTime);
            
            this.data.studyHistory.unshift({
                folder: this.data.currentStudy.folder,
                block: this.data.currentStudy.name,
                pages: `${this.data.currentStudy.start}-${this.data.currentStudy.end}p`,
                segment: 1, // 임시
                time: totalTime,
                timestamp: Date.now()
            });
            
            // 블록 시간 업데이트
            this.data.currentStudy.time += totalTime;
            
            new Notice(`학습 완료! 총 ${this.formatTime(totalTime)} 학습했습니다.`);
        }
        
        this.data.currentStudy = null;
        this.timerElapsed = 0;
        this.isPaused = false;
        this.renderDashboard();
    }

    updateTimer() {
        if (!this.timerDisplayEl) return;
        
        const currentTime = this.isPaused ? this.timerElapsed : (this.timerElapsed + Date.now() - this.timerStartTime);
        this.timerDisplayEl.textContent = this.formatTime(currentTime);
    }

    // ========================================
    // 유틸리티 메소드들
    // ========================================

    formatTime(ms) {
        const hours = Math.floor(ms / 3600000);
        const minutes = Math.floor((ms % 3600000) / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);
        
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        } else {
            return `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
    }

    getTimeAgo(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffDays > 0) return `${diffDays}일 전`;
        if (diffHours > 0) return `${diffHours}시간 전`;
        if (diffMins > 0) return `${diffMins}분 전`;
        return '방금 전';
    }

    addStyles() {
        const styleEl = document.createElement('style');
        styleEl.id = 'page-progress-styles';
        
        if (document.getElementById('page-progress-styles')) {
            return; // 이미 추가된 경우
        }
        
        styleEl.textContent = `
            .page-progress-dashboard {
                padding: 20px;
                max-width: 1000px;
                margin: 0 auto;
            }
            
            .dashboard-container {
                display: grid;
                gap: 20px;
            }
            
            .folders-section, .blocks-section, .timer-section, .history-section {
                background: var(--background-secondary);
                padding: 20px;
                border-radius: 8px;
                border: 1px solid var(--background-modifier-border);
            }
            
            .folders-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: 15px;
                margin-top: 10px;
            }
            
            .folder-card, .block-card {
                background: var(--background-primary);
                padding: 15px;
                border-radius: 6px;
                border: 1px solid var(--background-modifier-border);
            }
            
            .folder-card h4, .block-card h4 {
                margin: 0 0 10px 0;
                color: var(--text-accent);
            }
            
            .progress-bar {
                width: 100%;
                height: 8px;
                background: var(--background-modifier-border);
                border-radius: 4px;
                overflow: hidden;
                margin: 10px 0;
            }
            
            .progress-fill {
                height: 100%;
                background: linear-gradient(90deg, #10b981, #059669);
                transition: width 0.3s ease;
            }
            
            .segments {
                display: flex;
                gap: 5px;
                margin: 10px 0;
            }
            
            .segment {
                width: 30px;
                height: 30px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                font-weight: bold;
                font-size: 12px;
                transition: all 0.2s ease;
            }
            
            .segment.completed {
                background: #10b981;
                color: white;
            }
            
            .segment.pending {
                background: var(--background-modifier-border);
                color: var(--text-muted);
            }
            
            .segment:hover {
                transform: scale(1.1);
            }
            
            .start-study-btn, .timer-btn {
                background: var(--interactive-accent);
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
                margin-top: 10px;
            }
            
            .start-study-btn:hover, .timer-btn:hover {
                background: var(--interactive-accent-hover);
            }
            
            .timer-display {
                text-align: center;
                margin: 20px 0;
            }
            
            .timer-time {
                font-size: 2.5em;
                font-weight: bold;
                color: var(--text-accent);
                font-family: 'Courier New', monospace;
            }
            
            .timer-controls {
                display: flex;
                gap: 10px;
                justify-content: center;
            }
            
            .current-study {
                background: var(--background-primary);
                padding: 10px;
                border-radius: 4px;
                margin-top: 15px;
                border-left: 4px solid var(--interactive-accent);
            }
            
            .history-list {
                max-height: 300px;
                overflow-y: auto;
            }
            
            .history-item {
                padding: 10px;
                border-bottom: 1px solid var(--background-modifier-border);
                background: var(--background-primary);
                margin-bottom: 5px;
                border-radius: 4px;
            }
            
            .history-info strong {
                color: var(--text-accent);
            }
            
            .history-info small {
                color: var(--text-muted);
            }
        `;
        
        document.head.appendChild(styleEl);
    }
}

module.exports = PageProgressManagerPlugin;