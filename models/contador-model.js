const mongoose = require('mongoose');

const oid = mongoose.Schema.Types.ObjectId;
const mixed = mongoose.Schema.Types.Mixed;

const contadorSchema = new mongoose.Schema({
    eid: oid,
    llave: String,
    valor: Number,
}, { timestamps: true });

contadorSchema.index({ eid: 1, llave: 1 }, { unique: true });
module.exports = mongoose.mongoose.model("Contador", contadorSchema);