import { fetchLevelManifest } from "./levelRegistry.js";

export async function loadLevels(path) {
  const manifest = await fetchLevelManifest(path);
  const levelPromises = manifest.map(async (file) => {
    const response = await fetch(`${path}/${file}`);
    if (!response.ok) {
      throw new Error(`No se pudo cargar ${file}`);
    }
    return normalizeLevel(await response.json());
  });
  return Promise.all(levelPromises);
}

function normalizeLevel(level) {
  return {
    ...level,
    meta: {
      tiempoLimite: level.meta.tiempoLimite,
      ...level.meta,
    },
    blocks: level.blocks || [],
    hints: level.hints || [],
  };
}
