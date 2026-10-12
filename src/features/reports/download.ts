/** Starts a browser download of text content. The BOM is already inside `content` (FR-RPT-04). */
export function downloadText(
  filename: string,
  content: string,
  mime = 'text/csv;charset=utf-8'
): void {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
