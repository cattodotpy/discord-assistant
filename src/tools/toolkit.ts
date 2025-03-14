import type { DiscordAssistant } from "@/client";
import {
    BaseToolkit,
    tool,
    type StructuredToolInterface,
} from "@langchain/core/tools";
import GetUserTool from "./getUser";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { z } from "zod";
import { EmbedBuilder } from "discord.js";

export class DiscordToolkit extends BaseToolkit {
    private client: DiscordAssistant;
    tools: StructuredToolInterface[];

    constructor(client: DiscordAssistant, guildId?: string) {
        super();
        this.client = client;
        this.tools = [
            new GetUserTool(client, guildId),
            this.getMessages,
            this.getChannel,
            this.getRole,
            this.includeEmbeds,
        ];
    }

    getMessages = tool(
        async ({ n = 10 }, config: LangGraphRunnableConfig) => {
            const channelId = config.configurable?.channelId;
            const channel = this.client.channels.cache.get(channelId);

            if (!channel || !channel.isTextBased()) {
                return "Channel not found";
            }

            const messages = await channel.messages.fetch({ limit: n });

            // console.log(messages);

            // config.configurable?.addEmbed(new EmbedBuilder().setTitle("test"));

            return JSON.stringify(messages.map((message) => message.toJSON()));
        },
        {
            name: "getMessages",
            description:
                "Get N messages, defaults to 10, from the current channel, the result is a JSON object of the messages",
            schema: z.object({
                n: z.number().optional().default(10),
            }),
        }
    );

    getChannel = tool(
        async ({ channelId }, config: LangGraphRunnableConfig) => {
            const guildId = config.configurable?.guildId;
            const guild = this.client.guilds.cache.get(guildId);
            const channel = guild?.channels.cache.get(channelId);

            if (!channel) {
                return "Channel not found";
            }

            return JSON.stringify(channel.toJSON());
        },
        {
            name: "getChannel",
            description:
                "Get a discord channel by its ID, the result is a JSON object of the channel",
            schema: z.object({
                channelId: z.string(),
            }),
        }
    );

    getRole = tool(
        async ({ roleId }, config: LangGraphRunnableConfig) => {
            const guildId = config.configurable?.guildId;
            const guild = this.client.guilds.cache.get(guildId);
            const role = guild?.roles.cache.get(roleId);

            if (!role) {
                return "Role not found";
            }

            return JSON.stringify(role.toJSON());
        },
        {
            name: "getRole",
            description:
                "Get a discord role by its ID, the result is a JSON object of the role",
            schema: z.object({
                roleId: z.string(),
            }),
        }
    );

    includeEmbeds = tool(
        async ({ embeds }, config: LangGraphRunnableConfig) => {
            // config.configurable?.addEmbeds(embeds);
            embeds.forEach((embed) => {
                config.configurable?.addEmbed(new EmbedBuilder(embed as any));
            });
            return "Embeds added";
        },
        {
            name: "addEmbeds",
            description: "Add discord embeds in the response",
            schema: z.object({
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
                                    inline: z.boolean().optional(),
                                })
                            ),
                            image: z
                                .object({
                                    url: z.string(),
                                })
                                .optional()
                                .nullable()
                                .describe(
                                    "An image object, either null or an object with a url."
                                ),
                            thumbnail: z
                                .object({
                                    url: z.string(),
                                })
                                .optional()
                                .nullable()
                                .describe(
                                    "A thumbnail object, either null or an object with a url."
                                ),
                        })
                        .describe("An embed object.")
                ),
            }),
        }
    );
}
``;
