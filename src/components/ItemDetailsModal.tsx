import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useItemDetails, ItemDetails } from '@/hooks/useItemDetails';
import { Equipment } from '@/data/equipment';
import { Skeleton } from '@/components/ui/skeleton';
import { MapPin, ExternalLink, Coins, ShoppingCart, Skull } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface ItemDetailsModalProps {
  item: Equipment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const LoadingSkeleton = () => (
  <div className="space-y-4">
    <div className="flex items-center gap-4">
      <Skeleton className="w-16 h-16" />
      <div className="space-y-2">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-24" />
      </div>
    </div>
    <Skeleton className="h-32 w-full" />
    <Skeleton className="h-32 w-full" />
  </div>
);

const NpcTable = ({ 
  title, 
  npcs, 
  icon 
}: { 
  title: string; 
  npcs: ItemDetails['sellTo']; 
  icon: React.ReactNode;
}) => {
  if (npcs.length === 0) return null;
  
  return (
    <div className="space-y-2">
      <h3 className="font-heading font-semibold text-maroon flex items-center gap-2">
        {icon}
        {title}
      </h3>
      <div className="rounded-sm border border-border overflow-hidden">
        <Table>
          <TableHeader className="bg-maroon/80">
            <TableRow>
              <TableHead className="text-parchment text-xs">Cidade</TableHead>
              <TableHead className="text-parchment text-xs">NPC</TableHead>
              <TableHead className="text-parchment text-xs">Preço</TableHead>
              <TableHead className="text-parchment text-xs w-10">Mapa</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {npcs.map((npc, index) => (
              <TableRow 
                key={`${npc.npc}-${index}`}
                className={index % 2 === 0 ? 'bg-parchment' : 'bg-parchment-dark'}
              >
                <TableCell className="text-xs py-1 text-text-dark">{npc.city}</TableCell>
                <TableCell className="text-xs py-1 font-medium text-text-dark">{npc.npc}</TableCell>
                <TableCell className="text-xs py-1 text-gold font-semibold">{npc.price}</TableCell>
                <TableCell className="text-xs py-1">
                  {npc.mapUrl && (
                    <a 
                      href={npc.mapUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-maroon hover:text-maroon/80 inline-flex items-center justify-center"
                      title="Ver no mapa"
                    >
                      <MapPin className="w-4 h-4" />
                    </a>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

const LootTable = ({ loot }: { loot: ItemDetails['lootedFrom'] }) => {
  if (loot.length === 0) return null;
  
  return (
    <div className="space-y-2">
      <h3 className="font-heading font-semibold text-maroon flex items-center gap-2">
        <Skull className="w-4 h-4" />
        Dropado Por
      </h3>
      <div className="rounded-sm border border-border overflow-hidden">
        <Table>
          <TableHeader className="bg-maroon/80">
            <TableRow>
              <TableHead className="text-parchment text-xs">Monstro</TableHead>
              <TableHead className="text-parchment text-xs w-10">Img</TableHead>
              <TableHead className="text-parchment text-xs">Qtd</TableHead>
              <TableHead className="text-parchment text-xs">Chance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loot.map((item, index) => (
              <TableRow 
                key={`${item.monster}-${index}`}
                className={index % 2 === 0 ? 'bg-parchment' : 'bg-parchment-dark'}
              >
                <TableCell className="text-xs py-1 font-medium text-text-dark">{item.monster}</TableCell>
                <TableCell className="py-1">
                  {item.image && (
                    <img 
                      src={item.image} 
                      alt={item.monster}
                      className="w-6 h-6 object-contain"
                      loading="lazy"
                    />
                  )}
                </TableCell>
                <TableCell className="text-xs py-1 text-text-dark">{item.amount}</TableCell>
                <TableCell className="text-xs py-1 text-maroon font-semibold">{item.chance}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

const ItemDetailsModal = ({ item, open, onOpenChange }: ItemDetailsModalProps) => {
  const { data: details, isLoading, isError } = useItemDetails(item?.name || null, open);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-parchment border-2 border-maroon/30">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 font-heading text-maroon">
            {item && (
              <>
                <img 
                  src={details?.image || item.image} 
                  alt={item.name}
                  className="w-10 h-10 object-contain"
                />
                <span>{item.name}</span>
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <LoadingSkeleton />
        ) : isError || !details ? (
          <div className="py-6 text-center">
            <p className="text-muted-foreground mb-2">
              Detalhes não disponíveis para este item.
            </p>
            {item && (
              <div className="parchment-dark p-4 rounded-sm text-text-dark">
                <p className="text-sm">
                  <strong>Armadura:</strong> {item.armor ?? '-'} | 
                  <strong> Peso:</strong> {item.weight}
                </p>
                {item.attributes && (
                  <p className="text-xs text-text-dark/70 mt-1">{item.attributes}</p>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Stats */}
            <div className="parchment-dark p-3 rounded-sm flex flex-wrap gap-4 text-sm text-text-dark">
              {details.stats.armor !== undefined && (
                <span><strong>Arm:</strong> {details.stats.armor}</span>
              )}
              {details.stats.attack !== undefined && (
                <span><strong>Atk:</strong> {details.stats.attack}</span>
              )}
              {details.stats.defense !== undefined && (
                <span><strong>Def:</strong> {details.stats.defense}</span>
              )}
              {details.stats.weight && (
                <span><strong>Peso:</strong> {details.stats.weight}</span>
              )}
            </div>

            {/* Buy/Sell Tables Side by Side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <NpcTable 
                title="Vender Para" 
                npcs={details.sellTo} 
                icon={<Coins className="w-4 h-4" />}
              />
              <NpcTable 
                title="Comprar De" 
                npcs={details.buyFrom} 
                icon={<ShoppingCart className="w-4 h-4" />}
              />
            </div>

            {/* Loot Table */}
            <LootTable loot={details.lootedFrom} />

            {/* Empty States */}
            {details.sellTo.length === 0 && details.buyFrom.length === 0 && details.lootedFrom.length === 0 && (
              <p className="text-center text-muted-foreground py-4">
                Nenhuma informação adicional disponível.
              </p>
            )}

          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ItemDetailsModal;
