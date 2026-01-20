// 퀴즈 완료 부분 디자인 컴팩트화

console.log('🔄 플러그인 재로드 시작...');

await app.plugins.disablePlugin('quiz-sp');
console.log('✅ 플러그인 비활성화 완료');

await app.plugins.enablePlugin('quiz-sp');
console.log('✅ 플러그인 활성화 완료');

console.log('\n✅ 수정 완료:');
console.log('\n📏 디자인 변경:');
console.log('  🎉 제목:');
console.log('    - 크기: 24px (이전보다 작게)');
console.log('    - 여백: 0 0 16px 0 (줄임)');
console.log('    - 중앙 정렬');
console.log('\n  📊 점수 카드:');
console.log('    - 레이아웃: 가로 3칸 flex (이전: 세로 쌓임)');
console.log('    - 패딩: 16px (이전보다 작게)');
console.log('    - 그라데이션 배경 (악센트 컬러)');
console.log('    - 각 항목:');
console.log('      * 큰 숫자: 28px (정답수/정답률), 20px (시간)');
console.log('      * 작은 라벨: 11px, 반투명');
console.log('      * 중앙 정렬');
console.log('\n  ✨ 결과:');
console.log('    - 전체 높이 감소');
console.log('    - 정보 밀도 증가');
console.log('    - 한눈에 들어오는 레이아웃');
console.log('    - 로그 영역이 더 잘 보임');
