---
type: dashboard
plugin: learning-strategy-planner
created: 2025-11-27
---

# 📊 Learning Strategy Planner 대시보드

## 플러그인 상태 확인

```dataviewjs
// 플러그인 로드 상태 확인
const plugin = app.plugins.plugins['learning-strategy-planner'];

if (!plugin) {
    dv.paragraph("❌ **플러그인이 로드되지 않음**");
    dv.paragraph("플러그인 폴더 확인 필요");
} else {
    dv.paragraph("✅ **플러그인 정상 로드됨**");
    
    // 설정 정보
    dv.header(3, "⚙️ 현재 설정");
    if (plugin.settings) {
        const settings = plugin.settings;
        dv.table(
            ["설정 항목", "값"],
            [
                ["학습 플랜 폴더", settings.learningFolder || "미설정"],
                ["북마크 폴더", settings.bookmarksFolder || "미설정"],
                ["기본 학습 기간", settings.defaultDuration + "일"],
                ["기본 수준", settings.defaultLevel],
                ["기본 일일 학습 시간", settings.defaultDailyTime + "분"],
                ["자동 저장", settings.autoSave ? "활성화" : "비활성화"],
                ["저장된 퀴즈 수", Object.keys(settings.quizzes || {}).length],
                ["북마크 수", (settings.bookmarks || []).length]
            ]
        );
    } else {
        dv.paragraph("⚠️ 설정 정보를 불러올 수 없음");
    }
    
    // 퀴즈 데이터
    dv.header(3, "📝 퀴즈 데이터");
    if (plugin.settings && plugin.settings.quizzes) {
        const quizzes = plugin.settings.quizzes;
        const quizCount = Object.keys(quizzes).length;
        
        if (quizCount === 0) {
            dv.paragraph("퀴즈가 아직 생성되지 않았습니다.");
        } else {
            dv.paragraph(`총 ${quizCount}개의 퀴즈 세트가 있습니다.`);
            
            const quizData = [];
            for (const [planId, questions] of Object.entries(quizzes)) {
                quizData.push([
                    planId,
                    questions.length,
                    questions[0]?.createdAt ? new Date(questions[0].createdAt).toLocaleDateString('ko-KR') : "N/A"
                ]);
            }
            
            dv.table(
                ["플랜 ID", "질문 수", "생성일"],
                quizData
            );
        }
    }
    
    // 북마크 데이터
    dv.header(3, "⭐ 북마크 데이터");
    if (plugin.settings && plugin.settings.bookmarks) {
        const bookmarks = plugin.settings.bookmarks;
        
        if (bookmarks.length === 0) {
            dv.paragraph("북마크가 없습니다.");
        } else {
            dv.paragraph(`총 ${bookmarks.length}개의 북마크가 있습니다.`);
            
            const bookmarkData = bookmarks.slice(0, 10).map(bm => [
                bm.quizSubject || "제목 없음",
                bm.question?.substring(0, 50) + "..." || "내용 없음",
                new Date(bm.timestamp).toLocaleDateString('ko-KR')
            ]);
            
            dv.table(
                ["주제", "질문", "북마크 날짜"],
                bookmarkData
            );
            
            if (bookmarks.length > 10) {
                dv.paragraph(`... 외 ${bookmarks.length - 10}개`);
            }
        }
    }
    
    // 뷰 등록 상태
    dv.header(3, "🖼️ 뷰 등록 상태");
    const leaves = app.workspace.getLeavesOfType('learning-planner-view');
    if (leaves.length > 0) {
        dv.paragraph(`✅ ${leaves.length}개의 뷰가 활성화되어 있습니다.`);
    } else {
        dv.paragraph("⚠️ 현재 활성화된 뷰가 없습니다.");
        dv.paragraph("Ribbon 아이콘을 클릭하거나 명령어 팔레트에서 '학습 전략 플래너 열기'를 실행하세요.");
    }
    
    // 명령어 등록 상태
    dv.header(3, "⚡ 등록된 명령어");
    const commands = [
        "open-learning-planner: 학습 전략 플래너 열기",
        "open-quiz-mode: 퀴즈 모드 열기",
        "open-quiz-creator: 퀴즈 만들기"
    ];
    dv.list(commands);
}
```

## 문제 진단

```dataviewjs
const plugin = app.plugins.plugins['learning-strategy-planner'];

dv.header(3, "🔍 자가 진단");

const diagnostics = [];

// 1. 플러그인 로드 확인
if (!plugin) {
    diagnostics.push("❌ 플러그인이 로드되지 않음 - manifest.json 확인 필요");
} else {
    diagnostics.push("✅ 플러그인 로드됨");
}

// 2. 설정 확인
if (plugin && !plugin.settings) {
    diagnostics.push("❌ 설정이 초기화되지 않음");
} else if (plugin) {
    diagnostics.push("✅ 설정 정상");
}

// 3. 뷰 등록 확인
try {
    const viewCreators = app.viewRegistry.viewByType;
    if (viewCreators && viewCreators['learning-planner-view']) {
        diagnostics.push("✅ 뷰 타입 등록됨");
    } else {
        diagnostics.push("❌ 뷰 타입이 등록되지 않음");
    }
} catch (e) {
    diagnostics.push("⚠️ 뷰 등록 상태 확인 불가");
}

// 4. 파일 구조 확인
const pluginPath = ".obsidian/plugins/learning-strategy-planner";
diagnostics.push(`📁 플러그인 경로: ${pluginPath}`);

dv.list(diagnostics);
```

## 빠른 실행

```dataviewjs
const plugin = app.plugins.plugins['learning-strategy-planner'];

if (plugin) {
    // 플러그인 열기 버튼
    const openBtn = dv.el("button", "🚀 학습 플래너 열기");
    openBtn.onclick = async () => {
        await plugin.activateView();
    };
    
    // 퀴즈 만들기 버튼
    const quizBtn = dv.el("button", "📝 퀴즈 만들기");
    quizBtn.onclick = () => {
        new (require('obsidian').Modal)(app).open();
    };
    
    // 설정 새로고침 버튼
    const refreshBtn = dv.el("button", "🔄 설정 새로고침");
    refreshBtn.onclick = async () => {
        await plugin.loadSettings();
        new (require('obsidian').Notice)("설정이 새로고침되었습니다!");
    };
} else {
    dv.paragraph("⚠️ 플러그인이 로드되지 않아 버튼을 사용할 수 없습니다.");
}
```

## 에러 로그 확인

콘솔에서 다음 명령어를 실행하여 에러를 확인하세요:

```javascript
// 개발자 도구 콘솔에서 실행
console.log(app.plugins.plugins['learning-strategy-planner']);
console.log(app.plugins.enabledPlugins);
```

---

**업데이트:** 2025-11-27  
**버전:** 1.0.0
