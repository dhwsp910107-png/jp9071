import { App, Plugin, PluginSettingTab, Setting, Notice, Modal, Menu, Editor, MarkdownView } from 'obsidian';

// 플랫폼 헬퍼 (모바일/데스크톱 분기)
function isElectronApp(): boolean {
    try {
        const ua = navigator.userAgent || '';
        // User Agent로 Electron 확인
        if (ua.includes('Electron')) return true;
        // window.require 존재 여부만 확인 (실제로 호출하지 않음)
        if (typeof (window as any).require === 'function') {
            return true;
        }
    } catch (e) {}
    return false;
}

function isMobileApp(): boolean {
    try {
        const ua = navigator.userAgent || '';
        return /Android|iPhone|iPad|iPod/.test(ua) && !ua.includes('Electron');
    } catch (e) {
        return false;
    }
}

interface TTSSettings {
    voiceMode: 'browser' | 'custom';
    browserVoice: string;
    speed: number;
    pitch: number;
    volume: number;
    language: string;
    customVoiceData: string | null;
    autoSaveAudio: boolean;
    outputFolder: string;
    audioFolder: string;
    dashboardFolder: string;
}

const DEFAULT_SETTINGS: TTSSettings = {
    voiceMode: 'browser',
    browserVoice: '',
    speed: 1.0,
    pitch: 1.0,
    volume: 1.0,
    language: 'ko-KR',
    customVoiceData: null,
    autoSaveAudio: false,
    outputFolder: 'TTS Audio/Text',
    audioFolder: 'TTS Audio/Voice',
    dashboardFolder: 'TTS Dashboard'
}

export default class TTSVoiceReaderPlugin extends Plugin {
    settings: TTSSettings;
    synthesis: SpeechSynthesis;
    currentUtterance: SpeechSynthesisUtterance | null = null;
    isPlaying: boolean = false;
    availableVoices: SpeechSynthesisVoice[] = [];
    mediaRecorder: MediaRecorder | null = null;
    recordedChunks: Blob[] = [];
    currentAudio: HTMLAudioElement | null = null;
    currentSpeakingText: string = ''; // 현재 읽고 있는 텍스트 (자동 저장용)

    async onload() {
        await this.loadSettings();
        // 모바일(WebView)에서는 speechSynthesis가 지원되지 않을 수 있음
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            this.synthesis = window.speechSynthesis as SpeechSynthesis;
            
            // 음성 목록 로드
            this.loadVoices();
            
            // onvoiceschanged 이벤트 리스너 등록
            if ((window as any).speechSynthesis && (window as any).speechSynthesis.onvoiceschanged !== undefined) {
                (window as any).speechSynthesis.onvoiceschanged = () => {
                    console.log('🔄 onvoiceschanged 이벤트 발생');
                    this.loadVoices();
                };
            }
            
            // 모바일에서 추가 지연 로드 (안드로이드용)
            if (isMobileApp()) {
                console.log('📱 모바일 감지: 지연 음성 로드 시작');
                setTimeout(() => {
                    this.loadVoices();
                }, 1000); // 1초 후 재시도
                
                setTimeout(() => {
                    this.loadVoices();
                }, 3000); // 3초 후 재시도
            }
        } else {
            this.synthesis = null as any;
            // 모바일에서는 브라우저 TTS가 동작하지 않을 수 있음을 알림
            if (isMobileApp()) {
                new Notice('⚠️ 모바일에서는 브라우저 TTS(speechSynthesis)가 지원되지 않을 수 있습니다.');
            }
        }

        // 리본 아이콘 - TTS 음성 읽기
        this.addRibbonIcon('mic', 'TTS 음성 읽기', () => {
            const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
            if (activeView) {
                const editor = activeView.editor;
                const selectedText = editor.getSelection();
                if (selectedText) {
                    this.speakText(selectedText);
                } else {
                    new TTSReaderModal(this.app, this).open();
                }
            } else {
                new TTSReaderModal(this.app, this).open();
            }
        });

        // 리본 아이콘 - TTS 대시보드
        this.addRibbonIcon('layout-dashboard', 'TTS 대시보드', () => {
            new TTSDashboardModal(this.app, this).open();
        });

        // 커맨드: 선택한 텍스트 읽기
        this.addCommand({
            id: 'speak-selection',
            name: '선택한 텍스트 읽기',
            editorCallback: (editor: Editor) => {
                const text = editor.getSelection();
                if (text) {
                    this.speakText(text);
                } else {
                    new Notice('텍스트를 선택해주세요');
                }
            }
        });

        // 커맨드: 전체 노트 읽기
        this.addCommand({
            id: 'speak-entire-note',
            name: '전체 노트 읽기',
            editorCallback: (editor: Editor) => {
                const text = editor.getValue();
                this.speakText(text);
            }
        });

        // 커맨드: 정지
        this.addCommand({
            id: 'stop-speaking',
            name: '음성 읽기 정지',
            callback: () => {
                this.stopSpeaking();
            }
        });

        // 커맨드: 일시정지/재개
        this.addCommand({
            id: 'pause-resume-speaking',
            name: '음성 읽기 일시정지/재개',
            callback: () => {
                this.togglePause();
            }
        });

        // 커맨드: 음성 녹음
        this.addCommand({
            id: 'record-voice',
            name: '내 음성 녹음하기',
            callback: () => {
                new VoiceRecordModal(this.app, this).open();
            }
        });

        // 커맨드: 대시보드 생성
        this.addCommand({
            id: 'create-dashboard',
            name: 'TTS 대시보드 생성',
            callback: async () => {
                await this.createDashboard();
            }
        });

        // 커맨드: TXT 파일 읽기
        this.addCommand({
            id: 'read-txt-file',
            name: 'TXT 파일 내용 읽기',
            editorCallback: async (editor: Editor, view: MarkdownView) => {
                await this.readCurrentTxtFile(view);
            }
        });

        // 파일 열기 이벤트 감지 (TXT 파일 자동 재생)
        this.registerEvent(
            this.app.workspace.on('file-open', async (file) => {
                if (file && file.extension === 'txt' && file.path.includes(this.settings.outputFolder)) {
                    // TTS 출력 폴더의 TXT 파일이 열리면 자동으로 읽어주기
                    const content = await this.app.vault.read(file);
                    // 메타데이터 제거하고 본문만 추출
                    const textContent = this.extractTextFromTTSFile(content);
                    if (textContent) {
                        new Notice(`📖 "${file.basename}" 파일을 읽습니다`);
                        this.speakText(textContent);
                    }
                }
            })
        );

        // 설정 탭
        this.addSettingTab(new TTSSettingTab(this.app, this));

