
export type Failure = { ok: boolean, error: Error };
export type Ok<T> = { ok: boolean, data: T };
export type Result<T> = Ok<T> | Failure;

export function isError<T>(result: Result<T>): boolean {
  if (result.ok == false) {
    console.log((result as Failure).error.message);
  }
  return result.ok == false;
}

export function isOk<T>(result: Result<T>): boolean {
  return result.ok == true;
}

export function ok<T>(_data: T): Ok<T> {
  return { ok: true, data: _data };
}

export function failure(_error: Error): Failure {
  return { ok: false, error: _error };
}
