// Anki 카드 생성 - 버튼 토글 방식 (전체 기능)

module.exports = async (params) => {
    const { quickAddApi: QuickAdd, app } = params;
    
    try {
        // 1. 기본 정보
        const number = await QuickAdd.inputPrompt("문제 번호:", "");
        if (!number) return;
        
        const title = await QuickAdd.inputPrompt("문제 제목:", "");
        if (!title) return;
        
        const subject = await QuickAdd.suggester(
            ["수학", "영어", "과학", "국어", "사회", "한국사", "기타"],
            ["수학", "영어", "과학", "국어", "사회", "한국사", "기타"]
        );
        if (!subject) return;
        
        // 2. 출처 정보
        const source = await QuickAdd.inputPrompt("출처 (교재/강의):", "", "예: 수학의 정석");
        const page = await QuickAdd.inputPrompt("페이지/회차:", "", "예: p.145");
        
        // 3. 힌트 (선택)
        const hint = await QuickAdd.inputPrompt("힌트 (선택, Enter 스킵):", "");
        
        // 4. 개념 (2개)
        const concept1 = await QuickAdd.inputPrompt("핵심 개념 1:", "");
        const concept2 = await QuickAdd.inputPrompt("핵심 개념 2 (선택):", "");
        
        // 5. 해설 (선택)
        const explanation = await QuickAdd.inputPrompt("해설 (선택):", "");
        
        // 6. 출처 상세 (선택)
        const sourceDetail = await QuickAdd.inputPrompt("출처 상세 (선택):", "");
        
        // 7. 날짜
        const today = new Date().toISOString().split('T')[0];
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const nextReview = tomorrow.toISOString().split('T')[0];
        
        // 8. 파일명 및 경로
        const fileName = `${number}. ${title}.md`;
        const filePath = `학습관리/문제은행/${subject}/${fileName}`;
        
        // 9. 폴더 생성
        const folder = app.vault.getAbstractFileByPath(`학습관리/문제은행/${subject}`);
        if (!folder) {
            await app.vault.createFolder(`학습관리/문제은행/${subject}`);
        }
        
        // 10. 파일 내용
        const content = `---
number: ${number}
title: "${title}"
subject: ${subject}
source: "${source}"
page: "${page}"
concept: "${concept1}${concept2 ? `, ${concept2}` : ''}"
status: learning
difficulty: 3
reviewCount: 0
lastReview: ${today}
nextReview: ${nextReview}
created: ${today}
avgTime: 0
totalTime: 0
tags: [anki-card, ${subject}]
type: image-flashcard
---

# ${number}. ${title}

> 📚 **출처**: ${source}${page ? ` (${page})` : ''}  
> 📖 **과목**: ${subject}

---

## 📸 문제

<!-- 🎯 Ctrl+V로 문제 이미지 붙여넣기 -->


---

<!-- 힌트 버튼 - 길게 누르면 보임 -->
<div class="hint-area">
  <div class="hint-button">
    <div class="hint-content">
      <div class="hint-icon">💡</div>
      <div class="hint-text">힌트</div>
      <div class="hint-subtext">길게 누르기</div>
      <div class="hint-progress">
        <div class="hint-progress-bar"></div>
      </div>
    </div>
  </div>
</div>

<div class="hint-box hidden-content">
  <div class="hint-header">💡 힌트</div>
  <div class="hint-body">
    ${hint || '힌트가 제공되지 않았습니다'}
  </div>
</div>

---

<!-- 정답 버튼 - 클릭하면 모든 답 보임 -->
<div class="answer-area">
  <div class="answer-button">
    <div class="answer-content">
      <div class="answer-icon">✅</div>
      <div class="answer-text">정답 확인</div>
      <div class="answer-subtext">클릭하기</div>
    </div>
  </div>
</div>

<div class="answer-section hidden-answer">

## ✅ 답안 및 풀이

<!-- 🎯 Ctrl+V로 답안 이미지 붙여넣기 -->


### 📝 해설
${explanation || ''}

### 🔑 핵심 개념
${concept1 ? `- [[${concept1}]]` : '- [[]]'}
${concept2 ? `- [[${concept2}]]` : '- [[]]'}

### 📖 출처
${sourceDetail || source}

</div>

---

## 📊 복습 기록

| 날짜 | 결과 | 시간 | 메모 |
|------|------|------|------|
| ${today} | ⬜ Again / ⬜ Hard / ⬜ Good / ⬜ Easy | - |  |

---

\`\`\`dataviewjs
// 복습 진행률
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
**총 학습시간**: \${Math.floor((file.totalTime || 0) / 60)}분
\`);
}
\`\`\`

---

<style>
/* 기본 설정 */
* {
  box-sizing: border-box;
}

/* 이미지 크기 조절 - 모바일 최적화 */
img {
  max-width: 100%;
  height: auto;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  margin: 12px 0;
  display: block;
}

/* 문제 이미지 크기 제한 */
.markdown-preview-view img:first-of-type {
  max-width: min(600px, 100%);
  max-height: 450px;
  object-fit: contain;
  margin: 16px auto;
}

/* 답안 이미지 크기 제한 */
.answer-section img {
  max-width: min(550px, 100%);
  max-height: 400px;
  object-fit: contain;
  margin: 16px auto;
}

/* 모바일에서 이미지 터치 최적화 */
@media (max-width: 768px) {
  img {
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
  
  .markdown-preview-view img:first-of-type,
  .answer-section img {
    max-height: 350px;
  }
}

/* 힌트 영역 - 모바일 최적화 */
.hint-area {
  width: 100%;
  padding: 8px;
  margin: 24px 0;
  cursor: pointer;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

.hint-button {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 20px 24px;
  border-radius: 16px;
  border: none;
  box-shadow: 
    0 8px 16px rgba(102, 126, 234, 0.25),
    0 2px 4px rgba(0, 0, 0, 0.1);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  text-align: center;
  position: relative;
  overflow: hidden;
}

.hint-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  position: relative;
  z-index: 1;
}

.hint-icon {
  font-size: clamp(2rem, 8vw, 2.5rem);
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

.hint-text {
  font-size: clamp(1.1rem, 4vw, 1.3rem);
  font-weight: 700;
  letter-spacing: 0.5px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.hint-subtext {
  font-size: clamp(0.75rem, 3vw, 0.85rem);
  opacity: 0.85;
  font-weight: 500;
  letter-spacing: 0.3px;
}

/* 진행 바 */
.hint-progress {
  width: 100%;
  height: 4px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
  overflow: hidden;
  margin-top: 8px;
}

.hint-progress-bar {
  height: 100%;
  width: 0%;
  background: rgba(255, 255, 255, 0.8);
  border-radius: 2px;
  transition: width 0.05s linear;
}

.hint-area.pressing .hint-button {
  transform: scale(0.98);
  box-shadow: 
    0 4px 12px rgba(102, 126, 234, 0.3),
    0 2px 4px rgba(0, 0, 0, 0.15);
}

.hint-area.pressing .hint-progress-bar {
  animation: progressFill 0.8s linear forwards;
}

@keyframes progressFill {
  0% { width: 0%; }
  100% { width: 100%; }
}

/* 힌트 박스 - 깔끔한 카드 스타일 */
.hint-box {
  background: var(--background-primary);
  border: 2px solid #667eea;
  border-radius: 12px;
  padding: 0;
  margin: 16px 0;
  opacity: 0;
  max-height: 0;
  overflow: hidden;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.15);
}

.hint-box.show {
  opacity: 1;
  max-height: 800px;
  animation: slideDown 0.4s ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.hint-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 12px 20px;
  font-weight: 700;
  font-size: clamp(1rem, 4vw, 1.1rem);
  border-radius: 10px 10px 0 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.hint-body {
  padding: 20px;
  font-size: clamp(0.95rem, 4vw, 1.05rem);
  line-height: 1.7;
  color: var(--text-normal);
  background: var(--background-primary);
  border-radius: 0 0 10px 10px;
  min-height: 60px;
}

/* 정답 영역 - 모바일 최적화 */
.answer-area {
  width: 100%;
  padding: 8px;
  margin: 24px 0;
  cursor: pointer;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

.answer-button {
  background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
  color: white;
  padding: 24px 28px;
  border-radius: 16px;
  border: none;
  box-shadow: 
    0 8px 20px rgba(17, 153, 142, 0.3),
    0 2px 4px rgba(0, 0, 0, 0.1);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  text-align: center;
  position: relative;
  overflow: hidden;
}

.answer-button::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  transform: translate(-50%, -50%);
  transition: width 0.6s, height 0.6s;
}

.answer-area:active .answer-button::before {
  width: 300px;
  height: 300px;
}

.answer-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  position: relative;
  z-index: 1;
}

.answer-icon {
  font-size: clamp(2.2rem, 9vw, 3rem);
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
}

.answer-text {
  font-size: clamp(1.2rem, 5vw, 1.5rem);
  font-weight: 700;
  letter-spacing: 0.5px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.answer-subtext {
  font-size: clamp(0.8rem, 3.5vw, 0.95rem);
  opacity: 0.9;
  font-weight: 500;
  letter-spacing: 0.3px;
}

.answer-area:hover .answer-button {
  transform: translateY(-2px);
  box-shadow: 
    0 12px 24px rgba(17, 153, 142, 0.35),
    0 4px 8px rgba(0, 0, 0, 0.15);
}

.answer-area:active .answer-button {
  transform: translateY(0);
}

.answer-area.clicked .answer-button {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  box-shadow: 
    0 8px 20px rgba(102, 126, 234, 0.3),
    0 2px 4px rgba(0, 0, 0, 0.1);
}

.answer-area.clicked .answer-icon {
  animation: checkmark 0.5s ease-in-out;
}

@keyframes checkmark {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.2) rotate(10deg); }
}

/* 정답 섹션 - 부드러운 확장 */
.answer-section {
  opacity: 0;
  max-height: 0;
  overflow: hidden;
  transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  background: var(--background-primary);
  border-radius: 12px;
  margin-top: 16px;
}

.answer-section.show {
  opacity: 1;
  max-height: 6000px;
  animation: expandAnswer 0.6s ease-out;
}

@keyframes expandAnswer {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 모바일 반응형 - 작은 화면 최적화 */
@media (max-width: 768px) {
  .hint-button,
  .answer-button {
    padding: 18px 20px;
  }
  
  .hint-box,
  .answer-section {
    border-radius: 8px;
  }
  
  .hint-header {
    padding: 10px 16px;
  }
  
  .hint-body {
    padding: 16px;
  }
}

/* 터치 디바이스 최적화 */
@media (hover: none) and (pointer: coarse) {
  .hint-button,
  .answer-button {
    padding: 22px 24px;
    min-height: 80px;
  }
  
  .hint-area,
  .answer-area {
    padding: 12px;
  }
}
</style>

<script>
(function() {
  // 힌트 버튼 - 길게 누르기 (진행 바 포함)
  const hintArea = document.querySelector('.hint-area');
  const hintBox = document.querySelector('.hint-box');
  const progressBar = document.querySelector('.hint-progress-bar');
  
  let isPressed = false;
  let pressTimeout;
  let progressInterval;
  
  if (hintArea && hintBox && progressBar) {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.innerWidth <= 768;
    const holdDuration = isMobile ? 800 : 1000; // 0.8초 (모바일), 1초 (데스크톱)
    const progressStep = 50; // 50ms마다 업데이트
    
    function startPress(e) {
      e.preventDefault();
      isPressed = true;
      hintArea.classList.add('pressing');
      
      let elapsed = 0;
      progressBar.style.width = '0%';
      
      // 진행 바 애니메이션
      progressInterval = setInterval(() => {
        elapsed += progressStep;
        const progress = Math.min((elapsed / holdDuration) * 100, 100);
        progressBar.style.width = progress + '%';
        
        if (elapsed >= holdDuration) {
          clearInterval(progressInterval);
        }
      }, progressStep);
      
      // 힌트 표시
      pressTimeout = setTimeout(() => {
        if (isPressed) {
          hintBox.classList.add('show');
          
          // 햅틱 피드백 (모바일)
          if (navigator.vibrate) {
            navigator.vibrate(50);
          }
          
          // 성공 애니메이션
          progressBar.style.background = 'rgba(56, 239, 125, 0.9)';
        }
      }, holdDuration);
    }
    
    function endPress(e) {
      isPressed = false;
      
      if (pressTimeout) clearTimeout(pressTimeout);
      if (progressInterval) clearInterval(progressInterval);
      
      hintArea.classList.remove('pressing');
      
      // 진행 바 리셋 (부드럽게)
      setTimeout(() => {
        progressBar.style.transition = 'width 0.3s ease, background 0.3s ease';
        progressBar.style.width = '0%';
        progressBar.style.background = 'rgba(255, 255, 255, 0.8)';
        
        setTimeout(() => {
          progressBar.style.transition = 'width 0.05s linear';
        }, 300);
      }, 100);
      
      // 힌트 박스 자동 숨김 (5초 후)
      if (hintBox.classList.contains('show')) {
        setTimeout(() => {
          hintBox.classList.remove('show');
        }, 5000);
      }
    }
    
    // 이벤트 리스너 - 모바일/데스크톱 구분
    if (isMobile) {
      hintArea.addEventListener('touchstart', startPress, { passive: false });
      hintArea.addEventListener('touchend', endPress, { passive: false });
      hintArea.addEventListener('touchcancel', endPress, { passive: false });
    } else {
      hintArea.addEventListener('mousedown', startPress);
      hintArea.addEventListener('mouseup', endPress);
      hintArea.addEventListener('mouseleave', endPress);
    }
  }
  
  // 정답 버튼 - 클릭
  const answerArea = document.querySelector('.answer-area');
  const answerSection = document.querySelector('.answer-section');
  
  if (answerArea && answerSection) {
    answerArea.addEventListener('click', function(e) {
      e.preventDefault();
      
      // 이미 열려있으면 닫기
      if (answerSection.classList.contains('show')) {
        answerArea.classList.remove('clicked');
        answerSection.classList.remove('show');
      } else {
        // 열기
        answerArea.classList.add('clicked');
        answerSection.classList.add('show');
        
        // 햅틱 피드백 (모바일)
        if (navigator.vibrate) {
          navigator.vibrate([30, 50, 30]);
        }
        
        // 정답 섹션으로 부드럽게 스크롤
        setTimeout(() => {
          answerSection.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
          });
        }, 300);
      }
    });
  }
})();
</script>

---

*📊 Study Dashboard - 자동 타이머 & 진행률 추적*
`;

        // 11. 파일 생성
        const file = await app.vault.create(filePath, content);
        
        // 12. 파일 열기
        const leaf = app.workspace.getLeaf(false);
        await leaf.openFile(file);
        
        // 13. 완료 메시지
        new Notice(`✅ Anki 카드 생성 완료!\n📸 이미지를 붙여넣으세요!`);
        
        setTimeout(() => {
            new Notice(`💡 힌트 버튼: 길게 누르기\n🔍 정답 버튼: 클릭`);
        }, 2000);
        
    } catch (error) {
        new Notice(`❌ 오류: ${error.message}`);
        console.error("Anki 카드 생성 오류:", error);
    }
};
