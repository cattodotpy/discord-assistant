import z from "zod";

const schema = z.object({
    embeds: z.array(
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
                        inline: z.boolean().optional(),
                    })
                ),
                image: z
                    .object({
                        url: z.string(),
                    })
                    .optional()
                    .nullable()
                    .describe(
                        "An image object, either null or an object with a url."
                    ),
                thumbnail: z
                    .object({
                        url: z.string(),
                    })
                    .optional()
                    .nullable()
                    .describe(
                        "A thumbnail object, either null or an object with a url."
                    ),
            })
            .describe("An embed object.")
    ),
});

console.log(
    schema.parse({
        embeds: [
            {
                fields: [
                    {
                        name: "User ID",
                        inline: true,
                        value: "1347163795054661702",
                    },
                    {
                        name: "Display Name",
                        inline: true,
                        value: "elon mask",
                    },
                ],
                title: "caatto's User Profile",
                description: "User details:",
                image: "",
                color: 0,
                url: "",
                thumbnail: "https://cdn.discordapp.com/embed/avatars/0.png",
            },
        ],
    })
);
