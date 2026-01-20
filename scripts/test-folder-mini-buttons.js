// 폴더 카드 UI 업데이트: 통계 삭제 + 미니 버튼 추가

const PLUGIN_ID = 'quiz-sp';

(async () => {
    console.log('🔄 플러그인 reload...');
    
    await app.plugins.disablePlugin(PLUGIN_ID);
    await new Promise(resolve => setTimeout(resolve, 500));
    await app.plugins.enablePlugin(PLUGIN_ID);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('✅ 플러그인 reload 완료!\n');
    
    console.log('🎨 UI 업데이트 완료:\n');
    console.log('1. ❌ 통계 카드 4개 제거 (총 문제 수, 시도 횟수, 정답률, 북마크)');
    console.log('2. ✅ 폴더별 카드에 미니 버튼 3개 추가:');
    console.log('   - ➕ 문제 생성: 해당 폴더에 새 문제 추가');
    console.log('   - ✏️ 편집: 폴더 관리 모달 열기');
    console.log('   - 📋 목록: 해당 폴더의 문제 목록 보기');
    console.log('\n📋 테스트:');
    console.log('Ctrl + P → "Hanzi Quiz: 통합 한자 대시보드 열기"');
    console.log('\n✨ 폴더 카드 사용법:');
    console.log('- 카드 클릭: 퀴즈 시작');
    console.log('- 하단 버튼: 문제 관리 기능');
})();
