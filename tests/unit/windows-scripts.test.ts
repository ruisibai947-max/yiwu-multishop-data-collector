import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function script(name: string): string {
  return fs.readFileSync(
    path.resolve("scripts/windows", name),
    "utf8"
  );
}

describe("Windows deployment scripts", () => {
  it("installs with Node 24 and never overwrites local configuration", () => {
    const content = script("install.ps1");

    expect(content).toContain("$nodeMajor -ne 24");
    expect(content).toContain("npm ci");
    expect(content).toContain("npm run build");
    expect(content).toContain("Test-Path $localConfig");
    expect(content).toContain("npm run migrate");
  });

  it("starts and stops only the PID recorded under runtime", () => {
    expect(script("start.ps1")).toContain("collector.pid");
    expect(script("start.ps1")).toContain("Start-Process");
    expect(script("stop.ps1")).toContain("Stop-Process -Id $processId");
  });

  it("pauses collection and uses the SQLite backup command", () => {
    const content = script("backup.ps1");

    expect(content).toContain("/api/system/pause");
    expect(content).toContain("/api/system/resume");
    expect(content).toContain("backup-database.js");
    expect(content).not.toContain("Copy-Item $databasePath");
  });

  it("registers one service task and one backup task, not per-shop tasks", () => {
    const content = script("register-task.ps1");

    expect(content).toContain("YiwuCollector-Startup");
    expect(content).toContain("YiwuCollector-DailyBackup");
    expect(content).not.toContain("shopId");
  });
});
