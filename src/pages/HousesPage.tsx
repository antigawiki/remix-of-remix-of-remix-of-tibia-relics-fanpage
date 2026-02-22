import { useState, useMemo } from 'react';
import { Home, ArrowUpDown, Search } from 'lucide-react';
import { useTranslation } from '@/i18n';
import MainLayout from '@/layouts/MainLayout';
import { useHouses, TOWNS, type HouseType, type HouseStatusFilter } from '@/hooks/useHouses';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';

type SortField = 'name' | 'town' | 'size' | 'beds' | 'rent';
type SortDir = 'asc' | 'desc';

const HousesPage = () => {
  const { t } = useTranslation();
  const [type, setType] = useState<HouseType>('HousesAndFlats');
  const [status, setStatus] = useState<HouseStatusFilter>('All');
  const [town, setTown] = useState('');
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const { data: houses, isLoading, isError } = useHouses(type, status, town);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const filtered = useMemo(() => {
    if (!houses) return [];
    let list = houses;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(h => h.name.toLowerCase().includes(q));
    }
    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortField === 'town') cmp = a.town.localeCompare(b.town);
      else cmp = (a[sortField] ?? 0) - (b[sortField] ?? 0);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [houses, search, sortField, sortDir]);

  const SortHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <TableHead
      className="cursor-pointer select-none hover:text-gold transition-colors"
      onClick={() => toggleSort(field)}
    >
      <span className="flex items-center gap-1">
        {children}
        <ArrowUpDown className={`w-3 h-3 ${sortField === field ? 'text-gold' : 'text-muted-foreground/50'}`} />
      </span>
    </TableHead>
  );

  const getStatusLabel = (h: { status: { type: string; bidAmount?: number; rentedBy?: string; auctionedBy?: string } }) => {
    if (h.status.type === 'rented') return <span className="text-green-500">{t('pages.houses.rented')}{h.status.rentedBy ? ` (${h.status.rentedBy})` : ''}</span>;
    if (h.status.type === 'auctioned') return <span className="text-amber-500">{t('pages.houses.auctioned')}{h.status.bidAmount ? ` - ${h.status.bidAmount.toLocaleString()} gp` : ''}</span>;
    return <span className="text-muted-foreground">{t('pages.houses.free')}</span>;
  };

  return (
    <MainLayout>
      <div className="wood-panel rounded-sm overflow-hidden">
        <header className="news-box-header">
          <h2 className="font-semibold flex items-center gap-2">
            <Home className="w-5 h-5" />
            {t('pages.houses.title')}
          </h2>
        </header>

        <div className="p-4 space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">{t('pages.houses.town')}</label>
              <Select value={town || '__all__'} onValueChange={(v) => setTown(v === '__all__' ? '' : v)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">{t('common.all')}</SelectItem>
                  {TOWNS.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">{t('pages.houses.type')}</label>
              <Select value={type} onValueChange={(v) => setType(v as HouseType)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HousesAndFlats">{t('pages.houses.housesAndFlats')}</SelectItem>
                  <SelectItem value="GuildHalls">{t('pages.houses.guildhalls')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">{t('pages.houses.status')}</label>
              <Select value={status} onValueChange={(v) => setStatus(v as HouseStatusFilter)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">{t('common.all')}</SelectItem>
                  <SelectItem value="Auctioned">{t('pages.houses.auctioned')}</SelectItem>
                  <SelectItem value="Rented">{t('pages.houses.rented')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
              <label className="text-xs text-muted-foreground">{t('common.search')}</label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={t('pages.houses.searchPlaceholder')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(10)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : isError ? (
            <div className="text-center py-8 text-destructive">
              {t('pages.houses.errorLoading')}
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                {t('tables.showing').replace('{shown}', String(filtered.length)).replace('{total}', String(houses?.length ?? 0))}
              </p>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortHeader field="name">{t('common.name')}</SortHeader>
                      <SortHeader field="town">{t('pages.houses.town')}</SortHeader>
                      <SortHeader field="size">{t('pages.houses.size')}</SortHeader>
                      <SortHeader field="beds">{t('pages.houses.beds')}</SortHeader>
                      <SortHeader field="rent">{t('pages.houses.rent')}</SortHeader>
                      <TableHead>{t('pages.houses.status')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((house) => (
                      <TableRow
                        key={house.houseId}
                        className={house.status.type === 'rented' ? 'bg-green-500/5' : house.status.type === 'auctioned' ? 'bg-amber-500/5' : ''}
                      >
                        <TableCell className="font-medium">{house.name}</TableCell>
                        <TableCell className="text-muted-foreground">{house.town}</TableCell>
                        <TableCell>{house.size} sqm</TableCell>
                        <TableCell>{house.beds}</TableCell>
                        <TableCell className="text-gold">{house.rent.toLocaleString()} gp</TableCell>
                        <TableCell>{getStatusLabel(house)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {filtered.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  {t('pages.houses.noHouses')}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default HousesPage;
