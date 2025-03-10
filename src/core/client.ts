import chalk from "chalk";
import { Client, type ClientOptions } from "discord.js";
import z from "zod";
import { handleMessage } from "./handle";
import { LLMManager } from "./llm";
import mongoose from "mongoose";
import { type Command, CommandManager } from "./command";
import PingCommand from "../commands/ping";

const envSchema = z.object({
    DISCORD_TOKEN: z.string(),
    LLM_API_KEY: z.string(),
    LLM_BASE_URL: z.string(),
    MONGODB_URI: z.string(),
    COMMAND_PREFIX: z.string().default("$"),
});

type Env = z.infer<typeof envSchema>;

const commands = [new PingCommand()] as Command[];

export class DiscordAssistant extends Client {
    private env: Env;
    private startTimestamp: number;
    public llm: LLMManager;
    public commands: CommandManager;

    constructor(options: ClientOptions) {
        super(options);
        this.env = envSchema.parse(Bun.env);
        this.startTimestamp = Date.now();
        this.llm = new LLMManager(
            {
                apiKey: this.env.LLM_API_KEY,
                baseURL: this.env.LLM_BASE_URL,
                model: "google/gemini-2.0-flash-001",
            },
            this
        );
        this.commands = new CommandManager(this.env.COMMAND_PREFIX, this);

        for (const command of commands) {
            this.commands.register(command);
        }

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

        mongoose.connect(this.env.MONGODB_URI).then(
            () => {
                console.log("Connected to MongoDB");
            },
            (err) => {
                console.error(err);
            }
        );
    }

    public async stop() {
        await this.destroy();
    }
}
