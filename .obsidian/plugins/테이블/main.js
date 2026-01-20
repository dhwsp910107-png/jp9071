const { Plugin, Modal, Notice, MarkdownView, PluginSettingTab, Setting, TFolder } = require('obsidian');

// 기본 설정
const DEFAULT_SETTINGS = {
    defaultRows: 12,
    defaultCols: 9,
    startNumber: 1,
    useLinks: true,
    priorityLabels: true,
    ribbonIcon: 'table',
    showDashboardOnStartup: false,
    theme: 'default',
    // 노트 관리 설정
    baseFolder: 'Chapters',
    createFolders: true,
    noteTemplate: '# {{title}}\n\n## 내용\n\n',
    autoCreateNotes: true
};

class TableGeneratorPlugin extends Plugin {
    async onload() {
        console.log('📊 Table Generator Plugin loading...');
        await this.loadSettings();
        
        // 통계 데이터 초기화
        if (!this.settings.stats) {
            this.settings.stats = {
                tablesCreated: 0,
                chaptersCreated: 0,
                notesCreated: 0,
                lastUsed: null,
                favoriteType: null
            };
            await this.saveSettings();
        }
        
        // 리본 아이콘 추가
        this.addRibbonIcon(this.settings.ribbonIcon, 'Table Generator Dashboard', () => {
            this.openDashboard();
        });

        // 명령어 추가
        this.addCommand({
            id: 'open-dashboard',
            name: '📊 대시보드 열기',
            callback: () => this.openDashboard()
        });

        this.addCommand({
            id: 'generate-empty-table',
            name: '📝 빈 표 생성',
            callback: () => this.openTableGenerator()
        });

        this.addCommand({
            id: 'generate-numbered-table',
            name: '🔢 번호 표 생성 (001-109)',
            callback: () => this.generateNumberedTable()
        });

        this.addCommand({
            id: 'generate-custom-table',
            name: '⚙️ 커스텀 표 생성',
            callback: () => this.openCustomTableModal()
        });

        this.addCommand({
            id: 'create-chapter',
            name: '📚 새 장(Chapter) 생성',
            callback: () => this.openChapterModal()
        });

        this.addCommand({
            id: 'manage-chapters',
            name: '🗂️ 장 관리',
            callback: () => this.openChapterManager()
        });

        // 설정 탭 추가
        this.addSettingTab(new TableGeneratorSettingTab(this.app, this));

        // 시작 시 대시보드 표시
        if (this.settings.showDashboardOnStartup) {
            setTimeout(() => this.openDashboard(), 1000);
        }

        console.log('✅ Table Generator Plugin loaded');
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    openDashboard() {
        new DashboardModal(this.app, this).open();
    }

    openTableGenerator() {
        new TableGeneratorModal(this.app, this).open();
    }

    openChapterModal() {
        new ChapterCreationModal(this.app, this).open();
    }

    openChapterManager() {
        new ChapterManagerModal(this.app, this).open();
    }

    async generateNumberedTable() {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!activeView) {
            new Notice('⚠️ 활성 노트가 없습니다');
            return;
        }

        const table = this.createNumberedTable();
        const editor = activeView.editor;
        const cursor = editor.getCursor();
        editor.replaceRange(table, cursor);
        
        // 통계 업데이트
        this.settings.stats.tablesCreated++;
        this.settings.stats.lastUsed = new Date().toISOString();
        this.settings.stats.favoriteType = 'numbered';
        await this.saveSettings();
        
        new Notice('✅ 번호 표 (001-109) 생성 완료!');
    }

    createNumberedTable(chapterNum = null) {
        const prefix = chapterNum ? `${chapterNum}-` : '';
        
        // 메인 표 (001-090)
        let table = `|         | [[${prefix}070]] |         |         | [[${prefix}080]] |         |         | [[${prefix}090]] |         |\n`;
        table += `| ------- | ------- | ------- | ------- | ------- | ------- | ------- | ------- | ------- |\n`;
        table += `| [[${prefix}067]] | [[${prefix}068]] | [[${prefix}069]] | [[${prefix}077]] | [[${prefix}078]] | [[${prefix}079]] | [[${prefix}087]] | [[${prefix}088]] | [[${prefix}089]] |\n`;
        table += `| [[${prefix}064]] | [[${prefix}065]] | [[${prefix}066]] | [[${prefix}074]] | [[${prefix}075]] | [[${prefix}076]] | [[${prefix}084]] | [[${prefix}085]] | [[${prefix}086]] |\n`;
        table += `| [[${prefix}061]] | [[${prefix}062]] | [[${prefix}063]] | [[${prefix}071]] | [[${prefix}072]] | [[${prefix}073]] | [[${prefix}081]] | [[${prefix}082]] | [[${prefix}083]] |\n`;
        table += `|         | [[${prefix}040]] |         |         | [[${prefix}050]] |         |         | [[${prefix}060]] |         |\n`;
        table += `| [[${prefix}037]] | [[${prefix}038]] | [[${prefix}039]] | [[${prefix}047]] | [[${prefix}048]] | [[${prefix}049]] | [[${prefix}057]] | [[${prefix}058]] | [[${prefix}059]] |\n`;
        table += `| [[${prefix}034]] | [[${prefix}035]] | [[${prefix}036]] | [[${prefix}044]] | [[${prefix}045]] | [[${prefix}046]] | [[${prefix}054]] | [[${prefix}055]] | [[${prefix}056]] |\n`;
        table += `| [[${prefix}031]] | [[${prefix}032]] | [[${prefix}033]] | [[${prefix}041]] | [[${prefix}042]] | [[${prefix}043]] | [[${prefix}051]] | [[${prefix}052]] | [[${prefix}053]] |\n`;
        table += `|         | [[${prefix}010]] |         |         | [[${prefix}020]] |         |         | [[${prefix}030]] |         |\n`;
        table += `| [[${prefix}007]] | [[${prefix}008]] | [[${prefix}009]] | [[${prefix}017]] | [[${prefix}018]] | [[${prefix}019]] | [[${prefix}027]] | [[${prefix}028]] | [[${prefix}029]] |\n`;
        table += `| [[${prefix}004]] | [[${prefix}005]] | [[${prefix}006]] | [[${prefix}014]] | [[${prefix}015]] | [[${prefix}016]] | [[${prefix}024]] | [[${prefix}025]] | [[${prefix}026]] |\n`;
        table += `| [[${prefix}001]] | [[${prefix}002]] | [[${prefix}003]] | [[${prefix}011]] | [[${prefix}012]] | [[${prefix}013]] | [[${prefix}021]] | [[${prefix}022]] | [[${prefix}023]] |\n`;
        
        table += `\n`;
        
        // 보너스 표 (100-109)
        table += `|         | [[${prefix}100]] |         |\n`;
        table += `| ------- | ------- | ------- |\n`;
        table += `| [[${prefix}107]] | [[${prefix}108]] | [[${prefix}109]] |\n`;
        table += `| [[${prefix}104]] | [[${prefix}105]] | [[${prefix}106]] |\n`;
        table += `| [[${prefix}101]] | [[${prefix}102]] | [[${prefix}103]] |\n`;
        
        return table;
    }

