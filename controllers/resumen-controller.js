const CreditoPersonal = require("../models/credito-personal-model");
const utils = require("../utils/utils");
const {FechasTemporal} = require("../utils/FechasTemporal");

function vista(req, res){
    res.status(200).render( 
        "../views/layouts/dashboard.ejs", 
        { page: "../pages/dashboard-resumen.ejs", title: "Resumen" }
    );
}

async function obtenerResumen(req, res){
    try{
        let anioMes = req.query.anioMes;

        let t0 = performance.now();
        //lo q empieza con "_" es para el mes actual. 
        let respCreditos = {
            cantidad: 0,
            _cantidad: 0,
        };
        let respCuotas = {
            cantidad: 0,
            _cantidad: 0,

            monto: 0,
            _monto: 0,
            montoCapital: 0,
            _montoCapital: 0,
            montoInteres: 0,
            _montoInteres: 0,
        };
        let respCobros = {
            cantidad: 0,
            _cantidad: 0,

            montoCuotas: 0,
            _montoCuotas: 0,
            montoPunitorios: 0,
            _montoPunitorios: 0,
        };

        let creditos = await CreditoPersonal.find({eliminado: false}).lean();
        creditos.forEach(credito => {
            try{
                respCreditos.cantidad++;
                let fechaCreacion = FechasTemporal.toString(credito.createdAt).split("T")[0];
                if(fechaCreacion.startsWith(anioMes)){
                    respCreditos._cantidad++;
                }
                credito.cuotas.forEach(cuota=>{
                    if(cuota.eliminado) return;
                    let fx = FechasTemporal.toString(cuota.vencimiento).split("T")[0];
                    respCuotas.cantidad++;

                    respCuotas.monto += cuota.monto || 0;
                    respCuotas.montoCapital += cuota.montoCapital || 0;
                    respCuotas.montoInteres += cuota.montoInteres || 0;
                    
                    //este mes
                    if(fx.startsWith(anioMes)){
                        respCuotas._cantidad++;
                        respCuotas._monto += cuota.monto || 0;
                        respCuotas._montoCapital += cuota.montoCapital || 0;
                        respCuotas._montoInteres += cuota.montoInteres || 0;
                    }
                });
                
                credito.cobros.forEach(cobro=>{
                    if(cobro.eliminado) return;
                    let fx = FechasTemporal.toString(cobro.vencimiento).split("T")[0];
                    respCobros.cantidad++;

                    respCobros.montoCuotas += cobro.montoCuota || 0;
                    respCobros.montoPunitorios += cobro.montoPunitorios || 0;

                    //este mes
                    if(fx.startsWith(anioMes)){
                        respCobros._cantidad++;

                        respCobros._montoCuotas += cobro.montoCuota || 0;
                        respCobros._montoPunitorios += cobro.montoPunitorios || 0;
                    }
                });
            }catch(e){
                console.log("Error resumen credito ", credito._id, e);
            }
        });

        let t1 = performance.now();
        let time = (t1 - t0).toFixed(2);
        res.status(200).json({respCreditos, respCuotas, respCobros, time});
    }catch(e){
    
    }
}


module.exports = {
    vista,
    obtenerResumen
}