const { Plugin, MarkdownView, Notice } = require('obsidian');

// 전력공학 마인드맵 플러그인
class PowerEngineeringMindMapPlugin extends Plugin {
    async onload() {
        console.log('전력공학 마인드맵 플러그인 로드됨');

        // 리본 아이콘 추가 (왼쪽 사이드바)
        this.addRibbonIcon('brain', '마인드맵 보기', () => {
            this.openMindMapView();
        });

        // 명령어 추가
        this.addCommand({
            id: 'open-mindmap-view',
            name: '마인드맵 보기',
            callback: () => {
                this.openMindMapView();
            }
        });

        this.addCommand({
            id: 'create-concept-note',
            name: '개념 노트 생성',
            callback: () => {
                this.createConceptNote();
            }
        });

        this.addCommand({
            id: 'create-problem-note',
            name: '문제 노트 생성',
            callback: () => {
                this.createProblemNote();
            }
        });

        this.addCommand({
            id: 'convert-to-mindmap',
            name: '현재 노트를 마인드맵으로 변환',
            callback: () => {
                this.convertToMindMap();
            }
        });

        this.addCommand({
            id: 'add-blank-node',
            name: '빈칸 노드 추가',
            editorCallback: (editor) => {
                editor.replaceSelection('- [ ] ____\n');
            }
        });
    }

    // 마인드맵 뷰 열기
    openMindMapView() {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!activeView) {
            new Notice('마크다운 파일을 열어주세요.');
            return;
        }

