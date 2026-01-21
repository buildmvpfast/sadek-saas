
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function addMapping() {
  const { data, error } = await supabase
    .from("symbol_mappings")
    .upsert({
      broker_name: "VT Markets",
      standard_symbol: "GOLD",
      broker_symbol: "XAUUSD-ECN"
    }, { onConflict: 'broker_name,standard_symbol' });

  if (error) {
    console.error("❌ Error adding mapping:", error);
  } else {
    console.log("✅ Mapping GOLD -> XAUUSD-ECN added for VT Markets!");
  }
}

addMapping();
