import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { http } from '../api/http.js';
import { useAuth } from '../auth/AuthContext.jsx';

function localDay(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function dateTimeValue(value) {
  if (typeof value === 'string') return value.replace(' ', 'T').slice(0, 16);
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

const labels = {
  PLANIFIE: 'Planifié', CONFIRME: 'Confirmé', EN_COURS: 'En cours', REALISE: 'Réalisé', ANNULE: 'Annulé', REPORTE: 'Reporté',
};

export default function AppointmentsPage() {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('appointments.create');
  const canUpdate = hasPermission('appointments.update');
  const canChangeStatus = hasPermission('appointments.status');
  const canCreateConsultation = hasPermission('consultations.create');
  const [day, setDay] = useState(() => localDay(new Date()));
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [appointments, setAppointments] = useState([]);
  const [veterinarians, setVeterinarians] = useState([]);
  const [clients, setClients] = useState([]);
  const [animals, setAnimals] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    http.get('/appointments', { params: { from: day, to: day, status: status || undefined, search: search || undefined, pageSize: 100 } })
      .then(({ data }) => { if (active) { setAppointments(data.data); setError(''); } })
      .catch((requestError) => { if (active) setError(requestError.response?.data?.message ?? 'Impossible de charger les rendez-vous.'); });
    return () => { active = false; };
  }, [day, status, search, refreshKey]);

  useEffect(() => {
    if (!formOpen) return;
    let active = true;
    Promise.all([
      http.get('/appointments/veterinarians'),
      http.get('/clients', { params: { pageSize: 100 } }),
      http.get('/animals', { params: { pageSize: 100 } }),
    ]).then(([vetResponse, clientResponse, animalResponse]) => {
      if (!active) return;
      setVeterinarians(vetResponse.data.data);
      setClients(clientResponse.data.data);
      setAnimals(animalResponse.data.data);
    }).catch((requestError) => { if (active) setError(requestError.response?.data?.message ?? 'Impossible de charger les listes.'); });
    return () => { active = false; };
  }, [formOpen]);

  const availableAnimals = useMemo(() => animals.filter((animal) => animal.owners.some((owner) => owner.id === Number(form?.client_id))), [animals, form?.client_id]);

  function startCreate() {
    setEditingId(null);
    setForm({ client_id: '', animal_id: '', veterinarian_id: '', starts_at: `${day}T09:00`, ends_at: `${day}T09:30`, reason: '', is_emergency: false, notes: '' });
    setFormOpen(true);
    setError('');
  }

  async function startEdit(appointment) {
    try {
      const { data } = await http.get(`/appointments/${appointment.id}`);
      setEditingId(appointment.id);
      setForm({
        client_id: String(data.data.client_id), animal_id: String(data.data.animal_id),
        veterinarian_id: String(data.data.veterinarian_id), starts_at: dateTimeValue(data.data.starts_at),
        ends_at: dateTimeValue(data.data.ends_at), reason: data.data.reason,
        is_emergency: Boolean(data.data.is_emergency), notes: data.data.notes ?? '',
      });
      setFormOpen(true);
      setError('');
    } catch (requestError) {
      setError(requestError.response?.data?.message ?? 'Impossible de charger le rendez-vous.');
    }
  }

  async function saveAppointment(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = { ...form, client_id: Number(form.client_id), animal_id: Number(form.animal_id), veterinarian_id: Number(form.veterinarian_id), notes: form.notes || null };
      if (editingId) await http.put(`/appointments/${editingId}`, payload);
      else await http.post('/appointments', payload);
      setFormOpen(false);
      setRefreshKey((value) => value + 1);
    } catch (requestError) {
      setError(requestError.response?.data?.message ?? 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  }

  async function setAppointmentStatus(appointment, nextStatus) {
    try {
      await http.patch(`/appointments/${appointment.id}/status`, { status: nextStatus });
      setRefreshKey((value) => value + 1);
      setError('');
    } catch (requestError) {
      setError(requestError.response?.data?.message ?? 'Modification impossible.');
    }
  }

  function shiftDay(offset) {
    const next = new Date(`${day}T12:00:00`);
    next.setDate(next.getDate() + offset);
    setDay(localDay(next));
  }

  return (
    <section>
      <div className="page-heading records-heading">
        <div><p className="eyebrow">AGENDA · CONSULTATIONS</p><h1>Rendez-vous</h1><p className="muted">{new Date(`${day}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p></div>
        {canCreate && <button className="button primary-button" type="button" onClick={startCreate}>＋ Nouveau rendez-vous</button>}
      </div>

      <div className="agenda-toolbar">
        <div className="date-switcher"><button className="icon-button" type="button" aria-label="Jour précédent" onClick={() => shiftDay(-1)}>‹</button><input aria-label="Choisir une date" type="date" value={day} onChange={(event) => setDay(event.target.value)} /><button className="icon-button" type="button" aria-label="Jour suivant" onClick={() => shiftDay(1)}>›</button><button className="button secondary-button" type="button" onClick={() => setDay(localDay(new Date()))}>Aujourd’hui</button></div>
        <label className="agenda-filter">Statut<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Tous</option>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="search-field agenda-search"><span aria-hidden="true">⌕</span><input aria-label="Rechercher un rendez-vous" placeholder="Client, animal ou motif" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
      </div>

      {formOpen && form && <form className="record-form" onSubmit={saveAppointment}>
        <div className="record-form-heading"><h2>{editingId ? 'Modifier le rendez-vous' : 'Nouveau rendez-vous'}</h2><button className="icon-button" type="button" aria-label="Fermer le formulaire" onClick={() => setFormOpen(false)}>×</button></div>
        <div className="form-grid">
          <label>Client<select required value={form.client_id} onChange={(event) => setForm({ ...form, client_id: event.target.value, animal_id: '' })}><option value="">Choisir un client</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.first_name} {client.last_name} · {client.client_number}</option>)}</select></label>
          <label>Animal<select required value={form.animal_id} onChange={(event) => setForm({ ...form, animal_id: event.target.value })} disabled={!form.client_id}><option value="">Choisir un animal</option>{availableAnimals.map((animal) => <option key={animal.id} value={animal.id}>{animal.name} · {animal.species}</option>)}</select></label>
          <label>Vétérinaire<select required value={form.veterinarian_id} onChange={(event) => setForm({ ...form, veterinarian_id: event.target.value })}><option value="">Choisir un vétérinaire</option>{veterinarians.map((vet) => <option key={vet.id} value={vet.id}>{vet.first_name} {vet.last_name}</option>)}</select></label>
          <label>Motif<input required maxLength={255} value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} /></label>
          <label>Début<input type="datetime-local" required value={form.starts_at} onChange={(event) => setForm({ ...form, starts_at: event.target.value })} /></label>
          <label>Fin<input type="datetime-local" required value={form.ends_at} onChange={(event) => setForm({ ...form, ends_at: event.target.value })} /></label>
          <label className="check-row"><input type="checkbox" checked={form.is_emergency} onChange={(event) => setForm({ ...form, is_emergency: event.target.checked })} /> Urgence</label>
          <label className="field-wide">Notes<textarea rows="2" maxLength={3000} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="form-actions"><button className="button secondary-button" type="button" onClick={() => setFormOpen(false)}>Annuler</button><button className="button primary-button" type="submit" disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button></div>
      </form>}

      {error && !formOpen && <p className="form-error" role="alert">{error}</p>}
      <div className="appointment-list">
        {appointments.map((appointment) => <article className={`appointment-row${appointment.is_emergency ? ' emergency' : ''}`} key={appointment.id}>
          <div className="appointment-time"><strong>{dateTimeValue(appointment.starts_at).slice(11, 16)}</strong><span>{dateTimeValue(appointment.ends_at).slice(11, 16)}</span></div>
          <div className="appointment-main"><div className="appointment-title"><strong>{appointment.animal_name}</strong>{appointment.is_emergency && <span className="emergency-badge">Urgence</span>}<span className={`status-badge status-${appointment.status.toLowerCase()}`}>{labels[appointment.status]}</span></div><p>{appointment.reason} · {appointment.animal_species}</p><small>{appointment.client_first_name} {appointment.client_last_name} · Dr {appointment.veterinarian_first_name} {appointment.veterinarian_last_name}</small></div>
          <div className="appointment-actions">
            {canChangeStatus && appointment.status === 'PLANIFIE' && <button className="text-button" type="button" onClick={() => setAppointmentStatus(appointment, 'CONFIRME')}>Confirmer</button>}
            {canChangeStatus && appointment.status === 'CONFIRME' && <button className="text-button" type="button" onClick={() => setAppointmentStatus(appointment, 'EN_COURS')}>Démarrer</button>}
            {canCreateConsultation && appointment.status === 'EN_COURS' && <Link className="text-button" to={`/appointments/${appointment.id}/consultation`}>Consultation</Link>}
            {appointment.consultation_id && <span className="muted">Consultation enregistrée</span>}
            {canUpdate && ['PLANIFIE', 'CONFIRME', 'REPORTE'].includes(appointment.status) && <button className="text-button" type="button" onClick={() => startEdit(appointment)}>Modifier</button>}
            {canChangeStatus && ['PLANIFIE', 'CONFIRME'].includes(appointment.status) && <button className="text-button danger-text" type="button" onClick={() => setAppointmentStatus(appointment, 'ANNULE')}>Annuler</button>}
            {canChangeStatus && ['PLANIFIE', 'CONFIRME'].includes(appointment.status) && <button className="text-button" type="button" onClick={() => setAppointmentStatus(appointment, 'REPORTE')}>Reporter</button>}
          </div>
        </article>)}
        {appointments.length === 0 && !error && <div className="agenda-empty"><span aria-hidden="true">▦</span><strong>Aucun rendez-vous ce jour</strong><p>Choisissez une autre date ou planifiez un créneau.</p></div>}
      </div>
    </section>
  );
}