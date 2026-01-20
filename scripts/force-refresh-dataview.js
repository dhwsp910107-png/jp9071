/**
 * Dataview 강제 새로고침 및 디버깅
 */

const dataviewPlugin = app.plugins.plugins.dataview;

if (!dataviewPlugin) {
    console.error("❌ Dataview 플러그인을 찾을 수 없습니다!");
    new Notice("❌ Dataview 플러그인이 비활성화되어 있습니다.");
} else {
    console.log("✅ Dataview 플러그인 상태:");
    console.log("- enableDataviewJs:", dataviewPlugin.settings.enableDataviewJs);
    console.log("- dataviewJsKeyword:", dataviewPlugin.settings.dataviewJsKeyword);
    console.log("- refreshEnabled:", dataviewPlugin.settings.refreshEnabled);
    console.log("- refreshInterval:", dataviewPlugin.settings.refreshInterval);
    
    // Dataview API 테스트
    const dv = dataviewPlugin.api;
    const folder = "HanziQuiz/Questions/N3";
    const questions = dv.pages(`"${folder}"`)
        .where(p => p.file.name.includes("_") && !p.file.name.includes("문제목록"));
    
    console.log(`\n📊 ${folder} 폴더 분석:`);
    console.log(`- 총 문제 수: ${questions.length}`);
    console.log(`- 북마크: ${questions.where(p => p.bookmarked === true).length}`);
    console.log(`- 오답 있음: ${questions.where(p => p.wrongCount > 0).length}`);
    
    // 현재 활성 파일 다시 로드
    const activeFile = app.workspace.getActiveFile();
    if (activeFile) {
        console.log(`\n📄 현재 파일: ${activeFile.path}`);
        
        // 파일 닫고 다시 열기
        const leaves = app.workspace.getLeavesOfType("markdown");
        for (const leaf of leaves) {
            if (leaf.view.file?.path === activeFile.path) {
                console.log("🔄 파일 새로고침 중...");
                await leaf.setViewState({
                    type: "markdown",
                    state: { file: activeFile.path, mode: "source" }
                });
                await new Promise(resolve => setTimeout(resolve, 100));
                await leaf.setViewState({
                    type: "markdown",
                    state: { file: activeFile.path, mode: "preview" }
                });
            }
        }
    }
    
    new Notice("✅ Dataview 강제 새로고침 완료!");
    console.log("\n✅ 완료! 파일을 확인해주세요.");
}
