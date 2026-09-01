import { Router } from 'express';
import { readData, writeData, nextId } from '../db/store.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();

router.post('/', authRequired, (req, res) => {
  const { customer_id, items, paid_amount, payment_type } = req.body;
  if (!items || items.length === 0) return res.status(400).json({ error: 'Mahsulot tanlanmagan' });

  const data = readData();

  for (const it of items) {
    const p = data.products.find((pp) => pp.id == it.product_id);
    if (!p) return res.status(400).json({ error: `Mahsulot topilmadi (ID: ${it.product_id})` });
    if (p.quantity < it.quantity) {
      return res.status(400).json({ error: `"${p.name}" dan yetarli qoldiq yo'q (bor: ${p.quantity})` });
    }
  }

  const total_amount = items.reduce((sum, it) => sum + it.quantity * it.unit_price, 0);
  const paid = paid_amount ?? total_amount;
  const debt_amount = Math.max(0, total_amount - paid);

  const saleId = nextId(data, 'sales');
  data.sales.push({
    id: saleId,
    customer_id: customer_id || null,
    user_id: req.user.id,
    total_amount,
    paid_amount: paid,
    debt_amount,
    payment_type: debt_amount > 0 ? 'qarz' : payment_type || 'naqd',
    created_at: new Date().toISOString(),
  });

  for (const it of items) {
    const itemId = nextId(data, 'sale_items');
    data.sale_items.push({
      id: itemId,
      sale_id: saleId,
      product_id: it.product_id,
      product_name: it.product_name,
      quantity: it.quantity,
      unit_price: it.unit_price,
      total_price: it.quantity * it.unit_price,
    });
    const p = data.products.find((pp) => pp.id == it.product_id);
    p.quantity -= it.quantity;
    p.sold_count = Number(p.sold_count || 0) + Number(it.quantity || 0);
    p.sales_count = Number(p.sales_count || 0) + Number(it.quantity || 0);
  }

  writeData(data);
  res.json({ id: saleId, total_amount, paid_amount: paid, debt_amount });
});

router.get('/', authRequired, (req, res) => {
  const { from, to } = req.query;
  const data = readData();
  let rows = data.sales;
  if (from && to) {
    rows = rows.filter((s) => {
      const day = s.created_at.slice(0, 10);
      return day >= from && day <= to;
    });
  }
  rows = [...rows].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  if (!(from && to)) rows = rows.slice(0, 200);

  const withNames = rows.map((s) => ({
    ...s,
    customer_name: data.customers.find((c) => c.id == s.customer_id)?.full_name || null,
    seller_name: data.users.find((u) => u.id == s.user_id)?.full_name || '',
  }));
  res.json(withNames);
});

router.get('/:id', authRequired, (req, res) => {
  const data = readData();
  const sale = data.sales.find((s) => s.id == req.params.id);
  if (!sale) return res.status(404).json({ error: 'Topilmadi' });
  const items = data.sale_items.filter((it) => it.sale_id == req.params.id);
  res.json({ sale, items });
});

router.delete('/:id', authRequired, (req, res) => {
  const data = readData();
  const sale = data.sales.find((s) => s.id == req.params.id);
  if (!sale) return res.status(404).json({ error: 'Sotuv topilmadi' });

  for (const it of data.sale_items.filter((item) => item.sale_id == req.params.id)) {
    const product = data.products.find((p) => p.id == it.product_id);
    if (product) {
      product.quantity += Number(it.quantity || 0);
      product.sold_count = Math.max(0, Number(product.sold_count || 0) - Number(it.quantity || 0));
      product.sales_count = Math.max(0, Number(product.sales_count || 0) - Number(it.quantity || 0));
    }
  }

  data.sale_items = data.sale_items.filter((item) => item.sale_id != req.params.id);
  data.sales = data.sales.filter((s) => s.id != req.params.id);
  writeData(data);
  res.json({ success: true });
});

export default router;
