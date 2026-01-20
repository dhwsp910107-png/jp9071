<%*
// 📊 시리즈 대시보드 생성기 - Templater 버전
// 새로운 강의 시리즈의 메인 대시보드를 생성합니다

// 1단계: 시리즈 정보 수집
const seriesName = await tp.system.prompt("📚 시리즈명을 입력하세요 (예: 권투강좌20강완료)", "권투강좌20강완료");
if (!seriesName) return;

const subjectName = await tp.system.prompt("🎯 과목명을 입력하세요 (예: 권투)", "권투");
if (!subjectName) return;

const totalLectures = await tp.system.prompt("🔢 총 강의 수를 입력하세요", "20");
if (!totalLectures) return;

const difficulty = await tp.system.prompt("⭐ 예상 난이도 (1-5)", "3");
const expectedPeriod = await tp.system.prompt("📅 예상 완료 기간 (예: 2개월)", "2개월");

// 2단계: 이모지 선택
const emojiOptions = [
    "🥊 권투/격투기",
    "📚 학습/교육", 
    "🎵 음악/예술",
    "💻 프로그래밍",
    "🧪 과학/실험",
    "🏃 운동/피트니스",
    "🍳 요리/베이킹",
    "🎨 디자인/창작",
    "💼 비즈니스",
    "🌱 자기계발"
];

const selectedEmoji = await tp.system.suggester(
    emojiOptions, 
    emojiOptions.map(option => option.split(' ')[0]), 
    false, 
    "🎨 시리즈를 대표할 이모지를 선택하세요"
);

const seriesEmoji = selectedEmoji || "📚";

// 3단계: 확인
const confirmation = await tp.system.suggester(
    [
        `✅ 생성하기 - ${seriesEmoji} ${seriesName}`,
        "❌ 취소하기"
    ],
    [true, false],
    false,
    `📋 시리즈 정보를 확인하세요:\n\n${seriesEmoji} 시리즈: ${seriesName}\n🎯 과목: ${subjectName}\n🔢 강의 수: ${totalLectures}강\n⭐ 난이도: ${difficulty}/5\n📅 기간: ${expectedPeriod}`
);

if (!confirmation) {
    tR += "❌ 시리즈 대시보드 생성이 취소되었습니다.";
    return;
}

