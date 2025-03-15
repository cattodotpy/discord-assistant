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

    async execute(ctx: IContext): Promise<any> {
        const question = ctx.getArgument("question");

        if (!question) {
            return await ctx.reply("Please provide a question.");
        }

        const llm = ctx.bot.llm;

        await ctx.typing();

        const response = await llm.simpleGenerate(question);

        await ctx.reply(response || "I don't know.");
    }
}
