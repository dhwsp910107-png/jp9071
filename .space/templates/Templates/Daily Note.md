---
date: <% tp.date.now("YYYY-MM-DD") %>
day: <% tp.date.now("dddd") %>
week: <% tp.date.now("YYYY-[W]ww") %>
month: <% tp.date.now("YYYY-MM") %>
tags:
  - daily-note
  - <% tp.date.now("YYYY") %>
  - <% tp.date.now("YYYY-MM") %>
mood: ""
energy: ""
weather: ""
sleep-hours: ""
study-hours: 0
exercise: false
goals-completed: 0
goals-total: 3
---

# 📅 <% tp.date.now("YYYY년 M월 D일 dddd") %>

## 🌅 오늘의 개요
- **날씨**: `= this.weather`
- **기분**: `= this.mood` 
- **에너지**: `= this.energy`
- **수면시간**: `= this.sleep-hours`

## 🎯 오늘의 목표
- [ ] **목표 1**: 
- [ ] **목표 2**: 
- [ ] **목표 3**: 

**완료률**: `= this.goals-completed + "/" + this.goals-total + " (" + round(this.goals-completed/this.goals-total*100) + "%)"`

## 📚 학습 활동

### 강의 학습 진행
```dataviewjs
// 오늘 수정된 강의 파일들
const today = dv.date('<% tp.date.now("YYYY-MM-DD") %>');
const lectureFiles = dv.pages('#강의학습')
    .where(p => p.file.mday.toFormat("yyyy-MM-dd") === today.toFormat("yyyy-MM-dd"))
    .array();

if (lectureFiles.length > 0) {
    dv.paragraph("### 📖 오늘 학습한 강의들");
    
    const lectureData = lectureFiles.map(lecture => {
        const completedSegments = lecture["completed-segments"] || 0;
        const totalSegments = lecture.segments || 1;
        const segmentProgress = Math.round((completedSegments / totalSegments) * 100);
        const progressBar = "▓".repeat(Math.floor(segmentProgress/10)) + "░".repeat(10-Math.floor(segmentProgress/10));
        
        return [
            `[[${lecture.file.name}|${lecture["lecture-name"]}]]`,
            `${progressBar} ${segmentProgress}%`,
            lecture.status || "미시작"
        ];
    });
    
    dv.table(["강의명", "진행률", "상태"], lectureData);
} else {
    dv.paragraph("오늘 학습한 강의가 없습니다.");
}
```

### 📊 학습 시간 추적
- **총 학습 시간**: `= this.study-hours + "시간"`
- **강의 학습**: 시간
- **복습**: 시간  
- **실습**: 시간

## 💪 건강 & 운동
- **운동 완료**: `= this.exercise ? "✅" : "❌"`
- **운동 종류**: 
- **운동 시간**: 분

## 📝 오늘의 기록

### 🎉 성취한 것들
- 

### 💡 배운 것들  
- 

### 🤔 개선할 점들
- 

### 📱 중요한 일들
- 

## 🔗 연결된 노트들
- **어제**: [[<% tp.date.now("YYYY-MM-DD", -1) %>]]
- **내일**: [[<% tp.date.now("YYYY-MM-DD", 1) %>]]
- **이번 주**: [[<% tp.date.now("YYYY-[W]ww") %>]]
- **이번 달**: [[<% tp.date.now("YYYY-MM") %>]]

## 📈 일일 통계
```dataviewjs
// 오늘의 통계 대시보드
const today = '<% tp.date.now("YYYY-MM-DD") %>';
const file = dv.page(`Daily Notes/${today}`);

if (file) {
    const goalsProgress = file["goals-completed"] || 0;
    const goalsTotal = file["goals-total"] || 3;
    const studyHours = file["study-hours"] || 0;
    const exercised = file.exercise || false;
    
    dv.paragraph(`**목표 달성률**: ${Math.round((goalsProgress/goalsTotal)*100)}%`);
    dv.paragraph(`**학습 시간**: ${studyHours}시간`);
    dv.paragraph(`**운동 완료**: ${exercised ? "✅" : "❌"}`);
    
    // 간단한 진행바
    const progressBar = "▓".repeat(Math.floor((goalsProgress/goalsTotal)*10)) + "░".repeat(10-Math.floor((goalsProgress/goalsTotal)*10));
    dv.paragraph(`**하루 진행률**: ${progressBar}`);
}
```

---
*🕒 생성시간: <% tp.date.now("HH:mm") %> | 📝 마지막 수정: `=date(now)`*
