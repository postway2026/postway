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

router.post('/', authRequired, roleRequired('admin', 'omborchi'), (req, res) => {
  const { name, brand, category, part_type, costPrice, purchase_price, sale_price, quantity, min_quantity, car_models } = req.body;
  if (!name || !part_type) return res.status(400).json({ error: 'Nomi va turi majburiy' });
  const data = readData();
  const id = nextId(data, 'products');
  const now = new Date().toISOString();
  const normalizedCostPrice = parseNumber(costPrice ?? purchase_price);
  data.products.push({
    id,
    name,
    brand: brand || '',
    category: category || '',
    part_type,
    costPrice: normalizedCostPrice,
    purchase_price: normalizedCostPrice,
    sale_price: parseNumber(sale_price),
    quantity: parseNumber(quantity),
    min_quantity: parseNumber(min_quantity ?? 2),
    car_models: car_models || '',
    created_at: now,
    updated_at: now,
  });
  writeData(data);
  res.json({ id });
});

router.put('/:id', authRequired, roleRequired('admin', 'omborchi'), (req, res) => {
  const data = readData();
  const idx = data.products.findIndex((p) => p.id == req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Topilmadi' });
  const { name, brand, category, part_type, costPrice, purchase_price, sale_price, quantity, min_quantity, car_models } = req.body;
  const normalizedCostPrice = parseNumber(costPrice ?? purchase_price);
  data.products[idx] = {
    ...data.products[idx],
    name,
    brand,
    category,
    part_type,
    costPrice: normalizedCostPrice,
    purchase_price: normalizedCostPrice,
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

export default router;
