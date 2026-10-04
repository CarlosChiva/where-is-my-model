---
version: alpha
name: Chiva Neón
description: Identidad visual con dos temas. Oscuro (por defecto) de neón sobre negro, con cian eléctrico como protagonista y verde neón como acento puntual. Claro llamado Azul sobre papel, con azul profundo como color primario.
colors:
  background: "#000000"
  surface-dim: "#05080D"
  surface: "#0A0F18"
  surface-elevated: "#101826"
  outline: "#1B2A40"
  outline-strong: "#5A7699"
  primary: "#00CFFF"
  on-primary: "#000000"
  primary-container: "#06263A"
  on-primary-container: "#00CFFF"
  secondary: "#0099FF"
  deep-blue: "#0066CC"
  on-deep-blue: "#FFFFFF"
  navy: "#0044AA"
  tertiary: "#3DFF12"
  on-tertiary: "#000000"
  on-surface: "#E8FBFF"
  on-surface-variant: "#B4C4D8"
  on-surface-muted: "#7F93AD"
  accent-violet: "#8B5CFF"
  accent-violet-light: "#A78BFF"
  success: "#3DFF12"
  info: "#00CFFF"
  warning: "#FFB020"
  error: "#FF4D6D"
typography:
  display:
    fontFamily: Chakra Petch
    fontSize: 4.4rem
    fontWeight: 700
    lineHeight: 1
    letterSpacing: -0.01em
  h1:
    fontFamily: Chakra Petch
    fontSize: 2.6rem
    fontWeight: 700
    lineHeight: 1.1
  h2:
    fontFamily: Chakra Petch
    fontSize: 2rem
    fontWeight: 600
    lineHeight: 1.2
  h3:
    fontFamily: Chakra Petch
    fontSize: 1.25rem
    fontWeight: 600
    lineHeight: 1.3
  body-lg:
    fontFamily: Figtree
    fontSize: 1.0625rem
    fontWeight: 400
    lineHeight: 1.55
  body-md:
    fontFamily: Figtree
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.55
  body-sm:
    fontFamily: Figtree
    fontSize: 0.875rem
    fontWeight: 400
    lineHeight: 1.45
  button:
    fontFamily: Chakra Petch
    fontSize: 0.9375rem
    fontWeight: 600
    lineHeight: 1
  label-mono:
    fontFamily: JetBrains Mono
    fontSize: 0.75rem
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: 0.12em
  code:
    fontFamily: JetBrains Mono
    fontSize: 0.8125rem
    fontWeight: 400
    lineHeight: 1.7
rounded:
  sm: 4px
  md: 6px
  lg: 8px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 64px
