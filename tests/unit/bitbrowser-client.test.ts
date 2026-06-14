import { describe, expect, it, vi } from "vitest";
import type { Browser } from "playwright-core";
import { BitBrowserClient } from "../../src/bitbrowser/client.js";
import { withBitBrowser } from "../../src/bitbrowser/session.js";

describe("BitBrowserClient", () => {
  it("opens a profile and returns the debugging address", async () => {
    const fetchFn = vi.fn(async () =>
      new Response(
        JSON.stringify({
          success: true,
          data: { ws: "ws://127.0.0.1/devtools/browser/1" }
        }),
        { status: 200 }
      )
    );
    const client = new BitBrowserClient(
      "http://127.0.0.1:54345",
      fetchFn as typeof fetch
    );

    await expect(client.openProfile("profile-1")).resolves.toEqual({
      websocketEndpoint: "ws://127.0.0.1/devtools/browser/1"
    });
    expect(fetchFn).toHaveBeenCalledWith(
      "http://127.0.0.1:54345/browser/open",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ id: "profile-1" })
      })
    );
  });

  it("rejects unsuccessful API responses", async () => {
    const fetchFn = vi.fn(async () => new Response("busy", { status: 503 }));
    const client = new BitBrowserClient(
      "http://127.0.0.1:54345",
      fetchFn as typeof fetch
    );

    await expect(client.openProfile("profile-1")).rejects.toThrow(
      "BitBrowser open failed: 503"
    );
  });
});

describe("withBitBrowser", () => {
  it("closes the browser connection and profile after the action", async () => {
    const client = {
      openProfile: vi.fn(async () => ({
        websocketEndpoint: "ws://127.0.0.1/devtools/browser/1"
      })),
      closeProfile: vi.fn(async () => undefined)
    };
    const browser = {
      close: vi.fn(async () => undefined)
    };
    const connect = vi.fn(async () => browser as unknown as Browser);

    const result = await withBitBrowser(
      client,
      "profile-1",
      async () => "finished",
      connect
    );

    expect(result).toBe("finished");
    expect(browser.close).toHaveBeenCalledOnce();
    expect(client.closeProfile).toHaveBeenCalledWith("profile-1");
  });
});
