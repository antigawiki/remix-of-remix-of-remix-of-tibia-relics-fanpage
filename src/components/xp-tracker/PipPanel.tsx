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
          width: 340,
          height: 120,
        });

        pipWindowRef.current = pipWindow;

        // Add styles to the PiP window
        const style = pipWindow.document.createElement('style');
        style.textContent = `
          @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600&display=swap');
          
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: 'Segoe UI', system-ui, sans-serif;
            background: linear-gradient(135deg, #1a1512 0%, #2d241e 50%, #1a1512 100%);
            color: #fff;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 2px solid #5c4a3a;
            border-radius: 4px;
            overflow: hidden;
          }
          body::before {
            content: '';
            position: absolute;
            inset: 0;
            background: url("data:image/svg+xml,%3Csvg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.05'/%3E%3C/svg%3E");
            pointer-events: none;
          }
          .pip-container {
            display: flex;
            align-items: center;
            gap: 16px;
            padding: 12px 16px;
            width: 100%;
            position: relative;
            z-index: 1;
          }
          .logo {
            width: 52px;
            height: 52px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1);
            border: 2px solid #8b7355;
            flex-shrink: 0;
          }
          .info {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 4px;
          }
          .xp-value {
            font-family: 'Cinzel', serif;
            font-size: 20px;
            font-weight: 600;
            color: #ffd700;
            text-shadow: 0 2px 4px rgba(0,0,0,0.5), 0 0 20px rgba(255,215,0,0.3);
            letter-spacing: 0.5px;
          }
          .stats-row {
            display: flex;
            align-items: center;
            gap: 12px;
          }
          .xp-gained {
            font-size: 14px;
            font-weight: 600;
            color: #4ade80;
            text-shadow: 0 0 8px rgba(74,222,128,0.4);
          }
          .xp-rate {
            font-size: 12px;
            color: #a78bfa;
            opacity: 0.9;
          }
          .time {
            font-size: 13px;
            color: #60a5fa;
            display: flex;
            align-items: center;
            gap: 5px;
          }
          .divider {
            width: 1px;
            height: 12px;
            background: rgba(255,255,255,0.2);
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
      <div class="pip-container">
        <img src="https://tibiarelic.wiki/assets/main-logo-CQBu3bAW.webp" alt="Tibia Relic" class="logo" />
        <div class="info">
          <div class="xp-value">XP: ${state.currentXp !== null ? state.currentXp.toLocaleString() : '--'}</div>
          <div class="stats-row">
            <span class="xp-gained">+${formatXp(state.xpGained)}</span>
            <span class="xp-rate">${formatXp(state.xpPerHour)}/h</span>
            <span class="divider"></span>
            <span class="time">⏱ ${formatDuration(state.sessionDuration)}</span>
          </div>
        </div>
      </div>
    `;
  }, [state, formatDuration, formatXp, isOpen]);

  return null;
};
