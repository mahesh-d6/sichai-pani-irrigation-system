import { useState } from "react";
import { CloudRain, Sun, Droplets, Wind, AlertCircle, X } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";

export default function WeatherWidget() {
  const { lang, t } = useLanguage();
  const [adviceDismissed, setAdviceDismissed] = useState(false);

  const weather = {
    temp: 28,
    humidity: 74,
    rainChance: 65,
    windSpeed: 12,
    condition: lang === "ne" ? "आंशिक बदली र वर्षाको सम्भावना" : "Partly Cloudy with Rain Expected",
  };

  return (
    <div className="glass-strong rounded-3xl p-6 border-canal-200 dark:border-canal-700 shadow-md mb-6 relative overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Sun size={24} />
          </div>
          <div>
            <h3 className="font-display font-semibold text-lg">{t("weather_forecast")}</h3>
            <p className="text-xs text-canal-500">{weather.condition}</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-3xl font-bold font-display text-earth-900 dark:text-canal-50">{weather.temp}°C</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="flex items-center gap-2 p-2.5 rounded-2xl bg-white/50 dark:bg-canal-900/40 border border-canal-100 dark:border-canal-800">
          <Droplets className="text-blue-500" size={18} />
          <div>
            <p className="text-[10px] text-canal-400 font-medium">Humidity</p>
            <p className="text-xs font-semibold">{weather.humidity}%</p>
          </div>
        </div>
        <div className="flex items-center gap-2 p-2.5 rounded-2xl bg-white/50 dark:bg-canal-900/40 border border-canal-100 dark:border-canal-800">
          <CloudRain className="text-canal-600" size={18} />
          <div>
            <p className="text-[10px] text-canal-400 font-medium">Rain Chance</p>
            <p className="text-xs font-semibold">{weather.rainChance}%</p>
          </div>
        </div>
        <div className="flex items-center gap-2 p-2.5 rounded-2xl bg-white/50 dark:bg-canal-900/40 border border-canal-100 dark:border-canal-800">
          <Wind className="text-teal-500" size={18} />
          <div>
            <p className="text-[10px] text-canal-400 font-medium">Wind</p>
            <p className="text-xs font-semibold">{weather.windSpeed} km/h</p>
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
                {lang === "ne"
                  ? "भोलि ६५% वर्षाको सम्भावना रहेकोले नहरबाट पानी सिँचाइ २४ घण्टा रोक्न सल्लाह दिइन्छ। यसले तपाईंको पानी खर्च बचत गर्छ।"
                  : "Heavy rain (65%) predicted tomorrow. Consider pausing new water requests for 24h to save water costs."}
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
