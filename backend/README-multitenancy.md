## Companies / Multi-tenancy runbook

### One-time (fresh DB recommended)
- Run DB setup:

```bash
node backend/scripts/setupDatabase.js
```

- Bootstrap the first platform super-admin + the bootstrap company:

```bash
BOOTSTRAP_COMPANY_NAME="Hands On Innovation" BOOTSTRAP_COMPANY_SLUG=hands-on-innovation BOOTSTRAP_SUPERADMIN_USERNAME=admin BOOTSTRAP_SUPERADMIN_PASSWORD=admin123 node backend/scripts/bootstrapPlatform.js
```

### How auth works right now
- Requests must include `x-user-id: <id>` header.
- Login returns the `user.id` you can use as `x-user-id`.

### Useful endpoints
- **Login**: `POST /api/login` → returns `user.id`, `user.company_id`, `user.role`
- **Companies (super-admin only)**: `GET/POST/PUT/DELETE /api/companies...`

### Create a company (required: initial admin + billing/device fields)
`POST /api/companies` (super-admin only)

Example body:

```json
{
  "name": "Acme Inc",
  "slug": "acme-inc",
  "purchase_date": "2026-04-21",
  "payment_cycle": "monthly",
  "contact_name": "Jane Doe",
  "contact_email": "jane@acme.com",
  "contact_phone": "+1-555-0100",
  "device_limit": 10,
  "additional_info": "Notes about the contract",
  "admin": {
    "username": "acme_admin",
    "password": "secret123"
  }
}
```

Notes:
- `device_limit = 0` means **unlimited**.
- Creating a company always creates an initial `company_admin` user.

