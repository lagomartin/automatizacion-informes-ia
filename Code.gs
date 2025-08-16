// =========================================================================================
// == CONFIGURACIÓN DE PROPIEDADES DEL SCRIPT (SECRETS) ==
// =========================================================================================
// ESTE SCRIPT ESTÁ DISEÑADO PARA SER COMPARTIDO PÚBLICAMENTE EN GITHUB.
// LOS DATOS SENSIBLES (IDs de carpetas y proyectos) NO ESTÁN ESCRITOS AQUÍ.
// PARA QUE EL SCRIPT FUNCIONE, DEBEN CONFIGURARSE LAS SIGUIENTES PROPIEDADES
// EN EL EDITOR DE APPS SCRIPT: Archivo > Propiedades del proyecto > Propiedades del script
//
// REQUERIDAS:
// - ID_CARPETA_TRANSCRIPCIONES
// - ID_CARPETA_INFORMES
// - ID_CARPETA_PROCESADOS
// - GCP_PROJECT_ID
// - GCP_PROJECT_NUMBER
// - GCP_REGION
// =========================================================================================

// Obtener la configuración desde las Propiedades del Script de forma segura
const scriptProperties = PropertiesService.getScriptProperties();
const ID_CARPETA_TRANSCRIPCIONES = scriptProperties.getProperty('ID_CARPETA_TRANSCRIPCIONES');
const ID_CARPETA_INFORMES = scriptProperties.getProperty('ID_CARPETA_INFORMES');
const ID_CARPETA_PROCESADOS = scriptProperties.getProperty('ID_CARPETA_PROCESADOS');
const GCP_PROJECT_ID = scriptProperties.getProperty('GCP_PROJECT_ID');
const GCP_PROJECT_NUMBER = scriptProperties.getProperty('GCP_PROJECT_NUMBER');
const GCP_REGION = scriptProperties.getProperty('GCP_REGION');

// --- CONSTANTES PÚBLICAS ---
// El ID del modelo de IA no es sensible, ya que es un identificador público de Google.
const VERTEX_AI_MODEL_ID = "gemini-2.0-flash-001";

// --- FUNCIONES PRINCIPALES (esqueleto) ---

function disparadorPrincipal() {
  Logger.log("Iniciando procesamiento de transcripciones...");
  procesarTranscripcionesNuevas();
  Logger.log("Procesamiento de transcripciones finalizado.");
}

