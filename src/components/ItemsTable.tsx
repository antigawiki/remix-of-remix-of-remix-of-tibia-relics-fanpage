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

  // Define colunas dinâmicas baseadas na categoria
  const getColumns = () => {
    const normalizedCategory = category.toLowerCase();
    
    switch (normalizedCategory) {
      case 'comidas':
        return ['img', 'nome', 'peso', 'duração'];
      case 'mochilas':
        return ['img', 'nome', 'peso', 'slots', 'cidade'];
      case 'amuletos':
        return ['img', 'nome', 'peso', 'proteção', 'cargas'];
      case 'anéis':
        return ['img', 'nome', 'peso', 'efeito', 'duração'];
      case 'valiosos':
        return ['img', 'nome', 'peso'];
      default:
        return ['img', 'nome', 'peso', 'descrição', 'atributos'];
    }
  };

  const columns = getColumns();

  const getCellValue = (item: Item, column: string) => {
    switch (column) {
      case 'nome':
        return item.name;
      case 'peso':
        return item.weight || '-';
      case 'duração':
        return item.duration || '-';
      case 'slots':
        return item.slots ? `${item.slots} slots` : '-';
      case 'cidade':
        return item.city || '-';
      case 'proteção':
      case 'efeito':
      case 'atributos':
        return item.attributes || '-';
      case 'cargas':
        return item.charges !== undefined ? (item.charges === 0 ? 'Permanente' : item.charges) : '-';
      case 'descrição':
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
              {columns.map((column) => (
                <TableHead 
                  key={column}
                  className={`text-foreground font-semibold ${
                    column === 'img' ? 'w-[60px] text-center' : ''
                  } ${
                    (column === 'nome' || column === 'peso') 
                      ? 'cursor-pointer hover:text-gold transition-colors' 
                      : ''
                  }`}
                  onClick={() => {
                    if (column === 'nome') handleSort('name');
                    if (column === 'peso') handleSort('weight');
                  }}
                >
                  <div className="flex items-center gap-1 capitalize">
                    {column}
                    {(column === 'nome' || column === 'peso') && (
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
                className="hover:bg-maroon/10 transition-colors"
              >
                {columns.map((column) => (
                  <TableCell 
                    key={column}
                    className={`${
                      column === 'img' ? 'text-center' : ''
                    } ${
                      column === 'nome' ? 'font-medium text-gold' : 'text-muted-foreground'
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
        Exibindo {sortedItems.length} de {items.length} itens
      </div>
    </div>
  );
};

export default ItemsTable;
