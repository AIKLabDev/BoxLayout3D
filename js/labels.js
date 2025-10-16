import App from './App.js';

App.prototype.createBoxLabelSprite = function createBoxLabelSprite(text) {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const defaultStyle = {
    textColor: '#ffffff',
    backgroundColor: 'rgba(33,37,41,0.8)'
  };
  this.drawLabelCanvas(ctx, size, text, defaultStyle);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false
  });
  const sprite = new THREE.Sprite(material);
  const labelScale = 160;
  sprite.scale.set(labelScale, labelScale, 1);
  sprite.renderOrder = 10;
  sprite.userData.canvas = canvas;
  sprite.userData.ctx = ctx;
  sprite.userData.text = String(text);
  sprite.userData.texture = texture;
  sprite.userData.style = { ...defaultStyle };
  return sprite;
};

App.prototype.drawLabelCanvas = function drawLabelCanvas(ctx, size, text, style = {}) {
  const backgroundColor = style.backgroundColor ?? 'rgba(33,37,41,0.8)';
  const textColor = style.textColor ?? '#ffffff';
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = backgroundColor;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = textColor;
  ctx.font = 'bold 64px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(text), size / 2, size / 2);
};

App.prototype.updateBoxLabelTexture = function updateBoxLabelTexture(box) {
  if (!box.label) return;
  const desired = String(box.id);
  if (box.label.userData.text === desired) return;
  box.label.userData.text = desired;
  this.drawLabelCanvas(
    box.label.userData.ctx,
    box.label.userData.canvas.width,
    desired,
    box.label.userData.style
  );
  if (box.label.material && box.label.material.map) {
    box.label.material.map.needsUpdate = true;
  }
};

App.prototype.applyLabelStyle = function applyLabelStyle(label, overrides = {}) {
  if (!label || !label.userData) return;
  const style = { ...(label.userData.style ?? {}), ...overrides };
  label.userData.style = style;
  this.drawLabelCanvas(
    label.userData.ctx,
    label.userData.canvas.width,
    label.userData.text,
    style
  );
  if (label.material && label.material.map) {
    label.material.map.needsUpdate = true;
  }
};

App.prototype.setLabelHighlight = function setLabelHighlight(box, active) {
  if (!box || !box.label) return;
  const targetStyle = active
    ? {
        textColor: '#ffde59',
        backgroundColor: 'rgba(17,24,39,0.9)'
      }
    : {
        textColor: '#ffffff',
        backgroundColor: 'rgba(33,37,41,0.8)'
      };
  const currentStyle = box.label.userData.style ?? {};
  if (
    currentStyle.textColor === targetStyle.textColor &&
    currentStyle.backgroundColor === targetStyle.backgroundColor
  ) {
    return;
  }
  this.applyLabelStyle(box.label, targetStyle);
};

App.prototype.updateBoxLabelPosition = function updateBoxLabelPosition(box) {
  if (!box.label) return;
  const y = box.position.y + box.size.h / 2 + 20;
  box.label.position.set(box.position.x, y, box.position.z);
};

App.prototype.updateBoxLabel = function updateBoxLabel(box) {
  this.updateBoxLabelTexture(box);
  this.updateBoxLabelPosition(box);
};
