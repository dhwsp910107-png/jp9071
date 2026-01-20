/**
 * ================================
 * Timer Card Plugin v1.0
 * ================================
 * 
 * 목적: Study Dashboard와 연동되는 경량 이미지 관리 플러그인
 * 
 * 주요 기능:
 * 1. [📷 이미지 추가] 버튼 인식 및 처리
 * 2. 자동 파일명 생성 (문제번호 기반)
 * 3. 자동 경로 설정 (첨부파일 폴더)
 * 4. (선택) 간단한 타이머/스톱워치
 * 
 * Study Dashboard 연동:
 * - Dashboard에서 문제 클릭 → 문제 노트 열림
 * - 노트 안에서 [📷 이미지 추가] 버튼 작동
 * - 이미지 자동 삽입 및 경로 관리
 */

const { Plugin, MarkdownView, Notice, Modal, ButtonComponent } = require('obsidian');

// ================================
// Part 1: 메인 플러그인 클래스
// ================================

class TimerCardPlugin extends Plugin {
    async onload() {
        console.log('Timer Card Plugin v1.0 로딩 중...');

        // 설정 로드
        await this.loadSettings();

        // 이미지 추가 버튼 처리기 등록
        this.registerMarkdownPostProcessor(this.imageButtonProcessor.bind(this));

        // 에디터 메뉴에 이미지 추가 명령어 추가
        this.addCommand({
            id: 'add-problem-image',
            name: '문제 이미지 추가',
            editorCallback: (editor, view) => {
                this.addProblemImage(editor, view, 'problem');
            }
        });

        this.addCommand({
            id: 'add-hint-image',
            name: '힌트 이미지 추가',
            editorCallback: (editor, view) => {
                this.addProblemImage(editor, view, 'hint');
            }
        });

        this.addCommand({
            id: 'add-answer-image',
            name: '정답 이미지 추가',
            editorCallback: (editor, view) => {
                this.addProblemImage(editor, view, 'answer');
            }
        });

        // 간단한 타이머 명령어 (선택적)
        this.addCommand({
            id: 'start-timer',
            name: '타이머 시작',
            callback: () => {
                this.startTimer();
            }
        });

        console.log('Timer Card Plugin v1.0 로딩 완료!');
    }

    async onunload() {
        console.log('Timer Card Plugin v1.0 언로딩...');
    }

    // ================================
    // Part 2: 설정 관리
    // ================================

    async loadSettings() {
        this.settings = Object.assign({}, {
            attachmentFolder: '첨부파일',
            autoRename: true,
            imagePrefix: 'img',
            timerEnabled: false
        }, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    // ================================
    // Part 3: 이미지 버튼 처리기
    // ================================

    /**
     * [📷 이미지 추가] 형태의 텍스트를 버튼으로 변환
     */
    imageButtonProcessor(element, context) {
        // [📷 ...] 패턴 찾기
        const imageButtons = element.querySelectorAll('p');
        
        imageButtons.forEach(p => {
            const text = p.textContent;
            
            // [📷 문제 이미지 추가] 패턴 매칭
            const match = text.match(/\[📷\s*(문제|힌트|정답)\s*이미지\s*추가\]/);
            
            if (match) {
                const imageType = match[1]; // '문제', '힌트', '정답'
                
                // 버튼 생성
                const button = document.createElement('button');
                button.className = 'timer-card-image-button';
                button.textContent = `📷 ${imageType} 이미지 추가`;
                button.style.cssText = `
                    background: var(--interactive-accent);
                    color: var(--text-on-accent);
                    border: none;
                    border-radius: 6px;
                    padding: 8px 16px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 500;
                    transition: all 0.2s;
                    margin: 8px 0;
                `;
                
                // 호버 효과
                button.addEventListener('mouseenter', () => {
                    button.style.opacity = '0.8';
                    button.style.transform = 'translateY(-1px)';
                });
                
                button.addEventListener('mouseleave', () => {
                    button.style.opacity = '1';
                    button.style.transform = 'translateY(0)';
                });
                
                // 클릭 이벤트
                button.addEventListener('click', async (e) => {
                    e.preventDefault();
                    await this.handleImageButtonClick(imageType, context);
                });
                
                // 기존 텍스트를 버튼으로 교체
                p.textContent = '';
                p.appendChild(button);
            }
        });
    }

    // ================================
    // Part 4: 이미지 추가 핸들러
    // ================================

    /**
     * 이미지 버튼 클릭 시 처리
     */
    async handleImageButtonClick(imageType, context) {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        
        if (!activeView) {
            new Notice('활성 노트를 찾을 수 없습니다.');
            return;
        }

        const editor = activeView.editor;
        const file = activeView.file;

        // frontmatter에서 문제번호 가져오기
        const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
        const problemNumber = frontmatter?.number || 'unknown';
        const subject = frontmatter?.subject || 'general';

        // 파일 선택 다이얼로그 열기
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                // 이미지 처리 및 삽입
                await this.processAndInsertImage(file, imageType, problemNumber, subject, editor);
            } catch (error) {
                console.error('이미지 처리 중 오류:', error);
                new Notice('이미지 추가 실패: ' + error.message);
            }
        };

        input.click();
    }

