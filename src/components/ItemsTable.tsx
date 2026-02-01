import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Item } from '@/data/items';
import { Search, ArrowUpDown } from 'lucide-react';
import { useTranslation } from '@/i18n';

interface ItemsTableProps {
  items: Item[];
  category: string;
}

const ItemsTable = ({ items, category }: ItemsTableProps) => {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<'name' | 'weight'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleSort = (key: 'name' | 'weight') => {
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
    let comparison = 0;
    if (sortKey === 'name') {
      comparison = a.name.localeCompare(b.name);
    } else if (sortKey === 'weight') {
      const weightA = parseFloat(a.weight?.replace(' oz.', '') || '0');
      const weightB = parseFloat(b.weight?.replace(' oz.', '') || '0');
      comparison = weightA - weightB;
    }
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  // Define colunas dinâmicas baseadas na categoria
  const getColumns = () => {
    switch (category) {
      case 'foods':
        return ['img', 'name', 'weight', 'duration'];
      case 'backpacks':
        return ['img', 'name', 'weight', 'slots', 'city'];
      case 'amulets':
        return ['img', 'name', 'weight', 'protection', 'charges'];
      case 'rings':
        return ['img', 'name', 'weight', 'effect', 'duration'];
      case 'valuables':
        return ['img', 'name', 'weight'];
      default:
        return ['img', 'name', 'weight', 'description', 'attributes'];
    }
  };

  const getColumnLabel = (column: string) => {
    switch (column) {
      case 'img': return t('tables.columns.img');
      case 'name': return t('tables.columns.name');
      case 'weight': return t('tables.columns.weight');
      case 'duration': return t('tables.columns.duration');
      case 'slots': return t('tables.columns.slots');
      case 'city': return t('tables.columns.city');
      case 'protection': return t('tables.columns.protection');
      case 'effect': return t('tables.columns.effect');
      case 'charges': return t('tables.columns.charges');
      case 'attributes': return t('tables.columns.attributes');
      case 'description': return t('tables.columns.description');
      default: return column;
    }
  };

  const columns = getColumns();

  const getCellValue = (item: Item, column: string) => {
    switch (column) {
      case 'name':
        return item.name;
      case 'weight':
        return item.weight || '-';
      case 'duration':
        return item.duration || '-';
      case 'slots':
        return item.slots ? `${item.slots} slots` : '-';
      case 'city':
        return item.city || '-';
      case 'protection':
      case 'effect':
      case 'attributes':
        return item.attributes || '-';
      case 'charges':
        return item.charges !== undefined ? (item.charges === 0 ? t('tables.itemValues.permanent') : item.charges) : '-';
      case 'description':
        return item.description || '-';
      default:
        return '-';
    }
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder={t('tables.searchItem')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 bg-parchment border-border"
        />
      </div>

      <div className="rounded-md border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-maroon hover:bg-maroon">
              {columns.map((column) => (
                <TableHead 
                  key={column}
                  className={`text-parchment font-semibold ${
                    column === 'img' ? 'w-[60px] text-center' : ''
                  } ${
                    (column === 'name' || column === 'weight') 
                      ? 'cursor-pointer hover:text-gold transition-colors' 
                      : ''
                  }`}
                  onClick={() => {
                    if (column === 'name') handleSort('name');
                    if (column === 'weight') handleSort('weight');
                  }}
                >
                  <div className="flex items-center gap-1 capitalize">
                    {getColumnLabel(column)}
                    {(column === 'name' || column === 'weight') && (
                      <ArrowUpDown className="w-3 h-3" />
                    )}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedItems.map((item, index) => (
              <TableRow 
                key={`${item.name}-${index}`}
                className={`${index % 2 === 0 ? 'bg-parchment' : 'bg-parchment-dark'} hover:bg-gold/20 transition-colors`}
              >
                {columns.map((column) => (
                  <TableCell 
                    key={column}
                    className={`${
                      column === 'img' ? 'text-center' : ''
                    } ${
                      column === 'name' ? 'font-medium text-maroon' : 'text-text-dark'
                    }`}
                  >
                    {column === 'img' ? (
                      <img 
                        src={item.image} 
                        alt={item.name}
                        className="w-8 h-8 object-contain mx-auto"
                        loading="lazy"
                      />
                    ) : (
                      getCellValue(item, column)
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="text-xs text-muted-foreground text-center">
        {t('tables.showingItems').replace('{shown}', String(sortedItems.length)).replace('{total}', String(items.length))}
      </div>
    </div>
  );
};

export default ItemsTable;
