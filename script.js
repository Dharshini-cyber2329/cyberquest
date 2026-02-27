let currentScreen = 0;
const screens = ['intro-screen', 'scan-screen', 'ready-screen', 'auth-screen'];

// Start intro sequence
window.addEventListener('load', () => {
    console.log('Page loaded, starting intro');
    
    // Play startup sound (with error handling)
    setTimeout(() => {
        try {
            if (typeof cyberSounds !== 'undefined') {
                cyberSounds.startupSound();
            }
        } catch (e) {
            console.error('Sound error:', e);
        }
    }, 500);
    
    startIntro();
});

function startIntro() {
    console.log('startIntro called');
    
    let progress = 0;
    const loadingFill = document.getElementById('loadingFill');
    const loadingPercent = document.getElementById('loadingPercent');
    
    if (!loadingFill || !loadingPercent) {
        console.error('Loading elements not found!');
        return;
    }
    
    const interval = setInterval(() => {
        progress += 1;
        loadingFill.style.width = progress + '%';
        loadingPercent.textContent = progress + '%';
        
        // Beep sound every 10% (with error handling)
        if (progress % 10 === 0) {
            try {
                if (typeof cyberSounds !== 'undefined') {
                    cyberSounds.beep(400 + progress * 5, 0.05);
                }
            } catch (e) {
                console.error('Sound error:', e);
            }
        }
        
        if (progress >= 100) {
            clearInterval(interval);
            try {
                if (typeof cyberSounds !== 'undefined') {
                    cyberSounds.successSound();
                }
            } catch (e) {
                console.error('Sound error:', e);
            }
            setTimeout(() => {
                nextScreen();
            }, 500);
        }
    }, 50);
}

function nextScreen() {
    document.getElementById(screens[currentScreen]).classList.remove('active');
    currentScreen++;
    
    if (currentScreen < screens.length) {
        document.getElementById(screens[currentScreen]).classList.add('active');
        
        // Play transition sound
        cyberSounds.clickSound();
        
        if (currentScreen === 2) {
            // Ready screen - wait for click
            document.getElementById('ready-screen').addEventListener('click', () => {
                cyberSounds.clickSound();
                nextScreen();
            });
        } else if (currentScreen === 1) {
            // Scan screen - play scanning sound
            cyberSounds.scanningSound();
            
            // Animate progress and auto advance
            let progress = 0;
            const progressInterval = setInterval(() => {
                progress += 2;
                const progressEl = document.getElementById('scanProgress');
                if (progressEl) {
                    progressEl.textContent = progress + '%';
                }
                
                // Beep every 20%
                if (progress % 20 === 0) {
                    cyberSounds.beep(500, 0.05);
                }
                
                if (progress >= 100) {
                    clearInterval(progressInterval);
                    cyberSounds.successSound();
                }
            }, 60);
            
            setTimeout(() => {
                nextScreen();
            }, 3000);
        } else if (currentScreen === 3) {
            // Auth screen - start camera and fade out background music
            cyberSounds.fadeOutBackground();
            startCamera();
        }
    }
}

// Camera functionality
let video, canvas, ctx, faceCanvas, faceCtx;
let stream = null;
let faceDetectionInterval = null;
let detectedFaces = [];

function startCamera() {
    video = document.getElementById('video');
    canvas = document.getElementById('canvas');
    ctx = canvas.getContext('2d');
    faceCanvas = document.getElementById('faceCanvas');
    faceCtx = faceCanvas.getContext('2d');
    
    console.log('Starting camera...');
    console.log('Video element:', video);
    console.log('Face canvas element:', faceCanvas);
    console.log('Face canvas context:', faceCtx);
    
    // Request camera resolution
    const constraints = {
        video: {
            width: { ideal: 800 },
            height: { ideal: 600 },
            facingMode: 'user',
            frameRate: { ideal: 30 }
        }
    };
    
    navigator.mediaDevices.getUserMedia(constraints)
        .then((mediaStream) => {
            stream = mediaStream;
            video.srcObject = mediaStream;
            updateAuthStatus('Camera active - Ready to capture');
            
            // Start face detection
            video.addEventListener('loadedmetadata', () => {
                // IMPORTANT: Set canvas sizes to match video DISPLAY dimensions, not native dimensions
                const displayWidth = video.clientWidth;
                const displayHeight = video.clientHeight;
                
                canvas.width = displayWidth;
                canvas.height = displayHeight;
                faceCanvas.width = displayWidth;
                faceCanvas.height = displayHeight;
                
                console.log('Video native size:', video.videoWidth, 'x', video.videoHeight);
                console.log('Video display size:', displayWidth, 'x', displayHeight);
                console.log('Canvas size:', faceCanvas.width, 'x', faceCanvas.height);
                
                startRealFaceDetection();
            });
        })
        .catch((err) => {
            console.error('Camera error:', err);
            updateAuthStatus('❌ Camera access denied');
        });
}

let faceMesh = null;
let lastFaceData = null;

async function startRealFaceDetection() {
    console.log('Loading MediaPipe Face Mesh...');
    
    try {
        // Initialize MediaPipe Face Mesh - highest accuracy
        faceMesh = new FaceMesh({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
            }
        });
        
        faceMesh.setOptions({
            maxNumFaces: 1,
            refineLandmarks: true,
            minDetectionConfidence: 0.7,  // Increased for better accuracy
            minTrackingConfidence: 0.7    // Increased for better accuracy
        });
        
        faceMesh.onResults(onFaceMeshResults);
        
        console.log('✓ MediaPipe Face Mesh loaded - 468 landmarks');
        console.log('TIP: Position your face directly in front of camera for best accuracy');
        
        // Start detection loop
        detectFaceMesh();
        
    } catch (error) {
        console.error('Failed to load MediaPipe Face Mesh:', error);
        alert('Face detection model failed to load. Please refresh the page.');
    }
}

async function detectFaceMesh() {
    if (!video || video.readyState !== 4 || !faceMesh) {
        requestAnimationFrame(detectFaceMesh);
        return;
    }
    
    try {
        await faceMesh.send({image: video});
    } catch (error) {
        console.error('Detection error:', error);
    }
    
    requestAnimationFrame(detectFaceMesh);
}

