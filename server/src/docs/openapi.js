export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'API Cabinet veterinaire',
    version: '1.0.0',
    description: 'API REST versionnee de gestion veterinaire.',
  },
  servers: [{ url: '/api/v1' }],
  paths: {
    '/health': {
      get: {
        summary: 'Verifier que le serveur repond',
        responses: { 200: { description: 'API disponible' } },
      },
    },
    '/ready': {
      get: {
        summary: 'Verifier la connexion a MySQL',
        responses: {
          200: { description: 'API et base de donnees disponibles' },
          500: { description: 'Base de donnees indisponible' },
        },
      },
    },
    '/auth/login': {
      post: {
        summary: 'Ouvrir une session',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['email', 'password'], properties: { email: { type: 'string', format: 'email' }, password: { type: 'string', format: 'password' } } } } } },
        responses: { 200: { description: 'Session ouverte' }, 401: { description: 'Identifiants invalides' }, 422: { description: 'Données invalides' } },
      },
    },
    '/auth/me': { get: { summary: 'Obtenir le compte courant', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Compte et permissions' }, 401: { description: 'Non authentifié' } } } },
    '/auth/logout': { post: { summary: 'Révoquer la session courante', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Session révoquée' }, 401: { description: 'Non authentifié' } } } },
    '/auth/change-password': { post: { summary: 'Changer le mot de passe et révoquer toutes les sessions', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Mot de passe modifié' }, 400: { description: 'Mot de passe actuel incorrect' }, 422: { description: 'Nouveau mot de passe invalide' } } } },
    '/clients': {
      get: { summary: 'Lister et rechercher les clients', security: [{ bearerAuth: [] }], parameters: [{ in: 'query', name: 'search', schema: { type: 'string' } }, { in: 'query', name: 'page', schema: { type: 'integer', minimum: 1 } }, { in: 'query', name: 'pageSize', schema: { type: 'integer', minimum: 1, maximum: 100 } }], responses: { 200: { description: 'Page de clients' }, 401: { description: 'Non authentifié' }, 403: { description: 'Permission insuffisante' } } },
      post: { summary: 'Créer un client', security: [{ bearerAuth: [] }], responses: { 201: { description: 'Client créé' }, 422: { description: 'Données invalides' } } },
    },
    '/clients/{id}': {
      get: { summary: 'Consulter un client et ses animaux', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Dossier client' }, 404: { description: 'Client introuvable' } } },
      put: { summary: 'Modifier un client', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Client modifié' }, 422: { description: 'Données invalides' } } },
    },
    '/animals': {
      get: { summary: 'Lister et rechercher les animaux', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Page d animaux' } } },
      post: { summary: 'Créer un animal et ses propriétaires', security: [{ bearerAuth: [] }], responses: { 201: { description: 'Animal créé' }, 422: { description: 'Données invalides' } } },
    },
    '/animals/{id}': {
      get: { summary: 'Consulter une fiche animal', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Dossier animal' }, 404: { description: 'Animal introuvable' } } },
      put: { summary: 'Modifier un animal et ses propriétaires', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Animal modifié' }, 422: { description: 'Données invalides' } } },
    },
    '/appointments': {
      get: { summary: 'Lister les rendez-vous par date, statut ou vétérinaire', security: [{ bearerAuth: [] }], parameters: [{ in: 'query', name: 'from', schema: { type: 'string', format: 'date' } }, { in: 'query', name: 'to', schema: { type: 'string', format: 'date' } }, { in: 'query', name: 'status', schema: { type: 'string' } }], responses: { 200: { description: 'Rendez-vous paginés' }, 403: { description: 'Permission insuffisante' } } },
      post: { summary: 'Créer un rendez-vous avec contrôle de conflit vétérinaire/animal', security: [{ bearerAuth: [] }], responses: { 201: { description: 'Rendez-vous créé' }, 409: { description: 'Créneau déjà occupé' }, 422: { description: 'Données invalides' } } },
    },
    '/appointments/veterinarians': { get: { summary: 'Lister les vétérinaires actifs', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Vétérinaires actifs' } } } },
    '/appointments/{id}': {
      get: { summary: 'Consulter un rendez-vous', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Rendez-vous' }, 404: { description: 'Introuvable' } } },
      put: { summary: 'Modifier ou reprogrammer un rendez-vous avec contrôle des conflits', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Rendez-vous modifié' }, 409: { description: 'Créneau déjà occupé' } } },
    },
    '/appointments/{id}/status': { patch: { summary: 'Faire évoluer le statut selon les transitions autorisées', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Statut modifié' }, 409: { description: 'Transition interdite' } } } },
    '/consultations': {
      get: { summary: 'Historique filtré par animal, client ou période', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Consultations paginées' }, 403: { description: 'Permission médicale insuffisante' } } },
      post: { summary: 'Créer le compte rendu d’un rendez-vous en cours et le terminer', security: [{ bearerAuth: [] }], responses: { 201: { description: 'Consultation créée' }, 409: { description: 'Rendez-vous non démarré ou déjà consulté' } } },
    },
    '/consultations/{id}': {
      get: { summary: 'Consulter un compte rendu médical', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Compte rendu médical' }, 403: { description: 'Permission médicale insuffisante' } } },
      put: { summary: 'Modifier un compte rendu médical', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Compte rendu modifié' }, 422: { description: 'Données invalides' } } },
    },
    '/medical-records/acts': {
      get: { summary: 'Lister les actes par animal ou consultation', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Actes paginés' }, 403: { description: 'Permission insuffisante' } } },
      post: { summary: 'Créer un acte médical ou chirurgical lié à une consultation', security: [{ bearerAuth: [] }], responses: { 201: { description: 'Acte créé' }, 422: { description: 'Données invalides' } } },
    },
    '/medical-records/acts/{id}': { put: { summary: 'Modifier un acte médical sans effacer son historique', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Acte modifié' }, 404: { description: 'Acte introuvable' } } } },
    '/medical-records/prescriptions': {
      get: { summary: 'Lister les ordonnances', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Ordonnances paginées' } } },
      post: { summary: 'Créer une ordonnance et ses lignes de médicaments dans une transaction', security: [{ bearerAuth: [] }], responses: { 201: { description: 'Ordonnance créée' }, 422: { description: 'Données invalides' } } },
    },
    '/medical-records/prescriptions/{id}': { get: { summary: 'Consulter une ordonnance et ses lignes', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Ordonnance' }, 404: { description: 'Ordonnance introuvable' } } } },
    '/medical-records/prescriptions/{id}/status': { patch: { summary: 'Modifier le statut d’une ordonnance active', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Statut modifié' }, 409: { description: 'Transition interdite' } } } },
    '/medical-records/vaccinations': {
      get: { summary: 'Lister les vaccinations et dates de rappel', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Vaccinations paginées' } } },
      post: { summary: 'Enregistrer une vaccination et son lot', security: [{ bearerAuth: [] }], responses: { 201: { description: 'Vaccination enregistrée' }, 422: { description: 'Données invalides' } } },
    },
    '/medical-records/vaccinations/{id}': { put: { summary: 'Corriger un dossier de vaccination', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Vaccination mise à jour' }, 404: { description: 'Vaccination introuvable' } } } },
    '/hospitalizations': {
      get: { summary: 'Lister les hospitalisations par animal, client ou statut', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Hospitalisations paginées' }, 403: { description: 'Permission insuffisante' } } },
      post: { summary: 'Créer une hospitalisation', security: [{ bearerAuth: [] }], responses: { 201: { description: 'Hospitalisation créée' }, 422: { description: 'Données invalides' } } },
    },
    '/hospitalizations/{id}': { get: { summary: 'Consulter un dossier d’hospitalisation', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Hospitalisation' }, 404: { description: 'Hospitalisation introuvable' } } } },
    '/hospitalizations/{id}/status': { patch: { summary: 'Faire évoluer le statut d’une hospitalisation', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Statut mis à jour' }, 409: { description: 'Transition interdite' } } } },
    '/hospitalizations/{id}/follow-ups': { post: { summary: 'Ajouter un suivi de soins en hospitalisation', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { 201: { description: 'Suivi créé' }, 404: { description: 'Hospitalisation introuvable' } } } },
    '/products': {
      get: { summary: 'Lister le catalogue produits et stock', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Catalogue produits' }, 403: { description: 'Permission insuffisante' } } },
      post: { summary: 'Créer un produit', security: [{ bearerAuth: [] }], responses: { 201: { description: 'Produit créé' }, 422: { description: 'Données invalides' } } },
    },
    '/products/{id}': {
      get: { summary: 'Consulter un produit', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Produit' }, 404: { description: 'Produit introuvable' } } },
      put: { summary: 'Modifier un produit', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Produit modifié' }, 404: { description: 'Produit introuvable' } } },
    },
    '/products/inventory': { get: { summary: 'Aperçu du stock global', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Stock global' } } } },
    '/products/{id}/stock-movements': { post: { summary: 'Enregistrer un mouvement de stock', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { 201: { description: 'Mouvement enregistré' }, 409: { description: 'Stock insuffisant' } } } },
    '/invoices': {
      get: { summary: 'Lister les factures', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Factures paginées' } } },
      post: { summary: 'Créer une facture avec lignes', security: [{ bearerAuth: [] }], responses: { 201: { description: 'Facture créée' }, 422: { description: 'Données invalides' } } },
    },
    '/invoices/{id}': { get: { summary: 'Consulter une facture et ses lignes', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Facture' }, 404: { description: 'Facture introuvable' } } } },
    '/invoices/{id}/payments': { post: { summary: 'Enregistrer un paiement', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { 201: { description: 'Paiement enregistré' }, 422: { description: 'Montant invalide' } } } },
    '/dashboard/indicators': { get: { summary: 'Consulter les indicateurs du cabinet', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Indicateurs opérationnels et financiers' }, 403: { description: 'Permission insuffisante' } } } },
    '/laboratory-requests': {
      get: { summary: 'Lister les demandes d’analyse', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Demandes filtrées et paginées' } } },
      post: { summary: 'Créer une demande d’analyse', security: [{ bearerAuth: [] }], responses: { 201: { description: 'Demande créée' }, 422: { description: 'Données invalides' } } },
    },
    '/laboratory-requests/{id}': { patch: { summary: 'Mettre à jour une demande et son résultat', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Demande mise à jour' }, 404: { description: 'Demande introuvable' } } } },
    '/documents': {
      get: { summary: 'Lister les documents rattachés aux dossiers', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Documents paginés' } } },
      post: { summary: 'Enregistrer les métadonnées d’un document', security: [{ bearerAuth: [] }], responses: { 201: { description: 'Document enregistré' }, 422: { description: 'Données invalides' } } },
    },
    '/suppliers': {
      get: { summary: 'Lister les fournisseurs', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Fournisseurs paginés' } } },
      post: { summary: 'Créer un fournisseur', security: [{ bearerAuth: [] }], responses: { 201: { description: 'Fournisseur créé' } } },
    },
    '/suppliers/{id}': { put: { summary: 'Modifier un fournisseur', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Fournisseur modifié' }, 404: { description: 'Fournisseur introuvable' } } } },
    '/purchase-orders': {
      get: { summary: 'Lister les commandes fournisseurs', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Commandes paginées' } } },
      post: { summary: 'Créer une commande fournisseur', security: [{ bearerAuth: [] }], responses: { 201: { description: 'Commande créée' }, 422: { description: 'Données invalides' } } },
    },
    '/purchase-orders/{id}/receive': { post: { summary: 'Réceptionner des lignes et créer les lots', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Réception enregistrée' }, 409: { description: 'Quantité ou statut invalide' } } } },
    '/lots': { get: { summary: 'Lister les lots et dates de péremption', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Lots paginés' } } } },
    '/returns': {
      get: { summary: 'Lister les retours fournisseurs', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Retours paginés' } } },
      post: { summary: 'Créer une demande de retour fournisseur', security: [{ bearerAuth: [] }], responses: { 201: { description: 'Retour créé' } } },
    },
    '/returns/{id}/status': { patch: { summary: 'Approuver, refuser ou enregistrer un retour', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Statut mis à jour' }, 409: { description: 'Transition ou stock invalide' } } } },
    '/staff': {
      get: { summary: 'Lister les profils du personnel', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Personnel paginé' } } },
      post: { summary: 'Créer un profil métier pour un compte existant', security: [{ bearerAuth: [] }], responses: { 201: { description: 'Profil créé' }, 422: { description: 'Rôle utilisateur incompatible' } } },
    },
    '/staff/{id}': { put: { summary: 'Modifier un profil du personnel', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Profil modifié' }, 404: { description: 'Profil introuvable' } } } },
    '/payment-requests': {
      get: { summary: 'Lister les demandes de paiement', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Demandes paginées' } } },
      post: { summary: 'Créer une demande sur le solde disponible d’une facture', security: [{ bearerAuth: [] }], responses: { 201: { description: 'Demande créée' }, 422: { description: 'Montant supérieur au solde disponible' } } },
    },
    '/payment-requests/{id}/pay': { post: { summary: 'Enregistrer le règlement d’une demande et actualiser la facture', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Paiement enregistré' }, 409: { description: 'Demande ou solde invalide' } } } },
    '/payment-requests/{id}/cancel': { post: { summary: 'Annuler une demande de paiement non réglée', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Demande annulée' }, 409: { description: 'Demande déjà traitée' } } } },
    '/messages': {
      get: { summary: 'Consulter la boîte de réception ou les messages envoyés', security: [{ bearerAuth: [] }], parameters: [{ in: 'query', name: 'folder', schema: { type: 'string', enum: ['inbox', 'sent'] } }], responses: { 200: { description: 'Messages paginés' } } },
      post: { summary: 'Envoyer un message interne', security: [{ bearerAuth: [] }], responses: { 201: { description: 'Message envoyé' }, 422: { description: 'Destinataire invalide' } } },
    },
    '/messages/{id}/read': { patch: { summary: 'Marquer un message reçu comme lu', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Message marqué comme lu' }, 404: { description: 'Message introuvable' } } } },
    '/insurance/policies': {
      get: { summary: 'Lister les contrats d’assurance', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Contrats paginés' } } },
      post: { summary: 'Créer un contrat d’assurance', security: [{ bearerAuth: [] }], responses: { 201: { description: 'Contrat créé' }, 422: { description: 'Client ou animal invalide' } } },
    },
    '/insurance/claims': {
      get: { summary: 'Lister les dossiers d’assurance', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Dossiers paginés' } } },
      post: { summary: 'Créer un dossier de remboursement', security: [{ bearerAuth: [] }], responses: { 201: { description: 'Dossier créé' }, 422: { description: 'Facture ou consultation incompatible' } } },
    },
    '/insurance/claims/{id}/status': { patch: { summary: 'Faire évoluer un dossier d’assurance', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Dossier mis à jour' }, 409: { description: 'Transition interdite' } } } },
    '/audit-logs': {
      get: { summary: 'Consulter le journal des actions', security: [{ bearerAuth: [] }], parameters: [{ in: 'query', name: 'entity_type', schema: { type: 'string' } }, { in: 'query', name: 'user_id', schema: { type: 'integer' } }, { in: 'query', name: 'from', schema: { type: 'string', format: 'date' } }, { in: 'query', name: 'to', schema: { type: 'string', format: 'date' } }], responses: { 200: { description: 'Événements paginés du journal' }, 403: { description: 'Permission insuffisante' } } },
    },
    '/notifications': {
      get: { summary: 'Consulter ses notifications', security: [{ bearerAuth: [] }], parameters: [{ in: 'query', name: 'unread_only', schema: { type: 'boolean' } }], responses: { 200: { description: 'Notifications paginées et nombre de non lues' }, 403: { description: 'Permission insuffisante' } } },
    },
    '/notifications/read-all': { patch: { summary: 'Marquer toutes ses notifications comme lues', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Notifications mises à jour' }, 403: { description: 'Permission insuffisante' } } } },
    '/notifications/{id}/read': { patch: { summary: 'Marquer une notification comme lue', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Notification mise à jour' }, 404: { description: 'Notification introuvable' } } } },
  },
  components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } },
};
