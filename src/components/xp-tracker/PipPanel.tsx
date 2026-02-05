import { useEffect, useRef } from 'react';
import { XpTrackerState } from '@/hooks/useXpTracker';

interface PipPanelProps {
  state: XpTrackerState;
  formatDuration: (seconds: number) => string;
  formatXp: (xp: number) => string;
  isOpen: boolean;
  onClose: () => void;
}

// TypeScript declarations for Document Picture-in-Picture API
declare global {
  interface Window {
    documentPictureInPicture?: {
      requestWindow: (options?: { width?: number; height?: number }) => Promise<Window>;
    };
  }
}

export const PipPanel = ({ 
  state, 
  formatDuration, 
  formatXp, 
  isOpen, 
  onClose 
}: PipPanelProps) => {
  const pipWindowRef = useRef<Window | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let pipWindow: Window | null = null;

    const openPip = async () => {
      if (!window.documentPictureInPicture) {
        console.warn('Document Picture-in-Picture API is not supported');
        onClose();
        return;
      }

      try {
        pipWindow = await window.documentPictureInPicture.requestWindow({
          width: 320,
          height: 140,
        });

        pipWindowRef.current = pipWindow;

        // Add styles to the PiP window
        const style = pipWindow.document.createElement('style');
        style.textContent = `
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: 'Segoe UI', system-ui, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            color: #fff;
            padding: 12px 16px;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            justify-content: center;
          }
          .xp-value {
            font-size: 24px;
            font-weight: bold;
            color: #ffd700;
            margin-bottom: 6px;
          }
          .xp-gained {
            font-size: 16px;
            color: #4ade80;
            margin-bottom: 4px;
          }
          .xp-rate {
            font-size: 12px;
            color: #a78bfa;
            display: inline;
            margin-left: 8px;
          }
          .time {
            font-size: 14px;
            color: #60a5fa;
            display: flex;
            align-items: center;
            gap: 6px;
          }
          .time-icon {
            font-size: 12px;
          }
        `;
        pipWindow.document.head.appendChild(style);

        // Create container
        const container = pipWindow.document.createElement('div');
        container.id = 'xp-tracker-pip';
        pipWindow.document.body.appendChild(container);
        containerRef.current = container;

        // Handle PiP window close
        pipWindow.addEventListener('pagehide', () => {
          pipWindowRef.current = null;
          containerRef.current = null;
          onClose();
        });

      } catch (error) {
        console.error('Failed to open Picture-in-Picture:', error);
        onClose();
      }
    };

    if (isOpen) {
      openPip();
    } else {
      if (pipWindowRef.current) {
        pipWindowRef.current.close();
        pipWindowRef.current = null;
        containerRef.current = null;
      }
    }

    return () => {
      if (pipWindowRef.current) {
        pipWindowRef.current.close();
        pipWindowRef.current = null;
        containerRef.current = null;
      }
    };
  }, [isOpen]); // Remove onClose from dependencies to prevent re-running

  // Update PiP content when state changes
  useEffect(() => {
    if (!containerRef.current || !isOpen) return;

    containerRef.current.innerHTML = `
      <div class="xp-value">XP: ${state.currentXp !== null ? state.currentXp.toLocaleString() : '--'}</div>
      <div class="xp-gained">
        +${formatXp(state.xpGained)}
        <span class="xp-rate">(${formatXp(state.xpPerHour)}/h)</span>
      </div>
      <div class="time">
        <span class="time-icon">⏱</span>
        ${formatDuration(state.sessionDuration)}
      </div>
    `;
  }, [state, formatDuration, formatXp, isOpen]);

  return null;
};
