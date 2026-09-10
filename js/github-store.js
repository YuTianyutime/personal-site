(function () {
  "use strict";

  class GitHubStoreError extends Error {
    constructor(message, status, details) {
      super(message);
      this.name = "GitHubStoreError";
      this.status = status || 0;
      this.details = details || null;
    }
  }

  function bytesToBase64(bytes) {
    let binary = "";
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
    }
    return btoa(binary);
  }

  function utf8ToBase64(value) {
    return bytesToBase64(new TextEncoder().encode(value));
  }

  function base64ToUtf8(value) {
    const normalized = String(value || "").replace(/\s/g, "");
    const binary = atob(normalized);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return new TextDecoder().decode(bytes);
  }

  function friendlyError(error) {
    if (error instanceof GitHubStoreError) {
      if (error.status === 401) return "访问令牌无效或已经过期，请重新创建令牌。";
      if (error.status === 403) return "令牌没有写入权限，请确认 Contents 权限为 Read and write。";
      if (error.status === 404) return "没有找到仓库或无权访问，请检查用户名、仓库名和令牌权限。";
      if (error.status === 409 || error.status === 422) return "GitHub 上的内容刚刚发生变化，请点击“重新读取”后再保存。";
      return error.message;
    }
    return error?.message || "网络连接失败，请稍后重试。";
  }

  class GitHubStore {
    constructor(options) {
      this.owner = String(options.owner || "").trim();
      this.repo = String(options.repo || "").trim();
      this.branch = String(options.branch || "main").trim() || "main";
      this.token = String(options.token || "").trim();
    }

    get repoLabel() {
      return `${this.owner}/${this.repo}`;
    }

    encodePath(path) {
      return String(path)
        .replace(/^\/+/, "")
        .split("/")
        .map((part) => encodeURIComponent(part))
        .join("/");
    }

    contentUrl(path) {
      const suffix = path ? `/${this.encodePath(path)}` : "";
      return `https://api.github.com/repos/${encodeURIComponent(this.owner)}/${encodeURIComponent(this.repo)}/contents${suffix}?ref=${encodeURIComponent(this.branch)}`;
    }

    rawUrl(path, version) {
      const clean = String(path || "").replace(/^\/+/, "");
      const url = `https://raw.githubusercontent.com/${encodeURIComponent(this.owner)}/${encodeURIComponent(this.repo)}/${encodeURIComponent(this.branch)}/${this.encodePath(clean)}`;
      return version ? `${url}?v=${encodeURIComponent(version)}` : url;
    }

    async request(url, options = {}) {
      const response = await fetch(url, {
        ...options,
        cache: "no-store",
        headers: {
          "Accept": "application/vnd.github+json",
          "Authorization": `Bearer ${this.token}`,
          "X-GitHub-Api-Version": "2022-11-28",
          ...(options.headers || {})
        }
      });

      let payload = null;
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        payload = await response.json().catch(() => null);
      } else {
        payload = await response.text().catch(() => "");
      }

      if (!response.ok) {
        const message = payload?.message || `GitHub 请求失败（${response.status}）`;
        throw new GitHubStoreError(message, response.status, payload);
      }

      return payload;
    }

    async verify() {
      const url = `https://api.github.com/repos/${encodeURIComponent(this.owner)}/${encodeURIComponent(this.repo)}`;
      const repo = await this.request(url);
      if (!repo || repo.full_name?.toLowerCase() !== this.repoLabel.toLowerCase()) {
        throw new GitHubStoreError("仓库信息不正确。", 404);
      }
      if (repo.permissions && repo.permissions.push === false) {
        throw new GitHubStoreError("当前令牌没有写入此仓库的权限。", 403);
      }
      return repo;
    }

    async getFile(path) {
      let response;
      try {
        response = await this.request(this.contentUrl(path));
      } catch (error) {
        if (error instanceof GitHubStoreError && error.status === 404) return null;
        throw error;
      }

      if (!response || Array.isArray(response) || response.type !== "file") {
        throw new GitHubStoreError(`文件路径不正确：${path}`, 422);
      }

      if (response.encoding !== "base64" || typeof response.content !== "string") {
        throw new GitHubStoreError("这个文件太大，无法在浏览器中读取。", 413);
      }

      return {
        sha: response.sha,
        text: base64ToUtf8(response.content),
        size: response.size,
        downloadUrl: response.download_url
      };
    }

    async getJson(path) {
      const file = await this.getFile(path);
      if (!file) return null;
      try {
        return { data: JSON.parse(file.text), sha: file.sha, size: file.size };
      } catch (error) {
        throw new GitHubStoreError(`${path} 不是有效的 JSON 文件。`, 422, error);
      }
    }

    async putBase64(path, content, message, sha) {
      const body = {
        message,
        content,
        branch: this.branch
      };
      if (sha) body.sha = sha;

      return this.request(this.contentUrl(path), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
    }

    async putText(path, text, message, sha) {
      const result = await this.putBase64(path, utf8ToBase64(text), message, sha);
      return this.resultFile(result, path, text.length);
    }

    async putJson(path, value, message, sha) {
      return this.putText(path, `${JSON.stringify(value, null, 2)}\n`, message, sha);
    }

    async putBlob(path, blob, message) {
      const buffer = await blob.arrayBuffer();
      const result = await this.putBase64(path, bytesToBase64(new Uint8Array(buffer)), message, null);
      return this.resultFile(result, path, blob.size);
    }

    resultFile(result, path, size) {
      return {
        path,
        sha: result?.content?.sha || "",
        commitSha: result?.commit?.sha || "",
        commitUrl: result?.commit?.html_url || "",
        size
      };
    }
  }

  window.GitHubStore = GitHubStore;
  window.GitHubStoreError = GitHubStoreError;
  window.githubFriendlyError = friendlyError;
})();
