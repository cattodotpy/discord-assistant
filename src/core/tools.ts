import { tool } from "@langchain/core/tools";
import type { DiscordAssistant } from "./client";
import { z } from "zod";
import type { GuildMember, User } from "discord.js";

const getUserToolSchema = z.object({
    userId: z.string().optional().nullable(),
    username: z.string().optional().nullable(),
});

export function createGetUserTool(client: DiscordAssistant, guildId?: string) {
    return tool(
        async ({ userId, username }) => {
            console.log(`Using GetUserTool with ${userId} and ${guildId}`);
            let result: User | GuildMember | undefined = undefined;

            if (userId) {
                if (guildId) {
                    const guild = client.guilds.cache.get(guildId);
                    result = guild?.members.cache.get(userId);
                } else {
                    result = await client.users.fetch(userId);
                }
            } else if (username) {
                // result = await client.users.fetch(username);
                if (guildId) {
                    const guild = client.guilds.cache.get(guildId);
                    result = guild?.members.cache.find(
                        (member) => member.user.username === username
                    );
                } else {
                    const user = client.users.cache.find(
                        (user) => user.username === username
                    );

                    if (user) {
                        result = user;
                    }
                }
            }

            // return a string

            if (!result) {
                return "User not found";
            }

            return JSON.stringify(result.toJSON(), null, 2);
        },
        {
            name: "getUser",
            description:
                "Get a discord user by their ID or username, only one of them can exist, the result is a JSON object of the user.",
            schema: getUserToolSchema,
        }
    );
}

export function createGetRoleTool(client: DiscordAssistant, guildId: string) {
    return tool(
        async ({ roleId }) => {
            const guild = client.guilds.cache.get(guildId);
            const role = guild?.roles.cache.get(roleId);

            if (!role) {
                return "Role not found";
            }

            return JSON.stringify(role.toJSON(), null, 2);
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
}

export function createGetChannelTool(
    client: DiscordAssistant,
    guildId: string
) {
    return tool(
        async ({ channelId }) => {
            const guild = client.guilds.cache.get(guildId);
            const channel = guild?.channels.cache.get(channelId);

            if (!channel) {
                return "Channel not found";
            }

            return JSON.stringify(channel.toJSON(), null, 2);
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
}

export function createGetGuildTool(client: DiscordAssistant) {
    return tool(
        async ({ guildId }) => {
            const guild = client.guilds.cache.get(guildId);

            if (!guild) {
                return "Guild not found";
            }

            return JSON.stringify(guild.toJSON(), null, 2);
        },
        {
            name: "getGuild",
            description:
                "Get a discord guild by its ID, the result is a JSON object of the guild",
            schema: z.object({
                guildId: z.string(),
            }),
        }
    );
}

export function createGetMessagesTool(
    client: DiscordAssistant,
    channelId: string
) {
    // get messages from a channel, by default it gets the last 10 messages, but you can specify the limit and filter
    return tool(
        async ({ n = 10 }) => {
            const channel = client.channels.cache.get(channelId);

            if (!channel || !channel.isTextBased()) {
                return "Channel not found";
            }

            const messages = await channel.messages.fetch({ limit: n });

            // console.log(messages);

            return JSON.stringify(
                messages.map((message) => message.toJSON()),
                null,
                2
            );
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
}
