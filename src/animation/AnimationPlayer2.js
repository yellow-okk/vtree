import { CommandTypes } from "../commands/CommandTypes.js";
import { NODE_CONFIG } from "../config.js";

import { gsap } from "gsap";
import { PixiPlugin } from "gsap/PixiPlugin";
import * as PIXI from "pixi.js";
gsap.registerPlugin(PixiPlugin);
PixiPlugin.registerPIXI(PIXI);

export class AnimationPlayer {
    constructor(viewManager) {
        this.viewManager = viewManager;
        this.commandQueue = [];
        this.isPlaying = false;
        this.standardDuration = 500;
        this.createRoot = false;
    }

    /**
     * 向命令队列添加命令
     * @param {Object} command 命令对象
     */
    addCommand(command) {
        console.log("添加命令:", command);
        this.commandQueue.push(command);
    }

    /**
     * 从命令队列中取出命令
     * @returns {Object|null} 取出的命令对象，如果队列为空则返回null
     */
    dequeueCommand() {
        if (this.commandQueue.length === 0) {
            return null;
        }
        return this.commandQueue.shift();
    }

    /**
     * 处理命令
     * @param {Object} command 命令对象
     */
    processCommand(command, positions) {
        if (!command || !command.type) {
            return;
        }

        switch (command.type) {
            case CommandTypes.CREATE_ROOT:
                this.handleCreateRoot(command);
                break;
            case CommandTypes.INSERT_KEY:
                this.handleInsertKey(command, positions);
                break;
            case CommandTypes.REMOVE_KEY:
                this.handleRemoveKey(command, positions);
                break;
            case CommandTypes.REPLACE_KEY:
                this.handleReplaceKey(command, positions);
                break;
            case CommandTypes.OVERFLOW:
                this.handleOverflow(command, positions);
                break;
            case CommandTypes.UNDERFLOW:
                this.handleUnderflow(command, positions);
                break;
            case CommandTypes.SPLIT_PREPARE:
                this.handleSplitPrepare(command, positions);
                break;
            case CommandTypes.PUSH_UP_KEY:
                this.handlePushUpKey(command, positions);
                break;
            case CommandTypes.NEW_ROOT:
                this.handleNewRoot(command, positions);
                break;
            case CommandTypes.ROOT_DEMOTION:
                this.handleRootDemotion(command, positions);
                break;
            case CommandTypes.BORROW_FROM_LEFT:
                this.handleBorrowFromLeft(command, positions);
                break;
            case CommandTypes.BORROW_FROM_RIGHT:
                this.handleBorrowFromRight(command, positions);
                break;
            case CommandTypes.MERGE_WITH_LEFT:
                this.handleMergeWithLeft(command, positions);
                break;
            case CommandTypes.MERGE_WITH_RIGHT:
                this.handleMergeWithRight(command, positions);
                break;
            default:
                console.warn(`Unknown command type: ${command.type}`);
        }
    }

    /**
     * 开始播放动画
     */
    play(commandQueue, finalPositions) {
        this.isPlaying = true;
        let count = 1;
        for (let cmd of commandQueue) {
            // 必须等待上一个指令的动画彻底播完，再执行下一个！
            this.executeCommand(cmd, finalPositions);
            console.log(`第${count++}条指令:`, cmd.type);
            console.log(this.viewManager.currentNodeViews);
        }
        // this.adjustPositions(finalPositions);

        this.isPlaying = false;
    }

    /**
     * 执行单个命令
     */
    executeCommand(cmd, finalPos) {
        this.processCommand(cmd, finalPos);
        // 移除了异步延迟，改为同步执行
    }

    /**
     * 调整节点位置
     */
    adjustPositions(positions) {
        const nodeViewsMap = this.viewManager.currentNodeViews;
        for (const [nodeId, view] of nodeViewsMap) {
            const pos = positions[nodeId];
            gsap.to(view, {
                pixi: { x: pos.x, y: pos.y },
                duration: this.standardDuration / 2000,
            });
            console.log(`调整节点${nodeId}位置到${pos.x}, ${pos.y}`);
        }
    }

    /**
     * 停止播放动画
     */
    stop() {
        this.isPlaying = false;
    }

    /**
     * 清空命令队列
     */
    clearQueue() {
        this.commandQueue = [];
    }

    // 以下是具体命令的处理方法，暂时只定义方法框架
    handleCreateRoot(command) {
        this.createRoot = true;
    }
    handleInsertKey(command, positions) {
        let pos = positions[command.payload.nodeId];
        const currentNode = this.viewManager.currentNodeViews.get(command.payload.nodeId);

        if (this.createRoot) {
            console.log(`创建根节点${command.payload.nodeId}`);
            this.createRoot = false;
            const newNode = this.viewManager.createNodeView(
                [command.payload.key],
                command.payload.nodeId,
                pos.x,
                pos.y,
            );
        } else {
            console.log(`插入键${command.payload.key}到节点位置${command.payload.index}`);
            currentNode.addKeyandRender(command.payload.key, command.payload.index);
        }
    }

    handleRemoveKey(command) {}

    handleReplaceKey(command) {}

    handleOverflow(command) {
        // const node = this.viewManager.currentNodeViews.get(command.payload.nodeId);
        // if (!node) return;
        // gsap.to(node, {
        //     pixi: { scaleX: 1.1, scaleY: 1.1 },
        //     duration: this.standardDuration / 4000,
        //     repeat: 1,
        //     yoyo: true,
        //     ease: "power2.inOut",
        // });
    }

    handleUnderflow(command) {
        const node = this.viewManager.currentNodeViews.get(command.payload.nodeId);
        if (!node) return;

        gsap.to(node, {
            x: "+=5",
            duration: 50,
            repeat: 5,
            yoyo: true,
            ease: "power2.inOut",
        });
    }

    handleSplitPrepare(command, positions) {
        const oldNode = this.viewManager.currentNodeViews.get(command.payload.oldNodeId);
        const newNode = this.viewManager.createNodeView(
            command.payload.rightKeys,
            command.payload.newNodeId,
            oldNode.x,
            oldNode.y,
        );
        oldNode.updateKeysAndRender(command.payload.leftKeys);
    }

    handlePushUpKey(command) {}

    handleNewRoot(command, positions) {
        const oldRoot = this.viewManager.currentNodeViews.get(command.payload.oldRootId);
        const newRoot = this.viewManager.createNodeView(
            [command.payload.key],
            command.payload.newRootId,
            oldRoot.x,
            oldRoot.y,
        );
    }

    handleRootDemotion(command) {}

    handleBorrowFromLeft(command) {}

    handleBorrowFromRight(command) {}

    handleMergeWithLeft(command) {}

    handleMergeWithRight(command) {}
}
