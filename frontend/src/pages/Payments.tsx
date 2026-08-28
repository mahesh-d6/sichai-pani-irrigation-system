import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Download, Wallet, Landmark, Banknote, Smartphone, Plus, X,
  Paperclip, CheckCircle2, XCircle, UploadCloud, QrCode, AlertCircle, Clock, Check
} from "lucide-react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";

interface Payment {
  id: number;
  water_request_id: number;
  farmer_id: number;
  amount: number;
  method: string;
  status: string;
  invoice_number?: string;
  payment_date: string;
  proof_url?: string | null;
}

interface UnpaidRequest {
  id: number;
  farmer_id: number;
  request_date: string;
  total_amount: number;
  total_hours: number;
  crop?: string;
  status: string;
}

interface Farmer {
  id: number;
  full_name: string;
  farmer_code: string;
}

const STAFF_ROLES = ["super_admin", "admin", "water_operator"];

const METHOD_ICON: Record<string, ReactElement> = {
  esewa: <Smartphone size={15} className="text-emerald-500" />,
  khalti: <Smartphone size={15} className="text-purple-500" />,
  fonepay: <QrCode size={15} className="text-rose-500" />,
  bank_transfer: <Landmark size={15} className="text-sky-500" />,
  cash: <Banknote size={15} className="text-amber-500" />,
};

const METHOD_LABEL: Record<string, string> = {
  esewa: "eSewa Wallet",
  khalti: "Khalti Wallet",
  fonepay: "FonePay QR",
  bank_transfer: "Bank Transfer",
  cash: "Cash Payment",
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-200",
  paid: "bg-paddy-100 text-paddy-700 dark:bg-paddy-900/60 dark:text-paddy-200",
  failed: "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-200",
  refunded: "bg-canal-100 text-canal-700 dark:bg-canal-800 dark:text-canal-200",
};

