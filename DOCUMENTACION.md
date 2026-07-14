# Baudagna — guía de inicio para desarrollo

Esta aplicación administra créditos personales, sus cuotas y los cobros asociados. Es un monolito Node.js: Express renderiza vistas EJS, el navegador trabaja con jQuery y Bootstrap/AdminLTE, y MongoDB persiste la información.

> Alcance de este documento: describe el código actualmente conectado a `main.js`. También marca código legado o incompleto para evitar que una nueva implementación se apoye en rutas que no existen.

## 1. Puesta en marcha

Requisitos locales: Node.js compatible con las dependencias del proyecto, MongoDB disponible y una instancia Redis accesible (Redis se inicializa al importar `utils/redisHelper.js`, aunque hoy no está importado por el servidor principal).

1. Instalar dependencias: `npm install`.
2. Copiar `.env_example` a `.env` y completar, como mínimo, `PORT`, `MONGO_URI`, `SESSION_SECRET` y las variables criptográficas. No versionar credenciales reales.
3. Copiar `configuracion_example.json` a `configuracion.json` y ajustar cajas, localidades, provincias y punitorios.
4. Iniciar con `npm start`.
5. Abrir `http://localhost:<PORT>` e ingresar con un usuario definido en `configuracion.json`.

No hay suite de tests ni comandos de lint configurados. Antes de una modificación relevante, validar al menos el arranque, el login y el flujo afectado manualmente.

## 2. Mapa del proyecto

| Ubicación | Responsabilidad |
| --- | --- |
| `main.js` | Composición de Express: sesión Mongo, seguridad, estáticos, base de datos, contadores y rutas. |
| `routes/` | Declaración de endpoints y middleware de acceso. Actualmente hay un router activo: créditos personales. |
| `controllers/` | Casos de uso HTTP. `creditos-personales-controller.js` es el controlador conectado. |
| `models/` | Esquemas Mongoose: crédito, contador, caja, factura y bitácora. |
| `utils/` | Utilidades de servidor: base de datos, permisos, fechas, criptografía y Redis. |
| `views/layouts/` | Layout EJS del dashboard y carga global de scripts/estilos. |
| `views/pages/` | Fragmentos EJS de páginas y plantillas HTML que se clonan dentro de modales. |
| `public/js/` | Lógica de interfaz por página. El flujo activo de créditos está en `creditos-personales.js`. |
| `public/resources/` | Helpers globales de navegador: modal, utilidades, fechas, menú, Excel, impresión y controles UI. |
| `uploads/`, `dump/`, `public-images/` | Directorios de trabajo creados por el servidor; no contienen lógica de negocio. |

Flujo principal:

```text
Navegador/EJS -> public/js/creditos-personales.js -> HTTP /creditos-personales/*
        -> routes/creditos-personales-routes.js -> controller -> modelos Mongoose -> MongoDB
```

## 3. Ciclo de una página del dashboard

`views/layouts/dashboard.ejs` inserta el fragmento indicado por el controlador y luego carga `views/layouts/scripts.ejs`. Ese layout deja disponibles globals para cada página:

```js
var fechasTemporal, modal, utils, menu, superExcel, impresor, primordial;
await boilerplate(true);
```

`boilerplate(true)` crea `FechasTemporal`, `Modal`, `Utils` y `Menu`; además consulta `GET /primordial` y guarda su respuesta en `window.primordial`. Esta respuesta deriva de `configuracion.json` pero elimina la contraseña de cada usuario.

Patrón recomendado para una página nueva:

1. Crear el fragmento en `views/pages/mi-pagina.ejs` y agregar allí su `<script src="/js/mi-pagina.js"></script>`.
2. Crear el módulo de interfaz en `public/js/mi-pagina.js`; en su inicialización hacer `await boilerplate(true)` antes de usar los globals.
3. Agregar una función `html` al controlador que renderice `../views/layouts/dashboard.ejs` con `page` y `title`.
4. Declarar la ruta con `middlewares.verificarPermisos({ level: 1 })`.
5. Para operaciones asincrónicas usar `$.get`/`$.post`, manejar fallos y mostrar el resultado con `menu.toast` o `modal.message`.

