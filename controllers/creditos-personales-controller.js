const CreditoPersonal = require("../models/credito-personal-model");
const bitacora = require("../models/bitacora-model");
const utils = require("../utils/utils");
const {FechasTemporal} = require("../utils/FechasTemporal");
const {ObjectId} = require("mongodb");

async function html(req, res){
    res.status(200).render( 
        "../views/layouts/dashboard.ejs", 
        { page: "../pages/dashboard-creditos-personales.ejs", title: "Créditos personales" }
    );
}
async function listado(req, res){
    try{
        const resp = await CreditoPersonal.find({eliminado: {$ne: true}}).sort({createdAt: -1}).limit(1000).lean();
        res.status(200).json(resp);
    }catch(e){
        console.error(e);
        res.status(500).end(e.toString());
    }
}
async function obtenerCredito(req, res){
    try{
        const {creditoId} = req.params;
        const resp = await CreditoPersonal.findOne({_id: creditoId, eliminado: {$ne: true}}).lean();
        if(!resp) throw "Crédito no encontrado";
        res.status(200).json(resp);
    }catch(e){
        console.error(e);
        res.status(500).end(e.toString());
    }
}
async function nuevo(req, res){
    try{
        let datos = req.body;
        if(Object.keys(datos).length > 100) throw "Demasiados datos enviados";
        const credito = await CreditoPersonal.create({
            token: utils.getUUID(),
            numero: await req.setContador("credito-personal", "incr"),
            datosGenerales: datos,
            finalidad: {"finalidad-tipo": "general"},
            eliminado: false,
        });

        registrarBitacora(req.session?.data?.usuario?.email, "nuevo_credito", {creditoId: credito._id, numero: credito.numero});
        res.status(200).json(credito);
    }catch(e){
        console.error(e);
        res.status(500).end(e.toString());
    }

}
//guarda "datosGenerales" y "finalidad"
async function modificar(req, res){
    try{
        let {creditoId, tipoDato, datos} = req.body;
        if(Object.keys(datos).length > 100) throw "Demasiados datos enviados";
        let credito = await CreditoPersonal.findOne({_id: creditoId});
        if(tipoDato === "datosGenerales"){
            for(let key in datos){
                let val = datos[key];
                credito.datosGenerales.set(key, val);
            }
            await credito.save();
        }else if(tipoDato === "finalidad"){
            for(let key in datos){
                let val = datos[key];
                credito.finalidad.set(key, val);
            }
            await credito.save();
        }else{
            throw "Datos inválidos";
        }
        console.log("Credito modificado", creditoId, tipoDato, datos);
        res.status(200).json(credito);
    }catch(e){
        console.error(e);
        res.status(500).end(e.toString());
    }
}
async function eliminar(req, res){
    try{
        let {creditoId} = req.body;
        let credito = await CreditoPersonal.findOne({_id: creditoId});
        if(!credito) throw "Crédito no encontrado";
        credito.eliminado = true;
        await credito.save();

        registrarBitacora(req.session?.data?.usuario?.email, "eliminar_credito", {creditoId: credito._id, numero: credito.numero});
        res.status(200).json(credito);
    }catch(e){
        console.error(e);
        res.status(500).end(e.toString());
    }
}
async function asignarCuotas(req, res){
    try{
        let {creditoId, cuotas} = req.body;
        if(!Array.isArray(cuotas)) throw "Cuotas inválidas (debe ser un array)";
        let credito = await CreditoPersonal.findOne({_id: creditoId});
        if(!credito) throw "Crédito no encontrado";
        //solo permito agregar de a una cuota si es q ya se cobro alguna
        if(cuotas.length > 1 && credito?.cuotas?.some(c=>c.cobrado)) throw "No se pueden modificar las cuotas de un crédito con cobros registrados";
        if(cuotas.length > 300) throw "Demasiadas cuotas enviadas (máximo 300)";
        if(cuotas.length > 1) credito.cuotas = [];

        cuotas.forEach(cuota=>{
            let existe = credito.cuotas.find(c=>c._id.toString() == cuota?._id?.toString());
            if(existe){
                Object.assign(existe, cuota);
            }else{
                credito.cuotas.push(cuota);
            }
        });

        obtenerProximoVencimiento(credito);
        await credito.save();
        res.status(200).json({credito, cuotas});
    }catch(e){
        console.error(e);
        res.status(500).end(e.toString());
    }
}
async function modificarCuota(req, res){
    try{
        let {creditoId, cuotaId, cuota} = req.body;
        let credito = await CreditoPersonal.findOne({_id: creditoId});
        if(!credito) throw "Crédito no encontrado";
        let cuotaIndex = credito.cuotas.findIndex(c => c._id.toString() == cuotaId);
        if(cuotaIndex == -1) throw "Cuota no encontrada";
        Object.assign(credito.cuotas[cuotaIndex], cuota);

        obtenerProximoVencimiento(credito);
        await credito.save();
        console.log(creditoId, cuotaId, cuota);
        res.status(200).json({credito, cuota});
    }catch(e){
        console.error(e);
        res.status(500).end(e.toString());
    }
}
async function eliminarCuota(req, res){
    try{
        let {creditoId, cuotaId} = req.body;
        let credito = await CreditoPersonal.findOne({_id: creditoId});
        if(!credito) throw "Crédito no encontrado";
        let cuota = credito.cuotas.find(c => c._id.toString() == cuotaId);
        if(!cuota) throw "Cuota no encontrada";
        cuota.eliminado = true;

        obtenerProximoVencimiento(credito);
        await credito.save();
        res.status(200).json(credito);
    }catch(e){
        console.error(e);
        res.status(500).end(e.toString());
    }
}
async function cobrarCuota(req, res){
    try{
        const {creditoId, cuotaId, montoTotal, montoCapital, montoInteres, montoPunitorios, diasMora, metodo, detalle} = req.body;
        let credito = await CreditoPersonal.findOne({_id: creditoId, eliminado: {$ne: true}});
        if(!credito) throw "Crédito no encontrado";
        let cuota = credito.cuotas.find(c => c._id.toString() == cuotaId);
        if(!cuota) throw "Cuota no encontrada";
        if(cuota.eliminado) throw "No se pueden cobrar una cuota eliminada";
        let cobroId = new ObjectId();
        credito.cobros.push({
            _id: cobroId,
            reciboNumero: await req.setContador("recibo", "incr"),
            cuotaId: cuotaId,
            monto: montoTotal, //total
            montoCapital: montoCapital,
            montoInteres: montoInteres,
            montoPunitorios: montoPunitorios,
            diasMora: diasMora,
            metodo: metodo,
            detalle: detalle,
            eliminado: false,
            createdAt: new Date(), //guarda un date no "temporal"
        });

        cuota.cobrado = true;
        cuota.cobroId = cobroId;
        obtenerProximoVencimiento(credito);
        await credito.save();
        let cobro = credito.cobros.find(c=>c._id.toString() == cobroId.toString());

        const ultimoRegistro = await Caja.findOne({caja: metodo}).sort({createdAt: -1}).lean();
        const caja = await Caja.create({
            caja: metodo,
            monto: montoTotal,
            detalle: "Cobro de cuota #" + cuota.numero + " del crédito #" + credito.numero + " (" + credito.datosGenerales?.["datos-personales-apellidos"] + " " + credito.datosGenerales?.["datos-personales-nombres"] + ")",
            creditoId: creditoId,
            cobroId: cobroId,
            saldo: ultimoRegistro ? ultimoRegistro.saldo + montoTotal : montoTotal, // Esto debería ser calculado según la lógica de tu aplicación
        });

        res.status(200).json({credito, cuota, cobro});
    }catch(e){
        console.error(e);
        res.status(500).end(e.toString());
    
    }
}

