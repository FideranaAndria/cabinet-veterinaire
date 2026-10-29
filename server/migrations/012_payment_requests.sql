CREATE TABLE IF NOT EXISTS payment_requests (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  invoice_id BIGINT UNSIGNED NOT NULL,
  request_number VARCHAR(80) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  status ENUM('SENT', 'PAID', 'CANCELLED') NOT NULL DEFAULT 'SENT',
  requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  due_at DATE NULL,
  paid_at DATETIME NULL,
  notes TEXT NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (id), UNIQUE KEY uq_payment_request_number (request_number),
  KEY idx_payment_requests_invoice_status (invoice_id, status),
  CONSTRAINT chk_payment_request_amount CHECK (amount > 0),
  CONSTRAINT fk_payment_requests_invoice FOREIGN KEY (invoice_id) REFERENCES invoices (id) ON DELETE RESTRICT,
  CONSTRAINT fk_payment_requests_user FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO permissions (permission_key, description) VALUES
  ('payment_requests.read', 'Consulter les demandes de paiement'),
  ('payment_requests.create', 'Créer une demande de paiement'),
  ('payment_requests.update', 'Mettre à jour une demande de paiement');

INSERT INTO role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id FROM roles CROSS JOIN permissions
WHERE roles.name IN ('ADMIN', 'DIRECTION', 'VETERINAIRE', 'ASV', 'ASSISTANT_ADMINISTRATIF')
  AND permissions.permission_key IN ('payment_requests.read', 'payment_requests.create', 'payment_requests.update')
  AND NOT EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.role_id = roles.id AND rp.permission_id = permissions.id);
