import { EmbedBuilder, type Message } from "discord.js";
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

    // await request.channel.sendTyping()
    // repeat after 10 seconds

    // const interval = setInterval(async () => {
    //     if (!request.channel.isSendable()) return;
    //     await request.channel.sendTyping();
    // }, 10000);

    const typingFunc = async () => {
        if (!request.channel.isSendable()) return;
        await request.channel.sendTyping();
    };

    const createInterval = () => {
        typingFunc();
        return setInterval(typingFunc, 10000);
    };

    const interval = createInterval();

    const sessionId = await client.llm.createSession(request);
    const responseChunks = (await client.llm
        .generate(message, sessionId)
        .finally(() => {
            clearInterval(interval);
        })) as any;

    if (!responseChunks)
        return await request.reply("I have hallucinated, please try again.");

    // const msgId = await request.reply({
    //     content: responseChunks.content.toString().slice(0, 2000),
    //     // embeds: responseChunks?.embeds?.map((embed) => {
    //     //     return new EmbedBuilder(embed);
    //     // }),
    //     embeds: responseChunks.embeds
    //         ? responseChunks?.embeds?.map((embed: any) => {
    //               return new EmbedBuilder(embed);
    //           })
    //         : [],
    // });
    const messages = [] as { content: string; embeds: any }[];

    // if the content exceeds 2000 characters, split it into multiple messages, and the embeds should be at the last message

    let content = responseChunks.content.toString();
    let currentContent = "";
    const lines = content.split("\n");

    // while (lines.length > 0) {
    //     const lastLine = lines[lines.length - 1];

    //     if (lastLine.length + currentContent.length > 2000) {
    //         messages.push({
    //             content: currentContent,
    //             embeds: [],
    //         });
    //         currentContent = "";
    //     }

    //     currentContent += lastLine + "\n";
    //     lines.pop();
    // }

    for (const line of lines) {
        if (line.length + currentContent.length > 2000) {
            messages.push({
                content: currentContent,
                embeds: [],
            });
            currentContent = "";
        }

        currentContent += line + "\n";
    }

    messages.push({
        content: currentContent,
        embeds: responseChunks.embeds
            ? responseChunks?.embeds?.map((embed: any) => {
                  return new EmbedBuilder(embed);
              })
            : [],
    });

    for (const message of messages) {
        await request.channel.send({
            content: message.content,
            embeds: message.embeds,
        });
    }
}
