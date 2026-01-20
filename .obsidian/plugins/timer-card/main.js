const { Plugin, Notice } = require('obsidian');

class TimerCardPlugin extends Plugin {
    
    async onload() {
        console.log('🎯 Timer Card Plugin 로드됨');
        
        // 현재 문제 정보를 저장할 변수
        this.currentProblem = null;
        
        // ================================
        // 1. 스톱워치 코드블록 프로세서
        // ================================
        this.registerMarkdownCodeBlockProcessor('timer-stopwatch', (source, el, ctx) => {
            console.log('⏱️ 스톱워치 코드블록 발견!');
            
            // 설정 파싱
            const config = {
                autoStart: false,
                showMilliseconds: true
            };
            
            source.split('\n').forEach(line => {
                const [key, value] = line.split(':').map(s => s.trim());
                if (key && value) {
                    if (key === 'autoStart') config.autoStart = value === 'true';
                    if (key === 'showMilliseconds') config.showMilliseconds = value === 'true';
                }
            });

            el.empty();
            const stopwatchUI = this.createStopwatchUI(config, ctx);
            el.appendChild(stopwatchUI);
        });
        
        // ================================
        // 2. 이미지 버튼 코드블록 프로세서
        // ================================
        this.registerMarkdownCodeBlockProcessor('timer-button', (source, el, ctx) => {
            const config = {};
            source.split('\n').forEach(line => {
                const parts = line.trim().split(/\s+/);
                if (parts.length >= 2) {
                    const key = parts[0];
                    const value = parts.slice(1).join(' ');
                    config[key] = value;
                }
            });
            
            if (config.type === 'image') {
                const button = document.createElement('button');
                button.textContent = config.name || '📷 이미지 추가';
                button.style.cssText = `
                    background: linear-gradient(135deg, #3b82f6, #1d4ed8);
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-weight: bold;
                    transition: all 0.3s ease;
                `;
                
                button.onmouseover = () => {
                    button.style.background = 'linear-gradient(135deg, #2563eb, #1e40af)';
                };
                button.onmouseout = () => {
                    button.style.background = 'linear-gradient(135deg, #3b82f6, #1d4ed8)';
                };
                
                button.onclick = () => {
                    this.handleImageUpload(config.imageType || 'image');
                };
                
                el.appendChild(button);
            }
        });
        
        // ================================
        // 3. 파일 변경 감지 (문제 인식)
        // ================================
        this.registerEvent(
            this.app.workspace.on('active-leaf-change', () => {
                const activeFile = this.app.workspace.getActiveFile();
                if (!activeFile) return;
                
                const cache = this.app.metadataCache.getFileCache(activeFile);
                const frontmatter = cache?.frontmatter;
                
                if (!frontmatter) return;
                
                const isAnkiCard = frontmatter.tags?.includes('anki-card') || 
                                  frontmatter.type === 'image-flashcard';
                
                if (isAnkiCard) {
                    this.currentProblem = {
                        file: activeFile,
                        subject: frontmatter.subject || '기타',
                        number: frontmatter.number || '000',
                        title: frontmatter.title || activeFile.basename
                    };
                    console.log('📝 현재 문제 설정:', this.currentProblem);
                }
            })
        );
        
        // ================================
        // 4. 명령어 등록
        // ================================
        this.addCommand({
            id: 'quick-start-timer',
            name: '🎯 문제 타이머 빠른 시작',
            callback: () => {
                const activeFile = this.app.workspace.getActiveFile();
                if (!activeFile) {
                    new Notice('❌ 활성화된 파일이 없습니다');
                    return;
                }
                
                const cache = this.app.metadataCache.getFileCache(activeFile);
                const frontmatter = cache?.frontmatter;
                
                if (!frontmatter?.tags?.includes('anki-card')) {
                    new Notice('❌ 문제 파일이 아닙니다');
                    return;
                }
                
                this.currentProblem = {
                    file: activeFile,
                    subject: frontmatter.subject || '기타',
                    number: frontmatter.number || '000',
                    title: frontmatter.title || activeFile.basename
                };
                
                new Notice(`⏱️ ${this.currentProblem.subject} - ${this.currentProblem.title} 타이머 준비!`);
            }
        });

        this.addCommand({
            id: 'test-timer-card',
            name: '🧪 Timer Card 테스트',
            callback: () => {
                new Notice('✅ Timer Card 플러그인이 정상 작동합니다!');
                console.log('Timer Card 테스트:', {
                    currentProblem: this.currentProblem,
                    activeFile: this.app.workspace.getActiveFile()?.name
                });
            }
        });
        
        new Notice('🎯 Timer Card Plugin 활성화됨!');
    }
    
