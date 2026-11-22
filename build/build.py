#!/usr/bin/env python3
"""Genera assets/content.js a partir de los fragmentos HTML de content/.

Uso:
    python3 build/build.py

No edites assets/content.js a mano: se sobrescribe.
"""
from __future__ import annotations

import json
import re
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / "content"
OUT = ROOT / "assets" / "content.js"

META = {
    "title": "MySQL, del SELECT al clúster",
    "kicker": "Cuaderno de administración de bases de datos",
    "description": (
        "Un recorrido por MySQL desde la primera consulta hasta las particiones, "
        "el failover y los respaldos, con el proyecto Banco de Sangre como caso real."
    ),
}

PHASES = [
    {
        "id": "fundamentos",
        "label": "Fundamentos",
        "range": "01–06",
        "desc": "El vocabulario que faltaba: DBMS, arquitectura, tablas, consultas y permisos.",
    },
    {
        "id": "taller",
        "label": "Taller de consultas",
        "range": "07–13",
        "desc": "Del SELECT a las funciones de ventana: filtrar, agrupar, encadenar consultas y automatizar con vistas y rutinas.",
    },
    {
        "id": "espacio",
        "label": "Espacio y diseño",
        "range": "14–18",
        "desc": "Modelar el caso, estimar el crecimiento, indexar, particionar y automatizar.",
    },
    {
        "id": "operacion",
        "label": "Disponibilidad y operación",
        "range": "19–23",
        "desc": "Nueves, failover, monitoreo, auditoría, respaldos y afinación.",
    },
    {
        "id": "proyecto",
        "label": "Proyecto",
        "range": "24",
        "desc": "El banco de sangre completo, con sus scripts y la demo de 20 minutos.",
    },
]

