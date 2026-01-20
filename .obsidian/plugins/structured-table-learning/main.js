// ============================================
// 구조화된 표 학습 플러그인 - Part 1/3 (수정판)
// 챕터당 블록 9개 | 100단위 건너뛰기 | 과목별 폴더
// ============================================

const obsidian = require("obsidian");

const DEFAULT_SETTINGS = {
    studyFolder: "Study",
    dashboardFolder: "Dashboard",
    enableNotifications: true,
    blocksPerPage: 3,
    showDashboardOnStartup: false,
    enableTouchPreview: true,
    enableStatusColors: true
};

const PLUGIN_STYLES = `
.structured-learning-plugin {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.structured-learning-plugin .chapter-header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 20px;
    border-radius: 12px;
    text-align: center;
    font-weight: bold;
    font-size: 1.3em;
    margin: 30px 0 20px 0;
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

/* 모바일 터치 미리보기 스타일 */
.structured-learning-plugin .cell-preview {
    position: absolute;
    background: var(--background-primary);
    border: 2px solid var(--accent-color);
    border-radius: 8px;
    padding: 15px;
    max-width: 300px;
    box-shadow: 0 8px 25px rgba(0,0,0,0.2);
    z-index: 1000;
    display: none;
    font-size: 0.9em;
    transform: translateY(-100%);
    margin-top: -10px;
}

.structured-learning-plugin .cell-preview.mobile-preview {
    position: fixed !important;
    background: var(--background-primary);
    border: 3px solid var(--accent-color);
    border-radius: 12px;
    padding: 20px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
    z-index: 9999 !important;
    font-size: 1em;
    transform: none;
    margin: 0;
    max-height: 70vh;
    overflow-y: auto;
}

.structured-learning-plugin .cell-preview::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    border: 8px solid transparent;
    border-top-color: var(--accent-color);
    transform: translateX(-50%);
}

.structured-learning-plugin .cell-preview.mobile-preview::after {
    display: none;
}

.structured-learning-plugin .cell-preview h4 {
    margin: 0 0 8px 0;
    color: var(--accent-color);
    font-size: 1.1em;
}

.structured-learning-plugin .cell-preview p {
    margin: 0;
    color: var(--text-muted);
    line-height: 1.4;
}

.structured-learning-plugin .block-header {
    background: linear-gradient(90deg, #4facfe 0%, #00f2fe 100%);
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-weight: 600;
    margin: 15px 0 10px 0;
    box-shadow: 0 2px 6px rgba(79, 172, 254, 0.3);
}

.structured-learning-plugin table {
    width: 100%;
    border-collapse: collapse;
    margin: 15px 0;
    background: var(--background-primary);
    border: 2px solid var(--background-modifier-border);
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.structured-learning-plugin td, 
.structured-learning-plugin th {
    border: 1px solid var(--background-modifier-border);
    padding: 12px 8px;
    text-align: center;
    transition: all 0.2s;
    font-size: 0.9em;
}

.structured-learning-plugin th {
    background: var(--background-secondary);
    color: var(--text-accent);
    font-weight: bold;
}

.structured-learning-plugin td {
    background: var(--background-secondary);
    position: relative;
}

/* 상태별 색상 시스템 */
.structured-learning-plugin td.cell-completed {
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: white;
    font-weight: bold;
}

.structured-learning-plugin td.cell-in-progress {
    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
    color: white;
    font-weight: bold;
}

.structured-learning-plugin td.cell-not-started {
    background: var(--background-secondary);
    color: var(--text-muted);
}

.structured-learning-plugin td:hover,
.structured-learning-plugin td:active {
    background: var(--interactive-hover);
    transform: scale(1.05);
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
    z-index: 100;
}

/* 모바일 터치 최적화 */
@media (max-width: 768px) {
    .structured-learning-plugin td {
        padding: 16px 8px;
        font-size: 0.8em;
        min-height: 44px;
    }
    
    .structured-learning-plugin .cell-preview {
        max-width: 250px;
        font-size: 0.8em;
        padding: 12px;
    }
}

.structured-learning-plugin .page-break {
    page-break-after: always;
    margin: 40px 0;
    border-bottom: 3px dashed var(--background-modifier-border);
}

.structured-learning-plugin .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 15px;
    margin: 20px 0;
}

.structured-learning-plugin .stat-card {
    background: var(--background-secondary);
    padding: 20px;
    border-radius: 10px;
    text-align: center;
    border: 2px solid var(--background-modifier-border);
    box-shadow: 0 2px 6px rgba(0,0,0,0.1);
}

.structured-learning-plugin .stat-card h3 {
    font-size: 2em;
    color: var(--text-accent);
    margin: 0;
}

.structured-learning-plugin .stat-card p {
    color: var(--text-muted);
    font-size: 0.85em;
    margin: 5px 0 0 0;
}

/* 모바일 설정 탭 최적화 */
.structured-learning-plugin .setting-item {
    padding: 15px 0;
    border-bottom: 1px solid var(--background-modifier-border);
}

.structured-learning-plugin .setting-item-name {
    font-weight: 600;
    color: var(--text-normal);
    margin-bottom: 8px;
    font-size: 1.1em;
}

.structured-learning-plugin .setting-item-description {
    color: var(--text-muted);
    font-size: 0.9em;
    margin-top: 5px;
    line-height: 1.4;
}

.structured-learning-plugin .setting-item-control {
    width: 100%;
    padding: 10px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    background: var(--background-primary);
    color: var(--text-normal);
    font-size: 1em;
}

/* 모바일에서 버튼 크기 증대 */
@media (max-width: 768px) {
    .structured-learning-plugin .mod-cta {
        padding: 15px 25px;
        font-size: 1.1em;
        width: 100%;
        margin-top: 10px;
    }
    
    .structured-learning-plugin .setting-item-control {
        padding: 12px;
        font-size: 1.1em;
    }
    
    .structured-learning-plugin table {
        font-size: 0.8em;
        -webkit-overflow-scrolling: touch;
        overflow-x: auto;
    }
    
    .structured-learning-plugin .block-header {
        position: sticky;
        top: 0;
        z-index: 10;
    }
}

/* 스와이프 제스처 지원 */
.structured-learning-plugin .table-container {
    touch-action: pan-x;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
}

/* 상태 아이콘 애니메이션 */
.structured-learning-plugin .cell-completed {
    animation: pulse-green 0.5s ease-in-out;
}

.structured-learning-plugin .cell-in-progress {
    animation: pulse-orange 0.5s ease-in-out;
}

@keyframes pulse-green {
    0% { transform: scale(1); }
    50% { transform: scale(1.05); }
    100% { transform: scale(1); }
}

@keyframes pulse-orange {
    0% { transform: scale(1); }
    50% { transform: scale(1.05); }
    100% { transform: scale(1); }
}
`;

class StructuredTableLearningPlugin extends obsidian.Plugin {
    async onload() {
        console.log("🚀 구조화된 표 학습 플러그인 로딩 시작");
        
        try {
            this.addStyles();
            await this.loadSettings();
            
            // 설정 탭 추가
            this.addSettingTab(new StructuredTableSettingTab(this.app, this));
            console.log("✅ 설정 탭 추가 완료");
            
            // 리본 아이콘 추가
            this.addRibbonIcon('layout-dashboard', '학습 대시보드', () => {
                console.log("대시보드 아이콘 클릭됨");
                this.openDashboard();
            });

            this.addRibbonIcon('settings', '플러그인 설정', () => {
                console.log("설정 아이콘 클릭됨");
                this.openPluginSettings();
            });
            console.log("✅ 리본 아이콘 추가 완료");
            
            // 명령어 등록
            this.registerCommands();
            console.log("✅ 명령어 등록 완료");
            
            // 이벤트 시스템 초기화 (지연 실행)
            setTimeout(() => {
                this.initializeEventSystems();
            }, 1000);

            if (this.settings.showDashboardOnStartup) {
                this.app.workspace.onLayoutReady(() => {
                    setTimeout(() => this.openDashboard(), 2000);
                });
            }

            console.log("🎉 플러그인 로딩 완료");
            new obsidian.Notice("📊 구조화된 표 학습 플러그인 활성화");
            
        } catch (error) {
            console.error("❌ 플러그인 로딩 중 오류:", error);
            new obsidian.Notice("플러그인 로딩 실패: " + error.message);
        }
    }

    registerCommands() {
        this.addCommand({
            id: "open-settings",
            name: "⚙️ 플러그인 설정 열기",
            callback: () => {
                console.log("설정 명령어 실행");
                this.openPluginSettings();
            }
        });

        this.addCommand({
            id: "open-dashboard",
            name: "📊 학습 대시보드 열기",
            callback: () => {
                console.log("대시보드 명령어 실행");
                this.openDashboard();
            }
        });
        
        this.addCommand({
            id: "create-structured-table", 
            name: "📋 구조화된 학습표 생성",
            callback: () => {
                console.log("학습표 생성 명령어 실행");
                new CreateStructuredTableModal(this.app, this.settings, (data) => {
                    this.createStructuredTable(data);
                }).open();
            }
        });

        this.addCommand({
            id: "create-learning-cell",
            name: "📌 학습셀 생성", 
            callback: () => {
                console.log("학습셀 생성 명령어 실행");
                new CreateLearningCellModal(this.app, this.settings, (data) => {
                    this.createLearningCell(data);
                }).open();
            }
        });

        this.addCommand({
            id: "create-subject-dashboard",
            name: "📊 과목별 대시보드 생성",
            callback: () => {
                console.log("과목별 대시보드 생성 명령어 실행");
                new CreateSubjectDashboardModal(this.app, this.settings, (data) => {
                    this.createSubjectDashboard(data);
                }).open();
            }
        });
    }

