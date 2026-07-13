const imageInput = document.getElementById("imageInput");
const openImageButton = document.getElementById("openImageButton");
const fitButton = document.getElementById("fitButton");
const actualButton = document.getElementById("actualButton");
const zoomInButton = document.getElementById("zoomInButton");
const zoomOutButton = document.getElementById("zoomOutButton");
const zoomLabel = document.getElementById("zoomLabel");
const undoPointButton = document.getElementById("undoPointButton");
const exportButton = document.getElementById("exportButton");
const clearButton = document.getElementById("clearButton");
const readout = document.getElementById("readout");
const themeToggle = document.getElementById("themeToggle");
const canvasWrap = document.getElementById("canvasWrap");
const landCanvas = document.getElementById("landCanvas");
const copyDataButton = document.getElementById("copyDataButton");
const landDataTitle = document.getElementById("landDataTitle");
const landDataOutput = document.getElementById("landDataOutput");
const ctx = landCanvas.getContext("2d");

const THEME_STORAGE_KEY = "image-tools-theme";
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp", "image/bmp", "image/svg+xml"]);
const LAND_COLORS = [
  [37, 137, 255],
  [249, 115, 22],
  [16, 185, 129],
  [236, 72, 153],
  [139, 92, 246],
  [245, 158, 11],
  [14, 165, 233],
  [132, 204, 22],
];

const state = {
  image: null,
  imageName: "",
  imageUrl: "",
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  areas: [],
  draft: [],
  hoverPoint: null,
  closeHover: false,
  hoverAreaIndex: -1,
  hoverDeleteIndex: -1,
  hoverVertex: null,
  selectedAreaIndex: -1,
  dragging: false,
  dragStart: null,
  spaceDown: false,
  theme: "light",
};

Object.defineProperty(window, "__landToolState", {
  get() {
    return {
      scale: state.scale,
      offsetX: state.offsetX,
      offsetY: state.offsetY,
      areas: state.areas,
      draft: state.draft,
      closeHover: state.closeHover,
      hoverAreaIndex: state.hoverAreaIndex,
      hoverDeleteIndex: state.hoverDeleteIndex,
      hoverVertex: state.hoverVertex,
      selectedAreaIndex: state.selectedAreaIndex,
      imageName: state.imageName,
    };
  },
});

imageInput.addEventListener("change", handleImageChange);
openImageButton.addEventListener("click", () => imageInput.click());
fitButton.addEventListener("click", fitToView);
actualButton.addEventListener("click", () => setZoom(1, true));
zoomInButton.addEventListener("click", () => setZoom(state.scale * 1.25));
zoomOutButton.addEventListener("click", () => setZoom(state.scale / 1.25));
undoPointButton.addEventListener("click", undoPoint);
exportButton.addEventListener("click", exportJson);
clearButton.addEventListener("click", clearAreas);
copyDataButton.addEventListener("click", copyCurrentAreaData);
themeToggle.addEventListener("click", toggleTheme);
window.addEventListener("resize", resizeCanvas);
window.addEventListener("keydown", handleKeyDown);
window.addEventListener("keyup", handleKeyUp);
canvasWrap.addEventListener("wheel", handleWheel, { passive: false });
canvasWrap.addEventListener("pointerdown", handlePointerDown);
canvasWrap.addEventListener("pointermove", handlePointerMove);
canvasWrap.addEventListener("pointerup", handlePointerUp);
canvasWrap.addEventListener("pointercancel", handlePointerUp);
canvasWrap.addEventListener("contextmenu", handleContextMenu);
canvasWrap.addEventListener("pointerleave", () => {
  state.hoverPoint = null;
  state.closeHover = false;
  state.hoverAreaIndex = -1;
  state.hoverDeleteIndex = -1;
  state.hoverVertex = null;
  canvasWrap.classList.remove("close-hover");
  canvasWrap.classList.remove("delete-hover");
  canvasWrap.classList.remove("vertex-hover");
  canvasWrap.classList.remove("area-hover");
  draw();
});
document.addEventListener("dragover", handleDragOver);
document.addEventListener("drop", handleDrop);

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

