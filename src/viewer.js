import { state } from './state.js';
import { elements } from './dom.js';
import { renderSplitLines } from './editor.js';

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
    elements.pageInfo.textContent = `${state.currentPage} / ${state.totalPages}`;
    elements.prevPageBtn.disabled = state.currentPage <= 1;
    elements.nextPageBtn.disabled = state.currentPage >= state.totalPages;
}

/**
 * 渲染当前主页面的 Canvas
 * 会自动计算缩放比例以适应容器
 */
export async function renderCurrentPage() {
    elements.canvasWrapper.innerHTML = ''; // 清除旧的 Canvas 和裁切线

    let canvas, viewport;

    if (state.isPdf) {
        const page = await state.pdfDoc.getPage(state.currentPage);
        const unscaledViewport = page.getViewport({ scale: 1 });

        // 获取容器的可用宽高 (减去 padding)
        const availableWidth = elements.canvasContainer.clientWidth - 40;
        const availableHeight = elements.canvasContainer.clientHeight - 40;

        // 计算宽和高的缩放比例
        const scaleX = availableWidth / unscaledViewport.width;
        const scaleY = availableHeight / unscaledViewport.height;

        // 取较小值，确保完全包含 (Fit Page)
        let scale = Math.min(scaleX, scaleY);

        // 限制最大放大倍数，防止像素化
        if (scale > 1.5) scale = 1.5;

        viewport = page.getViewport({ scale: scale });
        canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({
            canvasContext: context,
            viewport: viewport
        }).promise;
    } else {
        // 图片渲染
        const img = new Image();
        img.src = state.fileData;
        await new Promise(r => img.onload = r);

        const availableWidth = elements.canvasContainer.clientWidth - 40;
        const availableHeight = elements.canvasContainer.clientHeight - 40;

        const scaleX = availableWidth / img.width;
        const scaleY = availableHeight / img.height;
        let scale = Math.min(scaleX, scaleY);

        if (scale > 1) scale = 1;

        canvas = document.createElement('canvas');
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const context = canvas.getContext('2d');
        context.drawImage(img, 0, 0, canvas.width, canvas.height);

        viewport = { width: canvas.width, height: canvas.height };
    }

    elements.canvasWrapper.style.width = `${viewport.width}px`;
    elements.canvasWrapper.style.height = `${viewport.height}px`;
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
        thumbainer.onclick = () => changePage(i);

        let canvas;

        if (state.isPdf) {
            const page = await state.pdfDoc.getPage(i);
            const viewport = page.getViewport({ scale: 0.2 }); // 缩略图比例
            canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await page.render({
                canvasContext: context,
                viewport: viewport
            }).promise;
        } else {
            // 图片缩略图
            const img = new Image();
            img.src = state.fileData;
            await new Promise(r => img.onload = r);

            // 简单的缩放
            const scale = 0.2; // 略微缩小
            canvas = document.createElement('canvas');
            canvas.width = img.width * scale;
            canvas.height = img.height * scale;
            canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        }

        const pageNum = document.createElement('div');
        pageNum.className = 'page-number';
        pageNum.textContent = i;

        thumbainer.appendChild(canvas);
        thumbainer.appendChild(pageNum);
        elements.thumbnailsPanel.appendChild(thumbainer);
    }
}
