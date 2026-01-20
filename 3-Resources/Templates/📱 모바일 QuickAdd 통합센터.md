# 📱 모바일 QuickAdd 통합 센터

<div class="mobile-optimized center-container">

> **🎯 안드로이드 최적화 강의 시스템 - 터치 친화적 인터페이스**

---

## 🚀 빠른 생성

<div class="mobile-only">

### **📱 터치로 빠른 접근**

**🎬 새 강의 추가**
- 명령어 팔레트: `Ctrl + P` 또는 상단 검색 버튼
- 입력: `QuickAdd: 🎬 새 강의 생성`

**📊 새 시리즈 만들기**  
- 명령어 팔레트: `Ctrl + P` 또는 상단 검색 버튼
- 입력: `QuickAdd: 📊 새 시리즈 대시보드 생성`

</div>

---

## 📚 시리즈 대시보드

<div class="series-grid gpu-accelerated">

<div class="series-card touch-friendly" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);" onclick="app.workspace.openLinkText('영어20강완료/영어20강완료', '')">
<strong>🇬🇧 영어 시리즈</strong>
<small>20강 영어 학습</small>
<div class="progress-indicator">진행률: 로딩중...</div>
</div>

<div class="series-card touch-friendly" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);" onclick="app.workspace.openLinkText('수학5강완료/수학5강완료', '')">
<strong>🔢 수학 시리즈</strong>
<small>5강 수학 학습</small>
<div class="progress-indicator">진행률: 로딩중...</div>
</div>

<div class="series-card touch-friendly" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);" onclick="app.workspace.openLinkText('과학10강완료/과학10강완료', '')">
<strong>🧪 과학 시리즈</strong>
<small>10강 과학 학습</small>
<div class="progress-indicator">진행률: 로딩중...</div>
</div>

<div class="series-card touch-friendly" style="background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);" onclick="app.workspace.openLinkText('권투강좌20강완료/권투강좌20강완료', '')">
<strong>🥊 권투 시리즈</strong>
<small>20강 권투 학습</small>
<div class="progress-indicator">진행률: 로딩중...</div>
</div>

</div>

---

## 🎯 빠른 액션

<div class="action-grid gpu-accelerated">

<div class="action-card big-touch" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);" onclick="app.commands.executeCommandById('quickadd:choice:🎬 새 강의 생성')">
<strong>🎬 새 강의</strong>
<small>강의 추가</small>
</div>

<div class="action-card big-touch" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);" onclick="app.commands.executeCommandById('quickadd:choice:📊 새 시리즈 대시보드 생성')">
<strong>📊 시리즈</strong>
<small>대시보드 생성</small>
</div>

<div class="action-card big-touch" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);" onclick="app.workspace.openLinkText('1-Projects/강의학습시스템/📊 대시보드/📊 폴더강의 전체 대시보드', '')">
<strong>📊 전체</strong>
<small>대시보드</small>
</div>

<div class="action-card big-touch" style="background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);" onclick="app.commands.executeCommandById('dataview:dataview-force-refresh-views')">
<strong>🔄 새로고침</strong>
<small>데이터 업데이트</small>
</div>

</div>

---

## 📊 실시간 통계

### 📈 **전체 학습 현황**

```dataviewjs
// 모바일 최적화된 통계 표시
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
let seriesProgress = [];

for (const folder of seriesFolders) {
    try {
        const pages = dv.pages(`"${folder}"`);
        const lectures = pages.filter(p => p['course-number']);
        
        if (lectures.length > 0) {
            totalSeries++;
            totalLectures += lectures.length;
            
            let seriesCompleted = 0;
            let seriesTotal = lectures.length;
            
            for (const lecture of lectures) {
                const tasks = lecture.file.tasks || [];
                const lectureTasks = tasks.filter(t => t.text.includes("학습 완료") && t.text.includes("#강의학습"));
                const total = lectureTasks.length;
                const done = lectureTasks.filter(t => t.completed).length;
                const progress = total > 0 ? Math.round((done / total) * 100) : 0;
                
                const completionDate = lecture["completion-date"];
                const isCompleted = progress === 100 || (completionDate && completionDate !== "");
                
                if (isCompleted) {
                    completedLectures++;
                    seriesCompleted++;
                }
                totalStudyTime += lecture["total-minutes"] || 0;
            }
            
            const seriesName = folder.split('/').pop();
            const seriesPercent = Math.round((seriesCompleted / seriesTotal) * 100);
            seriesProgress.push({
                name: seriesName,
                progress: seriesPercent,
                completed: seriesCompleted,
                total: seriesTotal
            });
        }
    } catch (e) {
        continue;
    }
}

const overallProgress = totalLectures > 0 ? Math.round((completedLectures / totalLectures) * 100) : 0;
const totalHours = Math.floor(totalStudyTime / 60);
const totalMins = totalStudyTime % 60;

// 모바일 친화적 통계 카드
dv.paragraph(`<div class="stats-container mobile-optimized">`);

dv.paragraph(`### 🎯 전체 현황`);
dv.paragraph(`<div class="stats-grid">`);
dv.paragraph(`<div class="stat-card"><strong>${totalSeries}</strong><br><small>활성 시리즈</small></div>`);
dv.paragraph(`<div class="stat-card"><strong>${totalLectures}</strong><br><small>전체 강의</small></div>`);
dv.paragraph(`<div class="stat-card"><strong>${completedLectures}</strong><br><small>완료 강의</small></div>`);
dv.paragraph(`<div class="stat-card"><strong>${totalHours}h ${totalMins}m</strong><br><small>총 학습시간</small></div>`);
dv.paragraph(`</div>`);

