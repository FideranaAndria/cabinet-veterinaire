import { useEffect, useState } from 'react';
import { http } from '../api/http.js';

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filtres
  const [search, setSearch] = useState('');
  const [showOnlyAlerts, setShowOnlyAlerts] = useState(false);

  useEffect(() => {
    // On suppose que ton API expose GET /products
    // Si ton module s'appelle /supply-chain, il faudra adapter l'URL
    http.get('/products')
      .then(({ data }) => {
        setProducts(data.data || []);
      })
      .catch((err) => {
        setError(err.response?.data?.message ?? 'Impossible de charger le stock.');
      })
      .finally(() => setLoading(false));
  }, []);

  // Logique de filtrage
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase());
    const isLowStock = p.stock_quantity <= p.stock_alert_threshold;
    return matchesSearch && (showOnlyAlerts ? isLowStock : true);
  });

  // Calculs pour le bandeau de stats
  const totalAlerts = products.filter(p => p.stock_quantity <= p.stock_alert_threshold).length;
  const totalValue = products.reduce((sum, p) => sum + (Number(p.stock_quantity) * Number(p.sale_price || 0)), 0);

  if (loading) return <p className="muted">Chargement de l'inventaire...</p>;

  return (
    <section>
      <div className="page-heading records-heading" style={{ marginBottom: '1.5rem' }}>
        <div>
          <p className="eyebrow">LOGISTIQUE · INVENTAIRE</p>
          <h1>Produits et stock</h1>
          <p className="muted">Gérez vos médicaments et évitez les ruptures.</p>
        </div>
        <button className="button primary-button" type="button">＋ Nouveau produit</button>
      </div>

      {/* BANDEAU DE STATISTIQUES STOCK */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '8px', borderLeft: '4px solid #10b981', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280', fontWeight: 500 }}>Valeur du stock</p>
          <h2 style={{ margin: '0.5rem 0 0 0', color: '#111827' }}>{totalValue.toFixed(2)} €</h2>
        </div>
        <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '8px', borderLeft: '4px solid #f59e0b', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280', fontWeight: 500 }}>Produits total</p>
          <h2 style={{ margin: '0.5rem 0 0 0', color: '#111827' }}>{products.length}</h2>
        </div>
        <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '8px', borderLeft: '4px solid #ef4444', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280', fontWeight: 500 }}>Alertes de rupture</p>
          <h2 style={{ margin: '0.5rem 0 0 0', color: '#dc2626' }}>{totalAlerts}</h2>
        </div>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}

      {/* BARRE DE RECHERCHE ET FILTRES */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', width: '100%', maxWidth: '600px' }}>
          <input 
            type="text" 
            placeholder="Rechercher un médicament ou un code..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, padding: '0.5rem 1rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
          />
          <button 
            onClick={() => setShowOnlyAlerts(!showOnlyAlerts)}
            className={`button ${showOnlyAlerts ? 'primary-button' : 'secondary-button'}`}
            style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', whiteSpace: 'nowrap' }}
          >
            ⚠️ Alertes uniquement
          </button>
        </div>
        <span className="result-count">{filteredProducts.length} produit(s)</span>
      </div>

      {/* TABLEAU DU STOCK */}
      <div className="table-wrap" style={{ background: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
            <tr>
              <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', color: '#6b7280' }}>Code SKU</th>
              <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', color: '#6b7280' }}>Produit</th>
              <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', color: '#6b7280' }}>Catégorie</th>
              <th style={{ padding: '1rem', textAlign: 'right', fontSize: '0.875rem', color: '#6b7280' }}>Prix Vente</th>
              <th style={{ padding: '1rem', textAlign: 'center', fontSize: '0.875rem', color: '#6b7280' }}>Stock</th>
              <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', color: '#6b7280' }}>État</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map((product) => {
              const isOutOfStock = product.stock_quantity === 0;
              const isAlert = product.stock_quantity <= product.stock_alert_threshold;

              return (
                <tr key={product.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '1rem', fontSize: '0.875rem', color: '#6b7280' }}>{product.sku}</td>
                  <td style={{ padding: '1rem', fontWeight: 500 }}>{product.name}</td>
                  <td style={{ padding: '1rem', fontSize: '0.875rem', color: '#4b5563' }}>{product.category}</td>
                  <td style={{ padding: '1rem', textAlign: 'right', fontSize: '0.875rem' }}>
                    {Number(product.sale_price || 0).toFixed(2)} €
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'center', fontWeight: 700, color: isAlert ? '#dc2626' : '#111827' }}>
                    {product.stock_quantity}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    {isOutOfStock ? (
                      <span style={{ padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600, background: '#fee2e2', color: '#991b1b' }}>
                        Rupture
                      </span>
                    ) : isAlert ? (
                      <span style={{ padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600, background: '#fef3c7', color: '#92400e' }}>
                        Stock bas
                      </span>
                    ) : (
                      <span style={{ padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600, background: '#dcfce7', color: '#166534' }}>
                        OK
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredProducts.length === 0 && (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>
            Aucun produit trouvé.
          </div>
        )}
      </div>
    </section>
  );
}