function procesarTranscripcionesNuevas() {
  Logger.log("PASO P1: Iniciando procesarTranscripcionesNuevas...");
  try {
    // Se valida que las propiedades del script se hayan cargado correctamente
    if (!ID_CARPETA_TRANSCRIPCIONES || !ID_CARPETA_PROCESADOS || !ID_CARPETA_INFORMES) {
        throw new Error("Una o más IDs de carpetas no están configuradas en las Propiedades del Script.");
    }
    const carpetaTranscripciones = DriveApp.getFolderById(ID_CARPETA_TRANSCRIPCIONES);
    let carpetaProcesados;
    try {
        carpetaProcesados = DriveApp.getFolderById(ID_CARPETA_PROCESADOS);
        Logger.log(`PASO P1.1: Carpeta 'Procesados' encontrada con ID: ${ID_CARPETA_PROCESADOS}`);
    } catch (e) {
         Logger.log("ERROR CRITICO: La constante ID_CARPETA_PROCESADOS no apunta a una carpeta válida y la creación dinámica no está habilitada por defecto. Verifica el ID.");
         console.error("ERROR CRITICO: La constante ID_CARPETA_PROCESADOS no apunta a una carpeta válida.");
         return;
    }


    Logger.log(`PASO P2: Buscando archivos en carpeta de transcripciones: ${carpetaTranscripciones.getName()} (ID: ${ID_CARPETA_TRANSCRIPCIONES})`);
    const archivos = carpetaTranscripciones.getFilesByType(MimeType.GOOGLE_DOCS);

    if (!archivos.hasNext()) {
      Logger.log("PASO P3: No se encontraron archivos de Google Docs en la carpeta de transcripciones.");
      Logger.log("PASO P_FINAL: Procesamiento de transcripciones finalizado (sin archivos).");
      return;
    } else {
      Logger.log("PASO P3: Se encontraron archivos. Iniciando bucle...");
    }

    while (archivos.hasNext()) {
      const archivo = archivos.next();
      let idArchivo;
      let nombreArchivo;

      try {
        if (archivo && typeof archivo.getId === 'function' && typeof archivo.getName === 'function') {
          idArchivo = archivo.getId();
          nombreArchivo = archivo.getName();
          Logger.log(`PASO P4: Procesando archivo: "${nombreArchivo}" (ID: "${idArchivo}") --- Tipo de idArchivo: ${typeof idArchivo}`);
        } else {
          Logger.log(`ERROR en P4: El objeto 'archivo' no es válido o no tiene los métodos getId/getName. Objeto: ${JSON.stringify(archivo)}. Saltando este item.`);
          console.error(`ERROR en P4: El objeto 'archivo' no es válido. Objeto: ${JSON.stringify(archivo)}.`);
          continue;
        }

        if (!idArchivo || idArchivo === "undefined" || String(idArchivo).trim() === "") {
          Logger.log(`ERROR en P4.1: idArchivo es nulo, vacío o la cadena "undefined" para el archivo (nombre podría ser nulo también). Saltando.`);
          console.error(`ERROR en P4.1: idArchivo inválido para el archivo (nombre podría ser nulo también).`);
          continue;
        }

      } catch(e) {
          Logger.log(`ERROR CRITICO en P4 al intentar obtener id/nombre del archivo: ${e.toString()}. Objeto archivo: ${JSON.stringify(archivo)}. Saltando este item.`);
          console.error(`ERROR CRITICO en P4 al intentar obtener id/nombre del archivo: ${e.toString()}.`);
          continue;
      }


      Logger.log(`PASO P5: Llamando a leerContenidoTranscripcion para ID: "${idArchivo}"`);
      const textoTranscripcion = leerContenidoTranscripcion(idArchivo);
      if (!textoTranscripcion) {
        Logger.log(`PASO P6: No se pudo leer contenido o está vacío para "${nombreArchivo}". Saltando.`);
        continue;
      }
      Logger.log(`PASO P6: Contenido leído para "${nombreArchivo}" (primeros 50 chars): ` + textoTranscripcion.substring(0,50));


      Logger.log(`PASO P7: Llamando a analizarConVertexAI para "${nombreArchivo}"...`);
      const datosAnalisis = analizarConVertexAI(textoTranscripcion);

      if (!datosAnalisis) {
        Logger.log(`PASO P8: Fallo el análisis con Vertex AI para "${nombreArchivo}". Saltando.`);
        continue;
      }
      Logger.log(`PASO P8: Análisis de Vertex AI recibido para "${nombreArchivo}".`);


      Logger.log(`PASO P9: Llamando a crearDocumentoInforme para "${nombreArchivo}"...`);
      crearDocumentoInforme(datosAnalisis, nombreArchivo, ID_CARPETA_INFORMES);


      Logger.log(`PASO P10: Llamando a marcarComoProcesado para "${nombreArchivo}"...`);
      marcarComoProcesado(archivo, carpetaProcesados);
      Logger.log(`PASO P11: Archivo "${nombreArchivo}" procesado y movido.`);
    }
  } catch (error) {
    const errorMessage = `ERROR GENERAL en procesarTranscripcionesNuevas: ${error.toString()}\nStack: ${error.stack}`;
    Logger.log(errorMessage);
    console.error(errorMessage);
    try {
      MailApp.sendEmail(Session.getActiveUser().getEmail(), "Error CRÍTICO en Script ERAMET", errorMessage);
    } catch (mailError) {
      Logger.log(`Error al intentar enviar correo de notificación de error general: ${mailError.toString()}`);
    }
  }
  Logger.log("PASO P_FINAL: Procesamiento de transcripciones finalizado.");
}

