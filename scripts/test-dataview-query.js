/**
 * DataviewJS 쿼리 테스트 스크립트
 * JS Engine 플러그인을 통해 실행
 */

// Dataview API 접근
const dv = app.plugins.plugins.dataview.api;

if (!dv) {
    console.error("❌ Dataview 플러그인을 찾을 수 없습니다!");
    new Notice("❌ Dataview 플러그인이 활성화되지 않았습니다.");
} else {
    console.log("✅ Dataview API 접근 성공");
    
    // 기본 폴더 테스트
    const folder = "HanziQuiz/Questions/기본";
    console.log(`\n📁 폴더 테스트: ${folder}`);
    
    // 쿼리 실행
    const questions = dv.pages(`"${folder}"`)
        .where(p => p.file.name.includes("_") && !p.file.name.includes("문제목록"));
    
    console.log(`📊 총 ${questions.length}개 문제 발견`);
    
    if (questions.length > 0) {
        console.log("\n📋 처음 3개 문제:");
        questions.slice(0, 3).forEach((q, i) => {
            console.log(`\n${i + 1}. ${q.file.name}`);
            console.log(`   한자: ${q.hanzi || "없음"}`);
            console.log(`   번호: ${q.number || "없음"}`);
            console.log(`   난이도: ${q.difficulty || "없음"}`);
            console.log(`   북마크: ${q.bookmarked || false}`);
            console.log(`   정답 횟수: ${q.correctCount || 0}`);
            console.log(`   오답 횟수: ${q.wrongCount || 0}`);
        });
    }
    
    // 통계 계산
    const total = questions.length;
    const bookmarked = questions.where(p => p.bookmarked === true).length;
    const withWrong = questions.where(p => p.wrongCount > 0).length;
    
    console.log("\n\n📈 폴더 통계:");
    console.log(`총 문제: ${total}개`);
    console.log(`북마크: ${bookmarked}개`);
    console.log(`오답 있음: ${withWrong}개`);
    
    // 난이도별 통계
    const difficulties = ["A+", "A", "A-", "B", "B-", "C", "D", "E", "F"];
    console.log("\n🎯 난이도별 분포:");
    difficulties.forEach(diff => {
        const count = questions.where(p => p.difficulty === diff).length;
        if (count > 0) {
            console.log(`${diff}: ${count}개`);
        }
    });
    
    new Notice(`✅ 테스트 완료: ${total}개 문제 발견`);
}