    initializeEventSystems() {
        try {
            console.log("🔧 이벤트 시스템 초기화 시작");
            
            // 터치 이벤트 리스너 등록
            this.registerTouchEvents();
            console.log("✅ 터치 이벤트 등록 완료");
            
            // 상태 색상 시스템 초기화
            this.initializeStatusColorSystem();
            console.log("✅ 상태 색상 시스템 초기화 완료");
            
            // 체크박스 모니터링 시스템 초기화
            this.initializeCheckboxMonitoring();
            console.log("✅ 체크박스 모니터링 시스템 초기화 완료");
            
            // 대시보드 이벤트 리스너 등록
            this.registerDashboardEvents();
            console.log("✅ 대시보드 이벤트 등록 완료");
            
            console.log("🎉 모든 이벤트 시스템 초기화 완료");
            
        } catch (error) {
            console.error("❌ 이벤트 시스템 초기화 오류:", error);
        }
    }

    onunload() {
        console.log("플러그인 언로딩");
        const styleEl = document.getElementById('structured-learning-plugin-styles');
        if (styleEl) {
            styleEl.remove();
        }
        this.unregisterTouchEvents();
        this.unregisterDashboardEvents();
        
        // 체크박스 핸들러 정리
        if (this.checkboxHandler) {
            document.removeEventListener('change', this.checkboxHandler, true);
            document.removeEventListener('click', this.checkboxHandler, true);
        }
        
        // 상태 색상 시스템 정리
        if (this.statusColorObserver) {
            this.statusColorObserver.disconnect();
        }
        
        // 타이머들 정리
        if (this.previewTimer) {
            clearTimeout(this.previewTimer);
        }
        if (this.colorUpdateTimer) {
            clearTimeout(this.colorUpdateTimer);
        }
        if (this.periodicUpdate) {
            clearInterval(this.periodicUpdate);
        }
        
        // 미리보기 정리
        this.hideCellPreview();
    }

    registerTouchEvents() {
        try {
            console.log("🔧 터치 이벤트 등록 시작");
            
            // 기존 이벤트 제거
            this.unregisterTouchEvents();
            
            // 터치 앤 홀드를 위한 변수들 초기화
            this.touchTimer = null;
            this.isLongTouch = false;
            this.touchStartTime = 0;
            this.currentTouchTarget = null;
            
            // 이벤트 핸들러 바인딩
            this.touchStartHandler = this.handleTouchStart.bind(this);
            this.touchEndHandler = this.handleTouchEnd.bind(this);
            this.touchMoveHandler = this.handleTouchMove.bind(this);
            
            // 이벤트 등록 (간단하게 터치와 마우스만)
            document.addEventListener('touchstart', this.touchStartHandler, { passive: false });
            document.addEventListener('touchend', this.touchEndHandler, { passive: false });
            document.addEventListener('touchmove', this.touchMoveHandler, { passive: false });
            
            // 데스크톱 마우스 이벤트도 지원
            document.addEventListener('mousedown', this.touchStartHandler, { passive: false });
            document.addEventListener('mouseup', this.touchEndHandler, { passive: false });
            document.addEventListener('mousemove', this.touchMoveHandler, { passive: false });
            
            console.log("✅ 터치 이벤트 등록 완료");
            
            // 테스트 알림
            setTimeout(() => {
                new obsidian.Notice("🎯 터치 이벤트 시스템 활성화됨");
            }, 2000);
            
        } catch (error) {
            console.error("❌ 터치 이벤트 등록 실패:", error);
        }
    }

    unregisterTouchEvents() {
        if (this.touchStartHandler) {
            if ('PointerEvent' in window) {
                document.removeEventListener('pointerdown', this.touchStartHandler);
                document.removeEventListener('pointerup', this.touchEndHandler);
                document.removeEventListener('pointermove', this.touchMoveHandler);
            } else {
                document.removeEventListener('touchstart', this.touchStartHandler);
                document.removeEventListener('touchend', this.touchEndHandler);
                document.removeEventListener('touchmove', this.touchMoveHandler);
                document.removeEventListener('mousedown', this.touchStartHandler);
                document.removeEventListener('mouseup', this.touchEndHandler);
                document.removeEventListener('mousemove', this.touchMoveHandler);
            }
        }
        
        if (this.tableObserver) {
            this.tableObserver.disconnect();
        }
        
        // 터치 타이머 정리
        if (this.touchTimer) {
            clearTimeout(this.touchTimer);
            this.touchTimer = null;
        }
    }

    handleTouchStart(event) {
        try {
            const target = event.target;
            console.log("👆 터치 시작:", target.tagName, target.textContent?.substring(0, 20));
            
            // 구조화된 표의 셀인지 확인
            if (target.tagName === 'TD' && 
                target.closest('.structured-learning-plugin') &&
                target.textContent && 
                target.textContent.includes('[[')) {
                
                console.log("✅ 유효한 셀 터치 감지");
                
                this.touchStartTime = Date.now();
                this.isLongTouch = false;
                this.currentTouchTarget = target;
                
                // 터치 피드백
                target.style.backgroundColor = 'rgba(102, 126, 234, 0.2)';
                
                // 기존 타이머가 있으면 정리
                if (this.touchTimer) {
                    clearTimeout(this.touchTimer);
                }
                
                // 500ms 후 롱터치로 인식
                this.touchTimer = setTimeout(() => {
                    if (this.currentTouchTarget === target) {
                        this.isLongTouch = true;
                        this.handleLongTouch(target);
                    }
                }, 500);
                
                console.log('🔄 롱터치 타이머 시작');
            }
            
        } catch (error) {
            console.error("❌ 터치 시작 핸들러 오류:", error);
        }
    }

    handleTouchMove(event) {
        try {
            // 터치가 움직이면 롱터치 취소
            if (this.touchTimer) {
                clearTimeout(this.touchTimer);
                this.touchTimer = null;
                console.log("🚫 터치 이동으로 롱터치 취소");
            }
            
            if (this.currentTouchTarget) {
                this.currentTouchTarget.style.backgroundColor = '';
                this.currentTouchTarget = null;
            }
            
        } catch (error) {
            console.error("❌ 터치 이동 핸들러 오류:", error);
        }
    }

    handleTouchEnd(event) {
        try {
            console.log("🔚 터치 종료");
            
            if (this.touchTimer) {
                clearTimeout(this.touchTimer);
                this.touchTimer = null;
            }
            
            if (this.currentTouchTarget) {
                this.currentTouchTarget.style.backgroundColor = '';
                
                // 짧은 터치인 경우 미리보기 숨김
                if (!this.isLongTouch) {
                    console.log('⚡ 짧은 터치 - 미리보기 숨김');
                    this.hideCellPreview();
                }
                
                this.currentTouchTarget = null;
            }
            
            // 롱터치가 아닌 경우 미리보기 숨김
            if (!this.isLongTouch) {
                this.hideCellPreview();
            }
            
            this.isLongTouch = false;
            
        } catch (error) {
            console.error("❌ 터치 종료 핸들러 오류:", error);
        }
    }

