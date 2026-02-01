import { useState } from 'react';
import { Equipment } from '@/data/equipment';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowUpDown, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import ItemDetailsModal from '@/components/ItemDetailsModal';
import { useTranslation } from '@/i18n';

interface EquipmentTableProps {
  items: Equipment[];
  category: string;
}

type SortKey = 'name' | 'armor' | 'attack' | 'defense' | 'weight';
type SortDirection = 'asc' | 'desc';

const EquipmentTable = ({ items, category }: EquipmentTableProps) => {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [selectedItem, setSelectedItem] = useState<Equipment | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const handleRowClick = (item: Equipment) => {
    setSelectedItem(item);
    setModalOpen(true);
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(search.toLowerCase())
  );

  const sortedItems = [...filteredItems].sort((a, b) => {
    let aVal = a[sortKey];
    let bVal = b[sortKey];

    if (sortKey === 'weight') {
      aVal = parseFloat(String(aVal).replace(' oz.', ''));
      bVal = parseFloat(String(bVal).replace(' oz.', ''));
    }

    if (aVal === undefined || aVal === null) return 1;
    if (bVal === undefined || bVal === null) return -1;

    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortDirection === 'asc' 
        ? aVal.localeCompare(bVal) 
        : bVal.localeCompare(aVal);
    }

    return sortDirection === 'asc' 
      ? Number(aVal) - Number(bVal) 
      : Number(bVal) - Number(aVal);
  });

  const hasArmor = items.some(item => item.armor !== undefined);
  const hasAttack = items.some(item => item.attack !== undefined);
  const hasDefense = items.some(item => item.defense !== undefined);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t('tables.searchEquipment')}
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
              {hasArmor && (
                <TableHead 
                  className="text-parchment cursor-pointer hover:bg-maroon/80"
                  onClick={() => handleSort('armor')}
                >
                  <div className="flex items-center gap-1">
                    {t('tables.columns.armor')}
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </TableHead>
              )}
              {hasAttack && (
                <TableHead 
                  className="text-parchment cursor-pointer hover:bg-maroon/80"
                  onClick={() => handleSort('attack')}
                >
                  <div className="flex items-center gap-1">
                    {t('tables.columns.attack')}
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </TableHead>
              )}
              {hasDefense && (
                <TableHead 
                  className="text-parchment cursor-pointer hover:bg-maroon/80"
                  onClick={() => handleSort('defense')}
                >
                  <div className="flex items-center gap-1">
                    {t('tables.columns.defense')}
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </TableHead>
              )}
              <TableHead 
                className="text-parchment cursor-pointer hover:bg-maroon/80"
                onClick={() => handleSort('weight')}
              >
                <div className="flex items-center gap-1">
                  {t('tables.columns.weight')}
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </TableHead>
              <TableHead className="text-parchment">{t('tables.columns.attributes')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedItems.map((item, index) => (
              <TableRow 
                key={item.name} 
                className={`${index % 2 === 0 ? 'bg-parchment' : 'bg-parchment-dark'} cursor-pointer hover:bg-gold/20 transition-colors`}
                onClick={() => handleRowClick(item)}
              >
                <TableCell>
                  <img 
                    src={item.image} 
                    alt={item.name} 
                    className="w-8 h-8 object-contain"
                    loading="lazy"
                  />
                </TableCell>
                <TableCell className="font-medium text-text-dark">{item.name}</TableCell>
                {hasArmor && <TableCell>{item.armor ?? '-'}</TableCell>}
                {hasAttack && <TableCell>{item.attack ?? '-'}</TableCell>}
                {hasDefense && <TableCell>{item.defense ?? '-'}</TableCell>}
                <TableCell>{item.weight}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {item.attributes || '-'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        {t('tables.showingItems').replace('{shown}', String(sortedItems.length)).replace('{total}', String(items.length))} • {t('tables.clickForDetails')}
      </p>

      <ItemDetailsModal 
        item={selectedItem}
        open={modalOpen}
        onOpenChange={setModalOpen}
      />
    </div>
  );
};

export default EquipmentTable;
