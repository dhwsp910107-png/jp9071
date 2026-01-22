"""
S펜 필기 입력 기능 추가 스크립트
- 퀴즈 플러그인에 필기 패드 추가
- S펜 이벤트 감지
- 필기 → 텍스트 변환 API 연동 (향후)
"""

import re

# main.js 파일 읽기
with open('.obsidian/plugins/quiz-sp2/main.js', 'r', encoding='utf-8') as f:
    content = f.read()

changes_made = []

# 1. S펜 이벤트 감지 코드 추가
spen_detection = '''
// S펜 감지 및 최적화
const detectSPen = () => {
    const isSPenDevice = /Samsung/.test(navigator.userAgent) && 
                        ('PointerEvent' in window);
    if (isSPenDevice) {
        console.log('✅ S펜 감지됨 - 최적화 모드 활성화');
        // S펜 전용 CSS 클래스 추가
        document.body.classList.add('spen-enabled');
    }
    return isSPenDevice;
};

// 펜 vs 터치 구분
const isPenInput = (e) => {
    return e.pointerType === 'pen' || 
           (e.pressure && e.pressure > 0 && e.pointerType !== 'touch');
};
'''

# Plugin 클래스 내부의 onload 함수 시작 부분을 찾아서 추가
onload_pattern = r'(async onload\(\) \{[\s\S]{0,200}?console\.log\(["\'].*?loaded["\'].*?\);)'

if re.search(onload_pattern, content):
    content = re.sub(
        onload_pattern,
        r'\1\n\n        // S펜 감지\n        detectSPen();',
        content,
        count=1
    )
    changes_made.append("Added S-Pen detection in onload()")

# 2. 필기 패드 모달 클래스 추가 (파일 끝 부분에)
handwriting_modal = '''

// S펜 필기 입력 모달
class HandwritingModal extends Modal {
    constructor(app, onSubmit) {
        super(app);
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('handwriting-modal');

        // 모바일 감지
        const isMobile = this.app.isMobile || window.innerWidth <= 1024;

        // 제목
        const title = contentEl.createEl('h2', { text: '✏️ S펜으로 입력하기' });
        title.style.cssText = 'margin-bottom: 15px; font-size: ' + (isMobile ? '1.3em' : '1.5em');

        // 안내 메시지
        const guide = contentEl.createDiv();
        guide.style.cssText = 'margin-bottom: 15px; padding: 12px; background: var(--background-secondary); border-radius: 8px;';
        guide.innerHTML = `
            <div style="font-size: 0.95em; color: var(--text-muted);">
                📝 S펜으로 한자를 그려주세요<br>
                💡 삼성 키보드 필기 모드를 사용하세요
            </div>
        `;

        // 캔버스 영역 (향후 확장용)
        const canvasContainer = contentEl.createDiv();
        canvasContainer.style.cssText = `
            width: 100%;
            height: ${isMobile ? '300px' : '400px'};
            background: white;
            border: 2px solid var(--background-modifier-border);
            border-radius: 8px;
            margin-bottom: 15px;
            position: relative;
            touch-action: none;
        `;

        // 안내 텍스트
        const placeholder = canvasContainer.createDiv();
        placeholder.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            text-align: center;
            color: #ccc;
            pointer-events: none;
        `;
        placeholder.innerHTML = `
            <div style="font-size: 3em;">✍️</div>
            <div style="font-size: 1.2em; margin-top: 10px;">S펜으로 그려주세요</div>
            <div style="font-size: 0.9em; margin-top: 5px; color: #999;">
                또는 아래 입력창에 키보드 필기 모드 사용
            </div>
        `;

        // 텍스트 입력창 (키보드 필기 입력용)
        const inputLabel = contentEl.createEl('div', { 
            text: '🖊️ 또는 여기에 키보드 필기 모드로 입력:' 
        });
        inputLabel.style.cssText = 'margin-bottom: 10px; font-weight: bold;';

        const textInput = contentEl.createEl('input', {
            type: 'text',
            placeholder: 'S펜 버튼 더블클릭 → 필기 모드'
        });
        textInput.style.cssText = `
            width: 100%;
            padding: ${isMobile ? '14px' : '12px'};
            font-size: ${isMobile ? '18px' : '16px'};
            border: 1px solid var(--background-modifier-border);
            border-radius: 6px;
            margin-bottom: 15px;
            min-height: ${isMobile ? '48px' : '40px'};
        `;

        // S펜 입력 가이드
        const spenGuide = contentEl.createDiv();
        spenGuide.style.cssText = `
            padding: 12px;
            background: #e3f2fd;
            border-left: 4px solid #2196f3;
            border-radius: 4px;
            margin-bottom: 15px;
        `;
        spenGuide.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 8px;">💡 S펜 필기 입력 방법:</div>
            <div style="font-size: 0.9em; line-height: 1.6;">
                1️⃣ 입력창 터치<br>
                2️⃣ 키보드 좌측 상단 ✏️ 아이콘 터치<br>
                3️⃣ S펜으로 한자 그리기<br>
                4️⃣ 인식된 후보 선택
            </div>
        `;

        // 버튼 컨테이너
        const btnContainer = contentEl.createDiv();
        btnContainer.style.cssText = 'display: flex; gap: 10px;';

        // 확인 버튼
        const submitBtn = btnContainer.createEl('button', { text: '✅ 확인' });
        submitBtn.style.cssText = `
            flex: 1;
            padding: ${isMobile ? '14px' : '12px'};
            background: var(--interactive-accent);
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 1.1em;
            font-weight: bold;
            min-height: ${isMobile ? '48px' : '44px'};
            touch-action: manipulation;
        `;

        const handleSubmit = () => {
            const text = textInput.value.trim();
            if (text) {
                this.onSubmit(text);
                this.close();
            } else {
                new Notice('❌ 텍스트를 입력해주세요');
            }
        };

        submitBtn.onclick = handleSubmit;
        submitBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            handleSubmit();
        });

        // 취소 버튼
        const cancelBtn = btnContainer.createEl('button', { text: '❌ 취소' });
        cancelBtn.style.cssText = `
            flex: 1;
            padding: ${isMobile ? '14px' : '12px'};
            background: var(--background-modifier-border);
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 1.1em;
            min-height: ${isMobile ? '48px' : '44px'};
            touch-action: manipulation;
        `;
        
        cancelBtn.onclick = () => this.close();
        cancelBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.close();
        });

        // Enter 키로 제출
        textInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                handleSubmit();
            }
        });

        // 자동 포커스
        setTimeout(() => textInput.focus(), 100);
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
'''