components:
  page:
    backgroundColor: "{colors.background}"
    textColor: "{colors.on-surface}"
    typography: "{typography.body-md}"
  section-alt:
    backgroundColor: "{colors.surface-dim}"
    textColor: "{colors.on-surface}"
  header:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    height: 64px
    padding: 16px
  button-primary:
    backgroundColor: "{colors.tertiary}"
    textColor: "{colors.on-tertiary}"
    typography: "{typography.button}"
    rounded: "{rounded.sm}"
    padding: 12px
  button-primary-hover:
    backgroundColor: "{colors.on-surface}"
    textColor: "{colors.on-tertiary}"
  button-secondary:
    backgroundColor: "{colors.background}"
    textColor: "{colors.primary}"
    typography: "{typography.button}"
    rounded: "{rounded.sm}"
    padding: 12px
  button-secondary-hover:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
  button-tertiary:
    backgroundColor: "{colors.deep-blue}"
    textColor: "{colors.on-deep-blue}"
    typography: "{typography.button}"
    rounded: "{rounded.sm}"
    padding: 12px
  button-tertiary-hover:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.on-primary}"
  card:
    backgroundColor: "{colors.surface-elevated}"
    textColor: "{colors.on-surface-variant}"
    rounded: "{rounded.md}"
    padding: 16px
  card-featured:
    backgroundColor: "{colors.surface-elevated}"
    textColor: "{colors.on-surface-variant}"
    rounded: "{rounded.md}"
    padding: 16px
  input:
    backgroundColor: "{colors.surface-elevated}"
    textColor: "{colors.on-surface}"
    typography: "{typography.body-md}"
    rounded: "{rounded.sm}"
    padding: 12px
    height: 44px
  field-border:
    backgroundColor: "{colors.outline-strong}"
    height: 1.5px
  divider:
    backgroundColor: "{colors.outline}"
    height: 1px
  caption:
    textColor: "{colors.on-surface-muted}"
    typography: "{typography.body-sm}"
  link:
    textColor: "{colors.primary}"
  link-hover:
    textColor: "{colors.on-surface}"
  banner-info:
    backgroundColor: "{colors.primary-container}"
    textColor: "{colors.on-primary-container}"
    rounded: "{rounded.md}"
    padding: 16px
  decor-filament:
    backgroundColor: "{colors.navy}"
    height: 2px
  chart-accent:
    backgroundColor: "{colors.accent-violet}"
    size: 12px
  badge-success:
    textColor: "{colors.success}"
    typography: "{typography.label-mono}"
    rounded: "{rounded.full}"
    padding: 8px
  badge-info:
    textColor: "{colors.info}"
    typography: "{typography.label-mono}"
    rounded: "{rounded.full}"
    padding: 8px
  badge-accent:
    textColor: "{colors.accent-violet-light}"
    typography: "{typography.label-mono}"
    rounded: "{rounded.full}"
    padding: 8px
  badge-warning:
    textColor: "{colors.warning}"
    typography: "{typography.label-mono}"
    rounded: "{rounded.full}"
    padding: 8px
  badge-error:
    textColor: "{colors.error}"
    typography: "{typography.label-mono}"
    rounded: "{rounded.full}"
    padding: 8px
# Extensión no estándar: la especificación define un único tema por fichero.
# Los tokens de arriba son el tema oscuro (por defecto). `themes.light` repite las
# mismas claves con los valores del tema claro "Azul sobre papel", y en `components`
# solo redefine los componentes cuyas referencias cambian. El resto de componentes
# resuelven sus referencias {colors.*} contra los colores del tema activo.
themes:
  light:
    name: Azul sobre papel
    description: Tema claro con fondo gris azulado muy suave, azul profundo como color primario y el neón reducido a relleno y detalles.
    colors:
      background: "#EEF2F6"
      surface-dim: "#E3EAF1"
      surface: "#FFFFFF"
      surface-elevated: "#FFFFFF"
      outline: "#D3DCE6"
      outline-strong: "#52667F"
      primary: "#0066CC"
      on-primary: "#FFFFFF"
      primary-container: "#DCEBFA"
      on-primary-container: "#0044AA"
      secondary: "#006E99"
      deep-blue: "#0066CC"
      on-deep-blue: "#FFFFFF"
      navy: "#0044AA"
      tertiary: "#3DFF12"
      on-tertiary: "#05080D"
      on-surface: "#05080D"
      on-surface-variant: "#34465C"
      on-surface-muted: "#52667F"
      accent-violet: "#6B3FE0"
      accent-violet-light: "#6B3FE0"
      success: "#187000"
      info: "#006E99"
      warning: "#8F5400"
      error: "#C81E45"
    components:
      button-primary:
        backgroundColor: "{colors.primary}"
        textColor: "{colors.on-primary}"
      button-primary-hover:
        backgroundColor: "{colors.navy}"
        textColor: "{colors.on-primary}"
      button-tertiary:
        backgroundColor: "{colors.secondary}"
        textColor: "{colors.on-primary}"
      button-tertiary-hover:
        backgroundColor: "{colors.navy}"
        textColor: "{colors.on-primary}"
      link-hover:
        textColor: "{colors.navy}"
---

## Overview

Chiva Neón es una identidad de rótulo de neón. La marca sale de un logo con un lobo/cuervo dibujado con líneas de luz cian sobre negro puro, con la palabra "Chiva" en verde neón. Tiene dos temas que comparten tipografía, espaciado, formas y estructura, y solo cambian el color:

