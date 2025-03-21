import {
    CommandInteraction,
    EmbedBuilder,
    ThreadAutoArchiveDuration,
    ThreadChannel,
    type Message,
} from "discord.js";
import type { DiscordAssistant } from "./client";
import axios from "axios";
import User from "../schema/User";
import { autocomplete } from "duck-duck-scrape";

async function getUser(discordId: string) {
    const user = await User.findOne({ discordId });

    if (!user) {
        return await User.create({ discordId });
    }

    return user;
}

export async function handleMessage(
    request: Message,
    client: DiscordAssistant
) {
    if (request.author.bot) return;
    // console.log(client.commands.prefix);
    if (request.content.startsWith(client.commands.prefix)) {
        // console.log("Handling command");
        return await client.commands.handleMessage(request);
    }
    const user = await getUser(request.author.id);
    if (
        !request.content.startsWith(client.user!.toString()) &&
        !(
            request.channel.isThread() &&
            user.threads.includes(request.channel.id)
        )
    )
        return;
    let message = request.content;

    if (message.startsWith(`<@!${client.user!.id}>`)) {
        message = message.slice(`<@!${client.user!.id}>`.length).trim();
    } else if (message.startsWith(`<@${client.user!.id}>`)) {
        message = message.slice(`<@${client.user!.id}>`.length).trim();
    }

    // if (!message) return;

    let thread: ThreadChannel;

    // console.log(request.channel.isThread());

    if (request.channel.isThread()) {
        thread = request.channel;
    } else {
        thread = await request.startThread({
            name: "AI Response",
            autoArchiveDuration: ThreadAutoArchiveDuration.OneHour,
        });

        client.llm.generateTitle(message).then((title) => {
            if (!title) return;
            thread.setName(title);
        });

        user.threads.push(thread.id);
        await user.save();
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

    let messageContent = message;

    if (request.reference && request.reference.messageId) {
        const referencedMessage = await request.channel.messages.fetch(
            request.reference.messageId
        );

        messageContent += `\n\nReferenced message: ${referencedMessage.content}, with ${referencedMessage.attachments.size} attachments`;

        if (referencedMessage.attachments.size > 0) {
            const referenceAttachments = referencedMessage.attachments.map(
                async (attachment) => {
                    const resp = await axios.get(attachment.url, {
                        responseType: "arraybuffer",
                    });

                    const buffer = Buffer.from(resp.data, "binary");
                    return {
                        filename: attachment.name,
                        url: `data:${
                            resp.headers["content-type"]
                        };base64,${buffer.toString("base64")}`,
                    };
                }
            );

            attachments.push(...referenceAttachments);
        }
    }

    const embeds = [] as EmbedBuilder[];

    // console.log("Message content: ", messageContent);
    const responseChunks = (await client.llm
        .generate(
            {
                content: messageContent,
                attachments: await Promise.all(attachments),
            },
            {
                channelId: request.channelId,
                guildId: request.guildId,
                userId: request.author.id,
                addEmbed: (embed: EmbedBuilder) => {
                    embeds.push(embed);
                },
                threadId: thread.id,
                authorId: request.author.id,
            },
            sessionId
        )
        .catch((e) => {
            console.error(e);
            return undefined;
        })
        .finally(() => {
            clearInterval(interval);
        })) as any;

    if (!responseChunks)
        return await request.reply(
            "An error occurred while processing your request."
        );

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
        embeds: embeds,
    });

    for (const message of messages) {
        await thread.send({
            content: message.content,
            embeds: message.embeds,
            allowedMentions: { roles: [], users: [] },
        });
    }
}

export async function handleInteraction(
    interaction: CommandInteraction,
    client: DiscordAssistant
) {
    if (interaction.isChatInputCommand()) {
        return await client.commands.executeCommand(
            interaction.commandName,
            interaction
        );
    }
}
