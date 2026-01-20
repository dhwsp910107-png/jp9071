const { Plugin, Modal, Setting, Notice } = require('obsidian');

// ========================================
// 옵시디언 플러그인 클래스
// ========================================

class PageProgressManagerPlugin extends Plugin {
    async onload() {
        console.log('📚 페이지 진도 관리 시스템 로딩 시작');
        
        try {
            // 리본 아이콘 추가
            this.addRibbonIcon('book-open', '진도 관리 대시보드', () => {
                this.openDashboard();
            });

            // 명령어 추가
            this.addCommand({
                id: 'open-progress-dashboard',
                name: '진도 관리 대시보드 열기',
                callback: () => {
                    this.openDashboard();
                }
            });

            console.log('✅ 페이지 진도 관리 시스템 로딩 완료');
            new Notice('📚 페이지 진도 관리 시스템 활성화');

        } catch (error) {
            console.error('❌ 플러그인 로딩 오류:', error);
            new Notice('플러그인 로딩 실패: ' + error.message);
        }
    }

    onunload() {
        console.log('📚 페이지 진도 관리 시스템 언로드');
    }

    openDashboard() {
        new ProgressDashboardModal(this.app).open();
    }
}

// ========================================
// 대시보드 모달 클래스
// ========================================

class ProgressDashboardModal extends Modal {
    constructor(app) {
        super(app);
        this.data = {
            folders: [
                { name: '직류회로', blocks: 3, time: 4320 },
                { name: '교류회로', blocks: 2, time: 2700 },
                { name: '변압기', blocks: 2, time: 2220 },
                { name: '전동기', blocks: 1, time: 0 }
            ],
            blocks: [
                { id: 1, folder: '직류회로', name: 'Chapter 1', start: 1, end: 20, segments: [true, true, true, false, false, false], time: 2040 },
                { id: 2, folder: '교류회로', name: 'Chapter 2', start: 21, end: 40, segments: [true, true, false, false, false, false], time: 1380 },
                { id: 3, folder: '변압기', name: 'Chapter 3', start: 41, end: 60, segments: [false, false, false, false, false, false], time: 0 }
            ],
            currentStudy: null,
            studyHistory: [
                { folder: '교류회로', block: 'Chapter 2', pages: '21-40p', segment: 3, time: 1380, timestamp: Date.now() - 900000 },
                { folder: '직류회로', block: 'Chapter 1', pages: '1-20p', segment: 3, time: 2040, timestamp: Date.now() - 7200000 },
                { folder: '변압기', block: 'Chapter 3', pages: '41-60p', segment: 2, time: 1680, timestamp: Date.now() - 86400000 }
            ]
        };
        this.timerInterval = null;
        this.timerStartTime = null;
        this.timerElapsed = 0;
        this.isPaused = false;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        contentEl.addClass('page-progress-dashboard');
        
        // 제목
        contentEl.createEl('h2', { text: '📚 페이지 진도 관리 시스템' });
        
        this.loadData();
        this.renderDashboard();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
        
        // 타이머 정리
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }
    }

    renderDashboard() {
        const { contentEl } = this;
        
        // 기존 대시보드 내용 제거 (제목 제외)
        const children = Array.from(contentEl.children);
        children.slice(1).forEach(child => child.remove());
        
        // 대시보드 컨테이너
        const dashboardContainer = contentEl.createDiv({ cls: 'dashboard-container' });
        
        this.renderFolders(dashboardContainer);
        this.renderBlocks(dashboardContainer);
        this.renderTimer(dashboardContainer);
        this.renderHistory(dashboardContainer);
        
        this.addStyles();
    }

    renderFolders(container) {
        const foldersSection = container.createDiv({ cls: 'folders-section' });
        foldersSection.createEl('h3', { text: '📁 과목별 진도' });
        
        const foldersGrid = foldersSection.createDiv({ cls: 'folders-grid' });
        
        this.data.folders.forEach(folder => {
            const folderCard = foldersGrid.createDiv({ cls: 'folder-card' });
            
            folderCard.createEl('h4', { text: folder.name });
            folderCard.createEl('p', { text: `블록: ${folder.blocks}개` });
            folderCard.createEl('p', { text: `학습시간: ${this.formatTime(folder.time)}` });
            
            const progressBar = folderCard.createDiv({ cls: 'progress-bar' });
            const progressFill = progressBar.createDiv({ cls: 'progress-fill' });
            
            // 진도율 계산 (임시로 랜덤)
            const progress = Math.min(folder.blocks * 20, 100);
            progressFill.style.width = `${progress}%`;
            
            folderCard.createEl('p', { text: `진도: ${progress}%` });
        });
    }

    renderBlocks(container) {
        const blocksSection = container.createDiv({ cls: 'blocks-section' });
        blocksSection.createEl('h3', { text: '📖 블록별 상세' });
        
        const blocksList = blocksSection.createDiv({ cls: 'blocks-list' });
        
        this.data.blocks.forEach(block => {
            const blockCard = blocksList.createDiv({ cls: 'block-card' });
            
            blockCard.createEl('h4', { text: `${block.folder} - ${block.name}` });
            blockCard.createEl('p', { text: `페이지: ${block.start}-${block.end}` });
            blockCard.createEl('p', { text: `학습시간: ${this.formatTime(block.time)}` });
            
            // 세그먼트 표시
            const segmentsDiv = blockCard.createDiv({ cls: 'segments' });
            block.segments.forEach((completed, index) => {
                const segment = segmentsDiv.createDiv({ 
                    cls: `segment ${completed ? 'completed' : 'pending'}` 
                });
                segment.textContent = index + 1;
                
                segment.addEventListener('click', () => {
                    this.toggleSegment(block.id, index);
                });
            });
            
            // 학습 시작 버튼
            const startBtn = blockCard.createEl('button', { 
                text: '📚 학습 시작',
                cls: 'start-study-btn'
            });
            
            startBtn.addEventListener('click', () => {
                this.startStudy(block);
            });
        });
    }

    renderTimer(container) {
        const timerSection = container.createDiv({ cls: 'timer-section' });
        timerSection.createEl('h3', { text: '⏱️ 학습 타이머' });
        
        const timerDisplay = timerSection.createDiv({ cls: 'timer-display' });
        this.timerDisplayEl = timerDisplay.createEl('div', { 
            text: this.formatTime(this.timerElapsed),
            cls: 'timer-time'
        });
        
        const timerControls = timerSection.createDiv({ cls: 'timer-controls' });
        
        this.startPauseBtn = timerControls.createEl('button', { 
            text: this.timerInterval ? '⏸️ 일시정지' : '▶️ 시작',
            cls: 'timer-btn start-pause'
        });
        
        const stopBtn = timerControls.createEl('button', { 
            text: '⏹️ 정지',
            cls: 'timer-btn stop'
        });
        
        this.startPauseBtn.addEventListener('click', () => {
            this.toggleTimer();
        });
        
        stopBtn.addEventListener('click', () => {
            this.stopTimer();
        });
        
        if (this.data.currentStudy) {
            const currentStudyDiv = timerSection.createDiv({ cls: 'current-study' });
            currentStudyDiv.createEl('p', { 
                text: `📖 현재 학습: ${this.data.currentStudy.folder} - ${this.data.currentStudy.name}` 
            });
        }
    }

    renderHistory(container) {
        const historySection = container.createDiv({ cls: 'history-section' });
        historySection.createEl('h3', { text: '📊 최근 학습 기록' });
        
        const historyList = historySection.createDiv({ cls: 'history-list' });
        
        this.data.studyHistory.slice(0, 5).forEach(record => {
            const historyItem = historyList.createDiv({ cls: 'history-item' });
            
            const date = new Date(record.timestamp);
            const timeAgo = this.getTimeAgo(date);
            
            historyItem.innerHTML = `
                <div class="history-info">
                    <strong>${record.folder}</strong> - ${record.pages}
                    <br>
                    <small>세그먼트 ${record.segment} | ${this.formatTime(record.time)} | ${timeAgo}</small>
                </div>
            `;
        });
    }

    // ========================================
    // 유틸리티 메소드들
    // ========================================
