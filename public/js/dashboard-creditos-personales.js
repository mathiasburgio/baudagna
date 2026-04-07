class DashboardCreditosPersonales {
    constructor(initHTML=true){
        this.creditos = [];
        this.cuotas = [];

        this.mensajesWhatsapp = {
                cuotaPendiente: [
                    "Hola ¿cómo estás?",
                    "Te contactamos de ATN para informarte que registrás una cuota pendiente de pago.",
                    "\n",
                    "Cuando puedas, te pedimos que la regularices. Y si necesitás una mano o tenés alguna duda, podés escribirnos sin problema.",
                    "\n",
                    "Si ya pagaste, no hace falta que tengas en cuenta este mensaje.",
                    "\n",
                    "¡Gracias!",
                    "\n",
                    "EQUIPO ATN"
                ],
                proximoVencimiento: [
                    "Hola ¿cómo estás?😊",
                    "Te escribimos de ATN para avisarte que tu cuota está por vencer en los próximos días.\n\n",
                    "\n",   
                    "La idea es recordártelo con tiempo así podés organizarte tranquilo/a. No es necesario responder este mensaje. Si necesitás algún dato o ayuda, estamos a disposición.",
                    "\n",   
                    "¡Gracias por acompañarnos!",
                    "EQUIPO ATN",
                ]
        };


        if(initHTML) this.initHTML();
    }
    async initHTML(){
        await boilerplate(true);   
        await this.obtenerCreditos();
        
        this.crud = new SimpleCRUD({
            list: this.creditos,
            searchProps: ["datos-personales-apellidos", "datos-personales-nombres", "datos-personales-dni", "datos-personales-telefono"],
            structure: [
                {
                    label: "Cliente",
                    prop: "-",
                    width: "calc(100% - 130px)",
                    fn: (e, f) => {
                        let resp = f.datosGenerales["datos-personales-apellidos"] + " " + f.datosGenerales["datos-personales-nombres"];
                        return resp;
                    }
                },
                {
                    label: "Prox. Vto.",
                    prop: "---",
                    width: "130px",
                    right: true,
                    fn: (e, f) => {

                        let cuota = (f?.cuotas || []).find(c=> !c.cobrado);
                        let aux = this.obtenerSaldoCuota(f, cuota);
                        let span = "-";
                        if(aux.diasVencido > 0) span = `<span class='badge badge-danger mr-1'>${aux.diasVencido}</span>`;
                        else if(aux.diasVencido === 0)  span = `<span class='badge badge-warning mr-1'>HOY</span>`;
                        else if(aux.diasVencido < 0 && aux.diasVencido >= -5) span = `<span class='badge badge-warning mr-1'>${Math.abs(aux.diasVencido)}</span>`;
                        else if(aux.diasVencido < -5) span = `<span class='badge badge-success mr-1'>${Math.abs(aux.diasVencido)}</span>`;
                        return `<small>${span} ${fechasTemporal.toString(cuota?.vencimiento, "arg")}</small>`;
                    }
                }
            ],
            afterSelect: (item) => {
                for(let key in item.datosGenerales){
                    $(`#datos-generales [name="${key}"]`).val(item.datosGenerales[key]);
                }
                for(let key in item.finalidad){
                    $(`#finalidad [name="${key}"]`).val(item.finalidad[key]);
                }
                $(`#finalidad [name="finalidad-tipo"]`).change();

                $("#cuotas tbody").html("");
                if(item.cuotas) this.listarCuotas();

                console.log(item);
                $("[crud='btModify']").click();
            },
            afterClear: () => {
                $("#datos-generales input, #datos-generales select, #datos-generales textarea, #datos-generales button").val("").prop("disabled", true);
                $("#finalidad input, #finalidad select, #finalidad textarea, #finalidad button").val("").prop("disabled", true);
            },
            fnSearch: (p, l) => {
                let px = utils.simplifyString(p);
                return l.filter(item => {
                    let apellidos = utils.simplifyString(item.datosGenerales?.["datos-personales-apellidos"] || "");
                    let nombres = utils.simplifyString(item.datosGenerales?.["datos-personales-nombres"] || "");
                    let dni = utils.simplifyString(item.datosGenerales?.["datos-personales-dni"] || "");
                    let telefono = utils.simplifyString(item.datosGenerales?.["datos-personales-telefono"] || "");
                    return apellidos.includes(px) || nombres.includes(px) || dni.includes(px) || telefono.includes(px);
                });
            },
            fnDblClick: async (element)=>{
                $("[crud='btModify']").click();
            },
            afterSearch: ()=>{
                let listado = this.crud._search.ar;
                $("#container-main-table tbody tr").each((ind, ele)=>{
                    let $ele = $(ele);
                    $ele.popover({
                        trigger: "hover",
                        html: true,
                        placement: "top",
                        container: "body",
                        content: function(){
                            let tr = $(this);
                            let _id = tr.attr("idd");
                            let credito = listado.find(c => c._id.toString() == _id.toString());
                            let cuotas = (credito.cuotas || []).filter(c => c.eliminado != true);
                            let cobros = (credito.cobros || []).filter(cobro => cobro.eliminado != true);
                            let cuotasCobradas = cuotas.filter(c => c.cobrado == true);
                            let fox = `
                            Cuotas: ${cuotas.length}<br>
                            Cobros: ${cobros.length}<br>
                            Observaciones: ${credito.datosGenerales?.observaciones || "-"}`;
                            return fox;
                        }
                    })
                });
            }
        });
        this.crud.setTable($("#container-main-table"));
        this.crud.inicialize("mongodb");

        $("[crud='btNew']").on("click", ev=>{
            this.crud.onNew();
            $("#datos-generales input, #datos-generales select, #datos-generales textarea, #datos-generales button").prop("disabled", false);
            $("#finalidad input, #finalidad select, #finalidad textarea, #finalidad button").prop("disabled", false);
            $("#finalidad [name='finalidad-tipo']").val("general").change();
            $("#cuotas tbody").html("");
        });

        $("[crud='btModify']").on("click", ev=>{
            if (typeof this.crud.element == "undefined") return modal.message("Seleccione un CREDITO para realizar esta acción");
            this.crud.onModify(false);
            $("#datos-generales input, #datos-generales select, #datos-generales textarea, #datos-generales button").prop("disabled", false);
            $("#finalidad input, #finalidad select, #finalidad textarea, #finalidad button").prop("disabled", false);
        })
        $("[crud='btDelete']").on("click", async ev=>{
            if (typeof this.crud.element == "undefined") return modal.message("Seleccione un CREDITO para realizar esta acción");
            let confirm = await modal.yesno("¿Confirma eliminar este crédito?");
            if(!confirm) return;
            let resp = await $.post({
                    url: "/dashboard/creditos-personales/eliminar-credito",
                    data: {
                        creditoId: this.crud.element._id
                    }
                })
            this.crud.removeSelected();
            menu.toast({level: "success", message: "Crédito eliminado con éxito"});
        })

        $("[crud='txSearch']").on("input", ev=>{
            this.crud.search(ev.currentTarget.value);
        });

        //datos generales
        $("#datos-generales [name='guardar']").on("click", ()=> this.guardarDatosGenerales() );


        //finalidad
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
        $("#finalidad [name='guardar']").on("click", ()=> this.guardarFinalidad() );


        //cuotas
        $("#cuotas [name='generar-cuotas']").on("click", ()=> this.generarCuotas() );

        $("#cuotas [name='agregar-cuota']").on("click", async ev=>{
            if(!this.crud?.element?._id) return menu.toast({level: "warning", message: "Primero guarde los datos generales para luego agregar cuotas"});
            let confirm = await modal.yesno("¿Confirma agregar cuota?");
            if(!confirm) return;

            let resp = await $.post({
                url: "/dashboard/creditos-personales/upsert-cuota",
                data: {
                    creditoId: this.crud.element._id,
                    cuotaId: null,
                    cuota: {
                        numero: 99,
                        vencimiento: fechasTemporal.toString(),
                        monto: 100,
                        cobrado: false,
                    }
                }
            })
            Object.assign(this.crud.element, resp);
            this.listarCuotas();
            menu.toast({level: "success", message: "Cuota guardada con éxito"});
        });
        $("#cuotas [name='listar-cobros']").on("click", async ev=>{
            let ele = this.crud.element;
            if(!ele) return menu.toast({level: "warning", message: "Seleccione un crédito para realizar esta acción"}); 
            this.modalListarCobros();
        });

        $("[name='acciones'] [name='cobrar']").on("click", ev=>{
            let ele = this.crud.element;
            if(!ele) return menu.toast({level: "warning", message: "Seleccione un crédito para realizar esta acción"}); 
            let cuota = ele.cuotas.find(c=>c.cobrado == false);
            if(!cuota) return menu.toast({level: "warning", message: "No hay cuotas para cobrar"});
            this.modalCobrarCuota(cuota);
        });

        $("[name='acciones'] [name='whatsapp']").on("click", async ev=>{
            let ele = this.crud.element;
            if(!ele) return menu.toast({level: "warning", message: "Seleccione un crédito para realizar esta acción"});
            let num = ele.datosGenerales?.["contacto-telefono"] || "";
            let aux = await modal.prompt({type:"text", label: "Número", value: num});
            if(!aux) return;
            if(aux.startsWith("549")) aux = aux.slice(3); //quito el 549 para evitar problemas con el formato internacional de whatsapp
            
            let mensaje = $(ev.currentTarget).attr("msj");
            let msj = this.mensajesWhatsapp[mensaje].join("\n");

            let w = window.open(`https://wa.me/549${aux.replace(/\D/g, "")}?text=${encodeURIComponent(msj)}`, "_blank");
        });

        // oculto el menu
        $("[data-widget='pushmenu']").click();
        
        //oculto la cortina
        menu.hideCortina();
    }
    async guardarDatosGenerales(){
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
            data.creditoId = (this.crud.isNew) ? null : this.crud.element._id;
            if(data["datos-personales-apellidos"] == "" || data["datos-personales-nombres"] == "") return menu.toast({level: "warning", message: "Los campos Apellidos y Nombres son obligatorios"});

            let resp = await $.post({
                url: "/dashboard/creditos-personales/guardar-datos-generales",
                data: data,
            })

            this.crud.afterSave(resp);

            menu.toast({level: "success", message: "Guardado con éxito"});
        }catch(err){
            console.log(err);
            menu.toast({level: "danger", message: "Error al guardar"});
        }
    }
    async guardarFinalidad(){
        if(!this.crud?.element?._id) return menu.toast({level: "warning", message: "Primero guarde los datos generales para luego guardar la finalidad"});
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
            data.creditoId = this.crud.element._id;
    
            let resp = await $.post({
                url: "/dashboard/creditos-personales/guardar-finalidad",
                data: data,
            })
            console.log("guardar-finalidad", resp);
            this.crud.afterSave(resp);

            menu.toast({level: "success", message: "Guardado con éxito"});
        }catch(err){
            console.log(err);
            menu.toast({level: "danger", message: "Error al guardar"});
        }
    }
    async obtenerCreditos(){
        let resp = await $.get("/dashboard/creditos-personales/listar");
        this.creditos = resp;
        $("[crud='txSearch']").val("");
        if(this.crud){
            this.crud.list = this.creditos;
            this.crud.search("");
        } 
        return resp;
    }
    listarCuotas(){
        let rows = "";
        let punitorios = Number(primordial?.configuracion?.punitorios) || 0;
        this.crud.element.cuotas.forEach((c, i)=>{
            if(c?.eliminado === true) return;
            let cobros = this.crud?.element?.cobros?.filter(cobro => cobro.cuotaId === c._id && c.eliminado != true) || [];
            let sumaCobros = cobros.reduce((acc, cobro) =>{
                if(cobro?.eliminado != true) acc += cobro?.montoCuota || 0;
                return acc;
            }, 0);
            let labelDeuda = "";
            let trColor = "";
            if(c?.vencimiento < fechasTemporal.toString()){ //vencido
                let diff = Math.abs(fechasTemporal.diffDays(fechasTemporal.toString(), c.vencimiento));
                let restanteCuota = c.monto - sumaCobros;
                let montoPunitorios = punitorios * diff * restanteCuota ;
                labelDeuda = "$" + utils.formatNumber(restanteCuota + montoPunitorios);
                trColor = "table-danger";
            }else{
                if(c.cobrado){
                    labelDeuda = "COBRADO";
                    trColor = "table-success";
                }
                else labelDeuda = "$" + utils.formatNumber(c.monto);
            }

            rows += `<tr cuota-id="${c?._id}" class="${trColor}">
                <td>
                    ${c.numero}
                </td>
                <td>
                    ${fechasTemporal.toString(c.vencimiento, "arg")}
                </td>
                <td name="deuda">
                    ${labelDeuda}
                </td>
                <td class='text-right'>
                    <div class="dropdown">
                        <a class="btn btn-secondary btn-sm dropdown-toggle" href="#" role="button" data-toggle="dropdown" aria-expanded="false">
                            Acciones
                        </a>

                        <div class="dropdown-menu">
                            <a class="dropdown-item" name="cobrar" href="#">Cobrar</a>
                            <a class="dropdown-item" name="modificar" href="#">Modificar</a>
                            <a class="dropdown-item" name="eliminar" href="#">Eliminar</a>
                        </div>
                    </div>
                </td>
            </tr>`;
        });
        $("#cuotas tbody").html(rows);

        $("#cuotas tbody [name='modificar']").on("click", async ev=>{
            let tr = $(ev.currentTarget).closest("tr");
            let cuotaId = tr.attr("cuota-id");
            let cuota = this.crud.element.cuotas.find(c => c._id === cuotaId);
            
            //verifico si tiene cobros registrados
            if(this.crud.element.cobros?.find(cobro => cobro.cuotaId === cuotaId)){
                menu.toast({level: "warning", message: "No se puede modificar una cuota que ya tiene cobros registrados"});
                return;
            }

            this.modalEditarCuota(cuota);
        });

        $("#cuotas tbody [name='eliminar']").on("click", async ev=>{
            let tr = $(ev.currentTarget).closest("tr");
            let cuotaId = tr.attr("cuota-id");
            let cuota = this.crud.element.cuotas.find(c => c._id === cuotaId);
            //verifico si la cuota existe en BD o es una cuota nueva (sin id)
            if(Number(cuotaId) >= 0 && Number(cuotaId) < 200){
                this.cuotas = this.cuotas.filter(c => c.numero != cuota.numero);
                this.listarCuotas();
                return;
            }

            //verifico si tiene cobros registrados
            if(this.crud.element.cobros?.find(cobro => cobro.cuotaId === cuotaId)){
                menu.toast({level: "warning", message: "No se puede eliminar una cuota que ya tiene cobros registrados"});
                return;
            }

            let confirm = await modal.yesno("¿Confirma eliminar esta cuota?");
            if(!confirm) return;

            try{
                const resp = await $.post({
                    url: "/dashboard/creditos-personales/eliminar-cuota",
                    data: {
                        creditoId: this.crud.element._id,
                        cuotaId: cuotaId
                    }
                })
                console.log(resp);
                menu.toast({level: "success", message: "Cuota eliminada con éxito"});
                this.crud.element.cuotas = this.crud.element.cuotas.filter(c => c._id !== cuotaId);
                this.listarCuotas();
            }catch(err){
                console.log(err);
                menu.toast({level: "danger", message: "Error al eliminar la cuota"});
            }
        });

        $("#cuotas tbody [name='cobrar']").on("click", async ev=>{
            let tr = $(ev.currentTarget).closest("tr");
            let cuotaId = tr.attr("cuota-id");
            let cuota = this.crud.element.cuotas.find(c => c._id === cuotaId);
            if(cuota.cobrado) return menu.toast({level: "warning", message: "Esta cuota ya se encuentra cobrada"});
            this.modalCobrarCuota(cuota);
        });

        $("#cuotas tbody [name='cobros']").on("click", async ev=>{
            let tr = $(ev.currentTarget).closest("tr");
            let cuotaId = tr.attr("cuota-id");
            let cuota = this.crud.element.cuotas.find(c => c._id === cuotaId);
            this.modalListarCobros(cuota);
        });

        $("#cuotas tbody [name='deuda']").popover({
            content: function(ev){
                let row = $(this).closest("tr");
                let cuotaId = row.attr("cuota-id");
                //notese q llamo a la clase por la instancia "creditosPersonales"
                let cuota = creditosPersonales.crud.element.cuotas.find(c => c._id === cuotaId);

                let cobros = creditosPersonales.crud?.element?.cobros?.filter(cobro => cobro.cuotaId === cuota._id && cobro.eliminado != true) || [];
                let sumaCobros = cobros.reduce((acc, cobro) =>{
                    if(cobro?.eliminado != true) acc += cobro?.montoCuota || 0;
                    return acc;
                }, 0);

                let diasVencido = fechasTemporal.diffDays(cuota?.vencimiento, fechasTemporal.now());
                let restate = cuota.monto - sumaCobros;
                let montoPunitorios = (diasVencido * Number(primordial.configuracion.punitorios) * restate) || 0;

                let fox = "";
                fox += `Monto cuota: ${utils.formatNumber(cuota.monto)}<br>`;
                fox += `Monto cobrado: ${utils.formatNumber(sumaCobros)}<br>`;
                fox += `Restante: ${utils.formatNumber(restate)}<br>`;
                fox += `Días vencido: ${diasVencido > 0 ? diasVencido : 0}<br>`;
                fox += `Monto punitorios: ${utils.formatNumber(montoPunitorios)}<br>`;
                fox += `Total a pagar: ${utils.formatNumber(restate + montoPunitorios)}<br>`;
                return fox;
            },
            html: true,
            trigger: "hover"
        })
    }
    async generarCuotas(){
        if(!this.crud?.element?._id) return menu.toast({level: "warning", message: "Primero guarde los datos generales para luego generar las cuotas"});
        

        modal.show({
            title: "Generar cuotas",
            body: $("#modal-generar-cuotas").html(),
            size: "lg",
            buttons: "back"
        });

        $("#modal [name='fecha-primer-vencimiento']").val(fechasTemporal.toString());

        $("#modal [name='monto-solicitado']").on("change", ev=>{
            let $ele = $(ev.currentTarget);
            let v = $ele.val();
            $ele.parent().find("small").html("$" + utils.formatNumber(v || 0));

            let intereses = Number($("#modal [name='intereses']").val() || 0);
            let montoSolicitado = Number($("#modal [name='monto-solicitado']").val() || 0);
            let cantidadCuotas = Number($("#modal [name='cantidad-cuotas']").val() || 0);
            if(intereses > 0 && montoSolicitado > 0 && cantidadCuotas > 0){
                let montoTotal = montoSolicitado * (1 + intereses/100);
                let montoCuota = montoTotal / cantidadCuotas;
                $("#modal [name='monto-total']").val(montoTotal.toFixed(2));
                $("#modal [name='monto-total']").parent().find("small").html("$" + utils.formatNumber(montoTotal));
                $("#modal [name='monto-cuota']").val(montoCuota.toFixed(2));
                $("#modal [name='monto-cuota']").parent().find("small").html("$" + utils.formatNumber(montoCuota));
            }
        });

        $("#modal [name='intereses']").on("change", ev=>{
            let $ele = $(ev.currentTarget);
            let v = parseInt($ele.val()) || 0;
            //$ele.parent().find("small").html(utils.formatNumber(v || 0));
            
            let intereses = Number($("#modal [name='intereses']").val() || 0);
            let montoSolicitado = Number($("#modal [name='monto-solicitado']").val() || 0);
            let cantidadCuotas = Number($("#modal [name='cantidad-cuotas']").val() || 0);
            if(intereses > 0 && montoSolicitado > 0 && cantidadCuotas > 0){
                let montoTotal = montoSolicitado * (1 + intereses/100);
                let montoCuota = montoTotal / cantidadCuotas;
                $("#modal [name='monto-total']").val(montoTotal.toFixed(2));
                $("#modal [name='monto-total']").parent().find("small").html("$" + utils.formatNumber(montoTotal));
                $("#modal [name='monto-cuota']").val(montoCuota.toFixed(2));
                $("#modal [name='monto-cuota']").parent().find("small").html("$" + utils.formatNumber(montoCuota));
            }
        });
        $("#modal [name='cantidad-cuotas']").on("change", ev=>{
            let $ele = $(ev.currentTarget);
            let v = parseInt($ele.val()) || 0;
            let fechaPrimeraCuota = $("#modal [name='fecha-primer-vencimiento']").val();
            if(v && fechaPrimeraCuota){
                let fx = fechasTemporal.toString(fechaPrimeraCuota);
                fx.setMonth(fx.getMonth() + v);
                $("#modal [name='fecha-ultimo-vencimiento']").val(fechasTemporal.toString(fx, "usa"));
            }else{
                $("#modal [name='fecha-ultimo-vencimiento']").val("");
            }

            let intereses = Number($("#modal [name='intereses']").val() || 0);
            let montoSolicitado = Number($("#modal [name='monto-solicitado']").val() || 0);
            let cantidadCuotas = Number($("#modal [name='cantidad-cuotas']").val() || 0);
            if(intereses > 0 && montoSolicitado > 0 && cantidadCuotas > 0){
                let montoTotal = montoSolicitado * (1 + intereses/100);
                let montoCuota = montoTotal / cantidadCuotas;
                $("#modal [name='monto-total']").val(montoTotal.toFixed(2));
                $("#modal [name='monto-total']").parent().find("small").html("$" + utils.formatNumber(montoTotal));
                $("#modal [name='monto-cuota']").val(montoCuota.toFixed(2));
                $("#modal [name='monto-cuota']").parent().find("small").html("$" + utils.formatNumber(montoCuota));
            }
        });

        
        $("#modal [name='monto-total']").on("change", ev=>{
            let $ele = $(ev.currentTarget);
            let v = Number($ele.val()) || 0;
            $ele.parent().find("small").html("$" + utils.formatNumber(v));

            //let intereses = Number($("#modal [name='intereses']").val() || 0);
            let montoSolicitado = Number($("#modal [name='monto-solicitado']").val() || 0);
            let cantidadCuotas = Number($("#modal [name='cantidad-cuotas']").val() || 0);
            if(v > 0 && montoSolicitado > 0 && cantidadCuotas > 0){
                let montoCuota = v / cantidadCuotas;
                $("#modal [name='monto-cuota']").val(montoCuota.toFixed(2));
                $("#modal [name='monto-cuota']").parent().find("small").html("$" + utils.formatNumber(montoCuota));
                
                let intereses = ((v / montoSolicitado) - 1) * 100;
                $("#modal [name='intereses']").val(intereses.toFixed(2));
            } 
        });
        $("#modal [name='monto-cuota']").on("change", ev=>{
            let $ele = $(ev.currentTarget);
            let v = Number($ele.val()) || 0;
            $ele.parent().find("small").html("$" + utils.formatNumber(v));

            let montoSolicitado = Number($("#modal [name='monto-solicitado']").val() || 0);
            let cantidadCuotas = Number($("#modal [name='cantidad-cuotas']").val() || 0);
            if(v > 0 && montoSolicitado > 0 && cantidadCuotas > 0){
                let montoTotal = v * cantidadCuotas;
                $("#modal [name='monto-total']").val(montoTotal.toFixed(2));
                $("#modal [name='monto-total']").parent().find("small").html("$" + utils.formatNumber(montoTotal));

                let intereses = ((montoTotal / montoSolicitado) - 1) * 100;
                $("#modal [name='intereses']").val(intereses.toFixed(2));
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
        
        $("#modal [name='generar']").on("click", async ele=>{
            let $ele = $(ele.currentTarget);
            let data = {
                montoSolicitado: Number($("#modal [name='monto-solicitado']").val()),
                intereses: Number($("#modal [name='intereses']").val()),
                cantidadCuotas: Number($("#modal [name='cantidad-cuotas']").val()),
                fechaPrimerVencimiento: $("#modal [name='fecha-primer-vencimiento']").val(),
                fechaUltimoVencimiento: $("#modal [name='fecha-ultimo-vencimiento']").val(),
                montoTotal: Number($("#modal [name='monto-total']").val()),
                montoCuota: Number($("#modal [name='monto-cuota']").val())
            };
            if(!data.montoSolicitado) return menu.toast({level: "warning", message: "Ingrese el monto solicitado"});
            if(!data.cantidadCuotas) return menu.toast({level: "warning", message: "Ingrese la cantidad de cuotas"});
            if(!data.fechaPrimerVencimiento) return menu.toast({level: "warning", message: "Ingrese la fecha del primer vencimiento"});
            if(data.intereses < 0) return menu.toast({level: "warning", message: "Los intereses no pueden ser negativos"});
            if(data.montoSolicitado < 1000) return menu.toast({level: "warning", message: "El monto solicitado no puede ser menor a $1000"});
            if(data.cantidadCuotas < 1) return menu.toast({level: "warning", message: "La cantidad de cuotas no puede ser menor a 1"});
            //if(data.cantidadCuotas > 360) return menu.toast({level: "warning", message: "La cantidad de cuotas no puede ser mayor a 360"});
            //if(data.intereses > 100) return menu.toast({level: "warning", message: "Los intereses no pueden ser mayores a 100%"});
            
            $ele.prop("disabled", true);
            let cuotas = [];
            let fx = fechasTemporal.toString(data.fechaPrimerVencimiento);
            for(let i = 0; i < data.cantidadCuotas; i++){
                let cuota = {};
                cuota.numero = i + 1;
                cuota.vencimiento = fechasTemporal.toString(fx, "usa");
                cuota.monto = data.montoCuota;
                cuota.punitorios = 0;
                cuota.cobrado = false;
                cuotas.push(cuota);
                fx = fechasTemporal.add(fx, {months: 1});
            }
            console.log(cuotas)
            try{
                let resp = await $.post({
                    url: "/dashboard/creditos-personales/generar-cuotas",
                    data: {
                        creditoId: this.crud.element._id,
                        cuotas: cuotas,
                        generadorCuotas: data
                    }
                });
                console.log(resp); 
                Object.assign(this.crud.element, resp);
                this.listarCuotas();
                modal.hide();
            }catch(err){
                console.log(err);
                menu.toast({level: "danger", message: "Error al generar las cuotas"});
            }finally{
                $ele.prop("disabled", false);
            }

        });

        if(this.crud.element.generadorCuotas){
            let credito = this.crud.element;
            $("#modal [name='monto-solicitado']").val(credito.generadorCuotas.montoSolicitado);
            $("#modal [name='monto-solicitado']").parent().find("small").html("$" + utils.formatNumber(credito.generadorCuotas.montoSolicitado));
            
            $("#modal [name='intereses']").val(credito.generadorCuotas.intereses);
            $("#modal [name='cantidad-cuotas']").val(credito.generadorCuotas.cantidadCuotas);
            
            $("#modal [name='monto-total']").val(credito.generadorCuotas.montoTotal);
            $("#modal [name='monto-total']").parent().find("small").html("$" + utils.formatNumber(credito.generadorCuotas.montoTotal));

            $("#modal [name='monto-cuota']").val(credito.generadorCuotas.montoCuota);
            $("#modal [name='monto-cuota']").parent().find("small").html("$" + utils.formatNumber(credito.generadorCuotas.montoCuota));

            $("#modal [name='fecha-primer-vencimiento']").val(fechasTemporal.toString(credito.generadorCuotas.fechaPrimerVencimiento, "usa"));
            $("#modal [name='fecha-ultimo-vencimiento']").val(fechasTemporal.toString(credito.generadorCuotas.fechaUltimoVencimiento, "usa"));   
        }
        if(this.crud.element.cobros.length > 0) $("#modal .modal-body button, #modal .modal-body input").prop("disabled", true);
    }
    modalCobrarCuota(cuota){
        let cobros = this.crud.element.cobros.filter(c => c.cuotaId === cuota._id && c.eliminado != true);
        console.log("cobrar cuota", cuota, cobros);
        modal.show({
            title: "Cobrar cuota",
            body: $("#modal-cobrar-cuota").html(),
            size: "lg",
            buttons: "back"
        });

        //$("#modal [name='numero-cuota']").val(cuota.numero);
        $("#modal [name='fecha-vencimiento']").val(fechasTemporal.toString(cuota.vencimiento, "usa"));
        $("#modal [name='fecha-cobro']").val(fechasTemporal.toString());
        $("#modal [name='caja']").html(utils.getOptions({ar: primordial.configuracion.cajas || []}));
        $("#modal [name='caja']").prepend(`<option value="" selected>Seleccionar</option>`);
        //$("#modal [name='monto']").val(cuota.monto);



        let sumaCobros = cobros.reduce((acc, cobro) => acc + (cobro.montoCuota || 0), 0);
        let restante = cuota.monto - sumaCobros;
        $("#modal [name='monto']").val(restante);
        let diasVencido = fechasTemporal.diffDays(fechasTemporal.now(), cuota.vencimiento);
        diasVencido = diasVencido < 0 ? Math.abs(diasVencido) : 0;
        $("#modal [name='dias-vencido']").val(diasVencido);
        $("#modal [name='monto-cuota']").val(cuota.monto);
        $("#modal [name='cobrado']").val(sumaCobros || 0);
        $("#modal [name='restante']").val((cuota.monto - sumaCobros).toFixed(2));

        $("#modal [name='punitorios']").val(Number(primordial?.configuracion?.punitorios) || 0);
        $("#modal [name='punitorios']").on("change", ev=>{
            let $ele = $(ev.currentTarget);
            let v = Number($ele.val()) || 0;
            let montoPunitorios = v * diasVencido * restante;
            $("#modal [name='monto-punitorios']").val(montoPunitorios.toFixed(2));
            $("#modal [name='monto']").val((montoPunitorios + restante).toFixed(2));
        });
        $("#modal [name='monto-punitorios']").on("change", ev=>{
            let $ele = $(ev.currentTarget);
            let v = Number($ele.val()) || 0;
            let diasVencido = Number($("#modal [name='dias-vencido']").val()) || 0;
            let punitorios = (diasVencido > 0 && restante > 0)
                ? v / (diasVencido * restante)
                : 0;
            $("#modal [name='punitorios']").val(punitorios.toFixed(4));
            $("#modal [name='monto']").val((v + restante).toFixed(2));
        });


        $("#modal [name='autocompletar']").on("click", ev=>{
            $("#modal [name='monto']").val(restante);
        })

        $("#modal [name='cobrar']").on("click", async ev=>{
            let montoCobro = Number($("#modal [name='monto']").val());  
            let montoPunitorios = Number($("#modal [name='monto-punitorios']").val());
            let montoRestante = Number($("#modal [name='restante']").val());

            let $ele = $(ev.currentTarget);
            let data = {
                caja: $("#modal [name='caja']").val().trim(),
                fecha: $("#modal [name='fecha-cobro']").val(),
                montoCuota: montoCobro - montoPunitorios,
                montoPunitorios: montoPunitorios,
                diasPunitorios: diasVencido,
                punitorios: $("#modal [name='punitorios']").val(),
                detalle: $("#modal [name='detalle']").val().trim(),
                creditoId: this.crud.element._id,
                cuotaId: cuota._id,
            }
            if(!data.caja) return menu.toast({level: "warning", message: "Seleccione una caja"});
            if(data.montoCuota <= 0) return menu.toast({level: "warning", message: "Ingrese un monto de cobro válido"});
            if(!data.fecha) return menu.toast({level: "warning", message: "Ingrese una fecha de cobro válida"});

            $ele.prop("disabled", true);
            try{
                let resp = await $.post({
                    url: "/dashboard/creditos-personales/acreditar-cobro",
                    data: data
                });
                console.log(resp);
                Object.assign(this.crud.element, resp);
                menu.toast({level: "success", message: "Cobro realizado con éxito"});
                this.listarCuotas();
                modal.hide();
            }catch(err){
                console.log(err);
                menu.toast({level: "danger", message: "Error al acreditar el cobro"});
            }finally{
                $ele.prop("disabled", false);
            }
        });

        //actualizo monto-punitorios al cargar el modal
        if(diasVencido > 0) $("#modal [name='punitorios']").trigger("change");
    }
    modalListarCobros(){
        modal.show({
            title: `Listado cobros`,
            body: $("#modal-listar-cobros").html(),
            size: "xl",
            buttons: "back"
        });

        let rows = "";
        this.crud.element.cobros.forEach(cobro => {
            let cuota = this.crud.element.cuotas.find(c => c._id === cobro.cuotaId);
            rows += `<tr>
                <td>${cuota.numero}</td>
                <td>${fechasTemporal.toString(cobro.fecha, "arg")}</td>
                <td>${cobro.detalle || "-"}</td>
                <td>${cobro.caja || "-"}</td>
                <td class="text-right">$${utils.formatNumber(cobro.montoCuota || 0)}</td>
                <td class="text-right">$${utils.formatNumber(cobro.montoPunitorios || 0)}</td>
                <td class="text-right">$${utils.formatNumber((cobro.montoCuota || 0) + (cobro.montoPunitorios || 0))}</td>
            </tr>`;
        });
        $("#modal tbody").html(rows);
    }
    modalEditarCuota(cuota){
        modal.show({
            title: "Modificar cuota",
            body: $("#modal-modificar-cuota").html(),
            size: "lg",
            buttons: "back"
        })
        $("#modal [name='numero']").val(cuota.numero);
        $("#modal [name='vencimiento']").val(fechasTemporal.toString(cuota.vencimiento, "usa"));
        $("#modal [name='monto']").val(cuota.monto);
        $("#modal [name='cobrado']").val(cuota.cobrado == true ? "true" : "false");

        $("#modal [name='guardar']").on("click", async ev=>{
            let $ele = $(ev.currentTarget);
            let data = {
                creditoId: this.crud.element._id,
                cuotaId: cuota._id,
                cuota: {
                    numero: Number($("#modal [name='numero']").val()),
                    vencimiento: $("#modal [name='vencimiento']").val(),
                    monto: Number($("#modal [name='monto']").val()),
                    cobrado: $("#modal [name='cobrado']").val() === "true"  ? true : false,
                }
            }
            $ele.prop("disabled", true);
            try{
                let resp = await $.post({
                    url: "/dashboard/creditos-personales/upsert-cuota",
                    data: data
                });
                console.log(resp);
                Object.assign(this.crud.element, resp);
                this.listarCuotas();
                modal.hide();
            }catch(err){
                console.log(err);
                menu.toast({level: "danger", message: "Error al modificar la cuota"});
            }finally{
                $ele.prop("disabled", false);
            }
        });
    }
    obtenerSaldoCuota(credito, cuota){
        let cobros = credito.cobros.filter(c => c.cuotaId === cuota._id && c.eliminado != true);
        let sumaCobros = cobros.reduce((acc, cobro) => acc + (cobro.montoCuota || 0), 0);
        let restante = cuota?.monto - sumaCobros;
        let punitorios = 0;
        let diasVencido = fechasTemporal.diffDays(fechasTemporal.now(), cuota?.vencimiento);
        if(diasVencido < 0){
            diasVencido = Math.abs(diasVencido);
            punitorios = diasVencido * Number(primordial.configuracion.punitorios) * restante;
        }
        return {
            diasVencido,
            montoPunitorios: punitorios,
            restanteCuota: restante,
            montoTotal: restante + punitorios
        }
    }
}