import { model, Schema } from "mongoose";

const userSchema = new Schema({
    discordId: {
        type: String,
        required: true,
        unique: true,
    },
    threads: {
        type: [String],
        default: [],
    },
});

export default model("User", userSchema);
