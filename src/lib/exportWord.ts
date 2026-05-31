/**
 * Exports an HTML document as a .doc file that Word/LibreOffice can open and edit.
 * Uses the application/msword MIME type — no external dependencies needed.
 */
export function downloadAsWord(html: string, filename: string) {
  // Ensure the HTML has Word-compatible meta charset and namespace
  const wordHtml = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:w="urn:schemas-microsoft-com:office:word"
          xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="UTF-8">
      <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
      <!--[if gte mso 9]>
      <xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml>
      <![endif]-->
      ${html.match(/<style[\s\S]*?<\/style>/i)?.[0] ?? ''}
    </head>
    <body>
      ${html.replace(/<html[\s\S]*?<body[^>]*>/i, '').replace(/<\/body>[\s\S]*$/i, '')}
    </body>
    </html>`;

  const blob = new Blob(['﻿', wordHtml], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
