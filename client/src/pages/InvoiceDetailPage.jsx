import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { http } from '../api/http.js';

const STATUS_LABELS = {
  DRAFT: 'Brouillon', SENT: 'Envoyée', PARTIALLY_PAID: 'Partiellement payée',
  PAID: 'Payée', CANCELLED: 'Annulée', OVERDUE: 'En retard',
};

const PAYMENT_METHODS = {
  CASH: 'Espèces', CARD: 'Carte', BANK_TRANSFER: 'Virement', CHEQUE: 'Chèque',
};

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const [invoice, setInvoice] = useState(null);
  const [error, setError] = useState('');
  const [paymentForm, setPaymentForm] = useState({ amount: '', payment_method: 'CASH', notes: '' });
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  async function loadInvoice() {
    try {
      const { data } = await http.get(`/invoices/${id}`);
      setInvoice(data.data);
      setError('');
    } catch (requestError) {
      setError(requestError.response?.data?.message ?? 'Impossible de charger la facture.');
    }
  }

  useEffect(() => { loadInvoice(); }, [id]);

  async function submitPayment(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await http.post(`/invoices/${id}/payments`, {
        amount: Number(paymentForm.amount),
        payment_method: paymentForm.payment_method,
        notes: paymentForm.notes || null,
      });
      setPaymentOpen(false);
      setPaymentForm({ amount: '', payment_method: 'CASH', notes: '' });
      await loadInvoice();
    } catch (requestError) {
      setError(requestError.response?.data?.message ?? 'Impossible d’enregistrer le paiement.');
    } finally {
      setSaving(false);
    }
  }

  async function cancelInvoice() {
    if (!window.confirm('Annuler cette facture ? Cette action est irréversible.')) return;
    try {
      await http.post(`/invoices/${id}/cancel`);
      await loadInvoice();
    } catch (requestError) {
      setError(requestError.response?.data?.message ?? 'Annulation impossible.');
    }
  }

  if (error && !invoice) return <p className="form-error" role="alert">{error}</p>;
  if (!invoice) return <p className="muted">Chargement de la facture…</p>;

  const remaining = Number(invoice.balance_amount);

  return (
    <section>
      <p className="eyebrow"><Link to="/invoices">FACTURES</Link> · {invoice.invoice_number}</p>
      <div className="page-heading records-heading">
        <div>
          <h1>{invoice.invoice_number}</h1>
          <p className="muted">
            {invoice.client_first_name} {invoice.client_last_name}
            {invoice.animal_name ? ` · ${invoice.animal_name}` : ''}
          </p>
        </div>
        <div>
          <Link className="button secondary-button" to="/invoices">Retour</Link>
          {remaining > 0 && invoice.status !== 'CANCELLED' && (
            <button className="button primary-button" type="button" onClick={() => setPaymentOpen(true)} style={{ marginLeft: 8 }}>
              ＋ Enregistrer un paiement
            </button>
          )}
          {invoice.status !== 'CANCELLED' && invoice.status !== 'PAID' && (
            <button className="text-button danger-text" type="button" onClick={cancelInvoice} style={{ marginLeft: 8 }}>
              Annuler la facture
            </button>
          )}
        </div>
      </div>

      <div className="detail-grid">
        <section className="detail-section">
          <h2>Informations</h2>
          <dl>
            <dt>Statut</dt><dd>{STATUS_LABELS[invoice.status]}</dd>
            <dt>Émise le</dt><dd>{new Date(invoice.issue_date).toLocaleDateString('fr-FR')}</dd>
            <dt>Échéance</dt><dd>{invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('fr-FR') : '—'}</dd>
            <dt>Total</dt><dd><strong>{Number(invoice.total_amount).toFixed(2)} €</strong></dd>
            <dt>Payé</dt><dd>{Number(invoice.paid_amount).toFixed(2)} €</dd>
            <dt>Solde</dt><dd><strong>{remaining.toFixed(2)} €</strong></dd>
          </dl>
          {invoice.notes && <p className="muted">{invoice.notes}</p>}
        </section>

        <section className="detail-section">
          <h2>Paiements</h2>
          {invoice.payments.length === 0 ? (
            <p className="muted">Aucun paiement enregistré.</p>
          ) : (
            <ul className="linked-record-list">
              {invoice.payments.map((payment) => (
                <li key={payment.id}>
                  <div>
                    <strong>{Number(payment.amount).toFixed(2)} €</strong>
                    <span>{PAYMENT_METHODS[payment.payment_method]} · {new Date(payment.paid_at).toLocaleDateString('fr-FR')}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <h2 style={{ marginTop: 24 }}>Lignes de la facture</h2>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Description</th>
              <th>Quantité</th>
              <th>Prix unitaire</th>
              <th>TVA</th>
              <th>Total ligne</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line) => (
              <tr key={line.id}>
                <td>{line.description}</td>
                <td>{Number(line.quantity).toFixed(2)}</td>
                <td>{Number(line.unit_price).toFixed(2)} €</td>
                <td>{Number(line.vat_rate).toFixed(2)} %</td>
                <td><strong>{Number(line.line_total).toFixed(2)} €</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {paymentOpen && (
        <form className="record-form" onSubmit={submitPayment} style={{ marginTop: 24 }}>
          <div className="record-form-heading">
            <h2>Nouveau paiement</h2>
            <button className="icon-button" type="button" aria-label="Fermer" onClick={() => setPaymentOpen(false)}>×</button>
          </div>
          <div className="form-grid">
            <label>Montant (€)
              <input type="number" step="0.01" min="0.01" max={remaining} required
                value={paymentForm.amount}
                onChange={(event) => setPaymentForm({ ...paymentForm, amount: event.target.value })} />
            </label>
            <label>Méthode
              <select value={paymentForm.payment_method}
                onChange={(event) => setPaymentForm({ ...paymentForm, payment_method: event.target.value })}>
                <option value="CASH">Espèces</option>
                <option value="CARD">Carte</option>
                <option value="BANK_TRANSFER">Virement</option>
                <option value="CHEQUE">Chèque</option>
              </select>
            </label>
            <label className="field-wide">Notes
              <textarea rows="2" maxLength={5000}
                value={paymentForm.notes}
                onChange={(event) => setPaymentForm({ ...paymentForm, notes: event.target.value })} />
            </label>
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="form-actions">
            <button className="button secondary-button" type="button" onClick={() => setPaymentOpen(false)}>Annuler</button>
            <button className="button primary-button" type="submit" disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer le paiement'}</button>
          </div>
        </form>
      )}
    </section>
  );
}