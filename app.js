const folderInput = document.getElementById("folderInput");
const imageInput = document.getElementById("imageInput");
const thumbList = document.getElementById("thumbList");
const imageCount = document.getElementById("imageCount");
const readout = document.getElementById("readout");
const zoomLabel = document.getElementById("zoomLabel");
const fitButton = document.getElementById("fitButton");
const actualButton = document.getElementById("actualButton");
const zoomInButton = document.getElementById("zoomInButton");
const zoomOutButton = document.getElementById("zoomOutButton");
const boxSelectButton = document.getElementById("boxSelectButton");
const sourceMenuButton = document.getElementById("sourceMenuButton");
const sourceMenu = document.getElementById("sourceMenu");
const themeToggle = document.getElementById("themeToggle");
const exportButton = document.getElementById("exportButton");
const clearCacheButton = document.getElementById("clearCacheButton");
const horizontalGridInput = document.getElementById("horizontalGridInput");
const verticalGridInput = document.getElementById("verticalGridInput");
const physicalHeightInput = document.getElementById("physicalHeightInput");
const dominantColorToggle = document.getElementById("dominantColorToggle");
const dominantColorPanel = document.getElementById("dominantColorPanel");
const dominantColorSwatch = document.getElementById("dominantColorSwatch");
const dominantColorField = document.getElementById("dominantColorField");
const dominantColorPicker = document.getElementById("dominantColorPicker");
const copyColorButton = document.getElementById("copyColorButton");
const pickedColorSwatch = document.getElementById("pickedColorSwatch");
const pickedColorField = document.getElementById("pickedColorField");
const pickedColorPicker = document.getElementById("pickedColorPicker");
const workspace = document.querySelector(".workspace");
const sidebarResizer = document.getElementById("sidebarResizer");
const canvasWrap = document.getElementById("canvasWrap");
const imageCanvas = document.getElementById("imageCanvas");
const topRuler = document.getElementById("topRuler");
const leftRuler = document.getElementById("leftRuler");
const loupe = document.getElementById("loupe");
const loupeCanvas = document.getElementById("loupeCanvas");
const loupeLabel = document.getElementById("loupeLabel");
let emptyState = document.getElementById("emptyState");

const imageCtx = imageCanvas.getContext("2d");
const topCtx = topRuler.getContext("2d");
const leftCtx = leftRuler.getContext("2d");
const loupeCtx = loupeCanvas.getContext("2d");

const state = {
  images: [],
  activeIndex: -1,
  bitmap: null,
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  selectedPoint: null,
  hoverPoint: null,
  savedClicks: {},
  exportSettings: {},
  pickedColor: null,
  dominantColor: null,
  dominantColorEnabled: false,
  colorJobId: 0,
  sampleCanvas: null,
  sampleCtx: null,
  sampleBitmap: null,
  hoverMarkerIndex: -1,
  rulerHover: null,
  hoverGuideIndex: -1,
  dragging: false,
  dragStart: null,
  boxSelectEnabled: false,
  boxSelectDraft: null,
  boxGrid: null,
  hoverBoxTile: null,
  spaceDown: false,
  theme: "light",
};

Object.defineProperty(window, "__imageToolState", {
  get() {
    return {
      scale: state.scale,
      offsetX: state.offsetX,
      offsetY: state.offsetY,
      activeIndex: state.activeIndex,
      selectedPoint: state.selectedPoint,
      hoverPoint: state.hoverPoint,
      savedClicks: state.savedClicks,
      exportSettings: state.exportSettings,
      pickedColor: state.pickedColor,
      dominantColor: state.dominantColor,
      dominantColorEnabled: state.dominantColorEnabled,
      hoverMarkerIndex: state.hoverMarkerIndex,
      guides: getActiveGuides(),
      rulerHover: state.rulerHover,
      hoverGuideIndex: state.hoverGuideIndex,
      boxSelectEnabled: state.boxSelectEnabled,
      boxSelectDraft: state.boxSelectDraft,
      boxGrid: state.boxGrid,
      hoverBoxTile: state.hoverBoxTile,
    };
  },
});

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp", "image/bmp", "image/svg+xml"]);
const THEME_STORAGE_KEY = "image-tools-theme";
const MAX_VISIBLE_BOX_TILES = 3200;

folderInput.addEventListener("change", handleFolderChange);
imageInput.addEventListener("change", handleImageChange);
fitButton.addEventListener("click", fitToView);
actualButton.addEventListener("click", () => setZoom(1, true));
zoomInButton.addEventListener("click", () => setZoom(state.scale * 1.25));
zoomOutButton.addEventListener("click", () => setZoom(state.scale / 1.25));
boxSelectButton.addEventListener("click", toggleBoxSelectMode);
sourceMenuButton.addEventListener("click", toggleSourceMenu);
themeToggle.addEventListener("click", toggleTheme);
exportButton.addEventListener("click", exportSavedClicks);
clearCacheButton.addEventListener("click", clearSavedClicks);
horizontalGridInput.addEventListener("input", saveCurrentExportSettings);
verticalGridInput.addEventListener("input", saveCurrentExportSettings);
physicalHeightInput.addEventListener("input", saveCurrentExportSettings);
dominantColorToggle.addEventListener("change", handleDominantColorToggle);
dominantColorField.addEventListener("click", copyDominantColor);
copyColorButton.addEventListener("click", copyDominantColor);
dominantColorPicker.addEventListener("input", () => setManualDominantColor(dominantColorPicker.value));
pickedColorField.addEventListener("click", copyPickedColor);
pickedColorPicker.addEventListener("input", () => setManualPickedColor(pickedColorPicker.value));
sidebarResizer.addEventListener("pointerdown", startSidebarResize);
sidebarResizer.addEventListener("pointermove", resizeSidebar);
sidebarResizer.addEventListener("pointerup", finishSidebarResize);
sidebarResizer.addEventListener("pointercancel", finishSidebarResize);
sidebarResizer.addEventListener("keydown", handleSidebarResizeKey);
window.addEventListener("resize", resizeAll);
window.addEventListener("keydown", (event) => {
  if (event.code === "Space") {
    state.spaceDown = true;
    canvasWrap.classList.add("pan-mode");
  }
});
window.addEventListener("keyup", (event) => {
  if (event.code === "Space") {
    state.spaceDown = false;
    canvasWrap.classList.remove("pan-mode");
  }
});

canvasWrap.addEventListener("wheel", handleWheel, { passive: false });
canvasWrap.addEventListener("pointerdown", handlePointerDown);
canvasWrap.addEventListener("pointermove", handlePointerMove);
canvasWrap.addEventListener("pointerup", handlePointerUp);
canvasWrap.addEventListener("pointercancel", handlePointerUp);
canvasWrap.addEventListener("pointerleave", () => {
  state.hoverMarkerIndex = -1;
  state.hoverBoxTile = null;
  canvasWrap.style.cursor = "";
  canvasWrap.classList.remove("marker-hover");
  hideLoupe();
  draw();
});
canvasWrap.addEventListener("dblclick", fitToView);
topRuler.addEventListener("pointermove", (event) => handleRulerPointerMove("x", event));
leftRuler.addEventListener("pointermove", (event) => handleRulerPointerMove("y", event));
topRuler.addEventListener("pointerleave", clearRulerHover);
leftRuler.addEventListener("pointerleave", clearRulerHover);
topRuler.addEventListener("click", (event) => handleRulerClick("x", event));
leftRuler.addEventListener("click", (event) => handleRulerClick("y", event));
document.addEventListener("dragenter", handleDocumentDragEnter);
document.addEventListener("dragover", handleDocumentDragOver);
document.addEventListener("dragleave", handleDocumentDragLeave);
document.addEventListener("drop", handleDocumentDrop);
document.addEventListener("click", closeSourceMenuOnOutsideClick);
document.addEventListener("keydown", handleSourceMenuKeydown);

function initTheme() {
  let savedTheme = null;
  try {
    savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    savedTheme = null;
  }
  state.theme = savedTheme === "dark" ? "dark" : "light";
  applyTheme();
}

function toggleTheme() {
  state.theme = state.theme === "dark" ? "light" : "dark";
  try {
    localStorage.setItem(THEME_STORAGE_KEY, state.theme);
  } catch {
    // Theme still switches for the current page if storage is unavailable.
  }
  applyTheme();
  draw();
}

function applyTheme() {
  document.documentElement.dataset.theme = state.theme;
  document.body.dataset.theme = state.theme;
  themeToggle.setAttribute("aria-pressed", String(state.theme === "dark"));
  themeToggle.setAttribute("aria-label", state.theme === "dark" ? "切换白色模式" : "切换黑色模式");
  themeToggle.setAttribute("title", state.theme === "dark" ? "切换白色模式" : "切换黑色模式");
  themeToggle.dataset.tooltip = state.theme === "dark" ? "切换白色模式" : "切换黑色模式";
}

function startSidebarResize(event) {
  if (event.button !== 0 || window.matchMedia("(max-width: 850px)").matches) return;
  state.sidebarResizing = true;
  sidebarResizer.setPointerCapture(event.pointerId);
  sidebarResizer.classList.add("active");
  document.body.classList.add("resizing-sidebar");
}

function resizeSidebar(event) {
  if (!state.sidebarResizing) return;

  const rect = workspace.getBoundingClientRect();
  const minWidth = Math.min(292, rect.width * 0.4);
  const maxWidth = rect.width * 0.4;
  const nextWidth = clamp(rect.right - event.clientX, minWidth, maxWidth);
  workspace.style.setProperty("--sidebar-width", `${Math.round(nextWidth)}px`);
  sidebarResizer.setAttribute("aria-valuenow", String(Math.round((nextWidth / rect.width) * 100)));
  resizeAll();
}

function finishSidebarResize(event) {
  if (!state.sidebarResizing) return;
  state.sidebarResizing = false;
  if (sidebarResizer.hasPointerCapture(event.pointerId)) {
    sidebarResizer.releasePointerCapture(event.pointerId);
  }
  sidebarResizer.classList.remove("active");
  document.body.classList.remove("resizing-sidebar");
  if (state.bitmap) fitToView();
}

