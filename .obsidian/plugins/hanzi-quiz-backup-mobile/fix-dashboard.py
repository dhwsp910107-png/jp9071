# Dashboard 템플릿 수정 스크립트
with open('main.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 기존 createIntegratedDashboard 함수 찾기
start_marker = "async createIntegratedDashboard() {"
end_marker = "async loadAllQuestions() {"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker, start_idx)

if start_idx == -1 or end_idx == -1:
    print("함수를 찾을 수 없습니다!")
    exit(1)

# 새로운 함수 내용
new_function = '''    async createIntegratedDashboard() {
        const dashboardPath = this.settings.quizFolder + '/🎯 통합한자대시보드.md';
        
        const questionsFolder = this.settings.questionsFolder;
        const foldersJson = JSON.stringify(this.settings.questionFolders);
        const updateTime = new Date().toLocaleString('ko-KR');
        
        const template = '---\\n' +
'cssclass: hanzi-dashboard\\n' +
'---\\n\\n' +
'# 🎯 한자 퀴즈 대시보드\\n\\n' +
'## 📂 폴더별 문제\\n\\n' +
'```dataviewjs\\n' +
'const questionsPath = "' + questionsFolder + '";\\n' +
'const folders = ' + foldersJson + ';\\n\\n' +
'let html = \\'<div class="folder-grid"\\'>\\';\\n\\n' +
'for (const folder of folders) {\\n' +
'    const folderPath = questionsPath + "/" + folder;\\n' +
'    const folderQuestions = dv.pages(\\'"\\' + folderPath + \\'"\\')' + '\\n' +
'        .where(p => p.file.name.includes("_") && !p.file.name.includes("문제목록"));\\n' +
'    \\n' +
'    const count = folderQuestions.length;\\n' +
'    const listPath = folderPath + "/문제목록.md";\\n' +
'    \\n' +
'    html += `\\n' +
'    <div class="folder-card">\\n' +
'        <div class="folder-icon">📁</div>\\n' +
'        <div class="folder-name">${folder}</div>\\n' +
'        <div class="folder-count">${count}개 문제</div>\\n' +
'        <a href="${listPath}" class="folder-link">📋 문제 목록 보기</a>\\n' +
'    </div>\\n' +
'    `;\\n' +
'}\\n\\n' +
'html += \\'</div>\\';\\n' +
'dv.paragraph(html);\\n' +
'```\\n\\n' +
'## ⭐ 북마크한 문제\\n\\n' +
'```dataviewjs\\n' +
'const questionsPath = "' + questionsFolder + '";\\n' +
'const bookmarked = dv.pages(\\'"\\' + questionsPath + \\'"\\')' + '\\n' +
'    .where(p => p.file.name.includes("_") && !p.file.name.includes("문제목록") && p.bookmarked === true)\\n' +
'    .sort(p => p.file.mtime, \\'desc\\')\\n' +
'    .limit(10);\\n\\n' +
'if (bookmarked.length > 0) {\\n' +
'    let html = \\'<div class="question-list">\\';\\n' +
'    for (const q of bookmarked) {\\n' +
'        const diffIcon = q.difficulty === "쉬움" ? "😊" : q.difficulty === "어려움" ? "😰" : "😐";\\n' +
'        html += `\\n' +
'        <a href="${q.file.path}" class="question-item">\\n' +
'            <div class="q-hanzi">${q.hanzi || "-"}</div>\\n' +
'            <div class="q-info">\\n' +
'                <div class="q-text">${q.question || ""}</div>\\n' +
'                <div class="q-meta">\\n' +
'                    <span class="badge">${diffIcon} ${q.difficulty || "보통"}</span>\\n' +
'                    <span class="badge">📁 ${q.folder || "기본"}</span>\\n' +
'                </div>\\n' +
'            </div>\\n' +
'        </a>\\n' +
'        `;\\n' +
'    }\\n' +
'    html += \\'</div>\\';\\n' +
'    dv.paragraph(html);\\n' +
'} else {\\n' +
'    dv.paragraph(\\'<p class="empty">⭐ 북마크한 문제가 없습니다</p>\\');\\n' +
'}\\n' +
'```\\n\\n' +
'## 🕒 최근 수정한 문제\\n\\n' +
'```dataviewjs\\n' +
'const questionsPath = "' + questionsFolder + '";\\n' +
'const recent = dv.pages(\\'"\\' + questionsPath + \\'"\\')' + '\\n' +
'    .where(p => p.file.name.includes("_") && !p.file.name.includes("문제목록"))\\n' +
'    .sort(p => p.file.mtime, \\'desc\\')\\n' +
'    .limit(15);\\n\\n' +
'if (recent.length > 0) {\\n' +
'    let html = \\'<div class="question-list">\\';\\n' +
'    for (const q of recent) {\\n' +
'        const diffIcon = q.difficulty === "쉬움" ? "😊" : q.difficulty === "어려움" ? "😰" : "😐";\\n' +
'        const wrongBadge = (q.wrongCount > 0) ? `<span class="badge badge-wrong">❌ ${q.wrongCount}</span>` : "";\\n' +
'        const bookmarkIcon = q.bookmarked ? "⭐" : "";\\n' +
'        html += `\\n' +
'        <a href="${q.file.path}" class="question-item">\\n' +
'            <div class="q-hanzi">${q.hanzi || "-"}</div>\\n' +
'            <div class="q-info">\\n' +
'                <div class="q-text">${bookmarkIcon} ${q.question || ""}</div>\\n' +
'                <div class="q-meta">\\n' +
'                    <span class="badge">${diffIcon} ${q.difficulty || "보통"}</span>\\n' +
'                    <span class="badge">📁 ${q.folder || "기본"}</span>\\n' +
'                    ${wrongBadge}\\n' +
'                </div>\\n' +
'            </div>\\n' +
'        </a>\\n' +
'        `;\\n' +
'    }\\n' +
'    html += \\'</div>\\';\\n' +
'    dv.paragraph(html);\\n' +
'} else {\\n' +
'    dv.paragraph(\\'<p class="empty">📝 문제가 없습니다</p>\\');\\n' +
'}\\n' +
'```\\n\\n' +
'---\\n\\n' +
'<style>\\n' +
'.hanzi-dashboard { padding: 20px; max-width: 1200px; margin: 0 auto; }\\n' +
'.folder-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 20px; margin: 20px 0 40px 0; }\\n' +
'@media (max-width: 768px) { .folder-grid { grid-template-columns: repeat(2, 1fr); gap: 15px; } }\\n' +
'@media (max-width: 480px) { .folder-grid { grid-template-columns: 1fr; } }\\n' +
'.folder-card { background: var(--background-secondary); border: 2px solid var(--background-modifier-border); border-radius: 12px; padding: 25px 20px; text-align: center; transition: all 0.3s ease; }\\n' +
'.folder-card:hover { border-color: var(--interactive-accent); transform: translateY(-5px); box-shadow: 0 8px 16px rgba(0,0,0,0.15); }\\n' +
'.folder-icon { font-size: 48px; margin-bottom: 12px; }\\n' +
'.folder-name { font-size: 18px; font-weight: bold; margin-bottom: 8px; color: var(--text-normal); }\\n' +
'.folder-count { font-size: 14px; color: var(--text-muted); margin-bottom: 15px; }\\n' +
'.folder-link { display: inline-block; padding: 8px 16px; background: var(--interactive-accent); color: white; text-decoration: none; border-radius: 20px; font-size: 13px; font-weight: 600; transition: all 0.2s; }\\n' +
'.folder-link:hover { background: var(--interactive-accent-hover); transform: scale(1.05); }\\n' +
'.question-list { display: flex; flex-direction: column; gap: 12px; margin: 20px 0; }\\n' +
'.question-item { display: flex; align-items: center; gap: 20px; padding: 18px; background: var(--background-secondary); border: 2px solid var(--background-modifier-border); border-radius: 10px; text-decoration: none; transition: all 0.2s; }\\n' +
'.question-item:hover { border-color: var(--interactive-accent); background: var(--background-modifier-hover); transform: translateX(5px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }\\n' +
'@media (max-width: 480px) { .question-item { flex-direction: column; align-items: flex-start; gap: 12px; padding: 15px; } }\\n' +
'.q-hanzi { font-size: 42px; font-weight: bold; min-width: 70px; text-align: center; color: var(--text-accent); }\\n' +
'@media (max-width: 480px) { .q-hanzi { font-size: 32px; min-width: auto; } }\\n' +
'.q-info { flex: 1; }\\n' +
'.q-text { font-size: 16px; font-weight: 500; margin-bottom: 10px; color: var(--text-normal); line-height: 1.5; }\\n' +
'@media (max-width: 480px) { .q-text { font-size: 14px; } }\\n' +
'.q-meta { display: flex; gap: 8px; flex-wrap: wrap; }\\n' +
'.badge { display: inline-block; padding: 5px 12px; background: var(--background-primary); border-radius: 12px; font-size: 12px; font-weight: 600; color: var(--text-muted); }\\n' +
'.badge-wrong { background: rgba(244, 67, 54, 0.15); color: #f44336; }\\n' +
'@media (max-width: 480px) { .badge { font-size: 11px; padding: 4px 10px; } }\\n' +
'.empty { text-align: center; padding: 50px 20px; color: var(--text-muted); font-size: 16px; background: var(--background-secondary); border-radius: 10px; }\\n' +
'</style>\\n\\n' +
'---\\n' +
'마지막 업데이트: ' + updateTime + '\\n';

        try {
            const file = this.app.vault.getAbstractFileByPath(dashboardPath);
            if (file) {
                await this.app.vault.modify(file, template);
            } else {
                await this.app.vault.create(dashboardPath, template);
            }
            
            new Notice('✅ 통합 대시보드가 생성되었습니다!');
            
            // 생성 후 바로 열기
            const dashboardFile = this.app.vault.getAbstractFileByPath(dashboardPath);
            if (dashboardFile) {
                const leaf = this.app.workspace.getLeaf(false);
                await leaf.openFile(dashboardFile);
            }
        } catch (error) {
            console.error('통합 대시보드 생성 오류:', error);
            new Notice('❌ 통합 대시보드 생성에 실패했습니다.');
        }
    }

    '''

# 함수 교체
new_content = content[:start_idx] + new_function + content[end_idx:]

# 파일 저장
with open('main.js', 'w', encoding='utf-8') as f:
    f.write(new_content)

print("✅ Dashboard 템플릿이 수정되었습니다!")
