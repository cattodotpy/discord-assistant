import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const getTimeTool = tool(
    async (
        { timeZone }: { timeZone?: string } = { timeZone: "America/Chicago" }
    ) => {
        return new Date().toLocaleDateString("en-US", {
            day: "numeric",
            month: "long",
            year: "numeric",
            hour: "numeric",
            minute: "numeric",
            second: "numeric",
            timeZone: timeZone,
        });
    },
    {
        name: "getTime",
        description:
            "Get the current time in ISO format with timezone, defaults to America/Chicago",
        schema: z.object({
            timeZone: z.string().optional().default("America/Chicago"),
        }),
    }
);
