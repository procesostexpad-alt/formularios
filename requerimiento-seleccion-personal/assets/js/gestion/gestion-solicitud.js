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

    function colorEstado(estado) {
      switch (estado) {
        case "Ingresado para aprobar": return "warning text-dark";
        case "Solicitud Aprobada": return "primary";
        case "Postulacion Cerrada": return "danger";
        case "En proceso de preseleccion": return "info text-dark";
        case "En proceso de seleccion": return "secondary";
        case "Preseleccion Finalizada": return "dark";
        case "Aprobado": return "success";
        case "Rechazado": return "danger";
        case "Anulado": return "secondary";
        default: return "light text-dark";
      }
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

      if (solicitud.estado === "Anulado") {
        alert("No se puede editar una solicitud anulada.");
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

    window.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        const modal = document.getElementById("pdfModal");
        if (modal && modal.classList.contains("is-open")) {
          cerrarPdfModal();
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

    function cumpleFiltroTexto(solicitud, texto) {
      if (!texto) return true;

      const bolsa = [
        solicitud.numero,
        solicitud.traceId,
        solicitud.solicitante,
        solicitud.cargoSolicitado,
        solicitud.area,
        solicitud.departamento,
        solicitud.estado
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

      const filtrada = lista.filter(sol => {
        const matchEstado = !estadoFiltro || sol.estado === estadoFiltro;
        const matchTexto = cumpleFiltroTexto(sol, texto);
        return matchEstado && matchTexto;
      });

      if (filtrada.length === 0) {
        tabla.innerHTML = "<tr><td colspan=\"9\" class=\"text-center text-muted py-4\">No hay solicitudes para los filtros aplicados.</td></tr>";
        return;
      }

      filtrada.forEach(sol => {
        const indiceReal = lista.findIndex(x => x.traceId === sol.traceId && x.numero == sol.numero);

        const fila =
          "<tr>" +
          "<td>" + (sol.numero || "-") + "</td>" +
          "<td>" + (sol.fechaSolicitud || "-") + "</td>" +
          "<td>" + (sol.solicitante || "-") + "</td>" +
          "<td>" + (sol.area || "-") + "</td>" +
          "<td>" + (sol.departamento || "-") + "</td>" +
          "<td>" + (sol.cargoSolicitado || "-") + "</td>" +
          "<td><span class=\"badge bg-" + colorEstado(sol.estado) + "\">" + (sol.estado || "-") + "</span></td>" +
          "<td>" + (sol.ultimaActualizacion || "-") + "</td>" +
          "<td class=\"actions\">" +
          "<button class=\"btn btn-outline-danger btn-sm\" onclick=\"verSolicitudPdf(" + indiceReal + ")\">PDF</button>" +
          "<button class=\"btn btn-warning btn-sm\" onclick=\"editarSolicitud(" + indiceReal + ")\">Editar</button>" +
          "<button class=\"btn btn-secondary btn-sm\" onclick=\"anularSolicitud(" + indiceReal + ")\">Anular</button>" +
          "<button class=\"btn btn-danger btn-sm\" onclick=\"eliminarSolicitud(" + indiceReal + ")\">Eliminar</button>" +
          "</td>" +
          "</tr>";

        tabla.insertAdjacentHTML("beforeend", fila);
      });
    }

    cargarTabla();
