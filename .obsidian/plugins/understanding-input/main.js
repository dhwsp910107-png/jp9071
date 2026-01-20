const { Plugin, Notice, Modal } = require('obsidian');

class UnderstandingInputPlugin extends Plugin {
    async onload() {
        console.log('🎯 Understanding Input 플러그인 로드');
        
        // 명령어 등록
        this.addCommand({
            id: 'input-understanding',
            name: '📝 이해도 입력',
            callback: () => {
                new UnderstandingModal(this.app).open();
            }
        });
        
        this.addCommand({
            id: 'input-time-understanding',
            name: '⏰ 시간과 이해도 입력',
            callback: () => {
                this.recordTimeAndUnderstanding();
            }
        });
        
        this.addCommand({
            id: 'record-time-only',
            name: '⏱️ 현재 시간만 기록',
            callback: () => {
                this.recordCurrentTime();
            }
        });
    }
    
    async recordCurrentTime() {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            new Notice('❌ 활성 파일이 없습니다.');
            return;
        }
        
        const now = new Date();
        const timeString = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
        
        await this.addTimeToFile(activeFile, timeString);
        new Notice(`✅ 시간 기록: ${this.formatTimeKorean(timeString)}`);
    }
    
    async recordTimeAndUnderstanding() {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            new Notice('❌ 활성 파일이 없습니다.');
            return;
        }
        
        // 시간 기록
        const now = new Date();
        const timeString = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
        await this.addTimeToFile(activeFile, timeString);
        
        // 이해도 모달 열기
        new UnderstandingModal(this.app, timeString).open();
    }
    
    formatTimeKorean(timeString) {
        const [hours, minutes, seconds] = timeString.split(':');
        return `${hours}시 ${minutes}분 ${seconds}초`;
    }
    
    async addTimeToFile(file, timeString) {
        try {
            const content = await this.app.vault.read(file);
            const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
            
            let newContent = content;
            
            if (frontmatterMatch) {
                const frontmatter = frontmatterMatch[1];
                const timesMatch = frontmatter.match(/times:\s*\[(.*?)\]/s);
                
                let newTimesArray;
                if (timesMatch) {
                    const existingTimes = timesMatch[1].split(',').map(t => t.trim().replace(/"/g, '')).filter(t => t);
                    existingTimes.push(`"${timeString}"`);
                    newTimesArray = `times: [${existingTimes.join(', ')}]`;
                    newContent = content.replace(/times:\s*\[.*?\]/s, newTimesArray);
                } else {
                    newContent = content.replace(
                        frontmatterMatch[0],
                        `---\n${frontmatter}\ntimes: ["${timeString}"]\n---`
                    );
                }
            } else {
                newContent = `---\ntimes: ["${timeString}"]\n---\n\n${content}`;
            }
            
            await this.app.vault.modify(file, newContent);
        } catch (error) {
            console.error('시간 추가 오류:', error);
            new Notice('❌ 시간 기록 중 오류가 발생했습니다.');
        }
    }
    
    async addUnderstandingToFile(file, understanding) {
        try {
            const content = await this.app.vault.read(file);
            const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
            
            let newContent = content;
            
            if (frontmatterMatch) {
                const frontmatter = frontmatterMatch[1];
                const understandingsMatch = frontmatter.match(/understandings:\s*\[(.*?)\]/s);
                
                let newUnderstandingsArray;
                if (understandingsMatch) {
                    const existingUnderstandings = understandingsMatch[1].split(',').map(u => u.trim()).filter(u => u);
                    existingUnderstandings.push(understanding.toString());
                    newUnderstandingsArray = `understandings: [${existingUnderstandings.join(', ')}]`;
                    newContent = content.replace(/understandings:\s*\[.*?\]/s, newUnderstandingsArray);
                } else {
                    newContent = content.replace(
                        frontmatterMatch[0],
                        `---\n${frontmatter}\nunderstandings: [${understanding}]\n---`
                    );
                }
            } else {
                newContent = `---\nunderstandings: [${understanding}]\n---\n\n${content}`;
            }
            
            await this.app.vault.modify(file, newContent);
        } catch (error) {
            console.error('이해도 추가 오류:', error);
            new Notice('❌ 이해도 기록 중 오류가 발생했습니다.');
        }
    }
}

class UnderstandingModal extends Modal {
    constructor(app, timeString = null) {
        super(app);
        this.timeString = timeString;
    }
    
    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        // 제목
        contentEl.createEl('h2', { text: '🎯 이해도 입력' });
        
        if (this.timeString) {
            const timeDiv = contentEl.createDiv();
            timeDiv.style.cssText = `
                background: #e8f5e8;
                padding: 10px;
                border-radius: 8px;
                margin-bottom: 20px;
                text-align: center;
                border: 2px solid #4caf50;
            `;
            timeDiv.textContent = `⏰ 시간 기록됨: ${this.formatTimeKorean(this.timeString)}`;
        }
        
        // 설명
        const desc = contentEl.createDiv();
        desc.textContent = '이해도를 0-100 사이의 숫자로 입력하세요:';
        desc.style.marginBottom = '15px';
        
        // 입력 필드
        const input = contentEl.createEl('input');
        input.type = 'number';
        input.min = '0';
        input.max = '100';
        input.placeholder = '85';
        input.style.cssText = `
            width: 100%;
            padding: 10px;
            font-size: 1.2rem;
            text-align: center;
            border: 2px solid #ddd;
            border-radius: 8px;
            margin-bottom: 20px;
        `;
        
        // 빠른 선택 버튼들
        const quickDiv = contentEl.createDiv();
        quickDiv.style.cssText = `
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 10px;
            margin-bottom: 20px;
        `;
        
        const quickValues = [
            { value: 100, text: '완벽', color: '#4caf50' },
            { value: 85, text: '우수', color: '#2196f3' },
            { value: 70, text: '양호', color: '#ff9800' },
            { value: 50, text: '보통', color: '#f44336' }
        ];
        
        quickValues.forEach(item => {
            const btn = quickDiv.createEl('button');
            btn.textContent = `${item.text}\n${item.value}%`;
            btn.style.cssText = `
                padding: 10px 5px;
                background: ${item.color};
                color: white;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-size: 0.9rem;
                white-space: pre-line;
            `;
            btn.addEventListener('click', () => {
                input.value = item.value;
                input.focus();
            });
        });
        
        // 버튼 컨테이너
        const buttonDiv = contentEl.createDiv();
        buttonDiv.style.cssText = `
            display: flex;
            gap: 10px;
            justify-content: center;
        `;
        
        // 저장 버튼
        const saveBtn = buttonDiv.createEl('button');
        saveBtn.textContent = '✅ 저장';
        saveBtn.style.cssText = `
            padding: 12px 24px;
            background: #4caf50;
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 1rem;
        `;
        
        // 취소 버튼
        const cancelBtn = buttonDiv.createEl('button');
        cancelBtn.textContent = '❌ 취소';
        cancelBtn.style.cssText = `
            padding: 12px 24px;
            background: #f44336;
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 1rem;
        `;
        
        // 이벤트 리스너
        saveBtn.addEventListener('click', async () => {
            const value = parseInt(input.value);
            if (isNaN(value) || value < 0 || value > 100) {
                new Notice('⚠️ 0-100 사이의 숫자를 입력해주세요!');
                return;
            }
            
            const activeFile = this.app.workspace.getActiveFile();
            if (!activeFile) {
                new Notice('❌ 활성 파일이 없습니다.');
                return;
            }
            
            await this.app.plugins.plugins['understanding-input'].addUnderstandingToFile(activeFile, value);
            
            if (this.timeString) {
                new Notice(`✅ 기록 완료!\n시간: ${this.formatTimeKorean(this.timeString)}\n이해도: ${value}%`);
            } else {
                new Notice(`✅ 이해도 기록 완료: ${value}%`);
            }
            
            this.close();
        });
        
        cancelBtn.addEventListener('click', () => {
            this.close();
        });
        
        // Enter 키로 저장
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                saveBtn.click();
            }
        });
        
        // 포커스
        input.focus();
    }
    
    formatTimeKorean(timeString) {
        const [hours, minutes, seconds] = timeString.split(':');
        return `${hours}시 ${minutes}분 ${seconds}초`;
    }
}

module.exports = UnderstandingInputPlugin;