async function handleImageChange(event) {
  const file = Array.from(event.target.files || []).find(isImageFile);
  event.target.value = "";
  if (!file) return;
  await loadImage(file);
}

function isImageFile(file) {
  return IMAGE_TYPES.has(file.type) || /\.(jpe?g|png|gif|webp|bmp|svg)$/i.test(file.name);
}

async function loadImage(file) {
  if (state.imageUrl) URL.revokeObjectURL(state.imageUrl);

  state.imageUrl = URL.createObjectURL(file);
  state.imageName = file.name;
  state.image = null;
  state.areas = [];
  state.draft = [];
  state.hoverPoint = null;
  state.closeHover = false;
  state.hoverAreaIndex = -1;
  state.hoverDeleteIndex = -1;
  state.hoverVertex = null;
  state.selectedAreaIndex = -1;
  updateReadout("载入图片中");
  updateDataPanel();

  const image = new Image();
  image.decoding = "async";
  image.src = state.imageUrl;

  try {
    await image.decode();
  } catch {
    updateReadout("图片载入失败");
    return;
  }

  state.image = image;
  resizeCanvas();
  fitToView();
  updateButtons();
}

function handleDragOver(event) {
  if (!Array.from(event.dataTransfer?.types || []).includes("Files")) return;
  event.preventDefault();
}

async function handleDrop(event) {
  if (!Array.from(event.dataTransfer?.types || []).includes("Files")) return;
  event.preventDefault();
  const file = Array.from(event.dataTransfer.files || []).find(isImageFile);
  if (file) await loadImage(file);
}

function resizeCanvas() {
  const rect = landCanvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  landCanvas.width = Math.max(1, Math.round(rect.width * dpr));
  landCanvas.height = Math.max(1, Math.round(rect.height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  draw();
}

function fitToView() {
  if (!state.image) return;

  const rect = canvasWrap.getBoundingClientRect();
  const margin = 72;
  const scaleX = (rect.width - margin) / state.image.naturalWidth;
  const scaleY = (rect.height - margin) / state.image.naturalHeight;
  state.scale = clamp(Math.min(scaleX, scaleY), 0.02, 40);
  state.offsetX = (rect.width - state.image.naturalWidth * state.scale) / 2;
  state.offsetY = (rect.height - state.image.naturalHeight * state.scale) / 2;
  draw();
  updateReadout();
}

function setZoom(nextScale, centerImage = false, screenPoint = null) {
  if (!state.image) return;

  const oldScale = state.scale;
  const rect = canvasWrap.getBoundingClientRect();
  const point = screenPoint || { x: rect.width / 2, y: rect.height / 2 };
  const imagePoint = {
    x: (point.x - state.offsetX) / oldScale,
    y: (point.y - state.offsetY) / oldScale,
  };

  state.scale = clamp(nextScale, 0.02, 40);
  if (centerImage) {
    state.offsetX = (rect.width - state.image.naturalWidth * state.scale) / 2;
    state.offsetY = (rect.height - state.image.naturalHeight * state.scale) / 2;
  } else {
    state.offsetX = point.x - imagePoint.x * state.scale;
    state.offsetY = point.y - imagePoint.y * state.scale;
  }
  draw();
  updateReadout();
}

function handleWheel(event) {
  if (!state.image) return;
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
  if (event.button === 2) return;

  const canPan = event.button === 1 || event.shiftKey || state.spaceDown;
  const rect = canvasWrap.getBoundingClientRect();
  const screenX = event.clientX - rect.left;
  const screenY = event.clientY - rect.top;
  const point = screenToImage(screenX, screenY);
  const vertex = getVertexAt(screenX, screenY);
  const deleteIndex = getDeleteIconAt(screenX, screenY);
  const areaIndex = vertex?.areaIndex ?? (deleteIndex >= 0 ? deleteIndex : getAreaAt(point));

  canvasWrap.setPointerCapture(event.pointerId);
  state.dragging = true;
  state.dragStart = {
    x: event.clientX,
    y: event.clientY,
    screenX,
    screenY,
    imageStart: point,
    offsetX: state.offsetX,
    offsetY: state.offsetY,
    canPan,
    action: getPointerAction(canPan, vertex, deleteIndex, areaIndex),
    areaIndex,
    vertexIndex: vertex?.vertexIndex ?? -1,
    originalPoints: areaIndex >= 0 ? state.areas[areaIndex].points.map((areaPoint) => ({ ...areaPoint })) : null,
    moved: false,
  };
}

function handlePointerMove(event) {
  if (state.dragging && state.dragStart?.canPan && event.buttons > 0) {
    const dx = event.clientX - state.dragStart.x;
    const dy = event.clientY - state.dragStart.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) state.dragStart.moved = true;
    state.offsetX = state.dragStart.offsetX + dx;
    state.offsetY = state.dragStart.offsetY + dy;
    draw();
    return;
  }

  if (state.dragging && event.buttons > 0) {
    const rect = canvasWrap.getBoundingClientRect();
    const point = screenToImage(event.clientX - rect.left, event.clientY - rect.top);
    if (!point) return;

    const dx = event.clientX - state.dragStart.x;
    const dy = event.clientY - state.dragStart.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) state.dragStart.moved = true;

    if (state.dragStart.action === "vertex") {
      moveAreaVertex(state.dragStart.areaIndex, state.dragStart.vertexIndex, point);
      draw();
      updateDataPanel(state.dragStart.areaIndex);
      return;
    }

    if (state.dragStart.action === "area") {
      moveArea(state.dragStart.areaIndex, point);
      draw();
      updateDataPanel(state.dragStart.areaIndex);
      return;
    }
  }

  updateHover(event);
}

