# Study Dashboard - createProblemFile 함수 교체 가이드

## 🎯 목적
Study Dashboard에서 문제 생성 시 **코드블록 방식 타이머 템플릿** 사용

## 📝 수정 방법

Study Dashboard의 `main.js` 파일에서 `createProblemFile` 함수 내부의 `templateContent` 변수를 다음 내용으로 교체하세요:

```javascript
// 타이머 UI + 이미지 업로드 기능이 포함된 완전한 템플릿
let templateContent = `---
number: ${number}
title: "${title}"
subject: ${subject}
chapter: ""
source: ""
page: ""
concept-tags: []
status: learning
difficulty: ${difficulty}
reviewCount: 0
lastReview: ${today}
nextReview: ${nextDay}
created: ${today}
avgTime: 0
totalTime: 0
studyTime: 0
times: []
attempts: []
tags: [anki-card, ${subject}]
type: image-flashcard
---

# ${number}. ${title}

> 📚 **출처**: 교재  
> 📖 **단원**: ${subject}  
> ⭐ **난이도**: ${difficulty}/5

---

## ⏱️ 타이머

\`\`\`timer
duration: 300
\`\`\`

> 💡 **사용법**: 
> - ▶️ 시작: 문제 풀이 시작 시 클릭
> - ⏹️ 정지: 문제 풀이 완료 시 클릭 (자동으로 시간 기록됨)
> - 🔄 초기화: 타이머 초기화

---

## 📸 문제

\`\`\`image-button
문제
\`\`\`

---

## 💡 힌트

> [!hint]- 💡 힌트 보기
> 
> \`\`\`image-button
> 힌트
> \`\`\`
> 
> 여기에 힌트를 입력하세요

---

## ✅ 정답 및 풀이

> [!success]- 🔍 **답안 보기 (클릭 시 타이머 정지)**
> 
> \`\`\`image-button
> 정답
> \`\`\`
> 
> ---
> 
> ## 📚 사용된 개념
> 
> ### 핵심 개념
> - [[핵심개념1]]
> - [[핵심개념2]]
> - [[핵심개념3]]
> 
> ### 관련 공식
> \\\`\\\`\\\`
> 관련 공식
> \\\`\\\`\\\`

---

## 📊 풀이 기록

\\\`\\\`\\\`dataviewjs
const file = dv.current();

if (file.times && file.times.length > 0) {
    const times = file.times;
    const avgTime = Math.floor(times.reduce((a,b) => a+b, 0) / times.length);
    
    const formatTime = (seconds) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        if (h > 0) return \\\`\\\${h}시간 \\\${m}분 \\\${s}초\\\`;
        if (m > 0) return \\\`\\\${m}분 \\\${s}초\\\`;
        return \\\`\\\${s}초\\\`;
    };
    
    const lastTime = times[times.length - 1];
    
    dv.paragraph(\\\`
📊 **풀이 통계**
- 🔢 총 풀이 횟수: \\\${times.length}회
- ⏱️ 평균 시간: \\\${formatTime(avgTime)}
- 📅 최근 풀이: \\\${formatTime(lastTime)}
- 📈 총 학습 시간: \\\${formatTime(file.studyTime || 0)}

**전체 기록**: \\\${times.map(t => formatTime(t)).join(', ')}
    \\\`);
} else {
    dv.paragraph(\\\`
📊 **아직 풀이 기록이 없습니다.**
- 위의 타이머를 사용하여 문제를 풀어보세요!
    \\\`);
}
\\\`\\\`\\\`

---

## 📋 복습 기록

| 날짜 | 결과 | 시간 | 메모 |
|------|------|------|------|
| ${today} | ⬜ Again / ⬜ Hard / ⬜ Good / ⬜ Easy | - |  |

\\\`\\\`\\\`dataviewjs
const file = dv.current();
const bar = (val, max) => {
    const filled = Math.floor((val / max) * 20);
    return '█'.repeat(filled) + '░'.repeat(20 - filled);
};

dv.paragraph(\\\`
**복습 진행률**: \\\${bar(file.reviewCount, 10)} \\\${file.reviewCount}/10회
**상태**: \\\${file.status === 'learning' ? '🔴 학습중' : file.status === 'reviewing' ? '🟡 복습중' : '🟢 완전숙달'}
**총 학습시간**: \\\${Math.floor((file.totalTime || 0) / 60)}분 \\\${(file.totalTime || 0) % 60}초
\\\`);
\\\`\\\`\\\`

---

## 🔄 복습 일정

- [ ] 1차: ${nextDay} #복습
- [ ] 2차: ${new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0]} #복습  
- [ ] 3차: ${new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0]} #복습
- [ ] 4차: ${new Date(Date.now() + 86400000 * 14).toISOString().split('T')[0]} #복습
- [ ] 완전숙달: ${new Date(Date.now() + 86400000 * 30).toISOString().split('T')[0]} #복습

---

## 💭 학습 노트

### ⚠️ 주의할 점
- 

### 🔑 핵심 포인트
- 

---

*🎯 Timer Card + Study Dashboard 완전 연동!*
`;
```

## 🔧 적용 위치

`main.js` 파일에서 약 **80번째 줄 근처**에 있는 `createProblemFile` 함수 내부의 `let templateContent = ...` 부분을 찾아서 전체 교체하세요.

## ✅ 확인 사항

1. 백틱(`) 문자가 올바르게 escape 되었는지 확인
2. `${변수}` 형식이 유지되는지 확인
3. 코드블록은 \`\`\`timer와 \`\`\`image-button 형식 사용

## 🎯 결과

수정 후 Study Dashboard에서 문제를 생성하면:
- ✅ 코드블록 방식 타이머 (작동함!)
- ✅ 코드블록 방식 이미지 버튼 (작동함!)
- ✅ Study Dashboard와 완전 연동
- ✅ Frontmatter 자동 업데이트

---

*이 템플릿은 Timer Card v3.1과 완벽하게 호환됩니다!*
