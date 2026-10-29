import { useEffect, useState } from 'react';
import { Link, Navigate, NavLink, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth/AuthContext.jsx';
import AnimalDetailPage from './pages/AnimalDetailPage.jsx';
import AnimalsPage from './pages/AnimalsPage.jsx';
import ClientDetailPage from './pages/ClientDetailPage.jsx';
import ClientsPage from './pages/ClientsPage.jsx';
import ChangePasswordPage from './pages/ChangePasswordPage.jsx';
import AppointmentsPage from './pages/AppointmentsPage.jsx';
import ConsultationPage from './pages/ConsultationPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import NotificationsMenu from './components/NotificationsMenu.jsx';
import RecordsPage from './pages/RecordsPage.jsx';
import InvoicesPage from './pages/InvoicesPage.jsx';
import InvoiceDetailPage from './pages/InvoiceDetailPage.jsx';
import ServicePricesPage from './pages/ServicePricesPage.jsx';
import { http } from './api/http.js';
import ProductsPage from './pages/ProductsPage.jsx';

const navigation = [
  { to: '/', label: 'Tableau de bord', icon: '◫', end: true },
  { to: '/clients', label: 'Clients', icon: '♧', permission: 'clients.read' },
  { to: '/animals', label: 'Animaux', icon: '⌑', permission: 'animals.read' },
  { to: '/appointments', label: 'Rendez-vous', icon: '▦', permission: 'appointments.read' },
  { to: '/invoices', label: 'Factures & Impayés', icon: '€', permission: 'invoices.read' },
  { to: '/invoices/services/prices', label: 'Tarifs', icon: 'T', permission: 'invoices.read' },
  { to: '/records/products', label: 'Produits et stock', icon: 'P', permission: 'products.read' },
  { to: '/records/staff', label: 'Personnel', icon: 'E', permission: 'staff.read' },
  { to: '/records/audit', label: 'Journal', icon: 'J', permission: 'audit.read' },
];

function ProtectedLayout() {
  const { token, user, logout, hasPermission } = useAuth();
  const location = useLocation();
  if (!token) return <Navigate to="/login" state={{ from: location.pathname }} replace />;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" to="/" aria-label="Cabinet vétérinaire, accueil">
          <img className="brand-mark" src="/logo-mark.svg" alt="" />
          <span><strong>Cabinet</strong><small>VÉTÉRINAIRE</small></span>
        </Link>
        <p className="nav-caption">ESPACE CLINIQUE</p>
        <nav aria-label="Navigation principale">
          {navigation.filter((item) => !item.permission || hasPermission(item.permission)).map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              <span className="nav-icon" aria-hidden="true">{item.icon}</span>{item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="avatar">{user?.firstName?.slice(0, 1)}{user?.lastName?.slice(0, 1)}</span>
          <span><strong>{user?.firstName} {user?.lastName}</strong><small>{user?.roles?.join(', ') || 'Utilisateur'}</small></span>
        </div>
      </aside>
      <main className="main-content">
        <header className="topbar">
          <span>Gestion vétérinaire</span>
          <div className="topbar-actions">
            <Link className="text-button" to="/settings/password">Mot de passe</Link>
            <button className="text-button" type="button" onClick={logout}>Déconnexion</button>
          </div>
        </header>
        <div className="page-content"><Outlet /></div>
        {hasPermission('notifications.read') && <NotificationsMenu />}
      </main>
    </div>
  );
}

function PermissionRoute({ permission, children }) {
  const { hasPermission } = useAuth();
  if (!hasPermission(permission)) return <section className="empty-state"><p className="eyebrow">ACCÈS RESTREINT</p><h1>Permission requise</h1><p className="muted">Votre compte n’a pas accès à ce dossier.</p></section>;
  return children;
}

function DashboardPage() {
  // Récupération de l'utilisateur AVANT les hooks conditionnels pour éviter le warning
  const { user, hasPermission } = useAuth(); 
  const [indicators, setIndicators] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hasPermission('dashboard.read')) {
      setLoading(false);
      return;
    }
    http.get('/dashboard/indicators')
      .then(({ data }) => setIndicators(data.data))
      .catch(() => setIndicators(null))
      .finally(() => setLoading(false));
  }, [hasPermission]); // Ajout de la dépendance pour être propre

  if (loading) return <p className="muted">Chargement des indicateurs...</p>;

  const stats = indicators || {
    appointments_today: 0,
    active_hospitalizations: 0,
    active_clients: 0,
    active_animals: 0,
    low_stock_products: 0,
    outstanding_invoices: 0,
    outstanding_amount: 0
  };

  const totalImpaye = Number(stats.outstanding_amount) || 0;

  return (
    <>
      <div className="page-heading" style={{ marginBottom: '2rem' }}>
        <div>
          <p className="eyebrow">CABINET · ESPACE DE TRAVAIL</p>
          <h1>Bonjour, {user?.firstName}</h1>
          <p className="muted">Voici l'état de votre cabinet aujourd'hui.</p>
        </div>
        <span className="connection"><span /> Session sécurisée</span>
      </div>

      {/* ALERTE STOCK */}
      {stats.low_stock_products > 0 && (
        <div style={{ background: '#fee2e2', borderLeft: '4px solid #ef4444', padding: '1rem', borderRadius: '4px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <strong style={{ color: '#991b1b', display: 'block', marginBottom: '0.25rem' }}>⚠️ Alerte de rupture de stock</strong>
            <span style={{ color: '#7f1d1d', fontSize: '0.875rem' }}>Vous avez {stats.low_stock_products} produit(s) qui ont atteint leur seuil critique.</span>
          </div>
          <Link to="/records/products" className="button" style={{ background: '#fff', color: '#991b1b', border: '1px solid #fca5a5', fontSize: '0.875rem' }}>Voir le stock</Link>
        </div>
      )}

      {/* CARTES DE STATISTIQUES */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
        
        {/* Carte Clients */}
        <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280', fontWeight: 500 }}>Clients Actifs</p>
              <h2 style={{ margin: '0.5rem 0 0 0', fontSize: '2rem', color: '#111827' }}>{stats.active_clients}</h2>
            </div>
            <div style={{ background: '#e0f2fe', color: '#0369a1', padding: '0.75rem', borderRadius: '8px' }}>♧</div>
          </div>
          <div style={{ marginTop: '1rem', fontSize: '0.875rem', color: '#6b7280' }}>
            <strong style={{ color: '#16a34a' }}>{stats.active_animals}</strong> animaux suivis
          </div>
        </div>

        {/* Carte Impayés */}
        <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderTop: '4px solid #ef4444' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280', fontWeight: 500 }}>Impayés en cours</p>
              <h2 style={{ margin: '0.5rem 0 0 0', fontSize: '2rem', color: '#111827' }}>
                {totalImpaye.toFixed(2)} €
              </h2>
            </div>
            <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '0.75rem', borderRadius: '8px' }}>€</div>
          </div>
          <div style={{ marginTop: '1rem', fontSize: '0.875rem', color: '#6b7280' }}>
            <strong style={{ color: '#b91c1c' }}>{stats.outstanding_invoices}</strong> factures à relancer
          </div>
        </div>

        {/* Carte Rendez-vous */}
        <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280', fontWeight: 500 }}>Rendez-vous aujourd'hui</p>
              <h2 style={{ margin: '0.5rem 0 0 0', fontSize: '2rem', color: '#111827' }}>{stats.appointments_today}</h2>
            </div>
            <div style={{ background: '#f3e8ff', color: '#7e22ce', padding: '0.75rem', borderRadius: '8px' }}>▦</div>
          </div>
          <div style={{ marginTop: '1rem', fontSize: '0.875rem', color: '#6b7280' }}>
            <strong style={{ color: '#111827' }}>{stats.active_hospitalizations}</strong> animaux hospitalisés
          </div>
        </div>

      </section>

      {/* ACCÈS RAPIDE */}
      <h2 style={{ fontSize: '1.25rem', color: '#111827', marginBottom: '1rem' }}>Accès rapide</h2>
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <Link to="/invoices" style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: '#fff', padding: '1rem', borderRadius: '8px', textDecoration: 'none', color: '#111827', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', border: '1px solid #e5e7eb' }}>
          <span style={{ fontSize: '1.5rem' }}>💰</span>
          <div>
            <strong style={{ display: 'block' }}>Facturer</strong>
            <small style={{ color: '#6b7280' }}>Créer ou régler</small>
          </div>
        </Link>
        <Link to="/records/products" style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: '#fff', padding: '1rem', borderRadius: '8px', textDecoration: 'none', color: '#111827', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', border: '1px solid #e5e7eb' }}>
          <span style={{ fontSize: '1.5rem' }}>📦</span>
          <div>
            <strong style={{ display: 'block' }}>Gérer le stock</strong>
            <small style={{ color: '#6b7280' }}>Médicaments</small>
          </div>
        </Link>
        <Link to="/clients" style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: '#fff', padding: '1rem', borderRadius: '8px', textDecoration: 'none', color: '#111827', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', border: '1px solid #e5e7eb' }}>
          <span style={{ fontSize: '1.5rem' }}>👤</span>
          <div>
            <strong style={{ display: 'block' }}>Nouveau client</strong>
            <small style={{ color: '#6b7280' }}>Créer un dossier</small>
          </div>
        </Link>
      </section>
    </>
  );
}

