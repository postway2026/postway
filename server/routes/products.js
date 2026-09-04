import { Router } from 'express';
import { readData, writeData, nextId } from '../db/store.js';
import { authRequired, roleRequired } from '../middleware/auth.js';

const router = Router();

function normalizeProduct(product = {}) {
  const costPrice = Number(product.costPrice ?? product.purchase_price ?? 0) || 0;
  return {
    ...product,
    costPrice,
    purchase_price: costPrice,
  };
}

function parseNumber(value) {
  return Number(value ?? 0) || 0;
}

router.get('/', authRequired, (req, res) => {
  const { search } = req.query;
  const data = readData();
  let rows = data.products.map(normalizeProduct);
  if (search) {
    const s = search.toLowerCase();
    rows = rows.filter(
      (p) =>
        (p.name || '').toLowerCase().includes(s) ||
        (p.brand || '').toLowerCase().includes(s) ||
        (p.car_models || '').toLowerCase().includes(s)
    );
  }
  res.json([...rows].sort((a, b) => a.name.localeCompare(b.name)));
});

router.get('/low-stock', authRequired, (req, res) => {
  const data = readData();
  const rows = data.products.map(normalizeProduct).filter((p) => p.quantity <= p.min_quantity).sort((a, b) => a.quantity - b.quantity);
  res.json(rows);
});

router.get('/:id', authRequired, (req, res) => {
  const data = readData();
  const row = data.products.find((p) => p.id == req.params.id);
  if (!row) return res.status(404).json({ error: 'Topilmadi' });
  res.json(normalizeProduct(row));
});

// ---------- YANGI MAHSULOT YARATISH ----------
// Bog'liq: (13) — agar boshlang'ich miqdor (quantity) > 0 bo'lsa, bu ham
// "Kirim" bilan bir xil tan narx x miqdor summasini kassadan ayiradi
// (naqt/karta bo'lsa) yoki ta'minotchiga qarz sifatida yozadi (nasiya
// bo'lsa) — xuddi mavjud mahsulotga kirim qilingandagi kabi, chunki bu ham
// aylanma mablag' sarfi.
router.post('/', authRequired, roleRequired('admin', 'omborchi'), (req, res) => {
  const { name, brand, category, part_type, costPrice, purchase_price, sale_price, quantity, min_quantity, car_models, payment_type, supplier_name, note } = req.body;
  if (!name || !part_type) return res.status(400).json({ error: 'Nomi va turi majburiy' });
  const qty = parseNumber(quantity);
  const normalizedCostPrice = parseNumber(costPrice ?? purchase_price);

  if (qty > 0 && normalizedCostPrice > 0) {
    if (!['naqd', 'karta', 'nasiya'].includes(payment_type)) {
      return res.status(400).json({ error: "To'lov turini tanlang" });
    }
    if (payment_type === 'nasiya' && !supplier_name) {
      return res.status(400).json({ error: "Nasiya uchun ta'minotchi nomini kiriting" });
    }
  }

  const data = readData();
  const id = nextId(data, 'products');
  const now = new Date().toISOString();
  const newProduct = {
    id,
    name,
    brand: brand || '',
    category: category || '',
    part_type,
    costPrice: normalizedCostPrice,
    purchase_price: normalizedCostPrice,
    sold_count: 0,
    sales_count: 0,
    sale_price: parseNumber(sale_price),
    quantity: qty,
    min_quantity: parseNumber(min_quantity ?? 2),
    car_models: car_models || '',
    created_at: now,
    updated_at: now,
  };
  data.products.push(newProduct);

  if (qty > 0 && normalizedCostPrice > 0) {
    const totalAmount = qty * normalizedCostPrice;
    if (payment_type === 'nasiya') {
      if (!Array.isArray(data.supplier_debts)) data.supplier_debts = [];
      const debtId = nextId(data, 'supplier_debts');
      data.supplier_debts.push({
        id: debtId,
        supplier_name,
        amount: totalAmount,
        product_id: id,
        product_name: newProduct.name,
        quantity: qty,
        note: note || '',
        created_at: now,
      });
    } else {
      if (!Array.isArray(data.cash_movements)) data.cash_movements = [];
      const movementId = nextId(data, 'cash_movements');
      data.cash_movements.push({
        id: movementId,
        amount: totalAmount,
        category: 'Mahsulot kirim (yuk)',
        description: `${newProduct.name} — ${qty} dona (yangi mahsulot)`,
        recorded_by: req.user?.full_name || "Noma'lum",
        date_time: now,
        created_at: now,
        updated_at: now,
        payment_method: payment_type,
        is_inventory: true,
      });
    }
  }

  writeData(data);
  res.json({ id });
});