function leerContenidoTranscripcion(idArchivo) {
  try {
    const doc = DocumentApp.openById(idArchivo);
    const cuerpo = doc.getBody();
    const texto = cuerpo.getText();
    if (texto.trim() === "") {
      Logger.log(`El documento ${idArchivo} está vacío.`);
      return null;
    }
    return texto;
  } catch (e) {
    Logger.log(`Error al leer el documento ${idArchivo}: ${e.toString()}`);
    return null;
  }
}

function analizarConVertexAI(textoTranscripcion) {
  Logger.log("PASO 1: Iniciando analizarConVertexAI..."); 
  let accessToken;
  try {
    accessToken = ScriptApp.getOAuthToken();
    if (!accessToken) {
      Logger.log("ERROR CRÍTICO: No se pudo obtener el Access Token de OAuth.");
      console.error("ERROR CRÍTICO: No se pudo obtener el Access Token de OAuth.");
      return null;
    }
    Logger.log("PASO 2: Access Token obtenido (primeros 20 chars): " + accessToken.substring(0, 20) + "...");
  } catch (e) {
    Logger.log("ERROR CRÍTICO al obtener Access Token: " + e.toString());
    console.error("ERROR CRÍTICO al obtener Access Token: " + e.toString());
    return null;
  }

  const endpoint = `https://${GCP_REGION}-aiplatform.googleapis.com/v1/projects/${GCP_PROJECT_ID}/locations/${GCP_REGION}/publishers/google/models/${VERTEX_AI_MODEL_ID}:generateContent`;
  Logger.log("PASO 3: Endpoint Vertex AI construido: " + endpoint);


  const promptCompleto = `Eres un asistente experto en analizar transcripciones de reuniones de Google Meet para extraer información clave y estructurarla para un informe de seguimiento detallado y bien formateado.
Por favor, analiza la siguiente transcripción de una reunión:

<INICIO_TRANSCRIPCION>
${textoTranscripcion}
<FIN_TRANSCRIPCION>

Tu tarea es extraer la siguiente información y presentarla bajo los siguientes encabezados exactos. Para cada sección, si no encuentras información relevante en la transcripción, indica explícitamente "No se mencionó información relevante para esta sección." o "No aplica.". Atribuye tareas, objetivos y observaciones a personas específicas siempre que sea posible, basándote en la identificación del hablante en la transcripción.

**Formato General Deseado para el Contenido de las Secciones:**
* Utiliza frases completas y un lenguaje claro.
* Para listas de objetivos, tareas, pendientes y observaciones, utiliza viñetas (iniciando cada ítem con "- ").
* Para "Objetivos Específicos Individuales" y "Acciones Planeadas para la Semana", primero indica el nombre de la persona seguido de dos puntos (ej. "Nombre Apellido:") y luego, en líneas subsiguientes con viñetas, lista sus objetivos/acciones.
* Para "Tareas Asignadas", después de la descripción de la tarea con viñeta, indica claramente "(Responsable: [Nombre/s], Plazo: [Fecha/Plazo si se mencionó, o "No especificado"])"

**Secciones Requeridas para el Informe:**

**Resumen de la Reunión**
(Proporciona un resumen conciso de los temas principales discutidos, las decisiones clave tomadas y las conclusiones generales de la reunión.)

**Estado del Proyecto**
(Realiza un análisis general del estado actual del proyecto según lo discutido en la reunión. Identifica la instancia o etapa en la que se encuentra, como planificación, ejecución, revisión, ajuste, etc. Remarca las menciones clave o discusiones que justifiquen este análisis. Por ejemplo, si se menciona "necesitamos aumentar el control", esto podría indicar una fase de observación o ajuste.)

**Objetivos Generales Planteados**
(Identifica y lista los objetivos generales o propósitos principales que se establecieron o reiteraron para el grupo o el proyecto durante la reunión.)

**Objetivos Específicos Individuales**
(Identifica y lista los objetivos específicos que se plantearon o se asignaron a participantes individuales. Sigue el formato: "Nombre Apellido:", y luego en líneas nuevas con viñetas "- [objetivo específico]".)

**Tareas Asignadas (Plan General)**
(Lista todas las tareas que fueron asignadas durante la reunión con un horizonte temporal más amplio que la semana actual, o sin plazo inmediato definido. Sigue el formato: "- [Descripción de la Tarea] (Responsable: [Nombre/s], Plazo: [Fecha/Plazo o "No especificado"])")

**Acciones Planeadas para la Semana (Seguimiento Inmediato)**
(Identifica y resume las actividades o tareas específicas que los participantes se comprometieron a desarrollar durante la próxima semana y que probablemente serán tema de revisión en la siguiente reunión. Sigue el formato: "Nombre Apellido:", y luego en líneas nuevas con viñetas "- [acción para la semana]".)

**Pendientes (Temas o Tareas No Resueltas)**
(Identifica cualquier tema importante, decisión crucial o tarea que quedó pendiente de resolución, para discusión futura o que requiere seguimiento más allá de las acciones semanales. Usa viñetas.)

**Observaciones Relevantes**
(Extrae cualquier observación, comentario importante, riesgo identificado, lección aprendida o sugerencia significativa hecha durante la reunión que no encaje en las categorías anteriores. Intenta asociar la observación con la persona que la hizo. Usa viñetas.)

**Solicitud de Fondos**
(Identifica si se realizó alguna solicitud de fondos o se discutió la necesidad de presupuesto para alguna actividad, recurso o personal. Describe la solicitud, el propósito y, si es posible, los montos o estimaciones mencionadas. Usa viñetas.)

Por favor, asegúrate de que cada sección esté claramente delimitada únicamente por su título exacto como se muestra arriba (sin numeración). La calidad, precisión y el seguimiento del formato solicitado son cruciales.
`;
  Logger.log("PASO 4: Prompt construido (primeros 100 chars del prompt completo): " + promptCompleto.substring(0, 100) + "...");
  Logger.log("PASO 4.1: Longitud total del texto de transcripción: " + textoTranscripcion.length);
  Logger.log("PASO 4.2: Longitud total del prompt completo: " + promptCompleto.length);


  const payload = {
    "contents": [
      {
        "role": "USER",
        "parts": [
          {
            "text": promptCompleto
          }
        ]
      }
    ],
    "generationConfig": {
      "temperature": 0.3,
      "topK": 40,
      "topP": 0.95,
      "maxOutputTokens": 8192,
    }
  };

  let stringifiedPayload;
  try {
    stringifiedPayload = JSON.stringify(payload);
    Logger.log("PASO 5: Payload stringificado (primeros 100 chars): " + stringifiedPayload.substring(0, 100) + "...");
  } catch (e) {
    const errorStringify = "ERROR CRÍTICO al stringificar el payload: " + e.toString();
    Logger.log(errorStringify);
    console.error(errorStringify);
    return null;
  }

  const options = {
    'method': 'post',
    'contentType': 'application/json',
    'headers': {
      'Authorization': 'Bearer ' + accessToken
    },
    'payload': stringifiedPayload,
    'muteHttpExceptions': true
  };

  Logger.log("PASO 6: Opciones para UrlFetchApp preparadas. Realizando la llamada HTTP...");

  let httpResponse;
  let responseCode;
  let responseText;

  try {
    httpResponse = UrlFetchApp.fetch(endpoint, options);
    responseCode = httpResponse.getResponseCode();
    responseText = httpResponse.getContentText();

    Logger.log(`PASO 7: Llamada a Vertex AI completada. Código de respuesta HTTP: ${responseCode}`);

    if (responseCode === 200) {
      Logger.log("PASO 8: Respuesta OK de Vertex AI (primeros 500 chars del responseText): " + responseText.substring(0, 500));
      const jsonResponse = JSON.parse(responseText);

      if (jsonResponse.candidates && jsonResponse.candidates.length > 0 &&
          jsonResponse.candidates[0].content && jsonResponse.candidates[0].content.parts &&
          jsonResponse.candidates[0].content.parts.length > 0 &&
          jsonResponse.candidates[0].content.parts[0].text) {
        Logger.log("PASO 9: Texto extraído exitosamente de la respuesta JSON de Vertex AI.");
        const textoRespuestaLLM = jsonResponse.candidates[0].content.parts[0].text;
        Logger.log("RESPUESTA CRUDA COMPLETA DEL LLM (analizarConVertexAI): \n" + textoRespuestaLLM); 
        return jsonResponse.candidates[0].content.parts[0].text;
      } else {
        const detailedError = `ERROR PARSEO JSON: Respuesta JSON de Vertex AI (código 200) no tiene la estructura esperada. Respuesta completa: ${responseText}`;
        Logger.log(detailedError);
        console.error(detailedError);
        return null;
      }
    } else {
      const detailedHttpError = `ERROR HTTP EN LLAMADA A VERTEX AI. Código: ${responseCode}. Respuesta: ${responseText}`;
      Logger.log(detailedHttpError);
      console.error(detailedHttpError);
      return null;
    }
  } catch (e) {
    const exceptionCaught = `EXCEPCIÓN DURANTE la llamada a Vertex AI o procesando su respuesta: ${e.toString()} \nStack: ${e.stack} \nResponse Code (si disponible): ${responseCode} \nResponse Text (si disponible): ${responseText}`;
    Logger.log(exceptionCaught);
    console.error(exceptionCaught);
    return null;
  }
}

