# 📘 Obsidian Git 사용 가이드 (한글)

## 🎯 Git 플러그인이란?
Obsidian Git 플러그인은 Vault의 모든 노트를 자동으로 GitHub에 백업하고 버전 관리를 해주는 플러그인입니다.

---

## ✅ 초기 설정 완료!

**이미 설정이 완료되었습니다!**
- ✅ GitHub 저장소: https://github.com/dhwsp910107-png/jp9071
- ✅ 원격 저장소 연결 완료
- ✅ 첫 푸시 완료 (18,935개 파일 업로드)
- ✅ 자동 백업 활성화 (10분마다)

---

## 💻 PC에서 Git 사용법

### 🔄 자동 백업 (권장)
**이미 설정되어 있습니다!** 아무것도 안 해도 **10분마다 자동으로 GitHub에 백업**됩니다.

#### 설정 확인/변경 방법:
1. `Ctrl + ,` (설정 열기)
2. 좌측 **Community plugins** → **Obsidian Git** 클릭
3. 주요 설정:

| 설정 항목 (영문) | 한글 설명 | 현재 값 |
|----------|------|---------|
| **Vault backup interval (minutes)** | 자동 백업 주기 (0=비활성화) | `10분` |
| **Commit message on auto backup** | 자동 백업 커밋 메시지 | `📝 자동 백업: {{date}}` |
| **Pull updates on startup** | Obsidian 시작 시 자동으로 최신 버전 가져오기 | ✅ 켜짐 |
| **Auto pull interval (minutes)** | 자동으로 최신 버전 확인 주기 | `10분` |
| **Disable push** | 푸시 비활성화 (백업 안 함) | ❌ 꺼짐 (백업함) |
| **Pull before push** | 푸시 전에 최신 버전 확인 | ✅ 켜짐 (충돌 방지) |
| **Disable notifications** | 알림 끄기 | ❌ 꺼짐 (알림 보임) |
| **Show status bar** | 하단 상태 표시줄 보이기 | ✅ 켜짐 |

#### 상태 표시줄 아이콘 의미:
- **🟢 초록색 체크**: 모든 변경사항 백업 완료
- **🟡 노란색 숫자**: 백업 대기 중인 파일 수
- **🔄 회전 화살표**: 현재 백업 중
- **🔴 빨간색 X**: 오류 발생 (클릭하여 상세 내용 확인)

### 📝 수동 백업
자동 백업 외에 **즉시 백업**하고 싶을 때:

#### 방법 1: 명령어 팔레트 (추천)
1. `Ctrl + P` 눌러서 명령어 팔레트 열기
2. 다음 중 하나 입력:
   - `Obsidian Git: Commit all changes` → 변경사항 저장
   - `Obsidian Git: Push` → GitHub에 업로드
   - `Obsidian Git: Commit and push` → 저장하고 바로 업로드 ⭐

#### 방법 2: 사이드바 아이콘
1. 좌측 사이드바에서 Git 아이콘 (분기 모양) 클릭
2. 변경된 파일 목록 확인
3. 우측 상단 체크 버튼 클릭 → 커밋 메시지 입력 → 푸시

#### 방법 3: 단축키 설정 (선택사항)
1. 설정 (`Ctrl + ,`) → **Hotkeys** 검색
2. `Obsidian Git: Commit and push` 검색
3. 단축키 설정 (예: `Ctrl + Shift + G`)

### 🔍 변경 이력 확인
1. `Ctrl + P` → `Obsidian Git: Open file history of current file`
2. 현재 파일의 과거 버전 확인 가능
3. GitHub 웹사이트에서도 확인 가능: https://github.com/dhwsp910107-png/jp9071/commits/main

---

## 📱 안드로이드 모바일에서 Git 사용법

### ⚠️ 중요 공지
Obsidian Git 플러그인은 **안드로이드에서 기본적으로 작동하지 않습니다.**
모바일에서는 **별도 앱**을 사용해야 합니다.

### 🔧 방법 1: Termux + Git (고급 사용자용)

#### 1단계: Termux 설치
1. Google Play Store에서 **Termux** 설치
2. F-Droid에서 설치 권장 (Play Store 버전은 오래됨)

#### 2단계: Git 설치 및 설정
Termux 실행 후 다음 명령어 입력:
```bash
# 패키지 업데이트
pkg update && pkg upgrade -y

# Git 설치
pkg install git -y

# 사용자 정보 설정
git config --global user.name "본인이름"
git config --global user.email "본인이메일@example.com"

# 저장소 클론
cd /storage/emulated/0
git clone https://ghp_토큰@github.com/dhwsp910107-png/jp9071.git ObsidianVault

# Obsidian에서 이 폴더를 Vault로 열기
```