let data = {
    folders: [
        { name: '직류회로', blocks: 3, time: 4320 },
        { name: '교류회로', blocks: 2, time: 2700 },
        { name: '변압기', blocks: 2, time: 2220 },
        { name: '전동기', blocks: 1, time: 0 }
    ],
    blocks: [
        { id: 1, folder: '직류회로', name: 'Chapter 1', start: 1, end: 20, segments: [true, true, true, false, false, false], time: 2040 },
        { id: 2, folder: '교류회로', name: 'Chapter 2', start: 21, end: 40, segments: [true, true, false, false, false, false], time: 1380 },
        { id: 3, folder: '변압기', name: 'Chapter 3', start: 41, end: 60, segments: [false, false, false, false, false, false], time: 0 }
    ],
    currentStudy: null,
    studyHistory: [
        { folder: '교류회로', block: 'Chapter 2', pages: '21-40p', segment: 3, time: 1380, timestamp: Date.now() - 900000 },
        { folder: '직류회로', block: 'Chapter 1', pages: '1-20p', segment: 3, time: 2040, timestamp: Date.now() - 7200000 },
        { folder: '변압기', block: 'Chapter 3', pages: '41-60p', segment: 2, time: 1680, timestamp: Date.now() - 86400000 }
    ]
};

// 타이머 관련 변수
let timerInterval = null;
let timerStartTime = null;
let timerElapsed = 0;
let isPaused = false;

// ========================================
// 로컬스토리지 관리
// ========================================

/**
 * 데이터를 로컬스토리지에 저장
 */
function saveData() {
    try {
        localStorage.setItem('studyData', JSON.stringify(data));
        console.log('데이터 저장 완료');
        updateDashboard();
    } catch (error) {
        console.error('데이터 저장 실패:', error);
        alert('데이터 저장에 실패했습니다.');
    }
}

/**
 * 로컬스토리지에서 데이터 불러오기
 */
