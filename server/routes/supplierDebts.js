import { Router } from 'express';
import { readData, writeData, nextId } from '../db/store.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();

// Ta'minotchilarga qarzim — do'kon ularga to'lashi kerak bo'lgan pul
// (mijozlar qarzidan farqli, bu yerda yo'nalish teskari).

function summarize(data) {
  const debts = data.supplier_debts || [];
  const payments = data.supplier_debt_payments || [];
  const names = new Set([...debts.map((d) => d.supplier_name), ...payments.map((p) => p.supplier_name)]);

  return [...names].map((name) => {
    const totalDebt = debts.filter((d) => d.supplier_name === name).reduce((s, d) => s + Number(d.amount || 0), 0);
    const totalPaid = payments.filter((p) => p.supplier_name === name).reduce((s, p) => s + Number(p.amount || 0), 0);
    return { supplier_name: name, total_debt: totalDebt, total_paid: totalPaid, balance: totalDebt - totalPaid };
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

router.post('/pay', authRequired, (req, res) => {
  const { supplier_name, amount, note } = req.body;
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
    created_at: new Date().toISOString(),
  });
  writeData(data);
  res.json({ success: true });
});

export default router;
