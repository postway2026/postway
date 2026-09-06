import { Router } from 'express';
import { readData, writeData, nextId } from '../db/store.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();

// Ta'minotchilarga qarzim — do'kon ularga to'lashi kerak bo'lgan pul
// (mijozlar qarzidan farqli, bu yerda yo'nalish teskari).

function isDebtBearing(entry) {
  // Naqd/karta bilan olingan kirim darhol to'langan hisoblanadi (qarz
  // hosil qilmaydi). Nasiya, yoki eski (payment_type yozilmagan) yozuvlar
  // — hammasi qarz sifatida hisoblanadi.
  return entry.payment_type !== 'naqd' && entry.payment_type !== 'karta';
}

function summarize(data) {
  const debts = data.supplier_debts || [];
  const payments = (data.supplier_debt_payments || []).filter((p) => !p.cancelled);
  const names = new Set([...debts.map((d) => d.supplier_name), ...(data.supplier_debt_payments || []).map((p) => p.supplier_name)]);

  return [...names].map((name) => {
    const supplierDebts = debts.filter((d) => d.supplier_name === name);
    const totalPurchased = supplierDebts.reduce((s, d) => s + Number(d.amount || 0), 0);
    const totalDebt = supplierDebts.filter(isDebtBearing).reduce((s, d) => s + Number(d.amount || 0), 0);
    const totalPaid = payments.filter((p) => p.supplier_name === name).reduce((s, p) => s + Number(p.amount || 0), 0);
    return {
      supplier_name: name,
      total_purchased: totalPurchased,
      total_debt: totalDebt,
      total_paid: totalPaid,
      balance: totalDebt - totalPaid,
    };
  }).sort((a, b) => a.supplier_name.localeCompare(b.supplier_name));
}

router.get('/', authRequired, (req, res) => {
  const data = readData();
  res.json(summarize(data));
});

router.get('/:supplier_name/entries', authRequired, (req, res) => {
  const data = readData();
  const name = decodeURIComponent(req.params.supplier_name);
  const debts = (data.supplier_debts || [])
    .filter((d) => d.supplier_name === name)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const payments = (data.supplier_debt_payments || [])
    .filter((p) => p.supplier_name === name)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  res.json({ supplier_name: name, debts, payments });
});

// (31) Ta'minotchi sahifasidan to'g'ridan-to'g'ri kirim qo'shish — mavjud
// mahsulotni tanlash yoki yangi mahsulot nomini kiritish mumkin. Bu kirim
// avtomatik ravishda umumiy Mahsulotlar ro'yxatiga qo'shiladi (yoki mavjud
// mahsulot miqdorini oshiradi), va to'lov turidan qat'iy nazar (naqd,
// karta yoki nasiya) shu ta'minotchi tarixida saqlanadi — foydalanuvchi
// har doim "bu tovar aynan qaysi ta'minotchidan kelgan" ekanini bilishi
// uchun (avvalgi tizimda faqat nasiya kirimlar ta'minotchiga bog'lanardi).
router.post('/:supplier_name/kirim', authRequired, (req, res) => {
  const supplier_name = decodeURIComponent(req.params.supplier_name);
  const { product_id, new_product_name, quantity, unit_cost, payment_type, note } = req.body;
  const qty = Number(quantity) || 0;
  const cost = Number(unit_cost) || 0;

  if (qty <= 0) return res.status(400).json({ error: "Miqdorni to'g'ri kiriting" });
  if (cost <= 0) return res.status(400).json({ error: "Tan narxni to'g'ri kiriting" });
  if (!['naqd', 'karta', 'nasiya'].includes(payment_type)) {
    return res.status(400).json({ error: "To'lov turini tanlang" });
  }
  if (!product_id && !new_product_name) {
    return res.status(400).json({ error: "Mahsulotni tanlang yoki yangi nom kiriting" });
  }

  const data = readData();
  const now = new Date().toISOString();
  let product;

  if (product_id) {
    product = data.products.find((p) => p.id == product_id);
    if (!product) return res.status(404).json({ error: 'Mahsulot topilmadi' });
    product.quantity = (Number(product.quantity) || 0) + qty;
    product.costPrice = cost;
    product.purchase_price = cost;
    product.updated_at = now;
  } else {
    const id = nextId(data, 'products');
    product = {
      id,
      name: new_product_name,
      brand: '',
      category: '',
      part_type: 'original',
      costPrice: cost,
      purchase_price: cost,
      sold_count: 0,
      sales_count: 0,
      sale_price: 0,
      quantity: qty,
      min_quantity: 2,
      car_models: '',
      created_at: now,
      updated_at: now,
    };
    data.products.push(product);
  }

  const totalAmount = qty * cost;
  if (!Array.isArray(data.supplier_debts)) data.supplier_debts = [];
  const debtId = nextId(data, 'supplier_debts');
  const entry = {
    id: debtId,
    supplier_name,
    amount: totalAmount,
    product_id: product.id,
    product_name: product.name,
    quantity: qty,
    unit_cost: cost,
    payment_type,
    note: note || '',
    cash_movement_id: null,
    created_at: now,
  };

  if (payment_type !== 'nasiya') {
    if (!Array.isArray(data.cash_movements)) data.cash_movements = [];
    const cmId = nextId(data, 'cash_movements');
    data.cash_movements.push({
      id: cmId,
      amount: totalAmount,
      category: 'Mahsulot kirim (yuk)',
      description: `${product.name} — ${qty} dona (${supplier_name})`,
      recorded_by: req.user?.full_name || "Noma'lum",
      date_time: now,
      created_at: now,
      updated_at: now,
      payment_method: payment_type,
      is_inventory: true,
      supplier_debt_id: debtId,
    });
    entry.cash_movement_id = cmId;
  }

  data.supplier_debts.push(entry);
  writeData(data);
  res.json({ success: true, id: debtId });
});

