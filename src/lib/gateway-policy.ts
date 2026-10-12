/** Shared request policy for the proxy and server-side business entry points. */
export function gatewayConfig(env: Record<string, string | undefined> = process.env) {
  const username = env.PORTAL_ALLOWED_USER;
  const publicUrl = env.LIBRARY_PUBLIC_URL;
  const authUrl = env.PORTAL_AUTH_URL;
  if (!username || !/^[a-z][a-z0-9_-]{0,31}$/.test(username) || !publicUrl || !authUrl) return null;
  try {
    const app = new URL(publicUrl);
    const auth = new URL(authUrl);
    if ([app, auth].some(url => url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/")) return null;
    return { username, origin: app.origin, authOrigin: auth.origin };
  } catch { return null; }
}

export function gatewayFailure(headers: Pick<Headers, "get">, method: string, env: Record<string, string | undefined> = process.env) {
  const config = gatewayConfig(env);
  if (!config) return { status: 503, error: "认证配置不完整" };
  const user = headers.get("remote-user");
  if (!user) return { status: 401, error: "请重新登录" };
  if (user !== config.username) return { status: 403, error: "无权访问" };
  if (!["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase())) {
    if (headers.get("origin") !== config.origin) return { status: 403, error: "请求来源不受信任" };
    // Cover POST and DELETE may have no body. Supplied bodies must be JSON.
    const contentType = headers.get("content-type");
    if ((contentType && contentType.split(";")[0].trim().toLowerCase() !== "application/json") ||
        (!contentType && (headers.get("transfer-encoding") || Number(headers.get("content-length") || 0) > 0))) {
      return { status: 415, error: "仅接受 JSON 请求" };
    }
  }
  return null;
}