#### 3단계: 수동 백업
파일 수정 후 Termux에서:
```bash
cd /storage/emulated/0/ObsidianVault
git add .
git commit -m "모바일 백업"
git push
```

#### 4단계: 최신 버전 가져오기
```bash
cd /storage/emulated/0/ObsidianVault
git pull
```

### 🌐 방법 2: GitHub 웹사이트 사용 (간단)
1. 모바일 브라우저에서 https://github.com/dhwsp910107-png/jp9071 접속
2. 파일 확인 및 다운로드
3. **단점**: 업로드는 파일 하나씩만 가능

### ☁️ 방법 3: Obsidian Sync (유료, 가장 편함)
- Obsidian 공식 클라우드 동기화 서비스
- 월 $10 (연간 $96)
- Git 없이 자동 동기화
- 설정: Settings → Sync → Set up

### 📦 방법 4: 타사 클라우드 동기화
- **Google Drive, Dropbox, OneDrive** 등 사용
- Vault 폴더를 클라우드 폴더로 설정
- **주의**: `.git` 폴더는 제외해야 충돌 방지

---

## 🆘 자주 묻는 질문 (FAQ)

### Q1. 자동 백업이 안 돼요!
**확인 사항:**
1. 플러그인이 활성화되어 있나요? (Settings → Community plugins → Obsidian Git 켜짐)
2. Vault backup interval이 0이 아닌가요? (10 권장)
3. 하단 상태 표시줄에 오류 메시지가 있나요?
4. Personal Access Token이 만료되지 않았나요?

### Q2. "Permission denied" 오류가 나요
**해결 방법:**
1. Personal Access Token 재생성 (repo 권한 포함)
2. 원격 저장소 URL에 토큰 포함:
   ```bash
   git remote set-url origin https://ghp_토큰@github.com/dhwsp910107-png/jp9071.git
   ```

### Q3. 여러 기기에서 사용하려면?
**PC, 노트북, 태블릿 등에서 동시 사용:**
1. 각 기기에서 저장소 클론
2. 작업 시작 전: `Obsidian Git: Pull` (최신 버전 가져오기)
3. 작업 종료 후: `Obsidian Git: Commit and push` (백업)
4. **충돌 방지**: 동시에 같은 파일 수정하지 않기

### Q4. 모바일에서 왜 안 돼요?
안드로이드/iOS의 파일 시스템 제약 때문에 Git 명령어가 작동하지 않습니다.
→ Termux (안드로이드) 또는 Obsidian Sync 사용 권장

### Q5. 백업 용량 제한이 있나요?
- GitHub 무료 계정: **저장소당 1GB 권장** (공식 제한은 없지만 권장 사항)
- 현재 Vault 크기: 약 1.3GB (괜찮음)
- 파일 하나당 최대 100MB
- 이미지, 동영상 많으면 Git LFS 사용 고려

---

## 🎯 추천 워크플로우

### 📅 일상 사용
1. **아침**: Obsidian 열기 → 자동으로 최신 버전 가져오기 (Pull on startup)
2. **학습/작업**: 자유롭게 노트 작성
3. **자동 백업**: 10분마다 자동으로 GitHub에 저장
4. **저녁**: 특별히 할 일 없음 (자동으로 백업됨)

### 🚀 중요 작업 전
1. `Ctrl + P` → `Obsidian Git: Pull` (최신 버전 확인)
2. 작업 진행
3. `Ctrl + P` → `Obsidian Git: Commit and push` (즉시 백업)

### 🔄 여러 기기 사용 시
**기기 A (집 PC):**
- 작업 종료 시: 자동 백업 대기 또는 수동 푸시

**기기 B (학교 노트북):**
- 작업 시작 전: `Ctrl + P` → `Git: Pull` (최신 버전 가져오기)
- 작업 종료 시: 자동 백업 또는 수동 푸시

---

## 🔧 고급 설정

### 커밋 메시지 커스터마이징
`{{date}}` 외에 사용 가능한 변수:
- `{{hostname}}`: 컴퓨터 이름
- `{{numFiles}}`: 변경된 파일 수
- `{{files}}`: 변경된 파일 목록

예시: `📝 {{hostname}}에서 {{numFiles}}개 파일 백업 ({{date}})`

### 특정 폴더/파일 제외하기
`.gitignore` 파일에 추가:
```
# 백업하지 않을 폴더
.obsidian/workspace.json
.trash/

# 백업하지 않을 파일 패턴
*.tmp
*-temp.md
```

### Git 브랜치 사용
여러 버전 관리:
```bash
# 새 브랜치 생성
git checkout -b 실험버전

# 브랜치 전환
git checkout main
```

---

