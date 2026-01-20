/**
 * 수정된 템플릿으로 모든 문제목록.md 재생성
 */

const plugin = app.plugins.plugins['quiz-sp'];

if (!plugin) {
    new Notice("❌ quiz-sp 플러그인을 찾을 수 없습니다");
} else {
    const folders = plugin.settings.questionFolders || [];
    console.log(`📁 ${folders.length}개 폴더 재생성 시작...\n`);
    
    for (const folder of folders) {
        console.log(`🔄 ${folder} 처리 중...`);
        try {
            await plugin.updateQuestionListTemplate(folder);
            console.log(`✅ ${folder} 완료`);
        } catch (error) {
            console.error(`❌ ${folder} 실패:`, error);
        }
    }
    
    console.log(`\n🎉 모든 폴더 재생성 완료!`);
    new Notice(`✅ ${folders.length}개 폴더 업데이트 완료!`);
    
    // 현재 열린 파일 새로고침
    const activeFile = app.workspace.getActiveFile();
    if (activeFile && activeFile.path.includes("문제목록")) {
        console.log("\n🔄 현재 파일 새로고침 중...");
        const leaf = app.workspace.activeLeaf;
        await leaf.setViewState({
            type: "markdown",
            state: { file: activeFile.path, mode: "source" }
        });
        await new Promise(r => setTimeout(r, 500));
        await leaf.setViewState({
            type: "markdown",
            state: { file: activeFile.path, mode: "preview" }
        });
        console.log("✅ 새로고침 완료!");
    }
}