function handleSidebarResizeKey(event) {
  if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
  event.preventDefault();

  const rect = workspace.getBoundingClientRect();
  const currentWidth = parseFloat(getComputedStyle(workspace).getPropertyValue("--sidebar-width")) || 292;
  const direction = event.key === "ArrowLeft" ? 1 : -1;
  const nextWidth = clamp(currentWidth + direction * 20, Math.min(292, rect.width * 0.4), rect.width * 0.4);
  workspace.style.setProperty("--sidebar-width", `${Math.round(nextWidth)}px`);
  sidebarResizer.setAttribute("aria-valuenow", String(Math.round((nextWidth / rect.width) * 100)));
  resizeAll();
  if (state.bitmap) fitToView();
}

async function handleFolderChange(event) {
  setSourceMenuOpen(false);
  await loadImageFiles(Array.from(event.target.files || []), "文件夹中未找到图片");
  event.target.value = "";
}

async function handleImageChange(event) {
  setSourceMenuOpen(false);
  await loadImageFiles(Array.from(event.target.files || []), "未选择可读取的图片");
  event.target.value = "";
}

function toggleSourceMenu() {
  setSourceMenuOpen(sourceMenu.hidden);
}

function setSourceMenuOpen(isOpen) {
  sourceMenu.hidden = !isOpen;
  sourceMenuButton.setAttribute("aria-expanded", String(isOpen));
}

function closeSourceMenuOnOutsideClick(event) {
  if (sourceMenu.hidden) return;
  if (sourceMenu.contains(event.target) || sourceMenuButton.contains(event.target)) return;
  setSourceMenuOpen(false);
}

function handleSourceMenuKeydown(event) {
  if (event.key !== "Escape" || sourceMenu.hidden) return;
  setSourceMenuOpen(false);
  sourceMenuButton.focus();
}

async function loadImageFiles(sourceFiles, emptyMessage) {
  cleanupObjectUrls();
  const files = sourceFiles
    .filter((file) => IMAGE_TYPES.has(file.type) || /\.(jpe?g|png|gif|webp|bmp|svg)$/i.test(file.name))
    .sort((a, b) => getDisplayPath(a).localeCompare(getDisplayPath(b), "zh-CN", { numeric: true }));

  state.images = files.map((file) => ({
    file,
    url: URL.createObjectURL(file),
    name: getDisplayPath(file),
    width: 0,
    height: 0,
    exportSettings: {
      horizontalGridCount: 1,
      verticalGridCount: 1,
      physicalHeight: null,
    },
    guides: {
      x: [],
      y: [],
    },
  }));

  state.activeIndex = -1;
  state.bitmap = null;
  state.selectedPoint = null;
  state.hoverPoint = null;
  state.pickedColor = null;
  state.dominantColor = null;
  state.colorJobId += 1;
  resetOverlaySampleCache();
  state.hoverMarkerIndex = -1;
  clearBoxSelection();
  clearRulerHover();
  hideLoupe();
  updatePickedColorField();
  updateDominantColorField("平均色：未计算");
  updateExportSettingsInputs();
  updateActionButtons();
  renderThumbs();
  imageCount.textContent = String(state.images.length);

  if (state.images.length > 0) {
    removeEmptyState();
    await selectImage(0);
  } else {
    ensureEmptyState();
    readout.textContent = emptyMessage;
    draw();
  }
}

function getDisplayPath(file) {
  return file.__displayPath || file.webkitRelativePath || file.name;
}

function handleDocumentDragEnter(event) {
  if (!hasDraggedFiles(event)) return;
  event.preventDefault();
  document.body.classList.add("is-dragging-files");
}

function handleDocumentDragOver(event) {
  if (!hasDraggedFiles(event)) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = "copy";
}

function handleDocumentDragLeave(event) {
  if (!hasDraggedFiles(event)) return;
  if (event.relatedTarget && document.body.contains(event.relatedTarget)) return;
  document.body.classList.remove("is-dragging-files");
}

async function handleDocumentDrop(event) {
  if (!hasDraggedFiles(event)) return;
  event.preventDefault();
  document.body.classList.remove("is-dragging-files");
  readout.textContent = "解析拖拽内容中";
  const files = await getDroppedFiles(event.dataTransfer);
  await loadImageFiles(files, "拖拽内容中未找到图片");
}

function hasDraggedFiles(event) {
  return Array.from(event.dataTransfer?.types || []).includes("Files");
}

async function getDroppedFiles(dataTransfer) {
  const items = Array.from(dataTransfer?.items || []);
  const entries = items
    .map((item) => (typeof item.webkitGetAsEntry === "function" ? item.webkitGetAsEntry() : null))
    .filter(Boolean);

  if (entries.length > 0) {
    const nestedFiles = await Promise.all(entries.map((entry) => readEntryFiles(entry)));
    return nestedFiles.flat();
  }

  return Array.from(dataTransfer?.files || []);
}

async function readEntryFiles(entry, basePath = "") {
  if (entry.isFile) {
    const file = await readFileEntry(entry);
    setDisplayPath(file, `${basePath}${file.name}`);
    return [file];
  }

  if (!entry.isDirectory) return [];

  const nextBase = `${basePath}${entry.name}/`;
  const entries = await readDirectoryEntries(entry);
  const nestedFiles = await Promise.all(entries.map((child) => readEntryFiles(child, nextBase)));
  return nestedFiles.flat();
}

function readFileEntry(entry) {
  return new Promise((resolve, reject) => {
    entry.file(resolve, reject);
  });
}

function readDirectoryEntries(entry) {
  const reader = entry.createReader();
  const entries = [];

  return new Promise((resolve, reject) => {
    const readBatch = () => {
      reader.readEntries(
        (batch) => {
          if (batch.length === 0) {
            resolve(entries);
            return;
          }
          entries.push(...batch);
          readBatch();
        },
        reject,
      );
    };

    readBatch();
  });
}

function setDisplayPath(file, displayPath) {
  try {
    Object.defineProperty(file, "__displayPath", {
      value: displayPath,
      configurable: true,
    });
  } catch {
    file.__displayPath = displayPath;
  }
}

function cleanupObjectUrls() {
  for (const item of state.images) {
    URL.revokeObjectURL(item.url);
  }
}

function renderThumbs() {
  thumbList.replaceChildren();
  const groups = buildImageGroups();

  for (const group of groups) {
    const details = document.createElement("details");
    details.className = "image-group";
    details.open = true;

    const summary = document.createElement("summary");
    summary.className = "image-group-title";

    const path = document.createElement("span");
    path.className = "image-group-path";
    path.textContent = group.path;

    const count = document.createElement("span");
    count.className = "image-group-count";
    count.textContent = String(group.items.length);

    summary.append(path, count);
    details.appendChild(summary);

    for (const { item, index } of group.items) {
      details.appendChild(createThumb(item, index));
    }

    thumbList.appendChild(details);
  }
}

function buildImageGroups() {
  const groups = new Map();

  state.images.forEach((item, index) => {
    const parts = item.name.split(/[\\/]/);
    const fileName = parts.pop() || item.name;
    const groupPath = parts.join(" / ") || "当前文件夹";

    if (!groups.has(groupPath)) {
      groups.set(groupPath, []);
    }

    groups.get(groupPath).push({
      item: {
        ...item,
        displayName: fileName,
      },
      index,
    });
  });

  return Array.from(groups, ([path, items]) => ({ path, items }));
}

function createThumb(item, index) {
  const button = document.createElement("button");
  button.className = "thumb";
  button.type = "button";
  button.dataset.index = String(index);
  button.addEventListener("click", () => selectImage(index));

  const img = document.createElement("img");
  img.src = item.url;
  img.alt = item.name;

  const name = document.createElement("div");
  name.className = "thumb-name";
  name.textContent = item.displayName || item.name;
  name.title = item.name;

  const meta = document.createElement("span");
  meta.className = "thumb-meta";
  meta.textContent = "读取中";
  name.appendChild(meta);

  button.append(img, name);

  const probe = new Image();
  probe.onload = () => {
    const source = state.images[index];
    if (!source) return;
    source.width = probe.naturalWidth;
    source.height = probe.naturalHeight;
    meta.textContent = `${source.width} x ${source.height}`;
    updateReadout();
  };
  probe.src = item.url;

  return button;
}

async function selectImage(index) {
  if (index < 0 || index >= state.images.length) return;

  state.activeIndex = index;
  state.selectedPoint = null;
  state.hoverPoint = null;
  state.hoverMarkerIndex = -1;
  clearBoxSelection();
  clearRulerHover();
  state.pickedColor = null;
  state.bitmap = null;
  state.dominantColor = null;
  resetOverlaySampleCache();
  const colorJobId = ++state.colorJobId;
  hideLoupe();
  updatePickedColorField();
  updateDominantColorField(state.dominantColorEnabled ? "平均色：计算中" : "平均色：未计算");
  updateExportSettingsInputs();
  updateActionButtons();
  updateActiveThumb();
  updateReadout("载入图片中");

  const item = state.images[index];
  const image = new Image();
  image.decoding = "async";
  image.src = item.url;
  try {
    await image.decode();
  } catch (error) {
    updateReadout("图片载入失败");
    draw();
    return;
  }

  item.width = image.naturalWidth;
  item.height = image.naturalHeight;
  state.bitmap = image;
  removeEmptyState();
  resizeAll();
  fitToView();
  if (state.dominantColorEnabled) {
    computeDominantColor(image, colorJobId);
  }
  updateActiveThumb();
}

function removeEmptyState() {
  emptyState?.remove();
  emptyState = null;
}

function ensureEmptyState() {
  if (emptyState) return;

  emptyState = document.createElement("div");
  emptyState.className = "empty-state";
  emptyState.id = "emptyState";

  const title = document.createElement("strong");
  title.textContent = "选择包含图片的文件夹";

  const detail = document.createElement("span");
  detail.textContent = "支持 JPG、PNG、GIF、WebP、BMP、SVG 等浏览器可读取格式";

  emptyState.append(title, detail);
  canvasWrap.appendChild(emptyState);
}

function updateActiveThumb() {
  thumbList.querySelectorAll(".thumb").forEach((node) => {
    node.classList.toggle("active", Number(node.dataset.index) === state.activeIndex);
  });
}