## 📋 주요 명령어 (Ctrl+P로 실행)

### 🔄 기본 명령어

| 명령어 | 한글 설명 | 사용 시기 |
|--------|----------|----------|
| **Git: Commit all changes** | 모든 변경사항 저장 | 작업 후 수동 저장 시 |
| **Git: Push** | GitHub에 업로드 | 저장 후 업로드 |
| **Git: Pull** | GitHub에서 다운로드 | 다른 기기에서 작업한 내용 가져오기 |
| **Git: Backup** | 자동 백업 (커밋+푸시) | ⭐ 가장 많이 사용 |
| **Git: Open source control view** | 변경된 파일 확인 | 무엇이 바뀌었는지 확인할 때 |

### 🔧 고급 명령어

| 명령어 | 한글 설명 |
|--------|----------|
| **Git: Clone an existing remote repo** | 다른 컴퓨터에서 노트 복사 |
| **Git: List changed files** | 변경된 파일 목록 보기 |
| **Git: Stage all** | 모든 변경사항 준비 |
| **Git: Unstage all** | 준비 취소 |

---

## 💡 빠른 사용법 (3단계)

---

## 🎓 빠른 시작 가이드 (처음 사용자용)

### ✅ 이미 완료된 것
1. ✅ GitHub 저장소 생성 (jp9071)
2. ✅ 원격 저장소 연결
3. ✅ 첫 푸시 완료 (18,935개 파일)
4. ✅ 자동 백업 설정 (10분마다)

### 🚀 지금 바로 사용하기

**PC에서:**
- **자동**: 아무것도 안 해도 10분마다 자동 백업됨 ✨
- **수동**: `Ctrl + P` → `Obsidian Git: Commit and push` 입력

**모바일에서:**
- 안드로이드는 Termux 앱 사용 (아래 상세 가이드 참고)
- 또는 Obsidian Sync (유료) 사용 권장

---

## 💻 PC 완전 설정 가이드

### 📋 주요 명령어 (Ctrl+P로 실행)

| 명령어 | 한글 설명 | 사용 시기 |
|--------|----------|----------|
| **Obsidian Git: Commit and push** | 저장하고 바로 업로드 | ⭐ 가장 많이 사용 |
| **Obsidian Git: Pull** | GitHub에서 최신 버전 가져오기 | 다른 기기에서 작업했을 때 |
| **Obsidian Git: Commit all changes** | 변경사항만 저장 (업로드 안 함) | 임시 저장 시 |
| **Obsidian Git: Push** | 저장된 내용 업로드 | 커밋 후 푸시할 때 |
| **Obsidian Git: Open source control view** | 변경된 파일 확인 | 무엇이 바뀌었는지 볼 때 |
| **Obsidian Git: Open file history** | 파일 수정 이력 보기 | 이전 버전으로 되돌릴 때 |

### ⚙️ 상세 설정

#### 설정 열기
1. `Ctrl + ,` (설정)
2. 좌측 **Community plugins**
3. **Obsidian Git** 클릭

#### 자동 백업 설정

| 설정 항목 (영문) | 한글 설명 | 추천 값 | 현재 값 |
|----------|------|---------|---------|
| **Vault backup interval (minutes)** | 자동 백업 주기 (0=비활성화) | `10` | ✅ `10` |
| **Commit message on auto backup** | 자동 백업 커밋 메시지 | 자유 | ✅ `📝 자동 백업: {{date}}` |
| **Auto pull interval (minutes)** | 자동으로 최신 버전 확인 주기 | `10` | ✅ `10` |
| **Pull updates on startup** | Obsidian 시작 시 자동 가져오기 | ✅ | ✅ 켜짐 |

#### 푸시 설정

| 설정 항목 | 한글 설명 | 추천 값 | 현재 값 |
|----------|------|---------|---------|
| **Disable push** | 푸시 비활성화 (백업 안 함) | ❌ | ✅ 꺼짐 |
| **Pull before push** | 푸시 전에 최신 버전 확인 | ✅ | ✅ 켜짐 |
| **Disable notifications** | 알림 끄기 | ❌ | ✅ 꺼짐 |
| **Show status bar** | 하단 상태 표시줄 보이기 | ✅ | ✅ 켜짐 |

#### 커밋 메시지 커스터마이징
사용 가능한 변수:
- `{{date}}`: 현재 날짜/시간
- `{{hostname}}`: 컴퓨터 이름
- `{{numFiles}}`: 변경된 파일 수
- `{{files}}`: 변경된 파일 목록

예시:
- `📝 {{hostname}}에서 {{numFiles}}개 파일 백업 ({{date}})`
- `🎯 학습 노트 업데이트 - {{date}}`
- `✏️ {{numFiles}}개 문제 추가/수정`

