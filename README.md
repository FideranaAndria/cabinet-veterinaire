# Cabinet veterinaire

Socle monorepo pour une application de gestion veterinaire. Le client React consomme une API REST Express ; le serveur accede a MySQL exclusivement via des requetes parametrees.

## Architecture

```text
Navigateur (React / React Router / Axios)
                 | HTTPS, JWT bearer
                 v
API REST (Express -> routes -> validation -> services -> repositories)
                 | mysql2, placeholders SQL, transactions
                 v
MySQL / MariaDB (cles etrangeres, index, horodatages, migrations versionnees)
```

Le serveur est organise par responsabilite et les futurs domaines metier sont isoles dans `server/src/modules/`. Les routes ne doivent pas contenir de SQL ni de regles metier. Les permissions sont verifiees dans l'API, jamais uniquement dans l'interface.

## Structure

```text
client/
  src/                 application React, navigation, API et styles
server/
  migrations/          scripts SQL versionnes
  src/
    config/            configuration validee
    db/                pool MySQL
    docs/              contrat OpenAPI
    middleware/        erreurs, validation, authentification et permissions
    modules/           domaines metier
    routes/             routes REST versionnees
    app.js              composition Express
    server.js           demarrage et arret gracieux
.env.example           variables a configurer localement
```

## Dependances

- Frontend : React, React DOM, React Router, Axios, Vite et CSS standard.
- Backend : Node.js, Express, MySQL2, JWT, bcrypt, Zod, Helmet, CORS, limitation de debit et Swagger UI.
- Tests API : Node test runner et Supertest.

## Donnees et historique

Les migrations creent les utilisateurs, roles, permissions, sessions, clients, animaux et la relation historique `client_animal`, avec cles etrangeres, contraintes, index et horodatages. Les clients et animaux supportent suppression logique par `deleted_at` : aucun dossier n'est efface en cascade. Les sessions sont revocables ; roles et permissions sont relus en base a chaque requete authentifiee.

Les migrations et routes de l’API couvrent egalement le personnel, hospitalisations, produits, stocks et lots, fournisseurs, commandes et retours, demandes d’analyse, metadonnees de documents, demandes de paiement, dossiers d’assurance, messagerie interne, notifications, indicateurs et journal d’audit. Le stockage effectif des fichiers et les ecrans de gestion pour les nouveaux modules restent a completer.

Les roles prevus sont `ADMIN`, `DIRECTION`, `VETERINAIRE`, `VETERINAIRE_ASSISTANT`, `ASV`, `ASSISTANT_ADMINISTRATIF`, `LABORATOIRE`, `FOURNISSEUR`, `ASSURANCE` et `CLIENT`. Les tranches livrees comprennent la connexion JWT et la revocation des sessions, les CRUD clients/animaux, l'agenda avec gestion transactionnelle des conflits, les consultations, actes médicaux/chirurgicaux, ordonnances et lignes de médicaments, et vaccinations avec rappels.

## Installation

Prerequis : Node.js 20+, npm 10+ et MySQL 8+ ou MariaDB compatible.

1. Copier `.env.example` vers `.env`, puis configurer les identifiants MySQL et generer une cle JWT aleatoire d'au moins 32 caracteres. Ne jamais committer `.env`.
2. Creer la base MySQL nommee dans `DB_NAME` et un utilisateur applicatif avec les droits minimaux necessaires.
3. Installer les dependances : `npm install`.
4. Appliquer toutes les migrations versionnees : `npm run db:migrate`. Le script reconnait les tables de `001_initial_schema.sql` deja importees manuellement et applique les migrations manquantes.
5. Creer le premier compte admin : `npm run bootstrap:admin`. La commande demande le nom et l'adresse e-mail, genere un mot de passe temporaire unique et l'affiche une seule fois dans le terminal. Conservez-le hors du code.
6. Creer un compte pour chaque praticien : `npm run bootstrap:veterinarian`. Les vétérinaires actifs apparaissent dans le formulaire de rendez-vous ; chaque compte reçoit un mot de passe temporaire unique.
7. Lancer l'API et le client : `npm run dev`.

Client : `http://localhost:5173`. API : `http://localhost:4000/api/v1`. Documentation OpenAPI : `http://localhost:4000/api-docs`.

Endpoints principaux : `POST /auth/login`, `POST /auth/logout`, `POST /auth/change-password`, CRUD clients/animaux, rendez-vous et consultations, `GET/POST/PUT /medical-records/acts`, `GET/POST /medical-records/prescriptions`, `PATCH /medical-records/prescriptions/:id/status`, et `GET/POST/PUT /medical-records/vaccinations`. Les ordonnance conservent leurs lignes de médicaments ; les éléments médicaux ne sont pas supprimables physiquement. Les routes requièrent un bearer JWT et la permission correspondante.

## Verification

- `npm test` : tests API du serveur.
- `npm run test:integration --workspace server` : tests bout en bout contre la base configuree ; appliquez d'abord les migrations. Les donnees temporaires sont supprimees a la fin.
- `npm run build` : build de production du client.

## Perimetre de ce socle

La tranche livree couvre l'authentification, les roles/permissions, les clients, animaux, rendez-vous, consultations, dossiers medicaux, hospitalisations, produits et factures. Les migrations et routes couvrent aussi le journal d'audit, les notifications, les indicateurs, les demandes d'analyse, les metadonnees de documents, les fournisseurs, commandes, lots, retours, profils du personnel, demandes de paiement, dossiers d'assurance et messagerie interne. Le client dispose de vues de consultation pour ces modules ; leurs formulaires de gestion et le transfert effectif des fichiers restent a realiser.
