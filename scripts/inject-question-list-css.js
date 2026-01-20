/**
 * CSS 스타일 적용 확인 및 강제 주입
 */

console.log("🎨 CSS 스타일 확인 중...\n");

// 1. 현재 문서의 스타일 태그 확인
const styleTags = document.querySelectorAll('style');
console.log(`발견된 <style> 태그: ${styleTags.length}개`);

let questionListStyle = null;
styleTags.forEach((style, i) => {
    const content = style.textContent;
    if (content.includes('question-list') || content.includes('stats-grid')) {
        console.log(`✅ 문제목록 스타일 발견 (태그 ${i + 1})`);
        questionListStyle = style;
    }
});

// 2. stats-grid 요소 확인
const statsGrid = document.querySelector('.stats-grid');
if (statsGrid) {
    const computed = window.getComputedStyle(statsGrid);
    console.log("\n📊 .stats-grid 스타일:");
    console.log("  display:", computed.display);
    console.log("  grid-template-columns:", computed.gridTemplateColumns);
    console.log("  gap:", computed.gap);
} else {
    console.warn("⚠️ .stats-grid 요소를 찾을 수 없습니다!");
}

// 3. question-table 요소 확인
const questionTable = document.querySelector('.question-table');
if (questionTable) {
    console.log("\n📋 .question-table 발견");
    const rows = questionTable.querySelectorAll('.table-row');
    console.log(`  테이블 행: ${rows.length}개`);
} else {
    console.warn("⚠️ .question-table 요소를 찾을 수 없습니다!");
}

// 4. CSS가 없으면 강제로 주입
if (!questionListStyle) {
    console.log("\n⚠️ CSS가 적용되지 않았습니다. 강제 주입 중...");
    
    const css = `
.question-list { padding: 20px; max-width: 1400px; margin: 0 auto; }
.stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin: 25px 0; }
.stat-card { padding: 20px; background: var(--background-secondary); border-radius: 10px; text-align: center; border: 2px solid var(--background-modifier-border); transition: all 0.2s; }
.stat-card:hover { border-color: var(--interactive-accent); transform: translateY(-3px); }
.stat-label { font-size: 13px; color: var(--text-muted); margin-bottom: 8px; }
.stat-value { font-size: 28px; font-weight: bold; color: var(--text-normal); }
.question-table { margin: 20px 0; }
.table-header { display: grid; grid-template-columns: 60px 80px 1fr 100px 180px 60px; gap: 15px; padding: 15px; background: var(--background-secondary); border-radius: 8px; font-weight: bold; margin-bottom: 10px; }
.table-row { display: grid; grid-template-columns: 60px 80px 1fr 100px 180px 60px; gap: 15px; padding: 15px; background: var(--background-secondary); border: 2px solid var(--background-modifier-border); border-radius: 8px; margin-bottom: 8px; text-decoration: none; transition: all 0.2s; }
.table-row:hover { border-color: var(--interactive-accent); background: var(--background-modifier-hover); transform: translateX(5px); }
.cell-hanzi { font-size: 32px; font-weight: bold; color: var(--text-accent); }
.cell-difficulty { font-size: 14px; padding: 5px 10px; border-radius: 15px; text-align: center; }
.cell-difficulty.easy { background: rgba(76, 175, 80, 0.15); color: #4caf50; }
.cell-difficulty.normal { background: rgba(255, 152, 0, 0.15); color: #ff9800; }
.cell-difficulty.hard { background: rgba(244, 67, 54, 0.15); color: #f44336; }
.badge { padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; }
.badge.correct { background: rgba(76, 175, 80, 0.15); color: #4caf50; }
.badge.wrong { background: rgba(244, 67, 54, 0.15); color: #f44336; }
.empty { text-align: center; padding: 40px 20px; color: var(--text-muted); background: var(--background-secondary); border-radius: 10px; font-size: 16px; margin: 20px 0; }
`;
    
    const styleEl = document.createElement('style');
    styleEl.textContent = css;
    document.head.appendChild(styleEl);
    
    console.log("✅ CSS 강제 주입 완료!");
    new Notice("✅ 스타일이 적용되었습니다!");
} else {
    console.log("\n✅ CSS가 이미 적용되어 있습니다.");
    new Notice("✅ 스타일 정상 적용됨");
}

console.log("\n💡 화면을 확인해보세요!");
