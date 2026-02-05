import { useState, useCallback, useRef, useEffect } from 'react';

export interface XpTrackerState {
  initialXp: number | null;
  currentXp: number | null;
  startTime: Date | null;
  xpGained: number;
  sessionDuration: number; // in seconds
  xpPerHour: number;
  lastUpdate: Date | null;
}

interface UseXpTrackerReturn {
  state: XpTrackerState;
  isTracking: boolean;
  startTracking: (initialXp?: number) => void;
  stopTracking: () => void;
  updateXp: (newXp: number) => void;
  resetTracking: () => void;
  formatDuration: (seconds: number) => string;
  formatXp: (xp: number) => string;
  getProjection: (hours: number) => number;
}

const initialState: XpTrackerState = {
  initialXp: null,
  currentXp: null,
  startTime: null,
  xpGained: 0,
  sessionDuration: 0,
  xpPerHour: 0,
  lastUpdate: null,
};

export const useXpTracker = (): UseXpTrackerReturn => {
  const [state, setState] = useState<XpTrackerState>(initialState);
  const [isTracking, setIsTracking] = useState(false);
  const timerRef = useRef<number | null>(null);

  // Update session duration every second
  useEffect(() => {
    if (isTracking && state.startTime) {
      timerRef.current = window.setInterval(() => {
        setState(prev => {
          if (!prev.startTime) return prev;
          
          const now = new Date();
          const durationMs = now.getTime() - prev.startTime.getTime();
          const durationSeconds = Math.floor(durationMs / 1000);
          
          // Calculate XP per hour
          let xpPerHour = 0;
          if (durationSeconds > 0 && prev.xpGained > 0) {
            xpPerHour = Math.round((prev.xpGained / durationSeconds) * 3600);
          }

          return {
            ...prev,
            sessionDuration: durationSeconds,
            xpPerHour,
          };
        });
      }, 1000);

      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      };
    }
  }, [isTracking, state.startTime]);

  const startTracking = useCallback((initialXp?: number) => {
    const now = new Date();
    setState({
      ...initialState,
      initialXp: initialXp ?? null,
      currentXp: initialXp ?? null,
      startTime: now,
      lastUpdate: initialXp ? now : null,
    });
    setIsTracking(true);
  }, []);

  const stopTracking = useCallback(() => {
    setIsTracking(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const updateXp = useCallback((newXp: number) => {
    if (!isTracking) return;

    setState(prev => {
      const now = new Date();
      
      // If this is the first XP reading, set it as initial
      if (prev.initialXp === null) {
        return {
          ...prev,
          initialXp: newXp,
          currentXp: newXp,
          lastUpdate: now,
        };
      }

      // Only update if XP increased (avoid OCR errors causing drops)
      if (newXp <= (prev.currentXp ?? 0)) {
        return prev;
      }

      const xpGained = newXp - prev.initialXp;
      const durationSeconds = prev.startTime 
        ? Math.floor((now.getTime() - prev.startTime.getTime()) / 1000)
        : 0;
      
      // Calculate XP per hour
      let xpPerHour = 0;
      if (durationSeconds > 0 && xpGained > 0) {
        xpPerHour = Math.round((xpGained / durationSeconds) * 3600);
      }

      return {
        ...prev,
        currentXp: newXp,
        xpGained,
        sessionDuration: durationSeconds,
        xpPerHour,
        lastUpdate: now,
      };
    });
  }, [isTracking]);

  const resetTracking = useCallback(() => {
    stopTracking();
    setState(initialState);
  }, [stopTracking]);

  const formatDuration = useCallback((seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${secs.toString().padStart(2, '0')}s`;
    }
    return `${secs}s`;
  }, []);

  const formatXp = useCallback((xp: number): string => {
    if (xp >= 1000000) {
      return `${(xp / 1000000).toFixed(2)}M`;
    }
    if (xp >= 1000) {
      return `${(xp / 1000).toFixed(1)}k`;
    }
    return xp.toLocaleString();
  }, []);

  const getProjection = useCallback((hours: number): number => {
    return Math.round(state.xpPerHour * hours);
  }, [state.xpPerHour]);

  return {
    state,
    isTracking,
    startTracking,
    stopTracking,
    updateXp,
    resetTracking,
    formatDuration,
    formatXp,
    getProjection,
  };
};
