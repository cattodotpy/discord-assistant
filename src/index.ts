import { DiscordAssistant } from "./core/client";

async function main() {
    const client = new DiscordAssistant({
        intents: [
            "MessageContent",
            "Guilds",
            "GuildPresences",
            "GuildMessages",
            "GuildMembers",
        ],
    });

    await client.start();
}

main().catch(console.error);
