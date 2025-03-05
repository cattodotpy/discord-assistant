import chalk from "chalk";
import { Client, type ClientOptions } from "discord.js";
import z from "zod";
import { handleMessage } from "./handle";
import { LLMManager } from "./llm";

const envSchema = z.object({
    DISCORD_TOKEN: z.string(),
    LLM_API_KEY: z.string(),
    LLM_BASE_URL: z.string(),
});

type Env = z.infer<typeof envSchema>;

export class DiscordAssistant extends Client {
    private env: Env;
    private startTimestamp: number;
    public llm: LLMManager;
    constructor(options: ClientOptions) {
        super(options);
        this.env = envSchema.parse(Bun.env);
        this.startTimestamp = Date.now();
        this.llm = new LLMManager(
            {
                apiKey: this.env.LLM_API_KEY,
                reasoning: false,
            },
            this
        );

        this.initialize().catch(console.error);
    }

    public async start() {
        await this.login(this.env.DISCORD_TOKEN);
    }

    public async initialize() {
        this.on("ready", () => {
            console.log(
                `${chalk.green("Logged in as")} ${chalk.blue(this.user?.tag)}`
            );
            console.log(
                `${chalk.green("Started at")} ${chalk.blue(
                    new Date(this.startTimestamp).toLocaleString()
                )}`
            );
        });

        this.on("messageCreate", async (message) => {
            return await handleMessage(message, this);
        });
    }

    public async stop() {
        await this.destroy();
    }
}
