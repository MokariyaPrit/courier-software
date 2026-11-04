import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { DocumentMailPdfService } from './document-mail-pdf.service';
import { MailService } from './mail.service';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [MailService, DocumentMailPdfService],
  exports: [MailService, DocumentMailPdfService],
})
export class MailModule {}
