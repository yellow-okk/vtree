import { Application } from "pixi.js";

export const NODE_CONFIG = {
    squareSize: 45, // 单个正方形宽高
    borderWidth: 2, // 边框宽度
    fillColor: "#e8d5ff", // 正方形填充色
    borderColor: "#6a0dad", // 边框/文字颜色
    lineColor: "#6a0dad", // 连线颜色
    fontSize: 18, // 数字键值字号
    edgeWidth: 2, // 连线宽度
    // 黄色系配色（hover时使用）
    hoverFillColor: "#fff9c4", // 正方形填充色
    hoverBorderColor: "#f57f17", // 边框/文字颜色
};

export const PIXI_APP_CONFIG = {
    resizeTo: document.querySelector("#app"),
    backgroundColor: "#b0f2dc",
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
    antialias: true,
};