- **Tema oscuro (por defecto):** el neón encendido sobre una noche cerrada. Es la versión original de la marca.
- **Tema claro, "Azul sobre papel":** la misma marca de día. Fondo gris azulado muy suave, el azul profundo como color primario y el neón reducido a relleno pequeño y detalles.

**Cuándo usar cada tema:**

- Usa el tema oscuro salvo que se indique lo contrario.
- Usa el tema claro cuando el usuario lo elija, cuando el sistema declare `prefers-color-scheme: light` y no haya una elección guardada, o cuando el proyecto lo pida de forma explícita.
- Un proyecto que ofrece cambio de tema debe implementar los dos con las variables CSS de la sección Colors. No mezcles valores de un tema dentro del otro.

**Cómo se lee este fichero:**

- Las claves estándar del front matter (`colors`, `typography`, `rounded`, `spacing`, `components`) describen el **tema oscuro**.
- La clave `themes.light` es una extensión no estándar. Repite las mismas claves de `colors` con los valores del tema claro y redefine solo los componentes que cambian. Los demás componentes usan sus mismas referencias y toman el valor del tema activo.
- Las herramientas estándar, como `lint` y `export` de `@google/design.md`, solo leen el tema oscuro. Cualquier agente que construya una interfaz debe leer también `themes.light` y la sección de tema claro de este documento.

Principios comunes a ambos temas:

- **El color de marca es el azul-cian.** Sirve de línea, enlace, icono y borde destacado.
- **El verde neón es un destello.** Nunca supera el 5% de la pantalla y nunca se usa como texto sobre fondo claro.
- **El contraste es obligatorio.** Todo texto cumple como mínimo WCAG AA con los pares que indican las tablas de la sección Colors.
- **No hay colores fuera de la paleta.** No cambies un hex por uno "parecido".

## Colors

### Tema oscuro

Los valores exactos están en el front matter. Capas:

**Colores del logo (fijos):**

- **background (`#000000`):** fondo principal. Entre el 65 y el 70% de la pantalla.
- **primary (`#00CFFF`):** cian neón. Enlaces, iconos, líneas, bordes activos y botón secundario.
- **secondary (`#0099FF`):** azul eléctrico. Degradados y hover del botón azul.
- **deep-blue (`#0066CC`):** azul profundo. Botón terciario con texto blanco.
- **navy (`#0044AA`):** azul marino. Solo decorativo, nunca para texto (2,4:1 sobre negro).
- **on-surface (`#E8FBFF`):** blanco frío. Texto principal.
- **tertiary (`#3DFF12`):** verde neón. Botón principal y una palabra destacada.

**Superficies:** surface-dim `#05080D` (secciones alternas), surface `#0A0F18` (cabecera y pie), surface-elevated `#101826` (tarjetas y campos), outline `#1B2A40` (líneas decorativas), outline-strong `#5A7699` (borde de campos, 3,8:1 sobre surface-elevated).

**Texto:** on-surface-variant `#B4C4D8` (párrafos), on-surface-muted `#7F93AD` (ayudas y fechas, mínimo 14px).

**Acento y estados:** accent-violet `#8B5CFF` (relleno), accent-violet-light `#A78BFF` (texto), success `#3DFF12`, info `#00CFFF`, warning `#FFB020`, error `#FF4D6D`. primary-container `#06263A` con on-primary-container `#00CFFF` (8,4:1) forma un aviso informativo.

**Reparto recomendado:**

| Peso | Colores |
|---|---|
| 70% | background, surface-dim, surface, surface-elevated |
| 15% | primary, secondary, deep-blue |
| 8% | on-surface, on-surface-variant |
| 5% | tertiary |
| 2% | accent-violet y estados |

**Combinaciones permitidas (ratios WCAG):**

