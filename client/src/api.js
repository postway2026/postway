 const BASE = 'https://postway-rdy4.onrender.com/api';

function getToken() {
  return localStorage.getItem('gm0064_token');
}

async function request(path, options = {}) {
  const token = getToken();
  const res = await fetch(BASE + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Xatolik yuz berdi");
  return data;
}

export const api = {
  login: (username, password) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  me: () => request('/auth/me'),
  createUser: (payload) => request('/auth/users', { method: 'POST', body: JSON.stringify(payload) }),
  listUsers: () => request('/auth/users'),

  listProducts: (search) => request(`/products${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  lowStock: () => request('/products/low-stock'),
  createProduct: (payload) => request('/products', { method: 'POST', body: JSON.stringify(payload) }),
  updateProduct: (id, payload) => request(`/products/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteProduct: (id) => request(`/products/${id}`, { method: 'DELETE' }),

  listCustomers: () => request('/customers'),
  getCustomer: (id) => request(`/customers/${id}`),
  createCustomer: (payload) => request('/customers', { method: 'POST', body: JSON.stringify(payload) }),
  payDebt: (id, payload) => request(`/customers/${id}/pay`, { method: 'POST', body: JSON.stringify(payload) }),

  listSales: (from, to) => request(`/sales${from && to ? `?from=${from}&to=${to}` : ''}`),
  createSale: (payload) => request('/sales', { method: 'POST', body: JSON.stringify(payload) }),

  listCashMovements: () => request('/cash-movements'),
  createCashMovement: (payload) => request('/cash-movements', { method: 'POST', body: JSON.stringify(payload) }),
  updateCashMovement: (id, payload) => request(`/cash-movements/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteCashMovement: (id) => request(`/cash-movements/${id}`, { method: 'DELETE' }),

  dashboard: () => request('/reports/dashboard'),
  dailyReport: () => request('/reports/daily'),
  profitReport: (period = 'daily') => request(`/reports/profit?period=${encodeURIComponent(period)}`),
};

export { getToken };
