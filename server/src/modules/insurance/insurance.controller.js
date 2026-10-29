import { pool } from '../../db/pool.js';
import { HttpError } from '../../utils/http-error.js';

function pagination(page, pageSize, total) { return { page, pageSize, total, totalPages: Math.ceil(total / pageSize) }; }

export async function listPolicies(request, response) {
  const { page, pageSize, status } = request.query;
  const where = status ? 'WHERE insurance_policies.status = ?' : '';
  const values = status ? [status] : [];
  const offset = (page - 1) * pageSize;
  const [counts] = await pool.execute(`SELECT COUNT(*) AS total FROM insurance_policies ${where}`, values);
  const [rows] = await pool.execute(
    `SELECT insurance_policies.*, clients.first_name AS client_first_name, clients.last_name AS client_last_name,
            animals.name AS animal_name FROM insurance_policies
     JOIN clients ON clients.id = insurance_policies.client_id JOIN animals ON animals.id = insurance_policies.animal_id
     ${where} ORDER BY insurance_policies.created_at DESC LIMIT ? OFFSET ?`, [...values, pageSize, offset],
  );
  response.json({ success: true, data: rows, pagination: pagination(page, pageSize, counts[0].total) });
}

export async function createPolicy(request, response) {
  const body = request.body;
  const [owners] = await pool.execute(
    `SELECT client_animal.id FROM client_animal JOIN clients ON clients.id = client_animal.client_id
     JOIN animals ON animals.id = client_animal.animal_id
     WHERE client_animal.client_id = ? AND client_animal.animal_id = ? AND client_animal.valid_to IS NULL
       AND clients.deleted_at IS NULL AND animals.deleted_at IS NULL LIMIT 1`, [body.client_id, body.animal_id],
  );
  if (!owners.length) throw new HttpError(422, 'Le client ne détient pas cet animal.');
  const [result] = await pool.execute(
    `INSERT INTO insurance_policies
     (client_id, animal_id, insurer_name, policy_number, coverage_type, coverage_limit, valid_from, valid_until, notes, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [body.client_id, body.animal_id, body.insurer_name, body.policy_number, body.coverage_type ?? null,
      body.coverage_limit ?? null, body.valid_from, body.valid_until ?? null, body.notes ?? null, request.auth.id],
  );
  response.status(201).json({ success: true, data: { id: result.insertId, ...body, status: 'ACTIVE' } });
}

export async function listClaims(request, response) {
  const { page, pageSize, status } = request.query;
  const where = status ? 'WHERE insurance_claims.status = ?' : '';
  const values = status ? [status] : [];
  const offset = (page - 1) * pageSize;
  const [counts] = await pool.execute(`SELECT COUNT(*) AS total FROM insurance_claims ${where}`, values);
  const [rows] = await pool.execute(
    `SELECT insurance_claims.*, insurance_policies.insurer_name, insurance_policies.policy_number,
            insurance_policies.client_id, insurance_policies.animal_id
     FROM insurance_claims JOIN insurance_policies ON insurance_policies.id = insurance_claims.policy_id
     ${where} ORDER BY insurance_claims.created_at DESC LIMIT ? OFFSET ?`, [...values, pageSize, offset],
  );
  response.json({ success: true, data: rows, pagination: pagination(page, pageSize, counts[0].total) });
}

export async function createClaim(request, response) {
  const body = request.body;
  const [policies] = await pool.execute(
    `SELECT insurance_policies.id, insurance_policies.client_id, insurance_policies.animal_id,
            insurance_policies.status, insurance_policies.valid_from, insurance_policies.valid_until
     FROM insurance_policies WHERE id = ? LIMIT 1`, [body.policy_id],
  );
  const policy = policies[0];
  if (!policy) throw new HttpError(404, 'Contrat d’assurance introuvable.');
  if (policy.status !== 'ACTIVE') throw new HttpError(409, 'Le contrat d’assurance n’est pas actif.');
  if (body.invoice_id) {
    const [invoices] = await pool.execute('SELECT id FROM invoices WHERE id = ? AND client_id = ? AND animal_id = ? LIMIT 1', [body.invoice_id, policy.client_id, policy.animal_id]);
    if (!invoices.length) throw new HttpError(422, 'La facture ne correspond pas au contrat sélectionné.');
  }
  if (body.consultation_id) {
    const [consultations] = await pool.execute('SELECT id FROM consultations WHERE id = ? AND client_id = ? AND animal_id = ? LIMIT 1', [body.consultation_id, policy.client_id, policy.animal_id]);
    if (!consultations.length) throw new HttpError(422, 'La consultation ne correspond pas au contrat sélectionné.');
  }
  const [result] = await pool.execute(
    `INSERT INTO insurance_claims (policy_id, invoice_id, consultation_id, claim_number, amount, reason, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [body.policy_id, body.invoice_id ?? null, body.consultation_id ?? null, body.claim_number, body.amount, body.reason, request.auth.id],
  );
  response.status(201).json({ success: true, data: { id: result.insertId, ...body, status: 'DRAFT' } });
}

export async function updateClaimStatus(request, response) {
  const { id } = request.params;
  const { status, decision_notes: decisionNotes } = request.body;
  const [rows] = await pool.execute('SELECT status FROM insurance_claims WHERE id = ? LIMIT 1', [id]);
  if (!rows.length) throw new HttpError(404, 'Dossier d’assurance introuvable.');
  const transitions = {
    DRAFT: ['SUBMITTED', 'CANCELLED'], SUBMITTED: ['APPROVED', 'REJECTED', 'CANCELLED'],
    APPROVED: ['PAID', 'REJECTED'], REJECTED: [], PAID: [], CANCELLED: [],
  };
  if (!transitions[rows[0].status]?.includes(status)) throw new HttpError(409, 'Cette transition de statut est interdite.');
  await pool.execute(
    'UPDATE insurance_claims SET status = ?, decision_notes = ?, submitted_at = CASE WHEN ? = \'SUBMITTED\' THEN CURRENT_TIMESTAMP ELSE submitted_at END, updated_by = ? WHERE id = ?',
    [status, decisionNotes ?? null, status, request.auth.id, id],
  );
  response.json({ success: true, data: { id: Number(id), status, decision_notes: decisionNotes ?? null } });
}
