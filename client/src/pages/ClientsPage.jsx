import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { http } from '../api/http.js';

const blankClient = () => ({
  first_name: '', last_name: '', date_of_birth: '', sex: 'unknown', email: '', phone: '',
  address_line: '', postal_code: '', city: '', payment_method: '', preferred_contact: 'none',
  consent_personal_data: false, consent_marketing: false, notes: '',
});

export default function ClientsPage() {
  const [clients, setClients] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 0 });
  const [search, setSearch] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(blankClient);
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    http.get('/clients', { params: { search, page: pagination.page, pageSize: pagination.pageSize } })
      .then(({ data }) => {
        if (!active) return;
        setClients(data.data);
        setPagination(data.pagination);
        setError('');
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message ?? 'Impossible de charger les clients.');
      });
    return () => { active = false; };
  }, [search, pagination.page, pagination.pageSize, refreshKey]);

  function openCreate() {
    setEditingId(null);
    setForm(blankClient());
    setFormOpen(true);
    setError('');
  }

  async function openEdit(clientId) {
    try {
      const { data } = await http.get(`/clients/${clientId}`);
      const client = data.data;
      setEditingId(client.id);
      setForm({ ...blankClient(), ...client, date_of_birth: client.date_of_birth?.slice(0, 10) ?? '' });
      setFormOpen(true);
      setError('');
    } catch (requestError) {
      setError(requestError.response?.data?.message ?? 'Impossible de charger ce dossier.');
    }
  }

  async function saveClient(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    
    // On envoie uniquement les champs attendus par le schéma Zod
    const payload = {
      first_name: form.first_name,
      last_name: form.last_name,
      date_of_birth: form.date_of_birth || null,
      sex: form.sex,
      email: form.email || null,
      phone: form.phone || null,
      address_line: form.address_line || null,
      postal_code: form.postal_code || null,
      city: form.city || null,
      payment_method: form.payment_method || null,
      preferred_contact: form.preferred_contact,
      consent_personal_data: Boolean(form.consent_personal_data),
      consent_marketing: Boolean(form.consent_marketing),
      notes: form.notes || null,
    };

       try {
      if (editingId) await http.put(`/clients/${editingId}`, payload);
      else await http.post('/clients', payload);
      setFormOpen(false);
      setRefreshKey((value) => value + 1);
    } catch (requestError) {
      // On récupère le message précis du backend
      const backendMessage = requestError.response?.data?.message;
      setError(backendMessage || 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  }

  async function archiveClient(client) {
    if (!window.confirm(`Archiver le dossier de ${client.first_name} ${client.last_name} ?`)) return;
    try {
      await http.patch(`/clients/${client.id}/archive`);
      setRefreshKey((value) => value + 1);
      setError('');
    } catch (requestError) {
      setError(requestError.response?.data?.message ?? 'Archivage impossible.');
    }
  }

  return (
    <section>
      <div className="page-heading records-heading">
        <div><p className="eyebrow">DOSSIERS · ACCUEIL</p><h1>Clients</h1><p className="muted">{pagination.total} dossier{pagination.total === 1 ? '' : 's'} actif{pagination.total === 1 ? '' : 's'}</p></div>
        <button className="button primary-button" type="button" onClick={openCreate}>＋ Nouveau client</button>
      </div>

      {formOpen && (
        <form className="record-form" onSubmit={saveClient}>
          <div className="record-form-heading"><h2>{editingId ? 'Modifier le dossier' : 'Nouveau dossier client'}</h2><button className="icon-button" type="button" aria-label="Fermer le formulaire" onClick={() => setFormOpen(false)}>×</button></div>
          <div className="form-grid">
            <label>Prénom<input required maxLength={100} value={form.first_name} onChange={(event) => setForm({ ...form, first_name: event.target.value })} /></label>
            <label>Nom<input required maxLength={100} value={form.last_name} onChange={(event) => setForm({ ...form, last_name: event.target.value })} /></label>
            <label>Date de naissance<input type="date"max={new Date().toISOString().split('T')[0]} value={form.date_of_birth ?? ''} onChange={(event) => setForm({ ...form, date_of_birth: event.target.value })} /></label>
            <label>Sexe<select value={form.sex} onChange={(event) => setForm({ ...form, sex: event.target.value })}><option value="unknown">Non renseigné</option><option value="female">Féminin</option><option value="male">Masculin</option></select></label>
            <label>E-mail<input type="email" maxLength={254} value={form.email ?? ''} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
            <label>Téléphone<input type="tel" maxLength={40} value={form.phone ?? ''} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
            <label className="field-wide">Adresse<input maxLength={255} value={form.address_line ?? ''} onChange={(event) => setForm({ ...form, address_line: event.target.value })} /></label>
            <label>Code postal<input maxLength={20} value={form.postal_code ?? ''} onChange={(event) => setForm({ ...form, postal_code: event.target.value })} /></label>
            <label>Ville<input maxLength={120} value={form.city ?? ''} onChange={(event) => setForm({ ...form, city: event.target.value })} /></label>
            <label>Moyen de paiement<input maxLength={40} value={form.payment_method ?? ''} onChange={(event) => setForm({ ...form, payment_method: event.target.value })} /></label>
            <label>Contact préféré<select value={form.preferred_contact} onChange={(event) => setForm({ ...form, preferred_contact: event.target.value })}><option value="none">Non renseigné</option><option value="email">E-mail</option><option value="phone">Téléphone</option><option value="sms">SMS</option></select></label>
            <label className="field-wide">Notes<textarea rows="3" maxLength={5000} value={form.notes ?? ''} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
          </div>
          <div className="check-row"><label><input type="checkbox" checked={Boolean(form.consent_personal_data)} onChange={(event) => setForm({ ...form, consent_personal_data: event.target.checked })} /> Consentement aux données personnelles</label><label><input type="checkbox" checked={Boolean(form.consent_marketing)} onChange={(event) => setForm({ ...form, consent_marketing: event.target.checked })} /> Communications d’information</label></div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="form-actions"><button className="button secondary-button" type="button" onClick={() => setFormOpen(false)}>Annuler</button><button className="button primary-button" type="submit" disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button></div>
        </form>
      )}

      {!formOpen && <div className="toolbar-row"><label className="search-field"><span aria-hidden="true">⌕</span><input aria-label="Rechercher un client" placeholder="Nom, numéro, e-mail ou téléphone" value={search} onChange={(event) => { setSearch(event.target.value); setPagination((current) => ({ ...current, page: 1 })); }} /></label><span className="result-count">{pagination.total} résultat{pagination.total === 1 ? '' : 's'}</span></div>}
      {error && !formOpen && <p className="form-error" role="alert">{error}</p>}
      <div className="table-wrap"><table className="data-table"><thead><tr><th>Client</th><th>Coordonnées</th><th>Ville</th><th>Ouvert le</th><th><span className="sr-only">Actions</span></th></tr></thead>
        <tbody>{clients.map((client) => <tr key={client.id}>
          <td><Link className="primary-cell" to={`/clients/${client.id}`}>{client.first_name} {client.last_name}</Link><small>{client.client_number}</small></td>
          <td>{client.email || '—'}<small>{client.phone || '—'}</small></td><td>{client.city || '—'}</td>
          <td>{client.created_at ? new Date(client.created_at).toLocaleDateString('fr-FR') : '—'}</td>
          <td className="row-actions"><button className="text-button" type="button" onClick={() => openEdit(client.id)}>Modifier</button><button className="text-button danger-text" type="button" onClick={() => archiveClient(client)}>Archiver</button></td>
        </tr>)}</tbody>
      </table>{clients.length === 0 && !error && <p className="table-empty">Aucun client trouvé.</p>}</div>
      <div className="pagination"><span>Page {pagination.page} sur {Math.max(pagination.totalPages, 1)}</span><div><button className="button secondary-button" type="button" disabled={pagination.page <= 1} onClick={() => setPagination((current) => ({ ...current, page: current.page - 1 }))}>Précédent</button><button className="button secondary-button" type="button" disabled={pagination.page >= pagination.totalPages} onClick={() => setPagination((current) => ({ ...current, page: current.page + 1 }))}>Suivant</button></div></div>
    </section>
  );
}