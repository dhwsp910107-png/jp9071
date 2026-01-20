```js
// 강의 체크박스 자동 업데이트 시스템
// 이 스크립트는 강의 구간 완료 시 자동으로 진행률을 업데이트합니다.

module.exports = {
    // 구간 완료 시 호출되는 함수
    updateLectureProgress: async function(tp, filePath) {
        const file = app.vault.getAbstractFileByPath(filePath);
        if (!file) return;
        
        const content = await app.vault.read(file);
        const lines = content.split('\n');
        
        // 완료된 구간 개수 계산
        const completedSegments = (content.match(/- \[x\] \*\*학습 완료\*\* ✅ #강의학습/g) || []).length;
        
        // 총 구간 수 계산
        const totalSegments = (content.match(/- \[ \] \*\*학습 완료\*\* ✅ #강의학습/g) || []).length + completedSegments;
        
        // 메타데이터 업데이트
        let newContent = content;
        
        // completed-segments 업데이트
        if (newContent.includes('completed-segments::')) {
            newContent = newContent.replace(/completed-segments::\s*\d+/, `completed-segments:: ${completedSegments}`);
        } else {
            // completed-segments 필드가 없으면 추가
            const insertIndex = newContent.indexOf('status::');
            if (insertIndex !== -1) {
                const lineStart = newContent.lastIndexOf('\n', insertIndex);
                newContent = newContent.substring(0, lineStart + 1) + 
                           `completed-segments:: ${completedSegments}\n` + 
                           newContent.substring(lineStart + 1);
            }
        }
        
        // 상태 업데이트
        if (completedSegments === totalSegments && totalSegments > 0) {
            newContent = newContent.replace(/status::\s*\S+/, 'status:: 완료');
        } else if (completedSegments > 0) {
            newContent = newContent.replace(/status::\s*\S+/, 'status:: 진행중');
        } else {
            newContent = newContent.replace(/status::\s*\S+/, 'status:: 미시작');
        }
        
        // 파일 저장
        await app.vault.modify(file, newContent);
        
        // 대시보드 업데이트 (선택사항)
        this.refreshDashboard();
    },
    
    // 대시보드 새로고침
    refreshDashboard: function() {
        const dashboardFile = app.vault.getAbstractFileByPath('강의학습/📊 강의학습 대시보드.md');
        if (dashboardFile) {
            // 대시보드 파일이 열려있다면 새로고침
            const leaf = app.workspace.getLeaf(false);
            if (leaf && leaf.view && leaf.view.file === dashboardFile) {
                leaf.view.requestSave();
            }
        }
    },
    
    // 새 강의 생성 도우미
    createNewLecture: async function(tp) {
        const lectureName = await tp.system.prompt("강의명을 입력하세요");
        if (!lectureName) return;
        
        const today = tp.date.now("YYYY-MM-DD");
        const fileName = `${today} ${lectureName} 강의학습`;
        
        // 강의학습 폴더에 새 파일 생성
        const template = await app.vault.read(app.vault.getAbstractFileByPath('Templates/강의학습템플릿.md'));
        const newFile = await app.vault.create(`강의학습/${fileName}.md`, template);
        
        // 새 파일 열기
        app.workspace.openLinkText(newFile.path, '', true);
        
        return newFile.path;
    }
};
```
