import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

function money(n) {
  return Math.round(Number(n || 0)).toLocaleString('uz-UZ') + " so'm";
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function Reports() {
  const [from, setFrom] = useState(todayStr());
  const [to, setTo] = useState(todayStr());
  const [sales, setSales] = useState([]);
  const [daily, setDaily] = useState([]);
  const [profitView, setProfitView] = useState('daily');
  const [profitData, setProfitData] = useState(null);

  function load() {
    api.listSales(from, to).then(setSales);
  }

  function refreshReports() {
    load();
    api.dailyReport().then(setDaily);
    api.profitReport(profitView).then(setProfitData).catch(() => setProfitData(null));
  }

  useEffect(() => {
    refreshReports();
  }, []);

  useEffect(() => {
    api.profitReport(profitView).then(setProfitData).catch(() => setProfitData(null));
  }, [profitView]);

  const total = sales.reduce((s, x) => s + x.total_amount, 0);
  const cashTotal = sales.filter((s) => s.payment_type === 'naqd').reduce((s, x) => s + x.total_amount, 0);
  const cardTotal = sales.filter((s) => s.payment_type === 'karta').reduce((s, x) => s + x.total_amount, 0);
  const debtTotal = sales.filter((s) => s.payment_type === 'qarz').reduce((s, x) => s + x.debt_amount, 0);

  const maxDaily = Math.max(1, ...daily.map((d) => d.total));

  return (
    <div>
      <div className="topbar">
        <h2 style={{ margin: 0 }}>Hisobotlar</h2>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h4 style={{ marginTop: 0 }}>Oxirgi 14 kunlik savdo</h4>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 140 }}>
          {daily.map((d) => (
            <div key={d.day} style={{ flex: 1, textAlign: 'center' }}>
              <div
                title={money(d.total)}
                style={{
                  background: 'var(--accent)',
                  height: `${Math.max(4, (d.total / maxDaily) * 110)}px`,
                  borderRadius: 4,
                  marginBottom: 4,
                }}
              />
              <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{d.day.slice(5)}</div>
            </div>
          ))}
          {daily.length === 0 && <div style={{ color: 'var(--text-dim)' }}>Ma'lumot yo'q</div>}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="form-row" style={{ marginBottom: 0 }}>
          <label>Dan</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="form-row" style={{ marginBottom: 0 }}>
          <label>Gacha</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <button className="btn" onClick={load}>Filtrlash</button>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0 }}>Foyda hisoboti</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            {['daily', 'monthly', 'yearly'].map((key) => (
              <button
                key={key}
                type="button"
                className={`btn ${profitView === key ? '' : 'secondary'}`}
                onClick={() => setProfitView(key)}
              >
                {key === 'daily' ? 'Kunlik' : key === 'monthly' ? 'Oylik' : 'Yillik'}
              </button>
            ))}
          </div>
        </div>

        {profitData && (
          <div>
            <div className="stat-grid" style={{ marginTop: 16 }}>
              <div className="stat-card"><div className="label">Jami savdo</div><div className="value">{money(profitData.totalSales)}</div></div>
              <div className="stat-card"><div className="label">Jami tan narx</div><div className="value">{money(profitData.totalCost)}</div></div>
              <div className="stat-card"><div className="label">Jami xarajat</div><div className="value" style={{ color: 'var(--red)' }}>{money(profitData.totalExpenses)}</div></div>
              <div className="stat-card">
                <div className="label">Real (kassa) foyda</div>
                <div className="value" style={{ color: profitData.kassaFoyda >= 0 ? 'var(--green)' : 'var(--red)' }}>{money(profitData.kassaFoyda)}</div>
              </div>
            </div>
            <div className="card" style={{ marginTop: 12, background: 'var(--panel-light)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>📒 Kutilayotgan foyda (hali qaytarilmagan qarzlardan)</div>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>Mijoz qarzni to'laganda, bu summa avtomatik real foydaga qo'shiladi</div>
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>{money(profitData.kutilayotganFoyda)}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="stat-grid">
        <div className="stat-card"><div className="label">Jami savdo</div><div className="value">{money(total)}</div></div>
        <div className="stat-card"><div className="label">Naqd</div><div className="value">{money(cashTotal)}</div></div>
        <div className="stat-card"><div className="label">Karta</div><div className="value">{money(cardTotal)}</div></div>
        <div className="stat-card"><div className="label">Qarzga berilgan</div><div className="value" style={{ color: 'var(--red)' }}>{money(debtTotal)}</div></div>
      </div>

      <div className="card">
        <table>
          <thead><tr><th>Sana</th><th>Mijoz</th><th>Sotuvchi</th><th>To'lov turi</th><th>Jami</th><th></th></tr></thead>
          <tbody>
            {sales.map((s) => (
              <tr key={s.id}>
                <td>{new Date(s.created_at).toLocaleString('uz-UZ')}</td>
                <td>{s.customer_name || '—'}</td>
                <td>{s.seller_name}</td>
                <td><span className={`badge ${s.payment_type === 'qarz' ? 'red' : 'green'}`}>{s.payment_type}</span></td>
                <td>{money(s.total_amount)}</td>
                <td>
                  <button
                    className="btn danger"
                    onClick={async () => {
                      if (!confirm('Ushbu chekni o\'chirishni xohlaysizmi?')) return;
                      try {
                        await api.deleteSale(s.id);
                        refreshReports();
                      } catch (e) {
                        alert(e.message || 'O\'chirishda xatolik yuz berdi');
                      }
                    }}
                  >
                    O'chirish
                  </button>
                </td>
              </tr>
            ))}
            {sales.length === 0 && <tr><td colSpan={6} style={{ color: 'var(--text-dim)' }}>Bu davrda sotuv yo'q</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
