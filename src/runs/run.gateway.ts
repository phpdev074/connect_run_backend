import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { RunsService } from './runs.service';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: true, namespace: 'runs' })
export class RunGateway {
  @WebSocketServer()
  server: Server;

  constructor(private readonly runsService: RunsService) { }

  @SubscribeMessage('run:join')
  handleJoin(
    @MessageBody() data: { runId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.join(data.runId);
    return { success: true };
  }

  @SubscribeMessage('location:update')
  async handleLocation(
    @MessageBody()
    data: {
      runId: string;
      userId: string;
      lat: number;
      lng: number;
      timestamp: number;
    },
    @ConnectedSocket() client: Socket,
  ) {
    const shouldStore = await this.runsService.shouldStorePoint(
      data.runId,
      data.userId,
      data.lat,
      data.lng,
      data.timestamp,
    );

    if (!shouldStore) return;

    await this.runsService.saveLocation(data);

    // broadcast to others
    client.to(data.runId).emit('location:receive', data);
  }
}