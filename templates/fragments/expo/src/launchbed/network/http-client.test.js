import { describe, expect, test } from "bun:test";
import { createHttpClient } from "./http-client";

function fakeFetch(routes) {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url, init });
    const route = routes[new URL(url).pathname];
    if (!route) return new Response("missing", { status: 404 });
    return route(init);
  };
  return { fetch, calls };
}

describe("http client", () => {
  test("joins the base URL and parses JSON", async () => {
    const { fetch, calls } = fakeFetch({ "/v1/items": () => Response.json([{ id: 1 }]) });
    const client = createHttpClient({ baseUrl: "https://api.example.test/v1", fetch });
    expect(await client.getJson("/items")).toEqual({ kind: "success", value: [{ id: 1 }], status: 200 });
    expect(calls[0].url).toBe("https://api.example.test/v1/items");
  });

  test("maps HTTP errors, network errors and invalid JSON", async () => {
    const { fetch } = fakeFetch({ "/bad-json": () => new Response("{oops"), "/down": () => { throw new TypeError("Network request failed"); } });
    const client = createHttpClient({ baseUrl: "https://api.example.test/", fetch });
    expect(await client.getText("nope")).toEqual({ kind: "http-error", status: 404, body: "missing" });
    expect(await client.getJson("down")).toEqual({ kind: "network-error", message: "Network request failed" });
    expect((await client.getJson("bad-json")).kind).toBe("network-error");
  });

  test("sends JSON bodies and times out", async () => {
    const { fetch, calls } = fakeFetch({ "/echo": async (init) => new Response(init.body, { status: 201 }) });
    const client = createHttpClient({ baseUrl: "https://api.example.test/", fetch });
    expect(await client.postJson("echo", { name: "A" })).toEqual({ kind: "success", value: { name: "A" }, status: 201 });
    expect(calls[0].init.headers["Content-Type"]).toBe("application/json");
    const slow = createHttpClient({
      baseUrl: "https://api.example.test/",
      timeoutMs: 10,
      fetch: (_url, init) => new Promise((_resolve, reject) => init.signal.addEventListener("abort", () => reject(new Error("aborted")))),
    });
    expect(await slow.getText("slow")).toEqual({ kind: "timeout" });
  });
});
