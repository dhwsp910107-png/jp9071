import re

# main.js 파일 읽기
with open('.obsidian/plugins/quiz-sp2/main.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# 교체할 라인 번호들 (1-based index)
confirm_lines = [
    5195,  # 주간 템플릿 삭제
    5276,  # 월간 템플릿 삭제
    5618,  # 폴더 학습 기록 삭제
    5671,  # 기록 삭제
    5771,  # 모든 학습 기록 삭제
    5835,  # 학습 기록 삭제
    8553,  # 폴더 변경 확인
    8591,  # 새 폴더 생성 확인
    9599,  # 폴더 삭제
    13056, # 폴더 삭제2
    13787, # 모든 로그 삭제
    16396, # 통계 초기화
    16418, # 문제 통계 초기화
    16905, # 문제 통계 초기화2
    17241, # 학습 기록 초기화
    17424, # 학습 기록 삭제3
    18809, # 항목 삭제
    20827, # 템플릿 삭제 (ChecklistTemplateModal)
]

# 각 confirm() 라인을 찾아서 변환
def convert_confirm_line(line_num):
    """주어진 라인의 confirm() 호출을 ConfirmModal로 변환"""
    if line_num > len(lines):
        return None
    
    # 0-based index
    idx = line_num - 1
    line = lines[idx]
    
    # 들여쓰기 추출
    indent_match = re.match(r'^(\s*)', line)
    indent = indent_match.group(1) if indent_match else ''
    
    # confirm() 메시지 추출
    confirm_match = re.search(r'if\s*\(confirm\((.*?)\)\)', line)
    if not confirm_match:
        return None
    
    message = confirm_match.group(1)
    
    # 다음 라인들에서 중괄호 블록 찾기
    brace_count = 0
    block_lines = []
    found_opening = False
    
    # 현재 라인에서 시작
    for i in range(idx, min(idx + 50, len(lines))):  # 최대 50줄까지만 검색
        current_line = lines[i]
        
        if i == idx:
            # 첫 라인: { 찾기
            if '{' in current_line:
                found_opening = True
                brace_count += current_line.count('{') - current_line.count('}')
                # { 이후의 내용만 추출
                after_brace = current_line.split('{', 1)[1]
                if after_brace.strip():
                    block_lines.append(after_brace.rstrip('\n'))
        else:
            brace_count += current_line.count('{') - current_line.count('}')
            block_lines.append(current_line.rstrip('\n'))
            
        if found_opening and brace_count == 0:
            # 마지막 라인에서 } 제거
            if block_lines and block_lines[-1].strip().endswith('}'):
                last_line = block_lines[-1]
                block_lines[-1] = last_line[:last_line.rfind('}')]
            break
    
    # 블록 내용 들여쓰기 증가
    indented_block = []
    for block_line in block_lines:
        if block_line.strip():
            indented_block.append(indent + '    ' + block_line)
        else:
            indented_block.append(block_line)
    
    # 새로운 코드 생성
    new_code = f"{indent}new ConfirmModal(this.app, {message}, (confirmed) => {{\n"
    new_code += f"{indent}    if (confirmed) {{\n"
    for block_line in indented_block:
        if block_line.strip():
            new_code += block_line + '\n'
    new_code += f"{indent}    }}\n"
    new_code += f"{indent}}}).open();"
    
    return new_code, found_opening and brace_count == 0, len(block_lines) + 1

# 변환 실행
print("confirm() 호출을 ConfirmModal로 변환합니다...")
converted = 0
failed = []

for line_num in confirm_lines:
    result = convert_confirm_line(line_num)
    if result and result[1]:  # 성공적으로 변환됨
        new_code, success, lines_count = result
        print(f"Line {line_num}: 변환 완료 ({lines_count}줄)")
        converted += 1
    else:
        print(f"Line {line_num}: 변환 실패")
        failed.append(line_num)

print(f"\n변환 완료: {converted}/{len(confirm_lines)}")
if failed:
    print(f"실패한 라인: {failed}")
    print("\n실패한 라인은 수동으로 확인이 필요합니다.")
