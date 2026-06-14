import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildApp } from "../../src/app.js";

describe("health route", () => {
  it("returns ok", async () => {
    const app = buildApp();
    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
    await app.close();
  });

  it("serves the built administration UI when a dist directory exists", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "admin-dist-"));
    fs.writeFileSync(
      path.join(directory, "index.html"),
      "<html><body>Yiwu Admin</body></html>"
    );
    const app = buildApp({ adminDistDir: directory });

    const response = await app.inject({ method: "GET", url: "/" });

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain("Yiwu Admin");
    await app.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });
});
