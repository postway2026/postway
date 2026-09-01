import { Router } from 'express';
import { readData, writeData, nextId } from '../db/store.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();

function parseDateTime(value) {
  const date = new Date(value || new Date());
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

router.get('/', authRequired, (req, res) => {
  const data = readData();
  const rows = [...(data.cash_movements || [])].sort((a, b) => new Date(b.date_time) - new Date(a.date_time));
  res.json(rows);
});

router.post('/', authRequired, (req, res) => {
  const { amount, category, description, recorded_by, date_time } = req.body;
  if (!amount || !category) {
    return res.status(400).json({ error: 'Miqdor va kategoriya majburiy' });
  }

  const data = readData();
  const id = nextId(data, 'cash_movements');
  const now = new Date().toISOString();

  data.cash_movements.push({
    id,
    amount: Number(amount) || 0,
    category,
    description: description || '',
    recorded_by: recorded_by || req.user?.full_name || 'Noma\'lum',
    date_time: parseDateTime(date_time),
    created_at: now,
    updated_at: now,
  });

  writeData(data);
  res.json({ id });
});

router.put('/:id', authRequired, (req, res) => {
  const data = readData();
  const idx = data.cash_movements.findIndex((item) => item.id == req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Kassa harakati topilmadi' });

  const { amount, category, description, recorded_by, date_time } = req.body;
  data.cash_movements[idx] = {
    ...data.cash_movements[idx],
    amount: Number(amount) || 0,
    category,
    description: description || '',
    recorded_by: recorded_by || data.cash_movements[idx].recorded_by,
    date_time: parseDateTime(date_time),
    updated_at: new Date().toISOString(),
  };

  writeData(data);
  res.json({ success: true });
});

router.delete('/:id', authRequired, (req, res) => {
  const data = readData();
  data.cash_movements = data.cash_movements.filter((item) => item.id != req.params.id);
  writeData(data);
  res.json({ success: true });
});

export default router;
