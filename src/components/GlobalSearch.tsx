import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Shield, Wand2, Bug, Package, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

// Import data
import { helmets } from '@/data/equipment/helmets';
import { armors } from '@/data/equipment/armors';
import { legs } from '@/data/equipment/legs';
import { boots } from '@/data/equipment/boots';
import { shields } from '@/data/equipment/shields';
import { swords } from '@/data/equipment/swords';
import { axes } from '@/data/equipment/axes';
import { clubs } from '@/data/equipment/clubs';
import { distance } from '@/data/equipment/distance';
import { ammo } from '@/data/equipment/ammo';
import { sorcererSpells, druidSpells, paladinSpells, knightSpells } from '@/data/spells';
import { creatures } from '@/data/creatures';
import { foods, amulets, rings, valuables, backpacks } from '@/data/items';

interface SearchResult {
  name: string;
  image: string;
  category: 'equipment' | 'spell' | 'creature' | 'item';
  subcategory: string;
  path: string;
}

// Map equipment to searchable format
const equipmentData: SearchResult[] = [
  ...helmets.map(e => ({ name: e.name, image: e.image, category: 'equipment' as const, subcategory: 'Capacetes', path: '/equipment/helmets' })),
  ...armors.map(e => ({ name: e.name, image: e.image, category: 'equipment' as const, subcategory: 'Armaduras', path: '/equipment/armors' })),
  ...legs.map(e => ({ name: e.name, image: e.image, category: 'equipment' as const, subcategory: 'Pernas', path: '/equipment/legs' })),
  ...boots.map(e => ({ name: e.name, image: e.image, category: 'equipment' as const, subcategory: 'Botas', path: '/equipment/boots' })),
  ...shields.map(e => ({ name: e.name, image: e.image, category: 'equipment' as const, subcategory: 'Escudos', path: '/equipment/shields' })),
  ...swords.map(e => ({ name: e.name, image: e.image, category: 'equipment' as const, subcategory: 'Espadas', path: '/equipment/swords' })),
  ...axes.map(e => ({ name: e.name, image: e.image, category: 'equipment' as const, subcategory: 'Machados', path: '/equipment/axes' })),
  ...clubs.map(e => ({ name: e.name, image: e.image, category: 'equipment' as const, subcategory: 'Clavas', path: '/equipment/clubs' })),
  ...distance.map(e => ({ name: e.name, image: e.image, category: 'equipment' as const, subcategory: 'Distância', path: '/equipment/distance' })),
  ...ammo.map(e => ({ name: e.name, image: e.image, category: 'equipment' as const, subcategory: 'Munição', path: '/equipment/ammo' })),
];

// Map spells to searchable format
const spellData: SearchResult[] = [
  ...sorcererSpells.map(s => ({ name: s.name, image: s.image, category: 'spell' as const, subcategory: 'Sorcerer', path: '/spells/sorcerer' })),
  ...druidSpells.map(s => ({ name: s.name, image: s.image, category: 'spell' as const, subcategory: 'Druid', path: '/spells/druid' })),
  ...paladinSpells.map(s => ({ name: s.name, image: s.image, category: 'spell' as const, subcategory: 'Paladin', path: '/spells/paladin' })),
  ...knightSpells.map(s => ({ name: s.name, image: s.image, category: 'spell' as const, subcategory: 'Knight', path: '/spells/knight' })),
];

// Map creatures to searchable format
const creatureData: SearchResult[] = creatures.map(c => ({
  name: c.name,
  image: c.image,
  category: 'creature' as const,
  subcategory: 'Criatura',
  path: '/creatures',
}));

