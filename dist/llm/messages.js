const truncate = (text, maxLength = 50) => {
    if (text.length <= maxLength) {
        return text;
    }
    return `${text.slice(0, maxLength - 3)}...`;
};
const formatImageUrl = (url, maxLength = 50) => {
    if (url.startsWith('data:')) {
        const mediaType = url.split(';')[0]?.split(':')[1] ?? 'image';
        return `<base64 ${mediaType}>`;
    }
    return truncate(url, maxLength);
};
export class ContentPartTextParam {
    text;
    type = 'text';
    constructor(text) {
        this.text = text;
    }
    toString() {
        return `Text: ${truncate(this.text)}`;
    }
}
export class ContentPartRefusalParam {
    refusal;
    type = 'refusal';
    constructor(refusal) {
        this.refusal = refusal;
    }
    toString() {
        return `Refusal: ${truncate(this.refusal)}`;
    }
}
export class ImageURL {
    url;
    detail;
    media_type;
    constructor(url, detail = 'auto', media = 'image/png') {
        this.url = url;
        this.detail = detail;
        this.media_type = media;
    }
    toString() {
        return `🖼️  Image[${this.media_type}, detail=${this.detail}]: ${formatImageUrl(this.url)}`;
    }
}
export class ContentPartImageParam {
    image_url;
    type = 'image_url';
    constructor(image_url) {
        this.image_url = image_url;
    }
    toString() {
        return this.image_url.toString();
    }
}
export class FunctionCall {
    name;
    // @ts-ignore - 'arguments' is a reserved keyword but valid as property name
    arguments;
    constructor(name, args) {
        this.name = name;
        // @ts-ignore
        this.arguments = args;
    }
    toString() {
        return `${this.name}(${truncate(this.arguments, 80)})`;
    }
}
export class ToolCall {
    id;
    functionCall;
    type = 'function';
    constructor(id, functionCall) {
        this.id = id;
        this.functionCall = functionCall;
    }
    toString() {
        return `ToolCall[${this.id}]: ${this.functionCall.toString()}`;
    }
}
export class MessageBase {
    cache = false;
    constructor(init) {
        if (init?.cache !== undefined) {
            this.cache = init.cache;
        }
    }
}
export class UserMessage extends MessageBase {
    role = 'user';
    content;
    name;
    constructor(content, name = null) {
        super();
        this.content = content;
        this.name = name;
    }
    get text() {
        if (typeof this.content === 'string') {
            return this.content;
        }
        return this.content
            .filter((part) => part instanceof ContentPartTextParam)
            .map((part) => part.text)
            .join('\n');
    }
    toString() {
        return `UserMessage(content=${this.text})`;
    }
}
export class SystemMessage extends MessageBase {
    role = 'system';
    content;
    name;
    constructor(content, name = null) {
        super();
        this.content = content;
        this.name = name;
    }
    get text() {
        if (typeof this.content === 'string') {
            return this.content;
        }
        return this.content.map((part) => part.text).join('\n');
    }
    toString() {
        return `SystemMessage(content=${this.text})`;
    }
}
export class AssistantMessage extends MessageBase {
    role = 'assistant';
    content;
    tool_calls;
    refusal;
    constructor(init) {
        super();
        this.content = init.content ?? null;
        this.tool_calls = init.tool_calls ?? null;
        this.refusal = init.refusal ?? null;
    }
    get text() {
        if (typeof this.content === 'string') {
            return this.content;
        }
        if (Array.isArray(this.content)) {
            return this.content
                .filter((part) => part instanceof ContentPartTextParam)
                .map((part) => part.text)
                .join('\n');
        }
        return '';
    }
    toString() {
        return `AssistantMessage(content=${this.text})`;
    }
}
