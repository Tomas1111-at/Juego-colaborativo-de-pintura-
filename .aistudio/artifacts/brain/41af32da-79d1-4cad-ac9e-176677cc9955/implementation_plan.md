# Corrección de Transcripción de Voz Resiliente en Pincelada Colab

Este plan resuelve el error `404 NOT_FOUND` al invocar `models/gemini-3.5-transcribe` en la API `v1`, incorporando enrutamiento explícito hacia `v1beta` y un mecanismo de respaldo automático transparente hacia `gemini-3.8-flash` para transcripción multimodal de audio sin interrupciones, manteniendo la revisión y edición del texto transcrito antes de aplicarlo al lienzo colaborativo.

## Revisión del Usuario y Decisiones Confirmadas

> [!IMPORTANT]
> Se han incorporado las preferencias seleccionadas para asegurar que el dictado por voz nunca falle durante una partida multijugador en vivo.

- **Decisión Confirmada 1 — Respaldo Automático Multimodal (`v1beta` + `gemini-3.8-flash`)**: El servidor intentará transcribir con `gemini-3.5-transcribe` sobre `apiVersion: 'v1beta'` y, ante cualquier error `404` o de disponibilidad del modelo en la región/versión, conmutará de forma inmediata y transparente a `gemini-3.8-flash` procesando el mismo bloque de audio en base64.
- **Decisión Confirmada 2 — Edición Previa Antes de Aplicar**: Una vez completada la transcripción, el texto se presentará en un área editable dentro del modal de voz para que el jugador pueda corregirlo o ajustarlo antes de elegir si desea **Establecer Tema**, **Pintar Capa IA** o **Enviar al Chat de la Sala**.

---

## 1. Descripción General y Concepto Principal

- **Qué Hace**: Restaura y blinda el flujo de entrada por micrófono dentro del juego de pintura colaborativa en tiempo real, permitiendo a los jugadores hablar para definir retos temáticos, generar capas asistidas por IA o enviar mensajes al equipo sin errores de modelo no encontrado.
- **Audiencia y Contexto**: Jugadores en dispositivos móviles (WebAPK / PWA táctil a 60 FPS) y escritorio que colaboran simultáneamente sobre múltiples capas y prefieren dictar ideas rápidamente con la voz en lugar de escribir en un teclado móvil.
- **Valor Principal**: Eliminación total de fallos `404 NOT_FOUND` en el servicio de voz mediante recuperación automática en el servidor y retroalimentación clara en la interfaz.

---

## 2. Experiencia de Usuario y Diseño Visual

- **Flujo de Usuario Paso a Paso**:
  1. El artista pulsa el botón de micrófono en la barra inferior de herramientas táctiles (`min-h-[44px] min-w-[44px]`).
  2. En el modal de Dictado por Voz, toca el botón central para grabar su voz y vuelve a tocar para detener la grabación.
  3. El cliente envía el audio codificado al servidor; si el modelo primario no está disponible en el endpoint actual, el servidor resuelve la transcripción automáticamente con `gemini-3.8-flash`.
  4. El texto transcrito aparece en un campo editable de alto contraste donde el jugador puede pulir cualquier palabra antes de pulsar **Establecer Tema**, **Pintar Capa IA** o **Enviar al Chat**.
- **Identidad Visual y Tema**:
  - *Dirección Estética*: Estudio de arte digital oscuro de baja oclusión (más del 85% del lienzo libre de obstrucciones), optimizado para sesiones creativas multijugador.
  - *Paleta de Colores (Regla 60-30-10)*:
    - **60% Lienzo y Superficie Dominante**: Pizarra profunda (`#0f172a` / `slate-950`) que realza el contraste de los trazos de pintura.
    - **30% Superficies Estructurales**: Paneles flotantes en `slate-900/90` con bordes sutiles de 1px (`border-slate-800`).
    - **10% Acento Focal**: Índigo vibrante (`#6366f1`) para herramientas activas y ámbar/rosa (`#f43f5e`) para el estado de grabación de voz.
  - *Tipografía y Jerarquía*: Tipografía geométrica limpia (`Plus Jakarta Sans` / `DM Sans`) para controles de una sola línea (`whitespace-nowrap`) y numerales tabulares (`tabular-nums`) para el cronómetro de ronda, porcentajes de opacidad de capas y puntuaciones.
  - *Disciplina de Superficies y Metadatos*: Sin píldoras decorativas estáticas ni puntos parpadeantes innecesarios; los indicadores de estado utilizan etiquetas claras de texto junto con iconografía funcional.
