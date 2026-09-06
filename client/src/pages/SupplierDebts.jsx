import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

function money(n) {
  return Math.round(Number(n || 0)).toLocaleString('uz-UZ') + " so'm";
}

const emptyKirimForm = { product_id: '', new_product_name: '', quantity: '', unit_cost: '', payment_type: 'naqd', note: '' };

export default function SupplierDebts() {
  const [suppliers, setSuppliers] = useState([]);
  const [payModal, setPayModal] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('naqd');
  const [detail, setDetail] = useState(null);
  const [oldDebtModal, setOldDebtModal] = useState(false);
  const [oldDebtSupplier, setOldDebtSupplier] = useState('');
  const [oldDebtAmount, setOldDebtAmount] = useState('');
  const [oldDebtDate, setOldDebtDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [oldDebtNote, setOldDebtNote] = useState('');
  const [products, setProducts] = useState([]);
  const [kirimModal, setKirimModal] = useState(false);
  const [kirimForm, setKirimForm] = useState(emptyKirimForm);
  const [kirimUseNew, setKirimUseNew] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [editForm, setEditForm] = useState({ quantity: '', unit_cost: '', payment_type: 'naqd', note: '' });

  function load() {
    api.listSupplierDebts().then(setSuppliers);
  }
  useEffect(load, []);
  useEffect(() => {
    api.listProducts().then(setProducts).catch(() => {});
  }, []);

  async function openDetail(s) {
    const d = await api.supplierDebtEntries(s.supplier_name);
    setDetail(d);
  }

  async function refreshDetail() {
    if (detail) {
      const d = await api.supplierDebtEntries(detail.supplier_name);
      setDetail(d);
    }
  }

  async function handlePay(e) {
    e.preventDefault();
    await api.paySupplierDebt({ supplier_name: payModal.supplier_name, amount: +payAmount, payment_method: payMethod });
    setPayModal(null);
    setPayAmount('');
    setPayMethod('naqd');
    load();
  }

  // (28) Tugma bir necha marta bosilib, xato to'lov (masalan bir xil
  // to'lov 6 marta) yuborilib qo'yilishining oldini olish uchun — tarixdan
  // xato to'lovni bekor qilish imkoniyati. Yozuv o'chirilmaydi, faqat
  // "bekor qilingan" deb belgilanadi, qarz avtomatik tiklanadi.
  async function handleCancelPayment(paymentId) {
    if (!confirm("Bu to'lovni bekor qilishni xohlaysizmi? Qarz miqdori avtomatik tiklanadi.")) return;
    try {
      await api.cancelSupplierDebtPayment(paymentId);
      await refreshDetail();
      load();
    } catch (err) {
      alert(err.message || 'Bekor qilishda xatolik yuz berdi');
    }
  }

  // (30) Ilovadan oldingi eski ta'minotchi qarzlarini qo'lda qo'shish —
  // mahsulot xaridiga bog'lanmagan, alohida yozuv sifatida.
  async function handleAddOldDebt(e) {
    e.preventDefault();
    try {
      await api.addSupplierOldDebt({ supplier_name: oldDebtSupplier, amount: +oldDebtAmount, date: oldDebtDate, note: oldDebtNote });
      setOldDebtModal(false);
      setOldDebtSupplier('');
      setOldDebtAmount('');
      setOldDebtNote('');
      setOldDebtDate(new Date().toISOString().slice(0, 10));
      load();
    } catch (err) {
      alert(err.message || "Qarz qo'shishda xatolik yuz berdi");
    }
  }

  // (31) Ta'minotchi sahifasidan to'g'ridan-to'g'ri kirim qo'shish — bu
  // avtomatik ravishda umumiy Mahsulotlar ro'yxatiga qo'shiladi va, to'lov
  // turidan qat'iy nazar, aynan shu ta'minotchi tarixida saqlanadi.
  async function handleAddKirim(e) {
    e.preventDefault();
    try {
      await api.addSupplierKirim(detail.supplier_name, {
        product_id: kirimUseNew ? null : kirimForm.product_id || null,
        new_product_name: kirimUseNew ? kirimForm.new_product_name : null,
        quantity: +kirimForm.quantity,
        unit_cost: +kirimForm.unit_cost,
        payment_type: kirimForm.payment_type,
        note: kirimForm.note,
      });
      setKirimModal(false);
      setKirimForm(emptyKirimForm);
      setKirimUseNew(false);
      await refreshDetail();
      load();
      api.listProducts().then(setProducts).catch(() => {});
    } catch (err) {
      alert(err.message || "Kirim qo'shishda xatolik yuz berdi");
    }
  }

  function openEditEntry(d) {
    setEditingEntry(d);
    setEditForm({ quantity: d.quantity ?? '', unit_cost: d.unit_cost ?? '', payment_type: d.payment_type || 'nasiya', note: d.note || '' });
  }

  async function handleSaveEdit(e) {
    e.preventDefault();
    try {
      await api.updateSupplierDebtEntry(editingEntry.id, {
        quantity: editingEntry.product_id ? +editForm.quantity : undefined,
        unit_cost: editingEntry.product_id ? +editForm.unit_cost : undefined,
        payment_type: editForm.payment_type,
        note: editForm.note,
      });
      setEditingEntry(null);
      await refreshDetail();
      load();
      api.listProducts().then(setProducts).catch(() => {});
    } catch (err) {
      alert(err.message || 'Tahrirlashda xatolik yuz berdi');
    }
  }

  async function handleDeleteEntry(id) {
    if (!confirm("Bu kirim yozuvini o'chirishni xohlaysizmi? Mahsulot qoldig'i va kassa balansi avtomatik to'g'irlanadi.")) return;
    try {
      await api.deleteSupplierDebtEntry(id);
      await refreshDetail();
      load();
      api.listProducts().then(setProducts).catch(() => {});
    } catch (err) {
      alert(err.message || "O'chirishda xatolik yuz berdi");
    }
  }

  function paymentBadge(type) {
    if (type === 'karta') return '💳 Karta';
    if (type === 'naqd') return '💵 Naqd';
    return '📒 Nasiya';
  }

  return (
    <div>
      <div className="topbar">
        <h2 style={{ margin: 0 }}>Ta'minotchilarga qarzim</h2>
        <button className="btn" onClick={() => setOldDebtModal(true)}>+ Eski qarz qo'shish</button>
      </div>

      <div className="card" style={{ marginBottom: 16, color: 'var(--text-dim)', fontSize: 13 }}>
        Bu bo'lim — do'kon ta'minotchilarga to'lashi kerak bo'lgan pulni ko'rsatadi. Har bir ta'minotchining "Tarix" sahifasiga kirib, undan kelgan har qanday kirimni (naqd, karta yoki nasiya) qo'shishingiz mumkin.
      </div>

      <div className="card">
        <table>
          <thead><tr><th>Ta'minotchi</th><th>Jami olingan</th><th>Qarz</th><th>To'langan</th><th>Qoldiq qarz</th><th></th></tr></thead>
          <tbody>
            {suppliers.map((s) => (
              <tr key={s.supplier_name}>
                <td>{s.supplier_name}</td>
                <td>{money(s.total_purchased)}</td>
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
            {suppliers.length === 0 && <tr><td colSpan={6} style={{ color: 'var(--text-dim)' }}>Ta'minotchilarga qarz yo'q</td></tr>}
          </tbody>
        </table>
      </div>

      {payModal && (
        <div className="modal-overlay" onClick={() => setPayModal(null)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={handlePay}>
            <h3 style={{ marginTop: 0 }}>{payModal.supplier_name} — to'lov qilish</h3>
            <div className="form-row"><label>Qoldiq qarz: {money(payModal.balance)}</label></div>
            <div className="form-row"><label>To'lov summasi</label><input required type="number" value={payAmount} onFocus={(e) => e.target.select()} onChange={(e) => setPayAmount(e.target.value)} /></div>
            <div className="form-row">
              <label>Qanday to'landi?</label>
              <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                <option value="naqd">💵 Naqd (kassadan ayiriladi)</option>
                <option value="karta">💳 Karta (kassadan ayiriladi)</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="btn secondary" style={{ flex: 1 }} onClick={() => setPayModal(null)}>Bekor qilish</button>
              <button className="btn" style={{ flex: 1 }}>Tasdiqlash</button>
            </div>
          </form>
        </div>
      )}

      {oldDebtModal && (
        <div className="modal-overlay" onClick={() => setOldDebtModal(false)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={handleAddOldDebt}>
            <h3 style={{ marginTop: 0 }}>Eski qarz qo'shish</h3>
            <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 10 }}>
              Bu ilovadan oldingi, mahsulot xaridiga bog'lanmagan qarzlar uchun.
            </div>
            <div className="form-row">
              <label>Ta'minotchi nomi *</label>
              <input required value={oldDebtSupplier} onChange={(e) => setOldDebtSupplier(e.target.value)} placeholder="Yangi yoki mavjud ta'minotchi nomi" />
            </div>
            <div className="form-row">
              <label>Qarz summasi *</label>
              <input required type="number" value={oldDebtAmount} onFocus={(e) => e.target.select()} onChange={(e) => setOldDebtAmount(e.target.value)} />
            </div>
            <div className="form-row">
              <label>Qarz qachondan boshlangan?</label>
              <input type="date" value={oldDebtDate} onChange={(e) => setOldDebtDate(e.target.value)} />
            </div>
            <div className="form-row">
              <label>Izoh (ixtiyoriy)</label>
              <input value={oldDebtNote} onChange={(e) => setOldDebtNote(e.target.value)} placeholder="Masalan: ilovadan oldingi qarz" />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="btn secondary" style={{ flex: 1 }} onClick={() => setOldDebtModal(false)}>Bekor qilish</button>
              <button className="btn" style={{ flex: 1 }}>Qo'shish</button>
            </div>
          </form>
        </div>
      )}

      {detail && (
        <div className="modal-overlay" onClick={() => setDetail(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 620 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ marginTop: 0 }}>{detail.supplier_name} — tarix</h3>
              <button className="btn" onClick={() => setKirimModal(true)}>+ Yangi kirim</button>
            </div>

            <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
              <div>Jami olingan: <b>{money(detail.debts.reduce((s, d) => s + Number(d.amount || 0), 0))}</b></div>
            </div>

            <h4>Kirimlar</h4>
            <table>
              <thead><tr><th>Sana</th><th>Mahsulot</th><th>Soni</th><th>Summa</th><th>Turi</th><th></th></tr></thead>
              <tbody>
                {detail.debts.map((d) => (
                  <tr key={d.id}>
                    <td>{new Date(d.created_at).toLocaleDateString('uz-UZ')}</td>
                    <td>{d.product_name || <span style={{ color: 'var(--text-dim)' }}>Eski qarz</span>}</td>
                    <td>{d.quantity ?? '-'}</td>
                    <td>{money(d.amount)}</td>
                    <td>{paymentBadge(d.payment_type)}</td>
                    <td style={{ display: 'flex', gap: 4 }}>
                      <button className="btn secondary" style={{ fontSize: 12, padding: '4px 8px' }} onClick={() => openEditEntry(d)}>Tahrirlash</button>
                      <button className="btn danger" style={{ fontSize: 12, padding: '4px 8px' }} onClick={() => handleDeleteEntry(d.id)}>O'chirish</button>
                    </td>
                  </tr>
                ))}
                {detail.debts.length === 0 && <tr><td colSpan={6} style={{ color: 'var(--text-dim)' }}>Kirim yo'q</td></tr>}
              </tbody>
            </table>
            <h4>To'lovlar</h4>
            <table>
              <thead><tr><th>Sana</th><th>Summa</th><th>Turi</th><th>Holati</th><th></th></tr></thead>
              <tbody>
                {detail.payments.map((p) => (
                  <tr key={p.id} style={p.cancelled ? { opacity: 0.5, textDecoration: 'line-through' } : undefined}>
                    <td>{new Date(p.created_at).toLocaleDateString('uz-UZ')}</td>
                    <td>{money(p.amount)}</td>
                    <td>{p.payment_method === 'karta' ? '💳 Karta' : '💵 Naqd'}</td>
                    <td>{p.cancelled ? 'Bekor qilingan' : 'Faol'}</td>
                    <td>
                      {!p.cancelled && (
                        <button className="btn danger" style={{ textDecoration: 'none' }} onClick={() => handleCancelPayment(p.id)}>
                          Bekor qilish
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {detail.payments.length === 0 && <tr><td colSpan={5} style={{ color: 'var(--text-dim)' }}>To'lovlar yo'q</td></tr>}
              </tbody>
            </table>
            <button className="btn secondary" style={{ width: '100%', marginTop: 10 }} onClick={() => setDetail(null)}>Yopish</button>
          </div>
        </div>
      )}

      {/* (31) Muhim: bu ikkita modal "Tarix" oynasi (detail) USTIGA ochiladi,
          shuning uchun JSX'da ATAYLAB detail'dan KEYIN joylashtirilgan —
          aks holda "detail" oynasi keyinroq render bo'lganidan (DOM'da
          keyingi) ustiga chiqib, ularning tugmalarini bosib bo'lmay qolar edi. */}
      {kirimModal && detail && (
        <div className="modal-overlay" onClick={() => setKirimModal(false)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={handleAddKirim}>
            <h3 style={{ marginTop: 0 }}>{detail.supplier_name} — yangi kirim qo'shish</h3>

            <div className="form-row">
              <label>
                <input type="checkbox" checked={kirimUseNew} onChange={(e) => setKirimUseNew(e.target.checked)} style={{ marginRight: 6 }} />
                Yangi mahsulot (ro'yxatda yo'q)
              </label>
            </div>

            {kirimUseNew ? (
              <div className="form-row">
                <label>Mahsulot nomi *</label>
                <input required value={kirimForm.new_product_name} onChange={(e) => setKirimForm({ ...kirimForm, new_product_name: e.target.value })} />
              </div>
            ) : (
              <div className="form-row">
                <label>Mahsulot *</label>
                <select required value={kirimForm.product_id} onChange={(e) => setKirimForm({ ...kirimForm, product_id: e.target.value })}>
                  <option value="">— tanlang —</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name} {p.brand ? `(${p.brand})` : ''}</option>)}
                </select>
              </div>
            )}

            <div className="form-row">
              <label>Soni *</label>
              <input required type="number" value={kirimForm.quantity} onFocus={(e) => e.target.select()} onChange={(e) => setKirimForm({ ...kirimForm, quantity: e.target.value })} />
            </div>
            <div className="form-row">
              <label>Tan narx (dona uchun) *</label>
              <input required type="number" value={kirimForm.unit_cost} onFocus={(e) => e.target.select()} onChange={(e) => setKirimForm({ ...kirimForm, unit_cost: e.target.value })} />
            </div>
            <div className="form-row">
              <label>To'lov turi *</label>
              <select value={kirimForm.payment_type} onChange={(e) => setKirimForm({ ...kirimForm, payment_type: e.target.value })}>
                <option value="naqd">💵 Naqd (kassadan ayiriladi)</option>
                <option value="karta">💳 Karta (kassadan ayiriladi)</option>
                <option value="nasiya">📒 Nasiya (qarz sifatida yoziladi)</option>
              </select>
            </div>
            <div className="form-row">
              <label>Izoh (ixtiyoriy)</label>
              <input value={kirimForm.note} onChange={(e) => setKirimForm({ ...kirimForm, note: e.target.value })} />
            </div>
            {kirimForm.quantity > 0 && kirimForm.unit_cost > 0 && (
              <div style={{ fontWeight: 700, marginBottom: 10 }}>Jami: {money(Number(kirimForm.quantity) * Number(kirimForm.unit_cost))}</div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="btn secondary" style={{ flex: 1 }} onClick={() => setKirimModal(false)}>Bekor qilish</button>
              <button className="btn" style={{ flex: 1 }}>Qo'shish</button>
            </div>
          </form>
        </div>
      )}

      {editingEntry && (
        <div className="modal-overlay" onClick={() => setEditingEntry(null)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSaveEdit}>
            <h3 style={{ marginTop: 0 }}>Kirimni tahrirlash</h3>
            {editingEntry.product_id ? (
              <>
                <div className="form-row"><label>Mahsulot</label><input disabled value={editingEntry.product_name} /></div>
                <div className="form-row">
                  <label>Soni</label>
                  <input required type="number" value={editForm.quantity} onFocus={(e) => e.target.select()} onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })} />
                </div>
                <div className="form-row">
                  <label>Tan narx (dona uchun)</label>
                  <input required type="number" value={editForm.unit_cost} onFocus={(e) => e.target.select()} onChange={(e) => setEditForm({ ...editForm, unit_cost: e.target.value })} />
                </div>
              </>
            ) : (
              <div className="form-row"><label>Bu — eski qarz yozuvi (mahsulotga bog'lanmagan), faqat izoh o'zgartirilishi mumkin.</label></div>
            )}
            <div className="form-row">
              <label>To'lov turi</label>
              <select value={editForm.payment_type} onChange={(e) => setEditForm({ ...editForm, payment_type: e.target.value })}>
                <option value="naqd">💵 Naqd</option>
                <option value="karta">💳 Karta</option>
                <option value="nasiya">📒 Nasiya</option>
              </select>
            </div>
            <div className="form-row">
              <label>Izoh</label>
              <input value={editForm.note} onChange={(e) => setEditForm({ ...editForm, note: e.target.value })} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="btn secondary" style={{ flex: 1 }} onClick={() => setEditingEntry(null)}>Bekor qilish</button>
              <button className="btn" style={{ flex: 1 }}>Saqlash</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