    async createChapter(chapterNum, createNotes = true) {
        try {
            const folderPath = `${this.settings.baseFolder}/Chapter ${chapterNum}`;
            
            // 폴더 생성
            if (this.settings.createFolders) {
                await this.ensureFolder(folderPath);
            }

            // 인덱스 파일 생성
            const indexPath = `${folderPath}/Chapter-${chapterNum}-Index.md`;
            const indexContent = `# Chapter ${chapterNum}\n\n> **총 109개 노트** | 001-090 (메인) + 100-109 (보너스)\n\n` + this.createNumberedTable(chapterNum);
            
            try {
                await this.app.vault.create(indexPath, indexContent);
            } catch (e) {
                // 파일이 이미 존재하면 덮어쓰기
                const existingFile = this.app.vault.getAbstractFileByPath(indexPath);
                if (existingFile) {
                    await this.app.vault.modify(existingFile, indexContent);
                }
            }

            // 노트 생성
            if (createNotes && this.settings.autoCreateNotes) {
                const noteNumbers = this.getChapterNoteNumbers();
                let created = 0;
                
                for (const num of noteNumbers) {
                    const notePath = `${folderPath}/${chapterNum}-${num}.md`;
                    const noteContent = this.settings.noteTemplate.replace(/{{title}}/g, `${chapterNum}-${num}`);
                    
                    try {
                        await this.app.vault.create(notePath, noteContent);
                        created++;
                    } catch (e) {
                        // 파일이 이미 존재하면 건너뛰기
                    }
                }
                
                this.settings.stats.notesCreated += created;
            }

            // 통계 업데이트
            this.settings.stats.chaptersCreated++;
            this.settings.stats.lastUsed = new Date().toISOString();
            await this.saveSettings();

            new Notice(`✅ Chapter ${chapterNum} 생성 완료! (109개 노트)`);
            return true;
        } catch (error) {
            console.error('Chapter 생성 오류:', error);
            new Notice(`❌ 오류: ${error.message}`);
            return false;
        }
    }

    async ensureFolder(path) {
        const parts = path.split('/');
        let currentPath = '';
        
        for (const part of parts) {
            currentPath = currentPath ? `${currentPath}/${part}` : part;
            
            const folder = this.app.vault.getAbstractFileByPath(currentPath);
            if (!folder) {
                await this.app.vault.createFolder(currentPath);
            }
        }
    }

    getChapterNoteNumbers() {
        const numbers = [];
        
        // 001-090 (메인 90개)
        for (let i = 1; i <= 90; i++) {
            numbers.push(String(i).padStart(3, '0'));
        }
        
        // 100-109 (보너스 10개)
        for (let i = 100; i <= 109; i++) {
            numbers.push(String(i));
        }
        
        return numbers;
    }

    async getExistingChapters() {
        const baseFolder = this.app.vault.getAbstractFileByPath(this.settings.baseFolder);
        if (!baseFolder || !(baseFolder instanceof TFolder)) {
            return [];
        }

        const chapters = [];
        for (const child of baseFolder.children) {
            if (child instanceof TFolder && child.name.startsWith('Chapter ')) {
                const match = child.name.match(/Chapter (\d+)/);
                if (match) {
                    const chapterNum = parseInt(match[1]);
                    const noteCount = child.children.filter(f => f.name.endsWith('.md') && f.name !== `Chapter-${chapterNum}-Index.md`).length;
                    
                    chapters.push({
                        number: chapterNum,
                        folder: child,
                        path: child.path,
                        noteCount: noteCount
                    });
                }
            }
        }

        return chapters.sort((a, b) => a.number - b.number);
    }

    openCustomTableModal() {
        new CustomTableModal(this.app, this).open();
    }

    onunload() {
        console.log('📊 Table Generator Plugin unloading...');
    }
}

