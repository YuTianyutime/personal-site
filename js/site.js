(function () {
  "use strict";

  const DEFAULT_DATA = {
    name: "余天宇",
    role: "欢迎来到我的个人空间",
    tagline: "把生活里值得记住的瞬间，好好放在这里。",
    location: "中国",
    bio: "你好，我是余天宇。这里记录我的生活、兴趣与重要时刻。",
    avatar: "",
    email: "",
    phone: "",
    wechat: "",
    socialLabel: "",
    socialUrl: "",
    galleryTitle: "我的影像",
    galleryIntro: "照片会陆续更新，记录那些值得留住的画面。",
    aboutTitle: "关于我",
    contactTitle: "联系我",
    accent: "#ad563b",
    gallery: [],
    updatedAt: ""
  };

  let data = { ...DEFAULT_DATA, gallery: [] };
  let activeGalleryIndex = 0;
  let toastTimer = 0;
  let scrollTicking = false;

  const byId = (id) => document.getElementById(id);

  function setText(id, value, fallback = "") {
    const element = byId(id);
    if (element) element.textContent = value || fallback;
  }

  function firstCharacter(value) {
    return Array.from(String(value || "余").trim())[0] || "余";
  }

  function validColor(value) {
    return /^#[0-9a-f]{6}$/i.test(value || "");
  }

  function hexToRgb(hex) {
    const value = hex.replace("#", "");
    return [
      parseInt(value.slice(0, 2), 16),
      parseInt(value.slice(2, 4), 16),
      parseInt(value.slice(4, 6), 16)
    ].join(", ");
  }

  function safeWebUrl(value) {
    if (!value) return "";
    try {
      const url = new URL(value, window.location.href);
      return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch (_error) {
      return "";
    }
  }

  function assetUrl(path, version) {
    if (!path) return "";
    if (/^(https?:)?\/\//i.test(path)) return path;
    const clean = String(path).replace(/^\.\//, "");
    return new URL(clean, document.baseURI).href + (version ? `?v=${encodeURIComponent(version)}` : "");
  }

  function showToast(message) {
    const toast = byId("toast");
    if (!toast) return;
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.hidden = false;
    toastTimer = window.setTimeout(() => {
      toast.hidden = true;
    }, 2400);
  }

  async function copyText(value, successMessage) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(value);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = value;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        textarea.remove();
      }
      showToast(successMessage);
    } catch (_error) {
      showToast("复制失败，请长按内容复制");
    }
  }

  async function loadData() {
    try {
      const response = await fetch("./data/site.json", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const loaded = await response.json();
      data = {
        ...DEFAULT_DATA,
        ...loaded,
        gallery: Array.isArray(loaded.gallery) ? loaded.gallery : []
      };
    } catch (error) {
      console.warn("无法读取网站数据，将使用默认内容。", error);
    }
  }

  function renderIdentity() {
    const name = data.name || DEFAULT_DATA.name;
    const mark = firstCharacter(name);

    document.title = `${name}｜个人主页`;
    setText("brandMark", mark);
    setText("brandName", name);
    setText("heroName", name);
    setText("heroRole", data.role, DEFAULT_DATA.role);
    setText("heroTagline", data.tagline, DEFAULT_DATA.tagline);
    setText("heroLocation", `⌖ ${data.location || DEFAULT_DATA.location}`);
    setText("aboutTitle", data.aboutTitle, DEFAULT_DATA.aboutTitle);
    setText("aboutLead", `你好，我是${name}。`);
    setText("bioText", data.bio, DEFAULT_DATA.bio);
    setText("aboutLocation", data.location, DEFAULT_DATA.location);
    setText("galleryTitle", data.galleryTitle, DEFAULT_DATA.galleryTitle);
    setText("galleryIntro", data.galleryIntro, DEFAULT_DATA.galleryIntro);
    setText("contactTitle", data.contactTitle, DEFAULT_DATA.contactTitle);
    setText("footerName", name);
    setText("avatarFallback", mark);

    const metaDescription = byId("metaDescription");
    if (metaDescription) {
      metaDescription.setAttribute("content", `${name}的个人主页。${data.tagline || ""}`.trim());
    }

    const ogTitle = document.querySelector('meta[property="og:title"]');
    const ogDescription = document.querySelector('meta[property="og:description"]');
    if (ogTitle) ogTitle.setAttribute("content", `${name}｜个人主页`);
    if (ogDescription) ogDescription.setAttribute("content", data.tagline || DEFAULT_DATA.tagline);

    if (validColor(data.accent)) {
      document.documentElement.style.setProperty("--accent", data.accent);
      document.documentElement.style.setProperty("--accent-rgb", hexToRgb(data.accent));
      document.querySelector('meta[name="theme-color"]')?.setAttribute("content", data.accent);
    }
  }

  function renderAvatar() {
    const image = byId("avatarImage");
    const fallback = byId("avatarFallback");
    if (!image || !fallback) return;

    if (!data.avatar) {
      image.hidden = true;
      fallback.hidden = false;
      return;
    }

    image.alt = `${data.name || DEFAULT_DATA.name}的个人照片`;
    image.src = assetUrl(data.avatar, data.updatedAt);
    image.onload = () => {
      image.hidden = false;
      fallback.hidden = true;
    };
    image.onerror = () => {
      image.hidden = true;
      fallback.hidden = false;
    };
  }

  function renderGallery() {
    const grid = byId("galleryGrid");
    const empty = byId("galleryEmpty");
    if (!grid || !empty) return;

    const items = data.gallery.filter((item) => item && item.src);
    grid.replaceChildren();

    if (!items.length) {
      empty.hidden = false;
      return;
    }

    empty.hidden = true;

    items.forEach((item, index) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = `gallery-card is-${["portrait", "square", "landscape", "wide"].includes(item.shape) ? item.shape : "auto"}`;
      card.style.animationDelay = `${Math.min(index * 55, 330)}ms`;
      card.setAttribute("aria-label", `查看大图：${item.title || item.caption || `照片 ${index + 1}`}`);

      const image = document.createElement("img");
      image.loading = "lazy";
      image.decoding = "async";
      image.src = assetUrl(item.src, data.updatedAt);
      image.alt = item.alt || item.title || `${data.name || "余天宇"}的照片`;
      image.addEventListener("error", () => {
        image.src = "./assets/placeholders/image.svg";
        image.alt = "照片暂时无法显示";
      }, { once: true });

      const caption = document.createElement("span");
      caption.className = "gallery-card-caption";
      const title = document.createElement("strong");
      title.textContent = item.title || item.caption || `照片 ${index + 1}`;
      const description = document.createElement("span");
      description.textContent = item.caption && item.caption !== title.textContent ? item.caption : "";
      caption.append(title);
      if (description.textContent) caption.append(description);

      card.append(image, caption);
      card.addEventListener("click", () => openLightbox(index));
      grid.append(card);
    });
  }

  function renderContact() {
    const list = byId("contactList");
    if (!list) return;
    list.replaceChildren();

    const entries = [];

    if (data.email) {
      entries.push({
        kind: "link",
        href: `mailto:${data.email}`,
        icon: "邮",
        label: "电子邮箱",
        value: data.email
      });
    }

    if (data.phone) {
      entries.push({
        kind: "link",
        href: `tel:${String(data.phone).replace(/\s+/g, "")}`,
        icon: "电",
        label: "电话",
        value: data.phone
      });
    }

    if (data.wechat) {
      entries.push({
        kind: "button",
        icon: "微",
        label: "微信（点击复制）",
        value: data.wechat,
        copy: data.wechat
      });
    }

    const socialUrl = safeWebUrl(data.socialUrl);
    if (socialUrl) {
      entries.push({
        kind: "link",
        href: socialUrl,
        external: true,
        icon: "链",
        label: data.socialLabel || "个人链接",
        value: socialUrl.replace(/^https?:\/\//, "")
      });
    }

    if (!entries.length) {
      const empty = document.createElement("div");
      empty.className = "contact-empty";
      empty.textContent = "联系方式正在整理中，之后会在这里补充。";
      list.append(empty);
      return;
    }

    entries.forEach((entry) => {
      const element = document.createElement(entry.kind === "button" ? "button" : "a");
      element.className = "contact-item";
      if (entry.kind === "button") {
        element.type = "button";
        element.addEventListener("click", () => copyText(entry.copy, "微信号已复制"));
      } else {
        element.href = entry.href;
        if (entry.external) {
          element.target = "_blank";
          element.rel = "noopener noreferrer";
        }
      }

      const icon = document.createElement("span");
      icon.className = "contact-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = entry.icon;

      const content = document.createElement("span");
      content.className = "contact-content";
      const label = document.createElement("span");
      label.textContent = entry.label;
      const value = document.createElement("strong");
      value.textContent = entry.value;
      content.append(label, value);
      element.append(icon, content);
      list.append(element);
    });
  }

  function openLightbox(index) {
    const items = data.gallery.filter((item) => item && item.src);
    if (!items.length) return;
    activeGalleryIndex = (index + items.length) % items.length;
    const image = byId("lightboxImage");
    const caption = byId("lightboxCaption");
    const dialog = byId("lightbox");
    if (!image || !caption || !dialog) return;

    const item = items[activeGalleryIndex];
    image.src = assetUrl(item.src, data.updatedAt);
    image.alt = item.alt || item.title || "照片大图";
    caption.textContent = [item.title, item.caption].filter(Boolean).filter((value, i, values) => values.indexOf(value) === i).join(" · ");
    if (!dialog.open) dialog.showModal();
    document.body.classList.add("lightbox-open");
  }

  function closeLightbox() {
    const dialog = byId("lightbox");
    if (dialog?.open) dialog.close();
    document.body.classList.remove("lightbox-open");
  }

  function stepLightbox(direction) {
    const count = data.gallery.filter((item) => item && item.src).length;
    if (!count) return;
    openLightbox(activeGalleryIndex + direction);
  }

  function bindLightbox() {
    byId("lightboxClose")?.addEventListener("click", closeLightbox);
    byId("lightboxPrev")?.addEventListener("click", () => stepLightbox(-1));
    byId("lightboxNext")?.addEventListener("click", () => stepLightbox(1));
    const dialog = byId("lightbox");
    dialog?.addEventListener("click", (event) => {
      if (event.target === dialog) closeLightbox();
    });
    dialog?.addEventListener("close", () => document.body.classList.remove("lightbox-open"));
    document.addEventListener("keydown", (event) => {
      if (!dialog?.open) return;
      if (event.key === "ArrowLeft") stepLightbox(-1);
      if (event.key === "ArrowRight") stepLightbox(1);
      if (event.key === "Escape") closeLightbox();
    });

    let touchStartX = null;
    dialog?.addEventListener("touchstart", (event) => {
      touchStartX = event.changedTouches[0]?.clientX ?? null;
    }, { passive: true });
    dialog?.addEventListener("touchend", (event) => {
      if (touchStartX === null) return;
      const distance = (event.changedTouches[0]?.clientX ?? touchStartX) - touchStartX;
      if (Math.abs(distance) > 55) stepLightbox(distance > 0 ? -1 : 1);
      touchStartX = null;
    }, { passive: true });
  }

  async function sharePage() {
    const shareData = {
      title: `${data.name || DEFAULT_DATA.name}｜个人主页`,
      text: data.tagline || DEFAULT_DATA.tagline,
      url: window.location.href
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await copyText(window.location.href, "主页链接已复制");
      }
    } catch (error) {
      if (error?.name !== "AbortError") showToast("暂时无法分享，请复制浏览器地址");
    }
  }

  function bindInteractions() {
    byId("shareButton")?.addEventListener("click", sharePage);
    byId("currentYear").textContent = new Date().getFullYear();

    const updateTopbar = () => {
      byId("topbar")?.classList.toggle("is-scrolled", window.scrollY > 42);
      scrollTicking = false;
    };

    window.addEventListener("scroll", () => {
      if (scrollTicking) return;
      scrollTicking = true;
      window.requestAnimationFrame(updateTopbar);
    }, { passive: true });
    updateTopbar();
  }

  function revealSections() {
    const sections = document.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window)) {
      sections.forEach((section) => section.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12 });

    sections.forEach((section) => observer.observe(section));
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    if (!["https:", "http:"].includes(window.location.protocol)) return;
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch((error) => {
        console.warn("离线支持注册失败。", error);
      });
    });
  }

  async function init() {
    bindInteractions();
    bindLightbox();
    await loadData();
    renderIdentity();
    renderAvatar();
    renderGallery();
    renderContact();
    revealSections();
    registerServiceWorker();
  }

  init();
})();
