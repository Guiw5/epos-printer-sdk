# epos-printer-sdk

[![npm](https://img.shields.io/npm/v/epos-printer-sdk.svg)](https://www.npmjs.com/package/epos-printer-sdk)
[![CI](https://github.com/Guiw5/epos-printer-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/Guiw5/epos-printer-sdk/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/epos-printer-sdk.svg)](./LICENSE)
[![types](https://img.shields.io/npm/types/epos-printer-sdk.svg)](https://www.typescriptlang.org/)

[English](./README.md) · **Español**
**[Probala en el navegador](https://guiw5.github.io/epos-printer-sdk/)**, la demo corre contra una impresora simulada, así que no hace falta hardware.


Imprimí en impresoras de tickets Epson **TM** desde JavaScript, por HTTP, con
`async`/`await`, tipos completos de TypeScript y sin dependencias.

Una reimplementación en TypeScript del protocolo ePOS-Print de Epson, hecha por
ingeniería inversa de su SDK oficial y verificada contra los manuales XML
oficiales y hardware **TM-T88V** real.

```ts
import { EposHttpPrinter } from 'epos-printer-sdk/http';

const printer = new EposHttpPrinter('192.168.1.100');

await printer
  .addText('¡Hola, mundo!\n')
  .addCut('feed')
  .send();
```

## Por qué esta librería

Epson distribuye su SDK ePOS como un IIFE minificado pensado
para usarse en un `<script>`: sin módulos, sin tipos, sin tree-shaking y con
una API íntegramente basada en callbacks. Este paquete es un reemplazo moderno.

- **Cero dependencias, ~7 KB gzip.** `npm install epos-printer-sdk` no arrastra
  absolutamente nada: ni `lodash`, ni `dayjs`, ni cripto empaquetada, ni
  Socket.IO, y `npm audit` reporta 0 vulnerabilidades.
- **Agnóstica del framework, y corre en el servidor.** Usa `fetch` a secas, así
  que funciona en React, Vue, Svelte o vanilla, *y* en Node 18+ (API routes,
  SSR, scripts, workers de cola). No es un wrapper solo para React.
- **Nativa de promesas.** `send()` resuelve con la respuesta real de la
  impresora, en vez de obligarte a cablear `onreceive`/`onerror` antes.
- **Cobertura completa del protocolo.** Texto y formato, códigos de barras 1D,
  símbolos 2D (QR/PDF417/DataMatrix/Aztec/MaxiCode), imágenes desde canvas,
  etiquetas en modo página, decodificación de estado, seguimiento de trabajos y
  apertura de cajón.
- **Tipada contra la especificación real.** Las uniones de tipos de códigos,
  símbolos y niveles se verificaron contra las regex de validación del propio
  bundle de Epson y los manuales XML oficiales: no se adivinaron.
- **Segura ante concurrencia.** Las requests a la misma impresora se serializan
  automáticamente, porque el hardware igual las procesa de a una. Diez trabajos
  simultáneos con timeout de 2s contra una TM-T88V real: 4/10 sin esto, 10/10
  con esto.
- **Verificada, no solo escrita.** 71 tests unitarios de la librería y 18 de la
  demo, más tests de integración opcionales que corren contra una impresora
  física.

## Instalación

```bash
pnpm add epos-printer-sdk
```

```bash
yarn add epos-printer-sdk
```

```bash
npm install epos-printer-sdk
```

Requiere **Node 18+** (por `fetch` nativo) o cualquier navegador moderno.

## Inicio rápido

```ts
import { EposHttpPrinter } from 'epos-printer-sdk/http';

// El puerto por defecto es 443 (https). Pasá { port: 80 } para http plano.
const printer = new EposHttpPrinter('192.168.1.100');

// Opcional: verificar que la impresora responde antes de mandar un trabajo.
await printer.connect(); // lanza error si no es alcanzable

const result = await printer
  .addTextAlign('center')
  .addTextSize(2, 2)
  .addText('MI COMERCIO\n')
  .addTextSize(1, 1)
  .addText('¡Gracias por su compra!\n')
  .addFeedLine(2)
  .addCut('feed')
  .send();

if (!result.success) {
  console.error('Falló la impresión:', result.code);
}
```

`send()` resuelve con:

```ts
{ success: boolean, code: string, status: number, battery: number, printjobid: string }
```

El buffer del builder se consume en cada `send()`, así que podés reutilizar la
misma instancia para el próximo trabajo sin reimprimir el anterior.

## Recetas

### Ticket con total

```ts
await printer
  .addTextAlign('center')
  .addTextStyle(false, false, true)   // negrita
  .addText('MI COMERCIO\n')
  .addTextStyle(false, false, false)
  .addTextAlign('left')
  .addText('Café              $ 3.50\n')
  .addText('Sándwich          $ 6.00\n')
  .addText('------------------------\n')
  .addTextStyle(false, false, true)
  .addText('TOTAL             $ 9.50\n')
  .addFeedLine(2)
  .addCut('feed')
  .send();
```

### Código de barras

```ts
await printer
  .addTextAlign('center')
  .addBarcode('0123456789', 'code128', 'below')
  .addFeedLine(1)
  .addCut('feed')
  .send();
```

Tipos soportados: `upc_a`, `upc_e`, `ean13`, `jan13`, `ean8`, `jan8`, `code39`,
`itf`, `codabar`, `code93`, `code128`, `code128_auto`, `gs1_128` y las cuatro
variantes `gs1_databar_*`.

### Código QR / símbolos 2D

```ts
await printer
  .addTextAlign('center')
  .addSymbol('https://example.com', 'qrcode_model_2', 'level_m', 4)
  .addFeedLine(1)
  .addCut('feed')
  .send();
```

También soporta PDF417, DataMatrix, Aztec, MaxiCode y GS1 DataBar apilado,
ver [`SymbolType`](src/types.ts).

### Imagen desde un canvas

```ts
const canvas = document.querySelector('canvas')!;

// Pasá un printjobid para poder hacerle seguimiento después.
const jobId = `ticket-${Date.now()}`;
await printer.print(canvas, jobId);

// Las imágenes grandes siguen imprimiéndose después de aceptada la request:
// consultá para confirmar.
const status = await printer.getPrintJobStatus(jobId);
```

### Etiqueta (modo página)

El modo página posiciona el contenido en un área de tamaño fijo, en vez del
flujo secuencial del ticket:

```ts
await printer
  .addPageBegin()
  .addPageArea(0, 0, 380, 120)
  .addPageDirection('left_to_right')
  .addPagePosition(10, 30).addText('Nombre del producto')
  .addPagePosition(10, 60).addText('SKU-00042')
  .addPageRectangle(0, 0, 379, 119, 'thin')
  .addPageEnd()
  .send();
```

### Estado de la impresora

```ts
import { EposHttpPrinter, decodePrinterStatus } from 'epos-printer-sdk/http';

const res = await printer.send();       // sin contenido encolado = consulta de estado
const status = decodePrinterStatus(res.status, res.battery);

// { online: true, coverOpen: false, paper: 'ok', drawerOpen: false, battery: 0, raw: 251658262 }
if (status.paper === 'near_end') {
  console.warn('Queda poco papel');
}
```

### Monitoreo en vivo

```ts
printer.interval = 3000;
printer.onstatuschange = () => {
  console.log(decodePrinterStatus(printer.status, printer.battery));
};
printer.onpaperend = () => alert('¡Se acabó el papel!');
printer.oncoveropen = () => alert('La tapa está abierta');

printer.open();   // arranca el polling
printer.close();  // lo detiene
```

### Cajón de dinero

```ts
await printer.addPulse('drawer_1', 'pulse_100').send();
```

## Manejo de errores

Una impresión puede fallar por motivos muy distintos, y cada uno necesita una
respuesta distinta: reintentar un trabajo que falló por falta de papel solo
pierde tiempo, mientras que *no* reintentar uno que encontró la impresora
ocupada pierde un ticket. `send()` rechaza únicamente cuando no se puede
alcanzar la impresora; si la impresora responde pero rechaza el trabajo,
resuelve con `success: false` y un `code`.

| `code` | Significado | Qué hacer |
|---|---|---|
| `ERROR_DEVICE_BUSY` | Otro cliente está imprimiendo | **Reintentar** con backoff, esperable con varios clientes |
| `TooManyRequests`, `EX_SPOOLER` | Cola llena | **Reintentar**, con backoff más largo |
| `JobSpooling`, `Printing` | Todavía procesando | Consultar `getPrintJobStatus()` |
| `EPTR_REC_EMPTY` | Sin papel | Avisar al operador; no reintentar a ciegas |
| `EPTR_COVER_OPEN` | Tapa abierta | Avisar al operador |
| `EPTR_CUTTER`, `EPTR_MECHANICAL` | Atasco / falla mecánica | Operador, después `recover()` |
| `EPTR_AUTOMATICAL` | Falla recuperable | Llamar a `recover()` y reintentar |
| `EPTR_UNRECOVERABLE` | Necesita apagar y prender | Operador |
| `SchemaError` | XML mal formado | Bug en tu código: no reintentar |
| `DeviceNotFound` | `deviceId` incorrecto | Corregir configuración |
| `RequestEntityTooLarge` | Trabajo demasiado grande | Dividirlo |

Un helper mínimo de reintento para los casos transitorios:

```ts
const TRANSITORIOS = ['ERROR_DEVICE_BUSY', 'TooManyRequests', 'EX_SPOOLER'];

async function printWithRetry(job: () => Promise<PrintServiceResponse>, intentos = 3) {
  for (let i = 1; i <= intentos; i++) {
    try {
      const res = await job();
      if (res.success || !TRANSITORIOS.includes(res.code)) return res;
    } catch (err) {
      if (i === intentos) throw err;   // impresora inalcanzable, también transitorio
    }
    await new Promise((r) => setTimeout(r, 500 * 2 ** (i - 1)));
  }
  throw new Error('Impresora no disponible tras varios intentos');
}
```

La [app de ejemplo en React](examples/react-app) implementa esto de punta a
punta, con un panel que clasifica cada código de respuesta y ofrece la acción
correspondiente.

## Probar sin impresora

`epos-printer-sdk/simulator` es una impresora simulada que le pasás a
`EposHttpPrinter`. Habla el protocolo real, así que el código escrito contra
ella se comporta igual contra el hardware, y modela el estado de papel, tapa y
cajón para poder ejercitar los caminos de error a propósito.

```ts
import { EposHttpPrinter } from 'epos-printer-sdk/http';
import { createSimulator } from 'epos-printer-sdk/simulator';

const sim = createSimulator({ initialState: { paper: 2 } });
const printer = new EposHttpPrinter('demo', { fetch: sim.fetch });

await printer.addText('hola
').addCut('feed').send();
sim.jobs[0].text;            // 'hola
'

sim.state.coverOpen = true;  // la próxima impresión falla con EPTR_COVER_OPEN
```

Es un entry point aparte, así que nada de esto llega a quien no lo importe. La
[demo en vivo](https://guiw5.github.io/epos-printer-sdk/) corre enteramente
sobre él, por eso no necesita ninguna impresora en la red.

## API

### `new EposHttpPrinter(host, options?)`

| Opción | Tipo | Default | Descripción |
|---|---|---|---|
| `port` | `number` | `443` | `80`/`8008` cambian el esquema a `http` |
| `deviceId` | `string` | `'local_printer'` | Id de dispositivo ePOS |
| `timeout` | `number` | `10000` | Timeout de request en ms |

| Método | Devuelve | Descripción |
|---|---|---|
| `connect()` | `Promise<PrintServiceResponse>` | Chequeo de salud; lanza error si no responde |
| `send()` | `Promise<PrintServiceResponse>` | Envía lo construido (o consulta el estado) |
| `print(canvas, printjobid?)` | `Promise<PrintServiceResponse>` | Renderiza e imprime un canvas |
| `getPrintJobStatus(id)` | `Promise<PrintServiceResponse>` | Estado de un trabajo previo |
| `recover()` / `reset()` | `Promise<PrintServiceResponse>` | Limpia un error recuperable |
| `open()` / `close()` | `void` | Arranca/detiene el polling de estado |

**Métodos del builder** (todos encadenables):

- *Texto*: `addText`, `addTextAlign`, `addTextSize`, `addTextDouble`,
  `addTextStyle`, `addTextFont`, `addTextLang`, `addTextLineSpace`,
  `addTextRotate`, `addTextSmooth`, `addTextPosition`, `addTextVPosition`
- *Layout*: `addFeed`, `addFeedLine`, `addFeedUnit`, `addFeedPosition`,
  `addLayout`, `addHLine`, `addVLineBegin`, `addVLineEnd`, `addRotateBegin`,
  `addRotateEnd`
- *Gráficos*: `addBarcode`, `addSymbol`, `addImage`, `addLogo`
- *Modo página*: `addPageBegin`, `addPageArea`, `addPageDirection`,
  `addPagePosition`, `addPageLine`, `addPageRectangle`, `addPageEnd`
- *Dispositivo*: `addCut`, `addPulse`, `addSound`, `addRecovery`, `addReset`,
  `addCommand`

**Eventos** (para estado push, callbacks por naturaleza):
`onstatuschange`, `onbatterystatuschange`, `ononline`, `onoffline`,
`onpoweroff`, `oncoveropen`, `oncoverok`, `onpaperend`, `onpapernearend`,
`onpaperok`, `ondraweropen`, `ondrawerclosed`, `onbatterylow`, `onbatteryok`,
`onreceive`, `onerror`.

## Tamaño del bundle

Dos entry points, para que quien solo imprime por HTTP nunca arrastre el
transporte por socket:

| Import | Contenido | Tamaño (gzip) |
|---|---|---|
| `epos-printer-sdk/http` | `EposHttpPrinter`, `decodePrinterStatus`, tipos | **~7 KB** |
| `epos-printer-sdk` | Todo, incluido `ePOSDevice` + gestión de dispositivos | ~30 KB (+31 KB de `socket.io-client`, solo si lo instalás, ver abajo) |

El `socket.io-client@0.8.7` que necesita el transporte por socket es una
**peer dependency opcional**: no se instala por defecto, porque arrastra
paquetes transitivos con CVEs conocidas y la mayoría de las impresoras
(incluida cualquier TM-T88V común) ni siquiera hospedan ese servicio.
Instalalo explícitamente solo si necesitás sockets:

```bash
pnpm add socket.io-client@0.8.7
```

`sideEffects: false` más un mapa de `exports` correcto, así que
Vite/webpack/Rollup/esbuild hacen tree-shaking sin configuración extra.

## Uso con React

No hay binding de React para instalar, el cliente es un objeto común, así que
alcanza con un hook chico:

```ts
function usePrinter(host: string) {
  const printer = useMemo(() => new EposHttpPrinter(host), [host]);
  return printer;
}
```

Como el transporte HTTP no tiene estado (cada trabajo es una request
independiente), no hay conexión que mantener viva, que se corte, ni que
reestablecer.

Un ejemplo completo, UI de conexión, estado en vivo, códigos de barras, QR,
etiquetas, impresión de canvas con seguimiento, clasificación de errores con
acciones recomendadas y varias impresoras a la vez, está en
[`examples/react-app`](examples/react-app).

## Gestión de dispositivos (`ePOSDevice`)

Más allá de la impresión, `ePOSDevice` es la capa de sesión y gestión de
dispositivos: ciclo de vida de la conexión, `createDevice()`, cajas de
comunicación. A pesar del nombre no está atado al transporte por socket: corre
sobre cualquiera de los dos y decide cuál. Pasá `{ eposprint: true }` para ir
directo por HTTP; si no, intenta el socket y cae solo a HTTP.

Usalo cuando necesites dispositivos más allá de una impresora (cajones,
terminales CAT, DeviceTerminal). Para imprimir nada más, `EposHttpPrinter` es
más liviano y nunca carga nada de esto.

```ts
import { ePOSDevice } from 'epos-printer-sdk';

const epos = new ePOSDevice();
const result = await epos.connect('192.168.1.100', 8008);
if (result !== 'OK') throw new Error(result);

const printer = await epos.createDevice('local_printer', 'type_printer');
await printer.addText('Hola\n').addCut('feed').send();
```

Ojo que la regla de puerto difiere de `EposHttpPrinter`: acá solo `8008`
selecciona HTTP plano, cualquier otro (incluido `80`) se toma como HTTPS. Es el
mapeo del vendor original, conservado por paridad.

Tené en cuenta que las **TM-T88V** comunes no hospedan el servicio ePOS-Device
(solo lo hacen los modelos TM-i, TM-DT y TM-T88VI en adelante), en esas,
`connect()` cae de forma transparente a HTTP, que es lo que también hace el SDK
oficial.

## Notas de compatibilidad

- **HTTPS y certificados.** Los navegadores bloquean requests HTTP planas desde
  una página HTTPS, así que en producción normalmente necesitás la impresora
  accesible por HTTPS. Las impresoras sirven un certificado autofirmado, que
  hay que aceptar una vez por máquina cliente, poner la impresora detrás de un
  proxy inverso con certificado válido evita ese paso.
- **CORS.** El `service.cgi` de Epson responde con
  `Access-Control-Allow-Origin: *`, así que las llamadas desde el navegador
  funcionan sin proxy.
- **Concurrencia.** La librería serializa automáticamente las requests hacia la
  misma impresora *dentro de un mismo proceso* (una pestaña del navegador, un
  proceso de Node). Entre clientes distintos eso no aplica: ahí manejá
  `ERROR_DEVICE_BUSY` con reintentos como se muestra arriba, o encolá los
  trabajos en un servidor (la librería corre en Node, así que es el mismo
  código).

## Limitaciones conocidas

- La comunicación cifrada por socket (`crypto: true`) no está validada contra
  hardware real.
- Los dispositivos `type_display` (ePOS-Display) no se sondean.
- 18 de las ~22 subclases de dispositivo del SDK original (displays de cliente,
  teclados, lectores MSR, impresoras híbridas/slip, fiscales) no están portadas, ninguna aplica a una TM-T88V.

## Documentación

- [Notas de ingeniería](docs/ENGINEERING.md), cómo se hizo la ingeniería
  inversa del SDK, los bugs encontrados en el bundle original, y qué está
  verificado frente a qué está asumido (en inglés).
- [Changelog](CHANGELOG.md)
- [llms.txt](llms.txt), resumen legible por máquinas de la API y sus
  sutilezas, para asistentes de código. También servido en
  `https://unpkg.com/epos-printer-sdk/llms.txt`.
- [AGENTS.md](AGENTS.md), convenciones para agentes y humanos que contribuyan.

## Contribuir

Issues y PRs bienvenidos. Las áreas de mayor valor son ampliar la cobertura de
hardware y la profundidad de los tests; el camino WebSocket/cifrado está
intencionalmente en pausa.

## Licencia

MIT © Guido Wagner. Ver [LICENSE](./LICENSE).

Sin afiliación, aval ni soporte de Seiko Epson Corporation. "ePOS", "TM-T88V" y
marcas relacionadas pertenecen a sus respectivos dueños.
