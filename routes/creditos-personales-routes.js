const express = require("express");
const router = express.Router();
const creditosPersonalesController = require("../controllers/creditos-personales-controller");
const middlewares = require("../utils/middlewares");

router.get("/creditos-personales",
    middlewares.verificarPermisos({level: 1}),
    creditosPersonalesController.html);

router.get("/creditos-personales/listado",
    middlewares.verificarPermisos({level: 1}),
    creditosPersonalesController.listado);

router.get("/creditos-personales/obtener-credito/:creditoId",
    middlewares.verificarPermisos({level: 1}),
    creditosPersonalesController.obtenerCredito);

router.post("/creditos-personales/nuevo",
    middlewares.verificarPermisos({level: 1}),
    creditosPersonalesController.nuevo);

router.post("/creditos-personales/modificar",
    middlewares.verificarPermisos({level: 1}),
    creditosPersonalesController.modificar);

router.post("/creditos-personales/eliminar",
    middlewares.verificarPermisos({level: 1}),
    creditosPersonalesController.eliminar);

router.post("/creditos-personales/asignar-cuotas",
    middlewares.verificarPermisos({level: 1}),
    creditosPersonalesController.asignarCuotas);

router.post("/creditos-personales/modificar-cuota",
    middlewares.verificarPermisos({level: 1}),
    creditosPersonalesController.modificarCuota);

router.post("/creditos-personales/eliminar-cuota",
    middlewares.verificarPermisos({level: 1}),
    creditosPersonalesController.eliminarCuota);

router.post("/creditos-personales/cobrar-cuota",
    middlewares.verificarPermisos({level: 1}),
    creditosPersonalesController.cobrarCuota);

module.exports = router;