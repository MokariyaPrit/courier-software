import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import {
  decryptSmtpPassword,
  resolveSmtpCryptoSecret,
} from './smtp-crypto';

export type MailAttachment = {
  filename: string;
  content: Buffer;
  contentType?: string;
};

export type SendMailInput = {
  /** User whose SMTP credentials / From identity to use */
  issuerUserId: string;
  to: string;
  cc?: string | string[] | null;
  subject: string;
  html: string;
  text?: string;
  attachments?: MailAttachment[];
};

@Injectable()
export class MailService {
  constructor(
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    private readonly config: ConfigService,
  ) {}

  private smtpSecret() {
    return resolveSmtpCryptoSecret(
      this.config.get<string>('SMTP_CRYPTO_SECRET'),
      this.config.get<string>('JWT_ACCESS_SECRET'),
    );
  }

  async loadIssuer(userId: string) {
    const user = await this.usersRepo.findOne({
      where: { id: userId },
      relations: { userInfo: true },
    });
    if (!user) {
      throw new NotFoundException('Document issuer not found');
    }
    return user;
  }

  assertSmtpConfigured(user: User) {
    const info = user.userInfo;
    if (
      !info?.smtpHost?.trim() ||
      !info.smtpUser?.trim() ||
      !info.smtpPasswordEnc?.trim()
    ) {
      throw new BadRequestException(
        'Gmail is not configured. Open Profile → Gmail and add the Google email + App Password for the document owner.',
      );
    }
  }

  private buildTransporter(user: User): {
    transporter: Transporter;
    from: string;
  } {
    this.assertSmtpConfigured(user);
    const info = user.userInfo!;
    let password: string;
    try {
      password = decryptSmtpPassword(info.smtpPasswordEnc!, this.smtpSecret());
    } catch {
      throw new BadRequestException(
        'Stored SMTP password could not be decrypted. Re-save Gmail settings on Profile.',
      );
    }
    // Gmail app passwords are often stored/pasted with spaces
    password = password.replace(/\s+/g, '');

    // Always prefer Gmail defaults when host is missing or still Google
    const host = (info.smtpHost || 'smtp.gmail.com').trim() || 'smtp.gmail.com';
    const isGmail = /gmail\.com$/i.test(host);
    const port = info.smtpPort || (isGmail ? 587 : 587);
    const secure = isGmail ? false : Boolean(info.smtpSecure);
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user: info.smtpUser!.trim(),
        pass: password,
      },
    });

    const fromEmail =
      info.smtpFromEmail?.trim() ||
      info.smtpUser!.trim() ||
      info.email ||
      user.email;
    const fromName =
      info.companyName?.trim() || info.fullName?.trim() || 'Courier';
    const from = `"${fromName.replace(/"/g, '')}" <${fromEmail}>`;

    return { transporter, from };
  }

  async sendMail(input: SendMailInput) {
    const user = await this.loadIssuer(input.issuerUserId);
    const { transporter, from } = this.buildTransporter(user);

    const to = input.to.trim();
    if (!to) {
      throw new BadRequestException('Recipient email is required');
    }

    const ccRaw = input.cc;
    const cc = Array.isArray(ccRaw)
      ? ccRaw.map((c) => c.trim()).filter(Boolean)
      : ccRaw?.trim()
        ? [ccRaw.trim()]
        : undefined;

    try {
      await transporter.sendMail({
        from,
        to,
        cc: cc?.length ? cc : undefined,
        subject: input.subject,
        html: input.html,
        text: input.text,
        attachments: input.attachments?.map((a) => ({
          filename: a.filename,
          content: a.content,
          contentType: a.contentType || 'application/pdf',
        })),
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to send email';
      throw new BadRequestException(`Email send failed: ${message}`);
    }

    return {
      ok: true as const,
      to,
      from,
      subject: input.subject,
    };
  }

  async sendSmtpTest(userId: string) {
    const user = await this.loadIssuer(userId);
    this.assertSmtpConfigured(user);
    const to = user.userInfo?.email || user.email;
    const company =
      user.userInfo?.companyName?.trim() ||
      user.userInfo?.fullName?.trim() ||
      'Courier';

    return this.sendMail({
      issuerUserId: userId,
      to,
      subject: `${company} — SMTP test`,
      html: `<p>This is a test email from <strong>${escapeHtml(company)}</strong>.</p>
<p>Your outgoing SMTP settings are working.</p>`,
      text: `This is a test email from ${company}. Your outgoing SMTP settings are working.`,
    });
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
