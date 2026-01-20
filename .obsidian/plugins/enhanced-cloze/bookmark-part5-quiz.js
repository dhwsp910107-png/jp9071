// =====================================================
// Part 5: 북마크 퀴즈 모달 클래스
// BookmarkListModal 클래스 다음에 추가
// =====================================================

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
        
        // 북마크 개수 표시
        const progress = this.contentEl.querySelector('.quiz-progress');
        if (progress) {
            progress.style.cssText = 'font-size: 14px; color: var(--color-yellow);';
        }
    }
}
