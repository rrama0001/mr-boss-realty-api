function formatDeveloperAiLines(project = {}) {
  const lines = [];

  if (project.developer_website) {
    lines.push(`Developer Website: ${project.developer_website}`);
  }

  if (project.developer_notes) {
    lines.push(`Developer Notes (use when relevant): ${project.developer_notes}`);
  }

  return lines;
}

function appendDeveloperAiContext(project, dataText) {
  const lines = formatDeveloperAiLines(project);
  if (!lines.length) return dataText;

  let next = dataText;
  for (const line of lines) {
    next += `   ${line}\n`;
  }
  return next;
}

module.exports = {
  appendDeveloperAiContext,
  formatDeveloperAiLines,
};
