const mongoose = require('mongoose');

const registroCajaSchema = new mongoose.Schema({
    creditoId: mongoose.Schema.Types.ObjectId,
    cuotaId: mongoose.Schema.Types.ObjectId,
    usuario: String, //email
    detalle: String,
    caja: String,
    monto: Number,
    eliminado: Boolean,
}, { timestamps: true });

registroCajaSchema.index({ creditoId: 1, cuotaId: 1, eliminado: 1 });
module.exports = mongoose.model("RegistroCaja", registroCajaSchema);