async function obtenerUltimoVencimiento(cuota){
    if(!cuota) return null;

}

function obtenerProximoVencimiento(credito){
    //calculo proximo vencimiento
    credito.cuotas.sort((a, b) => a.vencimiento - b.vencimiento);
    let primeraEnVenceser = credito.cuotas.find(c=>c.cobrado != true && c.eliminado != true);
    credito.proximoVencimiento = primeraEnVenceser ? primeraEnVenceser.vencimiento : null;
}




//VIEJO
async function guardarCreditoPersonalDatosGenerales(req, res){
    try{
        let datos = req.body;
        if(Object.keys(datos).length > 100) throw "Demasiados datos enviados";

        let credito = null;
        if(datos.creditoId){
            credito = await CreditoPersonal.findOneAndUpdate(
                { _id: datos.creditoId },
                { $set: { datosGenerales: datos } },
                { returnDocument: "after" }
            );
        }else{
            credito = await CreditoPersonal.create({
                token: utils.getUUID(),
                numero: await req.setContador("credito-personal", "incr"),
                datosGenerales: datos,
                finalidad: {"finalidad-tipo": "general"},
                eliminado: false,
                cerrado: false
            });
        }
        res.status(200).json(credito);
    }catch(e){
        console.error(e);
        res.status(500).end(e.toString());
    }
}
async function guardarCreditoPersonalFinalidad(req, res){
    try{
        let datos = req.body;
        let creditoId = datos.creditoId;
        if(Object.keys(datos).length > 100) throw "Demasiados datos enviados";

        let credito = await CreditoPersonal.findOneAndUpdate(
            {_id: creditoId},
            { $set: { finalidad: datos } },
            { returnDocument: "after", upsert: false }
        );
        console.log(credito, creditoId);
        res.status(200).json(credito);
    }catch(e){
        console.error(e);
        res.status(500).end(e.toString());
    }
}
async function eliminarCreditoPersonal(req, res){
    try{
        let {creditoId} = req.body;
        let credito = await CreditoPersonal.findOne({_id: creditoId});
        if(!credito) throw "Crédito no encontrado";
        credito.eliminado = true;
        await credito.save();
        res.status(200).json(credito);
    }catch(e){
        console.error(e);
        res.status(500).end(e.toString());
    }
}
//CUOTAS
async function generarCuotas(req, res){
    try{
        let {creditoId, cuotas, generadorCuotas} = req.body;
        let credito = await CreditoPersonal.findOne({ _id: creditoId });
        if(!credito) throw "Crédito no encontrado";
        if(credito.cobros.length > 0) throw "No se pueden generar cuotas para un crédito con cobros registrados";
        
        credito.cuotas = cuotas;//las cuotas ya generadas en front
        credito.generadorCuotas = generadorCuotas; //el objeto completo
        credito.proximoVencimiento = cuotas[0] ? cuotas[0].vencimiento : null;
        await credito.save();
        res.status(200).json(credito);
    }catch(e){
        console.error(e);
        res.status(500).end(e.toString());
    }
}
async function upsertCuota(req, res){
    try{
        let {creditoId, cuotaId, cuota} = req.body;
        let credito = await CreditoPersonal.findOne({_id: creditoId});
        if(!credito) throw "Crédito no encontrado";
        if(cuotaId){//modificar
            let cuotaIndex = credito.cuotas.findIndex(c => c._id.toString() == cuotaId);
            if(cuotaIndex == -1) throw "Cuota no encontrada";
            //console.log(credito.cuotas[cuotaIndex]);
            Object.assign(credito.cuotas[cuotaIndex], cuota);
        }else{//nueva
            credito.cuotas.push(cuota);
        }
        
        let proximaCuota = credito.cuotas.find(c=>c?.eliminado != true && c.cobrado != true);
        credito.proximoVencimiento = proximaCuota ? proximaCuota.vencimiento : null;
        await credito.save();

        res.status(200).json(credito);
    }catch(e){ 
        console.error(e);
        res.status(500).end(e.toString());
    }
}
async function eliminarCuota(req, res){
    try{
        let {creditoId, cuotaId} = req.body;
        let credito = await CreditoPersonal.findOne({_id: creditoId});
        if(!credito) throw "Crédito no encontrado";
        if(credito.cobros.find(c=>c.cuotaId.toString() == cuotaId)) throw "No se pueden eliminar una cuota ya cobrada";
        let cuota = credito.cuotas.find(c => c._id.toString() == cuotaId);
        if(!cuota) throw "Cuota no encontrada";
        if(cuota.cobrado) throw "No se pueden eliminar una cuota ya cobrada";
        cuota.eliminado = true;
        await credito.save();

        let proximaCuota = credito.cuotas.find(c=>c?.eliminado != true && c.cobrado != true);
        credito.proximoVencimiento = proximaCuota ? proximaCuota.vencimiento : null;
        await credito.save();

        res.status(200).json(credito);
    }catch(e){
        console.error(e);
        res.status(500).end(e.toString());
    }
}
//COBROS
async function acreditarCobro(req, res){
    try{
        let {creditoId, cuotaId, fecha, montoCuota, punitorios, diasPunitorios, montoPunitorios, caja, detalle} = req.body;
        let credito = await CreditoPersonal.findOne({_id: creditoId});
        if(!credito) throw "Crédito no encontrado";
        let cuota = credito.cuotas.find(c => c._id.toString() == cuotaId);
        if(!cuota) throw "Cuota no encontrada";
        if(cuota.eliminado) throw "No se pueden cobrar una cuota eliminada";
        if(cuota.cobrado) throw "Cuota ya cobrada";

        //console.log(req.body);
        credito.cobros.push({
            cuotaId: cuota._id,
            fecha: fecha,
            montoCuota: montoCuota,
            punitorios: punitorios,
            diasPunitorios: diasPunitorios,
            montoPunitorios: montoPunitorios,
            caja: caja,
            detalle: detalle,
            eliminado: false
        });
        await credito.save();

        //sumo cobros para la cuota
        let sumaCobros = credito.cobros.reduce((acc, cobro) =>{
            if(cobro.cuotaId.toString() == cuotaId && cobro.eliminado != true) acc += cobro.montoCuota || 0;
            return acc;
        }, 0);
        
        //verifico si esta 100% paga
        if(sumaCobros >= cuota.monto){
            cuota.cobrado = true;
            await credito.save();
        }

        //grabo proximo vencimiento
        let proximaCuota = credito.cuotas.find(c=>c?.eliminado != true && c.cobrado != true);
        credito.proximoVencimiento = proximaCuota ? proximaCuota.vencimiento : null;
        await credito.save();

        res.status(200).json(credito);
    }catch(e){
        console.error(e);
        res.status(500).end(e.toString());
    }
}
async function eliminarCobro(req, res){
    try{
        let {creditoId, cobroId} = req.body;
        let credito = await CreditoPersonal.findOne({_id: creditoId});
        if(!credito) throw "Crédito no encontrado";
        let cobro = credito.cobros.find(c => c._id.toString() == cobroId);
        if(!cobro) throw "Cobro no encontrado";
        cobro.eliminado = true;

        let proximaCuota = credito.cuotas.find(c=>c?.eliminado != true && c.cobrado != true);
        credito.proximoVencimiento = proximaCuota ? proximaCuota.vencimiento : null;

        await credito.save();
        res.status(200).json(credito);
    }catch(e){
        console.error(e);
        res.status(500).end(e.toString());
    }   
}

