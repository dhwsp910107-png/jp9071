// 문제 파일을 frontmatter 형식으로 변환하는 스크립트
// Obsidian에서 Templater 또는 Custom JS로 실행

const fs = require('fs');
const path = require('path');

class QuestionConverter {
    constructor(app, vault) {
        this.app = app;
        this.vault = vault;
    }

    /**
     * 제목 형식의 문제 파일을 frontmatter 형식으로 변환
     */
    async convertQuestionFile(file) {
        try {
            const content = await this.vault.read(file);
            
            // 이미 frontmatter가 있는지 확인
            if (content.startsWith('---')) {
                console.log(`⏭️ 이미 변환됨: ${file.path}`);
                return { success: true, skipped: true };
            }

            // 제목 형식에서 데이터 추출
            const data = this.parseHeadingFormat(content);
            
            if (!data) {
                console.warn(`❌ 파싱 실패: ${file.path}`);
                return { success: false, error: 'Parse failed' };
            }

            // frontmatter 형식으로 변환
            const newContent = this.generateFrontmatterFormat(data);

            // 파일 업데이트
            await this.vault.modify(file, newContent);
            
            console.log(`✅ 변환 완료: ${file.path}`);
            return { success: true, converted: true };

        } catch (error) {
            console.error(`❌ 오류 발생: ${file.path}`, error);
            return { success: false, error: error.message };
        }
    }

    /**
     * 제목 형식(## 헤딩)에서 데이터 추출
     */
    parseHeadingFormat(content) {
        const lines = content.split('\n');
        const data = {
            title: '',
            hanzi: '',
            number: '',
            folder: '',
            question: '',
            options: [],
            optionImages: [],
            answer: '',
            hint: '',
            note: '',
            difficulty: '',
            bookmarked: false,
            correctCount: 0,
            wrongCount: 0
        };

        let currentSection = '';
        let currentContent = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // 제목 파싱
            if (line.startsWith('# ') && !line.startsWith('## ')) {
                data.title = line.substring(2).replace(' 문제', '').trim();
                continue;
            }

            // 섹션 헤딩 감지
            if (line.startsWith('## ')) {
                // 이전 섹션 저장
                if (currentSection && currentContent.length > 0) {
                    this.saveSection(data, currentSection, currentContent);
                }
                
                currentSection = line.substring(3).trim();
                currentContent = [];
                continue;
            }

            // 섹션 내용 수집
            if (currentSection && line) {
                currentContent.push(line);
            }
        }

        // 마지막 섹션 저장
        if (currentSection && currentContent.length > 0) {
            this.saveSection(data, currentSection, currentContent);
        }

