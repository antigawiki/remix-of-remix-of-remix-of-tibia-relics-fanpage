import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface HuntTimerProps {
  endsAt: string;
  className?: string;
}

function getTimeLeft(endsAt: string) {
  const now = new Date().getTime();
  const end = new Date(endsAt).getTime();
  const diff = end - now;
  if (diff <= 0) return { hours: 0, minutes: 0, seconds: 0, totalMinutes: 0 };

  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  const totalMinutes = diff / 60000;
  return { hours, minutes, seconds, totalMinutes };
}

export function HuntTimer({ endsAt, className }: HuntTimerProps) {
  const [timeLeft, setTimeLeft] = useState(() => getTimeLeft(endsAt));

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(getTimeLeft(endsAt));
    }, 1000);
    return () => clearInterval(interval);
  }, [endsAt]);

  const colorClass =
    timeLeft.totalMinutes > 60
      ? "text-green-400"
      : timeLeft.totalMinutes > 15
      ? "text-yellow-400"
      : "text-red-400";

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <span className={cn("font-mono font-bold text-lg", colorClass, className)}>
      {pad(timeLeft.hours)}:{pad(timeLeft.minutes)}:{pad(timeLeft.seconds)}
    </span>
  );
}
