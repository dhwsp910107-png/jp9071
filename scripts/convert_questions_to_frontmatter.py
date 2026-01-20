"""
문제 파일을 헤더 형식에서 Frontmatter 형식으로 변환
"""
import os
import re
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
        
        # 섹션 헤더 감지
        if line.startswith('## '):
            current_section = line[3:].strip()
            continue
        
        # 빈 줄이나 다른 헤더는 스킵
        if not line or line.startswith('#'):
            continue
        
        # 섹션별 데이터 추출
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
    
    # 문제 텍스트에서 따옴표 이스케이프
    question = data["question"].replace('"', '\\"')
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
        
        # 이미 frontmatter가 있으면 스킵
        if content.strip().startswith('---'):
            return 'skipped'
        
        # 데이터 추출 및 frontmatter 생성
        data = parse_headers(content)
        frontmatter = generate_frontmatter(data)
        
        # 새 콘텐츠 작성
        new_content = frontmatter + '\n' + content
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        
        return 'converted'
        
    except Exception as e:
        print(f"❌ 오류 ({file_path.name}): {e}")
        return 'error'

def main():
    base_path = Path(r'C:\ObsidianVaults\강의체크인\HanziQuiz\Questions')
    
    # 폴더 선택
    folders = ['기본', '한자', '어휘', '문법', 'N1', 'N3', '156', '1번방']
    
    print("변환할 폴더를 선택하세요:")
    for i, folder in enumerate(folders, 1):
        print(f"{i}. {folder}")
    print(f"{len(folders) + 1}. 전체")
    
    choice = input("\n선택 (번호): ").strip()
    
    if not choice.isdigit():
        print("❌ 올바른 번호를 입력하세요")
        return
    
    choice = int(choice)
    
    if choice == len(folders) + 1:
        target_folders = folders
    elif 1 <= choice <= len(folders):
        target_folders = [folders[choice - 1]]
    else:
        print("❌ 올바른 번호를 입력하세요")
        return
    
    # 파일 수집
    files_to_convert = []
    for folder in target_folders:
        folder_path = base_path / folder
        if not folder_path.exists():
            continue
        
        for file in folder_path.glob('*.md'):
            if '_' in file.name and '문제목록' not in file.name and '대시보드' not in file.name:
                files_to_convert.append(file)
    
    if not files_to_convert:
        print("📝 변환할 파일이 없습니다")
        return
    
    print(f"\n📋 {len(files_to_convert)}개 파일을 찾았습니다")
    confirm = input("변환을 시작하시겠습니까? (y/n): ").strip().lower()
    
    if confirm != 'y':
        print("❌ 변환 취소")
        return
    
    # 변환 실행
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
    
    print(f"\n{'='*50}")
    print(f"✅ 변환 완료: {converted}개")
    print(f"⏭️  스킵: {skipped}개")
    print(f"❌ 오류: {errors}개")
    print(f"{'='*50}")

if __name__ == '__main__':
    main()
