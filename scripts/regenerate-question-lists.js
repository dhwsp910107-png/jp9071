/**
 * 문제목록.md 파일을 DataviewJS 템플릿으로 재생성
 * 모든 폴더에 대해 실행
 */

const plugin = app.plugins.plugins['quiz-sp'];

if (!plugin) {
    console.error("❌ quiz-sp 플러그인을 찾을 수 없습니다!");
    new Notice("❌ quiz-sp 플러그인이 활성화되지 않았습니다.");
} else {
    console.log("✅ quiz-sp 플러그인 접근 성공");
    
    // 설정에서 폴더 목록 가져오기
    const folders = plugin.settings.questionFolders || [];
    console.log(`📁 발견된 폴더: ${folders.join(", ")}`);
    
    if (folders.length === 0) {
        console.warn("⚠️ 설정된 폴더가 없습니다.");
        new Notice("⚠️ 문제 폴더가 설정되지 않았습니다.");
    } else {
        // 각 폴더에 대해 문제목록 템플릿 업데이트
        for (const folder of folders) {
            console.log(`\n🔄 ${folder} 폴더 처리 중...`);
            try {
                await plugin.updateQuestionListTemplate(folder);
                console.log(`✅ ${folder} 완료`);
            } catch (error) {
                console.error(`❌ ${folder} 실패:`, error);
            }
        }
        
        console.log("\n\n🎉 모든 폴더 업데이트 완료!");
        new Notice(`✅ ${folders.length}개 폴더의 문제목록이 재생성되었습니다!`);
    }
}
