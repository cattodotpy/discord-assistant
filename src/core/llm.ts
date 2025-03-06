import {
    HumanMessage,
    SystemMessage,
    type AIMessage,
    type AIMessageChunk,
} from "@langchain/core/messages";
import type { Runnable } from "@langchain/core/runnables";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { ChatOpenAI } from "@langchain/openai";
import { Collection, Message } from "discord.js";
import {
    createGetChannelTool,
    createGetGuildTool,
    createGetMessagesTool,
    createGetRoleTool,
    createGetUserTool,
} from "./tools";
import type { DiscordAssistant } from "./client";
import { z } from "zod";

const defaultMessage = new SystemMessage(
    `You are a helpful AI assistant in a Discord server. Your goal is to:

Provide accurate, concise, and useful responses
Maintain a friendly and professional tone
Avoid generating harmful or inappropriate content
Do not hallucinate , 
Do not generate wrong facts out of thin air

You may make use of Discord's formatting to format your messages. For example, you can use **bold text**, *italic text*, __underline text__, and more. You can also use emojis and mention users or roles.
Also, you may use the embed to help you visualize your responses when needed.

`
);

const messageStructure = z.object({
    content: z.string(),
    embeds: z.array(
        z.object({
            title: z.string(),
            description: z.string().optional(),
            url: z.string().optional(),
            color: z.number().optional(),
            fields: z.array(
                z.object({
                    name: z.string(),
                    value: z.string(),
                    inline: z.boolean(),
                })
            ),
        })
    ),
});

interface LLMManagerOptions {
    apiKey: string;
    baseURL: string;
    model: string;
}

interface LLMSession {
    llm: Runnable<any>;
    messages: (HumanMessage | AIMessage)[];
    tools?: Map<string, DynamicStructuredTool>;
}

export class LLMManager {
    private client: ChatOpenAI;
    private bot: DiscordAssistant;
    public sessions: Collection<string, LLMSession>;

    constructor(options: LLMManagerOptions, bot: DiscordAssistant) {
        this.client = new ChatOpenAI({
            apiKey: options.apiKey,
            model: options.model,
            configuration: {
                baseURL: options.baseURL,
            },
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

        // const llm = this.client.bind({
        //     tools,
        //     // response_format: messageStructure
        // });

        const llm = this.client.withStructuredOutput(messageStructure);

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
    ): Promise<z.infer<typeof messageStructure> | undefined> {
        const session = this.sessions.get(sessionId);

        if (!session) {
            throw new Error("Session not found");
        }

        const messages = [new HumanMessage(prompt)];

        // keep invoking the model until we provide all tool call response and it produces a response

        let resp: z.infer<typeof messageStructure> | undefined = undefined;
        let toolCalls = 0;

        while (toolCalls <= 5) {
            const result = await session.llm.invoke(messages);

            messages.push(result);

            if (
                result.content &&
                (!result.tool_calls || result.tool_calls?.length === 0)
            ) {
                resp = result;
                break;
            }

            if (result.tool_calls) {
                for (const tool of result.tool_calls) {
                    const toolName = tool.name;

                    // console.log(`Tool ${JSON.stringify(tool)}`   );

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

        return resp;
    }
}
