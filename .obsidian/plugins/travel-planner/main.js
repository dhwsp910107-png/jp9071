
const { Plugin, ItemView, PluginSettingTab, Setting, Notice, TFolder, TFile, Modal } = require('obsidian');

const VIEW_TYPE = 'travel-planner-view';

// ==================== 기본 설정 ====================
const DEFAULT_SETTINGS = {
    travelFolderPath: '여행',
    defaultCurrency: '원',
    defaultPeople: 2,
    trips: [],
    lastSelectedTrip: null,
    recentFilesLimit: 15
};

// ==================== 여행 대시보드 뷰 ====================
class TravelPlannerView extends ItemView {
    constructor(leaf, plugin) {
        super(leaf);
        this.plugin = plugin;
        this.currentTrip = null;
    }

    getViewType() {
        return VIEW_TYPE;
    }

    getDisplayText() {
        return '여행 플래너';
    }

    getIcon() {
        return 'plane';
    }

    async onOpen() {
        const container = this.containerEl.children[1];
        container.empty();
        container.style.cssText = 'height: 100%; overflow: hidden; padding: 0; margin: 0;';
        
        this.addStyles();
        
        if (!this.currentTrip) {
            if (this.plugin.settings.lastSelectedTrip) {
                const lastTrip = this.plugin.settings.trips.find(t => t.path === this.plugin.settings.lastSelectedTrip);
                if (lastTrip) {
                    this.currentTrip = lastTrip;
                }
            }
            
            if (!this.currentTrip && this.plugin.settings.trips.length > 0) {
                this.currentTrip = this.plugin.settings.trips[0];
                this.plugin.settings.lastSelectedTrip = this.currentTrip.path;
                await this.plugin.saveSettings();
            }
        }
        
        const mainContainer = container.createDiv({ cls: 'travel-planner-container' });
        
        const header = mainContainer.createDiv({ cls: 'tp-header' });
        this.renderHeader(header);
        
        const contentWrapper = mainContainer.createDiv({ cls: 'tp-content-wrapper' });
        
        const sidebar = contentWrapper.createDiv({ cls: 'tp-sidebar' });
        this.renderSidebar(sidebar);
        
        const main = contentWrapper.createDiv({ cls: 'tp-main' });
        
        if (this.currentTrip) {
            await this.renderTripDashboard(main);
        } else {
            this.renderNoTripSelected(main);
        }
    }

    renderHeader(header) {
        header.empty();
        
        const title = header.createDiv({ cls: 'tp-header-title' });
        title.setText('✈️ 여행 플래너');
        
        const nav = header.createDiv({ cls: 'tp-header-nav' });
        
        const dashboardBtn = nav.createEl('button', { cls: 'tp-nav-btn active', text: '📊 대시보드' });
        
        const checklistDashBtn = nav.createEl('button', { cls: 'tp-nav-btn', text: '📊 체크리스트' });
        checklistDashBtn.addEventListener('click', async () => {
            if (!this.currentTrip) {
                new Notice('⚠️ 여행을 먼저 선택해주세요!');
                return;
            }
            const dashboardPath = `${this.currentTrip.path}/체크리스트/📊 체크리스트 대시보드.md`;
            const file = this.app.vault.getAbstractFileByPath(dashboardPath);
            if (file instanceof TFile) {
                await this.app.workspace.getLeaf().openFile(file);
            } else {
                new Notice('❌ 체크리스트 대시보드를 찾을 수 없습니다.');
            }
        });
        
        const newTripBtn = nav.createEl('button', { cls: 'tp-nav-btn', text: '+ 새 여행' });
        newTripBtn.addEventListener('click', async () => {
            await this.plugin.createNewTrip();
        });
        
        const refreshBtn = nav.createEl('button', { cls: 'tp-nav-btn', text: '🔄 새로고침' });
        refreshBtn.addEventListener('click', async () => {
            await this.refresh();
        });
    }

    async refresh() {
        console.log('🔄 대시보드 새로고침 시작...');
        
        await this.plugin.loadSettings();
        
        if (this.currentTrip) {
            const stillExists = this.plugin.settings.trips.find(t => t.path === this.currentTrip.path);
            if (stillExists) {
                this.currentTrip = stillExists;
                console.log('✅ 현재 여행 유지:', this.currentTrip.name);
            } else {
                this.currentTrip = null;
                console.log('⚠️ 여행이 삭제되어 선택 해제됨');
            }
        }
        
        await this.onOpen();
        console.log('✅ 새로고침 완료!');
    }

