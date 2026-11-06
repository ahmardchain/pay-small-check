let cache: { at: number; url: string; body: unknown } | null = null;

export async function loadCatalog(url: string, fetchImpl: typeof fetch = fetch, ttlMs = 10 * 60 * 1000): Promise<unknown> {
  if (cache && cache.url === url && Date.now() - cache.at < ttlMs) return cache.body;
  const response = await fetchImpl(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`buy catalog returned HTTP ${response.status}`);
  const body = await response.json();
  cache = { at: Date.now(), url, body };
  return body;
}

export function clearCatalogCache(): void {
  cache = null;
}
