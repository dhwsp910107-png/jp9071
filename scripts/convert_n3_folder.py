"""
N3 폴더의 문제 파일을 frontmatter 형식으로 자동 변환
"""
import os
from pathlib import Path

def parse_headers(content):
    """헤더 형식에서 데이터 추출"""
    data = {
        'hanzi': '',
        'number': '',
        'folder': '',
        'question': '',
        'difficulty': 'C',
        'wrongCount': 0,
        'correctCount': 0,
        'bookmarked': False,
        'lastAttempt': None,
        'keywords': []
    }
    
    lines = content.split('\n')
    current_section = ''
    
    for line in lines:
        line = line.strip()
        
        if line.startswith('## '):
            current_section = line[3:].strip()
            continue
        
        if not line or line.startswith('#'):
            continue
        
        if current_section == '한자':
            data['hanzi'] = line
        elif current_section == '번호':
            data['number'] = line
        elif current_section == '폴더':
            data['folder'] = line
        elif current_section == '문제':
            data['question'] = line
        elif current_section == '난이도':
            data['difficulty'] = line if line else 'C'
    
    return data

def generate_frontmatter(data):
    """Frontmatter 생성"""
    fm = "---\n"
    fm += f'hanzi: "{data["hanzi"]}"\n'
    fm += f'number: "{data["number"]}"\n'
    fm += f'folder: "{data["folder"]}"\n'
    
    question = data["question"].replace('"', '\\"').replace('\n', ' ')
    fm += f'question: "{question}"\n'
    
    fm += f'difficulty: "{data["difficulty"]}"\n'
    fm += f'wrongCount: {data["wrongCount"]}\n'
    fm += f'correctCount: {data["correctCount"]}\n'
    fm += f'bookmarked: {str(data["bookmarked"]).lower()}\n'
    fm += f'lastAttempt: null\n'
    fm += f'keywords: []\n'
    fm += "---\n"
    
    return fm

def convert_file(file_path):
    """단일 파일 변환"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        if content.strip().startswith('---'):
            return 'skipped'
        
        data = parse_headers(content)
        frontmatter = generate_frontmatter(data)
        new_content = frontmatter + '\n' + content
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        
        return 'converted'
        
    except Exception as e:
        print(f"❌ 오류 ({file_path.name}): {e}")
        return 'error'

def main():
    base_path = Path(r'C:\ObsidianVaults\강의체크인\HanziQuiz\Questions\N3')
    
    if not base_path.exists():
        print(f"❌ 폴더를 찾을 수 없습니다: {base_path}")
        return
    
    files_to_convert = []
    for file in base_path.glob('*.md'):
        if '_' in file.name and '문제목록' not in file.name and '대시보드' not in file.name:
            files_to_convert.append(file)
    
    if not files_to_convert:
        print("📝 변환할 파일이 없습니다")
        return
    
    print(f"📋 N3 폴더에서 {len(files_to_convert)}개 파일을 찾았습니다")
    print("변환을 시작합니다...\n")
    
    converted = 0
    skipped = 0
    errors = 0
    
    for file in files_to_convert:
        result = convert_file(file)
        
        if result == 'converted':
            converted += 1
            print(f"✅ {file.name}")
        elif result == 'skipped':
            skipped += 1
        else:
            errors += 1
    
    print(f"\n{'='*60}")
    print(f"✅ 변환 완료: {converted}개")
    print(f"⏭️  스킵 (이미 frontmatter 있음): {skipped}개")
    print(f"❌ 오류: {errors}개")
    print(f"{'='*60}")

if __name__ == '__main__':
    main()
