import { useRef, useState, useCallback } from 'react';
import { createWorker, Worker } from 'tesseract.js';

interface UseXpOcrReturn {
  isInitialized: boolean;
  isProcessing: boolean;
  initWorker: () => Promise<void>;
  recognizeXp: (imageData: ImageData) => Promise<number | null>;
  terminateWorker: () => Promise<void>;
}

// Parse XP value from OCR text
// Looking for patterns like "Experience    156,507" or "Experience: 156507"
const parseXpFromText = (text: string): number | null => {
  // Normalize text - remove extra whitespace and newlines
  const normalizedText = text.replace(/\s+/g, ' ').trim();
  
  // Try to find "Experience" followed by a number
  const patterns = [
    /experience[:\s]+([0-9,.\s]+)/i,
    /exp[:\s]+([0-9,.\s]+)/i,
    /xp[:\s]+([0-9,.\s]+)/i,
    // Also try to match standalone large numbers that could be XP
    /\b(\d{1,3}(?:[,.\s]\d{3})+)\b/,
    /\b(\d{4,})\b/,
  ];

  for (const pattern of patterns) {
    const match = normalizedText.match(pattern);
    if (match && match[1]) {
      // Clean the number - remove commas, dots used as thousand separators, and spaces
      const cleanNumber = match[1]
        .replace(/[,\s]/g, '')
        .replace(/\.(?=\d{3})/g, ''); // Remove dots used as thousand separators
      
      const parsed = parseInt(cleanNumber, 10);
      if (!isNaN(parsed) && parsed > 0) {
        return parsed;
      }
    }
  }

  return null;
};

export const useXpOcr = (): UseXpOcrReturn => {
  const workerRef = useRef<Worker | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const initWorker = useCallback(async () => {
    if (workerRef.current) {
      return;
    }

    try {
      const worker = await createWorker('eng', 1, {
        logger: () => {}, // Disable logging
      });
      
      // Configure for better number recognition
      await worker.setParameters({
        tessedit_char_whitelist: '0123456789,. ExperienceXPxp:',
      });

      workerRef.current = worker;
      setIsInitialized(true);
    } catch (error) {
      console.error('Failed to initialize Tesseract worker:', error);
      throw error;
    }
  }, []);

  const recognizeXp = useCallback(async (imageData: ImageData): Promise<number | null> => {
    if (!workerRef.current || !isInitialized) {
      console.warn('OCR worker not initialized');
      return null;
    }

    setIsProcessing(true);
    try {
      // Convert ImageData to canvas and then to blob
      const canvas = document.createElement('canvas');
      canvas.width = imageData.width;
      canvas.height = imageData.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return null;
      }
      ctx.putImageData(imageData, 0, 0);

      // Apply some preprocessing for better OCR
      // Increase contrast
      const tempImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = tempImageData.data;
      
      for (let i = 0; i < data.length; i += 4) {
        // Convert to grayscale
        const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        // Apply threshold for better contrast
        const value = gray > 128 ? 255 : 0;
        data[i] = data[i + 1] = data[i + 2] = value;
      }
      ctx.putImageData(tempImageData, 0, 0);

      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), 'image/png');
      });

      const result = await workerRef.current.recognize(blob);
      const xpValue = parseXpFromText(result.data.text);
      
      return xpValue;
    } catch (error) {
      console.error('OCR recognition error:', error);
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, [isInitialized]);

  const terminateWorker = useCallback(async () => {
    if (workerRef.current) {
      await workerRef.current.terminate();
      workerRef.current = null;
      setIsInitialized(false);
    }
  }, []);

  return {
    isInitialized,
    isProcessing,
    initWorker,
    recognizeXp,
    terminateWorker,
  };
};
