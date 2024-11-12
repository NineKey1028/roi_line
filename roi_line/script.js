// 獲取元素
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const cameraCountInput = document.getElementById('cameraCount');
const lineToolBtn = document.getElementById('lineToolBtn');
const polygonToolBtn = document.getElementById('polygonToolBtn');
const nextROIBtn = document.getElementById('nextROIBtn'); // 新增按鈕元素
const colorPicker = document.getElementById('colorPicker');
cameraCountInput.value = 6;
const imageFilesInput = document.getElementById('imageFiles');

let cameraRegions = [];
let roiAreas = [];
let points = [];
let importedImages = [];
let cameraImageMapping = [];
let canceledROIs = [];
let currentTool = 'line'; // 預設工具為線條
let polygonPoints = [];
let selectedColor = colorPicker.value;

// 加載影片
function loadVideo(file) {
    if (file) {
        const url = URL.createObjectURL(file);
        video.src = url;
        video.load();
        video.onloadeddata = () => {
            video.play(); // 自動播放影片
        };
    }
}

// 播放/暫停影片
function togglePlayPause() {
    if (video.paused) {
        video.play();
    } else {
        video.pause();
    }
}

// 設置拖放區域，允許將影片檔拖入來載入
const videoContainer = document.getElementById('videoContainer');
videoContainer.addEventListener('dragover', (e) => {
    e.preventDefault();
    videoContainer.classList.add('drag-over'); // 添加樣式以提示使用者可以拖放
});

videoContainer.addEventListener('dragleave', () => {
    videoContainer.classList.remove('drag-over');
});

videoContainer.addEventListener('drop', (e) => {
    e.preventDefault();
    videoContainer.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('video/')) {
        loadVideo(file); // 載入拖曳的影片
    } else {
        alert('請拖入有效的影片文件');
    }
});

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

