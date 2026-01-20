# 북마크 기능 추가 가이드

## 📌 개요
퀴즈 모드에서 체크박스를 클릭하여 카드를 북마크하고, 북마크된 카드들만 따로 학습할 수 있는 기능입니다.

## 🔧 추가해야 할 코드

### 1. settings에 이미 추가됨 ✅
```javascript
// 북마크 설정 (새로 추가)
bookmarks: [],  // [{ filePath, cardNumber, timestamp, note }]
bookmarkFolder: '📌 북마크'
```

### 2. QuizModeModal에서 displayCurrentNote 메서드 수정

**displayCurrentNote 메서드의 contentDiv 생성 직후에 추가:**

```javascript
async displayCurrentNote(container) {
    // ... 기존 코드 ...
    
    const contentDiv = container.createDiv({ cls: 'quiz-note-content' });
    contentDiv.style.cssText = '...';
    
    // ========== 북마크 체크박스 추가 (여기부터) ==========
    const bookmarkContainer = container.createDiv({ cls: 'bookmark-container' });
    bookmarkContainer.style.cssText = `
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        background: var(--background-primary-alt);
        border-radius: 8px;
        margin-bottom: 16px;
        border: 2px solid var(--background-modifier-border);
    `;
    
    // 현재 카드가 북마크되어 있는지 확인
    const isBookmarked = this.plugin.settings.bookmarks.some(
        b => b.filePath === this.currentFile.path && b.cardNumber === this.currentCardNumber
    );
    
    // 체크박스
    const checkbox = bookmarkContainer.createEl('input', { type: 'checkbox' });
    checkbox.checked = isBookmarked;
    checkbox.style.cssText = `
        width: 24px;
        height: 24px;
        cursor: pointer;
        accent-color: var(--interactive-accent);
    `;
    
    // 라벨
    const label = bookmarkContainer.createEl('label');
    label.style.cssText = `
        cursor: pointer;
        font-weight: 600;
        font-size: 15px;
        user-select: none;
        flex: 1;
    `;
    label.textContent = isBookmarked ? '⭐ 북마크됨' : '☆ 북마크하기';
    
    // 북마크 개수 표시
    const countBadge = bookmarkContainer.createEl('span');
    countBadge.style.cssText = `
        background: var(--interactive-accent);
        color: var(--text-on-accent);
        padding: 4px 12px;
        border-radius: 12px;
        font-size: 13px;
        font-weight: bold;
    `;
    countBadge.textContent = `${this.plugin.settings.bookmarks.length}개`;
    
    // 체크박스 토글 이벤트
    const toggleBookmark = async () => {
        const currentlyBookmarked = checkbox.checked;
        
        if (currentlyBookmarked) {
            // 북마크 추가
            const bookmark = {
                filePath: this.currentFile.path,
                fileName: this.currentFile.basename,
                cardNumber: this.currentCardNumber,
                folderName: this.currentFolderName,
                timestamp: Date.now(),
                note: '' // 사용자가 나중에 추가할 수 있는 메모
            };
            
            this.plugin.settings.bookmarks.push(bookmark);
            label.textContent = '⭐ 북마크됨';
            new Notice('⭐ 북마크에 추가되었습니다!');
        } else {
            // 북마크 제거
            this.plugin.settings.bookmarks = this.plugin.settings.bookmarks.filter(
                b => !(b.filePath === this.currentFile.path && b.cardNumber === this.currentCardNumber)
            );
            label.textContent = '☆ 북마크하기';
            new Notice('북마크가 제거되었습니다');
        }
        
        // 개수 업데이트
        countBadge.textContent = `${this.plugin.settings.bookmarks.length}개`;
        
        await this.plugin.saveSettings();
    };
    
    checkbox.onclick = toggleBookmark;
    checkbox.addEventListener('touchend', (e) => {
        e.preventDefault();
        checkbox.checked = !checkbox.checked;
        toggleBookmark();
    });
    
    label.onclick = () => {
        checkbox.checked = !checkbox.checked;
        toggleBookmark();
    };
    // ========== 북마크 체크박스 끝 ==========
    
    // ... 나머지 기존 코드 계속 ...
}
```

### 3. 메뉴에 북마크 관리 추가

**메뉴 버튼의 onClick 이벤트에 추가:**

