const express = require("express");
const router = express.Router();
const configuracionController = require("../controllers/configuracion-controller");
const middlewares = require("../utils/middlewares");

router.get("/dashboard/configuracion",
    middlewares.verificarPermisos({level: 1}),
    configuracionController.vista);

router.post("/dashboard/guardar-configuracion",
    middlewares.verificarPermisos({level: 1}),
    configuracionController.updateConfiguracion);

module.exports = router;