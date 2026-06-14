import { describe, expect, it, vi } from "vitest";
import {
  serializeFailureNotification,
  type FailureNotification
} from "../../src/notifications/contracts.js";
import {
  FeishuWebhookNotifier,
  type NotificationFetcher
} from "../../src/notifications/feishu-webhook.js";

const notification: FailureNotification = {
  platform: "temu",
  accountName: "Temu Account 1",
  shopName: "Temu Shop 1",
  failedAt: "2026-06-14T10:00:00.000Z",
  category: "waiting_auth",
  action: "Open the BitBrowser profile and complete login"
};

describe("failure notification serialization", () => {
  it("drops secret and report fields even if supplied at runtime", () => {
    const unsafe = {
      ...notification,
      password: "must-not-leak",
      cookie: "must-not-leak",
      verificationCode: "must-not-leak",
      rawResponseHeaders: { authorization: "must-not-leak" },
      reportRows: [{ gmv: "100.00" }]
    };

    const serialized = JSON.stringify(
      serializeFailureNotification(unsafe)
    );

    expect(serialized).not.toContain("must-not-leak");
    expect(serialized).not.toContain("reportRows");
    expect(serialized).toContain("Temu Shop 1");
  });
});

describe("FeishuWebhookNotifier", () => {
  it("sends a safe Feishu text payload", async () => {
    let requestedUrl: string | URL | Request | undefined;
    let requestedInit: RequestInit | undefined;
    const fetcher: NotificationFetcher = async (input, init) => {
      requestedUrl = input;
      requestedInit = init;
      return new Response(null, { status: 200 });
    };
    const notifier = new FeishuWebhookNotifier(
      "https://example.test/webhook",
      fetcher,
      { error: vi.fn() }
    );

    const sent = await notifier.send(notification);

    expect(sent).toBe(true);
    expect(requestedUrl).toBe("https://example.test/webhook");
    expect(String(requestedInit?.body)).toContain("waiting_auth");
  });

  it("logs non-2xx responses without throwing", async () => {
    const logger = { error: vi.fn() };
    const notifier = new FeishuWebhookNotifier(
      "https://example.test/webhook",
      async () => new Response("failed", { status: 500 }),
      logger
    );

    await expect(notifier.send(notification)).resolves.toBe(false);
    expect(logger.error).toHaveBeenCalledOnce();
  });
});
