// =====================================================
// Part 7: 통합 가이드 및 테스트 방법
// =====================================================

# 📌 북마크 기능 통합 가이드

## 파일 구조
```
bookmark-part1-css.js       → CSS 스타일
bookmark-part2-ui.js        → 퀴즈 모드 UI (체크박스)
bookmark-part3-menu.js      → 메뉴 항목
bookmark-part4-modal.js     → 북마크 목록 모달
bookmark-part5-quiz.js      → 북마크 퀴즈 모달
bookmark-part6-methods.js   → 플러그인 메서드
```

## 🔧 통합 순서

### 1단계: CSS 추가 ✅
**위치**: `addStyles()` 메서드 끝부분
**파일**: bookmark-part1-css.js
**내용**: 북마크 UI 스타일

```javascript
addStyles() {
    const styleEl = document.createElement('style');
    styleEl.id = 'enhanced-cloze-styles';
    styleEl.textContent = `
        // ... 기존 스타일들 ...
        
        /* 여기에 bookmark-part1-css.js 내용 추가 */
    `;
    document.head.appendChild(styleEl);
}
```

---

### 2단계: 체크박스 UI 추가
**위치**: `QuizModeModal.displayCurrentNote()` 메서드
**파일**: bookmark-part2-ui.js
**위치**: `const contentDiv = container.createDiv({ cls: 'quiz-note-content' });` 바로 다음

```javascript
async displayCurrentNote(container) {
    container.empty();
    // ... 기존 코드 ...
    
    const contentDiv = container.createDiv({ cls: 'quiz-note-content' });
    contentDiv.style.cssText = '...';
    
    /* 여기에 bookmark-part2-ui.js 내용 추가 */
    // ========== 북마크 체크박스 추가 시작 ==========
    // ... 체크박스 코드 ...
    // ========== 북마크 체크박스 추가 끝 ==========
    
    // 우클릭 컨텍스트 메뉴 활성화
    contentDiv.addEventListener('contextmenu', (e) => {
        // ... 기존 코드 계속 ...
    });
}
```

---

### 3단계: 메뉴 항목 추가
**위치**: `QuizModeModal.onOpen()` 메서드의 메뉴 버튼(☰) onClick 이벤트
**파일**: bookmark-part3-menu.js
**위치**: 기존 `menu.addItem()` 들 다음, `menu.showAtMouseEvent(e);` 전

```javascript
menuBtn.onclick = (e) => {
    const menu = new Menu();
    
    // 대시보드로 이동
    menu.addItem((item) => { ... });
    
    // ... 기존 메뉴 항목들 ...
    
    /* 여기에 bookmark-part3-menu.js 내용 추가 */
    menu.addSeparator();
    // 북마크 보기
    menu.addItem((item) => { ... });
    // 북마크 퀴즈 시작
    menu.addItem((item) => { ... });
    
    menu.showAtMouseEvent(e);
};
```

---

### 4단계: 모달 클래스 추가
**위치**: 파일 끝 (ImageClozeEditModal 다음)
**파일**: bookmark-part4-modal.js, bookmark-part5-quiz.js

```javascript
// ... ImageClozeEditModal 클래스 끝 ...

/* 여기에 bookmark-part4-modal.js 내용 추가 */
// =====================================================
// 북마크 목록 모달
// =====================================================
class BookmarkListModal extends Modal { ... }

/* 여기에 bookmark-part5-quiz.js 내용 추가 */
// =====================================================
// 북마크 퀴즈 모달
// =====================================================
class BookmarkQuizModal extends QuizModeModal { ... }
```

---

### 5단계: 플러그인 메서드 추가
**위치**: `EnhancedClozePlugin` 클래스 안
**파일**: bookmark-part6-methods.js
**위치**: 기존 메서드들 사이 (예: `saveSettings()` 다음)

```javascript
class EnhancedClozePlugin extends Plugin {
    // ... 기존 메서드들 ...
    
    async saveSettings(skipRefresh = false) {
        await this.saveData(this.settings);
        // ...
    }
    
    /* 여기에 bookmark-part6-methods.js 내용 추가 */
    // 북마크 내보내기
    async exportBookmarks() { ... }
    
    // 북마크 가져오기
    async importBookmarks(jsonStr) { ... }
    
    // 북마크 통계
    getBookmarkStats() { ... }
    
    // ... 나머지 메서드들 ...
}
```

---

## 🧪 테스트 방법

### 1. 기본 기능 테스트
1. Obsidian 재시작
2. 퀴즈 모드 열기 (`Cmd+P` → "Open quiz mode")
3. 카드 상단에 체크박스가 보이는지 확인
4. 체크박스 클릭하여 북마크 추가/제거 테스트

### 2. 북마크 목록 테스트
1. 메뉴 버튼(☰) 클릭
2. "📌 북마크 보기" 선택
3. 북마크 목록이 표시되는지 확인
4. 파일 열기, 삭제 기능 테스트

### 3. 북마크 퀴즈 테스트
1. 여러 카드를 북마크
2. 메뉴 → "⭐ 북마크 퀴즈 시작"
3. 북마크한 카드들만 나오는지 확인

### 4. 내보내기 테스트
1. 메뉴 → "📤 북마크 내보내기"
2. 클립보드에 JSON이 복사되는지 확인

---

## ❗ 주의사항

1. **코드 순서**: 반드시 위에서 아래 순서대로 추가
2. **중괄호 확인**: 각 Part를 추가할 때 기존 중괄호를 닫지 않도록 주의
3. **모바일 테스트**: 안드로이드/iOS에서 체크박스 터치 동작 확인
4. **성능**: 북마크가 많아질 경우 (100개 이상) 페이지네이션 고려

---

## 🎉 완료 후 확인사항

- [ ] CSS 스타일이 적용되었는가?
- [ ] 체크박스가 퀴즈 모드에 표시되는가?
- [ ] 북마크 추가/제거가 동작하는가?
- [ ] 북마크 목록 모달이 열리는가?
- [ ] 북마크 퀴즈가 정상 작동하는가?
- [ ] 모바일에서 터치가 잘 되는가?
- [ ] 설정이 저장/로드되는가?

---

## 🐛 문제 해결

### 체크박스가 보이지 않음
→ Part 2 코드가 정확한 위치에 추가되었는지 확인

### 북마크가 저장되지 않음
→ `await this.plugin.saveSettings()` 호출 확인

### 모달이 열리지 않음
→ Part 4, 5 클래스가 파일 끝에 추가되었는지 확인

### 메뉴에 항목이 없음
→ Part 3 코드가 메뉴 이벤트 안에 추가되었는지 확인

---

## 📞 지원

문제가 생기면 개발자 콘솔(`Ctrl+Shift+I`)에서 에러 메시지 확인!
