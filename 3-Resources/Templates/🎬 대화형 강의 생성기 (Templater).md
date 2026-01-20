<%*
// 🎬 새 강의 추가 마법사 - 업데이트된 버전
// 시리즈 대시보드와 완전히 연동되는 강의 생성기

// 1단계: 기존 시리즈 폴더 스캔
const seriesPath = "1-Projects/강의학습시스템/강의시리즈";
const seriesFolders = app.vault.adapter.list(seriesPath);
const availableSeries = [];

// 기존 시리즈 스캔
const folders = await app.vault.adapter.list(seriesPath);
if (folders && folders.folders) {
    for (const folder of folders.folders) {
        const folderName = folder.split('/').pop();
        if (folderName && !folderName.includes('📊')) {
            availableSeries.push(folderName);
        }
    }
}

// 기본 시리즈 추가 (없을 경우)
const defaultSeries = ["영어20강완료", "수학5강완료", "과학10강완료"];
for (const series of defaultSeries) {
    if (!availableSeries.includes(series)) {
        availableSeries.push(series);
    }
}

availableSeries.push("새 시리즈 생성");

// 2단계: 기본 정보 수집
const lectureTitle = await tp.system.prompt("📚 강의명을 입력하세요", "기본 자세와 스탠스");
if (!lectureTitle) return;

const instructor = await tp.system.prompt("👨‍🏫 강사명을 입력하세요", "김권투");
if (!instructor) return;

// 3단계: 시리즈 선택
const seriesChoice = await tp.system.suggester(availableSeries, availableSeries, false, "📁 시리즈를 선택하세요");
if (!seriesChoice) return;

let seriesName;
let isNewSeries = false;

if (seriesChoice === "새 시리즈 생성") {
    const newSeries = await tp.system.prompt("🆕 새 시리즈명을 입력하세요 (예: 권투강좌20강완료)", "");
    if (!newSeries) return;
    seriesName = newSeries;
    isNewSeries = true;
    
    // 새 시리즈 폴더 생성 안내
    tR += `\n🎉 새 시리즈 "${seriesName}" 감지됨!\n`;
    tR += `👉 먼저 "📊 새 시리즈 대시보드 생성" 명령어로 대시보드를 만들어주세요.\n\n`;
} else {
    seriesName = seriesChoice;
}

// 4단계: 강의 번호 자동 추천
const seriesFolder = `${seriesPath}/${seriesName}`;
let suggestedNumber = 1;

try {
    const existingFiles = await app.vault.adapter.list(seriesFolder);
    if (existingFiles && existingFiles.files) {
        const lectureFiles = existingFiles.files.filter(f => 
            f.includes('강 -') && f.endsWith('.md') && !f.includes('대시보드')
        );
        
        const numbers = lectureFiles.map(f => {
            const match = f.match(/(\d+)강 -/);
            return match ? parseInt(match[1]) : 0;
        }).sort((a, b) => b - a);
        
        if (numbers.length > 0) {
            suggestedNumber = numbers[0] + 1;
        }
    }
} catch (e) {
    // 폴더가 없으면 1번부터 시작
    suggestedNumber = 1;
}

const courseNumber = await tp.system.prompt("🔢 강의 번호를 입력하세요", suggestedNumber.toString());
if (!courseNumber) return;

// 5단계: 나머지 정보 수집
const totalMinutes = await tp.system.prompt("⏱️ 총 강의 시간(분)을 입력하세요", "45");
if (!totalMinutes) return;

const segments = Math.ceil(totalMinutes / 10);

// 6단계: 일정 설정
const today = new Date();
const targetDate = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
const reviewDate = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

const targetCompletion = await tp.system.prompt(
    "🎯 목표 완료일을 입력하세요 (YYYY-MM-DD)", 
    targetDate.toISOString().split('T')[0]
);

const reviewTarget = await tp.system.prompt(
    "🔄 복습 목표일을 입력하세요 (YYYY-MM-DD)", 
    reviewDate.toISOString().split('T')[0]
);

