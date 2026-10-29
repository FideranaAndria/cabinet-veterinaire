CREATE TABLE IF NOT EXISTS suppliers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(180) NOT NULL,
  contact_name VARCHAR(180) NULL,
  email VARCHAR(254) NULL,
  phone VARCHAR(40) NULL,
  address TEXT NULL,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  notes TEXT NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id), KEY idx_suppliers_status_name (status, name),
  CONSTRAINT fk_suppliers_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS purchase_orders (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  supplier_id BIGINT UNSIGNED NOT NULL,
  order_number VARCHAR(80) NOT NULL,
  status ENUM('DRAFT', 'ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
  ordered_at DATE NOT NULL,
  expected_at DATE NULL,
  notes TEXT NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY uq_purchase_order_number (order_number),
  KEY idx_purchase_orders_supplier_status (supplier_id, status, ordered_at),
  CONSTRAINT fk_purchase_orders_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers (id) ON DELETE RESTRICT,
  CONSTRAINT fk_purchase_orders_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS purchase_order_lines (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  purchase_order_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  quantity_ordered INT UNSIGNED NOT NULL,
  quantity_received INT UNSIGNED NOT NULL DEFAULT 0,
  unit_cost DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id), KEY idx_purchase_order_lines_order (purchase_order_id),
  CONSTRAINT chk_purchase_line_ordered CHECK (quantity_ordered > 0),
  CONSTRAINT chk_purchase_line_received CHECK (quantity_received <= quantity_ordered),
  CONSTRAINT chk_purchase_line_cost CHECK (unit_cost >= 0),
  CONSTRAINT fk_purchase_lines_order FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders (id) ON DELETE RESTRICT,
  CONSTRAINT fk_purchase_lines_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_lots (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id BIGINT UNSIGNED NOT NULL,
  supplier_id BIGINT UNSIGNED NOT NULL,
  purchase_order_line_id BIGINT UNSIGNED NULL,
  lot_number VARCHAR(120) NOT NULL,
  expires_on DATE NULL,
  quantity_received INT UNSIGNED NOT NULL,
  quantity_remaining INT UNSIGNED NOT NULL,
  unit_cost DECIMAL(10,2) NOT NULL,
  received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id), KEY idx_product_lots_expiry (product_id, expires_on),
  KEY idx_product_lots_supplier (supplier_id, lot_number),
  CONSTRAINT chk_product_lot_quantity CHECK (quantity_received > 0 AND quantity_remaining <= quantity_received),
  CONSTRAINT fk_product_lots_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE RESTRICT,
  CONSTRAINT fk_product_lots_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers (id) ON DELETE RESTRICT,
  CONSTRAINT fk_product_lots_order_line FOREIGN KEY (purchase_order_line_id) REFERENCES purchase_order_lines (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS supplier_returns (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  supplier_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  lot_id BIGINT UNSIGNED NULL,
  quantity INT UNSIGNED NOT NULL,
  reason VARCHAR(1000) NOT NULL,
  status ENUM('REQUESTED', 'APPROVED', 'RETURNED', 'REJECTED') NOT NULL DEFAULT 'REQUESTED',
  requested_by BIGINT UNSIGNED NOT NULL,
  handled_by BIGINT UNSIGNED NULL,
  requested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  handled_at TIMESTAMP NULL,
  PRIMARY KEY (id), KEY idx_supplier_returns_supplier_status (supplier_id, status, requested_at),
  CONSTRAINT chk_supplier_return_quantity CHECK (quantity > 0),
  CONSTRAINT fk_returns_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers (id) ON DELETE RESTRICT,
  CONSTRAINT fk_returns_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE RESTRICT,
  CONSTRAINT fk_returns_lot FOREIGN KEY (lot_id) REFERENCES product_lots (id) ON DELETE RESTRICT,
  CONSTRAINT fk_returns_requested_by FOREIGN KEY (requested_by) REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT fk_returns_handled_by FOREIGN KEY (handled_by) REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO permissions (permission_key, description) VALUES
  ('suppliers.read', 'Consulter les fournisseurs'), ('suppliers.write', 'Gérer les fournisseurs'),
  ('purchase_orders.read', 'Consulter les commandes fournisseurs'), ('purchase_orders.write', 'Gérer et réceptionner les commandes'),
  ('returns.read', 'Consulter les retours fournisseurs'), ('returns.write', 'Gérer les retours fournisseurs'),
  ('lots.read', 'Consulter les lots produits');

INSERT INTO role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id FROM roles CROSS JOIN permissions
WHERE roles.name IN ('ADMIN', 'DIRECTION', 'VETERINAIRE', 'ASV', 'ASSISTANT_ADMINISTRATIF')
  AND permissions.permission_key IN ('suppliers.read', 'purchase_orders.read', 'returns.read', 'lots.read')
  AND NOT EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.role_id = roles.id AND rp.permission_id = permissions.id);

INSERT INTO role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id FROM roles CROSS JOIN permissions
WHERE roles.name IN ('ADMIN', 'DIRECTION', 'ASSISTANT_ADMINISTRATIF')
  AND permissions.permission_key IN ('suppliers.write', 'purchase_orders.write', 'returns.write')
  AND NOT EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.role_id = roles.id AND rp.permission_id = permissions.id);
