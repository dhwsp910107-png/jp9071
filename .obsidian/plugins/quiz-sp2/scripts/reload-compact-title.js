// 퀴즈 완료와 소요시간 한 줄 배치

console.log('🔄 플러그인 재로드 시작...');

await app.plugins.disablePlugin('quiz-sp');
console.log('✅ 플러그인 비활성화 완료');

await app.plugins.enablePlugin('quiz-sp');
console.log('✅ 플러그인 활성화 완료');

console.log('\n✅ 수정 완료:');
console.log('\n📐 레이아웃 변경:');
console.log('  첫 줄: 🎉 퀴즈 완료! ←→ ⏱️ 3분 25초');
console.log('    - 좌우 정렬 (space-between)');
console.log('    - 제목: 24px');
console.log('    - 시간: 18px, 회색');
console.log('\n  점수 카드: 2칸으로 축소');
console.log('    - 정답수 (32px) | 정답률 (32px)');
console.log('    - 시간은 제목 줄로 이동');
console.log('\n  ✨ 결과:');
console.log('    - 더욱 컴팩트한 디자인');
console.log('    - 시간이 제목과 같은 레벨로 보임');
console.log('    - 점수 카드가 더 강조됨');