| Texto | Fondo | Ratio | Nivel | Uso |
|---|---|---|---|---|
| on-surface `#E8FBFF` | background `#000000` | 19,7 | AAA | Texto principal |
| on-surface-variant `#B4C4D8` | surface `#0A0F18` | 10,8 | AAA | Párrafos |
| on-surface-muted `#7F93AD` | surface `#0A0F18` | 6,1 | AA | Texto pequeño |
| primary `#00CFFF` | background `#000000` | 11,4 | AAA | Enlaces |
| secondary `#0099FF` | background `#000000` | 7,0 | AAA | Enlaces secundarios |
| tertiary `#3DFF12` | background `#000000` | 15,5 | AAA | Palabra destacada |
| accent-violet-light `#A78BFF` | surface `#0A0F18` | 7,1 | AAA | Etiquetas violeta |
| on-primary `#000000` | primary `#00CFFF` | 11,4 | AAA | Botón cian |
| on-tertiary `#000000` | tertiary `#3DFF12` | 15,5 | AAA | Botón principal |
| on-deep-blue `#FFFFFF` | deep-blue `#0066CC` | 5,6 | AA | Botón azul |
| deep-blue `#0066CC` | background `#000000` | 3,8 | Solo UI grande | Iconos y bordes grandes |
| navy `#0044AA` | background `#000000` | 2,4 | No válido | Nunca para texto |

### Tema claro: Azul sobre papel

El azul profundo pasa a ser el color primario. El cian y el verde neón de la marca no se leen sobre fondo claro (1,8:1 y 1,3:1), así que se usan solo como relleno con texto oscuro encima, y para texto se usan sus versiones oscuras. Los valores exactos están en `themes.light.colors`.

**Superficies:**

- **background (`#EEF2F6`):** papel. Fondo de página.
- **surface (`#FFFFFF`)** y **surface-elevated (`#FFFFFF`):** tarjetas, menús y campos. Se separan del fondo con borde y sombra suave.
- **surface-dim (`#E3EAF1`):** secciones alternas y pie.
- **outline (`#D3DCE6`):** líneas finas. Decorativo (1,4:1), no sirve de borde de campos.
- **outline-strong (`#52667F`):** borde de campos de formulario (5,2:1 sobre el papel).

**Texto:**

- **on-surface (`#05080D`):** tinta. Texto principal.
- **on-surface-variant (`#34465C`):** párrafos y descripciones.
- **on-surface-muted (`#52667F`):** ayudas y fechas. Sobre surface-dim da 4,85:1, así que sirve en las secciones alternas.

**Color de marca y acentos:**

- **primary (`#0066CC`):** azul profundo. Enlaces, iconos, líneas, foco y botón principal con texto blanco.
- **navy (`#0044AA`):** azul marino. En este tema sí se usa: estado hover y pulsado de los elementos azules (8,7:1 con texto blanco) y texto sobre primary-container.
- **secondary (`#006E99`):** cian oscuro. Enlaces secundarios, iconos y botón terciario.
- **primary-container (`#DCEBFA`)** con **on-primary-container (`#0044AA`)**, 7,2:1: avisos informativos, filas seleccionadas y fondos de etiqueta.
- **tertiary (`#3DFF12`):** verde neón, solo detalles: un punto junto a una etiqueta, un subrayado o un indicador. Nunca texto, nunca fondo de sección, nunca botón principal.
- **accent-violet (`#6B3FE0`):** etiquetas y gráficos (5,1:1 sobre surface-dim).
- **Estados:** success `#187000`, info `#006E99`, warning `#8F5400`, error `#C81E45`. Todos dan al menos 4,5:1 sobre background, surface y surface-dim.
- El cian neón `#00CFFF` solo aparece como relleno pequeño (por ejemplo una barra de progreso) con texto `#05080D` encima (10,9:1) y nunca como texto.

**Reparto recomendado:**

| Peso | Colores |
|---|---|
| 75% | background, surface, surface-dim |
| 15% | primary, secondary, primary-container |
| 8% | on-surface, on-surface-variant |
| 2% | tertiary (detalles) y estados |

