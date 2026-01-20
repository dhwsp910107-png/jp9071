---
created: 2025-10-28T17:08:34.407Z
tags: [dashboard, eisenhower, dataview]
title: Eisenhower Matrix Dashboard
---

# 📊 Eisenhower Matrix Dashboard

> 📅 생성일: 2025. 10. 29.  
> 🔄 자동 업데이트: DataviewJS

```dataviewjs
const eisenhowerFiles = dv.pages('"Eisenhower Matrix"')
    .where(p => p.file.name.includes("Eisenhower") || p.file.name.includes("eisenhower"));

const totalFiles = eisenhowerFiles.length;
const todayFiles = eisenhowerFiles.filter(p => 
    moment(p.file.ctime).format("YYYY-MM-DD") === moment().format("YYYY-MM-DD")
).length;

dv.header(2, "📈 전체 통계");
dv.table(["구분", "개수"], [
    ["📁 전체 파일", totalFiles],
    ["📅 오늘 생성", todayFiles],
    ["📝 최근 일주일", eisenhowerFiles.filter(p => 
        moment().diff(moment(p.file.ctime), 'days') <= 7
    ).length]
]);

dv.header(2, "🎯 최근 작업 파일");
const recentFiles = dv.pages('"Eisenhower Matrix"')
    .sort(p => p.file.mtime, "desc")
    .limit(15);

dv.table(["📄 파일명", "📅 수정일", "🕒 시간"], 
    recentFiles.map(p => [
        dv.fileLink(p.file.path, false, p.file.name),
        moment(p.file.mtime).format("MM-DD"),
        moment(p.file.mtime).format("HH:mm")
    ])
);
```

---
*📌 이 대시보드는 Eisenhower Matrix 플러그인에 의해 자동 생성됩니다.*
*🔄 최종 업데이트: 2025. 10. 29.*