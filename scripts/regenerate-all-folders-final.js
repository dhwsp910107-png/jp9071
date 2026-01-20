// 모든 폴더 완전 강제 재생성

const fs = require('fs');
const path = require('path');

const PLUGIN_ID = 'quiz-sp';

(async () => {
    console.log('🔄 모든 폴더 재생성 시작...\n');
    
    const folders = ['N3', 'N4', 'N5'];
    const vaultPath = app.vault.adapter.basePath;
    
    // 1. 플러그인 reload 한 번만
    console.log('🔄 플러그인 reload...');
    await app.plugins.disablePlugin(PLUGIN_ID);
    await new Promise(resolve => setTimeout(resolve, 500));
    await app.plugins.enablePlugin(PLUGIN_ID);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const plugin = app.plugins.plugins[PLUGIN_ID];
    if (!plugin) {
        console.error('❌ 플러그인을 찾을 수 없습니다');
        return;
    }
    
    // 2. 각 폴더 처리
    for (const folder of folders) {
        console.log(`\n📁 처리 중: ${folder}`);
        
        const filePath = path.join(vaultPath, 'HanziQuiz', 'Questions', folder, '문제목록.md');
        
        // 파일 시스템에서 직접 삭제
        try {
            if (fs.existsSync(filePath)) {
                console.log(`  🗑️ 파일 삭제`);
                fs.unlinkSync(filePath);
                await new Promise(resolve => setTimeout(resolve, 300));
            }
        } catch (e) {
            console.error(`  ❌ 삭제 오류:`, e.message);
        }
        
        // 캐시 새로고침
        await app.vault.adapter.reconcileFolderCreation(`HanziQuiz/Questions/${folder}`);
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // 템플릿 생성
        console.log(`  📝 템플릿 생성 중...`);
        await plugin.updateQuestionListTemplate(folder);
        await new Promise(resolve => setTimeout(resolve, 500));
        
        console.log(`  ✅ ${folder} 완료`);
    }
    
    console.log('\n🎉 모든 폴더 재생성 완료!');
    console.log('\n📂 재생성된 폴더:');
    console.log('  ✅ 기본 (이미 완료)');
    for (const folder of folders) {
        console.log(`  ✅ ${folder}`);
    }
})();
