import App from './App.js';
import MessageBox from './ui/messageBox.js';
import './scene.js';
import './camera.js';
import './labels.js';
import './snap.js';
import './boxes.js';
import './interactions.js';
import './robot.js';

window.app = new App();

async function bootstrapUI() {
  try {
    const messageBox = await MessageBox.create({
      defaultTitle: '알림',
      primaryLabel: '확인',
      rememberPosition: true
    });
    const logButton = document.getElementById('logButton');
    if (logButton) {
      logButton.addEventListener('click', () => {
        messageBox.show('hello', { title: 'Log' });
      });
    }
  } catch (error) {
    console.error('Failed to initialize message box', error);
  }
}

bootstrapUI();
