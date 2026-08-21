import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../config/prisma.service';

@Injectable()
export class CategoryService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.category.findMany({
      where: { deleted_at: null },
      orderBy: { code: 'asc' },
    });
  }

  async create(data: { code: string; name: string; description?: string }) {
    return this.prisma.category.create({
      data: {
        code: data.code,
        name: data.name,
      },
    });
  }

  async delete(id: string) {
    return this.prisma.category.update({
      where: { id },
      data: { deleted_at: new Date(), is_active: false },
    });
  }
}
