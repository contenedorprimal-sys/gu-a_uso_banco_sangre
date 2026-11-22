# Cuaderno: MySQL, del SELECT al clúster

Sitio estático que acompaña el proyecto **Banco de Sangre**. No necesita servidor, dependencias ni conexión: se abre con doble clic en `index.html` y funciona con `file://`.

## Contenido

- **24 capítulos** agrupados en cinco fases: Fundamentos, Taller de consultas, Espacio y diseño, Disponibilidad y operación, y Proyecto.
- **4 apéndices**: guía de uso, chuleta de errores, ejercicios con soluciones y datos completos del caso.
- Cada capítulo enlaza al script o documento fuente dentro de `../proyecto/`.
- Los bloques SQL se pueden copiar con un clic.

## Estructura

```
sitio/
├── index.html            interfaz única (shell)
├── assets/
│   ├── app.js            rutas, búsqueda, TOC, progreso, copiar código
│   ├── styles.css        sistema de diseño y responsive
│   ├── content.js        GENERADO: capítulos y metadatos
│   ├── favicon.svg
│   └── fonts/            Adwaita + iA Writer (locales)
├── build/
│   └── build.py          compila content/ → assets/content.js
└── content/
    ├── 24 caps.          fragmentos HTML
    └── guia, chuleta, ejercicios, datos-del-caso  apéndices
```

## Editar o añadir contenido

1. Modifica el fragmento HTML en `content/`.
2. Si es un capítulo nuevo, añádelo a `CHAPTERS` en `build/build.py` con `id`, `num`, `phase`, `title`, `short`, `summary`, `takeaways`, `source` y `sourceLabel`.
3. Regenera:

```bash
cd sitio
python3 build/build.py
```

No edites `assets/content.js` a mano: se sobrescribe.

### Convenciones de los fragmentos

- Usa `h2` con `id` para que aparezcan en el índice lateral; `h3` también se indexa en la búsqueda.
- Bloques de código: `<pre><code class="language-sql">…</code></pre>` (también `language-bash` y `language-text`).
- Avisos: `callout callout--note`, `callout--warning` y `callout--case`, siempre con un `callout__label`.
- Tablas dentro de `div.table-wrap`; el JS también envuelve las que falten.
- Evita enlaces externos: el sitio está pensado para funcionar sin red.

## Interacción

| Acción | Atajo |
| --- | --- |
| Buscar | `Ctrl` + `K`, `⌘` + `K` o `/` |
| Mover por resultados | `↑` / `↓` |
| Abrir resultado | `Enter` |
| Cerrar búsqueda o menú | `Esc` |

En pantallas menores de 980 px el índice pasa a un panel lateral con foco atrapado. Respeta `prefers-reduced-motion`, `prefers-color-scheme` y `prefers-contrast`.

## Verificación rápida

```bash
python3 build/build.py
node --check assets/app.js
```

Abre `index.html` y comprueba: portada, un capítulo con código, búsqueda, copiar código, menú móvil y modo oscuro del sistema.
