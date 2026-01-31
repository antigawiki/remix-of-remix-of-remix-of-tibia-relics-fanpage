import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { useTranslation } from '@/i18n';

interface BreadcrumbItem {
  label: string;
  path?: string;
}

const Breadcrumb = () => {
  const location = useLocation();
  const pathSegments = location.pathname.split('/').filter(Boolean);
  const { t } = useTranslation();

  // Route labels mapping using translations
  const getRouteLabel = (path: string): string => {
    const routeMap: Record<string, string> = {
      '/equipment': t('navigation.equipment'),
      '/items': t('navigation.items'),
      '/spells': t('navigation.spells'),
      '/creatures': t('navigation.creatures'),
      '/quests': t('navigation.quests'),
      '/calculators': t('navigation.calculators'),
      '/info': t('navigation.info'),
      '/highscores': t('navigation.ranking'),
      '/online': t('navigation.online'),
      '/death-row': t('navigation.banned'),
      '/top-gainers': t('navigation.topGainers'),
      '/admin': 'Admin',
    };
    return routeMap[path] || path;
  };

  // Sub-route labels mapping using translations
  const getSubRouteLabel = (parent: string, segment: string): string => {
    const subRouteMap: Record<string, Record<string, string>> = {
      equipment: {
        helmets: t('equipment.helmets'),
        armors: t('equipment.armors'),
        legs: t('equipment.legs'),
        boots: t('equipment.boots'),
        shields: t('equipment.shields'),
        swords: t('equipment.swords'),
        axes: t('equipment.axes'),
        clubs: t('equipment.clubs'),
        distance: t('equipment.distance'),
        ammo: t('equipment.ammo'),
      },
      items: {
        amulets: t('items.amulets'),
        rings: t('items.rings'),
        backpacks: t('items.backpacks'),
        foods: t('items.foods'),
        valuables: t('items.valuables'),
      },
      spells: {
        sorcerer: t('spells.sorcerer'),
        druid: t('spells.druid'),
        paladin: t('spells.paladin'),
        knight: t('spells.knight'),
      },
      calculators: {
        'heal-damage': t('calculators.healDamage'),
        'physical-damage': t('calculators.physicalDamage'),
        'death-experience': t('calculators.deathExperience'),
        'experience-level': t('calculators.experienceLevel'),
        'magic-level': t('calculators.magicLevel'),
        'skills': t('calculators.skills'),
        'stats': t('calculators.stats'),
        'loot': t('calculators.loot'),
      },
    };
    return subRouteMap[parent]?.[segment] || segment;
  };

  // Don't show breadcrumb on home
  if (pathSegments.length === 0) {
    return null;
  }

  const breadcrumbs: BreadcrumbItem[] = [
    { label: t('breadcrumb.home'), path: '/' },
  ];

  let currentPath = '';
  
  pathSegments.forEach((segment, index) => {
    currentPath += `/${segment}`;
    
    // First segment - main route
    if (index === 0) {
      const label = getRouteLabel(currentPath);
      breadcrumbs.push({
        label,
        path: index < pathSegments.length - 1 ? currentPath : undefined,
      });
    } 
    // Second segment - subcategory
    else if (index === 1) {
      const parentSegment = pathSegments[0];
      const label = getSubRouteLabel(parentSegment, segment);
      breadcrumbs.push({
        label,
        path: undefined, // Last item has no link
      });
    }
  });

  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex items-center gap-1 text-sm text-muted-foreground flex-wrap">
        {breadcrumbs.map((item, index) => (
          <li key={index} className="flex items-center gap-1">
            {index > 0 && (
              <ChevronRight className="w-3 h-3 text-muted-foreground/50" />
            )}
            {item.path ? (
              <Link 
                to={item.path} 
                className="gold-link flex items-center gap-1 hover:text-gold transition-colors"
              >
                {index === 0 && <Home className="w-3 h-3" />}
                {item.label}
              </Link>
            ) : (
              <span className="text-foreground font-medium">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
};

export default Breadcrumb;
