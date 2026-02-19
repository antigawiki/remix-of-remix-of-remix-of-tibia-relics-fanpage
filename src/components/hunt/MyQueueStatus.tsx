import { Bell, CheckCircle, LogOut, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MyQueueItem } from "@/hooks/usePlayerSession";

interface MyQueueStatusProps {
  myQueueItem: MyQueueItem | null;
  onLeave: () => Promise<void>;
  onClaim: () => Promise<void>;
}

export function MyQueueStatus({ myQueueItem, onLeave, onClaim }: MyQueueStatusProps) {
  if (!myQueueItem) return null;

  const isNotified = myQueueItem.status === "notified";

  return (
    <div
      className={`border rounded-lg px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
        isNotified
          ? "border-yellow-500/60 bg-yellow-500/10"
          : "border-primary/30 bg-primary/5"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 ${isNotified ? "text-yellow-500" : "text-primary"}`}>
          {isNotified ? <Bell className="h-5 w-5" /> : <Target className="h-5 w-5" />}
        </div>
        <div>
          {isNotified ? (
            <>
              <p className="font-semibold text-sm text-yellow-500">🔔 Your turn is coming!</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Confirm at{" "}
                <span className="font-medium text-foreground">
                  {myQueueItem.city_name} — {myQueueItem.spot_name}
                </span>{" "}
                — you have 5 minutes!
              </p>
            </>
          ) : (
            <>
              <p className="font-semibold text-sm">🎯 Your Queue Status</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                You are{" "}
                <span className="font-bold text-foreground">#{myQueueItem.position}</span> in line
                at{" "}
                <span className="font-medium text-foreground">
                  {myQueueItem.city_name} — {myQueueItem.spot_name}
                </span>
              </p>
            </>
          )}
          <div className="mt-1">
            <Badge variant={isNotified ? "outline" : "secondary"} className={`text-xs ${isNotified ? "border-yellow-500/50 text-yellow-500" : ""}`}>
              {myQueueItem.status === "waiting" ? "Waiting" : "Notified — Act now!"}
            </Badge>
            <span className="ml-2 text-xs text-muted-foreground">
              Playing as: <span className="font-medium text-foreground">{myQueueItem.player_name}</span>
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {isNotified && (
          <Button
            size="sm"
            className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold"
            onClick={onClaim}
          >
            <CheckCircle className="h-3.5 w-3.5 mr-1" /> I'm on my way!
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={onLeave} className="text-destructive border-destructive/40 hover:bg-destructive/10">
          <LogOut className="h-3.5 w-3.5 mr-1" /> Leave Queue
        </Button>
      </div>
    </div>
  );
}
