import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  path?: string;
}

// Mapeamento de rotas para labels em português
const routeLabels: Record<string, string> = {
  '/equipment': 'Equipamentos',
  '/items': 'Itens',
  '/spells': 'Magias',
  '/creatures': 'Criaturas',
  '/quests': 'Quests',
  '/calculators': 'Calculadoras',
  '/info': 'Informações',
  '/highscores': 'Ranking',
  '/online': 'Players Online',
  '/death-row': 'Banidos',
  '/top-gainers': 'Top Gainers',
  '/admin': 'Admin',
};

// Mapeamento de subcategorias
const subRouteLabels: Record<string, Record<string, string>> = {
  equipment: {
    helmets: 'Capacetes',
    armors: 'Armaduras',
    legs: 'Pernas',
    boots: 'Botas',
    shields: 'Escudos',
    swords: 'Espadas',
    axes: 'Machados',
    clubs: 'Clavas',
    distance: 'Distância',
    ammo: 'Munição',
  },
  items: {
    amulets: 'Amuletos',
    rings: 'Anéis',
    backpacks: 'Mochilas',
    foods: 'Comidas',
    valuables: 'Valiosos',
  },
  spells: {
    sorcerer: 'Sorcerer',
    druid: 'Druid',
    paladin: 'Paladin',
    knight: 'Knight',
  },
  calculators: {
    'heal-damage': 'Dano de Cura',
    'physical-damage': 'Dano Físico',
    'death-experience': 'Experiência de Morte',
    'experience-level': 'Experiência/Level',
    'magic-level': 'Magic Level',
    'skills': 'Skills',
    'stats': 'Stats',
    'loot': 'Loot',
  },
};

const Breadcrumb = () => {
  const location = useLocation();
  const pathSegments = location.pathname.split('/').filter(Boolean);

  // Não mostrar breadcrumb na home
  if (pathSegments.length === 0) {
    return null;
  }

  const breadcrumbs: BreadcrumbItem[] = [
    { label: 'Início', path: '/' },
  ];

  let currentPath = '';
  
  pathSegments.forEach((segment, index) => {
    currentPath += `/${segment}`;
    
    // Primeiro segmento - rota principal
    if (index === 0) {
      const label = routeLabels[currentPath] || segment;
      breadcrumbs.push({
        label,
        path: index < pathSegments.length - 1 ? currentPath : undefined,
      });
    } 
    // Segundo segmento - subcategoria
    else if (index === 1) {
      const parentSegment = pathSegments[0];
      const subLabels = subRouteLabels[parentSegment];
      const label = subLabels?.[segment] || segment;
      breadcrumbs.push({
        label,
        path: undefined, // Último item não tem link
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
