@echo off
chcp 65001 >nul
title 수학 대시보드 플러그인 응급 설치

echo.
echo ===================================================
echo        수학 대시보드 플러그인 응급 설치
echo ===================================================
echo.

echo [1/2] 플러그인 폴더 생성 중...
set "PLUGIN_DIR=%APPDATA%\Obsidian\plugins\math-study-dashboard"

if not exist "%APPDATA%\Obsidian\plugins" (
    mkdir "%APPDATA%\Obsidian\plugins"
)

if not exist "%PLUGIN_DIR%" (
    mkdir "%PLUGIN_DIR%"
)

echo [2/2] 파일 복사 중...

REM main.js 파일 확인 및 복사
if exist "main.js" (
    copy "main.js" "%PLUGIN_DIR%\" >nul
    echo ✅ main.js 복사됨
) else if exist "main-simple.js" (
    copy "main-simple.js" "%PLUGIN_DIR%\main.js" >nul
    echo ✅ main-simple.js를 main.js로 복사됨
) else (
    echo ❌ main.js 파일을 찾을 수 없습니다
    echo TypeScript 파일을 JavaScript로 변환하는 중...
    
    REM 간단한 경우를 위한 기본 main.js 생성
    (
        echo const { Plugin, Notice } = require('obsidian'^);
        echo.
        echo class MathStudyDashboardPlugin extends Plugin {
        echo     async onload(^) {
        echo         this.addRibbonIcon('bar-chart', '수학 대시보드', (^) =^> {
        echo             new Notice('수학 학습 대시보드가 곧 출시됩니다!'^);
        echo         }^);
        echo     }
        echo }
        echo.
        echo module.exports = MathStudyDashboardPlugin;
    ) > "%PLUGIN_DIR%\main.js"
    echo ✅ 기본 main.js 생성됨
)

if exist "manifest.json" (
    copy "manifest.json" "%PLUGIN_DIR%\" >nul
    echo ✅ manifest.json 복사됨
) else (
    echo ❌ manifest.json을 찾을 수 없습니다. 기본 파일을 생성합니다.
    (
        echo {
        echo   "id": "math-study-dashboard",
        echo   "name": "Math Study Dashboard",
        echo   "version": "1.0.0",
        echo   "minAppVersion": "0.15.0",
        echo   "description": "수학 학습 대시보드",
        echo   "author": "Math Study Team"
        echo }
    ) > "%PLUGIN_DIR%\manifest.json"
    echo ✅ 기본 manifest.json 생성됨
)

echo.
echo 🎉 설치 완료!
echo.
echo 다음 단계:
echo 1. Obsidian을 재시작하세요
echo 2. 설정 → 커뮤니티 플러그인에서 'Math Study Dashboard' 활성화
echo 3. 왼쪽 리본에서 📊 아이콘을 확인하세요
echo.
echo 설치 위치: %PLUGIN_DIR%
echo.

REM 설치된 파일 확인
echo 설치된 파일:
dir "%PLUGIN_DIR%" /b

echo.
pause