// 7단계: 확인
const fileName = `${courseNumber}강 - ${lectureTitle}`;
const confirmation = await tp.system.suggester(
    [
        `✅ 생성하기 - ${fileName}`,
        "❌ 취소하기"
    ],
    [true, false],
    false,
    `📋 강의 정보를 확인하세요:\n\n🎬 강의: ${lectureTitle}\n👨‍🏫 강사: ${instructor}\n📁 시리즈: ${seriesName}\n🔢 번호: ${courseNumber}강\n⏱️ 시간: ${totalMinutes}분 (${segments}구간)\n🎯 목표: ${targetCompletion}\n🔄 복습: ${reviewTarget}`
);

if (!confirmation) {
    tR += "❌ 강의 생성이 취소되었습니다.";
    return;
}

// 8단계: 템플릿 생성
tR += `---
lecture-name: "${lectureTitle}"
instructor: "${instructor}"
lecture-date: "${tp.date.now("YYYY-MM-DD")}"
course-number: ${courseNumber}
total-minutes: ${totalMinutes}
segments: ${segments}
lecture-series: "${seriesName}"
completed-segments: 0
status: 준비중
difficulty: 
satisfaction: ""
understanding: ""
recommend: ""
study-start-time: ""
study-end-time: ""
actual-time: ""
concentration: ""
completion-date: ""
target-completion-date: "${targetCompletion}"
target-review-rounds: 5
max-review-rounds: 10
review-target-date: "${reviewTarget}"
tags:
  - 강의학습
  - "${seriesName}"
  - 진도관리
category: 온라인강의
created: "${tp.date.now("YYYY-MM-DD")}"
obsidian-note-status: active
target-date: "${targetCompletion}T15:00:00"
---

# 🎬 ${courseNumber}강 - ${lectureTitle}

## 📋 기본 정보
- **시리즈**: [[${seriesName}/${seriesName}|📚 ${seriesName}]] (${courseNumber}강)
- **강의명**: ${lectureTitle}
- **강사**: ${instructor}
- **학습 날짜**: ${tp.date.now("YYYY-MM-DD")}
- **강의 시간**: ${totalMinutes}분

---

## 📊 실시간 진행률 & 카운트다운

### ⏰ 학습 일정 & 마감일

\`\`\`dataviewjs
// 날짜 설정
const targetCompletionDate = dv.current()["target-completion-date"];
const actualCompletionDate = dv.current()["completion-date"];
const reviewTargetDate = dv.current()["review-target-date"];
const now = new Date();

// 날짜 차이 계산 함수
function getDaysDiff(date1, date2) {
    return Math.ceil((date2 - date1) / (1000 * 60 * 60 * 24));
}

// 학습 완료 일정 체크
if (actualCompletionDate && actualCompletionDate !== "") {
    // 이미 완료된 경우
    const target = new Date(targetCompletionDate);
    const actual = new Date(actualCompletionDate);
    const daysDiff = getDaysDiff(target, actual);
    const status = daysDiff < 0 ? "조기" : daysDiff > 0 ? "지연" : "정시";
    
    dv.paragraph(\`### 🎉 학습 완료!\`);
    dv.paragraph(\`**목표 완료일**: \${targetCompletionDate}\`);
    dv.paragraph(\`**실제 완료일**: \${actualCompletionDate} (\${status} \${Math.abs(daysDiff)}일)\`);
    
    // 복습 일정 체크
    if (reviewTargetDate) {
        const reviewTarget = new Date(reviewTargetDate);
        const reviewRemaining = getDaysDiff(now, reviewTarget);
        
        if (reviewRemaining > 0) {
            dv.paragraph(\`### 🔄 복습 목표일정\`);
            dv.paragraph(\`**복습 목표일**: \${reviewTargetDate} (D-\${reviewRemaining})\`);
        } else {
            dv.paragraph(\`### 🔄 복습 기간 종료\`);
            dv.paragraph(\`**복습 목표일**: \${reviewTargetDate} (종료됨)\`);
        }
    }
} else if (targetCompletionDate) {
    // 아직 완료되지 않은 경우
    const target = new Date(targetCompletionDate);
    const remaining = getDaysDiff(now, target);
    
    if (remaining > 0) {
        dv.paragraph(\`### ⏰ 목표 완료일까지\`);
        dv.paragraph(\`**D-\${remaining}일** (\${targetCompletionDate}까지)\`);
    } else {
        const overdue = Math.abs(remaining);
        dv.paragraph(\`### ⚠️ 목표일 \${overdue}일 초과\`);
        dv.paragraph(\`**목표 완료일**: \${targetCompletionDate}\`);
        dv.paragraph(\`**지연**: \${overdue}일\`);
    }
}
\`\`\`

---

\`\`\`dataviewjs
// 현재 강의의 학습 진행률 자동 계산
const tasks = dv.current().file.tasks;
const lectureCompletionTasks = tasks.filter(t => 
    t.text.includes("학습 완료") && 
    t.text.includes("#강의학습")
);
const total = lectureCompletionTasks.length;
const done = lectureCompletionTasks.filter(t => t.completed).length;
const percentage = total > 0 ? Math.round((done / total) * 100) : 0;

// 복습 진행률 계산
const content = await dv.io.load(dv.current().file.path);
const targetRounds = dv.current()["target-review-rounds"] || 5;

// 복습 매치 찾기
const reviewRounds = [];
for (let i = 1; i <= targetRounds; i++) {
    const pattern = new RegExp(\`- \\\\[x\\\\] \${i}차 복습 🔄\`, 'g');
    const matches = content.match(pattern) || [];
    reviewRounds.push({
        round: i,
        completed: matches.length,
        total: total,
        progress: total > 0 ? Math.round((matches.length / total) * 100) : 0
    });
}

// 전체 복습 진행률
const totalReviews = reviewRounds.reduce((sum, round) => sum + round.completed, 0);
const totalPossibleReviews = reviewRounds.length * total;
const overallReviewProgress = totalPossibleReviews > 0 ? Math.round((totalReviews / totalPossibleReviews) * 100) : 0;

// 진행바
const progressBar = "▓".repeat(Math.floor(percentage/10)) + "░".repeat(10-Math.floor(percentage/10));
const reviewProgressBar = "🔄".repeat(Math.floor(overallReviewProgress/10)) + "░".repeat(10-Math.floor(overallReviewProgress/10));

// 결과 출력
dv.paragraph(\`### 🎯 강의 진행 현황\`);
dv.paragraph(\`**총 \${total}개 구간 중 \${done}개 완료 (\${percentage}%)**\`);
dv.paragraph(\`**진행바**: \${progressBar}\`);
dv.paragraph(\`<progress value="\${done}" max="\${total}" style="width: 100%; height: 25px;"></progress>\`);

dv.paragraph(\`### 🔄 복습 현황\`);
dv.paragraph(\`**전체 복습 진행률**: \${overallReviewProgress}%\`);
dv.paragraph(\`**복습 진행바**: \${reviewProgressBar}\`);
dv.paragraph(\`<progress value="\${overallReviewProgress}" max="100" style="width: 100%; height: 20px;"></progress>\`);

if (percentage === 100) {
    dv.paragraph(\`### 🎉 강의 완료!\`);
} else if (percentage > 0) {
    dv.paragraph(\`### 📚 학습 진행중\`);
    dv.paragraph(\`**현재 \${percentage}% 진행 중입니다. 계속 화이팅!**\`);
} else {
    dv.paragraph(\`### 🌱 학습 준비 완료\`);
    dv.paragraph(\`**첫 번째 구간부터 시작해보세요!**\`);
}
\`\`\`

---

## ⏱️ 10분 단위 세부 진행`;

