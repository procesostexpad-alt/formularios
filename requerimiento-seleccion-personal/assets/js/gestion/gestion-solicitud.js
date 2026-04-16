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

    function normalizarEstadoBase(valor) {
      const estado = String(valor || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[\u200B-\u200D\uFEFF]/g, "")
        .replace(/[-_]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();

      if (!estado) return "";
      if (estado === "ingresado" || estado.startsWith("ingresado para aproba")) return "Ingresado";
      if (estado.startsWith("aprobad")) return "Aprobado";
      if (estado.startsWith("rechazad")) return "Rechazado";
      if (estado.startsWith("anulad")) return "Anulado";
      return String(valor || "").trim();
    }

    function esEstadoIngresadoSolicitud(sol) {
      return normalizarEstadoBase(sol?.estado) === "Ingresado" ||
        normalizarEstadoBase(sol?.estadoGeneral) === "Ingresado";
    }

    function normalizarLista(lista) {
      let huboCambios = false;

      lista.forEach(sol => {
        const estadoCanonico = normalizarEstadoBase(sol?.estado);
        if (estadoCanonico && sol.estado !== estadoCanonico) {
          sol.estado = estadoCanonico;
          huboCambios = true;
        }

        const estadoGeneralCanonico = normalizarEstadoBase(sol?.estadoGeneral);
        if (estadoGeneralCanonico && sol.estadoGeneral !== estadoGeneralCanonico) {
          sol.estadoGeneral = estadoGeneralCanonico;
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
      const ingreso = normalizarTexto(candidato?.ingreso);
      if (ingreso === "no ingreso") return "no_ingreso";

      const aptitud = normalizarTexto(candidato?.aptitudMedica);
      if (aptitud === "apto") return "apto";
      if (aptitud === "apto con observacion" || aptitud === "apto con observación") return "apto_obs";
      if (aptitud === "no apto") return "no_apto";

      // Compatibilidad con datos antiguos donde solo se guardaba "ingreso / no ingreso".
      if (ingreso === "ingreso") return "apto";

      return "";
    }

    function preIngresoCompletoCandidato(candidato) {
      const codigo = String(candidato?.codigoUnico || "").trim();
      const fecha = String(candidato?.fechaIngreso || "").trim();
      return codigo !== "" && fecha !== "";
    }

    function estadoVigilanciaF1Candidato(candidato) {
      const f1 = normalizarTexto(candidato?.vigilanciaSaludF1Resultado);
      if (f1 === "apto" || f1 === "apto con observacion" || f1 === "apto con observación" || f1 === "no apto") {
        return f1;
      }
      return "";
    }

    function estadoVigilanciaF2Candidato(candidato) {
      const f2 = normalizarTexto(candidato?.aptitudMedica);
      if (f2 === "apto" || f2 === "apto con observacion" || f2 === "apto con observación" || f2 === "no apto") {
        return f2;
      }
      return "";
    }

    function estadoEquiposAccesosCandidato(candidato) {
      const estado = normalizarTexto(candidato?.estadoEntrega);
      if (estado === "pendiente" || estado === "entregado" || estado === "entrega incompleta") return estado;
      return "";
    }

    function estadoDotacionBasicaCandidato(candidato) {
      const estado = normalizarTexto(candidato?.entregaBasica);
      if (estado === "pendiente" || estado === "entregado" || estado === "entrega incompleta" || estado === "no aplica") {
        return estado;
      }
      return "";
    }

    function tieneChecklistRequisitosCandidato(candidato) {
      if (candidato?.requisitosFileEmpleadoCompletos === true) return true;
      return !!(candidato?.requisitosFileEmpleadoChecklist && typeof candidato.requisitosFileEmpleadoChecklist === "object");
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
      const estadoF1 = estadoVigilanciaF1Candidato(candidatoProceso);
      const estadoF2 = estadoVigilanciaF2Candidato(candidatoProceso);
      const preIngresoCompleto = preIngresoCompletoCandidato(candidatoProceso);
      const tieneFileEmpleado = tieneChecklistRequisitosCandidato(candidatoProceso);
      const fileEmpleadoCompleto = candidatoProceso?.requisitosFileEmpleadoCompletos === true;
      const equiposAccesos = estadoEquiposAccesosCandidato(candidatoProceso);
      const dotacionBasica = estadoDotacionBasicaCandidato(candidatoProceso);
      const decisionFinalizada = candidatoProceso?.decisionIngresoFinalizada === true;
      const ingresoFinal = normalizarTexto(candidatoProceso?.ingreso);
      const induccionCompleta = tieneInduccionCompleta(sol);
      const induccionEnProceso = tieneInduccionEnProceso(sol);
      const periodoCerrado = tienePeriodo(sol, "CERRADO");
      const periodoEnPrueba = tienePeriodo(sol, "EN PRUEBA");
      const aprobacionIngresoIniciada = etapaIngreso === "iniciada" || estadoIngreso.includes("en proceso");
      const aprobacionIngresoFinalizada = etapaIngreso === "finalizada" || estadoIngreso.includes("finalizada") || tieneEstadoCandidato(sol, ["aprobado_ingreso"]);

      if (decisionFinalizada || ingresoFinal === "ingreso" || ingresoFinal === "no ingreso") {
        if (ingresoFinal === "no ingreso") return "Decision final de ingreso - NO INGRESO";
        if (ingresoFinal === "ingreso") return "Decision final de ingreso - INGRESO";
      }

      if (resultadoAptitud === "no_ingreso") return "Cerrado - No ingreso";
      if (resultadoAptitud === "no_apto") return "Cerrado - No apto medico";
      if (resultadoAptitud === "apto" || resultadoAptitud === "apto_obs") {
        const etiquetaAptitud = etiquetaAptitudProceso(resultadoAptitud);
        if (solicitudRequiereDotacionCompleta(sol)) {
          if (dotacionCompletaFinalizada(candidatoProceso)) {
            return "En decision final de ingreso";
          }
          return `${etiquetaAptitud} - Pendiente dotacion completa`;
        }
        return "En decision final de ingreso";
      }

      if (periodoCerrado && !estadoF2) return "En vigilancia a la salud F2";
      if (estadoF2 === "no apto") return "Vigilancia a la salud F2 - NO APTO";
      if (estadoF2 === "apto con observacion" || estadoF2 === "apto con observación") {
        return "Vigilancia a la salud F2 - APTO CON OBSERVACION";
      }
      if (estadoF2 === "apto") return "Vigilancia a la salud F2 - APTO";

      if (periodoEnPrueba) return "En periodo de prueba";
      if (periodoCerrado) return "Periodo de prueba finalizado";

      if (equiposAccesos) return "Gestion de equipos y accesos";
      if (dotacionBasica) return "En gestion de equipos y accesos";
      if (induccionEnProceso) return "En induccion";
      if (induccionCompleta) return "En entrega de dotacion basica";
      if (preIngresoCompleto) return "En induccion";
      if (fileEmpleadoCompleto) return "En pre-ingreso";
      if (tieneFileEmpleado) {
        return "En requisitos file empleado";
      }
      if (estadoF1 === "no apto") return "Vigilancia a la salud F1 - NO APTO";
      if (estadoF1 === "apto" || estadoF1 === "apto con observacion" || estadoF1 === "apto con observación") {
        return "En requisitos file empleado";
      }
      if (aprobacionIngresoFinalizada) return "En vigilancia a la salud F1";

      // Compatibilidad de lectura para solicitudes antiguas.
      if (tieneAptitudMedicaRegistrada(sol)) return "Aptitud medica";
      if (tieneIngresoRegistrado(sol)) return "Ingreso de personal";
      if (tieneGestionEquiposAccesos(sol)) return "Gestion de equipos y accesos";

      if (aprobacionIngresoIniciada) return "En aprobacion de ingreso";
      if (aprobacionIngresoFinalizada) return "Aprobacion de ingreso finalizada";

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
      if (normal.includes("en decision final de ingreso")) return "dark";
      if (normal.includes("decision final de ingreso")) return normal.includes("no ingreso") ? "dark" : "success";
      if (normal.includes("en vigilancia a la salud f2")) return "warning text-dark";
      if (normal.includes("vigilancia a la salud f2")) return normal.includes("no apto") ? "danger" : "info text-dark";
      if (normal.includes("en vigilancia a la salud f1")) return "warning text-dark";
      if (normal.includes("vigilancia a la salud f1")) return normal.includes("no apto") ? "danger" : "info text-dark";
      if (normal.includes("en pre-ingreso")) return "primary";
      if (normal.includes("pre-ingreso registrado")) return "primary";
      if (normal.includes("en entrega de dotacion basica")) return "secondary";
      if (normal.includes("en gestion de equipos y accesos")) return "secondary";
      if (normal.includes("requisitos file empleado")) return normal.includes("completado") ? "success" : "warning text-dark";
      if (normal.includes("dotacion basica")) return "secondary";
      if (normal.includes("no ingreso")) return "dark";
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
      "En vigilancia a la salud F1",
      "Vigilancia a la salud F1 - APTO",
      "Vigilancia a la salud F1 - APTO CON OBSERVACION",
      "Vigilancia a la salud F1 - NO APTO",
      "En requisitos file empleado",
      "Requisitos file empleado completado",
      "En pre-ingreso",
      "Pre-ingreso registrado",
      "En induccion",
      "Induccion completada",
      "En entrega de dotacion basica",
      "Entrega de dotacion basica",
      "En gestion de equipos y accesos",
      "Gestion de equipos y accesos",
      "En periodo de prueba",
      "Periodo de prueba finalizado",
      "En vigilancia a la salud F2",
      "Vigilancia a la salud F2 - APTO",
      "Vigilancia a la salud F2 - APTO CON OBSERVACION",
      "Vigilancia a la salud F2 - NO APTO",
      "Apto medico - Pendiente dotacion completa",
      "Apto con observacion - Pendiente dotacion completa",
      "Apto medico - Dotacion completa finalizada",
      "Apto con observacion - Dotacion completa finalizada",
      "En decision final de ingreso",
      "Apto medico - Proceso finalizado",
      "Apto con observacion - Proceso finalizado",
      "Decision final de ingreso - INGRESO",
      "Decision final de ingreso - NO INGRESO",
      "Cerrado - No ingreso",
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

      if (!esEstadoIngresadoSolicitud(solicitud)) {
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
      const labelW = 58;
      const valueW = pageW - margin - margin - labelW;
      let y = 14;

      const manual = sol?.manualCargoDetalle && typeof sol.manualCargoDetalle === "object"
        ? sol.manualCargoDetalle
        : {};
      const ficha = manual?.ficha && typeof manual.ficha === "object" ? manual.ficha : {};

      const area = textoPdf(sol.area) !== "-" ? sol.area : manual.area;
      const departamento = textoPdf(sol.departamento) !== "-" ? sol.departamento : manual.departamento;
      const cargoSolicitado = textoPdf(sol.cargoSolicitado) !== "-" ? sol.cargoSolicitado : manual.nombreCargo;
      const codigoCargo = textoPdf(sol.codigoCargoManual) !== "-" ? sol.codigoCargoManual : manual.codigoCargo;
      const tipoCargo = textoPdf(sol.tipoCargo) !== "-" ? sol.tipoCargo : manual.tipoCargo;
      const horario = textoPdf(sol.horario) !== "-" ? sol.horario : manual.horario;
      const horarioCompleto = textoPdf(sol.horarioCompleto) !== "-" ? sol.horarioCompleto : manual.horarioCompleto;
      const edad = textoPdf(sol.edad) !== "-" ? sol.edad : manual.edadSugerida;
      const sexo = textoPdf(sol.sexo) !== "-" ? sol.sexo : manual.sexoSugerido;

      function asegurarEspacio(altoNecesario) {
        if (y + altoNecesario > pageH - 12) {
          doc.addPage();
          y = 14;
        }
      }

      function agregarTitulo() {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.text("Resumen Solicitud de Requerimiento de Personal", margin, y);
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

      function agregarSeccionVertical(titulo, bloques) {
        asegurarEspacio(10);
        doc.setDrawColor(212, 221, 218);
        doc.setFillColor(243, 248, 246);
        doc.rect(margin, y, pageW - (margin * 2), 7, "FD");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text(titulo, margin + 2, y + 4.7);
        y += 8;

        const boxW = pageW - (margin * 2);
        (Array.isArray(bloques) ? bloques : []).forEach((bloque) => {
          const subtitulo = textoPdf(Array.isArray(bloque) ? bloque[0] : "");
          const valor = textoPdf(Array.isArray(bloque) ? bloque[1] : "");
          const subtituloLineas = doc.splitTextToSize(subtitulo, boxW - 4);
          const valorLineas = doc.splitTextToSize(valor, boxW - 4);
          const altoSubtitulo = Math.max(4.5, subtituloLineas.length * 3.6);
          const altoValor = Math.max(5.2, valorLineas.length * 3.7);
          const altoBloque = altoSubtitulo + altoValor + 4.5;

          asegurarEspacio(altoBloque);
          doc.setDrawColor(216, 224, 221);
          doc.setFillColor(250, 252, 251);
          doc.rect(margin, y, boxW, altoBloque, "FD");

          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          doc.text(subtituloLineas, margin + 2, y + 3.8);

          const yLinea = y + altoSubtitulo + 0.5;
          doc.setDrawColor(227, 233, 230);
          doc.line(margin + 1.8, yLinea, margin + boxW - 1.8, yLinea);

          doc.setFont("helvetica", "normal");
          doc.setFontSize(8.8);
          doc.text(valorLineas, margin + 2, yLinea + 3.8);

          y += altoBloque + 2.2;
        });

        y += 2;
      }

      function normalizarFilasTabla(filas, columnas) {
        const totalColumnas = Array.isArray(columnas) ? columnas.length : 0;
        if (!totalColumnas) return [];

        const normalizar = valor => String(valor || "")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .trim();

        const esFilaCabecera = (fila) => fila.every((celda, index) => {
          const actual = normalizar(celda);
          const esperado = normalizar(columnas[index]);
          return actual && esperado && actual === esperado;
        });

        if (Array.isArray(filas) && filas.length > 0) {
          const filasNormalizadas = filas.map(fila => {
            const base = Array.isArray(fila) ? fila.slice(0, totalColumnas) : [];
            while (base.length < totalColumnas) base.push("-");
            return base;
          });

          const filasSinCabeceraDuplicada = filasNormalizadas.filter(fila => !esFilaCabecera(fila));
          if (filasSinCabeceraDuplicada.length > 0) return filasSinCabeceraDuplicada;
        }

        const filaVacia = Array.from({ length: totalColumnas }, (_, index) => (index === 0 ? "Sin registros" : "-"));
        return [filaVacia];
      }

      function agregarTabla(titulo, columnas, filas, pesos) {
        const totalCols = Array.isArray(columnas) ? columnas.length : 0;
        if (!totalCols) return;

        const areaW = pageW - (margin * 2);
        const pesosBase = (Array.isArray(pesos) && pesos.length === totalCols)
          ? pesos
          : Array.from({ length: totalCols }, () => 1);
        const sumaPesos = pesosBase.reduce((acc, item) => acc + Number(item || 0), 0) || totalCols;
        const colW = pesosBase.map(p => areaW * (Number(p || 0) / sumaPesos));
        const filasTabla = normalizarFilasTabla(filas, columnas);
        const alturaLinea = 3.7;
        const padX = 1.6;
        const padTop = 3.6;

        function dibujarTituloTabla(textoTitulo) {
          asegurarEspacio(10);
          doc.setDrawColor(212, 221, 218);
          doc.setFillColor(243, 248, 246);
          doc.rect(margin, y, areaW, 7, "FD");
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          doc.text(textoPdf(textoTitulo), margin + 2, y + 4.7);
          y += 8;
        }

        function construirLineasFila(celdas) {
          return celdas.map((celda, index) => doc.splitTextToSize(textoPdf(celda), colW[index] - (padX * 2)));
        }

        function calcularAltoFila(lineasCeldas) {
          const maxLineas = lineasCeldas.reduce((acc, lineas) => Math.max(acc, lineas.length), 1);
          return Math.max(6.2, (maxLineas * alturaLinea) + 2.1);
        }

        function dibujarFila(celdas, esHeader) {
          const lineasCeldas = construirLineasFila(celdas);
          const altoFila = calcularAltoFila(lineasCeldas);

          if (y + altoFila > pageH - 12) {
            doc.addPage();
            y = 14;
            if (!esHeader) dibujarFila(columnas, true);
          }

          let x = margin;
          for (let i = 0; i < totalCols; i += 1) {
            doc.setDrawColor(216, 224, 221);
            if (esHeader) {
              doc.setFillColor(236, 243, 240);
              doc.rect(x, y, colW[i], altoFila, "FD");
              doc.setFont("helvetica", "bold");
              doc.setFontSize(8.7);
            } else {
              doc.rect(x, y, colW[i], altoFila, "S");
              doc.setFont("helvetica", "normal");
              doc.setFontSize(8.6);
            }
            doc.text(lineasCeldas[i], x + padX, y + padTop);
            x += colW[i];
          }

          y += altoFila;
        }

        const altoHeaderEstimado = calcularAltoFila(construirLineasFila(columnas));
        const altoPrimeraFila = filasTabla.length > 0
          ? calcularAltoFila(construirLineasFila(filasTabla[0]))
          : 6.2;
        asegurarEspacio(8 + altoHeaderEstimado + altoPrimeraFila);

        dibujarTituloTabla(titulo);
        dibujarFila(columnas, true);
        filasTabla.forEach(fila => dibujarFila(fila, false));
        y += 4;
      }

      function filasPerfil() {
        if (Array.isArray(ficha.perfilDetalle) && ficha.perfilDetalle.length > 0) {
          return ficha.perfilDetalle.map(item => [item.formacionAcademica, item.tipo, item.titulo]);
        }
        return [];
      }

      function filasCompetencias() {
        if (Array.isArray(ficha.competenciasDetalle) && ficha.competenciasDetalle.length > 0) {
          return ficha.competenciasDetalle.map(item => [
            item.tipo,
            item.competencia,
            item.descripcion || item.subcategoria || ""
          ]);
        }
        if (Array.isArray(sol.competenciasTabla) && sol.competenciasTabla.length > 0) {
          return sol.competenciasTabla.map(item => {
            const partes = String(item.categoria || "").split("/").map(v => v.trim()).filter(Boolean);
            const tipoComp = partes[0] || "General";
            const competencia = partes.slice(1).join(" / ") || item.competencia || "-";
            return [tipoComp, competencia, item.descripcion || item.subcategoria || item.comp || ""];
          });
        }
        return [];
      }

      function filasCapacitaciones() {
        if (Array.isArray(ficha.capacitacionesDetalle) && ficha.capacitacionesDetalle.length > 0) {
          return ficha.capacitacionesDetalle.map(item => [item.tipo, item.detalle]);
        }
        return [];
      }

      function filasEquiposAccesos() {
        if (Array.isArray(ficha.equiposAccesosDetalle) && ficha.equiposAccesosDetalle.length > 0) {
          return ficha.equiposAccesosDetalle.map(item => [item.tipo, item.recurso, item.observacion]);
        }
        return [];
      }

      function filasEpps() {
        if (Array.isArray(ficha.eppsUniformesDetalle) && ficha.eppsUniformesDetalle.length > 0) {
          return ficha.eppsUniformesDetalle.map(item => [item.tipo, item.elemento, item.cantidad, item.observacion]);
        }
        return [];
      }

      function filasKpis() {
        if (Array.isArray(ficha.indicadoresKpisDetalle) && ficha.indicadoresKpisDetalle.length > 0) {
          return ficha.indicadoresKpisDetalle.map(item => [item.indicador, item.formula]);
        }
        return [];
      }

      agregarTitulo();

      agregarSeccion("Datos Generales", [
        ["Numero de solicitud", sol.numero],
        ["Fecha de solicitud", sol.fechaSolicitud],
        ["Solicitante", sol.solicitante],
        ["Area", area],
        ["Departamento", departamento],
        ["Estado", sol.estado],
        ["Ultima actualizacion", sol.ultimaActualizacion]
      ]);

      // Construir filas dinámicamente según el motivo
      const filasDetalleSolicitud = [
        ["Motivo", sol.motivo],
        ["Cargo solicitado", cargoSolicitado],
        ["Codigo cargo", codigoCargo]
      ];
      
      // Agregar campos específicos según el motivo
      if (sol.motivo && sol.motivo.toLowerCase().includes("reemplazo")) {
        if (sol.detalleReemplazo) {
          filasDetalleSolicitud.push(["Detalle del motivo", sol.detalleReemplazo]);
        }
        if (sol.reemplazaA) {
          filasDetalleSolicitud.push(["Reemplaza a", sol.reemplazaA]);
        }
      }
      
      filasDetalleSolicitud.push(
        ["Fecha estimada de ingreso", sol.fechaIngreso],
        ["Cantidad de vacantes", sol.cantidad],
        ["Tipo de contratacion", sol.tipoContratacion]
      );

      agregarSeccion("Detalle de la Solicitud", filasDetalleSolicitud);

      agregarSeccion("Datos del Cargo", [
        ["Tipo cargo", tipoCargo],
        ["Horario", horario],
        ["Horario (inicio - fin)", horarioCompleto],
        ["Edad sugerida", edad],
        ["Sexo sugerido", sexo],
        ["Banda salarial", manual.bandaSalarial],
        ["Quien reporta", manual.quienReporta],
        ["Quien supervisa", manual.quienSupervisa]
      ]);

      agregarSeccionVertical("Definicion del Manual", [
        ["Proposito de cargo", ficha.objetivo],
        ["Funciones y responsabilidades clave", ficha.funciones],
        ["Experiencia requerida", ficha.experienciaRequerida || sol.experienciaMinima]
      ]);

      agregarTabla(
        "Tabla Perfil de Cargo",
        ["Formacion academica", "Tipo", "Titulo"],
        filasPerfil(),
        [2.2, 1.2, 2.6]
      );

      agregarTabla(
        "Tabla Competencias",
        ["Tipo", "Competencia", "Descripcion"],
        filasCompetencias(),
        [1.2, 1.9, 1.9]
      );

      agregarTabla(
        "Tabla Capacitaciones",
        ["Tipo", "Capacitacion"],
        filasCapacitaciones(),
        [1.5, 4.5]
      );

      agregarTabla(
        "Tabla Equipos y Accesos",
        ["Tipo", "Recurso", "Observacion"],
        filasEquiposAccesos(),
        [1.1, 1.8, 3.1]
      );

      agregarTabla(
        "Tabla EPPs y Uniformes",
        ["Tipo", "Elemento", "Cantidad", "Observacion"],
        filasEpps(),
        [1.1, 1.7, 0.9, 2.3]
      );

      agregarTabla(
        "Tabla Indicadores KPIs",
        ["Indicador", "Formula"],
        filasKpis(),
        [2.2, 3.8]
      );

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
      const f1 = normalizarTexto(candidato?.vigilanciaSaludF1Resultado);
      const tienePreIngreso = preIngresoCompletoCandidato(candidato);
      const tieneDecisionFinal = candidato?.decisionIngresoFinalizada === true || ingreso === "ingreso" || ingreso === "no ingreso";
      const requisitosCompletos = candidato?.requisitosFileEmpleadoCompletos === true;
      const estadoEquipos = estadoEquiposAccesosCandidato(candidato);
      const estadoBasica = estadoDotacionBasicaCandidato(candidato);
      const dotacionCompleta = normalizarTexto(candidato?.entregaCompleta);

      let puntaje = 0;

      if (tieneDecisionFinal) puntaje += 1000;
      if (ingreso === "ingreso") puntaje += 500;
      else if (ingreso === "no ingreso") puntaje += 480;

      if (dotacionCompleta === "entregado" || dotacionCompleta === "no aplica") puntaje += 450;
      else if (dotacionCompleta === "entregado incompleto") puntaje += 430;

      if (aptitudMedica === "apto") puntaje += 420;
      else if (aptitudMedica === "apto con observacion" || aptitudMedica === "apto con observación") puntaje += 410;
      else if (aptitudMedica === "no apto") puntaje += 400;

      if (periodo === "cerrado") puntaje += 350;
      else if (periodo === "en prueba") puntaje += 340;

      if (estadoEquipos === "entregado" || estadoEquipos === "entrega incompleta" || estadoEquipos === "pendiente") puntaje += 300;
      if (estadoBasica === "entregado" || estadoBasica === "entrega incompleta" || estadoBasica === "pendiente" || estadoBasica === "no aplica") puntaje += 290;

      if (candidato?.induccionCompleta === true) puntaje += 280;
      else if (candidato?.induccion && typeof candidato.induccion === "object") puntaje += 270;

      if (tienePreIngreso) puntaje += 260;
      if (requisitosCompletos) puntaje += 250;
      else if (tieneChecklistRequisitosCandidato(candidato)) puntaje += 240;

      if (f1 === "apto" || f1 === "apto con observacion" || f1 === "apto con observación" || f1 === "no apto") puntaje += 230;

      if (estado === "seleccionado_oficial") puntaje += 100;
      else if (estado === "aprobado_ingreso") puntaje += 90;
      else if (estado === "terna") puntaje += 80;
      else if (estado === "apto") puntaje += 70;
      else if (estado === "apto_observacion") puntaje += 65;

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
        const puedeEditar = esEstadoIngresadoSolicitud(sol);
        const attrEditar = puedeEditar ? "" : " disabled title=\"Solo editable en estado Ingresado\"";
        const esRechazada = normalizarEstadoBase(sol?.estado) === "Rechazado" ||
          normalizarEstadoBase(sol?.estadoGeneral) === "Rechazado";
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
          "</td>" +
          "</tr>";

        tabla.insertAdjacentHTML("beforeend", fila);
      });
    }

    cargarTabla();

