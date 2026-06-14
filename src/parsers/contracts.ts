export type NormalizedMetric = {
  code: string;
  value: string;
  unit: "money" | "count" | "ratio";
  currency?: string;
};

export type NormalizedRow = {
  naturalKey: string;
  businessDate: string;
  currency?: string;
  payload: Record<string, unknown>;
  metrics: NormalizedMetric[];
};

export interface DatasetParser {
  readonly datasetCode: string;
  parse(filePath: string): Promise<NormalizedRow[]>;
}
