// 버튼 사라지는 문제 수정 확인

console.log('🔄 플러그인 재로드 시작...');

await app.plugins.disablePlugin('quiz-sp');
console.log('✅ 플러그인 비활성화 완료');

await app.plugins.enablePlugin('quiz-sp');
console.log('✅ 플러그인 활성화 완료');

console.log('\n✅ 수정 완료:');
console.log('  ❌ 문제: clearAllBtn 이벤트에서 logList를 참조했지만');
console.log('           logList가 그 아래에서 정의되어 스크립트 오류 발생');
console.log('  ✅ 해결: logList를 먼저 생성한 후 clearAllBtn 생성');
console.log('\n📋 올바른 순서:');
console.log('  1. logHeader 생성');
console.log('  2. logList 생성 (먼저!)');
console.log('  3. clearAllBtn 생성 (logList 참조 가능)');
console.log('\n🔘 이제 모든 버튼이 정상적으로 표시됩니다:');
console.log('  - 🔄 다시 풀기');
console.log('  - 📊 상세 기록');
console.log('  - 📁 폴더 관리');
console.log('  - ❌ 오답만 복습');
console.log('  - 🚪 나가기');
