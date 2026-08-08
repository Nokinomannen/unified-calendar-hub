import { useQuery } from "@tanstack/react-query";

export type WeatherDay = {
  date: string; // yyyy-MM-dd
  code: number;
  max: number;
  min: number;
};

/** Deterministic pseudo-forecast so the UI always has something to show. */
function mockForecast(days: number): WeatherDay[] {
  const codes = [0, 1, 2, 3, 61, 80, 71];
  const out: WeatherDay[] = [];
  const base = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
    const seed = d.getDate() + d.getMonth() * 31;
    out.push({
      date: toKey(d),
      code: codes[seed % codes.length],
      max: 14 + ((seed * 7) % 12),
      min: 6 + ((seed * 3) % 7),
    });
  }
  return out;
}

function toKey(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const LOCATIONS = {
  malmo: { lat: 55.605, lon: 13.0 },
  aarhus: { lat: 56.157, lon: 10.21 },
} as const;

export type WeatherLocation = keyof typeof LOCATIONS;

/**
 * 5-day forecast. Tries Open-Meteo (keyless, CORS-friendly) and silently
 * falls back to a mock so the calendar never depends on the network.
 */
export function useWeather(location: WeatherLocation = "malmo") {
  return useQuery({
    queryKey: ["weather", location],
    staleTime: 30 * 60_000,
    queryFn: async (): Promise<WeatherDay[]> => {
      const { lat, lon } = LOCATIONS[location];
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
            `&daily=weather_code,temperature_2m_max,temperature_2m_min&forecast_days=5&timezone=auto`,
        );
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as {
          daily?: {
            time: string[];
            weather_code: number[];
            temperature_2m_max: number[];
            temperature_2m_min: number[];
          };
        };
        const d = json.daily;
        if (!d?.time?.length) throw new Error("no daily data");
        return d.time.map((t, i) => ({
          date: t,
          code: d.weather_code[i] ?? 0,
          max: Math.round(d.temperature_2m_max[i] ?? 0),
          min: Math.round(d.temperature_2m_min[i] ?? 0),
        }));
      } catch {
        return mockForecast(5);
      }
    },
    placeholderData: mockForecast(5),
  });
}

export function useWeatherMap(location: WeatherLocation = "malmo") {
  const q = useWeather(location);
  const map = new Map<string, WeatherDay>();
  for (const d of q.data ?? []) map.set(d.date, d);
  return map;
}
