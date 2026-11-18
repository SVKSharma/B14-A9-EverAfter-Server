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
npm run dev
```

The API runs on `http://localhost:5000`. Health check: `GET /api/health`.

In development the server still starts when `MONGODB_URI` is missing or MongoDB is down: it logs a warning, retries every 15 seconds, and `GET /api/health` returns `503` with `database: "disconnected"` until the connection succeeds. In production it exits on startup if the database is unreachable.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start with nodemon |
| `npm start` | Start in production mode |

## Environment Variables

See `.env.example`. Required: `MONGODB_URI`, `MONGODB_DB`, `CLIENT_URL`. Better Auth, Stripe, and ImgBB keys are configured separately.

## Repository Links

- Client: _to be added_
- Server: _to be added_
- Live API: _to be added_
