let endpoint;
export let modelIndex;

export async function connect() {
  const configResponse = await globalThis.fetch(new URL("./live.json", import.meta.url), { cache: "no-store" });
  if (!configResponse.ok) throw new Error("The viewer's connection settings could not be loaded.");
  const config = await configResponse.json();
  endpoint = new URL(config.api);
  modelIndex = await api("/api/index", undefined, { signal: AbortSignal.timeout(20000) });
  if (!modelIndex.arch || !modelIndex.layers) throw new Error("The Spark returned an incomplete model index.");
  return modelIndex;
}

export function apiFetch(path, options = {}) {
  return globalThis.fetch(new URL(path, endpoint), {
    ...options,
    mode: "cors",
    credentials: "omit",
    redirect: "error",
  });
}

export async function api(path, body, options = {}) {
  const response = await apiFetch(path, {
    ...options,
    ...(body === undefined ? {} : {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  });
  if (!response.ok) {
    if (response.status === 401) throw new Error("Connect with your authorized Tailscale account.");
    throw new Error(`${path.split("?")[0]} ${response.status}: ${(await response.text()).slice(0, 160)}`);
  }
  return response.json();
}
