class DashboardConfiguracion{
    constructor(initHTML=true){
        this.imagine = null;
        if(initHTML) this.initHTML();
    }
    async initHTML(){
        await boilerplate(true);
        
        for(let prop in primordial.configuracion){
            let val = primordial.configuracion[prop]
            let ele = $("[datos] [name='" + prop + "']")
            if(ele.length == 1) ele.val(val)
            if( ele.attr("type") == "checkbox" ) ele.prop("checked", utils.getBoolean(val))
        }
        /* //cargo todos los campos
        

        this.imagine = new Imagine({
            container: $("[name='imagen']"),
            defaultImage: "/resources/sin-imagen.jpg",
            callback: async img => {
                let ret = await utils.uploadFile("/emprendimiento/subir-imagen", img.posProcessing);
                this.imagine.setImagePath("/uploads/images/" + ret);
            }
        });

        if(primordial.emprendimiento.configuracion.imagen){
            dashboardConfiguracion.imagine.setImagePath(primordial.emprendimiento.configuracion.imagen);
        }

         */

        $("[name='guardar']").on("click", ev=>{
            this.guardar()
        })
        menu.hideCortina();
    }
    async guardar(){
        
        let obj = {};
        $("[datos] [name]").each((ind, ev)=>{
            let ele = $(ev)
            let n = ele.attr("name")
            let v = ele.val()
            if( ele.attr("type") == "checkbox" ) v = ele.prop("checked")
            obj[n] = v;
        });  

        console.log(obj)
        await modal.waiting("Guardando...", async ()=>{
            try{
                let ret = await $.post({
                    url: "/dashboard/guardar-configuracion",
                    data: { ...obj }
                })
                
                console.log(ret);
                primordial.configuracion = ret;
                
                menu.toast({level: "success", title: "Configuración", message: "Configuración guardad con éxito"})
            }catch(err){
                menu.toast({level: "danger", title: "Configuración", message: err.responseText})
            }
        });
        
    }
}