// (31) Kirim yozuvini tahrirlash — miqdor yoki narx o'zgarsa, bog'liq
// mahsulot qoldig'i farqga qarab to'g'irlanadi; to'lov turi/summasi
// o'zgarsa, bog'liq kassa harakati ham mos ravishda yangilanadi yoki
// yaratiladi/o'chiriladi.
router.put('/debt/:id', authRequired, (req, res) => {
  const data = readData();
  const id = Number(req.params.id);
  const entry = (data.supplier_debts || []).find((d) => Number(d.id) === id);
  if (!entry) return res.status(404).json({ error: 'Yozuv topilmadi' });

  const { quantity, unit_cost, payment_type, note } = req.body;

  // Mahsulotga bog'liq yozuv bo'lsa — miqdor/narx farqini qoldiqqa qo'llaymiz.
  if (entry.product_id) {
    const product = data.products.find((p) => p.id === entry.product_id);
    const newQty = quantity !== undefined ? Number(quantity) || 0 : entry.quantity;
    const newCost = unit_cost !== undefined ? Number(unit_cost) || 0 : entry.unit_cost;
    if (product) {
      const oldQty = Number(entry.quantity) || 0;
      product.quantity = Math.max(0, (Number(product.quantity) || 0) - oldQty + newQty);
      product.costPrice = newCost;
      product.purchase_price = newCost;
      product.updated_at = new Date().toISOString();
    }
    entry.quantity = newQty;
    entry.unit_cost = newCost;
    entry.amount = newQty * newCost;
  }

  const newPaymentType = payment_type || entry.payment_type;
  const cashMovements = Array.isArray(data.cash_movements) ? data.cash_movements : [];
  const linkedCash = entry.cash_movement_id ? cashMovements.find((m) => m.id === entry.cash_movement_id) : null;

  if (newPaymentType === 'nasiya') {
    // Endi nasiyaga o'tdi — bog'liq kassa harakati bo'lsa, o'chiramiz.
    if (linkedCash) {
      data.cash_movements = cashMovements.filter((m) => m.id !== linkedCash.id);
      entry.cash_movement_id = null;
    }
  } else if (linkedCash) {
    // Naqd/karta bo'lib qoldi — mavjud kassa harakatini yangilaymiz.
    linkedCash.amount = entry.amount;
    linkedCash.payment_method = newPaymentType;
    linkedCash.description = `${entry.product_name} — ${entry.quantity} dona (${entry.supplier_name})`;
    linkedCash.updated_at = new Date().toISOString();
  } else {
    // Avval nasiya edi, endi naqd/karta bo'ldi — yangi kassa harakati yaratamiz.
    if (!Array.isArray(data.cash_movements)) data.cash_movements = [];
    const cmId = nextId(data, 'cash_movements');
    data.cash_movements.push({
      id: cmId,
      amount: entry.amount,
      category: 'Mahsulot kirim (yuk)',
      description: `${entry.product_name} — ${entry.quantity} dona (${entry.supplier_name})`,
      recorded_by: req.user?.full_name || "Noma'lum",
      date_time: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      payment_method: newPaymentType,
      is_inventory: true,
      supplier_debt_id: entry.id,
    });
    entry.cash_movement_id = cmId;
  }

  entry.payment_type = newPaymentType;
  if (note !== undefined) entry.note = note;

  writeData(data);
  res.json({ success: true });
});

