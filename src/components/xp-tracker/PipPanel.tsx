import { useEffect, useRef } from 'react';
import { XpTrackerState } from '@/hooks/useXpTracker';
import {
  getLevelFromExperience,
  calculateExperienceForLevel,
  getLevelProgress,
} from '@/data/calculators/experienceLevel';

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

// Helper to format time remaining
const formatTimeRemaining = (hours: number): string => {
  if (hours <= 0 || !isFinite(hours)) return '--';
  const totalMinutes = Math.floor(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h > 0) {
    return `~${h}h ${m}m`;
  }
  return `~${m}m`;
};

// Helper to get estimated level up time
const getEstimatedTime = (hours: number): string => {
  if (hours <= 0 || !isFinite(hours)) return '--';
  const now = new Date();
  now.setMinutes(now.getMinutes() + Math.floor(hours * 60));
  return now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

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
          width: 380,
          height: 180,
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
            flex-direction: column;
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
            padding: 10px 14px;
            width: 100%;
            position: relative;
            z-index: 1;
          }
          .logo {
            width: 48px;
            height: 48px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1);
            border: 2px solid #8b7355;
            flex-shrink: 0;
          }
          .info {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 3px;
          }
          .xp-value {
            font-family: 'Cinzel', serif;
            font-size: 18px;
            font-weight: 600;
            color: #ffd700;
            text-shadow: 0 2px 4px rgba(0,0,0,0.5), 0 0 20px rgba(255,215,0,0.3);
            letter-spacing: 0.5px;
          }
          .stats-row {
            display: flex;
            align-items: center;
            gap: 10px;
          }
          .xp-gained {
            font-size: 13px;
            font-weight: 600;
            color: #4ade80;
            text-shadow: 0 0 8px rgba(74,222,128,0.4);
          }
          .xp-rate {
            font-size: 11px;
            color: #a78bfa;
            opacity: 0.9;
          }
          .time {
            font-size: 12px;
            color: #60a5fa;
            display: flex;
            align-items: center;
            gap: 4px;
          }
          .divider {
            width: 1px;
            height: 10px;
            background: rgba(255,255,255,0.2);
          }
          
          /* Level Section */
          .level-section {
            padding: 8px 14px 10px;
            border-top: 1px solid rgba(255,255,255,0.1);
            position: relative;
            z-index: 1;
          }
          .level-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 6px;
          }
          .level-label {
            font-family: 'Cinzel', serif;
            font-size: 14px;
            font-weight: 600;
            color: #ffd700;
            text-shadow: 0 1px 3px rgba(0,0,0,0.5);
          }
          .level-percent {
            font-size: 12px;
            color: #ffd700;
            opacity: 0.9;
          }
          .progress-bar {
            width: 100%;
            height: 8px;
            background: rgba(0,0,0,0.4);
            border-radius: 4px;
            overflow: hidden;
            border: 1px solid rgba(255,255,255,0.1);
            margin-bottom: 6px;
          }
          .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #ffd700 0%, #f59e0b 100%);
            border-radius: 3px;
            transition: width 0.3s ease;
            box-shadow: 0 0 10px rgba(255,215,0,0.4);
          }
          .level-stats {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 11px;
          }
          .xp-remaining {
            color: #ef4444;
          }
          .time-remaining {
            color: #60a5fa;
          }
          .level-up-time {
            color: #4ade80;
          }
          .stat-divider {
            color: rgba(255,255,255,0.3);
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

    // Calculate level info
    const currentXp = state.currentXp ?? 0;
    const currentLevel = currentXp > 0 ? getLevelFromExperience(currentXp) : 0;
    const nextLevelXp = currentLevel > 0 ? calculateExperienceForLevel(currentLevel + 1) : 0;
    const xpRemaining = nextLevelXp - currentXp;
    const progressPercent = currentXp > 0 ? getLevelProgress(currentXp) : 0;
    
    // Calculate time estimates
    const xpPerHour = state.xpPerHour;
    const hoursToLevel = xpPerHour > 0 ? xpRemaining / xpPerHour : 0;
    const timeRemaining = formatTimeRemaining(hoursToLevel);
    const estimatedTime = getEstimatedTime(hoursToLevel);

    // Build level section HTML
    const levelSectionHtml = currentXp > 0 ? `
      <div class="level-section">
        <div class="level-header">
          <span class="level-label">Level ${currentLevel}</span>
          <span class="level-percent">${progressPercent.toFixed(1)}%</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${progressPercent}%"></div>
        </div>
        <div class="level-stats">
          <span class="xp-remaining">Faltam: ${xpRemaining.toLocaleString('pt-BR')} XP</span>
          <span class="stat-divider">·</span>
          <span class="time-remaining">${timeRemaining}</span>
          <span class="stat-divider">·</span>
          <span class="level-up-time">Às ${estimatedTime}</span>
        </div>
      </div>
    ` : '';

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
      ${levelSectionHtml}
    `;
  }, [state, formatDuration, formatXp, isOpen]);

  return null;
};
