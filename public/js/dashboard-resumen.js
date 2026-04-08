class DashboardResumen{
    constructor(initHTML=true){
        this.datos = null;
        this.anioMes = null;
        if(initHTML) this.initHTML();
    }
    async initHTML(){
        await boilerplate(true);

        this.anioMes = fechasTemporal.toString().substring(0,7);
        $("[name='anioMes']").val(this.anioMes);
        this.obtenerResumen();

        $("[name='anioMes']").on("change", ev=>{
            let valor = $(ev.currentTarget).val();
            if(!valor) return;
            this.obtenerResumen();
        });

        menu.hideCortina();
    }
    async obtenerResumen(){
        await modal.waiting("Obteniendo resumen...");
        let anioMes = $("[name='anioMes']").val();
        let resp = await $.get({url: "/dashboard/resumen/obtener-resumen?anioMes="+anioMes});
        this.datos = resp;
        this.anioMes = anioMes;
        this.listarResumen();
        modal.hide();
    }

    listarResumen(){
        $("table tbody").html("");
        let tbody = "";

        const fila = (detalle, valor) => {
            return `<tr>
                <td>${detalle}</td>
                <td class="text-right">${utils.formatNumber(valor)}</td>
            </tr>`;
        }

        tbody += fila("Créditos otorgados", this.datos.respCreditos.cantidad);  
        tbody += fila(`Créditos otorgados este mes (${this.anioMes})`, this.datos.respCreditos._cantidad);

        tbody += fila("Cuotas generadas", this.datos.respCuotas.cantidad);
        tbody += fila(`Cuotas generadas este mes (${this.anioMes})`, this.datos.respCuotas._cantidad);

        tbody += fila("Monto total de cuotas", this.datos.respCuotas.monto);
        tbody += fila(`Monto total de cuotas este mes (${this.anioMes})`, this.datos.respCuotas._monto);

        tbody += fila("Monto total de capital", this.datos.respCuotas.montoCapital);
        tbody += fila(`Monto total de capital este mes (${this.anioMes})`, this.datos.respCuotas._montoCapital);

        tbody += fila("Monto total de interés", this.datos.respCuotas.montoInteres);
        tbody += fila(`Monto total de interés este mes (${this.anioMes})`, this.datos.respCuotas._montoInteres);


        $("table tbody").html(tbody);
    }

}