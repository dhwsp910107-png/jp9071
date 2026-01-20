/**
 * 간단한 Dataview 테스트 및 파일 새로고침
 */

const dv = app.plugins.plugins.dataview?.api;

if (!dv) {
    console.error("❌ Dataview API를 찾을 수 없습니다!");
    new Notice("❌ Dataview가 제대로 로드되지 않았습니다.");
} else {
    // 1. N3 폴더 쿼리 테스트
    const folder = "HanziQuiz/Questions/N3";
    const questions = dv.pages(`"${folder}"`)
        .where(p => p.file.name.includes("_") && !p.file.name.includes("문제목록"));
    
    console.log(`✅ N3 폴더: ${questions.length}개 문제 발견`);
    
    // 2. 기본 폴더 쿼리 테스트  
    const folder2 = "HanziQuiz/Questions/기본";
    const questions2 = dv.pages(`"${folder2}"`)
        .where(p => p.file.name.includes("_") && !p.file.name.includes("문제목록"));
    
    console.log(`✅ 기본 폴더: ${questions2.length}개 문제 발견`);
    
    // 3. 현재 열린 파일 새로고침
    const activeFile = app.workspace.getActiveFile();
    if (activeFile && activeFile.path.includes("문제목록")) {
        console.log(`\n🔄 ${activeFile.name} 새로고침 중...`);
        
        // 편집 모드로 전환 후 다시 미리보기로
        const activeLeaf = app.workspace.activeLeaf;
        if (activeLeaf) {
            // Reading view -> Source view -> Reading view
            await activeLeaf.setViewState({
                type: "markdown",
                state: { file: activeFile.path, mode: "source" }
            });
            
            await new Promise(resolve => setTimeout(resolve, 300));
            
            await activeLeaf.setViewState({
                type: "markdown", 
                state: { file: activeFile.path, mode: "preview" }
            });
            
            new Notice("✅ 파일 새로고침 완료!");
        }
    } else {
        console.log("\n💡 문제목록.md 파일을 열고 다시 실행하세요.");
        new Notice("💡 문제목록.md 파일을 열어주세요.");
    }
}
