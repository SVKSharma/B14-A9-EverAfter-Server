<div align="center">

<h1 style="font-size: 3rem; font-weight: 800;">
	<img src="./brand-icon.png" width="48" height="48" alt="EverAfter icon" style="vertical-align: middle; margin-right: 0.3em;" /> EverAfter API / <font color="#B8784E">The engine behind the marketplace</font>
</h1>

<h3 style="font-size: 1.1rem; font-weight: 700;"><font color="#B8784E">B14-A9 · Category 004 · WedPlan</font></h3>

<h2 style="font-size: 1.8rem; font-weight: 800;">One API. Three roles. Every happy ending.</h2>

Services, bookings, moderation, and webhook-verified Premium — in one Express + MongoDB backend.

**Live API:** <a href="https://b14-a9-everafter-server-svk.vercel.app/" target="_blank" rel="noopener noreferrer">Open the API</a>

[![Live API](https://img.shields.io/badge/Live%20API-EverAfter%20API-2E2A3A?style=for-the-badge)](https://b14-a9-everafter-server-svk.vercel.app/)
[![Client App](https://img.shields.io/badge/Client%20App-Open%20EverAfter-B8784E?style=for-the-badge)](https://b14-a9-everafter-client-svk.vercel.app/)

</div>

---

## 🔗 Project Links

| Resource | Link |
| --- | --- |
| ⚙️ **Live API** | [b14-a9-everafter-server-svk.vercel.app](https://b14-a9-everafter-server-svk.vercel.app/) |
| 🩺 **Health check** | [b14-a9-everafter-server-svk.vercel.app/api/health](https://b14-a9-everafter-server-svk.vercel.app/api/health) |
| 🌐 **Live website** | [b14-a9-everafter-client-svk.vercel.app](https://b14-a9-everafter-client-svk.vercel.app/) |
| 💻 **Client repository** | [SVKSharma/B14-A9-EverAfter-Client](https://github.com/SVKSharma/B14-A9-EverAfter-Client) |
| 🗄️ **Server repository** | [SVKSharma/B14-A9-EverAfter-Server](https://github.com/SVKSharma/B14-A9-EverAfter-Server) |

> **This is the backend repository.** The Next.js App Router frontend, Better Auth sign-in, and the vendor and admin interfaces live in the [client repository](https://github.com/SVKSharma/B14-A9-EverAfter-Client). The client cannot start a session without Better Auth, and this API cannot authenticate a request without the client's JWKS endpoint — the two projects run together.

---

<h2 style="font-size: 1.5rem; font-weight: 800;"><font color="#B8784E">About EverAfter API</font></h2>

EverAfter is a wedding services marketplace built for the **WedPlan** brief. The API is the authority behind every screen: it publishes the catalogue, stores services and booking requests, enforces the free-plan quota, runs the admin console, and applies Premium only after Stripe confirms a payment.

It is a plain **Express 5** application on top of the official **MongoDB** driver, split into routes, controllers, services, and validation helpers. Authentication is delegated to **Better Auth** in the client app; this server verifies the resulting JWTs against Better Auth's JWKS endpoint and resolves the live user record on every request, so a blocked account or an expired plan takes effect immediately.

The three roles are deliberately separated:

- **Customers** browse the public catalogue, request a date, follow the status of that request, and cancel while it is still pending.
- **Vendors** manage their own services and availability, answer booking requests, and upgrade to Premium for unlimited listings.
- **Admins** see platform totals, search and block accounts, approve or reject listings, and audit every Premium transaction.

> **Verify the token. Trust the database. Enforce the role.**

<h2 style="font-size: 1.5rem; font-weight: 800;"><font color="#B8784E">🌟 Key Features</font></h2>

- **Stateless JWT authentication:** Better Auth issues short-lived tokens from the client app; this API verifies them against the Better Auth JWKS endpoint with `jose`, checking issuer, audience, signature, and expiry.
- **Live account checks:** Every authenticated request re-reads the user from MongoDB. Deleted accounts return `401`, blocked accounts return `403`, and an expired Premium pass silently falls back to the free plan.
- **Role enforcement on the server:** `requireRole` guards every protected route group. Admin routes are closed to authenticated vendors and customers, and the role always comes from the verified user record — never from a body field or query parameter.
- **Ownership checks:** Vendors can only edit, delete, or toggle their own services; customers can only cancel their own bookings; vendors can only answer requests addressed to them.
- **Public catalogue:** Only approved and available services are listed. Search covers service names and descriptions, with category, location, and price-range filters, three sort orders, and pagination.
- **Premium-first ranking:** Premium vendors rank ahead of free vendors inside every sort order. The ranking reads `subscriptionExpiresAt`, so an expired pass stops being featured immediately.
- **Service lifecycle:** Vendors create listings as `pending`, admins approve or reject them (with a required rejection reason), and a vendor edit to an approved service sends it back to review.
- **Free-plan quota:** Three services on the free plan. Pending and approved listings both occupy a slot so the limit cannot be dodged; rejected listings free their slot; Premium lifts the limit.
- **Booking workflow:** Customers request a date, location, and message. Requests begin `pending`, vendors accept or reject them, and customers can cancel only while the request is still pending.
- **Database-level duplicate guard:** A partial unique index on `{ customerId, serviceId, eventDate }` for active statuses blocks a second request even when two submissions race each other.
- **Availability guard:** Only approved, currently available services can be booked, and past event dates are rejected server-side.
- **Role dashboards:** Focused statistics for vendors (services, bookings, quota) and customers (bookings by status), plus platform-wide totals for admins.
- **Admin console API:** Search and filter users, open a detail view with service and booking counts, block or unblock accounts, moderate services with reasons, and read the transaction ledger.
- **Session revocation on block:** Blocking an account also deletes its existing Better Auth sessions, so the next request cannot succeed.
- **Stripe Premium:** Hosted Checkout, a 15-minute pending lock, reconciliation against Stripe for abandoned sessions, and activation only from a verified `checkout.session.completed` webhook.
- **Idempotent webhooks:** Replayed deliveries do not extend a pass twice. Renewals stack on top of an unexpired window instead of truncating it.
- **Protected image uploads:** Base64 payloads are validated by MIME type and decoded size, then forwarded to ImgBB with the API key kept server-side.
- **Consistent responses:** Every success uses `{ success: true, data, meta? }`; every error uses `{ success: false, message, errors? }`.
- **Central error handling:** Duplicate-key conflicts, oversized bodies, invalid JSON, and validation failures are normalized into predictable status codes.
- **Search hardening:** User-supplied search and location strings are regex-escaped before reaching MongoDB.
- **Allowlisted CORS:** Only origins listed in `CLIENT_URL` may call the API with credentials.
- **Health monitoring:** `GET /api/health` reports process uptime and the live MongoDB ping status, returning `503` when the database is unreachable.
- **Degraded development mode:** Without a reachable database the standalone server still boots, retries every 15 seconds, and recovers automatically. Production fails fast instead.
- **Serverless-friendly database access:** Connections are cached and initialized on demand, and indexes are created once per connection.
- **Seed script:** Idempotently upserts four demo vendors and a curated set of approved services for local testing.

<h2 style="font-size: 1.5rem; font-weight: 800;"><font color="#B8784E">🏗️ Architecture</font></h2>

The code follows a small, predictable flow:

```text
HTTP request
   │
   ├── CORS allowlist (CLIENT_URL)
   ├── Raw body router for Stripe webhooks
   ├── express.json (2 MB) / 8 MB on uploads
   ├── /api connection middleware (MongoDB on demand)
   │
   ├── routes        requireAuth → requireRole → controller
   ├── controllers   parse params, call one service function, shape the envelope
   ├── services      validation, ownership, database work, business rules
   └── MongoDB       users, services, bookings, transactions
```

- **Routes** declare access and compose middleware. They contain no business logic.
- **Controllers** are thin: they hand the request to a service and return `{ success, data, meta? }`.
- **Services** own every rule — quota, ownership, status transitions, webhook effects.
- **Validation helpers** in `src/utils/validation.js` produce `422` responses with per-field messages.
- **Errors** thrown as `ApiError` bubble to one handler that maps them to the public error shape.

<h2 style="font-size: 1.5rem; font-weight: 800;"><font color="#B8784E">🔐 Authentication & Security</font></h2>

EverAfter uses Better Auth in the client app and a JWT bridge into this API.

1. The client signs a user in with email/password or Google. Better Auth stores users, sessions, and accounts in the `everafter` database.
2. The Better Auth JWT plugin publishes signing keys at `/api/auth/jwks` and exposes short-lived tokens at `/api/auth/token`.
3. The client sends `Authorization: Bearer <token>` on every business request.
4. `requireAuth` verifies the token with `jose` against the remote JWKS. Issuer and audience default to `BETTER_AUTH_URL` and can be overridden with `BETTER_AUTH_JWT_ISSUER` and `BETTER_AUTH_JWT_AUDIENCE`.
5. The verified `sub` claim is used to load the **live user record** from MongoDB — by the mirrored Better Auth `id`, falling back to the Mongo `_id`.
6. The request proceeds only if the account exists and is not blocked. The user's role is normalized to `admin`, `vendor`, or `customer`.
7. Premium is recalculated from `subscriptionPlan` **and** `subscriptionExpiresAt`; an expired pass is reported as `free` everywhere.
8. `requireRole` then enforces the route's allowed roles. Ownership checks inside services provide the second layer.
9. Profile updates accept only `name`, `image`, and `businessName`. `email`, `role`, `isBlocked`, `subscriptionPlan`, and `subscriptionExpiresAt` are server-owned and rejected if sent.
10. Blocking a user deletes their sessions, and `requireAuth` rejects the account on the next request.
11. CORS accepts only the origins in `CLIENT_URL`; server-to-server and Stripe webhook requests are unaffected.
12. Bodies are capped at 2 MB (`8 MB` for image uploads, `1 MB` raw for webhooks), and search terms are escaped before regex matching.

<h2 style="font-size: 1.5rem; font-weight: 800;"><font color="#B8784E">🎭 Roles & Permissions</font></h2>

| Capability | Public | Customer | Vendor | Admin |
| --- | :---: | :---: | :---: | :---: |
| Health and API metadata | ✅ | ✅ | ✅ | ✅ |
| Browse the approved catalogue | ✅ | ✅ | ✅ | ✅ |
| Read a public service detail | — | ✅ | ✅ | ✅ |
| Read and edit own profile | — | ✅ | ✅ | ✅ |
| Upload an image | — | ✅ | ✅ | ✅ |
| Create and cancel own booking requests | — | ✅ | — | ✅ cancel |
| Read own bookings / vendor's bookings | — | ✅ | ✅ | ✅ |
| Create, edit, and pause own services | — | — | ✅ | — |
| Moderate or delete any service | — | — | — | ✅ |
| Accept or reject incoming requests | — | — | ✅ | ✅ |
| Vendor / customer statistics | — | ✅ own | ✅ own | ✅ |
| Buy and manage Premium | — | — | ✅ | — |
| Platform statistics | — | — | — | ✅ |
| Search, block, and inspect users | — | — | — | ✅ |
| Approve, reject, or delete any service | — | — | — | ✅ |
| Read the transaction ledger | — | — | — | ✅ |
| Receive Stripe webhooks | Signature only | | | |

<h2 style="font-size: 1.5rem; font-weight: 800;"><font color="#B8784E">🧭 API Endpoints</font></h2>

Base URL: `https://b14-a9-everafter-server-svk.vercel.app/api` (local: `http://localhost:5000/api`).

### System

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/` | Public | API name and version |
| `GET` | `/health` | Public | MongoDB status, uptime, environment |

### Catalogue

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/services` | Public | Approved and available services, with filters |
| `GET` | `/services/:id` | Signed in | Published service detail with vendor summary |

`GET /services` query parameters:

| Parameter | Values | Default |
| --- | --- | --- |
| `search` | string (≤100) | — |
| `category` | `photography`, `venues`, `decoration`, `catering`, `makeup`, `fashion` | — |
| `location` | string (≤120), partial match | — |
| `minPrice`, `maxPrice` | number ≥ 0 | — |
| `sort` | `newest`, `price_asc`, `price_desc` | `newest` |
| `page` | integer ≥ 1 | `1` |
| `limit` | integer 1–48 | `9` |

Premium vendors rank first in every sort. Pagination returns `meta: { page, limit, total, totalPages }`.

### Profile & uploads

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/users/me` | Signed in | Current user and plan state |
| `PATCH` | `/users/me` | Signed in | Update name, business name, avatar |
| `POST` | `/uploads/image` | Signed in | Upload a base64 image to ImgBB |

`POST /uploads/image` accepts `{ "image": "data:image/png;base64,…", "name": "optional" }` and returns the hosted URL plus display, thumbnail, and delete URLs.

### Bookings

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| `POST` | `/bookings` | Customer | Request a date for an approved, available service |
| `GET` | `/bookings/mine` | Customer | Own request history |
| `GET` | `/bookings/vendor` | Vendor | Requests addressed to this vendor |
| `GET` | `/bookings/:id` | Customer/vendor participant, admin | Full detail with service and users |
| `PATCH` | `/bookings/:id/cancel` | Customer owner, admin | Cancel a pending request |
| `PATCH` | `/bookings/:id/status` | Vendor owner, admin | Accept or reject a pending request |

Booking rules:

- `eventDate` must be today or later and is stored as UTC midnight.
- `eventLocation` is 2–160 characters; `message` is 10–1000 characters.
- Only `approved` services with `availability: true` accept requests.
- Customers cannot book their own service.
- One active (`pending` or `accepted`) request per customer, service, and date.
- Cancel is only valid while the request is `pending`; accept/reject is a one-way transition.

### Vendor services

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/vendor/services` | Vendor | Own listings plus quota metadata |
| `POST` | `/vendor/services` | Vendor | Create a service (starts `pending`) |
| `GET` | `/vendor/services/:id` | Vendor owner, admin | Load a service for editing |
| `PATCH` | `/vendor/services/:id` | Vendor owner, admin | Update a service |
| `PATCH` | `/vendor/services/:id/availability` | Vendor owner, admin | Pause or resume bookings |
| `DELETE` | `/vendor/services/:id` | Vendor owner, admin | Delete a service |

Service payload:

| Field | Rules |
| --- | --- |
| `serviceName` | 3–120 characters |
| `description` | 20–2000 characters |
| `category` | One of the six catalogue categories |
| `price` | 0–10,000,000 |
| `location` | 2–120 characters |
| `images` | 1–4 unique http(s) URLs on create; up to 4 on edit |
| `availability` | Boolean, defaults to `true` |

`GET /vendor/services` returns `meta.quota: { plan, limit, used, remaining }`. A vendor edit to an approved service resets its status to `pending`; admin edits keep the moderation status.

### Statistics

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/stats/vendor` | Vendor, admin | Service, booking, and quota counters |
| `GET` | `/stats/customer` | Customer, admin | Booking counters by status |

### Premium subscriptions

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/subscriptions/status` | Vendor | Current plan, expiry, price, latest transaction |
| `POST` | `/subscriptions/checkout` | Vendor | Create a Stripe Checkout Session |
| `GET` | `/subscriptions/session?session_id=…` | Vendor | Read what Stripe recorded, without activating |

`POST /subscriptions/checkout` returns `201` with `{ url, sessionId, amount, currency, days }`. It returns `409` when Premium is already active or a live checkout is pending, and `403` for non-vendors.

`GET /subscriptions/status` returns:

```json
{
  "plan": "free",
  "expiresAt": null,
  "price": { "amount": 4900, "currency": "usd", "days": 30 },
  "latestTransaction": {
    "id": "…",
    "status": "pending",
    "amount": 4900,
    "currency": "usd",
    "createdAt": "…",
    "awaitingActivation": false
  }
}
```

`awaitingActivation: true` means Stripe has the money but the webhook has not reached the server yet. In that state the client keeps a second checkout blocked so nobody is charged twice.

### Admin

Every `/admin/*` endpoint requires an admin token.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/admin/stats` | Users, services, bookings, and subscription totals |
| `GET` | `/admin/users` | Paginated user search (`role`, `search`) |
| `GET` | `/admin/users/:id` | Account detail with service and booking counts |
| `PATCH` | `/admin/users/:id/block` | Block or unblock (`{ isBlocked }`) |
| `GET` | `/admin/services` | Paginated moderation list (`status`, `category`, `search`) |
| `PATCH` | `/admin/services/:id/status` | Approve or reject; rejection requires a reason |
| `DELETE` | `/admin/services/:id` | Remove a listing |
| `GET` | `/admin/transactions` | Paginated ledger (`status`) |

Admin list endpoints accept `page` and `limit` (1–50, default 12). Users and services rank newest first.

### Stripe webhook

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/webhooks/stripe` | Stripe signature | Verify and apply checkout events |

The webhook is mounted before the JSON parser because the signature covers the raw bytes. Handled events:

| Event | Effect |
| --- | --- |
| `checkout.session.completed` | Marks the transaction `success` and activates/extends Premium when `payment_status` is `paid` |
| `checkout.session.expired` | Marks the transaction `expired`; no plan change |
| `checkout.session.async_payment_failed` | Marks the transaction `failed`; no plan change |

Unknown event types are acknowledged with `200` so Stripe stops retrying. Deliveries are idempotent.

<h2 style="font-size: 1.5rem; font-weight: 800;"><font color="#B8784E">💳 Premium Lifecycle</font></h2>

1. A vendor calls `POST /api/subscriptions/checkout`. The server refuses non-vendors, active Premium, and any vendor who already has a pending checkout.
2. A `transactions` row is written first with status `pending` and a temporary `pending-…` session id, so a webhook always has a record to reconcile.
3. Stripe Checkout is created in `payment` mode with `client_reference_id`, `metadata.vendorId`, `metadata.transactionId`, and `metadata.days`. The row is updated with the real session id and URL.
4. The browser is redirected to Stripe. Return URLs come from the first origin in `CLIENT_URL`: `/dashboard/vendor/subscription/success?session_id={CHECKOUT_SESSION_ID}` and `/dashboard/vendor/subscription/cancel`.
5. Stripe posts the signed event to `/api/webhooks/stripe`. The server verifies the HMAC over the exact raw body with a 300-second timestamp tolerance, then:
   - `checkout.session.completed` + `paid` → transaction `success`, plan `premium`, expiry set.
   - `expired` / `async_payment_failed` → transaction `expired` or `failed`.
6. A replayed success event finds the transaction already `success` and does nothing. A renewal adds the new duration on top of any remaining time.
7. Abandoned checkouts older than 15 minutes are reconciled directly with Stripe. Open sessions are expired first, then released, so an old payment link can never be paid afterwards. If Stripe says the session is already paid, the row stays `pending` and the server logs a loud warning — only the webhook may grant the plan.
8. `GET /subscriptions/status` refreshes the plan from MongoDB, so an expiry that passed while the page was open is reported immediately.

Default plan: **$49 USD for 30 days**, configurable with `PREMIUM_PRICE_CENTS`, `PREMIUM_CURRENCY`, and `PREMIUM_DURATION_DAYS`.

<h2 style="font-size: 1.5rem; font-weight: 800;"><font color="#B8784E">🗄️ Data Model</font></h2>

| Collection | Purpose | Notable fields |
| --- | --- | --- |
| `users` | Better Auth accounts plus marketplace fields | `id`, `email`, `role`, `isBlocked`, `businessName`, `subscriptionPlan`, `subscriptionExpiresAt` |
| `sessions` / `accounts` / `verifications` / `jwks` | Better Auth storage | Managed by the client's Better Auth instance |
| `services` | Vendor listings | `vendorId`, `serviceName`, `category`, `price`, `location`, `images[]`, `status`, `availability`, `rejectionReason` |
| `bookings` | Customer requests | `serviceId`, `vendorId`, `customerId`, `eventDate`, `eventLocation`, `message`, `status` |
| `transactions` | Premium ledger | `vendorId`, `plan`, `amount`, `currency`, `stripeSessionId`, `status`, `paidAt` |

Indexes created on connect:

- `services`: `{ vendorId, createdAt }`, `{ status, availability, createdAt }`, `{ status, availability, category }`, `{ status, availability, price }`, `{ location }`
- `bookings`: `{ customerId, createdAt }`, `{ vendorId, status, createdAt }`, `{ serviceId }`, `{ status }`, and a **partial unique** `{ customerId, serviceId, eventDate }` for `pending`/`accepted`
- `transactions`: `{ vendorId, createdAt }`, `{ status }`, unique sparse `{ stripeSessionId }`, and a partial unique `{ stripeSubscriptionId }` for real string ids
- `users`: `{ role }`

<h2 style="font-size: 1.5rem; font-weight: 800;"><font color="#B8784E">📡 Response & Error Format</font></h2>

Success:

```json
{
  "success": true,
  "data": {},
  "meta": { "page": 1, "limit": 9, "total": 24, "totalPages": 3 }
}
```

Error:

```json
{
  "success": false,
  "message": "serviceName must be at least 3 characters",
  "errors": [{ "field": "serviceName", "message": "serviceName must be at least 3 characters" }]
}
```

| Status | When it is used |
| --- | --- |
| `400` | Malformed JSON, missing changes, bad Stripe signature headers |
| `401` | Missing, invalid, or expired token; deleted account |
| `403` | Wrong role, another owner's record, blocked account, free-plan quota, blocked self/admin |
| `404` | Unknown route, user, service, booking, or unpublished service |
| `409` | Duplicate active booking, handled booking, active/pending Premium |
| `413` | Request body larger than the configured limit |
| `422` | Field validation failure (with `errors[]`) |
| `502` | ImgBB unreachable or rejected the upload |
| `503` | Database unavailable, auth not configured, payments not configured |

In development, `5xx` responses include a `stack` for debugging. Production never exposes it.

<h2 style="font-size: 1.5rem; font-weight: 800;"><font color="#B8784E">🛠️ Technologies Used</font></h2>

- **Runtime:** Node.js 20+, native ES modules
- **Framework:** Express 5
- **Database:** MongoDB (official Node driver 7)
- **Authentication bridge:** `jose`, remote JWKS, JWT verification
- **Payments:** Stripe Checkout, Stripe webhooks (raw-body HMAC verification)
- **Image Hosting:** ImgBB
- **Security:** CORS allowlist, role guards, ownership checks, body-size limits
- **Configuration:** `dotenv`
- **Development:** Nodemon
- **Deployment:** Vercel

<h2 style="font-size: 1.5rem; font-weight: 800;"><font color="#B8784E">📂 Project Structure</font></h2>

```text
ever-after-server/
├── scripts/
│   └── seed-demo.js
├── src/
│   ├── config/
│   │   ├── db.js
│   │   └── env.js
│   ├── middleware/
│   │   ├── error-handler.js
│   │   └── require-auth.js
│   ├── modules/
│   │   ├── admin/
│   │   │   ├── admin.controller.js
│   │   │   ├── admin.routes.js
│   │   │   └── admin.service.js
│   │   ├── bookings/
│   │   │   ├── booking.controller.js
│   │   │   ├── booking.routes.js
│   │   │   └── booking.service.js
│   │   ├── services/
│   │   │   ├── service.controller.js
│   │   │   ├── service.routes.js
│   │   │   ├── service.service.js
│   │   │   ├── vendor-service.controller.js
│   │   │   ├── vendor-service.routes.js
│   │   │   └── vendor-service.service.js
│   │   ├── stats/
│   │   │   ├── stats.routes.js
│   │   │   └── stats.service.js
│   │   ├── subscriptions/
│   │   │   ├── stripe.client.js
│   │   │   ├── subscription.controller.js
│   │   │   ├── subscription.routes.js
│   │   │   ├── subscription.service.js
│   │   │   ├── webhook.controller.js
│   │   │   └── webhook.routes.js
│   │   ├── uploads/
│   │   │   ├── upload.controller.js
│   │   │   ├── upload.routes.js
│   │   │   └── upload.service.js
│   │   └── users/
│   │       ├── user.controller.js
│   │       ├── user.routes.js
│   │       └── user.service.js
│   ├── routes/
│   │   └── index.js
│   ├── utils/
│   │   ├── api-error.js
│   │   ├── constants.js
│   │   └── validation.js
│   ├── app.js
│   └── server.js
├── .env.example
├── brand-icon.png
├── package.json
└── README.md
```

<h2 style="font-size: 1.5rem; font-weight: 800;"><font color="#B8784E">🚀 Installation & Local Development</font></h2>

Follow these steps to run the API locally. The client is a separate project, so clone both repositories side by side.

### 1. Clone the repositories

Using HTTPS:

```bash
git clone https://github.com/SVKSharma/B14-A9-EverAfter-Server.git
git clone https://github.com/SVKSharma/B14-A9-EverAfter-Client.git
```

Using SSH:

```bash
git clone git@github.com:SVKSharma/B14-A9-EverAfter-Server.git
git clone git@github.com:SVKSharma/B14-A9-EverAfter-Client.git
```

### 2. Install dependencies

```bash
cd B14-A9-EverAfter-Server
npm install

cd ../B14-A9-EverAfter-Client
npm install
```

### 3. Create the server environment file

Copy `.env.example` to `.env` and fill it in:

```bash
NODE_ENV=development
PORT=5000
MONGODB_URI=your_mongodb_connection_string
MONGODB_DB=everafter
CLIENT_URL=http://localhost:3000
BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_JWT_ISSUER=
BETTER_AUTH_JWT_AUDIENCE=
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
PREMIUM_PRICE_CENTS=4900
PREMIUM_CURRENCY=usd
PREMIUM_DURATION_DAYS=30
IMGBB_API_KEY=your_imgbb_api_key
```

| Variable | Required | Description |
| --- | --- | --- |
| `NODE_ENV` | No | `development` locally, `production` on the server |
| `PORT` | No | Port for the standalone server, defaults to `5000` |
| `MONGODB_URI` | Yes in production | MongoDB Atlas connection string. Development falls back to `mongodb://127.0.0.1:27017` |
| `MONGODB_DB` | No | Database name, defaults to `everafter` |
| `CLIENT_URL` | Yes | Client origin(s) allowed by CORS and used for Stripe return URLs. Comma-separate extra origins |
| `BETTER_AUTH_URL` | Yes in production | Better Auth origin. JWTs are verified against `${BETTER_AUTH_URL}/api/auth/jwks` |
| `BETTER_AUTH_JWT_ISSUER` | No | Expected JWT issuer; defaults to `BETTER_AUTH_URL` |
| `BETTER_AUTH_JWT_AUDIENCE` | No | Expected JWT audience; defaults to `BETTER_AUTH_URL` |
| `STRIPE_SECRET_KEY` | Yes for Premium | Stripe secret key (test mode locally) |
| `STRIPE_WEBHOOK_SECRET` | Yes for Premium | Signing secret for the webhook endpoint |
| `PREMIUM_PRICE_CENTS` | No | Premium price in cents, defaults to `4900` |
| `PREMIUM_CURRENCY` | No | Currency code, defaults to `usd` |
| `PREMIUM_DURATION_DAYS` | No | Premium duration, defaults to `30` |
| `IMGBB_API_KEY` | Yes for uploads | ImgBB key used by the protected upload route |

The client needs the **same** `MONGODB_URI` and `MONGODB_DB`, plus `BETTER_AUTH_URL` pointing at its own origin. See the [client README](https://github.com/SVKSharma/B14-A9-EverAfter-Client#readme) for its full environment table.

### 4. Configure the Better Auth bridge

- Start the client on `http://localhost:3000`.
- Set this server's `BETTER_AUTH_URL=http://localhost:3000`.
- Confirm `${BETTER_AUTH_URL}/api/auth/jwks` returns a key set. If it does not, this API returns `503 Authentication is not configured on the server`.

### 5. Configure Stripe (Premium)

Use Stripe **test mode** keys. Forward webhook events locally with the Stripe CLI:

```bash
stripe listen --forward-to http://localhost:5000/api/webhooks/stripe
```

Copy the `whsec_…` value the CLI prints into `STRIPE_WEBHOOK_SECRET`, then restart the API. Forward these events:

```text
checkout.session.completed
checkout.session.expired
checkout.session.async_payment_failed
```

### 6. Seed demo data (optional)

```bash
npm run seed
```

The script upserts four demo vendors (`aurora`, `lumen`, `saffron`, `atelier` at `@everafter.test`) and replaces their services with a curated set. It is safe to run repeatedly.

### 7. Start the API

```bash
npm run dev
```

The API starts on `http://localhost:5000`. Health check: [http://localhost:5000/api/health](http://localhost:5000/api/health).

If MongoDB is unreachable in development, the server still boots, logs a warning, retries every 15 seconds, and reports `503` with `database: "disconnected"` until the connection succeeds.

### 8. Start the client

In a second terminal:

```bash
cd ../B14-A9-EverAfter-Client
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). If the client points at a different API URL, update its `NEXT_PUBLIC_API_URL`.

<h2 style="font-size: 1.5rem; font-weight: 800;"><font color="#B8784E">🧪 Available Scripts</font></h2>

```bash
npm run dev      # Start the API with nodemon
npm run start    # Start the API with Node
npm run seed     # Upsert demo vendors and replace their services
```

<h2 style="font-size: 1.5rem; font-weight: 800;"><font color="#B8784E">🌐 Deployment</font></h2>

The API is deployed on **Vercel** at [b14-a9-everafter-server-svk.vercel.app](https://b14-a9-everafter-server-svk.vercel.app/).

1. Import the [server repository](https://github.com/SVKSharma/B14-A9-EverAfter-Server) into Vercel as a Node/Express project.
2. Add every variable from the table above in the Vercel project settings. Production must set `MONGODB_URI`, `MONGODB_DB`, `CLIENT_URL`, `BETTER_AUTH_URL`, and the Stripe and ImgBB keys.
3. Set `CLIENT_URL` and `BETTER_AUTH_URL` to `https://b14-a9-everafter-client-svk.vercel.app`.
4. Deploy, then confirm `GET /api/health` returns `200` with `database: "connected"`.
5. Register the production Stripe webhook endpoint: `https://b14-a9-everafter-server-svk.vercel.app/api/webhooks/stripe`.
6. Subscribe it to `checkout.session.completed`, `checkout.session.expired`, and `checkout.session.async_payment_failed`, then copy the signing secret into `STRIPE_WEBHOOK_SECRET` and redeploy.
7. Set the client's `NEXT_PUBLIC_API_URL` to `https://b14-a9-everafter-server-svk.vercel.app/api`.

In production the standalone server exits at startup when MongoDB is unreachable, so a broken database connection fails loudly instead of serving errors indefinitely. On serverless hosts, the connection is created on demand and reused across requests, and indexes are ensured once per connection.

<h2 style="font-size: 1.5rem; font-weight: 800;"><font color="#B8784E">✅ Project Notes</font></h2>

- This API never issues tokens. Better Auth does, and this server only verifies them through JWKS.
- The role used for authorization always comes from the database record, never from the request body.
- `role`, `email`, `isBlocked`, `subscriptionPlan`, and `subscriptionExpiresAt` cannot be changed through `PATCH /users/me`.
- Admin accounts are created manually; the public sign-up flow only permits `customer` and `vendor`.
- Admins cannot block themselves, and other admin accounts cannot be blocked.
- Blocking a user deletes their existing sessions as well as rejecting future ones.
- A free vendor can hold three pending or approved services. Rejected listings do not count.
- Editing an approved service as its vendor returns it to `pending` for review.
- Rejecting a service requires a written reason of up to 500 characters.
- Only one active booking request may exist per customer, service, and event date — enforced in the service and by a partial unique index.
- Customers cannot book their own service, and only approved, available services accept requests.
- Cancelling is limited to `pending` bookings; accepting and rejecting are one-way transitions.
- Premium is granted only by a verified Stripe webhook. The checkout endpoint never activates a plan, and `GET /subscriptions/session` is read-only.
- A pending checkout blocks a second one for 15 minutes. After that, it is reconciled with Stripe, expired if still open, and released. A paid session is never released.
- Image uploads must be JPEG, PNG, or WebP, decoded to 5 MB or less. The JSON envelope is allowed up to 8 MB because base64 inflates the payload.
- The webhook route reads the raw body before `express.json()` so signature verification sees exactly what Stripe signed.
- Search filters escape regex characters, and all ids are validated as Mongo `ObjectId`s before querying.
- `.env` files are git-ignored; only `.env.example` is committed.

Thank you for exploring the EverAfter API. The project was built for the **B14-A9 · Category 004** assignment with server-side role enforcement, a real service moderation pipeline, a booking workflow with database-level safeguards, and Premium access that unlocks only after Stripe confirms it.

---

<div align="center">

Built with 💚 by <a href="https://github.com/SVKSharma">Showvik</a>

</div>
