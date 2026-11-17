import type { APIRoute } from "astro";
import { LaunchbedError, toErrorPayload } from "@launchbed/schema";
import { getCatalog } from "@launchbed/generator";

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
  new Response(JSON.stringify(new LaunchbedError("INVALID_REQUEST", "Use GET.").toJSON()), {
    status: 405,
    headers: { allow: "GET", "content-type": "application/json; charset=utf-8" },
  });
