# ☁️ Google Drive 동기화 가이드

## 개요

이 문서는 Obsidian Vault를 Google Drive와 동기화하여 여러 기기에서 안전하게 사용하는 방법을 설명합니다.

## 🌟 Google Drive 동기화의 장점

- **자동 백업**: 모든 변경사항이 클라우드에 자동으로 저장됩니다
- **다중 기기 지원**: PC, 모바일, 태블릿 등 여러 기기에서 동일한 Vault 사용 가능
- **버전 관리**: Google Drive의 파일 버전 기록 기능 활용
- **대용량 저장**: 15GB 무료 저장 공간 제공
- **빠른 동기화**: 실시간 동기화로 항상 최신 상태 유지

## 📋 사전 준비

1. **Google Drive 계정**: 구글 계정이 필요합니다
2. **Google Drive 데스크톱 앱**: [Google Drive for Desktop](https://www.google.com/drive/download/) 설치
3. **Obsidian 설치**: 각 기기에 Obsidian 설치 필요

## 🚀 설정 방법

### 1. Google Drive 설치 및 로그인

1. Google Drive for Desktop을 다운로드하고 설치합니다
2. 구글 계정으로 로그인합니다
3. 동기화 옵션을 "내 드라이브를 이 컴퓨터에 동기화"로 설정합니다

### 2. Vault를 Google Drive로 이동

**방법 1: 기존 Vault 이동**
1. 기존 Obsidian Vault 폴더를 Google Drive 폴더로 이동합니다
   - 예: `C:\Users\사용자명\Google Drive\내 드라이브\ObsidianVaults\강의체크인`
2. Obsidian에서 "Vault 열기" → 이동한 폴더 선택

**방법 2: 새 Vault 생성**
1. Obsidian에서 "새 Vault 만들기"
2. 위치를 Google Drive 폴더로 지정
   - 예: `C:\Users\사용자명\Google Drive\내 드라이브\ObsidianVaults`

### 3. 플러그인 설정

퀴즈 플러그인의 자동 동기화 기능을 활성화합니다:

1. Obsidian 대시보드 열기 (리본 아이콘 📚 클릭)
2. "☁️ Drive" 버튼 클릭
3. "자동 동기화 ON" 선택

## 💡 사용 팁

### 자동 동기화 활성화

문제를 생성하거나 수정할 때마다 자동으로 Google Drive에 동기화됩니다:

- ✅ **자동 동기화 ON**: 모든 변경사항이 즉시 저장됨
- ⭕ **자동 동기화 OFF**: 수동으로 동기화 버튼을 눌러야 함

### 수동 동기화

필요시 수동으로 동기화할 수 있습니다:

1. 대시보드 → "☁️ Drive" 버튼 클릭
2. "🚀 바로 동기화" 버튼 클릭

### 동기화 상태 확인

현재 동기화 상태를 확인하려면:

1. 대시보드 → "☁️ Drive" 버튼 클릭
2. "📊 Drive 상태" 버튼 클릭

## 📱 모바일 설정

### Android/iOS

1. **Google Drive 앱 설치**
   - Play Store 또는 App Store에서 Google Drive 설치
   - 같은 구글 계정으로 로그인

2. **Obsidian Mobile 설정**
   - Obsidian Mobile 앱 설치
   - "Vault 열기" → "Google Drive에서 선택"
   - 동기화된 Vault 폴더 선택

3. **오프라인 사용 설정** (선택사항)
   - Google Drive 앱에서 Vault 폴더를 오프라인으로 설정
   - 이렇게 하면 인터넷 없이도 사용 가능

## ⚠️ 주의사항

### 동시 편집 방지

여러 기기에서 동시에 같은 파일을 편집하면 충돌이 발생할 수 있습니다:

- 한 기기에서 작업을 완료한 후 다른 기기에서 열기
- 동기화가 완료될 때까지 잠시 대기
- Google Drive의 충돌 파일(conflict) 주기적으로 확인

### 백업 권장사항

안전을 위해 추가 백업을 권장합니다:

1. **로컬 백업**: 중요한 파일은 외장 하드에 정기적으로 복사
2. **Export 기능**: 정기적으로 전체 Vault를 ZIP으로 내보내기
3. **Google Drive 버전 기록**: 파일 우클릭 → "버전 관리" 활용

### 용량 관리

Google Drive 무료 플랜은 15GB까지 제공됩니다:

- 정기적으로 불필요한 첨부파일 삭제
- 큰 이미지 파일은 압축하여 사용
- `.trash` 폴더 정기적으로 비우기

## 🔧 문제 해결

### 동기화가 안 될 때

1. **인터넷 연결 확인**: Wi-Fi 또는 데이터 연결 확인
2. **Google Drive 재시작**: Google Drive for Desktop 종료 후 재시작
3. **Obsidian 재시작**: Obsidian 앱 재시작
4. **수동 동기화**: 파일 탐색기에서 파일을 수동으로 새로고침

### 충돌 파일이 생겼을 때

충돌 파일은 다음과 같은 이름으로 생성됩니다:
- `파일명 (1).md`
- `파일명 - 충돌 사본.md`

**해결 방법:**
1. 충돌 파일과 원본 파일을 비교
2. 필요한 내용을 원본에 병합
3. 충돌 파일 삭제

### 동기화 속도가 느릴 때

1. **선택적 동기화**: Google Drive 설정에서 필요한 폴더만 동기화
2. **대역폭 설정**: Google Drive 설정 → 대역폭 제한 조정
3. **파일 크기 확인**: 큰 파일이 있는지 확인하고 압축

## 📚 추가 리소스

- [Google Drive 도움말 센터](https://support.google.com/drive)
- [Obsidian 공식 문서](https://help.obsidian.md)
- [Obsidian 포럼 - Sync 토픽](https://forum.obsidian.md/c/sync/9)

## ✅ 체크리스트

설정이 완료되었는지 확인하세요:

- [ ] Google Drive for Desktop 설치 완료
- [ ] Vault가 Google Drive 폴더에 위치
- [ ] 플러그인에서 자동 동기화 활성화
- [ ] 모바일 기기에서도 Vault 접근 가능
- [ ] 백업 계획 수립 완료

---

**마지막 업데이트**: 2026년 1월
**작성자**: HanziQuiz Plugin
