import { chromium, type Browser } from "playwright-core";
import type { BitBrowserClient } from "./client.js";

type BitBrowserSessionClient = Pick<
  BitBrowserClient,
  "openProfile" | "closeProfile"
>;

type BrowserConnector = (websocketEndpoint: string) => Promise<Browser>;

const defaultConnector: BrowserConnector = (websocketEndpoint) =>
  chromium.connectOverCDP(websocketEndpoint);

export async function withBitBrowser<T>(
  client: BitBrowserSessionClient,
  profileId: string,
  action: (browser: Browser) => Promise<T>,
  connect: BrowserConnector = defaultConnector
): Promise<T> {
  const { websocketEndpoint } = await client.openProfile(profileId);
  let browser: Browser | undefined;

  try {
    browser = await connect(websocketEndpoint);
    return await action(browser);
  } finally {
    try {
      await browser?.close();
    } finally {
      await client.closeProfile(profileId);
    }
  }
}