function onFaceMeshResults(results) {
    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        lastFaceData = {
            landmarks: results.multiFaceLandmarks[0]
        };
    }
    
    // Draw mesh
    drawMediaPipeMesh(lastFaceData);
}

function drawMediaPipeMesh(faceData) {
    // Clear canvas
    faceCtx.clearRect(0, 0, faceCanvas.width, faceCanvas.height);
    
    if (!faceData || !faceData.landmarks) {
        return;
    }
    
    const landmarks = faceData.landmarks;
    
    // Use canvas dimensions directly (already matched to video display size)
    const width = faceCanvas.width;
    const height = faceCanvas.height;
    
    console.log('Drawing mesh - Canvas:', width, 'x', height, 'Landmarks:', landmarks.length);
    
    // Calculate bounding box from landmarks
    let minX = 1, minY = 1, maxX = 0, maxY = 0;
    landmarks.forEach(point => {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
    });
    
    const x = minX * width;
    const y = minY * height;
    const w = (maxX - minX) * width;
    const h = (maxY - minY) * height;
    
    // Draw corner brackets
    const cornerSize = 40;
    faceCtx.strokeStyle = '#00ff88';
    faceCtx.lineWidth = 4;
    
    // Top-left
    faceCtx.beginPath();
    faceCtx.moveTo(x, y + cornerSize);
    faceCtx.lineTo(x, y);
    faceCtx.lineTo(x + cornerSize, y);
    faceCtx.stroke();
    
    // Top-right
    faceCtx.beginPath();
    faceCtx.moveTo(x + w - cornerSize, y);
    faceCtx.lineTo(x + w, y);
    faceCtx.lineTo(x + w, y + cornerSize);
    faceCtx.stroke();
    
    // Bottom-left
    faceCtx.beginPath();
    faceCtx.moveTo(x, y + h - cornerSize);
    faceCtx.lineTo(x, y + h);
    faceCtx.lineTo(x + cornerSize, y + h);
    faceCtx.stroke();
    
    // Bottom-right
    faceCtx.beginPath();
    faceCtx.moveTo(x + w - cornerSize, y + h);
    faceCtx.lineTo(x + w, y + h);
    faceCtx.lineTo(x + w, y + h - cornerSize);
    faceCtx.stroke();
    
    // Draw complete face mesh using MediaPipe's FACEMESH_TESSELATION
    faceCtx.strokeStyle = 'rgba(0, 255, 136, 0.4)';
    faceCtx.lineWidth = 1;
    
    // Complete MediaPipe Face Mesh tesselation (all 468 landmarks)
    const FACEMESH_FACE_OVAL = [
        [10, 338], [338, 297], [297, 332], [332, 284], [284, 251], [251, 389],
        [389, 356], [356, 454], [454, 323], [323, 361], [361, 288], [288, 397],
        [397, 365], [365, 379], [379, 378], [378, 400], [400, 377], [377, 152],
        [152, 148], [148, 176], [176, 149], [149, 150], [150, 136], [136, 172],
        [172, 58], [58, 132], [132, 93], [93, 234], [234, 127], [127, 162],
        [162, 21], [21, 54], [54, 103], [103, 67], [67, 109], [109, 10]
    ];
    
    const FACEMESH_LIPS = [
        [61, 146], [146, 91], [91, 181], [181, 84], [84, 17], [17, 314],
        [314, 405], [405, 321], [321, 375], [375, 291], [61, 185], [185, 40],
        [40, 39], [39, 37], [37, 0], [0, 267], [267, 269], [269, 270],
        [270, 409], [409, 291], [78, 95], [95, 88], [88, 178], [178, 87],
        [87, 14], [14, 317], [317, 402], [402, 318], [318, 324], [324, 308],
        [78, 191], [191, 80], [80, 81], [81, 82], [82, 13], [13, 312],
        [312, 311], [311, 310], [310, 415], [415, 308]
    ];
    
    const FACEMESH_LEFT_EYE = [
        [263, 249], [249, 390], [390, 373], [373, 374], [374, 380], [380, 381],
        [381, 382], [382, 362], [263, 466], [466, 388], [388, 387], [387, 386],
        [386, 385], [385, 384], [384, 398], [398, 362]
    ];
    
    const FACEMESH_RIGHT_EYE = [
        [33, 7], [7, 163], [163, 144], [144, 145], [145, 153], [153, 154],
        [154, 155], [155, 133], [33, 246], [246, 161], [161, 160], [160, 159],
        [159, 158], [158, 157], [157, 173], [173, 133]
    ];
    
    const FACEMESH_LEFT_EYEBROW = [
        [276, 283], [283, 282], [282, 295], [295, 285], [300, 293], [293, 334],
        [334, 296], [296, 336]
    ];
    
    const FACEMESH_RIGHT_EYEBROW = [
        [46, 53], [53, 52], [52, 65], [65, 55], [70, 63], [63, 105],
        [105, 66], [66, 107]
    ];
    
    const FACEMESH_NOSE = [
        [168, 6], [6, 197], [197, 195], [195, 5], [5, 4], [4, 1], [1, 19],
        [19, 94], [94, 2], [2, 164], [164, 0], [0, 11], [11, 12], [12, 13],
        [13, 14], [14, 15], [15, 16], [16, 17], [17, 18], [18, 200],
        [200, 199], [199, 175], [175, 152]
    ];
    
    // Additional connections for full coverage
    const ADDITIONAL_CONNECTIONS = [
        // Forehead to eyes
        [10, 109], [67, 109], [103, 67], [54, 103], [21, 54],
        [162, 21], [127, 162], [234, 127], [93, 234], [132, 93],
        [58, 132], [172, 58], [136, 172], [150, 136], [149, 150],
        [176, 149], [148, 176], [152, 148], [377, 152], [400, 377],
        [378, 400], [379, 378], [365, 379], [397, 365], [288, 397],
        [361, 288], [323, 361], [454, 323], [356, 454], [389, 356],
        [251, 389], [284, 251], [332, 284], [297, 332], [338, 297],
        
        // Connect eyes to nose
        [133, 155], [33, 133], [7, 33], [163, 7], [144, 163],
        [362, 382], [263, 362], [249, 263], [390, 249], [373, 390],
        
        // Connect nose to mouth
        [1, 0], [0, 267], [267, 269], [269, 270], [270, 409],
        [1, 37], [37, 39], [39, 40], [40, 185],
        
        // Jaw connections
        [172, 136], [136, 150], [150, 149], [149, 176], [176, 148],
        [148, 152], [152, 377], [377, 400], [400, 378], [378, 379],
        [379, 365], [365, 397], [397, 288], [288, 361], [361, 323],
        [323, 454], [454, 356], [356, 389], [389, 251], [251, 284],
        [284, 332], [332, 297], [297, 338], [338, 10],
        
        // Cross connections for mesh density
        [10, 67], [67, 103], [103, 54], [54, 21], [21, 162],
        [162, 127], [127, 234], [234, 93], [93, 132], [132, 58],
        [338, 284], [284, 251], [251, 389], [389, 356], [356, 454],
        [454, 323], [323, 361], [361, 288], [288, 397], [397, 365]
    ];
    
    // Combine all connections
    const allConnections = [
        ...FACEMESH_FACE_OVAL,
        ...FACEMESH_LIPS,
        ...FACEMESH_LEFT_EYE,
        ...FACEMESH_RIGHT_EYE,
        ...FACEMESH_LEFT_EYEBROW,
        ...FACEMESH_RIGHT_EYEBROW,
        ...FACEMESH_NOSE,
        ...ADDITIONAL_CONNECTIONS
    ];
    
    // Draw all connections
    allConnections.forEach(([start, end]) => {
        if (landmarks[start] && landmarks[end]) {
            faceCtx.beginPath();
            faceCtx.moveTo(landmarks[start].x * width, landmarks[start].y * height);
            faceCtx.lineTo(landmarks[end].x * width, landmarks[end].y * height);
            faceCtx.stroke();
        }
    });
    
    // Draw key landmark points
    faceCtx.fillStyle = '#00ff88';
    faceCtx.shadowBlur = 8;
    faceCtx.shadowColor = '#00ff88';
    
    // Key points: eyes, nose, mouth, face oval
    const keyPoints = [
        10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365,
        379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93,
        234, 127, 162, 21, 54, 103, 67, 109, // Face oval
        33, 133, 263, 362, // Eyes
        1, 4, 5, // Nose
        61, 291, 78, 308 // Mouth
    ];
    
    keyPoints.forEach(idx => {
        if (landmarks[idx]) {
            faceCtx.beginPath();
            faceCtx.arc(landmarks[idx].x * width, landmarks[idx].y * height, 2, 0, Math.PI * 2);
            faceCtx.fill();
        }
    });
    
    faceCtx.shadowBlur = 0;
    
    // Animated scanning line
    const scanY = (Date.now() % 2000) / 2000 * h + y;
    faceCtx.strokeStyle = '#00ff88';
    faceCtx.lineWidth = 2;
    faceCtx.shadowBlur = 10;
    faceCtx.shadowColor = '#00ff88';
    faceCtx.beginPath();
    faceCtx.moveTo(x, scanY);
    faceCtx.lineTo(x + w, scanY);
    faceCtx.stroke();
    faceCtx.shadowBlur = 0;
    
    // Status text
    faceCtx.fillStyle = '#00ff88';
    faceCtx.font = '16px "Courier New"';
    faceCtx.fillText('468 LANDMARKS TRACKED', x + 5, y - 10);
}

