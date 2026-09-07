import { Router } from 'express';
import { readData, writeData, nextId } from '../db/store.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();

// (25) Kunlik kassa yopish/solishtirish — kun oxirida do'kon egasi
// naqt pulni jismonan sanaydi, tizim esa o'z hisob-kitobi bo'yicha
// "bo'lishi kerak bo'lgan" summani ko'rsatadi. Ikkalasi solishtirilib,
// farq bo'lsa — aniq ko'rinadi. Bu yozuv HECH QANDAY avtomatik tuzatish
// qilmaydi (kassa balansiga ta'sir qilmaydi) — faqat farqni "qayd qilib,
// ko'rsatib beradi" (Anthropic emas, do'kon egasi keyin o'zi qaror
// qabul qiladi). Bu shu bandning asl talabiga mos: "aniqlash va
// ko'rsatish", avtomatik tuzatish emas — chunki noto'g'ri avtomatik
// tuzatish haqiqiy pul yo'qolishini yashirib qo'yishi mumkin.
function computeExpected(data) {
  const sales = Array.isArray(data.sales) ? data.sales : [];
  const cashMovements = Array.isArray(data.cash_movements) ? data.cash_movements : [];
  const debtPayments = Array.isArray(data.debt_payments) ? data.debt_payments : [];
  const supplierPayments = (Array.isArray(data.supplier_debt_payments) ? data.supplier_debt_payments : []).filter((p) => !p.cancelled);

  const cashIn = sales.filter((s) => s.payment_type === 'naqd').reduce((s, x) => s + Number(x.total_amount || 0), 0)
    + sales.filter((s) => s.payment_type === 'qarz').reduce((s, x) => s + Number(x.paid_amount || 0), 0)
    + debtPayments.filter((p) => (p.payment_method || 'naqd') === 'naqd').reduce((s, p) => s + Number(p.amount || 0), 0);
  const cashOut = cashMovements.filter((m) => (m.payment_method || 'naqd') === 'naqd').reduce((s, m) => s + Number(m.amount || 0), 0)
    + supplierPayments.filter((p) => (p.payment_method || 'naqd') === 'naqd').reduce((s, p) => s + Number(p.amount || 0), 0);
  const cashOnHand = cashIn - cashOut;

  const cardIn = sales.filter((s) => s.payment_type === 'karta').reduce((s, x) => s + Number(x.total_amount || 0), 0)
    + debtPayments.filter((p) => p.payment_method === 'karta').reduce((s, p) => s + Number(p.amount || 0), 0);
  const cardOut = cashMovements.filter((m) => m.payment_method === 'karta').reduce((s, m) => s + Number(m.amount || 0), 0)
    + supplierPayments.filter((p) => p.payment_method === 'karta').reduce((s, p) => s + Number(p.amount || 0), 0);
  const cardOnHand = cardIn - cardOut;

  return { cashOnHand, cardOnHand };
}

// Hozirgi vaqtda "bo'lishi kerak" bo'lgan summa — yopish oynasini
// ochganda oldindan ko'rsatish uchun (hali saqlanmagan holatda).
router.get('/expected', authRequired, (req, res) => {
  const data = readData();
  res.json(computeExpected(data));
});

router.get('/', authRequired, (req, res) => {
  const data = readData();
  const rows = [...(data.cash_closes || [])].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  res.json(rows);
});

router.post('/', authRequired, (req, res) => {
  const { actual_naqd, note } = req.body;
  if (actual_naqd === undefined || actual_naqd === null || isNaN(Number(actual_naqd))) {
    return res.status(400).json({ error: "Sanalgan naqt summasini to'g'ri kiriting" });
  }

  const data = readData();
  const { cashOnHand, cardOnHand } = computeExpected(data);
  const actual = Number(actual_naqd);
  const difference = actual - cashOnHand;

  if (!Array.isArray(data.cash_closes)) data.cash_closes = [];
  const id = nextId(data, 'cash_closes');
  const record = {
    id,
    expected_naqd: cashOnHand,
    expected_karta: cardOnHand,
    actual_naqd: actual,
    difference,
    note: note || '',
    resolved: false,
    closed_by: req.user?.full_name || "Noma'lum",
    created_at: new Date().toISOString(),
  };
  data.cash_closes.push(record);
  writeData(data);
  res.json(record);
});

// (25) Farqni keyinroq tushuntirish/hal qilingan deb belgilash — masalan,
// ertasi kuni "bu kamunalgaga ketgan pul edi" deb eslansa, izohni
// yangilab, "tushuntirilgan" deb belgilash mumkin. Bu yozuvning o'zi
// (kutilgan/sanalgan/farq) o'zgarmaydi — faqat izoh va holat yangilanadi;
// haqiqiy tuzatish "Kassa harakati"ga tegishli xarajatni qo'shish orqali
// amalga oshiriladi, bu esa keyingi kunlardagi "bo'lishi kerak" hisobini
// avtomatik to'g'irlaydi.
router.put('/:id', authRequired, (req, res) => {
  const data = readData();
  const id = Number(req.params.id);
  const record = (data.cash_closes || []).find((c) => Number(c.id) === id);
  if (!record) return res.status(404).json({ error: 'Yozuv topilmadi' });

  const { note, resolved } = req.body;
  if (note !== undefined) record.note = note;
  if (resolved !== undefined) record.resolved = !!resolved;

  writeData(data);
  res.json(record);
});

router.delete('/:id', authRequired, (req, res) => {
  const data = readData();
  const id = Number(req.params.id);
  const exists = (data.cash_closes || []).some((c) => Number(c.id) === id);
  if (!exists) return res.status(404).json({ error: 'Yozuv topilmadi' });

  data.cash_closes = data.cash_closes.filter((c) => Number(c.id) !== id);
  writeData(data);
  res.json({ success: true });
});

export default router;
