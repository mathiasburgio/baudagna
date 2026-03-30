const express = require("express");
const router = express.Router();
const cajasController = require("../controllers/cajas-controller");
const middlewares = require("../utils/middlewares");

router.get("/dashboard/cajas",
    middlewares.verificarPermisos({level: 1}),
    cajasController.vista);

module.exports = router;