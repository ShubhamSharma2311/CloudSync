import { CloudProvider, ConnectionStatus } from '@prisma/client';
import { ICloudProvider, ProviderResourceContract } from './types';

export class GCPProvider implements ICloudProvider {
  readonly providerId = CloudProvider.GCP;

  async verifyCredentials(credentialsCiphertext: Buffer, credentialsMetadata: any): Promise<ConnectionStatus> {
    // TODO: Decrypt credentials, call GCP identity services to verify connection
    return ConnectionStatus.UNKNOWN;
  }

  async fetchResources(credentialsCiphertext: Buffer, credentialsMetadata: any): Promise<ProviderResourceContract[]> {
    // TODO: Decrypt credentials, use GCP SDK to fetch resources and normalize
    return [];
  }
}
