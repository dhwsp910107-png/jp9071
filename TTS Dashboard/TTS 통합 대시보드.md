---
title: TTS 통합 대시보드
created: 2025-11-04
tags: [tts, dashboard, audio]
---

# 🎙️ TTS 통합 대시보드

> 마지막 업데이트: 2025. 11. 5. 오전 5:17:27

## 🎯 빠른 실행

```button
name � 새 텍스트 읽기
type command
action TTS 음성 읽기
color blue
```
^button-new-tts

```button
name 🎙️ 음성 녹음
type command
action 내 음성 녹음하기
color green
```
^button-record

```button
name ⏹️ 음성 정지
type command
action 음성 읽기 정지
color red
```
^button-stop

```button
name ⏸️ 일시정지/재개
type command
action 음성 읽기 일시정지/재개
color default
```
^button-pause

```button
name 🔄 대시보드 새로고침
type command
action TTS 대시보드 생성
color purple
```
^button-refresh

---

## �📊 통계 요약

```dataviewjs
const audioFolder = "TTS Audio";
const txtFiles = dv.pages('"' + audioFolder + '"').where(p => p.file.name.endsWith('.txt'));
const audioFiles = dv.pages('"' + audioFolder + '"').where(p => p.file.name.endsWith('.webm') || p.file.name.endsWith('.mp4') || p.file.name.endsWith('.ogg'));

const totalTxt = txtFiles.length;
const totalAudio = audioFiles.length;
const voiceProfiles = audioFiles.where(f => f.file.name.includes('voice_profile')).length;

dv.paragraph(`
📄 **저장된 TTS 텍스트**: ${totalTxt}개  
🎵 **오디오 파일**: ${totalAudio}개  
🎭 **음성 프로필**: ${voiceProfiles}개
`);
```

---

## 📄 저장된 TTS 텍스트 파일

> 💡 **파일명을 클릭하면 내용을 읽어줍니다**

```dataviewjs
const audioFolder = "TTS Audio";
const txtFiles = dv.pages('"' + audioFolder + '"')
    .where(p => p.file.name.endsWith('.txt'))
    .sort(p => p.file.ctime, 'desc');

if (txtFiles.length === 0) {
    dv.paragraph('❌ 저장된 TTS 텍스트 파일이 없습니다.');
    dv.paragraph('💡 자동 저장 기능을 활성화하면 TTS로 읽은 텍스트가 자동으로 저장됩니다.');
} else {
    dv.table(
        ['#', '파일명', '생성일', '크기', '📖 읽기'],
        txtFiles.map((p, idx) => {
            const fileName = p.file.name.replace('.txt', '');
            const filePath = p.file.path;
            return [
                idx + 1,
                fileName,
                p.file.ctime ? new Date(p.file.ctime).toLocaleString('ko-KR', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                }) : 'N/A',
                p.file.size ? (p.file.size / 1024).toFixed(1) + ' KB' : 'N/A',
                '[`▶️ 재생`](' + filePath + ')'
            ];
        })
    );
    
    dv.paragraph('');
    dv.paragraph('**사용법**: 📖 읽기 열의 `▶️ 재생` 링크를 클릭하면 파일 내용이 TTS로 재생됩니다.');
}
```

---

## 📂 폴더별 파일 목록

```dataviewjs
const baseFolder = "TTS Audio";
const allFiles = dv.pages('"' + baseFolder + '"');

// 폴더별로 그룹화
const folders = {};
for (const page of allFiles) {
    const pathParts = page.file.folder.split('/');
    const folderName = pathParts[pathParts.length - 1] || baseFolder;
    
    if (!folders[folderName]) {
        folders[folderName] = [];
    }
    folders[folderName].push(page);
}

// 각 폴더별 테이블 생성
for (const [folderName, files] of Object.entries(folders)) {
    if (files.length === 0) continue;
    
    dv.header(3, `📂 ${folderName} (${files.length}개)`);
    
    dv.table(
        ['파일명', '유형', '생성일', '크기', '링크'],
        files.map(p => {
            let fileType = '📄 기타';
            if (p.file.name.endsWith('.txt')) fileType = '� 텍스트';
            else if (p.file.name.endsWith('.webm') || p.file.name.endsWith('.mp4')) fileType = '🎵 오디오';
            else if (p.file.name.includes('voice_profile')) fileType = '🎭 프로필';
            
            return [
                p.file.name,
                fileType,
                p.file.ctime ? new Date(p.file.ctime).toLocaleString('ko-KR') : 'N/A',
                p.file.size ? (p.file.size / 1024).toFixed(1) + ' KB' : 'N/A',
                dv.fileLink(p.file.path, false, '🔗')
            ];
        })
    );
}
```

---

## 📅 최근 활동 (최근 15개)

```dataviewjs
const audioFolder = "TTS Audio";
const recentFiles = dv.pages('"' + audioFolder + '"')
    .sort(p => p.file.ctime, 'desc')
    .limit(15);

if (recentFiles.length === 0) {
    dv.paragraph('❌ 최근 파일이 없습니다.');
} else {
    dv.table(
        ['#', '파일명', '유형', '생성일', '동작'],
        recentFiles.map((p, idx) => {
            let fileType = '📄';
            let action = dv.fileLink(p.file.path, false, '🔗 열기');
            
            if (p.file.name.endsWith('.txt')) {
                fileType = '📝 TXT';
                action = '[`▶️ 재생`](' + p.file.path + ')';
            } else if (p.file.name.endsWith('.webm') || p.file.name.endsWith('.mp4')) {
                fileType = '🎵 Audio';
            } else if (p.file.name.includes('voice_profile')) {
                fileType = '🎭 Profile';
            }
            
            return [
                idx + 1,
                p.file.name,
                fileType,
                p.file.ctime ? new Date(p.file.ctime).toLocaleString('ko-KR', {
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                }) : 'N/A',
                action
            ];
        })
    );
}
```

---

## ⚙️ 현재 설정

```dataviewjs
dv.paragraph(`
**🎵 음성 모드**: 🎭 샘플 오디오 재생  
**🌍 언어**: ko-KR  
**⚡ 속도**: 2.4x  
**� 음높이**: 1  
**🔊 볼륨**: 0.1  
**💾 자동 저장**: ✅ 활성화  
**📁 출력 폴더**: \`TTS Audio\`  
**🎭 음성 프로필**: ✅ 등록됨
`);
```



---

## 💡 사용 팁

- **TXT 파일 재생**: 위의 "저장된 TTS 텍스트 파일" 섹션에서 `▶️ 재생` 링크를 클릭하면 자동으로 내용을 읽어줍니다
- **자동 저장**: 설정에서 "자동 저장" 기능을 활성화하면 TTS로 읽은 모든 텍스트가 자동으로 저장됩니다
- **단축키**: 
  - 선택한 텍스트 읽기: 텍스트 선택 후 커맨드 실행
  - 전체 노트 읽기: 커맨드 팔레트에서 실행
  - 정지/일시정지: 버튼 또는 커맨드로 제어

---

*📌 이 대시보드는 자동으로 생성되었습니다. "🔄 대시보드 새로고침" 버튼을 눌러 최신 정보로 업데이트하세요.*
