import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UploadEvidenceDto {
  @ApiProperty({
    example: 'Jane Doe',
    description: 'Name or ID of the person uploading the evidence',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  uploadedBy: string;
}
