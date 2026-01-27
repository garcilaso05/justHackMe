import { VirtualFileSystem } from "./virtualFileSystem.js";
import { applyDecryptionSequence } from "./hackimgProcessor.js";

export class TerminalSandbox {
  constructor({ output, onOpenImage } = {}) {
    this.output = output;
    this.fs = new VirtualFileSystem();
    this.cwd = "/";
    // callback(imageName) -> UI should open image
    this.onOpenImage = onOpenImage;
  }

  reset(filesystem) {
    this.fs.load(filesystem);
    this.cwd = "/";
    this.clear();
    this.printLine("$ Entorno reiniciado");
  }

  async run(commandLine) {
    const [command, ...args] = commandLine.trim().split(/\s+/);
    let result = { stdout: "", stderr: "" };
    switch (command) {
      case "ls":
        result.stdout = this.fs.list(this.cwd).join("  ");
        break;
      case "tree":
        // show a simple tree view for a given path or cwd
        {
          let target = args[0] || ".";
          // if the command still contains an unreplaced token like "{ruta}", treat as '.'
          if (typeof target === "string" && target.includes("{")) {
            target = ".";
          }
          const fullPath = target.startsWith("/")
            ? target
            : target === "."
            ? this.cwd
            : `${this.cwd.replace(/\/$/, "")}/${target}`;
          // normalize display of the command when token was omitted
          if (command === "tree") {
            // overwrite commandLine for accurate display below
            // (we'll rely on outer scope's commandLine when printing)
            // but since commandLine is a param, recreate a display value
            this._lastDisplayCommand = `tree ${target}`;
          }
          const node = this.fs.resolvePath(fullPath);
          if (!node) {
            result.stderr = "Error: ruta no encontrada";
          } else {
            result.stdout = this.buildTree(node, fullPath === "/" ? "/" : fullPath.split("/").filter(Boolean).pop());
          }
        }
        break;
      case "cat":
        const { file, password } = this.parseCatArgs(args);
        result.stdout = this.fs.read(this.cwd, file || "", password);
        if (result.stdout.startsWith("Error:")) {
          result.stderr = result.stdout;
          result.stdout = "";
        }
        break;
      case "cd":
        result.stdout = this.fs.changeDir(this.cwd, args[0] || "");
        if (!result.stdout.startsWith("Error:")) {
          this.cwd = result.stdout;
          result.stdout = "";
        } else {
          result.stderr = result.stdout;
          result.stdout = "";
        }
        break;
      case "pwd":
        result.stdout = this.cwd;
        break;
      case "echo":
        result.stdout = args.join(" ");
        break;
      case "view":
        {
          // view <file>  - file in virtual fs, containing the real image filename in img/
          const file = args[0] || "";
          if (!file) {
            result.stderr = "Error: falta archivo a mostrar";
            break;
          }
          // only allow images (simple check)
          if (!/\.(jpe?g|png|gif)$/i.test(file)) {
            result.stderr = "Error: formato no soportado (usar .jpg/.png)";
            break;
          }
          const content = this.fs.read(this.cwd, file, null);
          if (content && content.startsWith && content.startsWith("Error:")) {
            result.stderr = content;
            break;
          }
          const imageName = (content || "").trim();
          if (!imageName) {
            result.stderr = "Error: archivo vacío o sin nombre de imagen";
            break;
          }
          // invoke UI hook if present
          if (this.onOpenImage) {
            try {
              this.onOpenImage(imageName);
              result.stdout = `Abriendo imagen: ${imageName}`;
            } catch (err) {
              result.stderr = `Error abriendo imagen: ${err.message || err}`;
            }
          } else {
            result.stderr = "Error: no hay manejador de imágenes";
          }
        }
        break;
      case "hackimg":
        {
          // Usage:
          // hackimg --help
          // hackimg <file> --method permute,xor,blocks
          if (args[0] === "--help") {
            result.stdout = `hackimg <archivo_virtual> --method <lista_metodos>\nOpciones de metodo: permute, xor, blocks\nEjemplo: hackimg openme.jpg --method blocks,xor`;
            break;
          }
          const file = args[0] || "";
          if (!file) {
            result.stderr = "Error: falta archivo virtual";
            break;
          }
          // find --method
          const mIndex = args.findIndex((a) => a === "--method");
          if (mIndex === -1 || !args[mIndex + 1]) {
            result.stderr = "Error: especifica --method permute,xor,blocks";
            break;
          }
          const methods = args[mIndex + 1].split(",").map((s) => s.trim()).filter(Boolean);
          // read virtual file to get real image name
          const content = this.fs.read(this.cwd, file, null);
          if (content && content.startsWith && content.startsWith("Error:")) {
            result.stderr = content;
            break;
          }
          const imageName = (content || "").trim();
          if (!imageName) {
            result.stderr = "Error: archivo virtual vacío";
            break;
          }
          // construct path relative to app root
          const src = `img/${imageName}`;
          try {
            const dataUrl = await applyDecryptionSequence(src, methods);
            if (this.onOpenImage) this.onOpenImage(dataUrl);
            result.stdout = `Intento con métodos: ${methods.join(' -> ')} `;
          } catch (err) {
            result.stderr = `Error procesando imagen: ${err.message || err}`;
          }
        }
        break;
      default:
        result.stderr = `Comando no soportado: ${command}`;
        break;
    }

  // prefer human-friendly display command when created above
  const displayCmd = this._lastDisplayCommand || commandLine;
  this._lastDisplayCommand = null;
  this.printLine(`$ ${displayCmd}`);
    if (result.stdout) this.printLine(result.stdout);
    if (result.stderr) this.printLine(result.stderr, true);
    return result;
  }

  parseCatArgs(args) {
    let file = "";
    let password = null;
    for (let i = 0; i < args.length; i += 1) {
      const value = args[i];
      if (value === "--pass" || value === "-p") {
        password = args[i + 1] || "";
        i += 1;
      } else if (!file) {
        file = value;
      }
    }
    return { file, password };
  }

  buildTree(node, name = ".", indent = "") {
    let out = `${indent}${name}`;
    if (node.type === "dir") {
      const keys = Object.keys(node.children || {});
      keys.forEach((k, i) => {
        const child = node.children[k];
        const isLast = i === keys.length - 1;
        const pointer = isLast ? "└─ " : "├─ ";
        out += "\n" + this.buildTree(child, `${pointer}${k}${child.type === "dir" ? '/' : ''}`, indent + (isLast ? "   " : "│  "));
      });
    }
    return out;
  }

  clear() {
    this.output.innerHTML = "";
  }

  printLine(text, isError = false) {
    const line = document.createElement("div");
    line.textContent = text;
    line.style.color = isError ? "#f87171" : "#e2e8f0";
    this.output.appendChild(line);
    this.output.scrollTop = this.output.scrollHeight;
  }
}
