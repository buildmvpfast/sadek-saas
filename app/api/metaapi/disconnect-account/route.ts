import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { deleteProvisioningAccount } from "@/lib/metaapi-provisioning";

/**
 * Supprime le compte côté MetaAPI puis la ligne `mt5_accounts` (propriétaire uniquement).
 */
export async function POST(request: Request) {
  try {
    const supabase = createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      mt5AccountId?: string;
    };
    const mt5AccountId =
      typeof body.mt5AccountId === "string" ? body.mt5AccountId.trim() : "";
    if (!mt5AccountId) {
      return NextResponse.json(
        { error: "mt5AccountId requis" },
        { status: 400 },
      );
    }

    const { data: row, error: selErr } = await supabase
      .from("mt5_accounts")
      .select("id, metaapi_account_id, user_id")
      .eq("id", mt5AccountId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (selErr) {
      return NextResponse.json({ error: selErr.message }, { status: 500 });
    }
    if (!row) {
      return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });
    }

    const token = process.env.METAAPI_TOKEN;
    if (row.metaapi_account_id && token) {
      await deleteProvisioningAccount(row.metaapi_account_id, token);
    }

    const { error: delErr } = await supabase
      .from("mt5_accounts")
      .delete()
      .eq("id", mt5AccountId)
      .eq("user_id", user.id);

    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
