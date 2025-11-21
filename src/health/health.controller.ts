import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Health')
@Controller('api/health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Vérifier la santé du serveur' })
  @ApiResponse({ status: 200, description: 'Serveur en bonne santé' })
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0',
    };
  }
}
