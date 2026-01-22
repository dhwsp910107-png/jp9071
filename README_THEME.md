# 🎨 Anki Style Theme - 완벽 가이드

## 📋 개요

갤럭시 S25 플러스에 최적화된 Anki 스타일 Obsidian 테마입니다.

### ✨ 주요 기능
- 🌓 **다크/라이트/시스템 모드** 자동 전환
- 📱 **모바일 최적화** (터치 영역, 여백, 폰트)
- 🎯 **Anki 스타일 카드** (퀴즈, 대시보드)
- ⚙️ **Style Settings GUI** 지원
- 🖊️ **S펜 호버 효과** 최적화
- ♿ **접근성** (고대비, 애니메이션 감소)

---

## 🚀 빠른 설치

### 자동 설치 (권장!)
```bash
python setup_anki_theme.py
```

### 수동 설치
1. `.obsidian/snippets/anki-style-theme.css` 확인
2. Obsidian → 설정 → 외형 → CSS 스니펫
3. "anki-style-theme" 활성화
4. Obsidian 재시작

---

## 🎯 기본 설정

### Style Settings에서 설정:

| 항목 | 권장값 | 설명 |
|------|--------|------|
| **색상 모드** | 시스템 모드 | 자동 전환 |
| **글자 크기** | 18px | 모바일 최적 |
| **본문 폰트** | Noto Sans KR | 한글 최적화 |
| **줄 간격** | 1.6-1.8 | 읽기 편함 |
| **퀴즈 카드** | ON | Anki 스타일 |
| **모바일 여백** | 16-18px | 균형잡힌 레이아웃 |
| **버튼 높이** | 44-48px | 터치 편의성 |

---

## 📱 모바일 최적화

### 갤럭시 S25 플러스 설정
```
글자 크기: 18px
줄 간격: 1.8
모바일 여백: 18px
버튼 높이: 48px
```

### 터치 최적화
- 최소 터치 영역: 44x44px
- 탭 하이라이트 제거
- touch-action: manipulation
- S펜 호버 효과 지원

---

## 🎨 테마 모드

### 시스템 모드 (기본)
```css
cssclasses: [anki-auto]
```
갤럭시 다크 모드 설정에 따라 자동 전환

### 라이트 모드 강제
```css
cssclasses: [anki-light]
```
항상 밝은 테마

### 다크 모드 강제
```css
cssclasses: [anki-dark]
```
항상 어두운 테마

---

## 🎯 퀴즈 스타일

### 활성화
```css
cssclasses: [quiz-card-style]
```

### 효과
- ✅ 둥근 모서리 카드
- ✅ 그림자 효과
- ✅ 호버 애니메이션
- ✅ 정답/오답 색상 피드백
- ✅ 부드러운 전환 효과

---

## 🎨 색상 프리셋

### 라이트 모드

#### 클래식 화이트
```
배경: #FFFFFF
텍스트: #2E3440
강조: #5E81AC
```

#### 부드러운 크림
```
배경: #FFF8F0
텍스트: #3E3E3E
강조: #D97706
```

#### 민트 그린
```
배경: #F0FDF4
텍스트: #1E3A20
강조: #10B981
```

### 다크 모드

#### 딥 다크
```
배경: #1E1E1E
텍스트: #D8DEE9
강조: #88C0D0
```

#### 블루 다크
```
배경: #1A1F2E
텍스트: #E0E6F0
강조: #64B5F6
```

#### 따뜻한 다크
```
배경: #2D2416
텍스트: #E8D5C4
강조: #F59E0B
```

---

## 📝 CSS 변수

### 타이포그래피
```css
--font-size-base: 16px
--font-family-text: 'Noto Sans KR', sans-serif
--font-family-mono: 'D2Coding', monospace
--line-height: 1.6
```

### 색상 (라이트)
```css
--light-bg-primary: #FFFFFF
--light-bg-secondary: #F5F5F5
--light-text-normal: #2E3440
--light-accent: #5E81AC
```

### 색상 (다크)
```css
--dark-bg-primary: #1E1E1E
--dark-bg-secondary: #2D2D2D
--dark-text-normal: #D8DEE9
--dark-accent: #88C0D0
```

### 모바일
```css
--mobile-padding: 16px
--button-min-height: 44px
```

### 퀴즈
```css
--quiz-shadow: 0.15
--quiz-border-radius: 12px
--quiz-spacing: 20px
```

---

## 🔧 커스터마이징

### CSS 스니펫 추가
`.obsidian/snippets/my-custom.css`:

