// QuickAdd 매크로 - Anki 스타일 이미지 카드 생성
// 클립보드 이미지 자동 붙여넣기 지원

module.exports = async (params) => {
    const { quickAddApi: QuickAdd, app } = params;
    
    try {
        // 1. 기본 정보 입력
        const number = await QuickAdd.inputPrompt("문제 번호:", "");
        if (!number) return;
        
        const title = await QuickAdd.inputPrompt("문제 제목:", "");
        if (!title) return;
        
        // 2. 과목 선택
        const subject = await QuickAdd.suggester(
            ["수학", "영어", "과학", "국어", "사회", "한국사", "기타"],
            ["수학", "영어", "과학", "국어", "사회", "한국사", "기타"]
        );
        if (!subject) return;
        
        const chapter = await QuickAdd.inputPrompt("단원:", "", "예: 미적분학");
        
        // 3. 강의 시리즈 (선택)
        const lectureSeries = await QuickAdd.inputPrompt("강의 시리즈 (선택):", "", "예: 수학10강완료");
        
        // 4. 난이도 선택
        const difficulty = await QuickAdd.suggester(
            ["⭐ (매우 쉬움)", "⭐⭐ (쉬움)", "⭐⭐⭐ (보통)", "⭐⭐⭐⭐ (어려움)", "⭐⭐⭐⭐⭐ (매우 어려움)"],
            ["1", "2", "3", "4", "5"]
        );
        
        // 5. 힌트 (선택)
        const hint = await QuickAdd.inputPrompt("힌트 (선택, 없으면 Enter):", "");
        
        // 6. 해설 (선택)
        const explanation = await QuickAdd.inputPrompt("해설 (선택):", "");
        
        // 7. 날짜 계산
        const today = new Date();
        const formatDate = (date) => date.toISOString().split('T')[0];
        const addDays = (days) => {
            const date = new Date(today);
            date.setDate(date.getDate() + days);
            return formatDate(date);
        };
        
        // 8. 파일명 및 경로
        const fileName = `${number}. ${title}.md`;
        const filePath = `학습관리/문제은행/${subject}/${fileName}`;
        
        // 9. 폴더 생성 (없으면)
        const folder = app.vault.getAbstractFileByPath(`학습관리/문제은행/${subject}`);
        if (!folder) {
            await app.vault.createFolder(`학습관리/문제은행/${subject}`);
        }
        
        // 10. 파일 내용 생성
        const content = `---
number: ${number}
title: "${title}"
subject: ${subject}
chapter: "${chapter || ''}"
lecture-series: "${lectureSeries || ''}"
status: learning
difficulty: ${difficulty || 3}
reviewCount: 0
lastReview: ${formatDate(today)}
nextReview: ${addDays(1)}
created: ${formatDate(today)}
tags: [anki-card, ${subject}${lectureSeries ? `, ${lectureSeries}` : ''}]
type: image-flashcard
---

# ${number}. ${title}

${lectureSeries ? `> 📚 **출처**: [[강의시리즈/${lectureSeries}/${lectureSeries}|${lectureSeries}]]` : ''}  
${chapter ? `> 📖 **단원**: ${chapter}` : ''}
${difficulty ? `> ⭐ **난이도**: ${'⭐'.repeat(parseInt(difficulty))}/5` : ''}

---

## 📸 문제

<!-- 🎯 Ctrl+V로 문제 이미지를 여기에 붙여넣으세요 -->



---

${hint ? `## 💡 힌트

> [!tip]- 💡 힌트 보기
> ${hint}

---

` : ''}## ✅ 정답

> [!success]- 🔍 정답 보기 (클릭)
> 
> <!-- 🎯 Ctrl+V로 답안 이미지를 여기에 붙여넣으세요 -->
> 
> 
${explanation ? `> ### 📝 해설
> ${explanation}` : ''}

---

## 📊 복습 기록

| 날짜 | 결과 | 소요시간 | 메모 |
|------|------|----------|------|
| ${formatDate(today)} | ⬜ Again / ⬜ Hard / ⬜ Good / ⬜ Easy |  |  |

---

## 🔄 복습 일정

- [ ] 1차: ${addDays(1)} #복습
- [ ] 2차: ${addDays(3)} #복습  
- [ ] 3차: ${addDays(7)} #복습
- [ ] 4차: ${addDays(14)} #복습
- [ ] 완전숙달: ${addDays(30)} #복습

---

## 💭 학습 노트

### 📌 관련 개념
- [[]]

### ⚠️ 주의사항
- 

### 🎓 추가 학습
- 

---

## 📈 통계 (자동 업데이트)

\`\`\`dataview
TABLE 
  reviewCount as "복습횟수",
  status as "상태",
  difficulty as "난이도"
WHERE file = this.file
\`\`\`

---

*📊 Study Dashboard와 자동 연동됩니다*
`;

        // 11. 파일 생성
        const file = await app.vault.create(filePath, content);
        
        // 12. 파일 열기
        const leaf = app.workspace.getLeaf(false);
        await leaf.openFile(file);
        
        // 13. 성공 메시지
        new Notice(`✅ Anki 카드 생성 완료!\n📸 이제 Ctrl+V로 이미지를 붙여넣으세요!`);
        
        // 14. 이미지 붙여넣기 가이드 표시
        setTimeout(() => {
            new Notice(`💡 붙여넣기 순서:\n1️⃣ 문제 영역에서 Ctrl+V\n2️⃣ 답안 영역에서 Ctrl+V`);
        }, 2000);
        
    } catch (error) {
        new Notice(`❌ 오류 발생: ${error.message}`);
        console.error("Anki 카드 생성 오류:", error);
    }
};
