import server from "../dist/server/server.js";

export default async function handler(req: any, res: any) {
  const host = req.headers?.host || "localhost";
  const url = new URL(req.url ?? "/", `http://${host}`);

  const requestInit: RequestInit = {
    method: req.method,
    headers: req.headers as HeadersInit,
  };

  if (req.method !== "GET" && req.method !== "HEAD" && req.body) {
    requestInit.body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
  }

  const request = new Request(url.toString(), requestInit);
  const response = await server.fetch(request);

  for (const [key, value] of response.headers) {
    if (key.toLowerCase() === "transfer-encoding") continue;
    res.setHeader(key, value);
  }

  res.statusCode = response.status;

  if (response.body) {
    const body = await response.arrayBuffer();
    res.end(Buffer.from(body));
  } else {
    res.end();
  }
}
