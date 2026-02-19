import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, UserPlus, CheckCircle, Clock, Loader2 } from "lucide-react";
import { HuntQueueItem } from "@/hooks/useHuntAdmin";
import { useToast } from "@/hooks/use-toast";

interface HuntQueuePanelProps {
  spotId: string;
  spotName: string;
  cityName: string;
  queue: HuntQueueItem[];
  playerSessionId: string;
  characterName: string;
  myQueueSpotId: string | null;
  isAdmin: boolean;
  onAdd: (spotId: string, playerName: string, sessionId: string) => Promise<void>;
  onRemove: (queueId: string) => Promise<void>;
  onClaim: (queueId: string) => Promise<void>;
}

const statusLabel: Record<string, string> = {
  waiting: "Waiting",
  notified: "Notified",
  claimed: "Claimed",
  expired: "Expired",
};

const statusColor: Record<string, string> = {
  waiting: "secondary",
  notified: "default",
  claimed: "outline",
  expired: "destructive",
};

export function HuntQueuePanel({
  spotId,
  spotName,
  cityName,
  queue,
  playerSessionId,
  characterName,
  myQueueSpotId,
  isAdmin,
  onAdd,
  onRemove,
  onClaim,
}: HuntQueuePanelProps) {
  const [joining, setJoining] = useState(false);
  const { toast } = useToast();

  const alreadyInThisQueue = myQueueSpotId === spotId;
  const alreadyInAnotherQueue = myQueueSpotId !== null && myQueueSpotId !== spotId;

  const handleJoin = async () => {
    if (!characterName.trim()) return;
    setJoining(true);
    try {
      await onAdd(spotId, characterName.trim(), playerSessionId);
      toast({ title: "Joined queue!", description: `You joined the queue for ${spotName} — ${cityName}` });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not join the queue.";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">
          Wait queue
        </span>
        {alreadyInThisQueue ? (
          <span className="text-xs text-primary font-medium">✅ You're in this queue</span>
        ) : alreadyInAnotherQueue ? (
          <span className="text-xs text-muted-foreground italic">You're in another queue</span>
        ) : (
          <Button size="sm" variant="outline" onClick={handleJoin} disabled={joining}>
            {joining
              ? <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              : <UserPlus className="h-3 w-3 mr-1" />
            }
            Join as {characterName}
          </Button>
        )}
      </div>

      {queue.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">No players in queue.</p>
      ) : (
        <div className="space-y-1">
          {queue.map((item, idx) => {
            const isMe = (item as HuntQueueItem & { session_id?: string }).session_id === playerSessionId;
            return (
              <div
                key={item.id}
                className={`flex items-center justify-between rounded-md px-2 py-1.5 gap-2 ${isMe ? "bg-primary/10 border border-primary/20" : "bg-muted/40"}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-bold text-muted-foreground w-4 shrink-0">
                    #{idx + 1}
                  </span>
                  <span className="text-sm font-medium truncate">
                    {isAdmin
                      ? item.player_name
                      : isMe
                      ? `You (${item.player_name})`
                      : "—"}
                  </span>
                  <Badge
                    variant={statusColor[item.status] as "default" | "secondary" | "destructive" | "outline"}
                    className="text-xs shrink-0"
                  >
                    {item.status === "notified" && <Clock className="h-2.5 w-2.5 mr-0.5" />}
                    {statusLabel[item.status]}
                  </Badge>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {item.status === "notified" && (isAdmin || isMe) && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 px-1.5 text-xs"
                      onClick={() => onClaim(item.id)}
                      title="Confirm presence"
                    >
                      <CheckCircle className="h-3 w-3" />
                    </Button>
                  )}
                  {(isAdmin || isMe) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                      onClick={() => onRemove(item.id)}
                      title="Leave queue"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