async function loadFaceDetectionModels() {
    try {
        console.log('Loading FaceNet models...');
        
        // Load face-api.js models from CDN - using FaceNet for high accuracy
        const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model';
        
        await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
        console.log('✓ Face detection loaded');
        
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        console.log('✓ 68 Facial landmarks loaded');
        
        await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
        console.log('✓ FaceNet recognition loaded');
        
        console.log('✓ All models ready for 3D face mapping');
        
        // Start detection loop
        detectFaces();
    } catch (error) {
        console.error('Error loading face detection:', error);
        console.log('Falling back to simple overlay');
        // Fallback to simple overlay
        startSimpleFaceOverlay();
    }
}

async function detectFaces() {
    if (!video || video.readyState !== 4) {
        requestAnimationFrame(detectFaces);
        return;
    }
    
    try {
        // Detect faces with landmarks and descriptors (FaceNet)
        const detections = await faceapi
            .detectAllFaces(video)
            .withFaceLandmarks()
            .withFaceDescriptors();
        
        detectedFaces = detections;
        drawFaceDetections();
    } catch (error) {
        console.error('Detection error:', error);
    }
    
    requestAnimationFrame(detectFaces);
}

function drawFaceDetections() {
    // Clear canvas
    faceCtx.clearRect(0, 0, faceCanvas.width, faceCanvas.height);
    
    if (detectedFaces.length === 0) {
        // No face detected - show center guide box
        drawCenterGuideBox();
        return;
    }
    
    // Draw detection for each face
    detectedFaces.forEach(detection => {
        const box = detection.detection.box;
        const landmarks = detection.landmarks;
        
        // Scale to canvas size
        const scaleX = faceCanvas.width / video.videoWidth;
        const scaleY = faceCanvas.height / video.videoHeight;
        
        const x = box.x * scaleX;
        const y = box.y * scaleY;
        const width = box.width * scaleX;
        const height = box.height * scaleY;
        
        // Draw main bounding box
        faceCtx.strokeStyle = 'rgba(0, 255, 136, 0.8)';
        faceCtx.lineWidth = 3;
        faceCtx.strokeRect(x, y, width, height);
        
        // Draw 68 facial landmarks for 3D mapping
        drawFacialLandmarks(landmarks, scaleX, scaleY);
        
        // Draw corner brackets
        const cornerSize = 30;
        faceCtx.strokeStyle = '#00ff88';
        faceCtx.lineWidth = 4;
        
        // Top-left
        faceCtx.beginPath();
        faceCtx.moveTo(x, y + cornerSize);
        faceCtx.lineTo(x, y);
        faceCtx.lineTo(x + cornerSize, y);
        faceCtx.stroke();
        
        // Top-right
        faceCtx.beginPath();
        faceCtx.moveTo(x + width - cornerSize, y);
        faceCtx.lineTo(x + width, y);
        faceCtx.lineTo(x + width, y + cornerSize);
        faceCtx.stroke();
        
        // Bottom-left
        faceCtx.beginPath();
        faceCtx.moveTo(x, y + height - cornerSize);
        faceCtx.lineTo(x, y + height);
        faceCtx.lineTo(x + cornerSize, y + height);
        faceCtx.stroke();
        
        // Bottom-right
        faceCtx.beginPath();
        faceCtx.moveTo(x + width - cornerSize, y + height);
        faceCtx.lineTo(x + width, y + height);
        faceCtx.lineTo(x + width, y + height - cornerSize);
        faceCtx.stroke();
        
        // Animated scanning line
        const scanY = (Date.now() % 2000) / 2000 * height + y;
        faceCtx.strokeStyle = 'rgba(0, 255, 136, 0.9)';
        faceCtx.lineWidth = 2;
        faceCtx.shadowBlur = 15;
        faceCtx.shadowColor = '#00ff88';
        faceCtx.beginPath();
        faceCtx.moveTo(x, scanY);
        faceCtx.lineTo(x + width, scanY);
        faceCtx.stroke();
        faceCtx.shadowBlur = 0;
        
        // Corner dots (pulsing)
        const pulse = Math.sin(Date.now() / 200) * 0.5 + 0.5;
        faceCtx.fillStyle = `rgba(0, 255, 136, ${0.6 + pulse * 0.4})`;
        
        const corners = [
            {x: x, y: y},
            {x: x + width, y: y},
            {x: x, y: y + height},
            {x: x + width, y: y + height}
        ];
        
        corners.forEach(corner => {
            faceCtx.beginPath();
            faceCtx.arc(corner.x, corner.y, 5, 0, Math.PI * 2);
            faceCtx.fill();
        });
        
        // Detection confidence
        const confidence = Math.round(detection.detection.score * 100);
        faceCtx.fillStyle = '#00ff88';
        faceCtx.font = '16px "Courier New"';
        faceCtx.fillText(`FACENET: ${confidence}%`, x + 5, y - 5);
        faceCtx.fillText(`68 LANDMARKS`, x + 5, y - 25);
    });
}

