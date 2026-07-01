const fs = require('fs');
const path = require('path');
const postgres = require('postgres');

// 1. Manually parse .env.local to load DATABASE_URL
const envPath = path.join(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf8');
  envFile.split('\n').forEach(line => {
    const match = line.match(/^\s*([^#=]+)\s*=\s*(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.substring(1, value.length - 1);
      } else if (value.startsWith("'") && value.endsWith("'")) {
        value = value.substring(1, value.length - 1);
      }
      process.env[key] = value;
    }
  });
}

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("Error: DATABASE_URL is not defined in .env.local");
  process.exit(1);
}

const sql = postgres(dbUrl, {
  ssl: dbUrl.includes('sslmode=require') ? 'require' : false
});

async function main() {
  console.log("Connecting to PostgreSQL to clear data...");
  try {
    // Truncate users and cards tables
    await sql`truncate table cards, users restart identity cascade`;
    console.log("All data cleared successfully (users and cards tables truncated).");
    process.exit(0);
  } catch (error) {
    console.error("Clearing data failed:", error);
    process.exit(1);
  }
}

main();
