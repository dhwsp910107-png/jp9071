// =====================================================
// Part 6: 플러그인 클래스에 북마크 메서드 추가
// EnhancedClozePlugin 클래스 안에 추가
// =====================================================

/*
EnhancedClozePlugin 클래스의 메서드들 사이에 아래 메서드들을 추가하세요
(예: saveSettings() 메서드 다음)
*/

// 북마크 내보내기
async exportBookmarks() {
    if (this.settings.bookmarks.length === 0) {
        new Notice('북마크가 없습니다');
        return;
    }
    
    const exportData = {
        exportDate: new Date().toISOString(),
        totalBookmarks: this.settings.bookmarks.length,
        bookmarks: this.settings.bookmarks.map(b => ({
            fileName: b.fileName,
            folderName: b.folderName,
            cardNumber: b.cardNumber,
            date: new Date(b.timestamp).toLocaleString('ko-KR'),
            note: b.note || ''
        }))
    };
    
    const jsonStr = JSON.stringify(exportData, null, 2);
    
    // 클립보드에 복사
    try {
        await navigator.clipboard.writeText(jsonStr);
        new Notice('📋 북마크가 클립보드에 복사되었습니다!');
    } catch (e) {
        // 클립보드 실패 시 파일로 저장
        const fileName = `bookmarks-${Date.now()}.json`;
        const filePath = `${this.settings.clozeFolder}/${fileName}`;
        await this.app.vault.create(filePath, jsonStr);
        new Notice(`📄 북마크가 ${fileName}로 저장되었습니다`);
    }
}

// 북마크 가져오기 (JSON 파일에서)
async importBookmarks(jsonStr) {
    try {
        const data = JSON.parse(jsonStr);
        
        if (!data.bookmarks || !Array.isArray(data.bookmarks)) {
            new Notice('❌ 올바른 북마크 파일이 아닙니다');
            return;
        }
        
        // 기존 북마크에 추가 (중복 제거)
        let addedCount = 0;
        
        for (const bookmark of data.bookmarks) {
            // 중복 체크
            const exists = this.settings.bookmarks.some(
                b => b.filePath === bookmark.filePath && b.cardNumber === bookmark.cardNumber
            );
            
            if (!exists) {
                this.settings.bookmarks.push(bookmark);
                addedCount++;
            }
        }
        
        await this.saveSettings();
        new Notice(`✅ ${addedCount}개의 북마크가 추가되었습니다`);
        
    } catch (e) {
        console.error('북마크 가져오기 실패:', e);
        new Notice('❌ 북마크 가져오기 실패');
    }
}

// 북마크 통계
getBookmarkStats() {
    const stats = {
        total: this.settings.bookmarks.length,
        byFolder: {},
        recent: []
    };
    
    // 폴더별 개수
    this.settings.bookmarks.forEach(b => {
        const folder = b.folderName || 'Unknown';
        stats.byFolder[folder] = (stats.byFolder[folder] || 0) + 1;
    });
    
    // 최근 7일
    const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    stats.recent = this.settings.bookmarks.filter(b => b.timestamp > weekAgo);
    
    return stats;
}
