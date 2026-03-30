const http = require("http");
const express = require("express")
const app = express();
const session = require("express-session");
const MongoStore = require('connect-mongo').default;
const bodyParser = require("body-parser");
const { connectDB, checkDatabase } = require('./utils/db');
const path = require("path");
const cors = require("cors");
const favicon = require('serve-favicon');
const fechas = require("./utils/fechas.js");
const utils = require("./utils/utils")
const fs = require("fs");
const compression = require("compression");
const helmet = require("helmet");
const middlewares = require("./utils/middlewares.js");

//controllers
const usuariosController = require("./controllers/usuarios-controller.js");
const Contador = require("./models/contador-model.js");
const configuracionController = require("./controllers/configuracion-controller.js");

require('dotenv').config();
if(process.env.NODE_ENV != "development") app.set('trust proxy', 2);

//sessions
app.use(session({
    secret: process.env?.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true, //renueva la cookie de sesion cada vez que se hace una peticion
    cookie: {
        maxAge : Number(process.env?.SESSION_MAXAGE) || (1000 * 60 * 60 * 24 * 5),//5 días
        sameSite: "lax",
        secure : (process.env.NODE_ENV === 'production') // true ssl
    },
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URI + "_sessions" })
}));

//seguridad
app.use(helmet({
    contentSecurityPolicy: false // si no querés romper scripts inline por ahora
}));

//favicon
app.use( favicon(__dirname + "/public/resources/branding/favicon.png") );

//compresion
app.use(compression({
    level: 6, // buen balance CPU / tamaño
    filter: (req, res) => {

        // 🔹 Si el cliente pide explícitamente no-comprimir
        if (req.headers['x-no-compression']) return false;

        const type = res.getHeader('Content-Type');

        if (!type) return false;

        // 🔹 NO comprimir estos tipos
        if (
            type.startsWith("image/") ||
            type.startsWith("audio/") ||
            type.startsWith("video/") ||
            type === "application/pdf" ||
            type === "application/octet-stream"
        ) return false;

        // 🔹 Comprimir solo tipos útiles
        return (
            type.includes("text") ||
            type.includes("json") ||
            type.includes("javascript") ||
            type.includes("css") ||
            type.includes("html")
        );
    }
}));



//limite bodyparser
app.use(bodyParser.json({ limit: '3mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '3mb' }));

//verifico conexion a la base de datos antes de procesar cualquier ruta
app.use(checkDatabase);

//Crea las carpetas neecesarias para el sistema
let directories = [
    path.join(__dirname, "dump"),
    path.join(__dirname, "uploads"),
    path.join(__dirname, "uploads", "temp"),
    path.join(__dirname, "uploads", "images"),
    path.join(__dirname, "uploads", "afip"),
    path.join(__dirname, "uploads", "backups"),
    path.join(__dirname, "uploads", "public"), //para subir desde admin y tener acceso genera
    path.join(__dirname, "uploads", "private"), //para subir desde admin pero solo el admin puede interactuar
    path.join(__dirname, "public-images"),
];
directories.forEach(directory=>{
    if(fs.existsSync(directory) == false) fs.mkdirSync( directory )
})

//cors
if(process.env?.CORS === "true") app.use(cors());

//motor de templates
app.set("view engine", "ejs");

//archivos estaticos
app.use("/css", express.static( path.join(__dirname, "/public/css") ));
app.use("/js", express.static( path.join(__dirname + "/public/js") ));
app.use("/resources", express.static( path.join(__dirname + "/public/resources") ));
app.use("/printables", express.static( path.join(__dirname + "/views/printables") ));
app.use("/public-images", express.static( path.join(__dirname + "/public-images") ));
app.use("/uploads/images", express.static( path.join(__dirname + "/uploads/images") ));
app.use("/uploads/public", express.static( path.join(__dirname + "/uploads/public") ));


//rate limit global
app.use(middlewares.createRateLimit(300, 1));

//conectoDB
connectDB().then(()=>{
    usuariosController.crearSuperAdmin(); //crea el super admin si no existe
    console.log("Base de datos conectada");
});

//middlewares
app.use((req, res, next)=>{
    //completar aquí con el script que recupere la informacion primordial para el uso del sistema.
    req.getPrimordial = async (req) => {
        
        let usuario = req.session?.data?.usuario || null;
        let configuracion = await configuracionController.getConfiguracion(); //tambien contiene vencimiento del sistema
        
        let data = {
            time: new Date().getTime(),
            fx: fechas.getNow(true),
            vencimiento: "2026-10-30",
            usuarioId: req.session?.data?.usuarioId || null,
            usuarioEmail: req.session?.data?.email || null,
            permisos: req.session?.data?.permisos || null,
            configuracion: configuracion,
        };
        return data;
    }
    req.getContador = async (llave) => {
        let aux = Contador.findOne({llave});
        return aux.valor;
    }
    req.setContador = async (llave, valor="incr") => {
        let nuevoValor = null;
        if(valor ==  "incr"){
            let aux = await Contador.findOneAndUpdate(
                { llave: llave },
                { $inc: { valor: 1 } },
                { new: true, upsert: true }
            );
            nuevoValor = aux.valor;
        }else if(valor == "decr"){
            let aux = await Contador.findOneAndUpdate(
                { llave: llave },
                { $inc: { valor: -1 } },
                { new: true, upsert: true }
            );
            nuevoValor = aux.valor;
        }else{
            let aux = await Contador.findOneAndUpdate(
                { llave: llave },
                { valor: valor },
                { new: true, upsert: true }
            );
            nuevoValor = aux.valor;
        }
        return nuevoValor;
    }
    next();
});

//routes
app.use( require("./routes/usuarios-routes") );
app.use( require("./routes/dashboard-routes") );
app.use( require("./routes/creditos-personales-routes") );
app.use( require("./routes/configuracion-routes") );
//app.use( require("./routes/cajas-routes") );

//ping para control
app.get("/ping", 
    middlewares.createRateLimit(20, 1),
    (req, res)=>{
    res.send("pong");
    res.end();
})

//manejo de index
app.get("/", 
    middlewares.createRateLimit(20, 1),
    (req, res)=>{
    const index = path.join(__dirname, "views", "html", "index.html");
    res.status(200).sendFile(index);
})

//retorna informacion basica para el uso general. Ej fecha, permisos de usuario, configuracion general
app.get("/primordial", 
    middlewares.createRateLimit(20, 1),
    middlewares.verificarPermisos({level: 1, responseType: "json"}),
    async (req, res)=>{
    let resp = await req.getPrimordial(req);
    res.status(200).json(resp);
})

app.get("/terminos-y-condiciones", 
    middlewares.createRateLimit(20, 1),
    (req, res)=>{
    res.sendFile( path.join(__dirname, "views", "html", "terminos-y-condiciones.html") );
})
app.get("/politicas-de-privacidad", 
    middlewares.createRateLimit(20, 1),
    (req, res)=>{
    res.sendFile( path.join(__dirname, "views", "html", "politicas-de-privacidad.html") );
})

app.get("/403", (req, res)=>{
    res.status(403).sendFile( path.join(__dirname, "views", "html", "403.html") );
})

//manejo de 404
app.use((req, res, next) => {
    //res.status(404).send("Error 404 - Recurso no encontrado");
    res.status(404).sendFile(__dirname + "/views/html/404.html")
})


//inicio el servidor
//notese "server.list" y no "app.listen" (para q tambien corra el servidor de sockets)
app.listen(Number(process.env.PORT), async ()=>{
    let f = fechas.getNow(true);
    console.log( f + " baudagna -> Escuchando en http://localhost:" + process.env.PORT)
})