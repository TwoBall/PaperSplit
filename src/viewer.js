import { state } from './state.js';
import { elements } from './dom.js';
import { renderSplitLines } from './editor.js';
import { renderPageCanvas } from './page-renderer.js';

/**
 * 切换到指定页面
 * @param {number} pageNum 目标页码
 */
export function changePage(pageNum) {
    if (pageNum < 1 || pageNum > state.totalPages) return;

    state.currentPage = pageNum;
    updatePageControls();

    // 更新缩略图选中状态
    const thumbs = elements.thumbnailsPanel.querySelectorAll('.thumbnail-item');
    thumbs.forEach(t => t.classList.remove('active'));
    if (thumbs[pageNum - 1]) thumbs[pageNum - 1].classList.add('active');

    renderCurrentPage();
}

/**
 * 更新分页控件状态 (页码显示、按钮禁用)
 */
export function updatePageControls() {
    elements.pageInfo.textContent = `${state.totalPages ? state.currentPage : 0} / ${state.totalPages}`;
    elements.prevPageBtn.disabled = state.currentPage <= 1;
    elements.nextPageBtn.disabled = state.currentPage >= state.totalPages;

    const disabled = !state.totalPages || state.isExporting;
    for (const button of [elements.selectAllPagesBtn, elements.rotateLeftBtn, elements.rotateRightBtn,
        elements.flipHorizontalBtn, elements.flipVerticalBtn, elements.resetPageTransformBtn]) {
        button.disabled = disabled;
    }
    elements.clearPageSelectionBtn.disabled = disabled || !state.selectedPages.size;
    elements.selectionInfo.textContent = state.selectedPages.size
        ? `作用范围：已勾选 ${state.selectedPages.size} / ${state.totalPages} 页`
        : state.totalPages ? `作用范围：当前第 ${state.currentPage} 页` : '请先导入文件';
    elements.thumbnailsPanel.querySelectorAll('.thumbnail-item').forEach(thumb => {
        const selected = state.selectedPages.has(Number(thumb.dataset.pageNumber));
        thumb.classList.toggle('selected', selected);
        const checkbox = thumb.querySelector('input');
        checkbox.checked = selected;
        checkbox.disabled = state.isExporting;
    });
}

/**
 * 渲染当前主页面的 Canvas
 * 会自动计算缩放比例以适应容器
 */
let renderToken = 0;

export async function renderCurrentPage() {
    // 每次渲染分配一个唯一令牌；异步完成后若令牌已过期则丢弃，避免并发渲染叠加重影
    const myToken = ++renderToken;

    if (!state.pdfDoc && !state.fileData) return;
    const { canvas } = await renderPageCanvas(state.currentPage, {
        scale: state.isPdf ? 1.5 : 1,
        maxWidth: elements.canvasContainer.clientWidth - 40,
        maxHeight: elements.canvasContainer.clientHeight - 40
    });

    // 渲染期间若有更新的渲染请求（翻页/缩放），则放弃本次结果
    if (myToken !== renderToken) return;

    elements.canvasWrapper.innerHTML = ''; // 清除旧的 Canvas 和裁切线
    elements.canvasWrapper.style.width = `${canvas.width}px`;
    elements.canvasWrapper.style.height = `${canvas.height}px`;
    elements.canvasWrapper.appendChild(canvas);

    // 恢复或添加默认裁切线
    renderSplitLines();
}

/**
 * 渲染左侧缩略图列表
 */
export async function renderThumbnails() {
    elements.thumbnailsPanel.innerHTML = '';
    for (let i = 1; i <= state.totalPages; i++) {
        const thumbainer = document.createElement('div');
        thumbainer.className = `thumbnail-item ${i === state.currentPage ? 'active' : ''}`;
        thumbainer.dataset.pageNumber = i;
        thumbainer.tabIndex = 0;
        thumbainer.setAttribute('role', 'button');
        thumbainer.setAttribute('aria-label', `预览第 ${i} 页`);
        thumbainer.onclick = () => changePage(i);
        thumbainer.onkeydown = event => {
            if (event.target === thumbainer && (event.key === 'Enter' || event.key === ' ')) {
                event.preventDefault();
                changePage(i);
            }
        };

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'page-selection';
        checkbox.setAttribute('aria-label', `选择第 ${i} 页进行方向调整`);
        checkbox.addEventListener('click', event => event.stopPropagation());
        checkbox.addEventListener('change', () => {
            if (checkbox.checked) state.selectedPages.add(i);
            else state.selectedPages.delete(i);
            updatePageControls();
        });

        const pageNum = document.createElement('div');
        pageNum.className = 'page-number';
        pageNum.textContent = i;

        thumbainer.appendChild(checkbox);
        thumbainer.appendChild(pageNum);
        elements.thumbnailsPanel.appendChild(thumbainer);
    }
    updatePageControls();
    // 先建立所有缩略图容器，使用户可以立即选择任意页面。
    const thumbnails = [...elements.thumbnailsPanel.children];
    for (const thumbnail of thumbnails) {
        if (!thumbnail.isConnected) return;
        await renderThumbnail(Number(thumbnail.dataset.pageNumber));
    }
}

const thumbnailTokens = new WeakMap();

/** 只刷新指定页，并丢弃快速连续操作产生的过期渲染。 */
export async function renderThumbnail(pageIndex) {
    const thumbnail = elements.thumbnailsPanel.querySelector(`[data-page-number="${pageIndex}"]`);
    if (!thumbnail) return;
    const token = (thumbnailTokens.get(thumbnail) || 0) + 1;
    thumbnailTokens.set(thumbnail, token);
    const { canvas } = await renderPageCanvas(pageIndex, { scale: 0.2, maxWidth: 200 });
    if (!thumbnail.isConnected || thumbnailTokens.get(thumbnail) !== token) return;
    const previous = thumbnail.querySelector('canvas');
    if (previous) previous.replaceWith(canvas);
    else thumbnail.prepend(canvas);
}
