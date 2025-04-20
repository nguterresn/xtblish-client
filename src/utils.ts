import tracer from "tracer";

const logger = tracer.console({
  format: "{{timestamp}} <{{title}}> - {{message}}",
});

export abstract class Result<T> {
  isOk(): boolean {
    return this instanceof Ok;
  }
  isError(): boolean {
    return !this.isOk();
  }

  abstract unwrap(): T;
}

class Ok<T> extends Result<T> {
  data: T;
  constructor(data: T) {
    super();
    this.data = data;
  }

  unwrap(): T {
    return this.data;
  }
}

class Failure extends Result<any> {
  message: string;
  constructor(message: string) {
    super();
    this.message = message;

    logger.error(message);
  }

  unwrap(): any {
    throw this.message;
  }
}

export function ok<T>(data: T): Ok<T> {
  return new Ok<T>(data);
}

export function failure(message: string): Failure {
  return new Failure(message);
}
