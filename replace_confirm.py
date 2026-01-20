import re

# main.js 파일 읽기
with open('.obsidian/plugins/quiz-sp2/main.js', 'r', encoding='utf-8') as f:
    content = f.read()

# confirm() 패턴 매칭 및 교체
# 패턴: if (confirm('메시지')) { ... }
# 교체: new ConfirmModal(this.app, '메시지', (confirmed) => { if (confirmed) { ... } }).open();

# 1. if (confirm(...)) { ... } 패턴 찾기
pattern = r"if\s*\(confirm\((.*?)\)\)\s*\{(.*?)\}"

def replace_confirm(match):
    message = match.group(1)
    body = match.group(2).strip()
    
    # 들여쓰기 계산
    indent_match = re.search(r'\n(\s+)if\s*\(confirm', content[:match.start()])
    if indent_match:
        indent = indent_match.group(1)
    else:
        indent = '                    '
    
    # 본문 내용의 들여쓰기 증가
    body_lines = body.split('\n')
    indented_body = '\n'.join([indent + '    ' + line if line.strip() else line for line in body_lines])
    
    # 새로운 코드 생성
    new_code = f"""new ConfirmModal(this.app, {message}, (confirmed) => {{
{indent}    if (confirmed) {{
{indented_body}
{indent}    }}
{indent}}}).open();"""
    
    return new_code

# 여러 줄에 걸친 패턴 처리를 위해 DOTALL 플래그 사용
# 하지만 너무 많은 것을 매칭하지 않도록 간단한 구조만 처리

# 수동으로 각 라인 번호의 confirm() 교체
replacements = [
    (5112, 'dailyTemplates'),  # 이미 교체됨
    (5193, 'weeklyTemplates'),
    (5274, 'monthlyTemplates'),
    (5616, '학습기록삭제'),
    (5669, '기록삭제'),
    (5769, '모든학습기록삭제'),
    (5833, '학습기록삭제2'),
    (8551, '폴더변경확인'),
    (8589, '새폴더생성확인'),
    (9597, '폴더삭제'),
    (9981, '삭제확인'),
    (11630, '문제삭제'),
    (13054, '폴더삭제2'),
    (13785, '모든로그삭제'),
    (16394, '통계초기화'),
    (16416, '문제통계초기화'),
    (16903, '통계초기화2'),
    (17239, '학습기록초기화'),
    (17422, '학습기록삭제3'),
    (18807, '항목삭제'),
    (20089, '이미지삭제'),
]

print("confirm() 사용 위치를 확인합니다...")

# grep으로 찾은 실제 라인 번호들
lines_to_check = [5112, 5193, 5274, 5616, 5669, 5769, 5833, 8551, 8589, 9597, 
                  9981, 11630, 13054, 13785, 16394, 16416, 16903, 17239, 17422, 18807, 20089]

lines = content.split('\n')
confirm_count = 0

for line_num in lines_to_check:
    if line_num - 1 < len(lines):
        line = lines[line_num - 1]
        if 'confirm(' in line:
            confirm_count += 1
            print(f"Line {line_num}: {line.strip()[:100]}")

print(f"\n총 {confirm_count}개의 confirm() 호출 발견")
print("\n이 스크립트는 자동 교체를 수행하지 않습니다.")
print("각 confirm() 호출은 수동으로 검토하고 교체해야 합니다.")
print("예시:")
print("  if (confirm('삭제하시겠습니까?')) { ... }")
print("  →")
print("  new ConfirmModal(this.app, '삭제하시겠습니까?', (confirmed) => {")
print("      if (confirmed) { ... }")
print("  }).open();")
