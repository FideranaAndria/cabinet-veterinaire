import { useEffect, useState } from 'react';
import { http } from '../api/http.js';
import { Link, useSearchParams } from 'react-router-dom';

const blankAnimal = () => ({
  name: '', species: '', breed: '', sex: 'unknown', date_of_birth: '', microchip_number: '',
  tattoo_number: '', icad_number: '', color: '', weight_kg: '', body_condition_score: '',
  medical_history: '', allergies: '', pathologies: '', current_treatments: '', client_ids: [],
});

export default function AnimalsPage() {
  const [searchParams] = useSearchParams();
  const newForClientId = searchParams.get('newForClient');
  const [animals, setAnimals] = useState([]);
  const [clients, setClients] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 0 });
  const [search, setSearch] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(blankAnimal);
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

   useEffect(() => {
    let active = true;
    Promise.all([
      http.get('/animals', { params: { search, page: pagination.page, pageSize: pagination.pageSize } }),
      http.get('/clients', { params: { page: 1, pageSize: 100 } }),
    ]).then(([animalResponse, clientResponse]) => {
      if (!active) return;
      setAnimals(animalResponse.data.data);
      setPagination(animalResponse.data.pagination);
      setClients(clientResponse.data.data);
      
      // NOUVEAU : Si on arrive depuis un client, on ouvre le formulaire pré-rempli
      if (newForClientId) {
        setEditingId(null);
        setForm({
          ...blankAnimal(),
          client_ids: [Number(newForClientId)] // On coche automatiquement ce client
        });
        setFormOpen(true);
      }
      
      setError('');
    }).catch((requestError) => {
      if (active) setError(requestError.response?.data?.message ?? 'Impossible de charger les dossiers.');
    });
    return () => { active = false; };
  }, [search, pagination.page, pagination.pageSize, refreshKey, newForClientId]);

  function openCreate() {
    setEditingId(null);
    setForm(blankAnimal());
    setFormOpen(true);
    setError('');
  }

  async function openEdit(animalId) {
    try {
      const { data } = await http.get(`/animals/${animalId}`);
      const animal = data.data;
      setEditingId(animal.id);
      setForm({
        ...blankAnimal(),
        ...animal,
        date_of_birth: animal.date_of_birth?.slice(0, 10) ?? '',
        weight_kg: animal.weight_kg ?? '',
        body_condition_score: animal.body_condition_score ?? '',
        client_ids: animal.owners.map((owner) => owner.id),
      });
      setFormOpen(true);
      setError('');
    } catch (requestError) {
      setError(requestError.response?.data?.message ?? 'Impossible de charger ce dossier.');
    }
  }

  async function saveAnimal(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
      // On construit un payload propre avec SEULEMENT les champs du schéma
    const payload = {
      name: form.name,
      species: form.species,
      breed: form.breed || null,
      sex: form.sex,
      date_of_birth: form.date_of_birth || null,
      microchip_number: form.microchip_number || null,
      tattoo_number: form.tattoo_number || null,
      icad_number: form.icad_number || null,
      color: form.color || null,
      weight_kg: form.weight_kg === '' ? null : Number(form.weight_kg),
      body_condition_score: form.body_condition_score === '' ? null : Number(form.body_condition_score),
      medical_history: form.medical_history || null,
      allergies: form.allergies || null,
      pathologies: form.pathologies || null,
      current_treatments: form.current_treatments || null,
      client_ids: form.client_ids, // Le tableau des IDs de propriétaires
    };
    try {
      if (editingId) await http.put(`/animals/${editingId}`, payload);
      else await http.post('/animals', payload);
      setFormOpen(false);
      setRefreshKey((value) => value + 1);
    } catch (requestError) {
      setError(requestError.response?.data?.message ?? 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  }

  async function archiveAnimal(animal) {
    if (!window.confirm(`Archiver le dossier de ${animal.name} ?`)) return;
    try {
      await http.patch(`/animals/${animal.id}/archive`);
      setRefreshKey((value) => value + 1);
      setError('');
    } catch (requestError) {
      setError(requestError.response?.data?.message ?? 'Archivage impossible.');
    }
  }

  function toggleOwner(clientId) {
    const current = form.client_ids;
    setForm({ ...form, client_ids: current.includes(clientId) ? current.filter((id) => id !== clientId) : [...current, clientId] });
  }

  return (
    <section>
      <div className="page-heading records-heading">
        <div><p className="eyebrow">DOSSIERS · SUIVI ANIMAL</p><h1>Animaux</h1><p className="muted">{pagination.total} dossier{pagination.total === 1 ? '' : 's'} actif{pagination.total === 1 ? '' : 's'}</p></div>
        <button className="button primary-button" type="button" onClick={openCreate}>＋ Nouvel animal</button>
      </div>

      {formOpen && (
        <form className="record-form" onSubmit={saveAnimal}>
          <div className="record-form-heading"><h2>{editingId ? 'Modifier la fiche' : 'Nouvelle fiche animal'}</h2><button className="icon-button" type="button" aria-label="Fermer le formulaire" onClick={() => setFormOpen(false)}>×</button></div>
          <div className="form-grid">
            <label>Nom<input required maxLength={120} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
            <label>Espèce<input required maxLength={80} placeholder="Chien, chat…" value={form.species} onChange={(event) => setForm({ ...form, species: event.target.value })} /></label>
            <label>Race<input maxLength={120} value={form.breed ?? ''} onChange={(event) => setForm({ ...form, breed: event.target.value })} /></label>
            <label>Sexe<select value={form.sex} onChange={(event) => setForm({ ...form, sex: event.target.value })}><option value="unknown">Non renseigné</option><option value="female">Femelle</option><option value="male">Mâle</option></select></label>
            <label>Date de naissance<input type="date" value={form.date_of_birth ?? ''} onChange={(event) => setForm({ ...form, date_of_birth: event.target.value })} /></label>
            <label>Couleur<input maxLength={80} value={form.color ?? ''} onChange={(event) => setForm({ ...form, color: event.target.value })} /></label>
            <label>Numéro de puce<input maxLength={50} value={form.microchip_number ?? ''} onChange={(event) => setForm({ ...form, microchip_number: event.target.value })} /></label>
            <label>Numéro de tatouage<input maxLength={50} value={form.tattoo_number ?? ''} onChange={(event) => setForm({ ...form, tattoo_number: event.target.value })} /></label>
            <label>Numéro I-CAD<input maxLength={50} value={form.icad_number ?? ''} onChange={(event) => setForm({ ...form, icad_number: event.target.value })} /></label>
            <label>Poids (kg)<input type="number" step="0.001" min="0.001" max="1000" value={form.weight_kg ?? ''} onChange={(event) => setForm({ ...form, weight_kg: event.target.value })} /></label>
            <label>État corporel / 9<input type="number" step="1" min="1" max="9" value={form.body_condition_score ?? ''} onChange={(event) => setForm({ ...form, body_condition_score: event.target.value })} /></label>
            <label className="field-wide">Propriétaire(s)<span className="owner-picker">{clients.map((client) => <label key={client.id}><input type="checkbox" checked={form.client_ids.includes(client.id)} onChange={() => toggleOwner(client.id)} />{client.first_name} {client.last_name} · {client.client_number}</label>)}</span></label>
            <label className="field-wide">Antécédents<textarea rows="2" maxLength={5000} value={form.medical_history ?? ''} onChange={(event) => setForm({ ...form, medical_history: event.target.value })} /></label>
            <label className="field-wide">Allergies<textarea rows="2" maxLength={5000} value={form.allergies ?? ''} onChange={(event) => setForm({ ...form, allergies: event.target.value })} /></label>
            <label className="field-wide">Pathologies<textarea rows="2" maxLength={5000} value={form.pathologies ?? ''} onChange={(event) => setForm({ ...form, pathologies: event.target.value })} /></label>
            <label className="field-wide">Traitements en cours<textarea rows="2" maxLength={5000} value={form.current_treatments ?? ''} onChange={(event) => setForm({ ...form, current_treatments: event.target.value })} /></label>
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="form-actions"><button className="button secondary-button" type="button" onClick={() => setFormOpen(false)}>Annuler</button><button className="button primary-button" type="submit" disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button></div>
        </form>
      )}

      {!formOpen && <div className="toolbar-row"><label className="search-field"><span aria-hidden="true">⌕</span><input aria-label="Rechercher un animal" placeholder="Nom, espèce, race, puce ou I-CAD" value={search} onChange={(event) => { setSearch(event.target.value); setPagination((current) => ({ ...current, page: 1 })); }} /></label><span className="result-count">{pagination.total} résultat{pagination.total === 1 ? '' : 's'}</span></div>}
      {error && !formOpen && <p className="form-error" role="alert">{error}</p>}
      <div className="table-wrap"><table className="data-table"><thead><tr><th>Animal</th><th>Identification</th><th>Propriétaire(s)</th><th>Naissance</th><th><span className="sr-only">Actions</span></th></tr></thead>
        <tbody>{animals.map((animal) => <tr key={animal.id}>
          <td><Link className="primary-cell" to={`/animals/${animal.id}`}>{animal.name}</Link><small>{animal.species}{animal.breed ? ` · ${animal.breed}` : ''}</small></td>
          <td>{animal.microchip_number || '—'}<small>{animal.status === 'deceased' ? 'Décédé' : animal.status === 'archived' ? 'Archivé' : 'Actif'}</small></td>
          <td>{animal.owners.map((owner) => `${owner.firstName} ${owner.lastName}`).join(', ') || '—'}</td>
          <td>{animal.date_of_birth ? new Date(animal.date_of_birth).toLocaleDateString('fr-FR') : '—'}</td>
          <td className="row-actions"><button className="text-button" type="button" onClick={() => openEdit(animal.id)}>Modifier</button><button className="text-button danger-text" type="button" onClick={() => archiveAnimal(animal)}>Archiver</button></td>
        </tr>)}</tbody>
      </table>{animals.length === 0 && !error && <p className="table-empty">Aucun animal trouvé.</p>}</div>
      <div className="pagination"><span>Page {pagination.page} sur {Math.max(pagination.totalPages, 1)}</span><div><button className="button secondary-button" type="button" disabled={pagination.page <= 1} onClick={() => setPagination((current) => ({ ...current, page: current.page - 1 }))}>Précédent</button><button className="button secondary-button" type="button" disabled={pagination.page >= pagination.totalPages} onClick={() => setPagination((current) => ({ ...current, page: current.page + 1 }))}>Suivant</button></div></div>
    </section>
  );
}