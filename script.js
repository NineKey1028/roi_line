// 變量和常數
let cameraRegions = [];
let roiAreas = [];
let points = [];
let importedImages = [];
let cameraImageMapping = [];
let canceledROIs = [];
let currentTool = 'select'; // 默認工具為選擇
let polygonPoints = [];
let canceledPoints = [];
let selectedColor;
let clickPoints = []; // 用来保存所有點擊座標
let isSelectMode = false;
let selectedROI = null;
let isDrawingSquare = false;
let startSquarePoint = null;
let currentSquare = null;
let isDraggingSquare = false; // 用来控制拖曳狀態
let dragOffsetX = 0;
let dragOffsetY = 0;
const initialSquareSize = 10; // 初始正方形大小

// 從 DOM 中獲取元素
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const cameraCountInput = document.getElementById('cameraCount');
cameraCountInput.value = 6;
const lineToolBtn = document.getElementById('lineToolBtn');
const polygonToolBtn = document.getElementById('polygonToolBtn');
const squareToolBtn = document.getElementById('squareToolBtn');
const nextROIBtn = document.getElementById('nextROIBtn');
const colorPicker = document.getElementById('colorPicker');
selectedColor = colorPicker.value;
const imageFilesInput = document.getElementById('imageFiles');
const playPauseControl = document.getElementById('playPauseControl');
const timeSlider = document.getElementById('timeSlider');
const speedControl = document.getElementById('speedControl');
const currentTimeDisplay = document.getElementById('currentTime');
const totalTimeDisplay = document.getElementById('totalTime');
const tooltip = document.getElementById('tooltip');
const saveBtn = document.getElementById('saveBtn');
const loadBtn = document.getElementById('loadBtn');
const toggleSelectModeBtn = document.getElementById('toggleSelectModeBtn');

// 初始化 toggleSelectModeBtn


// 工具按鈕的事件監聽器
toggleSelectModeBtn.onclick = () => selectTool('select');
lineToolBtn.onclick = () => selectTool('line');
polygonToolBtn.onclick = () => selectTool('polygon');
squareToolBtn.onclick = () => selectTool('square');
nextROIBtn.onclick = closePolygon; // 绑定“下一個ROI”按鈕
colorPicker.oninput = (e) => selectedColor = e.target.value;

// canvas 的事件監聽器
canvas.onclick = (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (isSelectMode) {
        // 清除選擇的 ROI
        selectedROI = null;

        // 依照繪製順序檢查點擊 ROI
        const priorityOrder = ['square', 'line', 'polygon'];
        for (const type of priorityOrder) {
            for (let i = roiAreas.length - 1; i >= 0; i--) {
                const roi = roiAreas[i];
                if (roi.type === type && isPointNearROI(x, y, roi)) {
                    selectedROI = roi;
                    drawAll();
                    return; // 一旦找到，立即退出
                }
            }
        }
    } else {
        // 非選擇模式下，處理繪圖工具
        if (currentTool === 'line') {
            handleLineTool(x, y);
        } else if (currentTool === 'polygon') {
            handlePolygonTool(x, y);
        }

        // 僅在繪圖模式下記錄點擊座標
        if (currentTool === 'line' || currentTool === 'polygon') {
            clickPoints.push({ x, y });
            canceledPoints = []; // 點擊新座標時清空撤銷緩存
        }

        drawAll();
    }
};


// 繪製臨時線條
function drawTemporaryLine(x, y) {
    if (currentTool === 'line' && points.length === 1) {
        // 繪製單點到滑鼠的連接線
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        ctx.lineTo(x, y);
        ctx.strokeStyle = selectedColor;
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]); // 虛線效果
        ctx.stroke();
        ctx.setLineDash([]); // 恢復實線
    } else if (currentTool === 'polygon' && polygonPoints.length > 0) {
        // 繪製多邊形所有點的連接線
        ctx.beginPath();
        ctx.strokeStyle = selectedColor;
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]); // 虛線效果

        // 連接所有已經點擊的頂點
        for (let i = 0; i < polygonPoints.length; i++) {
            const startPoint = polygonPoints[i];
            const endPoint = polygonPoints[(i + 1) % polygonPoints.length];
            ctx.moveTo(startPoint.x, startPoint.y);
            if (i < polygonPoints.length - 1) {
                ctx.lineTo(endPoint.x, endPoint.y);
            }
        }

        // 最後一個頂點到滑鼠位置的虛線
        const lastPoint = polygonPoints[polygonPoints.length - 1];
        ctx.moveTo(lastPoint.x, lastPoint.y);
        ctx.lineTo(x, y);

        ctx.stroke();
        ctx.setLineDash([]); // 恢復實線
    }
}