function loadData() {
    try {
        const saved = localStorage.getItem('studyData');
        if (saved) {
            data = JSON.parse(saved);
            console.log('저장된 데이터 로드 완료');
        }
    } catch (error) {
        console.error('데이터 로드 실패:', error);
        alert('데이터를 불러오는데 실패했습니다. 기본 데이터로 시작합니다.');
    }
    
    // UI 렌더링
    renderFolders();
    renderBlocks();
    updateDashboard();
}

/**
 * 데이터 초기화
 */
function resetData() {
    if (confirm('모든 데이터를 초기화하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) {
        localStorage.removeItem('studyData');
        location.reload();
    }
}

/**
 * 데이터 내보내기 (JSON 파일)
 */
function exportData() {
    const dataStr = JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `study-data-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
}

/**
 * 데이터 가져오기 (JSON 파일)
 */
function importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const imported = JSON.parse(event.target.result);
                if (confirm('데이터를 가져오시겠습니까? 현재 데이터는 덮어씌워집니다.')) {
                    data = imported;
                    saveData();
                    alert('데이터 가져오기 완료!');
                }
            } catch (error) {
                alert('잘못된 파일 형식입니다.');
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

// ========================================
// 유틸리티 함수
// ========================================

/**
 * 시간 포맷팅 (초 → 시간/분 문자열)
 */
function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
}

/**
 * 상대 시간 계산 (타임스탬프 → "15분 전", "2시간 전" 등)
 */
function getRelativeTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return '방금 전';
    if (minutes < 60) return `${minutes}분 전`;
    if (hours < 24) return `${hours}시간 전`;
    if (days === 1) return '어제';
    if (days < 7) return `${days}일 전`;
    return new Date(timestamp).toLocaleDateString('ko-KR');
}

/**
 * 진행률 계산
 */
function calculateProgress(segments) {
    const completed = segments.filter(s => s).length;
    return Math.round((completed / segments.length) * 100);
}

/**
 * 오늘 날짜 확인
 */
function isToday(timestamp) {
    const date = new Date(timestamp);
    const today = new Date();
    return date.toDateString() === today.toDateString();
}

// ========================================
// 페이지 로드 시 초기화
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('페이지 진도 관리 시스템 시작');
    loadData();
    
    // 키보드 단축키 등록
    document.addEventListener('keydown', (e) => {
        // Ctrl + S: 데이터 저장
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            saveData();
            alert('데이터가 저장되었습니다.');
        }
        
        // Esc: 모달 닫기
        if (e.key === 'Escape') {
            closeFolderModal();
            closeBlockModal();
            if (data.currentStudy) {
                if (confirm('학습을 종료하시겠습니까?')) {
                    closeTimer();
                }
            }
        }
    });
});

// 페이지 언로드 시 자동 저장
window.addEventListener('beforeunload', () => {
    saveData();
});
// ========================================
// Part 2: 탭 및 모달 관리
// ========================================

/**
 * 탭 전환
 */
function switchTab(tabName) {
    // 모든 탭 버튼에서 active 클래스 제거
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // 모든 탭 컨텐츠에서 active 클래스 제거
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // 클릭된 탭 버튼에 active 클래스 추가
    event.target.classList.add('active');
    
    // 해당 탭 컨텐츠 표시
    document.getElementById(tabName).classList.add('active');
    
    // 탭별 추가 동작
    if (tabName === 'blocks') {
        renderBlocks();
    } else if (tabName === 'folders') {
        renderFolders();
    } else if (tabName === 'dashboard') {
        updateDashboard();
    }
}

// ========================================
// 폴더 모달 관리
// ========================================

/**
 * 폴더 추가 모달 열기
 */
function openFolderModal() {
    document.getElementById('folderModal').classList.add('active');
    document.getElementById('folderName').focus();
}

/**
 * 폴더 추가 모달 닫기
 */
function closeFolderModal() {
    document.getElementById('folderModal').classList.remove('active');
    document.getElementById('folderName').value = '';
}

/**
 * 새 폴더 추가
 */
function addFolder() {
    const nameInput = document.getElementById('folderName');
    const name = nameInput.value.trim();
    
    // 유효성 검사
    if (!name) {
        alert('폴더명을 입력하세요!');
        nameInput.focus();
        return;
    }
    
    // 중복 확인
    if (data.folders.find(f => f.name === name)) {
        alert('이미 존재하는 폴더명입니다!');
        nameInput.focus();
        return;
    }
    
    // 폴더 추가
    data.folders.push({
        name: name,
        blocks: 0,
        time: 0
    });
    
    console.log(`폴더 추가됨: ${name}`);
    
    // UI 업데이트
    renderFolders();
    updateBlockFolderSelect();
    closeFolderModal();
    saveData();
    
    // 성공 메시지
    showToast(`📁 "${name}" 폴더가 추가되었습니다.`);
}

/**
 * 폴더 삭제
 */
function deleteFolder(name) {
    // 폴더에 속한 블록 개수 확인
    const blocksInFolder = data.blocks.filter(b => b.folder === name).length;
    
    let confirmMessage = `"${name}" 폴더를 삭제하시겠습니까?`;
    if (blocksInFolder > 0) {
        confirmMessage += `\n폴더 내 ${blocksInFolder}개의 블록도 모두 삭제됩니다.`;
    }
    
    if (!confirm(confirmMessage)) {
        return;
    }
    
    // 폴더 삭제
    data.folders = data.folders.filter(f => f.name !== name);
    
    // 해당 폴더의 블록들도 삭제
    data.blocks = data.blocks.filter(b => b.folder !== name);
    
    console.log(`폴더 삭제됨: ${name}`);
    
    // UI 업데이트
    renderFolders();
    renderBlocks();
    updateBlockFolderSelect();
    saveData();
    
    showToast(`📁 "${name}" 폴더가 삭제되었습니다.`);
}

/**
 * 폴더 선택 (폴더 클릭 시 블록 탭으로 이동)
 */
function selectFolder(name) {
    // 블록 탭으로 전환
    const blockTab = document.querySelector('.tab:nth-child(3)');
    blockTab.click();
    
    // 필터 설정
    const filterSelect = document.getElementById('folderFilter');
    if (filterSelect) {
        filterSelect.value = name;
    }
    
    // 해당 폴더의 블록만 렌더링
    renderBlocks(name);
}

// ========================================
// 블록 모달 관리
// ========================================

/**
 * 블록 추가 모달 열기
 */
function openBlockModal() {
    document.getElementById('blockModal').classList.add('active');
    updateBlockFolderSelect();
    document.getElementById('blockName').focus();
}

/**
 * 블록 추가 모달 닫기
 */
function closeBlockModal() {
    document.getElementById('blockModal').classList.remove('active');
    
    // 입력 필드 초기화
    document.getElementById('blockName').value = '';
    document.getElementById('blockStart').value = '';
    document.getElementById('blockEnd').value = '';
}

/**
 * 블록 모달의 폴더 선택 목록 업데이트
 */
function updateBlockFolderSelect() {
    const select = document.getElementById('blockFolder');
    if (!select) return;
    
    select.innerHTML = data.folders.map(folder => 
        `<option value="${folder.name}">${folder.name}</option>`
    ).join('');
}

/**
 * 새 블록 추가
 */
function addBlock() {
    const folder = document.getElementById('blockFolder').value;
    const name = document.getElementById('blockName').value.trim();
    const start = parseInt(document.getElementById('blockStart').value);
    const end = parseInt(document.getElementById('blockEnd').value);
    
    // 유효성 검사
    if (!name) {
        alert('블록명을 입력하세요!');
        return;
    }
    
    if (!start || !end) {
        alert('시작 페이지와 종료 페이지를 입력하세요!');
        return;
    }
    
    if (start > end) {
        alert('시작 페이지는 종료 페이지보다 작아야 합니다!');
        return;
    }
    
    if (start < 1 || end < 1) {
        alert('페이지는 1 이상이어야 합니다!');
        return;
    }
    
    // 새 블록 생성
    const newBlock = {
        id: Date.now(),
        folder: folder,
        name: name,
        start: start,
        end: end,
        segments: Array(6).fill(false),
        time: 0
    };
    
    // 블록 추가
    data.blocks.push(newBlock);
    
    // 폴더의 블록 개수 증가
    const folderData = data.folders.find(f => f.name === folder);
    if (folderData) {
        folderData.blocks++;
    }
    
    console.log(`블록 추가됨: ${folder} - ${name}`);
    
    // UI 업데이트
    renderBlocks();
    renderFolders();
    closeBlockModal();
    saveData();
    
    showToast(`📚 "${name}" 블록이 추가되었습니다.`);
}

// ========================================
// 토스트 메시지
// ========================================

/**
 * 토스트 메시지 표시
 */
function showToast(message, duration = 3000) {
    // 기존 토스트 제거
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
        existingToast.remove();
    }
    
    // 토스트 생성
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 30px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 1rem 2rem;
        border-radius: 8px;
        font-weight: 600;
        z-index: 10000;
        animation: slideUp 0.3s ease-out;
    `;
    
    document.body.appendChild(toast);
    
    // 일정 시간 후 제거
    setTimeout(() => {
        toast.style.animation = 'slideDown 0.3s ease-out';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// 토스트 애니메이션 스타일 추가
if (!document.querySelector('#toast-styles')) {
    const style = document.createElement('style');
    style.id = 'toast-styles';
    style.textContent = `
        @keyframes slideUp {
            from { transform: translate(-50%, 100px); opacity: 0; }
            to { transform: translate(-50%, 0); opacity: 1; }
        }
        @keyframes slideDown {
            from { transform: translate(-50%, 0); opacity: 1; }
            to { transform: translate(-50%, 100px); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
}
// ========================================
// Part 3: 폴더 및 블록 렌더링
// ========================================

/**
 * 폴더 목록 렌더링
 */
function renderFolders() {
    const container = document.getElementById('foldersList');
    if (!container) return;
    
    if (data.folders.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: #666;">
                <div style="font-size: 3rem; margin-bottom: 1rem;">📁</div>
                <div style="font-size: 1.2rem; margin-bottom: 0.5rem;">폴더가 없습니다</div>
                <div style="font-size: 0.9rem;">상단의 "폴더 추가" 버튼을 눌러 새 폴더를 만들어보세요.</div>
            </div>
        `;
        return;
    }
    
    container.innerHTML = data.folders.map(folder => {
        const hours = Math.floor(folder.time / 3600);
        const minutes = Math.floor((folder.time % 3600) / 60);
        const timeStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
        
        return `
            <div class="folder-card" onclick="selectFolder('${folder.name}')">
                <button class="folder-delete" onclick="event.stopPropagation(); deleteFolder('${folder.name}')">✖</button>
                <div class="folder-icon">📁</div>
                <div class="folder-name">${folder.name}</div>
                <div class="folder-stats">${folder.blocks}개 블록 • ${timeStr}</div>
            </div>
        `;
    }).join('');
}

/**
 * 블록 목록 렌더링
 */
function renderBlocks(filterFolder = 'all') {
    const container = document.getElementById('blocksList');
    if (!container) return;
    
    // 필터링
    let blocksToShow = data.blocks;
    if (filterFolder !== 'all') {
        blocksToShow = data.blocks.filter(b => b.folder === filterFolder);
    }
    
    // 블록이 없을 때
    if (blocksToShow.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: #666;">
                <div style="font-size: 3rem; margin-bottom: 1rem;">📚</div>
                <div style="font-size: 1.2rem; margin-bottom: 0.5rem;">블록이 없습니다</div>
                <div style="font-size: 0.9rem;">상단의 "블록 추가" 버튼을 눌러 새 블록을 만들어보세요.</div>
            </div>
        `;
        return;
    }
    
    // 블록 렌더링
    container.innerHTML = blocksToShow.map(block => {
        const completed = block.segments.filter(s => s).length;
        const progress = Math.round((completed / 6) * 100);
        const isStudying = data.currentStudy && data.currentStudy.blockId === block.id;
        
        const hours = Math.floor(block.time / 3600);
        const minutes = Math.floor((block.time % 3600) / 60);
        const timeStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
        
        // 상태 이모지 결정
        let statusEmoji = '⭕';
        let statusClass = '';
        if (completed === 6) {
            statusEmoji = '✅';
        } else if (completed > 0) {
            statusEmoji = '🔄';
        }
        if (isStudying) {
            statusEmoji = '⏱️';
            statusClass = 'studying';
        }
        
        return `
            <div class="block ${statusClass}">
                <div class="block-folder" style="${isStudying ? 'background: #2196f3;' : ''}">${block.folder}</div>
                <div class="block-header">
                    <div class="block-title">${block.name}</div>
                    <span style="font-size: 1.8rem;">${statusEmoji}</span>
                </div>
                <div class="block-info">📄 ${block.start}-${block.end}p (${block.end - block.start + 1}페이지)</div>
                <div class="segments-grid">
                    ${block.segments.map((s, i) => {
                        const isActive = isStudying && data.currentStudy.segment === i;
                        return `<div class="segment ${s ? 'completed' : ''} ${isActive ? 'active' : ''}" 
                                     onclick="toggleSegment(${block.id}, ${i})">${i + 1}</div>`;
                    }).join('')}
                </div>
                <div class="block-time">
                    ⏱️ 총 학습시간: ${timeStr}
                    ${isStudying ? ' • <strong style="color: #2196f3;">현재 학습중</strong>' : ''}
                </div>
                <div style="display: flex; gap: 0.5rem;">
                    <button class="btn ${isStudying ? 'btn-info' : 'btn-success'}" 
                            style="flex: 1;" 
                            onclick="startStudy('${block.folder}', '${block.name}', '${block.start}-${block.end}p', ${completed}, ${block.id})"
                            ${isStudying ? 'disabled' : ''}>
                        ${isStudying ? '⏱️ 학습중' : '🎯 학습시작'}
                    </button>
                    <button class="btn btn-danger" 
                            style="flex: 1;" 
                            onclick="deleteBlock(${block.id})">🗑️</button>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * 구간(세그먼트) 토글
 */
function toggleSegment(blockId, segmentIndex) {
    // 현재 학습 중인 블록의 활성 구간은 토글 불가
    if (data.currentStudy && data.currentStudy.blockId === blockId && data.currentStudy.segment === segmentIndex) {
        alert('현재 학습 중인 구간은 변경할 수 없습니다.');
        return;
    }
    
    const block = data.blocks.find(b => b.id === blockId);
    if (!block) return;
    
    // 구간 상태 토글
    block.segments[segmentIndex] = !block.segments[segmentIndex];
    
    console.log(`구간 토글: ${block.name} - 구간 ${segmentIndex + 1} → ${block.segments[segmentIndex] ? '완료' : '미완료'}`);
    
    // UI 업데이트
    renderBlocks();
    updateDashboard();
    saveData();
}

/**
 * 블록 삭제
 */
function deleteBlock(blockId) {
    const block = data.blocks.find(b => b.id === blockId);
    if (!block) return;
    
    if (!confirm(`"${block.name}" 블록을 삭제하시겠습니까?`)) {
        return;
    }
    
    // 현재 학습 중인 블록이면 타이머 종료
    if (data.currentStudy && data.currentStudy.blockId === blockId) {
        closeTimer();
    }
    
    // 폴더 정보 업데이트
    const folder = data.folders.find(f => f.name === block.folder);
    if (folder) {
        folder.blocks--;
        folder.time -= block.time;
    }
    
    // 블록 삭제
    data.blocks = data.blocks.filter(b => b.id !== blockId);
    
    console.log(`블록 삭제됨: ${block.name}`);
    
    // UI 업데이트
    renderBlocks();
    renderFolders();
    updateDashboard();
    saveData();
    
    showToast(`📚 "${block.name}" 블록이 삭제되었습니다.`);
}

/**
 * 폴더 필터 변경 시
 */
function onFolderFilterChange() {
    const filterSelect = document.getElementById('folderFilter');
    if (!filterSelect) return;
    
    const selectedFolder = filterSelect.value;
    renderBlocks(selectedFolder);
}

// 페이지 로드 시 필터 이벤트 리스너 등록
document.addEventListener('DOMContentLoaded', () => {
    const filterSelect = document.getElementById('folderFilter');
    if (filterSelect) {
        filterSelect.addEventListener('change', onFolderFilterChange);
    }
});
// ========================================
// Part 4: 학습 타이머 관리
// ========================================

/**
 * 학습 시작
 */
function startStudy(folder, blockName, pages, completedSegments, blockId) {
    // 이미 학습 중인 경우
    if (data.currentStudy) {
        alert('이미 다른 블록을 학습 중입니다!');
        return;
    }
    
    // 다음 학습할 구간 찾기
    const segment = completedSegments < 6 ? completedSegments : 0;
    
    // 현재 학습 정보 설정
    data.currentStudy = {
        folder: folder,
        block: blockName,
        pages: pages,
        segment: segment,
        blockId: blockId,
        startTime: Date.now()
    };
    
    console.log(`학습 시작: ${folder} - ${blockName} (구간 ${segment + 1}/6)`);
    
    // 타이머 UI 업데이트
    document.getElementById('timerFolder').textContent = folder;
    document.getElementById('timerBlock').textContent = blockName;
    document.getElementById('timerPages').textContent = pages;
    document.getElementById('timerSegment').textContent = `${segment + 1}/6`;
    
    // 타이머 표시
    document.getElementById('studyTimer').classList.add('active');
    
    // 타이머 시작
    timerStartTime = Date.now();
    timerElapsed = 0;
    isPaused = false;
    startTimer();
    
    // 블록 목록 업데이트
    renderBlocks();
    
    // 일시정지 버튼 초기화
    const pauseBtn = document.getElementById('pauseBtn');
    pauseBtn.textContent = '⏸️ 일시정지';
    pauseBtn.classList.remove('btn-info');
    pauseBtn.classList.add('btn-warning');
}

/**
 * 타이머 시작
 */
function startTimer() {
    // 기존 타이머가 있으면 정리
    if (timerInterval) {
        clearInterval(timerInterval);
    }
    
    timerInterval = setInterval(() => {
        // 일시정지 상태면 업데이트하지 않음
        if (isPaused) return;
        
        // 경과 시간 계산
        const elapsed = Date.now() - timerStartTime + timerElapsed;
        const hours = Math.floor(elapsed / 3600000);
        const minutes = Math.floor((elapsed % 3600000) / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        
        // 타이머 디스플레이 업데이트
        document.getElementById('timerDisplay').textContent = 
            `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }, 1000);
}

/**
 * 일시정지/재개 토글
 */
function togglePause() {
    const btn = document.getElementById('pauseBtn');
    
    if (isPaused) {
        // 재개
        isPaused = false;
        timerStartTime = Date.now();
        btn.textContent = '⏸️ 일시정지';
        btn.classList.remove('btn-info');
        btn.classList.add('btn-warning');
        console.log('학습 재개');
    } else {
        // 일시정지
        isPaused = true;
        timerElapsed += Date.now() - timerStartTime;
        btn.textContent = '▶️ 재개';
        btn.classList.remove('btn-warning');
        btn.classList.add('btn-info');
        console.log('학습 일시정지');
    }
}

/**
 * 구간 완료
 */
function completeSegment() {
    if (!data.currentStudy) {
        alert('학습 중인 블록이 없습니다.');
        return;
    }
    
    // 총 학습 시간 계산 (초 단위)
    const totalTime = Math.floor((Date.now() - timerStartTime + timerElapsed) / 1000);
    
    // 블록 찾기
    const block = data.blocks.find(b => b.id === data.currentStudy.blockId);
    
    if (block) {
        // 구간 완료 표시
        block.segments[data.currentStudy.segment] = true;
        
        // 블록 학습 시간 추가
        block.time += totalTime;
        
        // 폴더 학습 시간 추가
        const folder = data.folders.find(f => f.name === block.folder);
        if (folder) {
            folder.time += totalTime;
        }
        
        console.log(`구간 완료: ${block.name} - 구간 ${data.currentStudy.segment + 1} (${formatTime(totalTime)})`);
    }
    
    // 학습 기록 추가
    data.studyHistory.unshift({
        folder: data.currentStudy.folder,
        block: data.currentStudy.block,
        blockId: data.currentStudy.blockId,
        pages: data.currentStudy.pages,
        segment: data.currentStudy.segment + 1,
        time: totalTime,
        timestamp: Date.now(),
        date: new Date().toISOString().slice(0, 10)
    });
    
    // 학습 기록은 최대 50개까지만 유지
    if (data.studyHistory.length > 50) {
        data.studyHistory = data.studyHistory.slice(0, 50);
    }
    
    // 완료 메시지
    const hours = Math.floor(totalTime / 3600);
    const minutes = Math.floor((totalTime % 3600) / 60);
    let timeMessage = '';
    if (hours > 0) {
        timeMessage = `${hours}시간 ${minutes}분`;
    } else {
        timeMessage = `${minutes}분`;
    }
    
    alert(`🎉 구간 ${data.currentStudy.segment + 1} 완료!\n\n학습시간: ${timeMessage}\n수고하셨습니다!`);
    
    // 타이머 종료
    closeTimer();
    
    // 저장 및 UI 업데이트
    saveData();
}

/**
 * 타이머 종료
 */
function closeTimer() {
    // 타이머 정리
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    
    // 타이머 UI 숨기기
    document.getElementById('studyTimer').classList.remove('active');
    
    // 타이머 디스플레이 초기화
    document.getElementById('timerDisplay').textContent = '00:00:00';
    
    // 현재 학습 정보 초기화
    if (data.currentStudy) {
        console.log(`학습 종료: ${data.currentStudy.block}`);
    }
    data.currentStudy = null;
    
    // 타이머 변수 초기화
    timerElapsed = 0;
    isPaused = false;
    timerStartTime = null;
    
    // 일시정지 버튼 초기화
    const pauseBtn = document.getElementById('pauseBtn');
    pauseBtn.textContent = '⏸️ 일시정지';
    pauseBtn.classList.remove('btn-info');
    pauseBtn.classList.add('btn-warning');
    
    // 블록 목록 업데이트
    renderBlocks();
}

/**
 * 학습 포기 (타이머만 종료, 기록 저장 안 함)
 */
function cancelStudy() {
    if (!data.currentStudy) return;
    
    if (confirm('학습을 포기하시겠습니까?\n현재까지의 시간은 기록되지 않습니다.')) {
        closeTimer();
        showToast('❌ 학습이 취소되었습니다.');
    }
}

/**
 * 타이머 정보 업데이트 (실시간)
 */
function updateTimerInfo() {
    if (!data.currentStudy) return;
    
    const elapsed = isPaused ? timerElapsed : (Date.now() - timerStartTime + timerElapsed);
    const minutes = Math.floor(elapsed / 60000);
    
    // 10분마다 알림
    if (minutes > 0 && minutes % 10 === 0) {
        console.log(`학습 ${minutes}분 경과`);
    }
}
// ========================================
// Part 4: 학습 타이머 관리
// ========================================

/**
 * 학습 시작
 */
function startStudy(folder, blockName, pages, completedSegments, blockId) {
    // 이미 학습 중인 경우
    if (data.currentStudy) {
        alert('이미 다른 블록을 학습 중입니다!');
        return;
    }
    
    // 다음 학습할 구간 찾기
    const segment = completedSegments < 6 ? completedSegments : 0;
    
    // 현재 학습 정보 설정
    data.currentStudy = {
        folder: folder,
        block: blockName,
        pages: pages,
        segment: segment,
        blockId: blockId,
        startTime: Date.now()
    };
    
    console.log(`학습 시작: ${folder} - ${blockName} (구간 ${segment + 1}/6)`);
    
    // 타이머 UI 업데이트
    document.getElementById('timerFolder').textContent = folder;
    document.getElementById('timerBlock').textContent = blockName;
    document.getElementById('timerPages').textContent = pages;
    document.getElementById('timerSegment').textContent = `${segment + 1}/6`;
    
    // 타이머 표시
    document.getElementById('studyTimer').classList.add('active');
    
    // 타이머 시작
    timerStartTime = Date.now();
    timerElapsed = 0;
    isPaused = false;
    startTimer();
    
    // 블록 목록 업데이트
    renderBlocks();
    
    // 일시정지 버튼 초기화
    const pauseBtn = document.getElementById('pauseBtn');
    pauseBtn.textContent = '⏸️ 일시정지';
    pauseBtn.classList.remove('btn-info');
    pauseBtn.classList.add('btn-warning');
}

/**
 * 타이머 시작
 */
function startTimer() {
    // 기존 타이머가 있으면 정리
    if (timerInterval) {
        clearInterval(timerInterval);
    }
    
    timerInterval = setInterval(() => {
        // 일시정지 상태면 업데이트하지 않음
        if (isPaused) return;
        
        // 경과 시간 계산
        const elapsed = Date.now() - timerStartTime + timerElapsed;
        const hours = Math.floor(elapsed / 3600000);
        const minutes = Math.floor((elapsed % 3600000) / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        
        // 타이머 디스플레이 업데이트
        document.getElementById('timerDisplay').textContent = 
            `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }, 1000);
}

/**
 * 일시정지/재개 토글
 */
function togglePause() {
    const btn = document.getElementById('pauseBtn');
    
    if (isPaused) {
        // 재개
        isPaused = false;
        timerStartTime = Date.now();
        btn.textContent = '⏸️ 일시정지';
        btn.classList.remove('btn-info');
        btn.classList.add('btn-warning');
        console.log('학습 재개');
    } else {
        // 일시정지
        isPaused = true;
        timerElapsed += Date.now() - timerStartTime;
        btn.textContent = '▶️ 재개';
        btn.classList.remove('btn-warning');
        btn.classList.add('btn-info');
        console.log('학습 일시정지');
    }
}

/**
 * 구간 완료
 */
function completeSegment() {
    if (!data.currentStudy) {
        alert('학습 중인 블록이 없습니다.');
        return;
    }
    
    // 총 학습 시간 계산 (초 단위)
    const totalTime = Math.floor((Date.now() - timerStartTime + timerElapsed) / 1000);
    
    // 블록 찾기
    const block = data.blocks.find(b => b.id === data.currentStudy.blockId);
    
    if (block) {
        // 구간 완료 표시
        block.segments[data.currentStudy.segment] = true;
        
        // 블록 학습 시간 추가
        block.time += totalTime;
        
        // 폴더 학습 시간 추가
        const folder = data.folders.find(f => f.name === block.folder);
        if (folder) {
            folder.time += totalTime;
        }
        
        console.log(`구간 완료: ${block.name} - 구간 ${data.currentStudy.segment + 1} (${formatTime(totalTime)})`);
    }
    
    // 학습 기록 추가
    data.studyHistory.unshift({
        folder: data.currentStudy.folder,
        block: data.currentStudy.block,
        blockId: data.currentStudy.blockId,
        pages: data.currentStudy.pages,
        segment: data.currentStudy.segment + 1,
        time: totalTime,
        timestamp: Date.now(),
        date: new Date().toISOString().slice(0, 10)
    });
    
    // 학습 기록은 최대 50개까지만 유지
    if (data.studyHistory.length > 50) {
        data.studyHistory = data.studyHistory.slice(0, 50);
    }
    
    // 완료 메시지
    const hours = Math.floor(totalTime / 3600);
    const minutes = Math.floor((totalTime % 3600) / 60);
    let timeMessage = '';
    if (hours > 0) {
        timeMessage = `${hours}시간 ${minutes}분`;
    } else {
        timeMessage = `${minutes}분`;
    }
    
    alert(`🎉 구간 ${data.currentStudy.segment + 1} 완료!\n\n학습시간: ${timeMessage}\n수고하셨습니다!`);
    
    // 타이머 종료
    closeTimer();
    
    // 저장 및 UI 업데이트
    saveData();
}

/**
 * 타이머 종료
 */
function closeTimer() {
    // 타이머 정리
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    
    // 타이머 UI 숨기기
    document.getElementById('studyTimer').classList.remove('active');
    
    // 타이머 디스플레이 초기화
    document.getElementById('timerDisplay').textContent = '00:00:00';
    
    // 현재 학습 정보 초기화
    if (data.currentStudy) {
        console.log(`학습 종료: ${data.currentStudy.block}`);
    }
    data.currentStudy = null;
    
    // 타이머 변수 초기화
    timerElapsed = 0;
    isPaused = false;
    timerStartTime = null;
    
    // 일시정지 버튼 초기화
    const pauseBtn = document.getElementById('pauseBtn');
    pauseBtn.textContent = '⏸️ 일시정지';
    pauseBtn.classList.remove('btn-info');
    pauseBtn.classList.add('btn-warning');
    
    // 블록 목록 업데이트
    renderBlocks();
}

/**
 * 학습 포기 (타이머만 종료, 기록 저장 안 함)
 */
function cancelStudy() {
    if (!data.currentStudy) return;
    
    if (confirm('학습을 포기하시겠습니까?\n현재까지의 시간은 기록되지 않습니다.')) {
        closeTimer();
        showToast('❌ 학습이 취소되었습니다.');
    }
}

/**
 * 타이머 정보 업데이트 (실시간)
 */
function updateTimerInfo() {
    if (!data.currentStudy) return;
    
    const elapsed = isPaused ? timerElapsed : (Date.now() - timerStartTime + timerElapsed);
    const minutes = Math.floor(elapsed / 60000);
    
    // 10분마다 알림
    if (minutes > 0 && minutes % 10 === 0) {
        console.log(`학습 ${minutes}분 경과`);
    }
}
