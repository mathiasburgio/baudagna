const mongoose = require('mongoose');

const oid = mongoose.Schema.Types.ObjectId;
const mixed = mongoose.Schema.Types.Mixed;

const facturaSchema = new mongoose.Schema({
    creditoId: oid,
    cuotaId: oid,
    cobroId: oid,
    enviado: mixed,
    respuesta: mixed,
    correcto: Boolean,
}, { timestamps: true });

module.exports = mongoose.model("Factura", facturaSchema);