function crearDocumentoInforme(datosAnalisis, nombreArchivoOriginal, idCarpetaDestino) {
  Logger.log("PASO C1: Iniciando crearDocumentoInforme...");

  if (!idCarpetaDestino) {
    Logger.log("ERROR CRÍTICO en crearDocumentoInforme: idCarpetaDestino está vacío o no definido.");
    console.error("ERROR CRÍTICO en crearDocumentoInforme: idCarpetaDestino está vacío o no definido.");
    return;
  }

  try {
    const carpetaDestino = DriveApp.getFolderById(idCarpetaDestino);
    Logger.log(`PASO C3: Carpeta de destino obtenida: ${carpetaDestino.getName()} (ID: ${idCarpetaDestino})`);

    const nombreInforme = `Informe - ${nombreArchivoOriginal.replace(/\.gdoc$/i, '')} - ${new Date().toLocaleDateString('es-AR')}`;
    Logger.log(`PASO C4: Nombre del informe a crear: ${nombreInforme}`);

    const nuevoDoc = DocumentApp.create(nombreInforme);
    const idNuevoDoc = nuevoDoc.getId();
    const urlNuevoDoc = nuevoDoc.getUrl();
    Logger.log(`PASO C5: Nuevo documento creado con Nombre: "${nombreInforme}", ID: ${idNuevoDoc}, URL: ${urlNuevoDoc}`);

    if (!idNuevoDoc) {
      Logger.log("ERROR CRÍTICO: DocumentApp.create() devolvió un ID nulo o inválido.");
      console.error("ERROR CRÍTICO: DocumentApp.create() devolvió un ID nulo o inválido.");
      return;
    }

    const cuerpo = nuevoDoc.getBody();
    cuerpo.clear();

    const estiloTituloPrincipal = {};
    estiloTituloPrincipal[DocumentApp.Attribute.FONT_FAMILY] = DocumentApp.FontFamily.CALIBRI;
    estiloTituloPrincipal[DocumentApp.Attribute.FONT_SIZE] = 14;
    estiloTituloPrincipal[DocumentApp.Attribute.BOLD] = true;
    estiloTituloPrincipal[DocumentApp.Attribute.HORIZONTAL_ALIGNMENT] = DocumentApp.HorizontalAlignment.CENTER;

    const estiloFecha = {};
    estiloFecha[DocumentApp.Attribute.FONT_FAMILY] = DocumentApp.FontFamily.CALIBRI;
    estiloFecha[DocumentApp.Attribute.FONT_SIZE] = 10;
    estiloFecha[DocumentApp.Attribute.ITALIC] = true;
    estiloFecha[DocumentApp.Attribute.HORIZONTAL_ALIGNMENT] = DocumentApp.HorizontalAlignment.CENTER;

    const estiloBaseCuerpo = {};
    estiloBaseCuerpo[DocumentApp.Attribute.FONT_FAMILY] = DocumentApp.FontFamily.CALIBRI;
    estiloBaseCuerpo[DocumentApp.Attribute.FONT_SIZE] = 11;
    estiloBaseCuerpo[DocumentApp.Attribute.LINE_SPACING] = 1.15;
    cuerpo.setAttributes(estiloBaseCuerpo);


    cuerpo.appendParagraph(nombreInforme).setAttributes(estiloTituloPrincipal);
    const parrafoFecha = cuerpo.appendParagraph(`Fecha de Generación: ${new Date().toLocaleString('es-AR')}`);
    parrafoFecha.setAttributes(estiloFecha);
    parrafoFecha.setSpacingAfter(18);
    Logger.log("PASO C6: Cabecera del informe añadida y formateada.");

    const secciones = [
      "Resumen de la Reunión", "Estado del Proyecto", "Objetivos Generales Planteados",
      "Objetivos Específicos Individuales", "Tareas Asignadas (Plan General)",
      "Acciones Planeadas para la Semana (Seguimiento Inmediato)",
      "Pendientes (Temas o Tareas No Resueltas)", "Observaciones Relevantes", "Solicitud de Fondos"
    ];

    let textoCompletoRespuestaLLM = datosAnalisis || "";
    Logger.log("PASO C6.1: Texto completo de la respuesta del LLM (longitud): " + textoCompletoRespuestaLLM.length);
    
    const estiloTituloSeccionDef = {};
    estiloTituloSeccionDef[DocumentApp.Attribute.FONT_FAMILY] = DocumentApp.FontFamily.CALIBRI;
    estiloTituloSeccionDef[DocumentApp.Attribute.FONT_SIZE] = 12;
    estiloTituloSeccionDef[DocumentApp.Attribute.BOLD] = true;
    estiloTituloSeccionDef[DocumentApp.Attribute.SPACING_BEFORE] = 12;
    estiloTituloSeccionDef[DocumentApp.Attribute.SPACING_AFTER] = 6;

    let currentSearchIndex = 0;

    for (let i = 0; i < secciones.length; i++) {
      const tituloSeccionParaDoc = secciones[i];
      const parrafoTituloSeccion = cuerpo.appendParagraph(tituloSeccionParaDoc);
      parrafoTituloSeccion.setAttributes(estiloTituloSeccionDef);

      let contenidoExtraidoParaEstaSeccion = "No se mencionó información relevante para esta sección.";
      const tituloEnLLMRegex = new RegExp(
        `(?:\\*\\*)?${tituloSeccionParaDoc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\*\\*)?`, "i"
      );
      const matchTituloActual = tituloEnLLMRegex.exec(textoCompletoRespuestaLLM.substring(currentSearchIndex));
      if (matchTituloActual) {
        const inicioRealMatchTitulo = currentSearchIndex + matchTituloActual.index;
        let inicioContenidoReal = inicioRealMatchTitulo + matchTituloActual[0].length;
        while (inicioContenidoReal < textoCompletoRespuestaLLM.length && /[\s\r\n]/.test(textoCompletoRespuestaLLM[inicioContenidoReal])) {
          inicioContenidoReal++;
        }
        let finContenidoReal = textoCompletoRespuestaLLM.length;
        if (i + 1 < secciones.length) {
          const proximoTituloParaBuscar = secciones[i+1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regexProximoTitulo = new RegExp(`(?:\\*\\*)?${proximoTituloParaBuscar}(?:\\*\\*)?`, "i");
          const matchProximoTitulo = regexProximoTitulo.exec(textoCompletoRespuestaLLM.substring(inicioContenidoReal));
          if (matchProximoTitulo) {
            finContenidoReal = inicioContenidoReal + matchProximoTitulo.index;
          }
        }
        let textoDeSeccion = textoCompletoRespuestaLLM.substring(inicioContenidoReal, finContenidoReal).trim();
        if (textoDeSeccion && textoDeSeccion.toLowerCase() !== "no se mencionó información relevante para esta sección.") {
          contenidoExtraidoParaEstaSeccion = textoDeSeccion;
        }
        currentSearchIndex = finContenidoReal;
        Logger.log(`ÉXITO PARCIAL O TOTAL al parsear para: "${tituloSeccionParaDoc}"`);
      } else {
        Logger.log(`ADVERTENCIA C7.1: No se encontró el delimitador de título para la sección: "${tituloSeccionParaDoc}" ... Se usará el mensaje por defecto.`);
      }
      Logger.log(`Contenido para "${tituloSeccionParaDoc}": ${contenidoExtraidoParaEstaSeccion.substring(0,100)}...`);


      const lineasDelContenido = contenidoExtraidoParaEstaSeccion.split('\n');
      let seAñadioAlgoReal = false;

      if (contenidoExtraidoParaEstaSeccion === "No se mencionó información relevante para esta sección.") {
        cuerpo.appendParagraph(contenidoExtraidoParaEstaSeccion);
        seAñadioAlgoReal = true;
      } else {
        lineasDelContenido.forEach(linea => {
          const lineaTrimmed = linea.trim();
          if (lineaTrimmed !== "") {
            const parrafoItem = cuerpo.appendParagraph(lineaTrimmed);
            seAñadioAlgoReal = true;

            if (lineaTrimmed.startsWith('- ') || lineaTrimmed.startsWith('* ')) {
              parrafoItem.setIndentFirstLine(18).setIndentStart(36);
            } else if (lineaTrimmed.match(/^[\w\sÁÉÍÓÚÑáéíóúñ]+:/) &&
                       (tituloSeccionParaDoc === "Objetivos Específicos Individuales" ||
                        tituloSeccionParaDoc === "Acciones Planeadas para la Semana (Seguimiento Inmediato)" ||
                        tituloSeccionParaDoc === "Observaciones Relevantes")) {
              
              const dosPuntosIndex = lineaTrimmed.indexOf(':');
              if (dosPuntosIndex > 0) {
                try {
                  const textoAntesDosPuntos = lineaTrimmed.substring(0, dosPuntosIndex + 1);
                  const textoDespuesDosPuntos = lineaTrimmed.substring(dosPuntosIndex + 1);
                  
                  parrafoItem.setText(""); 
                  
                  const textoAntes = parrafoItem.appendText(textoAntesDosPuntos);
                  textoAntes.setBold(true);

                  if (textoDespuesDosPuntos.trim() !== "") {
                    const textoDespues = parrafoItem.appendText(textoDespuesDosPuntos);
                    textoDespues.setBold(false);
                  }
                } catch (e_format_detalle) {
                  Logger.log(`ADVERTENCIA en crearDocumentoInforme: Falló el formateo detallado para la línea: "${lineaTrimmed}"`);
                  Logger.log(`  Detalle del error: ${e_format_detalle.toString()}`);
                  try {
                    parrafoItem.setText(lineaTrimmed);
                    parrafoItem.setBold(false); 
                    parrafoItem.setItalic(false);
                  } catch (e_revert) {
                    Logger.log(`  ADVERTENCIA ADICIONAL: Falló el intento de revertir al texto original para la línea "${lineaTrimmed}". Error: ${e_revert.toString()}`);
                  }
                }
              }
            }
          }
        });
        if (!seAñadioAlgoReal && contenidoExtraidoParaEstaSeccion.trim() !== "" && contenidoExtraidoParaEstaSeccion !== "No se mencionó información relevante para esta sección.") {
            cuerpo.appendParagraph(contenidoExtraidoParaEstaSeccion.trim());
        } else if (!seAñadioAlgoReal && contenidoExtraidoParaEstaSeccion.trim() === "") {
            cuerpo.appendParagraph("No se mencionó información relevante para esta sección.");
        }
      }
      cuerpo.appendParagraph(""); 
    }
    Logger.log("PASO C7: Todas las secciones procesadas y añadidas al documento.");

    const archivoTemporal = DriveApp.getFileById(idNuevoDoc);
    Logger.log(`PASO C8: Objeto archivo temporal obtenido para mover (ID: ${archivoTemporal.getId()})`);
    carpetaDestino.addFile(archivoTemporal);
    Logger.log(`PASO C9: Archivo temporal añadido a la carpeta destino.`);
    const parents = archivoTemporal.getParents();
    let estaEnRaiz = false;
    let carpetaDestinoEncontradaEntrePadres = false;
    const padresArray = [];
    while(parents.hasNext()){
        let p = parents.next();
        if (!padresArray.find(existingParentId => existingParentId === p.getId())) {
            padresArray.push(p.getId());
        }
    }
    const cantidadDePadres = padresArray.length;
    padresArray.forEach(parentId => {
        if(parentId === DriveApp.getRootFolder().getId()) estaEnRaiz = true;
        if(parentId === carpetaDestino.getId()) carpetaDestinoEncontradaEntrePadres = true;
    });
    if(estaEnRaiz && carpetaDestinoEncontradaEntrePadres && cantidadDePadres > 1){
        DriveApp.getRootFolder().removeFile(archivoTemporal);
        Logger.log(`PASO C10: Archivo temporal removido de la carpeta raíz...`);
    } else if (estaEnRaiz && !carpetaDestinoEncontradaEntrePadres) {
         Logger.log(`ADVERTENCIA PASO C10: El archivo está en la raíz pero no se confirmó en la carpeta destino...`);
    } else {
         Logger.log(`PASO C10: El archivo no estaba (o ya no está) duplicado en la raíz y destino...`);
    }
    Logger.log(`PASO C11: Informe "${nombreInforme}" (ID: ${idNuevoDoc}) procesado y guardado en la carpeta de destino.`);

  } catch (e) {
    const errorMessage = `Error en crearDocumentoInforme para "${nombreArchivoOriginal}": ${e.toString()}\nStack: ${e.stack}`;
    Logger.log(errorMessage);
    console.error(errorMessage);
  }
  Logger.log("PASO C12: Finalizando crearDocumentoInforme.");
}

function marcarComoProcesado(archivo, carpetaDestinoProcesados) {
  try {
    archivo.moveTo(carpetaDestinoProcesados);
    Logger.log(`Archivo "${archivo.getName()}" movido a la carpeta de procesados.`);
  } catch (e) {
    Logger.log(`Error al mover el archivo ${archivo.getName()} a procesados: ${e.toString()}`);
  }
}

// --- FUNCIÓN PARA CONFIGURAR EL ACTIVADOR (TRIGGER) ---
function configurarActivador() {
  // Eliminar activadores anteriores para evitar duplicados
  const activadoresActuales = ScriptApp.getProjectTriggers();
  for (let i = 0; i < activadoresActuales.length; i++) {
    if (activadoresActuales[i].getHandlerFunction() === "disparadorPrincipal") {
      ScriptApp.deleteTrigger(activadoresActuales[i]);
      Logger.log("Activador existente eliminado.");
    }
  }

  // Crear un nuevo activador cada 3 horas
  ScriptApp.newTrigger("disparadorPrincipal")
    .timeBased()
    .everyHours(3)
    .create();
  Logger.log("Activador configurado para ejecutarse cada 3 horas.");
}
