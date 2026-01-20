// 선택지 디자인 확대 및 개선

console.log('🔄 플러그인 재로드 시작...');

await app.plugins.disablePlugin('quiz-sp');
console.log('✅ 플러그인 비활성화 완료');

await app.plugins.enablePlugin('quiz-sp');
console.log('✅ 플러그인 활성화 완료');

console.log('\n✅ 수정 완료:');
console.log('\n📏 선택지 버튼 디자인 변경:');
console.log('  크기:');
console.log('    - 패딩: 15px 20px → 20px 24px');
console.log('    - 폰트: 16px → 18px');
console.log('    - 폰트 굵기: 500 (medium)');
console.log('    - 최소 높이: 48px → 64px');
console.log('    - 라인 높이: 1.5 → 1.6');
console.log('\n  스타일:');
console.log('    - 배경: 그라데이션 추가');
console.log('    - 테두리: 2px solid border');
console.log('    - 둥근 모서리: 8px → 12px');
console.log('    - 그림자: 0 2px 6px (기본)');
console.log('\n  호버 효과:');
console.log('    - 이동: translateX(5px) → translateY(-2px)');
console.log('    - 배경: 그라데이션 반전');
console.log('    - 테두리: 악센트 컬러');
console.log('    - 그림자: 0 4px 12px (강조)');
console.log('\n  ✨ 결과:');
console.log('    - 힌트/노트와 비슷한 크기감');
console.log('    - 더 클릭하기 편한 터치 영역');
console.log('    - 시각적으로 더 명확한 선택지');
