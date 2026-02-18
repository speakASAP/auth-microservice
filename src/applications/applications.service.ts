/**
 * Applications Service
 * Manages application registration and retrieval
 */

import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Application, ApplicationType } from './entities/application.entity';
import { LoggerService } from '../../shared/logger/logger.service';

@Injectable()
export class ApplicationsService {
  constructor(
    @InjectRepository(Application)
    private readonly applicationsRepository: Repository<Application>,
    private readonly logger: LoggerService,
  ) {}

  async create(data: {
    name: string;
    displayName?: string;
    type: ApplicationType;
    domain?: string;
    description?: string;
  }): Promise<Application> {
    // Check if application already exists
    const existing = await this.applicationsRepository.findOne({
      where: { name: data.name },
    });

    if (existing) {
      this.logger.warn(`Application already exists: ${data.name}`, 'ApplicationsService');
      throw new ConflictException(`Application with name '${data.name}' already exists`);
    }

    const application = this.applicationsRepository.create({
      name: data.name,
      displayName: data.displayName || data.name,
      type: data.type,
      domain: data.domain,
      description: data.description,
      isActive: true,
    });

    const saved = await this.applicationsRepository.save(application);
    this.logger.log(`Application registered: ${data.name}`, 'ApplicationsService');

    return saved;
  }

  async findAll(): Promise<Application[]> {
    return this.applicationsRepository.find({
      order: { name: 'ASC' },
    });
  }

  async findById(id: string): Promise<Application> {
    const application = await this.applicationsRepository.findOne({
      where: { id },
    });

    if (!application) {
      throw new NotFoundException(`Application with id '${id}' not found`);
    }

    return application;
  }

  async findByName(name: string): Promise<Application | null> {
    return this.applicationsRepository.findOne({
      where: { name },
    });
  }

  async update(id: string, data: Partial<Application>): Promise<Application> {
    const application = await this.findById(id);

    Object.assign(application, data);
    const updated = await this.applicationsRepository.save(application);

    this.logger.log(`Application updated: ${application.name}`, 'ApplicationsService');
    return updated;
  }

  async delete(id: string): Promise<void> {
    const application = await this.findById(id);
    await this.applicationsRepository.remove(application);
    this.logger.log(`Application deleted: ${application.name}`, 'ApplicationsService');
  }

  async registerOrUpdate(data: {
    name: string;
    displayName?: string;
    type: ApplicationType;
    domain?: string;
    description?: string;
  }): Promise<Application> {
    const existing = await this.findByName(data.name);

    if (existing) {
      // Update existing application
      return this.update(existing.id, {
        displayName: data.displayName,
        type: data.type,
        domain: data.domain,
        description: data.description,
        isActive: true,
      });
    }

    // Create new application
    return this.create(data);
  }
}
