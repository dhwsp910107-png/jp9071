---
year: <% tp.date.now("YYYY") %>
theme: ""
vision: ""
tags:
  - yearly-note
  - <% tp.date.now("YYYY") %>
yearly-goals-completed: 0
yearly-goals-total: 20
life-changing-moments: 0
major-skills-mastered: 0
books-read: 0
courses-completed: 0
projects-launched: 0
yearly-satisfaction: 0
---

# 📅 <% tp.date.now("YYYY년") %> 연간 회고 & 계획

## 🌟 올해의 비전 & 테마

### 🎯 연간 핵심 비전
**올해의 비전**: `= this.vision`

### 🎨 연간 테마
**올해의 주제**: `= this.theme`

### 🚀 연간 핵심 목표 (20개)
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
- [ ] **목표 16**: 
- [ ] **목표 17**: 
- [ ] **목표 18**: 
- [ ] **목표 19**: 
- [ ] **목표 20**: 

**달성률**: `= this.yearly-goals-completed + "/" + this.yearly-goals-total + " (" + round(this.yearly-goals-completed/this.yearly-goals-total*100) + "%)"`

## 📊 연간 학습 마스터리 분석

### 🎬 연간 강의 학습 통계
```dataviewjs
// 연간 강의 학습 마스터 분석
const year = '<% tp.date.now("YYYY") %>';
const lectureFiles = dv.pages('#강의학습')
    .where(p => p["lecture-date"] && p["lecture-date"].includes(year))
    .array();

if (lectureFiles.length > 0) {
    const completedLectures = lectureFiles.filter(l => l.status === "완료");
    const totalMinutes = completedLectures.reduce((sum, l) => sum + (l["total-minutes"] || 0), 0);
    
    dv.paragraph("### 📈 연간 학습 성과 요약");
    dv.paragraph(`- **총 등록 강의**: ${lectureFiles.length}개`);
    dv.paragraph(`- **완료 강의**: ${completedLectures.length}개`);
    dv.paragraph(`- **완주율**: ${Math.round((completedLectures.length/lectureFiles.length)*100)}%`);
    dv.paragraph(`- **총 학습 시간**: ${Math.floor(totalMinutes/60)}시간`);
    
} else {
    dv.paragraph("올해 강의 학습 활동이 없습니다.");
}
```

## 🏆 연간 핵심 성과

### 📚 학습 & 성장 지표
- **완료 강의**: `= this.courses-completed + "개"`
- **마스터 스킬**: `= this.major-skills-mastered + "개"`
- **읽은 책**: `= this.books-read + "권"`

### 🚀 프로젝트 & 창작
- **런칭 프로젝트**: `= this.projects-launched + "개"`
- **인생 변화 순간**: `= this.life-changing-moments + "회"`

## 📅 분기별 하이라이트
```dataviewjs
// 연간 분기별 성과 비교
const year = '<% tp.date.now("YYYY") %>';
const quarters = [`${year}-Q1`, `${year}-Q2`, `${year}-Q3`, `${year}-Q4`];

dv.paragraph("### 📊 분기별 성과 비교");
quarters.forEach(quarter => {
    const quarterFile = dv.page(`Quarterly Notes/${quarter}`);
    if (quarterFile) {
        const goals = quarterFile["quarterly-goals-completed"] || 0;
        const totalGoals = quarterFile["quarterly-goals-total"] || 15;
        const projects = quarterFile["major-projects-completed"] || 0;
        const skillScore = quarterFile["skill-development-score"] || 0;
        
        dv.paragraph(`- **${quarter}**: [[${quarter}]] - 목표 ${goals}/${totalGoals}, 프로젝트 ${projects}개, 스킬 ${skillScore}점`);
    } else {
        dv.paragraph(`- **${quarter}**: [[${quarter}]] - 미작성`);
    }
});
```

## 📝 연간 심층 회고

### 🎉 올해 가장 자랑스러운 성과
- 

### 💪 가장 큰 도전과 극복
- 

### 💡 올해 얻은 핵심 인사이트
- 

### 🌱 개인적 성장 포인트
- 

## 🎯 내년 비전 & 계획

### 🚀 내년 핵심 목표
- 

### 📚 내년 학습 로드맵
- 

### 🎨 내년 새로운 도전
- 

## 🔗 연결된 노트들
- **작년**: [[<% tp.date.now("YYYY", "P-1Y") %>]]
- **내년**: [[<% tp.date.now("YYYY", "P1Y") %>]]

## 📊 연간 마스터 대시보드
```dataviewjs
// 연간 종합 성과 대시보드
const currentYear = '<% tp.date.now("YYYY") %>';
const file = dv.page(`Yearly Notes/${currentYear}`);

if (file) {
    const goalsProgress = file["yearly-goals-completed"] || 0;
    const goalsTotal = file["yearly-goals-total"] || 20;
    const coursesCompleted = file["courses-completed"] || 0;
    const projectsLaunched = file["projects-launched"] || 0;
    const satisfaction = file["yearly-satisfaction"] || 0;
    
    dv.paragraph(`### 🏆 연간 성과 종합`);
    dv.paragraph(`**목표 달성률**: ${Math.round((goalsProgress/goalsTotal)*100)}%`);
    dv.paragraph(`**완료 강의**: ${coursesCompleted}개`);
    dv.paragraph(`**런칭 프로젝트**: ${projectsLaunched}개`);
    dv.paragraph(`**연간 만족도**: ${satisfaction}/100`);
    
    // 연간 등급
    const overallScore = (goalsProgress/goalsTotal) * 0.4 + (coursesCompleted/50) * 0.3 + (projectsLaunched/5) * 0.3;
    let yearGrade = "F";
    if (overallScore >= 0.9) yearGrade = "전설";
    else if (overallScore >= 0.8) yearGrade = "S+";
    else if (overallScore >= 0.7) yearGrade = "S";
    else if (overallScore >= 0.6) yearGrade = "A";
    else if (overallScore >= 0.5) yearGrade = "B";
    else if (overallScore >= 0.4) yearGrade = "C";
    
    dv.paragraph(`**연간 등급**: ${yearGrade}`);
}
```

---
*📅 생성일: <% tp.date.now("YYYY-MM-DD HH:mm") %> | 📝 마지막 수정: `=date(now)`*
