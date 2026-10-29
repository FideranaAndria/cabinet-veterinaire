import { pool } from '../src/db/pool.js';

const services = [
  // Consultations
  ['CONS-001', 'Consultation générale', 'CONSULTATION', 'Examen clinique complet', 15.00, 0, 'acte'],
  ['CONS-002', 'Consultation urgente', 'CONSULTATION', 'Prise en charge urgente', 25.00, 0, 'acte'],
  ['CONS-003', 'Consultation spécialisée', 'CONSULTATION', 'Dermatologie, cardiologie...', 35.00, 0, 'acte'],

  // Actes médicaux
  ['ACT-001', 'Radiographie', 'ACTE_MEDICAL', 'Radio standard', 30.00, 0, 'acte'],
  ['ACT-002', 'Échographie', 'ACTE_MEDICAL', 'Échographie abdominale', 50.00, 0, 'acte'],
  ['ACT-003', 'Prise de sang', 'ACTE_MEDICAL', 'Analyse sanguine', 20.00, 0, 'acte'],
  ['ACT-004', 'Pose de cathéter', 'ACTE_MEDICAL', 'Voie veineuse', 15.00, 0, 'acte'],

  // Actes chirurgicaux
  ['CHIR-001', 'Stérilisation chat', 'ACTE_CHIRURGICAL', 'Ovario-hystérectomie', 90.00, 0, 'acte'],
  ['CHIR-002', 'Stérilisation chien', 'ACTE_CHIRURGICAL', 'Castration', 150.00, 0, 'acte'],
  ['CHIR-003', 'Détartrage', 'ACTE_CHIRURGICAL', 'Nettoyage dentaire', 80.00, 0, 'acte'],

  // Vaccinations
  ['VAC-001', 'Vaccin rage', 'VACCINATION', 'Rage (1 an)', 25.00, 0, 'dose'],
  ['VAC-002', 'Vaccin CHPP', 'VACCINATION', 'Chien (1 an)', 30.00, 0, 'dose'],
  ['VAC-003', 'Vaccin typhus', 'VACCINATION', 'Chat (1 an)', 28.00, 0, 'dose'],

  // Hospitalisation
  ['HOSP-001', 'Hospitalisation jour', 'HOSPITALISATION', 'Surveillance 24h', 40.00, 0, 'jour'],
  ['HOSP-002', 'Hospitalisation nuit', 'HOSPITALISATION', 'Surveillance nocturne', 60.00, 0, 'nuit'],

  // Analyses
  ['ANAL-001', 'Analyse sanguine complète', 'ANALYSE', 'Numération + biochimie', 45.00, 0, 'analyse'],
  ['ANAL-002', 'Analyse urinaire', 'ANALYSE', 'Bandelette + culot', 20.00, 0, 'analyse'],
  ['ANAL-003', 'Test FIV/FELV', 'ANALYSE', 'Dépistage chat', 35.00, 0, 'analyse'],

  // Documents
  ['DOC-001', 'Certificat médical', 'DOCUMENT', 'Certificat vétérinaire', 10.00, 0, 'document'],
  ['DOC-002', 'Ordonnance', 'DOCUMENT', 'Renouvellement', 5.00, 0, 'document'],
];

async function seedServicePrices() {
  console.log('🌱 Création du catalogue de tarifs...\n');
  const connection = await pool.getConnection();

  try {
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    await connection.query('TRUNCATE TABLE service_prices');
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');

    for (const [code, label, category, description, price, vat, unit] of services) {
      await connection.execute(
        `INSERT INTO service_prices
         (service_code, label, category, description, price, vat_rate, unit, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
        [code, label, category, description, price, vat, unit],
      );
    }

    console.log(`✅ ${services.length} tarifs créés\n`);
    console.log('📊 CATALOGUE :');
    services.forEach(([code, label, , , price]) => {
      console.log(`  • ${code.padEnd(10)} ${label.padEnd(35)} ${price.toFixed(2)} €`);
    });
  } catch (error) {
    console.error('❌ Erreur :', error.message);
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

seedServicePrices();