function drawFacialLandmarks(landmarks, scaleX, scaleY) {
    // Get landmark positions
    const positions = landmarks.positions;
    
    // Draw 3D mesh grid overlay
    faceCtx.strokeStyle = 'rgba(0, 255, 136, 0.4)';
    faceCtx.lineWidth = 1;
    faceCtx.fillStyle = 'rgba(0, 255, 136, 0.8)';
    
    // Create dense mesh grid by interpolating between landmarks
    drawDenseFaceMesh(positions, scaleX, scaleY);
    
    // Draw main facial feature contours
    faceCtx.strokeStyle = 'rgba(0, 255, 136, 0.7)';
    faceCtx.lineWidth = 2;
    
    // Jaw line (0-16)
    drawLandmarkLine(positions, 0, 16, scaleX, scaleY);
    
    // Left eyebrow (17-21)
    drawLandmarkLine(positions, 17, 21, scaleX, scaleY);
    
    // Right eyebrow (22-26)
    drawLandmarkLine(positions, 22, 26, scaleX, scaleY);
    
    // Nose bridge (27-30)
    drawLandmarkLine(positions, 27, 30, scaleX, scaleY);
    
    // Nose bottom (31-35)
    drawLandmarkLine(positions, 31, 35, scaleX, scaleY);
    
    // Left eye (36-41)
    drawLandmarkLoop(positions, 36, 41, scaleX, scaleY);
    
    // Right eye (42-47)
    drawLandmarkLoop(positions, 42, 47, scaleX, scaleY);
    
    // Outer lips (48-59)
    drawLandmarkLoop(positions, 48, 59, scaleX, scaleY);
    
    // Inner lips (60-67)
    faceCtx.strokeStyle = 'rgba(0, 255, 136, 0.5)';
    drawLandmarkLoop(positions, 60, 67, scaleX, scaleY);
    
    // Draw glowing landmark points
    faceCtx.shadowBlur = 10;
    faceCtx.shadowColor = '#00ff88';
    faceCtx.fillStyle = '#00ff88';
    
    positions.forEach((point, index) => {
        const px = point.x * scaleX;
        const py = point.y * scaleY;
        
        // Highlight key points
        const keyPoints = [0, 8, 16, 27, 30, 33, 36, 39, 42, 45, 48, 54];
        if (keyPoints.includes(index)) {
            faceCtx.beginPath();
            faceCtx.arc(px, py, 4, 0, Math.PI * 2);
            faceCtx.fill();
        } else {
            faceCtx.beginPath();
            faceCtx.arc(px, py, 2, 0, Math.PI * 2);
            faceCtx.fill();
        }
    });
    
    faceCtx.shadowBlur = 0;
}