    renderSidebar(sidebar) {
        sidebar.empty();
        
        const tripSection = sidebar.createDiv({ cls: 'tp-section' });
        const tripTitle = tripSection.createDiv({ cls: 'tp-section-title' });
        tripTitle.setText('🗺️ 여행 목록');
        
        const tripList = tripSection.createDiv({ cls: 'tp-trip-list' });
        
        if (this.plugin.settings.trips.length === 0) {
            const emptyMsg = tripList.createDiv({ cls: 'tp-empty-msg' });
            emptyMsg.setText('아직 여행이 없습니다');
            return;
        }
        
        // 여행 목록을 최근 수정 시간 순으로 정렬
        const sortedTrips = [...this.plugin.settings.trips].sort((a, b) => {
            const aTime = a.lastModified || a.createdAt || 0;
            const bTime = b.lastModified || b.createdAt || 0;
            return new Date(bTime) - new Date(aTime);
        });
        
        sortedTrips.forEach((trip, index) => {
            const originalIndex = this.plugin.settings.trips.indexOf(trip);
            const tripItem = tripList.createDiv({ cls: 'tp-trip-item' });
            
            if (this.currentTrip && this.currentTrip.path === trip.path) {
                tripItem.addClass('active');
            }
            
            const tripInfo = tripItem.createDiv({ cls: 'tp-trip-info' });
            
            const tripName = tripInfo.createDiv({ cls: 'tp-trip-name' });
            tripName.setText(trip.name);
            
            const tripMeta = tripInfo.createDiv({ cls: 'tp-trip-meta' });
            
            // 최근 활동 표시
            let metaText = this.getStatusText(trip.status);
            if (trip.lastModified) {
                const lastModified = new Date(trip.lastModified);
                const now = new Date();
                const diffHours = (now - lastModified) / (1000 * 60 * 60);
                
                if (diffHours < 24) {
                    metaText += ' • 🔥 최근 활동';
                } else if (diffHours < 168) { // 7일
                    const days = Math.floor(diffHours / 24);
                    metaText += ` • ${days}일 전`;
                }
            }
            
            tripMeta.setText(metaText);
            
            // 싱글 클릭 - 여행 선택
            tripItem.addEventListener('click', async () => {
                console.log('📌 여행 선택 클릭:', trip.name);
                
                this.currentTrip = trip;
                this.plugin.settings.lastSelectedTrip = trip.path;
                await this.plugin.saveSettings();
                
                console.log('✅ 여행 선택 저장 완료:', this.currentTrip.name);
                
                await this.refresh();
            });
            
            // 더블 클릭 - 메인 파일 열기
            tripItem.addEventListener('dblclick', async (e) => {
                e.stopPropagation();
                console.log('📂 여행 파일 열기:', trip.name);
                
                const mainFilePath = `${trip.path}/${trip.name}.md`;
                const file = this.app.vault.getAbstractFileByPath(mainFilePath);
                
                if (file instanceof TFile) {
                    await this.app.workspace.getLeaf().openFile(file);
                    new Notice(`📄 "${trip.name}" 파일을 열었습니다.`);
                } else {
                    new Notice(`❌ 파일을 찾을 수 없습니다: ${mainFilePath}`);
                }
            });
            
            // 우클릭 메뉴
            tripItem.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                this.showTripContextMenu(e, trip, originalIndex);
            });
        });
    }

    showTripContextMenu(e, trip, index) {
        const menu = document.createElement('div');
        menu.className = 'tp-context-menu';
        menu.style.cssText = `
            position: fixed;
            left: ${e.clientX}px;
            top: ${e.clientY}px;
            background: var(--background-secondary);
            border: 1px solid var(--background-modifier-border);
            border-radius: 6px;
            padding: 4px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            z-index: 10000;
            min-width: 180px;
        `;
        
        const menuItems = [
            { icon: '📂', text: '파일 열기', action: async () => {
                const mainFilePath = `${trip.path}/${trip.name}.md`;
                const file = this.app.vault.getAbstractFileByPath(mainFilePath);
                if (file instanceof TFile) {
                    await this.app.workspace.getLeaf().openFile(file);
                }
            }},
            { icon: '📍', text: '여행지 추가', action: async () => {
                this.currentTrip = trip;
                await this.addDestinationFromDashboard();
            }},
            { icon: '📅', text: '일정 추가', action: async () => {
                this.currentTrip = trip;
                await this.addScheduleFromDashboard();
            }},
            { icon: '💰', text: '경비 추가', action: async () => {
                this.currentTrip = trip;
                await this.addBudgetItemFromDashboard();
            }},
            { icon: '✅', text: '체크리스트 추가', action: async () => {
                this.currentTrip = trip;
                await this.addChecklistFromDashboard();
            }},
            { divider: true },
            { icon: '🗑️', text: '여행 삭제', action: async () => {
                const confirmed = await this.confirmDeleteTrip(trip.name);
                if (confirmed) {
                    await this.deleteTrip(index, trip.path);
                }
            }, danger: true }
        ];
        
        menuItems.forEach(item => {
            if (item.divider) {
                const divider = menu.createDiv();
                divider.style.cssText = 'height: 1px; background: var(--background-modifier-border); margin: 4px 0;';
                return;
            }
            
            const menuItem = menu.createDiv();
            menuItem.className = 'tp-context-menu-item';
            menuItem.style.cssText = `
                padding: 8px 12px;
                cursor: pointer;
                border-radius: 4px;
                display: flex;
                align-items: center;
                gap: 8px;
                color: ${item.danger ? '#e74c3c' : 'var(--text-normal)'};
                transition: background 0.1s;
            `;
            
            menuItem.innerHTML = `<span>${item.icon}</span><span>${item.text}</span>`;
            
            menuItem.addEventListener('mouseenter', () => {
                menuItem.style.background = 'var(--background-modifier-hover)';
            });
            
            menuItem.addEventListener('mouseleave', () => {
                menuItem.style.background = 'transparent';
            });
            
            menuItem.addEventListener('click', async () => {
                document.body.removeChild(menu);
                await item.action();
            });
            
            menu.appendChild(menuItem);
        });
        
        document.body.appendChild(menu);
        
        const closeMenu = (e) => {
            if (!menu.contains(e.target)) {
                if (document.body.contains(menu)) {
                    document.body.removeChild(menu);
                }
                document.removeEventListener('click', closeMenu);
            }
        };
        
        setTimeout(() => {
            document.addEventListener('click', closeMenu);
        }, 0);
    }

    async confirmDeleteTrip(tripName) {
        return new Promise((resolve) => {
            const modal = new ConfirmModal(
                this.app,
                `"${tripName}" 여행을 삭제하시겠습니까?`,
                '모든 데이터가 영구적으로 삭제됩니다.',
                resolve
            );
            modal.open();
        });
    }

    async deleteTrip(index, path) {
        try {
            const folder = this.app.vault.getAbstractFileByPath(path);
            if (folder instanceof TFolder) {
                await this.app.vault.delete(folder, true);
            }
            
            this.plugin.settings.trips.splice(index, 1);
            
            if (this.plugin.settings.lastSelectedTrip === path) {
                this.plugin.settings.lastSelectedTrip = null;
            }
            
            await this.plugin.saveSettings();
            
            new Notice('✅ 여행이 삭제되었습니다.');
            
            await this.refresh();
        } catch (error) {
            new Notice(`❌ 삭제 실패: ${error.message}`);
            console.error('여행 삭제 오류:', error);
        }
    }

    renderNoTripSelected(main) {
        main.empty();
        
        const emptyState = main.createDiv({ cls: 'tp-empty-state' });
        
        const icon = emptyState.createDiv({ cls: 'tp-empty-icon' });
        icon.setText('✈️');
        
        const title = emptyState.createDiv({ cls: 'tp-empty-title' });
        title.setText('여행을 선택하세요');
        
        const desc = emptyState.createDiv({ cls: 'tp-empty-desc' });
        desc.setText('왼쪽 사이드바에서 여행을 선택하거나 새 여행을 만들어보세요');
        
        const createBtn = emptyState.createEl('button', { cls: 'tp-btn-primary', text: '+ 새 여행 만들기' });
        createBtn.addEventListener('click', async () => {
            await this.plugin.createNewTrip();
        });
    }

    async renderTripDashboard(main) {
        main.empty();
        
        console.log('\n=== 🎯 대시보드 렌더링 시작 ===');
        console.log('✅ 선택된 여행:', this.currentTrip.name);
        
        const scrollContainer = main.createDiv({ cls: 'tp-scroll-container' });
        
        const tripHeader = scrollContainer.createDiv({ cls: 'tp-trip-header' });
        
        const tripTitle = tripHeader.createDiv({ cls: 'tp-trip-title' });
        tripTitle.setText(this.currentTrip.name);
        
        const tripActions = tripHeader.createDiv({ cls: 'tp-trip-actions' });
        
        const openFolderBtn = tripActions.createEl('button', { cls: 'tp-btn-small', text: '📁 폴더 열기' });
        openFolderBtn.addEventListener('click', async () => {
            const folder = this.app.vault.getAbstractFileByPath(this.currentTrip.path);
            if (folder instanceof TFolder) {
                const files = folder.children.filter(f => f instanceof TFile && f.extension === 'md');
                if (files.length > 0) {
                    await this.app.workspace.getLeaf().openFile(files[0]);
                } else {
                    new Notice('파일이 없습니다.');
                }
            }
        });
        
        const statusBadge = tripActions.createDiv({ cls: 'tp-status-badge' });
        statusBadge.setText(this.getStatusText(this.currentTrip.status));
        statusBadge.addClass(`status-${this.currentTrip.status}`);
        
        const statsGrid = scrollContainer.createDiv({ cls: 'tp-stats-grid' });
        
        const stats = await this.getTripStats(this.currentTrip.path);
        
        this.createStatCard(statsGrid, '📁', '총 파일', `${stats.totalFiles}개`);
        this.createStatCard(statsGrid, '📍', '여행지', `${stats.destinations}개`);
        this.createStatCard(statsGrid, '📅', '일정', `${stats.schedules}개`);
        this.createStatCard(statsGrid, '💰', '경비 항목', `${stats.budgetItems}개`);
        this.createStatCard(statsGrid, '📝', '메모', `${stats.notes}개`);
        this.createStatCard(statsGrid, '📷', '사진', `${stats.photos}개`);
        
        const quickActions = scrollContainer.createDiv({ cls: 'tp-section' });
        const quickTitle = quickActions.createDiv({ cls: 'tp-section-title' });
        quickTitle.setText('⚡ 빠른 작업');
        
        const actionsGrid = quickActions.createDiv({ cls: 'tp-actions-grid' });
        
        this.createActionButton(actionsGrid, '📍 여행지 추가', async () => {
            await this.addDestinationFromDashboard();
        });
        
        this.createActionButton(actionsGrid, '📅 일정 추가', async () => {
            await this.addScheduleFromDashboard();
        });
        
        this.createActionButton(actionsGrid, '💰 경비 추가', async () => {
            await this.addBudgetItemFromDashboard();
        });
        
        this.createActionButton(actionsGrid, '✅ 체크리스트 추가', async () => {
            await this.addChecklistFromDashboard();
        });
        
        this.createActionButton(actionsGrid, '✍️ 기록 작성', async () => {
            await this.addJournalEntryFromDashboard();
        });
        
        const recentSection = scrollContainer.createDiv({ cls: 'tp-section' });
        const recentTitle = recentSection.createDiv({ cls: 'tp-section-title' });
        recentTitle.setText('📄 최근 파일');
        
        const recentList = recentSection.createDiv({ cls: 'tp-recent-list' });
        await this.renderRecentFiles(recentList);
    }