**Combinaciones permitidas (ratios WCAG):**

| Texto | Fondo | Ratio | Nivel | Uso |
|---|---|---|---|---|
| on-surface `#05080D` | background `#EEF2F6` | 17,8 | AAA | Texto principal |
| on-surface `#05080D` | surface-dim `#E3EAF1` | 16,5 | AAA | Texto en secciones alternas |
| on-surface-variant `#34465C` | background `#EEF2F6` | 8,6 | AAA | Párrafos |
| on-surface-muted `#52667F` | background `#EEF2F6` | 5,2 | AA | Texto pequeño |
| on-surface-muted `#52667F` | surface-dim `#E3EAF1` | 4,85 | AA | Texto pequeño en secciones alternas |
| primary `#0066CC` | background `#EEF2F6` | 4,95 | AA | Enlaces |
| primary `#0066CC` | surface-dim `#E3EAF1` | 4,6 | AA | Enlaces en secciones alternas |
| secondary `#006E99` | background `#EEF2F6` | 5,1 | AA | Enlaces secundarios |
| navy `#0044AA` | background `#EEF2F6` | 7,8 | AAA | Hover de enlaces |
| on-primary `#FFFFFF` | primary `#0066CC` | 5,6 | AA | Botón principal |
| on-primary `#FFFFFF` | navy `#0044AA` | 8,7 | AAA | Hover del botón principal |
| on-primary `#FFFFFF` | secondary `#006E99` | 5,7 | AA | Botón terciario |
| on-primary-container `#0044AA` | primary-container `#DCEBFA` | 7,2 | AAA | Aviso informativo |
| on-tertiary `#05080D` | tertiary `#3DFF12` | 14,8 | AAA | Texto sobre verde (uso excepcional) |
| accent-violet `#6B3FE0` | background `#EEF2F6` | 5,5 | AA | Etiquetas violeta |
| warning `#8F5400` | background `#EEF2F6` | 5,4 | AA | Avisos |
| error `#C81E45` | background `#EEF2F6` | 5,0 | AA | Errores |
| success `#187000` | background `#EEF2F6` | 5,6 | AA | Estado correcto |
| outline-strong `#52667F` | surface `#FFFFFF` | 5,9 | UI | Borde de campos |
| tertiary `#3DFF12` | background `#EEF2F6` | 1,2 | No válido | Nunca como texto |

**Variables CSS.** Implementa siempre los dos temas con estas variables semánticas. Los componentes usan solo `var(--...)` y nunca hex sueltos, y así el tema cambia sin tocar los componentes.

