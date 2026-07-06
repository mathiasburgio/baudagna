const mongoose = require('mongoose');

const oid = mongoose.Schema.Types.ObjectId;
const mixed = mongoose.Schema.Types.Mixed;

const contadorSchema = new mongoose.Schema({
    llave: String,
    valor: Number,
}, { timestamps: true });

contadorSchema.index({ llave: 1 });
module.exports = mongoose.mongoose.model("Contador", contadorSchema);