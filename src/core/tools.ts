import { tool } from "@langchain/core/tools";
import type { DiscordAssistant } from "./client";
import { z } from "zod";

export function createGetRoleTool(client: DiscordAssistant, guildId: string) {
    return tool(
        async ({ roleId }) => {
            const guild = client.guilds.cache.get(guildId);
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
}

export function createGetGuildTool(client: DiscordAssistant) {
    return tool(
        async ({ guildId }) => {
            const guild = client.guilds.cache.get(guildId);

            if (!guild) {
                return "Guild not found";
            }

            return JSON.stringify(guild.toJSON());
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
}

export const getTimeTool = tool(
    async (
        { timeZone }: { timeZone?: string } = { timeZone: "America/Chicago" }
    ) => {
        return new Date().toLocaleDateString("en-US", {
            day: "numeric",
            month: "long",
            year: "numeric",
            hour: "numeric",
            minute: "numeric",
            second: "numeric",
            timeZone: timeZone,
        });
    },
    {
        name: "getTime",
        description:
            "Get the current time in ISO format with timezone, defaults to America/Chicago",
        schema: z.object({
            timeZone: z.string().optional().default("America/Chicago"),
        }),
    }
);
