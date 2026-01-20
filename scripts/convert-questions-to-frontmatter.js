/**
 * 문제 파일을 헤더 형식에서 Frontmatter 형식으로 변환
 * 사용법: QuickAdd 또는 Templater로 실행
 */

module.exports = async function convertToFrontmatter(params) {
    const { app, quickAddApi } = params;
    
    // 변환할 폴더 선택
    const folder = await quickAddApi.suggester(
        ["기본", "한자", "어휘", "문법", "N1", "N3", "156", "1번방", "전체"],
        ["기본", "한자", "어휘", "문법", "N1", "N3", "156", "1번방", "all"]
    );
    
    if (!folder) {
        new Notice("❌ 폴더를 선택하지 않았습니다");
        return;
    }
    
    const basePath = "HanziQuiz/Questions";
    const targetPath = folder === "all" ? basePath : `${basePath}/${folder}`;
    
    // 대상 파일 찾기
    const files = app.vault.getMarkdownFiles().filter(file => {
        return file.path.startsWith(targetPath) && 
               file.name.includes("_") && 
               !file.name.includes("문제목록") &&
               !file.name.includes("대시보드");
    });
    
    if (files.length === 0) {
        new Notice(`📝 ${folder} 폴더에 변환할 파일이 없습니다`);
        return;
    }
    
    const confirm = await quickAddApi.yesNoPrompt(
        `${files.length}개 파일을 변환하시겠습니까?`
    );
    
    if (!confirm) {
        new Notice("❌ 변환 취소");
        return;
    }
    
    let converted = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const file of files) {
        try {
            const content = await app.vault.read(file);
            
            // 이미 frontmatter가 있으면 스킵
            if (content.trim().startsWith("---")) {
                skipped++;
                continue;
            }
            
            // 헤더에서 데이터 추출
            const data = parseHeaders(content);
            
            // frontmatter 생성
            const frontmatter = generateFrontmatter(data);
            
            // 새 콘텐츠 생성
            const newContent = frontmatter + "\n" + content;
            
            // 파일 업데이트
            await app.vault.modify(file, newContent);
            converted++;
            
        } catch (error) {
            console.error(`파일 변환 실패: ${file.path}`, error);
            errors++;
        }
    }
    
    new Notice(`✅ 변환 완료: ${converted}개 | ⏭️ 스킵: ${skipped}개 | ❌ 오류: ${errors}개`);
};

function parseHeaders(content) {
    const data = {
        hanzi: "",
        number: "",
        folder: "",
        question: "",
        options: [],
        answer: "",
        hint: "",
        note: "",
        difficulty: "C",
        wrongCount: 0,
        correctCount: 0,
        bookmarked: false,
        lastAttempt: null,
        keywords: []
    };
    
    const lines = content.split("\n");
    let currentSection = "";
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // 섹션 헤더 감지
        if (line.startsWith("## ")) {
            currentSection = line.substring(3).trim();
            continue;
        }
        
        // 섹션별 데이터 추출
        if (!line || line.startsWith("#")) continue;
        
        switch (currentSection) {
            case "한자":
                data.hanzi = line;
                break;
            case "번호":
                data.number = line;
                break;
            case "폴더":
                data.folder = line;
                break;
            case "문제":
                data.question = line;
                break;
            case "선택지":
                if (line.startsWith("-")) {
                    data.options.push(line.substring(1).trim());
                }
                break;
            case "정답":
                data.answer = line;
                break;
            case "힌트":
                data.hint = line;
                break;
            case "노트":
                data.note = line;
                break;
            case "난이도":
                data.difficulty = line || "C";
                break;
        }
    }
    
    return data;
}

function generateFrontmatter(data) {
    let fm = "---\n";
    fm += `hanzi: "${data.hanzi}"\n`;
    fm += `number: "${data.number}"\n`;
    fm += `folder: "${data.folder}"\n`;
    fm += `question: "${data.question.replace(/"/g, '\\"')}"\n`;
    fm += `difficulty: "${data.difficulty || 'C'}"\n`;
    fm += `wrongCount: ${data.wrongCount}\n`;
    fm += `correctCount: ${data.correctCount}\n`;
    fm += `bookmarked: ${data.bookmarked}\n`;
    fm += `lastAttempt: ${data.lastAttempt || 'null'}\n`;
    
    if (data.keywords && data.keywords.length > 0) {
        fm += `keywords:\n`;
        for (const kw of data.keywords) {
            fm += `  - "${kw}"\n`;
        }
    } else {
        fm += `keywords: []\n`;
    }
    
    fm += "---\n";
    return fm;
}
