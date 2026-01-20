// 플러그인 재로드
await app.plugins.disablePlugin('quiz-sp');
await app.plugins.enablePlugin('quiz-sp');
console.log('✅ 플러그인 재로드 완료!');
