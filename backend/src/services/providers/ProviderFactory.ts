import { CloudProvider } from '@prisma/client';
import { ICloudProvider } from './types';
import { AWSProvider } from './AWSProvider';
import { GCPProvider } from './GCPProvider';
import { AzureProvider } from './AzureProvider';

// Assuming AppError exists, otherwise factory will just throw an Error. 
// We will throw standard Error to keep it decoupled from Express/http layer.
export class ProviderFactory {
  private readonly providers: Map<CloudProvider, ICloudProvider> = new Map();

  constructor() {
    this.registerProvider(new AWSProvider());
    this.registerProvider(new GCPProvider());
    this.registerProvider(new AzureProvider());
  }

  private registerProvider(provider: ICloudProvider) {
    this.providers.set(provider.providerId, provider);
  }

  public getProvider(cloudProvider: CloudProvider): ICloudProvider {
    const provider = this.providers.get(cloudProvider);
    if (!provider) {
      throw new Error(`Unsupported cloud provider: ${cloudProvider}`);
    }
    return provider;
  }
}

export const providerFactory = new ProviderFactory();