// 4단계: 대시보드 템플릿 생성
tR += `---
cssclasses:
  - dashboard
  - series-dashboard
series-name: "${seriesName}"
subject: "${subjectName}"
total-lectures: ${totalLectures}
difficulty: ${difficulty}
expected-period: "${expectedPeriod}"
series-emoji: "${seriesEmoji}"
created: "${tp.date.now("YYYY-MM-DD")}"
tags:
  - 강의학습
  - 시리즈대시보드
  - "${seriesName}"
---

# ${seriesEmoji} ${seriesName} - 시리즈 대시보드

> **${subjectName} 강의 시리즈 통합 관리 센터**  
> 📅 예상 완료: ${expectedPeriod} | ⭐ 난이도: ${difficulty}/5 | 🎯 총 ${totalLectures}강

---

## 📊 전체 진행률 요약

\`\`\`dataviewjs
// 현재 시리즈의 모든 강의 분석
const currentFolder = dv.current().file.folder;
const seriesName = dv.current().file.name;
const allPages = dv.pages(\`"\${currentFolder}"\`);

// 강의 파일만 필터링 (시리즈 대시보드 제외)
const lecturePages = allPages.filter(page => {
    return page.file.name !== seriesName && 
           !page.file.name.includes('플러그인') && 
           !page.file.name.includes('대시보드') &&
           page['course-number'];
});

if (lecturePages.length === 0) {
    dv.paragraph("📝 아직 등록된 강의가 없습니다.");
    dv.paragraph("🚀 새 강의를 추가해보세요!");
} else {
    // 전체 통계 계산
    let totalLectures = lecturePages.length;
    let completedLectures = 0;
    let totalStudyTime = 0;
    let totalProgress = 0;
    let totalReviews = 0;
    
    for (const page of lecturePages) {
        // 개별 강의 진행률 계산
        const tasks = page.file.tasks || [];
        const lectureTasks = tasks.filter(t => t.text.includes("학습 완료") && t.text.includes("#강의학습"));
        const total = lectureTasks.length;
        const done = lectureTasks.filter(t => t.completed).length;
        const individualProgress = total > 0 ? Math.round((done / total) * 100) : 0;
        
        // 완료 상태 판단
        const completionDate = page["completion-date"];
        const hasCompletionDate = completionDate && completionDate !== "" && completionDate !== null;
        const isFullProgress = individualProgress === 100;
        const isCompleted = hasCompletionDate || isFullProgress;
        
        if (isCompleted) completedLectures++;
        totalStudyTime += page["total-minutes"] || 0;
        totalProgress += individualProgress;
        
        // 복습 횟수 계산
        const reviewTasks = tasks.filter(t => t.text.includes("차 복습 🔄") && t.completed);
        totalReviews += reviewTasks.length;
    }
    
    // 평균 진행률 계산
    const averageProgress = totalLectures > 0 ? Math.round(totalProgress / totalLectures) : 0;
    const completionRate = Math.round((completedLectures / totalLectures) * 100);
    
    // 시간 계산
    const totalHours = Math.floor(totalStudyTime / 60);
    const totalMinutes = totalStudyTime % 60;
    const timeDisplay = totalStudyTime > 0 ? 
        (totalHours > 0 ? \`\${totalHours}시간 \${totalMinutes}분\` : \`\${totalMinutes}분\`) : "0분";
    
    // 진행률 바
    const progressBar = '🟩'.repeat(Math.floor(averageProgress/10)) + '⬜'.repeat(10 - Math.floor(averageProgress/10));
    
    // 전체 요약 출력
    dv.paragraph(\`### 📈 시리즈 전체 현황\`);
    dv.paragraph(\`**전체 강의**: \${totalLectures}강\`);
    dv.paragraph(\`**완료 강의**: \${completedLectures}강 (\${completionRate}%)\`);
    dv.paragraph(\`**평균 진행률**: \${averageProgress}%\`);
    dv.paragraph(\`**총 학습 시간**: \${timeDisplay}\`);
    dv.paragraph(\`**완료된 복습**: \${totalReviews}회\`);
    
    dv.paragraph(\`\`);
    dv.paragraph(\`**전체 진행바**: \${progressBar} \${averageProgress}%\`);
    dv.paragraph(\`<progress value="\${averageProgress}" max="100" style="width: 100%; height: 25px; background: linear-gradient(90deg, #6366f1, #8b5cf6);"></progress>\`);
    
    // 상태 결정
    let status = "";
    let statusEmoji = "";
    if (completionRate === 100) {
        status = "시리즈 완료";
        statusEmoji = "🏆";
    } else if (averageProgress >= 80) {
        status = "완료 임박";
        statusEmoji = "🔥";
    } else if (averageProgress >= 50) {
        status = "진행 중";
        statusEmoji = "📚";
    } else if (averageProgress > 0) {
        status = "시작 단계";
        statusEmoji = "🌱";
    } else {
        status = "미시작";
        statusEmoji = "⭕";
    }
    
    dv.paragraph(\`### \${statusEmoji} 현재 상태: \${status}\`);
}
\`\`\`

---

## 📚 강의 목록 및 개별 진행률

\`\`\`dataviewjs
// 개별 강의별 상세 정보
const currentFolder = dv.current().file.folder;
const seriesName = dv.current().file.name;
const allPages = dv.pages(\`"\${currentFolder}"\`);

const lecturePages = allPages.filter(page => {
    return page.file.name !== seriesName && 
           !page.file.name.includes('플러그인') && 
           !page.file.name.includes('대시보드') &&
           page['course-number'];
});

if (lecturePages.length > 0) {
    // 강의 번호순으로 정렬
    const sortedLectures = lecturePages.sort((a, b) => (a['course-number'] || 0) - (b['course-number'] || 0));
    
    const lectureData = sortedLectures.map(page => {
        // 개별 진행률 계산
        const tasks = page.file.tasks || [];
        const lectureTasks = tasks.filter(t => t.text.includes("학습 완료") && t.text.includes("#강의학습"));
        const total = lectureTasks.length;
        const done = lectureTasks.filter(t => t.completed).length;
        const progress = total > 0 ? Math.round((done / total) * 100) : 0;
        
        // 완료 상태
        const completionDate = page["completion-date"];
        const hasCompletionDate = completionDate && completionDate !== "" && completionDate !== null;
        const isCompleted = progress === 100 || hasCompletionDate;
        
        // 복습 현황
        const reviewTasks = tasks.filter(t => t.text.includes("차 복습 🔄") && t.completed);
        const reviewCount = reviewTasks.length;
        
        // 상태 아이콘
        let statusIcon = "";
        if (isCompleted) statusIcon = "✅";
        else if (progress >= 80) statusIcon = "🔥";
        else if (progress > 0) statusIcon = "📚";
        else statusIcon = "⭕";
        
        // 진행률 바 (미니버전)
        const miniBar = '▓'.repeat(Math.floor(progress/20)) + '░'.repeat(5-Math.floor(progress/20));
        
        // 학습 시간
        const studyTime = page["total-minutes"] || 0;
        const timeDisplay = studyTime > 0 ? \`\${studyTime}분\` : "-";
        
        // 완료일 또는 목표일
        let dateInfo = "";
        if (hasCompletionDate) {
            dateInfo = \`완료: \${completionDate}\`;
        } else if (page["target-completion-date"]) {
            const target = new Date(page["target-completion-date"]);
            const now = new Date();
            const daysDiff = Math.ceil((target - now) / (1000 * 60 * 60 * 24));
            if (daysDiff > 0) {
                dateInfo = \`D-\${daysDiff}\`;
            } else if (daysDiff < 0) {
                dateInfo = \`\${Math.abs(daysDiff)}일 초과\`;
            } else {
                dateInfo = "오늘 마감";
            }
        }
        
        return [
            \`\${statusIcon} \${page['course-number']}강\`,
            \`[[\${page.file.path}|\${page['lecture-name'] || page.file.name}]]\`,
            \`\${miniBar} \${progress}%\`,
            timeDisplay,
            reviewCount > 0 ? \`🔄×\${reviewCount}\` : "-",
            dateInfo || "-"
        ];
    });
    
    dv.table(
        ["강의", "제목", "진행률", "시간", "복습", "일정"],
        lectureData
    );
} else {
    dv.paragraph("📝 등록된 강의가 없습니다.");
    dv.paragraph("🎬 새 강의 추가 버튼을 눌러 첫 번째 강의를 만들어보세요!");
}
\`\`\`

---

## 🎯 학습 현황 분석

\`\`\`dataviewjs
// 학습 패턴 분석
const currentFolder = dv.current().file.folder;
const seriesName = dv.current().file.name;
const allPages = dv.pages(\`"\${currentFolder}"\`);

const lecturePages = allPages.filter(page => {
    return page.file.name !== seriesName && 
           !page.file.name.includes('플러그인') && 
           !page.file.name.includes('대시보드') &&
           page['course-number'];
});

if (lecturePages.length > 0) {
    // 난이도별 분포
    const difficultyCount = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0};
    let totalDifficulty = 0;
    let difficultyRated = 0;
    
    // 만족도 분석
    let totalSatisfaction = 0;
    let satisfactionRated = 0;
    
    // 완료 패턴 분석
    let onTimeCompletion = 0;
    let earlyCompletion = 0;
    let lateCompletion = 0;
    let notStarted = 0;
    
    for (const page of lecturePages) {
        // 난이도 분석
        const difficulty = page['difficulty'];
        if (difficulty && difficulty >= 1 && difficulty <= 5) {
            difficultyCount[difficulty]++;
            totalDifficulty += difficulty;
            difficultyRated++;
        }
        
        // 만족도 분석
        const satisfaction = page['satisfaction'];
        if (satisfaction && satisfaction >= 1 && satisfaction <= 5) {
            totalSatisfaction += satisfaction;
            satisfactionRated++;
        }
        
        // 완료 패턴 분석
        const completionDate = page['completion-date'];
        const targetDate = page['target-completion-date'];
        
        if (completionDate && targetDate) {
            const completion = new Date(completionDate);
            const target = new Date(targetDate);
            const daysDiff = Math.ceil((completion - target) / (1000 * 60 * 60 * 24));
            
            if (daysDiff < 0) earlyCompletion++;
            else if (daysDiff > 0) lateCompletion++;
            else onTimeCompletion++;
        } else if (!completionDate) {
            notStarted++;
        }
    }
    
    // 평균 계산
    const avgDifficulty = difficultyRated > 0 ? (totalDifficulty / difficultyRated).toFixed(1) : "미평가";
    const avgSatisfaction = satisfactionRated > 0 ? (totalSatisfaction / satisfactionRated).toFixed(1) : "미평가";
    
    dv.paragraph(\`### 📊 학습 분석\`);
    dv.paragraph(\`**평균 난이도**: \${avgDifficulty}/5.0 ⭐\`);
    dv.paragraph(\`**평균 만족도**: \${avgSatisfaction}/5.0 ⭐\`);
    dv.paragraph(\`\`);
    
    // 완료 패턴
    if (onTimeCompletion + earlyCompletion + lateCompletion > 0) {
        dv.paragraph(\`### ⏰ 완료 패턴\`);
        dv.paragraph(\`**조기 완료**: \${earlyCompletion}강\`);
        dv.paragraph(\`**정시 완료**: \${onTimeCompletion}강\`);
        dv.paragraph(\`**지연 완료**: \${lateCompletion}강\`);
        dv.paragraph(\`**미시작**: \${notStarted}강\`);
        
        const completionEfficiency = Math.round(((earlyCompletion + onTimeCompletion) / (onTimeCompletion + earlyCompletion + lateCompletion)) * 100);
        dv.paragraph(\`**일정 준수율**: \${completionEfficiency}%\`);
    }
}
\`\`\`

---

## ⚡ 빠른 액션

<div class="action-grid">

<div class="action-card" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
<strong>🎬 새 강의 추가</strong><br>
<small>이 시리즈에 새 강의 추가</small>
</div>

<div class="action-card" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);">
<strong>📊 전체 대시보드</strong><br>
[[1-Projects/강의학습시스템/📊 대시보드/📊 폴더강의 전체 대시보드]]
<small>모든 시리즈 통합 현황</small>
</div>

<div class="action-card" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);">
<strong>🚀 슈퍼허브</strong><br>
[[1-Projects/강의학습시스템/🚀 슈퍼허브 대시보드]]
<small>인터랙티브 대시보드</small>
</div>

<div class="action-card" style="background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);">
<strong>🎯 PARA 시스템</strong><br>
[[🎯 PARA 메인 대시보드]]
<small>전체 시스템 관리</small>
</div>

</div>

---

## 🔄 복습 관리

\`\`\`dataviewjs
// 복습이 필요한 강의들 찾기
const currentFolder = dv.current().file.folder;
const seriesName = dv.current().file.name;
const allPages = dv.pages(\`"\${currentFolder}"\`);

const lecturePages = allPages.filter(page => {
    return page.file.name !== seriesName && 
           !page.file.name.includes('플러그인') && 
           !page.file.name.includes('대시보드') &&
           page['course-number'];
});

const reviewNeeded = [];
const now = new Date();

for (const page of lecturePages) {
    const completionDate = page['completion-date'];
    const reviewTargetDate = page['review-target-date'];
    
    if (completionDate && reviewTargetDate) {
        const reviewTarget = new Date(reviewTargetDate);
        const daysDiff = Math.ceil((reviewTarget - now) / (1000 * 60 * 60 * 24));
        
        // 복습 진행률 계산
        const tasks = page.file.tasks || [];
        const lectureTasks = tasks.filter(t => t.text.includes("학습 완료") && t.text.includes("#강의학습"));
        const reviewTasks = tasks.filter(t => t.text.includes("차 복습 🔄") && t.completed);
        const targetReviews = page['target-review-rounds'] || 5;
        const reviewProgress = Math.round((reviewTasks.length / (lectureTasks.length * targetReviews)) * 100);
        
        if (reviewProgress < 100 && daysDiff >= 0) {
            reviewNeeded.push({
                page: page,
                daysLeft: daysDiff,
                reviewProgress: reviewProgress,
                priority: daysDiff <= 3 ? 3 : daysDiff <= 7 ? 2 : 1
            });
        }
    }
}

if (reviewNeeded.length > 0) {
    dv.paragraph(\`### 🔄 복습 필요 강의 (\${reviewNeeded.length}강)\`);
    
    const sortedReviews = reviewNeeded.sort((a, b) => b.priority - a.priority || a.daysLeft - b.daysLeft);
    
    const reviewData = sortedReviews.map((item, index) => {
        const urgencyIcon = item.daysLeft <= 3 ? '🔥' : item.daysLeft <= 7 ? '⚠️' : '📅';
        const progressBar = '🔄'.repeat(Math.floor(item.reviewProgress/20)) + '░'.repeat(5-Math.floor(item.reviewProgress/20));
        const courseNum = item.page['course-number'] || '?';
        const lectureName = item.page['lecture-name'] || item.page.file.name;
        
        return [
            urgencyIcon,
            \`[[\${item.page.file.path}|\${courseNum}강 - \${lectureName}]]\`,
            \`\${progressBar} \${item.reviewProgress}%\`,
            item.daysLeft > 0 ? \`D-\${item.daysLeft}\` : '오늘 마감'
        ];
    });
    
    dv.table(
        ['우선순위', '강의명', '복습 진행률', '마감'],
        reviewData
    );
} else {
    dv.paragraph(\`### ✅ 복습 현황\`);
    dv.paragraph(\`모든 복습이 완료되었거나 예정된 복습이 없습니다.\`);
}
\`\`\`

---

## 🏆 시리즈 성과

\`\`\`dataviewjs
// 성과 및 성취도 분석
const currentFolder = dv.current().file.folder;
const seriesName = dv.current().file.name;
const allPages = dv.pages(\`"\${currentFolder}"\`);

const lecturePages = allPages.filter(page => {
    return page.file.name !== seriesName && 
           !page.file.name.includes('플러그인') && 
           !page.file.name.includes('대시보드') &&
           page['course-number'];
});

if (lecturePages.length > 0) {
    // 전체 통계 재계산
    let totalCompleted = 0;
    let totalStudyTime = 0;
    let totalReviews = 0;
    let highSatisfaction = 0; // 4점 이상
    
    for (const page of lecturePages) {
        const completionDate = page['completion-date'];
        if (completionDate) totalCompleted++;
        
        totalStudyTime += page['total-minutes'] || 0;
        
        const tasks = page.file.tasks || [];
        const reviewTasks = tasks.filter(t => t.text.includes('차 복습 🔄') && t.completed);
        totalReviews += reviewTasks.length;
        
        const satisfaction = page['satisfaction'];
        if (satisfaction && satisfaction >= 4) highSatisfaction++;
    }
    
    const completionRate = Math.round((totalCompleted / lecturePages.length) * 100);
    const avgStudyTime = totalCompleted > 0 ? Math.round(totalStudyTime / totalCompleted) : 0;
    const avgReviewsPerLecture = totalCompleted > 0 ? Math.round(totalReviews / totalCompleted) : 0;
    
    // 성취 등급 계산
    let achievementLevel = "";
    let achievementEmoji = "";
    
    if (completionRate >= 100) {
        achievementLevel = "시리즈 마스터";
        achievementEmoji = "🏆";
    } else if (completionRate >= 80) {
        achievementLevel = "고수";
        achievementEmoji = "🥇";
    } else if (completionRate >= 60) {
        achievementLevel = "숙련자";
        achievementEmoji = "🥈";
    } else if (completionRate >= 40) {
        achievementLevel = "학습자";
        achievementEmoji = "🥉";
    } else {
        achievementLevel = "초보자";
        achievementEmoji = "📚";
    }
    
    dv.paragraph(\`### \${achievementEmoji} 현재 성취도: \${achievementLevel}\`);
    dv.paragraph(\`\`);
    dv.paragraph(\`**🎯 주요 성과**\`);
    dv.paragraph(\`• 완료한 강의: \${totalCompleted}/\${lecturePages.length}강 (\${completionRate}%)\`);
    dv.paragraph(\`• 총 학습 시간: \${Math.floor(totalStudyTime/60)}시간 \${totalStudyTime%60}분\`);
    dv.paragraph(\`• 완료된 복습: \${totalReviews}회\`);
    dv.paragraph(\`• 평균 강의당 학습 시간: \${avgStudyTime}분\`);
    dv.paragraph(\`• 평균 복습 횟수: \${avgReviewsPerLecture}회/강의\`);
    
    if (highSatisfaction > 0) {
        const satisfactionRate = Math.round((highSatisfaction / lecturePages.length) * 100);
        dv.paragraph(\`• 고만족 강의: \${highSatisfaction}강 (\${satisfactionRate}%)\`);
    }
    
    // 다음 목표 제시
    if (completionRate < 100) {
        const remaining = lecturePages.length - totalCompleted;
        dv.paragraph(\`\`);
        dv.paragraph(\`**🎯 다음 목표**\`);
        dv.paragraph(\`• \${remaining}강 더 완료하면 시리즈 완성!\`);
        
        if (avgStudyTime > 0) {
            const estimatedTime = remaining * avgStudyTime;
            const estimatedHours = Math.floor(estimatedTime / 60);
            const estimatedMins = estimatedTime % 60;
            dv.paragraph(\`• 예상 소요 시간: \${estimatedHours}시간 \${estimatedMins}분\`);
        }
    }
}
\`\`\`

---

## 📋 시리즈 정보

- **시리즈명**: ${seriesName}
- **과목**: ${subjectName}
- **총 강의 수**: ${totalLectures}강
- **예상 난이도**: ${difficulty}/5 ⭐
- **예상 완료 기간**: ${expectedPeriod}
- **생성일**: \`$= dv.current().file.ctime.toFormat("yyyy-MM-dd")\`
- **마지막 수정**: \`$= dv.current().file.mtime.toFormat("yyyy-MM-dd HH:mm")\`
- **폴더 위치**: \`$= dv.current().file.folder\`

---

*${seriesEmoji} "${seriesName}" 시리즈 대시보드가 생성되었습니다!*  
*📊 모든 진행률이 실시간으로 업데이트됩니다.*  
*🎯 꾸준한 학습으로 시리즈를 완성해보세요!*

---`;

_%>