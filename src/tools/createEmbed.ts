import { EmbedBuilder } from "@discordjs/builders";
import { StructuredTool } from "langchain/tools";
import { z } from "zod";

export default class addEmbedsTool extends StructuredTool {
    schema = z.object({
        embeds: z
            .array(
                z
                    .object({
                        title: z.string(),
                        description: z.string().optional(),
                        url: z.string().optional(),
                        color: z.number().optional(),
                        fields: z.array(
                            z.object({
                                name: z.string(),
                                value: z.string(),
                                inline: z.boolean(),
                            })
                        ),
                    })
                    .describe("An embed object.")
            )
            .optional()
            .describe("An array of embed objects to include in the message."),
    });
    name = "addEmbeds";
    description = "Include an array of embed objects in your message.";

    constructor() {
        super();
    }

    async _call({ embeds }: { embeds?: any }) {
        if (!embeds) {
            return "No embeds provided";
        }

        return { embeds: embeds.map((embed: any) => new EmbedBuilder(embed)) };
    }
}
