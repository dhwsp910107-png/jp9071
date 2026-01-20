import { App, Plugin, PluginSettingTab, Setting, TFile, Notice, Modal, TFolder } from 'obsidian';
import { PDFOCRProcessor, OCRResult } from './pdf-ocr-processor';

interface PDFOCRSettings {
    language: string;
    separatePages: boolean;
    includeImages: boolean;
    outputFolder: string;
    fastMode?: boolean;
}

const DEFAULT_SETTINGS: PDFOCRSettings = {
    language: 'kor+eng',
    separatePages: true,
    includeImages: true,
    outputFolder: 'OCR Output',
    fastMode: false
}

export default class PDFOCRPlugin extends Plugin {
    settings: PDFOCRSettings;
    processor: PDFOCRProcessor;

    async onload() {
        await this.loadSettings();
        this.processor = new PDFOCRProcessor();

        // 리본 아이콘 추가
        this.addRibbonIcon('file-text', 'PDF OCR 추출', () => {
            new PDFOCRModal(this.app, this).open();
        });

        // 커맨드 추가
        this.addCommand({
            id: 'open-pdf-ocr',
            name: 'PDF OCR 추출 시작',
            callback: () => {
                new PDFOCRModal(this.app, this).open();
            }
        });

        // 모바일 이미지 OCR 커맨드 추가
        this.addCommand({
            id: 'mobile-image-ocr',
            name: '📱 모바일 이미지 OCR',
            callback: () => {
                new MobileImageOCRModal(this.app, this).open();
            }
        });

        // 설정 탭 추가
        this.addSettingTab(new PDFOCRSettingTab(this.app, this));
    }

    async onunload() {
        await this.processor.terminate();
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    async processFile(file: File, onProgress?: (progress: number, page: number, total: number) => void): Promise<boolean> {
        try {
            new Notice('PDF OCR 처리 시작...');

            // OCR 실행
            const results = await this.processor.processFile(file, {
                language: this.settings.language,
                includeImages: this.settings.includeImages,
                fastMode: this.settings.fastMode || false,
                onProgress: (current, total) => {
                    const progress = (current / total) * 100;
                    if (onProgress) {
                        onProgress(progress, current, total);
                    }
                }
            });

            if (results.length === 0) {
                new Notice('처리된 페이지가 없습니다.');
                return false;
            }

            // 결과를 파일로 저장
            await this.saveResults(file.name, results);

            new Notice(`✅ OCR 완료! ${results.length}개 페이지 처리됨`);
            return true;

        } catch (error) {
            console.error('OCR Error:', error);
            new Notice('PDF 처리 중 오류 발생: ' + error.message);
            return false;
        }
    }

    async saveResults(originalFileName: string, results: OCRResult[]) {
        // 출력 폴더 생성 (없으면)
        const folderPath = this.settings.outputFolder;
        const folder = this.app.vault.getAbstractFileByPath(folderPath);
        
        if (!folder) {
            await this.app.vault.createFolder(folderPath);
        }

        const baseName = originalFileName.replace('.pdf', '');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);

        if (this.settings.separatePages) {
            // 각 페이지를 별도 파일로 저장
            for (const result of results) {
                const fileName = `${folderPath}/${baseName}_page_${result.pageNumber}_${timestamp}.md`;
                const content = this.processor.formatAsMarkdown(result, this.settings.includeImages);
                
                await this.app.vault.create(fileName, content);
            }
        } else {
            // 모든 페이지를 하나의 파일로 저장
            const fileName = `${folderPath}/${baseName}_${timestamp}.md`;
            const content = this.processor.combineResults(results, this.settings.includeImages);
            
            await this.app.vault.create(fileName, content);
        }
    }

    async processImage(file: File, onProgress?: (status: string) => void): Promise<string> {
        try {
            if (onProgress) onProgress('이미지 로딩 중...');

            // 이미지를 Canvas로 변환
            const img = await this.createImageFromFile(file);
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d', {
                willReadFrequently: true,
                alpha: false
            });

