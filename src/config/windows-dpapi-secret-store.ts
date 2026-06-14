import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import type { SecretStore } from "./secret-store.js";

const execFileAsync = promisify(execFile);
const secretNamePattern = /^[a-z][a-z0-9_]*$/;

type CommandRunner = (command: string) => Promise<string>;

const defaultRunner: CommandRunner = async (command) => {
  const { stdout } = await execFileAsync("powershell.exe", [
    "-NoProfile",
    "-NonInteractive",
    "-Command",
    command
  ]);
  return stdout;
};

const quotePowerShellLiteral = (value: string) => value.replaceAll("'", "''");

export class WindowsDpapiSecretStore implements SecretStore {
  constructor(
    private readonly secretDirectory: string,
    private readonly runCommand: CommandRunner = defaultRunner
  ) {}

  async get(name: string): Promise<string> {
    if (!secretNamePattern.test(name)) {
      throw new Error(`Invalid secret reference: ${name}`);
    }

    const file = path.win32.join(this.secretDirectory, `${name}.dpapi`);
    const quotedFile = quotePowerShellLiteral(file);
    const command = [
      `$secure = Get-Content -Raw -Path '${quotedFile}' | ConvertTo-SecureString`,
      "$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)",
      "try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }",
      "finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }"
    ].join("; ");

    return (await this.runCommand(command)).trim();
  }
}
