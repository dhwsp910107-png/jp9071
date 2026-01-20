# 🚀 Obsidian 콘솔에서 실행하세요

이 스크립트는 **Obsidian 개발자 콘솔**에서 실행해야 합니다.

## 실행 방법

### 1단계: 개발자 도구 열기
- **Windows**: `Ctrl + Shift + I`
- **Mac**: `Cmd + Option + I`

### 2단계: Console 탭 클릭

### 3단계: 아래 코드 전체 복사해서 붙여넣기

```javascript
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
```

### 4단계: Enter 키 누르기

### 5단계: 결과 확인

콘솔에 다음과 같은 결과가 표시됩니다:
```
🚀 문제 파일 변환 시작...
📄 총 70개 파일 발견
🔄 실제 변환 모드

✅ [1/70] 변환 완료: 1_fg.md
✅ [2/70] 변환 완료: 2_託.md
...
📊 진행률: 100% (70/70) - 5초 경과

🎉 변환 완료!
==================================================
📊 결과:
  ✅ 변환됨: 70개
  ⏭️  이미 변환됨: 0개
  ❌ 실패: 0개
  📄 총: 70개
  ⏱️  소요 시간: 5초
==================================================

✨ 이제 Obsidian을 리로드하세요: Ctrl+R
📋 문제목록 페이지를 열어서 DataviewJS가 작동하는지 확인하세요!
```

## ⚙️ 설정 변경

### 다른 폴더 변환
코드 6번째 줄 수정:
```javascript
const folderPath = 'HanziQuiz/Questions/100번대 독음_복사본'; // 원하는 폴더로 변경
```

### 테스트 모드
코드 7번째 줄 수정:
```javascript
const dryRun = true; // 실제 변환하지 않고 테스트만
```

## ⚠️ 주의사항

1. **백업**: 중요한 경우 파일 백업 권장
2. **테스트**: 처음엔 `dryRun = true`로 테스트
3. **리로드**: 변환 후 반드시 `Ctrl+R`로 Obsidian 리로드

## 📞 문제 발생 시

- 콘솔 오류 메시지 확인
- 실패한 파일명 확인
- 해당 파일 수동으로 열어서 형식 확인

---

**준비됐으면 위 코드를 복사해서 Obsidian 콘솔에 붙여넣으세요!** 🚀
