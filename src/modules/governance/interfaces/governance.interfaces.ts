import { UUID } from '../../../common/types/uuid.type';
import { PaginatedResult } from '../../../common/types/pagination.type';

export type Permission = string; // format: MODULE.ACTION

export type DocumentType = 'PURCHASE_ORDER' | 'PAYMENT' | 'JOURNAL_ENTRY' | 'STOCK_ADJUSTMENT';

export type ApprovalDecision = 'APPROVED' | 'REJECTED';

export interface Role {
  id: UUID;
  name: string;
  description: string | null;
  is_system: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface AuditLog {
  id: UUID;
  user_id: UUID;
  action: string;
  entity_type: string;
  entity_id: UUID;
  before_snapshot: Record<string, unknown> | null;
  after_snapshot: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: Date;
  // NO updated_at, NO deleted_at — immutable
}

export interface ApprovalChain {
  document_type: DocumentType;
  levels: ApprovalChainLevel[];
}

export interface ApprovalChainLevel {
  level: number;
  approver_role: string;
  threshold_min: number;
  threshold_max: number | null;
}

export interface ApprovalRequest {
  id: UUID;
  document_id: UUID;
  document_type: DocumentType;
  requested_by: UUID;
  current_level: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'ESCALATED';
  created_at: Date;
  updated_at: Date;
}

export interface AuditEvent {
  user_id: UUID;
  action: string;
  entity_type: string;
  entity_id: UUID;
  before_snapshot?: Record<string, unknown>;
  after_snapshot?: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
}

export interface AuditFilter {
  user_id?: UUID;
  action?: string;
  entity_type?: string;
  entity_id?: UUID;
  from_date?: Date;
  to_date?: Date;
  page?: number;
  per_page?: number;
}

export interface CreateRoleDTO {
  name: string;
  description?: string;
}

export interface RBACService {
  checkPermission(userId: UUID, permission: Permission): Promise<boolean>;
  getUserPermissions(userId: UUID): Promise<Permission[]>;
  assignRole(userId: UUID, roleId: UUID): Promise<void>;
  createRole(data: CreateRoleDTO): Promise<Role>;
  grantPermission(roleId: UUID, permission: Permission): Promise<void>;
}

export interface AuditTrailService {
  record(event: AuditEvent): Promise<AuditLog>;
  query(filters: AuditFilter): Promise<PaginatedResult<AuditLog>>;
}

export interface ApprovalMatrixService {
  getApprovalChain(documentType: DocumentType, amount: number, branchId: UUID): Promise<ApprovalChain>;
  submitForApproval(documentId: UUID, documentType: DocumentType): Promise<ApprovalRequest>;
  processApproval(requestId: UUID, approverId: UUID, decision: ApprovalDecision): Promise<void>;
  escalate(requestId: UUID): Promise<void>;
}
