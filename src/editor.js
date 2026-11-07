import { state } from './state.js';
import { elements } from './dom.js';
import { getDefaultSplits } from './split-utils.js';

/**
 * 获取或初始化当前页面的配置
 * 结构: { splits: [0.333, 0.667], sealLine: null | { x: 0.15 (左) / 0.85 (右), type: 'left'|'right' } }
 * @param {number} pageIndex 页面索引 (1-based)
 * @returns {Object} 页面配置对象
 */
export function getPageConfig(pageIndex) {
    if (!state.pagesData[pageIndex]) {
        state.pagesData[pageIndex] = {
            splits: getDefaultSplits(state.columnCount),
            sealLine: null
        };
    }
    return state.pagesData[pageIndex];
}

/**
 * 设置文档分栏数量，并按均分位置重置所有页面的切割线
 * @param {number|string} count 栏数 (2 或 3)
 */
export function setColumnCount(count) {
    const next = Number(count);
    if (!Number.isInteger(next) || next < 2 || next > 3) return;

    state.columnCount = next;
    for (let i = 1; i <= state.totalPages; i++) {
        getPageConfig(i).splits = getDefaultSplits(next);
    }

    // 尚未加载文件时无需绘制辅助线
    if (state.pdfDoc || state.fileData) {
        renderSplitLines();
    }
}

/**
 * 计算某条切割线允许拖动的范围，避免越过相邻切割线
 * @param {Object} config 页面配置
 * @param {number} index 切割线序号
 * @returns {{min: number, max: number}} 允许的比例范围
 */
function getSplitBounds(config, index) {
    const gap = 0.01;
    const min = index === 0 ? gap : config.splits[index - 1] + gap;
    const max = index === config.splits.length - 1 ? 1 - gap : config.splits[index + 1] - gap;
    return { min, max };
}

/**
 * 渲染当前页的所有辅助线 (切割线 + 密封线)
 */
export function renderSplitLines() {
    if (!state.pdfDoc && !state.fileData) return;

    // 清除现有的线
    elements.canvasWrapper.querySelectorAll('.split-line').forEach(e => e.remove());

    const config = getPageConfig(state.currentPage);

    // 同步栏数选择器
    if (elements.columnCountSelect) {
        elements.columnCountSelect.value = String(config.splits.length + 1);
    }

    // 1. 渲染切割线 (每栏边界一条)
    config.splits.forEach((x, index) => {
        createLineElement(
            x,
            'split',
            (newRatio) => { config.splits[index] = newRatio; },
            () => getSplitBounds(config, index)
        );
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
 * @param {Function} [getBounds] 返回允许拖动范围的函数
 */
function createLineElement(initialX, type, onUpdate, getBounds) {
    const lineEl = document.createElement('div');
    lineEl.className = `split-line ${type}`;
    lineEl.style.left = `${initialX * 100}%`;

    // 拖拽状态
    let isDragging = false;
    let startX = 0;
    let startLeft = 0; // 记录初始百分比

    const onDragStart = (clientX) => {
        isDragging = true;
        startX = clientX;
        // 获取当前 style.left 的百分比数值 (去除 %)
        startLeft = parseFloat(lineEl.style.left);
        lineEl.classList.add('dragging');
    };

    const onDragMove = (clientX) => {
        if (!isDragging) return;

        const rect = elements.canvasWrapper.getBoundingClientRect();
        const deltaX = clientX - startX;
        const deltaPercent = (deltaX / rect.width) * 100;

        let newPercent = startLeft + deltaPercent;

        // 边界限制 (0% - 100%)
        newPercent = Math.max(0, Math.min(newPercent, 100));

        // 切割线之间保持间隙，避免越过相邻切割线
        let ratio = newPercent / 100;
        if (getBounds) {
            const { min, max } = getBounds();
            ratio = Math.max(min, Math.min(ratio, max));
        }

        lineEl.style.left = `${ratio * 100}%`;
        onUpdate(ratio);
    };

    const onDragEnd = () => {
        isDragging = false;
        lineEl.classList.remove('dragging');
    };

    // Mouse Events
    const onMouseDown = (e) => {
        e.preventDefault(); // 防止选中文本
        onDragStart(e.clientX);
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    const onMouseMove = (e) => {
        if (!isDragging) return;
        e.preventDefault();
        onDragMove(e.clientX);
    };

    const onMouseUp = () => {
        onDragEnd();
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    };

    // Touch Events (Mobile)
    const onTouchStart = (e) => {
        if (e.touches.length !== 1) return;
        e.preventDefault(); // 防止页面滚动
        onDragStart(e.touches[0].clientX);
        document.addEventListener('touchmove', onTouchMove, { passive: false });
        document.addEventListener('touchend', onTouchEnd);
    };

    const onTouchMove = (e) => {
        if (!isDragging) return;
        e.preventDefault(); // 防止滚动
        onDragMove(e.touches[0].clientX);
    };

    const onTouchEnd = () => {
        onDragEnd();
        document.removeEventListener('touchmove', onTouchMove);
        document.removeEventListener('touchend', onTouchEnd);
    };

    lineEl.addEventListener('mousedown', onMouseDown);
    lineEl.addEventListener('touchstart', onTouchStart, { passive: false });

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
        // 奇数页 (1, 3, 5): 左侧 (0.15)
        // 偶数页 (2, 4, 6): 右侧 (0.85)，与左侧对称，各留 15% 边距
        const isOdd = state.currentPage % 2 !== 0;
        if (isOdd) {
            config.sealLine = { x: 0.15, type: 'left' };
        } else {
            config.sealLine = { x: 0.85, type: 'right' };
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
