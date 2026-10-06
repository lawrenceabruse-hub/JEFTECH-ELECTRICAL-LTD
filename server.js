"use strict";

const http = require("node:http");
const path = require("node:path");
const fs = require("node:fs");

const PORT = Number(process.env.PORT || 3000);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const MAX_BODY_BYTES = 16 * 1024;
const MAX_MESSAGES = 12;
const MAX_MESSAGE_LENGTH = 1500;
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 20;
const WEBSITE_DIR = path.join(__dirname, "index.html");
const rateLimits = new Map();

const contentTypes = {
  "/": "text/html; charset=utf-8",
  "/index.html": "text/html; charset=utf-8",
  "/favicon.ico": "image/svg+xml",
  "/style.css": "text/css; charset=utf-8",
  "/chat.js": "text/javascript; charset=utf-8",
  "/jeftech-mark.svg": "image/svg+xml"
};

const companyContext = [
  "You are the friendly, professional customer-service assistant for JEFTECH ELECTRICAL ENERGY LTD, an electrical services company based in Owerri, Imo State, Nigeria.",
  "Your job is to help prospective and existing clients with enquiries, explain the company's services, and make it easy for them to contact the company.",
  "Reply directly to the client's question in warm, natural, concise language. Use a professional, helpful tone suitable for clients in Nigeria. Avoid robotic wording, jargon, and unnecessary disclaimers.",
  "If a client asks where JEFTECH is located, clearly give the registered address: 10 Base 10 Estate, World Bank, Owerri, Imo State, Nigeria. The company is based in Owerri, Imo State.",
  "When useful, ask just one relevant follow-up question to understand the client's service need or project location. Do not interrogate clients or ask for sensitive personal or payment information.",
  "For quotes, bookings, or service arrangements, explain that the company needs to discuss the project directly; invite the client to call, email, or message on WhatsApp. Never promise a price, appointment, response time, or service outcome.",
  "Use the company's verified contact details as clear next steps when relevant: phone and WhatsApp +234 706 758 7195; email jeftech12345@hotmail.com.",
  "Answer using only these verified company details:",
  "The company designs, installs, maintains, and repairs electrical systems for residential, commercial, and industrial purposes.",
  "Registered business address: 10 Base 10 Estate, World Bank, Owerri, Imo State, Nigeria. Postcode and separate head-office address are not provided.",
  "Email: jeftech12345@hotmail.com. Phone and WhatsApp: +234 706 758 7195. Company status: active. RC number: 8918525.",
  "Do not invent a postcode, a separate head-office address, map directions, phone number, prices, opening hours, certifications, guarantees, staff, or service coverage.",
  "If asked about a detail that is not provided, say you do not have that information and offer the company phone number or email so the client can confirm directly.",
  "Never provide instructions for dangerous electrical work. If a client describes immediate electrical danger, advise them to keep away from the hazard and contact local emergency services or a qualified electrician.",
  "Do not claim to be a human employee."
].join(" ");

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

function setSecurityHeaders(response) {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
  );
}

function isRateLimited(address) {
  const now = Date.now();
  const previous = rateLimits.get(address);
  if (!previous || now - previous.startedAt >= RATE_WINDOW_MS) {
    rateLimits.set(address, { startedAt: now, count: 1 });
    if (rateLimits.size > 10_000) {
      for (const [key, value] of rateLimits) {
        if (now - value.startedAt >= RATE_WINDOW_MS) rateLimits.delete(key);
      }
    }
    return false;
  }

  previous.count += 1;
  return previous.count > RATE_LIMIT;
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) return null;
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return null;
  }
}

function isValidMessages(messages) {
  return Array.isArray(messages)
    && messages.length > 0
    && messages.length <= MAX_MESSAGES
    && messages[messages.length - 1]?.role === "user"
    && messages.every((message) =>
      message
      && (message.role === "user" || message.role === "assistant")
      && typeof message.content === "string"
      && message.content.trim().length > 0
      && message.content.length <= MAX_MESSAGE_LENGTH
    );
}

