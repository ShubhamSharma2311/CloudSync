import { CloudProvider, ConnectionStatus, ResourceType, ResourceStatus } from '@prisma/client';

export interface ProviderResourceContract {
  providerResourceId: string;
  resourceType: ResourceType;
  name: string;
  region: string | null;
  status: ResourceStatus;
  rawMetadata: Record<string, any>;
  tags: Record<string, string> | null;
}

export interface ICloudProvider {
  /**
   * The provider ID mapping to the CloudProvider enum.
   */
  readonly providerId: CloudProvider;

  /**
   * Verifies the provided credentials are valid.
   */
  verifyCredentials(credentialsCiphertext: Buffer, credentialsMetadata: any): Promise<ConnectionStatus>;

  /**
   * Fetches resources from the cloud provider, normalized into the unified contract.
   */
  fetchResources(credentialsCiphertext: Buffer, credentialsMetadata: any): Promise<ProviderResourceContract[]>;
}
