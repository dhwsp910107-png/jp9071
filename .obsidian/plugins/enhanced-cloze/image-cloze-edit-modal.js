// 이미지 빈칸 편집 모달
class ImageClozeEditModal extends Modal {
    constructor(app, data) {
        super(app);
        this.data = data; // { clozeId, answer, hint, imageSrc, onSave }
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        contentEl.createEl('h2', { text: '🖼️ 이미지 빈칸 편집' });
        
        // 이미지 미리보기
        const imagePreview = contentEl.createDiv({ cls: 'image-cloze-preview' });
        imagePreview.style.cssText = `
            text-align: center;
            margin: 20px 0;
            padding: 15px;
            background: var(--background-secondary);
            border-radius: 8px;
        `;
        
        const img = imagePreview.createEl('img');
        img.src = this.data.imageSrc;
        img.style.cssText = `
            max-width: 300px;
            max-height: 200px;
            border-radius: 4px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        `;
        
        // 빈칸 ID
        const idContainer = contentEl.createDiv({ cls: 'setting-item' });
        idContainer.createEl('div', { text: '빈칸 ID (카드 번호)', cls: 'setting-item-name' });
        const idInput = idContainer.createEl('input', { type: 'number' });
        idInput.value = this.data.clozeId || '1';
        idInput.style.cssText = 'width: 100%; padding: 8px; border: 1px solid var(--background-modifier-border); border-radius: 4px;';
        
        // 정답 (Answer)
        const answerContainer = contentEl.createDiv({ cls: 'setting-item' });
        answerContainer.style.marginTop = '15px';
        answerContainer.createEl('div', { text: '정답 (선택사항)', cls: 'setting-item-name' });
        const answerInput = answerContainer.createEl('input', { type: 'text' });
        answerInput.value = this.data.answer || '';
        answerInput.placeholder = '이미지 설명 (예: 사과)';
        answerInput.style.cssText = 'width: 100%; padding: 8px; border: 1px solid var(--background-modifier-border); border-radius: 4px;';
        
        // 힌트
        const hintContainer = contentEl.createDiv({ cls: 'setting-item' });
        hintContainer.style.marginTop = '15px';
        hintContainer.createEl('div', { text: '힌트 (선택사항)', cls: 'setting-item-name' });
        const hintInput = hintContainer.createEl('input', { type: 'text' });
        hintInput.value = this.data.hint || '';
        hintInput.placeholder = '힌트 (예: 빨간 과일)';
        hintInput.style.cssText = 'width: 100%; padding: 8px; border: 1px solid var(--background-modifier-border); border-radius: 4px;';
        
        // 버튼
        const buttonContainer = contentEl.createDiv();
        buttonContainer.style.cssText = 'margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end;';
        
        const saveBtn = buttonContainer.createEl('button', { text: '💾 저장', cls: 'mod-cta' });
        saveBtn.onclick = () => {
            const newData = {
                clozeId: idInput.value,
                answer: answerInput.value.trim(),
                hint: hintInput.value.trim()
            };
            
            if (this.data.onSave) {
                this.data.onSave(newData);
            }
            
            this.close();
        };
        
        const cancelBtn = buttonContainer.createEl('button', { text: '❌ 취소' });
        cancelBtn.onclick = () => this.close();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

module.exports = ImageClozeEditModal;