// 장 생성 모달
class ChapterCreationModal extends Modal {
    constructor(app, plugin) {
        super(app);
        this.plugin = plugin;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        contentEl.createEl('h2', { text: '📚 새 장(Chapter) 생성' });
        
        // 설명
        const desc = contentEl.createDiv('modal-description');
        desc.createEl('p', { text: '각 장은 001-090 (메인 90개) + 100-109 (보너스 10개) = 총 100개의 노트로 구성됩니다.' });
        
        const form = contentEl.createDiv('chapter-form');
        
        // 장 번호
        const numGroup = form.createDiv('form-group');
        numGroup.createEl('label', { text: '장 번호:' });
        const numInput = numGroup.createEl('input', { 
            type: 'number', 
            value: '1',
            attr: { min: '1', max: '999' }
        });
        numInput.addClass('chapter-input');
        
        // 또는 범위 생성
        const rangeGroup = form.createDiv('form-group');
        rangeGroup.createEl('h3', { text: '🎯 또는 여러 장 한번에 생성' });
        
        const rangeContainer = rangeGroup.createDiv('range-container');
        const startGroup = rangeContainer.createDiv('range-input');
        startGroup.createEl('label', { text: '시작 장:' });
        const startInput = startGroup.createEl('input', { 
            type: 'number', 
            value: '1',
            attr: { min: '1' }
        });
        
        const endGroup = rangeContainer.createDiv('range-input');
        endGroup.createEl('label', { text: '끝 장:' });
        const endInput = endGroup.createEl('input', { 
            type: 'number', 
            value: '5',
            attr: { min: '1' }
        });
        
        // 옵션
        const optionsGroup = form.createDiv('form-group');
        optionsGroup.createEl('h3', { text: '⚙️ 생성 옵션' });
        
        const createNotesCheck = optionsGroup.createDiv('checkbox-group');
        const notesCheckbox = createNotesCheck.createEl('input', { type: 'checkbox' });
        notesCheckbox.checked = this.plugin.settings.autoCreateNotes;
        notesCheckbox.id = 'create-notes';
        createNotesCheck.createEl('label', { 
            text: '자동으로 노트 파일 생성 (100개/장)',
            attr: { for: 'create-notes' }
        });
        
        // 미리보기
        const preview = form.createDiv('preview-section');
        preview.createEl('h3', { text: '📁 생성될 구조 미리보기' });
        const previewContent = preview.createDiv('preview-content');
        
        const updatePreview = () => {
            const start = parseInt(startInput.value) || parseInt(numInput.value);
            const end = parseInt(endInput.value) || parseInt(numInput.value);
            const totalChapters = end - start + 1;
            const totalNotes = totalChapters * (notesCheckbox.checked ? 100 : 1);
            
            let html = '<div class="folder-tree">';
            html += `<div class="preview-summary">📊 총 ${totalChapters}개 장, ${totalNotes}개 파일 생성 예정</div>`;
            
            for (let i = start; i <= Math.min(end, start + 4); i++) {
                html += `<div class="folder-item">📁 Chapter ${i}/</div>`;
                html += `<div class="file-item">├─ 📄 Chapter-${i}-Index.md (인덱스 + 표)</div>`;
                if (notesCheckbox.checked) {
                    html += `<div class="file-item">├─ 📝 ${i}-001.md ~ ${i}-090.md (메인 90개)</div>`;
                    html += `<div class="file-item">└─ 🎁 ${i}-100.md ~ ${i}-109.md (보너스 10개)</div>`;
                }
            }
            if (end > start + 4) {
                html += `<div class="folder-item">... 외 ${end - start - 4}개 장</div>`;
            }
            html += '</div>';
            
            previewContent.innerHTML = html;
        };
        
        numInput.addEventListener('input', updatePreview);
        startInput.addEventListener('input', updatePreview);
        endInput.addEventListener('input', updatePreview);
        notesCheckbox.addEventListener('change', updatePreview);
        updatePreview();
        
        // 버튼
        const btnContainer = form.createDiv('btn-container');
        const cancelBtn = btnContainer.createEl('button', { text: '취소' });
        cancelBtn.onclick = () => this.close();
        
        const singleBtn = btnContainer.createEl('button', { 
            text: '단일 장 생성', 
            cls: 'mod-cta' 
        });
        singleBtn.onclick = async () => {
            const num = parseInt(numInput.value);
            await this.plugin.createChapter(num, notesCheckbox.checked);
            this.close();
        };
        
        const rangeBtn = btnContainer.createEl('button', { 
            text: '범위 생성', 
            cls: 'mod-warning' 
        });
        rangeBtn.onclick = async () => {
            const start = parseInt(startInput.value);
            const end = parseInt(endInput.value);
            
            if (start > end) {
                new Notice('❌ 시작 번호가 끝 번호보다 큽니다');
                return;
            }
            
            if (end - start > 50) {
                new Notice('❌ 한번에 최대 50개 장까지 생성 가능합니다');
                return;
            }
            
            const totalNotes = (end - start + 1) * 100;
            const notice = new Notice(`📚 ${start}장부터 ${end}장까지 생성 중... (${totalNotes}개 노트)`, 0);
            
            for (let i = start; i <= end; i++) {
                await this.plugin.createChapter(i, notesCheckbox.checked);
            }
            
            notice.hide();
            new Notice(`✅ ${end - start + 1}개 장 생성 완료!`);
            this.close();
        };

        this.addStyles();
    }

    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .modal-description {
                background: var(--background-secondary);
                padding: 12px 16px;
                border-radius: 8px;
                margin-bottom: 20px;
                border-left: 4px solid var(--interactive-accent);
            }
            .modal-description p {
                margin: 0;
                color: var(--text-muted);
                font-size: 14px;
            }
            .chapter-form {
                margin-top: 20px;
            }
            .form-group {
                margin-bottom: 20px;
            }
            .form-group h3 {
                margin: 10px 0;
                font-size: 15px;
                color: var(--text-normal);
            }
            .form-group label {
                display: block;
                margin-bottom: 5px;
                font-weight: 500;
            }
            .form-group input[type="number"] {
                width: 100%;
                padding: 10px;
                border: 1px solid var(--background-modifier-border);
                border-radius: 6px;
                background: var(--background-primary);
                font-size: 16px;
            }
            .chapter-input {
                font-size: 24px !important;
                font-weight: bold;
                text-align: center;
            }
            .range-container {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 15px;
            }
            .range-input label {
                font-size: 13px;
            }
            .checkbox-group {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 12px;
                background: var(--background-secondary);
                border-radius: 6px;
            }
            .checkbox-group input[type="checkbox"] {
                margin: 0;
                width: 18px;
                height: 18px;
            }
            .checkbox-group label {
                margin: 0 !important;
                font-weight: normal !important;
            }
            .preview-section {
                background: var(--background-primary-alt);
                padding: 15px;
                border-radius: 8px;
                margin-top: 15px;
                border: 2px solid var(--background-modifier-border);
            }
            .preview-section h3 {
                margin: 0 0 10px 0;
                font-size: 14px;
            }
            .preview-summary {
                background: var(--interactive-accent);
                color: white;
                padding: 8px 12px;
                border-radius: 6px;
                margin-bottom: 12px;
                font-weight: bold;
                text-align: center;
            }
            .preview-content {
                font-family: 'Courier New', monospace;
                font-size: 13px;
            }
            .folder-tree {
                padding: 10px;
            }
            .folder-item {
                color: var(--text-accent);
                margin: 5px 0;
                font-weight: 600;
            }
            .file-item {
                color: var(--text-muted);
                margin: 3px 0 3px 20px;
            }
            .btn-container {
                display: flex;
                gap: 10px;
                justify-content: flex-end;
                margin-top: 20px;
                padding-top: 15px;
                border-top: 1px solid var(--background-modifier-border);
            }
            .btn-container button {
                padding: 10px 20px;
                font-weight: 600;
            }
        `;
        document.head.appendChild(style);
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// 장 관리 모달
class ChapterManagerModal extends Modal {
    constructor(app, plugin) {
        super(app);
        this.plugin = plugin;
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        contentEl.createEl('h2', { text: '📚 장(Chapter) 관리' });
        
        const chapters = await this.plugin.getExistingChapters();
        
        if (chapters.length === 0) {
            const empty = contentEl.createDiv('empty-state');
            empty.createEl('div', { text: '📭', cls: 'empty-icon' });
            empty.createEl('h3', { text: '생성된 장이 없습니다' });
            empty.createEl('p', { text: '첫 장을 만들어보세요!' });
            const createBtn = empty.createEl('button', { text: '📚 새 장 만들기', cls: 'mod-cta' });
            createBtn.onclick = () => {
                this.close();
                this.plugin.openChapterModal();
            };
        } else {
            // 통계 헤더
            const statsHeader = contentEl.createDiv('manager-header');
            statsHeader.createEl('div', { 
                text: `총 ${chapters.length}개 장`, 
                cls: 'stat-badge' 
            });
            const totalNotes = chapters.reduce((sum, ch) => sum + ch.noteCount, 0);
            statsHeader.createEl('div', { 
                text: `${totalNotes}개 노트`, 
                cls: 'stat-badge' 
            });
            
            const list = contentEl.createDiv('chapter-list');
            
            for (const chapter of chapters) {
                const item = list.createDiv('chapter-item');
                
                const info = item.createDiv('chapter-info');
                const title = info.createDiv('chapter-title');
                title.createEl('span', { text: `📖 Chapter ${chapter.number}`, cls: 'chapter-number' });
                
                const progress = info.createDiv('chapter-progress');
                const percentage = Math.round((chapter.noteCount / 100) * 100);
                const statusColor = chapter.noteCount === 100 ? 'complete' : 
                                  chapter.noteCount > 0 ? 'partial' : 'empty';
                progress.createEl('span', { 
                    text: `${chapter.noteCount}/100 노트 (${percentage}%)`,
                    cls: `progress-text ${statusColor}`
                });
                
                const progressBar = progress.createDiv('progress-bar');
                const progressFill = progressBar.createDiv('progress-fill');
                progressFill.style.width = `${percentage}%`;
                progressFill.addClass(statusColor);
                
                info.createEl('p', { text: `📁 ${chapter.path}`, cls: 'chapter-path' });
                
                const actions = item.createDiv('chapter-actions');
                
                const openBtn = actions.createEl('button', { text: '📂 열기', cls: 'action-btn' });
                openBtn.onclick = async () => {
                    const indexPath = `${chapter.path}/Chapter-${chapter.number}-Index.md`;
                    const file = this.app.vault.getAbstractFileByPath(indexPath);
                    if (file) {
                        await this.app.workspace.getLeaf().openFile(file);
                        this.close();
                    } else {
                        new Notice('⚠️ 인덱스 파일을 찾을 수 없습니다');
                    }
                };
                
                const recreateBtn = actions.createEl('button', { text: '🔄 노트 재생성', cls: 'action-btn' });
                recreateBtn.onclick = async () => {
                    const confirm = await this.confirmAction(
                        `Chapter ${chapter.number}의 누락된 노트를 생성하시겠습니까?`
                    );
                    if (confirm) {
                        await this.plugin.createChapter(chapter.number, true);
                        this.onOpen(); // 새로고침
                    }
                };
            }
        }
        
        // 하단 버튼
        const footer = contentEl.createDiv('manager-footer');
        const newChapterBtn = footer.createEl('button', { text: '➕ 새 장 생성', cls: 'mod-cta' });
        newChapterBtn.onclick = () => {
            this.close();
            this.plugin.openChapterModal();
        };

        this.addStyles();
    }

    async confirmAction(message) {
        return new Promise((resolve) => {
            const modal = new Modal(this.app);
            modal.contentEl.createEl('h3', { text: '확인' });
            modal.contentEl.createEl('p', { text: message });
            
            const btnContainer = modal.contentEl.createDiv('modal-button-container');
            btnContainer.style.cssText = 'display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;';
            
            const cancelBtn = btnContainer.createEl('button', { text: '취소' });
            cancelBtn.onclick = () => {
                modal.close();
                resolve(false);
            };
            
            const confirmBtn = btnContainer.createEl('button', { text: '확인', cls: 'mod-warning' });
            confirmBtn.onclick = () => {
                modal.close();
                resolve(true);
            };
            
            modal.open();
        });
    }

    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .empty-state {
                text-align: center;
                padding: 60px 40px;
                color: var(--text-muted);
            }
            .empty-icon {
                font-size: 64px;
                margin-bottom: 20px;
            }
            .empty-state h3 {
                margin: 15px 0 10px 0;
                color: var(--text-normal);
            }
            .empty-state p {
                margin: 0 0 25px 0;
            }
            .manager-header {
                display: flex;
                gap: 10px;
                margin-bottom: 20px;
                justify-content: center;
            }
            .stat-badge {
                background: var(--interactive-accent);
                color: white;
                padding: 8px 16px;
                border-radius: 20px;
                font-weight: 600;
                font-size: 14px;
            }
            .chapter-list {
                max-height: 500px;
                overflow-y: auto;
                margin-bottom: 20px;
            }
            .chapter-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 20px;
                margin: 12px 0;
                background: var(--background-primary-alt);
                border-radius: 10px;
                border-left: 4px solid var(--interactive-accent);
                transition: transform 0.2s, box-shadow 0.2s;
            }
            .chapter-item:hover {
                transform: translateX(5px);
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            }
            .chapter-info {
                flex: 1;
            }
            .chapter-title {
                display: flex;
                align-items: center;
                gap: 10px;
                margin-bottom: 10px;
            }
            .chapter-number {
                font-size: 18px;
                font-weight: bold;
                color: var(--text-normal);
            }
            .chapter-progress {
                margin: 8px 0;
            }
            .progress-text {
                font-size: 13px;
                font-weight: 600;
                display: inline-block;
                margin-bottom: 5px;
            }
            .progress-text.complete { color: #10b981; }
            .progress-text.partial { color: #f59e0b; }
            .progress-text.empty { color: var(--text-muted); }
            .progress-bar {
                width: 200px;
                height: 8px;
                background: var(--background-modifier-border);
                border-radius: 4px;
                overflow: hidden;
            }
            .progress-fill {
                height: 100%;
                transition: width 0.3s ease;
                border-radius: 4px;
            }
            .progress-fill.complete { background: #10b981; }
            .progress-fill.partial { background: #f59e0b; }
            .progress-fill.empty { background: var(--text-muted); }
            .chapter-path {
                font-size: 12px;
                color: var(--text-muted);
                margin: 5px 0 0 0;
                font-family: monospace;
            }
            .chapter-actions {
                display: flex;
                gap: 8px;
                flex-shrink: 0;
            }
            .action-btn {
                padding: 8px 16px;
                font-size: 13px;
                border-radius: 6px;
                transition: all 0.2s;
            }
            .action-btn:hover {
                transform: translateY(-2px);
            }
            .manager-footer {
                text-align: center;
                padding-top: 15px;
                border-top: 2px solid var(--background-modifier-border);
            }
            .manager-footer button {
                padding: 12px 24px;
                font-size: 15px;
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
class DashboardModal extends Modal {
    constructor(app, plugin) {
        super(app);
        this.plugin = plugin;
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        // 헤더
        const header = contentEl.createDiv('dashboard-header');
        header.createEl('h1', { text: '📊 Table Generator' });
        header.createEl('p', { text: '표 생성 및 장 관리 시스템', cls: 'dashboard-subtitle' });
        
        // 통계 섹션
        const statsSection = contentEl.createDiv('dashboard-section');
        statsSection.createEl('h2', { text: '📈 사용 통계' });
        
        const statsGrid = statsSection.createDiv('stats-grid');
        
        const stats = this.plugin.settings.stats;
        this.createStatCard(statsGrid, '생성된 표', stats.tablesCreated, '🎯', 'accent');
        this.createStatCard(statsGrid, '생성된 장', stats.chaptersCreated, '📚', 'success');
        this.createStatCard(statsGrid, '생성된 노트', stats.notesCreated, '📝', 'warning');
        this.createStatCard(statsGrid, '마지막 사용', stats.lastUsed ? 
            new Date(stats.lastUsed).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }) : '없음', '📅', 'muted');
        
        // 장 정보
        const chapters = await this.plugin.getExistingChapters();
        if (chapters.length > 0) {
            const chapterSection = contentEl.createDiv('dashboard-section');
            chapterSection.createEl('h2', { text: '📚 최근 장' });
            
            const recentList = chapterSection.createDiv('recent-chapters');
            const recentChapters = chapters.slice(-3).reverse();
            
            for (const chapter of recentChapters) {
                const item = recentList.createDiv('recent-chapter-item');
                const percentage = Math.round((chapter.noteCount / 100) * 100);
                
                item.createEl('span', { text: `Chapter ${chapter.number}`, cls: 'chapter-label' });
                item.createEl('span', { text: `${percentage}%`, cls: 'chapter-percentage' });
                
                const miniBar = item.createDiv('mini-progress-bar');
                const miniFill = miniBar.createDiv('mini-progress-fill');
                miniFill.style.width = `${percentage}%`;
                miniFill.style.background = percentage === 100 ? '#10b981' : '#f59e0b';
            }
        }
        
        // 빠른 실행 섹션
        const quickSection = contentEl.createDiv('dashboard-section');
        quickSection.createEl('h2', { text: '⚡ 빠른 실행' });
        
        const quickGrid = quickSection.createDiv('quick-grid');
        
        this.createQuickButton(quickGrid, '📝', '빈 표', 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', () => {
            this.close();
            this.plugin.openTableGenerator();
        });
        
        this.createQuickButton(quickGrid, '🔢', '번호 표\n001-109', 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', () => {
            this.close();
            this.plugin.generateNumberedTable();
        });
        
        this.createQuickButton(quickGrid, '📚', '새 장\n생성', 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', () => {
            this.close();
            this.plugin.openChapterModal();
        });
        
        this.createQuickButton(quickGrid, '🗂️', '장\n관리', 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', () => {
            this.close();
            this.plugin.openChapterManager();
        });
        
        this.createQuickButton(quickGrid, '⚙️', '커스텀\n표', 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', () => {
            this.close();
            this.plugin.openCustomTableModal();
        });
        
        this.createQuickButton(quickGrid, '⚙️', '설정\n열기', 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)', () => {
            this.close();
            // @ts-ignore
            this.app.setting.open();
            // @ts-ignore
            this.app.setting.openTabById('table-generator');
        });

        this.addStyles();
    }

    createStatCard(container, label, value, icon, color = 'accent') {
        const card = container.createDiv('stat-card');
        card.addClass(`stat-${color}`);
        card.createEl('div', { text: icon, cls: 'stat-icon' });
        card.createEl('div', { text: String(value), cls: 'stat-value' });
        card.createEl('div', { text: label, cls: 'stat-label' });
    }

    createQuickButton(container, icon, text, gradient, onClick) {
        const btn = container.createEl('button', { cls: 'quick-btn' });
        btn.style.background = gradient;
        btn.onclick = onClick;
        
        btn.createEl('div', { text: icon, cls: 'quick-icon' });
        btn.createEl('div', { text: text, cls: 'quick-text' });
    }

    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .dashboard-header {
                text-align: center;
                margin-bottom: 30px;
                padding-bottom: 20px;
                border-bottom: 2px solid var(--background-modifier-border);
            }
            .dashboard-header h1 {
                margin: 0 0 8px 0;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
            }
            .dashboard-subtitle {
                margin: 0;
                color: var(--text-muted);
                font-size: 14px;
            }
            .dashboard-section {
                margin: 25px 0;
                padding: 20px;
                background: var(--background-primary-alt);
                border-radius: 12px;
            }
            .dashboard-section h2 {
                margin: 0 0 15px 0;
                font-size: 16px;
                color: var(--text-normal);
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .stats-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
                gap: 12px;
                margin-top: 15px;
            }
            .stat-card {
                background: var(--background-primary);
                padding: 16px;
                border-radius: 10px;
                text-align: center;
                border: 2px solid var(--background-modifier-border);
                transition: all 0.2s;
            }
            .stat-card:hover {
                transform: translateY(-3px);
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            }
            .stat-card.stat-accent { border-color: var(--interactive-accent); }
            .stat-card.stat-success { border-color: #10b981; }
            .stat-card.stat-warning { border-color: #f59e0b; }
            .stat-card.stat-muted { border-color: var(--background-modifier-border); }
            .stat-icon {
                font-size: 28px;
                margin-bottom: 8px;
            }
            .stat-value {
                font-size: 22px;
                font-weight: bold;
                margin-bottom: 4px;
            }
            .stat-accent .stat-value { color: var(--interactive-accent); }
            .stat-success .stat-value { color: #10b981; }
            .stat-warning .stat-value { color: #f59e0b; }
            .stat-muted .stat-value { color: var(--text-muted); }
            .stat-label {
                font-size: 11px;
                color: var(--text-muted);
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            .recent-chapters {
                display: flex;
                flex-direction: column;
                gap: 10px;
            }
            .recent-chapter-item {
                background: var(--background-primary);
                padding: 12px;
                border-radius: 8px;
                display: flex;
                align-items: center;
                gap: 10px;
            }
            .chapter-label {
                font-weight: 600;
                min-width: 100px;
            }
            .chapter-percentage {
                font-weight: bold;
                color: var(--interactive-accent);
                min-width: 40px;
            }
            .mini-progress-bar {
                flex: 1;
                height: 6px;
                background: var(--background-modifier-border);
                border-radius: 3px;
                overflow: hidden;
            }
            .mini-progress-fill {
                height: 100%;
                transition: width 0.3s ease;
                border-radius: 3px;
            }
            .quick-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
                gap: 12px;
                margin-top: 15px;
            }
            .quick-btn {
                padding: 20px 10px;
                border: none;
                border-radius: 12px;
                color: white;
                font-weight: bold;
                cursor: pointer;
                transition: all 0.2s;
                box-shadow: 0 4px 15px rgba(0,0,0,0.2);
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 8px;
                min-height: 90px;
            }
            .quick-btn:hover {
                transform: translateY(-4px);
                box-shadow: 0 6px 20px rgba(0,0,0,0.3);
            }
            .quick-icon {
                font-size: 28px;
            }
            .quick-text {
                font-size: 12px;
                line-height: 1.3;
                text-align: center;
                white-space: pre-line;
            }
        `;
        document.head.appendChild(style);
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// 빠른 표 생성 모달
class TableGeneratorModal extends Modal {
    constructor(app, plugin) {
        super(app);
        this.plugin = plugin;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        contentEl.createEl('h2', { text: '📊 표 생성기' });
        
        const desc = contentEl.createDiv('modal-description');
        desc.createEl('p', { text: '커서 위치에 표를 생성합니다. 노트를 열고 원하는 위치에 커서를 놓으세요.' });
        
        const options = contentEl.createDiv('table-gen-options');
        
        const option1 = options.createDiv('table-option');
        option1.createEl('h3', { text: '📝 빈 표 생성' });
        option1.createEl('p', { text: '5x5 비어있는 기본 표를 생성합니다' });
        const btn1 = option1.createEl('button', { text: '생성', cls: 'mod-cta' });
        btn1.onclick = () => {
            this.generateEmptyTable();
            this.close();
        };
        
        const option2 = options.createDiv('table-option');
        option2.createEl('h3', { text: '🔢 번호 표 (001-109)' });
        option2.createEl('p', { text: '1장 구조: 001-090 (메인) + 100-109 (보너스) 번호가 매겨진 표' });
        const btn2 = option2.createEl('button', { text: '생성', cls: 'mod-cta' });
        btn2.onclick = () => {
            this.plugin.generateNumberedTable();
            this.close();
        };
        
        const option3 = options.createDiv('table-option');
        option3.createEl('h3', { text: '⚙️ 커스텀 표' });
        option3.createEl('p', { text: '행/열 개수와 번호 매기기를 직접 설정합니다' });
        const btn3 = option3.createEl('button', { text: '설정', cls: 'mod-cta' });
        btn3.onclick = () => {
            this.close();
            this.plugin.openCustomTableModal();
        };

        this.addStyles();
    }

