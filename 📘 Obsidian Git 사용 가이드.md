# 📘 Obsidian Git 사용 가이드 (한글)

## 🎯 Git 플러그인이란?
Obsidian Git 플러그인은 Vault의 모든 노트를 자동으로 GitHub에 백업하고 버전 관리를 해주는 플러그인입니다.

---

## 🚀 초기 설정 (한 번만 하면 됩니다)

### 1️⃣ GitHub 저장소 만들기
1. [GitHub](https://github.com)에 로그인
2. **New Repository** 클릭
3. 저장소 이름 입력 (예: `obsidian-vault`)
4. **Private** 선택 (개인 노트이므로)
5. **Create Repository** 클릭
6. 생성된 저장소 URL 복사 (예: `https://github.com/사용자명/obsidian-vault.git`)

### 2️⃣ 로컬 Git 저장소 연결
PowerShell이나 CMD를 열고 Vault 폴더로 이동 후:

```powershell
# 원격 저장소 추가
git remote add origin https://github.com/사용자명/obsidian-vault.git

# 브랜치 이름 설정
git branch -M main

# 첫 푸시
git push -u origin main
```

### 3️⃣ Obsidian Git 플러그인 설정
1. `Ctrl + ,` (설정 열기)
2. **Community plugins** → **Git** 클릭
3. 다음 설정 변경:

| 설정 항목 | 설명 | 추천 값 |
|----------|------|---------|
| **Vault backup interval** | 자동 백업 주기 (분) | `10` (10분마다) |
| **Auto pull interval** | 자동 가져오기 주기 (분) | `10` |
| **Commit message** | 커밋 메시지 | `자동 백업: {{date}}` |
| **Pull updates on startup** | 시작 시 업데이트 가져오기 | ✅ 체크 |
| **Push on backup** | 백업 시 푸시 | ✅ 체크 |
| **Pull before push** | 푸시 전 가져오기 | ✅ 체크 |

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

### 단계 1: 작업 후 저장
평소처럼 노트 작성 → `Ctrl + S` 저장

### 단계 2: GitHub에 백업
`Ctrl + P` → `Git: Backup` 입력 → Enter

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
