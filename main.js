// ============================================================
//  justHackMe — main.js
//  Logica principal del juego, terminal virtual y mecanicas
//  CodeURV Edition — Universitat Rovira i Virgili
// ============================================================

import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  doc, setDoc, getDoc,
  collection, onSnapshot, orderBy, query, limit
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ===================== FIREBASE CONFIG =====================
const firebaseConfig = {
  apiKey: "AIzaSyD0JpR8vpeiMfB7tio1UFZ3UY_H9b5Xl5E",
  authDomain: "justhackme-dc960.firebaseapp.com",
  projectId: "justhackme-dc960",
  storageBucket: "justhackme-dc960.firebasestorage.app",
  messagingSenderId: "1067581547057",
  appId: "1:1067581547057:web:0965e210189e0729a96b10"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

// ===================== CARGA DE NIVELES (JSON) =====================
let LEVELS = [];

async function loadLevels() {
  const res = await fetch("niveles.json");
  LEVELS = await res.json();
}

// ===================== VIRTUAL FILESYSTEM (VFS) =====================
class VFS {
  constructor() {
    this.root = { type: "dir", children: {} };
    this.cwd = "/";
  }

  load(fs) {
    this.root = fs.root || { type: "dir", children: {} };
    this.cwd = "/";
  }

  resolve(path) {
    const segs = (path || "/").split("/").filter(Boolean);
    let node = this.root;
    for (const s of segs) {
      if (!node.children || !node.children[s]) return null;
      node = node.children[s];
    }
    return node;
  }

  list(path) {
    const n = this.resolve(path);
    if (!n || n.type !== "dir") return ["Error: directorio no encontrado"];
    return Object.keys(n.children || {});
  }

  read(path, file, pass = null) {
    if (!file) return "Error: especifiquen un nombre de archivo";
    if (file.includes("/")) {
      const parts = file.split("/");
      const fileName = parts.pop();
      const folderPath = (path === "/" ? "" : path) + "/" + parts.join("/");
      return this.read(folderPath || "/", fileName, pass);
    }
    const dir = this.resolve(path);
    if (!dir || dir.type !== "dir") return "Error: directorio no encontrado";
    const f = dir.children?.[file];
    if (!f) return `Error: '${file}' no encontrado`;
    if (f.type === "image") return "Error: usad 'open' para imagenes, no 'cat'";
    if (f.protected) {
      if (!pass) return `Error: '${file}' esta protegido. Usad: cat ${file} --pass [contrasena]`;
      if (pass !== f.password) return "Error: contrasena incorrecta";
    }
    return f.content ?? "";
  }

  getNode(path, file) {
    if (!file) return null;
    if (file.includes("/")) {
      const parts = file.split("/");
      const fileName = parts.pop();
      const folderPath = (path === "/" ? "" : path) + "/" + parts.join("/");
      return this.getNode(folderPath || "/", fileName);
    }
    const dir = this.resolve(path);
    return dir?.children?.[file] ?? null;
  }

  cd(target) {
    if (!target || target === ".") return this.cwd;
    if (target === "..") {
      const segs = this.cwd.split("/").filter(Boolean);
      segs.pop();
      this.cwd = segs.length ? "/" + segs.join("/") : "/";
      return this.cwd;
    }
    const next = target.startsWith("/") ? target : (this.cwd === "/" ? "/" : this.cwd) + (this.cwd === "/" ? "" : "/") + target;
    const cleaned = "/" + next.split("/").filter(Boolean).join("/");
    const n = this.resolve(cleaned);
    if (!n || n.type !== "dir") return "Error: directorio no encontrado";
    this.cwd = cleaned;
    return this.cwd;
  }

  tree(path, name = ".", indent = "") {
    const node = this.resolve(path);
    if (!node) return "Error: ruta no encontrada";
    let out = indent + name;
    if (node.type === "dir") {
      const keys = Object.keys(node.children || {});
      keys.forEach((k, i) => {
        const isLast = i === keys.length - 1;
        const ch = node.children[k];
        const prefix = isLast ? "\u2514\u2500 " : "\u251C\u2500 ";
        const childIndent = indent + (isLast ? "   " : "\u2502  ");
        const childName = prefix + k + (ch.type === "dir" ? "/" : "");
        out += "\n" + this.tree(
          (path === "/" ? "" : path) + "/" + k,
          childName,
          childIndent
        );
      });
    }
    return out;
  }
}

// ===================== TERMINAL ENGINE =====================
class Terminal {
  constructor(outputEl) {
    this.output = outputEl;
    this.vfs = new VFS();
    this._currentLevelRef = null;
  }

  setLevelRef(levelObj) { this._currentLevelRef = levelObj; }

  reset(fs) {
    this.vfs.load(fs);
    this.output.innerHTML = "";
    this.print("Sistema inicializado. Escribid o utilizad los comandos del panel lateral.", "sys");
    this.print("NOTA: 'cd ..' (con espacio) asciende un directorio | 'tree' muestra la estructura completa", "sys");
  }

  print(text, type = "line") {
    const div = document.createElement("div");
    div.className = "t-" + type;
    div.textContent = text;
    this.output.appendChild(div);
    this.output.scrollTop = this.output.scrollHeight;
  }

  printHTML(html) {
    const div = document.createElement("div");
    div.innerHTML = html;
    this.output.appendChild(div);
    this.output.scrollTop = this.output.scrollHeight;
  }

  clear() { this.output.innerHTML = ""; }

  async printImage(node, rawPath) {
    const wrapper = document.createElement("div");
    wrapper.className = "t-img";

    if (node.encrypted) {
      this._renderEncryptedImage(node.src, wrapper);
      const label = document.createElement("div");
      label.textContent = "[IMAGEN ENCRIPTADA] — Usad 'decrypt' para descifrarla";
      label.style.color = "var(--danger)";
      label.style.fontSize = "0.78rem";
      this.output.appendChild(label);
      this.output.appendChild(wrapper);
      this.output.scrollTop = this.output.scrollHeight;
      return "[IMAGEN ENCRIPTADA]";
    }

    if (node.sticker) {
      const container = document.createElement("div");
      container.className = "terminal-image-container";
      container.style.position = "relative";

      const img = document.createElement("img");
      img.src = node.src;
      img.alt = rawPath;
      img.style.display = "block";
      img.onerror = () => { img.style.display = "none"; container.textContent = "[Error: imagen no encontrada en " + node.src + "]"; };

      const badge = document.createElement("div");
      badge.className = "sticker-badge";
      badge.textContent = "PWD: " + node.stickerPassword;

      container.appendChild(img);
      container.appendChild(badge);
      wrapper.appendChild(container);

      const label = document.createElement("div");
      label.textContent = "[PEGATINA DETECTADA] — La contrasena esta escrita sobre la pegatina";
      label.style.color = "var(--accent)";
      label.style.fontSize = "0.78rem";
      this.output.appendChild(label);
      this.output.appendChild(wrapper);
      this.output.scrollTop = this.output.scrollHeight;
      return "[IMAGEN MOSTRADA]";
    }

    // Imagen normal
    const container = document.createElement("div");
    container.className = "terminal-image-container";
    const img = document.createElement("img");
    img.src = node.src;
    img.alt = rawPath;
    img.onerror = () => { img.style.display = "none"; container.textContent = "[Error: imagen no encontrada en " + node.src + "]"; };
    container.appendChild(img);
    wrapper.appendChild(container);

    const label = document.createElement("div");
    label.textContent = "[IMAGEN MOSTRADA]";
    label.style.color = "var(--muted)";
    label.style.fontSize = "0.78rem";
    this.output.appendChild(label);
    this.output.appendChild(wrapper);
    this.output.scrollTop = this.output.scrollHeight;
    return "[IMAGEN MOSTRADA]";
  }

  async printDecryptedImage(node, rawPath) {
    const container = document.createElement("div");
    container.className = "terminal-image-container";
    container.style.position = "relative";

    const img = document.createElement("img");
    img.src = node.src;
    img.alt = rawPath;
    img.style.display = "block";
    img.onerror = () => { img.style.display = "none"; container.textContent = "[Error: imagen no encontrada en " + node.src + "]"; };
    container.appendChild(img);

    if (node.hiddenKey) {
      const badge = document.createElement("div");
      badge.className = "key-badge";
      badge.textContent = "CLAVE: " + node.hiddenKey;
      container.appendChild(badge);
    }

    const wrapper = document.createElement("div");
    wrapper.className = "t-img";
    wrapper.appendChild(container);

    const label = document.createElement("div");
    label.textContent = "[IMAGEN DESCIFRADA]" + (node.hiddenKey ? " — Clave encontrada: " + node.hiddenKey : "");
    label.style.color = "var(--primary)";
    label.style.fontSize = "0.78rem";
    this.output.appendChild(label);
    this.output.appendChild(wrapper);
    this.output.scrollTop = this.output.scrollHeight;
    return "[IMAGEN DESCIFRADA]" + (node.hiddenKey ? " " + node.hiddenKey : "");
  }

  printMetadata(node, filename) {
    const meta = node.metadata || {};
    const table = document.createElement("div");
    table.className = "metadata-table";

    Object.entries(meta).forEach(([k, v]) => {
      const row = document.createElement("div");
      row.className = "meta-row";
      const keyEl = document.createElement("div");
      keyEl.className = "meta-key";
      keyEl.textContent = k;
      const valEl = document.createElement("div");
      valEl.className = "meta-val";
      const isHighlight = ["Codigo secreto", "Nota oculta", "hiddenKey"].includes(k);
      if (isHighlight) valEl.classList.add("highlight");
      valEl.textContent = v;
      row.appendChild(keyEl);
      row.appendChild(valEl);
      table.appendChild(row);
    });

    const wrapper = document.createElement("div");
    wrapper.className = "t-img";
    const label = document.createElement("div");
    label.style.color = "var(--primary)";
    label.style.fontSize = "0.78rem";
    label.textContent = `[METADATOS EXIF] ${filename}`;
    wrapper.appendChild(label);
    wrapper.appendChild(table);
    this.output.appendChild(wrapper);
    this.output.scrollTop = this.output.scrollHeight;

    return Object.entries(meta).map(([k, v]) => `${k}: ${v}`).join("\n");
  }

  _renderEncryptedImage(src, wrapper) {
    const container = document.createElement("div");
    container.className = "terminal-image-container";
    container.style.position = "relative";

    const canvas = document.createElement("canvas");
    canvas.width = 280;
    canvas.height = 160;
    const ctx = canvas.getContext("2d");

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      ctx.drawImage(img, 0, 0, 280, 160);
      const imageData = ctx.getImageData(0, 0, 280, 160);
      const d = imageData.data;
      for (let i = 0; i < d.length; i += 4) {
        d[i]   = (d[i]   ^ 0x55) & 0xFF;
        d[i+1] = (d[i+1] ^ 0xAA) & 0xFF;
        d[i+2] = (d[i+2] ^ 0xFF) & 0xFF;
        if (Math.random() > 0.85) {
          d[i] = d[i+1] = d[i+2] = Math.floor(Math.random() * 256);
        }
      }
      ctx.putImageData(imageData, 0, 0);
      ctx.strokeStyle = "rgba(255,0,0,0.3)";
      for (let y = 0; y < 160; y += 8) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(280, y + Math.sin(y) * 4);
        ctx.stroke();
      }
    };
    img.onerror = () => {
      ctx.fillStyle = "#0c1f12";
      ctx.fillRect(0, 0, 280, 160);
      for (let y = 0; y < 160; y += 4) {
        for (let x = 0; x < 280; x += 4) {
          ctx.fillStyle = `rgba(${Math.random()*50},${Math.random()*100+50},${Math.random()*50},${Math.random()})`;
          ctx.fillRect(x, y, 4, 4);
        }
      }
      ctx.fillStyle = "rgba(255,0,0,0.4)";
      ctx.font = "bold 12px monospace";
      ctx.fillText("AES-256 ENCRYPTED", 40, 80);
    };
    img.src = src;

    const label = document.createElement("div");
    label.className = "encrypted-label";
    label.textContent = "ENCRIPTADO";

    container.appendChild(canvas);
    container.appendChild(label);
    wrapper.appendChild(container);
  }

  // Animacion de progreso para nivel 8
  async _animateProgress(steps, label) {
    const barLen = 20;
    for (let i = 0; i <= steps; i++) {
      const filled = Math.round((i / steps) * barLen);
      const empty = barLen - filled;
      const bar = "[" + "#".repeat(filled) + ".".repeat(empty) + "]";
      const pct = Math.round((i / steps) * 100);
      const line = `${label} ${bar} ${pct}%`;

      if (i === 0) {
        const div = document.createElement("div");
        div.className = "t-sys";
        div.id = "progress-line-" + label.replace(/\s/g, "");
        div.textContent = line;
        this.output.appendChild(div);
      } else {
        const existing = document.getElementById("progress-line-" + label.replace(/\s/g, ""));
        if (existing) existing.textContent = line;
      }
      this.output.scrollTop = this.output.scrollHeight;
      await new Promise(r => setTimeout(r, 80));
    }
  }

  async run(cmdLine) {
    const trimmed = cmdLine.trim();
    if (!trimmed) return { stdout: "", stderr: "" };
    this.print("$ " + trimmed, "cmd");
    const parts = trimmed.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
    const cmd = parts[0];
    const args = parts.slice(1).map(a => a.replace(/^["']|["']$/g, ""));
    let stdout = "", stderr = "";

    switch (cmd) {

      case "ls": {
        const items = this.vfs.list(this.vfs.cwd);
        stdout = items.join("  ");
        break;
      }

      case "tree": {
        stdout = this.vfs.tree(this.vfs.cwd);
        break;
      }

      case "pwd": {
        stdout = this.vfs.cwd;
        break;
      }

      case "echo": {
        stdout = args.join(" ");
        break;
      }

      case "clear": {
        this.clear();
        return { stdout: "", stderr: "" };
      }

      case "cd": {
        const target = args[0] || "";
        if (!target) {
          stderr = "Uso: cd [directorio] — Para subir un nivel: cd ..";
          break;
        }
        const res = this.vfs.cd(target);
        if (res.startsWith("Error:")) {
          stderr = res;
        } else {
          stdout = "";
          const display = res === "/" ? "~" : res.split("/").pop();
          document.getElementById("t-prompt").textContent = `equipo@hackme:${display}$`;
        }
        break;
      }

      case "cat": {
        let file = "", pass = null;
        for (let i = 0; i < args.length; i++) {
          if (args[i] === "--pass" || args[i] === "-p") { pass = args[i + 1] || ""; i++; }
          else if (!file) file = args[i];
        }
        const res = this.vfs.read(this.vfs.cwd, file, pass);
        if (res.startsWith("Error:")) stderr = res;
        else stdout = res;
        break;
      }

      case "open": {
        const file = args[0] || "";
        if (!file) { stderr = "Uso: open [ruta/imagen.jpg]"; break; }
        const node = this.vfs.getNode(this.vfs.cwd, file);
        if (!node) { stderr = `Error: '${file}' no encontrado`; break; }
        if (node.type !== "image") { stderr = `Error: '${file}' no es una imagen. Usad 'cat' para archivos de texto.`; break; }
        stdout = await this.printImage(node, file);
        break;
      }

      case "decrypt": {
        const file = args[0] || "";
        if (!file) { stderr = "Uso: decrypt [ruta/imagen.jpg]"; break; }
        const node = this.vfs.getNode(this.vfs.cwd, file);
        if (!node) { stderr = `Error: '${file}' no encontrado`; break; }
        if (node.type !== "image") { stderr = `Error: '${file}' no es una imagen`; break; }
        if (!node.encrypted) {
          stdout = await this.printImage(node, file);
        } else {
          stdout = await this.printDecryptedImage(node, file);
        }
        break;
      }

      case "metadata":
      case "info": {
        const file = args[0] || "";
        if (!file) { stderr = "Uso: metadata [ruta/imagen.jpg]"; break; }
        const node = this.vfs.getNode(this.vfs.cwd, file);
        if (!node) { stderr = `Error: '${file}' no encontrado`; break; }
        if (node.type !== "image") { stderr = `Error: 'metadata' solo funciona con imagenes`; break; }
        if (!node.metadata) { stderr = `Error: '${file}' no tiene metadatos disponibles`; break; }
        stdout = this.printMetadata(node, file);
        break;
      }

      case "verificar": {
        const code = args[0] || "";
        if (!code) { stderr = "Uso: verificar [CODIGO]"; break; }
        // Nivel 6: URV26
        if (code === "URV26") {
          stdout = "Coordenadas verificadas. Acceso concedido. Codigo URV26 autenticado.";
        } else {
          stderr = `Codigo '${code}' no reconocido. Continuad la busqueda.`;
        }
        break;
      }

      case "introducir": {
        const clave = (args[0] || "").toUpperCase();
        if (clave === "PHANTOM-X") {
          stdout = "Sistema restaurado. Clave PHANTOM-X verificada. Acceso completo concedido.";
        } else {
          stderr = `Clave '${args[0]}' incorrecta. Volved a la consola del navegador.`;
        }
        break;
      }

      // ---- NET-SCAN: escaneo de redes ----
      case "net-scan": {
        this.print("Iniciando escaneo de red...", "sys");
        stdout = "[RED DETECTADA] Analizando senales disponibles...\n" +
          "  public-wifi       -- senal: ####..  (67%) -- abierta\n" +
          "  hackme-db         -- senal: #####.  (82%) -- CLASIFICADA [!]\n" +
          "  admin-panel       -- senal: ##....  (31%) -- acceso denegado\n" +
          "\nUsad 'db-connect [nombre]' para conectaros a una red.";
        break;
      }

      // ---- DB-CONNECT: conexion con animacion y datos de Firebase ----
      case "db-connect": {
        const network = args[0] || "";
        if (!network) { stderr = "Uso: db-connect [nombre-red]"; break; }
        if (network !== "hackme-db") {
          stderr = `Red '${network}' no accesible o sin datos de interes.`;
          break;
        }

        this.print("[CONEXION ESTABLECIDA] Iniciando conexion a hackme-db...", "sys");
        stdout = "[CONEXION ESTABLECIDA]";

        // Animacion de progreso en varias fases
        await new Promise(r => setTimeout(r, 400));
        this.print("Autenticando con credenciales comprometidas...", "sys");
        await this._animateProgress(15, "AUTH    ");

        this.print("Estableciendo tunel cifrado...", "sys");
        await this._animateProgress(12, "TUNNEL  ");

        this.print("Descargando registros clasificados...", "sys");
        await this._animateProgress(25, "DOWNLOAD");

        this.print("Descifrando payload...", "sys");
        await this._animateProgress(10, "DECRYPT ");

        try {
          const snap = await getDoc(doc(db, "secret_data", "master_key"));
          if (snap.exists()) {
            const data = snap.data();
            const content = data.content || data.key || data.password || data.clave || JSON.stringify(data);
            this.print("\n[DATOS CLASIFICADOS RECUPERADOS]", "sys");
            this.print("  Coleccion : secret_data", "line");
            this.print("  Documento : master_key", "line");
            this.print("  Contenido : " + content, "line");
            this.print("  Estado    : ACTIVO", "line");
            stdout += "\n" + content + "\nDescarga completada. Datos clasificados obtenidos.";
          } else {
            // Fallback si no existe el documento
            this.print("\n[DATOS CLASIFICADOS RECUPERADOS]", "sys");
            this.print("  Coleccion : secret_data", "line");
            this.print("  Documento : master_key", "line");
            this.print("  Contenido : 20CODEURV26", "line");
            this.print("  Estado    : ACTIVO", "line");
            stdout += "\n20CODEURV26\nDescarga completada. Datos clasificados obtenidos.";
          }
        } catch (e) {
          // Fallback offline
          this.print("\n[DATOS CLASIFICADOS RECUPERADOS]", "sys");
          this.print("  Coleccion : secret_data", "line");
          this.print("  Documento : master_key", "line");
          this.print("  Contenido : 20CODEURV26", "line");
          this.print("  Estado    : ACTIVO", "line");
          stdout += "\n20CODEURV26\nDescarga completada. Datos clasificados obtenidos.";
        }
        break;
      }

      // Comandos trampa
      case "rm": case "chmod": case "sudo": case "grep": case "find":
        stderr = `El comando '${cmd}' no es necesario para esta mision. Revisad el panel de comandos disponibles.`;
        attempts++;
        updateAttemptsUI();
        break;

      default:
        stderr = `Comando desconocido: '${cmd}'. Usad los comandos del panel lateral.`;
    }

    if (stdout) this.print(stdout, "line");
    if (stderr) this.print(stderr, "err");
    return { stdout, stderr };
  }
}

// ===================== GAME STATE =====================
let playerName = "";
let playerScore = 0;
let currentLevelIndex = 0;
let attempts = 0;
let timerInterval = null;
let timeRemaining = 0;
let timeTotal = 0;
let completedLevels = new Set();
let allLevelsUnlocked = false;
let hintIndex = 0;
let hintStartTime = 0;
let levelOutputBuffer = "";
let objectiveDone = [];

const terminal = new Terminal(document.getElementById("terminal-output"));

// ===================== FIREBASE: SCORE =====================
async function saveScore() {
  if (!playerName) return;
  try {
    await setDoc(doc(db, "scores", playerName), {
      name: playerName,
      score: Number(playerScore) || 0,
      level: Number(currentLevelIndex + 1) || 1,
      updatedAt: Date.now()
    });
  } catch (e) { console.warn("Firebase error:", e); }
}

function startRankingListener() {
  const q = query(collection(db, "scores"), orderBy("score", "desc"), limit(20));
  onSnapshot(q, (snap) => {
    const list = document.getElementById("ranking-list");
    list.innerHTML = "";
    if (snap.empty) {
      list.innerHTML = '<div style="color:var(--muted);font-size:0.8rem;padding:1rem;text-align:center;">Aun no hay equipos registrados.</div>';
      return;
    }
    let position = 0;
    snap.forEach((docSnap) => {
      const d = docSnap.data();
      // Fix NaN: convertir explicitamente a numero con fallback
      const score = isNaN(Number(d.score)) ? 0 : Number(d.score);
      const level = isNaN(Number(d.level)) ? 1 : Number(d.level);

      const item = document.createElement("div");
      item.className = "rank-item" + (d.name === playerName ? " me" : "");
      const posClass = position === 0 ? "gold" : position === 1 ? "silver" : position === 2 ? "bronze" : "normal";
      item.innerHTML = `
        <div class="rank-pos ${posClass}">${position + 1}</div>
        <div class="rank-name">${escHtml(d.name || "---")}${d.name === playerName ? ' <span style="font-size:0.6rem;color:var(--primary)">(vosotros)</span>' : ''}</div>
        <div class="rank-score">${score}</div>
        ${level > 1 ? `<div class="rank-badge">N${level}</div>` : ''}
      `;
      list.appendChild(item);
      position++;
    });
  }, (err) => {
    console.warn("Ranking listener error:", err);
  });
}

// ===================== UI HELPERS =====================
function escHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function showToast(msg, type = "info") {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className = "show " + type;
  clearTimeout(t._timeout);
  t._timeout = setTimeout(() => { t.className = ""; }, 2800);
}

function flashScore(pts) {
  const el = document.createElement("div");
  el.className = "score-flash";
  el.textContent = "+" + pts;
  el.style.left = (50 + Math.random() * 20 - 10) + "%";
  el.style.top = "50%";
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1500);
}

function addScanLine() {
  const sl = document.createElement("div");
  sl.className = "scan-line";
  document.body.appendChild(sl);
  setTimeout(() => sl.remove(), 800);
}

// ===================== TIMER =====================
function startTimer(seconds) {
  clearInterval(timerInterval);
  timeRemaining = seconds;
  timeTotal = seconds;
  updateTimerUI();
  if (!seconds) return;
  timerInterval = setInterval(() => {
    timeRemaining--;
    updateTimerUI();
    if (timeRemaining <= 0) {
      clearInterval(timerInterval);
      showToast("Tiempo agotado. Reiniciad el nivel e intentadlo de nuevo.", "error");
      attempts++;
      updateAttemptsUI();
      loadLevel(currentLevelIndex);
    }
  }, 1000);
}

function stopTimer() { clearInterval(timerInterval); }

function updateTimerUI() {
  const label = document.getElementById("time-label");
  const bar = document.getElementById("time-bar");
  if (!timeTotal) {
    label.textContent = "Tiempo: Sin limite";
    bar.style.width = "100%";
    return;
  }
  const pct = Math.max(0, (timeRemaining / timeTotal) * 100);
  label.textContent = `Tiempo: ${timeRemaining}s`;
  bar.style.width = pct + "%";
  bar.style.background = pct > 50 ? "var(--primary)" : pct > 20 ? "#f59e0b" : "var(--danger)";
}

function updateAttemptsUI() {
  document.getElementById("attempts-label").textContent = `Intentos: ${attempts}`;
}

// ===================== OBJECTIVES =====================
function resetObjectives(level) {
  objectiveDone = level.objectives.map(() => false);
  renderObjectives(level);
}

function renderObjectives(level) {
  const list = document.getElementById("objective-list");
  list.innerHTML = "";
  level.objectives.forEach((obj, i) => {
    const item = document.createElement("div");
    item.className = "objective-item" + (objectiveDone[i] ? " done" : "");
    item.innerHTML = `<div class="obj-dot"></div><span>${escHtml(obj.text)}</span>`;
    list.appendChild(item);
  });
}

function checkObjectives(level, output) {
  let changed = false;
  level.objectives.forEach((obj, i) => {
    if (!objectiveDone[i] && output.toLowerCase().includes(obj.trigger.toLowerCase())) {
      objectiveDone[i] = true;
      changed = true;
    }
  });
  if (changed) renderObjectives(level);
}

// ===================== RENDER COMMANDS =====================
function renderCommands(level) {
  const container = document.getElementById("commands-inner");
  container.innerHTML = "";

  const trapNotice = document.getElementById("trap-notice");
  trapNotice.textContent = (level.traps && level.traps.length > 0)
    ? "Atencion: algunos comandos son trampas" : "";

  level.commands.forEach(cmd => {
    container.appendChild(createCommandCard(cmd, false));
  });

  const trapDefs = {
    echo:  { id: "echo",  label: "echo [texto]",         desc: "Muestra texto en pantalla",              hasInput: true,  placeholder: "texto" },
    clear: { id: "clear", label: "clear",                 desc: "Limpia la pantalla",                     hasInput: false },
    rm:    { id: "rm",    label: "rm [archivo]",          desc: "Elimina un archivo",                     hasInput: true,  placeholder: "archivo" },
    chmod: { id: "chmod", label: "chmod [permisos]",      desc: "Modifica permisos de un archivo",        hasInput: true,  placeholder: "permisos archivo" },
    grep:  { id: "grep",  label: "grep [patron]",         desc: "Busca texto en archivos",                hasInput: true,  placeholder: "patron archivo" },
    find:  { id: "find",  label: "find [nombre]",         desc: "Busca archivos por nombre",              hasInput: true,  placeholder: "nombre" },
    sudo:  { id: "sudo",  label: "sudo [comando]",        desc: "Ejecuta como administrador del sistema", hasInput: true,  placeholder: "comando" }
  };

  if (level.traps) {
    level.traps.forEach(trapId => {
      if (trapDefs[trapId]) container.appendChild(createCommandCard(trapDefs[trapId], true));
    });
  }
}

function createCommandCard(cmd, isTrap) {
  const card = document.createElement("div");
  card.className = "cmd-card" + (isTrap ? " trap" : "");

  const nameEl = document.createElement("div");
  nameEl.className = "cmd-name";
  nameEl.textContent = cmd.label;

  const descEl = document.createElement("div");
  descEl.className = "cmd-desc";
  descEl.textContent = cmd.desc;

  card.appendChild(nameEl);
  card.appendChild(descEl);

  if (cmd.hasInput) {
    const input = document.createElement("input");
    input.className = "cmd-input";
    input.placeholder = cmd.placeholder || "argumento";
    input.onclick = (e) => e.stopPropagation();

    const btn = document.createElement("button");
    btn.className = "cmd-run-btn";
    btn.textContent = "EJECUTAR";
    btn.onclick = async (e) => {
      e.stopPropagation();
      const val = input.value.trim();
      let cmdLine = "";

      if (cmd.id === "cat-pass") {
        const parts = val.split("--pass");
        const file = (parts[0] || "").trim();
        const pass = (parts[1] || "").trim();
        if (!file) { showToast("Formato: archivo --pass contrasena", "error"); return; }
        cmdLine = pass ? `cat ${file} --pass ${pass}` : `cat ${file}`;
      } else if (cmd.id === "cat") {
        if (!val) { showToast("Escribid el nombre del archivo", "error"); return; }
        cmdLine = `cat ${val}`;
      } else if (cmd.id === "cd") {
        if (!val) { showToast("Escribid la carpeta (o .. para subir)", "error"); return; }
        cmdLine = `cd ${val}`;
      } else {
        cmdLine = val ? `${cmd.id} ${val}` : cmd.id;
      }

      await executeCommand(cmdLine);
      input.value = "";
    };

    card.appendChild(input);
    card.appendChild(btn);
  } else {
    card.addEventListener("click", () => executeCommand(cmd.id));
  }

  return card;
}

// ===================== EXECUTE COMMAND =====================
async function executeCommand(cmdLine) {
  const result = await terminal.run(cmdLine);
  levelOutputBuffer += (result.stdout || "") + "\n" + (result.stderr || "") + "\n";

  const level = LEVELS[currentLevelIndex];
  checkObjectives(level, levelOutputBuffer);

  const winText = level.win.expected.toLowerCase();
  if (level.win.type === "contains" && levelOutputBuffer.toLowerCase().includes(winText)) {
    handleWin();
  }
}

// ===================== WIN =====================
function handleWin() {
  stopTimer();
  const level = LEVELS[currentLevelIndex];
  const timeBonus = timeRemaining;
  const penalty = attempts * 15;
  const pts = Math.max(10, 100 + timeBonus - penalty);
  playerScore += pts;

  completedLevels.add(currentLevelIndex);
  document.getElementById("stat-score").textContent = playerScore;

  addScanLine();
  flashScore(pts);

  // Si es el ultimo nivel, mostrar pantalla final
  if (currentLevelIndex >= LEVELS.length - 1) {
    saveScore().then(() => {
      setTimeout(showFinalScreen, 800);
    });
    return;
  }

  document.getElementById("win-points").textContent = "+" + pts + " puntos";
  document.getElementById("win-msg").textContent =
    "Objetivo completado. Continuad con el siguiente reto.";

  const overlay = document.getElementById("win-overlay");
  overlay.classList.add("show");

  const nextBtn = document.getElementById("next-level-btn");
  nextBtn.textContent = "SIGUIENTE NIVEL";
  nextBtn.onclick = () => {
    overlay.classList.remove("show");
    loadLevel(currentLevelIndex + 1);
  };

  renderLevelNav();
  saveScore();
}

// ===================== PANTALLA FINAL =====================
function showFinalScreen() {
  const screen = document.getElementById("final-screen");
  screen.style.display = "flex";

  document.getElementById("final-score-val").textContent = playerScore;
  document.getElementById("final-player-name").textContent = "Equipo: " + playerName;

  // Estadisticas
  const statsEl = document.getElementById("final-stats");
  statsEl.innerHTML = `
    <div class="final-stat-item">Niveles completados: <strong>${completedLevels.size}</strong></div>
    <div class="final-stat-item">Puntuacion total: <strong>${playerScore}</strong></div>
  `;

  // Tux ASCII art
  const tuxLines = [
    "       .--.       ",
    "      |o_o |      ",
    "      |:_/ |      ",
    "     //   \\ \\     ",
    "    (|     | )    ",
    "   /'\\_   _/`\\    ",
    "   \\___)=(___/    ",
    "                  ",
    "   T  U  X        ",
    " Guardian Linux   ",
  ];
  document.getElementById("tux-art").textContent = tuxLines.join("\n");
}

// ===================== LEVEL NAV =====================
function renderLevelNav() {
  const nav = document.getElementById("level-nav");
  nav.innerHTML = "";
  LEVELS.forEach((lvl, i) => {
    const btn = document.createElement("button");
    btn.className = "level-btn";
    btn.textContent = `N${lvl.id}: ${lvl.name}`;
    if (i === currentLevelIndex) btn.classList.add("active");
    if (completedLevels.has(i)) btn.classList.add("completed");
    if (!allLevelsUnlocked && i > currentLevelIndex && !completedLevels.has(i)) {
      btn.disabled = true;
      btn.title = "Completad el nivel anterior para desbloquear";
    }
    btn.addEventListener("click", () => {
      if (!btn.disabled) loadLevel(i);
    });
    nav.appendChild(btn);
  });

  // Scroll automatico al boton activo
  const activeBtn = nav.querySelector(".level-btn.active");
  if (activeBtn) {
    setTimeout(() => {
      activeBtn.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }, 50);
  }
}

// ===================== LOAD LEVEL =====================
function loadLevel(index) {
  const level = LEVELS[index];
  if (!level) return;
  currentLevelIndex = index;
  attempts = 0;
  hintIndex = 0;
  hintStartTime = Date.now();
  levelOutputBuffer = "";
  objectiveDone = [];

  document.getElementById("mission-title").textContent = `Nivel ${level.id}: ${level.name}`;
  document.getElementById("mission-desc").textContent = level.desc;
  document.getElementById("stat-level").textContent = level.id;
  document.getElementById("hint-list").innerHTML = "";
  document.getElementById("t-prompt").textContent = "equipo@hackme:~$";

  terminal.setLevelRef(level);
  resetObjectives(level);
  renderCommands(level);
  terminal.reset(level.filesystem);
  startTimer(level.time);
  updateAttemptsUI();
  renderLevelNav();

  showToast(`Nivel ${level.id}: ${level.name}`, "info");
}

// ===================== HINTS =====================
document.getElementById("hint-btn").addEventListener("click", () => {
  const level = LEVELS[currentLevelIndex];
  const hints = level.hints || [];
  if (hintIndex >= hints.length) {
    showToast("No hay mas pistas disponibles para este nivel.", "info");
    return;
  }
  const hint = hints[hintIndex];
  const elapsed = (Date.now() - hintStartTime) / 1000;
  if (elapsed < hint.after) {
    const wait = Math.ceil(hint.after - elapsed);
    showToast(`Esperad ${wait} segundos para desbloquear esta pista.`, "info");
    return;
  }
  const list = document.getElementById("hint-list");
  const item = document.createElement("div");
  item.className = "hint-item";
  item.textContent = hint.text;
  list.appendChild(item);
  hintIndex++;
});

// ===================== RESET / CLEAR =====================
document.getElementById("reset-btn").addEventListener("click", () => {
  loadLevel(currentLevelIndex);
  showToast("Nivel reiniciado.", "info");
});

document.getElementById("clear-btn").addEventListener("click", () => {
  terminal.clear();
});

// ===================== TERMINAL INPUT KEYBOARD =====================
document.getElementById("terminal-input").addEventListener("keydown", async (e) => {
  if (e.key === "Enter") {
    const val = e.target.value.trim();
    if (!val) return;
    e.target.value = "";
    await executeCommand(val);
  }
});

// ===================== MODAL / START =====================
document.getElementById("start-btn").addEventListener("click", startGame);
document.getElementById("player-name-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") startGame();
});

