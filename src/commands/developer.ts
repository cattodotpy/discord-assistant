import { createCommand } from "../core/command";
import { SlashCommandBuilder } from "discord.js";

export const devCommand = createCommand(
    {
        name: "developer",
        description: "Developer commands.",

        arguments: {
            command: {
                type: "string",
                required: true,
                name: "command",
                description: "Command to run.",
            },
            args: {
                type: "string",
                required: false,
                name: "args",
                description: "Arguments for the command.",
            },
        },
        textCommandOnly: true,

        syntax: ["command", "args"],
    },
    async (ctx, { command, args }) => {
        if (command === "model") {
            if (!args) {
                await ctx.reply("Please provide a model name.");
                return;
            }
            ctx.bot.llm.changeModel(args);
            await ctx.reply(`Model set to ${args}.`);
        }
    }
);
