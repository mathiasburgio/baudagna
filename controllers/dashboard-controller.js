const fs = require("fs");
const path = require("path");

function vista(req, res){
    res.status(200).render( "../views/layouts/dashboard.ejs", { title: "Dashboard", page: "../pages/dashboard-home.ejs" });
}

module.exports = {
    vista,
}