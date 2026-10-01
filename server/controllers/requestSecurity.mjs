const MAX_JSON_BODY_BYTES = 64_000;

export function validateJsonMutation(req, { checkOrigin = true } = {}) {
  const contentType = String(req.headers?.["content-type"] ?? "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (contentType !== "application/json") {
    return { status: 415, error: "Content-Type deve ser application/json" };
  }

  let bodySize;
  try {
    bodySize = Buffer.byteLength(JSON.stringify(req.body ?? {}), "utf8");
  } catch {
    return { status: 400, error: "Corpo JSON inválido" };
  }
  if (bodySize > MAX_JSON_BODY_BYTES) {
    return { status: 413, error: "Payload muito grande" };
  }

  const origin = req.headers?.origin;
  if (checkOrigin && origin) {
    let parsedOrigin;
    try {
      parsedOrigin = new URL(origin);
    } catch {
      return { status: 403, error: "Origem não permitida" };
    }
    const allowedHosts = [req.headers.host];
    const protocol = String(req.headers["x-forwarded-proto"] ?? (req.socket?.encrypted ? "https" : "http"))
      .split(",", 1)[0]
      .trim()
      .toLowerCase();
    const allowedOrigins = allowedHosts
      .filter(Boolean)
      .map(host => `${protocol}://${String(host).toLowerCase()}`);
    if (!allowedOrigins.includes(parsedOrigin.origin.toLowerCase())) {
      return { status: 403, error: "Origem não permitida" };
    }
  }

  return null;
}