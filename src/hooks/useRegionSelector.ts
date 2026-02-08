import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'xp-tracker-region';

export interface Region {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface UseRegionSelectorReturn {
  region: Region | null;
  isSelecting: boolean;
  hasSavedRegion: boolean;
  startSelection: () => void;
  cancelSelection: () => void;
  saveRegion: (region: Region) => void;
  clearRegion: () => void;
}

export const useRegionSelector = (): UseRegionSelectorReturn => {
  const [region, setRegion] = useState<Region | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [hasSavedRegion, setHasSavedRegion] = useState(false);

  // Load saved region from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Region;
        if (parsed.width > 0 && parsed.height > 0) {
          setRegion(parsed);
          setHasSavedRegion(true);
        }
      }
    } catch (e) {
      console.error('Failed to load saved region:', e);
    }
  }, []);

  const startSelection = useCallback(() => {
    setIsSelecting(true);
  }, []);

  const cancelSelection = useCallback(() => {
    setIsSelecting(false);
  }, []);

  const saveRegion = useCallback((newRegion: Region) => {
    // Ensure minimum size
    if (newRegion.width < 50 || newRegion.height < 20) {
      console.warn('Region too small, ignoring');
      return;
    }

    setRegion(newRegion);
    setHasSavedRegion(true);
    setIsSelecting(false);

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newRegion));
    } catch (e) {
      console.error('Failed to save region:', e);
    }
  }, []);

  const clearRegion = useCallback(() => {
    setRegion(null);
    setHasSavedRegion(false);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.error('Failed to clear region:', e);
    }
  }, []);

  return {
    region,
    isSelecting,
    hasSavedRegion,
    startSelection,
    cancelSelection,
    saveRegion,
    clearRegion,
  };
};