        // 컨텍스트 메뉴
        this.registerEvent(
            this.app.workspace.on('editor-menu', (menu: Menu, editor: Editor) => {
                const selection = editor.getSelection();
                if (selection) {
                    menu.addItem((item) => {
                        item
                            .setTitle('🔊 선택한 텍스트 읽기')
                            .setIcon('mic')
                            .onClick(() => {
                                this.speakText(selection);
                            });
                    });
                }
            })
        );
    }

    loadVoices() {
        if (!this.synthesis) {
            this.availableVoices = [];
            console.error('❌ speechSynthesis가 초기화되지 않았습니다.');
            return;
        }
        
        console.log('🔍 음성 목록 로드 시작...');
        
        // 음성 목록 가져오기
        let voices = this.synthesis.getVoices();
        console.log(`📊 초기 음성 개수: ${voices.length}`);
        
        // 모바일(특히 안드로이드)에서는 getVoices()가 즉시 빈 배열을 반환할 수 있음
        // 이 경우 speak()를 호출하면 음성 목록이 로드됨
        if (voices.length === 0) {
            console.log('🔄 음성 목록 강제 로드 시도 (방법 1: 빈 utterance)');
            
            // 방법 1: 빈 utterance로 강제 로드
            try {
                const utterance = new SpeechSynthesisUtterance('');
                utterance.volume = 0; // 무음
                this.synthesis.speak(utterance);
                this.synthesis.cancel(); // 즉시 취소
                
                // 다시 가져오기
                voices = this.synthesis.getVoices();
                console.log(`📱 방법 1 후 음성 목록: ${voices.length}개`);
            } catch (e) {
                console.error('❌ 방법 1 실패:', e);
            }
            
            // 방법 2: 짧은 텍스트로 강제 로드
            if (voices.length === 0) {
                console.log('🔄 음성 목록 강제 로드 시도 (방법 2: 짧은 텍스트)');
                try {
                    const utterance = new SpeechSynthesisUtterance('a');
                    utterance.volume = 0;
                    utterance.rate = 10; // 빠르게
                    this.synthesis.speak(utterance);
                    
                    // 100ms 후 취소
                    setTimeout(() => {
                        this.synthesis.cancel();
                    }, 100);
                    
                    // 200ms 후 다시 가져오기
                    setTimeout(() => {
                        voices = this.synthesis.getVoices();
                        this.availableVoices = voices;
                        console.log(`📱 방법 2 후 음성 목록: ${voices.length}개`);
                        
                        if (voices.length > 0) {
                            console.log('✅ TTS 음성 로드 완료 (지연):', voices.map(v => `${v.name} (${v.lang})`));
                        }
                    }, 200);
                } catch (e) {
                    console.error('❌ 방법 2 실패:', e);
                }
            }
        }
        
        this.availableVoices = voices;
        
        // 디버그 로그
        if (this.availableVoices.length > 0) {
            console.log(`✅ TTS 음성 로드 완료: ${this.availableVoices.length}개`);
            console.log('사용 가능한 음성:', this.availableVoices.map(v => `${v.name} (${v.lang})`));
        } else {
            console.warn('⚠️ TTS 음성을 찾을 수 없습니다. 기기에서 TTS를 지원하지 않거나 권한이 필요할 수 있습니다.');
            console.log('💡 해결 방법:');
            console.log('  1. 기기 설정에서 TTS 엔진 확인');
            console.log('  2. 옵시디언 앱 권한 확인');
            console.log('  3. 새로고침 버튼을 여러 번 클릭');
        }
        
        // 한국어 음성 자동 선택
        if (!this.settings.browserVoice && this.availableVoices.length > 0) {
            const koreanVoice = this.availableVoices.find(voice => 
                voice.lang.startsWith('ko')
            );
            this.settings.browserVoice = koreanVoice?.name || this.availableVoices[0]?.name || '';
            console.log(`🎤 선택된 음성: ${this.settings.browserVoice}`);
            this.saveSettings();
        }
    }

    speakText(text: string) {
        // 이전 음성 정지
        this.stopSpeaking();

        // 마크다운 문법 제거
        const cleanText = this.cleanMarkdown(text);

        // 현재 읽는 텍스트 저장 (중지 시 자동 저장용)
        this.currentSpeakingText = cleanText;

        if (this.settings.voiceMode === 'browser') {
            new Notice('🌐 브라우저 TTS 모드로 재생');
            this.speakWithBrowser(cleanText);
        } else {
            // 커스텀 음성 - 녹음된 음성 재생
            if (this.settings.customVoiceData) {
                new Notice('🎭 샘플 오디오 재생 (텍스트와 무관)');
                this.speakWithCustomVoice(cleanText);
            } else {
                new Notice('⚠️ 녹음된 음성이 없어 브라우저 TTS로 재생합니다');
                // 폴백: 브라우저 TTS 사용
                this.speakWithBrowser(cleanText);
            }
        }
    }

    async speakWithCustomVoice(text: string) {
        try {
            new Notice('🎭 내 목소리로 읽기 시작...');
            
            // Base64 데이터를 Blob으로 변환
            const base64Data = this.settings.customVoiceData;
            if (!base64Data) {
                throw new Error('음성 프로필이 없습니다');
            }

            // Base64를 Blob으로 변환
            const response = await fetch(base64Data);
            const blob = await response.blob();
            
            // Audio 객체 생성
            const audioUrl = URL.createObjectURL(blob);
            this.currentAudio = new Audio(audioUrl);
            
            this.currentAudio.onplay = () => {
                this.isPlaying = true;
                new Notice('🔊 음성 재생 중...');
            };

            this.currentAudio.onended = async () => {
                this.isPlaying = false;
                URL.revokeObjectURL(audioUrl);
                this.currentAudio = null;
                new Notice('✅ 재생 완료');
                
                // 자동 저장이 활성화된 경우
                if (this.settings.autoSaveAudio) {
                    try {
                        await this.saveTTSAsFile(text);
                    } catch (error) {
                        console.error('TTS 자동 저장 실패:', error);
                    }
                }
            };

            this.currentAudio.onerror = (error) => {
                console.error('Audio playback error:', error);
                this.isPlaying = false;
                URL.revokeObjectURL(audioUrl);
                this.currentAudio = null;
                new Notice('❌ 음성 재생 실패. 브라우저 TTS로 전환합니다.');
                // 폴백: 브라우저 TTS
                this.speakWithBrowser(text);
            };

            // 볼륨 설정 적용
            this.currentAudio.volume = this.settings.volume;
            
            // 재생
            await this.currentAudio.play();

            // 텍스트 정보 표시 (선택사항)
            console.log('재생할 텍스트:', text.substring(0, 100) + '...');
            new Notice(`📝 텍스트 길이: ${text.length}자 (녹음된 샘플 재생)`);
            
        } catch (error) {
            console.error('Custom voice playback error:', error);
            new Notice('❌ 내 목소리 재생 실패: ' + error.message + '. 브라우저 TTS로 전환합니다.');
            // 폴백: 브라우저 TTS
            this.speakWithBrowser(text);
        }
    }

    speakWithBrowser(text: string) {
        // 모바일 환경에서 speechSynthesis가 없으면 알림 후 리턴
        if (!this.synthesis) {
            console.error('❌ speechSynthesis가 없습니다.');
            new Notice('⚠️ 브라우저 TTS 기능이 지원되지 않습니다');
            return;
        }
        
        console.log('🎤 TTS 재생 시작...');
        console.log('📝 텍스트 길이:', text.length);
        
        // 모바일에서 음성 목록이 비어있으면 다시 로드 시도
        if (this.availableVoices.length === 0) {
            console.log('⚠️ 음성 목록이 비어있음. 재로드 시도...');
            this.loadVoices();
            
            // 짧은 대기 후 재시도
            setTimeout(() => {
                if (this.availableVoices.length === 0) {
                    console.warn('❌ 음성 로드 실패. 기본 음성으로 재생 시도...');
                    new Notice('⚠️ 음성 목록이 없습니다. 기본 음성으로 재생합니다.');
                }
            }, 500);
        }

        const utterance = new SpeechSynthesisUtterance(text);
        
        // 설정 적용
        const voice = this.availableVoices.find(v => v.name === this.settings.browserVoice);
        if (voice) {
            utterance.voice = voice;
            console.log(`🎤 사용 음성: ${voice.name} (${voice.lang})`);
        } else if (this.availableVoices.length > 0) {
            // 설정된 음성이 없으면 첫 번째 음성 사용
            utterance.voice = this.availableVoices[0];
            console.log(`🎤 기본 음성 사용: ${this.availableVoices[0].name}`);
        } else {
            console.warn('⚠️ 사용 가능한 음성이 없습니다. 시스템 기본값으로 재생합니다.');
        }
        
        utterance.rate = this.settings.speed;
        utterance.pitch = this.settings.pitch;
        utterance.volume = this.settings.volume;
        utterance.lang = this.settings.language;
        
        console.log('⚙️ TTS 설정:', {
            voice: utterance.voice?.name || 'system default',
            rate: utterance.rate,
            pitch: utterance.pitch,
            volume: utterance.volume,
            lang: utterance.lang
        });

        // 이벤트 핸들러
        utterance.onstart = () => {
            console.log('▶️ TTS 재생 시작됨');
            this.isPlaying = true;
            new Notice('🔊 음성 읽기 시작');
        };

        utterance.onend = async () => {
            console.log('⏹️ TTS 재생 종료됨');
            this.isPlaying = false;
            this.currentUtterance = null;
            new Notice('✅ 음성 읽기 완료');
            
            // 자동 저장이 활성화된 경우 TTS 출력을 파일로 저장
            if (this.settings.autoSaveAudio) {
                try {
                    await this.saveTTSAsFile(text);
                } catch (error) {
                    console.error('TTS 자동 저장 실패:', error);
                }
            }
        };

        utterance.onerror = (event) => {
            console.error('❌ TTS 오류 발생:', event);
            console.error('오류 상세:', {
                error: event.error,
                charIndex: event.charIndex,
                elapsedTime: event.elapsedTime
            });
            this.isPlaying = false;
            this.currentUtterance = null;
            new Notice('❌ 음성 읽기 오류: ' + event.error);
        };

        this.currentUtterance = utterance;
        
        // 재생 전 상태 확인
        console.log('🔍 재생 직전 상태:', {
            isPaused: this.synthesis.paused,
            isPending: this.synthesis.pending,
            isSpeaking: this.synthesis.speaking
        });
        
        // 이전 재생 취소
        this.synthesis.cancel();
        
        // 재생 시작
        console.log('▶️ synthesis.speak() 호출...');
        this.synthesis.speak(utterance);
        
        // 재생 후 상태 확인
        setTimeout(() => {
            console.log('🔍 재생 시작 후 상태 (100ms):', {
                isPaused: this.synthesis.paused,
                isPending: this.synthesis.pending,
                isSpeaking: this.synthesis.speaking,
                isPlayingFlag: this.isPlaying
            });
        }, 100);
    }

    async saveTTSAsFile(text: string) {
        try {
            const folderPath = this.settings.outputFolder;
            const folder = this.app.vault.getAbstractFileByPath(folderPath);
            
            if (!folder) {
                await this.app.vault.createFolder(folderPath);
            }

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            const filename = `tts_${timestamp}.txt`;
            const filePath = `${folderPath}/${filename}`;
            
            const content = `# TTS 음성 텍스트\n\n생성: ${new Date().toLocaleString('ko-KR')}\n음성 모드: ${this.settings.voiceMode}\n언어: ${this.settings.language}\n\n---\n\n${text}`;
            
            await this.app.vault.create(filePath, content);
            new Notice(`✅ TTS 텍스트 저장: ${filename}`);
            
            // 오디오 파일도 저장 시도 (커스텀 음성인 경우)
            if (this.settings.voiceMode === 'custom' && this.settings.customVoiceData) {
                try {
                    // Base64 데이터를 Blob으로 변환
                    const response = await fetch(this.settings.customVoiceData);
                    const blob = await response.blob();
                    await this.saveAudioFile(blob, `tts_${timestamp}`);
                } catch (error) {
                    console.error('오디오 파일 저장 실패:', error);
                }
            }
        } catch (error) {
            console.error('TTS 파일 저장 실패:', error);
            throw error;
        }
    }

    async stopSpeaking() {
        // 자동 저장이 활성화되어 있고 현재 읽고 있는 텍스트가 있으면 저장
        if (this.settings.autoSaveAudio && this.currentSpeakingText && (this.synthesis.speaking || this.currentAudio)) {
            try {
                await this.saveTTSAsFile(this.currentSpeakingText);
            } catch (error) {
                console.error('중지 시 자동 저장 실패:', error);
            }
        }

        // 브라우저 TTS 정지
        if (this.synthesis.speaking) {
            this.synthesis.cancel();
            this.isPlaying = false;
            this.currentUtterance = null;
        }
        
        // 커스텀 오디오 정지
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio.currentTime = 0;
            const audioUrl = this.currentAudio.src;
            if (audioUrl.startsWith('blob:')) {
                URL.revokeObjectURL(audioUrl);
            }
            this.currentAudio = null;
            this.isPlaying = false;
        }

        // 현재 텍스트 초기화
        this.currentSpeakingText = '';
        
        new Notice('⏹️ 음성 읽기 정지');
    }

    togglePause() {
        // 커스텀 오디오 일시정지/재개
        if (this.currentAudio) {
            if (this.currentAudio.paused) {
                this.currentAudio.play();
                new Notice('▶️ 재개');
            } else {
                this.currentAudio.pause();
                new Notice('⏸️ 일시정지');
            }
            return;
        }
        
        // 브라우저 TTS 일시정지/재개
        if (this.synthesis.speaking) {
            if (this.synthesis.paused) {
                this.synthesis.resume();
                new Notice('▶️ 재개');
            } else {
                this.synthesis.pause();
                new Notice('⏸️ 일시정지');
            }
        }
    }

    // TXT 파일 내용 추출 (메타데이터 제거)
    extractTextFromTTSFile(content: string): string {
        // "# TTS 음성 텍스트" 헤더와 메타데이터 부분 제거
        const lines = content.split('\n');
        let textStart = -1;
        
        // "---" 구분선 이후부터 텍스트로 간주
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].trim() === '---') {
                textStart = i + 1;
                break;
            }
        }
        
        if (textStart === -1) {
            // 메타데이터가 없으면 전체 내용 반환
            return content.trim();
        }
        
        // 메타데이터 이후의 텍스트만 추출
        const textContent = lines.slice(textStart).join('\n').trim();
        return textContent;
    }

    // 플랫폼 검사 유틸리티
    isElectronApp(): boolean {
        try {
            const ua = navigator.userAgent || '';
            // User Agent로 Electron 확인
            if (ua.includes('Electron')) return true;
            // window.require 존재 여부만 확인 (실제로 호출하지 않음)
            if (typeof (window as any).require === 'function') {
                return true;
            }
        } catch (e) {}
        return false;
    }

    isMobileApp(): boolean {
        try {
            const ua = navigator.userAgent || '';
            return /Android|iPhone|iPad|iPod/.test(ua) && !ua.includes('Electron');
        } catch (e) {
            return false;
        }
    }

    // 현재 열린 TXT 파일 읽기
    async readCurrentTxtFile(view: MarkdownView) {
        const file = view.file;
        if (!file) {
            new Notice('파일이 열려있지 않습니다');
            return;
        }
        
        if (file.extension !== 'txt') {
            new Notice('TXT 파일만 읽을 수 있습니다');
            return;
        }
        
        const content = await this.app.vault.read(file);
        const textContent = this.extractTextFromTTSFile(content);
        
        if (textContent) {
            new Notice(`📖 "${file.basename}" 파일을 읽습니다`);
            this.speakText(textContent);
        } else {
            new Notice('읽을 내용이 없습니다');
        }
    }

    cleanMarkdown(text: string): string {
        return text
            .replace(/^#+\s+/gm, '') // 헤더
            .replace(/\*\*(.+?)\*\*/g, '$1') // 굵게
            .replace(/\*(.+?)\*/g, '$1') // 기울임
            .replace(/~~(.+?)~~/g, '$1') // 취소선
            .replace(/\[(.+?)\]\(.+?\)/g, '$1') // 링크
            .replace(/!\[.*?\]\(.+?\)/g, '') // 이미지
            .replace(/```[\s\S]*?```/g, '') // 코드 블록
            .replace(/`(.+?)`/g, '$1') // 인라인 코드
            .replace(/^\s*[-*+]\s+/gm, '') // 리스트
            .replace(/^\s*\d+\.\s+/gm, '') // 번호 리스트
            .replace(/^\s*>\s+/gm, '') // 인용
            .replace(/---+/g, '') // 구분선
            .trim();
    }

    async startRecording(): Promise<void> {
        try {
            // 마이크 권한 확인
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('이 브라우저는 오디오 녹음을 지원하지 않습니다.');
            }

            new Notice('🎙️ 마이크 접근 권한을 요청합니다...');
            
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 44100
                }
            });
            
            this.recordedChunks = [];
            
            // MediaRecorder 지원 확인
            if (!window.MediaRecorder) {
                throw new Error('이 브라우저는 MediaRecorder를 지원하지 않습니다.');
            }

            // 지원되는 MIME 타입 확인 (모바일 호환성 개선)
            let mimeType = 'audio/webm;codecs=opus';
            
            if (!MediaRecorder.isTypeSupported(mimeType)) {
                mimeType = 'audio/webm';
            }
            if (!MediaRecorder.isTypeSupported(mimeType)) {
                mimeType = 'audio/ogg;codecs=opus';
            }
            if (!MediaRecorder.isTypeSupported(mimeType)) {
                mimeType = 'audio/ogg';
            }
            if (!MediaRecorder.isTypeSupported(mimeType)) {
                mimeType = 'audio/mp4';
            }
            if (!MediaRecorder.isTypeSupported(mimeType)) {
                // 타입 지정 없이 시도
                mimeType = '';
            }
            
            console.log('Using MIME type for recording:', mimeType || 'default');
            
            const options = mimeType ? { mimeType } : {};
            this.mediaRecorder = new MediaRecorder(stream, options);
            
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                    console.log('Recording chunk received:', event.data.size, 'bytes');
                }
            };

            this.mediaRecorder.onerror = (event: any) => {
                console.error('MediaRecorder error:', event.error);
                new Notice('❌ 녹음 중 오류 발생: ' + event.error);
            };

            this.mediaRecorder.start(100); // 100ms마다 데이터 수집
            console.log('MediaRecorder started, state:', this.mediaRecorder.state);
            new Notice('🎙️ 녹음 시작됨');
        } catch (error) {
            console.error('Recording start error:', error);
            new Notice('❌ 마이크 접근 실패: ' + error.message);
            throw error;
        }
    }

    async stopRecording(): Promise<Blob | null> {
        return new Promise((resolve) => {
            if (!this.mediaRecorder) {
                console.warn('No MediaRecorder to stop');
                resolve(null);
                return;
            }

            if (this.mediaRecorder.state === 'inactive') {
                console.warn('MediaRecorder already stopped');
                resolve(null);
                return;
            }

            this.mediaRecorder.onstop = () => {
                console.log('MediaRecorder stopped, chunks:', this.recordedChunks.length);
                
                if (this.recordedChunks.length === 0) {
                    new Notice('❌ 녹음된 데이터가 없습니다');
                    resolve(null);
                    return;
                }

                const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
                const blob = new Blob(this.recordedChunks, { type: mimeType });
                console.log('Audio blob created:', blob.size, 'bytes, type:', blob.type);
                
                this.recordedChunks = [];
                
                // 스트림 정지
                this.mediaRecorder?.stream.getTracks().forEach(track => {
                    track.stop();
                    console.log('Track stopped:', track.kind);
                });
                this.mediaRecorder = null;
                
                new Notice('⏹️ 녹음 완료 (' + Math.round(blob.size / 1024) + 'KB)');
                resolve(blob);
            };

            this.mediaRecorder.stop();
            console.log('Stopping MediaRecorder...');
        });
    }

    async saveAudioFile(audioBlob: Blob, fileName: string) {
        try {
            // 오디오 출력 폴더 확인 (audioFolder 사용)
            const folderPath = this.settings.audioFolder;
            const folder = this.app.vault.getAbstractFileByPath(folderPath);
            
            if (!folder) {
                await this.app.vault.createFolder(folderPath);
            }

            // Blob을 ArrayBuffer로 변환
            const arrayBuffer = await audioBlob.arrayBuffer();
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            
            // 파일명에 이미 확장자가 있으면 그대로 사용, 없으면 추가
            const baseFileName = fileName.includes('.') ? fileName.split('.')[0] : fileName;
            const extension = fileName.includes('.') ? fileName.split('.').pop() : 'webm';
            const filePath = `${folderPath}/${baseFileName}_${timestamp}.${extension}`;

            // 파일 저장
            await this.app.vault.createBinary(filePath, arrayBuffer);
            
            console.log('Audio file saved:', filePath, arrayBuffer.byteLength, 'bytes');
            new Notice(`✅ 음성 파일 저장: ${filePath}`);
            return filePath;
        } catch (error) {
            new Notice('❌ 파일 저장 실패: ' + error.message);
        }
    }

    async createDashboard() {
        try {
            const dashboardFolder = this.settings.dashboardFolder;
            const audioFolder = this.settings.outputFolder;
            
            // 폴더 확인 및 생성
            if (!this.app.vault.getAbstractFileByPath(dashboardFolder)) {
                await this.app.vault.createFolder(dashboardFolder);
            }
            
            // 대시보드 파일 생성
            const dashboardPath = `${dashboardFolder}/TTS 통합 대시보드.md`;
            const dashboardContent = this.generateDashboardContent();
            
            const existingFile = this.app.vault.getAbstractFileByPath(dashboardPath);
            if (existingFile) {
                await this.app.vault.modify(existingFile as any, dashboardContent);
                new Notice('✅ TTS 대시보드 업데이트 완료');
            } else {
                await this.app.vault.create(dashboardPath, dashboardContent);
                new Notice('✅ TTS 대시보드 생성 완료');
            }
            
            // 대시보드 열기
            const file = this.app.vault.getAbstractFileByPath(dashboardPath);
            if (file) {
                await this.app.workspace.openLinkText(dashboardPath, '', false);
            }
        } catch (error) {
            new Notice('❌ 대시보드 생성 실패: ' + error.message);
            console.error('Dashboard creation error:', error);
        }
    }

    generateDashboardContent(): string {
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        
        return `---
title: TTS 통합 대시보드
created: ${dateStr}
tags: [tts, dashboard, audio]
---

# 🎙️ TTS 통합 대시보드

> 마지막 업데이트: ${now.toLocaleString('ko-KR')}

## 🎯 빠른 실행

\`\`\`button
name � 새 텍스트 읽기
type command
action TTS 음성 읽기
color blue
\`\`\`
^button-new-tts

\`\`\`button
name 🎙️ 음성 녹음
type command
action 내 음성 녹음하기
color green
\`\`\`
^button-record

\`\`\`button
name ⏹️ 음성 정지
type command
action 음성 읽기 정지
color red
\`\`\`
^button-stop

\`\`\`button
name ⏸️ 일시정지/재개
type command
action 음성 읽기 일시정지/재개
color default
\`\`\`
^button-pause

\`\`\`button
name 🔄 대시보드 새로고침
type command
action TTS 대시보드 생성
color purple
\`\`\`
^button-refresh

---

## �📊 통계 요약

\`\`\`dataviewjs
const audioFolder = "${this.settings.outputFolder}";
const txtFiles = dv.pages('"' + audioFolder + '"').where(p => p.file.name.endsWith('.txt'));
const audioFiles = dv.pages('"' + audioFolder + '"').where(p => p.file.name.endsWith('.webm') || p.file.name.endsWith('.mp4') || p.file.name.endsWith('.ogg'));

const totalTxt = txtFiles.length;
const totalAudio = audioFiles.length;
const voiceProfiles = audioFiles.where(f => f.file.name.includes('voice_profile')).length;

dv.paragraph(\`
📄 **저장된 TTS 텍스트**: \${totalTxt}개  
🎵 **오디오 파일**: \${totalAudio}개  
🎭 **음성 프로필**: \${voiceProfiles}개
\`);
\`\`\`

---

## 📄 저장된 TTS 텍스트 파일

> 💡 **파일명을 클릭하면 내용을 읽어줍니다**

\`\`\`dataviewjs
const audioFolder = "${this.settings.outputFolder}";
const txtFiles = dv.pages('"' + audioFolder + '"')
    .where(p => p.file.name.endsWith('.txt'))
    .sort(p => p.file.ctime, 'desc');

if (txtFiles.length === 0) {
    dv.paragraph('❌ 저장된 TTS 텍스트 파일이 없습니다.');
    dv.paragraph('💡 자동 저장 기능을 활성화하면 TTS로 읽은 텍스트가 자동으로 저장됩니다.');
} else {
    dv.table(
        ['#', '파일명', '생성일', '크기', '📖 읽기'],
        txtFiles.map((p, idx) => {
            const fileName = p.file.name.replace('.txt', '');
            const filePath = p.file.path;
            return [
                idx + 1,
                fileName,
                p.file.ctime ? new Date(p.file.ctime).toLocaleString('ko-KR', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                }) : 'N/A',
                p.file.size ? (p.file.size / 1024).toFixed(1) + ' KB' : 'N/A',
                '[\`▶️ 재생\`](' + filePath + ')'
            ];
        })
    );
    
    dv.paragraph('');
    dv.paragraph('**사용법**: 📖 읽기 열의 \`▶️ 재생\` 링크를 클릭하면 파일 내용이 TTS로 재생됩니다.');
}
\`\`\`

---

## 📂 폴더별 파일 목록

\`\`\`dataviewjs
const baseFolder = "${this.settings.outputFolder}";
const allFiles = dv.pages('"' + baseFolder + '"');

// 폴더별로 그룹화
const folders = {};
for (const page of allFiles) {
    const pathParts = page.file.folder.split('/');
    const folderName = pathParts[pathParts.length - 1] || baseFolder;
    
    if (!folders[folderName]) {
        folders[folderName] = [];
    }
    folders[folderName].push(page);
}

// 각 폴더별 테이블 생성
for (const [folderName, files] of Object.entries(folders)) {
    if (files.length === 0) continue;
    
    dv.header(3, \`📂 \${folderName} (\${files.length}개)\`);
    
    dv.table(
        ['파일명', '유형', '생성일', '크기', '링크'],
        files.map(p => {
            let fileType = '📄 기타';
            if (p.file.name.endsWith('.txt')) fileType = '� 텍스트';
            else if (p.file.name.endsWith('.webm') || p.file.name.endsWith('.mp4')) fileType = '🎵 오디오';
            else if (p.file.name.includes('voice_profile')) fileType = '🎭 프로필';
            
            return [
                p.file.name,
                fileType,
                p.file.ctime ? new Date(p.file.ctime).toLocaleString('ko-KR') : 'N/A',
                p.file.size ? (p.file.size / 1024).toFixed(1) + ' KB' : 'N/A',
                dv.fileLink(p.file.path, false, '🔗')
            ];
        })
    );
}
\`\`\`

---

## 📅 최근 활동 (최근 15개)

\`\`\`dataviewjs
const audioFolder = "${this.settings.outputFolder}";
const recentFiles = dv.pages('"' + audioFolder + '"')
    .sort(p => p.file.ctime, 'desc')
    .limit(15);

if (recentFiles.length === 0) {
    dv.paragraph('❌ 최근 파일이 없습니다.');
} else {
    dv.table(
        ['#', '파일명', '유형', '생성일', '동작'],
        recentFiles.map((p, idx) => {
            let fileType = '📄';
            let action = dv.fileLink(p.file.path, false, '🔗 열기');
            
            if (p.file.name.endsWith('.txt')) {
                fileType = '📝 TXT';
                action = '[\`▶️ 재생\`](' + p.file.path + ')';
            } else if (p.file.name.endsWith('.webm') || p.file.name.endsWith('.mp4')) {
                fileType = '🎵 Audio';
            } else if (p.file.name.includes('voice_profile')) {
                fileType = '🎭 Profile';
            }
            
            return [
                idx + 1,
                p.file.name,
                fileType,
                p.file.ctime ? new Date(p.file.ctime).toLocaleString('ko-KR', {
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                }) : 'N/A',
                action
            ];
        })
    );
}
\`\`\`

---

## ⚙️ 현재 설정

\`\`\`dataviewjs
dv.paragraph(\`
**🎵 음성 모드**: ${this.settings.voiceMode === 'browser' ? '🌐 브라우저 TTS' : '🎭 샘플 오디오 재생'}  
**🌍 언어**: ${this.settings.language}  
**⚡ 속도**: ${this.settings.speed}x  
**� 음높이**: ${this.settings.pitch}  
**🔊 볼륨**: ${this.settings.volume}  
**💾 자동 저장**: ${this.settings.autoSaveAudio ? '✅ 활성화' : '❌ 비활성화'}  
**📁 출력 폴더**: \\\`${this.settings.outputFolder}\\\`  
**🎭 음성 프로필**: ${this.settings.customVoiceData ? '✅ 등록됨' : '❌ 미등록'}
\`);
\`\`\`

${this.settings.voiceMode === 'custom' ? `
> ⚠️ **커스텀 음성 모드 안내**  
> 현재 모드는 녹음한 샘플 오디오를 재생합니다.  
> 텍스트에 따라 음성이 생성되지 않으며, 항상 같은 샘플이 재생됩니다.  
> 텍스트를 음성으로 변환하려면 "브라우저 TTS" 모드를 사용하세요.
` : ''}

---

## 💡 사용 팁

- **TXT 파일 재생**: 위의 "저장된 TTS 텍스트 파일" 섹션에서 \`▶️ 재생\` 링크를 클릭하면 자동으로 내용을 읽어줍니다
- **자동 저장**: 설정에서 "자동 저장" 기능을 활성화하면 TTS로 읽은 모든 텍스트가 자동으로 저장됩니다
- **단축키**: 
  - 선택한 텍스트 읽기: 텍스트 선택 후 커맨드 실행
  - 전체 노트 읽기: 커맨드 팔레트에서 실행
  - 정지/일시정지: 버튼 또는 커맨드로 제어

---

*📌 이 대시보드는 자동으로 생성되었습니다. "🔄 대시보드 새로고침" 버튼을 눌러 최신 정보로 업데이트하세요.*
`;
    }

    async onunload() {
        this.stopSpeaking();
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
        }
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}

