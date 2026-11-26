import test from 'node:test';
import assert from 'node:assert/strict';
import { applyPageOperation } from '../src/page-renderer.js';
import { state, resetState } from '../src/state.js';

const identity = { rotation: 0, flipHorizontal: false, flipVertical: false };

test('单页旋转保留输入配置，左右旋转互相抵消', () => {
    const original = { ...identity };
    const right = applyPageOperation(original, 'rotate-right');
    assert.equal(right.rotation, 90);
    assert.deepEqual(original, identity);
    assert.deepEqual(applyPageOperation(right, 'rotate-left'), identity);
    assert.equal(applyPageOperation(undefined, 'rotate-left').rotation, 270);
});

test('连续旋转四次恢复原始方向', () => {
    for (const direction of ['rotate-left', 'rotate-right']) {
        let transform;
        for (let i = 0; i < 4; i++) transform = applyPageOperation(transform, direction);
        assert.deepEqual(transform, identity);
    }
});

test('水平或垂直镜像各执行两次恢复原始方向', () => {
    for (const operation of ['flip-horizontal', 'flip-vertical']) {
        const once = applyPageOperation(undefined, operation);
        assert.notDeepEqual(once, identity);
        assert.deepEqual(applyPageOperation(once, operation), identity);
    }
});

test('混合旋转、镜像始终相对于屏幕方向，覆盖长度为四的全部操作组合', () => {
    const permutations = {
        'rotate-left': [1, 3, 0, 2],
        'rotate-right': [2, 0, 3, 1],
        'flip-horizontal': [1, 0, 3, 2],
        'flip-vertical': [2, 3, 0, 1]
    };
    function cornerOrder({ rotation, flipHorizontal, flipVertical }) {
        const angle = rotation * Math.PI / 180;
        return [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, y], id) => ({
            id,
            x: Math.round((x * Math.cos(angle) - y * Math.sin(angle)) * (flipHorizontal ? -1 : 1)),
            y: Math.round((x * Math.sin(angle) + y * Math.cos(angle)) * (flipVertical ? -1 : 1))
        })).sort((a, b) => a.y - b.y || a.x - b.x).map(corner => corner.id);
    }
    function verify(transform, expected, depth) {
        assert.deepEqual(cornerOrder(transform), expected);
        if (!depth) return;
        for (const [operation, order] of Object.entries(permutations)) {
            verify(applyPageOperation(transform, operation), order.map(i => expected[i]), depth - 1);
        }
    }
    verify(identity, [0, 1, 2, 3], 4);
});

test('恢复原始方向同时清除旋转和两种镜像', () => {
    assert.deepEqual(applyPageOperation({ rotation: 270, flipHorizontal: true, flipVertical: true }, 'reset'), identity);
});

test('切换文件清理页面选择和方向设置', () => {
    state.pageTransforms[2] = applyPageOperation(undefined, 'rotate-right');
    state.selectedPages.add(2);
    resetState();
    assert.deepEqual(state.pageTransforms, {});
    assert.equal(state.selectedPages.size, 0);
});
