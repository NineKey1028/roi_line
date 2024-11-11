// 獲取元素
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const cameraCountInput = document.getElementById('cameraCount');
const lineToolBtn = document.getElementById('lineToolBtn');
const polygonToolBtn = document.getElementById('polygonToolBtn');
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

// 監聽工具按鈕點擊事件，切換工具和按鈕顯示
lineToolBtn.onclick = () => selectTool('line');
polygonToolBtn.onclick = () => selectTool('polygon');
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
    if (polygonPoints.length > 2 && isCloseToFirstPoint(x, y)) {
        roiAreas.push({ type: 'polygon', points: [...polygonPoints], color: selectedColor });
        polygonPoints = [];
    }
}

function isCloseToFirstPoint(x, y) {
    const firstPoint = polygonPoints[0];
    return Math.hypot(firstPoint.x - x, firstPoint.y - y) < 10; // 判斷是否接近首點
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
        ctx.strokeStyle = area.color || 'red';
        ctx.fillStyle = area.color || 'red';
        ctx.lineWidth = 2;

        if (area.type === 'line') {
            ctx.moveTo(area.points[0].x, area.points[0].y);
            ctx.lineTo(area.points[1].x, area.points[1].y);
            ctx.stroke();
        } else if (area.type === 'polygon') {
            area.points.forEach((point, index) => {
                if (index === 0) {
                    ctx.moveTo(point.x, point.y);
                } else {
                    ctx.lineTo(point.x, point.y);
                }
            });
            ctx.closePath();
            ctx.globalAlpha = 0.3;
            ctx.fill(); // 30%透明度填充
            ctx.globalAlpha = 1.0;
            ctx.stroke();
        }
    });
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
