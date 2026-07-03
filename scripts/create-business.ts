// Admin-only script to provision a business login.
// Usage:
//   npx tsx scripts/create-business.ts --email=owner@example.com --password=temp1234 --name="Peluqueria Ana"
//
// Requires SUPABASE_SERVICE_ROLE_KEY in .env.local (never expose this key to
// the browser or commit it - it bypasses Row Level Security entirely).

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

function parseArgs() {
  const args: Record<string, string> = {};
  for (const arg of process.argv.slice(2)) {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) {
      args[match[1]] = match[2];
    }
  }
  return args;
}

async function main() {
  const { email, password, name } = parseArgs();

  if (!email || !password || !name) {
    console.error(
      'Usage: npx tsx scripts/create-business.ts --email=... --password=... --name="..."'
    );
    process.exit(1);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
    );
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userData, error: userError } =
    await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

  if (userError || !userData.user) {
    console.error("Failed to create user:", userError?.message);
    process.exit(1);
  }

  const { error: businessError } = await supabase.from("businesses").insert({
    owner_id: userData.user.id,
    name,
    plan: "starter",
  });

  if (businessError) {
    console.error("Failed to create business row:", businessError.message);
    process.exit(1);
  }

  console.log(`Created business "${name}" for ${email} (plan: starter).`);
}

main();
