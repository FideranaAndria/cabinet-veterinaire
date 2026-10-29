import { pool } from '../../db/pool.js';
import { HttpError } from '../../utils/http-error.js';

function money(value) {
  return Number(Number(value).toFixed(2));
}

function calculateLineTotal(quantity, unitPrice, vatRate) {
  const subtotal = Number(quantity) * Number(unitPrice);
  const vatAmount = subtotal * (Number(vatRate) / 100);
  return money(subtotal + vatAmount);
}

async function findInvoice(id, executor = pool) {
  const [invoiceRows] = await executor.execute(
    `SELECT invoices.id, invoices.client_id, invoices.animal_id, invoices.invoice_number,
            invoices.issue_date, invoices.due_date, invoices.status, invoices.notes,
            invoices.total_amount, invoices.paid_amount, invoices.balance_amount,
            invoices.created_at, invoices.updated_at,
            clients.first_name AS client_first_name, clients.last_name AS client_last_name,
            animals.name AS animal_name
     FROM invoices
     JOIN clients ON clients.id = invoices.client_id
     JOIN animals ON animals.id = invoices.animal_id
     WHERE invoices.id = ? LIMIT 1`,
    [id],
  );
  if (invoiceRows.length === 0) return null;

  const [lines] = await executor.execute(
    `SELECT id, description, quantity, unit_price, vat_rate, line_total
     FROM invoice_lines WHERE invoice_id = ? ORDER BY id`,
    [id],
  );

  const [payments] = await executor.execute(
    `SELECT id, amount, payment_method, paid_at, notes
     FROM invoice_payments WHERE invoice_id = ? ORDER BY paid_at DESC, id DESC`,
    [id],
  );

  return { ...invoiceRows[0], lines, payments };
}

async function refreshInvoiceBalance(connection, invoiceId) {
  const [summary] = await connection.execute(
    `SELECT COALESCE(SUM(line_total), 0) AS total_amount,
            COALESCE((SELECT SUM(amount) FROM invoice_payments WHERE invoice_id = ?), 0) AS paid_amount
     FROM invoice_lines WHERE invoice_id = ?`,
    [invoiceId, invoiceId],
  );

  const totalAmount = money(summary[0].total_amount);
  const paidAmount = money(summary[0].paid_amount);
  const balanceAmount = money(totalAmount - paidAmount);

  let status = 'DRAFT';
  if (paidAmount >= totalAmount && totalAmount > 0) status = 'PAID';
  else if (paidAmount > 0 && paidAmount < totalAmount) status = 'PARTIALLY_PAID';
  else if (totalAmount > 0) status = 'SENT';

  await connection.execute(
    'UPDATE invoices SET total_amount = ?, paid_amount = ?, balance_amount = ?, status = ? WHERE id = ?',
    [totalAmount, paidAmount, balanceAmount, status, invoiceId],
  );
}

