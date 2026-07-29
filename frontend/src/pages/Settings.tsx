import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { KeyRound, CheckCircle2, AlertCircle, ShieldOff, History, Mail, User, Eye, EyeOff, Fingerprint } from "lucide-react";
import api from "../services/api";
import { useLanguage } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import { enrollDeviceBiometric, removeDeviceBiometric } from "../services/biometricAuth";

const ADMIN_ROLES = ["super_admin", "admin"];

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const { t, lang, setLang } = useLanguage();
  const { user } = useAuth();
  const isAdmin = !!user && ADMIN_ROLES.includes(user.role);

  useEffect(() => {
    if (!isAdmin) return;
    api.get("/api/settings").then((r) => setSettings(r.data)).catch(() => {});
  }, [isAdmin]);

  const save = async (key: string, value: string) => {
    await api.put("/api/settings", { key, value });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const fields = [
    { key: "company_name", label: "Company Name", placeholder: "Sichai Pani Irrigation Services" },
    { key: "water_rate", label: "Water Rate (per hour)", placeholder: "200" },
    { key: "currency", label: "Currency Symbol", placeholder: "Rs." },
  ];

  return (
    <div className="flex flex-col gap-5 max-w-xl">
      <h2 className="font-display text-xl font-semibold">{t("nav_settings")}</h2>

      <div className="glass rounded-2xl p-5 flex flex-col gap-4">
        <div>
          <label className="text-sm font-medium mb-1 block">{t("language")}</label>
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value as "en" | "ne")}
            className="input"
          >
            <option value="en">English</option>
            <option value="ne">नेपाली (Nepali)</option>
          </select>
        </div>

        {isAdmin && fields.map((f) => (
          <div key={f.key}>
            <label className="text-sm font-medium mb-1 block">{f.label}</label>
            <input
              defaultValue={settings[f.key] || ""}
              placeholder={f.placeholder}
              onBlur={(e) => save(f.key, e.target.value)}
              className="input"
            />
          </div>
        ))}
        {isAdmin && saved && <p className="text-xs text-paddy-600">✓ {t("save")}</p>}
      </div>

      <EditProfileCard />
      <BiometricSecurityCard />
      <ChangePasswordCard />
      <ChangeEmailCard />
      {isAdmin && <DeviceSecurityCard />}
      {isAdmin && <LoginActivityCard />}
    </div>
  );
}

