import React, { createContext, useContext, useState } from 'react';
import { api } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('posway_user');
    return saved ? JSON.parse(saved) : null;
  });

  async function login(username, password) {
    const data = await api.login(username, password);
    localStorage.setItem('posway_token', data.token);
    localStorage.setItem('posway_user', JSON.stringify(data.user));
    setUser(data.user);
  }

  function logout() {
    localStorage.removeItem('posway_token');
    localStorage.removeItem('posway_user');
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
