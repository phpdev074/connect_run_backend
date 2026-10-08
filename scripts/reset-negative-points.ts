import * as dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI is not set in .env');
    process.exit(1);
  }

  await mongoose.connect(uri);
  const users = mongoose.connection.collection('users');

  const negativePoints = await users.countDocuments({ points: { $lt: 0 } });
  const result = await users.updateMany(
    { points: { $lt: 0 } },
    { $set: { points: 0 } },
  );

  console.log(
    `Found ${negativePoints} user(s) with negative points; reset ${result.modifiedCount} to 0.`,
  );

  const withMiles = await users
    .find({ total_miles: { $exists: true, $ne: null } })
    .project({ total_miles: 1 })
    .toArray();
  let milesFixed = 0;
  for (const u of withMiles) {
    const rounded = Number((u.total_miles || 0).toFixed(2));
    if (rounded !== u.total_miles) {
      await users.updateOne({ _id: u._id }, { $set: { total_miles: rounded } });
      milesFixed++;
    }
  }
  console.log(`Rounded total_miles for ${milesFixed} user(s) to 2 decimals.`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
