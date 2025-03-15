import { type Argument, type Command } from "@/command";
import type { IContext } from "@/context";
import { SlashCommandBuilder } from "discord.js";

export default class HeyCommand implements Command {
    name = "hey";
    aliases = [];
    description = "Hey, what's up?";
    builder = new SlashCommandBuilder()
        .addStringOption((option) =>
            option
                .setName("question")
                .setDescription("Ask a question.")
                .setRequired(true)
        )
        .setName("hey")
        .setDescription("Greets the bot.");

    arguments = [
        {
            name: "question",
            description: "Ask a question.",
            required: true,

            // transformer: (value: string) => value,
        },
    ];

    async execute(ctx: IContext): Promise<void> {
        const question = ctx.getArgument("question");

        if (!question) {
            await ctx.reply("Hey, what's up?");
            return;
        }

        await ctx.reply(`Hey, ${question}`);
    }
}
