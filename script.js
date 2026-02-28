const video = document.getElementById("web");
const canvas = document.getElementById("con");
const photoDownload = document.getElementById("photoDownload");
const videoDownload = document.getElementById("videoDownload");
const recordedVideo = document.getElementById("recordedVideo");

const recordBtn = document.getElementById("recordBtn");
const pauseBtn = document.getElementById("pauseBtn");
const stopBtn = document.getElementById("stopBtn");

const recordTimer = document.getElementById("recordTimer");
const recordCountdown = document.getElementById("recordCountdown");
const recordText = document.getElementById("recordText");
const photoPreview = document.getElementById("photoPreview");
const retakeBtn = document.getElementById("retakeBtn");

const photoModeBtn = document.getElementById("photoMode");
const videoModeBtn = document.getElementById("videoMode");
const photoControls = document.getElementById("photoControls");
const videoControls = document.getElementById("videoControls");
const modeToggle = document.querySelector(".mode-toggle");

const filterButtons = document.querySelectorAll(".filters button");
const switchBtn = document.getElementById("switchBtn");

let selectedMimeType = "video/webm";
let stream = null;
let mediaRecorder = null;
let recordedChunks = [];
let facingMode = "user";
let currentFilter = "none";
let timerInterval = null;
let seconds = 0;
let isPaused = false;


/* ---------------- CAMERA ---------------- */

async function startCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }

    try {
        // Try exact camera first
        stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { exact: facingMode } },
            audio: true
        });
    } catch (error) {
        // Fallback if exact fails
        stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        });
    }

    video.srcObject = stream;

    // Mirror only front camera
    video.style.transform =
        facingMode === "user" ? "scaleX(-1)" : "scaleX(1)";
}

startCamera().catch(() => {
    alert("Camera access failed. Allow permission & use HTTPS.");
});

function switchCamera() {
    if (mediaRecorder && mediaRecorder.state === "recording") return;

    facingMode = facingMode === "user" ? "environment" : "user";
    startCamera();

}

/* ---------------- FILTERS ---------------- */

function setFilter(filter, clickedButton) {
    currentFilter = filter;
    video.style.filter = filter;

    // Remove active from all
    filterButtons.forEach(btn => {
        btn.classList.remove("active-filter");
    });

    // Add active to clicked one
    clickedButton.classList.add("active-filter");
}


/* ---------------- PHOTO ---------------- */

function takePhoto() {
    const ctx = canvas.getContext("2d");

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.save();
    ctx.filter = currentFilter;

    if (facingMode === "user") {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0);
    ctx.restore();

    const image = canvas.toDataURL("image/png");

    // Show preview
    photoPreview.src = image;
    photoPreview.style.display = "block";

    // Hide live video
    video.style.display = "none";

    // Show buttons
    photoDownload.href = image;
    photoDownload.style.display = "inline-block";
    retakeBtn.style.display = "inline-block";
}
function retakePhoto() {
    photoPreview.style.display = "none";
    video.style.display = "block";

    photoDownload.style.display = "none";
    retakeBtn.style.display = "none";
}
/* ---------------- RECORDING ---------------- */
let animationFrameId;

function drawToCanvas() {
    const ctx = canvas.getContext("2d");

    ctx.filter = currentFilter;

    if (facingMode === "user") {
        ctx.save();
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0);
        ctx.restore();
    } else {
        ctx.drawImage(video, 0, 0);
    }

    animationFrameId = requestAnimationFrame(drawToCanvas);
}

function startRecording() {
    let countdown = 3;
    recordCountdown.style.display = "block";
    recordText.textContent = countdown;

    const interval = setInterval(() => {
        countdown--;
        recordText.textContent = countdown;

        if (countdown === 0) {
            clearInterval(interval);
            recordCountdown.style.display = "none";
            beginRecording();
        }
    }, 1000);
}


