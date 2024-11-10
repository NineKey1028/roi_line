// 獲取元素
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const cameraCountInput = document.getElementById('cameraCount');
cameraCountInput.value = 6;
const imageFilesInput = document.getElementById('imageFiles');

let cameraRegions = [];
let roiAreas = [];
let points = [];
let importedImages = [];
let cameraImageMapping = []; // 用於記錄每個原始鏡頭圖片應放置的分割鏡頭

// 加載影片
function loadVideo() {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'video/*';
    fileInput.onchange = e => {
        const file = e.target.files[0];
        if (file) {
            const url = URL.createObjectURL(file);
            video.src = url;
            video.load();
        }
    };
    fileInput.click();
}

// 播放/暫停影片
function togglePlayPause() {
    if (video.paused) {
        video.play();
    } else {
        video.pause();
    }
}

// 同步 canvas 大小與影片大小
video.onloadedmetadata = () => {
    canvas.width = video.clientWidth;
    canvas.height = video.clientHeight;
};

// 分割畫面
function splitScreen(count) {
    cameraRegions = [];
    const cols = 3;
    const rows = Math.ceil(count / cols);
    const videoDisplayWidth = video.clientWidth;
    const videoDisplayHeight = video.clientHeight;
    const cellWidth = videoDisplayWidth / cols;
    const cellHeight = videoDisplayHeight / rows;

    let index = 0;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (index >= count) break;
            cameraRegions.push({
                x: c * cellWidth,
                y: r * cellHeight,
                width: cellWidth,
                height: cellHeight,
                index: index + 1
            });
            index++;
        }
    }
    drawRegions();
    setupCameraImageMapping();
}

// 設置每個原始鏡頭圖片應放置的分割鏡頭
function setupCameraImageMapping() {
    cameraImageMapping = Array(cameraRegions.length).fill(null);
    importedImages.forEach((image, i) => {
        const imageName = imageFilesInput.files[i].name; // 取得每張圖片的名稱
        const regionIndex = prompt(`請選擇圖片 ${imageName} 應放置的分割鏡頭（1-${cameraRegions.length}）：`);
        cameraImageMapping[i] = parseInt(regionIndex) - 1;
    });
}

// 繪製鏡頭分割區域
function drawRegions() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 4;
    cameraRegions.forEach(region => {
        ctx.strokeRect(region.x, region.y, region.width, region.height);
        ctx.fillStyle = 'red';
        ctx.fillText(`鏡頭 ${region.index}`, region.x + 10, region.y + 20);
    });
}

// 在 canvas 上點擊以記錄座標並繪製ROI
canvas.onclick = (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    points.push({ x, y });

    if (points.length === 2) {
        roiAreas.push({ type: 'line', points: [...points] });
        points = [];
    } else if (points.length === 4) {
        roiAreas.push({ type: 'rect', points: [...points] });
        points = [];
    }
    drawROI();
};

// 繪製 ROI
function drawROI() {
    drawRegions();
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 4;

    roiAreas.forEach(roi => {
        if (roi.type === 'line') {
            const [p1, p2] = roi.points;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
        } else if (roi.type === 'rect') {
            const [p1, p2, p3, p4] = roi.points;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.lineTo(p3.x, p3.y);
            ctx.lineTo(p4.x, p4.y);
            ctx.closePath();
            ctx.stroke();
        }
    });
}

// 導出 ROI
function exportROI() {
    if (importedImages.length === 0) {
        alert('請先導入原始鏡頭圖片');
        return;
    }
    const roiTextData = [];
    importedImages.forEach((image, imageIndex) => {
        const regionIndex = cameraImageMapping[imageIndex];
        const imageName = imageFilesInput.files[imageIndex].name; // 獲取原始鏡頭檔名

        const offCanvas = document.createElement('canvas');
        offCanvas.width = image.width;
        offCanvas.height = image.height;
        const offCtx = offCanvas.getContext('2d');
        offCtx.drawImage(image, 0, 0);
        offCtx.strokeStyle = 'red';
        offCtx.lineWidth = 4;

        const roiData = [];
        roiAreas.forEach((roi) => {
            if (roi.points.some(p => isPointInRegion(p, cameraRegions[regionIndex]))) {
                const scaledPoints = roi.points.map(p => ({
    x: parseFloat((((p.x - cameraRegions[regionIndex].x) / cameraRegions[regionIndex].width) * image.width).toFixed(2)),
    y: parseFloat((((p.y - cameraRegions[regionIndex].y) / cameraRegions[regionIndex].height) * image.height).toFixed(2))
}));
                offCtx.beginPath();
                offCtx.moveTo(scaledPoints[0].x, scaledPoints[0].y);
                scaledPoints.forEach(p => offCtx.lineTo(p.x, p.y));
                offCtx.stroke();
                roiData.push(`ROI: ${JSON.stringify(scaledPoints)}`);
            }
        });

        offCanvas.toBlob(blob => {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `${imageName}_roi.png`; // 使用原始鏡頭的檔名
            link.click();
        });
        roiTextData.push(`${imageName}
${roiData.join('\n')}`);
    });

    // 匯出 ROI 座標記錄 txt 檔
    const blob = new Blob([roiTextData.join('\n\n')], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'roi_coordinates.txt';
    link.click();
    alert('ROI 導出完成');
}

// 導入原始鏡頭圖片
function importImages() {
    imageFilesInput.click();
}

imageFilesInput.onchange = (e) => {
    const files = e.target.files;
    if (files.length !== cameraRegions.length) {
        alert('導入的圖片數量與鏡頭數量不符');
        return;
    }
    importedImages = [];
    let loadedCount = 0;
    for (let i = 0; i < files.length; i++) {
        const img = new Image();
        img.onload = () => {
            loadedCount++;
            if (loadedCount === files.length) {
                alert('原始鏡頭圖片導入完成');
            }
        };
        img.src = URL.createObjectURL(files[i]);
        importedImages.push(img);
    }
};
// 播放/暫停影片
function togglePlayPause() {
    if (video.paused) {
        video.play();
    } else {
        video.pause();
    }
}

// 快轉或倒退影片
function seekVideo(seconds) {
    video.currentTime += seconds;
}

// 鍵盤事件監聽
document.addEventListener('keydown', (e) => {
    switch (e.key.toLowerCase()) { // 將 e.key 轉為小寫
        case ' ': // 空白鍵
            e.preventDefault(); // 防止頁面捲動
            togglePlayPause();
            break;
        case 'w': // 上鍵
            seekVideo(1); // 快進 1 秒
            break;
        case 's': // 下鍵
            seekVideo(-1); // 倒退 1 秒
            break;
        case 'a': // 左鍵
            seekVideo(-10); // 倒退 10 秒
            break;
        case 'd': // 右鍵
            seekVideo(10); // 快進 10 秒
            break;
    }
});


// 檢查點是否在指定的區域內
function isPointInRegion(point, region) {
    return point.x >= region.x && point.x <= region.x + region.width &&
           point.y >= region.y && point.y <= region.y + region.height;
}

// 將函數直接綁定至按鈕的 onclick
document.getElementById('loadVideoBtn').onclick = loadVideo;
document.getElementById('playPauseBtn').onclick = togglePlayPause;
document.getElementById('splitScreenBtn').onclick = () => splitScreen(parseInt(cameraCountInput.value));
document.getElementById('importImagesBtn').onclick = importImages;
document.getElementById('exportROIBtn').onclick = exportROI;
