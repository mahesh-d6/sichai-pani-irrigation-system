import { useRef } from "react";
import { Printer, CheckCircle, Waves, X } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";

interface PrintableReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  requestData?: {
    id: number;
    farmerName: string;
    farmerCode?: string;
    crop: string;
    canal: string;
    hours: number;
    amount: number;
    date: string;
    paymentMethod: string;
    transactionId?: string;
  };
}

export default function PrintableReceiptModal({ isOpen, onClose, requestData }: PrintableReceiptModalProps) {
  const { t } = useLanguage();
  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !requestData) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="glass-strong rounded-3xl p-6 w-full max-w-lg border-canal-200 dark:border-canal-700 shadow-2xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full hover:bg-canal-100 dark:hover:bg-canal-800">
          <X size={18} />
        </button>

        <div ref={printRef} className="bg-white text-earth-900 p-6 rounded-2xl border border-canal-200 shadow-inner mb-6">
          <div className="flex items-center justify-between border-b pb-4 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-canal-600 flex items-center justify-center text-white font-bold">
                <Waves size={22} />
              </div>
              <div>
                <h2 className="font-display font-bold text-lg leading-tight">Sichai Pani</h2>
                <p className="text-[10px] text-canal-500">Irrigation Services Nepal</p>
              </div>
            </div>
            <div className="text-right">
              <span className="inline-flex items-center gap-1 text-xs font-semibold bg-green-100 text-green-700 px-2.5 py-1 rounded-full">
                <CheckCircle size={12} /> PAID
              </span>
              <p className="text-[10px] text-gray-400 mt-1">Receipt #{requestData.id.toString().padStart(6, "0")}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs mb-4">
            <div>
              <p className="text-gray-400 font-medium">Farmer Name</p>
              <p className="font-semibold text-sm">{requestData.farmerName}</p>
              {requestData.farmerCode && <p className="text-[11px] text-canal-600">Code: {requestData.farmerCode}</p>}
            </div>
            <div>
              <p className="text-gray-400 font-medium">Date & Method</p>
              <p className="font-semibold">{requestData.date}</p>
              <p className="text-[11px] capitalize text-canal-600">{requestData.paymentMethod}</p>
            </div>
          </div>

          <div className="bg-gray-50 rounded-xl p-3 mb-4 text-xs space-y-2">
            <div className="flex justify-between border-b border-gray-200 pb-1.5">
              <span className="text-gray-500">Canal / Source</span>
              <span className="font-medium">{requestData.canal}</span>
            </div>
            <div className="flex justify-between border-b border-gray-200 pb-1.5">
              <span className="text-gray-500">Crop Type</span>
              <span className="font-medium">{requestData.crop}</span>
            </div>
            <div className="flex justify-between border-b border-gray-200 pb-1.5">
              <span className="text-gray-500">Irrigation Duration</span>
              <span className="font-medium">{requestData.hours} Hours</span>
            </div>
            <div className="flex justify-between text-sm font-bold pt-1">
              <span>Total Paid</span>
              <span className="text-canal-700">Rs. {requestData.amount.toLocaleString()}</span>
            </div>
          </div>

          <div className="flex items-center justify-between text-[10px] text-gray-400 border-t pt-3">
            <span>Authorized Digital Receipt</span>
            <span>Thank you for your payment!</span>
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl glass text-xs font-semibold">
            {t("cancel")}
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 py-2.5 rounded-xl bg-canal-600 hover:bg-canal-700 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-md"
          >
            <Printer size={16} />
            {t("print_receipt")}
          </button>
        </div>
      </div>
    </div>
  );
}
