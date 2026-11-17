import type { APIRoute } from "astro";
import { LIMITS, toErrorPayload } from "@launchbed/schema";
import { createPlan, parseRequestJson } from "@launchbed/generator";

export const prerender = false;

function errorStatus(code: string): number {
  if (code === "LIMIT_EXCEEDED") return 413;
  if (code === "SECURITY_ERROR") return 422;
  if (code === "INVALID_REQUEST" || code === "RESOLUTION_ERROR" || code === "UNKNOWN_ADDON") return 400;
  if (code === "TEMPLATE_ERROR") return 500;
  return 500;
}

export const POST: APIRoute = async ({ request }) => {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return new Response(
      JSON.stringify({ error: { code: "INVALID_REQUEST", message: "Content-Type must be application/json.", issues: [] } }),
      { status: 415, headers: { "content-type": "application/json; charset=utf-8" } },
    );
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > LIMITS.requestBytes) {
    return new Response(
      JSON.stringify({ error: { code: "LIMIT_EXCEEDED", message: "Request body is too large.", issues: [] } }),
      { status: 413, headers: { "content-type": "application/json; charset=utf-8" } },
    );
  }

  try {
    const body = await request.text();
    const plan = createPlan(parseRequestJson(body));
    return new Response(JSON.stringify(plan), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    const payload = toErrorPayload(error);
    return new Response(JSON.stringify(payload), {
      status: errorStatus(payload.error.code),
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    });
  }
};

export const ALL: APIRoute = () =>
  new Response(JSON.stringify({ error: { code: "INVALID_REQUEST", message: "Use POST.", issues: [] } }), {
    status: 405,
    headers: { allow: "POST", "content-type": "application/json; charset=utf-8" },
  });
