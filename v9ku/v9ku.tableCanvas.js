import { createCanvas } from 'canvas';
import { drawTextWithEmojis, measureTextWithEmojis } from './v9ku.canvasText.js';

const DEFAULT_OPTIONS = {
  cellWidth: 100,
  cellHeight: 40,
  offsetLeft: 8,
  offsetTop: 26,
  titleSpacing: 10,
  fontFamily: '"Noto Sans", Helvetica, Arial, sans-serif',
  paddingVertical: 0,
  paddingHorizontal: 0,
  backgroundColor: '#ffffff',
};

const getColumnWidth = (column, cellWidth) =>
  column === '|' ? 1 : column.width ?? cellWidth;

const getTableWidth = (columns, cellWidth) =>
  columns?.reduce((sum, column) => sum + getColumnWidth(column, cellWidth), 0) ?? cellWidth;

const getTableHeight = (title, columns, dataSource, cellHeight, titleSpacing) => {
  const titleHeight = title ? cellHeight + titleSpacing : 0;
  const headerHeight =
    !columns?.length || columns.every((column) => typeof column === 'object' && !column.title)
      ? 0
      : cellHeight;
  const bodyHeight =
    dataSource?.reduce((height, row) => height + (row === '-' ? 1 : cellHeight), 0) ?? 0;

  return titleHeight + headerHeight + bodyHeight;
};

export async function renderTable(table, options = {}) {
  const config = { ...DEFAULT_OPTIONS, ...options };
  const {
    cellWidth,
    cellHeight,
    offsetLeft,
    offsetTop,
    titleSpacing,
    fontFamily,
    paddingHorizontal,
    paddingVertical,
    backgroundColor,
  } = config;

  const { title, titleStyle = {}, columns, dataSource } = table;
  const width = getTableWidth(columns, cellWidth);
  const height = getTableHeight(title, columns, dataSource, cellHeight, titleSpacing);
  const canvas = createCanvas(width + 2 * paddingHorizontal, height + 2 * paddingVertical);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const columnOffsets = columns.map((_, index) =>
    columns.reduce(
      (offset, column, columnIndex) =>
        offset + (columnIndex >= index ? 0 : getColumnWidth(column, cellWidth)),
      paddingHorizontal,
    ),
  );

  const titleHeight = title ? cellHeight + titleSpacing : 0;
  const headerHeight =
    !columns?.length || columns.every((column) => typeof column === 'object' && !column.title)
      ? 0
      : cellHeight;

  const rowOffsets = dataSource.map((_, rowIndex) =>
    paddingVertical +
    titleHeight +
    headerHeight +
    dataSource.reduce(
      (offset, row, currentIndex) =>
        offset + (currentIndex >= rowIndex ? 0 : row === '-' ? 1 : cellHeight),
      0,
    ),
  );

  if (title) {
    ctx.font = titleStyle.font ?? `bold 24px ${fontFamily}`;
    ctx.fillStyle = titleStyle.fillStyle ?? '#000000';
    ctx.textAlign = titleStyle.textAlign ?? 'left';
    await drawTextWithEmojis(
      ctx,
      title,
      paddingHorizontal + offsetLeft,
      paddingVertical + offsetTop + (titleStyle.offsetTop ?? 0),
      { fontSize: 24 },
    );
  }

  ctx.font = `normal 16px ${fontFamily}`;
  ctx.fillStyle = '#333333';

  for (const [index, column] of columns.entries()) {
    if (typeof column !== 'object' || !column.title) {
      continue;
    }

    const columnWidth = column.width ?? cellWidth;
    await drawTextWithEmojis(
      ctx,
      column.title,
      columnOffsets[index],
      rowOffsets[0] - cellHeight + offsetTop,
      {
        fontSize: 16,
        maxWidth: columnWidth,
        align: column.align ?? 'left',
      },
    );
  }

  for (const [rowIndex, row] of dataSource.entries()) {
    if (!row || row === '-') {
      continue;
    }

    for (const [columnIndex, column] of columns.entries()) {
      if (typeof column !== 'object') {
        continue;
      }

      const value = row[column.dataIndex];
      if (!value) {
        continue;
      }

      const columnWidth = column.width ?? cellWidth;
      const content = `${column.prefix ?? ''}${value}${column.suffix ?? ''}`;

      await drawTextWithEmojis(
        ctx,
        content,
        columnOffsets[columnIndex],
        rowOffsets[rowIndex] + offsetTop,
        {
          fontSize: 16,
          maxWidth: columnWidth - 2 * offsetLeft,
          align: column.align ?? 'left',
        },
      );
    }
  }

  return canvas;
}

export async function measureColumnTitleWidth(ctx, title, minWidth = 100, padding = 16) {
  const measured = await measureTextWithEmojis(ctx, title, 16);
  return Math.max(minWidth, measured + padding);
}
