import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../config/prisma.service';
import { AuditService } from '../../../services/audit/audit.service';
import { withAudit } from '../../../services/audit/with-audit.helper';
import { BusinessRuleException } from '../../../common/exceptions/business-rule.exception';
import { ErrorCode } from '../../../common/enums/error-codes.enum';
import { UUID } from '../../../common/types/uuid.type';
import { Branch, BranchNode, BranchType } from '../interfaces/master-data.interfaces';
import {
  CreateHeadOfficeSchema,
  CreateBranchSchema,
  CreateHeadOfficeDTO,
  CreateBranchDTO,
} from '../dto/branch.dto';

// ── Valid parent types per child type ─────────────────────────────────────────

const VALID_PARENT_TYPES: Record<BranchType, BranchType | null> = {
  HEAD_OFFICE: null,   // no parent allowed
  BRANCH: 'HEAD_OFFICE',
};

// ── Mapper ────────────────────────────────────────────────────────────────────

function mapBranch(row: {
  id: string;
  code: string;
  name: string;
  type: string;
  parent_id: string | null;
  address: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}): Branch {
  return {
    id: row.id as UUID,
    code: row.code,
    name: row.name,
    type: row.type as BranchType,
    parent_id: row.parent_id as UUID | null,
    address: row.address,
    is_active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
  };
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class OrganizationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Create a Head Office node (root, no parent).
   * Req 2.6: HEAD_OFFICE has no parent.
   */
  async createHeadOffice(data: CreateHeadOfficeDTO, userId: UUID): Promise<Branch> {
    const validated = CreateHeadOfficeSchema.parse(data);

    // Ensure code is unique
    const existing = await this.prisma.branch.findFirst({
      where: { code: validated.code, deleted_at: null },
      select: { id: true },
    });
    if (existing) {
      throw new BusinessRuleException(
        `Kode cabang '${validated.code}' sudah digunakan`,
        ErrorCode.CONFLICT,
      );
    }

    const branch = await withAudit(
      this.prisma,
      this.audit,
      {
        userId,
        action: 'CREATE',
        entityType: 'Branch',
        entityId: '',
        after: { ...validated, type: 'HEAD_OFFICE' } as Record<string, unknown>,
      },
      async (tx) => {
        return (tx.branch as any).create({
          data: {
            code: validated.code,
            name: validated.name,
            type: 'HEAD_OFFICE',
            parent_id: null,
            address: validated.address ?? null,
          },
        });
      },
    );

    return mapBranch(branch as any);
  }

  /**
   * Create a Branch node under a Head Office.
   * Req 2.6: BRANCH parent must be HEAD_OFFICE.
   */
  async createBranch(data: CreateBranchDTO, userId: UUID): Promise<Branch> {
    const validated = CreateBranchSchema.parse(data);

    // Validate parent exists and is HEAD_OFFICE
    await this.validateParentChild(validated.parent_id as UUID, 'BRANCH');

    // Ensure code is unique
    const existing = await this.prisma.branch.findFirst({
      where: { code: validated.code, deleted_at: null },
      select: { id: true },
    });
    if (existing) {
      throw new BusinessRuleException(
        `Kode cabang '${validated.code}' sudah digunakan`,
        ErrorCode.CONFLICT,
      );
    }

    const branch = await withAudit(
      this.prisma,
      this.audit,
      {
        userId,
        action: 'CREATE',
        entityType: 'Branch',
        entityId: '',
        after: { ...validated, type: 'BRANCH' } as Record<string, unknown>,
      },
      async (tx) => {
        return (tx.branch as any).create({
          data: {
            code: validated.code,
            name: validated.name,
            type: 'BRANCH',
            parent_id: validated.parent_id,
            address: validated.address ?? null,
          },
        });
      },
    );

    return mapBranch(branch as any);
  }

  /**
   * Validate that parentId exists and its type is valid for the given childType.
   * Req 2.6: HEAD_OFFICE → BRANCH hierarchy must be enforced.
   */
  async validateParentChild(parentId: UUID, childType: BranchType): Promise<void> {
    const requiredParentType = VALID_PARENT_TYPES[childType];

    if (requiredParentType === null) {
      // HEAD_OFFICE must not have a parent
      throw new BusinessRuleException(
        `Tipe '${childType}' tidak boleh memiliki parent`,
        ErrorCode.BUSINESS_RULE_VIOLATION,
      );
    }

    const parent = await (this.prisma.branch as any).findFirst({
      where: { id: parentId, deleted_at: null },
      select: { id: true, type: true },
    });

    if (!parent) {
      throw new BusinessRuleException(
        `Parent dengan id '${parentId}' tidak ditemukan`,
        ErrorCode.NOT_FOUND,
      );
    }

    if (parent.type !== requiredParentType) {
      throw new BusinessRuleException(
        `Parent untuk tipe '${childType}' harus bertipe '${requiredParentType}', bukan '${parent.type}'`,
        ErrorCode.BUSINESS_RULE_VIOLATION,
      );
    }
  }

  /**
   * Return direct children of a node.
   */
  async getChildren(parentId: UUID): Promise<Branch[]> {
    const rows = await (this.prisma.branch as any).findMany({
      where: { parent_id: parentId, deleted_at: null },
      orderBy: { code: 'asc' },
    });
    return rows.map(mapBranch);
  }

  /**
   * Return full hierarchy tree, or subtree rooted at branchId.
   * Req 2.6: Head Office → Branch hierarchy.
   */
  async getHierarchy(branchId?: UUID): Promise<BranchNode[]> {
    const allBranches = await (this.prisma.branch as any).findMany({
      where: { deleted_at: null },
      orderBy: { code: 'asc' },
    });

    const mapped = allBranches.map(mapBranch);
    const nodeMap = new Map<string, BranchNode>();

    for (const b of mapped) {
      nodeMap.set(b.id, { ...b, children: [] });
    }

    const roots: BranchNode[] = [];

    for (const node of nodeMap.values()) {
      if (node.parent_id && nodeMap.has(node.parent_id)) {
        nodeMap.get(node.parent_id)!.children.push(node);
      } else if (!node.parent_id) {
        roots.push(node);
      }
    }

    if (branchId) {
      const subtree = nodeMap.get(branchId);
      return subtree ? [subtree] : [];
    }

    return roots;
  }
}
