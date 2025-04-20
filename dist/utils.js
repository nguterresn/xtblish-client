export class Result {
    isOk() {
        return this instanceof Ok;
    }
    isError() {
        return !this.isOk();
    }
}
class Ok extends Result {
    constructor(data) {
        super();
        this.data = data;
    }
    unwrap() {
        return this.data;
    }
}
class Failure extends Result {
    constructor(name, message) {
        super();
        this.message = message;
        const date = new Date();
        console.log(`[${date.getUTCSeconds()}:${date.getUTCMilliseconds()}] - "${name}": ${message}`);
    }
    unwrap() {
        throw this.message;
    }
}
export function ok(data) {
    return new Ok(data);
}
export function failure(name, message) {
    return new Failure(name, message);
}
