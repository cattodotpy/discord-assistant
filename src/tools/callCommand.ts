import type { DiscordAssistant } from "@/client";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

export default function createCallCommnandTool(client: DiscordAssistant) {
    return tool(
        async ({ command, args, messageId, channelId }) => {
            const channel = client.channels.cache.get(channelId);
            if (!channel || !channel.isSendable()) {
                return "Channel not found or not sendable";
            }

            const message = await channel.messages.fetch(messageId);
            if (!message) {
                return "Message not found";
            }
            client.commands.handleContent(command, message);

            return "Command executed";
        },

        {
            name: "callCommand",
            // description: "Call a command by its name and message ID.,
            description: `Call a command by its name and the user's message ID.
            Available commands: ${client.commands.commands
                .entries()
                .map(([name, command]) => {
                    return `\`${name}\`: ${command.description}`;
                })
                .toArray()
                .join("\n")}`,
            schema: z.object({
                command: z.string(),
                messageId: z.string(),
                channelId: z.string(),
                args: z.array(z.string()).optional(),
            }),
        }
    );
}
