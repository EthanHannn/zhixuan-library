/** Preserve caller error handling while notifying the shared login banner. */
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, { ...init, cache: "no-store", redirect: "manual" });
  if (response.status === 401 || response.type === "opaqueredirect") {
    window.dispatchEvent(new Event("library:authentication-required"));
  }
  return response;
}
