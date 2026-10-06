# CENTRALIZADOR
## Documento maestro de arquitectura, fases y alcance

> **Propósito de este documento:** servir como especificación funcional y conceptual del proyecto **Centralizador**. Este archivo debe ser suficiente para que otra IA, desarrollador o colaborador pueda comprender la arquitectura general, la filosofía modular, el objetivo de cada fase y las decisiones principales del sistema.

---

# 1. Visión general

**Centralizador** será una plataforma web modular para centralizar procesos de ingeniería, documentación, validaciones, análisis y control operativo.

El sistema estará compuesto por diferentes **módulos funcionales**. Cada módulo tendrá su propio conjunto de fases y podrá avanzar de forma independiente.

La arquitectura debe ser reutilizable: una funcionalidad desarrollada para un módulo debe poder convertirse en un componente o servicio reutilizable para otros módulos cuando sea aplicable.

### Principio fundamental

> **Las fases pertenecen a cada módulo, no al proyecto completo.**

Ejemplo:

```
CENTRALIZADOR
│
├── DOCUMENTOS
│   ├── Fase 1
│   ├── Fase 2
│   ├── Fase 3
│   └── ...
│
├── NEW MODELS
│   ├── Fase 1
│   ├── Fase 2
│   └── ...
│
├── LOSS TIME
│   ├── Fase 1
│   ├── Fase 2
│   └── ...
│
└── EFICIENCIA
    ├── Fase 1
    ├── Fase 2
    └── ...
```

Cada módulo puede encontrarse en una fase diferente. No es necesario terminar un módulo completo para comenzar otro.

---

# 2. Filosofía de desarrollo

El proyecto debe desarrollarse de forma incremental.

Cada fase debe responder:

1. ¿Qué capacidad nueva estamos agregando?
2. ¿Qué componentes necesitamos?
3. ¿Qué componentes son reutilizables?
4. ¿Qué problemas quedan pendientes?
5. ¿Qué condiciones deben cumplirse para avanzar a la siguiente fase?

No se debe considerar una fase terminada simplemente porque "ya existe código".

Una fase se considera terminada cuando cumple sus **criterios de salida (Gate)**.

---

# 3. Arquitectura conceptual

```
CENTRALIZADOR
│
├── INFRAESTRUCTURA TRANSVERSAL
│
├── MÓDULOS FUNCIONALES
│   ├── DOCUMENTOS
│   ├── NEW MODELS
│   ├── LOSS TIME
│   ├── EFICIENCIA
│   └── futuros módulos
│
└── SERVICIOS REUTILIZABLES
    ├── usuarios
    ├── roles
    ├── permisos
    ├── workflows
    ├── historial
    ├── notificaciones
    ├── documentos
    └── otros servicios comunes
```

---

# 4. Infraestructura transversal

La infraestructura transversal contiene funcionalidades que no deben reconstruirse para cada módulo:

- Layout general.
- Sidebar.
- Navegación.
- Usuarios.
- Roles.
- Permisos.
- Autenticación.
- Base de datos.
- Sistema de estados.
- Historial.
- Notificaciones.
- Componentes visuales reutilizables.
- Motor de workflow.
- Gestión de archivos.
- Exportación.
- Auditoría.

Estas funcionalidades deben diseñarse pensando desde el inicio en su reutilización.

---

# 5. Motor de Workflow

El Centralizador debe contar con un **motor de workflow reutilizable**.

El objetivo es evitar programar directamente dentro de cada módulo una secuencia fija como:

```
Ingeniero → Revisor → QM → Supervisor → Liberación
```

En lugar de eso, el sistema debe permitir definir workflows mediante configuración.

## Editor visual de workflow

El administrador debe poder visualizar y modificar el flujo mediante un chart.

Debe poder eventualmente:

- Crear etapas.
- Eliminar etapas.
- Mover etapas.
- Conectar etapas.
- Cambiar responsables.
- Cambiar reglas.
- Agregar condiciones.
- Redireccionar conexiones.
- Modificar el orden del flujo.

También se podrán soportar decisiones condicionales:

```
Ingeniero
    ↓
¿Requiere QM?
   /       \
 Sí         No
 ↓           ↓
QM       Supervisor
 \         /
  \       /
   ↓     ↓
  Supervisor
      ↓
  Liberación
```

El workflow no debe estar codificado de forma rígida en cada módulo.

---

# 6. Módulo DOCUMENTOS

El módulo Documentos será un sistema de gestión, creación, revisión, aprobación, liberación y control de versiones de documentación de ingeniería.

