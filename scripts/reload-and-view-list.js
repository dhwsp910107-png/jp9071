// 플러그인 reload 후 목록 보기 테스트

const PLUGIN_ID = 'quiz-sp';

(async () => {
    console.log('🔄 플러그인 reload 시작...');
    
    // 플러그인 reload
    await app.plugins.disablePlugin(PLUGIN_ID);
    await new Promise(resolve => setTimeout(resolve, 500));
    await app.plugins.enablePlugin(PLUGIN_ID);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('✅ 플러그인 reload 완료');
    
    const plugin = app.plugins.plugins[PLUGIN_ID];
    if (!plugin) {
        console.error('❌ 플러그인을 찾을 수 없습니다');
        return;
    }
    
    // 기본 폴더 목록 보기
    console.log('📋 기본 폴더 목록 열기...');
    await plugin.viewFolderQuestionList('기본');
    
    console.log('✅ 완료! Reading View로 전환하세요.');
})();
