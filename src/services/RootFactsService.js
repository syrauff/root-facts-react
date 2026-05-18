import { TONE_CONFIG } from '../utils/config.js';
import { isWebGPUSupported, logError } from '../utils/common.js';
import { pipeline, env } from '@huggingface/transformers';

export class RootFactsService {
  constructor() {
    this.generator = null;
    this.isModelLoaded = false;
    this.isGenerating = false;
    this.currentTone = TONE_CONFIG.defaultTone;
  }

  async loadModel(onProgress) {
    try {
      if (onProgress) onProgress('Memuat AI Generator... 10%');

      // Adaptive Backend for Transformers.js
      const device = isWebGPUSupported() ? 'webgpu' : 'webgl';
      env.allowLocalModels = false;
      
      this.generator = await pipeline(
        'text2text-generation',
        'Xenova/LaMini-Flan-T5-77M',
        {
          device,
          dtype: 'q4',
          progress_callback: (info) => {
            if (info.status === 'progress' && onProgress) {
              const p = Math.round(10 + (info.progress * 0.8));
              onProgress(`Memuat AI Generator... ${p}%`);
            }
          }
        }
      );

      this.isModelLoaded = true;
      if (onProgress) onProgress('Model AI Siap');
    } catch (error) {
      logError('RootFactsService.loadModel', error);
      throw new Error('Gagal memuat AI Generator');
    }
  }

  setTone(tone) {
    this.currentTone = tone;
  }

  async generateFacts(vegetableName) {
    if (!this.isReady()) throw new Error('AI Generator belum siap');
    
    this.isGenerating = true;
    try {
      let prompt = `Provide a short and interesting fun fact about ${vegetableName}.`;
      
      switch (this.currentTone) {
        case 'funny':
          prompt = `Tell a hilarious and funny joke or fun fact about ${vegetableName}.`;
          break;
        case 'professional':
          prompt = `Provide a scientific and professional fun fact about the nutritional value or botany of ${vegetableName}.`;
          break;
        case 'casual':
          prompt = `Hey, tell me something cool and casual about ${vegetableName}.`;
          break;
      }

      const result = await this.generator(prompt, {
        max_new_tokens: 150,
        temperature: 0.7,
        top_p: 0.9,
        do_sample: true
      });

      this.isGenerating = false;
      return result[0].generated_text;
    } catch (error) {
      this.isGenerating = false;
      logError('RootFactsService.generateFacts', error);
      throw error;
    }
  }

  isReady() {
    return this.isModelLoaded && this.generator !== null;
  }
}
