#!/usr/bin/env python3
# -*- coding: utf-8 -*-

with open('main.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Find and replace the updateQuestionListTemplate function
start_marker = '    async updateQuestionListTemplate(folder) {'
end_marker = '    async updateBookmarkListTemplate() {'

start_idx = content.find(start_marker)
end_idx = content.find(end_marker, start_idx)

if start_idx == -1 or end_idx == -1:
    print("Markers not found!")
    exit(1)

new_function = '''    async updateQuestionListTemplate(folder) {
        const folderPath = this.settings.questionsFolder + '/' + folder;
        const templatePath = folderPath + '/문제목록.md';
        const updateTime = new Date().toLocaleString('ko-KR');
        
        const template = '---\\n' +
'cssclass: question-list\\n' +
'---\\n\\n' +
'# 📋 ' + folder + ' 문제목록\\n\\n' +
'> 🔄 자동 생성 문서 | 마지막 업데이트: ' + updateTime + '\\n\\n' +
'## 📊 폴더 통계\\n\\n' +
'```dataviewjs\\n' +
'const folder = "' + folderPath + '";\\n' +
'const questions = dv.pages("\\\\"" + folder + "\\\\"").where(p => p.file.name.includes("_") && !p.file.name.includes("문제목록"));\\n' +
'const total = questions.length;\\n' +
'const bookmarked = questions.where(p => p.bookmarked === true).length;\\n' +
'const withWrong = questions.where(p => p.wrongCount > 0).length;\\n' +
'const easy = questions.where(p => p.difficulty === "쉬움").length;\\n' +
'const normal = questions.where(p => p.difficulty === "보통").length;\\n' +
'const hard = questions.where(p => p.difficulty === "어려움").length;\\n' +
'let html = "<div class=\\"stats-grid\\">";\\n' +
'html += `<div class="stat-card"><div class="stat-label">📚 총 문제</div><div class="stat-value">${total}개</div></div>`;\\n' +
'html += `<div class="stat-card"><div class="stat-label">⭐ 북마크</div><div class="stat-value">${bookmarked}개</div></div>`;\\n' +
'html += `<div class="stat-card"><div class="stat-label">❌ 오답 있음</div><div class="stat-value">${withWrong}개</div></div>`;\\n' +
'html += `<div class="stat-card easy"><div class="stat-label">😊 쉬움</div><div class="stat-value">${easy}개</div></div>`;\\n' +
'html += `<div class="stat-card normal"><div class="stat-label">😐 보통</div><div class="stat-value">${normal}개</div></div>`;\\n' +
'html += `<div class="stat-card hard"><div class="stat-label">😰 어려움</div><div class="stat-value">${hard}개</div></div>`;\\n' +
'html += "</div>";\\n' +
'dv.paragraph(html);\\n' +
'```\\n\\n' +
'## 📚 전체 문제 목록\\n\\n' +
'```dataviewjs\\n' +
'const folder = "' + folderPath + '";\\n' +
'const questions = dv.pages("\\\\"" + folder + "\\\\"").where(p => p.file.name.includes("_") && !p.file.name.includes("문제목록")).sort(p => p.file.name, "asc");\\n' +
'if (questions.length > 0) {\\n' +
'    let html = "<div class=\\"question-table\\">";\\n' +
'    html += "<div class=\\"table-header\\"><div>번호</div><div>한자</div><div>문제</div><div>난이도</div><div>통계</div><div>상태</div></div>";\\n' +
'    for (const q of questions) {\\n' +
'        const diffClass = q.difficulty === "쉬움" ? "easy" : q.difficulty === "어려움" ? "hard" : "normal";\\n' +
'        const diffIcon = q.difficulty === "쉬움" ? "😊" : q.difficulty === "어려움" ? "😰" : "😐";\\n' +
'        const bookmark = q.bookmarked ? "⭐" : "";\\n' +
'        const wrongBadge = q.wrongCount > 0 ? `<span class="badge wrong">${q.wrongCount}회 오답</span>` : "";\\n' +
'        const correctBadge = q.correctCount > 0 ? `<span class="badge correct">${q.correctCount}회 정답</span>` : "";\\n' +
'        html += `<a href="${q.file.path}" class="table-row"><div class="cell-number">${q.number || "-"}</div><div class="cell-hanzi">${q.hanzi || "-"}</div><div class="cell-question">${bookmark} ${q.question || ""}</div><div class="cell-difficulty ${diffClass}">${diffIcon} ${q.difficulty || "보통"}</div><div class="cell-stats">${correctBadge} ${wrongBadge}</div><div class="cell-actions">👁️</div></a>`;\\n' +
'    }\\n' +
'    html += "</div>";\\n' +
'    dv.paragraph(html);\\n' +
'} else {\\n' +
'    dv.paragraph("<p class=\\"empty\\">📝 아직 문제가 없습니다</p>");\\n' +
'}\\n' +
'```\\n\\n' +
'## ⭐ 북마크 문제만 보기\\n\\n' +
'```dataviewjs\\n' +
'const folder = "' + folderPath + '";\\n' +
'const bookmarked = dv.pages("\\\\"" + folder + "\\\\"").where(p => p.file.name.includes("_") && !p.file.name.includes("문제목록") && p.bookmarked === true).sort(p => p.file.name, "asc");\\n' +
'if (bookmarked.length > 0) {\\n' +
'    let html = "<div class=\\"compact-list\\">";\\n' +
'    for (const q of bookmarked) {\\n' +
'        const diffIcon = q.difficulty === "쉬움" ? "😊" : q.difficulty === "어려움" ? "😰" : "😐";\\n' +
'        html += `<a href="${q.file.path}" class="compact-item"><span class="item-hanzi">${q.hanzi}</span><span class="item-text">${q.question}</span><span class="item-badge">${diffIcon}</span></a>`;\\n' +
'    }\\n' +
'    html += "</div>";\\n' +
'    dv.paragraph(html);\\n' +
'} else {\\n' +
'    dv.paragraph("<p class=\\"empty\\">⭐ 북마크한 문제가 없습니다</p>");\\n' +
'}\\n' +
'```\\n\\n' +
'## ❌ 오답 많은 문제 TOP 10\\n\\n' +
'```dataviewjs\\n' +
'const folder = "' + folderPath + '";\\n' +
'const wrong = dv.pages("\\\\"" + folder + "\\\\"").where(p => p.file.name.includes("_") && !p.file.name.includes("문제목록") && p.wrongCount > 0).sort(p => p.wrongCount, "desc").limit(10);\\n' +
'if (wrong.length > 0) {\\n' +
'    let html = "<div class=\\"wrong-list\\">";\\n' +
'    for (const q of wrong) {\\n' +
'        html += `<a href="${q.file.path}" class="wrong-item"><span class="wrong-rank">❌ ${q.wrongCount}회</span><span class="wrong-hanzi">${q.hanzi}</span><span class="wrong-question">${q.question}</span></a>`;\\n' +
'    }\\n' +
'    html += "</div>";\\n' +
'    dv.paragraph(html);\\n' +
'} else {\\n' +
'    dv.paragraph("<p class=\\"empty\\">✅ 오답이 없습니다!</p>");\\n' +
'}\\n' +
'```\\n\\n' +
'<style>\\n' +
'.question-list { padding: 20px; max-width: 1400px; margin: 0 auto; }\\n' +
'.stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin: 25px 0; }\\n' +
'.stat-card { padding: 20px; background: var(--background-secondary); border-radius: 10px; text-align: center; border: 2px solid var(--background-modifier-border); transition: all 0.2s; }\\n' +
'.stat-card:hover { border-color: var(--interactive-accent); transform: translateY(-3px); }\\n' +
'.stat-card.easy { border-color: rgba(76, 175, 80, 0.5); }\\n' +
'.stat-card.normal { border-color: rgba(255, 152, 0, 0.5); }\\n' +
'.stat-card.hard { border-color: rgba(244, 67, 54, 0.5); }\\n' +
'.stat-label { font-size: 13px; color: var(--text-muted); margin-bottom: 8px; }\\n' +
'.stat-value { font-size: 28px; font-weight: bold; color: var(--text-normal); }\\n' +
'.question-table { margin: 20px 0; }\\n' +
'.table-header { display: grid; grid-template-columns: 60px 80px 1fr 100px 180px 60px; gap: 15px; padding: 15px; background: var(--background-secondary); border-radius: 8px; font-weight: bold; margin-bottom: 10px; font-size: 14px; }\\n' +
'.table-row { display: grid; grid-template-columns: 60px 80px 1fr 100px 180px 60px; gap: 15px; padding: 15px; background: var(--background-secondary); border: 2px solid var(--background-modifier-border); border-radius: 8px; margin-bottom: 8px; text-decoration: none; transition: all 0.2s; align-items: center; }\\n' +
'.table-row:hover { border-color: var(--interactive-accent); background: var(--background-modifier-hover); transform: translateX(5px); box-shadow: 0 2px 8px rgba(0,0,0,0.1); }\\n' +
'.cell-number { font-weight: bold; color: var(--text-muted); }\\n' +
'.cell-hanzi { font-size: 32px; font-weight: bold; color: var(--text-accent); }\\n' +
'.cell-question { color: var(--text-normal); line-height: 1.4; }\\n' +
'.cell-difficulty { font-size: 14px; padding: 5px 10px; border-radius: 15px; text-align: center; }\\n' +
'.cell-difficulty.easy { background: rgba(76, 175, 80, 0.15); color: #4caf50; }\\n' +
'.cell-difficulty.normal { background: rgba(255, 152, 0, 0.15); color: #ff9800; }\\n' +
'.cell-difficulty.hard { background: rgba(244, 67, 54, 0.15); color: #f44336; }\\n' +
'.cell-stats { display: flex; gap: 5px; flex-wrap: wrap; }\\n' +
'.badge { padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; white-space: nowrap; }\\n' +
'.badge.correct { background: rgba(76, 175, 80, 0.15); color: #4caf50; }\\n' +
'.badge.wrong { background: rgba(244, 67, 54, 0.15); color: #f44336; }\\n' +
'.compact-list, .wrong-list { display: flex; flex-direction: column; gap: 10px; margin: 20px 0; }\\n' +
'.compact-item, .wrong-item { display: flex; align-items: center; gap: 15px; padding: 12px 15px; background: var(--background-secondary); border: 2px solid var(--background-modifier-border); border-radius: 8px; text-decoration: none; transition: all 0.2s; }\\n' +
'.compact-item:hover, .wrong-item:hover { border-color: var(--interactive-accent); background: var(--background-modifier-hover); transform: translateX(5px); }\\n' +
'.item-hanzi, .wrong-hanzi { font-size: 28px; font-weight: bold; min-width: 60px; text-align: center; color: var(--text-accent); }\\n' +
'.item-text, .wrong-question { flex: 1; color: var(--text-normal); }\\n' +
'.item-badge { padding: 5px 12px; border-radius: 12px; background: var(--background-primary); font-size: 16px; }\\n' +
'.wrong-rank { padding: 5px 12px; background: rgba(244, 67, 54, 0.15); color: #f44336; border-radius: 12px; font-weight: bold; font-size: 12px; min-width: 80px; text-align: center; }\\n' +
'.empty { text-align: center; padding: 40px 20px; color: var(--text-muted); background: var(--background-secondary); border-radius: 10px; font-size: 16px; margin: 20px 0; }\\n' +
'@media (max-width: 768px) { .stats-grid { grid-template-columns: repeat(2, 1fr); } .table-header, .table-row { grid-template-columns: 50px 60px 1fr; gap: 10px; } .cell-difficulty, .cell-stats, .cell-actions { display: none; } .cell-hanzi { font-size: 24px; } }\\n' +
'</style>\\n\\n' +
'---\\n' +
'*이 문제목록은 DataviewJS로 자동 생성됩니다*\\n';

        try {
            const file = this.app.vault.getAbstractFileByPath(templatePath);
            if (file) {
                await this.app.vault.modify(file, template);
            } else {
                await this.app.vault.create(templatePath, template);
            }
        } catch (error) {
            console.error('문제목록 템플릿 업데이트 오류:', error);
        }
    }

    '''

new_content = content[:start_idx] + new_function + content[end_idx:]

with open('main.js', 'w', encoding='utf-8') as f:
    f.write(new_content)

print("✅ 문제목록 템플릿 수정 완료!")