        const content = activeView.editor.getValue();
        this.generateMindMapHTML(content);
    }

    // 마인드맵 HTML 생성
    generateMindMapHTML(content) {
        const lines = content.split('\n');
        let html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {
            font-family: 'Segoe UI', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 40px;
            color: white;
        }
        .mindmap {
            background: rgba(255,255,255,0.1);
            backdrop-filter: blur(10px);
            border-radius: 20px;
            padding: 40px;
            max-width: 1400px;
            margin: 0 auto;
        }
        .level-1 { 
            font-size: 32px; 
            font-weight: bold; 
            margin: 20px 0;
            color: #ffd93d;
        }
        .level-2 { 
            font-size: 24px; 
            margin: 15px 0 15px 30px;
            color: #4ecdc4;
        }
        .level-3 { 
            font-size: 18px; 
            margin: 10px 0 10px 60px;
            color: #ff6b6b;
        }
        .level-4 { 
            font-size: 16px; 
            margin: 8px 0 8px 90px;
            color: #ffd93d;
        }
        .blank { 
            background: rgba(255,209,61,0.2);
            border: 2px dashed #ffd93d;
            padding: 5px 10px;
            border-radius: 5px;
            display: inline-block;
        }
        .checkbox {
            margin-right: 5px;
        }
    </style>
</head>
<body>
    <div class="mindmap">
        <h1 style="text-align: center; margin-bottom: 40px;">🧠 마인드맵</h1>
`;

        lines.forEach(line => {
            const trimmed = line.trim();
            if (trimmed.startsWith('# ')) {
                html += `<div class="level-1">${trimmed.substring(2)}</div>`;
            } else if (trimmed.startsWith('## ')) {
                html += `<div class="level-2">${trimmed.substring(3)}</div>`;
            } else if (trimmed.startsWith('### ')) {
                html += `<div class="level-3">${trimmed.substring(4)}</div>`;
            } else if (trimmed.startsWith('- ')) {
                const text = trimmed.substring(2);
                if (text.includes('[ ]') || text.includes('____')) {
                    html += `<div class="level-4 blank">📝 ${text}</div>`;
                } else {
                    html += `<div class="level-4">• ${text}</div>`;
                }
            }
        });

        html += `
    </div>
</body>
</html>`;

        // 새 창에서 마인드맵 열기
        const win = window.open('', 'MindMap', 'width=1200,height=800');
        win.document.write(html);
        win.document.close();

        new Notice('마인드맵이 생성되었습니다!');
    }

    // 개념 노트 생성
    async createConceptNote() {
        const noteName = await this.promptForInput('개념 이름을 입력하세요', '예: 1-2_지지물');
        if (!noteName) return;

        const template = `---
대단원: 
중단원: 
소단원: 
태그: #개념 #전력공학
---

# ${noteName}

## 📚 정의


## 💡 핵심 내용


## 📐 공식


## 🔗 연관 개념
- [[]]
- [[]]

## 📝 예제 문제
- [[]]

## 💭 학습 메모

`;

        await this.createFileWithTemplate(noteName, template);
    }

    // 문제 노트 생성
    async createProblemNote() {
        const problemNumber = await this.promptForInput('문제 번호를 입력하세요', '예: 001');
        if (!problemNumber) return;

        const template = `---
문제번호: ${problemNumber}
출처: 
대단원: 
중단원: 
소단원: 
핵심개념: []
난이도: 
풀이시간: 
복습필요: false
---

# 📝 문제 ${problemNumber}

## 문제


## 🎯 개념 경로
대단원 > 중단원 > 소단원

## 💡 사용된 개념
- [[]]
- [[]]

## 📝 풀이 과정

### Step 1


### Step 2


### Step 3


## ✅ 정답


## 🔗 개념 연결
- [[]]

## 📌 오답노트

### 틀린 이유


### 주의사항


## 복습 체크
- [ ] 1일 후
- [ ] 1주 후
- [ ] 1개월 후
`;

        await this.createFileWithTemplate(`문제${problemNumber}`, template);
    }

    // 현재 노트를 마인드맵으로 변환
    convertToMindMap() {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!activeView) {
            new Notice('마크다운 파일을 열어주세요.');
            return;
        }

        const content = activeView.editor.getValue();
        const converted = this.convertMarkdownToMindMap(content);
        
        activeView.editor.setValue(converted);
        new Notice('마인드맵 형식으로 변환되었습니다!');
    }

    // 마크다운을 마인드맵 형식으로 변환
    convertMarkdownToMindMap(content) {
        const lines = content.split('\n');
        let result = [];
        let currentLevel = 0;

        lines.forEach(line => {
            const trimmed = line.trim();
            if (!trimmed) {
                result.push('');
                return;
            }

            if (trimmed.startsWith('#')) {
                // 헤딩은 그대로 유지
                result.push(trimmed);
                currentLevel = (trimmed.match(/^#+/) || [''])[0].length;
            } else if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
                // 리스트는 그대로 유지
                result.push(line);
            } else {
                // 일반 텍스트는 리스트로 변환
                const indent = '  '.repeat(Math.max(0, currentLevel - 1));
                result.push(`${indent}- ${trimmed}`);
            }
        });

        return result.join('\n');
    }

    // 파일 생성 헬퍼
    async createFileWithTemplate(name, template) {
        const fileName = `${name}.md`;
        const folder = this.app.vault.getAbstractFileByPath('');
        
        try {
            await this.app.vault.create(fileName, template);
            new Notice(`${fileName} 파일이 생성되었습니다!`);
            
            // 생성된 파일 열기
            const file = this.app.vault.getAbstractFileByPath(fileName);
            if (file) {
                await this.app.workspace.getLeaf().openFile(file);
            }
        } catch (error) {
            new Notice(`파일 생성 실패: ${error.message}`);
        }
    }

    // 입력 프롬프트
    async promptForInput(message, placeholder = '') {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: white;
                padding: 30px;
                border-radius: 10px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                z-index: 9999;
                min-width: 400px;
            `;

            modal.innerHTML = `
                <h3 style="margin: 0 0 20px 0; color: #333;">${message}</h3>
                <input type="text" placeholder="${placeholder}" 
                       style="width: 100%; padding: 10px; font-size: 16px; border: 2px solid #667eea; border-radius: 5px;">
                <div style="margin-top: 20px; text-align: right;">
                    <button id="cancel-btn" style="padding: 10px 20px; margin-right: 10px; background: #ccc; border: none; border-radius: 5px; cursor: pointer;">취소</button>
                    <button id="ok-btn" style="padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 5px; cursor: pointer;">확인</button>
                </div>
            `;

            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.5);
                z-index: 9998;
            `;

            document.body.appendChild(overlay);
            document.body.appendChild(modal);

            const input = modal.querySelector('input');
            const okBtn = modal.querySelector('#ok-btn');
            const cancelBtn = modal.querySelector('#cancel-btn');

            input.focus();

            const cleanup = () => {
                document.body.removeChild(modal);
                document.body.removeChild(overlay);
            };

            okBtn.addEventListener('click', () => {
                const value = input.value.trim();
                cleanup();
                resolve(value || null);
            });

            cancelBtn.addEventListener('click', () => {
                cleanup();
                resolve(null);
            });

            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const value = input.value.trim();
                    cleanup();
                    resolve(value || null);
                }
            });

            overlay.addEventListener('click', () => {
                cleanup();
                resolve(null);
            });
        });
    }

    onunload() {
        console.log('전력공학 마인드맵 플러그인 언로드됨');
    }
}

module.exports = PowerEngineeringMindMapPlugin;