function drawDenseFaceMesh(positions, scaleX, scaleY) {
    // Create a dense 3D-style mesh grid overlay
    faceCtx.strokeStyle = 'rgba(0, 255, 136, 0.25)';
    faceCtx.lineWidth = 0.5;
    
    // Define face regions for mesh
    const faceRegions = [
        // Forehead horizontal lines
        [[17, 18, 19, 20, 21], [22, 23, 24, 25, 26]],
        // Upper face
        [[36, 37, 38, 39], [42, 43, 44, 45]],
        // Mid face
        [[31, 32, 33, 34, 35], [48, 49, 50, 51, 52, 53, 54]],
        // Lower face
        [[5, 6, 7, 8, 9, 10, 11], [48, 59, 58, 57, 56, 55, 54]]
    ];
    
    // Draw horizontal mesh lines across face
    const jawPoints = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
    for (let i = 0; i < jawPoints.length - 1; i++) {
        const p1 = positions[jawPoints[i]];
        const p2 = positions[jawPoints[i + 1]];
        
        // Draw connecting line
        faceCtx.beginPath();
        faceCtx.moveTo(p1.x * scaleX, p1.y * scaleY);
        faceCtx.lineTo(p2.x * scaleX, p2.y * scaleY);
        faceCtx.stroke();
        
        // Draw vertical lines from jaw to create grid
        if (i % 2 === 0) {
            const topPoint = positions[27]; // Nose bridge
            faceCtx.beginPath();
            faceCtx.moveTo(p1.x * scaleX, p1.y * scaleY);
            faceCtx.lineTo(topPoint.x * scaleX, topPoint.y * scaleY);
            faceCtx.stroke();
        }
    }
    
    // Draw radial lines from nose center
    const noseCenter = positions[30];
    const radialPoints = [0, 2, 4, 6, 8, 10, 12, 14, 16, 17, 21, 22, 26, 36, 39, 42, 45, 48, 54];
    
    faceCtx.strokeStyle = 'rgba(0, 255, 136, 0.15)';
    radialPoints.forEach(idx => {
        const point = positions[idx];
        faceCtx.beginPath();
        faceCtx.moveTo(noseCenter.x * scaleX, noseCenter.y * scaleY);
        faceCtx.lineTo(point.x * scaleX, point.y * scaleY);
        faceCtx.stroke();
    });
    
    // Draw concentric curves around face
    const centerX = noseCenter.x * scaleX;
    const centerY = noseCenter.y * scaleY;
    
    faceCtx.strokeStyle = 'rgba(0, 255, 136, 0.2)';
    for (let radius = 50; radius < 250; radius += 40) {
        faceCtx.beginPath();
        
        // Draw partial circles following face contour
        const startAngle = -Math.PI * 0.6;
        const endAngle = Math.PI * 0.6;
        
        for (let angle = startAngle; angle <= endAngle; angle += 0.1) {
            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius * 1.2; // Elongate vertically
            
            if (angle === startAngle) {
                faceCtx.moveTo(x, y);
            } else {
                faceCtx.lineTo(x, y);
            }
        }
        faceCtx.stroke();
    }
    
    // Draw cross-sections
    faceCtx.strokeStyle = 'rgba(0, 255, 136, 0.3)';
    
    // Horizontal cross-sections
    const horizontalLevels = [
        [17, 26], // Eyebrow level
        [36, 45], // Eye level
        [31, 35], // Nose level
        [48, 54], // Mouth level
        [7, 9]    // Chin level
    ];
    
    horizontalLevels.forEach(([left, right]) => {
        const p1 = positions[left];
        const p2 = positions[right];
        faceCtx.beginPath();
        faceCtx.moveTo(p1.x * scaleX, p1.y * scaleY);
        faceCtx.lineTo(p2.x * scaleX, p2.y * scaleY);
        faceCtx.stroke();
    });
    
    // Vertical center line
    faceCtx.strokeStyle = 'rgba(0, 255, 136, 0.4)';
    faceCtx.lineWidth = 1;
    faceCtx.beginPath();
    faceCtx.moveTo(positions[27].x * scaleX, positions[27].y * scaleY);
    faceCtx.lineTo(positions[30].x * scaleX, positions[30].y * scaleY);
    faceCtx.lineTo(positions[33].x * scaleX, positions[33].y * scaleY);
    faceCtx.lineTo(positions[51].x * scaleX, positions[51].y * scaleY);
    faceCtx.lineTo(positions[8].x * scaleX, positions[8].y * scaleY);
    faceCtx.stroke();
}

function drawLandmarkLine(positions, start, end, scaleX, scaleY) {
    faceCtx.beginPath();
    for (let i = start; i <= end; i++) {
        const point = positions[i];
        const px = point.x * scaleX;
        const py = point.y * scaleY;
        
        if (i === start) {
            faceCtx.moveTo(px, py);
        } else {
            faceCtx.lineTo(px, py);
        }
    }
    faceCtx.stroke();
}

function drawLandmarkLoop(positions, start, end, scaleX, scaleY) {
    faceCtx.beginPath();
    for (let i = start; i <= end; i++) {
        const point = positions[i];
        const px = point.x * scaleX;
        const py = point.y * scaleY;
        
        if (i === start) {
            faceCtx.moveTo(px, py);
        } else {
            faceCtx.lineTo(px, py);
        }
    }
    // Close the loop
    const firstPoint = positions[start];
    faceCtx.lineTo(firstPoint.x * scaleX, firstPoint.y * scaleY);
    faceCtx.stroke();
}

function drawCenterGuideBox() {
    // No guide box needed - mesh overlay is always visible
}

function startSimpleFaceOverlay() {
    // Use simple mesh overlay
    console.log('Using simple mesh overlay fallback');
    startSimpleMeshOverlay();
}

function showCaptureModal() {
    if (!video || !canvas) return;
    
    cyberSounds.clickSound();
    
    // Check if face is detected
    if (!lastFaceData || !lastFaceData.landmarks) {
        alert('No face detected! Please position your face in the camera view.');
        return;
    }
    
    // Capture the current frame with facial landmarks
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = video.videoWidth;
    tempCanvas.height = video.videoHeight;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(video, 0, 0);
    
    // Store the image data and current face landmarks
    window.capturedImageData = tempCanvas.toDataURL('image/jpeg');
    window.capturedLandmarks = JSON.parse(JSON.stringify(lastFaceData)); // Deep copy
    
    console.log('Captured landmarks:', window.capturedLandmarks);
    
    // Go DIRECTLY to 3D analysis screen (not success screen)
    showAnalysisScreen();
}

function closeCaptureModal() {
    document.getElementById('capture-modal').classList.remove('active');
    document.getElementById('userName').value = '';
}

