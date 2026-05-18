import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgpu';
import { isWebGPUSupported, logError } from '../utils/common';

export class DetectionService {
  constructor() {
    this.model = null;
    this.labels = [];
    this.config = null;
    this.isModelLoaded = false;
  }

  async loadModel(onProgress) {
    try {
      // 1. Adaptive Backend Strategy
      let backend = 'webgl';
      if (isWebGPUSupported()) {
        try {
          await tf.setBackend('webgpu');
          backend = 'webgpu';
        } catch (e) {
          logError('WebGPU Init', e);
          await tf.setBackend('webgl');
        }
      } else {
        await tf.setBackend('webgl');
      }
      await tf.ready();
      console.log(`Using TFJS Backend: ${backend}`);

      // Progress reporting
      if (onProgress) onProgress('Memuat Model AI... 10%');

      // 2. Load model & metadata
      const modelURL = '/model/model.json';
      const metadataURL = '/model/metadata.json';
      
      const [model, metadataResponse] = await Promise.all([
        tf.loadLayersModel(modelURL, {
          onProgress: (fraction) => {
            if (onProgress) {
              const p = Math.round(10 + (fraction * 80));
              onProgress(`Memuat Model AI... ${p}%`);
            }
          }
        }),
        fetch(metadataURL)
      ]);

      this.model = model;
      
      const metadata = await metadataResponse.json();
      this.labels = metadata.labels;
      
      if (onProgress) onProgress('Model AI Siap');
      this.isModelLoaded = true;

    } catch (error) {
      logError('DetectionService.loadModel', error);
      throw new Error('Gagal memuat model pendeteksi sayuran');
    }
  }

  async predict(imageElement) {
    if (!this.isLoaded()) throw new Error('Model belum siap');

    // Tensor creation and prediction inside tf.tidy
    const predictions = tf.tidy(() => {
      let tensor = tf.browser.fromPixels(imageElement);
      const imageSize = 224; 
      tensor = tf.image.resizeBilinear(tensor, [imageSize, imageSize]);
      tensor = tensor.expandDims(0);
      tensor = tensor.toFloat().div(tf.scalar(127.5)).sub(tf.scalar(1));
      return this.model.predict(tensor);
    });

    // Extract data asynchronously to prevent WebGPU synchronous read warning
    const scores = await predictions.data();
    
    // Cleanup prediction tensor
    predictions.dispose();

    // Find best match
    let maxScore = 0;
    let maxIndex = 0;
    for (let i = 0; i < scores.length; i++) {
      if (scores[i] > maxScore) {
        maxScore = scores[i];
        maxIndex = i;
      }
    }

    return {
      className: this.labels[maxIndex],
      score: maxScore,
      isValid: true,
      confidence: maxScore * 100
    };
  }

  isLoaded() {
    return this.isModelLoaded && this.model !== null;
  }
}