    // ================================
    // Part 5: 이미지 처리 및 삽입
    // ================================

    /**
     * 이미지 파일 처리 및 삽입
     */
    async processAndInsertImage(file, imageType, problemNumber, subject, editor) {
        // 1. 파일명 생성
        const timestamp = new Date().getTime();
        const ext = file.name.split('.').pop();
        const newFileName = `${subject}_${problemNumber}_${imageType}_${timestamp}.${ext}`;

        // 2. 첨부파일 폴더 경로
        const attachmentPath = this.settings.attachmentFolder;
        const targetFolder = `${attachmentPath}/${subject}`;

        // 3. 폴더 생성 (없으면)
        await this.ensureFolder(targetFolder);

        // 4. 파일 저장
        const arrayBuffer = await file.arrayBuffer();
        const targetPath = `${targetFolder}/${newFileName}`;
        
        await this.app.vault.adapter.writeBinary(targetPath, arrayBuffer);

        // 5. 마크다운 링크 생성 및 삽입
        const imageLink = `![[${newFileName}]]`;
        
        // 현재 커서 위치에 삽입
        const cursor = editor.getCursor();
        editor.replaceRange(imageLink + '\n', cursor);

        new Notice(`✅ ${imageType} 이미지가 추가되었습니다!`);
    }

    /**
     * 폴더 생성 (없으면)
     */
    async ensureFolder(folderPath) {
        const folder = this.app.vault.getAbstractFileByPath(folderPath);
        
        if (!folder) {
            await this.app.vault.createFolder(folderPath);
        }
    }

    // ================================
    // Part 6: 에디터 명령어 처리
    // ================================

    /**
     * 에디터에서 직접 이미지 추가
     */
    async addProblemImage(editor, view, imageType) {
        const file = view.file;
        const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
        const problemNumber = frontmatter?.number || 'unknown';
        const subject = frontmatter?.subject || 'general';

        // 파일 선택 다이얼로그
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        
        input.onchange = async (e) => {
            const selectedFile = e.target.files[0];
            if (!selectedFile) return;

            try {
                await this.processAndInsertImage(selectedFile, imageType, problemNumber, subject, editor);
            } catch (error) {
                console.error('이미지 추가 중 오류:', error);
                new Notice('이미지 추가 실패: ' + error.message);
            }
        };

        input.click();
    }

    // ================================
    // Part 7: 타이머 기능 (선택적)
    // ================================

    startTimer() {
        if (!this.settings.timerEnabled) {
            new Notice('타이머 기능이 비활성화되어 있습니다.');
            return;
        }

        new TimerModal(this.app, (duration) => {
            new Notice(`⏱️ ${duration}초가 기록되었습니다.`);
            
            // frontmatter에 시간 기록
            const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
            if (activeView) {
                this.recordTime(activeView.file, duration);
            }
        }).open();
    }

