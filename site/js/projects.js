(() => {
  const dialog = document.getElementById("project-modal");
  if (!dialog) return;

  const panel = dialog.querySelector(".project-modal-panel");
  const gallery = dialog.querySelector(".project-modal-gallery");
  const copy = dialog.querySelector(".project-modal-copy");
  const title = dialog.querySelector("#project-modal-title");
  const motion = document.documentElement.classList.contains("motion");
  let lastFocus = null;

  const finishOpen = () => {
    if (!motion) return;
    dialog.classList.remove("is-closing");
    requestAnimationFrame(() => dialog.classList.add("is-open"));
  };

  const open = (panelId) => {
    const source = document.getElementById(panelId);
    if (!source || !gallery || !copy || !title) return;
    lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    title.textContent = source.querySelector(".project-detail-title")?.textContent?.trim() || "Project";
    gallery.innerHTML = source.querySelector(".project-detail-gallery")?.innerHTML || "";
    copy.innerHTML = source.querySelector(".project-detail-copy")?.innerHTML || "";
    dialog.classList.remove("is-open", "is-closing");
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    finishOpen();
    dialog.querySelector(".project-modal-close")?.focus();
  };

  const reset = () => {
    gallery.innerHTML = "";
    copy.innerHTML = "";
    title.textContent = "";
    dialog.classList.remove("is-open", "is-closing");
  };

  const close = () => {
    if (!dialog.open && !dialog.hasAttribute("open")) return;
    if (dialog.classList.contains("is-closing")) return;
    if (!motion) {
      if (dialog.open) dialog.close();
      else dialog.removeAttribute("open");
      return;
    }
    dialog.classList.add("is-closing");
    dialog.classList.remove("is-open");
    const target = panel ?? dialog;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      target.removeEventListener("transitionend", onEnd);
      if (dialog.open) dialog.close();
      else dialog.removeAttribute("open");
    };
    const onEnd = (event) => {
      if (event.target !== target || event.propertyName !== "opacity") return;
      finish();
    };
    target.addEventListener("transitionend", onEnd);
    window.setTimeout(finish, 700);
  };

  for (const button of document.querySelectorAll("[data-project-panel]")) {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const panelId = button.getAttribute("data-project-panel");
      if (panelId) open(panelId);
    });
  }

  dialog.addEventListener("click", (event) => {
    if (panel?.contains(event.target)) return;
    close();
  });

  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    close();
  });

  dialog.addEventListener("close", () => {
    reset();
    lastFocus?.focus();
    lastFocus = null;
  });

  dialog.querySelector(".project-modal-close")?.addEventListener("click", close);
})();
