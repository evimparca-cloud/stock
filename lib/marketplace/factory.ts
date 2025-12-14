import { IMarketplaceService, MarketplaceCredentials } from './types';
import { TrendyolService } from './trendyol';
import { HepsiburadaService } from './hepsiburada';

export class MarketplaceFactory {
  static createService(
    marketplaceName: string,
    credentials: MarketplaceCredentials
  ): IMarketplaceService {
    const lowerName = marketplaceName.toLowerCase();
    
    switch (lowerName) {
      case 'trendyol':
        return new TrendyolService(credentials);
      
      case 'hepsiburada':
        return new HepsiburadaService(credentials);
      
      case 'amazon':
      case 'amazon tr':
        // Amazon entegrasyonu için placeholder
        throw new Error('Amazon entegrasyonu henüz hazır değil');
      
      default:
        throw new Error(`Desteklenmeyen pazaryeri: ${marketplaceName}`);
    }
  }

  static getSupportedMarketplaces(): string[] {
    return ['Trendyol', 'Hepsiburada'];
  }
}
