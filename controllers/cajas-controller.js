const utils = require("../utils/utils");
const CreditoPersonal = require("../models/credito-personal-model");

function vista(req, res){
    res.status(200).render( "../views/layouts/dashboard.ejs", { title: "Cajas", page: "../pages/cajas.ejs" });
}

module.exports = {
    vista,
}