// ========== Part 1: 기본 설정 및 상수 ==========
// Study Dashboard v3 - 500문제 완성

const { Plugin, PluginSettingTab, Setting, ItemView, Notice, Modal, normalizePath, TFile } = require('obsidian');

// 기본 설정값
const DEFAULT_SETTINGS = {
    // 기본 폴더 설정
    problemsFolder: '학습관리/문제은행',
    templatesFolder: 'Templates',
    maxProblems: 500,
    
    // 학습 목표 설정
    dailyGoal: 5,
    targetDate: '2025-12-31',
    
    // 타이머 설정
    autoTimerStart: true,
    autoTimerSave: true,
    timerEnabled: true,
    stopwatchIntegration: true,
    
    // 과목 설정
    defaultSubject: '수학',
    subjects: ['수학', '물리', '화학', '생물', '영어', '국어', '한국사'],
    subjectColors: false,
    
    // 디스플레이 설정
    problemNumberDisplay: true,
    statsAnimation: true,
    masteredColor: '#10b981',
    reviewingColor: '#f59e0b',
    learningColor: '#ef4444',
    
    // 등급 기준 (초 단위)
    sGradeTime: 60,
    aGradeTime: 120,
    bGradeTime: 180,
    autoGradeCalculation: true,
    
    // 알림 설정
    reviewNotification: true,
    dailyGoalNotification: true
};

// 뷰 타입 상수
const VIEW_TYPE_STUDY_DASHBOARD = 'study-dashboard-view';

// 문제 상태 상수
const PROBLEM_STATUS = {
    LEARNING: 'learning',
    REVIEWING: 'reviewing', 
    MASTERED: 'mastered',
    EMPTY: 'empty'
};

// 과목별 기본 색상
const SUBJECT_COLORS = {
    '수학': '#3b82f6',
    '물리': '#8b5cf6', 
    '화학': '#10b981',
    '생물': '#f59e0b',
    '영어': '#ef4444',
    '국어': '#84cc16',
    '한국사': '#f97316'
};

// 등급 기준 
const GRADE_CRITERIA = {
    S: { max: 60, color: '#fbbf24', emoji: '🥇' },
    A: { max: 120, color: '#10b981', emoji: '⭐' },
    B: { max: 180, color: '#3b82f6', emoji: '✅' },
    C: { max: 300, color: '#f59e0b', emoji: '⚠️' },
    D: { max: Infinity, color: '#ef4444', emoji: '🔴' }
};

