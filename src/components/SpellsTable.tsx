import { useState } from 'react';
import { Spell } from '@/data/spells';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowUpDown, Search, Star } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface SpellsTableProps {
  spells: Spell[];
  vocation: string;
}

type SortKey = 'name' | 'level' | 'mana' | 'price';
type SortDirection = 'asc' | 'desc';

const SpellsTable = ({ spells, vocation }: SpellsTableProps) => {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('level');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const filteredSpells = spells.filter(spell =>
    spell.name.toLowerCase().includes(search.toLowerCase()) ||
    spell.words.toLowerCase().includes(search.toLowerCase())
  );

  const sortedSpells = [...filteredSpells].sort((a, b) => {
    let aVal = a[sortKey];
    let bVal = b[sortKey];

    if (sortKey === 'price') {
      aVal = parseInt(String(aVal).replace(/\D/g, ''));
      bVal = parseInt(String(bVal).replace(/\D/g, ''));
    }

    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortDirection === 'asc' 
        ? aVal.localeCompare(bVal) 
        : bVal.localeCompare(aVal);
    }

    return sortDirection === 'asc' 
      ? Number(aVal) - Number(bVal) 
      : Number(bVal) - Number(aVal);
  });

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar magia ou palavras..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 bg-parchment border-border"
        />
      </div>

      <div className="rounded-sm border border-border overflow-hidden">
        <Table>
          <TableHeader className="bg-maroon">
            <TableRow>
              <TableHead className="text-parchment w-12">Img</TableHead>
              <TableHead 
                className="text-parchment cursor-pointer hover:bg-maroon/80"
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center gap-1">
                  Nome
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </TableHead>
              <TableHead className="text-parchment">Palavras</TableHead>
              <TableHead 
                className="text-parchment cursor-pointer hover:bg-maroon/80"
                onClick={() => handleSort('level')}
              >
                <div className="flex items-center gap-1">
                  Level
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </TableHead>
              <TableHead 
                className="text-parchment cursor-pointer hover:bg-maroon/80"
                onClick={() => handleSort('mana')}
              >
                <div className="flex items-center gap-1">
                  Mana
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </TableHead>
              <TableHead 
                className="text-parchment cursor-pointer hover:bg-maroon/80"
                onClick={() => handleSort('price')}
              >
                <div className="flex items-center gap-1">
                  Preço
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </TableHead>
              <TableHead className="text-parchment w-12">P</TableHead>
              <TableHead className="text-parchment">Tipo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedSpells.map((spell, index) => (
              <TableRow 
                key={spell.name} 
                className={index % 2 === 0 ? 'bg-parchment' : 'bg-parchment-dark'}
              >
                <TableCell>
                  <img 
                    src={spell.image} 
                    alt={spell.name} 
                    className="w-8 h-8 object-contain"
                    loading="lazy"
                  />
                </TableCell>
                <TableCell className="font-medium text-text-dark">{spell.name}</TableCell>
                <TableCell className="font-mono text-xs text-maroon">{spell.words}</TableCell>
                <TableCell>{spell.level}</TableCell>
                <TableCell>{spell.mana}</TableCell>
                <TableCell>{spell.price}</TableCell>
                <TableCell>
                  {spell.isPremium && <Star className="h-4 w-4 text-gold fill-gold" />}
                </TableCell>
                <TableCell className="text-xs">
                  <span className={`px-2 py-0.5 rounded-sm ${
                    spell.type === 'Attack' ? 'bg-red-100 text-red-800' :
                    spell.type === 'Healing' ? 'bg-green-100 text-green-800' :
                    spell.type === 'Support' ? 'bg-blue-100 text-blue-800' :
                    spell.type === 'Summon' ? 'bg-purple-100 text-purple-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {spell.type || 'Other'}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Exibindo {sortedSpells.length} de {spells.length} magias
      </p>
    </div>
  );
};

export default SpellsTable;
