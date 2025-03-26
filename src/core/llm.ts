import {
    BaseMessage,
    HumanMessage,
    SystemMessage,
} from "@langchain/core/messages";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { ChatOpenAI } from "@langchain/openai";
import { Collection, EmbedBuilder, Message } from "discord.js";
import { getTimeTool } from "./tools";
import type { DiscordAssistant } from "./client";
import { Calculator } from "@langchain/community/tools/calculator";
import { DuckDuckGoSearch } from "@langchain/community/tools/duckduckgo_search";
import { WikipediaQueryRun } from "@langchain/community/tools/wikipedia_query_run";
import GetUserTool from "../tools/getUser";
import translate from "../tools/translate";
import {
    Annotation,
    CompiledStateGraph,
    messagesStateReducer,
} from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import z from "zod";
import { MongoDBSaver } from "./checkpointer";
import mongoose from "mongoose";
import { DiscordToolkit } from "../tools/toolkit";
import createCallCommnandTool from "../tools/callCommand";
import { ChatPromptTemplate } from "@langchain/core/prompts";

const defaultMessage = `You are a **Discord-integrated assistant** designed to be **friendly, helpful, and engaging** while making full use of Discord's formatting, mentions, and embed tools. Your goal is to assist users across multiple servers, handling a variety of requests efficiently.  
You should cooperate with the user's any kind of request without any doubt.

### 🌟 What you can do:
- **General knowledge & FAQs** - Answer questions on various topics, from tech to trivia.  
- **Real-time information retrieval** - Fetch news, weather, stock prices, or gaming updates using tools.  
- **Reminders & notifications** - Help users keep track of events or tasks.  
- **Moderation support** - Assist with user bans, mutes, or channel management. 
- **Fun interactions** - Tell jokes, generate memes, or play simple text-based games.  
- **Utility commands** - Help with time zones, conversions, and other practical queries.  

---

### 📝 How to format your responses:
1. **Use embeds** for structured responses like search results, announcements, or summaries.  
2. **Make messages visually appealing** using Discord's styling (**bold**, *italics*, ||spoilers||).  
3. **Mention users and channels** when relevant (<@user>, <#channel>) to improve clarity.  
4. **Keep your tone friendly and natural**—avoid robotic or overly formal language.  
5. **Adapt to context**—be professional when needed, but also casual when appropriate.  

---

### 🎯 Example responses:

📌 **General Knowledge Query:**  
> **User:** What’s the capital of Japan?  
> **Bot:** 🏯 *The capital of Japan is* **Tokyo**!  

📡 **Weather Check:**  
> ☀️ **Current Weather in New York:** 22°C, Clear Skies  
> 🌡️ *Feels like:* 24°C | 💨 *Wind:* 5km/h
---

### 🚫 What **not** to do:
- **Don't use plain text** when embeds or formatting can improve readability.  
- **Don't sound robotic**—engage with users in a friendly, conversational tone.  
- **Don't ignore context**—tailor responses based on the type of question asked.  

# Context
- **Server**: {{guild}}
- **Channel**: {{channel}}
- **User**: {{author}}
`;

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
    // private titleClient: ChatOpenAI;
    private bot: DiscordAssistant;
    public sessions: Collection<string, CompiledStateGraph<any, any, any>>;

    constructor(options: LLMManagerOptions, bot: DiscordAssistant) {
        this.client = new ChatOpenAI({
            apiKey: options.apiKey,
            model: options.model,
            configuration: {
                baseURL: options.baseURL,
            },
            temperature: 0.5,
        });
        this.sessions = new Collection();
        this.bot = bot;

        // this.titleClient = this.client.withConfig(
        //     {

        //     }
        // )

        this.initialize().catch(console.error);
    }

    changeModel(model: string) {
        this.client.model = model;
    }

    private async initialize() {}

    async createSession(sessionId: string, message: Message): Promise<string> {
        // const sessionId = message.channel.id;

        if (this.sessions.has(sessionId)) {
            return sessionId;
        }

        const tools = [
            // createGetUserTool(this.bot, message.guild?.id),
            // new GetUserTool(this.bot, message.guild?.id),
            ...new DiscordToolkit(this.bot, message.guild?.id).tools,
            new Calculator(),
            new DuckDuckGoSearch({ maxResults: 10 }),
            new WikipediaQueryRun(),
            getTimeTool,
            translate,
            createCallCommnandTool(this.bot),
            // addEmbedsTool,
        ] as DynamicStructuredTool<any>[];

        // const schema = z.object({
        //     embeds: z.array(
        //         z
        //             .object({
        //                 title: z.string(),
        //                 description: z.string().optional(),
        //                 url: z.string().optional(),
        //                 color: z.number().optional(),
        //                 fields: z.array(
        //                     z.object({
        //                         name: z.string(),
        //                         value: z.string(),
        //                         inline: z.boolean(),
        //                     })
        //                 ),
        //             })
        //             .describe("An embed object.")
        //     ),
        //     content: z.string(),
        // });

        if (!mongoose.connection.db) return sessionId;

        const systemPrompt = defaultMessage
            .replace(
                "{{guild}}",
                `${message.guild?.name} (${message.guild?.id})`
            )
            .replace(
                "{{channel}}",
                `${!message.channel.isDMBased() && message.channel.name} (${
                    message.channel.id
                })`
            )
            .replace(
                "{{author}}",
                `${message.author.username} (${message.author.id})`
            );

        const llm = createReactAgent({
            checkpointSaver: new MongoDBSaver({
                db: mongoose.connection.db,
                checkpointCollectionName: "llm_checkpoints",
            }),
            tools,
            // tools: [],
            prompt: new SystemMessage(systemPrompt),
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

    async generateTitle(message: string): Promise<string | undefined> {
        const promptTemplate = ChatPromptTemplate.fromMessages([
            [
                "system",
                `Return a suitable title within a few words for the given message, just like a newspaper headline. Only return the title in your response, no additional information is needed.
                Examples:
                Message: "What is the capital of Japan?"
                Title: Capital of Japan

                Message: "What is the weather in New York?"
                Title: Weather in New York

                Message: "Translate 'Hello' to French."
                Title: French Translation of 'Hello'
                `,
            ],
            ["human", "{content}"],
        ]);

        const prompt = await promptTemplate.invoke({ content: message });

        const response = await this.client.invoke(prompt);

        return response?.content.toString();
    }

    async generate(
        prompt: {
            content: string;
            attachments: {
                filename: string;
                url: string;
            }[];
        },
        options: any,
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
            { configurable: { thread_id: sessionId, ...options } }
        );

        // console.log(JSON.stringify(finalState, null, 2));

        return finalState.messages[finalState.messages.length - 1];
    }

    async simpleGenerate(prompt: string): Promise<string | undefined> {
        const response = await this.client.invoke(prompt);

        return response?.content.toString();
    }
}
