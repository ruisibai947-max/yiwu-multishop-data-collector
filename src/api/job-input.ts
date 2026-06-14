import type Database from "better-sqlite3";
import { z } from "zod";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export const JobInputSchema = z
  .object({
    accountId: z.string().min(1),
    shopId: z.string().min(1),
    datasetCode: z.string().min(1),
    businessFrom: z.string().regex(datePattern),
    businessTo: z.string().regex(datePattern)
  })
  .superRefine((value, context) => {
    if (value.businessFrom > value.businessTo) {
      context.addIssue({
        code: "custom",
        path: ["businessFrom"],
        message: "businessFrom must not be after businessTo"
      });
    }
  });

export type JobInput = z.infer<typeof JobInputSchema>;

type TargetRow = {
  platform: string;
};

export function resolveActiveTarget(
  db: Database.Database,
  input: Pick<JobInput, "accountId" | "shopId">
): TargetRow | undefined {
  return db
    .prepare(
      `SELECT accounts.platform
       FROM accounts
       JOIN shops ON shops.account_id = accounts.id
       WHERE accounts.id = ? AND shops.id = ?
         AND accounts.status = 'active' AND shops.status = 'active'`
    )
    .get(input.accountId, input.shopId) as TargetRow | undefined;
}

export function datasetIsSupported(
  supportedDatasets: Map<string, Set<string>>,
  platform: string,
  datasetCode: string
): boolean {
  return supportedDatasets.get(platform)?.has(datasetCode) ?? false;
}
