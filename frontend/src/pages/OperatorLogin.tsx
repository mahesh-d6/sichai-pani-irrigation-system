import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Wrench, Mail, Lock, LogIn, ArrowLeft } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import GoogleButton from "../components/GoogleButton";

interface LoginForm {
  email: string;
  password: string;
}

export default function OperatorLogin() {
  const { loginOperator, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>();

  const onSubmit = async (data: LoginForm) => {
    setError("");
    setLoading(true);
    try {
      await loginOperator(data.email, data.password);
      navigate("/");
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleCredential = async (credential: string) => {
    setError("");
    try {
      const outcome = await loginWithGoogle(credential, "operator");
      if (outcome.status === "logged_in") navigate("/");
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Could not sign in with Google.");
    }
  };

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
        <Link to="/login" className="flex items-center gap-1.5 text-xs text-canal-500 hover:text-canal-700 mb-4">
          <ArrowLeft size={13} /> Back
        </Link>

        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-earth-800 flex items-center justify-center mb-3 shadow-lg">
            <Wrench className="text-white" size={28} />
          </div>
          <h1 className="font-display text-2xl font-semibold">Operator</h1>
          <p className="text-sm text-canal-600 dark:text-canal-300">Sign in to start/stop water delivery</p>
        </div>

        <div className="flex flex-col items-center gap-4 mb-6">
          <GoogleButton onCredential={handleGoogleCredential} onError={setError} />
          <div className="flex items-center gap-3 w-full">
            <div className="h-px bg-canal-200 dark:bg-canal-700 flex-1" />
            <span className="text-xs text-canal-400">or sign in with email</span>
            <div className="h-px bg-canal-200 dark:bg-canal-700 flex-1" />
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-canal-400" size={18} />
              <input
                {...register("email", { required: "Required" })}
                type="email"
                className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-white/70 dark:bg-canal-900/40 border border-canal-200 dark:border-canal-700 focus:outline-none focus:ring-2 focus:ring-canal-500"
                placeholder="operator@sichaipani.com"
              />
            </div>
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-canal-400" size={18} />
              <input
                type="password"
                {...register("password", { required: "Required" })}
                className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-white/70 dark:bg-canal-900/40 border border-canal-200 dark:border-canal-700 focus:outline-none focus:ring-2 focus:ring-canal-500"
                placeholder="••••••••"
              />
            </div>
            {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>}
          </div>

          {error && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950/40 rounded-lg px-3 py-2">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center gap-2 bg-earth-800 hover:bg-earth-900 text-white font-medium rounded-xl py-2.5 transition-colors disabled:opacity-60"
          >
            <LogIn size={18} />
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
