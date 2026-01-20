const { Plugin, Modal, Setting, PluginSettingTab, Notice, TFile, MarkdownView } = require('obsidian');

const DEFAULT_SETTINGS = {
    defaultView: 'filled', // 'filled' or 'empty'
    autoSave: true,
    folders: [] // 폴더별 관리
};

// 메인 선택 모달
class HexagramSelectModal extends Modal {
    constructor(app, plugin) {
        super(app);
        this.plugin = plugin;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('hexagram-select-modal');

        contentEl.createEl('h2', { text: '주역 64괘 표 삽입' });

        const buttonContainer = contentEl.createDiv({ cls: 'hexagram-button-container' });

        // 빈 표 버튼
        const emptyBtn = buttonContainer.createEl('button', { 
            text: '📝 빈 표 삽입',
            cls: 'hexagram-select-btn'
        });
        emptyBtn.addEventListener('click', () => {
            this.insertTable('empty');
            this.close();
        });

        // 채워진 표 버튼
        const filledBtn = buttonContainer.createEl('button', { 
            text: '✅ 채워진 표 삽입',
            cls: 'hexagram-select-btn'
        });
        filledBtn.addEventListener('click', () => {
            this.insertTable('filled');
            this.close();
        });

        // 미리보기 버튼
        const previewBtn = buttonContainer.createEl('button', { 
            text: '👁️ 미리보기',
            cls: 'hexagram-select-btn'
        });
        previewBtn.addEventListener('click', () => {
            new HexagramPreviewModal(this.app, this.plugin).open();
        });

        // 대시보드 버튼
        const dashboardBtn = buttonContainer.createEl('button', { 
            text: '📊 대시보드',
            cls: 'hexagram-select-btn'
        });
        dashboardBtn.addEventListener('click', () => {
            new HexagramDashboardModal(this.app, this.plugin).open();
        });

        // 스타일 추가
        this.addStyles();
    }

    insertTable(type) {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (view) {
            const editor = view.editor;
            const table = type === 'empty' ? 
                this.plugin.generateEmptyTable() : 
                this.plugin.generateFilledTable();
            editor.replaceSelection(table);
            new Notice('표가 삽입되었습니다!');
        }
    }

    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .hexagram-select-modal .modal-content {
                padding: 20px;
            }
            .hexagram-button-container {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 15px;
                margin-top: 20px;
            }
            .hexagram-select-btn {
                padding: 20px;
                font-size: 16px;
                border-radius: 8px;
                border: 2px solid var(--interactive-accent);
                background: var(--background-secondary);
                cursor: pointer;
                transition: all 0.3s;
            }
            .hexagram-select-btn:hover {
                background: var(--interactive-accent);
                color: var(--text-on-accent);
                transform: translateY(-2px);
            }
        `;
        document.head.appendChild(style);
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// 미리보기 모달
class HexagramPreviewModal extends Modal {
    constructor(app, plugin) {
        super(app);
        this.plugin = plugin;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('hexagram-preview-modal');

        contentEl.createEl('h2', { text: '주역 64괘 표 미리보기' });

        const tabContainer = contentEl.createDiv({ cls: 'hexagram-tab-container' });
        
        const emptyTab = tabContainer.createEl('button', { 
            text: '빈 표',
            cls: 'hexagram-tab active'
        });
        const filledTab = tabContainer.createEl('button', { 
            text: '채워진 표',
            cls: 'hexagram-tab'
        });

        const previewContainer = contentEl.createDiv({ cls: 'hexagram-preview-container' });
        
        // 초기 미리보기 (빈 표)
        this.renderPreview(previewContainer, 'empty');

        emptyTab.addEventListener('click', () => {
            emptyTab.addClass('active');
            filledTab.removeClass('active');
            this.renderPreview(previewContainer, 'empty');
        });

        filledTab.addEventListener('click', () => {
            filledTab.addClass('active');
            emptyTab.removeClass('active');
            this.renderPreview(previewContainer, 'filled');
        });

        this.addPreviewStyles();
    }

    renderPreview(container, type) {
        container.empty();
        const table = type === 'empty' ? 
            this.plugin.generateEmptyTable() : 
            this.plugin.generateFilledTable();
        
        // 마크다운을 HTML로 간단히 변환
        const htmlTable = this.convertMarkdownTableToHtml(table);
        container.innerHTML = htmlTable;
    }

    convertMarkdownTableToHtml(markdown) {
        const lines = markdown.split('\n');
        let html = '<table class="hexagram-preview-table">';
        
        lines.forEach((line, index) => {
            if (line.includes('|') && !line.includes(':---:')) {
                const cells = line.split('|').filter(cell => cell.trim());
                html += '<tr>';
                cells.forEach(cell => {
                    const content = cell.trim().replace(/<br>/g, '<br>');
                    const isBold = content.includes('**');
                    const cleanContent = content.replace(/\*\*/g, '');
                    const tag = isBold ? 'th' : 'td';
                    html += `<${tag}>${cleanContent}</${tag}>`;
                });
                html += '</tr>';
            }
        });
        
        html += '</table>';
        return html;
    }

    addPreviewStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .hexagram-preview-modal .modal-content {
                max-width: 800px;
                padding: 20px;
            }
            .hexagram-tab-container {
                display: flex;
                gap: 10px;
                margin-bottom: 20px;
            }
            .hexagram-tab {
                padding: 10px 20px;
                border: none;
                background: var(--background-secondary);
                border-radius: 8px;
                cursor: pointer;
            }
            .hexagram-tab.active {
                background: var(--interactive-accent);
                color: var(--text-on-accent);
            }
            .hexagram-preview-container {
                overflow: auto;
                max-height: 600px;
                border: 1px solid var(--background-modifier-border);
                border-radius: 8px;
                padding: 20px;
            }
            .hexagram-preview-table {
                width: 100%;
                border-collapse: collapse;
            }
            .hexagram-preview-table th,
            .hexagram-preview-table td {
                border: 1px solid var(--background-modifier-border);
                padding: 8px;
                text-align: center;
            }
            .hexagram-preview-table th {
                background: var(--background-secondary);
                font-weight: bold;
            }
        `;
        document.head.appendChild(style);
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// 대시보드 모달
class HexagramDashboardModal extends Modal {
    constructor(app, plugin) {
        super(app);
        this.plugin = plugin;
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('hexagram-dashboard-modal');

        contentEl.createEl('h2', { text: '주역 64괘 대시보드' });

        // 통계 섹션
        const statsContainer = contentEl.createDiv({ cls: 'hexagram-stats' });
        await this.renderStats(statsContainer);

        // 폴더별 관리 섹션
        const folderSection = contentEl.createDiv({ cls: 'hexagram-folder-section' });
        folderSection.createEl('h3', { text: '폴더별 관리' });
        this.renderFolderManagement(folderSection);

        this.addDashboardStyles();
    }

