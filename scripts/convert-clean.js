(async function() {
    const folderPath = 'HanziQuiz/Questions/기본';
    const dryRun = false;
    
    console.log('변환 시작...');
    
    const files = app.vault.getMarkdownFiles()
        .filter(f => f.path.startsWith(folderPath) && 
                     f.name.includes('_') && 
                     !f.name.includes('문제목록') &&
                     !f.name.includes('대시보드'));
    
    console.log('총 ' + files.length + '개 파일 발견');
    
    let converted = 0;
    let skipped = 0;
    let failed = 0;
    const startTime = Date.now();
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        try {
            const content = await app.vault.read(file);
            
            if (content.startsWith('---')) {
                console.log('[' + (i+1) + '/' + files.length + '] 이미 변환됨: ' + file.name);
                skipped++;
                continue;
            }
            
            const lines = content.split('\n');
            const data = {};
            let section = '';
            let sectionContent = [];
            
            for (const line of lines) {
                const trimmed = line.trim();
                
                if (trimmed.startsWith('# ') && !trimmed.startsWith('## ')) {
                    continue;
                }
                
                if (trimmed.startsWith('## ')) {
                    if (section && sectionContent.length > 0) {
                        data[section] = sectionContent.join('\n').trim();
                    }
                    section = trimmed.substring(3).trim();
                    sectionContent = [];
                } else if (section && trimmed) {
                    sectionContent.push(trimmed);
                }
            }
            
            if (section && sectionContent.length > 0) {
                data[section] = sectionContent.join('\n').trim();
            }
            
            let newContent = '---\n';
            newContent += 'hanzi: "' + (data['한자'] || '').replace(/"/g, '\\"') + '"\n';
            newContent += 'number: ' + (data['번호'] || 0) + '\n';
            newContent += 'folder: ' + (data['폴더'] || '기본') + '\n';
            newContent += 'question: "' + (data['문제'] || '').replace(/"/g, '\\"').replace(/\n/g, ' ') + '"\n';
            
            if (data['선택지']) {
                const options = data['선택지']
                    .split(/(?=-)/)
                    .map(opt => opt.replace(/^-\s*/, '').trim())
                    .filter(opt => opt.length > 0);
                
                if (options.length > 0) {
                    newContent += 'options:\n';
                    options.forEach(opt => {
                        newContent += '  - "' + opt.replace(/"/g, '\\"') + '"\n';
                    });
                }
            }
            
            if (data['선택지 이미지']) {
                const images = data['선택지 이미지'].split('\n')
                    .map(line => {
                        const match = line.match(/^\d+\.\s*(.+)/);
                        return match ? match[1].trim() : '';
                    });
                
                newContent += 'optionImages:\n';
                images.forEach(img => {
                    newContent += '  - "' + img + '"\n';
                });
            }
            
            newContent += 'answer: ' + (data['정답'] || 0) + '\n';
            
            if (data['힌트']) {
                newContent += 'hint: "' + data['힌트'].replace(/"/g, '\\"').replace(/\n/g, ' ') + '"\n';
            }
            
            if (data['노트']) {
                newContent += 'note: "' + data['노트'].replace(/"/g, '\\"').replace(/\n/g, ' ') + '"\n';
            }
            
            newContent += 'difficulty: ' + (data['난이도'] || 'C') + '\n';
            newContent += 'bookmarked: false\n';
            newContent += 'correctCount: 0\n';
            newContent += 'wrongCount: 0\n';
            newContent += '---\n\n';
            
            newContent += '# ' + (data['한자'] || '') + ' 문제\n\n';
            newContent += '## 문제\n' + (data['문제'] || '') + '\n\n';
            
            if (data['선택지']) {
                newContent += '## 선택지\n' + data['선택지'] + '\n\n';
            }
            
            if (data['힌트']) {
                newContent += '## 힌트\n' + data['힌트'] + '\n\n';
            }
            
            if (data['노트']) {
                newContent += '## 노트\n' + data['노트'] + '\n\n';
            }
            
            if (!dryRun) {
                await app.vault.modify(file, newContent);
            }
            
            console.log('[' + (i+1) + '/' + files.length + '] 변환 완료: ' + file.name);
            converted++;
            
        } catch (error) {
            console.error('[' + (i+1) + '/' + files.length + '] 실패: ' + file.name, error.message);
            failed++;
        }
        
        if ((i + 1) % 10 === 0 || (i + 1) === files.length) {
            const percentage = Math.round(((i + 1) / files.length) * 100);
            const elapsed = Math.round((Date.now() - startTime) / 1000);
            console.log('진행률: ' + percentage + '% (' + (i + 1) + '/' + files.length + ') - ' + elapsed + '초 경과');
        }
    }
    
    const totalTime = Math.round((Date.now() - startTime) / 1000);
    
    console.log('\n변환 완료!');
    console.log('==================================================');
    console.log('결과:');
    console.log('  변환됨: ' + converted + '개');
    console.log('  이미 변환됨: ' + skipped + '개');
    console.log('  실패: ' + failed + '개');
    console.log('  총: ' + files.length + '개');
    console.log('  소요 시간: ' + totalTime + '초');
    console.log('==================================================');
    
    if (!dryRun && converted > 0) {
        console.log('\n이제 Obsidian을 리로드하세요: Ctrl+R');
        console.log('문제목록 페이지를 열어서 DataviewJS가 작동하는지 확인하세요!');
    }
})();
