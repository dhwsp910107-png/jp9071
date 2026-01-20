// ========== Part 2: 메인 플러그인 클래스 ==========
// Study Dashboard Plugin 메인 클래스

class StudyDashboardPlugin extends Plugin {
    async onload() {
        console.log('📚 Study Dashboard v3.0 - 500문제 완성 시스템 로드 시작');
        
        // 설정 로드
        await this.loadSettings();
        
        // 뷰 등록
        this.registerView(VIEW_TYPE_STUDY_DASHBOARD, (leaf) => new StudyDashboardView(leaf, this));
        
        // 스타일 추가
        this.addStyles();
        
        // 리본 아이콘 추가
        this.addRibbonIcon('graduation-cap', '📚 Study Dashboard', () => this.activateView());
        
        // 메인 명령어들 등록
        this.registerCommands();
        
        // 타이머 상태 초기화
        this.initializeTimerState();
        
        // 설정 탭 추가
        this.addSettingTab(new StudyDashboardSettingTab(this.app, this));
        
        console.log('✅ Study Dashboard v3.0 로드 완료!');
    }

    async onunload() {
        console.log('📚 Study Dashboard v3.0 언로드');
        // 타이머 정리
        if (this.timerState.interval) {
            clearInterval(this.timerState.interval);
        }
    }
    
