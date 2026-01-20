# Study Dashboard + Stopwatch 통합 설치 가이드

## 🎯 빠른 수정 가이드

main.js 파일에서 **3곳만** 수정하면 됩니다!

### 1단계: 명령어 추가 (26번째 줄 부근)

**찾기:** (Ctrl+F)
```javascript
this.addCommand({
    id: 'open-study-dashboard',
    name: '통합 Study Dashboard 열기',
    callback: () => this.activateView()
});
```

**바로 뒤에 추가:**
```javascript
// 🎯 새 명령어 1
this.addCommand({
    id: 'create-problem-with-timer',
    name: '🎯 스톱워치 포함 문제 생성',
    callback: () => {
        const subject = prompt('과목을 입력하세요:', '수학');
        if (!subject) return;
        const number = prompt('문제 번호를 입력하세요:', '1');
        if (!number) return;
        const title = prompt('문제 제목을 입력하세요:', '');
        if (!title) return;
        this.createProblem(subject, parseInt(number), title);
    }
});

// ⏱️ 새 명령어 2
this.addCommand({
    id: 'quick-timer-insert',
    name: '⏱️ 빠른 타이머 삽입',
    editorCallback: (editor) => {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            new Notice('❌ 활성화된 파일이 없습니다');
            return;
        }
        const cache = this.app.metadataCache.getFileCache(activeFile);
        const frontmatter = cache?.frontmatter;
        const title = frontmatter ? 
            `${frontmatter.subject || '문제'} ${frontmatter.number || ''}번 - ${frontmatter.title || '타이머'}` :
            '문제 풀이 타이머';
        const template = `
\`\`\`stopwatch
title: "${title}"
showMilliseconds: true
autoStart: false
theme: purple
\`\`\``;
        editor.replaceSelection(template);
        new Notice('⏱️ 스톱워치 타이머가 추가되었습니다!');
    }
});
```

---

### 2단계: createProblemTemplate() 함수 찾아서 stopwatch 추가

Artifact "Study Dashboard 수정 - Part 1"의 createProblemTemplate() 함수를 보고  
템플릿에 다음 부분이 있는지 확인:

```markdown
## ⏱️ 문제 풀이 타이머

\`\`\`stopwatch
title: "${subject} ${number}번 - ${title}"
showMilliseconds: true
autoStart: false
theme: purple
\`\`\`
```

---

### 3단계: createProblem() 함수에 stopwatch 연동 추가

함수 끝부분에 추가:

```javascript
// 스톱워치 플러그인에 문제 정보 전달
const stopwatchPlugin = this.app.plugins.plugins['stopwatch-timer'];
if (stopwatchPlugin) {
    stopwatchPlugin.currentProblem = {
        file: file,
        subject: subject,
        number: number,
        title: title
    };
    console.log('⏱️ 스톱워치와 문제 연동 완료:', stopwatchPlugin.currentProblem);
}
```

---

## 완료!

Obsidian 재시작 후 테스트:
- Ctrl+P → "스톱워치 포함 문제 생성"
- Ctrl+P → "빠른 타이머 삽입"

작동하면 성공입니다! 🎉
