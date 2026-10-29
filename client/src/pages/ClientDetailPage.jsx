import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { http } from '../api/http.js';

export default function ClientDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    http.get(`/clients/${id}`).then(({ data }) => {
      if (active) setClient(data.data);
    }).catch((requestError) => {
      if (active) setError(requestError.response?.data?.message ?? 'Impossible de charger ce dossier.');
    });
    return () => { active = false; };
  }, [id]);

  if (error) return <p className="form-error" role="alert">{error}</p>;
  if (!client) return <p className="muted">Chargement du dossier…</p>;

  return (
    <section>
      <p className="eyebrow"><Link to="/clients">CLIENTS</Link> · {client.client_number}</p>
      
      <div className="page-heading records-heading">
        <div>
          <h1>{client.first_name} {client.last_name}</h1>
          <p className="muted">Dossier ouvert le {new Date(client.created_at).toLocaleDateString('fr-FR')}</p>
        </div>
        <Link className="button secondary-button" to="/clients">Retour à la liste</Link>
      </div>

      <div className="detail-grid">
        {/* Coordonnées */}
        <section className="detail-section">
          <h2>Coordonnées</h2>
          <dl>
            <dt>E-mail</dt><dd>{client.email || '—'}</dd>
            <dt>Téléphone</dt><dd>{client.phone || '—'}</dd>
            <dt>Adresse</dt><dd>{[client.address_line, client.postal_code, client.city].filter(Boolean).join(', ') || '—'}</dd>
            <dt>Contact préféré</dt><dd>{client.preferred_contact || '—'}</dd>
          </dl>
        </section>

        {/* Animaux associés */}
        <section className="detail-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ margin: 0 }}>Animaux associés</h2>
            {/* NOUVEAU BOUTON ICI */}
       <Link 
  to={`/animals?newForClient=${client.id}`} 
  className="button primary-button" 
  style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
>
  ＋ Ajouter un animal
</Link>
          </div>
          
          {client.animals.length ? (
            <ul className="linked-record-list">
              {client.animals.map((animal) => (
                <li key={animal.id}>
                  <Link to={`/animals/${animal.id}`}>
                    <strong>{animal.name}</strong>
                    <span>{animal.species}{animal.breed ? ` · ${animal.breed}` : ''}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Aucun animal associé pour le moment.</p>
          )}
        </section>
      </div>
    </section>
  );
}