function resizeAll() {
  resizeCanvasToDisplaySize(imageCanvas);
  resizeCanvasToDisplaySize(topRuler);
  resizeCanvasToDisplaySize(leftRuler);
  draw();
}

function resizeCanvasToDisplaySize(canvas) {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.round(rect.width * dpr));
  const height = Math.max(1, Math.round(rect.height * dpr));

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function fitToView() {
  if (!state.bitmap) return;

  const rect = canvasWrap.getBoundingClientRect();
  const margin = 84;
  const scaleX = (rect.width - margin) / state.bitmap.naturalWidth;
  const scaleY = (rect.height - margin) / state.bitmap.naturalHeight;
  state.scale = clamp(Math.min(scaleX, scaleY), 0.02, 20);
  state.offsetX = (rect.width - state.bitmap.naturalWidth * state.scale) / 2;
  state.offsetY = (rect.height - state.bitmap.naturalHeight * state.scale) / 2;
  draw();
  updateReadout();
}

function setZoom(nextScale, centerImage = false, screenPoint = null) {
  if (!state.bitmap) return;

  const oldScale = state.scale;
  const rect = canvasWrap.getBoundingClientRect();
  const point = screenPoint || { x: rect.width / 2, y: rect.height / 2 };
  const imagePoint = {
    x: (point.x - state.offsetX) / oldScale,
    y: (point.y - state.offsetY) / oldScale,
  };

  state.scale = clamp(nextScale, 0.02, 40);

  if (centerImage) {
    state.offsetX = (rect.width - state.bitmap.naturalWidth * state.scale) / 2;
    state.offsetY = (rect.height - state.bitmap.naturalHeight * state.scale) / 2;
  } else {
    state.offsetX = point.x - imagePoint.x * state.scale;
    state.offsetY = point.y - imagePoint.y * state.scale;
  }

  draw();
  updateReadout();
}

function handleWheel(event) {
  if (!state.bitmap) return;
  event.preventDefault();

  const rect = canvasWrap.getBoundingClientRect();
  const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };

  if (event.ctrlKey || event.metaKey) {
    const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
    setZoom(state.scale * factor, false, point);
  } else {
    state.offsetX -= event.deltaX;
    state.offsetY -= event.deltaY;
    draw();
  }
}

function handlePointerDown(event) {
  if (!state.bitmap) return;

  canvasWrap.setPointerCapture(event.pointerId);
  const canPan = event.button === 1 || event.shiftKey || state.spaceDown;
  const canBoxSelect = event.button === 0 && state.boxSelectEnabled && !canPan;
  const rect = canvasWrap.getBoundingClientRect();
  const imagePoint = screenToImage(event.clientX - rect.left, event.clientY - rect.top);
  const boxAction = canBoxSelect ? getBoxPointerAction(imagePoint) : null;

  state.dragging = true;
  state.dragStart = {
    x: event.clientX,
    y: event.clientY,
    offsetX: state.offsetX,
    offsetY: state.offsetY,
    moved: false,
    canPan,
    canBoxSelect,
    imageStart: imagePoint,
    boxAction: boxAction?.type || "create",
    boxHandle: boxAction?.handle || null,
    boxOriginStart: state.boxGrid?.origin ? { ...state.boxGrid.origin } : null,
  };
  state.boxSelectDraft = canBoxSelect && imagePoint && !boxAction ? createBoxDraft(imagePoint, imagePoint) : null;
  if (canBoxSelect && !boxAction) {
    state.boxGrid = null;
    state.hoverBoxTile = null;
  }
  if (state.boxSelectDraft) {
    hideLoupe();
    draw();
  }
}

function handlePointerMove(event) {
  if (!state.bitmap) return;

  updateMarkerHover(event);
  updateBoxTileHover(event);
  updateLoupe(event);

  if (state.dragging) {
    const dx = event.clientX - state.dragStart.x;
    const dy = event.clientY - state.dragStart.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) state.dragStart.moved = true;

    if (state.dragStart.canPan && event.buttons > 0) {
      state.offsetX = state.dragStart.offsetX + dx;
      state.offsetY = state.dragStart.offsetY + dy;
      hideLoupe();
      draw();
    } else if (state.dragStart.canBoxSelect && event.buttons > 0 && state.dragStart.imageStart) {
      const rect = canvasWrap.getBoundingClientRect();
      const point = screenToImage(event.clientX - rect.left, event.clientY - rect.top, true);
      updateActiveBoxRect(point);
      hideLoupe();
      draw();
    }
  }
}

function handlePointerUp(event) {
  if (!state.bitmap || !state.dragging) return;

  canvasWrap.releasePointerCapture(event.pointerId);
  const wasPan = state.dragStart?.canPan && state.dragStart?.moved;
  const wasBoxSelect = state.dragStart?.canBoxSelect;
  state.dragging = false;

  if (wasBoxSelect && event.button === 0) {
    if (state.dragStart?.moved) {
      finishBoxSelection();
    } else {
      const rect = canvasWrap.getBoundingClientRect();
      const point = screenToImage(event.clientX - rect.left, event.clientY - rect.top);
      const tile = point && state.boxGrid ? getBoxTileAt(point) : state.hoverBoxTile;
      if (tile) applyBoxTileToExportSettings(tile);
    }
    state.boxSelectDraft = null;
    draw();
    return;
  }

  if (!wasPan && event.button === 0) {
    if (state.hoverMarkerIndex >= 0) {
      deleteSavedMarker(state.hoverMarkerIndex);
      return;
    }

    const rect = canvasWrap.getBoundingClientRect();
    const point = screenToImage(event.clientX - rect.left, event.clientY - rect.top);
    if (point) {
      state.selectedPoint = point;
      state.hoverPoint = point;
      updatePickedColor(point);
      saveCurrentClick();
    }
  }
}

function toggleBoxSelectMode() {
  state.boxSelectEnabled = !state.boxSelectEnabled;
  boxSelectButton.classList.toggle("active", state.boxSelectEnabled);
  boxSelectButton.setAttribute("aria-pressed", String(state.boxSelectEnabled));
  canvasWrap.classList.toggle("box-select-mode", state.boxSelectEnabled);
  canvasWrap.style.cursor = "";
  state.boxSelectDraft = null;
  state.hoverBoxTile = null;
  if (state.boxSelectEnabled) {
    hideLoupe();
    state.hoverMarkerIndex = -1;
    canvasWrap.classList.remove("marker-hover");
  }
  draw();
}

function clearBoxSelection() {
  state.boxSelectDraft = null;
  state.boxGrid = null;
  state.hoverBoxTile = null;
}

function createBoxDraft(start, end) {
  if (!state.bitmap || !start || !end) return null;

  const left = clamp(Math.min(start.x, end.x), 0, state.bitmap.naturalWidth);
  const top = clamp(Math.min(start.y, end.y), 0, state.bitmap.naturalHeight);
  const right = clamp(Math.max(start.x, end.x), 0, state.bitmap.naturalWidth);
  const bottom = clamp(Math.max(start.y, end.y), 0, state.bitmap.naturalHeight);

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
}

function finishBoxSelection() {
  const rect = state.boxSelectDraft;
  if (!rect && state.boxGrid) {
    state.hoverBoxTile = null;
    return;
  }
  if (!rect || rect.width < 2 || rect.height < 2) {
    state.boxGrid = null;
    state.hoverBoxTile = null;
    return;
  }

  state.boxGrid = buildBoxGrid(rect);
  state.hoverBoxTile = null;
}

function updateActiveBoxRect(point) {
  if (!point) return;

  const action = state.dragStart.boxAction;
  const start = state.dragStart.imageStart;
  const origin = state.dragStart.boxOriginStart;
  let nextRect = null;

  if (action === "move" && origin) {
    const dx = point.x - start.x;
    const dy = point.y - start.y;
    nextRect = {
      x: clamp(origin.x + dx, 0, Math.max(0, state.bitmap.naturalWidth - origin.width)),
      y: clamp(origin.y + dy, 0, Math.max(0, state.bitmap.naturalHeight - origin.height)),
      width: origin.width,
      height: origin.height,
    };
  } else if (action === "resize" && origin) {
    nextRect = resizeBoxRect(origin, state.dragStart.boxHandle, point);
  } else {
    nextRect = createBoxDraft(start, point);
  }

  if (nextRect && nextRect.width >= 2 && nextRect.height >= 2) {
    state.boxSelectDraft = nextRect;
    state.boxGrid = null;
    state.hoverBoxTile = null;
  } else {
    state.boxSelectDraft = nextRect;
    state.boxGrid = null;
    state.hoverBoxTile = null;
  }
}

function resizeBoxRect(origin, handle, point) {
  let left = origin.x;
  let top = origin.y;
  let right = origin.x + origin.width;
  let bottom = origin.y + origin.height;

  if (handle.includes("w")) left = point.x;
  if (handle.includes("e")) right = point.x;
  if (handle.includes("n")) top = point.y;
  if (handle.includes("s")) bottom = point.y;

  return createBoxDraft(
    {
      x: clamp(left, 0, state.bitmap.naturalWidth),
      y: clamp(top, 0, state.bitmap.naturalHeight),
    },
    {
      x: clamp(right, 0, state.bitmap.naturalWidth),
      y: clamp(bottom, 0, state.bitmap.naturalHeight),
    },
  );
}

function getBoxPointerAction(point) {
  if (!point || !state.boxGrid?.origin) return null;

  const handle = getBoxResizeHandleAt(point);
  if (handle) return { type: "resize", handle };
  if (isPointInRect(point, state.boxGrid.origin)) return { type: "move" };
  if (getBoxTileAt(point)) return { type: "tile" };
  return null;
}