- **Retroalimentación Interactiva y Movimiento**:
  - Transiciones suaves limitadas a propiedades del compositor (`transform`, `opacity`) en menos de `200ms`.
  - Confirmación sonora procedural con Web Audio API al iniciar grabación, completar transcripción y aplicar cambios a las capas.

---

## 3. Decisiones Clave de Producto y Compensaciones

- **Decisión 1: Cadena de Respaldo en el Servidor para Transcripción de Audio**
  - *Enfoque Elegido*: Configurar el cliente `@google/genai` con soporte para `v1beta` en llamadas de transcripción y envolver la llamada a `gemini-3.5-transcribe` en un bloque `try/catch` que delega automáticamente a `gemini-3.8-flash` cuando ocurre un error `404` o `NOT_FOUND`.
  - *Por Qué*: `gemini-3.8-flash` tiene soporte nativo multimodal para entradas de audio (`audio/webm`, `audio/mp4`, `audio/wav`) en todas las versiones de la API, garantizando un 100% de disponibilidad sin degradar la calidad de transcripción en español.
  - *Alternativas Consideradas*: Usar `Web Speech API` del navegador; se descartó como motor principal porque carece de soporte uniforme en WebViews de Android y Safari iOS en modo standalone.
- **Decisión 2: Normalización de Formato MIME de Grabación Móvil**
  - *Enfoque Elegido*: Detectar dinámicamente el tipo MIME soportado por `MediaRecorder` en el dispositivo (`audio/webm;codecs=opus`, `audio/webm` o `audio/mp4` en iOS) y transmitir el tipo MIME limpio al servidor.
  - *Por Qué*: Evita fallos de decodificación cuando los usuarios graban audio desde diferentes navegadores móviles o desde el APK instalado.

---

## 4. Arquitectura Técnica y Estrategia de Datos

### Diagrama de Arquitectura y Componentes

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     CLIENTE JUEGO (React 19 + Canvas)                   │
│                                                                         │
│  ┌───────────────────┐   ┌────────────────────┐   ┌──────────────────┐  │
│  │   DrawingCanvas   │   │     LayerPanel     │   │ VoicePromptModal │  │
│  │ (60fps Multi-Capa)│   │ (Crear/Fusión/Opac)│   │ (Grabación/Edic.)│  │
│  └─────────┬─────────┘   └─────────┬──────────┘   └────────┬─────────┘  │
└────────────┼───────────────────────┼───────────────────────┼────────────┘
             │ WebSocket (Tiempo Real)                       │ HTTP POST
             ▼                                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    SERVIDOR FULL-STACK (Express + WS)                   │
│                                                                         │
│  ┌─────────────────────────────────┐  ┌──────────────────────────────┐  │
│  │   Sincronizador de Salas y      │  │  Servicio de Voz Resiliente  │  │
│  │   Estado Autoritativo de Capas  │  │  1º gemini-3.5-transcribe    │  │
│  │   (Crear, Eliminar, Fusionar)   │  │     (apiVersion: v1beta)     │  │
│  └─────────────────────────────────┘  │  2º Respaldo Automático:     │  │
│                                       │     gemini-3.8-flash         │  │
│                                       └──────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

### Mapeo de Componentes Interactivos y Estado

- **Grabadora y Modal de Voz (`VoicePromptModal`)**:
  - Valida permisos de micrófono y selecciona el contenedor de audio compatible con el dispositivo.
  - Muestra cronómetro de grabación con `tabular-nums`, indicador de procesamiento y campo `<textarea>` editable al recibir la transcripción.
  - Conecta los tres botones de acción (**Establecer Tema**, **Pintar Capa IA**, **Enviar al Chat**) directamente con el estado de la sala WebSocket y el generador de trazos IA.
- **Endpoint de Transcripción (`/api/gemini/transcribe`)**:
  - Limpia el encabezado `data:audio/...;base64,` y normaliza el `mimeType` base (por ejemplo, `audio/webm` o `audio/mp4`).
  - Ejecuta el intento primario en `v1beta` con `gemini-3.5-transcribe` y, si recibe `404 NOT_FOUND`, ejecuta instantáneamente `gemini-3.8-flash` devolviendo `{ transcription, modelUsed }` al cliente con código HTTP `200`.