Los estáticos se exponen en `/css`, `/js` y `/resources`; no se usa un bundler ni módulos ES en el frontend.

## 4. Backend: convenciones y helpers

### Middleware y sesión

`utils/middlewares.js` expone:

- `verificarPermisos({ level, permiso, responseType })`: protege rutas. Los niveles son 0 visitante, 1 autenticado, 2 administrador y 3 superadministrador. `responseType` es `html` por defecto o `json` para APIs.
- `createRateLimit(limit, minutes, message)`: genera un rate limiter de Express.
- `upload`: instancia Multer que guarda temporalmente en `uploads/temp/` y respeta `MULTER_UPLOAD_SIZE_LIMIT`.

El login guarda el usuario sin contraseña en `req.session.data.usuario`. Por lo tanto, al añadir permisos o datos de sesión hay que mantener esta forma y verificar qué propiedades consume el middleware. Cada request recibe además:

- `req.getPrimordial()`: copia sanitizada de la configuración.
- `req.getContador(llave)` y `req.setContador(llave, valor)`: lectura y actualización atómica de correlativos en el modelo `Contador`. Usar esta última para números de crédito/recibo; no calcular correlativos desde el último documento.

### Utilidades de servidor

`utils/utils.js` se importa como `utils` y concentra funciones sin estado:

| Grupo | Funciones principales |
| --- | --- |
| Seguridad | `encryptString`, `decryptString`, `getPasswordHash`, `comparePasswordHash`, `encryptFile` |
| Identificadores/texto | `getUUID`, `getRandomString`, `simplifyString`, `safeString`, `validateString` |
| HTTP/archivos | `api`, `downloadFile`, `getFilesInfo` |
| Números/datos | `decimals`, `splitAmountByPercentage`, `reverserPercent`, `getNumber`, `getBoolean`, `arrayToObject` |

`utils/FechasTemporal.js` usa `temporal-polyfill` y la zona `America/Argentina/Buenos_Aires`. Preferirlo para reglas de fechas nuevas: `toString`, `add`, `diffDays`, `daysInMonth`, `toMongoDate` y `toMongoDateTime`. Existe también `utils/fechas.js`, una API anterior basada en `Date`; no mezclar ambas sin definir explícitamente el formato y la zona.

`utils/db.js` conecta Mongoose con `MONGO_URI`; `checkDatabase` responde 503 hasta que la conexión esté lista. `utils/redisHelper.js` crea un cliente Redis por `REDIS_URI`, pero no participa actualmente en el flujo cargado por `main.js`.

### Modelado actual

`CreditoPersonal` es el agregado central. Contiene metadatos, `datosGenerales` y `finalidad` como `Map<String,String>`, arrays embebidos de `cuotas` y `cobros`, `proximoVencimiento` y flags de borrado/cierre. Las cuotas y vencimientos se guardan como `String` en el esquema, aunque el cliente y el controlador trabajan con fechas serializadas. Mantener ese contrato hasta realizar una migración planificada.

Los borrados de créditos y cuotas son lógicos (`eliminado: true`). Toda consulta o cálculo nuevo debe filtrar esos registros cuando corresponda.

## 5. API conectada

Todas las rutas de créditos requieren sesión (`level: 1`). Las operaciones devuelven JSON; ante error el controlador actual suele responder `500` con texto plano.

