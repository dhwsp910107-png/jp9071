// 플러그인 reload 후 재생성

const PLUGIN_ID = 'quiz-sp';

(async () => {
    console.log('🔄 플러그인 reload 시작...');
    
    // 1. 플러그인 reload
    await app.plugins.disablePlugin(PLUGIN_ID);
    await new Promise(resolve => setTimeout(resolve, 500));
    await app.plugins.enablePlugin(PLUGIN_ID);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('✅ 플러그인 reload 완료');
    
    // 2. 플러그인 인스턴스 가져오기
    const plugin = app.plugins.plugins[PLUGIN_ID];
    if (!plugin) {
        console.error('❌ 플러그인을 찾을 수 없습니다');
        return;
    }
    
    // 3. 기본 폴더 재생성
    const folder = '기본';
    console.log(`📁 재생성 시작: ${folder}`);
    
    const filePath = `HanziQuiz/Questions/${folder}/문제목록.md`;
    const file = app.vault.getAbstractFileByPath(filePath);
    if (file) {
        console.log(`  🗑️ 기존 파일 삭제: ${filePath}`);
        await app.vault.delete(file);
        await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    console.log(`  📝 템플릿 생성 중...`);
    await plugin.updateQuestionListTemplate(folder);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    console.log(`  ✅ ${folder} 완료`);
    
    // 4. 파일 열기 및 새로고침
    const newFile = app.vault.getAbstractFileByPath(filePath);
    if (newFile) {
        const leaf = app.workspace.getLeaf(false);
        await leaf.openFile(newFile);
        
        // Reading View로 전환
        await new Promise(resolve => setTimeout(resolve, 300));
        await app.commands.executeCommandById('markdown:toggle-preview');
        
        console.log('✅ 파일 열기 완료!');
    }
    
    console.log('🎉 모든 작업 완료!');
})();
