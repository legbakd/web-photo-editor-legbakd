document.addEventListener('DOMContentLoaded', () => {
    const imageUpload = document.getElementById('imageUpload');
    const saveImageBtn = document.getElementById('saveImageBtn');
    const imageCanvas = document.getElementById('imageCanvas');
    const ctx = imageCanvas.getContext('2d');
    const noImageText = document.getElementById('noImageText');

    // 슬라이더 및 값 표시 요소
    const brightnessSlider = document.getElementById('brightnessSlider');
    const brightnessValue = document.getElementById('brightnessValue');
    const contrastSlider = document.getElementById('contrastSlider');
    const contrastValue = document.getElementById('contrastValue');
    const saturationSlider = document.getElementById('saturationSlider');
    const saturationValue = document.getElementById('saturationValue');
    const rotationSlider = document.getElementById('rotationSlider');
    const rotationValue = document.getElementById('rotationValue');

    // 크롭 관련 요소
    const startCropBtn = document.getElementById('startCropBtn');
    const applyCropBtn = document.getElementById('applyCropBtn');
    const cancelCropBtn = document.getElementById('cancelCropBtn');
    const cropInfo = document.querySelector('.crop-info');

    let originalImage = new Image(); // 원본 이미지 데이터를 보관할 Image 객체
    let isImageLoaded = false;

    // 보정 값 저장
    let adjustments = {
        brightness: 1,
        contrast: 1,
        saturation: 1,
        rotation: 0 // 도 단위
    };

    // --- 크롭 관련 변수 및 상수 ---
    let isCropping = false; // 크롭 모드 활성화 여부
    let cropRect = { x: 0, y: 0, width: 0, height: 0 }; // 현재 크롭 영역
    let isDragging = false; // 크롭 영역 이동 중
    let isResizing = false; // 크롭 핸들 리사이즈 중
    let resizeHandle = ''; // 어떤 핸들을 잡고 있는지 (nw, ne, sw, se, n, s, w, e)
    let dragOffsetX, dragOffsetY; // 드래그 시작 시 마우스와 크롭 영역 좌상단 간의 오프셋
    const HANDLE_SIZE = 10; // 크롭 핸들의 크기 (픽셀)

    // --- 이벤트 리스너 ---

    imageUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                originalImage.onload = () => {
                    isImageLoaded = true;
                    noImageText.style.display = 'none';
                    resetAdjustments(); // 모든 보정값 초기화
                    initializeCanvas(); // 캔버스 초기화 및 이미지 그리기
                    enableControls(); // 컨트롤 활성화
                };
                originalImage.src = event.target.result;
            };
            reader.readAsDataURL(file);
        }
    });

    saveImageBtn.addEventListener('click', () => {
        if (isImageLoaded) {
            const link = document.createElement('a');
            link.download = 'edited_photo.png';
            link.href = imageCanvas.toDataURL('image/png');
            link.click();
        }
    });

    brightnessSlider.addEventListener('input', (e) => {
        adjustments.brightness = parseFloat(e.target.value);
        brightnessValue.value = adjustments.brightness;
        drawAdjustedImage();
    });
    brightnessValue.addEventListener('input', (e) => {
        let val = parseFloat(e.target.value);
        if (isNaN(val)) val = 1;
        if (val < 0.5) val = 0.5;
        if (val > 1.5) val = 1.5;
        adjustments.brightness = val;
        brightnessSlider.value = val;
        drawAdjustedImage();
    });

    contrastSlider.addEventListener('input', (e) => {
        adjustments.contrast = parseFloat(e.target.value);
        contrastValue.value = adjustments.contrast;
        drawAdjustedImage();
    });
    contrastValue.addEventListener('input', (e) => {
        let val = parseFloat(e.target.value);
        if (isNaN(val)) val = 1;
        if (val < 0.5) val = 0.5;
        if (val > 1.5) val = 1.5;
        adjustments.contrast = val;
        contrastSlider.value = val;
        drawAdjustedImage();
    });

    saturationSlider.addEventListener('input', (e) => {
        adjustments.saturation = parseFloat(e.target.value);
        saturationValue.value = adjustments.saturation;
        drawAdjustedImage();
    });
    saturationValue.addEventListener('input', (e) => {
        let val = parseFloat(e.target.value);
        if (isNaN(val)) val = 1;
        if (val < 0) val = 0;
        if (val > 2) val = 2;
        adjustments.saturation = val;
        saturationSlider.value = val;
        drawAdjustedImage();
    });

    rotationSlider.addEventListener('input', (e) => {
        adjustments.rotation = parseFloat(e.target.value);
        rotationValue.value = adjustments.rotation;
        drawAdjustedImage();
    });
    rotationValue.addEventListener('input', (e) => {
        let val = parseFloat(e.target.value);
        if (isNaN(val)) val = 0;
        if (val < -180) val = -180;
        if (val > 180) val = 180;
        adjustments.rotation = val;
        rotationSlider.value = val;
        drawAdjustedImage();
    });

    startCropBtn.addEventListener('click', () => {
        isCropping = true;
        document.body.classList.add('cropping-active'); // 커서 변경용 클래스
        cropInfo.style.display = 'block';
        applyCropBtn.disabled = true; // 영역 선택 전에는 적용 비활성화
        cancelCropBtn.disabled = false; // 취소는 바로 활성화

        // 크롭 영역 초기화 (전체 이미지를 선택한 상태로 시작)
        cropRect = {
            x: 0,
            y: 0,
            width: imageCanvas.width,
            height: imageCanvas.height
        };
        drawAdjustedImage(); // 크롭 UI를 캔버스에 그리기 위해 호출
    });

    applyCropBtn.addEventListener('click', () => {
        if (isCropping && cropRect.width > 0 && cropRect.height > 0) {
            // 원본 이미지를 기준으로 크롭
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');
            tempCanvas.width = cropRect.width;
            tempCanvas.height = cropRect.height;
            // 원본 이미지를 크롭 영역만큼 잘라서 그림
            tempCtx.drawImage(
                originalImage,
                cropRect.x, cropRect.y, cropRect.width, cropRect.height,
                0, 0, cropRect.width, cropRect.height
            );

            // 잘린 이미지를 originalImage로 다시 설정하여 모든 보정의 원본으로 만듦
            originalImage.onload = () => {
                // 크롭 적용 후 상태 초기화 및 UI 업데이트
                isCropping = false; // 크롭 모드 해제
                cropRect = { x: 0, y: 0, width: 0, height: 0 }; // 크롭 영역 초기화
                document.body.classList.remove('cropping-active');
                cropInfo.style.display = 'none';
                applyCropBtn.disabled = true;
                cancelCropBtn.disabled = true;
                initializeCanvas(); // 이 함수 안에서 drawAdjustedImage()가 호출되어 잔상 제거
            };
            originalImage.src = tempCanvas.toDataURL('image/png');
        }
    });

    cancelCropBtn.addEventListener('click', () => {
        isCropping = false; // 크롭 모드 해제
        cropRect = { x: 0, y: 0, width: 0, height: 0 }; // 크롭 영역 초기화
        document.body.classList.remove('cropping-active');
        cropInfo.style.display = 'none';
        applyCropBtn.disabled = true;
        cancelCropBtn.disabled = true;
        drawAdjustedImage(); // 크롭 UI 없이 캔버스 다시 그리기 (잔상 제거)
    });

    // --- 크롭 드래그 & 리사이즈 이벤트 ---
    imageCanvas.addEventListener('mousedown', (e) => {
        if (!isCropping || !isImageLoaded) return;

        const mousePos = getMousePosOnCanvas(e);
        const mouseX = mousePos.x;
        const mouseY = mousePos.y;

        // 1. 핸들 클릭 여부 확인
        resizeHandle = getHandleAtPoint(mouseX, mouseY);
        if (resizeHandle) {
            isResizing = true;
        }
        // 2. 크롭 영역 내부 클릭 (이동)
        else if (isPointInsideRect(mouseX, mouseY, cropRect)) {
            isDragging = true;
            dragOffsetX = mouseX - cropRect.x;
            dragOffsetY = mouseY - cropRect.y;
        }
        // 3. 크롭 영역 외부 클릭 (새로운 크롭 영역 시작)
        else {
            isDragging = true; // 새로운 드래그 시작으로 간주
            cropRect.x = mouseX;
            cropRect.y = mouseY;
            cropRect.width = 0;
            cropRect.height = 0;
            dragOffsetX = 0; // 초기 드래그 오프셋 없음
            dragOffsetY = 0;
        }
    });

    imageCanvas.addEventListener('mousemove', (e) => {
        if (!isCropping || !isImageLoaded) return;

        const mousePos = getMousePosOnCanvas(e);
        const mouseX = mousePos.x;
        const mouseY = mousePos.y;

        // 1. 커서 변경 (드래그 중이 아닐 때)
        if (!isDragging && !isResizing) {
            const handle = getHandleAtPoint(mouseX, mouseY);
            if (handle) {
                imageCanvas.style.cursor = getCursorForHandle(handle);
            } else if (isPointInsideRect(mouseX, mouseY, cropRect)) {
                imageCanvas.style.cursor = 'move';
            } else {
                imageCanvas.style.cursor = 'crosshair';
            }
            return; // 드래그/리사이즈 중이 아니면 여기까지만
        }

        // 2. 리사이즈 중
        if (isResizing) {
            updateCropRectOnResize(mouseX, mouseY);
        }
        // 3. 드래그 중
        else if (isDragging) {
            // 새로운 크롭 영역을 그리는 중 (mousedown에서 영역 외부 클릭 시)
            if (cropRect.width === 0 && cropRect.height === 0 && dragOffsetX === 0 && dragOffsetY === 0) {
                const newWidth = mouseX - cropRect.x;
                const newHeight = mouseY - cropRect.y;

                // 드래그 방향에 따라 x,y,width,height 조정 (음수 너비/높이 방지)
                if (newWidth < 0) {
                    cropRect.x = mouseX;
                    cropRect.width = Math.abs(newWidth);
                } else {
                    cropRect.width = newWidth;
                }
                if (newHeight < 0) {
                    cropRect.y = mouseY;
                    cropRect.height = Math.abs(newHeight);
                } else {
                    cropRect.height = newHeight;
                }
                // 캔버스 범위를 벗어나지 않도록 클램핑
                clampCropRectToCanvas();

            } else { // 기존 크롭 영역 이동 중
                cropRect.x = mouseX - dragOffsetX;
                cropRect.y = mouseY - dragOffsetY;
                // 캔버스 경계를 벗어나지 않도록 클램핑
                clampCropRectToCanvas();
            }
        }
        
        drawAdjustedImage();
        applyCropBtn.disabled = !(cropRect.width > 0 && cropRect.height > 0);
    });

    imageCanvas.addEventListener('mouseup', () => {
        if (!isCropping || !isImageLoaded) return;
        isDragging = false;
        isResizing = false;
        resizeHandle = '';
        imageCanvas.style.cursor = 'crosshair'; // 크롭 모드 유지 시 기본 커서 (일반 모드면 'default'로 바뀔 것임)

        applyCropBtn.disabled = !(cropRect.width > 0 && cropRect.height > 0);
    });

    // --- 유틸리티 함수 ---

    function initializeCanvas() {
        // 캔버스 크기를 이미지 원본 해상도에 맞춰 조정 (제한 없음)
        imageCanvas.width = originalImage.width;
        imageCanvas.height = originalImage.height;

        // 초기 크롭 영역은 캔버스 전체로 설정
        // 이 부분은 isCropping이 true일 때만 의미가 있습니다.
        cropRect = {
            x: 0,
            y: 0,
            width: imageCanvas.width,
            height: imageCanvas.height
        };
        drawAdjustedImage(); // 캔버스 내용 다시 그리기
    }

    function drawAdjustedImage() {
        if (!isImageLoaded) return;

        // 1. 캔버스를 완전히 지웁니다. 이것이 잔상을 없애는 핵심입니다.
        ctx.clearRect(0, 0, imageCanvas.width, imageCanvas.height);
        ctx.setLineDash([]); // 모든 이전 선 스타일을 초기화합니다.

        // 2. 임시 캔버스에 원본 이미지를 그리고, 변환(회전)을 적용합니다.
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');

        // 회전 후 이미지의 최대 크기를 예측하여 임시 캔버스 크기 설정
        // 이 부분을 정확히 계산하려면 좀 더 복잡한 기하학이 필요하지만,
        // 여기서는 간단하게 원본 이미지의 대각선 길이를 기준으로 설정합니다.
        const maxDim = Math.sqrt(originalImage.width * originalImage.width + originalImage.height * originalImage.height);
        tempCanvas.width = maxDim;
        tempCanvas.height = maxDim;

        tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height); // 임시 캔버스도 초기화
        tempCtx.save(); // 변환 저장

        // 회전 중심을 임시 캔버스의 중앙으로 이동
        tempCtx.translate(tempCanvas.width / 2, tempCanvas.height / 2);
        // 회전 각도 적용 (도 -> 라디안)
        tempCtx.rotate(adjustments.rotation * Math.PI / 180);
        // 이미지를 회전 중심에 맞춰 그리기
        tempCtx.drawImage(originalImage, -originalImage.width / 2, -originalImage.height / 2, originalImage.width, originalImage.height);

        tempCtx.restore(); // 변환 복원

        // 3. 임시 캔버스에서 픽셀 데이터를 가져와 색 보정을 적용합니다.
        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const pixels = imageData.data; // RGBA 픽셀 배열

        for (let i = 0; i < pixels.length; i += 4) {
            let r = pixels[i];
            let g = pixels[i + 1];
            let b = pixels[i + 2];

            // 밝기 조절 (실제 밝기 보정)
            r = r * adjustments.brightness;
            g = g * adjustments.brightness;
            b = b * adjustments.brightness;

            // 대비 조절 (중간값 128을 기준으로)
            r = ((r - 128) * adjustments.contrast) + 128;
            g = ((g - 128) * adjustments.contrast) + 128;
            b = ((b - 128) * adjustments.contrast) + 128;

            // 채도 조절 (Luminosity, Grayscale을 이용하여)
            const gray = 0.299 * r + 0.587 * g + 0.114 * b;
            r = gray + (r - gray) * adjustments.saturation;
            g = gray + (g - gray) * adjustments.saturation;
            b = gray + (b - gray) * adjustments.saturation;

            // 픽셀 값 범위 (0-255) 클램핑
            pixels[i] = Math.min(255, Math.max(0, r));
            pixels[i + 1] = Math.min(255, Math.max(0, g));
            pixels[i + 2] = Math.min(255, Math.max(0, b));
        }

        // 4. 메인 캔버스에 조정된 픽셀 데이터 적용
        ctx.putImageData(imageData,
            (imageCanvas.width - tempCanvas.width) / 2,
            (imageCanvas.height - tempCanvas.height) / 2
        );

        // 5. 크롭 모드일 경우에만 크롭 영역 및 핸들 그리기
        if (isCropping) { // <-- 이 조건문이 가장 중요합니다!
            ctx.save(); // 크롭 영역 스타일 저장을 위해 save
            ctx.strokeStyle = '#FFFFFF'; // 흰색 테두리
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]); // 점선

            // 크롭 영역 그리기
            ctx.strokeRect(cropRect.x, cropRect.y, cropRect.width, cropRect.height);

            // 외부를 어둡게 처리 (오버레이)
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.fillRect(0, 0, imageCanvas.width, cropRect.y); // 위
            ctx.fillRect(0, cropRect.y + cropRect.height, imageCanvas.width, imageCanvas.height - (cropRect.y + cropRect.height)); // 아래
            ctx.fillRect(0, cropRect.y, cropRect.x, cropRect.height); // 왼쪽
            ctx.fillRect(cropRect.x + cropRect.width, cropRect.y, imageCanvas.width - (cropRect.x + cropRect.width), cropRect.height); // 오른쪽

            // 핸들 그리기
            ctx.fillStyle = '#61afef'; // 핸들 색상
            ctx.strokeStyle = '#FFFFFF'; // 핸들 테두리
            ctx.lineWidth = 1;
            ctx.setLineDash([]); // 핸들은 실선이므로 점선 스타일을 다시 해제합니다.

            // 8개 핸들
            drawHandle(cropRect.x, cropRect.y);                                     // NW
            drawHandle(cropRect.x + cropRect.width, cropRect.y);                    // NE
            drawHandle(cropRect.x, cropRect.y + cropRect.height);                   // SW
            drawHandle(cropRect.x + cropRect.width, cropRect.y + cropRect.height);  // SE
            drawHandle(cropRect.x + cropRect.width / 2, cropRect.y);                // N
            drawHandle(cropRect.x + cropRect.width / 2, cropRect.y + cropRect.height); // S
            drawHandle(cropRect.x, cropRect.y + cropRect.height / 2);               // W
            drawHandle(cropRect.x + cropRect.width, cropRect.y + cropRect.height / 2); // E

            ctx.restore(); // 저장된 크롭 스타일 복원
        }
    }

    function drawHandle(x, y) {
        ctx.fillRect(x - HANDLE_SIZE / 2, y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
        ctx.strokeRect(x - HANDLE_SIZE / 2, y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
    }

    // 마우스 이벤트의 클라이언트 좌표를 캔버스 내부 좌표로 변환
    function getMousePosOnCanvas(evt) {
        const rect = imageCanvas.getBoundingClientRect();
        const scaleX = imageCanvas.width / rect.width;
        const scaleY = imageCanvas.height / rect.height;
        return {
            x: (evt.clientX - rect.left) * scaleX,
            y: (evt.clientY - rect.top) * scaleY
        };
    }

    // 점이 사각형 안에 있는지 확인 (크롭 영역 내부 확인)
    function isPointInsideRect(x, y, rect) {
        // 너비나 높이가 0일 경우 (새로운 크롭 시작 전)에도 제대로 동작하도록 예외 처리
        if (rect.width === 0 || rect.height === 0) return false;
        
        return x >= rect.x && x <= rect.x + rect.width &&
               y >= rect.y && y <= rect.y + rect.height;
    }

    // 특정 좌표에 핸들이 있는지 확인
    function getHandleAtPoint(x, y) {
        // 크롭 영역이 유효하지 않으면 핸들도 없음
        if (cropRect.width <= 0 || cropRect.height <= 0) return null;

        const handles = [
            { name: 'nw', x: cropRect.x, y: cropRect.y },
            { name: 'ne', x: cropRect.x + cropRect.width, y: cropRect.y },
            { name: 'sw', x: cropRect.x, y: cropRect.y + cropRect.height },
            { name: 'se', x: cropRect.x + cropRect.width, y: cropRect.y + cropRect.height },
            { name: 'n', x: cropRect.x + cropRect.width / 2, y: cropRect.y },
            { name: 's', x: cropRect.x + cropRect.width / 2, y: cropRect.y + cropRect.height },
            { name: 'w', x: cropRect.x, y: cropRect.y + cropRect.height / 2 },
            { name: 'e', x: cropRect.x + cropRect.width, y: cropRect.y + cropRect.height / 2 }
        ];

        for (const handle of handles) {
            // 핸들 클릭 영역을 HANDLE_SIZE로 확장
            if (x > handle.x - HANDLE_SIZE / 2 && x < handle.x + HANDLE_SIZE / 2 &&
                y > handle.y - HANDLE_SIZE / 2 && y < handle.y + HANDLE_SIZE / 2) {
                return handle.name;
            }
        }
        return null;
    }

    // 핸들 종류에 따른 커서 모양 반환
    function getCursorForHandle(handleName) {
        switch (handleName) {
            case 'nw': case 'se': return 'nwse-resize';
            case 'ne': case 'sw': return 'nesw-resize';
            case 'n': case 's': return 'ns-resize';
            case 'w': case 'e': return 'ew-resize';
            default: return 'crosshair';
        }
    }

    // 리사이즈 시 크롭 영역 업데이트
    function updateCropRectOnResize(mouseX, mouseY) {
        let newX = cropRect.x;
        let newY = cropRect.y;
        let newWidth = cropRect.width;
        let newHeight = cropRect.height;

        const minSize = HANDLE_SIZE * 2; // 최소 크롭 크기 제한 (핸들 두 개 정도의 크기)

        switch (resizeHandle) {
            case 'nw': // 북서
                newX = mouseX;
                newY = mouseY;
                newWidth = (cropRect.x + cropRect.width) - newX;
                newHeight = (cropRect.y + cropRect.height) - newY;
                break;
            case 'ne': // 북동
                newX = cropRect.x; // x는 고정
                newY = mouseY;
                newWidth = mouseX - newX;
                newHeight = (cropRect.y + cropRect.height) - newY;
                break;
            case 'sw': // 남서
                newX = mouseX;
                newY = cropRect.y; // y는 고정
                newWidth = (cropRect.x + cropRect.width) - newX;
                newHeight = mouseY - newY;
                break;
            case 'se': // 남동
                newX = cropRect.x; // x는 고정
                newY = cropRect.y; // y는 고정
                newWidth = mouseX - newX;
                newHeight = mouseY - newY;
                break;
            case 'n': // 북
                newX = cropRect.x;
                newY = mouseY;
                newWidth = cropRect.width;
                newHeight = (cropRect.y + cropRect.height) - newY;
                break;
            case 's': // 남
                newX = cropRect.x;
                newY = cropRect.y;
                newWidth = cropRect.width;
                newHeight = mouseY - newY;
                break;
            case 'w': // 서
                newX = mouseX;
                newY = cropRect.y;
                newWidth = (cropRect.x + cropRect.width) - newX;
                newHeight = cropRect.height;
                break;
            case 'e': // 동
                newX = cropRect.x;
                newY = cropRect.y;
                newWidth = mouseX - newX;
                newHeight = cropRect.height;
                break;
        }
        
        // 최소 크기 제한 적용
        if (newWidth < minSize) {
             if (['nw', 'sw', 'w'].includes(resizeHandle)) { // 왼쪽으로 줄이는 경우
                newX = cropRect.x + cropRect.width - minSize;
            }
            newWidth = minSize;
        }
        if (newHeight < minSize) {
            if (['nw', 'ne', 'n'].includes(resizeHandle)) { // 위로 줄이는 경우
                newY = cropRect.y + cropRect.height - minSize;
            }
            newHeight = minSize;
        }

        // 최종 크롭 영역 업데이트
        cropRect.x = newX;
        cropRect.y = newY;
        cropRect.width = newWidth;
        cropRect.height = newHeight;

        // 캔버스 경계를 벗어나지 않도록 클램핑
        clampCropRectToCanvas();
    }

    // 크롭 영역이 캔버스 경계를 벗어나지 않도록 클램핑
    function clampCropRectToCanvas() {
        // x 좌표와 너비
        if (cropRect.x < 0) cropRect.x = 0;
        if (cropRect.x + cropRect.width > imageCanvas.width) {
            cropRect.width = imageCanvas.width - cropRect.x;
        }
        // y 좌표와 높이
        if (cropRect.y < 0) cropRect.y = 0;
        if (cropRect.y + cropRect.height > imageCanvas.height) {
            cropRect.height = imageCanvas.height - cropRect.y;
        }

        // 너비와 높이가 음수가 되지 않도록 재확인 (마우스가 빠르게 움직일 때 발생할 수 있음)
        if (cropRect.width < 0) cropRect.width = 0;
        if (cropRect.height < 0) cropRect.height = 0;
    }


    function resetAdjustments() {
        adjustments = {
            brightness: 1,
            contrast: 1,
            saturation: 1,
            rotation: 0
        };
        brightnessSlider.value = 1;
        brightnessValue.value = 1;
        contrastSlider.value = 1;
        contrastValue.value = 1;
        saturationSlider.value = 1;
        saturationValue.value = 1;
        rotationSlider.value = 0;
        rotationValue.value = 0;

        // 크롭 관련 초기화
        isCropping = false;
        // 크롭 Rect는 이미지 로드 시 initializeCanvas에서 초기화되거나
        // 크롭 적용/취소 시 리셋되므로 여기서는 불필요.
        // 다만 혹시 모를 경우를 대비하여 명시적으로 0으로 설정 가능.
        cropRect = { x: 0, y: 0, width: 0, height: 0 }; 

        isDragging = false;
        isResizing = false;
        resizeHandle = '';
        document.body.classList.remove('cropping-active');
        cropInfo.style.display = 'none';
        applyCropBtn.disabled = true;
        cancelCropBtn.disabled = true;
        imageCanvas.style.cursor = 'default'; // 기본 커서로 되돌리기
    }

    function enableControls() {
        saveImageBtn.disabled = false;
        brightnessSlider.disabled = false;
        contrastSlider.disabled = false;
        saturationSlider.disabled = false;
        rotationSlider.disabled = false;
        startCropBtn.disabled = false;
    }

    function disableControls() {
        saveImageBtn.disabled = true;
        brightnessSlider.disabled = true;
        contrastSlider.disabled = true;
        saturationSlider.disabled = true;
        rotationSlider.disabled = true;
        startCropBtn.disabled = true;
        applyCropBtn.disabled = true;
        cancelCropBtn.disabled = true;
        cropInfo.style.display = 'none';
        document.body.classList.remove('cropping-active');
        imageCanvas.style.cursor = 'default';
    }

    // 초기 로딩 시 컨트롤 비활성화
    disableControls();
});