//RECIBO
async function generarRecibo(req, res){
    try{
        let {creditoId, cuotaId, cobroId} = req.body;
        let credito = await CreditoPersonal.findOne({_id: creditoId});
        if(!credito) throw "Crédito no encontrado";
        let cuota = credito.cuotas.find(c => c._id.toString() == cuotaId);
        if(!cuota) throw "Cuota no encontrada";
        let cobro = credito.cobros.find(c => c._id.toString() == cobroId);
        if(!cobro) throw "Cobro no encontrado";

        let existe = await Recibo.findOne({creditoId, cuotaId, cobroId});
        if(existe) return res.status(200).json(existe);

        let recibo = await Recibo.create({
            numero: await req.setContador("recibo", "incr"),
            creditoId: credito._id,
            cuotaId: cuota._id,
            cobroId: cobro._id,
            fecha: FechasTemporal.toString().split("T")[0],
        });
        res.status(200).json(recibo);
    }catch(e){
        console.error(e);
        res.status(500).end(e.toString());
    }
}
async function obtenerRecibo(req, res){
    try{
        let {reciboId, creditoId, cobroId} = req.query;
        let recibo = null;
        let credito = null;

        if(reciboId) recibo = await Recibo.findOne({_id: reciboId}).lean();
        else if(creditoId && cobroId) recibo = await Recibo.findOne({creditoId, cobroId}).lean();
        
        if(!recibo) throw "Recibo no encontrado";
        
        credito = await CreditoPersonal.findOne({_id: recibo.creditoId}).lean();
        if(!credito) throw "Crédito no encontrado";

        res.status(200).json({recibo, credito});
    }catch(e){
        console.error(e);
        res.status(500).end(e.toString());
    }
}