// 設置每個原始鏡頭圖片應放置的分割鏡頭
function setupCameraImageMapping() {
    cameraImageMapping = Array(cameraRegions.length).fill(null);
    importedImages.forEach((image, i) => {
        const imageName = imageFilesInput.files[i].name; // 取得每張圖片的名稱
        const regionIndex = prompt(`請選擇圖片 ${imageName} 應放置的分割鏡頭（1-${cameraRegions.length}）：`);
        cameraImageMapping[i] = parseInt(regionIndex) - 1;
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
        const imageName = imageFilesInput.files[imageIndex].name;
        const offCanvas = document.createElement('canvas');
        offCanvas.width = image.width;
        offCanvas.height = image.height;
        const offCtx = offCanvas.getContext('2d');
        offCtx.drawImage(image, 0, 0);
        offCtx.lineWidth = 2;

        const roiData = [];
        roiAreas.forEach((roi) => {
            if (roi.points.some(p => isPointInRegion(p, cameraRegions[regionIndex]))) {
                const scaledPoints = roi.points.map(p => ({
                    x: parseFloat((((p.x - cameraRegions[regionIndex].x) / cameraRegions[regionIndex].width) * image.width).toFixed(2)),
                    y: parseFloat((((p.y - cameraRegions[regionIndex].y) / cameraRegions[regionIndex].height) * image.height).toFixed(2))
                }));

                // 設定每個ROI的顏色
                offCtx.strokeStyle = roi.color || selectedColor;
                offCtx.fillStyle = roi.color || selectedColor;

                // 根據ROI類型應用透明度和填充
                if (roi.type === 'polygon') {
                    offCtx.globalAlpha = 0.3; // 設置多邊形為30%透明
                    offCtx.beginPath();
                    offCtx.moveTo(scaledPoints[0].x, scaledPoints[0].y);
                    scaledPoints.forEach(p => offCtx.lineTo(p.x, p.y));
                    offCtx.closePath();
                    offCtx.fill();
                }

                offCtx.globalAlpha = 1.0; // 重置透明度
                offCtx.beginPath();
                offCtx.moveTo(scaledPoints[0].x, scaledPoints[0].y);
                scaledPoints.forEach(p => offCtx.lineTo(p.x, p.y));
                offCtx.closePath();
                offCtx.stroke();

                roiData.push(`ROI: ${JSON.stringify(scaledPoints)}`);
            }
        });

        offCanvas.toBlob(blob => {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `${imageName}_roi.png`;
            link.click();
        });
        roiTextData.push(`${imageName}\n${roiData.join('\n')}`);
    });

    const blob = new Blob([roiTextData.join('\n\n')], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'roi_coordinates.txt';
    link.click();
    alert('ROI 導出完成');
}



// 檢查點是否在指定的區域內
function isPointInRegion(point, region) {
    return point.x >= region.x && point.x <= region.x + region.width &&
           point.y >= region.y && point.y <= region.y + region.height;
}

// 監聽工具按鈕點擊事件，切換工具和按鈕顯示
lineToolBtn.onclick = () => selectTool('line');
polygonToolBtn.onclick = () => selectTool('polygon');
nextROIBtn.onclick = closePolygon; // 綁定“下一個ROI”按鈕
colorPicker.oninput = (e) => selectedColor = e.target.value;

function selectTool(tool) {
    currentTool = tool;
    lineToolBtn.classList.toggle('selected', tool === 'line');
    polygonToolBtn.classList.toggle('selected', tool === 'polygon');
}

// 在 canvas 上點擊以記錄座標並繪製ROI
canvas.onclick = (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (currentTool === 'line') {
        handleLineTool(x, y);
    } else if (currentTool === 'polygon') {
        handlePolygonTool(x, y);
    }
    drawROI();
};

function handleLineTool(x, y) {
    points.push({ x, y });
    if (points.length === 2) {
        roiAreas.push({ type: 'line', points: [...points], color: selectedColor });
        points = [];
    }
}

function handlePolygonTool(x, y) {
    polygonPoints.push({ x, y });
}

// 關閉並儲存多邊形
function closePolygon() {
    if (polygonPoints.length > 2) {
        roiAreas.push({ type: 'polygon', points: [...polygonPoints], color: selectedColor });
        polygonPoints = []; // 清空點以開始新的多邊形
        drawROI();
    } else {
        alert("請至少選擇三個點來閉合多邊形");
    }
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

// 繪製ROI
function drawROI() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    roiAreas.forEach(area => {
        ctx.beginPath();
        ctx.strokeStyle = area.color || selectedColor;
        ctx.fillStyle = area.color || selectedColor;
        ctx.lineWidth = 2;

        if (area.type === 'line') {
            ctx.globalAlpha = 1.0; // 確保線條為不透明
            ctx.moveTo(area.points[0].x, area.points[0].y);
            ctx.lineTo(area.points[1].x, area.points[1].y);
            ctx.stroke();
        } else if (area.type === 'polygon') {
            ctx.globalAlpha = 0.3; // 設置多邊形為30%透明
            area.points.forEach((point, index) => {
                if (index === 0) {
                    ctx.moveTo(point.x, point.y);
                } else {
                    ctx.lineTo(point.x, point.y);
                }
            });
            ctx.closePath();
            ctx.fill();
            ctx.globalAlpha = 1.0; // 重置透明度
            ctx.stroke();
        }
    });
}





function undoLastROI() {
    if (roiAreas.length > 0) {
        const removedROI = roiAreas.pop(); // 移除最後一個 ROI 區域
        canceledROIs.push(removedROI); // 將移除的 ROI 加入取消復原堆疊
        drawROI(); // 重新繪製畫布上的 ROI 區域
    }
    // else 狀況下不執行任何操作
}

function redoLastROI() {
    if (canceledROIs.length > 0) {
        const restoredROI = canceledROIs.pop(); // 取出取消的最後一個 ROI 區域
        roiAreas.push(restoredROI); // 將其重新加入到 roiAreas
        drawROI(); // 重新繪製畫布上的 ROI 區域
    }
    // else 狀況下不執行任何操作
}

// 快轉或倒退影片
function seekVideo(seconds) {
    video.currentTime += seconds;
}

// 鍵盤事件監聽
document.addEventListener('keydown', (e) => {
    switch (e.key.toLowerCase()) {
        case ' ':
            e.preventDefault();
            togglePlayPause();
            break;
        case 'w':
            seekVideo(1);
            break;
        case 's':
            seekVideo(-1);
            break;
        case 'a':
            seekVideo(-10);
            break;
        case 'd':
            seekVideo(10);
            break;
    }
});

// 綁定按鈕的 onclick
document.getElementById('loadVideoBtn').onclick = () => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'video/*';
    fileInput.onchange = (e) => {
        const file = e.target.files[0];
        loadVideo(file);
    };
    fileInput.click();
};
document.getElementById('playPauseBtn').onclick = togglePlayPause;
document.getElementById('splitScreenBtn').onclick = () => splitScreen(parseInt(cameraCountInput.value));
document.getElementById('importImagesBtn').onclick = importImages;
document.getElementById('exportROIBtn').onclick = exportROI;
document.getElementById('undoROIBtn').onclick = undoLastROI;
document.getElementById('redoROIBtn').onclick = redoLastROI;