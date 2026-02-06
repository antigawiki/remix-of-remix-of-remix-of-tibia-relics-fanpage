import { Clock, TrendingUp, Target, Zap } from 'lucide-react';
import { XpTrackerState } from '@/hooks/useXpTracker';
import { useTranslation } from '@/i18n';

interface XpDashboardProps {
  state: XpTrackerState;
  formatDuration: (seconds: number) => string;
  formatXp: (xp: number) => string;
  getProjection: (hours: number) => number;
  isPaused?: boolean;
}

export const XpDashboard = ({ 
  state, 
  formatDuration, 
  formatXp, 
  getProjection,
  isPaused = false
}: XpDashboardProps) => {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Current XP */}
      <div className="wood-panel p-4 rounded-sm">
        <div className="flex items-center gap-2 mb-2">
          <Zap className="w-5 h-5 text-gold" />
          <span className="text-sm text-muted-foreground">{t('xpTracker.currentXp')}</span>
        </div>
        <p className="text-2xl font-bold text-gold">
          {state.currentXp !== null ? state.currentXp.toLocaleString() : '--'}
        </p>
      </div>

      {/* XP Gained */}
      <div className="wood-panel p-4 rounded-sm">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="w-5 h-5 text-accent" />
          <span className="text-sm text-muted-foreground">{t('xpTracker.xpGained')}</span>
        </div>
        <p className="text-2xl font-bold text-accent">
          +{formatXp(state.xpGained)}
        </p>
      </div>

      {/* Session Time */}
      <div className="wood-panel p-4 rounded-sm">
        <div className="flex items-center gap-2 mb-2">
          <Clock className="w-5 h-5 text-blue-400" />
          <span className="text-sm text-muted-foreground">
            {t('xpTracker.sessionTime')}
            {isPaused && <span className="ml-2 text-yellow-500 text-xs">(Pausado)</span>}
          </span>
        </div>
        <p className="text-2xl font-bold text-blue-400">
          {formatDuration(state.sessionDuration)}
        </p>
      </div>

      {/* XP per Hour */}
      <div className="wood-panel p-4 rounded-sm">
        <div className="flex items-center gap-2 mb-2">
          <Target className="w-5 h-5 text-purple-400" />
          <span className="text-sm text-muted-foreground">{t('xpTracker.xpPerHour')}</span>
        </div>
        <p className="text-2xl font-bold text-purple-400">
          {formatXp(state.xpPerHour)}/h
        </p>
      </div>

      {/* Projections */}
      <div className="col-span-2 lg:col-span-4 wood-panel p-4 rounded-sm">
        <div className="flex items-center gap-2 mb-3">
          <Target className="w-5 h-5 text-gold" />
          <span className="font-semibold">{t('xpTracker.projection')}</span>
        </div>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xs text-muted-foreground mb-1">1 {t('xpTracker.hour')}</p>
            <p className="text-lg font-bold text-foreground">+{formatXp(getProjection(1))}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">2 {t('xpTracker.hours')}</p>
            <p className="text-lg font-bold text-foreground">+{formatXp(getProjection(2))}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">4 {t('xpTracker.hours')}</p>
            <p className="text-lg font-bold text-foreground">+{formatXp(getProjection(4))}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