function migrarCreditoViejoANuevo(old) {

    const datosGenerales = {};
    const finalidad = {};

    // =========================
    // DATOS GENERALES
    // =========================

    datosGenerales["observaciones"] = old.observaciones || "";

    datosGenerales["datos-personales-apellidos"] = old.datosPersonalesApellidos || "";
    datosGenerales["datos-personales-nombres"] = old.datosPersonalesNombres || "";
    datosGenerales["datos-personales-estado-civil"] = old.datosPersonalesEstadoCivil || "";
    datosGenerales["datos-personales-conyuge"] = old.datosPersonalesApellidosNombresConyuge || "";
    datosGenerales["datos-personales-tipo-documento"] = old.datosPersonalesTipoDocumento || "";
    datosGenerales["datos-personales-numero-documento"] = old.datosPersonalesNumeroDocumento || "";
    datosGenerales["datos-personales-condicion-iva"] = old.condicionIva?.toString() || "";

    datosGenerales["direccion-calle"] = [
        old.datosPersonalesDomicilio || "",
        old.datosPersonalesDomicilioNumero || "",
        old.datosPersonalesDomicilioPiso || "",
        old.datosPersonalesDomicilioDepartamento || ""
    ]
    .filter(Boolean)
    .join(" ")
    .trim();

    datosGenerales["direccion-localidad"] = old.datosPersonalesLocalidad || "";
    datosGenerales["direccion-provincia"] = old.datosPersonalesProvincia || "";

    datosGenerales["contacto-telefono"] =
        old.datosPersonalesCelular ||
        old.datosPersonalesTelefono ||
        "";

    datosGenerales["contacto-email"] = "";

    datosGenerales["garante-nombre"] = [
        old.datosGaranteApellidos || "",
        old.datosGaranteNombres || ""
    ]
    .join(" ")
    .trim();

    datosGenerales["garante-direccion"] =
        old.datosGaranteDomicilioLocalidad || "";

    datosGenerales["garante-telefono"] =
        old.datosGaranteTelefonos || "";

    datosGenerales["garante-tipo-documento"] = "";
    datosGenerales["garante-numero-documento"] = "";

    // =========================
    // FINALIDAD
    // =========================

    finalidad["finalidad-tipo"] = "general";
    finalidad["finalidad-fecha-compra"] = "";
    finalidad["finalidad-detalle-general"] = "";

    // =========================
    // GENERADOR CUOTAS
    // =========================

    const generadorCuotas = {
        montoSolicitado: Number(old.datosCreditoMonto || 0),
        intereses: Number(old.datosCreditoIntereses || 0),
        cantidadCuotas: Number(old.datosCreditoCuotas || 0),
        montoTotal:
            Number(old.datosCreditoMontoPorCuota || 0) *
            Number(old.datosCreditoCuotas || 0),
        montoCuota: Number(old.datosCreditoMontoPorCuota || 0),
        fechaPrimerVencimiento: old.datosCreditoMesInicio
            ? old.datosCreditoMesInicio.split("T")[0]
            : "",
        fechaUltimoVencimiento: old.datosCreditoMesFin
            ? old.datosCreditoMesFin.split("T")[0]
            : ""
    };

    // =========================
    // CUOTAS
    // =========================
    
    const cuotas = (old.cuotas || []).map((c, index) => {

        let montoCapital = null;
        let montoInteres = null;

        if (
            generadorCuotas.montoSolicitado > 0 &&
            generadorCuotas.cantidadCuotas > 0
        ) {
            montoCapital = Number(
                (
                    generadorCuotas.montoSolicitado /
                    generadorCuotas.cantidadCuotas
                ).toFixed(2)
            );

            montoInteres = Number(
                (
                    (c.monto || 0) - montoCapital
                ).toFixed(2)
            );
        }

        return {
            _id: new ObjectId(),

            numero: c.numero || (index + 1),

            monto: Number(c.monto || 0),

            montoCapital,

            montoInteres,

            tasaInteres: Number(old.datosCreditoIntereses || 0),

            vencimiento: c.vencimiento
                ? c.vencimiento.split("T")[0]
                : "",

            cobrado: c.cobrado === true,

            eliminado: false
        };
    });

    // =========================
    // COBROS
    // =========================

    const cobros = [];

    (cuotas || []).forEach((c, index) => {
        // Solo creamos un registro de cobro si la cuota estaba realmente cobrada
        if (c.cobrado === true) {
            // Usamos la cuota que acabamos de formatear arriba para obtener 
            // la separación correcta de capital e interés
            const cuotaAsociada = cuotas[index]; 
            
            const montoMora = Number(c.punitorio || 0);
            const montoTotal = Number(c.monto || 0) + montoMora;

            cobros.push({
                // Dependiendo de cómo venga el ID de la cuota en el viejo modelo
                cuotaId: c._id || c.cuotaId || null, 

                fecha: c.fecha
                    ? c.fecha.split("T")[0]
                    : "",

                detalle: c.detalle || "Migrado de sistema anterior",

                caja: c.caja || "",

                monto: montoTotal,

                montoCapital: cuotaAsociada.montoCapital || 0,

                montoInteres: cuotaAsociada.montoInteres || 0,

                montoMora: montoMora,

                diasMora: 0, // Dato no disponible en el modelo viejo

                cobroParcial: false, // Asumimos que si estaba 'cobrada', se pagó completa

                cierraCuota: true,

                eliminado: false
            });
        }
    });

    // =========================
    // PROXIMO VENCIMIENTO
    // =========================

    const proximaCuota = cuotas.find(c => !c.cobrado);

    const proximoVencimiento =
        proximaCuota?.vencimiento || "";

    // =========================
    // DOCUMENTOS
    // =========================

    const documentos = (old.documentos || []).map(d => ({
        nombre: d.nombre || "",
        archivo: d.archivo || ""
    }));

    // =========================
    // DOCUMENTO NUEVO
    // =========================

    return {
        numero: old.numero,
        token: old.token,
        estado: old.estado,

        documentos,

        datosGenerales,

        finalidad,

        cobros,

        cuotas,

        generadorCuotas,

        proximoVencimiento,

        eliminado: old.eliminado === true,

        cerrado: cuotas.length > 0
            ? cuotas.every(c => c.cobrado)
            : false,

        createdAt: old.createdAt,
        updatedAt: old.updatedAt
    };
}