// 전체 진행률 바
const progressEmoji = overallProgress >= 80 ? '🔥' : overallProgress >= 50 ? '📚' : overallProgress > 0 ? '🌱' : '⭕';
dv.paragraph(`### ${progressEmoji} 전체 진행률: ${overallProgress}%`);
dv.paragraph(`<progress value="${overallProgress}" max="100" style="width: 100%; height: 35px;"></progress>`);

// 시리즈별 진행률 (모바일 최적화)
if (seriesProgress.length > 0) {
    dv.paragraph(`### 📊 시리즈별 진행률`);
    for (const series of seriesProgress) {
        const emoji = series.name.includes('영어') ? '🇬🇧' : 
                     series.name.includes('수학') ? '🔢' : 
                     series.name.includes('과학') ? '🧪' : 
                     series.name.includes('권투') ? '🥊' : '📚';
        
        dv.paragraph(`**${emoji} ${series.name}**: ${series.completed}/${series.total} (${series.progress}%)`);
        dv.paragraph(`<progress value="${series.progress}" max="100" style="width: 100%; height: 25px; margin-bottom: 10px;"></progress>`);
    }
}

dv.paragraph(`</div>`);

// 추가 CSS 스타일
dv.paragraph(`
<style>
.stats-container {
    background: rgba(99, 102, 241, 0.1);
    padding: 20px;
    border-radius: 16px;
    margin: 20px 0;
    border-left: 5px solid #6366f1;
}

.stats-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 15px;
    margin: 15px 0;
}

.stat-card {
    background: rgba(255, 255, 255, 0.1);
    padding: 20px 15px;
    border-radius: 12px;
    text-align: center;
    font-size: 16px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.1);
}

.stat-card strong {
    display: block;
    font-size: 24px;
    font-weight: bold;
    margin-bottom: 5px;
    color: #6366f1;
}

@media (max-width: 320px) {
    .stats-grid {
        grid-template-columns: 1fr;
        gap: 10px;
    }
    
    .stat-card {
        padding: 15px 10px;
    }
    
    .stat-card strong {
        font-size: 20px;
    }
}
</style>
`);

if (totalLectures === 0) {
    dv.paragraph(`### 🚀 시작해보세요!`);
    dv.paragraph(`<div class="welcome-card">`);
    dv.paragraph(`<p style="text-align: center; font-size: 18px; margin: 20px 0;">아직 강의가 없습니다.<br>첫 번째 시리즈를 만들어보세요! 🎉</p>`);
    dv.paragraph(`</div>`);
}
```

---

## 📱 모바일 사용 가이드

### **🎯 터치 최적화된 사용법**

<div class="mobile-guide">

#### **1️⃣ 새 시리즈 만들기**
1. **상단 검색 버튼** 또는 `Ctrl + P` 터치
2. **"QuickAdd"** 입력하여 옵션 표시  
3. **"📊 새 시리즈 대시보드 생성"** 선택
4. **터치 키보드로 정보 입력**

#### **2️⃣ 새 강의 추가하기**
1. **상단 검색 버튼** 또는 `Ctrl + P` 터치
2. **"🎬 새 강의 생성"** 선택
3. **시리즈 선택** (자동 감지됨)
4. **강의 정보 입력**

#### **3️⃣ 진행률 체크하기**
1. **강의 파일 열기**
2. **구간별 체크박스 터치**
3. **자동으로 진행률 업데이트**
4. **시리즈 대시보드에서 확인**

</div>

---

## 💡 모바일 팁

### **🔋 성능 최적화**
- **Wi-Fi 연결** 시 동기화 권장
- **배터리 절약모드**에서도 정상 작동
- **오프라인 모드** 지원 (로컬 저장)

### **👆 터치 제스처**
- **길게 누르기**: 컨텍스트 메뉴 
- **스와이프**: 빠른 네비게이션
- **더블 탭**: 줌인/줌아웃
- **핀치**: 확대/축소

### **⌨️ 가상 키보드 팁**
- **음성 입력** 지원 (Android)
- **자동 완성** 활용
- **복사/붙여넣기** 자주 사용하는 내용

---

## 🎨 테마 설정

### **🌙 다크 모드 최적화**
- 자동으로 시스템 테마 따라감
- 눈의 피로를 줄이는 색상 조합
- 배터리 효율성 향상 (OLED 화면)

### **🎨 커스터마이징**
- 시리즈별 색상 조정 가능
- 폰트 크기 조절 지원  
- 터치 반응 속도 최적화

---

</div>

---

*📱 안드로이드 최적화로 언제 어디서나 학습 관리!*  
*🎯 터치 친화적 인터페이스로 효율적인 학습!*  
*🚀 모든 기능이 모바일에서 완벽하게 작동합니다!*