// (31) Kirim yozuvini o'chirish — bog'liq mahsulot qoldig'i va kassa
// harakati ham mos ravishda qaytariladi (audit uchun emas, chunki bu
// haqiqatda xato kiritilgan yozuvni to'liq bekor qilish talabi).
router.delete('/debt/:id', authRequired, (req, res) => {
  const data = readData();
  const id = Number(req.params.id);
  const entry = (data.supplier_debts || []).find((d) => Number(d.id) === id);
  if (!entry) return res.status(404).json({ error: 'Yozuv topilmadi' });

  if (entry.product_id) {
    const product = data.products.find((p) => p.id === entry.product_id);
    if (product) {
      product.quantity = Math.max(0, (Number(product.quantity) || 0) - (Number(entry.quantity) || 0));
      product.updated_at = new Date().toISOString();
    }
  }
  if (entry.cash_movement_id) {
    data.cash_movements = (data.cash_movements || []).filter((m) => m.id !== entry.cash_movement_id);
  }
  data.supplier_debts = (data.supplier_debts || []).filter((d) => Number(d.id) !== id);

  writeData(data);
  res.json({ success: true });
});

// (30) Ilovadan oldingi eski ta'minotchi qarzlarini qo'lda kiritish —
// mahsulot xaridiga bog'liq bo'lmagan, alohida qarz yozuvi sifatida.
router.post('/debt', authRequired, (req, res) => {
  const { supplier_name, amount, note, date } = req.body;
  if (!supplier_name || !amount || amount <= 0) {
    return res.status(400).json({ error: "Ta'minotchi va summani to'g'ri kiriting" });
  }
  const data = readData();
  if (!Array.isArray(data.supplier_debts)) data.supplier_debts = [];
  const id = nextId(data, 'supplier_debts');
  data.supplier_debts.push({
    id,
    supplier_name,
    amount: Number(amount) || 0,
    product_id: null,
    product_name: null,
    quantity: null,
    payment_type: 'nasiya',
    note: note || "Ilovadan oldingi eski qarz",
    created_at: date ? new Date(date).toISOString() : new Date().toISOString(),
  });
  writeData(data);
  res.json({ success: true, id });
});

router.post('/pay', authRequired, (req, res) => {
  const { supplier_name, amount, note, payment_method } = req.body;
  if (!supplier_name || !amount || amount <= 0) {
    return res.status(400).json({ error: "Ta'minotchi va summani to'g'ri kiriting" });
  }
  const data = readData();
  if (!Array.isArray(data.supplier_debt_payments)) data.supplier_debt_payments = [];
  const id = nextId(data, 'supplier_debt_payments');
  data.supplier_debt_payments.push({
    id,
    supplier_name,
    amount: Number(amount) || 0,
    note: note || '',
    payment_method: payment_method === 'karta' ? 'karta' : 'naqd',
    cancelled: false,
    created_at: new Date().toISOString(),
  });
  writeData(data);
  res.json({ success: true });
});

// (28) To'lovni bekor qilish — tugma bir necha marta bosilib, xato to'lov
// yuborilgan holatlar uchun (masalan bitta to'lov 6 marta yuborilib,
// hisob manfiy bo'lib qolgan voqea sodir bo'lgan edi). Yozuvni O'CHIRMAYMIZ
// — audit izi saqlanishi uchun faqat "cancelled: true" deb belgilaymiz.
// Bekor qilingan to'lov summarize() da hisobga olinmaydi, ya'ni qarz
// avtomatik tiklanadi.
router.post('/payments/:id/cancel', authRequired, (req, res) => {
  const data = readData();
  const id = Number(req.params.id);
  const payment = (data.supplier_debt_payments || []).find((p) => Number(p.id) === id);
  if (!payment) return res.status(404).json({ error: "To'lov topilmadi" });
  if (payment.cancelled) return res.status(400).json({ error: 'Bu to\'lov allaqachon bekor qilingan' });
  payment.cancelled = true;
  payment.cancelled_at = new Date().toISOString();
  writeData(data);
  res.json({ success: true });
});

export default router;
