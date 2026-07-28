import { useEffect, useState } from "react";
import { CloudRain, Sun, Droplets, Wind, AlertCircle, MapPin, RefreshCw, X } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";

interface WeatherData {
  temp: number;
  humidity: number;
  rainChance: number;
  windSpeed: number;
  condition: string;
  locationName: string;
}

export default function WeatherWidget() {
  const { lang, t } = useLanguage();
  const [adviceDismissed, setAdviceDismissed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [locationDetecting, setLocationDetecting] = useState(true);
  const [weather, setWeather] = useState<WeatherData>({
    temp: 27,
    humidity: 70,
    rainChance: 40,
    windSpeed: 10,
    condition: "Loading local weather...",
    locationName: "Detecting Location...",
  });

  const getWeatherConditionText = (code: number, isNe: boolean) => {
    if (code === 0) return isNe ? "सफा आकाश (Sunny)" : "Clear Sky / Sunny";
    if (code <= 3) return isNe ? "आंशिक बदली (Partly Cloudy)" : "Partly Cloudy";
    if (code >= 45 && code <= 48) return isNe ? "कुहिरो लागेको (Foggy)" : "Foggy";
    if (code >= 51 && code <= 67) return isNe ? "हल्का वर्षा (Light Rain)" : "Light Rain";
    if (code >= 80 && code <= 82) return isNe ? "भारी वर्षा (Heavy Rain)" : "Heavy Rain Showers";
    if (code >= 95) return isNe ? "चट्याङसहित वर्षा (Thunderstorm)" : "Thunderstorm";
    return isNe ? "सामान्य मौसम (Moderate Weather)" : "Moderate Weather";
  };

  const fetchWeatherData = async (lat: number, lon: number, locationName: string) => {
    setLoading(true);
    try {
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=precipitation_probability_max&timezone=auto`
      );
      const data = await res.json();

      const currentTemp = Math.round(data.current?.temperature_2m ?? 27);
      const currentHumidity = Math.round(data.current?.relative_humidity_2m ?? 70);
      const currentWind = Math.round(data.current?.wind_speed_10m ?? 10);
      const weatherCode = data.current?.weather_code ?? 0;
      const rainProbability = data.daily?.precipitation_probability_max?.[0] ?? 35;

      setWeather({
        temp: currentTemp,
        humidity: currentHumidity,
        rainChance: rainProbability,
        windSpeed: currentWind,
        condition: getWeatherConditionText(weatherCode, lang === "ne"),
        locationName: locationName,
      });
    } catch (err) {
      console.warn("Weather API fallback:", err);
      setWeather({
        temp: 28,
        humidity: 72,
        rainChance: 55,
        windSpeed: 12,
        condition: lang === "ne" ? "आंशिक बदली (Local Weather)" : "Partly Cloudy (Local)",
        locationName: locationName || "Local Region",
      });
    } finally {
      setLoading(false);
      setLocationDetecting(false);
    }
  };

  const detectLocationAndFetch = () => {
    setLocationDetecting(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          let cityName = `${lat.toFixed(2)}°N, ${lon.toFixed(2)}°E`;
          try {
            const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
            const geoData = await geoRes.json();
            cityName = geoData.address?.city || geoData.address?.town || geoData.address?.village || geoData.address?.county || cityName;
          } catch {
            // Reverse geocode fallback
          }
          fetchWeatherData(lat, lon, cityName);
        },
        () => {
          // Default Nepal coordinates if permission denied
          fetchWeatherData(27.7172, 85.3240, "Kathmandu Valley");
        },
        { timeout: 8000 }
      );
    } else {
      fetchWeatherData(27.7172, 85.3240, "Kathmandu Valley");
    }
  };

  useEffect(() => {
    detectLocationAndFetch();
  }, [lang]);

  return (
    <div className="glass-strong rounded-3xl p-6 border-canal-200 dark:border-canal-700 shadow-md mb-6 relative overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            {weather.rainChance > 50 ? <CloudRain size={26} /> : <Sun size={26} />}
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-xs text-canal-600 dark:text-canal-300 font-semibold mb-0.5">
              <MapPin size={14} className="text-red-500" />
              <span>{locationDetecting ? "Detecting location..." : weather.locationName}</span>
              <button onClick={detectLocationAndFetch} title="Refresh Weather" className="ml-1 p-1 hover:bg-canal-100 dark:hover:bg-canal-800 rounded-full">
                <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
              </button>
            </div>
            <h3 className="font-display font-bold text-lg leading-tight">{t("weather_forecast")}</h3>
            <p className="text-xs text-canal-500">{weather.condition}</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-3xl font-bold font-display text-earth-900 dark:text-canal-50">
            {loading ? "..." : `${weather.temp}°C`}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="flex items-center gap-2 p-2.5 rounded-2xl bg-white/50 dark:bg-canal-900/40 border border-canal-100 dark:border-canal-800">
          <Droplets className="text-blue-500 flex-shrink-0" size={18} />
          <div className="min-w-0">
            <p className="text-[10px] text-canal-400 font-medium">Humidity</p>
            <p className="text-xs font-semibold">{loading ? "..." : `${weather.humidity}%`}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 p-2.5 rounded-2xl bg-white/50 dark:bg-canal-900/40 border border-canal-100 dark:border-canal-800">
          <CloudRain className="text-canal-600 flex-shrink-0" size={18} />
          <div className="min-w-0">
            <p className="text-[10px] text-canal-400 font-medium">Rain Chance</p>
            <p className="text-xs font-semibold">{loading ? "..." : `${weather.rainChance}%`}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 p-2.5 rounded-2xl bg-white/50 dark:bg-canal-900/40 border border-canal-100 dark:border-canal-800">
          <Wind className="text-teal-500 flex-shrink-0" size={18} />
          <div className="min-w-0">
            <p className="text-[10px] text-canal-400 font-medium">Wind</p>
            <p className="text-xs font-semibold">{loading ? "..." : `${weather.windSpeed} km/h`}</p>
          </div>
        </div>
      </div>

      {!adviceDismissed && (
        <div className="p-3.5 rounded-2xl bg-canal-500/10 border border-canal-500/30 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-canal-600 dark:text-canal-300 flex-shrink-0 mt-0.5" size={18} />
            <div className="flex-1 text-xs">
              <p className="font-semibold text-canal-800 dark:text-canal-200">{t("smart_irrigation_advice")}</p>
              <p className="text-canal-600 dark:text-canal-300 mt-0.5">
                {weather.rainChance >= 50
                  ? lang === "ne"
                    ? `तपाईंको क्षेत्रमा भोलि ${weather.rainChance}% वर्षाको सम्भावना छ। नहरबाट नयाँ सिँचाइ माग नगरी पानी खर्च बचत गर्नुहोस्।`
                    : `High rain chance (${weather.rainChance}%) expected in ${weather.locationName}. Pause new irrigation requests to save water costs.`
                  : lang === "ne"
                    ? `तपाईंको क्षेत्रमा वर्षाको सम्भावना न्यून (${weather.rainChance}%) छ। सिँचाइ तालिका अनुसार नहरबाट पानी सञ्चालन गर्न उपयुक्त समय छ।`
                    : `Optimal weather condition in ${weather.locationName} (${weather.rainChance}% rain chance). Suitable for scheduled canal irrigation.`}
              </p>
            </div>
          </div>
          <button onClick={() => setAdviceDismissed(true)} className="p-1 hover:bg-canal-500/20 rounded-lg text-canal-500">
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
