import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

function money(n) {
  return Number(n || 0).toLocaleString('uz-UZ') + " so'm";
}

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ full_name: '', phone: '', note: '' });
  const [payModal, setPayModal] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('naqd');
  const [detail, setDetail] = useState(null);

  function load() {
    api.listCustomers().then(setCustomers);
  }
  useEffect(load, []);

  async function handleSave(e) {
    e.preventDefault();
    await api.createCustomer(form);
    setModalOpen(false);
    setForm({ full_name: '', phone: '', note: '' });
    load();
  }

  async function openDetail(c) {
    const d = await api.getCustomer(c.id);
    setDetail(d);
  }

  async function handlePay(e) {
    e.preventDefault();
    await api.payDebt(payModal.id, { amount: +payAmount, payment_method: payMethod });
    setPayModal(null);
    setPayAmount('');
    setPayMethod('naqd');
    load();
  }

  return (
    <div>
      <div className="topbar">
        <h2 style={{ margin: 0 }}>Mijozlar / Qarz daftari</h2>
        <button className="btn" onClick={() => setModalOpen(true)}>+ Yangi mijoz</button>
      </div>

      <div className="card">
        <table>
          <thead><tr><th>Ism</th><th>Telefon</th><th>Qarzi</th><th></th></tr></thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id}>
                <td>{c.full_name}</td>
                <td>{c.phone}</td>
                <td>
                  <span className={`badge ${c.current_debt > 0 ? 'red' : 'green'}`}>{money(c.current_debt)}</span>
                </td>
                <td style={{ display: 'flex', gap: 6 }}>
                  <button className="btn secondary" onClick={() => openDetail(c)}>Tarix</button>
                  {c.current_debt > 0 && <button className="btn" onClick={() => { setPayModal(c); setPayMethod('naqd'); }}>To'lov qabul qilish</button>}
                  <button
                    className="btn danger"
                    onClick={async () => {
                      if (!confirm(`"${c.full_name}" mijozni o'chirishni xohlaysizmi?`)) return;
                      try {
                        await api.deleteCustomer(c.id);
                        load();
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
            {customers.length === 0 && <tr><td colSpan={4} style={{ color: 'var(--text-dim)' }}>Mijozlar yo'q</td></tr>}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSave}>
            <h3 style={{ marginTop: 0 }}>Yangi mijoz</h3>
            <div className="form-row"><label>Ism familiya *</label><input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
            <div className="form-row"><label>Telefon</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+998 90 123 45 67" /></div>
            <div className="form-row"><label>Izoh</label><textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={3} /></div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="btn secondary" style={{ flex: 1 }} onClick={() => setModalOpen(false)}>Bekor qilish</button>
              <button className="btn" style={{ flex: 1 }}>Saqlash</button>
            </div>
          </form>
        </div>
      )}

      {payModal && (
        <div className="modal-overlay" onClick={() => setPayModal(null)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={handlePay}>
            <h3 style={{ marginTop: 0 }}>{payModal.full_name} — to'lov qabul qilish</h3>
            <div className="form-row"><label>Qarzi: {money(payModal.current_debt)}</label></div>
            <div className="form-row">
              <label>To'lov summasi</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input required type="number" style={{ flex: 1 }} value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
                <button type="button" className="btn secondary" onClick={() => setPayAmount(String(payModal.current_debt))}>Jami (to'liq)</button>
              </div>
            </div>
            <div className="form-row">
              <label>Qanday to'landi?</label>
              <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                <option value="naqd">💵 Naqd</option>
                <option value="karta">💳 Karta</option>
              </select>
            </div>
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
            <h3 style={{ marginTop: 0 }}>{detail.customer.full_name} — tarix</h3>
            <h4>Xaridlar</h4>
            <table>
              <thead><tr><th>Sana</th><th>Jami</th><th>To'langan</th><th>Qarz</th></tr></thead>
              <tbody>
                {detail.sales.map((s) => (
                  <tr key={s.id}>
                    <td>{new Date(s.created_at).toLocaleDateString('uz-UZ')}</td>
                    <td>{money(s.total_amount)}</td>
                    <td>{money(s.paid_amount)}</td>
                    <td>{money(s.debt_amount)}</td>
                  </tr>
                ))}
                {detail.sales.length === 0 && <tr><td colSpan={4} style={{ color: 'var(--text-dim)' }}>Xaridlar yo'q</td></tr>}
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