Los documentos actualmente existentes en Excel se utilizarán como referencia de los estándares visuales y estructurales, pero el trabajo documental se realizará principalmente dentro de una interfaz web.

No se pretende simplemente abrir un Excel dentro del navegador.

Se construirá un **editor documental web propio**, adaptado a los formatos estándar de ingeniería.

---

# 7. DOCUMENTOS - Fase 1: Estructuración

## Objetivo

Construir la estructura visual y funcional del módulo Documentos.

Esta fase debe crear la estructura donde posteriormente se incorporará el editor documental, los workflows y el sistema de revisión.

## Componentes esperados

- Página principal de Documentos.
- Sidebar.
- Navegación.
- Listado de documentos.
- Página para crear documento.
- Página para visualizar documento.
- Página para revisar documento.
- Página de historial/revisiones.
- Estructura preparada para datos reales.
- Componentes visuales reutilizables.

## Estructura conceptual

```
DOCUMENTOS
│
├── Listado
├── Crear
├── Visualizar
├── Revisar
├── Aprobados
├── Liberados
└── Historial
```

## Gate de Fase 1

La fase puede considerarse terminada cuando:

- La estructura visual del módulo está definida.
- La navegación funciona.
- El listado de documentos existe.
- Existe una vista de documento.
- Existe una estructura para crear/editar.
- Existe una vista para revisión.
- Existe una vista de historial.
- Los componentes principales pueden reutilizarse.
- La arquitectura está preparada para incorporar el editor documental.

---

# 8. DOCUMENTOS - Fase 2: Editor documental web

## Objetivo

Convertir el documento estándar de Excel en una experiencia de edición web.

El usuario debe trabajar principalmente en la web, no directamente sobre el Excel original.

## Principio de diseño

El editor será **híbrido**:

- La estructura documental principal será fija.
- El área de contenido será editable mediante un canvas controlado.

No se busca crear un clon completo de Excel.

Tampoco se busca crear un editor completamente libre tipo Photoshop.

El objetivo es tener un editor específicamente diseñado para documentación de ingeniería.

---

# 9. Estructura del documento

Un documento SOP típico tendrá una estructura similar a:

```
┌─────────────────────────────────────────────────────────┐
│                    HEADER FIJO                           │
│ Logo │ Código │ Título                  Fecha / Rev.    │
├─────────────────────────────────────────┬───────────────┤
│                                         │               │
│                                         │ Descripción   │
│              CANVAS                     │ de operación  │
│          CONTROLADO                     │               │
│                                         │               │
│   [Imagen]                              │               │
│      ↓                                  │               │
│   [Texto] ───────→ [Figura]            │               │
│                                         │               │
│   [Instrucción]                         │               │
│                                         │               │
├─────────────────────────────────────────┴───────────────┤
│ MODELO APLICABLE │ ENSAMBLES APLICABLES                  │
├─────────────────────────────────────────┬───────────────┤
│              FOOTER FIJO                │    FIRMAS      │
└─────────────────────────────────────────┴───────────────┘
```

La estructura exacta podrá variar dependiendo del tipo de documento.

Por lo tanto, el sistema debe soportar **templates documentales**.

---

# 10. Templates documentales

Ejemplos:

```
Templates
│
├── SOP
├── WI
├── Instructivo
├── Formato
├── Check Sheet
└── otros
```

Cada template puede definir:

- Header.
- Footer.
- Campos obligatorios.
- Áreas editables.
- Áreas protegidas.
- Posición de bloques.
- Tamaños.
- Información documental.
- Área de firmas.
- Área de descripción.
- Área de contenido.

El usuario debe poder editar el contenido permitido sin romper la estructura estándar.

---

# 11. Canvas controlado

Dentro del área editable se podrán utilizar:

- Texto.
- Imágenes.
- Fotografías.
- Flechas.
- Líneas.
- Rectángulos.
- Círculos.
- Indicadores.
- Tablas.
- Diagramas sencillos.
- Otros componentes que se incorporen posteriormente.

Los elementos podrán:

- Moverse.
- Redimensionarse.
- Editarse.
- Eliminarse.
- Duplicarse.

La libertad estará limitada al área de contenido definida por el template.

---

# 12. Firmas digitales

La firma inicial no necesita ser una firma criptográfica avanzada.

Debe permitir representar la aprobación mediante:

```
Nombre
Cargo
Fecha
```

Ejemplo:

```
Alfred Barradas
Process Engineer
06-Oct-2026
```

En una evolución posterior se podrán incorporar:

- Firma dibujada.
- Imagen de firma.
- Sello.
- Firma digital avanzada.
- Otros mecanismos de autenticación/aprobación.

