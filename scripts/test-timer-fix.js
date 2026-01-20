// Obsidian 개발자 콘솔(Ctrl+Shift+I)에서 실행하세요

console.log("🔄 퀴즈 타이머 오류 수정 테스트");
console.log("=".repeat(50));

// 플러그인 재로드
console.log("1️⃣ 플러그인 재로드 중...");
await app.plugins.disablePlugin('quiz-sp');
await app.plugins.enablePlugin('quiz-sp');

const plugin = app.plugins.plugins['quiz-sp'];

if (!plugin) {
    console.error("❌ 플러그인 로드 실패");
} else {
    console.log("✅ 플러그인 재로드 완료");
    
    const questions = plugin.questions || [];
    console.log(`\n2️⃣ 문제 수: ${questions.length}개`);
    
    if (questions.length === 0) {
        console.warn("⚠️ 문제가 없습니다");
    } else {
        console.log("\n✅ 수정 내용:");
        console.log("   1. startTimer()에서 currentQuestion 존재 확인 추가");
        console.log("   2. selectAnswer()에서 question undefined 체크 추가");
        console.log("   3. 오류 발생 시 Notice와 로그 출력");
        
        console.log("\n📋 테스트 방법:");
        console.log("   1. 퀴즈를 시작하세요 (대시보드 → 전체 퀴즈)");
        console.log("   2. 타이머가 있다면 시간이 다 될 때까지 기다리세요");
        console.log("   3. 'shuffledAnswerIndex' 오류가 발생하지 않아야 합니다");
        console.log("   4. 정상적으로 다음 문제로 넘어가야 합니다");
    }
}
