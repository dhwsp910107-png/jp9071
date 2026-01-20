// Obsidian 개발자 콘솔(Ctrl+Shift+I)에서 실행하세요

console.log("📏 입력창 대형화 + 버튼 소형화");
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
    
    console.log("\n📏 입력창 크기 증가:");
    
    console.log("\n📝 문제 입력창:");
    console.log("   높이: 140px → 200px ⬆️");
    console.log("   줄수: 6줄 → 8줄 ⬆️");
    console.log("   폰트: 16px → 18px ⬆️");
    console.log("   패딩: 16px → 20px ⬆️");
    console.log("   줄간격: 1.7 → 1.8 ⬆️");
    
    console.log("\n💡 힌트 입력창:");
    console.log("   높이: 120px → 160px ⬆️");
    console.log("   줄수: 5줄 → 7줄 ⬆️");
    console.log("   폰트: 15px → 17px ⬆️");
    console.log("   패딩: 14px → 18px ⬆️");
    
    console.log("\n📝 노트 입력창:");
    console.log("   높이: 120px → 160px ⬆️");
    console.log("   줄수: 5줄 → 7줄 ⬆️");
    console.log("   폰트: 15px → 17px ⬆️");
    console.log("   패딩: 14px → 18px ⬆️");
    
    console.log("\n✅ 선택지 입력창:");
    console.log("   높이: 44px → 54px ⬆️");
    console.log("   폰트: 15px → 17px ⬆️");
    console.log("   패딩: 10px → 14px ⬆️");
    
    console.log("\n🔽 버튼 크기 감소:");
    
    console.log("\n📋 클립보드 버튼:");
    console.log("   텍스트: '클립보드 붙여넣기' → '붙여넣기' ⬇️");
    console.log("   패딩: 6px 12px → 4px 10px ⬇️");
    console.log("   폰트: 0.9em → 12px ⬇️");
    
    console.log("\n🖼️ 이미지 버튼들:");
    console.log("   '파일 선택' → '선택' ⬇️");
    console.log("   '이미지 추가' → '추가' ⬇️");
    console.log("   '전체 삭제' → '삭제' ⬇️");
    console.log("   패딩: → 4px 8px ⬇️");
    console.log("   폰트: → 11px ⬇️");
    
    console.log("\n🗑️ 삭제 버튼:");
    console.log("   패딩: 5px 10px → 4px 8px ⬇️");
    console.log("   폰트: → 11px ⬇️");
    
    console.log("\n➕ 선택지 추가 버튼:");
    console.log("   텍스트: '선택지 추가' → '추가' ⬇️");
    console.log("   패딩: → 4px 10px ⬇️");
    console.log("   폰트: → 12px ⬇️");
    
    console.log("\n🎯 개선 효과:");
    console.log("   ✅ 입력창이 훨씬 크고 넓어져 타이핑 편함");
    console.log("   ✅ 버튼들이 작아져 화면 공간 절약");
    console.log("   ✅ 전체적으로 입력에 집중할 수 있는 UI");
    console.log("   ✅ 더 많은 내용을 한눈에 볼 수 있음");
    
    console.log("\n📋 테스트:");
    console.log("   1. 대시보드 → 문제 만들기");
    console.log("   2. 입력창이 크고 편한지 확인");
    console.log("   3. 버튼들이 작고 깔끔한지 확인");
}
