import {
    HumanMessage,
    SystemMessage,
    type AIMessage,
    type AIMessageChunk,
} from "@langchain/core/messages";
import type { Runnable } from "@langchain/core/runnables";
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
import { z } from "zod";
import { Calculator } from "@langchain/community/tools/calculator";
import { DuckDuckGoSearch } from "@langchain/community/tools/duckduckgo_search";
import { WikipediaQueryRun } from "@langchain/community/tools/wikipedia_query_run";
import GetUserTool from "../tools/getUser";
import addEmbedsTool from "../tools/createEmbed";

const defaultMessage = new SystemMessage(
    `
**Core Identity**
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

const messageStructure = z.object({
    content: z.string().describe("The content of the Discord message."),
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
        .describe("An array of embed objects to include in the message."),
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
            temperature: 0.2,
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
            // createGetUserTool(this.bot, message.guild?.id),
            new GetUserTool(this.bot, message.guild?.id),
            createGetGuildTool(this.bot),
            createGetMessagesTool(this.bot, message.channel.id),
            new Calculator(),
            new DuckDuckGoSearch({ maxResults: 10 }),
            new WikipediaQueryRun(),
            new addEmbedsTool(),
        ] as DynamicStructuredTool<any>[];

        if (message.guild) {
            tools.push(createGetChannelTool(this.bot, message.guild.id));
            tools.push(createGetRoleTool(this.bot, message.guild.id));
        }

        // const llm = this.client.bind({
        //     tools,
        //     // response_format: messageStructure
        // });

        // const llm = this.client.bindTools(tools);
        const llm = this.client.bindTools(tools);
        // const llm = this.client;

        // const llm = this.client.withStructuredOutput(messageStructure);

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

        const messages = [new HumanMessage(prompt)];

        // keep invoking the model until we provide all tool call response and it produces a response

        // let resp: z.infer<typeof messageStructure> | undefined = undefined;

        let resp:
            | AIMessageChunk
            | z.infer<typeof messageStructure>
            | undefined = undefined;
        let toolCalls = 0;
        const embeds = [] as EmbedBuilder[];

        while (true) {
            // console.log("invoking model");

            const result = await session.llm.invoke(messages);

            // console.log(result);

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

                    if (session.tools?.has(toolName)) {
                        const toolInstance = session.tools.get(toolName);

                        if (toolInstance) {
                            console.log(`Invoking tool ${toolName}`);
                            const toolResponse = await toolInstance.invoke(
                                tool
                            );

                            // console.log(toolResponse);

                            // if (toolResponse.embeds) {
                            //     console.log("adding embeds");
                            //     embeds.push(...toolResponse.embeds);
                            // }

                            // messages.push(
                            //     toolResponse.response
                            //         ? toolResponse.response
                            //         : toolResponse
                            // );

                            if (toolName === "addEmbeds") {
                                const embedsData = JSON.parse(
                                    toolResponse.content
                                );
                                embeds.push(
                                    ...embedsData.embeds.map(
                                        (embed: any) => new EmbedBuilder(embed)
                                    )
                                );
                            }

                            messages.push(toolResponse);
                        }
                    }
                }
            }

            toolCalls++;
        }

        console.log(`done after ${toolCalls} tool calls`);

        return {
            content: resp?.content.toString(),
            embeds,
        };
    }
}
