import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Play, StopCircle, Users, ChevronDown, ChevronUp, Trash2, PersonStanding } from "lucide-react";
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
  claimedItem: HuntQueueItem | null;
  playerSessionId: string;
  characterName: string;
  isAdmin: boolean;
  onStartHunt: (spotId: string, playerName: string) => Promise<void>;
  onEndHunt: (sessionId: string) => Promise<void>;
  onAddToQueue: (spotId: string, playerName: string, sessionId: string) => Promise<void>;
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
  claimedItem,
  playerSessionId,
  characterName,
  isAdmin,
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
  const isClaimed = !isActive && claimedItem != null;

  // For claimed: endsAt = notified_at + 15 minutes
  const claimEndsAt = claimedItem?.notified_at
    ? new Date(new Date(claimedItem.notified_at).getTime() + 15 * 60000).toISOString()
    : null;

  const isClaimedByMe = claimedItem?.session_id === playerSessionId;

  const statusBadge = isEnding ? (
    <Badge variant="outline" className="border-yellow-500/50 text-yellow-500">⚠️ Ending</Badge>
  ) : isActive ? (
    <Badge variant="outline" className="border-green-500/50 text-green-500">🟢 Active</Badge>
  ) : isClaimed ? (
    <Badge variant="outline" className="border-blue-500/50 text-blue-400">🏃 En Route</Badge>
  ) : (
    <Badge variant="secondary">⚪ Free</Badge>
  );

  // Who can start the hunt when spot is claimed: the claimer or admin
  const canStart = !isActive && (!isClaimed || isClaimedByMe || isAdmin);

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
              {isAdmin && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                  onClick={() => setDeleteOpen(true)}
                  title="Delete spot"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-3 space-y-3">
          {/* Active hunt info */}
          {isActive && session && (
            <div className="bg-muted/40 rounded-md px-3 py-2 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Active player:</span>
                <span className="text-sm font-bold">
                  {session.player_name === characterName
                    ? `You (${session.player_name})`
                    : session.player_name}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Time remaining:</span>
                <HuntTimer endsAt={session.ends_at} />
              </div>
            </div>
          )}

          {/* En route / claimed info */}
          {isClaimed && claimedItem && claimEndsAt && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-md px-3 py-2 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-blue-400 flex items-center gap-1">
                  <PersonStanding className="h-3 w-3" /> En route:
                </span>
                <span className="text-sm font-bold">
                  {isClaimedByMe ? `You (${claimedItem.player_name})` : claimedItem.player_name}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Time to start:</span>
                <HuntTimer endsAt={claimEndsAt} />
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {canStart ? (
              <Button
                size="sm"
                className="flex-1"
                onClick={() => setStartOpen(true)}
              >
                <Play className="h-3 w-3 mr-1" /> Start Hunt
              </Button>
            ) : isActive && (isAdmin || session?.player_name === characterName) ? (
              <Button
                size="sm"
                variant="destructive"
                className="flex-1"
                onClick={() => session && onEndHunt(session.id)}
              >
                <StopCircle className="h-3 w-3 mr-1" /> End Early
              </Button>
            ) : isClaimed && !canStart ? (
              <div className="flex-1 text-xs text-muted-foreground italic flex items-center justify-center py-1">
                Reserved — waiting for player to start
              </div>
            ) : null}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setQueueOpen(!queueOpen)}
              className="gap-1 flex-1"
            >
              <Users className="h-3 w-3" />
              Queue ({queue.length})
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
                playerSessionId={playerSessionId}
                characterName={characterName}
                isAdmin={isAdmin}
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
        characterName={characterName}
        isAdmin={isAdmin}
      />

      {isAdmin && (
        <DeleteConfirmModal
          open={deleteOpen}
          onClose={() => setDeleteOpen(false)}
          onConfirm={() => onDeleteSpot(spotId)}
          description={`Are you sure you want to delete the spot "${spotName}"?`}
        />
      )}
    </>
  );
}