// 修改 canvas.onmousemove
canvas.onmousemove = (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // 更新正方形拖曳
    if (currentTool === 'square' && isDraggingSquare && currentSquare) {
        currentSquare.x = x - dragOffsetX;
        currentSquare.y = y - dragOffsetY;
        drawAll();
    }

    // 動態繪製臨時線條
    drawAll(); // 清除之前的繪圖
    drawTemporaryLine(x, y); // 動態添加臨時效果
};

canvas.onmousedown = (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (currentTool === 'square') {
        // 检查是否點擊在已有的正方形上
        let clickedSquare = null;
        for (let i = roiAreas.length - 1; i >= 0; i--) {
            const roi = roiAreas[i];
            if (roi.type === 'square' && isPointInSquare(x, y, roi)) {
                clickedSquare = roi;
                break;
            }
        }

        if (clickedSquare) {
            // 開始拖曳已有的正方形
            currentSquare = clickedSquare;
            isDraggingSquare = true;
            dragOffsetX = x - currentSquare.x;
            dragOffsetY = y - currentSquare.y;
        } else {
            // 創建新的正方形
            currentSquare = {
                x: x - initialSquareSize / 2,
                y: y - initialSquareSize / 2,
                size: initialSquareSize,
                color: selectedColor,
                type: 'square'
            };
            roiAreas.push(currentSquare);
            isDraggingSquare = true;
            dragOffsetX = x - currentSquare.x;
            dragOffsetY = y - currentSquare.y;
        }
        drawAll();
    }
};

canvas.onmouseup = (e) => {
    if (currentTool === 'square' && isDraggingSquare) {
        isDraggingSquare = false;
        currentSquare = null;
    }
};

// videoContainer 的拖放事件監聽器
const videoContainer = document.getElementById('videoContainer');
videoContainer.addEventListener('dragover', (e) => {
    e.preventDefault();
    videoContainer.classList.add('drag-over'); // 添加樣式以提示用户可以拖放
});
videoContainer.addEventListener('dragleave', () => {
    videoContainer.classList.remove('drag-over');
});
videoContainer.addEventListener('drop', (e) => {
    e.preventDefault();
    videoContainer.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('video/')) {
        loadVideo(file); // 载入拖曳的影片
    } else {
        alert('请拖入有效的影片文件');
    }
});

// video 的事件監聽器
video.onloadedmetadata = () => {
    canvas.width = video.clientWidth;
    canvas.height = video.clientHeight;
};

// 鍵盤事件監聽器
document.addEventListener('keydown', (e) => {
    const isCtrlPressed = e.ctrlKey || e.metaKey;

    if (isCtrlPressed) {
        switch (e.key.toLowerCase()) {
            case 'z':
                e.preventDefault();
                undoLastROI();
                break;
            case 'y':
                e.preventDefault();
                redoLastROI();
                break;
            case 's':
                e.preventDefault();
                saveBtn.click();
                break;
        }
    } else {
        switch (e.key.toLowerCase()) {
            case ' ': // 播放/暫停
                e.preventDefault();
                playPauseControl.click();
                break;
            case 'arrowup': // 快進
            case 'w':
                e.preventDefault();
                seekVideo(0.1);
                break;
            case 'arrowdown': // 快退
            case 's':
                e.preventDefault();
                seekVideo(-0.1);
                break;
            case 'arrowleft': // 倒退
            case 'a':
                seekVideo(-1);
                break;
            case 'arrowright': // 快進
            case 'd':
                seekVideo(1);
                break;
            case '1': // 選取工具
                selectTool('select');
                break;
            case '2': // 線 ROI 工具
                selectTool('line');
                break;
            case '3': // 多邊形工具
                selectTool('polygon');
                break;
            case '4': // 矩形工具
                selectTool('square');
                break;
        }

        if (e.key === 'Delete' && selectedROI) {
            const index = roiAreas.indexOf(selectedROI);
            if (index > -1) {
                roiAreas.splice(index, 1);
                selectedROI = null;
                drawAll();
            }
        }
    }
});


// 绑定按鈕的 onclick 事件
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

