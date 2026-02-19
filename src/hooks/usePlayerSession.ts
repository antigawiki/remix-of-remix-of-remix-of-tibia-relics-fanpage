import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

const SESSION_KEY = "hunt_session_id";

function getOrCreateSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export interface MyQueueItem {
  id: string;
  spot_id: string;
  player_name: string;
  position: number;
  status: "waiting" | "notified" | "claimed" | "expired";
  notified_at: string | null;
  created_at: string;
  session_id: string | null;
  // joined via spots/cities
  spot_name?: string;
  city_name?: string;
}

export function usePlayerSession() {
  const sessionId = useRef<string>(getOrCreateSessionId());
  const [myQueueItem, setMyQueueItem] = useState<MyQueueItem | null>(null);
  const prevStatus = useRef<string | null>(null);

  const sendBrowserNotification = useCallback((title: string, body: string) => {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body, icon: "/favicon.ico" });
    }
  }, []);

  const fetchMyItem = useCallback(async () => {
    const { data } = await supabase
      .from("hunt_queue")
      .select("*")
      .eq("session_id", sessionId.current)
      .in("status", ["waiting", "notified"])
      .maybeSingle();

    if (!data) {
      setMyQueueItem(null);
      prevStatus.current = null;
      return;
    }

    // Fetch spot and city info
    const { data: spot } = await supabase
      .from("hunt_spots")
      .select("name, city_id")
      .eq("id", data.spot_id)
      .maybeSingle();

    let cityName: string | undefined;
    if (spot?.city_id) {
      const { data: city } = await supabase
        .from("hunt_cities")
        .select("name")
        .eq("id", spot.city_id)
        .maybeSingle();
      cityName = city?.name;
    }

    const item: MyQueueItem = {
      ...data,
      status: data.status as MyQueueItem["status"],
      spot_name: spot?.name,
      city_name: cityName,
    };

    // Fire notification if status changed to notified
    if (prevStatus.current !== "notified" && item.status === "notified") {
      sendBrowserNotification(
        "🎯 Your turn is coming!",
        `Get ready at ${item.spot_name ?? "your spot"} — you have 5 minutes to confirm!`
      );
    }

    prevStatus.current = item.status;
    setMyQueueItem(item);
  }, [sendBrowserNotification]);

  const leaveQueue = useCallback(async () => {
    if (!myQueueItem) return;
    await supabase.from("hunt_queue").delete().eq("id", myQueueItem.id);
    setMyQueueItem(null);
    prevStatus.current = null;
  }, [myQueueItem]);

  const claimMySpot = useCallback(async () => {
    if (!myQueueItem) return;
    await supabase
      .from("hunt_queue")
      .update({ status: "claimed" })
      .eq("id", myQueueItem.id);
    setMyQueueItem(null);
    prevStatus.current = null;
  }, [myQueueItem]);

  // Poll every 15s
  useEffect(() => {
    fetchMyItem();
    const interval = setInterval(fetchMyItem, 15000);
    return () => clearInterval(interval);
  }, [fetchMyItem]);

  // Request notification permission on mount
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  return {
    sessionId: sessionId.current,
    myQueueItem,
    leaveQueue,
    claimMySpot,
    refetch: fetchMyItem,
  };
}
