import { ImageViewer } from "./imageViewer.js";

export class UIManager {
  constructor({ root, toast }) {
    this.root = root;
    this.toast = toast;
    this.elements = {
      levelName: document.getElementById("level-name"),
      levelDescription: document.getElementById("level-description"),
      levelTimer: document.getElementById("level-timer"),
      score: document.getElementById("score"),
      progress: document.getElementById("progress"),
      blockList: document.getElementById("block-list"),
      blockCount: document.getElementById("block-count"),
      dropZone: document.getElementById("drop-zone"),
      runSequence: document.getElementById("run-sequence"),
      resetLevel: document.getElementById("reset-level"),
      clearTerminal: document.getElementById("clear-terminal"),
      hintButton: document.getElementById("hint-button"),
      hintList: document.getElementById("hint-list"),
      sidebar: document.getElementById("sidebar"),
      sidebarHandle: document.getElementById("sidebar-handle"),
      sidebarArrow: document.querySelector("#sidebar-handle .sidebar-arrow"),
      levelNav: document.getElementById("level-nav"),
      terminalPanel: document.querySelector(".panel.terminal"),
      terminalInput: document.getElementById("terminal-input"),
    };
    this.onRun = null;
    this.onReset = null;
    this.onClearTerminal = null;
    this.onHint = null;
    this.sequence = [];
    this.blockMap = new Map();
    this.dragState = {
      draggedId: null,
    };
    // image viewer component (modular)
    this.imageViewer = new ImageViewer({ root: this.root });
    // handler to be called by terminal when an image should be opened
    this.onOpenImage = (imageName) => {
      this.imageViewer.show(imageName);
    };
    this.bindUI();
  }

  bindUI() {
    this.elements.runSequence.addEventListener("click", () => {
      if (this.onRun) this.onRun();
    });
    this.elements.resetLevel.addEventListener("click", () => {
      if (this.onReset) this.onReset();
    });
    this.elements.clearTerminal.addEventListener("click", () => {
      if (this.onClearTerminal) this.onClearTerminal();
    });
    this.elements.hintButton.addEventListener("click", () => {
      if (this.onHint) this.onHint();
    });
    this.elements.sidebarHandle?.addEventListener("click", () => {
      this.toggleSidebar();
    });

    // terminal input (allow typing commands directly)
    this.elements.terminalInput?.addEventListener("keydown", async (e) => {
      if (e.key === "Enter") {
        const val = (e.target.value || "").trim();
        if (!val) return;
        // clear input
        e.target.value = "";
        if (this.onTerminalCommand) {
          // handler may be async
          await this.onTerminalCommand(val);
        }
      }
    });

    // levelNav doesn't have a separate handle; buttons are always visible in the top nav

    // level selector clicks handled dynamically when rendering

    this.elements.dropZone.addEventListener("dragover", (event) => {
      event.preventDefault();
      this.elements.dropZone.classList.add("active");
    });
    this.elements.dropZone.addEventListener("dragleave", () => {
      this.elements.dropZone.classList.remove("active");
    });
    this.elements.dropZone.addEventListener("drop", (event) => {
      event.preventDefault();
      const blockId = event.dataTransfer.getData("text/plain");
      if (blockId) {
        this.addSequenceItem(blockId);
      }
      this.elements.dropZone.classList.remove("active");
    });
  }

  renderLevel(level, progress, score) {
    this.elements.levelName.textContent = level.meta.nombre;
    this.elements.levelDescription.textContent = level.meta.descripcion;
    this.elements.levelTimer.textContent =
      level.meta.tiempoLimite == null
        ? "Sin límite"
        : `${level.meta.tiempoLimite}s`;
    this.elements.score.textContent = score;
    this.elements.progress.textContent = `${progress.current} / ${progress.total}`;
    this.renderBlocks(level.blocks);
    this.resetSequence();
    this.renderHints([]);
    this.openSidebar();
    // mark active in level menu if present
    this.updateLevelMenuActive(progress.current - 1);
    // image panel support: if level meta requests it, attach image viewer to terminal
    if (level && level.meta && level.meta.imagePanel) {
      const panel = this.elements.terminalPanel || document.querySelector('.panel.terminal');
      if (panel) this.imageViewer.attach(panel);
    } else {
      this.imageViewer.detach();
    }
  }

  renderLevelMenu(levels = [], currentIndex = 0, completed = new Set()) {
    // render buttons into top navigation if available, otherwise fallback to right-hand list
    const container = this.elements.levelNav || this.elements.levelList;
    if (!container) return;
    container.innerHTML = "";
    levels.forEach((lvl, idx) => {
      const btn = document.createElement("button");
      btn.className = "level-button";
      btn.textContent = idx + 1;
      if (completed.has(idx)) btn.classList.add("completed");
      if (idx === currentIndex) btn.classList.add("active");
      btn.addEventListener("click", () => {
        if (this.onSelectLevel) this.onSelectLevel(idx);
      });
      container.appendChild(btn);
    });
  }

  updateLevelMenuActive(index) {
    const container = this.elements.levelNav || this.elements.levelList;
    if (!container) return;
    const buttons = Array.from(container.children || []);
    buttons.forEach((b, i) => {
      b.classList.toggle("active", i === index);
    });
  }

  markLevelCompleted(index) {
    const container = this.elements.levelNav || this.elements.levelList;
    if (!container) return;
    const btn = container.children[index];
    if (btn) btn.classList.add("completed");
  }

