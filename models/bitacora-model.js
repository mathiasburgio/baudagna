const mongoose = require('mongoose');

const oid = mongoose.Schema.Types.ObjectId;
const mixed = mongoose.Schema.Types.Mixed;

const bitacoraSchema = new mongoose.Schema({
    accion: String,
    usuario: String,
    auxiliar: String
}, { timestamps: true });

bitacoraSchema.index({ accion: 1, usuario: 1 });
module.exports = mongoose.mongoose.model("Bitacora", bitacoraSchema);