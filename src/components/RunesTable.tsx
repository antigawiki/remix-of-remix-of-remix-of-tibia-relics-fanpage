import { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { ArrowUpDown, Search, Crown } from 'lucide-react';
import { useTranslation } from '@/i18n';
import { runes, Rune } from '@/data/runes';
import RuneDetailsModal from './RuneDetailsModal';

type SortKey = 'name' | 'mlvlCast' | 'mlvlUse' | 'mana' | 'charges';
type SortDirection = 'asc' | 'desc';

const RunesTable = () => {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('mlvlCast');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [selectedRune, setSelectedRune] = useState<Rune | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const filteredAndSortedRunes = useMemo(() => {
    let filtered = runes;

    if (search) {
      const searchLower = search.toLowerCase();
      filtered = runes.filter(
        (rune) =>
          rune.name.toLowerCase().includes(searchLower) ||
          rune.spell.toLowerCase().includes(searchLower)
      );
    }

    return [...filtered].sort((a, b) => {
      let comparison = 0;
      if (sortKey === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else {
        comparison = a[sortKey] - b[sortKey];
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [search, sortKey, sortDirection]);

  const handleRowClick = (rune: Rune) => {
    setSelectedRune(rune);
    setModalOpen(true);
  };

  const formatVocations = (vocations: string[]) => {
    return vocations.map((v) => v.charAt(0)).join(', ');
  };

  const SortableHeader = ({
    column,
    label,
  }: {
    column: SortKey;
    label: string;
  }) => (
    <TableHead
      className="cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={() => handleSort(column)}
    >
      <div className="flex items-center gap-1">
        {label}
        <ArrowUpDown
          className={`w-3 h-3 ${sortKey === column ? 'text-gold' : 'text-muted-foreground'}`}
        />
      </div>
    </TableHead>
  );

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t('pages.runes.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <span className="text-sm text-muted-foreground">
          {filteredAndSortedRunes.length} / {runes.length}
        </span>
      </div>

      {/* Hint */}
      <p className="text-xs text-muted-foreground">
        {t('tables.clickForDetails')}
      </p>

      {/* Table */}
      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <SortableHeader column="mlvlCast" label={t('pages.runes.mlvlCast')} />
              <TableHead className="w-12">{t('tables.columns.img')}</TableHead>
              <SortableHeader column="name" label={t('tables.columns.name')} />
              <TableHead>{t('pages.runes.vocations')}</TableHead>
              <TableHead className="text-center">{t('common.premium')}</TableHead>
              <SortableHeader column="mana" label={t('tables.columns.mana')} />
              <SortableHeader column="charges" label={t('pages.runes.charges')} />
              <SortableHeader column="mlvlUse" label={t('pages.runes.mlvlUse')} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedRunes.map((rune) => (
              <TableRow
                key={rune.id}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => handleRowClick(rune)}
              >
                <TableCell className="font-medium text-center">{rune.mlvlCast}</TableCell>
                <TableCell>
                  <img
                    src={rune.image}
                    alt={rune.name}
                    className="w-8 h-8 object-contain"
                  />
                </TableCell>
                <TableCell className="font-medium">{rune.name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {formatVocations(rune.vocations)}
                </TableCell>
                <TableCell className="text-center">
                  {rune.isPremium ? (
                    <Crown className="w-4 h-4 text-gold mx-auto" />
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-blue-600 font-medium">{rune.mana}</TableCell>
                <TableCell className="text-center">{rune.charges}</TableCell>
                <TableCell className="text-center">{rune.mlvlUse}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Modal */}
      <RuneDetailsModal
        rune={selectedRune}
        open={modalOpen}
        onOpenChange={setModalOpen}
      />
    </div>
  );
};

export default RunesTable;