### 📊 상태 표시줄 아이콘 의미

Obsidian 하단 우측에 표시:

| 아이콘 | 의미 |
|--------|------|
| **🟢 체크 표시** | 모든 변경사항 백업 완료 |
| **🟡 숫자 (예: 5)** | 백업 대기 중인 파일 5개 |
| **🔄 회전 화살표** | 현재 백업 진행 중 |
| **🔴 X 표시** | 오류 발생 (클릭하여 상세 확인) |
| **↓ 화살표** | Pull 가능 (다른 기기에서 업데이트됨) |

클릭하면 상세 정보 확인 가능!

### ⌨️ 단축키 설정 (선택사항)

자주 사용하는 명령어에 단축키 지정:

1. 설정 (`Ctrl + ,`) → **Hotkeys** 검색
2. 다음 명령어 검색 후 단축키 지정:
   - `Obsidian Git: Commit and push` → 예: `Ctrl + Shift + G`
   - `Obsidian Git: Pull` → 예: `Ctrl + Shift + L`
   - `Obsidian Git: Open source control view` → 예: `Ctrl + Shift + S`

---

## 📱 안드로이드 모바일 완전 가이드

### ⚠️ 중요 공지
**Obsidian Git 플러그인은 안드로이드에서 작동하지 않습니다.**
- 이유: 안드로이드는 Git 명령어를 직접 실행할 수 없음
- 해결: 별도 앱 또는 서비스 사용 필요

### 🌟 추천 방법 (난이도 순)

#### 1️⃣ 방법 1: MGit (가장 추천! 무료, 쉬움) ⭐

**MGit은 안드로이드용 Git 클라이언트로 GUI가 있어서 Termux보다 훨씬 쉽습니다!**

**장점:**
- ✅ **완전 무료**
- ✅ GUI 버튼으로 간단 조작
- ✅ Git 버전 관리 유지
- ✅ PC와 동일한 백업 시스템
- ✅ 설정 10분 완료

**단점:**
- ❌ 완전 자동은 아님 (버튼 클릭 필요, 5초면 끝)

---

##### 📲 MGit 설치 및 설정 (단계별)

**1단계: MGit 설치**

두 가지 방법 중 선택:

**방법 A: Google Play Store (쉬움)**
1. Play Store 열기
2. **"MGit"** 검색
3. **"MGit - Git client for Android"** 설치
4. 앱 실행

**방법 B: F-Droid (권장)**
1. 브라우저에서 https://f-droid.org 접속
2. F-Droid 앱 설치
3. F-Droid에서 **MGit** 검색하여 설치

---

**2단계: 저장소 클론 (처음 한 번만)**

MGit 앱 실행 후:

1. **오른쪽 하단 ➕ (더하기) 버튼** 클릭

2. **Clone Repository** 선택

3. 저장소 정보 입력:

   | 항목 | 입력 값 |
   |------|---------|
   | **Remote URL** | `https://github.com/dhwsp910107-png/jp9071.git` |
   | **Username** | `dhwsp910107-png` |
   | **Password** | (Personal Access Token 입력) |
   | **Local Path** | `/storage/emulated/0/ObsidianVault` |
   | **Repository name** | `강의체크인` |

   ⚠️ **Password에는 GitHub 비밀번호가 아닌 Personal Access Token을 입력하세요!**
   - 토큰이 없다면: https://github.com/settings/tokens 에서 생성
   - 권한: **repo** 체크
   - 토큰은 `ghp_`로 시작

4. **Clone** 버튼 클릭

5. 진행 상황 표시됨 (18,935개 파일, 약 5-10분 소요)

6. 완료되면 저장소 목록에 **강의체크인** 표시됨

---

**3단계: Obsidian에서 열기**

1. **Obsidian 앱** 실행 (없으면 Play Store에서 설치)

2. **Open folder as vault** 클릭

3. 왼쪽 메뉴 (☰) → **내부 저장소** 선택

4. **ObsidianVault** 폴더 선택

5. **Use this folder** 클릭

6. **Trust author and enable plugins** 선택
   - quiz-sp2 플러그인이 자동으로 활성화됨

7. 완료! 🎉 이제 PC와 동일한 Vault가 모바일에서 열립니다.

---

**4단계: 동기화 방법 (매일 사용)**

MGit은 **Pull**(다운로드)과 **Push**(업로드)를 수동으로 해야 합니다.

##### 📥 작업 전: Pull (최신 버전 가져오기)

PC나 다른 기기에서 작업했다면 먼저 Pull 해야 합니다!

