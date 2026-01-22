"""
Anki Style Theme 자동 설정 스크립트
- CSS 스니펫 활성화
- 기본 설정 적용
- 모바일 최적화
"""

import json
import os

print("=" * 60)
print("🎨 Anki Style Theme 설정 중...")
print("=" * 60)

# appearance.json 읽기
appearance_path = '.obsidian/appearance.json'
try:
    with open(appearance_path, 'r', encoding='utf-8') as f:
        appearance = json.load(f)
except FileNotFoundError:
    appearance = {}

# CSS 스니펫 활성화
if 'cssTheme' not in appearance:
    appearance['cssTheme'] = ''

if 'enabledCssSnippets' not in appearance:
    appearance['enabledCssSnippets'] = []

# anki-style-theme 추가
if 'anki-style-theme' not in appearance['enabledCssSnippets']:
    appearance['enabledCssSnippets'].append('anki-style-theme')
    print("✅ anki-style-theme 스니펫 활성화됨")
else:
    print("ℹ️ anki-style-theme 이미 활성화되어 있음")

# 기본 설정 적용
appearance['baseFontSize'] = 16
appearance['textFontFamily'] = 'Noto Sans KR, Pretendard, -apple-system, sans-serif'
appearance['monospaceFontFamily'] = 'D2Coding, Fira Code, Consolas, monospace'

print("✅ 기본 폰트 설정 적용:")
print(f"  - 본문 폰트: {appearance['textFontFamily']}")
print(f"  - 코드 폰트: {appearance['monospaceFontFamily']}")
print(f"  - 기본 크기: {appearance['baseFontSize']}px")

# appearance.json 저장
with open(appearance_path, 'w', encoding='utf-8') as f:
    json.dump(appearance, f, indent=2, ensure_ascii=False)

print("\n✅ appearance.json 업데이트 완료!")

# Style Settings 플러그인 설정
style_settings_path = '.obsidian/plugins/obsidian-style-settings/data.json'
if os.path.exists(style_settings_path):
    try:
        with open(style_settings_path, 'r', encoding='utf-8') as f:
            style_settings = json.load(f)
    except:
        style_settings = {}
    
    # Anki Style Theme 기본 설정
    if 'anki-style-theme@@color-scheme' not in style_settings:
        style_settings['anki-style-theme@@color-scheme'] = 'anki-auto'
    
    if 'anki-style-theme@@font-size-base' not in style_settings:
        style_settings['anki-style-theme@@font-size-base'] = 16
    
    if 'anki-style-theme@@quiz-card-style' not in style_settings:
        style_settings['anki-style-theme@@quiz-card-style'] = True
    
    if 'anki-style-theme@@mobile-padding' not in style_settings:
        style_settings['anki-style-theme@@mobile-padding'] = 16
    
    if 'anki-style-theme@@button-min-height' not in style_settings:
        style_settings['anki-style-theme@@button-min-height'] = 44
    
    # 저장
    with open(style_settings_path, 'w', encoding='utf-8') as f:
        json.dump(style_settings, f, indent=2, ensure_ascii=False)
    
    print("✅ Style Settings 기본 설정 적용:")
    print("  - 색상 모드: 시스템 자동")
    print("  - 글자 크기: 16px")
    print("  - 퀴즈 카드 스타일: ON")
    print("  - 모바일 여백: 16px")
    print("  - 버튼 높이: 44px")
else:
    print("ℹ️ Style Settings 플러그인 데이터 없음 (처음 사용 시 자동 생성됨)")

print("\n" + "=" * 60)
print("🎯 설정 완료!")
print("=" * 60)
print("\n📱 적용 방법:")
print("  1. Obsidian 완전히 종료")
print("  2. Obsidian 재시작")
print("  3. 설정 → 외형 → CSS 스니펫 확인")
print("  4. 설정 → Style Settings → Anki Style Theme")
print("=" * 60)
print("\n💡 추가 커스터마이징:")
print("  - Style Settings에서 색상, 크기 조정")
print("  - 노트에 cssclasses: [anki-auto, quiz-card-style] 추가")
print("  - [🎨 테마 설정 가이드.md] 문서 참고")
print("=" * 60)
