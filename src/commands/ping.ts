import { type Argument, type Command } from "@/command";
import type { IContext } from "@/context";
import { SlashCommandBuilder } from "discord.js";

export default class PingCommand implements Command {
    name = "ping";
    aliases = [];
    description = "Returns latency and API ping.";
    arguments = [];

    builder = new SlashCommandBuilder()
        .setName("ping")
        .setDescription("Returns latency and API ping.");

    async execute(ctx: IContext): Promise<void> {
        const latency =
            Date.now() -
            ((ctx.message || ctx.interaction)?.createdTimestamp as number);
        const websocketPing = ctx.bot.ws.ping;
        const memoryUsage = (
            process.memoryUsage().heapUsed /
            1024 /
            1024
        ).toFixed(2);
        const cpuUsage = (process.cpuUsage().user / 1000).toFixed(2);

        await ctx.reply({
            content: `🏓 Pong!\n\n**Latency**: ${latency}ms\n**Websocket Ping**: ${websocketPing}ms\n**Memory Usage**: ${memoryUsage}MB\n**CPU Usage**: ${cpuUsage}%`,
        });
    }
}
