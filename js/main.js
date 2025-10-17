import App from './App.js';
import MessageBox from './ui/messageBox.js';
import './scene.js';
import './camera.js';
import './labels.js';
import './snap.js';
import './boxes.js';
import './interactions.js';
import './robot.js';
import './setup.js';

window.app = new App();

window.setConnectedRobotName = (name) => window.app?.setConnectedRobotName(name);
window.setSceneName = (name) => window.app?.setSceneName(name);

async function bootstrapUI() {
  try {
    const [floatingBox, modalBox] = await Promise.all([
      MessageBox.create({
        defaultTitle: '알림',
        primaryLabel: '확인',
        mode: 'floating',
        rememberPosition: true
      }),
      MessageBox.create({
        defaultTitle: '알림',
        primaryLabel: '확인',
        mode: 'modal',
        closeOnBackdrop: true
      })
    ]);

    const popupButton = document.getElementById('popupButton');
    if (popupButton) {
      popupButton.addEventListener('click', () => {
        floatingBox.show('hello', { title: 'Popup Window' });
      });
    }

    const messageButton = document.getElementById('messageBoxButton');
    if (messageButton) {
      messageButton.addEventListener('click', () => {
        modalBox.show('hello', { title: 'Message Box' });
      });
    }
  } catch (error) {
    console.error('Failed to initialize message boxes', error);
  }
}

bootstrapUI();