function handlePointerUp(event) {
  if (!state.dragging) return;
  if (event.button === 2) {
    state.dragging = false;
    return;
  }

  if (canvasWrap.hasPointerCapture(event.pointerId)) {
    canvasWrap.releasePointerCapture(event.pointerId);
  }

  const wasPan = state.dragStart?.canPan && state.dragStart?.moved;
  const action = state.dragStart?.action;
  const wasDrawingClick = !state.dragStart?.canPan;
  state.dragging = false;
  if (wasPan || !wasDrawingClick) return;
  if (["area", "vertex"].includes(action) && state.dragStart?.moved) {
    updateHover(event);
    updateReadout();
    updateButtons();
    return;
  }

  const rect = canvasWrap.getBoundingClientRect();
  const screenX = event.clientX - rect.left;
  const screenY = event.clientY - rect.top;
  const point = screenToImage(screenX, screenY);
  if (!point) return;

  if (action === "delete" && state.dragStart?.areaIndex >= 0 && state.draft.length === 0) {
    deleteArea(state.dragStart.areaIndex);
  } else if (action === "area" && state.dragStart?.areaIndex >= 0) {
    state.selectedAreaIndex = state.dragStart.areaIndex;
    updateDataPanel(state.selectedAreaIndex);
  } else if (action === "vertex" && state.dragStart?.areaIndex >= 0) {
    state.selectedAreaIndex = state.dragStart.areaIndex;
    updateDataPanel(state.selectedAreaIndex);
  } else if (isCloseToFirst(screenX, screenY) && state.draft.length >= 3) {
    finishArea();
  } else {
    state.draft.push(point);
    state.hoverPoint = point;
    state.closeHover = false;
    state.hoverAreaIndex = -1;
    state.hoverDeleteIndex = -1;
  }
  draw();
  updateReadout();
  updateButtons();
}

function updateHover(event) {
  const rect = canvasWrap.getBoundingClientRect();
  const screenX = event.clientX - rect.left;
  const screenY = event.clientY - rect.top;
  const point = screenToImage(screenX, screenY);
  const vertex = getVertexAt(screenX, screenY);
  state.hoverPoint = point;
  state.closeHover = point ? isCloseToFirst(screenX, screenY) : false;
  state.hoverVertex = vertex;
  state.hoverDeleteIndex = getDeleteIconAt(screenX, screenY);
  state.hoverAreaIndex = vertex?.areaIndex ?? (state.hoverDeleteIndex >= 0 ? state.hoverDeleteIndex : getAreaAt(point));

  canvasWrap.classList.toggle("close-hover", state.closeHover);
  canvasWrap.classList.toggle("delete-hover", state.hoverDeleteIndex >= 0);
  canvasWrap.classList.toggle("vertex-hover", Boolean(vertex));
  canvasWrap.classList.toggle("area-hover", !vertex && state.hoverDeleteIndex < 0 && state.hoverAreaIndex >= 0);
  if (state.hoverAreaIndex >= 0) updateDataPanel(state.hoverAreaIndex);
  draw();
}

