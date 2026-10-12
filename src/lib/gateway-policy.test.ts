import assert from "node:assert/strict";
import test from "node:test";
import { gatewayFailure } from "./gateway-policy";

const env = { PORTAL_ALLOWED_USER: "owner", LIBRARY_PUBLIC_URL: "https://library.private.example.test", PORTAL_AUTH_URL: "https://auth.private.example.test" };
test("configuration and gateway identity fail closed", () => {
  const valid = new Headers({ "Remote-User": "owner" });
  assert.equal(gatewayFailure(valid, "GET", env), null);
  assert.equal(gatewayFailure(valid, "GET", {})?.status, 503);
  assert.equal(gatewayFailure(valid, "GET", { ...env, LIBRARY_PUBLIC_URL: "http://library.example.test" })?.status, 503);
  assert.equal(gatewayFailure(new Headers({ Cookie: "next-auth.session-token=old", "X-Forwarded-User": "owner" }), "GET", env)?.status, 401);
  for (const user of ["other", "owner, other", "OWNER"]) {
    assert.equal(gatewayFailure(new Headers({ "Remote-User": user }), "GET", env)?.status, 403);
  }
});
test("writes require the exact origin and reject browser form content", () => {
  const headers = new Headers({ "Remote-User": "owner", Origin: env.LIBRARY_PUBLIC_URL, "Content-Type": "application/json" });
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    assert.equal(gatewayFailure(headers, method, env), null);
    for (const origin of ["", "null", "https://blog.private.example.test", "https://evil.test"]) {
      const invalid = new Headers(headers); invalid.set("Origin", origin);
      assert.equal(gatewayFailure(invalid, method, env)?.status, 403);
    }
  }
  headers.set("Content-Type", "text/plain");
  assert.equal(gatewayFailure(headers, "POST", env)?.status, 415);
  headers.delete("Content-Type");
  assert.equal(gatewayFailure(headers, "POST", env), null);
  headers.set("Content-Length", "12");
  assert.equal(gatewayFailure(headers, "POST", env)?.status, 415);
});
