const path = require('path');
const fs = require('fs');
let conf = {};
async function vista(req, res){
    res.status(200).render( 
        "../views/layouts/dashboard.ejs", 
        { page: "../pages/dashboard-configuracion.ejs", title: "Configuración" }
    );
}
async function loadConfiguracion(req, res){
    try{
        let aux = fs.readFileSync(path.join(__dirname, "../configuracion.json"), "utf-8");
        conf = JSON.parse(aux);
        if(res) return res.status(200).json({ok: true, configuracion: conf});
        return conf;
    }catch(e){
        if(res) return res.status(500).send("Error al cargar la configuración");
        return null;
    }
}
async function getConfiguracion(req, res){
    try{
        if(Object.keys(conf).length == 0) await loadConfiguracion();
        if(res) return res.status(200).json({ok: true, configuracion: conf});
        return conf;
    }catch(e){
        if(res) return res.status(500).send("Error al obtener la configuración");
        return null;
    }
}
//puede venir del front o internamente (si es q trae data)
//IMPORTANTE: Si viene del front data se completara con la funcion next() de express!!!
async function updateConfiguracion(req, res, data = null){
    try{
        console.log(typeof req, typeof res, typeof data)
        if(typeof data != "function"){ //evaluo si el parametro data es la función next() de express, si no lo es, entonces viene data con la configuración a actualizar 
            for(let key in data){
                conf[key] = data[key];
            }
            fs.writeFileSync(path.join(__dirname, "../configuracion.json"), JSON.stringify(conf, null, 4), "utf-8");
        }else{
            for(let key in req.body){
                conf[key] = req.body[key];
            }
            console.log(conf);
            fs.writeFileSync(path.join(__dirname, "../configuracion.json"), JSON.stringify(conf, null, 4), "utf-8");
            if(res) return res.status(200).json({ok: true, configuracion: conf});
            return conf;
        }
    }catch(e){
        if(res) return res.status(500).send("Error al actualizar la configuración");
        return null;
    }
}

module.exports = {
    vista,
    loadConfiguracion,
    getConfiguracion,
    updateConfiguracion,
}