import { Link } from 'react-router-dom';
import { 
  Shield, Wand2, Bug, Scroll, Calculator, 
  Info, Trophy, Clock, Package, Users, Skull, TrendingUp, Sparkles, Monitor
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR, enUS, es, pl } from 'date-fns/locale';
import { useServerStats } from '@/hooks/useServerStats';
import { useTopPlayers } from '@/hooks/useHighscores';
import { useBans } from '@/hooks/useBans';
import { Skeleton } from '@/components/ui/skeleton';
import PlayerLink from '@/components/PlayerLink';
import { useTranslation } from '@/i18n';

const localeMap = {
  pt: ptBR,
  en: enUS,
  es: es,
  pl: pl,
};

interface SidebarProps {
  position: 'left' | 'right';
}

const Sidebar = ({ position }: SidebarProps) => {
  const { t, language } = useTranslation();

  if (position === 'left') {
    return (
      <aside className="space-y-4">
        {/* Navigation Menu */}
        <div className="wood-panel rounded-sm overflow-hidden">
          <div className="maroon-header px-4 py-2">
            <span className="font-heading text-sm font-semibold">{t('sidebar.navigation')}</span>
          </div>
          <nav className="divide-y divide-border/30">
            <Link to="/equipment" className="sidebar-menu-item flex items-center gap-2">
              <Shield className="w-4 h-4 text-gold" />
              {t('navigation.equipment')}
            </Link>
            <Link to="/items" className="sidebar-menu-item flex items-center gap-2">
              <Package className="w-4 h-4 text-gold" />
              {t('navigation.items')}
            </Link>
            <Link to="/spells" className="sidebar-menu-item flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-gold" />
              {t('navigation.spells')}
            </Link>
            <Link to="/creatures" className="sidebar-menu-item flex items-center gap-2">
              <Bug className="w-4 h-4 text-gold" />
              {t('navigation.creatures')}
            </Link>
            <Link to="/runes" className="sidebar-menu-item flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-gold" />
              {t('pages.runes.title')}
            </Link>
            <Link to="/quests" className="sidebar-menu-item flex items-center gap-2">
              <Scroll className="w-4 h-4 text-gold" />
              {t('navigation.quests')}
            </Link>
            <Link to="/calculators" className="sidebar-menu-item flex items-center gap-2">
              <Calculator className="w-4 h-4 text-gold" />
              {t('navigation.calculators')}
            </Link>
            <Link to="/xp-tracker" className="sidebar-menu-item flex items-center gap-2">
              <Monitor className="w-4 h-4 text-gold" />
              {t('xpTracker.title')}
            </Link>
            <Link to="/highscores" className="sidebar-menu-item flex items-center gap-2">
              <Trophy className="w-4 h-4 text-gold" />
              {t('navigation.ranking')}
            </Link>
            <Link to="/top-gainers" className="sidebar-menu-item flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-gold" />
              {t('navigation.topGainers')}
            </Link>
            <Link to="/online" className="sidebar-menu-item flex items-center gap-2">
              <Users className="w-4 h-4 text-gold" />
              {t('navigation.online')}
            </Link>
            <Link to="/death-row" className="sidebar-menu-item flex items-center gap-2">
              <Skull className="w-4 h-4 text-gold" />
              {t('navigation.banned')}
            </Link>
            <Link to="/info" className="sidebar-menu-item flex items-center gap-2">
              <Info className="w-4 h-4 text-gold" />
              {t('navigation.info')}
            </Link>
          </nav>
        </div>

        {/* Quick Links */}
        <div className="wood-panel rounded-sm overflow-hidden">
          <div className="maroon-header px-4 py-2">
            <span className="font-heading text-sm font-semibold">{t('sidebar.quickLinks')}</span>
          </div>
          <nav className="divide-y divide-border/30">
            <Link to="/equipment/helmets" className="sidebar-menu-item text-xs">
              → {t('equipment.helmets')}
            </Link>
            <Link to="/equipment/armors" className="sidebar-menu-item text-xs">
              → {t('equipment.armors')}
            </Link>
            <Link to="/equipment/swords" className="sidebar-menu-item text-xs">
              → {t('equipment.swords')}
            </Link>
            <Link to="/spells/sorcerer" className="sidebar-menu-item text-xs">
              → {t('spells.sorcerer')}
            </Link>
            <Link to="/spells/druid" className="sidebar-menu-item text-xs">
              → {t('spells.druid')}
            </Link>
          </nav>
        </div>
      </aside>
    );
  }

  return <RightSidebar />;
};

