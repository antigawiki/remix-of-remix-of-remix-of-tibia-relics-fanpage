import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Play, StopCircle, Users, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { HuntSession, HuntQueueItem } from "@/hooks/useHuntAdmin";
import { HuntTimer } from "./HuntTimer";
import { HuntQueuePanel } from "./HuntQueuePanel";
import { StartHuntModal } from "./StartHuntModal";
import { DeleteConfirmModal } from "./DeleteConfirmModal";

interface HuntSpotCardProps {
  spotId: string;
  spotName: string;
  cityName: string;
  session: HuntSession | undefined;
  queue: HuntQueueItem[];
  onStartHunt: (spotId: string, playerName: string) => Promise<void>;
  onEndHunt: (sessionId: string) => Promise<void>;
  onAddToQueue: (spotId: string, playerName: string) => Promise<void>;
  onRemoveFromQueue: (queueId: string) => Promise<void>;
  onClaimSpot: (queueId: string) => Promise<void>;
  onDeleteSpot: (spotId: string) => Promise<void>;
}

export function HuntSpotCard({
  spotId,
  spotName,
  cityName,
  session,
  queue,
  onStartHunt,
  onEndHunt,
  onAddToQueue,
  onRemoveFromQueue,
  onClaimSpot,
  onDeleteSpot,
}: HuntSpotCardProps) {
  const [startOpen, setStartOpen] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const isActive = session && session.status !== "finished";
  const isEnding = session?.status === "ending";

  const statusBadge = isEnding ? (
    <Badge variant="outline" className="border-yellow-500/50 text-yellow-500">⚠️ Encerrando</Badge>
  ) : isActive ? (
    <Badge variant="outline" className="border-green-500/50 text-green-500">🟢 Em uso</Badge>
  ) : (
    <Badge variant="secondary">⚪ Livre</Badge>
  );

  return (
    <>
      <Card className="border border-border/60 hover:border-border transition-colors">
        <CardHeader className="pb-2 pt-3 px-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <MapPin className="h-4 w-4 text-primary shrink-0" />
              <span className="font-semibold text-sm truncate">{spotName}</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {statusBadge}
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                onClick={() => setDeleteOpen(true)}
                title="Remover spot"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-3 space-y-3">
          {isActive && session && (
            <div className="bg-muted/40 rounded-md px-3 py-2 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Player ativo:</span>
                <span className="text-sm font-bold">{session.player_name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Tempo restante:</span>
                <HuntTimer endsAt={session.ends_at} />
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {!isActive ? (
              <Button
                size="sm"
                className="flex-1"
                onClick={() => setStartOpen(true)}
              >
                <Play className="h-3 w-3 mr-1" /> Iniciar Hunt
              </Button>
            ) : (
              <Button
                size="sm"
                variant="destructive"
                className="flex-1"
                onClick={() => session && onEndHunt(session.id)}
              >
                <StopCircle className="h-3 w-3 mr-1" /> Encerrar
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setQueueOpen(!queueOpen)}
              className="gap-1"
            >
              <Users className="h-3 w-3" />
              Fila ({queue.length})
              {queueOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
          </div>

          {queueOpen && (
            <div className="border-t border-border/40 pt-3">
              <HuntQueuePanel
                spotId={spotId}
                spotName={spotName}
                cityName={cityName}
                queue={queue}
                onAdd={onAddToQueue}
                onRemove={onRemoveFromQueue}
                onClaim={onClaimSpot}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <StartHuntModal
        open={startOpen}
        onClose={() => setStartOpen(false)}
        onStart={(playerName) => onStartHunt(spotId, playerName)}
        spotName={spotName}
        cityName={cityName}
      />

      <DeleteConfirmModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => onDeleteSpot(spotId)}
        description={`Tem certeza que deseja excluir o spot "${spotName}"?`}
      />
    </>
  );
}
