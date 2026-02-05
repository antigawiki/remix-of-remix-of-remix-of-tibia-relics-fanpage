import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X, Users, Skull, Map, Home, Shield, Sparkles, Bug, ScrollText, Calculator, Info, Search, Package, Trophy, TrendingUp } from 'lucide-react';
import headerBg from '@/assets/header-bg.jpg';
import mainLogo from '@/assets/main-logo.webp';
import GlobalSearch from '@/components/GlobalSearch';
import { useTranslation } from '@/i18n';
import { LanguageSelector } from './LanguageSelector';
import { ThemeToggle } from './ThemeToggle';

const Header = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { t } = useTranslation();

  // Keyboard shortcut for search
  useState(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  });

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
            <img 
              src={mainLogo} 
              alt="Tibia Relic Logo" 
              className="h-16 md:h-20 w-auto drop-shadow-lg"
              loading="eager"
              fetchPriority="high"
              decoding="sync"
            />
            <div className="hidden sm:block">
              <h1 className="font-heading text-2xl md:text-3xl font-bold text-gold drop-shadow-lg">
                Tibia Relic
              </h1>
              <p className="text-sm text-gold/80 font-medium">Fansite Wiki</p>
            </div>
          </Link>

          {/* Quick Links */}
          <div className="hidden md:flex items-center gap-4">
            {/* Search Button */}
            <button
              onClick={() => setSearchOpen(true)}
              className="retro-btn flex items-center gap-2"
            >
              <Search className="w-4 h-4" />
              <span>{t('common.search')}</span>
              <kbd className="hidden lg:inline-flex h-5 items-center gap-1 rounded border border-border/50 bg-muted/50 px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                ⌘K
              </kbd>
            </button>
            <a 
              href="https://tibiarelic.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="retro-btn flex items-center gap-2"
            >
              <Users className="w-4 h-4" />
              {t('navigation.officialSite')}
            </a>
            <Link to="/death-row" className="retro-btn flex items-center gap-2">
              <Skull className="w-4 h-4" />
              {t('navigation.banned')}
            </Link>
            <a 
              href="https://opentibia.info/library/map" 
              target="_blank" 
              rel="noopener noreferrer"
              className="retro-btn flex items-center gap-2"
            >
              <Map className="w-4 h-4" />
              {t('navigation.map')}
            </a>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex items-center gap-2 md:hidden">
            <button
              onClick={() => setSearchOpen(true)}
              className="retro-btn p-2"
            >
              <Search className="w-5 h-5" />
            </button>
            <button 
              className="retro-btn p-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <nav className="md:hidden wood-panel rounded-sm p-4 animate-fade-in">
            <div className="flex flex-col gap-2">
              {/* Main Navigation */}
              <Link to="/" className="sidebar-menu-item flex items-center gap-2" onClick={() => setMobileMenuOpen(false)}>
                <Home className="w-4 h-4" />
                {t('navigation.home')}
              </Link>
              <Link to="/equipment" className="sidebar-menu-item flex items-center gap-2" onClick={() => setMobileMenuOpen(false)}>
                <Shield className="w-4 h-4" />
                {t('navigation.equipment')}
              </Link>
              <Link to="/items" className="sidebar-menu-item flex items-center gap-2" onClick={() => setMobileMenuOpen(false)}>
                <Package className="w-4 h-4" />
                {t('navigation.items')}
              </Link>
              <Link to="/spells" className="sidebar-menu-item flex items-center gap-2" onClick={() => setMobileMenuOpen(false)}>
                <Sparkles className="w-4 h-4" />
                {t('navigation.spells')}
              </Link>
              <Link to="/creatures" className="sidebar-menu-item flex items-center gap-2" onClick={() => setMobileMenuOpen(false)}>
                <Bug className="w-4 h-4" />
                {t('navigation.creatures')}
              </Link>
              <Link to="/runes" className="sidebar-menu-item flex items-center gap-2" onClick={() => setMobileMenuOpen(false)}>
                <Sparkles className="w-4 h-4" />
                {t('pages.runes.title')}
              </Link>
              <Link to="/quests" className="sidebar-menu-item flex items-center gap-2" onClick={() => setMobileMenuOpen(false)}>
                <ScrollText className="w-4 h-4" />
                {t('navigation.quests')}
              </Link>
              <Link to="/calculators" className="sidebar-menu-item flex items-center gap-2" onClick={() => setMobileMenuOpen(false)}>
                <Calculator className="w-4 h-4" />
                {t('navigation.calculators')}
              </Link>
              <Link to="/info" className="sidebar-menu-item flex items-center gap-2" onClick={() => setMobileMenuOpen(false)}>
                <Info className="w-4 h-4" />
                {t('navigation.info')}
              </Link>
              
              <div className="border-t border-border/30 my-2" />
              
              {/* Player Stats Links */}
              <Link to="/highscores" className="sidebar-menu-item flex items-center gap-2" onClick={() => setMobileMenuOpen(false)}>
                <Trophy className="w-4 h-4" />
                {t('navigation.ranking')}
              </Link>
              <Link to="/top-gainers" className="sidebar-menu-item flex items-center gap-2" onClick={() => setMobileMenuOpen(false)}>
                <TrendingUp className="w-4 h-4" />
                {t('navigation.topGainers')}
              </Link>
              <Link to="/online" className="sidebar-menu-item flex items-center gap-2" onClick={() => setMobileMenuOpen(false)}>
                <Users className="w-4 h-4" />
                {t('navigation.online')}
              </Link>
              
              <div className="border-t border-border/30 my-2" />
              
              {/* Quick Links */}
              <a 
                href="https://tibiarelic.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="sidebar-menu-item flex items-center gap-2"
              >
                <Users className="w-4 h-4" />
                {t('navigation.officialSite')}
              </a>
              <Link to="/death-row" className="sidebar-menu-item flex items-center gap-2" onClick={() => setMobileMenuOpen(false)}>
                <Skull className="w-4 h-4" />
                {t('navigation.banned')}
              </Link>
              <a 
                href="https://opentibia.info/library/map" 
                target="_blank" 
                rel="noopener noreferrer"
                className="sidebar-menu-item flex items-center gap-2"
              >
                <Map className="w-4 h-4" />
                {t('navigation.map')}
              </a>
            </div>
          </nav>
        )}

        {/* Navigation Bar */}
        <nav className="hidden md:block wood-panel rounded-sm">
          <ul className="flex items-center justify-center divide-x divide-border/30">
            <li>
              <Link to="/" className="sidebar-menu-item px-6">{t('navigation.home')}</Link>
            </li>
            <li>
              <Link to="/equipment" className="sidebar-menu-item px-6">{t('navigation.equipment')}</Link>
            </li>
            <li>
              <Link to="/spells" className="sidebar-menu-item px-6">{t('navigation.spells')}</Link>
            </li>
            <li>
              <Link to="/creatures" className="sidebar-menu-item px-6">{t('navigation.creatures')}</Link>
            </li>
            <li>
              <Link to="/quests" className="sidebar-menu-item px-6">{t('navigation.quests')}</Link>
            </li>
            <li>
              <Link to="/calculators" className="sidebar-menu-item px-6">{t('navigation.calculators')}</Link>
            </li>
            <li>
              <Link to="/info" className="sidebar-menu-item px-6">{t('navigation.info')}</Link>
            </li>
            <li className="flex items-center gap-1 px-3">
              <LanguageSelector />
              <ThemeToggle />
            </li>
          </ul>
        </nav>
      </div>

      {/* Global Search Dialog */}
      <GlobalSearch isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </header>
  );
};

export default Header;
