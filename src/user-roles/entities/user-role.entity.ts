/**
 * UserRole Entity
 * Junction table for user-role assignments
 */

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Role } from '../../roles/entities/role.entity';
import { Application } from '../../applications/entities/application.entity';

@Entity('user_roles')
@Index(['userId'])
@Index(['roleId'])
@Index(['applicationId'])
@Unique(['userId', 'roleId', 'applicationId'])
export class UserRole {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  roleId: string;

  @ManyToOne(() => Role, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'roleId' })
  role: Role;

  @Column({ nullable: true })
  applicationId: string; // NULL for global roles

  @ManyToOne(() => Application, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'applicationId' })
  application: Application;

  @Column({ nullable: true })
  grantedBy: string; // User ID who granted this role

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'grantedBy' })
  grantedByUser: User;

  @CreateDateColumn()
  grantedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date; // Optional expiration
}