document.getElementById('splitScreenBtn').onclick = () => splitScreen(parseInt(cameraCountInput.value));
document.getElementById('importImagesBtn').onclick = importImages;
document.getElementById('exportROIBtn').onclick = exportROI;
document.getElementById('undoROIBtn').onclick = undoLastROI;
document.getElementById('redoROIBtn').onclick = redoLastROI;

// 影片控制的事件監聽器
playPauseControl.addEventListener('click', () => {
    if (video.paused) {
        video.play();
        playPauseControl.textContent = '⏸';
    } else {
        video.pause();
        playPauseControl.textContent = '⏵';
    }
});

// 時間滑塊的事件監聽器
timeSlider.addEventListener('input', () => {
    video.currentTime = timeSlider.value;
});

timeSlider.addEventListener('mousemove', (e) => {
    const rect = timeSlider.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const previewTime = percent * video.duration;

    // 調整 tooltip 位置
    const offset = 200; // 用於微調 tooltip 的位置
    tooltip.style.left = `${e.clientX - rect.left + offset}px`;
    tooltip.style.transform = `translateX(-50%)`;
    tooltip.style.display = 'block';
    tooltip.textContent = formatTime(previewTime);
});

timeSlider.addEventListener('mouseleave', () => {
    tooltip.style.display = 'none';
});

// 速度控制的事件監聽器
speedControl.addEventListener('change', () => {
    video.playbackRate = parseFloat(speedControl.value);
});

// 影片時間更新的事件監聽器
video.addEventListener('loadedmetadata', () => {
    timeSlider.max = video.duration;
    totalTimeDisplay.textContent = formatTime(video.duration);
});

video.addEventListener('timeupdate', () => {
    timeSlider.value = video.currentTime;
    currentTimeDisplay.textContent = formatTime(video.currentTime);
});

// 函數

// 選擇工具的函數
function selectTool(tool) {
    currentTool = tool;
    isSelectMode = (tool === 'select');
    lineToolBtn.classList.toggle('selected', tool === 'line');
    polygonToolBtn.classList.toggle('selected', tool === 'polygon');
    squareToolBtn.classList.toggle('selected', tool === 'square');
    toggleSelectModeBtn.classList.toggle('selected', tool === 'select');
}

// 影片函數
// 加载影片
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

// 快進/快退影片
function seekVideo(seconds) {
    video.currentTime += seconds;
}

// ROI 處理函數
function handleLineTool(x, y) {
    points.push({ x, y });
    if (points.length === 2) {
        roiAreas.push({ type: 'line', points: [...points], color: selectedColor });
        points = [];
        clickPoints = []; // 清除點擊座標
    }
}

function handlePolygonTool(x, y) {
    polygonPoints.push({ x, y });
}

// 關閉並保存多邊形
function closePolygon() {
    if (currentTool === 'polygon' && polygonPoints.length > 2) {
        // 關閉多邊形並保存到roiAreas
        roiAreas.push({ type: 'polygon', points: [...polygonPoints], color: selectedColor });
        polygonPoints = [];
        clickPoints = []; // 清除點擊座標
        drawAll();
    } else if (currentTool === 'polygon') {
        alert("請至少點擊三個點来閉合多邊形");
    }
}

