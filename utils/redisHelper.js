/*
redis keys
empId:{eid}
empId:{eid}:usuario:{uid}
empId:{eid}:stocks        HASH (productoId-0) (productoId-variacionId)
empId:{eid}:prods         HASH (productoId: json completo)
empId:{eid}:contador:{llave}


empId:{eid}:contador:comandas_mostrador_pendientes //graba la cantidad de comandas a mostrador/app sin procesar (max 100)
empId:{eid}:contador:aceptar_pedidos_app //1= acepta 0= no acepta pedidos por app


*/


const { createClient } = require("redis");
let connected = false;

if(!process.env.REDIS_URI) throw "No se encontró la variable de entorno REDIS_URI. Por favor, configúrala en tu archivo .env";

const client = createClient({
  url: process.env.REDIS_URI // IP de tu server Redis
});

client.on("error", err =>{
  console.error("Redis error:", err)
  connected = false;
});

client.on("end", ()=>{
  console.warn("Redis connection closed");
  connected = false;
});

client.on("ready", ()=>{
  console.log("Redis connected successfully");
  connected = true;
});

client.connect();


module.exports = { 
  client, //instancia del cliente Redis
  isConnected: () => connected, //flag para saber si esta conectado
};