function beginRecording() {

    recordedChunks = [];
    seconds = 0;
    isPaused = false;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    drawToCanvas(); // Start drawing filtered video

    const canvasStream = canvas.captureStream(30); // 30fps

    // 🔥 ADD AUDIO TRACK FROM ORIGINAL STREAM
    if (stream) {
        const audioTracks = stream.getAudioTracks();
        audioTracks.forEach(track => {
            canvasStream.addTrack(track);
        });
    }
    let options = {};

    if (!window.MediaRecorder) {
        alert("Recording not supported in this browser.");
        return;
    }

    // Try best quality first
    if (MediaRecorder.isTypeSupported("video/webm;codecs=vp9")) {
        options.mimeType = "video/webm;codecs=vp9";
    }
    else if (MediaRecorder.isTypeSupported("video/webm;codecs=vp8")) {
        options.mimeType = "video/webm;codecs=vp8";
    }
    else if (MediaRecorder.isTypeSupported("video/webm")) {
        options.mimeType = "video/webm";
    }

    if (options.mimeType) {
        selectedMimeType = options.mimeType;
    }
    try {
        mediaRecorder = new MediaRecorder(canvasStream, options);
    } catch (error) {
        alert("Recording failed on this device.");
        return;
    }

    mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) recordedChunks.push(e.data);
    };

    mediaRecorder.onstop = function () {
        cancelAnimationFrame(animationFrameId);
        saveVideo();
    };

    mediaRecorder.start();

    recordBtn.disabled = true;
    pauseBtn.disabled = false;
    stopBtn.disabled = false;
    switchBtn.disabled = true;
    photoModeBtn.disabled = true;
    videoModeBtn.disabled = true;

    recordTimer.style.display = "block";

    updateTimer();
}


function pauseResumeRecording() {
    if (!mediaRecorder) return;
    if (mediaRecorder.state === "inactive") return;
    if (!isPaused) {
        mediaRecorder.pause();
        pauseBtn.innerHTML =
            '<i class="fa-solid fa-play"></i> Resume';
        isPaused = true;
    } else {
        mediaRecorder.resume();
        pauseBtn.innerHTML =
            '<i class="fa-solid fa-pause"></i> Pause';
        isPaused = false;
    }
}

function stopRecording() {
    if (!mediaRecorder) return;

    mediaRecorder.stop();

    clearInterval(timerInterval);
    recordTimer.style.display = "none";
    pauseBtn.innerHTML =
        '<i class="fa-solid fa-pause"></i> Pause';
    isPaused = false;
    recordBtn.disabled = false;
    pauseBtn.disabled = true;
    stopBtn.disabled = true;
    switchBtn.disabled = false;
    photoModeBtn.disabled = false;
    videoModeBtn.disabled = false;
    mediaRecorder = null;
}

function saveVideo() {
    const blob = new Blob(recordedChunks, { type: selectedMimeType });
    const url = URL.createObjectURL(blob);

    // Hide camera
    video.style.display = "none";

    // Show recorded video inside same container
    recordedVideo.src = url;
    recordedVideo.style.display = "block";

    videoDownload.href = url;
    videoDownload.download = "video.webm";
    videoDownload.style.display = "flex";
    video.pause();
}

function closeVideoPreview() {
    recordedVideo.style.display = "none";
    video.style.display = "block";
    videoDownload.style.display = "none";
    video.play();
    if (recordedVideo.src) {
        URL.revokeObjectURL(recordedVideo.src);
    }
}

/* ---------------- TIMER ---------------- */

function updateTimer() {
    clearInterval(timerInterval); // safety

    timerInterval = setInterval(() => {
        if (!isPaused) {
            seconds++;
            const m = String(Math.floor(seconds / 60)).padStart(2, "0");
            const s = String(seconds % 60).padStart(2, "0");
            recordTimer.textContent = `${m}:${s}`;
        }
    }, 1000);
}

function switchMode(mode) {

    if (mediaRecorder && mediaRecorder.state === "recording") {
        return;
    }
    // Reset previews
    recordedVideo.style.display = "none";
    photoPreview.style.display = "none";
    video.style.display = "block";
    videoDownload.style.display = "none";
    photoDownload.style.display = "none";
    retakeBtn.style.display = "none";

    if (mode === "photo") {

        // UI highlight
        modeToggle.classList.remove("video-active");
        photoModeBtn.classList.add("active");
        videoModeBtn.classList.remove("active");

        // SHOW PHOTO CONTROLS
        photoControls.style.display = "flex";
        videoControls.style.display = "none";

    } else {

        // UI highlight
        modeToggle.classList.add("video-active");
        videoModeBtn.classList.add("active");
        photoModeBtn.classList.remove("active");

        // SHOW VIDEO CONTROLS
        photoControls.style.display = "none";
        videoControls.style.display = "flex";
    }
}
photoModeBtn.addEventListener("click", function () {
    switchMode("photo");
});

videoModeBtn.addEventListener("click", function () {
    switchMode("video");
});

filterButtons.forEach(button => {
    button.addEventListener("click", function () {
        const filterValue = this.getAttribute("data-filter");
        setFilter(filterValue, this);
    });
});
switchMode("photo");
switchBtn.addEventListener("click", switchCamera);