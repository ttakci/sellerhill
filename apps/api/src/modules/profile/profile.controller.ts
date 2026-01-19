import { Body, Controller, Get, Patch, Request, UseGuards } from '@nestjs/common';
import { ProfileDto, UpdateProfileRequest } from '@repo/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProfileService } from './profile.service';

@Controller({ path: 'profile', version: '1' })
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  async getProfile(@Request() req: any): Promise<ProfileDto> {
    return this.profileService.getProfile(req.user.sub);
  }

  @Patch()
  async updateProfile(
    @Request() req: any,
    @Body() dto: UpdateProfileRequest
  ): Promise<ProfileDto> {
    return this.profileService.updateProfile(req.user.sub, dto);
  }
}
