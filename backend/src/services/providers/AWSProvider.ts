import { CloudProvider, ConnectionStatus } from '@prisma/client';
import { ICloudProvider, ProviderResourceContract } from './types';

export class AWSProvider implements ICloudProvider {
  readonly providerId = CloudProvider.AWS;

  async verifyCredentials(credentialsCiphertext: Buffer, credentialsMetadata: any): Promise<ConnectionStatus> {
    // TODO: Decrypt credentials, call AWS STS getCallerIdentity to verify connection
    return ConnectionStatus.UNKNOWN;
  }

  async fetchResources(credentialsCiphertext: Buffer, credentialsMetadata: any): Promise<ProviderResourceContract[]> {
    // TODO: Decrypt credentials, use AWS SDK to fetch resources and normalize
    return [];
  }
}
