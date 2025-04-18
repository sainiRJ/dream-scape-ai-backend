function sanitizeMarkdownToHTML(text) {
  if (!text) return '';

  // Remove triple backticks
  text = text.replace(/```html|```/g, '');

  // Remove markdown headers like ###, ##
  text = text.replace(/^#{1,6}\s*/gm, '');

  // Convert **bold** to <strong>
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // Convert bullets to list items
  text = text.replace(/(?:^|\n)[*-] (.*)/g, (match, item) => `<ul><li>${item.trim()}</li></ul>`);

  // Convert newlines to <br>
  text = text.replace(/\n/g, '<br>');

  // 🧼 REMOVE ALL <br> BETWEEN "Table Heading" AND <table>
  // This fixes the extra space
  text = text.replace(/(Milestone Table<br>)(<br>)+(?=<table>)/gi, '$1');

  // Remove <br> before <table>
  text = text.replace(/(<br\s*\/?>\s*)+(?=<table>)/gi, '');

  // Remove <br> after </table>
  text = text.replace(/(<br\s*\/?>\s*)+(?=<\/table>)/gi, '');

  // Remove extra breaks before numbered headings (5. Practitioner Notes etc.)
  text = text.replace(/(<br\s*\/?>\s*){2,}(?=\d+\.\s)/g, '<br>');

  return text;
}

module.exports = sanitizeMarkdownToHTML;
