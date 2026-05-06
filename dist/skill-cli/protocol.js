export class Request {
    id;
    action;
    session;
    params;
    constructor(init) {
        this.id = init.id;
        this.action = init.action;
        this.session = init.session;
        this.params = init.params ?? {};
    }
    to_json() {
        return JSON.stringify({
            id: this.id,
            action: this.action,
            session: this.session,
            params: this.params,
        });
    }
    static from_json(data) {
        const parsed = JSON.parse(data);
        return new Request(parsed);
    }
}
export class Response {
    id;
    success;
    data;
    error;
    constructor(init) {
        this.id = init.id;
        this.success = init.success;
        this.data = init.data ?? null;
        this.error = init.error ?? null;
    }
    to_json() {
        return JSON.stringify({
            id: this.id,
            success: this.success,
            data: this.data,
            error: this.error,
        });
    }
    static from_json(data) {
        const parsed = JSON.parse(data);
        return new Response(parsed);
    }
}
