import { pool } from '../../db/pool.js';
import { HttpError } from '../../utils/http-error.js';

const money = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

export async function listPaymentRequests(request, response) {
  const { page, pageSize, status } = request.query;
  const where = status ? 'WHERE payment_requests.status = ?' : '';
  const values = status ? [status] : [];
  const offset = (page - 1) * pageSize;
  const [counts] = await pool.execute(`SELECT COUNT(*) AS total FROM payment_requests ${where}`, values);
  const [rows] = await pool.execute(
    `SELECT payment_requests.id, payment_requests.invoice_id, payment_requests.request_number,
            payment_requests.amount, payment_requests.status, payment_requests.requested_at,
            payment_requests.due_at, payment_requests.paid_at, payment_requests.notes,
            invoices.invoice_number, invoices.client_id, clients.first_name AS client_first_name, clients.last_name AS client_last_name
     FROM payment_requests JOIN invoices ON invoices.id = payment_requests.invoice_id
     JOIN clients ON clients.id = invoices.client_id ${where}
     ORDER BY payment_requests.requested_at DESC, payment_requests.id DESC LIMIT ? OFFSET ?`,
    [...values, pageSize, offset],
  );
  response.json({ success: true, data: rows, pagination: { page, pageSize, total: counts[0].total, totalPages: Math.ceil(counts[0].total / pageSize) } });
}

export async function createPaymentRequest(request, response) {
  const body = request.body;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute('SELECT id, balance_amount, status FROM invoices WHERE id = ? FOR UPDATE', [body.invoice_id]);
    const invoice = rows[0];
    if (!invoice) throw new HttpError(404, 'Facture introuvable.');
    if (['DRAFT', 'CANCELLED', 'PAID'].includes(invoice.status)) throw new HttpError(409, 'Cette facture ne peut pas faire l’objet d’une demande de paiement.');
    const [activeRequests] = await connection.execute(
      "SELECT COALESCE(SUM(amount), 0) AS total FROM payment_requests WHERE invoice_id = ? AND status = 'SENT'",
      [body.invoice_id],
    );
    const available = money(Number(invoice.balance_amount) - Number(activeRequests[0].total));
    if (money(body.amount) > available) throw new HttpError(422, 'Le montant demandé dépasse le solde disponible de la facture.');
    const [result] = await connection.execute(
      `INSERT INTO payment_requests (invoice_id, request_number, amount, due_at, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [body.invoice_id, body.request_number, money(body.amount), body.due_at ?? null, body.notes ?? null, request.auth.id],
    );
    await connection.commit();
    response.status(201).json({ success: true, data: { id: result.insertId, ...body, amount: money(body.amount), status: 'SENT' } });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
}

export async function recordPaymentRequestPayment(request, response) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [requestRows] = await connection.execute('SELECT * FROM payment_requests WHERE id = ? FOR UPDATE', [request.params.id]);
    const paymentRequest = requestRows[0];
    if (!paymentRequest) throw new HttpError(404, 'Demande de paiement introuvable.');
    if (paymentRequest.status !== 'SENT') throw new HttpError(409, 'Cette demande n’est plus payable.');
    const [invoiceRows] = await connection.execute('SELECT id, total_amount, paid_amount, balance_amount, status FROM invoices WHERE id = ? FOR UPDATE', [paymentRequest.invoice_id]);
    const invoice = invoiceRows[0];
    const amount = money(paymentRequest.amount);
    if (!invoice || amount > money(invoice.balance_amount)) throw new HttpError(409, 'Le solde de la facture a changé depuis la demande.');
    const paidAt = request.body.paid_at ? new Date(request.body.paid_at) : new Date();
    await connection.execute(
      `INSERT INTO invoice_payments (invoice_id, amount, payment_method, paid_at, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [invoice.id, amount, request.body.payment_method, paidAt, request.body.notes ?? `Demande ${paymentRequest.request_number}`, request.auth.id],
    );
    const paid = money(Number(invoice.paid_amount) + amount);
    const balance = money(Number(invoice.total_amount) - paid);
    const invoiceStatus = balance <= 0 ? 'PAID' : 'PARTIALLY_PAID';
    await connection.execute('UPDATE invoices SET paid_amount = ?, balance_amount = ?, status = ? WHERE id = ?', [paid, balance, invoiceStatus, invoice.id]);
    await connection.execute('UPDATE payment_requests SET status = \'PAID\', paid_at = ? WHERE id = ?', [paidAt, paymentRequest.id]);
    await connection.commit();
    response.json({ success: true, data: { id: Number(paymentRequest.id), status: 'PAID', invoice_status: invoiceStatus, amount } });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
}

export async function cancelPaymentRequest(request, response) {
  const [result] = await pool.execute("UPDATE payment_requests SET status = 'CANCELLED' WHERE id = ? AND status = 'SENT'", [request.params.id]);
  if (!result.affectedRows) {
    const [rows] = await pool.execute('SELECT id FROM payment_requests WHERE id = ?', [request.params.id]);
    if (!rows.length) throw new HttpError(404, 'Demande de paiement introuvable.');
    throw new HttpError(409, 'Cette demande ne peut plus être annulée.');
  }
  response.json({ success: true, data: { id: Number(request.params.id), status: 'CANCELLED' } });
}