function handleContextMenu(event) {
  event.preventDefault();
  if (state.draft.length > 0) {
    state.draft.pop();
  } else if (state.selectedAreaIndex >= 0) {
    state.selectedAreaIndex = -1;
  }
  state.closeHover = false;
  canvasWrap.classList.remove("close-hover");
  draw();
  updateReadout();
  updateButtons();
  updateDataPanel();
}

function getPointerAction(canPan, vertex, deleteIndex, areaIndex) {
  if (canPan) return "pan";
  if (vertex) return "vertex";
  if (deleteIndex >= 0) return "delete";
  if (areaIndex >= 0 && state.draft.length === 0) return "area";
  return "draw";
}

function moveAreaVertex(areaIndex, vertexIndex, point) {
  const area = state.areas[areaIndex];
  if (!area?.points[vertexIndex]) return;
  area.points[vertexIndex] = point;
}

function moveArea(areaIndex, point) {
  const area = state.areas[areaIndex];
  if (!area || !state.dragStart?.originalPoints || !state.dragStart.imageStart) return;

  const dx = point.x - state.dragStart.imageStart.x;
  const dy = point.y - state.dragStart.imageStart.y;
  area.points = state.dragStart.originalPoints.map((areaPoint) => clampPoint({
    x: areaPoint.x + dx,
    y: areaPoint.y + dy,
  }));
}

function isCloseToFirst(screenX, screenY) {
  if (state.draft.length < 3) return false;
  const first = imageToScreen(state.draft[0]);
  return Math.hypot(screenX - first.x, screenY - first.y) <= getCloseRadius();
}

function finishArea() {
  if (state.draft.length < 3) return;

  const index = state.areas.length;
  state.areas.push({
    id: index + 1,
    color: rgbToHex(...getAreaColor(index)),
    points: state.draft.map((point) => ({ x: point.x, y: point.y })),
  });
  state.draft = [];
  state.hoverPoint = null;
  state.closeHover = false;
  state.selectedAreaIndex = index;
  canvasWrap.classList.remove("close-hover");
  draw();
  updateReadout();
  updateButtons();
  updateDataPanel(index);
}

function deleteArea(index) {
  if (index < 0 || index >= state.areas.length) return;
  state.areas.splice(index, 1);
  state.areas.forEach((area, areaIndex) => {
    area.id = areaIndex + 1;
    area.color = rgbToHex(...getAreaColor(areaIndex));
  });
  state.hoverAreaIndex = -1;
  state.hoverDeleteIndex = -1;
  if (state.selectedAreaIndex === index) {
    state.selectedAreaIndex = -1;
  } else if (state.selectedAreaIndex > index) {
    state.selectedAreaIndex -= 1;
  }
  canvasWrap.classList.remove("delete-hover");
  draw();
  updateReadout();
  updateButtons();
  updateDataPanel();
}

function undoPoint() {
  if (state.draft.length > 0) {
    state.draft.pop();
  } else {
    state.areas.pop();
    if (state.selectedAreaIndex >= state.areas.length) state.selectedAreaIndex = state.areas.length - 1;
  }
  state.closeHover = false;
  state.hoverAreaIndex = -1;
  state.hoverDeleteIndex = -1;
  canvasWrap.classList.remove("close-hover");
  canvasWrap.classList.remove("delete-hover");
  draw();
  updateReadout();
  updateButtons();
  updateDataPanel();
}

function clearAreas() {
  if (!hasData()) return;
  if (!window.confirm("确认清空已圈地块吗？")) return;
  state.areas = [];
  state.draft = [];
  state.hoverPoint = null;
  state.closeHover = false;
  state.hoverAreaIndex = -1;
  state.hoverDeleteIndex = -1;
  state.selectedAreaIndex = -1;
  canvasWrap.classList.remove("close-hover");
  canvasWrap.classList.remove("delete-hover");
  draw();
  updateReadout();
  updateButtons();
  updateDataPanel();
}

