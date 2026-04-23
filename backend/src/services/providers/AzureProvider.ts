import { CloudProvider, ConnectionStatus } from '@prisma/client';
import { ICloudProvider, ProviderResourceContract } from './types';

export class AzureProvider implements ICloudProvider {
  readonly providerId = CloudProvider.AZURE;

  async verifyCredentials(credentialsCiphertext: Buffer, credentialsMetadata: any): Promise<ConnectionStatus> {
    // TODO: Decrypt credentials, call Azure AD to verify connection
    return ConnectionStatus.UNKNOWN;
  }

  async fetchResources(credentialsCiphertext: Buffer, credentialsMetadata: any): Promise<ProviderResourceContract[]> {
    // TODO: Decrypt credentials, use Azure SDK to fetch resources and normalize
    return [];
  }
}
