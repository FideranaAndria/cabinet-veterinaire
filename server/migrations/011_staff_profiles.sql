CREATE TABLE IF NOT EXISTS staff_profiles (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  staff_number VARCHAR(40) NOT NULL,
  staff_type ENUM('VETERINARIAN', 'VET_ASSISTANT', 'ASV', 'ADMINISTRATIVE', 'LABORATORY') NOT NULL,
  specialty VARCHAR(180) NULL,
  qualification VARCHAR(255) NULL,
  phone VARCHAR(40) NULL,
  hired_on DATE NULL,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY uq_staff_user (user_id), UNIQUE KEY uq_staff_number (staff_number),
  KEY idx_staff_type_status (staff_type, status),
  CONSTRAINT fk_staff_profile_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO permissions (permission_key, description) VALUES
  ('staff.read', 'Consulter les profils du personnel'),
  ('staff.write', 'Gérer les profils du personnel');

INSERT INTO role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id FROM roles CROSS JOIN permissions
WHERE roles.name IN ('ADMIN', 'DIRECTION')
  AND permissions.permission_key IN ('staff.read', 'staff.write')
  AND NOT EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.role_id = roles.id AND rp.permission_id = permissions.id);

INSERT INTO role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id FROM roles CROSS JOIN permissions
WHERE roles.name IN ('VETERINAIRE', 'VETERINAIRE_ASSISTANT', 'ASV', 'ASSISTANT_ADMINISTRATIF')
  AND permissions.permission_key = 'staff.read'
  AND NOT EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.role_id = roles.id AND rp.permission_id = permissions.id);
