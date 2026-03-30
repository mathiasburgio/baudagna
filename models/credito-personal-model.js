const mongoose = require('mongoose');

const creditoPersonalSchema = new mongoose.Schema({
    numero: Number,
    token: String, //valor aleatorio para acceso externo
    estado: String, //borrador, activo, finalizado,
    documentos: [{
        nombre: String,
        archivo: String, //nombre real en el servidor
    }],
    datosGenerales: {
        type: Map,
        of: String
    },
    finalidad: { //aqui tambien incluye tipo =personal, vehicular, vivienda, etc
        type: Map,
        of: String
    },
    prestamo: {
        monto: Number,
        intereses: Number,
        cuotas: Number,
        montoPorCuota: Number,
        fechaInicio: Date,
        fechaFin: Date,
    },
    cobros: [{
        cuotaId: mongoose.Schema.Types.ObjectId,
        fecha: Date,
        detalle: String,
        caja: String,
        montoCuota: Number, //cuanto se pago de la cuota en este cobro
        montoPunitorio: Number, // cuanto se pago de punitorio en este cobro
        punitorio: Number,
        punitorioDiasVencidos: Number, //dias vencidos al momento del cobro
        eliminado: Boolean,
    }],
    cuotas: [{
        numero: Number,
        monto: Number,
        vencimiento: Date,
        cobrado: Boolean,
        eliminado: Boolean,
    }],
    eliminado: Boolean,
    cerrado: Boolean,
}, { timestamps: true });

module.exports = mongoose.model('CreditoPersonal', creditoPersonalSchema);