CREATE TABLE IF NOT EXISTS products (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  sku VARCHAR(80) NOT NULL,
  name VARCHAR(180) NOT NULL,
  category VARCHAR(120) NOT NULL,
  description TEXT NULL,
  unit VARCHAR(40) NOT NULL DEFAULT 'unité',
  purchase_price DECIMAL(10,2) NULL,
  sale_price DECIMAL(10,2) NULL,
  stock_quantity INT NOT NULL DEFAULT 0,
  stock_alert_threshold INT NOT NULL DEFAULT 0,
  status ENUM('active', 'discontinued') NOT NULL DEFAULT 'active',
  created_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_products_sku (sku),
  KEY idx_products_category (category),
  KEY idx_products_stock (stock_quantity, stock_alert_threshold),
  CONSTRAINT chk_products_stock_non_negative CHECK (stock_quantity >= 0),
  CONSTRAINT fk_products_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inventory_movements (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id BIGINT UNSIGNED NOT NULL,
  movement_type ENUM('ENTRY', 'EXIT', 'ADJUSTMENT') NOT NULL,
  quantity INT NOT NULL,
  unit_cost DECIMAL(10,2) NULL,
  reason VARCHAR(255) NULL,
  performed_by BIGINT UNSIGNED NOT NULL,
  performed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_inventory_product_time (product_id, performed_at),
  KEY idx_inventory_type_time (movement_type, performed_at),
  CONSTRAINT chk_inventory_quantity_non_zero CHECK (quantity <> 0),
  CONSTRAINT fk_inventory_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE RESTRICT,
  CONSTRAINT fk_inventory_performed_by FOREIGN KEY (performed_by) REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO permissions (permission_key, description) VALUES
  ('products.read', 'Consulter le catalogue produits'),
  ('products.create', 'Créer un produit'),
  ('products.update', 'Modifier un produit'),
  ('inventory.read', 'Consulter le stock'),
  ('inventory.write', 'Enregistrer un mouvement de stock');

INSERT INTO role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id
FROM roles
JOIN permissions ON permissions.permission_key IN (
  'products.read', 'products.create', 'products.update', 'inventory.read', 'inventory.write'
)
WHERE roles.name IN ('ADMIN', 'DIRECTION', 'VETERINAIRE')
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions existing
    WHERE existing.role_id = roles.id AND existing.permission_id = permissions.id
  );

INSERT INTO role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id
FROM roles
JOIN permissions ON permissions.permission_key IN ('products.read', 'inventory.read')
WHERE roles.name = 'ASV'
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions existing
    WHERE existing.role_id = roles.id AND existing.permission_id = permissions.id
  );
