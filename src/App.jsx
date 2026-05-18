import { useRef, useState, useEffect } from 'react';
import Header from './components/Header';
import CameraSection from './components/CameraSection';
import InfoPanel from './components/InfoPanel';
import { useAppState } from './hooks/useAppState';
import { DetectionService } from './services/DetectionService';
import { CameraService } from './services/CameraService';
import { RootFactsService } from './services/RootFactsService';
import { APP_CONFIG, isValidDetection } from './utils/config';

function App() {
  const { state, actions } = useAppState();
  const detectionCleanupRef = useRef(null);
  const isRunningRef = useRef(false);
  const [currentTone, setCurrentTone] = useState('normal');

  // Initialize services
  useEffect(() => {
    const initServices = async () => {
      try {
        const detector = new DetectionService();
        const camera = new CameraService();
        const generator = new RootFactsService();
        
        actions.setServices({ detector, camera, generator });
        
        await detector.loadModel((progress) => actions.setModelStatus(progress));
        await generator.loadModel((progress) => actions.setModelStatus(progress));
        
        actions.setModelStatus('Model AI Siap');
      } catch (err) {
        actions.setError(err.message);
      }
    };
    initServices();

    return () => {
      if (detectionCleanupRef.current) clearInterval(detectionCleanupRef.current);
      // We can't access current state in cleanup reliably if it changes, 
      // but usually the app doesn't unmount anyway.
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const startDetectionLoop = () => {
    if (detectionCleanupRef.current) clearInterval(detectionCleanupRef.current);
    
    detectionCleanupRef.current = setInterval(async () => {
      const { detector, camera, generator } = state.services;
      if (!isRunningRef.current || !camera.isReady() || !detector.isLoaded()) return;

      try {
        const result = await detector.predict(camera.video);
        if (isValidDetection(result)) {
          stopDetectionLoop();
          actions.setRunning(false);
          isRunningRef.current = false;
          
          actions.setAppState('analyzing');
          actions.setDetectionResult(result);
          
          camera.stopCamera();

          setTimeout(async () => {
            actions.setAppState('result');
            try {
              const fact = await generator.generateFacts(result.className);
              actions.setFunFactData(fact);
            } catch (err) {
              actions.setFunFactData('error');
            }
          }, APP_CONFIG.analyzingDelay);
        }
      } catch (err) {
        console.error(err);
      }
    }, 1000 / (state.services.camera?.fps || 30));
  };

  const stopDetectionLoop = () => {
    if (detectionCleanupRef.current) {
      clearInterval(detectionCleanupRef.current);
      detectionCleanupRef.current = null;
    }
  };

  const onToggleCamera = async () => {
    const { camera } = state.services;
    if (!camera) return;

    if (isRunningRef.current) {
      camera.stopCamera();
      stopDetectionLoop();
      actions.setRunning(false);
      isRunningRef.current = false;
      actions.resetResults();
    } else {
      try {
        actions.resetResults();
        await camera.startCamera();
        actions.setRunning(true);
        isRunningRef.current = true;
        startDetectionLoop();
      } catch (err) {
        actions.setError(err.message);
      }
    }
  };

  const onToneChange = (newTone) => {
    setCurrentTone(newTone);
    if (state.services.generator) {
      state.services.generator.setTone(newTone);
    }
  };

  const onCopyFact = async () => {
    if (state.funFactData && state.funFactData !== 'error') {
      try {
        await navigator.clipboard.writeText(state.funFactData);
      } catch (err) {
        actions.setError('Gagal menyalin teks ke clipboard');
      }
    }
  };

  return (
    <div className="app-container">
      <Header modelStatus={state.modelStatus} />

      <main className="main-content">
        <CameraSection
          isRunning={state.isRunning}
          onToggleCamera={onToggleCamera}
          onToneChange={onToneChange}
          services={state.services}
          modelStatus={state.modelStatus}
          error={state.error}
          currentTone={currentTone}
        />

        <InfoPanel
          appState={state.appState}
          detectionResult={state.detectionResult}
          funFactData={state.funFactData}
          error={state.error}
          onCopyFact={onCopyFact}
        />
      </main>

      <footer className="footer">
        <p>Powered by TensorFlow.js & Transformers.js</p>
      </footer>

      {state.error && (
        <div style={{
          position: 'fixed',
          bottom: '1rem',
          left: '50%',
          transform: 'translateX(-50%)',
          maxWidth: '380px',
          padding: '0.875rem 1rem',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: 'var(--radius-md)',
          color: '#991b1b',
          fontSize: '0.8125rem',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          zIndex: 1000
        }}>
          <strong>Error:</strong> {state.error}
          <button
            onClick={() => actions.setError(null)}
            style={{
              marginLeft: 'auto',
              background: 'transparent',
              border: 'none',
              fontSize: '1.25rem',
              cursor: 'pointer',
              color: '#991b1b',
              padding: 0,
              lineHeight: 1
            }}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