router.put('/:id', authRequired, roleRequired('admin', 'omborchi'), (req, res) => {
  const data = readData();
  const idx = data.products.findIndex((p) => p.id == req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Topilmadi' });
  const { name, brand, category, part_type, costPrice, purchase_price, sale_price, quantity, min_quantity, car_models, sold_count, sales_count } = req.body;
  const normalizedCostPrice = parseNumber(costPrice ?? purchase_price);
  const productSoldCount = Number(sold_count ?? sales_count ?? data.products[idx].sold_count ?? data.products[idx].sales_count ?? 0) || 0;
  data.products[idx] = {
    ...data.products[idx],
    name,
    brand,
    category,
    part_type,
    costPrice: normalizedCostPrice,
    purchase_price: normalizedCostPrice,
    sold_count: productSoldCount,
    sales_count: productSoldCount,
    sale_price: parseNumber(sale_price),
    quantity: parseNumber(quantity),
    min_quantity: parseNumber(min_quantity ?? data.products[idx].min_quantity ?? 2),
    car_models,
    updated_at: new Date().toISOString(),
  };
  writeData(data);
  res.json({ success: true });
});

router.delete('/:id', authRequired, roleRequired('admin'), (req, res) => {
  const data = readData();
  data.products = data.products.filter((p) => p.id != req.params.id);
  writeData(data);
  res.json({ success: true });
});

// ---------- YUK KIRIM (mahsulot kirim qilish, to'lov turi bilan) ----------
// Bog'liq: (13) — naqt/karta bo'lsa kassa balansidan ayiriladi (aylanma
// mablag' sifatida, alohida "is_inventory" belgisi bilan — foyda hisobidan
// ikki marta ayirilmasligi uchun, chunki tan narx allaqachon har bir
// sotuvda hisoblanadi); nasiya bo'lsa "Ta'minotchilarga qarzim" bo'limiga yoziladi.
router.post('/:id/kirim', authRequired, roleRequired('admin', 'omborchi'), (req, res) => {
  const { quantity, unit_cost, payment_type, supplier_name, note } = req.body;
  const qty = parseNumber(quantity);
  const cost = parseNumber(unit_cost);

  if (qty <= 0) return res.status(400).json({ error: "Miqdorni to'g'ri kiriting" });
  if (!['naqd', 'karta', 'nasiya'].includes(payment_type)) {
    return res.status(400).json({ error: "To'lov turini tanlang" });
  }
  if (payment_type === 'nasiya' && !supplier_name) {
    return res.status(400).json({ error: 'Nasiya uchun ta\'minotchi nomini kiriting' });
  }

  const data = readData();
  const idx = data.products.findIndex((p) => p.id == req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Topilmadi' });

  const totalAmount = qty * cost;
  const now = new Date().toISOString();

  data.products[idx] = {
    ...data.products[idx],
    quantity: parseNumber(data.products[idx].quantity) + qty,
    costPrice: cost || data.products[idx].costPrice,
    purchase_price: cost || data.products[idx].purchase_price,
    updated_at: now,
  };

  if (payment_type === 'nasiya') {
    if (!Array.isArray(data.supplier_debts)) data.supplier_debts = [];
    const id = nextId(data, 'supplier_debts');
    data.supplier_debts.push({
      id,
      supplier_name,
      amount: totalAmount,
      product_id: data.products[idx].id,
      product_name: data.products[idx].name,
      quantity: qty,
      note: note || '',
      created_at: now,
    });
  } else {
    if (!Array.isArray(data.cash_movements)) data.cash_movements = [];
    const id = nextId(data, 'cash_movements');
    data.cash_movements.push({
      id,
      amount: totalAmount,
      category: 'Mahsulot kirim (yuk)',
      description: `${data.products[idx].name} — ${qty} dona`,
      recorded_by: req.user?.full_name || "Noma'lum",
      date_time: now,
      created_at: now,
      updated_at: now,
      payment_method: payment_type,
      is_inventory: true,
    });
  }

  writeData(data);
  res.json({ success: true, product: normalizeProduct(data.products[idx]) });
});

export default router;
