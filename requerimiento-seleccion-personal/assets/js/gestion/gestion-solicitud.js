    const USUARIO = "Nicolas Crisanto";
    const ZONA_HORARIA = "America/Bogota";

    function obtenerFechaHoraLocal() {
      return new Intl.DateTimeFormat("es-CO", {
        timeZone: ZONA_HORARIA,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
      }).format(new Date());
    }

    function generarTraceId(numero) {
      const numeroFormateado = String(numero || "SIN").padStart(4, "0");
      return `SOL-${numeroFormateado}-${Date.now().toString(36).toUpperCase()}`;
    }

    function obtenerSolicitudes() {
      return JSON.parse(localStorage.getItem("solicitudes") || "[]");
    }

    function guardarSolicitudes(lista) {
      localStorage.setItem("solicitudes", JSON.stringify(lista));
    }

    function normalizarLista(lista) {
      let huboCambios = false;

      lista.forEach(sol => {
        if (sol.estado === "Ingresado para aprobar") {
          sol.estado = "Ingresado";
          huboCambios = true;
        }

        if (sol.estadoGeneral === "Ingresado para aprobar") {
          sol.estadoGeneral = "Ingresado";
          huboCambios = true;
        }

        if (!sol.traceId) {
          sol.traceId = generarTraceId(sol.numero);
          huboCambios = true;
        }

        if (!sol.ultimaActualizacion) {
          sol.ultimaActualizacion = sol.fechaSolicitud || obtenerFechaHoraLocal();
          huboCambios = true;
        }

        if (!Array.isArray(sol.auditTrail)) {
          sol.auditTrail = [];
          huboCambios = true;
        }

        if (!Array.isArray(sol.historialEtapas)) {
          sol.historialEtapas = [];
          huboCambios = true;
        }
      });

      if (huboCambios) {
        guardarSolicitudes(lista);
      }
    }

    function normalizarTexto(valor) {
      return String(valor || "").trim().toLowerCase();
    }

    function estadoNormalizadoCandidato(candidato) {
      return normalizarTexto(candidato?.estado);
    }

    function tieneEstadoCandidato(sol, estadosObjetivo) {
      const candidatos = Array.isArray(sol?.candidatos) ? sol.candidatos : [];
      const setEstados = new Set(estadosObjetivo.map(normalizarTexto));
      return candidatos.some(c => setEstados.has(estadoNormalizadoCandidato(c)));
    }

    function tienePeriodo(sol, estadoPeriodo) {
      const candidatos = Array.isArray(sol?.candidatos) ? sol.candidatos : [];
      const esperado = normalizarTexto(estadoPeriodo);
      return candidatos.some(c => normalizarTexto(c?.periodoEstado) === esperado);
    }

    function tieneAptitudMedicaRegistrada(sol) {
      const candidatos = Array.isArray(sol?.candidatos) ? sol.candidatos : [];
      return candidatos.some(c => {
        const apt = normalizarTexto(c?.aptitudMedica);
        return apt === "apto" || apt === "apto con observacion" || apt === "apto con observación" || apt === "no apto";
      });
    }

    function obtenerCandidatoReferenciaProceso(sol) {
      const candidatoTimeline = resolverCandidatoTimeline(sol);
      if (candidatoTimeline) return candidatoTimeline;
      const candidatos = Array.isArray(sol?.candidatos) ? sol.candidatos : [];
      return candidatos[0] || null;
    }

    function resultadoAptitudCandidato(candidato) {
      const aptitud = normalizarTexto(candidato?.aptitudMedica);
      if (aptitud === "apto") return "apto";
      if (aptitud === "apto con observacion" || aptitud === "apto con observación") return "apto_obs";
      if (aptitud === "no apto") return "no_apto";

      // Compatibilidad con datos antiguos donde solo se guardaba "ingreso / no ingreso".
      const ingreso = normalizarTexto(candidato?.ingreso);
      if (ingreso === "ingreso") return "apto";
      if (ingreso === "no ingreso") return "no_apto";

      return "";
    }

    function tieneTextoValidoProceso(valor) {
      const texto = normalizarTexto(valor);
      return !!texto && !texto.includes("no aplica");
    }

    function solicitudRequiereDotacionCompleta(sol) {
      const porBanderas =
        normalizarTexto(sol?.requiereDotacion) === "si" ||
        normalizarTexto(sol?.requiereEpp) === "si" ||
        normalizarTexto(sol?.requiereUniforme) === "si" ||
        normalizarTexto(sol?.requiereDotacionEpp) === "si" ||
        normalizarTexto(sol?.requiereEppsUniformes) === "si";
      if (porBanderas) return true;

      const detalle = Array.isArray(sol?.manualCargoDetalle?.ficha?.eppsUniformesDetalle)
        ? sol.manualCargoDetalle.ficha.eppsUniformesDetalle
        : [];
      if (detalle.length > 0) return true;
      if (tieneTextoValidoProceso(sol?.manualCargoDetalle?.ficha?.eppsUniformes)) return true;
      if (tieneTextoValidoProceso(sol?.eppsUniformes)) return true;
      return false;
    }

    function dotacionCompletaFinalizada(candidato) {
      const entregaCompleta = normalizarTexto(candidato?.entregaCompleta);
      return entregaCompleta === "entregado" || entregaCompleta === "no aplica" || candidato?.bloqueoCompleta === true;
    }

    function etiquetaAptitudProceso(resultadoAptitud) {
      if (resultadoAptitud === "apto_obs") return "Apto con observacion";
      return "Apto medico";
    }

    function tieneIngresoRegistrado(sol) {
      const candidatos = Array.isArray(sol?.candidatos) ? sol.candidatos : [];
      return candidatos.some(c => {
        const ingreso = normalizarTexto(c?.ingreso);
        return ingreso === "ingreso" || ingreso === "no ingreso";
      });
    }

    function tieneGestionEquiposAccesos(sol) {
      const candidatos = Array.isArray(sol?.candidatos) ? sol.candidatos : [];
      return candidatos.some(c => {
        const estadoEntrega = normalizarTexto(c?.estadoEntrega);
        return estadoEntrega === "pendiente" || estadoEntrega === "entregado" || estadoEntrega === "entrega incompleta";
      });
    }

    function tieneInduccionCompleta(sol) {
      const candidatos = Array.isArray(sol?.candidatos) ? sol.candidatos : [];
      return candidatos.some(c => {
        if (c?.induccionCompleta === true) return true;
        const induccion = c?.induccion;
        if (!induccion || typeof induccion !== "object") return false;

        const completo = modulo => {
          if (!modulo || typeof modulo !== "object") return false;
          if (modulo.completada === true) return true;
          return Array.isArray(modulo.items) && modulo.items.length > 0;
        };

        return completo(induccion.th) && completo(induccion.ssoma) && completo(induccion.puesto);
      });
    }

    function tieneInduccionEnProceso(sol) {
      const candidatos = Array.isArray(sol?.candidatos) ? sol.candidatos : [];
      return candidatos.some(c => {
        if (c?.induccionCompleta === true) return false;
        const induccion = c?.induccion;
        if (!induccion || typeof induccion !== "object") return false;

        const completo = modulo => {
          if (!modulo || typeof modulo !== "object") return false;
          if (modulo.completada === true) return true;
          return Array.isArray(modulo.items) && modulo.items.length > 0;
        };

        return completo(induccion.th) || completo(induccion.ssoma) || completo(induccion.puesto);
      });
    }

    function obtenerEstadoProcesoSolicitud(sol) {
      const estadoBase = normalizarTexto(sol?.estado);
      const estadoPre = normalizarTexto(sol?.estadoPreseleccion);
      const estadoSel = normalizarTexto(sol?.estadoSeleccionOficial);
      const estadoIngreso = normalizarTexto(sol?.estadoAprobacionIngreso);
      const etapaPre = normalizarTexto(sol?.etapaPreseleccion);
      const etapaSel = normalizarTexto(sol?.etapaSeleccionOficial);
      const etapaIngreso = normalizarTexto(sol?.etapaAprobacionIngreso);

      if (estadoBase === "anulado") return "Anulado";
      if (estadoBase === "rechazado") return "Rechazado";

      const candidatoProceso = obtenerCandidatoReferenciaProceso(sol);
      const resultadoAptitud = resultadoAptitudCandidato(candidatoProceso);

      if (resultadoAptitud === "no_apto") return "Cerrado - No apto medico";
      if (resultadoAptitud === "apto" || resultadoAptitud === "apto_obs") {
        const etiquetaAptitud = etiquetaAptitudProceso(resultadoAptitud);
        if (solicitudRequiereDotacionCompleta(sol)) {
          if (dotacionCompletaFinalizada(candidatoProceso)) {
            return `${etiquetaAptitud} - Dotacion completa finalizada`;
          }
          return `${etiquetaAptitud} - Pendiente dotacion completa`;
        }
        return `${etiquetaAptitud} - Proceso finalizado`;
      }

      // Compatibilidad de lectura para solicitudes antiguas.
      if (tieneAptitudMedicaRegistrada(sol)) return "Aptitud medica";
      if (tieneIngresoRegistrado(sol)) return "Ingreso de personal";
      if (tieneGestionEquiposAccesos(sol)) return "Gestion de equipos y accesos";
      if (tienePeriodo(sol, "EN PRUEBA")) return "En periodo de prueba";
      if (tienePeriodo(sol, "CERRADO")) return "Periodo de prueba finalizado";

      const aprobacionIngresoIniciada = etapaIngreso === "iniciada" || estadoIngreso.includes("en proceso");
      const aprobacionIngresoFinalizada = etapaIngreso === "finalizada" || estadoIngreso.includes("finalizada");
      if (aprobacionIngresoIniciada) return "En aprobacion de ingreso";
      if (aprobacionIngresoFinalizada || tieneEstadoCandidato(sol, ["aprobado_ingreso"])) return "Aprobacion de ingreso finalizada";
      if (tieneInduccionEnProceso(sol)) return "En induccion";
      if (tieneInduccionCompleta(sol)) return "Induccion completada";

      const seleccionIniciada = etapaSel === "iniciada" || estadoSel.includes("en proceso");
      const seleccionFinalizada =
        sol?.seleccionOficialFinalizada === true ||
        etapaSel === "finalizada" ||
        estadoSel.includes("finalizada");
      if (seleccionIniciada) return "En seleccion oficial";
      if (seleccionFinalizada || tieneEstadoCandidato(sol, ["seleccionado_oficial", "no_seleccionado"])) {
        return "Seleccion oficial finalizada";
      }

      const preseleccionIniciada = etapaPre === "iniciada" || estadoPre.includes("en proceso");
      const preseleccionFinalizada =
        sol?.preseleccionFinalizada === true ||
        etapaPre === "finalizada" ||
        estadoPre.includes("finalizada");
      if (preseleccionIniciada) return "En preseleccion";
      if (preseleccionFinalizada || tieneEstadoCandidato(sol, ["terna"])) return "Preseleccion finalizada";

      if (sol?.postulacionActiva === true && sol?.postulacionCerrada !== true) return "En postulacion";
      if (sol?.postulacionCerrada === true) return "Postulacion cerrada";

      if (estadoBase === "aprobado" || estadoBase === "solicitud aprobada") {
        return "Aprobada - pendiente de postulacion";
      }

      if (estadoBase === "ingresado" || estadoBase === "ingresado para aprobar") return "Ingresado";
      return sol?.estado || "Sin estado";
    }

    function colorEstado(estado) {
      const normal = normalizarTexto(estado);

      if (normal.includes("rechazado")) return "danger";
      if (normal.includes("anulado")) return "secondary";
      if (normal.includes("no apto medico")) return "danger";
      if (normal.includes("pendiente dotacion completa")) return "warning text-dark";
      if (normal.includes("dotacion completa finalizada") || normal.includes("proceso finalizado")) return "success";
      if (normal.includes("apto con observacion")) return "info text-dark";
      if (normal.includes("apto medico")) return "success";
      if (normal.includes("ingreso de personal")) return "success";
      if (normal.includes("aptitud medica")) return "info text-dark";
      if (normal.includes("periodo de prueba")) return "warning text-dark";
      if (normal.includes("equipos y accesos")) return "secondary";
      if (normal.includes("aprobacion de ingreso")) return "dark";
      if (normal.includes("induccion")) return normal.includes("completada") ? "success" : "warning text-dark";
      if (normal.includes("seleccion oficial")) return "secondary";
      if (normal.includes("preseleccion")) return "info text-dark";
      if (normal.includes("postulacion")) return normal.includes("cerrada") ? "dark" : "primary";
      if (normal.includes("aprobada")) return "success";
      if (normal.includes("ingresado")) return "warning text-dark";
      return "light text-dark";
    }

    const ORDEN_ESTADOS_PROCESO = [
      "Ingresado",
      "Aprobada - pendiente de postulacion",
      "En postulacion",
      "Postulacion cerrada",
      "En preseleccion",
      "Preseleccion finalizada",
      "En seleccion oficial",
      "Seleccion oficial finalizada",
      "En aprobacion de ingreso",
      "Aprobacion de ingreso finalizada",
      "En induccion",
      "Induccion completada",
      "En periodo de prueba",
      "Periodo de prueba finalizado",
      "Gestion de equipos y accesos",
      "Apto medico - Pendiente dotacion completa",
      "Apto con observacion - Pendiente dotacion completa",
      "Apto medico - Dotacion completa finalizada",
      "Apto con observacion - Dotacion completa finalizada",
      "Apto medico - Proceso finalizado",
      "Apto con observacion - Proceso finalizado",
      "Cerrado - No apto medico",
      "Aptitud medica",
      "Ingreso de personal",
      "Rechazado",
      "Anulado"
    ];

    function poblarFiltroEstados(lista, estadoSeleccionado) {
      const select = document.getElementById("selEstado");
      if (!select) return;

      const estadosSet = new Set();
      lista.forEach(sol => estadosSet.add(obtenerEstadoProcesoSolicitud(sol)));

      const estadosOrdenados = [
        ...ORDEN_ESTADOS_PROCESO.filter(estado => estadosSet.has(estado)),
        ...Array.from(estadosSet).filter(estado => !ORDEN_ESTADOS_PROCESO.includes(estado)).sort()
      ];

      select.innerHTML = "<option value=\"\">Todos los estados</option>";
      estadosOrdenados.forEach(estado => {
        const option = document.createElement("option");
        option.value = estado;
        option.textContent = estado;
        if (estado === estadoSeleccionado) option.selected = true;
        select.appendChild(option);
      });
    }

    function registrarEtapa(solicitud, etapa, detalle) {
      if (!Array.isArray(solicitud.historialEtapas)) {
        solicitud.historialEtapas = [];
      }

      solicitud.historialEtapas.push({
        etapa,
        fecha: obtenerFechaHoraLocal(),
        usuario: USUARIO,
        detalle: detalle || ""
      });
    }

    function registrarAuditoria(solicitud, accion, detalle) {
      if (!Array.isArray(solicitud.auditTrail)) {
        solicitud.auditTrail = [];
      }

      solicitud.auditTrail.push({
        accion,
        detalle: detalle || "",
        usuario: USUARIO,
        fecha: obtenerFechaHoraLocal()
      });
    }

    function nuevaSolicitud() {
      window.location.href = "formulario-solicitud.html";
    }

    function editarSolicitud(indice) {
      const lista = obtenerSolicitudes();
      const solicitud = lista[indice];

      if (!solicitud) return;

      if (solicitud.estado !== "Ingresado") {
        alert("Solo se puede editar una solicitud en estado Ingresado.");
        return;
      }

      window.location.href = `formulario-solicitud.html?edit=${indice}`;
    }

    function anularSolicitud(indice) {
      if (!confirm("Seguro que deseas anular esta solicitud?")) return;

      const lista = obtenerSolicitudes();
      const sol = lista[indice];
      if (!sol) return;

      sol.estado = "Anulado";
      sol.estadoGeneral = "Anulado";
      sol.etapaActual = "solicitud_anulada";
      sol.ultimaActualizacion = obtenerFechaHoraLocal();

      registrarEtapa(sol, "solicitud_anulada", "Anulacion desde listado principal");
      registrarAuditoria(sol, "anulacion", "Solicitud anulada manualmente");

      guardarSolicitudes(lista);
      cargarTabla();
    }

    function eliminarSolicitud(indice) {
      if (!confirm("Seguro que deseas eliminar esta solicitud? Se movera al historial de eliminadas.")) return;

      const lista = obtenerSolicitudes();
      const [eliminada] = lista.splice(indice, 1);

      if (!eliminada) return;

      eliminada.ultimaActualizacion = obtenerFechaHoraLocal();
      registrarEtapa(eliminada, "solicitud_eliminada", "Eliminada desde listado");
      registrarAuditoria(eliminada, "eliminacion", "Movida a solicitudes eliminadas");

      const eliminadas = JSON.parse(localStorage.getItem("solicitudes_eliminadas") || "[]");
      eliminadas.push(eliminada);

      localStorage.setItem("solicitudes_eliminadas", JSON.stringify(eliminadas));
      guardarSolicitudes(lista);
      cargarTabla();
    }

    let pdfActualUrl = "";
    let pdfActualNombre = "solicitud.pdf";

    function textoPdf(valor) {
      if (valor === null || valor === undefined) return "-";
      const limpio = String(valor).replace(/\s+/g, " ").trim();
      return limpio ? limpio : "-";
    }

    function obtenerConstructorJsPdf() {
      if (window.jspdf && window.jspdf.jsPDF) {
        return window.jspdf.jsPDF;
      }
      alert("No se pudo cargar la libreria de PDF. Recarga la pagina para intentarlo de nuevo.");
      return null;
    }

    function nombreArchivoPdf(solicitud) {
      const base = textoPdf(solicitud.numero).replace(/[^a-zA-Z0-9_-]/g, "_");
      return "solicitud_" + (base || "sin_numero") + ".pdf";
    }

    function cerrarPdfModal() {
      const modal = document.getElementById("pdfModal");
      const frame = document.getElementById("pdfPreviewFrame");

      if (frame) {
        frame.removeAttribute("src");
      }
      if (pdfActualUrl) {
        URL.revokeObjectURL(pdfActualUrl);
        pdfActualUrl = "";
      }
      if (modal) {
        modal.classList.remove("is-open");
        modal.setAttribute("aria-hidden", "true");
      }
      document.body.style.overflow = "";
    }

    function abrirMotivoRechazoModal(motivo) {
      const modal = document.getElementById("motivoRechazoModal");
      const texto = document.getElementById("motivoRechazoTexto");
      if (!modal || !texto) return;
      texto.textContent = String(motivo || "").trim() || "Sin motivo registrado.";
      modal.classList.add("is-open");
      modal.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
    }

    function cerrarMotivoRechazoModal() {
      const modal = document.getElementById("motivoRechazoModal");
      if (!modal) return;
      modal.classList.remove("is-open");
      modal.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
    }

    function verMotivoRechazo(indice) {
      const lista = obtenerSolicitudes();
      const sol = lista[indice];
      if (!sol) return;
      abrirMotivoRechazoModal(sol.motivoRechazo || "");
    }

    function abrirPdfActual() {
      if (!pdfActualUrl) {
        alert("No hay un PDF generado para abrir.");
        return;
      }
      window.open(pdfActualUrl, "_blank");
    }

    function descargarPdfActual() {
      if (!pdfActualUrl) {
        alert("No hay un PDF generado para descargar.");
        return;
      }
      const link = document.createElement("a");
      link.href = pdfActualUrl;
      link.download = pdfActualNombre || "solicitud.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
    }

    function abrirPdfEnModal(doc, nombreArchivo) {
      const modal = document.getElementById("pdfModal");
      const frame = document.getElementById("pdfPreviewFrame");

      if (!modal || !frame) {
        alert("No se encontro el contenedor del visor PDF.");
        return;
      }

      if (pdfActualUrl) {
        URL.revokeObjectURL(pdfActualUrl);
      }

      pdfActualUrl = URL.createObjectURL(doc.output("blob"));
      pdfActualNombre = nombreArchivo || "solicitud.pdf";
      frame.src = pdfActualUrl + "#toolbar=1&navpanes=1&scrollbar=1&view=FitH";
      modal.classList.add("is-open");
      modal.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
    }

    function crearPdfSolicitud(sol) {
      const JsPdf = obtenerConstructorJsPdf();
      if (!JsPdf) return null;

      const doc = new JsPdf({ unit: "mm", format: "a4", orientation: "portrait" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 12;
      const labelW = 52;
      const valueW = pageW - margin - margin - labelW;
      let y = 14;

      const accesos = Array.isArray(sol.accesosPC) && sol.accesosPC.length > 0 ? sol.accesosPC.join(", ") : "-";
      const competencias = Array.isArray(sol.competenciasTabla) && sol.competenciasTabla.length > 0
        ? sol.competenciasTabla.map(item => textoPdf(item.categoria || "General") + ": " + textoPdf(item.comp || "-")).join(" | ")
        : textoPdf(sol.competencias);

      function asegurarEspacio(altoNecesario) {
        if (y + altoNecesario > pageH - 12) {
          doc.addPage();
          y = 14;
        }
      }

      function agregarTitulo() {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.text("Resumen de Solicitud", margin, y);
        y += 6;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(70, 70, 70);
        doc.text("Generado: " + obtenerFechaHoraLocal(), margin, y);
        doc.setTextColor(20, 20, 20);
        y += 5;
      }

      function agregarSeccion(titulo, filas) {
        asegurarEspacio(10);
        doc.setDrawColor(212, 221, 218);
        doc.setFillColor(243, 248, 246);
        doc.rect(margin, y, pageW - (margin * 2), 7, "FD");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text(titulo, margin + 2, y + 4.7);
        y += 8;

        filas.forEach(fila => {
          const etiqueta = textoPdf(fila[0]);
          const valor = textoPdf(fila[1]);
          const etiquetaLineas = doc.splitTextToSize(etiqueta, labelW - 4);
          const valorLineas = doc.splitTextToSize(valor, valueW - 4);
          const lineas = Math.max(etiquetaLineas.length, valorLineas.length);
          const altoFila = Math.max(6, (lineas * 3.7) + 2);
          asegurarEspacio(altoFila);

          doc.setDrawColor(216, 224, 221);
          doc.setFillColor(250, 252, 251);
          doc.rect(margin, y, labelW, altoFila, "FD");
          doc.rect(margin + labelW, y, valueW, altoFila, "S");

          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          doc.text(etiquetaLineas, margin + 2, y + 4);

          doc.setFont("helvetica", "normal");
          doc.text(valorLineas, margin + labelW + 2, y + 4);

          y += altoFila;
        });

        y += 4;
      }

      agregarTitulo();

      agregarSeccion("Datos Generales", [
        ["Numero de solicitud", sol.numero],
        ["Fecha de solicitud", sol.fechaSolicitud],
        ["Solicitante", sol.solicitante],
        ["Area", sol.area],
        ["Departamento", sol.departamento],
        ["Estado", sol.estado],
        ["Ultima actualizacion", sol.ultimaActualizacion]
      ]);

      agregarSeccion("Detalle de la Solicitud", [
        ["Motivo", sol.motivo],
        ["Cargo solicitado", sol.cargoSolicitado],
        ["Reemplaza a", sol.reemplazaA],
        ["Fecha estimada de ingreso", sol.fechaIngreso],
        ["Cantidad de vacantes", sol.cantidad],
        ["Tipo de contratacion", sol.tipoContratacion],
        ["Horario", sol.horario],
        ["Horario completo", sol.horarioCompleto],
        ["Tipo de cargo", sol.tipoCargo]
      ]);

      agregarSeccion("Perfil Requerido", [
        ["Edad estimada", sol.edad],
        ["Sexo sugerido", sol.sexo],
        ["Nivel academico", sol.nivelAcademico],
        ["Profesion", sol.profesion],
        ["Experiencia minima", sol.experienciaMinima],
        ["Conocimientos tecnicos", sol.conocimientosTecnicos],
        ["Requerimientos adicionales", sol.requerimientosAdicionales],
        ["Funciones del perfil", sol.funcionesPerfil],
        ["Competencias", competencias]
      ]);

      agregarSeccion("Requerimientos Adicionales", [
        ["Requiere accesos", sol.requiereAccesos],
        ["Accesos requeridos", accesos],
        ["Requiere computador", sol.requiereComp],
        ["Requiere telefono", sol.requiereTel],
        ["Requiere celular", sol.requiereCel],
        ["Solicitud adicional", sol.adicional]
      ]);

      return doc;
    }

    function verSolicitudPdf(indice) {
      const lista = obtenerSolicitudes();
      const sol = lista[indice];
      if (!sol) {
        alert("No se encontro la solicitud seleccionada.");
        return;
      }

      const doc = crearPdfSolicitud(sol);
      if (!doc) return;

      abrirPdfEnModal(doc, nombreArchivoPdf(sol));
    }

    function puntajeCandidatoTimeline(candidato) {
      const estado = normalizarTexto(candidato?.estado);
      const periodo = normalizarTexto(candidato?.periodoEstado);
      const aptitudMedica = normalizarTexto(candidato?.aptitudMedica);
      const ingreso = normalizarTexto(candidato?.ingreso);

      let puntaje = 0;

      if (estado === "seleccionado_oficial") puntaje += 100;
      else if (estado === "aprobado_ingreso") puntaje += 90;
      else if (estado === "terna") puntaje += 80;
      else if (estado === "apto") puntaje += 70;
      else if (estado === "apto_observacion") puntaje += 65;

      if (periodo === "cerrado") puntaje += 55;
      else if (periodo === "en prueba") puntaje += 50;

      if (aptitudMedica === "apto") puntaje += 45;
      else if (aptitudMedica === "apto con observacion" || aptitudMedica === "apto con observación") puntaje += 40;
      else if (aptitudMedica === "no apto") puntaje += 30;

      if (ingreso === "ingreso" || ingreso === "no ingreso") puntaje += 25;

      return puntaje;
    }

    function resolverCandidatoTimeline(solicitud) {
      const candidatos = Array.isArray(solicitud?.candidatos)
        ? solicitud.candidatos.filter(c => String(c?.cedula || "").trim() !== "")
        : [];

      if (candidatos.length === 0) return null;
      if (candidatos.length === 1) return candidatos[0];

      const ordenados = candidatos
        .map(c => ({ candidato: c, puntaje: puntajeCandidatoTimeline(c) }))
        .sort((a, b) => b.puntaje - a.puntaje);

      return ordenados[0]?.candidato || candidatos[0];
    }

    function verTimelineSolicitud(indice) {
      const lista = obtenerSolicitudes();
      const sol = lista[indice];
      if (!sol) return;

      const candidato = resolverCandidatoTimeline(sol);
      if (!candidato) {
        alert("Esta solicitud no tiene candidatos con cedula para mostrar timeline.");
        return;
      }

      const numero = encodeURIComponent(String(sol.numero || ""));
      const cedula = encodeURIComponent(String(candidato.cedula || ""));
      window.location.href = `../../postulacion/timeline-postulante.html?sol=${numero}&ced=${cedula}`;
    }

    window.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        const modal = document.getElementById("pdfModal");
        const modalMotivo = document.getElementById("motivoRechazoModal");
        if (modal && modal.classList.contains("is-open")) {
          cerrarPdfModal();
        }
        if (modalMotivo && modalMotivo.classList.contains("is-open")) {
          cerrarMotivoRechazoModal();
        }
      }
    });

    window.addEventListener("beforeunload", () => {
      if (pdfActualUrl) {
        URL.revokeObjectURL(pdfActualUrl);
      }
    });

    function limpiarFiltros() {
      document.getElementById("txtBuscar").value = "";
      document.getElementById("selEstado").value = "";
      cargarTabla();
    }

    function cumpleFiltroTexto(solicitud, texto, estadoProceso) {
      if (!texto) return true;

      const bolsa = [
        solicitud.numero,
        solicitud.traceId,
        solicitud.solicitante,
        solicitud.cargoSolicitado,
        solicitud.area,
        solicitud.departamento,
        solicitud.estado,
        estadoProceso
      ].join(" ").toLowerCase();

      return bolsa.includes(texto.toLowerCase());
    }

    function cargarTabla() {
      const tabla = document.getElementById("tablaBody");
      tabla.innerHTML = "";

      const lista = obtenerSolicitudes();
      normalizarLista(lista);

      const texto = document.getElementById("txtBuscar").value.trim();
      const estadoFiltro = document.getElementById("selEstado").value;
      poblarFiltroEstados(lista, estadoFiltro);

      const filtrada = lista.filter(sol => {
        const estadoProceso = obtenerEstadoProcesoSolicitud(sol);
        const matchEstado = !estadoFiltro || estadoProceso === estadoFiltro;
        const matchTexto = cumpleFiltroTexto(sol, texto, estadoProceso);
        return matchEstado && matchTexto;
      });

      if (filtrada.length === 0) {
        tabla.innerHTML = "<tr><td colspan=\"8\" class=\"text-center text-muted py-4\">No hay solicitudes para los filtros aplicados.</td></tr>";
        return;
      }

      filtrada.forEach(sol => {
        const indiceReal = lista.findIndex(x => x.traceId === sol.traceId && x.numero == sol.numero);
        const puedeEditar = sol.estado === "Ingresado";
        const attrEditar = puedeEditar ? "" : " disabled title=\"Solo editable en estado Ingresado\"";
        const esRechazada = String(sol.estado || "").trim().toLowerCase() === "rechazado";
        const attrMotivo = esRechazada ? "" : " disabled title=\"Disponible solo para solicitudes rechazadas\"";
        const estadoProceso = obtenerEstadoProcesoSolicitud(sol);

          const fila =
          "<tr>" +
          "<td>" + (sol.numero || "-") + "</td>" +
          "<td>" + (sol.fechaSolicitud || "-") + "</td>" +
          "<td>" + (sol.solicitante || "-") + "</td>" +
          "<td>" + (sol.area || "-") + "</td>" +
          "<td>" + (sol.departamento || "-") + "</td>" +
          "<td>" + (sol.cargoSolicitado || "-") + "</td>" +
          "<td><span class=\"badge bg-" + colorEstado(estadoProceso) + "\">" + estadoProceso + "</span></td>" +
          "<td class=\"actions\">" +
          "<button class=\"btn btn-primary btn-sm\" onclick=\"verTimelineSolicitud(" + indiceReal + ")\">🔎 Ver Timeline</button>" +
          "<button class=\"btn btn-outline-danger btn-sm\" onclick=\"verSolicitudPdf(" + indiceReal + ")\">PDF</button>" +
          "<button class=\"btn btn-warning btn-sm\" onclick=\"editarSolicitud(" + indiceReal + ")\"" + attrEditar + ">Editar</button>" +
          "<button class=\"btn btn-outline-dark btn-sm\" onclick=\"verMotivoRechazo(" + indiceReal + ")\"" + attrMotivo + ">Motivo rechazo</button>" +
          "<button class=\"btn btn-secondary btn-sm\" onclick=\"anularSolicitud(" + indiceReal + ")\">Anular</button>" +
          "<button class=\"btn btn-danger btn-sm\" onclick=\"eliminarSolicitud(" + indiceReal + ")\">Eliminar</button>" +
          "</td>" +
          "</tr>";

        tabla.insertAdjacentHTML("beforeend", fila);
      });
    }

    cargarTabla();

