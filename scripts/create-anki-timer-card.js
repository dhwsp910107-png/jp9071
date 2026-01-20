// QuickAdd 매크로 - Anki 타이머 카드 생성

module.exports = async (params) => {
    const { quickAddApi: QuickAdd, app } = params;
    
    try {
        // 1. 기본 정보
        const number = await QuickAdd.inputPrompt("📝 문제 번호:", "");
        if (!number) return;
        
        const title = await QuickAdd.inputPrompt("📌 문제 제목:", "");
        if (!title) return;
        
        // 2. 분류
        const subject = await QuickAdd.suggester(
            ["수학", "영어", "과학", "국어", "사회", "한국사", "기타"],
            ["수학", "영어", "과학", "국어", "사회", "한국사", "기타"]
        );
        if (!subject) return;
        
        const chapter = await QuickAdd.inputPrompt("📖 단원:", "");
        
        // 3. 출처
        const source = await QuickAdd.inputPrompt("📚 출처 (교재/강의):", "");
        const page = await QuickAdd.inputPrompt("📄 페이지/회차:", "");
        const lectureSeries = await QuickAdd.inputPrompt("🎓 강의 시리즈 (선택):", "");
        
        // 4. 난이도
        const difficulty = await QuickAdd.suggester(
            ["⭐", "⭐⭐", "⭐⭐⭐", "⭐⭐⭐⭐", "⭐⭐⭐⭐⭐"],
            ["1", "2", "3", "4", "5"]
        );
        
        // 5. 추가 정보
        const hint = await QuickAdd.inputPrompt("💡 힌트 (선택):", "");
        const concept1 = await QuickAdd.inputPrompt("🔑 핵심 개념 1:", "");
        const concept2 = await QuickAdd.inputPrompt("🔑 핵심 개념 2 (선택):", "");
        const concept3 = await QuickAdd.inputPrompt("🔑 핵심 개념 3 (선택):", "");
        const formula = await QuickAdd.inputPrompt("📐 관련 공식 (선택):", "");
        const toc = await QuickAdd.inputPrompt("📑 목차 위치 (선택):", "");
        
        // 6. 날짜 계산
        const today = new Date();
        const formatDate = (date) => date.toISOString().split('T')[0];
        const addDays = (days) => {
            const date = new Date(today);
            date.setDate(date.getDate() + days);
            return formatDate(date);
        };
        
        // 7. 파일 생성
        const fileName = `${number}. ${title}.md`;
        const filePath = `학습관리/문제은행/${subject}/${fileName}`;
        
        // 폴더 생성
        const folder = app.vault.getAbstractFileByPath(`학습관리/문제은행/${subject}`);
        if (!folder) {
            await app.vault.createFolder(`학습관리/문제은행/${subject}`);
        }
        
        // 8. 파일 내용
        const content = `---
number: ${number}
title: "${title}"
subject: ${subject}
chapter: "${chapter}"
source: "${source}"
page: "${page}"
lecture-series: "${lectureSeries}"
concept-tags: [${concept1 ? `"${concept1}"` : ''}${concept2 ? `, "${concept2}"` : ''}${concept3 ? `, "${concept3}"` : ''}]
status: learning
difficulty: ${difficulty}
reviewCount: 0
lastReview: ${formatDate(today)}
nextReview: ${addDays(1)}
created: ${formatDate(today)}
avgTime: 0
totalTime: 0
tags: [anki-card, ${subject}${lectureSeries ? `, ${lectureSeries}` : ''}]
type: image-flashcard
---

# ${number}. ${title}

> 📚 **출처**: ${source}${page ? ` (${page})` : ''}  
> 📖 **단원**: ${chapter}  
> ⭐ **난이도**: ${'⭐'.repeat(parseInt(difficulty))}/5

---

## 📸 문제

<!-- 🎯 Ctrl+V로 문제 이미지 붙여넣기 -->



---

${hint ? `## 💡 힌트

> [!hint]- 💡 힌트 보기
> ${hint}

---

` : ''}## ✅ 정답 및 풀이

> [!success]- 🔍 **답안 보기 (클릭 시 타이머 종료)**
> 
> <!-- 🎯 Ctrl+V로 답안 이미지 붙여넣기 -->
> 
> 
> ---
> 
> ## 📚 사용된 개념
> 
> ### 핵심 개념
${concept1 ? `> - [[${concept1}]]` : '> - [[]]'}
${concept2 ? `> - [[${concept2}]]` : '> - [[]]'}
${concept3 ? `> - [[${concept3}]]` : ''}
> 
${formula ? `> ### 관련 공식
> \`\`\`
> ${formula}
> \`\`\`
> ` : ''}> ---
> 
> ## 📖 출처 상세
> 
${toc ? `> **목차 위치**: ${toc}` : '> **목차 위치**: '}
> 
> ### 연관 문제
> - [[]] - 유사 문제
> - [[]] - 심화 문제
> 
> ### 관련 단원
> - [[]] ← 이전
> - [[]] → 다음

---

## ⏱️ 풀이 시간 기록

\`\`\`dataviewjs
// 타이머 자동 시작/종료
const file = dv.current();
const plugin = app.plugins.plugins['study-dashboard'];
const startTime = plugin?.timerSystem?.currentTimer?.startTime;

if (startTime) {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    dv.paragraph(\`⏱️ **현재 경과 시간**: \${minutes}분 \${seconds}초\`);
} else {
    dv.paragraph(\`⏱️ 문제를 열면 타이머가 자동 시작됩니다\`);
}

// 평균 시간
if (file.avgTime > 0) {
    const avgMin = Math.floor(file.avgTime / 60);
    const avgSec = file.avgTime % 60;
    dv.paragraph(\`📊 **평균 풀이 시간**: \${avgMin}분 \${avgSec}초\`);
}
\`\`\`

---

## 📊 복습 기록

| 날짜 | 결과 | 시간 | 메모 |
|------|------|------|------|
| ${formatDate(today)} | ⬜ Again / ⬜ Hard / ⬜ Good / ⬜ Easy | - |  |

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

dv.paragraph(\`
**복습 진행률**: \${bar(file.reviewCount, 10)} \${file.reviewCount}/10회
**상태**: \${statusEmoji[file.status] || '🔴'} \${file.status === 'learning' ? '학습중' : file.status === 'reviewing' ? '복습중' : '완전숙달'}
**총 학습시간**: \${Math.floor(file.totalTime / 60)}분
\`);
\`\`\`

---

## 🔄 복습 일정

- [ ] 1차: ${addDays(1)} #복습
- [ ] 2차: ${addDays(3)} #복습  
- [ ] 3차: ${addDays(7)} #복습
- [ ] 4차: ${addDays(14)} #복습
- [ ] 완전숙달: ${addDays(30)} #복습

---

## 💭 학습 노트

### ⚠️ 주의할 점
- 

### 🔑 핵심 포인트
- 

---

*📊 Study Dashboard - 자동 타이머 & 진행률 추적*
`;

        // 9. 파일 생성 및 열기
        const file = await app.vault.create(filePath, content);
        const leaf = app.workspace.getLeaf(false);
        await leaf.openFile(file);
        
        // 10. 안내 메시지
        new Notice(`✅ Anki 카드 생성 완료!\n⏱️ 타이머가 자동으로 시작되었습니다.`);
        
        setTimeout(() => {
            new Notice(`📸 이미지 붙여넣기 순서:\n1️⃣ 문제 영역 Ctrl+V\n2️⃣ 답안 영역 Ctrl+V\n\n🔍 답안 보기 클릭하면 타이머 종료!`);
        }, 2000);
        
    } catch (error) {
        new Notice(`❌ 오류: ${error.message}`);
        console.error("Anki 카드 생성 오류:", error);
    }
};