async addDestinationFromDashboard() {
        if (!this.currentTrip) {
            new Notice('⚠️ 여행을 먼저 선택해주세요!');
            return;
        }

        const tripPath = this.currentTrip.path;
        
        const modal = new DestinationModal(this.app, async (name, location, priority) => {
            try {
                const fileName = `${name.replace(/[\/\\?%*:|"<>]/g, '-')}.md`;
                const filePath = `${tripPath}/여행지-${fileName}`;
                const content = `# ${name}

**위치:** ${location}
**우선순위:** ${priority}

## 📝 상세 정보

## 📷 사진
`;
                
                await this.app.vault.create(filePath, content);
                await this.plugin.addDestinationToMainFile(tripPath, name, location, priority);
                await this.plugin.updateTripLastModified(tripPath);
                
                new Notice(`✅ 여행지 "${name}"이(가) 추가되었습니다!`);
                await this.refresh();
                
                const file = this.app.vault.getAbstractFileByPath(filePath);
                if (file instanceof TFile) {
                    await this.app.workspace.getLeaf().openFile(file);
                }
            } catch (error) {
                new Notice(`❌ 여행지 추가 실패: ${error.message}`);
            }
        });
        modal.open();
    }

    async addScheduleFromDashboard() {
        if (!this.currentTrip) {
            new Notice('⚠️ 여행을 먼저 선택해주세요!');
            return;
        }

        const tripPath = this.currentTrip.path;
        
        const modal = new ScheduleModal(this.app, async (day, date) => {
            try {
                const fileName = `Day${day}-${date}.md`;
                const filePath = `${tripPath}/일정-${fileName}`;
                const content = `# Day ${day} - ${date}

## 📍 일정

### 오전
- **09:00 AM** - 

### 오후
- **02:00 PM** - 

### 저녁
- **07:00 PM** - 
`;
                
                await this.app.vault.create(filePath, content);
                await this.plugin.addScheduleToMainFile(tripPath, day, date);
                await this.plugin.updateTripLastModified(tripPath);
                
                new Notice(`✅ Day ${day} 일정이 추가되었습니다!`);
                await this.refresh();
            } catch (error) {
                new Notice(`❌ 일정 추가 실패: ${error.message}`);
            }
        });
        modal.open();
    }

    async addBudgetItemFromDashboard() {
        if (!this.currentTrip) {
            new Notice('⚠️ 여행을 먼저 선택해주세요!');
            return;
        }

        const tripPath = this.currentTrip.path;
        
        const modal = new BudgetItemModal(this.app, async (category, item, amount) => {
            try {
                const fileName = `${category}-${item.replace(/[\/\\?%*:|"<>]/g, '-')}.md`;
                const filePath = `${tripPath}/예산-${fileName}`;
                const content = `## ${category} - ${item}

**예산:** ${amount}${this.plugin.settings.defaultCurrency}
**실제 지출:** 0${this.plugin.settings.defaultCurrency}
`;
                
                await this.app.vault.create(filePath, content);
                await this.plugin.addBudgetToMainFile(tripPath, category, item, amount);
                await this.plugin.updateTripLastModified(tripPath);
                
                new Notice(`✅ 경비 항목 "${item}"이(가) 추가되었습니다!`);
                await this.refresh();
            } catch (error) {
                new Notice(`❌ 경비 항목 추가 실패: ${error.message}`);
            }
        });
        modal.open();
    }

    async addChecklistFromDashboard() {
        if (!this.currentTrip) {
            new Notice('⚠️ 여행을 먼저 선택해주세요!');
            return;
        }

        const tripPath = this.currentTrip.path;
        
        const modal = new ChecklistItemModal(this.app, async (category, item, emoji, saveAsFile) => {
            try {
                await this.plugin.addChecklistToMainFile(tripPath, category, item, emoji);
                
                if (saveAsFile) {
                    await this.plugin.saveChecklistAsFile(tripPath, category, item, emoji);
                }
                
                await this.plugin.updateTripLastModified(tripPath);
                
                new Notice(`✅ 체크리스트 항목 "${item}"이(가) 추가되었습니다!`);
                await this.refresh();
            } catch (error) {
                new Notice(`❌ 체크리스트 추가 실패: ${error.message}`);
            }
        });
        modal.open();
    }// ==================== Obsidian 여행 플래너 플러그인 ====================
