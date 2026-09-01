import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_FILE = path.join(__dirname, 'shop-data.json');

function emptyData() {
  return {
    users: [],
    products: [],
    customers: [],
    sales: [],
    sale_items: [],
    debt_payments: [],
    cash_movements: [],
    seq: { users: 0, products: 0, customers: 0, sales: 0, sale_items: 0, debt_payments: 0, cash_movements: 0 },
  };
}

export function readData() {
  if (!fs.existsSync(DB_FILE)) {
    const data = emptyData();
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    return data;
  }
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
}

export function writeData(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
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
