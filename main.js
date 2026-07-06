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
const utils = require("./utils/utils")
const fs = require("fs");
const compression = require("compression");
const helmet = require("helmet");
const middlewares = require("./utils/middlewares.js");

//contador -> gestiona numeros en el sistema. Ej numero de credito, numero de recivo, etc
const Contador = require("./models/contador-model.js");

//configuracion -> gestiona parametros globales del sistema. Ej usuarios, cajas, etc
if(!fs.existsSync(path.join(__dirname, "configuracion.json"))) throw "Falta el archivo de configuracion, renombrar configuracion.json.example a configuracion.json y completarlo con los datos de la empresa y del sistema";
let configuracion = JSON.parse(fs.readFileSync(path.join(__dirname, "configuracion.json")));

require('dotenv').config();
if(process.env.NODE_ENV != "development") app.set('trust proxy', 2);

//sessions
app.use(session({
    secret: process.env?.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true, //renueva la cookie de sesion cada vez que se hace una peticion
    cookie: {
        maxAge : Number(process.env?.SESSION_MAXAGE) || (1000 * 60 * 60 * 24 * 365),//365 días
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
app.use("/html", express.static( path.join(__dirname, "/views/html") ));
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
    console.log("Base de datos conectada");
});

//middlewares
app.use((req, res, next)=>{
    //completar aquí con el script que recupere la informacion primordial para el uso del sistema.
    req.getPrimordial = async (req) => {
        let clon = JSON.parse(JSON.stringify(configuracion));
        clon.usuarios.forEach(u=>{
            delete u.contrasena;
        });
        return clon;
    }
    req.getContador = async (llave) => {
        let aux = await Contador.findOne({llave});
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
app.use( require("./routes/creditos-personales-routes") );

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

app.post("/login", 
    middlewares.createRateLimit(20, 1),
    (req, res)=>{
    let {email, contrasena} = req.body;
    let encontro = false;
    configuracion.usuarios.forEach(u=>{
        if(encontro) return;
        if(u.email == email && u.contrasena == contrasena){
            encontro = true;
            req.session.data = {};
            req.session.data.usuario = {};
            for(let key in u){
                if(key == "contrasena") continue;
                req.session.data.usuario[key] = u[key];
            }
            req.session.save();
            res.status(200).json({ok: true});
        }
    });
    if(!encontro) res.status(403).json({ok: false, error: "Usuario o contraseña incorrectos"});
});

app.get("/logout",(req, res)=>{
    req.session.destroy();
    res.redirect("/");
});
app.post("/logout",(req, res)=>{
    req.session.destroy();
    res.status(200).json({ok: true});
});

//retorna informacion basica para el uso general. Ej fecha, permisos de usuario, configuracion general
app.get("/primordial", 
    middlewares.createRateLimit(20, 1),
    middlewares.verificarPermisos({level: 1, responseType: "json"}),
    async (req, res)=>{
    let resp = await req.getPrimordial(req);
    res.status(200).json(resp);
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
    console.log(" baudagna -> Escuchando en http://localhost:" + process.env.PORT)
})