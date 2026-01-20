const { Plugin, PluginSettingTab, Setting, Notice, Modal, App, MarkdownView } = require('obsidian');

// 기본 설정
const DEFAULT_SETTINGS = {
    categories: ['책', '옷', '전자제품', '생활용품', '기타'],
    subCategories: {
        '책': ['읽는 중', '읽을 예정', '보관', '버릴 것'],
        '옷': ['자주 입음', '계절용', '보관', '버릴 것'],
        '전자제품': ['사용 중', '예비용', '고장', '버릴 것'],
        '생활용품': ['사용 중', '보관', '버릴 것'],
        '기타': ['사용 중', '보관', '버릴 것']
    },
    locations: ['5층선반-1층', '5층선반-2층', '5층선반-3층', '5층선반-4층', '5층선반-5층', '서랍-1단', '서랍-2단', '박스A', '박스B'],
    itemsFolder: 'Items',
    dashboardFile: 'Dashboard/물품관리대시보드.md'
};

class ItemOrganizerPlugin extends Plugin {
    async onload() {
        await this.loadSettings();

        // 리본 아이콘 추가
        this.addRibbonIcon('package', '물품 추가', () => {
            new ItemModal(this.app, this, null).open();
        });

        // 명령어 추가
        this.addCommand({
            id: 'add-item',
            name: '새 물품 추가',
            callback: () => {
                new ItemModal(this.app, this, null).open();
            }
        });

        this.addCommand({
            id: 'create-dashboard',
            name: '대시보드 생성',
            callback: () => {
                this.createDashboard();
            }
        });

        this.addCommand({
            id: 'open-items-table',
            name: '물품 테이블 열기',
            callback: () => {
                this.openItemsTable();
            }
        });

        // 설정 탭 추가
        this.addSettingTab(new ItemOrganizerSettingTab(this.app, this));

        // Items 폴더 생성
        this.ensureItemsFolder();

        console.log('Item Organizer 플러그인 로드됨');
    }