    // ================================
    // 스톱워치 UI 생성 함수
    // ================================
    createStopwatchUI(config, ctx) {
        const container = document.createElement('div');
        container.className = 'timer-stopwatch-container';
        
        container.style.cssText = `
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 20px;
            padding: 30px;
            text-align: center;
            box-shadow: 0 10px 40px rgba(102, 126, 234, 0.3);
            margin: 20px 0;
            position: relative;
        `;

        // 타이머 상태
        let startTime = 0;
        let elapsedTime = 0;
        let timerInterval = null;
        let isRunning = false;
        let isPaused = false;

        // 현재 문제 정보 표시
        if (this.currentProblem) {
            const prepareText = document.createElement('div');
            prepareText.style.cssText = `
                background: rgba(16, 185, 129, 0.2);
                color: #10b981;
                padding: 10px;
                border-radius: 8px;
                margin-bottom: 15px;
                text-align: center;
                font-weight: 600;
                border: 1px solid rgba(16, 185, 129, 0.3);
            `;
            prepareText.textContent = `✅ ${this.currentProblem.subject} - ${this.currentProblem.title}`;
            container.appendChild(prepareText);
        }

        // 시간 표시
        const timeDisplay = document.createElement('div');
        timeDisplay.className = 'stopwatch-display';
        timeDisplay.style.cssText = `
            font-size: 4rem;
            font-weight: bold;
            color: white;
            font-family: 'SF Mono', 'Monaco', 'Courier New', monospace;
            margin: 20px 0;
            text-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
            letter-spacing: 0.05em;
            background: rgba(0, 0, 0, 0.1);
            padding: 20px;
            border-radius: 15px;
            backdrop-filter: blur(10px);
        `;
        timeDisplay.textContent = config.showMilliseconds ? '00:00.000' : '00:00';
        container.appendChild(timeDisplay);

        // 시간 포맷 함수
        const formatTime = (ms) => {
            const totalSeconds = Math.floor(ms / 1000);
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = totalSeconds % 60;
            const milliseconds = ms % 1000;
            
            if (config.showMilliseconds) {
                return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
            } else {
                return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            }
        };

        // 시간 업데이트 함수
        const updateDisplay = () => {
            const currentTime = elapsedTime + (isRunning && !isPaused ? Date.now() - startTime : 0);
            timeDisplay.textContent = formatTime(currentTime);
        };

        // 버튼 컨테이너
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
            display: flex;
            gap: 15px;
            justify-content: center;
            margin-top: 25px;
            flex-wrap: wrap;
        `;

        const buttonStyle = `
            padding: 15px 25px;
            border: none;
            border-radius: 15px;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.3s ease;
            min-width: 120px;
            font-size: 1rem;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
            backdrop-filter: blur(10px);
        `;

        // 시작/재개 버튼
        const startButton = document.createElement('button');
        startButton.textContent = '▶️ 시작';
        startButton.style.cssText = buttonStyle + `
            background: linear-gradient(135deg, #10b981, #059669);
            color: white;
        `;
        
        // 정지 버튼
        const stopButton = document.createElement('button');
        stopButton.textContent = '⏹️ 정지';
        stopButton.style.cssText = buttonStyle + `
            background: linear-gradient(135deg, #ef4444, #dc2626);
            color: white;
            opacity: 0.5;
        `;
        stopButton.disabled = true;
        
        // 초기화 버튼
        const resetButton = document.createElement('button');
        resetButton.textContent = '🔄 초기화';
        resetButton.style.cssText = buttonStyle + `
            background: linear-gradient(135deg, #6b7280, #4b5563);
            color: white;
        `;

        // 버튼 이벤트 핸들러
        startButton.onclick = () => {
            if (!isRunning || isPaused) {
                startTime = Date.now();
                isRunning = true;
                isPaused = false;
                
                timerInterval = setInterval(updateDisplay, config.showMilliseconds ? 10 : 100);
                
                startButton.textContent = '⏸️ 일시정지';
                startButton.style.background = 'linear-gradient(135deg, #f59e0b, #d97706)';
                stopButton.disabled = false;
                stopButton.style.opacity = '1';
                new Notice('⏱️ 스톱워치 시작!');
            } else {
                isPaused = true;
                elapsedTime += Date.now() - startTime;
                clearInterval(timerInterval);
                
                startButton.textContent = '▶️ 재개';
                startButton.style.background = 'linear-gradient(135deg, #10b981, #059669)';
                new Notice('⏸️ 일시정지');
            }
        };

        stopButton.onclick = async () => {
            if (isRunning) {
                const finalTime = elapsedTime + (isPaused ? 0 : Date.now() - startTime);
                const totalSeconds = Math.floor(finalTime / 1000);
                
                clearInterval(timerInterval);
                isRunning = false;
                isPaused = false;
                
                const file = this.app.workspace.getActiveFile();
                if (file) {
                    await this.saveTimeToFrontmatter(file, totalSeconds);
                    new Notice(`✅ 시간 기록됨: ${formatTime(finalTime)}`);
                }
                
                startButton.textContent = '▶️ 시작';
                startButton.style.background = 'linear-gradient(135deg, #10b981, #059669)';
                stopButton.disabled = true;
                stopButton.style.opacity = '0.5';
            }
        };

        resetButton.onclick = () => {
            clearInterval(timerInterval);
            isRunning = false;
            isPaused = false;
            elapsedTime = 0;
            startTime = 0;
            timeDisplay.textContent = config.showMilliseconds ? '00:00.000' : '00:00';
            
            startButton.textContent = '▶️ 시작';
            startButton.style.background = 'linear-gradient(135deg, #10b981, #059669)';
            stopButton.disabled = true;
            stopButton.style.opacity = '0.5';
            new Notice('🔄 타이머 초기화');
        };

        buttonContainer.appendChild(startButton);
        buttonContainer.appendChild(stopButton);
        buttonContainer.appendChild(resetButton);
        container.appendChild(buttonContainer);

        // 사용법 안내
        const helpText = document.createElement('div');
        helpText.style.cssText = `
            margin-top: 25px;
            color: rgba(255, 255, 255, 0.9);
            font-size: 0.9rem;
            line-height: 1.6;
        `;
        helpText.innerHTML = `
            <div style="background: rgba(0,0,0,0.2); padding: 20px; border-radius: 15px; backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1);">
                <strong>💡 사용법:</strong><br>
                ▶️ <strong>시작</strong>: 측정 시작<br>
                ⏸️ <strong>일시정지</strong>: 잠시 멈춤 (이어서 계속 가능)<br>
                ⏹️ <strong>정지</strong>: 측정 완료 (자동 시간 기록)<br>
                🔄 <strong>초기화</strong>: 처음부터 다시
            </div>
        `;
        container.appendChild(helpText);

        if (config.autoStart) {
            setTimeout(() => startButton.click(), 100);
        }

        return container;
    }
    
    // ================================
    // 이미지 업로드 함수
    // ================================
    async handleImageUpload(imageType) {
        console.log(`🖼️ 이미지 업로드 시작: ${imageType}`);
        
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            new Notice('❌ 활성화된 파일이 없습니다');
            return;
        }

        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.multiple = false;

        input.onchange = async (e) => {
            try {
                const uploadFile = e.target.files[0];
                if (!uploadFile) {
                    new Notice('❌ 파일이 선택되지 않았습니다');
                    return;
                }

                if (uploadFile.size > 10 * 1024 * 1024) {
                    new Notice('❌ 파일 크기가 너무 큽니다 (최대 10MB)');
                    return;
                }

                new Notice('📤 이미지 업로드 중...');

                const cache = this.app.metadataCache.getFileCache(activeFile);
                const frontmatter = cache?.frontmatter || {};
                
                const subject = frontmatter.subject || '기타';
                const number = frontmatter.number || '000';
                
                const ext = uploadFile.name.split('.').pop().toLowerCase();
                const timestamp = Date.now();
                const newFileName = `${subject}_${number}_${imageType}_${timestamp}.${ext}`;
                const attachmentFolder = `첨부파일/${subject}`;
                const fullPath = `${attachmentFolder}/${newFileName}`;
                
                console.log('📂 저장 경로:', fullPath);
                
                // 폴더 생성
                try {
                    await this.app.vault.createFolder(attachmentFolder).catch(() => {
                        console.log('📁 폴더가 이미 존재함');
                    });
                } catch (err) {
                    console.log('📁 폴더 생성 처리:', err.message);
                }
                
                // 파일 저장
                const arrayBuffer = await uploadFile.arrayBuffer();
                const uint8Array = new Uint8Array(arrayBuffer);
                
                try {
                    await this.app.vault.adapter.writeBinary(fullPath, uint8Array);
                    console.log('✅ 파일 저장 완료:', fullPath);
                } catch (saveError) {
                    console.error('❌ 파일 저장 실패:', saveError);
                    new Notice(`❌ 파일 저장 실패: ${saveError.message}`);
                    return;
                }
                
                // 마크다운에 이미지 삽입
                const imageMarkdown = `\n![[${newFileName}]]\n`;
                const content = await this.app.vault.read(activeFile);
                
                // 해당 이미지 타입의 버튼 위치 찾기
                const searchPattern = new RegExp(
                    `\`\`\`timer-button\\s[^]*?imageType\\s+${imageType}[^]*?\`\`\``,
                    'i'
                );
                
                let newContent;
                const match = content.match(searchPattern);
                
                if (match) {
                    const insertPosition = match.index + match[0].length;
                    newContent = 
                        content.substring(0, insertPosition) + 
                        imageMarkdown + 
                        content.substring(insertPosition);
                    console.log('✅ 버튼 아래에 이미지 삽입');
                } else {
                    // 버튼을 못 찾으면 파일 끝에 추가
                    newContent = content + '\n\n---\n\n## 📸 추가된 이미지\n' + imageMarkdown;
                    console.log('⚠️ 버튼을 찾지 못해 파일 끝에 추가');
                }

                await this.app.vault.modify(activeFile, newContent);
                new Notice(`✅ 이미지가 추가되었습니다: ${newFileName}`);
                console.log('🎉 이미지 업로드 완료!');

            } catch (error) {
                console.error('❌ 이미지 업로드 중 오류:', error);
                new Notice(`❌ 오류: ${error.message}`);
            }
        };

        input.click();
    }
    
