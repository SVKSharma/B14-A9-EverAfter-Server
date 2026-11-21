import { closeDB, connectDB, getCollection } from "../src/config/db.js";

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();

const photos = {
  couple:
    "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80",
  rings:
    "https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?auto=format&fit=crop&w=1200&q=80",
  chairs:
    "https://images.unsplash.com/photo-1522673607200-164d1b6ce486?auto=format&fit=crop&w=1200&q=80",
  reception:
    "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=1200&q=80",
  arch:
    "https://images.unsplash.com/photo-1529636798458-92182e662485?auto=format&fit=crop&w=1200&q=80",
};

const vendors = [
  {
    id: "seed-vendor-aurora",
    name: "Ava Sinclair",
    email: "aurora@everafter.test",
    businessName: "Aurora Events & Florals",
    subscriptionPlan: "premium",
    image: photos.rings,
  },
  {
    id: "seed-vendor-lumen",
    name: "Noah Bennett",
    email: "lumen@everafter.test",
    businessName: "Lumen Wedding Studios",
    subscriptionPlan: "free",
    image: photos.couple,
  },
  {
    id: "seed-vendor-saffron",
    name: "Mira Kapoor",
    email: "saffron@everafter.test",
    businessName: "Saffron & Sage Catering",
    subscriptionPlan: "premium",
    image: photos.reception,
  },
  {
    id: "seed-vendor-atelier",
    name: "Elena Rossi",
    email: "atelier@everafter.test",
    businessName: "Atelier Ivory",
    subscriptionPlan: "free",
    image: photos.chairs,
  },
];

const services = [
  {
    vendorId: "seed-vendor-aurora",
    serviceName: "Golden Hour Wedding Films",
    category: "photography",
    description:
      "Cinematic wedding photography and film with a warm, editorial finish. Two photographers, a highlight film, and a full online gallery are included so every glance and happy tear is preserved.",
    price: 1800,
    location: "Brooklyn, NY",
    images: [photos.couple, photos.rings],
    status: "approved",
    availability: true,
    createdAt: new Date(now - 1 * DAY),
  },
  {
    vendorId: "seed-vendor-aurora",
    serviceName: "Blush Garden Floral Design",
    category: "decoration",
    description:
      "Romantic ceremony arches, cascading bouquets, and tablescapes styled with seasonal garden blooms. Includes a design consultation and full day-of setup.",
    price: 1200,
    location: "Manhattan, NY",
    images: [photos.arch, photos.reception],
    status: "approved",
    availability: true,
    createdAt: new Date(now - 2 * DAY),
  },
  {
    vendorId: "seed-vendor-lumen",
    serviceName: "Silver Birch Photography",
    category: "photography",
    description:
      "Documentary-style photography for couples who want honest, unposed moments. Six hours of coverage, a second shooter, and 400+ edited images delivered in three weeks.",
    price: 2100,
    location: "Hudson Valley, NY",
    images: [photos.rings, photos.couple],
    status: "approved",
    availability: true,
    createdAt: new Date(now - 3 * DAY),
  },
  {
    vendorId: "seed-vendor-lumen",
    serviceName: "The Lakeside Estate",
    category: "venues",
    description:
      "A private waterfront estate with a garden ceremony lawn, covered terrace, and a light-filled ballroom for up to 180 guests. Includes tables, chairs, and a venue coordinator.",
    price: 5500,
    location: "Hudson Valley, NY",
    images: [photos.chairs, photos.reception],
    status: "approved",
    availability: true,
    createdAt: new Date(now - 4 * DAY),
  },
  {
    vendorId: "seed-vendor-lumen",
    serviceName: "Evergreen Wedding Pavilion",
    category: "venues",
    description:
      "An intimate glasshouse pavilion surrounded by evergreens, ideal for ceremonies of up to 80 guests. Currently awaiting final venue photos.",
    price: 4200,
    location: "Catskills, NY",
    images: [photos.arch],
    status: "pending",
    availability: true,
    createdAt: new Date(now - 5 * DAY),
  },
  {
    vendorId: "seed-vendor-saffron",
    serviceName: "Saffron Table Catering",
    category: "catering",
    description:
      "Seasonal sharing-style menus with South Asian and Mediterranean influences, cooked on site. Includes canapes, a three-course dinner, and a dedicated service team.",
    price: 3200,
    location: "Brooklyn, NY",
    images: [photos.reception, photos.chairs],
    status: "approved",
    availability: true,
    createdAt: new Date(now - 6 * DAY),
  },
  {
    vendorId: "seed-vendor-saffron",
    serviceName: "Sweet Layers Dessert Bar",
    category: "catering",
    description:
      "A styled dessert table with a three-tier cake, mini pastries, and late-night sweets. Setup and styling included, delivered anywhere in the city.",
    price: 650,
    location: "Queens, NY",
    images: [photos.rings, photos.reception],
    status: "approved",
    availability: true,
    createdAt: new Date(now - 7 * DAY),
  },
  {
    vendorId: "seed-vendor-atelier",
    serviceName: "Atelier Ivory Bridal Styling",
    category: "fashion",
    description:
      "Private bridal styling sessions with a curated rack of gowns, veils, and accessories. Includes alterations guidance and a second fitting before the big day.",
    price: 1500,
    location: "Manhattan, NY",
    images: [photos.couple, photos.chairs],
    status: "approved",
    availability: true,
    createdAt: new Date(now - 8 * DAY),
  },
  {
    vendorId: "seed-vendor-atelier",
    serviceName: "Luminous Bridal Beauty",
    category: "makeup",
    description:
      "Soft, long-wear bridal makeup and hair styling for the couple and up to four guests. Includes a trial session and touch-up kit for the day.",
    price: 450,
    location: "Brooklyn, NY",
    images: [photos.rings, photos.arch],
    status: "approved",
    availability: true,
    createdAt: new Date(now - 9 * DAY),
  },
  {
    vendorId: "seed-vendor-atelier",
    serviceName: "The Rosewood Manor",
    category: "venues",
    description:
      "A restored 1920s manor with a courtyard and candlelit dining room. Currently fully booked for the season.",
    price: 6800,
    location: "Long Island, NY",
    images: [photos.chairs, photos.arch],
    status: "approved",
    availability: false,
    createdAt: new Date(now - 10 * DAY),
  },
];

async function seed() {
  try {
    await connectDB();

    const users = getCollection("users");
    const servicesCollection = getCollection("services");

    for (const vendor of vendors) {
      await users.updateOne(
        { id: vendor.id },
        {
          $set: {
            id: vendor.id,
            name: vendor.name,
            email: vendor.email,
            emailVerified: true,
            image: vendor.image ?? null,
            role: "vendor",
            isBlocked: false,
            businessName: vendor.businessName,
            subscriptionPlan: vendor.subscriptionPlan,
            subscriptionExpiresAt:
              vendor.subscriptionPlan === "premium" ? new Date(now + 30 * DAY) : null,
            updatedAt: new Date(),
            createdAt: new Date(now - 30 * DAY),
          },
        },
        { upsert: true }
      );
    }

    const vendorIds = vendors.map((vendor) => vendor.id);
    await servicesCollection.deleteMany({ vendorId: { $in: vendorIds } });

    const result = await servicesCollection.insertMany(
      services.map((service) => ({
        ...service,
        updatedAt: new Date(),
      }))
    );

    console.log(
      `[seed] Upserted ${vendors.length} demo vendors and inserted ${result.insertedCount} services.`
    );
  } catch (error) {
    console.error("[seed] Failed:", error.message);
    process.exitCode = 1;
  } finally {
    await closeDB();
  }
}

seed();
