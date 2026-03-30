const express = require("express");
const router = express.Router();
const usuariosController = require("../controllers/usuarios-controller");
const middlewares = require("../utils/middlewares");

router.post("/usuarios/registrar",
    middlewares.verificarPermisos({level: 1, responseType: "json"}),
    usuariosController.registrarUsuario);

router.post("/usuarios/iniciar-sesion", 
    middlewares.createRateLimit(10, 1), // limitar a 10 intentos por minuto para evitar ataques de fuerza bruta
    usuariosController.iniciarSesion);

router.get("/usuarios/cerrar-sesion",
    usuariosController.cerrarSesion);

router.get("/dashboard/usuarios",
    middlewares.verificarPermisos({level: 1}),
    usuariosController.vista);

router.post("/dashboard/usuarios/editar",
    middlewares.verificarPermisos({level: 1, responseType: "json"}),
    usuariosController.editarUsuario);

router.post("/dashboard/usuarios/eliminar",
    middlewares.verificarPermisos({level: 1, responseType: "json"}),
    usuariosController.eliminarUsuario);

router.get("/dashboard/usuarios/listar",
    middlewares.verificarPermisos({level: 1, responseType: "json"}),
    usuariosController.listarUsuarios);



module.exports = router;