    async handleLongTouch(target) {
        try {
            console.log('🔥 롱터치 감지 - 미리보기 표시 시작');
            
            const linkMatch = target.textContent.match(/\[\[([^\]]+)\]\]/);
            if (linkMatch) {
                const fileName = linkMatch[1];
                console.log("📄 파일명:", fileName);
                
                // 진동 피드백 (지원되는 기기에서)
                if (navigator.vibrate) {
                    navigator.vibrate(50);
                }
                
                // 강한 터치 피드백
                target.style.backgroundColor = 'rgba(102, 126, 234, 0.4)';
                setTimeout(() => {
                    if (target.style) {
                        target.style.backgroundColor = 'rgba(102, 126, 234, 0.2)';
                    }
                }, 100);
                
                await this.showCellPreview(target, fileName);
            }
            
        } catch (error) {
            console.error("❌ 롱터치 핸들러 오류:", error);
        }
    }

    async showCellPreview(element, fileName) {
        // 기존 미리보기 제거
        this.hideCellPreview();
        
        try {
            console.log('미리보기 생성 시작:', fileName);
            
            // 파일 경로 추정 - 더 넓은 범위로 검색
            let fileContent = null;
            let actualFile = null;
            
            // 모든 마크다운 파일에서 검색
            const allFiles = this.app.vault.getMarkdownFiles();
            console.log('전체 파일 수:', allFiles.length);
            
            for (const file of allFiles) {
                if (file.path.includes(fileName) || 
                    file.name.includes(fileName) ||
                    file.basename === fileName) {
                    actualFile = file;
                    fileContent = await this.app.vault.read(file);
                    console.log('파일 발견:', file.path);
                    break;
                }
            }
            
            if (!fileContent) {
                // 파일이 없으면 기본 정보 표시
                fileContent = `# ${fileName}\n\n아직 생성되지 않은 학습셀입니다.\n터치하여 생성하세요.`;
                console.log('파일 없음, 기본 내용 사용');
            }
            
            // 미리보기 생성
            const preview = document.createElement('div');
            preview.className = 'cell-preview mobile-preview';
            preview.innerHTML = this.formatPreviewContent(fileName, fileContent);
            
            // 모바일에 최적화된 위치 계산
            const rect = element.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            
            // 화면 중앙에 표시 (모바일에서 더 보기 좋음)
            const previewWidth = Math.min(300, viewportWidth - 40);
            const left = Math.max(20, (viewportWidth - previewWidth) / 2);
            const top = Math.max(20, rect.top - 150);
            
            preview.style.position = 'fixed';
            preview.style.left = `${left}px`;
            preview.style.top = `${top}px`;
            preview.style.width = `${previewWidth}px`;
            preview.style.display = 'block';
            preview.style.zIndex = '9999';
            
            document.body.appendChild(preview);
            this.currentPreview = preview;
            
            console.log('미리보기 표시 완료');
            
            // 롱터치 미리보기는 터치를 떼면 바로 사라짐 (자동 타이머 없음)
            
        } catch (error) {
            console.error('미리보기 생성 오류:', error);
            // 오류 발생 시 간단한 알림 표시
            const errorPreview = document.createElement('div');
            errorPreview.className = 'cell-preview mobile-preview';
            errorPreview.innerHTML = `<h4>⚠️ 오류</h4><p>미리보기를 불러올 수 없습니다.</p>`;
            errorPreview.style.position = 'fixed';
            errorPreview.style.left = '50%';
            errorPreview.style.top = '50%';
            errorPreview.style.transform = 'translate(-50%, -50%)';
            errorPreview.style.display = 'block';
            errorPreview.style.zIndex = '9999';
            
            document.body.appendChild(errorPreview);
            this.currentPreview = errorPreview;
            
            setTimeout(() => this.hideCellPreview(), 2000);
        }
    }

    formatPreviewContent(fileName, content) {
        // 마크다운 내용을 간단히 파싱
        const lines = content.split('\n');
        let title = fileName;
        let description = '';
        let status = '시작안함';
        
        for (const line of lines) {
            if (line.startsWith('# ')) {
                title = line.substring(2);
            } else if (line.includes('- [x]')) {
                if (line.includes('복습 완료')) {
                    status = '완료';
                } else if (line.includes('개념 이해')) {
                    status = '진행중';
                }
            } else if (line.includes('## 💡 핵심 개념')) {
                const nextLineIndex = lines.indexOf(line) + 1;
                if (nextLineIndex < lines.length && lines[nextLineIndex].trim()) {
                    description = lines[nextLineIndex].trim();
                }
            }
        }
        
        const statusColor = status === '완료' ? '#10b981' : status === '진행중' ? '#f59e0b' : '#6b7280';
        
        return `
            <h4>${title}</h4>
            <p style="color: ${statusColor}; font-weight: bold;">📊 ${status}</p>
            <p>${description || '아직 내용이 없습니다.'}</p>
        `;
    }

    hideCellPreview() {
        if (this.currentPreview) {
            this.currentPreview.remove();
            this.currentPreview = null;
        }
        if (this.previewTimer) {
            clearTimeout(this.previewTimer);
            this.previewTimer = null;
        }
    }

    // 디바운스 함수 추가 (중복 실행 방지)
    debounceUpdateColors() {
        if (this.colorUpdateTimer) {
            clearTimeout(this.colorUpdateTimer);
        }
        this.colorUpdateTimer = setTimeout(() => {
            this.updateTableCellColors();
        }, 1000); // 500ms → 1000ms로 증가
    }

    initializeStatusColorSystem() {
        console.log('🎨 상태 색상 시스템 초기화');
        
        // 업데이트 실행 중 플래그
        this.isUpdatingColors = false;
        
        // 체크박스 실시간 감지 시스템
        this.initializeCheckboxMonitoring();
        
        // DOM 변경 감지 - 테이블 영역만 감시하도록 최적화
        this.statusColorObserver = new MutationObserver((mutations) => {
            // 테이블 관련 변경만 감지
            const hasTableChange = mutations.some(mutation => {
                const target = mutation.target;
                return target.nodeType === 1 && (
                    target.tagName === 'TABLE' ||
                    target.closest?.('table') ||
                    target.querySelector?.('table') ||
                    target.classList?.contains('structured-learning-plugin')
                );
            });
            
            if (hasTableChange) {
                this.debounceUpdateColors();
            }
        });

        // 특정 컨테이너만 감시 (전체 document 대신)
        const observeTarget = document.querySelector('.workspace-leaf-content') || document.body;
        this.statusColorObserver.observe(observeTarget, {
            childList: true,
            subtree: true,
            attributeFilter: ['class']
        });

        // 초기 색상 업데이트
        setTimeout(() => {
            this.updateTableCellColors();
        }, 2000);
        
        // 주기적 업데이트 제거 (불필요한 반복 방지)
        // this.periodicUpdate = setInterval(() => {
        //     this.updateTableCellColors();
        // }, 30000);
        
        console.log('✅ 상태 색상 시스템 초기화 완료');
    }

    initializeCheckboxMonitoring() {
        console.log('📋 체크박스 모니터링 시작');
        
        // 체크박스 클릭 이벤트 감지 (change 이벤트만 사용)
        this.checkboxHandler = (event) => {
            const target = event.target;
            
            if (target.type === 'checkbox' && 
                target.closest('.task-list-item')) {
                console.log('✅ 체크박스 클릭 감지');
                
                // 디바운스를 사용하여 중복 호출 방지
                this.debounceUpdateColors();
                new obsidian.Notice('📊 학습 상태가 업데이트되었습니다!');
            }
        };
        
        // change 이벤트만 사용 (click 제거로 중복 방지)
        document.addEventListener('change', this.checkboxHandler, true);
        
        // 파일 저장 이벤트는 디바운스 적용
        this.registerEvent(
            this.app.vault.on('modify', (file) => {
                if (file.extension === 'md') {
                    console.log('📝 파일 수정 감지:', file.name);
                    this.debounceUpdateColors();
                }
            })
        );
    }

    async updateTableCellColors() {
        // 중복 실행 방지
        if (this.isUpdatingColors) {
            console.log('⏭️ 색상 업데이트 이미 진행 중, 건너뜀');
            return;
        }
        
        if (!this.settings.enableStatusColors) {
            console.log('상태 색상 시스템 비활성화됨');
            return;
        }

        this.isUpdatingColors = true;
        
        try {
            console.log('테이블 셀 색상 업데이트 시작');
            const tables = document.querySelectorAll('.structured-learning-plugin table');
            
            if (tables.length === 0) {
                console.log('⚠️ 테이블을 찾을 수 없음 - 업데이트 건너뜀');
                return;
            }
            
            console.log('발견된 테이블 수:', tables.length);
            
            for (const table of tables) {
                const cells = table.querySelectorAll('td');
                console.log('테이블 내 셀 수:', cells.length);
                
                for (const cell of cells) {
                    const linkMatch = cell.textContent.match(/\[\[([^\]]+)\]\]/);
                    if (linkMatch) {
                        const fileName = linkMatch[1];
                        const status = await this.getCellStatus(fileName);
                        this.applyCellStatus(cell, status);
                        console.log(`셀 상태 업데이트: ${fileName} -> ${status}`);
                    }
                }
            }
            console.log('테이블 셀 색상 업데이트 완료');
        } finally {
            this.isUpdatingColors = false;
        }
    }

    async getCellStatus(fileName) {
        try {
            console.log("🔍 셀 상태 확인:", fileName);
            
            // 파일 찾기 - 더 정확한 매칭
            const files = this.app.vault.getMarkdownFiles().filter(file => 
                file.path.includes(fileName) || 
                file.name.includes(fileName) ||
                file.basename === fileName ||
                file.name === fileName + '.md'
            );
            
            if (files.length === 0) {
                console.log("📄 파일 없음:", fileName);
                return 'not-started';
            }
            
            const file = files[0];
            const content = await this.app.vault.read(file);
            console.log("📖 파일 내용 길이:", content.length);
            
            // 3단계 체크박스 상태 확인 (더 정확한 패턴)
            const checkboxPatterns = {
                completed: [
                    /- \[x\] 복습 완료/i,
                    /- \[x\] 학습 완료/i,
                    /- \[x\] 완료/i,
                    /- \[X\] 복습 완료/i,
                    /- \[X\] 학습 완료/i,
                    /- \[X\] 완료/i
                ],
                inProgress: [
                    /- \[x\] 개념 이해/i,
                    /- \[x\] 예시 확인/i,
                    /- \[x\] 연습 문제 풀이/i,
                    /- \[x\] 진행중/i,
                    /- \[x\] 학습중/i,
                    /- \[X\] 개념 이해/i,
                    /- \[X\] 예시 확인/i,
                    /- \[X\] 연습 문제 풀이/i,
                    /- \[X\] 진행중/i,
                    /- \[X\] 학습중/i
                ]
            };
            
            // 완료 상태 확인 (우선순위 높음)
            for (const pattern of checkboxPatterns.completed) {
                if (pattern.test(content)) {
                    console.log("✅ 완료 상태 감지");
                    return 'completed';
                }
            }
            
            // 진행중 상태 확인
            for (const pattern of checkboxPatterns.inProgress) {
                if (pattern.test(content)) {
                    console.log("🔄 진행중 상태 감지");
                    return 'in-progress';
                }
            }
            
            // 체크되지 않은 체크박스가 있는지 확인
            const hasUncheckedBoxes = /- \[ \]/.test(content);
            if (hasUncheckedBoxes) {
                console.log("⭕ 미완료 상태 감지 (체크박스 있음)");
                return 'not-started';
            }
            
            // 아무 체크박스도 없으면 기본 상태
            console.log("📝 기본 상태 (체크박스 없음)");
            return 'not-started';
            
        } catch (error) {
            console.error('❌ 셀 상태 확인 오류:', error);
            return 'not-started';
        }
    }

    applyCellStatus(cell, status) {
        try {
            console.log("🎨 셀 상태 적용:", status);
            
            // 기존 상태 클래스와 아이콘 제거
            cell.classList.remove('cell-completed', 'cell-in-progress', 'cell-not-started');
            
            // 기존 상태 아이콘 제거
            const existingIcons = ['✅', '🔄', '⭕', '📝'];
            let cellText = cell.textContent;
            existingIcons.forEach(icon => {
                cellText = cellText.replace(icon, '').trim();
            });
            
            // 새 상태 클래스 추가
            cell.classList.add(`cell-${status}`);
            
            // 상태별 아이콘과 스타일 적용
            let statusIcon, bgColor, textColor;
            
            switch(status) {
                case 'completed':
                    statusIcon = '✅';
                    bgColor = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
                    textColor = 'white';
                    break;
                case 'in-progress':
                    statusIcon = '🔄';
                    bgColor = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
                    textColor = 'white';
                    break;
                default: // 'not-started'
                    statusIcon = '⭕';
                    bgColor = 'var(--background-secondary)';
                    textColor = 'var(--text-muted)';
                    break;
            }
            
            // HTML 내용 업데이트 (기존 링크 보존)
            const linkMatch = cell.innerHTML.match(/\[\[([^\]]+)\]\]/);
            if (linkMatch) {
                cell.innerHTML = `${statusIcon} [[${linkMatch[1]}]]`;
            } else {
                cell.textContent = `${statusIcon} ${cellText}`;
            }
            
            // 인라인 스타일 적용 (CSS 클래스보다 우선순위 높음)
            cell.style.background = bgColor;
            cell.style.color = textColor;
            cell.style.fontWeight = status !== 'not-started' ? 'bold' : 'normal';
            cell.style.transition = 'all 0.3s ease';
            
            // 애니메이션 효과
            if (status !== 'not-started') {
                cell.style.transform = 'scale(1.02)';
                setTimeout(() => {
                    cell.style.transform = 'scale(1)';
                }, 200);
            }
            
            console.log(`✨ 셀 상태 적용 완료: ${status}`);
            
        } catch (error) {
            console.error('❌ 셀 상태 적용 오류:', error);
        }
    }

    addStyles() {
        const styleEl = document.createElement('style');
        styleEl.id = 'structured-learning-plugin-styles';
        styleEl.textContent = PLUGIN_STYLES;
        document.head.appendChild(styleEl);
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    openPluginSettings() {
        const settingTab = this.app.setting;
        settingTab.open();
        settingTab.openTabById('structured-table-learning');
    }

    openFolderManagement() {
        new FolderManagementModal(this.app, this.settings).open();
    }

    registerDashboardEvents() {
        // 대시보드 버튼 이벤트 처리
        this.dashboardEventHandler = (event) => {
            switch(event.type) {
                case 'open-plugin-settings':
                    this.openPluginSettings();
                    break;
                case 'create-structured-table':
                    new CreateStructuredTableModal(this.app, this.settings, (data) => {
                        this.createStructuredTable(data);
                    }).open();
                    break;
                case 'create-learning-cell':
                    new CreateLearningCellModal(this.app, this.settings, (data) => {
                        this.createLearningCell(data);
                    }).open();
                    break;
                case 'manage-folders':
                    this.openFolderManagement();
                    break;
            }
        };

        document.addEventListener('open-plugin-settings', this.dashboardEventHandler);
        document.addEventListener('create-structured-table', this.dashboardEventHandler);
        document.addEventListener('create-learning-cell', this.dashboardEventHandler);
        document.addEventListener('manage-folders', this.dashboardEventHandler);
    }

    unregisterDashboardEvents() {
        if (this.dashboardEventHandler) {
            document.removeEventListener('open-plugin-settings', this.dashboardEventHandler);
            document.removeEventListener('create-structured-table', this.dashboardEventHandler);
            document.removeEventListener('create-learning-cell', this.dashboardEventHandler);
            document.removeEventListener('manage-folders', this.dashboardEventHandler);
        }
    }

    async openDashboard() {
        try {
            console.log("📊 대시보드 열기 시작");
            
            const dashboardPath = `${this.settings.dashboardFolder}/통합 대시보드.md`;
            console.log("대시보드 경로:", dashboardPath);
            
            const dashboardFile = this.app.vault.getAbstractFileByPath(dashboardPath);
            
            if (!dashboardFile) {
                console.log("대시보드 파일이 없음, 생성 중...");
                await this.createMainDashboard();
                
                const newFile = this.app.vault.getAbstractFileByPath(dashboardPath);
                if (newFile) {
                    console.log("새 대시보드 파일 열기");
                    await this.app.workspace.getLeaf().openFile(newFile);
                    new obsidian.Notice("📊 통합 대시보드가 생성되었습니다!");
                } else {
                    throw new Error("대시보드 파일 생성 후에도 찾을 수 없습니다.");
                }
            } else {
                console.log("기존 대시보드 파일 열기");
                await this.app.workspace.getLeaf().openFile(dashboardFile);
            }
            
            console.log("✅ 대시보드 열기 완료");
            
        } catch (error) {
            console.error("❌ 대시보드 열기 실패:", error);
            new obsidian.Notice("대시보드 열기 실패: " + error.message);
        }
    }

    async createMainDashboard() {
        try {
            const folder = this.app.vault.getAbstractFileByPath(this.settings.dashboardFolder);
            if (!folder) {
                await this.app.vault.createFolder(this.settings.dashboardFolder);
            }

            const currentDate = new Date().toISOString().split("T")[0];
            const filePath = `${this.settings.dashboardFolder}/통합 대시보드.md`;

            const content = `# 📊 통합 학습 대시보드

<div class="dashboard-header">
<div class="dashboard-title">
<h1>� 통합 학습 관리 시스템</h1>
<p>�🕐 <strong>업데이트</strong>: ${currentDate} | 📁 <strong>기본 폴더</strong>: \`${this.settings.studyFolder}\`</p>
</div>

<div class="dashboard-actions">
<button class="dashboard-btn settings-btn" onclick="this.closest('.markdown-preview-view').querySelector('.view-content').dispatchEvent(new CustomEvent('open-plugin-settings'))">⚙️ 설정</button>
<button class="dashboard-btn create-btn" onclick="this.closest('.markdown-preview-view').querySelector('.view-content').dispatchEvent(new CustomEvent('create-structured-table'))">📋 새 학습표</button>
<button class="dashboard-btn cell-btn" onclick="this.closest('.markdown-preview-view').querySelector('.view-content').dispatchEvent(new CustomEvent('create-learning-cell'))">📌 새 학습셀</button>
<button class="dashboard-btn folder-btn" onclick="this.closest('.markdown-preview-view').querySelector('.view-content').dispatchEvent(new CustomEvent('manage-folders'))">📁 폴더 관리</button>
<button class="dashboard-btn refresh-btn" onclick="location.reload()">🔄 새로고침</button>
</div>
</div>

<style>
.dashboard-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 12px;
    margin-bottom: 30px;
    color: white;
    flex-wrap: wrap;
    gap: 15px;
}

.dashboard-title h1 {
    margin: 0;
    font-size: 1.8em;
    font-weight: bold;
}

.dashboard-title p {
    margin: 5px 0 0 0;
    opacity: 0.9;
    font-size: 0.9em;
}

.dashboard-actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
}

.dashboard-btn {
    padding: 12px 18px;
    border: none;
    border-radius: 8px;
    font-weight: bold;
    font-size: 0.9em;
    cursor: pointer;
    transition: all 0.3s ease;
    white-space: nowrap;
}

.settings-btn {
    background: #f59e0b;
    color: white;
}

.create-btn {
    background: #10b981;
    color: white;
}

.cell-btn {
    background: #3b82f6;
    color: white;
}

.folder-btn {
    background: #8b5cf6;
    color: white;
}

.refresh-btn {
    background: #6b7280;
    color: white;
}

.dashboard-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
}

/* 모바일 최적화 */
@media (max-width: 768px) {
    .dashboard-header {
        flex-direction: column;
        align-items: stretch;
        text-align: center;
    }
    
    .dashboard-actions {
        justify-content: center;
        width: 100%;
    }
    
    .dashboard-btn {
        flex: 1;
        min-width: 100px;
        padding: 15px;
        font-size: 1em;
    }
}
</style>

---

## 📚 과목별 현황

\`\`\`dataviewjs
const studyFolder = "${this.settings.studyFolder}";
const subjects = {};

// 과목별 폴더 탐색
for (const folder of dv.pages(\`"\${studyFolder}"\`).file.folder.array().filter(f => f !== studyFolder)) {
    const subjectName = folder.split("/").pop();
    if (!subjects[subjectName]) {
        subjects[subjectName] = { total: 0, completed: 0, inProgress: 0 };
    }
}

// 각 과목별 파일 분석
for (const [subject, data] of Object.entries(subjects)) {
    const pages = dv.pages(\`"\${studyFolder}/\${subject}"\`);
    data.total = pages.length;
    
    for (const page of pages) {
        try {
            const content = await dv.io.load(page.file.path);
            if (content) {
                if (content.includes("- [x] 복습 완료")) {
                    data.completed++;
                } else if (content.includes("- [x] 개념 이해")) {
                    data.inProgress++;
                }
            }
        } catch (e) {}
    }
}

if (Object.keys(subjects).length > 0) {
    dv.table(
        ["과목", "전체", "완료", "진행중", "진행률", "대시보드"],
        Object.entries(subjects).map(([subject, data]) => {
            const progress = data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0;
            return [
                subject,
                \`\${data.total}개\`,
                \`\${data.completed}개\`,
                \`\${data.inProgress}개\`,
                \`\${progress}%\`,
                \`[[\${subject} 대시보드]]\`
            ];
        })
    );
} else {
    dv.paragraph("📝 아직 생성된 과목이 없습니다. 상단의 '📋 새 학습표' 버튼을 사용하세요.");
}
\`\`\`

---

## 🎯 빠른 통계

\`\`\`dataviewjs
const studyFolder = "${this.settings.studyFolder}";
const allPages = dv.pages(\`"\${studyFolder}"\`);
let totalPages = 0;
let completedPages = 0;
let inProgressPages = 0;
let notStartedPages = 0;

for (const page of allPages) {
    try {
        const content = await dv.io.load(page.file.path);
        if (content) {
            totalPages++;
            if (content.includes("- [x] 복습 완료")) {
                completedPages++;
            } else if (content.includes("- [x] 개념 이해") || content.includes("- [x] 예시 확인")) {
                inProgressPages++;
            } else {
                notStartedPages++;
            }
        }
    } catch (e) {}
}

const completionRate = totalPages > 0 ? Math.round((completedPages / totalPages) * 100) : 0;

dv.paragraph(\`
<div class="stats-dashboard">
<div class="stat-card completed">
<h3>\${completedPages}</h3>
<p>✅ 완료</p>
</div>
<div class="stat-card in-progress">
<h3>\${inProgressPages}</h3>
<p>🔄 진행중</p>
</div>
<div class="stat-card not-started">
<h3>\${notStartedPages}</h3>
<p>⭕ 시작안함</p>
</div>
<div class="stat-card total">
<h3>\${completionRate}%</h3>
<p>📊 완료율</p>
</div>
</div>

<style>
.stats-dashboard {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 15px;
    margin: 20px 0;
}

.stat-card {
    padding: 20px;
    border-radius: 10px;
    text-align: center;
    border: 2px solid;
}

.stat-card.completed {
    background: linear-gradient(135deg, #10b981, #059669);
    border-color: #065f46;
    color: white;
}

.stat-card.in-progress {
    background: linear-gradient(135deg, #f59e0b, #d97706);
    border-color: #92400e;
    color: white;
}

.stat-card.not-started {
    background: linear-gradient(135deg, #6b7280, #4b5563);
    border-color: #374151;
    color: white;
}

.stat-card.total {
    background: linear-gradient(135deg, #8b5cf6, #7c3aed);
    border-color: #5b21b6;
    color: white;
}

.stat-card h3 {
    margin: 0;
    font-size: 2.2em;
    font-weight: bold;
}

.stat-card p {
    margin: 8px 0 0 0;
    font-size: 0.9em;
    opacity: 0.9;
}
</style>
\`);
\`\`\`

---

## 📖 최근 학습 활동

\`\`\`dataviewjs
const studyFolder = "${this.settings.studyFolder}";
const recentPages = dv.pages(\`"\${studyFolder}"\`)
    .sort(p => p.file.mtime, 'desc')
    .limit(10);

if (recentPages.length > 0) {
    // 학습 상태 확인 함수
    const getStatus = async (page) => {
        try {
            const content = await dv.io.load(page.file.path);
            if (content.includes("- [x] 복습 완료")) return "✅";
            if (content.includes("- [x] 개념 이해")) return "🔄";
            return "⭕";
        } catch (e) {
            return "⭕";
        }
    };
    
    const tableData = [];
    for (const page of recentPages) {
        const subject = page.file.folder.split("/").pop();
        const status = await getStatus(page);
        tableData.push([
            status,
            subject,
            dv.fileLink(page.file.path, false, page.file.name),
            page.file.mtime.toFormat("MM-dd HH:mm")
        ]);
    }
    
    dv.table(
        ["상태", "과목", "파일명", "수정일"],
        tableData
    );
} else {
    dv.paragraph("📝 아직 학습 기록이 없습니다. 상단의 '📌 새 학습셀' 버튼으로 시작하세요!");
}
\`\`\`

---

## 📁 폴더 관리

\`\`\`dataviewjs
// 폴더 관리 UI
const studyFolder = "${this.settings.studyFolder}";
const dashboardFolder = "${this.settings.dashboardFolder}";

// 기존 과목 폴더 목록
const studyFolders = [];
const allFolders = app.vault.getAllLoadedFiles()
    .filter(f => f.children && f.path.startsWith(studyFolder))
    .map(f => f.path.replace(studyFolder + "/", ""))
    .filter(f => f && !f.includes("/"));

const managementHtml = \`
<div class="folder-management">
<div class="folder-section">
<h3>📚 기본 폴더 (과목별)</h3>
<div class="folder-list">
\${allFolders.length > 0 ? 
    allFolders.map(folder => \`
    <div class="folder-item">
        <span class="folder-name">📁 \${folder}</span>
        <div class="folder-actions">
            <button class="folder-action-btn open-btn" onclick="app.workspace.getLeaf().openFile(app.vault.getAbstractFileByPath('\${studyFolder}/\${folder}'))">열기</button>
            <button class="folder-action-btn delete-btn" onclick="if(confirm('정말로 \${folder} 과목을 삭제하시겠습니까?')) { app.vault.delete(app.vault.getAbstractFileByPath('\${studyFolder}/\${folder}')); location.reload(); }">삭제</button>
        </div>
    </div>
    \`).join('') : 
    '<p class="no-folders">📝 아직 과목 폴더가 없습니다.</p>'
}
</div>
<div class="create-folder">
    <input type="text" id="new-subject-name" placeholder="새 과목명 입력..." class="folder-input">
    <button class="folder-action-btn create-btn" onclick="
        const name = document.getElementById('new-subject-name').value.trim();
        if(name) {
            app.vault.createFolder('\${studyFolder}/' + name).then(() => {
                new Notice('과목 폴더 생성: ' + name);
                location.reload();
            }).catch(e => new Notice('폴더 생성 실패: ' + e.message));
        } else {
            new Notice('과목명을 입력해주세요.');
        }
    ">📚 과목 추가</button>
</div>
</div>

<div class="folder-section">
<h3>📊 대시보드 폴더</h3>
<div class="dashboard-folder-info">
    <span class="folder-name">📁 \${dashboardFolder}</span>
    <div class="folder-actions">
        <button class="folder-action-btn open-btn" onclick="app.workspace.getLeaf().openFile(app.vault.getAbstractFileByPath('\${dashboardFolder}'))">열기</button>
        <button class="folder-action-btn create-btn" onclick="app.vault.createFolder('\${dashboardFolder}').then(() => new Notice('대시보드 폴더 생성')).catch(() => new Notice('이미 존재합니다'))">생성</button>
        <button class="folder-action-btn delete-btn" onclick="if(confirm('정말로 대시보드 폴더를 삭제하시겠습니까?')) { app.vault.delete(app.vault.getAbstractFileByPath('\${dashboardFolder}')); }">삭제</button>
    </div>
</div>
</div>
</div>

<style>
.folder-management {
    margin: 20px 0;
    padding: 20px;
    background: var(--background-secondary);
    border-radius: 10px;
    border: 1px solid var(--background-modifier-border);
}

.folder-section {
    margin-bottom: 30px;
}

.folder-section h3 {
    margin: 0 0 15px 0;
    color: var(--text-accent);
    border-bottom: 2px solid var(--accent-color);
    padding-bottom: 5px;
}

.folder-list {
    margin-bottom: 15px;
}

.folder-item, .dashboard-folder-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px;
    margin: 8px 0;
    background: var(--background-primary);
    border-radius: 8px;
    border: 1px solid var(--background-modifier-border);
}

.folder-name {
    font-weight: 600;
    color: var(--text-normal);
}

.folder-actions {
    display: flex;
    gap: 8px;
}

.folder-action-btn {
    padding: 6px 12px;
    border: none;
    border-radius: 6px;
    font-size: 0.8em;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.2s;
}

.open-btn {
    background: #10b981;
    color: white;
}

.create-btn {
    background: #3b82f6;
    color: white;
}

.delete-btn {
    background: #ef4444;
    color: white;
}

.folder-action-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}

.create-folder {
    display: flex;
    gap: 10px;
    align-items: center;
}

.folder-input {
    flex: 1;
    padding: 10px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    background: var(--background-primary);
    color: var(--text-normal);
}

.no-folders {
    color: var(--text-muted);
    font-style: italic;
    text-align: center;
    padding: 20px;
}

/* 모바일 최적화 */
@media (max-width: 768px) {
    .folder-item, .dashboard-folder-info {
        flex-direction: column;
        align-items: stretch;
        gap: 10px;
    }
    
    .folder-actions {
        justify-content: center;
    }
    
    .create-folder {
        flex-direction: column;
    }
    
    .folder-input {
        margin-bottom: 10px;
    }
}
</style>
\`;

dv.paragraph(managementHtml);
\`\`\`

<div class="quick-start">
<div class="guide-step">
<h3>1️⃣ 새 과목 시작</h3>
<p><strong>Ctrl+P</strong> → "구조화된 학습표 생성" 또는 상단 <strong>📋 새 학습표</strong> 버튼</p>
</div>

<div class="guide-step">
<h3>2️⃣ 학습셀 작성</h3>
<p>표의 셀을 클릭하거나 <strong>📌 새 학습셀</strong> 버튼으로 개별 학습 내용 작성</p>
</div>

<div class="guide-step">
<h3>3️⃣ 진도 관리</h3>
<p>각 셀의 체크박스를 체크하여 학습 진도를 관리하고 색상으로 상태 확인</p>
</div>
</div>

<style>
.quick-start {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 20px;
    margin: 20px 0;
}

.guide-step {
    padding: 20px;
    background: var(--background-secondary);
    border-radius: 10px;
    border-left: 4px solid var(--accent-color);
}

.guide-step h3 {
    margin: 0 0 10px 0;
    color: var(--accent-color);
}

.guide-step p {
    margin: 0;
    line-height: 1.5;
}
</style>

---

## 📖 시스템 구조 개요

**챕터 시스템 (6개 챕터)**

| 챕터 | 블록 범위 | 셀 범위 예시 | 총 셀 수 |
|:---:|:---|:---|:---:|
| Chapter 1 | 블록 1-9 | 01-11~20 → 09-91~100 | 90개 |
| Chapter 2 | 블록 10-18 | 01-111~120 → 09-191~200 | 90개 |
| Chapter 3 | 블록 19-27 | 01-211~220 → 09-291~300 | 90개 |
| Chapter 4 | 블록 28-36 | 01-311~320 → 09-391~400 | 90개 |
| Chapter 5 | 블록 37-45 | 01-411~420 → 09-491~500 | 90개 |
| Chapter 6 | 블록 46-54 | 01-511~520 → 09-591~600 | 90개 |

**총 540개 셀** (6챕터 × 9블록 × 10셀)

---

## 🚀 빠른 시작

1. **Ctrl+P** → "구조화된 학습표 생성"
2. 과목명과 챕터 입력
3. 자동으로 54개 블록 × 10개 셀 생성
4. 각 셀을 클릭하여 학습 내용 작성
`;

            await this.app.vault.create(filePath, content);
            
            if (this.settings.enableNotifications) {
                new obsidian.Notice("통합 대시보드 생성 완료!");
            }

        } catch (error) {
            console.error("대시보드 생성 오류:", error);
            new obsidian.Notice("대시보드 생성 중 오류 발생");
        }
    }

// Part 2로 계속...
// ============================================
// 구조화된 표 학습 플러그인 - Part 2/3 (수정판)
// ============================================

    async createStructuredTable(data) {
        try {
            // 과목별 폴더 생성
            const subjectFolder = `${this.settings.studyFolder}/${data.subject}`;
            const folder = this.app.vault.getAbstractFileByPath(subjectFolder);
            if (!folder) {
                await this.app.vault.createFolder(subjectFolder);
            }

            const currentDate = new Date().toISOString().split("T")[0];
            const fileName = `${data.title} - 학습표.md`;
            const filePath = `${subjectFolder}/${fileName}`;

            let tableContent = '';
            const blocksPerPage = this.settings.blocksPerPage || 3;
            const totalChapters = 6;
            
            // 6개 챕터 생성
            for (let chapterNum = 1; chapterNum <= totalChapters; chapterNum++) {
                // 챕터 헤더
                const startBlock = (chapterNum - 1) * 9 + 1;
                const endBlock = chapterNum * 9;
                const startCell = (chapterNum - 1) * 100 + 11;
                const endCell = chapterNum * 100;
                
                tableContent += `## 📚 Chapter ${chapterNum}\n\n`;
                tableContent += `> **블록 범위**: ${startBlock}~${endBlock} | **셀 범위**: ${data.chapter}-01-${startCell} ~ ${data.chapter}-09-${endCell}\n\n`;
                
                // 챕터 내 9개 블록 생성
                for (let blockInChapter = 1; blockInChapter <= 9; blockInChapter++) {
                    const absoluteBlock = (chapterNum - 1) * 9 + blockInChapter;
                    const blockPrefix = blockInChapter.toString().padStart(2, '0');
                    
                    // 셀 번호 계산 (100단위 건너뛰기 적용)
                    const baseCell = (chapterNum - 1) * 100 + (blockInChapter - 1) * 10 + 11;
                    const startCellNum = baseCell;
                    const endCellNum = startCellNum + 9;
                    
                    tableContent += `### 📦 블록 ${absoluteBlock} | ${blockPrefix}-${startCellNum}~${endCellNum}\n\n`;
                    
                    // 3x3 표 + 상단 중앙 1개 (총 10개 셀)
                    tableContent += `|  | [[${data.chapter}-${blockPrefix}-${endCellNum}]] |  |\n`;
                    tableContent += `| :---: | :---: | :---: |\n`;
                    
                    // 3x3 그리드 (아래에서 위로)
                    for (let row = 2; row >= 0; row--) {
                        tableContent += `|`;
                        for (let col = 0; col < 3; col++) {
                            const cellOffset = row * 3 + col;
                            const cellNumber = startCellNum + cellOffset;
                            tableContent += ` [[${data.chapter}-${blockPrefix}-${cellNumber}]] |`;
                        }
                        tableContent += `\n`;
                    }
                    
                    tableContent += `\n`;
                    
                    // 페이지 구분선
                    if (blockInChapter % blocksPerPage === 0 && blockInChapter < 9) {
                        tableContent += `---\n\n`;
                    }
                }
                
                // 챕터 끝 구분선
                if (chapterNum < totalChapters) {
                    tableContent += `\n<div class="page-break"></div>\n\n`;
                }
            }

            const content = `# ${data.title} - 학습표

> 📚 **과목**: ${data.subject}
> 📖 **챕터**: ${data.chapter}
> 📅 **생성일**: ${currentDate}
> 🎯 **총 구조**: 6개 챕터 × 9개 블록 × 10개 셀 = 540개 셀

---

## 📋 학습 목표

${data.goals || "- [ ] Chapter 1-6 완료\n- [ ] 핵심 개념 정리\n- [ ] 문제 풀이 완료"}

---

## 📊 진행 현황

\`\`\`dataviewjs
const subject = "${data.subject}";
const chapter = "${data.chapter}";
const folder = \`${this.settings.studyFolder}/\${subject}\`;

const allPages = dv.pages(\`"\${folder}"\`)
    .where(p => p.file.name.startsWith(chapter));

const total = allPages.length;
let completed = 0;
let inProgress = 0;

for (const page of allPages) {
    try {
        const content = await dv.io.load(page.file.path);
        if (content) {
            if (content.includes("- [x] 복습 완료")) {
                completed++;
            } else if (content.includes("- [x] 개념 이해")) {
                inProgress++;
            }
        }
    } catch (e) {}
}

const notStarted = total - completed - inProgress;
const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

dv.paragraph(\`
**전체**: \${total}개 | **완료**: \${completed}개 (\${progress}%) | **진행중**: \${inProgress}개 | **미시작**: \${notStarted}개
\`);
\`\`\`

---

${tableContent}

---

## 🔗 링크

- [[통합 대시보드]]
- [[${data.subject} 대시보드]]
`;

            if (this.app.vault.getAbstractFileByPath(filePath)) {
                new obsidian.Notice(`파일이 이미 존재합니다`);
                return;
            }

            await this.app.vault.create(filePath, content);
            
            // 과목별 대시보드도 자동 생성
            await this.createSubjectDashboard({ subject: data.subject });
            
            if (this.settings.enableNotifications) {
                new obsidian.Notice(`✅ 학습표 생성 완료! (540개 셀)`);
            }

        } catch (error) {
            console.error("학습표 생성 오류:", error);
            new obsidian.Notice("학습표 생성 중 오류 발생");
        }
    }

    async createLearningCell(data) {
        try {
            const subjectFolder = `${this.settings.studyFolder}/${data.subject}`;
            const folder = this.app.vault.getAbstractFileByPath(subjectFolder);
            if (!folder) {
                await this.app.vault.createFolder(subjectFolder);
            }

            const currentDate = new Date().toISOString().split("T")[0];
            const fileName = `${data.chapter}-${data.blockNumber}-${data.cellNumber} ${data.title}.md`;
            const filePath = `${subjectFolder}/${fileName}`;

            // 블록 번호로 챕터 계산
            const blockNum = parseInt(data.blockNumber);
            const chapterNum = Math.ceil(blockNum / 9);

            const content = `# ${data.chapter}-${data.blockNumber}-${data.cellNumber} ${data.title}

> 📅 **생성일**: ${currentDate}
> 📚 **과목**: ${data.subject}
> 📖 **챕터**: Chapter ${chapterNum}
> 📦 **블록**: ${data.blockNumber}
> 🔢 **셀**: ${data.cellNumber}

---

## 💡 핵심 개념

## 📝 상세 설명

## 📌 예시

## 🎯 연습 문제

## ✅ 학습 체크

**📚 학습 단계별 체크리스트**

### 🔰 기본 학습
- [ ] 개념 이해 완료
- [ ] 예시 확인 완료
- [ ] 핵심 정리 완료

### 🎯 심화 학습  
- [ ] 연습 문제 풀이 완료
- [ ] 응용 문제 도전 완료
- [ ] 오답 분석 완료

### 🏆 완료 확인
- [ ] 복습 완료
- [ ] 학습 완료

> 💡 **상태 안내**: 
> - 기본 학습 체크 시 → 🔄 **진행중** (주황색)
> - 복습/학습 완료 체크 시 → ✅ **완료** (녹색)
> - 미체크 상태 → ⭕ **시작안함** (회색)

---

## 📊 학습 기록

**학습 시작**: 
**학습 완료**: 
**소요 시간**: 
**난이도**: ⭐⭐⭐☆☆

---

🔗 [[${data.subject} 대시보드]] | [[통합 대시보드]]
`;

            if (this.app.vault.getAbstractFileByPath(filePath)) {
                new obsidian.Notice(`파일이 이미 존재합니다`);
                return;
            }

            await this.app.vault.create(filePath, content);
            
            if (this.settings.enableNotifications) {
                new obsidian.Notice(`✅ 학습셀 생성: ${data.cellNumber}`);
            }

        } catch (error) {
            console.error("학습셀 생성 오류:", error);
            new obsidian.Notice("학습셀 생성 중 오류 발생");
        }
    }

    async createSubjectDashboard(data) {
        try {
            const dashboardFolder = this.app.vault.getAbstractFileByPath(this.settings.dashboardFolder);
            if (!dashboardFolder) {
                await this.app.vault.createFolder(this.settings.dashboardFolder);
            }

            const currentDate = new Date().toISOString().split("T")[0];
            const fileName = `${data.subject} 대시보드.md`;
            const filePath = `${this.settings.dashboardFolder}/${fileName}`;

            const content = `# 📚 ${data.subject} 대시보드

> 🕐 업데이트: ${currentDate}
> 📁 폴더: \`${this.settings.studyFolder}/${data.subject}\`

---

## 📊 전체 현황

\`\`\`dataviewjs
const subject = "${data.subject}";
const folder = \`${this.settings.studyFolder}/\${subject}\`;
const allPages = dv.pages(\`"\${folder}"\`);

const total = allPages.length;
let completed = 0;
let inProgress = 0;

for (const page of allPages) {
    try {
        const content = await dv.io.load(page.file.path);
        if (content) {
            if (content.includes("- [x] 복습 완료")) {
                completed++;
            } else if (content.includes("- [x] 개념 이해")) {
                inProgress++;
            }
        }
    } catch (e) {}
}

const notStarted = total - completed - inProgress;
const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

dv.header(3, "📈 학습 통계");
dv.paragraph(\`
**총 학습셀**: \${total}개
✅ **완료**: \${completed}개 (\${progress}%)
🔄 **진행중**: \${inProgress}개
⏳ **미시작**: \${notStarted}개
\`);
\`\`\`

---

## 📚 챕터별 진도

\`\`\`dataviewjs
const subject = "${data.subject}";
const folder = \`${this.settings.studyFolder}/\${subject}\`;
const allPages = dv.pages(\`"\${folder}"\`);

const chapterData = {};
for (let i = 1; i <= 6; i++) {
    chapterData[i] = { total: 0, completed: 0, inProgress: 0 };
}

for (const page of allPages) {
    const match = page.file.name.match(/^\\d{2}-(\\d{2})-/);
    if (match) {
        const blockNum = parseInt(match[1]);
        const chapterNum = Math.ceil(blockNum / 9);
        
        if (chapterData[chapterNum]) {
            chapterData[chapterNum].total++;
            
            try {
                const content = await dv.io.load(page.file.path);
                if (content) {
                    if (content.includes("- [x] 복습 완료")) {
                        chapterData[chapterNum].completed++;
                    } else if (content.includes("- [x] 개념 이해")) {
                        chapterData[chapterNum].inProgress++;
                    }
                }
            } catch (e) {}
        }
    }
}

dv.table(
    ["챕터", "블록", "완료", "진행중", "전체", "진행률"],
    Object.entries(chapterData).map(([ch, data]) => {
        const chapter = parseInt(ch);
        const startBlock = (chapter - 1) * 9 + 1;
        const endBlock = chapter * 9;
        const progress = data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0;
        
        return [
            \`Ch\${chapter}\`,
            \`\${startBlock}-\${endBlock}\`,
            \`\${data.completed}개\`,
            \`\${data.inProgress}개\`,
            \`\${data.total}개\`,
            \`\${progress}%\`
        ];
    })
);
\`\`\`

---

## 🎯 최근 학습

\`\`\`dataviewjs
const subject = "${data.subject}";
const folder = \`${this.settings.studyFolder}/\${subject}\`;
const recentPages = dv.pages(\`"\${folder}"\`)
    .sort(p => p.file.mtime, 'desc')
    .limit(10);

dv.table(
    ["파일명", "수정일"],
    recentPages.map(p => [
        dv.fileLink(p.file.path, false, p.file.name),
        p.file.mtime.toFormat("MM-dd HH:mm")
    ])
);
\`\`\`

---

🔗 [[통합 대시보드]]
`;

            // 기존 파일이 있으면 덮어쓰지 않음
            if (!this.app.vault.getAbstractFileByPath(filePath)) {
                await this.app.vault.create(filePath, content);
            }

        } catch (error) {
            console.error("과목 대시보드 생성 오류:", error);
        }
    }
}

