CREATE TABLE IF NOT EXISTS medical_acts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  consultation_id BIGINT UNSIGNED NOT NULL,
  client_id BIGINT UNSIGNED NOT NULL,
  animal_id BIGINT UNSIGNED NOT NULL,
  veterinarian_id BIGINT UNSIGNED NOT NULL,
  act_type ENUM('medical', 'surgical') NOT NULL,
  title VARCHAR(180) NOT NULL,
  performed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  description TEXT NULL,
  anesthesia_protocol TEXT NULL,
  materials_used TEXT NULL,
  complications TEXT NULL,
  report TEXT NULL,
  follow_up_at DATETIME NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_medical_acts_animal_date (animal_id, performed_at),
  KEY idx_medical_acts_consultation (consultation_id),
  CONSTRAINT fk_medical_acts_consultation FOREIGN KEY (consultation_id) REFERENCES consultations (id) ON DELETE RESTRICT,
  CONSTRAINT fk_medical_acts_client FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE RESTRICT,
  CONSTRAINT fk_medical_acts_animal FOREIGN KEY (animal_id) REFERENCES animals (id) ON DELETE RESTRICT,
  CONSTRAINT fk_medical_acts_veterinarian FOREIGN KEY (veterinarian_id) REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT fk_medical_acts_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS prescriptions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  consultation_id BIGINT UNSIGNED NOT NULL,
  client_id BIGINT UNSIGNED NOT NULL,
  animal_id BIGINT UNSIGNED NOT NULL,
  veterinarian_id BIGINT UNSIGNED NOT NULL,
  issued_at DATE NOT NULL DEFAULT (CURRENT_DATE),
  valid_until DATE NULL,
  renewals_allowed TINYINT UNSIGNED NOT NULL DEFAULT 0,
  status ENUM('active', 'dispensed', 'expired', 'cancelled') NOT NULL DEFAULT 'active',
  observations TEXT NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_prescriptions_animal_date (animal_id, issued_at),
  KEY idx_prescriptions_client_date (client_id, issued_at),
  KEY idx_prescriptions_status_expiry (status, valid_until),
  CONSTRAINT chk_prescriptions_renewals CHECK (renewals_allowed <= 12),
  CONSTRAINT chk_prescriptions_validity CHECK (valid_until IS NULL OR valid_until >= issued_at),
  CONSTRAINT fk_prescriptions_consultation FOREIGN KEY (consultation_id) REFERENCES consultations (id) ON DELETE RESTRICT,
  CONSTRAINT fk_prescriptions_client FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE RESTRICT,
  CONSTRAINT fk_prescriptions_animal FOREIGN KEY (animal_id) REFERENCES animals (id) ON DELETE RESTRICT,
  CONSTRAINT fk_prescriptions_veterinarian FOREIGN KEY (veterinarian_id) REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT fk_prescriptions_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS prescription_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  prescription_id BIGINT UNSIGNED NOT NULL,
  medication_name VARCHAR(180) NOT NULL,
  dosage VARCHAR(160) NOT NULL,
  route VARCHAR(80) NULL,
  posology VARCHAR(500) NOT NULL,
  duration_days SMALLINT UNSIGNED NULL,
  quantity DECIMAL(10,2) NULL,
  instructions TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_prescription_items_parent (prescription_id),
  CONSTRAINT chk_prescription_items_duration CHECK (duration_days IS NULL OR duration_days > 0),
  CONSTRAINT chk_prescription_items_quantity CHECK (quantity IS NULL OR quantity > 0),
  CONSTRAINT fk_prescription_items_prescription FOREIGN KEY (prescription_id) REFERENCES prescriptions (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS vaccinations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  consultation_id BIGINT UNSIGNED NOT NULL,
  client_id BIGINT UNSIGNED NOT NULL,
  animal_id BIGINT UNSIGNED NOT NULL,
  veterinarian_id BIGINT UNSIGNED NOT NULL,
  vaccine_type VARCHAR(160) NOT NULL,
  administered_at DATE NOT NULL,
  batch_number VARCHAR(80) NULL,
  next_due_at DATE NULL,
  reaction TEXT NULL,
  certificate_reference VARCHAR(255) NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_vaccinations_animal_date (animal_id, administered_at),
  KEY idx_vaccinations_reminder (next_due_at, animal_id),
  KEY idx_vaccinations_batch (batch_number),
  CONSTRAINT chk_vaccinations_due_date CHECK (next_due_at IS NULL OR next_due_at >= administered_at),
  CONSTRAINT fk_vaccinations_consultation FOREIGN KEY (consultation_id) REFERENCES consultations (id) ON DELETE RESTRICT,
  CONSTRAINT fk_vaccinations_client FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE RESTRICT,
  CONSTRAINT fk_vaccinations_animal FOREIGN KEY (animal_id) REFERENCES animals (id) ON DELETE RESTRICT,
  CONSTRAINT fk_vaccinations_veterinarian FOREIGN KEY (veterinarian_id) REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT fk_vaccinations_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO permissions (permission_key, description) VALUES
  ('medical_acts.read', 'Consulter les actes médicaux et chirurgicaux'),
  ('medical_acts.create', 'Créer les actes médicaux et chirurgicaux'),
  ('medical_acts.update', 'Modifier les actes médicaux et chirurgicaux'),
  ('prescriptions.read', 'Consulter les ordonnances'),
  ('prescriptions.create', 'Créer les ordonnances'),
  ('prescriptions.update', 'Modifier les ordonnances'),
  ('vaccinations.read', 'Consulter les vaccinations'),
  ('vaccinations.create', 'Créer les vaccinations'),
  ('vaccinations.update', 'Modifier les vaccinations');

INSERT INTO role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id FROM roles CROSS JOIN permissions
WHERE roles.name IN ('ADMIN', 'DIRECTION')
  AND permissions.permission_key IN (
    'medical_acts.read', 'medical_acts.create', 'medical_acts.update',
    'prescriptions.read', 'prescriptions.create', 'prescriptions.update',
    'vaccinations.read', 'vaccinations.create', 'vaccinations.update'
  )
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions granted
    WHERE granted.role_id = roles.id AND granted.permission_id = permissions.id
  );

INSERT INTO role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id FROM roles CROSS JOIN permissions
WHERE roles.name IN ('VETERINAIRE', 'VETERINAIRE_ASSISTANT')
  AND permissions.permission_key IN (
    'medical_acts.read', 'medical_acts.create', 'medical_acts.update',
    'prescriptions.read', 'prescriptions.create', 'prescriptions.update',
    'vaccinations.read', 'vaccinations.create', 'vaccinations.update'
  )
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions granted
    WHERE granted.role_id = roles.id AND granted.permission_id = permissions.id
  );

INSERT INTO role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id FROM roles CROSS JOIN permissions
WHERE roles.name = 'ASV'
  AND permissions.permission_key IN (
    'medical_acts.read', 'prescriptions.read', 'vaccinations.read', 'vaccinations.create'
  )
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions granted
    WHERE granted.role_id = roles.id AND granted.permission_id = permissions.id
  );