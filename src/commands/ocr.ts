import { createCommand } from "../core/command";
import sharp from "sharp";
import ky from "ky";
import { AttachmentBuilder, Message } from "discord.js";

const imageRegex = /!\[img-(\d+)\.jpeg\]\(img-\d+\.jpeg\)/g;

async function cropImage(
    sourceImage: Buffer,
    bX: number,
    bY: number,
    tX: number,
    tY: number
) {
    const image = sharp(sourceImage);

    const metadata = await image.metadata();

    const width = metadata.width as number;
    const height = metadata.height as number;

    const bottomRightX = Math.min(width, bX);
    const bottomRightY = Math.min(height, bY);
    const topLeftX = Math.max(0, tX);
    const topLeftY = Math.max(0, tY);

    const buffer = await image
        .extract({
            left: topLeftX,
            top: topLeftY,
            width: bottomRightX - topLeftX,
            height: bottomRightY - topLeftY,
        })
        .png()
        .toBuffer();

    return buffer;
}

export const ocrCommand = createCommand(
    {
        name: "ocr",
        description: "Converts image to text.",
        textCommandOnly: true,
        arguments: {},
    },
    async (ctx) => {
        if (!ctx.message) {
            return;
        }
        await ctx.typing();

        const attachments = ctx.message.attachments;

        if (!attachments) {
            await ctx.reply("Please provide an image.");
            return;
        }
        let lastMessage = ctx.message as Message;

        for (const attachment of attachments.values()) {
            const url = attachment.url;
            let response;
            if (url.endsWith(".pdf")) {
                response = await ctx.bot.mistral.ocr.process({
                    model: "mistral-ocr-latest",
                    document: {
                        type: "document_url",
                        documentUrl: url,
                    },
                });
            } else {
                response = await ctx.bot.mistral.ocr.process({
                    model: "mistral-ocr-latest",
                    document: {
                        type: "image_url",
                        imageUrl: url,
                    },
                });
            }

            if (!response) {
                await ctx.reply("Failed to process image.");
                return;
            }

            const sourceBuffer = Buffer.from(await ky.get(url).arrayBuffer());
            let finalImages = [];

            for (let i = 0; i < response.pages.length; i++) {
                const page = response.pages[i];

                for (const image of page.images) {
                    if (image.imageBase64) {
                        finalImages.push(image);
                        continue;
                    }

                    if (
                        image.bottomRightX === null ||
                        image.bottomRightY === null ||
                        image.topLeftX === null ||
                        image.topLeftY === null
                    ) {
                        continue;
                    }

                    const buffer = await cropImage(
                        sourceBuffer,
                        image.bottomRightX,
                        image.bottomRightY,
                        image.topLeftX,
                        image.topLeftY
                    );
                    finalImages.push({
                        ...image,
                        imageBase64: buffer.toString("base64"),
                    });
                }

                page.markdown = page.markdown.replace(
                    imageRegex,
                    (match, p1) => {
                        const image = parseInt(p1);
                        return `[Attachment ${image + 1}]`;
                    }
                );

                if (i === response.pages.length - 1) {
                    lastMessage = await lastMessage.reply({
                        content: page.markdown,
                        files: finalImages.map((image) =>
                            new AttachmentBuilder(
                                Buffer.from(
                                    image.imageBase64 as string,
                                    "base64"
                                )
                            ).setName(`image-${i}.jpeg`)
                        ),
                    });
                } else {
                    lastMessage = await lastMessage.reply({
                        content: page.markdown,
                    });
                }
            }
        }
    }
);
