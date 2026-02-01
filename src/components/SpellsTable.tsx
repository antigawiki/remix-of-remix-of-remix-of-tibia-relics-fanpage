import { useState } from 'react';
import { Spell } from '@/data/spells';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowUpDown, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useTranslation } from '@/i18n';

interface SpellsTableProps {
  spells: Spell[];
  vocation: string;
}

type SortKey = 'name' | 'mlvl' | 'mana' | 'price';
type SortDirection = 'asc' | 'desc';

const SpellsTable = ({ spells, vocation }: SpellsTableProps) => {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('mlvl');
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

    if (sortKey === 'mana') {
      // Handle mana as string (e.g. "40%") or number
      const aNum = typeof aVal === 'string' ? parseInt(aVal.replace(/\D/g, '')) || 0 : Number(aVal);
      const bNum = typeof bVal === 'string' ? parseInt(bVal.replace(/\D/g, '')) || 0 : Number(bVal);
      return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
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

  const getTypeTranslation = (type: string | undefined) => {
    switch (type) {
      case 'Attack': return t('tables.spellTypes.attack');
      case 'Healing': return t('tables.spellTypes.healing');
      case 'Support': return t('tables.spellTypes.support');
      case 'Summon': return t('tables.spellTypes.summon');
      default: return t('tables.spellTypes.other');
    }
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t('tables.searchSpell')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 bg-parchment border-border"
        />
      </div>

      <div className="rounded-sm border border-border overflow-hidden">
        <Table>
          <TableHeader className="bg-maroon">
            <TableRow>
              <TableHead className="text-parchment w-12">{t('tables.columns.img')}</TableHead>
              <TableHead 
                className="text-parchment cursor-pointer hover:bg-maroon/80"
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center gap-1">
                  {t('tables.columns.name')}
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </TableHead>
              <TableHead className="text-parchment">{t('tables.columns.words')}</TableHead>
              <TableHead 
                className="text-parchment cursor-pointer hover:bg-maroon/80"
                onClick={() => handleSort('mlvl')}
              >
                <div className="flex items-center gap-1">
                  {t('tables.columns.magicLevel')}
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </TableHead>
              <TableHead 
                className="text-parchment cursor-pointer hover:bg-maroon/80"
                onClick={() => handleSort('mana')}
              >
                <div className="flex items-center gap-1">
                  {t('tables.columns.mana')}
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </TableHead>
              <TableHead 
                className="text-parchment cursor-pointer hover:bg-maroon/80"
                onClick={() => handleSort('price')}
              >
                <div className="flex items-center gap-1">
                  {t('tables.columns.price')}
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </TableHead>
              <TableHead className="text-parchment">{t('tables.columns.type')}</TableHead>
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
                <TableCell>{spell.mlvl}</TableCell>
                <TableCell>{spell.mana}</TableCell>
                <TableCell>{spell.price}</TableCell>
                <TableCell className="text-xs">
                  <span className={`px-2 py-0.5 rounded-sm ${
                    spell.type === 'Attack' ? 'bg-red-100 text-red-800' :
                    spell.type === 'Healing' ? 'bg-green-100 text-green-800' :
                    spell.type === 'Support' ? 'bg-blue-100 text-blue-800' :
                    spell.type === 'Summon' ? 'bg-purple-100 text-purple-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {getTypeTranslation(spell.type)}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        {t('tables.showingSpells').replace('{shown}', String(sortedSpells.length)).replace('{total}', String(spells.length))}
      </p>
    </div>
  );
};

export default SpellsTable;
