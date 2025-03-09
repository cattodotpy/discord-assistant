import { type Command } from "@/command";
import type { IContext } from "@/context";

export default class PingCommand implements Command {
    name = "ping";
    aliases = ["p"];

    description = "Ping the bot";

    async execute(context: IContext): Promise<void> {
        await context.reply("Pong!");
    }
}
