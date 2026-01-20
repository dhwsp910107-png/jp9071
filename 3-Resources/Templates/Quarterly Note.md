---
quarter: <% tp.date.now("YYYY-[Q]Q") %>
year: <% tp.date.now("YYYY") %>
quarter-start: <% tp.date.now("YYYY-") %><% tp.date.now("Q") == "1" ? "01-01" : tp.date.now("Q") == "2" ? "04-01" : tp.date.now("Q") == "3" ? "07-01" : "10-01" %>
quarter-end: <% tp.date.now("Q") == "1" ? tp.date.now("YYYY-03-31") : tp.date.now("Q") == "2" ? tp.date.now("YYYY-06-30") : tp.date.now("Q") == "3" ? tp.date.now("YYYY-09-30") : tp.date.now("YYYY-12-31") %>
tags:
  - quarterly-note
  - <% tp.date.now("YYYY") %>
quarterly-goals-completed: 0
quarterly-goals-total: 15
major-projects-completed: 0
skill-development-score: 0
quarterly-theme: ""
---

# 📅 <% tp.date.now("YYYY년 Q분기") %> 분기별 노트

## 🎯 분기별 전략 & 목표

### 🌟 분기 핵심 테마
**이번 분기 주제**: `= this.quarterly-theme`

### 🚀 분기 주요 목표 (OKR)
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
- [ ] **목표 11**: 
- [ ] **목표 12**: 
- [ ] **목표 13**: 
- [ ] **목표 14**: 
- [ ] **목표 15**: 

**달성률**: `= this.quarterly-goals-completed + "/" + this.quarterly-goals-total + " (" + round(this.quarterly-goals-completed/this.quarterly-goals-total*100) + "%)"`

## 📊 분기별 학습 분석

### 🎬 강의 학습 마스터리 현황
```dataviewjs
// 분기별 강의 학습 종합 분석
const quarterStart = dv.date('<% tp.date.now("Q") == "1" ? tp.date.now("YYYY-01-01") : tp.date.now("Q") == "2" ? tp.date.now("YYYY-04-01") : tp.date.now("Q") == "3" ? tp.date.now("YYYY-07-01") : tp.date.now("YYYY-10-01") %>');
const quarterEnd = dv.date('<% tp.date.now("Q") == "1" ? tp.date.now("YYYY-03-31") : tp.date.now("Q") == "2" ? tp.date.now("YYYY-06-30") : tp.date.now("Q") == "3" ? tp.date.now("YYYY-09-30") : tp.date.now("YYYY-12-31") %>');

const lectureFiles = dv.pages('#강의학습')
    .where(p => p["lecture-date"] && 
                dv.date(p["lecture-date"]) >= quarterStart && 
                dv.date(p["lecture-date"]) <= quarterEnd)
    .array();

if (lectureFiles.length > 0) {
    // 분기별 심화 분석
    const completedLectures = lectureFiles.filter(l => l.status === "완료");
    const totalMinutes = lectureFiles.reduce((sum, l) => sum + (l["total-minutes"] || 0), 0);
    const totalReviews = lectureFiles.reduce((sum, l) => sum + (parseInt(l["review-count"]) || 0), 0);
    
    // 기술 스택별 분류
    const techStackMap = {};
    completedLectures.forEach(lecture => {
        const series = lecture["lecture-series"] || "기타";
        // 기술 스택 추출 (시리즈명에서)
        let techStack = "기타";
        if (series.toLowerCase().includes("react")) techStack = "React";
        else if (series.toLowerCase().includes("javascript")) techStack = "JavaScript";
        else if (series.toLowerCase().includes("python")) techStack = "Python";
        else if (series.toLowerCase().includes("node")) techStack = "Node.js";
        else if (series.toLowerCase().includes("css")) techStack = "CSS";
        else if (series.toLowerCase().includes("html")) techStack = "HTML";
        
        if (!techStackMap[techStack]) {
            techStackMap[techStack] = { count: 0, hours: 0, avgDifficulty: 0, difficulties: [] };
        }
        techStackMap[techStack].count++;
        techStackMap[techStack].hours += (lecture["total-minutes"] || 0) / 60;
        if (lecture.difficulty) techStackMap[techStack].difficulties.push(parseInt(lecture.difficulty));
    });
    
    dv.paragraph("### 💻 기술 스택별 마스터리");
    Object.entries(techStackMap).forEach(([tech, stats]) => {
        const avgDiff = stats.difficulties.length > 0 
            ? (stats.difficulties.reduce((a, b) => a + b, 0) / stats.difficulties.length).toFixed(1)
            : "-";
        
        dv.paragraph(`**${tech}**`);
        dv.paragraph(`- 완료 강의: ${stats.count}개`);
        dv.paragraph(`- 학습 시간: ${Math.round(stats.hours)}시간`);
        dv.paragraph(`- 평균 난이도: ${avgDiff !== "-" ? "⭐".repeat(Math.floor(avgDiff)) + ` ${avgDiff}` : "-"}`);
        dv.paragraph("");
    });
    
    // 분기 종합 통계
    dv.paragraph("### 📈 분기 학습 성과");
    dv.paragraph(`- **총 강의 수**: ${lectureFiles.length}개`);
    dv.paragraph(`- **완료 강의**: ${completedLectures.length}개`);
    dv.paragraph(`- **완주율**: ${Math.round((completedLectures.length/lectureFiles.length)*100)}%`);
    dv.paragraph(`- **총 학습 시간**: ${Math.floor(totalMinutes/60)}시간`);
    dv.paragraph(`- **일평균 학습**: ${Math.round(totalMinutes/90)}분`);
    dv.paragraph(`- **총 복습 횟수**: ${totalReviews}회`);
    
} else {
    dv.paragraph("이번 분기 강의 학습 활동이 없습니다.");
}
```

