import { createContext, useContext, useEffect, useState } from 'react';
import { http } from '../api/http.js';

const AuthContext = createContext(null);
const tokenKey = 'cabinet.accessToken';
const userKey = 'cabinet.user';

function readUser() {
  try {
    return JSON.parse(sessionStorage.getItem(userKey) ?? 'null');
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => sessionStorage.getItem(tokenKey));
  const [user, setUser] = useState(readUser);

  useEffect(() => {
    if (!token) return;

    let active = true;
    http.get('/auth/me')
      .then(({ data }) => {
        if (!active) return;
        setUser(data.data.user);
        sessionStorage.setItem(userKey, JSON.stringify(data.data.user));
      })
      .catch(() => {
        if (!active) return;
        sessionStorage.removeItem(tokenKey);
        sessionStorage.removeItem(userKey);
        setToken(null);
        setUser(null);
      });

    return () => { active = false; };
  }, [token]);

  async function login(credentials) {
    const { data } = await http.post('/auth/login', credentials);
    const { accessToken, user: signedInUser } = data.data;
    sessionStorage.setItem(tokenKey, accessToken);
    sessionStorage.setItem(userKey, JSON.stringify(signedInUser));
    setToken(accessToken);
    setUser(signedInUser);
  }

  async function logout() {
    try {
      if (token) await http.post('/auth/logout');
    } finally {
      sessionStorage.removeItem(tokenKey);
      sessionStorage.removeItem(userKey);
      setToken(null);
      setUser(null);
    }
  }

  async function changePassword(currentPassword, newPassword) {
    await http.post('/auth/change-password', { currentPassword, newPassword });
    sessionStorage.removeItem(tokenKey);
    sessionStorage.removeItem(userKey);
    setToken(null);
    setUser(null);
  }

  const value = {
    token,
    user,
    login,
    logout,
    changePassword,
    hasPermission: (permission) => user?.permissions?.includes(permission) ?? false,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}