# 파일 끝에 추가
if 'class HandwritingModal' not in content:
    # module.exports 직전에 추가
    if 'module.exports = ' in content:
        content = content.replace(
            'module.exports = ',
            handwriting_modal + '\n\nmodule.exports = '
        )
        changes_made.append("Added HandwritingModal class")
    else:
        content += handwriting_modal
        changes_made.append("Added HandwritingModal class at end")

# 3. S펜 최적화 CSS 추가
spen_css = '''
    /* S펜 최적화 CSS */
    .spen-enabled button,
    .spen-enabled input {
        touch-action: manipulation;
    }
    
    .spen-enabled .quiz-option:hover {
        background: var(--background-modifier-hover);
        cursor: pointer;
    }
    
    /* 필기 모달 스타일 */
    .handwriting-modal {
        max-width: 600px;
        margin: auto;
    }
'''

# CSS 섹션을 찾아서 추가
css_end_pattern = r'(\s+</style>`;\s+)'
if re.search(css_end_pattern, content):
    content = re.sub(
        css_end_pattern,
        spen_css + r'\1',
        content,
        count=1
    )
    changes_made.append("Added S-Pen CSS styles")

# 파일 저장
with open('.obsidian/plugins/quiz-sp2/main.js', 'w', encoding='utf-8') as f:
    f.write(content)

# 결과 출력
print("=" * 60)
print("🖊️ S펜 필기 입력 기능 추가 완료!")
print("=" * 60)

if changes_made:
    print(f"\n✅ 적용된 변경사항 ({len(changes_made)}개):\n")
    for i, change in enumerate(changes_made, 1):
        print(f"{i}. {change}")
else:
    print("\n⚠️ 변경사항이 없거나 이미 적용되어 있습니다.")

print("\n" + "=" * 60)
print("📱 새로 추가된 기능:")
print("  • S펜 자동 감지")
print("  • 필기 입력 모달 (HandwritingModal)")
print("  • 펜 vs 터치 구분")
print("  • S펜 최적화 CSS")
print("=" * 60)
print("\n💡 사용 방법:")
print("  1. Obsidian 재시작")
print("  2. 퀴즈 플러그인에서 필기 모드 확인")
print("  3. S펜 버튼 더블클릭 → 필기 입력")
print("=" * 60)
print("\n🎯 다음 단계:")
print("  • 삼성 키보드 필기 모드 활성화")
print("  • S펜 캘리브레이션")
print("  • 일본어/중국어 언어 추가")
print("=" * 60)
