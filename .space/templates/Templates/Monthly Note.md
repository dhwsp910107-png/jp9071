---
month: <% tp.date.now("YYYY-MM") %>
year: <% tp.date.now("YYYY") %>
month-name: <% tp.date.now("MMMM") %>
tags:
  - monthly-note
  - <% tp.date.now("YYYY") %>
monthly-goals-completed: 0
monthly-goals-total: 10
total-lectures-completed: 0
total-study-hours: 0
total-review-sessions: 0
monthly-focus: ""
satisfaction-score: 0
---

# 📅 <% tp.date.now("YYYY년 M월") %> 월간 노트

## 🎯 월간 목표 & 비전

### 🌟 이달의 핵심 목표
- [ ] **목표 1**: 
- [ ] **목표 2**: 
- [ ] **목표 3**: 
- [ ] **목표 4**: 
- [ ] **목표 5**: 
- [ ] **목표 6**: 
- [ ] **목표 7**: 
- [ ] **목표 8**: 
- [ ] **목표 9**: 
- [ ] **목표 10**: 

**달성률**: `= this.monthly-goals-completed + "/" + this.monthly-goals-total + " (" + round(this.monthly-goals-completed/this.monthly-goals-total*100) + "%)"`

### 🎨 이달의 집중 분야
**포커스**: `= this.monthly-focus`

## 📊 월간 학습 분석

### 🎬 강의 학습 종합 현황
```dataviewjs
// 이번 달 강의 학습 종합 분석
const monthStart = dv.date('<% tp.date.now("YYYY-MM-01") %>');
const monthEnd = dv.date('<% tp.date.now("YYYY-MM-01") %>').plus({months: 1}).minus({days: 1});

const lectureFiles = dv.pages('#강의학습')
    .where(p => p["lecture-date"] && 
                dv.date(p["lecture-date"]) >= monthStart && 
                dv.date(p["lecture-date"]) <= monthEnd)
    .array();

if (lectureFiles.length > 0) {
    // 시리즈별 진행 현황
    const seriesMap = {};
    lectureFiles.forEach(lecture => {
        const series = lecture["lecture-series"] || "기타";
        if (!seriesMap[series]) {
            seriesMap[series] = { total: 0, completed: 0, inProgress: 0, totalMinutes: 0, difficulties: [] };
        }
        seriesMap[series].total++;
        seriesMap[series].totalMinutes += lecture["total-minutes"] || 0;
        
        if (lecture.status === "완료") seriesMap[series].completed++;
        if (lecture.status === "진행중") seriesMap[series].inProgress++;
        if (lecture.difficulty) seriesMap[series].difficulties.push(parseInt(lecture.difficulty));
    });
    
    dv.paragraph("### 📚 시리즈별 학습 현황");
    
    Object.entries(seriesMap).forEach(([series, stats]) => {
        const completionRate = Math.round((stats.completed / stats.total) * 100);
        const avgDifficulty = stats.difficulties.length > 0 
            ? (stats.difficulties.reduce((a, b) => a + b, 0) / stats.difficulties.length).toFixed(1)
            : "-";
        const studyTime = Math.floor(stats.totalMinutes / 60);
        
        dv.paragraph(`**${series}**`);
        dv.paragraph(`- 완료: ${stats.completed}/${stats.total} (${completionRate}%)`);
        dv.paragraph(`- 진행중: ${stats.inProgress}개`);
        dv.paragraph(`- 학습시간: ${studyTime}시간`);
        dv.paragraph(`- 평균 난이도: ${avgDifficulty !== "-" ? "⭐".repeat(Math.floor(avgDifficulty)) + ` ${avgDifficulty}` : "-"}`);
        dv.paragraph("");
    });
    
} else {
    dv.paragraph("이번 달 강의 학습 활동이 없습니다.");
}
```

## 🏆 월간 성과 & 마일스톤

### 🎉 주요 성취사항
- 

### 📈 성장 포인트
- 

### 💡 배운 교훈들
- 

## 🎯 다음 달 계획

### 🚀 다음 달 목표
- 

### 📚 학습 계획
- 

## 🔗 연결된 노트들
- **지난 달**: [[<% tp.date.now("YYYY-MM", "P-1M") %>]]
- **다음 달**: [[<% tp.date.now("YYYY-MM", "P1M") %>]]
- **올해**: [[<% tp.date.now("YYYY") %>]]

## 📊 월간 대시보드
```dataviewjs
// 월간 종합 성과 대시보드
const currentMonth = '<% tp.date.now("YYYY-MM") %>';
const file = dv.page(`Monthly Notes/${currentMonth}`);

if (file) {
    const goalsProgress = file["monthly-goals-completed"] || 0;
    const goalsTotal = file["monthly-goals-total"] || 10;
    const lecturesCompleted = file["total-lectures-completed"] || 0;
    const studyHours = file["total-study-hours"] || 0;
    const satisfaction = file["satisfaction-score"] || 0;
    
    // 월간 성과 시각화
    dv.paragraph(`### 🎯 월간 성과 요약`);
    dv.paragraph(`**목표 달성률**: ${Math.round((goalsProgress/goalsTotal)*100)}%`);
    dv.paragraph(`**완료 강의**: ${lecturesCompleted}개`);
    dv.paragraph(`**총 학습 시간**: ${studyHours}시간`);
    dv.paragraph(`**만족도**: ${satisfaction}/100`);
    
    // 월간 진행바
    const progressBar = "▓".repeat(Math.floor((goalsProgress/goalsTotal)*10)) + "░".repeat(10-Math.floor((goalsProgress/goalsTotal)*10));
    dv.paragraph(`**월간 진행률**: ${progressBar}`);
}
```

---
*📅 생성일: <% tp.date.now("YYYY-MM-DD HH:mm") %> | 📝 마지막 수정: `=date(now)`*
