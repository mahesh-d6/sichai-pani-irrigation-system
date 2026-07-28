import { useState } from "react";
import { FileSpreadsheet, FileText, Download } from "lucide-react";
import api from "../services/api";

export default function Reports() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const download = async (path: string, filename: string) => {
    const res = await api.get(path, {
      params: { date_from: dateFrom || undefined, date_to: dateTo || undefined },
      responseType: "blob",
    });
    const url = URL.createObjectURL(new Blob([res.data]));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const reports = [
    { title: "Water History (CSV)", icon: FileText, action: () => download("/api/reports/water-history.csv", "water_history.csv") },
    { title: "Water History (Excel)", icon: FileSpreadsheet, action: () => download("/api/reports/water-history.xlsx", "water_history.xlsx") },
  ];

  return (
    <div className="flex flex-col gap-5">
      <h2 className="font-display text-xl font-semibold">Reports</h2>

      <div className="glass rounded-2xl p-5 flex flex-wrap items-end gap-4">
        <div>
          <label className="text-xs text-canal-500 block mb-1">From</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="input" />
        </div>
        <div>
          <label className="text-xs text-canal-500 block mb-1">To</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="input" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {reports.map(({ title, icon: Icon, action }) => (
          <button key={title} onClick={action} className="glass rounded-2xl p-5 flex items-center justify-between hover:scale-[1.01] transition-transform text-left">
            <span className="flex items-center gap-3 font-medium"><Icon size={20} className="text-canal-600" /> {title}</span>
            <Download size={18} className="text-canal-500" />
          </button>
        ))}
      </div>
    </div>
  );
}
