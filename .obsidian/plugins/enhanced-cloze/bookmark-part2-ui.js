// =====================================================
// Part 2: QuizModeModal - 북마크 체크박스 UI 추가
// displayCurrentNote() 메서드 수정
// =====================================================

/*
기존 displayCurrentNote() 메서드에서
const contentDiv = container.createDiv({ cls: 'quiz-note-content' }); 
바로 다음에 아래 코드를 추가하세요
*/

// ========== 북마크 체크박스 추가 시작 ==========

// 북마크 컨테이너
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

// ========== 북마크 체크박스 추가 끝 ==========

// 이 다음에 기존 contentDiv 관련 코드 계속...
