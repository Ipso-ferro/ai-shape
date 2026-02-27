import React, { createContext, useContext, useState, useEffect } from "react";
import { api } from "@/lib/api";

interface User {
  id: string;
  email: string;
  isPro: boolean;
  subscriptionTier?: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setUserDirectly: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem("probody_user");
    if (!saved) return null;
    const parsed = JSON.parse(saved) as Partial<User>;
    if (!parsed?.id || !parsed?.email) return null;
    return parsed as User;
  });

  const login = async (email: string, password: string) => {
    const data = await api.post<{ user: User; isPro: boolean }>("/api/v1/auth/login", { email, password });
    const newUser = data.user;
    setUser(newUser);
    localStorage.setItem("probody_user", JSON.stringify(newUser));
  };

  const logout = async () => {
    try { await api.post("/api/v1/auth/logout", {}); } catch { /* proceed anyway */ }
    setUser(null);
    localStorage.removeItem("probody_user");
  };

  const setUserDirectly = (newUser: User) => {
    setUser(newUser);
    localStorage.setItem("probody_user", JSON.stringify(newUser));
  };

  // On mount, refresh token to sync isPro from DB
  useEffect(() => {
    const saved = localStorage.getItem("probody_user");
    if (!saved) return;
    api.post<{ user: User; isPro: boolean }>("/api/v1/auth/refresh", {})
      .then((data) => {
        const existing = JSON.parse(saved) as User;
        if (
          existing.id !== data.user.id ||
          existing.isPro !== data.user.isPro ||
          existing.subscriptionTier !== data.user.subscriptionTier
        ) {
          const updated = { ...existing, ...data.user };
          setUser(updated);
          localStorage.setItem("probody_user", JSON.stringify(updated));
        }
      })
      .catch(() => {
        setUser(null);
        localStorage.removeItem("probody_user");
      });
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, setUserDirectly }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
