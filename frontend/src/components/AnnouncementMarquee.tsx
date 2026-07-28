import { Megaphone } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";

export default function AnnouncementMarquee() {
  const { lang, t } = useLanguage();

  const announcements = lang === "ne"
    ? [
        "📢 सूचना: उत्तर नहरमा पानी आपूर्ति नियमित सञ्चालनमा छ ।",
        "💧 जल दर: रु. २०० प्रति घण्टा | समयमै भुक्तानी गरी जरिवानाबाट बच्नुहोस्।",
        "⚠️ सेक्टर ४ मा भोलि पूर्वाग्रह मर्मत सम्भार हुने हुँदा सिँचाइ सेवा बिहान ९ देखि १२ सम्म स्थगन रहनेछ।",
        "🌾 कृषि सल्लाह: भोलि वर्षाको सम्भावना भएकोले सिँचाइ सिफारिस २४ घण्टा स्थगित गरिएको छ।",
      ]
    : [
        "📢 System Notice: Main Canal North water supply is running normally.",
        "💧 Water Rate: Rs. 200 / hour | Pay pending bills on time to avoid disruption.",
        "⚠️ Scheduled maintenance on Sector 4 tomorrow from 9 AM to 12 PM.",
        "🌾 Weather Advisory: Heavy rain expected tomorrow — delay irrigation by 24h to save water.",
      ];

  return (
    <div className="w-full glass-strong rounded-2xl p-2.5 mb-6 overflow-hidden flex items-center gap-3 border-canal-300 dark:border-canal-700 shadow-sm">
      <div className="flex items-center gap-1.5 bg-canal-600 text-white px-2.5 py-1 rounded-xl text-xs font-semibold flex-shrink-0 shadow-sm">
        <Megaphone size={14} className="animate-bounce" />
        <span>{t("system_announcements")}</span>
      </div>
      <div className="overflow-hidden relative w-full flex-1">
        <div className="animate-marquee whitespace-nowrap flex gap-12 text-xs font-medium text-earth-800 dark:text-canal-100">
          {announcements.map((text, idx) => (
            <span key={idx} className="flex items-center gap-2">
              {text}
            </span>
          ))}
          {/* Duplicate for seamless infinite loop */}
          {announcements.map((text, idx) => (
            <span key={`dup-${idx}`} className="flex items-center gap-2">
              {text}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
