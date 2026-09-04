import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';

const empty = { name: '', brand: '', category: '', part_type: 'original', costPrice: 0, purchase_price: 0, sale_price: 0, quantity: 0, min_quantity: 2, car_models: '', payment_type: 'naqd', supplier_name: '' };

function normalizeProduct(p = {}) {
  const costPrice = Number(p.costPrice ?? p.purchase_price ?? 0) || 0;
  return { ...p, costPrice, purchase_price: costPrice };
}

function money(n) {
  return Number(n || 0).toLocaleString('uz-UZ') + " so'm";
}

export default function Products() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState(null);
  const [showCostPrices, setShowCostPrices] = useState(false);
  const [kirimProduct, setKirimProduct] = useState(null);
  const [kirimForm, setKirimForm] = useState({ quantity: '', unit_cost: '', payment_type: 'naqd', supplier_name: '', note: '' });
  const { user } = useAuth();
  const canEdit = user.role === 'admin' || user.role === 'omborchi';

  function load(s) {
    api.listProducts(s).then((rows) => setProducts(rows.map(normalizeProduct))).catch(() => {});
  }

  useEffect(() => { load(); }, []);

  function openKirim(p) {
    setKirimProduct(p);
    setKirimForm({ quantity: '', unit_cost: p.costPrice ?? p.purchase_price ?? '', payment_type: 'naqd', supplier_name: '', note: '' });
  }

  async function handleKirimSave(e) {
    e.preventDefault();
    try {
      await api.stockIn(kirimProduct.id, {
        quantity: Number(kirimForm.quantity || 0),
        unit_cost: Number(kirimForm.unit_cost || 0),
        payment_type: kirimForm.payment_type,
        supplier_name: kirimForm.supplier_name,
        note: kirimForm.note,
      });
      setKirimProduct(null);
      load(search);
    } catch (err) {
      alert(err.message || 'Kirim qilishda xatolik yuz berdi');
    }
  }

  function openNew() {
    setForm(empty);
    setEditingId(null);
    setModalOpen(true);
  }

  function openEdit(p) {
    setForm(normalizeProduct(p));
    setEditingId(p.id);
    setModalOpen(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    const payload = {
      ...form,
      costPrice: Number(form.costPrice ?? form.purchase_price ?? 0) || 0,
      purchase_price: Number(form.costPrice ?? form.purchase_price ?? 0) || 0,
      sale_price: Number(form.sale_price || 0),
      quantity: Number(form.quantity || 0),
      min_quantity: Number(form.min_quantity ?? 2),
    };

    try {
      if (editingId) {
        await api.updateProduct(editingId, payload);
      } else {
        await api.createProduct(payload);
      }
      setModalOpen(false);
      load(search);
    } catch (err) {
      alert(err.message || 'Saqlashda xatolik yuz berdi');
    }
  }

  async function handleDelete(id) {
    if (!confirm("Mahsulotni o'chirishga ishonchingiz komilmi?")) return;
    await api.deleteProduct(id);
    load(search);
  }

  return (
    <div>
      <div className="topbar">
        <h2 style={{ margin: 0 }}>Mahsulotlar</h2>
        {canEdit && <button className="btn" onClick={openNew}>+ Yangi mahsulot</button>}
      </div>

      <div className="card" style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
        <input
          placeholder="Qidirish: nomi, brend, mashina modeli..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); load(e.target.value); }}
          style={{ flex: 1 }}
        />
        {canEdit && (
          <button type="button" className="btn secondary" onClick={() => setShowCostPrices((v) => !v)}>
            {showCostPrices ? '🙈' : '👁️'} {showCostPrices ? 'Yashirish' : 'Ko\'rsatish'}
          </button>
        )}
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Nomi</th><th>Brend</th><th>Turi</th><th>Tan narx</th><th>Narx</th><th>Qoldiq</th>{canEdit && <th></th>}
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td>{p.name}<div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{p.car_models}</div></td>
                <td>{p.brand}</td>
                <td>
                  <span className={`badge ${p.part_type === 'original' ? 'green' : 'orange'}`}>
                    {p.part_type === 'original' ? 'Original' : 'Ishlatilgan'}
                  </span>
                </td>
                <td>{showCostPrices ? money(p.costPrice ?? p.purchase_price ?? 0) : '••••••'}</td>
                <td>{money(p.sale_price)}</td>
                <td>
                  <span className={`badge ${p.quantity <= p.min_quantity ? 'red' : 'green'}`}>{p.quantity} dona</span>
                </td>
                {canEdit && (
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button className="btn secondary" onClick={() => openKirim(p)}>📥 Kirim</button>
                    <button className="btn secondary" onClick={() => openEdit(p)}>Tahrirlash</button>
                    {user.role === 'admin' && <button className="btn danger" onClick={() => handleDelete(p.id)}>O'chirish</button>}
                  </td>
                )}
              </tr>
            ))}
            {products.length === 0 && <tr><td colSpan={canEdit ? 7 : 6} style={{ color: 'var(--text-dim)' }}>Mahsulot topilmadi</td></tr>}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSave}>
            <h3 style={{ marginTop: 0 }}>{editingId ? 'Mahsulotni tahrirlash' : 'Yangi mahsulot'}</h3>
            <div className="form-row">
              <label>Nomi *</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="form-row">
              <label>Brend</label>
              <input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} placeholder="masalan: Bosch, Chevrolet" />
            </div>
            <div className="form-row">
              <label>Mos mashina modellari</label>
              <input value={form.car_models} onChange={(e) => setForm({ ...form, car_models: e.target.value })} placeholder="masalan: Nexia, Cobalt, Malibu" />
            </div>
            <div className="form-row">
              <label>Turi</label>
              <select value={form.part_type} onChange={(e) => setForm({ ...form, part_type: e.target.value })}>
                <option value="original">Original</option>
                <option value="ishlatilgan">Ishlatilgan</option>
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="form-row">
                <label>Tan narx</label>
                <input type="number" value={form.costPrice ?? form.purchase_price ?? 0} onChange={(e) => setForm({ ...form, costPrice: +e.target.value, purchase_price: +e.target.value })} />
              </div>
              <div className="form-row">
                <label>Sotish narxi *</label>
                <input required type="number" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: +e.target.value })} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="form-row">
                <label>Qoldiq soni</label>
                <input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: +e.target.value })} />
              </div>
              <div className="form-row">
                <label>Minimal qoldiq (ogohlantirish)</label>
                <input type="number" value={form.min_quantity} onChange={(e) => setForm({ ...form, min_quantity: +e.target.value })} />
              </div>
            </div>
            {!editingId && Number(form.quantity) > 0 && Number(form.costPrice ?? form.purchase_price ?? 0) > 0 && (
              <>
                <div className="form-row">
                  <label>Boshlang'ich zaxira qanday to'landi? *</label>
                  <select value={form.payment_type} onChange={(e) => setForm({ ...form, payment_type: e.target.value })}>
                    <option value="naqd">💵 Naqd (kassadan ayiriladi)</option>
                    <option value="karta">💳 Karta (kassadan ayiriladi)</option>
                    <option value="nasiya">📒 Nasiya (ta'minotchiga qarz yoziladi)</option>
                  </select>
                </div>
                {form.payment_type === 'nasiya' && (
                  <div className="form-row">
                    <label>Ta'minotchi nomi *</label>
                    <input required value={form.supplier_name} onChange={(e) => setForm({ ...form, supplier_name: e.target.value })} placeholder="masalan: Mavlon aka, Timsoll" />
                  </div>
                )}
                <div style={{ fontWeight: 700, marginBottom: 4, color: 'var(--text-dim)', fontSize: 13 }}>
                  Jami: {money(Number(form.quantity || 0) * Number(form.costPrice ?? form.purchase_price ?? 0))}
                </div>
              </>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
              <button type="button" className="btn secondary" style={{ flex: 1 }} onClick={() => setModalOpen(false)}>Bekor qilish</button>
              <button className="btn" style={{ flex: 1 }}>Saqlash</button>
            </div>
          </form>
        </div>
      )}
      {kirimProduct && (
        <div className="modal-overlay" onClick={() => setKirimProduct(null)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={handleKirimSave}>
            <h3 style={{ marginTop: 0 }}>Kirim: {kirimProduct.name}</h3>
            <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 10 }}>Hozirgi qoldiq: {kirimProduct.quantity} dona</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="form-row">
                <label>Qo'shiladigan miqdor *</label>
                <input required type="number" value={kirimForm.quantity} onChange={(e) => setKirimForm({ ...kirimForm, quantity: e.target.value })} />
              </div>
              <div className="form-row">
                <label>Dona tan narxi *</label>
                <input required type="number" value={kirimForm.unit_cost} onChange={(e) => setKirimForm({ ...kirimForm, unit_cost: e.target.value })} />
              </div>
            </div>
            <div className="form-row">
              <label>Qanday to'landi? *</label>
              <select value={kirimForm.payment_type} onChange={(e) => setKirimForm({ ...kirimForm, payment_type: e.target.value })}>
                <option value="naqd">💵 Naqd (kassadan ayiriladi)</option>
                <option value="karta">💳 Karta (kassadan ayiriladi)</option>
                <option value="nasiya">📒 Nasiya (ta'minotchiga qarz yoziladi)</option>
              </select>
            </div>
            {kirimForm.payment_type === 'nasiya' && (
              <div className="form-row">
                <label>Ta'minotchi nomi *</label>
                <input required value={kirimForm.supplier_name} onChange={(e) => setKirimForm({ ...kirimForm, supplier_name: e.target.value })} placeholder="masalan: Mavlon aka, Timsoll" />
              </div>
            )}
            <div className="form-row">
              <label>Izoh</label>
              <input value={kirimForm.note} onChange={(e) => setKirimForm({ ...kirimForm, note: e.target.value })} />
            </div>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>
              Jami: {money(Number(kirimForm.quantity || 0) * Number(kirimForm.unit_cost || 0))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="btn secondary" style={{ flex: 1 }} onClick={() => setKirimProduct(null)}>Bekor qilish</button>
              <button className="btn" style={{ flex: 1 }}>Saqlash</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
