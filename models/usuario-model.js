const mongoose = require('mongoose');

const oid = mongoose.Schema.Types.ObjectId;
const mixed = mongoose.Schema.Types.Mixed;

const usuarioSchema = new mongoose.Schema({
    eid: oid, 
    email: String,
    contrasena: String,
    telefono: String,//se completa al crear el usuario la 1ra vez
    permisos: [String],
    esHijo: Boolean,
    esAdmin: Boolean,
    eliminado: Boolean,
    resetContrasena: {
        fechaSolicitud: Date,
        token: String
    },
    ultimoAcceso: Date
}, { timestamps: true });

usuarioSchema.index({ eid: 1 });
usuarioSchema.index({ email: 1, esHijo:1, eliminado: 1 });
module.exports = mongoose.model("Usuario", usuarioSchema);