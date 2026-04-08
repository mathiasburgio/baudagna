const express = require("express");
const router = express.Router();
const resumenController = require("../controllers/resumen-controller");
const middlewares = require("../utils/middlewares");

router.get("/dashboard/resumen",
    middlewares.verificarPermisos({level: 1}),
    resumenController.vista);

router.get("/dashboard/resumen/obtener-resumen",
    middlewares.verificarPermisos({level: 1}),
    resumenController.obtenerResumen);

module.exports = router;