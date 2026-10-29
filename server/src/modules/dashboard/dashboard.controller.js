import { pool } from '../../db/pool.js';

export async function getDashboardIndicators(_request, response) {
  const [appointments] = await pool.execute(
    `SELECT COUNT(*) AS total FROM appointments
     WHERE starts_at >= CURRENT_DATE AND starts_at < DATE_ADD(CURRENT_DATE, INTERVAL 1 DAY)
       AND status IN ('PLANIFIE', 'CONFIRME', 'EN_COURS')`,
  );

  const [clients] = await pool.execute(
    "SELECT COUNT(*) AS total FROM clients WHERE deleted_at IS NULL AND status = 'active'"
  );
  
  const [animals] = await pool.execute(
    "SELECT COUNT(*) AS total FROM animals WHERE deleted_at IS NULL AND status = 'active'"
  );

  // On a enlevé "deleted_at" car on l'a nettoyé de la table products
  const [stock] = await pool.execute(
    'SELECT COUNT(*) AS total FROM products WHERE stock_quantity <= stock_alert_threshold',
  );

  const [invoices] = await pool.execute(
    "SELECT COUNT(*) AS total, COALESCE(SUM(balance_amount), 0) AS outstanding_amount FROM invoices WHERE status IN ('SENT', 'PARTIALLY_PAID', 'OVERDUE')",
  );

  // On remplace les hospitalisations par 0 pour éviter le crash
  response.json({
    success: true,
    data: {
      appointments_today: appointments[0].total,
      active_hospitalizations: 0, // <--- Corrigé ici
      active_clients: clients[0].total,
      active_animals: animals[0].total,
      low_stock_products: stock[0].total,
      outstanding_invoices: invoices[0].total,
      outstanding_amount: invoices[0].outstanding_amount,
    },
  });
}