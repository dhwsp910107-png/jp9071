---
week: <% tp.date.now("YYYY-[W]ww") %>
year: <% tp.date.now("YYYY") %>
month: <% tp.date.now("YYYY-MM") %>
week-start: <% tp.date.weekday("YYYY-MM-DD", 1) %>
week-end: <% tp.date.weekday("YYYY-MM-DD", 7) %>
tags:
  - weekly-note
  - <% tp.date.now("YYYY") %>
  - <% tp.date.now("YYYY-MM") %>
weekly-goals-completed: 0
weekly-goals-total: 5
total-study-hours: 0
lectures-completed: 0
review-sessions: 0
health-score: 0
---

# 📅 <% tp.date.now("YYYY년 W주차") %> 주간 노트
**기간**: <% tp.date.weekday("M월 D일", 1) %> ~ <% tp.date.weekday("M월 D일", 7) %>

## 🎯 주간 목표 & 성과

### 📚 학습 목표
- [ ] **목표 1**: 
- [ ] **목표 2**: 
- [ ] **목표 3**: 
- [ ] **목표 4**: 
- [ ] **목표 5**: 

**완료률**: `= this.weekly-goals-completed + "/" + this.weekly-goals-total + " (" + round(this.weekly-goals-completed/this.weekly-goals-total*100) + "%)"`

## 📊 주간 학습 통계

### 🎬 강의 학습 현황
```dataviewjs
// 이번 주 강의 학습 활동 분석
const weekStart = dv.date('<% tp.date.weekday("YYYY-MM-DD", 1) %>');
const weekEnd = dv.date('<% tp.date.weekday("YYYY-MM-DD", 7) %>');

const lectureFiles = dv.pages('#강의학습')
    .where(p => p.file.mday >= weekStart && p.file.mday <= weekEnd)
    .array();

if (lectureFiles.length > 0) {
    // 이번 주 활동한 강의들
    const weeklyData = lectureFiles.map(lecture => {
        const completedSegments = lecture["completed-segments"] || 0;
        const totalSegments = lecture.segments || 1;
        const segmentProgress = Math.round((completedSegments / totalSegments) * 100);
        const progressBar = "▓".repeat(Math.floor(segmentProgress/10)) + "░".repeat(10-Math.floor(segmentProgress/10));
        
        return [
            `[[${lecture.file.name}|${lecture["lecture-name"]}]]`,
            lecture["lecture-series"] || "-",
            `${progressBar} ${segmentProgress}%`,
            lecture.status || "미시작",
            lecture.file.mday.toFormat("MM-dd")
        ];
    });
    
    dv.table(
        ["강의명", "시리즈", "진행률", "상태", "활동일"],
        weeklyData
    );
    
    // 주간 통계
    const completedLectures = lectureFiles.filter(l => l.status === "완료").length;
    const inProgressLectures = lectureFiles.filter(l => l.status === "진행중").length;
    const totalStudyTime = lectureFiles.reduce((sum, l) => {
        const completed = l["completed-segments"] || 0;
        const segments = l.segments || 1;
        return sum + (completed / segments) * (l["total-minutes"] || 0);
    }, 0);
    
    dv.paragraph(`### 📈 주간 학습 성과`);
    dv.paragraph(`- **활동 강의**: ${lectureFiles.length}개`);
    dv.paragraph(`- **완료 강의**: ${completedLectures}개`);
    dv.paragraph(`- **진행중 강의**: ${inProgressLectures}개`);
    dv.paragraph(`- **총 학습 시간**: ${Math.round(totalStudyTime/60)}시간 ${Math.round(totalStudyTime%60)}분`);
    
} else {
    dv.paragraph("이번 주 강의 학습 활동이 없습니다.");
}
```

### 📅 일별 활동 현황
```dataviewjs
// 이번 주 일별 노트 링크
const weekStart = dv.date('<% tp.date.weekday("YYYY-MM-DD", 1) %>');
const days = ["월", "화", "수", "목", "금", "토", "일"];

dv.paragraph("### 📆 일별 노트");
for (let i = 0; i < 7; i++) {
    const currentDay = weekStart.plus({days: i});
    const dayStr = currentDay.toFormat("yyyy-MM-dd");
    const dayFile = dv.page(`Daily Notes/${dayStr}`);
    
    const dayName = days[i];
    const dateStr = currentDay.toFormat("M/d");
    
    if (dayFile) {
        const goalsCompleted = dayFile["goals-completed"] || 0;
        const goalsTotal = dayFile["goals-total"] || 3;
        const studyHours = dayFile["study-hours"] || 0;
        const exercised = dayFile.exercise ? "💪" : "😴";
        
        dv.paragraph(`- **${dayName} (${dateStr})**: [[${dayStr}]] - 목표 ${goalsCompleted}/${goalsTotal}, 학습 ${studyHours}h ${exercised}`);
    } else {
        dv.paragraph(`- **${dayName} (${dateStr})**: [[${dayStr}]] - 미작성`);
    }
}
```

## 💪 건강 & 라이프스타일

### 🏃‍♂️ 운동 현황
- **운동 일수**: 일
- **총 운동 시간**: 시간
- **주요 운동**: 

### 😴 수면 패턴
- **평균 수면 시간**: 시간
- **수면 만족도**: /5

### 🎯 건강 점수
- **전체 건강 점수**: `= this.health-score + "/100"`

## 🤔 주간 회고

### 🎉 이번 주 성취한 것들
- 

### 💡 배운 점들
- 

### 😅 아쉬웠던 점들
- 

### 🔄 다음 주 개선 계획
- 

## 🔗 연결된 노트들
- **지난 주**: [[<% tp.date.now("YYYY-[W]ww", -7) %>]]
- **다음 주**: [[<% tp.date.now("YYYY-[W]ww", 7) %>]]
- **이번 달**: [[<% tp.date.now("YYYY-MM") %>]]

## 📈 주간 대시보드
```dataviewjs
// 주간 종합 대시보드
const currentWeek = '<% tp.date.now("YYYY-[W]ww") %>';
const file = dv.page(`Weekly Notes/${currentWeek}`);

if (file) {
    const goalsProgress = file["weekly-goals-completed"] || 0;
    const goalsTotal = file["weekly-goals-total"] || 5;
    const studyHours = file["total-study-hours"] || 0;
    const lecturesCompleted = file["lectures-completed"] || 0;
    const healthScore = file["health-score"] || 0;
    
    // 주간 성과 요약
    dv.paragraph(`### 🏆 주간 성과 요약`);
    dv.paragraph(`**목표 달성률**: ${Math.round((goalsProgress/goalsTotal)*100)}%`);
    dv.paragraph(`**총 학습 시간**: ${studyHours}시간`);
    dv.paragraph(`**완료 강의**: ${lecturesCompleted}개`);
    dv.paragraph(`**건강 점수**: ${healthScore}/100`);
    
    // 시각적 진행바
    const progressBar = "▓".repeat(Math.floor((goalsProgress/goalsTotal)*10)) + "░".repeat(10-Math.floor((goalsProgress/goalsTotal)*10));
    dv.paragraph(`**주간 진행률**: ${progressBar}`);
}
```

---
*📅 생성일: <% tp.date.now("YYYY-MM-DD HH:mm") %> | 📝 마지막 수정: `=date(now)`*
