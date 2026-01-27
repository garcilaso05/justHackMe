export class VirtualFileSystem {
  constructor() {
    this.root = { type: "dir", children: {} };
  }

  load(fsDefinition) {
    this.root = fsDefinition.root || { type: "dir", children: {} };
  }

  list(path) {
    const node = this.resolvePath(path);
    if (!node || node.type !== "dir") {
      return ["Error: directorio no encontrado"];
    }
    return Object.keys(node.children || {});
  }

  read(path, fileName, password = null) {
    const dir = this.resolvePath(path);
    if (!dir || dir.type !== "dir") {
      return "Error: directorio no encontrado";
    }
    const file = dir.children?.[fileName];
    if (!file || file.type !== "file") {
      return "Error: archivo no encontrado";
    }
    if (file.protected) {
      if (!password || password !== file.password) {
        return "Error: contraseña incorrecta";
      }
    }
    return file.content ?? "";
  }

  changeDir(currentPath, target) {
    if (!target || target === ".") return currentPath;
    if (target === "..") {
      const segments = currentPath.split("/").filter(Boolean);
      segments.pop();
      return `/${segments.join("/")}` || "/";
    }
    const next = target.startsWith("/")
      ? target
      : `${currentPath.replace(/\/$/, "")}/${target}`;
    const node = this.resolvePath(next);
    if (!node || node.type !== "dir") {
      return "Error: directorio no encontrado";
    }
    return next === "" ? "/" : next;
  }

  resolvePath(path) {
    const segments = path.split("/").filter(Boolean);
    let current = this.root;
    for (const segment of segments) {
      if (!current.children || !current.children[segment]) {
        return null;
      }
      current = current.children[segment];
    }
    return current;
  }
}
