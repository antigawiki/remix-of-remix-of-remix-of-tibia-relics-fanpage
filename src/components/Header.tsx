import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X, Users, Skull, Map } from 'lucide-react';
import headerBg from '@/assets/header-bg.jpg';

const Header = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="relative">
      {/* Header Background */}
      <div 
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${headerBg})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/20 to-background" />
      </div>

      {/* Content */}
      <div className="relative container py-6">
        {/* Top Bar */}
        <div className="flex items-center justify-between mb-4">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-12 h-12 rounded-full bg-maroon flex items-center justify-center border-2 border-gold shadow-lg">
              <span className="text-gold font-heading font-bold text-xl">TR</span>
            </div>
            <div>
              <h1 className="font-heading text-2xl md:text-3xl font-bold text-gold drop-shadow-lg">
                Tibia Relic
              </h1>
              <p className="text-xs text-muted-foreground">Fan Page • OT Server Wiki</p>
            </div>
          </Link>

          {/* Quick Links */}
          <div className="hidden md:flex items-center gap-4">
            <a 
              href="https://tibiarelic.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="retro-btn flex items-center gap-2"
            >
              <Users className="w-4 h-4" />
              Site Oficial
            </a>
            <Link to="/banned" className="retro-btn flex items-center gap-2">
              <Skull className="w-4 h-4" />
              Banidos
            </Link>
            <Link to="/map" className="retro-btn flex items-center gap-2">
              <Map className="w-4 h-4" />
              Mapa
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button 
            className="md:hidden retro-btn p-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <nav className="md:hidden wood-panel rounded-sm p-4 animate-fade-in">
            <div className="flex flex-col gap-2">
              <a 
                href="https://tibiarelic.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="sidebar-menu-item flex items-center gap-2"
              >
                <Users className="w-4 h-4" />
                Site Oficial
              </a>
              <Link to="/banned" className="sidebar-menu-item flex items-center gap-2">
                <Skull className="w-4 h-4" />
                Banidos
              </Link>
              <Link to="/map" className="sidebar-menu-item flex items-center gap-2">
                <Map className="w-4 h-4" />
                Mapa Completo
              </Link>
            </div>
          </nav>
        )}

        {/* Navigation Bar */}
        <nav className="hidden md:block wood-panel rounded-sm">
          <ul className="flex items-center justify-center divide-x divide-border/30">
            <li>
              <Link to="/" className="sidebar-menu-item px-6">Início</Link>
            </li>
            <li>
              <Link to="/equipment" className="sidebar-menu-item px-6">Equipamentos</Link>
            </li>
            <li>
              <Link to="/spells" className="sidebar-menu-item px-6">Magias</Link>
            </li>
            <li>
              <Link to="/creatures" className="sidebar-menu-item px-6">Criaturas</Link>
            </li>
            <li>
              <Link to="/quests" className="sidebar-menu-item px-6">Quests</Link>
            </li>
            <li>
              <Link to="/calculators" className="sidebar-menu-item px-6">Calculadoras</Link>
            </li>
            <li>
              <Link to="/info" className="sidebar-menu-item px-6">Informações</Link>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
};

export default Header;
