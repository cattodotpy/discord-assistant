import type { CommandInteraction, Message } from "discord.js";
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

export interface Command {
    name: string;
    aliases: string[];
    description: string;

    execute<T extends IContext>(context: T): Promise<void>;
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

    public register(command: Command) {
        this.commands.set(command.name, command);

        this.aliases.set(command.name, command.name);

        for (const alias of command.aliases) {
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
        const [commandName, ...args] = content
            .slice(this.prefix.length)
            .trim()
            .split(/ +/);

        return await this.executeCommand(commandName, undefined, message);
    }
}
