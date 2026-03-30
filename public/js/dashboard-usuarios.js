class DashboardUsuarios{
    //OK
    constructor(initHTML=true){
        this.permisos = [
            "menu.creditos-personales",
            "accion.editar-credito",
            "menu.cajas",
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
        this.clonarUsuario();
        return resp;
    }
    //OK - clona la lista para comparar luego
    clonarUsuario(usuario=null){
        if(usuario == null){//clona lista completa
            this.listadoUsuariosClonado = JSON.parse(JSON.stringify(this.listadoUsuarios));
        }else{
            let ux = this.listadoUsuariosClonado.find(ux=>ux._id == usuario._id);
            if(ux){//si existe en la lista clonada, lo sobre-escribe
                Object.assign(ux, JSON.parse(JSON.stringify(usuario)));
            }else{//si no existe en la lista cloanda, lo agrega
                this.listadoUsuariosClonado.push(JSON.parse(JSON.stringify(usuario)));
            }
        }
    }
    //OK
    async crearUsuario(){
        //if(this.listadoUsuarios.length >= 10) return modal.message("Ha alcanzado el limite de usuarios permitidos para su emprendimiento.<br> Borre un usuario para poder crear uno nuevo, o bien contactenos para ampliar dicho límite");

        let email = await modal.prompt({label: "Email", type: "email"});
        if(!email) return;

        try{
            let resp = await $.post({
                url:"/dashboard/usuarios/crear-hijo",
                data: { email, contrasena: null }
            });

            this.listadoUsuarios.push(resp.usuario);
            this.clonarUsuario(resp.usuario);
            modal.message(`Usuario creado con éxito.<br>La contraseá es <b class='text-monospace'>${resp.contrasena}</b>. Anotelá ya que no se volverá a mostrar por seguridad.`);
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
                    <button class='btn btn-flat btn-success mx-1' disabled name='guardar'>Guardar</button>
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
            if(usuario.esAdmin) return this.cambiarContrasenaAdmin();
            else return this.modalCambiarContrasenaHijo(usuario);
        });

        $("[name='tabla-usuarios'] tbody tr [name='permisos']").on("click", ev=>{
            let row = $(ev.currentTarget).closest("tr");
            let _id = row.attr("_id");
            let usuario = this.listadoUsuarios.find(ux=>ux._id == _id);
            this.modalPermisos(usuario);
        })
        $("[name='tabla-usuarios'] tbody tr [name='guardar']").on("click", ev=>{
            let row = $(ev.currentTarget).closest("tr");
            let _id = row.attr("_id");
            let usuario = this.listadoUsuarios.find(ux=>ux._id == _id);
            this.guardarUsuario(usuario);
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
    verificarCambios(){
        for(let usuario of this.listadoUsuarios){
            usuario.tieneCambios = false;
            let usuarioClon = this.listadoUsuariosClonado.find(ux=>ux._id == usuario._id);
            if(usuario.contrasena != usuarioClon.contrasena) usuario.tieneCambios = true;
            if(JSON.stringify(usuario.permisos) != JSON.stringify(usuarioClon.permisos)) usuario.tieneCambios = true;
            $(`[name='tabla-usuarios'] tbody [_id='${usuario._id}'] [name='guardar']`).attr("toggle-shine-button", usuario.tieneCambios.toString());
        }
    }
    //OK
    modalPermisos(usuario){
        let fox = $("#modal-permisos").html();
        modal.show({
            title: "Permisos",
            body: fox,
            buttons: {color: "primary", text: "Aceptar", name: "dismiss"},
            onHidden: () =>{
                this.verificarCambios()
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
    async guardarUsuario(usuario){
        let resp = await modal.yesno(`¿Confirma guardar los cambios en el usuario?`);
        if(!resp) return;

        try{
            let ret = await $.ajax({
                method: "PUT",
                url: "/dashboard/usuarios/asignar-permisos-hijo/" + usuario._id,
                data: { permisos: usuario.permisos }
            })
            
            Object.assign(usuario, ret);
            this.clonarUsuario(ret);

            this.verificarCambios();
            menu.toast({level: "success", title: "Editar usuario", message: "Usuario modificado con éxito"})
        }catch(err){
            menu.toast({level: "danger", title: "Editar usuario", message: err?.responseText || err.toString()});
        }
    }
    //OK
    async eliminarUsuario(usuario){
        let resp = await modal.yesno(`¿Confirma eliminar el usuario ${usuario.email}?`);
        if(!resp) return;
        
        try{
            let ret = $.ajax({
                method: "DELETE",
                url: "/dashboard/usuarios/eliminar-hijo/" + usuario._id
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
    cambiarContrasenaAdmin(){
        let fox = $("#modal-cambiar-contrasena-admin").html();

        modal.show({
            title: "Cambiar contraseña",
            body: fox,
            buttons: "back"
        });

        $("#modal .form-group").each((ind, ev)=>{
            let inp = $(ev).find("input");
            let btn = $(ev).find("button");
            utils.bindShowPasswordEvent(btn, inp);
        })

        $("#modal [name='nueva-contrasena']").on("keyup", ev=>{
            let inp = $(ev.currentTarget);
            let contrasena = inp.val();
        });

        $("#modal [name='confirmar-contrasena']").on("keyup", ev=>{
            let inp = $(ev.currentTarget);
            let contrasena = inp.val();
            let contrasena1 = $("#modal [name='nueva-contrasena']").val();
        });

        $("#modal [name='aplicar-cambio']").on("click", async ev=>{
            let actualContrasena = $("#modal [name='actual-contrasena']").val();
            let nuevaContrasena = $("#modal [name='nueva-contrasena']").val();
            let confirmarContrasena = $("#modal [name='confirmar-contrasena']").val();

            if(actualContrasena.toString().length < 8) return menu.toast({level: "danger",  message: "Contraseña actual no válida"});
            if(nuevaContrasena.toString().length < 8) return menu.toast({level: "danger",  message: "La nueva contraseña debe contener al menos 8 caracteres"});
            if(nuevaContrasena != confirmarContrasena) return menu.toast({level: "danger",  message: "La nueva contraseña y la confirmación no coinciden"});
            try{
                let ret = await $.ajax({
                    method: "PUT",
                    url: "/dashboard/usuarios/cambiar-contrasena-admin",
                    data: {
                        contrasenaActual: actualContrasena,
                        contrasenaNueva: nuevaContrasena
                    }
                });
                menu.toast({level: "success", title: "Cambiar contraseña", message: "Contraseña cambiada con éxito"});
                modal.hide();
            }catch(err){
                menu.toast({level: "danger", title: "Cambiar contraseña", message: err?.responseText || err.toString()});
            }
        });

        $("#modal [name='aplicar-cambio']").on("click", async ev=>{
            let actualContrasena = $("#modal [name='actual-contrasena']").val();
            let nuevaContrasena = $("#modal [name='nueva-contrasena']").val();
            let confirmarContrasena = $("#modal [name='confirmar-contrasena']").val();

            if(actualContrasena.toString().length < 8) return menu.toast({level: "danger",  message: "Contraseña actual no válida"});
            if(nuevaContrasena.toString().length < 8) return menu.toast({level: "danger",  message: "La nueva contraseña debe contener al menos 8 caracteres"});
            if(nuevaContrasena != confirmarContrasena) return menu.toast({level: "danger",  message: "La nueva contraseña y la confirmación no coinciden"});
            try{
                let ret = await $.ajax({
                    method: "PUT",
                    url: "/dashboard/usuarios/cambiar-contrasena-admin",
                    data: {
                        contrasenaActual: actualContrasena,
                        contrasenaNueva: nuevaContrasena
                    }
                });
                console.log(ret);
                menu.toast({level: "success", title: "Cambiar contraseña", message: "Contraseña cambiada con éxito"});
                modal.hide();
            }catch(err){
                menu.toast({level: "danger", title: "Cambiar contraseña", message: err?.responseText || err.toString()});
            }
        });
    }
    //OK
    async modalCambiarContrasenaHijo(usuario){
        let confirm = await modal.yesno(`¿Confirma cambiar la contraseña del usuario ${usuario.email}?`);
        if(!confirm) return;

        let nuevaContrasena = await modal.prompt({label: "Nueva contraseña", text: "password"});
        if(nuevaContrasena.toString().length < 8) return menu.toast({level: "danger",  message: "La nueva contraseña debe contener al menos 8 caracteres"});

        let resp = await $.ajax({
            method: "PUT",
            url: "/dashboard/usuarios/cambiar-contrasena-hijo/" + usuario._id,
            data: { contrasena: nuevaContrasena }
        })
        modal.message(`Contraseña cambiada con éxito.<br>La nueva contraseña es <b class='text-monospace'>${resp}</b>. Anótela ya que no se volverá a mostrar por seguridad.`);
        menu.toast({level: "success", title: "Cambiar contraseña", message: `Contraseña cambiada con éxito.`});
    }
}