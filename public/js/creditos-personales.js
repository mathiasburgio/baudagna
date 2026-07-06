class CreditosPersonales{
    constructor(iniciar=true){
        this.listado = [];
        this.creditoActual = null;
        this.accion = null; //nuevo, modificar, eliminar, ver

        this.ordenListado = "mas reciente";
        this.filtroListado = "todos";
        this.ordenCuotas = "numero";

        if(iniciar) this.init();
    }
    async init(){
        await boilerplate(true);
        this.listado = await $.get("/creditos-personales/listado");

        let optLocalidades = window.primordial.localidades.map(loc=>{
            return `<option value="${loc}">${loc}</option>`;
        });
        $("[name='direccion-localidad']").html(`<option value="">-</option>` + optLocalidades.join(""));
        
        let optProvincias = window.primordial.provincias.map(loc=>{
            return `<option value="${loc}">${loc}</option>`;
        });
        $("[name='direccion-provincia']").html(`<option value="">-</option>` + optProvincias.join(""));

        //BUSCAR
        $("#txtBuscarCredito").on("input", (e)=>{
            this.listarCreditos();
        });

        //NUEVO
        $("#btnNuevoCredito").on("click", async (e)=>{
            this.nuevo();
        });

        //MODIFICAR
        $("#btnModificarCredito").on("click", async (e)=>{
            this.modificar();
        });

        //ELIMINAR
        $("#btnEliminarCredito").on("click", async (e)=>{
            this.eliminar();
        });
        
        //GUARDAR
        $("#btnGuardarCredito").on("click", async (e)=>{
            this.guardar();
        });
        $("#btnGuardarFinalidad").on("click", async (e)=>{
            this.guardarFinalidad();
        });

        //FILTRAR
        $("#btnFiltrarListado").on("click", async (e)=>{
            let ele = $(e.currentTarget);
            let aux = await modal.promptSelect({
                title: "Filtrar por",
                ar: ["todos", "Roque Pérez@Moto", "Roque Pérez@Auto", "Navarro@Moto", "Navarro@Auto"],
            });
            if(!aux) return;
            ele.html("Mostrar: " + aux);
            this.filtroListado = aux;
            this.listarCreditos();
        });

        //ORDENAR
        $("#btnOrdenarListado").on("click", async (e)=>{
            let ele = $(e.currentTarget);
            let aux = await modal.promptSelect({
                title: "Ordenar por",
                ar: ["mas reciente", "alfabético", "próximo vencimiento"],
            });
            if(!aux) return;
            ele.html("Orden: " + aux);
            this.ordenListado = aux;
            this.ordenarListado();
            this.listarCreditos();
        });

        //ENVIAR WHATSAPP
        $("#btnWhatsappCuotaPendiente").on("click", async (e)=>{
            if(this.creditoActual == null) return modal.message("Debe seleccionar un crédito para poder enviar el mensaje de whatsapp.");
            let msj = `
                Hola ¿cómo estás?, Te contactamos de ATN para informarte que registrás una cuota pendiente de pago.
                \n
                Cuando puedas, te pedimos que la regularices. Y si necesitás una mano o tenés alguna duda, podés escribirnos sin problema.
                \n
                Si ya pagaste, no hace falta que tengas en cuenta este mensaje.
                \n
                ¡Gracias! - EQUIPO ATN
                `;

            let num = this.creditoActual.datosGenerales["contacto-telefono"] || "";
            let aux = await modal.prompt({type:"text", label: "Número", value: num});
            if(!aux) return;
            if(aux.startsWith("549")) aux = aux.slice(3); //quito el 549 para evitar problemas con el formato internacional de whatsapp
            let w = window.open(`https://wa.me/549${aux.replace(/\D/g, "")}?text=${encodeURIComponent(msj)}`, "_blank");
        
        });
        $("#btnWhatsappProximoVencimiento").on("click", async (e)=>{
            if(this.creditoActual == null) return modal.message("Debe seleccionar un crédito para poder enviar el mensaje de whatsapp.");
            let msj = `
                Hola ¿cómo estás?😊
                \n
                Te escribimos de ATN para avisarte que tu cuota está por vencer en los próximos días.
                \n
                La idea es recordártelo con tiempo así podés organizarte tranquilo/a. No es necesario responder este mensaje. Si necesitás algún dato o ayuda, estamos a disposición.
                \n
                ¡Gracias por acompañarnos! - EQUIPO ATN`;

            let num = this.creditoActual.datosGenerales["contacto-telefono"] || "";
            let aux = await modal.prompt({type:"text", label: "Número", value: num});
            if(!aux) return;
            if(aux.startsWith("549")) aux = aux.slice(3); //quito el 549 para evitar problemas con el formato internacional de whatsapp
            let w = window.open(`https://wa.me/549${aux.replace(/\D/g, "")}?text=${encodeURIComponent(msj)}`, "_blank");
        
        });

        //CAMBIO DE FINALIDAD
        $("#finalidad [name='finalidad-tipo']").on("change", ev=>{
            let value = $(ev.currentTarget).val();
            $("#finalidad [finalidad-tipo]").addClass("d-none");
            $("#finalidad [finalidad-tipo='general']").removeClass("d-none");
            if(value == "general"){
                //nada en general solo muestre el textarea
            }else if(value == "vehiculo"){
                $("#finalidad [finalidad-tipo='vehiculo']").removeClass("d-none");
            }else if(value == "vivienda"){
                $("#finalidad [finalidad-tipo='vivienda']").removeClass("d-none");
            }
        });

        $("#btnGenerarCuotas").on("click", async (e)=>{
            this.generarCuotas();
        });

        $("#btnOrdenCuotas").on("click", async (e)=>{
            let ele = $(e.currentTarget);
            if(this.ordenCuotas == "numero"){
                this.ordenCuotas = "vencimiento";
                ele.html("Orden: Vencimiento");
            }else{
                this.ordenCuotas = "numero";
                ele.html("Orden: Número");
            }
            this.listarCuotas();
        });

        $("#btnAgregarCuota").on("click", async (e)=>{
            if(!this.creditoActual) return modal.message("Debe seleccionar un crédito para poder agregar una cuota.");
            if(this.creditoActual.length <= 0) return modal.message("Debe generar las cuotas antes de poder agregar una cuota manualmente.");
            try{
                let data = {
                    numero: this.creditoActual?.cuotas?.length + 1,
                    vencimiento: fechasTemporal.toString(),
                    monto: this.creditoActual.cuotas[0]?.monto,
                    montoCapital: this.creditoActual.cuotas[0]?.montoCapital,
                    montoInteres: this.creditoActual.cuotas[0]?.montoInteres,
                    tasaInteres: this.creditoActual.cuotas[0]?.tasaInteres,
                    cobrado: false,
                    eliminado: false
                }

                let resp = await $.post("/creditos-personales/asignar-cuotas", {
                    creditoId: this.creditoActual._id,
                    cuotas: [data]
                });
                let nueva = resp.credito.cuotas.at(-1);
                this.creditoActual.cuotas.push(nueva);
                this.modalCuota(nueva);
                this.listarCuotas();
                menu.toast({level: "success", message: "Cuota agregada con éxito"});
                this.modalCuota(nueva);
            }catch(e){
            }
        });

        $("#btnCobrar").on("click", ev=>{
            if(!this.creditoActual) return modal.message("Debe seleccionar un crédito para poder cobrar una cuota.");
            let proxima = this.creditoActual?.cuotas.find(c=>!c.cobrado && !c.eliminado);
            if(!proxima) return modal.message("No hay cuotas pendientes de cobro para este crédito.");
            this.modalCuota(proxima);
        })

        $("#btnResumenGeneral").on("click", ev=>{
            this.modalResumen();
        })

        this.ordenarListado();
        this.listarCreditos();
        menu.hideCortina();
    }
    ordenarListado(){
        if(this.ordenListado == "mas reciente"){
            this.listado.sort((a, b)=>{
                if(a.createdAt > b.createdAt) return -1;
                if(a.createdAt < b.createdAt) return 1;
                return 0;
            });
        }else if(this.ordenListado == "alfabético"){
            this.listado.sort((a, b)=>{
                let apellidoNombreA = (a.datosGenerales?.["datos-personales-apellidos"] + " " + a.datosGenerales?.["datos-personales-nombres"]).toLowerCase();
                let apellidoNombreB = (b.datosGenerales?.["datos-personales-apellidos"] + " " + b.datosGenerales?.["datos-personales-nombres"]).toLowerCase();
                if(apellidoNombreA < apellidoNombreB) return -1;
                if(apellidoNombreA > apellidoNombreB) return 1;
                return 0;
            });
        }else if(this.ordenListado == "próximo vencimiento"){
            this.listado.sort((a, b)=>{
                if(a.proximoVencimiento > b.proximoVencimiento) return 1;
                if(a.proximoVencimiento < b.proximoVencimiento) return -1;
                return 0;
            });
        }
    }
    nuevo(){
        this.limpiar();
        this.creditoActual = null;
        this.accion = "nuevo";
        $("#lblAccion").html("Nuevo crédito");
    }
    modificar(){
        modal.message("Para modificar un crédito debe seleccionarlo, editar los campos y finalmente guadar.");
    }
    async eliminar(){
        if(!this.creditoActual) return modal.message("Debe seleccionar un crédito para poder eliminarlo.");

        const resp = await modal.yesno("¿Confirma eliminar este crédito?");
        if(!resp) return;
        await $.post("/creditos-personales/eliminar", {creditoId: this.creditoActual._id});
        this.listado = this.listado.filter(c=>c._id != this.creditoActual._id);
        this.accion = null;
        this.creditoActual = null;
        this.limpiar();
        this.listarCreditos(true);
        menu.toast({level: "success", message: "Crédito eliminado con éxito"});
    }
    async guardar(){
        if(this.accion != "nuevo" && this.accion != "modificar") return modal.message("No hay acción (modificar, nuevo) para guardar.");
        try{
            let data = {};
            let validos = [
                "observaciones",

                "datos-personales-apellidos",
                "datos-personales-nombres",
                "datos-personales-estado-civil",
                "datos-personales-conyuge",
                "datos-personales-tipo-documento",
                "datos-personales-numero-documento",
                "datos-personales-condicion-iva",

                "direccion-calle",
                "direccion-localidad",
                "direccion-provincia",

                "contacto-telefono",
                "contacto-email",

                "garante-nombre",
                "garante-direccion",
                "garante-telefono",
                "garante-tipo-documento",
                "garante-numero-documento",
            ];
            $(`#datos-generales [name]`).each((ind, ele)=>{
                let $ele = $(ele);
                let name = $ele.attr("name");
                if(name && validos.includes(name)){
                    let value = $ele.val();
                    data[name] = value;
                }
            });
            if(data["datos-personales-apellidos"] == "" || data["datos-personales-nombres"] == "") return menu.toast({level: "warning", message: "Los campos Apellidos y Nombres son obligatorios"});
            
            if(this.accion == "modificar"){
                let resp = await $.post({
                    url: "/creditos-personales/modificar",
                    data: {
                        creditoId: this.creditoActual._id,
                        tipoDato: "datosGenerales",
                        datos: data
                    },
                })
                Object.assign(this.creditoActual, resp); //actualizo el objeto con los datos modificados
                this.listarCreditos();
                menu.toast({level: "success", message: "Modificado con éxito"});
            }else{
                let resp = await $.post({
                    url: "/creditos-personales/nuevo",
                    data: data,
                })
                this.listado.push(resp);
                this.listarCreditos();
                this.creditoActual = resp;
                this.accion = "modificar";
                $("#lblAccion").html("Mod: #" + this.creditoActual.numero + " - " + (this.creditoActual.datosGenerales?.["datos-personales-apellidos"] + " " + this.creditoActual.datosGenerales?.["datos-personales-nombres"]).substring(0, 15) + "...");
                menu.toast({level: "success", message: "Guardado con éxito"});
            }
        }catch(err){
            console.log(err);
            menu.toast({level: "danger", message: "Error al guardar"});
        }
    }
    async guardarFinalidad(){
        if(!this.accion || this.accion == "nuevo") return modal.message("Solo puede agregar finalidad a créditos previamente guardados para guardar.");
        try{
            let data = {};
            let validos = [
                "finalidad-tipo",
                "finalidad-fecha-compra",
                "finalidad-detalle-general",
                
                "finalidad-vehiculo-tipo",
                "finalidad-vehiculo-marca",
                "finalidad-vehiculo-modelo",
                "finalidad-vehiculo-anio",
                "finalidad-vehiculo-dominio",

                "finalidad-vivienda-accion",
                "finalidad-vivienda-provincia",
                "finalidad-vivienda-localidad",
                "finalidad-vivienda-ubicacion",
            ];
            $(`#finalidad [name]`).each((ind, ele)=>{
                let $ele = $(ele);
                let name = $ele.attr("name");
                if(name && validos.includes(name)){
                    let value = $ele.val();
                    data[name] = value;
                }
            });

            let resp = await $.post({
                url: "/creditos-personales/modificar",
                data: {
                    creditoId: this.creditoActual._id,
                    tipoDato: "finalidad",
                    datos: data
                },
            })
            Object.assign(this.creditoActual, resp); //actualizo el objeto con los datos modificados
            this.listarCreditos();
            menu.toast({level: "success", message: "Modificado con éxito"});
        }catch(err){
            console.log(err);
            menu.toast({level: "danger", message: "Error al guardar"});
        }

    }
    listarCreditos(limpiar=false){
        if(limpiar) $("#txtBuscarCredito").val("");
        let p = $("#txtBuscarCredito").val().toLowerCase();

        //guardo el scroll para que no se mueva al actualizar la tabla
        let scrollTop = $("#tabla-creditos").parent().scrollTop();

        let tbody = [];
        this.listado
            .filter(c=>{

                let palabra = false;
                let filtro = false;
                
                if(!p) palabra = true;
                else{
                    let apellidoNombre = (c.datosGenerales?.["datos-personales-apellidos"] + " " + c.datosGenerales?.["datos-personales-nombres"]).toLowerCase();
                    if(apellidoNombre.includes(p)) palabra = true;
                }
                if(this.filtroListado == "todos") filtro = true;
                if(this.filtroListado.includes("@")){
                    let [ciudad, vehiculo] = this.filtroListado.split("@");
                    if(c.datosGenerales?.["direccion-localidad"] == ciudad && c.finalidad?.["finalidad-vehiculo-tipo"] == vehiculo) filtro = true;
                }
                return filtro && palabra;
            })
            .forEach(c=>{
                if(tbody.length > 300) return;
                let detalle = c.finalidad["finalidad-tipo"];
                if(c.finalidad["finalidad-tipo"] == "vehiculo" && c.finalidad?.["finalidad-vehiculo"]) detalle += " " + (c.finalidad["finalidad-vehiculo"] || "");
                if(c.finalidad["finalidad-tipo"] == "vivienda" && c.finalidad?.["finalidad-vivienda"]) detalle += " " + (c.finalidad["finalidad-vivienda-accion"] || "");
                if(c.finalidad["finalidad-tipo"] == "general" && c.finalidad?.["finalidad-detalle-general"]) detalle += " " + (c.finalidad["finalidad-detalle-general"].substring(0, 10) + "..." || "");
                
                tbody.push(`<tr credito-id="${c._id}" class="cp">
                    <td>${c.numero}</td>
                    <td>${c.datosGenerales["datos-personales-apellidos"]} ${c.datosGenerales["datos-personales-nombres"]}</td>
                    <td>${c.datosGenerales["direccion-localidad"]}</td>
                    <td>${detalle}</td>
                    <td>${c?.proximoVencimiento ? fechasTemporal.toString(c.proximoVencimiento, "arg") : ""}</td>
                </tr>`);
            });

        $("#tabla-creditos tbody").html(tbody.join(""));
        $("#tabla-creditos").parent().scrollTop(scrollTop);

        $("#tabla-creditos tbody tr").on("click", (e)=>{
            this.limpiar();
            let tr = $(e.currentTarget);
            let creditoId = tr.attr("credito-id");
            this.creditoActual = this.listado.find(c=>c._id == creditoId);
            console.log(this.creditoActual);
            this.accion = "modificar";
            $("#lblAccion").html("Mod: #" + this.creditoActual.numero + " - " + (this.creditoActual.datosGenerales["datos-personales-apellidos"] + " " + this.creditoActual.datosGenerales["datos-personales-nombres"]).substring(0, 15) + "...");
        
            //completo datos generales
            for(let key in this.creditoActual.datosGenerales){
                let ele = $(`#datos-generales [name="${key}"]`);
                if(ele.length > 0){
                    ele.val(this.creditoActual.datosGenerales[key]);
                }
            }
            for(let key in this.creditoActual.finalidad){
                let ele = $(`#finalidad [name="${key}"]`);
                if(ele.length > 0){
                    ele.val(this.creditoActual.finalidad[key]);
                }
            }
            $("#finalidad [name='finalidad-tipo']").change();

            this.listarCuotas();
        });

        $("#tabla-creditos tbody tr").popover({
            trigger: "hover",
            html: true,
            content: function(){
                let row = $(this);
                let creditoId = row.attr("credito-id");
                let credito = creditosPersonales.listado.find(c=>c._id == creditoId);
                let contenido = `
                <div class="text-left">
                    <b>Crédito #${credito.numero}</b><br>
                    <b>Detalle: </b>${credito.finalidad["finalidad-tipo"] || ""} ${credito.finalidad["finalidad-vehiculo"] || ""} ${credito.finalidad["finalidad-vivienda"] || ""} ${credito.finalidad["finalidad-detalle-general"] || ""}<br>
                </div>`;
                return contenido;
            }
        });
    }
    limpiar(){
        //DATOS GENERALES
        $(`#datos-generales input`).val("");
        $(`#datos-generales select`).each((i, ele)=>{
            let opt0 = $(ele).find("option").first();
            $(ele).val(opt0.val());
        });
        $(`#datos-generales textarea`).val("");

        //FINALIADAD
        $(`#finalidad input`).val("");
        $(`#finalidad select`).each((i, ele)=>{
            let opt0 = $(ele).find("option").first();
            $(ele).val(opt0.val());
        });
        $(`#finalidad textarea`).val("");
        
        $(`#finalidad [name='finalidad-tipo']`).val("general");
        $("#finalidad [name='finalidad-tipo']").change();
        
        //CUOTAS
        $("#tabla-cuotas tbody").html("");
        $("#lblAccion").html("...");

    }
    async generarCuotas(){
        if(!this.creditoActual) return modal.message("Debe seleccionar un crédito para poder generar las cuotas.");
        if(this.creditoActual?.cuotas?.some(c=>c.cobrado)) return modal.message("No se pueden generar nuevas cuotas si ya hay cuotas cobradas.");
        if(this.creditoActual.cuotas.length > 0){
            let r = await modal.yesno("Ya existen cuotas generadas para este crédito. ¿Desea reemplazarlas?");
            if(!r) return;
        }


        modal.show({
            title: "Generador de cuotas",
            body: $("#modal-generar-cuotas").html(),
            size: "lg",
        });

        $("#modal [name='fecha-primer-vencimiento']").val(fechasTemporal.toString());
        $("#modal [name='monto-solicitado']").on("change", ev=>{
            let $ele = $(ev.currentTarget);
            let v = $ele.val();

            let intereses = Number($("#modal [name='intereses']").val() || 0);
            let montoSolicitado = Number($("#modal [name='monto-solicitado']").val() || 0);
            let cantidadCuotas = Number($("#modal [name='cantidad-cuotas']").val() || 0);
            if(intereses > 0 && montoSolicitado > 0 && cantidadCuotas > 0){
                let montoTotal = montoSolicitado * (1 + intereses/100);
                let montoCuota = montoTotal / cantidadCuotas;
                $("#modal [name='monto-total']").val(Number(montoTotal.toFixed(2)));
                $("#modal [name='monto-cuota']").val(Number(montoCuota.toFixed(2)));
            }
        });
        $("#modal [name='intereses']").on("change", ev=>{
            let $ele = $(ev.currentTarget);
            let v = parseInt($ele.val()) || 0;
            
            let intereses = Number($("#modal [name='intereses']").val() || 0);
            let montoSolicitado = Number($("#modal [name='monto-solicitado']").val() || 0);
            let cantidadCuotas = Number($("#modal [name='cantidad-cuotas']").val() || 0);
            if(intereses > 0 && montoSolicitado > 0 && cantidadCuotas > 0){
                let montoTotal = montoSolicitado * (1 + intereses/100);
                let montoCuota = montoTotal / cantidadCuotas;
                $("#modal [name='monto-total']").val(Number(montoTotal.toFixed(2)));
                $("#modal [name='monto-cuota']").val(Number(montoCuota.toFixed(2)));
            }
        });
        $("#modal [name='cantidad-cuotas']").on("change", ev=>{
            let $ele = $(ev.currentTarget);
            let v = parseInt($ele.val()) || 0;
            let fechaPrimeraCuota = $("#modal [name='fecha-primer-vencimiento']").val();
            if(v && fechaPrimeraCuota){
                let fx = fechasTemporal.toString(fechaPrimeraCuota);
                let vencimientoUltimaCuota = fechasTemporal.add(fx, {months: v});
                $("#modal [name='fecha-ultimo-vencimiento']").val(fechasTemporal.toString(vencimientoUltimaCuota).split("T")[0]);
            }else{
                $("#modal [name='fecha-ultimo-vencimiento']").val("");
            }

            let intereses = Number($("#modal [name='intereses']").val() || 0);
            let montoSolicitado = Number($("#modal [name='monto-solicitado']").val() || 0);
            let cantidadCuotas = Number($("#modal [name='cantidad-cuotas']").val() || 0);
            if(intereses > 0 && montoSolicitado > 0 && cantidadCuotas > 0){
                let montoTotal = montoSolicitado * (1 + intereses/100);
                let montoCuota = montoTotal / cantidadCuotas;
                $("#modal [name='monto-total']").val(Number(montoTotal.toFixed(2)));
                $("#modal [name='monto-cuota']").val(Number(montoCuota.toFixed(2)));
            }
        });

        
        $("#modal [name='monto-total']").on("change", ev=>{
            let $ele = $(ev.currentTarget);
            let v = Number($ele.val()) || 0;

            //let intereses = Number($("#modal [name='intereses']").val() || 0);
            let montoSolicitado = Number($("#modal [name='monto-solicitado']").val() || 0);
            let cantidadCuotas = Number($("#modal [name='cantidad-cuotas']").val() || 0);
            if(v > 0 && montoSolicitado > 0 && cantidadCuotas > 0){
                let montoCuota = v / cantidadCuotas;
                $("#modal [name='monto-cuota']").val(Number(montoCuota.toFixed(2)));
                
                let intereses = ((v / montoSolicitado) - 1) * 100;
                $("#modal [name='intereses']").val(Number(intereses.toFixed(2)));
            } 
        });
        $("#modal [name='monto-cuota']").on("change", ev=>{
            let $ele = $(ev.currentTarget);
            let v = Number($ele.val()) || 0;

            let montoSolicitado = Number($("#modal [name='monto-solicitado']").val() || 0);
            let cantidadCuotas = Number($("#modal [name='cantidad-cuotas']").val() || 0);
            if(v > 0 && montoSolicitado > 0 && cantidadCuotas > 0){
                let montoTotal = v * cantidadCuotas;
                $("#modal [name='monto-total']").val(Number(montoTotal.toFixed(2)));

                let intereses = ((montoTotal / montoSolicitado) - 1) * 100;
                $("#modal [name='intereses']").val(Number(intereses.toFixed(2)));
            } 
        });
        
        $("#modal [name='fecha-primer-vencimiento']").on("change", ev=>{
            let $ele = $(ev.currentTarget);
            let v = $ele.val();
            let cantidadCuotas = Number($("#modal [name='cantidad-cuotas']").val() || 0);
            if(v && cantidadCuotas){
                let nuevoVencimiento = fechasTemporal.add(v, {months: cantidadCuotas});
                $("#modal [name='fecha-ultimo-vencimiento']").val(fechasTemporal.toString(nuevoVencimiento, "usa"));
            }else{
                $("#modal [name='fecha-ultimo-vencimiento']").val("");
            }
        });

        $("#modal [name='generar']").on("click", async ev=>{
            try{
                modal.waiting2(true, "Generando cuotas...");

                let cuotas = [];
                let cantidadCuotas = Number($("#modal [name='cantidad-cuotas']").val() || 0);
                let montoCuota = Number($("#modal [name='monto-cuota']").val() || 0);
                let tasaInteres = Number($("#modal [name='intereses']").val() || 0);
                let fechaInicial = $("#modal [name='fecha-primer-vencimiento']").val();
                let t0 = fechasTemporal.toString(fechaInicial);
                for(let i = 0; i < cantidadCuotas; i++){
                    let cuota = {};
                    cuota.vencimiento = fechasTemporal.add(fechaInicial, {months: i}).toString();
                    cuota.numero = i + 1;
                    cuota.monto = montoCuota;
                    cuota.cobrado = false;
                    cuota.eliminado = false;
                    cuota.tasaInteres = tasaInteres;
                    cuota.montoCapital = utils.decimals(montoCuota / (1 + tasaInteres/100), 2);
                    cuota.montoInteres = utils.decimals(cuota.monto - cuota.montoCapital, 2);
                    cuotas.push(cuota);
                }

                const resp = await $.post("/creditos-personales/asignar-cuotas", 
                    {
                        creditoId: this.creditoActual._id,
                        cuotas: cuotas
                    });
                Object.assign(this.creditoActual, resp.credito); //actualizo el objeto con los datos modificados
                menu.toast({level: "success", message: "Cuotas generadas con éxito"});
                this.listarCreditos();
                this.listarCuotas();
                modal.hide();
            }catch(e){
                menu.toast({level: "danger", message: e.toString()});
            }finally{
                modal.waiting2(false);
            }
        })
        $("#modal [name='ocultar']").on("click", ev=>{
            modal.hide();
        })
    }
    listarCuotas(){
        if(!this.creditoActual || this.creditoActual?.cuotas?.length <= 0) return;
        let tbody = [];
        this.creditoActual.cuotas.sort((a, b)=>{
            if(this.ordenCuotas == "numero"){
                if(a.numero < b.numero) return -1;
                if(a.numero > b.numero) return 1;
                return 0;
            }else if(this.ordenCuotas == "vencimiento"){
                if(a.vencimiento < b.vencimiento) return -1;
                if(a.vencimiento > b.vencimiento) return 1;
                return 0;
            }
        }).forEach(cuota=>{
            if(cuota.eliminado) return;
            let vencida = false;
            if(!cuota.cobrado && cuota.vencimiento && fechasTemporal.toString() > cuota.vencimiento) vencida = true;
            let tr = `<tr cuota-id="${cuota._id}" class="cp">
                <td>${cuota.numero}</td>
                <td class='${vencida ? "text-danger" : ""}'>${fechasTemporal.toString(cuota.vencimiento, "arg")}</td>
                <td class='text-right'>${utils.formatNumber(cuota.monto)}</td>
                <td class='text-right'>${cuota.cobrado ? "Sí" : "No"}</td>
            </tr>`;
            tbody.push(tr);
        });
        $("#tabla-cuotas tbody").html(tbody.join(""));
        $("#tabla-cuotas tbody tr").on("click", (e)=>{
            let tr = $(e.currentTarget);
            let cuotaId = tr.attr("cuota-id");
            let cuota = this.creditoActual.cuotas.find(c=>c._id == cuotaId);
            this.modalCuota(cuota);
        });
    }
    modalCuota(cuota){
        console.log(cuota);
        let cobro = null; //guardo si la cuota tiene un cobro asociado

        modal.show({
            title: "Editar cuota",
            body: $("#modal-cuota").html(),
            size: "xl",
            buttons: "back"
        })
        let punit = Number(window.primordial.punitorios);

        //modificar eliminar
        $("#modal [name='numero']").val(cuota.numero);
        $("#modal [name='vencimiento']").val(fechasTemporal.toString(cuota.vencimiento));
        $("#modal [name='monto']").val(cuota.monto);
        $("#modal [name='montoCapital']").val(utils.formatNumber(cuota.montoCapital));
        $("#modal [name='montoInteres']").val(utils.formatNumber(cuota.montoInteres));
        
        //cobrar imprimir
        $("#modal [name='montoCuota']").val(utils.formatNumber(cuota.monto));
        $("#modal [name='total']").val(utils.formatNumber(cuota.monto));

        let dif = fechasTemporal.diffDays(new Date(), cuota.vencimiento);
        let diasMora = 0;
        if(dif < 0){
            diasMora = Math.abs(dif);
            let aux = parseInt(Math.abs(cuota.monto * punit));
            let totalPunitorios = parseInt(aux * diasMora);
            let fox = aux + " x día (" + diasMora + " días)";
            $("#modal [name='lbPunitorios']").html(fox);
            $("#modal [name='punitorios']").val(totalPunitorios);
            $("#modal [name='total']").val(utils.formatNumber(cuota.monto + totalPunitorios));
        }

        //si modifico punitoros, q no se muestre el detalle
        $("#modal [name='punitorios']").on("change", ev=>{
            let ele = $(ev.currentTarget);
            let v = ele.val();
            let total = Number(v) + Number(cuota.monto);
            $("#modal [name='total']").val(utils.formatNumber(total));
            ele.parent().find("small").addClass("d-none");
        });
        
        let optMetodos = window.primordial.cajas.map(c=>`<option value="${c}">${c}</option>`);
        $("#modal [name='metodo']").html(optMetodos.join(""));

        if(cuota.cobrado){
            $("#modal .modal-body input").attr("disabled", true);
            $("#modal .modal-body select").attr("disabled", true);
            $("#modal .modal-body textarea").attr("disabled", true);
            $("#modal .modal-body button").attr("disabled", true);
            $("#modal [name='imp-recibo']").prop("disabled", false);
            if(cuota.facturaId){
                $("#modal [name='facturar']").prop("disabled", true);
                $("#modal [name='imp-factura']").prop("disabled", false);
            }else{
                $("#modal [name='facturar']").prop("disabled", false);
                $("#modal [name='imp-factura']").prop("disabled", true);
            }
            cobro = this.creditoActual.cobros.find(c=>c.cuotaId == cuota._id);
            console.log(cobro);
            $("#modal [name='metodo']").val(cobro.metodo);
            $("#modal [name='detalle']").val(cobro.detalle);
            $("#modal [name='punitorios']").val(utils.formatNumber(cobro.montoPunitorios));
        }else{
            $("#modal [name='facturar']").prop("disabled", true);
            $("#modal [name='imp-factura']").prop("disabled", true);
            $("#modal [name='imp-recibo']").prop("disabled", true);
        }
        $("#modal [name='monto']").on("change", ev=>{
            let ele = $(ev.currentTarget);
            let v = Number(ele.val()) || 0;
            let dif = v - cuota.montoCapital;
            $("#modal [name='montoInteres']").val(utils.formatNumber(dif));
        });

        $("#modal [name='eliminar']").on("click", async ev=>{
            if(cuota.cobrado) return modal.message("No se puede eliminar una cuota que ya fue cobrada.");

            let ele = $(ev.currentTarget);
            let resp = await modal.addPopover({querySelector: ele, type: "yesno", message: "¿Confirma eliminar esta cuota?"});
            if(!resp) return;

            try{
                let resp = await $.post("/creditos-personales/eliminar-cuota", {creditoId: this.creditoActual._id, cuotaId: cuota._id});
                Object.assign(this.creditoActual, resp);
                this.listarCreditos();
                this.listarCuotas();
                modal.hide();
                menu.toast({level: "success", message: "Cuota eliminada con éxito"});
            }catch(e){
                console.log(e);
            }
        });
        $("#modal [name='modificar']").on("click", async ev=>{
            if(cuota.cobrado) return modal.message("No se puede modificar una cuota que ya fue cobrada.");

            let ele = $(ev.currentTarget);
            let confirm = await modal.addPopover({querySelector: ele, type: "yesno", message: "¿Confirma modificar esta cuota?"});
            if(!confirm) return;

            try{
                let monto = Number($("#modal [name='monto']").val());
                if(monto <= 0) return modal.addPopover({querySelector: ele, message: "El monto de la cuota debe ser mayor a cero."});
                let _montoCapital = cuota.montoCapital;
                let _montoInteres = monto - _montoCapital;

                let datos = {
                    numero: $("#modal [name='numero']").val(),
                    vencimiento: $("#modal [name='vencimiento']").val(),
                    monto: monto,
                    montoCapital: _montoCapital,
                    montoInteres: _montoInteres,
                };
                let resp = await $.post("/creditos-personales/modificar-cuota", {
                    creditoId: this.creditoActual._id, 
                    cuotaId: cuota._id, 
                    cuota: datos
                });
                console.log(resp);
                Object.assign(cuota, resp.cuota);
                this.listarCreditos();
                this.listarCuotas();
                menu.toast({level: "success", message: "Cuota modificada con éxito"});
                modal.hide(false, ()=>{
                    let nueva = this.creditoActual.cuotas.find(c=>c._id == cuota._id);
                    this.modalCuota(nueva);
                });
            }catch(e){
                console.log(e);
            }
        });
        
        $("#modal [name='cobrar']").on("click", async ev=>{
            let ele = $(ev.currentTarget);
            let confirm = await modal.addPopover({querySelector: ele, type: "yesno", message: "¿Confirma cobrar esta cuota?"});
            if(!confirm) return;

            try{
                let punitorios = Number($("#modal [name='punitorios']").val()) || 0;
                let datos = {
                    creditoId: this.creditoActual._id,
                    cuotaId: cuota._id,
                    montoTotal: (punitorios + cuota.monto),
                    montoCapital: cuota.montoCapital,
                    montoInteres: cuota.montoInteres,
                    montoPunitorios: punitorios,
                    diasMora: diasMora,
                    metodo: $("#modal [name='metodo']").val(),
                    detalle: $("#modal [name='detalle']").val(),
                };
                let resp = await $.post("/creditos-personales/cobrar-cuota", datos);
                console.log(resp);
                cuota.cobroId = resp.cobro._id;
                cuota.cobrado = true;
                if(this.creditoActual.cobros == null) this.creditoActual.cobros = [];
                this.creditoActual.cobros.push(resp.cobro);
                this.listarCreditos();
                this.listarCuotas();
                menu.toast({level: "success", message: "Cuota cobrada con éxito"});
                modal.hide(false, ()=>{
                    let nueva = this.creditoActual.cuotas.find(c=>c._id == cuota._id);
                    this.modalCuota(nueva);
                });
            }catch(e){
                console.log(e);
                menu.toast({level: "danger", message: "Error al cobrar la cuota"});
            }
        });
        $("#modal [name='facturar']").on("click", async ev=>{   
            modal.waiting2(true, "Generando factura...");
            await utils.sleep(1000);
            menu.toast({level: "warning", message: "Credenciales ARCA/AFIP no configuradas."});
            modal.waiting2(false, "Generando factura...");
        });
        $("#modal [name='imp-factura']").on("click", async ev=>{
            let cuotaId = cuota._id;
            let creditoId = this.creditoActual._id;
            let w = window.open("/html/factura.html?creditoId=" + creditoId + "&cuotaId=" + cuotaId, "_blank");
        });
        $("#modal [name='imp-recibo']").on("click", async ev=>{
            let cuotaId = cuota._id;
            let creditoId = this.creditoActual._id;
            let w = window.open("/html/recibo.html?creditoId=" + creditoId + "&cuotaId=" + cuotaId, "_blank");
        });
    }
    modalResumen(){
        modal.show({
            title: "Resumen de créditos",
            body: $("#modal-resumen").html(),
            size: "lg",
            buttons: "back"
        })

    }
}