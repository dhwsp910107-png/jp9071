// 문제 편집 모달 버튼 크기 축소

console.log('🔄 플러그인 재로드 시작...');

await app.plugins.disablePlugin('quiz-sp');
console.log('✅ 플러그인 비활성화 완료');

await app.plugins.enablePlugin('quiz-sp');
console.log('✅ 플러그인 활성화 완료');

console.log('\n✅ 수정 완료:');
console.log('\n🔘 버튼 크기 축소:');
console.log('  저장/취소 버튼:');
console.log('    - padding: 6px 16px (작게)');
console.log('    - font-size: 13px');
console.log('\n  입력 영역은 크게 유지:');
console.log('    - 문제: 200px');
console.log('    - 힌트: 160px');
console.log('    - 노트: 160px');
console.log('    - 선택지: 54px');
console.log('\n  ✨ 결과:');
console.log('    - 버튼이 작아 보임');
console.log('    - 입력 영역이 상대적으로 더 강조됨');
console.log('    - 더 나은 시각적 균형');
