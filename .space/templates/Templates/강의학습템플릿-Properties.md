# 🎬 강의 학습 템플릿
<%*
const lectureName = await tp.system.prompt("강의명을 입력하세요:");
const instructor = await tp.system.prompt("강사명을 입력하세요:");
const totalMinutes = parseInt(await tp.system.prompt("강의 총 시간(분)을 입력하세요:"));
const customSegments = await tp.system.prompt("구간 수를 입력하세요 (기본값: 자동계산, 직접 입력 원하면 숫자 입력):");
const series = await tp.system.prompt("강의 시리즈명을 입력하세요:");
const courseNumber = await tp.system.prompt("강의 번호를 입력하세요:");
const totalCourses = await tp.system.prompt("전체 강의 수를 입력하세요:");

if (!totalMinutes || isNaN(totalMinutes)) {
    throw new Error("올바른 시간을 입력해주세요.");
}

// 구간 수 결정
let segments;
if (customSegments && !isNaN(customSegments) && parseInt(customSegments) > 0) {
    segments = parseInt(customSegments);
    tR += `\n✅ 사용자 설정: ${segments}개 구간으로 생성합니다.`;
} else {
    segments = Math.ceil(totalMinutes / 10);
    tR += `\n🔄 자동 계산: ${totalMinutes}분 → ${segments}개 구간 (10분당 1구간)`;
}

const today = tp.date.now("YYYY-MM-DD");
%>---
lecture-name: "<%= lectureName %>"
instructor: "<%= instructor || '미입력' %>"
lecture-date: "<%= today %>"
total-minutes: <%= totalMinutes %>
segments: <%= segments %>
lecture-series: "<%= series || '일반' %>"
course-number: <%= courseNumber || 1 %>
total-courses: <%= totalCourses || 1 %>
completed-segments: 0
status: "미시작"
difficulty: ""
satisfaction: ""
understanding: ""
recommend: ""
review-count: 0
review-dates: []
study-start-time: ""
study-end-time: ""
actual-time: ""
concentration: ""
focus-issues: []
study-location: ""
study-method: "온라인"
tags:
  - 강의학습
  - <%= (series || '일반').replace(/\s+/g, '') %>
  - 진도관리
category: "온라인강의"
created: <%= tp.date.now("YYYY-MM-DD") %>
---

## 📋 기본 정보
- **강의명**: <%= lectureName %>
- **강사**: <%= instructor || '미입력' %>
- **학습 날짜**: <%= today %>
- **강의 시간**: <%= totalMinutes %>분
- **예상 진행 시간**: <%= totalMinutes %>분
---
## 📊 전체 진행률
**진행 상황**: `$= this["completed-segments"] + "/" + this.segments + "구간 완료 (" + Math.round((this["completed-segments"]/this.segments)*100) + "%)"`
**진행바**: `$= "▓".repeat(Math.floor((this["completed-segments"]/this.segments)*10)) + "░".repeat(10-Math.floor((this["completed-segments"]/this.segments)*10))`
**복습 횟수**: `$= "🔄 " + (this["review-count"] || 0) + "회"`

---
## ⏱️ 10분 단위 세부 진행
<%* for(let i = 1; i <= segments; i++) { %>
### 📍 <%= i %>구간 (<%= (i-1)*10 %>-<%= Math.min(i*10, totalMinutes) %>분)
- [ ] **학습 완료** ✅ #강의학습 
- **주요 내용**:
  ```
  {{이 구간에서 학습한 핵심 내용을 정리하세요}}
  ```
- **메모**:
  ```
  {{추가 메모나 중요 포인트}}
  ```
- **복습 체크**: 
  - [ ] 1차 복습 🔄
  - [ ] 2차 복습 🔄
  - [ ] 3차 복습 🔄
  - [ ] 4차 복습 🔄
  - [ ] 5차 복습 🔄
- **복습 필요**: [ ] (어려운 부분이면 체크)
---
<%* } %>
## 📝 전체 정리
### 🎯 핵심 요약
```
{{강의 전체의 핵심 내용을 요약하세요}}
```
### 💡 새로 배운 내용
```
{{이번 강의에서 새롭게 알게 된 내용}}
```
### ❓ 질문/의문점
```
{{학습 중 생긴 질문이나 의문점을 기록하세요}}
```
### 🔄 복습 필요 사항
```
{{다시 복습이 필요한 부분이나 어려웠던 내용을 기록하세요}}
```
### 📚 복습 기록
- **1차 복습**: `$= (this["review-dates"] && this["review-dates"][0]) || "미완료"`
- **2차 복습**: `$= (this["review-dates"] && this["review-dates"][1]) || "미완료"`
- **3차 복습**: `$= (this["review-dates"] && this["review-dates"][2]) || "미완료"`
---
## 🔗 실습 및 과제
### 💻 실습 내용
- [ ] **실습 1**: {{실습내용1}}
- [ ] **실습 2**: {{실습내용2}}
- [ ] **실습 3**: {{실습내용3}}
### 📚 과제/숙제
- [ ] **과제 1**: {{과제내용1}} (마감: {{마감일1}})
- [ ] **과제 2**: {{과제내용2}} (마감: {{마감일2}})
---
## 📈 학습 현황
### ⏱️ 시간 기록
- **시작 시간**: `$= dv.current()."study-start-time" || "미기록"`
- **완료 시간**: `$= dv.current()."study-end-time" || "미기록"`
- **실제 소요 시간**: `$= dv.current()."actual-time" || "미기록"`
- **집중도**: `$= (dv.current().concentration || "미평가") + " (5점 만점)"`
- **학습 위치**: `$= dv.current()."study-location" || "미기록"`
- **학습 방식**: `$= dv.current()."study-method" || "온라인"` 
### 🎯 전체 평가
- **내용 난이도**: `$= (dv.current().difficulty ? "⭐".repeat(dv.current().difficulty) + " " + dv.current().difficulty : "미평가") + "/5"`
- **강의 만족도**: `$= (dv.current().satisfaction ? "⭐".repeat(dv.current().satisfaction) + " " + dv.current().satisfaction : "미평가") + "/5"`
- **전체 이해도**: `$= (dv.current().understanding ? "⭐".repeat(dv.current().understanding) + " " + dv.current().understanding : "미평가") + "/5"`
- **추천 여부**: `$= dv.current().recommend || "미평가"`
### 📊 진도 상황
- **전체 진행률**: `$= dv.current()."completed-segments" + "/" + dv.current().segments + " (" + Math.round((dv.current()."completed-segments"/dv.current().segments)*100) + "%)"`
- **복습 현황**: `$= (dv.current()."review-count" || 0) + "회 복습 완료"`
- **이전 강의**: [[이전강의명]]
- **다음 강의**: [[다음강의명]]
---
## 🔗 관련 링크 및 자료
### 🌐 강의 링크
- **강의 URL**: {{강의URL}}
- **강의 자료**: [[{{강의자료파일명}}]]
- **실습 파일**: [[{{실습파일명}}]]
### 📚 참고 자료
- **교재 페이지**: {{교재페이지}}
- **추가 자료**: [[{{추가자료1}}]], [[{{추가자료2}}]]
- **관련 강의**: [[{{관련강의명}}]]
---
## 🏷️ 메타데이터
- **생성일**: `$= dv.current().created`
- **시리즈**: `$= dv.current()."lecture-series" + " - " + dv.current()."course-number" + "/" + dv.current()."total-courses"`
- **상태**: `$= dv.current().status`
- **총 복습 횟수**: `$= (dv.current()."review-count" || 0) + "회"`
