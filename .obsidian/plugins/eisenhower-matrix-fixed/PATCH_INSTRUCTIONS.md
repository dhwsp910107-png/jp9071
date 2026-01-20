# Eisenhower Matrix 버튼 수정 가이드

## 문제
버튼을 눌러도 생성된 노트로 이동하지 않음

## 해결 방법
`main.js` 파일에서 3개의 함수를 수정해야 합니다.

### 1. createDailyNote() 함수 수정

**찾아야 할 코드 (대략 라인 350-380):**
```javascript
        try {
            if (!await this.app.vault.adapter.exists(fileName)) {
                await this.app.vault.create(fileName, content);
                new Notice('일간 노트가 생성되었습니다.');
            } else {
                new Notice('일간 노트가 이미 존재합니다.');
            }
        } catch (error) {
            console.error('Error creating daily note:', error);
            new Notice('일간 노트 생성에 실패했습니다.');
        }
```

**이렇게 수정:**
```javascript
        try {
            let file;
            if (!await this.app.vault.adapter.exists(fileName)) {
                file = await this.app.vault.create(fileName, content);
                new Notice('일간 노트가 생성되었습니다.');
            } else {
                file = this.app.vault.getAbstractFileByPath(fileName);
                new Notice('일간 노트가 이미 존재합니다.');
            }
            
            // 파일 열기
            if (file) {
                const leaf = this.app.workspace.getLeaf(false);
                await leaf.openFile(file);
            }
        } catch (error) {
            console.error('Error creating daily note:', error);
            new Notice('일간 노트 생성에 실패했습니다.');
        }
```

### 2. createWeeklyNote() 함수 수정

**찾아야 할 코드 (대략 라인 420-450):**
```javascript
        try {
            if (!await this.app.vault.adapter.exists(fileName)) {
                await this.app.vault.create(fileName, content);
                new Notice('주간 노트가 생성되었습니다.');
            } else {
                new Notice('주간 노트가 이미 존재합니다.');
            }
        } catch (error) {
            console.error('Error creating weekly note:', error);
            new Notice('주간 노트 생성에 실패했습니다.');
        }
```

**이렇게 수정:**
```javascript
        try {
            let file;
            if (!await this.app.vault.adapter.exists(fileName)) {
                file = await this.app.vault.create(fileName, content);
                new Notice('주간 노트가 생성되었습니다.');
            } else {
                file = this.app.vault.getAbstractFileByPath(fileName);
                new Notice('주간 노트가 이미 존재합니다.');
            }
            
            // 파일 열기
            if (file) {
                const leaf = this.app.workspace.getLeaf(false);
                await leaf.openFile(file);
            }
        } catch (error) {
            console.error('Error creating weekly note:', error);
            new Notice('주간 노트 생성에 실패했습니다.');
        }
```

### 3. createMonthlyNote() 함수 수정

**찾아야 할 코드 (대략 라인 490-520):**
```javascript
        try {
            if (!await this.app.vault.adapter.exists(fileName)) {
                await this.app.vault.create(fileName, content);
                new Notice('월간 노트가 생성되었습니다.');
            } else {
                new Notice('월간 노트가 이미 존재합니다.');
            }
        } catch (error) {
            console.error('Error creating monthly note:', error);
            new Notice('월간 노트 생성에 실패했습니다.');
        }
```

**이렇게 수정:**
```javascript
        try {
            let file;
            if (!await this.app.vault.adapter.exists(fileName)) {
                file = await this.app.vault.create(fileName, content);
                new Notice('월간 노트가 생성되었습니다.');
            } else {
                file = this.app.vault.getAbstractFileByPath(fileName);
                new Notice('월간 노트가 이미 존재합니다.');
            }
            
            // 파일 열기
            if (file) {
                const leaf = this.app.workspace.getLeaf(false);
                await leaf.openFile(file);
            }
        } catch (error) {
            console.error('Error creating monthly note:', error);
            new Notice('월간 노트 생성에 실패했습니다.');
        }
```

## 수정 방법

1. **VSCode나 메모장으로 main.js 열기**
   - 경로: `.obsidian/plugins/eisenhower-matrix-fixed/main.js`

2. **Ctrl+F로 검색해서 각 함수 찾기**
   - `async createDailyNote()` 검색
   - `async createWeeklyNote()` 검색  
   - `async createMonthlyNote()` 검색

3. **각 함수의 try-catch 블록을 위의 코드로 교체**

4. **파일 저장**

5. **Obsidian 재시작** (Ctrl+R로 리로드)

## 변경사항 요약

각 함수에서 다음 3가지가 추가됩니다:
1. `let file;` - 파일 객체를 저장할 변수
2. `file = await this.app.vault.create(...)` - 생성된 파일을 변수에 저장
3. `file = this.app.vault.getAbstractFileByPath(fileName)` - 기존 파일을 가져옴
4. 파일 열기 코드 추가:
   ```javascript
   if (file) {
       const leaf = this.app.workspace.getLeaf(false);
       await leaf.openFile(file);
   }
   ```

이렇게 수정하면 버튼을 눌렀을 때 노트가 생성되고 자동으로 열립니다!
