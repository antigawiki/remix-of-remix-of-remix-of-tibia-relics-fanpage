import { useState } from 'react';
import { Creature } from '@/data/creatures';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowUpDown, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useTranslation } from '@/i18n';

interface CreaturesTableProps {
  creatures: Creature[];
}

type SortKey = 'name' | 'exp' | 'hp' | 'summon' | 'convince' | 'ratio';
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
    const aVal = sortKey === 'ratio' ? (a.ratio ?? 0) : a[sortKey as keyof Creature];
    const bVal = sortKey === 'ratio' ? (b.ratio ?? 0) : b[sortKey as keyof Creature];

    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;

    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortDirection === 'asc'
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    }

    return sortDirection === 'asc'
      ? Number(aVal) - Number(bVal)
      : Number(bVal) - Number(aVal);
  });

  const SortHeader = ({ label, sortField }: { label: string; sortField: SortKey }) => (
    <TableHead
      className="text-parchment cursor-pointer hover:bg-maroon/80 whitespace-nowrap"
      onClick={() => handleSort(sortField)}
    >
      <div className="flex items-center gap-1">
        {label}
        <ArrowUpDown className="h-3 w-3 shrink-0" />
      </div>
    </TableHead>
  );

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
              <TableHead className="text-parchment w-14">{t('tables.columns.img')}</TableHead>
              <SortHeader label={t('tables.columns.name')} sortField="name" />
              <SortHeader label={t('tables.columns.exp')} sortField="exp" />
              <SortHeader label="HP" sortField="hp" />
              <SortHeader label={t('tables.columns.summon')} sortField="summon" />
              <SortHeader label={t('tables.columns.convince')} sortField="convince" />
              <SortHeader label="Exp/HP" sortField="ratio" />
              <TableHead className="text-parchment">Loot</TableHead>
              <TableHead className="text-parchment text-center">Custom?</TableHead>
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
                <TableCell className="font-medium text-text-dark whitespace-nowrap">{creature.name}</TableCell>
                <TableCell>{creature.exp > 0 ? creature.exp.toLocaleString() : 0}</TableCell>
                <TableCell>{creature.hp > 0 ? creature.hp.toLocaleString() : 0}</TableCell>
                <TableCell>{creature.summon ?? '---'}</TableCell>
                <TableCell>{creature.convince ?? '---'}</TableCell>
                <TableCell className={creature.ratio && creature.ratio >= 1 ? 'font-semibold text-primary' : ''}>
                  {creature.ratio !== undefined ? creature.ratio.toFixed(2) : '---'}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-xs">
                  {creature.loot ?? '---'}
                </TableCell>
                <TableCell className="text-center">
                  {creature.custom ? <span className="text-amber-600 font-semibold text-xs">yes</span> : <span className="text-muted-foreground text-xs">-</span>}
                </TableCell>
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
