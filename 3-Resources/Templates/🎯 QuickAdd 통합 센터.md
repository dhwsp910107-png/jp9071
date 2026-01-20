# 🎯 QuickAdd 통합 버튼 센터

> **모든 강의 시스템을 한 곳에서 관리**

---

## 🚀 빠른 생성

### **주요 기능**

```button
name 🎬 새 강의 추가
type command
action QuickAdd: 🎬 새 강의 생성
class main-btn
```
^button-add-lecture

```button
name 📊 새 시리즈 대시보드 생성
type command  
action QuickAdd: 📊 새 시리즈 대시보드 생성
class dashboard-btn
```
^button-add-series

---

## 👥 기존 시리즈 대시보드

### 🎆 과목별 대시보드

<div class="series-grid">

<div class="series-card" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
<strong>🇬🇧 영어 시리즈</strong><br>
[[영어20강완료/영어20강완료|영어20강완료 대시보드]]
<small>20강 영어 학습</small>
</div>

<div class="series-card" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);">
<strong>🔢 수학 시리즈</strong><br>
[[수학5강완료/수학5강완료|수학5강완료 대시보드]]
<small>5강 수학 학습</small>
</div>

<div class="series-card" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);">
<strong>🧪 과학 시리즈</strong><br>
[[과학10강완료/과학10강완료|과학10강완료 대시보드]]
<small>10강 과학 학습</small>
</div>

</div>

---

## 🔧 시스템 관리

### **전체 대시보드**

```button
name 📊 전체 대시보드
type link
action [[1-Projects/강의학습시스템/📊 대시보드/📊 폴더강의 전체 대시보드]]
class system-btn
```
^button-main-dashboard

```button
name 🚀 슈퍼허브
type link
action [[1-Projects/강의학습시스템/🚀 슈퍼허브 대시보드]]
class superhub-btn
```
^button-superhub

### **도구 & 설정**

```button
name 🔄 데이터뷰 새로고침
type command
action Dataview: Force Refresh All Views
class refresh-btn
```
^button-refresh

```button
name ⚙️ QuickAdd 설정
type command
action QuickAdd: Open
class settings-btn
```
^button-quickadd-settings

---

## 🎨 사용법 가이드

### 🎬 **새 강의 추가 방법**
1. "🎬 새 강의 추가" 버튼 클릭
2. 대화형으로 정보 입력:
   - 강의명, 강사님, 시리즈 선택
   - 강의 번호, 시간, 일정 설정
3. 자동으로 올바른 폴더에 생성

### 📊 **새 시리즈 대시보드 생성**
1. "📊 새 시리즈 대시보드 생성" 버튼 클릭
2. 시리즈 정보 입력:
   - 시리즈명, 과목명, 총 강의 수
   - 난이도, 예상 기간, 이모지 선택
3. 자동으로 대시보드 생성

### ⚙️ **QuickAdd 설정 방법**
1. 버튼이 작동하지 않는 경우:
   - QuickAdd 설정에서 Choice 이름 확인
   - Template Path 정확히 설정
   - Command 체크박스 활성화

2. 대체 방법:
   - `Ctrl + P` → `QuickAdd: 선택할 Choice`
   - `Ctrl + P` → `Templater: Create new note from template`

---

## 📊 실시간 통계

### 📈 **전체 시리즈 현황**

```dataviewjs
// 전체 강의 시리즈 통계
const seriesFolders = [
    "1-Projects/강의학습시스템/강의시리즈/영어20강완료",
    "1-Projects/강의학습시스템/강의시리즈/수학5강완료",
    "1-Projects/강의학습시스템/강의시리즈/과학10강완료"
];

let totalSeries = 0;
let totalLectures = 0;
let completedLectures = 0;
let totalStudyTime = 0;

for (const folder of seriesFolders) {
    const pages = dv.pages(`"${folder}"`);
    const lectures = pages.filter(p => p['course-number']);
    
    if (lectures.length > 0) {
        totalSeries++;
        totalLectures += lectures.length;
        
        for (const lecture of lectures) {
            const tasks = lecture.file.tasks || [];
            const lectureTasks = tasks.filter(t => t.text.includes("학습 완료") && t.text.includes("#강의학습"));
            const total = lectureTasks.length;
            const done = lectureTasks.filter(t => t.completed).length;
            const progress = total > 0 ? Math.round((done / total) * 100) : 0;
            
            const completionDate = lecture["completion-date"];
            const isCompleted = progress === 100 || (completionDate && completionDate !== "");
            
            if (isCompleted) completedLectures++;
            totalStudyTime += lecture["total-minutes"] || 0;
        }
    }
}

const overallProgress = totalLectures > 0 ? Math.round((completedLectures / totalLectures) * 100) : 0;
const totalHours = Math.floor(totalStudyTime / 60);
const totalMins = totalStudyTime % 60;

dv.paragraph(`### 🎯 전체 학습 현황`);
dv.paragraph(`**전체 시리즈**: ${totalSeries}개`);
dv.paragraph(`**전체 강의**: ${totalLectures}강`);
dv.paragraph(`**완료 강의**: ${completedLectures}강 (${overallProgress}%)`);
dv.paragraph(`**총 학습 시간**: ${totalHours}시간 ${totalMins}분`);

const progressEmoji = overallProgress >= 80 ? '🔥' : overallProgress >= 50 ? '📚' : overallProgress > 0 ? '🌱' : '⭕';
dv.paragraph(`### ${progressEmoji} 전체 진행률: ${overallProgress}%`);
```

---

## 📝 빠른 단축키

### **명령어 팔레트 사용법**

1. **`Ctrl + P`** → 명령어 팔레트 열기
2. **QuickAdd** 검색하면 모든 옵션 표시
3. **화살표 키**로 선택 후 **Enter**

### **주요 명령어**
- `QuickAdd: 🎬 새 강의 생성`
- `QuickAdd: 📊 새 시리즈 대시보드 생성`
- `Dataview: Force Refresh All Views`
- `Templater: Create new note from template`

---

## 🎆 다음 단계

### 🚀 **시스템 확장**
- [ ] 새로운 과목 시리즈 생성
- [ ] 복습 알림 시스템 추가
- [ ] 통계 대시보드 업그레이드
- [ ] 모바일 연동 최적화

### 🎨 **커스터마이징**
- 버튼 색상 및 스타일 조정
- 과목별 이모지 및 테마 설정
- 개인화된 대시보드 레이아웃

---

*🎯 모든 강의 시스템을 이 한 곳에서 관리하세요!*  
*🚀 QuickAdd로 빠르고 효율적인 학습 관리가 가능합니다.*  
*📊 모든 데이터가 실시간으로 동기화됩니다!*