function ComingSoonPage() {
  return <section className="empty-state"><p className="eyebrow">MODULE</p><h1>Cette phase reste à réaliser</h1><p className="muted">Les routes métier non encore livrées ne sont pas présentées comme opérationnelles.</p></section>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="clients" element={<PermissionRoute permission="clients.read"><ClientsPage /></PermissionRoute>} />
        <Route path="clients/:id" element={<PermissionRoute permission="clients.read"><ClientDetailPage /></PermissionRoute>} />
        <Route path="animals" element={<PermissionRoute permission="animals.read"><AnimalsPage /></PermissionRoute>} />
        <Route path="animals/:id" element={<PermissionRoute permission="animals.read"><AnimalDetailPage /></PermissionRoute>} />
        <Route path="appointments" element={<PermissionRoute permission="appointments.read"><AppointmentsPage /></PermissionRoute>} />
        <Route path="appointments/:id/consultation" element={<PermissionRoute permission="consultations.create"><ConsultationPage /></PermissionRoute>} />
        <Route path="invoices" element={<PermissionRoute permission="invoices.read"><InvoicesPage /></PermissionRoute>} />
        <Route path="invoices/services/prices" element={<PermissionRoute permission="invoices.read"><ServicePricesPage /></PermissionRoute>} />
        <Route path="invoices/:id" element={<PermissionRoute permission="invoices.read"><InvoiceDetailPage /></PermissionRoute>} />
        <Route path="records/products" element={<PermissionRoute permission="products.read"><ProductsPage /></PermissionRoute>} />
        <Route path="records/:resource" element={<RecordsPage />} />
        <Route path="settings/password" element={<ChangePasswordPage />} />
        <Route path="*" element={<ComingSoonPage />} />
      </Route>
    </Routes>
  );
}