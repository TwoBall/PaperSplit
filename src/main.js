import { elements } from './dom.js';
import { state } from './state.js';
import { handleFileUpload } from './file-handler.js';
import { changePage, renderCurrentPage } from './viewer.js';
import { toggleSealLine, applySplitToType, applySplitToAll } from './editor.js';
import { exportPdf } from './exporter.js';

/**
 * 初始化所有事件监听器
 */
function initEventListeners() {
    elements.uploadBtn.addEventListener('click', () => elements.fileInput.click());
    if (elements.changeFileBtn) {
        elements.changeFileBtn.addEventListener('click', () => elements.fileInput.click());
    }
    elements.fileInput.addEventListener('change', handleFileUpload);

    elements.prevPageBtn.addEventListener('click', () => changePage(state.currentPage - 1));
    elements.nextPageBtn.addEventListener('click', () => changePage(state.currentPage + 1));

    elements.toggleSealLineBtn.addEventListener('click', toggleSealLine);
    elements.applyToTypeBtn.addEventListener('click', () => applySplitToType());
    elements.applyToAllBtn.addEventListener('click', () => applySplitToAll());
    elements.exportBtn.addEventListener('click', exportPdf);

    window.addEventListener('resize', handleResize);

    // 拖拽事件支持
    const dropZone = elements.canvasContainer;

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });

    dropZone.addEventListener('dragenter', highlight, false);
    dropZone.addEventListener('dragover', highlight, false);
    dropZone.addEventListener('dragleave', unhighlight, false);
    dropZone.addEventListener('drop', handleDrop, false);
}

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

function highlight(e) {
    elements.dragOverlay.classList.remove('hidden');
}

function unhighlight(e) {
    if (e.target === elements.dragOverlay) {
        elements.dragOverlay.classList.add('hidden');
    }
}

function handleDrop(e) {
    unhighlight(e);
    elements.dragOverlay.classList.add('hidden');

    const dt = e.dataTransfer;
    const files = dt.files;

    if (files.length > 0) {
        handleFileUpload({ target: { files: files } });
    }
}

/**
 * 处理窗口调整事件，重新渲染当前页面以适应新尺寸
 */
function handleResize() {
    if (state.pdfDoc || state.fileData) {
        renderCurrentPage();
    }
}

// 启动程序
initEventListeners();
