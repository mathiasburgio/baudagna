const utils = require("../utils/utils");
const fechas = require("../utils/fechas");
const fs = require("fs");
const path = require("path");
const Archivo = require("../models/archivo-model");

async function subirArchivo(req, res){
    try{
        let archivo = req.file;
        if(!archivo) return res.status(400).send("No se ha subido ningún archivo");
        let nuevoArchivo = new Archivo({
            nombreOriginal: archivo.originalname,
            nombreNuevo: archivo.filename,
            fecha: new Date(),
            tamano: archivo.size,
            extension: path.extname(archivo.originalname),
            eliminado: false,
        });
        await nuevoArchivo.save();
        res.status(200).json(nuevoArchivo);
    }catch(e){
        console.log(e);
        res.status(500).send("Error al subir el archivo. " + e.message);
    }
}
async function eliminarArchivo(req, res){
    try{
        let { archivoId } = req.body;
        let archivo = await Archivo.findOneAndUpdate({ _id: archivoId }, { eliminado: true }, { new: true });
        if(!archivo) return res.status(404).send("Archivo no encontrado");
        res.status(200).end("ok");
    }catch(e){
        console.log(e);
        res.status(500).send("Error al eliminar el archivo. " + e.message);
    }
}
async function listarArchivos(req, res){
    try{
        let { pagina } = req.query;
        pagina = pagina || 1; 
        let paginaSize = 20;
        let archivos = await Archivo.find({ eliminado: { $ne: true } })
            .sort({ fecha: -1 })
            .skip( (pagina - 1) * paginaSize )
            .limit(paginaSize).lean(); 
        res.status(200).json(archivos);
    }catch(e){
        console.log(e);
        res.status(500).send("Error al listar los archivos. " + e.message);
    }
}

//no utilizar esta funcion, mejor renombrar el el credito al cual esta adjunto
async function renombrarArchivo(req, res){
    try{
        let { archivoId, nuevoNombre } = req.body;
        let archivo = await Archivo.findOneAndUpdate({ _id: archivoId }, { nombreNuevo: nuevoNombre }, { new: true });
        if(!archivo) return res.status(404).send("Archivo no encontrado");
        res.status(200).json(archivo);
    }catch(e){
        console.log(e);
        res.status(500).send("Error al renombrar el archivo. " + e.message);
    }
}

module.exports = {
    subirArchivo,
    eliminarArchivo,
    listarArchivos,
    renombrarArchivo,
}