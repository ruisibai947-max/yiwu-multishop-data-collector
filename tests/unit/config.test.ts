import { describe, expect, it } from "vitest";
import { parseAppConfig } from "../../src/config/schema.js";
import { WindowsDpapiSecretStore } from "../../src/config/windows-dpapi-secret-store.js";
import { runtimePaths } from "../../src/runtime/paths.js";

const validConfig = {
  runtimeDir: "C:\\YiwuCollector\\runtime",
  databaseFile: "collector.db",
  api: { host: "127.0.0.1", port: 4310 },
  bitBrowser: { baseUrl: "http://127.0.0.1:54345" },
  secrets: { feishuAppSecret: "feishu_app_secret" }
};

describe("app config", () => {
  it("rejects relative runtime directories", () => {
    expect(() =>
      parseAppConfig({ ...validConfig, runtimeDir: "runtime" })
    ).toThrow(/absolute/);
  });

  it("accepts Windows absolute runtime directories on any development OS", () => {
    expect(parseAppConfig(validConfig).runtimeDir).toBe(
      "C:\\YiwuCollector\\runtime"
    );
  });

  it("rejects secret values that are not reference names", () => {
    expect(() =>
      parseAppConfig({
        ...validConfig,
        secrets: { feishuAppSecret: "actual-secret-value!" }
      })
    ).toThrow(/reference/);
  });

  it("creates all runtime paths under the configured directory", () => {
    expect(runtimePaths(parseAppConfig(validConfig))).toEqual({
      database: "C:\\YiwuCollector\\runtime\\collector.db",
      raw: "C:\\YiwuCollector\\runtime\\raw",
      screenshots: "C:\\YiwuCollector\\runtime\\screenshots",
      logs: "C:\\YiwuCollector\\runtime\\logs",
      backups: "C:\\YiwuCollector\\runtime\\backups",
      secrets: "C:\\YiwuCollector\\runtime\\secrets"
    });
  });

  it("uses POSIX separators for POSIX absolute runtime directories", () => {
    expect(
      runtimePaths(
        parseAppConfig({
          ...validConfig,
          runtimeDir: "/tmp/yiwu-collector"
        })
      ).database
    ).toBe("/tmp/yiwu-collector/collector.db");
  });

  it("reads a named Windows DPAPI secret through an injected runner", async () => {
    const commands: string[] = [];
    const store = new WindowsDpapiSecretStore(
      "C:\\YiwuCollector\\runtime\\secrets",
      async (command) => {
        commands.push(command);
        return "decrypted-value\r\n";
      }
    );

    await expect(store.get("feishu_app_secret")).resolves.toBe(
      "decrypted-value"
    );
    expect(commands[0]).toContain("feishu_app_secret.dpapi");
    expect(commands[0]).toContain("ConvertTo-SecureString");
  });
});
