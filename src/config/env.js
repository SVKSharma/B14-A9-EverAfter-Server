import "dotenv/config";

function optional(name, fallback = "") {
  const value = process.env[name];
  return value === undefined || value.trim() === "" ? fallback : value.trim();
}

function toList(value) {
  return value
    .split(",")
    .map((item) => item.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

const nodeEnv = optional("NODE_ENV", "development");
const isProduction = nodeEnv === "production";
const clientUrl = optional("CLIENT_URL", "http://localhost:3000");

const localMongoUri = "mongodb://127.0.0.1:27017";
const providedMongoUri = optional("MONGODB_URI");
const mongoUri = providedMongoUri || (isProduction ? "" : localMongoUri);

if (!mongoUri) {
  throw new Error(
    "Missing required environment variable: MONGODB_URI. Copy .env.example to .env and fill it in."
  );
}

if (!isProduction && !providedMongoUri) {
  console.warn(
    `[env] MONGODB_URI is not set. Using ${localMongoUri} for local development; ` +
      "the API will start in degraded mode until MongoDB is reachable."
  );
}

export const env = {
  nodeEnv,
  isProduction,
  port: Number(optional("PORT", "5000")),

  mongoUri,
  mongoDb: optional("MONGODB_DB", "everafter"),

  clientUrl,
  allowedOrigins: toList(clientUrl),

  // Better Auth / JWT bridge (configured in the client app)
  betterAuthUrl: optional("BETTER_AUTH_URL"),
  jwtIssuer: optional("BETTER_AUTH_JWT_ISSUER"),
  jwtAudience: optional("BETTER_AUTH_JWT_AUDIENCE"),

  // Payments (webhook + checkout are enabled once these are set)
  stripeSecretKey: optional("STRIPE_SECRET_KEY"),
  stripeWebhookSecret: optional("STRIPE_WEBHOOK_SECRET"),
  premiumPriceCents: Number(optional("PREMIUM_PRICE_CENTS", "4900")),
  premiumCurrency: optional("PREMIUM_CURRENCY", "usd").toLowerCase(),
  premiumDurationDays: Number(optional("PREMIUM_DURATION_DAYS", "30")),

  // Image hosting
  imgbbApiKey: optional("IMGBB_API_KEY"),
};
