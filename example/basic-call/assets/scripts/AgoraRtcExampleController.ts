import { _decorator, Component } from 'cc';
import { AgoraRtcDemoRoot } from './demo/AgoraRtcDemoRoot.ts';

const { ccclass } = _decorator;

@ccclass('AgoraRtcExampleController')
export class AgoraRtcExampleController extends Component {
  onLoad(): void {
    console.warn('[agora-rtc] AgoraRtcExampleController is deprecated; use AgoraRtcDemoRoot on DemoRoot.');
    if (!this.node.getComponent(AgoraRtcDemoRoot)) {
      this.node.addComponent(AgoraRtcDemoRoot);
    }
  }
}