1. **MGit 앱** 실행
2. **강의체크인** 저장소 탭 또는 클릭
3. 우측 상단 **세로 점 3개** (⋮) 메뉴 클릭
4. **Pull** 선택
5. **Remote:** `origin` 선택
6. **Branch:** `main` 선택
7. **OK** 클릭
8. 진행 표시줄 확인
9. "Pull successful" 메시지 확인 ✅

##### ✏️ 작업: Obsidian에서 노트 작성

평소처럼 Obsidian에서 노트 작성, 문제 풀기 등

##### 📤 작업 후: Commit & Push (백업)

1. **MGit 앱** 실행
2. **강의체크인** 저장소 선택
3. **Status** 탭 확인 (변경된 파일 목록 표시)

4. **Commit 하기:**
   - 우측 상단 **✓ (체크)** 버튼 클릭
   - 또는 메뉴 (⋮) → **Commit**
   - 커밋 메시지 입력 (예: `📱 모바일 백업`)
   - **Stage all** 클릭 (모든 변경사항 선택)
   - **Commit** 버튼 클릭

5. **Push 하기:**
   - 우측 상단 **↑ (화살표)** 버튼 클릭
   - 또는 메뉴 (⋮) → **Push**
   - **Remote:** `origin` 선택
   - **Branch:** `main` 선택
   - **OK** 클릭
   - Personal Access Token 입력 (처음에만)
   - "Push successful" 확인 ✅

**완료!** 이제 PC에서도 모바일 작업 내용을 확인할 수 있습니다.

---

##### 🔄 일상 워크플로우 (MGit)

**아침 (작업 시작 전):**
```
1. MGit 열기
2. Pull (↓) → 최신 버전 가져오기
3. Obsidian에서 작업
```

**저녁 (작업 종료 후):**
```
1. MGit 열기
2. Commit (✓) → 메시지 입력 → Stage all → Commit
3. Push (↑) → GitHub에 백업
```

**소요 시간:** 각 5초씩, 총 10초!

---

##### 🎯 MGit 팁 & 트릭

**1. 빠른 Commit & Push:**
- 메뉴 (⋮) → **Commit and push** 선택
- 커밋과 푸시를 한 번에!

**2. 변경 사항 확인:**
- **Status** 탭에서 어떤 파일이 변경되었는지 확인
- 파일 클릭하면 변경 내용(Diff) 확인 가능

**3. 히스토리 확인:**
- **Commits** 탭에서 과거 커밋 기록 확인
- 언제, 무엇을 백업했는지 확인 가능

**4. 충돌 해결:**
- Pull 시 충돌 발생하면 MGit이 알려줌
- **Merge** 또는 **Rebase** 선택
- 충돌 파일 수동 편집 후 다시 커밋

**5. 알림 설정:**
- MGit 설정 → **Notifications** 켜기
- Pull/Push 성공/실패 알림 받기

---

##### 📱 MGit 인터페이스 설명

**메인 화면:**
- **Repositories**: 저장소 목록
- **강의체크인**: 현재 저장소
- **Status**: 변경된 파일 (빨강 = 수정됨, 초록 = 새 파일)
- **Commits**: 커밋 기록
- **Files**: 파일 브라우저

**상단 버튼:**
- **↓** = Pull (다운로드)
- **↑** = Push (업로드)
- **✓** = Commit (저장)
- **⋮** = 메뉴 (더 많은 옵션)

**하단 탭:**
- **Status**: 변경사항 확인
- **Commits**: 히스토리
- **Files**: 파일 탐색
- **Settings**: 저장소 설정

---

#### 2️⃣ 방법 2: Termux + Git (무료, 고급)
**장점:**
- ✅ 완전 무료
- ✅ GitHub와 동일한 백업

**단점:**
- ❌ 초기 설정 복잡
- ❌ 수동 명령어 입력 필요

**상세 설정 방법:**