// 구간별 템플릿 동적 생성
for (let i = 1; i <= segments; i++) {
    const startTime = (i - 1) * 10;
    const endTime = i * 10;
    
    tR += `

### 📍 ${i}구간 (${startTime}-${endTime}분)
- [ ] **학습 완료** ✅ #강의학습  [completion:: ]
- **주요 내용**:
  \`\`\`
  {{이 구간에서 학습한 핵심 내용을 정리하세요}}
  \`\`\`
- **메모**:
  \`\`\`
  {{추가 메모나 중요 포인트}}
  \`\`\`
- **복습 체크**: 
  - [ ] 1차 복습 🔄 [completion:: ]
  - [ ] 2차 복습 🔄
  - [ ] 3차 복습 🔄
  - [ ] 4차 복습 🔄
  - [ ] 5차 복습 🔄
- **복습 필요**: [ ] (어려운 부분이면 체크)

---`;
}

tR += `

## 📝 전체 정리

### 🎯 핵심 요약
\`\`\`
{{강의 전체의 핵심 내용을 요약하세요}}
\`\`\`

### 💡 새로 배운 내용
\`\`\`
{{이번 강의에서 새롭게 알게 된 내용}}
\`\`\`

### ❓ 질문/의문점
\`\`\`
{{학습 중 생긴 질문이나 의문점을 기록하세요}}
\`\`\`

### 🔄 복습 필요 사항
\`\`\`
{{다시 복습이 필요한 부분이나 어려웠던 내용을 기록하세요}}
\`\`\`

---

## 📈 학습 현황

### ⏱️ 시간 기록
- **시작 시간**: \`$= this["study-start-time"] || "미기록"\`
- **완료 시간**: \`$= this["study-end-time"] || "미기록"\`
- **실제 소요 시간**: \`$= this["actual-time"] || "미기록"\`
- **집중도**: \`$= (this.concentration || "미평가") + " (5점 만점)"\`

### 🎯 전체 평가
- **내용 난이도**: \`$= (this.difficulty ? "⭐".repeat(this.difficulty) + " " + this.difficulty : "미평가") + "/5"\`
- **강의 만족도**: \`$= (this.satisfaction ? "⭐".repeat(this.satisfaction) + " " + this.satisfaction : "미평가") + "/5"\`
- **전체 이해도**: \`$= (this.understanding ? "⭐".repeat(this.understanding) + " " + this.understanding : "미평가") + "/5"\`
- **추천 여부**: \`$= this.recommend || "미평가"\`

---

## 🏷️ 메타데이터 & 수정 정보
- **생성일**: \`$= this.created\`
- **마지막 수정**: \`$= dv.current().file.mtime.toFormat("yyyy-MM-dd HH:mm")\`
- **시리즈**: [[${seriesName}/${seriesName}|📚 ${seriesName}]]
- **강의 번호**: \`$= this["course-number"] + "강"\`
- **상태**: \`$= this.status\`

### ⏰ 일정 관리
- **목표 완료일**: \`$= this["target-completion-date"] || "미설정"\`
- **실제 완료일**: \`$= this["completion-date"] || "미완료"\`
- **복습 목표일**: \`$= this["review-target-date"] || "미설정"\`

---

## ⚡ 빠른 링크

### 🏠 **시리즈 대시보드로 돌아가기**
[[${seriesName}/${seriesName}|🎯 ${seriesName} 대시보드]]

### 🎬 **다음 강의 추가**
\`\`\`button
name 🎬 다음 강의 추가
type command
action QuickAdd: 🎬 새 강의 생성
class next-lecture-btn
\`\`\`

### 🔄 **진행률 새로고침**
\`\`\`button
name 🔄 새로고침
type command
action Dataview: Force Refresh All Views
class refresh-btn
\`\`\`

---

*🎉 "${lectureTitle}" 강의 파일이 성공적으로 생성되었습니다!*  
*📊 시리즈 대시보드에서 전체 진행률을 확인하세요.*  
*📚 첫 번째 구간을 체크하면 바로 진행률이 업데이트됩니다!*

---`;

if (isNewSeries) {
    tR += `\n\n## 🚨 중요 안내\n\n`;
    tR += `**새 시리즈 "${seriesName}"를 위해:**\n`;
    tR += `1. 📊 QuickAdd: 새 시리즈 대시보드 생성 실행\n`;
    tR += `2. 시리즈명: "${seriesName}" 입력\n`;
    tR += `3. 이 파일을 적절한 폴더로 이동\n\n`;
    tR += `*그러면 완벽한 시리즈 관리가 가능합니다!* 🎯`;
}

_%>