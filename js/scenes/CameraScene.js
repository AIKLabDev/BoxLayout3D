export default class CameraScene {
  constructor({ canvasId } = {}) {
    this.canvas = canvasId ? document.getElementById(canvasId) : null;
    if (!this.canvas) {
      console.warn('[CameraScene] 지정된 캔버스를 찾을 수 없습니다:', canvasId);
      return;
    }

    this.ctx = this.canvas.getContext('2d');
    this.frameHandle = null;
    this.videoElement = null;
    this.streamSource = null;
    this.placeholderHue = 210;
    this.resizeHandler = () => this.resize();

    this.resize();
    window.addEventListener('resize', this.resizeHandler);
    this.startLoop();
  }

  resize() {
    if (!this.canvas) return;
    const parent = this.canvas.parentElement;
    const rect = parent ? parent.getBoundingClientRect() : this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    this.cssWidth = width;
    this.cssHeight = height;
    this.pixelRatio = dpr;
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    if (this.ctx) {
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.scale(dpr, dpr);
    }
  }

  startLoop() {
    const render = (time) => {
      this.frameHandle = requestAnimationFrame(render);
      if (!this.ctx) return;

      if (this.videoElement && this.videoElement.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        this.drawVideoFrame();
      } else {
        this.drawPlaceholder(time);
      }
    };
    this.frameHandle = requestAnimationFrame(render);
  }

  drawPlaceholder(time) {
    const ctx = this.ctx;
    const width = this.cssWidth ?? this.canvas.width;
    const height = this.cssHeight ?? this.canvas.height;
    if (!ctx || width === 0 || height === 0) return;

    const seconds = time * 0.001;
    const hue = (this.placeholderHue + seconds * 20) % 360;
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, `hsl(${hue}, 65%, 24%)`);
    gradient.addColorStop(1, `hsl(${(hue + 40) % 360}, 55%, 14%)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    const pulse = 0.5 + 0.5 * Math.sin(seconds * 2);
    const overlay = `rgba(12, 19, 38, ${0.35 + pulse * 0.15})`;
    ctx.fillStyle = overlay;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#d1e8ff';
    ctx.font = '600 20px "Segoe UI", Arial, sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText('Camera feed placeholder', 16, 16);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 2;
    const crossX = width / 2;
    const crossY = height / 2;
    const crossSize = Math.min(width, height) * 0.2;
    ctx.beginPath();
    ctx.moveTo(crossX - crossSize, crossY);
    ctx.lineTo(crossX + crossSize, crossY);
    ctx.moveTo(crossX, crossY - crossSize);
    ctx.lineTo(crossX, crossY + crossSize);
    ctx.stroke();
  }

  drawVideoFrame() {
    const ctx = this.ctx;
    const video = this.videoElement;
    if (!ctx || !video) return;
    const width = this.cssWidth ?? this.canvas.width;
    const height = this.cssHeight ?? this.canvas.height;
    ctx.drawImage(video, 0, 0, width, height);
  }

  setStream(stream) {
    if (!this.canvas) return;
    if (!this.videoElement) {
      this.videoElement = document.createElement('video');
      this.videoElement.autoplay = true;
      this.videoElement.playsInline = true;
      this.videoElement.muted = true;
      this.videoElement.addEventListener('loadedmetadata', () => this.resize());
    }

    if (this.streamSource === stream) return;
    this.streamSource = stream;
    this.videoElement.srcObject = stream;
    this.videoElement.play().catch((err) => {
      console.warn('[CameraScene] 비디오 재생에 실패했습니다.', err);
    });
  }

  stopStream() {
    if (this.streamSource && typeof this.streamSource.getTracks === 'function') {
      this.streamSource.getTracks().forEach((track) => track.stop());
    }
    this.streamSource = null;
    if (this.videoElement) {
      this.videoElement.pause();
      this.videoElement.srcObject = null;
    }
  }

  dispose() {
    if (this.frameHandle) {
      cancelAnimationFrame(this.frameHandle);
      this.frameHandle = null;
    }
    window.removeEventListener('resize', this.resizeHandler);
    this.stopStream();
  }
}
