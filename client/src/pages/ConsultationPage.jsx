import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { http } from '../api/http.js';

const emptyConsultation = { 
  clinical_exam: '', temperature_c: '', heart_rate_bpm: '', 
  respiratory_rate_bpm: '', weight_kg: '', observations: '', 
  diagnosis: '', recommendations: '', follow_up_at: '' 
};

export default function ConsultationPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [appointment, setAppointment] = useState(null);
  const [form, setForm] = useState(emptyConsultation);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Nouveaux états pour la facturation
  const [tarifs, setTarifs] = useState([]);
  const [selectedTarif, setSelectedTarif] = useState('');
  const [actesAjoutes, setActesAjoutes] = useState([]);

  useEffect(() => {
    let active = true;
    // 1. Charger le rendez-vous
    http.get(`/appointments/${id}`).then(({ data }) => {
      if (!active) return;
      setAppointment(data.data);
      setForm((current) => ({ ...current, reason: data.data.reason }));
    }).catch((requestError) => {
      if (active) setError(requestError.response?.data?.message ?? 'Impossible de charger le rendez-vous.');
    });

    // 2. Charger les vrais tarifs depuis la base de données
    http.get('/invoices/services/prices').then(({ data }) => {
      if (active) setTarifs(data.data);
    }).catch((err) => {
      console.error("Erreur chargement tarifs", err);
    });

    return () => { active = false; };
  }, [id]);

  async function saveConsultation(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    const payload = { appointment_id: Number(id), ...form };
    for (const field of ['temperature_c', 'heart_rate_bpm', 'respiratory_rate_bpm', 'weight_kg']) payload[field] = form[field] === '' ? null : Number(form[field]);
    payload.follow_up_at = form.follow_up_at || null;
    for (const field of ['clinical_exam', 'observations', 'diagnosis', 'recommendations']) payload[field] = form[field] || null;
    
    try {
      await http.post('/consultations', payload);
      navigate('/appointments', { replace: true });
    } catch (requestError) {
      setError(requestError.response?.data?.message ?? 'Impossible d’enregistrer la consultation.');
    } finally {
      setSaving(false);
    }
  }

  // --- LOGIQUE DE FACTURATION ---
  function ajouterActe() {
    if (!selectedTarif) return;
    const tarif = tarifs.find(t => t.id === Number(selectedTarif));
    if (tarif) {
      setActesAjoutes([...actesAjoutes, tarif]);
      setSelectedTarif('');
    }
  }

  async function genererFacture() {
    if (actesAjoutes.length === 0) {
      alert("Veuillez ajouter au moins un acte avant de générer la facture.");
      return;
    }
    
    setSaving(true);
    try {
      // 1. On enregistre d'abord la consultation pour avoir son ID
      const payload = { appointment_id: Number(id), ...form };
      for (const field of ['temperature_c', 'heart_rate_bpm', 'respiratory_rate_bpm', 'weight_kg']) payload[field] = form[field] === '' ? null : Number(form[field]);
      
      const consultRes = await http.post('/consultations', payload);
      const consultationId = consultRes.data.data.id;

            await http.post(`/invoices/from-consultation/${consultationId}`, {
        lines: actesAjoutes.map(acte => ({
          description: acte.label,
          quantity: 1,
          unit_price: Number(acte.price),   // <--- On force la conversion en nombre
          vat_rate: Number(acte.vat_rate)   // <--- On force la conversion en nombre
        }))
      });

      alert("Facture générée avec succès !");
      navigate('/invoices'); // On redirige vers la page des factures
      
    } catch (requestError) {
      setError(requestError.response?.data?.message ?? 'Erreur lors de la génération de la facture.');
      setSaving(false);
    }
  }

  if (error && !appointment) return <p className="form-error" role="alert">{error}</p>;
  if (!appointment) return <p className="muted">Chargement du rendez-vous…</p>;

  const totalEstime = actesAjoutes.reduce((sum, acte) => sum + Number(acte.price), 0);

  return (
    <section className="consultation-page">
      <p className="eyebrow"><Link to="/appointments">RENDEZ-VOUS</Link> · CONSULTATION</p>
      <div className="page-heading">
        <div>
          <h1>{appointment.animal_name}</h1>
          <p className="muted">{appointment.animal_species} · {appointment.client_first_name} {appointment.client_last_name} · {appointment.reason}</p>
        </div>
        <span className="status-badge status-en_cours">En cours</span>
      </div>
      
      <form className="record-form" onSubmit={saveConsultation}>
        <div className="record-form-heading"><h2>Compte rendu médical</h2></div>
        <div className="form-grid">
          <label className="field-wide">Motif<input required maxLength={255} value={form.reason || ''} onChange={(event) => setForm({ ...form, reason: event.target.value })} /></label>
          <label className="field-wide">Examen clinique<textarea rows="4" maxLength={10000} value={form.clinical_exam} onChange={(event) => setForm({ ...form, clinical_exam: event.target.value })} /></label>
          <label>Température (°C)<input type="number" step="0.1" min="20" max="50" value={form.temperature_c} onChange={(event) => setForm({ ...form, temperature_c: event.target.value })} /></label>
          <label>Fréquence cardiaque (bpm)<input type="number" step="1" min="1" max="1000" value={form.heart_rate_bpm} onChange={(event) => setForm({ ...form, heart_rate_bpm: event.target.value })} /></label>
          <label>Fréquence respiratoire (/min)<input type="number" step="1" min="1" max="1000" value={form.respiratory_rate_bpm} onChange={(event) => setForm({ ...form, respiratory_rate_bpm: event.target.value })} /></label>
          <label>Poids (kg)<input type="number" step="0.001" min="0.001" max="1000" value={form.weight_kg} onChange={(event) => setForm({ ...form, weight_kg: event.target.value })} /></label>
          <label className="field-wide">Observations<textarea rows="3" maxLength={10000} value={form.observations} onChange={(event) => setForm({ ...form, observations: event.target.value })} /></label>
          <label className="field-wide">Diagnostic<textarea rows="3" maxLength={10000} value={form.diagnosis} onChange={(event) => setForm({ ...form, diagnosis: event.target.value })} /></label>
          <label className="field-wide">Recommandations<textarea rows="3" maxLength={10000} value={form.recommendations} onChange={(event) => setForm({ ...form, recommendations: event.target.value })} /></label>
          <label>Suivi recommandé<input type="datetime-local" value={form.follow_up_at} onChange={(event) => setForm({ ...form, follow_up_at: event.target.value })} /></label>
        </div>

        {/* SECTION FACTURATION DYNAMIQUE */}
        <div style={{ marginTop: '2rem', padding: '1.5rem', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: '#111827' }}>Actes réalisés et Facturation</h2>
          
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
            <select 
              value={selectedTarif} 
              onChange={(e) => setSelectedTarif(e.target.value)}
              style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db', flex: 1 }}
            >
              <option value="">Sélectionner un acte (Tarif)...</option>
              {tarifs.map(tarif => (
                <option key={tarif.id} value={tarif.id}>{tarif.label} - {Number(tarif.price).toFixed(2)} €</option>
              ))}
            </select>
            <button type="button" onClick={ajouterActe} className="button secondary-button" style={{ padding: '0.5rem 1rem' }}>＋ Ajouter l'acte</button>
          </div>

          <div style={{ background: '#fff', padding: '1rem', borderRadius: '4px', border: '1px solid #e5e7eb', marginBottom: '1.5rem' }}>
            {actesAjoutes.length === 0 ? (
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>Aucun acte ajouté pour le moment.</p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: '1.5rem', color: '#374151' }}>
                {actesAjoutes.map((acte, index) => (
                  <li key={index}>{acte.label} - {Number(acte.price).toFixed(2)} €</li>
                ))}
              </ul>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Total estimé : </span>
              <strong style={{ fontSize: '1.25rem', color: '#111827' }}>{totalEstime.toFixed(2)} €</strong>
            </div>
            <button type="button" className="button primary-button" style={{ background: '#0f766e' }} onClick={genererFacture} disabled={saving}>
              {saving ? 'Génération...' : '💰 Générer la facture'}
            </button>
          </div>
        </div>

        {error && <p className="form-error" role="alert">{error}</p>}
        
        <div className="form-actions" style={{ marginTop: '1.5rem' }}>
          <Link className="button secondary-button" to="/appointments">Retour à l’agenda</Link>
          <button className="button primary-button" type="submit" disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer et terminer'}</button>
        </div>
      </form>
    </section>
  );
}