<%*
// Properties 기반 진도 자동 업데이트 스크립트
const file = tp.file.find_tfile(tp.file.path(true));
if (!file) {
    new Notice("❌ 파일을 찾을 수 없습니다.");
    return;
}

// 파일 내용 읽기
let content = await app.vault.read(file);

// 완료된 구간 수 계산
const completedSegments = (content.match(/- \[x\] \*\*학습 완료\*\* ✅ #강의학습/g) || []).length;
const totalSegments = (content.match(/- \[.\] \*\*학습 완료\*\* ✅ #강의학습/g) || []).length;

// 진행률 계산
const progressPercent = totalSegments > 0 ? Math.round((completedSegments / totalSegments) * 100) : 0;

// 상태 결정
let status = "미시작";
if (completedSegments === totalSegments && totalSegments > 0) {
    status = "완료";
} else if (completedSegments > 0) {
    status = "진행중";
}

// Properties 업데이트
try {
    // 현재 Properties 가져오기
    await app.fileManager.processFrontMatter(file, (frontmatter) => {
        frontmatter["completed-segments"] = completedSegments;
        frontmatter["status"] = status;
        
        // 완료 시 완료 시간 기록
        if (status === "완료" && !frontmatter["study-end-time"]) {
            frontmatter["study-end-time"] = tp.date.now("HH:mm");
        }
        
        // 시작 시간이 없고 첫 구간을 완료했다면 시작 시간 기록
        if (completedSegments > 0 && !frontmatter["study-start-time"]) {
            frontmatter["study-start-time"] = tp.date.now("HH:mm");
        }
    });
    
    // 성공 메시지
    if (completedSegments === totalSegments && totalSegments > 0) {
        new Notice("🎉 축하합니다! 강의 학습이 완료되었습니다!");
    } else {
        new Notice(`📚 진도 업데이트: ${completedSegments}/${totalSegments} 구간 완료 (${progressPercent}%)`);
    }
    
} catch (error) {
    new Notice("❌ Properties 업데이트 중 오류가 발생했습니다.");
    console.error("Properties update error:", error);
}
%>

✅ **Properties 기반 진도가 자동으로 업데이트되었습니다!**

- **완료 구간**: <%= completedSegments %>/<%= totalSegments %>
- **진행률**: <%= progressPercent %>%
- **상태**: <%= status %>
- **업데이트 시간**: <%= tp.date.now("YYYY-MM-DD HH:mm") %>

<%* if (status === "완료") { %>
🎉 **축하합니다! 강의를 완주하셨습니다!**

이제 다음 강의로 넘어가거나 [[📊 강의학습 대시보드 (Properties)]]에서 전체 진행 상황을 확인해보세요.
<%* } else { %>
📚 **계속 학습하세요!**

남은 구간: <%= totalSegments - completedSegments %>개 (약 <%= (totalSegments - completedSegments) * 10 %>분)
<%* } %>

---
**💡 팁**: Obsidian Properties 패널에서 난이도, 만족도 등의 평가도 입력할 수 있습니다!
