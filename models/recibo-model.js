const mongoose = require('mongoose');

const reciboSchema = new mongoose.Schema({
    numero: Number,
    fecha: String,
    creditoId: mongoose.Schema.Types.ObjectId,
    cuotaId: mongoose.Schema.Types.ObjectId,
    cobroId: mongoose.Schema.Types.ObjectId,
    numero: Number,
}, { timestamps: true });

module.exports = mongoose.model('Recibo', reciboSchema);
