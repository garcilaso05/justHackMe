import { ScoreManager } from "./scoreManager.js";
import { TimerManager } from "./timerManager.js";
import { evaluateWinCondition } from "./winConditions.js";

export class GameEngine {
  constructor({ ui, terminal, levelsPath }) {
    this.ui = ui;
    this.terminal = terminal;
    this.levelsPath = levelsPath;
    this.levels = [];
    this.currentIndex = 0;
    this.completedLevels = new Set();
    this.scoreManager = new ScoreManager();
    this.timerManager = new TimerManager((remaining) => {
      this.ui.updateTimerDisplay(remaining);
      if (remaining === 0) {
        this.failLevel("Se acabó el tiempo.");
      }
    });
    this.hintState = {
      unlocked: [],
      nextIndex: 0,
      startTime: null,
    };
  }

  setLevels(levels) {
    this.levels = levels;
    // inform UI about available levels
    if (this.ui && this.ui.renderLevelMenu) {
      this.ui.renderLevelMenu(this.levels, this.currentIndex, this.completedLevels || new Set());
    }
  }

  start() {
    this.attachUIHandlers();
    this.loadLevel(0);
  }

  attachUIHandlers() {
    this.ui.onRun = () => this.runSequence();
    this.ui.onReset = () => this.resetLevel();
    this.ui.onClearTerminal = () => this.terminal.clear();
    this.ui.onHint = () => this.unlockHint();
    this.ui.onSelectLevel = (idx) => this.loadLevel(idx);
  }

  loadLevel(index) {
    this.currentIndex = index;
    const level = this.levels[index];
    if (!level) return;
    this.terminal.reset(level.filesystem);
    this.timerManager.start(level.meta.tiempoLimite);
    this.hintState = { unlocked: [], nextIndex: 0, startTime: Date.now() };
    this.ui.renderLevel(level, this.getProgress(), this.scoreManager.score);
    this.ui.showToast(`Nivel cargado: ${level.meta.nombre}`);
    // update level menu active state
    if (this.ui && this.ui.updateLevelMenuActive) this.ui.updateLevelMenuActive(this.currentIndex);
  }

  resetLevel() {
    this.terminal.reset(this.currentLevel.filesystem);
    this.ui.renderLevel(
      this.currentLevel,
      this.getProgress(),
      this.scoreManager.score
    );
    this.ui.showToast("Nivel reiniciado");
  }

  get currentLevel() {
    return this.levels[this.currentIndex];
  }

  getProgress() {
    return { current: this.currentIndex + 1, total: this.levels.length };
  }

  async runSequence() {
    const sequence = this.ui.getSequence();
    if (sequence.length === 0) {
      this.ui.showToast("Arrastra al menos un bloque", "error");
      return;
    }

    const outputs = [];
    for (const step of sequence) {
      const block = this.currentLevel.blocks.find((item) => item.id === step.id);
      if (!block) continue;
      const command = this.composeCommand(block, step);
      if (command == null) return;
      const result = await this.terminal.run(command);
      outputs.push(result);
      this.ui.showToast(`Ejecutado: ${command}`);
    }

    const combinedOutput = outputs.map((res) => res.stdout).join("\n");
    const won = evaluateWinCondition(
      this.currentLevel.winCondition,
      combinedOutput
    );
    if (won) {
      this.handleWin();
    } else {
      this.scoreManager.registerAttempt();
      this.ui.showToast("Aún no es correcto. ¡Intenta otra vez!", "error");
    }
  }

  // Run a command typed directly in the terminal input and check win conditions.
  async processTerminalCommand(commandLine) {
    if (!commandLine) return;
    // Execute via the terminal so output is printed as usual
    const result = await this.terminal.run(commandLine);
    // maintain a simple buffer of manual outputs for win evaluation
    this._manualOutputBuffer = (this._manualOutputBuffer || "") + (result.stdout ? result.stdout + "\n" : "");
    // evaluate win condition against accumulated manual output
    try {
      const won = evaluateWinCondition(this.currentLevel.winCondition, this._manualOutputBuffer);
      if (won) this.handleWin();
    } catch (err) {
      // ignore evaluation errors
    }
    return result;
  }

  handleWin() {
    const timeBonus = this.timerManager.remaining;
    const points = this.scoreManager.calculatePoints(timeBonus);
    this.scoreManager.add(points);
    this.timerManager.stop();
    this.ui.showToast(`Nivel completado +${points} puntos`, "success");
    // mark completed
    this.completedLevels = this.completedLevels || new Set();
    this.completedLevels.add(this.currentIndex);
    if (this.ui && this.ui.markLevelCompleted) this.ui.markLevelCompleted(this.currentIndex);
    if (this.currentIndex < this.levels.length - 1) {
      setTimeout(() => this.loadLevel(this.currentIndex + 1), 1200);
    }
  }

  failLevel(message) {
    this.ui.showToast(message, "error");
    this.scoreManager.registerAttempt();
  }

  unlockHint() {
    const hints = this.currentLevel.hints || [];
    const nextHint = hints[this.hintState.nextIndex];
    if (!nextHint) {
      this.ui.showToast("No hay más pistas disponibles");
      return;
    }

    const elapsed = (Date.now() - this.hintState.startTime) / 1000;
    if (
      nextHint.unlockAfterSeconds != null &&
      elapsed < nextHint.unlockAfterSeconds
    ) {
      const wait = Math.ceil(nextHint.unlockAfterSeconds - elapsed);
      this.ui.showToast(`Espera ${wait}s para la próxima pista.`);
      return;
    }

    this.hintState.unlocked.push(nextHint.text);
    this.hintState.nextIndex += 1;
    this.ui.renderHints(this.hintState.unlocked);
  }

  composeCommand(block, step) {
    const inputs = this.normalizeInputs(block);
    if (inputs.length === 0) {
      return block.command;
    }

    let command = block.command;
    const stepInputs = step.inputs || (block.input ? { input: step.input } : {});

    for (const inputDef of inputs) {
      const key = inputDef.key;
      const value = (stepInputs?.[key] || "").trim();
      if (inputDef.required && !value) {
        this.ui.showToast("Debes ingresar un texto para este bloque", "error");
        return null;
      }
      if (!value) continue;

      if (inputDef.mode === "replace") {
        const token = `{${key}}`;
        if (command.includes(token)) {
          command = command.split(token).join(value);
        } else {
          command = `${command} ${value}`;
        }
      } else {
        command = `${command} ${value}`;
      }
    }

    return command;
  }

  normalizeInputs(block) {
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
}
