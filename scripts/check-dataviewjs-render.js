/**
 * DataviewJS 렌더링 강제 트리거
 */

const dataview = app.plugins.plugins.dataview;
const activeFile = app.workspace.getActiveFile();

if (!activeFile) {
    new Notice("❌ 파일을 열어주세요");
} else {
    console.log("🔄 DataviewJS 렌더링 강제 실행...\n");
    
    // Dataview의 내부 인덱스에서 파일 정보 가져오기
    const page = dataview.index.pages.get(activeFile.path);
    console.log("페이지 정보:", page);
    
    // 모든 Dataview 컨테이너 찾기
    const containers = document.querySelectorAll('.block-language-dataviewjs');
    console.log(`발견된 DataviewJS 블록: ${containers.length}개`);
    
    if (containers.length === 0) {
        console.warn("⚠️ DataviewJS 블록이 DOM에 렌더링되지 않았습니다!");
        console.log("💡 Reading View로 전환이 필요할 수 있습니다.");
        
        // Reading View로 명시적 전환
        const leaf = app.workspace.activeLeaf;
        await leaf.setViewState({
            type: "markdown",
            state: {
                file: activeFile.path,
                mode: "preview",
                source: false
            }
        });
        
        // 잠시 대기 후 다시 확인
        await new Promise(r => setTimeout(r, 1000));
        
        const containersAfter = document.querySelectorAll('.block-language-dataviewjs');
        console.log(`새로고침 후 DataviewJS 블록: ${containersAfter.length}개`);
        
        if (containersAfter.length > 0) {
            new Notice("✅ DataviewJS 블록이 렌더링되었습니다!");
        } else {
            new Notice("⚠️ 여전히 렌더링 안 됨. Live Preview를 비활성화해보세요.");
            console.log("\n💡 해결 방법:");
            console.log("1. 설정 → 편집기 → 'Live Preview' 끄기");
            console.log("2. 파일 닫고 다시 열기");
        }
    } else {
        console.log("✅ DataviewJS 블록이 이미 렌더링되어 있습니다.");
        
        // 각 블록의 내용 확인
        containers.forEach((container, i) => {
            console.log(`\n블록 ${i + 1}:`);
            console.log("- HTML:", container.innerHTML.substring(0, 100));
            console.log("- 클래스:", container.className);
        });
        
        new Notice("✅ DataviewJS가 정상적으로 렌더링되어 있습니다!");
    }
}
