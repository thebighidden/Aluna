import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { CreateWaitlistSubscriberDto } from './dto/create-waitlist-subscriber.dto';
import { WaitlistService } from './waitlist.service';

@Controller('waitlist')
export class WaitlistController {
  constructor(private readonly waitlist: WaitlistService) {}

  @Post()
  @Public()
  @HttpCode(HttpStatus.OK)
  subscribe(@Body() dto: CreateWaitlistSubscriberDto): Promise<{ status: 'subscribed' }> {
    return this.waitlist.subscribe(dto);
  }
}
