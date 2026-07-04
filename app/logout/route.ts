import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// A Server Component (the previous app/logout/page.tsx) cannot set cookies -
// Next.js throws if you try, and lib/supabase/server.ts's cookie adapter
// silently swallows that error, so signOut()'s cookie-clearing never
// actually reached the response. Route Handlers can set cookies, so the
// session is genuinely cleared here.
export async function GET(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/", request.url));
}
