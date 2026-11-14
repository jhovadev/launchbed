import type { APIRoute } from "astro";
import { InitializrError, toErrorPayload } from "@android-initializr/schema";
import { getCatalog } from "@android-initializr/generator";

export const prerender = false;

export const GET: APIRoute = () => {
  try {
    return new Response(JSON.stringify(getCatalog()), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "public, max-age=300",
      },
    });
  } catch (error) {
    const payload = toErrorPayload(error);
    return new Response(JSON.stringify(payload), {
      status: 500,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
};

export const ALL: APIRoute = () =>
  new Response(JSON.stringify(new InitializrError("INVALID_REQUEST", "Use GET.").toJSON()), {
    status: 405,
    headers: { allow: "GET", "content-type": "application/json; charset=utf-8" },
  });
