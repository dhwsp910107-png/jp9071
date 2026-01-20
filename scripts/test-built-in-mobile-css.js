/**
 * 📱 내장 CSS + 설정 On/Off 기능 테스트
 * 
 * ✅ 완료된 수정 사항:
 * 
 * 1. DEFAULT_SETTINGS에 추가:
 *    - enableMobileOptimization: true (기본값)
 * 
 * 2. HanziQuizPlugin.onload():
 *    - this.injectMobileCSS() 호출 추가 (loadSettings 직후)
 * 
 * 3. 새로운 메서드 추가:
 *    - injectMobileCSS(): CSS 주입/제거 로직
 *      * document.getElementById('hanzi-quiz-mobile-css') 검색
 *      * 기존 스타일 제거
 *      * 설정이 true면 <style> 태그 생성 및 삽입
 *      * 설정이 false면 CSS 제거만 수행
 *    - onunload(): 플러그인 언로드 시 CSS 제거
 * 
 * 4. saveSettings() 수정:
 *    - 설정 저장 후 injectMobileCSS() 호출
 *    - 설정 변경 시 즉시 CSS 재적용
 * 
 * 5. 설정 탭 추가 (HanziQuizSettingTab):
 *    - 섹션: "📱 모바일 설정"
 *    - 토글: "모바일 최적화 CSS"
 *    - 설명: 터치 영역 확대, 키보드 회피, 반응형 레이아웃
 *    - onChange: Notice로 활성화/비활성화 피드백
 * 
 * 6. 내장 CSS 내용:
 *    - Dashboard Folder Cards (3 breakpoints: 768px, 480px, 360px)
 *    - Input Keyboard Avoidance (scroll-margin)
 *    - Touch Target Optimization (min 44px)
 *    - Quiz Options Grid (1 column on mobile)
 *    - Modal Optimization (95vw, 90vh)
 *    - Dashboard Buttons (2 columns)
 *    - Statistics Cards (2 columns)
 *    - Accessibility (focus, active states)
 *    - Performance (GPU acceleration, touch scrolling)
 *    - Prevent Horizontal Scroll
 *    - Landscape Mode
 * 
 * 📊 장점:
 * - ✅ 다른 플러그인과 충돌 없음 (독립적인 style 태그)
 * - ✅ CSS snippet 관리 불필요
 * - ✅ 설정에서 즉시 On/Off 가능
 * - ✅ 플러그인 언로드 시 자동 제거
 * - ✅ 설정 변경 시 즉시 반영 (플러그인 리로드 불필요)
 * 
 * 🎯 사용 방법:
 * 1. 설정 → 한자 퀴즈 → 📱 모바일 설정
 * 2. "모바일 최적화 CSS" 토글
 * 3. 즉시 적용/해제됨 (Notice 확인)
 * 
 * 📱 테스트 방법:
 * 1. JS Engine으로 이 스크립트 실행
 * 2. 설정 → 한자 퀴즈 → 모바일 설정 확인
 * 3. 토글 Off: 기존 CSS 스타일
 * 4. 토글 On: 모바일 최적화 스타일 적용
 * 5. 대시보드 열어서 폴더 카드 크기 확인
 * 6. 개발자 도구: <head>에 #hanzi-quiz-mobile-css 확인
 */

// 플러그인 리로드
const pluginId = 'quiz-sp';

// 플러그인 비활성화
await this.app.plugins.disablePlugin(pluginId);
console.log('✅ 플러그인 비활성화 완료');

// 짧은 대기
await new Promise(resolve => setTimeout(resolve, 500));

// 플러그인 활성화
await this.app.plugins.enablePlugin(pluginId);
console.log('✅ 플러그인 활성화 완료');

console.log('\n📱 내장 CSS + 설정 On/Off 기능 적용 완료!');
console.log('\n🎯 테스트 체크리스트:');
console.log('[ ] 설정 → 한자 퀴즈 → 📱 모바일 설정 섹션 존재');
console.log('[ ] "모바일 최적화 CSS" 토글 존재');
console.log('[ ] 토글 On → Notice "✅ 모바일 최적화 활성화됨"');
console.log('[ ] 토글 Off → Notice "❌ 모바일 최적화 비활성화됨"');
console.log('[ ] 개발자 도구(F12) → <head> → #hanzi-quiz-mobile-css 확인');
console.log('[ ] 대시보드에서 폴더 카드 크기 변화 확인');
console.log('[ ] 모바일 모드(360px)에서 2열 그리드 확인');

// 현재 설정 상태 확인
const plugin = this.app.plugins.plugins[pluginId];
console.log('\n📊 현재 설정 상태:');
console.log('enableMobileOptimization:', plugin.settings.enableMobileOptimization);

// CSS 적용 여부 확인
const cssElement = document.getElementById('hanzi-quiz-mobile-css');
console.log('CSS 적용 상태:', cssElement ? '✅ 적용됨' : '❌ 비활성화됨');
if (cssElement) {
    console.log('CSS 길이:', cssElement.textContent.length, '문자');
}
