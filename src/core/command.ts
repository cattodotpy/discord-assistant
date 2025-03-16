import type {
    CommandInteraction,
    Message,
    SlashCommandOptionsOnlyBuilder,
} from "discord.js";
import { SlashCommandBuilder } from "discord.js";
import type { DiscordAssistant } from "./client";
import { type IContext, InteractionContext, MessageContext } from "./context";

// export class Command {
//     name: string;
//     aliases: string[];
//     description: string;

//     constructor(name: string, aliases: string[], description: string) {
//         this.name = name;
//         this.aliases = aliases;
//         this.description = description;
//     }

//     async execute(context: IContext): Promise<void> {
//         throw new Error("Method not implemented.");
//     }
// }

// export class MessageCommand extends Command {
//     async execute(context: MessageContext<DiscordAssistant>): Promise<void> {
//         throw new Error("Method not implemented.");
//     }
// }

// export class InteractionCommand extends Command {
//     async execute(
//         context: InteractionContext<DiscordAssistant>
//     ): Promise<void> {
//         throw new Error("Method not implemented.");
//     }
// }

export interface Argument<T = any> {
    name: string;
    description: string;

    required?: boolean;
    choices?: Record<string, string>;
    type: "string" | "number" | "boolean" | "object";

    transformer?: (value: string) => T;
}

type InferType<T extends Argument> = T["type"] extends "string"
    ? string
    : T["type"] extends "number"
    ? number
    : T["type"] extends "boolean"
    ? boolean
    : T["type"] extends "object"
    ? object
    : never;

type InferSchemaType<T extends Record<string, Argument>> = {
    [K in keyof T]: InferType<T[K]>;
};

export interface Command {
    name: string;
    aliases?: string[];
    description?: string;
    builder?: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder;
    arguments?: Record<string, Argument>;
    syntax?: string[];

    slashCommandOnly?: boolean;
    textCommandOnly?: boolean;

    execute<T extends IContext>(context: T): Promise<void>;
}

// interface CommandOptions {
//     name: string;
//     aliases?: string[];
//     description: string;
//     builder?: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder;
//     // arguments: Argument[];
//     // arguments: Record<string, Argument>;
// }

interface BaseCommandOptions {
    name: string;
    aliases?: string[];
    description?: string;
    slashCommandOnly?: boolean;
    textCommandOnly?: boolean;
}

interface SlashCommandOptions extends BaseCommandOptions {
    slashCommandOnly: true;
    textCommandOnly?: false;
    builder: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder;
    syntax?: never;
}

interface TextCommandOptions extends BaseCommandOptions {
    textCommandOnly: true;
    slashCommandOnly?: false;
    builder?: never;
}

interface HybridCommandOptions extends BaseCommandOptions {
    slashCommandOnly?: false;
    textCommandOnly?: false;
    builder: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder;
}
// interface SyntaxCommandOptions extends BaseCommandOptions
//     syntax: string[]
//
type CommandOptions =
    | SlashCommandOptions
    | TextCommandOptions
    | HybridCommandOptions;

export function createCommand<TSchema extends Record<string, Argument>>(
    options: CommandOptions & { arguments: TSchema } & {
        syntax?: (keyof TSchema)[];
    },
    func: (context: IContext, args: InferSchemaType<TSchema>) => Promise<any>
): Command {
    // console.log(options);
    return {
        ...options,
        syntax: options.syntax as string[],
        execute: async (context) => {
            const args = {} as any;

            for (const [name, argument] of Object.entries(options.arguments)) {
                const value = context.getArgument(name);
                args[name] = argument.transformer
                    ? argument.transformer(value || "")
                    : value;
            }

            await func(context, args);
        },
    };
}

// export interface MessageCommand extends Command {
//     execute(context: MessageContext<DiscordAssistant>): Promise<void>;
// }

// export interface InteractionCommand extends Command {
//     execute(context: InteractionContext<DiscordAssistant>): Promise<void>;
// }

export class CommandManager {
    public prefix: string;
    public commands: Map<string, Command>;
    public aliases: Map<string, string>;
    private bot: DiscordAssistant;

    constructor(prefix: string, bot: DiscordAssistant) {
        this.prefix = prefix;
        this.bot = bot;

        this.commands = new Map();
        this.aliases = new Map();
    }

    public async register(command: Command) {
        // console.log(command);
        if (command.builder) {
            await this.bot.application!.commands.create(command.builder);
            console.log(`Command ${command.name} registered`);
        }

        this.commands.set(command.name, command);

        this.aliases.set(command.name, command.name);

        for (const alias of command.aliases || []) {
            this.aliases.set(alias, command.name);
        }
    }

    public getCommand(name: string) {
        return this.commands.get(this.aliases.get(name) || name);
    }

    public async executeCommand(
        name: string,
        interaction?: CommandInteraction,
        message?: Message
    ): Promise<void> {
        const command = this.getCommand(name);

        if (!command) {
            return;
        }

        if (interaction) {
            command.execute(
                InteractionContext.fromInteraction(
                    interaction,
                    this.bot,
                    command
                )
            );
        } else if (message) {
            command.execute(
                MessageContext.fromMessage(message, this.bot, command)
            );
        }
    }

    public async handleMessage(message: Message) {
        if (!message.content.startsWith(this.prefix)) {
            return;
        }

        await this.handleContent(message.content, message);
    }
    public async handleContent(content: string, message: Message) {
        const commandName = content.slice(this.prefix.length).split(" ")[0];

        return await this.executeCommand(commandName, undefined, message);
    }
}
