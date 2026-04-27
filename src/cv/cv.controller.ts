import { 
  Controller, 
  Post, 
  UseInterceptors, 
  UploadedFile, 
  BadRequestException 
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import 'multer'; 
import * as mammoth from 'mammoth';

// Thư viện mới import rất sạch sẽ, không báo lỗi
import pdfExtraction from 'pdf-extraction'; 

@Controller('cv')
export class CvController {

  @Post('process')
  @UseInterceptors(FileInterceptor('file')) 
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    
    if (!file) {
      throw new BadRequestException('Không tìm thấy file tải lên');
    }

    try {
      let rawText = '';
      const mimetype = file.mimetype;

      if (mimetype === 'text/plain') {
        rawText = file.buffer.toString('utf-8');
      } 
      
      else if (mimetype === 'application/pdf') {
        // Gọi trực tiếp, cực kỳ nhẹ đầu
        const pdfData = await pdfExtraction(file.buffer);
        rawText = pdfData.text;
      } 
      
      else if (
        mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
        file.originalname.endsWith('.docx')
      ) {
        const result = await mammoth.extractRawText({ buffer: file.buffer });
        rawText = result.value;
      } 
      
      else {
        throw new BadRequestException('Chỉ hỗ trợ định dạng .txt, .pdf, và .docx');
      }

      const cleanText = rawText.replace(/\n\s*\n/g, '\n').trim();
      console.log(cleanText);
      
      return {
        message: 'Trích xuất văn bản thành công',
        fileName: file.originalname,
        fileType: mimetype,
        text: cleanText, 
      };

    } catch (error) {
      console.error('Lỗi khi đọc file:', error);
      throw new BadRequestException('Không thể đọc nội dung file này. File có thể bị hỏng hoặc có mật khẩu.');
    }
  }
}