function captureImage() {
    const userName = document.getElementById('userName').value.trim();
    
    console.log('=== captureImage called ===');
    console.log('userName:', userName);
    
    if (!userName) {
        cyberSounds.errorSound();
        alert('Please enter your name');
        return;
    }
    
    // IMMEDIATE TEST - Show success screen right away
    console.log('TEST: Showing success screen immediately...');
    closeCaptureModal();
    
    const analysisScreen = document.getElementById('analysis-screen');
    const successScreen = document.getElementById('success-screen');
    const welcomeName = document.getElementById('welcomeName');
    const timestamp = document.getElementById('timestamp');
    
    console.log('Elements:', {
        analysisScreen: analysisScreen,
        successScreen: successScreen,
        welcomeName: welcomeName,
        timestamp: timestamp
    });
    
    if (!successScreen) {
        console.error('ERROR: success-screen element not found!');
        return;
    }
    
    // Hide analysis screen
    analysisScreen.classList.remove('active');
    analysisScreen.style.display = 'none';
    
    // Show success screen
    successScreen.classList.add('active');
    successScreen.style.display = 'flex';
    successScreen.style.zIndex = '9999';
    
    // Set the name
    welcomeName.textContent = `HELLO, ${userName.toUpperCase()}!`;
    
    // Set timestamp
    const now = new Date();
    const timestampText = `AUTHENTICATED AT: ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;
    timestamp.textContent = timestampText;
    
    console.log('✓ Success screen should be visible now!');
    console.log('Success screen classes:', successScreen.classList);
    console.log('Success screen display:', successScreen.style.display);
    
    // Now do the actual registration in background
    const imageData = window.capturedImageData;
    
    if (!imageData) {
        console.error('ERROR: No captured image data!');
        return;
    }
    
    console.log('Sending registration request in background...');
    
    // Send to backend to save
    fetch('/capture', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
            image: imageData,
            name: userName
        })
    })
    .then(response => {
        console.log('Registration response status:', response.status);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        console.log('=== Registration response ===', data);
        if (data.success) {
            console.log('✓ Registration saved to server!');
        } else {
            console.error('✗ Registration FAILED:', data.message);
        }
    })
    .catch(error => {
        console.error('✗ Registration ERROR:', error);
    });
}

function authenticateFromCaptured() {
    console.log('=== authenticateFromCaptured called ===');
    console.log('Captured image data exists:', !!window.capturedImageData);
    
    if (!window.capturedImageData) {
        console.error('ERROR: No captured image data available!');
        alert('Error: No image data. Please capture again.');
        return;
    }
    
    document.getElementById('analysisStatus').textContent = 'AUTHENTICATING...';
    
    // Authenticate using the captured image
    fetch('/authenticate', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image: window.capturedImageData })
    })
    .then(response => {
        console.log('Authentication response status:', response.status);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        console.log('=== Authentication response ===', data);
        
        if (data.success) {
            console.log('✓ Authentication SUCCESS!');
            console.log('Name:', data.name);
            
            // Play success sound (non-blocking)
            try {
                cyberSounds.successSound();
            } catch (e) {
                console.warn('Sound error (non-critical):', e);
            }
            
            console.log('Switching to success screen...');
            
            // Show success screen
            const analysisScreen = document.getElementById('analysis-screen');
            const successScreen = document.getElementById('success-screen');
            const welcomeName = document.getElementById('welcomeName');
            const timestamp = document.getElementById('timestamp');
            
            console.log('Elements found:', {
                analysisScreen: !!analysisScreen,
                successScreen: !!successScreen,
                welcomeName: !!welcomeName,
                timestamp: !!timestamp
            });
            
            if (!successScreen) {
                console.error('ERROR: success-screen element not found!');
                alert('Error: Success screen not found in DOM');
                return;
            }
            
            analysisScreen.classList.remove('active');
            successScreen.classList.add('active');
            
            console.log('Success screen classes:', successScreen.classList);
            
            welcomeName.textContent = `HELLO, ${data.name.toUpperCase()}!`;
            
            const now = new Date();
            const timestampText = `AUTHENTICATED AT: ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;
            timestamp.textContent = timestampText;
            
            console.log('✓ Success screen should now be visible!');
            console.log('Welcome text:', welcomeName.textContent);
            console.log('Timestamp:', timestampText);
        } else {
            console.error('✗ Authentication FAILED:', data.message);
            cyberSounds.errorSound();
            document.getElementById('analysisStatus').textContent = 'AUTHENTICATION FAILED: ' + data.message;
        }
    })
    .catch(error => {
        console.error('✗ Authentication ERROR:', error);
        console.error('Error details:', error.message, error.stack);
        cyberSounds.errorSound();
        document.getElementById('analysisStatus').textContent = 'CONNECTION ERROR: ' + error.message;
        alert('Authentication failed: ' + error.message + '\n\nMake sure Flask server is running!');
    });
}

