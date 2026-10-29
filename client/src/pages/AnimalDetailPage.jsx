import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { http } from '../api/http.js';
import { useAuth } from '../auth/AuthContext.jsx';

function localDateTime(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function localDate(date = new Date()) {
  return localDateTime(date).slice(0, 10);
}

const blankItem = () => ({ medication_name: '', dosage: '', route: '', posology: '', duration_days: '', quantity: '', instructions: '' });

export default function AnimalDetailPage() {
  const { id } = useParams();
  const { hasPermission } = useAuth();
  const canReadConsultations = hasPermission('consultations.read');
  const canReadActs = hasPermission('medical_acts.read');
  const canReadPrescriptions = hasPermission('prescriptions.read');
  const canReadVaccinations = hasPermission('vaccinations.read');
  const canCreateActs = hasPermission('medical_acts.create');
  const canCreatePrescriptions = hasPermission('prescriptions.create');
  const canCreateVaccinations = hasPermission('vaccinations.create');
  const [animal, setAnimal] = useState(null);
  const [consultations, setConsultations] = useState([]);
  const [acts, setActs] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [vaccinations, setVaccinations] = useState([]);
  const [recordType, setRecordType] = useState('');
  const [recordError, setRecordError] = useState('');
  const [recordSaving, setRecordSaving] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    http.get(`/animals/${id}`).then(({ data }) => {
      if (active) setAnimal(data.data);
    }).catch((requestError) => {
      if (active) setError(requestError.response?.data?.message ?? 'Impossible de charger cette fiche.');
    });
    return () => { active = false; };
  }, [id, refreshKey]);

  useEffect(() => {
    if (!canReadConsultations) return;
    let active = true;
    http.get('/consultations', { params: { animal_id: id, pageSize: 50 } }).then(({ data }) => {
      if (active) setConsultations(data.data);
    }).catch(() => {});
    return () => { active = false; };
  }, [id, canReadConsultations, refreshKey]);

  useEffect(() => {
    let active = true;
    const requests = [
      canReadActs ? http.get('/medical-records/acts', { params: { animal_id: id, pageSize: 50 } }) : Promise.resolve(null),
      canReadPrescriptions ? http.get('/medical-records/prescriptions', { params: { animal_id: id, pageSize: 50 } }) : Promise.resolve(null),
      canReadVaccinations ? http.get('/medical-records/vaccinations', { params: { animal_id: id, pageSize: 50 } }) : Promise.resolve(null),
    ];
    Promise.all(requests).then(([actResponse, prescriptionResponse, vaccinationResponse]) => {
      if (!active) return;
      if (actResponse) setActs(actResponse.data.data);
      if (prescriptionResponse) setPrescriptions(prescriptionResponse.data.data);
      if (vaccinationResponse) setVaccinations(vaccinationResponse.data.data);
    }).catch(() => {});
    return () => { active = false; };
  }, [id, canReadActs, canReadPrescriptions, canReadVaccinations, refreshKey]);

  function openRecord(type) {
    const consultationId = consultations[0]?.id ?? '';
    setRecordType(type);
    setRecordError('');
    if (type === 'act') setForm({ consultation_id: consultationId, act_type: 'medical', title: '', performed_at: localDateTime(), description: '', anesthesia_protocol: '', materials_used: '', complications: '', report: '', follow_up_at: '' });
    if (type === 'prescription') setForm({ consultation_id: consultationId, valid_until: '', renewals_allowed: '0', observations: '', items: [blankItem()] });
    if (type === 'vaccination') setForm({ consultation_id: consultationId, vaccine_type: '', administered_at: localDate(), batch_number: '', next_due_at: '', reaction: '', certificate_reference: '' });
  }

  async function saveRecord(event) {
    event.preventDefault();
    setRecordSaving(true);
    setRecordError('');
    const payload = { ...form, consultation_id: Number(form.consultation_id) };
    if (recordType === 'act') {
      payload.performed_at = form.performed_at || undefined;
      payload.follow_up_at = form.follow_up_at || null;
      for (const field of ['description', 'anesthesia_protocol', 'materials_used', 'complications', 'report']) payload[field] = form[field] || null;
    } else if (recordType === 'prescription') {
      payload.valid_until = form.valid_until || null;
      payload.renewals_allowed = Number(form.renewals_allowed);
      payload.observations = form.observations || null;
      payload.items = form.items.map((item) => ({ ...item, duration_days: item.duration_days === '' ? null : Number(item.duration_days), quantity: item.quantity === '' ? null : Number(item.quantity), route: item.route || null, instructions: item.instructions || null }));
    } else {
      payload.next_due_at = form.next_due_at || null;
      for (const field of ['batch_number', 'reaction', 'certificate_reference']) payload[field] = form[field] || null;
    }

    try {
      const endpoint = recordType === 'act' ? 'acts' : recordType === 'prescription' ? 'prescriptions' : 'vaccinations';
      await http.post(`/medical-records/${endpoint}`, payload);
      setRecordType('');
      setForm(null);
      setRefreshKey((value) => value + 1);
    } catch (requestError) {
      setRecordError(requestError.response?.data?.message ?? 'Impossible d’enregistrer cet élément médical.');
    } finally {
      setRecordSaving(false);
    }
  }

  if (error) return <p className="form-error" role="alert">{error}</p>;
  if (!animal) return <p className="muted">Chargement de la fiche…</p>;

  return (
    <section>
      <p className="eyebrow"><Link to="/animals">ANIMAUX</Link> · FICHE MÉDICALE</p>
      <div className="page-heading records-heading"><div><h1>{animal.name}</h1><p className="muted">{animal.species}{animal.breed ? ` · ${animal.breed}` : ''}</p></div><Link className="button secondary-button" to="/animals">Retour à la liste</Link></div>
      <div className="detail-grid">
        <section className="detail-section"><h2>Informations générales</h2><dl><dt>Sexe</dt><dd>{animal.sex || '—'}</dd><dt>Date de naissance</dt><dd>{animal.date_of_birth ? new Date(animal.date_of_birth).toLocaleDateString('fr-FR') : '—'}</dd><dt>Poids</dt><dd>{animal.weight_kg ? `${animal.weight_kg} kg` : '—'}</dd><dt>Puce</dt><dd>{animal.microchip_number || '—'}</dd><dt>Tatouage</dt><dd>{animal.tattoo_number || '—'}</dd><dt>I-CAD</dt><dd>{animal.icad_number || '—'}</dd><dt>Couleur</dt><dd>{animal.color || '—'}</dd></dl></section>
        <section className="detail-section"><h2>Propriétaire(s)</h2>{animal.owners.length ? <ul className="linked-record-list">{animal.owners.map((owner) => <li key={owner.id}><Link to={`/clients/${owner.id}`}><strong>{owner.firstName} {owner.lastName}</strong><span>{owner.clientNumber}</span></Link></li>)}</ul> : <p className="muted">Aucun propriétaire actif associé.</p>}</section>
        <section className="detail-section"><h2>Suivi médical</h2><dl><dt>Antécédents</dt><dd>{animal.medical_history || '—'}</dd><dt>Allergies</dt><dd>{animal.allergies || '—'}</dd><dt>Pathologies</dt><dd>{animal.pathologies || '—'}</dd><dt>Traitements</dt><dd>{animal.current_treatments || '—'}</dd></dl></section>
      </div>
      {canReadConsultations && <section className="detail-section medical-timeline"><h2>Historique des consultations</h2>{consultations.length ? <ol>{consultations.map((consultation) => <li key={consultation.id}><time>{new Date(consultation.consulted_at).toLocaleString('fr-FR')}</time><strong>{consultation.reason}</strong><p>{consultation.diagnosis || consultation.observations || 'Compte rendu enregistré'}</p><small>Dr {consultation.veterinarian_first_name} {consultation.veterinarian_last_name}</small></li>)}</ol> : <p className="muted">Aucune consultation enregistrée.</p>}</section>}
      {(canReadActs || canReadPrescriptions || canReadVaccinations) && <section className="detail-section medical-records-section">
        <div className="record-form-heading"><div><h2>Actes, ordonnances et vaccinations</h2><p className="muted">Les nouveaux éléments sont rattachés à une consultation existante.</p></div><div className="record-quick-actions">{canCreateActs && <button className="button secondary-button" type="button" onClick={() => openRecord('act')}>＋ Acte</button>}{canCreatePrescriptions && <button className="button secondary-button" type="button" onClick={() => openRecord('prescription')}>＋ Ordonnance</button>}{canCreateVaccinations && <button className="button secondary-button" type="button" onClick={() => openRecord('vaccination')}>＋ Vaccination</button>}</div></div>
        {recordType && form && <form className="record-inline-form" onSubmit={saveRecord}>
          <div className="record-form-heading"><h3>{recordType === 'act' ? 'Nouvel acte médical ou chirurgical' : recordType === 'prescription' ? 'Nouvelle ordonnance' : 'Nouvelle vaccination'}</h3><button className="icon-button" type="button" aria-label="Fermer le formulaire" onClick={() => setRecordType('')}>×</button></div>
          <label>Consultation associée<select required value={form.consultation_id} onChange={(event) => setForm({ ...form, consultation_id: event.target.value })}><option value="">Choisir une consultation</option>{consultations.map((consultation) => <option key={consultation.id} value={consultation.id}>{new Date(consultation.consulted_at).toLocaleDateString('fr-FR')} · {consultation.reason}</option>)}</select></label>
          {recordType === 'act' && <div className="form-grid"><label>Type<select value={form.act_type} onChange={(event) => setForm({ ...form, act_type: event.target.value })}><option value="medical">Acte médical</option><option value="surgical">Acte chirurgical</option></select></label><label>Intitulé<input required maxLength={180} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label><label>Date<input type="datetime-local" value={form.performed_at} onChange={(event) => setForm({ ...form, performed_at: event.target.value })} /></label><label>Suivi<input type="datetime-local" value={form.follow_up_at} onChange={(event) => setForm({ ...form, follow_up_at: event.target.value })} /></label>{[['description', 'Description'], ['anesthesia_protocol', 'Anesthésie / protocole'], ['materials_used', 'Matériel utilisé'], ['complications', 'Complications'], ['report', 'Compte rendu']].map(([field, label]) => <label className="field-wide" key={field}>{label}<textarea rows="2" maxLength={10000} value={form[field]} onChange={(event) => setForm({ ...form, [field]: event.target.value })} /></label>)}</div>}
          {recordType === 'prescription' && <><div className="form-grid"><label>Valable jusqu’au<input type="date" value={form.valid_until} onChange={(event) => setForm({ ...form, valid_until: event.target.value })} /></label><label>Renouvellements<input type="number" min="0" max="12" value={form.renewals_allowed} onChange={(event) => setForm({ ...form, renewals_allowed: event.target.value })} /></label><label className="field-wide">Observations<textarea rows="2" maxLength={5000} value={form.observations} onChange={(event) => setForm({ ...form, observations: event.target.value })} /></label></div><div className="prescription-item-list">{form.items.map((item, index) => <div className="prescription-item" key={index}><div className="record-form-heading"><h3>Médicament {index + 1}</h3>{form.items.length > 1 && <button className="text-button danger-text" type="button" onClick={() => setForm({ ...form, items: form.items.filter((_, itemIndex) => itemIndex !== index) })}>Retirer</button>}</div><div className="form-grid"><label>Médicament<input required maxLength={180} value={item.medication_name} onChange={(event) => setForm({ ...form, items: form.items.map((current, itemIndex) => itemIndex === index ? { ...current, medication_name: event.target.value } : current) })} /></label><label>Dosage<input required maxLength={160} value={item.dosage} onChange={(event) => setForm({ ...form, items: form.items.map((current, itemIndex) => itemIndex === index ? { ...current, dosage: event.target.value } : current) })} /></label><label>Voie<input maxLength={80} value={item.route} onChange={(event) => setForm({ ...form, items: form.items.map((current, itemIndex) => itemIndex === index ? { ...current, route: event.target.value } : current) })} /></label><label>Posologie<input required maxLength={500} value={item.posology} onChange={(event) => setForm({ ...form, items: form.items.map((current, itemIndex) => itemIndex === index ? { ...current, posology: event.target.value } : current) })} /></label><label>Durée (jours)<input type="number" min="1" max="3650" value={item.duration_days} onChange={(event) => setForm({ ...form, items: form.items.map((current, itemIndex) => itemIndex === index ? { ...current, duration_days: event.target.value } : current) })} /></label><label>Quantité<input type="number" min="0.01" step="0.01" value={item.quantity} onChange={(event) => setForm({ ...form, items: form.items.map((current, itemIndex) => itemIndex === index ? { ...current, quantity: event.target.value } : current) })} /></label><label className="field-wide">Instructions<textarea rows="2" maxLength={3000} value={item.instructions} onChange={(event) => setForm({ ...form, items: form.items.map((current, itemIndex) => itemIndex === index ? { ...current, instructions: event.target.value } : current) })} /></label></div></div>)}</div><button className="text-button" type="button" onClick={() => setForm({ ...form, items: [...form.items, blankItem()] })}>＋ Ajouter un médicament</button></>}
          {recordType === 'vaccination' && <div className="form-grid"><label>Vaccin<input required maxLength={160} value={form.vaccine_type} onChange={(event) => setForm({ ...form, vaccine_type: event.target.value })} /></label><label>Date d’injection<input type="date" required value={form.administered_at} onChange={(event) => setForm({ ...form, administered_at: event.target.value })} /></label><label>Numéro de lot<input maxLength={80} value={form.batch_number} onChange={(event) => setForm({ ...form, batch_number: event.target.value })} /></label><label>Prochain rappel<input type="date" value={form.next_due_at} onChange={(event) => setForm({ ...form, next_due_at: event.target.value })} /></label><label className="field-wide">Réaction éventuelle<textarea rows="2" maxLength={5000} value={form.reaction} onChange={(event) => setForm({ ...form, reaction: event.target.value })} /></label><label className="field-wide">Référence certificat<input maxLength={255} value={form.certificate_reference} onChange={(event) => setForm({ ...form, certificate_reference: event.target.value })} /></label></div>}
          {recordError && <p className="form-error" role="alert">{recordError}</p>}
          <div className="form-actions"><button className="button secondary-button" type="button" onClick={() => setRecordType('')}>Annuler</button><button className="button primary-button" type="submit" disabled={recordSaving || !form.consultation_id}>{recordSaving ? 'Enregistrement…' : 'Enregistrer'}</button></div>
          {consultations.length === 0 && <p className="muted">Enregistrez d’abord une consultation pour pouvoir rattacher un acte, une ordonnance ou une vaccination.</p>}
        </form>}
        <div className="medical-record-grid">
          {canReadActs && <div className="medical-record-column"><h3>Actes ({acts.length})</h3>{acts.map((act) => <article key={act.id}><span className="status-badge">{act.act_type === 'surgical' ? 'Chirurgical' : 'Médical'}</span><strong>{act.title}</strong><small>{new Date(act.performed_at).toLocaleDateString('fr-FR')}</small></article>)}{acts.length === 0 && <p className="muted">Aucun acte.</p>}</div>}
          {canReadPrescriptions && <div className="medical-record-column"><h3>Ordonnances ({prescriptions.length})</h3>{prescriptions.map((prescription) => <article key={prescription.id}><strong>{prescription.medications || 'Ordonnance'}</strong><small>{new Date(prescription.issued_at).toLocaleDateString('fr-FR')} · {prescription.status === 'active' ? 'Active' : prescription.status}</small>{prescription.valid_until && <small>Valable jusqu’au {new Date(prescription.valid_until).toLocaleDateString('fr-FR')}</small>}</article>)}{prescriptions.length === 0 && <p className="muted">Aucune ordonnance.</p>}</div>}
          {canReadVaccinations && <div className="medical-record-column"><h3>Vaccinations ({vaccinations.length})</h3>{vaccinations.map((vaccination) => <article key={vaccination.id}><strong>{vaccination.vaccine_type}</strong><small>{new Date(vaccination.administered_at).toLocaleDateString('fr-FR')}{vaccination.batch_number ? ` · Lot ${vaccination.batch_number}` : ''}</small>{vaccination.next_due_at && <small>Rappel : {new Date(vaccination.next_due_at).toLocaleDateString('fr-FR')}</small>}</article>)}{vaccinations.length === 0 && <p className="muted">Aucune vaccination.</p>}</div>}
        </div>
      </section>}
    </section>
  );
}