    async ensureItemsFolder() {
        const folder = this.app.vault.getAbstractFileByPath(this.settings.itemsFolder);
        if (!folder) {
            await this.app.vault.createFolder(this.settings.itemsFolder);
        }
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    async saveItem(item) {
        const fileName = `${this.settings.itemsFolder}/${item.name}.md`;
        const content = this.generateItemContent(item);
        
        const file = this.app.vault.getAbstractFileByPath(fileName);
        if (file) {
            await this.app.vault.modify(file, content);
        } else {
            await this.app.vault.create(fileName, content);
        }
        
        new Notice(`물품 "${item.name}" 저장됨`);
    }

    generateItemContent(item) {
        return `---
category: ${item.category}
subcategory: ${item.subcategory}
location: ${item.location}
quantity: ${item.quantity || 1}
tags: [물품, ${item.category}]
---

# ${item.name}

## 정보
- **대분류**: ${item.category}
- **소분류**: ${item.subcategory}
- **위치**: ${item.location}
- **수량**: ${item.quantity || 1}

## 메모
${item.memo || ''}

## 히스토리
- 등록일: ${new Date().toLocaleDateString('ko-KR')}
`;
    }

    async createDashboard() {
        const dashboardContent = `# 물품 관리 대시보드

## 📊 통계

\`\`\`dataviewjs
const items = dv.pages('"${this.settings.itemsFolder}"')

// 카테고리별 통계
const categoryStats = {}
for (let item of items) {
    const cat = item.category || '미분류'
    categoryStats[cat] = (categoryStats[cat] || 0) + 1
}

dv.header(3, "카테고리별 물품 수")
const categoryTable = Object.entries(categoryStats).map(([cat, count]) => [cat, count])
dv.table(["카테고리", "개수"], categoryTable)

// 위치별 통계
const locationStats = {}
for (let item of items) {
    const loc = item.location || '미지정'
    locationStats[loc] = (locationStats[loc] || 0) + 1
}

dv.header(3, "위치별 물품 수")
const locationTable = Object.entries(locationStats).map(([loc, count]) => [loc, count])
dv.table(["위치", "개수"], locationTable)

// 소분류별 통계
const subCategoryStats = {}
for (let item of items) {
    const subcat = item.subcategory || '미분류'
    subCategoryStats[subcat] = (subCategoryStats[subcat] || 0) + 1
}

dv.header(3, "상태별 물품 수")
const subCategoryTable = Object.entries(subCategoryStats).map(([subcat, count]) => [subcat, count])
dv.table(["상태", "개수"], subCategoryTable)
\`\`\`

## 📋 전체 물품 목록

\`\`\`dataviewjs
const items = dv.pages('"${this.settings.itemsFolder}"')
    .sort(i => i.file.name)

dv.table(
    ["물품명", "대분류", "소분류", "위치", "수량"],
    items.map(i => [
        i.file.link,
        i.category || '-',
        i.subcategory || '-',
        i.location || '-',
        i.quantity || 1
    ])
)
\`\`\`

## 🔍 필터링 뷰

### 버릴 물품
\`\`\`dataviewjs
const items = dv.pages('"${this.settings.itemsFolder}"')
    .where(i => i.subcategory && i.subcategory.includes('버릴'))

dv.table(
    ["물품명", "카테고리", "위치"],
    items.map(i => [i.file.link, i.category, i.location])
)
\`\`\`

### 카테고리별 상세

#### 📚 책
\`\`\`dataviewjs
const items = dv.pages('"${this.settings.itemsFolder}"')
    .where(i => i.category === '책')

dv.table(
    ["물품명", "상태", "위치"],
    items.map(i => [i.file.link, i.subcategory, i.location])
)
\`\`\`

#### 👕 옷
\`\`\`dataviewjs
const items = dv.pages('"${this.settings.itemsFolder}"')
    .where(i => i.category === '옷')

dv.table(
    ["물품명", "상태", "위치"],
    items.map(i => [i.file.link, i.subcategory, i.location])
)
\`\`\`

## 📍 위치별 물품

\`\`\`dataviewjs
const locations = ${JSON.stringify(this.settings.locations)}

for (let loc of locations) {
    const items = dv.pages('"${this.settings.itemsFolder}"')
        .where(i => i.location === loc)
    
    if (items.length > 0) {
        dv.header(3, loc)
        dv.table(
            ["물품명", "카테고리", "상태", "수량"],
            items.map(i => [i.file.link, i.category, i.subcategory, i.quantity])
        )
    }
}
\`\`\`
`;

        const dashboardPath = this.settings.dashboardFile;
        const folder = dashboardPath.substring(0, dashboardPath.lastIndexOf('/'));
        
        // 폴더 생성
        const folderExists = this.app.vault.getAbstractFileByPath(folder);
        if (!folderExists) {
            await this.app.vault.createFolder(folder);
        }

        // 대시보드 파일 생성 또는 업데이트
        const file = this.app.vault.getAbstractFileByPath(dashboardPath);
        if (file) {
            await this.app.vault.modify(file, dashboardContent);
        } else {
            await this.app.vault.create(dashboardPath, dashboardContent);
        }

        // 대시보드 열기
        const leaf = this.app.workspace.getLeaf(false);
        await leaf.openFile(this.app.vault.getAbstractFileByPath(dashboardPath));

        new Notice('대시보드가 생성/업데이트되었습니다');
    }

    async openItemsTable() {
        const tableContent = `# 물품 목록표

\`\`\`dataviewjs
const items = dv.pages('"${this.settings.itemsFolder}"')
    .sort(i => i.file.name)

dv.table(
    ["물품명", "대분류", "소분류", "위치", "수량", "등록일"],
    items.map(i => [
        i.file.link,
        i.category || '-',
        i.subcategory || '-',
        i.location || '-',
        i.quantity || 1,
        i.file.ctime ? i.file.ctime.toFormat("yyyy-MM-dd") : '-'
    ])
)
\`\`\`
`;

        const tablePath = `${this.settings.itemsFolder}/물품목록표.md`;
        const file = this.app.vault.getAbstractFileByPath(tablePath);
        
        if (file) {
            await this.app.vault.modify(file, tableContent);
        } else {
            await this.app.vault.create(tablePath, tableContent);
        }

        const leaf = this.app.workspace.getLeaf(false);
        await leaf.openFile(this.app.vault.getAbstractFileByPath(tablePath));
    }

    onunload() {
        console.log('Item Organizer 플러그인 언로드됨');
    }
}

// 물품 추가/수정 모달
class ItemModal extends Modal {
    constructor(app, plugin, existingItem) {
        super(app);
        this.plugin = plugin;
        this.existingItem = existingItem;
        this.item = existingItem || {
            name: '',
            category: '',
            subcategory: '',
            location: '',
            quantity: 1,
            memo: ''
        };
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        contentEl.createEl('h2', { text: this.existingItem ? '물품 수정' : '새 물품 추가' });

        // 물품명
        new Setting(contentEl)
            .setName('물품명')
            .addText(text => {
                text.setValue(this.item.name)
                    .setPlaceholder('예: 파이썬 프로그래밍 책')
                    .onChange(value => this.item.name = value);
                text.inputEl.style.width = '100%';
            });

        // 대분류 (드롭다운)
        new Setting(contentEl)
            .setName('대분류')
            .addDropdown(dropdown => {
                dropdown.addOption('', '선택하세요');
                this.plugin.settings.categories.forEach(cat => {
                    dropdown.addOption(cat, cat);
                });
                dropdown.setValue(this.item.category)
                    .onChange(value => {
                        this.item.category = value;
                        this.updateSubcategoryDropdown();
                    });
                this.categoryDropdown = dropdown;
            });

        // 소분류 (드롭다운)
        this.subcategorySetting = new Setting(contentEl)
            .setName('소분류');
        this.updateSubcategoryDropdown();

        // 위치 (드롭다운)
        new Setting(contentEl)
            .setName('위치')
            .addDropdown(dropdown => {
                dropdown.addOption('', '선택하세요');
                this.plugin.settings.locations.forEach(loc => {
                    dropdown.addOption(loc, loc);
                });
                dropdown.setValue(this.item.location)
                    .onChange(value => this.item.location = value);
            });

        // 수량
        new Setting(contentEl)
            .setName('수량')
            .addText(text => {
                text.setValue(String(this.item.quantity))
                    .setPlaceholder('1')
                    .onChange(value => this.item.quantity = parseInt(value) || 1);
                text.inputEl.type = 'number';
            });

        // 메모
        new Setting(contentEl)
            .setName('메모')
            .addTextArea(text => {
                text.setValue(this.item.memo)
                    .setPlaceholder('추가 정보나 메모를 입력하세요')
                    .onChange(value => this.item.memo = value);
                text.inputEl.style.width = '100%';
                text.inputEl.rows = 4;
            });

        // 저장 버튼
        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('저장')
                .setCta()
                .onClick(async () => {
                    if (!this.item.name) {
                        new Notice('물품명을 입력하세요');
                        return;
                    }
                    if (!this.item.category) {
                        new Notice('대분류를 선택하세요');
                        return;
                    }
                    
                    await this.plugin.saveItem(this.item);
                    this.close();
                }))
            .addButton(btn => btn
                .setButtonText('취소')
                .onClick(() => this.close()));
    }