    // ================================
    // frontmatter 시간 저장 함수
    // ================================
    async saveTimeToFrontmatter(file, timeInSeconds) {
        try {
            console.log('💾 시간 저장 시작:', timeInSeconds, '초');
            
            const content = await this.app.vault.read(file);
            const cache = this.app.metadataCache.getFileCache(file);
            const frontmatter = cache?.frontmatter || {};

            let times = frontmatter.times || [];
            if (!Array.isArray(times)) times = [];
            times.push(timeInSeconds);

            const totalTime = times.reduce((sum, t) => sum + t, 0);
            const avgTime = Math.floor(totalTime / times.length);

            let attempts = frontmatter.attempts || [];
            if (!Array.isArray(attempts)) attempts = [];
            attempts.push(new Date().toISOString().split('T')[0]);

            // frontmatter 업데이트
            const lines = content.split('\n');
            let inFrontmatter = false;
            let frontmatterEnd = -1;
            let updatedLines = [];
            let timesUpdated = false;
            let attemptsUpdated = false;
            let avgTimeUpdated = false;
            let totalTimeUpdated = false;
            let studyTimeUpdated = false;

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                
                if (line.trim() === '---') {
                    if (!inFrontmatter) {
                        inFrontmatter = true;
                        updatedLines.push(line);
                    } else {
                        frontmatterEnd = i;
                        
                        // 업데이트되지 않은 필드 추가
                        if (!timesUpdated) {
                            updatedLines.push(`times: [${times.join(', ')}]`);
                        }
                        if (!attemptsUpdated) {
                            updatedLines.push(`attempts: [${attempts.map(d => `"${d}"`).join(', ')}]`);
                        }
                        if (!avgTimeUpdated) {
                            updatedLines.push(`avgTime: ${avgTime}`);
                        }
                        if (!totalTimeUpdated) {
                            updatedLines.push(`totalTime: ${totalTime}`);
                        }
                        if (!studyTimeUpdated) {
                            updatedLines.push(`studyTime: ${totalTime}`);
                        }
                        
                        updatedLines.push(line);
                        inFrontmatter = false;
                    }
                } else if (inFrontmatter) {
                    if (line.startsWith('times:')) {
                        updatedLines.push(`times: [${times.join(', ')}]`);
                        timesUpdated = true;
                    } else if (line.startsWith('attempts:')) {
                        updatedLines.push(`attempts: [${attempts.map(d => `"${d}"`).join(', ')}]`);
                        attemptsUpdated = true;
                    } else if (line.startsWith('avgTime:')) {
                        updatedLines.push(`avgTime: ${avgTime}`);
                        avgTimeUpdated = true;
                    } else if (line.startsWith('totalTime:')) {
                        updatedLines.push(`totalTime: ${totalTime}`);
                        totalTimeUpdated = true;
                    } else if (line.startsWith('studyTime:')) {
                        updatedLines.push(`studyTime: ${totalTime}`);
                        studyTimeUpdated = true;
                    } else {
                        updatedLines.push(line);
                    }
                } else {
                    updatedLines.push(line);
                }
            }

            const newContent = updatedLines.join('\n');
            await this.app.vault.modify(file, newContent);
            
            console.log('✅ frontmatter 업데이트 완료:', {
                times: times.length,
                avgTime,
                totalTime,
                lastTime: timeInSeconds
            });

        } catch (error) {
            console.error('❌ frontmatter 업데이트 실패:', error);
            new Notice('⚠️ 시간 기록 중 오류 발생');
        }
    }

    onunload() {
        console.log('🎯 Timer Card Plugin 언로드됨');
    }
}

module.exports = TimerCardPlugin;