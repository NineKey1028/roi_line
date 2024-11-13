// 變數和常數
let cameraRegions = [];
let roiAreas = [];
let points = [];
let importedImages = [];
let cameraImageMapping = [];
let canceledROIs = [];
let currentTool = 'line'; // 預設工具為線條
let polygonPoints = [];
let selectedColor;
let clickPoints = []; // 用來保存所有點擊座標
let isSelectMode = false;
let selectedROI = null;

// 從 DOM 中獲取元素
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const cameraCountInput = document.getElementById('cameraCount');
cameraCountInput.value = 6;
const lineToolBtn = document.getElementById('lineToolBtn');
const polygonToolBtn = document.getElementById('polygonToolBtn');
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
toggleSelectModeBtn.textContent = "👆🏻"; // 使用鼠標符號

// 工具按鈕的事件監聽器
toggleSelectModeBtn.onclick = () => selectTool('select');
lineToolBtn.onclick = () => selectTool('line');
polygonToolBtn.onclick = () => selectTool('polygon');
nextROIBtn.onclick = closePolygon; // 綁定“下一個ROI”按鈕
colorPicker.oninput = (e) => selectedColor = e.target.value;

// canvas 的事件監聽器
canvas.onclick = (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (isSelectMode) {
        selectedROI = null;
        for (let roi of roiAreas) {
            if (isPointNearROI(x, y, roi)) {
                selectedROI = roi;
                break;
            }
        }
        drawROI();
    } else {
        if (currentTool === 'line') {
            handleLineTool(x, y);
        } else if (currentTool === 'polygon') {
            handlePolygonTool(x, y);
        }
        drawROI();
    }
};

// videoContainer 的拖放事件監聽器
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

// video 的事件監聽器
video.onloadedmetadata = () => {
    canvas.width = video.clientWidth;
    canvas.height = video.clientHeight;
};

// 鍵盤事件監聽器
document.addEventListener('keydown', (e) => {
    switch (e.key.toLowerCase()) {
        case ' ':
            e.preventDefault();
            playPauseControl.click();
            break;
        case 'arrowup':
        case 'w':
            seekVideo(1);
            break;
        case 'arrowdown':
        case 's':
            seekVideo(-1);
            break;
        case 'arrowleft':
        case 'a':
            seekVideo(-10);
            break;
        case 'arrowright':
        case 'd':
            seekVideo(10);
            break;
    }
    if (e.key === 'Delete' && selectedROI) {
        const index = roiAreas.indexOf(selectedROI);
        if (index > -1) {
            roiAreas.splice(index, 1); // 從陣列中移除選中的ROI
            selectedROI = null; // 重置選中
            drawROI(); // 重新繪製
        }
    }
});

// 綁定按鈕的 onclick 事件
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
    // 根據選取的工具設定 currentTool 並更新按鈕狀態
    currentTool = tool;

    // 重置所有工具按鈕的選中狀態
    lineToolBtn.classList.toggle('selected', tool === 'line');
    polygonToolBtn.classList.toggle('selected', tool === 'polygon');
    toggleSelectModeBtn.classList.toggle('selected', tool === 'select');

    // 更新 isSelectMode 狀態
    isSelectMode = (tool === 'select');
}

// 影片函數
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
    if (polygonPoints.length > 2) {
        roiAreas.push({ type: 'polygon', points: [...polygonPoints], color: selectedColor });
        polygonPoints = [];
        clickPoints = []; // 清除點擊座標
        drawROI();
    } else {
        alert("請至少選擇三個點來閉合多邊形");
    }
}

// 繪圖函數
// 繪製攝像機區域
function drawRegions() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 4;
    ctx.font = '24px Arial';
    cameraRegions.forEach(region => {
        ctx.strokeRect(region.x, region.y, region.width, region.height);
        ctx.fillStyle = 'red';
        ctx.fillText(`cam ${region.index}`, region.x + 10, region.y + 20);
    });
}

