import re

# 파일 읽기
with open(r'c:\ObsidianVaults\강의체크인\.obsidian\plugins\quiz-sp2\main.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# 10363라인부터 10529라인까지 제거 (0-based index이므로 10362~10528)
# 하지만 정확한 위치를 찾기 위해 패턴 매칭 사용
start_pattern = "            // 노트보기 버튼 (노트 또는 노트 이미지가 있을 때)"
end_pattern = "        // 버튼 컨테이너를 먼저 생성"

# 제거할 섹션 찾기
start_idx = None
end_idx = None

for i, line in enumerate(lines):
    if start_pattern in line:
        start_idx = i
    if end_pattern in line and start_idx is not None:
        end_idx = i
        break

if start_idx is not None and end_idx is not None:
    # 섹션 제거 (start_idx는 포함, end_idx는 제외)
    del lines[start_idx:end_idx]
    print(f"제거됨: 라인 {start_idx+1} ~ {end_idx}")
else:
    print(f"패턴을 찾지 못했습니다. start_idx={start_idx}, end_idx={end_idx}")

# 파일 저장
with open(r'c:\ObsidianVaults\강의체크인\.obsidian\plugins\quiz-sp2\main.js', 'w', encoding='utf-8') as f:
    f.writelines(lines)

print("중복된 노트 버튼 제거 완료!")