CHAPTERS = [
    {
        "id": "que-es-un-dbms",
        "num": "01",
        "phase": "fundamentos",
        "title": "Qué es un DBMS y qué hace un DBA",
        "short": "DBMS y el rol del DBA",
        "summary": "La diferencia entre guardar archivos y administrar datos: qué es un DBMS, qué hace un DBA y por qué su trabajo no termina en crear tablas.",
        "takeaways": [
            "Un DBMS administra el acceso concurrente, la integridad y la recuperación; un archivo plano no lo hace.",
            "El DBA no diseña el negocio: implementa, protege y mantiene en operación lo que el negocio necesita.",
            "Hay perfiles distintos (System, Arquitecto, Analista, OLTP, OLAP) y en equipos pequeños se combinan.",
        ],
        "source": "../proyecto/README.md",
        "sourceLabel": "Leer el README del proyecto",
    },
    {
        "id": "instancia-y-arquitectura",
        "num": "02",
        "phase": "fundamentos",
        "title": "Instancia, memoria y archivos",
        "short": "Instancia y arquitectura",
        "summary": "La instancia son procesos y memoria; la base de datos son archivos. Entender esa separación explica por qué un reinicio no borra datos y por qué la memoria es el primer punto de afinación.",
        "takeaways": [
            "Instancia = procesos + memoria en ejecución; base de datos = archivos físicos que persisten.",
            "El buffer pool cachea páginas de datos e índices para no leer el disco en cada consulta.",
            "El redo log garantiza que una transacción confirmada no se pierda aunque el servidor se caiga.",
        ],
        "source": "../proyecto/README.md",
        "sourceLabel": "Ver el proyecto",
    },
    {
        "id": "crear-y-modelar",
        "num": "03",
        "phase": "fundamentos",
        "title": "Bases, tablas, llaves y restricciones",
        "short": "Crear y modelar",
        "summary": "Cómo se pasa de una idea a una tabla correcta: tipos de dato, PRIMARY KEY, FOREIGN KEY, UNIQUE, NOT NULL y CHECK. El esquema es un contrato, no una sugerencia.",
        "takeaways": [
            "La PRIMARY KEY identifica una fila; la FOREIGN KEY impide referencias a filas que no existen.",
            "Elegir bien el tipo de dato ahorra espacio y evita datos imposibles.",
            "Una tabla sin restricciones delega la integridad a la aplicación y tarde o temprano falla.",
        ],
        "source": "../proyecto/sql/00_esquema.sql",
        "sourceLabel": "Ver 00_esquema.sql",
    },
    {
        "id": "crud",
        "num": "04",
        "phase": "fundamentos",
        "title": "CRUD: leer, escribir, actualizar y borrar",
        "short": "CRUD esencial",
        "summary": "Las cuatro operaciones que sostienen todo lo demás, con el cuidado que exige un banco de sangre: dónde va el WHERE, qué devuelve un UPDATE y por qué el DELETE se piensa dos veces.",
        "takeaways": [
            "Sin WHERE, UPDATE y DELETE afectan todas las filas: no es un error de sintaxis, es un incidente.",
            "INSERT puede insertar varias filas y devolver valores con LAST_INSERT_ID().",
            "SELECT no solo lee: ORDER BY, LIMIT y las funciones de agregado convierten datos en respuestas.",
        ],
        "source": "../proyecto/sql/01_datos_demo.sql",
        "sourceLabel": "Ver datos de demo",
    },
    {
        "id": "consultas",
        "num": "05",
        "phase": "fundamentos",
        "title": "JOIN, agregados y subconsultas",
        "short": "Consultas que responden",
        "summary": "El salto de «ver filas» a «responder preguntas»: JOIN para cruzar tablas, GROUP BY para resumir, HAVING para filtrar grupos y subconsultas para comparar contra un conjunto.",
        "takeaways": [
            "INNER JOIN devuelve solo coincidencias; LEFT JOIN conserva la tabla izquierda y rellena con NULL.",
            "WHERE filtra filas antes de agrupar; HAVING filtra grupos después de agregar.",
            "Una subconsulta puede reemplazar un JOIN cuando la pregunta es «quién cumple esta condición».",
        ],
        "source": "../proyecto/sql/01_datos_demo.sql",
        "sourceLabel": "Ver datos de demo",
    },
    {
        "id": "usuarios",
        "num": "06",
        "phase": "fundamentos",
        "title": "Usuarios, roles y mínimo privilegio",
        "short": "Usuarios y privilegios",
        "summary": "Crear un usuario no es darle la contraseña de root. Roles, GRANT, REVOKE y el principio de mínimo privilegio aplicado al personal de laboratorio, recepción y auditoría.",
        "takeaways": [
            "Un rol agrupa privilegios y se asigna a varios usuarios; no se repiten GRANT uno por uno.",
            "El mínimo privilegio reduce el daño de un error y de una cuenta comprometida.",
            "Los privilegios de tabla y de columna permiten exponer solo lo necesario.",
        ],
        "source": "../proyecto/sql/03_unidad3_seguridad_monitoreo_auditoria.sql",
        "sourceLabel": "Ver 03_seguridad.sql",
    },
    {
        "id": "select-esencial",
        "num": "07",
        "phase": "taller",
        "title": "SELECT: pedir solo lo que necesitas",
        "short": "SELECT esencial",
        "summary": "Proyección, alias, DISTINCT y LIMIT. La diferencia entre explorar con SELECT * y diseñar una consulta que devuelva exactamente lo que el mostrador necesita.",
        "takeaways": [
            "SELECT * sirve para explorar; en una consulta real pide solo las columnas que vas a usar.",
            "Un alias no cambia el dato: cambia el nombre que verá quien lea el resultado.",
            "DISTINCT elimina filas repetidas después de proyectar; no es un sustituto de GROUP BY.",
        ],
        "source": "../proyecto/sql/00_esquema.sql",
        "sourceLabel": "Ver el esquema del caso",
    },
    {
        "id": "filtros-y-orden",
        "num": "08",
        "phase": "taller",
        "title": "WHERE, ORDER BY y paginación",
        "short": "Filtros y orden",
        "summary": "Operadores, NULL, LIKE, BETWEEN e IN; después, el orden de ejecución que explica por qué un alias no funciona en WHERE y por qué paginar sin ORDER BY es una lotería.",
        "takeaways": [
            "WHERE filtra filas antes de proyectar y ordenar; por eso no puede usar alias del SELECT.",
            "NULL no se compara con = ni con <>: usa IS NULL o IS NOT NULL.",
            "LIMIT sin ORDER BY no garantiza qué filas devuelve el motor.",
        ],
        "source": "../proyecto/sql/01_datos_demo.sql",
        "sourceLabel": "Ver datos de demo",
    },
    {
        "id": "agregacion",
        "num": "09",
        "phase": "taller",
        "title": "Agregar para responder",
        "short": "Agregación y grupos",
        "summary": "COUNT, SUM, AVG, MIN y MAX; GROUP BY, HAVING y agregación condicional para convertir miles de movimientos en indicadores de inventario.",
        "takeaways": [
            "Toda columna del SELECT que no esté agregada debe aparecer en GROUP BY.",
            "WHERE filtra filas antes de agrupar; HAVING filtra grupos ya calculados.",
            "La agregación condicional (SUM(CASE WHEN ...)) responde varias preguntas en una sola pasada.",
        ],
        "source": "../proyecto/sql/01_datos_demo.sql",
        "sourceLabel": "Ver datos de demo",
    },
    {
        "id": "subconsultas-ctes",
        "num": "10",
        "phase": "taller",
        "title": "Subconsultas y CTEs",
        "short": "Subconsultas y CTEs",
        "summary": "Comparar contra un conjunto, comprobar existencia y partir una consulta compleja en pasos con WITH. Incluye CTE recursiva para calendarios y jerarquías.",
        "takeaways": [
            "Una subconsulta escalar devuelve una fila y una columna; si devuelve más, la consulta falla.",
            "EXISTS suele ser más claro que IN cuando solo importa si hay coincidencia.",
            "Una CTE no es una tabla temporal: vive durante la consulta y mejora la legibilidad.",
        ],
        "source": "../proyecto/sql/00_esquema.sql",
        "sourceLabel": "Ver el esquema del caso",
    },
    {
        "id": "ventanas",
        "num": "11",
        "phase": "taller",
        "title": "Funciones de ventana",
        "short": "Funciones de ventana",
        "summary": "Rankings, acumulados y comparaciones fila a fila sin colapsar el resultado. ROW_NUMBER, RANK, LAG, LEAD y frames aplicados a inventario y trazabilidad.",
        "takeaways": [
            "Una función de ventana conserva todas las filas; GROUP BY las reduce a una por grupo.",
            "PARTITION BY define el grupo y ORDER BY define el orden interno del cálculo.",
            "ROW_NUMBER sirve para elegir una fila por grupo; RANK deja huecos cuando hay empates.",
        ],
        "source": "../proyecto/sql/01_datos_demo.sql",
        "sourceLabel": "Ver datos de demo",
    },
    {
        "id": "vistas-y-transacciones",
        "num": "12",
        "phase": "taller",
        "title": "Vistas y transacciones",
        "short": "Vistas y transacciones",
        "summary": "Guardar una consulta como tabla virtual y agrupar cambios en una unidad atómica. ACID, COMMIT, ROLLBACK y SAVEPOINT con un despacho real.",
        "takeaways": [
            "Una vista guarda una consulta, no datos: siempre lee el estado actual de las tablas.",
            "Una transacción confirma todo o no confirma nada; el COMMIT es la frontera de durabilidad.",
            "SAVEPOINT permite deshacer una parte sin perder los cambios anteriores.",
        ],
        "source": "../proyecto/sql/00_esquema.sql",
        "sourceLabel": "Ver el esquema del caso",
    },
    {
        "id": "rutinas-y-triggers",
        "num": "13",
        "phase": "taller",
        "title": "Procedimientos, triggers y eventos",
        "short": "Rutinas y triggers",
        "summary": "Automatizar reglas dentro del servidor: CALL, parámetros IN/OUT, validación BEFORE INSERT, auditoría AFTER UPDATE y eventos programados.",
        "takeaways": [
            "Un procedimiento encapsula pasos y recibe parámetros; una función devuelve un valor y se usa en consultas.",
            "BEFORE valida y corrige; AFTER audita o propaga cambios ya confirmados.",
            "Un trigger no debe hacer trabajo pesado ni actualizar la misma tabla que lo disparó.",
        ],
        "source": "../proyecto/sql/03_unidad3_seguridad_monitoreo_auditoria.sql",
        "sourceLabel": "Ver triggers del proyecto",
    },
    {
        "id": "modelar-banco-sangre",
        "num": "14",
        "phase": "espacio",
        "title": "Modelar el banco de sangre",
        "short": "Modelar el caso",
        "summary": "Del enunciado a doce tablas: donante, donación, unidad, prueba, solicitud, despacho y movimiento. Cada relación responde a una pregunta que el personal hace todos los días.",
        "takeaways": [
            "Una donación produce varios componentes con vencimientos distintos: donación y unidad no son la misma tabla.",
            "La trazabilidad exige registrar el movimiento, no solo el estado actual.",
            "Separar datos clínicos, datos personales y datos logísticos permite aplicar permisos distintos.",
        ],
        "source": "../proyecto/sql/00_esquema.sql",
        "sourceLabel": "Ver el esquema completo",
    },
    {
        "id": "estimar-espacio",
        "num": "15",
        "phase": "espacio",
        "title": "Estimar el espacio a un año",
        "short": "Estimar espacio",
        "summary": "La fórmula que evita quedarse sin disco: bytes por fila, filas esperadas, índices y margen de crecimiento. Después, la verdad del servidor con information_schema.",
        "takeaways": [
            "Nunca dimensiones al límite: deja 20–30 % de margen para el crecimiento real.",
            "Los índices ocupan espacio: suma entre 10 % y 30 % adicional.",
            "information_schema.TABLES da el tamaño real de datos e índices; úsalo para verificar la estimación.",
        ],
        "source": "../proyecto/sql/02_unidad2_espacio_particiones_eventos.sql",
        "sourceLabel": "Ver 02_espacio.sql",
    },
    {
        "id": "indices",
        "num": "16",
        "phase": "espacio",
        "title": "Índices: el atajo del optimizador",
        "short": "Índices",
        "summary": "Un índice no hace magia: cambia el orden en que se leen las filas. Qué columnas indexar, en qué orden y cómo leer un EXPLAIN sin adivinar.",
        "takeaways": [
            "Un índice compuesto sirve si la consulta usa un prefijo de sus columnas, en orden.",
            "Demasiados índices hacen más lento el INSERT y el UPDATE: cada escritura los actualiza.",
            "EXPLAIN muestra si hay table scan, qué índice se usa y si aparece filesort.",
        ],
        "source": "../proyecto/sql/05_unidad5_afinacion.sql",
        "sourceLabel": "Ver 05_afinacion.sql",
    },
    {
        "id": "particiones",
        "num": "17",
        "phase": "espacio",
        "title": "Fragmentar y particionar",
        "short": "Particiones",
        "summary": "RANGE, LIST y HASH en MySQL. La regla que más puntos cuesta: la columna de partición va en la PRIMARY KEY y la tabla particionada no puede tener FOREIGN KEY.",
        "takeaways": [
            "Particionar divide filas; sharding decide en qué servidor vive cada fragmento.",
            "RANGE para fechas, LIST para categorías cerradas, HASH para reparto uniforme.",
            "La ventaja aparece cuando el WHERE filtra por la columna de partición.",
        ],
        "source": "../proyecto/sql/02_unidad2_espacio_particiones_eventos.sql",
        "sourceLabel": "Ver particiones del proyecto",
    },
    {
        "id": "eventos",
        "num": "18",
        "phase": "espacio",
        "title": "Automatizar con Event Scheduler",
        "short": "Event Scheduler",
        "summary": "Tareas que no deberían depender de que alguien se acuerde: marcar vencimientos, guardar Uptime, purgar auditoría. Beneficio y riesgo de automatizar.",
        "takeaways": [
            "event_scheduler debe estar ON; sin eso el evento existe pero nunca corre.",
            "Un evento puede ejecutar UPDATE, INSERT o DELETE, pero debe ser idempotente.",
            "Automatizar sin monitorear convierte un DELETE silencioso en un incidente.",
        ],
        "source": "../proyecto/sql/02_unidad2_espacio_particiones_eventos.sql",
        "sourceLabel": "Ver eventos del proyecto",
    },
    {
        "id": "alta-disponibilidad",
        "num": "19",
        "phase": "operacion",
        "title": "Nueves, RTO y RPO",
        "short": "Alta disponibilidad",
        "summary": "99.9 % no suena distinto de 99.99 % hasta que se traduce a horas de caída. Disponibilidad, redundancia y los dos objetivos que definen la arquitectura: RTO y RPO.",
        "takeaways": [
            "La disponibilidad se mide: (total − caída) / total × 100. Un año son 525,600 minutos.",
            "RTO es cuánto tiempo toleras estar caído; RPO cuántos datos toleras perder.",
            "La redundancia elimina SPOF, pero cuesta dinero y complejidad: se decide según criticidad.",
        ],
        "source": "../proyecto/sql/02_unidad2_espacio_particiones_eventos.sql",
        "sourceLabel": "Ver el proyecto",
    },
    {
        "id": "clustering-failover",
        "num": "20",
        "phase": "operacion",
        "title": "Clustering, quorum y failover",
        "short": "Clustering y failover",
        "summary": "Varios servidores que se comportan como uno. Activo-pasivo frente a activo-activo, cómo se elige al nuevo primario, por qué el quorum es impar y qué pasa con una transacción sin COMMIT.",
        "takeaways": [
            "Sin quorum (más de la mitad de nodos) el clúster deja de aceptar escrituras para evitar split-brain.",
            "En MySQL InnoDB Cluster gana la elección el server_uuid más bajo entre los elegibles.",
            "Una transacción sin COMMIT no se replica: la aplicación debe reintentarla desde cero.",
        ],
        "source": "../proyecto/README.md",
        "sourceLabel": "Ver la documentación",
    },
    {
        "id": "monitoreo-auditoria",
        "num": "21",
        "phase": "operacion",
        "title": "Monitoreo, seguridad y auditoría",
        "short": "Monitoreo y auditoría",
        "summary": "Lo que no se mide no se administra: Uptime, conexiones, consultas lentas, espacio y eventos. Auditoría con triggers para saber quién cambió una unidad y cuándo.",
        "takeaways": [
            "performance_schema y information_schema son la fuente de verdad del estado del servidor.",
            "Un trigger de auditoría guarda el antes y el después; no basta con el estado actual.",
            "Monitorear tendencias es mejor que mirar un valor aislado: un disco al 60 % que crece es urgente.",
        ],
        "source": "../proyecto/sql/03_unidad3_seguridad_monitoreo_auditoria.sql",
        "sourceLabel": "Ver 03_monitoreo.sql",
    },
    {
        "id": "respaldos",
        "num": "22",
        "phase": "operacion",
        "title": "Respaldo y recuperación",
        "short": "Respaldos",
        "summary": "Un respaldo que nunca se ha restaurado no es un respaldo. Completo, incremental y binlog; RTO/RPO; simulación de pérdida y restauración paso a paso.",
        "takeaways": [
            "--single-transaction permite respaldar InnoDB sin bloquear la operación.",
            "El binlog permite recuperar hasta el minuto anterior al incidente (point-in-time recovery).",
            "La prueba de restauración es parte del respaldo: mide el RTO real.",
        ],
        "source": "../proyecto/sql/04_unidad4_respaldo_recuperacion.sql",
        "sourceLabel": "Ver 04_respaldo.sql",
    },
    {
        "id": "afinacion",
        "num": "23",
        "phase": "operacion",
        "title": "Afinar: parámetros, EXPLAIN y medición",
        "short": "Afinación",
        "summary": "Antes de reescribir consultas, revisa memoria. Después mide: EXPLAIN, EXPLAIN ANALYZE y tiempos antes/después. Un índice se justifica con evidencia, no con intuición.",
        "takeaways": [
            "innodb_buffer_pool_size suele ser la mejora más grande y más barata.",
            "Un índice compuesto debe seguir el orden igualdad → rango → orden de la consulta.",
            "Mide antes y después; sin línea base no puedes demostrar que mejoró.",
        ],
        "source": "../proyecto/sql/05_unidad5_afinacion.sql",
        "sourceLabel": "Ver 05_afinacion.sql",
    },
    {
        "id": "proyecto-banco-sangre",
        "num": "24",
        "phase": "proyecto",
        "title": "El proyecto: banco de sangre",
        "short": "Proyecto completo",
        "summary": "El caso completo, unidad por unidad: esquema, estimación, particiones, eventos, roles, auditoría, respaldo, afinación y la demo de 15 a 20 minutos.",
        "takeaways": [
            "El entregable es un sistema ejecutable, no una presentación: scripts + evidencia + demo.",
            "Cada unidad del curso deja un artefacto verificable en el proyecto.",
            "La demo cuenta una historia: donante → unidad → prueba → solicitud → despacho → respaldo.",
        ],
        "source": "../proyecto/README.md",
        "sourceLabel": "Abrir README del proyecto",
    },
]

