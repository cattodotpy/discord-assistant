import {
    BaseMessage,
    HumanMessage,
    SystemMessage,
} from "@langchain/core/messages";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { ChatOpenAI } from "@langchain/openai";
import { Collection, EmbedBuilder, Message } from "discord.js";
import {
    createGetChannelTool,
    createGetGuildTool,
    createGetMessagesTool,
    createGetRoleTool,
} from "./tools";
import type { DiscordAssistant } from "./client";
import { Calculator } from "@langchain/community/tools/calculator";
import { DuckDuckGoSearch } from "@langchain/community/tools/duckduckgo_search";
import { WikipediaQueryRun } from "@langchain/community/tools/wikipedia_query_run";
import GetUserTool from "../tools/getUser";
import {
    Annotation,
    CompiledStateGraph,
    MemorySaver,
    messagesStateReducer,
} from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import z from "zod";

const defaultMessage = new SystemMessage(
    `
I'm Discord Assistant, a general-purpose helper for a wide range of topics.  
Purpose: Provide accurate, efficient answers and support.  
Scope: Handle basic queries, server-specific info, programming, and technical topics—no tools or API calls shown in responses.  
Personality: Professional yet approachable.  
Limits: No private user data access or advanced moderation powers.  
Note: I use general knowledge to answer to the best of my ability. I'm able to answer questions based on user provided images, documents, or text.
`
);

interface LLMManagerOptions {
    apiKey: string;
    baseURL: string;
    model: string;
}

const StateAnnotation = Annotation.Root({
    messages: Annotation<BaseMessage[]>({
        reducer: messagesStateReducer,
        default: () => [],
    }),
});

export class LLMManager {
    private client: ChatOpenAI;
    private bot: DiscordAssistant;
    public sessions: Collection<string, CompiledStateGraph<any, any, any>>;

    constructor(options: LLMManagerOptions, bot: DiscordAssistant) {
        this.client = new ChatOpenAI({
            apiKey: options.apiKey,
            model: options.model,
            configuration: {
                baseURL: options.baseURL,
            },
            temperature: 0.7,
        });
        this.sessions = new Collection();
        this.bot = bot;

        this.initialize().catch(console.error);
    }

    private async initialize() {}

    async createSession(sessionId: string, message: Message): Promise<string> {
        // const sessionId = message.channel.id;

        if (this.sessions.has(sessionId)) {
            return sessionId;
        }

        const tools = [
            // createGetUserTool(this.bot, message.guild?.id),
            new GetUserTool(this.bot, message.guild?.id),
            createGetGuildTool(this.bot),
            createGetMessagesTool(this.bot, message.channel.id),
            new Calculator(),
            new DuckDuckGoSearch({ maxResults: 10 }),
            new WikipediaQueryRun(),
            // addEmbedsTool,
        ] as DynamicStructuredTool<any>[];

        if (message.guild) {
            tools.push(createGetChannelTool(this.bot, message.guild.id));
            tools.push(createGetRoleTool(this.bot, message.guild.id));
        }

        const llm = createReactAgent({
            checkpointSaver: new MemorySaver(),
            tools,
            prompt: defaultMessage,
            llm: this.client,
            stateSchema: StateAnnotation,
            responseFormat: {
                schema: z.object({
                    embeds: z
                        .array(
                            z
                                .object({
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
                                .describe("An embed object.")
                        )
                        .optional()
                        .describe(
                            "An array of embed objects to include in the message."
                        )
                        .default([]),
                    content: z.string().optional().default(""),
                }),
                prompt: "You're able to respond to the user using text and/or embeds. However, '```' is not allowed in your response, instead use '\\' to separate code blocks, for example '\\`\\`\\`python'.",
            },
        });
        // const llm = this.client;

        // const llm = this.client.withStructuredOutput(messageStructure);

        this.sessions.set(sessionId, llm);

        // const graph = await llm.getGraphAsync();
        // const image = await graph.drawMermaidPng();

        // //save the image to the disk
        // Bun.write(`./graph_images/${sessionId}.png`, await image.arrayBuffer());

        return sessionId;
    }

    async generate(
        prompt: {
            content: string;
            attachments: {
                filename: string;
                url: string;
            }[];
        },
        sessionId: string
    ): Promise<
        | {
              content?: string;
              embeds: EmbedBuilder[];
          }
        | undefined
    > {
        // ): Promise<AIMessageChunk | undefined> {
        const session = this.sessions.get(sessionId);

        if (!session) {
            throw new Error("Session not found");
        }

        const isImage = (filename: string) =>
            filename.endsWith(".png") || filename.endsWith(".jpg");

        const files = prompt.attachments.map((attachment) => {
            if (isImage(attachment.filename)) {
                return {
                    type: "image_url",
                    image_url: {
                        url: attachment.url,
                    },
                };
            }

            return {
                type: "file",
                file: {
                    url: attachment.url,
                    filename: attachment.filename,
                },
            };
        });

        console.log(`${files.length} files found`);

        const messages = [
            new HumanMessage({
                content: [
                    {
                        type: "text",
                        text: prompt.content,
                    },
                    ...files,
                ],
            }),
        ];

        // keep invoking the model until we provide all tool call response and it produces a response

        // let resp: z.infer<typeof messageStructure> | undefined = undefined;

        const finalState = await session.invoke(
            { messages },
            { configurable: { thread_id: sessionId } }
        );

        const resp = finalState.messages[finalState.messages.length - 1];
        // console.log("Final state", finalState);
        return resp.structuredResponse || resp;
    }
}
