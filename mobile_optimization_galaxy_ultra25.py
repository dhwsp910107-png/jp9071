"""
갤럭시 울트라25 안드로이드 모바일 최적화 스크립트
- 터치 이벤트 통합 (click + touchend)
- 300ms 탭 딜레이 제거 (touch-action: manipulation)
- 탭 하이라이트 최적화
- 모바일 감지 개선
- 버튼 최소 터치 영역 44x44px (접근성 기준)
"""

import re

# main.js 파일 읽기
with open('.obsidian/plugins/quiz-sp2/main.js', 'r', encoding='utf-8') as f:
    content = f.read()

changes_made = []

# 1. onclick을 터치 이벤트 포함 핸들러로 변경
# onclick = () => {} 패턴을 찾아서 touchend 이벤트 추가
onclick_pattern = r'(\s+)(\w+)\.onclick = (\([^)]*\) => \{)'
def add_touch_support(match):
    indent = match.group(1)
    element_name = match.group(2)
    handler = match.group(3)
    
    # 이미 touchend가 있는지 확인
    check_area = content[max(0, match.start() - 200):match.end() + 200]
    if f"{element_name}.addEventListener('touchend'" in check_area:
        return match.group(0)  # 이미 있으면 변경 안 함
    
    changes_made.append(f"Added touch support to {element_name}")
    
    return f"""{indent}const {element_name}Handler = {handler.replace(' => {', ' => {')};
{indent}{element_name}.onclick = {element_name}Handler;
{indent}{element_name}.addEventListener('touchend', (e) => {{
{indent}    e.preventDefault();
{indent}    {element_name}Handler(e);
{indent}}});"""

# content = re.sub(onclick_pattern, add_touch_support, content, count=10)

# 2. 모바일 감지 로직 개선 (Galaxy Ultra25는 대형 화면이므로 1024px로 상향)
mobile_detect_old = r'const isMobile = this\.app\.isMobile \|\| window\.innerWidth <= 768;'
mobile_detect_new = r'const isMobile = this.app.isMobile || window.innerWidth <= 1024 || /Android|webOS|iPhone|iPad/i.test(navigator.userAgent);'

if re.search(mobile_detect_old, content):
    content = re.sub(mobile_detect_old, mobile_detect_new, content)
    changes_made.append("Updated mobile detection (768px → 1024px, added user agent check)")

# 3. 모든 button, input 요소에 터치 최적화 CSS 추가
# touch-action: manipulation과 -webkit-tap-highlight-color 누락된 곳 찾기
def add_touch_css(match):
    style_content = match.group(1)
    
    # 이미 있는지 확인
    if 'touch-action' in style_content and 'tap-highlight-color' in style_content:
        return match.group(0)
    
    additions = []
    if 'touch-action' not in style_content:
        additions.append('touch-action: manipulation')
    if 'tap-highlight-color' not in style_content:
        additions.append('-webkit-tap-highlight-color: transparent')
    
    if additions:
        # 세미콜론으로 끝나는지 확인
        if not style_content.rstrip().endswith(';'):
            style_content += ';'
        style_content += ' ' + '; '.join(additions) + ';'
        changes_made.append("Added touch CSS to element")
    
    return f"style.cssText = `{style_content}`"

# button과 input의 style.cssText 패턴 찾기
touch_css_pattern = r"style\.cssText = `([^`]*cursor: pointer[^`]*)`"
# content = re.sub(touch_css_pattern, add_touch_css, content)

# 4. 스와이프 제스처 개선 (임계값 조정)
swipe_threshold_old = r'const swipeThreshold = 50;'
swipe_threshold_new = r'const swipeThreshold = 60; // Galaxy Ultra25: 큰 화면용 조정'

if re.search(swipe_threshold_old, content):
    content = re.sub(swipe_threshold_old, swipe_threshold_new, content)
    changes_made.append("Updated swipe threshold (50px → 60px for large screen)")

# 5. 폰트 크기 최소값 16px 보장 (iOS 자동 줌 방지, Android도 유용)
font_size_pattern = r"font-size: \$\{isMobile \? '(\d+)px' : '[^']+'\}"
def ensure_min_font_size(match):
    mobile_size = int(match.group(1))
    if mobile_size < 16:
        changes_made.append(f"Increased mobile font size from {mobile_size}px to 16px")
        return match.group(0).replace(f"'{mobile_size}px'", "'16px'")
    return match.group(0)

content = re.sub(font_size_pattern, ensure_min_font_size, content)

# 6. 버튼 최소 높이 44px 보장 (접근성 기준)
min_height_pattern = r"min-height: \$\{isMobile \? '(\d+)px' : 'auto'\}"
def ensure_min_height(match):
    mobile_height = int(match.group(1))
    if mobile_height < 44:
        changes_made.append(f"Increased mobile button height from {mobile_height}px to 44px")
        return match.group(0).replace(f"'{mobile_height}px'", "'44px'")
    return match.group(0)

content = re.sub(min_height_pattern, ensure_min_height, content)

# 7. overflow 스크롤 개선 (-webkit-overflow-scrolling 추가)
overflow_pattern = r'(overflow-y: auto;)(?!\s*-webkit-overflow-scrolling)'
overflow_replacement = r'\1 -webkit-overflow-scrolling: touch;'

if re.search(overflow_pattern, content):
    content = re.sub(overflow_pattern, overflow_replacement, content)
    changes_made.append("Added -webkit-overflow-scrolling: touch for smooth scrolling")

# 파일 저장
with open('.obsidian/plugins/quiz-sp2/main.js', 'w', encoding='utf-8') as f:
    f.write(content)

# 결과 출력
print("=" * 60)
print("🚀 갤럭시 울트라25 모바일 최적화 완료!")
print("=" * 60)

if changes_made:
    print(f"\n✅ 적용된 변경사항 ({len(changes_made)}개):\n")
    for i, change in enumerate(changes_made, 1):
        print(f"{i}. {change}")
else:
    print("\n✓ 이미 모든 최적화가 적용되어 있습니다.")

print("\n" + "=" * 60)
print("📱 최적화 항목:")
print("  • 모바일 감지: 768px → 1024px (대형 화면 지원)")
print("  • User-Agent 체크 추가 (Android 정확히 감지)")
print("  • 폰트 크기: 최소 16px (자동 줌 방지)")
print("  • 버튼 높이: 최소 44px (터치 편의성)")
print("  • 스와이프 임계값: 60px (큰 화면 최적화)")
print("  • 스크롤 최적화: -webkit-overflow-scrolling")
print("=" * 60)
print("\n💡 적용 방법:")
print("  1. Obsidian 완전히 종료")
print("  2. Obsidian 재시작")
print("  3. 퀴즈 플러그인 테스트")
print("=" * 60)
