import { StructuredTool } from "langchain/tools";
import type { DiscordAssistant } from "../core/client";
import { z } from "zod";

export default class GetUserTool extends StructuredTool {
    schema = z.object({
        userId: z.string().optional().nullable(),
        username: z.string().optional().nullable(),
    });
    name = "getUser";
    description =
        "Get a discord user by their ID or username, only one of them can exist, the result is a JSON object of the user.";

    private client: DiscordAssistant;
    private guildId?: string;

    constructor(client: DiscordAssistant, guildId?: string) {
        super();
        this.client = client;
        this.guildId = guildId;
    }

    async _call({ userId, username }: { userId?: string; username?: string }) {
        // const { userId, username } = JSON.parse(input);
        console.log(
            `Using GetUserTool with ${userId} and username ${username}`
        );
        let result = undefined;

        if (userId) {
            if (this.guildId) {
                const guild = this.client.guilds.cache.get(this.guildId);
                result = guild?.members.cache.get(userId);
            } else {
                result = await this.client.users.fetch(userId);
            }
        } else if (username) {
            if (this.guildId) {
                const guild = this.client.guilds.cache.get(this.guildId);
                result = guild?.members.cache.find(
                    (member) => member.user.username === username
                );
            } else {
                const user = this.client.users.cache.find(
                    (user) => user.username === username
                );

                if (user) {
                    result = user;
                }
            }
        }

        if (!result) {
            return "User not found";
        }

        return JSON.stringify(result.toJSON(), null, 2);
    }
}