// 繪製 ROI
function drawROI() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 繪製每個 ROI 區域
    roiAreas.forEach(area => {
        ctx.beginPath();
        
        // 設置選中和未選中 ROI 的樣式
        ctx.strokeStyle = area.color || selectedColor;
        ctx.fillStyle = area.color || selectedColor;
        ctx.lineWidth = area === selectedROI ? 4 : 2; // 若為選中 ROI，則線條加粗

        if (area.type === 'line') {
            // 繪製線條 ROI
            ctx.globalAlpha = 1.0;
            ctx.moveTo(area.points[0].x, area.points[0].y);
            ctx.lineTo(area.points[1].x, area.points[1].y);
            ctx.stroke();
        } else if (area.type === 'polygon') {
            // 繪製多邊形 ROI
            ctx.globalAlpha = 0.3; // 設置多邊形的透明度
            area.points.forEach((point, index) => {
                if (index === 0) {
                    ctx.moveTo(point.x, point.y);
                } else {
                    ctx.lineTo(point.x, point.y);
                }
            });
            ctx.closePath();
            ctx.fill(); // 填充多邊形
            ctx.globalAlpha = 1.0; // 重置透明度
            ctx.stroke(); // 描邊多邊形
        }
    });

    // 繪製點擊點（如果有）
    if (clickPoints.length > 0) {
        ctx.fillStyle = 'blue';
        clickPoints.forEach(point => {
            ctx.beginPath();
            ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.closePath();
        });
    }
}

// 分割畫面的函數
function splitScreen(count) {
    cameraRegions = [];
    let cols;

    // 根據攝像機數量設置列數
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
    drawRegions();
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

// 設置攝像機圖像映射的函數
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

                // 設置每個 ROI 的顏色
                offCtx.strokeStyle = roi.color || selectedColor;
                offCtx.fillStyle = roi.color || selectedColor;

                // 根據 ROI 類型應用透明度和填充
                if (roi.type === 'polygon') {
                    offCtx.globalAlpha = 0.3;
                    offCtx.beginPath();
                    offCtx.moveTo(scaledPoints[0].x, scaledPoints[0].y);
                    scaledPoints.forEach(p => offCtx.lineTo(p.x, p.y));
                    offCtx.closePath();
                    offCtx.fill();
                }

                offCtx.globalAlpha = 1.0;
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

// 撤銷/重做函數
function undoLastROI() {
    if (roiAreas.length > 0) {
        const removedROI = roiAreas.pop();
        canceledROIs.push(removedROI);
        drawROI();
    }
}

function redoLastROI() {
    if (canceledROIs.length > 0) {
        const restoredROI = canceledROIs.pop();
        roiAreas.push(restoredROI);
        drawROI();
    }
}

// 實用函數
// 檢查點是否在區域內
function isPointInRegion(point, region) {
    if (!region) return false;
    return point.x >= region.x && point.x <= region.x + region.width &&
           point.y >= region.y && point.y <= region.y + region.height;
}

// 檢查點是否靠近 ROI
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
    }
    return false;
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

// 保存和加载函数
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

            // 打开保存文件对话框
            const handle = await window.showSaveFilePicker(options);
            const writable = await handle.createWritable();

            const zip = new JSZip();

            // 保存圖片
            const imagesFolder = zip.folder("images");
            importedImages.forEach((img, index) => {
                const imageName = imageFilesInput.files[index].name;
                const dataUrl = img.src.split(",")[1]; // 移除 data URL 前綴
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

            // 生成 ZIP 文件並写入到指定位置
            const content = await zip.generateAsync({ type: "blob" });
            await writable.write(content);
            await writable.close();

            alert("存檔完成");
        } catch (err) {
            console.error('保存文件时出错：', err);
        }
    } else {
        // 如果瀏覽器不支持 File System Access API，则使用傳统方法
        const zip = new JSZip();

        // 保存圖片
        const imagesFolder = zip.folder("images");
        importedImages.forEach((img, index) => {
            const imageName = imageFilesInput.files[index].name;
            const dataUrl = img.src.split(",")[1]; // 移除 data URL 前綴
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

        // 加載設置
        const settings = await zip.file("settings.json").async("string");
        const saveData = JSON.parse(settings);
        cameraCountInput.value = saveData.cameraCount;
        roiAreas = saveData.roiAreas;

        // 加載圖片
        const imageFiles = zip.folder("images").files;
        importedImages = [];
        for (const fileName in imageFiles) {
            const imgData = await imageFiles[fileName].async("base64");
            const img = new Image();
            img.src = `data:image/png;base64,${imgData}`;
            importedImages.push(img);
        }

        // 加載影片
        const videoData = await zip.file("video.mp4").async("blob");
        video.src = URL.createObjectURL(videoData);

        // 顯示 ROI 並播放影片
        video.onloadeddata = () => {
            drawROI();
            video.play();
        };

        alert("讀取存檔完成");
    };
    fileInput.click();
};
