import { getCameraErrorMessage, logError } from '../utils/common';

export class CameraService {
  constructor() {
    this.stream = null;
    this.video = null;
    this.canvas = null;
    this.fps = 30;
    this.cameraType = 'default'; // 'default' (back) or 'front'
  }

  setVideoElement(videoElement) {
    this.video = videoElement;
  }

  setCanvasElement(canvasElement) {
    this.canvas = canvasElement;
  }

  async loadCameras() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter(device => device.kind === 'videoinput');
    } catch (error) {
      logError('loadCameras', error);
      return [];
    }
  }

  async startCamera() {
    if (!this.video) throw new Error('Video element not set');
    
    this.stopCamera();

    try {
      const constraints = {
        video: {
          facingMode: this.cameraType === 'front' ? 'user' : 'environment',
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      };

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.video.srcObject = this.stream;
      
      return new Promise((resolve) => {
        this.video.onloadedmetadata = () => {
          this.video.play();
          resolve(true);
        };
      });
    } catch (error) {
      logError('startCamera', error);
      throw new Error(getCameraErrorMessage(error));
    }
  }

  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.video) {
      this.video.srcObject = null;
    }
  }

  setFPS(fps) {
    this.fps = fps;
  }

  isActive() {
    return this.stream !== null && this.stream.active;
  }

  isReady() {
    return this.video !== null && this.video.readyState >= 2;
  }
}