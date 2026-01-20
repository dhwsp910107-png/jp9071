# 파일 수정 스크립트
with open('main.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# 314번 줄까지 유지 (인덱스 0부터 시작이므로 313까지)
new_lines = lines[:314]

# 1292번 줄부터 끝까지 추가 (인덱스로는 1291부터)
new_lines.extend(lines[1291:])

# 파일 쓰기
with open('main.js', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print(f"완료! 총 {len(new_lines)}줄로 수정되었습니다.")
print(f"삭제된 줄: {1292 - 314} = {1292 - 314}줄")
