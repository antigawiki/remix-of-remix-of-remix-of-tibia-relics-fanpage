import { Link } from 'react-router-dom';
import { 
  Shield, Sword, Wand2, Bug, Scroll, Calculator, 
  Info, Users, Trophy, Clock 
} from 'lucide-react';

interface SidebarProps {
  position: 'left' | 'right';
}

const Sidebar = ({ position }: SidebarProps) => {
  if (position === 'left') {
    return (
      <aside className="space-y-4">
        {/* Navigation Menu */}
        <div className="wood-panel rounded-sm overflow-hidden">
          <div className="maroon-header px-4 py-2">
            <span className="font-heading text-sm font-semibold">Navegação</span>
          </div>
          <nav className="divide-y divide-border/30">
            <Link to="/equipment" className="sidebar-menu-item flex items-center gap-2">
              <Shield className="w-4 h-4 text-gold" />
              Equipamentos
            </Link>
            <Link to="/spells" className="sidebar-menu-item flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-gold" />
              Magias
            </Link>
            <Link to="/creatures" className="sidebar-menu-item flex items-center gap-2">
              <Bug className="w-4 h-4 text-gold" />
              Criaturas
            </Link>
            <Link to="/quests" className="sidebar-menu-item flex items-center gap-2">
              <Scroll className="w-4 h-4 text-gold" />
              Quests
            </Link>
            <Link to="/calculators" className="sidebar-menu-item flex items-center gap-2">
              <Calculator className="w-4 h-4 text-gold" />
              Calculadoras
            </Link>
            <Link to="/info" className="sidebar-menu-item flex items-center gap-2">
              <Info className="w-4 h-4 text-gold" />
              Informações
            </Link>
          </nav>
        </div>

        {/* Quick Links */}
        <div className="wood-panel rounded-sm overflow-hidden">
          <div className="maroon-header px-4 py-2">
            <span className="font-heading text-sm font-semibold">Links Rápidos</span>
          </div>
          <nav className="divide-y divide-border/30">
            <Link to="/equipment/helmets" className="sidebar-menu-item text-xs">
              → Capacetes
            </Link>
            <Link to="/equipment/armors" className="sidebar-menu-item text-xs">
              → Armaduras
            </Link>
            <Link to="/equipment/weapons" className="sidebar-menu-item text-xs">
              → Armas
            </Link>
            <Link to="/spells/sorcerer" className="sidebar-menu-item text-xs">
              → Magias Sorcerer
            </Link>
            <Link to="/spells/druid" className="sidebar-menu-item text-xs">
              → Magias Druid
            </Link>
          </nav>
        </div>
      </aside>
    );
  }

  return (
    <aside className="space-y-4">
      {/* Server Status */}
      <div className="wood-panel rounded-sm overflow-hidden">
        <div className="maroon-header px-4 py-2 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="font-heading text-sm font-semibold">Server Status</span>
        </div>
        <div className="p-3 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Status:</span>
            <span className="text-green-400 font-semibold">Online</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Players:</span>
            <span className="text-gold font-semibold">--</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Uptime:</span>
            <span className="text-foreground">99.9%</span>
          </div>
        </div>
      </div>

      {/* Top Players */}
      <div className="wood-panel rounded-sm overflow-hidden">
        <div className="maroon-header px-4 py-2 flex items-center gap-2">
          <Trophy className="w-4 h-4" />
          <span className="font-heading text-sm font-semibold">Top 5 Players</span>
        </div>
        <div className="divide-y divide-border/30">
          {[1, 2, 3, 4, 5].map((rank) => (
            <div key={rank} className="px-3 py-2 flex items-center gap-2 text-sm">
              <span className={`font-bold ${rank === 1 ? 'text-gold' : rank === 2 ? 'text-gray-400' : rank === 3 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                #{rank}
              </span>
              <span className="text-foreground">Player Name</span>
              <span className="ml-auto text-muted-foreground text-xs">Lvl ???</span>
            </div>
          ))}
        </div>
        <a 
          href="https://tibiarelic.com" 
          target="_blank" 
          rel="noopener noreferrer"
          className="block px-3 py-2 text-xs text-center gold-link border-t border-border/30"
        >
          Ver ranking completo →
        </a>
      </div>

      {/* Recent Activity */}
      <div className="wood-panel rounded-sm overflow-hidden">
        <div className="maroon-header px-4 py-2 flex items-center gap-2">
          <Clock className="w-4 h-4" />
          <span className="font-heading text-sm font-semibold">Atualizações</span>
        </div>
        <div className="p-3 space-y-2 text-xs text-muted-foreground">
          <p>• Wiki sendo construída...</p>
          <p>• Novas informações em breve!</p>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
