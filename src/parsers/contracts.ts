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

export type ParserValidationContext = {
  requiredColumns: string[];
  actualColumns: string[];
  emptyState: "non_empty" | "confirmed_zero" | "ambiguous";
  detailTotal?: string;
  reportTotal?: string;
};

export interface DatasetParser {
  readonly datasetCode: string;
  parse(filePath: string): Promise<NormalizedRow[]>;
  validationContext(
    filePath: string,
    rows: NormalizedRow[]
  ): Promise<ParserValidationContext>;
}
