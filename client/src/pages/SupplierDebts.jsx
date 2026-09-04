import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

function money(n) {
  return Math.round(Number(n || 0)).toLocaleString('uz-UZ') + " so'm";
}

export default function SupplierDebts() {
  const [suppliers, setSuppliers] = useState([]);
  const [payModal, setPayModal] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [detail, setDetail] = useState(null);

  function load() {
    api.listSupplierDebts().then(setSuppliers);
  }
  useEffect(load, []);

  async function openDetail(s) {
    const d = await api.supplierDebtEntries(s.supplier_name);
    setDetail(d);
  }

  async function handlePay(e) {
    e.preventDefault();
    await api.paySupplierDebt({ supplier_name: payModal.supplier_name, amount: +payAmount });
    setPayModal(null);
    setPayAmount('');
    load();
  }

  return (
    <div>
      <div className="topbar">
        <h2 style={{ margin: 0 }}>Ta'minotchilarga qarzim</h2>
      </div>

      <div className="card" style={{ marginBottom: 16, color: 'var(--text-dim)', fontSize: 13 }}>
        Bu bo'lim — do'kon ta'minotchilarga (mahsulot nasiyaga olingan joylarga) to'lashi kerak bo'lgan pulni ko'rsatadi.
        Mijozlar qarzidan farqli — bu yerda yo'nalish teskari: siz ularga qarzdorsiz.
      </div>

      <div className="card">
        <table>
          <thead><tr><th>Ta'minotchi</th><th>Jami qarz</th><th>To'langan</th><th>Qoldiq</th><th></th></tr></thead>
          <tbody>
            {suppliers.map((s) => (
              <tr key={s.supplier_name}>
                <td>{s.supplier_name}</td>
                <td>{money(s.total_debt)}</td>
                <td>{money(s.total_paid)}</td>
                <td>
                  <span className={`badge ${s.balance > 0 ? 'red' : 'green'}`}>{money(s.balance)}</span>
                </td>
                <td style={{ display: 'flex', gap: 6 }}>
                  <button className="btn secondary" onClick={() => openDetail(s)}>Tarix</button>
                  {s.balance > 0 && <button className="btn" onClick={() => setPayModal(s)}>To'lov qilish</button>}
                </td>
              </tr>
            ))}
            {suppliers.length === 0 && <tr><td colSpan={5} style={{ color: 'var(--text-dim)' }}>Ta'minotchilarga qarz yo'q</td></tr>}
          </tbody>
        </table>
      </div>

      {payModal && (
        <div className="modal-overlay" onClick={() => setPayModal(null)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={handlePay}>
            <h3 style={{ marginTop: 0 }}>{payModal.supplier_name} — to'lov qilish</h3>
            <div className="form-row"><label>Qoldiq qarz: {money(payModal.balance)}</label></div>
            <div className="form-row"><label>To'lov summasi</label><input required type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} /></div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="btn secondary" style={{ flex: 1 }} onClick={() => setPayModal(null)}>Bekor qilish</button>
              <button className="btn" style={{ flex: 1 }}>Tasdiqlash</button>
            </div>
          </form>
        </div>
      )}

      {detail && (
        <div className="modal-overlay" onClick={() => setDetail(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <h3 style={{ marginTop: 0 }}>{detail.supplier_name} — tarix</h3>
            <h4>Kirim (nasiya olingan mahsulotlar)</h4>
            <table>
              <thead><tr><th>Sana</th><th>Mahsulot</th><th>Soni</th><th>Summa</th></tr></thead>
              <tbody>
                {detail.debts.map((d) => (
                  <tr key={d.id}>
                    <td>{new Date(d.created_at).toLocaleDateString('uz-UZ')}</td>
                    <td>{d.product_name}</td>
                    <td>{d.quantity}</td>
                    <td>{money(d.amount)}</td>
                  </tr>
                ))}
                {detail.debts.length === 0 && <tr><td colSpan={4} style={{ color: 'var(--text-dim)' }}>Kirim yo'q</td></tr>}
              </tbody>
            </table>
            <h4>To'lovlar</h4>
            <table>
              <thead><tr><th>Sana</th><th>Summa</th></tr></thead>
              <tbody>
                {detail.payments.map((p) => (
                  <tr key={p.id}><td>{new Date(p.created_at).toLocaleDateString('uz-UZ')}</td><td>{money(p.amount)}</td></tr>
                ))}
                {detail.payments.length === 0 && <tr><td colSpan={2} style={{ color: 'var(--text-dim)' }}>To'lovlar yo'q</td></tr>}
              </tbody>
            </table>
            <button className="btn secondary" style={{ width: '100%', marginTop: 10 }} onClick={() => setDetail(null)}>Yopish</button>
          </div>
        </div>
      )}
    </div>
  );
}
