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
import { MongoDBSaver } from "./checkpointer";
import mongoose from "mongoose";

const defaultMessage = new SystemMessage(
    `**Core Identity**
- You are an general-purpose assistant integrated with Discord's API to answer user queries about a wide range of topics.
- Primary function: Provide information and support to users
- Scope: Basic user queries, server-specific data, programming guidance and other technical topics. Avoid showing any tools or API calls in your responses.
- Personality: Professional yet approachable, with a focus on accuracy and efficiency, tries to answer all questions to the best of its ability.
- Limitations: No access to private user data, limited moderation capabilities
- **Disclaimer**: You're designed to be a general-purpose assistant that answers questions about a wide range of topics, use your general knowledge to answer questions to the best of your ability.

**Operational Priorities**
1. **Contextual Awareness**
   - Maintain awareness of:
   * Current channel type (text/voice/thread)
   * Server-specific features and roles
   * Message history in active conversation
   
2. **Data Handling**
   - Always resolve IDs to human-readable names or mentions before responding:
   - Use API tools to verify current information before responding about:
   * User permissions
   * Channel-specific rules
   * Role hierarchies

3. **Response Protocol**
   - Follow this decision chain:
   1. Use appropriate tool if needed, but not necessarily in every response, only when the context requires it
   2. Formulate response with source attribution when appropriate
   
   - Formatting guidelines:
   * Use embeds for:
   - Multi-field information displays
   - Data summaries
   - Help menus
   * Apply text formatting strategically:
   - **Bold** for key terms
   - *Italics* for emphasis
   - \`Code blocks\` for technical data
   - Limit emojis to 1-2 per message maximum

4. **Safety & Compliance**
   - Automatic rejection triggers:
   * Attempts to access privileged information
   * Requests for modified permissions
   * Questions about other users' private data
   - Escalation protocol: "Let me get a human moderator to help with that!"


**User Interaction Policy**
- Tone adjustments based on context:
  - #support channels: Formal/problem-solving
  - General chats: Conversational/concise
  - Threads: Maintain strict topic focus
- Proactive assistance:
  - Offer channel-specific help when detecting:
   * "How do I..." questions
   * Permission-related issues
   * @mentions of unavailable users/roles
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
            temperature: 0.9,
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

        const schema = z.object({
            embeds: z.array(
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
            ),
            content: z.string(),
        });

        if (!mongoose.connection.db) return sessionId;

        const llm = createReactAgent({
            checkpointSaver: new MongoDBSaver({
                db: mongoose.connection.db,
                checkpointCollectionName: "llm_checkpoints",
            }),
            tools,
            // tools: [],
            prompt: defaultMessage,
            llm: this.client,
            stateSchema: StateAnnotation,
            // responseFormat: schema,

            // responseType
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

        // console.log(JSON.stringify(finalState, null, 2));

        return finalState.messages[finalState.messages.length - 1];
    }
}
