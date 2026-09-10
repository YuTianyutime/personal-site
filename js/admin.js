(function () {
  "use strict";

  const DATA_PATH = "data/site.json";
  const LOCAL_SETTINGS_KEY = "yutianyu-site-settings-v1";
  const SESSION_SETTINGS_KEY = "yutianyu-site-session-v1";
  const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
  const MAX_IMAGE_SIDE = 2400;

  const DEFAULT_DATA = {
    name: "余天宇",
    role: "欢迎来到我的个人空间",
    tagline: "把生活里值得记住的瞬间，好好放在这里。",
    location: "中国",
    bio: "你好，我是余天宇。这里记录我的生活、兴趣与重要时刻。你可以通过照片墙认识我，也可以通过联系方式与我交流。",
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

  const FORM_FIELDS = {
    nameInput: "name",
    locationInput: "location",
    roleInput: "role",
    taglineInput: "tagline",
    aboutTitleInput: "aboutTitle",
    bioInput: "bio",
    galleryTitleInput: "galleryTitle",
    galleryIntroInput: "galleryIntro",
    accentInput: "accent",
    contactTitleInput: "contactTitle",
    emailInput: "email",
    phoneInput: "phone",
    wechatInput: "wechat",
    socialLabelInput: "socialLabel",
    socialUrlInput: "socialUrl"
  };

  const state = {
    store: null,
    siteSha: null,
    data: normalizeData(DEFAULT_DATA),
    dirty: false,
    busy: false,
    connected: false
  };

  const byId = (id) => document.getElementById(id);
  let toastTimer = 0;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function createId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `photo-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function normalizeData(value) {
    const source = value && typeof value === "object" ? value : {};
    const data = { ...clone(DEFAULT_DATA), ...source };
    data.gallery = Array.isArray(source.gallery)
      ? source.gallery
          .filter((item) => item && item.src)
          .map((item, index) => ({
            id: item.id || `photo-${index}-${Math.random().toString(36).slice(2, 7)}`,
            src: String(item.src || ""),
            title: String(item.title || ""),
            caption: String(item.caption || ""),
            alt: String(item.alt || ""),
            shape: ["auto", "portrait", "square", "landscape", "wide"].includes(item.shape) ? item.shape : "auto"
          }))
      : [];
    return data;
  }

  function firstCharacter(value) {
    return Array.from(String(value || "余").trim())[0] || "余";
  }

  function showToast(message) {
    const toast = byId("adminToast");
    if (!toast) return;
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.hidden = false;
    toastTimer = window.setTimeout(() => {
      toast.hidden = true;
    }, 2800);
  }

  function setMessage(element, message, type = "") {
    if (!element) return;
    element.textContent = message || "";
    element.classList.toggle("is-error", type === "error");
    element.classList.toggle("is-success", type === "success");
  }

  function setButtonBusy(button, busy, label) {
    if (!button) return;
    button.disabled = busy;
    button.classList.toggle("is-loading", busy);
    if (label) {
      const span = button.querySelector("span");
      if (span) {
        span.textContent = label;
      } else {
        const textNode = Array.from(button.childNodes).find((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
        if (textNode) textNode.textContent = label;
      }
    }
  }

  function markDirty() {
    state.dirty = true;
    updateSaveUi();
  }

  function updateSaveUi(detail = "") {
    const saveButton = byId("saveButton");
    const stateText = byId("saveStateText");
    const detailText = byId("saveStateDetail");
    if (saveButton) saveButton.disabled = !state.dirty || state.busy || !state.connected;
    if (stateText) stateText.textContent = state.dirty ? "有尚未保存的修改" : "没有未保存的修改";
    if (detailText && detail) detailText.textContent = detail;
  }

  function storageAvailable(storage) {
    try {
      const key = "__test__";
      storage.setItem(key, key);
      storage.removeItem(key);
      return true;
    } catch (_error) {
      return false;
    }
  }

  function readStoredSettings() {
    let local = {};
    let session = {};
    try {
      local = JSON.parse(localStorage.getItem(LOCAL_SETTINGS_KEY) || "{}");
    } catch (_error) {
      local = {};
    }
    try {
      session = JSON.parse(sessionStorage.getItem(SESSION_SETTINGS_KEY) || "{}");
    } catch (_error) {
      session = {};
    }
    return { local, session };
  }

  function writeStoredSettings(settings) {
    const base = {
      owner: settings.owner,
      repo: settings.repo,
      branch: settings.branch
    };

    try {
      if (settings.remember && storageAvailable(localStorage)) {
        localStorage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify({ ...base, token: settings.token, remember: true }));
        sessionStorage.removeItem(SESSION_SETTINGS_KEY);
      } else {
        localStorage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify({ ...base, remember: false }));
        sessionStorage.setItem(SESSION_SETTINGS_KEY, JSON.stringify({ ...base, token: settings.token }));
      }
    } catch (error) {
      console.warn("无法保存连接设置。", error);
    }
  }

  function clearStoredSettings() {
    try {
      localStorage.removeItem(LOCAL_SETTINGS_KEY);
      sessionStorage.removeItem(SESSION_SETTINGS_KEY);
    } catch (_error) {
      // Storage may be unavailable in private browsing.
    }
  }

  function deriveGitHubSettings() {
    const host = window.location.hostname;
    if (!host.endsWith(".github.io")) return null;
    const owner = host.split(".")[0];
    const parts = window.location.pathname.split("/").filter(Boolean);
    const repo = parts.length ? parts[0] : `${owner}.github.io`;
    return { owner, repo, branch: "main" };
  }

  function populateConnectionSettings() {
    const stored = readStoredSettings();
    const derived = deriveGitHubSettings();
    const settings = {
      ...(derived || {}),
      ...(stored.local || {}),
      ...(stored.session || {})
    };

    byId("ownerInput").value = settings.owner || "";
    byId("repoInput").value = settings.repo || "";
    byId("branchInput").value = settings.branch || "main";
    byId("rememberTokenInput").checked = Boolean(stored.local?.remember);
    byId("tokenInput").value = stored.local?.remember
      ? (stored.local.token || "")
      : (stored.session.token || "");

    return settings;
  }

  function connectionValues() {
    return {
      owner: byId("ownerInput").value.trim(),
      repo: byId("repoInput").value.trim(),
      branch: byId("branchInput").value.trim() || "main",
      token: byId("tokenInput").value.trim(),
      remember: byId("rememberTokenInput").checked
    };
  }

  function showConnectionPanel() {
    state.connected = false;
    byId("connectionPanel").hidden = false;
    byId("editorShell").hidden = true;
    byId("topDisconnectButton").hidden = true;
    byId("adminRepoLabel").textContent = "尚未连接";
    updateSaveUi();
  }

  function showEditor() {
    state.connected = true;
    byId("connectionPanel").hidden = true;
    byId("editorShell").hidden = false;
    byId("topDisconnectButton").hidden = false;
    byId("adminRepoLabel").textContent = state.store.repoLabel;
    byId("settingsRepoText").textContent = `${state.store.repoLabel} · ${state.store.branch}`;
    byId("connectionStatus").textContent = "已连接";
    updateSaveUi();
  }

  async function connect(event, options = {}) {
    event?.preventDefault();
    const values = connectionValues();
    const message = byId("connectionMessage");
    const button = byId("connectButton");

    if (!values.owner || !values.repo || !values.token) {
      setMessage(message, "请填写用户名、仓库名和访问令牌。", "error");
      return;
    }

    if (!window.GitHubStore || !window.githubFriendlyError) {
      setMessage(message, "管理组件加载失败，请刷新页面后重试。", "error");
      return;
    }

    state.busy = true;
    setButtonBusy(button, true, "正在连接");
    setMessage(message, "正在检查仓库权限并读取内容…");

    try {
      const store = new window.GitHubStore(values);
      await store.verify();
      const file = await store.getJson(DATA_PATH);

      state.store = store;
      state.siteSha = file?.sha || null;
      state.data = normalizeData(file?.data || DEFAULT_DATA);
      state.dirty = false;
      writeStoredSettings(values);
      fillEditor();
      showEditor();
      setMessage(message, "连接成功。", "success");
      if (!options.silent) showToast("已连接，可以开始编辑");
    } catch (error) {
      state.store = null;
      state.connected = false;
      showConnectionPanel();
      setMessage(message, window.githubFriendlyError(error), "error");
      if (options.silent) {
        byId("connectionPanel").scrollIntoView({ behavior: "smooth", block: "start" });
      }
    } finally {
      state.busy = false;
      setButtonBusy(button, false, "连接并读取网页");
      updateSaveUi();
    }
  }

  function fillEditor() {
    state.data = normalizeData(state.data);
    Object.entries(FORM_FIELDS).forEach(([id, key]) => {
      const element = byId(id);
      if (element) element.value = state.data[key] || "";
    });
    const accent = /^#[0-9a-f]{6}$/i.test(state.data.accent) ? state.data.accent : DEFAULT_DATA.accent;
    byId("accentInput").value = accent;
    byId("accentOutput").textContent = accent.toUpperCase();
    byId("adminBrandMark").textContent = firstCharacter(state.data.name);
    renderAvatarPreview();
    renderGalleryAdmin();
    state.dirty = false;
    updateSaveUi();
  }

  function readEditor() {
    const result = clone(state.data);
    Object.entries(FORM_FIELDS).forEach(([id, key]) => {
      const element = byId(id);
      if (element) result[key] = element.value.trim();
    });
    result.accent = /^#[0-9a-f]{6}$/i.test(result.accent) ? result.accent : DEFAULT_DATA.accent;
    result.gallery = Array.from(byId("galleryAdminList").querySelectorAll(".gallery-admin-item")).map((article) => {
      const item = state.data.gallery.find((entry) => entry.id === article.dataset.id) || {};
      return {
        id: article.dataset.id || item.id || createId(),
        src: item.src || "",
        title: article.querySelector('[data-field="title"]').value.trim(),
        caption: article.querySelector('[data-field="caption"]').value.trim(),
        alt: article.querySelector('[data-field="alt"]').value.trim(),
        shape: article.querySelector('[data-field="shape"]').value
      };
    });
    return normalizeData(result);
  }

  function validateData(data) {
    if (!data.name) return "请填写姓名。";
    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return "电子邮箱格式不正确。";
    if (data.socialUrl) {
      try {
        const url = new URL(data.socialUrl);
        if (!["http:", "https:"].includes(url.protocol)) return "其他链接需要使用 http 或 https 地址。";
      } catch (_error) {
        return "其他链接网址格式不正确。";
      }
    }
    return "";
  }

  async function saveEditor() {
    if (!state.store || state.busy) return;
    const nextData = readEditor();
    const validationError = validateData(nextData);
    if (validationError) {
      showToast(validationError);
      return;
    }

    state.busy = true;
    setButtonBusy(byId("saveButton"), true, "正在保存");
    updateSaveUi("正在提交到 GitHub…");

    try {
      nextData.updatedAt = new Date().toISOString();
      const result = await state.store.putJson(
        DATA_PATH,
        nextData,
        `更新个人主页内容 · ${nextData.name}`
      );
      state.data = nextData;
      state.siteSha = result.sha;
      state.dirty = false;
      byId("lastSavedLabel").textContent = `已保存 ${new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`;
      updateSaveUi("公开主页通常会在 1–3 分钟内更新");
      showToast("保存成功，网站正在更新");
    } catch (error) {
      updateSaveUi("保存失败，修改仍保留在当前页面");
      showToast(window.githubFriendlyError(error));
    } finally {
      state.busy = false;
      setButtonBusy(byId("saveButton"), false, "保存到网站");
      updateSaveUi();
    }
  }

  function decodeImage(file) {
    if (window.createImageBitmap) {
      try {
        return window.createImageBitmap(file, { imageOrientation: "from-image" }).catch(() => decodeWithElement(file));
      } catch (_error) {
        return decodeWithElement(file);
      }
    }
    return decodeWithElement(file);
  }

  function decodeWithElement(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("无法读取这张图片，请改用 JPG、PNG 或 WebP 格式。"));
      };
      image.src = url;
    });
  }

  function canvasToBlob(canvas, type, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("图片压缩失败，请换一张图片重试。"));
      }, type, quality);
    });
  }

  async function prepareImage(file) {
    if (!file || !file.type.startsWith("image/")) {
      throw new Error("请选择图片文件。");
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new Error("原图超过 25MB，请先在手机相册中裁剪或缩小。");
    }

    const source = await decodeImage(file);
    const sourceWidth = source.width;
    const sourceHeight = source.height;
    if (!sourceWidth || !sourceHeight) throw new Error("图片尺寸无效。");

    const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(sourceWidth, sourceHeight));
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: true });
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(source, 0, 0, width, height);
    if (typeof source.close === "function") source.close();

    let blob = await canvasToBlob(canvas, "image/webp", 0.86);
    let extension = "webp";
    if (!blob.type.includes("webp")) {
      blob = await canvasToBlob(canvas, "image/jpeg", 0.88);
      extension = "jpg";
    }

    return { blob, extension, width, height };
  }

  function uploadPath(extension) {
    const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
    const random = Math.random().toString(36).slice(2, 7);
    return `assets/uploads/photo-${stamp}-${random}.${extension}`;
  }

  async function uploadImage(file, progressElement) {
    if (!state.store) throw new Error("请先连接 GitHub 仓库。");
    if (progressElement) progressElement.hidden = false;
    try {
      const prepared = await prepareImage(file);
      const path = uploadPath(prepared.extension);
      await state.store.putBlob(path, prepared.blob, `上传个人主页照片 · ${file.name || path}`);
      return path;
    } finally {
      if (progressElement) progressElement.hidden = true;
    }
  }

  function adminAssetUrl(path, version) {
    if (!path) return "";
    if (state.store) return state.store.rawUrl(path, version);
    return new URL(path.replace(/^\.\//, ""), document.baseURI).href + (version ? `?v=${version}` : "");
  }

  function renderAvatarPreview() {
    const image = byId("avatarPreviewImage");
    const fallback = byId("avatarPreviewFallback");
    fallback.textContent = firstCharacter(byId("nameInput").value || state.data.name);
    if (!state.data.avatar) {
      image.hidden = true;
      image.removeAttribute("src");
      fallback.hidden = false;
      return;
    }
    image.src = adminAssetUrl(state.data.avatar, Date.now());
    image.onload = () => {
      image.hidden = false;
      fallback.hidden = true;
    };
    image.onerror = () => {
      image.hidden = true;
      fallback.hidden = false;
    };
  }

  async function handleAvatarUpload(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !state.store) return;
    const progress = byId("avatarUploadProgress");
    try {
      showToast("正在压缩并上传头像…");
      const path = await uploadImage(file, progress);
      state.data.avatar = path;
      renderAvatarPreview();
      markDirty();
      showToast("头像已上传，请点击“保存到网站”");
    } catch (error) {
      showToast(error.message || "头像上传失败。");
    }
  }

  function removeAvatar() {
    if (!state.data.avatar) return;
    state.data.avatar = "";
    renderAvatarPreview();
    markDirty();
  }

  function renderGalleryAdmin() {
    const list = byId("galleryAdminList");
    const empty = byId("galleryAdminEmpty");
    const template = byId("galleryItemTemplate");
    list.replaceChildren();

    if (!state.data.gallery.length) {
      empty.hidden = false;
      return;
    }

    empty.hidden = true;
    state.data.gallery.forEach((item, index) => {
      const fragment = template.content.cloneNode(true);
      const article = fragment.querySelector(".gallery-admin-item");
      article.dataset.id = item.id;
      fragment.querySelector(".gallery-index").textContent = String(index + 1).padStart(2, "0");

      const image = fragment.querySelector("img");
      image.src = adminAssetUrl(item.src, state.data.updatedAt || Date.now());
      image.alt = item.alt || item.title || "待编辑照片";
      image.addEventListener("error", () => {
        image.src = "./assets/placeholders/image.svg";
      }, { once: true });

      fragment.querySelector('[data-field="title"]').value = item.title || "";
      fragment.querySelector('[data-field="caption"]').value = item.caption || "";
      fragment.querySelector('[data-field="alt"]').value = item.alt || "";
      fragment.querySelector('[data-field="shape"]').value = item.shape || "auto";
      list.append(fragment);
    });
  }

  function syncGalleryItemFromDom(id) {
    const article = byId("galleryAdminList").querySelector(`[data-id="${CSS.escape(id)}"]`);
    const item = state.data.gallery.find((entry) => entry.id === id);
    if (!article || !item) return;
    item.title = article.querySelector('[data-field="title"]').value.trim();
    item.caption = article.querySelector('[data-field="caption"]').value.trim();
    item.alt = article.querySelector('[data-field="alt"]').value.trim();
    item.shape = article.querySelector('[data-field="shape"]').value;
  }

  async function addGalleryFiles(files) {
    if (!state.store || !files.length) return;
    let added = 0;
    for (const file of files) {
      try {
        showToast(`正在上传第 ${added + 1} 张，共 ${files.length} 张…`);
        const path = await uploadImage(file, null);
        state.data.gallery.push({
          id: createId(),
          src: path,
          title: "",
          caption: "",
          alt: file.name.replace(/\.[^.]+$/, ""),
          shape: "auto"
        });
        added += 1;
      } catch (error) {
        showToast(error.message || `${file.name} 上传失败。`);
      }
    }
    if (added) {
      renderGalleryAdmin();
      markDirty();
      showToast(`已上传 ${added} 张照片，请填写说明并保存`);
    }
  }

  async function replaceGalleryImage(id, file) {
    const item = state.data.gallery.find((entry) => entry.id === id);
    if (!item || !file || !state.store) return;
    const article = byId("galleryAdminList").querySelector(`[data-id="${CSS.escape(id)}"]`);
    const progress = article?.querySelector(".item-upload-progress");
    try {
      showToast("正在上传替换照片…");
      const path = await uploadImage(file, progress);
      item.src = path;
      const image = article?.querySelector("img");
      if (image) image.src = adminAssetUrl(path, Date.now());
      markDirty();
      showToast("照片已替换，请点击“保存到网站”");
    } catch (error) {
      showToast(error.message || "替换照片失败。");
    }
  }

  function moveGalleryItem(id, direction) {
    const index = state.data.gallery.findIndex((item) => item.id === id);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= state.data.gallery.length) return;
    const [item] = state.data.gallery.splice(index, 1);
    state.data.gallery.splice(nextIndex, 0, item);
    renderGalleryAdmin();
    markDirty();
  }

  function deleteGalleryItem(id) {
    const item = state.data.gallery.find((entry) => entry.id === id);
    if (!item) return;
    if (!window.confirm("确定删除这张照片吗？保存后照片会从公开主页移除。")) return;
    state.data.gallery = state.data.gallery.filter((entry) => entry.id !== id);
    renderGalleryAdmin();
    markDirty();
  }

  function bindEditor() {
    byId("editorForm").addEventListener("input", (event) => {
      const target = event.target;
      if (target.type === "file") return;
      if (target.closest(".gallery-admin-item")) {
        const id = target.closest(".gallery-admin-item").dataset.id;
        syncGalleryItemFromDom(id);
      } else if (target.id === "nameInput") {
        renderAvatarPreview();
        byId("adminBrandMark").textContent = firstCharacter(target.value);
      } else if (target.id === "accentInput") {
        byId("accentOutput").textContent = target.value.toUpperCase();
      }
      markDirty();
    });

    byId("editorForm").addEventListener("change", (event) => {
      if (event.target.matches('[data-action="replace"]')) {
        const id = event.target.closest(".gallery-admin-item")?.dataset.id;
        const file = event.target.files?.[0];
        event.target.value = "";
        if (id && file) replaceGalleryImage(id, file);
      }
    });

    byId("galleryAdminList").addEventListener("click", (event) => {
      const button = event.target.closest("[data-action]");
      if (!button || button.tagName === "INPUT") return;
      const id = button.closest(".gallery-admin-item")?.dataset.id;
      if (!id) return;
      if (button.dataset.action === "up") moveGalleryItem(id, -1);
      if (button.dataset.action === "down") moveGalleryItem(id, 1);
      if (button.dataset.action === "delete") deleteGalleryItem(id);
    });

    byId("avatarFileInput").addEventListener("change", handleAvatarUpload);
    byId("removeAvatarButton").addEventListener("click", removeAvatar);
    byId("galleryFileInput").addEventListener("change", (event) => {
      const files = Array.from(event.target.files || []);
      event.target.value = "";
      addGalleryFiles(files);
    });
    byId("connectionForm").addEventListener("submit", connect);
    byId("saveButton").addEventListener("click", saveEditor);

    document.querySelectorAll(".editor-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        document.querySelectorAll(".editor-tab").forEach((item) => item.classList.toggle("is-active", item === tab));
        document.querySelectorAll(".editor-panel").forEach((panel) => {
          panel.classList.toggle("is-active", panel.dataset.panel === tab.dataset.tab);
        });
      });
    });
  }

  async function refreshEditor() {
    if (!state.store) return;
    if (state.dirty && !window.confirm("重新读取会丢失当前未保存的修改，确定继续吗？")) return;
    state.busy = true;
    updateSaveUi("正在从 GitHub 读取…");
    try {
      const file = await state.store.getJson(DATA_PATH);
      state.siteSha = file?.sha || null;
      state.data = normalizeData(file?.data || DEFAULT_DATA);
      fillEditor();
      showToast("已重新读取网站内容");
    } catch (error) {
      showToast(window.githubFriendlyError(error));
    } finally {
      state.busy = false;
      updateSaveUi();
    }
  }

  function exportBackup() {
    const data = readEditor();
    const blob = new Blob([`${JSON.stringify(data, null, 2)}\n`], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `余天宇个人主页备份-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function importBackup(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("文件内容不是有效的网页数据。");
      state.data = normalizeData(parsed);
      fillEditor();
      markDirty();
      showToast("备份已导入，请检查后保存");
    } catch (error) {
      showToast(error.message || "无法读取这个备份文件。");
    }
  }

  function disconnect() {
    if (state.dirty && !window.confirm("还有未保存的修改，确定退出吗？")) return;
    clearStoredSettings();
    state.store = null;
    state.siteSha = null;
    state.data = normalizeData(DEFAULT_DATA);
    state.dirty = false;
    state.busy = false;
    byId("tokenInput").value = "";
    byId("rememberTokenInput").checked = false;
    byId("lastSavedLabel").textContent = "尚未修改";
    showConnectionPanel();
    setMessage(byId("connectionMessage"), "已断开连接。", "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function bindSettings() {
    byId("refreshButton").addEventListener("click", refreshEditor);
    byId("exportButton").addEventListener("click", exportBackup);
    byId("importFileInput").addEventListener("change", importBackup);
    byId("disconnectButton").addEventListener("click", disconnect);
    byId("topDisconnectButton").addEventListener("click", disconnect);
    byId("changeRepoButton").addEventListener("click", () => {
      showConnectionPanel();
      byId("connectionPanel").scrollIntoView({ behavior: "smooth", block: "start" });
    });

    window.addEventListener("beforeunload", (event) => {
      if (!state.dirty) return;
      event.preventDefault();
      event.returnValue = "";
    });
  }

  async function init() {
    bindEditor();
    bindSettings();
    const settings = populateConnectionSettings();
    if (settings.owner && settings.repo && settings.token) {
      await connect(null, { silent: true });
    }
  }

  init();
})();
