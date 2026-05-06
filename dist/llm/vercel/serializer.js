import { OpenAIMessageSerializer } from '../openai/serializer.js';
export class VercelMessageSerializer {
    serialize(messages) {
        const serializer = new OpenAIMessageSerializer();
        return serializer.serialize(messages);
    }
}
