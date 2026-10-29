-- 1. Catalogue de tarifs
CREATE TABLE service_prices (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  service_code VARCHAR(80) NOT NULL,
  label VARCHAR(255) NOT NULL,
  category ENUM(
    'CONSULTATION', 'ACTE_MEDICAL', 'ACTE_CHIRURGICAL',
    'VACCINATION', 'HOSPITALISATION', 'ANALYSE',
    'DOCUMENT', 'AUTRE'
  ) NOT NULL DEFAULT 'AUTRE',
  description TEXT DEFAULT NULL,
  price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  vat_rate DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  unit VARCHAR(40) NOT NULL DEFAULT 'unité',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_service_prices_code (service_code),
  KEY idx_service_prices_category (category, is_active),
  CONSTRAINT fk_service_prices_created_by FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Lien facture ↔ consultation
ALTER TABLE invoices
  ADD COLUMN consultation_id BIGINT UNSIGNED NULL AFTER animal_id,
  ADD CONSTRAINT fk_invoices_consultation
    FOREIGN KEY (consultation_id) REFERENCES consultations(id);

-- 3. Lien ligne facture ↔ acte médical ↔ produit ↔ tarif
ALTER TABLE invoice_lines
  ADD COLUMN medical_act_id BIGINT UNSIGNED NULL AFTER invoice_id,
  ADD COLUMN product_id BIGINT UNSIGNED NULL AFTER medical_act_id,
  ADD COLUMN service_price_id BIGINT UNSIGNED NULL AFTER product_id,
  ADD CONSTRAINT fk_invoice_lines_medical_act
    FOREIGN KEY (medical_act_id) REFERENCES medical_acts(id),
  ADD CONSTRAINT fk_invoice_lines_product
    FOREIGN KEY (product_id) REFERENCES products(id),
  ADD CONSTRAINT fk_invoice_lines_service_price
    FOREIGN KEY (service_price_id) REFERENCES service_prices(id);

-- 4. Lien document ↔ facture
ALTER TABLE documents
  ADD COLUMN invoice_id BIGINT UNSIGNED NULL AFTER consultation_id,
  ADD CONSTRAINT fk_documents_invoice
    FOREIGN KEY (invoice_id) REFERENCES invoices(id);

-- 5. Index utiles
ALTER TABLE invoices
  ADD KEY idx_invoices_status_due (status, due_date);