function migrarCreditoViejoANuevoV2(creditosViejos){

    const operaciones = [];

    for(const creditoViejo of creditosViejos){

        // ID NUEVO DEL CREDITO
        const creditoId = new ObjectId();

        // =========================
        // CLIENTE
        // =========================
        const cliente = {
            apellido: creditoViejo.datosPersonalesApellidos?.trim() || "",
            nombre: creditoViejo.datosPersonalesNombres?.trim() || "",

            telefono: creditoViejo.datosPersonalesTelefono || "",
            celular: creditoViejo.datosPersonalesCelular || "",

            direccion: {
                calle: creditoViejo.datosPersonalesDomicilio || "",
                numero: creditoViejo.datosPersonalesDomicilioNumero || "",
                piso: creditoViejo.datosPersonalesDomicilioPiso || "",
                depto: creditoViejo.datosPersonalesDomicilioDepartamento || "",
                localidad: creditoViejo.datosPersonalesLocalidad || "",
                provincia: creditoViejo.datosPersonalesProvincia || "",
                codigoPostal: creditoViejo.datosPersonalesCodigoPostal || ""
            },

            documento: {
                tipo: creditoViejo.datosPersonalesTipoDocumento || "",
                numero: creditoViejo.datosPersonalesNumeroDocumento || "",
                cuil: creditoViejo.datosPersonalesCuil || ""
            }
        };

        // =========================
        // CUOTAS
        // =========================
        const cuotas = (creditoViejo.cuotas || []).map((cuota, index)=>({

            _id: new ObjectId(),

            numero: index + 1,

            monto: cuota.monto || 0,

            vencimiento: cuota.vencimiento
                ? new Date(cuota.vencimiento)
                : null,

            estado: cuota.cobrado
                ? "pagada"
                : "pendiente",

            pago: cuota.cobrado ? {
                fecha: cuota.fechaCobrado
                    ? new Date(cuota.fechaCobrado)
                    : null,

                caja: cuota.caja || "",
                detalle: cuota.detalle || ""
            } : null,

            punitorio: cuota.punitorio || 0,

            notificado: cuota.notificado || false
        }));

        // =========================
        // CREDITO NUEVO
        // =========================
        const creditoNuevo = {

            _id: creditoId,

            legacyId: creditoViejo._id,

            numero: creditoViejo.numero,

            token: creditoViejo.token,

            estado: creditoViejo.estado,

            cliente,

            credito: {
                monto: creditoViejo.datosCreditoMonto || 0,

                interes: creditoViejo.datosCreditoIntereses || 0,

                cuotas: creditoViejo.datosCreditoCuotas || 0,

                valorCuota: creditoViejo.datosCreditoMontoPorCuota || 0,

                fechaInicio: creditoViejo.datosCreditoMesInicio
                    ? new Date(creditoViejo.datosCreditoMesInicio)
                    : null,

                fechaFin: creditoViejo.datosCreditoMesFin
                    ? new Date(creditoViejo.datosCreditoMesFin)
                    : null
            },

            cuotas,

            observaciones: creditoViejo.observaciones || "",

            documentos: creditoViejo.documentos || [],

            eliminado: creditoViejo.eliminado || false,

            createdAt: creditoViejo.createdAt
                ? new Date(creditoViejo.createdAt)
                : new Date(),

            updatedAt: creditoViejo.updatedAt
                ? new Date(creditoViejo.updatedAt)
                : new Date()
        };

        operaciones.push({
            insertOne: {
                document: creditoNuevo
            }
        });
    }

    return operaciones;
}