// 파일명: main.js

    async addDestinationFromDashboard() {
        if (!this.currentTrip) {
            new Notice('⚠️ 여행을 먼저 선택해주세요!');
            return;
        }

        const tripPath = this.currentTrip.path;
        
        const modal = new DestinationModal(this.app, async (name, location, priority) => {
            try {
                const fileName = `${name.replace(/[\/\\?%*:|"<>]/g, '-')}.md`;
                const filePath = `${tripPath}/여행지-${fileName}`;
                const content = `# ${name}

**위치:** ${location}
**우선순위:** ${priority}

## 📝 상세 정보

## 📷 사진
`;
                
                await this.app.vault.create(filePath, content);
                await this.plugin.addDestinationToMainFile(tripPath, name, location, priority);
                
                new Notice(`✅ 여행지 "${name}"이(가) 추가되었습니다!`);
                await this.refresh();
                
                const file = this.app.vault.getAbstractFileByPath(filePath);
                if (file instanceof TFile) {
                    await this.app.workspace.getLeaf().openFile(file);
                }
            } catch (error) {
                new Notice(`❌ 여행지 추가 실패: ${error.message}`);
            }
        });
        modal.open();
    }

    async addScheduleFromDashboard() {
        if (!this.currentTrip) {
            new Notice('⚠️ 여행을 먼저 선택해주세요!');
            return;
        }

        const tripPath = this.currentTrip.path;
        
        const modal = new ScheduleModal(this.app, async (day, date) => {
            try {
                const fileName = `Day${day}-${date}.md`;
                const filePath = `${tripPath}/일정-${fileName}`;
                const content = `# Day ${day} - ${date}

## 📍 일정

### 오전
- **09:00 AM** - 

### 오후
- **02:00 PM** - 

### 저녁
- **07:00 PM** - 
`;
                
                await this.app.vault.create(filePath, content);
                await this.plugin.addScheduleToMainFile(tripPath, day, date);
                
                new Notice(`✅ Day ${day} 일정이 추가되었습니다!`);
                await this.refresh();
            } catch (error) {
                new Notice(`❌ 일정 추가 실패: ${error.message}`);
            }
        });
        modal.open();
    }

    async addBudgetItemFromDashboard() {
        if (!this.currentTrip) {
            new Notice('⚠️ 여행을 먼저 선택해주세요!');
            return;
        }

        const tripPath = this.currentTrip.path;
        
        const modal = new BudgetItemModal(this.app, async (category, item, amount) => {
            try {
                const fileName = `${category}-${item.replace(/[\/\\?%*:|"<>]/g, '-')}.md`;
                const filePath = `${tripPath}/예산-${fileName}`;
                const content = `## ${category} - ${item}

**예산:** ${amount}${this.plugin.settings.defaultCurrency}
**실제 지출:** 0${this.plugin.settings.defaultCurrency}
`;
                
                await this.app.vault.create(filePath, content);
                await this.plugin.addBudgetToMainFile(tripPath, category, item, amount);
                
                new Notice(`✅ 경비 항목 "${item}"이(가) 추가되었습니다!`);
                await this.refresh();
            } catch (error) {
                new Notice(`❌ 경비 항목 추가 실패: ${error.message}`);
            }
        });
        modal.open();
    }

    async addChecklistFromDashboard() {
        if (!this.currentTrip) {
            new Notice('⚠️ 여행을 먼저 선택해주세요!');
            return;
        }

        const tripPath = this.currentTrip.path;
        
        const modal = new ChecklistItemModal(this.app, async (category, item, emoji, saveAsFile) => {
            try {
                await this.plugin.addChecklistToMainFile(tripPath, category, item, emoji);
                
                if (saveAsFile) {
                    await this.plugin.saveChecklistAsFile(tripPath, category, item, emoji);
                }
                
                new Notice(`✅ 체크리스트 항목 "${item}"이(가) 추가되었습니다!`);
                await this.refresh();
            } catch (error) {
                new Notice(`❌ 체크리스트 추가 실패: ${error.message}`);
            }
        });
        modal.open();
    }

    async addJournalEntryFromDashboard() {
        console.log('✍️ 여행 기록 작성 시작...');
        console.log('현재 여행:', this.currentTrip);
        
        if (!this.currentTrip) {
            new Notice('⚠️ 여행을 먼저 선택해주세요!');
            console.error('❌ currentTrip이 null입니다!');
            return;
        }

        const tripPath = this.currentTrip.path;
        const today = new Date().toISOString().split('T')[0];
        const fileName = `여행기록-${today}.md`;
        const memoFolderPath = `${tripPath}/메모`;
        const filePath = `${memoFolderPath}/${fileName}`;
        
        console.log('📁 메모 폴더:', memoFolderPath);
        console.log('📄 파일 경로:', filePath);
        
        try {
            // 메모 폴더 확인 및 생성
            const memoFolder = this.app.vault.getAbstractFileByPath(memoFolderPath);
            if (!memoFolder) {
                console.log('📁 메모 폴더가 없습니다. 생성합니다:', memoFolderPath);
                await this.app.vault.createFolder(memoFolderPath);
                await this.plugin.sleep(100);
                console.log('✅ 메모 폴더 생성 완료');
            } else {
                console.log('✅ 메모 폴더 존재함');
            }
            
            // 파일이 이미 존재하는지 확인
            const existingFile = this.app.vault.getAbstractFileByPath(filePath);
            if (existingFile instanceof TFile) {
                console.log('⚠️ 파일이 이미 존재합니다. 기존 파일을 엽니다.');
                new Notice('⚠️ 오늘 날짜의 기록이 이미 존재합니다. 기존 파일을 열겠습니다.');
                await this.app.workspace.getLeaf().openFile(existingFile);
                await this.plugin.updateTripLastModified(tripPath);
                await this.refresh();
                return;
            }
            
            const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][new Date().getDay()];
            const content = `# 여행 기록 - ${today} (${dayOfWeek})

**날씨:** ☀️
**기분:** 😊

## 🌟 오늘의 하이라이트

## 📍 방문한 곳

### 장소 1


## 💰 지출 내역

| 항목 | 금액 | 메모 |
|------|------|------|
|  |  |  |

**총 지출:** 0원

## 🍽️ 맛집 & 음식

## 📷 사진

## ⭐ 오늘의 만족도
⭐⭐⭐⭐⭐ (5/5)

## 💭 오늘의 한마디


## 📝 기타 메모

---
*작성일시: ${new Date().toLocaleString('ko-KR')}*
`;
            
            console.log('📝 파일 생성 중...');
            await this.app.vault.create(filePath, content);
            console.log('✅ 파일 생성 완료');
            
            // 메인 파일에 여행 기록 링크 추가
            console.log('🔗 메인 파일에 링크 추가...');
            await this.plugin.addJournalLinkToMainFile(tripPath, fileName, today);
            
            // 여행 목록에 최근 활동 반영
            console.log('⏰ 최근 활동 시간 업데이트...');
            await this.plugin.updateTripLastModified(tripPath);
            
            new Notice(`✅ 오늘의 여행 기록이 생성되었습니다!`);
            
            console.log('🔄 대시보드 새로고침...');
            await this.refresh();
            
            const file = this.app.vault.getAbstractFileByPath(filePath);
            if (file instanceof TFile) {
                console.log('📂 파일 열기...');
                await this.app.workspace.getLeaf().openFile(file);
                console.log('✅ 모든 작업 완료!');
            }
        } catch (error) {
            console.error('❌ 여행 기록 생성 실패:', error);
            new Notice(`❌ 여행 기록 생성 실패: ${error.message}`);
        }
    }

    async renderRecentFiles(container) {
        const folder = this.app.vault.getAbstractFileByPath(this.currentTrip.path);
        if (!(folder instanceof TFolder)) {
            container.createDiv({ cls: 'tp-empty-msg', text: '폴더를 찾을 수 없습니다' });
            return;
        }
        
        const allFiles = [];
        const collectFiles = (folder) => {
            folder.children.forEach(child => {
                if (child instanceof TFile && child.extension === 'md') {
                    allFiles.push(child);
                } else if (child instanceof TFolder) {
                    collectFiles(child);
                }
            });
        };
        collectFiles(folder);
        
        // 생성 시간 기준으로 정렬
        const files = allFiles
            .sort((a, b) => b.stat.ctime - a.stat.ctime)
            .slice(0, 10);
        
        if (files.length === 0) {
            container.createDiv({ cls: 'tp-empty-msg', text: '파일이 없습니다' });
            return;
        }
        
        files.forEach(file => {
            const fileItem = container.createDiv({ cls: 'tp-file-item' });
            
            const fileInfo = fileItem.createDiv({ cls: 'tp-file-info' });
            
            const fileName = fileInfo.createDiv({ cls: 'tp-file-name' });
            fileName.setText(file.basename);
            
            const filePath = fileInfo.createDiv({ cls: 'tp-file-path' });
            filePath.setText(file.path.replace(this.currentTrip.path + '/', ''));
            
            const fileDate = fileItem.createDiv({ cls: 'tp-file-date' });
            fileDate.setText(new Date(file.stat.ctime).toLocaleDateString('ko-KR'));
            
            fileItem.addEventListener('click', async () => {
                await this.app.workspace.getLeaf().openFile(file);
            });
        });
    }

    async getTripStats(tripPath) {
        try {
            const folder = this.app.vault.getAbstractFileByPath(tripPath);
            if (!(folder instanceof TFolder)) {
                return { totalFiles: 0, destinations: 0, schedules: 0, budgetItems: 0, notes: 0, photos: 0 };
            }
            
            const files = folder.children.filter(f => f instanceof TFile && f.extension === 'md');
            const destinations = files.filter(f => f.basename.startsWith('여행지-')).length;
            const schedules = files.filter(f => f.basename.startsWith('일정-')).length;
            const budgetItems = files.filter(f => f.basename.startsWith('예산-')).length;
            
            const notesFolder = this.app.vault.getAbstractFileByPath(`${tripPath}/메모`);
            const notes = notesFolder instanceof TFolder ? notesFolder.children.filter(f => f instanceof TFile).length : 0;
            
            // 사진 폴더 - 모든 파일 타입 카운트 (이미지 파일 포함)
            const photosFolder = this.app.vault.getAbstractFileByPath(`${tripPath}/사진`);
            let photos = 0;
            if (photosFolder instanceof TFolder) {
                // 이미지 확장자 목록
                const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'heic', 'heif'];
                photos = photosFolder.children.filter(f => {
                    if (f instanceof TFile) {
                        const ext = f.extension.toLowerCase();
                        return imageExtensions.includes(ext);
                    }
                    return false;
                }).length;
            }
            
            return { totalFiles: files.length, destinations, schedules, budgetItems, notes, photos };
        } catch (error) {
            console.error('통계 계산 오류:', error);
            return { totalFiles: 0, destinations: 0, schedules: 0, budgetItems: 0, notes: 0, photos: 0 };
        }
    }

    createStatCard(container, icon, label, value) {
        const card = container.createDiv({ cls: 'tp-stat-card' });
        const cardIcon = card.createDiv({ cls: 'tp-stat-icon' });
        cardIcon.setText(icon);
        const cardContent = card.createDiv({ cls: 'tp-stat-content' });
        const cardLabel = cardContent.createDiv({ cls: 'tp-stat-label' });
        cardLabel.setText(label);
        const cardValue = cardContent.createDiv({ cls: 'tp-stat-value' });
        cardValue.setText(value);
    }

    createActionButton(container, text, onClick) {
        const btn = container.createDiv({ cls: 'tp-action-btn' });
        btn.setText(text);
        btn.style.cssText = 'cursor: pointer; user-select: none;';
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('🖱️ 액션 버튼 클릭:', text);
            try {
                await onClick();
            } catch (error) {
                console.error('❌ 액션 버튼 오류:', error);
                new Notice(`❌ 오류 발생: ${error.message}`);
            }
        });
    }

    getStatusText(status) {
        const statusMap = {
            'planning': '📝 계획 중',
            'ongoing': '✈️ 여행 중',
            'completed': '✅ 완료'
        };
        return statusMap[status] || '📝 계획 중';
    }

    addStyles() {
        if (document.getElementById('travel-planner-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'travel-planner-styles';
        style.textContent = `
            .travel-planner-container { display: flex; flex-direction: column; height: 100%; background: var(--background-primary); color: var(--text-normal); }
            .tp-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 20px; background: var(--background-secondary); border-bottom: 2px solid var(--interactive-accent); box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1); }
            .tp-header-title { font-size: 1.3rem; font-weight: bold; color: var(--interactive-accent); }
            .tp-header-nav { display: flex; gap: 8px; }
            .tp-nav-btn { background: var(--background-modifier-form-field); color: var(--text-normal); border: 1px solid var(--background-modifier-border); padding: 6px 16px; border-radius: 6px; cursor: pointer; transition: all 0.2s; font-size: 0.9rem; font-weight: 500; }
            .tp-nav-btn:hover { background: var(--background-modifier-hover); border-color: var(--interactive-accent); transform: translateY(-1px); }
            .tp-nav-btn.active { background: var(--interactive-accent); color: var(--text-on-accent); font-weight: bold; }
            .tp-content-wrapper { display: flex; flex: 1; overflow: hidden; }
            .tp-sidebar { width: 280px; background: var(--background-secondary); padding: 20px; overflow-y: auto; border-right: 1px solid var(--background-modifier-border); }
            .tp-section { background: var(--background-primary-alt); border-radius: 8px; padding: 16px; margin-bottom: 20px; }
            .tp-section-title { font-weight: bold; margin-bottom: 12px; color: var(--interactive-accent); font-size: 1rem; }
            .tp-trip-list { display: flex; flex-direction: column; gap: 8px; }
            .tp-trip-item { background: var(--background-secondary); padding: 12px; border-radius: 8px; cursor: pointer; transition: all 0.2s; border: 2px solid transparent; user-select: none; }
            .tp-trip-item:hover { background: var(--background-modifier-hover); border-color: var(--interactive-accent); }
            .tp-trip-item.active { border-color: var(--interactive-accent); background: var(--interactive-hover); }
            .tp-context-menu { font-size: 0.9rem; }
            .tp-context-menu-item:active { transform: scale(0.98); }
            .tp-trip-name { font-weight: 600; margin-bottom: 4px; }
            .tp-trip-meta { font-size: 0.85rem; color: var(--text-muted); }
            .tp-main { flex: 1; overflow-y: auto; padding: 20px; }
            .tp-scroll-container { max-width: 1200px; margin: 0 auto; }
            .tp-empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; gap: 20px; text-align: center; }
            .tp-empty-icon { font-size: 5rem; }
            .tp-empty-title { font-size: 1.5rem; font-weight: bold; }
            .tp-empty-desc { color: var(--text-muted); max-width: 400px; }
            .tp-btn-primary { background: var(--interactive-accent); color: var(--text-on-accent); border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 1rem; transition: all 0.2s; }
            .tp-btn-primary:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2); }
            .tp-trip-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid var(--background-modifier-border); }
            .tp-trip-title { font-size: 2rem; font-weight: bold; }
            .tp-trip-actions { display: flex; gap: 10px; align-items: center; }
            .tp-btn-small { background: var(--interactive-accent); color: var(--text-on-accent); border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 0.85rem; transition: all 0.2s; }
            .tp-btn-small:hover { transform: scale(1.05); }
            .tp-status-badge { padding: 6px 14px; border-radius: 20px; font-size: 0.85rem; font-weight: 600; }
            .tp-status-badge.status-planning { background: rgba(245, 158, 11, 0.2); color: rgb(245, 158, 11); }
            .tp-status-badge.status-ongoing { background: rgba(59, 130, 246, 0.2); color: rgb(59, 130, 246); }
            .tp-status-badge.status-completed { background: rgba(34, 197, 94, 0.2); color: rgb(34, 197, 94); }
            .tp-stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 30px; }
            .tp-stat-card { background: var(--background-primary-alt); padding: 20px; border-radius: 12px; display: flex; gap: 15px; align-items: center; transition: all 0.2s; }
            .tp-stat-card:hover { transform: translateY(-4px); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); }
            .tp-stat-icon { font-size: 2rem; }
            .tp-stat-label { font-size: 0.85rem; color: var(--text-muted); margin-bottom: 4px; }
            .tp-stat-value { font-size: 1.2rem; font-weight: bold; }
            .tp-actions-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; }
            .tp-action-btn { background: var(--interactive-accent); color: var(--text-on-accent); padding: 15px; border-radius: 8px; text-align: center; cursor: pointer; font-weight: 600; transition: all 0.2s; }
            .tp-action-btn:hover { transform: scale(1.05); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2); }
            .tp-recent-list { display: flex; flex-direction: column; gap: 8px; }
            .tp-file-item { display: flex; justify-content: space-between; align-items: center; padding: 12px; background: var(--background-secondary); border-radius: 8px; cursor: pointer; transition: all 0.2s; gap: 10px; }
            .tp-file-item:hover { background: var(--background-modifier-hover); transform: translateX(5px); }
            .tp-file-info { flex: 1; }
            .tp-file-name { font-weight: 600; margin-bottom: 4px; }
            .tp-file-path { font-size: 0.75rem; color: var(--text-muted); }
            .tp-file-date { font-size: 0.85rem; color: var(--text-muted); }
            .tp-empty-msg { text-align: center; color: var(--text-muted); padding: 20px; }
            @media (max-width: 768px) {
                .tp-content-wrapper { flex-direction: column; }
                .tp-sidebar { width: 100%; max-height: 200px; border-right: none; border-bottom: 1px solid var(--background-modifier-border); }
                .tp-stats-grid { grid-template-columns: repeat(2, 1fr); }
                .tp-actions-grid { grid-template-columns: 1fr; }
            }
        `;
        document.head.appendChild(style);
    }

    async onClose() {
        const style = document.getElementById('travel-planner-styles');
        if (style) style.remove();
    }
}

// ==================== 메인 플러그인 클래스 ====================
class TravelPlannerPlugin extends Plugin {
    async onload() {
        console.log('여행 플래너 플러그인 로딩...');
        
        await this.loadSettings();
        
        this.registerView(VIEW_TYPE, (leaf) => {
            const view = new TravelPlannerView(leaf, this);
            this.dashboardView = view;
            return view;
        });
        
        this.addSettingTab(new TravelPlannerSettingTab(this.app, this));
        await this.ensureTravelFolder();
        
        this.addRibbonIcon('plane', '여행 플래너 열기', () => {
            this.activateView();
        });
        
        this.registerCommands();
        new Notice('✈️ 여행 플래너 플러그인이 활성화되었습니다!');
    }

    async onunload() {
        console.log('여행 플래너 플러그인 언로딩...');
        this.dashboardView = null;
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    async activateView() {
        const { workspace } = this.app;
        let leaf = null;
        const leaves = workspace.getLeavesOfType(VIEW_TYPE);
        
        if (leaves.length > 0) {
            leaf = leaves[0];
            this.dashboardView = leaf.view;
        } else {
            leaf = workspace.getRightLeaf(false);
            await leaf.setViewState({ type: VIEW_TYPE, active: true });
            this.dashboardView = leaf.view;
        }
        
        workspace.revealLeaf(leaf);
    }

    async refreshDashboard() {
        if (this.dashboardView && typeof this.dashboardView.refresh === 'function') {
            await this.dashboardView.refresh();
        }
    }

    async ensureTravelFolder() {
        const folderPath = this.settings.travelFolderPath;
        const folder = this.app.vault.getAbstractFileByPath(folderPath);
        
        if (!folder) {
            try {
                await this.app.vault.createFolder(folderPath);
                await this.sleep(100);
            } catch (error) {
                // 폴더가 이미 존재하는 경우는 무시
                if (error.message !== 'Folder already exists.') {
                    console.error('폴더 생성 실패:', error);
                }
            }
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async createNewTrip() {
        const tripName = await this.promptTripName();
        if (!tripName) return;
        
        const tripFolder = `${this.settings.travelFolderPath}/${tripName}`;
        
        try {
            await this.app.vault.createFolder(tripFolder);
            await this.sleep(50);
            
            await this.app.vault.createFolder(`${tripFolder}/사진`);
            await this.sleep(50);
            
            await this.app.vault.createFolder(`${tripFolder}/메모`);
            await this.sleep(50);
            
            await this.app.vault.createFolder(`${tripFolder}/체크리스트`);
            await this.sleep(50);
            
            await this.createTripTemplate(tripFolder, tripName);
            
            const newTrip = {
                name: tripName,
                path: tripFolder,
                createdAt: new Date().toISOString(),
                status: 'planning'
            };
            
            this.settings.trips.push(newTrip);
            this.settings.lastSelectedTrip = tripFolder;
            await this.saveSettings();
            
            await this.createChecklistDashboard(newTrip);
            
            console.log('✅ 여행 생성 완료!');
            new Notice(`✈️ "${tripName}" 여행이 생성되었습니다!`);
            
            await this.refreshDashboard();
            
            const file = this.app.vault.getAbstractFileByPath(`${tripFolder}/${tripName}.md`);
            if (file instanceof TFile) {
                await this.app.workspace.getLeaf().openFile(file);
            }
        } catch (error) {
            new Notice(`❌ 여행 생성 실패: ${error.message}`);
            console.error('여행 생성 오류:', error);
        }
    }

    async promptTripName() {
        return new Promise((resolve) => {
            const modal = new TripNameModal(this.app, (name) => resolve(name));
            modal.open();
        });
    }

    async createTripTemplate(tripFolder, tripName) {
        const template = this.generateTripTemplate(tripName);
        await this.app.vault.create(`${tripFolder}/${tripName}.md`, template);
    }

    generateTripTemplate(tripName) {
        const today = new Date().toISOString().split('T')[0];
        
        return `---
title: ${tripName}
created: ${today}
status: planning
---

# ✈️ ${tripName}

## 📋 여행 정보

| 항목 | 내용 |
|------|------|
| **여행 기간** | 0박 0일 |
| **목적지** | |
| **인원** | ${this.settings.defaultPeople}명 |
| **총 예산** | 0${this.settings.defaultCurrency} |

## 💰 경비 관리

| 카테고리 | 항목 | 예산 | 실제 |
|---------|------|------|------|

## 📍 방문할 곳

## 📅 일정표

## ✅ 체크리스트

### 📋 예약 사항
- [ ] 항공권 예약
- [ ] 숙소 예약

### 🎒 짐 챙기기
- [ ] 여권/비자
- [ ] 옷가지

### 📱 출발 전 준비
- [ ] 환전
- [ ] 여행자 보험

---

## ✍️ 여행 기록

> 여행 중 작성한 기록들이 여기에 자동으로 추가됩니다.

---
*마지막 수정: ${today}*
`;
    }

    registerCommands() {
        this.addCommand({
            id: 'open-travel-dashboard',
            name: '여행 대시보드 열기',
            callback: () => this.activateView()
        });

        this.addCommand({
            id: 'create-new-trip',
            name: '새 여행 만들기',
            callback: async () => await this.createNewTrip()
        });
    }

    // 여행의 최근 수정 시간 업데이트
    async updateTripLastModified(tripPath) {
        const trip = this.settings.trips.find(t => t.path === tripPath);
        if (trip) {
            trip.lastModified = new Date().toISOString();
            await this.saveSettings();
            console.log('✅ 여행 최근 활동 업데이트:', trip.name);
        }
    }

    // 메인 파일에 여행 기록 링크 추가
    async addJournalLinkToMainFile(tripPath, fileName, date) {
        try {
            const trip = this.settings.trips.find(t => t.path === tripPath);
            if (!trip) return;
            
            const mainFilePath = `${tripPath}/${trip.name}.md`;
            const mainFile = this.app.vault.getAbstractFileByPath(mainFilePath);
            if (!(mainFile instanceof TFile)) return;
            
            let content = await this.app.vault.read(mainFile);
            
            // 여행 기록 섹션 찾기
            const journalSectionRegex = /## ✍️ 여행 기록([\s\S]*?)(?=\n---|\n## |$)/;
            const match = content.match(journalSectionRegex);
            
            if (match) {
                const journalSection = match[0];
                const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][new Date(date).getDay()];
                
                // 새로운 기록 링크 추가
                const newJournalLink = `\n- [[메모/${fileName}|📝 ${date} (${dayOfWeek})]]`;
                
                // "여기에 자동으로 추가됩니다" 텍스트 뒤에 추가
                let updatedSection = journalSection;
                if (journalSection.includes('여기에 자동으로 추가됩니다')) {
                    updatedSection = journalSection.replace(
                        /> 여행 중 작성한 기록들이 여기에 자동으로 추가됩니다\./,
                        `> 여행 중 작성한 기록들이 여기에 자동으로 추가됩니다.\n${newJournalLink}`
                    );
                } else {
                    // 섹션 끝에 추가
                    updatedSection = journalSection + newJournalLink;
                }
                
                content = content.replace(journalSection, updatedSection);
                await this.app.vault.modify(mainFile, content);
                console.log('✅ 메인 파일에 여행 기록 링크 추가 완료');
            }
        } catch (error) {
            console.error('❌ 메인 파일 여행 기록 링크 추가 실패:', error);
        }
    }

    getCategoryEmoji(category) {
        const emojiMap = {
            '항공권': '✈️',
            '숙박': '🏨',
            '식비': '🍜',
            '관광': '🎫',
            '교통': '🚇',
            '쇼핑': '🛍️',
            '예약 사항': '📋',
            '짐 챙기기': '🎒',
            '출발 전 준비': '📱'
        };
        return emojiMap[category] || '💵';
    }

    async addBudgetToMainFile(tripPath, category, item, amount) {
        try {
            const trip = this.settings.trips.find(t => t.path === tripPath);
            if (!trip) return;
            
            const mainFilePath = `${tripPath}/${trip.name}.md`;
            const mainFile = this.app.vault.getAbstractFileByPath(mainFilePath);
            if (!(mainFile instanceof TFile)) return;
            
            let content = await this.app.vault.read(mainFile);
            const emoji = this.getCategoryEmoji(category);
            const newRow = `| ${emoji} ${category} | ${item} | ${amount}원 |  |`;
            
            const tableMatch = content.match(/## 💰 경비 관리[\s\S]*?\n(\|.*\|[\s\S]*?)(?=\n## |\n---|\n$)/);
            if (tableMatch) {
                const table = tableMatch[1];
                const lines = table.split('\n').filter(line => line.trim());
                lines.push(newRow);
                const updatedTable = lines.join('\n');
                content = content.replace(table, updatedTable);
                await this.app.vault.modify(mainFile, content);
            }
        } catch (error) {
            console.error('❌ 메인 파일 경비 추가 실패:', error);
        }
    }

    async addDestinationToMainFile(tripPath, name, location, priority) {
        try {
            const trip = this.settings.trips.find(t => t.path === tripPath);
            if (!trip) return;
            
            const mainFilePath = `${tripPath}/${trip.name}.md`;
            const mainFile = this.app.vault.getAbstractFileByPath(mainFilePath);
            if (!(mainFile instanceof TFile)) return;
            
            let content = await this.app.vault.read(mainFile);
            
            const priorityText = priority === 'high' ? '#필수' : priority === 'medium' ? '#추천' : '#선택';
            const newDestination = `\n- [ ] **${name}**\n  - 📍 위치: ${location}\n  - ⏰ 소요시간: \n  - 💰 비용: \n  - 📝 메모: \n  - 🏷️ 태그: ${priorityText}\n`;
            
            const insertMatch = content.match(/## 📍 방문할 곳[\s\S]*?(?=\n## )/);
            if (insertMatch) {
                const section = insertMatch[0];
                const updatedSection = section + newDestination;
                content = content.replace(section, updatedSection);
                await this.app.vault.modify(mainFile, content);
            }
        } catch (error) {
            console.error('❌ 메인 파일 여행지 추가 실패:', error);
        }
    }

    async addScheduleToMainFile(tripPath, day, date) {
        try {
            const trip = this.settings.trips.find(t => t.path === tripPath);
            if (!trip) return;
            
            const mainFilePath = `${tripPath}/${trip.name}.md`;
            const mainFile = this.app.vault.getAbstractFileByPath(mainFilePath);
            if (!(mainFile instanceof TFile)) return;
            
            let content = await this.app.vault.read(mainFile);
            
            const dateObj = new Date(date);
            const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][dateObj.getDay()];
            
            const newSchedule = `\n### DAY ${day} - ${date} (${dayOfWeek})\n\n- **10:00 AM** - 출발\n  - 메모: \n\n- **02:00 PM** - \n  - 메모: \n\n- **07:00 PM** - 저녁 식사\n  - 메모: \n`;
            
            const insertPosition = content.indexOf('## ✅ 체크리스트');
            if (insertPosition !== -1) {
                content = content.slice(0, insertPosition) + newSchedule + '\n' + content.slice(insertPosition);
                await this.app.vault.modify(mainFile, content);
            }
        } catch (error) {
            console.error('❌ 메인 파일 일정 추가 실패:', error);
        }
    }

    async addChecklistToMainFile(tripPath, category, item, customEmoji = '') {
        try {
            const trip = this.settings.trips.find(t => t.path === tripPath);
            if (!trip) return;
            
            const mainFilePath = `${tripPath}/${trip.name}.md`;
            const mainFile = this.app.vault.getAbstractFileByPath(mainFilePath);
            if (!(mainFile instanceof TFile)) return;
            
            let content = await this.app.vault.read(mainFile);
            
            const categoryEmoji = customEmoji || this.getCategoryEmoji(category);
            const categoryHeader = `### ${categoryEmoji} ${category}`;
            
            let categoryIndex = content.indexOf(categoryHeader);
            
            if (categoryIndex === -1) {
                const checklistStart = content.indexOf('## ✅ 체크리스트');
                const afterChecklist = content.substring(checklistStart);
                const nextSectionMatch = afterChecklist.match(/\n---\n|\n## /);
                
                let insertPos = nextSectionMatch ? checklistStart + nextSectionMatch.index : content.length;
                const newCategorySection = `\n${categoryHeader}\n- [ ] ${item}\n`;
                content = content.slice(0, insertPos) + newCategorySection + content.slice(insertPos);
            } else {
                const afterCategory = content.substring(categoryIndex);
                const nextSectionMatch = afterCategory.match(/\n### |\n---\n|\n## /);
                const insertPosition = nextSectionMatch ? categoryIndex + nextSectionMatch.index : content.length;
                const newItem = `- [ ] ${item}\n`;
                content = content.slice(0, insertPosition) + newItem + content.slice(insertPosition);
            }
            
            await this.app.vault.modify(mainFile, content);
        } catch (error) {
            console.error('❌ 메인 파일 체크리스트 추가 실패:', error);
        }
    }

    async saveChecklistAsFile(tripPath, category, item, emoji) {
        try {
            const checklistFolder = `${tripPath}/체크리스트`;
            const folder = this.app.vault.getAbstractFileByPath(checklistFolder);
            
            if (!folder) {
                await this.app.vault.createFolder(checklistFolder);
                await this.sleep(50);
            }
            
            const safeCategory = category.replace(/[/\\?%*:|"<>]/g, '-');
            const safeItem = item.replace(/[/\\?%*:|"<>]/g, '-');
            const fileName = `${safeCategory}-${safeItem}.md`;
            const filePath = `${checklistFolder}/${fileName}`;
            
            const existingFile = this.app.vault.getAbstractFileByPath(filePath);
            if (existingFile) return;
            
            const today = new Date().toISOString().split('T')[0];
            const emojiDisplay = emoji || '📌';
            const content = `---
category: ${category}
item: ${item}
status: incomplete
created: ${today}
tags:
  - checklist
  - ${category}
---

# ${emojiDisplay} ${item}

**카테고리:** ${category}
**생성일:** ${today}
**상태:** ⬜ 미완료

## 📝 상세 내용

## ✅ 완료 조건

- [ ] 

## 📎 관련 링크

## 💡 메모

---

> 이 항목은 메인 여행 파일의 "${category}" 섹션과 연동됩니다.
`;
            
            await this.app.vault.create(filePath, content);
        } catch (error) {
            console.error('❌ 체크리스트 파일 저장 실패:', error);
        }
    }

    async createChecklistDashboard(trip) {
        try {
            const checklistFolder = `${trip.path}/체크리스트`;
            const dashboardPath = `${checklistFolder}/📊 체크리스트 대시보드.md`;
            
            const folder = this.app.vault.getAbstractFileByPath(checklistFolder);
            if (!folder) {
                await this.app.vault.createFolder(checklistFolder);
                await this.sleep(50);
            }
            
            const content = `# 📊 체크리스트 대시보드

> 이 대시보드는 모든 체크리스트 항목을 한눈에 보여줍니다.

---

## 📈 전체 진행률

\`\`\`dataviewjs
const pages = dv.pages('"${trip.path}"').where(p => p.file.name === "${trip.name}");

if (pages.length === 0) {
    dv.paragraph("❌ 메인 파일을 찾을 수 없습니다.");
} else {
    const mainFile = pages[0];
    const content = await dv.io.load(mainFile.file.path);
    const checklistMatch = content.match(/## ✅ 체크리스트([\\s\\S]*?)(?=\\n## |\\n---|$)/);
    
    if (checklistMatch) {
        const checklistSection = checklistMatch[1];
        const allItems = checklistSection.match(/- \\[.\\]/g) || [];
        const completedItems = checklistSection.match(/- \\[x\\]/gi) || [];
        
        const total = allItems.length;
        const completed = completedItems.length;
        const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
        
        dv.paragraph(\`**📊 진행 상황:** \${completed}/\${total} 완료 (\${percentage}%)\`);
        
        const progressBar = \`<div style="width: 100%; background: var(--background-modifier-border); border-radius: 10px; height: 30px; overflow: hidden; margin: 10px 0;"><div style="width: \${percentage}%; background: linear-gradient(90deg, #4ade80, #22c55e); height: 100%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">\${percentage}%</div></div>\`;
        
        dv.paragraph(progressBar);
    } else {
        dv.paragraph("❌ 체크리스트 섹션을 찾을 수 없습니다.");
    }
}
\`\`\`

---

## ⏳ 미완료 항목

\`\`\`dataviewjs
const pages = dv.pages('"${trip.path}"').where(p => p.file.name === "${trip.name}");

if (pages.length === 0) {
    dv.paragraph("❌ 메인 파일을 찾을 수 없습니다.");
} else {
    const mainFile = pages[0];
    const content = await dv.io.load(mainFile.file.path);
    const checklistMatch = content.match(/## ✅ 체크리스트([\\s\\S]*?)(?=\\n## |\\n---|$)/);
    
    if (checklistMatch) {
        const checklistSection = checklistMatch[1];
        const categories = checklistSection.split(/\\n### /).filter(s => s.trim());
        let hasIncomplete = false;
        
        categories.forEach(categorySection => {
            const firstLine = categorySection.split('\\n')[0];
            const categoryName = firstLine.trim();
            const lines = categorySection.split('\\n');
            const incompleteItems = lines.filter(line => line.trim().match(/^- \\[ \\]/));
            
            if (incompleteItems.length > 0 && categoryName) {
                hasIncomplete = true;
                dv.header(4, categoryName);
                incompleteItems.forEach(item => {
                    const itemText = item.replace(/^- \\[ \\]\\s*/, '');
                    dv.paragraph(\`- ⬜ \${itemText}\`);
                });
            }
        });
        
        if (!hasIncomplete) {
            dv.paragraph("🎉 모든 체크리스트가 완료되었습니다!");
        }
    }
}
\`\`\`

---

*마지막 업데이트: ${new Date().toISOString().split('T')[0]}*`;
            
            await this.app.vault.create(dashboardPath, content);
        } catch (error) {
            console.error('❌ 대시보드 생성 실패:', error);
        }
    }
}

// ==================== 모달 클래스들 ====================

class TripNameModal extends Modal {
    constructor(app, onSubmit) {
        super(app);
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        contentEl.createEl('h2', { text: '✈️ 새 여행 만들기' });
        
        const input = contentEl.createEl('input', { type: 'text', placeholder: '예: 일본 도쿄 여행' });
        input.style.cssText = 'width: 100%; padding: 10px; margin: 10px 0 20px 0;';
        
        const buttonContainer = contentEl.createDiv();
        buttonContainer.style.cssText = 'display: flex; gap: 10px; justify-content: flex-end;';
        
        const cancelBtn = buttonContainer.createEl('button', { text: '취소' });
        cancelBtn.addEventListener('click', () => {
            this.close();
            this.onSubmit(null);
        });
        
        const createBtn = buttonContainer.createEl('button', { text: '생성' });
        createBtn.style.cssText = 'background: var(--interactive-accent); color: var(--text-on-accent);';
        createBtn.addEventListener('click', () => {
            const tripName = input.value.trim();
            if (tripName) {
                this.close();
                this.onSubmit(tripName);
            }
        });
        
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && input.value.trim()) {
                this.close();
                this.onSubmit(input.value.trim());
            }
        });
        
        input.focus();
    }

    onClose() {
        this.contentEl.empty();
    }
}

class DestinationModal extends Modal {
    constructor(app, onSubmit) {
        super(app);
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        contentEl.createEl('h2', { text: '📍 여행지 추가' });
        
        const form = contentEl.createDiv();
        
        form.createEl('label', { text: '여행지 이름' });
        const nameInput = form.createEl('input', { type: 'text' });
        nameInput.style.cssText = 'width: 100%; padding: 8px; margin-bottom: 15px;';
        
        form.createEl('label', { text: '위치' });
        const locationInput = form.createEl('input', { type: 'text' });
        locationInput.style.cssText = 'width: 100%; padding: 8px; margin-bottom: 15px;';
        
        form.createEl('label', { text: '우선순위' });
        const prioritySelect = form.createEl('select');
        prioritySelect.style.cssText = 'width: 100%; padding: 8px; margin-bottom: 20px;';
        prioritySelect.innerHTML = `
            <option value="high">🔴 필수</option>
            <option value="medium">🟡 추천</option>
            <option value="low">🟢 선택</option>
        `;
        
        const buttonContainer = form.createDiv();
        buttonContainer.style.cssText = 'display: flex; gap: 10px; justify-content: flex-end;';
        
        const cancelBtn = buttonContainer.createEl('button', { text: '취소' });
        cancelBtn.addEventListener('click', () => this.close());
        
        const submitBtn = buttonContainer.createEl('button', { text: '추가' });
        submitBtn.style.cssText = 'background: var(--interactive-accent); color: var(--text-on-accent);';
        submitBtn.addEventListener('click', () => {
            if (nameInput.value.trim()) {
                this.onSubmit(nameInput.value.trim(), locationInput.value.trim(), prioritySelect.value);
                this.close();
            }
        });
        
        nameInput.focus();
    }

    onClose() {
        this.contentEl.empty();
    }
}

class ScheduleModal extends Modal {
    constructor(app, onSubmit) {
        super(app);
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        contentEl.createEl('h2', { text: '📅 일정 추가' });
        
        const form = contentEl.createDiv();
        
        form.createEl('label', { text: 'Day' });
        const dayInput = form.createEl('input', { type: 'number', value: '1' });
        dayInput.style.cssText = 'width: 100%; padding: 8px; margin-bottom: 15px;';
        
        form.createEl('label', { text: '날짜' });
        const dateInput = form.createEl('input', { type: 'date' });
        dateInput.style.cssText = 'width: 100%; padding: 8px; margin-bottom: 20px;';
        dateInput.valueAsDate = new Date();
        
        const buttonContainer = form.createDiv();
        buttonContainer.style.cssText = 'display: flex; gap: 10px; justify-content: flex-end;';
        
        const cancelBtn = buttonContainer.createEl('button', { text: '취소' });
        cancelBtn.addEventListener('click', () => this.close());
        
        const submitBtn = buttonContainer.createEl('button', { text: '추가' });
        submitBtn.style.cssText = 'background: var(--interactive-accent); color: var(--text-on-accent);';
        submitBtn.addEventListener('click', () => {
            if (dayInput.value && dateInput.value) {
                this.onSubmit(dayInput.value, dateInput.value);
                this.close();
            }
        });
    }

    onClose() {
        this.contentEl.empty();
    }
}

class BudgetItemModal extends Modal {
    constructor(app, onSubmit) {
        super(app);
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        contentEl.createEl('h2', { text: '💰 경비 항목 추가' });
        
        const form = contentEl.createDiv();
        
        form.createEl('label', { text: '카테고리' });
        const categorySelect = form.createEl('select');
        categorySelect.style.cssText = 'width: 100%; padding: 8px; margin-bottom: 15px;';
        categorySelect.innerHTML = `
            <option value="항공권">✈️ 항공권</option>
            <option value="숙박">🏨 숙박</option>
            <option value="식비">🍜 식비</option>
            <option value="관광">🎫 관광</option>
            <option value="교통">🚇 교통</option>
            <option value="쇼핑">🛍️ 쇼핑</option>
        `;
        
        form.createEl('label', { text: '항목' });
        const itemInput = form.createEl('input', { type: 'text' });
        itemInput.style.cssText = 'width: 100%; padding: 8px; margin-bottom: 15px;';
        
        form.createEl('label', { text: '예산' });
        const amountInput = form.createEl('input', { type: 'number' });
        amountInput.style.cssText = 'width: 100%; padding: 8px; margin-bottom: 20px;';
        
        const buttonContainer = form.createDiv();
        buttonContainer.style.cssText = 'display: flex; gap: 10px; justify-content: flex-end;';
        
        const cancelBtn = buttonContainer.createEl('button', { text: '취소' });
        cancelBtn.addEventListener('click', () => this.close());
        
        const submitBtn = buttonContainer.createEl('button', { text: '추가' });
        submitBtn.style.cssText = 'background: var(--interactive-accent); color: var(--text-on-accent);';
        submitBtn.addEventListener('click', () => {
            if (itemInput.value.trim() && amountInput.value) {
                this.onSubmit(categorySelect.value, itemInput.value.trim(), amountInput.value);
                this.close();
            }
        });
    }

    onClose() {
        this.contentEl.empty();
    }
}

class ChecklistItemModal extends Modal {
    constructor(app, onSubmit) {
        super(app);
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        contentEl.createEl('h2', { text: '✅ 체크리스트 항목 추가' });
        
        const form = contentEl.createDiv();
        
        form.createEl('label', { text: '카테고리' });
        const categorySelect = form.createEl('select');
        categorySelect.style.cssText = 'width: 100%; padding: 8px; margin-bottom: 15px;';
        categorySelect.innerHTML = `
            <option value="예약 사항">📋 예약 사항</option>
            <option value="짐 챙기기">🎒 짐 챙기기</option>
            <option value="출발 전 준비">📱 출발 전 준비</option>
            <option value="custom">✨ 새 카테고리 추가...</option>
        `;
        
        const customCategoryContainer = form.createDiv();
        customCategoryContainer.style.cssText = 'display: none; margin-bottom: 15px;';
        
        customCategoryContainer.createEl('label', { text: '새 카테고리 이름' });
        const customCategoryInput = customCategoryContainer.createEl('input', { 
            type: 'text', 
            placeholder: '예: 관광지 확인' 
        });
        customCategoryInput.style.cssText = 'width: 100%; padding: 8px; margin-top: 5px;';
        
        const emojiLabel = customCategoryContainer.createEl('label', { text: '이모지 (선택)' });
        emojiLabel.style.cssText = 'margin-top: 10px; display: block;';
        const customEmojiInput = customCategoryContainer.createEl('input', { 
            type: 'text', 
            placeholder: '예: 🏖️' 
        });
        customEmojiInput.style.cssText = 'width: 100%; padding: 8px; margin-top: 5px;';
        
        categorySelect.addEventListener('change', () => {
            customCategoryContainer.style.display = categorySelect.value === 'custom' ? 'block' : 'none';
            if (categorySelect.value === 'custom') customCategoryInput.focus();
        });
        
        form.createEl('label', { text: '항목' });
        const itemInput = form.createEl('input', { type: 'text', placeholder: '예: 호텔 예약' });
        itemInput.style.cssText = 'width: 100%; padding: 8px; margin-bottom: 15px;';
        
        const fileOptionContainer = form.createDiv();
        fileOptionContainer.style.cssText = 'margin-bottom: 20px;';
        
        const saveAsFileCheckbox = fileOptionContainer.createEl('input', { type: 'checkbox' });
        saveAsFileCheckbox.id = 'saveAsFile';
        saveAsFileCheckbox.style.cssText = 'margin-right: 8px;';
        
        const saveAsFileLabel = fileOptionContainer.createEl('label');
        saveAsFileLabel.htmlFor = 'saveAsFile';
        saveAsFileLabel.setText('📄 별도 파일로도 저장 (체크리스트 폴더)');
        saveAsFileLabel.style.cssText = 'cursor: pointer;';
        
        const buttonContainer = form.createDiv();
        buttonContainer.style.cssText = 'display: flex; gap: 10px; justify-content: flex-end;';
        
        const cancelBtn = buttonContainer.createEl('button', { text: '취소' });
        cancelBtn.addEventListener('click', () => this.close());
        
        const submitBtn = buttonContainer.createEl('button', { text: '추가' });
        submitBtn.style.cssText = 'background: var(--interactive-accent); color: var(--text-on-accent);';
        submitBtn.addEventListener('click', () => {
            let category = categorySelect.value;
            let emoji = '';
            
            if (category === 'custom') {
                if (!customCategoryInput.value.trim()) {
                    new Notice('⚠️ 카테고리 이름을 입력해주세요!');
                    return;
                }
                category = customCategoryInput.value.trim();
                emoji = customEmojiInput.value.trim() || '📌';
            }
            
            if (itemInput.value.trim()) {
                this.onSubmit(category, itemInput.value.trim(), emoji, saveAsFileCheckbox.checked);
                this.close();
            }
        });
        
        itemInput.focus();
    }

    onClose() {
        this.contentEl.empty();
    }
}

class ConfirmModal extends Modal {
    constructor(app, title, message, onConfirm) {
        super(app);
        this.title = title;
        this.message = message;
        this.onConfirm = onConfirm;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        contentEl.createEl('h2', { text: this.title });
        contentEl.createEl('p', { text: this.message });
        
        const buttonContainer = contentEl.createDiv();
        buttonContainer.style.cssText = 'display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;';
        
        const cancelBtn = buttonContainer.createEl('button', { text: '취소' });
        cancelBtn.addEventListener('click', () => {
            this.close();
            this.onConfirm(false);
        });
        
        const confirmBtn = buttonContainer.createEl('button', { text: '삭제' });
        confirmBtn.style.cssText = 'background: #e74c3c; color: white;';
        confirmBtn.addEventListener('click', () => {
            this.close();
            this.onConfirm(true);
        });
    }

    onClose() {
        this.contentEl.empty();
    }
}

// ==================== 설정 탭 ====================
class TravelPlannerSettingTab extends PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        const { containerEl } = this;
        containerEl.empty();
        
        containerEl.createEl('h2', { text: '✈️ 여행 플래너 설정' });
        
        new Setting(containerEl)
            .setName('여행 폴더 경로')
            .setDesc('모든 여행 데이터가 저장될 폴더')
            .addText(text => text
                .setPlaceholder('여행')
                .setValue(this.plugin.settings.travelFolderPath)
                .onChange(async (value) => {
                    this.plugin.settings.travelFolderPath = value;
                    await this.plugin.saveSettings();
                }));
        
        new Setting(containerEl)
            .setName('기본 통화')
            .setDesc('경비 관리에 사용할 통화 단위')
            .addText(text => text
                .setPlaceholder('원')
                .setValue(this.plugin.settings.defaultCurrency)
                .onChange(async (value) => {
                    this.plugin.settings.defaultCurrency = value;
                    await this.plugin.saveSettings();
                }));
        
        new Setting(containerEl)
            .setName('기본 인원')
            .setDesc('새 여행 생성 시 기본 인원 수')
            .addText(text => text
                .setPlaceholder('2')
                .setValue(String(this.plugin.settings.defaultPeople))
                .onChange(async (value) => {
                    this.plugin.settings.defaultPeople = parseInt(value) || 2;
                    await this.plugin.saveSettings();
                }));
        
        new Setting(containerEl)
            .setName('최근 파일 표시 개수')
            .setDesc('대시보드에 표시할 최근 수정된 파일 개수')
            .addText(text => text
                .setPlaceholder('15')
                .setValue(String(this.plugin.settings.recentFilesLimit))
                .onChange(async (value) => {
                    this.plugin.settings.recentFilesLimit = parseInt(value) || 15;
                    await this.plugin.saveSettings();
                }));
        
        containerEl.createEl('h3', { text: '📋 여행 관리' });
        
        this.displayTripsList(containerEl);
    }

    displayTripsList(containerEl) {
        const tripsContainer = containerEl.createDiv();
        tripsContainer.style.marginTop = '20px';
        
        if (this.plugin.settings.trips.length === 0) {
            tripsContainer.createEl('p', { 
                text: '아직 생성된 여행이 없습니다.',
                cls: 'setting-item-description'
            });
            return;
        }
        
        this.plugin.settings.trips.forEach((trip, index) => {
            const tripItem = new Setting(tripsContainer)
                .setName(trip.name)
                .setDesc(`${trip.path} | ${new Date(trip.createdAt).toLocaleDateString('ko-KR')}`);
            
            tripItem.addButton(button => button
                .setButtonText('📁 열기')
                .onClick(async () => {
                    const folder = this.app.vault.getAbstractFileByPath(trip.path);
                    if (folder instanceof TFolder) {
                        const files = folder.children.filter(f => f instanceof TFile);
                        if (files.length > 0) {
                            await this.app.workspace.getLeaf().openFile(files[0]);
                        }
                    }
                }));
            
            tripItem.addButton(button => button
                .setButtonText('🗑️ 삭제')
                .setWarning()
                .onClick(async () => {
                    const confirmed = await this.confirmDelete(trip.name);
                    if (confirmed) {
                        await this.deleteTrip(index, trip.path);
                    }
                }));
        });
    }

    async confirmDelete(tripName) {
        return new Promise((resolve) => {
            const modal = new ConfirmModal(
                this.app,
                `"${tripName}" 여행을 삭제하시겠습니까?`,
                '모든 데이터가 삭제됩니다.',
                resolve
            );
            modal.open();
        });
    }

    async deleteTrip(index, path) {
        try {
            const folder = this.app.vault.getAbstractFileByPath(path);
            if (folder instanceof TFolder) {
                await this.app.vault.delete(folder, true);
            }
            
            this.plugin.settings.trips.splice(index, 1);
            
            if (this.plugin.settings.lastSelectedTrip === path) {
                this.plugin.settings.lastSelectedTrip = null;
            }
            
            await this.plugin.saveSettings();
            
            new Notice('✅ 여행이 삭제되었습니다.');
            
            await this.plugin.refreshDashboard();
            
            this.display();
        } catch (error) {
            new Notice(`❌ 삭제 실패: ${error.message}`);
        }
    }
}

module.exports = TravelPlannerPlugin;