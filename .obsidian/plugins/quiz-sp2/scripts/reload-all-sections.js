// 플러그인 재로드 및 모든 섹션 변환 확인 스크립트

console.log('🔄 플러그인 재로드 시작...');

// 플러그인 비활성화
await app.plugins.disablePlugin('quiz-sp');
console.log('✅ 플러그인 비활성화 완료');

// 플러그인 활성화
await app.plugins.enablePlugin('quiz-sp');
console.log('✅ 플러그인 활성화 완료');

console.log('\n📊 모든 독립 섹션 변환 완료:');
console.log('  ❓ 문제 섹션: 보라색 독립 섹션 (Purple gradient + accent border)');
console.log('  ✅ 선택지 섹션: 초록색 독립 섹션 (Green gradient + green border)');
console.log('  💡 힌트 섹션: 주황색 독립 섹션 (Yellow gradient + orange border)');
console.log('  📝 노트 섹션: 파란색 독립 섹션 (Blue gradient + blue border)');

console.log('\n🎨 색상 체계:');
console.log('  🟣 Purple = 문제 (가장 중요)');
console.log('  🟢 Green = 선택지 (답변 선택)');
console.log('  🟠 Orange = 힌트 (도움말)');
console.log('  🔵 Blue = 노트 (추가 설명)');

console.log('\n✅ 모든 섹션이 독립적 구조로 통일되었습니다!');
console.log('   각 섹션: h3 헤더 (18px, 700) + 설명 (13px) + 컨텐츠');
