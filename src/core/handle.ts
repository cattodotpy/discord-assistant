import {
    EmbedBuilder,
    ThreadAutoArchiveDuration,
    ThreadChannel,
    type Message,
} from "discord.js";
import type { DiscordAssistant } from "./client";
import axios from "axios";

let threads = [] as string[];

export async function handleMessage(
    request: Message,
    client: DiscordAssistant
) {
    if (request.author.bot) return;

    if (
        !request.content.startsWith(client.user!.toString()) &&
        !(request.channel.isThread() && threads.includes(request.channelId))
    )
        return;
    let message = request.content;

    if (message.startsWith(`<@!${client.user!.id}>`)) {
        message = message.slice(`<@!${client.user!.id}>`.length).trim();
    } else if (message.startsWith(`<@${client.user!.id}>`)) {
        message = message.slice(`<@${client.user!.id}>`.length).trim();
    }

    if (!message) return;

    let thread: ThreadChannel;

    // console.log(request.channel.isThread());

    if (request.channel.isThread()) {
        thread = request.channel;
        // console.log("thread");
    } else {
        thread = await request.startThread({
            name: "AI Response",
            autoArchiveDuration: ThreadAutoArchiveDuration.OneHour,
        });
        threads.push(thread.id);
    }

    const typingFunc = async () => {
        await thread.sendTyping();
    };

    const createInterval = () => {
        typingFunc();
        return setInterval(typingFunc, 10000);
    };

    const interval = createInterval();

    const sessionId = await client.llm.createSession(thread.id, request);

    const attachments = request.attachments.map(async (attachment) => {
        const resp = await axios.get(attachment.url, {
            responseType: "arraybuffer",
        });

        const buffer = Buffer.from(resp.data, "binary");
        return {
            filename: attachment.name,
            url: `data:${resp.headers["content-type"]};base64,${buffer.toString(
                "base64"
            )}`,
        };
    });
    const responseChunks = (await client.llm
        .generate(
            {
                content: message,
                attachments: await Promise.all(attachments),
            },
            sessionId
        )
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
        await thread.send({
            content: message.content,
            embeds: message.embeds,
            allowedMentions: { roles: [], users: [] },
        });
    }
}
