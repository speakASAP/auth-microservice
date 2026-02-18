/**
 * Application Entity
 * Represents registered applications and microservices in the ecosystem
 */

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { Role } from '../../roles/entities/role.entity';
import { UserRole } from '../../user-roles/entities/user-role.entity';

export enum ApplicationType {
  USER_FACING = 'user_facing',
  INTERNAL = 'internal',
  INFRASTRUCTURE = 'infrastructure',
}

@Entity('applications')
@Index(['name'], { unique: true })
@Index(['type'])
@Index(['domain'])
export class Application {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string; // e.g., 'shop-assistant', 'ai-microservice'

  @Column({ nullable: true })
  displayName: string; // e.g., 'Shop Assistant', 'AI Microservice'

  @Column({
    type: 'varchar',
    length: 50,
  })
  type: ApplicationType; // 'user_facing' | 'internal' | 'infrastructure'

  @Column({ nullable: true })
  domain: string; // e.g., 'shop-assistant.statex.cz'

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ default: true })
  isActive: boolean;

  @OneToMany(() => Role, (role) => role.application)
  roles: Role[];

  @OneToMany(() => UserRole, (userRole) => userRole.application)
  userRoles: UserRole[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
