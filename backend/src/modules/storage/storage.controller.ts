import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Res,
  UseGuards,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { StorageAccessService } from './storage-access.service';
import { ConfigService } from '@nestjs/config';

class SignedUploadRequestDto {
  originalName: string;
  contentType: string;
}

@ApiTags('storage')
@Controller('storage')
export class StorageController {
  constructor(
    private readonly storageAccess: StorageAccessService,
    private readonly configService: ConfigService,
  ) {}

  @Post('signed-upload')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a signed URL for file upload' })
  async getSignedUploadUrl(
    @CurrentUser() user: { id: string },
    @Body() dto: SignedUploadRequestDto,
  ) {
    if (!dto.originalName || !dto.contentType) {
      throw new BadRequestException('originalName and contentType are required');
    }
    return this.storageAccess.getSignedUploadUrl(
      dto.originalName,
      user.id,
      dto.contentType,
    );
  }

  @Get('signed-download')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a signed URL for file download' })
  @ApiQuery({ name: 'key', required: true })
  async getSignedDownloadUrl(
    @CurrentUser() user: { id: string; role?: string },
    @Query('key') key: string,
  ) {
    const isAdmin = user.role === Role.ADMIN;
    const url = await this.storageAccess.getSignedDownloadUrl(
      key,
      user.id,
      isAdmin,
    );
    return { downloadUrl: url, expiresIn: this.configService.get('upload.signedUrlTtlSeconds', 3600) };
  }

  @Get('signed')
  @ApiOperation({ summary: 'Serve file via local signed URL (local provider only)' })
  async serveSignedFile(
    @Query('key') key: string,
    @Query('op') operation: string,
    @Query('exp') exp: string,
    @Query('nonce') nonce: string,
    @Query('sig') signature: string,
    @Query('owner') ownerId: string | undefined,
    @Res() res: Response,
  ) {
    const provider = this.configService.get<string>('upload.provider') || 'local';
    if (provider !== 'local') {
      throw new BadRequestException(
        'Direct signed URL serving is only available with local storage provider',
      );
    }

    const expiresAt = parseInt(exp, 10);
    const valid = this.storageAccess.verifyLocalSignedUrl({
      key,
      operation,
      ownerId,
      expiresAt,
      nonce,
      signature,
    });

    if (!valid) {
      throw new BadRequestException('Invalid or expired signed URL');
    }

    if (operation !== 'read') {
      throw new BadRequestException('Only read operations are supported');
    }

    try {
      const buffer = this.storageAccess.readLocalFile(key);
      res.set('Content-Type', 'application/octet-stream');
      return res.send(buffer);
    } catch {
      throw new NotFoundException('File not found');
    }
  }
}
