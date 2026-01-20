#!/usr/bin/env python3
# -*- coding: utf-8 -*-

with open('main.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. 폴더 링크를 클릭 가능한 버튼으로 변경 (obsidian:// 프로토콜 사용)
old_dashboard = """'for (const folder of folders) {\\n' +
'    const folderPath = questionsPath + "/" + folder;\\n' +
'    const folderQuestions = dv.pages("\\\\"" + folderPath + "\\\\"").where(p => p.file.name.includes("_") && !p.file.name.includes("문제목록"));\\n' +
'    const count = folderQuestions.length;\\n' +
'    const listPath = folderPath + "/문제목록.md";\\n' +
'    html += "<div class=\\\\"folder-card\\\\"><div class=\\\\"folder-icon\\\\">📁</div><div class=\\\\"folder-name\\\\">" + folder + "</div><div class=\\\\"folder-count\\\\">" + count + "개 문제</div><a href=\\\\"" + listPath + "\\\\" class=\\\\"folder-link\\\\">📋 문제 목록 보기</a></div>";\\n' +
'}\\n\\n'"""

new_dashboard = """'for (const folder of folders) {\\n' +
'    const folderPath = questionsPath + "/" + folder;\\n' +
'    const folderQuestions = dv.pages("\\\\"" + folderPath + "\\\\"").where(p => p.file.name.includes("_") && !p.file.name.includes("문제목록"));\\n' +
'    const count = folderQuestions.length;\\n' +
'    const listPath = folderPath + "/문제목록.md";\\n' +
'    html += "<div class=\\\\"folder-card\\\\"><div class=\\\\"folder-icon\\\\">📁</div><div class=\\\\"folder-name\\\\">" + folder + "</div><div class=\\\\"folder-count\\\\">" + count + "개 문제</div><a href=\\\\"obsidian://open?vault=" + encodeURIComponent(dv.app.vault.getName()) + "&file=" + encodeURIComponent(listPath) + "\\\\" class=\\\\"folder-link\\\\">📋 문제 목록 보기</a></div>";\\n' +
'}\\n\\n'"""

content = content.replace(old_dashboard, new_dashboard)

# 2. 피드백 화면 크기 축소 (모바일/대시보드 크기에 맞게)
old_feedback = """    async showFeedback(isCorrect, question) {
        const { contentEl } = this;
        
        const feedback = contentEl.createDiv({ cls: 'feedback-overlay' });
        feedback.style.position = 'fixed';
        feedback.style.top = '0';
        feedback.style.left = '0';
        feedback.style.right = '0';
        feedback.style.bottom = '0';
        feedback.style.backgroundColor = isCorrect ? 'rgba(76, 175, 80, 0.95)' : 'rgba(244, 67, 54, 0.95)';
        feedback.style.display = 'flex';
        feedback.style.flexDirection = 'column';
        feedback.style.alignItems = 'center';
        feedback.style.justifyContent = 'center';
        feedback.style.color = 'white';
        feedback.style.zIndex = '1000';

        const icon = feedback.createEl('div', { 
            text: isCorrect ? '✅' : '❌',
            cls: 'feedback-icon'
        });
        icon.style.fontSize = '80px';
        icon.style.marginBottom = '20px';

        const message = feedback.createEl('h2', { 
            text: isCorrect ? '정답입니다!' : '틀렸습니다!'
        });

        if (!isCorrect && question.hint && this.plugin.settings.showHintAfterWrong) {
            const hint = feedback.createEl('p', { text: `💡 힌트: ${question.hint}` });
            hint.style.fontSize = '18px';
            hint.style.marginTop = '20px';
            hint.style.padding = '15px';
            hint.style.backgroundColor = 'rgba(0,0,0,0.3)';
            hint.style.borderRadius = '8px';
        }

        if (!isCorrect) {
            const correctAnswerText = feedback.createEl('p', { 
                text: `정답: ${question.options[question.answer]}`
            });
            correctAnswerText.style.fontSize = '20px';
            correctAnswerText.style.marginTop = '10px';
            correctAnswerText.style.fontWeight = 'bold';
        }

        const nextBtn = feedback.createEl('button', { 
            text: '다음 문제 →',
            cls: 'next-button'
        });
        nextBtn.style.marginTop = '30px';
        nextBtn.style.padding = '15px 30px';
        nextBtn.style.fontSize = '18px';
        nextBtn.style.backgroundColor = 'white';
        nextBtn.style.color = isCorrect ? '#4caf50' : '#f44336';
        nextBtn.style.border = 'none';
        nextBtn.style.borderRadius = '25px';
        nextBtn.style.cursor = 'pointer';
        nextBtn.style.fontWeight = 'bold';"""

new_feedback = """    async showFeedback(isCorrect, question) {
        const { contentEl } = this;
        
        const feedback = contentEl.createDiv({ cls: 'feedback-overlay' });
        feedback.style.position = 'fixed';
        feedback.style.top = '50%';
        feedback.style.left = '50%';
        feedback.style.transform = 'translate(-50%, -50%)';
        feedback.style.width = '90%';
        feedback.style.maxWidth = '500px';
        feedback.style.maxHeight = '80vh';
        feedback.style.overflow = 'auto';
        feedback.style.backgroundColor = isCorrect ? 'rgba(76, 175, 80, 0.98)' : 'rgba(244, 67, 54, 0.98)';
        feedback.style.display = 'flex';
        feedback.style.flexDirection = 'column';
        feedback.style.alignItems = 'center';
        feedback.style.justifyContent = 'center';
        feedback.style.color = 'white';
        feedback.style.zIndex = '1000';
        feedback.style.padding = '30px 20px';
        feedback.style.borderRadius = '15px';
        feedback.style.boxShadow = '0 10px 40px rgba(0,0,0,0.3)';

        const icon = feedback.createEl('div', { 
            text: isCorrect ? '✅' : '❌',
            cls: 'feedback-icon'
        });
        icon.style.fontSize = '50px';
        icon.style.marginBottom = '15px';

        const message = feedback.createEl('h2', { 
            text: isCorrect ? '정답입니다!' : '틀렸습니다!'
        });
        message.style.fontSize = '24px';
        message.style.marginBottom = '10px';

        if (!isCorrect && question.hint && this.plugin.settings.showHintAfterWrong) {
            const hint = feedback.createEl('p', { text: `💡 힌트: ${question.hint}` });
            hint.style.fontSize = '15px';
            hint.style.marginTop = '15px';
            hint.style.padding = '12px';
            hint.style.backgroundColor = 'rgba(0,0,0,0.3)';
            hint.style.borderRadius = '8px';
            hint.style.maxWidth = '400px';
        }

        if (!isCorrect) {
            const correctAnswerText = feedback.createEl('p', { 
                text: `정답: ${question.options[question.answer]}`
            });
            correctAnswerText.style.fontSize = '16px';
            correctAnswerText.style.marginTop = '10px';
            correctAnswerText.style.fontWeight = 'bold';
        }

        const nextBtn = feedback.createEl('button', { 
            text: '다음 문제 →',
            cls: 'next-button'
        });
        nextBtn.style.marginTop = '20px';
        nextBtn.style.padding = '12px 25px';
        nextBtn.style.fontSize = '16px';
        nextBtn.style.backgroundColor = 'white';
        nextBtn.style.color = isCorrect ? '#4caf50' : '#f44336';
        nextBtn.style.border = 'none';
        nextBtn.style.borderRadius = '20px';
        nextBtn.style.cursor = 'pointer';
        nextBtn.style.fontWeight = 'bold';"""

content = content.replace(old_feedback, new_feedback)

with open('main.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ 수정 완료!")
print("   1. 폴더 링크를 obsidian:// 프로토콜로 변경 (클릭 가능)")
print("   2. 피드백 화면 크기 축소 (500px 최대폭, 중앙 정렬)")
print("   3. 아이콘, 텍스트 크기 조정 (더 컴팩트)")
