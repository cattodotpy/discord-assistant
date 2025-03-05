import type { BaseLanguageModelInput } from "@langchain/core/language_models/base";
import {
    HumanMessage,
    SystemMessage,
    type AIMessage,
    type AIMessageChunk,
} from "@langchain/core/messages";
import type { Runnable } from "@langchain/core/runnables";
import { DynamicStructuredTool } from "@langchain/core/tools";
import {
    ChatDeepSeek,
    type ChatDeepSeekCallOptions,
} from "@langchain/deepseek";
import { Collection, Message } from "discord.js";
import {
    createGetChannelTool,
    createGetGuildTool,
    createGetMessagesTool,
    createGetRoleTool,
    createGetUserTool,
} from "./tools";
import type { DiscordAssistant } from "./client";

const defaultMessage = new SystemMessage(
    `You are a helpful AI assistant in a Discord server. Your goal is to:

Provide accurate, concise, and useful responses
Respect the server's rules and community guidelines
Maintain a friendly and professional tone
Avoid generating harmful or inappropriate content
Do not hallucinate , 
Do not generate wrong facts out of thin air

You may make use of Discord's formatting to format your messages. For example, you can use **bold text**, *italic text*, __underline text__, and more. You can also use emojis and mention users or roles.
`
);

interface LLMManagerOptions {
    apiKey?: string;
    reasoning: boolean;
}

interface LLMSession {
    llm: Runnable<
        BaseLanguageModelInput,
        AIMessageChunk,
        ChatDeepSeekCallOptions
    >;
    messages: (HumanMessage | AIMessage)[];
    tools?: Map<string, DynamicStructuredTool>;
}

export class LLMManager {
    private apiKey?: string;
    private client: ChatDeepSeek;
    private bot: DiscordAssistant;
    public sessions: Collection<string, LLMSession>;

    constructor(options: LLMManagerOptions, bot: DiscordAssistant) {
        this.apiKey = options.apiKey;
        this.client = new ChatDeepSeek({
            apiKey: this.apiKey,
            model: options.reasoning ? "deepseek-reasoner" : "deepseek-chat",
        });
        this.sessions = new Collection();
        this.bot = bot;

        this.initialize().catch(console.error);
    }

    private async initialize() {}

    async createSession(message: Message): Promise<string> {
        const sessionId = `${message.author.id}-${message.channel.id}`;

        if (this.sessions.has(sessionId)) {
            return sessionId;
        }

        const tools = [
            createGetUserTool(this.bot, message.guild?.id),
            createGetGuildTool(this.bot),
            createGetMessagesTool(this.bot, message.channel.id),
        ] as DynamicStructuredTool<any>[];

        if (message.guild) {
            tools.push(createGetChannelTool(this.bot, message.guild.id));
            tools.push(createGetRoleTool(this.bot, message.guild.id));
        }

        const llm = this.client.bindTools(tools);

        this.sessions.set(sessionId, {
            llm,
            messages: [defaultMessage],
            tools: new Map(tools.map((tool) => [tool.name, tool])),
        });

        return sessionId;
    }

    async generate(
        prompt: string,
        sessionId: string
    ): Promise<AIMessageChunk | undefined> {
        const session = this.sessions.get(sessionId);

        if (!session) {
            throw new Error("Session not found");
        }

        const messages = [...session.messages, new HumanMessage(prompt)];

        // keep invoking the model until we provide all tool call response and it produces a response

        let resp: AIMessageChunk | undefined = undefined;
        let toolCalls = 0;

        while (toolCalls <= 5) {
            const result = await session.llm.invoke(messages);

            messages.push(result);

            if (result.content) {
                resp = result;
                break;
            }

            if (result.tool_calls) {
                for (const tool of result.tool_calls) {
                    const toolName = tool.name;

                    if (session.tools?.has(toolName)) {
                        const toolInstance = session.tools.get(toolName);

                        if (toolInstance) {
                            console.log(`Invoking tool ${toolName}`);
                            const toolResponse = await toolInstance.invoke(
                                tool
                            );

                            messages.push(toolResponse);
                        }
                    }
                }
            }

            toolCalls++;
        }

        session.messages = messages;

        return resp;
    }
}
