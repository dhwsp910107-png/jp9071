// ==================== Obsidian 여행 플래너 플러그인 (대시보드 포함 + 메인 파일 연동) ====================
// 파일명: main.js

const { Plugin, ItemView, PluginSettingTab, Setting, Notice, TFolder, TFile, Modal } = require('obsidian');

const VIEW_TYPE = 'travel-planner-view';

// ==================== 기본 설정 ====================
const DEFAULT_SETTINGS = {
    travelFolderPath: '여행',
    defaultCurrency: '원',
    defaultPeople: 2,
    trips: [],
    lastSelectedTrip: null
};

// ==================== 공통 헬퍼 함수 ====================
class TripFileHelper {
    static getMainTripFile(app, currentTrip) {
        if (!currentTrip) return null;
        const mainFilePath = `${currentTrip.path}/${currentTrip.name}.md`;
        const file = app.vault.getAbstractFileByPath(mainFilePath);
        return file instanceof TFile ? file : null;
    }
    
    static getMainTripFileByPath(app, tripPath, tripName) {
        const mainFilePath = `${tripPath}/${tripName}.md`;
        const file = app.vault.getAbstractFileByPath(mainFilePath);
        return file instanceof TFile ? file : null;
    }
    
    static async addBudgetToMainFile(app, currentTrip, category, item, amount, currency = '원') {
        const mainFile = this.getMainTripFile(app, currentTrip);
        if (!mainFile) {
            console.error('❌ 메인 파일을 찾을 수 없음');
            return;
        }
        
        let content = await app.vault.read(mainFile);
        
        // 경비 관리 섹션 찾기
        const budgetSectionRegex = /## 💰 경비 관리([\s\S]*?)(?=\n## |$)/;
        const match = content.match(budgetSectionRegex);
        
        if (match) {
            const budgetSection = match[0];
            const tableRegex = /(\|.*\|[\s\S]*?\|.*\|\n\|[-:| ]+\|\n(?:\|.*\|\n)*)/;
            const tableMatch = budgetSection.match(tableRegex);
            
            if (tableMatch) {
                const table = tableMatch[0];
                const emoji = this.getCategoryEmoji(category);
                const newRow = `| ${emoji} ${category} | ${item} | ${amount}${currency} |  |\n`;
                
                // 마지막 행 찾기 (총 예산 행 전에 삽입)
                const lines = table.split('\n');
                const lastRowIndex = lines.length - 2; // 마지막 빈 줄 제외
                lines.splice(lastRowIndex, 0, newRow.trim());
                const updatedTable = lines.join('\n');
                
                content = content.replace(table, updatedTable);
                await app.vault.modify(mainFile, content);
                console.log('✅ 메인 파일에 경비 추가 완료');
            }
        }
    }
    
    static async addDestinationToMainFile(app, currentTrip, name, location, priority) {
        const mainFile = this.getMainTripFile(app, currentTrip);
        if (!mainFile) {
            console.error('❌ 메인 파일을 찾을 수 없음');
            return;
        }
        
        let content = await app.vault.read(mainFile);
        
        // 방문할 곳 섹션 찾기
        const destinationSectionRegex = /## 📍 방문할 곳([\s\S]*?)(?=\n## |$)/;
        const match = content.match(destinationSectionRegex);
        
        if (match) {
            const priorityText = priority === 'high' ? '#필수' : priority === 'medium' ? '#추천' : '#선택';
            
            const newDestination = `\n- [ ] **${name}**\n  - 📍 위치: ${location}\n  - ⏰ 소요시간: \n  - 💰 비용: \n  - 📝 메모: \n  - 🏷️ 태그: ${priorityText}\n`;
            
            // 필수 방문지 섹션 뒤에 추가
            const insertPosition = content.indexOf('---', content.indexOf('## 📍 방문할 곳'));
            if (insertPosition !== -1) {
                content = content.slice(0, insertPosition) + newDestination + '\n' + content.slice(insertPosition);
                await app.vault.modify(mainFile, content);
                console.log('✅ 메인 파일에 여행지 추가 완료');
            }
        }
    }
    
    static async addScheduleToMainFile(app, currentTrip, day, date) {
        const mainFile = this.getMainTripFile(app, currentTrip);
        if (!mainFile) {
            console.error('❌ 메인 파일을 찾을 수 없음');
            return;
        }
        
        let content = await app.vault.read(mainFile);
        
        // 일정표 섹션 찾기
        const scheduleSectionRegex = /## 📅 일정표([\s\S]*?)(?=\n## |$)/;
        const match = content.match(scheduleSectionRegex);
        
        if (match) {
            const dateObj = new Date(date);
            const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][dateObj.getDay()];
            
            const newSchedule = `\n### DAY ${day} - ${date} (${dayOfWeek})\n\n- **10:00 AM** - 출발\n  - 메모: \n\n- **02:00 PM** - \n  - 메모: \n\n- **07:00 PM** - 저녁 식사\n  - 메모: \n`;
            
            // 체크리스트 섹션 전에 삽입
            const insertPosition = content.indexOf('## ✅ 체크리스트');
            if (insertPosition !== -1) {
                content = content.slice(0, insertPosition) + newSchedule + '\n---\n\n' + content.slice(insertPosition);
                await app.vault.modify(mainFile, content);
                console.log('✅ 메인 파일에 일정 추가 완료');
            }
        }
    }
    
    static getCategoryEmoji(category) {
        const emojiMap = {
            '항공권': '✈️',
            '숙박': '🏨',
            '식비': '🍜',
            '관광': '🎫',
            '교통': '🚇',
            '쇼핑': '🛍️'
        };
        return emojiMap[category] || '💵';
    }
}

// (... 계속됩니다 ...)
