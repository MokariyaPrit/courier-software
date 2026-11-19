import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnjaniBillsModule } from './anjani-bills/anjani-bills.module';
import { AuthModule } from './auth/auth.module';
import { BillingModule } from './billing/billing.module';
import { CitiesModule } from './cities/cities.module';
import { GstReportsModule } from './gst-reports/gst-reports.module';
import { LedgerModule } from './ledger/ledger.module';
import { MailModule } from './mail/mail.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { ConsignmentsModule } from './consignments/consignments.module';
import { CourierCompaniesModule } from './courier-companies/courier-companies.module';
import { CustomersModule } from './customers/customers.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ALL_ENTITIES } from './database/entities';
import { HealthController } from './health/health.controller';
import { QuotationsModule } from './quotations/quotations.module';
import { RateColumnsModule } from './rate-columns/rate-columns.module';
import { ReceiversModule } from './receivers/receivers.module';
import { SenderLocationsModule } from './sender-locations/sender-locations.module';
import { StatesModule } from './states/states.module';
import { StorageModule } from './storage/storage.module';
import { UsersModule } from './users/users.module';
import { join } from 'path';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        host: config.get<string>('DATABASE_HOST', 'localhost'),
        port: Number(config.get<string>('DATABASE_PORT', '5432')),
        username: config.get<string>('DATABASE_USER', 'courier'),
        password: config.get<string>('DATABASE_PASSWORD', 'courier'),
        database: config.get<string>('DATABASE_NAME', 'courier_erp'),
        entities: ALL_ENTITIES,
        migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
        synchronize: false,
        migrationsRun: config.get<string>('TYPEORM_MIGRATIONS_RUN') === 'true',
      }),
    }),
    StorageModule,
    AuthModule,
    MailModule,
    UsersModule,
    DashboardModule,
    CustomersModule,
    StatesModule,
    CitiesModule,
    ConsignmentsModule,
    BillingModule,
    LedgerModule,
    GstReportsModule,
    QuotationsModule,
    RateColumnsModule,
    ReceiversModule,
    SenderLocationsModule,
    CourierCompaniesModule,
    AnjaniBillsModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
