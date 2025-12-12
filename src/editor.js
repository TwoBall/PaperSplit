import { state } from './state.js';
import { elements } from './dom.js';

/**
 * 获取或初始化当前页面的配置
 * 结构: { splitX: 0.5, sealLine: null | { x: 0.1, type: 'left'|'right' } }
 * @param {number} pageIndex 页面索引 (1-based)
 * @returns {Object} 页面配置对象
 */
export function getPageConfig(pageIndex) {
    if (!state.pagesData[pageIndex]) {
        state.pagesData[pageIndex] = {
            splitX: 0.5,
            sealLine: null
        };
    }
    return state.pagesData[pageIndex];
}

/**
 * 渲染当前页的所有辅助线 (切割线 + 密封线)
 */
export function renderSplitLines() {
    // 清除现有的线
    elements.canvasWrapper.querySelectorAll('.split-line').forEach(e => e.remove());

    const config = getPageConfig(state.currentPage);

    // 1. 渲染切割线 (始终存在)
    createLineElement(config.splitX, 'split', (newIter) => {
        config.splitX = newIter;
    });

    // 2. 渲染密封线 (如果存在)
    if (config.sealLine) {
        createLineElement(config.sealLine.x, 'seal', (newIter) => {
            config.sealLine.x = newIter;
        });

        // 更新按钮状态：显示取消
        elements.toggleSealLineBtn.innerHTML = '<span class="material-icons">close</span> 取消去除';
        elements.toggleSealLineBtn.classList.add('active-state');
    } else {
        // 更新按钮状态：显示添加
        elements.toggleSealLineBtn.innerHTML = '<span class="material-icons">format_shapes</span> 去除密封线';
        elements.toggleSealLineBtn.classList.remove('active-state');
    }

    // 启用相关操作按钮
    elements.toggleSealLineBtn.disabled = false;
    elements.applyToTypeBtn.disabled = false;
    elements.applyToAllBtn.disabled = false;
}

/**
 * 创建辅助线 DOM 元素并绑定拖拽事件
 * @param {number} initialX 初始位置比例 (0-1)
 * @param {string} type 线条类型 ('split' | 'seal')
 * @param {Function} onUpdate 更新位置回调
 */
function createLineElement(initialX, type, onUpdate) {
    const lineEl = document.createElement('div');
    lineEl.className = `split-line ${type}`;
    lineEl.style.left = `${initialX * 100}%`;

    // 拖拽状态
    let isDragging = false;

    const onMouseDown = (e) => {
        isDragging = true;
        e.preventDefault();
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        lineEl.classList.add('dragging');
    };

    const onMouseMove = (e) => {
        if (!isDragging) return;
        const rect = elements.canvasWrapper.getBoundingClientRect();
        let newX = e.clientX - rect.left;

        // 边界限制
        newX = Math.max(0, Math.min(newX, rect.width));
        const newPercent = newX / rect.width;

        lineEl.style.left = `${newPercent * 100}%`;
        onUpdate(newPercent);
    };

    const onMouseUp = () => {
        isDragging = false;
        lineEl.classList.remove('dragging');
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    };

    lineEl.addEventListener('mousedown', onMouseDown);
    elements.canvasWrapper.appendChild(lineEl);
}

/**
 * 切换密封线状态 (添加/移除)
 * 智能判断：奇数页默认左侧，偶数页默认右侧
 */
export function toggleSealLine() {
    const config = getPageConfig(state.currentPage);

    if (config.sealLine) {
        // 移除密封线
        config.sealLine = null;
    } else {
        // 添加密封线
        // 奇数页 (1, 3, 5): 左侧 (0.1)
        // 偶数页 (2, 4, 6): 右侧 (0.9)
        const isOdd = state.currentPage % 2 !== 0;
        if (isOdd) {
            config.sealLine = { x: 0.1, type: 'left' };
        } else {
            config.sealLine = { x: 0.9, type: 'right' };
        }
    }
    renderSplitLines();
}

/**
 * 批量应用配置到同类页面 (奇数页或偶数页)
 */
export function applySplitToType() {
    const currentConfig = getPageConfig(state.currentPage);
    const isCurrentOdd = state.currentPage % 2 !== 0;
    const typeName = isCurrentOdd ? '奇数页' : '偶数页';

    if (confirm(`确定将当前配置应用到所有${typeName}吗？`)) {
        for (let i = 1; i <= state.totalPages; i++) {
            const isIterOdd = i % 2 !== 0;
            if (isIterOdd === isCurrentOdd) {
                // 深拷贝配置
                state.pagesData[i] = JSON.parse(JSON.stringify(currentConfig));
            }
        }
        alert('已应用完成');
    }
}

/**
 * 批量应用配置到所有页面
 */
export function applySplitToAll() {
    const currentConfig = getPageConfig(state.currentPage);
    if (confirm(`确定将当前配置应用到所有 ${state.totalPages} 页吗？`)) {
        for (let i = 1; i <= state.totalPages; i++) {
            // 深拷贝配置
            state.pagesData[i] = JSON.parse(JSON.stringify(currentConfig));
        }
        alert('已应用到所有页面');
    }
}
