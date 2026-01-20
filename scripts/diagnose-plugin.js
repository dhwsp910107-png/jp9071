// Obsidian 개발자 콘솔(Ctrl+Shift+I)에서 실행하세요

console.log("🔍 Plugin Diagnosis");
console.log("=".repeat(50));

// 1. 플러그인 로드 확인
const plugin = app.plugins.plugins['quiz-sp'];
console.log("\n1️⃣ Plugin Status:");
console.log("   Loaded:", plugin ? "✅ Yes" : "❌ No");
if (plugin) {
    console.log("   Settings:", plugin.settings ? "✅ Exists" : "❌ Missing");
    console.log("   Mobile CSS:", plugin.settings?.enableMobileOptimization);
}

// 2. 문제 로드 확인
if (plugin) {
    console.log("\n2️⃣ Questions:");
    console.log("   Total:", plugin.questions?.length || 0);
    console.log("   Folders:", plugin.questionFolders?.length || 0);
}

// 3. 메서드 확인
if (plugin) {
    console.log("\n3️⃣ Methods:");
    console.log("   startQuiz:", typeof plugin.startQuiz);
    console.log("   viewStatistics:", typeof plugin.viewStatistics);
    console.log("   injectMobileCSS:", typeof plugin.injectMobileCSS);
}

// 4. CSS 확인
const mobileCSS = document.getElementById('hanzi-quiz-mobile-css');
console.log("\n4️⃣ Mobile CSS:");
console.log("   Injected:", mobileCSS ? "✅ Yes" : "❌ No");
if (mobileCSS) {
    console.log("   Length:", mobileCSS.textContent.length, "chars");
}

// 5. 에러 확인
console.log("\n5️⃣ Console Errors:");
console.log("   Check above for any red error messages");

console.log("\n📋 Next Steps:");
console.log("   1. 빨간 에러 메시지 있으면 복사해서 알려주세요");
console.log("   2. 플러그인이 로드 안 됐으면: 설정 → 커뮤니티 플러그인 → quiz-sp 활성화");
console.log("   3. 대시보드 버튼 클릭 시 증상 설명해주세요");
