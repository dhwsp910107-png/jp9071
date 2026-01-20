// 테스트 관리 모달 클래스들
const { Modal, Notice } = require('obsidian');

// 테스트 항목 추가 모달
class TestItemAddModal extends Modal {
    constructor(app, onAdd) {
        super(app);
        this.onAdd = onAdd;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        contentEl.createEl('h2', { text: '새 테스트 항목 추가' });
        
        const form = contentEl.createDiv();
        form.createEl('label', { text: '항목 내용' });
        const textInput = form.createEl('input', { type: 'text' });
        textInput.style.cssText = 'width: 100%; margin-bottom: 15px; padding: 8px;';
        
        const btnContainer = form.createDiv();
        btnContainer.style.cssText = 'display: flex; gap: 10px; justify-content: flex-end;';
        
        const addBtn = btnContainer.createEl('button', { text: '추가' });
        addBtn.style.cssText = 'background: var(--interactive-accent); color: var(--text-on-accent); padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;';
        addBtn.onclick = () => {
            const text = textInput.value.trim();
            if (text) {
                this.onAdd(text);
                this.close();
                new Notice('테스트 항목이 추가되었습니다!');
            }
        };
        
        const cancelBtn = btnContainer.createEl('button', { text: '취소' });
        cancelBtn.style.cssText = 'padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; background: var(--background-secondary); color: var(--text-normal);';
        cancelBtn.onclick = () => this.close();
        
        textInput.focus();
    }

    onClose() {
        this.contentEl.empty();
    }
}

// 테스트 메모 추가 모달
class TestNoteAddModal extends Modal {
    constructor(app, onAdd) {
        super(app);
        this.onAdd = onAdd;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        contentEl.createEl('h2', { text: '새 메모 추가' });
        
        const form = contentEl.createDiv();
        form.createEl('label', { text: '내용' });
        const textArea = form.createEl('textarea');
        textArea.style.cssText = 'width: 100%; min-height: 100px; margin-bottom: 15px; padding: 10px;';
        
        const btnContainer = form.createDiv();
        btnContainer.style.cssText = 'display: flex; gap: 10px; justify-content: flex-end;';
        
        const addBtn = btnContainer.createEl('button', { text: '추가' });
        addBtn.style.cssText = 'background: var(--interactive-accent); color: var(--text-on-accent); padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;';
        addBtn.onclick = () => {
            const text = textArea.value.trim();
            if (text) {
                this.onAdd(text);
                this.close();
                new Notice('메모가 추가되었습니다!');
            }
        };
        
        const cancelBtn = btnContainer.createEl('button', { text: '취소' });
        cancelBtn.style.cssText = 'padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; background: var(--background-secondary); color: var(--text-normal);';
        cancelBtn.onclick = () => this.close();
        
        textArea.focus();
    }

    onClose() {
        this.contentEl.empty();
    }
}

module.exports = { TestItemAddModal, TestNoteAddModal };