class TTSReaderModal extends Modal {
    plugin: TTSVoiceReaderPlugin;
    textArea: HTMLTextAreaElement;

    constructor(app: App, plugin: TTSVoiceReaderPlugin) {
        super(app);
        this.plugin = plugin;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('tts-reader-modal');

        contentEl.createEl('h2', { text: '🔊 TTS 음성 읽기' });

        // 텍스트 입력
        this.textArea = contentEl.createEl('textarea', {
            attr: { placeholder: '읽을 텍스트를 입력하세요...' }
        });
        this.textArea.style.width = '100%';
        this.textArea.style.minHeight = '200px';
        this.textArea.style.marginBottom = '12px';

        // 버튼 컨테이너
        const buttonContainer = contentEl.createDiv({ cls: 'tts-button-container' });

        // 읽기 버튼
        const speakBtn = buttonContainer.createEl('button', { 
            text: '▶️ 읽기',
            cls: 'mod-cta'
        });
        speakBtn.onclick = () => {
            const text = this.textArea.value;
            if (text.trim()) {
                this.plugin.speakText(text);
            } else {
                new Notice('텍스트를 입력해주세요');
            }
        };

        // 정지 버튼
        const stopBtn = buttonContainer.createEl('button', { text: '⏹️ 정지' });
        stopBtn.onclick = () => {
            this.plugin.stopSpeaking();
        };

        // 일시정지 버튼
        const pauseBtn = buttonContainer.createEl('button', { text: '⏸️ 일시정지/재개' });
        pauseBtn.onclick = () => {
            this.plugin.togglePause();
        };
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

class VoiceRecordModal extends Modal {
    plugin: TTSVoiceReaderPlugin;
    isRecording: boolean = false;
    recordButton: HTMLButtonElement;
    statusText: HTMLDivElement;
    recordingTime: number = 0;
    timerInterval: number | null = null;

    constructor(app: App, plugin: TTSVoiceReaderPlugin) {
        super(app);
        this.plugin = plugin;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('voice-record-modal');

        contentEl.createEl('h2', { text: '🎙️ 내 음성 녹음하기' });
        
        contentEl.createEl('p', { 
            text: '10초~60초 동안 자연스럽게 말해주세요. 녹음된 음성은 음성 프로필로 저장됩니다.',
            cls: 'voice-record-desc'
        });

        // 상태 표시
        this.statusText = contentEl.createDiv({ cls: 'recording-status' });
        this.statusText.textContent = '준비됨';

        // 타이머 표시
        const timerDisplay = contentEl.createDiv({ cls: 'recording-timer' });
        timerDisplay.textContent = '00:00';

        // 녹음 버튼
        this.recordButton = contentEl.createEl('button', { 
            text: '🔴 녹음 시작',
            cls: 'mod-cta record-button'
        });

        this.recordButton.onclick = async () => {
            if (!this.isRecording) {
                await this.startRecording(timerDisplay);
            } else {
                await this.stopRecording();
            }
        };

        // 안내 텍스트
        const guide = contentEl.createDiv({ cls: 'recording-guide' });
        guide.innerHTML = `
            <h4>📋 녹음 가이드:</h4>
            <ul>
                <li>조용한 환경에서 녹음하세요</li>
                <li>마이크와 적당한 거리를 유지하세요</li>
                <li>자연스럽고 또박또박 말해주세요</li>
                <li>최소 10초 이상 녹음해주세요</li>
                <li>예시: "안녕하세요. 저는 [이름]입니다. 오늘은 날씨가 좋네요. 옵시디언으로 공부 중입니다."</li>
            </ul>
        `;
    }

    async startRecording(timerDisplay: HTMLDivElement) {
        try {
            this.isRecording = true;
            this.recordButton.textContent = '⏹️ 녹음 중지';
            this.recordButton.removeClass('mod-cta');
            this.recordButton.addClass('mod-warning');
            this.statusText.textContent = '🎙️ 녹음 중...';
            this.statusText.style.color = 'var(--text-error)';
            
            this.recordingTime = 0;
            this.timerInterval = window.setInterval(() => {
                this.recordingTime++;
                const minutes = Math.floor(this.recordingTime / 60);
                const seconds = this.recordingTime % 60;
                timerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            }, 1000);

            await this.plugin.startRecording();
        } catch (error) {
            this.isRecording = false;
            this.recordButton.textContent = '🔴 녹음 시작';
            this.recordButton.removeClass('mod-warning');
            this.recordButton.addClass('mod-cta');
            this.statusText.textContent = '❌ 녹음 시작 실패';
            this.statusText.style.color = 'var(--text-error)';
            
            if (this.timerInterval) {
                clearInterval(this.timerInterval);
                this.timerInterval = null;
            }
        }
    }

    async stopRecording() {
        this.isRecording = false;
        this.recordButton.textContent = '⏳ 처리 중...';
        this.recordButton.removeClass('mod-warning');
        this.recordButton.disabled = true;
        this.statusText.textContent = '처리 중...';
        this.statusText.style.color = 'var(--text-muted)';

        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }

        try {
            const audioBlob = await this.plugin.stopRecording();

            if (audioBlob && audioBlob.size > 0) {
                this.statusText.textContent = '💾 저장 중...';
                
                // ⚠️ 음성 프로필 녹음만 자동 저장 (일반 녹음은 사용자가 저장 버튼 클릭)
                // Base64로 변환하여 설정에 저장 (음성 프로필용)
                const reader = new FileReader();
                reader.onloadend = async () => {
                    try {
                        const base64 = reader.result as string;
                        this.plugin.settings.customVoiceData = base64;
                        await this.plugin.saveSettings();
                        
                        // 음성 프로필 파일도 저장 (참조용)
                        const extension = audioBlob.type.includes('webm') ? 'webm' : 
                                        audioBlob.type.includes('ogg') ? 'ogg' : 
                                        audioBlob.type.includes('mp4') ? 'mp4' : 'webm';
                        await this.plugin.saveAudioFile(audioBlob, `my_voice_profile.${extension}`);
                        
                        this.statusText.textContent = '✅ 녹음 완료! 음성 프로필이 저장되었습니다.';
                        this.statusText.style.color = 'var(--text-success)';
                        new Notice('✅ 음성 프로필 저장 완료! (' + Math.round(audioBlob.size / 1024) + 'KB)');
                        
                        setTimeout(() => this.close(), 2000);
                    } catch (error) {
                        this.statusText.textContent = '❌ 저장 실패: ' + error.message;
                        this.statusText.style.color = 'var(--text-error)';
                        this.recordButton.disabled = false;
                        this.recordButton.textContent = '🔴 녹음 시작';
                        this.recordButton.addClass('mod-cta');
                        console.error('Save voice profile error:', error);
                    }
                };
                reader.onerror = () => {
                    this.statusText.textContent = '❌ 파일 읽기 실패';
                    this.statusText.style.color = 'var(--text-error)';
                    this.recordButton.disabled = false;
                    this.recordButton.textContent = '🔴 녹음 시작';
                    this.recordButton.addClass('mod-cta');
                };
                reader.readAsDataURL(audioBlob);
            } else {
                this.statusText.textContent = '❌ 녹음 데이터가 없습니다. 다시 시도하세요.';
                this.statusText.style.color = 'var(--text-error)';
                this.recordButton.disabled = false;
                this.recordButton.textContent = '🔴 녹음 시작';
                this.recordButton.addClass('mod-cta');
            }
        } catch (error) {
            this.statusText.textContent = '❌ 녹음 중지 실패: ' + error.message;
            this.statusText.style.color = 'var(--text-error)';
            this.recordButton.disabled = false;
            this.recordButton.textContent = '🔴 녹음 시작';
            this.recordButton.addClass('mod-cta');
            console.error('Stop recording error:', error);
        }
    }

    onClose() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }
        const { contentEl } = this;
        contentEl.empty();
    }
}

class TTSSettingTab extends PluginSettingTab {
    plugin: TTSVoiceReaderPlugin;

    constructor(app: App, plugin: TTSVoiceReaderPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    async display(): Promise<void> {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'TTS 음성 설정' });
        
