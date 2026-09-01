import { Router } from 'express';
import { readData } from '../db/store.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();

router.get('/dashboard', authRequired, (req, res) => {
  const data = readData();
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 7) + '-01';

  const todaySalesArr = data.sales.filter((s) => s.created_at.slice(0, 10) === today);
  const monthSalesArr = data.sales.filter((s) => s.created_at.slice(0, 10) >= monthStart);

  const totalDebtRaw = data.sales.reduce((sum, s) => sum + s.debt_amount, 0);
  const totalPaidDebt = data.debt_payments.reduce((sum, p) => sum + p.amount, 0);

  const lowStockCount = data.products.filter((p) => p.quantity <= p.min_quantity).length;

  const productAgg = {};
  for (const it of data.sale_items) {
    if (!productAgg[it.product_id]) productAgg[it.product_id] = { product_name: it.product_name, total_qty: 0, total_sum: 0 };
    productAgg[it.product_id].total_qty += it.quantity;
    productAgg[it.product_id].total_sum += it.total_price;
  }
  const topProducts = Object.values(productAgg)
    .sort((a, b) => b.total_qty - a.total_qty)
    .slice(0, 5);

  res.json({
    todaySales: { total: todaySalesArr.reduce((s, x) => s + x.total_amount, 0), count: todaySalesArr.length },
    monthSales: { total: monthSalesArr.reduce((s, x) => s + x.total_amount, 0), count: monthSalesArr.length },
    totalDebt: totalDebtRaw - totalPaidDebt,
    lowStockCount,
    productCount: data.products.length,
    topProducts,
  });
});

router.get('/daily', authRequired, (req, res) => {
  const data = readData();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 14);
  const recent = data.sales.filter((s) => new Date(s.created_at) >= cutoff);
  const byDay = {};
  for (const s of recent) {
    const day = s.created_at.slice(0, 10);
    byDay[day] = (byDay[day] || 0) + s.total_amount;
  }
  const rows = Object.entries(byDay)
    .map(([day, total]) => ({ day, total }))
    .sort((a, b) => a.day.localeCompare(b.day));
  res.json(rows);
});

function getPeriodRange(period = 'daily') {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);

  if (period === 'monthly') {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    end.setMonth(end.getMonth() + 1, 0);
    end.setHours(23, 59, 59, 999);
  } else if (period === 'yearly') {
    start.setMonth(0, 1);
    start.setHours(0, 0, 0, 0);
    end.setMonth(11, 31);
    end.setHours(23, 59, 59, 999);
  } else {
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  }

  return { start, end };
}

router.get('/profit', authRequired, (req, res) => {
  const { period = 'daily' } = req.query;
  const data = readData();
  const { start, end } = getPeriodRange(period);

  const salesInPeriod = (data.sales || []).filter((sale) => {
    const saleDate = new Date(sale.created_at);
    return saleDate >= start && saleDate <= end;
  });

  const saleIds = new Set(salesInPeriod.map((sale) => sale.id));
  const saleItemsInPeriod = (data.sale_items || []).filter((item) => saleIds.has(item.sale_id));

  const totalSales = salesInPeriod.reduce((sum, sale) => sum + Number(sale.total_amount || 0), 0);
  const totalCost = saleItemsInPeriod.reduce((sum, item) => {
    const product = (data.products || []).find((p) => Number(p.id) === Number(item.product_id));
    const unitCost = Number(product?.costPrice ?? product?.purchase_price ?? 0) || 0;
    const quantity = Number(item.quantity || 0);
    return sum + unitCost * quantity;
  }, 0);

  const totalExpenses = (data.cash_movements || [])
    .filter((item) => {
      const d = new Date(item.date_time || item.created_at || 0);
      return d >= start && d <= end;
    })
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const netProfit = totalSales - totalCost - totalExpenses;

  res.json({
    period,
    start: start.toISOString(),
    end: end.toISOString(),
    totalSales,
    totalCost,
    totalExpenses,
    netProfit,
    salesCount: salesInPeriod.length,
    expenseCount: (data.cash_movements || []).filter((item) => {
      const d = new Date(item.date_time || item.created_at || 0);
      return d >= start && d <= end;
    }).length,
  });
});

export default router;
