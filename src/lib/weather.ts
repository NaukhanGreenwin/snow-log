/* Current conditions at the site from Open-Meteo (free, no key), by the phone's GPS.
   Snowfall = total of the last 12 hours, in cm. Everything stays editable on the form. */
import type { Gps, Weather } from "./types";

export const CONDITIONS = [
  "Clear", "Mainly clear", "Overcast", "Fog", "Light snow", "Snow", "Heavy snow", "Blowing snow",
  "Freezing drizzle", "Freezing rain", "Rain", "Ice pellets",
] as const;

function codeToCondition(c: number): string {
  if (c === 0) return "Clear";
  if (c === 1 || c === 2) return "Mainly clear";
  if (c === 3) return "Overcast";
  if (c === 45 || c === 48) return "Fog";
  if (c === 56 || c === 57 || c === 66 || c === 67) return c === 56 || c === 57 ? "Freezing drizzle" : "Freezing rain";
  if (c >= 51 && c <= 65) return "Rain";
  if (c === 71 || c === 85) return "Light snow";
  if (c === 73) return "Snow";
  if (c === 75 || c === 86) return "Heavy snow";
  if (c === 77) return "Ice pellets";
  if (c >= 80 && c <= 82) return "Rain";
  return "Overcast";
}

export function getGps(timeoutMs = 12000): Promise<Gps> {
  return new Promise((res, rej) => {
    if (!("geolocation" in navigator)) { rej(new Error("This phone does not share its location with the browser.")); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => res({ lat: +p.coords.latitude.toFixed(5), lon: +p.coords.longitude.toFixed(5), acc: Math.round(p.coords.accuracy), at: new Date().toISOString() }),
      (e) => rej(new Error(e.code === 1 ? "Location is turned off for this site. Allow it in the browser settings, or type the weather in." : "The phone could not get a location fix. Try again outside.")),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60_000 },
    );
  });
}

export async function fetchWeather(g: Gps): Promise<Weather> {
  if (!navigator.onLine) throw new Error("No connection. Type the weather in; it can be filled later.");
  const u = new URL("https://api.open-meteo.com/v1/forecast");
  u.searchParams.set("latitude", String(g.lat));
  u.searchParams.set("longitude", String(g.lon));
  u.searchParams.set("current", "temperature_2m,weather_code,wind_speed_10m");
  u.searchParams.set("hourly", "snowfall");
  u.searchParams.set("past_hours", "12");
  u.searchParams.set("forecast_hours", "1");
  u.searchParams.set("timezone", "America/Edmonton");
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 10_000);
  try {
    const r = await fetch(u, { signal: ctl.signal });
    if (!r.ok) throw new Error("The weather service did not answer. Type the weather in.");
    const j = await r.json();
    const cur = j.current ?? {};
    const snow: number[] = (j.hourly?.snowfall ?? []).slice(0, 12);
    const cm = snow.reduce((a: number, b: number) => a + (Number(b) || 0), 0);
    return {
      tempC: cur.temperature_2m != null ? String(Math.round(cur.temperature_2m)) : "",
      conditions: cur.weather_code != null ? codeToCondition(Number(cur.weather_code)) : "",
      snowCm: String(Math.round(cm * 10) / 10),
      wind: cur.wind_speed_10m != null ? String(Math.round(cur.wind_speed_10m)) : "",
      source: "open-meteo",
      fetchedAt: new Date().toISOString(),
    };
  } catch (e) {
    if ((e as Error).name === "AbortError") throw new Error("The weather service took too long. Type the weather in.");
    throw e;
  } finally { clearTimeout(t); }
}
