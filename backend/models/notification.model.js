import mongoose from "mongoose"

const notificationSchema = new mongoose.Schema({
    from:{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },

    read:{
        type: Boolean,
        default: false
    },

},{ timestamps: true}
)

const Notification = mongoose.model("Notification", notificationSchema)

export default Notification