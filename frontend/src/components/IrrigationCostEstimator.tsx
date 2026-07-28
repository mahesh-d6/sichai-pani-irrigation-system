import { useState } from "react";
import { Calculator, Droplets } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";

export default function IrrigationCostEstimator() {
  const { lang } = useLanguage();
  const [hours, setHours] = useState(3);
  const [crop, setCrop] = useState("Paddy");
  const ratePerHour = 200;

  const totalCost = hours * ratePerHour;
  const estimatedLiters = hours * 1200; // ~1200 Liters/hr flow

  return (
    <div className="glass-strong rounded-3xl p-5 border-canal-200 dark:border-canal-700 shadow-sm mb-6">
      <div className="flex items-center gap-2 mb-3 text-paddy-700 dark:text-paddy-300">
        <Calculator size={20} />
        <h3 className="font-display font-semibold text-base">
          {lang === "ne" ? "सिँचाइ खर्च र जल मात्रा अनुमान (Cost Calculator)" : "Smart Irrigation Cost Estimator"}
        </h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div>
          <label className="text-xs font-medium block mb-1 text-canal-600 dark:text-canal-300">
            {lang === "ne" ? "बाली छान्नुहोस् (Crop Type)" : "Select Crop"}
          </label>
          <select
            value={crop}
            onChange={(e) => setCrop(e.target.value)}
            className="input text-xs"
          >
            <option value="Paddy">{lang === "ne" ? "धान (Paddy)" : "Paddy (Rice)"}</option>
            <option value="Wheat">{lang === "ne" ? "गहुँ (Wheat)" : "Wheat"}</option>
            <option value="Maize">{lang === "ne" ? "मकै (Maize)" : "Maize"}</option>
            <option value="Sugarcane">{lang === "ne" ? "उखु (Sugarcane)" : "Sugarcane"}</option>
            <option value="Vegetables">{lang === "ne" ? "तरकारी (Vegetables)" : "Vegetables"}</option>
          </select>
        </div>

        <div>
          <label className="text-xs font-medium block mb-1 text-canal-600 dark:text-canal-300">
            {lang === "ne" ? "सिँचाइ अवधि (घण्टा)" : "Duration (Hours)"}
          </label>
          <input
            type="number"
            min={1}
            max={48}
            value={hours}
            onChange={(e) => setHours(Math.max(1, Number(e.target.value)))}
            className="input text-xs"
          />
        </div>

        <div className="flex flex-col justify-center p-3 rounded-2xl bg-paddy-500/10 border border-paddy-500/30">
          <p className="text-[11px] text-paddy-700 dark:text-paddy-300 font-medium">Estimated Total Bill</p>
          <p className="text-xl font-bold font-display text-paddy-800 dark:text-paddy-100">
            Rs. {totalCost.toLocaleString()}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-canal-600 dark:text-canal-300 bg-canal-50 dark:bg-canal-900/40 p-2.5 rounded-xl border border-canal-100 dark:border-canal-800">
        <Droplets size={16} className="text-canal-500 flex-shrink-0" />
        <span>
          {lang === "ne"
            ? `अनुमानित पानी प्रवाह: ~${estimatedLiters.toLocaleString()} लिटर (${hours} घण्टाको लागि) | जल दर: रु. २००/घण्टा`
            : `Estimated Water Flow: ~${estimatedLiters.toLocaleString()} Liters for ${hours}h | Standard Rate: Rs. 200/hr`}
        </span>
      </div>
    </div>
  );
}
