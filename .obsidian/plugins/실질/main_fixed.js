// 메인 대시보드에서 이해도를 퍼센트로 변경하는 패치
// main.js 파일 약 1050라인 근처에 다음 코드를 찾아서 수정하세요:

// ❌ 기존 코드:
// const understanding = lecture.page['understanding'] || 0;
// const brains = '🧠'.repeat(Math.round(understanding));

// ✅ 수정 코드:
const understanding = lecture.page['understanding'] || 0;
const understandingPercent = understanding > 0 ? `${understanding * 20}%` : '-';

// 그리고 테이블에서:
// ❌ 기존: brains
// ✅ 수정: understandingPercent
