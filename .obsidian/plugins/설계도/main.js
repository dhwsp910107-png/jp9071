const VIEW_TYPE_PALACE = 'memory-palace-view';

class MemoryPalacePlugin extends Plugin {
    async onload() {
        console.log('Loading Memory Palace Plugin');

        await this.loadSettings();

        this.registerView(
            VIEW_TYPE_PALACE,
            (leaf) => new MemoryPalaceView(leaf, this)
        );

        this.addCommand({
            id: 'create-memory-palace',
            name: '새 기억의 궁전 만들기',
            callback: () => {
                new PalaceDesignModal(this.app, this, async (name, layout) => {
                    await this.createMemoryPalace(name, layout);
                }).open();
            }
        });

        this.addCommand({
            id: 'open-palace-view',
            name: '기억의 궁전 뷰 열기',
            callback: () => {
                this.activatePalaceView();
            }
        });

        this.addRibbonIcon('castle', '기억의 궁전', () => {
            this.activatePalaceView();
        });
    }

    async loadSettings() {
        this.settings = Object.assign({}, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    async activatePalaceView() {
        const { workspace } = this.app;
        let leaf = workspace.getLeavesOfType(VIEW_TYPE_PALACE)[0];
        
        if (!leaf) {
            leaf = workspace.getRightLeaf(false);
            await leaf.setViewState({ type: VIEW_TYPE_PALACE, active: true });
        }
        
        workspace.revealLeaf(leaf);
    }

    async createMemoryPalace(name, layout) {
        const fileName = `${name}.json`;
        const filePath = `Memory Palaces/${fileName}`;
        
        const folder = this.app.vault.getAbstractFileByPath('Memory Palaces');
        if (!folder) {
            await this.app.vault.createFolder('Memory Palaces');
        }

        const palaceData = {
            name: name,
            layout: layout,
            created: Date.now(),
            locations: layout === 'custom' ? [] : this.getLayoutLocations(layout),
            connections: layout === 'custom' ? [] : this.getLayoutConnections(layout),
            isCustom: layout === 'custom'
        };

        try {
            await this.app.vault.create(filePath, JSON.stringify(palaceData, null, 2));
            new Notice(`기억의 궁전 \"${name}\"이 생성되었습니다!`);
            await this.activatePalaceView();
        } catch (error) {
            new Notice('파일 생성 중 오류가 발생했습니다.');
            console.error(error);
        }
    }

    getLayoutLocations(layout) {
        const layouts = {
            house: [
                { id: 'entrance', name: '현관', x: 300, y: 520, items: [] },
                { id: 'hallway', name: '복도', x: 300, y: 400, items: [] },
                { id: 'living', name: '거실', x: 150, y: 250, items: [] },
                { id: 'bedroom1', name: '안방', x: 450, y: 250, items: [] },
                { id: 'bedroom2', name: '작은방', x: 450, y: 100, items: [] },
                { id: 'kitchen', name: '부엌', x: 150, y: 100, items: [] },
                { id: 'bathroom', name: '화장실', x: 300, y: 100, items: [] },
                { id: 'balcony', name: '베란다', x: 150, y: 400, items: [] }
            ],
            path: [
                { id: 'gate', name: '대문', x: 300, y: 520, items: [] },
                { id: 'garden', name: '정원', x: 300, y: 450, items: [] },
                { id: 'fountain', name: '분수대', x: 300, y: 380, items: [] },
                { id: 'bench1', name: '첫번째 벤치', x: 200, y: 310, items: [] },
                { id: 'tree', name: '큰 나무', x: 300, y: 250, items: [] },
                { id: 'bench2', name: '두번째 벤치', x: 400, y: 190, items: [] },
                { id: 'statue', name: '조각상', x: 300, y: 130, items: [] },
                { id: 'door', name: '건물 입구', x: 300, y: 70, items: [] }
            ],
            building: [
                { id: 'lobby', name: '로비', x: 300, y: 520, items: [] },
                { id: 'elevator', name: '엘리베이터', x: 300, y: 450, items: [] },
                { id: 'floor3', name: '3층 복도', x: 300, y: 380, items: [] },
                { id: 'office1', name: '301호', x: 150, y: 310, items: [] },
                { id: 'office2', name: '302호', x: 300, y: 310, items: [] },
                { id: 'office3', name: '303호', x: 450, y: 310, items: [] },
                { id: 'floor2', name: '2층 복도', x: 300, y: 240, items: [] },
                { id: 'room1', name: '201호', x: 150, y: 170, items: [] },
                { id: 'room2', name: '202호', x: 300, y: 170, items: [] },
                { id: 'room3', name: '203호', x: 450, y: 170, items: [] },
                { id: 'floor1', name: '1층 복도', x: 300, y: 100, items: [] },
                { id: 'exit', name: '출구', x: 300, y: 40, items: [] }
            ]
        };
        return layouts[layout] || layouts.house;
    }

    getLayoutConnections(layout) {
        const connections = {
            house: [
                ['entrance', 'hallway'],
                ['hallway', 'living'],
                ['hallway', 'bedroom1'],
                ['hallway', 'kitchen'],
                ['hallway', 'bathroom'],
                ['kitchen', 'bedroom2'],
                ['living', 'balcony']
            ],
            path: [
                ['gate', 'garden'],
                ['garden', 'fountain'],
                ['fountain', 'bench1'],
                ['bench1', 'tree'],
                ['tree', 'bench2'],
                ['bench2', 'statue'],
                ['statue', 'door']
            ],
            building: [
                ['lobby', 'elevator'],
                ['elevator', 'floor3'],
                ['floor3', 'office1'],
                ['floor3', 'office2'],
                ['floor3', 'office3'],
                ['floor3', 'floor2'],
                ['floor2', 'room1'],
                ['floor2', 'room2'],
                ['floor2', 'room3'],
                ['floor2', 'floor1'],
                ['floor1', 'exit']
            ]
        };
        return connections[layout] || connections.house;
    }

    async getAllPalaces() {
        const files = this.app.vault.getFiles();
        return files.filter(file => 
            file.path.startsWith('Memory Palaces/') && file.extension === 'json'
        );
    }

    onunload() {
        this.app.workspace.detachLeavesOfType(VIEW_TYPE_PALACE);
    }
}

class MemoryPalaceView extends ItemView {
    constructor(leaf, plugin) {
        super(leaf);
        this.plugin = plugin;
        this.currentPalace = null;
        this.palaceData = null;
        this.selectedLocation = null;
        this.hoveredLocation = null;
        this.editMode = false;
        this.draggedLocation = null;
        this.connectMode = false;
        this.connectFrom = null;
    }

    getViewType() {
        return VIEW_TYPE_PALACE;
    }

    getDisplayText() {
        return '기억의 궁전';
    }

    getIcon() {
        return 'castle';
    }

    async onOpen() {
        const container = this.containerEl.children[1];
        container.empty();
        container.style.padding = '0';
        container.style.overflow = 'auto';
        await this.renderPalaceList(container);
    }

    async renderPalaceList(container) {
        container.empty();
        
        const wrapper = container.createDiv();
        wrapper.style.padding = '20px';

        wrapper.createEl('h2', { text: '🏰 나의 기억의 궁전' });
        
        const btnContainer = wrapper.createDiv();
        btnContainer.style.marginBottom = '20px';
        btnContainer.style.display = 'flex';
        btnContainer.style.gap = '10px';

        const createBtn = btnContainer.createEl('button', { text: '+ 새 궁전 만들기' });
        createBtn.classList.add('mod-cta');
        createBtn.addEventListener('click', () => {
            new PalaceDesignModal(this.app, this.plugin, async (name, layout) => {
                await this.plugin.createMemoryPalace(name, layout);
                await this.renderPalaceList(container);
            }).open();
        });

        const palaces = await this.plugin.getAllPalaces();
        
        if (palaces.length === 0) {
            wrapper.createEl('p', { text: '아직 생성된 궁전이 없습니다. 새 궁전을 만들어보세요!' });
            return;
        }

        const grid = wrapper.createDiv();
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(250px, 1fr))';
        grid.style.gap = '15px';

        for (const palace of palaces) {
            const content = await this.app.vault.read(palace);
            const data = JSON.parse(content);
            
            const card = grid.createDiv();
            card.style.padding = '15px';
            card.style.border = '1px solid var(--background-modifier-border)';
            card.style.borderRadius = '8px';
            card.style.cursor = 'pointer';
            card.style.transition = 'all 0.2s';

            const title = card.createEl('h3', { text: data.name });
            title.style.marginBottom = '10px';

            const itemCount = data.locations.reduce((sum, loc) => sum + loc.items.length, 0);
            const stats = card.createDiv();
            stats.style.fontSize = '0.9em';
            stats.style.color = 'var(--text-muted)';
            stats.innerHTML = `
                <div>📍 장소: ${data.locations.length}개</div>
                <div>💡 기억: ${itemCount}개</div>
                ${data.isCustom ? '<div>🎨 커스텀 지도</div>' : ''}
            `;

            card.addEventListener('mouseenter', () => {
                card.style.backgroundColor = 'var(--background-modifier-hover)';
                card.style.transform = 'translateY(-2px)';
            });
            card.addEventListener('mouseleave', () => {
                card.style.backgroundColor = '';
                card.style.transform = '';
            });
            card.addEventListener('click', async () => {
                await this.renderPalaceView(container, palace, data);
            });
        }
    }

    async renderPalaceView(container, palace, data) {
        container.empty();
        this.currentPalace = palace;
        this.palaceData = data;
        this.editMode = false;
        this.connectMode = false;

        const wrapper = container.createDiv();
        wrapper.style.padding = '15px';

        const header = wrapper.createDiv();
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';
        header.style.marginBottom = '15px';
        header.style.flexWrap = 'wrap';
        header.style.gap = '10px';

        const leftBtns = header.createDiv();
        leftBtns.style.display = 'flex';
        leftBtns.style.gap = '10px';

        const backBtn = leftBtns.createEl('button', { text: '← 목록으로' });
        backBtn.addEventListener('click', () => this.renderPalaceList(container));

        const title = header.createEl('h2', { text: data.name });
        title.style.margin = '0';

        const rightBtns = header.createDiv();
        rightBtns.style.display = 'flex';
        rightBtns.style.gap = '10px';

        const editBtn = rightBtns.createEl('button', { text: '✏️ 편집' });
        editBtn.addEventListener('click', () => {
            this.editMode = !this.editMode;
            this.connectMode = false;
            editBtn.textContent = this.editMode ? '✅ 완료' : '✏️ 편집';
            editBtn.style.backgroundColor = this.editMode ? 'var(--interactive-accent)' : '';
            this.drawPalaceMap(wrapper.querySelector('canvas'));
            this.updateToolbar(wrapper);
        });

        const deleteBtn = rightBtns.createEl('button', { text: '🗑️ 삭제' });
        deleteBtn.style.backgroundColor = 'var(--background-modifier-error)';
        deleteBtn.addEventListener('click', async () => {
            if (confirm(`\"${data.name}\" 궁전을 삭제하시겠습니까?`)) {
                await this.app.vault.delete(palace);
                new Notice('궁전이 삭제되었습니다.');
                await this.renderPalaceList(container);
            }
        });

        const toolbar = wrapper.createDiv();
        toolbar.classList.add('edit-toolbar');
        toolbar.style.marginBottom = '15px';
        toolbar.style.padding = '10px';
        toolbar.style.backgroundColor = 'var(--background-secondary)';
        toolbar.style.borderRadius = '8px';
        toolbar.style.display = 'none';

        const canvasContainer = wrapper.createDiv();
        canvasContainer.style.position = 'relative';
        canvasContainer.style.marginBottom = '20px';
        canvasContainer.style.display = 'flex';
        canvasContainer.style.justifyContent = 'center';

        const canvas = canvasContainer.createEl('canvas');
        canvas.width = 600;
        canvas.height = 600;
        canvas.style.border = '2px solid var(--background-modifier-border)';
        canvas.style.borderRadius = '8px';
        canvas.style.backgroundColor = '#fafafa';
        canvas.style.maxWidth = '100%';
        canvas.style.cursor = 'pointer';

        this.setupCanvasEvents(canvas, wrapper);
        this.drawPalaceMap(canvas);

        if (data.locations.length > 0) {
            this.selectedLocation = data.locations[0].id;
            this.drawPalaceMap(canvas);
            this.showLocationDetails(wrapper);
        }

        this.updateToolbar(wrapper);
    }

    updateToolbar(wrapper) {
        const toolbar = wrapper.querySelector('.edit-toolbar');
        if (!toolbar) return;

        toolbar.empty();

        if (this.editMode) {
            toolbar.style.display = 'flex';
            toolbar.style.gap = '10px';
            toolbar.style.alignItems = 'center';
            toolbar.style.flexWrap = 'wrap';

            const addLocBtn = toolbar.createEl('button', { text: '➕ 장소 추가' });
            addLocBtn.classList.add('mod-cta');
            addLocBtn.addEventListener('click', () => {
                new AddLocationModal(this.app, async (name) => {
                    const newId = 'loc_' + Date.now();
                    this.palaceData.locations.push({
                        id: newId,
                        name: name,
                        x: 300,
                        y: 300,
                        items: []
                    });
                    await this.savePalace();
                    this.drawPalaceMap(wrapper.querySelector('canvas'));
                    new Notice(`장소 \"${name}\"이 추가되었습니다!`);
                }).open();
            });

            const connectBtn = toolbar.createEl('button', { text: '🔗 연결하기' });
            connectBtn.style.backgroundColor = this.connectMode ? 'var(--interactive-accent)' : '';
            connectBtn.addEventListener('click', () => {
                this.connectMode = !this.connectMode;
                this.connectFrom = null;
                connectBtn.style.backgroundColor = this.connectMode ? 'var(--interactive-accent)' : '';
                new Notice(this.connectMode ? '연결할 첫 번째 장소를 클릭하세요' : '연결 모드 종료');
            });

            if (this.selectedLocation) {
                const deleteLocBtn = toolbar.createEl('button', { text: '🗑️ 선택된 장소 삭제' });
                deleteLocBtn.style.backgroundColor = 'var(--background-modifier-error)';
                deleteLocBtn.addEventListener('click', async () => {
                    const loc = this.palaceData.locations.find(l => l.id === this.selectedLocation);
                    if (loc && confirm(`\"${loc.name}\" 장소를 삭제하시겠습니까?`)) {
                        this.palaceData.connections = this.palaceData.connections.filter(
                            ([from, to]) => from !== this.selectedLocation && to !== this.selectedLocation
                        );
                        this.palaceData.locations = this.palaceData.locations.filter(
                            l => l.id !== this.selectedLocation
                        );
                        this.selectedLocation = null;
                        await this.savePalace();
                        this.drawPalaceMap(wrapper.querySelector('canvas'));
                        this.updateToolbar(wrapper);
                        const existing = wrapper.querySelector('.location-details');
                        if (existing) existing.remove();
                        new Notice('장소가 삭제되었습니다.');
                    }
                });

                const renameBtn = toolbar.createEl('button', { text: '✏️ 이름 변경' });
                renameBtn.addEventListener('click', () => {
                    const loc = this.palaceData.locations.find(l => l.id === this.selectedLocation);
                    if (loc) {
                        new RenameLocationModal(this.app, loc.name, async (newName) => {
                            loc.name = newName;
                            await this.savePalace();
                            this.drawPalaceMap(wrapper.querySelector('canvas'));
                            this.showLocationDetails(wrapper);
                            new Notice('이름이 변경되었습니다.');
                        }).open();
                    }
                });
            }

            toolbar.createEl('span', { text: '💡 드래그로 이동 가능' });
        } else {
            toolbar.style.display = 'none';
        }
    }

    setupCanvasEvents(canvas, wrapper) {
        let isDragging = false;

        canvas.addEventListener('mousedown', (e) => {
            const rect = canvas.getBoundingClientRect();
            const x = (e.clientX - rect.left) * (canvas.width / rect.width);
            const y = (e.clientY - rect.top) * (canvas.height / rect.height);
            
            const clicked = this.getLocationAt(x, y);

            if (this.editMode && clicked) {
                if (this.connectMode) {
                    if (!this.connectFrom) {
                        this.connectFrom = clicked;
                        new Notice('두 번째 장소를 클릭하세요');
                    } else if (this.connectFrom !== clicked) {
                        const exists = this.palaceData.connections.some(
                            ([from, to]) => 
                                (from === this.connectFrom && to === clicked) ||
                                (from === clicked && to === this.connectFrom)
                        );
                        if (!exists) {
                            this.palaceData.connections.push([this.connectFrom, clicked]);
                            this.savePalace();
                            new Notice('연결되었습니다!');
                        } else {
                            new Notice('이미 연결되어 있습니다.');
                        }
                        this.connectFrom = null;
                        this.drawPalaceMap(canvas);
                    }
                } else {
                    isDragging = true;
                    this.draggedLocation = clicked;
                }
            } else if (clicked) {
                this.selectedLocation = clicked;
                this.drawPalaceMap(canvas);
                this.showLocationDetails(wrapper);
                this.updateToolbar(wrapper);
            }
        });

        canvas.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            const x = (e.clientX - rect.left) * (canvas.width / rect.width);
            const y = (e.clientY - rect.top) * (canvas.height / rect.height);
            
            if (isDragging && this.draggedLocation && this.editMode) {
                const loc = this.palaceData.locations.find(l => l.id === this.draggedLocation);
                if (loc) {
                    loc.x = Math.max(30, Math.min(570, x));
                    loc.y = Math.max(30, Math.min(570, y));
                    this.drawPalaceMap(canvas);
                }
            } else {
                const hovered = this.getLocationAt(x, y);
                if (hovered !== this.hoveredLocation) {
                    this.hoveredLocation = hovered;
                    this.drawPalaceMap(canvas);
                }
            }
        });

