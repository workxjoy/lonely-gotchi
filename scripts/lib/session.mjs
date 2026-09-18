// Signs a smoke-test account in (creating it on first run) and returns a Cookie header for API calls.
export async function smokeSession(base) {
  const email = process.env.SMOKE_EMAIL ?? "smoke-test@lonely-gotchi.dev";
  const password = process.env.SMOKE_PASSWORD ?? "smoke-test-password";
  const headers = { "Content-Type": "application/json", Origin: base };
  const cookieFrom = (res) => res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");

  let res = await fetch(`${base}/api/auth/sign-in/email`, { method: "POST", headers, body: JSON.stringify({ email, password }) });
  if (!res.ok) {
    res = await fetch(`${base}/api/auth/sign-up/email`, {
      method: "POST",
      headers,
      body: JSON.stringify({ email, password, name: "Smoke" }),
    });
  }
  if (!res.ok) throw new Error(`smoke sign-in failed ${res.status}: ${await res.text()}`);
  return cookieFrom(res);
}
