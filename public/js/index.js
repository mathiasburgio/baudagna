var modal = new Modal();
var utils = new Utils();



window.onload = () => {
    let recordar = localStorage.getItem("recordar-credenciales-baudagna");
    if(recordar){
        recordar = JSON.parse(recordar);
        $("#email").val(recordar.email);
        $("#contrasena").val(recordar.contrasena);
        $("#recordar").prop("checked", true);
    }

    $("#iniciar-sesion").on("click", async ev=>{
        $(ev.currentTarget).attr("disabled", true);
        await iniciarSesion();
        $(ev.currentTarget).attr("disabled", false);
    });
}
async function iniciarSesion(){
    try{
        const email = $("#email").val();
        const contrasena = $("#contrasena").val();

        //intento iniciar
        let resp = await $.post({
            url: "/usuarios/iniciar-sesion",
            data: { email, contrasena },
        });
        console.log(resp);

        //grabo credenciales localmente
        if($("#recordar").is(":checked")){
            localStorage.setItem("recordar-credenciales-baudagna", JSON.stringify({ email, contrasena }));
        }else{
            localStorage.removeItem("recordar-credenciales-baudagna");
        }

        //redirecciono a dashboard
        if(resp == "ok") setTimeout(() => window.location.href = "/dashboard", 500);
        else return modal.message(resp?.responseText || resp.toString());

        
    }catch(err){
        modal.message(err?.responseText || err.toString());
    }
}