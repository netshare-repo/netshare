import { useCallback, useEffect, useState } from "react";
import { AuthContext } from './authState';
import axiosInstance from "../api/axiosInstance";


export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const token = localStorage.getItem("netshare_token");

  const fetchMe = useCallback(async () => {
    try {
      if (!token) {
        setAuthLoading(false);
        return;
      }

      const res = await axiosInstance.get("/auth/me");
      setUser(res.data.user);
    } catch {
      localStorage.removeItem("netshare_token");
      localStorage.removeItem("netshare_user");
      setUser(null);
    } finally {
      setAuthLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void Promise.resolve().then(fetchMe);
  }, [fetchMe]);

  const login = (token, user) => {
    localStorage.setItem("netshare_token", token);
    localStorage.setItem("netshare_user", JSON.stringify(user));
    setUser(user);
  };

  const logout = () => {
    localStorage.removeItem("netshare_token");
    localStorage.removeItem("netshare_user");
    setUser(null);
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, authLoading }}>
      {children}
    </AuthContext.Provider>
  );
};
