/**
 * 간단한 문제 파일 변환 스크립트
 * Obsidian 개발자 도구 콘솔에 복사해서 실행하세요
 */

// 실행 방법:
// 1. Ctrl+Shift+I로 개발자 도구 열기
// 2. Console 탭으로 이동
// 3. 아래 코드를 복사해서 붙여넣고 Enter

(async function() {
    const folderPath = 'HanziQuiz/Questions/기본'; // 변환할 폴더 경로
    const dryRun = false; // true: 테스트만, false: 실제 변환
    
    console.log('🚀 문제 파일 변환 시작...\n');
    
    const files = app.vault.getMarkdownFiles()
        .filter(f => f.path.startsWith(folderPath) && 
                     f.name.includes('_') && 
                     !f.name.includes('문제목록') &&
                     !f.name.includes('대시보드'));
    
    console.log(`📄 총 ${files.length}개 파일 발견\n`);
    
    let converted = 0;
    let skipped = 0;
    let failed = 0;
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        try {
            const content = await app.vault.read(file);
            
            // 이미 frontmatter가 있으면 건너뛰기
            if (content.startsWith('---')) {
                console.log(`⏭️  [${i+1}/${files.length}] 이미 변환됨: ${file.name}`);
                skipped++;
                continue;
            }
            
            // 데이터 파싱
            const lines = content.split('\n');
            const data = {};
            let section = '';
            let sectionContent = [];
            
            for (const line of lines) {
                const trimmed = line.trim();
                
                // 섹션 헤딩
                if (trimmed.startsWith('## ')) {
                    // 이전 섹션 저장
                    if (section && sectionContent.length > 0) {
                        data[section] = sectionContent.join('\n').trim();
                    }
                    section = trimmed.substring(3).trim();
                    sectionContent = [];
                } else if (section && trimmed) {
                    sectionContent.push(trimmed);
                }
            }
            
            // 마지막 섹션 저장
            if (section && sectionContent.length > 0) {
                data[section] = sectionContent.join('\n').trim();
            }
            
            // frontmatter 생성
            let newContent = '---\n';
            newContent += `hanzi: "${data['한자'] || ''}"\n`;
            newContent += `number: ${data['번호'] || 0}\n`;
            newContent += `folder: ${data['폴더'] || '기본'}\n`;
            newContent += `question: "${(data['문제'] || '').replace(/"/g, '\\"')}"\n`;
            
            // 선택지 파싱
            if (data['선택지']) {
                const options = data['선택지']
                    .split(/(?=-)/)
                    .map(opt => opt.replace(/^-\s*/, '').trim())
                    .filter(opt => opt.length > 0);
                
                if (options.length > 0) {
                    newContent += 'options:\n';
                    options.forEach(opt => {
                        newContent += `  - "${opt.replace(/"/g, '\\"')}"\n`;
                    });
                }
            }
            
            // 선택지 이미지
            if (data['선택지 이미지']) {
                const images = data['선택지 이미지'].split('\n')
                    .map(line => {
                        const match = line.match(/^\d+\.\s*(.+)/);
                        return match ? match[1].trim() : '';
                    });
                
                newContent += 'optionImages:\n';
                images.forEach(img => {
                    newContent += `  - "${img}"\n`;
                });
            }
            
            newContent += `answer: ${data['정답'] || 0}\n`;
            
            if (data['힌트']) {
                newContent += `hint: "${data['힌트'].replace(/"/g, '\\"')}"\n`;
            }
            
            if (data['노트']) {
                newContent += `note: "${data['노트'].replace(/"/g, '\\"')}"\n`;
            }
            
            newContent += `difficulty: ${data['난이도'] || 'C'}\n`;
            newContent += `bookmarked: false\n`;
            newContent += `correctCount: 0\n`;
            newContent += `wrongCount: 0\n`;
            newContent += '---\n\n';
            
            // 본문
            newContent += `# ${data['한자'] || ''} 문제\n\n`;
            newContent += `## 문제\n${data['문제'] || ''}\n\n`;
            
            if (data['선택지']) {
                newContent += `## 선택지\n${data['선택지']}\n\n`;
            }
            
            if (data['힌트']) {
                newContent += `## 힌트\n${data['힌트']}\n\n`;
            }
            
            if (data['노트']) {
                newContent += `## 노트\n${data['노트']}\n\n`;
            }
            
            // 파일 업데이트
            if (!dryRun) {
                await app.vault.modify(file, newContent);
            }
            
            console.log(`✅ [${i+1}/${files.length}] 변환 완료: ${file.name}`);
            converted++;
            
        } catch (error) {
            console.error(`❌ [${i+1}/${files.length}] 실패: ${file.name}`, error);
            failed++;
        }
        
        // 진행률
        if ((i + 1) % 10 === 0) {
            const percentage = Math.round(((i + 1) / files.length) * 100);
            console.log(`📊 진행률: ${percentage}%`);
        }
    }
    
    console.log('\n🎉 변환 완료!');
    console.log(`📊 결과:`);
    console.log(`  ✅ 변환됨: ${converted}개`);
    console.log(`  ⏭️  이미 변환됨: ${skipped}개`);
    console.log(`  ❌ 실패: ${failed}개`);
    console.log(`  📄 총: ${files.length}개`);
    
})();
