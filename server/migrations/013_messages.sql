CREATE TABLE IF NOT EXISTS messages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  sender_id BIGINT UNSIGNED NOT NULL,
  recipient_id BIGINT UNSIGNED NOT NULL,
  subject VARCHAR(180) NOT NULL,
  content TEXT NOT NULL,
  read_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_messages_recipient_inbox (recipient_id, read_at, created_at),
  KEY idx_messages_sender (sender_id, created_at),
  CONSTRAINT fk_messages_sender FOREIGN KEY (sender_id) REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT fk_messages_recipient FOREIGN KEY (recipient_id) REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT chk_messages_distinct_users CHECK (sender_id <> recipient_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO permissions (permission_key, description) VALUES
  ('messages.read', 'Consulter les messages reçus ou envoyés'),
  ('messages.create', 'Envoyer un message interne'),
  ('messages.update', 'Marquer ses messages comme lus');

INSERT INTO role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id FROM roles CROSS JOIN permissions
WHERE roles.name IN ('ADMIN', 'DIRECTION', 'VETERINAIRE', 'VETERINAIRE_ASSISTANT', 'ASV', 'ASSISTANT_ADMINISTRATIF', 'LABORATOIRE')
  AND permissions.permission_key IN ('messages.read', 'messages.create', 'messages.update')
  AND NOT EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.role_id = roles.id AND rp.permission_id = permissions.id);
