import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api.js';

function money(n) {
  return Math.round(Number(n || 0)).toLocaleString('uz-UZ') + " so'm";
}

const CART_STORAGE_KEY = 'gm0064_pos_cart_v1';

function loadSavedCart() {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveCart(state) {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage ishlamasa ham, ilova ishlashda davom etaveradi
  }
}

function clearSavedCart() {
  try {
    localStorage.removeItem(CART_STORAGE_KEY);
  } catch {
    // e'tiborsiz qoldiramiz
  }
}

export default function Pos() {
  const saved = useMemo(() => loadSavedCart(), []);

  const [search, setSearch] = useState('');
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState(saved?.cart || []);
  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState(saved?.customerId || '');
  const [customerSearch, setCustomerSearch] = useState(saved?.customerSearch || '');
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddForm, setQuickAddForm] = useState({ full_name: '', phone: '' });
  const [paidAmount, setPaidAmount] = useState(saved?.paidAmount || '');
  const [message, setMessage] = useState('');
  const [editingPriceId, setEditingPriceId] = useState(null);
  const [discountType, setDiscountType] = useState(saved?.discountType || 'none');
  const [discountValue, setDiscountValue] = useState(saved?.discountValue || '');
  const customerBoxRef = useRef(null);

  useEffect(() => {
    api.listProducts().then(setProducts);
    api.listCustomers().then(setCustomers);
  }, []);

  // Savatni har o'zgarishda saqlab boramiz — mijoz qo'shish uchun boshqa
  // sahifaga o'tib qaytilsa ham, savat mazmuni yo'qolmasin.
  useEffect(() => {
    saveCart({ cart, customerId, customerSearch, paidAmount, discountType, discountValue });
  }, [cart, customerId, customerSearch, paidAmount, discountType, discountValue]);

  // Mijoz tanlash oynasidan tashqariga bosilsa, ro'yxat yopiladi.
  useEffect(() => {
    function onClickOutside(e) {
      if (customerBoxRef.current && !customerBoxRef.current.contains(e.target)) {
        setCustomerDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  function search_(s) {
    setSearch(s);
    api.listProducts(s).then(setProducts);
  }

  function addToCart(p) {
    setCart((prev) => {
      const found = prev.find((it) => it.product_id === p.id);
      if (found) {
        return prev.map((it) => (it.product_id === p.id ? { ...it, quantity: it.quantity + 1 } : it));
      }
      return [...prev, { product_id: p.id, product_name: p.name, unit_price: p.sale_price, original_price: p.sale_price, quantity: 1, max: p.quantity }];
    });
  }

  function updateQty(id, qty) {
    setCart((prev) => prev.map((it) => (it.product_id === id ? { ...it, quantity: Math.max(1, qty) } : it)));
  }

  // (2) Tovar darajasidagi chegirma — savatdagi bitta qatorning narxini
  // to'g'ridan-to'g'ri tahrirlash imkoniyati. Asl narx (original_price)
  // saqlanib qoladi, shunda chegirma qo'yilgan qatorda eski→yangi narx
  // ko'rsatiladi.
  function updateItemPrice(id, price) {
    const clean = Math.max(0, Number(price) || 0);
    setCart((prev) => prev.map((it) => (it.product_id === id ? { ...it, unit_price: clean } : it)));
  }

  function resetItemPrice(id) {
    setCart((prev) => prev.map((it) => (it.product_id === id ? { ...it, unit_price: it.original_price } : it)));
  }

  function removeItem(id) {
    setCart((prev) => prev.filter((it) => it.product_id !== id));
  }

  const subtotal = cart.reduce((s, it) => s + it.quantity * it.unit_price, 0);

  // (2) Umumiy chek chegirmasi — foiz yoki aniq summa, ikkalasi ham
  // subtotal'dan oshib ketmasligi (manfiy jami chiqmasligi) uchun cheklanadi.
  const discountAmount = Math.min(
    subtotal,
    Math.max(
      0,
      discountType === 'percent'
        ? (subtotal * (Number(discountValue) || 0)) / 100
        : discountType === 'fixed'
        ? Number(discountValue) || 0
        : 0
    )
  );
  const total = subtotal - discountAmount;

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) =>
      (c.full_name || '').toLowerCase().includes(q) || (c.phone || '').toLowerCase().includes(q)
    );
  }, [customers, customerSearch]);

  function selectCustomer(c) {
    setCustomerId(c.id);
    setCustomerSearch(c.full_name);
    setCustomerDropdownOpen(false);
  }

  function clearCustomer() {
    setCustomerId('');
    setCustomerSearch('');
  }

  function openQuickAdd() {
    setQuickAddForm({ full_name: customerSearch && !customerId ? customerSearch : '', phone: '' });
    setQuickAddOpen(true);
    setCustomerDropdownOpen(false);
  }

  async function handleQuickAddSave(e) {
    e.preventDefault();
    if (!quickAddForm.full_name.trim()) return;
    try {
      const res = await api.createCustomer({ full_name: quickAddForm.full_name.trim(), phone: quickAddForm.phone, note: '' });
      const newCustomer = { id: res.id, full_name: quickAddForm.full_name.trim(), phone: quickAddForm.phone, current_debt: 0 };
      setCustomers((prev) => [...prev, newCustomer]);
      setCustomerId(res.id);
      setCustomerSearch(newCustomer.full_name);
      setQuickAddOpen(false);
    } catch (err) {
      alert(err.message || "Mijoz qo'shishda xatolik yuz berdi");
    }
  }

  async function handleCheckout(payment_type) {
    setMessage('');
    if (cart.length === 0) return;
    try {
      const paid = payment_type === 'qarz' ? (paidAmount === '' ? 0 : +paidAmount) : total;
      await api.createSale({
        customer_id: customerId || null,
        items: cart.map(({ product_id, product_name, quantity, unit_price }) => ({ product_id, product_name, quantity, unit_price })),
        paid_amount: paid,
        payment_type,
        discount_type: discountType === 'none' ? null : discountType,
        discount_value: discountType === 'none' ? 0 : Number(discountValue) || 0,
      });
      setMessage('✅ Sotuv muvaffaqiyatli amalga oshirildi!');
      setCart([]);
      setCustomerId('');
      setCustomerSearch('');
      setPaidAmount('');
      setDiscountType('none');
      setDiscountValue('');
      clearSavedCart();
      api.listProducts(search).then(setProducts);
    } catch (e) {
      setMessage('❌ ' + e.message);
    }
  }

  return (
    <div>
      <div className="topbar">
        <h2 style={{ margin: 0 }}>Sotuv (kassa)</h2>
      </div>

      {message && (
        <div className="card" style={{ marginBottom: 14, borderColor: message.startsWith('✅') ? 'var(--green)' : 'var(--red)' }}>
          {message}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 16 }}>
        <div className="card">
          <input placeholder="Mahsulot qidirish..." value={search} onChange={(e) => search_(e.target.value)} style={{ marginBottom: 12 }} />
          <div style={{ maxHeight: 420, overflowY: 'auto' }}>
            <table>
              <thead><tr><th>Nomi</th><th>Narx</th><th>Qoldiq</th><th></th></tr></thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>{money(p.sale_price)}</td>
                    <td>{p.quantity}</td>
                    <td><button className="btn secondary" disabled={p.quantity <= 0} onClick={() => addToCart(p)}>+ Qo'shish</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Savat</h3>
          {cart.length === 0 && <div style={{ color: 'var(--text-dim)' }}>Savat bo'sh</div>}
          {cart.map((it) => {
            const isDiscounted = it.unit_price !== it.original_price;
            const isEditing = editingPriceId === it.product_id;
            return (
              <div key={it.product_id} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, fontSize: 14 }}>{it.product_name}</div>
                  <input
                    type="number"
                    style={{ width: 60 }}
                    value={it.quantity}
                    max={it.max}
                    onChange={(e) => updateQty(it.product_id, +e.target.value)}
                  />
                  {isEditing ? (
                    <input
                      type="number"
                      autoFocus
                      style={{ width: 90 }}
                      defaultValue={it.unit_price}
                      onBlur={(e) => { updateItemPrice(it.product_id, e.target.value); setEditingPriceId(null); }}
                      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                    />
                  ) : (
                    <div style={{ width: 90, fontSize: 13, textAlign: 'right' }}>
                      {isDiscounted && (
                        <div style={{ textDecoration: 'line-through', color: 'var(--text-dim)', fontSize: 11 }}>
                          {money(it.quantity * it.original_price)}
                        </div>
                      )}
                      <div style={{ color: isDiscounted ? 'var(--accent)' : undefined, fontWeight: isDiscounted ? 700 : undefined }}>
                        {money(it.quantity * it.unit_price)}
                      </div>
                    </div>
                  )}
                  <button
                    type="button"
                    className="btn secondary"
                    style={{ padding: '6px 8px', fontSize: 12 }}
                    title="Narxni o'zgartirish (chegirma)"
                    onClick={() => setEditingPriceId(isEditing ? null : it.product_id)}
                  >
                    ✏️
                  </button>
                  <button className="btn danger" style={{ padding: '6px 10px' }} onClick={() => removeItem(it.product_id)}>✕</button>
                </div>
                {isDiscounted && !isEditing && (
                  <div style={{ textAlign: 'right', marginTop: 2 }}>
                    <button type="button" className="btn secondary" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => resetItemPrice(it.product_id)}>
                      Asl narxga qaytarish
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          <hr style={{ borderColor: 'var(--border)' }} />

          {/* (2) Umumiy chek chegirmasi */}
          <div className="form-row">
            <label>Umumiy chegirma (ixtiyoriy)</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <select style={{ flex: 1 }} value={discountType} onChange={(e) => setDiscountType(e.target.value)}>
                <option value="none">Yo'q</option>
                <option value="percent">Foiz (%)</option>
                <option value="fixed">Aniq summa (so'm)</option>
              </select>
              {discountType !== 'none' && (
                <input
                  type="number"
                  style={{ width: 100 }}
                  placeholder={discountType === 'percent' ? '%' : "so'm"}
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                />
              )}
            </div>
          </div>

          {discountAmount > 0 && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: 'var(--text-dim)' }}>
                <span>Mahsulotlar jami:</span><span>{money(subtotal)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: 'var(--red)' }}>
                <span>Chegirma:</span><span>-{money(discountAmount)}</span>
              </div>
            </>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 700, margin: '10px 0' }}>
            <span>Jami to'lov:</span><span>{money(total)}</span>
          </div>

          <div className="form-row" ref={customerBoxRef} style={{ position: 'relative' }}>
            <label>Mijoz (ixtiyoriy)</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                style={{ flex: 1 }}
                placeholder="Ism yoki telefon bo'yicha qidirish..."
                value={customerSearch}
                onChange={(e) => {
                  setCustomerSearch(e.target.value);
                  setCustomerId('');
                  setCustomerDropdownOpen(true);
                }}
                onFocus={() => setCustomerDropdownOpen(true)}
              />
              {customerId && (
                <button type="button" className="btn secondary" style={{ padding: '6px 10px' }} onClick={clearCustomer} title="Mijozni bekor qilish">✕</button>
              )}
            </div>

            {customerDropdownOpen && (
              <div
                className="card"
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  zIndex: 20,
                  marginTop: 4,
                  maxHeight: 220,
                  overflowY: 'auto',
                  padding: 6,
                }}
              >
                <button
                  type="button"
                  className="btn"
                  style={{ width: '100%', marginBottom: 6 }}
                  onClick={openQuickAdd}
                >
                  + Yangi mijoz qo'shish
                </button>
                {filteredCustomers.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => selectCustomer(c)}
                    style={{
                      padding: '8px 10px',
                      cursor: 'pointer',
                      borderRadius: 6,
                      display: 'flex',
                      justifyContent: 'space-between',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--border)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span>{c.full_name}</span>
                    <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>{c.phone}</span>
                  </div>
                ))}
                {filteredCustomers.length === 0 && (
                  <div style={{ padding: '8px 10px', color: 'var(--text-dim)', fontSize: 13 }}>Mijoz topilmadi</div>
                )}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" style={{ flex: 1 }} onClick={() => handleCheckout('naqd')} disabled={cart.length === 0}>💵 Naqd</button>
            <button className="btn" style={{ flex: 1 }} onClick={() => handleCheckout('karta')} disabled={cart.length === 0}>💳 Karta</button>
          </div>

          <div className="form-row" style={{ marginTop: 12 }}>
            <label>Qarzga sotish — to'langan summa</label>
            <input type="number" placeholder="0" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} />
            <button className="btn secondary" style={{ width: '100%', marginTop: 8 }} onClick={() => handleCheckout('qarz')} disabled={cart.length === 0 || !customerId}>
              📒 Qarzga yozish
            </button>
            {!customerId && <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>Qarzga sotish uchun mijoz tanlang</div>}
          </div>
        </div>
      </div>

      {quickAddOpen && (
        <div className="modal-overlay" onClick={() => setQuickAddOpen(false)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={handleQuickAddSave}>
            <h3 style={{ marginTop: 0 }}>Yangi mijoz</h3>
            <div className="form-row">
              <label>Ism familiya *</label>
              <input
                required
                autoFocus
                value={quickAddForm.full_name}
                onChange={(e) => setQuickAddForm({ ...quickAddForm, full_name: e.target.value })}
              />
            </div>
            <div className="form-row">
              <label>Telefon</label>
              <input
                value={quickAddForm.phone}
                onChange={(e) => setQuickAddForm({ ...quickAddForm, phone: e.target.value })}
                placeholder="+998 90 123 45 67"
              />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="btn secondary" style={{ flex: 1 }} onClick={() => setQuickAddOpen(false)}>Bekor qilish</button>
              <button className="btn" style={{ flex: 1 }}>Saqlash va tanlash</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
