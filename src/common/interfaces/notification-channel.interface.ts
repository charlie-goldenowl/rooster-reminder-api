export interface INotificationChannel {
  getChannelType(): string;
  sendMessage(message: string, recipient: any): Promise<boolean>;
}