        canvas.addEventListener('mouseup', async () => {
            if (isDragging && this.draggedLocation) {
                await this.savePalace();
            }
            isDragging = false;
            this.draggedLocation = null;
        });

        canvas.addEventListener('mouseleave', async () => {
            if (isDragging && this.draggedLocation) {
                await this.savePalace();
            }
            isDragging = false;
            this.draggedLocation = null;
            this.hoveredLocation = null;
            this.drawPalaceMap(canvas);
        });
    }

    drawPalaceMap(canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.strokeStyle = '#ccc';
        ctx.lineWidth = 2;
        this.palaceData.connections.forEach(([from, to]) => {
            const fromLoc = this.palaceData.locations.find(l => l.id === from);
            const toLoc = this.palaceData.locations.find(l => l.id === to);
            if (fromLoc && toLoc) {
                ctx.beginPath();
                ctx.moveTo(fromLoc.x, fromLoc.y);
                ctx.lineTo(toLoc.x, toLoc.y);
                ctx.stroke();
            }
        });

        if (this.connectMode && this.connectFrom) {
            const fromLoc = this.palaceData.locations.find(l => l.id === this.connectFrom);
            if (fromLoc) {
                ctx.strokeStyle = '#ff9800';
                ctx.lineWidth = 3;
                ctx.setLineDash([5, 5]);
                ctx.beginPath();
                ctx.arc(fromLoc.x, fromLoc.y, 35, 0, Math.PI * 2);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        }

        this.palaceData.locations.forEach((loc, index) => {
            const isSelected = this.selectedLocation === loc.id;
            const isHovered = this.hoveredLocation === loc.id;
            const hasItems = loc.items.length > 0;

            if (isSelected || isHovered) {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
                ctx.beginPath();
                ctx.arc(loc.x + 2, loc.y + 2, 28, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.fillStyle = isSelected ? '#2196f3' : 
                           isHovered ? '#64b5f6' :
                           hasItems ? '#4caf50' : '#fff';
            ctx.strokeStyle = isSelected ? '#1976d2' : '#999';
            ctx.lineWidth = isSelected ? 3 : 2;
            
            ctx.beginPath();
            ctx.arc(loc.x, loc.y, 25, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = isSelected || hasItems ? '#fff' : '#666';
            ctx.font = 'bold 16px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText((index + 1).toString(), loc.x, loc.y);

            if (hasItems) {
                ctx.fillStyle = '#ff5722';
                ctx.beginPath();
                ctx.arc(loc.x + 18, loc.y - 18, 10, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 10px sans-serif';
                ctx.fillText(loc.items.length.toString(), loc.x + 18, loc.y - 18);
            }

            ctx.fillStyle = '#333';
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(loc.name, loc.x, loc.y + 45);
        });
    }

    getLocationAt(x, y) {
        for (const loc of this.palaceData.locations) {
            const dist = Math.sqrt((x - loc.x) ** 2 + (y - loc.y) ** 2);
            if (dist < 25) return loc.id;
        }
        return null;
    }

    showLocationDetails(wrapper) {
        const existing = wrapper.querySelector('.location-details');
        if (existing) existing.remove();

        const location = this.palaceData.locations.find(l => l.id === this.selectedLocation);
        if (!location) return;

        const details = wrapper.createDiv({ cls: 'location-details' });
        details.style.padding = '20px';
        details.style.border = '2px solid var(--background-modifier-border)';
        details.style.borderRadius = '8px';
        details.style.backgroundColor = 'var(--background-primary)';

        const header = details.createDiv();
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';
        header.style.marginBottom = '15px';

        header.createEl('h3', { text: `📍 ${location.name}` });

        const addBtn = header.createEl('button', { text: '+ 기억 추가' });
        addBtn.classList.add('mod-cta');
        addBtn.addEventListener('click', () => {
            new AddMemoryModal(this.app, async (memory) => {
                location.items.push({
                    id: Date.now().toString(),
                    content: memory,
                    created: Date.now()
                });
                await this.savePalace();
                this.showLocationDetails(wrapper);
                this.drawPalaceMap(wrapper.querySelector('canvas'));
            }).open();
        });

        if (location.items.length === 0) {
            details.createEl('p', { 
                text: '아직 기억이 없습니다. "기억 추가" 버튼을 눌러 시작하세요!',
                cls: 'text-muted'
            });
        } else {
            const list = details.createDiv();
            list.style.display = 'flex';
            list.style.flexDirection = 'column';
            list.style.gap = '10px';

            location.items.forEach((item, index) => {
                const itemEl = list.createDiv();
                itemEl.style.padding = '12px';
                itemEl.style.backgroundColor = 'var(--background-secondary)';
                itemEl.style.borderRadius = '5px';
                itemEl.style.display = 'flex';
                itemEl.style.justifyContent = 'space-between';
                itemEl.style.alignItems = 'start';

                const content = itemEl.createDiv();
                content.style.flex = '1';
                content.createEl('strong', { text: `${index + 1}. ` });
                content.createSpan({ text: item.content });

                const btnGroup = itemEl.createDiv();
                btnGroup.style.display = 'flex';
                btnGroup.style.gap = '5px';

                const deleteBtn = btnGroup.createEl('button', { text: '🗑️' });
                deleteBtn.style.padding = '4px 8px';
                deleteBtn.style.fontSize = '12px';
                deleteBtn.addEventListener('click', async () => {
                    location.items.splice(index, 1);
                    await this.savePalace();
                    this.showLocationDetails(wrapper);
                    this.drawPalaceMap(wrapper.querySelector('canvas'));
                });
            });
        }

        const stats = details.createDiv();
        stats.style.marginTop = '15px';
        stats.style.padding = '10px';
        stats.style.backgroundColor = 'var(--background-secondary)';
        stats.style.borderRadius = '5px';
        stats.style.fontSize = '0.9em';
        stats.style.color = 'var(--text-muted)';
        stats.innerHTML = `총 ${location.items.length}개의 기억`;
    }

    async savePalace() {
        if (this.currentPalace && this.palaceData) {
            await this.plugin.app.vault.modify(
                this.currentPalace,
                JSON.stringify(this.palaceData, null, 2)
            );
        }
    }

    async onClose() {
        // Cleanup
    }
}

// Modal Classes
class PalaceDesignModal extends Modal {
    constructor(app, plugin, onSubmit) {
        super(app);
        this.plugin = plugin;
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl('h2', { text: '새 기억의 궁전 만들기' });

        const form = contentEl.createDiv();
        form.style.display = 'flex';
        form.style.flexDirection = 'column';
        form.style.gap = '15px';

        // 이름 입력
        const nameLabel = form.createEl('label', { text: '궁전 이름' });
        nameLabel.style.fontWeight = 'bold';
        const nameInput = form.createEl('input', { type: 'text', placeholder: '예: 내 집, 출근길, 회사 건물' });
        nameInput.style.width = '100%';
        nameInput.style.padding = '8px';

        // 레이아웃 선택
        const layoutLabel = form.createEl('label', { text: '레이아웃 선택' });
        layoutLabel.style.fontWeight = 'bold';
        layoutLabel.style.marginTop = '10px';

        const layouts = [
            { value: 'house', label: '🏠 집 (8개 장소)', desc: '현관, 거실, 방, 부엌 등' },
            { value: 'path', label: '🚶 길 (8개 장소)', desc: '대문, 정원, 분수대, 나무 등' },
            { value: 'building', label: '🏢 건물 (12개 장소)', desc: '로비, 엘리베이터, 사무실 등' },
            { value: 'custom', label: '🎨 커스텀', desc: '직접 장소를 추가하여 만들기' }
        ];

        const layoutContainer = form.createDiv();
        layoutContainer.style.display = 'grid';
        layoutContainer.style.gap = '10px';

        let selectedLayout = 'house';

        layouts.forEach(layout => {
            const option = layoutContainer.createDiv();
            option.style.padding = '15px';
            option.style.border = '2px solid var(--background-modifier-border)';
            option.style.borderRadius = '8px';
            option.style.cursor = 'pointer';
            option.style.transition = 'all 0.2s';

            const title = option.createEl('div', { text: layout.label });
            title.style.fontWeight = 'bold';
            title.style.marginBottom = '5px';

            const desc = option.createEl('div', { text: layout.desc });
            desc.style.fontSize = '0.9em';
            desc.style.color = 'var(--text-muted)';

            const updateSelection = () => {
                layoutContainer.querySelectorAll('div').forEach(el => {
                    if (el.parentElement === layoutContainer) {
                        el.style.borderColor = 'var(--background-modifier-border)';
                        el.style.backgroundColor = '';
                    }
                });
                option.style.borderColor = 'var(--interactive-accent)';
                option.style.backgroundColor = 'var(--background-modifier-hover)';
                selectedLayout = layout.value;
            };

            if (layout.value === 'house') {
                updateSelection();
            }

            option.addEventListener('click', updateSelection);
            option.addEventListener('mouseenter', () => {
                if (selectedLayout !== layout.value) {
                    option.style.backgroundColor = 'var(--background-modifier-hover)';
                }
            });
            option.addEventListener('mouseleave', () => {
                if (selectedLayout !== layout.value) {
                    option.style.backgroundColor = '';
                }
            });
        });

        // 버튼
        const btnContainer = form.createDiv();
        btnContainer.style.display = 'flex';
        btnContainer.style.gap = '10px';
        btnContainer.style.marginTop = '20px';

        const createBtn = btnContainer.createEl('button', { text: '만들기' });
        createBtn.classList.add('mod-cta');
        createBtn.addEventListener('click', async () => {
            const name = nameInput.value.trim();
            if (!name) {
                new Notice('궁전 이름을 입력해주세요!');
                return;
            }
            await this.onSubmit(name, selectedLayout);
            this.close();
        });

        const cancelBtn = btnContainer.createEl('button', { text: '취소' });
        cancelBtn.addEventListener('click', () => this.close());

        nameInput.focus();
        nameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                createBtn.click();
            }
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

class AddLocationModal extends Modal {
    constructor(app, onSubmit) {
        super(app);
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl('h2', { text: '새 장소 추가' });

        const form = contentEl.createDiv();
        form.style.display = 'flex';
        form.style.flexDirection = 'column';
        form.style.gap = '15px';
        form.style.marginTop = '20px';

        const label = form.createEl('label', { text: '장소 이름' });
        label.style.fontWeight = 'bold';
        
        const input = form.createEl('input', { 
            type: 'text', 
            placeholder: '예: 창가, 책상, 문 앞' 
        });
        input.style.width = '100%';
        input.style.padding = '8px';

        const btnContainer = form.createDiv();
        btnContainer.style.display = 'flex';
        btnContainer.style.gap = '10px';
        btnContainer.style.marginTop = '10px';

        const addBtn = btnContainer.createEl('button', { text: '추가' });
        addBtn.classList.add('mod-cta');
        addBtn.addEventListener('click', async () => {
            const name = input.value.trim();
            if (!name) {
                new Notice('장소 이름을 입력해주세요!');
                return;
            }
            await this.onSubmit(name);
            this.close();
        });

        const cancelBtn = btnContainer.createEl('button', { text: '취소' });
        cancelBtn.addEventListener('click', () => this.close());

        input.focus();
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                addBtn.click();
            }
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

class AddMemoryModal extends Modal {
    constructor(app, onSubmit) {
        super(app);
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl('h2', { text: '새 기억 추가' });

        const form = contentEl.createDiv();
        form.style.display = 'flex';
        form.style.flexDirection = 'column';
        form.style.gap = '15px';
        form.style.marginTop = '20px';

        const label = form.createEl('label', { text: '기억할 내용' });
        label.style.fontWeight = 'bold';
        
        const textarea = form.createEl('textarea', { 
            placeholder: '기억하고 싶은 내용을 입력하세요...' 
        });
        textarea.style.width = '100%';
        textarea.style.minHeight = '100px';
        textarea.style.padding = '8px';
        textarea.style.resize = 'vertical';

        const hint = form.createEl('div', { 
            text: '💡 팁: 생생한 이미지나 감정과 연결하면 더 잘 기억됩니다!' 
        });
        hint.style.fontSize = '0.9em';
        hint.style.color = 'var(--text-muted)';
        hint.style.fontStyle = 'italic';

        const btnContainer = form.createDiv();
        btnContainer.style.display = 'flex';
        btnContainer.style.gap = '10px';
        btnContainer.style.marginTop = '10px';

        const addBtn = btnContainer.createEl('button', { text: '추가' });
        addBtn.classList.add('mod-cta');
        addBtn.addEventListener('click', async () => {
            const content = textarea.value.trim();
            if (!content) {
                new Notice('내용을 입력해주세요!');
                return;
            }
            await this.onSubmit(content);
            this.close();
        });

        const cancelBtn = btnContainer.createEl('button', { text: '취소' });
        cancelBtn.addEventListener('click', () => this.close());

        textarea.focus();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

class RenameLocationModal extends Modal {
    constructor(app, currentName, onSubmit) {
        super(app);
        this.currentName = currentName;
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl('h2', { text: '장소 이름 변경' });

        const form = contentEl.createDiv();
        form.style.display = 'flex';
        form.style.flexDirection = 'column';
        form.style.gap = '15px';
        form.style.marginTop = '20px';

        const label = form.createEl('label', { text: '새 이름' });
        label.style.fontWeight = 'bold';
        
        const input = form.createEl('input', { 
            type: 'text',
            value: this.currentName
        });
        input.style.width = '100%';
        input.style.padding = '8px';

        const btnContainer = form.createDiv();
        btnContainer.style.display = 'flex';
        btnContainer.style.gap = '10px';
        btnContainer.style.marginTop = '10px';

        const saveBtn = btnContainer.createEl('button', { text: '저장' });
        saveBtn.classList.add('mod-cta');
        saveBtn.addEventListener('click', async () => {
            const newName = input.value.trim();
            if (!newName) {
                new Notice('이름을 입력해주세요!');
                return;
            }
            await this.onSubmit(newName);
            this.close();
        });

        const cancelBtn = btnContainer.createEl('button', { text: '취소' });
        cancelBtn.addEventListener('click', () => this.close());

        input.focus();
        input.select();
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                saveBtn.click();
            }
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

module.exports = MemoryPalacePlugin;