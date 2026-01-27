# justHackMe

Juego educativo modular para practicar comandos de terminal Linux con bloques drag & drop.

## ✅ Qué incluye

- UI modular con bloques arrastrables, barra superior y terminal embebida.
- Motor de juego con puntuación, tiempo y condición de victoria.
- Sistema de niveles basado en JSON + manifest.
- Terminal sandbox con filesystem virtual.
- Ejemplo de nivel listo para expandir.

## 🗂️ Estructura de carpetas

```
.
├── index.html
├── levels/
│   ├── level-1.json
│   └── levelManifest.json
├── scripts/
│   └── devserver.js
├── src/
│   ├── main.js
│   ├── styles.css
│   └── modules/
│       ├── game/
│       │   ├── gameEngine.js
│       │   ├── scoreManager.js
│       │   ├── timerManager.js
│       │   └── winConditions.js
│       ├── levels/
│       │   ├── levelLoader.js
│       │   ├── levelManifest.json
│       │   ├── levelRegistry.js
│       │   └── levelSchema.md
│       ├── terminal/
│       │   ├── terminalSandbox.js
│       │   └── virtualFileSystem.js
│       └── ui/
│           └── uiManager.js
└── package.json
```

## 🧩 Módulos

- `UIManager`: renderiza la vista del nivel, bloques, secuencia y pistas.
- `GameEngine`: orquesta niveles, terminal, puntuación y timer.
- `TerminalSandbox`: ejecuta comandos en filesystem virtual.
- `VirtualFileSystem`: maneja archivos/directorios iniciales.
- `levelLoader`: carga niveles desde JSON usando `levelManifest.json`.

## 🧪 Nivel JSON de ejemplo

Revisa `levels/level-1.json` como base para nuevos niveles. La estructura está documentada en `src/modules/levels/levelSchema.md`.

## ▶️ Cómo ejecutar

Instala Node 18+ y luego:

```bash
npm run dev
```

Abre http://localhost:5173 en tu navegador.

## 🧱 Cómo crear niveles nuevos (paso a paso)

Sigue este flujo para añadir niveles sin tocar el motor del juego.

### 1) Crea el archivo del nivel

- Copia `levels/level-1.json` o `levels/level-2.json`.
- Nómbralo con un identificador simple: `level-3.json`, `nivel-contraseñas.json`, etc.

### 2) Completa los metadatos

En `meta` define:

- `id`: identificador único.
- `nombre`: título visible.
- `descripcion`: objetivo claro del nivel.
- `tiempoLimite`: segundos (o `null` para sin límite).

### 3) Diseña el filesystem inicial

Dentro de `filesystem.root.children` crea archivos/carpetas:

- Un archivo se define con `type: "file"` y `content`.
- Una carpeta con `type: "dir"` y `children`.
- Para proteger archivos, usa `protected: true` y `password`.

### 4) Declara los bloques disponibles

Cada bloque debe incluir:

- `id`: único dentro del nivel.
- `label`: nombre del bloque.
- `command`: comando real que se ejecutará.
- `description`: explicación breve.

#### Bloques con input (ej. contraseña)

Añade el objeto `input` si necesitas que el usuario escriba texto:

- `placeholder`: texto del input.
- `required`: `true` si es obligatorio.
- `mode`: `append` (añade al final) o `replace` (reemplaza `{input}`).

Ejemplo:

```
"command": "cat secreto.txt --pass",
"input": {
	"placeholder": "Contraseña",
	"required": true,
	"mode": "append"
}
```

### 5) Configura la condición de victoria

En `winCondition` define:

- `type`: `stdout` o `stderr`.
- `mode`: `exact`, `contains` o `regex`.
- `expected`: texto esperado.

### 6) Añade pistas progresivas

En `hints` agrega objetos con:

- `unlockAfterSeconds`: tiempo antes de mostrar la pista.
- `text`: la pista.

### 7) Registra el nivel en el manifest

Edita `levels/levelManifest.json` y añade el archivo nuevo en la lista:

```
[
	"level-1.json",
	"level-2.json",
	"level-3.json"
]
```

### 8) (Opcional) Agrega comandos nuevos

Si necesitas comandos no soportados:

- Edita `src/modules/terminal/terminalSandbox.js`.
- Implementa el comando en el `switch`.
- Si toca filesystem, usa métodos en `virtualFileSystem.js`.

## 📝 Notas

Este es un scaffold intencionalmente simple para crecer en fases.
