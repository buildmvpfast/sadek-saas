/** Serveurs FXCess MT4 — noms MT4 client + variantes MetaAPI (FXCESS-*). */
export const FXCESS_MT4_SERVERS: string[] = [
  "FXcess-Demo",
  "FXcess-Demo1",
  "FXCESS-Demo01",
  "FXCESS-Demo02",
  "FXcess-Live",
  "FXCESS-Live01",
];

function compactKey(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s_-]+/g, "");
}

export function fxcessServerVariant(
  server: string,
): "demo" | "demo1" | "live" | "other" {
  const k = compactKey(server);
  if (/live|real/.test(k)) return "live";
  if (/demo0*1$/.test(k) || /demo0*01$/.test(k)) return "demo1";
  if (/demo/.test(k)) return "demo";
  return "other";
}

/** Candidats de connexion MetaAPI pour la variante choisie (demo / demo1 / live). */
export function fxcessStaticServerCandidates(userServer: string): string[] {
  const v = fxcessServerVariant(userServer);
  if (v === "demo") {
    return [
      "FXcess-Demo",
      "FXCESS-Demo",
      "FXCESS-Demo01",
      "FXcess-Demo01",
    ];
  }
  if (v === "demo1") {
    return [
      "FXcess-Demo1",
      "FXCESS-Demo1",
      "FXCESS-Demo02",
      "FXcess-Demo01",
      "FXCESS-Demo01",
    ];
  }
  if (v === "live") {
    return ["FXcess-Live", "FXCESS-Live01", "FXCESS-Live02", "FXCESS-Live"];
  }
  return [userServer.trim()];
}