const RightSidebar = () => {
  const { t, language } = useTranslation();
  const { data: stats, isLoading: statsLoading, isError: statsError } = useServerStats();
  const { data: topPlayersData, isLoading: topLoading } = useTopPlayers(5);
  const { data: bans } = useBans();

  const getServerSaveCountdown = () => {
    if (!stats?.nextServerSave) return '--';
    try {
      return formatDistanceToNow(new Date(stats.nextServerSave), { 
        locale: localeMap[language],
        addSuffix: false 
      });
    } catch {
      return '--';
    }
  };

  const getRankColor = (rank: number) => {
    if (rank === 1) return 'text-gold';
    if (rank === 2) return 'text-gray-400';
    if (rank === 3) return 'text-amber-600';
    return 'text-muted-foreground';
  };

  return (
    <aside className="space-y-4">
      {/* Server Status */}
      <div className="wood-panel rounded-sm overflow-hidden">
        <div className="maroon-header px-4 py-2 flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${statsError ? 'bg-red-500' : 'bg-green-500'} animate-pulse`} />
          <span className="font-heading text-sm font-semibold">{t('sidebar.serverStatus')}</span>
        </div>
        <div className="p-3 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t('sidebar.status')}:</span>
            {statsLoading ? (
              <Skeleton className="h-4 w-12" />
            ) : (
              <span className={statsError ? 'text-red-400 font-semibold' : 'text-green-400 font-semibold'}>
                {statsError ? t('sidebar.offline') : t('sidebar.online')}
              </span>
            )}
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t('sidebar.players')}:</span>
            {statsLoading ? (
              <Skeleton className="h-4 w-20" />
            ) : (
              <span className="text-gold font-semibold">
                {stats?.playersOnline ?? 0}
                <span className="text-muted-foreground font-normal text-xs ml-1">
                  ({t('sidebar.record')}: {stats?.recordOnline ?? 0})
                </span>
              </span>
            )}
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t('sidebar.nextSS')}:</span>
            {statsLoading ? (
              <Skeleton className="h-4 w-16" />
            ) : (
              <span className="text-foreground">{t('sidebar.in')} {getServerSaveCountdown()}</span>
            )}
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t('sidebar.bannedCount')}:</span>
            <Link to="/death-row" className="text-destructive font-semibold hover:underline">
              {bans?.length ?? 0}
            </Link>
          </div>
        </div>
      </div>

      {/* Top Players */}
      <div className="wood-panel rounded-sm overflow-hidden">
        <div className="maroon-header px-4 py-2 flex items-center gap-2">
          <Trophy className="w-4 h-4" />
          <span className="font-heading text-sm font-semibold">{t('sidebar.topPlayers')}</span>
        </div>
        <div className="divide-y divide-border/30">
          {topLoading ? (
            [...Array(5)].map((_, i) => (
              <div key={i} className="px-3 py-2">
                <Skeleton className="h-4 w-full" />
              </div>
            ))
          ) : topPlayersData?.highscores.length ? (
            topPlayersData.highscores.map((player, index) => (
              <div key={player.name} className="px-3 py-2 flex items-center gap-2 text-sm">
                <span className={`font-bold ${getRankColor(index + 1)}`}>
                  #{index + 1}
                </span>
                <PlayerLink name={player.name} className="text-foreground truncate flex-1" />
                <span className="text-muted-foreground text-xs">Lvl {player.level}</span>
              </div>
            ))
          ) : (
            <div className="px-3 py-4 text-xs text-center text-muted-foreground">
              {t('sidebar.noPlayersFound')}
            </div>
          )}
        </div>
        <Link 
          to="/highscores"
          className="block px-3 py-2 text-xs text-center gold-link border-t border-border/30"
        >
          {t('sidebar.viewFullRanking')} →
        </Link>
      </div>

      {/* Recent Activity */}
      <div className="wood-panel rounded-sm overflow-hidden">
        <div className="maroon-header px-4 py-2 flex items-center gap-2">
          <Clock className="w-4 h-4" />
          <span className="font-heading text-sm font-semibold">{t('sidebar.updates')}</span>
        </div>
        <div className="p-3 space-y-2 text-xs text-muted-foreground">
          <p>• {t('news.wikiConstructionTitle')}...</p>
          <p>• {t('news.wikiConstructionContent2')}</p>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
