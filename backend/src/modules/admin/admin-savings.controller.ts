import {
  Controller,
  Post,
  Patch,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { SavingsService } from '../savings/savings.service';
import { SavingsProduct } from '../savings/entities/savings-product.entity';
import { CreateProductDto } from '../savings/dto/create-product.dto';
import { UpdateProductDto } from '../savings/dto/update-product.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('admin/savings')
@Controller('admin/savings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@ApiBearerAuth()
export class AdminSavingsController {
  constructor(private readonly savingsService: SavingsService) {}

  @Post('products')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a savings product (admin)' })
  @ApiBody({ type: CreateProductDto })
  @ApiResponse({
    status: 201,
    description: 'Product created',
    type: SavingsProduct,
  })
  @ApiResponse({ status: 400, description: 'Invalid product data' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin required' })
  async createProduct(@Body() dto: CreateProductDto): Promise<SavingsProduct> {
    return await this.savingsService.createProduct(dto);
  }

  @Patch('products/:id')
  @ApiOperation({ summary: 'Update a savings product (admin)' })
  @ApiBody({ type: UpdateProductDto })
  @ApiResponse({
    status: 200,
    description: 'Product updated',
    type: SavingsProduct,
  })
  @ApiResponse({ status: 404, description: 'Product not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin required' })
  async updateProduct(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ): Promise<SavingsProduct> {
    return await this.savingsService.updateProduct(id, dto);
  }

  @Post('products/:id/migrations')
  @ApiOperation({
    summary: 'Migrate active subscriptions to another product version (admin)',
  })
  @ApiResponse({
    status: 200,
    description: 'Subscriptions migrated to the target product version',
  })
  async migrateProductSubscriptions(
    @Param('id') id: string,
    @Body() body: { targetProductId: string; subscriptionIds?: string[] },
    @CurrentUser() user: { id: string; email: string },
  ): Promise<{ migratedCount: number; targetProductId: string }> {
    const result = await this.savingsService.migrateSubscriptionsToVersion(
      id,
      body.targetProductId,
      user.id,
      body.subscriptionIds,
    );

    return {
      migratedCount: result.migratedCount,
      targetProductId: result.targetProduct.id,
    };
  }
}
