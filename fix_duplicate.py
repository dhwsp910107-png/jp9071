#!/usr/bin/env python
# -*- coding: utf-8 -*-

# 중복된 이미지 섹션 제거 (12246줄부터 12503줄까지)
with open('.obsidian/plugins/learning-strategy-planner/main.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

print(f"총 라인 수: {len(lines)}")
print(f"Line 12245: {lines[12244][:100]}")
print(f"Line 12246: {lines[12245][:100]}")
print(f"Line 12503: {lines[12502][:100]}")
print(f"Line 12504: {lines[12503][:100]}")

# 12246줄부터 12503줄까지 삭제 (인덱스는 0부터 시작하므로 12245~12502)
# "// 문제 이미지"부터 "updateHintImagePreview();" 까지
start_line = None
end_line = None

for i in range(12240, min(12510, len(lines))):
    if '// 문제 이미지' in lines[i] and 'const imageGroup = form.createDiv' in lines[i+1]:
        start_line = i
        print(f"\n시작 라인 발견: {i+1} (인덱스 {i})")
        print(f"  내용: {lines[i][:80]}")
    if start_line and 'updateHintImagePreview();' in lines[i]:
        end_line = i
        print(f"종료 라인 발견: {i+1} (인덱스 {i})")
        print(f"  내용: {lines[i][:80]}")
        break

if start_line and end_line:
    print(f"\n삭제할 라인: {start_line+1} ~ {end_line+1} ({end_line - start_line + 1}줄)")
    
    # 삭제 후 라인 수
    new_lines = lines[:start_line] + lines[end_line+1:]
    print(f"삭제 후 라인 수: {len(new_lines)}")
    
    # 백업 생성
    with open('.obsidian/plugins/learning-strategy-planner/main.js.bak', 'w', encoding='utf-8') as f:
        f.writelines(lines)
    print("백업 파일 생성: main.js.bak")
    
    # 수정된 파일 저장
    with open('.obsidian/plugins/learning-strategy-planner/main.js', 'w', encoding='utf-8') as f:
        f.writelines(new_lines)
    print("✅ 중복 섹션 제거 완료!")
else:
    print("❌ 중복 섹션을 찾을 수 없습니다.")
