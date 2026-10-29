CREATE TABLE IF NOT EXISTS insurance_policies (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  client_id BIGINT UNSIGNED NOT NULL,
  animal_id BIGINT UNSIGNED NOT NULL,
  insurer_name VARCHAR(180) NOT NULL,
  policy_number VARCHAR(120) NOT NULL,
  coverage_type VARCHAR(120) NULL,
  coverage_limit DECIMAL(10,2) NULL,
  valid_from DATE NOT NULL,
  valid_until DATE NULL,
  status ENUM('ACTIVE', 'EXPIRED', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
  notes TEXT NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY uq_insurance_policy (insurer_name, policy_number),
  KEY idx_insurance_policy_client_animal (client_id, animal_id, status),
  CONSTRAINT chk_insurance_policy_limit CHECK (coverage_limit IS NULL OR coverage_limit >= 0),
  CONSTRAINT chk_insurance_policy_period CHECK (valid_until IS NULL OR valid_until >= valid_from),
  CONSTRAINT fk_insurance_policy_client FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE RESTRICT,
  CONSTRAINT fk_insurance_policy_animal FOREIGN KEY (animal_id) REFERENCES animals (id) ON DELETE RESTRICT,
  CONSTRAINT fk_insurance_policy_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS insurance_claims (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  policy_id BIGINT UNSIGNED NOT NULL,
  invoice_id BIGINT UNSIGNED NULL,
  consultation_id BIGINT UNSIGNED NULL,
  claim_number VARCHAR(120) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  reason TEXT NOT NULL,
  status ENUM('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'PAID', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
  submitted_at DATETIME NULL,
  decision_notes TEXT NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY uq_insurance_claim_number (claim_number),
  KEY idx_insurance_claim_policy_status (policy_id, status, created_at),
  CONSTRAINT chk_insurance_claim_amount CHECK (amount > 0),
  CONSTRAINT fk_insurance_claim_policy FOREIGN KEY (policy_id) REFERENCES insurance_policies (id) ON DELETE RESTRICT,
  CONSTRAINT fk_insurance_claim_invoice FOREIGN KEY (invoice_id) REFERENCES invoices (id) ON DELETE RESTRICT,
  CONSTRAINT fk_insurance_claim_consultation FOREIGN KEY (consultation_id) REFERENCES consultations (id) ON DELETE RESTRICT,
  CONSTRAINT fk_insurance_claim_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT fk_insurance_claim_updated_by FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO permissions (permission_key, description) VALUES
  ('insurance.read', 'Consulter les contrats et dossiers d’assurance'),
  ('insurance.write', 'Gérer les contrats et dossiers d’assurance');

INSERT INTO role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id FROM roles CROSS JOIN permissions
WHERE roles.name IN ('ADMIN', 'DIRECTION', 'VETERINAIRE', 'ASSISTANT_ADMINISTRATIF')
  AND permissions.permission_key = 'insurance.read'
  AND NOT EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.role_id = roles.id AND rp.permission_id = permissions.id);

INSERT INTO role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id FROM roles CROSS JOIN permissions
WHERE roles.name IN ('ADMIN', 'DIRECTION', 'VETERINAIRE')
  AND permissions.permission_key = 'insurance.write'
  AND NOT EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.role_id = roles.id AND rp.permission_id = permissions.id);
