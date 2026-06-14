import path from "node:path";
import { z } from "zod";

const isAbsolutePath = (value: string) =>
  path.posix.isAbsolute(value) || path.win32.isAbsolute(value);

const secretReference = z
  .string()
  .regex(
    /^[a-z][a-z0-9_]*$/,
    "secret values must be stored as lowercase reference names"
  );

const AppConfigSchema = z.object({
  runtimeDir: z.string().refine(isAbsolutePath, "runtimeDir must be absolute"),
  databaseFile: z.string().min(1),
  api: z.object({
    host: z.string().default("127.0.0.1"),
    port: z.number().int().positive().default(4310)
  }),
  bitBrowser: z.object({
    baseUrl: z.url()
  }),
  secrets: z.object({
    feishuAppSecret: secretReference.optional()
  })
});

export type AppConfig = z.infer<typeof AppConfigSchema>;

export const parseAppConfig = (value: unknown): AppConfig =>
  AppConfigSchema.parse(value);
