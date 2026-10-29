CREATE TABLE IF NOT EXISTS appointments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  client_id BIGINT UNSIGNED NOT NULL,
  animal_id BIGINT UNSIGNED NOT NULL,
  veterinarian_id BIGINT UNSIGNED NOT NULL,
  starts_at DATETIME NOT NULL,
  ends_at DATETIME NOT NULL,
  reason VARCHAR(255) NOT NULL,
  status ENUM('PLANIFIE', 'CONFIRME', 'EN_COURS', 'REALISE', 'ANNULE', 'REPORTE') NOT NULL DEFAULT 'PLANIFIE',
  is_emergency BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_appointments_vet_schedule (veterinarian_id, starts_at, ends_at, status),
  KEY idx_appointments_animal_schedule (animal_id, starts_at, ends_at, status),
  KEY idx_appointments_client_start (client_id, starts_at),
  KEY idx_appointments_start_status (starts_at, status),
  CONSTRAINT chk_appointments_time CHECK (ends_at > starts_at),
  CONSTRAINT fk_appointments_client FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE RESTRICT,
  CONSTRAINT fk_appointments_animal FOREIGN KEY (animal_id) REFERENCES animals (id) ON DELETE RESTRICT,
  CONSTRAINT fk_appointments_veterinarian FOREIGN KEY (veterinarian_id) REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT fk_appointments_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS consultations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  appointment_id BIGINT UNSIGNED NOT NULL,
  client_id BIGINT UNSIGNED NOT NULL,
  animal_id BIGINT UNSIGNED NOT NULL,
  veterinarian_id BIGINT UNSIGNED NOT NULL,
  consulted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reason VARCHAR(255) NOT NULL,
  clinical_exam TEXT NULL,
  temperature_c DECIMAL(4,1) NULL,
  heart_rate_bpm SMALLINT UNSIGNED NULL,
  respiratory_rate_bpm SMALLINT UNSIGNED NULL,
  weight_kg DECIMAL(7,3) NULL,
  observations TEXT NULL,
  diagnosis TEXT NULL,
  recommendations TEXT NULL,
  follow_up_at DATETIME NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_consultations_appointment (appointment_id),
  KEY idx_consultations_animal_date (animal_id, consulted_at),
  KEY idx_consultations_client_date (client_id, consulted_at),
  KEY idx_consultations_vet_date (veterinarian_id, consulted_at),
  CONSTRAINT chk_consultations_temperature CHECK (temperature_c IS NULL OR temperature_c BETWEEN 20 AND 50),
  CONSTRAINT chk_consultations_weight CHECK (weight_kg IS NULL OR weight_kg > 0),
  CONSTRAINT fk_consultations_appointment FOREIGN KEY (appointment_id) REFERENCES appointments (id) ON DELETE RESTRICT,
  CONSTRAINT fk_consultations_client FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE RESTRICT,
  CONSTRAINT fk_consultations_animal FOREIGN KEY (animal_id) REFERENCES animals (id) ON DELETE RESTRICT,
  CONSTRAINT fk_consultations_veterinarian FOREIGN KEY (veterinarian_id) REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT fk_consultations_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO permissions (permission_key, description) VALUES
  ('appointments.read', 'Consulter les rendez-vous'),
  ('appointments.create', 'Créer les rendez-vous'),
  ('appointments.update', 'Modifier les rendez-vous'),
  ('appointments.status', 'Modifier le statut des rendez-vous'),
  ('consultations.read', 'Consulter les dossiers de consultation'),
  ('consultations.create', 'Créer les consultations'),
  ('consultations.update', 'Modifier les consultations');

INSERT INTO role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id
FROM roles
CROSS JOIN permissions
WHERE roles.name IN ('ADMIN', 'DIRECTION')
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions granted
    WHERE granted.role_id = roles.id AND granted.permission_id = permissions.id
  );

INSERT INTO role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id
FROM roles
JOIN permissions ON permissions.permission_key IN (
  'appointments.read', 'appointments.create', 'appointments.update', 'appointments.status',
  'consultations.read', 'consultations.create', 'consultations.update'
)
WHERE roles.name IN ('VETERINAIRE', 'VETERINAIRE_ASSISTANT', 'ASV')
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions granted
    WHERE granted.role_id = roles.id AND granted.permission_id = permissions.id
  );

INSERT INTO role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id
FROM roles
JOIN permissions ON permissions.permission_key IN (
  'appointments.read', 'appointments.create', 'appointments.update', 'appointments.status'
)
WHERE roles.name = 'ASSISTANT_ADMINISTRATIF'
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions granted
    WHERE granted.role_id = roles.id AND granted.permission_id = permissions.id
  );