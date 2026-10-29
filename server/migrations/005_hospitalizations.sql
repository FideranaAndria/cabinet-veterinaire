CREATE TABLE IF NOT EXISTS hospitalizations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  animal_id BIGINT UNSIGNED NOT NULL,
  client_id BIGINT UNSIGNED NOT NULL,
  veterinarian_id BIGINT UNSIGNED NOT NULL,
  ward_name VARCHAR(160) NOT NULL,
  reason TEXT NOT NULL,
  status ENUM('ADMITTED', 'OBSERVATION', 'DISCHARGED', 'CANCELLED') NOT NULL DEFAULT 'ADMITTED',
  admitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expected_discharge_at DATETIME NULL,
  discharged_at DATETIME NULL,
  notes TEXT NULL,
  discharge_notes TEXT NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_hospitalizations_animal_status (animal_id, status, admitted_at),
  KEY idx_hospitalizations_client_status (client_id, status, admitted_at),
  CONSTRAINT fk_hospitalizations_animal FOREIGN KEY (animal_id) REFERENCES animals (id) ON DELETE RESTRICT,
  CONSTRAINT fk_hospitalizations_client FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE RESTRICT,
  CONSTRAINT fk_hospitalizations_veterinarian FOREIGN KEY (veterinarian_id) REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT fk_hospitalizations_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT chk_hospitalizations_expected_discharge CHECK (expected_discharge_at IS NULL OR expected_discharge_at >= admitted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS hospitalization_follow_ups (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  hospitalization_id BIGINT UNSIGNED NOT NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  recorded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  title VARCHAR(180) NOT NULL,
  notes TEXT NULL,
  vital_signs TEXT NULL,
  care_plan TEXT NULL,
  next_step TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_hospitalization_follow_ups_hospitalization (hospitalization_id, recorded_at),
  CONSTRAINT fk_follow_ups_hospitalization FOREIGN KEY (hospitalization_id) REFERENCES hospitalizations (id) ON DELETE RESTRICT,
  CONSTRAINT fk_follow_ups_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO permissions (permission_key, description) VALUES
  ('hospitalizations.read', 'Consulter les hospitalisations'),
  ('hospitalizations.create', 'Créer une hospitalisation'),
  ('hospitalizations.update', 'Mettre à jour une hospitalisation');

INSERT INTO role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id
FROM roles
JOIN permissions ON permissions.permission_key IN (
  'hospitalizations.read', 'hospitalizations.create', 'hospitalizations.update'
)
WHERE roles.name IN ('ADMIN', 'DIRECTION', 'VETERINAIRE')
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions existing
    WHERE existing.role_id = roles.id AND existing.permission_id = permissions.id
  );

INSERT INTO role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id
FROM roles
JOIN permissions ON permissions.permission_key IN (
  'hospitalizations.read'
)
WHERE roles.name = 'ASV'
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions existing
    WHERE existing.role_id = roles.id AND existing.permission_id = permissions.id
  );
