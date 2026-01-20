# 🎴 Anki Cards Dashboard

> **📊 실시간 학습 통계와 진행 상황을 확인하세요**

## 📈 전체 통계

```dataviewjs
// Anki Cards 플러그인에서 통계 데이터 가져오기
const plugin = this.app.plugins.plugins['anki-cards'];
if (plugin) {
    const stats = await plugin.getAnkiStatsForDataview();
    if (stats) {
        dv.header(2, "📊 학습 현황");
        
        // 전체 현황 테이블
        dv.table(
            ["구분", "개수", "비율"],
            [
                ["📚 총 카드", stats.total, "100%"],
                ["🆕 신규 카드", stats.byStatus['신규카드'], `${Math.round(stats.byStatus['신규카드']/stats.total*100)}%`],
                ["📖 학습 중", stats.byStatus['학습중'], `${Math.round(stats.byStatus['학습중']/stats.total*100)}%`],
                ["🔄 복습 중", stats.byStatus['복습중'], `${Math.round(stats.byStatus['복습중']/stats.total*100)}%`],
                ["✅ 완료", stats.byStatus['완료'], `${Math.round(stats.byStatus['완료']/stats.total*100)}%`]
            ]
        );
        
        // 오늘/이번주 생성 카드
        dv.header(3, "⏰ 최근 활동");
        dv.paragraph(`📅 오늘 생성: **${stats.todayCards}개**`);
        dv.paragraph(`📆 이번주 생성: **${stats.weekCards}개**`);
        
        // 과목별 현황
        if (Object.keys(stats.bySubject).length > 0) {
            dv.header(3, "📚 과목별 현황");
            const subjectData = Object.entries(stats.bySubject)
                .map(([subject, count]) => [subject, count, `${Math.round(count/stats.total*100)}%`])
                .sort((a, b) => b[1] - a[1]);
            dv.table(["과목", "카드 수", "비율"], subjectData);
        }
        
        // 레벨별 현황
        if (Object.keys(stats.byLevel).length > 0) {
            dv.header(3, "⭐ 난이도별 현황");
            const levelData = Object.entries(stats.byLevel)
                .map(([level, count]) => [
                    `레벨 ${level}`, 
                    count, 
                    "⭐".repeat(Math.min(parseInt(level) || 1, 5))
                ])
                .sort((a, b) => parseInt(a[0].split(' ')[1]) - parseInt(b[0].split(' ')[1]));
            dv.table(["난이도", "카드 수", "별점"], levelData);
        }
    } else {
        dv.paragraph("⚠️ 통계 데이터를 가져올 수 없습니다.");
    }
} else {
    dv.paragraph("❌ Anki Cards 플러그인을 찾을 수 없습니다.");
}
```

## 🆕 최근 생성된 카드

```dataviewjs
const plugin = this.app.plugins.plugins['anki-cards'];
if (plugin) {
    const cards = await plugin.getAnkiCardsForDataview();
    const recentCards = cards
        .sort((a, b) => b.created - a.created)
        .slice(0, 10);
    
    if (recentCards.length > 0) {
        dv.table(
            ["카드", "과목", "레벨", "상태", "생성일"],
            recentCards.map(card => [
                dv.fileLink(card.path, false, card.name),
                card.data.과목 || "미분류",
                "⭐".repeat(Math.min(parseInt(card.data.레벨) || 1, 5)),
                card.status,
                card.created.toLocaleDateString()
            ])
        );
    } else {
        dv.paragraph("생성된 카드가 없습니다.");
    }
}
```

## 📖 학습 중인 카드

```dataviewjs
const plugin = this.app.plugins.plugins['anki-cards'];
if (plugin) {
    const studyingCards = await plugin.getAnkiCardsForDataview({status: '학습중'});
    
    if (studyingCards.length > 0) {
        dv.table(
            ["카드", "과목", "레벨", "수정일"],
            studyingCards
                .sort((a, b) => b.modified - a.modified)
                .slice(0, 15)
                .map(card => [
                    dv.fileLink(card.path, false, card.name),
                    card.data.과목 || "미분류",
                    "⭐".repeat(Math.min(parseInt(card.data.레벨) || 1, 5)),
                    card.modified.toLocaleDateString()
                ])
        );
    } else {
        dv.paragraph("현재 학습 중인 카드가 없습니다.");
    }
}
```

## 🔄 복습이 필요한 카드

```dataviewjs
const plugin = this.app.plugins.plugins['anki-cards'];
if (plugin) {
    const reviewCards = await plugin.getAnkiCardsForDataview({status: '복습중'});
    
    if (reviewCards.length > 0) {
        dv.table(
            ["카드", "과목", "레벨", "마지막 수정"],
            reviewCards
                .sort((a, b) => a.modified - b.modified) // 가장 오래된 것부터
                .slice(0, 10)
                .map(card => [
                    dv.fileLink(card.path, false, card.name),
                    card.data.과목 || "미분류",
                    "⭐".repeat(Math.min(parseInt(card.data.레벨) || 1, 5)),
                    card.modified.toLocaleDateString()
                ])
        );
    } else {
        dv.paragraph("복습이 필요한 카드가 없습니다.");
    }
}
```

## 🚀 빠른 작업

- [[Anki-Cards-DB/01-신규카드/|📂 신규 카드 폴더]]
- [[Anki-Cards-DB/02-학습중/|📖 학습 중 폴더]]
- [[Anki-Cards-DB/03-복습중/|🔄 복습 중 폴더]]
- [[Anki-Cards-DB/04-완료/|✅ 완료 폴더]]

### 명령어 (Ctrl+P)
- `Anki Cards: Create Basic Card` - 기본 카드 생성
- `Anki Cards: Create Cloze Card` - 클로즈 카드 생성
- `Anki Cards: Open Database Manager` - DB 관리
- `Anki Cards: Update Dashboard` - 대시보드 새로고침

---
*마지막 업데이트: 2025. 10. 31. 오후 12:24:21*
