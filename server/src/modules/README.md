# Domain modules

Keep each business domain self-contained. A module should own its router, schemas, controller, service, and repository, for example:

```text
clients/
  clients.routes.js
  clients.schema.js
  clients.controller.js
  clients.service.js
  clients.repository.js
```

Add authorization and validation at the route boundary, business rules in services, and parameterized SQL in repositories. Planned domains: auth, users, clients, animals, appointments, consultations, medical-records, inventory, suppliers, laboratories, insurance, documents, notifications, reporting, and audit.