  openSidebar() {
  if (!this.elements.sidebar) return;
  this.elements.sidebar.classList.remove("collapsed");
  this.updateSidebarArrow(false);
  }

  openLevelMenu() {
    if (!this.elements.levelMenu) return;
    this.elements.levelMenu.classList.remove("collapsed");
    this.updateLevelMenuArrow(false);
  }

  toggleLevelMenu() {
    if (!this.elements.levelMenu) return;
    this.elements.levelMenu.classList.toggle("collapsed");
    const isCollapsed = this.elements.levelMenu.classList.contains("collapsed");
    this.updateLevelMenuArrow(isCollapsed);
  }

  updateLevelMenuArrow(isCollapsed) {
    if (this.elements.levelMenuArrow) {
      // when collapsed, arrow should point right (to open), when open point left
      this.elements.levelMenuArrow.textContent = isCollapsed ? "◀" : "▶";
    }
  }

  toggleSidebar() {
  if (!this.elements.sidebar) return;
  this.elements.sidebar.classList.toggle("collapsed");
  const isCollapsed = this.elements.sidebar.classList.contains("collapsed");
  this.updateSidebarArrow(isCollapsed);
  }

  updateSidebarArrow(isCollapsed) {
    if (this.elements.sidebarArrow) {
      this.elements.sidebarArrow.textContent = isCollapsed ? "▶" : "◀";
    }
  }

  renderBlocks(blocks) {
    this.elements.blockList.innerHTML = "";
    this.elements.blockCount.textContent = blocks.length;
    this.blockMap = new Map(blocks.map((block) => [block.id, block]));
    blocks.forEach((block) => {
      const inputs = this.getBlockInputs(block);
      const card = document.createElement("div");
      card.className = "block";
      card.draggable = true;
      card.dataset.blockId = block.id;
      card.innerHTML = `
        <strong>${block.label}</strong>
        <small>${block.command}</small>
        <small>${block.description}</small>
        ${inputs.length ? `<small>📝 ${inputs.length} entrada(s)</small>` : ""}
      `;
      card.addEventListener("dragstart", (event) => {
        event.dataTransfer.setData("text/plain", block.id);
        event.dataTransfer.effectAllowed = "move";
        card.classList.add("dragging");
      });
      card.addEventListener("dragend", () => {
        card.classList.remove("dragging");
      });
      this.elements.blockList.appendChild(card);
    });
  }

  resetSequence() {
    this.sequence = [];
    this.elements.dropZone.innerHTML =
      '<p class="empty">Arrastra bloques aquí para construir tu script.</p>';
  }

  addSequenceItem(blockId) {
    this.sequence.push({ id: blockId, inputs: {} });
    this.rebuildSequence();
  }

  rebuildSequence() {
    this.elements.dropZone.innerHTML = "";
    this.sequence.forEach((item, idx) => {
      const block = this.blockMap.get(item.id);
      const inputs = this.getBlockInputs(block);
      const blockEl = document.createElement("div");
      blockEl.className = "sequence-item";
      blockEl.innerHTML = `
        <span>${idx + 1}. ${item.id}</span>
        ${inputs
          .map(
            (inputDef) =>
              `<input class="sequence-input" data-key="${inputDef.key}" placeholder="${inputDef.placeholder || "Texto"}" />`
          )
          .join("")}
        <button aria-label="remove">✕</button>
      `;
      const inputElements = blockEl.querySelectorAll("input");
      inputElements.forEach((inputEl) => {
        const key = inputEl.dataset.key;
        inputEl.value = item.inputs?.[key] || "";
        inputEl.addEventListener("input", (event) => {
          this.sequence[idx].inputs[key] = event.target.value;
        });
      });
      blockEl.querySelector("button").addEventListener("click", () => {
        this.sequence.splice(idx, 1);
        if (this.sequence.length === 0) {
          this.resetSequence();
        } else {
          this.rebuildSequence();
        }
      });
      this.elements.dropZone.appendChild(blockEl);
    });
  }

  getSequence() {
    return this.sequence.map((item) => ({
      ...item,
      inputs: { ...(item.inputs || {}) },
    }));
  }

  getBlockInputs(block) {
    if (!block) return [];
    if (Array.isArray(block.inputs)) {
      return block.inputs.map((input, index) => ({
        key: input.key || `input${index + 1}`,
        placeholder: input.placeholder,
        required: input.required,
        mode: input.mode,
      }));
    }
    if (block.input) {
      return [
        {
          key: "input",
          placeholder: block.input.placeholder,
          required: block.input.required,
          mode: block.input.mode,
        },
      ];
    }
    return [];
  }

  renderHints(hints) {
    this.elements.hintList.innerHTML = "";
    hints.forEach((hint) => {
      const item = document.createElement("li");
      item.textContent = hint;
      this.elements.hintList.appendChild(item);
    });
  }

  updateTimerDisplay(value) {
    this.elements.levelTimer.textContent =
      value == null ? "Sin límite" : `${value}s`;
  }

  showToast(message, variant = "info") {
    this.toast.textContent = message;
    this.toast.classList.remove("hidden");
    this.toast.style.borderLeftColor =
      variant === "success"
        ? "var(--success)"
        : variant === "error"
        ? "var(--danger)"
        : "var(--primary)";
    clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      this.toast.classList.add("hidden");
    }, 2800);
  }
}
