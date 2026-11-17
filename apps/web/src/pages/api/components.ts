import type { APIRoute } from "astro";
import { loadComponentCatalog } from "@launchbed/generator";

export const prerender = false;

export const GET: APIRoute = () => {
  return new Response(JSON.stringify(loadComponentCatalog()), {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
};

export const ALL: APIRoute = () =>
  new Response(JSON.stringify({ error: { code: "INVALID_REQUEST", message: "Use GET.", issues: [] } }), {
    status: 405,
    headers: { allow: "GET", "content-type": "application/json; charset=utf-8" },
  });
