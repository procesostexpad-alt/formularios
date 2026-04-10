(function () {
  const params = new URLSearchParams(window.location.search);
  if (params.get("embed") === "1") {
    return;
  }

  const MENU_TREE = [
    {
      key: "puestos-trabajo",
      label: "Puestos de trabajo",
      items: [
        { label: "Manual de funciones", path: "modules/puestos-trabajo/manual-funciones.html" },
        { label: "Solicitud creacion cargo", path: "modules/puestos-trabajo/solicitud-creacion-puesto.html" },
        { label: "Gestion aprobacion creacion cargo", path: "modules/puestos-trabajo/gestion-aprobacion-creacion-puesto.html" }
      ]
    },
    {
      key: "requerimiento-personal",
      label: "Requerimiento de personal",
      items: [
        { label: "Paso 1 - Solicitud requerimiento", path: "modules/gestion/solicitudes/listado-solicitudes.html" },
        { label: "Paso 2 - Aprobacion requerimiento", path: "modules/postulacion/aprobacion-postulacion.html" },
        {
          label: "Paso 3 - Gestion postulacion",
          children: [
            { label: "Paso 3.1 - Activacion postulacion", path: "modules/postulacion/activacion-postulacion.html" },
            { label: "Paso 3.2 - Registro postulacion", path: "modules/postulacion/registro-postulacion.html" }
          ]
        }
      ]
    },
    {
      key: "seleccion-personal",
      label: "Seleccion de personal",
      items: [
        { label: "Paso 4 - Preseleccion", path: "modules/seleccion/visualizacion-preseleccion.html" },
        { label: "Paso 5 - Seleccion oficial", path: "modules/postulacion/visualizacion-solicitante.html" },
        { label: "Paso 6 - Aprobacion ingreso", path: "modules/seleccion/lista-candidatos-aptos.html" }
      ]
    },
    {
      key: "evaluacion-personal",
      label: "Evaluacion",
      items: [
        { label: "Paso 7 - Pre-ingreso", path: "modules/evaluacion/pre-ingreso.html" },
        { label: "Paso 7.1 - Induccion", path: "modules/evaluacion/induccion.html" },
        { label: "Paso 8 - Dotacion basica", path: "modules/evaluacion/entrega-dotacion.html" },
        { label: "Paso 9 - Equipos y accesos", path: "modules/evaluacion/ver-entrega-equipos-accesos.html" },
        { label: "Paso 10 - Periodo de prueba", path: "modules/evaluacion/periodo-prueba.html" }
      ]
    },
    {
      key: "ingreso-personal",
      label: "Ingreso personal",
      items: [
        { label: "Aptitud medica", path: "modules/evaluacion/aptitud-medica.html" },
        { label: "Dotacion completa", path: "modules/evaluacion/entrega-dotacion-completa.html" },
        { label: "Paso 11 - Decision ingreso final", path: "modules/evaluacion/decision-ingreso-final.html" }
      ]
    },
    {
      key: "reporteria-requerimientos",
      label: "Reporteria de requerimientos",
      path: "modules/reporteria/reporteria-requerimientos.html"
    },
    {
      key: "reporteria-creacion-cargos",
      label: "Reporteria de creacion de cargos",
      path: "modules/reporteria/reporteria-creacion-cargos.html"
    }
  ];

  function normalizePath(urlOrPath) {
    try {
      const u = new URL(urlOrPath, window.location.href);
      return decodeURIComponent(u.pathname).replace(/\\/g, "/").toLowerCase();
    } catch (e) {
      return String(urlOrPath || "").replace(/\\/g, "/").toLowerCase();
    }
  }

  function getRootUrl() {
    if (document.currentScript && document.currentScript.src) {
      return new URL("../../", document.currentScript.src);
    }

    const scripts = Array.from(document.scripts || []);
    const shellScript = scripts.find(s => s.src && s.src.toLowerCase().indexOf("assets/js/ui-shell.js") !== -1);
    if (shellScript && shellScript.src) {
      return new URL("../../", shellScript.src);
    }
    return new URL("./", window.location.href);
  }

  function buildShell() {
    const rootUrl = getRootUrl();
    const currentPath = normalizePath(window.location.href);

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "app-menu-toggle";
    toggle.setAttribute("aria-label", "Abrir menu");
    toggle.setAttribute("aria-expanded", "false");
    toggle.innerHTML = "<span></span><span></span><span></span><span class=\"app-menu-sr\">Menu</span>";

    const overlay = document.createElement("div");
    overlay.className = "app-menu-overlay";

    const drawer = document.createElement("aside");
    drawer.className = "app-menu-drawer";
    drawer.setAttribute("aria-hidden", "true");

    const head = document.createElement("header");
    head.className = "app-menu-head";
    const headText = document.createElement("div");
    const title = document.createElement("p");
    title.className = "app-menu-title";
    title.textContent = "Navegacion";
    const current = document.createElement("p");
    current.className = "app-menu-current";
    current.textContent = "Pantalla actual";
    headText.appendChild(title);
    headText.appendChild(current);

    head.appendChild(headText);

    const body = document.createElement("div");
    body.className = "app-menu-body";

    const homeHref = new URL("modules/gestion/solicitudes/listado-solicitudes.html", rootUrl).href;
    const homeLink = document.createElement("a");
    homeLink.className = "app-menu-home";
    homeLink.href = homeHref;
    homeLink.innerHTML = "<span>Inicio flujo</span><small>Solicitud de requerimiento</small>";
    homeLink.addEventListener("click", () => setOpen(false));
    body.appendChild(homeLink);

    let activeFound = false;

    MENU_TREE.forEach(group => {
      const groupItems = Array.isArray(group.items) ? group.items : [];

      if (group.path && groupItems.length === 0) {
        const directLink = document.createElement("a");
        directLink.className = "app-menu-link app-menu-link-direct";
        directLink.textContent = group.label;

        const href = new URL(group.path, rootUrl).href;
        directLink.href = href;

        if (normalizePath(href) === currentPath) {
          directLink.classList.add("is-active");
          current.textContent = "Pantalla actual: " + group.label;
          activeFound = true;
        }

        directLink.addEventListener("click", () => setOpen(false));
        body.appendChild(directLink);
        return;
      }

      const groupWrap = document.createElement("section");
      groupWrap.className = "app-menu-group";
      groupWrap.dataset.group = group.key;

      const groupBtn = document.createElement("button");
      groupBtn.type = "button";
      groupBtn.className = "app-menu-group-toggle";
      groupBtn.innerHTML =
        "<span>" + group.label + "</span>" +
        "<span class=\"app-menu-group-meta\">" +
        "<span>" + groupItems.length + " submodulos</span>" +
        "<span class=\"app-menu-group-caret\"></span>" +
        "</span>";
      groupBtn.setAttribute("aria-expanded", "false");

      const groupContent = document.createElement("div");
      groupContent.className = "app-menu-group-content";

      function syncGroupHeight() {
        if (groupWrap.classList.contains("is-open")) {
          groupContent.style.maxHeight = groupContent.scrollHeight + "px";
        }
      }

      groupItems.forEach(route => {
        const children = Array.isArray(route.children) ? route.children : [];

        if (children.length > 0) {
          const subgroup = document.createElement("div");
          subgroup.className = "app-menu-subgroup";

          const subBtn = document.createElement("button");
          subBtn.type = "button";
          subBtn.className = "app-menu-sub-toggle";
          subBtn.innerHTML =
            "<span>" + route.label + "</span>" +
            "<span class=\"app-menu-sub-caret\"></span>";
          subBtn.setAttribute("aria-expanded", "false");

          const subContent = document.createElement("div");
          subContent.className = "app-menu-sub-content";

          let subgroupHasActive = false;

          if (route.path) {
            const parentLink = document.createElement("a");
            parentLink.className = "app-menu-link app-menu-link-sub app-menu-link-sub-main";
            parentLink.textContent = route.pathLabel || route.label;
            const parentHref = new URL(route.path, rootUrl).href;
            parentLink.href = parentHref;

            if (normalizePath(parentHref) === currentPath) {
              parentLink.classList.add("is-active");
              current.textContent = "Pantalla actual: " + (route.pathLabel || route.label);
              activeFound = true;
              subgroupHasActive = true;
            }

            parentLink.addEventListener("click", () => setOpen(false));
            subContent.appendChild(parentLink);
          }

          children.forEach(child => {
            const link = document.createElement("a");
            link.className = "app-menu-link app-menu-link-sub";
            link.textContent = child.label;
            const href = new URL(child.path, rootUrl).href;
            link.href = href;

            if (normalizePath(href) === currentPath) {
              link.classList.add("is-active");
              current.textContent = "Pantalla actual: " + child.label;
              activeFound = true;
              subgroupHasActive = true;
            }

            link.addEventListener("click", () => setOpen(false));
            subContent.appendChild(link);
          });

          function setSubgroupOpen(value) {
            const openSub = Boolean(value);
            subgroup.classList.toggle("is-open", openSub);
            subBtn.setAttribute("aria-expanded", openSub ? "true" : "false");
            if (openSub) {
              subContent.style.maxHeight = "none";
              const alto = subContent.scrollHeight;
              subContent.style.maxHeight = alto + "px";
            } else {
              subContent.style.maxHeight = "0px";
            }
            requestAnimationFrame(syncGroupHeight);
          }

          subBtn.addEventListener("click", () => {
            const isOpen = subgroup.classList.contains("is-open");
            setSubgroupOpen(!isOpen);
          });

          subgroup.appendChild(subBtn);
          subgroup.appendChild(subContent);
          groupContent.appendChild(subgroup);

          if (subgroupHasActive) {
            setSubgroupOpen(true);
          }

          return;
        }

        const link = document.createElement("a");
        link.className = "app-menu-link";
        link.textContent = route.label;
        const href = new URL(route.path, rootUrl).href;
        link.href = href;

        if (normalizePath(href) === currentPath) {
          link.classList.add("is-active");
          current.textContent = "Pantalla actual: " + route.label;
          activeFound = true;
        }

        link.addEventListener("click", () => setOpen(false));
        groupContent.appendChild(link);
      });

      groupWrap.appendChild(groupBtn);
      groupWrap.appendChild(groupContent);
      body.appendChild(groupWrap);
    });

    if (normalizePath(homeHref) === currentPath) {
      homeLink.classList.add("is-active");
      current.textContent = "Pantalla actual: Inicio flujo";
      activeFound = true;
    }

    if (!activeFound) {
      current.textContent = "Pantalla actual: sin identificar";
    }

    drawer.appendChild(head);
    drawer.appendChild(body);

    document.body.appendChild(toggle);
    document.body.appendChild(overlay);
    document.body.appendChild(drawer);

    function setGroupOpen(groupElement, shouldOpen) {
      if (!groupElement) return;
      const content = groupElement.querySelector(".app-menu-group-content");
      const btn = groupElement.querySelector(".app-menu-group-toggle");
      const open = Boolean(shouldOpen);

      groupElement.classList.toggle("is-open", open);
      if (btn) btn.setAttribute("aria-expanded", open ? "true" : "false");
      if (content) {
        content.style.maxHeight = open ? content.scrollHeight + "px" : "0px";
      }
    }

    const groups = Array.from(body.querySelectorAll(".app-menu-group"));
    groups.forEach(group => {
      const btn = group.querySelector(".app-menu-group-toggle");
      if (!btn) return;
      btn.addEventListener("click", () => {
        const isOpen = group.classList.contains("is-open");
        setGroupOpen(group, !isOpen);
      });
    });

    // Menu desplegable: siempre colapsado por defecto.

    let open = false;
    function setOpen(value) {
      open = Boolean(value);
      if (open) {
        groups.forEach(group => setGroupOpen(group, false));
      }
      toggle.classList.toggle("is-open", open);
      overlay.classList.toggle("is-open", open);
      drawer.classList.toggle("is-open", open);
      document.body.classList.toggle("app-menu-open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      drawer.setAttribute("aria-hidden", open ? "false" : "true");
    }

    toggle.addEventListener("click", () => setOpen(!open));
    overlay.addEventListener("click", () => setOpen(false));
    window.addEventListener("keydown", event => {
      if (event.key === "Escape" && open) setOpen(false);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", buildShell);
  } else {
    buildShell();
  }
})();
