import re

# main.js 파일 읽기
with open('.obsidian/plugins/quiz-sp2/main.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 패턴 1: "다음 문제" 버튼에 모바일 지원 추가
pattern1 = r"(nextBtn\.style\.fontWeight = 'bold';)\n(\s+)(nextBtn\.addEventListener\('click', \(\) => \{)"
replacement1 = r"\1\n\2nextBtn.style.touchAction = 'manipulation';\n\2nextBtn.style.webkitTapHighlightColor = 'rgba(0,0,0,0.1)';\n\n\2\3"

content = re.sub(pattern1, replacement1, content)

# 파일 저장
with open('.obsidian/plugins/quiz-sp2/main.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("모바일 터치 지원이 추가되었습니다!")
print("변경된 위치: '다음 문제' 버튼")
