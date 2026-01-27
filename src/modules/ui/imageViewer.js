export class ImageViewer {
  constructor({ root } = {}) {
    this.root = root || document.body;
    this.container = null;
    this.img = null;
    this.caption = null;
    this._ensureStyles();
  }

  _ensureStyles() {
    if (document.getElementById("image-viewer-styles")) return;
    const css = `
      .image-panel {
        position: fixed;
        right: 1.5rem;
        top: 1.5rem;
        width: 300px;
        background: rgba(7,20,12,0.95);
        border: 1px solid rgba(34,197,94,0.08);
        padding: 0.45rem;
        border-radius: 8px;
        box-shadow: 0 14px 40px rgba(2,12,6,0.45);
        z-index: 99999;
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
        align-items: center;
        cursor: move;
        touch-action: none;
      }
      .image-panel img {
        max-width: 100%;
        max-height: 56vh;
        border-radius: 4px;
        object-fit: contain;
        background: #000;
        user-drag: none;
        -webkit-user-drag: none;
      }
      /* captions are hidden: viewer shows only the image */
      .image-panel .caption { display: none; }
      @media (max-width: 760px) {
        .image-panel {
          right: 0.6rem;
          left: 0.6rem;
          top: auto;
          bottom: 1rem;
          width: auto;
          flex-direction: row;
          gap: 0.6rem;
          align-items: center;
        }
        .image-panel img {
          max-height: 120px;
          width: auto;
        }
        .image-panel .caption { display: none; }
      }
    `;
    const s = document.createElement("style");
    s.id = "image-viewer-styles";
    s.textContent = css;
    document.head.appendChild(s);
  }

  attach(/* terminalPanel - no longer required */) {
    // create container if missing
    if (!this.container) {
      this.container = document.createElement("div");
      this.container.className = "image-panel";
  this.img = document.createElement("img");
  this.img.draggable = false;
  this.container.appendChild(this.img);

      // drag state
      this._dragging = false;
      this._dragOffset = { x: 0, y: 0 };

      this._onPointerDown = (e) => {
        const evt = e.touches ? e.touches[0] : e;
        this._dragging = true;
        const rect = this.container.getBoundingClientRect();
        this._dragOffset.x = evt.clientX - rect.left;
        this._dragOffset.y = evt.clientY - rect.top;
        window.addEventListener('pointermove', this._onPointerMove);
        window.addEventListener('pointerup', this._onPointerUp);
        e.preventDefault && e.preventDefault();
      };

      this._onPointerMove = (e) => {
        if (!this._dragging) return;
        const evt = e.touches ? e.touches[0] : e;
        let x = evt.clientX - this._dragOffset.x;
        let y = evt.clientY - this._dragOffset.y;
        const pad = 8;
        const cw = this.container.offsetWidth;
        const ch = this.container.offsetHeight;
        const maxX = window.innerWidth - cw - pad;
        const maxY = window.innerHeight - ch - pad;
        x = Math.max(pad, Math.min(x, maxX));
        y = Math.max(pad, Math.min(y, maxY));
        this.container.style.left = x + 'px';
        this.container.style.top = y + 'px';
        this.container.style.right = 'auto';
      };

      this._onPointerUp = () => {
        this._dragging = false;
        window.removeEventListener('pointermove', this._onPointerMove);
        window.removeEventListener('pointerup', this._onPointerUp);
      };

      this.container.addEventListener('pointerdown', this._onPointerDown, { passive: false });
    }

    if (!document.body.contains(this.container)) document.body.appendChild(this.container);
    this.container.style.display = 'flex';
  }

  detach() {
    if (!this.container) return;
    try { this.container.removeEventListener('pointerdown', this._onPointerDown); } catch (e) {}
    window.removeEventListener('pointermove', this._onPointerMove);
    window.removeEventListener('pointerup', this._onPointerUp);
    if (this.container && this.container.parentNode) this.container.parentNode.removeChild(this.container);
    this.container = null;
    this.img = null;
    this.caption = null;
    this._dragging = false;
    this._dragOffset = null;
    this._onPointerDown = null;
    this._onPointerMove = null;
    this._onPointerUp = null;
  }

  show(imageName) {
    if (!imageName) return;
    if (!this.container) this.attach();
    if (!this.container) return;
    // sanitize basic
    const safe = (imageName || "").replace(/\0/g, "");
    // if caller passed a data URL or an absolute/relative URL, use it directly
    const isDataUrl = /^data:\w+\/[a-zA-Z0-9.+-]+;base64,/.test(safe);
    const isUrlLike = /^(https?:|blob:|\/|img\/)/.test(safe);
    const src = isDataUrl || isUrlLike ? safe : `img/${safe}`;
  this.img.src = src;
  }

  clear() {
    if (this.img) this.img.src = "";
    if (this.caption) this.caption.textContent = "";
  }
}