async function handleChat(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    sendJson(response, 405, { error: "Use POST to send a chat message." });
    return;
  }
  if (!request.headers["content-type"]?.toLowerCase().startsWith("application/json")) {
    sendJson(response, 415, { error: "Chat requests must use JSON." });
    return;
  }
  if (isRateLimited(request.socket.remoteAddress || "unknown")) {
    sendJson(response, 429, { error: "Too many messages. Please wait a moment and try again." });
    return;
  }
  if (!OPENAI_API_KEY) {
    console.error("Chat is unavailable: OPENAI_API_KEY is not configured.");
    sendJson(response, 503, { error: "Chat is not configured yet. Please email jeftech12345@hotmail.com." });
    return;
  }

  const body = await readJsonBody(request);
  if (!body) {
    sendJson(response, 400, { error: "The chat request must be valid JSON under 16 KB." });
    return;
  }
  if (!isValidMessages(body.messages)) {
    sendJson(response, 400, { error: "Send up to 12 messages, ending with a message of up to 1,500 characters." });
    return;
  }

  let upstream;
  try {
    upstream = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          { role: "system", content: companyContext },
          ...body.messages.map(({ role, content }) => ({ role, content: content.trim() }))
        ],
        max_tokens: 350,
        temperature: 0.4
      }),
      signal: AbortSignal.timeout(30_000)
    });
  } catch (error) {
    const timedOut = error?.name === "TimeoutError";
    console.error(timedOut ? "Chat provider request timed out." : "Could not reach chat provider.");
    sendJson(response, 502, { error: "The chat service is temporarily unavailable. Please try again or email us." });
    return;
  }

  if (!upstream.ok) {
    console.error(`Chat provider returned HTTP ${upstream.status}.`);
    sendJson(response, 502, { error: "The chat service is temporarily unavailable. Please try again or email us." });
    return;
  }

  let result;
  try {
    result = await upstream.json();
  } catch {
    console.error("Chat provider returned invalid JSON.");
    sendJson(response, 502, { error: "The chat service returned an invalid response. Please try again." });
    return;
  }

  const reply = result?.choices?.[0]?.message?.content;
  if (typeof reply !== "string" || !reply.trim()) {
    console.error("Chat provider response did not include a reply.");
    sendJson(response, 502, { error: "The chat service returned an empty response. Please try again." });
    return;
  }
  sendJson(response, 200, { reply: reply.trim() });
}

const server = http.createServer(async (request, response) => {
  setSecurityHeaders(response);
  let pathname;
  try {
    pathname = new URL(request.url, "http://localhost").pathname;
  } catch {
    sendJson(response, 400, { error: "Invalid request URL." });
    return;
  }

  if (pathname === "/api/chat") {
    await handleChat(request, response);
    return;
  }

  if (pathname === "/healthz" && request.method === "GET") {
    sendJson(response, 200, { status: "ok", aiConfigured: Boolean(OPENAI_API_KEY) });
    return;
  }

  if (pathname === "/robots.txt" && request.method === "GET") {
    const host = request.headers.host || "";
    const origin = /^[a-z0-9.-]+(?::\d{1,5})?$/i.test(host) ? `https://${host}` : "";
    response.writeHead(200, {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600"
    });
    response.end(`User-agent: *\nAllow: /\n${origin ? `Sitemap: ${origin}/sitemap.xml\n` : ""}`);
    return;
  }

  if (pathname === "/sitemap.xml" && request.method === "GET") {
    const host = request.headers.host || "";
    if (!/^[a-z0-9.-]+(?::\d{1,5})?$/i.test(host)) {
      sendJson(response, 400, { error: "A valid website host is required to generate the sitemap." });
      return;
    }
    const sitemap = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      `  <url><loc>https://${host}/</loc></url>`,
      "</urlset>"
    ].join("\n");
    response.writeHead(200, {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600"
    });
    response.end(sitemap);
    return;
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" });
    response.end();
    return;
  }

  const contentType = contentTypes[pathname];
  if (!contentType) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  const assetPath = pathname === "/"
    ? "index.html"
    : pathname === "/favicon.ico"
      ? "jeftech-mark.svg"
      : pathname.slice(1);
  const filePath = path.join(WEBSITE_DIR, assetPath);
  fs.readFile(filePath, (error, data) => {
    if (error) {
      console.error(`Could not read website asset ${pathname}.`);
      response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Could not load website asset");
      return;
    }
    response.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": pathname === "/" || pathname === "/index.html" ? "no-cache" : "public, max-age=3600"
    });
    response.end(request.method === "HEAD" ? undefined : data);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`JEFTECH website listening on port ${PORT}.`);
  if (!OPENAI_API_KEY) console.log("Set OPENAI_API_KEY to enable AI chat.");
});