// 문제 템플릿
const PROBLEM_TEMPLATE = (number, title, subject, difficulty) => {
    const today = new Date().toISOString().split('T')[0];
    const nextDay = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    
    return `---
number: ${number}
title: "${title}"
subject: ${subject}
chapter: ""
source: ""
page: ""
concept-tags: []
status: learning
difficulty: ${difficulty}
reviewCount: 0
lastReview: ${today}
nextReview: ${nextDay}
created: ${today}
avgTime: 0
totalTime: 0
studyTime: 0
times: []
attempts: []
grades: []
tags: [anki-card, ${subject}, stopwatch, study-dashboard]
type: image-flashcard
---

# ${number}. ${title}

> 📚 **출처**: (출처명) (페이지)  
> 📖 **단원**: ${subject}  
> ⭐ **난이도**: ${difficulty}/5

---

## ⏱️ 문제 풀이 타이머

\`\`\`stopwatch
title: "${subject} ${number}번 - ${title}"
showMilliseconds: true
autoStart: false
theme: purple
\`\`\`

> 💡 **타이머 사용법**: 
> - ▶️ **시작**: 문제 풀이를 시작할 때 클릭
> - ⏸️ **일시정지**: 잠시 멈출 때 클릭 (이어서 계속 가능)
> - ⏹️ **정지**: 문제를 완전히 끝냈을 때 클릭 (자동 시간 기록)
> - 🔄 **초기화**: 처음부터 다시 시작

---

## 📸 문제

> [!info]+ 🖼️ 문제 이미지
> 
> <!-- QuickAdd나 직접 붙여넣기로 문제 이미지 추가 -->
> 
> 여기에 문제 이미지를 붙여넣거나 ![[이미지명.png]] 형식으로 추가하세요

---

## 💡 힌트

> [!hint]- 💡 힌트 보기 (클릭해서 펼치기)
> 
> <!-- QuickAdd나 직접 붙여넣기로 힌트 이미지 추가 -->
> 
> 힌트 내용을 여기에 작성...

---

## ✅ 정답 및 풀이

> [!success]- 🔍 **정답 보기** (문제를 다 푼 후 클릭)
> 
> **정답:** 
> 
> **풀이:**
> 
> <!-- QuickAdd나 직접 붙여넣기로 정답 이미지 추가 -->

---

## 📝 메모 및 오답노트

> [!note]- 📝 **개인 메모** (실수한 부분, 기억할 점 등)
> 
> - 
> - 
> - 

---

## 📊 풀이 기록

\`\`\`dataviewjs
const file = dv.current();

if (file.times && file.times.length > 0) {
    const times = file.times;
    const avgTime = Math.floor(times.reduce((a,b) => a+b, 0) / times.length);
    
    const formatTime = (seconds) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        if (h > 0) return \`\${h}시간 \${m}분 \${s}초\`;
        if (m > 0) return \`\${m}분 \${s}초\`;
        return \`\${s}초\`;
    };
    
    const lastTime = times[times.length - 1];
    
    dv.paragraph(\`
📊 **풀이 통계**
- 🔢 총 풀이 횟수: \${times.length}회
- ⏱️ 평균 시간: \${formatTime(avgTime)}
- 📅 최근 풀이: \${formatTime(lastTime)}
- 📈 총 학습 시간: \${formatTime(file.studyTime || 0)}

**전체 기록**: \${times.map(t => formatTime(t)).join(', ')}
    \`);
} else {
    dv.paragraph(\`
📊 **아직 풀이 기록이 없습니다.**
- 위의 타이머를 사용하여 문제를 풀어보세요!
    \`);
}
\`\`\`

---

## 🎯 복습 일정

> [!todo]- 📅 **복습 체크리스트**
> 
> - [ ] 1일 후 복습 (${nextDay})
> - [ ] 3일 후 복습 (${new Date(Date.now() + 3*24*60*60*1000).toISOString().split('T')[0]})
> - [ ] 1주 후 복습 (${new Date(Date.now() + 7*24*60*60*1000).toISOString().split('T')[0]})
> - [ ] 2주 후 복습 (${new Date(Date.now() + 14*24*60*60*1000).toISOString().split('T')[0]})

---

## 📋 복습 기록

| 날짜 | 결과 | 시간 | 메모 |
|------|------|------|------|
| ${today} | ⬜ Again / ⬜ Hard / ⬜ Good / ⬜ Easy | - |  |

\`\`\`dataviewjs
const file = dv.current();
const bar = (val, max) => {
    const filled = Math.floor((val / max) * 20);
    return '█'.repeat(filled) + '░'.repeat(20 - filled);
};

dv.paragraph(\`
**복습 진행률**: \${bar(file.reviewCount, 10)} \${file.reviewCount}/10회
**상태**: \${file.status === 'learning' ? '🔴 학습중' : file.status === 'reviewing' ? '🟡 복습중' : '🟢 완전숙달'}
**총 학습시간**: \${Math.floor((file.totalTime || 0) / 60)}분 \${(file.totalTime || 0) % 60}초
\`);
\`\`\`

---

## 💭 학습 노트

### ⚠️ 주의할 점
- 

### 🔑 핵심 포인트
- 

---

*⏱️ Stopwatch Timer로 측정한 시간이 자동으로 \`times\` 배열에 기록됩니다!*

*📊 Dashboard에서 실시간 통계를 확인하세요!*

*📸 직접 이미지를 붙여넣거나 ![[이미지명.png]] 형식으로 추가하세요!*
`;
};

// 헬퍼 함수들
const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

const calculateGrade = (timeInSeconds) => {
    for (const [grade, criteria] of Object.entries(GRADE_CRITERIA)) {
        if (timeInSeconds <= criteria.max) {
            return { grade, ...criteria };
        }
    }
    return { grade: 'D', ...GRADE_CRITERIA.D };
};

const getStatusColor = (status) => {
    switch (status) {
        case PROBLEM_STATUS.MASTERED: return '#10b981';
        case PROBLEM_STATUS.REVIEWING: return '#f59e0b';
        case PROBLEM_STATUS.LEARNING: return '#ef4444';
        default: return '#6b7280';
    }
};

const getStatusText = (status) => {
    switch (status) {
        case PROBLEM_STATUS.MASTERED: return '완전 숙달 ✅';
        case PROBLEM_STATUS.REVIEWING: return '복습 중 📝';
        case PROBLEM_STATUS.LEARNING: return '학습 중 🔥';
        default: return '미작성';
    }
};

// Part 1 완료 - 기본 설정 및 상수 정의 완료
console.log('📚 Part 1: 기본 설정 및 상수 로드 완료');