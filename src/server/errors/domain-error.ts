export class DomainError extends Error {
  readonly code: string;
  readonly publicMessage: string;
  readonly retryable: boolean;
  readonly field?: string;

  constructor(code: string, publicMessage: string, retryable: boolean, field?: string) {
    super(code);
    this.name = "DomainError";
    this.code = code;
    this.publicMessage = publicMessage;
    this.retryable = retryable;
    this.field = field;
  }
}
