// 완전 강제 재생성 - 파일 시스템 직접 삭제

const fs = require('fs');
const path = require('path');

const PLUGIN_ID = 'quiz-sp';

(async () => {
    console.log('🔄 완전 강제 재생성 시작...');
    
    const folder = '기본';
    const vaultPath = app.vault.adapter.basePath;
    const filePath = path.join(vaultPath, 'HanziQuiz', 'Questions', folder, '문제목록.md');
    
    // 1. 파일 시스템에서 직접 삭제
    try {
        if (fs.existsSync(filePath)) {
            console.log(`🗑️ 파일 시스템에서 삭제: ${filePath}`);
            fs.unlinkSync(filePath);
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    } catch (e) {
        console.error('파일 삭제 오류:', e);
    }
    
    // 2. Obsidian 캐시 새로고침
    console.log('🔄 캐시 새로고침...');
    await app.vault.adapter.reconcileFolderCreation('HanziQuiz/Questions/' + folder);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // 3. 플러그인 reload
    console.log('🔄 플러그인 reload...');
    await app.plugins.disablePlugin(PLUGIN_ID);
    await new Promise(resolve => setTimeout(resolve, 500));
    await app.plugins.enablePlugin(PLUGIN_ID);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 4. 플러그인 인스턴스로 재생성
    const plugin = app.plugins.plugins[PLUGIN_ID];
    if (!plugin) {
        console.error('❌ 플러그인을 찾을 수 없습니다');
        return;
    }
    
    console.log('📝 템플릿 생성 중...');
    await plugin.updateQuestionListTemplate(folder);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 5. 파일 확인
    const newFile = app.vault.getAbstractFileByPath(`HanziQuiz/Questions/${folder}/문제목록.md`);
    if (newFile) {
        console.log('✅ 파일 생성 확인');
        
        // 내용 읽어보기
        const content = await app.vault.read(newFile);
        const firstLines = content.split('\n').slice(0, 20).join('\n');
        console.log('📄 파일 내용 (처음 20줄):');
        console.log(firstLines);
        
        // 파일 열기
        const leaf = app.workspace.getLeaf(false);
        await leaf.openFile(newFile);
        await new Promise(resolve => setTimeout(resolve, 300));
        await app.commands.executeCommandById('markdown:toggle-preview');
        
        console.log('✅ 완료!');
    } else {
        console.error('❌ 파일이 생성되지 않았습니다');
    }
})();
