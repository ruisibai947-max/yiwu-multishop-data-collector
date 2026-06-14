import {
  serializeFailureNotification,
  type FailureNotification
} from "./contracts.js";

export type NotificationLogger = {
  error(details: Record<string, unknown>, message?: string): void;
};

export type NotificationFetcher = (
  input: string | URL | Request,
  init?: RequestInit
) => Promise<Response>;

export class FeishuWebhookNotifier {
  constructor(
    private readonly webhookUrl: string,
    private readonly fetcher: NotificationFetcher = fetch,
    private readonly logger: NotificationLogger = console
  ) {}

  async send(notification: FailureNotification): Promise<boolean> {
    const safe = serializeFailureNotification(notification);
    const text = [
      `Platform: ${safe.platform}`,
      `Account: ${safe.accountName}`,
      ...(safe.shopName ? [`Shop: ${safe.shopName}`] : []),
      `Failed at: ${safe.failedAt}`,
      `Category: ${safe.category}`,
      `Action: ${safe.action}`
    ].join("\n");

    try {
      const response = await this.fetcher(this.webhookUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          msg_type: "text",
          content: { text }
        })
      });
      if (!response.ok) {
        this.logger.error(
          {
            status: response.status,
            category: safe.category,
            platform: safe.platform
          },
          "Feishu failure notification was rejected"
        );
        return false;
      }
      return true;
    } catch (error) {
      this.logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          category: safe.category,
          platform: safe.platform
        },
        "Feishu failure notification could not be sent"
      );
      return false;
    }
  }
}
