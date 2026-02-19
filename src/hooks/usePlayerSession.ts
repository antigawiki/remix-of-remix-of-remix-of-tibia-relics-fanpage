import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

const SESSION_KEY = "hunt_session_id";
const CHAR_NAME_KEY = "hunt_character_name";

function getOrCreateSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export function getStoredCharacterName(): string {
  return localStorage.getItem(CHAR_NAME_KEY) ?? "";
}

export function setStoredCharacterName(name: string): void {
  localStorage.setItem(CHAR_NAME_KEY, name);
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
  spot_name?: string;
  city_name?: string;
}

export function usePlayerSession() {
  const sessionId = useRef<string>(getOrCreateSessionId());
  const [characterName, setCharacterName] = useState<string>(getStoredCharacterName);
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

    if (prevStatus.current !== "notified" && item.status === "notified") {
      sendBrowserNotification(
        "🎯 Your turn is coming!",
        `Get ready at ${item.spot_name ?? "your spot"} — you have 5 minutes to confirm!`
      );
    }

    prevStatus.current = item.status;
    setMyQueueItem(item);
  }, [sendBrowserNotification]);

  const saveCharacterName = useCallback((name: string) => {
    setStoredCharacterName(name);
    setCharacterName(name);
  }, []);

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

  useEffect(() => {
    fetchMyItem();
    const interval = setInterval(fetchMyItem, 15000);
    return () => clearInterval(interval);
  }, [fetchMyItem]);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  return {
    sessionId: sessionId.current,
    characterName,
    saveCharacterName,
    myQueueItem,
    leaveQueue,
    claimMySpot,
    refetch: fetchMyItem,
  };
}
