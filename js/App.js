import WorkspaceScene from './scenes/WorkspaceScene.js';
import AuxiliaryScene from './scenes/AuxiliaryScene.js';
import CameraScene from './scenes/CameraScene.js';

export default class App {
  constructor() {
    this.workspace = new WorkspaceScene();
    this.secondary3d = new AuxiliaryScene({
      containerId: 'aux-three-root',
      workspace: this.workspace
    });
    this.cameraView = new CameraScene({
      canvasId: 'cameraViewCanvas'
    });

    // Expose workspace scene for legacy bindings.
    window.app = this.workspace;
    window.setConnectedRobotName = (name) => this.workspace?.setConnectedRobotName(name);
    window.setSceneName = (name) => this.workspace?.setSceneName(name);
  }

  dispose() {
    this.secondary3d?.dispose();
    this.cameraView?.dispose();
    if (typeof this.workspace?.dispose === 'function') {
      this.workspace.dispose();
    }
  }
}