            if (!ctx) {
                throw new Error('Canvas context 생성 실패');
            }
            
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);

            if (onProgress) onProgress('OCR 엔진 초기화 중...');

            // OCR 초기화
            await this.processor.initialize(this.settings.language);

            if (onProgress) onProgress('텍스트 인식 중...');
            
            // OCR 실행
            const worker = (this.processor as any).worker;
            if (!worker) {
                throw new Error('OCR 워커가 초기화되지 않았습니다');
            }

            const { data } = await worker.recognize(canvas);

            if (onProgress) onProgress('완료!');

            // 메모리 정리
            canvas.width = 0;
            canvas.height = 0;
            canvas.remove();
            img.remove();

            return data.text || '';

        } catch (error) {
            console.error('Image OCR Error:', error);
            throw new Error(`이미지 OCR 실패: ${error.message}`);
        }
    }

    private createImageFromFile(file: File): Promise<HTMLImageElement> {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const url = URL.createObjectURL(file);
            
            img.onload = () => {
                URL.revokeObjectURL(url);
                resolve(img);
            };
            
            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error('이미지 로딩 실패'));
            };
            
            img.src = url;
        });
    }
}

// 모바일 이미지 OCR 모달
class MobileImageOCRModal extends Modal {
    plugin: PDFOCRPlugin;
    selectedImage: File | null = null;
    videoElement: HTMLVideoElement | null = null;
    stream: MediaStream | null = null;
    captureMode: 'gallery' | 'camera' = 'gallery';

    constructor(app: App, plugin: PDFOCRPlugin) {
        super(app);
        this.plugin = plugin;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('mobile-ocr-modal');

        contentEl.createEl('h2', { text: '📱 이미지 OCR 추출' });
        contentEl.createEl('p', { 
            text: '갤러리에서 선택하거나 카메라로 촬영하여 텍스트를 인식합니다',
            cls: 'mobile-ocr-subtitle'
        });

        // 모드 선택 버튼
        const modeContainer = contentEl.createDiv({ cls: 'mode-selection' });
        
        const galleryBtn = modeContainer.createEl('button', {
            text: '🖼️ 갤러리',
            cls: 'mode-btn active'
        });
        
        const cameraBtn = modeContainer.createEl('button', {
            text: '📷 카메라',
            cls: 'mode-btn'
        });

        galleryBtn.addEventListener('click', () => {
            this.switchMode('gallery');
            galleryBtn.addClass('active');
            cameraBtn.removeClass('active');
        });

        cameraBtn.addEventListener('click', () => {
            this.switchMode('camera');
            cameraBtn.addClass('active');
            galleryBtn.removeClass('active');
        });

        // 갤러리 영역
        const galleryArea = contentEl.createDiv({ cls: 'gallery-area' });
        galleryArea.createEl('div', { text: '🖼️', cls: 'upload-icon' });
        galleryArea.createEl('div', { text: '이미지를 선택하세요', cls: 'upload-text' });
        galleryArea.createEl('div', { text: 'JPG, PNG, HEIC 지원', cls: 'upload-subtext' });

        const fileInput = galleryArea.createEl('input', { type: 'file' });
        fileInput.accept = 'image/*';
        fileInput.style.display = 'none';

        galleryArea.addEventListener('click', () => fileInput.click());

        fileInput.addEventListener('change', (e: Event) => {
            const target = e.target as HTMLInputElement;
            if (target.files && target.files[0]) {
                this.handleImageFile(target.files[0], previewArea);
            }
        });

        // 카메라 영역
        const cameraArea = contentEl.createDiv({ cls: 'camera-area' });
        cameraArea.style.display = 'none';

        this.videoElement = cameraArea.createEl('video', {
            attr: {
                autoplay: 'true',
                playsinline: 'true'
            }
        });
        this.videoElement.style.width = '100%';
        this.videoElement.style.maxHeight = '400px';
        this.videoElement.style.borderRadius = '8px';
        this.videoElement.style.backgroundColor = '#000';

        const captureBtn = cameraArea.createEl('button', {
            text: '📸 촬영',
            cls: 'mod-cta capture-btn'
        });

        captureBtn.addEventListener('click', () => {
            this.captureFromCamera(previewArea);
        });

        // 이미지 미리보기 영역
        const previewArea = contentEl.createDiv({ cls: 'image-preview-area' });
        previewArea.style.display = 'none';

        // 진행 상황
        const progressContainer = contentEl.createDiv({ cls: 'ocr-progress' });
        progressContainer.style.display = 'none';
        
        const spinner = progressContainer.createDiv({ cls: 'spinner' });
        const statusText = progressContainer.createDiv({ cls: 'status-text', text: '준비 중...' });

        // OCR 시작 버튼
        const ocrButton = contentEl.createEl('button', { 
            text: '✨ OCR 시작',
            cls: 'mod-cta ocr-start-btn'
        });
        ocrButton.disabled = true;
        ocrButton.style.marginTop = '20px';

        ocrButton.addEventListener('click', async () => {
            if (!this.selectedImage) return;

            ocrButton.disabled = true;
            galleryArea.style.display = 'none';
            cameraArea.style.display = 'none';
            previewArea.style.display = 'none';
            progressContainer.style.display = 'block';

            try {
                const extractedText = await this.plugin.processImage(
                    this.selectedImage,
                    (status) => {
                        statusText.textContent = status;
                    }
                );

                // 결과 모달 표시
                this.showResultModal(extractedText);

            } catch (error) {
                new Notice('OCR 처리 중 오류 발생: ' + error.message);
                ocrButton.disabled = false;
                this.switchMode(this.captureMode);
                progressContainer.style.display = 'none';
            }
        });

        this.addStyles();
    }

