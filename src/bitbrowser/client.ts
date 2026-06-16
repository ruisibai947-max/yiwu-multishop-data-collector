import { z } from "zod";

const OpenResponse = z.object({
  success: z.literal(true),
  data: z.object({
    ws: z.url()
  })
});

const ErrorResponse = z.object({
  success: z.literal(false),
  msg: z.string().optional(),
  message: z.string().optional()
});

export class BitBrowserClient {
  private readonly baseUrl: string;

  constructor(
    baseUrl: string,
    private readonly fetchFn: typeof fetch = fetch
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  async openProfile(profileId: string) {
    const response = await this.fetchFn(`${this.baseUrl}/browser/open`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: profileId })
    });

    if (!response.ok) {
      throw new Error(`BitBrowser open failed: ${response.status}`);
    }

    const bodyJson = await response.json();
    const failed = ErrorResponse.safeParse(bodyJson);
    if (failed.success) {
      throw new Error(
        `BitBrowser open failed: ${
          failed.data.msg ?? failed.data.message ?? "unknown error"
        }`
      );
    }

    const body = OpenResponse.parse(bodyJson);
    return { websocketEndpoint: body.data.ws };
  }

  async closeProfile(profileId: string): Promise<void> {
    const response = await this.fetchFn(`${this.baseUrl}/browser/close`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: profileId })
    });

    if (!response.ok) {
      throw new Error(`BitBrowser close failed: ${response.status}`);
    }
  }
}
