# 🎯 QuickAdd 통합 센터 (링크 버전)

> **모든 강의 시스템을 한 곳에서 관리 - 즉시 사용 가능한 버전**

---

## 🚀 빠른 생성

### **핵심 명령어 (Ctrl + P 사용)**

**🎬 새 강의 추가:**
- `Ctrl + P` → `QuickAdd: 🎬 새 강의 생성`

**📊 새 시리즈 대시보드:**  
- `Ctrl + P` → `QuickAdd: 📊 새 시리즈 대시보드 생성`

**🔄 데이터뷰 새로고침:**
- `Ctrl + P` → `Dataview: Force Refresh All Views`

---

## 👥 기존 시리즈 대시보드

### 🎆 **과목별 대시보드 (클릭해서 이동)**

**🇬🇧 영어 시리즈**  
→ [[../../1-Projects/강의학습시스템/강의시리즈/전기기사/전기기사|📚 영어20강완료 대시보드]]

**🔢 수학 시리즈**  
→ [[수학5강완료/수학5강완료|📚 수학5강완료 대시보드]]

**🧪 과학 시리즈**  
→ [[과학10강완료/과학10강완료|📚 과학10강완료 대시보드]]

**🥊 권투 시리즈** *(새로 생성한 경우)*  
→ [[권투강좌20강완료/권투강좌20강완료|🥊 권투강좌20강완료 대시보드]]

---

## 🔧 시스템 관리

### **📊 전체 대시보드**
→ [[1-Projects/강의학습시스템/📊 대시보드/📊 폴더강의 전체 대시보드|📊 전체 강의 현황 보기]]

### **🚀 슈퍼허브**  
→ [[1-Projects/강의학습시스템/🚀 슈퍼허브 대시보드|🚀 슈퍼허브 대시보드]]

### **⚙️ QuickAdd 설정**
- `Ctrl + P` → `QuickAdd: Open`

---

## 🎨 사용법 가이드

### 🎬 **새 강의 추가 방법**
1. **`Ctrl + P`** 누르기
2. **`QuickAdd: 🎬 새 강의 생성`** 입력/선택
3. 대화형으로 정보 입력:
   - 강의명, 강사님, 시리즈 선택
   - 강의 번호 (자동 추천), 시간, 일정 설정
4. 자동으로 올바른 폴더에 생성 ✨

### 📊 **새 시리즈 대시보드 생성**
1. **`Ctrl + P`** 누르기  
2. **`QuickAdd: 📊 새 시리즈 대시보드 생성`** 입력/선택
3. 시리즈 정보 입력:
   - 시리즈명 (예: 전기강의30강완료)
   - 과목명, 총 강의 수, 난이도
   - 예상 기간, 이모지 선택
4. 자동으로 완벽한 대시보드 생성 ✨

### 🔄 **진행률 새로고침**
데이터뷰가 업데이트되지 않을 때:
1. **`Ctrl + P`** 누르기
2. **`Dataview: Force Refresh All Views`** 실행

---

## 📊 실시간 통계

### 📈 **전체 시리즈 현황**

```dataviewjs
// 전체 강의 시리즈 통계
const seriesFolders = [
    "1-Projects/강의학습시스템/강의시리즈/영어20강완료",
    "1-Projects/강의학습시스템/강의시리즈/수학5강완료", 
    "1-Projects/강의학습시스템/강의시리즈/과학10강완료",
    "1-Projects/강의학습시스템/강의시리즈/권투강좌20강완료"
];

let totalSeries = 0;
let totalLectures = 0;
let completedLectures = 0;
let totalStudyTime = 0;

for (const folder of seriesFolders) {
    try {
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
    } catch (e) {
        // 폴더가 없으면 건너뛰기
        continue;
    }
}

const overallProgress = totalLectures > 0 ? Math.round((completedLectures / totalLectures) * 100) : 0;
const totalHours = Math.floor(totalStudyTime / 60);
const totalMins = totalStudyTime % 60;

dv.paragraph(`### 🎯 전체 학습 현황`);
dv.paragraph(`**활성 시리즈**: ${totalSeries}개`);
dv.paragraph(`**전체 강의**: ${totalLectures}강`);
dv.paragraph(`**완료 강의**: ${completedLectures}강 (${overallProgress}%)`);
dv.paragraph(`**총 학습 시간**: ${totalHours}시간 ${totalMins}분`);

