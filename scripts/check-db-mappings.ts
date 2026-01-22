
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

// Since I can't read .env.local, I'll just skip this if not possible
// But wait, the user's scripts use it. 
// I'll try to find the credentials in other files.

// Actually, I'll just write a script that attempts to use the environment
async function checkDB() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      console.log("❌ No Supabase URL in env");
      return;
  }
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from("symbol_mappings")
    .select("*")
    .eq("broker_name", "VT Markets");

  if (error) {
    console.error("❌ Error checking mappings:", error);
  } else {
    console.log("📊 VT Markets Mappings in DB:", JSON.stringify(data, null, 2));
  }
}

checkDB();
