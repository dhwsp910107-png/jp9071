// Obsidian 개발자 콘솔(Ctrl+Shift+I)에서 실행하세요

console.log("🔄 플러그인 재로드 및 편집 테스트");
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
    if (questions.length === 0) {
        console.warn("⚠️ 문제가 없습니다");
    } else {
        console.log(`\n2️⃣ 첫 번째 문제로 테스트:`);
        const q = questions[0];
        
        console.log("   📝 문제:", q.question);
        console.log("   💡 힌트:", q.hint || '(없음)');
        console.log("   📝 노트:", q.note || '(없음)');
        console.log("   ✅ 선택지:", q.options);
        
        console.log("\n3️⃣ 편집 모달 열기...");
        const modal = new HanziQuestionModal(app, plugin, q);
        modal.open();
        
        console.log("\n✅ 편집 모달이 열렸습니다!");
        console.log("\n📋 확인 사항:");
        console.log("   ✓ 문제 텍스트가 보이나요?");
        console.log("   ✓ 힌트가 보이나요?");
        console.log("   ✓ 노트가 보이나요?");
        console.log("   ✓ 선택지가 모두 보이나요?");
    }
}