// Map items to searchable format
const itemData: SearchResult[] = [
  ...foods.map(i => ({ name: i.name, image: i.image, category: 'item' as const, subcategory: 'Comidas', path: '/items/foods' })),
  ...amulets.map(i => ({ name: i.name, image: i.image, category: 'item' as const, subcategory: 'Amuletos', path: '/items/amulets' })),
  ...rings.map(i => ({ name: i.name, image: i.image, category: 'item' as const, subcategory: 'Anéis', path: '/items/rings' })),
  ...valuables.map(i => ({ name: i.name, image: i.image, category: 'item' as const, subcategory: 'Valiosos', path: '/items/valuables' })),
  ...backpacks.map(i => ({ name: i.name, image: i.image, category: 'item' as const, subcategory: 'Mochilas', path: '/items/backpacks' })),
];

// Combine all data
const allData: SearchResult[] = [...equipmentData, ...spellData, ...creatureData, ...itemData];

// Remove duplicates by name
const uniqueData = allData.filter((item, index, self) =>
  index === self.findIndex(t => t.name === item.name)
);

const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'equipment':
      return <Shield className="w-4 h-4 text-gold" />;
    case 'spell':
      return <Wand2 className="w-4 h-4 text-gold" />;
    case 'creature':
      return <Bug className="w-4 h-4 text-gold" />;
    case 'item':
      return <Package className="w-4 h-4 text-gold" />;
    default:
      return null;
  }
};

const getCategoryLabel = (category: string) => {
  switch (category) {
    case 'equipment':
      return 'Equipamento';
    case 'spell':
      return 'Magia';
    case 'creature':
      return 'Criatura';
    case 'item':
      return 'Item';
    default:
      return category;
  }
};

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

const GlobalSearch = ({ isOpen, onClose }: GlobalSearchProps) => {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  const results = useMemo(() => {
    if (query.length < 2) return [];
    
    const searchTerm = query.toLowerCase();
    return uniqueData
      .filter(item => item.name.toLowerCase().includes(searchTerm))
      .slice(0, 20); // Limit to 20 results
  }, [query]);

  const groupedResults = useMemo(() => {
    const groups: Record<string, SearchResult[]> = {};
    results.forEach(result => {
      if (!groups[result.category]) {
        groups[result.category] = [];
      }
      groups[result.category].push(result);
    });
    return groups;
  }, [results]);

  const handleSelect = useCallback((result: SearchResult) => {
    navigate(result.path);
    onClose();
    setQuery('');
  }, [navigate, onClose]);

  // Reset query when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setQuery('');
    }
  }, [isOpen]);

  // Keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px] p-0 gap-0 wood-panel border-border">
        <DialogHeader className="maroon-header px-4 py-3">
          <DialogTitle className="text-primary-foreground font-heading flex items-center gap-2">
            <Search className="w-5 h-5" />
            Busca Global
          </DialogTitle>
        </DialogHeader>
        
        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar equipamentos, magias, criaturas..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10 bg-secondary text-text-dark border-border"
              autoFocus
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="text-xs text-muted-foreground mt-2">
            Digite pelo menos 2 caracteres para buscar
          </div>
        </div>

        {results.length > 0 && (
          <ScrollArea className="max-h-[400px] px-4 pb-4">
            <div className="space-y-4">
              {Object.entries(groupedResults).map(([category, items]) => (
                <div key={category}>
                  <div className="flex items-center gap-2 mb-2">
                    {getCategoryIcon(category)}
                    <span className="text-sm font-semibold text-gold">
                      {getCategoryLabel(category)} ({items.length})
                    </span>
                  </div>
                  <div className="space-y-1">
                    {items.map((result, index) => (
                      <button
                        key={`${result.name}-${index}`}
                        onClick={() => handleSelect(result)}
                        className="w-full flex items-center gap-3 p-2 rounded hover:bg-muted/50 transition-colors text-left"
                      >
                        <img
                          src={result.image}
                          alt={result.name}
                          className="w-8 h-8 object-contain"
                          loading="lazy"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-foreground truncate">
                            {result.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {result.subcategory}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        {query.length >= 2 && results.length === 0 && (
          <div className="px-4 pb-4 text-center text-muted-foreground text-sm">
            Nenhum resultado encontrado para "{query}"
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default GlobalSearch;
