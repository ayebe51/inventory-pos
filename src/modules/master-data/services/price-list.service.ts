import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../config/prisma.service';
import { AuditService } from '../../../services/audit/audit.service';
import { CacheService } from '../../../services/cache/cache.service';
import { withAudit } from '../../../services/audit/with-audit.helper';
import { BusinessRuleException } from '../../../common/exceptions/business-rule.exception';
import { ErrorCode } from '../../../common/enums/error-codes.enum';
import { UUID } from '../../../common/types/uuid.type';
import { PaginatedResult } from '../../../common/types/pagination.type';
import { PriceList, PriceResult } from '../interfaces/master-data.interfaces';
import {
  CreatePriceListSchema,
  UpdatePriceListSchema,
  PriceListFilterSchema,
  CreatePriceListDTO,
  UpdatePriceListDTO,
  PriceItemDTO,
  PriceListFilterDTO,
} from '../dto/price-list.dto';

// ── Cache helpers ─────────────────────────────────────────────────────────────

const CACHE_TTL = 300; // 5 minutes

function priceListCacheKey(id: string): string {
  return `price_list:${id}`;
}

function activePriceCacheKey(productId: string, customerId: string | null, date: string): string {
  return `active_price:${productId}:${customerId ?? 'default'}:${date}`;
}

// ── Mapper ────────────────────────────────────────────────────────────────────

