import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ShieldCheck, ArrowLeft } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";

interface RegisterForm {
  full_name: string;
  email: string;
  password: string;
  confirm_password: string;
}

export default function AdminRegister() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [registrationOpen, setRegistrationOpen] = useState(true);
  const [slotsLeft, setSlotsLeft] = useState<number | null>(null);
  const { register, handleSubmit, watch, formState: { errors } } = useForm<RegisterForm>();

  useEffect(() => {
    api
      .get("/api/auth/admin/registration-status")
      .then((r) => {
        setRegistrationOpen(r.data.open);
        setSlotsLeft(r.data.max_admins - r.data.admin_count);
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  const onSubmit = async (data: RegisterForm) => {
    setError("");
    if (data.password !== data.confirm_password) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const res = await api.post("/api/auth/admin/register", {
        full_name: data.full_name,
        email: data.email,
        password: data.password,
      });
      localStorage.setItem("sichai_token", res.data.access_token);
      localStorage.setItem("sichai_user", JSON.stringify(res.data.user));
      setUser(res.data.user);
      navigate("/");
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Could not create admin account.");
    } finally {
      setLoading(false);
    }
  };

  if (checking) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-ripple p-4 relative overflow-hidden">
      <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-canal-300/30 blur-3xl animate-ripple" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-paddy-300/30 blur-3xl animate-ripple" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="glass-strong rounded-3xl p-8 w-full max-w-md relative z-10"
      >
        <Link to="/login/admin" className="flex items-center gap-1.5 text-xs text-canal-500 hover:text-canal-700 mb-4">
          <ArrowLeft size={13} /> Back to Admin Sign In
        </Link>

        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-canal-600 flex items-center justify-center mb-3 shadow-lg">
            <ShieldCheck className="text-white" size={28} />
          </div>
          <h1 className="font-display text-2xl font-semibold">Register Admin (Sadasya)</h1>
        </div>

        {!registrationOpen ? (
          <p className="text-sm text-center text-canal-600 bg-canal-50 dark:bg-canal-900/40 rounded-lg px-3 py-3">
            All admin accounts have already been created. Please use the Admin Sign In page, or contact an existing admin.
          </p>
        ) : (
          <>
            {slotsLeft !== null && (
              <p className="text-xs text-center text-canal-500 mb-4">{slotsLeft} admin slot(s) remaining</p>
            )}
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Full Name</label>
                <input
                  {...register("full_name", { required: "Required" })}
                  className="input"
                  placeholder="Full Name"
                />
                {errors.full_name && <p className="text-xs text-red-500 mt-1">{errors.full_name.message}</p>}
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Gmail Address</label>
                <input
                  {...register("email", {
                    required: "Required",
                    pattern: { value: /^[^\s@]+@gmail\.com$/i, message: "Must be a @gmail.com address" },
                  })}
                  type="email"
                  className="input"
                  placeholder="yourname@gmail.com"
                />
                {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Password</label>
                <input
                  type="password"
                  {...register("password", {
                    required: "Required",
                    minLength: { value: 8, message: "At least 8 characters" },
                    pattern: {
                      value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/,
                      message: "Must include upper, lower, number, and symbol",
                    },
                  })}
                  className="input"
                  placeholder="Strong password"
                />
                {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>}
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Confirm Password</label>
                <input
                  type="password"
                  {...register("confirm_password", { required: "Required" })}
                  className="input"
                  placeholder="Confirm password"
                />
              </div>

              {watch("password") && (
                <p className="text-xs text-canal-500">
                  Use 8+ characters with uppercase, lowercase, a number, and a symbol.
                </p>
              )}

              {error && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950/40 rounded-lg px-3 py-2">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="bg-canal-600 hover:bg-canal-700 disabled:opacity-60 text-white font-medium rounded-xl py-2.5"
              >
                {loading ? "Creating account..." : "Create Admin Account"}
              </button>
            </form>
          </>
        )}
      </motion.div>
    </div>
  );
}
