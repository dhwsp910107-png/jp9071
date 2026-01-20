// 간단한 테스트 버전 - Anki 카드 생성

module.exports = async (params) => {
    const { quickAddApi: QuickAdd, app } = params;
    
    try {
        new Notice("✅ 매크로 실행됨!");
        
        // 기본 정보만 받기
        const number = await QuickAdd.inputPrompt("문제 번호:", "");
        if (!number) {
            new Notice("❌ 취소됨");
            return;
        }
        
        const title = await QuickAdd.inputPrompt("문제 제목:", "");
        if (!title) {
            new Notice("❌ 취소됨");
            return;
        }
        
        const subject = await QuickAdd.suggester(
            ["수학", "영어", "과학"],
            ["수학", "영어", "과학"]
        );
        if (!subject) {
            new Notice("❌ 취소됨");
            return;
        }
        
        new Notice(`입력받음: ${number}. ${title} (${subject})`);
        
        // 테스트: 파일 생성 없이 입력만 확인
        console.log("문제번호:", number);
        console.log("제목:", title);
        console.log("과목:", subject);
        
        new Notice("✅ 테스트 성공!");
        
    } catch (error) {
        new Notice("❌ 오류: " + error.message);
        console.error("매크로 오류:", error);
    }
};