function mapPriceList(row: {
  id: string;
  code: string;
  name: string;
  customer_id: string | null;
  valid_from: Date;
  valid_to: Date | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}): PriceList {
  return {
    id: row.id as UUID,
    code: row.code,
    name: row.name,
    customer_id: row.customer_id as UUID | null,
    valid_from: row.valid_from,
    valid_to: row.valid_to,
    is_active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class PriceListService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly cache: CacheService,
  ) {}

  /**
   * Resolve the active price for a product on a given date.
   *
   * Resolution priority (highest to lowest):
   *   1. Customer-specific price list valid on `date`
   *   2. General (no customer) price list valid on `date`
   *   3. Product's default selling_price
   *
   * Requirement 2.5: "WHEN harga aktif diminta untuk kombinasi produk, customer,
   * dan tanggal tertentu, THE Master_Data_Module SHALL mengembalikan harga dari
   * price list yang berlaku pada tanggal tersebut."
   */
  async getActivePrice(productId: UUID, customerId: UUID | null, date: Date): Promise<PriceResult> {
    const dateKey = date.toISOString().slice(0, 10); // YYYY-MM-DD
    const cacheKey = activePriceCacheKey(productId, customerId, dateKey);

    const cached = await this.cache.get<PriceResult>(cacheKey);
    if (cached) return cached;

    // Build the date boundary for validity check
    const dateStart = new Date(dateKey); // midnight of the given date

    // Fetch all active price list items for this product where the price list
    // is valid on `date`, ordered by specificity (customer-specific first).
    const items = await this.prisma.priceListItem.findMany({
      where: {
        product_id: productId,
        price_list: {
          is_active: true,
          deleted_at: null,
          valid_from: { lte: dateStart },
          OR: [
            { valid_to: null },
            { valid_to: { gte: dateStart } },
          ],
        },
      },
      include: {
        price_list: {
          select: {
            id: true,
            customer_id: true,
          },
        },
      },
      orderBy: [
        // Customer-specific lists come first (non-null customer_id)
        { price_list: { customer_id: 'desc' } },
        // Among ties, prefer the most recently started list
        { price_list: { valid_from: 'desc' } },
      ],
    });

    // Priority 1: customer-specific match
    if (customerId) {
      const customerItem = items.find((i) => i.price_list.customer_id === customerId);
      if (customerItem) {
        const result: PriceResult = {
          price: Number(customerItem.unit_price),
          price_list_id: customerItem.price_list_id as UUID,
          source: 'PRICE_LIST_CUSTOMER',
        };
        await this.cache.set(cacheKey, result, CACHE_TTL);
        return result;
      }
    }

    // Priority 2: general price list (no customer restriction)
    const generalItem = items.find((i) => i.price_list.customer_id === null);
    if (generalItem) {
      const result: PriceResult = {
        price: Number(generalItem.unit_price),
        price_list_id: generalItem.price_list_id as UUID,
        source: 'PRICE_LIST_GENERAL',
      };
      await this.cache.set(cacheKey, result, CACHE_TTL);
      return result;
    }

    // Priority 3: fallback to product's default selling_price
    const product = await this.prisma.product.findFirst({
      where: { id: productId, deleted_at: null },
      select: { id: true, selling_price: true },
    });
    if (!product) {
      throw new BusinessRuleException(
        `Produk dengan id '${productId}' tidak ditemukan`,
        ErrorCode.NOT_FOUND,
      );
    }

    const result: PriceResult = {
      price: Number(product.selling_price),
      price_list_id: null,
      source: 'PRODUCT_DEFAULT',
    };
    await this.cache.set(cacheKey, result, CACHE_TTL);
    return result;
  }

  /**
   * Create a new price list.
   * Validates code uniqueness across all non-deleted price lists.
   */
  async createPriceList(data: CreatePriceListDTO, userId: UUID): Promise<PriceList> {
    const validated = CreatePriceListSchema.parse(data);

    // Validate valid_to is after valid_from when provided
    if (validated.valid_to && validated.valid_to <= validated.valid_from) {
      throw new BusinessRuleException(
        'Tanggal akhir berlaku harus setelah tanggal mulai berlaku',
        ErrorCode.VALIDATION_ERROR,
      );
    }

    // Check code uniqueness
    const existing = await this.prisma.priceList.findFirst({
      where: { code: validated.code, deleted_at: null },
      select: { id: true },
    });
    if (existing) {
      throw new BusinessRuleException(
        `Kode price list '${validated.code}' sudah digunakan`,
        ErrorCode.CONFLICT,
      );
    }

    const priceList = await withAudit(
      this.prisma,
      this.audit,
      {
        userId,
        action: 'CREATE',
        entityType: 'PriceList',
        entityId: '',
        after: validated as unknown as Record<string, unknown>,
      },
      async (tx) => {
        return tx.priceList.create({
          data: {
            code: validated.code,
            name: validated.name,
            customer_id: validated.customer_id ?? null,
            valid_from: validated.valid_from,
            valid_to: validated.valid_to ?? null,
            is_active: validated.is_active,
          },
        });
      },
    );

    return mapPriceList(priceList);
  }

  /**
   * Update an existing price list.
   * Invalidates all active-price cache entries for this price list's products.
   */
  async updatePriceList(id: UUID, data: UpdatePriceListDTO, userId: UUID): Promise<PriceList> {
    const validated = UpdatePriceListSchema.parse(data);

    const existing = await this.prisma.priceList.findFirst({
      where: { id, deleted_at: null },
    });
    if (!existing) {
      throw new BusinessRuleException(
        `Price list dengan id '${id}' tidak ditemukan`,
        ErrorCode.NOT_FOUND,
      );
    }

    if (validated.valid_to) {
      const fromDate = validated.valid_from ?? existing.valid_from;
      if (validated.valid_to <= fromDate) {
        throw new BusinessRuleException(
          'Tanggal akhir berlaku harus setelah tanggal mulai berlaku',
          ErrorCode.VALIDATION_ERROR,
        );
      }
    }

    // Check code uniqueness if code is being changed
    if (validated.code && validated.code !== existing.code) {
      const codeConflict = await this.prisma.priceList.findFirst({
        where: { code: validated.code, deleted_at: null, id: { not: id } },
        select: { id: true },
      });
      if (codeConflict) {
        throw new BusinessRuleException(
          `Kode price list '${validated.code}' sudah digunakan`,
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
        entityType: 'PriceList',
        entityId: id,
        before: mapPriceList(existing) as unknown as Record<string, unknown>,
        after: { ...mapPriceList(existing), ...validated } as unknown as Record<string, unknown>,
      },
      async (tx) => {
        return tx.priceList.update({
          where: { id },
          data: {
            ...(validated.code !== undefined && { code: validated.code }),
            ...(validated.name !== undefined && { name: validated.name }),
            ...(validated.customer_id !== undefined && { customer_id: validated.customer_id }),
            ...(validated.valid_from !== undefined && { valid_from: validated.valid_from }),
            ...(validated.valid_to !== undefined && { valid_to: validated.valid_to }),
            ...(validated.is_active !== undefined && { is_active: validated.is_active }),
          },
        });
      },
    );

    // Invalidate cache for this price list and all active-price entries
    await Promise.all([
      this.cache.del(priceListCacheKey(id)),
      this.cache.delByPattern(`active_price:*`),
    ]);

    return mapPriceList(updated);
  }

  /**
   * Upsert price items for a price list.
   * Invalidates active-price cache for all affected products.
   */
  async updatePrices(priceListId: UUID, items: PriceItemDTO[], userId: UUID): Promise<void> {
    const priceList = await this.prisma.priceList.findFirst({
      where: { id: priceListId, deleted_at: null },
      select: { id: true, name: true },
    });
    if (!priceList) {
      throw new BusinessRuleException(
        `Price list dengan id '${priceListId}' tidak ditemukan`,
        ErrorCode.NOT_FOUND,
      );
    }

    await withAudit(
      this.prisma,
      this.audit,
      {
        userId,
        action: 'UPDATE',
        entityType: 'PriceListItems',
        entityId: priceListId,
        after: { price_list_id: priceListId, items } as unknown as Record<string, unknown>,
      },
      async (tx) => {
        for (const item of items) {
          await tx.priceListItem.upsert({
            where: {
              price_list_id_product_id: {
                price_list_id: priceListId,
                product_id: item.product_id,
              },
            },
            create: {
              price_list_id: priceListId,
              product_id: item.product_id,
              unit_price: item.unit_price,
            },
            update: {
              unit_price: item.unit_price,
            },
          });
        }
      },
    );

    // Invalidate active-price cache for all affected products
    await this.cache.delByPattern(`active_price:*`);
  }

  /**
   * Find a price list by ID.
   * Uses Redis cache (TTL 5 min).
   */
  async findById(id: UUID): Promise<PriceList> {
    const cacheKey = priceListCacheKey(id);
    const cached = await this.cache.get<PriceList>(cacheKey);
    if (cached) return cached;

    const priceList = await this.prisma.priceList.findFirst({
      where: { id, deleted_at: null },
    });
    if (!priceList) {
      throw new BusinessRuleException(
        `Price list dengan id '${id}' tidak ditemukan`,
        ErrorCode.NOT_FOUND,
      );
    }

    const result = mapPriceList(priceList);
    await this.cache.set(cacheKey, result, CACHE_TTL);
    return result;
  }

  /**
   * Paginated search with filters.
   */
  async search(filters: PriceListFilterDTO): Promise<PaginatedResult<PriceList>> {
    const validated = PriceListFilterSchema.parse(filters);
    const { page, per_page, customer_id, is_active, search } = validated;
    const skip = (page - 1) * per_page;

    const where: Prisma.PriceListWhereInput = {
      deleted_at: null,
      ...(customer_id !== undefined && { customer_id: customer_id ?? null }),
      ...(is_active !== undefined && { is_active }),
      ...(search && {
        OR: [
          { code: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [total, rows] = await Promise.all([
      this.prisma.priceList.count({ where }),
      this.prisma.priceList.findMany({
        where,
        orderBy: { code: 'asc' },
        skip,
        take: per_page,
      }),
    ]);

    return {
      data: rows.map(mapPriceList),
      meta: {
        page,
        per_page,
        total,
        total_pages: Math.ceil(total / per_page),
      },
    };
  }

  /**
   * Soft-delete a price list.
   */
  async deactivate(id: UUID, userId: UUID): Promise<void> {
    const existing = await this.prisma.priceList.findFirst({
      where: { id, deleted_at: null },
    });
    if (!existing) {
      throw new BusinessRuleException(
        `Price list dengan id '${id}' tidak ditemukan`,
        ErrorCode.NOT_FOUND,
      );
    }

    await withAudit(
      this.prisma,
      this.audit,
      {
        userId,
        action: 'DELETE',
        entityType: 'PriceList',
        entityId: id,
        before: mapPriceList(existing) as unknown as Record<string, unknown>,
      },
      async (tx) => {
        await tx.priceList.update({
          where: { id },
          data: { deleted_at: new Date() },
        });
      },
    );

    await Promise.all([
      this.cache.del(priceListCacheKey(id)),
      this.cache.delByPattern(`active_price:*`),
    ]);
  }
}
