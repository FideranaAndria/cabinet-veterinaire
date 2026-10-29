CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NULL,
  action VARCHAR(120) NOT NULL,
  entity_type VARCHAR(120) NOT NULL,
  entity_id VARCHAR(120) NULL,
  details JSON NULL,
  ip_address VARCHAR(45) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_audit_logs_user_created (user_id, created_at),
  KEY idx_audit_logs_entity (entity_type, entity_id, created_at),
  CONSTRAINT fk_audit_logs_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  type VARCHAR(80) NOT NULL,
  title VARCHAR(180) NOT NULL,
  message TEXT NOT NULL,
  entity_type VARCHAR(120) NULL,
  entity_id VARCHAR(120) NULL,
  read_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_notifications_user_unread (user_id, read_at, created_at),
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO permissions (permission_key, description) VALUES
  ('audit.read', 'Consulter le journal des actions'),
  ('dashboard.read', 'Consulter les indicateurs du cabinet'),
  ('notifications.read', 'Consulter ses notifications'),
  ('notifications.update', 'Marquer ses notifications comme lues');

INSERT INTO role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id FROM roles CROSS JOIN permissions
WHERE roles.name IN ('ADMIN', 'DIRECTION') AND permissions.permission_key = 'audit.read'
  AND NOT EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.role_id = roles.id AND rp.permission_id = permissions.id);

INSERT INTO role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id FROM roles CROSS JOIN permissions
WHERE roles.name IN ('ADMIN', 'DIRECTION', 'VETERINAIRE', 'VETERINAIRE_ASSISTANT', 'ASV', 'ASSISTANT_ADMINISTRATIF')
  AND permissions.permission_key = 'dashboard.read'
  AND NOT EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.role_id = roles.id AND rp.permission_id = permissions.id);

INSERT INTO role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id FROM roles CROSS JOIN permissions
WHERE roles.name IN ('ADMIN', 'DIRECTION', 'VETERINAIRE', 'VETERINAIRE_ASSISTANT', 'ASV', 'ASSISTANT_ADMINISTRATIF')
  AND permissions.permission_key IN ('notifications.read', 'notifications.update')
  AND NOT EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.role_id = roles.id AND rp.permission_id = permissions.id);
