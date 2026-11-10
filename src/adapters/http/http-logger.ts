export interface HttpLogger {
  error(obj: object, msg?: string): void;
}

export const silentHttpLogger: HttpLogger = {
  error() {
    // Intentionally silent: tests and callers without a logger stay quiet.
  }
};
