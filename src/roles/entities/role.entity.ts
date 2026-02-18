/**
 * Role Entity
 * Represents roles in the RBAC system
 */

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { Application } from '../../applications/entities/application.entity';
import { UserRole } from '../../user-roles/entities/user-role.entity';

export enum RoleScope {
  GLOBAL = 'global',
  APPLICATION = 'application',
  INTERNAL = 'internal',
}

@Entity('roles')
@Index(['name'])
@Index(['scope'])
@Index(['applicationId'])
@Unique(['name', 'scope', 'applicationId'])
export class Role {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string; // e.g., 'superadmin', 'user', 'admin'

  @Column({
    type: 'varchar',
    length: 100,
  })
  scope: RoleScope; // 'global' | 'application' | 'internal'

  @Column({ nullable: true })
  applicationId: string; // NULL for global roles, set for app/internal roles

  @ManyToOne(() => Application, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'applicationId' })
  application: Application;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ default: true })
  isActive: boolean;

  @OneToMany(() => UserRole, (userRole) => userRole.role)
  userRoles: UserRole[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
