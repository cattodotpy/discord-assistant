import { createCommand } from "../core/command";
import { SlashCommandBuilder } from "discord.js";

export const heyCommand = createCommand(
    {
        name: "hey",
        description: "Greets the bot.",
        builder: new SlashCommandBuilder()
            .addStringOption((option) =>
                option
                    .setName("question")
                    .setDescription("Ask a question.")
                    .setRequired(true)
            )
            .setName("hey")
            .setDescription("Greets the bot."),
        arguments: {
            question: {
                type: "string",
                required: true,
                name: "question",
                description: "Ask a question.",
            },
        },
        // textCommandOnly: true,

        syntax: ["question"],
    },
    async (ctx, { question }) => {
        // console.log(question);
        const llm = ctx.bot.llm;

        await ctx.typing();

        const response = await llm.simpleGenerate(question);

        await ctx.reply(response || "I don't know.");
    }
);
