class DashboardUsuarios{
    //OK
    constructor(initHTML=true){
        this.permisos = [
            "menu.creditos-personales",
            "accion.editar-credito",
            "menu.resumen",
            "menu.usuarios",
            "accion.agregar-registro",
            "menu.configuracion",
        ];

        this.listadoUsuarios = [];
        this.listadoUsuariosClonado = JSON.parse(JSON.stringify([]));
        if(initHTML) this.initHTML();
        
    }
    //OK
    async initHTML(){
        await boilerplate(true);
        await this.obtenerUsuarios();

        this.listarUsuarios();

        $("[name='crear-usuario']").on("click", ev=>{
            this.crearUsuario();
        })

        setInterval(()=>{
            $(`[name='tabla-usuarios'] tbody tr [name='guardar']`).each((ind, ev)=>{
                let btn = $(ev);
                if(btn.attr("toggle-shine-button") == "true"){
                    btn.toggleClass("btn-success").toggleClass("btn-outline-success").prop("disabled", false);
                }else{
                    btn.removeClass("btn-success").addClass("btn-outline-success").prop("disabled", true);
                    btn.prop("disabled", true);
                }
            })
        }, 600);

        menu.setPageName("Usuarios");
        menu.hideCortina();
    }
    //OK
    async obtenerUsuarios(){
        let resp = await $.get({url: "/dashboard/usuarios/listar"});
        this.listadoUsuarios = resp;
        this.listadoUsuarios.sort((a, b)=>{
            if(a.esAdmin) return -1;
            if(b.esAdmin) return 1;
            return a.email?.localeCompare(b.email) || 0;
        });
        return resp;
    }
    //OK
    async crearUsuario(){
        //if(this.listadoUsuarios.length >= 10) return modal.message("Ha alcanzado el limite de usuarios permitidos para su emprendimiento.<br> Borre un usuario para poder crear uno nuevo, o bien contactenos para ampliar dicho límite");

        let email = await modal.prompt({label: "Email", type: "email"});
        if(!email) return;

        try{
            let usuario = await $.post({
                url:"/usuarios/registrar",
                data: { email, contrasena: "123456789" }
            });

            this.listadoUsuarios.push(usuario);
            this.listarUsuarios();
            menu.toast({level: "success", title: "Crear usuario", message: "Usuario creado con éxito"})
        }catch(err){
            console.log(err);
            menu.toast({level: "danger", title: "Crear usuario", message: err.responseText})
        }
        
    }
    //OK
    listarUsuarios(){
        let tbody = this.listadoUsuarios.map(usuario=>{
            return `<tr _id="${usuario._id}" es-admin="${usuario.esAdmin ? "true" : "false"}">
                <td>
                    <input type='text' class="form-control" autocomplete='off' name='email' value='${usuario.email}' readonly>
                </td>
                <td class="text-right">
                    <button class='btn btn-flat btn-warning mx-1' name='cambiar-contrasena'>Cambiar contraseña</button>
                    <button class='btn btn-flat btn-primary mx-1' name='permisos'>Permisos</button>
                    <button class='btn btn-flat btn-danger mx-1' name='eliminar'>Eliminar</button>
                </td>
            </tr>`;
        })
        $("[name='tabla-usuarios'] tbody").html(tbody);

        let tr0 = $("[name='tabla-usuarios'] tbody tr").first();
        tr0.find("[name='email']").val( "(admin) " + this.listadoUsuarios[0].email);
        tr0.find("button").prop("disabled", true);
        tr0.find("input").prop("disabled", true);
        tr0.find("[name='cambiar-contrasena']").prop("disabled", false);

        $("[name='tabla-usuarios'] tbody tr [name='cambiar-contrasena']").on("click", ev=>{
            let tr = $(ev.currentTarget).closest("tr");
            let _id = tr.attr("_id");
            let usuario = this.listadoUsuarios.find(ux=>ux._id == _id);
            this.modalCambiarContrasena(usuario);
        });

        $("[name='tabla-usuarios'] tbody tr [name='permisos']").on("click", ev=>{
            let row = $(ev.currentTarget).closest("tr");
            let _id = row.attr("_id");
            let usuario = this.listadoUsuarios.find(ux=>ux._id == _id);
            this.modalPermisos(usuario);
        })

        $("[name='tabla-usuarios'] tbody tr [name='eliminar']").on("click", ev=>{
            let row = $(ev.currentTarget).closest("tr");
            let _id = row.attr("_id");
            let usuario = this.listadoUsuarios.find(ux=>ux._id == _id);
            this.eliminarUsuario(usuario);
        })

        $("[name='usuarios-creados']").html(`Usuarios creados ${this.listadoUsuarios.length} de 10 disponibles`);
    }
    //OK
    modalPermisos(usuario){
        let _permisos = JSON.stringify(usuario.permisos);
        let fox = $("#modal-permisos").html();
        modal.show({
            title: "Permisos",
            body: fox,
            buttons: {color: "primary", text: "Aceptar", name: "dismiss"},
            onHidden: async () =>{
                let permisosActuales = JSON.stringify(usuario.permisos);
                if(permisosActuales == _permisos) return;//no hubo cambios

                let resp = await $.post({
                    url: "/dashboard/usuarios/editar",
                    data: { usuarioId: usuario._id, permisos: usuario.permisos },
                })
                console.log(resp);
                Object.assign(usuario, resp);
                menu.toast({level: "success", title: "Editar usuario", message: "Usuario modificado con éxito"})
            }
        });

        //add permissions
        let tbody = "";
        this.permisos.forEach(permiso=>{
            tbody += `<li p="${permiso}" class="list-group-item list-group-item-action cp ${usuario.permisos.includes(permiso) ? "bg-success" : ""}">
                <i class="mr-2 far fa-${usuario.permisos.includes(permiso) ? "circle-check" : "circle"}"></i>
                ${permiso}    
            </li>`
        })
        $("#modal ul").html(tbody);
        
        //bind click
        $("#modal ul li").click(ev=>{
            let permiso = $(ev.currentTarget).attr("p");
            if( usuario.permisos.includes(permiso) ){
                $(ev.currentTarget).removeClass("bg-success").find("i").removeClass("fa-circle-check").addClass("fa-circle");
                usuario.permisos = usuario.permisos.filter(p=>p != permiso);
            }else{
                $(ev.currentTarget).addClass("bg-success").find("i").addClass("fa-circle-check").removeClass("fa-circle");
                usuario.permisos.push(permiso);
            }
        });
    }
    //OK
    async eliminarUsuario(usuario){
        let resp = await modal.yesno(`¿Confirma eliminar el usuario ${usuario.email}?`);
        if(!resp) return;
        
        try{
            let ret = $.post({
                url: "/dashboard/usuarios/eliminar",
                data: { usuarioId: usuario._id }
            });
            
            //borro el usuario de las listas
            this.listadoUsuarios = this.listadoUsuarios.filter(ux=>ux._id != usuario._id);
            this.listadoUsuariosClonado = this.listadoUsuariosClonado.filter(ux=>ux._id != usuario._id);
            this.listarUsuarios();
            menu.toast({level: "success", title: "Eliminar usuario", message: "Usuario eliminado con éxito"})
        }catch(err){
            console.log(err);
            menu.toast({level: "danger", title: "Eliminar usuario", message: err?.responseText || err.toString()});
        }
    }
    //OK
    async modalCambiarContrasena(usuario){
        let confirm = await modal.yesno(`¿Confirma cambiar la contraseña del usuario ${usuario.email}?`);
        if(!confirm) return;

        let nuevaContrasena = await modal.prompt({label: "Nueva contraseña", text: "password"});
        if(nuevaContrasena.toString().length < 8) return menu.toast({level: "danger",  message: "La nueva contraseña debe contener al menos 8 caracteres"});

        let resp = await $.post({
            url: "/dashboard/usuarios/editar",
            data: { usuarioId: usuario._id, contrasena: nuevaContrasena }
        })
        modal.message(`Contraseña cambiada con éxito.`);
        menu.toast({level: "success", title: "Cambiar contraseña", message: `Contraseña cambiada con éxito.`});
    }
}