const CreditoPersonal = require("../models/credito-personal-model");
const utils = require("../utils/utils");
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

        let creditos = await CreditoPersonal.find({eliminado: false})
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
        let credito = await CreditoPersonal.findOne({_id: creditoId});
        if(!credito) throw "Crédito no encontrado";
        if(credito.cobros.length > 0) throw "No se pueden generar cuotas para un crédito con cobros registrados";
        
        credito.cuotas = cuotas;//las cuotas ya generadas en front
        credito.generadorCuotas = generadorCuotas; //el objeto completo
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
        cuota.eliminado = true;
        await credito.save();
        res.status(200).json(credito);
    }catch(e){
        console.error(e);
        res.status(500).end(e.toString());
    }
}
//COBROS

module.exports = {
    vista,
    listarCreditosPersonales,
    guardarCreditoPersonalDatosGenerales,
    guardarCreditoPersonalFinalidad,    
    eliminarCreditoPersonal,

    generarCuotas,
    upsertCuota,
    eliminarCuota,
}