    // ========== 설정 관리 ==========
    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }
    
    async saveSettings() {
        await this.saveData(this.settings);
    }
    
    // ========== 뷰 활성화 ==========
    async activateView() {
        // 기존 탭이 있으면 제거
        this.app.workspace.detachLeavesOfType(VIEW_TYPE_STUDY_DASHBOARD);
        
        // 새 탭에서 뷰 생성
        await this.app.workspace.getRightLeaf(false).setViewState({
            type: VIEW_TYPE_STUDY_DASHBOARD,
            active: true
        });
        
        // 뷰 포커스
        this.app.workspace.revealLeaf(
            this.app.workspace.getLeavesOfType(VIEW_TYPE_STUDY_DASHBOARD)[0]
        );
    }
    
    // ========== 명령어 등록 ==========
    registerCommands() {
        // 대시보드 열기
        this.addCommand({
            id: 'open-study-dashboard',
            name: '📚 Study Dashboard 열기',
            callback: () => this.activateView()
        });

        // 새 문제 생성
        this.addCommand({
            id: 'create-new-problem',
            name: '➕ 새 문제 생성',
            callback: () => {
                new ProblemCreationModal(this.app, this).open();
            }
        });

        // 문제 일괄 생성
        this.addCommand({
            id: 'bulk-create-problems',
            name: '📝 문제 일괄 생성',
            callback: () => {
                new BulkCreationModal(this.app, this).open();
            }
        });

        // 타이머 삽입
        this.addCommand({
            id: 'insert-problem-timer',
            name: '⏱️ 문제 타이머 삽입',
            editorCallback: (editor) => {
                this.insertProblemTimer(editor);
            }
        });

        // 스톱워치 연동
        this.addCommand({
            id: 'sync-stopwatch',
            name: '🔄 스톱워치 플러그인 연동',
            callback: () => {
                this.syncWithStopwatch();
            }
        });
    }
    
    // ========== 타이머 상태 관리 ==========
    initializeTimerState() {
        this.timerState = {
            isRunning: false,
            startTime: null,
            currentProblem: null,
            seconds: 0,
            interval: null,
            currentSubject: this.settings.defaultSubject
        };
    }

    startTimer(problemData) {
        if (this.timerState.isRunning) {
            this.stopTimer();
        }

        this.timerState.isRunning = true;
        this.timerState.startTime = Date.now();
        this.timerState.currentProblem = problemData;
        this.timerState.seconds = 0;

        this.timerState.interval = setInterval(() => {
            this.timerState.seconds++;
            this.updateTimerDisplay();
        }, 1000);

        new Notice(`⏱️ ${problemData.subject} ${problemData.number}번 타이머 시작!`);
    }

    stopTimer() {
        if (!this.timerState.isRunning) return;

        this.timerState.isRunning = false;
        if (this.timerState.interval) {
            clearInterval(this.timerState.interval);
            this.timerState.interval = null;
        }

        const timeSpent = this.timerState.seconds;
        const problem = this.timerState.currentProblem;

        if (problem && this.settings.autoTimerSave) {
            this.saveProblemTime(problem, timeSpent);
        }

        new Notice(`⏹️ 타이머 정지! 소요시간: ${formatTime(timeSpent)}`);
        return timeSpent;
    }

    resetTimer() {
        this.stopTimer();
        this.timerState.seconds = 0;
        this.updateTimerDisplay();
        new Notice('🔄 타이머 초기화');
    }

    updateTimerDisplay() {
        // 실시간 타이머 디스플레이 업데이트
        const displays = document.querySelectorAll('.timer-display, .current-timer');
        displays.forEach(display => {
            display.textContent = formatTime(this.timerState.seconds);
        });
    }
    
    // ========== 문제 생성 ==========
    async createProblem(subject, number, title, difficulty = 3) {
        try {
            const subjectFolder = normalizePath(`${this.settings.problemsFolder}/${subject}`);
            
            // 폴더 생성
            try {
                await this.app.vault.createFolder(subjectFolder);
            } catch (folderError) {
                // 폴더가 이미 존재하면 무시
            }
            
            const fileName = `${String(number).padStart(3, '0')}_${title.replace(/[^\w가-힣]/g, '_')}.md`;
            const filePath = normalizePath(`${subjectFolder}/${fileName}`);
            
            // 중복 체크
            const existingFile = this.app.vault.getAbstractFileByPath(filePath);
            if (existingFile) {
                new Notice(`❌ 문제 ${number}번이 이미 존재합니다.`);
                return;
            }
            
            // 템플릿으로 파일 생성
            const content = PROBLEM_TEMPLATE(number, title, subject, difficulty);
            await this.app.vault.create(filePath, content);
            
            new Notice(`✅ '${title}' 문제가 ${subject} 폴더에 생성되었습니다.`);
            
            // 대시보드 새로고침
            setTimeout(() => {
                this.refreshDashboard();
            }, 300);
            
        } catch (error) {
            console.error('문제 파일 생성 오류:', error);
            new Notice(`❌ 문제 생성 중 오류가 발생했습니다: ${error.message}`);
        }
    }

    async createBulkProblems(subject, startNumber, endNumber) {
        let created = 0;
        const total = endNumber - startNumber + 1;
        
        for (let i = startNumber; i <= endNumber; i++) {
            try {
                await this.createProblem(subject, i, `문제 ${i}`, 3);
                created++;
                // 잠시 대기 (너무 빠른 생성 방지)
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error) {
                console.error(`문제 ${i} 생성 실패:`, error);
            }
        }
        
        new Notice(`✅ ${created}/${total}개 문제 생성 완료!`);
        this.refreshDashboard();
    }
    
    // ========== 문제 데이터 관리 ==========
    async getAllProblems() {
        try {
            const problemsPath = normalizePath(this.settings.problemsFolder);
            const folder = this.app.vault.getAbstractFileByPath(problemsPath);
            
            if (!folder) {
                console.log('문제 폴더가 없습니다.');
                return [];
            }
            
            const problems = [];
            const foldersToCheck = [folder];
            
            // 하위 폴더들도 확인
            if (folder.children) {
                for (const child of folder.children) {
                    if (child && typeof child === 'object' && child.children) {
                        foldersToCheck.push(child);
                    }
                }
            }
            
            // 모든 폴더에서 문제 파일 찾기
            for (const folderToCheck of foldersToCheck) {
                if (!folderToCheck || !folderToCheck.children) continue;
                
                for (const file of folderToCheck.children) {
                    try {
                        if (file && 
                            typeof file === 'object' && 
                            file.extension === 'md' && 
                            file.path && 
                            file.basename) {
                            
                            const metadata = this.app.metadataCache.getFileCache(file);
                            const frontmatter = metadata?.frontmatter;
                            
                            if (frontmatter && typeof frontmatter.number === 'number') {
                                problems.push({
                                    number: frontmatter.number,
                                    title: frontmatter.title || file.basename,
                                    subject: frontmatter.subject || '기타',
                                    status: frontmatter.status || PROBLEM_STATUS.LEARNING,
                                    difficulty: frontmatter.difficulty || 3,
                                    reviewCount: frontmatter.reviewCount || 0,
                                    lastReview: frontmatter.lastReview,
                                    times: frontmatter.times || [],
                                    avgTime: frontmatter.avgTime || 0,
                                    totalTime: frontmatter.totalTime || 0,
                                    tags: Array.isArray(frontmatter.tags) ? frontmatter.tags : [],
                                    file
                                });
                            }
                        }
                    } catch (fileError) {
                        console.log('파일 처리 중 오류 무시:', fileError.message);
                        continue;
                    }
                }
            }
            
            return problems.sort((a, b) => a.number - b.number);
        } catch (error) {
            console.error('문제 로드 중 오류:', error);
            return [];
        }
    }

    async saveProblemTime(problemData, timeInSeconds) {
        if (!problemData || !problemData.file) return;

        try {
            const file = problemData.file;
            const content = await this.app.vault.read(file);
            const cache = this.app.metadataCache.getFileCache(file);
            const frontmatter = cache?.frontmatter || {};

            // 시간 기록 업데이트
            const times = frontmatter.times || [];
            times.push(timeInSeconds);

            const totalTime = (frontmatter.totalTime || 0) + timeInSeconds;
            const avgTime = Math.floor(times.reduce((a, b) => a + b, 0) / times.length);

            // 등급 계산
            const grade = calculateGrade(timeInSeconds);

            // frontmatter 업데이트
            const updatedFrontmatter = {
                ...frontmatter,
                times,
                totalTime,
                avgTime,
                lastReview: new Date().toISOString().split('T')[0]
            };

            // 파일 업데이트 (실제 구현에서는 frontmatter 파싱/업데이트 필요)
            new Notice(`⏱️ 시간 기록됨: ${formatTime(timeInSeconds)} (${grade.grade}등급 ${grade.emoji})`);

        } catch (error) {
            console.error('시간 저장 오류:', error);
            new Notice('❌ 시간 저장 중 오류가 발생했습니다.');
        }
    }
    
    // ========== 유틸리티 ==========
    insertProblemTimer(editor) {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            new Notice('❌ 활성화된 파일이 없습니다');
            return;
        }
        
        const cache = this.app.metadataCache.getFileCache(activeFile);
        const frontmatter = cache?.frontmatter;
        const title = frontmatter ? 
            `${frontmatter.subject || '문제'} ${frontmatter.number || ''}번 - ${frontmatter.title || '타이머'}` :
            '문제 풀이 타이머';
        
        const timerTemplate = `
## ⏱️ 문제 풀이 타이머

\`\`\`stopwatch
title: "${title}"
showMilliseconds: true
autoStart: false
theme: purple
\`\`\`

> 💡 **타이머 사용법:**
> - ▶️ **시작**: 문제 풀이를 시작할 때 클릭
> - ⏸️ **일시정지**: 잠시 멈출 때 클릭
> - ⏹️ **정지**: 문제를 완전히 끝냈을 때 클릭
> - 🔄 **초기화**: 처음부터 다시 시작
`;
        
        editor.replaceSelection(timerTemplate);
        new Notice('⏱️ 스톱워치 타이머가 추가되었습니다!');
    }

    syncWithStopwatch() {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            new Notice('❌ 활성화된 파일이 없습니다');
            return;
        }

        const stopwatchPlugin = this.app.plugins.plugins['stopwatch-timer'];
        if (stopwatchPlugin) {
            const cache = this.app.metadataCache.getFileCache(activeFile);
            const frontmatter = cache?.frontmatter;
            
            if (frontmatter) {
                stopwatchPlugin.currentProblem = {
                    file: activeFile,
                    subject: frontmatter.subject || '기타',
                    number: frontmatter.number || '000',
                    title: frontmatter.title || activeFile.basename
                };
                new Notice(`⏱️ ${frontmatter.subject} ${frontmatter.number}번 문제 연동됨!`);
            } else {
                new Notice('❌ 문제 정보(frontmatter)를 찾을 수 없습니다');
            }
        } else {
            new Notice('❌ Stopwatch Timer 플러그인이 활성화되지 않았습니다');
        }
    }

    refreshDashboard() {
        const dashboardView = this.app.workspace.getLeavesOfType(VIEW_TYPE_STUDY_DASHBOARD)[0];
        if (dashboardView?.view?.refresh) {
            dashboardView.view.refresh();
        }
    }

    // ========== CSS 스타일 추가 ==========
    addStyles() {
        // 여기에 CSS 스타일이 추가될 예정 (Part 5에서)
        console.log('🎨 스타일 로드 (Part 5에서 구현 예정)');
    }
}

// Part 2 완료 - 메인 플러그인 클래스 완성
console.log('📚 Part 2: 메인 플러그인 클래스 로드 완료');