APPENDICES = [
    {
        "id": "guia",
        "num": "A1",
        "phase": "proyecto",
        "kind": "appendix",
        "title": "Guía de uso y ejecución",
        "short": "Guía de uso",
        "summary": "Cómo navegar el cuaderno, buscar, copiar código y ejecutar los scripts del proyecto en el orden correcto.",
        "takeaways": [
            "Busca con Ctrl K o /; abre resultados con Enter.",
            "Cada bloque SQL tiene su botón Copiar.",
            "El proyecto se ejecuta en orden: 00, 01, 02, 03, 04, 05.",
        ],
        "source": "../proyecto/README.md",
        "sourceLabel": "Ver README del proyecto",
    },
    {
        "id": "chuleta",
        "num": "A2",
        "phase": "proyecto",
        "kind": "appendix",
        "title": "Chuleta SQL y errores comunes",
        "short": "Chuleta y errores",
        "summary": "Las fórmulas, comandos y reglas que más se olvidan, más los errores que cuestan puntos en el examen y en producción.",
        "takeaways": [
            "Partición: columna en la PK y sin FOREIGN KEY.",
            "Disponibilidad: (525600 − minutos caídos) / 525600 × 100.",
            "Quorum: nodos disponibles > total / 2.",
        ],
        "source": "../proyecto/sql/",
        "sourceLabel": "Ver scripts",
    },
    {
        "id": "ejercicios",
        "num": "A3",
        "phase": "proyecto",
        "kind": "appendix",
        "title": "Ejercicios y retos",
        "short": "Ejercicios y retos",
        "summary": "Treinta preguntas sobre el Banco de Sangre, de un WHERE sencillo a un ranking con ventanas y una transacción de despacho. Cada una con pista, solución y salida.",
        "takeaways": [
            "Practica primero sin mirar la solución; compara el resultado, no solo la sintaxis.",
            "Si una consulta no responde la pregunta, divídela con una CTE.",
            "Las soluciones usan el esquema y los datos de 00_esquema.sql y 01_datos_demo.sql.",
        ],
        "source": "../proyecto/sql/",
        "sourceLabel": "Ver scripts",
    },
    {
        "id": "datos-del-caso",
        "num": "A4",
        "phase": "proyecto",
        "kind": "appendix",
        "title": "Datos del caso: registros completos",
        "short": "Datos del caso",
        "summary": "Todas las filas de la base de demostración, tabla por tabla, para comprobar a mano los resultados de las consultas.",
        "takeaways": [
            "Ocho donantes, catorce unidades y seis solicitudes explican la mayoría de los ejemplos.",
            "NULL aparece donde falta el dato; no es cero ni cadena vacía.",
            "Consulta cada tabla con SELECT * y compara filas y columnas con el capítulo.",
        ],
        "source": "../proyecto/sql/01_datos_demo.sql",
        "sourceLabel": "Ver datos de demostración",
    },
]

