import { pool } from '../../db/pool.js';
import { HttpError } from '../../utils/http-error.js';

function pagination(page, pageSize, total) {
  return { page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
}

export async function listSuppliers(request, response) {
  const { page, pageSize } = request.query;
  const offset = (page - 1) * pageSize;
  const [counts] = await pool.execute('SELECT COUNT(*) AS total FROM suppliers');
  const [rows] = await pool.execute('SELECT id, name, contact_name, email, phone, address, status, notes, created_at, updated_at FROM suppliers ORDER BY name LIMIT ? OFFSET ?', [pageSize, offset]);
  response.json({ success: true, data: rows, pagination: pagination(page, pageSize, counts[0].total) });
}

export async function createSupplier(request, response) {
  const body = request.body;
  const [result] = await pool.execute(
    'INSERT INTO suppliers (name, contact_name, email, phone, address, notes, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [body.name, body.contact_name ?? null, body.email ?? null, body.phone ?? null, body.address ?? null, body.notes ?? null, body.status ?? 'active', request.auth.id],
  );
  response.status(201).json({ success: true, data: { id: result.insertId, ...body, status: body.status ?? 'active' } });
}

export async function updateSupplier(request, response) {
  const fields = Object.keys(request.body);
  const [result] = await pool.execute(
    `UPDATE suppliers SET ${fields.map((field) => `${field} = ?`).join(', ')} WHERE id = ?`,
    [...fields.map((field) => request.body[field] ?? null), request.params.id],
  );
  if (!result.affectedRows) throw new HttpError(404, 'Fournisseur introuvable.');
  response.json({ success: true, data: { id: Number(request.params.id), ...request.body } });
}

export async function listPurchaseOrders(request, response) {
  const { page, pageSize } = request.query;
  const offset = (page - 1) * pageSize;
  const [counts] = await pool.execute('SELECT COUNT(*) AS total FROM purchase_orders');
  const [rows] = await pool.execute(
    `SELECT purchase_orders.id, purchase_orders.supplier_id, suppliers.name AS supplier_name,
            purchase_orders.order_number, purchase_orders.status, purchase_orders.ordered_at,
            purchase_orders.expected_at, purchase_orders.notes, purchase_orders.created_at
     FROM purchase_orders JOIN suppliers ON suppliers.id = purchase_orders.supplier_id
     ORDER BY purchase_orders.ordered_at DESC, purchase_orders.id DESC LIMIT ? OFFSET ?`, [pageSize, offset],
  );
  response.json({ success: true, data: rows, pagination: pagination(page, pageSize, counts[0].total) });
}

export async function createPurchaseOrder(request, response) {
  const body = request.body;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [suppliers] = await connection.execute("SELECT id FROM suppliers WHERE id = ? AND status = 'active' FOR UPDATE", [body.supplier_id]);
    if (!suppliers.length) throw new HttpError(422, 'Le fournisseur est introuvable ou inactif.');
    const productIds = [...new Set(body.lines.map((line) => line.product_id))];
    const [products] = await connection.query(`SELECT id FROM products WHERE deleted_at IS NULL AND status = 'active' AND id IN (${productIds.map(() => '?').join(',')}) FOR UPDATE`, productIds);
    if (products.length !== productIds.length) throw new HttpError(422, 'Un ou plusieurs produits sont introuvables ou inactifs.');
    const [result] = await connection.execute(
      `INSERT INTO purchase_orders (supplier_id, order_number, status, ordered_at, expected_at, notes, created_by)
       VALUES (?, ?, 'ORDERED', ?, ?, ?, ?)`,
      [body.supplier_id, body.order_number, body.ordered_at, body.expected_at ?? null, body.notes ?? null, request.auth.id],
    );
    for (const line of body.lines) {
      await connection.execute(
        'INSERT INTO purchase_order_lines (purchase_order_id, product_id, quantity_ordered, unit_cost) VALUES (?, ?, ?, ?)',
        [result.insertId, line.product_id, line.quantity_ordered, line.unit_cost],
      );
    }
    await connection.commit();
    response.status(201).json({ success: true, data: { id: result.insertId, ...body, status: 'ORDERED' } });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
}

export async function receivePurchaseOrder(request, response) {
  const id = request.params.id;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [orders] = await connection.execute('SELECT id, supplier_id, status FROM purchase_orders WHERE id = ? FOR UPDATE', [id]);
    const order = orders[0];
    if (!order) throw new HttpError(404, 'Commande fournisseur introuvable.');
    if (!['ORDERED', 'PARTIALLY_RECEIVED'].includes(order.status)) throw new HttpError(409, 'Cette commande ne peut plus être réceptionnée.');
    let accepted = 0;
    for (const receipt of request.body.lines) {
      const [lines] = await connection.execute(
        'SELECT id, product_id, quantity_ordered, quantity_received, unit_cost FROM purchase_order_lines WHERE id = ? AND purchase_order_id = ? FOR UPDATE',
        [receipt.purchase_order_line_id, id],
      );
      const line = lines[0];
      if (!line) throw new HttpError(422, 'Une ligne de réception ne correspond pas à cette commande.');
      const remaining = Number(line.quantity_ordered) - Number(line.quantity_received);
      if (receipt.quantity > remaining) throw new HttpError(409, 'La quantité reçue dépasse la quantité commandée.');
      await connection.execute('UPDATE purchase_order_lines SET quantity_received = quantity_received + ? WHERE id = ?', [receipt.quantity, line.id]);
      await connection.execute(
        `INSERT INTO product_lots (product_id, supplier_id, purchase_order_line_id, lot_number, expires_on, quantity_received, quantity_remaining, unit_cost)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [line.product_id, order.supplier_id, line.id, receipt.lot_number, receipt.expires_on ?? null, receipt.quantity, receipt.quantity, line.unit_cost],
      );
      await connection.execute('UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?', [receipt.quantity, line.product_id]);
      await connection.execute(
        `INSERT INTO inventory_movements (product_id, movement_type, quantity, unit_cost, reason, performed_by)
         VALUES (?, 'ENTRY', ?, ?, ?, ?)`,
        [line.product_id, receipt.quantity, line.unit_cost, `Réception commande ${id}, lot ${receipt.lot_number}`, request.auth.id],
      );
      accepted++;
    }
    const [remaining] = await connection.execute('SELECT COUNT(*) AS total FROM purchase_order_lines WHERE purchase_order_id = ? AND quantity_received < quantity_ordered', [id]);
    const nextStatus = remaining[0].total === 0 ? 'RECEIVED' : 'PARTIALLY_RECEIVED';
    await connection.execute('UPDATE purchase_orders SET status = ? WHERE id = ?', [nextStatus, id]);
    await connection.commit();
    response.json({ success: true, data: { id: Number(id), status: nextStatus, receipt_lines: accepted } });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
}

export async function listLots(request, response) {
  const { page, pageSize } = request.query;
  const offset = (page - 1) * pageSize;
  const [counts] = await pool.execute('SELECT COUNT(*) AS total FROM product_lots');
  const [rows] = await pool.execute(
    `SELECT product_lots.id, product_lots.product_id, products.name AS product_name, product_lots.supplier_id,
            suppliers.name AS supplier_name, product_lots.lot_number, product_lots.expires_on,
            product_lots.quantity_received, product_lots.quantity_remaining, product_lots.unit_cost, product_lots.received_at
     FROM product_lots JOIN products ON products.id = product_lots.product_id
     JOIN suppliers ON suppliers.id = product_lots.supplier_id
     ORDER BY product_lots.expires_on IS NULL, product_lots.expires_on, product_lots.id DESC LIMIT ? OFFSET ?`, [pageSize, offset],
  );
  response.json({ success: true, data: rows, pagination: pagination(page, pageSize, counts[0].total) });
}

export async function listReturns(request, response) {
  const { page, pageSize } = request.query;
  const offset = (page - 1) * pageSize;
  const [counts] = await pool.execute('SELECT COUNT(*) AS total FROM supplier_returns');
  const [rows] = await pool.execute(
    `SELECT supplier_returns.id, supplier_returns.supplier_id, suppliers.name AS supplier_name,
            supplier_returns.product_id, products.name AS product_name, supplier_returns.lot_id,
            supplier_returns.quantity, supplier_returns.reason, supplier_returns.status,
            supplier_returns.requested_by, supplier_returns.requested_at, supplier_returns.handled_by, supplier_returns.handled_at
     FROM supplier_returns JOIN suppliers ON suppliers.id = supplier_returns.supplier_id
     JOIN products ON products.id = supplier_returns.product_id
     ORDER BY supplier_returns.requested_at DESC, supplier_returns.id DESC LIMIT ? OFFSET ?`, [pageSize, offset],
  );
  response.json({ success: true, data: rows, pagination: pagination(page, pageSize, counts[0].total) });
}

export async function createReturn(request, response) {
  const body = request.body;
  if (body.lot_id) {
    const [lots] = await pool.execute('SELECT id FROM product_lots WHERE id = ? AND product_id = ? AND supplier_id = ?', [body.lot_id, body.product_id, body.supplier_id]);
    if (!lots.length) throw new HttpError(422, 'Le lot ne correspond pas au produit et au fournisseur sélectionnés.');
  }
  const [result] = await pool.execute(
    'INSERT INTO supplier_returns (supplier_id, product_id, lot_id, quantity, reason, requested_by) VALUES (?, ?, ?, ?, ?, ?)',
    [body.supplier_id, body.product_id, body.lot_id ?? null, body.quantity, body.reason, request.auth.id],
  );
  response.status(201).json({ success: true, data: { id: result.insertId, ...body, status: 'REQUESTED' } });
}

export async function updateReturnStatus(request, response) {
  const id = request.params.id;
  const status = request.body.status;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute('SELECT * FROM supplier_returns WHERE id = ? FOR UPDATE', [id]);
    const item = rows[0];
    if (!item) throw new HttpError(404, 'Retour fournisseur introuvable.');
    const allowed = { REQUESTED: ['APPROVED', 'REJECTED'], APPROVED: ['RETURNED'], RETURNED: [], REJECTED: [] };
    if (!allowed[item.status].includes(status)) throw new HttpError(409, 'Cette transition de statut est interdite.');
    if (status === 'RETURNED') {
      const [products] = await connection.execute('SELECT stock_quantity FROM products WHERE id = ? FOR UPDATE', [item.product_id]);
      if (!products.length || Number(products[0].stock_quantity) < Number(item.quantity)) throw new HttpError(409, 'Le stock est insuffisant pour enregistrer ce retour.');
      if (item.lot_id) {
        const [lots] = await connection.execute('SELECT quantity_remaining FROM product_lots WHERE id = ? FOR UPDATE', [item.lot_id]);
        if (!lots.length || Number(lots[0].quantity_remaining) < Number(item.quantity)) throw new HttpError(409, 'La quantité restante du lot est insuffisante.');
        await connection.execute('UPDATE product_lots SET quantity_remaining = quantity_remaining - ? WHERE id = ?', [item.quantity, item.lot_id]);
      }
      await connection.execute('UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?', [item.quantity, item.product_id]);
      await connection.execute(
        `INSERT INTO inventory_movements (product_id, movement_type, quantity, reason, performed_by)
         VALUES (?, 'EXIT', ?, ?, ?)`, [item.product_id, item.quantity, `Retour fournisseur ${id}`, request.auth.id],
      );
    }
    await connection.execute(
      'UPDATE supplier_returns SET status = ?, handled_by = ?, handled_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, request.auth.id, id],
    );
    await connection.commit();
    response.json({ success: true, data: { id: Number(id), status } });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
}