function getBoxResizeHandleAt(point) {
  const rect = state.boxGrid?.origin;
  if (!rect) return null;

  const tolerance = Math.max(4, 8 / state.scale);
  const left = rect.x;
  const right = rect.x + rect.width;
  const top = rect.y;
  const bottom = rect.y + rect.height;
  const nearLeft = Math.abs(point.x - left) <= tolerance;
  const nearRight = Math.abs(point.x - right) <= tolerance;
  const nearTop = Math.abs(point.y - top) <= tolerance;
  const nearBottom = Math.abs(point.y - bottom) <= tolerance;
  const withinX = point.x >= left - tolerance && point.x <= right + tolerance;
  const withinY = point.y >= top - tolerance && point.y <= bottom + tolerance;

  if (nearLeft && nearTop) return "nw";
  if (nearRight && nearTop) return "ne";
  if (nearLeft && nearBottom) return "sw";
  if (nearRight && nearBottom) return "se";
  if (nearLeft && withinY) return "w";
  if (nearRight && withinY) return "e";
  if (nearTop && withinX) return "n";
  if (nearBottom && withinX) return "s";
  return null;
}

function isPointInRect(point, rect) {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

function buildBoxGrid(origin) {
  const width = Math.max(1, origin.width);
  const height = Math.max(1, origin.height);
  const cols = [];
  const rows = [];

  for (let x = origin.x, offset = 0; x < state.bitmap.naturalWidth; x += width, offset += 1) {
    cols.push({
      offset,
      x: clamp(x, 0, state.bitmap.naturalWidth),
      width: Math.min(width, state.bitmap.naturalWidth - x),
    });
  }

  for (let x = origin.x - width, offset = -1; x + width > 0; x -= width, offset -= 1) {
    cols.unshift({
      offset,
      x: Math.max(0, x),
      width: Math.min(width, x + width),
    });
  }

  for (let y = origin.y, offset = 0; y < state.bitmap.naturalHeight; y += height, offset += 1) {
    rows.push({
      offset,
      y: clamp(y, 0, state.bitmap.naturalHeight),
      height: Math.min(height, state.bitmap.naturalHeight - y),
    });
  }

  for (let y = origin.y - height, offset = -1; y + height > 0; y -= height, offset -= 1) {
    rows.unshift({
      offset,
      y: Math.max(0, y),
      height: Math.min(height, y + height),
    });
  }

  return {
    origin,
    cols: cols.filter((col) => col.width > 0),
    rows: rows.filter((row) => row.height > 0),
  };
}

function updateBoxTileHover(event) {
  if (!state.boxSelectEnabled || !state.boxGrid || state.dragging) {
    if (state.hoverBoxTile) {
      state.hoverBoxTile = null;
      draw();
    }
    if (!state.boxSelectEnabled) canvasWrap.style.cursor = "";
    return;
  }

  const rect = canvasWrap.getBoundingClientRect();
  const point = screenToImage(event.clientX - rect.left, event.clientY - rect.top);
  const tile = point ? getBoxTileAt(point) : null;
  const changed =
    tile?.colOffset !== state.hoverBoxTile?.colOffset ||
    tile?.rowOffset !== state.hoverBoxTile?.rowOffset;

  if (changed) {
    state.hoverBoxTile = tile;
    draw();
  }
}

function getBoxTileAt(point) {
  const col = state.boxGrid.cols.find((candidate) => point.x >= candidate.x && point.x <= candidate.x + candidate.width);
  const row = state.boxGrid.rows.find((candidate) => point.y >= candidate.y && point.y <= candidate.y + candidate.height);
  if (!col || !row) return null;

  const axis = Math.abs(col.offset) >= Math.abs(row.offset) ? "x" : "y";
  const number = axis === "x" ? Math.abs(col.offset) + 1 : Math.abs(row.offset) + 1;

  return {
    x: col.x,
    y: row.y,
    width: col.width,
    height: row.height,
    colOffset: col.offset,
    rowOffset: row.offset,
    axis,
    number,
  };
}

function applyBoxTileToExportSettings(tile) {
  if (!tile || tile.number < 1) return;

  const value = String(tile.number);
  if (tile.axis === "x") {
    horizontalGridInput.value = value;
  } else {
    verticalGridInput.value = value;
  }
  saveCurrentExportSettings();
  updateReadout(tile.axis === "x" ? `已填入横格 ${value}` : `已填入纵格 ${value}`);
}

function updateLoupe(event) {
  if (!state.bitmap || state.boxSelectEnabled || state.dragStart?.canPan || state.hoverMarkerIndex >= 0) {
    hideLoupe();
    return;
  }

  const rect = canvasWrap.getBoundingClientRect();
  const screenX = event.clientX - rect.left;
  const screenY = event.clientY - rect.top;
  const point = screenToImage(screenX, screenY);

  if (!point) {
    hideLoupe();
    return;
  }

  state.hoverPoint = point;
  draw();
  drawLoupe(point, screenX, screenY);
}

function hideLoupe() {
  const hadHoverPoint = state.hoverPoint !== null;
  state.hoverPoint = null;
  loupe.classList.remove("visible");
  if (hadHoverPoint) draw();
}

function updateMarkerHover(event) {
  if (!state.bitmap) return;
  if (state.boxSelectEnabled) {
    if (state.hoverMarkerIndex >= 0) {
      state.hoverMarkerIndex = -1;
      canvasWrap.classList.remove("marker-hover");
      draw();
    }
    return;
  }

  const rect = canvasWrap.getBoundingClientRect();
  const screenX = event.clientX - rect.left;
  const screenY = event.clientY - rect.top;
  const markerIndex = getMarkerAt(screenX, screenY);

  if (markerIndex !== state.hoverMarkerIndex) {
    state.hoverMarkerIndex = markerIndex;
    canvasWrap.classList.toggle("marker-hover", markerIndex >= 0);
    draw();
  }
}

function getMarkerAt(screenX, screenY) {
  const markers = getActiveMarkers();
  const radius = getMarkerRadius();

  for (let index = markers.length - 1; index >= 0; index -= 1) {
    if (!markers[index]) continue;
    const center = getMarkerCenter(markers[index]);
    const dx = screenX - center.x;
    const dy = screenY - center.y;
    if (Math.hypot(dx, dy) <= radius + 3) return index;
  }

  return -1;
}

function getMarkerCenter(marker) {
  const radius = getMarkerRadius();
  const wrapRect = canvasWrap.getBoundingClientRect();
  const outsideX = state.offsetX - radius - 8;

  return {
    x: clamp(outsideX, radius + 6, Math.max(radius + 6, wrapRect.width - radius - 6)),
    y: state.offsetY + marker.y * state.scale,
  };
}

function getMarkerRadius() {
  return Math.max(10, Math.min(16, 10 * Math.sqrt(Math.max(1, state.scale))));
}

function drawLoupe(point, screenX, screenY) {
  const cssSize = loupeCanvas.clientWidth || 168;
  const dpr = window.devicePixelRatio || 1;
  const canvasSize = Math.round(cssSize * dpr);

  if (loupeCanvas.width !== canvasSize || loupeCanvas.height !== canvasSize) {
    loupeCanvas.width = canvasSize;
    loupeCanvas.height = canvasSize;
  }

  const sampleSize = 42;
  const halfSample = sampleSize / 2;
  const sourceLeft = point.x - halfSample;
  const sourceTop = point.y - halfSample;
  const clippedLeft = clamp(sourceLeft, 0, state.bitmap.naturalWidth);
  const clippedTop = clamp(sourceTop, 0, state.bitmap.naturalHeight);
  const clippedRight = clamp(sourceLeft + sampleSize, 0, state.bitmap.naturalWidth);
  const clippedBottom = clamp(sourceTop + sampleSize, 0, state.bitmap.naturalHeight);
  const clippedWidth = clippedRight - clippedLeft;
  const clippedHeight = clippedBottom - clippedTop;
  const zoom = cssSize / sampleSize;
  const destX = (clippedLeft - sourceLeft) * zoom;
  const destY = (clippedTop - sourceTop) * zoom;

  loupeCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  loupeCtx.fillStyle = "#f8fafc";
  loupeCtx.fillRect(0, 0, cssSize, cssSize);
  loupeCtx.imageSmoothingEnabled = false;
  if (clippedWidth > 0 && clippedHeight > 0) {
    loupeCtx.drawImage(
      state.bitmap,
      clippedLeft,
      clippedTop,
      clippedWidth,
      clippedHeight,
      destX,
      destY,
      clippedWidth * zoom,
      clippedHeight * zoom,
    );
  }

  const center = cssSize / 2;
  loupeCtx.strokeStyle = "rgba(225, 29, 72, 0.9)";
  loupeCtx.lineWidth = 1;
  loupeCtx.beginPath();
  loupeCtx.moveTo(0, center + 0.5);
  loupeCtx.lineTo(cssSize, center + 0.5);
  loupeCtx.stroke();

  loupeCtx.strokeStyle = "rgba(255, 255, 255, 0.85)";
  loupeCtx.strokeRect(center - 8.5, center - 8.5, 17, 17);
  loupeCtx.strokeStyle = "rgba(17, 24, 39, 0.85)";
  loupeCtx.strokeRect(center - 9.5, center - 9.5, 19, 19);

  positionLoupe(screenX, screenY);
  loupeLabel.textContent = `左 ${point.x}px，顶 ${point.y}px`;
  loupe.classList.add("visible");
}

function positionLoupe(screenX, screenY) {
  const wrapRect = canvasWrap.getBoundingClientRect();
  const loupeWidth = loupe.offsetWidth || 184;
  const loupeHeight = loupe.offsetHeight || 214;
  const gap = 18;

  let left = screenX + gap;
  let top = screenY + gap;

  if (left + loupeWidth > wrapRect.width - 8) {
    left = screenX - loupeWidth - gap;
  }

  if (top + loupeHeight > wrapRect.height - 8) {
    top = screenY - loupeHeight - gap;
  }

  loupe.style.left = `${clamp(left, 8, Math.max(8, wrapRect.width - loupeWidth - 8))}px`;
  loupe.style.top = `${clamp(top, 8, Math.max(8, wrapRect.height - loupeHeight - 8))}px`;
}

function screenToImage(x, y, clampToImage = false) {
  if (!state.bitmap) return null;

  let imageX = (x - state.offsetX) / state.scale;
  let imageY = (y - state.offsetY) / state.scale;

  if (clampToImage) {
    imageX = clamp(imageX, 0, state.bitmap.naturalWidth);
    imageY = clamp(imageY, 0, state.bitmap.naturalHeight);
  }

  if (
    imageX < 0 ||
    imageY < 0 ||
    imageX > state.bitmap.naturalWidth ||
    imageY > state.bitmap.naturalHeight
  ) {
    return null;
  }

  return {
    x: Math.round(imageX),
    y: Math.round(imageY),
  };
}

function handleRulerPointerMove(axis, event) {
  if (!state.bitmap) {
    clearRulerHover();
    return;
  }

  const ruler = axis === "x" ? topRuler : leftRuler;
  const rect = ruler.getBoundingClientRect();
  const screenPosition = axis === "x" ? event.clientX - rect.left : event.clientY - rect.top;
  const offset = axis === "x" ? state.offsetX : state.offsetY;
  const limit = axis === "x" ? state.bitmap.naturalWidth : state.bitmap.naturalHeight;
  const value = Math.round((screenPosition - offset) / state.scale);

  if (value < 0 || value > limit) {
    clearRulerHover();
    return;
  }

  const guides = getActiveGuides()[axis];
  let hoverGuideIndex = -1;
  let closestDistance = 8;
  guides.forEach((guide, index) => {
    if (guide === null) return;
    const distance = Math.abs(screenPosition - (offset + guide * state.scale));
    if (distance <= closestDistance) {
      closestDistance = distance;
      hoverGuideIndex = index;
    }
  });

  state.rulerHover = {
    axis,
    value: hoverGuideIndex >= 0 ? guides[hoverGuideIndex] : value,
  };
  state.hoverGuideIndex = hoverGuideIndex;
  ruler.classList.toggle("guide-close-hover", hoverGuideIndex >= 0);
  draw();
}

function handleRulerClick(axis, event) {
  if (!state.bitmap || state.rulerHover?.axis !== axis) return;

  const guides = getActiveGuides()[axis];
  if (state.hoverGuideIndex >= 0) {
    guides[state.hoverGuideIndex] = null;
    state.hoverGuideIndex = -1;
  } else if (!guides.includes(state.rulerHover.value)) {
    const emptyIndex = guides.findIndex((value) => value === null);
    if (emptyIndex >= 0) {
      guides[emptyIndex] = state.rulerHover.value;
    } else {
      guides.push(state.rulerHover.value);
    }
  }

  handleRulerPointerMove(axis, event);
}

function clearRulerHover() {
  state.rulerHover = null;
  state.hoverGuideIndex = -1;
  topRuler.classList.remove("guide-close-hover");
  leftRuler.classList.remove("guide-close-hover");
  draw();
}

function getActiveGuides() {
  const item = state.images[state.activeIndex];
  return item?.guides || { x: [], y: [] };
}

function getNextGuideIndex(guides) {
  const emptyIndex = guides.findIndex((value) => value === null);
  return emptyIndex >= 0 ? emptyIndex : guides.length;
}

function getGuideColor(index, alpha = 1) {
  return rgbaFromRgb(getGuideColorRgb(index), alpha);
}

function getGuideColorRgb(index) {
  const palette = [
    [37, 137, 255],
    [249, 115, 22],
    [16, 185, 129],
    [139, 92, 246],
    [236, 72, 153],
  ];
  return palette[Math.floor(index / 2) % palette.length];
}

function resetOverlaySampleCache() {
  state.sampleCanvas = null;
  state.sampleCtx = null;
  state.sampleBitmap = null;
}

function ensureOverlaySampleContext() {
  if (!state.bitmap) return null;
  if (state.sampleCtx && state.sampleBitmap === state.bitmap) return state.sampleCtx;

  const canvas = document.createElement("canvas");
  canvas.width = state.bitmap.naturalWidth;
  canvas.height = state.bitmap.naturalHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(state.bitmap, 0, 0);
  state.sampleCanvas = canvas;
  state.sampleCtx = ctx;
  state.sampleBitmap = state.bitmap;
  return ctx;
}

function getReadableOverlayPairForLine(axis, value, semanticRgb, alpha = 1) {
  const sample = sampleLineColor(axis, value);
  return getReadableOverlayPair(sample, semanticRgb, alpha);
}

function getReadableOverlayPairForRect(rect, semanticRgb, alpha = 1) {
  const sample = sampleRectBorderColor(rect);
  return getReadableOverlayPair(sample, semanticRgb, alpha);
}

function getReadableOverlayPair(sample, semanticRgb, alpha = 1) {
  const base = sample || [248, 250, 252];
  let outer = base.map((value) => 255 - value);
  const black = [15, 23, 42];
  const white = [255, 255, 255];

  if (contrastRatio(base, outer) < 3) {
    outer = contrastRatio(base, black) > contrastRatio(base, white) ? black : white;
  }

  let inner = semanticRgb;
  if (contrastRatio(base, inner) < 1.7 && contrastRatio(outer, inner) < 1.7) {
    inner = mixRgb(semanticRgb, outer, 0.45);
  }

  return {
    outer: rgbaFromRgb(outer, 0.58),
    inner: rgbaFromRgb(inner, alpha),
    outerRgb: outer,
    innerRgb: inner,
  };
}

function sampleLineColor(axis, value) {
  if (!state.bitmap) return null;
  const width = state.bitmap.naturalWidth;
  const height = state.bitmap.naturalHeight;
  const samples = 48;
  const points = [];

  for (let index = 0; index < samples; index += 1) {
    const ratio = samples === 1 ? 0 : index / (samples - 1);
    points.push(
      axis === "x"
        ? [value, ratio * (height - 1)]
        : [ratio * (width - 1), value],
    );
  }

  return sampleAverageColor(points);
}

function sampleRectBorderColor(rect) {
  if (!state.bitmap || !rect) return null;
  const samples = 16;
  const points = [];
  const right = rect.x + rect.width;
  const bottom = rect.y + rect.height;

  for (let index = 0; index < samples; index += 1) {
    const ratio = samples === 1 ? 0 : index / (samples - 1);
    const x = rect.x + rect.width * ratio;
    const y = rect.y + rect.height * ratio;
    points.push([x, rect.y], [x, bottom], [rect.x, y], [right, y]);
  }

  return sampleAverageColor(points);
}

function sampleAverageColor(points) {
  const ctx = ensureOverlaySampleContext();
  if (!ctx || points.length === 0) return null;

  let red = 0;
  let green = 0;
  let blue = 0;
  let count = 0;

  try {
    points.forEach(([x, y]) => {
      const px = clamp(Math.round(x), 0, state.bitmap.naturalWidth - 1);
      const py = clamp(Math.round(y), 0, state.bitmap.naturalHeight - 1);
      const data = ctx.getImageData(px, py, 1, 1).data;
      red += data[0];
      green += data[1];
      blue += data[2];
      count += 1;
    });
  } catch (error) {
    return null;
  }

  return count > 0
    ? [Math.round(red / count), Math.round(green / count), Math.round(blue / count)]
    : null;
}

function rgbaFromRgb(rgb, alpha = 1) {
  return `rgba(${Math.round(rgb[0])}, ${Math.round(rgb[1])}, ${Math.round(rgb[2])}, ${alpha})`;
}

function cssVar(name) {
  return getComputedStyle(document.body).getPropertyValue(name).trim();
}

function getRulerColors() {
  return {
    background: cssVar("--ruler-bg") || "#ffffff",
    tick: cssVar("--ruler-tick") || "rgba(20, 20, 20, 0.22)",
    text: cssVar("--ruler-text") || "rgba(20, 20, 20, 0.64)",
    labelBackground: cssVar("--ruler-label-bg") || "rgba(255, 255, 255, 0.94)",
  };
}

function getThemeSurfaceRgb() {
  return state.theme === "dark" ? [20, 20, 20] : [255, 255, 255];
}

function mixRgb(first, second, amount) {
  return first.map((value, index) => Math.round(value * (1 - amount) + second[index] * amount));
}

function relativeLuminance(rgb) {
  const [red, green, blue] = rgb.map((value) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(first, second) {
  const firstLum = relativeLuminance(first);
  const secondLum = relativeLuminance(second);
  const lighter = Math.max(firstLum, secondLum);
  const darker = Math.min(firstLum, secondLum);
  return (lighter + 0.05) / (darker + 0.05);
}

function strokeScreenLine(ctx, x1, y1, x2, y2, color, lineWidth) {
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function strokeScreenRect(ctx, x, y, width, height, color, lineWidth) {
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, Math.round(width), Math.round(height));
}

function draw() {
  drawImageArea();
  drawRulers();
  updateZoomLabel();
}

function drawImageArea() {
  const rect = imageCanvas.getBoundingClientRect();
  imageCtx.clearRect(0, 0, rect.width, rect.height);

  if (!state.bitmap) return;

  imageCtx.save();
  imageCtx.imageSmoothingEnabled = state.scale < 4;
  imageCtx.drawImage(
    state.bitmap,
    state.offsetX,
    state.offsetY,
    state.bitmap.naturalWidth * state.scale,
    state.bitmap.naturalHeight * state.scale,
  );

  drawGuides();
  drawBoxSelection();
  drawSavedMarkers();
  drawHoverCrosshair(rect);

  imageCtx.restore();
}

function drawHoverCrosshair(rect) {
  if (!state.hoverPoint) return;

  const y = Math.round(state.offsetY + state.hoverPoint.y * state.scale) + 0.5;
  const colors = getReadableOverlayPairForLine("y", state.hoverPoint.y, [225, 29, 72], 0.48);

  imageCtx.save();
  strokeScreenLine(imageCtx, 0, y, rect.width, y, colors.outer, 2);
  strokeScreenLine(imageCtx, 0, y, rect.width, y, colors.inner, 0.75);
  imageCtx.restore();
}

function drawGuides() {
  const rect = imageCanvas.getBoundingClientRect();
  const guides = getActiveGuides();

  imageCtx.save();
  guides.x.forEach((value, index) => {
    if (value === null) return;
    drawGuideLine("x", value, rect, getGuideColorRgb(index), 0.68);
  });
  guides.y.forEach((value, index) => {
    if (value === null) return;
    drawGuideLine("y", value, rect, getGuideColorRgb(index), 0.68);
  });

  if (state.rulerHover) {
    const isFixed = guides[state.rulerHover.axis].includes(state.rulerHover.value);
    if (!isFixed) {
      const nextIndex = getNextGuideIndex(guides[state.rulerHover.axis]);
      drawGuideLine(state.rulerHover.axis, state.rulerHover.value, rect, getGuideColorRgb(nextIndex), 0.46);
    }
  }
  imageCtx.restore();
}

function drawGuideLine(axis, value, rect, semanticRgb, alpha = 0.92) {
  const position =
    axis === "x" ? state.offsetX + value * state.scale : state.offsetY + value * state.scale;
  if (position < 0 || position > (axis === "x" ? rect.width : rect.height)) return;

  const crispPosition = Math.round(position) + 0.5;
  const colors = getReadableOverlayPairForLine(axis, value, semanticRgb, alpha);
  if (axis === "x") {
    strokeScreenLine(imageCtx, crispPosition, 0, crispPosition, rect.height, colors.outer, 2.5);
    strokeScreenLine(imageCtx, crispPosition, 0, crispPosition, rect.height, colors.inner, 1);
  } else {
    strokeScreenLine(imageCtx, 0, crispPosition, rect.width, crispPosition, colors.outer, 2.5);
    strokeScreenLine(imageCtx, 0, crispPosition, rect.width, crispPosition, colors.inner, 1);
  }
}

function drawReadableImageLine(axis, value, semanticRgb, options = {}) {
  const rect = imageCanvas.getBoundingClientRect();
  const position = axis === "x" ? state.offsetX + value * state.scale : state.offsetY + value * state.scale;
  if (position < 0 || position > (axis === "x" ? rect.width : rect.height)) return;

  const crispPosition = Math.round(position) + 0.5;
  const colors = getReadableOverlayPairForLine(axis, value, semanticRgb, options.innerAlpha ?? 0.72);
  const outerWidth = options.outerWidth ?? 2.5;
  const innerWidth = options.innerWidth ?? 1;

  if (axis === "x") {
    strokeScreenLine(imageCtx, crispPosition, 0, crispPosition, rect.height, colors.outer, outerWidth);
    strokeScreenLine(imageCtx, crispPosition, 0, crispPosition, rect.height, colors.inner, innerWidth);
  } else {
    strokeScreenLine(imageCtx, 0, crispPosition, rect.width, crispPosition, colors.outer, outerWidth);
    strokeScreenLine(imageCtx, 0, crispPosition, rect.width, crispPosition, colors.inner, innerWidth);
  }
}

function drawBoxSelection() {
  if (!state.boxSelectEnabled || (!state.boxGrid && !state.boxSelectDraft)) return;

  imageCtx.save();
  if (state.boxGrid) {
    drawBoxGrid();
  } else if (state.boxSelectDraft && state.dragStart?.boxAction !== "create") {
    drawBoxGridPreview(state.boxSelectDraft);
  }
  if (state.boxSelectDraft) {
    drawImageRect(state.boxSelectDraft, {
      fill: "rgba(14, 165, 233, 0.1)",
      semanticRgb: [2, 132, 199],
      alpha: 0.66,
      lineWidth: 1.25,
    });
  }
  imageCtx.restore();
}

function drawBoxGridPreview(origin) {
  const visibleGrid = buildVisibleBoxGrid(origin);
  const visibleTileCount = visibleGrid.cols.length * visibleGrid.rows.length;
  if (visibleTileCount > MAX_VISIBLE_BOX_TILES) {
    drawBoxGridDensityLabel(visibleTileCount);
    return;
  }

  visibleGrid.rows.forEach((row) => {
    visibleGrid.cols.forEach((col) => {
      const isOrigin = col.offset === 0 && row.offset === 0;
      drawImageRect(
        {
          x: col.x,
          y: row.y,
          width: col.width,
          height: row.height,
        },
        {
          fill: isOrigin ? "rgba(14, 165, 233, 0.08)" : "rgba(14, 165, 233, 0.025)",
          semanticRgb: [2, 132, 199],
          alpha: isOrigin ? 0.46 : 0.24,
          lineWidth: isOrigin ? 1 : 0.65,
        },
      );
    });
  });
}

function drawBoxGrid() {
  const grid = state.boxGrid;
  const visibleGrid = buildVisibleBoxGrid(grid.origin);
  const visibleTileCount = visibleGrid.cols.length * visibleGrid.rows.length;
  const canDrawTiles = visibleTileCount <= MAX_VISIBLE_BOX_TILES;

  if (!canDrawTiles) {
    drawImageRect(grid.origin, {
      fill: "rgba(14, 165, 233, 0.11)",
      semanticRgb: [2, 132, 199],
      alpha: 0.62,
      lineWidth: 1.25,
    });
    drawBoxGridDensityLabel(visibleTileCount);
    return;
  }

  visibleGrid.rows.forEach((row) => {
    visibleGrid.cols.forEach((col) => {
      const tile = {
        x: col.x,
        y: row.y,
        width: col.width,
        height: row.height,
      };
      const isOrigin = col.offset === 0 && row.offset === 0;
      const isHover =
        state.hoverBoxTile?.colOffset === col.offset &&
        state.hoverBoxTile?.rowOffset === row.offset;

      drawImageRect(tile, {
        fill: isHover ? "rgba(245, 158, 11, 0.14)" : isOrigin ? "rgba(14, 165, 233, 0.11)" : "rgba(14, 165, 233, 0.035)",
        semanticRgb: isHover ? [217, 119, 6] : [2, 132, 199],
        alpha: isHover ? 0.7 : isOrigin ? 0.62 : 0.34,
        lineWidth: isHover || isOrigin ? 1.25 : 0.75,
      });
    });
  });

  if (state.hoverBoxTile) {
    drawBoxTileLabel(state.hoverBoxTile);
  }
}

function buildVisibleBoxGrid(origin) {
  const rect = imageCanvas.getBoundingClientRect();
  const left = Math.max(0, (-state.offsetX) / state.scale);
  const top = Math.max(0, (-state.offsetY) / state.scale);
  const right = Math.min(state.bitmap.naturalWidth, (rect.width - state.offsetX) / state.scale);
  const bottom = Math.min(state.bitmap.naturalHeight, (rect.height - state.offsetY) / state.scale);
  const width = Math.max(1, origin.width);
  const height = Math.max(1, origin.height);
  const cols = [];
  const rows = [];

  const minColOffset = Math.floor((left - origin.x) / width);
  const maxColOffset = Math.ceil((right - origin.x) / width);
  const minRowOffset = Math.floor((top - origin.y) / height);
  const maxRowOffset = Math.ceil((bottom - origin.y) / height);

  for (let offset = minColOffset; offset <= maxColOffset; offset += 1) {
    const x = origin.x + offset * width;
    const colLeft = Math.max(0, x);
    const colRight = Math.min(state.bitmap.naturalWidth, x + width);
    if (colRight > colLeft) {
      cols.push({
        offset,
        x: colLeft,
        width: colRight - colLeft,
      });
    }
  }

  for (let offset = minRowOffset; offset <= maxRowOffset; offset += 1) {
    const y = origin.y + offset * height;
    const rowTop = Math.max(0, y);
    const rowBottom = Math.min(state.bitmap.naturalHeight, y + height);
    if (rowBottom > rowTop) {
      rows.push({
        offset,
        y: rowTop,
        height: rowBottom - rowTop,
      });
    }
  }

  return {
    cols,
    rows,
  };
}

function drawBoxGridDensityLabel(tileCount) {
  const rect = imageCanvas.getBoundingClientRect();
  const label = `网格过密：${tileCount} 个可见单元`;
  imageCtx.save();
  imageCtx.font = "500 12px Segoe UI, Arial, sans-serif";
  imageCtx.textBaseline = "middle";
  const textWidth = imageCtx.measureText(label).width;
  const width = textWidth + 20;
  const height = 28;
  const x = Math.max(12, rect.width - width - 12);
  const y = 12;
  imageCtx.fillStyle = state.theme === "dark" ? "rgba(255, 255, 255, 0.92)" : "rgba(20, 20, 20, 0.9)";
  roundRect(imageCtx, x, y, width, height, 8);
  imageCtx.fill();
  imageCtx.fillStyle = state.theme === "dark" ? "#141414" : "#ffffff";
  imageCtx.fillText(label, x + 10, y + height / 2);
  imageCtx.restore();
}

function drawImageRect(rect, options) {
  if (!rect || rect.width <= 0 || rect.height <= 0) return;

  const x = state.offsetX + rect.x * state.scale;
  const y = state.offsetY + rect.y * state.scale;
  const width = rect.width * state.scale;
  const height = rect.height * state.scale;

  imageCtx.fillStyle = options.fill;
  imageCtx.fillRect(x, y, width, height);
  const colors = getReadableOverlayPairForRect(rect, options.semanticRgb || [2, 132, 199], options.alpha ?? 0.92);
  strokeScreenRect(imageCtx, x, y, width, height, colors.outer, options.lineWidth + 1);
  strokeScreenRect(imageCtx, x, y, width, height, colors.inner, options.lineWidth);
}

function drawBoxTileLabel(tile) {
  const x = state.offsetX + tile.x * state.scale;
  const y = state.offsetY + tile.y * state.scale;
  const width = tile.width * state.scale;
  const height = tile.height * state.scale;
  const label = String(tile.number);

  imageCtx.font = "800 13px Segoe UI, Arial, sans-serif";
  imageCtx.textBaseline = "middle";
  imageCtx.textAlign = "center";

  const textWidth = imageCtx.measureText(label).width;
  const badgeWidth = Math.max(24, textWidth + 14);
  const badgeHeight = 22;
  const centerX = clamp(x + width / 2, badgeWidth / 2 + 4, imageCanvas.clientWidth - badgeWidth / 2 - 4);
  const centerY = clamp(y + height / 2, badgeHeight / 2 + 4, imageCanvas.clientHeight - badgeHeight / 2 - 4);

  imageCtx.fillStyle = "rgba(17, 24, 39, 0.88)";
  roundRect(imageCtx, centerX - badgeWidth / 2, centerY - badgeHeight / 2, badgeWidth, badgeHeight, 5);
  imageCtx.fill();
  imageCtx.fillStyle = "#ffffff";
  imageCtx.fillText(label, centerX, centerY + 0.5);
}

function drawSavedMarkers() {
  const markers = getActiveMarkers();
  if (markers.length === 0) return;

  const imageLeft = state.offsetX;
  const imageRight = state.offsetX + state.bitmap.naturalWidth * state.scale;
  const radius = getMarkerRadius();

  markers.forEach((marker, index) => {
    if (!marker) return;
    const y = state.offsetY + marker.y * state.scale;
    const center = getMarkerCenter(marker);
    const isHover = index === state.hoverMarkerIndex;
    const colors = getReadableOverlayPairForLine("y", marker.y, [225, 29, 72], isHover ? 0.74 : 0.56);

    imageCtx.save();
    strokeScreenLine(imageCtx, imageLeft, y + 0.5, imageRight, y + 0.5, colors.outer, isHover ? 3.5 : 3);
    strokeScreenLine(imageCtx, imageLeft, y + 0.5, imageRight, y + 0.5, colors.inner, isHover ? 1.75 : 1.25);

    imageCtx.fillStyle = isHover ? "rgba(225, 29, 72, 0.78)" : "rgba(225, 29, 72, 0.58)";
    imageCtx.strokeStyle = colors.outer;
    imageCtx.lineWidth = 2;
    imageCtx.beginPath();
    imageCtx.arc(center.x, center.y, radius, 0, Math.PI * 2);
    imageCtx.fill();
    imageCtx.stroke();

    imageCtx.strokeStyle = "#ffffff";
    imageCtx.lineWidth = 2;
    imageCtx.beginPath();
    imageCtx.moveTo(center.x - 4, center.y - 4);
    imageCtx.lineTo(center.x + 4, center.y + 4);
    imageCtx.moveTo(center.x + 4, center.y - 4);
    imageCtx.lineTo(center.x - 4, center.y + 4);
    imageCtx.stroke();
    imageCtx.restore();
  });
}

function drawRulers() {
  const rulerColors = getRulerColors();
  const topRect = topRuler.getBoundingClientRect();
  const leftRect = leftRuler.getBoundingClientRect();
  topCtx.clearRect(0, 0, topRect.width, topRect.height);
  leftCtx.clearRect(0, 0, leftRect.width, leftRect.height);

  topCtx.fillStyle = rulerColors.background;
  leftCtx.fillStyle = rulerColors.background;
  topCtx.fillRect(0, 0, topRect.width, topRect.height);
  leftCtx.fillRect(0, 0, leftRect.width, leftRect.height);

  if (!state.bitmap) return;

  drawHorizontalRuler(topCtx, topRect);
  drawVerticalRuler(leftCtx, leftRect);
}

function drawHorizontalRuler(ctx, rect) {
  const rulerColors = getRulerColors();
  const startPx = Math.max(0, Math.floor((-state.offsetX) / state.scale));
  const endPx = Math.min(state.bitmap.naturalWidth, Math.ceil((rect.width - state.offsetX) / state.scale));
  const major = chooseMajorStep(state.scale);
  const minor = major / 5;

  ctx.strokeStyle = rulerColors.tick;
  ctx.fillStyle = rulerColors.text;
  ctx.font = "11px Segoe UI, Arial, sans-serif";
  ctx.textBaseline = "top";

  for (let px = Math.ceil(startPx / minor) * minor; px <= endPx; px += minor) {
    const x = Math.round(state.offsetX + px * state.scale) + 0.5;
    const isMajor = px % major === 0;
    ctx.beginPath();
    ctx.moveTo(x, isMajor ? 10 : 18);
    ctx.lineTo(x, rect.height);
    ctx.stroke();
    if (isMajor) ctx.fillText(String(px), x + 3, 2);
  }

  drawGuideRulerMarks(ctx, "x", rect);
}

function drawVerticalRuler(ctx, rect) {
  const rulerColors = getRulerColors();
  const startPx = Math.max(0, Math.floor((-state.offsetY) / state.scale));
  const endPx = Math.min(state.bitmap.naturalHeight, Math.ceil((rect.height - state.offsetY) / state.scale));
  const major = chooseMajorStep(state.scale);
  const minor = major / 5;

  ctx.strokeStyle = rulerColors.tick;
  ctx.fillStyle = rulerColors.text;
  ctx.font = "11px Segoe UI, Arial, sans-serif";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";

  for (let px = Math.ceil(startPx / minor) * minor; px <= endPx; px += minor) {
    const y = Math.round(state.offsetY + px * state.scale) + 0.5;
    const isMajor = px % major === 0;
    ctx.beginPath();
    ctx.moveTo(isMajor ? rect.width - 28 : rect.width - 14, y);
    ctx.lineTo(rect.width, y);
    ctx.stroke();
    if (isMajor) {
      ctx.fillText(String(px), rect.width - 32, y);
    }
  }

  ctx.textAlign = "start";
  ctx.textBaseline = "alphabetic";
  drawGuideRulerMarks(ctx, "y", rect);
}

function drawGuideRulerMarks(ctx, axis, rect) {
  const guides = getActiveGuides()[axis];
  const offset = axis === "x" ? state.offsetX : state.offsetY;
  const length = axis === "x" ? rect.width : rect.height;

  guides.forEach((value, index) => {
    if (value === null) return;
    const position = offset + value * state.scale;
    if (position < 0 || position > length) return;
    const showClose =
      index === state.hoverGuideIndex && state.rulerHover?.axis === axis;
    drawGuideRulerMark(ctx, axis, rect, position, value, showClose, getGuideColorRgb(index));
  });

  if (state.rulerHover?.axis === axis && !guides.includes(state.rulerHover.value)) {
    const position = offset + state.rulerHover.value * state.scale;
    const nextIndex = getNextGuideIndex(guides);
    drawGuideRulerMark(
      ctx,
      axis,
      rect,
      position,
      state.rulerHover.value,
      false,
      getGuideColorRgb(nextIndex),
    );
  }
}

function drawGuideRulerMark(ctx, axis, rect, position, value, showClose, colorRgb) {
  const rulerColors = getRulerColors();
  const colors = getReadableOverlayPair(getThemeSurfaceRgb(), colorRgb, 0.76);
  const color = colors.inner;
  ctx.save();
  ctx.strokeStyle = colors.outer;
  ctx.lineWidth = 2.5;
  ctx.font = "700 11px Segoe UI, Arial, sans-serif";
  ctx.textBaseline = "top";

  ctx.beginPath();
  if (axis === "x") {
    ctx.moveTo(position, 0);
    ctx.lineTo(position, rect.height);
  } else {
    ctx.moveTo(0, position);
    ctx.lineTo(rect.width, position);
  }
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  if (axis === "x") {
    ctx.moveTo(position, 0);
    ctx.lineTo(position, rect.height);
  } else {
    ctx.moveTo(0, position);
    ctx.lineTo(rect.width, position);
  }
  ctx.stroke();

  const label = String(value);
  if (axis === "x") {
    const textWidth = ctx.measureText(label).width;
    const textX = clamp(position - textWidth / 2, 2, Math.max(2, rect.width - textWidth - 2));
    ctx.fillStyle = rulerColors.labelBackground;
    ctx.fillRect(textX - 3, 0, textWidth + 16, 14);
    ctx.fillStyle = color;
    ctx.fillText(label, textX, 1);
  } else {
    const textWidth = ctx.measureText(label).width;
    const textY = clamp(position - 7, 0, Math.max(0, rect.height - 14));
    ctx.fillStyle = rulerColors.labelBackground;
    ctx.fillRect(0, textY, rect.width, 14);
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(textWidth + 8, position);
    ctx.lineTo(rect.width, position);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.fillText(label, 3, textY + 1);
  }

  if (showClose) {
    const closeX = axis === "x" ? position : rect.width - 10;
    const closeY = axis === "x" ? rect.height - 9 : position;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(closeX, closeY, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(closeX - 2.5, closeY - 2.5);
    ctx.lineTo(closeX + 2.5, closeY + 2.5);
    ctx.moveTo(closeX + 2.5, closeY - 2.5);
    ctx.lineTo(closeX - 2.5, closeY + 2.5);
    ctx.stroke();
  }
  ctx.restore();
}

function chooseMajorStep(scale) {
  const targetScreenPixels = 90;
  const raw = targetScreenPixels / scale;
  const power = 10 ** Math.floor(Math.log10(raw));
  const ratio = raw / power;

  if (ratio <= 1) return power;
  if (ratio <= 2) return 2 * power;
  if (ratio <= 5) return 5 * power;
  return 10 * power;
}

function updateZoomLabel() {
  zoomLabel.textContent = `${Math.round(state.scale * 100)}%`;
}

function updateReadout(prefix = "") {
  const item = state.images[state.activeIndex];
  if (!item) {
    readout.textContent = "未选择图片";
    return;
  }

  const size = item.width && item.height ? `${item.width} x ${item.height}` : "读取尺寸中";
  if (prefix) {
    readout.textContent = prefix;
    return;
  }

  readout.replaceChildren(
    document.createTextNode(size),
  );

  if (state.selectedPoint) {
    const point = document.createElement("strong");
    point.className = "readout-point";
    point.textContent = ` | 左 ${state.selectedPoint.x}px，顶 ${state.selectedPoint.y}px`;
    readout.appendChild(point);
  }

}

function updatePickedColor(point) {
  if (!state.bitmap || !point) {
    state.pickedColor = null;
    updatePickedColorField();
    return;
  }

  const sample = document.createElement("canvas");
  const ctx = sample.getContext("2d", { willReadFrequently: true });
  const x = clamp(point.x, 0, state.bitmap.naturalWidth - 1);
  const y = clamp(point.y, 0, state.bitmap.naturalHeight - 1);

  sample.width = 1;
  sample.height = 1;
  ctx.drawImage(state.bitmap, x, y, 1, 1, 0, 0, 1, 1);

  const [red, green, blue, alpha] = ctx.getImageData(0, 0, 1, 1).data;
  const hex = rgbToHex(red, green, blue);
  state.pickedColor = {
    hex,
    alpha,
    x,
    y,
  };
  updatePickedColorField();
}

function updatePickedColorField() {
  if (!state.pickedColor) {
    pickedColorField.value = "点击颜色：未选择";
    pickedColorSwatch.style.backgroundColor = "#ffffff";
    pickedColorPicker.value = "#ffffff";
    return;
  }

  pickedColorField.value = state.pickedColor.hex;
  pickedColorSwatch.style.backgroundColor = state.pickedColor.hex;
  pickedColorPicker.value = state.pickedColor.hex;
}

function handleDominantColorToggle() {
  state.dominantColorEnabled = dominantColorToggle.checked;
  state.colorJobId += 1;
  state.dominantColor = null;
  dominantColorPanel.hidden = !state.dominantColorEnabled;

  if (!state.dominantColorEnabled) {
    updateDominantColorField("平均色：未计算");
    return;
  }

  if (!state.bitmap) {
    updateDominantColorField("平均色：未计算");
    return;
  }

  const colorJobId = state.colorJobId;
  updateDominantColorField("平均色：计算中");
  computeDominantColor(state.bitmap, colorJobId);
}

function computeDominantColor(image, colorJobId) {
  const maxPixels = 250000;
  const pixelCount = image.naturalWidth * image.naturalHeight;
  const scale = Math.min(1, Math.sqrt(maxPixels / pixelCount));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  canvas.width = width;
  canvas.height = height;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, 0, 0, width, height);

  const pixels = ctx.getImageData(0, 0, width, height).data;
  let redTotal = 0;
  let greenTotal = 0;
  let blueTotal = 0;
  let alphaTotal = 0;

  for (let index = 0; index < pixels.length; index += 4) {
    const alpha = pixels[index + 3] / 255;
    redTotal += pixels[index] * alpha;
    greenTotal += pixels[index + 1] * alpha;
    blueTotal += pixels[index + 2] * alpha;
    alphaTotal += alpha;
  }

  if (colorJobId !== state.colorJobId) return;

  const divisor = alphaTotal || width * height;
  const red = Math.round(redTotal / divisor);
  const green = Math.round(greenTotal / divisor);
  const blue = Math.round(blueTotal / divisor);
  const hex = rgbToHex(red, green, blue);
  state.dominantColor = {
    hex,
    sampleWidth: width,
    sampleHeight: height,
  };
  updateDominantColorField();
}

function updateDominantColorField(text = "") {
  if (text) {
    dominantColorField.value = text;
    dominantColorSwatch.style.backgroundColor = "#ffffff";
    dominantColorPicker.value = "#ffffff";
    return;
  }

  if (!state.dominantColor) {
    dominantColorField.value = "平均色：未计算";
    dominantColorSwatch.style.backgroundColor = "#ffffff";
    dominantColorPicker.value = "#ffffff";
    return;
  }

  dominantColorField.value = state.dominantColor.hex;
  dominantColorSwatch.style.backgroundColor = state.dominantColor.hex;
  dominantColorPicker.value = state.dominantColor.hex;
}

async function copyDominantColor() {
  dominantColorField.select();
  dominantColorField.setSelectionRange(0, dominantColorField.value.length);

  try {
    await navigator.clipboard.writeText(dominantColorField.value);
  } catch (error) {
    document.execCommand("copy");
  }
}

async function copyPickedColor() {
  pickedColorField.select();
  pickedColorField.setSelectionRange(0, pickedColorField.value.length);

  try {
    await navigator.clipboard.writeText(pickedColorField.value);
  } catch (error) {
    document.execCommand("copy");
  }
}

function setManualDominantColor(hex) {
  const normalized = hex.toUpperCase();
  state.dominantColor = {
    hex: normalized,
    sampleWidth: 0,
    sampleHeight: 0,
  };
  dominantColorField.value = normalized;
  dominantColorSwatch.style.backgroundColor = normalized;
}

function setManualPickedColor(hex) {
  const normalized = hex.toUpperCase();
  state.pickedColor = {
    hex: normalized,
    alpha: 255,
    x: null,
    y: null,
  };
  pickedColorField.value = normalized;
  pickedColorSwatch.style.backgroundColor = normalized;
}

function rgbToHex(red, green, blue) {
  return `#${[red, green, blue]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}`;
}

function saveCurrentClick() {
  const item = state.images[state.activeIndex];
  if (!item || !state.selectedPoint) return;

  if (!state.savedClicks[item.name]) {
    state.savedClicks[item.name] = [null, null];
  }

  const markers = state.savedClicks[item.name];
  const nextIndex = markers.findIndex((marker) => !marker);
  const targetIndex = nextIndex >= 0 ? nextIndex : 1;
  markers[targetIndex] = {
    index: targetIndex + 1,
    y: state.selectedPoint.y,
  };

  draw();
  updateReadout();
  updateActionButtons();
}

function exportSavedClicks() {
  if (state.images.length === 0) return;

  const payload = {
    exportedAt: new Date().toISOString(),
    ...buildExportFolders(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "image-clicks.json";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function buildExportFolders() {
  const result = {};

  state.images.forEach((item) => {
    const folderKey = getExportFolderKey(item.name);
    const imageKey = getExportImageKey(item.name);

    if (!result[folderKey]) {
      result[folderKey] = { images: {} };
    }

    result[folderKey].images[imageKey] = buildImageExport(
      item,
      state.savedClicks[item.name] || [],
    );
  });

  return result;
}

function buildImageExport(item, markers = []) {
  const width = item?.width || null;
  const height = item?.height || null;
  const sortedY = markers.filter(Boolean).map((marker) => marker.y).sort((a, b) => a - b);
  const hasMarkers = sortedY.length > 0;
  const firstY = hasMarkers ? sortedY[0] : 0;
  const secondY = hasMarkers ? (sortedY[1] ?? null) : 0;
  const settings = getExportSettings(item);
  const scaleDenominator =
    settings.physicalHeight !== null && height
      ? Number((settings.physicalHeight / height).toFixed(8))
      : null;

  return {
    width,
    height,
    topStartPixel: 0,
    topEndPixel: firstY,
    midStartPixel: firstY,
    midEndPixel: secondY,
    bottomStartPixel: secondY,
    bottomEndPixel: height,
    horizontalGridCount: settings.horizontalGridCount,
    verticalGridCount: settings.verticalGridCount,
    scaleDenominator,
    splitAreas: buildSplitAreas(item.guides?.x || []),
  };
}

function buildSplitAreas(guides) {
  const areas = [];
  for (let index = 0; index < guides.length; index += 2) {
    const first = guides[index];
    const second = guides[index + 1];
    if (!Number.isFinite(first) || !Number.isFinite(second)) continue;
    areas.push([Math.min(first, second), Math.max(first, second)]);
  }
  return areas;
}

function getExportSettings(item) {
  if (!item.exportSettings) {
    item.exportSettings = {
      horizontalGridCount: 1,
      verticalGridCount: 1,
      physicalHeight: null,
    };
  }

  return item.exportSettings;
}

function updateExportSettingsInputs() {
  const item = state.images[state.activeIndex];
  if (!item) {
    horizontalGridInput.value = "1";
    verticalGridInput.value = "1";
    physicalHeightInput.value = "";
    return;
  }

  const settings = getExportSettings(item);
  horizontalGridInput.value = String(settings.horizontalGridCount);
  verticalGridInput.value = String(settings.verticalGridCount);
  physicalHeightInput.value = settings.physicalHeight === null ? "" : String(settings.physicalHeight);
}

function saveCurrentExportSettings() {
  const item = state.images[state.activeIndex];
  if (!item) return;

  item.exportSettings = {
    horizontalGridCount: parsePositiveDecimal(horizontalGridInput.value, 1),
    verticalGridCount: parsePositiveDecimal(verticalGridInput.value, 1),
    physicalHeight: parseOptionalNonNegativeDecimal(physicalHeightInput.value),
  };
}

function parsePositiveDecimal(value, fallback) {
  const parsed = Number(String(value).trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseOptionalNonNegativeDecimal(value) {
  const normalized = String(value).trim();
  if (normalized === "") return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function getExportFolderKey(imageName) {
  const parts = imageName.split(/[\\/]/);
  parts.pop();
  return parts.join("/") || "root";
}

function getExportImageKey(imageName) {
  return getFileName(imageName);
}

function getFileName(imageName) {
  const parts = imageName.split(/[\\/]/);
  return parts[parts.length - 1] || imageName;
}

function deleteSavedMarker(markerIndex) {
  const item = state.images[state.activeIndex];
  if (!item || !state.savedClicks[item.name]) return;

  state.savedClicks[item.name][markerIndex] = null;

  if (!state.savedClicks[item.name].some(Boolean)) {
    delete state.savedClicks[item.name];
  }

  state.hoverMarkerIndex = -1;
  canvasWrap.classList.remove("marker-hover");
  hideLoupe();
  draw();
  updateReadout();
  updateActionButtons();
}

function clearSavedClicks() {
  if (!hasSavedClicks()) return;
  if (!window.confirm("确认清空已保存的点击缓存吗？")) return;

  state.savedClicks = {};
  state.hoverMarkerIndex = -1;
  canvasWrap.classList.remove("marker-hover");
  draw();
  updateReadout();
  updateActionButtons();
}

function updateActionButtons() {
  const hasData = hasSavedClicks();
  exportButton.hidden = state.images.length === 0;
  clearCacheButton.hidden = !hasData;
}

function getSavedClickCount(imageName) {
  return (state.savedClicks[imageName] || []).filter(Boolean).length;
}

function hasSavedClicks() {
  return Object.values(state.savedClicks).some((clicks) => clicks.some(Boolean));
}

function getActiveMarkers() {
  const item = state.images[state.activeIndex];
  if (!item) return [];
  return state.savedClicks[item.name] || [];
}

function roundRect(ctx, x, y, width, height, radius) {
  const size = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + size, y);
  ctx.lineTo(x + width - size, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + size);
  ctx.lineTo(x + width, y + height - size);
  ctx.quadraticCurveTo(x + width, y + height, x + width - size, y + height);
  ctx.lineTo(x + size, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - size);
  ctx.lineTo(x, y + size);
  ctx.quadraticCurveTo(x, y, x + size, y);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

initTheme();
resizeAll();
updateActionButtons();