        // 모바일에서 음성 목록 재로드 (비동기 대기)
        if (this.plugin.availableVoices.length === 0) {
            console.log('⚠️ 설정 탭: 음성 목록이 비어있음. 재로드 시도...');
            this.plugin.loadVoices();
            
            // 1초 대기 후 재시도
            await new Promise(resolve => setTimeout(resolve, 1000));
            this.plugin.loadVoices();
            
            // 추가 1초 대기
            await new Promise(resolve => setTimeout(resolve, 1000));
            this.plugin.loadVoices();
        }

        // 음성 모드
        new Setting(containerEl)
            .setName('음성 모드')
            .setDesc('브라우저 TTS: 텍스트를 음성으로 변환 | 커스텀: 녹음한 샘플 오디오 재생 (텍스트와 무관)')
            .addDropdown(dropdown => dropdown
                .addOption('browser', '🔊 브라우저 TTS (권장)')
                .addOption('custom', '🎭 내 목소리 샘플 재생')
                .setValue(this.plugin.settings.voiceMode)
                .onChange(async (value: 'browser' | 'custom') => {
                    this.plugin.settings.voiceMode = value;
                    await this.plugin.saveSettings();
                    if (value === 'custom' && !this.plugin.settings.customVoiceData) {
                        new Notice('⚠️ 먼저 음성을 녹음해주세요');
                    } else if (value === 'custom') {
                        new Notice('⚠️ 커스텀 모드는 녹음한 샘플만 재생합니다 (TTS 아님)');
                    }
                    this.display(); // 설정 화면 새로고침
                }));

        // 브라우저 음성 선택
        const voiceSetting = new Setting(containerEl)
            .setName('브라우저 음성')
            .setDesc('사용할 음성을 선택하세요');
        
        // 새로고침 버튼 추가
        voiceSetting.addButton(button => button
            .setButtonText('🔄 새로고침')
            .setTooltip('음성 목록 다시 불러오기')
            .onClick(async () => {
                new Notice('🔄 음성 목록 새로고침 중...');
                this.plugin.loadVoices();
                await new Promise(resolve => setTimeout(resolve, 1000));
                this.plugin.loadVoices();
                await new Promise(resolve => setTimeout(resolve, 1000));
                this.plugin.loadVoices();
                await new Promise(resolve => setTimeout(resolve, 500));
                this.display(); // 화면 새로고침
                new Notice(`✅ ${this.plugin.availableVoices.length}개 음성 로드됨`);
            }));
        
        // 음성 목록이 있는지 확인
        if (this.plugin.availableVoices.length === 0) {
            voiceSetting.setDesc('⚠️ 사용 가능한 음성이 없습니다. 새로고침 버튼을 눌러주세요.');
            console.warn('❌ 음성 목록이 비어있습니다:', this.plugin.availableVoices);
        } else {
            voiceSetting.setDesc(`✅ ${this.plugin.availableVoices.length}개 음성 사용 가능`);
            console.log(`✅ 설정 탭: ${this.plugin.availableVoices.length}개 음성 표시`);
        }
        
        voiceSetting.addDropdown(dropdown => {
            // 음성 목록이 비어있으면 기본 옵션만 표시
            if (this.plugin.availableVoices.length === 0) {
                dropdown.addOption('', '(음성 없음 - 새로고침 필요)');
            } else {
                this.plugin.availableVoices.forEach(voice => {
                    dropdown.addOption(voice.name, `${voice.name} (${voice.lang})`);
                });
            }
            
            dropdown.setValue(this.plugin.settings.browserVoice);
            dropdown.onChange(async (value) => {
                this.plugin.settings.browserVoice = value;
                await this.plugin.saveSettings();
                console.log(`🎤 음성 변경됨: ${value}`);
            });
            return dropdown;
        });

        // 언어
        new Setting(containerEl)
            .setName('언어')
            .setDesc('음성 읽기 언어')
            .addDropdown(dropdown => dropdown
                .addOption('ko-KR', '한국어')
                .addOption('en-US', '영어')
                .addOption('ja-JP', '일본어')
                .addOption('zh-CN', '중국어')
                .setValue(this.plugin.settings.language)
                .onChange(async (value) => {
                    this.plugin.settings.language = value;
                    await this.plugin.saveSettings();
                }));