##### 1단계: Termux 설치
1. **F-Droid** 앱스토어 설치 (https://f-droid.org)
2. F-Droid에서 **Termux** 검색하여 설치
   - ⚠️ Google Play Store 버전은 사용하지 마세요 (오래됨)

##### 2단계: 저장소 권한 설정
Termux 실행 후:
```bash
# 저장소 접근 권한 허용
termux-setup-storage
```
→ 팝업 나오면 **허용** 클릭

##### 3단계: Git 설치 및 설정
```bash
# 패키지 목록 업데이트
pkg update && pkg upgrade -y

# Git 설치
pkg install git -y

# 사용자 정보 설정 (GitHub 계정 정보)
git config --global user.name "본인이름"
git config --global user.email "dhwsp910107-png@github.com"
```

##### 4단계: 저장소 클론
```bash
# Obsidian이 접근 가능한 폴더로 이동
cd /storage/emulated/0

# GitHub 저장소 복사 (토큰은 GitHub Settings → Tokens에서 생성한 것 사용)
git clone https://YOUR_GITHUB_TOKEN@github.com/dhwsp910107-png/jp9071.git 강의체크인
```

**YOUR_GITHUB_TOKEN 부분을 실제 토큰으로 교체하세요!**
- 토큰 생성: https://github.com/settings/tokens
- 권한: **repo** 체크
- 토큰은 `ghp_`로 시작합니다

##### 5단계: Obsidian에서 열기
1. Obsidian 앱 실행
2. **Open folder as vault** 클릭
3. `/storage/emulated/0/강의체크인` 폴더 선택
4. **Trust author and enable plugins** 클릭

##### 6단계: 백업 명령어 (매번 사용)

**파일 수정 후 GitHub에 업로드:**
```bash
cd /storage/emulated/0/강의체크인
git add .
git commit -m "📱 모바일 백업"
git push
```

**다른 기기에서 작업한 내용 가져오기:**
```bash
cd /storage/emulated/0/강의체크인
git pull
```

##### 7단계: Termux Widget으로 자동화 (선택)
1. F-Droid에서 **Termux:Widget** 설치
2. `~/.shortcuts` 폴더 생성
3. 백업 스크립트 만들기:
```bash
mkdir -p ~/.shortcuts
cat > ~/.shortcuts/obsidian-backup.sh << 'EOF'
#!/bin/bash
cd /storage/emulated/0/강의체크인
git add .
git commit -m "📱 모바일 백업 $(date '+%Y-%m-%d %H:%M')"
git push
EOF
chmod +x ~/.shortcuts/obsidian-backup.sh
```
4. 홈 화면에 위젯 추가 → Termux → 백업 버튼 클릭으로 간편 백업!

#### 3️⃣ 방법 3: Obsidian Sync (자동, 유료)
**장점:**
- ✅ 완전 자동 동기화
- ✅ 설정 1분 완료
- ✅ Git 없이 작동
- ✅ 모든 기기 동기화

**단점:**
- ❌ 월 $10 / 연 $96 유료

**설정 방법:**
1. Obsidian 설정 → **Sync** → **Set up**
2. Obsidian 계정 생성/로그인
3. 구독 결제
4. 자동으로 동기화 시작 ✨

#### 4️⃣ 방법 4: Working Copy (iOS 전용, 무료/유료)
**iOS 사용자 전용:**
1. App Store에서 **Working Copy** 다운로드
2. 저장소 클론
3. Files 앱과 연동
4. Obsidian에서 열기

#### 5️⃣ 방법 5: 클라우드 동기화 (Google Drive 등, 간단)
**장점:**
- ✅ 간단
- ✅ 자동 동기화

**단점:**
- ❌ Git 버전 관리 없음
- ❌ 충돌 발생 가능

**설정:**
1. Google Drive 앱 설치
2. Vault 폴더를 Google Drive로 이동
3. 모든 기기에서 Google Drive로 접근
4. ⚠️ `.git` 폴더는 제외 필요 (`.gitignore` 설정)

---

## 🆘 문제 해결 가이드

### 🔴 자동 백업이 안 돼요!

**체크리스트:**
- [ ] 플러그인이 켜져 있나요?
  - 설정 → Community plugins → Obsidian Git (켜짐 확인)
- [ ] Vault backup interval이 0이 아닌가요?
  - 설정 → Obsidian Git → Vault backup interval: `10` 확인
- [ ] 하단 상태 표시줄에 오류가 있나요?
  - 🔴 아이콘 클릭하여 오류 메시지 확인
- [ ] Git 원격 저장소가 연결되어 있나요?
  - PowerShell: `git remote -v` 실행하여 확인

### 🔴 "Permission denied" 또는 "403" 오류

**원인:** Personal Access Token 만료 또는 권한 부족

**해결:**
1. 새 토큰 생성:
   - https://github.com/settings/tokens
   - Generate new token (classic)
   - **repo** 권한 전체 선택
   - 토큰 복사
2. 원격 저장소 URL 업데이트:
```powershell
git remote set-url origin https://새토큰@github.com/dhwsp910107-png/jp9071.git
```

### 🔴 "Repository not found" 오류

**원인:** 저장소 URL이 잘못되었거나 Private 저장소 접근 권한 없음

**해결:**
1. 저장소 존재 확인: https://github.com/dhwsp910107-png/jp9071
2. URL 확인:
```powershell
git remote -v
```
3. 올바른 URL로 변경:
```powershell
git remote set-url origin https://토큰@github.com/dhwsp910107-png/jp9071.git
```

### 🔴 충돌 (Conflict) 발생

**원인:** 여러 기기에서 같은 파일을 동시에 수정

**해결:**
1. `Ctrl + P` → `Git: Open source control view`
2. 충돌 파일 확인 (느낌표 표시)
3. 파일 열어서 수동 병합:
```markdown
<<<<<<< HEAD
내 버전 내용
=======
다른 기기 버전 내용
>>>>>>> origin/main
```
4. 원하는 버전 선택 후 충돌 마커 삭제
5. 저장 후 커밋

### 🔴 ".git 폴더를 찾을 수 없습니다"

**원인:** Vault가 Git 저장소로 초기화되지 않음

**해결:**
PowerShell에서:
```powershell
cd C:\ObsidianVaults\강의체크인
git init
git remote add origin https://토큰@github.com/dhwsp910107-png/jp9071.git
git pull origin main
```

### 🔴 모바일에서 "Git command failed"

**정상입니다!** 안드로이드/iOS는 Git 명령어를 지원하지 않습니다.
→ Termux 또는 Obsidian Sync 사용

---

## 📚 Git 용어 한글 설명

| Git 용어 | 한글 의미 | 설명 |
|----------|----------|------|
| **Repository (Repo)** | 저장소 | 파일들이 저장되는 곳 (GitHub의 프로젝트) |
| **Commit** | 저장, 기록 | 변경사항을 저장하는 것 (사진 찍듯이) |
| **Push** | 업로드 | 로컬 변경사항을 GitHub에 올리기 |
| **Pull** | 다운로드 | GitHub의 최신 버전을 로컬로 가져오기 |
| **Clone** | 복사 | 원격 저장소를 내 컴퓨터로 복사 |
| **Branch** | 가지 | 별도 작업 공간 (실험용, 버전별 등) |
| **Merge** | 병합 | 두 버전을 합치기 |
| **Conflict** | 충돌 | 같은 부분을 다르게 수정해서 발생하는 문제 |
| **Remote** | 원격 저장소 | GitHub 같은 온라인 저장소 |
| **Local** | 로컬 저장소 | 내 컴퓨터의 저장소 |
| **Staging** | 준비 영역 | 커밋할 파일을 선택하는 단계 |
| **Diff** | 차이점 | 변경된 내용 비교 |

---

## 🎯 요약: 하루 일과

### 🌅 아침 (Obsidian 시작)
1. Obsidian 열기
2. 자동으로 최신 버전 가져오기 (Pull on startup)
3. 하단 상태 표시줄 확인 (🟢 = 정상)

### ☀️ 낮 (작업 중)
1. 자유롭게 노트 작성
2. **아무것도 안 해도 10분마다 자동 백업** ✨
3. 중요 작업 후 즉시 백업: `Ctrl + P` → `Obsidian Git: Commit and push`

### 🌙 저녁 (Obsidian 종료)
1. 그냥 닫으면 됨 (자동 백업됨)
2. 필요하면 수동 백업: `Ctrl + P` → `Obsidian Git: Commit and push`

### 📱 모바일 (안드로이드)
1. Termux 열기
2. `cd /storage/emulated/0/강의체크인 && git pull` (최신 버전 가져오기)
3. Obsidian에서 작업
4. `cd /storage/emulated/0/강의체크인 && git add . && git commit -m "📱" && git push` (백업)

---

## 📞 추가 도움이 필요하면

- **GitHub 문서:** https://docs.github.com/ko
- **Obsidian Forum:** https://forum.obsidian.md
- **Obsidian Git 플러그인 문서:** https://github.com/denolehov/obsidian-git

---

**✅ 모든 설정이 완료되었습니다!**
이제 안심하고 학습하세요. 모든 노트가 자동으로 GitHub에 백업됩니다! 🎉

### 단계 3: 확인
오른쪽 하단에 **"Pushed"** 메시지 확인 ✅

---

## 🎨 상태 표시줄 설명

Obsidian 하단 오른쪽에 표시되는 아이콘:

| 아이콘 | 의미 |
|--------|------|
| **✅ Pushed** | GitHub에 업로드 완료 |
| **🔄 Syncing...** | 동기화 중 |
| **❌ Error** | 오류 발생 (설정 확인 필요) |
| **📝 3 changes** | 3개 파일 변경됨 (아직 업로드 안 함) |

---

## 🔥 자주 묻는 질문 (FAQ)

### Q1. 자동 백업이 안 돼요
**A.** 설정에서 다음 확인:
- `Vault backup interval` 값이 `0`이 아닌지
- `Push on backup` 체크되어 있는지
- 인터넷 연결 확인

### Q2. "Authentication failed" 오류가 나요
**A.** GitHub Personal Access Token 설정 필요:
1. GitHub → Settings → Developer settings → Personal access tokens
2. Generate new token (classic)
3. `repo` 권한 체크
4. 토큰 복사
5. Obsidian Git 설정 → `Password/Personal Access token` 에 붙여넣기

### Q3. 다른 컴퓨터에서도 사용하고 싶어요
**A.** 새 컴퓨터에서:
1. Obsidian 설치
2. `Ctrl + P` → `Git: Clone an existing remote repo`
3. GitHub 저장소 URL 입력
4. Vault 위치 선택

### Q4. 파일이 너무 많아서 느려요
**A.** `.gitignore` 파일에 제외할 폴더 추가:
```
.obsidian/workspace.json
.trash/
```

### Q5. 실수로 삭제한 파일 복구하려면?
**A.** GitHub 웹사이트에서:
1. 저장소 → Commits 탭
2. 삭제 전 커밋 찾기
3. 파일 내용 복사 → Obsidian에 붙여넣기

---

## 🎯 추천 워크플로우

### 📱 모바일 + PC 동시 사용 시

#### PC에서 작업 후:
```
1. Ctrl + P
2. "Git: Backup" 입력
3. Enter
```

#### 모바일에서 작업 전:
```
1. Pull (GitHub에서 최신 내용 가져오기)
2. 작업
3. Backup (GitHub에 업로드)
```

### 🔄 자동화 설정 (권장)
- `Vault backup interval`: **5분** (작업 내용 자주 저장)
- `Auto pull interval`: **5분** (다른 기기 변경사항 자동 반영)
- `Pull updates on startup`: **✅** (Obsidian 시작 시 최신 상태 유지)

---

## ⚙️ 고급 설정 (선택사항)

### Commit Author 설정
```powershell
git config user.name "내 이름"
git config user.email "이메일@example.com"
```

### 특정 파일 제외하기
`.gitignore` 파일 편집:
```
# 임시 파일
*.tmp
.trash/

# 개인 설정
.obsidian/workspace.json
.obsidian/workspace-mobile.json

# 대용량 파일
*.mp4
*.avi
```

---

## 🆘 문제 해결

### 오류: "fatal: refusing to merge unrelated histories"
```powershell
git pull origin main --allow-unrelated-histories
git push origin main
```

### 오류: "Your local changes would be overwritten"
```powershell
# 방법 1: 로컬 변경사항 저장하고 병합
git stash
git pull
git stash pop

# 방법 2: 로컬 변경사항 버리고 GitHub 내용으로 덮어쓰기
git reset --hard origin/main
```

### 오류: "Permission denied"
GitHub Personal Access Token 재발급 후 다시 입력

---

## 📚 유용한 팁

### 1. 커밋 메시지 자동 생성
설정 → `Commit message on manual backup`:
```
📝 수동 백업: {{date}} {{time}}
```

### 2. 변경된 파일 개수 보기
상태 표시줄에 자동으로 표시됨 (예: `3 changes`)

### 3. 백업 전 확인
`Ctrl + P` → `Git: List changed files` → 무엇이 바뀌었는지 확인

---

## 🎓 Git 용어 설명 (초보자용)

| Git 용어 | 한글 의미 | 쉬운 설명 |
|----------|----------|----------|
| **Commit** | 저장 | 변경사항을 기록에 남김 (스냅샷) |
| **Push** | 업로드 | 로컬 변경사항을 GitHub에 올림 |
| **Pull** | 다운로드 | GitHub의 최신 내용을 가져옴 |
| **Backup** | 백업 | Commit + Push를 한 번에 |
| **Repository** | 저장소 | 노트가 저장되는 공간 |
| **Remote** | 원격 저장소 | GitHub에 있는 저장소 |
| **Local** | 로컬 저장소 | 내 컴퓨터에 있는 저장소 |
| **Branch** | 가지 | 작업을 분리하는 공간 (고급) |
| **Merge** | 병합 | 두 버전을 합침 |
| **Conflict** | 충돌 | 같은 부분을 다르게 수정했을 때 |

---

## 📞 더 도움이 필요하면?

1. **Obsidian Git 공식 문서**: [GitHub](https://github.com/denolehov/obsidian-git)
2. **Git 기초 배우기**: [Git 입문](https://git-scm.com/book/ko/v2)
3. **Obsidian 커뮤니티**: [Forum](https://forum.obsidian.md)

---

## ✨ 마지막 팁

> **💡 중요**: Git은 자동으로 변경 이력을 모두 기록하므로, 실수로 삭제하거나 덮어써도 복구할 수 있습니다!

**매일 한 번씩 `Git: Backup` 명령어를 실행하는 습관을 들이세요!**

---

*이 가이드는 초보자를 위한 것입니다. Git을 처음 사용하시더라도 위 내용만 따라하면 충분합니다!*
