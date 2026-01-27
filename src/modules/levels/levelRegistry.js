export async function fetchLevelManifest(path) {
  const response = await fetch(`${path}/levelManifest.json`);
  if (!response.ok) {
    throw new Error("No se pudo cargar el manifest de niveles");
  }
  return response.json();
}
