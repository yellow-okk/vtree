import { PIXI_APP_CONFIG } from "../config.js";
import { Application } from "pixi.js";

export class ViewManager {
    constructor(targetDom = document.body) {
        this.app = new Application();
        this.targetDom = targetDom;
    }

    async init() {
        await this.app.init(PIXI_APP_CONFIG);
        this.targetDom.appendChild(this.app.canvas);
    }
}
