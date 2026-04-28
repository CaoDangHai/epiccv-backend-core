import * as mammoth from 'mammoth';
import pdfExtraction from 'pdf-extraction';

export async function extractTextFromFile(file: Express.Multer.File): Promise<string> {
  const mimetype = file.mimetype;

  let rawText = '';

  if (mimetype === 'text/plain') {
    rawText = file.buffer.toString('utf-8');
  } else if (mimetype === 'application/pdf') {
    const pdfData = await pdfExtraction(file.buffer);
    rawText = pdfData.text;
  } else if (
    mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    file.originalname.endsWith('.docx')
  ) {
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    rawText = result.value;
  } else if (
    mimetype === 'application/msword' ||
    file.originalname.endsWith('.doc')
  ) {
    // .doc cũ - mammoth cũng xử lý được một phần
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    rawText = result.value;
  } else {
    throw new Error('Chỉ hỗ trợ định dạng .txt, .pdf, .doc và .docx');
  }

  return rawText.replace(/\n\s*\n/g, '\n').trim();
}