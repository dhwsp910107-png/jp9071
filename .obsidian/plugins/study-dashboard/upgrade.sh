#!/bin/bash
# 학습 대시보드 v2.0 업그레이드 스크립트

echo "🚀 학습 대시보드 v2.0 업그레이드 시작..."

# 백업
cp main.js main.js.backup-$(date +%Y%m%d-%H%M%S)

# GitHub에서 최신 버전 다운로드
curl -o main.js https://raw.githubusercontent.com/your-repo/study-dashboard/main/main.js

echo "✅ 업그레이드 완료!"
echo "📌 Obsidian을 재시작하세요."