```css
:root {
  /* Tema oscuro (por defecto) */
  --bg: #000000;
  --surface: #101826;
  --surface-dim: #05080D;
  --line: #1B2A40;
  --line-strong: #5A7699;
  --fg: #E8FBFF;
  --fg-2: #B4C4D8;
  --fg-3: #7F93AD;
  --link: #00CFFF;
  --link-hover: #E8FBFF;
  --btn-primary-bg: #3DFF12;
  --btn-primary-fg: #000000;
  --btn-primary-hover-bg: #E8FBFF;
  --btn-glow: 0 0 28px rgba(61, 255, 18, .35);
  --accent-text: #3DFF12;
  --container: #06263A;
  --on-container: #00CFFF;
  --violet: #A78BFF;
  --success: #3DFF12;
  --info: #00CFFF;
  --warn: #FFB020;
  --err: #FF4D6D;
  --deep-blue: #0066CC;
  --shadow: 0 0 28px rgba(0, 207, 255, .35);
  --focus: #00CFFF;
  --selection: rgba(0, 207, 255, .35);
  color-scheme: dark;
}

@media (prefers-color-scheme: light) {
  :root:not([data-theme="dark"]) {
    /* Tema claro: Azul sobre papel */
    --bg: #EEF2F6;
    --surface: #FFFFFF;
    --surface-dim: #E3EAF1;
    --line: #D3DCE6;
    --line-strong: #52667F;
    --fg: #05080D;
    --fg-2: #34465C;
    --fg-3: #52667F;
    --link: #0066CC;
    --link-hover: #0044AA;
    --btn-primary-bg: #0066CC;
    --btn-primary-fg: #FFFFFF;
    --btn-primary-hover-bg: #0044AA;
    --btn-glow: none;
    --accent-text: #006E99;
    --container: #DCEBFA;
    --on-container: #0044AA;
    --violet: #6B3FE0;
    --success: #187000;
    --info: #006E99;
    --warn: #8F5400;
    --err: #C81E45;
    --deep-blue: #0066CC;
    --shadow: 0 2px 12px rgba(0, 68, 170, .12);
    --focus: #0066CC;
    --selection: rgba(0, 207, 255, .30);
    color-scheme: light;
  }
}

:root[data-theme="light"] {
  /* Mismos valores que el bloque anterior */
  --bg: #EEF2F6;
  --surface: #FFFFFF;
  --surface-dim: #E3EAF1;
  --line: #D3DCE6;
  --line-strong: #52667F;
  --fg: #05080D;
  --fg-2: #34465C;
  --fg-3: #52667F;
  --link: #0066CC;
  --link-hover: #0044AA;
  --btn-primary-bg: #0066CC;
  --btn-primary-fg: #FFFFFF;
  --btn-primary-hover-bg: #0044AA;
  --btn-glow: none;
  --accent-text: #006E99;
  --container: #DCEBFA;
  --on-container: #0044AA;
  --violet: #6B3FE0;
  --success: #187000;
  --info: #006E99;
  --warn: #8F5400;
  --err: #C81E45;
  --deep-blue: #0066CC;
  --shadow: 0 2px 12px rgba(0, 68, 170, .12);
  --focus: #0066CC;
  --selection: rgba(0, 207, 255, .30);
  color-scheme: light;
}

body { background: var(--bg); color: var(--fg); }
::selection { background: var(--selection); color: var(--fg); }
```

Equivalencias entre tokens y variables: background → `--bg`, surface y surface-elevated → `--surface`, surface-dim → `--surface-dim`, outline → `--line`, outline-strong → `--line-strong`, on-surface → `--fg`, on-surface-variant → `--fg-2`, on-surface-muted → `--fg-3`, primary → `--link`, tertiary (botón principal en oscuro) y primary (botón principal en claro) → `--btn-primary-bg`, primary-container → `--container`, on-primary-container → `--on-container`, accent-violet → `--violet`, warning → `--warn`, error → `--err`.

Si ya existe código con las variables de marca (`--cian`, `--verde`, `--negro`…), puedes mantenerlas como constantes de color de marca, pero los componentes deben usar las variables semánticas de arriba.

## Typography

Tres familias de Google Fonts con papel fijo, iguales en ambos temas. Declara siempre una pila de respaldo.

- **Chakra Petch** (500, 600, 700): títulos, botones y nombres de marca. Es la voz de la marca. No la uses para párrafos.
- **Figtree** (400, 500, 600): texto corrido, formularios y navegación.
- **JetBrains Mono** (400, 500): hex, etiquetas en mayúsculas con letter-spacing, datos y código.

Pilas de respaldo: `"Chakra Petch", "Segoe UI", sans-serif`; `"Figtree", "Segoe UI", system-ui, sans-serif`; `"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace`.

Reglas de uso:

- **Tema oscuro:** el título principal puede llevar una palabra en verde o cian con `text-shadow` de neón suave (`0 0 22px` con el color al 45%). Una palabra por pantalla.
- **Tema claro:** la palabra destacada del título va en `primary` (`#0066CC`) sin `text-shadow`. El verde neón no se usa como color de texto.
- Las etiquetas pequeñas en mayúsculas usan `label-mono` y letter-spacing de al menos `0.12em`.
- Anchura de línea de texto corrido: máximo 65 caracteres.
- Los títulos llevan `text-wrap: balance`. Los números en columnas llevan `font-variant-numeric: tabular-nums`.
- No uses Inter, Roboto ni Arial como sustitutas de las familias de marca.

