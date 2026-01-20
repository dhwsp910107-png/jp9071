// 새로운 모던 대시보드 템플릿 (React 디자인 기반)
function generateModernDashboard(courseName, totalLectures, settings) {
  const today = new Date().toISOString().split('T')[0];
  
  return `---
dashboard: true
course: "${courseName}"
total: ${totalLectures}
created: ${today}
cssclasses: 
  - modern-dashboard
  - lecture-tracker
---

# 📚 ${courseName} - 학습 계획 대시보드

<div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px; color: white; margin-bottom: 30px; text-align: center;">
  <h2 style="margin: 0; font-size: 24px;">📚 ${courseName}</h2>
  <p style="margin: 10px 0 0 0; opacity: 0.9;">총 ${totalLectures}강 • 생성일: ${today}</p>
</div>

## 🎯 학습 현황 대시보드

\`\`\`dataviewjs
// 데이터 수집
const coursePath = "${settings.coursesFolder}/${courseName}";
const totalLectures = ${totalLectures};
const dailyGoal = ${settings.dailyGoal || 3};

const allLectures = dv.pages('"' + coursePath + '"')
  .where(p => p.file.name.includes("강") && p["lecture-tracker"]);

const today = moment().format('YYYY-MM-DD');
const todayLectures = allLectures.where(p => p.date === today);
const completedLectures = allLectures.length;
const progressPercentage = Math.round((completedLectures / totalLectures) * 100);

// 복습 예정 계산
const reviewToday = allLectures.filter(p => {
  if (!p.nextReview) return false;
  return moment(p.nextReview).isSame(moment(), 'day');
}).length;

const urgentReviews = allLectures.filter(p => {
  if (!p.nextReview) return false;
  return moment(p.nextReview).isBefore(moment(), 'day');
}).length;

// 학습 연속일 계산
const recentDates = allLectures
  .map(p => p.date)
  .filter(d => d)
  .sort()
  .reverse();

let streakDays = 0;
let checkDate = moment();
while (recentDates.some(date => moment(date).isSame(checkDate, 'day'))) {
  streakDays++;
  checkDate = moment().subtract(streakDays, 'days');
}

// 완강 예상
const remainingLectures = totalLectures - completedLectures;
const daysToComplete = Math.ceil(remainingLectures / dailyGoal);

// 대시보드 카드들
const cardStyle = "background: #2a2a2a; padding: 25px; border-radius: 12px; border: 1px solid #3a3a3a; margin: 10px;";
const headerStyle = "display: flex; align-items: center; gap: 10px; margin-bottom: 15px; font-weight: 600;";
const valueStyle = "font-size: 36px; font-weight: 700; margin: 8px 0; line-height: 1;";
const labelStyle = "font-size: 14px; color: #999; margin-bottom: 4px;";
const progressStyle = "background: #1a1a1a; height: 8px; border-radius: 4px; overflow: hidden; margin: 12px 0;";

const dashboardHTML = \`
<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 15px; margin: 20px 0;">

  <!-- 오늘 학습 계획 -->
  <div style="\${cardStyle}">
    <div style="\${headerStyle}">
      <span style="font-size: 24px;">🎯</span>
      <span>오늘 학습 계획</span>
    </div>
    <div style="\${valueStyle} color: #667eea;">\${todayLectures.length} / \${dailyGoal}강</div>
    <div style="\${labelStyle}">예상 소요: \${dailyGoal * ${settings.estimatedTimePerLecture || 30}}분</div>
    <div style="\${progressStyle}">
      <div style="height: 100%; background: linear-gradient(90deg, #667eea 0%, #764ba2 100%); width: \${Math.min((todayLectures.length / dailyGoal) * 100, 100)}%; transition: width 0.8s ease;"></div>
    </div>
  </div>

  <!-- 전체 진행률 -->
  <div style="\${cardStyle}">
    <div style="\${headerStyle}">
      <span style="font-size: 24px;">📈</span>
      <span>전체 진행률</span>
    </div>
    <div style="\${valueStyle} color: #10b981;">\${completedLectures} / \${totalLectures}강</div>
    <div style="\${labelStyle}">\${progressPercentage}% 완료</div>
    <div style="\${progressStyle}">
      <div style="height: 100%; background: linear-gradient(90deg, #10b981 0%, #059669 100%); width: \${progressPercentage}%; transition: width 0.8s ease;"></div>
    </div>
  </div>

  <!-- 학습 연속일 -->
  <div style="\${cardStyle}">
    <div style="\${headerStyle}">
      <span style="font-size: 24px;">🔥</span>
      <span>학습 연속일</span>
    </div>
    <div style="\${valueStyle} color: #f59e0b;">\${streakDays}일</div>
    <div style="\${labelStyle}">꾸준히 학습 중</div>
  </div>

  <!-- 완강 예상 -->
  <div style="\${cardStyle}">
    <div style="\${headerStyle}">
      <span style="font-size: 24px;">⏰</span>
      <span>완강 예상</span>
    </div>
    <div style="\${valueStyle} color: #ef4444;">D-\${daysToComplete}</div>
    <div style="\${labelStyle}">약 \${daysToComplete}일 후</div>
  </div>

</div>
\`;

dv.el('div', dashboardHTML);
\`\`\`

## 📅 복습 스케줄

\`\`\`dataviewjs
const coursePath = "${settings.coursesFolder}/${courseName}";
const allLectures = dv.pages('"' + coursePath + '"')
  .where(p => p.file.name.includes("강") && p["lecture-tracker"]);

// 복습 예정 강의들
const reviewToday = allLectures.filter(p => {
  if (!p.nextReview) return false;
  return moment(p.nextReview).isSame(moment(), 'day');
});

const reviewTomorrow = allLectures.filter(p => {
  if (!p.nextReview) return false;
  return moment(p.nextReview).isSame(moment().add(1, 'day'), 'day');
});

const reviewThisWeek = allLectures.filter(p => {
  if (!p.nextReview) return false;
  const reviewDate = moment(p.nextReview);
  return reviewDate.isAfter(moment().add(1, 'day')) && 
         reviewDate.isSameOrBefore(moment().add(7, 'days'));
});

const scheduleStyle = "background: #2a2a2a; padding: 25px; border-radius: 12px; border: 1px solid #3a3a3a; margin: 20px 0;";
const groupStyle = "margin-bottom: 15px;";
const labelStyle = "font-size: 14px; color: #999; margin-bottom: 10px; font-weight: 600;";
const chipContainerStyle = "display: flex; gap: 8px; flex-wrap: wrap;";

// 복습 칩 생성 함수
const createChips = (lectures, chipClass) => {
  return lectures.slice(0, 10).map(p => 
    \`<span style="padding: 6px 12px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; transition: transform 0.2s;" class="\${chipClass}" onclick="app.workspace.openLinkText('\${p.file.name}', '')">\${p.current || '?'}강</span>\`
  ).join('');
};

const scheduleHTML = \`
<div style="\${scheduleStyle}">
  <h3 style="margin: 0 0 20px 0; font-size: 18px;">📅 복습 스케줄</h3>
  
  <div style="\${groupStyle}">
    <div style="\${labelStyle}">오늘 복습 (\${reviewToday.length}강)</div>
    <div style="\${chipContainerStyle}">
      \${createChips(reviewToday, 'chip-urgent')}
    </div>
  </div>

  <div style="\${groupStyle}">
    <div style="\${labelStyle}">내일 복습 (\${reviewTomorrow.length}강)</div>
    <div style="\${chipContainerStyle}">
      \${createChips(reviewTomorrow, 'chip-tomorrow')}
    </div>
  </div>

  <div style="\${groupStyle}">
    <div style="\${labelStyle}">이번 주 복습 (\${reviewThisWeek.length}강)</div>
    <div style="\${chipContainerStyle}">
      \${createChips(reviewThisWeek, 'chip-week')}
    </div>
  </div>
</div>

<style>
.chip-urgent { background: #ef4444; color: white; }
.chip-tomorrow { background: #f59e0b; color: white; }
.chip-week { background: #667eea; color: white; }
.chip-urgent:hover, .chip-tomorrow:hover, .chip-week:hover { transform: scale(1.05); }
</style>
\`;

dv.el('div', scheduleHTML);
\`\`\`

## 📚 최근 학습 강의

\`\`\`dataviewjs
const coursePath = "${settings.coursesFolder}/${courseName}";
const allLectures = dv.pages('"' + coursePath + '"')
  .where(p => p.file.name.includes("강") && p["lecture-tracker"]);

if (allLectures.length > 0) {
  const recentLectures = allLectures
    .sort((a, b) => moment(b.date || '1900-01-01').valueOf() - moment(a.date || '1900-01-01').valueOf())
    .slice(0, 5);

  const tableStyle = \`
  <style>
  .recent-table { 
    width: 100%; 
    border-collapse: collapse; 
    background: #2a2a2a; 
    border-radius: 12px; 
    overflow: hidden; 
    margin: 20px 0; 
  }
  .recent-table th { 
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
    color: white; 
    padding: 15px; 
    text-align: left; 
    font-weight: 600; 
  }
  .recent-table td { 
    padding: 12px 15px; 
    border-bottom: 1px solid #3a3a3a; 
    color: #e0e0e0; 
  }
  .recent-table tr:hover { 
    background: rgba(102, 126, 234, 0.1); 
    cursor: pointer; 
  }
  .progress-badge {
    padding: 4px 10px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 600;
    background: #667eea;
    color: white;
  }
  .understanding-emoji {
    font-size: 20px;
  }
  </style>
  \`;

  const tableHTML = \`
  \${tableStyle}
  <table class="recent-table">
    <thead>
      <tr>
        <th>강의</th>
        <th>제목</th>
        <th>진행</th>
        <th>이해도</th>
        <th>최근학습</th>
        <th>피드백</th>
      </tr>
    </thead>
    <tbody>
      \${recentLectures.map(p => {
        const understanding = {
          'perfect': '😊',
          'good': '🙂', 
          'ok': '😐',
          'bad': '😞'
        }[p.understanding] || '❓';
        
        return \`
          <tr onclick="app.workspace.openLinkText('\${p.file.name}', '')">
            <td style="font-weight: 600;">\${p.current || '?'}강</td>
            <td>\${p.title || '제목 없음'}</td>
            <td><span class="progress-badge">✓ \${p.repeatCount || 0}회</span></td>
            <td><span class="understanding-emoji">\${understanding}</span></td>
            <td style="font-size: 13px; color: #999;">\${p.date || '-'}</td>
            <td style="font-size: 13px; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">\${(p.feedback || '피드백 없음').substring(0, 50)}...</td>
          </tr>
        \`;
      }).join('')}
    </tbody>
  </table>
  \`;
  
  dv.el('div', tableHTML);
} else {
  const emptyHTML = \`
  <div style="background: #2a2a2a; padding: 40px; border-radius: 12px; text-align: center; color: #999; border: 1px solid #3a3a3a;">
    <div style="font-size: 48px; margin-bottom: 16px;">📚</div>
    <h3 style="margin: 0 0 8px 0;">아직 학습한 강의가 없습니다</h3>
    <p style="margin: 0;">새로운 강의를 시작해보세요! 🚀</p>
  </div>
  \`;
  
  dv.el('div', emptyHTML);
}
\`\`\`

## 📊 학습 통계 & 시각화

\`\`\`dataviewjs
const coursePath = "${settings.coursesFolder}/${courseName}";
const allLectures = dv.pages('"' + coursePath + '"')
  .where(p => p.file.name.includes("강") && p["lecture-tracker"]);

if (allLectures.length > 0) {
  // 강의별 반복 횟수 차트 (React 디자인 참고)
  const chartHTML = \`
  <div style="background: #2a2a2a; padding: 30px; border-radius: 12px; border: 1px solid #3a3a3a; margin: 20px 0;">
    <h3 style="margin: 0 0 20px 0;">📊 강의별 반복 통계</h3>
    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(35px, 1fr)); gap: 8px; max-height: 200px; overflow-y: auto;">
      \${Array.from({length: ${totalLectures}}, (_, i) => {
        const lectureNum = i + 1;
        const lecture = allLectures.find(p => (p.current || 0) === lectureNum);
        const repeats = lecture ? (lecture.repeatCount || 0) : 0;
        const maxHeight = 80;
        const height = repeats > 0 ? Math.max(15, (repeats / 10) * maxHeight) : 12;
        
        let color = '#444';  // 미수강
        if (repeats > 0) {
          if (repeats < 3) color = '#ef4444';      // 빨강 (1-2회)
          else if (repeats < 6) color = '#f59e0b'; // 주황 (3-5회)  
          else color = '#10b981';                  // 초록 (6회 이상)
        }
        
        return \`
          <div style="display: flex; flex-direction: column; align-items: center; gap: 4px; cursor: pointer;" 
               onclick="app.workspace.openLinkText('\${lectureNum}강', '')"
               title="\${lectureNum}강: \${repeats}회 반복\${lecture ? '\\n최근: ' + (lecture.date || '미수강') : ''}">
            \${repeats > 0 ? \`<div style="font-size: 10px; color: #667eea; font-weight: 600;">\${repeats}</div>\` : ''}
            <div style="width: 100%; height: \${height}px; background: \${color}; border-radius: 2px; \${repeats === 0 ? 'border: 1px dashed #666;' : ''} transition: all 0.3s;">
              \${repeats === 0 ? '<div style="text-align: center; color: #666; font-size: 8px; line-height: ' + height + 'px;">×</div>' : ''}
            </div>
            <div style="font-size: 9px; color: #999;">\${lectureNum}</div>
          </div>
        \`;
      }).join('')}
    </div>
    
    <div style="margin-top: 20px; padding: 15px; background: #1a1a1a; border-radius: 8px; font-size: 13px; color: #999;">
      💡 <strong style="color: #fff;">사용법:</strong> 막대 클릭으로 강의 노트 열기 | 
      <span style="color: #ef4444;">■</span> 1-2회 
      <span style="color: #f59e0b;">■</span> 3-5회 
      <span style="color: #10b981;">■</span> 6회 이상 
      <span style="color: #444;">▢</span> 미수강
    </div>
  </div>
  \`;

  dv.el('div', chartHTML);

  // 이해도 및 반복 통계
  const statsHTML = \`
  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin: 20px 0;">
    
    <!-- 이해도 분포 -->
    <div style="background: #2a2a2a; padding: 20px; border-radius: 12px; border: 1px solid #3a3a3a;">
      <h4 style="margin: 0 0 15px 0;">📈 이해도 분포</h4>
      \${['perfect', 'good', 'ok', 'bad'].map(level => {
        const count = allLectures.filter(p => p.understanding === level).length;
        const percentage = Math.round((count / allLectures.length) * 100);
        const emoji = {'perfect': '😊', 'good': '🙂', 'ok': '😐', 'bad': '😞'}[level];
        const label = {'perfect': '완벽', 'good': '좋음', 'ok': '보통', 'bad': '부족'}[level];
        
        return \`
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span>\${emoji} \${label}</span>
            <span style="font-weight: 600;">\${count}강 (\${percentage}%)</span>
          </div>
        \`;
      }).join('')}
    </div>

    <!-- 반복 학습 현황 -->
    <div style="background: #2a2a2a; padding: 20px; border-radius: 12px; border: 1px solid #3a3a3a;">
      <h4 style="margin: 0 0 15px 0;">🔄 반복 학습 현황</h4>
      \${[
        {label: '1회', count: allLectures.filter(p => (p.repeatCount || 0) === 1).length},
        {label: '2회', count: allLectures.filter(p => (p.repeatCount || 0) === 2).length}, 
        {label: '3회', count: allLectures.filter(p => (p.repeatCount || 0) === 3).length},
        {label: '4회+', count: allLectures.filter(p => (p.repeatCount || 0) >= 4).length}
      ].map(stat => {
        const percentage = Math.round((stat.count / allLectures.length) * 100);
        return \`
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span>\${stat.label}</span>
            <span style="font-weight: 600;">\${stat.count}강 (\${percentage}%)</span>
          </div>
        \`;
      }).join('')}
    </div>
    
  </div>
  \`;

  dv.el('div', statsHTML);
}
\`\`\`

---

## 🎯 빠른 액션

<div style="display: flex; gap: 15px; justify-content: center; margin: 30px 0; flex-wrap: wrap;">
  <button style="padding: 12px 24px; background: #667eea; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;" onclick="app.commands.executeCommandById('smart-lecture-tracker:create-lecture-note')">📝 새 강의 추가</button>
  <button style="padding: 12px 24px; background: #10b981; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;" onclick="app.commands.executeCommandById('smart-lecture-tracker:show-today-review')">📚 오늘 복습</button>
  <button style="padding: 12px 24px; background: #f59e0b; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;" onclick="app.setting.open()">⚙️ 설정</button>
</div>

---

<div style="text-align: center; margin-top: 40px; padding: 20px; background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%); border-radius: 12px;">

### 💡 메타인지 학습 팁

**효과적인 복습 전략**: 학습 후 즉시 복습보다는 시간 간격을 두고 반복하는 것이 더 효과적입니다.

**자기 점검**: "이 개념을 다른 사람에게 설명할 수 있을까?" 스스로에게 질문해보세요.

**취약점 파악**: 빨간색으로 표시된 강의들을 우선적으로 복습하세요.

</div>

---

*📝 생성일: ${today} | 🔄 새로고침하려면 이 페이지를 다시 열어보세요*`;
}

module.exports = { generateModernDashboard };