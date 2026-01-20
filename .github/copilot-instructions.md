# AI Agent Instructions for 강의체크인

## Project Overview
This is an **Obsidian Vault** for multi-purpose learning management, combining:
- **Hanzi (Chinese Characters) Quiz System**: Problem bank with statistics, spaced repetition, and mobile support
- **Lecture Series Tracking**: Organizing educational content with progress tracking
- **Learning Dashboards**: DataviewJS-powered analytics and quick-action panels
- **Anki Integration**: Flashcard management with cloze deletions
- **Knowledge Organization**: PARA system (Projects, Areas, Resources, Archive)

## Architecture & Key Components

### 1. Plugin-Based Ecosystem
The vault leverages 40+ Obsidian plugins stored in `.obsidian/plugins/`. Critical plugins:
- **`quiz-sp2/`**: Main Hanzi quiz engine (v4.7.4) - handles questions, statistics, wrong answers
- **`dataview/`** & **`obsidian-dataview-master/`**: Powers dashboard queries and dynamic content
- **`learning-strategy-planner/`**: Advanced learning planning UI with modals and timer features
- **`study-dashboard/`**: Learning statistics aggregation and visualization
- **Python automation scripts**: Modify plugin source files (main.js) for custom behavior

### 2. Content Organization Structure
```
📊 대시보드/          → Analytics dashboards (메인 대시보드.md, 슈퍼허브 대시보드.md)
HanziQuiz/
  ├── Questions/     → Individual problem files by category (001번대, 100번대, etc.)
  ├── Results/       → Quiz session results
  ├── WrongAnswers/  → Automatic wrong answer collection
  └── dataviewjs.md  → Dashboard for quiz statistics
Anki-Cards-DB/       → Spaced repetition cards with cloze support
Learning/            → Timestamped learning session records
Templates/           → Reusable markdown templates
📅 학습일정/         → Weekly/monthly study schedules
```

### 3. Dashboard System
Dashboards use **DataviewJS** blocks embedded in markdown to:
- Query vault metadata (frontmatter tags, properties)
- Render interactive action cards with handlers
- Display learning statistics in real-time
- Execute Obsidian API commands via buttons

**Key pattern** in dashboards (see 메인 대시보드.md):
```javascript
// Action handler pattern
if (app?.commands) {
    app.commands.executeCommandById('plugin-id:command-name');
} else {
    // Fallback for mobile/limited environments
    new Notice('⚠️ Use Ctrl+P to run: command-name');
}
```

## Critical Development Workflows

### Modifying Plugin Behavior
The Python scripts (`*.py` files) automate plugin source modifications:
1. **Target file**: Usually `.obsidian/plugins/quiz-sp2/main.js` (thousands of lines)
2. **Pattern matching**: Use regex to locate insertion points by looking for surrounding code
3. **Example patterns**:
   - Convert `confirm()` dialogs to custom modals (`convert_confirm_check.py`)
   - Remove duplicate UI sections (`fix_duplicate.py`)
   - Add mobile touch handling (`add_mobile_support.py`)
4. **Execution**: Run `python script.py` to modify plugin; changes take effect on Obsidian reload

### Dashboard Customization
- Location: Files in `📊 대시보드/` folder
- Technology: Markdown + DataviewJS
- Template blocks in `Templates/` folder reference common patterns
- Mobile support: Use CSS media queries (`@media (max-width: 768px)`)

### Metadata Conventions
Vault relies on frontmatter properties:
- `cssclasses: [dashboard]` → Applies dashboard styling
- `created` → Timestamp for time-based queries
- `category` / `difficulty` → Used by DataviewJS filters
- `reviewed` → Spaced repetition tracking

## Project-Specific Patterns

### Learning Record Structure
Each learning session auto-saves to `Learning/` with timestamp in filename:
```markdown
학습_2025-12-15_1765830954105.md
```
Contains metadata about quiz performance, topics covered, and time spent.

### Problem Template Format
HanziQuiz problems follow strict format (see any `HanziQuiz/Questions/*/` file):
```markdown
# 干 문제

## 한자
干

## 번호
101

## 문제
干의 음과 뜻은?

## 선택지
- 간/방패 간
- ...

## 정답
0

## 힌트
힌트 텍스트
```
**Important**: Parser is strict about section headers and order. New problems via quiz-sp2 modal generate this format automatically.

### Mobile Optimization Strategy
- Touch events use `touchAction: 'manipulation'` (prevents 300ms tap delay)
- Tap highlight disabled: `webkitTapHighlightColor: 'rgba(0,0,0,0.1)'`
- Buttons include `user-select: none` to prevent accidental selection
- Responsive grid: `grid-template-columns: repeat(auto-fit, minmax(200px, 1fr))`

## Integration Points & Cross-Component Communication

### Plugin → Vault Data Flow
1. Quiz results → Auto-saved to `HanziQuiz/Results/`
2. Wrong answers → Collected in `HanziQuiz/WrongAnswers/`
3. Statistics → Aggregated by DataviewJS queries in dashboards
4. Learning history → Timestamped files in `Learning/` folder

### Dashboard → Plugin Command Execution
Dashboards trigger plugin commands via Obsidian API:
```javascript
app.commands.executeCommandById('plugin-id:command-id');
```
Common commands: `smart-lecture-tracker:create-lecture-series`, `create-note`, etc.

## Debugging & Validation Checklist

When implementing changes:
- [ ] **JavaScript/regex edits**: Verify changes in `.obsidian/plugins/quiz-sp2/main.js` by checking line counts before/after
- [ ] **DataviewJS**: Test queries in sandbox by temporarily adding `dv.span()` output
- [ ] **Problem creation**: Validate new HanziQuiz entries match exact template format
- [ ] **Mobile testing**: Use browser DevTools mobile emulation or test on Android/iOS
- [ ] **Metadata**: Confirm frontmatter syntax (YAML) with valid indentation
- [ ] **Plugin reloads**: Close and reopen Obsidian, not just refresh vault

## Files to Reference When Developing

| File/Folder | Purpose |
|---|---|
| [메인 대시보드.md](../📊%20대시보드/메인%20대시보드.md) | Main ActionCard pattern and DataviewJS structure |
| [quiz-sp2/README.md](../.obsidian/plugins/quiz-sp2/README.md) | Plugin feature docs and folder configuration |
| [convert_confirm_check.py](../convert_confirm_check.py) | Example of main.js modal pattern conversion |
| [HanziQuiz/](../HanziQuiz) | Problem bank structure and query examples |
| [Templates/](../Templates) | Reusable dashboard and card templates |

## Korean Language & Regional Conventions

- Filenames and folder names use Korean characters (expected, not a bug)
- UI text: Buttons, titles use Korean
- Comments in Python scripts: Korean explanations of modifications
- Time format: `YYYY-MM-DD HH:MM:SS` in created/modified timestamps
- Console messages: Korean (`✅ 완료!`, `❌ 오류`)
