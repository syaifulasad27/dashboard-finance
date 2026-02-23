import { MongoClient, ObjectId } from "mongodb";
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

async function migrate() {
  const client = new MongoClient(process.env.MONGODB_URI!);
  await client.connect();
  const db = client.db();

  console.log("Starting migration of 'account' collection...");
  const accounts = await db.collection("account").find({
    userId: { $type: "string" }
  }).toArray();

  console.log(`Found ${accounts.length} accounts to migrate.`);

  for (const account of accounts) {
    try {
      const userId = new ObjectId(account.userId);
      await db.collection("account").updateOne(
        { _id: account._id },
        { $set: { userId: userId } }
      );
      console.log(`Migrated account ${account._id} for userId ${account.userId}`);
    } catch (err) {
      console.error(`Failed to migrate account ${account._id}:`, err);
    }
  }

  console.log("Migration completed.");
  await client.close();
}

migrate().catch(console.error);
