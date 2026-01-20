import * as pdfjsLib from 'pdfjs-dist';
import { createWorker, Worker } from 'tesseract.js';

// PDF.js worker 설정
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

export interface OCRResult {
    pageNumber: number;
    text: string;
    imageData?: string; // base64 이미지
    confidence: number;
}

export interface ProcessOptions {
    language: string;
    includeImages: boolean;
    fastMode?: boolean;
    onProgress?: (current: number, total: number) => void;
}

export class PDFOCRProcessor {
    private worker: Worker | null = null;
    private currentLanguage: string = '';
    private isInitializing: boolean = false;

    async initialize(language: string) {
        // 이미 초기화 중이면 대기
        if (this.isInitializing) {
            await this.waitForInitialization();
            return;
        }

        // 이미 같은 언어로 초기화되어 있으면 스킵
        if (this.worker && this.currentLanguage === language) {
            return;
        }

        try {
            this.isInitializing = true;

            // 기존 워커 종료
            if (this.worker) {
                await this.worker.terminate();
                this.worker = null;
            }

            // Tesseract.js Worker 생성
            this.worker = await createWorker(language, 1, {
                logger: (m) => {
                    // 디버그용 로그 (필요시 주석 해제)
                    // console.log(m);
                },
                cachePath: '.',
                gzip: false,
            });
            
            // OCR 파라미터 설정 (성능 최적화)
            await this.worker.setParameters({
                tessedit_pageseg_mode: 1 as any, // Auto page segmentation with OSD
                tessedit_ocr_engine_mode: 2 as any, // LSTM only (더 빠르고 정확)
            });

            this.currentLanguage = language;
        } catch (error) {
            console.error('Tesseract initialization error:', error);
            this.worker = null;
            throw new Error(`OCR 엔진 초기화 실패: ${error.message}`);
        } finally {
            this.isInitializing = false;
        }
    }

    private async waitForInitialization(): Promise<void> {
        let attempts = 0;
        const maxAttempts = 50; // 5초 대기
        
        while (this.isInitializing && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }

        if (this.isInitializing) {
            throw new Error('OCR 초기화 타임아웃');
        }
    }

    async processFile(file: File, options: ProcessOptions): Promise<OCRResult[]> {
        // 언어 변경이 필요하면 재초기화
        if (!this.worker || this.currentLanguage !== options.language) {
            await this.initialize(options.language);
        }

        if (!this.worker) {
            throw new Error('OCR 워커가 초기화되지 않았습니다');
        }

        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        const numPages = pdf.numPages;
        const results: OCRResult[] = [];

        // 해상도 설정 (빠른 모드면 낮게, 아니면 높게)
        const scale = options.fastMode ? 1.2 : 2.0;

        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
            try {
                const page = await pdf.getPage(pageNum);
                
                // PDF 페이지를 Canvas로 렌더링
                const viewport = page.getViewport({ scale });
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d', { 
                    willReadFrequently: true,
                    alpha: false // 알파 채널 비활성화로 성능 향상
                });

                if (!context) {
                    throw new Error('Canvas context 생성 실패');
                }
                
                canvas.width = viewport.width;
                canvas.height = viewport.height;

                // 렌더링
                await page.render({
                    canvasContext: context,
                    viewport: viewport,
                    intent: 'print' // 더 선명한 렌더링
                }).promise;

                // 이미지 데이터 추출 (필요시)
                let imageData: string | undefined = undefined;
                if (options.includeImages) {
                    // JPEG 압축 (PNG보다 훨씬 작음)
                    imageData = canvas.toDataURL('image/jpeg', 0.85);
                }

                // OCR 실행
                const { data } = await this.worker.recognize(canvas);
                
                const result: OCRResult = {
                    pageNumber: pageNum,
                    text: data.text || '',
                    confidence: data.confidence || 0,
                    imageData: imageData
                };

                results.push(result);

                // 진행 상황 업데이트
                if (options.onProgress) {
                    options.onProgress(pageNum, numPages);
                }

                // 메모리 정리
                canvas.width = 0;
                canvas.height = 0;
                canvas.remove();

                // 페이지 정리
                page.cleanup();

            } catch (error) {
                console.error(`Page ${pageNum} processing error:`, error);
                // 실패한 페이지는 빈 결과로 추가
                results.push({
                    pageNumber: pageNum,
                    text: `[페이지 ${pageNum} 처리 실패: ${error.message}]`,
                    confidence: 0,
                });
            }
        }

        // PDF 문서 정리
        pdf.cleanup();

        return results;
    }

    async terminate() {
        if (this.worker) {
            try {
                await this.worker.terminate();
            } catch (error) {
                console.error('Worker termination error:', error);
            }
            this.worker = null;
            this.currentLanguage = '';
        }
    }

    // 텍스트를 마크다운으로 포맷팅
    formatAsMarkdown(result: OCRResult, includeImage: boolean = true): string {
        let markdown = `# Page ${result.pageNumber}\n\n`;
        
        if (includeImage && result.imageData) {
            markdown += `![Page ${result.pageNumber}](${result.imageData})\n\n`;
        }
        
        markdown += `**OCR Confidence:** ${result.confidence.toFixed(2)}%\n\n`;
        markdown += `---\n\n`;
        markdown += result.text.trim();
        markdown += `\n\n---\n`;
        
        return markdown;
    }

    // 여러 페이지를 하나의 마크다운으로 합치기
    combineResults(results: OCRResult[], includeImages: boolean = true): string {
        let combined = `# OCR Extracted Text\n\n`;
        combined += `**Total Pages:** ${results.length}\n`;
        combined += `**Average Confidence:** ${this.calculateAverageConfidence(results).toFixed(2)}%\n\n`;
        combined += `---\n\n`;

        results.forEach(result => {
            combined += this.formatAsMarkdown(result, includeImages);
            combined += '\n';
        });

        return combined;
    }

    private calculateAverageConfidence(results: OCRResult[]): number {
        if (results.length === 0) return 0;
        const sum = results.reduce((acc, r) => acc + r.confidence, 0);
        return sum / results.length;
    }
}