La firma debe estar vinculada al usuario que realizó la acción.

---

# 13. DOCUMENTOS - Fase 3: Revisión y comentarios

## Objetivo

Permitir que un revisor pueda inspeccionar el documento y proporcionar retroalimentación.

El revisor podrá:

- Agregar comentarios.
- Seleccionar elementos.
- Solicitar cambios.
- Marcar problemas.
- Aprobar.
- Rechazar.

Los comentarios deben conservar:

- Usuario.
- Fecha.
- Elemento relacionado, cuando aplique.
- Texto del comentario.
- Estado del comentario.

---

# 14. DOCUMENTOS - Fase 4: Workflow de aprobación

El módulo Documentos utilizará el motor de workflow transversal.

Ejemplo:

```
Ingeniero
    ↓
Revisor
    ↓
QM
    ↓
Supervisor
    ↓
Liberación
```

El flujo no debe estar codificado de forma rígida.

Debe poder configurarse desde el editor de workflows.

---

# 15. DOCUMENTOS - Fase 5: Liberación

Una vez aprobado:

```
BORRADOR
    ↓
REVISIÓN
    ↓
APROBADO
    ↓
LIBERACIÓN
    ↓
VIGENTE
```

La liberación debe:

- Asignar o validar el nombre estándar.
- Asignar revisión.
- Registrar fecha.
- Registrar responsables.
- Registrar aprobaciones.
- Generar una versión congelada.
- Evitar modificaciones silenciosas posteriores.

---

# 16. PDF como versión congelada

El PDF será considerado el **snapshot oficial de una revisión liberada**.

```
EDITOR WEB
    │
    ▼
Documento editable
    │
    ▼
Aprobaciones
    │
    ▼
Liberación
    │
    ▼
PDF CONGELADO
```

El PDF liberado debe ser una representación limpia del documento aprobado e incluir:

- Estructura documental.
- Contenido.
- Fecha.
- Número de revisión.
- Firmas/sellos.
- Información requerida.
- Estado documental.

El PDF liberado no debe modificarse directamente.

---

# 17. PDF de revisión vs PDF liberado

## PDF de revisión

Puede mostrar:

- Cambios.
- Comentarios.
- Elementos resaltados.
- Marcas.
- Información de revisión.

## PDF liberado

Debe ser limpio y representar únicamente el documento aprobado.

```
REV 03
VIGENTE

[Documento limpio]
[Firmas]
[Sellos]
```

Los comentarios y marcas de revisión pertenecen al proceso de revisión, no necesariamente al documento final liberado.

---

# 18. DOCUMENTOS - Fase 6: Control de revisiones

Todas las versiones deben conservarse.

```
SOP-XXX1-VA

REV 00
OBSOLETO

REV 01
OBSOLETO

REV 02
OBSOLETO

REV 03
VIGENTE
```

Cada revisión debe conservar:

- Contenido.
- Autor.
- Fecha.
- Revisor.
- Aprobador.
- Comentarios.
- Cambios.
- Firmas.
- Estado.

---

# 19. Documento obsoleto

Cuando una nueva revisión se libera, la anterior pasa automáticamente a:

```
OBSOLETO
```

El sistema puede mostrar una marca de agua **OBSOLETO**.

La marca debe ser generada por el sistema y no depender de texto manual agregado por el usuario.

---

# 20. Comparación de revisiones

En una evolución del módulo se podrá comparar:

```
REV 02
   ↓
REV 03
```

El sistema puede mostrar:

- Elementos nuevos.
- Elementos modificados.
- Elementos eliminados.
- Comentarios relacionados.
- Usuario que realizó el cambio.
- Fecha del cambio.

---

# 21. DOCUMENTOS - Fase 7: Exportación

El sistema debe permitir exportar el documento a formatos útiles:

- PDF.
- Excel.
- Otros formatos que sean necesarios posteriormente.

El PDF será la representación congelada principal.

El Excel puede funcionar como formato de intercambio o exportación cuando sea necesario.

La edición principal debe realizarse dentro del sistema web.

---

# 22. Otros módulos

Cada módulo tendrá su propio roadmap.

## NEW MODELS

```
NEW MODELS
│
├── Fase 1 · Estructuración
├── Fase 2 · Flujo de NPI
├── Fase 3 · Validaciones
├── Fase 4 · Integraciones
├── Fase 5 · Aprobación
└── ...
```

## LOSS TIME

```
LOSS TIME
│
├── Fase 1 · Estructuración
├── Fase 2 · Captura
├── Fase 3 · Validación
├── Fase 4 · Clasificación
├── Fase 5 · Análisis
└── ...
```

