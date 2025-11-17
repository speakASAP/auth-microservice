/**
 * Logger Module for Auth Microservice
 */

import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { LoggerService } from './logger.service';

@Module({
  imports: [HttpModule],
  providers: [LoggerService],
  exports: [LoggerService],
})
export class LoggerModule {}

