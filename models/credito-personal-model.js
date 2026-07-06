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
        detalle: String,
        metodo: String, //efectivo, transferencia, tarjeta, etc
        monto: Number, //monto total del cobro (cuota + punitorios)
        montoCapital: Number, //cuanto se pago de capital en este cobro
        montoInteres: Number, //cuanto se pago de intereses en este cobro
        montoPunitorios: Number, //cuanto se pago de mora en este cobro
        diasMora: Number, //dias vencidos al momento del cobro
        eliminado: Boolean,
        facturaId: mongoose.Schema.Types.ObjectId, //si se facturo el cobro, aca va el id de la factura
        createdAt: String,
    }],
    cuotas: [{
        cobroId: mongoose.Schema.Types.ObjectId,
        facturaId: mongoose.Schema.Types.ObjectId, //si se facturo la cuota, aca va el id de la factura
        numero: Number,
        monto: Number, //capital + monto de intereses
        montoCapital: Number, //solo el monto de capital (para poder modificarlo sin afectar los intereses)
        montoInteres: Number, //solo el monto de intereses (para poder modificarlo sin afectar el capital)
        tasaInteres: Number, //con esto puedo extraer el interes de cada cuota
        vencimiento: String,
        cobrado: Boolean,
        eliminado: Boolean,
    }],
    proximoVencimiento: String,
    eliminado: Boolean,
    cerrado: Boolean,
}, { timestamps: true });

module.exports = mongoose.model('CreditoPersonal', creditoPersonalSchema);