// 최종 업데이트 테스트: 기록관리 닫기 → 대시보드, 리본 아이콘

const PLUGIN_ID = 'quiz-sp';

(async () => {
    console.log('🔄 플러그인 reload...');
    
    await app.plugins.disablePlugin(PLUGIN_ID);
    await new Promise(resolve => setTimeout(resolve, 500));
    await app.plugins.enablePlugin(PLUGIN_ID);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('✅ 플러그인 reload 완료!\n');
    
    console.log('🎉 업데이트 완료:\n');
    console.log('1. ✅ 기록 관리 모달 닫기 → 대시보드로 돌아가기');
    console.log('2. ✅ 좌측 리본: "book-open" 아이콘 (기존 대시보드)');
    console.log('3. ✅ 좌측 리본: "layout-dashboard" 아이콘 (통합 대시보드)');
    console.log('\n📋 테스트 방법:');
    console.log('1. 좌측 리본에서 두 번째 아이콘(통합 대시보드) 클릭');
    console.log('2. 기록 관리 버튼 클릭');
    console.log('3. X 버튼으로 닫기 → 대시보드로 자동 복귀 확인');
    console.log('\n💡 추가 방법:');
    console.log('- Ctrl + P → "Hanzi Quiz: 통합 한자 대시보드 열기"');
    console.log('- 우측 사이드바는 ItemView 방식으로 별도 구현 필요');
})();
