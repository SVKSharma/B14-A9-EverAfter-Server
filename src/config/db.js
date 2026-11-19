import { MongoClient } from "mongodb";
import { env } from "./env.js";

let client = null;
let db = null;

async function ensureIndexes(database) {
  try {
    await database
      .collection("services")
      .createIndexes([
        { key: { vendorId: 1, createdAt: -1 } },
        { key: { status: 1, availability: 1, createdAt: -1 } },
        { key: { status: 1, availability: 1, category: 1 } },
        { key: { status: 1, availability: 1, price: 1 } },
        { key: { location: 1 } },
      ]);

    await database
      .collection("bookings")
      .createIndexes([
        { key: { customerId: 1, createdAt: -1 } },
        { key: { vendorId: 1, status: 1, createdAt: -1 } },
        { key: { serviceId: 1 } },
        { key: { status: 1 } },
        // Guards the "one active request per customer/service/date" rule at the
        // database level too. Partial, so cancelled/rejected rows do not block
        // a fresh request.
        {
          key: { customerId: 1, serviceId: 1, eventDate: 1 },
          unique: true,
          partialFilterExpression: { status: { $in: ["pending", "accepted"] } },
        },
      ]);

    await database
      .collection("transactions")
      .createIndexes([
        { key: { vendorId: 1, createdAt: -1 } },
        { key: { status: 1 } },
        { key: { stripeSessionId: 1 }, unique: true, sparse: true },
        // One-time passes have no subscription id, so the field is null on most
        // rows. A sparse unique index would still collide on repeated nulls;
        // indexing only real string ids keeps renewals unique without blocking
        // the second purchase.
        {
          key: { stripeSubscriptionId: 1 },
          unique: true,
          partialFilterExpression: { stripeSubscriptionId: { $type: "string" } },
        },
      ]);

    await database.collection("users").createIndex({ role: 1 });
  } catch (error) {
    // Index creation must not prevent the API from booting in development.
    console.error("[db] Index setup failed:", error.message);
  }
}

export async function connectDB() {
  if (db) return db;

  const newClient = new MongoClient(env.mongoUri, {
    serverSelectionTimeoutMS: 10000,
    retryWrites: true,
  });

  try {
    await newClient.connect();
    const database = newClient.db(env.mongoDb);
    await database.command({ ping: 1 });
    await ensureIndexes(database);

    client = newClient;
    db = database;
    console.log(`[db] Connected to MongoDB database "${env.mongoDb}"`);
    return db;
  } catch (error) {
    await newClient.close().catch(() => {});
    throw error;
  }
}

export function getDb() {
  if (!db) {
    throw new Error("Database is not connected. Call connectDB() before using collections.");
  }
  return db;
}

export function getCollection(name) {
  return getDb().collection(name);
}

export async function pingDB() {
  if (!db) return false;
  try {
    await db.command({ ping: 1 });
    return true;
  } catch {
    return false;
  }
}

export async function closeDB() {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}
