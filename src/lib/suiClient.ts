import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client';

export const suiClient = new SuiClient({ url: getFullnodeUrl('testnet') });

// Contract constants
export const REGISTRY_ID = '0x46ca18174b0ee4863620789dac040ec45bf5d29ad49ee0eae144ae0a5aafe12e';
export const PACKAGE_ID = '0x35d96e2d13167aab9aa8fab8530217a88d1c90ce027cdebc504fb2f74c636714';
export const MODULE = 'dropnew';
export const COIN_TYPE = '0x2::sui::SUI';
export const CLOCK_ID = '0x6';