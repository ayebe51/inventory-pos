import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../common/guards/rbac.guard';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { AccountingService } from '../services/accounting.service';
import { PeriodManagerService } from '../../../services/period-manager/period-manager.service';
import { successResponse } from '../../../common/types/api-response.type';
import { UUID } from '../../../common/types/uuid.type';
import { CreatePeriodDTO, CreateJournalEntryDTO } from '../dto/accounting.dto';

interface AuthRequest extends Request {
  user: { sub: string };
}

@ApiTags('Accounting - Core')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('api/v1/accounting')
export class AccountingController {
  constructor(
    private readonly accountingService: AccountingService,
    private readonly periodManager: PeriodManagerService,
  ) {}

  @ApiOperation({ summary: 'Get all fiscal periods' })
  @Get('period')
  @RequirePermissions('PERIOD.VIEW')
  async getAllPeriods() {
    const periods = await this.periodManager.getAllPeriods();
    return successResponse(periods);
  }

  @ApiOperation({ summary: 'Create a new fiscal period' })
  @ApiBody({ type: CreatePeriodDTO })
  @Post('period')
  @RequirePermissions('PERIOD.CREATE')
  async createPeriod(@Body() data: CreatePeriodDTO) {
    const period = await this.periodManager.createPeriod(data as any);
    return successResponse(period, 'Fiscal period created successfully');
  }

  @ApiOperation({ summary: 'Get period closing checklist' })
  @ApiParam({ name: 'id', description: 'Period ID' })
  @Get('period/:id/checklist')
  @RequirePermissions('PERIOD.VIEW')
  async getPeriodChecklist(@Param('id') id: string) {
    const checklist = await this.periodManager.validatePeriodClosingChecklist(id as UUID);
    return successResponse(checklist);
  }

  @ApiOperation({ summary: 'Close a fiscal period' })
  @ApiParam({ name: 'id', description: 'Period ID' })
  @Post('period/:id/close')
  @RequirePermissions('PERIOD.CLOSE')
  async closePeriod(@Param('id') id: string, @Request() req: AuthRequest) {
    const journal = await this.accountingService.closePeriod(id as UUID, req.user.sub as UUID);
    return successResponse(journal, 'Period closed and retained earnings calculated successfully');
  }

  @ApiOperation({ summary: 'Get recent journal entries' })
  @Get('journal-entries')
  @RequirePermissions('JOURNAL.VIEW')
  async getRecentJournalEntries() {
    const entries = await this.accountingService.getRecentJournalEntries(20);
    return successResponse(entries);
  }

  @ApiOperation({ summary: 'Create manual journal entry' })
  @ApiBody({ type: CreateJournalEntryDTO })
  @Post('journal-entries')
  @RequirePermissions('JOURNAL.CREATE')
  async createJournalEntry(@Body() data: CreateJournalEntryDTO, @Request() req: AuthRequest) {
    const journalData = {
      ...data,
      period_id: data.period_id as UUID,
      created_by: req.user.sub as UUID,
      lines: data.lines.map(l => ({ ...l, account_id: l.account_id as UUID, cost_center_id: l.cost_center_id as UUID | undefined }))
    };
    const journal = await this.accountingService.postJournalEntry(journalData);
    return successResponse(journal, 'Manual journal entry created successfully');
  }
}
