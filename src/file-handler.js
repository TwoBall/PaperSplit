import * as pdfjsLib from 'pdfjs-dist';
import { version } from 'pdfjs-dist/package.json';
import { state, resetState } from './state.js';
import { elements } from './dom.js';
import { renderThumbnails, renderCurrentPage, updatePageControls } from './viewer.js';

// 设置 PDF.js Worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;

/**
 * 处理文件上传事件 (Change Event)
 * 支持 PDF 和 图片格式
 */
export async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    resetState();
    state.fileName = file.name.replace(/\.[^/.]+$/, "");
    elements.thumbnailsPanel.innerHTML = '';
    elements.emptyState.style.display = 'none';

    // 启用相关按钮
    elements.toggleSealLineBtn.disabled = false;
    elements.exportBtn.disabled = false;
    elements.applyToTypeBtn.disabled = false;
    elements.applyToAllBtn.disabled = false;

    if (file.type === 'application/pdf') {
        state.isPdf = true;
        const arrayBuffer = await file.arrayBuffer();
        loadPdf(arrayBuffer);
    } else if (file.type.startsWith('image/')) {
        state.isPdf = false;
        loadImage(file);
    }
}

/**
 * 加载并解析 PDF 文件
 * @param {ArrayBuffer} arrayBuffer 文件二进制数据
 */
async function loadPdf(arrayBuffer) {
    try {
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        state.pdfDoc = await loadingTask.promise;
        state.totalPages = state.pdfDoc.numPages;
        state.currentPage = 1;

        updatePageControls();
        renderThumbnails();
        renderCurrentPage();
    } catch (error) {
        console.error('Error loading PDF:', error);
        alert('无法加载 PDF 文件');
    }
}

/**
 * 加载图片文件 (作为单页文档处理)
 * @param {File} file 图片文件对象
 */
function loadImage(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        state.fileData = e.target.result;
        state.totalPages = 1;
        state.currentPage = 1;
        state.pdfDoc = null;

        updatePageControls();
        // 生成简单的图片缩略图
        elements.thumbnailsPanel.innerHTML = '';
        const thumb = document.createElement('div');
        thumb.className = 'thumbnail-item active';
        const img = document.createElement('img');
        img.src = state.fileData;
        img.style.width = '100%';
        thumb.appendChild(img);
        elements.thumbnailsPanel.appendChild(thumb);

        renderCurrentPage();
    };
    reader.readAsDataURL(file);
}