function EditProfileCard() {
  const { user, setUser } = useAuth();
  const [fullName, setFullName] = useState(user?.full_name || "");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    const trimmed = fullName.trim();
    if (!trimmed) {
      setMessage({ type: "error", text: "Name cannot be empty." });
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.patch("/api/auth/profile", { full_name: trimmed });
      if (user) {
        const updated = { ...user, full_name: res.data.full_name };
        localStorage.setItem("sichai_user", JSON.stringify(updated));
        setUser(updated);
      }
      setMessage({ type: "success", text: "Name updated successfully." });
    } catch (err: any) {
      setMessage({ type: "error", text: err?.response?.data?.detail || "Could not update name. Please try again." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-5 flex flex-col gap-4">
      <h3 className="font-display font-semibold flex items-center gap-2">
        <User size={18} className="text-canal-600" /> Edit Profile
      </h3>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <div>
          <label className="text-sm font-medium mb-1 block">Full Name</label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            className="input"
            placeholder="Your name"
          />
        </div>

        {message && (
          <p className={`text-xs flex items-center gap-1.5 ${message.type === "success" ? "text-paddy-600" : "text-rose-600"}`}>
            {message.type === "success" ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
            {message.text}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="self-start bg-canal-600 hover:bg-canal-700 disabled:opacity-60 text-white font-medium rounded-xl px-5 py-2 text-sm"
        >
          {submitting ? "Saving..." : "Save Name"}
        </button>
      </form>
    </motion.div>
  );
}

function ChangePasswordCard() {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const reset = () => {
    setOldPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (newPassword.length < 6) {
      setMessage({ type: "error", text: "New password must be at least 6 characters." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "New password and confirmation do not match." });
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/api/auth/change-password", {
        old_password: oldPassword,
        new_password: newPassword,
      });
      setMessage({ type: "success", text: "Password changed successfully." });
      reset();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setMessage({ type: "error", text: detail || "Could not change password. Please try again." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-5 flex flex-col gap-4">
      <h3 className="font-display font-semibold flex items-center gap-2">
        <KeyRound size={18} className="text-canal-600" /> Change Password
      </h3>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <div>
          <label className="text-sm font-medium mb-1 block">Current Password</label>
          <div className="relative">
            <input
              type={showOld ? "text" : "password"}
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="input pr-10"
            />
            <button
              type="button"
              onClick={() => setShowOld(!showOld)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-canal-400 hover:text-canal-600 focus:outline-none"
            >
              {showOld ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">New Password</label>
          <div className="relative">
            <input
              type={showNew ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              className="input pr-10"
            />
            <button
              type="button"
              onClick={() => setShowNew(!showNew)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-canal-400 hover:text-canal-600 focus:outline-none"
            >
              {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">Confirm New Password</label>
          <div className="relative">
            <input
              type={showConfirm ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              className="input pr-10"
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-canal-400 hover:text-canal-600 focus:outline-none"
            >
              {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {message && (
          <p className={`text-xs flex items-center gap-1.5 ${message.type === "success" ? "text-paddy-600" : "text-rose-600"}`}>
            {message.type === "success" ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
            {message.text}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="bg-canal-600 hover:bg-canal-700 disabled:opacity-60 text-white font-medium rounded-xl py-2.5 text-sm"
        >
          {submitting ? "Updating..." : "Update Password"}
        </button>
      </form>
    </motion.div>
  );
}

function ChangeEmailCard() {
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!/^\S+@\S+\.\S+$/.test(newEmail)) {
      setMessage({ type: "error", text: "Please enter a valid email address." });
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/api/auth/change-email", { new_email: newEmail, password });
      setMessage({ type: "success", text: "Email updated successfully." });
      setNewEmail("");
      setPassword("");
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setMessage({ type: "error", text: detail || "Could not update email. Please try again." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-5 flex flex-col gap-4">
      <h3 className="font-display font-semibold flex items-center gap-2">
        <Mail size={18} className="text-canal-600" /> Change Email
      </h3>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <div>
          <label className="text-sm font-medium mb-1 block">New Email Address</label>
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            required
            className="input"
            placeholder="yourname@example.com"
          />
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">Current Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="input"
            placeholder="Confirm it's you"
          />
        </div>

        {message && (
          <p className={`text-xs flex items-center gap-1.5 ${message.type === "success" ? "text-paddy-600" : "text-rose-600"}`}>
            {message.type === "success" ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
            {message.text}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="bg-canal-600 hover:bg-canal-700 disabled:opacity-60 text-white font-medium rounded-xl py-2.5 text-sm"
        >
          {submitting ? "Updating..." : "Update Email"}
        </button>
      </form>
    </motion.div>
  );
}

function BiometricSecurityCard() {
  const { user } = useAuth();
  const [enrolled, setEnrolled] = useState(() => {
    return user ? localStorage.getItem(`sichai_biometric_${user.username}`) === "enabled" : false;
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const handleEnroll = async () => {
    if (!user) return;
    setBusy(true);
    setMsg("");
    const token = localStorage.getItem("sichai_token") || "";
    const role = user.role;
    const success = await enrollDeviceBiometric(role, user, token);
    if (success) {
      setEnrolled(true);
      setMsg("✓ Biometric authentication (Fingerprint / Face Unlock) registered successfully!");
    } else {
      setMsg("Could not register biometric key. Ensure your device biometric sensor is active.");
    }
    setBusy(false);
  };

  const handleDisable = () => {
    if (!user) return;
    removeDeviceBiometric(user.role);
    setEnrolled(false);
    setMsg("Biometric login disabled for this device.");
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-5 flex flex-col gap-3">
      <h3 className="font-display font-semibold flex items-center gap-2">
        <Fingerprint size={18} className="text-canal-600" /> Fingerprint Security
      </h3>
      <p className="text-xs text-canal-500">
        Register your device's fingerprint sensor to sign into your account instantly with 1-touch authentication.
      </p>

      <div className="flex items-center gap-3 mt-1">
        {enrolled ? (
          <button
            onClick={handleDisable}
            className="bg-rose-100 dark:bg-rose-900/40 text-rose-600 hover:bg-rose-200 text-xs font-semibold rounded-xl px-4 py-2 transition-colors"
          >
            Disable Fingerprint Key
          </button>
        ) : (
          <button
            onClick={handleEnroll}
            disabled={busy}
            className="bg-paddy-600 hover:bg-paddy-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl px-4 py-2 flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
          >
            <Fingerprint size={16} />
            <span>{busy ? "Enrolling..." : "Register Fingerprint Sensor"}</span>
          </button>
        )}
        <span className="text-xs font-medium text-canal-500">
          Status: {enrolled ? <strong className="text-paddy-600">Active ✓</strong> : "Not Enrolled"}
        </span>
      </div>

      {msg && <p className="text-xs text-canal-600 mt-1">{msg}</p>}
    </motion.div>
  );
}

function DeviceSecurityCard() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const logoutOthers = async () => {
    setBusy(true);
    setMessage("");
    try {
      await api.post("/api/auth/admin/logout-others");
      setMessage("All other devices have been logged out.");
    } catch {
      setMessage("Could not log out other devices. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-5 flex flex-col gap-3">
      <h3 className="font-display font-semibold flex items-center gap-2">
        <ShieldOff size={18} className="text-canal-600" /> Device Security
      </h3>
      <p className="text-xs text-canal-500">
        Your Admin account can be signed in on multiple devices at once, and you'll get a notification
        every time it happens. If a sign-in wasn't you, use this to immediately log out every other device.
      </p>
      <button
        onClick={logoutOthers}
        disabled={busy}
        className="self-start bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-sm font-medium rounded-xl px-4 py-2"
      >
        {busy ? "Logging out..." : "Log Out Other Devices"}
      </button>
      {message && <p className="text-xs text-paddy-600">{message}</p>}
    </motion.div>
  );
}

interface LoginLog {
  id: number;
  user_id?: number;
  role?: string;
  action: string;
  ip_address?: string;
  user_agent?: string;
  details?: string;
  created_at: string;
}

const ROLE_LABELS: Record<string, string> = {
  all: "All",
  super_admin: "Admin",
  admin: "Admin",
  water_operator: "Operator",
  farmer: "Farmer",
};

function LoginActivityCard() {
  const [logs, setLogs] = useState<LoginLog[]>([]);
  const [roleFilter, setRoleFilter] = useState<string>("all");

  useEffect(() => {
    api.get("/api/auth/login-logs").then((r) => setLogs(r.data)).catch(() => {});
  }, []);

  const tabs = ["all", "super_admin", "water_operator", "farmer"];
  const filteredLogs =
    roleFilter === "all"
      ? logs
      : roleFilter === "super_admin"
      ? logs.filter((l) => l.role === "super_admin" || l.role === "admin")
      : logs.filter((l) => l.role === roleFilter);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-5 flex flex-col gap-3">
      <h3 className="font-display font-semibold flex items-center gap-2">
        <History size={18} className="text-canal-600" /> Login Activity
      </h3>

      <div className="flex gap-1.5 flex-wrap">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setRoleFilter(tab)}
            className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
              roleFilter === tab
                ? "bg-canal-600 text-white"
                : "bg-canal-100/60 dark:bg-canal-800/60 text-canal-600 dark:text-canal-300 hover:bg-canal-200/60"
            }`}
          >
            {ROLE_LABELS[tab]}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto max-h-72 overflow-y-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-canal-500 border-b border-canal-200/50 dark:border-canal-700/50">
              <th className="py-2 pr-3">When</th>
              <th className="py-2 pr-3">Role</th>
              <th className="py-2 pr-3">Action</th>
              <th className="py-2 pr-3">IP</th>
              <th className="py-2 pr-3">Details</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.map((l) => (
              <tr key={l.id} className="border-b border-canal-100/50 dark:border-canal-800/50">
                <td className="py-2 pr-3 whitespace-nowrap">{new Date(l.created_at).toLocaleString()}</td>
                <td className="py-2 pr-3 capitalize">{l.role?.replace("_", " ") || "-"}</td>
                <td className="py-2 pr-3 capitalize">{l.action.replace(/_/g, " ")}</td>
                <td className="py-2 pr-3">{l.ip_address || "-"}</td>
                <td className="py-2 pr-3 text-canal-500">{l.details || "-"}</td>
              </tr>
            ))}
            {filteredLogs.length === 0 && (
              <tr><td colSpan={5} className="text-center py-6 text-canal-500">No login activity for this filter.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
