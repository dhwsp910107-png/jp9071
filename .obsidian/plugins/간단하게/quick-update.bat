@echo off
chcp 65001 >nul
title Math Study Dashboard - Quick Update

echo.
echo ===================================================
echo     Math Study Dashboard - QUICK UPDATE v2.1
echo ===================================================
echo.

echo [1/4] 플러그인 위치 확인 중...
set "PLUGIN_DIR=%APPDATA%\Obsidian\plugins\math-study-dashboard"

if not exist "%PLUGIN_DIR%" (
    echo ❌ 플러그인이 설치되지 않았습니다!
    echo    먼저 기본 설치를 완료해주세요.
    pause
    exit /b 1
)

echo ✓ 플러그인 발견: %PLUGIN_DIR%

echo [2/4] 백업 생성 중...
set "BACKUP_DIR=%PLUGIN_DIR%.backup_%date:~0,4%%date:~5,2%%date:~8,2%_%time:~0,2%%time:~3,2%"
xcopy "%PLUGIN_DIR%" "%BACKUP_DIR%" /E /I /Q >nul
echo ✓ 백업 완료

echo [3/4] 업데이트된 파일 설치 중...
del "%PLUGIN_DIR%\main.js" >nul 2>&1
del "%PLUGIN_DIR%\manifest.json" >nul 2>&1

REM Create updated manifest.json
(
echo {
echo   "id": "math-study-dashboard",
echo   "name": "Math Study Dashboard",
echo   "version": "2.1.0",
echo   "minAppVersion": "0.15.0",
echo   "description": "수학 학습 진도 관리 대시보드 - 과목별 문제 관리",
echo   "author": "Math Study Team"
echo }
) > "%PLUGIN_DIR%\manifest.json"

