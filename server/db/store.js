import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function emptyData() {
  return {
    users: [],
    products: [],
    customers: [],
    sales: [],
    sale_items: [],
    debt_payments: [],
    cash_movements: [],
    supplier_debts: [],
    supplier_debt_payments: [],
    seq: { users: 0, products: 0, customers: 0, sales: 0, sale_items: 0, debt_payments: 0, cash_movements: 0, supplier_debts: 0, supplier_debt_payments: 0 },
  };
}

function normalize(data) {
  const normalized = { ...emptyData(), ...data };

  normalized.products = Array.isArray(normalized.products) ? normalized.products : [];
  normalized.customers = Array.isArray(normalized.customers) ? normalized.customers : [];
  normalized.sales = Array.isArray(normalized.sales) ? normalized.sales : [];
  normalized.sale_items = Array.isArray(normalized.sale_items) ? normalized.sale_items : [];
  normalized.debt_payments = Array.isArray(normalized.debt_payments) ? normalized.debt_payments : [];
  normalized.cash_movements = Array.isArray(normalized.cash_movements) ? normalized.cash_movements : [];
  normalized.supplier_debts = Array.isArray(normalized.supplier_debts) ? normalized.supplier_debts : [];
  normalized.supplier_debt_payments = Array.isArray(normalized.supplier_debt_payments) ? normalized.supplier_debt_payments : [];
  normalized.seq = { ...emptyData().seq, ...(data.seq || {}) };
  normalized.seq.cash_movements = normalized.seq.cash_movements || 0;
  normalized.seq.supplier_debts = normalized.seq.supplier_debts || 0;
  normalized.seq.supplier_debt_payments = normalized.seq.supplier_debt_payments || 0;

  normalized.products = normalized.products.map((product) => ({
    ...product,
    sold_count: Number(product.sold_count ?? product.sales_count ?? 0) || 0,
    sales_count: Number(product.sales_count ?? product.sold_count ?? 0) || 0,
  }));

  return normalized;
}

// ---------------------------------------------------------------------
// SAQLASH USULI: DATABASE_URL muhit o'zgaruvchisi berilgan bo'lsa
// (masalan Supabase Postgres manzili), ma'lumotlar Postgres bazasida
// doimiy saqlanadi (server qayta ishga tushsa ham o'chib qolmaydi).
//
// Agar DATABASE_URL berilmagan bo'lsa, avvalgidek oddiy JSON fayl
// ishlatiladi (bu Render'ning bepul tarifida server qayta ishga
// tushganda o'chib qoladi — faqat lokal/test uchun mos).
// ---------------------------------------------------------------------

const DATABASE_URL = process.env.DATABASE_URL;

let cachedData = null;
let pool = null;

// ---------- POSTGRES REJIMI ----------
async function initPostgres() {
  pool = new pg.Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS shop_data (
      id INTEGER PRIMARY KEY DEFAULT 1,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT single_row CHECK (id = 1)
    );
  `);

  const res = await pool.query('SELECT data FROM shop_data WHERE id = 1');
  if (res.rows.length === 0) {
    const initialData = emptyData();
    await pool.query('INSERT INTO shop_data (id, data) VALUES (1, $1)', [JSON.stringify(initialData)]);
    cachedData = initialData;
  } else {
    cachedData = normalize(res.rows[0].data);
  }

  console.log('✅ Ma\'lumotlar bazasi: Postgres (Supabase) ga ulandi — ma\'lumotlar doimiy saqlanadi');
}

function persistToPostgres(data) {
  if (!pool) return;
  pool.query('UPDATE shop_data SET data = $1, updated_at = now() WHERE id = 1', [JSON.stringify(data)])
    .catch((err) => {
      console.error('❌ Postgres bazasiga yozishda xato:', err.message);
    });
}

// ---------- JSON FAYL REJIMI (zaxira/lokal rejim) ----------
const DATA_DIR = process.env.DATA_DIR || __dirname;
const DB_FILE = path.join(DATA_DIR, 'shop-data.json');

function initFileMode() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    cachedData = emptyData();
    fs.writeFileSync(DB_FILE, JSON.stringify(cachedData, null, 2));
  } else {
    cachedData = normalize(JSON.parse(fs.readFileSync(DB_FILE, 'utf-8')));
  }
  console.log('⚠️  Ma\'lumotlar bazasi: oddiy JSON fayl (DATABASE_URL berilmagan). ' +
    'Bepul Render tarifida bu server qayta ishga tushganda ma\'lumot o\'chishi mumkin.');
}

function persistToFile(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// ---------- INITSIALIZATSIYA ----------
if (DATABASE_URL) {
  await initPostgres();
} else {
  initFileMode();
}

// ---------- OMMAVIY (PUBLIC) FUNKSIYALAR — avvalgi API bilan bir xil ----------
export function readData() {
  return cachedData;
}

export function writeData(data) {
  cachedData = data;
  if (DATABASE_URL) {
    persistToPostgres(data);
  } else {
    persistToFile(data);
  }
}

export function nextId(data, table) {
  data.seq[table] = (data.seq[table] || 0) + 1;
  return data.seq[table];
}

// ---------- BOSHLANG'ICH ADMIN ----------
const initial = readData();
if (!initial.users.find((u) => u.role === 'admin')) {
  const id = nextId(initial, 'users');
  initial.users.push({
    id,
    full_name: "Do'kon egasi",
    username: 'admin',
    password_hash: bcrypt.hashSync('admin123', 10),
    role: 'admin',
    created_at: new Date().toISOString(),
  });
  writeData(initial);
  console.log("✅ Boshlang'ich admin yaratildi -> login: admin, parol: admin123");
}
