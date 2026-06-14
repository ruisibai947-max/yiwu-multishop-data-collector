export class WaitingForAuthError extends Error {
  override readonly name = "WaitingForAuthError";
}

export class RetryableCollectionError extends Error {
  override readonly name = "RetryableCollectionError";
}

export class DataValidationError extends Error {
  override readonly name = "DataValidationError";
}
