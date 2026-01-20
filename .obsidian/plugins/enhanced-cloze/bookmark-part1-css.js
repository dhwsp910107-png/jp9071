// =====================================================
// Part 1: CSS 스타일 추가
// addStyles() 메서드 안에 추가할 CSS
// =====================================================

// 기존 addStyles() 메서드의 마지막 부분에 아래 CSS를 추가하세요

/* ============================================
   북마크 스타일
   ============================================ */
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

.bookmark-item {
    transition: all 0.2s;
}

.bookmark-item:hover {
    transform: translateX(4px);
}

/* 모바일 대응 */
@media (max-width: 600px) {
    .bookmark-container {
        padding: 10px 12px !important;
        gap: 8px !important;
    }
    
    .bookmark-container input[type="checkbox"] {
        width: 20px !important;
        height: 20px !important;
    }
    
    .bookmark-list-modal {
        max-width: 100vw;
    }
}