    switchMode(mode: 'gallery' | 'camera') {
        this.captureMode = mode;
        const galleryArea = this.contentEl.querySelector('.gallery-area') as HTMLElement;
        const cameraArea = this.contentEl.querySelector('.camera-area') as HTMLElement;

        if (mode === 'gallery') {
            galleryArea.style.display = 'flex';
            cameraArea.style.display = 'none';
            this.stopCamera();
        } else {
            galleryArea.style.display = 'none';
            cameraArea.style.display = 'block';
            this.startCamera();
        }
    }

    async startCamera() {
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: { 
                    facingMode: 'environment', // 후면 카메라 우선
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                }
            });

            if (this.videoElement) {
                this.videoElement.srcObject = this.stream;
            }
        } catch (error) {
            new Notice('카메라 접근 실패: ' + error.message);
            console.error('Camera error:', error);
        }
    }

    stopCamera() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        if (this.videoElement) {
            this.videoElement.srcObject = null;
        }
    }

    captureFromCamera(previewArea: HTMLElement) {
        if (!this.videoElement) return;

        const canvas = document.createElement('canvas');
        canvas.width = this.videoElement.videoWidth;
        canvas.height = this.videoElement.videoHeight;
        
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(this.videoElement, 0, 0);

        // Canvas를 Blob으로 변환
        canvas.toBlob((blob) => {
            if (blob) {
                const file = new File([blob], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
                this.handleImageFile(file, previewArea);
                this.stopCamera();
            }
        }, 'image/jpeg', 0.95);
    }

    handleImageFile(file: File, previewArea: HTMLElement) {
        if (!file.type.startsWith('image/')) {
            new Notice('이미지 파일만 선택할 수 있습니다.');
            return;
        }

        this.selectedImage = file;

        // 미리보기 표시
        previewArea.empty();
        previewArea.style.display = 'block';

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = previewArea.createEl('img', {
                attr: { src: e.target?.result as string }
            });
            img.style.maxWidth = '100%';
            img.style.maxHeight = '300px';
            img.style.borderRadius = '8px';
            img.style.objectFit = 'contain';
            img.style.display = 'block';
            img.style.margin = '0 auto';
        };
        reader.readAsDataURL(file);

        const fileInfo = previewArea.createDiv({ cls: 'file-info' });
        fileInfo.createEl('div', { text: file.name });
        fileInfo.createEl('div', { 
            text: `크기: ${(file.size / 1024).toFixed(0)} KB`,
            cls: 'file-size'
        });

        // OCR 버튼 활성화
        const ocrButton = this.contentEl.querySelector('.ocr-start-btn') as HTMLButtonElement;
        if (ocrButton) {
            ocrButton.disabled = false;
        }
    }

    showResultModal(text: string) {
        const resultModal = new Modal(this.app);
        resultModal.titleEl.setText('✅ OCR 결과');

        const { contentEl } = resultModal;
        contentEl.style.padding = '20px';
        contentEl.style.maxWidth = '600px';

        contentEl.createEl('h3', { text: '추출된 텍스트' });

        const textArea = contentEl.createEl('textarea', {
            value: text
        });
        textArea.style.width = '100%';
        textArea.style.minHeight = '300px';
        textArea.style.padding = '10px';
        textArea.style.fontSize = '14px';
        textArea.style.borderRadius = '8px';
        textArea.style.border = '1px solid var(--background-modifier-border)';
        textArea.style.backgroundColor = 'var(--background-secondary)';
        textArea.style.color = 'var(--text-normal)';
        textArea.style.fontFamily = 'monospace';
        textArea.style.resize = 'vertical';
        textArea.style.boxSizing = 'border-box';

        const btnContainer = contentEl.createDiv();
        btnContainer.style.display = 'flex';
        btnContainer.style.gap = '10px';
        btnContainer.style.marginTop = '15px';

        // 클립보드 복사
        const copyBtn = btnContainer.createEl('button', {
            text: '📋 복사',
            cls: 'mod-cta'
        });
        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(text);
            new Notice('✅ 클립보드에 복사되었습니다');
        });

        // 노트로 저장
        const saveBtn = btnContainer.createEl('button', {
            text: '💾 노트 저장',
            cls: 'mod-cta'
        });
        saveBtn.addEventListener('click', async () => {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            const fileName = `${this.plugin.settings.outputFolder}/OCR_${timestamp}.md`;
            
            // 폴더 생성
            const folder = this.app.vault.getAbstractFileByPath(this.plugin.settings.outputFolder);
            if (!folder) {
                await this.app.vault.createFolder(this.plugin.settings.outputFolder);
            }

            await this.app.vault.create(fileName, `# OCR 추출 결과\n\n${text}`);
            new Notice('✅ 노트가 저장되었습니다');
            resultModal.close();
            this.close();
        });

        // 닫기
        const closeBtn = btnContainer.createEl('button', { text: '닫기' });
        closeBtn.addEventListener('click', () => {
            resultModal.close();
            this.close();
        });

        resultModal.open();
    }

    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .mobile-ocr-modal {
                padding: 20px;
                max-width: 700px;
                width: 100%;
                margin: 0 auto;
            }
            .mobile-ocr-subtitle {
                color: var(--text-muted);
                margin-bottom: 20px;
                text-align: center;
            }
            .mode-selection {
                display: flex;
                gap: 10px;
                margin-bottom: 20px;
                justify-content: center;
            }
            .mode-btn {
                flex: 1;
                max-width: 200px;
                padding: 12px 20px;
                font-size: 16px;
                border-radius: 8px;
                border: 2px solid var(--background-modifier-border);
                background: var(--background-secondary);
                cursor: pointer;
                transition: all 0.2s;
            }
            .mode-btn.active {
                background: var(--interactive-accent);
                color: white;
                border-color: var(--interactive-accent);
            }
            .gallery-area {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 60px 20px;
                border: 2px dashed var(--background-modifier-border);
                border-radius: 12px;
                cursor: pointer;
                transition: all 0.2s;
                background: var(--background-secondary);
            }
            .gallery-area:hover {
                border-color: var(--interactive-accent);
                background: var(--background-modifier-hover);
            }
            .camera-area {
                padding: 20px;
                background: var(--background-secondary);
                border-radius: 12px;
            }
            .capture-btn {
                width: 100%;
                margin-top: 15px;
                padding: 14px;
                font-size: 18px;
            }
            .upload-icon {
                font-size: 60px;
                margin-bottom: 15px;
            }
            .upload-text {
                font-size: 18px;
                font-weight: 600;
                margin-bottom: 8px;
            }
            .upload-subtext {
                font-size: 14px;
                color: var(--text-muted);
            }
            .image-preview-area {
                padding: 20px;
                background: var(--background-secondary);
                border-radius: 12px;
                text-align: center;
            }
            .image-preview-area .file-info {
                margin-top: 15px;
                padding: 10px;
                background: var(--background-primary);
                border-radius: 8px;
            }
            .image-preview-area .file-size {
                font-size: 12px;
                color: var(--text-muted);
                margin-top: 5px;
            }
            .ocr-progress {
                text-align: center;
                padding: 40px;
            }
            .spinner {
                width: 50px;
                height: 50px;
                border: 4px solid var(--background-modifier-border);
                border-top-color: var(--interactive-accent);
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin: 0 auto 20px;
            }
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
            .status-text {
                font-size: 16px;
                color: var(--text-muted);
            }
            .ocr-start-btn {
                width: 100%;
                padding: 14px;
                font-size: 18px;
            }

            @media (max-width: 768px) {
                .mobile-ocr-modal {
                    padding: 16px;
                }
                .mode-btn {
                    font-size: 14px;
                    padding: 10px 16px;
                }
                .gallery-area {
                    padding: 40px 15px;
                }
                .upload-icon {
                    font-size: 50px;
                }
            }
        `;
        document.head.appendChild(style);
    }

    onClose() {
        this.stopCamera();
        const { contentEl } = this;
        contentEl.empty();
    }
}

class PDFOCRModal extends Modal {
    plugin: PDFOCRPlugin;
    selectedFile: File | null = null;

    constructor(app: App, plugin: PDFOCRPlugin) {
        super(app);
        this.plugin = plugin;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('pdf-ocr-modal');

        contentEl.createEl('h2', { text: '📄 PDF OCR 텍스트 추출' });
        contentEl.createEl('p', { 
            text: 'PDF 파일에서 텍스트를 인식하고 마크다운으로 변환합니다',
            cls: 'pdf-ocr-subtitle'
        });

        // 파일 업로드 영역
        const uploadArea = contentEl.createDiv({ cls: 'pdf-ocr-upload-area' });
        uploadArea.createEl('div', { text: '📁', cls: 'upload-icon' });
        uploadArea.createEl('div', { text: 'PDF 파일을 드래그하거나 클릭하여 선택', cls: 'upload-text' });
        uploadArea.createEl('div', { text: '최대 50MB까지 지원', cls: 'upload-subtext' });

        const fileInput = uploadArea.createEl('input', { type: 'file' });
        fileInput.accept = '.pdf';
        fileInput.style.display = 'none';

        uploadArea.addEventListener('click', () => fileInput.click());

        // 파일 정보 표시
        const fileInfo = contentEl.createDiv({ cls: 'pdf-ocr-file-info' });
        fileInfo.style.display = 'none';

        fileInput.addEventListener('change', (e: Event) => {
            const target = e.target as HTMLInputElement;
            if (target.files && target.files[0]) {
                this.handleFile(target.files[0], fileInfo);
            }
        });

        // 드래그 앤 드롭
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.addClass('dragover');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.removeClass('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.removeClass('dragover');
            if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
                this.handleFile(e.dataTransfer.files[0], fileInfo);
            }
        });

        // 현재 설정 표시
        const settingsInfo = contentEl.createDiv({ cls: 'pdf-ocr-settings-info' });
        settingsInfo.createEl('div', { 
            text: `언어: ${this.getLanguageName(this.plugin.settings.language)} | ` +
                  `${this.plugin.settings.separatePages ? '페이지별 분리' : '통합 파일'} | ` +
                  `${this.plugin.settings.includeImages ? '이미지 포함' : '텍스트만'}`,
            cls: 'settings-summary'
        });

        // 진행 상황
        const progressContainer = contentEl.createDiv({ cls: 'pdf-ocr-progress' });
        progressContainer.style.display = 'none';
        
        const progressBar = progressContainer.createDiv({ cls: 'progress-bar' });
        const progressFill = progressBar.createDiv({ cls: 'progress-fill' });
        const progressText = progressContainer.createDiv({ cls: 'progress-text', text: '처리 중... 0%' });

        // 시작 버튼
        const startButton = contentEl.createEl('button', { 
            text: '텍스트 추출 시작',
            cls: 'mod-cta'
        });
        startButton.disabled = true;

        startButton.addEventListener('click', async () => {
            if (!this.selectedFile) return;

            startButton.disabled = true;
            uploadArea.style.display = 'none';
            progressContainer.style.display = 'block';

            const success = await this.plugin.processFile(
                this.selectedFile,
                (progress, page, total) => {
                    progressFill.style.width = `${progress}%`;
                    progressText.textContent = `처리 중... ${page}/${total} 페이지 (${Math.floor(progress)}%)`;
                }
            );

            if (success) {
                progressText.textContent = '완료! ✅ 노트가 생성되었습니다';
                setTimeout(() => this.close(), 2000);
            } else {
                startButton.disabled = false;
                uploadArea.style.display = 'block';
                progressContainer.style.display = 'none';
            }
        });
    }

    getLanguageName(code: string): string {
        const names: Record<string, string> = {
            'kor+eng': '한국어+영어',
            'kor': '한국어',
            'eng': '영어',
            'jpn': '일본어',
            'jpn+eng': '일본어+영어',
            'kor+jpn': '한국어+일본어',
            'chi_sim': '중국어'
        };
        return names[code] || code;
    }

    handleFile(file: File, fileInfo: HTMLElement) {
        if (file.type !== 'application/pdf') {
            new Notice('PDF 파일만 선택할 수 있습니다.');
            return;
        }

        if (file.size > 50 * 1024 * 1024) {
            new Notice('파일 크기는 50MB를 초과할 수 없습니다.');
            return;
        }

        this.selectedFile = file;
        fileInfo.empty();
        fileInfo.createEl('div', { text: file.name, cls: 'file-name' });
        fileInfo.createEl('div', { 
            text: `크기: ${(file.size / 1024 / 1024).toFixed(2)} MB`,
            cls: 'file-details'
        });
        fileInfo.style.display = 'block';

        const startButton = this.contentEl.querySelector('button');
        if (startButton) {
            (startButton as HTMLButtonElement).disabled = false;
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

class PDFOCRSettingTab extends PluginSettingTab {
    plugin: PDFOCRPlugin;

    constructor(app: App, plugin: PDFOCRPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    getLanguageName(code: string): string {
        const names: Record<string, string> = {
            'kor+eng': '한국어+영어',
            'kor': '한국어',
            'eng': '영어',
            'jpn': '일본어',
            'jpn+eng': '일본어+영어',
            'kor+jpn': '한국어+일본어',
            'chi_sim': '중국어'
        };
        return names[code] || code;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'PDF OCR 설정' });

        new Setting(containerEl)
            .setName('인식 언어')
            .setDesc('OCR로 인식할 언어를 선택하세요 (일본어 지원)')
            .addDropdown(dropdown => dropdown
                .addOption('kor+eng', '한국어 + 영어')
                .addOption('kor', '한국어')
                .addOption('eng', '영어')
                .addOption('jpn', '🇯🇵 일본어')
                .addOption('jpn+eng', '일본어 + 영어')
                .addOption('kor+jpn', '한국어 + 일본어')
                .addOption('chi_sim', '중국어 (간체)')
                .setValue(this.plugin.settings.language)
                .onChange(async (value) => {
                    this.plugin.settings.language = value;
                    await this.plugin.saveSettings();
                    new Notice(`언어 변경: ${this.getLanguageName(value)}`);
                }));

        new Setting(containerEl)
            .setName('⚡ 빠른 처리 모드')
            .setDesc('이미지 해상도를 낮춰 처리 속도를 높입니다 (품질 약간 저하)')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.fastMode || false)
                .onChange(async (value) => {
                    this.plugin.settings.fastMode = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('페이지별 노트 생성')
            .setDesc('각 페이지를 별도의 노트로 저장합니다')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.separatePages)
                .onChange(async (value) => {
                    this.plugin.settings.separatePages = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('이미지 포함')
            .setDesc('추출된 페이지 이미지를 노트에 포함합니다')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.includeImages)
                .onChange(async (value) => {
                    this.plugin.settings.includeImages = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('출력 폴더')
            .setDesc('추출된 텍스트를 저장할 폴더')
            .addText(text => text
                .setPlaceholder('OCR Output')
                .setValue(this.plugin.settings.outputFolder)
                .onChange(async (value) => {
                    this.plugin.settings.outputFolder = value;
                    await this.plugin.saveSettings();
                }));
    }
}