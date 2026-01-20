# -*- coding: utf-8 -*-
import sys

file_path = r"c:\ObsidianVaults\강의체크인\.obsidian\plugins\quiz-sp2\main.js"

# 파일 읽기
with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

print(f"Total lines: {len(lines)}")
print(f"Line 2776 preview: {lines[2775][:100]}")
print(f"Line 2777 preview: {lines[2776][:100]}")
print(f"Line 2778 preview: {lines[2777][:100]}")

# 2778번째 줄부터 2804번째 줄까지 삭제 (인덱스는 0부터 시작하므로 2777~2803)
# 삭제할 부분: A- 퀴즈부터 actions.forEach까지
start_delete = 2777  # Line 2778 (0-indexed)
end_delete = 2804    # Line 2805 (0-indexed, exclusive)

# 삭제 전 확인
print("\n=== Deleting lines ===")
for i in range(start_delete, end_delete):
    if i < len(lines):
        print(f"Line {i+1}: {lines[i][:80]}")

# 라인 삭제
new_lines = lines[:start_delete] + lines[end_delete:]

print(f"\nNew total lines: {len(new_lines)}")
print(f"Deleted {len(lines) - len(new_lines)} lines")

# 파일 쓰기
with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("\n✅ Syntax error fixed!")
print(f"Lines 2778-2804 (27 lines) have been removed.")
print("\nNext step: Reload the plugin in Obsidian")
