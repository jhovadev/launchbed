import type { APIRoute } from "astro";
import { toErrorPayload } from "@launchbed/schema";
import { ALL_PRESETS, isPresetGeneratable } from "@launchbed/catalog";

export const prerender = false;

export const GET: APIRoute = () => {
  try {
    const presets = ALL_PRESETS.map((preset) => ({
      ...preset,
      generatable: isPresetGeneratable(preset),
    }));
    return new Response(JSON.stringify({ presets }), {
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=300" },
    });
  } catch (error) {
    const payload = toErrorPayload(error);
    return new Response(JSON.stringify(payload), {
      status: 500,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
};