// 繪圖函數
// 繪制cam區域
function drawAll() {
    // 清空畫布
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 繪製攝影機區域
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 4;
    ctx.font = '24px Arial';
    cameraRegions.forEach(region => {
        ctx.strokeRect(region.x, region.y, region.width, region.height);
        ctx.fillStyle = 'red';
        ctx.fillText(`cam ${region.index}`, region.x + 10, region.y + 20);
    });

    // 繪製矩形（Square）
    roiAreas
        .filter(area => area.type === 'square')
        .forEach(area => {
            ctx.globalAlpha = 1.0;
            ctx.strokeStyle = area.color || selectedColor;
            ctx.lineWidth = area === selectedROI ? 6 : 4;
            ctx.strokeRect(area.x, area.y, area.size, area.size);
        });

    // 繪製線條（Line）
    roiAreas
        .filter(area => area.type === 'line')
        .forEach(area => {
            ctx.beginPath();
            ctx.strokeStyle = area.color || selectedColor;
            ctx.lineWidth = area === selectedROI ? 4 : 2;
            ctx.moveTo(area.points[0].x, area.points[0].y);
            ctx.lineTo(area.points[1].x, area.points[1].y);
            ctx.stroke();
        });

    // 繪製多邊形（Polygon）
    roiAreas
        .filter(area => area.type === 'polygon')
        .forEach(area => {
            ctx.globalAlpha = 0.3;
            ctx.fillStyle = area.color || selectedColor;
            ctx.beginPath();
            area.points.forEach((point, index) => {
                if (index === 0) ctx.moveTo(point.x, point.y);
                else ctx.lineTo(point.x, point.y);
            });
            ctx.closePath();
            ctx.fill();
            ctx.globalAlpha = 1.0;
            ctx.strokeStyle = area.color || selectedColor;
            ctx.lineWidth = area === selectedROI ? 4 : 2;
            ctx.stroke();
        });

    // 繪製藍點（正在繪製的點）
    ctx.fillStyle = 'blue';
    if (currentTool === 'line') {
        // 繪製線工具的點
        clickPoints.forEach((point) => {
            ctx.beginPath();
            ctx.arc(point.x, point.y, 3, 0, Math.PI * 2);
            ctx.fill();
        });
    } else if (currentTool === 'polygon') {
        // 繪製多邊形工具的點
        polygonPoints.forEach((point) => {
            ctx.beginPath();
            ctx.arc(point.x, point.y, 3, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    // 繪製當前正方形（Square）正在拖曳時
    if (currentTool === 'square' && currentSquare) {
        ctx.strokeStyle = currentSquare.color || selectedColor;
        ctx.lineWidth = 2;
        ctx.strokeRect(currentSquare.x, currentSquare.y, currentSquare.size, currentSquare.size);
    }
}

// 分割畫面的函數
function splitScreen(count) {
    cameraRegions = [];
    let cols;

    // 根据摄像机數量設置列數
    if (count === 2) {
        cols = 2;
    } else if (count === 3) {
        cols = 3;
    } else if (count === 4) {
        cols = 2;
    } else {
        cols = 3; // 默認為 3 列
    }

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
    drawAll(); // 確保每次分割畫面后更新整個畫布
    setupCameraImageMapping();
}

// 導入圖片的函數
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

// 設置摄像機圖像映射的函數
function setupCameraImageMapping() {
    cameraImageMapping = Array(cameraRegions.length).fill(null);
    importedImages.forEach((image, i) => {
        const imageName = imageFilesInput.files[i].name;
        const regionIndex = prompt(`請選擇圖片 ${imageName} 應放置的分割鏡頭（1-${cameraRegions.length}）：`);
        cameraImageMapping[i] = parseInt(regionIndex) - 1;
    });
}

// 導出 ROI 的函數
function exportROI() {
    if (importedImages.length === 0) {
        alert('請先導入原始鏡頭圖片');
        return;
    }

    const roiTextData = [];
    importedImages.forEach((image, imageIndex) => {
        const regionIndex = cameraImageMapping[imageIndex];
        const imageName = imageFilesInput.files[imageIndex].name;

        if (regionIndex === undefined || cameraRegions[regionIndex] === undefined) {
            console.warn(`跳過未匹配的鏡頭 ${imageName}`);
            return;
        }

        const offCanvas = document.createElement('canvas');
        offCanvas.width = image.width;
        offCanvas.height = image.height;
        const offCtx = offCanvas.getContext('2d');
        offCtx.drawImage(image, 0, 0);

        const roiData = [];
        roiAreas.forEach((roi) => {
            // 處理線條類型
            if (roi.type === 'line' && roi.points) {
                const scaledPoints = roi.points.map(p => ({
                    x: parseFloat((((p.x - cameraRegions[regionIndex].x) / cameraRegions[regionIndex].width) * image.width).toFixed(2)),
                    y: parseFloat((((p.y - cameraRegions[regionIndex].y) / cameraRegions[regionIndex].height) * image.height).toFixed(2))
                }));
                offCtx.strokeStyle = roi.color || selectedColor;
                offCtx.beginPath();
                offCtx.moveTo(scaledPoints[0].x, scaledPoints[0].y);
                offCtx.lineTo(scaledPoints[1].x, scaledPoints[1].y);
                offCtx.stroke();
                roiData.push(`Line ROI: ${JSON.stringify(scaledPoints)}`);
            }

            // 處理多邊形類型
            else if (roi.type === 'polygon' && roi.points) {
                const scaledPoints = roi.points.map(p => ({
                    x: parseFloat((((p.x - cameraRegions[regionIndex].x) / cameraRegions[regionIndex].width) * image.width).toFixed(2)),
                    y: parseFloat((((p.y - cameraRegions[regionIndex].y) / cameraRegions[regionIndex].height) * image.height).toFixed(2))
                }));
                offCtx.fillStyle = roi.color || selectedColor;
                offCtx.globalAlpha = 0.3;
                offCtx.beginPath();
                offCtx.moveTo(scaledPoints[0].x, scaledPoints[0].y);
                scaledPoints.forEach(p => offCtx.lineTo(p.x, p.y));
                offCtx.closePath();
                offCtx.fill();
                offCtx.globalAlpha = 1.0;
                offCtx.strokeStyle = roi.color || selectedColor;
                offCtx.stroke();
                roiData.push(`Polygon ROI: ${JSON.stringify(scaledPoints)}`);
            }

            // 處理正方形類型
            else if (roi.type === 'square') {
                const scaledX = parseFloat((((roi.x - cameraRegions[regionIndex].x) / cameraRegions[regionIndex].width) * image.width).toFixed(2));
                const scaledY = parseFloat((((roi.y - cameraRegions[regionIndex].y) / cameraRegions[regionIndex].height) * image.height).toFixed(2));
                const scaledSize = parseFloat(((roi.size / cameraRegions[regionIndex].width) * image.width).toFixed(2));

                offCtx.strokeStyle = roi.color || selectedColor;
                offCtx.lineWidth = 4; // 設置正方形的線條寬度
                offCtx.strokeRect(scaledX, scaledY, scaledSize, scaledSize);
                roiData.push(`Square ROI: { x: ${scaledX}, y: ${scaledY}, size: ${scaledSize} }`);
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


// 撤销/重做函數
function undoLastROI() {
    if (currentTool === 'line' && clickPoints.length > 0) {
        // 撤銷最後一個點
        const removedPoint = clickPoints.pop();
        canceledPoints.push(removedPoint);
    } else if (currentTool === 'polygon' && polygonPoints.length > 0) {
        // 撤銷最後一個多邊形頂點
        const removedPoint = polygonPoints.pop();
        canceledPoints.push(removedPoint);
    } else if (roiAreas.length > 0) {
        // 撤銷最後一個完成的 ROI
        const removedROI = roiAreas.pop();
        canceledROIs.push(removedROI);
    }
    drawAll(); // 確保畫布即時刷新
}

function redoLastROI() {
    if (currentTool === 'line' && canceledPoints.length > 0) {
        // 復原最後一個點
        const restoredPoint = canceledPoints.pop();
        clickPoints.push(restoredPoint);
    } else if (currentTool === 'polygon' && canceledPoints.length > 0) {
        // 復原最後一個多邊形頂點
        const restoredPoint = canceledPoints.pop();
        polygonPoints.push(restoredPoint);
    } else if (canceledROIs.length > 0) {
        // 復原最後一個完成的 ROI
        const restoredROI = canceledROIs.pop();
        roiAreas.push(restoredROI);
    }
    drawAll(); // 確保畫布即時刷新
}

// 实用函數
// 检查點是否在區域内
function isPointInRegion(point, region) {
    if (!region) return false;
    return point.x >= region.x && point.x <= region.x + region.width &&
           point.y >= region.y && point.y <= region.y + region.height;
}

// 检查點是否靠近 ROI
function isPointNearROI(x, y, roi) {
    const threshold = 5;

    if (roi.type === 'line') {
        const [p1, p2] = roi.points;
        return pointLineDistance(x, y, p1, p2) < threshold;
    } else if (roi.type === 'polygon') {
        const offscreenCanvas = document.createElement('canvas');
        offscreenCanvas.width = canvas.width;
        offscreenCanvas.height = canvas.height;
        const offscreenCtx = offscreenCanvas.getContext('2d');

        offscreenCtx.beginPath();
        roi.points.forEach((point, index) => {
            if (index === 0) {
                offscreenCtx.moveTo(point.x, point.y);
            } else {
                offscreenCtx.lineTo(point.x, point.y);
            }
        });
        offscreenCtx.closePath();

        return offscreenCtx.isPointInPath(x, y);
    } else if (roi.type === 'square') {
        // 檢查是否在矩形內
        return isPointInSquare(x, y, roi);
    }
    return false;
}

// 判断點是否在正方形内的函數
function isPointInSquare(x, y, square) {
    return x >= square.x && x <= square.x + square.size &&
           y >= square.y && y <= square.y + square.size;
}

// 計算點到線的距離
function pointLineDistance(px, py, p1, p2) {
    const A = px - p1.x;
    const B = py - p1.y;
    const C = p2.x - p1.x;
    const D = p2.y - p1.y;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    const param = lenSq !== 0 ? dot / lenSq : -1;

    let xx, yy;

    if (param < 0) {
        xx = p1.x;
        yy = p1.y;
    } else if (param > 1) {
        xx = p2.x;
        yy = p2.y;
    } else {
        xx = p1.x + param * C;
        yy = p1.y + param * D;
    }

    const dx = px - xx;
    const dy = py - yy;
    return Math.sqrt(dx * dx + dy * dy);
}

// 格式化時間
function formatTime(seconds) {
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
}

// 保存和加载函數
saveBtn.onclick = async () => {
    // 检查瀏覽器是否支持 File System Access API
    if ('showSaveFilePicker' in window) {
        try {
            const options = {
                suggestedName: 'roi_project.zip',
                types: [
                    {
                        description: 'ZIP Files',
                        accept: {
                            'application/zip': ['.zip'],
                        },
                    },
                ],
            };

            // 打開保存文件对话框
            const handle = await window.showSaveFilePicker(options);
            const writable = await handle.createWritable();

            const zip = new JSZip();

            // 保存圖片
            const imagesFolder = zip.folder("images");
            importedImages.forEach((img, index) => {
                const imageName = imageFilesInput.files[index].name;
                const dataUrl = img.src.split(",")[1]; // 移除 data URL 前缀
                imagesFolder.file(imageName, dataUrl, { base64: true });
            });

            // 保存影片
            const videoBlob = await fetch(video.src).then(res => res.blob());
            zip.file("video.mp4", videoBlob);

            // 保存設置
            const saveData = {
                roiAreas: roiAreas,
                cameraCount: cameraCountInput.value,
            };
            zip.file("settings.json", JSON.stringify(saveData));

            // 生成 ZIP 文件並寫入到指定位置
            const content = await zip.generateAsync({ type: "blob" });
            await writable.write(content);
            await writable.close();

            alert("存檔完成");
        } catch (err) {
            console.error('保存文件時出錯：', err);
        }
    } else {
        // 如果瀏覽器不支持 File System Access API，則使用傳统方法
        const zip = new JSZip();

        // 保存圖片
        const imagesFolder = zip.folder("images");
        importedImages.forEach((img, index) => {
            const imageName = imageFilesInput.files[index].name;
            const dataUrl = img.src.split(",")[1]; // 移除 data URL 前缀
            imagesFolder.file(imageName, dataUrl, { base64: true });
        });

        // 保存影片
        const videoBlob = await fetch(video.src).then(res => res.blob());
        zip.file("video.mp4", videoBlob);

        // 保存設置
        const saveData = {
            roiAreas: roiAreas,
            cameraCount: cameraCountInput.value,
        };
        zip.file("settings.json", JSON.stringify(saveData));

        // 生成 ZIP 並下载
        zip.generateAsync({ type: "blob" }).then(content => {
            const link = document.createElement("a");
            link.href = URL.createObjectURL(content);
            link.download = "roi_project.zip";
            link.click();
            alert("存檔完成");
        });
    }
};

loadBtn.onclick = () => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'application/zip';
    fileInput.onchange = async (e) => {
        const file = e.target.files[0];
        const zip = await JSZip.loadAsync(file);

        // 加载設置
        const settings = await zip.file("settings.json").async("string");
        const saveData = JSON.parse(settings);
        cameraCountInput.value = saveData.cameraCount;
        roiAreas = saveData.roiAreas;

        // 加载圖片
        const imageFiles = zip.folder("images").files;
        importedImages = [];
        for (const fileName in imageFiles) {
            const imgData = await imageFiles[fileName].async("base64");
            const img = new Image();
            img.src = `data:image/png;base64,${imgData}`;
            importedImages.push(img);
        }

        // 加载影片
        const videoData = await zip.file("video.mp4").async("blob");
        video.src = URL.createObjectURL(videoData);

        // 顯示 ROI 並播放影片
        video.onloadeddata = () => {
            drawAll();
            video.play();
        };

        alert("讀取存檔完成");
    };
    fileInput.click();
};
