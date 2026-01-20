/**
 * 문제목록.md DataviewJS 강제 실행 디버깅
 */

console.log("=== DataviewJS 디버깅 시작 ===\n");

// 1. 플러그인 상태 확인
const dataview = app.plugins.plugins.dataview;
const quizPlugin = app.plugins.plugins['quiz-sp'];

console.log("1️⃣ 플러그인 상태:");
console.log("   Dataview:", dataview ? "✅ 활성화" : "❌ 비활성화");
console.log("   Quiz Plugin:", quizPlugin ? "✅ 활성화" : "❌ 비활성화");

if (dataview) {
    console.log("\n2️⃣ Dataview 설정:");
    console.log("   enableDataviewJs:", dataview.settings.enableDataviewJs);
    console.log("   enableInlineDataviewJs:", dataview.settings.enableInlineDataviewJs);
    console.log("   refreshEnabled:", dataview.settings.refreshEnabled);
}

// 3. 현재 파일 확인
const activeFile = app.workspace.getActiveFile();
console.log("\n3️⃣ 현재 파일:");
if (activeFile) {
    console.log("   경로:", activeFile.path);
    console.log("   이름:", activeFile.name);
    
    // 파일 내용 읽기
    const content = await app.vault.read(activeFile);
    const dataviewjsBlocks = content.match(/```dataviewjs[\s\S]*?```/g);
    console.log("   DataviewJS 블록 개수:", dataviewjsBlocks?.length || 0);
    
    if (dataviewjsBlocks && dataviewjsBlocks.length > 0) {
        console.log("\n4️⃣ 첫 번째 DataviewJS 블록 미리보기:");
        console.log(dataviewjsBlocks[0].substring(0, 200) + "...");
    }
} else {
    console.log("   ❌ 활성 파일 없음");
}

// 5. View 상태 확인
const activeLeaf = app.workspace.activeLeaf;
if (activeLeaf?.view) {
    const viewState = activeLeaf.getViewState();
    console.log("\n5️⃣ View 상태:");
    console.log("   Type:", viewState.type);
    console.log("   Mode:", viewState.state?.mode);
}

// 6. 실제 쿼리 테스트
if (dataview?.api) {
    const dv = dataview.api;
    const folder = "HanziQuiz/Questions/기본";
    const questions = dv.pages(`"${folder}"`)
        .where(p => p.file.name.includes("_") && !p.file.name.includes("문제목록"));
    
    console.log("\n6️⃣ 쿼리 테스트:");
    console.log("   폴더:", folder);
    console.log("   결과:", questions.length, "개 문제");
}

// 7. 강제 새로고침 시도
console.log("\n7️⃣ 파일 새로고침 시도...");

if (activeFile && activeLeaf) {
    try {
        // Source 모드로 전환
        await activeLeaf.setViewState({
            type: "markdown",
            state: { 
                file: activeFile.path, 
                mode: "source",
                source: false
            }
        });
        
        console.log("   ✅ Source 모드로 전환");
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Reading 모드로 전환
        await activeLeaf.setViewState({
            type: "markdown",
            state: { 
                file: activeFile.path, 
                mode: "preview",
                source: false
            }
        });
        
        console.log("   ✅ Reading 모드로 전환");
        new Notice("✅ 파일 새로고침 완료! DataviewJS가 실행되어야 합니다.");
    } catch (e) {
        console.error("   ❌ 새로고침 실패:", e);
        new Notice("❌ 새로고침 실패");
    }
}

console.log("\n=== 디버깅 완료 ===");
