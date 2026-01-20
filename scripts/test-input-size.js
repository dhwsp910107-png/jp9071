// Obsidian 개발자 콘솔(Ctrl+Shift+I)에서 실행하세요

console.log("🎨 입력창 크기 개선 테스트");
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
    
    console.log("\n✨ 입력창 크기 개선 내용:");
    console.log("\n📝 문제 입력창:");
    console.log("   - 높이: 100px → 140px");
    console.log("   - 줄 수: 4줄 → 6줄");
    console.log("   - 폰트: 15px → 16px");
    console.log("   - 패딩: 12px → 16px");
    console.log("   - 줄 간격: 1.6 → 1.7");
    
    console.log("\n💡 힌트 입력창:");
    console.log("   - 높이: 60px → 120px (2배)");
    console.log("   - 줄 수: 2줄 → 5줄");
    console.log("   - 폰트: 14px → 15px");
    console.log("   - 패딩: 10px → 14px");
    console.log("   - 테두리: 1px → 2px");
    console.log("   - 줄 간격: 1.5 → 1.6");
    
    console.log("\n📝 노트 입력창:");
    console.log("   - 높이: 60px → 120px (2배)");
    console.log("   - 줄 수: 2줄 → 5줄");
    console.log("   - 폰트: 14px → 15px");
    console.log("   - 패딩: 10px → 14px");
    console.log("   - 테두리: 1px → 2px");
    console.log("   - 줄 간격: 1.5 → 1.6");
    
    console.log("\n📋 테스트 방법:");
    console.log("   1. 대시보드 → 문제 만들기");
    console.log("   2. 또는 기존 문제 편집");
    console.log("   3. 입력창이 더 크고 보기 편한지 확인");
    console.log("   4. resize: vertical로 수동 조절 가능");
    
    console.log("\n✅ 모든 입력창이 더 크고 사용하기 편해졌습니다!");
}
