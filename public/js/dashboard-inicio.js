class DashboardInicio{
    constructor(initHTML=true){
        this.timerGeneral = null;
        if(initHTML) this.initHTML();
    }
    async initHTML(){
        await boilerplate(true);
        $("[goto]").on("click", ev=>{
            let ele = $(ev.currentTarget);
            let goto = ele.attr("goto");
            if(goto.startsWith("/")){
                //esto es una ruta interna de la app
                window.location.href = goto;
            }else{
                //esto es una ruta externa
                let w = window.open(goto, "_blank");
            }
        });

        $("[name='btn-abonar']").on("click", async ev=>{
            this.modalAbonar();
        })
        
        $("[name='btn-compartir-app-pedidos']").on("click", ev=>{
            //primordial.emprendimiento.nombre
            let text = `Te comparto la app para que puedas ver nuestros menues y realizar pedidos.\n${window.location.origin}/app-pedidos/${primordial.emprendimiento.eid}` ;
            let w = window.open("https://wa.me/?text=" + encodeURI(text), "_blank");
        });
        
        menu.hideCortina();
    }
}