async function startGame() {
  const input = document.getElementById("player-name-input");
  const name = input.value.trim();
  if (!name) {
    input.style.borderColor = "var(--danger)";
    showToast("Introducid un identificador de equipo para continuar.", "error");
    return;
  }
  playerName = name;
  document.getElementById("stat-player").textContent = name;
  document.getElementById("name-modal").style.display = "none";
  document.getElementById("app").style.display = "flex";

  startRankingListener();
  loadLevel(0);
  saveScore();
}

// ===================== FUNCION OCULTA: CLAVE EN CONSOLA =====================
// Esta funcion queda expuesta globalmente para que los equipos la puedan ejecutar
// desde las herramientas de desarrollador del navegador (F12 > Console)
window.obtenerClaveOculta = function () {
  console.log(
    "%c CLAVE OCULTA ENCONTRADA",
    "color: #00e676; font-size: 18px; font-weight: bold; font-family: monospace; background: #030a05; padding: 4px 12px;"
  );
  console.log(
    "%c La clave del sistema comprometido es: PHANTOM-X",
    "color: #ffd700; font-size: 14px; font-family: monospace;"
  );
  console.log(
    "%c Regresad a la terminal y ejecutad: introducir PHANTOM-X",
    "color: #9bf5bc; font-size: 12px; font-family: monospace;"
  );
  return "PHANTOM-X";
};

