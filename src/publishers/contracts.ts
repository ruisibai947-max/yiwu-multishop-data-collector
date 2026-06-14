export type PublicationBatch = {
  batchKey: string;
  datasetCode: string;
  rowIds: string[];
};

export interface Publisher {
  readonly destination: string;
  publish(batch: PublicationBatch): Promise<void>;
}