```javascript
// 메뉴 버튼 클릭 시 (기존 menu.addItem 다음에 추가)
menu.addSeparator();

// 북마크 보기
menu.addItem((item) => {
    item.setTitle(`📌 북마크 보기 (${this.plugin.settings.bookmarks.length}개)`)
        .setIcon('bookmark')
        .onClick(() => {
            new BookmarkListModal(this.app, this.plugin).open();
        });
});

// 북마크 퀴즈 시작
menu.addItem((item) => {
    item.setTitle('⭐ 북마크 퀴즈 시작')
        .setIcon('star')
        .onClick(() => {
            if (this.plugin.settings.bookmarks.length === 0) {
                new Notice('북마크된 카드가 없습니다');
                return;
            }
            this.close();
            new BookmarkQuizModal(this.app, this.plugin).open();
        });
});
```

### 4. 북마크 목록 모달 추가

**파일 끝에 새 클래스 추가:**

```javascript
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
        
        this.plugin.settings.bookmarks.forEach((bookmark, index) => {
            const item = listContainer.createDiv();
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
                this.plugin.settings.bookmarks.splice(index, 1);
                await this.plugin.saveSettings();
                new Notice('북마크가 제거되었습니다');
                this.onOpen();
            };
            
            // 정보
            const info = item.createDiv();
            info.style.cssText = 'display: flex; gap: 16px; color: var(--text-muted); font-size: 13px;';
            
            info.createSpan({ text: `📁 ${bookmark.folderName || 'Unknown'}` });
            info.createSpan({ text: `🎴 Card ${bookmark.cardNumber}` });
            
            const date = new Date(bookmark.timestamp);
            info.createSpan({ text: `📅 ${date.toLocaleDateString('ko-KR')}` });
            
            // 파일 열기 버튼
            const openBtn = item.createEl('button', { text: '📖 파일 열기' });
            openBtn.style.cssText = 'margin-top: 12px; padding: 6px 12px; background: var(--interactive-accent); color: var(--text-on-accent); border: none; border-radius: 4px; cursor: pointer; width: 100%;';
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
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// =====================================================
// 북마크 퀴즈 모달
// =====================================================
class BookmarkQuizModal extends QuizModeModal {
    constructor(app, plugin) {
        super(app, plugin, null);
        this.isBookmarkMode = true;
    }

    async loadNotes() {
        // 북마크된 파일들만 로드
        const bookmarkedPaths = [...new Set(this.plugin.settings.bookmarks.map(b => b.filePath))];
        
        this.notes = [];
        for (const path of bookmarkedPaths) {
            const file = this.app.vault.getAbstractFileByPath(path);
            if (file) {
                this.notes.push(file);
            }
        }
        
        console.log(`📌 북마크 퀴즈: ${this.notes.length}개 노트 로드됨`);
        
        if (this.notes.length === 0) {
            new Notice('⚠️ 북마크된 파일이 없습니다');
        }
        
        // 랜덤 섞기
        this.notes.sort(() => Math.random() - 0.5);
    }

    async onOpen() {
        await super.onOpen();
        
        // 제목 변경
        const header = this.contentEl.querySelector('h2');
        if (header) {
            header.textContent = '⭐ 북마크 퀴즈 모드';
        }
    }
}
```

### 5. CSS 스타일 추가

**addStyles() 메서드에 추가:**

```javascript
/* 북마크 스타일 */
.bookmark-container {
    transition: all 0.2s;
}

.bookmark-container:hover {
    border-color: var(--interactive-accent) !important;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.bookmark-container input[type="checkbox"] {
    transform: scale(1.2);
}

.bookmark-list-modal {
    max-width: 700px;
}

@media (max-width: 600px) {
    .bookmark-container {
        padding: 10px 12px !important;
        gap: 8px !important;
    }
    
    .bookmark-container input[type="checkbox"] {
        width: 20px !important;
        height: 20px !important;
    }
}
```

## 📝 사용 방법

1. **북마크 추가**: 퀴즈 모드에서 카드 상단의 체크박스 클릭
2. **북마크 보기**: 메뉴 버튼(☰) → "📌 북마크 보기"
3. **북마크 퀴즈**: 메뉴 버튼(☰) → "⭐ 북마크 퀴즈 시작"
4. **북마크 삭제**: 북마크 목록에서 🗑️ 버튼 클릭

## 🎯 기능 설명

- ✅ 퀴즈 중 중요한 카드를 북마크하여 표시
- ✅ 북마크된 카드만 모아서 집중 학습 가능
- ✅ 북마크 목록에서 파일 바로 열기
- ✅ 북마크 개수 실시간 표시
- ✅ 전체 북마크 삭제 기능
- ✅ 모바일 최적화

## 📌 다음 단계

이 코드들을 main.js의 적절한 위치에 추가하면 북마크 기능이 완성됩니다!
