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
    async play(commandQueue, finalPositions) {
        this.isPlaying = true;

        for (let cmd of commandQueue) {
            // 必须等待上一个指令的动画彻底播完，再执行下一个！
            await this.executeCommand(cmd, finalPositions);
        }

        this.isPlaying = false;
    }

    /**
     * 执行单个命令
     */
    executeCommand(cmd, finalPos) {
        return new Promise((resolve) => {
            this.processCommand(cmd, finalPos);
            // 这里可以根据命令类型设置不同的延迟时间
            setTimeout(resolve, this.standardDuration / 2);
        });
    }

    /**
     * 播放下一个命令（保留旧方法，确保兼容性）
     */

    playNextCommand(positions) {
        if (!this.isPlaying) {
            return;
        }

        const command = this.dequeueCommand();
        if (!command) {
            this.isPlaying = false;
            return;
        }

        this.processCommand(command, positions);
        // 这里可以添加动画延迟，然后继续播放下一个命令
        setTimeout(() => this.playNextCommand(positions), this.standardDuration);
    }

    /**
     * 开始播放动画（保留旧方法，确保兼容性）
     */

    start(positions) {
        this.isPlaying = true;
        this.playNextCommand(positions);
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
        console.log("创建根节点:", command);
        // 实现创建根节点的动画
        this.createRoot = true;
    }
    handleInsertKey(command, positions) {
        console.log("执行命令:插入key:", command.payload, positions);
        let pos = positions[command.payload.nodeId];
        // 实现插入key的动画
        if (this.createRoot) {
            this.viewManager.createNodeView(
                [command.payload.key],
                command.payload.nodeId,
                pos.x,
                pos.y,
            );
            this.createRoot = false;
        } else {
            // 非根节点插入key
            const currentNode = this.viewManager.currentNodeViews.get(command.payload.nodeId);
            console.log(currentNode.children);
            const leftItems = currentNode.children.slice(0, 2 * command.payload.index);
            const rightItems = currentNode.children.slice(2 * command.payload.index);
            console.log(leftItems, rightItems);

            const shiftAmount = NODE_CONFIG.squareSize / 2;
            const leftStartXs = leftItems.map((item) => item.x);
            const rightStartXs = rightItems.map((item) => item.x);

            let elapsed = 0;

            const update = (ticker) => {
                elapsed += ticker.deltaMS;
                const progress = Math.min(elapsed / this.standardDuration, 1);

                const easedProgress = progress; // 这里可以换成你的缓动函数

                // 【关键步骤 2】：使用【 = 】绝对赋值，而不是【 -= 】或【 += 】
                leftItems.forEach((item, index) => {
                    item.x = leftStartXs[index] - shiftAmount * easedProgress;
                });

                rightItems.forEach((item, index) => {
                    item.x = rightStartXs[index] + shiftAmount * easedProgress;
                });

                if (progress >= 1) {
                    ticker.remove(update, this);
                }
            };
            this.viewManager.app.ticker.add(update, this);
            setTimeout(() => {
                currentNode.keyValues.splice(command.payload.index, 0, command.payload.key);
                currentNode.keyCount = currentNode.keyValues.length;
                // 更新锚点为新的中心点
                currentNode.setPivot();
                currentNode.renderNodes(1, command.payload.index);
                gsap.to(currentNode.children[2 * command.payload.index], {
                    pixi: { alpha: 1 },
                    duration: this.standardDuration / 2000,
                });
                gsap.to(currentNode.children[2 * command.payload.index + 1], {
                    pixi: { alpha: 1 },
                    duration: this.standardDuration / 2000,
                });
            }, this.standardDuration);
            gsap.to(currentNode, {
                pixi: { x: pos.x, y: pos.y },
                duration: this.standardDuration / 2000,
            });
        }
    }

    handleRemoveKey(command) {
        console.log("移除key:", command);
        // 实现移除key的动画
    }

    handleReplaceKey(command) {
        console.log("替换key:", command);
        // 实现替换key的动画
    }

    handleOverflow(command) {
        console.log("节点溢出:", command);
        // 实现节点溢出的动画
    }

    handleUnderflow(command) {
        console.log("节点下溢:", command);
        // 实现节点下溢的动画
    }

    handleSplitPrepare(command) {
        console.log("准备分裂节点:", command);
        // 实现准备分裂节点的动画
    }

    handlePushUpKey(command) {
        console.log("中间key向上推送:", command);
        // 实现中间key向上推送的动画
    }

    handleNewRoot(command) {
        console.log("生成新根节点:", command);
        // 实现生成新根节点的动画
    }

    handleRootDemotion(command) {
        console.log("根节点降级:", command);
        // 实现根节点降级的动画
    }

    handleBorrowFromLeft(command) {
        console.log("向左兄弟借key:", command);
        // 实现向左兄弟借key的动画
    }

    handleBorrowFromRight(command) {
        console.log("向右兄弟借key:", command);
        // 实现向右兄弟借key的动画
    }

    handleMergeWithLeft(command) {
        console.log("与左兄弟合并:", command);
        // 实现与左兄弟合并的动画
    }

    handleMergeWithRight(command) {
        console.log("与右兄弟合并:", command);
        // 实现与右兄弟合并的动画
    }
}
