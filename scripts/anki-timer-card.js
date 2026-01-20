// 타이머 카드 - Study Dashboard 연동 버전

module.exports = async (params) => {
    const { quickAddApi: QuickAdd, app } = params;
    
    try {
        // Study Dashboard 연동을 위한 기본 정보
        const number = await QuickAdd.inputPrompt("문제 번호:", "");
        if (!number) return;
        
        const title = await QuickAdd.inputPrompt("문제 제목:", "");
        if (!title) return;
        
        const subject = await QuickAdd.suggester(
            ["수학", "영어", "과학", "국어", "사회", "한국사", "기타"],
            ["수학", "영어", "과학", "국어", "사회", "한국사", "기타"]
        );
        if (!subject) return;
        
        // 타이머 시간 설정
        const timerMinutes = await QuickAdd.inputPrompt("타이머 시간(분):", "5");
        const timerSeconds = parseInt(timerMinutes) * 60 || 300;
        
        // 선택 정보
        const source = await QuickAdd.inputPrompt("출처 (선택):", "");
        const hint = await QuickAdd.inputPrompt("힌트 (선택):", "");
        
        // Study Dashboard 연동 데이터
        const today = new Date().toISOString().split('T')[0];
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const nextReview = tomorrow.toISOString().split('T')[0];
        
        const fileName = `${number}. ${title}.md`;
        const filePath = `학습관리/문제은행/${subject}/${fileName}`;
        
        // 폴더 생성
        const folder = app.vault.getAbstractFileByPath(`학습관리/문제은행/${subject}`);
        if (!folder) {
            await app.vault.createFolder(`학습관리/문제은행/${subject}`);
        }
        
        // Study Dashboard 연동 frontmatter 포함 파일 내용
        const content = `---
number: ${number}
title: "${title}"
subject: ${subject}
source: "${source}"
status: learning
difficulty: 3
reviewCount: 0
lastReview: ${today}
nextReview: ${nextReview}
created: ${today}
avgTime: 0
totalTime: 0
timerDuration: ${timerSeconds}
tags: [anki-card, timer-card, ${subject}]
type: timed-flashcard
---

# ${number}. ${title}

> 과목: ${subject} | 출처: ${source} | 제한시간: ${Math.floor(timerSeconds/60)}분

---

## 문제

<!-- Ctrl+V로 문제 이미지 붙여넣기 -->


---

## 타이머 & 컨트롤

<div id="timer-container">
  <div id="timer-display">준비</div>
  <div id="timer-controls">
    <button id="start-btn">시작</button>
    <button id="pause-btn" disabled>일시정지</button>
    <button id="reset-btn" disabled>재설정</button>
  </div>
  <div id="timer-progress">
    <div id="progress-bar"></div>
  </div>
</div>

---

## 힌트

<div class="hint-section">
  <button class="hint-toggle-btn">힌트 보기/숨기기</button>
  <div class="hint-content">
    ${hint || '힌트 없음'}
  </div>
</div>

---

## 정답

<div class="answer-section">
  <button class="answer-btn">정답 & 해설 보기</button>
  <div class="answer-content" style="display: none;">
    
    ### 답안 및 해설 과정
    
    <!-- Ctrl+V로 답안/해설 이미지 붙여넣기 -->
    
    
    ### 추가 설명
    여기에 필요한 추가 해설을 작성하세요.
  </div>
</div>

---

## 복습 기록 (Study Dashboard 연동)

| 날짜 | 결과 | 소요시간 | 메모 |
|------|------|----------|------|
| ${today} | ⬜ Again / ⬜ Hard / ⬜ Good / ⬜ Easy | - |  |

---

\`\`\`dataviewjs
// Study Dashboard 연동 진행률
const file = dv.current();
const bar = (val, max) => {
    const filled = Math.floor((val / max) * 20);
    return '█'.repeat(filled) + '░'.repeat(20 - filled);
};

const statusEmoji = {
    'learning': '🔴',
    'reviewing': '🟡',
    'mastered': '🟢'
};

if (file.reviewCount !== undefined) {
    dv.paragraph(\`
**복습 진행률**: \${bar(file.reviewCount, 10)} \${file.reviewCount}/10회
**상태**: \${statusEmoji[file.status] || '🔴'} \${file.status === 'learning' ? '학습중' : file.status === 'reviewing' ? '복습중' : '완전숙달'}
**평균 시간**: \${Math.floor((file.avgTime || 0) / 60)}분 \${(file.avgTime || 0) % 60}초
**총 학습시간**: \${Math.floor((file.totalTime || 0) / 60)}분
\`);
}
\`\`\`

---

<style>
/* 타이머 스타일 */
#timer-container {
  text-align: center;
  padding: 20px;
  background: linear-gradient(145deg, #f8f9fa, #e9ecef);
  border-radius: 15px;
  margin: 20px 0;
  box-shadow: 0 4px 15px rgba(0,0,0,0.1);
}

#timer-display {
  font-size: 3.5rem;
  font-weight: bold;
  color: #2c3e50;
  margin-bottom: 15px;
  padding: 20px;
  background: #fff;
  border-radius: 12px;
  border: 3px solid #e9ecef;
  font-family: 'Courier New', monospace;
}

#timer-display.warning {
  color: #e67e22;
  background: #fef9e7;
  border-color: #e67e22;
  box-shadow: 0 0 20px rgba(230, 126, 34, 0.3);
}

#timer-display.danger {
  color: #e74c3c;
  background: #fdedec;
  border-color: #e74c3c;
  animation: pulse 0.8s infinite;
  box-shadow: 0 0 30px rgba(231, 76, 60, 0.5);
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.8; transform: scale(1.02); }
}

#timer-controls {
  margin: 20px 0;
  display: flex;
  justify-content: center;
  gap: 15px;
}

#timer-controls button {
  padding: 12px 25px;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  font-weight: bold;
  font-size: 1.1rem;
  transition: all 0.3s;
  min-width: 100px;
}

#start-btn {
  background: linear-gradient(145deg, #27ae60, #2ecc71);
  color: white;
}

#pause-btn {
  background: linear-gradient(145deg, #f39c12, #e67e22);
  color: white;
}

#reset-btn {
  background: linear-gradient(145deg, #e74c3c, #c0392b);
  color: white;
}

#timer-controls button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

#timer-controls button:hover:not(:disabled) {
  transform: translateY(-3px);
  box-shadow: 0 6px 20px rgba(0,0,0,0.3);
}

#timer-progress {
  width: 100%;
  height: 12px;
  background: #ecf0f1;
  border-radius: 6px;
  overflow: hidden;
  margin-top: 20px;
  border: 2px solid #bdc3c7;
}

#progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #27ae60, #2ecc71);
  width: 100%;
  transition: width 0.1s linear;
}

#progress-bar.warning {
  background: linear-gradient(90deg, #f39c12, #e67e22);
}

#progress-bar.danger {
  background: linear-gradient(90deg, #e74c3c, #c0392b);
}

/* 힌트 섹션 */
.hint-section {
  margin: 20px 0;
}

.hint-toggle-btn {
  width: 100%;
  padding: 15px;
  background: linear-gradient(145deg, #3498db, #2980b9);
  color: white;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  font-size: 1.2rem;
  font-weight: bold;
  transition: all 0.3s;
}

.hint-toggle-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(52, 152, 219, 0.3);
}

.hint-content {
  margin-top: 15px;
  padding: 20px;
  background: #e8f4f8;
  border: 2px solid #3498db;
  border-radius: 10px;
  color: #2c3e50;
  font-weight: 500;
}

/* 정답 섹션 */
.answer-section {
  margin: 20px 0;
}

.answer-btn {
  width: 100%;
  padding: 18px;
  background: linear-gradient(145deg, #27ae60, #2ecc71);
  color: white;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  font-size: 1.3rem;
  font-weight: bold;
  transition: all 0.3s;
}

.answer-btn:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 25px rgba(39, 174, 96, 0.4);
}

.answer-btn.clicked {
  background: linear-gradient(145deg, #8e44ad, #9b59b6);
}

.answer-content {
  margin-top: 20px;
  padding: 25px;
  background: #f8f9fa;
  border: 2px solid #27ae60;
  border-radius: 12px;
}

/* 이미지 스타일 */
img {
  max-width: 100%;
  height: auto;
  border-radius: 10px;
  margin: 15px 0;
  box-shadow: 0 4px 15px rgba(0,0,0,0.1);
}
</style>

<script>
let timerInterval;
let totalTime = ${timerSeconds};
let currentTime = totalTime;
let isRunning = false;
let isPaused = false;
let startTime = null;

const timerDisplay = document.getElementById('timer-display');
const startBtn = document.getElementById('start-btn');
const pauseBtn = document.getElementById('pause-btn');
const resetBtn = document.getElementById('reset-btn');
const progressBar = document.getElementById('progress-bar');
const hintToggleBtn = document.querySelector('.hint-toggle-btn');
const hintContent = document.querySelector('.hint-content');
const answerBtn = document.querySelector('.answer-btn');
const answerContent = document.querySelector('.answer-content');

// 시간 포맷팅
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins + ':' + (secs < 10 ? '0' : '') + secs;
}

// 초기 표시
timerDisplay.textContent = formatTime(currentTime);

// 타이머 업데이트
function updateTimer() {
    timerDisplay.textContent = formatTime(currentTime);
    
    const progress = (currentTime / totalTime) * 100;
    progressBar.style.width = progress + '%';
    
    // 색상 변경
    timerDisplay.className = '';
    progressBar.className = '';
    
    if (currentTime <= 10) {
        timerDisplay.classList.add('danger');
        progressBar.classList.add('danger');
    } else if (currentTime <= 30) {
        timerDisplay.classList.add('warning');
        progressBar.classList.add('warning');
    }
    
    if (currentTime <= 0) {
        clearInterval(timerInterval);
        timerDisplay.textContent = '시간 종료!';
        isRunning = false;
        
        // 총 소요시간 계산 (Study Dashboard 연동)
        const elapsedTime = totalTime;
        updateStudyDashboardData(elapsedTime);
        
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('⏰ 시간 종료!', {
                body: '문제 풀이 시간이 끝났습니다.'
            });
        }
        return;
    }
    
    currentTime--;
}

// Study Dashboard 데이터 업데이트 함수
function updateStudyDashboardData(elapsedSeconds) {
    // frontmatter의 totalTime과 avgTime을 업데이트하는 로직
    // (실제 구현은 Obsidian API 접근이 필요)
    console.log('Study Dashboard 업데이트:', elapsedSeconds + '초 소요');
}

// 타이머 컨트롤
startBtn.onclick = () => {
    if (!isRunning) {
        isRunning = true;
        startTime = Date.now();
        timerInterval = setInterval(updateTimer, 1000);
        startBtn.disabled = true;
        pauseBtn.disabled = false;
        resetBtn.disabled = false;
        startBtn.textContent = '실행중...';
    }
};

pauseBtn.onclick = () => {
    if (isRunning && !isPaused) {
        clearInterval(timerInterval);
        isPaused = true;
        pauseBtn.textContent = '재시작';
    } else if (isPaused) {
        timerInterval = setInterval(updateTimer, 1000);
        isPaused = false;
        pauseBtn.textContent = '일시정지';
    }
};

resetBtn.onclick = () => {
    clearInterval(timerInterval);
    currentTime = totalTime;
    isRunning = false;
    isPaused = false;
    startBtn.disabled = false;
    pauseBtn.disabled = true;
    resetBtn.disabled = true;
    startBtn.textContent = '시작';
    pauseBtn.textContent = '일시정지';
    updateTimer();
};

// 힌트 토글 (시작 전부터 사용 가능)
hintToggleBtn.onclick = () => {
    if (hintContent.style.display === 'none') {
        hintContent.style.display = 'block';
    } else {
        hintContent.style.display = 'none';
    }
};

// 정답 버튼 (타이머 자동 중지)
answerBtn.onclick = () => {
    // 타이머 중지
    if (isRunning) {
        clearInterval(timerInterval);
        isRunning = false;
        
        // 실제 소요시간 계산
        const actualTime = totalTime - currentTime;
        updateStudyDashboardData(actualTime);
    }
    
    if (answerContent.style.display === 'none') {
        answerContent.style.display = 'block';
        answerBtn.textContent = '정답 숨기기';
        answerBtn.classList.add('clicked');
    } else {
        answerContent.style.display = 'none';
        answerBtn.textContent = '정답 & 해설 보기';
        answerBtn.classList.remove('clicked');
    }
};

// 초기에 힌트 보이게 설정
hintContent.style.display = 'block';

// 알림 권한 요청
if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
}
</script>

---

*⏱️ Study Dashboard 연동 타이머 카드*
`;

        // 파일 생성 및 열기
        const file = await app.vault.create(filePath, content);
        const leaf = app.workspace.getLeaf(false);
        await leaf.openFile(file);
        
        new Notice(`타이머 카드 생성 완료!\n• 제한시간: ${Math.floor(timerSeconds/60)}분\n• Study Dashboard 연동됨`);
        
    } catch (error) {
        new Notice("오류: " + error.message);
        console.error(error);
    }
};
