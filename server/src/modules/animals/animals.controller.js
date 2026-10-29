import { pool } from '../../db/pool.js';
import { HttpError } from '../../utils/http-error.js';

const animalFields = [
  'name', 'species', 'breed', 'sex', 'date_of_birth', 'microchip_number', 'tattoo_number',
  'icad_number', 'color', 'weight_kg', 'body_condition_score', 'notes', 'medical_history',
  'allergies', 'pathologies', 'current_treatments', 'status', 'deceased_at', 'death_reason',
];

async function findAnimal(id, executor = pool) {
  const [rows] = await executor.execute(
    `SELECT id, name, species, breed, sex, date_of_birth, microchip_number, tattoo_number,
            icad_number, color, weight_kg, body_condition_score, notes, medical_history,
            allergies, pathologies, current_treatments, status, deceased_at, death_reason,
            created_at, updated_at
     FROM animals WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
    [id],
  );
  return rows[0];
}

async function findOwners(animalIds, executor = pool) {
  if (animalIds.length === 0) return [];
  const placeholders = animalIds.map(() => '?').join(', ');
  const [rows] = await executor.execute(
    `SELECT client_animal.animal_id, clients.id AS client_id, clients.client_number,
            clients.first_name, clients.last_name, client_animal.relationship_type
     FROM client_animal
     JOIN clients ON clients.id = client_animal.client_id
     WHERE client_animal.animal_id IN (${placeholders})
       AND client_animal.valid_to IS NULL AND clients.deleted_at IS NULL
     ORDER BY clients.last_name, clients.first_name`,
    animalIds,
  );
  return rows;
}

function presentOwner(owner) {
  return {
    id: owner.client_id,
    clientNumber: owner.client_number,
    firstName: owner.first_name,
    lastName: owner.last_name,
    relationshipType: owner.relationship_type,
  };
}

async function getActiveClientIds(executor, clientIds) {
  const uniqueIds = [...new Set(clientIds)];
  const placeholders = uniqueIds.map(() => '?').join(', ');
  const [rows] = await executor.execute(
    `SELECT id FROM clients WHERE id IN (${placeholders}) AND deleted_at IS NULL`,
    uniqueIds,
  );
  if (rows.length !== uniqueIds.length) throw new HttpError(422, 'Un ou plusieurs clients sont introuvables ou archivés.');
  return uniqueIds;
}

export async function listAnimals(request, response) {
  const { search, page, pageSize } = request.query;
  const offset = (page - 1) * pageSize;
  const searchPattern = `%${search}%`;
  const filter = search
    ? 'AND (name LIKE ? OR species LIKE ? OR breed LIKE ? OR microchip_number LIKE ? OR icad_number LIKE ?)'
    : '';
  const values = search ? [searchPattern, searchPattern, searchPattern, searchPattern, searchPattern] : [];
  const [countRows] = await pool.execute(`SELECT COUNT(*) AS total FROM animals WHERE deleted_at IS NULL ${filter}`, values);
  const [animals] = await pool.execute(
    `SELECT id, name, species, breed, sex, date_of_birth, microchip_number, status, created_at
     FROM animals WHERE deleted_at IS NULL ${filter}
     ORDER BY name LIMIT ? OFFSET ?`,
    [...values, pageSize, offset],
  );
  const owners = await findOwners(animals.map((animal) => animal.id));
  const ownersByAnimal = new Map();
  for (const owner of owners) {
    const list = ownersByAnimal.get(owner.animal_id) ?? [];
    list.push(presentOwner(owner));
    ownersByAnimal.set(owner.animal_id, list);
  }

  response.json({
    success: true,
    data: animals.map((animal) => ({ ...animal, owners: ownersByAnimal.get(animal.id) ?? [] })),
    pagination: { page, pageSize, total: countRows[0].total, totalPages: Math.ceil(countRows[0].total / pageSize) },
  });
}

export async function getAnimal(request, response) {
  const animal = await findAnimal(request.params.id);
  if (!animal) throw new HttpError(404, 'Animal introuvable.');
  const owners = await findOwners([animal.id]);
  response.json({
    success: true,
    data: {
      ...animal,
      owners: owners.map(presentOwner),
    },
  });
}

export async function createAnimal(request, response) {
  const connection = await pool.getConnection();
  let animalId;
  try {
    await connection.beginTransaction();
    const clientIds = await getActiveClientIds(connection, request.body.client_ids);
    const fields = Object.keys(request.body).filter((field) => animalFields.includes(field));
    const values = fields.map((field) => request.body[field]);
    const [result] = await connection.execute(
      `INSERT INTO animals (${fields.join(', ')}, created_by) VALUES (${fields.map(() => '?').join(', ')}, ?)`,
      [...values, request.auth.id],
    );
    animalId = result.insertId;
    for (const clientId of clientIds) {
      await connection.execute(
        `INSERT INTO client_animal (client_id, animal_id, valid_from) VALUES (?, ?, CURRENT_TIMESTAMP(6))`,
        [clientId, animalId],
      );
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  response.status(201).json({ success: true, data: { ...(await findAnimal(animalId)), owners: (await findOwners([animalId])).map(presentOwner) } });
}

export async function updateAnimal(request, response) {
  const { id } = request.params;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    if (!await findAnimal(id, connection)) throw new HttpError(404, 'Animal introuvable.');
    const { client_ids: clientIds, ...updates } = request.body;
    const fields = Object.keys(updates).filter((field) => animalFields.includes(field));

    if (fields.length > 0) {
      await connection.execute(
        `UPDATE animals SET ${fields.map((field) => `${field} = ?`).join(', ')} WHERE id = ? AND deleted_at IS NULL`,
        [...fields.map((field) => updates[field]), id],
      );
    }

    if (clientIds) {
      const activeClientIds = await getActiveClientIds(connection, clientIds);
      await connection.execute(
        'UPDATE client_animal SET valid_to = CURRENT_TIMESTAMP(6) WHERE animal_id = ? AND valid_to IS NULL',
        [id],
      );
      for (const clientId of activeClientIds) {
        await connection.execute(
          'INSERT INTO client_animal (client_id, animal_id, valid_from) VALUES (?, ?, CURRENT_TIMESTAMP(6))',
          [clientId, id],
        );
      }
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  const animal = await findAnimal(id);
  const owners = await findOwners([id]);
  response.json({ success: true, data: { ...animal, owners: owners.map(presentOwner) } });
}

export async function archiveAnimal(request, response) {
  const [result] = await pool.execute(
    `UPDATE animals SET status = 'archived', deleted_at = CURRENT_TIMESTAMP, deleted_by = ?
     WHERE id = ? AND deleted_at IS NULL`,
    [request.auth.id, request.params.id],
  );
  if (result.affectedRows === 0) throw new HttpError(404, 'Animal introuvable.');
  response.json({ success: true, message: 'Dossier animal archivé.' });
}