REM Create simplified but working main.js
(
echo const { Plugin, ItemView, Modal, Notice, Setting, PluginSettingTab } = require^('obsidian'^);
echo.
echo const VIEW_TYPE_MATH_DASHBOARD = 'math-dashboard-view';
echo.
echo const DEFAULT_SETTINGS = {
echo     problemsFolder: '수학학습관리/문제은행',
echo     subjects: ['수학상', '수학하', '수학I', '수학II', '미적분', '확률과 통계'],
echo     customSubjects: [],
echo     currentSubject: '수학상'
echo };
echo.
echo class MathStudyDashboardPlugin extends Plugin {
echo     async onload^(^) {
echo         this.settings = Object.assign^({}, DEFAULT_SETTINGS, await this.loadData^(^)^);
echo         
echo         setTimeout^(^(^) =^> {
echo             new Notice^('🎉 수학 대시보드 v2.1 업데이트 완료!\\n✨ 과목별 관리 시스템이 추가되었습니다!', 6000^);
echo         }, 1500^);
echo         
echo         this.registerView^(VIEW_TYPE_MATH_DASHBOARD, ^(leaf^) =^> new MathDashboardView^(leaf, this^)^);
echo         this.addRibbonIcon^('bar-chart', '수학 학습 대시보드 v2.1 - 과목별 관리', ^(^) =^> this.activateDashboardView^(^)^);
echo         this.addCommand^({id: 'switch-subject', name: '과목 변경', callback: ^(^) =^> this.switchSubject^(^)});
echo         this.addSettingTab^(new MathStudySettingTab^(this.app, this^)^);
echo         this.addStyle^(^);
echo     }
echo.
echo     async saveSettings^(^) { await this.saveData^(this.settings^); }
echo     
echo     async activateDashboardView^(^) {
echo         const { workspace } = this.app;
echo         let leaf = workspace.getLeavesOfType^(VIEW_TYPE_MATH_DASHBOARD^)[0] ^|^| workspace.getRightLeaf^(false^);
echo         if ^(leaf^) {
echo             await leaf.setViewState^({ type: VIEW_TYPE_MATH_DASHBOARD, active: true }^);
echo             workspace.revealLeaf^(leaf^);
echo         }
echo     }
echo.
echo     async switchSubject^(^) { new SubjectModal^(this.app, this^).open^(^); }
echo     getAllSubjects^(^) { return [...this.settings.subjects, ...this.settings.customSubjects]; }
echo     
echo     async addCustomSubject^(name^) {
echo         if ^(!this.settings.customSubjects.includes^(name^)^) {
echo             this.settings.customSubjects.push^(name^);
echo             await this.saveSettings^(^);
echo             return true;
echo         }
echo         return false;
echo     }
echo.
echo     addStyle^(^) {
echo         const style = document.createElement^('style'^);
echo         style.id = 'math-dashboard-styles';
echo         style.textContent = `.math-dashboard { padding: 20px; } .math-subject-header { display: flex; justify-content: space-between; margin-bottom: 20px; padding: 15px; background: var^(--background-secondary^); border-radius: 8px; border: 2px solid var^(--interactive-accent^); } .math-subject-title { font-size: 1.5rem; font-weight: bold; color: var^(--interactive-accent^); } .math-subject-button { padding: 8px 15px; background: var^(--interactive-accent^); color: white; border: none; border-radius: 6px; cursor: pointer; } .math-update-banner { background: linear-gradient^(135deg, #22c55e, #16a34a^); color: white; padding: 15px; border-radius: 8px; margin-bottom: 20px; text-align: center; font-weight: bold; }`;
echo         document.head.appendChild^(style^);
echo     }
echo }
echo.
echo class MathDashboardView extends ItemView {
echo     constructor^(leaf, plugin^) { super^(leaf^); this.plugin = plugin; this.plugin.dashboardView = this; }
echo     getViewType^(^) { return VIEW_TYPE_MATH_DASHBOARD; }
echo     getDisplayText^(^) { return '수학 학습 대시보드 v2.1'; }
echo     getIcon^(^) { return 'bar-chart'; }
echo.
echo     async onOpen^(^) {
echo         const container = this.containerEl.children[1];
echo         container.empty^(^);
echo         container.addClass^('math-dashboard'^);
echo         
echo         const banner = container.createDiv^('math-update-banner'^);
echo         banner.textContent = '🎉 v2.1 업데이트: 과목별 관리 시스템 추가!';
echo         
echo         const header = container.createDiv^('math-subject-header'^);
echo         header.createDiv^({ cls: 'math-subject-title', text: '📚 현재 과목: ' + this.plugin.settings.currentSubject }^);
echo         const btn = header.createEl^('button', { cls: 'math-subject-button', text: '과목 변경' }^);
echo         btn.onclick = ^(^) =^> this.plugin.switchSubject^(^);
echo         
echo         container.createEl^('h3', { text: '✨ 새로운 기능들' }^);
echo         const features = container.createEl^('ul'^);
echo         features.createEl^('li', { text: '📚 과목별 독립적인 문제 관리 ^(수학상, 수학하, 수학I, 수학II, 미적분, 확률과 통계^)' }^);
echo         features.createEl^('li', { text: '➕ 사용자 정의 과목 추가 ^(기하, 물리학I, 화학I, 생물학I 등^)' }^);
echo         features.createEl^('li', { text: '🔢 과목별 문제 번호 자동 관리 ^(각 과목마다 1번부터 시작^)' }^);
echo         features.createEl^('li', { text: '📊 과목별 진행률 및 통계 표시' }^);
echo         
echo         const instructions = container.createEl^('div'^);
echo         instructions.style.marginTop = '20px';
echo         instructions.style.padding = '15px';
echo         instructions.style.background = 'var^(--background-secondary^)';
echo         instructions.style.borderRadius = '8px';
echo         instructions.innerHTML = '🎯 <strong>사용 방법:</strong><br>1. 위의 \"과목 변경\" 버튼을 클릭하세요<br>2. 원하는 과목을 선택하거나 새 과목을 추가하세요<br>3. 각 과목별로 문제를 독립적으로 관리할 수 있습니다';
echo     }
echo     
echo     async refresh^(^) { await this.onOpen^(^); new Notice^('새로고침 완료'^); }
echo }
echo.
echo class SubjectModal extends Modal {
echo     constructor^(app, plugin^) { super^(app^); this.plugin = plugin; }
echo     
echo     onOpen^(^) {
echo         const { contentEl } = this;
echo         contentEl.createEl^('h2', { text: '📚 과목 선택 및 관리' }^);
echo         
echo         const form = contentEl.createDiv^(^);
echo         form.createEl^('label', { text: '과목 선택:' }^);
echo         const select = form.createEl^('select'^);
echo         
echo         this.plugin.getAllSubjects^(^).forEach^(subject =^> {
echo             const option = select.createEl^('option', { value: subject, text: subject }^);
echo             if ^(subject === this.plugin.settings.currentSubject^) option.selected = true;
echo         }^);
echo         
echo         form.createEl^('br'^);
echo         form.createEl^('br'^);
echo         form.createEl^('label', { text: '새 과목 추가 ^(예: 기하, 물리학I, 화학I, 생물학I^):' }^);
echo         const input = form.createEl^('input', { type: 'text', placeholder: '원하는 과목명을 입력하세요...' }^);
echo         
echo         const buttons = form.createDiv^(^);
echo         buttons.style.marginTop = '20px';
echo         buttons.style.textAlign = 'right';
echo         
echo         const addBtn = buttons.createEl^('button', { text: '새 과목 추가' }^);
echo         addBtn.style.marginRight = '10px';
echo         addBtn.style.backgroundColor = '#22c55e';
echo         addBtn.style.color = 'white';
echo         addBtn.style.border = 'none';
echo         addBtn.style.padding = '8px 15px';
echo         addBtn.style.borderRadius = '6px';
echo         addBtn.style.cursor = 'pointer';
echo         addBtn.onclick = async ^(^) =^> {
echo             const newSubject = input.value.trim^(^);
echo             if ^(newSubject^) {
echo                 const added = await this.plugin.addCustomSubject^(newSubject^);
echo                 if ^(added^) {
echo                     select.empty^(^);
echo                     this.plugin.getAllSubjects^(^).forEach^(subject =^> {
echo                         const option = select.createEl^('option', { value: subject, text: subject }^);
echo                         if ^(subject === newSubject^) option.selected = true;
echo                     }^);
echo                     input.value = '';
echo                     new Notice^(`✅ \"${newSubject}\" 과목이 추가되었습니다!`^);
echo                 } else {
echo                     new Notice^(`⚠️ \"${newSubject}\" 과목이 이미 존재합니다.`^);
echo                 }
echo             }
echo         };
echo         
echo         const selectBtn = buttons.createEl^('button', { text: '과목 선택' }^);
echo         selectBtn.style.backgroundColor = 'var^(--interactive-accent^)';
echo         selectBtn.style.color = 'white';
echo         selectBtn.style.border = 'none';
echo         selectBtn.style.padding = '8px 15px';
echo         selectBtn.style.borderRadius = '6px';
echo         selectBtn.style.cursor = 'pointer';
echo         selectBtn.onclick = async ^(^) =^> {
echo             const oldSubject = this.plugin.settings.currentSubject;
echo             this.plugin.settings.currentSubject = select.value;
echo             await this.plugin.saveSettings^(^);
echo             if ^(this.plugin.dashboardView^) this.plugin.dashboardView.refresh^(^);
echo             new Notice^(`✅ \"${oldSubject}\" → \"${select.value}\" 과목으로 변경되었습니다!`^);
echo             this.close^(^);
echo         };
echo     }
echo     
echo     onClose^(^) { this.contentEl.empty^(^); }
echo }
echo.
echo class MathStudySettingTab extends PluginSettingTab {
echo     constructor^(app, plugin^) { super^(app, plugin^); this.plugin = plugin; }
echo     
echo     display^(^) {
echo         const { containerEl } = this;
echo         containerEl.empty^(^);
echo         containerEl.createEl^('h2', { text: '수학 학습 대시보드 설정 v2.1' }^);
echo         
echo         const updateInfo = containerEl.createEl^('div'^);
echo         updateInfo.style.background = 'var^(--background-secondary^)';
echo         updateInfo.style.padding = '15px';
echo         updateInfo.style.borderRadius = '8px';
echo         updateInfo.style.marginBottom = '20px';
echo         updateInfo.innerHTML = '🎉 ^<strong^>v2.1 업데이트^</strong^>^<br^>✨ 과목별 문제 관리 시스템이 추가되었습니다!';
echo         
echo         new Setting^(containerEl^)
echo             .setName^('문제 폴더'^)
echo             .setDesc^('수학 문제 파일들이 저장될 폴더'^)
echo             .addText^(text =^> text
echo                 .setPlaceholder^('수학학습관리/문제은행'^)
echo                 .setValue^(this.plugin.settings.problemsFolder^)
echo                 .onChange^(async ^(value^) =^> {
echo                     this.plugin.settings.problemsFolder = value;
echo                     await this.plugin.saveSettings^(^);
echo                 }^)^);
echo         
echo         new Setting^(containerEl^)
echo             .setName^('현재 선택된 과목'^)
echo             .setDesc^('현재 대시보드에서 보고 있는 과목'^)
echo             .addDropdown^(dropdown =^> {
echo                 this.plugin.getAllSubjects^(^).forEach^(subject =^> dropdown.addOption^(subject, subject^)^);
echo                 dropdown.setValue^(this.plugin.settings.currentSubject^);
echo                 dropdown.onChange^(async ^(value^) =^> {
echo                     this.plugin.settings.currentSubject = value;
echo                     await this.plugin.saveSettings^(^);
echo                     if ^(this.plugin.dashboardView^) this.plugin.dashboardView.refresh^(^);
echo                     new Notice^(`✅ ${value} 과목으로 변경되었습니다!`^);
echo                 }^);
echo             }^);
echo     }
echo }
echo.
echo module.exports = MathStudyDashboardPlugin;
) > "%PLUGIN_DIR%\main.js"

