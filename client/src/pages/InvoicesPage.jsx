import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { http } from '../api/http.js';

const STATUS_LABELS = {
  DRAFT: 'Brouillon',
  SENT: 'Envoyée',
  PARTIALLY_PAID: 'Partiel',
  PAID: 'Payée',
  CANCELLED: 'Annulée',
  OVERDUE: 'En retard',
};

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 0 });
  const [filterStatus, setFilterStatus] = useState('');
  const [error, setError] = useState('');
  
  // Statistiques rapides (calculées à partir de la page actuelle pour la démo)
  const totalEncaisse = invoices.reduce((sum, inv) => sum + Number(inv.paid_amount), 0);
  const totalImpaye = invoices.reduce((sum, inv) => sum + Number(inv.balance_amount), 0);
  const facturesEnRetard = invoices.filter(inv => inv.status === 'OVERDUE' || (inv.status !== 'PAID' && inv.status !== 'CANCELLED' && new Date(inv.due_date) < new Date())).length;

  useEffect(() => {
    let active = true;
    http.get('/invoices', {
      params: { status: filterStatus || undefined, page: pagination.page, pageSize: pagination.pageSize },
    })
      .then(({ data }) => {
        if (!active) return;
        setInvoices(data.data);
        setPagination(data.pagination);
        setError('');
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message ?? 'Impossible de charger les factures.');
      });
    return () => { active = false; };
  }, [filterStatus, pagination.page, pagination.pageSize]);

  // Fonction pour déterminer la couleur du badge
  const getBadgeStyle = (status, dueDate) => {
    if (status === 'PAID') return { background: '#dcfce7', color: '#166534' }; // Vert
    if (status === 'CANCELLED') return { background: '#f3f4f6', color: '#4b5563' }; // Gris
    
    // Si c'est en retard (date dépassée et pas payé)
    if (dueDate && new Date(dueDate) < new Date() && status !== 'PAID') {
      return { background: '#fee2e2', color: '#991b1b' }; // Rouge
    }
    
    if (status === 'PARTIALLY_PAID') return { background: '#ffedd5', color: '#c2410c' }; // Orange
    return { background: '#dbeafe', color: '#1e40af' }; // Bleu par défaut
  };

  return (
    <section>
      <div className="page-heading records-heading" style={{ marginBottom: '1.5rem' }}>
        <div>
          <p className="eyebrow">FINANCES · FACTURATION</p>
          <h1>Gestion des factures</h1>
          <p className="muted">Suivez vos encaissements et relancez vos impayés.</p>
        </div>
        <div>
           {/* Bouton d'action principal (à relier plus tard à la création manuelle) */}
           <button className="button primary-button" type="button">＋ Nouvelle facture</button>
        </div>
      </div>

      {/* BANDEAU DE STATISTIQUES (Inspiré des logiciels pros) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '8px', borderLeft: '4px solid #10b981', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280', fontWeight: 500 }}>Total Encaissé (Page)</p>
          <h2 style={{ margin: '0.5rem 0 0 0', color: '#111827' }}>{totalEncaisse.toFixed(2)} €</h2>
        </div>
        <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '8px', borderLeft: '4px solid #ef4444', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280', fontWeight: 500 }}>Reste à percevoir</p>
          <h2 style={{ margin: '0.5rem 0 0 0', color: '#111827' }}>{totalImpaye.toFixed(2)} €</h2>
        </div>
        <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '8px', borderLeft: '4px solid #f59e0b', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280', fontWeight: 500 }}>Factures en retard</p>
          <h2 style={{ margin: '0.5rem 0 0 0', color: '#111827' }}>{facturesEnRetard}</h2>
        </div>
      </div>

      {/* FILTRES RAPIDES */}
      <div className="toolbar-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            onClick={() => setFilterStatus('')} 
            className={`button ${filterStatus === '' ? 'primary-button' : 'secondary-button'}`}
            style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
          >
            Toutes
          </button>
          <button 
            onClick={() => setFilterStatus('SENT')} 
            className={`button ${filterStatus === 'SENT' ? 'primary-button' : 'secondary-button'}`}
            style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
          >
            À encaisser
          </button>
          <button 
            onClick={() => setFilterStatus('PARTIALLY_PAID')} 
            className={`button ${filterStatus === 'PARTIALLY_PAID' ? 'primary-button' : 'secondary-button'}`}
            style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
          >
            Partielles
          </button>
        </div>
        <span className="result-count">{pagination.total} facture{pagination.total === 1 ? '' : 's'}</span>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}

      {/* TABLEAU DES FACTURES */}
      <div className="table-wrap" style={{ background: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
            <tr>
              <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', color: '#6b7280' }}>N° Facture</th>
              <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', color: '#6b7280' }}>Client</th>
              <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', color: '#6b7280' }}>Échéance</th>
              <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', color: '#6b7280' }}>Statut</th>
              <th style={{ padding: '1rem', textAlign: 'right', fontSize: '0.875rem', color: '#6b7280' }}>Total</th>
              <th style={{ padding: '1rem', textAlign: 'right', fontSize: '0.875rem', color: '#6b7280' }}>Reste à payer</th>
              <th style={{ padding: '1rem' }}></th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => (
              <tr key={invoice.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                <td style={{ padding: '1rem' }}>
                  <Link className="primary-cell" to={`/invoices/${invoice.id}`} style={{ fontWeight: 600, color: '#0f766e' }}>
                    {invoice.invoice_number}
                  </Link>
                </td>
                <td style={{ padding: '1rem' }}>
                  <div style={{ fontWeight: 500 }}>{invoice.client_first_name} {invoice.client_last_name}</div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{invoice.animal_name || '—'}</div>
                </td>
                <td style={{ padding: '1rem', fontSize: '0.875rem', color: '#4b5563' }}>
                  {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('fr-FR') : '—'}
                </td>
                <td style={{ padding: '1rem' }}>
                  <span style={{ 
                    padding: '0.25rem 0.75rem', 
                    borderRadius: '9999px', 
                    fontSize: '0.75rem', 
                    fontWeight: 600,
                    ...getBadgeStyle(invoice.status, invoice.due_date)
                  }}>
                    {STATUS_LABELS[invoice.status] || invoice.status}
                  </span>
                </td>
                <td style={{ padding: '1rem', textAlign: 'right', fontSize: '0.875rem' }}>
                  {Number(invoice.total_amount).toFixed(2)} €
                </td>
                <td style={{ padding: '1rem', textAlign: 'right' }}>
                  <span style={{ 
                    fontWeight: 700, 
                    color: Number(invoice.balance_amount) > 0 ? '#dc2626' : '#16a34a' 
                  }}>
                    {Number(invoice.balance_amount).toFixed(2)} €
                  </span>
                </td>
                <td style={{ padding: '1rem', textAlign: 'right' }}>
                  <Link className="text-button" to={`/invoices/${invoice.id}`} style={{ fontSize: '0.875rem' }}>
                    Ouvrir
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {invoices.length === 0 && !error && (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>
            Aucune facture trouvée.
          </div>
        )}
      </div>

      {/* PAGINATION */}
      <div className="pagination" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem' }}>
        <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
          Page {pagination.page} sur {Math.max(pagination.totalPages, 1)}
        </span>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="button secondary-button" type="button" disabled={pagination.page <= 1} onClick={() => setPagination((current) => ({ ...current, page: current.page - 1 }))}>Précédent</button>
          <button className="button secondary-button" type="button" disabled={pagination.page >= pagination.totalPages} onClick={() => setPagination((current) => ({ ...current, page: current.page + 1 }))}>Suivant</button>
        </div>
      </div>
    </section>
  );
}