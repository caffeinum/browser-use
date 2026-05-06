export class MissingCookieException extends Error {
    cookie_name;
    cookie_description;
    constructor(cookie_name, cookie_description) {
        super(`Missing required cookie '${cookie_name}': ${cookie_description}`);
        this.name = 'MissingCookieException';
        this.cookie_name = cookie_name;
        this.cookie_description = cookie_description;
    }
}