    /**
     * frontmatter에 시간 기록
     */
    async recordTime(file, duration) {
        const fileContent = await this.app.vault.read(file);
        const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
        
        if (!frontmatter) {
            new Notice('frontmatter를 찾을 수 없습니다.');
            return;
        }

        // times 배열에 추가
        const times = frontmatter.times || [];
        times.push(duration);

        // 파일 업데이트
        const newContent = this.updateFrontmatter(fileContent, 'times', times);
        await this.app.vault.modify(file, newContent);
        
        new Notice(`✅ 시간이 기록되었습니다: ${duration}초`);
    }

    /**
     * frontmatter 업데이트 헬퍼
     */
    updateFrontmatter(content, key, value) {
        const lines = content.split('\n');
        const fmStart = lines.findIndex(line => line.trim() === '---');
        const fmEnd = lines.findIndex((line, idx) => idx > fmStart && line.trim() === '---');
        
        if (fmStart === -1 || fmEnd === -1) {
            return content;
        }

        // frontmatter 영역
        const fmLines = lines.slice(fmStart + 1, fmEnd);
        
        // key 찾기
        const keyIndex = fmLines.findIndex(line => line.startsWith(key + ':'));
        
        if (keyIndex !== -1) {
            // 기존 key 업데이트
            fmLines[keyIndex] = `${key}: ${JSON.stringify(value)}`;
        } else {
            // 새 key 추가
            fmLines.push(`${key}: ${JSON.stringify(value)}`);
        }

        // 재조립
        const newLines = [
            ...lines.slice(0, fmStart + 1),
            ...fmLines,
            ...lines.slice(fmEnd)
        ];

        return newLines.join('\n');
    }
}

// ================================
// Part 8: 타이머 모달
// ================================

class TimerModal extends Modal {
    constructor(app, onFinish) {
        super(app);
        this.onFinish = onFinish;
        this.startTime = null;
        this.interval = null;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl('h2', { text: '⏱️ 타이머' });

        // 시간 표시
        const timeDisplay = contentEl.createEl('div', {
            cls: 'timer-display',
            text: '00:00'
        });
        timeDisplay.style.cssText = `
            font-size: 48px;
            font-weight: bold;
            text-align: center;
            margin: 20px 0;
            font-family: monospace;
            color: var(--text-accent);
        `;

        // 버튼 컨테이너
        const buttonContainer = contentEl.createEl('div', {
            cls: 'timer-buttons'
        });
        buttonContainer.style.cssText = `
            display: flex;
            gap: 10px;
            justify-content: center;
        `;

        // 시작 버튼
        new ButtonComponent(buttonContainer)
            .setButtonText('시작')
            .onClick(() => {
                this.startTimer(timeDisplay);
            });

        // 정지 버튼
        new ButtonComponent(buttonContainer)
            .setButtonText('정지')
            .onClick(() => {
                this.stopTimer(timeDisplay);
            });

        // 초기화 버튼
        new ButtonComponent(buttonContainer)
            .setButtonText('초기화')
            .onClick(() => {
                this.resetTimer(timeDisplay);
            });
    }

    startTimer(display) {
        if (this.interval) return;

        this.startTime = Date.now();
        
        this.interval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
            const minutes = Math.floor(elapsed / 60);
            const seconds = elapsed % 60;
            
            display.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }, 100);
    }

    stopTimer(display) {
        if (!this.interval) return;

        clearInterval(this.interval);
        this.interval = null;

        const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
        
        if (this.onFinish) {
            this.onFinish(elapsed);
        }

        this.close();
    }

    resetTimer(display) {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }

        this.startTime = null;
        display.textContent = '00:00';
    }

    onClose() {
        if (this.interval) {
            clearInterval(this.interval);
        }
    }
}

// ================================
// Export
// ================================

module.exports = TimerCardPlugin;