function exportJson() {
  if (!state.image && state.areas.length === 0) return;

  const payload = buildExportPayload();

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "image-land-areas.json";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function copyCurrentAreaData() {
  const area = getCurrentDisplayArea();
  if (!area) return;

  const text = JSON.stringify(buildAreaData(area.area, area.index), null, 2);
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }
}

function buildExportPayload() {
  return {
    exportedAt: new Date().toISOString(),
    image: {
      name: state.imageName,
      width: state.image?.naturalWidth || landCanvas.clientWidth,
      height: state.image?.naturalHeight || landCanvas.clientHeight,
    },
    areas: state.areas.map((area, index) => buildAreaData(area, index)),
  };
}

function buildAreaData(area, index) {
  return {
    id: area.id || index + 1,
    color: area.color || rgbToHex(...getAreaColor(index)),
    points: area.points,
    bounds: getPolygonBounds(area.points),
    areaPixels: getPolygonArea(area.points),
  };
}

function getCurrentDisplayArea() {
  const index =
    state.hoverAreaIndex >= 0
      ? state.hoverAreaIndex
      : state.selectedAreaIndex >= 0
        ? state.selectedAreaIndex
        : -1;
  const area = index >= 0 ? state.areas[index] : null;
  return area ? { area, index } : null;
}

function updateDataPanel(preferredIndex = null) {
  if (Number.isInteger(preferredIndex)) state.selectedAreaIndex = preferredIndex;

  const current = getCurrentDisplayArea();
  if (!current) {
    landDataTitle.textContent = "地块数据";
    landDataOutput.textContent = "悬浮或点击地块查看数据";
    copyDataButton.disabled = true;
    return;
  }

  landDataTitle.textContent = `地块 ${current.index + 1}`;
  landDataOutput.textContent = JSON.stringify(buildAreaData(current.area, current.index), null, 2);
  copyDataButton.disabled = false;
}

function draw() {
  const rect = landCanvas.getBoundingClientRect();
  ctx.clearRect(0, 0, rect.width, rect.height);

  ctx.save();
  if (state.image) {
    ctx.imageSmoothingEnabled = state.scale < 4;
    ctx.drawImage(
      state.image,
      state.offsetX,
      state.offsetY,
      state.image.naturalWidth * state.scale,
      state.image.naturalHeight * state.scale,
    );
  }
  drawAreas();
  ctx.restore();
  updateZoomLabel();
}

function drawAreas() {
  state.areas.forEach((area, index) => {
    const isHover = index === state.hoverAreaIndex || index === state.hoverDeleteIndex;
    const isSelected = index === state.selectedAreaIndex;
    drawPolygon(area.points, {
      rgb: getAreaColor(index),
      fillAlpha: isHover || isSelected ? 0.12 : 0.06,
      lineAlpha: isHover || isSelected ? 0.82 : 0.58,
      closed: true,
      lineWidth: isHover || isSelected ? 1.6 : 1.2,
    });
    if (isHover || isSelected) {
      drawClosedVertices(area.points, getAreaColor(index), index);
      drawDeleteIcon(area.points, index === state.hoverDeleteIndex);
    }
  });

  if (state.draft.length === 0) return;

  const points = [...state.draft];
  if (state.hoverPoint) {
    points.push(state.hoverPoint);
  }
  drawPolygon(points, {
    rgb: getAreaColor(state.areas.length),
    fillAlpha: state.draft.length >= 3 ? 0.05 : 0,
    lineAlpha: 0.68,
    closed: false,
    dashed: true,
    lineWidth: 1.2,
  });
  drawVertices(state.draft, getAreaColor(state.areas.length));
}

