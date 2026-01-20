// 이미지 빈칸 업로드 모달
class ImageClozeModal extends Modal {
    constructor(app, plugin, file, onSave) {
        super(app);
        this.plugin = plugin;
        this.file = file;
        this.onSave = onSave;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        contentEl.createEl('h2', { text: '🖼️ 이미지 빈칸 추가' });
        
        const description = contentEl.createDiv();
        description.style.cssText = 'margin: 15px 0; padding: 12px; background: var(--background-secondary); border-radius: 6px;';
        description.createEl('p', { text: '📌 이미지를 업로드하고 빈칸으로 만들 수 있습니다' });
        
        // 파일 선택
        const fileContainer = contentEl.createDiv({ cls: 'setting-item' });
        fileContainer.createEl('div', { text: '이미지 파일', cls: 'setting-item-name' });
        const fileInput = fileContainer.createEl('input', { type: 'file', attr: { accept: 'image/*', multiple: true } });
        fileInput.style.cssText = 'width: 100%;';
        
        let selectedFiles = [];
        fileInput.onchange = (e) => {
            selectedFiles = Array.from(e.target.files);
            updatePreview();
        };
        
        // 미리보기
        const previewContainer = contentEl.createDiv();
        previewContainer.style.cssText = 'margin: 15px 0; display: flex; gap: 10px; flex-wrap: wrap;';
        
        const updatePreview = () => {
            previewContainer.empty();
            selectedFiles.forEach((file, idx) => {
                const preview = previewContainer.createDiv();
                preview.style.cssText = 'position: relative; width: 150px;';
                
                const img = preview.createEl('img');
                img.src = URL.createObjectURL(file);
                img.style.cssText = 'width: 100%; height: 100px; object-fit: cover; border-radius: 4px;';
                
                const removeBtn = preview.createEl('button', { text: '✕' });
                removeBtn.style.cssText = 'position: absolute; top: 5px; right: 5px; background: red; color: white; border: none; border-radius: 50%; width: 24px; height: 24px; cursor: pointer;';
                removeBtn.onclick = () => {
                    selectedFiles.splice(idx, 1);
                    updatePreview();
                };
            });
        };
        
        // 빈칸 ID
        const idContainer = contentEl.createDiv({ cls: 'setting-item' });
        idContainer.style.marginTop = '15px';
        idContainer.createEl('div', { text: '빈칸 ID', cls: 'setting-item-name' });
        const idInput = idContainer.createEl('input', { type: 'number', value: '1' });
        idInput.style.cssText = 'width: 100%; padding: 8px; border: 1px solid var(--background-modifier-border); border-radius: 4px;';
        
        // 정답
        const answerContainer = contentEl.createDiv({ cls: 'setting-item' });
        answerContainer.style.marginTop = '15px';
        answerContainer.createEl('div', { text: '정답 (선택)', cls: 'setting-item-name' });
        const answerInput = answerContainer.createEl('input', { type: 'text', placeholder: '이미지 설명' });
        answerInput.style.cssText = 'width: 100%; padding: 8px; border: 1px solid var(--background-modifier-border); border-radius: 4px;';
        
        // 힌트
        const hintContainer = contentEl.createDiv({ cls: 'setting-item' });
        hintContainer.style.marginTop = '15px';
        hintContainer.createEl('div', { text: '힌트 (선택)', cls: 'setting-item-name' });
        const hintInput = hintContainer.createEl('input', { type: 'text', placeholder: '힌트' });
        hintInput.style.cssText = 'width: 100%; padding: 8px; border: 1px solid var(--background-modifier-border); border-radius: 4px;';
        
        // 버튼
        const buttonContainer = contentEl.createDiv();
        buttonContainer.style.cssText = 'margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end;';
        
        const saveBtn = buttonContainer.createEl('button', { text: '💾 추가', cls: 'mod-cta' });
        saveBtn.onclick = async () => {
            if (selectedFiles.length === 0) {
                new Notice('⚠️ 이미지를 선택해주세요');
                return;
            }
            
            try {
                const view = this.app.workspace.getActiveViewOfType(MarkdownView);
                if (!view || !view.editor) {
                    new Notice('❌ 편집기를 찾을 수 없습니다');
                    return;
                }
                
                const editor = view.editor;
                const attachmentFolder = `${this.file.parent.path}/첨부파일`;
                
                // 폴더 생성
                const folder = this.app.vault.getAbstractFileByPath(attachmentFolder);
                if (!folder) {
                    await this.app.vault.createFolder(attachmentFolder);
                }
                
                const clozeId = idInput.value;
                const answer = answerInput.value.trim();
                const hint = hintInput.value.trim();
                const addedTexts = [];
                
                for (const file of selectedFiles) {
                    const arrayBuffer = await file.arrayBuffer();
                    const uint8Array = new Uint8Array(arrayBuffer);
                    
                    const timestamp = Date.now();
                    const ext = file.name.split('.').pop();
                    const imageName = `image-${timestamp}.${ext}`;
                    const imagePath = `${attachmentFolder}/${imageName}`;
                    
                    await this.app.vault.createBinary(imagePath, uint8Array);
                    
                    // 이미지 링크와 빈칸 태그를 한 줄로
                    let clozeText = `![[첨부파일/${imageName}|300]]`;
                    if (answer && hint) {
                        clozeText += `{{c${clozeId}::${answer}::${hint}}}`;
                    } else if (answer) {
                        clozeText += `{{c${clozeId}::${answer}}}`;
                    } else {
                        clozeText += `{{c${clozeId}}}`;
                    }
                    
                    addedTexts.push(clozeText);
                    await new Promise(resolve => setTimeout(resolve, 10));
                }
                
                // 커서 위치에 삽입
                const cursor = editor.getCursor();
                editor.replaceRange(addedTexts.join('\n\n') + '\n\n', cursor);
                
                new Notice(`✅ ${addedTexts.length}개 이미지 빈칸이 추가되었습니다`);
                
                if (this.onSave) {
                    await this.onSave();
                }
                
                this.close();
            } catch (error) {
                console.error('이미지 추가 실패:', error);
                new Notice('❌ 이미지 추가 실패: ' + error.message);
            }
        };
        
        const cancelBtn = buttonContainer.createEl('button', { text: '❌ 취소' });
        cancelBtn.onclick = () => this.close();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
