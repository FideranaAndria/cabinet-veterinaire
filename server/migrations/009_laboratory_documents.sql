CREATE TABLE IF NOT EXISTS laboratory_requests (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  client_id BIGINT UNSIGNED NOT NULL,
  animal_id BIGINT UNSIGNED NOT NULL,
  consultation_id BIGINT UNSIGNED NULL,
  veterinarian_id BIGINT UNSIGNED NOT NULL,
  analysis_type VARCHAR(180) NOT NULL,
  laboratory_name VARCHAR(180) NULL,
  requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
  result TEXT NULL,
  document_reference VARCHAR(500) NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  completed_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_laboratory_animal_date (animal_id, requested_at),
  KEY idx_laboratory_status_date (status, requested_at),
  CONSTRAINT fk_laboratory_client FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE RESTRICT,
  CONSTRAINT fk_laboratory_animal FOREIGN KEY (animal_id) REFERENCES animals (id) ON DELETE RESTRICT,
  CONSTRAINT fk_laboratory_consultation FOREIGN KEY (consultation_id) REFERENCES consultations (id) ON DELETE RESTRICT,
  CONSTRAINT fk_laboratory_veterinarian FOREIGN KEY (veterinarian_id) REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT fk_laboratory_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS documents (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  client_id BIGINT UNSIGNED NULL,
  animal_id BIGINT UNSIGNED NULL,
  consultation_id BIGINT UNSIGNED NULL,
  hospitalization_id BIGINT UNSIGNED NULL,
  category ENUM('MEDICAL', 'ADMINISTRATIVE', 'LABORATORY', 'BILLING', 'OTHER') NOT NULL DEFAULT 'OTHER',
  file_name VARCHAR(255) NOT NULL,
  storage_key VARCHAR(500) NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  size_bytes BIGINT UNSIGNED NOT NULL,
  description VARCHAR(1000) NULL,
  uploaded_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_documents_client_date (client_id, created_at),
  KEY idx_documents_animal_date (animal_id, created_at),
  KEY idx_documents_category_date (category, created_at),
  CONSTRAINT fk_documents_client FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE RESTRICT,
  CONSTRAINT fk_documents_animal FOREIGN KEY (animal_id) REFERENCES animals (id) ON DELETE RESTRICT,
  CONSTRAINT fk_documents_consultation FOREIGN KEY (consultation_id) REFERENCES consultations (id) ON DELETE RESTRICT,
  CONSTRAINT fk_documents_hospitalization FOREIGN KEY (hospitalization_id) REFERENCES hospitalizations (id) ON DELETE RESTRICT,
  CONSTRAINT fk_documents_uploaded_by FOREIGN KEY (uploaded_by) REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT chk_documents_parent CHECK (client_id IS NOT NULL OR animal_id IS NOT NULL OR consultation_id IS NOT NULL OR hospitalization_id IS NOT NULL),
  CONSTRAINT chk_documents_size CHECK (size_bytes > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO permissions (permission_key, description) VALUES
  ('laboratory.read', 'Consulter les demandes et résultats d’analyses'),
  ('laboratory.create', 'Créer une demande d’analyse'),
  ('laboratory.update', 'Mettre à jour une demande et son résultat'),
  ('documents.read', 'Consulter les métadonnées des documents'),
  ('documents.create', 'Enregistrer un document');

INSERT INTO role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id FROM roles CROSS JOIN permissions
WHERE roles.name IN ('ADMIN', 'DIRECTION', 'VETERINAIRE', 'VETERINAIRE_ASSISTANT', 'ASV', 'LABORATOIRE')
  AND permissions.permission_key IN ('laboratory.read', 'documents.read')
  AND NOT EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.role_id = roles.id AND rp.permission_id = permissions.id);

INSERT INTO role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id FROM roles CROSS JOIN permissions
WHERE roles.name IN ('ADMIN', 'DIRECTION', 'VETERINAIRE', 'VETERINAIRE_ASSISTANT')
  AND permissions.permission_key IN ('laboratory.create', 'laboratory.update', 'documents.create')
  AND NOT EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.role_id = roles.id AND rp.permission_id = permissions.id);
