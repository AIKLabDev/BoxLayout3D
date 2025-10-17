import BoxLayoutWindow from './ui/BoxLayoutWindow.js';

let boxLayoutWindow = null;
let templateLoaded = false;

async function loadTemplate(panel) {
  if (!panel) return null;
  const templatePath = panel.dataset?.template;
  if (!templatePath || templateLoaded) return panel;

  try {
    const response = await fetch(templatePath, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const markup = await response.text();
    panel.innerHTML = markup;
    templateLoaded = true;
  } catch (err) {
    console.warn('Box layout 템플릿을 불러오지 못했습니다.', err);
    panel.innerHTML =
      '<div class="view-placeholder">Box layout 템플릿을 불러올 수 없습니다. 파일 경로를 확인하세요.</div>';
  }

  return panel;
}

export async function initializeBoxLayoutPanel(appInstance) {
  const panel = document.getElementById('boxlayout-panel');
  if (!panel) return null;

  const container = await loadTemplate(panel);
  const workspace = appInstance?.workspace ?? window.app;
  if (!workspace || !container) {
    return null;
  }

  boxLayoutWindow = new BoxLayoutWindow({
    container,
    workspace
  });
  return boxLayoutWindow;
}

export function getBoxLayoutWindow() {
  return boxLayoutWindow;
}
