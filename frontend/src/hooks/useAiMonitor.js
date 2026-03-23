import { useEffect, useRef, useState } from 'react';
import * as faceapi from '@vladmandic/face-api';

const MODEL_URL = 'https://vladmandic.github.io/face-api/model/';

export const useAiMonitor = (videoRef, isCandidate, socket, roomId, user) => {
  const [isAiLoaded, setIsAiLoaded] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!isCandidate) return;

    const loadModels = async () => {
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        ]);
        setIsAiLoaded(true);
        console.log('AI Models loaded');
      } catch (err) {
        console.error('Error loading AI models:', err);
      }
    };

    loadModels();
  }, [isCandidate]);

  useEffect(() => {
    if (!isCandidate) return;

    const handleVisibilityChange = () => {
      if (document.hidden && socket) {
        socket.emit('suspicious-activity', {
          roomId,
          alert: {
            type: 'Tab Switched',
            description: 'Candidate switched tabs or minimized the browser window.',
            timestamp: new Date().toISOString()
          }
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isCandidate, socket, roomId]);

  useEffect(() => {
    if (!isAiLoaded || !isCandidate || !videoRef.current || !socket) return;

    const detectFaces = async () => {
      if (videoRef.current.paused || videoRef.current.ended) return;

      const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 });
      const detections = await faceapi.detectAllFaces(videoRef.current, options);
      
      let type = null;
      let description = null;

      if (detections.length === 0) {
        type = 'No Face Detected';
        description = 'The candidate is not visible in the camera frame.';
      } else if (detections.length > 1) {
        type = 'Multiple Faces Detected';
        description = `Found ${detections.length} faces in the camera frame. Potential cheating.`;
      }
      
      // Send alert if anomalous
      if (type) {
        // Take screenshot
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const screenshotUrl = canvas.toDataURL('image/jpeg', 0.5);

        socket.emit('suspicious-activity', {
          roomId,
          alert: {
            type,
            description,
            screenshotUrl,
            timestamp: new Date().toISOString()
          }
        });
      }
    };

    // Run recognition every 3 seconds to avoid performance hit
    intervalRef.current = setInterval(detectFaces, 3000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isAiLoaded, isCandidate, videoRef, socket, roomId]);

  return { isAiLoaded };
};
