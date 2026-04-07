const express = require("express");
const router = express.Router();
const creditosPersonalesController = require("../controllers/creditos-personales-controller");
const middlewares = require("../utils/middlewares");

router.get("/dashboard/creditos-personales",
    middlewares.verificarPermisos({level: 1}),
    creditosPersonalesController.vista);

router.get("/dashboard/creditos-personales/listar",
    middlewares.verificarPermisos({level: 1, responseType: "json"}),
    creditosPersonalesController.listarCreditosPersonales);

router.post("/dashboard/creditos-personales/guardar-datos-generales",
    middlewares.verificarPermisos({level: 1, responseType: "json"}),
    creditosPersonalesController.guardarCreditoPersonalDatosGenerales);

router.post("/dashboard/creditos-personales/guardar-finalidad",
    middlewares.verificarPermisos({level: 1, responseType: "json"}),
    creditosPersonalesController.guardarCreditoPersonalFinalidad);

router.post("/dashboard/creditos-personales/eliminar-credito",
    middlewares.verificarPermisos({level: 1, responseType: "json"}),
    creditosPersonalesController.eliminarCreditoPersonal);

router.post("/dashboard/creditos-personales/generar-cuotas",
    middlewares.verificarPermisos({level: 1, responseType: "json"}),
    creditosPersonalesController.generarCuotas);

router.post("/dashboard/creditos-personales/upsert-cuota",
    middlewares.verificarPermisos({level: 1, responseType: "json"}),
    creditosPersonalesController.upsertCuota);

router.post("/dashboard/creditos-personales/eliminar-cuota",
    middlewares.verificarPermisos({level: 1, responseType: "json"}),
    creditosPersonalesController.eliminarCuota);

router.post("/dashboard/creditos-personales/acreditar-cobro",
    middlewares.verificarPermisos({level: 1, responseType: "json"}),
    creditosPersonalesController.acreditarCobro);

router.post("/dashboard/creditos-personales/eliminar-cobro",
    middlewares.verificarPermisos({level: 1, responseType: "json"}),
    creditosPersonalesController.eliminarCobro);


module.exports = router;