export async function listInvoices(request, response) {
  const { client_id: clientId, animal_id: animalId, status, page, pageSize } = request.query;
  const conditions = [];
  const values = [];
  if (clientId) { conditions.push('invoices.client_id = ?'); values.push(clientId); }
  if (animalId) { conditions.push('invoices.animal_id = ?'); values.push(animalId); }
  if (status) { conditions.push('invoices.status = ?'); values.push(status); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (page - 1) * pageSize;
  const [countRows] = await pool.execute(`SELECT COUNT(*) AS total FROM invoices ${where}`, values);
  const [rows] = await pool.execute(
    `SELECT invoices.id, invoices.client_id, invoices.animal_id, invoices.invoice_number,
            invoices.issue_date, invoices.due_date, invoices.status,
            invoices.total_amount, invoices.paid_amount, invoices.balance_amount
     FROM invoices
     ${where}
     ORDER BY invoices.issue_date DESC, invoices.id DESC
     LIMIT ? OFFSET ?`,
    [...values, pageSize, offset],
  );
  response.json({ success: true, data: rows, pagination: { page, pageSize, total: countRows[0].total, totalPages: Math.ceil(countRows[0].total / pageSize) } });
}

export async function getInvoice(request, response) {
  const invoice = await findInvoice(request.params.id);
  if (!invoice) throw new HttpError(404, 'Facture introuvable.');
  response.json({ success: true, data: invoice });
}

export async function createInvoice(request, response) {
  const { client_id, animal_id, issue_date, due_date, notes, lines } = request.body;
  if (!Array.isArray(lines) || lines.length === 0) throw new HttpError(422, 'Une facture doit contenir au moins une ligne.');

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [clientRows] = await connection.execute('SELECT id FROM clients WHERE id = ? AND deleted_at IS NULL LIMIT 1', [client_id]);
    if (clientRows.length === 0) throw new HttpError(422, 'Le client sélectionné est introuvable.');

    const [animalRows] = await connection.execute(
      `SELECT animal_id FROM client_animal
       WHERE animal_id = ? AND client_id = ? AND valid_to IS NULL LIMIT 1`,
      [animal_id, client_id],
    );
    if (animalRows.length === 0) throw new HttpError(422, 'L’animal sélectionné n’est pas rattaché au client.');

    const invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const [result] = await connection.execute(
      `INSERT INTO invoices (client_id, animal_id, invoice_number, issue_date, due_date, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [client_id, animal_id, invoiceNumber, issue_date, due_date ?? null, notes ?? null, request.auth.id],
    );

    const invoiceId = result.insertId;
    let totalAmount = 0;
    for (const line of lines) {
      const qty = Number(line.quantity ?? 1);
      const unitPrice = Number(line.unit_price ?? 0);
      const vatRate = Number(line.vat_rate ?? 0);
      if (!Number.isFinite(qty) || qty <= 0) throw new HttpError(422, 'La quantité de ligne doit être positive.');
      if (!Number.isFinite(unitPrice) || unitPrice < 0) throw new HttpError(422, 'Le prix unitaire est invalide.');
      const lineTotal = calculateLineTotal(qty, unitPrice, vatRate);
      totalAmount += lineTotal;
      await connection.execute(
        `INSERT INTO invoice_lines (invoice_id, description, quantity, unit_price, vat_rate, line_total)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [invoiceId, String(line.description ?? 'Service').trim() || 'Service', qty, unitPrice, vatRate, lineTotal],
      );
    }
    totalAmount = money(totalAmount);
    await connection.execute(
      'UPDATE invoices SET total_amount = ?, paid_amount = 0, balance_amount = ?, status = ? WHERE id = ?',
      [totalAmount, totalAmount, 'DRAFT', invoiceId],
    );
    await connection.commit();

    response.status(201).json({ success: true, data: await findInvoice(invoiceId) });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function createInvoicePayment(request, response) {
  const { amount, payment_method, paid_at, notes } = request.body;
  if (!amount || Number(amount) <= 0) throw new HttpError(422, 'Le montant du paiement doit être strictement positif.');
  if (!['CASH', 'CARD', 'BANK_TRANSFER', 'CHEQUE'].includes(payment_method)) {
    throw new HttpError(422, 'La méthode de paiement est invalide.');
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [invoiceRows] = await connection.execute(
      'SELECT id, total_amount, paid_amount, balance_amount, status FROM invoices WHERE id = ? FOR UPDATE',
      [request.params.id],
    );
    if (invoiceRows.length === 0) throw new HttpError(404, 'Facture introuvable.');

    const invoice = invoiceRows[0];
    const incomingAmount = money(amount);
    const remaining = money(Number(invoice.balance_amount) || 0);
    if (incomingAmount > remaining) throw new HttpError(422, 'Le paiement dépasse le solde restant de la facture.');

    await connection.execute(
      `INSERT INTO invoice_payments (invoice_id, amount, payment_method, paid_at, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [invoice.id, incomingAmount, payment_method, paid_at ?? new Date().toISOString().slice(0, 16).replace('T', ' '), notes ?? null, request.auth.id],
    );

    const updatedPaid = money(Number(invoice.paid_amount) + incomingAmount);
    const updatedBalance = money(Number(invoice.total_amount) - updatedPaid);
    const nextStatus = updatedPaid >= Number(invoice.total_amount) ? 'PAID' : 'PARTIALLY_PAID';

    await connection.execute(
      'UPDATE invoices SET paid_amount = ?, balance_amount = ?, status = ? WHERE id = ?',
      [updatedPaid, updatedBalance, nextStatus, invoice.id],
    );

    await connection.commit();
    response.status(201).json({ success: true, data: { id: invoice.id, invoice_status: nextStatus, amount: incomingAmount } });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
// Ajouter ces fonctions à la fin

export async function cancelInvoice(request, response) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      'SELECT id, status FROM invoices WHERE id = ? FOR UPDATE',
      [request.params.id],
    );
    if (rows.length === 0) throw new HttpError(404, 'Facture introuvable.');
    if (rows[0].status === 'PAID') {
      throw new HttpError(422, 'Impossible d\'annuler une facture déjà payée.');
    }
    if (rows[0].status === 'CANCELLED') {
      throw new HttpError(422, 'Facture déjà annulée.');
    }

    await connection.execute(
      'UPDATE invoices SET status = ? WHERE id = ?',
      ['CANCELLED', request.params.id],
    );
    await connection.commit();
    response.json({ success: true, data: { id: Number(request.params.id), status: 'CANCELLED' } });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function createInvoiceFromConsultation(request, response) {
  const { consultationId } = request.params;
  const { lines } = request.body; // On récupère les actes envoyés par React
  
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Récupérer la consultation
    const [consultRows] = await connection.execute(
      `SELECT c.id, c.client_id, c.animal_id, c.veterinarian_id, c.reason
       FROM consultations c WHERE c.id = ? LIMIT 1`,
      [consultationId],
    );
    if (consultRows.length === 0) throw new HttpError(404, 'Consultation introuvable.');
    const consultation = consultRows[0];

    // Vérifier qu'une facture n'existe pas déjà
    const [existing] = await connection.execute(
      'SELECT id FROM invoices WHERE consultation_id = ? LIMIT 1',
      [consultationId],
    );
    if (existing.length > 0) {
      throw new HttpError(422, 'Une facture existe déjà pour cette consultation.');
    }

    // 2. Créer l'en-tête de la facture
    const invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const today = new Date().toISOString().slice(0, 10);
    const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const [result] = await connection.execute(
      `INSERT INTO invoices
       (client_id, animal_id, consultation_id, invoice_number, issue_date, due_date, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        consultation.client_id,
        consultation.animal_id,
        consultation.id,
        invoiceNumber,
        today,
        dueDate,
        `Facture pour consultation : ${consultation.reason}`,
        request.auth.id,
      ],
    );

    const invoiceId = result.insertId;
    let totalAmount = 0;

    // 3. Insérer les lignes envoyées par React
    if (lines && lines.length > 0) {
      for (const line of lines) {
        const qty = Number(line.quantity || 1);
        const price = Number(line.unit_price || 0);
        const vat = Number(line.vat_rate || 0);
        const lineTotal = calculateLineTotal(qty, price, vat);
        
        await connection.execute(
          `INSERT INTO invoice_lines (invoice_id, description, quantity, unit_price, vat_rate, line_total)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [invoiceId, line.description, qty, price, vat, lineTotal],
        );
        totalAmount += lineTotal;
      }
    } else {
      // Si aucune ligne (sécurité), on met une ligne par défaut
      totalAmount = 15.00;
      await connection.execute(
        `INSERT INTO invoice_lines (invoice_id, description, quantity, unit_price, vat_rate, line_total)
         VALUES (?, ?, 1, 15.00, 0, 15.00)`,
        [invoiceId, `Consultation : ${consultation.reason}`],
      );
    }

    // 4. Mettre à jour les totaux de la facture
    await connection.execute(
      'UPDATE invoices SET total_amount = ?, balance_amount = ?, status = ? WHERE id = ?',
      [totalAmount, totalAmount, 'SENT', invoiceId], // On met 'SENT' car la facture est générée
    );

    await connection.commit();
    response.status(201).json({ success: true, data: await findInvoice(invoiceId) });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function listServicePrices(request, response) {
  const [rows] = await pool.execute(
    `SELECT id, service_code, label, category, description, price, vat_rate, unit
     FROM service_prices
     WHERE is_active = 1
     ORDER BY category, label`,
  );
  response.json({ success: true, data: rows });
}