function authenticateUser() {
    if (!video) {
        cyberSounds.errorSound();
        updateAuthStatus('❌ Camera not active');
        return;
    }
    
    // Play scanning sound
    cyberSounds.scanningSound();
    
    // Capture fresh image for authentication
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = video.videoWidth;
    tempCanvas.height = video.videoHeight;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(video, 0, 0);
    
    updateAuthStatus('🔄 Authenticating with biometric system...');
    
    const imageData = tempCanvas.toDataURL('image/jpeg');
    
    // Send to Python backend for real face recognition
    fetch('/authenticate', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image: imageData })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Play success sound
            cyberSounds.successSound();
            
            // Stop camera and face detection
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
            if (faceDetectionInterval) {
                clearInterval(faceDetectionInterval);
            }
            
            // Show success screen
            document.getElementById('auth-screen').classList.remove('active');
            document.getElementById('success-screen').classList.add('active');
            document.getElementById('welcomeName').textContent = `HELLO, ${data.name.toUpperCase()}!`;
            
            // Add timestamp
            const now = new Date();
            const timestamp = `${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;
            document.getElementById('timestamp').textContent = `AUTHENTICATED AT: ${timestamp}`;
        } else {
            cyberSounds.errorSound();
            updateAuthStatus(`❌ ACCESS DENIED - ${data.message}`);
            document.querySelector('.auth-status').style.color = '#ff0044';
        }
    })
    .catch(error => {
        cyberSounds.errorSound();
        updateAuthStatus('❌ Server connection error - Make sure Flask is running');
        document.querySelector('.auth-status').style.color = '#ff0044';
    });
}

function showFingerprint() {
    const modal = document.getElementById('fingerprint-modal');
    modal.classList.add('active');
    
    // Simulate fingerprint scan
    setTimeout(() => {
        document.getElementById('fingerprintStatus').textContent = 'SCANNING...';
    }, 1000);
    
    setTimeout(() => {
        document.getElementById('fingerprintStatus').textContent = '✅ FINGERPRINT VERIFIED';
        document.getElementById('fingerprintStatus').style.color = '#00ff88';
    }, 3000);
}

function closeFingerprint() {
    const modal = document.getElementById('fingerprint-modal');
    modal.classList.remove('active');
    document.getElementById('fingerprintStatus').textContent = 'PLACE FINGER ON SENSOR';
    document.getElementById('fingerprintStatus').style.color = '#00ff88';
}

function updateAuthStatus(message) {
    document.getElementById('authStatus').innerHTML = `<p>${message}</p>`;
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        if (faceDetectionInterval) {
            clearInterval(faceDetectionInterval);
        }
        currentScreen = 0;
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById('intro-screen').classList.add('active');
        startIntro();
    }
});


// Allow Enter key to submit in capture modal
document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('userName');
    if (input) {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                captureImage();
            }
        });
    }
});


// 3D Analysis Screen Functions
let rotation3D = 0;
let wireframeCanvas, wireframeCtx;

function showAnalysisScreen() {
    // Stop camera and face detection
    if (faceDetectionInterval) {
        clearInterval(faceDetectionInterval);
    }
    
    // Switch to analysis screen
    document.getElementById('auth-screen').classList.remove('active');
    document.getElementById('analysis-screen').classList.add('active');
    
    // Display captured image
    const capturedImg = document.getElementById('capturedImage');
    capturedImg.src = window.capturedImageData;
    
    // Wait for image to load, then draw landmarks
    capturedImg.onload = () => {
        drawCapturedLandmarks();
        draw3DWireframe();
    };
}

function drawCapturedLandmarks() {
    const img = document.getElementById('capturedImage');
    const canvas = document.getElementById('capturedMeshCanvas');
    const container = canvas.parentElement;
    
    // Set canvas size to match container
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (!window.capturedLandmarks || !window.capturedLandmarks.landmarks) {
        document.getElementById('analysisStatus').textContent = 'NO FACE DETECTED';
        document.getElementById('landmarkCount').textContent = '0';
        return;
    }
    
    const landmarks = window.capturedLandmarks.landmarks;
    
    console.log('Drawing captured landmarks:', landmarks.length);
    
    // Calculate scale factors based on image display size
    const imgAspect = img.naturalWidth / img.naturalHeight;
    const containerAspect = canvas.width / canvas.height;
    
    let scale, offsetX = 0, offsetY = 0;
    
    if (imgAspect > containerAspect) {
        scale = canvas.width / img.naturalWidth;
        offsetY = (canvas.height - img.naturalHeight * scale) / 2;
    } else {
        scale = canvas.height / img.naturalHeight;
        offsetX = (canvas.width - img.naturalWidth * scale) / 2;
    }
    
    const width = img.naturalWidth * scale;
    const height = img.naturalHeight * scale;
    
    // Draw facial landmark connections (same as live view)
    ctx.strokeStyle = 'rgba(0, 255, 136, 0.6)';
    ctx.lineWidth = 2;
    
    const FACEMESH_FACE_OVAL = [
        [10, 338], [338, 297], [297, 332], [332, 284], [284, 251], [251, 389],
        [389, 356], [356, 454], [454, 323], [323, 361], [361, 288], [288, 397],
        [397, 365], [365, 379], [379, 378], [378, 400], [400, 377], [377, 152],
        [152, 148], [148, 176], [176, 149], [149, 150], [150, 136], [136, 172],
        [172, 58], [58, 132], [132, 93], [93, 234], [234, 127], [127, 162],
        [162, 21], [21, 54], [54, 103], [103, 67], [67, 109], [109, 10]
    ];
    
    const FACEMESH_LIPS = [
        [61, 146], [146, 91], [91, 181], [181, 84], [84, 17], [17, 314],
        [314, 405], [405, 321], [321, 375], [375, 291], [61, 185], [185, 40],
        [40, 39], [39, 37], [37, 0], [0, 267], [267, 269], [269, 270],
        [270, 409], [409, 291], [78, 95], [95, 88], [88, 178], [178, 87],
        [87, 14], [14, 317], [317, 402], [402, 318], [318, 324], [324, 308],
        [78, 191], [191, 80], [80, 81], [81, 82], [82, 13], [13, 312],
        [312, 311], [311, 310], [310, 415], [415, 308]
    ];
    
    const FACEMESH_LEFT_EYE = [
        [263, 249], [249, 390], [390, 373], [373, 374], [374, 380], [380, 381],
        [381, 382], [382, 362], [263, 466], [466, 388], [388, 387], [387, 386],
        [386, 385], [385, 384], [384, 398], [398, 362]
    ];
    
    const FACEMESH_RIGHT_EYE = [
        [33, 7], [7, 163], [163, 144], [144, 145], [145, 153], [153, 154],
        [154, 155], [155, 133], [33, 246], [246, 161], [161, 160], [160, 159],
        [159, 158], [158, 157], [157, 173], [173, 133]
    ];
    
    const allConnections = [
        ...FACEMESH_FACE_OVAL,
        ...FACEMESH_LIPS,
        ...FACEMESH_LEFT_EYE,
        ...FACEMESH_RIGHT_EYE
    ];
    
    // Draw all connections
    allConnections.forEach(([start, end]) => {
        if (landmarks[start] && landmarks[end]) {
            ctx.beginPath();
            ctx.moveTo(
                landmarks[start].x * width + offsetX,
                landmarks[start].y * height + offsetY
            );
            ctx.lineTo(
                landmarks[end].x * width + offsetX,
                landmarks[end].y * height + offsetY
            );
            ctx.stroke();
        }
    });
    
    // Draw landmark points
    ctx.fillStyle = '#00ff88';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#00ff88';
    
    const keyPoints = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 33, 133, 263, 362, 1, 61, 291];
    
    keyPoints.forEach(idx => {
        if (landmarks[idx]) {
            ctx.beginPath();
            ctx.arc(
                landmarks[idx].x * width + offsetX,
                landmarks[idx].y * height + offsetY,
                3, 0, Math.PI * 2
            );
            ctx.fill();
        }
    });
    
    ctx.shadowBlur = 0;
    
    // Update info
    document.getElementById('landmarkCount').textContent = landmarks.length;
    document.getElementById('detectionConfidence').textContent = '95%';
    document.getElementById('analysisStatus').textContent = 'COMPLETE';
}

function draw3DWireframe() {
    wireframeCanvas = document.getElementById('wireframe3D');
    wireframeCtx = wireframeCanvas.getContext('2d');
    
    // Set canvas size
    wireframeCanvas.width = wireframeCanvas.clientWidth;
    wireframeCanvas.height = wireframeCanvas.clientHeight;
    
    animate3DWireframe();
}

function animate3DWireframe() {
    if (!wireframeCanvas || !wireframeCtx) return;
    
    wireframeCtx.clearRect(0, 0, wireframeCanvas.width, wireframeCanvas.height);
    
    if (!window.capturedLandmarks || !window.capturedLandmarks.landmarks) {
        wireframeCtx.fillStyle = '#00ff88';
        wireframeCtx.font = '20px "Courier New"';
        wireframeCtx.textAlign = 'center';
        wireframeCtx.fillText('NO FACE DATA', wireframeCanvas.width / 2, wireframeCanvas.height / 2);
        requestAnimationFrame(animate3DWireframe);
        return;
    }
    
    const landmarks = window.capturedLandmarks.landmarks;
    const centerX = wireframeCanvas.width / 2;
    const centerY = wireframeCanvas.height / 2;
    
    // Calculate face center from landmarks
    let sumX = 0, sumY = 0;
    landmarks.forEach(p => {
        sumX += p.x;
        sumY += p.y;
    });
    const faceCenterX = sumX / landmarks.length;
    const faceCenterY = sumY / landmarks.length;
    
    // Project 3D points with rotation - INCREASED SCALE
    const scale = 600; // Much larger for better visibility
    const points3D = landmarks.map(point => {
        // Translate to origin
        let x = (point.x - faceCenterX) * scale;
        let y = (point.y - faceCenterY) * scale;
        let z = (point.z || 0) * scale * 2; // Emphasize depth
        
        // Rotate around Y axis
        const cosR = Math.cos(rotation3D);
        const sinR = Math.sin(rotation3D);
        const rotatedX = x * cosR - z * sinR;
        const rotatedZ = x * sinR + z * cosR;
        
        // Perspective projection
        const perspective = 800;
        const projectedX = (rotatedX * perspective) / (perspective + rotatedZ) + centerX;
        const projectedY = (y * perspective) / (perspective + rotatedZ) + centerY;
        
        return { x: projectedX, y: projectedY, z: rotatedZ };
    });
    
    // Draw wireframe connections
    wireframeCtx.strokeStyle = 'rgba(0, 255, 136, 0.7)';
    wireframeCtx.lineWidth = 2;
    
    const connections = [
        [10, 338], [338, 297], [297, 332], [332, 284], [284, 251], [251, 389],
        [389, 356], [356, 454], [454, 323], [323, 361], [361, 288], [288, 397],
        [397, 365], [365, 379], [379, 378], [378, 400], [400, 377], [377, 152],
        [152, 148], [148, 176], [176, 149], [149, 150], [150, 136], [136, 172],
        [172, 58], [58, 132], [132, 93], [93, 234], [234, 127], [127, 162],
        [162, 21], [21, 54], [54, 103], [103, 67], [67, 109], [109, 10],
        [61, 146], [146, 91], [91, 181], [181, 84], [84, 17], [17, 314],
        [314, 405], [405, 321], [321, 375], [375, 291],
        [33, 133], [263, 362], [1, 4], [61, 291], [78, 308]
    ];
    
    connections.forEach(([start, end]) => {
        if (points3D[start] && points3D[end]) {
            wireframeCtx.beginPath();
            wireframeCtx.moveTo(points3D[start].x, points3D[start].y);
            wireframeCtx.lineTo(points3D[end].x, points3D[end].y);
            wireframeCtx.stroke();
        }
    });
    
    // Draw points
    wireframeCtx.fillStyle = '#00ff88';
    wireframeCtx.shadowBlur = 10;
    wireframeCtx.shadowColor = '#00ff88';
    
    const keyPoints = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 33, 133, 263, 362, 1, 61, 291];
    
    keyPoints.forEach(idx => {
        if (points3D[idx]) {
            wireframeCtx.beginPath();
            wireframeCtx.arc(points3D[idx].x, points3D[idx].y, 5, 0, Math.PI * 2);
            wireframeCtx.fill();
        }
    });
    
    wireframeCtx.shadowBlur = 0;
    
    requestAnimationFrame(animate3DWireframe);
}

function rotate3DModel(direction) {
    cyberSounds.clickSound();
    if (direction === 'left') {
        rotation3D -= 0.1;
    } else if (direction === 'right') {
        rotation3D += 0.1;
    }
}

function reset3DModel() {
    cyberSounds.clickSound();
    rotation3D = 0;
}

function authenticateFromAnalysis() {
    console.log('Authenticate button clicked');
    cyberSounds.clickSound();
    
    // Get the modal element
    const modal = document.getElementById('capture-modal');
    const nameInput = document.getElementById('userName');
    
    if (!modal) {
        console.error('Modal not found!');
        alert('Error: Modal not found');
        return;
    }
    
    if (!nameInput) {
        console.error('Name input not found!');
        alert('Error: Name input not found');
        return;
    }
    
    // Show the name input modal
    modal.classList.add('active');
    nameInput.value = '';
    
    // Focus after a short delay to ensure modal is visible
    setTimeout(() => {
        nameInput.focus();
    }, 100);
    
    console.log('Name input modal shown, classes:', modal.classList);
}

function backToCamera() {
    cyberSounds.clickSound();
    
    // Switch back to auth screen
    document.getElementById('analysis-screen').classList.remove('active');
    document.getElementById('auth-screen').classList.add('active');
    
    // Restart face detection
    if (faceDetector) {
        detectAndDrawFace();
    }
}
