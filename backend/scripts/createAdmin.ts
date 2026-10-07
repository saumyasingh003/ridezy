/**
 * Creates the ADMIN account from environment variables. This is the ONLY way
 * an admin can be created: there is no HTTP endpoint for it.
 *
 *   ADMIN_NAME=... ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run create-admin
 *   (or put the values in .env)
 *
 * Whoever can run this already has the database credentials, so it adds no
 * new attack surface. Remove ADMIN_PASSWORD from .env after running it.
 */
import { z } from "zod";
import { connectDB, disconnectDB } from "../src/config/db.js";
import { User } from "../src/models/User.js";
import { hashPassword, nameSchema, passwordSchema } from "../src/controllers/auth.js";
import { logger } from "../src/utils/logger.js";

const adminEnvSchema = z.object({
  ADMIN_NAME: nameSchema,
  ADMIN_EMAIL: z.string().trim().toLowerCase().pipe(z.email("ADMIN_EMAIL must be a valid email")),
  ADMIN_PASSWORD: passwordSchema,
});

async function createAdmin(): Promise<void> {
  const parsed = adminEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    // Only field names and rule messages are printed, never the values.
    const problems = parsed.error.issues.map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`);
    throw new Error(`Invalid admin configuration:\n${problems.join("\n")}`);
  }
  const { ADMIN_NAME: name, ADMIN_EMAIL: email, ADMIN_PASSWORD: password } = parsed.data;

  await connectDB();

  const existing = await User.findOne({ email });
  if (existing) {
    // Never silently promote an existing (possibly attacker-registered) account.
    if (existing.role === "ADMIN") {
      logger.info(`Admin ${email} already exists. Nothing to do.`);
      return;
    }
    throw new Error(`${email} is already registered as ${existing.role}. Refusing to promote it to ADMIN.`);
  }

  await User.create({
    name,
    email,
    password: await hashPassword(password),
    role: "ADMIN",
    // Trusted creation path, so the email is configured as verified.
    isEmailVerified: true,
  });

  logger.info(`✅ Admin account created for ${email}`);
}

try {
  await createAdmin();
} catch (err) {
  logger.error(err instanceof Error ? err.message : "Failed to create admin");
  process.exitCode = 1;
} finally {
  await disconnectDB().catch(() => undefined);
}
