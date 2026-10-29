import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';

export default function ChangePasswordPage() {
  const { changePassword } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    if (newPassword !== confirmation) {
      setError('Les deux nouveaux mots de passe ne correspondent pas.');
      return;
    }

    setPending(true);
    try {
      await changePassword(currentPassword, newPassword);
      navigate('/login', { replace: true, state: { message: 'Mot de passe modifié. Connectez-vous avec le nouveau.' } });
    } catch (requestError) {
      setError(requestError.response?.data?.message ?? 'Impossible de modifier le mot de passe.');
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="password-page">
      <p className="eyebrow">SÉCURITÉ DU COMPTE</p>
      <h1>Changer le mot de passe</h1>
      <p className="muted">Choisissez au moins 12 caractères. Toutes les sessions actives seront fermées.</p>
      <form className="record-form password-form" onSubmit={handleSubmit}>
        <label>Mot de passe actuel<input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required maxLength={72} /></label>
        <label>Nouveau mot de passe<input type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required minLength={12} maxLength={72} /></label>
        <label>Confirmer le nouveau mot de passe<input type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required minLength={12} maxLength={72} /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="form-actions"><Link className="button secondary-button" to="/">Annuler</Link><button className="button primary-button" type="submit" disabled={pending}>{pending ? 'Modification…' : 'Changer le mot de passe'}</button></div>
      </form>
    </section>
  );
}