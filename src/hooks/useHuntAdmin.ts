import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface HuntCity {
  id: string;
  name: string;
  created_at: string;
}

export interface HuntSpot {
  id: string;
  city_id: string;
  name: string;
  max_duration_minutes: number;
  created_at: string;
}

export interface HuntSession {
  id: string;
  spot_id: string;
  player_name: string;
  started_at: string;
  ends_at: string;
  status: "active" | "ending" | "finished";
  notified_1h: boolean;
  notified_15min: boolean;
  created_at: string;
}

export interface HuntQueueItem {
  id: string;
  spot_id: string;
  player_name: string;
  position: number;
  status: "waiting" | "notified" | "claimed" | "expired";
  notified_at: string | null;
  created_at: string;
}

export function useHuntAdmin() {
  const { toast } = useToast();
  const [cities, setCities] = useState<HuntCity[]>([]);
  const [spots, setSpots] = useState<HuntSpot[]>([]);
  const [sessions, setSessions] = useState<HuntSession[]>([]);
  const [queue, setQueue] = useState<HuntQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const notificationPermission = useRef<NotificationPermission>("default");

  // Request notification permission
  const requestNotificationPermission = useCallback(async () => {
    if ("Notification" in window) {
      const perm = await Notification.requestPermission();
      notificationPermission.current = perm;
    }
  }, []);

  const sendBrowserNotification = useCallback((title: string, body: string) => {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body, icon: "/favicon.ico" });
    }
  }, []);

  // Fetch all data
  const fetchAll = useCallback(async () => {
    const [citiesRes, spotsRes, sessionsRes, queueRes] = await Promise.all([
      supabase.from("hunt_cities").select("*").order("name"),
      supabase.from("hunt_spots").select("*").order("name"),
      supabase.from("hunt_sessions").select("*").eq("status", "active").order("started_at"),
      supabase.from("hunt_queue").select("*").in("status", ["waiting", "notified"]).order("position"),
    ]);

    if (citiesRes.data) setCities(citiesRes.data as HuntCity[]);
    if (spotsRes.data) setSpots(spotsRes.data as HuntSpot[]);
    if (sessionsRes.data) setSessions(sessionsRes.data as HuntSession[]);
    if (queueRes.data) setQueue(queueRes.data as HuntQueueItem[]);
    setLoading(false);
  }, []);

  // Check timers and send notifications
  const checkNotifications = useCallback(async () => {
    const now = new Date();

    for (const session of sessions) {
      const endsAt = new Date(session.ends_at);
      const minutesLeft = (endsAt.getTime() - now.getTime()) / 60000;

      // Auto-finish if expired
      if (minutesLeft <= 0 && session.status === "active") {
        await supabase
          .from("hunt_sessions")
          .update({ status: "finished" })
          .eq("id", session.id);

        const spot = spots.find((s) => s.id === session.spot_id);
        const city = cities.find((c) => c.id === spot?.city_id);
        sendBrowserNotification(
          "🏁 Hunt Encerrada!",
          `${spot?.name} em ${city?.name} — tempo esgotado!`
        );

        // Notify next in queue
        await promoteNextInQueue(session.spot_id);
        continue;
      }

      // 1h notification
      if (minutesLeft <= 60 && minutesLeft > 59 && !session.notified_1h) {
        await supabase
          .from("hunt_sessions")
          .update({ notified_1h: true })
          .eq("id", session.id);

        const spot = spots.find((s) => s.id === session.spot_id);
        const city = cities.find((c) => c.id === spot?.city_id);
        sendBrowserNotification(
          "⏰ 1 hora restante!",
          `Faltam 60min para ${spot?.name} em ${city?.name}`
        );
        toast({ title: "⏰ 1 hora restante!", description: `${spot?.name} em ${city?.name}` });

        // Notify next in queue
        const nextInQueue = queue.find(
          (q) => q.spot_id === session.spot_id && q.status === "waiting"
        );
        if (nextInQueue) {
          await supabase
            .from("hunt_queue")
            .update({ status: "notified", notified_at: now.toISOString() })
            .eq("id", nextInQueue.id);
          sendBrowserNotification(
            "🎯 Próximo da fila: prepare-se!",
            `Sua vez em ${spot?.name} em ~1 hora!`
          );
        }
      }

      // 15min notification
      if (minutesLeft <= 15 && minutesLeft > 14 && !session.notified_15min) {
        await supabase
          .from("hunt_sessions")
          .update({ notified_15min: true, status: "ending" })
          .eq("id", session.id);

        const spot = spots.find((s) => s.id === session.spot_id);
        const city = cities.find((c) => c.id === spot?.city_id);
        sendBrowserNotification(
          "⚠️ 15 minutos restantes!",
          `Recolha o loot! ${spot?.name} em ${city?.name}`
        );
        toast({ title: "⚠️ 15 minutos!", description: `Hora de recolher o loot em ${spot?.name}` });

        // Notify next in queue
        const nextInQueue = queue.find(
          (q) => q.spot_id === session.spot_id && (q.status === "waiting" || q.status === "notified")
        );
        if (nextInQueue) {
          await supabase
            .from("hunt_queue")
            .update({ status: "notified", notified_at: now.toISOString() })
            .eq("id", nextInQueue.id);
          sendBrowserNotification(
            "🎯 Sua vez em 15 minutos!",
            `Prepare-se para ${spot?.name}!`
          );
        }
      }
    }

    // Check claimed expiration (5 minutes)
    for (const qItem of queue) {
      if (qItem.status === "notified" && qItem.notified_at) {
        const notifiedAt = new Date(qItem.notified_at);
        const minutesSinceNotified = (now.getTime() - notifiedAt.getTime()) / 60000;
        if (minutesSinceNotified >= 5) {
          await supabase
            .from("hunt_queue")
            .update({ status: "expired" })
            .eq("id", qItem.id);

          // Promote the next person
          await promoteNextInQueue(qItem.spot_id);
        }
      }
    }
  }, [sessions, spots, cities, queue, sendBrowserNotification, toast]);

  const promoteNextInQueue = useCallback(async (spotId: string) => {
    const nextWaiting = queue
      .filter((q) => q.spot_id === spotId && q.status === "waiting")
      .sort((a, b) => a.position - b.position)[0];

    if (nextWaiting) {
      await supabase
        .from("hunt_queue")
        .update({ status: "notified", notified_at: new Date().toISOString() })
        .eq("id", nextWaiting.id);

      const spot = spots.find((s) => s.id === spotId);
      sendBrowserNotification(
        "🎯 Sua vez chegou!",
        `${spot?.name} está livre! Você tem 5 minutos para clamar.`
      );
    }
  }, [queue, spots, sendBrowserNotification]);

  // City CRUD
  const addCity = useCallback(async (name: string) => {
    const { error } = await supabase.from("hunt_cities").insert({ name });
    if (error) throw error;
    await fetchAll();
  }, [fetchAll]);

  const deleteCity = useCallback(async (id: string) => {
    const { error } = await supabase.from("hunt_cities").delete().eq("id", id);
    if (error) throw error;
    await fetchAll();
  }, [fetchAll]);

  // Spot CRUD
  const addSpot = useCallback(async (cityId: string, name: string, maxDuration = 240) => {
    const { error } = await supabase.from("hunt_spots").insert({
      city_id: cityId,
      name,
      max_duration_minutes: maxDuration,
    });
    if (error) throw error;
    await fetchAll();
  }, [fetchAll]);

  const deleteSpot = useCallback(async (id: string) => {
    const { error } = await supabase.from("hunt_spots").delete().eq("id", id);
    if (error) throw error;
    await fetchAll();
  }, [fetchAll]);

  // Session CRUD
  const startHunt = useCallback(async (spotId: string, playerName: string) => {
    const spot = spots.find((s) => s.id === spotId);
    const maxMinutes = spot?.max_duration_minutes ?? 240;
    const startedAt = new Date();
    const endsAt = new Date(startedAt.getTime() + maxMinutes * 60000);

    const { error } = await supabase.from("hunt_sessions").insert({
      spot_id: spotId,
      player_name: playerName,
      started_at: startedAt.toISOString(),
      ends_at: endsAt.toISOString(),
      status: "active",
    });
    if (error) throw error;

    const city = cities.find((c) => c.id === spot?.city_id);
    sendBrowserNotification("🏹 Hunt Iniciada!", `${playerName} em ${spot?.name}, ${city?.name}`);
    await fetchAll();
  }, [spots, cities, sendBrowserNotification, fetchAll]);

  const endHuntEarly = useCallback(async (sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId);
    const { error } = await supabase
      .from("hunt_sessions")
      .update({ status: "finished" })
      .eq("id", sessionId);
    if (error) throw error;

    if (session) {
      await promoteNextInQueue(session.spot_id);
    }
    await fetchAll();
  }, [sessions, promoteNextInQueue, fetchAll]);

  // Queue CRUD
  const addToQueue = useCallback(async (spotId: string, playerName: string) => {
    const spotQueue = queue
      .filter((q) => q.spot_id === spotId && (q.status === "waiting" || q.status === "notified"))
      .sort((a, b) => b.position - a.position);

    const nextPosition = spotQueue.length > 0 ? spotQueue[0].position + 1 : 1;

    const { error } = await supabase.from("hunt_queue").insert({
      spot_id: spotId,
      player_name: playerName,
      position: nextPosition,
      status: "waiting",
    });
    if (error) throw error;
    await fetchAll();
  }, [queue, fetchAll]);

  const removeFromQueue = useCallback(async (queueId: string) => {
    const { error } = await supabase.from("hunt_queue").delete().eq("id", queueId);
    if (error) throw error;
    await fetchAll();
  }, [fetchAll]);

  const claimSpot = useCallback(async (queueId: string) => {
    const { error } = await supabase
      .from("hunt_queue")
      .update({ status: "claimed" })
      .eq("id", queueId);
    if (error) throw error;
    await fetchAll();
  }, [fetchAll]);

  // Setup realtime + polling
  useEffect(() => {
    fetchAll();
    requestNotificationPermission();

    const channel = supabase
      .channel("hunt-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "hunt_cities" }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "hunt_spots" }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "hunt_sessions" }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "hunt_queue" }, fetchAll)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAll, requestNotificationPermission]);

  // Polling for notifications every 30s
  useEffect(() => {
    const interval = setInterval(checkNotifications, 30000);
    return () => clearInterval(interval);
  }, [checkNotifications]);

  // Derived data
  const getSessionForSpot = useCallback(
    (spotId: string) => sessions.find((s) => s.spot_id === spotId && s.status !== "finished"),
    [sessions]
  );

  const getQueueForSpot = useCallback(
    (spotId: string) =>
      queue
        .filter((q) => q.spot_id === spotId && (q.status === "waiting" || q.status === "notified"))
        .sort((a, b) => a.position - b.position),
    [queue]
  );

  const getSpotsForCity = useCallback(
    (cityId: string) => spots.filter((s) => s.city_id === cityId),
    [spots]
  );

  const totalActive = sessions.filter((s) => s.status !== "finished").length;
  const totalInQueue = queue.filter((q) => q.status === "waiting" || q.status === "notified").length;
  const totalFreeSpots = spots.length - totalActive;

  return {
    cities,
    spots,
    sessions,
    queue,
    loading,
    totalActive,
    totalInQueue,
    totalFreeSpots,
    addCity,
    deleteCity,
    addSpot,
    deleteSpot,
    startHunt,
    endHuntEarly,
    addToQueue,
    removeFromQueue,
    claimSpot,
    getSessionForSpot,
    getQueueForSpot,
    getSpotsForCity,
    fetchAll,
  };
}
