// 중복 변수 선언 오류 수정

console.log('🔄 플러그인 재로드 시작...');

await app.plugins.disablePlugin('quiz-sp');
console.log('✅ 플러그인 비활성화 완료');

await app.plugins.enablePlugin('quiz-sp');
console.log('✅ 플러그인 활성화 완료');

console.log('\n✅ 수정 완료:');
console.log('  ❌ 문제: minutes, seconds, timeDisplay 변수가 두 번 선언됨');
console.log('  ✅ 해결: 중복 선언 제거, 한 번만 선언');
console.log('\n📋 수정된 순서:');
console.log('  1. totalTimeSeconds 계산 및 검증');
console.log('  2. percentage 계산');
console.log('  3. minutes, seconds, timeDisplay 선언 (한 번만!)');
console.log('  4. 로그 기록 (변수 사용)');
console.log('  5. 화면 표시 (동일한 변수 재사용)');