```css
body {
  /* 내 설정 */
  --font-size-base: 20px;
  --light-accent: #EF4444;
}

/* 제목만 다른 폰트 */
h1, h2, h3 {
  font-family: 'Noto Serif KR', serif;
}
```

### 노트별 설정
```yaml
---
cssclasses:
  - anki-dark        # 다크 모드
  - quiz-card-style  # 퀴즈 스타일
---
```

---

## 📊 프리셋 모음

### 1. 클래식 Anki
```
모드: 시스템
크기: 16px
폰트: Noto Sans KR
줄간격: 1.6
카드: ON
```

### 2. 모바일 최적화
```
모드: 시스템
크기: 18px
폰트: Pretendard
줄간격: 1.8
여백: 20px
버튼: 48px
```

### 3. 다크 집중
```
모드: 다크
크기: 17px
배경: #1E1E1E
강조: #88C0D0
그림자: 0.3
```

### 4. 라이트 학습
```
모드: 라이트
크기: 19px
배경: #FFFBF0
강조: #F59E0B
줄간격: 2.0
```

---

## 🔍 문제 해결

### Style Settings 안 보임
```
1. 플러그인 재설치
2. Obsidian 재시작
3. CSS 스니펫 새로고침
```

### 테마 적용 안 됨
```
✅ CSS 스니펫 활성화 확인
✅ cssclasses 추가 확인
✅ 캐시 삭제 후 재시작
```

### 글자 너무 작음
```
Style Settings → 기본 글자 크기
→ 18-20px로 증가
```

---

## 📁 파일 구조

```
.obsidian/
├── snippets/
│   └── anki-style-theme.css  (메인 테마)
├── appearance.json            (외형 설정)
└── plugins/
    └── obsidian-style-settings/
        └── data.json          (테마 설정)

가이드 문서/
├── 🎨 테마 설정 가이드.md    (완전 가이드)
├── ⚡ 테마 빠른 시작.md      (3분 시작)
├── 📱 모바일 최적화 가이드.md
├── 🖊️ S펜 활용 가이드.md
└── ⚡ 빠른 설정 가이드.md

스크립트/
├── setup_anki_theme.py        (자동 설정)
└── mobile_optimization_config.json
```

---

## 🎓 학습 경로

### 초급 (3분)
1. [⚡ 테마 빠른 시작.md](⚡%20테마%20빠른%20시작.md)
2. 스니펫 활성화
3. 기본 설정 3가지

### 중급 (15분)
1. [🎨 테마 설정 가이드.md](🎨%20테마%20설정%20가이드.md)
2. 색상 프리셋 적용
3. 폰트/크기 조정

### 고급 (30분+)
1. CSS 변수 이해
2. 커스텀 스니펫 작성
3. 노트별 테마 설정

---

## 🌟 주요 특징

### Style Settings 통합
- ✅ GUI로 모든 설정 가능
- ✅ 실시간 미리보기
- ✅ 프리셋 저장/불러오기
- ✅ 초기화 기능

### 모바일 우선 디자인
- ✅ 터치 영역 최적화
- ✅ S펜 호버 지원
- ✅ 반응형 레이아웃
- ✅ 성능 최적화

### 접근성
- ✅ 고대비 모드 지원
- ✅ 애니메이션 감소 모드
- ✅ 스크린 리더 호환
- ✅ 키보드 네비게이션

---

## 🔗 관련 문서

- [⚡ 테마 빠른 시작.md](⚡%20테마%20빠른%20시작.md) - 3분 시작 가이드
- [🎨 테마 설정 가이드.md](🎨%20테마%20설정%20가이드.md) - 완전 설명서
- [📱 모바일 최적화 가이드.md](📱%20모바일%20최적화%20가이드.md) - 모바일 팁
- [🖊️ S펜 활용 가이드.md](🖊️%20S펜%20활용%20가이드.md) - S펜 연동
- [📚 Quiz 플러그인 사용 가이드.md](📚%20Quiz%20플러그인%20사용%20가이드.md) - 퀴즈 활용

---

## 📞 지원

### 문제 발생 시
1. [🎨 테마 설정 가이드.md](🎨%20테마%20설정%20가이드.md)의 "문제 해결" 섹션
2. CSS 스니펫 비활성화 → 재활성화
3. Obsidian 재시작
4. 설정 초기화 (`setup_anki_theme.py` 재실행)

---

**✨ Anki 스타일로 학습 효율 200% UP! 🚀**

---

## 📜 라이선스

MIT License - 자유롭게 사용 및 수정 가능

---

## 🙏 감사

- Obsidian 커뮤니티
- Style Settings 플러그인
- Anki 디자인 영감
