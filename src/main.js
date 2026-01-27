import { loadLevels } from "./modules/levels/levelLoader.js";
import { GameEngine } from "./modules/game/gameEngine.js";
import { UIManager } from "./modules/ui/uiManager.js";
import { TerminalSandbox } from "./modules/terminal/terminalSandbox.js";

const ui = new UIManager({
  root: document.getElementById("app"),
  toast: document.getElementById("toast"),
});

const terminal = new TerminalSandbox({
  output: document.getElementById("terminal-output"),
  onOpenImage: (imageName) => {
    // delegate to UI manager if available
    if (ui && ui.onOpenImage) ui.onOpenImage(imageName);
  },
});

// allow terminal input to execute commands directly
ui.onTerminalCommand = async (cmd) => {
  try {
    // delegate to engine so manual commands also trigger win checks
    await engine.processTerminalCommand(cmd);
  } catch (err) {
    ui.showToast(`Error ejecutando comando: ${err.message || err}`, 'error');
  }
};

const engine = new GameEngine({
  ui,
  terminal,
  levelsPath: "./levels",
});

loadLevels("./levels")
  .then((levels) => {
    engine.setLevels(levels);
    engine.start();
  })
  .catch((error) => {
    ui.showToast(`Error cargando niveles: ${error.message}`, "error");
  });
