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
// The Tibia Skills window shows: "Experience    156,507"
const parseXpFromText = (text: string): number | null => {
  console.log('OCR Raw Text:', text);
  
  // Normalize text - keep only relevant characters
  const normalizedText = text
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  console.log('OCR Normalized:', normalizedText);
  
  // STRICT pattern: Must have "Experience" (or similar) followed by the number
  // The number in Tibia uses comma as thousand separator: 156,507
  const strictPatterns = [
    // Match "Experience" followed by number with comma separators
    /experience\s+(\d{1,3}(?:,\d{3})*)/i,
    // Match "Experience" followed by number with dot separators (some locales)
    /experience\s+(\d{1,3}(?:\.\d{3})*)/i,
    // Match "Experience" followed by plain number
    /experience\s+(\d+)/i,
  ];

  for (const pattern of strictPatterns) {
    const match = normalizedText.match(pattern);
    if (match && match[1]) {
      // Clean the number - remove commas and dots used as thousand separators
      const cleanNumber = match[1].replace(/[,.]/g, '');
      
      const parsed = parseInt(cleanNumber, 10);
      console.log('OCR Parsed XP:', parsed, 'from match:', match[1]);
      
      // Validate: XP should be reasonable (between 0 and 10 billion)
      if (!isNaN(parsed) && parsed > 0 && parsed < 10_000_000_000) {
        return parsed;
      }
    }
  }

  console.log('OCR: No valid Experience value found');
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
        logger: (m) => console.log('Tesseract:', m),
      });
      
      // No special parameters needed - default settings work well
      // The key is in the preprocessing of the image

      workerRef.current = worker;
      setIsInitialized(true);
      console.log('OCR Worker initialized successfully');
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