    updateSubcategoryDropdown() {
        this.subcategorySetting.clear();
        this.subcategorySetting.addDropdown(dropdown => {
            dropdown.addOption('', '선택하세요');
            
            if (this.item.category && this.plugin.settings.subCategories[this.item.category]) {
                this.plugin.settings.subCategories[this.item.category].forEach(subcat => {
                    dropdown.addOption(subcat, subcat);
                });
            }
            
            dropdown.setValue(this.item.subcategory)
                .onChange(value => this.item.subcategory = value);
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// 설정 탭
class ItemOrganizerSettingTab extends PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'Item Organizer 설정' });

        new Setting(containerEl)
            .setName('물품 폴더')
            .setDesc('물품 파일들이 저장될 폴더')
            .addText(text => text
                .setPlaceholder('Items')
                .setValue(this.plugin.settings.itemsFolder)
                .onChange(async (value) => {
                    this.plugin.settings.itemsFolder = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('대시보드 파일 경로')
            .setDesc('대시보드 파일의 경로')
            .addText(text => text
                .setPlaceholder('Dashboard/물품관리대시보드.md')
                .setValue(this.plugin.settings.dashboardFile)
                .onChange(async (value) => {
                    this.plugin.settings.dashboardFile = value;
                    await this.plugin.saveSettings();
                }));

        // 카테고리 설정
        containerEl.createEl('h3', { text: '카테고리 관리' });
        
        new Setting(containerEl)
            .setName('대분류 추가')
            .addText(text => {
                this.newCategoryInput = text;
                text.setPlaceholder('새 카테고리명');
            })
            .addButton(btn => btn
                .setButtonText('추가')
                .onClick(async () => {
                    const newCat = this.newCategoryInput.getValue().trim();
                    if (newCat && !this.plugin.settings.categories.includes(newCat)) {
                        this.plugin.settings.categories.push(newCat);
                        this.plugin.settings.subCategories[newCat] = ['사용 중', '보관', '버릴 것'];
                        await this.plugin.saveSettings();
                        this.display();
                        new Notice(`카테고리 "${newCat}" 추가됨`);
                    }
                }));

        // 현재 카테고리 목록
        const categoriesDiv = containerEl.createDiv('categories-list');
        categoriesDiv.createEl('h4', { text: '현재 카테고리' });
        
        this.plugin.settings.categories.forEach(cat => {
            const catDiv = categoriesDiv.createDiv('category-item');
            catDiv.style.cssText = 'margin: 10px 0; padding: 10px; border: 1px solid var(--background-modifier-border); border-radius: 5px;';
            
            const catHeader = catDiv.createDiv();
            catHeader.createEl('strong', { text: cat });
            
            const subcatsDiv = catDiv.createDiv();
            subcatsDiv.style.marginLeft = '20px';
            subcatsDiv.createEl('em', { text: '소분류: ' });
            subcatsDiv.createSpan({ text: this.plugin.settings.subCategories[cat]?.join(', ') || '' });
        });

        // 위치 설정
        containerEl.createEl('h3', { text: '위치 관리' });
        
        new Setting(containerEl)
            .setName('위치 추가')
            .addText(text => {
                this.newLocationInput = text;
                text.setPlaceholder('예: 6층선반-1층');
            })
            .addButton(btn => btn
                .setButtonText('추가')
                .onClick(async () => {
                    const newLoc = this.newLocationInput.getValue().trim();
                    if (newLoc && !this.plugin.settings.locations.includes(newLoc)) {
                        this.plugin.settings.locations.push(newLoc);
                        await this.plugin.saveSettings();
                        this.display();
                        new Notice(`위치 "${newLoc}" 추가됨`);
                    }
                }));

        const locationsDiv = containerEl.createDiv('locations-list');
        locationsDiv.createEl('h4', { text: '현재 위치 목록' });
        locationsDiv.createEl('p', { text: this.plugin.settings.locations.join(', ') });
    }
}

module.exports = ItemOrganizerPlugin;
