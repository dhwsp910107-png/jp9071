// Eisenhower Matrix 버튼 수정 스크립트
const fs = require('fs');
const path = require('path');

const mainJsPath = path.join(__dirname, 'main.js');

console.log('🔧 Eisenhower Matrix 플러그인 수정 시작...\n');

// 파일 읽기
let content = fs.readFileSync(mainJsPath, 'utf8');

// 수정 1: createDailyNote
const oldDaily = `        try {
            if (!await this.app.vault.adapter.exists(fileName)) {
                await this.app.vault.create(fileName, content);
                new Notice('일간 노트가 생성되었습니다.');
            } else {
                new Notice('일간 노트가 이미 존재합니다.');
            }
        } catch (error) {
            console.error('Error creating daily note:', error);
            new Notice('일간 노트 생성에 실패했습니다.');
        }
    }`;

const newDaily = `        try {
            let file;
            if (!await this.app.vault.adapter.exists(fileName)) {
                file = await this.app.vault.create(fileName, content);
                new Notice('일간 노트가 생성되었습니다.');
            } else {
                file = this.app.vault.getAbstractFileByPath(fileName);
                new Notice('일간 노트가 이미 존재합니다.');
            }
            
            // 파일 열기
            if (file) {
                const leaf = this.app.workspace.getLeaf(false);
                await leaf.openFile(file);
            }
        } catch (error) {
            console.error('Error creating daily note:', error);
            new Notice('일간 노트 생성에 실패했습니다.');
        }
    }`;

if (content.includes(oldDaily)) {
    content = content.replace(oldDaily, newDaily);
    console.log('✅ createDailyNote() 수정 완료');
} else {
    console.log('⚠️  createDailyNote() 이미 수정되었거나 패턴을 찾을 수 없음');
}

// 수정 2: createWeeklyNote
const oldWeekly = `        try {
            if (!await this.app.vault.adapter.exists(fileName)) {
                await this.app.vault.create(fileName, content);
                new Notice('주간 노트가 생성되었습니다.');
            } else {
                new Notice('주간 노트가 이미 존재합니다.');
            }
        } catch (error) {
            console.error('Error creating weekly note:', error);
            new Notice('주간 노트 생성에 실패했습니다.');
        }
    }`;

const newWeekly = `        try {
            let file;
            if (!await this.app.vault.adapter.exists(fileName)) {
                file = await this.app.vault.create(fileName, content);
                new Notice('주간 노트가 생성되었습니다.');
            } else {
                file = this.app.vault.getAbstractFileByPath(fileName);
                new Notice('주간 노트가 이미 존재합니다.');
            }
            
            // 파일 열기
            if (file) {
                const leaf = this.app.workspace.getLeaf(false);
                await leaf.openFile(file);
            }
        } catch (error) {
            console.error('Error creating weekly note:', error);
            new Notice('주간 노트 생성에 실패했습니다.');
        }
    }`;

if (content.includes(oldWeekly)) {
    content = content.replace(oldWeekly, newWeekly);
    console.log('✅ createWeeklyNote() 수정 완료');
} else {
    console.log('⚠️  createWeeklyNote() 이미 수정되었거나 패턴을 찾을 수 없음');
}

// 수정 3: createMonthlyNote
const oldMonthly = `        try {
            if (!await this.app.vault.adapter.exists(fileName)) {
                await this.app.vault.create(fileName, content);
                new Notice('월간 노트가 생성되었습니다.');
            } else {
                new Notice('월간 노트가 이미 존재합니다.');
            }
        } catch (error) {
            console.error('Error creating monthly note:', error);
            new Notice('월간 노트 생성에 실패했습니다.');
        }
    }`;

const newMonthly = `        try {
            let file;
            if (!await this.app.vault.adapter.exists(fileName)) {
                file = await this.app.vault.create(fileName, content);
                new Notice('월간 노트가 생성되었습니다.');
            } else {
                file = this.app.vault.getAbstractFileByPath(fileName);
                new Notice('월간 노트가 이미 존재합니다.');
            }
            
            // 파일 열기
            if (file) {
                const leaf = this.app.workspace.getLeaf(false);
                await leaf.openFile(file);
            }
        } catch (error) {
            console.error('Error creating monthly note:', error);
            new Notice('월간 노트 생성에 실패했습니다.');
        }
    }`;

if (content.includes(oldMonthly)) {
    content = content.replace(oldMonthly, newMonthly);
    console.log('✅ createMonthlyNote() 수정 완료');
} else {
    console.log('⚠️  createMonthlyNote() 이미 수정되었거나 패턴을 찾을 수 없음');
}

// 백업 생성
const backupPath = path.join(__dirname, 'main.js.backup_' + Date.now());
fs.writeFileSync(backupPath, fs.readFileSync(mainJsPath, 'utf8'));
console.log(`\n💾 백업 파일 생성: ${backupPath}`);

// 수정된 파일 저장
fs.writeFileSync(mainJsPath, content, 'utf8');
console.log('💾 main.js 파일 저장 완료');

console.log('\n✨ 수정 완료! Obsidian을 재시작하세요 (Ctrl+R)');
console.log('\n📝 변경사항:');
console.log('   - 일간/주간/월간 노트 생성 시 자동으로 파일 열기 기능 추가');
console.log('   - 기존 노트가 있을 경우에도 자동으로 열기');
