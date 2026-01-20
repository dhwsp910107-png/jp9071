/**
 * 📊 폴더 카드 컴팩트 디자인 + 모바일 최적화 테스트
 * 
 * ✅ 완료된 수정 사항:
 * 
 * 1. 폴더 카드 크기 축소:
 *    - Grid: minmax(180px → 140px, 1fr)
 *    - Padding: 20px → 15px
 *    - Border-radius: 12px → 10px
 *    - Gap: 15px → 10px
 * 
 * 2. 텍스트 크기 축소:
 *    - 아이콘: 32px → 28px
 *    - 폴더명: 20px → 16px
 *    - 문제 수: 28px → 22px
 *    - 통계: 12px → 11px
 *    - 섹션 제목: 22px → 18px
 * 
 * 3. 버튼 최적화:
 *    - Padding: 6px 12px → 5px 10px
 *    - Font-size: 14px → 13px
 *    - Gap: 6px → 5px
 *    - Min-height/width: 36px (터치 영역 보장)
 * 
 * 4. 📋 목록 → 📊 퀴즈 기록으로 변경:
 *    - 버튼 아이콘: 📋 → 📊
 *    - 동작: viewFolderQuestionList → QuizDetailRecordModal + 폴더 탭 자동 전환
 *    - 타이밍: 100ms 후 폴더 탭 클릭
 * 
 * 5. 모바일 CSS 최적화 추가:
 *    - @media (max-width: 768px): 130px grid, 12px padding
 *    - @media (max-width: 480px): 2열 고정, 10px padding
 *    - @media (max-width: 360px): 8px padding, 5px gap
 *    - 터치 영역: min 36px 보장
 * 
 * 6. 모바일 반응형 처리:
 *    - -webkit-tap-highlight-color: transparent
 *    - 터치 스크롤 최적화
 *    - 안전 영역 대응
 * 
 * 📱 테스트 방법:
 * 1. JS Engine으로 이 스크립트 실행
 * 2. 플러그인 자동 리로드
 * 3. 대시보드 열어서 확인:
 *    - 폴더 카드가 더 작고 컴팩트한지
 *    - 3개 버튼이 작은 크기로 표시되는지
 *    - 📊 퀴즈 기록 버튼 클릭 시 기록 모달 + 폴더 탭 자동 전환
 * 4. 모바일 모드 테스트:
 *    - Chrome DevTools → Toggle device toolbar
 *    - Galaxy S20 (360x800) 선택
 *    - 2열 그리드, 터치 영역 확인
 */

// 플러그인 리로드
const pluginId = 'quiz-sp';
const app = this.app;

// 플러그인 비활성화
await app.plugins.disablePlugin(pluginId);
console.log('✅ 플러그인 비활성화 완료');

// 짧은 대기
await new Promise(resolve => setTimeout(resolve, 500));

// 플러그인 활성화
await app.plugins.enablePlugin(pluginId);
console.log('✅ 플러그인 활성화 완료');

console.log('\n📊 컴팩트 디자인 + 모바일 최적화 적용 완료!');
console.log('\n🎯 테스트 체크리스트:');
console.log('[ ] 폴더 카드가 더 작고 간결하게 표시됨');
console.log('[ ] 버튼 3개(➕, ✏️, 📊)가 작은 크기로 표시됨');
console.log('[ ] 📊 클릭 시 퀴즈 기록 모달 열림');
console.log('[ ] 모달에서 폴더 탭 자동 전환');
console.log('[ ] 모바일 모드(360px)에서 2열 그리드 확인');
console.log('[ ] 터치 영역 최소 36px 유지됨');
