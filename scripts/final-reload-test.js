// 최종 테스트: reload 후 폴더별 퀴즈에서 목록 보기

const PLUGIN_ID = 'quiz-sp';

(async () => {
    console.log('🔄 플러그인 reload...');
    
    await app.plugins.disablePlugin(PLUGIN_ID);
    await new Promise(resolve => setTimeout(resolve, 500));
    await app.plugins.enablePlugin(PLUGIN_ID);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('✅ 플러그인 reload 완료');
    console.log('');
    console.log('📝 이제 다음 단계를 진행하세요:');
    console.log('1. Ctrl + P');
    console.log('2. "Hanzi Quiz: 통합 한자 대시보드 열기" 선택');
    console.log('3. "📂 폴더별 퀴즈" 섹션으로 스크롤');
    console.log('4. "기본" 폴더의 "📋 목록" 버튼 클릭');
    console.log('');
    console.log('✅ DataviewJS 형식으로 보일 것입니다!');
})();