//MIGRADOR
async function migrar(req, res){
    try{
        let creditosViejos = req.body.creditos || [];
        if(typeof creditosViejos === "string") creditosViejos = JSON.parse(creditosViejos);
        await CreditoPersonal.deleteMany({});
        if(req.body?.v == "v2"){
            const operaciones = migrarCreditoViejoANuevoV2(creditosViejos);
            await CreditoPersonal.bulkWrite(operaciones);
            res.status(200).json({migrados: operaciones.length});
        }else{
            let creditosNuevos = creditosViejos.map(migrarCreditoViejoANuevo).flat();
            await CreditoPersonal.insertMany(creditosNuevos);
            res.status(200).json({migrados: creditosNuevos.length});
        }
    }catch(e){
        console.error(e);
    }
}


async function registrarBitacora(usuario, accion, auxiliar=null){
    return true;

    const bitacoraEntry = await bitacora.create({
        accion: accion,
        usuario: usuario || "Desconocido",
        auxiliar: JSON.stringify(auxiliar)
    });
    return true;
}

module.exports = {
    html,
    listado,
    obtenerCredito,
    nuevo,
    modificar,
    eliminar,
    asignarCuotas,
    modificarCuota,
    eliminarCuota,
    cobrarCuota,
    registrarBitacora
}