// Part 3로 계속...
// ============================================
// 구조화된 표 학습 플러그인 - Part 3/3 (수정판 - 최종)
// ============================================

// 설정 탭
class StructuredTableSettingTab extends obsidian.PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.addClass('structured-learning-plugin');

        // 모바일 최적화 헤더
        const headerEl = containerEl.createEl('div', { cls: 'setting-header' });
        headerEl.createEl('h2', { text: '📊 구조화된 표 학습 플러그인' });
        headerEl.createEl('p', { 
            text: '모바일에 최적화된 학습 관리 시스템',
            cls: 'setting-item-description'
        });

        new obsidian.Setting(containerEl)
            .setName('📁 학습 기본 폴더')
            .setDesc('과목별 학습 노트가 저장될 기본 폴더')
            .addText(text => text
                .setValue(this.plugin.settings.studyFolder)
                .onChange(async (value) => {
                    this.plugin.settings.studyFolder = value;
                    await this.plugin.saveSettings();
                }));

        new obsidian.Setting(containerEl)
            .setName('📊 대시보드 폴더')
            .setDesc('과목별 대시보드가 저장될 폴더')
            .addText(text => text
                .setValue(this.plugin.settings.dashboardFolder)
                .onChange(async (value) => {
                    this.plugin.settings.dashboardFolder = value;
                    await this.plugin.saveSettings();
                }));

        new obsidian.Setting(containerEl)
            .setName('📱 한 화면에 표시할 블록 수')
            .setDesc('학습표에서 페이지 구분 단위')
            .addDropdown(dropdown => dropdown
                .addOption('3', '3개 블록')
                .addOption('4', '4개 블록')
                .addOption('5', '5개 블록')
                .setValue(this.plugin.settings.blocksPerPage.toString())
                .onChange(async (value) => {
                    this.plugin.settings.blocksPerPage = parseInt(value);
                    await this.plugin.saveSettings();
                }));

        // 모바일 터치 설정 추가
        new obsidian.Setting(containerEl)
            .setName('� 터치 미리보기')
            .setDesc('셀을 터치하면 내용 미리보기를 표시합니다')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableTouchPreview ?? true)
                .onChange(async (value) => {
                    this.plugin.settings.enableTouchPreview = value;
                    await this.plugin.saveSettings();
                }));

        new obsidian.Setting(containerEl)
            .setName('🎨 상태별 색상 표시')
            .setDesc('완료/진행중/시작안함 상태에 따라 셀 색상을 변경합니다')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableStatusColors ?? true)
                .onChange(async (value) => {
                    this.plugin.settings.enableStatusColors = value;
                    await this.plugin.saveSettings();
                }));

        new obsidian.Setting(containerEl)
            .setName('�🚀 시작 시 대시보드 자동 열기')
            .setDesc('Obsidian 시작 시 통합 대시보드 자동 표시')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showDashboardOnStartup)
                .onChange(async (value) => {
                    this.plugin.settings.showDashboardOnStartup = value;
                    await this.plugin.saveSettings();
                }));

        new obsidian.Setting(containerEl)
            .setName('🔔 알림')
            .setDesc('파일 생성 시 알림 표시')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableNotifications)
                .onChange(async (value) => {
                    this.plugin.settings.enableNotifications = value;
                    await this.plugin.saveSettings();
                }));

        // 대시보드 바로가기 버튼을 더 크게
        new obsidian.Setting(containerEl)
            .setName('📊 대시보드 열기')
            .setDesc('통합 학습 대시보드를 엽니다')
            .addButton(button => button
                .setButtonText('📊 대시보드 열기')
                .setCta()
                .onClick(() => this.plugin.openDashboard()));

        // 모바일 사용 가이드 추가
        const guideEl = containerEl.createEl('div', { cls: 'setting-item' });
        guideEl.createEl('h3', { text: '📱 모바일 사용 가이드' });
        const guideList = guideEl.createEl('ul');
        guideList.createEl('li', { text: '셀을 터치하면 미리보기가 표시됩니다' });
        guideList.createEl('li', { text: '완료된 셀은 녹색, 진행중은 주황색으로 표시됩니다' });
        guideList.createEl('li', { text: '좌우 스와이프로 블록 간 이동이 가능합니다' });
    }
}

