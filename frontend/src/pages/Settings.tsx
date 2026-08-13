import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { KeyRound, CheckCircle2, AlertCircle, ShieldOff, History, Mail, User, Eye, EyeOff, Fingerprint, Trash2 } from "lucide-react";
import api from "../services/api";
import { useLanguage } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import { enrollDeviceBiometric, removeDeviceBiometric, hasEnrolledBiometric } from "../services/biometricAuth";

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
      <GoogleAccountCard />
      <ChangePasswordCard />
      <ChangeEmailCard />
      {isAdmin && <DeviceSecurityCard />}
      {isAdmin && <LoginActivityCard />}
      {user?.role === "super_admin" && <DatabaseResetCard />}
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
    return user ? hasEnrolledBiometric(user.role) : false;
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

function GoogleAccountCard() {
  const { user, setUser } = useAuth();
  const isAdmin = user && ADMIN_ROLES.includes(user.role);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [challenges, setChallenges] = useState<any[]>([]);

  const loadChallenges = () => {
    if (isAdmin) {
      api.get("/api/auth/admin/login-challenges").then((r) => {
        if (Array.isArray(r.data)) setChallenges(r.data);
      }).catch(() => {});
    }
  };

  useEffect(() => {
    loadChallenges();
    const interval = setInterval(loadChallenges, 4000);
    return () => clearInterval(interval);
  }, [isAdmin]);

  const handleUnlink = async () => {
    setBusy(true);
    setMsg("");
    try {
      await api.post("/api/auth/unlink-google");
      if (user) {
        setUser({ ...user, google_id: null });
      }
      setMsg("✓ Google/Gmail account unlinked successfully.");
    } catch {
      setMsg("Could not unlink Google account.");
    } finally {
      setBusy(false);
    }
  };

  const handlePurgeAll = async () => {
    if (!window.confirm("Are you sure you want to remove all linked Gmail accounts except the primary Admin? All unlinked users will require Admin approval to sign in via Google.")) return;
    setBusy(true);
    setMsg("");
    try {
      const res = await api.post("/api/auth/admin/purge-all-google-links");
      setMsg(`✓ ${res.data.message}`);
    } catch {
      setMsg("Could not purge Google accounts.");
    } finally {
      setBusy(false);
    }
  };

  const handleRespondChallenge = async (publicId: string, action: "allow" | "reject") => {
    try {
      await api.post(`/api/auth/admin/login-challenges/${publicId}/respond`, { action });
      loadChallenges();
      setMsg(`✓ Google sign-in request ${action === "allow" ? "approved" : "rejected"}.`);
    } catch {
      setMsg("Could not respond to request.");
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-5 flex flex-col gap-4">
      <h3 className="font-display font-semibold flex items-center gap-2">
        <Mail size={18} className="text-canal-600" /> Linked Gmail & Admin Approvals
      </h3>
      <p className="text-xs text-canal-500">
        Manage your linked Google account and approve secondary Google sign-in requests.
      </p>

      <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/50 dark:bg-canal-900/40 border border-canal-200/50 dark:border-canal-700/50">
        <div>
          <p className="text-xs font-medium text-earth-800 dark:text-canal-100">
            {user?.email || "No email"}
          </p>
          <span className="text-[11px] text-canal-500">
            Google Status: {user?.google_id ? <strong className="text-paddy-600">Linked ✓</strong> : "Not Linked"}
          </span>
        </div>
        {user?.google_id ? (
          <button
            onClick={handleUnlink}
            disabled={busy}
            className="bg-rose-100 dark:bg-rose-900/40 text-rose-600 hover:bg-rose-200 text-xs font-semibold rounded-xl px-4 py-2 transition-colors disabled:opacity-50"
          >
            {busy ? "Unlinking..." : "Unlink My Gmail"}
          </button>
        ) : (
          <span className="text-xs text-canal-400 font-medium">Standard Account</span>
        )}
      </div>

      {isAdmin && (
        <div className="flex flex-col gap-3 pt-2 border-t border-canal-200/50 dark:border-canal-700/50">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-earth-900 dark:text-canal-100">Admin Security Control</p>
              <p className="text-[11px] text-canal-500">Remove all secondary logged-in Gmails except the default Admin.</p>
            </div>
            <button
              onClick={handlePurgeAll}
              disabled={busy}
              className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl px-4 py-2 shadow-sm transition-colors disabled:opacity-50 flex-shrink-0"
            >
              Purge Non-Admin Gmails
            </button>
          </div>

          {challenges.length > 0 && (
            <div className="mt-2 flex flex-col gap-2">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                🔒 Pending Google Login Requests ({challenges.length})
              </p>
              {challenges.map((c) => (
                <div key={c.id} className="flex items-center justify-between p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs">
                  <div>
                    <p className="font-semibold text-earth-900 dark:text-canal-100">
                      User #{c.user_id} - IP: {c.requester_ip || "Unknown"}
                    </p>
                    <p className="text-[11px] text-canal-500">Requested approval for Google login</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleRespondChallenge(c.public_id, "allow")}
                      className="bg-paddy-600 hover:bg-paddy-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-sm transition-colors"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleRespondChallenge(c.public_id, "reject")}
                      className="bg-rose-100 text-rose-600 hover:bg-rose-200 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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

function DatabaseResetCard() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleReset = async () => {
    // First confirmation
    const first = window.confirm(
      "⚠️ WARNING: This will permanently delete ALL data:\n\n" +
      "• All farmers\n• All water requests\n• All payments\n• All complaints\n• All users (except admin & operator)\n• All login history\n\n" +
      "Only the default admin@sichaipani.com and operator@sichaipani.com will remain.\n\n" +
      "Click OK to continue to the second confirmation."
    );
    if (!first) return;

    // Second confirmation — must type RESET
    const typed = window.prompt(
      'Type RESET (in capital letters) to confirm you want to wipe all database data:'
    );
    if (typed !== "RESET") {
      alert("Reset cancelled. You must type RESET exactly.");
      return;
    }

    setBusy(true);
    setMsg(null);
    try {
      const res = await api.post("/api/auth/admin/reset-database");
      setMsg({ type: "success", text: res.data.message || "Database reset successfully!" });
    } catch (e: any) {
      setMsg({ type: "error", text: e?.response?.data?.detail || "Reset failed. Please try again." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-5 flex flex-col gap-4 border border-rose-300 dark:border-rose-800">
      <h3 className="font-display font-semibold flex items-center gap-2 text-rose-700 dark:text-rose-400">
        <Trash2 size={18} /> Reset Database
      </h3>
      <p className="text-xs text-canal-500">
        Permanently wipe <strong>all farmers, water requests, payments, complaints, and users</strong> from the database.
        Only the default admin and operator accounts will be kept. This action cannot be undone.
      </p>

      {msg && (
        <div className={`text-sm rounded-xl px-4 py-3 flex items-center gap-2 ${
          msg.type === "success"
            ? "bg-paddy-50 dark:bg-paddy-950/40 text-paddy-700 dark:text-paddy-300 border border-paddy-200 dark:border-paddy-800"
            : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
        }`}>
          {msg.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {msg.text}
        </div>
      )}

      <button
        onClick={handleReset}
        disabled={busy}
        className="flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white font-semibold rounded-xl py-2.5 transition-colors shadow-md"
      >
        <Trash2 size={16} />
        {busy ? "Resetting..." : "Reset All Data"}
      </button>
    </motion.div>
  );
}