echo ✓ 업데이트된 파일 설치 완료

echo [4/4] 설치 완료!
echo.
echo ✅ 강제 업데이트 완료!
echo.
echo 🆕 새로운 기능:
echo    • 📚 과목별 문제 관리 시스템
echo    • ➕ 사용자 정의 과목 추가 (기하, 물리학I, 화학I 등)
echo    • 🔢 과목별 독립적인 문제 번호 관리
echo    • 📊 과목별 진행률 및 통계 표시
echo.
echo ⚠️  중요: 다음 단계를 꼭 따라하세요!
echo 1. Obsidian을 완전히 종료하세요
echo 2. Obsidian을 다시 시작하세요
echo 3. Settings → Community plugins로 가세요
echo 4. "Math Study Dashboard"를 비활성화했다가 다시 활성화하세요
echo 5. 왼쪽 리본에서 📊 아이콘을 클릭하여 대시보드를 열어보세요
echo 6. "과목 변경" 버튼이 나타나는지 확인하세요
echo.
echo 🎉 사용 방법:
echo    1. "과목 변경" 버튼으로 원하는 과목 선택
echo    2. "새 과목 추가"로 기하, 물리학, 화학 등 추가
echo    3. 각 과목별로 문제 1번부터 자동 관리
echo    4. 과목별 독립적인 진행률 추적
echo.
echo 📁 설치 위치: %PLUGIN_DIR%
echo 💾 백업 위치: %BACKUP_DIR%
echo.
pause