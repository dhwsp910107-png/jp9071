---
tags:
  - 다이어리
cssclasses:
  - dashboard
  - homepage
title: <% tp.system.prompt("일정 제목") %>
start: <% tp.date.now("YYYY-MM-DDTHH:mm") %>
end: <% tp.date.now("YYYY-MM-DDTHH:mm", 60 * 60 * 1000) %>
aliases:
---


# {{date:YYYY년 MM월 DD일}} PDS 다이어리


## 🗓️ PLAN (계획)

### 오늘의 목표
```dataview
TASK
FROM "01.Diary"
WHERE file.name = this.file.name
WHERE contains(tags, "plan") AND !completed
SORT created asc
```

### 완료된 목표
```dataview
TASK
FROM "01.Diary"
WHERE file.name = this.file.name
WHERE contains(tags, "plan") AND completed
SORT completed desc
LIMIT 5
```

**진행률:**
```dataviewjs
if (dv.current().file) {
    let tasks = dv.current().file.tasks.where(t => t.tags.includes('plan'));
    let totalTasks = tasks.length;
    let completedTasks = tasks.where(t => t.completed).length;
    let progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    dv.paragraph(`![progress-bar](https://progress-bar.com/${progress})`);
    dv.paragraph(`${progress}% 완료`);
} else {
    dv.paragraph("진행률을 표시할 수 없습니다.");
}
```

---

## ✅ DO (실행한 일정 보기)

> Full Calendar에서 시각적으로 자동 표시됩니다.

---

## 🔍 SEE (회고)
-

### 내일의 개선점
-
