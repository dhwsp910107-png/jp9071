import re

# 파일 읽기
with open(r'c:\ObsidianVaults\강의체크인\.obsidian\plugins\quiz-sp2\main.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 교체할 코드
old_code = '''        // 정답/오답 모두 노트 바로 출력 (노트 텍스트 또는 노트 이미지가 있으면)
        if ((question.note && question.note.trim()) || (question.noteImage && question.noteImage.trim())) {
            const noteSection = feedback.createDiv({ cls: 'quiz-note-section' });
            noteSection.style.cssText = `
                margin: 18px 0 0 0;
                padding: 18px;
                background: rgba(255, 255, 255, 0.15);
                border-radius: 10px;
                border: 2px solid rgba(255, 255, 255, 0.3);
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
            `;
            const noteTitle = noteSection.createEl('div', { text: '📝 노트' });
            noteTitle.style.cssText = `
                font-size: 16px;
                font-weight: 600;
                color: white;
                margin-bottom: 8px;
            `;
            
            if (question.note && question.note.trim()) {
                const noteContent = noteSection.createEl('div', { text: question.note });
                noteContent.style.cssText = `
                    font-size: 15px;
                    color: white;
                    white-space: pre-line;
                    line-height: 1.6;
                    margin-bottom: 8px;
                `;
            }
            
            if (question.noteImage && question.noteImage.trim()) {
                const noteImgContainer = noteSection.createDiv();
                noteImgContainer.style.marginTop = '10px';
                
                const noteImageLines = question.noteImage.split('\\n').filter(line => line.trim());
                noteImageLines.forEach(imageLine => {
                    let imageUrl = imageLine.trim();
                    
                    if (imageUrl.includes('[[') && imageUrl.includes(']]')) {
                        const wikiMatch = imageUrl.match(/\\[\\[(.+?)(\\|\\d+)?\\]\\]/);
                        if (wikiMatch && wikiMatch[1]) {
                            const fileName = wikiMatch[1];
                            const files = this.app.vault.getFiles();
                            const imageFile = files.find(f => 
                                f.name === fileName || 
                                f.path.endsWith(fileName) ||
                                f.basename === fileName.replace(/\\.\\w+$/, '')
                            );
                            if (imageFile) {
                                imageUrl = this.app.vault.getResourcePath(imageFile);
                            }
                        }
                    }
                    
                    const noteImg = noteImgContainer.createEl('img', {
                        attr: { src: imageUrl, alt: '노트 이미지' }
                    });
                    noteImg.style.cssText = `
                        max-width: 100%;
                        border-radius: 6px;
                        margin-top: 8px;
                        cursor: zoom-in;
                    `;
                    noteImg.addEventListener('click', () => {
                        this.showImageZoom(imageUrl, '노트 이미지', [imageUrl], 0);
                    });
                });
            }
        }'''

new_code = '''        // 정답/오답 모두 노트 토글 버튼
        if ((question.note && question.note.trim()) || (question.noteImage && question.noteImage.trim())) {
            const noteToggleBtn = feedback.createEl('button', { text: '📝 노트 보기' });
            noteToggleBtn.style.cssText = `
                margin-top: 15px;
                padding: 10px 20px;
                font-size: 14px;
                background: rgba(255, 255, 255, 0.2);
                color: white;
                border: 2px solid rgba(255, 255, 255, 0.5);
                border-radius: 15px;
                cursor: pointer;
                font-weight: bold;
                transition: all 0.2s;
            `;
            
            let noteSection = null;
            
            noteToggleBtn.addEventListener('click', () => {
                if (noteSection) {
                    noteSection.remove();
                    noteSection = null;
                    noteToggleBtn.setText('📝 노트 보기');
                } else {
                    noteSection = feedback.createDiv({ cls: 'quiz-note-section' });
                    noteSection.style.cssText = `
                        margin: 15px 0 0 0;
                        padding: 18px;
                        background: rgba(255, 255, 255, 0.15);
                        border-radius: 10px;
                        border: 2px solid rgba(255, 255, 255, 0.3);
                        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
                        max-width: 400px;
                    `;
                    
                    const noteTitle = noteSection.createEl('div', { text: '📝 노트' });
                    noteTitle.style.cssText = `
                        font-size: 16px;
                        font-weight: 600;
                        color: white;
                        margin-bottom: 8px;
                    `;
                    
                    if (question.note && question.note.trim()) {
                        const noteContent = noteSection.createEl('div', { text: question.note });
                        noteContent.style.cssText = `
                            font-size: 15px;
                            color: white;
                            white-space: pre-line;
                            line-height: 1.6;
                            margin-bottom: 8px;
                        `;
                    }
                    
                    if (question.noteImage && question.noteImage.trim()) {
                        const noteImgContainer = noteSection.createDiv();
                        noteImgContainer.style.marginTop = '10px';
                        
                        const noteImageLines = question.noteImage.split('\\n').filter(line => line.trim());
                        noteImageLines.forEach(imageLine => {
                            let imageUrl = imageLine.trim();
                            
                            if (imageUrl.includes('[[') && imageUrl.includes(']]')) {
                                const wikiMatch = imageUrl.match(/\\[\\[(.+?)(\\|\\d+)?\\]\\]/);
                                if (wikiMatch && wikiMatch[1]) {
                                    const fileName = wikiMatch[1];
                                    const files = this.app.vault.getFiles();
                                    const imageFile = files.find(f => 
                                        f.name === fileName || 
                                        f.path.endsWith(fileName) ||
                                        f.basename === fileName.replace(/\\.\\w+$/, '')
                                    );
                                    if (imageFile) {
                                        imageUrl = this.app.vault.getResourcePath(imageFile);
                                    }
                                }
                            }
                            
                            const noteImg = noteImgContainer.createEl('img', {
                                attr: { src: imageUrl, alt: '노트 이미지' }
                            });
                            noteImg.style.cssText = `
                                max-width: 100%;
                                border-radius: 6px;
                                margin-top: 8px;
                                cursor: zoom-in;
                            `;
                            noteImg.addEventListener('click', () => {
                                this.showImageZoom(imageUrl, '노트 이미지', [imageUrl], 0);
                            });
                        });
                    }
                    
                    // 버튼 바로 뒤에 노트 섹션 삽입
                    noteToggleBtn.after(noteSection);
                    noteToggleBtn.setText('📝 노트 닫기');
                }
            });
        }'''

# 모든 occurrence 교체
new_content = content.replace(old_code, new_code)

# 파일 저장
with open(r'c:\ObsidianVaults\강의체크인\.obsidian\plugins\quiz-sp2\main.js', 'w', encoding='utf-8') as f:
    f.write(new_content)

print("교체 완료!")