ALL = CHAPTERS + APPENDICES


def strip_html(html: str) -> str:
    text = re.sub(r"<script.*?</script>", " ", html, flags=re.S | re.I)
    text = re.sub(r"<style.*?</style>", " ", text, flags=re.S | re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def build() -> None:
    chapters = []
    for item in ALL:
        path = CONTENT / f"{item['id']}.html"
        if not path.exists():
            raise SystemExit(f"Falta el fragmento: {path}")
        html = path.read_text(encoding="utf-8").strip()
        words = len(strip_html(html).split())
        reading = max(3, round(words / 180))
        entry = dict(item)
        entry["html"] = html
        entry["reading"] = reading
        entry["words"] = words
        chapters.append(entry)

    payload = {
        "meta": {
            **META,
            "generatedLabel": date.today().strftime("%d/%m/%Y"),
            "chapterCount": len(CHAPTERS),
            "appendixCount": len(APPENDICES),
            "total": len(chapters),
        },
        "phases": PHASES,
        "chapters": chapters,
    }

    OUT.write_text(
        "/* Generado por build/build.py. No editar a mano. */\n"
        "window.SITE = "
        + json.dumps(payload, ensure_ascii=False, indent=2)
        + ";\n",
        encoding="utf-8",
    )
    print(f"content.js generado · {len(chapters)} páginas · {OUT}")


if __name__ == "__main__":
    build()
