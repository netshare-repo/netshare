import { createContext, useContext, useEffect, useState } from "react";
import axiosInstance from "../api/axiosInstance";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const token = localStorage.getItem("netshare_token");

  const fetchMe = async () => {
    try {
      if (!token) {
        setAuthLoading(false);
        return;
      }

      const res = await axiosInstance.get("/auth/me");
      setUser(res.data.user);
    } catch (error) {
      localStorage.removeItem("netshare_token");
      localStorage.removeItem("netshare_user");
      setUser(null);
    } finally {
      setAuthLoading(false);
    }
  };

  useEffect(() => {
    fetchMe();
  }, []);

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

export const useAuth = () => useContext(AuthContext);