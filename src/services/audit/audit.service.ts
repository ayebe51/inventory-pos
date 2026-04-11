import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../config/prisma.service';
import {
  AuditEvent,
  AuditFilter,
  AuditLog,
  AuditTrailService,
} from '../../modules/governance/interfaces/governance.interfaces';
import { PaginatedResult } from '../../common/types/pagination.type';

@Injectable()
export class AuditService implements AuditTrailService {
  constructor(private readonly prisma: PrismaService) {}

  async record(event: AuditEvent, tx?: Prisma.TransactionClient): Promise<AuditLog> {
    const client = tx ?? this.prisma;

    const created = await client.auditLog.create({
      data: {
        user_id: event.user_id,
        action: event.action,
        entity_type: event.entity_type,
        entity_id: event.entity_id,
        data_before: event.before_snapshot !== undefined && event.before_snapshot !== null
          ? (event.before_snapshot as Prisma.InputJsonValue)
          : Prisma.DbNull,
        data_after: event.after_snapshot !== undefined && event.after_snapshot !== null
          ? (event.after_snapshot as Prisma.InputJsonValue)
          : Prisma.DbNull,
        ip_address: event.ip_address ?? null,
        user_agent: event.user_agent ?? null,
      },
    });

    return this.mapToAuditLog(created);
  }

  async query(filters: AuditFilter): Promise<PaginatedResult<AuditLog>> {
    const page = filters.page ?? 1;
    const per_page = filters.per_page ?? 20;
    const skip = (page - 1) * per_page;

    const where: Prisma.AuditLogWhereInput = {
      ...(filters.user_id && { user_id: filters.user_id }),
      ...(filters.action && { action: filters.action }),
      ...(filters.entity_type && { entity_type: filters.entity_type }),
      ...(filters.entity_id && { entity_id: filters.entity_id }),
      ...((filters.from_date || filters.to_date) && {
        created_at: {
          ...(filters.from_date && { gte: filters.from_date }),
          ...(filters.to_date && { lte: filters.to_date }),
        },
      }),
    };

    const [total, rows] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: per_page,
      }),
    ]);

    return {
      data: rows.map((r) => this.mapToAuditLog(r)),
      meta: {
        page,
        per_page,
        total,
        total_pages: Math.ceil(total / per_page),
      },
    };
  }

  private mapToAuditLog(row: {
    id: string;
    user_id: string;
    action: string;
    entity_type: string;
    entity_id: string;
    data_before: Prisma.JsonValue;
    data_after: Prisma.JsonValue;
    ip_address: string | null;
    user_agent: string | null;
    created_at: Date;
  }): AuditLog {
    return {
      id: row.id,
      user_id: row.user_id,
      action: row.action,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      before_snapshot: (row.data_before as Record<string, unknown>) ?? null,
      after_snapshot: (row.data_after as Record<string, unknown>) ?? null,
      ip_address: row.ip_address,
      user_agent: row.user_agent,
      created_at: row.created_at,
    };
  }
}
