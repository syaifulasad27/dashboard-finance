import { MongoClient, ObjectId } from "mongodb";
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

async function inspect() {
  console.log("Connecting to:", process.env.MONGODB_URI?.split("@")[1] || "UNDEFINED");
  const client = new MongoClient(process.env.MONGODB_URI!);
  console.log("Client created, connecting...");
  await client.connect();
  console.log("Connected!");
  const db = client.db();

  console.log("--- Collection: user ---");
  const users = await db.collection("user").find().limit(1).toArray();
  console.log(JSON.stringify(users, null, 2));

  console.log("\n--- Collection: account ---");
  const accounts = await db.collection("account").find().limit(1).toArray();
  console.log(JSON.stringify(accounts, null, 2));

  console.log("\n--- Collection: session ---");
  const sessions = await db.collection("session").find().toArray();
  console.log(JSON.stringify(sessions, null, 2));

  if (users.length > 0 && accounts.length > 0) {
    const user = users[0];
    const account = accounts[0];
    console.log("\n--- Type Check ---");
    console.log("User _id type:", typeof user._id, user._id instanceof ObjectId ? "(ObjectId)" : "");
    console.log("Account userId type:", typeof account.userId, account.userId instanceof ObjectId ? "(ObjectId)" : "");
  }

  await client.close();
}

inspect().catch(console.error);
