const Usuario = require("../models/usuario-model.js");
const utils = require("../utils/utils.js");
const fechas = require("../utils/fechas.js");

async function vista(req, res){
    res.status(200).render( "../views/layouts/dashboard.ejs", { title: "Usuarios", page: "../pages/dashboard-usuarios.ejs" });
}
async function registrarUsuario(req, res){
    try{
        let { email, contrasena, permisos } = req.body;
        if(!email || !contrasena) return res.status(400).send("Email y contraseña son requeridos");
        email = email.trim().toLowerCase();
        let usuarioExistente = await Usuario.findOne({email: email, eliminado: {$ne: true}});
        if(usuarioExistente) return res.status(400).send("Ya existe un usuario registrado con ese email");
        let nuevoUsuario = new Usuario({
            email: email,
            contrasena: await utils.getPasswordHash(contrasena),
            permisos: permisos || [],
        });
        await nuevoUsuario.save();
        res.status(200).json(nuevoUsuario);
    }catch(e){
        console.log(e);
        res.status(500).send("Error al registrar el usuario. " + e.message);
    }
}
async function editarUsuario(req, res){
    try{
        let { usuarioId, email, contrasena, permisos } = req.body;
        let updateData = {};
        if(email) updateData.email = email.trim().toLowerCase();
        if(contrasena) updateData.contrasena = await utils.getPasswordHash(contrasena);
        if(permisos) updateData.permisos = permisos;

        let usuario = await Usuario.findOneAndUpdate(
            {_id: usuarioId}, 
            updateData, 
            {returnDocument: "after"}
        );
        res.status(200).json(usuario);
    }catch(e){
        console.log(e);
        res.status(500).send("Error al editar el usuario. " + e.message);
    }
}
async function eliminarUsuario(req, res){
    try{
        let { usuarioId } = req.body;
        let usuario = await Usuario
            .findOneAndUpdate({_id: usuarioId}, {eliminado: true});
        console.log(`Usuario ${usuario.email} eliminado`);
        res.status(200).end("ok");
    }catch(e){
        console.log(e);
        res.status(500).send("Error al eliminar el usuario. " + e.message);
    }
}
async function listarUsuarios(req, res){
    try{
        let usuarios = await Usuario
            .find({eliminado: {$ne: true}})
            .select("-contrasena").lean();
        res.status(200).json(usuarios);
    }catch(e){
        console.log(e);
        res.status(500).send("Error al listar los usuarios. " + e.message);
    }
}
async function iniciarSesion(req, res){
    try{
        let {email, contrasena} = req.body;
        email = email.trim().toLowerCase();
        let usuario = await Usuario.findOne({email: email, eliminado: {$ne: true}});
        if(!usuario) return res.status(400).send("Usuario no encontrado");
        let verificarContrasena = await utils.comparePasswordHash(contrasena, usuario.contrasena);
        if(!verificarContrasena) return res.status(400).send("Contraseña incorrecta");

        req.session.data = {
            usuarioId: usuario._id,
            email: usuario.email,
            permisos: usuario.permisos,
        };
        req.session.save();

        res.status(200).end("ok");
    }catch(e){
        console.log(e);
        res.status(500).send("Error al iniciar sesión. " + e.message);
    }
}
async function cerrarSesion(req, res){
    try{
        req.session.destroy();
        if(req.method === 'GET') return res.redirect("/");
        else return res.status(200).end("ok");
    }catch(e){
        console.log(e);
    }
}
async function crearSuperAdmin(){
    try{
        let email = process.env.EMAIL_SUPER_ADMIN;
        let contrasena = "123456789";
        let usuarioExistente = await Usuario.findOne({email: email, eliminado: {$ne: true}});
        if(usuarioExistente) return console.log(`Error al crear super admin. Usuario con email ${email} ya existe.`);
        let nuevoUsuario = new Usuario({
            email: email,
            contrasena: await utils.getPasswordHash(contrasena),
            permisos: ["*"],
        });
        await nuevoUsuario.save();
        return console.log(`Super admin creado con email ${email}`);
    }
    catch(e){
        return console.log(`Error al crear el super admin. ${e.message}`);
    }
}
module.exports = {
    vista,
    registrarUsuario,
    editarUsuario, 
    eliminarUsuario,
    listarUsuarios,
    iniciarSesion,
    cerrarSesion,
    crearSuperAdmin,
}