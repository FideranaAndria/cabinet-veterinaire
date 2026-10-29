CREATE TABLE user_sessions (
  id CHAR(36) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  expires_at BIGINT UNSIGNED NOT NULL,
  revoked_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_user_sessions_user_active (user_id, revoked_at, expires_at),
  CONSTRAINT fk_user_sessions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE clients
  ADD COLUMN client_number VARCHAR(30) NULL AFTER id,
  ADD COLUMN date_of_birth DATE NULL AFTER last_name,
  ADD COLUMN sex ENUM('female', 'male', 'unknown') NOT NULL DEFAULT 'unknown' AFTER date_of_birth,
  ADD COLUMN payment_method VARCHAR(40) NULL AFTER city,
  ADD COLUMN preferred_contact ENUM('email', 'phone', 'sms', 'none') NOT NULL DEFAULT 'none' AFTER payment_method,
  ADD COLUMN consent_personal_data BOOLEAN NOT NULL DEFAULT FALSE AFTER preferred_contact,
  ADD COLUMN consent_marketing BOOLEAN NOT NULL DEFAULT FALSE AFTER consent_personal_data,
  ADD COLUMN status ENUM('active', 'archived') NOT NULL DEFAULT 'active' AFTER consent_marketing;

UPDATE clients SET client_number = CONCAT('CL-', LPAD(id, 8, '0')) WHERE client_number IS NULL;

ALTER TABLE clients
  MODIFY COLUMN client_number VARCHAR(30) NOT NULL,
  ADD UNIQUE KEY uq_clients_client_number (client_number);

ALTER TABLE animals
  ADD COLUMN tattoo_number VARCHAR(50) NULL AFTER microchip_number,
  ADD COLUMN icad_number VARCHAR(50) NULL AFTER tattoo_number,
  ADD COLUMN body_condition_score TINYINT UNSIGNED NULL AFTER weight_kg,
  ADD COLUMN medical_history TEXT NULL AFTER notes,
  ADD COLUMN allergies TEXT NULL AFTER medical_history,
  ADD COLUMN pathologies TEXT NULL AFTER allergies,
  ADD COLUMN current_treatments TEXT NULL AFTER pathologies,
  ADD COLUMN status ENUM('active', 'deceased', 'archived') NOT NULL DEFAULT 'active' AFTER current_treatments,
  ADD COLUMN deceased_at DATE NULL AFTER status,
  ADD COLUMN death_reason TEXT NULL AFTER deceased_at,
  ADD UNIQUE KEY uq_animals_icad_number (icad_number),
  ADD CONSTRAINT chk_animals_body_score CHECK (body_condition_score IS NULL OR body_condition_score BETWEEN 1 AND 9);

ALTER TABLE client_animal
  MODIFY COLUMN valid_from DATETIME(6) NOT NULL,
  MODIFY COLUMN valid_to DATETIME(6) NULL;

INSERT INTO permissions (permission_key, description) VALUES
  ('clients.read', 'Consulter les dossiers clients'),
  ('clients.create', 'Creer des dossiers clients'),
  ('clients.update', 'Modifier des dossiers clients'),
  ('clients.archive', 'Archiver des dossiers clients'),
  ('animals.read', 'Consulter les dossiers animaux'),
  ('animals.create', 'Creer des dossiers animaux'),
  ('animals.update', 'Modifier des dossiers animaux'),
  ('animals.archive', 'Archiver des dossiers animaux');

INSERT INTO role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id
FROM roles
CROSS JOIN permissions
WHERE roles.name IN ('ADMIN', 'DIRECTION');

INSERT INTO role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id
FROM roles
JOIN permissions ON permissions.permission_key IN (
  'clients.read', 'clients.create', 'clients.update',
  'animals.read', 'animals.create', 'animals.update'
)
WHERE roles.name IN ('VETERINAIRE', 'VETERINAIRE_ASSISTANT', 'ASV', 'ASSISTANT_ADMINISTRATIF');