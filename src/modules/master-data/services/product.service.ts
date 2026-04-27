import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../config/prisma.service';
import { AuditService } from '../../../services/audit/audit.service';
import { withAudit } from '../../../services/audit/with-audit.helper';
import { BusinessRuleException } from '../../../common/exceptions/business-rule.exception';
import { ErrorCode } from '../../../common/enums/error-codes.enum';
import { UUID } from '../../../common/types/uuid.type';
import { PaginatedResult } from '../../../common/types/pagination.type';
import { Product } from '../interfaces/master-data.interfaces';
import {
  CreateProductSchema,
  UpdateProductSchema,
  ProductFilterSchema,
  CreateProductDTO,
  UpdateProductDTO,
  ProductFilter,
} from '../dto/product.dto';

// ── Mapper ────────────────────────────────────────────────────────────────────

function mapProduct(row: {
  id: string;
  code: string;
  barcode: string | null;
  name: string;
  description: string | null;
  category_id: string;
  brand_id: string | null;
  uom_id: string;
  uom_purchase_id: string | null;
  uom_sales_id: string | null;
  cost_method: string;
  standard_cost: Prisma.Decimal;
  selling_price: Prisma.Decimal;
  min_selling_price: Prisma.Decimal;
  reorder_point: Prisma.Decimal;
  reorder_qty: Prisma.Decimal;
  max_stock: Prisma.Decimal | null;
  is_serialized: boolean;
  is_batch_tracked: boolean;
  is_active: boolean;
  tax_category: string | null;
  weight: Prisma.Decimal | null;
  volume: Prisma.Decimal | null;
  image_url: string | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}): Product {
  return {
    id: row.id as UUID,
    code: row.code,
    barcode: row.barcode,
    name: row.name,
    description: row.description,
    category_id: row.category_id as UUID,
    brand_id: row.brand_id as UUID | null,
    uom_id: row.uom_id as UUID,
    uom_purchase_id: row.uom_purchase_id as UUID | null,
    uom_sales_id: row.uom_sales_id as UUID | null,
    cost_method: row.cost_method as 'WAC' | 'FIFO',
    standard_cost: Number(row.standard_cost),
    selling_price: Number(row.selling_price),
    min_selling_price: Number(row.min_selling_price),
    reorder_point: Number(row.reorder_point),
    reorder_qty: Number(row.reorder_qty),
    max_stock: row.max_stock !== null ? Number(row.max_stock) : null,
    is_serialized: row.is_serialized,
    is_batch_tracked: row.is_batch_tracked,
    is_active: row.is_active,
    tax_category: row.tax_category,
    weight: row.weight !== null ? Number(row.weight) : null,
    volume: row.volume !== null ? Number(row.volume) : null,
    image_url: row.image_url,
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
  };
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class ProductService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Create a new product.
   * Validates uniqueness of code across all non-deleted products (AC1).
   * Records audit log in the same transaction (AC1).
   */
  async create(data: CreateProductDTO, userId: UUID): Promise<Product> {
    const validated = CreateProductSchema.parse(data);

    // Check code uniqueness
    const existing = await this.prisma.product.findFirst({
      where: { code: validated.code, deleted_at: null },
      select: { id: true },
    });
    if (existing) {
      throw new BusinessRuleException(
        `Kode produk '${validated.code}' sudah digunakan`,
        ErrorCode.CONFLICT,
      );
    }

    const product = await withAudit(
      this.prisma,
      this.audit,
      {
        userId,
        action: 'CREATE',
        entityType: 'Product',
        entityId: '', // will be overwritten after creation
        after: validated as unknown as Record<string, unknown>,
      },
      async (tx) => {
        const created = await tx.product.create({
          data: {
            code: validated.code,
            barcode: validated.barcode ?? null,
            name: validated.name,
            description: validated.description ?? null,
            category_id: validated.category_id,
            brand_id: validated.brand_id ?? null,
            uom_id: validated.uom_id,
            uom_purchase_id: validated.uom_purchase_id ?? null,
            uom_sales_id: validated.uom_sales_id ?? null,
            cost_method: validated.cost_method,
            standard_cost: validated.standard_cost,
            selling_price: validated.selling_price,
            min_selling_price: validated.min_selling_price,
            reorder_point: validated.reorder_point,
            reorder_qty: validated.reorder_qty,
            max_stock: validated.max_stock ?? null,
            is_serialized: validated.is_serialized,
            is_batch_tracked: validated.is_batch_tracked,
            is_active: validated.is_active,
            tax_category: validated.tax_category ?? null,
            weight: validated.weight ?? null,
            volume: validated.volume ?? null,
            image_url: validated.image_url ?? null,
            notes: validated.notes ?? null,
          },
        });
        return created;
      },
    );

    return mapProduct(product);
  }

  /**
   * Update an existing product.
   * Throws NOT_FOUND if product doesn't exist or is soft-deleted.
   * Validates code uniqueness if code is being changed (AC1).
   * Records audit log in the same transaction.
   */
  async update(id: UUID, data: UpdateProductDTO, userId: UUID): Promise<Product> {
    const validated = UpdateProductSchema.parse(data);

    const existing = await this.prisma.product.findFirst({
      where: { id, deleted_at: null },
    });
    if (!existing) {
      throw new BusinessRuleException(
        `Produk dengan id '${id}' tidak ditemukan`,
        ErrorCode.NOT_FOUND,
      );
    }

    // Check code uniqueness if code is being changed
    if (validated.code && validated.code !== existing.code) {
      const codeConflict = await this.prisma.product.findFirst({
        where: { code: validated.code, deleted_at: null, id: { not: id } },
        select: { id: true },
      });
      if (codeConflict) {
        throw new BusinessRuleException(
          `Kode produk '${validated.code}' sudah digunakan`,
          ErrorCode.CONFLICT,
        );
      }
    }

    const updated = await withAudit(
      this.prisma,
      this.audit,
      {
        userId,
        action: 'UPDATE',
        entityType: 'Product',
        entityId: id,
        before: mapProduct(existing) as unknown as Record<string, unknown>,
        after: { ...mapProduct(existing), ...validated } as unknown as Record<string, unknown>,
      },
      async (tx) => {
        return tx.product.update({
          where: { id },
          data: {
            ...(validated.code !== undefined && { code: validated.code }),
            ...(validated.barcode !== undefined && { barcode: validated.barcode }),
            ...(validated.name !== undefined && { name: validated.name }),
            ...(validated.description !== undefined && { description: validated.description }),
            ...(validated.category_id !== undefined && { category_id: validated.category_id }),
            ...(validated.brand_id !== undefined && { brand_id: validated.brand_id }),
            ...(validated.uom_id !== undefined && { uom_id: validated.uom_id }),
            ...(validated.uom_purchase_id !== undefined && { uom_purchase_id: validated.uom_purchase_id }),
            ...(validated.uom_sales_id !== undefined && { uom_sales_id: validated.uom_sales_id }),
            ...(validated.cost_method !== undefined && { cost_method: validated.cost_method }),
            ...(validated.standard_cost !== undefined && { standard_cost: validated.standard_cost }),
            ...(validated.selling_price !== undefined && { selling_price: validated.selling_price }),
            ...(validated.min_selling_price !== undefined && { min_selling_price: validated.min_selling_price }),
            ...(validated.reorder_point !== undefined && { reorder_point: validated.reorder_point }),
            ...(validated.reorder_qty !== undefined && { reorder_qty: validated.reorder_qty }),
            ...(validated.max_stock !== undefined && { max_stock: validated.max_stock }),
            ...(validated.is_serialized !== undefined && { is_serialized: validated.is_serialized }),
            ...(validated.is_batch_tracked !== undefined && { is_batch_tracked: validated.is_batch_tracked }),
            ...(validated.is_active !== undefined && { is_active: validated.is_active }),
            ...(validated.tax_category !== undefined && { tax_category: validated.tax_category }),
            ...(validated.weight !== undefined && { weight: validated.weight }),
            ...(validated.volume !== undefined && { volume: validated.volume }),
            ...(validated.image_url !== undefined && { image_url: validated.image_url }),
            ...(validated.notes !== undefined && { notes: validated.notes }),
          },
        });
      },
    );

    return mapProduct(updated);
  }

  /**
   * Find a product by ID.
   * Throws NOT_FOUND if product doesn't exist or is soft-deleted (AC3).
   */
  async findById(id: UUID): Promise<Product> {
    const product = await this.prisma.product.findFirst({
      where: { id, deleted_at: null },
    });
    if (!product) {
      throw new BusinessRuleException(
        `Produk dengan id '${id}' tidak ditemukan`,
        ErrorCode.NOT_FOUND,
      );
    }
    return mapProduct(product);
  }

  /**
   * Search products with filters and pagination.
   * Excludes soft-deleted products (AC2, AC3).
   */
  async search(filters: ProductFilter): Promise<PaginatedResult<Product>> {
    const validated = ProductFilterSchema.parse(filters);
    const { page, per_page, code, name, category_id, brand_id, is_active } = validated;
    const skip = (page - 1) * per_page;

    const where: Prisma.ProductWhereInput = {
      deleted_at: null,
      ...(code && { code: { contains: code, mode: 'insensitive' } }),
      ...(name && { name: { contains: name, mode: 'insensitive' } }),
      ...(category_id && { category_id }),
      ...(brand_id && { brand_id }),
      ...(is_active !== undefined && { is_active }),
    };

    const [total, rows] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        orderBy: { code: 'asc' },
        skip,
        take: per_page,
      }),
    ]);

    return {
      data: rows.map(mapProduct),
      meta: {
        page,
        per_page,
        total,
        total_pages: Math.ceil(total / per_page),
      },
    };
  }

  /**
   * Soft-delete a product by setting deleted_at (AC3).
   * Throws NOT_FOUND if product doesn't exist or is already deleted.
   * Records audit log in the same transaction.
   */
  async deactivate(id: UUID, userId: UUID): Promise<void> {
    const existing = await this.prisma.product.findFirst({
      where: { id, deleted_at: null },
    });
    if (!existing) {
      throw new BusinessRuleException(
        `Produk dengan id '${id}' tidak ditemukan`,
        ErrorCode.NOT_FOUND,
      );
    }

    await withAudit(
      this.prisma,
      this.audit,
      {
        userId,
        action: 'DELETE',
        entityType: 'Product',
        entityId: id,
        before: mapProduct(existing) as unknown as Record<string, unknown>,
      },
      async (tx) => {
        await tx.product.update({
          where: { id },
          data: { deleted_at: new Date() },
        });
      },
    );
  }
}