## Layout

Igual en los dos temas.

- Base de 8px. Escala: 4, 8, 16, 24, 32 y 64px (tokens `xs` a `xxl`).
- Margen lateral mínimo de 16px en cualquier ancho. La página no hace scroll horizontal a 400px.
- Contenido con ancho máximo de 1040px, centrado, con secciones separadas por 64px.
- Usa flex o grid con `gap` en lugar de márgenes entre hermanos.
- Las cuadrículas de tarjetas usan `repeat(auto-fit, minmax(220px, 1fr))` y colapsan a una columna en móvil.
- Alterna secciones entre `--bg` y `--surface-dim` para marcar el ritmo sin añadir líneas.

## Elevation & Depth

### Tema oscuro

La profundidad se consigue con luz y capas de superficie, no con sombras oscuras (no se ven sobre negro).

- **Niveles:** `background` (nivel 0) → `surface-dim` → `surface` → `surface-elevated` (el más alto, para elementos interactivos y flotantes).
- **Resplandor cian (`--shadow`):** para el elemento más importante de una vista, junto a un borde de `primary` al 50% de opacidad. Uno o dos por pantalla.
- **Resplandor verde (`--btn-glow`):** solo en el botón principal.
- **Degradados permitidos:** `linear-gradient(135deg, #00CFFF, #0066CC)` y `linear-gradient(135deg, #00CFFF, #8B5CFF)`. Para fondos de sección, un `radial-gradient` con `deep-blue` al 35–70% de opacidad que se funde en negro.
- No uses `box-shadow` negro, gris ni de colores fuera de los dos resplandores.

### Tema claro

Aquí no hay luz que emitir: la profundidad se consigue con sombra suave, borde fino y capas de blanco sobre el papel. El resplandor neón no se usa.

- **Niveles:** `background` (papel) → `surface` (blanco, tarjetas y menús) con borde de 1px en `outline`. Las secciones alternas usan `surface-dim`.
- **Sombra (`--shadow`):** `0 2px 12px rgba(0, 68, 170, .12)`, azulada y suave. Úsala en tarjetas destacadas, menús y diálogos. No uses sombras negras ni más fuertes.
- **Botón principal:** sin resplandor (`--btn-glow: none`).
- **Degradado decorativo:** `linear-gradient(135deg, #0066CC, #00CFFF)` para barras, líneas y fondos de iconos. No pongas texto pequeño encima.
- **Fondo de portada:** sobre el papel, un `radial-gradient(ellipse at 50% 0%, rgba(0, 207, 255, .18), transparent 60%)` aporta el aire del neón sin perder legibilidad.

## Shapes

Esquinas contenidas, con aire técnico, nunca muy redondeadas. Iguales en ambos temas.

- `sm` (4px): botones y campos de formulario.
- `md` (6px): tarjetas, paneles y bloques de código.
- `lg` (8px): contenedores grandes y secciones de demostración.
- `full` (9999px): solo etiquetas (badges) y avatares.
- Bordes de 1px en `outline` para tarjetas normales. Bordes de 1,5px en `primary` para botones secundarios y elementos destacados.
- Bordes de campos de formulario de 1,5px en `outline-strong` en ambos temas.
- No apliques el mismo radio y la misma sombra a todos los bloques. Reserva borde, relleno y sombra para el elemento que debe destacar.

## Components

Los valores de cada componente están en el front matter: el tema oscuro en `components` y las diferencias del claro en `themes.light.components`. Comportamiento por componente:

