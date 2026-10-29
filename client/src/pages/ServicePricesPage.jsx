import { useEffect, useState } from 'react';
import { http } from '../api/http.js';

const CATEGORY_LABELS = {
  CONSULTATION: 'Consultation',
  ACTE_MEDICAL: 'Acte médical',
  ACTE_CHIRURGICAL: 'Acte chirurgical',
  VACCINATION: 'Vaccination',
  HOSPITALISATION: 'Hospitalisation',
  ANALYSE: 'Analyse',
  DOCUMENT: 'Document',
  AUTRE: 'Autre',
};

export default function ServicePricesPage() {
  const [prices, setPrices] = useState([]);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    http.get('/invoices/services/prices')
      .then(({ data }) => {
        if (!active) return;
        setPrices(data.data ?? []);
        setError('');
      })
      .catch((requestError) => {
        if (!active) return;
        setError(requestError.response?.data?.message ?? 'Impossible de charger les tarifs.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const filtered = filter ? prices.filter((p) => p.category === filter) : prices;

  // Grouper par catégorie pour affichage
  const grouped = filtered.reduce((acc, price) => {
    const cat = price.category ?? 'AUTRE';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(price);
    return acc;
  }, {});

  return (
    <section>
      <div className="page-heading records-heading">
        <div>
          <p className="eyebrow">FINANCES · TARIFS</p>
          <h1>Catalogue de tarifs</h1>
          <p className="muted">
            {filtered.length} tarif{filtered.length === 1 ? '' : 's'}
            {filter ? ` dans la catégorie « ${CATEGORY_LABELS[filter]} »` : ''}
          </p>
        </div>
      </div>

      <div className="toolbar-row">
        <label className="search-field">
          <span aria-hidden="true">⚙</span>
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            aria-label="Filtrer par catégorie"
          >
            <option value="">Toutes les catégories</option>
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </label>
        <span className="result-count">
          {filtered.length} résultat{filtered.length === 1 ? '' : 's'}
        </span>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}

      {loading && <p className="muted">Chargement du catalogue…</p>}

      {!loading && filtered.length === 0 && !error && (
        <p className="table-empty">Aucun tarif trouvé.</p>
      )}

      {!loading && filtered.length > 0 && (
        <>
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category} style={{ marginBottom: 24 }}>
              <h2 style={{ marginTop: 16, marginBottom: 8, fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#4a5568' }}>
                {CATEGORY_LABELS[category] ?? category} <span className="muted" style={{ fontWeight: 400, fontSize: '0.85rem' }}>({items.length})</span>
              </h2>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Libellé</th>
                      <th>Unité</th>
                      <th>Prix HT</th>
                      <th>TVA</th>
                      <th>Prix TTC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((price) => {
                      const priceHT = Number(price.price);
                      const vatRate = Number(price.vat_rate);
                      const priceTTC = priceHT * (1 + vatRate / 100);
                      return (
                        <tr key={price.id}>
                          <td><code>{price.service_code}</code></td>
                          <td>
                            <strong>{price.label}</strong>
                            {price.description && <small>{price.description}</small>}
                          </td>
                          <td>{price.unit}</td>
                          <td>{priceHT.toFixed(2)} €</td>
                          <td>{vatRate.toFixed(2)} %</td>
                          <td><strong>{priceTTC.toFixed(2)} €</strong></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </>
      )}
    </section>
  );
}