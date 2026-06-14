import { expectTypeOf, it } from "vitest";
import type {
  JobRequest,
  PlatformAdapter
} from "../../src/adapters/contracts.js";
import type {
  DatasetParser,
  NormalizedRow
} from "../../src/parsers/contracts.js";
import type { Publisher } from "../../src/publishers/contracts.js";

it("requires adapters to expose a platform and collection methods", () => {
  expectTypeOf<PlatformAdapter["platform"]>().toEqualTypeOf<string>();
  expectTypeOf<PlatformAdapter["probeSession"]>().toBeFunction();
  expectTypeOf<PlatformAdapter["collect"]>().toBeFunction();
});

it("keeps parser and publisher boundaries dataset-oriented", () => {
  expectTypeOf<DatasetParser["datasetCode"]>().toEqualTypeOf<string>();
  expectTypeOf<DatasetParser["parse"]>().toBeFunction();
  expectTypeOf<Publisher["publish"]>().toBeFunction();
});

it("uses explicit job and normalized row shapes", () => {
  expectTypeOf<JobRequest>().toMatchTypeOf<{
    jobId: string;
    platform: string;
    accountId: string;
    datasetCode: string;
    businessFrom: string;
    businessTo: string;
  }>();
  expectTypeOf<NormalizedRow["naturalKey"]>().toEqualTypeOf<string>();
  expectTypeOf<NormalizedRow["metrics"]>().toBeArray();
});