function drawPolygon(points, options) {
  if (points.length < 2) return;

  const screenPoints = points.map(imageToScreen);
  ctx.beginPath();
  screenPoints.forEach((point, index) => {
    if (index === 0) {
      ctx.moveTo(point.x, point.y);
    } else {
      ctx.lineTo(point.x, point.y);
    }
  });
  if (options.closed) ctx.closePath();

  if (options.fillAlpha > 0 && points.length >= 3) {
    ctx.fillStyle = rgbaFromRgb(options.rgb, options.fillAlpha);
    ctx.fill();
  }

  if (options.dashed) ctx.setLineDash([6, 5]);
  ctx.strokeStyle = rgbaFromRgb(options.rgb, options.lineAlpha);
  ctx.lineWidth = options.lineWidth;
  ctx.lineJoin = "round";
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawVertices(points, rgb) {
  const radius = getCloseRadius();
  points.forEach((point, index) => {
    const screenPoint = imageToScreen(point);
    const isFirst = index === 0 && points.length >= 3;
    ctx.fillStyle = isFirst && state.closeHover ? rgbaFromRgb(rgb, 0.72) : rgbaFromRgb(rgb, 0.46);
    ctx.strokeStyle = rgbaFromRgb(rgb, isFirst ? 0.78 : 0.54);
    ctx.lineWidth = isFirst ? 1.5 : 1.2;
    ctx.beginPath();
    ctx.arc(screenPoint.x, screenPoint.y, isFirst ? Math.min(radius, 12) : 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });
}

function drawClosedVertices(points, rgb, areaIndex) {
  points.forEach((point, vertexIndex) => {
    const screenPoint = imageToScreen(point);
    const isHover =
      state.hoverVertex?.areaIndex === areaIndex &&
      state.hoverVertex?.vertexIndex === vertexIndex;
    ctx.fillStyle = isHover ? rgbaFromRgb(rgb, 0.75) : rgbaFromRgb(rgb, 0.42);
    ctx.strokeStyle = rgbaFromRgb(rgb, isHover ? 0.86 : 0.52);
    ctx.lineWidth = isHover ? 1.6 : 1.2;
    ctx.beginPath();
    ctx.arc(screenPoint.x, screenPoint.y, isHover ? 6 : 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });
}

function drawDeleteIcon(points, active) {
  const center = getPolygonLabelPoint(points);
  const screenPoint = imageToScreen(center);
  const radius = 14;

  ctx.save();
  ctx.fillStyle = active ? "rgba(225, 29, 72, 0.96)" : "rgba(20, 20, 20, 0.86)";
  ctx.strokeStyle = state.theme === "dark" ? "rgba(255, 255, 255, 0.92)" : "rgba(255, 255, 255, 0.95)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(screenPoint.x, screenPoint.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1.8;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(screenPoint.x - 5, screenPoint.y - 4);
  ctx.lineTo(screenPoint.x + 5, screenPoint.y + 6);
  ctx.moveTo(screenPoint.x + 5, screenPoint.y - 4);
  ctx.lineTo(screenPoint.x - 5, screenPoint.y + 6);
  ctx.stroke();
  ctx.restore();
}

function getDeleteIconAt(screenX, screenY) {
  for (let index = state.areas.length - 1; index >= 0; index -= 1) {
    const center = imageToScreen(getPolygonLabelPoint(state.areas[index].points));
    if (Math.hypot(screenX - center.x, screenY - center.y) <= 16) return index;
  }
  return -1;
}

function getVertexAt(screenX, screenY) {
  const radius = 9;
  for (let areaIndex = state.areas.length - 1; areaIndex >= 0; areaIndex -= 1) {
    const points = state.areas[areaIndex].points;
    for (let vertexIndex = points.length - 1; vertexIndex >= 0; vertexIndex -= 1) {
      const screenPoint = imageToScreen(points[vertexIndex]);
      if (Math.hypot(screenX - screenPoint.x, screenY - screenPoint.y) <= radius) {
        return { areaIndex, vertexIndex };
      }
    }
  }
  return null;
}

function getAreaAt(point) {
  if (!point || state.draft.length > 0) return -1;

  for (let index = state.areas.length - 1; index >= 0; index -= 1) {
    if (isPointInPolygon(point, state.areas[index].points)) return index;
  }
  return -1;
}

function isPointInPolygon(point, polygon) {
  let inside = false;
  for (let current = 0, previous = polygon.length - 1; current < polygon.length; previous = current, current += 1) {
    const currentPoint = polygon[current];
    const previousPoint = polygon[previous];
    const crosses =
      currentPoint.y > point.y !== previousPoint.y > point.y &&
      point.x < ((previousPoint.x - currentPoint.x) * (point.y - currentPoint.y)) / (previousPoint.y - currentPoint.y) + currentPoint.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

function getPolygonLabelPoint(points) {
  if (!points || points.length === 0) return { x: 0, y: 0 };

  const bounds = getPolygonBounds(points);
  return {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  };
}

function clampPoint(point) {
  if (!state.image) {
    return {
      x: Math.round(clamp(point.x, 0, landCanvas.clientWidth)),
      y: Math.round(clamp(point.y, 0, landCanvas.clientHeight)),
    };
  }

  return {
    x: Math.round(clamp(point.x, 0, state.image.naturalWidth)),
    y: Math.round(clamp(point.y, 0, state.image.naturalHeight)),
  };
}

function screenToImage(x, y) {
  if (!state.image) {
    return {
      x: Math.round(clamp(x, 0, landCanvas.clientWidth)),
      y: Math.round(clamp(y, 0, landCanvas.clientHeight)),
    };
  }

  const imageX = clamp((x - state.offsetX) / state.scale, 0, state.image.naturalWidth);
  const imageY = clamp((y - state.offsetY) / state.scale, 0, state.image.naturalHeight);
  return {
    x: Math.round(imageX),
    y: Math.round(imageY),
  };
}

function imageToScreen(point) {
  if (!state.image) {
    return {
      x: point.x,
      y: point.y,
    };
  }

  return {
    x: state.offsetX + point.x * state.scale,
    y: state.offsetY + point.y * state.scale,
  };
}

function getCloseRadius() {
  return clamp(10 + state.scale * 0.8, 10, 18);
}

function getAreaColor(index) {
  return LAND_COLORS[index % LAND_COLORS.length];
}

function updateZoomLabel() {
  zoomLabel.textContent = `${Math.round(state.scale * 100)}%`;
}

function updateReadout(prefix = "") {
  if (prefix) {
    readout.textContent = prefix;
    return;
  }

  if (!state.image) {
    readout.textContent = `空白画布 | 地块 ${state.areas.length} 块`;
    if (state.draft.length > 0) {
      readout.textContent += `，当前 ${state.draft.length} 点`;
    }
    return;
  }

  readout.textContent = `${state.image.naturalWidth} x ${state.image.naturalHeight} | 地块 ${state.areas.length} 块`;
  if (state.draft.length > 0) {
    readout.textContent += `，当前 ${state.draft.length} 点`;
  }
}

function updateButtons() {
  undoPointButton.disabled = !hasData();
  exportButton.disabled = !state.image && !hasData();
  clearButton.disabled = !hasData();
}

function hasData() {
  return state.areas.length > 0 || state.draft.length > 0;
}

function handleKeyDown(event) {
  if (event.code === "Space") {
    state.spaceDown = true;
    canvasWrap.classList.add("pan-mode");
  } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
    event.preventDefault();
    undoPoint();
  } else if (event.key === "Escape") {
    state.draft = [];
    state.closeHover = false;
    canvasWrap.classList.remove("close-hover");
    draw();
    updateReadout();
    updateButtons();
    updateDataPanel();
  }
}

function handleKeyUp(event) {
  if (event.code !== "Space") return;
  state.spaceDown = false;
  canvasWrap.classList.remove("pan-mode");
}

function getPolygonBounds(points) {
  if (points.length === 0) return null;
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  const right = Math.max(...xs);
  const bottom = Math.max(...ys);
  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
}

function getPolygonArea(points) {
  if (points.length < 3) return 0;
  let sum = 0;
  points.forEach((point, index) => {
    const next = points[(index + 1) % points.length];
    sum += point.x * next.y - next.x * point.y;
  });
  return Number((Math.abs(sum) / 2).toFixed(2));
}

function rgbToHex(red, green, blue) {
  return `#${[red, green, blue]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}`;
}

function rgbaFromRgb(rgb, alpha = 1) {
  return `rgba(${Math.round(rgb[0])}, ${Math.round(rgb[1])}, ${Math.round(rgb[2])}, ${alpha})`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

initTheme();
resizeCanvas();
updateButtons();
updateDataPanel();
