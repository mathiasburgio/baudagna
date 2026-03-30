const rateLimit = require("express-rate-limit");
const multer = require("multer");
const path = require("path")
const fs = require("fs");
//cacheo accesos a process.env
const EMAIL_SUPER_ADMIN = process.env.EMAIL_SUPER_ADMIN;
const MULTER_UPLOAD_SIZE_LIMIT = parseInt( process.env.MULTER_UPLOAD_SIZE_LIMIT || "2097152" ); //2mb por defecto

const file403 = path.join(__dirname, "..", "views", "html", "403.html");
/*
	levels= 
	0 visitante - no inicio sesion
	1 usuario normal -inicio sesion
	2 usuario administrador - inicio sesion y es administrador de su suscripcion
	3 super usuario - administrador del cloud (mathias)
*/
const verificarPermisos = ({level=0, permiso=null, responseType="html"}) => {
	return (req, res, next)=>{
		//console.log(req.session.data, level, permiso)
		if(typeof level === "number"){//verifico q este completado el parametro nivel
			if(level === 3){//super-admin (mathias)
				if(responseType === "html"){
					if(req?.session?.data?.usuarioEmail != EMAIL_SUPER_ADMIN) return res.status(403).sendFile( file403 );
				}else{
					if(req?.session?.data?.usuarioEmail != EMAIL_SUPER_ADMIN) return res.status(403).json({error: "No tienes permisos para realizar esta acción"});
				}
			}else if(level === 2){//usuario-admin
				if( req.session?.data?.esAdmin !== true ) {
					if(responseType === "html"){
						return res.status(403).sendFile( file403 );
					}else{
						return res.status(403).json({error: "No tienes permisos para realizar esta acción"});
					}
				}
			}else if(level === 1){//usuario-logueado
				if( !(req.session?.data) ){
					if(responseType === "html"){
						return res.status(403).sendFile( file403 );
					}else{
						return res.status(403).json({error: "No tienes permisos para realizar esta acción"});
					}
				}
			}else{
				//level 0 no valida nada
			}
		}
		
		if(permiso){
			let permisos = req.session?.data?.permisos || [];
			if(Array.isArray(permisos) == false){
				if(responseType === "html"){
					return res.status(403).sendFile( file403 );
				}else{
					return res.status(403).json({error: "No tienes permisos para realizar esta acción"});
				}
			}
			if(permisos.includes("*") == false && permisos.includes(permiso) == false){
				if(responseType === "html"){
					return res.status(403).sendFile( file403 );
				}else{
					return res.status(403).json({error: "No tienes permisos para realizar esta acción"});
				}
			}
		}
		next();
	}
}

// Configuración de Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Directorio donde se guardarán los archivos
        cb(null, 'uploads/temp/');
    },
    filename: (req, file, cb) => {
        // Cambiar el nombre del archivo
        const timestamp = Date.now(); // Agregar un timestamp para evitar duplicados
        const ext = path.extname(file.originalname); // Obtener la extensión original
        cb(null, `file-${timestamp}${ext}`); // Ejemplo: file-1631548971234.jpg
    },
});
const upload = multer({
	storage,
	limits: { fileSize: MULTER_UPLOAD_SIZE_LIMIT } // 2 MB por defecto
});

const createRateLimit = (limit=3, minutes=5, message='Demaciados intentos. Intenta nuevamente en unos minutos.') => {
	return rateLimit({
		windowMs: minutes * 60 * 1000, // 5 minutes
		limit: limit,
		message: message,
		standardHeaders: 'draft-7', 
		legacyHeaders: false, 
		handler: (req, res, next) => {
			console.warn(
				`[${new Date().toISOString()}] RATE LIMIT → ${req.method} ${req.originalUrl} - IP: ${req.ip}`
			);
			res.status(429).json({ message });
		}
		// store: ... , // Redis, Memcached, etc. See below.
	})
};

module.exports = {
	verificarPermisos,
	createRateLimit,
	upload
}