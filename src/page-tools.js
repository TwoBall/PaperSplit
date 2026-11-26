import { state } from './state.js';
import { applyPageOperation } from './page-renderer.js';
import { renderCurrentPage, renderThumbnail, updatePageControls } from './viewer.js';

export function selectAllPages(selected) {
    if (state.isExporting || !state.totalPages) return;
    state.selectedPages = selected
        ? new Set(Array.from({ length: state.totalPages }, (_, i) => i + 1))
        : new Set();
    updatePageControls();
}

export async function transformPages(operation) {
    if (state.isExporting || (!state.pdfDoc && !state.fileData)) return;
    const pages = state.selectedPages.size ? [...state.selectedPages] : [state.currentPage];
    const documentSource = state.pdfDoc || state.fileData;
    for (const pageIndex of pages) {
        state.pageTransforms[pageIndex] = applyPageOperation(state.pageTransforms[pageIndex], operation);
    }
    if (pages.includes(state.currentPage)) await renderCurrentPage();
    for (const pageIndex of pages) {
        if ((state.pdfDoc || state.fileData) !== documentSource) return;
        await renderThumbnail(pageIndex);
    }
}
