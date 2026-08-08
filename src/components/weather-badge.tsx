import { Cloud, CloudDrizzle, CloudRain, CloudSnow, Sun, CloudSun } from "lucide-react";
import type { WeatherDay } from "@/hooks/use-weather";
import { cn } from "@/lib/utils";

function iconFor(code: number) {
  if (code === 0) return Sun;
  if (code <= 2) return CloudSun;
  if (code === 3 || code === 45 || code === 48) return Cloud;
  if (code >= 71 && code <= 77) return CloudSnow;
  if (code >= 51 && code <= 57) return CloudDrizzle;
  return CloudRain;
}

export function WeatherBadge({
  day,
  className,
  showRange = false,
}: {
  day?: WeatherDay;
  className?: string;
  showRange?: boolean;
}) {
  if (!day) return null;
  const Icon = iconFor(day.code);
  return (
    <span
      className={cn("inline-flex items-center gap-0.5 text-[9px] tabular-nums text-muted-foreground", className)}
      title={`${day.max}° / ${day.min}°`}
    >
      <Icon className="h-3 w-3 opacity-70" />
      {showRange ? `${day.max}°/${day.min}°` : `${day.max}°`}
    </span>
  );
}
