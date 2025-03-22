export function isError(result) {
    if (result.ok == false) {
        console.log(result.error.message);
    }
    return result.ok == false;
}
export function isOk(result) {
    return result.ok == true;
}
export function ok(_data) {
    return { ok: true, data: _data };
}
export function failure(message) {
    return { ok: false, error: new Error(message) };
}
