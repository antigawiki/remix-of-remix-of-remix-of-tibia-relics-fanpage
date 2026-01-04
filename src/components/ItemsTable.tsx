import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Item } from '@/data/items';
import { Search, ArrowUpDown } from 'lucide-react';

interface ItemsTableProps {
  items: Item[];
  category: string;
}

const ItemsTable = ({ items, category }: ItemsTableProps) => {
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

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar item..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 bg-background/50"
        />
      </div>

      <div className="rounded-md border border-border/50 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-maroon/20 hover:bg-maroon/30">
              <TableHead className="w-[60px] text-center text-foreground font-semibold">Img</TableHead>
              <TableHead 
                className="cursor-pointer hover:text-gold transition-colors text-foreground font-semibold"
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center gap-1">
                  Nome
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:text-gold transition-colors text-foreground font-semibold"
                onClick={() => handleSort('weight')}
              >
                <div className="flex items-center gap-1">
                  Peso
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </TableHead>
              <TableHead className="text-foreground font-semibold">Descrição</TableHead>
              <TableHead className="text-foreground font-semibold">Atributos</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedItems.map((item, index) => (
              <TableRow 
                key={`${item.name}-${index}`}
                className="hover:bg-maroon/10 transition-colors"
              >
                <TableCell className="text-center">
                  <img 
                    src={item.image} 
                    alt={item.name}
                    className="w-8 h-8 object-contain mx-auto"
                    loading="lazy"
                  />
                </TableCell>
                <TableCell className="font-medium text-gold">{item.name}</TableCell>
                <TableCell className="text-muted-foreground">{item.weight || '-'}</TableCell>
                <TableCell className="text-muted-foreground">{item.description || '-'}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{item.attributes || '-'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="text-xs text-muted-foreground text-center">
        Exibindo {sortedItems.length} de {items.length} itens
      </div>
    </div>
  );
};

export default ItemsTable;
