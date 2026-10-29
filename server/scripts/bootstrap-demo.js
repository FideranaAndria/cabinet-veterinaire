import { pool } from '../src/db/pool.js';
import bcrypt from 'bcryptjs';

const hash = (password) => {
  const h = bcrypt.hashSync(password, 12);
  // Vérification immédiate : le hash doit matcher
  if (!bcrypt.compareSync(password, h)) {
    throw new Error(`Hash invalide pour "${password}"`);
  }
  return h;
};

async function bootstrapDemo() {
  console.log('🌱 Démarrage du seed de démonstration...\n');
  const connection = await pool.getConnection();

  try {
    // --- 1. NETTOYAGE (ordre inverse des FK) ---
    console.log('🧹 Nettoyage des tables...');
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    const tables = [
  'invoice_payments', 'invoice_lines', 'invoices',
  'consultations', 'appointments', 'vaccinations',
  'client_animal', 'animals', 'clients',
  'inventory_movements', 'service_prices', 'products',
  'user_roles', 'user_sessions', 'staff_profiles','notifications', 'audit_logs',
  'users',
];
    for (const t of tables) {
      await connection.query(`TRUNCATE TABLE ${t}`);
    }
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('✓ Tables nettoyées\n');


    // --- 2. UTILISATEURS ---
    console.log('👥 Création des utilisateurs...');
    const usersData = [
      ['admin@cabinet.com',       hash('Admin123!'),    'Admin',     'Système'],
      ['direction@cabinet.com',   hash('Direction123!'), 'Sophie',    'Rakoto'],
      ['vet1@cabinet.com',        hash('Vet123!'),      'Jean',      'Dupont'],
      ['vet2@cabinet.com',        hash('Vet123!'),      'Marie',     'Martin'],
      ['asv@cabinet.com',         hash('Asv123!'),      'Lucie',     'Bernard'],
      ['accueil@cabinet.com',     hash('Accueil123!'),  'Paul',      'Randria'],
    ];
    await connection.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, is_active) VALUES ?`,
      [usersData.map(u => [...u, 1])]
    );
    console.log(`✓ ${usersData.length} utilisateurs créés\n`);

    // --- 3. RÔLES (user_roles) ---
    console.log('🔑 Attribution des rôles...');
    // role_id : 1=ADMIN, 2=DIRECTION, 3=VETERINAIRE, 4=VET_ASSISTANT, 5=ASV, 6=ASSISTANT_ADMIN
    const userRoles = [
      [1, 1], // admin → ADMIN
      [2, 2], // direction → DIRECTION
      [3, 3], // Jean → VETERINAIRE
      [4, 3], // Marie → VETERINAIRE
      [5, 5], // Lucie → ASV
      [6, 6], // Paul → ASSISTANT_ADMINISTRATIF
    ];
    await connection.query(`INSERT INTO user_roles (user_id, role_id) VALUES ?`, [userRoles]);
    console.log(`✓ ${userRoles.length} rôles attribués\n`);

    // --- 4. PROFILS DU PERSONNEL ---
    console.log('📋 Création des profils staff...');
    const staff = [
      [3, 'STAFF-001', 'VETERINARIAN',  'Chirurgie',       'Dr vétérinaire',     '0341111111', '2020-03-01'],
      [4, 'STAFF-002', 'VETERINARIAN',  'Dermatologie',    'Dr vétérinaire',     '0342222222', '2021-06-15'],
      [5, 'STAFF-003', 'ASV',           'Soins',           'BTS ASV',            '0343333333', '2022-01-10'],
      [6, 'STAFF-004', 'ADMINISTRATIVE', null,              'Bac +2',             '0344444444', '2023-09-01'],
    ];
    await connection.query(
      `INSERT INTO staff_profiles (user_id, staff_number, staff_type, specialty, qualification, phone, hired_on, status) VALUES ?`,
      [staff.map(s => [...s, 'active'])]
    );
    console.log(`✓ ${staff.length} profils créés\n`);

    // --- 5. CLIENTS ---
    console.log('🧑 Création des clients...');
    const clients = [
      ['CLI-2026-001', 'Alice',   'Bernard',  '1985-04-12', 'female', 'alice.bernard@example.com',  '0341111111', '12 rue des Fleurs',  '101', 'Antananarivo', 'CARD',   'email', 1, 0, 'active'],
      ['CLI-2026-002', 'Bob',     'Rakoto',   '1990-09-25', 'male',   'bob.rakoto@example.com',     '0342222222', '45 avenue de l\'Indépendance', '101', 'Antananarivo', 'CASH',   'sms',   1, 1, 'active'],
      ['CLI-2026-003', 'Claire',  'Randria',  '1978-12-03', 'female', 'claire.randria@example.com', '0343333333', '8 lotissement Ivandry', '101', 'Antananarivo', 'CARD',   'phone', 1, 0, 'active'],
      ['CLI-2026-004', 'David',   'Rasoanaivo','1995-07-18','male',   'david.r@example.com',        '0344444444', '22 rue Ambohijatovo', '101', 'Antananarivo', 'CASH',   'email', 1, 0, 'active'],
      ['CLI-2026-005', 'Emma',    'Andria',   '1988-02-14', 'female', 'emma.andria@example.com',    '0345555555', '5 rue Analakely',     '101', 'Antananarivo', 'TRANSFER','email', 1, 1, 'active'],
      ['CLI-2026-006', 'Franck',  'Rabe',     '1982-11-30', 'male',   'franck.rabe@example.com',    '0346666666', '18 avenue de France', '101', 'Antananarivo', 'CARD',   'phone', 1, 0, 'active'],
      ['CLI-2026-007', 'Gaelle',  'Razafy',   '1992-06-08', 'female', 'gaelle.razafy@example.com',  '0347777777', '7 rue Andoharanofotsy','101','Antananarivo', 'CASH',   'sms',   1, 0, 'active'],
      ['CLI-2026-008', 'Hery',    'Ratsimba', '1975-03-22', 'male',   'hery.ratsimba@example.com',  '0348888888', '30 rue Ankadifotsy',  '101', 'Antananarivo', 'CARD',   'email', 1, 0, 'active'],
      ['CLI-2026-009', 'Irina',   'Rakotondra','1998-08-05','female', 'irina.rk@example.com',       '0349999999', '15 rue Isoraka',      '101', 'Antananarivo', 'CASH',   'phone', 1, 0, 'active'],
      ['CLI-2026-010', 'Jacques', 'Ramanana', '1980-01-17', 'male',   'jacques.ramanana@example.com','0341010101','25 rue Antanimena',   '101', 'Antananarivo', 'TRANSFER','email', 1, 1, 'active'],
    ];
    await connection.query(
      `INSERT INTO clients (client_number, first_name, last_name, date_of_birth, sex, email, phone, address_line, postal_code, city, payment_method, preferred_contact, consent_personal_data, consent_marketing, status, created_by) VALUES ?`,
      [clients.map(c => [...c, 3])]
    );
    console.log(`✓ ${clients.length} clients créés\n`);

    // --- 6. ANIMAUX ---
    console.log('🐾 Création des animaux...');
    const animals = [
      ['Rex',    'chien',  'Berger Allemand',   'male',   '2020-05-15', 'CHIP-2020-REX',   'Noir et feu', '32.500', 'active'],
      ['Minou',  'chat',   'Siamois',            'female', '2021-08-20', 'CHIP-2021-MIN',   'Crème',       '4.200',  'active'],
      ['Boby',   'chien',  'Labrador',           'male',   '2019-03-10', 'CHIP-2019-BOB',   'Doré',        '35.000', 'active'],
      ['Luna',   'chat',   'Européen',           'female', '2022-01-12', 'CHIP-2022-LUN',   'Tigré',       '3.800',  'active'],
      ['Max',    'chien',  'Golden Retriever',  'male',   '2021-11-03', 'CHIP-2021-MAX',   'Doré',        '30.200', 'active'],
      ['Bella',  'chien',  'Caniche',            'female', '2023-02-28', 'CHIP-2023-BEL',   'Blanc',       '6.500',  'active'],
      ['Kiwi',   'oiseau', 'Perruche',           'female', '2022-09-15', 'BAGUE-KIWI-22',   'Verte',       '0.090',  'active'],
      ['Nala',   'chat',   'Maine Coon',         'female', '2020-12-01', 'CHIP-2020-NAL',   'Roux',        '6.800',  'active'],
      ['Coco',   'lapin',  'Nain',               'male',   '2023-04-10', 'BAGUE-COCO-23',   'Gris',        '1.400',  'active'],
      ['Simba',  'chat',   'Bengal',             'male',   '2021-05-22', 'CHIP-2021-SIM',   'Tacheté',     '5.300',  'active'],
      ['Pilou',  'chien',  'Chihuahua',          'male',   '2022-07-18', 'CHIP-2022-PIL',   'Beige',       '2.800',  'active'],
      ['Zoé',    'chien',  'Husky',              'female', '2020-10-05', 'CHIP-2020-ZOE',   'Gris et blanc','24.500','active'],
    ];
    await connection.query(
      `INSERT INTO animals (name, species, breed, sex, date_of_birth, microchip_number, color, weight_kg, status, created_by) VALUES ?`,
      [animals.map(a => [...a, 3])]
    );
    console.log(`✓ ${animals.length} animaux créés\n`);

    // --- 7. LIAISON CLIENT ↔ ANIMAL ---
    console.log('🔗 Liaison clients ↔ animaux...');
    const clientAnimalLinks = [
      [1, 1, 'owner', '2024-01-01 00:00:00'],
      [1, 2, 'owner', '2024-01-01 00:00:00'],
      [2, 3, 'owner', '2024-02-15 00:00:00'],
      [3, 4, 'owner', '2024-03-20 00:00:00'],
      [3, 5, 'owner', '2024-03-20 00:00:00'],
      [4, 6, 'owner', '2024-04-10 00:00:00'],
      [5, 7, 'owner', '2024-05-05 00:00:00'],
      [6, 8, 'owner', '2024-06-12 00:00:00'],
      [7, 9, 'owner', '2024-07-18 00:00:00'],
      [8, 10, 'owner', '2024-08-22 00:00:00'],
      [9, 11, 'owner', '2024-09-30 00:00:00'],
      [10, 12, 'owner', '2024-10-15 00:00:00'],
    ];
    await connection.query(
      `INSERT INTO client_animal (client_id, animal_id, relationship_type, valid_from) VALUES ?`,
      [clientAnimalLinks]
    );
    console.log(`✓ ${clientAnimalLinks.length} liaisons créées\n`);

    // --- 8. RENDEZ-VOUS ---
    console.log('📅 Création des rendez-vous...');
    const appointments = [
      [1, 1, 3, '2026-10-20 10:00:00', '2026-10-20 10:30:00', 'Vaccination annuelle',           'CONFIRME', 0, 3],
      [1, 2, 3, '2026-10-20 11:00:00', '2026-10-20 11:30:00', 'Consultation dermatologique',    'PLANIFIE', 0, 3],
      [2, 3, 4, '2026-10-21 14:30:00', '2026-10-21 15:00:00', 'Contrôle post-opératoire',       'CONFIRME', 0, 3],
      [3, 4, 3, '2026-10-22 09:00:00', '2026-10-22 09:30:00', 'Stérilisation',                  'PLANIFIE', 0, 3],
      [3, 5, 4, '2026-10-22 10:00:00', '2026-10-22 10:30:00', 'Vaccination rage',               'CONFIRME', 0, 3],
      [4, 6, 3, '2026-10-23 15:00:00', '2026-10-23 15:30:00', 'Boiterie patte arrière',         'PLANIFIE', 0, 3],
      [5, 7, 4, '2026-10-24 10:00:00', '2026-10-24 10:30:00', 'Examen annuel',                  'CONFIRME', 0, 3],
      [6, 8, 3, '2026-10-24 14:00:00', '2026-10-24 14:30:00', 'Toilettage médical',             'PLANIFIE', 0, 3],
      [7, 9, 4, '2026-10-25 09:30:00', '2026-10-25 10:00:00', 'Consultation digestive',         'CONFIRME', 0, 3],
      [8, 10, 3, '2026-10-25 11:00:00', '2026-10-25 11:30:00', 'Suivi vaccinal',                 'PLANIFIE', 0, 3],
      [9, 11, 4, '2026-10-26 14:00:00', '2026-10-26 14:30:00', 'Consultation urgente',           'CONFIRME', 1, 3],
      [10, 12, 3, '2026-10-26 16:00:00', '2026-10-26 16:30:00', 'Bilan de santé',                 'PLANIFIE', 0, 3],
    ];
    await connection.query(
      `INSERT INTO appointments (client_id, animal_id, veterinarian_id, starts_at, ends_at, reason, status, is_emergency, created_by) VALUES ?`,
      [appointments]
    );
    console.log(`✓ ${appointments.length} rendez-vous créés\n`);

    // --- 9. CONSULTATIONS (sur les RDV passés) ---
    console.log('🩺 Création des consultations...');
    const consultations = [
      [1, 1, 1, 3, '2026-10-15 10:15:00', 'Vaccination annuelle',    'Bon état général. Animal vif et alerte.',        '38.5', 90,  20, 32.5, 'Aucune anomalie', 'RAS', 'Revenir dans 1 an', 1],
      [3, 2, 3, 4, '2026-10-16 14:35:00', 'Contrôle post-opératoire', 'Cicatrisation en bonne voie.',                  '38.2', 100, 22, 35.0, 'Légère inflammation', 'Guérison normale', 'Poursuivre antibiotique 3 jours', 3],
      [5, 3, 5, 4, '2026-10-17 10:20:00', 'Vaccination rage',         'Animal calme, injection bien tolérée.',         '38.8', 95,  25, 30.2, 'RAS', 'Vaccination effectuée', 'Rappel dans 1 an', 5],
    ];
    await connection.query(
      `INSERT INTO consultations (appointment_id, client_id, animal_id, veterinarian_id, consulted_at, reason, clinical_exam, temperature_c, heart_rate_bpm, respiratory_rate_bpm, weight_kg, observations, diagnosis, recommendations, created_by) VALUES ?`,
      [consultations]
    );
    console.log(`✓ ${consultations.length} consultations créées\n`);

    // --- 10. PRODUITS / STOCK ---
    console.log('📦 Création des produits...');
    const products = [
      ['MED-001', 'Amoxicilline 500mg',        'Antibiotique',   'Boîte de 12 comprimés',   'boîte', 8.50,  15.00,  45, 10, 3],
      ['MED-002', 'Vermifuge chien 10kg',      'Antiparasitaire','Comprimé',                'comprimé', 3.20, 6.50, 120, 20, 3],
      ['MED-003', 'Vaccin rage',               'Vaccin',         'Flacon 1 dose',           'dose', 12.00, 25.00, 30, 5, 3],
      ['MED-004', 'Vaccin CHPP',               'Vaccin',         'Flacon 1 dose',           'dose', 15.00, 30.00, 25, 5, 3],
      ['MED-005', 'Antipuce spray 250ml',      'Antiparasitaire','Spray',                   'flacon', 14.00, 22.00, 18, 5, 3],
      ['MED-006', 'Croquettes chien 15kg',     'Alimentation',   'Sac 15kg',                'sac', 35.00, 55.00, 12, 3, 3],
      ['MED-007', 'Croquettes chat 4kg',       'Alimentation',   'Sac 4kg',                 'sac', 18.00, 28.00, 20, 5, 3],
      ['MED-008', 'Shampooing antiparasitaire','Hygiène',        'Flacon 250ml',            'flacon', 9.00, 15.00, 22, 5, 3],
    ];
    await connection.query(
      `INSERT INTO products (sku, name, category, description, unit, purchase_price, sale_price, stock_quantity, stock_alert_threshold, created_by) VALUES ?`,
      [products]
    );
    console.log(`✓ ${products.length} produits créés\n`);

    // --- 11. FACTURES ---
    console.log('💰 Création des factures...');
    const invoices = [
      [1, 1, 'INV-2026-0001', '2026-10-15', '2026-11-15', 'PAID',           50.00,  50.00, 0.00,  3],
      [2, 3, 'INV-2026-0002', '2026-10-16', '2026-11-16', 'SENT',           85.00,  0.00,  85.00, 3],
      [3, 4, 'INV-2026-0003', '2026-10-17', '2026-11-17', 'PARTIALLY_PAID', 120.00, 60.00, 60.00, 3],
    ];
    await connection.query(
      `INSERT INTO invoices (client_id, animal_id, invoice_number, issue_date, due_date, status, total_amount, paid_amount, balance_amount, created_by) VALUES ?`,
      [invoices]
    );
    console.log(`✓ ${invoices.length} factures créées\n`);

    // --- 12. LIGNES DE FACTURE ---
    const invoiceLines = [
      [1, 'Consultation annuelle',       1, 25.00, 20.00, 25.00],
      [1, 'Vaccin rage',                 1, 25.00, 20.00, 25.00],
      [2, 'Consultation dermatologique', 1, 40.00, 20.00, 40.00],
      [2, 'Antipuce spray',              1, 22.00, 20.00, 22.00],
      [2, 'Shampooing',                  1, 15.00, 20.00, 15.00],
      [2, 'Croquettes chien 15kg',       1, 55.00, 20.00, 55.00],
      [3, 'Stérilisation chat',          1, 90.00, 20.00, 90.00],
      [3, 'Médicament post-op',          2, 15.00, 20.00, 30.00],
    ];
    await connection.query(
      `INSERT INTO invoice_lines (invoice_id, description, quantity, unit_price, vat_rate, line_total) VALUES ?`,
      [invoiceLines]
    );
    console.log(`✓ ${invoiceLines.length} lignes de facture créées\n`);

    // --- 13. PAIEMENTS ---
    const payments = [
      [1, 50.00, 'CARD', '2026-10-15 11:00:00', 3],
      [3, 60.00, 'CASH', '2026-10-17 15:00:00', 3],
    ];
    await connection.query(
      `INSERT INTO invoice_payments (invoice_id, amount, payment_method, paid_at, created_by) VALUES ?`,
      [payments]
    );
    console.log(`✓ ${payments.length} paiements créés\n`);

// --- 14. NOTIFICATIONS ---
console.log('🔔 Création des notifications...');
await connection.query(
  `INSERT INTO notifications (user_id, type, title, message) VALUES ?`,
  [[
    [3, 'appointment.created', 'Nouveau rendez-vous', 'Un rendez-vous est prévu demain à 10h pour Rex.'],
    [3, 'stock.alert', 'Alerte de stock', 'Le produit Amoxicilline est en rupture de stock.'],
    [6, 'invoice.unpaid', 'Facture impayée', 'La facture INV-2026-0002 est en retard de paiement.'],
    [6, 'invoice.paid', 'Paiement reçu', 'Le client a réglé la facture INV-2026-0001.'],
    [1, 'system.update', 'Mise à jour', 'Le système a été mis à jour avec succès.'],
  ]]
);
console.log('✓ 5 notifications créées\n');

    // --- RÉSUMÉ ---
    console.log('═══════════════════════════════════════════════════');
    console.log('🎉 SEED TERMINÉ AVEC SUCCÈS !');
    console.log('═══════════════════════════════════════════════════');
    console.log('\n📋 IDENTIFIANTS DE CONNEXION :\n');
    console.log('  👤 Admin       : admin@cabinet.com       / Admin123!');
    console.log('  👤 Direction   : direction@cabinet.com   / Direction123!');
    console.log('  👨‍⚕️  Vétérinaire : vet1@cabinet.com        / Vet123!');
    console.log('  👨‍⚕️  Vétérinaire : vet2@cabinet.com        / Vet123!');
    console.log('  👩‍⚕️  ASV         : asv@cabinet.com         / Asv123!');
    console.log('  💼 Accueil     : accueil@cabinet.com     / Accueil123!');
    console.log('\n📊 DONNÉES CRÉÉES :');
    console.log(`  • ${usersData.length} utilisateurs`);
    console.log(`  • ${clients.length} clients`);
    console.log(`  • ${animals.length} animaux`);
    console.log(`  • ${appointments.length} rendez-vous`);
    console.log(`  • ${consultations.length} consultations`);
    console.log(`  • ${products.length} produits`);
    console.log(`  • ${invoices.length} factures`);
    console.log('═══════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Erreur durant le seed :', error.message);
    console.error(error);
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

bootstrapDemo();