import { tool } from "@langchain/core/tools";
import axios from "axios";

export default tool(
    async ({ text, from = "auto", to }) => {
        // await axios.get("https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=auto&tl=en&q=%D9%84%D9%85%D8%A7%D8%B0%D8%A7%20%D8%AA%D9%81%D8%B9%D9%84%20%D9%87%D8%B0%D8%A7")

        const response = await axios.get(
            "https://clients5.google.com/translate_a/t",
            {
                params: {
                    client: "dict-chrome-ex",
                    sl: from,
                    tl: to,
                    q: text,
                },
            }
        );

        // [
        //     [
        //       "Why do you do this",
        //       "ar"
        //     ]
        //   ]
        return JSON.stringify({
            text: response.data[0][0],
            lang: response.data[0][1],
        });
    },
    {
        name: "translate",
        description: "Translate text from one language to another",
        schema: {
            text: "string",
            from: "string",
            to: "string",
        },
    }
);