// ===================== DEBUG OCULTO: DESBLOQUEAR NIVELES =====================
// Funcion secreta para consola: no aparece en UI ni en niveles.json.
window.codeURV = function () {
  allLevelsUnlocked = true;
  renderLevelNav();
  showToast("Modo debug activado: todos los niveles estan desbloqueados.", "success");
  console.log(
    "%c[codeURV] DEBUG ACTIVO",
    "color: #00e676; font-size: 14px; font-weight: bold; font-family: monospace;"
  );
  console.log(
    "%cNiveles desbloqueados. Podeis entrar a cualquier nivel desde el Nav.",
    "color: #9bf5bc; font-size: 12px; font-family: monospace;"
  );
  return "NIVELES_DESBLOQUEADOS";
};

// ===================== EASTER EGG: CREDITOS =====================
// Funcion accesible desde la consola del navegador al completar el juego.
// Aparece referenciada en la pantalla final como reto bonus.
window.creditos = function () {
  const LINE = "=".repeat(58);
  console.log(
    "%c" + LINE,
    "color: #00e676; font-family: monospace; font-size: 13px;"
  );
  console.log(
    "%c  justHackMe — Terminal Quest",
    "color: #00e676; font-family: monospace; font-size: 16px; font-weight: bold;"
  );
  console.log(
    "%c  CodeURV Edition",
    "color: #5ba872; font-family: monospace; font-size: 12px; letter-spacing: 0.15em;"
  );
  console.log(
    "%c" + LINE,
    "color: #00e676; font-family: monospace; font-size: 13px;"
  );
  console.log(
    "%c  Organizado por  :  CodeURV\n" +
    "                    Asociacion de Informatica de la\n" +
    "                    Universitat Rovira i Virgili",
    "color: #d4fbe0; font-family: monospace; font-size: 13px; line-height: 1.8;"
  );
  console.log(
    "%c  Programado por  :  Roger Garcia Doncel",
    "color: #d4fbe0; font-family: monospace; font-size: 13px; line-height: 1.8;"
  );
  console.log(
    "%c" + LINE,
    "color: #00e676; font-family: monospace; font-size: 13px;"
  );
  console.log(
    "%c  Han superado todos los retos. El kernel los reconoce.",
    "color: #ffd700; font-family: monospace; font-size: 13px; font-style: italic;"
  );
  console.log(
    "%c" + LINE,
    "color: #00e676; font-family: monospace; font-size: 13px;"
  );
  return "CodeURV — Universitat Rovira i Virgili";
};

// ===================== ARRANQUE =====================
await loadLevels();
