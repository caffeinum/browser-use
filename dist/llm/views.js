export class ChatInvokeCompletion {
    completion;
    usage;
    thinking;
    redacted_thinking;
    stop_reason;
    constructor(completion, usage = null, thinking = null, redacted_thinking = null, stop_reason = null) {
        this.completion = completion;
        this.usage = usage;
        this.thinking = thinking;
        this.redacted_thinking = redacted_thinking;
        this.stop_reason = stop_reason;
    }
}