const progressEmoji = overallProgress >= 80 ? '🔥' : overallProgress >= 50 ? '📚' : overallProgress > 0 ? '🌱' : '⭕';
dv.paragraph(`### ${progressEmoji} 전체 진행률: ${overallProgress}%`);

if (totalLectures === 0) {
    dv.paragraph(`### 🚀 시작해보세요!`);
    dv.paragraph(`아직 강의가 없습니다. 첫 번째 시리즈를 만들어보세요!`);
}
```

---

## 📝 빠른 단축키 모음

### **🚀 필수 명령어들**
| 기능 | 단축키 | 명령어 |
|------|--------|---------|
| 명령어 팔레트 | `Ctrl + P` | - |
| 새 강의 추가 | `Ctrl + P` | `QuickAdd: 🎬 새 강의 생성` |
| 새 시리즈 생성 | `Ctrl + P` | `QuickAdd: 📊 새 시리즈 대시보드 생성` |
| 데이터뷰 새로고침 | `Ctrl + P` | `Dataview: Force Refresh All Views` |
| QuickAdd 설정 | `Ctrl + P` | `QuickAdd: Open` |

### **💡 사용 팁**
- 명령어 팔레트에서 **QuickAdd**만 입력하면 모든 옵션이 나타남
- 화살표 키로 선택하고 Enter로 실행
- 자주 사용하는 명령어는 핫키 설정 가능 (설정 → 핫키)

---

## 🎆 시리즈 추천

### 🚀 **만들어볼 만한 시리즈들**
- `⚡ 전기공학30강완료` - 전기 기초부터 응용까지
- `🍳 요리강의15강완료` - 기본 요리부터 고급 요리까지  
- `📸 사진강의20강완료` - 기초 촬영부터 고급 편집까지
- `🎵 음악이론25강완료` - 기초 이론부터 실전 연주까지
- `💻 프로그래밍40강완료` - 입문부터 실무까지
- `🎨 디자인강의18강완료` - 기초 디자인부터 포트폴리오까지

### 🎯 **시리즈 관리 전략**
1. **단기 집중 시리즈** (10-15강): 빠른 성취감
2. **중기 체계 시리즈** (20-30강): 체계적 학습  
3. **장기 마스터 시리즈** (40-50강): 전문성 구축

---

## 🔧 문제 해결

### **버튼이 작동하지 않을 때**
- **해결책**: 이 파일의 링크나 명령어를 직접 사용
- **Buttons 플러그인** 설치하면 버튼 사용 가능

### **QuickAdd가 보이지 않을 때**  
- QuickAdd 플러그인이 활성화되어 있는지 확인
- Choice 설정이 올바른지 확인

### **진행률이 업데이트되지 않을 때**
- `Ctrl + P` → `Dataview: Force Refresh All Views` 실행
- 페이지 새로고침 (`Ctrl + R`)

---

*🎯 모든 강의 시스템을 이 한 곳에서 관리하세요!*  
*🚀 QuickAdd 명령어로 빠르고 효율적인 학습 관리가 가능합니다.*  
*📊 모든 데이터가 실시간으로 동기화됩니다!*

---

## ⚡ 즉시 시작하기

**지금 바로 해보세요:**
1. `Ctrl + P` 누르기
2. `QuickAdd: 📊 새 시리즈 대시보드 생성` 입력
3. 원하는 주제로 첫 번째 시리즈 만들기! 🎉