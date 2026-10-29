import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { http } from '../api/http.js';
import { useAuth } from '../auth/AuthContext.jsx';

const resources = {
  hospitalizations: { title: 'Hospitalisations', endpoint: '/hospitalizations', permission: 'hospitalizations.read', columns: ['animal_name', 'client_first_name', 'client_last_name', 'ward_name', 'status', 'admitted_at', 'expected_discharge_at'] },
  products: { title: 'Produits et stock', endpoint: '/products', permission: 'products.read', columns: ['sku', 'name', 'category', 'stock_quantity', 'stock_alert_threshold', 'status'] },
  laboratory: { title: 'Demandes d’analyse', endpoint: '/laboratory-requests', permission: 'laboratory.read', columns: ['analysis_type', 'animal_name', 'client_first_name', 'client_last_name', 'laboratory_name', 'status', 'requested_at'] },
  documents: { title: 'Documents', endpoint: '/documents', permission: 'documents.read', columns: ['file_name', 'category', 'mime_type', 'size_bytes', 'description', 'created_at'] },
  suppliers: { title: 'Fournisseurs', endpoint: '/suppliers', permission: 'suppliers.read', columns: ['name', 'contact_name', 'email', 'phone', 'status'] },
  orders: { title: 'Commandes fournisseurs', endpoint: '/purchase-orders', permission: 'purchase_orders.read', columns: ['order_number', 'supplier_name', 'status', 'ordered_at', 'expected_at'] },
  lots: { title: 'Lots', endpoint: '/lots', permission: 'lots.read', columns: ['product_name', 'supplier_name', 'lot_number', 'expires_on', 'quantity_received', 'quantity_remaining'] },
  returns: { title: 'Retours fournisseurs', endpoint: '/returns', permission: 'returns.read', columns: ['supplier_name', 'product_name', 'lot_id', 'quantity', 'reason', 'status', 'requested_at'] },
  staff: { title: 'Personnel', endpoint: '/staff', permission: 'staff.read', columns: ['staff_number', 'first_name', 'last_name', 'email', 'staff_type', 'specialty', 'status'] },
  payments: { title: 'Demandes de paiement', endpoint: '/payment-requests', permission: 'payment_requests.read', columns: ['request_number', 'invoice_number', 'client_first_name', 'client_last_name', 'amount', 'status', 'requested_at'] },
  messages: { title: 'Messages reçus', endpoint: '/messages', permission: 'messages.read', columns: ['other_first_name', 'other_last_name', 'subject', 'content', 'read_at', 'created_at'] },
  insurance: { title: 'Contrats d’assurance', endpoint: '/insurance/policies', permission: 'insurance.read', columns: ['insurer_name', 'policy_number', 'client_first_name', 'client_last_name', 'animal_name', 'coverage_type', 'status', 'valid_until'] },
  claims: { title: 'Dossiers d’assurance', endpoint: '/insurance/claims', permission: 'insurance.read', columns: ['claim_number', 'insurer_name', 'policy_number', 'amount', 'status', 'submitted_at', 'created_at'] },
  audit: { title: 'Journal des actions', endpoint: '/audit-logs', permission: 'audit.read', columns: ['action', 'entity_type', 'entity_id', 'first_name', 'last_name', 'ip_address', 'created_at'] },
};

function label(value) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function display(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export default function RecordsPage() {
  const { resource } = useParams();
  const { user } = useAuth();
  const config = resources[resource];
  const canRead = Boolean(user?.permissions?.includes(config?.permission));
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 0 });
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    if (!config || !canRead) return () => { active = false; };
    http.get(config.endpoint, { params: { page: pagination.page, pageSize: pagination.pageSize, ...(resource === 'messages' ? { folder: 'inbox' } : {}) } })
      .then(({ data: result }) => {
        if (!active) return;
        setData(result.data);
        if (result.pagination) setPagination((current) => ({ ...current, ...result.pagination }));
        setError('');
      })
      .catch(() => { if (active) setError('Impossible de charger ces dossiers.'); });
    return () => { active = false; };
  }, [canRead, config, pagination.page, pagination.pageSize, resource]);

  if (!config) return <section className="empty-state"><h1>Module introuvable</h1><Link className="text-link" to="/">Retour à l’accueil</Link></section>;
  if (!canRead) return <section className="empty-state"><h1>Accès restreint</h1><p className="muted">Votre compte n’a pas accès à ce module.</p></section>;

  return (
    <>
      <div className="page-heading"><div><p className="eyebrow">ESPACE DE GESTION</p><h1>{config.title}</h1><p className="muted">{pagination.total} dossier(s)</p></div></div>
      {error && <p className="form-error">{error}</p>}
      <div className="records-table-wrap"><table className="data-table"><thead><tr>{config.columns.map((column) => <th key={column}>{label(column)}</th>)}</tr></thead>
        <tbody>{data.map((row) => <tr key={row.id}>{config.columns.map((column) => <td key={column}>{display(row[column])}</td>)}</tr>)}
          {data.length === 0 && !error && <tr><td colSpan={config.columns.length}>Aucun dossier.</td></tr>}
        </tbody>
      </table></div>
      <div className="pagination-row"><button className="button button-secondary" type="button" disabled={pagination.page <= 1} onClick={() => setPagination((current) => ({ ...current, page: current.page - 1 }))}>Précédent</button>
        <span>Page {pagination.page} sur {Math.max(1, pagination.totalPages)}</span>
        <button className="button button-secondary" type="button" disabled={pagination.page >= pagination.totalPages} onClick={() => setPagination((current) => ({ ...current, page: current.page + 1 }))}>Suivant</button>
      </div>
    </>
  );
}
