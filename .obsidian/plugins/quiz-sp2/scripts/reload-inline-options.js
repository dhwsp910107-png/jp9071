// 선택지 독립적 크기 적용

console.log('🔄 플러그인 재로드 시작...');

await app.plugins.disablePlugin('quiz-sp');
console.log('✅ 플러그인 비활성화 완료');

await app.plugins.enablePlugin('quiz-sp');
console.log('✅ 플러그인 활성화 완료');

console.log('\n✅ 수정 완료:');
console.log('\n📏 선택지 버튼에 인라인 스타일 직접 적용:');
console.log('  - padding: 20px 24px');
console.log('  - font-size: 18px');
console.log('  - font-weight: 500');
console.log('  - min-height: 64px');
console.log('  - border: 2px solid');
console.log('  - border-radius: 12px');
console.log('  - 그라데이션 배경');
console.log('  - 그림자 효과');
console.log('\n🎨 호버 효과도 JavaScript로 추가:');
console.log('  - mouseenter: 위로 올라감, 테두리 강조, 그림자 증가');
console.log('  - mouseleave: 원래대로 복귀');
console.log('\n✨ 결과:');
console.log('  - CSS 클래스와 무관하게 독립적으로 큰 크기');
console.log('  - 힌트/노트와 비슷한 시각적 레벨');
console.log('  - 모든 테마에서 동일하게 적용');
