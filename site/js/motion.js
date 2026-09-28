(() => {
  const root = document.documentElement;
  if (!root.classList.contains("motion")) return;

  for (const group of document.querySelectorAll('[data-reveal="group"]')) {
    const beats = [];
    for (const child of group.children) {
      if (child.tagName === "UL") beats.push(...child.children);
      else beats.push(child);
    }
    beats.forEach((beat, i) => beat.style.setProperty("--i", i));
  }

  const show = (el) => {
    el.classList.add("is-in");
    reveal.unobserve(el);
    pending.delete(el);
  };

  const reveal = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        show(entry.target);
      }
    },
    { rootMargin: "0px 0px -12% 0px", threshold: 0.15 },
  );
  const pending = new Set(document.querySelectorAll("[data-reveal]"));
  for (const el of pending) reveal.observe(el);

  const header = document.querySelector(".site-header");
  const teas = [...document.querySelectorAll(".tea")];
  let queued = false;

  const paint = () => {
    queued = false;
    const y = window.scrollY;
    const vh = window.innerHeight;
    const max = root.scrollHeight - vh;
    root.style.setProperty("--progress", max > 0 ? Math.min(y / max, 1).toFixed(4) : "0");
    header?.classList.toggle("is-scrolled", y > 8);
    if (max - y < 4) for (const el of pending) show(el);

    for (const tea of teas) {
      const box = tea.getBoundingClientRect();
      if (box.bottom < -vh || box.top > vh * 2) continue;
      const offset = (box.top + box.height / 2 - vh / 2) / vh;
      tea.style.setProperty("--drift", Math.max(-1, Math.min(1, offset)).toFixed(3));
    }
  };

  const queue = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(paint);
  };

  window.addEventListener("scroll", queue, { passive: true });
  window.addEventListener("resize", queue);
  paint();
})();
