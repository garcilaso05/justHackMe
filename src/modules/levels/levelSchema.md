# Esquema de niveles

Cada nivel se define como un JSON con cuatro bloques principales:

- `meta`: información básica del nivel.
- `filesystem`: estructura inicial de archivos.
- `blocks`: comandos disponibles como bloques arrastrables.
- `winCondition`: condición de victoria.
- `hints`: pistas progresivas.

```json
{
  "meta": {
    "id": "nivel-1",
    "nombre": "Explora la base",
    "descripcion": "Descripción corta.",
    "tiempoLimite": 120
  },
  "filesystem": {
    "root": {
      "type": "dir",
      "children": {}
    }
  },
  "blocks": [
    {
      "id": "ls",
      "label": "Listar directorio",
      "command": "ls",
      "description": "Muestra archivos y carpetas",
      "params": []
    }
  ],
  "winCondition": {
    "type": "stdout",
    "mode": "contains",
    "expected": "texto esperado"
  },
  "hints": [
    {
      "unlockAfterSeconds": 10,
      "text": "Una pista..."
    }
  ]
}
```
