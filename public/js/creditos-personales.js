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
            let confirm = await modal.yesno("¿Confirma agregar cuota?");
            if(!confirm) return;

            try{
                let data = {
                    numero: this.creditoActual?.cuotas?.length + 1,
                    vencimiento: fechasTemporal.toString(),
                    monto: 1000,
                    montoCapital: 0,
                    montoInteres: 1000,
                    tasaInteres: 0,
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
                modal.message("Error al agregar cuota: " + (e.response?.text || e.toString()));
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

        $("#btnResumenCaja").on("click", ev=>{
            this.modalResumenCaja();
        });

        $("#btnExportarExcel").on("click", ev=>{
            this.exportarExcel();
        });

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
                const vencimientoA = a.proximoVencimiento || "9999-12-31";
                const vencimientoB = b.proximoVencimiento || "9999-12-31";
                return vencimientoA.localeCompare(vencimientoB);
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
        try{
        await $.post("/creditos-personales/eliminar", {creditoId: this.creditoActual._id});
        this.listado = this.listado.filter(c=>c._id != this.creditoActual._id);
        this.accion = null;
        this.creditoActual = null;
        this.limpiar();
        this.listarCreditos(true);
        menu.toast({level: "success", message: "Crédito eliminado con éxito"});
        }catch(e){
            menu.toast({level: "danger", message: e?.responseText || "No se pudo eliminar el crédito"});
        }
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
                if(c.finalidad["finalidad-tipo"] == "vehiculo" && c.finalidad?.["finalidad-vehiculo-tipo"]) detalle += " - " + (c.finalidad["finalidad-vehiculo-tipo"] || "");
                if(c.finalidad["finalidad-tipo"] == "vivienda" && c.finalidad?.["finalidad-vivienda-accion"]) detalle += " - " + (c.finalidad["finalidad-vivienda-accion"] || "");
                if(c.finalidad["finalidad-tipo"] == "general" && c.finalidad?.["finalidad-detalle-general"]) detalle += " - " + (c.finalidad["finalidad-detalle-general"].substring(0, 10) + "..." || "");
                
                let dif = fechasTemporal.diffDays(new Date(), c.proximoVencimiento);
                let color = "bg-light";
                if(dif < 0) color = "bg-danger";
                else if(dif <= 7) color = "bg-warning";

                tbody.push(`<tr credito-id="${c._id}" class="cp">
                    <td>${c.numero}</td>
                    <td>${c.datosGenerales["datos-personales-apellidos"]} ${c.datosGenerales["datos-personales-nombres"]}</td>
                    <td>${c.datosGenerales["direccion-localidad"]}</td>
                    <td>${detalle}</td>
                    <td class='${color}'>${c?.proximoVencimiento ? fechasTemporal.toString(c.proximoVencimiento, "arg") : ""} ${dif < 7 ? "<small>(" + dif + " días)</small>" : ""}</td>
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
                let detalle = credito.finalidad["finalidad-tipo"];
                if(credito.finalidad["finalidad-tipo"] == "vehiculo" && credito.finalidad?.["finalidad-vehiculo-tipo"]) detalle += " - " + (credito.finalidad["finalidad-vehiculo-tipo"] || "");
                if(credito.finalidad["finalidad-tipo"] == "vivienda" && credito.finalidad?.["finalidad-vivienda-accion"]) detalle += " - " + (credito.finalidad["finalidad-vivienda-accion"] || "");
                if(credito.finalidad["finalidad-tipo"] == "general" && credito.finalidad?.["finalidad-detalle-general"]) detalle += " - " + (credito.finalidad["finalidad-detalle-general"] || "");

                let contenido = `
                <div class="text-left">
                    <b>Crédito #${credito.numero}</b><br>
                    <b>Detalle: </b>${detalle}<br>
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
        $("#tabla-cuotas tfoot").html("");
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
        // modal.show inserta solamente el contenido interno de #modal-generar-cuotas,
        // por lo que ese id no existe dentro del modal visible.
        const $numerosCuotas = $("#modal .modal-body input[type='number']");
        const actualizarNumerosCuotas = () => $numerosCuotas.trigger("smallSimpleNumber");
        utils.smallSimpleNumber($numerosCuotas);
        $("#modal .modal-body").on("input change", "input[type='number']", () => {
            setTimeout(actualizarNumerosCuotas, 0);
        });
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
                await modal.hide(true);
                await modal.message("Recuerde acreditar manualmente la salida del dinero en la caja correspondiente para que el saldo se vea reflejado correctamente.");
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

        let acumuladores = this.creditoActual.cuotas.reduce((acc, cuota)=>{
            if(cuota.eliminado) return acc;
            const montoCapital = Number(cuota.montoCapital) || 0;
            const montoInteres = Number(cuota.montoInteres) || 0;
            const montoCuota = Number(cuota.monto) || 0;
            acc.montoCapital = (acc.montoCapital || 0) + montoCapital;
            acc.montoInteres = (acc.montoInteres || 0) + montoInteres;
            acc.montoTotal = (acc.montoTotal || 0) + montoCuota;
            acc.cantidad = (acc.cantidad || 0) + 1;
            if(cuota.tasaInteres !== undefined && cuota.tasaInteres !== null && cuota.tasaInteres !== "" && Number.isFinite(Number(cuota.tasaInteres))){
                acc.tasasInteres = acc.tasasInteres || [];
                acc.tasasInteres.push(Number(cuota.tasaInteres));
            }
            if(cuota.cobrado){
                acc.montoCobrado = (acc.montoCobrado || 0) + montoCuota;
                acc.cantidadCobrada = (acc.cantidadCobrada || 0) + 1;
            }else{
                acc.montoPendiente = (acc.montoPendiente || 0) + montoCuota;
                acc.cantidadPendiente = (acc.cantidadPendiente || 0) + 1;
            }
            return acc;
        }, {});

        const tasasInteres = [...new Set((acumuladores.tasasInteres || []).map(tasa => tasa.toFixed(2)))];
        const detalleInteres = tasasInteres.length === 1
            ? ` (${utils.formatNumber(tasasInteres[0], 2)}%)`
            : tasasInteres.length > 1 ? " (tasas variables)" : "";

        let tfoot = `
        <tr>
            <td colspan='3' class='font-weight-bold text-right'>
                Monto total capital
            </td>
            <td class='text-right text-monospace'>
                ${utils.formatNumber(acumuladores.montoCapital || 0)}
            </td>
        </tr>
        <tr>
            <td colspan='3' class='font-weight-bold text-right'>
                Monto interés${detalleInteres}
            </td>
            <td class='text-right text-monospace'>
                ${utils.formatNumber(acumuladores.montoInteres || 0)}
            </td>
        </tr>
        <tr>
            <td colspan='3' class='font-weight-bold text-right'>
                Monto total (capital + interés)
            </td>
            <td class='text-right text-monospace'>
                ${utils.formatNumber(acumuladores.montoTotal || 0)}
            </td>
        </tr>
        <tr>
            <td colspan='3' class='font-weight-bold text-right'>
                Cobrado
            </td>
            <td class='text-right text-monospace'>
                ${utils.formatNumber(acumuladores.montoCobrado || 0)}
            </td>
        </tr>
        <tr>
            <td colspan='3' class='font-weight-bold text-right'>
                Monto restante
            </td>
            <td class='text-right text-monospace'>
                ${utils.formatNumber(acumuladores.montoPendiente || 0)}
            </td>
        </tr>
        <tr>
            <td colspan='3' class='font-weight-bold text-right'>
                Cuotas
            </td>
            <td class='text-right text-monospace'>
                ${utils.formatNumber(acumuladores.cantidadCobrada || 0)} de ${utils.formatNumber(acumuladores.cantidad || 0)}
            </td>
        </tr>
        `;
        $("#tabla-cuotas tfoot").html(tfoot);
    }
    modalCuota(cuota){
        console.log(cuota);
        let cobro = null; //guardo si la cuota tiene un cobro asociado
        const montoOriginalCuota = Number(cuota.monto) || 0;
        let montoCobroCuota = montoOriginalCuota;

        modal.show({
            title: "Cuota",
            body: $("#modal-cuota").html(),
            size: "lg",
            buttons: "back"
        })
        let punit = Number(window.primordial.punitorios);

        const mostrarVistaCuota = vista => {
            $("#modal [data-seccion-cuota]").addClass("d-none");
            $(`#modal [data-seccion-cuota='${vista}']`).removeClass("d-none");

            const $botonesVista = $("#modal [name='vista-cuota']");
            $botonesVista.removeClass("btn-primary active").addClass("btn-outline-primary");
            $botonesVista.filter(`[data-vista='${vista}']`)
                .removeClass("btn-outline-primary")
                .addClass("btn-primary active");
        };
        $("#modal [name='vista-cuota']").on("click", ev => {
            mostrarVistaCuota($(ev.currentTarget).data("vista"));
        });
        mostrarVistaCuota("cobrar");

        //modificar eliminar
        $("#modal [name='numero']").val(cuota.numero);
        $("#modal [name='vencimiento']").val(fechasTemporal.toString(cuota.vencimiento));
        $("#modal [name='monto']").val(cuota.monto);
        $("#modal [name='montoCapital']").val(utils.formatNumber(cuota.montoCapital));
        $("#modal [name='montoInteres']").val(utils.formatNumber(cuota.montoInteres));
        const $numerosCuota = $("#modal [name='monto'], #modal [name='punitorios']");
        const actualizarNumerosCuota = () => $numerosCuota.trigger("smallSimpleNumber");
        utils.smallSimpleNumber($numerosCuota);
        
        //cobrar imprimir
        const actualizarTotalCobro = () => {
            const punitorios = Number($("#modal [name='punitorios']").val()) || 0;
            $("#modal [name='montoCuota']").val(utils.formatNumber(montoCobroCuota));
            $("#modal [name='total']").val(utils.formatNumber(montoCobroCuota + punitorios));
            actualizarNumerosCuota();
        };
        actualizarTotalCobro();

        let dif = fechasTemporal.diffDays(new Date(), cuota.vencimiento);
        let diasMora = 0;
        if(dif < 0){
            diasMora = Math.abs(dif);
            let aux = parseInt(Math.abs(cuota.monto * punit));
            let totalPunitorios = parseInt(aux * diasMora);
            let fox = aux + " x día (" + diasMora + " días)";
            $("#modal [name='lbPunitorios']").html(fox);
            $("#modal [name='punitorios']").val(totalPunitorios);
            actualizarTotalCobro();
        }

        //si modifico punitoros, q no se muestre el detalle
        $("#modal [name='punitorios']").on("change", ev=>{
            let ele = $(ev.currentTarget);
            let v = ele.val();
            actualizarTotalCobro();
            ele.parent().find("small[name='lbPunitorios']").addClass("d-none");
        });

        $("#modal [name='editar-monto-cuota']").on("click", async ev=>{
            if(cuota.cobrado) return;

            const boton = $(ev.currentTarget);
            const valor = await modal.addPopover({
                querySelector: boton,
                type: "input",
                label: "Importe a cobrar",
                inputType: "number",
                value: montoCobroCuota
            });
            if(valor === null) return;

            const nuevoMonto = Number(valor);
            if(!Number.isFinite(nuevoMonto) || nuevoMonto <= 0){
                return modal.addPopover({querySelector: boton, message: "Ingrese un importe mayor a cero."});
            }
            if(nuevoMonto > montoOriginalCuota){
                return modal.addPopover({querySelector: boton, message: "El importe no puede ser superior al monto original de la cuota."});
            }

            montoCobroCuota = Number(nuevoMonto.toFixed(2));
            actualizarTotalCobro();
        });
        
        let optMetodos = window.primordial.cajas.map(c=>`<option value="${c}">${c}</option>`);
        $("#modal [name='metodo']").html(optMetodos.join(""));

        if(cuota.cobrado){
            $("#modal .modal-body input").attr("disabled", true);
            $("#modal .modal-body select").attr("disabled", true);
            $("#modal .modal-body textarea").attr("disabled", true);
            $("#modal .modal-body button:not([name='vista-cuota'])").attr("disabled", true);
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
            $("#modal [name='editar-monto-cuota']").prop("disabled", true);
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
            let resp = await modal.addPopover({querySelector: ele, type: "yesno", message: "Al eliminar la cuota quedará desfazado temporalmente el capital e interes prestado. ¿Confirma eliminar esta cuota?."});
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
                    montoCuota: montoCobroCuota,
                    montoPunitorios: punitorios,
                    diasMora: diasMora,
                    metodo: $("#modal [name='metodo']").val(),
                    detalle: $("#modal [name='detalle']").val(),
                };
                let resp = await $.post("/creditos-personales/cobrar-cuota", datos);
                console.log(resp);
                Object.assign(this.creditoActual, resp.credito);
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
            let w = window.open("/html/recibo.html?creditoId=" + creditoId + "&cuotaId=" + cuotaId + "&v=" + Date.now(), "_blank");
        });
    }
    modalResumen(){
        modal.show({
            title: "Resumen de créditos",
            body: $("#modal-resumen").html(),
            size: "lg",
            buttons: "back"
        });

        // Set current month
        let ahora = new Date();
        let mesActual = ahora.getFullYear() + "-" + String(ahora.getMonth() + 1).padStart(2, "0");
        $("#modal [name='mes']").val(mesActual);

        const llenarGeneral = () => {
            let hoy = fechasTemporal.toString();
            let totalCreditos = this.listado.length;
            let cuotasVencidas = 0, clientesConVencidas = 0;
            let montoTotalPrestado = 0, punitoriosCobrados = 0, margenBeneficios = 0;
            let capitalRecuperar = 0, capitalRecuperado = 0;
            let interesGanar = 0, interesCobrado = 0;

            for(let credito of this.listado){
                let tieneVencida = false;
                for(let cuota of (credito.cuotas || [])){
                    if(cuota.eliminado) continue;

                    capitalRecuperar += cuota.montoCapital || 0;
                    if(cuota.cobrado) capitalRecuperado += cuota.montoCapital || 0;
                    interesGanar += cuota.montoInteres || 0;
                    if(cuota.cobrado) interesCobrado += cuota.montoInteres || 0;
                    
                    montoTotalPrestado += cuota.montoCapital || 0;
                    if(!cuota.cobrado && cuota.vencimiento && hoy > cuota.vencimiento){
                        cuotasVencidas++;
                        tieneVencida = true;
                    }
                }
                if(tieneVencida) clientesConVencidas++;
                for(let cobro of (credito.cobros || [])){
                    if(cobro.eliminado) continue;
                    punitoriosCobrados += cobro.montoPunitorios || 0;
                    margenBeneficios += (cobro.montoInteres || 0) + (cobro.montoPunitorios || 0);
                }
            }

            let rows = [
                ["Créditos dados", totalCreditos],
                ["Cuotas vencidas", cuotasVencidas],
                ["Cuotas vencidas (1 por cliente)", clientesConVencidas],
                ["Monto total prestado", "$" + utils.formatNumber(utils.decimals(montoTotalPrestado, 2))],
                ["Punitorios cobrados", "$" + utils.formatNumber(utils.decimals(punitoriosCobrados, 2))],
                ["Margen de beneficios", "$" + utils.formatNumber(utils.decimals(margenBeneficios, 2))],
                ["Capital a recuperar", "$" + utils.formatNumber(utils.decimals(capitalRecuperar, 2))],
                ["Capital recuperado", "$" + utils.formatNumber(utils.decimals(capitalRecuperado, 2))],
                ["Interés a ganar", "$" + utils.formatNumber(utils.decimals(interesGanar, 2))],
                ["Interés cobrado", "$" + utils.formatNumber(utils.decimals(interesCobrado, 2))],
            ];
            $("#modal #tabla-resumen-general tbody").html(
                rows.map(([d, v]) => `<tr><td>${d}</td><td class="text-right">${v}</td></tr>`).join("")
            );
        };

        const llenarMensual = (mes) => {
            let totalCreditos = 0, cuotasVencidas = 0, clientesConVencidas = 0;
            let montoTotalPrestado = 0, punitoriosCobrados = 0, margenBeneficios = 0;
            let capitalRecuperar = 0, capitalRecuperado = 0;
            let interesGanar = 0, interesCobrado = 0;

            for(let credito of this.listado){
                if(credito.createdAt && String(credito.createdAt).substring(0, 7) === mes){
                    totalCreditos++;
                    for(let cuota of (credito.cuotas || [])){
                        if(!cuota.eliminado) montoTotalPrestado += cuota.montoCapital || 0;
                        if(!cuota.eliminado) capitalRecuperar += cuota.montoCapital || 0;
                        if(!cuota.eliminado && cuota.cobrado) capitalRecuperado += cuota.montoCapital || 0;
                        if(!cuota.eliminado) interesGanar += cuota.montoInteres || 0;
                        if(!cuota.eliminado && cuota.cobrado) interesCobrado += cuota.montoInteres || 0;
                    }
                }
                let tieneVencida = false;
                for(let cuota of (credito.cuotas || [])){
                    if(cuota.eliminado) continue;
                    if(!cuota.cobrado && cuota.vencimiento && String(cuota.vencimiento).substring(0, 7) === mes){
                        cuotasVencidas++;
                        tieneVencida = true;
                    }
                }
                if(tieneVencida) clientesConVencidas++;
                for(let cobro of (credito.cobros || [])){
                    if(cobro.eliminado) continue;
                    if(String(cobro.createdAt || "").substring(0, 7) === mes){
                        punitoriosCobrados += cobro.montoPunitorios || 0;
                        margenBeneficios += (cobro.montoInteres || 0) + (cobro.montoPunitorios || 0);
                    }
                }
            }

            let rows = [
                ["Créditos dados en el mes", totalCreditos],
                ["Cuotas vencidas en el mes", cuotasVencidas],
                ["Cuotas vencidas en el mes (1 por cliente)", clientesConVencidas],
                ["Monto prestado en el mes", "$" + utils.formatNumber(utils.decimals(montoTotalPrestado, 2))],
                ["Capital a recuperar en el mes", "$" + utils.formatNumber(utils.decimals(capitalRecuperar, 2))],
                ["Capital recuperado en el mes", "$" + utils.formatNumber(utils.decimals(capitalRecuperado, 2))],
                ["Interés a ganar en el mes", "$" + utils.formatNumber(utils.decimals(interesGanar, 2))],
                ["Interés cobrado en el mes", "$" + utils.formatNumber(utils.decimals(interesCobrado, 2))],
                ["Punitorios cobrados en el mes", "$" + utils.formatNumber(utils.decimals(punitoriosCobrados, 2))],
                ["Margen de beneficios en el mes", "$" + utils.formatNumber(utils.decimals(margenBeneficios, 2))],
            ];
            $("#modal #tabla-resumen-mensual tbody").html(
                rows.map(([d, v]) => `<tr><td>${d}</td><td class="text-right">${v}</td></tr>`).join("")
            );
        };

        llenarGeneral();
        llenarMensual(mesActual);

        $("#modal [name='mes']").on("change", ev => {
            let m = $(ev.currentTarget).val();
            if(m) llenarMensual(m);
        });
    }
    async modalResumenCaja(){
        const cajas = window.primordial.cajas || [];
        if(!cajas.length){
            menu.toast({level: "warning", message: "No hay cajas configuradas"});
            return;
        }

        modal.show({
            title: "Resumen de caja",
            body: $("#modal-resumen-caja").html(),
            size: "lg",
            buttons: "back"
        });

        const escapeHtml = (valor) => $("<div>").text(valor || "").html();
        const opciones = cajas.map(caja => `<option value="${escapeHtml(caja)}">${escapeHtml(caja)}</option>`);
        const $cajas = $("#modal [name='caja']");
        const $monto = $("#modal [name='monto-caja']");
        const $tipo = $("#modal [name='tipo-movimiento-caja']");
        const $nuevoSaldo = $("#modal [name='nuevo-saldo-caja']");
        const $registrar = $("#modal [name='registrar-caja']");
        let registros = [];
        let cajaActual = cajas[0];

        $cajas.html(opciones.join("")).val(cajaActual);

        const actualizarFormulario = () => {
            const esIngreso = $tipo.val() === "ingreso";
            const monto = Number($monto.val()) || 0;
            const saldoActual = Number(registros[0]?.saldo) || 0;
            const saldoNuevo = saldoActual + (esIngreso ? monto : -monto);

            $nuevoSaldo
                .val(`$ ${utils.formatNumber(saldoNuevo)}`)
                .toggleClass("text-success", esIngreso)
                .toggleClass("text-danger", !esIngreso);
            $monto.toggleClass("border-success", esIngreso).toggleClass("border-danger", !esIngreso);
            $registrar
                .removeClass("btn-success btn-danger")
                .addClass(esIngreso ? "btn-success" : "btn-danger")
                .text(esIngreso ? "Registrar ingreso" : "Registrar egreso");
        };

        const mostrarRegistros = () => {
            const filas = registros.map(registro => {
                const esIngreso = Number(registro.monto) >= 0;
                const clase = esIngreso ? "table-success" : "table-danger";
                const signo = esIngreso ? "+" : "-";
                const icono = esIngreso ? "arrow-up" : "arrow-down";
                return `<tr class="${clase}">
                    <td>${fechasTemporal.toString(registro.createdAt, "arg")}</td>
                    <td>${escapeHtml(registro.detalle) || "-"}</td>
                    <td class="text-right font-weight-bold ${esIngreso ? "text-success" : "text-danger"}">
                        <i class="fas fa-${icono}"></i> ${signo} $ ${utils.formatNumber(Math.abs(Number(registro.monto) || 0))}
                    </td>
                    <td class="font-weight-bold text-right">$ ${utils.formatNumber(Number(registro.saldo) || 0)}</td>
                </tr>`;
            });
            $("#modal #tabla-resumen-caja tbody").html(filas.join("") || "<tr><td colspan='4' class='text-center text-muted'>No hay movimientos registrados</td></tr>");
            actualizarFormulario();
        };

        const cargarRegistros = async (caja) => {
            cajaActual = caja;
            $("#modal #tabla-resumen-caja tbody").html("<tr><td colspan='4' class='text-center'>Cargando...</td></tr>");
            try{
                registros = await $.get("/creditos-personales/resumen-caja", {caja});
                mostrarRegistros();
            }catch(e){
                registros = [];
                mostrarRegistros();
                menu.toast({level: "danger", message: e?.responseText || "No se pudieron obtener los registros de caja"});
            }
        };

        $cajas.on("change", ev => {
            const caja = $(ev.currentTarget).val();
            $cajas.val(caja);
            cargarRegistros(caja);
        });
        $tipo.on("change", actualizarFormulario);
        $monto.on("input", actualizarFormulario);
        $registrar.on("click", async () => {
            const monto = Number($monto.val());
            const detalle = $("#modal [name='detalle-caja']").val().trim();
            const tipo = $tipo.val();
            if(!Number.isFinite(monto) || monto <= 0){
                menu.toast({level: "warning", message: "Ingrese un monto mayor a cero"});
                return;
            }
            if(!detalle){
                menu.toast({level: "warning", message: "Ingrese el detalle del movimiento"});
                return;
            }

            $registrar.prop("disabled", true);
            try{
                await $.post("/creditos-personales/registrar-caja", {caja: cajaActual, tipo, monto, detalle});
                $monto.val("");
                $("#modal [name='detalle-caja']").val("");
                await cargarRegistros(cajaActual);
                menu.toast({level: "success", message: `Se registró el ${tipo} de caja`});
            }catch(e){
                menu.toast({level: "danger", message: e?.responseText || "No se pudo registrar el movimiento"});
            }finally{
                $registrar.prop("disabled", false);
            }
        });

        await cargarRegistros(cajaActual);
    }
    async exportarExcel(){
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Créditos Personales');

        const encabezado = (cell, value, width=null) => {
            cell.font = { bold: true }; // Texto en negrita
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: '579DFF' }
            };
            if(value) cell.value = value;
            if(width !== null) worksheet.getColumn(cell.col).width = width;
        }

        const formatearColumna = (column, format, initialRow=2) => {
            worksheet.getColumn(column).eachCell({includeEmpty: false}, (cell, rowNumber) => {
                if(rowNumber >= initialRow) Object.assign(cell, format);
            });
        }

        encabezado( worksheet.getCell("A1"), "Cliente", 35 );
        encabezado( worksheet.getCell("B1"), "Dirección", 35 );
        encabezado( worksheet.getCell("C1"), "Teléfono", 20 );
        encabezado( worksheet.getCell("D1"), "Monto total capital", 20 );
        encabezado( worksheet.getCell("E1"), "Monto interés (tasa aplicada)", 24 );
        encabezado( worksheet.getCell("F1"), "Porcentaje aplicado", 20 );
        encabezado( worksheet.getCell("G1"), "Monto total (capital + interés)", 27 );
        encabezado( worksheet.getCell("H1"), "Monto cobrado", 18 );
        encabezado( worksheet.getCell("I1"), "Monto restante", 18 );
        encabezado( worksheet.getCell("J1"), "Cuotas", 16 );
        encabezado( worksheet.getCell("K1"), "Monto próxima cuota", 22 );
        encabezado( worksheet.getCell("L1"), "Detalle", 50 );
        encabezado( worksheet.getCell("M1"), "Observación", 50 );

        let filaInicial = 2;
        let ind = 0;
        for(let credito of this.listado){
            let cuotasTotales = 0, cuotasCobradas = 0, montoCapital = 0, montoInteres = 0, montoTotal = 0, montoCobrado = 0, montoPendiente = 0;
            const cuotasActivas = (credito?.cuotas || []).filter(c => !c.eliminado);
            const tasasInteres = [];
            cuotasActivas.forEach(c=>{
                cuotasTotales++;
                montoCapital += Number(c.montoCapital) || 0;
                montoInteres += Number(c.montoInteres) || 0;
                montoTotal += Number(c.monto) || 0;
                if(c.tasaInteres !== undefined && c.tasaInteres !== null && c.tasaInteres !== "" && Number.isFinite(Number(c.tasaInteres))){
                    tasasInteres.push(Number(c.tasaInteres));
                }
                if(c.cobrado){
                    cuotasCobradas++;
                    montoCobrado += Number(c.monto) || 0;
                }else{
                    montoPendiente += Number(c.monto) || 0;
                }
            });

            const datos = credito.datosGenerales || {};
            const nombre = [datos["datos-personales-apellidos"], datos["datos-personales-nombres"]]
                .filter(valor => valor && String(valor).trim())
                .join(" ") || "-";
            const direccion = [datos["direccion-calle"], datos["direccion-localidad"], datos["direccion-provincia"]]
                .filter(valor => valor && String(valor).trim())
                .join(", ") || "-";
            const tasasUnicas = [...new Set(tasasInteres.map(tasa => tasa.toFixed(2)))];
            const porcentajeAplicado = tasasUnicas.length === 1
                ? Number(tasasUnicas[0]) / 100
                : tasasUnicas.length > 1 ? "Tasas variables" : "-";
            const proximaCuota = cuotasActivas
                .filter(c => !c.cobrado)
                .sort((a, b) => (a.vencimiento || "9999-12-31").localeCompare(b.vencimiento || "9999-12-31"))[0];
            const fila = filaInicial + ind;

            worksheet.getCell("A" + fila).value = nombre;
            worksheet.getCell("B" + fila).value = direccion;
            worksheet.getCell("C" + fila).value = datos["contacto-telefono"] || "-";
            worksheet.getCell("D" + fila).value = montoCapital;
            worksheet.getCell("E" + fila).value = montoInteres;
            worksheet.getCell("F" + fila).value = porcentajeAplicado;
            worksheet.getCell("G" + fila).value = montoTotal;
            worksheet.getCell("H" + fila).value = montoCobrado;
            worksheet.getCell("I" + fila).value = montoPendiente;
            worksheet.getCell("J" + fila).value = `${cuotasCobradas} de ${cuotasTotales}`;
            worksheet.getCell("K" + fila).value = Number(proximaCuota?.monto) || 0;
            worksheet.getCell("L" + fila).value = datos["datos-personales-detalle"] || "";
            worksheet.getCell("M" + fila).value = datos.observaciones || "";
            ind++;
        }

        const formatoMonto = {numFmt: '#,##0.00'};
        ["D", "E", "G", "H", "I", "K"].forEach(column => formatearColumna(column, formatoMonto));
        formatearColumna("F", {numFmt: '0.00%'});
        ["L", "M"].forEach(column => formatearColumna(column, {alignment: {wrapText: true, vertical: "top"}}));

        const blob = await workbook.xlsx.writeBuffer();
        saveAs(new Blob([blob], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'creditos-personales.xlsx');
    }
}
