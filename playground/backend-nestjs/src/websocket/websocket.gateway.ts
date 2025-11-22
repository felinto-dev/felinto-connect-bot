import { Injectable } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, WebSocket } from 'ws';
import { BroadcastMessage } from '../common/types/websocket.types';

@Injectable()
@WebSocketGateway({ path: '/ws' })
export class WebsocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  private clients: Set<WebSocket> = new Set();

  handleConnection(client: WebSocket) {
    this.clients.add(client);
    console.log('Cliente conectado via WebSocket');

    client.on('error', (error) => {
      console.error('WebSocket client error:', error);
      this.clients.delete(client);
    });
  }

  handleDisconnect(client: WebSocket) {
    this.clients.delete(client);
    console.log('Cliente desconectado');
  }

  broadcast(message: BroadcastMessage): void {
    const serializedMessage = JSON.stringify(message);
    let sentCount = 0;

    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(serializedMessage);
          sentCount++;
        } catch (error) {
          console.error('Error sending message to client:', error);
        }
      }
    }

    // Retry logic for important messages
    if (sentCount === 0 && (message.type === 'success' || message.type === 'error')) {
      setTimeout(() => {
        let retryCount = 0;
        for (const client of this.clients) {
          if (client.readyState === WebSocket.OPEN) {
            try {
              client.send(serializedMessage);
              retryCount++;
            } catch (error) {
              console.error('Error retrying message to client:', error);
            }
          }
        }
        if (retryCount > 0) {
          console.log(`Retried ${message.type} message to ${retryCount} clients`);
        }
      }, 100);
    }
  }
}