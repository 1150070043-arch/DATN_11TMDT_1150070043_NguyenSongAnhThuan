// Deliberately fixed names: this command cannot reset the user's regular databases.
process.env.BASELINE_DB_NAME = "BookGuardAuditBaseline";
process.env.BASELINE_DB_USER = "bookguard_audit_baseline";
process.env.SECURE_DB_NAME = "BookGuardAuditSecure";
process.env.SECURE_DB_USER = "bookguard_audit_secure";
const { initializeDatabases } = await import("../apps/api/dist/db/bootstrap.js");
await initializeDatabases(process.argv.includes("--reset"), "all");
