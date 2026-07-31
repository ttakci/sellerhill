import { Body, Controller, Get, Patch, Request, UseGuards } from '@nestjs/common';
import { ProfileDto } from '@repo/shared';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OperatorSurface } from '../auth/operator-surface.decorator';

import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfileService } from './profile.service';

/* Own name/contact details — self-service for every account, seller or staff. */
@Controller({ path: 'profile', version: '1' })
@UseGuards(JwtAuthGuard)
@OperatorSurface()
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  async getProfile(@Request() req: { user: { sub: string } }): Promise<ProfileDto> {
    return this.profileService.getProfile(req.user.sub);
  }

  @Patch()
  async updateProfile(@Request() req: { user: { sub: string } }, @Body() dto: UpdateProfileDto): Promise<ProfileDto> {
    return this.profileService.updateProfile(req.user.sub, dto);
  }
}
