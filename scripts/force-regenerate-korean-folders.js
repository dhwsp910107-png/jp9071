/**
 * 한글 폴더명 인코딩 문제 해결 및 파일 재생성
 */

const plugin = app.plugins.plugins['quiz-sp'];
const folders = ['기본', 'N3', 'N4', 'N5'];

console.log("🔄 한글 폴더명으로 파일 재생성 시작...\n");

for (const folder of folders) {
    console.log(`📁 처리 중: ${folder}`);
    
    try {
        const folderPath = `HanziQuiz/Questions/${folder}`;
        const templatePath = `${folderPath}/문제목록.md`;
        
        // 파일 존재 확인
        const file = app.vault.getAbstractFileByPath(templatePath);
        
        if (file) {
            // 파일 삭제
            await app.vault.delete(file);
            console.log(`  🗑️ 기존 파일 삭제: ${templatePath}`);
        }
        
        // 새로 생성
        await plugin.updateQuestionListTemplate(folder);
        console.log(`  ✅ ${folder} 완료\n`);
        
    } catch (error) {
        console.error(`  ❌ ${folder} 실패:`, error);
    }
}

console.log("🎉 모든 폴더 재생성 완료!");
new Notice("✅ 문제목록 파일 재생성 완료!");

// 현재 파일 새로고침
const activeFile = app.workspace.getActiveFile();
if (activeFile) {
    console.log(`\n🔄 현재 파일 새로고침: ${activeFile.name}`);
    await new Promise(r => setTimeout(r, 1000));
    
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
