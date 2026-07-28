import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import api from "../services/api";

export type UserRole = "super_admin" | "admin" | "water_operator" | "farmer" | "guest";

export interface CurrentUser {
  id: number;
  full_name: string;
  email?: string;
  username?: string;
  mobile_number?: string;
  role: UserRole;
  is_active: boolean;
  is_email_verified: boolean;
  photo_url?: string;
  must_change_password?: boolean;
}

export interface AdminLoginOutcome {
  status: "logged_in" | "pending_approval";
  pending_challenge_id?: string | null;
  message?: string | null;
}

interface AuthContextType {
  user: CurrentUser | null;
  loading: boolean;
  loginAdmin: (email: string, password: string, deviceLabel?: string) => Promise<AdminLoginOutcome>;
  loginOperator: (email: string, password: string) => Promise<void>;
  loginFarmer: (username: string, password: string) => Promise<void>;
  loginWithGoogle: (credential: string, role?: "admin" | "operator" | "farmer") => Promise<AdminLoginOutcome>;
  setUser: (u: CurrentUser | null) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function persist(token: string, user: CurrentUser) {
  localStorage.setItem("sichai_token", token);
  localStorage.setItem("sichai_user", JSON.stringify(user));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("sichai_user");
    const token = localStorage.getItem("sichai_token");
    if (stored && token) {
      setUser(JSON.parse(stored));
    }
    setLoading(false);
  }, []);

  const loginAdmin = async (email: string, password: string, deviceLabel?: string): Promise<AdminLoginOutcome> => {
    const res = await api.post("/api/auth/admin/login", { email, password, device_label: deviceLabel });
    if (res.data.status === "logged_in" && res.data.token) {
      persist(res.data.token.access_token, res.data.token.user);
      setUser(res.data.token.user);
    }
    return { status: res.data.status, pending_challenge_id: res.data.pending_challenge_id, message: res.data.message };
  };

  const loginOperator = async (email: string, password: string) => {
    const res = await api.post("/api/auth/operator/login", { email, password });
    persist(res.data.access_token, res.data.user);
    setUser(res.data.user);
  };

  const loginFarmer = async (username: string, password: string) => {
    const res = await api.post("/api/auth/farmer/login", { username, password });
    persist(res.data.access_token, res.data.user);
    setUser(res.data.user);
  };

  const loginWithGoogle = async (credential: string, role: "admin" | "operator" | "farmer" = "farmer"): Promise<AdminLoginOutcome> => {
    const res = await api.post("/api/auth/google", { credential, role });
    if (res.data.status === "logged_in" && res.data.token) {
      persist(res.data.token.access_token, res.data.token.user);
      setUser(res.data.token.user);
    }
    return { status: res.data.status, pending_challenge_id: res.data.pending_challenge_id, message: res.data.message };
  };

  const logout = () => {
    localStorage.removeItem("sichai_token");
    localStorage.removeItem("sichai_user");
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, loginAdmin, loginOperator, loginFarmer, loginWithGoogle, setUser, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
