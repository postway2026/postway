import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';

const links = [
  { to: '/', label: '📊 Bosh sahifa', end: true },
  { to: '/sotuv', label: '🛒 Sotuv (kassa)' },
  { to: '/mahsulotlar', label: '📦 Mahsulotlar' },
  { to: '/kassa-harakatlari', label: '💸 Kassa harakati' },
  { to: '/mijozlar', label: '👥 Mijozlar / Qarz' },
  { to: '/hisobotlar', label: '📈 Hisobotlar' },
  { to: '/xodimlar', label: '🧑‍💼 Xodimlar', adminOnly: true },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="app-layout">
      <div className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-brand">
          GM_0064
          <span>{user?.full_name}</span>
        </div>
        {links.map((l) => {
          if (l.adminOnly && user?.role !== 'admin') return null;
          return (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              onClick={() => setOpen(false)}
            >
              {l.label}
            </NavLink>
          );
        })}
        <button className="nav-link" style={{ width: '100%', border: 'none', marginTop: 20, background: 'transparent' }} onClick={handleLogout}>
          🚪 Chiqish
        </button>
      </div>
      <div className="main-content">
        <div className="mobile-toggle" style={{ marginBottom: 16 }}>
          <button className="btn secondary" onClick={() => setOpen(!open)}>☰ Menyu</button>
        </div>
        <Outlet />
      </div>
    </div>
  );
}
