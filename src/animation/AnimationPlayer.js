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
        this.standardDuration = 1500;
        this.createRoot = false;
        this.tickerCallback = null;
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
     * @param {Array} commandQueue 命令队列
     * @param {Object} finalPositions 最终位置
     * @param {Object} tree 树结构
     * @param {number} n 延迟倍数
     * @param {Function} onComplete 动画完成回调
     */
    play(commandQueue, finalPositions, tree, n = 0.1, onComplete) {
        this.isPlaying = true;

        // 添加 ticker 回调，实时更新连线
        this.tickerCallback = () => {
            this.viewManager.renderEdgeContinuously(tree);
        };
        gsap.ticker.add(this.tickerCallback);

        let delay = 0;
        let count = 1;
        const interval = n * (this.standardDuration / 1000); // 转换为秒

        // 为每个命令设置延迟执行
        for (let cmd of commandQueue) {
            gsap.delayedCall(delay, () => {
                this.executeCommand(cmd, finalPositions);
                console.log(`第${count++}条指令:`, cmd.type);
                console.log(this.viewManager.currentNodeViews);
            });
            delay += interval;
        }

        // 所有命令执行完成后调整位置
        gsap.delayedCall(delay, () => {
            this.adjustPositions(finalPositions);

            // 位置调整动画完成后移除 ticker 回调
            setTimeout(() => {
                if (this.tickerCallback) {
                    gsap.ticker.remove(this.tickerCallback);
                    this.tickerCallback = null;
                }
                this.isPlaying = false;
                // 调用完成回调
                if (onComplete) {
                    onComplete();
                }
            }, this.standardDuration);
        });
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
        if (this.tickerCallback) {
            gsap.ticker.remove(this.tickerCallback);
            this.tickerCallback = null;
        }
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
            const newNode = this.viewManager.createNodeView(
                [command.payload.key],
                command.payload.nodeId,
                pos.x,
                pos.y,
            );
            newNode.alpha = 0;
            newNode.scale.set(0);
            gsap.to(newNode, {
                pixi: { alpha: 1, scaleX: 1, scaleY: 1 },

                duration: this.standardDuration / 1000,
                ease: "back.out",
            });
            this.createRoot = false;
        } else {
            currentNode.addKeyandRender(command.payload.key, command.payload.index);
            const newItem = currentNode.getKeyItem(command.payload.index);

            gsap.from([newItem.square, newItem.text], {
                pixi: { alpha: 0, scaleX: 0, scaleY: 0 },
                duration: this.standardDuration / 2000,
                ease: "back.out",
            });

            for (let i = 0; i < currentNode.keyCount; i++) {
                if (i !== command.payload.index) {
                    const item = currentNode.getKeyItem(i);
                    gsap.to([item.square, item.text], {
                        pixi: { alpha: 1 },
                        duration: this.standardDuration / 2000,
                    });
                }
            }
        }
    }

    handleRemoveKey(command) {
        const node = this.viewManager.currentNodeViews.get(command.payload.nodeId);
        if (!node || !node.keyValues || !Array.isArray(node.keyValues)) return;

        const keyIndex = node.keyValues.indexOf(command.payload.key);
        if (keyIndex === -1) return;

        const item = node.getKeyItem(keyIndex);

        gsap.to([item.square, item.text], {
            pixi: { alpha: 0, scaleX: 0, scaleY: 0, y: -20 },
            duration: this.standardDuration / 2000,
            ease: "power2.in",
            onComplete: () => {
                node.keyValues.splice(keyIndex, 1);
                node.keyCount = node.keyValues.length;
                node.setPivot();
                node.renderNodes();

                for (let i = 0; i < node.keyCount; i++) {
                    const updatedItem = node.getKeyItem(i);
                    gsap.from([updatedItem.square, updatedItem.text], {
                        pixi: { alpha: 0 },
                        duration: this.standardDuration / 2000,
                    });
                }
            },
        });
    }

    handleReplaceKey(command) {
        const targetNode = this.viewManager.currentNodeViews.get(command.payload.targetNodeId);
        const sourceNode = this.viewManager.currentNodeViews.get(command.payload.sourceNodeId);
        if (
            !targetNode ||
            !sourceNode ||
            !targetNode.keyValues ||
            !Array.isArray(targetNode.keyValues)
        )
            return;

        const oldKeyIndex = targetNode.keyValues.indexOf(command.payload.oldKey);
        if (oldKeyIndex === -1) return;

        const oldItem = targetNode.getKeyItem(oldKeyIndex);

        gsap.to([oldItem.square, oldItem.text], {
            pixi: { alpha: 0, scaleX: 0, scaleY: 0 },
            duration: this.standardDuration / 2000,
            ease: "power2.in",
            onComplete: () => {
                targetNode.keyValues[oldKeyIndex] = command.payload.newKey;
                targetNode.renderNodes();

                const newItem = targetNode.getKeyItem(oldKeyIndex);
                gsap.from([newItem.square, newItem.text], {
                    pixi: { alpha: 0, scaleX: 0, scaleY: 0 },
                    duration: this.standardDuration / 2000,
                    ease: "back.out",
                });
            },
        });
    }

    handleOverflow(command) {
        const node = this.viewManager.currentNodeViews.get(command.payload.nodeId);
        if (!node) return;

        gsap.to(node, {
            pixi: { scaleX: 1.1, scaleY: 1.1 },
            duration: this.standardDuration / 4000,
            repeat: 1,
            yoyo: true,
            ease: "power2.inOut",
        });
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

        newNode.alpha = 0;
        newNode.scale.set(0.5);

        oldNode.updateKeysAndRender(command.payload.leftKeys);

        const oldPos = positions[command.payload.oldNodeId];
        const newPos = positions[command.payload.newNodeId];

        const tl = gsap.timeline();
        tl.to(oldNode, {
            pixi: { x: oldPos.x, y: oldPos.y },
            duration: this.standardDuration / 2000,
            ease: "power2.inOut",
        }).to(
            newNode,
            {
                pixi: { alpha: 1, x: newPos.x, y: newPos.y, scaleX: 1, scaleY: 1 },

                duration: this.standardDuration / 2000,
                ease: "back.out",
            },
            "-=0.15",
        );
    }

    handlePushUpKey(command) {
        console.log(command);

        const parentNode = this.viewManager.currentNodeViews.get(command.payload.toNodeId);
        const childNode = this.viewManager.currentNodeViews.get(command.payload.fromNodeId);
        if (!parentNode || !childNode) return;

        const { Text, Graphics } = PIXI;
        const tempText = new Text({
            text: command.payload.key.toString(),
            style: {
                fontFamily: "Arial",
                fontSize: 18,
                fontWeight: "bold",
                fill: "#6a0dad",
            },
        });
        tempText.anchor.set(0.5);

        const startPos = { x: childNode.x, y: childNode.y - 30 };
        const endPos = { x: parentNode.x, y: parentNode.y + 30 };
        console.log(startPos, endPos);

        tempText.position.set(startPos.x, startPos.y);
        this.viewManager.app.stage.addChild(tempText);

        gsap.to(tempText, {
            pixi: { x: endPos.x, y: endPos.y, alpha: 1 },
            duration: this.standardDuration / 2000,
            ease: "power2.inOut",
            onComplete: () => {
                this.viewManager.app.stage.removeChild(tempText);
            },
        });
    }

    handleNewRoot(command, positions) {
        const oldRoot = this.viewManager.currentNodeViews.get(command.payload.oldRootId);
        const newRoot = this.viewManager.createNodeView(
            [command.payload.key],
            command.payload.newRootId,
            oldRoot.x,
            oldRoot.y,
        );

        newRoot.alpha = 0;
        newRoot.scale.set(0);

        const newPos = positions[command.payload.newRootId];
        const oldRootNewPos = positions[command.payload.oldRootId];

        const tl = gsap.timeline();
        tl.to(newRoot, {
            pixi: { alpha: 1, scaleX: 1, scaleY: 1 },

            duration: this.standardDuration / 2000,
            ease: "back.out",
        }).to(
            oldRoot,
            {
                pixi: { x: oldRootNewPos.x, y: oldRootNewPos.y },
                duration: this.standardDuration / 2000,
                ease: "power2.inOut",
            },
            "-=0.2",
        );
    }

    handleRootDemotion(command) {
        const oldRoot = this.viewManager.currentNodeViews.get(command.payload.oldRootId);
        const newRoot = this.viewManager.currentNodeViews.get(command.payload.newRootId);
        if (!oldRoot || !newRoot) return;

        const tl = gsap.timeline();
        tl.to(oldRoot, {
            pixi: { alpha: 0, scaleX: 0.5, scaleY: 0.5 },
            duration: this.standardDuration / 2000,
            ease: "power2.in",
        }).to(
            newRoot,
            {
                pixi: { alpha: 1 },
                duration: this.standardDuration / 2000,
                ease: "power2.out",
            },
            "-=0.15",
        );
    }

    handleBorrowFromLeft(command) {
        const parentNode = this.viewManager.currentNodeViews.get(command.payload.parentId);
        const node = this.viewManager.currentNodeViews.get(command.payload.nodeId);
        const leftBro = this.viewManager.currentNodeViews.get(command.payload.leftBroId);
        if (!parentNode || !node || !leftBro) return;

        const { Text } = PIXI;
        const parentKeyText = new Text({
            text: command.payload.parentKey.toString(),
            style: {
                fontFamily: "Arial",
                fontSize: 18,
                fontWeight: "bold",
                fill: "#6a0dad",
            },
        });
        parentKeyText.anchor.set(0.5);
        parentKeyText.position.set(parentNode.x, parentNode.y + 30);
        parentKeyText.alpha = 0;
        this.viewManager.app.stage.addChild(parentKeyText);

        const broKeyText = new Text({
            text: command.payload.broKey.toString(),
            style: {
                fontFamily: "Arial",
                fontSize: 18,
                fontWeight: "bold",
                fill: "#6a0dad",
            },
        });
        broKeyText.anchor.set(0.5);
        broKeyText.position.set(leftBro.x, leftBro.y - 30);
        broKeyText.alpha = 0;
        this.viewManager.app.stage.addChild(broKeyText);

        const tl = gsap.timeline();
        tl.to(parentKeyText, {
            pixi: { alpha: 1, y: node.y - 30 },
            duration: this.standardDuration / 2000,
            ease: "power2.inOut",
        })
            .to(
                broKeyText,
                {
                    pixi: { alpha: 1, y: parentNode.y - 30 },
                    duration: this.standardDuration / 2000,
                    ease: "power2.inOut",
                },
                "-=0.15",
            )
            .call(() => {
                this.viewManager.app.stage.removeChild(parentKeyText);
                this.viewManager.app.stage.removeChild(broKeyText);
            });
    }

    handleBorrowFromRight(command) {
        const parentNode = this.viewManager.currentNodeViews.get(command.payload.parentId);
        const node = this.viewManager.currentNodeViews.get(command.payload.nodeId);
        const rightBro = this.viewManager.currentNodeViews.get(command.payload.rightBroId);
        if (!parentNode || !node || !rightBro) return;

        const { Text } = PIXI;
        const parentKeyText = new Text({
            text: command.payload.parentKey.toString(),
            style: {
                fontFamily: "Arial",
                fontSize: 18,
                fontWeight: "bold",
                fill: "#6a0dad",
            },
        });
        parentKeyText.anchor.set(0.5);
        parentKeyText.position.set(parentNode.x, parentNode.y + 30);
        parentKeyText.alpha = 0;
        this.viewManager.app.stage.addChild(parentKeyText);

        const broKeyText = new Text({
            text: command.payload.broKey.toString(),
            style: {
                fontFamily: "Arial",
                fontSize: 18,
                fontWeight: "bold",
                fill: "#6a0dad",
            },
        });
        broKeyText.anchor.set(0.5);
        broKeyText.position.set(rightBro.x, rightBro.y - 30);
        broKeyText.alpha = 0;
        this.viewManager.app.stage.addChild(broKeyText);

        const tl = gsap.timeline();
        tl.to(parentKeyText, {
            pixi: { alpha: 1, y: node.y - 30 },
            duration: this.standardDuration / 2000,
            ease: "power2.inOut",
        })
            .to(
                broKeyText,
                {
                    pixi: { alpha: 1, y: parentNode.y - 30 },
                    duration: this.standardDuration / 2000,
                    ease: "power2.inOut",
                },
                "-=0.15",
            )
            .call(() => {
                this.viewManager.app.stage.removeChild(parentKeyText);
                this.viewManager.app.stage.removeChild(broKeyText);
            });
    }

    handleMergeWithLeft(command) {
        const parentNode = this.viewManager.currentNodeViews.get(command.payload.parentId);
        const keepNode = this.viewManager.currentNodeViews.get(command.payload.keepNodeId);
        const absorbNode = this.viewManager.currentNodeViews.get(command.payload.absorbNodeId);
        if (!parentNode || !keepNode || !absorbNode) return;

        const { Text } = PIXI;
        const parentKeyText = new Text({
            text: command.payload.parentKey.toString(),
            style: {
                fontFamily: "Arial",
                fontSize: 18,
                fontWeight: "bold",
                fill: "#6a0dad",
            },
        });
        parentKeyText.anchor.set(0.5);
        parentKeyText.position.set(parentNode.x, parentNode.y + 30);
        parentKeyText.alpha = 0;
        this.viewManager.app.stage.addChild(parentKeyText);

        const tl = gsap.timeline();
        tl.to(parentKeyText, {
            pixi: { alpha: 1, y: keepNode.y + 30 },
            duration: this.standardDuration / 2000,
            ease: "power2.inOut",
        })
            .to(
                absorbNode,
                {
                    pixi: { x: keepNode.x, y: keepNode.y, alpha: 0, scaleX: 0.5, scaleY: 0.5 },
                    duration: this.standardDuration / 2000,
                    ease: "power2.in",
                },
                "-=0.2",
            )
            .call(() => {
                this.viewManager.app.stage.removeChild(parentKeyText);
                this.viewManager.removeNodeView(command.payload.absorbNodeId);
            });
    }

    handleMergeWithRight(command) {
        const parentNode = this.viewManager.currentNodeViews.get(command.payload.parentId);
        const keepNode = this.viewManager.currentNodeViews.get(command.payload.keepNodeId);
        const absorbNode = this.viewManager.currentNodeViews.get(command.payload.absorbNodeId);
        if (!parentNode || !keepNode || !absorbNode) return;

        const { Text } = PIXI;
        const parentKeyText = new Text({
            text: command.payload.parentKey.toString(),
            style: {
                fontFamily: "Arial",
                fontSize: 18,
                fontWeight: "bold",
                fill: "#6a0dad",
            },
        });
        parentKeyText.anchor.set(0.5);
        parentKeyText.position.set(parentNode.x, parentNode.y + 30);
        parentKeyText.alpha = 0;
        this.viewManager.app.stage.addChild(parentKeyText);

        const tl = gsap.timeline();
        tl.to(parentKeyText, {
            pixi: { alpha: 1, y: keepNode.y + 30 },
            duration: this.standardDuration / 2000,
            ease: "power2.inOut",
        })
            .to(
                absorbNode,
                {
                    pixi: { x: keepNode.x, y: keepNode.y, alpha: 0, scaleX: 0.5, scaleY: 0.5 },
                    duration: this.standardDuration / 2000,
                    ease: "power2.in",
                },
                "-=0.2",
            )
            .call(() => {
                this.viewManager.app.stage.removeChild(parentKeyText);
                this.viewManager.removeNodeView(command.payload.absorbNodeId);
            });
    }
}
