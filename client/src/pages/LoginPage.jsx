import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';

export default function LoginPage() {
  const { token, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const notice = location.state?.message;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  if (token) return <Navigate to={location.state?.from ?? '/'} replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    setPending(true);
    setError('');
    try {
      await login({ email, password });
      navigate(location.state?.from ?? '/', { replace: true });
    } catch (requestError) {
      setError(requestError.response?.data?.message ?? 'Connexion impossible. Vérifiez l’API et vos identifiants.');
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="login-page">
      <div className="login-shell">
        <section className="login-panel" aria-labelledby="login-title">
          <div className="login-heading">
            <p className="eyebrow">ESPACE CLINIQUE</p>
            <h1 id="login-title">Connexion</h1>
            <p className="muted">Accédez aux dossiers et outils du cabinet.</p>
          </div>
          {notice && <p className="form-notice" role="status">{notice}</p>}
          <form className="form-stack login-form" onSubmit={handleSubmit}>
            <label htmlFor="login-email">Adresse e-mail</label>
            <input id="login-email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={254} />
            <label htmlFor="login-password">Mot de passe</label>
            <input id="login-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required maxLength={72} />
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="button primary-button" type="submit" disabled={pending}>{pending ? 'Connexion…' : 'Se connecter'}</button>
          </form>
          <p className="login-footnote">Accès réservé à l’équipe du cabinet</p>
        </section>
        <aside className="login-brand-panel" aria-label="Cabinet vétérinaire">
          <img className="full-logo" src="/logo.svg" alt="Cabinet Vétérinaire. Des soins pour tous vos compagnons : chiens, chats, NAC et élevage." />
        </aside>
      </div>
    </main>
  );
}