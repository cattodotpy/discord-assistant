import { EmbedBuilder } from "@discordjs/builders";
import { ToolMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { Command, type LangGraphRunnableConfig } from "@langchain/langgraph";
import { StructuredTool } from "langchain/tools";
import { z } from "zod";

// export default class addEmbedsTool extends StructuredTool {
//     schema = z.object({
//         embeds: z
//             .array(
//                 z
//                     .object({
//                         title: z.string(),
//                         description: z.string().optional(),
//                         url: z.string().optional(),
//                         color: z.number().optional(),
//                         fields: z.array(
//                             z.object({
//                                 name: z.string(),
//                                 value: z.string(),
//                                 inline: z.boolean(),
//                             })
//                         ),
//                     })
//                     .describe("An embed object.")
//             )
//             .optional()
//             .describe("An array of embed objects to include in the message."),
//     });
//     name = "addEmbeds";
//     description = "Include an array of embed objects in your message.";

//     constructor() {
//         super();
//     }

//     async _call({ embeds }: { embeds?: any }, config: any) {
//         if (!embeds) {
//             return new ToolMessage({
//                 content: "No embeds provided.",
//                 tool_call_id: config.tool_call_id,
//             });
//         }

//         // return { embeds: embeds.map((embed: any) => new EmbedBuilder(embed)) };

//         return new Command({
//             update: {
//                 embeds: embeds.map((embed: any) => new EmbedBuilder(embed)),
//                 messages: [
//                     new ToolMessage({
//                         content: "Successfully added embeds to the message.",
//                         tool_call_id: config.tool_call_id,
//                     }),
//                 ],
//             },
//         });
//     }
// }

export default tool(
    async ({ embeds, content }) => {
        return {
            embeds: embeds.map((embed: any) => new EmbedBuilder(embed)),
            content,
        };
    },
    {
        name: "createResponse",
        description:
            "Reply with a message and/or embeds, reply with this tool only.",
        schema: z.object({
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
                .describe(
                    "An array of embed objects to include in the message."
                )
                .default([]),
            content: z.string().optional().default(""),
        }),
    }
);
