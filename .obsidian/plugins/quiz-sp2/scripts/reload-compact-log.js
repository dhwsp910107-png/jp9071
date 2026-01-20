// 퀴즈 로그를 한 줄로 통합

console.log('🔄 플러그인 재로드 시작...');

await app.plugins.disablePlugin('quiz-sp');
console.log('✅ 플러그인 비활성화 완료');

await app.plugins.enablePlugin('quiz-sp');
console.log('✅ 플러그인 활성화 완료');

console.log('\n✅ 수정 완료:');
console.log('\n📝 퀴즈 로그 형식 변경:');
console.log('  이전 (2줄):');
console.log('    퀴즈 완료: 8 / 10 (80%)');
console.log('    소요 시간: 120초');
console.log('\n  변경 후 (1줄):');
console.log('    퀴즈 완료: 8/10 (80%) - 소요시간: 2분 0초');
console.log('\n  ✨ 장점:');
console.log('    - 한 눈에 모든 정보 확인');
console.log('    - 로그 공간 절약');
console.log('    - 더 깔끔한 히스토리');
console.log('    - 시간 표시를 "분/초" 형식으로 개선');
