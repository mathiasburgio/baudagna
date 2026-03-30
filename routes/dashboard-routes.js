const express = require("express");
const router = express.Router();
const dashboardController = require("../controllers/dashboard-controller");
const middlewares = require("../utils/middlewares");

router.get("/dashboard",
    middlewares.verificarPermisos({level: 1}),
    dashboardController.vista);

module.exports = router;