    async renderStats(container) {
        const files = this.app.vault.getMarkdownFiles();
        let hexagramFileCount = 0;
        const folderCounts = {};

        for (const file of files) {
            const content = await this.app.vault.read(file);
            if (content.includes('주역') || content.includes('064') || content.includes('067')) {
                hexagramFileCount++;
                const folder = file.parent.path || 'root';
                folderCounts[folder] = (folderCounts[folder] || 0) + 1;
            }
        }

        const statsGrid = container.createDiv({ cls: 'stats-grid' });
        
        const totalCard = statsGrid.createDiv({ cls: 'stat-card' });
        totalCard.createEl('div', { text: '📁 전체 파일', cls: 'stat-label' });
        totalCard.createEl('div', { text: hexagramFileCount.toString(), cls: 'stat-value' });

        const folderCard = statsGrid.createDiv({ cls: 'stat-card' });
        folderCard.createEl('div', { text: '📂 폴더 수', cls: 'stat-label' });
        folderCard.createEl('div', { text: Object.keys(folderCounts).length.toString(), cls: 'stat-value' });

        const recentCard = statsGrid.createDiv({ cls: 'stat-card' });
        recentCard.createEl('div', { text: '⏰ 최근 사용', cls: 'stat-label' });
        recentCard.createEl('div', { text: '오늘', cls: 'stat-value' });
    }

    renderFolderManagement(container) {
        const folderList = container.createDiv({ cls: 'folder-list' });

        // 폴더 추가 버튼
        const addBtn = container.createEl('button', { 
            text: '+ 폴더 추가',
            cls: 'hexagram-add-folder-btn'
        });
        
        addBtn.addEventListener('click', () => {
            new FolderSelectModal(this.app, this.plugin, (folder) => {
                if (!this.plugin.settings.folders.includes(folder)) {
                    this.plugin.settings.folders.push(folder);
                    this.plugin.saveSettings();
                    this.renderFolderList(folderList);
                    new Notice('폴더가 추가되었습니다!');
                }
            }).open();
        });

        this.renderFolderList(folderList);
    }

    renderFolderList(container) {
        container.empty();
        
        if (this.plugin.settings.folders.length === 0) {
            container.createEl('p', { 
                text: '추가된 폴더가 없습니다.',
                cls: 'empty-message'
            });
            return;
        }

        this.plugin.settings.folders.forEach((folder, index) => {
            const folderItem = container.createDiv({ cls: 'folder-item' });
            folderItem.createEl('span', { text: `📁 ${folder}` });
            
            const removeBtn = folderItem.createEl('button', { 
                text: '✕',
                cls: 'remove-folder-btn'
            });
            
            removeBtn.addEventListener('click', () => {
                this.plugin.settings.folders.splice(index, 1);
                this.plugin.saveSettings();
                this.renderFolderList(container);
                new Notice('폴더가 제거되었습니다!');
            });
        });
    }

    addDashboardStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .hexagram-dashboard-modal .modal-content {
                max-width: 700px;
                padding: 20px;
            }
            .hexagram-stats {
                margin-bottom: 30px;
            }
            .stats-grid {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 15px;
                margin-top: 15px;
            }
            .stat-card {
                background: var(--background-secondary);
                padding: 20px;
                border-radius: 8px;
                text-align: center;
            }
            .stat-label {
                font-size: 14px;
                color: var(--text-muted);
                margin-bottom: 10px;
            }
            .stat-value {
                font-size: 32px;
                font-weight: bold;
                color: var(--interactive-accent);
            }
            .hexagram-folder-section {
                margin-top: 20px;
            }
            .hexagram-add-folder-btn {
                width: 100%;
                padding: 12px;
                margin: 15px 0;
                border: 2px dashed var(--interactive-accent);
                background: transparent;
                border-radius: 8px;
                cursor: pointer;
                color: var(--interactive-accent);
            }
            .hexagram-add-folder-btn:hover {
                background: var(--background-secondary);
            }
            .folder-list {
                margin-top: 15px;
            }
            .folder-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 12px;
                background: var(--background-secondary);
                border-radius: 8px;
                margin-bottom: 8px;
            }
            .remove-folder-btn {
                background: var(--background-modifier-error);
                color: white;
                border: none;
                border-radius: 4px;
                padding: 4px 10px;
                cursor: pointer;
            }
            .empty-message {
                text-align: center;
                color: var(--text-muted);
                padding: 20px;
            }
        `;
        document.head.appendChild(style);
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// 폴더 선택 모달
class FolderSelectModal extends Modal {
    constructor(app, plugin, onSelect) {
        super(app);
        this.plugin = plugin;
        this.onSelect = onSelect;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl('h2', { text: '폴더 선택' });

        const folders = this.getAllFolders();
        const folderList = contentEl.createDiv({ cls: 'folder-select-list' });

        folders.forEach(folder => {
            const folderItem = folderList.createEl('div', { 
                text: folder || '루트',
                cls: 'folder-select-item'
            });
            
            folderItem.addEventListener('click', () => {
                this.onSelect(folder);
                this.close();
            });
        });
    }

    getAllFolders() {
        const folders = new Set(['']);
        this.app.vault.getAllLoadedFiles().forEach(file => {
            if (file.parent) {
                folders.add(file.parent.path);
            }
        });
        return Array.from(folders).sort();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// 설정 탭
class HexagramSettingTab extends PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: '주역 64괘 표 설정' });

        new Setting(containerEl)
            .setName('기본 보기 설정')
            .setDesc('아이콘 클릭시 기본으로 보여줄 표 형식')
            .addDropdown(dropdown => dropdown
                .addOption('filled', '채워진 표')
                .addOption('empty', '빈 표')
                .setValue(this.plugin.settings.defaultView)
                .onChange(async (value) => {
                    this.plugin.settings.defaultView = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('자동 저장')
            .setDesc('표 삽입 시 자동으로 파일 저장')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.autoSave)
                .onChange(async (value) => {
                    this.plugin.settings.autoSave = value;
                    await this.plugin.saveSettings();
                }));

        containerEl.createEl('h3', { text: '관리 폴더' });
        
        const folderContainer = containerEl.createDiv({ cls: 'folder-settings-container' });
        this.displayFolders(folderContainer);
    }

    displayFolders(container) {
        container.empty();
        
        if (this.plugin.settings.folders.length === 0) {
            container.createEl('p', { 
                text: '설정된 폴더가 없습니다.',
                cls: 'setting-item-description'
            });
        } else {
            this.plugin.settings.folders.forEach((folder, index) => {
                const folderSetting = new Setting(container)
                    .setName(folder || '루트')
                    .addButton(button => button
                        .setButtonText('제거')
                        .onClick(async () => {
                            this.plugin.settings.folders.splice(index, 1);
                            await this.plugin.saveSettings();
                            this.displayFolders(container);
                        }));
            });
        }
    }
}

// 메인 플러그인
module.exports = class HexagramPlugin extends Plugin {
    async onload() {
        await this.loadSettings();

        // 리본 아이콘 추가
        const ribbonIconEl = this.addRibbonIcon('table', '주역 64괘 표', (evt) => {
            new HexagramSelectModal(this.app, this).open();
        });

        // 명령어 추가
        this.addCommand({
            id: 'open-hexagram-modal',
            name: '주역 64괘 표 열기',
            callback: () => {
                new HexagramSelectModal(this.app, this).open();
            }
        });

        this.addCommand({
            id: 'insert-empty-hexagram-table',
            name: '빈 주역 64괘 표 삽입',
            editorCallback: (editor, view) => {
                editor.replaceSelection(this.generateEmptyTable());
                new Notice('빈 표가 삽입되었습니다!');
            }
        });

        this.addCommand({
            id: 'insert-filled-hexagram-table',
            name: '주역 64괘 표 삽입',
            editorCallback: (editor, view) => {
                editor.replaceSelection(this.generateFilledTable());
                new Notice('채워진 표가 삽입되었습니다!');
            }
        });

        this.addCommand({
            id: 'open-hexagram-dashboard',
            name: '주역 64괘 대시보드',
            callback: () => {
                new HexagramDashboardModal(this.app, this).open();
            }
        });

        // 설정 탭 추가
        this.addSettingTab(new HexagramSettingTab(this.app, this));
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    generateEmptyTable() {
        return `| **70.분** | | | **80.지** | | | **90.형** | | |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| 067<br> | 068<br> | 069<br> | 077<br> | 078<br> | 079<br> | 087<br> | 088<br> | 089<br> |
| 064<br> | 065<br> | 066<br> | 074<br> | 075<br> | 076<br> | 084<br> | 085<br> | 086<br> |
| 061<br> | 062<br> | 063<br> | 071<br> | 072<br> | 073<br> | 081<br> | 082<br> | 083<br> |
| **40.목** | | | **50.전** | | | **60.인** | | |
| 037<br> | 038<br> | 039<br> | 047<br> | 048<br> | 049<br> | 057<br> | 058<br> | 059<br> |
| 034<br> | 035<br> | 036<br> | 044<br> | 045<br> | 046<br> | 054<br> | 055<br> | 056<br> |
| 031<br> | 032<br> | 033<br> | 041<br> | 042<br> | 043<br> | 051<br> | 052<br> | 053<br> |
| **10.산** | | | **20.탐** | | | **30.고** | | |
| 007<br> | 008<br> | 009<br> | 017<br> | 018<br> | 019<br> | 027<br> | 028<br> | 029<br> |
| 004<br> | 005<br> | 006<br> | 014<br> | 015<br> | 016<br> | 024<br> | 025<br> | 026<br> |
| 001<br> | 002<br> | 003<br> | 011<br> | 012<br> | 013<br> | 021<br> | 022<br> | 023<br> |`;
    }

    generateFilledTable() {
        return `| **70.분** | | | **80.지** | | | **90.형** | | |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| 067<br>력 | 068<br>염 | 069<br>후 | 077<br>증 | 078<br>회 | 079<br>계 | 087<br>천 | 088<br>원 | 089<br>정 |
| 064<br>화 | 065<br>사 | 066<br>위 | 074<br>분 | 075<br>반 | 076<br>송 | 084<br>백 | 085<br>백 | 086<br>숙 |
| 061<br>곡 | 062<br>진 | 063<br>륜 | 071<br>두 | 072<br>일 | 073<br>륙 | 081<br>조 | 082<br>막 | 083<br>모 |
| **40.목** | | | **50.전** | | | **60.인** | | |
| 037<br>일 | 038<br>월 | 039<br>명 | 047<br>래 | 048<br>차 | 049<br>여 | 057<br>중 | 058<br>리 | 059<br>유 |
| 034<br>중 | 035<br>사 | 036<br>경 | 044<br>림 | 045<br>주 | 046<br>상 | 054<br>복 | 055<br>단 | 056<br>리 |
| 031<br>호 | 032<br>각 | 033<br>각 | 041<br>본 | 042<br>미 | 043<br>과 | 051<br>사 | 052<br>개 | 053<br>신 |
| **10.산** | | | **20.탐** | | | **30.고** | | |
| 007<br>화 | 008<br>영 | 009<br>수 | 017<br>심 | 018<br>금 | 019<br>함 | 027<br>곤 | 028<br>인 | 029<br>고 |
| 004<br>인 | 005<br>재 | 006<br>사 | 014<br>원 | 015<br>형 | 016<br>태 | 024<br>구 | 025<br>품 | 026<br>소 |
| 001<br>인 | 002<br>대 | 003<br>태 | 011<br>곡 | 012<br>인 | 013<br>견 | 021<br>습 | 022<br>첨 | 023<br>창 |`;
    }

    onunload() {
        console.log('주역 64괘 플러그인 언로드');
    }
};