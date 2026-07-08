const mongoose = require('mongoose');

const oid = mongoose.Schema.Types.ObjectId;
const mixed = mongoose.Schema.Types.Mixed;

const cajaSchema = new mongoose.Schema({
    caja: String,
    monto: Number,
    detalle: String,
    creditoId: oid,
    cobroId: oid,
    saldo: Number,
}, { timestamps: true });

module.exports = mongoose.model("Caja", cajaSchema);