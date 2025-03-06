import { Embed, EmbedBuilder, type Message } from "discord.js";
import type { DiscordAssistant } from "./client";

let myMessages = [] as string[];

export async function handleMessage(
    request: Message,
    client: DiscordAssistant
) {
    // check if the message author is a bot
    if (request.author.bot) return;
    if (
        !request.content.startsWith(client.user?.toString()!) ||
        (request.reference?.messageId &&
            !myMessages.includes(request.reference?.messageId))
    )
        return;
    if (!request.channel.isSendable()) return;

    const message = request.content
        .slice(client.user!.toString().length)
        .trim();

    if (!message) return;

    await request.channel.sendTyping();

    const sessionId = await client.llm.createSession(request);
    const responseChunks = await client.llm.generate(message, sessionId);

    if (!responseChunks)
        return await request.reply("I have hallucinated, please try again.");

    const msgId = await request.reply({
        content: responseChunks.content.toString().slice(0, 2000),
        embeds: responseChunks.embeds.map((embed) => {
            return new EmbedBuilder(embed);
        }),
    });

    myMessages.push(msgId.id);
}