## EFICIENCIA

```
EFICIENCIA
│
├── Fase 1 · Estructuración
├── Fase 2 · Fuentes de datos
├── Fase 3 · Cálculos
├── Fase 4 · Validación
├── Fase 5 · Visualización
└── ...
```

Estos nombres y fases son preliminares y deben definirse conforme se analice cada módulo.

---

# 23. Reutilización entre módulos

Una característica fundamental del proyecto es la reutilización.

Si una funcionalidad desarrollada para Documentos también sirve para New Models, no debe duplicarse.

Ejemplo:

```
DOCUMENTOS ─────┐
                │
NEW MODELS ─────┼──→ MOTOR DE WORKFLOW
                │
LOSS TIME ──────┘
```

Los componentes deben diseñarse como piezas reutilizables cuando sea razonable.

---

# 24. Estados de desarrollo

Cada fase debe poder identificarse con un estado:

```
🔴 No iniciado
🟡 En construcción
🟢 Completado
```

También se pueden utilizar:

```
⚠️ Bloqueado
⏸️ Pausado
```

El estado debe representar la situación real de la fase.

---

# 25. Control maestro de fases

Este documento debe utilizarse como referencia del estado general.

Ejemplo:

```
CENTRALIZADOR

Infraestructura
├── Fase 0 · Arquitectura base       🟡

Documentos
├── Fase 1 · Estructuración          🟡
├── Fase 2 · Editor                  🔴
├── Fase 3 · Revisión                🔴
├── Fase 4 · Workflow                🔴
├── Fase 5 · Liberación              🔴
├── Fase 6 · Revisiones              🔴
└── Fase 7 · Exportación             🔴

New Models
└── Fase 1                           🔴

Loss Time
└── Fase 1                           🔴

Eficiencia
└── Fase 1                           🔴
```

---

# 26. Regla de trabajo de este proyecto

Este documento representa el **hilo maestro de fases**.

Los problemas técnicos específicos, bugs, pruebas y soluciones pueden discutirse en conversaciones separadas.

Este hilo debe concentrarse en:

- Definir fases.
- Revisar objetivos.
- Revisar alcance.
- Definir criterios de salida.
- Registrar decisiones arquitectónicas.
- Determinar qué falta.
- Decidir cuándo avanzar de fase.
- Mantener actualizado el roadmap.

Los demás hilos pueden concentrarse en:

- Código.
- Bugs.
- Implementación.
- Pruebas.
- Investigación técnica.
- Soluciones específicas.

---

# 27. Regla fundamental de arquitectura

El proyecto debe evitar convertirse en una colección de módulos independientes y duplicados.

La arquitectura debe evolucionar hacia:

```
                    CENTRALIZADOR
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
   DOCUMENTOS        NEW MODELS       LOSS TIME
        │                │                │
        └────────────────┼────────────────┘
                         │
                         ▼
              SERVICIOS REUTILIZABLES
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
     Workflow          Usuarios       Historial
        │                │                │
        └────────────────┼────────────────┘
                         ▼
                    Base del sistema
```

El objetivo final es que agregar un nuevo módulo sea principalmente:

1. Definir su propósito.
2. Definir sus fases.
3. Definir sus datos.
4. Configurar su workflow.
5. Reutilizar los servicios existentes.
6. Construir únicamente la lógica específica del módulo.

---

# 28. Estado actual del proyecto

## Centralizador

**Infraestructura base:** 🟡 En construcción

## Documentos

**Fase actual:** Fase 1 · Estructuración

```
Fase 1 · Estructuración        🟡
Fase 2 · Editor documental     🔴
Fase 3 · Revisión              🔴
Fase 4 · Workflow              🔴
Fase 5 · Liberación            🔴
Fase 6 · Revisiones            🔴
Fase 7 · Exportación           🔴
```

## New Models

```
Fase 1 · Estructuración        🔴
```

## Loss Time

```
Fase 1 · Estructuración        🔴
```

## Eficiencia

```
Fase 1 · Estructuración        🔴
```

---

# 29. Próximo objetivo

El siguiente objetivo concreto es completar:

> **CENTRALIZADOR → DOCUMENTOS → FASE 1 · ESTRUCTURACIÓN**

Antes de comenzar el editor documental, debemos tener clara la estructura visual, navegación, templates iniciales y arquitectura base necesaria para soportar el módulo.

No se debe implementar todavía el workflow completo ni el editor avanzado hasta que la Fase 1 tenga sus criterios de salida definidos y cumplidos.
