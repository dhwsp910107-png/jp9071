# 이미지 빈칸 수정 가이드

## 문제점
1. MutationObserver가 제대로 작동하지 않아 이미지가 로드되지 않음
2. 반투명 처리가 불필요하게 복잡함
3. 일반 빈칸과 처리 방식이 달라서 혼란스러움

## 해결 방법

`processClozes` 함수에서 이미지 처리 부분을 다음과 같이 단순화:

```javascript
// 기존의 복잡한 MutationObserver 코드 전부 제거
// 대신 img 태그를 직접 찾아서 처리

const images = element.querySelectorAll('img');
images.forEach((img) => {
    const nextNode = img.nextSibling;
    if (nextNode && nextNode.nodeType === Node.TEXT_NODE) {
        const text = nextNode.textContent || '';
        const match = text.match(/^\{\{c(\d+)(?:::([^:}]+)(?:::([^}]+))?)?\}\}/);
        
        if (match) {
            const [fullMatch, clozeId, answer, hint] = match;
            
            // 이미지 빈칸 생성
            const clozeSpan = document.createElement('span');
            clozeSpan.className = 'genuine-cloze image-cloze';
            clozeSpan.setAttribute('data-show-state', 'hint');
            
            // wrapper 생성
            const wrapper = document.createElement('div');
            wrapper.className = 'image-cloze-wrapper';
            
            // 이미지 이동
            const imgClone = img.cloneNode(true);
            img.replaceWith(wrapper);
            clozeSpan.appendChild(imgClone);
            wrapper.appendChild(clozeSpan);
            
            // 초기 상태: 이미지 숨김 (반투명 없음)
            imgClone.style.display = 'none';
            
            // 플레이스홀더 생성
            const placeholder = document.createElement('div');
            placeholder.className = 'cloze-image-placeholder';
            placeholder.textContent = hint ? `[${hint}]` : '[?]';
            clozeSpan.insertBefore(placeholder, imgClone);
            
            // 클릭 이벤트: 일반 빈칸과 동일
            clozeSpan.onclick = () => {
                const state = clozeSpan.getAttribute('data-show-state');
                if (state === 'hint') {
                    // 빈칸 → 정답
                    clozeSpan.setAttribute('data-show-state', 'answer');
                    imgClone.style.display = 'block';
                    placeholder.style.display = 'none';
                } else {
                    // 정답 → 빈칸
                    clozeSpan.setAttribute('data-show-state', 'hint');
                    imgClone.style.display = 'none';
                    placeholder.style.display = 'flex';
                }
            };
            
            // 텍스트 노드에서 빈칸 태그 제거
            nextNode.textContent = text.replace(fullMatch, '');
        }
    }
});
```

## 주요 변경사항

1. **MutationObserver 제거** - 이미지가 이미 렌더링된 상태에서 처리
2. **반투명 효과 제거** - display: none/block으로 단순화
3. **일반 빈칸과 동일한 로직** - 상태 전환이 명확함

## 적용 방법

파일을 직접 수정하기보다는, 코드를 새로 작성하는 것이 안전합니다.
`processClozes` 함수의 2600~2900번 라인 부분을 위 코드로 교체하세요.