// Modal 클래스들
class CreateStructuredTableModal extends obsidian.Modal {
    constructor(app, settings, onSubmit) {
        super(app);
        this.settings = settings;
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl("h2", { text: "구조화된 학습표 생성" });

        const form = contentEl.createEl("div");
        
        const subjectDiv = form.createDiv({ cls: "setting-item" });
        subjectDiv.createEl("div", { text: "과목명:", cls: "setting-item-name" });
        const subjectInput = subjectDiv.createEl("input", {
            type: "text",
            placeholder: "예: 수학, 물리, 화학, 영어",
            cls: "setting-item-control"
        });

        const titleDiv = form.createDiv({ cls: "setting-item" });
        titleDiv.createEl("div", { text: "제목:", cls: "setting-item-name" });
        const titleInput = titleDiv.createEl("input", {
            type: "text",
            placeholder: "예: 이차함수, 역학, 유기화학",
            cls: "setting-item-control"
        });

        const chapterDiv = form.createDiv({ cls: "setting-item" });
        chapterDiv.createEl("div", { text: "챕터 번호:", cls: "setting-item-name" });
        const chapterSelect = chapterDiv.createEl("select", { cls: "setting-item-control" });
        for (let i = 1; i <= 20; i++) {
            chapterSelect.createEl("option", {
                value: i.toString().padStart(2, '0'),
                text: `Chapter ${i.toString().padStart(2, '0')}`
            });
        }

        const goalsDiv = form.createDiv({ cls: "setting-item" });
        goalsDiv.createEl("div", { text: "학습 목표 (선택):", cls: "setting-item-name" });
        const goalsTextarea = goalsDiv.createEl("textarea", {
            placeholder: "- [ ] 전체 개념 이해\n- [ ] 문제 풀이 완료\n- [ ] 복습 완료",
            cls: "setting-item-control",
            attr: { rows: "4" }
        });

        const infoDiv = form.createDiv({ cls: "setting-item" });
        infoDiv.createEl("div", {
            text: "💡 6개 챕터 × 9개 블록 × 10개 셀 = 총 540개 학습셀이 생성됩니다",
            cls: "setting-item-description"
        });

        const buttonDiv = form.createDiv({ cls: "setting-item" });
        const createButton = buttonDiv.createEl("button", {
            text: "학습표 생성 (540개 셀)",
            cls: "mod-cta"
        });

        createButton.onclick = () => {
            if (!subjectInput.value.trim()) {
                new obsidian.Notice("과목명을 입력해주세요.");
                return;
            }

            if (!titleInput.value.trim()) {
                new obsidian.Notice("제목을 입력해주세요.");
                return;
            }

            this.onSubmit({
                subject: subjectInput.value.trim(),
                title: titleInput.value.trim(),
                chapter: chapterSelect.value,
                goals: goalsTextarea.value.trim()
            });

            this.close();
        };

        subjectInput.focus();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

class CreateLearningCellModal extends obsidian.Modal {
    constructor(app, settings, onSubmit) {
        super(app);
        this.settings = settings;
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl("h2", { text: "학습셀 생성" });

        const form = contentEl.createEl("div");
        
        const subjectDiv = form.createDiv({ cls: "setting-item" });
        subjectDiv.createEl("div", { text: "과목명:", cls: "setting-item-name" });
        const subjectInput = subjectDiv.createEl("input", {
            type: "text",
            placeholder: "예: 수학, 물리, 화학",
            cls: "setting-item-control"
        });

        const titleDiv = form.createDiv({ cls: "setting-item" });
        titleDiv.createEl("div", { text: "제목:", cls: "setting-item-name" });
        const titleInput = titleDiv.createEl("input", {
            type: "text",
            placeholder: "예: 이차함수의 그래프",
            cls: "setting-item-control"
        });

        const chapterDiv = form.createDiv({ cls: "setting-item" });
        chapterDiv.createEl("div", { text: "챕터:", cls: "setting-item-name" });
        const chapterSelect = chapterDiv.createEl("select", { cls: "setting-item-control" });
        for (let i = 1; i <= 20; i++) {
            chapterSelect.createEl("option", {
                value: i.toString().padStart(2, '0'),
                text: `Chapter ${i.toString().padStart(2, '0')}`
            });
        }

        const blockDiv = form.createDiv({ cls: "setting-item" });
        blockDiv.createEl("div", { text: "블록 번호 (1-54):", cls: "setting-item-name" });
        const blockInput = blockDiv.createEl("input", {
            type: "number",
            placeholder: "1-54",
            min: "1",
            max: "54",
            cls: "setting-item-control"
        });

        const cellDiv = form.createDiv({ cls: "setting-item" });
        cellDiv.createEl("div", { text: "셀 번호:", cls: "setting-item-name" });
        const cellInput = cellDiv.createEl("input", {
            type: "number",
            placeholder: "예: 11, 111, 211",
            cls: "setting-item-control"
        });

        const helpDiv = form.createDiv({ cls: "setting-item" });
        helpDiv.createEl("div", {
            text: "💡 Chapter 1: 블록1(11~20) → 블록9(91~100)\n💡 Chapter 2: 블록10(111~120) → 블록18(191~200)",
            cls: "setting-item-description"
        });

        const buttonDiv = form.createDiv({ cls: "setting-item" });
        const createButton = buttonDiv.createEl("button", {
            text: "학습셀 생성",
            cls: "mod-cta"
        });

        createButton.onclick = () => {
            if (!subjectInput.value.trim()) {
                new obsidian.Notice("과목명을 입력해주세요.");
                return;
            }

            if (!titleInput.value.trim()) {
                new obsidian.Notice("제목을 입력해주세요.");
                return;
            }

            if (!blockInput.value || blockInput.value < 1 || blockInput.value > 54) {
                new obsidian.Notice("블록 번호는 1-54 사이여야 합니다.");
                return;
            }

            if (!cellInput.value) {
                new obsidian.Notice("셀 번호를 입력해주세요.");
                return;
            }

            this.onSubmit({
                subject: subjectInput.value.trim(),
                title: titleInput.value.trim(),
                chapter: chapterSelect.value,
                blockNumber: blockInput.value.toString().padStart(2, '0'),
                cellNumber: cellInput.value.toString()
            });

            this.close();
        };

        subjectInput.focus();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

class CreateSubjectDashboardModal extends obsidian.Modal {
    constructor(app, settings, onSubmit) {
        super(app);
        this.settings = settings;
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl("h2", { text: "과목별 대시보드 생성" });

        const form = contentEl.createEl("div");
        
        const subjectDiv = form.createDiv({ cls: "setting-item" });
        subjectDiv.createEl("div", { text: "과목명:", cls: "setting-item-name" });
        const subjectInput = subjectDiv.createEl("input", {
            type: "text",
            placeholder: "예: 수학, 물리, 화학",
            cls: "setting-item-control"
        });

        const buttonDiv = form.createDiv({ cls: "setting-item" });
        const createButton = buttonDiv.createEl("button", {
            text: "대시보드 생성",
            cls: "mod-cta"
        });

        createButton.onclick = () => {
            if (!subjectInput.value.trim()) {
                new obsidian.Notice("과목명을 입력해주세요.");
                return;
            }

            this.onSubmit({
                subject: subjectInput.value.trim()
            });

            this.close();
        };

        subjectInput.focus();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

class FolderManagementModal extends obsidian.Modal {
    constructor(app, settings) {
        super(app);
        this.settings = settings;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('structured-learning-plugin');

        contentEl.createEl("h2", { text: "📁 폴더 관리" });

        this.createSubjectFolderSection(contentEl);
        this.createDashboardFolderSection(contentEl);
    }

    createSubjectFolderSection(container) {
        const section = container.createDiv({ cls: "folder-section" });
        section.createEl("h3", { text: "📚 과목 폴더 관리" });

        // 기존 과목 폴더 목록
        const folderList = section.createDiv({ cls: "folder-list" });
        this.updateSubjectFolderList(folderList);

        // 새 과목 폴더 생성
        const createDiv = section.createDiv({ cls: "create-folder" });
        const input = createDiv.createEl("input", {
            type: "text",
            placeholder: "새 과목명 입력...",
            cls: "folder-input"
        });
        const createBtn = createDiv.createEl("button", {
            text: "📚 과목 추가",
            cls: "mod-cta"
        });

        createBtn.onclick = async () => {
            const subjectName = input.value.trim();
            if (!subjectName) {
                new obsidian.Notice("과목명을 입력해주세요.");
                return;
            }

            try {
                const folderPath = `${this.settings.studyFolder}/${subjectName}`;
                await this.app.vault.createFolder(folderPath);
                new obsidian.Notice(`과목 폴더 생성: ${subjectName}`);
                input.value = "";
                this.updateSubjectFolderList(folderList);
            } catch (error) {
                new obsidian.Notice("폴더 생성 실패: " + error.message);
            }
        };

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                createBtn.click();
            }
        });
    }

    createDashboardFolderSection(container) {
        const section = container.createDiv({ cls: "folder-section" });
        section.createEl("h3", { text: "📊 대시보드 폴더 관리" });

        const dashboardDiv = section.createDiv({ cls: "dashboard-folder-info" });
        const nameSpan = dashboardDiv.createSpan({ 
            text: `📁 ${this.settings.dashboardFolder}`,
            cls: "folder-name"
        });

        const actions = dashboardDiv.createDiv({ cls: "folder-actions" });

        const openBtn = actions.createEl("button", {
            text: "열기",
            cls: "folder-action-btn open-btn"
        });
        openBtn.onclick = () => {
            const folder = this.app.vault.getAbstractFileByPath(this.settings.dashboardFolder);
            if (folder) {
                this.app.workspace.getLeaf().openFile(folder);
            } else {
                new obsidian.Notice("폴더가 존재하지 않습니다.");
            }
        };

        const createBtn = actions.createEl("button", {
            text: "생성",
            cls: "folder-action-btn create-btn"
        });
        createBtn.onclick = async () => {
            try {
                await this.app.vault.createFolder(this.settings.dashboardFolder);
                new obsidian.Notice("대시보드 폴더 생성 완료");
            } catch (error) {
                new obsidian.Notice("이미 존재하거나 생성할 수 없습니다.");
            }
        };

        const deleteBtn = actions.createEl("button", {
            text: "삭제",
            cls: "folder-action-btn delete-btn"
        });
        deleteBtn.onclick = async () => {
            const confirmed = await this.showConfirmDialog("정말로 대시보드 폴더를 삭제하시겠습니까?");
            if (confirmed) {
                try {
                    const folder = this.app.vault.getAbstractFileByPath(this.settings.dashboardFolder);
                    if (folder) {
                        await this.app.vault.delete(folder);
                        new obsidian.Notice("대시보드 폴더 삭제 완료");
                    }
                } catch (error) {
                    new obsidian.Notice("삭제 실패: " + error.message);
                }
            }
        };
    }

    updateSubjectFolderList(container) {
        container.empty();

        const studyFolder = this.app.vault.getAbstractFileByPath(this.settings.studyFolder);
        if (!studyFolder || !studyFolder.children) {
            container.createEl("p", { 
                text: "📝 아직 과목 폴더가 없습니다.",
                cls: "no-folders"
            });
            return;
        }

        const subjectFolders = studyFolder.children.filter(child => child.children);

        if (subjectFolders.length === 0) {
            container.createEl("p", { 
                text: "📝 아직 과목 폴더가 없습니다.",
                cls: "no-folders"
            });
            return;
        }

        subjectFolders.forEach(folder => {
            const folderItem = container.createDiv({ cls: "folder-item" });
            
            const nameSpan = folderItem.createSpan({ 
                text: `📁 ${folder.name}`,
                cls: "folder-name"
            });

            const actions = folderItem.createDiv({ cls: "folder-actions" });

            const openBtn = actions.createEl("button", {
                text: "열기",
                cls: "folder-action-btn open-btn"
            });
            openBtn.onclick = () => {
                this.app.workspace.getLeaf().openFile(folder);
            };

            const deleteBtn = actions.createEl("button", {
                text: "삭제",
                cls: "folder-action-btn delete-btn"
            });
            deleteBtn.onclick = async () => {
                const confirmed = await this.showConfirmDialog(`정말로 '${folder.name}' 과목을 삭제하시겠습니까?`);
                if (confirmed) {
                    try {
                        await this.app.vault.delete(folder);
                        new obsidian.Notice(`과목 삭제 완료: ${folder.name}`);
                        this.updateSubjectFolderList(container);
                    } catch (error) {
                        new obsidian.Notice("삭제 실패: " + error.message);
                    }
                }
            };
        });
    }

    async showConfirmDialog(message) {
        return new Promise((resolve) => {
            const modal = new obsidian.Modal(this.app);
            modal.contentEl.createEl("p", { text: message });
            
            const buttonDiv = modal.contentEl.createDiv({ cls: "modal-button-container" });
            buttonDiv.style.display = "flex";
            buttonDiv.style.justifyContent = "flex-end";
            buttonDiv.style.gap = "10px";
            buttonDiv.style.marginTop = "20px";

            const cancelBtn = buttonDiv.createEl("button", { text: "취소" });
            cancelBtn.onclick = () => {
                modal.close();
                resolve(false);
            };

            const confirmBtn = buttonDiv.createEl("button", { 
                text: "삭제", 
                cls: "mod-warning" 
            });
            confirmBtn.onclick = () => {
                modal.close();
                resolve(true);
            };

            modal.open();
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

module.exports = StructuredTableLearningPlugin;
