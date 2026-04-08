const CreditoPersonal = require("../models/credito-personal-model");
const Recibo = require("../models/recibo-model");
const utils = require("../utils/utils");
const {FechasTemporal} = require("../utils/FechasTemporal");

async function vista(req, res){
    res.status(200).render( 
        "../views/layouts/dashboard.ejs", 
        { page: "../pages/dashboard-creditos-personales.ejs", title: "Créditos personales" }
    );
}
async function listarCreditosPersonales(req, res){
    try{
        let pagina = parseInt(req.query.pagina) || 1;
        let limite = parseInt(req.query.limite) || 100;
        let filtro = req.query.filtro || "Todos";
        let orden = req.query.orden || "Mas reciente";

        let query = {eliminado: false};
        if(filtro == "Activos" || orden == "Próximo vencimiento"){ 
            //cuota cobrado = false and eliminado != true
            query["cuotas"] = {$elemMatch: {eliminado: {$ne: true}, cobrado:  {$ne: true}}};
        }
        if(filtro == "roque-perez@motos"){
            query["finalidad.finalidad-tipo"] = "Vehiculo";
            query["finalidad.finalidad-vehiculo-tipo"] = "Moto";
            query["datosGenerales.localidad"] = "Roque Pérez";
        }else if(filtro == "roque-perez@autos"){
            query["finalidad.finalidad-tipo"] = "Vehiculo";
            query["finalidad.finalidad-vehiculo-tipo"] = "Auto";
            query["datosGenerales.localidad"] = "Roque Pérez";
        }else if(filtro == "navarro@motos"){
            query["finalidad.finalidad-tipo"] = "Vehiculo";
            query["finalidad.finalidad-vehiculo-tipo"] = "Moto";
            query["datosGenerales.localidad"] = "Navarro";
        }else if(filtro == "navarro@autos"){
            query["finalidad.finalidad-tipo"] = "Vehiculo";
            query["finalidad.finalidad-vehiculo-tipo"] = "Auto";
            query["datosGenerales.localidad"] = "Navarro";
        }
        
        let creditos = await CreditoPersonal.find(query)
        .sort(orden == "Mas reciente" ? {createdAt: -1} : orden == "Alfabético" ? {"datosGenerales.nombre": 1} : {proximoVencimiento: 1})
        .limit(limite)
        .skip((pagina - 1) * limite)
        .lean();

        res.status(200).json(creditos);
    }catch(e){
        console.error(e);
        res.status(500).end(e.toString());
    }
}
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

module.exports = {
    vista,
    listarCreditosPersonales,
    guardarCreditoPersonalDatosGenerales,
    guardarCreditoPersonalFinalidad,    
    eliminarCreditoPersonal,

    generarCuotas,
    upsertCuota,
    eliminarCuota,

    acreditarCobro,
    eliminarCobro,

    generarRecibo,
    obtenerRecibo
}