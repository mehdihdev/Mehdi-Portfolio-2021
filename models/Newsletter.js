var mongoose=require("mongoose");
var NewsSchema=mongoose.Schema({
name: String,
email: String,
code: {
    type: String,
    required: true,
},
dateCreated: {
    type: Date,
    default: Date.now(),
    expires: 600,
},
status: {
    type: String,
    default: "pending",
},
});

module.exports=mongoose.model("newsletter", NewsSchema);