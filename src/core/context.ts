import { DiscordAssistant } from "./client";
import {
    CommandInteraction,
    Guild,
    GuildMember,
    Message,
    MessagePayload,
    User,
    type GuildTextBasedChannel,
    type InteractionEditReplyOptions,
    type InteractionReplyOptions,
    type TextBasedChannel,
} from "discord.js";
// import type { Command } from "./builders";
import type { Command } from "./command";

type PrefixSendMessage = string | MessagePayload;
type InteractionSendMessage = string | MessagePayload | InteractionReplyOptions;
type PrefixReply = string | MessagePayload;
type InteractionReply = string | MessagePayload | InteractionReplyOptions;

export interface ContextOption {
    message?: Message;
    guild?: Guild | null;
    author: User | GuildMember;
    channel: TextBasedChannel | null;
    bot: DiscordAssistant;
    interaction?: CommandInteraction;
    command: Command;
}

export interface IContext {
    message?: Message;
    guild?: Guild | null;
    author: User | GuildMember;
    channel: TextBasedChannel | null;
    bot: DiscordAssistant;
    interaction?: CommandInteraction;
    command: Command;

    reply(content: PrefixReply): Promise<Message>;
    reply(content: InteractionReply): Promise<Message>;
    send(content: PrefixSendMessage): Promise<Message>;
    send(content: InteractionSendMessage): Promise<Message>;
    typing(): Promise<void>;
    typing(isEphemeral: boolean): Promise<void>;

    getArgument(name: string): string | null;
    getArgument<T>(name: string): T | null;
    getArgument<T>(name: string, def: T): T;
}

export class MessageContext<T extends DiscordAssistant> implements IContext {
    message: Message<boolean>;
    bot: T;
    author: User | GuildMember;
    command: Command;
    channel: TextBasedChannel;
    guild: Guild | null;
    arguments: Record<string, any> = {};

    constructor(ctx: ContextOption) {
        this.message = ctx.message!;
        this.bot = ctx.bot as T;
        this.author = this.message.author;
        this.command = ctx.command!;
        this.channel = this.message.channel;
        this.guild = this.message.guild;

        this.getAllArguments();
    }

    private getAllArguments() {
        const content = this.message.content;
        const args = content.split(" ").slice(1);
        const commandSyntax = this.command.syntax || [];

        // console.log(args);

        for (let i = 0; i < commandSyntax.length; i++) {
            // this.arguments[commandSyntax[i]] = args[i];
            const value = args[i];
            // console.log(value);
            const arg = this.command?.arguments
                ? this.command.arguments[commandSyntax[i]]
                : undefined;

            // console.log(arg);

            if (!arg) {
                continue;
            }

            if (!value) {
                this.arguments[commandSyntax[i]] = null;
            } else if (arg.transformer) {
                this.arguments[commandSyntax[i]] = arg.transformer(value);
            } else {
                this.arguments[commandSyntax[i]] = value;
            }
        }
    }

    getArgument(name: string): string | null;
    getArgument<T>(name: string): T | null;
    getArgument<T>(name: string, def: T): T;
    getArgument<T>(name: string, def?: T): T | null {
        const value = this.arguments[name];

        if (!value) {
            return def || null;
        }

        return value as T;
    }

    static fromMessage<T extends DiscordAssistant>(
        message: Message,
        bot: T,
        command: Command
    ): MessageContext<T> {
        const author = message.member ? message.member : message.author;
        const context = {
            message,
            bot,
            author,
            command,
            channel: message.channel,
            guild: message.guild,
        };

        return new MessageContext(context);
    }

    public async send(content: PrefixSendMessage): Promise<Message> {
        if (!this.channel.isSendable()) {
            throw new Error("Channel is not a sendable channel.");
        }

        return this.channel.send(content);
    }

    public async reply(content: PrefixReply): Promise<Message> {
        return this.message.reply(content);
    }

    // public async sendHelp() {
    //     if (this.command.arguments.length > 0) {
    //         // TODO: Send help with arguments.
    //     }
    // }

    public async typing() {
        const channel = this.channel as GuildTextBasedChannel;
        await channel.sendTyping();
    }
}

export class InteractionContext<T extends DiscordAssistant>
    implements IContext
{
    interaction: CommandInteraction;
    bot: DiscordAssistant;
    author: User | GuildMember;
    channel: TextBasedChannel | null;
    guild: Guild | null;
    command: Command;

    constructor(ctx: ContextOption) {
        this.interaction = ctx.interaction!;
        this.bot = ctx.bot as T;
        this.author = this.interaction.user;
        this.channel = this.interaction.channel;
        this.command = ctx.command;
        this.guild = this.interaction.guild;
    }

    static fromInteraction<T extends DiscordAssistant>(
        interaction: CommandInteraction,
        bot: T,
        command: Command
    ): InteractionContext<T> {
        const author = interaction.member
            ? interaction.member
            : interaction.user;
        const context = {
            interaction,
            bot,
            author,
            command,
            channel: interaction.channel,
            guild: interaction.guild,
        };

        return new InteractionContext(context as ContextOption);
    }

    public async reply(content: InteractionReply): Promise<Message> {
        if (this.interaction.deferred) {
            return await this.interaction.editReply(
                content as InteractionEditReplyOptions
            );
        } else {
            await this.interaction.deferReply();
            return await this.interaction.followUp(content);
        }
    }

    public async send(content: InteractionSendMessage): Promise<Message> {
        if (this.interaction.deferred) {
            return await this.interaction.followUp(content);
        }

        await this.interaction.deferReply();
        return await this.interaction.editReply(
            content as InteractionEditReplyOptions
        );
    }

    public async typing() {
        if (this.interaction.deferred) {
            throw new Error("Interaction already responded.");
        }

        await this.interaction.deferReply();
    }

    getArgument(name: string): string | null;
    getArgument<T>(name: string): T | null;
    getArgument<T>(name: string, def: T): T;
    getArgument<T>(name: string, def?: T): T | null {
        const options = this.interaction.options;
        const arg = options.get(name);

        if (!arg) {
            return def || null;
        }

        if (arg.value) {
            return arg.value as T;
        }

        return def || null;
    }
}
