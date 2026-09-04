import { Router } from 'express';
import { readData, writeData, nextId } from '../db/store.js';
import { authRequired, roleRequired } from '../middleware/auth.js';

const router = Router();

function withDebt(data, c) {
  const totalDebt = data.sales.filter((s) => s.customer_id == c.id).reduce((sum, s) => sum + s.debt_amount, 0);
  const totalPaid = data.debt_payments.filter((p) => p.customer_id == c.id).reduce((sum, p) => sum + p.amount, 0);
  return { ...c, current_debt: totalDebt - totalPaid };
}

router.get('/', authRequired, (req, res) => {
  const data = readData();
  const rows = data.customers.map((c) => withDebt(data, c)).sort((a, b) => a.full_name.localeCompare(b.full_name));
  res.json(rows);
});

router.get('/:id', authRequired, (req, res) => {
  const data = readData();
  const customer = data.customers.find((c) => c.id == req.params.id);
  if (!customer) return res.status(404).json({ error: 'Topilmadi' });
  const sales = data.sales
    .filter((s) => s.customer_id == req.params.id)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const payments = data.debt_payments
    .filter((p) => p.customer_id == req.params.id)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  res.json({ customer, sales, payments });
});

router.post('/', authRequired, (req, res) => {
  const { full_name, phone, note } = req.body;
  if (!full_name) return res.status(400).json({ error: 'Ism majburiy' });
  const data = readData();
  const id = nextId(data, 'customers');
  data.customers.push({ id, full_name, phone: phone || '', note: note || '', created_at: new Date().toISOString() });
  writeData(data);
  res.json({ id });
});

router.put('/:id', authRequired, (req, res) => {
  const data = readData();
  const idx = data.customers.findIndex((c) => c.id == req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Topilmadi' });
  const { full_name, phone, note } = req.body;
  data.customers[idx] = { ...data.customers[idx], full_name, phone, note };
  writeData(data);
  res.json({ success: true });
});

router.post('/:id/pay', authRequired, (req, res) => {
  const { amount, note, payment_method } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ error: "Summani to'g'ri kiriting" });
  const data = readData();
  const customerId = +req.params.id;

  const id = nextId(data, 'debt_payments');
  data.debt_payments.push({
    id,
    customer_id: customerId,
    amount,
    note: note || '',
    payment_method: payment_method === 'karta' ? 'karta' : 'naqd',
    created_at: new Date().toISOString(),
  });

  // (22) To'lovni mijozning eng eski qarzli sotuvidan boshlab (FIFO)
  // taqsimlaymiz, har bir sotuvning debt_remaining qoldig'ini kamaytirib —
  // shunda "kutilayotgan foyda" har doim aniq (faqat to'lanmagan marja
  // qismini) ko'rsatadi.
  const customerSales = data.sales
    .filter((s) => s.customer_id == customerId && Number(s.debt_remaining || 0) > 0)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  let remaining = Number(amount);
  for (const sale of customerSales) {
    if (remaining <= 0) break;
    const applied = Math.min(remaining, Number(sale.debt_remaining || 0));
    sale.debt_remaining = Number(sale.debt_remaining || 0) - applied;
    remaining -= applied;
  }

  writeData(data);
  res.json({ success: true });
});

router.delete('/:id', authRequired, roleRequired('admin'), (req, res) => {
  const data = readData();
  const customerId = Number(req.params.id);

  data.debt_payments = data.debt_payments.filter((p) => p.customer_id != customerId);
  data.sales = data.sales.filter((s) => s.customer_id != customerId);
  data.sale_items = data.sale_items.filter((item) => {
    const sale = data.sales.find((s) => s.id == item.sale_id);
    return !sale || sale.customer_id != customerId;
  });
  data.customers = data.customers.filter((c) => c.id != customerId);

  writeData(data);
  res.json({ success: true });
});

export default router;
