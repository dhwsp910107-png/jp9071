// =====================================================
// Part 4: 북마크 목록 모달 클래스
// 파일 끝 (ImageClozeEditModal 클래스 다음)에 추가
// =====================================================

// =====================================================
// 북마크 목록 모달
// =====================================================
class BookmarkListModal extends Modal {
    constructor(app, plugin) {
        super(app);
        this.plugin = plugin;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('bookmark-list-modal');
        
        // 헤더
        const header = contentEl.createDiv();
        header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;';
        
        header.createEl('h2', { text: `📌 북마크 (${this.plugin.settings.bookmarks.length}개)` }).style.margin = '0';
        
        const btnGroup = header.createDiv();
        btnGroup.style.cssText = 'display: flex; gap: 8px;';
        
        // 북마크 퀴즈 시작
        const quizBtn = btnGroup.createEl('button', { text: '⭐ 퀴즈 시작', cls: 'mod-cta' });
        quizBtn.onclick = () => {
            if (this.plugin.settings.bookmarks.length === 0) {
                new Notice('북마크된 카드가 없습니다');
                return;
            }
            this.close();
            new BookmarkQuizModal(this.app, this.plugin).open();
        };
        
        // 전체 삭제
        const clearBtn = btnGroup.createEl('button', { text: '🗑️ 전체 삭제' });
        clearBtn.style.background = 'var(--background-modifier-error)';
        clearBtn.onclick = async () => {
            if (confirm('모든 북마크를 삭제하시겠습니까?')) {
                this.plugin.settings.bookmarks = [];
                await this.plugin.saveSettings();
                new Notice('✅ 모든 북마크가 삭제되었습니다');
                this.onOpen();
            }
        };
        
        // 북마크가 없으면
        if (this.plugin.settings.bookmarks.length === 0) {
            contentEl.createEl('p', { 
                text: '북마크된 카드가 없습니다. 퀴즈 모드에서 체크박스를 클릭하여 북마크를 추가하세요!',
                cls: 'setting-item-description'
            }).style.cssText = 'padding: 40px 20px; text-align: center;';
            return;
        }
        
        // 북마크 리스트
        const listContainer = contentEl.createDiv();
        listContainer.style.cssText = 'max-height: 60vh; overflow-y: auto; margin-top: 20px;';
        
        this.plugin.settings.bookmarks
            .sort((a, b) => b.timestamp - a.timestamp) // 최신순 정렬
            .forEach((bookmark, index) => {
                const item = listContainer.createDiv({ cls: 'bookmark-item' });
                item.style.cssText = `
                    padding: 16px;
                    margin-bottom: 12px;
                    background: var(--background-primary-alt);
                    border: 2px solid var(--background-modifier-border);
                    border-radius: 8px;
                    transition: all 0.2s;
                `;
                
                // 호버 효과
                item.addEventListener('mouseenter', () => {
                    item.style.borderColor = 'var(--interactive-accent)';
                    item.style.transform = 'translateX(4px)';
                });
                item.addEventListener('mouseleave', () => {
                    item.style.borderColor = 'var(--background-modifier-border)';
                    item.style.transform = 'translateX(0)';
                });
                
                // 헤더
                const itemHeader = item.createDiv();
                itemHeader.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;';
                
                const title = itemHeader.createEl('h4');
                title.textContent = `⭐ ${bookmark.fileName}`;
                title.style.cssText = 'margin: 0; font-size: 16px;';
                
                // 삭제 버튼
                const deleteBtn = itemHeader.createEl('button', { text: '🗑️' });
                deleteBtn.style.cssText = 'padding: 4px 12px; background: var(--background-modifier-error); color: white; border: none; border-radius: 4px; cursor: pointer;';
                deleteBtn.onclick = async () => {
                    // 실제 배열에서 찾아서 삭제
                    const actualIndex = this.plugin.settings.bookmarks.findIndex(
                        b => b.filePath === bookmark.filePath && b.timestamp === bookmark.timestamp
                    );
                    if (actualIndex !== -1) {
                        this.plugin.settings.bookmarks.splice(actualIndex, 1);
                        await this.plugin.saveSettings();
                        new Notice('북마크가 제거되었습니다');
                        this.onOpen();
                    }
                };
                
                // 정보
                const info = item.createDiv();
                info.style.cssText = 'display: flex; gap: 16px; color: var(--text-muted); font-size: 13px; margin-bottom: 12px;';
                
                info.createSpan({ text: `📁 ${bookmark.folderName || 'Unknown'}` });
                info.createSpan({ text: `🎴 Card ${bookmark.cardNumber}` });
                
                const date = new Date(bookmark.timestamp);
                info.createSpan({ text: `📅 ${date.toLocaleDateString('ko-KR')}` });
                
                // 버튼 그룹
                const btnGroup = item.createDiv();
                btnGroup.style.cssText = 'display: flex; gap: 8px;';
                
                // 파일 열기 버튼
                const openBtn = btnGroup.createEl('button', { text: '📖 파일 열기' });
                openBtn.style.cssText = 'flex: 1; padding: 6px 12px; background: var(--interactive-accent); color: var(--text-on-accent); border: none; border-radius: 4px; cursor: pointer;';
                openBtn.onclick = async () => {
                    const file = this.app.vault.getAbstractFileByPath(bookmark.filePath);
                    if (file) {
                        const leaf = this.app.workspace.getLeaf('tab');
                        await leaf.openFile(file);
                        this.close();
                    } else {
                        new Notice('파일을 찾을 수 없습니다');
                    }
                };
                
                // 퀴즈 시작 버튼
                const quizSingleBtn = btnGroup.createEl('button', { text: '🎯 퀴즈' });
                quizSingleBtn.style.cssText = 'flex: 1; padding: 6px 12px; background: var(--background-secondary); border: none; border-radius: 4px; cursor: pointer;';
                quizSingleBtn.onclick = () => {
                    this.close();
                    // 해당 파일의 퀴즈 시작
                    const folderPath = bookmark.filePath.substring(0, bookmark.filePath.lastIndexOf('/'));
                    new QuizModeModal(this.app, this.plugin, folderPath).open();
                };
            });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
