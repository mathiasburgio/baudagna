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
    cobros: [{
        cuotaId: mongoose.Schema.Types.ObjectId,
        fecha: String,
        detalle: String,
        caja: String,
        montoCuota: Number, //cuanto se pago de la cuota en este cobro
        montoPunitorios: Number, // cuanto se pago de punitorio en este cobro
        punitorios: Number,
        diasPunitorios: Number, //dias vencidos al momento del cobro
        eliminado: Boolean,
    }],
    cuotas: [{
        numero: Number,
        monto: Number,
        vencimiento: String,
        cobrado: Boolean,
        eliminado: Boolean,
    }],
    generadorCuotas: {
        montoSolicitado: Number,
        cantidadCuotas: Number,
        intereses: Number,
        montoTotal: Number,
        montoCuota: Number,
        fechaPrimerVencimiento: String,
        fechaUltimoVencimiento: String,
    },
    eliminado: Boolean,
    cerrado: Boolean,
}, { timestamps: true });

module.exports = mongoose.model('CreditoPersonal', creditoPersonalSchema);