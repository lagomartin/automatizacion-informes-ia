# Sistema de Automatización de Informes de Reunión con IA

Este repositorio contiene el código de un sistema de automatización que transforma las transcripciones de reuniones de Google Meet en informes de seguimiento estructurados y accionables.

Desarrollado para la Fundación Gran Chaco, el sistema utiliza Google Apps Script y se integra con la plataforma de Google Cloud (Vertex AI) para aprovechar el poder del modelo de IA Gemini.

---

## 🚀 Características Principales

* **Procesamiento Automático:** Un disparador se ejecuta periódicamente para buscar y procesar nuevas transcripciones sin intervención manual.
* **Análisis con IA:** Utiliza el modelo Gemini de Google a través de Vertex AI para analizar el texto y extraer información clave.
* **Generación de Informes:** Crea automáticamente documentos de Google Docs con un formato profesional, incluyendo resúmenes, tareas asignadas, objetivos y más.
* **Organización de Archivos:** Mueve los archivos procesados a una carpeta de archivo para mantener el sistema limpio y ordenado.

---

## ⚙️ Tecnologías Utilizadas

* **Orquestación y Automatización:** Google Apps Script
* **Inteligencia Artificial:** Google Cloud Platform (Vertex AI) con el modelo Gemini
* **Entorno de Trabajo:** Google Workspace (Drive, Docs, Meet)
* **Habilidad Clave:** Ingeniería de Prompts (Prompt Engineering)

---

## 🛠️ Configuración

Este script está diseñado para ser seguro y no contiene claves ni IDs directamente en el código. Para que funcione, es necesario configurar las siguientes variables en las **Propiedades del Script** del proyecto de Google Apps Script (`Archivo > Propiedades del proyecto > Propiedades del script`):

* `ID_CARPETA_TRANSCRIPCIONES`: El ID de la carpeta de Google Drive donde se encuentran las transcripciones.
* `ID_CARPETA_INFORMES`: El ID de la carpeta donde se guardarán los informes generados.
* `ID_CARPETA_PROCESADOS`: El ID de la carpeta a donde se moverán las transcripciones ya procesadas.
* `GCP_PROJECT_ID`: El ID de tu proyecto de Google Cloud.
* `GCP_PROJECT_NUMBER`: El número de tu proyecto de Google Cloud.
* `GCP_REGION`: La región de GCP donde está habilitado Vertex AI (ej. `us-central1`).

---

## ▶️ Uso

1.  Configurar las variables en las **Propiedades del Script** como se describe arriba.
2.  Ejecutar la función `configurarActivador()` una vez manualmente desde el editor de Apps Script para crear el disparador que ejecutará el proceso automáticamente cada 3 horas.