export default function Payments() {
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const isFarmer = user?.role === "farmer";
  const isStaff = !!user && STAFF_ROLES.includes(user.role);

  const [payments, setPayments] = useState<Payment[]>([]);
  const [unpaidRequests, setUnpaidRequests] = useState<UnpaidRequest[]>([]);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null);
  const [verifyingId, setVerifyingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const load = () => {
    setLoading(true);
    setLoadError("");

    // Load payments
    api.get("/api/payments")
      .then((r) => setPayments(Array.isArray(r.data) ? r.data : []))
      .catch((e) => setLoadError(e?.response?.data?.detail || "Could not load payments."))
      .finally(() => setLoading(false));

    // Load ALL unpaid requests (for BOTH Farmers and Staff)
    api.get("/api/requests", { params: { payment_status: "pending" } })
      .then((r) => {
        const list: UnpaidRequest[] = Array.isArray(r.data) ? r.data : [];
        // Only include requests that have a bill amount (> 0) or completed/stopped status
        const validUnpaid = list.filter(req => req.total_amount > 0 || req.status === "completed");
        setUnpaidRequests(validUnpaid);
      })
      .catch(() => {});

    // If staff, load farmer directory to map farmer names
    if (isStaff) {
      api.get("/api/farmers")
        .then((r) => setFarmers(Array.isArray(r.data) ? r.data : []))
        .catch(() => {});
    }
  };

  useEffect(load, [isFarmer, isStaff]);

  const downloadReceipt = async (id: number, invoice?: string) => {
    try {
      const res = await api.get(`/api/payments/${id}/receipt.pdf`, { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `receipt_${invoice || id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Could not download receipt PDF.");
    }
  };

  const setStatus = async (id: number, status: "paid" | "failed") => {
    setVerifyingId(id);
    try {
      await api.patch(`/api/payments/${id}/status`, { status });
      load();
    } catch {
      alert("Could not update payment status.");
    } finally {
      setVerifyingId(null);
    }
  };

  const farmerName = (id: number) => {
    const f = farmers.find((farm) => farm.id === id);
    return f ? `${f.full_name} (${f.farmer_code})` : `Farmer #${id}`;
  };

  const totalPaid = payments.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0);
  const totalPendingUnpaid = unpaidRequests.reduce((s, r) => s + (r.total_amount || 0), 0);

  const openPayFormForRequest = (reqId?: number) => {
    setSelectedRequestId(reqId || (unpaidRequests[0]?.id ?? null));
    setShowPayModal(true);
  };

  return (
    <div className="flex flex-col gap-6">
      {loadError && (
        <div className="glass rounded-2xl p-4 flex items-center gap-3 border border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-sm">
          <AlertCircle size={18} /> {loadError}
          <button onClick={load} className="ml-auto text-xs underline font-medium">Retry</button>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-8 gap-3 text-canal-500">
          <div className="w-5 h-5 border-2 border-canal-400 border-t-canal-600 rounded-full animate-spin" />
          <span className="text-sm">{t("loading")}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight">{t("payments_title")}</h2>
          <p className="text-xs text-canal-500 mt-0.5">
            {lang === "ne" ? "सिंचाई भुक्तानी प्रबन्ध र रसिदहरू" : "Manage water bills, payments & official PDF receipts"}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="glass rounded-2xl px-4 py-2.5 flex items-center gap-3 border border-canal-200/50 dark:border-canal-800/50">
            <div className="w-8 h-8 rounded-xl bg-paddy-100 dark:bg-paddy-900/50 flex items-center justify-center text-paddy-600 dark:text-paddy-300">
              <Wallet size={18} />
            </div>
            <div>
              <p className="text-xs text-canal-500">{lang === "ne" ? "कुल संकलित" : "Total Collected"}</p>
              <p className="font-display text-base font-semibold">Rs.{totalPaid.toLocaleString()}</p>
            </div>
          </div>

          <div className="glass rounded-2xl px-4 py-2.5 flex items-center gap-3 border border-amber-200/50 dark:border-amber-900/50">
            <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center text-amber-600 dark:text-amber-300">
              <Clock size={18} />
            </div>
            <div>
              <p className="text-xs text-canal-500">{lang === "ne" ? "भुक्तानी बाँकी कुल" : "Total Pending Bills"}</p>
              <p className="font-display text-base font-semibold text-amber-600 dark:text-amber-400">Rs.{totalPendingUnpaid.toLocaleString()}</p>
            </div>
          </div>

          {unpaidRequests.length > 0 && (
            <button
              onClick={() => openPayFormForRequest()}
              className="flex items-center gap-2 bg-paddy-600 hover:bg-paddy-700 text-white text-sm font-medium px-4 py-2.5 rounded-2xl shadow-sm transition-all"
            >
              <Plus size={16} /> {isStaff ? (lang === "ne" ? "भुक्तानी प्रविष्टि गर्नुहोस्" : "Record Payment") : (lang === "ne" ? "अहिले तिर्नुहोस्" : "Pay Bill Now")}
            </button>
          )}
        </div>
      </div>

      {/* 🔴 Section: Pending Unpaid Bills */}
      {unpaidRequests.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-5 border border-amber-200/80 dark:border-amber-900/50 bg-gradient-to-r from-amber-50/50 via-amber-50/20 to-transparent dark:from-amber-950/20">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-amber-500 animate-pulse" />
              <h3 className="font-display font-semibold text-amber-900 dark:text-amber-200 text-base">
                {lang === "ne" ? "भुक्तानी बाँकी सिंचाइ बिलहरू" : "Outstanding / Pending Water Bills"} ({unpaidRequests.length})
              </h3>
            </div>
            <span className="text-xs text-amber-700 dark:text-amber-300 font-medium">
              {lang === "ne" ? "पानी आपूर्ति सम्पन्न भएका बाँकी बिल" : "Completed water delivery awaiting payment"}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {unpaidRequests.map((req) => (
              <div key={req.id} className="bg-white/80 dark:bg-canal-900/80 rounded-xl p-4 border border-amber-200/60 dark:border-amber-800/40 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                      Request #{req.id}
                    </span>
                    <span className="text-xs text-canal-500">{req.request_date}</span>
                  </div>

                  {isStaff && (
                    <p className="text-sm font-semibold text-canal-800 dark:text-canal-100 mb-1">
                      {farmerName(req.farmer_id)}
                    </p>
                  )}

                  <div className="flex justify-between items-center text-xs text-canal-600 dark:text-canal-300 mb-2">
                    <span>{lang === "ne" ? "बाली" : "Crop"}: <strong className="text-canal-800 dark:text-canal-100">{req.crop || "Irrigation"}</strong></span>
                    <span>{lang === "ne" ? "कुल समय" : "Duration"}: <strong className="text-canal-800 dark:text-canal-100">{req.total_hours} hrs</strong></span>
                  </div>

                  <div className="text-lg font-display font-bold text-amber-600 dark:text-amber-400 mt-2 mb-3">
                    Rs.{req.total_amount}
                  </div>
                </div>

                <button
                  onClick={() => openPayFormForRequest(req.id)}
                  className="w-full flex items-center justify-center gap-2 bg-canal-600 hover:bg-canal-700 text-white text-xs font-medium py-2 rounded-xl transition-colors shadow-xs"
                >
                  <Plus size={14} /> {isStaff ? (lang === "ne" ? "नगद / भुक्तानी संकलन" : "Collect / Record Payment") : (lang === "ne" ? "बिल तिर्नुहोस्" : "Pay This Bill")}
                </button>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Pay Modal */}
      {showPayModal && (
        <PayModal
          unpaidRequests={unpaidRequests}
          selectedId={selectedRequestId}
          isStaff={isStaff}
          onClose={() => setShowPayModal(false)}
          onPaid={() => { setShowPayModal(false); load(); }}
        />
      )}

      {/* Payment History Table */}
      <div className="glass rounded-2xl overflow-hidden border border-canal-200/50 dark:border-canal-800/50">
        <div className="px-5 py-4 border-b border-canal-200/50 dark:border-canal-700/50 flex justify-between items-center">
          <h3 className="font-display font-semibold text-base">{t("payment_history")}</h3>
          <span className="text-xs text-canal-500">{payments.length} {lang === "ne" ? "रेकर्डहरू" : "records"}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-canal-500 border-b border-canal-200/50 dark:border-canal-700/50 bg-canal-50/50 dark:bg-canal-900/50">
                <th className="py-3 px-4">Invoice</th>
                <th className="py-3 px-4">Req #</th>
                {isStaff && <th className="py-3 px-4">Farmer</th>}
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Method</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Proof</th>
                <th className="py-3 px-4">Receipt</th>
                {isStaff && <th className="py-3 px-4">Verify</th>}
              </tr>
            </thead>
            <tbody>
              {payments.map((p, i) => (
                <motion.tr
                  key={p.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                  className="border-b border-canal-100/50 dark:border-canal-800/50 hover:bg-canal-50/30 dark:hover:bg-canal-900/30 transition-colors"
                >
                  <td className="py-3 px-4 font-mono text-xs font-semibold text-canal-700 dark:text-canal-200">
                    {p.invoice_number || `#${p.id}`}
                  </td>
                  <td className="py-3 px-4 text-xs font-medium text-canal-500">#{p.water_request_id}</td>
                  {isStaff && <td className="py-3 px-4 text-xs font-medium">{farmerName(p.farmer_id)}</td>}
                  <td className="py-3 px-4 font-display font-semibold text-canal-800 dark:text-canal-100">Rs.{p.amount}</td>
                  <td className="py-3 px-4">
                    <span className="flex items-center gap-1.5 text-xs capitalize">
                      {METHOD_ICON[p.method] || <Smartphone size={15} />}
                      {METHOD_LABEL[p.method] || p.method}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`text-xs px-2.5 py-0.5 rounded-full capitalize font-medium ${STATUS_STYLES[p.status]}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-xs text-canal-500">{new Date(p.payment_date).toLocaleDateString()}</td>
                  <td className="py-3 px-4">
                    {p.proof_url ? (
                      <a
                        href={`${api.defaults.baseURL}${p.proof_url}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-canal-600 hover:text-canal-800 dark:text-canal-300 flex items-center gap-1 text-xs font-medium"
                      >
                        <Paperclip size={14} /> {lang === "ne" ? "हेर्नुहोस्" : "View"}
                      </a>
                    ) : (
                      <span className="text-canal-400 text-xs">-</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => downloadReceipt(p.id, p.invoice_number)}
                      className="text-paddy-600 hover:text-paddy-700 dark:text-paddy-400 flex items-center gap-1 text-xs font-medium"
                    >
                      <Download size={14} /> PDF
                    </button>
                  </td>
                  {isStaff && (
                    <td className="py-3 px-4">
                      {p.status === "pending" ? (
                        <div className="flex gap-2">
                          <button
                            disabled={verifyingId === p.id}
                            onClick={() => setStatus(p.id, "paid")}
                            className="text-paddy-600 hover:text-paddy-700 disabled:opacity-50 transition-colors"
                            title="Verify & Mark Paid"
                          >
                            <CheckCircle2 size={18} />
                          </button>
                          <button
                            disabled={verifyingId === p.id}
                            onClick={() => setStatus(p.id, "failed")}
                            className="text-rose-600 hover:text-rose-700 disabled:opacity-50 transition-colors"
                            title="Reject Payment"
                          >
                            <XCircle size={18} />
                          </button>
                        </div>
                      ) : (
                        <span className="text-canal-400 text-xs flex items-center gap-1"><Check size={14} /> Done</span>
                      )}
                    </td>
                  )}
                </motion.tr>
              ))}
              {payments.length === 0 && !loading && (
                <tr>
                  <td colSpan={isStaff ? 10 : 8} className="text-center py-10 text-canal-500 text-sm">
                    {t("no_payments_yet")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Payment Modal Component
// ---------------------------------------------------------------------------
function PayModal({
  unpaidRequests, selectedId, isStaff, onClose, onPaid,
}: {
  unpaidRequests: UnpaidRequest[];
  selectedId: number | null;
  isStaff: boolean;
  onClose: () => void;
  onPaid: () => void;
}) {
  const { lang } = useLanguage();
  const [requestId, setRequestId] = useState<string>(selectedId ? String(selectedId) : (unpaidRequests[0]?.id ? String(unpaidRequests[0].id) : ""));
  const [method, setMethod] = useState<string>(isStaff ? "cash" : "esewa");
  const [proof, setProof] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const selectedReq = unpaidRequests.find((r) => String(r.id) === requestId);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!requestId) {
      setError(lang === "ne" ? "कृपया भुक्तानी बाँकी सिंचाइ अनुरोध छान्नुहोस्।" : "Please select an unpaid water request.");
      return;
    }

    // Proof is required ONLY for farmers when selecting digital methods
    if (!isStaff && method !== "cash" && !proof) {
      setError(lang === "ne" ? "कृपया भुक्तानी प्रमाण (स्क्रिनसट वा रसिद) अपलोड गर्नुहोस्।" : "Please upload proof of payment (screenshot or receipt).");
      return;
    }

    const form = new FormData();
    form.append("water_request_id", requestId);
    form.append("method", method);
    if (notes) form.append("notes", notes);
    if (proof) form.append("proof", proof);

    setSubmitting(true);
    try {
      await api.post("/api/payments", form);
      onPaid();
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Could not submit payment. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass rounded-3xl p-6 relative w-full max-w-xl max-h-[90vh] overflow-y-auto bg-white dark:bg-canal-900 border border-canal-200 dark:border-canal-800 shadow-2xl">
        <button onClick={onClose} className="absolute top-5 right-5 text-canal-400 hover:text-canal-600 dark:hover:text-canal-200">
          <X size={20} />
        </button>

        <h3 className="font-display font-semibold text-lg mb-1 flex items-center gap-2 text-canal-900 dark:text-canal-100">
          <UploadCloud size={20} className="text-canal-600" />
          {isStaff ? (lang === "ne" ? "भुक्तानी संकलन / प्रविष्टि" : "Record Payment (Staff)") : (lang === "ne" ? "सिंचाई भुक्तानी" : "Pay Water Bill")}
        </h3>
        <p className="text-xs text-canal-500 mb-5">
          {lang === "ne" ? "भुक्तानी माध्यम छान्नुहोस् र विवरण पठाउनुहोस्" : "Select payment method and confirm details below"}
        </p>

        {unpaidRequests.length === 0 ? (
          <p className="text-sm text-canal-500 py-6 text-center">{lang === "ne" ? "कुनै भुक्तानी बाँकी बिल छैन।" : "You have no outstanding payments right now."}</p>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            {/* Request Dropdown */}
            <div>
              <label className="text-xs font-medium text-canal-700 dark:text-canal-300 mb-1 block">
                {lang === "ne" ? "सिंचाई बिल छान्नुहोस्" : "Select Water Request Bill"}
              </label>
              <select value={requestId} onChange={(e) => setRequestId(e.target.value)} className="input text-sm">
                {unpaidRequests.map((r) => (
                  <option key={r.id} value={r.id}>
                    Req #{r.id} — {r.request_date} — Rs.{r.total_amount} ({r.total_hours} hrs)
                  </option>
                ))}
              </select>
            </div>

            {selectedReq && (
              <div className="bg-canal-50 dark:bg-canal-950/60 rounded-2xl p-4 border border-canal-200/60 dark:border-canal-800/60 flex items-center justify-between">
                <div>
                  <p className="text-xs text-canal-500">{lang === "ne" ? "कुल भुक्तानी रकम" : "Bill Amount"}</p>
                  <p className="font-display text-xl font-bold text-paddy-600 dark:text-paddy-400">Rs.{selectedReq.total_amount}</p>
                </div>
                <div className="text-right text-xs text-canal-600 dark:text-canal-300">
                  <p>Date: <strong>{selectedReq.request_date}</strong></p>
                  <p>Hours: <strong>{selectedReq.total_hours} hrs</strong></p>
                </div>
              </div>
            )}

            {/* Payment Method Selector */}
            <div>
              <label className="text-xs font-medium text-canal-700 dark:text-canal-300 mb-1.5 block">
                {lang === "ne" ? "भुक्तानी माध्यम छान्नुहोस्" : "Select Payment Method"}
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {["esewa", "khalti", "fonepay", "bank_transfer", ...(isStaff ? ["cash"] : [])].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMethod(m)}
                    className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-medium transition-all ${
                      method === m
                        ? "border-canal-600 bg-canal-50 dark:bg-canal-800/80 text-canal-900 dark:text-white font-semibold ring-2 ring-canal-600/30"
                        : "border-canal-200 dark:border-canal-800 text-canal-600 dark:text-canal-400 hover:bg-canal-50/50"
                    }`}
                  >
                    {METHOD_ICON[m]} {METHOD_LABEL[m]}
                  </button>
                ))}
              </div>
            </div>

            {/* Interactive Gateway QR & Instructions */}
            {method === "esewa" && (
              <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-2xl p-4 text-xs text-emerald-900 dark:text-emerald-200 space-y-1">
                <p className="font-semibold flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-300">
                  <Smartphone size={16} /> eSewa Payment Guide
                </p>
                <p>eSewa ID: <strong className="font-mono text-sm">9800000000</strong></p>
                <p>Account Name: <strong>Sichai Pani Irrigation Management</strong></p>
                <p className="text-canal-500 dark:text-emerald-400 text-[11px] pt-1">
                  Send Rs.{selectedReq?.total_amount || 0} to the eSewa ID above and upload the payment screenshot below.
                </p>
              </div>
            )}

            {method === "khalti" && (
              <div className="bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900 rounded-2xl p-4 text-xs text-purple-900 dark:text-purple-200 space-y-1">
                <p className="font-semibold flex items-center gap-1.5 text-sm text-purple-700 dark:text-purple-300">
                  <Smartphone size={16} /> Khalti Payment Guide
                </p>
                <p>Khalti ID: <strong className="font-mono text-sm">9800000000</strong></p>
                <p>Account Name: <strong>Sichai Pani Irrigation</strong></p>
                <p className="text-purple-600 dark:text-purple-400 text-[11px] pt-1">
                  Send funds via Khalti and upload receipt below.
                </p>
              </div>
            )}

            {method === "fonepay" && (
              <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-2xl p-4 text-xs text-rose-900 dark:text-rose-200 space-y-1">
                <p className="font-semibold flex items-center gap-1.5 text-sm text-rose-700 dark:text-rose-300">
                  <QrCode size={16} /> FonePay QR Code
                </p>
                <p>Scan FonePay QR using Mobile Banking / eSewa / Khalti app.</p>
                <p>Merchant Name: <strong>Sichai Pani Irrigation</strong></p>
              </div>
            )}

            {method === "bank_transfer" && (
              <div className="bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-900 rounded-2xl p-4 text-xs text-sky-900 dark:text-sky-200 space-y-1">
                <p className="font-semibold flex items-center gap-1.5 text-sm text-sky-700 dark:text-sky-300">
                  <Landmark size={16} /> Bank Transfer Details
                </p>
                <p>Bank: <strong>Rastriya Banijya Bank</strong></p>
                <p>Account Number: <strong className="font-mono text-sm">1090100001234001</strong></p>
                <p>Account Name: <strong>Sichai Pani Irrigation Services</strong></p>
                <p>Branch: <strong>Main Branch, Sector 4</strong></p>
              </div>
            )}

            {method === "cash" && (
              <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-2xl p-4 text-xs text-amber-900 dark:text-amber-200 space-y-1">
                <p className="font-semibold flex items-center gap-1.5 text-sm text-amber-700 dark:text-amber-300">
                  <Banknote size={16} /> Cash Collection Confirmation
                </p>
                <p>Recorded by Operator / Admin upon receiving cash in person. Marked paid instantly.</p>
              </div>
            )}

            {/* Proof Upload */}
            {method !== "cash" && (
              <div>
                <label className="text-xs font-medium text-canal-700 dark:text-canal-300 mb-1 block">
                  {lang === "ne" ? "भुक्तानी प्रमाण (स्क्रिनसट / रसिद)" : "Proof of Payment (screenshot / receipt)"}
                  {!isStaff && <span className="text-rose-500 ml-1">*</span>}
                </label>
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,.pdf"
                  onChange={(e) => setProof(e.target.files?.[0] || null)}
                  className="input text-xs"
                />
                <p className="text-[11px] text-canal-500 mt-1">
                  JPG, PNG, WEBP or PDF (max 5MB).
                </p>
              </div>
            )}

            {/* Notes */}
            <div>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={lang === "ne" ? "थप टिप्पणी (ऐच्छिक)" : "Notes (optional)"}
                className="input text-xs"
              />
            </div>

            {error && (
              <p className="text-xs text-rose-600 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl p-3">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-paddy-600 hover:bg-paddy-700 disabled:opacity-60 text-white font-medium text-sm rounded-xl py-3 shadow-sm transition-all"
            >
              {submitting ? (lang === "ne" ? "प्रक्रिया हुँदैछ..." : "Submitting...") : (lang === "ne" ? "भुक्तानी पुष्टि गर्नुहोस्" : "Confirm Payment")}
            </button>
          </form>
        )}
      </motion.div>
    </motion.div>
  );
}