        // 속도
        new Setting(containerEl)
            .setName('읽기 속도')
            .setDesc('음성 읽기 속도 (0.5 = 느림, 1.0 = 보통, 2.0 = 빠름)')
            .addSlider(slider => slider
                .setLimits(0.5, 2.0, 0.1)
                .setValue(this.plugin.settings.speed)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.speed = value;
                    await this.plugin.saveSettings();
                }));

        // 음높이
        new Setting(containerEl)
            .setName('음높이')
            .setDesc('음성의 높낮이 (0.5 = 낮음, 1.0 = 보통, 2.0 = 높음)')
            .addSlider(slider => slider
                .setLimits(0.5, 2.0, 0.1)
                .setValue(this.plugin.settings.pitch)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.pitch = value;
                    await this.plugin.saveSettings();
                }));

        // 음량
        new Setting(containerEl)
            .setName('음량')
            .setDesc('음성의 크기 (0.0 = 무음, 1.0 = 최대)')
            .addSlider(slider => slider
                .setLimits(0.0, 1.0, 0.1)
                .setValue(this.plugin.settings.volume)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.volume = value;
                    await this.plugin.saveSettings();
                }));

        // 자동 저장
        new Setting(containerEl)
            .setName('📝 자동 저장')
            .setDesc('TTS 읽기가 완료되면 텍스트를 자동으로 파일로 저장')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.autoSaveAudio)
                .onChange(async (value) => {
                    this.plugin.settings.autoSaveAudio = value;
                    await this.plugin.saveSettings();
                    new Notice(value ? '✅ 자동 저장 활성화' : '❌ 자동 저장 비활성화');
                }));

        // 출력 폴더
        new Setting(containerEl)
            .setName('음성 파일 저장 폴더')
            .setDesc('녹음된 음성 파일을 저장할 폴더')
            .addText(text => text
                .setPlaceholder('TTS Audio')
                .setValue(this.plugin.settings.outputFolder)
                .onChange(async (value) => {
                    this.plugin.settings.outputFolder = value;
                    await this.plugin.saveSettings();
                }));

        // 현재 모드 상태 표시
        const modeStatus = containerEl.createDiv({
            cls: 'current-mode-status'
        });
        modeStatus.style.padding = '12px';
        modeStatus.style.backgroundColor = 'var(--background-secondary)';
        modeStatus.style.borderRadius = '8px';
        modeStatus.style.marginTop = '15px';
        modeStatus.style.marginBottom = '15px';
        modeStatus.style.borderLeft = '4px solid var(--interactive-accent)';

        const modeText = this.plugin.settings.voiceMode === 'browser' 
            ? '🌐 현재 모드: 브라우저 TTS' 
            : '🎭 현재 모드: 샘플 오디오 재생';
        const modeDesc = this.plugin.settings.voiceMode === 'browser'
            ? '브라우저 기본 음성으로 텍스트를 읽어줍니다'
            : this.plugin.settings.customVoiceData 
                ? '⚠️ 녹음한 샘플 오디오만 재생됩니다 (TTS 아님)'
                : '⚠️ 음성 프로필이 없습니다. 먼저 녹음해주세요!';
        
        modeStatus.innerHTML = `
            <div style="font-weight: bold; font-size: 1.1em; margin-bottom: 4px;">${modeText}</div>
            <div style="color: var(--text-muted); font-size: 0.9em;">${modeDesc}</div>
            <div style="color: var(--text-muted); font-size: 0.85em; margin-top: 4px;">
                ${this.plugin.settings.autoSaveAudio ? '💾 자동 저장: 켜짐' : ''}
            </div>
        `;

        // 테스트 버튼
        new Setting(containerEl)
            .setName('음성 테스트')
            .setDesc('현재 설정으로 테스트 음성을 들어보세요')
            .addButton(button => button
                .setButtonText('🔊 테스트')
                .onClick(() => {
                    const testMode = this.plugin.settings.voiceMode === 'browser' ? '브라우저 모드' : '커스텀 모드';
                    new Notice(`🎵 ${testMode}로 재생 중...`);
                    this.plugin.speakText('안녕하세요. 이것은 음성 테스트입니다. 옵시디언 TTS 플러그인이 정상적으로 작동하고 있습니다.');
                }));

        // 폴더 설정
        containerEl.createEl('h2', { text: '📁 폴더 설정' });

        new Setting(containerEl)
            .setName('텍스트 출력 폴더')
            .setDesc('TXT 파일이 저장될 폴더')
            .addText(text => text
                .setPlaceholder('TTS Audio/Text')
                .setValue(this.plugin.settings.outputFolder)
                .onChange(async (value) => {
                    this.plugin.settings.outputFolder = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('오디오 출력 폴더')
            .setDesc('녹음된 음성 파일이 저장될 폴더')
            .addText(text => text
                .setPlaceholder('TTS Audio/Voice')
                .setValue(this.plugin.settings.audioFolder)
                .onChange(async (value) => {
                    this.plugin.settings.audioFolder = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('대시보드 폴더')
            .setDesc('TTS 대시보드가 생성될 폴더')
            .addText(text => text
                .setPlaceholder('TTS Dashboard')
                .setValue(this.plugin.settings.dashboardFolder)
                .onChange(async (value) => {
                    this.plugin.settings.dashboardFolder = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('대시보드 생성')
            .setDesc('TTS 파일 관리 및 통계를 위한 대시보드 생성')
            .addButton(button => button
                .setButtonText('📊 대시보드 생성')
                .setCta()
                .onClick(async () => {
                    await this.plugin.createDashboard();
                }));

        // 녹음 버튼
        containerEl.createEl('h2', { text: '🎙️ 음성 녹음' });

        new Setting(containerEl)
            .setName('음성 녹음')
            .setDesc('내 목소리를 녹음하여 음성 프로필 생성')
            .addButton(button => button
                .setButtonText('🎙️ 녹음하기')
                .onClick(() => {
                    new VoiceRecordModal(this.app, this.plugin).open();
                }));

        // 녹음 상태
        if (this.plugin.settings.customVoiceData) {
            const statusDiv = containerEl.createDiv({ 
                text: '✅ 음성 프로필이 저장되었습니다',
                cls: 'voice-profile-status'
            });
            statusDiv.style.color = 'var(--text-success)';
            statusDiv.style.padding = '10px';
            statusDiv.style.backgroundColor = 'var(--background-secondary)';
            statusDiv.style.borderRadius = '8px';
            statusDiv.style.marginTop = '10px';

            // 음성 프로필 테스트 버튼
            new Setting(containerEl)
                .setName('음성 프로필 테스트')
                .setDesc('녹음한 내 목소리 샘플을 재생해봅니다')
                .addButton(button => button
                    .setButtonText('🔊 샘플 재생')
                    .onClick(async () => {
                        await this.plugin.speakWithCustomVoice('안녕하세요. 이것은 녹음된 음성 프로필 테스트입니다.');
                    }));

            // 음성 프로필 삭제
            new Setting(containerEl)
                .setName('음성 프로필 삭제')
                .setDesc('저장된 음성 프로필을 삭제합니다')
                .addButton(button => button
                    .setButtonText('🗑️ 삭제')
                    .setWarning()
                    .onClick(async () => {
                        if (confirm('음성 프로필을 삭제하시겠습니까?')) {
                            this.plugin.settings.customVoiceData = null;
                            await this.plugin.saveSettings();
                            new Notice('✅ 음성 프로필이 삭제되었습니다');
                            this.display(); // 설정 화면 새로고침
                        }
                    }));
        }
    }
}

// TTS 대시보드 Modal
class TTSDashboardModal extends Modal {
    plugin: TTSVoiceReaderPlugin;

    constructor(app: App, plugin: TTSVoiceReaderPlugin) {
        super(app);
        this.plugin = plugin;
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('tts-dashboard-modal');

        // 헤더
        const header = contentEl.createDiv({ cls: 'dashboard-header' });
        const headerTitle = header.createDiv({ cls: 'header-title' });
        headerTitle.createEl('h1', { text: '🎙️ TTS 통합 대시보드' });
        
        const headerActions = header.createDiv({ cls: 'header-actions' });
        const settingsBtn = headerActions.createEl('button', { 
            text: '⚙️ 설정',
            cls: 'settings-btn'
        });
        settingsBtn.onclick = () => {
            this.close();
            // 설정 탭 열기
            (this.app as any).setting.open();
            (this.app as any).setting.openTabById(this.plugin.manifest.id);
        };

        // 통계 카드
        const statsSection = contentEl.createDiv({ cls: 'stats-section' });
        const stats = await this.getStats();

        const statsGrid = statsSection.createDiv({ cls: 'stats-grid' });
        
        this.createStatCard(statsGrid, '📄', 'TXT 파일', `${stats.txtFiles}개`, '#4caf50');
        this.createStatCard(statsGrid, '🎵', '오디오 파일', `${stats.audioFiles}개`, '#2196f3');
        this.createStatCard(statsGrid, '🎭', '음성 프로필', stats.hasProfile ? '등록됨' : '미등록', '#ff9800');
        this.createStatCard(statsGrid, '💾', '자동 저장', this.plugin.settings.autoSaveAudio ? '활성화' : '비활성화', '#9c27b0');

        // 빠른 작업
        const actionsSection = contentEl.createDiv({ cls: 'actions-section' });
        actionsSection.createEl('h2', { text: '🚀 빠른 작업' });

        const actionsGrid = actionsSection.createDiv({ cls: 'actions-grid' });

        const actions = [
            { icon: '📝', text: '새 텍스트 읽기', color: 'blue', callback: () => { this.close(); new TTSReaderModal(this.app, this.plugin).open(); } },
            { icon: '🎙️', text: '음성 녹음', color: 'green', callback: () => { this.close(); new VoiceRecordModal(this.app, this.plugin).open(); } },
            { icon: '⏹️', text: '음성 정지', color: 'red', callback: () => this.plugin.stopSpeaking() },
            { icon: '📂', text: '폴더 열기', color: 'default', callback: async () => await this.openFolder() },
        ];

        actions.forEach(action => {
            const button = actionsGrid.createEl('button', { 
                text: `${action.icon} ${action.text}`,
                cls: 'action-button'
            });
            button.style.backgroundColor = this.getActionColor(action.color);
            button.onclick = action.callback;
        });

        // 저장된 파일 목록
        const filesSection = contentEl.createDiv({ cls: 'files-section' });
        const filesSectionHeader = filesSection.createDiv({ cls: 'files-section-header' });
        filesSectionHeader.createEl('h2', { text: '📄 저장된 파일' });
        
        // 폴더 필터
        const filterContainer = filesSectionHeader.createDiv({ cls: 'filter-container' });
        const filterLabel = filterContainer.createEl('label', { text: '필터: ' });
        const filterSelect = filterContainer.createEl('select', { cls: 'folder-filter' });
        filterSelect.createEl('option', { text: '전체', value: 'all' });
        filterSelect.createEl('option', { text: '📝 TXT 파일', value: 'txt' });
        filterSelect.createEl('option', { text: '🎵 오디오 파일', value: 'audio' });
        
        let currentFilter = 'all';
        
        const renderFilesList = async (filter: string) => {
            const filesContainer = filesSection.querySelector('.files-container');
            if (filesContainer) filesContainer.remove();
            
            const filesList = await this.getFilesList();
            let filteredFiles = filesList;
            
            if (filter === 'txt') {
                filteredFiles = filesList.filter(f => f.ext === 'txt');
            } else if (filter === 'audio') {
                filteredFiles = filesList.filter(f => ['webm', 'mp4', 'ogg', 'mp3', 'wav'].includes(f.ext));
            }
            
            if (filteredFiles.length === 0) {
                const emptyMsg = filesSection.querySelector('.empty-message');
                if (emptyMsg) emptyMsg.remove();
                filesSection.createEl('p', { 
                    text: '❌ 저장된 파일이 없습니다.',
                    cls: 'empty-message'
                });
                return;
            }
            
            const emptyMsg = filesSection.querySelector('.empty-message');
            if (emptyMsg) emptyMsg.remove();
            
            const newFilesContainer = filesSection.createDiv({ cls: 'files-container' });
            
            filteredFiles.slice(0, 10).forEach((file, index) => {
                const fileItem = newFilesContainer.createDiv({ cls: 'file-item' });
                
                const fileIcon = fileItem.createDiv({ cls: 'file-icon' });
                fileIcon.setText(file.ext === 'txt' ? '📝' : '🎵');
                
                const fileInfo = fileItem.createDiv({ cls: 'file-info' });
                const fileName = fileInfo.createEl('div', { text: file.name, cls: 'file-name' });
                const fileDate = fileInfo.createEl('div', { 
                    text: new Date(file.mtime).toLocaleString('ko-KR'), 
                    cls: 'file-date' 
                });
                
                const fileActions = fileItem.createDiv({ cls: 'file-actions' });
                
                if (file.ext === 'txt') {
                    const playBtn = fileActions.createEl('button', { text: '▶️', cls: 'file-action-btn play-btn' });
                    playBtn.title = '재생';
                    playBtn.onclick = async () => await this.playTxtFile(file.path);
                    
                    const convertBtn = fileActions.createEl('button', { text: '🎵', cls: 'file-action-btn convert-btn' });
                    convertBtn.title = '변환';
                    convertBtn.onclick = async () => await this.convertTxtToAudio(file.path);
                    
                    const openBtn = fileActions.createEl('button', { text: '📂', cls: 'file-action-btn open-btn' });
                    openBtn.title = '파일 열기';
                    openBtn.onclick = async () => await this.openFile(file.path);
                } else if (['webm', 'mp4', 'ogg', 'mp3', 'wav'].includes(file.ext)) {
                    const playBtn = fileActions.createEl('button', { text: '▶️', cls: 'file-action-btn play-btn' });
                    playBtn.title = '재생';
                    playBtn.onclick = async () => await this.playAudioFile(file.path);
                    
                    const openBtn = fileActions.createEl('button', { text: '📂', cls: 'file-action-btn open-btn' });
                    openBtn.title = '파일 위치 열기';
                    openBtn.onclick = async () => await this.showInFolder(file.path);
                }
                
                const renameBtn = fileActions.createEl('button', { text: '✏️', cls: 'file-action-btn rename-btn' });
                renameBtn.title = '이름 바꾸기';
                renameBtn.onclick = async () => await this.renameFile(file.path, file.name);
                
                const deleteBtn = fileActions.createEl('button', { text: '🗑️', cls: 'file-action-btn delete-btn' });
                deleteBtn.title = '삭제';
                deleteBtn.onclick = async () => await this.deleteFile(file.path);
            });
            
            if (filteredFiles.length > 10) {
                const showMore = filesSection.createEl('button', { 
                    text: `+${filteredFiles.length - 10}개 더 보기`,
                    cls: 'show-more-btn'
                });
                showMore.onclick = async () => await this.openFolder();
            }
        };
        
        filterSelect.addEventListener('change', async (e) => {
            currentFilter = (e.target as HTMLSelectElement).value;
            await renderFilesList(currentFilter);
        });
        
        // 초기 렌더링
        await renderFilesList(currentFilter);

        // 현재 설정
        const settingsSection = contentEl.createDiv({ cls: 'settings-section' });
        settingsSection.createEl('h2', { text: '⚙️ 현재 설정' });

        const settingsInfo = settingsSection.createDiv({ cls: 'settings-info' });
        settingsInfo.innerHTML = `
            <div class="setting-item">
                <span class="setting-label">🎵 음성 모드:</span>
                <span class="setting-value">${this.plugin.settings.voiceMode === 'browser' ? '브라우저 TTS' : '커스텀 음성'}</span>
            </div>
            <div class="setting-item">
                <span class="setting-label">🌍 언어:</span>
                <span class="setting-value">${this.plugin.settings.language}</span>
            </div>
            <div class="setting-item">
                <span class="setting-label">📁 출력 폴더:</span>
                <span class="setting-value">${this.plugin.settings.outputFolder}</span>
            </div>
        `;

        // 볼륨/속도 조절
        const controlsSection = contentEl.createDiv({ cls: 'controls-section' });
        controlsSection.createEl('h2', { text: '🎛️ 재생 컨트롤' });

        const controlsContainer = controlsSection.createDiv({ cls: 'controls-container' });

        // 볼륨 조절
        const volumeControl = controlsContainer.createDiv({ cls: 'control-item' });
        volumeControl.createEl('label', { text: '🔊 볼륨' });
        const volumeSlider = volumeControl.createEl('input', { 
            type: 'range',
            attr: { min: '0', max: '1', step: '0.1', value: this.plugin.settings.volume.toString() }
        });
        const volumeValue = volumeControl.createEl('span', { 
            text: `${Math.round(this.plugin.settings.volume * 100)}%`,
            cls: 'control-value'
        });

        volumeSlider.addEventListener('input', async (e) => {
            const value = parseFloat((e.target as HTMLInputElement).value);
            this.plugin.settings.volume = value;
            await this.plugin.saveSettings();
            volumeValue.setText(`${Math.round(value * 100)}%`);
        });

        // 속도 조절
        const speedControl = controlsContainer.createDiv({ cls: 'control-item' });
        speedControl.createEl('label', { text: '⚡ 속도' });
        const speedSlider = speedControl.createEl('input', { 
            type: 'range',
            attr: { min: '0.5', max: '4', step: '0.1', value: this.plugin.settings.speed.toString() }
        });
        const speedValue = speedControl.createEl('span', { 
            text: `${this.plugin.settings.speed}x`,
            cls: 'control-value'
        });

        speedSlider.addEventListener('input', async (e) => {
            const value = parseFloat((e.target as HTMLInputElement).value);
            this.plugin.settings.speed = value;
            await this.plugin.saveSettings();
            speedValue.setText(`${value}x`);
        });

        this.addStyles();
    }

    createStatCard(container: HTMLElement, icon: string, label: string, value: string, color: string) {
        const card = container.createDiv({ cls: 'stat-card' });
        card.style.borderLeft = `4px solid ${color}`;
        
        const cardIcon = card.createDiv({ cls: 'stat-icon' });
        cardIcon.setText(icon);
        
        const cardValue = card.createDiv({ cls: 'stat-value' });
        cardValue.setText(value);
        
        const cardLabel = card.createDiv({ cls: 'stat-label' });
        cardLabel.setText(label);
    }

    async getStats() {
        const txtFolder = this.app.vault.getAbstractFileByPath(this.plugin.settings.outputFolder);
        const audioFolder = this.app.vault.getAbstractFileByPath(this.plugin.settings.audioFolder);
        
        const files = this.app.vault.getFiles();
        const txtFiles = files.filter(f => f.path.startsWith(this.plugin.settings.outputFolder) && f.extension === 'txt').length;
        const audioFiles = files.filter(f => f.path.startsWith(this.plugin.settings.audioFolder) && ['webm', 'mp4', 'ogg', 'mp3', 'wav'].includes(f.extension)).length;
        
        return { txtFiles, audioFiles, hasProfile: !!this.plugin.settings.customVoiceData };
    }

    async getFilesList() {
        const files = this.app.vault.getFiles();
        
        console.log('Total files in vault:', files.length);
        console.log('Output folder:', this.plugin.settings.outputFolder);
        console.log('Audio folder:', this.plugin.settings.audioFolder);
        
        // TXT 파일과 오디오 파일 모두 가져오기
        // 레거시 'TTS Audio/' 폴더도 체크
        const txtFiles = files.filter(f => {
            const inOutputFolder = f.path.startsWith(this.plugin.settings.outputFolder);
            const inLegacyFolder = f.path.startsWith('TTS Audio/') && !f.path.startsWith('TTS Audio/Voice');
            return (inOutputFolder || inLegacyFolder) && f.extension === 'txt';
        });
        
        const audioFiles = files.filter(f => {
            const inAudioFolder = f.path.startsWith(this.plugin.settings.audioFolder);
            const inLegacyFolder = f.path.startsWith('TTS Audio/') && !f.path.startsWith('TTS Audio/Text');
            return (inAudioFolder || inLegacyFolder) && ['webm', 'mp4', 'ogg', 'mp3', 'wav'].includes(f.extension);
        });
        
        console.log('Found TXT files:', txtFiles.length, txtFiles.map(f => f.path));
        console.log('Found audio files:', audioFiles.length, audioFiles.map(f => f.path));
        
        const allFiles = [...txtFiles, ...audioFiles]
            .map(f => ({
                name: f.basename,
                path: f.path,
                ext: f.extension,
                mtime: f.stat.mtime
            }))
            .sort((a, b) => b.mtime - a.mtime);
        
        console.log('Returning file list:', allFiles);
        return allFiles;
    }

    async playTxtFile(filePath: string) {
        try {
            const file = this.app.vault.getAbstractFileByPath(filePath);
            if (file) {
                const content = await this.app.vault.read(file as any);
                const textContent = this.plugin.extractTextFromTTSFile(content);
                if (textContent) {
                    // 플레이어 모달 열기 (대시보드는 유지)
                    new TTSPlayerModal(this.app, this.plugin, {
                        type: 'text',
                        content: textContent,
                        filename: (file as any).basename,
                        filePath: filePath
                    }).open();
                }
            }
        } catch (error) {
            new Notice('❌ 파일 재생 실패: ' + error.message);
        }
    }

    async playAudioFile(filePath: string) {
        console.log('playAudioFile called with:', filePath);
        try {
            const file = this.app.vault.getAbstractFileByPath(filePath);
            console.log('File object:', file);
            
            if (!file) {
                new Notice('❌ 파일을 찾을 수 없습니다: ' + filePath);
                console.error('File not found:', filePath);
                
                // 파일 목록 확인
                const allFiles = this.app.vault.getFiles();
                console.log('All files in vault:', allFiles.map(f => f.path));
                console.log('Looking for:', filePath);
                return;
            }
            
            console.log('Opening player modal for:', (file as any).basename);
            
            // 플레이어 모달 열기 (대시보드는 유지)
            new TTSPlayerModal(this.app, this.plugin, {
                type: 'audio',
                filePath: filePath,
                filename: (file as any).basename
            }).open();
        } catch (error) {
            new Notice('❌ 파일 재생 실패: ' + error.message);
            console.error('Play audio file error:', error);
        }
    }

    async deleteFile(filePath: string) {
        if (confirm('파일을 삭제하시겠습니까?')) {
            try {
                const file = this.app.vault.getAbstractFileByPath(filePath);
                if (file) {
                    await this.app.vault.delete(file);
                    new Notice('✅ 파일 삭제됨');
                    this.onOpen(); // 새로고침
                }
            } catch (error) {
                new Notice('❌ 파일 삭제 실패: ' + error.message);
            }
        }
    }

    async renameFile(filePath: string, currentName: string) {
        console.log('Rename called with:', { filePath, currentName });
        
        // Obsidian 모달 사용 (prompt() 대신)
        const modal = new Modal(this.app);
        modal.titleEl.setText('📝 파일 이름 변경');
        
        const { contentEl } = modal;
        contentEl.style.padding = '20px';
        
        contentEl.createEl('p', { 
            text: '새 파일 이름을 입력하세요 (확장자 제외):',
            cls: 'rename-desc'
        }).style.marginBottom = '15px';
        
        const inputEl = contentEl.createEl('input', { 
            type: 'text',
            value: currentName
        });
        inputEl.style.width = '100%';
        inputEl.style.padding = '8px 12px';
        inputEl.style.fontSize = '14px';
        inputEl.style.border = '1px solid var(--background-modifier-border)';
        inputEl.style.borderRadius = '6px';
        inputEl.style.marginBottom = '15px';
        
        // 입력창에 포커스
        setTimeout(() => {
            inputEl.focus();
            inputEl.select();
        }, 100);
        
        const btnContainer = contentEl.createDiv();
        btnContainer.style.display = 'flex';
        btnContainer.style.gap = '10px';
        btnContainer.style.justifyContent = 'flex-end';
        
        const saveBtn = btnContainer.createEl('button', { 
            text: '💾 저장',
            cls: 'mod-cta'
        });
        
        const cancelBtn = btnContainer.createEl('button', { 
            text: '❌ 취소'
        });
        
        const doRename = async () => {
            const newName = inputEl.value.trim();
            console.log('User entered new name:', newName);
            
            if (newName && newName !== currentName) {
                try {
                    const file = this.app.vault.getAbstractFileByPath(filePath);
                    console.log('File found:', file);
                    
                    if (!file) {
                        new Notice('❌ 파일을 찾을 수 없습니다: ' + filePath);
                        modal.close();
                        return;
                    }
                    
                    const ext = (file as any).extension;
                    const parentPath = filePath.substring(0, filePath.lastIndexOf('/'));
                    const newPath = `${parentPath}/${newName}.${ext}`;
                    
                    console.log('Renaming:', { from: filePath, to: newPath });
                    
                    await this.app.vault.rename(file, newPath);
                    new Notice('✅ 파일 이름 변경됨');
                    modal.close();
                    this.onOpen(); // 새로고침
                } catch (error) {
                    new Notice('❌ 파일 이름 변경 실패: ' + error.message);
                    console.error('Rename error:', error);
                    modal.close();
                }
            } else {
                console.log('Rename cancelled or invalid input');
                modal.close();
            }
        };
        
        saveBtn.addEventListener('click', doRename);
        cancelBtn.addEventListener('click', () => {
            console.log('Rename cancelled');
            modal.close();
        });
        
        // Enter 키로 저장
        inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                doRename();
            } else if (e.key === 'Escape') {
                modal.close();
            }
        });
        
        modal.open();
    }

    async openFile(filePath: string) {
        console.log('openFile called with:', filePath);
        try {
            const file = this.app.vault.getAbstractFileByPath(filePath);
            console.log('File object:', file);
            
            if (file) {
                console.log('Opening file in leaf...');
                const leaf = this.app.workspace.getLeaf(false);
                await leaf.openFile(file as any);
                new Notice('📂 파일 열림');
                console.log('✅ File opened successfully');
            } else {
                console.error('❌ File not found:', filePath);
                
                // 모든 파일 목록 출력 (디버깅용)
                const allFiles = this.app.vault.getFiles();
                console.log('All files in vault:', allFiles.length);
                console.log('Looking for:', filePath);
                
                // 비슷한 경로 찾기
                const similarFiles = allFiles.filter(f => 
                    f.path.includes(filePath) || 
                    filePath.includes(f.basename)
                );
                console.log('Similar files:', similarFiles.map(f => f.path));
                
                new Notice('❌ 파일을 찾을 수 없습니다.');
            }
        } catch (error) {
            console.error('openFile error:', error);
            console.error('Error stack:', error.stack);
            new Notice('❌ 파일 열기 실패: ' + error.message);
        }
    }

    async showInFolder(filePath: string) {
        try {
            const adapter = this.app.vault.adapter;
            if (adapter && 'getBasePath' in adapter) {
                const basePath = (adapter as any).getBasePath();
                const absolutePath = `${basePath}/${filePath}`.replace(/\//g, '\\');
                // Electron(데스크톱) 환경이면 외부 탐색기로 열기
                if (isElectronApp() && typeof (window as any).require === 'function') {
                    try {
                        const electron = (window as any).require('electron');
                        const shell = electron.remote?.shell || electron.shell;
                        shell.showItemInFolder(absolutePath);
                        new Notice('📂 파일 위치 열림 (탐색기)');
                    } catch (e) {
                        console.error('electron showItemInFolder error:', e);
                        new Notice('❌ 파일 위치 열기 실패: ' + e.message);
                    }
                } else {
                    // 모바일 환경에서는 외부 파일 탐색기 호출 불가 -> Obsidian 내 파일로 열기
                    const file = this.app.vault.getAbstractFileByPath(filePath);
                    if (file) {
                        const leaf = this.app.workspace.getLeaf(false);
                        await leaf.openFile(file as any);
                        new Notice('📝 Obsidian에서 파일 열림');
                    } else {
                        new Notice('모바일에서는 외부 탐색기 열기가 지원되지 않습니다. 파일을 찾을 수 없습니다.');
                    }
                }
            }
        } catch (error) {
            new Notice('❌ 파일 위치 열기 실패: ' + error.message);
            console.error('Show in folder error:', error);
        }
    }

    async openFolder() {
        try {
            const folderPath = this.plugin.settings.outputFolder;
            
            // 폴더 존재 확인 및 생성
            const folder = this.app.vault.getAbstractFileByPath(folderPath);
            if (!folder) {
                await this.app.vault.createFolder(folderPath).catch(() => {});
            }
            
            // Vault의 절대 경로 가져오기
            const adapter = this.app.vault.adapter;
            if (adapter && 'getBasePath' in adapter) {
                const basePath = (adapter as any).getBasePath();
                const absolutePath = `${basePath}/${folderPath}`.replace(/\//g, '\\');
                if (isElectronApp() && typeof (window as any).require === 'function') {
                    try {
                        const electron = (window as any).require('electron');
                        const shell = electron.remote?.shell || electron.shell;
                        await shell.openPath(absolutePath);
                        new Notice(`📂 폴더 열림: ${folderPath} (탐색기)`);
                    } catch (e) {
                        console.error('electron openPath error:', e);
                        new Notice('❌ 폴더 열기 실패: ' + e.message);
                    }
                } else {
                    // 모바일: Obsidian 내에서 폴더의 첫 파일을 열도록 시도
                    const files = this.app.vault.getMarkdownFiles().filter(f => f.path.startsWith(folderPath));
                    if (files.length > 0) {
                        const firstFile = files[0];
                        const leaf = this.app.workspace.getLeaf(false);
                        await leaf.openFile(firstFile as any);
                        new Notice(`📝 Obsidian에서 폴더의 첫 파일을 열었습니다 (${firstFile.path})`);
                    } else {
                        new Notice('모바일에서는 외부 파일 탐색기를 열 수 없습니다. 해당 폴더에 파일이 없습니다.');
                    }
                }
            } else {
                new Notice('❌ 폴더 경로를 찾을 수 없습니다.');
            }
        } catch (error) {
            new Notice('❌ 폴더 열기 실패: ' + error.message);
            console.error('Open folder error:', error);
        }
    }

    async convertTxtToAudio(filePath: string) {
        try {
            const file = this.app.vault.getAbstractFileByPath(filePath);
            if (!file) {
                new Notice('❌ 파일을 찾을 수 없습니다.');
                return;
            }

            const content = await this.app.vault.read(file as any);
            const textContent = this.plugin.extractTextFromTTSFile(content);
            
            if (!textContent) {
                new Notice('❌ 변환할 텍스트가 없습니다.');
                return;
            }

            // 언어 선택 모달 열기
            new LanguageSelectModal(this.app, this.plugin, textContent, (file as any).basename).open();
            
        } catch (error) {
            new Notice('❌ 변환 실패: ' + error.message);
            console.error('Convert error:', error);
        }
    }

    getActionColor(color: string): string {
        const colors: Record<string, string> = {
            blue: 'var(--interactive-accent)',
            green: '#4caf50',
            red: '#f44336',
            default: 'var(--background-modifier-border)'
        };
        return colors[color] || colors.default;
    }

    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .tts-dashboard-modal {
                padding: 20px;
                max-width: 800px;
            }
            
            .dashboard-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 30px;
            }
            
            .header-title h1 {
                margin: 0;
                color: var(--text-accent);
            }
            
            .header-actions {
                display: flex;
                gap: 10px;
            }
            
            .settings-btn {
                padding: 8px 16px;
                background: var(--interactive-accent);
                color: white;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
                transition: all 0.2s;
            }
            
            .settings-btn:hover {
                opacity: 0.8;
                transform: translateY(-2px);
            }
            
            .stats-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
                gap: 15px;
                margin-bottom: 30px;
            }
            
            .stat-card {
                padding: 20px;
                background: var(--background-secondary);
                border-radius: 8px;
                text-align: center;
                transition: transform 0.2s;
            }
            
            .stat-card:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            }
            
            .stat-icon {
                font-size: 32px;
                margin-bottom: 10px;
            }
            
            .stat-value {
                font-size: 24px;
                font-weight: bold;
                margin-bottom: 5px;
                color: var(--text-normal);
            }
            
            .stat-label {
                font-size: 14px;
                color: var(--text-muted);
            }
            
            .actions-section, .files-section, .settings-section {
                margin-bottom: 30px;
            }
            
            .files-section-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 15px;
            }
            
            .files-section-header h2 {
                margin: 0;
            }
            
            .filter-container {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            
            .filter-container label {
                font-size: 14px;
                color: var(--text-muted);
            }
            
            .folder-filter {
                padding: 4px 8px;
                border-radius: 4px;
                border: 1px solid var(--background-modifier-border);
                background: var(--background-secondary);
                color: var(--text-normal);
                cursor: pointer;
                font-size: 13px;
            }
            
            .folder-filter:hover {
                border-color: var(--interactive-accent);
            }
            
            .actions-section h2, .files-section h2, .settings-section h2 {
                font-size: 18px;
                color: var(--text-normal);
            }
            
            .actions-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                gap: 10px;
            }
            
            .action-button {
                padding: 15px;
                font-size: 14px;
                border-radius: 8px;
                border: none;
                color: white;
                cursor: pointer;
                transition: all 0.2s;
                font-weight: 500;
            }
            
            .action-button:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 8px rgba(0,0,0,0.2);
            }
            
            .files-container {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            
            .file-item {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px;
                background: var(--background-secondary);
                border-radius: 8px;
                transition: background 0.2s;
            }
            
            .file-item:hover {
                background: var(--background-modifier-hover);
            }
            
            .file-icon {
                font-size: 24px;
                flex-shrink: 0;
            }
            
            .file-info {
                flex: 1;
                min-width: 0;
            }
            
            .file-name {
                font-weight: 500;
                color: var(--text-normal);
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            
            .file-date {
                font-size: 12px;
                color: var(--text-muted);
                margin-top: 2px;
            }
            
            .file-actions {
                display: flex;
                gap: 5px;
            }
            
            .file-action-btn {
                padding: 6px 12px;
                font-size: 14px;
                border-radius: 5px;
                border: none;
                cursor: pointer;
                transition: all 0.2s;
                min-width: 36px;
            }
            
            .play-btn {
                background: #4caf50;
                color: white;
            }
            
            .play-btn:hover {
                background: #45a049;
            }
            
            .convert-btn {
                background: #2196f3;
                color: white;
            }
            
            .convert-btn:hover {
                background: #1976d2;
            }
            
            .open-btn {
                background: #ff9800;
                color: white;
            }
            
            .open-btn:hover {
                background: #f57c00;
            }
            
            .rename-btn {
                background: #9c27b0;
                color: white;
            }
            
            .rename-btn:hover {
                background: #7b1fa2;
            }
            
            .delete-btn {
                background: var(--background-modifier-border);
                color: var(--text-normal);
            }
            
            .delete-btn:hover {
                background: #f44336;
                color: white;
            }
            
            .show-more-btn {
                width: 100%;
                padding: 10px;
                margin-top: 10px;
                background: var(--background-modifier-border);
                border: none;
                border-radius: 5px;
                cursor: pointer;
                color: var(--text-muted);
            }
            
            .show-more-btn:hover {
                background: var(--background-modifier-hover);
            }
            
            .empty-message {
                text-align: center;
                color: var(--text-muted);
                padding: 20px;
            }
            
            .settings-info {
                background: var(--background-secondary);
                padding: 15px;
                border-radius: 8px;
            }
            
            .setting-item {
                display: flex;
                justify-content: space-between;
                padding: 8px 0;
                border-bottom: 1px solid var(--background-modifier-border);
            }
            
            .setting-item:last-child {
                border-bottom: none;
            }
            
            .setting-label {
                color: var(--text-muted);
                font-size: 14px;
            }
            
            .setting-value {
                color: var(--text-normal);
                font-weight: 500;
                font-size: 14px;
            }
            
            .controls-section {
                margin-bottom: 30px;
            }
            
            .controls-container {
                background: var(--background-secondary);
                padding: 20px;
                border-radius: 8px;
            }
            
            .control-item {
                display: flex;
                align-items: center;
                gap: 15px;
                margin-bottom: 20px;
            }
            
            .control-item:last-child {
                margin-bottom: 0;
            }
            
            .control-item label {
                min-width: 80px;
                font-weight: 500;
                color: var(--text-normal);
            }
            
            .control-item input[type="range"] {
                flex: 1;
                height: 6px;
                border-radius: 3px;
                background: var(--background-modifier-border);
                outline: none;
                -webkit-appearance: none;
            }
            
            .control-item input[type="range"]::-webkit-slider-thumb {
                -webkit-appearance: none;
                appearance: none;
                width: 18px;
                height: 18px;
                border-radius: 50%;
                background: var(--interactive-accent);
                cursor: pointer;
                transition: all 0.2s;
            }
            
            .control-item input[type="range"]::-webkit-slider-thumb:hover {
                transform: scale(1.2);
                box-shadow: 0 0 0 4px rgba(var(--interactive-accent-rgb), 0.2);
            }
            
            .control-item input[type="range"]::-moz-range-thumb {
                width: 18px;
                height: 18px;
                border-radius: 50%;
                background: var(--interactive-accent);
                cursor: pointer;
                border: none;
                transition: all 0.2s;
            }
            
            .control-item input[type="range"]::-moz-range-thumb:hover {
                transform: scale(1.2);
                box-shadow: 0 0 0 4px rgba(var(--interactive-accent-rgb), 0.2);
            }
            
            .control-value {
                min-width: 60px;
                text-align: right;
                font-weight: bold;
                color: var(--interactive-accent);
            }
            
            /* 모바일 반응형 최적화 */
            @media (max-width: 768px) {
                .tts-dashboard-modal {
                    padding: 15px;
                    max-width: 100%;
                }
                
                .dashboard-header {
                    flex-direction: column;
                    gap: 15px;
                    align-items: flex-start;
                    margin-bottom: 20px;
                }
                
                .header-actions {
                    width: 100%;
                }
                
                .settings-btn {
                    width: 100%;
                    justify-content: center;
                }
                
                .stats-grid {
                    grid-template-columns: 1fr;
                    gap: 10px;
                }
                
                .actions-grid {
                    grid-template-columns: 1fr;
                    gap: 8px;
                }
                
                .action-button {
                    padding: 12px;
                    font-size: 13px;
                }
                
                .file-item {
                    flex-direction: column;
                    align-items: flex-start;
                    padding: 10px;
                }
                
                .file-actions {
                    width: 100%;
                    justify-content: flex-start;
                    flex-wrap: wrap;
                }
                
                .file-action-btn {
                    flex: 1;
                    min-width: 60px;
                    padding: 8px;
                    font-size: 13px;
                }
                
                .controls-container {
                    padding: 15px;
                }
                
                .control-item {
                    flex-direction: column;
                    align-items: stretch;
                    gap: 8px;
                }
                
                .control-item label {
                    min-width: auto;
                }
                
                .control-value {
                    text-align: left;
                }
            }
            
            @media (max-width: 480px) {
                .tts-dashboard-modal {
                    padding: 10px;
                }
                
                .header-title h1 {
                    font-size: 20px;
                }
                
                .stat-card {
                    padding: 15px;
                }
                
                .stat-icon {
                    font-size: 24px;
                }
                
                .stat-value {
                    font-size: 20px;
                }
                
                .file-name {
                    font-size: 14px;
                }
                
                .file-date {
                    font-size: 11px;
                }
                
                .filter-container {
                    flex-direction: column;
                    align-items: stretch;
                    gap: 5px;
                }
                
                .folder-filter {
                    width: 100%;
                }
            }
            
            /* 터치 디바이스 최적화 */
            @media (hover: none) and (pointer: coarse) {
                .action-button,
                .file-action-btn,
                .settings-btn {
                    min-height: 44px;
                    padding: 12px 16px;
                }
                
                .file-action-btn:active {
                    transform: scale(0.95);
                }
                
                .action-button:active {
                    transform: translateY(0);
                }
            }
        `;
        document.head.appendChild(style);
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// 언어 선택 및 TXT → 음성 변환 Modal
class LanguageSelectModal extends Modal {
    plugin: TTSVoiceReaderPlugin;
    textContent: string;
    filename: string;
    selectedLanguage: string;
    selectedVoice: string;

    constructor(app: App, plugin: TTSVoiceReaderPlugin, textContent: string, filename: string) {
        super(app);
        this.plugin = plugin;
        this.textContent = textContent;
        this.filename = filename;
        this.selectedLanguage = plugin.settings.language;
        this.selectedVoice = plugin.settings.browserVoice;
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('language-select-modal');

        // 헤더
        contentEl.createEl('h2', { text: '🎵 텍스트 → 음성 변환' });

        // 파일 정보
        const fileInfo = contentEl.createDiv({ cls: 'file-info-section' });
        fileInfo.createEl('p', { 
            text: `📄 파일: ${this.filename}`,
            cls: 'info-text'
        });
        fileInfo.createEl('p', { 
            text: `📝 텍스트 길이: ${this.textContent.length}자`,
            cls: 'info-text'
        });

        // 언어 선택
        const languageSection = contentEl.createDiv({ cls: 'setting-section' });
        languageSection.createEl('h3', { text: '🌍 언어 선택' });

        const languages = [
            { code: 'ko-KR', name: '한국어 (Korean)' },
            { code: 'en-US', name: '영어 - 미국 (English - US)' },
            { code: 'en-GB', name: '영어 - 영국 (English - UK)' },
            { code: 'ja-JP', name: '일본어 (Japanese)' },
            { code: 'zh-CN', name: '중국어 - 간체 (Chinese - Simplified)' },
            { code: 'zh-TW', name: '중국어 - 번체 (Chinese - Traditional)' },
            { code: 'es-ES', name: '스페인어 (Spanish)' },
            { code: 'fr-FR', name: '프랑스어 (French)' },
            { code: 'de-DE', name: '독일어 (German)' },
            { code: 'ru-RU', name: '러시아어 (Russian)' },
            { code: 'pt-BR', name: '포르투갈어 - 브라질 (Portuguese - Brazil)' },
            { code: 'it-IT', name: '이탈리아어 (Italian)' },
            { code: 'ar-SA', name: '아랍어 (Arabic)' },
            { code: 'hi-IN', name: '힌디어 (Hindi)' },
            { code: 'th-TH', name: '태국어 (Thai)' },
            { code: 'vi-VN', name: '베트남어 (Vietnamese)' }
        ];

        const languageDropdown = languageSection.createEl('select', { cls: 'language-dropdown' });
        languages.forEach(lang => {
            const option = languageDropdown.createEl('option', { 
                text: lang.name,
                value: lang.code
            });
            if (lang.code === this.selectedLanguage) {
                option.selected = true;
            }
        });

        languageDropdown.addEventListener('change', () => {
            this.selectedLanguage = languageDropdown.value;
            this.updateVoiceList(voiceDropdown);
        });

        // 음성 선택
        const voiceSection = contentEl.createDiv({ cls: 'setting-section' });
        voiceSection.createEl('h3', { text: '🎤 음성 선택' });

        const voiceDropdown = voiceSection.createEl('select', { cls: 'voice-dropdown' });
        this.updateVoiceList(voiceDropdown);

        voiceDropdown.addEventListener('change', () => {
            this.selectedVoice = voiceDropdown.value;
        });

        // 속도 및 볼륨 설정
        const settingsSection = contentEl.createDiv({ cls: 'setting-section' });
        settingsSection.createEl('h3', { text: '⚙️ 음성 설정' });

        // 속도
        const speedControl = settingsSection.createDiv({ cls: 'control-row' });
        speedControl.createEl('label', { text: '속도:' });
        const speedSlider = speedControl.createEl('input', {
            type: 'range',
            attr: { min: '0.5', max: '4', step: '0.1', value: this.plugin.settings.speed.toString() }
        });
        const speedValue = speedControl.createEl('span', { text: `${this.plugin.settings.speed}x`, cls: 'control-value' });

        speedSlider.addEventListener('input', (e) => {
            const value = parseFloat((e.target as HTMLInputElement).value);
            speedValue.setText(`${value}x`);
        });

        // 볼륨
        const volumeControl = settingsSection.createDiv({ cls: 'control-row' });
        volumeControl.createEl('label', { text: '볼륨:' });
        const volumeSlider = volumeControl.createEl('input', {
            type: 'range',
            attr: { min: '0', max: '1', step: '0.1', value: this.plugin.settings.volume.toString() }
        });
        const volumeValue = volumeControl.createEl('span', { text: `${Math.round(this.plugin.settings.volume * 100)}%`, cls: 'control-value' });

        volumeSlider.addEventListener('input', (e) => {
            const value = parseFloat((e.target as HTMLInputElement).value);
            volumeValue.setText(`${Math.round(value * 100)}%`);
        });

        // 버튼
        const buttonContainer = contentEl.createDiv({ cls: 'button-container' });

        const previewBtn = buttonContainer.createEl('button', { 
            text: '🔊 미리듣기',
            cls: 'preview-button'
        });
        previewBtn.onclick = () => {
            const preview = this.textContent.substring(0, 200);
            this.playPreview(preview, speedSlider.value, volumeSlider.value);
        };

        const convertBtn = buttonContainer.createEl('button', { 
            text: '🎵 변환 시작',
            cls: 'mod-cta convert-button'
        });
        convertBtn.onclick = async () => {
            await this.convertToAudio(speedSlider.value, volumeSlider.value);
        };

        const cancelBtn = buttonContainer.createEl('button', { 
            text: '❌ 취소'
        });
        cancelBtn.onclick = () => this.close();

        this.addStyles();
    }

    updateVoiceList(dropdown: HTMLSelectElement) {
        dropdown.empty();
        
        const availableVoices = this.plugin.availableVoices.filter(v => 
            v.lang.startsWith(this.selectedLanguage.split('-')[0])
        );

        if (availableVoices.length === 0) {
            dropdown.createEl('option', { text: '사용 가능한 음성 없음', value: '' });
        } else {
            availableVoices.forEach(voice => {
                const option = dropdown.createEl('option', {
                    text: `${voice.name} (${voice.lang})`,
                    value: voice.name
                });
                if (voice.name === this.selectedVoice) {
                    option.selected = true;
                }
            });
        }
    }

    playPreview(text: string, speed: string, volume: string) {
        const utterance = new SpeechSynthesisUtterance(text);
        
        const voice = this.plugin.availableVoices.find(v => v.name === this.selectedVoice);
        if (voice) {
            utterance.voice = voice;
        }
        
        utterance.rate = parseFloat(speed);
        utterance.volume = parseFloat(volume);
        utterance.lang = this.selectedLanguage;

        this.plugin.synthesis.cancel();
        this.plugin.synthesis.speak(utterance);
        
        new Notice('🔊 미리듣기 재생 중...');
    }

    async convertToAudio(speed: string, volume: string) {
        new Notice('🎵 음성 변환 시작...');
        
        try {
            // MediaRecorder를 사용한 음성 녹음
            const utterance = new SpeechSynthesisUtterance(this.textContent);
            
            const voice = this.plugin.availableVoices.find(v => v.name === this.selectedVoice);
            if (voice) {
                utterance.voice = voice;
            }
            
            utterance.rate = parseFloat(speed);
            utterance.volume = parseFloat(volume);
            utterance.lang = this.selectedLanguage;

            // 브라우저 TTS로 음성 생성
            this.plugin.synthesis.cancel();
            
            utterance.onstart = () => {
                new Notice('🎙️ 음성 생성 중... (브라우저 TTS)');
            };

            utterance.onend = async () => {
                new Notice('✅ 음성 생성 완료!');
                this.close();
            };

            utterance.onerror = (error) => {
                new Notice('❌ 음성 변환 실패: ' + error.error);
                console.error('TTS error:', error);
            };

            this.plugin.synthesis.speak(utterance);

            // 참고: 브라우저 TTS를 직접 오디오 파일로 저장하는 것은 제한적입니다.
            // 더 나은 방법은 Web Speech API의 녹음 기능이나 서버 사이드 TTS를 사용하는 것입니다.
            new Notice('ℹ️ 브라우저 TTS는 직접 파일 저장을 지원하지 않습니다. 음성이 재생됩니다.');
            
        } catch (error) {
            new Notice('❌ 변환 실패: ' + error.message);
            console.error('Convert error:', error);
        }
    }

    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .language-select-modal {
                padding: 20px;
                max-width: 600px;
            }
            
            .file-info-section {
                background: var(--background-secondary);
                padding: 15px;
                border-radius: 8px;
                margin-bottom: 20px;
            }
            
            .info-text {
                margin: 5px 0;
                color: var(--text-muted);
            }
            
            .setting-section {
                margin-bottom: 20px;
            }
            
            .setting-section h3 {
                margin-bottom: 10px;
                color: var(--text-normal);
            }
            
            .language-dropdown,
            .voice-dropdown {
                width: 100%;
                padding: 10px;
                border-radius: 5px;
                background: var(--background-secondary);
                border: 1px solid var(--background-modifier-border);
                color: var(--text-normal);
                font-size: 14px;
            }
            
            .control-row {
                display: flex;
                align-items: center;
                gap: 15px;
                margin-bottom: 15px;
            }
            
            .control-row label {
                min-width: 60px;
                font-weight: 500;
            }
            
            .control-row input[type="range"] {
                flex: 1;
            }
            
            .control-row .control-value {
                min-width: 50px;
                text-align: right;
                font-weight: bold;
                color: var(--interactive-accent);
            }
            
            .button-container {
                display: flex;
                gap: 10px;
                justify-content: flex-end;
                margin-top: 20px;
            }
            
            .button-container button {
                padding: 10px 20px;
                border-radius: 5px;
                cursor: pointer;
            }
            
            .preview-button {
                background: var(--interactive-accent);
                color: white;
                border: none;
            }
            
            .preview-button:hover {
                opacity: 0.8;
            }
            
            .convert-button {
                background: var(--interactive-accent);
                color: white;
                border: none;
            }
            
            /* 모바일 반응형 최적화 */
            @media (max-width: 768px) {
                .language-select-modal {
                    padding: 15px;
                    max-width: 95vw;
                }
                
                .file-info-section {
                    padding: 12px;
                }
                
                .control-row {
                    flex-direction: column;
                    align-items: stretch;
                    gap: 8px;
                }
                
                .control-row label {
                    min-width: auto;
                }
                
                .control-row .control-value {
                    text-align: left;
                }
                
                .button-container {
                    flex-direction: column;
                    gap: 8px;
                }
                
                .button-container button {
                    width: 100%;
                    padding: 12px;
                }
            }
            
            @media (max-width: 480px) {
                .language-select-modal {
                    padding: 10px;
                }
                
                .setting-section h3 {
                    font-size: 16px;
                }
                
                .language-dropdown,
                .voice-dropdown {
                    font-size: 13px;
                    padding: 8px;
                }
            }
            
            /* 터치 디바이스 최적화 */
            @media (hover: none) and (pointer: coarse) {
                .button-container button {
                    min-height: 44px;
                    padding: 12px 20px;
                }
                
                .language-dropdown,
                .voice-dropdown {
                    min-height: 44px;
                }
            }
        `;
        document.head.appendChild(style);
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
        this.plugin.synthesis.cancel();
    }
}

// TTS 플레이어 Modal
class TTSPlayerModal extends Modal {
    plugin: TTSVoiceReaderPlugin;
    playerData: any;
    currentUtterance: SpeechSynthesisUtterance | null = null;
    currentAudio: HTMLAudioElement | null = null;
    isPlaying: boolean = false;
    currentTime: number = 0;
    duration: number = 0;
    progressInterval: any = null;
    progressFill: HTMLElement;
    timeDisplay: HTMLElement;
    playPauseBtn: HTMLElement;
    speedSlider: HTMLInputElement;
    volumeSlider: HTMLInputElement;

    constructor(app: App, plugin: TTSVoiceReaderPlugin, playerData: any) {
        super(app);
        this.plugin = plugin;
        this.playerData = playerData;
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('tts-player-modal');

        // 헤더
        const header = contentEl.createDiv({ cls: 'player-header' });
        header.createEl('h2', { text: '🎵 TTS 플레이어' });
        
        // 파일 정보
        const fileInfo = contentEl.createDiv({ cls: 'player-file-info' });
        fileInfo.createEl('div', { 
            text: `📄 ${this.playerData.filename}`,
            cls: 'player-filename'
        });

        if (this.playerData.type === 'text') {
            fileInfo.createEl('div', { 
                text: `📝 ${this.playerData.content.length}자`,
                cls: 'player-filesize'
            });
        }

        // 진행률 바
        const progressSection = contentEl.createDiv({ cls: 'player-progress-section' });
        const progressBar = progressSection.createDiv({ cls: 'player-progress-bar' });
        const progressFill = progressBar.createDiv({ cls: 'player-progress-fill' });
        this.progressFill = progressFill;

        const timeDisplay = progressSection.createDiv({ cls: 'player-time-display' });
        this.timeDisplay = timeDisplay;
        this.updateTimeDisplay();

        // 컨트롤 버튼
        const controls = contentEl.createDiv({ cls: 'player-controls' });

        // 재생/일시정지 버튼
        const playPauseBtn = controls.createEl('button', {
            text: '▶️ 재생',
            cls: 'player-btn play-pause-btn'
        });
        this.playPauseBtn = playPauseBtn;

        playPauseBtn.onclick = async () => {
            if (this.isPlaying) {
                this.pause();
            } else {
                await this.play();
            }
        };

        // 정지 버튼
        const stopBtn = controls.createEl('button', {
            text: '⏹️ 정지',
            cls: 'player-btn stop-btn'
        });

        stopBtn.onclick = () => {
            this.stop();
        };

        // Obsidian에서 파일 열기 버튼
        const openInObsidianBtn = controls.createEl('button', {
            text: '📝 Obsidian에서 열기',
            cls: 'player-btn open-obsidian-btn'
        });

        openInObsidianBtn.onclick = async () => {
            if (this.playerData.filePath) {
                console.log('📝 Opening file in Obsidian:', this.playerData.filePath);
                try {
                    const file = this.app.vault.getAbstractFileByPath(this.playerData.filePath);
                    console.log('File object:', file);
                    
                    if (file) {
                        const leaf = this.app.workspace.getLeaf(false);
                        await leaf.openFile(file as any);
                        new Notice('📝 Obsidian에서 파일 열림');
                        console.log('✅ File opened in Obsidian');
                    } else {
                        console.error('❌ File not found:', this.playerData.filePath);
                        new Notice('❌ 파일을 찾을 수 없습니다.');
                    }
                } catch (error) {
                    console.error('openInObsidian error:', error);
                    new Notice('❌ 파일 열기 실패: ' + error.message);
                }
            }
        };

        // 파일 위치 열기 버튼 (Windows 탐색기)
        const openFolderBtn = controls.createEl('button', {
            text: '📂 폴더 열기',
            cls: 'player-btn open-folder-btn'
        });

        openFolderBtn.onclick = async () => {
            console.log('📂 Opening folder in Explorer');
            try {
                if (this.playerData.filePath) {
                    // 파일의 절대 경로 가져오기
                    const adapter = this.app.vault.adapter;
                    if (adapter && 'getBasePath' in adapter) {
                        const basePath = (adapter as any).getBasePath();
                        const absolutePath = `${basePath}/${this.playerData.filePath}`.replace(/\//g, '\\');
                        
                        console.log('Opening in explorer:', absolutePath);
                        
                        // 데스크톱(Electron)에서만 외부 탐색기 열기
                        if (isElectronApp() && typeof (window as any).require === 'function') {
                            try {
                                const electron = (window as any).require('electron');
                                const shell = electron.remote?.shell || electron.shell;
                                shell.showItemInFolder(absolutePath);
                                new Notice('📂 파일 위치 열림 (탐색기)');
                                console.log('✅ Folder opened in Explorer');
                            } catch (e) {
                                console.error('electron showItemInFolder error:', e);
                                new Notice('❌ 탐색기 열기 실패: ' + e.message);
                            }
                        } else {
                            // 모바일: Obsidian 내에서 파일 열기
                            const file = this.app.vault.getAbstractFileByPath(this.playerData.filePath);
                            if (file) {
                                const leaf = this.app.workspace.getLeaf(false);
                                await leaf.openFile(file as any);
                                new Notice('� Obsidian에서 파일 열림');
                            } else {
                                new Notice('모바일에서는 외부 탐색기를 열 수 없습니다.');
                            }
                        }
                    }
                } else {
                    // 파일 경로가 없으면 출력 폴더 열기
                    const folderPath = this.plugin.settings.outputFolder;
                    console.log('Opening output folder:', folderPath);
                    
                    if (isElectronApp() && typeof (window as any).require === 'function') {
                        try {
                            const electron = (window as any).require('electron');
                            const shell = electron.remote?.shell || electron.shell;
                            await shell.openPath(folderPath);
                            new Notice('📂 폴더 열림 (탐색기)');
                        } catch (e) {
                            console.error('electron openPath error:', e);
                            new Notice('❌ 폴더 열기 실패: ' + e.message);
                        }
                    } else {
                        new Notice('모바일에서는 외부 폴더를 열 수 없습니다.');
                    }
                }
            } catch (error) {
                console.error('openFolder error:', error);
                new Notice('❌ 폴더 열기 실패: ' + error.message);
            }
        };

        // 설정 섹션 (TTS 전용)
        if (this.playerData.type === 'text') {
            const settingsSection = contentEl.createDiv({ cls: 'player-settings-section' });
            settingsSection.createEl('h3', { text: '⚙️ 재생 설정' });

            // 속도
            const speedControl = settingsSection.createDiv({ cls: 'player-control-row' });
            speedControl.createEl('label', { text: '속도:' });
            const speedSlider = speedControl.createEl('input', {
                type: 'range',
                attr: { min: '0.5', max: '4', step: '0.1', value: this.plugin.settings.speed.toString() }
            });
            const speedValue = speedControl.createEl('span', { 
                text: `${this.plugin.settings.speed}x`, 
                cls: 'player-control-value' 
            });

            speedSlider.addEventListener('input', (e) => {
                const value = parseFloat((e.target as HTMLInputElement).value);
                speedValue.setText(`${value}x`);
                if (this.currentUtterance) {
                    this.currentUtterance.rate = value;
                }
            });

            // 볼륨
            const volumeControl = settingsSection.createDiv({ cls: 'player-control-row' });
            volumeControl.createEl('label', { text: '볼륨:' });
            const volumeSlider = volumeControl.createEl('input', {
                type: 'range',
                attr: { min: '0', max: '1', step: '0.1', value: this.plugin.settings.volume.toString() }
            });
            const volumeValue = volumeControl.createEl('span', { 
                text: `${Math.round(this.plugin.settings.volume * 100)}%`, 
                cls: 'player-control-value' 
            });

            volumeSlider.addEventListener('input', (e) => {
                const value = parseFloat((e.target as HTMLInputElement).value);
                volumeValue.setText(`${Math.round(value * 100)}%`);
                if (this.currentUtterance) {
                    this.currentUtterance.volume = value;
                }
            });

            this.speedSlider = speedSlider;
            this.volumeSlider = volumeSlider;
        } else if (this.playerData.type === 'audio') {
            // 오디오 전용 볼륨
            const settingsSection = contentEl.createDiv({ cls: 'player-settings-section' });
            settingsSection.createEl('h3', { text: '⚙️ 재생 설정' });

            const volumeControl = settingsSection.createDiv({ cls: 'player-control-row' });
            volumeControl.createEl('label', { text: '볼륨:' });
            const volumeSlider = volumeControl.createEl('input', {
                type: 'range',
                attr: { min: '0', max: '1', step: '0.1', value: this.plugin.settings.volume.toString() }
            });
            const volumeValue = volumeControl.createEl('span', { 
                text: `${Math.round(this.plugin.settings.volume * 100)}%`, 
                cls: 'player-control-value' 
            });

            volumeSlider.addEventListener('input', (e) => {
                const value = parseFloat((e.target as HTMLInputElement).value);
                volumeValue.setText(`${Math.round(value * 100)}%`);
                if (this.currentAudio) {
                    this.currentAudio.volume = value;
                }
            });

            this.volumeSlider = volumeSlider;
        }

        // 닫기 버튼
        const closeBtn = contentEl.createEl('button', {
            text: '❌ 닫기',
            cls: 'player-close-btn'
        });

        closeBtn.onclick = () => {
            this.close();
        };

        this.addStyles();
    }

    async play() {
        if (this.playerData.type === 'text') {
            await this.playText();
        } else {
            await this.playAudio();
        }
    }

    async playText() {
        const utterance = new SpeechSynthesisUtterance(this.playerData.content);
        
        const voice = this.plugin.availableVoices.find(v => v.name === this.plugin.settings.browserVoice);
        if (voice) {
            utterance.voice = voice;
        }
        
        utterance.rate = parseFloat((this.speedSlider as HTMLInputElement).value);
        utterance.volume = parseFloat((this.volumeSlider as HTMLInputElement).value);
        utterance.lang = this.plugin.settings.language;

        utterance.onstart = () => {
            this.isPlaying = true;
            this.playPauseBtn.setText('⏸️ 일시정지');
            new Notice('🔊 재생 중...');
        };

        utterance.onend = () => {
            this.isPlaying = false;
            this.playPauseBtn.setText('▶️ 재생');
            new Notice('✅ 재생 완료');
            this.currentUtterance = null;
        };

        utterance.onerror = (error) => {
            this.isPlaying = false;
            this.playPauseBtn.setText('▶️ 재생');
            new Notice('❌ 재생 오류: ' + error.error);
            this.currentUtterance = null;
        };

        this.currentUtterance = utterance;
        this.plugin.synthesis.speak(utterance);
    }

    async playAudio() {
        try {
            const file = this.app.vault.getAbstractFileByPath(this.playerData.filePath);
            if (file) {
                const arrayBuffer = await this.app.vault.readBinary(file as any);
                
                // 파일 확장자에 따라 올바른 MIME 타입 설정
                let mimeType = 'audio/webm';
                const extension = this.playerData.filePath.toLowerCase().split('.').pop();
                
                if (extension === 'mp3') {
                    mimeType = 'audio/mpeg';
                } else if (extension === 'ogg') {
                    mimeType = 'audio/ogg';
                } else if (extension === 'wav') {
                    mimeType = 'audio/wav';
                } else if (extension === 'm4a' || extension === 'mp4') {
                    mimeType = 'audio/mp4';
                } else if (extension === 'webm') {
                    mimeType = 'audio/webm';
                }
                
                console.log('Playing audio with MIME type:', mimeType, 'for file:', this.playerData.filePath);
                
                const blob = new Blob([arrayBuffer], { type: mimeType });
                const audioUrl = URL.createObjectURL(blob);
                
                this.currentAudio = new Audio(audioUrl);
                this.currentAudio.volume = parseFloat((this.volumeSlider as HTMLInputElement).value);
                
                this.currentAudio.onplay = () => {
                    this.isPlaying = true;
                    this.playPauseBtn.setText('⏸️ 일시정지');
                    new Notice('🔊 재생 중...');
                    this.startProgressUpdate();
                };

                this.currentAudio.onpause = () => {
                    this.isPlaying = false;
                    this.playPauseBtn.setText('▶️ 재생');
                    this.stopProgressUpdate();
                };
                
                this.currentAudio.onended = () => {
                    this.isPlaying = false;
                    this.playPauseBtn.setText('▶️ 재생');
                    URL.revokeObjectURL(audioUrl);
                    new Notice('✅ 재생 완료');
                    this.currentAudio = null;
                    this.stopProgressUpdate();
                    this.updateProgress(100);
                };
                
                this.currentAudio.onerror = (error) => {
                    this.isPlaying = false;
                    this.playPauseBtn.setText('▶️ 재생');
                    URL.revokeObjectURL(audioUrl);
                    new Notice('❌ 오디오 재생 실패 - 파일 형식을 확인하세요');
                    console.error('Audio playback error:', error);
                    console.error('File path:', this.playerData.filePath);
                    console.error('MIME type used:', mimeType);
                    this.currentAudio = null;
                    this.stopProgressUpdate();
                };

                this.currentAudio.onloadedmetadata = () => {
                    this.duration = this.currentAudio!.duration;
                    this.updateTimeDisplay();
                };
                
                await this.currentAudio.play();
            }
        } catch (error) {
            new Notice('❌ 파일 재생 실패: ' + error.message);
            console.error('Play audio error:', error);
        }
    }

    pause() {
        if (this.playerData.type === 'text') {
            this.plugin.synthesis.pause();
            this.isPlaying = false;
            this.playPauseBtn.setText('▶️ 재생');
        } else if (this.currentAudio) {
            this.currentAudio.pause();
        }
    }

    stop() {
        if (this.playerData.type === 'text') {
            this.plugin.synthesis.cancel();
            this.isPlaying = false;
            this.playPauseBtn.setText('▶️ 재생');
            this.currentUtterance = null;
            new Notice('⏹️ 정지됨');
        } else if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio.currentTime = 0;
            this.isPlaying = false;
            this.playPauseBtn.setText('▶️ 재생');
            this.updateProgress(0);
            this.updateTimeDisplay();
            new Notice('⏹️ 정지됨');
        }
    }

    startProgressUpdate() {
        this.progressInterval = setInterval(() => {
            if (this.currentAudio) {
                const progress = (this.currentAudio.currentTime / this.currentAudio.duration) * 100;
                this.updateProgress(progress);
                this.currentTime = this.currentAudio.currentTime;
                this.updateTimeDisplay();
            }
        }, 100);
    }

    stopProgressUpdate() {
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = null;
        }
    }

    updateProgress(percentage: number) {
        if (this.progressFill) {
            this.progressFill.style.width = `${percentage}%`;
        }
    }

    updateTimeDisplay() {
        if (this.timeDisplay) {
            const current = this.formatTime(this.currentTime);
            const total = this.formatTime(this.duration);
            this.timeDisplay.setText(`${current} / ${total}`);
        }
    }

    formatTime(seconds: number): string {
        if (!seconds || isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .tts-player-modal {
                padding: 20px;
                max-width: 500px;
            }
            
            .player-header h2 {
                margin-bottom: 20px;
                text-align: center;
            }
            
            .player-file-info {
                background: var(--background-secondary);
                padding: 15px;
                border-radius: 8px;
                margin-bottom: 20px;
            }
            
            .player-filename {
                font-size: 16px;
                font-weight: bold;
                color: var(--text-normal);
                margin-bottom: 5px;
            }
            
            .player-filesize {
                font-size: 14px;
                color: var(--text-muted);
            }
            
            .player-progress-section {
                margin-bottom: 20px;
            }
            
            .player-progress-bar {
                width: 100%;
                height: 8px;
                background: var(--background-modifier-border);
                border-radius: 4px;
                overflow: hidden;
                margin-bottom: 8px;
            }
            
            .player-progress-fill {
                height: 100%;
                width: 0%;
                background: var(--interactive-accent);
                transition: width 0.1s linear;
            }
            
            .player-time-display {
                text-align: center;
                font-size: 14px;
                color: var(--text-muted);
            }
            
            .player-controls {
                display: flex;
                gap: 10px;
                justify-content: center;
                margin-bottom: 20px;
                flex-wrap: wrap;
            }
            
            .player-btn {
                padding: 12px 20px;
                border-radius: 8px;
                border: none;
                cursor: pointer;
                font-size: 14px;
                font-weight: 500;
                transition: all 0.2s;
            }
            
            .play-pause-btn {
                background: var(--interactive-accent);
                color: white;
                min-width: 120px;
            }
            
            .play-pause-btn:hover {
                opacity: 0.8;
            }
            
            .stop-btn {
                background: #f44336;
                color: white;
            }
            
            .stop-btn:hover {
                opacity: 0.8;
            }
            
            .open-file-btn {
                background: var(--background-secondary);
                color: var(--text-normal);
                border: 1px solid var(--background-modifier-border);
            }
            
            .open-file-btn:hover {
                background: var(--background-modifier-hover);
            }
            
            .player-settings-section {
                margin-bottom: 20px;
            }
            
            .player-settings-section h3 {
                font-size: 14px;
                margin-bottom: 10px;
                color: var(--text-normal);
            }
            
            .player-control-row {
                display: flex;
                align-items: center;
                gap: 15px;
                margin-bottom: 12px;
            }
            
            .player-control-row label {
                min-width: 60px;
                font-weight: 500;
                font-size: 14px;
            }
            
            .player-control-row input[type="range"] {
                flex: 1;
            }
            
            .player-control-value {
                min-width: 50px;
                text-align: right;
                font-weight: bold;
                color: var(--interactive-accent);
                font-size: 14px;
            }
            
            .player-close-btn {
                width: 100%;
                padding: 12px;
                border-radius: 8px;
                border: none;
                background: var(--background-secondary);
                color: var(--text-normal);
                cursor: pointer;
                font-size: 14px;
                font-weight: 500;
            }
            
            .player-close-btn:hover {
                background: var(--background-modifier-hover);
            }
            
            /* 모바일 반응형 최적화 */
            @media (max-width: 768px) {
                .tts-player-modal {
                    padding: 15px;
                    max-width: 95vw;
                }
                
                .player-header h2 {
                    font-size: 18px;
                }
                
                .player-controls {
                    padding: 10px 0;
                    flex-wrap: wrap;
                    gap: 8px;
                }
                
                .player-btn {
                    flex: 1 1 calc(50% - 4px);
                    min-width: calc(50% - 4px);
                    padding: 10px 8px;
                    font-size: 13px;
                }
                
                .player-control-row {
                    flex-direction: column;
                    align-items: stretch;
                    gap: 8px;
                }
                
                .player-control-row label {
                    min-width: auto;
                }
                
                .player-control-value {
                    text-align: left;
                }
                
                .player-time-display {
                    font-size: 12px;
                }
            }
            
            @media (max-width: 480px) {
                .tts-player-modal {
                    padding: 10px;
                }
                
                .player-header h2 {
                    font-size: 16px;
                }
                
                .player-filename {
                    font-size: 14px;
                }
                
                .player-filesize {
                    font-size: 12px;
                }
                
                .player-controls {
                    gap: 6px;
                }
                
                .player-btn {
                    flex: 1 1 100%;
                    min-width: 100%;
                    padding: 12px;
                    font-size: 14px;
                }
                
                .player-progress-bar {
                    height: 6px;
                }
            }
            
            /* 터치 디바이스 최적화 */
            @media (hover: none) and (pointer: coarse) {
                .player-btn {
                    min-height: 44px;
                    padding: 12px 16px;
                }
                
                .player-btn:active {
                    transform: scale(0.95);
                }
                
                .player-close-btn {
                    min-height: 44px;
                }
            }
        `;
        document.head.appendChild(style);
    }

    onClose() {
        const { contentEl } = this;
        
        // 재생 중이면 정지
        if (this.playerData.type === 'text') {
            this.plugin.synthesis.cancel();
        } else if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio = null;
        }
        
        this.stopProgressUpdate();
        contentEl.empty();
    }
}
