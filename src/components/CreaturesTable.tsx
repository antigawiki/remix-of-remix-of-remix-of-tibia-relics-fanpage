import { useState } from 'react';
import { Creature } from '@/data/creatures';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowUpDown, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useTranslation } from '@/i18n';

interface CreaturesTableProps {
  creatures: Creature[];
}

type SortKey = 'name' | 'exp' | 'hp' | 'summon' | 'convince';
type SortDirection = 'asc' | 'desc';

const CreaturesTable = ({ creatures }: CreaturesTableProps) => {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const filteredCreatures = creatures.filter(creature =>
    creature.name.toLowerCase().includes(search.toLowerCase())
  );

  const sortedCreatures = [...filteredCreatures].sort((a, b) => {
    const aVal = a[sortKey];
    const bVal = b[sortKey];

    if (aVal === null) return 1;
    if (bVal === null) return -1;

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
          placeholder={t('tables.searchCreature')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 bg-parchment border-border"
        />
      </div>

      <div className="rounded-sm border border-border overflow-hidden">
        <Table>
          <TableHeader className="bg-maroon">
            <TableRow>
              <TableHead className="text-parchment w-16">{t('tables.columns.img')}</TableHead>
              <TableHead 
                className="text-parchment cursor-pointer hover:bg-maroon/80"
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center gap-1">
                  {t('tables.columns.name')}
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </TableHead>
              <TableHead 
                className="text-parchment cursor-pointer hover:bg-maroon/80"
                onClick={() => handleSort('exp')}
              >
                <div className="flex items-center gap-1">
                  {t('tables.columns.exp')}
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </TableHead>
              <TableHead 
                className="text-parchment cursor-pointer hover:bg-maroon/80"
                onClick={() => handleSort('hp')}
              >
                <div className="flex items-center gap-1">
                  {t('tables.columns.hp')}
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </TableHead>
              <TableHead 
                className="text-parchment cursor-pointer hover:bg-maroon/80"
                onClick={() => handleSort('summon')}
              >
                <div className="flex items-center gap-1">
                  {t('tables.columns.summon')}
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </TableHead>
              <TableHead 
                className="text-parchment cursor-pointer hover:bg-maroon/80"
                onClick={() => handleSort('convince')}
              >
                <div className="flex items-center gap-1">
                  {t('tables.columns.convince')}
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedCreatures.map((creature, index) => (
              <TableRow 
                key={creature.name} 
                className={index % 2 === 0 ? 'bg-parchment' : 'bg-parchment-dark'}
              >
                <TableCell>
                  <img 
                    src={creature.image} 
                    alt={creature.name} 
                    className="w-10 h-10 object-contain"
                    loading="lazy"
                  />
                </TableCell>
                <TableCell className="font-medium text-text-dark">{creature.name}</TableCell>
                <TableCell>{creature.exp.toLocaleString()}</TableCell>
                <TableCell>{creature.hp.toLocaleString()}</TableCell>
                <TableCell>{creature.summon ?? '-'}</TableCell>
                <TableCell>{creature.convince ?? '-'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        {t('tables.showingCreatures').replace('{shown}', String(sortedCreatures.length)).replace('{total}', String(creatures.length))}
      </p>
    </div>
  );
};

export default CreaturesTable;
