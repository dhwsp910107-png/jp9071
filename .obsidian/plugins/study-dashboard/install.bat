@echo off
echo 수학 학습 대시보드 플러그인 설치 스크립트
echo ==========================================

echo 1. 의존성 설치 중...
call npm install

echo 2. 빌드 중...
call npm run build

echo 3. 옵시디언 플러그인 폴더에 복사 중...
set PLUGIN_DIR="%APPDATA%\Obsidian\plugins\math-study-dashboard"

if not exist %PLUGIN_DIR% (
    mkdir %PLUGIN_DIR%
    echo 플러그인 폴더 생성됨: %PLUGIN_DIR%
)

copy main.js %PLUGIN_DIR%
copy manifest.json %PLUGIN_DIR%

echo 4. 설치 완료!
echo 이제 옵시디언을 재시작하고 플러그인을 활성화하세요.
echo.
pause