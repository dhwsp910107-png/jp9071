// =====================================================
// Part 3: 메뉴에 북마크 항목 추가
// QuizModeModal의 메뉴 버튼 onClick 이벤트에 추가
// =====================================================

/*
메뉴 버튼(☰)의 onClick 이벤트에서
기존 menu.addItem() 들 뒤에 아래 코드를 추가하세요
*/

// 북마크 관련 메뉴
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

// 북마크 내보내기
menu.addItem((item) => {
    item.setTitle('📤 북마크 내보내기')
        .setIcon('download')
        .onClick(() => {
            this.plugin.exportBookmarks();
        });
});