| Componente | Tema oscuro | Tema claro |
|---|---|---|
| **button-primary** | Fondo verde neón, texto negro, resplandor verde. Hover: fondo blanco frío. | Fondo `#0066CC`, texto blanco, sin resplandor. Hover: fondo `#0044AA`. |
| **button-secondary** | Transparente, texto y borde de 1,5px en cian. Hover: relleno cian con texto negro. | Transparente, texto y borde de 1,5px en `#0066CC`. Hover: relleno `#0066CC` con texto blanco. |
| **button-tertiary** | Fondo `#0066CC`, texto blanco. Hover: `#0099FF` con texto negro. | Fondo `#006E99`, texto blanco. Hover: `#0044AA`. |
| **card** | Fondo elevado, borde 1px `outline`, radio `md`, relleno 16px. | Fondo blanco, borde 1px `outline`, radio `md`, relleno 16px. |
| **card-featured** | Borde cian al 50% y resplandor cian. | Borde 1,5px `#0066CC` y `--shadow` azulada. |
| **input** | Fondo elevado, borde `outline-strong`. Foco: anillo de 2px en `primary`. Altura mínima 44px. | Fondo blanco, borde `#52667F`. Foco: anillo de 2px en `#0066CC`. Altura mínima 44px. |
| **link** | Cian con subrayado (`text-underline-offset: 3px`). Hover: blanco frío. | `#0066CC` con subrayado. Hover: `#0044AA`. |
| **banner-info** | Fondo `#06263A`, texto cian. | Fondo `#DCEBFA`, texto `#0044AA`. |
| **badges** | Texto y borde de 1px del color de estado, fondo transparente, píldora, `label-mono`. | Igual, con los colores de estado del tema claro. |

Reglas comunes:

- Los badges llevan siempre una palabra, nunca solo el color.
- **Foco visible:** todo elemento interactivo muestra un contorno de 2px en `--focus` con `outline-offset: 3px` al recibir foco por teclado.
- **Movimiento:** transiciones de 150–200ms en borde, color y desplazamiento de 2px. Respeta `prefers-reduced-motion`.
- **Cambio de tema:** respeta `prefers-color-scheme` por defecto y permite forzar el tema con `data-theme="dark"` o `data-theme="light"` en `<html>`. Guarda la elección del usuario solo como comodidad, con `try/catch` en lectura y escritura.

## Do's and Don'ts

**Haz (ambos temas):**

- Usa solo los colores definidos arriba, siempre mediante las variables CSS semánticas.
- Define `color-scheme` y un fondo explícito en `body` para cada tema.
- Comprueba cualquier par de texto y fondo nuevo contra la tabla de contraste del tema activo antes de usarlo.
- Mantén una sola acción principal por vista.

**Haz (tema oscuro):**

- Mantén negro o una superficie oscura en el 70% de la pantalla.
- Usa el verde neón solo en la acción principal y como mucho una palabra destacada.
- Usa texto negro sobre cian y verde, y texto blanco sobre azul profundo.

**Haz (tema claro):**

- Usa `#0066CC` para enlaces y botón principal, y `#0044AA` para hover y pulsado.
- Usa texto `#05080D` sobre el cian o el verde neón cuando se usen como relleno.
- En secciones sobre `surface-dim`, usa `on-surface-muted` solo a 14px o más.

**No hagas (ambos temas):**

- No añadas colores nuevos (naranjas, rosas, verdes que no sean los definidos) ni sustituyas un hex por otro parecido.
- No uses el color como único indicador de un estado.
- No uses Inter, Roboto, Arial ni fuentes que no sean las tres de la marca.
- No uses emoji como marcadores de sección ni decoración.
- No mezcles variables de un tema con hex de otro.

**No hagas (tema oscuro):**

- No crees fondos blancos o grises claros dentro del tema oscuro.
- No uses `navy` (`#0044AA`) para texto ni iconos.
- No uses más de un botón verde por vista ni verde como fondo de secciones.
- No uses sombras negras ni degradados fuera de la sección Elevation & Depth.

**No hagas (tema claro):**

- No uses el cian `#00CFFF` ni el verde `#3DFF12` como color de texto, de icono o de enlace.
- No uses el verde neón como botón principal ni como fondo de sección.
- No uses resplandores neón ni sombras negras o más fuertes que `--shadow`.
- No uses `outline` (`#D3DCE6`) como borde de campos de formulario (1,4:1): usa `outline-strong`.
- No uses `on-surface-muted` por debajo de 14px.
