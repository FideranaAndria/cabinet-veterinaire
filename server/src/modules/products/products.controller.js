import { pool } from '../../db/pool.js';
import { HttpError } from '../../utils/http-error.js';

const productFields = [
  'sku', 'name', 'category', 'description', 'unit', 'purchase_price', 'sale_price',
  'stock_quantity', 'stock_alert_threshold', 'status',
];

async function findProduct(id, executor = pool) {
  const [rows] = await executor.execute(
    `SELECT id, sku, name, category, description, unit, purchase_price, sale_price,
            stock_quantity, stock_alert_threshold, status, created_at, updated_at
     FROM products WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
    [id],
  );
  return rows[0];
}

export async function listProducts(request, response) {
  const { search, category, status, page, pageSize } = request.query;
  const conditions = ['deleted_at IS NULL'];
  const values = [];
  if (search) {
    conditions.push('(sku LIKE ? OR name LIKE ? OR category LIKE ?)');
    const pattern = `%${search}%`;
    values.push(pattern, pattern, pattern);
  }
  if (category) { conditions.push('category = ?'); values.push(category); }
  if (status) { conditions.push('status = ?'); values.push(status); }

  const where = `WHERE ${conditions.join(' AND ')}`;
  const offset = (page - 1) * pageSize;
  const [countRows] = await pool.execute(`SELECT COUNT(*) AS total FROM products ${where}`, values);
  const [rows] = await pool.execute(
    `SELECT id, sku, name, category, description, unit, purchase_price, sale_price,
            stock_quantity, stock_alert_threshold, status, created_at, updated_at
     FROM products ${where}
     ORDER BY name ASC LIMIT ? OFFSET ?`,
    [...values, pageSize, offset],
  );

  response.json({
    success: true,
    data: rows,
    pagination: { page, pageSize, total: countRows[0].total, totalPages: Math.ceil(countRows[0].total / pageSize) },
  });
}

export async function getProduct(request, response) {
  const product = await findProduct(request.params.id);
  if (!product) throw new HttpError(404, 'Produit introuvable.');
  response.json({ success: true, data: product });
}

export async function createProduct(request, response) {
  const fields = Object.keys(request.body).filter((field) => productFields.includes(field));
  const values = fields.map((field) => request.body[field] ?? null);
  const [result] = await pool.execute(
    `INSERT INTO products (${fields.join(', ')}, created_by) VALUES (${fields.map(() => '?').join(', ')}, ?)`,
    [...values, request.auth.id],
  );
  response.status(201).json({ success: true, data: await findProduct(result.insertId) });
}

export async function updateProduct(request, response) {
  const fields = Object.keys(request.body).filter((field) => productFields.includes(field));
  const values = fields.map((field) => request.body[field] ?? null);
  const [result] = await pool.execute(
    `UPDATE products SET ${fields.map((field) => `${field} = ?`).join(', ')} WHERE id = ? AND deleted_at IS NULL`,
    [...values, request.params.id],
  );
  if (result.affectedRows === 0) throw new HttpError(404, 'Produit introuvable.');
  response.json({ success: true, data: await findProduct(request.params.id) });
}

export async function listInventory(request, response) {
  const [rows] = await pool.execute(
    `SELECT products.id, products.sku, products.name, products.category, products.unit,
            products.stock_quantity, products.stock_alert_threshold,
            (products.stock_quantity <= products.stock_alert_threshold) AS is_low_stock
     FROM products
     WHERE products.deleted_at IS NULL
     ORDER BY products.name ASC`,
  );
  response.json({ success: true, data: rows });
}

export async function createStockMovement(request, response) {
  const productId = request.params.id;
  const { movement_type, quantity, unit_cost, reason } = request.body;
  if (!['ENTRY', 'EXIT', 'ADJUSTMENT'].includes(movement_type)) {
    throw new HttpError(422, 'Le type de mouvement est invalide.');
  }
  if (!Number.isFinite(Number(quantity)) || Number(quantity) === 0) {
    throw new HttpError(422, 'La quantité doit être un nombre non nul.');
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      'SELECT stock_quantity FROM products WHERE id = ? AND deleted_at IS NULL FOR UPDATE',
      [productId],
    );
    if (rows.length === 0) throw new HttpError(404, 'Produit introuvable.');

    const currentStock = Number(rows[0].stock_quantity);
    const delta = movement_type === 'ENTRY' ? Number(quantity)
      : movement_type === 'EXIT' ? -Number(quantity)
      : Number(quantity);

    if (movement_type === 'EXIT' && currentStock - Number(quantity) < 0) {
      throw new HttpError(409, 'Le stock disponible est insuffisant pour cette sortie.');
    }
    if (movement_type === 'ADJUSTMENT' && currentStock + delta < 0) {
      throw new HttpError(409, 'Le stock ne peut pas devenir négatif après ajustement.');
    }

    const nextStock = currentStock + delta;
    await connection.execute(
      'UPDATE products SET stock_quantity = ? WHERE id = ?',
      [nextStock, productId],
    );
    await connection.execute(
      `INSERT INTO inventory_movements (product_id, movement_type, quantity, unit_cost, reason, performed_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [productId, movement_type, Number(quantity), unit_cost ?? null, reason ?? null, request.auth.id],
    );
    await connection.commit();
    response.status(201).json({ success: true, data: await findProduct(productId) });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
