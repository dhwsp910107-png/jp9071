// 최종 대시보드 reload

const PLUGIN_ID = 'quiz-sp';

(async () => {
    console.log('🔄 플러그인 reload...');
    
    await app.plugins.disablePlugin(PLUGIN_ID);
    await new Promise(resolve => setTimeout(resolve, 500));
    await app.plugins.enablePlugin(PLUGIN_ID);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('✅ 플러그인 reload 완료!');
    console.log('\n📋 이제 다음을 실행하세요:');
    console.log('Ctrl + P → "Hanzi Quiz: 통합 한자 대시보드 열기"');
    console.log('\n✨ 변경 사항:');
    console.log('1. 📂 폴더별 퀴즈 카드를 최상단으로 이동');
    console.log('2. 클릭 한 번으로 바로 퀴즈 시작');
    console.log('3. 통계 카드 4개 (2x2 그리드, 오렌지 그라디언트)');
    console.log('4. "오늘의 학습 목표" 카드 제거');
})();