    async generateEmptyTable() {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!activeView) {
            new Notice('⚠️ 활성 노트가 없습니다');
            return;
        }

        const rows = 5;
        const cols = 5;
        let table = '';
        
        table += '|' + ' '.repeat(5) + '|'.repeat(cols - 1) + '\n';
        table += '|' + ' --- |'.repeat(cols) + '\n';
        
        for (let i = 0; i < rows - 1; i++) {
            table += '|' + '     |'.repeat(cols) + '\n';
        }

        const editor = activeView.editor;
        const cursor = editor.getCursor();
        editor.replaceRange(table, cursor);
        
        this.plugin.settings.stats.tablesCreated++;
        this.plugin.settings.stats.lastUsed = new Date().toISOString();
        this.plugin.settings.stats.favoriteType = 'empty';
        await this.plugin.saveSettings();
        
        new Notice('✅ 빈 표 생성 완료!');
    }

    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .modal-description {
                background: var(--background-secondary);
                padding: 12px 16px;
                border-radius: 8px;
                margin-bottom: 20px;
                border-left: 4px solid var(--interactive-accent);
            }
            .modal-description p {
                margin: 0;
                color: var(--text-muted);
                font-size: 13px;
            }
            .table-gen-options {
                display: flex;
                flex-direction: column;
                gap: 15px;
                margin-top: 20px;
            }
            .table-option {
                padding: 18px;
                border: 2px solid var(--background-modifier-border);
                border-radius: 10px;
                background: var(--background-primary-alt);
                transition: all 0.2s;
            }
            .table-option:hover {
                border-color: var(--interactive-accent);
                transform: translateX(5px);
            }
            .table-option h3 {
                margin: 0 0 8px 0;
                color: var(--text-normal);
            }
            .table-option p {
                margin: 0 0 12px 0;
                color: var(--text-muted);
                font-size: 13px;
                line-height: 1.5;
            }
            .table-option button {
                width: 100%;
                padding: 10px;
                font-weight: 600;
            }
        `;
        document.head.appendChild(style);
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// 커스텀 표 생성 모달
class CustomTableModal extends Modal {
    constructor(app, plugin) {
        super(app);
        this.plugin = plugin;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        contentEl.createEl('h2', { text: '⚙️ 커스텀 표 설정' });
        
        const desc = contentEl.createDiv('modal-description');
        desc.createEl('p', { text: '원하는 크기와 번호 범위로 표를 생성할 수 있습니다. 001-999 범위 지원' });
        
        const form = contentEl.createDiv('custom-table-form');
        
        // 크기 설정
        const sizeSection = form.createDiv('form-section');
        sizeSection.createEl('h3', { text: '📐 표 크기' });
        
        const rowGroup = sizeSection.createDiv('form-group');
        rowGroup.createEl('label', { text: '행 개수 (헤더 포함):' });
        const rowInput = rowGroup.createEl('input', { 
            type: 'number', 
            value: '5',
            attr: { min: '2', max: '50' }
        });
        
        const colGroup = sizeSection.createDiv('form-group');
        colGroup.createEl('label', { text: '열 개수:' });
        const colInput = colGroup.createEl('input', { 
            type: 'number', 
            value: '5',
            attr: { min: '2', max: '20' }
        });
        
        // 번호 설정
        const numberSection = form.createDiv('form-section');
        numberSection.createEl('h3', { text: '🔢 번호 설정' });
        
        const numberGroup = numberSection.createDiv('form-group');
        const numberCheckbox = numberGroup.createEl('input', { type: 'checkbox' });
        numberCheckbox.id = 'number-checkbox';
        const numberLabel = numberGroup.createEl('label', { 
            text: '번호 자동 매기기',
            attr: { for: 'number-checkbox' }
        });
        numberLabel.style.display = 'inline';
        numberLabel.style.marginLeft = '8px';
        
        const startGroup = numberSection.createDiv('form-group');
        startGroup.createEl('label', { text: '시작 번호 (1-999):' });
        const startInput = startGroup.createEl('input', { 
            type: 'number', 
            value: '1',
            attr: { min: '1', max: '999' }
        });
        startGroup.style.display = 'none';
        
        const linkGroup = numberSection.createDiv('form-group');
        const linkCheckbox = linkGroup.createEl('input', { type: 'checkbox' });
        linkCheckbox.id = 'link-checkbox';
        linkCheckbox.checked = this.plugin.settings.useLinks;
        const linkLabel = linkGroup.createEl('label', { 
            text: '번호를 링크로 생성 [[번호]]',
            attr: { for: 'link-checkbox' }
        });
        linkLabel.style.display = 'inline';
        linkLabel.style.marginLeft = '8px';
        linkGroup.style.display = 'none';
        
        numberCheckbox.addEventListener('change', () => {
            const isChecked = numberCheckbox.checked;
            startGroup.style.display = isChecked ? 'block' : 'none';
            linkGroup.style.display = isChecked ? 'block' : 'none';
            updatePreview();
        });
        
        // 미리보기
        const previewSection = form.createDiv('preview-section');
        previewSection.createEl('h3', { text: '👁️ 미리보기' });
        const previewContent = previewSection.createDiv('preview-content');
        
        const updatePreview = () => {
            const rows = parseInt(rowInput.value) || 5;
            const cols = parseInt(colInput.value) || 5;
            const numbered = numberCheckbox.checked;
            const startNum = parseInt(startInput.value) || 1;
            const totalCells = (rows - 1) * cols; // 헤더 제외
            const endNum = startNum + totalCells - 1;
            
            let preview = '<div class="preview-info">';
            preview += `<div class="preview-stat">총 셀: <strong>${totalCells}개</strong></div>`;
            if (numbered) {
                preview += `<div class="preview-stat">번호 범위: <strong>${String(startNum).padStart(3, '0')} ~ ${String(endNum).padStart(3, '0')}</strong></div>`;
            }
            preview += '</div>';
            
            preview += '<div class="preview-table">';
            // 간단한 표 미리보기 (최대 5x5)
            const previewRows = Math.min(rows, 4);
            const previewCols = Math.min(cols, 5);
            let num = startNum;
            
            for (let i = 0; i < previewRows; i++) {
                preview += '<div class="preview-row">';
                for (let j = 0; j < previewCols; j++) {
                    if (i === 0) {
                        preview += '<div class="preview-cell header">헤더</div>';
                    } else if (numbered) {
                        const numStr = String(num).padStart(3, '0');
                        preview += `<div class="preview-cell">${numStr}</div>`;
                        num++;
                    } else {
                        preview += '<div class="preview-cell">빈칸</div>';
                    }
                }
                if (cols > 5) {
                    preview += '<div class="preview-cell ellipsis">...</div>';
                }
                preview += '</div>';
            }
            if (rows > 4) {
                preview += '<div class="preview-row"><div class="preview-cell ellipsis" style="width: 100%;">...</div></div>';
            }
            preview += '</div>';
            
            previewContent.innerHTML = preview;
        };
        
        rowInput.addEventListener('input', updatePreview);
        colInput.addEventListener('input', updatePreview);
        startInput.addEventListener('input', updatePreview);
        updatePreview();
        
        // 버튼
        const btnContainer = form.createDiv('btn-container');
        const cancelBtn = btnContainer.createEl('button', { text: '취소' });
        cancelBtn.onclick = () => this.close();
        
        const generateBtn = btnContainer.createEl('button', { 
            text: '생성', 
            cls: 'mod-cta' 
        });
        generateBtn.onclick = () => {
            const rows = parseInt(rowInput.value);
            const cols = parseInt(colInput.value);
            const numbered = numberCheckbox.checked;
            const startNum = parseInt(startInput.value);
            const useLinks = linkCheckbox.checked;
            
            if (rows < 2 || rows > 50) {
                new Notice('❌ 행 개수는 2-50 사이여야 합니다');
                return;
            }
            if (cols < 2 || cols > 20) {
                new Notice('❌ 열 개수는 2-20 사이여야 합니다');
                return;
            }
            if (numbered && (startNum < 1 || startNum > 999)) {
                new Notice('❌ 시작 번호는 1-999 사이여야 합니다');
                return;
            }
            
            this.generateCustomTable(rows, cols, numbered, startNum, useLinks);
            this.close();
        };

        this.addStyles();
    }

    async generateCustomTable(rows, cols, numbered, startNum, useLinks) {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!activeView) {
            new Notice('⚠️ 활성 노트가 없습니다');
            return;
        }

        let table = '';
        let currentNum = startNum;
        
        // 헤더 행
        table += '|' + '     |'.repeat(cols) + '\n';
        table += '|' + ' --- |'.repeat(cols) + '\n';
        
        // 데이터 행 (헤더 제외하고 rows-1개)
        for (let i = 0; i < rows - 1; i++) {
            table += '|';
            for (let j = 0; j < cols; j++) {
                if (numbered) {
                    // 1~999 범위에서 3자리로 패딩
                    const numStr = currentNum <= 999 ? String(currentNum).padStart(3, '0') : String(currentNum);
                    const cell = useLinks ? ` [[${numStr}]] |` : ` ${numStr} |`;
                    table += cell;
                    currentNum++;
                } else {
                    table += '     |';
                }
            }
            table += '\n';
        }

        const editor = activeView.editor;
        const cursor = editor.getCursor();
        editor.replaceRange(table, cursor);
        
        this.plugin.settings.stats.tablesCreated++;
        this.plugin.settings.stats.lastUsed = new Date().toISOString();
        this.plugin.settings.stats.favoriteType = 'custom';
        await this.plugin.saveSettings();
        
        const totalCells = (rows - 1) * cols;
        const endNum = startNum + totalCells - 1;
        new Notice(`✅ ${rows}x${cols} 표 생성 완료! (${String(startNum).padStart(3, '0')}-${String(endNum).padStart(3, '0')})`);
    }

    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .modal-description {
                background: var(--background-secondary);
                padding: 12px 16px;
                border-radius: 8px;
                margin-bottom: 20px;
                border-left: 4px solid var(--interactive-accent);
            }
            .modal-description p {
                margin: 0;
                color: var(--text-muted);
                font-size: 13px;
            }
            .custom-table-form {
                margin-top: 20px;
            }
            .form-section {
                margin-bottom: 25px;
                padding: 15px;
                background: var(--background-primary-alt);
                border-radius: 8px;
            }
            .form-section h3 {
                margin: 0 0 15px 0;
                font-size: 14px;
                color: var(--text-normal);
                border-bottom: 2px solid var(--background-modifier-border);
                padding-bottom: 8px;
            }
            .form-group {
                margin-bottom: 15px;
            }
            .form-group label {
                display: block;
                margin-bottom: 5px;
                font-weight: 500;
                font-size: 13px;
            }
            .form-group input[type="number"] {
                width: 100%;
                padding: 10px;
                border: 2px solid var(--background-modifier-border);
                border-radius: 6px;
                background: var(--background-primary);
                font-size: 15px;
                transition: border-color 0.2s;
            }
            .form-group input[type="number"]:focus {
                border-color: var(--interactive-accent);
                outline: none;
            }
            .form-group input[type="checkbox"] {
                margin: 0;
                width: 18px;
                height: 18px;
                cursor: pointer;
            }
            .preview-section {
                background: var(--background-secondary);
                padding: 15px;
                border-radius: 8px;
                margin-top: 20px;
                border: 2px solid var(--background-modifier-border);
            }
            .preview-section h3 {
                margin: 0 0 12px 0;
                font-size: 14px;
            }
            .preview-info {
                display: flex;
                gap: 15px;
                margin-bottom: 15px;
                padding: 10px;
                background: var(--background-primary);
                border-radius: 6px;
            }
            .preview-stat {
                color: var(--text-muted);
                font-size: 13px;
            }
            .preview-stat strong {
                color: var(--interactive-accent);
                font-weight: 600;
            }
            .preview-table {
                display: flex;
                flex-direction: column;
                gap: 4px;
                font-family: monospace;
                font-size: 11px;
            }
            .preview-row {
                display: flex;
                gap: 4px;
            }
            .preview-cell {
                flex: 1;
                min-width: 50px;
                padding: 6px;
                background: var(--background-primary);
                border: 1px solid var(--background-modifier-border);
                border-radius: 3px;
                text-align: center;
                font-size: 11px;
            }
            .preview-cell.header {
                background: var(--interactive-accent);
                color: white;
                font-weight: bold;
            }
            .preview-cell.ellipsis {
                background: transparent;
                border: none;
                color: var(--text-muted);
            }
            .btn-container {
                display: flex;
                gap: 10px;
                justify-content: flex-end;
                margin-top: 25px;
                padding-top: 15px;
                border-top: 2px solid var(--background-modifier-border);
            }
            .btn-container button {
                padding: 10px 20px;
                font-weight: 600;
            }
        `;
        document.head.appendChild(style);
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// 설정 탭
class TableGeneratorSettingTab extends PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: '📊 Table Generator 설정' });

        // 일반 설정
        containerEl.createEl('h3', { text: '🎨 일반 설정' });

        new Setting(containerEl)
            .setName('리본 아이콘')
            .setDesc('사이드바 리본에 표시될 아이콘을 선택하세요 (재시작 필요)')
            .addDropdown(dropdown => dropdown
                .addOption('table', '📊 Table')
                .addOption('layout-grid', '▦ Grid')
                .addOption('layout', '◫ Layout')
                .addOption('sheet', '📄 Sheet')
                .addOption('file-spreadsheet', '📑 Spreadsheet')
                .addOption('grid', '⊞ Grid 2')
                .addOption('calendar', '📅 Calendar')
                .addOption('box', '◻ Box')
                .setValue(this.plugin.settings.ribbonIcon)
                .onChange(async (value) => {
                    this.plugin.settings.ribbonIcon = value;
                    await this.plugin.saveSettings();
                    new Notice('🔄 아이콘이 변경되었습니다. Obsidian을 재시작해주세요.');
                }));

        new Setting(containerEl)
            .setName('시작 시 대시보드 표시')
            .setDesc('Obsidian 실행 시 자동으로 대시보드를 엽니다')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showDashboardOnStartup)
                .onChange(async (value) => {
                    this.plugin.settings.showDashboardOnStartup = value;
                    await this.plugin.saveSettings();
                }));

        // 장 관리 설정
        containerEl.createEl('h3', { text: '📚 장(Chapter) 관리 설정' });

        new Setting(containerEl)
            .setName('기본 폴더')
            .setDesc('장이 생성될 기본 폴더 경로')
            .addText(text => text
                .setPlaceholder('Chapters')
                .setValue(this.plugin.settings.baseFolder)
                .onChange(async (value) => {
                    this.plugin.settings.baseFolder = value || 'Chapters';
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('자동 폴더 생성')
            .setDesc('장 생성 시 자동으로 폴더를 만듭니다')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.createFolders)
                .onChange(async (value) => {
                    this.plugin.settings.createFolders = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('자동 노트 생성')
            .setDesc('장 생성 시 100개의 노트 파일을 자동으로 생성합니다')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.autoCreateNotes)
                .onChange(async (value) => {
                    this.plugin.settings.autoCreateNotes = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('노트 템플릿')
            .setDesc('새 노트에 적용될 기본 템플릿 ({{title}}은 노트 제목으로 대체됨)')
            .addTextArea(text => {
                text.setPlaceholder('# {{title}}\n\n## 내용\n\n')
                    .setValue(this.plugin.settings.noteTemplate)
                    .onChange(async (value) => {
                        this.plugin.settings.noteTemplate = value;
                        await this.plugin.saveSettings();
                    });
                text.inputEl.rows = 4;
                text.inputEl.style.width = '100%';
            });

        // 표 생성 설정
        containerEl.createEl('h3', { text: '📏 표 생성 설정' });

        new Setting(containerEl)
            .setName('기본 행 개수')
            .setDesc('커스텀 표 생성 시 기본 행 개수 (2-50)')
            .addText(text => text
                .setPlaceholder('12')
                .setValue(String(this.plugin.settings.defaultRows))
                .onChange(async (value) => {
                    const num = parseInt(value);
                    if (!isNaN(num) && num >= 2 && num <= 50) {
                        this.plugin.settings.defaultRows = num;
                        await this.plugin.saveSettings();
                    }
                }));

        new Setting(containerEl)
            .setName('기본 열 개수')
            .setDesc('커스텀 표 생성 시 기본 열 개수 (2-20)')
            .addText(text => text
                .setPlaceholder('9')
                .setValue(String(this.plugin.settings.defaultCols))
                .onChange(async (value) => {
                    const num = parseInt(value);
                    if (!isNaN(num) && num >= 2 && num <= 20) {
                        this.plugin.settings.defaultCols = num;
                        await this.plugin.saveSettings();
                    }
                }));

        new Setting(containerEl)
            .setName('번호를 링크로 생성')
            .setDesc('번호를 [[번호]] 형식의 Obsidian 링크로 생성합니다')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.useLinks)
                .onChange(async (value) => {
                    this.plugin.settings.useLinks = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('시작 번호')
            .setDesc('번호 매기기 시작 번호 (기본값: 1)')
            .addText(text => text
                .setPlaceholder('1')
                .setValue(String(this.plugin.settings.startNumber))
                .onChange(async (value) => {
                    const num = parseInt(value);
                    if (!isNaN(num) && num >= 0) {
                        this.plugin.settings.startNumber = num;
                        await this.plugin.saveSettings();
                    }
                }));

        // 통계
        containerEl.createEl('h3', { text: '📊 사용 통계' });

        const statsDiv = containerEl.createDiv('settings-stats');
        const statsContent = statsDiv.createDiv('stats-content');
        
        const statRow1 = statsContent.createDiv('stat-row');
        statRow1.createEl('span', { text: '생성된 표:', cls: 'stat-label' });
        statRow1.createEl('span', { text: `${this.plugin.settings.stats.tablesCreated}개`, cls: 'stat-value' });
        
        const statRow2 = statsContent.createDiv('stat-row');
        statRow2.createEl('span', { text: '생성된 장:', cls: 'stat-label' });
        statRow2.createEl('span', { text: `${this.plugin.settings.stats.chaptersCreated}개`, cls: 'stat-value' });
        
        const statRow3 = statsContent.createDiv('stat-row');
        statRow3.createEl('span', { text: '생성된 노트:', cls: 'stat-label' });
        statRow3.createEl('span', { text: `${this.plugin.settings.stats.notesCreated}개`, cls: 'stat-value' });
        
        const statRow4 = statsContent.createDiv('stat-row');
        statRow4.createEl('span', { text: '마지막 사용:', cls: 'stat-label' });
        statRow4.createEl('span', { 
            text: this.plugin.settings.stats.lastUsed ? 
                new Date(this.plugin.settings.stats.lastUsed).toLocaleString('ko-KR') : '없음',
            cls: 'stat-value' 
        });

        new Setting(containerEl)
            .setName('통계 초기화')
            .setDesc('모든 사용 통계를 0으로 초기화합니다')
            .addButton(button => button
                .setButtonText('초기화')
                .setWarning()
                .onClick(async () => {
                    this.plugin.settings.stats = {
                        tablesCreated: 0,
                        chaptersCreated: 0,
                        notesCreated: 0,
                        lastUsed: null,
                        favoriteType: null
                    };
                    await this.plugin.saveSettings();
                    new Notice('✅ 통계가 초기화되었습니다');
                    this.display();
                }));

        // 정보
        containerEl.createEl('h3', { text: 'ℹ️ 정보' });
        const infoDiv = containerEl.createDiv('plugin-info');
        infoDiv.createEl('p', { text: '📊 Table Generator Plugin' });
        infoDiv.createEl('p', { text: '버전 1.0.0' });
        infoDiv.createEl('p', { text: '표 구조: 001-090 (메인) + 100-109 (보너스) = 100개 노트/장' });

        this.addStyles();
    }

    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .settings-stats {
                background: var(--background-primary-alt);
                padding: 20px;
                border-radius: 10px;
                margin: 15px 0;
                border-left: 4px solid var(--interactive-accent);
            }
            .stats-content {
                display: flex;
                flex-direction: column;
                gap: 10px;
            }
            .stat-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px 0;
                border-bottom: 1px solid var(--background-modifier-border);
            }
            .stat-row:last-child {
                border-bottom: none;
            }
            .stat-label {
                color: var(--text-muted);
                font-weight: 500;
            }
            .stat-value {
                color: var(--interactive-accent);
                font-weight: bold;
            }
            .plugin-info {
                background: var(--background-secondary);
                padding: 15px;
                border-radius: 8px;
                margin: 10px 0;
            }
            .plugin-info p {
                margin: 5px 0;
                color: var(--text-muted);
                font-size: 13px;
            }
            .plugin-info p:first-child {
                font-weight: bold;
                color: var(--text-normal);
                font-size: 14px;
            }
        `;
        document.head.appendChild(style);
    }
}

module.exports = TableGeneratorPlugin;