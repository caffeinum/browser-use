export type SupportedImageMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
export declare class ContentPartTextParam {
    text: string;
    readonly type: "text";
    constructor(text: string);
    toString(): string;
}
export declare class ContentPartRefusalParam {
    refusal: string;
    readonly type: "refusal";
    constructor(refusal: string);
    toString(): string;
}
export declare class ImageURL {
    url: string;
    detail: 'auto' | 'low' | 'high';
    media_type: SupportedImageMediaType;
    constructor(url: string, detail?: 'auto' | 'low' | 'high', media?: SupportedImageMediaType);
    toString(): string;
}
export declare class ContentPartImageParam {
    image_url: ImageURL;
    readonly type: "image_url";
    constructor(image_url: ImageURL);
    toString(): string;
}
export declare class FunctionCall {
    name: string;
    arguments: string;
    constructor(name: string, args: string);
    toString(): string;
}
export declare class ToolCall {
    id: string;
    functionCall: FunctionCall;
    readonly type: "function";
    constructor(id: string, functionCall: FunctionCall);
    toString(): string;
}
type ContentPart = ContentPartTextParam | ContentPartImageParam | ContentPartRefusalParam;
export type MessageRole = 'user' | 'system' | 'assistant';
export declare abstract class MessageBase {
    cache: boolean;
    abstract role: MessageRole;
    constructor(init?: Partial<MessageBase>);
}
export declare class UserMessage extends MessageBase {
    role: MessageRole;
    content: string | ContentPart[];
    name: string | null;
    constructor(content: string | ContentPart[], name?: string | null);
    get text(): string;
    toString(): string;
}
export declare class SystemMessage extends MessageBase {
    role: MessageRole;
    content: string | ContentPartTextParam[];
    name: string | null;
    constructor(content: string | ContentPartTextParam[], name?: string | null);
    get text(): string;
    toString(): string;
}
export declare class AssistantMessage extends MessageBase {
    role: MessageRole;
    content: string | ContentPart[] | null;
    tool_calls: ToolCall[] | null;
    refusal: string | null;
    constructor(init: {
        content?: string | ContentPart[] | null;
        tool_calls?: ToolCall[] | null;
        refusal?: string | null;
    });
    get text(): string;
    toString(): string;
}
export type Message = UserMessage | SystemMessage | AssistantMessage;
export {};
