import { connectDB, disconnectDB } from "../src/config/db.js";
import { User } from "../src/models/User.js";
import { hashPassword } from "../src/controllers/auth.js";
import { logger } from "../src/utils/logger.js";

async function main() {
  await connectDB();

  const targetEmail = "saumyasingh98982@gmail.com";
  const targetName = "Saumya Singh";

  // 1. Demote any other users who currently have ADMIN role
  const demoted = await User.updateMany(
    { role: "ADMIN", email: { $ne: targetEmail } },
    { $set: { role: "PASSENGER" } }
  );
  console.log(`Demoted ${demoted.modifiedCount} other admin(s) to PASSENGER.`);

  // 2. Find or create the target admin
  let user = await User.findOne({ email: targetEmail });
  if (user) {
    user.name = targetName;
    user.role = "ADMIN";
    user.isEmailVerified = true;
    await user.save();
    console.log(`Updated existing user ${targetEmail} to ADMIN with name "${targetName}".`);
  } else {
    const password = "Admin@12345";
    const hashedPassword = await hashPassword(password);
    user = await User.create({
      name: targetName,
      email: targetEmail,
      password: hashedPassword,
      role: "ADMIN",
      isEmailVerified: true,
    });
    console.log(`Created new admin user ${targetEmail} with password "${password}".`);
  }

  // 3. Verify admins
  const allAdmins = await User.find({ role: "ADMIN" });
  console.log("Current active Admins in DB:", allAdmins.map((a) => ({ id: a.id, email: a.email, name: a.name, role: a.role })));

  await disconnectDB();
}

main().catch((err) => {
  console.error("Error setting admin:", err);
  process.exit(1);
});
