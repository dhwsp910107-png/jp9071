# -*- coding: utf-8 -*-
import json

# 기존 객체 형식 읽기
with open(r'c:\ObsidianVaults\강의체크인\.obsidian\core-plugins.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# true인 플러그인만 배열로 변환
enabled_plugins = [key for key, value in data.items() if value == True]

# 배열 형식으로 저장
with open(r'c:\ObsidianVaults\강의체크인\.obsidian\core-plugins.json', 'w', encoding='utf-8') as f:
    json.dump(enabled_plugins, f, indent=2, ensure_ascii=False)

print("✅ Converted to array format")
print(f"Enabled plugins: {len(enabled_plugins)}")
print(json.dumps(enabled_plugins, indent=2))
