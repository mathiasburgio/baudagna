class DashboardCreditosPersonales {
    constructor(initHTML=true){
        this.creditos = [];
        this.cuotas = [];
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
                        let aux = (f?.cuotas || []).find(c=> !c.cobrado);
                        if(!aux) return "-";
                        let dif = fechas.diff_days(new Date(), aux?.fechaVencimiento);
                        if(dif < 0)return `<span class='badge badge-danger'>${Math.abs(dif)}</span>`;
                        if(dif === 0) return `<span class='badge badge-warning'>HOY</span>`;
                        if(dif <= 5)return `<span class='badge badge-warning'>${dif}</span>`;
                        if(dif > 5)return `<span class='badge badge-success'>${dif}</span>`;
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
                if(item.cuotas) this.listarCuotas(item.cuotas);

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
                //nada
            }
        });
        this.crud.setTable($("#container-main-table"));
        this.crud.inicialize("mongodb");

        $("[crud='btNew']").on("click", ev=>{
            this.crud.onNew();
            $("#datos-generales input, #datos-generales select, #datos-generales textarea, #datos-generales button").prop("disabled", false);
            $("#finalidad input, #finalidad select, #finalidad textarea, #finalidad button").prop("disabled", false);
            $("#finalidad [tipo-credito]").val("general").change();
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
        menu.hideCortina();
    }
    async guardarDatosGenerales(){
        try{
            let data = {};
            let validos = [
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
                "finalidad-detalle-general",
                
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
    listarCuotas(cuotas = []){
        let rows = "";
        let punitorios = Number(primordial?.configuracion?.punitorios) || 0;
        cuotas.forEach((c, i)=>{
            let cobros = this.crud?.element?.cobros?.filter(cobro => cobro.cuotaId === c._id) || [];
            let sumaCobros = cobros.reduce((acc, cobro) => acc + (cobro?.montoCuota || 0), 0);
            let labelDeuda = "";
            if(new Date(c.vencimiento) < new Date()){ //vencido
                let diff = Math.abs(fechas.diff_days(new Date(), c.vencimiento));
                let restanteCuota = c.monto - sumaCobros;
                let punitorio = (diff * punitorios * restanteCuota) / 100;
                labelDeuda = "$" + utils.formatNumber(restanteCuota + punitorio);
            }else{
                if(c.cobrado) labelDeuda = "COBRADO";
                else labelDeuda = "$" + utils.formatNumber(c.monto);
            }
            rows += `<tr cuota-id="${c?._id}">
                <td>
                    ${c.numero}
                </td>
                <td>
                    ${fechas.parse2(c.vencimiento, "ARG_FECHA")}
                </td>
                <td>
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
            
            //verifico si la cuota existe en BD o es una cuota nueva (sin id)
            if(Number(cuotaId) >= 0 && Number(cuotaId) < 200){
                menu.toast({level: "warning", message: "No se puede modificar una cuota que no ha sido guardada aún. Modifique los datos y luego guarde el crédito para modificar esta cuota."});
                return;
            } 

            //verifico si tiene cobros registrados
            if(this.crud.element.cobros?.find(cobro => cobro.cuotaId === cuotaId)){
                menu.toast({level: "warning", message: "No se puede modificar una cuota que ya tiene cobros registrados"});
                return;
            }

            let confirm = await modal.yesno("¿Confirma modificar esta cuota?");
            if(!confirm) return;
            try{
                const resp = await $.post({
                    url: "/dashboard/creditos-personales/modificar-cuota",
                    data: {
                        creditoId: this.crud.element._id,
                        cuota: {
                            cuotaId: cuotaId,
                            vencimiento: tr.find("[name='vencimiento']").val(),
                            punitorio: tr.find("[name='punitorio']").val(),
                            monto: tr.find("[name='monto']").val()
                        }
                    }
                })
                console.log(resp);
                menu.toast({level: "success", message: "Cuota modificada con éxito"});
                Object.assign(cuota, resp);
                this.listarCuotas();
            }catch(err){
                console.log(err);
                menu.toast({level: "danger", message: "Error al modificar la cuota"});
            }
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
            this,cobrarCuota(cuota);
        });
    }
    async generarCuotas(){
        if(!this.crud?.element?._id) return menu.toast({level: "warning", message: "Primero guarde los datos generales para luego generar las cuotas"});
        if(this.crud.element.cobros.length > 0) return menu.toast({level: "warning", message: "No se pueden generar cuotas para un crédito con cobros registrados"});

        modal.show({
            title: "Generar cuotas",
            body: $("#modal-generar-cuotas").html(),
            size: "lg",
            buttons: "back"
        });

        $("#modal [name='fecha-primer-vencimiento']").val(fechas.parse2(new Date(), "USA_FECHA"));

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
                let fx = new Date(fechaPrimeraCuota);
                fx.setMonth(fx.getMonth() + v);
                $("#modal [name='fecha-ultimo-vencimiento']").val(fechas.parse2(fx, "USA_FECHA"));
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

        /* 
        se autocompleta
        $("#modal [name='monto-total']").on("change", ev=>{
        }); */
        /* 
        se autocompleta
        $("#modal [name='monto-cuota']").on("change", ev=>{
        }); */
        
        $("#modal [name='fecha-primer-vencimiento']").on("change", ev=>{
            let $ele = $(ev.currentTarget);
            let v = $ele.val();
            let cantidadCuotas = Number($("#modal [name='cantidad-cuotas']").val() || 0);
            if(v && cantidadCuotas){
                let aux = new Date(v);
                aux.setMonth(aux.getMonth() + cantidadCuotas);
                $("#modal [name='fecha-ultimo-vencimiento']").val(fechas.parse2(aux, "USA_FECHA"));
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
            let fx = new Date(data.fechaPrimerVencimiento);
            fx.setHours(0,0,0,1); //para evitar q vuelva una fecha para atras
            for(let i = 0; i < data.cantidadCuotas; i++){
                let cuota = {};
                cuota.numero = i + 1;
                cuota.vencimiento = new Date(fx);
                cuota.monto = data.montoCuota;
                cuota.punitorio = 0;
                cuota.cobrado = false;
                cuotas.push(cuota);
                fx.setMonth(fx.getMonth() + 1);
            }
            console.log(cuotas)
            try{
                let resp = await $.post({
                    url: "/dashboard/creditos-personales/generar-cuotas",
                    data: {
                        creditoId: this.crud.element._id,
                        cuotas: cuotas
                    }
                });
                console.log(resp); 
                this.listarCuotas(resp.cuotas);
                modal.hide();
            }catch(err){
                console.log(err);
                menu.toast({level: "danger", message: "Error al generar las cuotas"});
            }finally{
                $ele.prop("disabled", false);
            }

        });
    }
    agregarCuota(){
        this.cuotas.push({
            numero: this.cuotas.filter(c=>c?.eliminada != true).length + 1,
            vencimiento: null,
            monto: 0,
            punitorio: 0,
            cobrado: false
        });
        this.listarCuotas();
    }
    cobrarCuota(cuota){
        modal.show({
            title: "Cobrar cuota",
            body: $("#modal-cobrar-cuota").html(),
            size: "lg",
            buttons: "back"
        });
    }
    modalCobrarCuota(cuota){
        modal.show({
            title: "Cobrar cuota",
            body: $("#modal-cobrar-cuota").html(),
            buttons: "back"
        });

        $("#modal [name='numero-cuota']").val(cuota.numero);
        $("#modal [name='fecha-cuota']").val(fechas.parse2(cuota.vencimiento, "USA_FECHA"));
        $("#modal [name='monto-cuota']").val(cuota.monto);

        let cobros = this.crud.element.cobros.filter(c => c.cuotaId === cuota._id);
        if(cobros.length > 0){
            let rows = "";
            cobros.forEach(cobro => {
                rows += `<tr>
                    <td>${fechas.parse2(cobro.fecha, "ARG_FECHA_HORA")}</td>
                    <td>${cobro.detalle || ""}</td>
                    <td>${cobro.caja || ""}</td>
                    <td class="text-right">$${utils.formatNumber(cobro.montoCuota || 0)}</td>
                    <td class="text-right">$${utils.formatNumber(cobro.montoPunitorio || 0)}</td>
                    <td class="text-right">$${utils.formatNumber((cobro.montoCuota || 0) + (cobro.montoPunitorio || 0))}</td>
                </tr>`;
            });
            $("#modal #cobros tbody").html(rows).removeClass("d-none");
        }

        let sumaCobros = cobros.reduce((acc, cobro) => acc + (cobro.montoCuota || 0), 0);
        let restante = cuota.monto - sumaCobros;
        $("#modal [name='monto-restante']").val(restante);
        let diasVencidos = fechas.diff_days(new Date(), cuota.vencimiento);

        $("#modal [name='punitorios']").val(Number(primordial?.configuracion?.punitorios) || 0);
        $("#modal [name='punitorios']").on("change", ev=>{
            let $ele = $(ev.currentTarget);
            let v = Number($ele.val()) || 0;
            let montoPunitorios = v * diasVencidos * restante / 100;
            $("#modal [name='monto-punitorio']").val(montoPunitorios.toFixed(2));
        });
        $("#modal [name='autocompletar']").on("click", ev=>{
            $("#modal [name='monto-cobro']").val(restante);
        })

        $("#modal [name='acreditar']").on("click", async ev=>{
            let $ele = $(ev.currentTarget);
            let data = {
                detalle: $("#modal [name='detalle']").val().trim(),
                caja: $("#modal [name='caja']").val().trim(),
                montoCobro: Number($("#modal [name='monto-cobro']").val().trim()),
                montoPunitorio: Number($("#modal [name='monto-punitorio']").val().trim()),
                diasVencidos: diasVencidos,
                creditoId: this.crud.element._id,
                cuotaId: cuota._id
            }
            $ele.prop("disabled", true);
            try{
                let resp = await $.post({
                    url: "/dashboard/creditos-personales/acreditar-cobro",
                    data: data
                });
                console.log(resp);
                this.crud.element.cobros.push(resp);
                this.listarCuotas();
                modal.hide();
            }catch(err){
                console.log(err);
                menu.toast({level: "danger", message: "Error al acreditar el cobro"});
            }finally{
                $ele.prop("disabled", false);
            }
        });
    }
}