| Método y ruta | Cuerpo/parámetros | Resultado |
| --- | --- | --- |
| `GET /creditos-personales` | — | Renderiza la pantalla de créditos. |
| `GET /creditos-personales/listado` | — | Hasta 1000 créditos no eliminados, más recientes primero. |
| `GET /creditos-personales/obtener-credito/:creditoId` | path `creditoId` | Crédito no eliminado. |
| `POST /creditos-personales/nuevo` | Campos libres de datos generales (máx. 100) | Crea crédito, token y número correlativo. |
| `POST /creditos-personales/modificar` | `{ creditoId, tipoDato, datos }` | `tipoDato` debe ser `datosGenerales` o `finalidad`; actualiza el mapa indicado. |
| `POST /creditos-personales/eliminar` | `{ creditoId }` | Borrado lógico del crédito. |
| `POST /creditos-personales/asignar-cuotas` | `{ creditoId, cuotas }` | Inserta/actualiza cuotas; si hay más de una, reemplaza el plan completo salvo que existan cobros. Máximo 300. |
| `POST /creditos-personales/modificar-cuota` | `{ creditoId, cuotaId, cuota }` | Actualiza una cuota embebida. |
| `POST /creditos-personales/eliminar-cuota` | `{ creditoId, cuotaId }` | Borrado lógico de cuota. |
| `POST /creditos-personales/cobrar-cuota` | IDs, importes desglosados, días de mora, método y detalle | Crea cobro, marca cuota como cobrada y actualiza el próximo vencimiento. |
| `GET /primordial` | — | Configuración sanitizada para el frontend. |
| `GET /ping` | — | Devuelve `pong`. |

Al modificar cuotas o cobros se debe recalcular `proximoVencimiento`. El controlador lo hace mediante `obtenerProximoVencimiento(credito)` antes de guardar.

## 6. Frontend: helpers globales

Los scripts de `views/layouts/scripts.ejs` cargan las bibliotecas en este orden: jQuery, Bootstrap/AdminLTE, SweetAlert, FileSaver/ExcelJS/QR y luego los recursos propios. No cargar una página de dashboard sin el layout, porque los helpers dependen de jQuery, Bootstrap y de estos globals.

### `Modal2.js` (`class Modal`)

No existe un archivo llamado `modal.js`: la implementación utilizada es `public/resources/Modal2.js`, cargada por el layout y construida como `window.modal = new Modal()`. Encapsula un único modal Bootstrap con id `modal`; por diseño no soporta dos modales abiertos en paralelo.

| Método | Uso y valor resuelto |
| --- | --- |
| `modal.message(text)` | Muestra información y resuelve al cerrar. |
| `await modal.yesno(text, focusOn)` | Confirmación; devuelve `true`, `false` o `null` si se cierra. |
| `await modal.prompt({ label, value, type, small, ... })` | Entrada simple; devuelve el texto o `null`. |
| `await modal.promptSelect({ ar, textProp, filter, filterFn, rowTemplate, ... })` | Selector filtrable; devuelve el ítem original o `null`. |
| `modal.show({ title, body, size, buttons, onShow, onShown, onHide, onHidden })` | Modal de contenido propio. `buttons` admite `back`, `close`, `dismiss`, `accept`, un objeto o un array. |
| `await modal.addPopover({ querySelector, type, message, ... })` | Confirmación/entrada contextual dentro de un modal abierto. Tipos: `message`, `yesno`, `input`. |
| `modal.waiting(text, fn)` / `modal.waiting2(status, text)` | Spinner como modal completo / capa sobre el modal existente. |
| `modal.hide()` / `modal.close()` | Cierra; admite callback y puede esperarse como promesa. |

Ejemplo de patrón que se usa en créditos:

```js
modal.show({ title: "Editar", body: $("#plantilla").html(), size: "lg", buttons: "back" });
$("#modal [name='guardar']").on("click", async (ev) => {
  const confirmado = await modal.addPopover({
    querySelector: $(ev.currentTarget), type: "yesno", message: "¿Guardar cambios?"
  });
  if (!confirmado) return;
  // invocar API, actualizar estado local y cerrar
});
```

Como el modal inyecta HTML mediante `.html()`, no interpolar datos no confiables sin escaparlos. Los selectores de contenido deben ir acotados a `#modal` para no capturar elementos de fondo.

### `Utils.js` (`class Utils`)

Se instancia como `window.utils = new Utils()`. Es el helper de propósito general del cliente:

- Números: `decimals`, `formatNumber`, `formatNumberWithSeparators`, `getNumber`, `getBoolean`, `splitAmountByPercentage`, `reverserPercent`, `separadorMiles`.
- Datos y texto: `sort`, `FD` (construye `FormData`), `getURL`, `getUrlQuery`, `arrayToObject`, `simplifyString`, `validateString`, `getUUID`, `getRandomString`.
- UX: `sleep`/`wait`, `copyToClipboard`, `scrollTo`, `debounce`, `bindShowPasswordEvent`, `sendWhatsapp`.
- Archivos: `uploadFile`, `uploadFileWithProgress`, `uploadButton`, `saveFile`.
- Complementos: `ping`, `getQR`, `getBarcode`, `setLocalData` y `getLocalData`.

El cliente duplica algunas utilidades del servidor intencionalmente. No se comparten como paquete: si una regla debe ser idéntica en ambos lados, validar en backend de todas maneras.

### Otros recursos cargados globalmente

| Helper | Propósito |
| --- | --- |
| `FechasTemporal` | Fechas del cliente con la misma zona argentina. Usar `fechasTemporal` tras `boilerplate`. |
| `Menu` | Preferencias visuales, `toast`, sonidos, cortina de carga y permisos del menú. |
| `SuperExcel` | Lee/escribe XLSX con ExcelJS y exporta tablas. |
| `Impresor` | Imprime plantillas HTML mediante iframe. |
| `DropdownSearcher`, `TableSelector` | Controles de búsqueda/selección por teclado. |
| `Imagine` | Selección, redimensión y conversión de imágenes. |

## 7. Flujo de créditos personales

`public/js/creditos-personales.js` es la implementación que la página activa carga. Mantiene `listado`, `creditoActual` y `accion` en una instancia de clase; construye tablas por jQuery y usa las plantillas ocultas de la vista para los modales.

El flujo es: crear crédito con datos generales → guardar finalidad → generar/asignar cuotas → editar o eliminar cuotas pendientes → cobrar una cuota. Al cobrar se crea un registro embebido en `credito.cobros`, se marca `cuota.cobrado` y se intenta registrar el movimiento de caja.

Al añadir una funcionalidad en este flujo, actualizar tanto el estado local (`creditoActual`/`listado`) como el servidor después de cada respuesta. Las recargas de tabla no reemplazan automáticamente dichos objetos.

## 8. Estado técnico a considerar antes de ampliar

- `public/js/dashboard-creditos-personales.js` contiene una implementación anterior que llama a rutas `/dashboard/creditos-personales/*`. Esas rutas no están declaradas en el router activo y la página actual carga `creditos-personales.js`; tratarlo como código legado, no como referencia de API.
- `controllers/resumen-controller.js` no está registrado en `main.js` ni hay rutas de resumen conectadas.
- `cobrarCuota` usa `Caja` sin importarlo en el controlador. En el estado actual, el cobro puede fallar al intentar crear el movimiento de caja. Verificar y corregirlo antes de depender de este flujo en producción.
- Hay referencias de interfaz a endpoints que no están en el router actual, por ejemplo el resumen de caja. Confirmar el contrato de cada acción antes de reutilizarla.
- `registrarBitacora` retorna inmediatamente; por ello las llamadas actuales no persisten auditoría aunque el modelo exista.
- El backend mezcla `String`, `Date` y objetos Temporal en datos de fechas. Para una mejora, definir un único contrato ISO y migrarlo de forma explícita; no cambiar solo un extremo.
- `utils/utils.js#getShortToken` calcula un hash pero no lo retorna. No usarlo hasta corregirlo y probarlo.

## 9. Checklist para una modificación segura

1. Confirmar que la ruta está registrada en `main.js` (directa o mediante un router).
2. Aplicar `verificarPermisos` y validar en el controlador, sin confiar en los controles de UI.
3. Respetar borrados lógicos y recalcular derivados como `proximoVencimiento`.
4. Usar `FechasTemporal` y serializar el formato esperado por el esquema actual.
5. Inicializar la página con `await boilerplate(true)` antes de acceder a `modal`, `utils`, `menu`, `fechasTemporal` o `primordial`.
6. Tras una mutación, sincronizar estado local, interfaz y respuesta de API.
7. Probar la ruta autenticada, el caso de error y el caso de datos eliminados/no encontrados.
