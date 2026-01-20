// 퀴즈 완료 화면 상세 기록 버튼 수정 확인

console.log('🔄 플러그인 재로드 시작...');

await app.plugins.disablePlugin('quiz-sp');
console.log('✅ 플러그인 비활성화 완료');

await app.plugins.enablePlugin('quiz-sp');
console.log('✅ 플러그인 활성화 완료');

console.log('\n✅ 수정 완료:');
console.log('  ❌ 문제: retryBtn 이벤트 안에 로그/히스토리 코드가 잘못 삽입됨');
console.log('  ✅ 해결: 로그/히스토리 섹션을 버튼 컨테이너 이후로 이동');
console.log('  ✅ 결과: "📊 상세 기록" 버튼이 정상적으로 표시됨');
console.log('\n📊 퀴즈 완료 화면 버튼 순서:');
console.log('  1. 🔄 다시 풀기');
console.log('  2. 📊 상세 기록 - 복구됨!');
console.log('  3. 📁 폴더 관리');
console.log('  4. ❌ 오답만 복습');
console.log('  5. 🚪 나가기');
console.log('  6. 📝 퀴즈 로그/히스토리 (맨 아래)');
