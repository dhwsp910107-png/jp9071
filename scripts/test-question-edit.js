// Obsidian 개발자 콘솔(Ctrl+Shift+I)에서 실행하세요

console.log("🔍 문제 편집 데이터 로딩 테스트");
console.log("=".repeat(50));

const plugin = app.plugins.plugins['quiz-sp'];

if (!plugin) {
    console.error("❌ 플러그인이 로드되지 않았습니다");
} else {
    console.log("✅ 플러그인 로드됨");
    
    // 1. 문제 개수 확인
    const questions = plugin.questions || [];
    console.log(`\n📊 총 문제 수: ${questions.length}개`);
    
    if (questions.length === 0) {
        console.warn("⚠️ 문제가 없습니다. 먼저 문제를 만들어주세요.");
    } else {
        // 2. 첫 번째 문제 샘플
        const sample = questions[0];
        console.log("\n📝 첫 번째 문제 샘플:");
        console.log("   핵심 키워드:", sample.hanzi);
        console.log("   문제:", sample.question);
        console.log("   선택지:", sample.options);
        console.log("   정답:", sample.answer);
        console.log("   힌트:", sample.hint || '(없음)');
        console.log("   난이도:", sample.difficulty);
        
        // 3. 편집 모달 테스트
        console.log("\n🧪 편집 모달 테스트:");
        console.log("   다음 명령어로 편집 모달을 열어보세요:");
        console.log("   ```");
        console.log(`   const q = app.plugins.plugins['quiz-sp'].questions[0];`);
        console.log(`   const modal = new HanziQuestionModal(app, app.plugins.plugins['quiz-sp'], q);`);
        console.log(`   modal.open();`);
        console.log("   ```");
        
        // 4. 데이터 구조 체크
        console.log("\n🔎 데이터 구조 체크:");
        const hasOptions = sample.options && Array.isArray(sample.options);
        const hasHint = typeof sample.hint === 'string';
        const hasQuestion = typeof sample.question === 'string';
        
        console.log("   options 배열:", hasOptions ? "✅" : "❌");
        console.log("   hint 문자열:", hasHint ? "✅" : "❌");
        console.log("   question 문자열:", hasQuestion ? "✅" : "❌");
        
        // 5. 선택지 개수 확인
        if (hasOptions) {
            console.log(`   선택지 개수: ${sample.options.length}개`);
            sample.options.forEach((opt, idx) => {
                console.log(`     [${idx + 1}] ${opt}`);
            });
        }
        
        // 6. Constructor 시뮬레이션
        console.log("\n🎭 Constructor 시뮬레이션:");
        const testQuestion = sample;
        console.log("   existingQuestion:", testQuestion ? "✅ 있음" : "❌ 없음");
        console.log("   this.question = existingQuestion || {...}");
        console.log("   결과:");
        console.log("     - hanzi:", testQuestion.hanzi);
        console.log("     - question:", testQuestion.question);
        console.log("     - options:", testQuestion.options);
        console.log("     - answer:", testQuestion.answer);
        console.log("     - hint:", testQuestion.hint);
        console.log("     - difficulty:", testQuestion.difficulty);
        
        // 7. 렌더링 테스트
        console.log("\n🎨 렌더링 예상 결과:");
        console.log("   questionInput.value =", testQuestion.question);
        console.log("   hintInput.value =", testQuestion.hint || '');
        console.log("   선택지 입력 필드 개수:", testQuestion.options?.length || 0);
        
        // 8. 실제 편집 모달 열기
        console.log("\n🚀 실제 편집 모달 열기:");
        const q = questions[0];
        const modal = new HanziQuestionModal(app, plugin, q);
        modal.open();
        
        console.log("✅ 편집 모달이 열렸습니다!");
        console.log("📋 확인 사항:");
        console.log("   1. 문제 내용이 제대로 보이는지");
        console.log("   2. 선택지가 모두 보이는지");
        console.log("   3. 힌트가 제대로 보이는지");
        console.log("   4. 정답이 올바르게 선택되어 있는지");
    }
}

console.log("\n" + "=".repeat(50));
console.log("💡 문제가 있다면 콘솔의 빨간 에러 메시지를 알려주세요!");
