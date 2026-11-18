# EverAfter — API

Express 5 + MongoDB backend for **EverAfter**, a wedding services marketplace where customers discover vendors, request bookings, and vendors manage services, bookings, and Premium subscriptions.

## Tech Stack

- Node.js 20+ (ES modules)
- Express 5, MongoDB Node driver
- `jose` for verifying Better Auth-issued JWTs
- Stripe Checkout + webhooks, ImgBB for image hosting

## Local Setup

```bash
npm install
cp .env.example .env   # fill in MongoDB and integration keys (optional for a bare boot)
npm run seed           # optional: insert demo vendors and services
npm run dev
```

The API runs on `http://localhost:5000`. Health check: `GET /api/health`.

In development the server still starts when `MONGODB_URI` is missing or MongoDB is down: it logs a warning, retries every 15 seconds, and `GET /api/health` returns `503` with `database: "disconnected"` until the connection succeeds. In production it exits on startup if the database is unreachable.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start with nodemon |
| `npm start` | Start in production mode |
| `npm run seed` | Insert demo vendors and services (idempotent, replaces seed services) |

## Environment Variables

See `.env.example`. Required: `MONGODB_URI`, `MONGODB_DB`, `CLIENT_URL`. Better Auth, Stripe, and ImgBB keys are configured separately.

## API Endpoints

All responses use the shape `{ success, data, meta? }`; errors use `{ success: false, message, errors? }`.

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Liveness + MongoDB connection status |
| `GET` | `/api/services` | Public catalogue: approved + available services only |
| `GET` | `/api/services/:id` | Public service details; `404` for invalid, unpublished, or unavailable ids |

### `GET /api/services` query parameters

| Parameter | Values | Notes |
|---|---|---|
| `search` | string | Case-insensitive match on service name or description |
| `category` | `photography`, `venues`, `decoration`, `catering`, `makeup`, `fashion` | Invalid values return `422` |
| `location` | string | Case-insensitive partial match |
| `minPrice`, `maxPrice` | number ≥ 0 | Inclusive price range |
| `sort` | `newest` (default), `price_asc`, `price_desc` | |
| `page` | integer ≥ 1 | Defaults to `1` |
| `limit` | integer 1–48 | Defaults to `9` |

Pagination metadata: `{ page, limit, total, totalPages }`.

Service objects include a `vendor` object (`id`, `name`, `businessName`, `image`, `subscriptionPlan`) resolved from the `users` collection.

## Repository Links

- Client: _to be added_
- Server: _to be added_
- Live API: _to be added_
