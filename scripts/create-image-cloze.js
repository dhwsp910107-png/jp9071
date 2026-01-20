// 이미지 Cloze 문제 생성 QuickAdd 매크로
// 사용법: QuickAdd에서 이 스크립트를 매크로로 등록

module.exports = async (params) => {
    const { quickAddApi: QuickAdd, app } = params;
    
    try {
        // 1. 기본 정보 입력받기
        const problemNumber = await QuickAdd.inputPrompt("문제 번호를 입력하세요:", "", "예: 1");
        if (!problemNumber) return;
        
        const problemTitle = await QuickAdd.inputPrompt("문제 제목을 입력하세요:", "", "예: 미분 기본 개념");
        if (!problemTitle) return;
        
        const subject = await QuickAdd.suggester(
            ["수학", "영어", "과학", "국어", "사회", "기타"],
            ["수학", "영어", "과학", "국어", "사회", "기타"]
        );
        if (!subject) return;
        
        const chapter = await QuickAdd.inputPrompt("단원을 입력하세요:", "", "예: 미적분학");
        if (!chapter) return;
        
        // 2. 강의 시리즈 연동
        const lectureSeries = await QuickAdd.inputPrompt("강의 시리즈 이름:", "", "예: 수학10강완료");
        if (!lectureSeries) return;
        
        // 3. 난이도 선택
        const difficulty = await QuickAdd.suggester(
            ["⭐ (매우 쉬움)", "⭐⭐ (쉬움)", "⭐⭐⭐ (보통)", "⭐⭐⭐⭐ (어려움)", "⭐⭐⭐⭐⭐ (매우 어려움)"],
            ["1", "2", "3", "4", "5"]
        );
        if (!difficulty) return;
        
        // 4. 이미지 파일 정보
        const questionImageFile = await QuickAdd.inputPrompt("문제 이미지 파일명:", "", "예: 문제1.png");
        if (!questionImageFile) return;
        
        const answerImageFile = await QuickAdd.inputPrompt("답안 이미지 파일명:", "", "예: 답안1.png");
        if (!answerImageFile) return;
        
        // 5. Cloze 내용 입력
        const clozeContent = await QuickAdd.inputPrompt(
            "Cloze 내용을 입력하세요 ({{c1::답안}} 형식 사용):",
            "",
            "예: 미분의 정의는 {{c1::순간변화율}}이다."
        );
        if (!clozeContent) return;
        
        // 6. 힌트 (선택)
        const hint = await QuickAdd.inputPrompt("힌트를 입력하세요 (선택, 없으면 Enter):", "", "");
        
        // 7. 상세 해설
        const explanation = await QuickAdd.inputPrompt("상세 해설을 입력하세요:", "", "");
        
        // 8. 핵심 포인트
        const keyPoint1 = await QuickAdd.inputPrompt("핵심 포인트 1:", "", "");
        const keyPoint2 = await QuickAdd.inputPrompt("핵심 포인트 2:", "", "");
        
        // 9. 파일명 생성
        const today = new Date().toISOString().split('T')[0];
        const fileName = `${problemNumber}. ${problemTitle}.md`;
        const filePath = `학습관리/문제은행/${subject}/${fileName}`;
        
        // 10. 템플릿 내용 생성
        const content = `---
number: ${problemNumber}
title: "${problemTitle}"
subject: ${subject}
chapter: "${chapter}"
lecture-series: "${lectureSeries}"
status: learning
difficulty: ${difficulty}
reviewCount: 0
lastReview: ${today}
created: ${today}
tags: [이미지문제, cloze, ${subject}, ${lectureSeries}]
description: "${problemTitle}"
score: 0
studyTime: 0
type: image-cloze
---

# ${problemNumber}. ${problemTitle}

> 📚 **출처**: [[강의시리즈/${lectureSeries}/${lectureSeries}|${lectureSeries}]]  
> 📖 **단원**: ${chapter}  
> ⭐ **난이도**: ${difficulty}/5

---

## 📸 문제 이미지

![[${questionImageFile}]]

---

## 🎯 Cloze 문제

${clozeContent}

${hint ? `> [!tip]- 💡 힌트\n> ${hint}\n` : ''}
---

## ✅ 정답 및 해설

> [!success]- 🔍 정답 보기 (클릭)
> 
> ### 📸 답안 이미지
> ![[${answerImageFile}]]
> 
> ### 📝 상세 해설
> ${explanation}
> 
> ### 🔑 핵심 포인트
> - ${keyPoint1}
> - ${keyPoint2}

---

## 📊 복습 기록

| 날짜 | 정답 여부 | 소요시간 | 이해도 | 메모 |
|------|-----------|----------|--------|------|
| ${today} | ⭕/❌ |  분 | ⭐ /5 |  |

---

## 🔄 복습 일정

- [ ] 1차 복습: ${getDatePlus(1)} #복습
- [ ] 2차 복습: ${getDatePlus(3)} #복습
- [ ] 3차 복습: ${getDatePlus(7)} #복습
- [ ] 4차 복습: ${getDatePlus(14)} #복습
- [ ] 완전숙달: ${getDatePlus(30)} #복습

---

## 💭 학습 노트

### 📌 연관 개념
- [[]]
- [[]]

### ⚠️ 주의사항
- 

### 🎓 추가 학습 자료
- 

---

## 🔗 메타데이터 (자동 연동)

\`\`\`dataview
TABLE 
  subject as "과목",
  chapter as "단원",
  difficulty as "난이도",
  reviewCount as "복습횟수",
  score as "점수"
WHERE file = this.file
\`\`\`

---

*📊 Study Dashboard와 자동 연동됩니다*
`;

        // 11. 파일 생성
        const folder = app.vault.getAbstractFileByPath(`학습관리/문제은행/${subject}`);
        if (!folder) {
            await app.vault.createFolder(`학습관리/문제은행/${subject}`);
        }
        
        const file = await app.vault.create(filePath, content);
        
        // 12. 파일 열기
        const leaf = app.workspace.getLeaf(false);
        await leaf.openFile(file);
        
        new Notice(`✅ 문제가 생성되었습니다: ${fileName}`);
        
        // 13. Study Dashboard 데이터 업데이트 (선택적)
        await updateStudyDashboard(app, {
            number: problemNumber,
            title: problemTitle,
            subject: subject,
            chapter: chapter,
            difficulty: difficulty,
            filePath: filePath
        });
        
    } catch (error) {
        new Notice(`❌ 오류 발생: ${error.message}`);
        console.error("이미지 Cloze 문제 생성 오류:", error);
    }
    
    // 날짜 계산 헬퍼 함수
    function getDatePlus(days) {
        const date = new Date();
        date.setDate(date.getDate() + days);
        return date.toISOString().split('T')[0];
    }
    
    // Study Dashboard 업데이트 함수
    async function updateStudyDashboard(app, problemData) {
        try {
            // Study Dashboard 플러그인 데이터 가져오기
            const plugin = app.plugins.plugins['study-dashboard'];
            if (!plugin) {
                console.log("Study Dashboard 플러그인을 찾을 수 없습니다.");
                return;
            }
            
            // 문제 데이터 추가
            if (!plugin.settings.problems) {
                plugin.settings.problems = [];
            }
            
            plugin.settings.problems.push({
                ...problemData,
                created: new Date().toISOString(),
                status: 'learning',
                reviewCount: 0
            });
            
            // 설정 저장
            await plugin.saveSettings();
            
            console.log("Study Dashboard 업데이트 완료");
        } catch (error) {
            console.error("Study Dashboard 업데이트 실패:", error);
        }
    }
};
