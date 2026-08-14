import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthUser } from '../auth/auth.types';
import { CreateGroupDto } from './dto/create-group.dto';
import { GroupsService } from './groups.service';

@Controller('groups')
@UseGuards(JwtAuthGuard)
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Post()
  create(
    @Req() request: Request & { user: AuthUser },
    @Body() dto: CreateGroupDto,
  ) {
    return this.groupsService.create(request.user.userId, dto);
  }

  @Get()
  findAll(@Req() request: Request & { user: AuthUser }) {
    return this.groupsService.findAll(request.user.userId);
  }

  @Get(':id')
  findOne(
    @Req() request: Request & { user: AuthUser },
    @Param('id') groupId: string,
  ) {
    return this.groupsService.findOne(request.user.userId, groupId);
  }
}