### 📅 월별 진행 현황
```dataviewjs
// 분기별 월별 분석
const quarter = '<% tp.date.now("Q") %>';
const year = '<% tp.date.now("YYYY") %>';
const months = [];

if (quarter === "1") months.push(`${year}-01`, `${year}-02`, `${year}-03`);
else if (quarter === "2") months.push(`${year}-04`, `${year}-05`, `${year}-06`);
else if (quarter === "3") months.push(`${year}-07`, `${year}-08`, `${year}-09`);
else months.push(`${year}-10`, `${year}-11`, `${year}-12`);

dv.paragraph("### 📊 월별 성과 비교");

months.forEach(month => {
    const monthFile = dv.page(`Monthly Notes/${month}`);
    if (monthFile) {
        const goals = monthFile["monthly-goals-completed"] || 0;
        const totalGoals = monthFile["monthly-goals-total"] || 10;
        const lectures = monthFile["total-lectures-completed"] || 0;
        const studyHours = monthFile["total-study-hours"] || 0;
        const satisfaction = monthFile["satisfaction-score"] || 0;
        
        dv.paragraph(`- **${month}**: [[${month}]] - 목표 ${goals}/${totalGoals} (${Math.round(goals/totalGoals*100)}%), ${lectures}강의, ${studyHours}h, 만족도 ${satisfaction}`);
    } else {
        dv.paragraph(`- **${month}**: [[${month}]] - 미작성`);
    }
});
```

## 🏆 분기별 프로젝트 & 성과

### 🚀 주요 프로젝트 완료 현황
**완료 프로젝트**: `= this.major-projects-completed + "개"`

### 🎯 핵심 성취사항
- 

### 📈 스킬 발전 현황
**스킬 개발 점수**: `= this.skill-development-score + "/100"`

### 💎 마스터한 기술들
- 

## 📝 분기별 심층 회고

### 💪 가장 자랑스러운 성과
- 

### 🤔 가장 어려웠던 도전
- 

### 💡 핵심 인사이트 & 교훈
- 

### 🔄 다음 분기 전략적 방향
- 

## 🎯 다음 분기 로드맵

### 🚀 차분기 핵심 목표
- 

### 📚 학습 로드맵
- 

### 🎨 새로운 도전 영역
- 

## 🔗 연결된 노트들
- **이전 분기**: [[<% tp.date.now("Q") == "1" ? (parseInt(tp.date.now("YYYY"))-1) + "-Q4" : tp.date.now("YYYY") + "-Q" + (parseInt(tp.date.now("Q"))-1) %>]]
- **다음 분기**: [[<% tp.date.now("Q") == "4" ? (parseInt(tp.date.now("YYYY"))+1) + "-Q1" : tp.date.now("YYYY") + "-Q" + (parseInt(tp.date.now("Q"))+1) %>]]
- **올해**: [[<% tp.date.now("YYYY") %>]]

## 📊 분기별 종합 대시보드
```dataviewjs
// 분기별 마스터 대시보드
const currentQuarter = '<% tp.date.now("YYYY-[Q]Q") %>';
const file = dv.page(`Quarterly Notes/${currentQuarter}`);

if (file) {
    const goalsProgress = file["quarterly-goals-completed"] || 0;
    const goalsTotal = file["quarterly-goals-total"] || 15;
    const projectsCompleted = file["major-projects-completed"] || 0;
    const skillScore = file["skill-development-score"] || 0;
    
    // 분기 성과 종합 평가
    dv.paragraph(`### 🏆 분기 성과 종합`);
    dv.paragraph(`**목표 달성률**: ${Math.round((goalsProgress/goalsTotal)*100)}%`);
    dv.paragraph(`**완료 프로젝트**: ${projectsCompleted}개`);
    dv.paragraph(`**스킬 개발**: ${skillScore}/100`);
    
    // 분기 등급 평가
    const overallScore = (goalsProgress/goalsTotal) * 0.5 + (skillScore/100) * 0.3 + (Math.min(projectsCompleted/3, 1)) * 0.2;
    let quarterGrade = "F";
    if (overallScore >= 0.9) quarterGrade = "S+";
    else if (overallScore >= 0.8) quarterGrade = "S";
    else if (overallScore >= 0.7) quarterGrade = "A";
    else if (overallScore >= 0.6) quarterGrade = "B";
    else if (overallScore >= 0.5) quarterGrade = "C";
    else if (overallScore >= 0.4) quarterGrade = "D";
    
    dv.paragraph(`**분기 등급**: ${quarterGrade}`);
    
    // 분기 진행바
    const progressBar = "▓".repeat(Math.floor(overallScore*10)) + "░".repeat(10-Math.floor(overallScore*10));
    dv.paragraph(`**종합 성과**: ${progressBar} (${Math.round(overallScore*100)}%)`);
}
```

---
*📅 생성일: <% tp.date.now("YYYY-MM-DD HH:mm") %> | 📝 마지막 수정: `=date(now)`*