        return data;
    }

    /**
     * 섹션별 데이터 저장
     */
    saveSection(data, section, content) {
        const text = content.join('\n').trim();

        switch (section) {
            case '한자':
                data.hanzi = text;
                break;
            case '번호':
                data.number = text;
                break;
            case '폴더':
                data.folder = text || '기본';
                break;
            case '문제':
                data.question = text;
                break;
            case '선택지':
                // "- 선택지1- 선택지2" 형식 파싱
                data.options = text
                    .split(/(?=-)/)
                    .map(opt => opt.replace(/^-\s*/, '').trim())
                    .filter(opt => opt.length > 0);
                break;
            case '선택지 이미지':
                // "1. [[이미지.png]]" 형식 파싱
                data.optionImages = content
                    .map(line => {
                        const match = line.match(/^\d+\.\s*(.+)/);
                        return match ? match[1].trim() : '';
                    });
                break;
            case '정답':
                data.answer = parseInt(text) || 0;
                break;
            case '힌트':
                data.hint = text;
                break;
            case '노트':
                data.note = text;
                break;
            case '난이도':
                data.difficulty = text || 'C';
                break;
            case '북마크':
                data.bookmarked = text.toLowerCase() === 'true' || text === '⭐';
                break;
            case '정답 횟수':
                data.correctCount = parseInt(text) || 0;
                break;
            case '오답 횟수':
                data.wrongCount = parseInt(text) || 0;
                break;
        }
    }

    /**
     * frontmatter 형식으로 생성
     */
    generateFrontmatterFormat(data) {
        let content = '---\n';
        
        // 필수 필드
        content += `hanzi: "${data.hanzi || data.title}"\n`;
        content += `number: ${data.number || 0}\n`;
        content += `folder: ${data.folder || '기본'}\n`;
        content += `question: "${this.escapeYaml(data.question)}"\n`;
        
        // 선택지
        if (data.options && data.options.length > 0) {
            content += `options:\n`;
            data.options.forEach(opt => {
                content += `  - "${this.escapeYaml(opt)}"\n`;
            });
        }

        // 선택지 이미지
        if (data.optionImages && data.optionImages.length > 0) {
            content += `optionImages:\n`;
            data.optionImages.forEach(img => {
                content += `  - "${this.escapeYaml(img)}"\n`;
            });
        }

        // 정답
        content += `answer: ${data.answer}\n`;

        // 힌트
        if (data.hint) {
            content += `hint: "${this.escapeYaml(data.hint)}"\n`;
        }

        // 노트
        if (data.note) {
            content += `note: "${this.escapeYaml(data.note)}"\n`;
        }

        // 난이도
        content += `difficulty: ${data.difficulty || 'C'}\n`;

        // 북마크
        content += `bookmarked: ${data.bookmarked}\n`;

        // 통계
        content += `correctCount: ${data.correctCount}\n`;
        content += `wrongCount: ${data.wrongCount}\n`;

        content += '---\n\n';

        // 본문 (선택적)
        content += `# ${data.hanzi || data.title} 문제\n\n`;
        content += `## 문제\n${data.question}\n\n`;

        if (data.options && data.options.length > 0) {
            content += `## 선택지\n`;
            data.options.forEach((opt, idx) => {
                content += `${idx + 1}. ${opt}\n`;
            });
            content += `\n`;
        }

        if (data.hint) {
            content += `## 힌트\n${data.hint}\n\n`;
        }

        if (data.note) {
            content += `## 노트\n${data.note}\n\n`;
        }

        return content;
    }

    /**
     * YAML 문자열 이스케이프
     */
    escapeYaml(str) {
        if (!str) return '';
        return str.replace(/"/g, '\\"').replace(/\n/g, '\\n');
    }

    /**
     * 폴더 내 모든 문제 파일 변환
     */
    async convertFolder(folderPath, dryRun = false) {
        const files = this.app.vault.getMarkdownFiles()
            .filter(f => f.path.startsWith(folderPath) && 
                         f.name.includes('_') && 
                         !f.name.includes('문제목록') &&
                         !f.name.includes('대시보드'));

        console.log(`📁 폴더: ${folderPath}`);
        console.log(`📄 총 ${files.length}개 파일 발견\n`);

        const results = {
            total: files.length,
            converted: 0,
            skipped: 0,
            failed: 0,
            errors: []
        };

        for (const file of files) {
            if (dryRun) {
                console.log(`[DRY RUN] ${file.path}`);
                continue;
            }

            const result = await this.convertQuestionFile(file);
            
            if (result.skipped) {
                results.skipped++;
            } else if (result.converted) {
                results.converted++;
            } else if (!result.success) {
                results.failed++;
                results.errors.push({ file: file.path, error: result.error });
            }

            // 진행률 표시
            const processed = results.converted + results.skipped + results.failed;
            const percentage = Math.round((processed / results.total) * 100);
            console.log(`진행률: ${percentage}% (${processed}/${results.total})`);
        }

        console.log('\n📊 변환 결과:');
        console.log(`✅ 변환됨: ${results.converted}개`);
        console.log(`⏭️ 이미 변환됨: ${results.skipped}개`);
        console.log(`❌ 실패: ${results.failed}개`);

        if (results.errors.length > 0) {
            console.log('\n❌ 실패한 파일:');
            results.errors.forEach(err => {
                console.log(`  - ${err.file}: ${err.error}`);
            });
        }

        return results;
    }
}

// Obsidian에서 실행하는 함수
async function convertAllQuestions(app, folderPath = 'HanziQuiz/Questions', dryRun = false) {
    const converter = new QuestionConverter(app, app.vault);
    
    if (dryRun) {
        console.log('⚠️ DRY RUN 모드 - 실제 변환은 수행되지 않습니다.\n');
    }

    // 하위 폴더 찾기
    const allFolders = [];
    const rootFolder = app.vault.getAbstractFileByPath(folderPath);
    
    if (!rootFolder) {
        console.error(`❌ 폴더를 찾을 수 없습니다: ${folderPath}`);
        return;
    }

    // 모든 하위 폴더 수집
    function collectFolders(folder) {
        if (folder.children) {
            folder.children.forEach(child => {
                if (child.children) { // 폴더인 경우
                    allFolders.push(child.path);
                    collectFolders(child);
                }
            });
        }
    }

    allFolders.push(folderPath);
    collectFolders(rootFolder);

    console.log(`📂 총 ${allFolders.length}개 폴더 발견\n`);

    // 각 폴더 변환
    const totalResults = {
        total: 0,
        converted: 0,
        skipped: 0,
        failed: 0
    };

    for (const folder of allFolders) {
        const result = await converter.convertFolder(folder, dryRun);
        totalResults.total += result.total;
        totalResults.converted += result.converted;
        totalResults.skipped += result.skipped;
        totalResults.failed += result.failed;
        console.log('---\n');
    }

    console.log('\n🎉 전체 변환 완료!');
    console.log(`📊 최종 결과:`);
    console.log(`  총 파일: ${totalResults.total}개`);
    console.log(`  ✅ 변환됨: ${totalResults.converted}개`);
    console.log(`  ⏭️ 이미 변환됨: ${totalResults.skipped}개`);
    console.log(`  ❌ 실패: ${totalResults.failed}개`);

    return totalResults;
}

// 사용 방법:
// 1. Obsidian 개발자 콘솔에서 실행:
//    convertAllQuestions(app, 'HanziQuiz/Questions', false)
// 
// 2. 특정 폴더만 변환:
//    convertAllQuestions(app, 'HanziQuiz/Questions/기본', false)
//
// 3. 테스트 실행 (실제 변환 안 함):
//    convertAllQuestions(app, 'HanziQuiz/Questions', true)

module.exports = { QuestionConverter, convertAllQuestions };
